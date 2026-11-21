// Course library: mentors and employers share courses with filter tags,
// students filter by tags and goals, and ember matches courses to each opportunity's wants.
import { ask } from "./ai";
import { ALL_PATHS, AREAS, CAREERS, careerBase, clamp, keywords, splitCourses, type Opportunity } from "./logic";
import { chips, esc, html, layout, options } from "./ui";
import { coursesTabs } from "./personal";

interface Env {
  DB: D1Database;
  AI?: Ai;
}

export interface Course {
  id: number;
  title: string;
  provider: string;
  author: string;
  author_kind: string; // "Mentor" | "Employer"
  opp_id: number | null;
  career: string;
  level: string;
  cost: string;
  format: string;
  length: string;
  tags: string;
  description: string;
  link: string;
  created_at: string;
}

export const LEVELS = ["Beginner", "Intermediate", "Advanced"];
export const COSTS = ["Free", "Paid"];
export const COURSE_FORMATS = ["Self-paced", "Live class", "Workshop"];
export const AUTHOR_KINDS = ["Mentor", "Employer"];
const PATHS = CAREERS.filter((c) => c !== "Not sure yet");
const FORM_PATHS = ALL_PATHS.filter((c) => c !== "Not sure yet");

export const COURSE_SCHEMA = `CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  author_kind TEXT NOT NULL DEFAULT 'Mentor',
  opp_id INTEGER,
  career TEXT NOT NULL,
  level TEXT NOT NULL,
  cost TEXT NOT NULL,
  format TEXT NOT NULL,
  length TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
)`;

type SeedCourse = Omit<Course, "id" | "created_at">;
const C = (
  title: string, provider: string, author: string, author_kind: string, opp_id: number | null, career: string,
  level: string, cost: string, format: string, length: string, tags: string, description: string,
): SeedCourse => ({ title, provider, author, author_kind, opp_id, career, level, cost, format, length, tags, description, link: "" });

