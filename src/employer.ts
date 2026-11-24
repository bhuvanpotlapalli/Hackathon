// Employer (employee) accounts: a company contact who signs in to manage their organization's
// profile, postings and prep courses, and to see which students fit them.
import type { Env, Me } from "./auth";
import { appUrl, mail, mailConfigured, mailEnabled, menteePeople, sendMails } from "./email";
import { ALL_PATHS, AREAS, FORMATS, OPP_KINDS, normCareer, oppScore, type Opportunity, type User } from "./logic";
import { ORG_KINDS } from "./social";
import { esc, html, layout, options } from "./ui";

export interface Org {
  id: number;
  name: string;
  kind: string;
  about: string;
  website: string;
  area: string;
}

const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);

export async function orgFor(env: Env, orgId: number | null): Promise<Org | null> {
  if (!orgId) return null;
  return env.DB.prepare(`SELECT id, name, kind, about, website, area FROM orgs WHERE id = ?`).bind(orgId).first<Org>();
}

/** `/employer` and an employer's `/home`: their org, postings, courses and fitting students. */
export async function dashboard(env: Env, user: Me, url: URL): Promise<Response> {
  const org = await orgFor(env, user.orgId);
  if (!org) {
    return html(
      layout(
        "Employer",
        `<div class="card"><h1>No organization linked</h1><p class="muted">Your account is not linked to an organization yet. Ask the program team to fix that.</p></div>`,
        "/employer",
      ),
      500,
    );
  }
  const [postings, courses, mentees] = await Promise.all([
    env.DB.prepare(`SELECT * FROM opportunities WHERE account_id = ? ORDER BY created_at DESC`).bind(user.accountId).all<Opportunity>(),
    env.DB.prepare(`SELECT id, title, career, level, format FROM courses WHERE account_id = ? ORDER BY created_at DESC`)
      .bind(user.accountId)
      .all<{ id: number; title: string; career: string; level: string; format: string }>(),
    env.DB.prepare(`SELECT * FROM users WHERE role = 'mentee' ORDER BY name LIMIT 300`).all<User>(),
  ]);
  const mailOn = mailEnabled(env);

  const postingCards = postings.results
    .map((p) => {
      const fits = mentees.results
        .map((m) => ({ m, fit: oppScore(m, p) }))
        .filter((x) => x.fit.score >= 40)
        .sort((a, b) => b.fit.score - a.fit.score)
        .slice(0, 5);
      return `<div class="card" style="margin-bottom:.8rem">
  <div class="row" style="justify-content:space-between;align-items:flex-start;gap:.8rem">
    <div><span class="chip">${esc(p.kind)}</span> <a href="/opportunities/${p.id}"><b>${esc(p.title)}</b></a>
      <p class="muted" style="margin:.3rem 0 0">${esc(p.career)} · ${esc(p.area)} · ${esc(p.format)}${p.deadline ? ` · apply by ${esc(p.deadline)}` : ""}</p></div>
    <form method="post" action="/employer/postings/${p.id}/delete" onsubmit="return confirm('Delete this posting? Students will no longer see it.')"><button class="btn small ghost" type="submit">Delete</button></form>
  </div>
  <p class="muted" style="margin:.6rem 0 .2rem;font-size:.9rem">Students who fit: ${
        fits.length
          ? fits.map((f) => `<a href="/profile/${f.m.id}">${esc(f.m.name)}</a> (${f.fit.score}%)`).join(", ")
          : "none yet — it may take a few sign-ups."
      }</p>
  ${fits.length ? `<p class="muted" style="margin:.2rem 0 0;font-size:.85rem">Reach out from <a href="/messages">Messages</a>; conversations stay private to the two of you.</p>` : ""}
</div>`;
    })
    .join("");

  const body = `
<div class="banner"><h1>${esc(org.name)}</h1><p>Post roles and prep courses, and see who fits. Signed in as ${esc(user.name)} (${esc(user.email)}).</p>
<div class="row" style="position:relative;z-index:1;margin-top:.6rem"><a class="btn light" href="/employer/postings/new">Post a role</a><a class="btn ghost onDark" href="/employer/org">Edit organization</a><a class="btn ghost onDark" href="/courses/new">Add a prep course</a></div></div>
${url.searchParams.get("posted") ? `<div class="notice">Posting published${url.searchParams.get("notified") ? " and students on that path were emailed" : ""}.</div>` : ""}
${url.searchParams.get("deleted") ? `<div class="notice">Posting deleted.</div>` : ""}
${url.searchParams.get("saved") ? `<div class="notice">Organization updated.</div>` : ""}
${!mailOn ? `<div class="notice" role="alert">Email is not set up yet, so students are not told about new postings. The program team can turn notifications on.</div>` : ""}
<h2 style="font-size:1.2rem">Your postings (${postings.results.length})</h2>
${postingCards || `<div class="card"><p class="muted">No postings yet. <a href="/employer/postings/new">Post the first one</a>.</p></div>`}
<h2 style="font-size:1.2rem;margin-top:1.4rem">Your courses (${courses.results.length})</h2>
<div class="grid">${
    courses.results
      .map(
        (c) =>
          `<a class="card" href="/courses/${c.id}"><h3 style="margin:0 0 .3rem;font-size:1.05rem">${esc(c.title)}</h3><p class="muted" style="margin:0;font-size:.9rem">${esc(c.career)} · ${esc(c.level)} · ${esc(c.format)}</p></a>`,
      )
      .join("") || `<div class="card"><p class="muted">No prep courses yet. <a href="/courses/new">Add one</a>.</p></div>`
  }</div>`;
  return html(layout(`${org.name} · Employer`, body, "/employer"));
}

