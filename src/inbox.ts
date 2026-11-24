// Direct messages between any two people (mentors, mentees, employers) and the shared calendar.
// The demo has no logins, so "who you are" lives in a cookie: pick a person or an organization
// on /switch and every message, calendar and profile button acts as them.
import { addMeeting } from "./social";
import { esc, html, layout, options } from "./ui";

interface Env {
  DB: D1Database;
  AI?: Ai;
}

export const DM_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS dm_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    a_key TEXT NOT NULL,
    b_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (a_key, b_key)
  )`,
  `CREATE TABLE IF NOT EXISTS dm_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL,
    sender_key TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_dm_thread ON dm_messages(thread_id)`,
];

// ---------------------------------------------------------------- Who am I
const COOKIE = "ember_as";
const MAX_AGE = 60 * 60 * 24 * 30;

export interface Ident {
  /** "u:12" for a person, "o:3" for an organization. */
  key: string;
  kind: "user" | "org";
  id: number;
  name: string;
  /** "Mentor", "Mentee", "Company", "Nonprofit"… */
  role: string;
  href: string;
  detail: string;
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function identKeyFrom(req: Request): string {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)ember_as=([^;]*)/);
  if (!m) return "";
  const key = decodeURIComponent(m[1]).slice(0, 20);
  return /^(u|o):\d+$/.test(key) ? key : "";
}

export async function loadIdent(env: Env, key: string): Promise<Ident | null> {
  const m = key.match(/^(u|o):(\d+)$/);
  if (!m) return null;
  const id = +m[2];
  if (m[1] === "u") {
    const u = await env.DB.prepare(`SELECT id, name, role, career, headline FROM users WHERE id = ?`)
      .bind(id)
      .first<{ id: number; name: string; role: string; career: string; headline: string }>();
    if (!u) return null;
    return {
      key: `u:${u.id}`,
      kind: "user",
      id: u.id,
      name: u.name,
      role: u.role === "mentor" ? "Mentor" : "Mentee",
      href: `/profile/${u.id}`,
      detail: [u.headline, u.career].filter(Boolean).join(" · "),
    };
  }
  const o = await env.DB.prepare(`SELECT id, name, kind, about FROM orgs WHERE id = ?`)
    .bind(id)
    .first<{ id: number; name: string; kind: string; about: string }>();
  if (!o) return null;
  return { key: `o:${o.id}`, kind: "org", id: o.id, name: o.name, role: o.kind, href: `/orgs/${o.id}`, detail: o.about };
}

export async function currentIdent(req: Request, env: Env): Promise<Ident | null> {
  const key = identKeyFrom(req);
  return key ? loadIdent(env, key) : null;
}

/** Loads several identities at once (used for thread lists). */
export async function loadIdents(env: Env, keys: string[]): Promise<Map<string, Ident>> {
  const wanted = [...new Set(keys)].filter((k) => /^(u|o):\d+$/.test(k));
  const out = new Map<string, Ident>();
  if (!wanted.length) return out;
  const users = wanted.filter((k) => k.startsWith("u:")).map((k) => +k.slice(2));
  const orgs = wanted.filter((k) => k.startsWith("o:")).map((k) => +k.slice(2));
  if (users.length) {
    const { results } = await env.DB.prepare(`SELECT id, name, role, career, headline FROM users WHERE id IN (${users.map(() => "?").join(",")})`)
      .bind(...users)
      .all<{ id: number; name: string; role: string; career: string; headline: string }>();
    for (const u of results) {
      out.set(`u:${u.id}`, {
        key: `u:${u.id}`,
        kind: "user",
        id: u.id,
        name: u.name,
        role: u.role === "mentor" ? "Mentor" : "Mentee",
        href: `/profile/${u.id}`,
        detail: [u.headline, u.career].filter(Boolean).join(" · "),
      });
    }
  }
  if (orgs.length) {
    const { results } = await env.DB.prepare(`SELECT id, name, kind, about FROM orgs WHERE id IN (${orgs.map(() => "?").join(",")})`)
      .bind(...orgs)
      .all<{ id: number; name: string; kind: string; about: string }>();
    for (const o of results) {
      out.set(`o:${o.id}`, { key: `o:${o.id}`, kind: "org", id: o.id, name: o.name, role: o.kind, href: `/orgs/${o.id}`, detail: o.about });
    }
  }
  return out;
}

/** Sets the demo identity cookie. `next` must be a local path. */
export function setAs(key: string, next: string): Response {
  const loc = next.startsWith("/") && !next.startsWith("//") ? next : "/messages";
  return new Response(null, {
    status: 303,
    headers: { location: loc, "set-cookie": `ember_as=${encodeURIComponent(key)}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax` },
  });
}

/** Magic link used after signup: /enter?key=u:21&next=/profile/21 */
export async function enter(req: Request, env: Env, url: URL): Promise<Response> {
  const key = url.searchParams.get("key") ?? "";
  const next = url.searchParams.get("next") ?? "/messages";
  return (await loadIdent(env, key)) ? setAs(key, next) : new Response(null, { status: 303, headers: { location: "/switch" } });
}

export async function apiMe(req: Request, env: Env): Promise<Response> {
  const me = await currentIdent(req, env);
  return Response.json({ ident: me ? { key: me.key, kind: me.kind, id: me.id, name: me.name, role: me.role, href: me.href } : null });
}

// ---------------------------------------------------------------- /switch
export async function switchPage(req: Request, env: Env, url: URL): Promise<Response> {
  const me = await currentIdent(req, env);
  const next = url.searchParams.get("next") ?? "";
  const [users, orgs] = await Promise.all([
    env.DB.prepare(`SELECT id, name, role, headline, career FROM users ORDER BY role, name`).all<{ id: number; name: string; role: string; headline: string; career: string }>(),
    env.DB.prepare(`SELECT id, name, kind, about FROM orgs ORDER BY name`).all<{ id: number; name: string; kind: string; about: string }>(),
  ]);
  const row = (key: string, name: string, role: string, detail: string, href: string) => `<form method="post" action="/switch">
  <input type="hidden" name="key" value="${esc(key)}"><input type="hidden" name="next" value="${esc(next)}">
  <button class="dm" type="submit" style="width:100%;text-align:left;font:inherit">
    <span class="pavatar sm">${esc(initials(name.replace(/\(demo\)/g, "").trim()))}</span>
    <span class="tbody"><span class="tname">${esc(name)}</span><span class="tlast">${esc(role)}${detail ? ` · ${esc(detail)}` : ""}</span></span>
    ${me?.key === key ? `<span class="chip sage">You</span>` : `<span class="chip">Pick</span>`}
  </button></form>
  <p class="muted" style="font-size:.78rem;margin:.2rem 0 .6rem"><a href="${esc(href)}">Open profile</a></p>`;
  const userRows = users.results
    .map((u) => row(`u:${u.id}`, u.name, u.role === "mentor" ? "Mentor" : "Mentee", [u.headline, u.career].filter(Boolean).join(" · "), `/profile/${u.id}`))
    .join("");
  const orgRows = orgs.results.map((o) => row(`o:${o.id}`, o.name, o.kind, o.about, `/orgs/${o.id}`)).join("");
  const body = `