// Fictional demo courses (opportunity ids 1-6 follow the seeded postings).
const SEED: SeedCourse[] = [
  C("User Research Methods, the practical version", "TechWomenAZ mentor session (demo)", "Dana Ruiz", "Mentor", null, "UX/Design", "Beginner", "Free", "Live class", "4 weeks", "user research, interviews, portfolio", "Plan, run and write up 3 real user interviews. Ends with a portfolio-ready case study."),
  C("Figma Prototyping from zero", "TechWomenAZ mentor session (demo)", "Hannah Brooks", "Mentor", null, "UX/Design", "Beginner", "Free", "Self-paced", "6 hours", "figma, prototyping, ux design", "Wireframes to clickable prototype, with a redesign project you can show."),
  C("Human-Computer Interaction crash course", "ASU Open (demo)", "Dana Ruiz", "Mentor", null, "UX/Design", "Intermediate", "Free", "Self-paced", "3 weeks", "hci, usability testing, accessibility", "The HCI ideas interviewers ask about, with usability testing practice."),
  C("Intro to Java with real projects", "TechWomenAZ mentor session (demo)", "Maria Santos", "Mentor", null, "Software", "Beginner", "Free", "Live class", "6 weeks", "java, programming basics, git", "Weekly evening class. You finish with two small Java apps on GitHub."),
  C("Data Structures and Algorithms for interviews", "TechWomenAZ mentor session (demo)", "Priya Natarajan", "Mentor", null, "Software", "Intermediate", "Free", "Workshop", "5 sessions", "data structures, algorithms, interview prep", "The 20 problems that come up most, solved together, plus a mock interview."),
  C("JavaScript and the web", "Community college (demo)", "Kevin Tran", "Mentor", null, "Software", "Beginner", "Paid", "Live class", "8 weeks", "javascript, html and css, react", "Build and deploy a portfolio site. Ex-chef turned frontend dev teaches it."),
  C("SQL for analysts", "TechWomenAZ mentor session (demo)", "Lena Okafor", "Mentor", null, "Data/AI", "Beginner", "Free", "Self-paced", "10 hours", "sql databases, data analysis, dashboards", "Query real public data, then build one dashboard from it."),
  C("Statistics you'll actually use", "UofA Extension (demo)", "Lena Okafor", "Mentor", null, "Data/AI", "Intermediate", "Paid", "Live class", "6 weeks", "statistics, python for data science, a/b testing", "Distributions, tests and A/B experiments in Python, no heavy math."),
  C("Network Security foundations", "TechWomenAZ mentor session (demo)", "Marcus Bell", "Mentor", null, "Cybersecurity", "Beginner", "Free", "Workshop", "3 sessions", "network security, computer networking, security+", "Ports, firewalls and packet captures in a home lab. Maps to Security+."),
  C("Linux Administration for SOC work", "TechWomenAZ mentor session (demo)", "Ray Castillo", "Mentor", null, "Cybersecurity", "Intermediate", "Free", "Self-paced", "8 hours", "linux administration, logs, incident response", "The Linux commands and log reading a SOC analyst uses every day."),
  C("Agile and product basics", "TechWomenAZ mentor session (demo)", "Sofia Martinez", "Mentor", null, "Product", "Beginner", "Free", "Live class", "4 weeks", "product management, agile project management, roadmaps", "Write a one-page brief and a roadmap, then present it to a real PM."),
  C("Statics and CAD for your first design project", "TechWomenAZ mentor session (demo)", "Grace Whitfield", "Mentor", null, "Engineering · Mechanical", "Beginner", "Free", "Workshop", "4 sessions", "statics, cad modeling, solidworks, portfolio", "Model a bracket in CAD, check it with statics, and write it up as a case study."),
  C("Circuits to embedded systems", "TechWomenAZ mentor session (demo)", "Ana Morales", "Mentor", null, "Engineering · Electrical", "Intermediate", "Free", "Live class", "6 weeks", "circuit analysis, embedded systems, digital logic, fe exam", "From Ohm's law to programming a microcontroller, with FE exam practice."),
  C("AutoCAD for civil internships", "TechWomenAZ mentor session (demo)", "Joy Nakamura", "Mentor", null, "Engineering · Civil", "Beginner", "Free", "Self-paced", "8 hours", "autocad, structural analysis, site plans", "Draw a real site plan the way interns do on day one."),
  C("Help Desk Fundamentals bootcamp", "TechWomenAZ mentor session (demo)", "Tasha Greene", "Mentor", null, "IT/Support", "Beginner", "Free", "Workshop", "4 sessions", "help desk fundamentals, windows administration, computer hardware", "Tickets, troubleshooting and Windows admin, with an A+ study plan."),
  // Uploaded by the employers for their postings.
  C("Saguaro Health UX intern prep", "Saguaro Health (demo)", "Saguaro Health recruiting", "Employer", 1, "UX/Design", "Beginner", "Free", "Self-paced", "3 hours", "user research, figma, healthcare ux", "How our design team works, plus the exercise we use in interviews."),
  C("Valley Water analyst starter kit", "Valley Water Co. (demo)", "Valley Water Co. data team", "Employer", 2, "Data/AI", "Beginner", "Free", "Self-paced", "5 hours", "sql databases, statistics, utilities data", "Practice queries on sample meter data, like the ones interns write."),
  C("Desert Shield SOC readiness", "Desert Shield Security (demo)", "Desert Shield Security", "Employer", 3, "Cybersecurity", "Intermediate", "Free", "Workshop", "2 sessions", "network security, linux administration, siem", "A walk through our alert triage, then a practice shift."),
];

