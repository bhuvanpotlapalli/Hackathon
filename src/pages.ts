// Every page and form handler. Server-rendered HTML with a little inline JS.

import * as ai from "./ai";
import * as db from "./db";
import { oppCoursesBlock } from "./courses";
import { chatBlock, meetingsBlock } from "./social";
import type { Me } from "./auth";
import {
  AREAS,
  AVAILABILITY,
  CAREERS,
  ALL_PATHS,
  libraryFor,
  normCareer,
  FORMATS,
  OPP_KINDS,
  COURSE_LIBRARY,
  clamp,
  flameFor,
  sharedCourses,
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
export async function home(env: Env, user: Me | null): Promise<Response> {
  const start = user ? "/home" : "/signup";
  const body = `
<div class="story">
<div class="thread" aria-hidden="true"><i id="threadFill"></i></div>
<nav class="storynav" aria-label="Sections">${[["hero", "Start"], ["why", "Why"], ["match", "Match"], ["meet", "Meet"], ["learn", "Learn"], ["launch", "Launch"], ["go", "Join"]]
    .map(([id, n]) => `<a href="#${id}" data-to="${id}"><i></i><span>${n}</span></a>`)
    .join("")}</nav>

<section class="sx sx-hero" id="hero">
  <canvas class="embers" aria-hidden="true"></canvas>
  <div class="orb o1" aria-hidden="true"></div><div class="orb o2" aria-hidden="true"></div>
  <svg class="land" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true">
    <path class="ridge r1" d="M0 170 L120 120 L210 150 L320 80 L430 140 L520 110 L640 160 L760 90 L880 150 L990 100 L1100 140 L1200 115 L1200 300 L0 300Z"/>
    <path class="ridge r2" d="M0 230 L150 195 L300 222 L470 185 L620 225 L800 190 L960 222 L1200 195 L1200 300 L0 300Z"/>
  </svg>
  <div class="sx-in hero-grid">
    <div>
      <p class="eyebrow">TechWomenAZ mentorship</p>
      <h1 data-split>Mentorships that <span class="accent">don't fizzle out</span></h1>
      <p class="lede">Get matched with a mentor who took your classes. Meet, and your flame grows. Go quiet, and we notice.</p>
      <div class="row" style="margin-top:1.6rem">
        <a class="btn xl" href="${start}">${user ? "Go to my dashboard" : "Create an account"}</a>
        <a class="btn ghost xl onDark" href="${user ? "/account" : "/login"}">${user ? "My account" : "Sign in"}</a>
      </div>
    </div>
    <div class="app float" aria-hidden="true">
      <div class="bar"><i></i><i></i><i></i><span>Campfire · every pair, live</span></div>
      <div class="rows">
        <div class="r">${flameHtml({ heat: 82, status: "Blazing", daysQuiet: 0, streak: 6 }, 44)}<div><div class="nm">Meeting weekly</div><div class="sub">Portfolio review · Blazing</div></div><div class="meter"><b style="width:82%"></b></div></div>
        <div class="r">${flameHtml({ heat: 48, status: "Glowing", daysQuiet: 3, streak: 2 }, 44)}<div><div class="nm">Finding the rhythm</div><div class="sub">Mock interview · Glowing</div></div><div class="meter"><b style="width:48%"></b></div></div>
        <div class="r">${flameHtml({ heat: 12, status: "Embers", daysQuiet: 12, streak: 0 }, 44)}<div><div class="nm">Gone quiet</div><div class="sub">Needs a nudge · Embers</div></div><div class="meter"><b style="width:12%"></b></div></div>
      </div>
    </div>
  </div>
  <a class="cue" href="#why" aria-label="Scroll to Why"><span></span></a>
</section>

<section class="sx sx-why scene" id="why">
  <div class="sx-in">
    <p class="eyebrow">Why</p>
    <h2 class="statement"><span class="reveal-words">Most mentorships don't fail.</span> <span class="reveal-words dim">They fizzle.</span></h2>
    <div class="why-grid">
      <div class="why-card"><b>01</b><h3>Wrong match</h3><p>Paired by job title, not by the classes you're stuck in.</p><em>We match on shared coursework.</em></div>
      <div class="why-card"><b>02</b><h3>No rhythm</h3><p>One great coffee chat, then silence.</p><em>A flame that grows when you meet.</em></div>
      <div class="why-card"><b>03</b><h3>No next step</h3><p>Advice with no path to a real role.</p><em>Courses and openings that fit.</em></div>
    </div>
  </div>
</section>

<section class="sx sx-light scene s-match" id="match">
  <div class="sx-in">
    <p class="eyebrow">01 · Match</p>
    <h2 class="big">Match</h2>
    <p class="line">Someone who took your classes.</p>
    <div class="matchbox" aria-hidden="true">
      <div class="pcard left"><i class="av">You</i><b>Mentee</b><small>Career changer</small></div>
      <div class="links"><div class="pct">85%</div><span>User Research</span><span>HCI</span></div>
      <div class="pcard right"><i class="av av2">M</i><b>Mentor</b><small>UX Designer</small></div>
    </div>
  </div>
</section>

<section class="sx sx-dark scene s-meet" id="meet">
  <div class="glow" id="meetGlow" aria-hidden="true"></div>
  <div class="sx-in">
    <p class="eyebrow">02 · Meet</p>
    <h2 class="big">Meet</h2>
    <p class="line">Every meeting feeds the fire. Keep scrolling.</p>
    <div class="bigfire" id="scrollFire">${flameHtml({ heat: 10, status: "Flickering", daysQuiet: 0, streak: 0 }, 240)}</div>
    <div class="heatread"><b id="heatNum2">10</b><span>heat</span></div>
  </div>
</section>

<section class="sx sx-light scene s-learn" id="learn">
  <div class="sx-in">
    <p class="eyebrow">03 · Learn</p>
    <h2 class="big">Learn</h2>
    <p class="line">Courses from mentors and employers, filtered to your goal.</p>
    <div class="tagcloud" aria-hidden="true">${["#user research", "#sql databases", "#network security", "#figma", "#java", "#statistics", "#cad modeling", "#circuit analysis", "#linux administration", "#interview prep"]
      .map((t, i) => `<a href="/courses?tag=${encodeURIComponent(t.slice(1))}" style="--i:${i}">${t}</a>`)
      .join("")}</div>
    <a class="btn ghost" href="/courses" style="margin-top:1.4rem">Browse courses</a>
  </div>
</section>

<section class="sx sx-dark scene s-launch" id="launch">
  <div class="sx-in">
    <p class="eyebrow">04 · Launch</p>
    <h2 class="big">Launch</h2>
    <p class="line">Openings that fit your classes.</p>
    <div class="fan" aria-hidden="true">
      <div class="ocard"><small>Internship</small><b>UX Design Intern</b><em>80% fit</em></div>
      <div class="ocard"><small>Job</small><b>Junior SOC Analyst</b><em>90% fit</em></div>
      <div class="ocard"><small>Internship</small><b>Data Analyst Intern</b><em>100% fit</em></div>
    </div>
    <a class="btn ghost onDark" href="/opportunities" style="margin-top:1rem">See opportunities</a>
  </div>
</section>

<section class="sx sx-go scene s-go" id="go">
  <div class="orb o3" aria-hidden="true"></div>
  <div class="sx-in">
    <h2 class="big">Your turn.</h2>
    <div class="row" style="justify-content:center;margin-top:1.4rem">
      <a class="btn xl" href="${start}">${user ? "Go to my dashboard" : "Create an account"}</a>
      <a class="btn ghost xl onDark" href="/courses">Browse courses</a>
    </div>
    <p class="muted" style="margin-top:1rem;text-align:center">Mentors are volunteers from Arizona tech teams. Everything you share stays inside the program.</p>
  </div>
</section>
</div>
<script>
(function(){
  var still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scenes=document.querySelectorAll('.scene');
  if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)e.target.classList.add('on')})},{threshold:.3});scenes.forEach(function(s){io.observe(s)})}
  else scenes.forEach(function(s){s.classList.add('on')});
  // Section nav: highlight the section in view.
  var secs=[].slice.call(document.querySelectorAll('.sx')),links=document.querySelectorAll('.storynav a');
  // Scroll-driven: the thread fills, the fire grows in Meet, every section parallaxes a little.
  var fill=document.getElementById('threadFill'),sec=document.getElementById('meet'),f=document.querySelector('#scrollFire .flame'),num=document.getElementById('heatNum2'),glow=document.getElementById('meetGlow'),tick=false;
  var story=document.querySelector('.story');
  function upd(){tick=false;var vh=innerHeight,sh=story.scrollHeight-vh,k0=Math.max(0,Math.min(1,(scrollY-story.offsetTop)/Math.max(1,sh)));fill.style.transform='scaleY('+k0+')';
    var cur=0;secs.forEach(function(s,i){var r=s.getBoundingClientRect();if(r.top<vh*.5)cur=i;
      if(!still){var c=s.querySelector('.sx-in');var d=(r.top+r.height/2-vh/2)/vh;c.style.transform='translateY('+(d*-40).toFixed(1)+'px)';c.style.opacity=Math.max(.15,1-Math.abs(d)*0.9).toFixed(2)}});
    links.forEach(function(a,i){a.classList.toggle('on',i===cur);a.classList.toggle('seen',i<cur)});document.body.dataset.sx=secs[cur].id;
    var r=sec.getBoundingClientRect(),k=Math.max(0,Math.min(1,(vh-r.top)/(vh+r.height*.4)));
    var heat=Math.round(10+90*k);f.style.setProperty('--s',Math.round(240*(.28+.72*heat/100))+'px');f.className='flame '+(heat>=70?'Blazing':heat>=40?'Glowing':heat>=15?'Flickering':'Embers');num.textContent=heat;
    glow.style.opacity=(0.15+0.85*k).toFixed(2);glow.style.transform='scale('+(0.6+0.7*k).toFixed(2)+')';}
  addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(upd)}},{passive:true});addEventListener('resize',upd);upd();
  // Drifting embers in the hero background.
  var cv=document.querySelector('.embers');if(cv&&!still){var cx=cv.getContext('2d'),ps=[],W,H;
    function size(){W=cv.width=cv.offsetWidth*devicePixelRatio;H=cv.height=cv.offsetHeight*devicePixelRatio}size();addEventListener('resize',size);
    for(var n=0;n<55;n++)ps.push({x:Math.random(),y:Math.random(),r:Math.random()*2+.6,v:Math.random()*.0012+.0004,w:Math.random()*6.28});
    (function draw(t){cx.clearRect(0,0,W,H);ps.forEach(function(p){p.y-=p.v;if(p.y<-.05){p.y=1.05;p.x=Math.random()}var x=(p.x+Math.sin(t/1700+p.w)*.015)*W,y=p.y*H,a=Math.min(1,p.y*1.4)*.8;
      cx.beginPath();cx.arc(x,y,p.r*devicePixelRatio,0,6.28);cx.fillStyle='rgba(255,'+(140+Math.round(p.w*15))+',60,'+a.toFixed(2)+')';cx.shadowBlur=12;cx.shadowColor='#ff8a3d';cx.fill()});
      if(document.visibilityState!=='hidden')requestAnimationFrame(draw);else setTimeout(function(){requestAnimationFrame(draw)},500)})(0)}
})();
</script>`;
  return html(layout("Home", body, "/"));
}

// ---------------------------------------------------------------- Dashboard
export async function dashboard(env: Env, user: Me): Promise<Response> {
  const admin = user.role === "admin";
  const { results: pairs } = await env.DB.prepare(
    `SELECT p.id, p.goal, p.created_at, p.mentor_id, p.mentee_id, mu.name AS mentor_name, eu.name AS mentee_name
     FROM pairs p JOIN users mu ON mu.id = p.mentor_id JOIN users eu ON eu.id = p.mentee_id
     WHERE p.active = 1${admin ? "" : " AND (p.mentor_id = ? OR p.mentee_id = ?)"} ORDER BY p.id`,
  )
    .bind(...(admin ? [] : [user.userId, user.userId]))
    .all<{ id: number; goal: string; created_at: string; mentor_id: number; mentee_id: number; mentor_name: string; mentee_name: string }>();
  const { results: checkins } = await env.DB.prepare(`SELECT pair_id, met_at FROM checkins ORDER BY met_at DESC`).all<{ pair_id: number; met_at: string }>();
  const byPair = new Map<number, string[]>();
  for (const c of checkins) byPair.set(c.pair_id, [...(byPair.get(c.pair_id) ?? []), c.met_at]);
  const rows = pairs.map((p) => ({ p, flame: flameFor(byPair.get(p.id) ?? [], p.created_at) }));
  const roleLabel = admin ? "Program admin" : user.role === "mentor" ? "Mentor" : "Mentee";
  const body = `
<div class="banner"><h1>Hi ${esc(user.name.split(" ")[0])}</h1>
<p>${roleLabel} · <a href="/profile/${user.userId}" style="color:#fff">edit your profile</a> · <a href="/account" style="color:#fff">account</a></p></div>
<div class="grid">
  ${user.profileRole === "mentor" ? `<a class="card" href="/mentor/${user.userId}"><h3>Mentees who fit</h3><p class="muted">People whose courses you've been through.</p></a>` : `<a class="card" href="/matches/${user.userId}"><h3>Your matches</h3><p class="muted">Mentors ranked by the courses you share.</p></a>`}
  <a class="card" href="/messages"><h3>Messages</h3><p class="muted">Talk to your mentor, mentee or the program team.</p></a>
  <a class="card" href="/calendar"><h3>Calendar</h3><p class="muted">Book and review meetings.</p></a>
  ${admin ? `<a class="card" href="/campfire"><h3>Campfire</h3><p class="muted">Every pair's flame, retention and the Rise Report.</p></a><a class="card" href="/admin/accounts"><h3>Accounts</h3><p class="muted">Members, admins and password resets.</p></a>` : ``}
</div>
<h2 style="margin-top:1.6rem">${admin ? "Every pair" : "Your pairs"}</h2>
${
  rows.length
    ? `<div class="grid">${rows
        .map(
          (r) => `<a class="card mini" href="/pair/${r.p.id}" style="padding:1rem">${flameHtml(r.flame, 90)}
      <b style="text-align:center;margin-top:.3rem">${esc(r.p.mentee_name.split(" ")[0])} + ${esc(r.p.mentor_name.split(" ")[0])}</b>
      ${statusHtml(r.flame.status)}<span class="muted" style="font-size:.85rem">heat ${r.flame.heat}${r.flame.streak ? ` · ${r.flame.streak}wk streak` : ""}</span></a>`,
        )
        .join("")}</div>`
    : `<div class="card"><p class="muted">${user.profileRole === "mentor" ? "You don't have a mentee pair yet. When a mentee chooses you, the pair appears here." : "You don't have a mentor yet. Open your matches and choose one."}</p>
    <a class="btn" href="${user.profileRole === "mentor" ? `/profile/${user.userId}` : `/matches/${user.userId}`}">${user.profileRole === "mentor" ? "Update my profile" : "See my matches"}</a></div>`
}`;
  return html(layout("Your dashboard", body, "/home"));
}

// ---------------------------------------------------------------- Join
export async function mentorWelcome(env: Env, id: number, _user: Me): Promise<Response> {
  const u = await db.getUser(env.DB, id);
  if (!u || u.role !== "mentor") return notFound("Mentor");
  const mentees = await db.listMentees(env.DB);
  const fits = mentees
    .map((m) => ({ m, r: matchScore(m, u, 0) }))
    .filter((x) => x.r.courses.length || x.m.career === u.career)
    .sort((a, b) => b.r.score - a.r.score)
    .slice(0, 4);
  const body = `
<div class="notice"><a style="float:right" href="/profile/${u.id}">Edit my profile</a>Welcome, ${esc(u.name)}. You're on the mentor list with room for ${u.capacity} mentee${u.capacity > 1 ? "s" : ""}.</div>
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
export async function matches(env: Env, menteeId: number, url: URL, _user: Me): Promise<Response> {
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
  // Curated courses for the mentee's path they haven't taken yet, and which mentors took each one.
  const taken = sharedCourses(libraryFor(mentee.career).join(", "), mentee.courses);
  const nextCourses = libraryFor(mentee.career)
    .filter((c) => !taken.includes(c))
    .slice(0, 5)
    .map((course) => ({ course, mentors: mentors.filter((m) => sharedCourses(course, m.courses).length).map((m) => m.name.split(" ")[0]) }));
  const oppFits = opps
    .map((o) => oppScore(mentee, o))
    .filter((o) => o.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const body = `
${url.searchParams.get("new") ? `<div class="notice">You're in, ${esc(mentee.name.split(" ")[0])}. ember found these mentors from your courses and goal.</div>` : ""}
<div class="banner"><a class="btn small ghost onDark" style="float:right;position:relative;z-index:1" href="/profile/${mentee.id}">My profile</a><h1>${myPairs.length ? `Add another mentor, ${esc(mentee.name.split(" ")[0])}` : `Hi ${esc(mentee.name.split(" ")[0])}, here are your top matches`}</h1>
<p>Ranked by shared courses, goals and schedule. You pick.</p></div>
<p>Your courses: ${chips(mentee.courses.split(",").map((c) => c.trim()).filter(Boolean), "sage")}</p>
${
  myPairs.length
    ? `<div class="notice">Your current mentor${myPairs.length > 1 ? "s" : ""}: ${myPairs.map((p) => `<a href="/pair/${p.id}">${esc(p.mentor_name)} (open your pair page)</a>`).join(" · ")}</div>`
    : ""
}
<div class="grid">${
    top.length
      ? top
          .map(
            (r, i) => `
  <div class="card${i === 0 ? " topmatch" : ""}">${i === 0 ? `<span class="badge">Best match</span>` : ""}
    <div class="row" style="justify-content:space-between;flex-wrap:nowrap"><h3 style="margin:0">${esc(r.mentor.name)}</h3><div class="ring" data-p="${r.score}" role="img" aria-label="${r.score} percent match"><b>${r.score}%</b></div></div>
    <p class="muted" style="margin:.2rem 0">${esc(r.mentor.headline)}</p>
    <p class="muted" style="margin:.2rem 0;font-size:.88rem">${esc(r.mentor.school)}</p>
    <div>${chips(r.reasons)}</div>
    <div class="row" style="margin-top:.4rem"><a class="btn small ghost" href="/profile/${r.mentor.id}">Profile</a><a class="btn small ghost" href="/messages/u:${r.mentor.id}">Message</a></div>
    <p class="why muted" data-mentor="${r.mentor.id}" style="font-style:italic;margin:.5rem 0"></p>
    <form method="post" action="/choose"><input type="hidden" name="mentee" value="${mentee.id}"><input type="hidden" name="mentor" value="${r.mentor.id}">
    <button class="btn" type="submit" style="width:100%;margin-top:.5rem">Choose ${esc(r.mentor.name.split(" ")[0])}</button></form>
  </div>`,
          )
          .join("")
      : `<div class="card"><p>No mentors have open spots right now. TechWomenAZ will match you by hand.</p></div>`
  }</div>

<h2 style="margin-top:2rem">Courses to take next for ${esc(mentee.career)}</h2>
<div class="card">${nextCourses.length ? nextCourses.map((c) => `<div class="course-row"><span><b>${esc(c.course)}</b></span><span class="muted" style="font-size:.88rem;text-align:right">${c.mentors.length ? `${esc(c.mentors.slice(0, 2).join(", "))} took this` : "Recommended by TechWomenAZ mentors"}</span></div>`).join("") : `<p class="muted">You've covered the core courses for this path.</p>`}</div>

<h2 style="margin-top:2rem">Opportunities that fit your coursework</h2>
<div class="grid">${
    oppFits.length
      ? oppFits.map((o) => oppCard(o.opp, o.score, o.reasons, o.missing)).join("")
      : `<div class="card"><p class="muted">No postings fit yet. <a href="/opportunities">See all opportunities</a>.</p></div>`
  }</div>
<script>
document.querySelectorAll('.why').forEach(function(el){el.textContent='Writing why you’ll click…';
fetch('/api/why?mentee=${mentee.id}&mentor='+el.dataset.mentor).then(function(r){return r.json()}).then(function(d){el.textContent=d.text}).catch(function(){el.textContent=''});});
</script>`;
  return html(layout("Your matches", body));
}

function oppCard(o: import("./logic").Opportunity, score?: number, reasons: string[] = [], missing: string[] = []): string {
  return `<div class="card">
  <div class="row" style="justify-content:space-between"><span class="chip plum">${esc(o.kind)}</span>${score !== undefined ? `<span class="score" style="font-size:1.2rem">${score}% fit</span>` : ""}</div>
  <h3 style="margin:.4rem 0 .1rem">${esc(o.title)}</h3>
  <p class="muted" style="margin:0"><a href="/org?name=${encodeURIComponent(o.org)}">${esc(o.org)}</a> · ${esc(o.format === "Online" ? "Remote" : o.area)}${o.deadline ? ` · apply by ${esc(o.deadline)}` : ""}</p>
  <p style="margin:.4rem 0">${esc(o.description)}</p>
  <div style="font-size:.85rem"><b>Wants:</b> ${esc(o.courses) || "No specific courses"}</div>
  ${reasons.length ? `<div style="margin-top:.4rem">${chips(reasons, "sage")}</div>` : ""}
  ${missing.length ? `<div class="muted" style="font-size:.85rem;margin-top:.3rem">To boost your fit: ${esc(missing.join(", "))}</div>` : ""}
  <div class="row" style="margin-top:.6rem"><a class="btn small ghost" href="/opportunities/${o.id}">Students and courses</a>${/^https?:\/\//.test(o.link) ? `<a class="btn small" href="${esc(o.link)}" target="_blank" rel="noopener">Apply</a>` : ""}</div>
</div>`;
}

export async function choose(req: Request, env: Env, user: Me): Promise<Response> {
  const f = await req.formData();
  const mentee = await db.getUser(env.DB, int(f, "mentee", 1, 1e9, 0));
  const mentor = await db.getUser(env.DB, int(f, "mentor", 1, 1e9, 0));
  if (!mentee || mentee.id !== user.userId) return redirect("/home");
  if (!mentee || !mentor || mentee.role !== "mentee" || mentor.role !== "mentor") return notFound("Match");
  // One pair per mentor: choosing the same mentor again opens the existing pair.
  const existing = await env.DB.prepare(`SELECT id FROM pairs WHERE mentor_id = ? AND mentee_id = ? AND active = 1`)
    .bind(mentor.id, mentee.id)
    .first<{ id: number }>();
  if (existing) return redirect(`/pair/${existing.id}`);
  // Respect the mentor's own capacity even if the form is submitted directly.
  const load = await env.DB.prepare(`SELECT COUNT(*) AS n FROM pairs WHERE mentor_id = ? AND active = 1`).bind(mentor.id).first<{ n: number }>();
  if ((load?.n ?? 0) >= mentor.capacity) return redirect(`/matches/${mentee.id}?full=1`);
  const milestones = (await ai.suggestMilestones(env, mentee, mentor)) ?? starterMilestones(mentee.career, mentee.goal);
  const pairId = await db.createPair(env.DB, mentor.id, mentee, milestones);
  return redirect(`/pair/${pairId}?new=1`);
}

// ---------------------------------------------------------------- Pair
export async function pairPage(env: Env, pairId: number, url: URL, user: Me): Promise<Response> {
  const pair = await db.getPair(env.DB, pairId);
  if (!pair) return notFound("Pair");
  const [checkins, milestones, lastNudge] = await Promise.all([
    db.listCheckins(env.DB, pairId),
    db.listMilestones(env.DB, pairId),
    env.DB.prepare(`SELECT message, created_at FROM nudges WHERE pair_id = ? ORDER BY id DESC LIMIT 1`)
      .bind(pairId)
      .first<{ message: string; created_at: string }>(),
  ]);
  const flame = flameFor(checkins.map((c) => c.met_at), pair.created_at);
  const from = url.searchParams.get("from");
  const fromHeat = from !== null ? clamp(parseInt(from, 10) || 0, 0, 100) : null;
  const last = checkins[0];
  const conf = last ? last.confidence : pair.start_confidence;
  const doneCount = milestones.filter((m) => m.done).length;

  const body = `
${url.searchParams.get("new") ? `<div class="notice">It's a match. ${esc(pair.mentee_name)} and ${esc(pair.mentor_name)} are paired. Book your first 20 minutes.</div>` : ""}
${url.searchParams.get("scheduled") ? `<div class="notice">Meeting scheduled. Add it to your calendar below.</div>` : ""}${url.searchParams.get("cancelled") ? `<div class="notice">Meeting cancelled.</div>` : ""}
${fromHeat !== null ? `<div class="notice">Meeting logged. Your flame grew from ${fromHeat} to ${flame.heat}.</div>` : ""}
${lastNudge ? `<div class="notice">🕯️ <b>From the program team:</b> ${esc(lastNudge.message)} <span class="muted">· ${esc(new Date(lastNudge.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Phoenix" }))}</span></div>` : ""}
<div class="two" style="align-items:start">
  <div class="card" style="text-align:center">
    <h1 style="font-size:1.5rem"><a class="clink" href="/profile/${pair.mentee_id}">${esc(pair.mentee_name)}</a> + <a class="clink" href="/profile/${pair.mentor_id}">${esc(pair.mentor_name)}</a></h1>
    <p class="muted" style="margin:0">${esc(pair.career)} · ${esc(pair.mentor_headline)}</p>
    ${flameHtml(fromHeat !== null ? { ...flame, heat: fromHeat } : flame, 220, "bigFlame")}
    <p style="font-size:1.2rem;margin:.5rem 0">${statusHtml(flame.status)} · heat <b id="heatNum">${flame.heat}</b>/100</p>
    <p class="muted" style="margin:0">${flame.streak ? `${flame.streak}-week streak · ` : ""}${flame.daysQuiet === 0 ? "Met today" : `${flame.daysQuiet} day${flame.daysQuiet > 1 ? "s" : ""} since last meeting`}</p>
    <p class="muted" style="margin:.3rem 0 0">Confidence: ${pair.start_confidence}/10 at start → <b>${conf}/10</b> now</p>
    <p class="muted" style="font-size:.85rem;margin-top:.6rem">Meet online or in a public place. Contact details stay private until both of you agree to share them.</p>
  </div>
  <div>
    <div class="card">
      <h2 style="font-size:1.2rem">Goal</h2><p style="margin-top:0">${esc(pair.goal)}</p>
      <h2 style="font-size:1.2rem">Milestones <span class="muted" style="font-size:.9rem">(${doneCount}/${milestones.length})</span></h2>
      ${milestones
        .map(
          (m) => `<form method="post" action="/pair/${pair.id}/milestone/${m.id}" class="milestone ${m.done ? "done" : ""}">
        <button class="btn small ${m.done ? "" : "ghost"}" type="submit" aria-label="${m.done ? "Mark not done" : "Mark done"}: ${esc(m.title)}">${m.done ? "✓" : "○"}</button><span>${esc(m.title)}</span></form>`,
        )
        .join("")}
      <button class="btn small ghost" style="margin-top:.8rem" onclick="spark(this)">Write my next meeting agenda</button>
      <a class="btn small ghost" style="margin-top:.8rem" href="/courses/personal?mentor=${pair.mentor_id}&mentee=${pair.mentee_id}">Build a course for ${esc(pair.mentee_name.split(" ")[0])} with ember</a>
      <div id="agenda" style="margin-top:.6rem" aria-live="polite"></div>
    </div>
    ${chatBlock(pair, user)}
    ${await meetingsBlock(env, pair.id)}
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
      <button class="btn" type="submit" style="margin-top:1rem;width:100%">Log meeting</button>
    </form>
  </div>
</div>
<script>
function spark(btn){btn.disabled=true;btn.textContent='Writing your agenda…';
fetch('/api/agenda/${pair.id}',{method:'POST'}).then(function(r){return r.json()}).then(function(d){
var box=document.getElementById('agenda');box.innerHTML='<b>Next meeting agenda</b>';var ol=document.createElement('ol');
d.lines.forEach(function(l){var li=document.createElement('li');li.textContent=l;ol.appendChild(li)});box.appendChild(ol);
btn.textContent='Write another';btn.disabled=false;}).catch(function(){btn.disabled=false;btn.textContent='Write my next meeting agenda';toast('Could not write the agenda. Try again.')});}
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

  // Retention: weekly meetings and share of pairs that met each week (last 8 weeks).
  const DAY = 86400000;
  const now = Date.now();
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = now - (7 - i) * 7 * DAY;
    const start = end - 7 * DAY;
    const existing = rows.filter((r) => new Date(r.p.created_at).getTime() < end);
    const met = existing.filter((r) => r.checkins.some((c) => { const t = new Date(c.met_at).getTime(); return t >= start && t < end; }));
    const count = rows.reduce((s, r) => s + r.checkins.filter((c) => { const t = new Date(c.met_at).getTime(); return t >= start && t < end; }).length, 0);
    const d = new Date(start);
    return { label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`, meetings: count, pct: existing.length ? Math.round((100 * met.length) / existing.length) : 0 };
  });
  const older = rows.filter((r) => now - new Date(r.p.created_at).getTime() > 21 * DAY);
  const retained = older.filter((r) => r.flame.daysQuiet <= 21);
  const retention = older.length ? Math.round((100 * retained.length) / older.length) : null;
  const churned = rows.filter((r) => r.flame.daysQuiet > 28).length;
  const newPairs = rows.filter((r) => now - new Date(r.p.created_at).getTime() <= 30 * DAY).length;
  const maxM = Math.max(1, ...weeks.map((w) => w.meetings));
  const W = 640, H = 200, bw = W / weeks.length;
  const chart = `<svg class="retchart" viewBox="0 0 ${W} ${H + 30}" role="img" aria-label="Meetings per week and share of pairs that met, last 8 weeks">
    ${weeks.map((w, i) => `<rect class="rb" x="${i * bw + bw * 0.2}" y="${H - (w.meetings / maxM) * (H - 20)}" width="${bw * 0.6}" height="${(w.meetings / maxM) * (H - 20)}" rx="6" style="animation-delay:${i * 60}ms"><title>${w.label}: ${w.meetings} meetings</title></rect>
    <text x="${i * bw + bw / 2}" y="${H + 20}" text-anchor="middle" class="rl">${w.label}</text>`).join("")}
    <polyline class="rline" fill="none" points="${weeks.map((w, i) => `${i * bw + bw / 2},${H - (w.pct / 100) * (H - 20)}`).join(" ")}"/>
    ${weeks.map((w, i) => `<circle class="rdot" cx="${i * bw + bw / 2}" cy="${H - (w.pct / 100) * (H - 20)}" r="5"><title>${w.label}: ${w.pct}% of pairs met</title></circle>`).join("")}
  </svg>`;

  const bar = (label: string, v: number, color: string) =>
    `<div style="margin:.35rem 0"><div class="row" style="justify-content:space-between"><span>${label}</span><b>${v.toFixed(1)}/10</b></div>
     <div style="background:#f1e7dc;border-radius:8px;height:16px" role="img" aria-label="${label} ${v.toFixed(1)} out of 10"><div class="barfill" style="width:${v * 10}%;height:100%;background:${color};border-radius:8px"></div></div></div>`;

  const body = `
<div class="banner"><div class="row" style="justify-content:space-between;position:relative;z-index:1"><h1>Admin · Campfire</h1><a class="btn small ghost onDark" href="/admin/accounts">Accounts</a></div>
<p>Retention across the program, and every pair, quietest first.</p></div>
<div class="stats">
  <div class="card stat"><b data-count="${Math.round((100 * active) / n)}" data-suffix="%">${Math.round((100 * active) / n)}%</b>pairs active (Glowing or Blazing)</div>
  <div class="card stat"><b data-count="${avgHeat}">${avgHeat}</b>average heat</div>
  <div class="card stat"><b data-count="${meetings30}">${meetings30}</b>meetings in the last 30 days</div>
  <div class="card stat"><b data-count="${Math.abs(after - before).toFixed(1)}" data-prefix="${after - before >= 0 ? "+" : "−"}">${after - before >= 0 ? "+" : ""}${(after - before).toFixed(1)}</b>average confidence change since joining</div>
</div>
<div class="card retention" style="margin-bottom:1rem">
  <div class="row" style="justify-content:space-between"><h2 style="font-size:1.2rem;margin:0">Retention</h2><span class="muted" style="font-size:.85rem"><span class="key kb"></span>meetings per week <span class="key kl"></span>% of pairs that met</span></div>
  <div class="stats" style="margin:.8rem 0">
    <div class="stat">${retention === null ? `<b>—</b>retention (no pairs over 3 weeks old yet)` : `<b data-count="${retention}" data-suffix="%">${retention}%</b>retention (pairs over 3 weeks old that met in the last 3 weeks)`}</div>
    <div class="stat"><b data-count="${churned}">${churned}</b>churned (quiet over 4 weeks)</div>
    <div class="stat"><b data-count="${newPairs}">${newPairs}</b>new pairs in 30 days</div>
    <div class="stat"><b data-count="${weeks[weeks.length - 1].pct}" data-suffix="%">${weeks[weeks.length - 1].pct}%</b>of pairs met this week</div>
  </div>
  ${chart}
</div>
<div class="two" style="align-items:start">
  <div class="card"><h2 style="font-size:1.2rem">Needs attention <span class="muted">(${attention.length})</span></h2>${
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
    <div class="row no-print"><button class="btn small" onclick="rise(this)">Write Rise Report</button>
    <button class="btn small ghost" onclick="window.print()">Print Rise Report</button></div>
  </div>
</div>
<h2 style="margin-top:1.5rem">All flames</h2>
<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${rows
    .map(
      (r) => `<a class="card mini${r.flame.heat >= 70 ? " st-hot" : ""}" href="/pair/${r.p.id}">${flameHtml(r.flame, 90)}
    <b style="text-align:center;margin-top:.3rem">${esc(r.p.mentee_name.split(" ")[0])} + ${esc(r.p.mentor_name.split(" ")[0])}</b>
    ${statusHtml(r.flame.status)}<span class="muted" style="font-size:.85rem">heat ${r.flame.heat}${r.flame.streak ? ` · ${r.flame.streak}wk streak` : ""}</span></a>`,
    )
    .join("")}</div>
<script>
function rise(btn){btn.disabled=true;btn.textContent='Writing…';
fetch('/api/rise',{method:'POST'}).then(function(r){return r.json()}).then(function(d){document.getElementById('rise').textContent=d.text;btn.textContent='Rewrite';btn.disabled=false;})
.catch(function(){btn.disabled=false;btn.textContent='Write Rise Report';toast('Could not write the report. Try again.')});}
function relight(id,btn){btn.disabled=true;btn.textContent='Sending…';
fetch('/nudge/'+id,{method:'POST'}).then(function(r){return r.json()}).then(function(d){toast('🕯️ Nudge sent: "'+d.message+'"');btn.textContent='Nudged ✓';})
.catch(function(){toast('Could not send the nudge. Try again.');btn.disabled=false;btn.textContent='Send relight nudge';});}
</script>`;
  return html(layout("Campfire", body, "/campfire", "TechWomenAZ admin dashboard: every mentorship as a flame."));
}

export async function nudge(env: Env, pairId: number): Promise<Response> {
  const pair = await db.getPair(env.DB, pairId);
  if (!pair) return Response.json({ error: "not found" }, { status: 404 });
  const first = (s: string) => s.split(" ")[0];
  const message = `Hi ${first(pair.mentee_name)} and ${first(pair.mentor_name)}! A 15-minute call this week keeps your flame going 🕯️ Next up: ${pair.goal}`;
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
${url.searchParams.get("posted") ? `<div class="notice">Posted. We're matching it to students by coursework.</div>` : ""}
<div class="banner"><div class="row" style="justify-content:space-between;position:relative;z-index:1"><h1>Opportunities</h1><div class="row"><a class="btn ghost onDark" href="/orgs">Organizations</a><a class="btn" href="/opportunities/new">Post an opportunity</a></div></div>
<p>Internships, jobs and programs, matched to the classes you've taken.</p></div>
<form method="get" class="row card" style="margin-bottom:1rem"><label for="as" style="margin:0">See fit for</label>
<select id="as" name="as" style="max-width:260px" onchange="this.form.submit()"><option value="">Everyone</option>${mentees
    .map((m) => `<option value="${m.id}"${m.id === asId ? " selected" : ""}>${esc(m.name)}</option>`)
    .join("")}</select><noscript><button class="btn small">Go</button></noscript></form>
<div class="grid">${cards.join("") || `<div class="card">No opportunities yet.</div>`}</div>`;
  return html(layout("Opportunities", body, "/opportunities"));
}

export function oppForm(url?: URL): Response {
  const orgName = (url?.searchParams.get("org") ?? "").slice(0, 120);
  const body = `
<h1>Post an opportunity</h1>
<p class="muted">List the courses you want. We show you who fits.</p>
<form method="post" action="/opportunities" class="card">
  <div class="two">
    <div><label for="kind">Type</label><select id="kind" name="kind">${options(OPP_KINDS)}</select></div>
    <div><label for="career">Career path</label><select id="career" name="career">${options(ALL_PATHS.filter((c) => c !== "Not sure yet"))}</select></div>
    <div><label for="title">Title</label><input id="title" name="title" required maxlength="120" placeholder="e.g. Data Analyst Intern"></div>
    <div><label for="org">Organization</label><input id="org" name="org" required maxlength="120" value="${esc(orgName)}"></div>
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
    career: normCareer(str(f, "career", 60)),
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
  const org = await env.DB.prepare(`SELECT id FROM orgs WHERE name = ?`).bind(o.org).first<{ id: number }>();
  const team = await env.DB.prepare(`SELECT user_id FROM accounts WHERE role = 'admin' ORDER BY id LIMIT 1`).first<{ user_id: number }>();
  const ranked = mentees
    .map((m: User) => ({ m, r: oppScore(m, o) }))
    .filter((x) => x.r.score >= 40)
    .sort((a, b) => b.r.score - a.r.score)
    .slice(0, 8);
  const body = `
${url.searchParams.get("posted") ? `<div class="notice">Posted. These students have the coursework it asks for. <a href="/courses/new?opp=${o.id}">Add a prep course</a> to help them get ready.</div>` : ""}${url.searchParams.get("course") ? `<div class="notice">Course added to this posting.</div>` : ""}
<p><a href="/opportunities">← All opportunities</a></p>
<div class="two" style="align-items:start">
  ${oppCard(o)}
  <div class="card"><h2 style="font-size:1.2rem">Best-fit students (${ranked.length})</h2>
  <p class="muted" style="font-size:.9rem">Ranked by coursework coverage, career path and location. TechWomenAZ shares the posting with them, not their contact details.</p>
  ${
    ranked.length
      ? ranked
          .map(
            (x) => `<div style="border-bottom:1px dashed var(--line);padding:.5rem 0"><div class="row" style="justify-content:space-between"><b><a href="/profile/${x.m.id}">${esc(x.m.name)}</a></b><span class="score" style="font-size:1.1rem">${x.r.score}%</span></div>
      <span class="muted">${esc(x.m.headline)}</span><div>${chips(x.r.courses, "sage")}</div>
      <div class="row" style="margin-top:.35rem"><a class="btn small ghost" href="/messages/u:${x.m.id}">Message ${esc(x.m.name.split(" ")[0])}</a></div></div>`,
          )
          .join("")
      : `<p class="muted">No students match yet. They'll appear as people join.</p>`
  }</div>
</div>
<div class="card" style="margin-top:1rem"><h2 style="font-size:1.2rem;margin-top:0">Questions about this posting?</h2>
<p class="muted" style="margin:.2rem 0 .7rem">Ask the program team about this posting. They answer here, and employers only see what you put on your profile.</p>
<div class="row">${team ? `<a class="btn" href="/messages/u:${team.user_id}">Message the program team</a>` : ""}${org ? `<a class="btn ghost" href="/orgs/${org.id}">Organization profile</a>` : `<a class="btn ghost" href="/org?name=${encodeURIComponent(o.org)}">Organization profile</a>`}</div></div>
${oppCoursesBlock(o.id)}`;
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