<div class="banner"><h1>Who are you?</h1>
<p>This demo has no logins, so pick a person or an organization. Messages, the calendar and every "Message" button then act as them.</p></div>
${me ? `<div class="notice">You're browsing as <b>${esc(me.name)}</b>. <a href="${esc(me.href)}">Open your profile</a> · <a href="/messages">Your messages</a> · <a href="/calendar">Your calendar</a></div>` : `<div class="notice">Nothing picked yet. Choose below to send messages and book meetings.</div>`}
<div class="two" style="align-items:start">
  <div class="card"><h2 style="font-size:1.2rem;margin-top:0">People (${users.results.length})</h2><div class="inbox">${userRows}</div></div>
  <div class="card"><h2 style="font-size:1.2rem;margin-top:0">Organizations (${orgs.results.length})</h2><div class="inbox">${orgRows}</div></div>
</div>`;
  return html(layout("Who are you", body, ""));
}

export async function switchSubmit(req: Request, env: Env): Promise<Response> {
  const f = await req.formData();
  const key = String(f.get("key") ?? "").slice(0, 20);
  const next = String(f.get("next") ?? "").slice(0, 300);
  if (!(await loadIdent(env, key))) return new Response(null, { status: 303, headers: { location: "/switch" } });
  return setAs(key, next || (await loadIdent(env, key))!.href);
}

// ---------------------------------------------------------------- Threads
interface ThreadRow {
  id: number;
  a_key: string;
  b_key: string;
  last_body: string | null;
  last_at: string | null;
}

async function threadFor(env: Env, a: Ident, b: Ident): Promise<number> {
  const [x, y] = [a.key, b.key].sort();
  await env.DB.prepare(`INSERT OR IGNORE INTO dm_threads (a_key, b_key, created_at) VALUES (?, ?, ?)`).bind(x, y, new Date().toISOString()).run();
  const row = await env.DB.prepare(`SELECT id FROM dm_threads WHERE a_key = ? AND b_key = ?`).bind(x, y).first<{ id: number }>();
  return row!.id;
}

async function listThreads(env: Env, meKey = ""): Promise<ThreadRow[]> {
  const base = `SELECT t.id, t.a_key, t.b_key,
    (SELECT body FROM dm_messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_body,
    (SELECT created_at FROM dm_messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_at
    FROM dm_threads t`;
  const q = meKey ? env.DB.prepare(`${base} WHERE t.a_key = ? OR t.b_key = ? ORDER BY last_at DESC, t.id DESC`).bind(meKey, meKey) : env.DB.prepare(`${base} ORDER BY last_at DESC, t.id DESC`);
  const { results } = await q.all<ThreadRow>();
  return results;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Arizona is UTC-7 all year. */
function azDate(iso: string): string {
  return new Date(Date.parse(iso) - 7 * 3600e3).toISOString().slice(0, 10);
}
function whenLabel(iso: string): string {
  const t = new Date(Date.parse(iso) - 7 * 3600e3);
  if (!Number.isFinite(t.getTime())) return "";
  const today = new Date(Date.now() - 7 * 3600e3).toISOString().slice(0, 10);
  const d = t.toISOString().slice(0, 10);
  const time = `${t.getUTCHours() % 12 || 12}:${pad2(t.getUTCMinutes())} ${t.getUTCHours() < 12 ? "AM" : "PM"}`;
  if (d === today) return time;
  return `${t.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
}

export async function inboxPage(req: Request, env: Env, url: URL): Promise<Response> {
  const me = await currentIdent(req, env);
  const rows = await listThreads(env, me?.key);
  const peers = await loadIdents(
    env,
    rows.map((t) => (me ? (t.a_key === me.key ? t.b_key : t.a_key) : t.a_key)).concat(rows.map((t) => t.b_key)),
  );
  const thread = (t: ThreadRow) => {
    if (!me) {
      const a = peers.get(t.a_key);
      const b = peers.get(t.b_key);
      return `<a class="dm" href="/messages/${esc(t.b_key)}"><span class="pavatar sm">${esc(initials((a?.name ?? "?") + " " + (b?.name ?? "")))}</span>
      <span class="tbody"><span class="tname">${esc(a?.name ?? t.a_key)} ↔ ${esc(b?.name ?? t.b_key)}</span><span class="tlast">${esc(t.last_body ?? "No messages yet")}</span></span>
      <time>${esc(t.last_at ? whenLabel(t.last_at) : "")}</time></a>`;
    }
    const peer = peers.get(t.a_key === me.key ? t.b_key : t.a_key);
    if (!peer) return "";
    return `<a class="dm" href="/messages/${esc(peer.key)}"><span class="pavatar sm">${esc(initials(peer.name))}</span>
    <span class="tbody"><span class="tname">${esc(peer.name)}</span><span class="tlast">${esc(t.last_body ?? "No messages yet — say hi")}</span></span>
    <time>${esc(t.last_at ? whenLabel(t.last_at) : "")}</time></a>`;
  };
  const [users, orgs] = await Promise.all([
    env.DB.prepare(`SELECT id, name, role, headline FROM users ORDER BY role, name`).all<{ id: number; name: string; role: string; headline: string }>(),
    env.DB.prepare(`SELECT id, name, kind FROM orgs ORDER BY name`).all<{ id: number; name: string; kind: string }>(),
  ]);
  const startRow = (key: string, name: string, detail: string) =>
    `<a class="dm" href="/messages/${esc(key)}"><span class="pavatar sm">${esc(initials(name))}</span><span class="tbody"><span class="tname">${esc(name)}</span><span class="tlast">${esc(detail)}</span></span><span class="chip">Message</span></a>`;
  const body = `
<div class="banner"><h1>Messages</h1>
<p>${me ? `You're ${esc(me.name)}.` : "Pick who you are to read and send messages."} Anyone on TechWomenAZ can message a mentor, a mentee or an employer here — no email needed.</p>
<div class="row" style="position:relative;z-index:1;margin-top:.6rem"><a class="btn light" href="/switch">${me ? "Switch person" : "Choose who you are"}</a><a class="btn ghost onDark" href="/calendar">Calendar</a></div></div>
${url.searchParams.get("sent") ? `<div class="notice">Message sent.</div>` : ""}
<div class="card"><h2 style="font-size:1.2rem;margin-top:0">${me ? "Your conversations" : "Every conversation (demo preview)"}</h2>
<p class="muted" style="margin:.2rem 0 .8rem;font-size:.9rem">${me ? "Messages refresh while you keep the tab open." : "Choose who you are above to send a message."}</p>
<div class="inbox">${rows.length ? rows.map(thread).join("") : `<p class="muted">No conversations yet. Start one below.</p>`}</div></div>
<div class="card" style="margin-top:1rem"><h2 style="font-size:1.2rem;margin-top:0">Start a conversation</h2>
<div class="two" style="align-items:start">
  <div><h3 style="font-size:1rem">Mentors and mentees</h3><div class="inbox">${users.results
    .filter((u) => !me || me.key !== `u:${u.id}`)
    .map((u) => startRow(`u:${u.id}`, u.name, `${u.role === "mentor" ? "Mentor" : "Mentee"} · ${u.headline}`))
    .join("")}</div></div>
  <div><h3 style="font-size:1rem">Employers and partners</h3><div class="inbox">${orgs.results.map((o) => startRow(`o:${o.id}`, o.name, o.kind)).join("")}</div></div>
</div></div>`;
  return html(layout("Messages", body, "/messages"));
}

export async function threadPage(req: Request, env: Env, peerKey: string): Promise<Response> {
  const me = await currentIdent(req, env);
  const peer = await loadIdent(env, peerKey);
  if (!peer) return html(layout("Not found", `<div class="card"><h1>That person doesn't exist</h1><p><a href="/messages">Back to messages</a></p></div>`), 404);
  if (!me) return new Response(null, { status: 303, headers: { location: `/switch?next=${encodeURIComponent(`/messages/${peerKey}`)}` } });
  if (me.key === peer.key)
    return html(layout("Your profile", `<div class="card"><h1>This is you</h1><p>Open <a href="${esc(me.href)}">your profile</a> to edit it, or <a href="/switch">switch person</a> to message someone.</p></div>`), 400);
  const threadId = await threadFor(env, me, peer);
  const names: Record<string, string> = { [me.key]: me.name, [peer.key]: peer.name };
  const body = `
<p><a href="/messages">← All messages</a></p>
<div class="card">
  <div class="row" style="justify-content:space-between;gap:.6rem">
    <div class="row" style="gap:.8rem">
      <div class="pavatar">${esc(initials(peer.name))}</div>
      <div><h1 style="margin:0;font-size:1.4rem">${esc(peer.name)}</h1>
      <p class="muted" style="margin:.2rem 0 0">${esc(peer.role)}${peer.detail ? ` · ${esc(peer.detail)}` : ""}</p></div>
    </div>
    <a class="btn small ghost" href="${esc(peer.href)}">View profile</a>
  </div>
  <p class="muted" style="font-size:.82rem;margin:.8rem 0 .4rem">Sending as <b>${esc(me.name)}</b> · <a href="/switch?next=${encodeURIComponent(`/messages/${peerKey}`)}">switch</a></p>
  <div class="msgs" id="msgs" aria-live="polite"><p class="muted">Loading messages…</p></div>
  <form class="askrow" id="dmForm" style="margin-top:.6rem">
    <input class="chat-in" id="dmIn" maxlength="600" required placeholder="Write a message" aria-label="Message">
    <button class="btn" type="submit">Send</button>
  </form>
</div>
<script>
(function(){var box=document.getElementById('msgs'),form=document.getElementById('dmForm'),inp=document.getElementById('dmIn'),last=-1;
var names=${JSON.stringify(names)},me=${JSON.stringify(me.key)};
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function when(t){var d=new Date(t);return d.toLocaleDateString([], {month:'short',day:'numeric'})+' '+d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}
function draw(list){if(!list.length){box.innerHTML='<p class="muted">No messages yet. Say hi!</p>';return}
  box.innerHTML=list.map(function(m){var mine=m.sender_key===me;return '<div class="msg'+(mine?' mine':'')+'"><div class="bub">'+esc(m.body)+'</div><small>'+esc(names[m.sender_key]||'')+' · '+when(m.created_at)+'</small></div>'}).join('');box.scrollTop=box.scrollHeight}
var cache=[];function load(){fetch('/api/dm/${threadId}').then(function(r){return r.json()}).then(function(d){cache=d.messages||[];if(cache.length!==last){last=cache.length;draw(cache)}}).catch(function(){})}
form.onsubmit=function(e){e.preventDefault();var v=inp.value.trim();if(!v)return;inp.value='';
  fetch('/api/dm/${threadId}',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({body:v})}).then(function(r){return r.json()}).then(function(d){if(d.error){if(window.toast)toast(d.error);return}last=-1;load()}).catch(function(){if(window.toast)toast('Could not send. Try again.')})};
load();setInterval(load,4000);})();
</script>`;
  return html(layout(`Chat with ${peer.name}`, body, "/messages"));
}

export async function apiDm(req: Request, env: Env, threadId: number): Promise<Response> {
  const me = await currentIdent(req, env);
  if (!me) return Response.json({ error: "Choose who you are first." }, { status: 401 });
  const t = await env.DB.prepare(`SELECT id, a_key, b_key FROM dm_threads WHERE id = ?`).bind(threadId).first<{ id: number; a_key: string; b_key: string }>();
  if (!t) return Response.json({ error: "Conversation not found" }, { status: 404 });
  if (t.a_key !== me.key && t.b_key !== me.key) return Response.json({ error: "This conversation isn't yours." }, { status: 403 });
  if (req.method === "POST") {
    let b: { body?: unknown } = {};
    try {
      b = await req.json();
    } catch {
      return Response.json({ error: "Bad request" }, { status: 400 });
    }
    const text = typeof b.body === "string" ? b.body.trim().slice(0, 600) : "";
    if (!text) return Response.json({ error: "Write a message first." }, { status: 400 });
    await env.DB.prepare(`INSERT INTO dm_messages (thread_id, sender_key, body, created_at) VALUES (?, ?, ?, ?)`).bind(threadId, me.key, text, new Date().toISOString()).run();
  }
  const { results } = await env.DB.prepare(`SELECT id, sender_key, body, created_at FROM dm_messages WHERE thread_id = ? ORDER BY created_at ASC, id ASC LIMIT 200`).bind(threadId).all<{
    id: number;
    sender_key: string;
    body: string;
    created_at: string;
  }>();
  return Response.json({ messages: results });
}

// ---------------------------------------------------------------- Calendar
interface MeetingRow {
  id: number;
  pair_id: number;
  kind: string;
  starts_at: string;
  minutes: number;
  place: string;
  link: string;
  topic: string;
  mentor_id: number;
  mentee_id: number;
  mentor_name: string;
  mentee_name: string;
}
interface PairRow {
  id: number;
  mentor_id: number;
  mentee_id: number;
  mentor_name: string;
  mentee_name: string;
}
interface MetRow {
  met_at: string;
  pair_id: number;
  mentor_id: number;
  mentee_id: number;
  mentor_name: string;
  mentee_name: string;
}

const hm = (t: string) => {
  const m = t.match(/T(\d{2}):(\d{2})/);
  if (!m) return "";
  const h = +m[1];
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
};
/** Shorter, for phone-width calendar cells: 6 PM, 6:30 PM. */
const hmShort = (t: string) => {
  const m = t.match(/T(\d{2}):(\d{2})/);
  if (!m) return "";
  const h = +m[1];
  return `${h % 12 || 12}${m[2] === "00" ? "" : `:${m[2]}`} ${h < 12 ? "AM" : "PM"}`;
};

export async function calendarPage(req: Request, env: Env, url: URL): Promise<Response> {
  const me = await currentIdent(req, env);
  const nowAz = new Date(Date.now() - 7 * 3600e3);
  const thisMonth = `${nowAz.getUTCFullYear()}-${pad2(nowAz.getUTCMonth() + 1)}`;
  const today = nowAz.toISOString().slice(0, 10);
  const asked = url.searchParams.get("month") ?? "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(asked) ? asked : thisMonth;
  const y = +month.slice(0, 4);
  const mo = +month.slice(5, 7) - 1;
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, mo + n, 1));
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
  };
  const monthName = new Date(Date.UTC(y, mo, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const scope = me?.kind === "user" ? ` WHERE p.mentor_id = ? OR p.mentee_id = ?` : "";
  const meetBase = `SELECT m.*, p.mentor_id, p.mentee_id, mu.name AS mentor_name, eu.name AS mentee_name
    FROM meetings m JOIN pairs p ON p.id = m.pair_id
    JOIN users mu ON mu.id = p.mentor_id JOIN users eu ON eu.id = p.mentee_id${scope} ORDER BY m.starts_at`;
  const metBase = `SELECT c.met_at, p.id AS pair_id, p.mentor_id, p.mentee_id, mu.name AS mentor_name, eu.name AS mentee_name
    FROM checkins c JOIN pairs p ON p.id = c.pair_id
    JOIN users mu ON mu.id = p.mentor_id JOIN users eu ON eu.id = p.mentee_id${scope} ORDER BY c.met_at`;
  const bindScope = me?.kind === "user" ? [me.id, me.id] : [];
  const [meetings, mets, pairs] = await Promise.all([
    me?.kind === "user"
      ? env.DB.prepare(meetBase).bind(...bindScope).all<MeetingRow>()
      : env.DB.prepare(meetBase).all<MeetingRow>(),
    me?.kind === "user"
      ? env.DB.prepare(metBase).bind(...bindScope).all<MetRow>()
      : env.DB.prepare(metBase).all<MetRow>(),
    me?.kind === "user"
      ? env.DB
          .prepare(
            `SELECT p.id, p.mentor_id, p.mentee_id, mu.name AS mentor_name, eu.name AS mentee_name FROM pairs p
             JOIN users mu ON mu.id = p.mentor_id JOIN users eu ON eu.id = p.mentee_id
             WHERE p.active = 1 AND (p.mentor_id = ? OR p.mentee_id = ?) ORDER BY p.id`,
          )
          .bind(me.id, me.id)
          .all<PairRow>()
      : env.DB
          .prepare(
            `SELECT p.id, p.mentor_id, p.mentee_id, mu.name AS mentor_name, eu.name AS mentee_name FROM pairs p
             JOIN users mu ON mu.id = p.mentor_id JOIN users eu ON eu.id = p.mentee_id WHERE p.active = 1 ORDER BY p.id`,
          )
          .all<PairRow>(),
  ]);

  const who = (m: { mentor_id: number; mentee_id: number; mentor_name: string; mentee_name: string }) =>
    me?.kind === "user" && me.id === m.mentor_id ? m.mentee_name.split(" ")[0] : me?.kind === "user" && me.id === m.mentee_id ? m.mentor_name.split(" ")[0] : `${m.mentor_name.split(" ")[0]} + ${m.mentee_name.split(" ")[0]}`;

  const inMonth = meetings.results.filter((m) => m.starts_at.slice(0, 7) === month);
  const upNext = meetings.results.filter((m) => m.starts_at.slice(0, 10) >= today).slice(0, 5);
  const days = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(y, mo, 1)).getUTCDay();
  const cells = Math.ceil((firstDow + days) / 7) * 7;
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    .map((d) => `<div class="dow">${d}</div>`)
    .join("");
  let grid = "";
  for (let i = 0; i < cells; i++) {
    const num = i - firstDow + 1;
    const on = num >= 1 && num <= days;
    const date = on ? `${month}-${pad2(num)}` : "";
    const evs = on ? inMonth.filter((m) => m.starts_at.slice(0, 10) === date) : [];
    const met = on ? mets.results.filter((c) => azDate(c.met_at) === date) : [];
    grid += `<div class="day${on ? "" : " off"}${date === today ? " today" : ""}">${on ? `<span class="num">${num}</span>` : ""}
    ${evs
      .map(
        (m) =>
          `<a class="evt${m.kind === "In-person" ? " p" : ""}" href="/pair/${m.pair_id}#meetings" title="${esc(`${m.kind} · ${hm(m.starts_at)} · ${m.mentor_name} + ${m.mentee_name}${m.topic ? ` · ${m.topic}` : ""}`)}"><span class="evt-t">${esc(hm(m.starts_at))}</span><span class="evt-c">${esc(hmShort(m.starts_at))}</span><span class="evn"> ${esc(who(m))}</span></a>`,
      )
      .join("")}
    ${met.map((c) => `<span class="met" title="${esc(`${c.mentor_name} + ${c.mentee_name} met`)}">✓<span class="metn"> met ${esc(who(c))}</span></span>`).join("")}
  </div>`;
  }

  const pairSelect = pairs.results
    .map((p) => `<option value="${p.id}"${url.searchParams.get("pair") === String(p.id) ? " selected" : ""}>${esc(p.mentor_name)} + ${esc(p.mentee_name)}</option>`)
    .join("");
  const schedule =
    me?.kind === "org"
      ? `<div class="card" style="margin-top:1rem"><h2 style="font-size:1.2rem;margin-top:0">Scheduling</h2><p class="muted">You're browsing as an organization, so this calendar shows every mentorship meeting. <a href="/switch">Switch to a mentor or mentee</a> to book one.</p><a class="btn ghost" href="/messages">Message students</a></div>`
      : `<div class="card" style="margin-top:1rem" id="schedule"><h2 style="font-size:1.2rem;margin-top:0">Schedule a meeting</h2>
  ${
    pairs.results.length
      ? `<p class="muted" style="margin:.2rem 0 .6rem;font-size:.9rem">${me ? `Book time with your ${me.role === "Mentor" ? "mentee" : "mentor"}.` : "Pick who you are first — this demo will book for whichever pair you choose."} Either person can add it to Google, Apple or Outlook calendar from the pair page.</p>
  <form method="post" action="/calendar" class="mtg-form">
    <label for="cal-pair">Pair</label><select id="cal-pair" name="pair">${pairSelect}</select>
    <div class="seg" role="radiogroup" aria-label="Meeting type" style="margin-top:.6rem"><label><input type="radio" name="kind" value="Virtual" checked> Virtual (Zoom, Meet)</label><label><input type="radio" name="kind" value="In-person"> In person</label></div>
    <div class="two">
      <div><label for="cal-when">Date and time (Arizona)</label><input id="cal-when" name="starts_at" type="datetime-local" required value="${esc(url.searchParams.get("at") ?? "")}"></div>
      <div><label for="cal-min">Length</label><select id="cal-min" name="minutes">${options(["20", "30", "45", "60"], "30")}</select></div>
      <div><label for="cal-link">Video link (virtual)</label><input id="cal-link" name="link" type="url" maxlength="300" placeholder="https://zoom.us/j/..."></div>
      <div><label for="cal-place">Where (in person, public place)</label><input id="cal-place" name="place" maxlength="160" placeholder="e.g. Burton Barr Library, Phoenix"></div>
    </div>
    <label for="cal-topic">Topic (optional)</label><input id="cal-topic" name="topic" maxlength="120" placeholder="e.g. Portfolio review">
    <button class="btn" type="submit" style="margin-top:.8rem">Schedule and add to calendar</button>
  </form>`
      : `<p class="muted">${me ? "You don't have a mentor pair yet. Choose a mentor on your matches page and the calendar opens up." : "No pairs yet."}</p>${me?.kind === "user" ? `<a class="btn ghost" href="${me.role === "Mentor" ? `/profile/${me.id}` : `/matches/${me.id}`}">${me.role === "Mentor" ? "Find mentees" : "Find a mentor"}</a>` : ""}`
  }</div>`;

  const body = `
<div class="banner"><div class="row" style="justify-content:space-between;position:relative;z-index:1"><div><h1 style="margin:0">Calendar</h1>
<p style="margin:.3rem 0 0">${me ? `Signed in as ${esc(me.name)}.` : "Showing every meeting in the program."} Meetings you schedule land in Google, Apple or Outlook with one click.</p></div>
<a class="btn light" href="/switch">${me ? "Switch person" : "Choose who you are"}</a></div></div>
${url.searchParams.get("scheduled") ? `<div class="notice">Meeting scheduled. It's on the calendar and ready for either of you to add to your own.</div>` : ""}
${url.searchParams.get("bad") ? `<div class="notice" role="alert">Pick a pair, a date and a time to schedule.</div>` : ""}
<div class="row" style="justify-content:space-between;margin-bottom:.6rem">
  <div class="row"><a class="btn small ghost" href="/calendar?month=${shift(-1)}">← ${new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}</a>
  <h2 style="margin:0;font-size:1.35rem">${monthName}</h2>
  <a class="btn small ghost" href="/calendar?month=${shift(1)}">${new Date(Date.UTC(y, mo + 1, 1)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })} →</a></div>
  <a class="btn small ghost" href="/calendar">Today</a>
