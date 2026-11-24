// Accounts, sessions, and access control. Email + password with PBKDF2-SHA256,
// server-side sessions in D1, and a one-time admin bootstrap.
import * as db from "./db";
import { ALL_PATHS, AREAS, AVAILABILITY, FORMATS, clamp, normCareer } from "./logic";
import { esc, html, layout, options } from "./ui";

export interface Env {
  DB: D1Database;
  AI?: Ai;
  /** Comma-separated emails that become program admins when they sign up. */
  ADMIN_EMAIL?: string;
}

export const AUTH_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    pass_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    failed INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id)`,
  `CREATE TABLE IF NOT EXISTS password_resets (
    token TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  )`,
];

const COOKIE = "ember_session";
const SESSION_DAYS = 30;
const ITERATIONS = 100_000;
const MIN_PASSWORD = 10;
const MAX_FAILED = 8;
const LOCK_MINUTES = 15;

export interface Me {
  accountId: number;
  userId: number;
  email: string;
  name: string;
  role: "mentee" | "mentor" | "admin";
  /** What the member signed up as, independent of the admin permission. */
  profileRole: "mentee" | "mentor";
}

// ---------------------------------------------------------------- crypto
const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** pbkdf2$<iterations>$<salt>$<hash> */
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, key, 256);
  return `pbkdf2$${ITERATIONS}$${b64url(salt)}$${b64url(new Uint8Array(bits))}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, want] = stored.split("$");
  if (scheme !== "pbkdf2" || !iter || !salt || !want) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: fromB64url(salt), iterations: parseInt(iter, 10), hash: "SHA-256" }, key, 256);
  const got = b64url(new Uint8Array(bits));
  // Constant-time-ish compare.
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------- sessions
function cookieValue(req: Request, name: string): string {
  const raw = req.headers.get("cookie") ?? "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? m[1] : "";
}