export function courseSeed(db: D1Database): D1PreparedStatement[] {
  const now = Date.now();
  const ins = db.prepare(
    `INSERT INTO courses (title, provider, author, author_kind, opp_id, career, level, cost, format, length, tags, description, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  return SEED.map((c, i) =>
    ins.bind(c.title, c.provider, c.author, c.author_kind, c.opp_id, c.career, c.level, c.cost, c.format, c.length, c.tags, c.description, c.link, new Date(now - (i + 1) * 3600e3).toISOString()),
  );
}

async function listCourses(db: D1Database): Promise<Course[]> {
  const { results } = await db.prepare(`SELECT * FROM courses ORDER BY created_at DESC`).all<Course>();
  return results;
}
async function getOpp(db: D1Database, id: number): Promise<Opportunity | null> {
  return db.prepare(`SELECT * FROM opportunities WHERE id = ?`).bind(id).first<Opportunity>();
}

const tagList = (c: Course) => splitCourses(c.tags).map((t) => t.toLowerCase());

/** Keyword relevance of a course to some text (goal or an opportunity's wants). */
export function relevance(c: Course, text: string): number {
  const want = keywords(text);
  const have = keywords(`${c.title} ${c.tags} ${c.description}`);
  let n = 0;
  for (const w of want) if (have.has(w)) n++;
  return n;
}

function courseCard(c: Course, extra = ""): string {
  return `<div class="card course-card">
  <div class="row" style="justify-content:space-between;gap:.4rem"><span class="chip plum">${esc(c.career)}</span><span class="chip ${c.cost === "Free" ? "sage" : ""}">${esc(c.cost)}</span></div>
  <h3 style="margin:.45rem 0 .1rem;font-size:1.1rem"><a class="clink" href="/courses/${c.id}">${esc(c.title)}</a></h3>
  <p class="muted" style="margin:0;font-size:.88rem">${esc(c.author_kind === "Employer" ? "From the employer" : "Shared by mentor")} ${esc(c.author)} · ${esc(c.level)} · ${esc(c.format)}${c.length ? ` · ${esc(c.length)}` : ""}</p>
  <p style="margin:.45rem 0;font-size:.95rem">${esc(c.description)}</p>
  <div class="tagrow">${tagList(c).map((t) => `<a class="tag" href="/courses?tag=${encodeURIComponent(t)}">#${esc(t)}</a>`).join("")}</div>
  ${extra}
  <div class="row" style="margin-top:.6rem"><a class="btn small" href="/courses/${c.id}">View course</a>${/^https?:\/\//.test(c.link) ? `<a class="btn small ghost" href="${esc(c.link)}" target="_blank" rel="noopener">Course website</a>` : ""}</div>
</div>`;
}

// ---------------------------------------------------------------- /courses
export async function coursesPage(env: Env, url: URL): Promise<Response> {
  const all = await listCourses(env.DB);
  const q = url.searchParams;
  const career = q.get("career") ?? "";
  const level = q.get("level") ?? "";
  const cost = q.get("cost") ?? "";
  const format = q.get("format") ?? "";
  const goal = (q.get("goal") ?? "").slice(0, 200);
  const tags = q.getAll("tag").map((t) => t.toLowerCase()).slice(0, 8);
  const ids = (q.get("ids") ?? "").split(",").map((x) => parseInt(x, 10)).filter((n) => n > 0);
  let list = all.filter(
    (c) => !ids.length || ids.includes(c.id),
  ).filter(
    (c) =>
      (!career || c.career === career || careerBase(c.career) === career) &&
      (!level || c.level === level) &&
      (!cost || c.cost === cost) &&
      (!format || c.format === format) &&
      tags.every((t) => tagList(c).includes(t)),
  );
  if (goal) list = list.map((c) => ({ c, r: relevance(c, goal) })).filter((x) => x.r > 0).sort((a, b) => b.r - a.r).map((x) => x.c);
  // Most-used tags (within the career filter) become tap-to-filter chips.
  const counts = new Map<string, number>();
  for (const c of all.filter((c) => !career || c.career === career || careerBase(c.career) === career)) for (const t of tagList(c)) counts.set(t, (counts.get(t) ?? 0) + 1);
  const topTags = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 16).map(([t]) => t);
  const withTag = (t: string) => {
    const p = new URLSearchParams(q);
    const cur = p.getAll("tag");
    p.delete("tag");
    (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]).forEach((x) => p.append("tag", x));
    return `/courses?${p}`;
  };
  const sel = (name: string, list: string[], v: string, label: string) =>
    `<div><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}" onchange="this.form.submit()"><option value="">Any</option>${list.map((x) => `<option${x === v ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></div>`;
  const body = `
${q.get("added") ? `<div class="notice">Course added. Students can find it now.</div>` : ""}
<div class="banner"><div class="row" style="justify-content:space-between;position:relative;z-index:1"><h1>Courses</h1><a class="btn" href="/courses/new">Share a course</a></div>
<p>Shared by mentors and employers. Filter to what fits your goal.</p></div>
${coursesTabs("library")}
<div class="actions3">
  <a class="card act" href="#list"><b>Take a course</b><span>Pick one below, open it, and tick off lessons as you go.</span></a>
  <a class="card act" href="/courses/new"><b>Share a course</b><span>Mentors and employers: add a course with filter tags.</span></a>
  <a class="card act" href="/courses/personal"><b>Build one with ember</b><span>Mentors: ember writes a course for one mentee.</span></a>
</div>
<form method="get" class="card filters">
  <div class="fgrid">
    ${sel("career", PATHS, career, "Path")}${sel("level", LEVELS, level, "Level")}${sel("cost", COSTS, cost, "Cost")}${sel("format", COURSE_FORMATS, format, "Format")}
  </div>
  ${tags.map((t) => `<input type="hidden" name="tag" value="${esc(t)}">`).join("")}
  <label for="f-goal">Your goal</label>
  <div class="row"><input id="f-goal" name="goal" value="${esc(goal)}" maxlength="200" placeholder="e.g. land a SOC analyst job" style="flex:1;min-width:12rem"><button class="btn small" type="submit">Find courses</button></div>
  <div class="tagrow" style="margin-top:.7rem">${topTags.map((t) => `<a class="tag${tags.includes(t) ? " on" : ""}" href="${esc(withTag(t))}">#${esc(t)}</a>`).join("")}</div>
  <p style="margin:.6rem 0 0"><a id="savedLink" href="/courses" style="display:none"></a>${career || level || cost || format || goal || tags.length || ids.length ? ` <a href="/courses">Clear filters</a>` : ""}</p>
</form>
<script>try{var s=JSON.parse(localStorage.getItem('savedCourses')||'[]');if(s.length){var a=document.getElementById('savedLink');a.href='/courses?ids='+s.join(',');a.textContent='★ My saved courses ('+s.length+')';a.style.display='inline';a.style.marginRight='1rem'}}catch(e){}</script>
<p class="muted" id="list" style="margin:.8rem 0;scroll-margin-top:80px">${list.length} course${list.length === 1 ? "" : "s"}${goal ? `, best fit for “${esc(goal)}” first` : ""}</p>
<div class="grid">${list.map((c) => courseCard(c)).join("") || `<div class="card">No courses match those filters yet. <a href="/courses">Clear filters</a></div>`}</div>`;
  return html(layout("Courses", body, "/courses"));
}

export async function courseForm(env: Env, url: URL): Promise<Response> {
  const opps = await env.DB.prepare(`SELECT id, title, org FROM opportunities ORDER BY created_at DESC`).all<{ id: number; title: string; org: string }>();
  const oppId = parseInt(url.searchParams.get("opp") ?? "", 10) || 0;
  const orgName = (url.searchParams.get("org") ?? "").slice(0, 80);
  const body = `
<h1>Share a course</h1>
<p class="muted">Mentors: share a class you teach or loved. Employers: add prep courses for your posting.</p>
<form method="post" action="/courses" class="card">
  <div class="two">
    <div><label for="author_kind">I'm a</label><select id="author_kind" name="author_kind">${options(AUTHOR_KINDS, oppId || orgName ? "Employer" : "Mentor")}</select></div>
    <div><label for="author">Your name or organization</label><input id="author" name="author" required maxlength="80" value="${esc(orgName)}"></div>
    <div><label for="title">Course title</label><input id="title" name="title" required maxlength="120" placeholder="e.g. SQL for analysts"></div>
    <div><label for="provider">Where it's taught</label><input id="provider" name="provider" maxlength="80" value="${esc(orgName)}" placeholder="e.g. Coursera, ASU, my own session"></div>
    <div><label for="career">Path</label><select id="career" name="career">${options(FORM_PATHS)}</select></div>
    <div><label for="level">Level</label><select id="level" name="level">${options(LEVELS)}</select></div>
    <div><label for="cost">Cost</label><select id="cost" name="cost">${options(COSTS)}</select></div>
    <div><label for="format">Format</label><select id="format" name="format">${options(COURSE_FORMATS)}</select></div>
    <div><label for="length">Length</label><input id="length" name="length" maxlength="40" placeholder="e.g. 6 weeks"></div>
    <div><label for="opp_id">For an opportunity? (optional)</label><select id="opp_id" name="opp_id"><option value="">No, general course</option>${opps.results
      .map((o) => `<option value="${o.id}"${o.id === oppId ? " selected" : ""}>${esc(o.title)} · ${esc(o.org)}</option>`)
      .join("")}</select></div>
  </div>
  <label for="tags">Filter tags</label>
  <input id="tags" name="tags" required maxlength="200" placeholder="Separate with commas: sql databases, dashboards, interview prep">
  <label for="description">What you'll learn</label><textarea id="description" name="description" rows="3" maxlength="400"></textarea>
  <label for="link">Link (optional)</label><input id="link" name="link" type="url" maxlength="300" placeholder="https://">
  <div style="margin-top:1rem"><button class="btn" type="submit">Share course</button></div>
</form>`;
  return html(layout("Share a course", body, "/courses"));
}

export async function courseSubmit(req: Request, env: Env): Promise<Response> {
  const f = await req.formData();
  const s = (k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);
  const pick = (k: string, list: string[]) => (list.includes(s(k, 60)) ? s(k, 60) : list[0]);
  const title = s("title", 120);
  const author = s("author", 80);
  if (!title || !author) return courseForm(env, new URL(req.url));
  const oppId = parseInt(s("opp_id", 10), 10);
  const opp = oppId ? await getOpp(env.DB, oppId) : null;
  const link = s("link", 300);
  await env.DB.prepare(
    `INSERT INTO courses (title, provider, author, author_kind, opp_id, career, level, cost, format, length, tags, description, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      title, s("provider", 80), author, pick("author_kind", AUTHOR_KINDS), opp ? opp.id : null, pick("career", FORM_PATHS), pick("level", LEVELS),
      pick("cost", COSTS), pick("format", COURSE_FORMATS), s("length", 40),
      splitCourses(s("tags", 200)).slice(0, 8).map((t) => t.toLowerCase()).join(", "), s("description", 400),
      /^https?:\/\//.test(link) ? link : "", new Date().toISOString(),
    )
    .run();
  return new Response(null, { status: 303, headers: { location: opp ? `/opportunities/${opp.id}?course=1` : "/courses?added=1" } });
}



/** Lessons for a library course: one per filter tag, then a capstone. */
function lessons(c: Course): [string, string][] {
  const t = tagList(c).slice(0, 4);
  const cap = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase());
  const out: [string, string][] = [["Kickoff", `Read the overview and set one goal for "${c.title}".`]];
  t.forEach((tag, i) => out.push([`${i + 1}. ${cap(tag)}`, i === 0 ? `Learn the basics of ${tag} and take notes.` : `Practice ${tag} with one small exercise.`]));
  out.push(["Capstone", c.author_kind === "Employer" ? "Finish the exercise this employer uses in interviews." : `Show your work to ${c.author.split(" ")[0]} or your mentor for feedback.`]);
  return out;
}