</div>
<div class="card"><div class="cal">${dow}${grid}</div>
<p class="muted" style="font-size:.8rem;margin:.7rem 0 0"><span class="chip">Virtual</span><span class="chip sage">In person</span> ✓ met = a logged meeting that fed the flame · times are Arizona (UTC-7)</p></div>
<div class="cal-bottom" style="margin-top:1rem">
  <div class="card"><h2 style="font-size:1.2rem;margin-top:0">Up next</h2>${
    upNext.length
      ? `<div class="upnext">${upNext
          .map(
            (m) => `<div class="upitem"><div class="row" style="justify-content:space-between;gap:.4rem"><span class="chip ${m.kind === "Virtual" ? "plum" : "sage"}">${m.kind === "Virtual" ? "Virtual" : "In person"}</span><span class="muted" style="font-size:.82rem">${m.minutes} min</span></div>
        <b>${esc(new Date(`${m.starts_at}:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }))} · ${esc(hm(m.starts_at))}</b>
        <span style="font-size:.92rem">${esc(m.mentor_name)} + ${esc(m.mentee_name)}${m.topic ? ` · ${esc(m.topic)}` : ""}</span>
        <span class="muted" style="font-size:.85rem">${m.kind === "Virtual" ? (m.link ? `<a href="${esc(m.link)}" target="_blank" rel="noopener">Join video call</a>` : "Video link to come") : esc(m.place || "Place to be decided")}</span>
        <div class="row"><a class="btn small ghost" href="/pair/${m.pair_id}/meetings/${m.id}.ics">Add to calendar</a><a class="btn small ghost" href="/pair/${m.pair_id}#meetings">Pair page</a></div></div>`,
          )
          .join("")}</div>`
      : `<p class="muted">Nothing scheduled yet. Book the first one on the right.</p>`
  }</div>
  ${schedule}
</div>`;
  return html(layout("Calendar", body, "/calendar"));
}

/** POST /calendar — books a meeting for any pair the form names. */
export async function calendarSchedule(req: Request, env: Env): Promise<Response> {
  const f = await req.formData();
  const s = (k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);
  const pairId = parseInt(s("pair", 10), 10) || 0;
  const when = s("starts_at", 16);
  const pair = pairId ? await env.DB.prepare(`SELECT id FROM pairs WHERE id = ?`).bind(pairId).first<{ id: number }>() : null;
  if (!pair) return new Response(null, { status: 303, headers: { location: "/calendar?bad=1" } });
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when)) return new Response(null, { status: 303, headers: { location: `/calendar?bad=1#schedule` } });
  const link = s("link", 300);
  const minutes = [20, 30, 45, 60].includes(parseInt(s("minutes", 3), 10)) ? parseInt(s("minutes", 3), 10) : 30;
  await addMeeting(env, pair.id, {
    kind: s("kind", 20) === "In-person" ? "In-person" : "Virtual",
    when,
    minutes,
    link: /^https?:\/\//.test(link) ? link : "",
    place: s("place", 160),
    topic: s("topic", 120),
  });
  return new Response(null, { status: 303, headers: { location: `/calendar?month=${when.slice(0, 7)}&scheduled=1#schedule` } });
}