function sessionCookie(token: string, maxAge: number): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function me(req: Request, env: Env): Promise<Me | null> {
  const token = cookieValue(req, COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT a.id AS account_id, a.email, a.role AS account_role, a.user_id, u.name, u.role AS user_role
     FROM sessions s JOIN accounts a ON a.id = s.account_id JOIN users u ON u.id = a.user_id
     WHERE s.id = ? AND s.expires_at > ?`,
  )
    .bind(await sha256(token), new Date().toISOString())
    .first<{ account_id: number; email: string; account_role: string; user_id: number; name: string; user_role: string }>();
  if (!row) return null;
  return {
    accountId: row.account_id,
    userId: row.user_id,
    email: row.email,
    name: row.name,
    role: row.account_role === "admin" ? "admin" : row.user_role === "mentor" ? "mentor" : "mentee",
    profileRole: row.user_role === "mentor" ? "mentor" : "mentee",
  };
}

async function startSession(env: Env, accountId: number): Promise<Response> {
  const token = randomToken();
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).bind(new Date(now).toISOString()),
    env.DB
      .prepare(`INSERT INTO sessions (id, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)`)
      .bind(await sha256(token), accountId, new Date(now).toISOString(), new Date(now + SESSION_DAYS * 864e5).toISOString()),
  ]);
  return new Response(null, { status: 303, headers: { location: "/", "set-cookie": sessionCookie(token, SESSION_DAYS * 86400) } });
}

export async function logout(req: Request, env: Env): Promise<Response> {
  const token = cookieValue(req, COOKIE);
  if (token) await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(await sha256(token)).run();
  return new Response(null, { status: 303, headers: { location: "/", "set-cookie": sessionCookie("", 0) } });
}

/** Only same-site form posts are accepted (cookies are SameSite=Lax as well). */
export function sameOrigin(req: Request): boolean {
  if (req.method !== "POST") return true;
  const origin = req.headers.get("origin");
  if (!origin) return true; // some browsers omit it on same-origin posts
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

/** Adds the headers a public site should always send. */
export function secure(res: Response): Response {
  const h = new Headers(res.headers);
  h.set("x-content-type-options", "nosniff");
  h.set("x-frame-options", "DENY");
  h.set("referrer-policy", "strict-origin-when-cross-origin");
  h.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  h.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  h.set(
    "content-security-policy",
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; " +
      "img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'",
  );
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

// ---------------------------------------------------------------- pages
const field = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const validEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length <= 200;

export function loginPage(next = "", error = "", notice = ""): Response {
  const body = `
<div class="banner"><h1>Sign in</h1><p>TechWomenAZ mentoring: matched by coursework, kept going with a flame for every pair.</p></div>
${notice ? `<div class="notice">${esc(notice)}</div>` : ""}
${error ? `<div class="notice" role="alert" style="background:#fdecea;border-color:#f5c2bd;color:#7a1f16">${esc(error)}</div>` : ""}
<form method="post" action="/login" class="card" style="max-width:26rem">
  <input type="hidden" name="next" value="${esc(next)}">
  <label for="email">Email</label><input id="email" name="email" type="email" required autocomplete="email" maxlength="200">
  <label for="password">Password</label><input id="password" name="password" type="password" required autocomplete="current-password">
  <button class="btn" type="submit" style="margin-top:1rem;width:100%">Sign in</button>
  <p class="muted" style="font-size:.9rem;margin-top:.8rem">New here? <a href="/signup">Create an account</a>. Forgotten your password? Ask a program admin for a reset link.</p>
</form>`;
  return html(layout("Sign in", body, "/login"));
}

export async function loginSubmit(req: Request, env: Env): Promise<Response> {
  const f = await req.formData();
  const email = field(f, "email", 200).toLowerCase();
  const password = String(f.get("password") ?? "");
  const next = field(f, "next", 300);
  const back = `/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  if (!validEmail(email) || !password) return loginPage(next, "Enter your email and password.");
  const account = await env.DB.prepare(`SELECT id, pass_hash, failed, locked_until FROM accounts WHERE email = ?`)
    .bind(email)
    .first<{ id: number; pass_hash: string; failed: number; locked_until: string }>();
  const bad = "That email and password don't match an account.";
  if (!account) return loginPage(next, bad);
  if (account.locked_until && account.locked_until > new Date().toISOString())
    return loginPage(next, `Too many attempts. Try again after ${new Date(account.locked_until).toLocaleTimeString("en-US", { timeZone: "America/Phoenix" })} (Arizona).`);
  if (!(await verifyPassword(password, account.pass_hash))) {
    const failed = account.failed + 1;
    const locked = failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60e3).toISOString() : "";
    await env.DB.prepare(`UPDATE accounts SET failed = ?, locked_until = ? WHERE id = ?`).bind(failed, locked, account.id).run();
    return loginPage(next, locked ? "Too many attempts. This account is locked for 15 minutes." : bad);
  }
  await env.DB.prepare(`UPDATE accounts SET failed = 0, locked_until = '' WHERE id = ?`).bind(account.id).run();
  const res = await startSession(env, account.id);
  const loc = next.startsWith("/") && !next.startsWith("//") ? next : "/home";
  return new Response(null, { status: 303, headers: { location: loc, "set-cookie": res.headers.get("set-cookie")! } });
}