// ---------------------------------------------------------------- /courses/:id
export async function courseDetail(env: Env, id: number): Promise<Response> {
  const c = await env.DB.prepare(`SELECT * FROM courses WHERE id = ?`).bind(id).first<Course>();
  if (!c) return html(layout("Not found", `<div class="card"><h1>Course not found</h1><p><a href="/courses">Back to courses</a></p></div>`), 404);
  const [opps, mentors] = await Promise.all([
    env.DB.prepare(`SELECT * FROM opportunities ORDER BY created_at DESC`).all<Opportunity>(),
    env.DB.prepare(`SELECT id, name, headline, courses, career FROM users WHERE role = 'mentor'`).all<{ id: number; name: string; headline: string; courses: string; career: string }>(),
  ]);
  const helps = opps.results
    .map((o) => ({ o, r: relevance(c, `${o.courses} ${o.title}`) + (o.id === c.opp_id ? 10 : 0) + (o.career === c.career ? 1 : 0) }))
    .filter((x) => x.r > 1)
    .sort((a, b) => b.r - a.r)
    .slice(0, 3);
  const guides = mentors.results
    .map((m) => ({ m, r: relevance(c, m.courses) + (m.career === c.career ? 1 : 0) }))
    .filter((x) => x.r > 1 && x.m.name !== c.author)
    .sort((a, b) => b.r - a.r)
    .slice(0, 3);
  const body = `
<p><a href="/courses">← All courses</a></p>
<div class="banner"><div class="row" style="gap:.4rem;position:relative;z-index:1"><span class="chip" style="background:rgba(255,255,255,.15);color:#fff">${esc(c.career)}</span><span class="chip" style="background:rgba(255,255,255,.15);color:#fff">${esc(c.level)}</span><span class="chip" style="background:rgba(255,255,255,.15);color:#fff">${esc(c.cost)}</span></div>
<h1 style="margin-top:.6rem">${esc(c.title)}</h1>
<p>${esc(c.author_kind === "Employer" ? "From the employer" : "Shared by mentor")} ${esc(c.author)}${c.provider ? ` · ${esc(c.provider)}` : ""} · ${esc(c.format)}${c.length ? ` · ${esc(c.length)}` : ""}</p>
<div class="row" style="margin-top:1rem;position:relative;z-index:1"><button class="btn" type="button" id="saveBtn">Save to my courses</button>${/^https?:\/\//.test(c.link) ? `<a class="btn ghost onDark" href="${esc(c.link)}" target="_blank" rel="noopener">Course website</a>` : ""}<a class="btn ghost onDark" href="/courses/personal">Make it personal with ember</a></div></div>
<div class="two" style="align-items:start">
  <div class="card"><h2 style="font-size:1.2rem">What you'll learn</h2><p>${esc(c.description) || "No description yet."}</p>
  <div class="tagrow">${tagList(c).map((t) => `<a class="tag" href="/courses?tag=${encodeURIComponent(t)}">#${esc(t)}</a>`).join("")}</div>
  <h2 style="font-size:1.2rem;margin-top:1.2rem">Lessons</h2>
  <div class="pc-prog light"><b id="lpBar"></b></div><p class="muted" id="lpTxt" style="font-size:.88rem;margin:.2rem 0 .6rem"></p>
  <ol class="lessons">${lessons(c).map((l, i) => `<li><label class="check"><input type="checkbox" data-k="${i}"> <span><b>${esc(l[0])}</b><br><span class="muted">${esc(l[1])}</span></span></label></li>`).join("")}</ol>
  <button class="btn" type="button" id="startBtn">Start course</button></div>
  <div class="card"><h2 style="font-size:1.2rem">Prepares you for</h2>${
    helps.length
      ? helps.map((x) => `<p style="margin:.4rem 0"><a href="/opportunities/${x.o.id}"><b>${esc(x.o.title)}</b></a><br><span class="muted">${esc(x.o.org)} · ${esc(x.o.kind)}${x.o.id === c.opp_id ? " · made for this posting" : ""}</span></p>`).join("")
      : `<p class="muted">No open postings ask for this yet. <a href="/opportunities">See all opportunities</a>.</p>`
  }
  <h2 style="font-size:1.2rem;margin-top:1rem">Mentors who know this</h2>${
    guides.length
      ? guides.map((x) => `<p style="margin:.4rem 0"><b>${esc(x.m.name)}</b><br><span class="muted">${esc(x.m.headline)}</span></p>`).join("")
      : `<p class="muted">${esc(c.author)} shared it. <a href="/start">Get matched</a> to find a mentor for it.</p>`
  }</div>
</div>
<script>(function(){var id=${c.id},b=document.getElementById('saveBtn'),s=[];try{s=JSON.parse(localStorage.getItem('savedCourses')||'[]')}catch(e){}
function paint(){var on=s.indexOf(id)>=0;b.textContent=on?'Saved ✓':'Save to my courses';b.classList.toggle('ghost',on)}
b.onclick=function(){var i=s.indexOf(id);if(i>=0)s.splice(i,1);else s.push(id);try{localStorage.setItem('savedCourses',JSON.stringify(s))}catch(e){}paint();if(window.toast)toast(i>=0?'Removed from your courses':'Saved. Find it under My saved courses.')};paint();
var key='lessons-'+id,done={};try{done=JSON.parse(localStorage.getItem(key)||'{}')}catch(e){}var boxes=[].slice.call(document.querySelectorAll('.lessons input')),sb=document.getElementById('startBtn');
function prog(){var n=boxes.filter(function(x){return x.checked}).length;document.getElementById('lpBar').style.width=(n/boxes.length*100)+'%';document.getElementById('lpTxt').textContent=n+' of '+boxes.length+' lessons done'+(n===boxes.length?'. Course complete!':'');sb.textContent=n===0?'Start course':n===boxes.length?'Course complete ✓':'Continue: lesson '+(n+1)}
boxes.forEach(function(x){x.checked=!!done[x.dataset.k];x.onchange=function(){done[x.dataset.k]=x.checked;try{localStorage.setItem(key,JSON.stringify(done))}catch(e){}prog();if(x.checked&&window.toast)toast('Lesson done. Nice.')}});
sb.onclick=function(){var next=boxes.filter(function(x){return !x.checked})[0];if(!next)return;if(s.indexOf(id)<0){s.push(id);try{localStorage.setItem('savedCourses',JSON.stringify(s))}catch(e){}paint()}var li=next.closest('li');li.scrollIntoView({behavior:'smooth',block:'center'});li.classList.add('flash');setTimeout(function(){li.classList.remove('flash')},1200)};prog()})();</script>`;
  return html(layout(c.title, body, "/courses"));
}

// ---------------------------------------------------------------- Opportunity ↔ courses
/** HTML block for an opportunity page: employer's own courses now, ember's picks loaded from the API. */
export function oppCoursesBlock(oppId: number): string {
  return `<div class="card" style="margin-top:1rem" id="oppCourses">
  <div class="row" style="justify-content:space-between"><h2 style="font-size:1.2rem;margin:0">Courses that prepare you</h2><a class="btn small ghost" href="/courses/new?opp=${oppId}">Add a course for this posting</a></div>
  <p class="muted" style="font-size:.9rem;margin:.3rem 0 .8rem">ember reads what this posting wants and picks courses from the library that cover it.</p>
  <div id="oc-list" class="grid"><div class="card shimmer">ember is matching courses…</div></div>
</div>
<script>
fetch('/api/opp-courses/${oppId}').then(function(r){return r.json()}).then(function(d){var box=document.getElementById('oc-list');
  if(!d.items||!d.items.length){box.innerHTML='<p class="muted">No matching courses yet. <a href="/courses/new?opp=${oppId}">Add one</a>.</p>';return}
  box.innerHTML=d.items.map(function(x,i){return '<div class="oc-item" style="animation-delay:'+(i*90)+'ms">'+x.html+'</div>'}).join('');
  if(d.ai){var n=document.createElement('p');n.className='muted';n.style.cssText='font-size:.8rem;margin:.6rem 0 0';n.textContent='Picked by ember (Workers AI).';box.parentNode.appendChild(n)}
}).catch(function(){document.getElementById('oc-list').innerHTML='<p class="muted">Could not load courses. <a href="/courses">Browse all courses</a>.</p>'});
</script>`;
}

export async function apiOppCourses(env: Env, oppId: number): Promise<Response> {
  const opp = await getOpp(env.DB, oppId);
  if (!opp) return Response.json({ error: "not found" }, { status: 404 });
  const all = await listCourses(env.DB);
  const wants = `${opp.courses} ${opp.title} ${opp.description}`;
  const own = all.filter((c) => c.opp_id === opp.id);
  // Candidates: same path or any keyword overlap, best first (keeps the prompt small).
  const cands = all
    .filter((c) => c.opp_id !== opp.id)
    .map((c) => ({ c, r: relevance(c, wants) + (c.career === opp.career ? 1 : 0) }))
    .filter((x) => x.r > 0)
    .sort((a, b) => b.r - a.r)
    .slice(0, 14);
  const wanted = splitCourses(opp.courses);
  const covers = (c: Course) => wanted.filter((w) => relevance(c, w) > 0);

  let picks: { c: Course; why: string }[] = [];
  let usedAi = false;
  if (cands.length) {
    const t = await ask(
      env,
      "You are ember, TechWomenAZ's course matchmaker. Pick the courses that best prepare a student for the posting's wants. Reply ONLY with lines in the form `ID: reason`, reason max 14 words, best first, at most 4 lines. Use only IDs from the list.",
      `Posting: ${opp.title} (${opp.kind}, ${opp.career})\nWants: ${opp.courses}\nAbout: ${opp.description}\n\nCourses:\n${cands
        .map((x) => `${x.c.id} | ${x.c.title} | ${x.c.level} | tags: ${x.c.tags}`)
        .join("\n")}`,
      160,
    );
    if (t) {
      const byId = new Map(cands.map((x) => [x.c.id, x.c]));
      for (const line of t.split("\n")) {
        const m = line.replace(/[*`]/g, "").match(/^\s*(?:ID\s*)?(\d+)\s*[:\-|.)]\s*(.+)$/i);
        const c = m && byId.get(+m[1]);
        if (c && !picks.some((p) => p.c.id === c.id)) picks.push({ c, why: m![2].trim().slice(0, 140) });
      }
      usedAi = picks.length > 0;
    }
    if (!picks.length)
      picks = cands.filter((x) => covers(x.c).length || x.c.career === opp.career).slice(0, 4).map((x) => {
        const cv = covers(x.c);
        return { c: x.c, why: cv.length ? `Covers ${cv.slice(0, 2).join(" and ")}, which this posting wants.` : `Builds ${x.c.career} skills this role uses.` };
      });
  }
  const item = (c: Course, label: string, why: string) => {
    const cv = covers(c);
    return {
      id: c.id,
      html: courseCard(
        c,
        `<div class="oc-why"><b>${esc(label)}</b> ${esc(why)}</div>${cv.length ? `<div style="margin-top:.35rem">${chips(cv.map((w) => `Covers ${w}`), "sage")}</div>` : ""}`,
      ),
    };
  };
  const items = [
    ...own.map((c) => item(c, "From the employer:", "made for this posting.")),
    ...picks.slice(0, 4).map((p) => item(p.c, "ember:", p.why)),
  ];
  return Response.json({ items, ai: usedAi });
}