// ---------------------------------------------------------------- Demo conversations
export function dmSeed(db: D1Database): D1PreparedStatement[] {
  const now = Date.now();
  const at = (minsAgo: number) => new Date(now - minsAgo * 60e3).toISOString();
  // [thread id, a_key, b_key, messages as (sender key, body, minutes ago)]
  const threads: [number, string, string, [string, string, number][]][] = [
    [
      1,
      "u:1",
      "u:9",
      [
        ["u:1", "Hi Maya! I saw your portfolio is coming together. Want to review the case study before Thursday?", 190],
        ["u:9", "Yes please. I'm stuck on the research section and I don't know how much detail to include.", 175],
        ["u:1", "Bring one question and the rough version. We'll fix one thing at a time — that's how portfolio reviews work best.", 160],
      ],
    ],
    [
      2,
      "o:1",
      "u:9",
      [
        ["u:9", "Hi! I'm applying for the UX Design Intern role. Does the portfolio need to be all case studies?", 95],
        ["o:1", "Hi Maya — one solid case study is plenty. Our design lead reads every application herself, so show the thinking, not just the screens.", 80],
      ],
    ],
    [
      3,
      "u:19",
      "u:21",
      [
        ["u:19", "Hannah, your design systems course is the reason I moved from print into UX. Any advice for a first interview?", 45],
        ["u:21", "That means a lot. Bring one project and talk about the tradeoffs you chose — interviewers remember the why, not the pixels.", 30],
      ],
    ],
  ];
  const insThread = db.prepare(`INSERT OR IGNORE INTO dm_threads (id, a_key, b_key, created_at) VALUES (?, ?, ?, ?)`);
  const insMsg = db.prepare(`INSERT INTO dm_messages (thread_id, sender_key, body, created_at) VALUES (?, ?, ?, ?)`);
  return threads.flatMap(([id, a, b, msgs]) => [
    insThread.bind(id, a, b, at(240)),
    ...msgs.map(([sender, body, mins]) => insMsg.bind(id, sender, body, at(mins))),
  ]);
}

