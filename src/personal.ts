// Personalized courses: a mentor picks a mentee and ember (Workers AI) builds a short course
// tailored to that mentee's path, classes and goal, using courses from the library where they fit.
import { ask } from "./ai";
import type { Me } from "./auth";
import { libraryFor, sharedCourses, starterMilestones, type User } from "./logic";
import { esc, html, layout } from "./ui";

interface Env {
  DB: D1Database;
  AI?: Ai;
}

export interface Module {
  title: string;
  why: string;
  steps: string[];
}

interface PersonalRow {
  id: number;
  mentor_id: number;
  mentee_id: number;
  title: string;
  summary: string;
  modules: string; // JSON Module[]
  ai: number;
  demo: number;
  created_at: string;
  mentor_name?: string;
  mentee_name?: string;
}

export const PERSONAL_SCHEMA = `CREATE TABLE IF NOT EXISTS personal_courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mentor_id INTEGER NOT NULL,
  mentee_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  modules TEXT NOT NULL DEFAULT '[]',
  ai INTEGER NOT NULL DEFAULT 0,
  demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
)`;

const first = (n: string) => n.split(" ")[0];

/** Template course, used for demo data and whenever the AI is unavailable. */
export function templateCourse(mentee: User, mentor: User, focus: string): { title: string; summary: string; modules: Module[] } {
  const lib = libraryFor(mentee.career);
  const taken = new Set(sharedCourses(lib.join(", "), mentee.courses));
  const next = lib.filter((c) => !taken.has(c)).slice(0, 2);
  const ms = starterMilestones(mentee.career, mentee.goal);
  const shared = sharedCourses(mentee.courses, mentor.courses);
  const goal = focus || mentee.goal;
  const modules: Module[] = [
    {
      title: shared.length ? `Get more out of ${shared[0]}` : `Map your path in ${mentee.career}`,
      why: shared.length ? `${first(mentor.name)} took this class too and knows where people get stuck.` : `Start from where you are, with someone who has done it.`,
      steps: ["List the 3 topics that feel hardest right now", `Walk through one of them with ${first(mentor.name)}`, "Write a one-paragraph summary in your own words"],
    },
    {
      title: next[0] ? `Next class: ${next[0]}` : "Fill your biggest skill gap",
      why: `It's the next step most ${mentee.career} roles expect after what you've taken.`,
      steps: [next[0] ? `Find a free or low-cost ${next[0]} course in the Courses tab` : "Pick one skill from a job posting you like", "Block 3 hours a week for it", "Bring one question to your next meeting"],
    },
    {
      title: `Build: ${ms[1] ?? ms[0]}`,
      why: "Employers hire from proof, not from certificates alone.",
      steps: [ms[0], ms[1] ?? "Ship a small project", `Get feedback from ${first(mentor.name)} and revise once`],
    },
    {
      title: "Show it and apply",
      why: `Turns the work into your goal: ${goal.slice(0, 80)}.`,
      steps: ["Add the project to your portfolio or GitHub", "Find 2 matching postings on the Opportunities tab", ms[2] ?? "Do one mock interview"],
    },
  ];
  return {
    title: `${first(mentee.name)}'s ${mentee.career} launch plan`,
    summary: `A 4-step plan built from ${first(mentee.name)}'s classes and goal, with ${first(mentor.name)} as guide.`,
    modules,
  };
}

/** ember writes the course; falls back to the template. */
async function buildCourse(env: Env, mentee: User, mentor: User, focus: string) {
  const t = await ask(
    env,
    "You are ember, TechWomenAZ's AI course builder. Build a short personalized course for one mentee. Use ONLY facts given. Reply in exactly this format and nothing else:\nTITLE: <max 8 words>\nSUMMARY: <one sentence, max 25 words>\nMODULE: <title, max 7 words> | <why it matters for this mentee, max 15 words> | <step>; <step>; <step>\n(exactly 4 MODULE lines, steps are short concrete actions)",
    `Mentee: ${mentee.name}, path ${mentee.career}, background: ${mentee.headline}. Classes taken: ${mentee.courses || "none yet"}. Goal: ${mentee.goal}.
Mentor: ${mentor.name}, ${mentor.headline}. Classes the mentor took: ${mentor.courses}.
Recommended next classes for this path: ${libraryFor(mentee.career).join(", ")}.
${focus ? `Mentor wants to focus on: ${focus}` : ""}`,
    420,
  );
  if (t) {
    const title = t.match(/TITLE:\s*(.+)/i)?.[1]?.trim();
    const summary = t.match(/SUMMARY:\s*(.+)/i)?.[1]?.trim() ?? "";
    const modules = [...t.matchAll(/MODULE:\s*(.+)/gi)]
      .map((m) => m[1].split("|").map((s) => s.trim().replace(/\*+/g, "")))
      .filter((p) => p.length >= 3 && p[0])
      .map((p) => ({ title: p[0].slice(0, 80), why: p[1].slice(0, 160), steps: p.slice(2).join(";").split(";").map((s) => s.trim()).filter(Boolean).slice(0, 4) }))
      .slice(0, 5);
    if (title && modules.length >= 3) return { title: title.replace(/\*+/g, "").slice(0, 90), summary: summary.replace(/\*+/g, "").slice(0, 220), modules, ai: true };
  }
  return { ...templateCourse(mentee, mentor, focus), ai: false };
}

