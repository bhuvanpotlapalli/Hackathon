// Every page and form handler. Server-rendered HTML with a little inline JS.

import * as ai from "./ai";
import * as db from "./db";
import {
  AREAS,
  AVAILABILITY,
  CAREERS,
  FORMATS,
  OPP_KINDS,
  clamp,
  flameFor,
  matchScore,
  oppScore,
  starterMilestones,
  type Flame,
  type User,
} from "./logic";
import { chips, esc, flameHtml, html, layout, options, statusHtml } from "./ui";

export interface Env {
  DB: D1Database;
  AI?: Ai;
}

const redirect = (to: string) => new Response(null, { status: 303, headers: { location: to } });
const str = (f: FormData, k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max);
const int = (f: FormData, k: string, lo: number, hi: number, dflt: number) => {
  const n = parseInt(String(f.get(k) ?? ""), 10);
  return Number.isFinite(n) ? clamp(n, lo, hi) : dflt;
};

function notFound(what: string) {
  return html(layout("Not found", `<div class="card"><h1>${esc(what)} not found</h1><p><a href="/">Back home</a></p></div>`), 404);
}

/** Flame for every pair, from all check-ins in one query. */
async function flamesByPair(env: Env): Promise<Map<number, { flame: Flame; checkins: db.Checkin[] }>> {
  const [pairs, checkins] = await Promise.all([db.listPairs(env.DB), db.listCheckins(env.DB)]);
  const byPair = new Map<number, db.Checkin[]>();
  for (const c of checkins) byPair.set(c.pair_id, [...(byPair.get(c.pair_id) ?? []), c]);
  const out = new Map<number, { flame: Flame; checkins: db.Checkin[] }>();
  for (const p of pairs) {
    const cs = byPair.get(p.id) ?? [];
    out.set(p.id, { flame: flameFor(cs.map((c) => c.met_at), p.created_at), checkins: cs });
  }
  return out;
}

// ---------------------------------------------------------------- Home
export async function home(env: Env): Promise<Response> {
  const mentees = (await db.listMentees(env.DB)).slice(0, 12);
  const body = `
<section class="hero">
  <h1>Ember: mentorships that don't fizzle out</h1>
  <p>Built for <b>TechWomenAZ</b>. We match college students and career changers with mentors who have taken the same courses, then keep every pair meeting. Meet and your flame grows. Go quiet and it fades.</p>
  <div class="row" style="margin-top:1rem">
    <a class="btn" href="/join?role=mentee">Find a mentor</a>
    <a class="btn light" href="/join?role=mentor">Become a mentor</a>
    <a class="btn ghost" style="color:#fff;border-color:#fff" href="/opportunities/new">Post an opportunity</a>
  </div>
</section>
<div class="grid">
  <div class="card"><h3>1 · Match</h3><p>Tell us your career path and the courses you're taking. Ember finds mentors who have been through the same coursework.</p></div>
  <div class="card"><h3>2 · Plan</h3><p>Every pair gets a goal and three milestones, so no meeting is just "catching up."</p></div>
  <div class="card"><h3>3 · Keep it lit</h3><p>Log a meeting in 30 seconds and watch your flame grow. TechWomenAZ relights fading pairs from the Campfire.</p></div>
  <div class="card"><h3>4 · Get opportunities</h3><p>Employers post internships, jobs and mentorship programs with the coursework they want. Ember shows each student the ones they fit.</p></div>
</div>
<div class="card" style="margin-top:1.25rem">
  <h3>Try the demo as a mentee</h3>
  <p class="muted">These are fictional demo profiles.</p>
  <div class="row">${mentees.map((m) => `<a class="chip plum" href="/matches/${m.id}">${esc(m.name)}</a>`).join("")}</div>
</div>`;
  return html(layout("Home", body, "/"));
}