export function postingForm(org: Org, error = "", form: Record<string, string> = {}): Response {
  const v = (k: string, d = "") => esc(form[k] ?? d);
  const body = `
<div class="banner"><h1>Post a role</h1><p>Posting as <b>${esc(org.name)}</b>. Students on the matching path see it with their fit score.</p></div>
${error ? `<div class="notice" role="alert" style="background:#fdecea;border-color:#f5c2bd;color:#7a1f16">${esc(error)}</div>` : ""}
<form method="post" action="/employer/postings" class="card">
  <div class="two">
    <div><label for="title">Role title</label><input id="title" name="title" required maxlength="120" value="${v("title")}" placeholder="e.g. UX Design Intern"></div>
    <div><label for="kind">Type</label><select id="kind" name="kind">${options(OPP_KINDS, form.kind ?? OPP_KINDS[0])}</select></div>
    <div><label for="career">Path</label><select id="career" name="career">${options(ALL_PATHS, form.career ?? ALL_PATHS[0])}</select></div>
    <div><label for="area">Area</label><select id="area" name="area">${options(AREAS, form.area ?? (org.area || AREAS[0]))}</select></div>
    <div><label for="format">Format</label><select id="format" name="format">${options(FORMATS, form.format ?? FORMATS[0])}</select></div>
    <div><label for="deadline">Apply by (optional)</label><input id="deadline" name="deadline" type="date" value="${v("deadline")}"></div>
  </div>
  <label for="courses">Coursework you want (optional)</label><input id="courses" name="courses" maxlength="400" value="${v("courses")}" placeholder="e.g. Intro to UX Design, User Research">
  <label for="description">What the student would do</label><textarea id="description" name="description" rows="4" maxlength="500">${v("description")}</textarea>
  <label for="link">Application link (optional)</label><input id="link" name="link" maxlength="300" value="${v("link")}" placeholder="https://">
  <button class="btn" type="submit" style="margin-top:1rem">Publish posting</button>
</form>`;
  return html(layout("Post a role", body, "/employer"));
}