async function getUser(db: D1Database, id: number) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first<User>();
}

export function coursesTabs(active: "library" | "personal"): string {
  return `<div class="ctabs" role="tablist"><a role="tab" class="${active === "library" ? "on" : ""}" href="/courses">Course library</a><a role="tab" class="${active === "personal" ? "on" : ""}" href="/courses/personal">Personalized by ember</a></div>`;
}

// ---------------------------------------------------------------- /courses/personal
export async function personalPage(env: Env, url: URL, user: Me): Promise<Response> {
  const admin = user.admin;
  // Members only ever see plans they are part of; admins see the whole program.
  const listSql = `SELECT pc.*, m.name AS mentor_name, e.name AS mentee_name FROM personal_courses pc JOIN users m ON m.id = pc.mentor_id JOIN users e ON e.id = pc.mentee_id${admin ? "" : " WHERE pc.mentor_id = ? OR pc.mentee_id = ?"} ORDER BY pc.created_at DESC`;
  const listStmt = admin ? env.DB.prepare(listSql) : env.DB.prepare(listSql).bind(user.userId, user.userId);
  const mentorSql = `SELECT id, name, career FROM users WHERE role = 'mentor'${admin ? "" : " AND id = ?"} ORDER BY name`;
  const mentorStmt = admin ? env.DB.prepare(mentorSql) : env.DB.prepare(mentorSql).bind(user.userId);
  const menteeSql = `SELECT DISTINCT u.id, u.name, u.career FROM users u JOIN pairs p ON p.mentee_id = u.id WHERE p.active = 1${admin ? "" : " AND p.mentor_id = ?"} ORDER BY u.name`;
  const menteeStmt = admin ? env.DB.prepare(menteeSql) : env.DB.prepare(menteeSql).bind(user.userId);
  const [rows, mentors, mentees] = await Promise.all([
    listStmt.all<PersonalRow>(),
    mentorStmt.all<{ id: number; name: string; career: string }>(),
    menteeStmt.all<{ id: number; name: string; career: string }>(),
  ]);
  const canBuild = mentors.results.length > 0 && mentees.results.length > 0;
  const selMentor = parseInt(url.searchParams.get("mentor") ?? "", 10) || 0;
  const selMentee = parseInt(url.searchParams.get("mentee") ?? "", 10) || 0;
  const opt = (list: { id: number; name: string; career: string }[], sel: number) =>
    list.map((u) => `<option value="${u.id}"${u.id === sel ? " selected" : ""}>${esc(u.name)} · ${esc(u.career)}</option>`).join("");
  const body = `
<div class="banner"><h1>Courses</h1><p>Shared by mentors and employers, or built by ember for one person.</p></div>
${coursesTabs("personal")}
${canBuild ? `<form method="post" action="/courses/personal" class="card build" id="buildForm">
  <h2 style="font-size:1.25rem;margin:0 0 .3rem">Build a course for your mentee</h2>
  <p class="muted" style="margin:0 0 .8rem;font-size:.92rem">ember reads their classes and goal, then writes a 4-step course with you as the guide.</p>
  <div class="two">
    <div><label for="mentor">You (mentor)</label><select id="mentor" name="mentor" required>${opt(mentors.results, selMentor)}</select></div>
    <div><label for="mentee">Your mentee</label><select id="mentee" name="mentee" required>${opt(mentees.results, selMentee)}</select></div>
  </div>
  <label for="focus">Anything to focus on? (optional)</label>
  <input id="focus" name="focus" maxlength="160" placeholder="e.g. interview nerves, first portfolio piece">
  <button class="btn" type="submit" style="margin-top:1rem" id="buildBtn">Build with ember</button>
</form>` : `<div class="card"><h2 style="font-size:1.25rem;margin:0 0 .3rem">Build a course for your mentee</h2><p class="muted" style="margin:0">${admin ? "Add a mentor and a mentee first — see Accounts." : "Once a mentee chooses you, you can build a course with them here."}</p></div>`}
<h2 style="font-size:1.2rem;margin:1.6rem 0 .6rem">Personalized courses (${rows.results.length})</h2>
<div class="grid">${
    rows.results
      .map((r) => {
        const mods = JSON.parse(r.modules || "[]") as Module[];
        return `<a class="card pcourse" href="/courses/personal/${r.id}">
  <div class="row" style="justify-content:space-between"><span class="chip plum">For ${esc(first(r.mentee_name ?? ""))}</span>${r.ai ? `<span class="chip sage">by ember</span>` : ""}</div>
  <h3 style="margin:.5rem 0 .2rem;font-size:1.1rem">${esc(r.title)}</h3>
  <p class="muted" style="margin:0 0 .6rem;font-size:.9rem">Guide: ${esc(r.mentor_name ?? "")} · ${mods.length} steps</p>
  <ol class="mini">${mods.map((m) => `<li>${esc(m.title)}</li>`).join("")}</ol>
</a>`;
      })
      .join("") || `<div class="card">No personalized courses yet. Build the first one above.</div>`
  }</div>
${canBuild ? `<script>document.getElementById('buildForm').addEventListener('submit',function(){var b=document.getElementById('buildBtn');b.disabled=true;b.textContent='ember is building the course…';b.classList.add('working')});</script>` : ""}`;
  return html(layout("Personalized courses", body, "/courses"));
}