export function signupPage(error = "", form: Record<string, string> = {}): Response {
  const body = `
<div class="banner"><h1>Create your account</h1><p>For college students and adults (18+). No tech degree needed.</p></div>
${error ? `<div class="notice" role="alert" style="background:#fdecea;border-color:#f5c2bd;color:#7a1f16">${esc(error)}</div>` : ""}
<form method="post" action="/signup" class="card">
  <fieldset><legend><b>I want to…</b></legend>
    <label class="check"><input type="radio" name="role" value="mentee" ${form.role !== "mentor" ? "checked" : ""} onchange="roleChange()"> Find a mentor</label>
    <label class="check"><input type="radio" name="role" value="mentor" ${form.role === "mentor" ? "checked" : ""} onchange="roleChange()"> Be a mentor</label>
  </fieldset>
  <div class="two">
    <div><label for="name">Name</label><input id="name" name="name" required maxlength="80" autocomplete="name" value="${esc(form.name ?? "")}"></div>
    <div><label for="email">Email</label><input id="email" name="email" type="email" required maxlength="200" autocomplete="email" value="${esc(form.email ?? "")}"></div>
    <div><label for="password">Password</label><input id="password" name="password" type="password" required minlength="${MIN_PASSWORD}" autocomplete="new-password" aria-describedby="pwhint"></div>
    <div><label for="password2">Password again</label><input id="password2" name="password2" type="password" required minlength="${MIN_PASSWORD}" autocomplete="new-password"></div>
  </div>
  <p class="muted" id="pwhint" style="font-size:.85rem;margin:.3rem 0 0">At least ${MIN_PASSWORD} characters. We never email you your password.</p>
  <div class="two">
    <div><label for="career">Career path</label><select id="career" name="career">${options(ALL_PATHS, form.career ?? "")}</select></div>
    <div><label for="headline" id="headlineLabel">Where you are now</label><input id="headline" name="headline" maxlength="120" value="${esc(form.headline ?? "")}" placeholder="e.g. ASU junior, Graphic Design"></div>
    <div><label for="school">School or program</label><input id="school" name="school" maxlength="120" value="${esc(form.school ?? "")}"></div>
    <div><label for="availability">Availability</label><select id="availability" name="availability">${options(AVAILABILITY)}</select></div>
    <div><label for="format">Meeting format</label><select id="format" name="format">${options(FORMATS, "Both")}</select></div>
    <div><label for="area">Area</label><select id="area" name="area">${options(AREAS)}</select></div>
    <div id="capBox" style="display:none"><label for="capacity">Mentees you can take</label><input id="capacity" name="capacity" type="number" min="1" max="20" value="2"></div>
    <div><label for="confidence">Confidence about your tech career (1-10)</label><input id="confidence" name="confidence" type="number" min="1" max="10" value="5"></div>
  </div>
  <label for="courses" id="coursesLabel">Courses you're taking or have taken</label>
  <input id="courses" name="courses" maxlength="400" required placeholder="Separate with commas: Intro to UX Design, Statistics, SQL Databases" value="${esc(form.courses ?? "")}">
  <label for="goal" id="goalLabel">Your main goal</label>
  <input id="goal" name="goal" maxlength="200" required value="${esc(form.goal ?? "")}" placeholder="e.g. Land a UX internship by May">
  <label class="check" style="margin-top:.8rem"><input type="checkbox" name="no_degree" value="1"> I don't have a tech degree</label>
  <label class="check"><input type="checkbox" name="adult" value="1" required> I'm 18 or older and in college or beyond</label>
  <label class="check"><input type="checkbox" name="consent" value="1" required> I agree that TechWomenAZ can store my answers to run the program and report combined, anonymous results</label>
  <button class="btn" type="submit" style="margin-top:1rem">Create account</button>
  <p class="muted" style="font-size:.9rem;margin-top:.6rem">Already have an account? <a href="/login">Sign in</a></p>
</form>
<script>
function roleChange(){var m=document.querySelector('input[name=role]:checked').value==='mentor';
document.getElementById('capBox').style.display=m?'block':'none';
document.getElementById('coursesLabel').textContent=m?'Courses you have taken or teach':'Courses you are taking or have taken';
document.getElementById('goalLabel').textContent=m?'What you can help with':'Your main goal';
document.getElementById('headlineLabel').textContent=m?'Your role':'Where you are now';}
roleChange();
</script>`;
  return html(layout("Create account", body, "/signup"));
}