// ---------------------------------------------------------------- Join
export function joinForm(url: URL, error = ""): Response {
  const role = url.searchParams.get("role") === "mentor" ? "mentor" : "mentee";
  const body = `
<h1>Join Ember</h1>
<p class="muted">Two minutes. TechWomenAZ mentoring is for college students and adults. You don't need a tech degree.</p>
${error ? `<div class="notice" style="background:#fdecea;border-color:#f5c2bd;color:#7a1f16" role="alert">${esc(error)}</div>` : ""}
<form method="post" action="/join" class="card">
  <fieldset><legend><b>I want to…</b></legend>
    <label class="check"><input type="radio" name="role" value="mentee" ${role === "mentee" ? "checked" : ""} onchange="roleChange()"> Find a mentor</label>
    <label class="check"><input type="radio" name="role" value="mentor" ${role === "mentor" ? "checked" : ""} onchange="roleChange()"> Be a mentor</label>
  </fieldset>
  <div class="two">
    <div><label for="name">Name</label><input id="name" name="name" required maxlength="80" autocomplete="name"></div>
    <div><label for="headline" id="headlineLabel">Where you are now</label><input id="headline" name="headline" maxlength="120" placeholder="e.g. ASU junior, Graphic Design"></div>
    <div><label for="career">Career path</label><select id="career" name="career">${options(CAREERS)}</select></div>
    <div><label for="school">School or program</label><input id="school" name="school" maxlength="120" placeholder="e.g. Arizona State University"></div>
  </div>
  <label for="courses" id="coursesLabel">Courses you're taking or have taken</label>
  <input id="courses" name="courses" maxlength="400" required placeholder="Separate with commas: Intro to UX Design, Statistics, SQL Databases">
  <p class="muted" id="coursesHint" style="margin:.3rem 0 0;font-size:.9rem">We match you with mentors who have been through the same coursework.</p>
  <label for="goal" id="goalLabel">Your main goal</label>
  <input id="goal" name="goal" required maxlength="200" placeholder="e.g. Land a UX internship by May">
  <div class="two">
    <div><label for="availability">Availability</label><select id="availability" name="availability">${options(AVAILABILITY)}</select></div>
    <div><label for="format">Meeting format</label><select id="format" name="format">${options(FORMATS, "Both")}</select></div>
    <div><label for="area">Area</label><select id="area" name="area">${options(AREAS)}</select></div>
    <div id="capBox" style="display:none"><label for="capacity">How many mentees can you take?</label><select id="capacity" name="capacity">${options(["1", "2", "3"], "2")}</select></div>
  </div>
  <label for="confidence" id="confLabel">How confident do you feel about your tech career? <output id="confOut">5</output>/10</label>
  <input id="confidence" name="confidence" type="range" min="1" max="10" value="5" oninput="confOut.value=this.value">
  <label class="check"><input type="checkbox" name="no_degree" value="1"> I don't have a tech degree</label>
  <label class="check"><input type="checkbox" name="adult" value="1" required> I'm 18 or older and in college or beyond</label>
  <label class="check"><input type="checkbox" name="consent" value="1" required> I agree that TechWomenAZ can store my answers to run the program and report combined, anonymous results</label>
  <div style="margin-top:1rem"><button class="btn" type="submit">Join and see my matches 🔥</button></div>
</form>
<script>
function roleChange(){var m=document.querySelector('input[name=role]:checked').value==='mentor';
document.getElementById('capBox').style.display=m?'block':'none';
document.getElementById('coursesLabel').textContent=m?'Courses you have taken or teach':'Courses you\\'re taking or have taken';
document.getElementById('coursesHint').textContent=m?'Mentees taking these courses will be matched with you.':'We match you with mentors who have been through the same coursework.';
document.getElementById('goalLabel').textContent=m?'What you can help with':'Your main goal';
document.getElementById('headlineLabel').textContent=m?'Your role':'Where you are now';
document.querySelector('button[type=submit]').textContent=m?'Join as a mentor 🔥':'Join and see my matches 🔥';}
roleChange();
</script>`;
  return html(layout("Join", body, "/join"));
}

export async function joinSubmit(req: Request, env: Env): Promise<Response> {
  const f = await req.formData();
  const role = str(f, "role") === "mentor" ? "mentor" : "mentee";
  const name = str(f, "name", 80);
  const goal = str(f, "goal", 200);
  const courses = str(f, "courses", 400);
  if (!name || !goal || !courses) return joinForm(new URL(`http://x/join?role=${role}`), "Please fill in your name, courses and goal.");
  if (!f.get("adult")) return joinForm(new URL(`http://x/join?role=${role}`), "TechWomenAZ mentoring is for people 18+ in college or beyond.");
  if (!f.get("consent")) return joinForm(new URL(`http://x/join?role=${role}`), "Please tick the data consent box so we can match you.");
  const pick = (k: string, list: string[]) => (list.includes(str(f, k)) ? str(f, k) : list[0]);
  const id = await db.createUser(env.DB, {
    name,
    role,
    career: pick("career", CAREERS),
    no_degree: f.get("no_degree") ? 1 : 0,
    goal,
    headline: str(f, "headline", 120),
    courses,
    school: str(f, "school", 120),
    availability: pick("availability", AVAILABILITY),
    format: pick("format", FORMATS),
    area: pick("area", AREAS),
    confidence: int(f, "confidence", 1, 10, 5),
    capacity: role === "mentor" ? int(f, "capacity", 1, 3, 2) : 0,
  });
  return redirect(role === "mentor" ? `/mentor/${id}` : `/matches/${id}`);
}