export async function postingSubmit(req: Request, env: Env, user: Me): Promise<Response> {
  const org = await orgFor(env, user.orgId);
  if (!org) return new Response(null, { status: 303, headers: { location: "/employer" } });
  const f = await req.formData();
  const title = str(f, "title", 120);
  const form = {
    title,
    kind: str(f, "kind", 30),
    career: str(f, "career", 60),
    area: str(f, "area", 40),
    format: str(f, "format", 20),
    deadline: str(f, "deadline", 10),
    courses: str(f, "courses", 400),
    description: str(f, "description", 500),
    link: str(f, "link", 300),
  };
  if (!title) return postingForm(org, "Add a role title.", form);
  const career = normCareer(form.career);
  const link = form.link;
  const row = await env.DB.prepare(
    `INSERT INTO opportunities (kind, title, org, career, courses, area, format, description, link, deadline, account_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(
      OPP_KINDS.includes(form.kind) ? form.kind : OPP_KINDS[0],
      title,
      org.name,
      career,
      form.courses,
      AREAS.includes(form.area) ? form.area : org.area || AREAS[0],
      FORMATS.includes(form.format) ? form.format : FORMATS[0],
      form.description,
      /^https?:\/\//.test(link) ? link : "",
      /^\d{4}-\d{2}-\d{2}$/.test(form.deadline) ? form.deadline : "",
      user.accountId,
      new Date().toISOString(),
    )
    .first<{ id: number }>();
  const id = row!.id;
  // Best effort: students on this path hear about it, and a mail problem never blocks posting.
  const people = await menteePeople(env, career);
  await sendMails(env, people.map((p) => mail.opportunity(p.email, p.name, title, org.name, appUrl(env, `/opportunities/${id}`))));
  const notified = people.length > 0 && mailConfigured(env);
  return new Response(null, { status: 303, headers: { location: `/employer?posted=1${notified ? "&notified=1" : ""}` } });
}

export async function postingDelete(env: Env, user: Me, id: number): Promise<Response> {
  await env.DB.batch([
    env.DB.prepare(`UPDATE courses SET opp_id = NULL WHERE opp_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM opportunities WHERE id = ? AND account_id = ?`).bind(id, user.accountId),
  ]);
  return new Response(null, { status: 303, headers: { location: "/employer?deleted=1" } });
}

export function orgForm(org: Org, error = ""): Response {
  const body = `
<div class="banner"><h1>Organization</h1><p>Students see this on your postings and on the organizations page.</p></div>
${error ? `<div class="notice" role="alert" style="background:#fdecea;border-color:#f5c2bd;color:#7a1f16">${esc(error)}</div>` : ""}
<form method="post" action="/employer/org" class="card">
  <label for="name">Organization name</label><input id="name" name="name" required maxlength="120" value="${esc(org.name)}">
  <div class="two">
    <div><label for="kind">Type</label><select id="kind" name="kind">${options(ORG_KINDS, org.kind)}</select></div>
    <div><label for="area">Area</label><select id="area" name="area">${options(AREAS, org.area || AREAS[0])}</select></div>
  </div>
  <label for="about">About</label><textarea id="about" name="about" rows="4" maxlength="500" required>${esc(org.about)}</textarea>
  <label for="website">Website</label><input id="website" name="website" maxlength="300" value="${esc(org.website)}" placeholder="https://">
  <button class="btn" type="submit" style="margin-top:1rem">Save organization</button>
</form>`;
  return html(layout("Organization", body, "/employer"));
}

export async function orgSubmit(req: Request, env: Env, user: Me): Promise<Response> {
  const org = await orgFor(env, user.orgId);
  if (!org) return new Response(null, { status: 303, headers: { location: "/employer" } });
  const f = await req.formData();
  const name = str(f, "name", 120);
  const about = str(f, "about", 500);
  if (!name || !about) return orgForm(org, "Add a name and a short about.");
  const clash = await env.DB.prepare(`SELECT id FROM orgs WHERE name = ? AND id <> ?`).bind(name, org.id).first<{ id: number }>();
  if (clash) return orgForm(org, "Another organization already uses that name.");
  const site = str(f, "website", 300);
  const kind = str(f, "kind", 40);
  const area = str(f, "area", 40);
  await env.DB.batch([
    env.DB.prepare(`UPDATE orgs SET name = ?, kind = ?, about = ?, website = ?, area = ? WHERE id = ?`)
      .bind(name, ORG_KINDS.includes(kind) ? kind : "Company", about, /^https?:\/\//.test(site) ? site : "", AREAS.includes(area) ? area : "", org.id),
    // Keep the org name on their postings and courses in step.
    env.DB.prepare(`UPDATE opportunities SET org = ? WHERE account_id = ?`).bind(name, user.accountId),
    env.DB.prepare(`UPDATE courses SET author = ? WHERE account_id = ?`).bind(name, user.accountId),
  ]);
  return new Response(null, { status: 303, headers: { location: "/employer?saved=1" } });
}