export const COURSE_CSS = `
.clink{color:inherit!important;text-decoration:none!important;border:0!important}.clink:hover{color:var(--ember)!important}
.actions3{display:grid;grid-template-columns:repeat(3,1fr);gap:.8rem;margin:0 0 1rem}
.act{display:flex;flex-direction:column;gap:.25rem;color:var(--ink)!important;text-decoration:none!important;transition:transform .2s,box-shadow .2s,border-color .2s}
.act:hover{transform:translateY(-3px);border-color:var(--ember);box-shadow:0 12px 26px rgba(255,107,53,.15)}
.act b{font:700 1.1rem 'Space Grotesk',system-ui;color:var(--ember)}.act span{font-size:.9rem;color:var(--muted)}
@media (max-width:700px){.actions3{grid-template-columns:1fr}}
.lessons{list-style:none;padding:0;margin:0 0 1rem}.lessons li{padding:.45rem .5rem;border-radius:10px;transition:background-color .4s}.lessons li.flash{background:rgba(255,182,39,.25)}
.pc-prog.light{background:rgba(128,128,128,.18);margin:.3rem 0}
.tagrow{display:flex;flex-wrap:wrap;gap:.35rem}
.tag{display:inline-block;font:600 .8rem system-ui;padding:.3rem .6rem;border-radius:99px;background:rgba(255,107,53,.1);color:var(--ink)!important;text-decoration:none!important;border:1px solid transparent;transition:transform .15s,background-color .15s}
.tag:hover{transform:translateY(-1px);background:rgba(255,107,53,.2)}
.tag.on{background:var(--ember);color:#fff!important}
.fgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.6rem}
.course-card{animation:enter .5s var(--ease-enter) both}
.grid>.course-card:nth-child(2){animation-delay:.06s}.grid>.course-card:nth-child(3){animation-delay:.12s}.grid>.course-card:nth-child(4){animation-delay:.18s}.grid>.course-card:nth-child(n+5){animation-delay:.24s}
.oc-item{animation:enter .55s var(--ease-enter) both}.oc-item>.card{height:100%}
.oc-why{margin-top:.5rem;padding:.5rem .65rem;border-radius:10px;background:rgba(255,182,39,.14);font-size:.9rem}
.shimmer{background:linear-gradient(90deg,var(--card) 0%,rgba(255,182,39,.18) 50%,var(--card) 100%);background-size:200% 100%;animation:shim 1.2s linear infinite;color:var(--muted)}
@keyframes shim{to{background-position:-200% 0}}
`;

export { clamp, AREAS };