export async function mentorWelcome(env: Env, id: number): Promise<Response> {
  const u = await db.getUser(env.DB, id);
  if (!u || u.role !== "mentor") return notFound("Mentor");
  const mentees = await db.listMentees(env.DB);
  const fits = mentees
    .map((m) => ({ m, r: matchScore(m, u, 0) }))
    .filter((x) => x.r.courses.length || x.m.career === u.career)
    .sort((a, b) => b.r.score - a.r.score)
    .slice(0, 4);
  const body = `
<div class="notice">🔥 Welcome, ${esc(u.name)}! You're on the mentor list with room for ${u.capacity} mentee${u.capacity > 1 ? "s" : ""}.</div>
<h1>Mentees who could use your experience</h1>
<p class="muted">Based on the courses you listed: ${chips(u.courses.split(",").map((c) => c.trim()).filter(Boolean), "sage")}</p>
<div class="grid">${
    fits.length
      ? fits
          .map(
            (x) => `<div class="card"><h3>${esc(x.m.name)}</h3><p class="muted">${esc(x.m.headline)}</p><p>${esc(x.m.goal)}</p>${chips(x.r.reasons)}</div>`,
          )
          .join("")
      : `<div class="card"><p>No mentees match your courses yet. TechWomenAZ will reach out as new mentees join.</p></div>`
  }</div>
<p class="muted" style="margin-top:1rem">Mentees choose their mentor, so they'll reach out to you.</p>`;
  return html(layout("Welcome", body));
}