export async function personalSubmit(req: Request, env: Env, user: Me): Promise<Response> {
  const f = await req.formData();
  const admin = user.admin;
  const mentor = await getUser(env.DB, admin ? parseInt(String(f.get("mentor") ?? ""), 10) || 0 : user.userId);
  const mentee = await getUser(env.DB, parseInt(String(f.get("mentee") ?? ""), 10) || 0);
  if (!mentor || !mentee || mentor.role !== "mentor" || mentee.role !== "mentee") return new Response(null, { status: 303, headers: { location: "/courses/personal" } });
  // A mentor can only build for their own mentees; admins can build for any pair.
  if (!admin) {
    const pair = await env.DB.prepare(`SELECT id FROM pairs WHERE mentor_id = ? AND mentee_id = ? AND active = 1`)
      .bind(mentor.id, mentee.id)
      .first<{ id: number }>();
    if (!pair) return new Response(null, { status: 303, headers: { location: "/courses/personal" } });
  }
  const focus = String(f.get("focus") ?? "").trim().slice(0, 160);
  const c = await buildCourse(env, mentee, mentor, focus);
  const row = await env.DB.prepare(
    `INSERT INTO personal_courses (mentor_id, mentee_id, title, summary, modules, ai, demo, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?) RETURNING id`,
  )
    .bind(mentor.id, mentee.id, c.title, c.summary, JSON.stringify(c.modules), c.ai ? 1 : 0, new Date().toISOString())
    .first<{ id: number }>();
  return new Response(null, { status: 303, headers: { location: `/courses/personal/${row!.id}?new=1` } });
}