export const INBOX_CSS = `
.me-chip{white-space:nowrap}
.me-chip.on{background:rgba(255,255,255,.14);border-radius:999px;padding:.3rem .7rem!important;opacity:1!important}
.who{display:grid;gap:.6rem;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
.inbox{display:flex;flex-direction:column;gap:.5rem}
.dm{display:grid;grid-template-columns:42px 1fr auto;gap:.7rem;align-items:center;padding:.6rem .7rem;border:1px solid var(--line);border-radius:14px;text-decoration:none;color:inherit;background:var(--card);transition:transform .18s ease,border-color .18s}
a.dm:hover{border-color:#d6c6b5;transform:translateY(-2px)}
button.dm{cursor:pointer;background:var(--card);font:inherit;color:inherit}
button.dm:hover{border-color:var(--ember)}
.dm .tbody{min-width:0}
.dm .tname{display:block;font-weight:700;line-height:1.25}
.dm .tlast{display:block;color:var(--muted);font-size:.86rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm time{color:var(--muted);font-size:.78rem;white-space:nowrap}
.cal-bottom{display:grid;grid-template-columns:1fr 1fr;gap:1rem;align-items:start}
.upnext{display:flex;flex-direction:column;gap:.6rem}
.upitem{display:flex;flex-direction:column;gap:.25rem;border:1px solid var(--line);border-radius:14px;padding:.7rem .8rem}
.upitem b{font-family:"Space Grotesk",system-ui,sans-serif}
.cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:.4rem}
.cal .dow{font:700 .72rem system-ui;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-align:center;padding-bottom:.2rem}
.cal .day{min-height:104px;border:1px solid var(--line);border-radius:10px;padding:.3rem;background:var(--surface,#fff);display:flex;flex-direction:column;gap:2px;overflow:hidden}
.cal .day.off{opacity:.35;border-style:dashed}
.cal .day.today{border-color:var(--ember);box-shadow:inset 0 0 0 1px var(--ember)}
.cal .day .num{font:700 .78rem system-ui;color:var(--muted)}
.cal .day.today .num{color:var(--ember)}
.evt{display:block;font:600 .72rem system-ui;line-height:1.2;border-radius:6px;padding:.2rem .3rem;background:#fff3e6;color:#8a3d12;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.evt.p{background:#e8f4ec;color:#2d6a42}
.met{font:600 .68rem system-ui;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.evn{font-weight:500}
.evt-c{display:none}
html[data-theme=dark] .cal .day{background:#221a2c}
html[data-theme=dark] .evt{background:#3a2416;color:#ffc79a}
html[data-theme=dark] .evt.p{background:#1d3226;color:#a8e3bd}
@media (max-width:900px){.cal-bottom{grid-template-columns:1fr}.brand{font-size:1.15rem}nav{gap:.7rem}nav a span.l{display:none}nav a span.s{display:inline}}
@media (max-width:700px){.cal{gap:.25rem}.cal .day{min-height:70px;padding:.2rem}.evt{font-size:.6rem;padding:.1rem .2rem}.met{font-size:.7rem}.evn,.metn{display:none}.evt-t{display:none}.evt-c{display:inline}.dm{grid-template-columns:36px 1fr}.dm time{display:none}}
@media (max-width:480px){nav{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}nav::-webkit-scrollbar{display:none}}
`;