// ---------------------------------------------------------------- Matches
export async function matches(env: Env, menteeId: number): Promise<Response> {
  const mentee = await db.getUser(env.DB, menteeId);
  if (!mentee || mentee.role !== "mentee") return notFound("Mentee");
  const [mentors, already, myPairs, opps] = await Promise.all([
    db.listMentors(env.DB),
    db.mentorIdsForMentee(env.DB, menteeId),
    db.listMenteePairs(env.DB, menteeId),
    db.listOpportunities(env.DB),
  ]);
  const top = mentors
    .filter((m) => !already.has(m.id) && m.active_pairs < m.capacity)
    .map((m) => matchScore(mentee, m, m.active_pairs))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const oppFits = opps
    .map((o) => oppScore(mentee, o))
    .filter((o) => o.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const body = `
<h1>Hi ${esc(mentee.name.split(" ")[0])}, here are your top matches</h1>
<p class="muted">Ranked by career path, shared coursework, goals, schedule and format. You choose.</p>
<p>Your courses: ${chips(mentee.courses.split(",").map((c) => c.trim()).filter(Boolean), "sage")}</p>
${
  myPairs.length
    ? `<div class="notice">Your mentors: ${myPairs.map((p) => `<a href="/pair/${p.id}">${esc(p.mentor_name)} 🔥</a>`).join(" · ")}</div>`
    : ""
}
<div class="grid">${
    top.length
      ? top
          .map(
            (r, i) => `
  <div class="card" style="${i === 0 ? "border:2px solid var(--ember)" : ""}">
    <div class="row" style="justify-content:space-between"><h3 style="margin:0">${esc(r.mentor.name)}</h3><span class="score" aria-label="${r.score} percent match">${r.score}%</span></div>
    <p class="muted" style="margin:.2rem 0">${esc(r.mentor.headline)}</p>
    <p style="margin:.2rem 0;font-size:.9rem">🎓 ${esc(r.mentor.school)}</p>
    <div>${chips(r.reasons)}</div>
    <p class="why muted" data-mentor="${r.mentor.id}" style="font-style:italic;margin:.5rem 0"></p>
    <form method="post" action="/choose"><input type="hidden" name="mentee" value="${mentee.id}"><input type="hidden" name="mentor" value="${r.mentor.id}">
    <button class="btn" type="submit" style="width:100%;margin-top:.5rem">Choose ${esc(r.mentor.name.split(" ")[0])}</button></form>
  </div>`,
          )
          .join("")
      : `<div class="card"><p>No mentors have open spots right now. TechWomenAZ will match you by hand.</p></div>`
  }</div>

<h2 style="margin-top:2rem">Opportunities that fit your coursework</h2>
<div class="grid">${
    oppFits.length
      ? oppFits.map((o) => oppCard(o.opp, o.score, o.reasons, o.missing)).join("")
      : `<div class="card"><p class="muted">No postings fit yet. <a href="/opportunities">See all opportunities</a>.</p></div>`
  }</div>
<script>
document.querySelectorAll('.why').forEach(function(el){el.textContent='✨ Thinking about why you\'ll click…';
fetch('/api/why?mentee=${mentee.id}&mentor='+el.dataset.mentor).then(function(r){return r.json()}).then(function(d){el.textContent='✨ '+d.text}).catch(function(){el.textContent=''});});
</script>`;
  return html(layout("Your matches", body));
}

function oppCard(o: import("./logic").Opportunity, score?: number, reasons: string[] = [], missing: string[] = []): string {
  return `<div class="card">
  <div class="row" style="justify-content:space-between"><span class="chip plum">${esc(o.kind)}</span>${score !== undefined ? `<span class="score" style="font-size:1.2rem">${score}% fit</span>` : ""}</div>
  <h3 style="margin:.4rem 0 .1rem">${esc(o.title)}</h3>
  <p class="muted" style="margin:0">${esc(o.org)} · ${esc(o.format === "Online" ? "Remote" : o.area)}${o.deadline ? ` · apply by ${esc(o.deadline)}` : ""}</p>
  <p style="margin:.4rem 0">${esc(o.description)}</p>
  <div style="font-size:.85rem"><b>Wants:</b> ${esc(o.courses) || "No specific courses"}</div>
  ${reasons.length ? `<div style="margin-top:.4rem">${chips(reasons, "sage")}</div>` : ""}
  ${missing.length ? `<div class="muted" style="font-size:.85rem;margin-top:.3rem">To boost your fit: ${esc(missing.join(", "))}</div>` : ""}
  <div class="row" style="margin-top:.6rem"><a class="btn small ghost" href="/opportunities/${o.id}">See matched students</a>${/^https?:\/\//.test(o.link) ? `<a class="btn small" href="${esc(o.link)}" target="_blank" rel="noopener">Apply</a>` : ""}</div>
</div>`;
}

export async function choose(req: Request, env: Env): Promise<Response> {
  const f = await req.formData();
  const mentee = await db.getUser(env.DB, int(f, "mentee", 1, 1e9, 0));
  const mentor = await db.getUser(env.DB, int(f, "mentor", 1, 1e9, 0));
  if (!mentee || !mentor || mentee.role !== "mentee" || mentor.role !== "mentor") return notFound("Match");
  const milestones = (await ai.suggestMilestones(env, mentee, mentor)) ?? starterMilestones(mentee.career, mentee.goal);
  const pairId = await db.createPair(env.DB, mentor.id, mentee, milestones);
  return redirect(`/pair/${pairId}?new=1`);
}

// ---------------------------------------------------------------- Pair
export async function pairPage(env: Env, pairId: number, url: URL): Promise<Response> {
  const pair = await db.getPair(env.DB, pairId);
  if (!pair) return notFound("Pair");
  const [checkins, milestones] = await Promise.all([db.listCheckins(env.DB, pairId), db.listMilestones(env.DB, pairId)]);
  const flame = flameFor(checkins.map((c) => c.met_at), pair.created_at);
  const from = url.searchParams.get("from");
  const fromHeat = from !== null ? clamp(parseInt(from, 10) || 0, 0, 100) : null;
  const last = checkins[0];
  const conf = last ? last.confidence : pair.start_confidence;
  const doneCount = milestones.filter((m) => m.done).length;

  const body = `
${url.searchParams.get("new") ? `<div class="notice">🔥 It's a match! ${esc(pair.mentee_name)} and ${esc(pair.mentor_name)} are paired. Book your first 20 minutes.</div>` : ""}
${fromHeat !== null ? `<div class="notice">Meeting logged. Your flame grew from ${fromHeat} to ${flame.heat}. Keep it lit! 🔥</div>` : ""}
<div class="two" style="align-items:start">
  <div class="card" style="text-align:center">
    <h1 style="font-size:1.5rem">${esc(pair.mentee_name)} + ${esc(pair.mentor_name)}</h1>
    <p class="muted" style="margin:0">${esc(pair.career)} · ${esc(pair.mentor_headline)}</p>
    ${flameHtml(fromHeat !== null ? { ...flame, heat: fromHeat } : flame, 220, "bigFlame")}
    <p style="font-size:1.2rem;margin:.5rem 0">${statusHtml(flame.status)} · heat <b id="heatNum">${flame.heat}</b>/100</p>
    <p class="muted" style="margin:0">${flame.streak ? `🔥 ${flame.streak}-week streak · ` : ""}${flame.daysQuiet === 0 ? "Met today" : `${flame.daysQuiet} day${flame.daysQuiet > 1 ? "s" : ""} since last meeting`}</p>
    <p class="muted" style="margin:.3rem 0 0">Confidence: ${pair.start_confidence}/10 at start → <b>${conf}/10</b> now</p>
    <p class="muted" style="font-size:.85rem;margin-top:.6rem">Meet online or in a public place. Contact details stay private until both of you agree to share them.</p>
  </div>
  <div>
    <div class="card">
      <h2 style="font-size:1.2rem">🎯 Goal</h2><p style="margin-top:0">${esc(pair.goal)}</p>
      <h2 style="font-size:1.2rem">Milestones <span class="muted" style="font-size:.9rem">(${doneCount}/${milestones.length})</span></h2>
      ${milestones
        .map(
          (m) => `<form method="post" action="/pair/${pair.id}/milestone/${m.id}" class="milestone ${m.done ? "done" : ""}">
        <button class="btn small ${m.done ? "" : "ghost"}" type="submit" aria-label="${m.done ? "Mark not done" : "Mark done"}: ${esc(m.title)}">${m.done ? "✓" : "○"}</button><span>${esc(m.title)}</span></form>`,
        )
        .join("")}
      <button class="btn small ghost" style="margin-top:.8rem" onclick="spark(this)">✨ Spark my next meeting</button>
      <div id="agenda" style="margin-top:.6rem" aria-live="polite"></div>
    </div>
    <form class="card" style="margin-top:1rem" method="post" action="/pair/${pair.id}/log">
      <h2 style="font-size:1.2rem">Log a meeting</h2>
      <fieldset><legend>How did it go?</legend><div class="row">
        <label class="check"><input type="radio" name="rating" value="🔥" checked> 🔥 Great</label>
        <label class="check"><input type="radio" name="rating" value="🙂"> 🙂 Good</label>
        <label class="check"><input type="radio" name="rating" value="😐"> 😐 Meh</label></div></fieldset>
      <label for="takeaway">One takeaway</label><input id="takeaway" name="takeaway" maxlength="200" required placeholder="e.g. My portfolio needs a case study">
      <label for="next_step">One next step</label><input id="next_step" name="next_step" maxlength="200" required placeholder="e.g. Draft case study by Friday">
      <label for="conf">Confidence about your tech career now: <output id="cOut">${conf}</output>/10</label>
      <input id="conf" name="confidence" type="range" min="1" max="10" value="${conf}" oninput="cOut.value=this.value">
      <input type="hidden" name="from" value="${flame.heat}">
      <button class="btn" type="submit" style="margin-top:1rem;width:100%">Log it and grow the flame 🔥</button>
    </form>
  </div>
</div>
<script>
function spark(btn){btn.disabled=true;btn.textContent='✨ Writing your agenda…';
fetch('/api/agenda/${pair.id}',{method:'POST'}).then(function(r){return r.json()}).then(function(d){
var box=document.getElementById('agenda');box.innerHTML='<b>Next meeting agenda</b>';var ol=document.createElement('ol');
d.lines.forEach(function(l){var li=document.createElement('li');li.textContent=l;ol.appendChild(li)});box.appendChild(ol);
btn.textContent='✨ Spark another';btn.disabled=false;}).catch(function(){btn.disabled=false;btn.textContent='✨ Spark my next meeting';toast('Could not write the agenda. Try again.')});}
</script>
<div class="card" style="margin-top:1rem"><h2 style="font-size:1.2rem">Meeting history</h2>${
    checkins.length
      ? checkins
          .slice(0, 8)
          .map((c) => `<p style="margin:.3rem 0">${esc(c.rating)} <b>${new Date(c.met_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Phoenix" })}</b> · ${esc(c.takeaway)} <span class="muted">→ ${esc(c.next_step)}</span></p>`)
          .join("")
      : `<p class="muted">No meetings yet. Your first one lights the flame.</p>`
  }</div>
${
  fromHeat !== null
    ? `<script>
(function(){var f=document.getElementById('bigFlame');var target=${JSON.stringify(flameHtml(flame, 220).match(/--s:(\d+)px/)![1])};
setTimeout(function(){f.style.setProperty('--s',target+'px');f.className='flame ${flame.status}';},350);
for(var i=0;i<24;i++){var s=document.createElement('span');s.textContent='🔥';s.setAttribute('aria-hidden','true');
s.style.cssText='position:fixed;z-index:8;pointer-events:none;font-size:'+(16+Math.random()*22)+'px;left:'+(Math.random()*100)+'vw;top:100vh;transition:transform 1.8s ease-out,opacity 1.8s';
document.body.appendChild(s);(function(s){setTimeout(function(){s.style.transform='translateY(-'+(50+Math.random()*60)+'vh) rotate('+(Math.random()*90-45)+'deg)';s.style.opacity='0'},30);setTimeout(function(){s.remove()},2000)})(s);}})();
</script>`
    : ""
}`;
  return html(layout(`${pair.mentee_name} + ${pair.mentor_name}`, body));
}

export async function logMeeting(req: Request, env: Env, pairId: number): Promise<Response> {
  const pair = await db.getPair(env.DB, pairId);
  if (!pair) return notFound("Pair");
  const f = await req.formData();
  const rating = ["🔥", "🙂", "😐"].includes(str(f, "rating")) ? str(f, "rating") : "🙂";
  await db.addCheckin(env.DB, pairId, {
    rating,
    takeaway: str(f, "takeaway", 200),
    next_step: str(f, "next_step", 200),
    confidence: int(f, "confidence", 1, 10, 5),
  });
  return redirect(`/pair/${pairId}?from=${int(f, "from", 0, 100, 0)}`);
}

export async function milestone(env: Env, pairId: number, milestoneId: number): Promise<Response> {
  await db.toggleMilestone(env.DB, pairId, milestoneId);
  return redirect(`/pair/${pairId}`);
}

// ---------------------------------------------------------------- Campfire (admin)
export async function campfire(env: Env, url: URL): Promise<Response> {
  const [pairs, flames, nudges] = await Promise.all([db.listPairs(env.DB), flamesByPair(env), db.nudgeCounts(env.DB)]);
  const rows = pairs
    .map((p) => ({ p, ...flames.get(p.id)! }))
    .sort((a, b) => a.flame.heat - b.flame.heat);
  const n = rows.length || 1;
  const active = rows.filter((r) => r.flame.heat >= 40).length;
  const avgHeat = Math.round(rows.reduce((s, r) => s + r.flame.heat, 0) / n);
  const monthAgo = Date.now() - 30 * 86400000;
  const meetings30 = rows.reduce((s, r) => s + r.checkins.filter((c) => new Date(c.met_at).getTime() >= monthAgo).length, 0);
  const withData = rows.filter((r) => r.checkins.length);
  const before = withData.reduce((s, r) => s + r.p.start_confidence, 0) / (withData.length || 1);
  const after = withData.reduce((s, r) => s + r.checkins[0].confidence, 0) / (withData.length || 1);
  const attention = rows.filter((r) => r.flame.status === "Flickering" || r.flame.status === "Embers");

  const bar = (label: string, v: number, color: string) =>
    `<div style="margin:.35rem 0"><div class="row" style="justify-content:space-between"><span>${label}</span><b>${v.toFixed(1)}/10</b></div>
     <div style="background:#f1e7dc;border-radius:8px;height:16px" role="img" aria-label="${label} ${v.toFixed(1)} out of 10"><div style="width:${v * 10}%;height:100%;background:${color};border-radius:8px"></div></div></div>`;

  const body = `
${url.searchParams.get("reset") ? `<div class="notice">Demo data reset.</div>` : ""}
<div class="row" style="justify-content:space-between"><h1>🔥 The Campfire</h1>
<form method="post" action="/admin/reset" class="no-print" onsubmit="return confirm('Reset all demo data?')"><button class="btn small ghost" type="submit">Reset demo</button></form></div>
<p class="muted">Every mentor–mentee pair as a flame. Weakest first, so nobody slips through the cracks.</p>
<div class="stats">
  <div class="card stat"><b>${Math.round((100 * active) / n)}%</b>pairs active (Glowing or Blazing)</div>
  <div class="card stat"><b>${avgHeat}</b>average heat</div>
  <div class="card stat"><b>${meetings30}</b>meetings in the last 30 days</div>
  <div class="card stat"><b>${after - before >= 0 ? "+" : ""}${(after - before).toFixed(1)}</b>average confidence change since joining</div>
</div>
<div class="two" style="align-items:start">
  <div class="card"><h2 style="font-size:1.2rem">⚠️ Needs attention (${attention.length})</h2>${
    attention.length
      ? attention
          .map(
            (r) => `<div class="row" style="justify-content:space-between;border-bottom:1px dashed var(--line);padding:.5rem 0">
      <div><a href="/pair/${r.p.id}"><b>${esc(r.p.mentee_name)} + ${esc(r.p.mentor_name)}</b></a><br>${statusHtml(r.flame.status)} <span class="muted">· ${r.flame.daysQuiet} days quiet${nudges.get(r.p.id) ? ` · nudged ${nudges.get(r.p.id)}×` : ""}</span></div>
      <button class="btn small no-print" onclick="relight(${r.p.id},this)">Send relight nudge</button></div>`,
          )
          .join("")
      : `<p class="muted">Every flame is lit. 🎉</p>`
  }</div>
  <div class="card"><h2 style="font-size:1.2rem">Rise Report: before → after</h2>
    ${bar("Confidence when they joined", before, "#c9b8d9")}
    ${bar("Confidence after mentoring", after, "var(--ember)")}
    <p class="muted" style="font-size:.85rem">Combined numbers only, no names. ${withData.length} pairs with check-ins.</p>
    <div id="rise" aria-live="polite" style="white-space:pre-line;margin:.6rem 0"></div>
    <div class="row no-print"><button class="btn small" onclick="rise(this)">✨ Write Rise Report</button>
    <button class="btn small ghost" onclick="window.print()">Print Rise Report</button></div>
  </div>
</div>
<h2 style="margin-top:1.5rem">All flames</h2>
<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${rows
    .map(
      (r) => `<a class="card mini" href="/pair/${r.p.id}">${flameHtml(r.flame, 90)}
    <b style="text-align:center;margin-top:.3rem">${esc(r.p.mentee_name.split(" ")[0])} + ${esc(r.p.mentor_name.split(" ")[0])}</b>
    ${statusHtml(r.flame.status)}<span class="muted" style="font-size:.85rem">heat ${r.flame.heat}${r.flame.streak ? ` · ${r.flame.streak}wk streak` : ""}</span></a>`,
    )
    .join("")}</div>
<script>
function rise(btn){btn.disabled=true;btn.textContent='✨ Writing…';
fetch('/api/rise',{method:'POST'}).then(function(r){return r.json()}).then(function(d){document.getElementById('rise').textContent=d.text;btn.textContent='✨ Rewrite';btn.disabled=false;})
.catch(function(){btn.disabled=false;btn.textContent='✨ Write Rise Report';toast('Could not write the report. Try again.')});}
function relight(id,btn){btn.disabled=true;btn.textContent='Sending…';
fetch('/nudge/'+id,{method:'POST'}).then(function(r){return r.json()}).then(function(d){toast('🕯️ Nudge saved: "'+d.message+'"');btn.textContent='Nudged ✓';})
.catch(function(){toast('Could not send the nudge. Try again.');btn.disabled=false;btn.textContent='Send relight nudge';});}
</script>`;
  return html(layout("Campfire", body, "/campfire", "TechWomenAZ admin dashboard: every mentorship as a flame."));
}

export async function nudge(env: Env, pairId: number): Promise<Response> {
  const pair = await db.getPair(env.DB, pairId);
  if (!pair) return Response.json({ error: "not found" }, { status: 404 });
  const first = (s: string) => s.split(" ")[0];
  const message = `Hi ${first(pair.mentee_name)} and ${first(pair.mentor_name)}! Your flame is flickering 🕯️ A 15-minute call this week is enough to relight it. Next up: ${pair.goal}`;
  await db.addNudge(env.DB, pairId, message);
  return Response.json({ ok: true, message });
}

// ---------------------------------------------------------------- Opportunities
export async function opportunities(env: Env, url: URL): Promise<Response> {
  const [opps, mentees] = await Promise.all([db.listOpportunities(env.DB), db.listMentees(env.DB)]);
  const asId = parseInt(url.searchParams.get("as") ?? "", 10);
  const as = mentees.find((m) => m.id === asId);
  const cards = as
    ? opps
        .map((o) => oppScore(as, o))
        .sort((a, b) => b.score - a.score)
        .map((o) => oppCard(o.opp, o.score, o.reasons, o.missing))
    : opps.map((o) => oppCard(o));
  const body = `
${url.searchParams.get("posted") ? `<div class="notice">🔥 Posted! Ember is already matching it to students by coursework.</div>` : ""}
<div class="row" style="justify-content:space-between"><h1>Opportunities</h1><a class="btn" href="/opportunities/new">Post an opportunity</a></div>
<p class="muted">Internships, jobs and mentorship programs from TechWomenAZ partners. Each posting lists the coursework it wants, and Ember matches it to students who have taken those courses.</p>
<form method="get" class="row card" style="margin-bottom:1rem"><label for="as" style="margin:0">See fit for</label>
<select id="as" name="as" style="max-width:260px" onchange="this.form.submit()"><option value="">Everyone</option>${mentees
    .map((m) => `<option value="${m.id}"${m.id === asId ? " selected" : ""}>${esc(m.name)}</option>`)
    .join("")}</select><noscript><button class="btn small">Go</button></noscript></form>
<div class="grid">${cards.join("") || `<div class="card">No opportunities yet.</div>`}</div>`;
  return html(layout("Opportunities", body, "/opportunities"));
}

export function oppForm(): Response {
  const body = `
<h1>Post an opportunity</h1>
<p class="muted">Employers, partner orgs and mentors can post here. List the coursework you're looking for and Ember shows you the students who fit.</p>
<form method="post" action="/opportunities" class="card">
  <div class="two">
    <div><label for="kind">Type</label><select id="kind" name="kind">${options(OPP_KINDS)}</select></div>
    <div><label for="career">Career path</label><select id="career" name="career">${options(CAREERS.filter((c) => c !== "Not sure yet"))}</select></div>
    <div><label for="title">Title</label><input id="title" name="title" required maxlength="120" placeholder="e.g. Data Analyst Intern"></div>
    <div><label for="org">Organization</label><input id="org" name="org" required maxlength="120"></div>
  </div>
  <label for="courses">Coursework you're looking for</label>
  <input id="courses" name="courses" required maxlength="400" placeholder="Separate with commas: SQL Databases, Statistics, Python">
  <div class="two">
    <div><label for="format">Format</label><select id="format" name="format">${options(FORMATS, "Both")}</select></div>
    <div><label for="area">Area</label><select id="area" name="area">${options(AREAS)}</select></div>
    <div><label for="deadline">Apply by</label><input id="deadline" name="deadline" type="date"></div>
    <div><label for="link">Application link (optional)</label><input id="link" name="link" type="url" maxlength="300" placeholder="https://"></div>
  </div>
  <label for="description">Short description</label><textarea id="description" name="description" rows="3" maxlength="500"></textarea>
  <div style="margin-top:1rem"><button class="btn" type="submit">Post and see matched students</button></div>
</form>`;
  return html(layout("Post an opportunity", body, "/opportunities"));
}

export async function oppSubmit(req: Request, env: Env): Promise<Response> {
  const f = await req.formData();
  const pick = (k: string, list: string[]) => (list.includes(str(f, k)) ? str(f, k) : list[0]);
  const title = str(f, "title", 120);
  const org = str(f, "org", 120);
  if (!title || !org) return oppForm();
  const link = str(f, "link", 300);
  const id = await db.createOpportunity(env.DB, {
    kind: pick("kind", OPP_KINDS),
    title,
    org,
    career: pick("career", CAREERS),
    courses: str(f, "courses", 400),
    area: pick("area", AREAS),
    format: pick("format", FORMATS),
    description: str(f, "description", 500),
    link: /^https?:\/\//.test(link) ? link : "",
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(str(f, "deadline")) ? str(f, "deadline") : "",
  });
  return redirect(`/opportunities/${id}?posted=1`);
}

export async function oppDetail(env: Env, id: number, url: URL): Promise<Response> {
  const opps = await db.listOpportunities(env.DB);
  const o = opps.find((x) => x.id === id);
  if (!o) return notFound("Opportunity");
  const mentees = await db.listMentees(env.DB);
  const ranked = mentees
    .map((m: User) => ({ m, r: oppScore(m, o) }))
    .filter((x) => x.r.score >= 40)
    .sort((a, b) => b.r.score - a.r.score)
    .slice(0, 8);
  const body = `
${url.searchParams.get("posted") ? `<div class="notice">🔥 Posted! Here are the students whose coursework fits.</div>` : ""}
<p><a href="/opportunities">← All opportunities</a></p>
<div class="two" style="align-items:start">
  ${oppCard(o)}
  <div class="card"><h2 style="font-size:1.2rem">Best-fit students (${ranked.length})</h2>
  <p class="muted" style="font-size:.9rem">Ranked by coursework coverage, career path and location. TechWomenAZ shares the posting with them, not their contact details.</p>
  ${
    ranked.length
      ? ranked
          .map(
            (x) => `<div style="border-bottom:1px dashed var(--line);padding:.5rem 0"><div class="row" style="justify-content:space-between"><b>${esc(x.m.name)}</b><span class="score" style="font-size:1.1rem">${x.r.score}%</span></div>
      <span class="muted">${esc(x.m.headline)}</span><div>${chips(x.r.courses, "sage")}</div></div>`,
          )
          .join("")
      : `<p class="muted">No students match yet. They'll appear as people join.</p>`
  }</div>
</div>`;
  return html(layout(o.title, body, "/opportunities"));
}

// ---------------------------------------------------------------- AI JSON endpoints
export async function apiWhy(env: Env, url: URL): Promise<Response> {
  const mentee = await db.getUser(env.DB, parseInt(url.searchParams.get("mentee") ?? "", 10) || 0);
  const mentor = await db.getUser(env.DB, parseInt(url.searchParams.get("mentor") ?? "", 10) || 0);
  if (!mentee || !mentor) return Response.json({ error: "not found" }, { status: 404 });
  const r = await ai.whyClick(env, mentee, mentor, matchScore(mentee, mentor, 0).courses);
  return Response.json(r);
}

export async function apiAgenda(env: Env, pairId: number): Promise<Response> {
  const pair = await db.getPair(env.DB, pairId);
  if (!pair) return Response.json({ error: "not found" }, { status: 404 });
  const [checkins, milestones] = await Promise.all([db.listCheckins(env.DB, pairId), db.listMilestones(env.DB, pairId)]);
  const r = await ai.agenda(env, {
    mentee: pair.mentee_name,
    mentor: pair.mentor_name,
    goal: pair.goal,
    open: milestones.filter((m) => !m.done).map((m) => m.title),
    lastNext: checkins[0]?.next_step ?? null,
  });
  return Response.json(r);
}

export async function apiRise(env: Env): Promise<Response> {
  const [pairs, flames, milestones, mentees, opps] = await Promise.all([
    db.listPairs(env.DB),
    flamesByPair(env),
    db.listMilestones(env.DB),
    db.listMentees(env.DB),
    db.listOpportunities(env.DB),
  ]);
  const rows = pairs.map((p) => ({ p, ...flames.get(p.id)! }));
  const withData = rows.filter((r) => r.checkins.length);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const monthAgo = Date.now() - 30 * 86400000;
  const r = await ai.riseReport(env, {
    pairs: rows.length,
    activePct: Math.round((100 * rows.filter((r) => r.flame.heat >= 40).length) / (rows.length || 1)),
    meetings30: rows.reduce((s, r) => s + r.checkins.filter((c) => new Date(c.met_at).getTime() >= monthAgo).length, 0),
    before: avg(withData.map((r) => r.p.start_confidence)),
    after: avg(withData.map((r) => r.checkins[0].confidence)),
    milestonesDone: milestones.filter((m) => m.done).length,
    milestonesTotal: milestones.length,
    noDegreePct: Math.round((100 * mentees.filter((m) => m.no_degree).length) / (mentees.length || 1)),
    opportunities: opps.length,
  });
  return Response.json(r);
}