export async function personalDetail(env: Env, id: number, url: URL, user: Me): Promise<Response> {
  const r = await env.DB.prepare(
    `SELECT pc.*, m.name AS mentor_name, e.name AS mentee_name FROM personal_courses pc JOIN users m ON m.id = pc.mentor_id JOIN users e ON e.id = pc.mentee_id WHERE pc.id = ?`,
  )
    .bind(id)
    .first<PersonalRow>();
  if (!r) return html(layout("Not found", `<div class="card"><h1>Course not found</h1><p><a href="/courses/personal">Back to personalized courses</a></p></div>`), 404);
  if (user.role !== "admin" && user.userId !== r.mentor_id && user.userId !== r.mentee_id) {
    return html(layout("Not allowed", `<div class="card"><h1>This plan isn't yours</h1><p>Personalized courses are private to the mentor and mentee they were built for.</p><p><a href="/courses/personal">Back to personalized courses</a></p></div>`), 403);
  }
  const mods = JSON.parse(r.modules || "[]") as Module[];
  // Library courses that fit each module, by keyword.
  const lib = await env.DB.prepare(`SELECT id, title, tags FROM courses`).all<{ id: number; title: string; tags: string }>();
  const related = (m: Module) =>
    lib.results.filter((c) => sharedCourses(`${m.title}, ${m.steps.join(", ")}`, `${c.title}, ${c.tags}`).length).slice(0, 2);
  const body = `
${url.searchParams.get("new") ? `<div class="notice">${r.ai ? "ember built this course." : "Course built from the template (AI was busy)."} Share it with ${esc(first(r.mentee_name ?? ""))} at your next meeting.</div>` : ""}
<p><a href="/courses/personal">← Personalized courses</a></p>
<div class="banner pc-hero"><span class="chip" style="background:rgba(255,255,255,.15);color:#fff">For ${esc(r.mentee_name ?? "")} · guide ${esc(r.mentor_name ?? "")}</span>
<h1 style="margin-top:.6rem">${esc(r.title)}</h1><p>${esc(r.summary)}</p>
<div class="pc-prog"><b id="pcBar"></b></div><span id="pcTxt" style="font-size:.9rem;opacity:.85"></span></div>
<ol class="modules">${mods
    .map(
      (m, i) => `<li class="module" style="--d:${i * 120}ms"><div class="mnum">${i + 1}</div><div class="mbody"><h3>${esc(m.title)}</h3><p class="muted">${esc(m.why)}</p>
  <ul class="steps">${m.steps.map((s, k) => `<li><label class="check"><input type="checkbox" data-k="${i}-${k}"> ${esc(s)}</label></li>`).join("")}</ul>
  ${related(m).length ? `<div class="tagrow">${related(m).map((c) => `<a class="tag" href="/courses?goal=${encodeURIComponent(c.title)}">From the library: ${esc(c.title)}</a>`).join("")}</div>` : ""}</div></li>`,
    )
    .join("")}</ol>
<script>
(function(){var key='pc-${r.id}',done={};try{done=JSON.parse(localStorage.getItem(key)||'{}')}catch(e){}
var boxes=[].slice.call(document.querySelectorAll('.steps input'));function upd(){var n=boxes.filter(function(b){return b.checked}).length;document.getElementById('pcBar').style.width=(boxes.length?n/boxes.length*100:0)+'%';document.getElementById('pcTxt').textContent=n+' of '+boxes.length+' steps done';}
boxes.forEach(function(b){b.checked=!!done[b.dataset.k];b.onchange=function(){done[b.dataset.k]=b.checked;try{localStorage.setItem(key,JSON.stringify(done))}catch(e){}upd();if(b.checked&&window.toast)toast('Nice. One step closer.')}});upd();})();
</script>`;
  return html(layout(r.title, body, "/courses"));
}

export const PERSONAL_CSS = `
.ctabs{display:flex;gap:.4rem;margin:0 0 1rem;padding:.3rem;border-radius:14px;background:rgba(128,128,128,.1);width:max-content;max-width:100%}
.ctabs a{padding:.55rem 1rem;border-radius:10px;font-weight:600;color:var(--ink)!important;text-decoration:none!important;border:0!important;transition:background-color .2s,color .2s}
.ctabs a.on{background:var(--ember);color:#fff!important;box-shadow:0 4px 14px rgba(255,107,53,.35)}
.pcourse{color:var(--ink)!important;text-decoration:none!important;transition:transform .2s,box-shadow .2s;animation:enter .5s var(--ease-enter) both}
.pcourse:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(31,23,41,.12)}
.mini{margin:0;padding-left:1.1rem;font-size:.9rem}.mini li{margin:.15rem 0}
.btn.working{animation:breathe 1.2s ease-in-out infinite}
.pc-prog{height:8px;border-radius:99px;background:rgba(255,255,255,.2);margin:1rem 0 .4rem;overflow:hidden;position:relative;z-index:1}
.pc-prog b{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--ember),var(--gold));transition:width .6s var(--ease-enter)}
.modules{list-style:none;padding:0;margin:1.2rem 0;position:relative}
.modules::before{content:"";position:absolute;left:21px;top:10px;bottom:10px;width:2px;background:linear-gradient(var(--ember),var(--gold));opacity:.5}
.module{display:flex;gap:1rem;margin:0 0 1rem;animation:enter .6s var(--ease-enter) var(--d) both}
.mnum{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font:700 1.1rem "Space Grotesk";color:#fff;background:var(--ember);position:relative;z-index:1;box-shadow:0 0 0 6px var(--sand)}
html[data-theme=dark] .mnum{box-shadow:0 0 0 6px #1a1224}
.mbody{flex:1;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:1rem 1.2rem}
.mbody h3{margin:0 0 .2rem;font-size:1.15rem}.mbody p{margin:0 0 .6rem}
.steps{list-style:none;padding:0;margin:0 0 .5rem}.steps li{margin:.25rem 0}
`;