export async function signupSubmit(req: Request, env: Env): Promise<Response> {
  const f = await req.formData();
  const role = field(f, "role", 20) === "mentor" ? "mentor" : "mentee";
  const name = field(f, "name", 80);
  const email = field(f, "email", 200).toLowerCase();
  const password = String(f.get("password") ?? "");
  const password2 = String(f.get("password2") ?? "");
  const goal = field(f, "goal", 200);
  const courses = field(f, "courses", 400);
  const form = { role, name, email, goal, courses, career: field(f, "career", 60), headline: field(f, "headline", 120), school: field(f, "school", 120) };
  const fail = (msg: string) => signupPage(msg, form);
  if (!name || !goal || !courses) return fail("Add your name, courses and goal.");
  if (!validEmail(email)) return fail("Enter a valid email address.");
  if (password.length < MIN_PASSWORD) return fail(`Use at least ${MIN_PASSWORD} characters for your password.`);
  if (password !== password2) return fail("The two passwords don't match.");
  if (!f.get("adult")) return fail("TechWomenAZ mentoring is for people 18+ in college or beyond.");
  if (!f.get("consent")) return fail("Please tick the data consent box so we can match you.");
  const taken = await env.DB.prepare(`SELECT id FROM accounts WHERE email = ?`).bind(email).first<{ id: number }>();
  if (taken) return fail("An account with that email already exists. Try signing in.");
  const userId = await db.createUser(env.DB, {
    name,
    role,
    career: normCareer(form.career),
    no_degree: f.get("no_degree") ? 1 : 0,
    goal,
    headline: form.headline,
    courses,
    school: form.school,
    availability: AVAILABILITY.includes(field(f, "availability", 40)) ? field(f, "availability", 40) : AVAILABILITY[0],
    format: FORMATS.includes(field(f, "format", 20)) ? field(f, "format", 20) : "Both",
    area: AREAS.includes(field(f, "area", 40)) ? field(f, "area", 40) : AREAS[0],
    confidence: clamp(parseInt(field(f, "confidence", 2), 10) || 5, 1, 10),
    capacity: role === "mentor" ? clamp(parseInt(field(f, "capacity", 2), 10) || 2, 1, 20) : 0,
  });
  // ADMIN_EMAIL (or, failing that, the very first account) is the program admin,
  // so a fresh install always has someone who can post opportunities and invite people.
  const others = await env.DB.prepare(`SELECT COUNT(*) AS n FROM accounts`).first<{ n: number }>();
  const allowed = (env.ADMIN_EMAIL ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const admin = allowed.includes(email) || !others || others.n === 0;
  const row = await env.DB.prepare(`INSERT INTO accounts (user_id, email, pass_hash, role, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id`)
    .bind(userId, email, await hashPassword(password), admin ? "admin" : "member", new Date().toISOString())
    .first<{ id: number }>();
  const res = await startSession(env, row!.id);
  return new Response(null, {
    status: 303,
    headers: { location: role === "mentor" ? `/mentor/${userId}` : `/matches/${userId}?new=1`, "set-cookie": res.headers.get("set-cookie")! },
  });
}

// ---------------------------------------------------------------- account + reset
export async function accountPage(req: Request, env: Env, url: URL): Promise<Response> {
  const user = (await me(req, env))!;
  const body = `
<div class="banner"><h1>Your account</h1><p>${esc(user.email)} · ${user.role === "admin" ? "Program admin" : user.role === "mentor" ? "Mentor" : "Mentee"}</p></div>
${url.searchParams.get("saved") ? `<div class="notice">Account updated.</div>` : ""}
${url.searchParams.get("badsaved") ? `<div class="notice" role="alert" style="background:#fdecea;border-color:#f5c2bd;color:#7a1f16">Could not change your password. Check your current password and use at least ${MIN_PASSWORD} characters.</div>` : ""}
<div class="two" style="align-items:start">
  <div class="card"><h2 style="font-size:1.2rem;margin-top:0">Change password</h2>
    <form method="post" action="/account/password">
      <label for="current">Current password</label><input id="current" name="current" type="password" required autocomplete="current-password">
      <label for="next">New password</label><input id="next" name="next" type="password" required minlength="${MIN_PASSWORD}" autocomplete="new-password">
      <label for="next2">New password again</label><input id="next2" name="next2" type="password" required minlength="${MIN_PASSWORD}" autocomplete="new-password">
      <button class="btn" type="submit" style="margin-top:1rem">Change password</button>
    </form></div>
  <div class="card"><h2 style="font-size:1.2rem;margin-top:0">Your profile</h2>
    <p class="muted">Your name, courses, goal, availability and bio live on your profile.</p>
    <a class="btn ghost" href="/profile/${user.userId}">Edit my profile</a>
    ${user.role === "admin" ? `<a class="btn ghost" href="/admin/accounts">Manage accounts</a>` : ""}
    <form method="post" action="/logout" style="margin-top:.8rem"><button class="btn ghost" type="submit">Sign out</button></form>
  </div>
</div>`;
  return html(layout("Account", body, "/account"));
}

export async function changePassword(req: Request, env: Env): Promise<Response> {
  const user = (await me(req, env))!;
  const f = await req.formData();
  const current = String(f.get("current") ?? "");
  const next = String(f.get("next") ?? "");
  const next2 = String(f.get("next2") ?? "");
  const account = await env.DB.prepare(`SELECT pass_hash FROM accounts WHERE id = ?`).bind(user.accountId).first<{ pass_hash: string }>();
  if (!account || !(await verifyPassword(current, account.pass_hash)) || next.length < MIN_PASSWORD || next !== next2) {
    return new Response(null, { status: 303, headers: { location: "/account?badsaved=1" } });
  }
  await env.DB.prepare(`UPDATE accounts SET pass_hash = ? WHERE id = ?`).bind(await hashPassword(next), user.accountId).run();
  // Keep this session, drop the others.
  const keep = cookieValue(req, COOKIE);
  await env.DB.prepare(`DELETE FROM sessions WHERE account_id = ? AND id <> ?`).bind(user.accountId, await sha256(keep)).run();
  return new Response(null, { status: 303, headers: { location: "/account?saved=1" } });
}

export function resetPage(token: string, error = ""): Response {
  const body = `
<div class="banner"><h1>Set a new password</h1><p>This link works once and expires in 24 hours.</p></div>
${error ? `<div class="notice" role="alert" style="background:#fdecea;border-color:#f5c2bd;color:#7a1f16">${esc(error)}</div>` : ""}
<form method="post" action="/reset" class="card" style="max-width:26rem">
  <input type="hidden" name="token" value="${esc(token)}">
  <label for="password">New password</label><input id="password" name="password" type="password" required minlength="${MIN_PASSWORD}" autocomplete="new-password">
  <label for="password2">New password again</label><input id="password2" name="password2" type="password" required minlength="${MIN_PASSWORD}" autocomplete="new-password">
  <button class="btn" type="submit" style="margin-top:1rem;width:100%">Save password</button>
</form>`;
  return html(layout("Set a new password", body, ""));
}

export async function resetForm(req: Request, env: Env, url: URL): Promise<Response> {
  const token = (url.searchParams.get("token") ?? "").slice(0, 100);
  if (!token) return resetPage("", "That reset link is missing its token. Ask a program admin for a new one.");
  const row = await env.DB.prepare(`SELECT used, expires_at FROM password_resets WHERE token = ?`).bind(token).first<{ used: number; expires_at: string }>();
  if (!row || row.used || row.expires_at <= new Date().toISOString()) return resetPage("", "That reset link has expired or was already used. Ask a program admin for a new one.");
  return resetPage(token);
}

export async function resetSubmit(req: Request, env: Env): Promise<Response> {
  const f = await req.formData();
  const token = field(f, "token", 100);
  const password = String(f.get("password") ?? "");
  const password2 = String(f.get("password2") ?? "");
  const row = await env.DB.prepare(`SELECT account_id, used, expires_at FROM password_resets WHERE token = ?`)
    .bind(token)
    .first<{ account_id: number; used: number; expires_at: string }>();
  if (!row || row.used || row.expires_at <= new Date().toISOString()) return resetPage("", "That reset link has expired or was already used. Ask a program admin for a new one.");
  if (password.length < MIN_PASSWORD) return resetPage(token, `Use at least ${MIN_PASSWORD} characters.`);
  if (password !== password2) return resetPage(token, "The two passwords don't match.");
  await env.DB.batch([
    env.DB.prepare(`UPDATE accounts SET pass_hash = ?, failed = 0, locked_until = '' WHERE id = ?`).bind(await hashPassword(password), row.account_id),
    env.DB.prepare(`UPDATE password_resets SET used = 1 WHERE token = ?`).bind(token),
    env.DB.prepare(`DELETE FROM sessions WHERE account_id = ?`).bind(row.account_id),
  ]);
  return new Response(null, { status: 303, headers: { location: "/login?reset=1" } });
}

// ---------------------------------------------------------------- admin: accounts
export async function adminAccounts(req: Request, env: Env, url: URL): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT a.id, a.email, a.role, a.created_at, u.name, u.role AS user_role,
      (SELECT COUNT(*) FROM sessions s WHERE s.account_id = a.id AND s.expires_at > ?) AS sessions
     FROM accounts a JOIN users u ON u.id = a.user_id ORDER BY a.created_at`,
  )
    .bind(new Date().toISOString())
    .all<{ id: number; email: string; role: string; created_at: string; name: string; user_role: string; sessions: number }>();
  const link = url.searchParams.get("link") ?? "";
  const origin = new URL(url).origin;
  const body = `
<div class="banner"><div class="row" style="justify-content:space-between;position:relative;z-index:1"><h1>Accounts</h1><a class="btn light" href="/campfire">Campfire</a></div>
<p>Invite people by having them sign up at /signup. Issue a reset link if someone is locked out.</p></div>
${link ? `<div class="notice">One-time reset link (share it privately, it expires in 24 hours):<br><code style="word-break:break-all">${esc(origin)}/reset?token=${esc(link)}</code></div>` : ""}
${url.searchParams.get("role") ? `<div class="notice">Role updated.</div>` : ""}
<div class="card"><h2 style="font-size:1.2rem;margin-top:0">${rows.results.length} account${rows.results.length === 1 ? "" : "s"}</h2>
${rows.results
  .map(
    (a) => `<div class="dm" style="cursor:default">
  <span class="pavatar sm">${esc(a.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase())}</span>
  <span class="tbody"><span class="tname">${esc(a.name)} ${a.role === "admin" ? `<span class="chip sage">Admin</span>` : ""}</span>
  <span class="tlast">${esc(a.email)} · ${esc(a.user_role)} · joined ${esc(a.created_at.slice(0, 10))}${a.sessions ? ` · ${a.sessions} active session${a.sessions === 1 ? "" : "s"}` : ""}</span></span>
  <span class="row" style="gap:.3rem">
    <form method="post" action="/admin/accounts/${a.id}/reset"><button class="btn small ghost" type="submit">Reset link</button></form>
    <form method="post" action="/admin/accounts/${a.id}/role"><input type="hidden" name="role" value="${a.role === "admin" ? "member" : "admin"}"><button class="btn small ghost" type="submit">${a.role === "admin" ? "Remove admin" : "Make admin"}</button></form>
  </span>
</div>`,
  )
  .join("") || `<p class="muted">No accounts yet.</p>`}
</div>`;
  return html(layout("Accounts", body, "/admin/accounts"));
}

export async function adminIssueReset(req: Request, env: Env, accountId: number): Promise<Response> {
  const account = await env.DB.prepare(`SELECT id FROM accounts WHERE id = ?`).bind(accountId).first<{ id: number }>();
  if (!account) return new Response(null, { status: 303, headers: { location: "/admin/accounts" } });
  const token = randomToken(24);
  await env.DB.prepare(`INSERT INTO password_resets (token, account_id, expires_at, used) VALUES (?, ?, ?, 0)`)
    .bind(token, accountId, new Date(Date.now() + 864e5).toISOString())
    .run();
  return new Response(null, { status: 303, headers: { location: `/admin/accounts?link=${token}` } });
}

export async function adminSetRole(req: Request, env: Env, accountId: number): Promise<Response> {
  const f = await req.formData();
  const role = field(f, "role", 10) === "admin" ? "admin" : "member";
  await env.DB.prepare(`UPDATE accounts SET role = ? WHERE id = ?`).bind(role, accountId).run();
  return new Response(null, { status: 303, headers: { location: "/admin/accounts?role=1" } });
}

/** Small helper for page code: a 403 with a way back. */
export function forbidden(): Response {
  return html(layout("Not allowed", `<div class="card"><h1>You don't have access to that</h1><p>Sign in with the right account, or <a href="/home">go to your dashboard</a>.</p></div>`), 403);
}
