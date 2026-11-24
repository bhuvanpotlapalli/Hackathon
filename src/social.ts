// Profiles (view + edit) and mentor–mentee chat on the pair page.
import { appUrl, mail, pairPeople, sendMails } from "./email";
import { ALL_PATHS, AREAS, AVAILABILITY, FORMATS, FUN_INTERESTS, clamp, normCareer, splitCourses, type User } from "./logic";
import { esc, html, layout, options } from "./ui";
import type { Me } from "./auth";

interface Env {
  DB: D1Database;
  AI?: Ai;
}

export const MESSAGES_SCHEMA = `CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pair_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
)`;

/** Columns added after launch; safe to run on every start. */
export const PROFILE_MIGRATIONS = [`ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''`, `ALTER TABLE users ADD COLUMN pronouns TEXT NOT NULL DEFAULT ''`, `ALTER TABLE users ADD COLUMN fun_facts TEXT NOT NULL DEFAULT ''`, `ALTER TABLE users ADD COLUMN experience TEXT NOT NULL DEFAULT ''`];

type Profile = User & { bio?: string; pronouns?: string; fun_facts?: string; experience?: string };

// ---------------------------------------------------------------- Profile
export async function profilePage(env: Env, id: number, url: URL, user: Me): Promise<Response> {
  const u = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first<Profile>();
  if (!u) return html(layout("Not found", `<div class="card"><h1>Profile not found</h1><p><a href="/home">Back to your dashboard</a></p></div>`), 404);
  const isMe = user.userId === u.id;
  const first = esc(u.name.split(" ")[0]);
  const pairs = await env.DB.prepare(
    `SELECT p.id, m.name AS mentor_name, e.name AS mentee_name FROM pairs p JOIN users m ON m.id = p.mentor_id JOIN users e ON e.id = p.mentee_id WHERE p.mentor_id = ? OR p.mentee_id = ?`,
  )
    .bind(id, id)
    .all<{ id: number; mentor_name: string; mentee_name: string }>();
  const mentor = u.role === "mentor";
  const fun = new Set(splitCourses(u.interests ?? ""));
  const initials = u.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const body = `
${url.searchParams.get("saved") ? `<div class="notice">Profile saved.</div>` : ""}
<div class="banner prof"><div class="row" style="gap:1rem;position:relative;z-index:1">
  <div class="pavatar">${esc(initials)}</div>
  <div><h1 style="margin:0">${esc(u.name)}${u.pronouns ? ` <span style="font-size:1rem;opacity:.75">(${esc(u.pronouns)})</span>` : ""}</h1>
  <p style="margin:.2rem 0 0">${esc(mentor ? "Mentor" : "Mentee")} · ${esc(u.career)}${u.headline ? ` · ${esc(u.headline)}` : ""}</p></div></div>
  ${u.bio ? `<p style="margin-top:1rem;position:relative;z-index:1">${esc(u.bio)}</p>` : ""}
  ${u.experience ? `<p style="margin:.6rem 0 0;position:relative;z-index:1"><b>Experience:</b> ${esc(u.experience)}</p>` : ""}
  ${u.fun_facts ? `<p style="margin:.3rem 0 0;position:relative;z-index:1"><b>Fun facts:</b> ${esc(u.fun_facts)}</p>` : ""}
  <div class="row" style="margin-top:1rem;position:relative;z-index:1">
    ${mentor ? `<a class="btn" href="/courses/personal?mentor=${u.id}">Build a course for a mentee</a>` : `<a class="btn" href="/matches/${u.id}">See my matches</a>`}
    ${isMe ? `<span class="chip sage">This is you</span><a class="btn ghost onDark" href="/account">Account settings</a>` : `<a class="btn ghost onDark" href="/messages/u:${u.id}">Message ${first}</a>`}
    <a class="btn ghost onDark" href="/calendar">My calendar</a>
  </div>
  ${pairs.results.length ? `<div class="row" style="margin-top:.6rem;position:relative;z-index:1">${pairs.results.map((p) => `<a class="btn small ghost onDark" href="/pair/${p.id}#chat">Chat with ${esc((mentor ? p.mentee_name : p.mentor_name).split(" ")[0])}</a><a class="btn small ghost onDark" href="/calendar?pair=${p.id}#schedule">Book a meeting</a>`).join("")}</div>` : ""}
</div>
<form method="post" action="/profile/${u.id}" class="card">
  <h2 style="font-size:1.25rem;margin-top:0">Edit profile</h2>
  <div class="two">
    <div><label for="name">Name</label><input id="name" name="name" required maxlength="60" value="${esc(u.name)}"></div>
    <div><label for="pronouns">Pronouns (optional)</label><input id="pronouns" name="pronouns" maxlength="20" value="${esc(u.pronouns ?? "")}" placeholder="e.g. she/her"></div>
    <div><label for="headline">Headline</label><input id="headline" name="headline" maxlength="120" value="${esc(u.headline)}" placeholder="${mentor ? "e.g. UX Designer, Scottsdale" : "e.g. ASU junior, Graphic Design"}"></div>
    <div><label for="career">Path</label><select id="career" name="career">${options(ALL_PATHS.includes(u.career) ? ALL_PATHS : [u.career, ...ALL_PATHS], u.career)}</select></div>
  </div>
  <label for="bio">About me</label><textarea id="bio" name="bio" rows="3" maxlength="400" placeholder="A few lines about you">${esc(u.bio ?? "")}</textarea>
  <label for="experience">Work experience</label><textarea id="experience" name="experience" rows="2" maxlength="400" placeholder="${mentor ? "e.g. 5 years UX at a fintech, 3 years retail before that" : "e.g. 2 years as a nurse, barista, campus IT help desk"}">${esc(u.experience ?? "")}</textarea>
  <label for="fun_facts">Fun facts</label><input id="fun_facts" name="fun_facts" maxlength="200" value="${esc(u.fun_facts ?? "")}" placeholder="e.g. I've hiked Camelback 50 times, I bake sourdough, I speak Spanish">
  <label for="courses">${mentor ? "Classes you've taken or teach" : "Classes you've taken or are taking"}</label>
  <input id="courses" name="courses" maxlength="400" value="${esc(u.courses)}" placeholder="Separate with commas">
  <label for="goal">${mentor ? "What you can help with" : "Your goal"}</label><input id="goal" name="goal" maxlength="200" value="${esc(u.goal)}">
  <fieldset style="margin-top:.8rem"><legend>Off the clock, I'm into</legend><div class="row">${FUN_INTERESTS.map(
    (f) => `<label class="check"><input type="checkbox" name="interests" value="${esc(f)}"${fun.has(f) ? " checked" : ""}> ${esc(f)}</label>`,
  ).join("")}</div></fieldset>
  <div class="two">
    <div><label for="availability">Free</label><select id="availability" name="availability">${options(AVAILABILITY, u.availability)}</select></div>
    <div><label for="format">Meet</label><select id="format" name="format">${options(FORMATS, u.format)}</select></div>
    <div><label for="area">Area</label><select id="area" name="area">${options(AREAS, u.area)}</select></div>
    ${mentor ? `<div><label for="capacity">Mentees I can take</label><input id="capacity" name="capacity" type="number" min="1" max="20" value="${u.capacity}"></div>` : `<div><label for="confidence">Confidence about tech (1-10)</label><input id="confidence" name="confidence" type="number" min="1" max="10" value="${u.confidence}"></div>`}
  </div>
  <button class="btn" type="submit" style="margin-top:1rem">Save profile</button>
</form>`;
  return html(layout(u.name, body));
}

export async function profileSubmit(req: Request, env: Env, id: number): Promise<Response> {
  const u = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first<Profile>();
  if (!u) return new Response("Not found", { status: 404 });
  const f = await req.formData();
  const s = (k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);
  const pick = (k: string, list: string[], d: string) => (list.includes(s(k, 40)) ? s(k, 40) : d);
  const num = (k: string, lo: number, hi: number, d: number) => {
    const n = parseInt(s(k, 5), 10);
    return Number.isFinite(n) ? clamp(n, lo, hi) : d;
  };
  const career = s("career", 60) === u.career ? u.career : normCareer(s("career", 60));
  const interests = f.getAll("interests").map(String).filter((x) => FUN_INTERESTS.includes(x)).join(", ");
  await env.DB.prepare(
    `UPDATE users SET name = ?, pronouns = ?, headline = ?, career = ?, bio = ?, experience = ?, fun_facts = ?, courses = ?, goal = ?, interests = ?, availability = ?, format = ?, area = ?, capacity = ?, confidence = ? WHERE id = ?`,
  )
    .bind(
      s("name", 60) || u.name, s("pronouns", 20), s("headline", 120), career, s("bio", 400), s("experience", 400), s("fun_facts", 200), s("courses", 400), s("goal", 200) || u.goal, interests,
      pick("availability", AVAILABILITY, u.availability), pick("format", FORMATS, u.format), pick("area", AREAS, u.area),
      u.role === "mentor" ? num("capacity", 1, 20, u.capacity) : u.capacity, u.role === "mentee" ? num("confidence", 1, 10, u.confidence) : u.confidence, id,
    )
    .run();
  return new Response(null, { status: 303, headers: { location: `/profile/${id}?saved=1` } });
}

// ---------------------------------------------------------------- Chat
interface Msg {
  id: number;
  sender_id: number;
  body: string;
  created_at: string;
}

export function chatBlock(pair: { id: number; mentor_id: number; mentee_id: number; mentor_name: string; mentee_name: string }, user: Me): string {
  const fm = esc(pair.mentor_name.split(" ")[0]);
  const fe = esc(pair.mentee_name.split(" ")[0]);
  return `<div class="card pchat" id="chat">
  <div class="row" style="justify-content:space-between"><h2 style="font-size:1.2rem;margin:0">Chat</h2>
  <span class="muted" style="font-size:.85rem">Sending as ${esc(user.name.split(" ")[0])}</span></div>
  <div class="msgs" id="msgs" aria-live="polite"><p class="muted">Loading messages…</p></div>
  <form class="askrow" id="msgForm" style="margin-top:.6rem"><input class="chat-in" id="msgIn" maxlength="600" required placeholder="Write a message" aria-label="Message"><button class="btn" type="submit">Send</button></form>
</div>
<script>
(function(){var box=document.getElementById('msgs'),form=document.getElementById('msgForm'),inp=document.getElementById('msgIn'),last=-1,names={'${pair.mentor_id}':'${fm}','${pair.mentee_id}':'${fe}'};
function me(){return '${user.userId}'}
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function when(t){var d=new Date(t);return d.toLocaleDateString([], {month:'short',day:'numeric'})+' '+d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}
function draw(list){if(!list.length){box.innerHTML='<p class="muted">No messages yet. Say hi!</p>';return}
  box.innerHTML=list.map(function(m){var mine=String(m.sender_id)===me();return '<div class="msg'+(mine?' mine':'')+'"><div class="bub">'+esc(m.body)+'</div><small>'+esc(names[m.sender_id]||'')+' · '+when(m.created_at)+'</small></div>'}).join('');box.scrollTop=box.scrollHeight}
var cache=[];function load(){fetch('/api/pair/${pair.id}/messages').then(function(r){return r.json()}).then(function(d){cache=d.messages||[];if(cache.length!==last){last=cache.length;draw(cache)}}).catch(function(){})}
form.onsubmit=function(e){e.preventDefault();var v=inp.value.trim();if(!v)return;inp.value='';
  fetch('/api/pair/${pair.id}/messages',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({body:v})}).then(function(r){return r.json()}).then(function(d){if(d.error){if(window.toast)toast(d.error);return}last=-1;load()}).catch(function(){if(window.toast)toast('Could not send. Try again.')})};
load();setInterval(load,4000);})();
</script>`;
}

export async function apiMessages(req: Request, env: Env, pairId: number, user: Me): Promise<Response> {
  const pair = await env.DB.prepare(`SELECT id, mentor_id, mentee_id FROM pairs WHERE id = ?`).bind(pairId).first<{ id: number; mentor_id: number; mentee_id: number }>();
  if (!pair) return Response.json({ error: "Pair not found" }, { status: 404 });
  if (user.userId !== pair.mentor_id && user.userId !== pair.mentee_id) return Response.json({ error: "This chat isn't yours." }, { status: 403 });
  if (req.method === "POST") {
    let b: { sender?: unknown; body?: unknown } = {};
    try {
      b = await req.json();
    } catch {
      return Response.json({ error: "Bad request" }, { status: 400 });
    }
    const sender = user.userId;
    const body = typeof b.body === "string" ? b.body.trim().slice(0, 600) : "";
    if (!body) return Response.json({ error: "Write a message first." }, { status: 400 });
    await env.DB.prepare(`INSERT INTO messages (pair_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)`).bind(pairId, sender, body, new Date().toISOString()).run();
  }
  const { results } = await env.DB.prepare(`SELECT id, sender_id, body, created_at FROM messages WHERE pair_id = ? ORDER BY created_at ASC, id ASC LIMIT 200`).bind(pairId).all<Msg>();
  return Response.json({ messages: results });
}

export const SOCIAL_CSS_BASE = `
.pavatar{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;font:700 1.5rem "Space Grotesk",system-ui;color:#fff;background:radial-gradient(circle at 50% 65%,var(--gold),var(--ember) 70%);flex:none;box-shadow:0 0 0 4px rgba(255,255,255,.15)}
.seg{display:flex;gap:.5rem;align-items:center}.seg label{display:flex;gap:.25rem;align-items:center;font-weight:600;font-size:.9rem;cursor:pointer}
.msgs{max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:.5rem;padding:.3rem .1rem}
.msg{display:flex;flex-direction:column;align-items:flex-start;animation:enter .3s var(--ease-enter) both}.msg.mine{align-items:flex-end}
.msg .bub{max-width:82%;padding:.55rem .8rem;border-radius:16px 16px 16px 4px;background:rgba(128,128,128,.12);line-height:1.35;word-wrap:break-word}
.msg.mine .bub{background:var(--ember);color:#fff;border-radius:16px 16px 4px 16px}
.retchart{width:100%;height:auto;display:block}
.retchart .rb{fill:var(--ember);opacity:.85;transform-origin:bottom;transform-box:fill-box;animation:growUp .8s var(--ease-enter) both}
@keyframes growUp{from{transform:scaleY(0)}to{transform:none}}
.retchart .rline{stroke:var(--plum);stroke-width:3;stroke-dasharray:2000;stroke-dashoffset:2000;animation:draw 1.6s ease .4s forwards}
html[data-theme=dark] .retchart .rline{stroke:#cdb5f0}html[data-theme=dark] .retchart .rdot{fill:#cdb5f0}
.retchart .rdot{fill:var(--plum)}.retchart .rl{font:600 12px system-ui;fill:var(--muted)}
@keyframes draw{to{stroke-dashoffset:0}}
.key{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;margin:0 .3rem 0 .6rem}.key.kb{background:var(--ember)}.key.kl{background:var(--plum);height:3px;vertical-align:3px}
.retention .stat{padding:.4rem 0}
.pavatar.sm{width:42px;height:42px;font-size:1.05rem}
.msg small{color:var(--muted);font-size:.75rem;margin-top:.15rem}
`;

// ---------------------------------------------------------------- Meetings (virtual or in person)
export const MEETINGS_SCHEMA = `CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pair_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 30,
  place TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
)`;

interface Meeting {
  id: number;
  pair_id: number;
  kind: string;
  starts_at: string; // local "YYYY-MM-DDTHH:MM" (Arizona time)
  minutes: number;
  place: string;
  link: string;
  topic: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
/** Arizona has no daylight saving: always UTC-7. */
function azNow(): Date {
  return new Date(Date.now() - 7 * 3600e3);
}
function azLocal(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}


function fmt(s: string): string {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return s;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const mons = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const h = d.getUTCHours();
  return `${days[d.getUTCDay()]} ${mons[d.getUTCMonth()]} ${d.getUTCDate()}, ${h % 12 || 12}:${pad(d.getUTCMinutes())} ${h < 12 ? "AM" : "PM"}`;
}

export async function meetingsBlock(env: Env, pairId: number): Promise<string> {
  const now = azLocal(azNow());
  const { results } = await env.DB.prepare(`SELECT * FROM meetings WHERE pair_id = ? AND starts_at >= ? ORDER BY starts_at ASC LIMIT 10`).bind(pairId, now).all<Meeting>();
  const min = now.slice(0, 16);
  return `<div class="card" id="meetings" style="margin-top:1rem">
  <h2 style="font-size:1.2rem;margin-top:0">Upcoming meetings</h2>
  ${
    results.length
      ? `<div class="mtgs">${results
          .map(
            (m) => `<div class="mtg ${m.kind === "Virtual" ? "v" : "p"}">
    <div class="mtg-k">${m.kind === "Virtual" ? "Virtual" : "In person"}</div>
    <div class="mtg-b"><b>${esc(fmt(m.starts_at))}</b> · ${m.minutes} min${m.topic ? ` · ${esc(m.topic)}` : ""}<br>
    <span class="muted">${m.kind === "Virtual" ? (m.link ? `<a href="${esc(m.link)}" target="_blank" rel="noopener">Join video call</a>` : "Video link to come") : esc(m.place || "Place to be decided")}</span></div>
    <div class="mtg-a"><a class="btn small ghost" href="/pair/${pairId}/meetings/${m.id}.ics">Add to calendar</a>
    <form method="post" action="/pair/${pairId}/meetings/${m.id}/cancel"><button class="btn small ghost" type="submit">Cancel</button></form></div>
  </div>`,
          )
          .join("")}</div>`
      : `<p class="muted">Nothing scheduled yet. Plan your next one below.</p>`
  }
  <form method="post" action="/pair/${pairId}/meetings" class="mtg-form">
    <h3 style="font-size:1.05rem;margin:1rem 0 .4rem">Schedule a meeting</h3>
    <div class="seg" role="radiogroup" aria-label="Meeting type"><label><input type="radio" name="kind" value="Virtual" checked onchange="mtgKind(this.form)"> Virtual (Zoom, Meet)</label><label><input type="radio" name="kind" value="In-person" onchange="mtgKind(this.form)"> In person</label></div>
    <div class="two">
      <div><label for="m-when">Date and time (Arizona)</label><input id="m-when" name="starts_at" type="datetime-local" required min="${min}"></div>
      <div><label for="m-min">Length</label><select id="m-min" name="minutes">${options(["20", "30", "45", "60"], "30")}</select></div>
      <div class="m-link"><label for="m-link">Video link</label><input id="m-link" name="link" type="url" maxlength="300" placeholder="https://zoom.us/j/..."></div>
      <div class="m-place" style="display:none"><label for="m-place">Where (a public place)</label><input id="m-place" name="place" maxlength="160" placeholder="e.g. Burton Barr Library, Phoenix"></div>
      <div><label for="m-topic">Topic (optional)</label><input id="m-topic" name="topic" maxlength="120" placeholder="e.g. Resume review"></div>
    </div>
    <button class="btn" type="submit" style="margin-top:.8rem">Schedule</button>
  </form>
</div>
<script>function mtgKind(f){var v=f.querySelector('input[name=kind]:checked').value==='Virtual';f.querySelector('.m-link').style.display=v?'':'none';f.querySelector('.m-place').style.display=v?'none':'';f.place.required=!v}</script>`;
}

/** Saves one meeting. Used by the pair page and by the calendar. */
export async function addMeeting(
  env: Env,
  pairId: number,
  m: { kind: string; when: string; minutes: number; link: string; place: string; topic: string },
): Promise<void> {
  await env.DB.prepare(`INSERT INTO meetings (pair_id, kind, starts_at, minutes, place, link, topic, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(pairId, m.kind === "In-person" ? "In-person" : "Virtual", m.when, m.minutes, m.kind === "In-person" ? m.place : "", m.kind === "Virtual" && /^https?:\/\//.test(m.link) ? m.link : "", m.topic, new Date().toISOString())
    .run();
  // Tell both people, whichever page booked it.
  const people = await pairPeople(env, pairId);
  const href = appUrl(env, `/pair/${pairId}#meetings`);
  await sendMails(
    env,
    people.map((p) => mail.meeting(p.email, p.name, people.find((o) => o.user_id !== p.user_id)?.name ?? "your mentor", whenLabel(m.when), m.topic, href)),
  );
}

/** "2026-12-03T18:00" (Arizona wall time) → "Dec 3, 2026 at 6:00 PM". */
const whenLabel = (when: string): string => {
  const match = when.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return when;
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], 12));
  const hour = +match[4];
  const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${label} at ${hour % 12 || 12}:${match[5]} ${hour < 12 ? "AM" : "PM"}`;
};

export async function meetingSubmit(req: Request, env: Env, pairId: number): Promise<Response> {
  const pair = await env.DB.prepare(`SELECT id FROM pairs WHERE id = ?`).bind(pairId).first();
  if (!pair) return new Response("Pair not found", { status: 404 });
  const f = await req.formData();
  const s = (k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);
  const kind = s("kind", 20) === "In-person" ? "In-person" : "Virtual";
  const when = s("starts_at", 16);
  // Booked from /calendar: go back to the month view instead of the pair page.
  const toCalendar = s("back", 20) === "calendar";
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when))
    return new Response(null, { status: 303, headers: { location: toCalendar ? "/calendar?bad=1#schedule" : `/pair/${pairId}#meetings` } });
  const link = s("link", 300);
  const minutes = [20, 30, 45, 60].includes(parseInt(s("minutes", 3), 10)) ? parseInt(s("minutes", 3), 10) : 30;
  await addMeeting(env, pairId, { kind, when, minutes, link, place: s("place", 160), topic: s("topic", 120) });
  return new Response(null, {
    status: 303,
    headers: { location: toCalendar ? `/calendar?month=${when.slice(0, 7)}&scheduled=1#schedule` : `/pair/${pairId}?scheduled=1#meetings` },
  });
}

export async function meetingCancel(env: Env, pairId: number, id: number): Promise<Response> {
  const meeting = await env.DB.prepare(`SELECT starts_at FROM meetings WHERE id = ? AND pair_id = ?`).bind(id, pairId).first<{ starts_at: string }>();
  await env.DB.prepare(`DELETE FROM meetings WHERE id = ? AND pair_id = ?`).bind(id, pairId).run();
  if (meeting) {
    const people = await pairPeople(env, pairId);
    const href = appUrl(env, `/pair/${pairId}#meetings`);
    await sendMails(
      env,
      people.map((p) => mail.meetingCancelled(p.email, p.name, people.find((o) => o.user_id !== p.user_id)?.name ?? "your mentor", whenLabel(meeting.starts_at), href)),
    );
  }
  return new Response(null, { status: 303, headers: { location: `/pair/${pairId}?cancelled=1#meetings` } });
}

/** Calendar file so either person can add the meeting to Google/Apple/Outlook. */
export async function meetingIcs(env: Env, pairId: number, id: number): Promise<Response> {
  const m = await env.DB.prepare(`SELECT * FROM meetings WHERE id = ? AND pair_id = ?`).bind(id, pairId).first<Meeting>();
  if (!m) return new Response("Not found", { status: 404 });
  const p = m.starts_at.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)!;
  const start = new Date(Date.UTC(+p[1], +p[2] - 1, +p[3], +p[4] + 7, +p[5])); // Arizona is UTC-7
  const end = new Date(start.getTime() + m.minutes * 60e3);
  const z = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const clean = (t: string) => t.replace(/[\r\n,;]/g, " ");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TechWomenAZ//Mentorship//EN", "BEGIN:VEVENT",
    `UID:tw-${m.id}@fortfein`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(start)}`, `DTEND:${z(end)}`,
    `SUMMARY:${clean(`TechWomenAZ mentor meeting${m.topic ? `: ${m.topic}` : ""}`)}`,
    `LOCATION:${clean(m.kind === "Virtual" ? m.link || "Online" : m.place)}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return new Response(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="meeting-${m.id}.ics"` } });
}

export const MEETING_CSS = `
.mtgs{display:flex;flex-direction:column;gap:.6rem}
.mtg{display:grid;grid-template-columns:auto 1fr auto;gap:.8rem;align-items:center;padding:.7rem .8rem;border:1px solid var(--line);border-radius:14px;animation:enter .4s var(--ease-enter) both}
.mtg-k{font:700 .72rem system-ui;letter-spacing:.08em;text-transform:uppercase;padding:.35rem .55rem;border-radius:8px;color:#fff;background:var(--plum)}
.mtg.p .mtg-k{background:var(--sage)}.mtg.v .mtg-k{background:#5b4bd1}
.mtg-a{display:flex;gap:.35rem;align-items:center}.mtg-a form{margin:0}
@media (max-width:600px){.mtg{grid-template-columns:1fr}.mtg-a{flex-wrap:wrap}}
`;

export const SOCIAL_CSS = SOCIAL_CSS_BASE + MEETING_CSS;

// ---------------------------------------------------------------- Organization profiles
export const ORGS_SCHEMA = `CREATE TABLE IF NOT EXISTS orgs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  about TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
)`;
export const ORG_KINDS = ["Company", "Nonprofit", "School or college", "Government"];
interface Org {
  id: number;
  name: string;
  kind: string;
  about: string;
  website: string;
  area: string;
}


async function orgData(env: Env, name: string) {
  const [opps, courses] = await Promise.all([
    env.DB.prepare(`SELECT id, kind, title, career FROM opportunities WHERE org = ? ORDER BY created_at DESC`).bind(name).all<{ id: number; kind: string; title: string; career: string }>(),
    env.DB.prepare(`SELECT id, title, level FROM courses WHERE provider = ? OR author = ? OR opp_id IN (SELECT id FROM opportunities WHERE org = ?) ORDER BY created_at DESC`)
      .bind(name, name, name)
      .all<{ id: number; title: string; level: string }>(),
  ]);
  return { opps: opps.results, courses: courses.results };
}

export async function orgsPage(env: Env, url: URL): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT o.*, (SELECT COUNT(*) FROM opportunities p WHERE p.org = o.name) AS n FROM orgs o ORDER BY n DESC, o.name`,
  ).all<Org & { n: number }>();
  const body = `
${url.searchParams.get("created") ? `<div class="notice">Organization profile created.</div>` : ""}
<div class="banner"><div class="row" style="justify-content:space-between;position:relative;z-index:1"><h1>Organizations</h1><a class="btn" href="/orgs/new">Create an organization profile</a></div>
<p>Companies, nonprofits and schools that post opportunities and courses.</p></div>
<div class="grid">${results
    .map(
      (o) => `<a class="card pcourse" href="/orgs/${o.id}"><div class="row" style="gap:.7rem"><div class="pavatar sm">${esc(o.name.replace(/\(demo\)/, "").trim().slice(0, 1))}</div><div><h3 style="margin:0;font-size:1.05rem">${esc(o.name)}</h3><span class="muted" style="font-size:.85rem">${esc(o.kind)}${o.area ? ` · ${esc(o.area)}` : ""} · ${o.n} opening${o.n === 1 ? "" : "s"}</span></div></div><p style="margin:.6rem 0 0;font-size:.92rem">${esc(o.about)}</p></a>`,
    )
    .join("") || `<div class="card">No organizations yet.</div>`}</div>`;
  return html(layout("Organizations", body, "/opportunities"));
}

export async function orgPage(env: Env, id: number, url: URL): Promise<Response> {
  const o = await env.DB.prepare(`SELECT * FROM orgs WHERE id = ?`).bind(id).first<Org>();
  if (!o) return html(layout("Not found", `<div class="card"><h1>Organization not found</h1><p><a href="/orgs">All organizations</a></p></div>`), 404);
  const { opps, courses } = await orgData(env, o.name);
  const body = `
${url.searchParams.get("created") ? `<div class="notice">Profile created. Post an opportunity or add a course next.</div>` : ""}
<p><a href="/orgs">← All organizations</a></p>
<div class="banner prof"><div class="row" style="gap:1rem;position:relative;z-index:1"><div class="pavatar">${esc(o.name.replace(/\(demo\)/, "").trim().slice(0, 1))}</div>
<div><h1 style="margin:0">${esc(o.name)}</h1><p style="margin:.2rem 0 0">${esc(o.kind)}${o.area ? ` · ${esc(o.area)}` : ""}</p></div></div>
<p style="margin-top:1rem;position:relative;z-index:1">${esc(o.about)}</p>
<div class="row" style="position:relative;z-index:1;margin-top:.8rem"><a class="btn" href="/messages/o:${o.id}">Message us</a><a class="btn ghost onDark" href="/opportunities/new?org=${encodeURIComponent(o.name)}">Post an opportunity</a><a class="btn ghost onDark" href="/courses/new?org=${encodeURIComponent(o.name)}">Add a course</a>${/^https?:\/\//.test(o.website) ? `<a class="btn ghost onDark" href="${esc(o.website)}" target="_blank" rel="noopener">Website</a>` : ""}</div></div>
<div class="two" style="align-items:start">
  <div class="card"><h2 style="font-size:1.2rem;margin-top:0">Opportunities (${opps.length})</h2>${
    opps.length ? opps.map((p) => `<p style="margin:.4rem 0"><a href="/opportunities/${p.id}"><b>${esc(p.title)}</b></a><br><span class="muted">${esc(p.kind)} · ${esc(p.career)}</span></p>`).join("") : `<p class="muted">No openings yet.</p>`
  }</div>
  <div class="card"><h2 style="font-size:1.2rem;margin-top:0">Courses (${courses.length})</h2>${
    courses.length ? courses.map((c) => `<p style="margin:.4rem 0"><a href="/courses/${c.id}"><b>${esc(c.title)}</b></a><br><span class="muted">${esc(c.level)}</span></p>`).join("") : `<p class="muted">No courses yet.</p>`
  }</div>
</div>`;
  return html(layout(o.name, body, "/opportunities"));
}

/** Opportunity cards link here by org name: go to the profile, or offer to create it. */
export async function orgByName(env: Env, url: URL): Promise<Response> {
  const name = (url.searchParams.get("name") ?? "").slice(0, 120);
  const o = await env.DB.prepare(`SELECT id FROM orgs WHERE name = ?`).bind(name).first<{ id: number }>();
  return new Response(null, { status: 303, headers: { location: o ? `/orgs/${o.id}` : `/orgs/new?name=${encodeURIComponent(name)}` } });
}

export function orgForm(url: URL, error = ""): Response {
  const name = (url.searchParams.get("name") ?? "").slice(0, 120);
  const body = `
<h1>Create an organization profile</h1>
<p class="muted">For companies, nonprofits, schools and agencies that post opportunities or courses.</p>
${error ? `<div class="notice" role="alert">${esc(error)}</div>` : ""}
<form method="post" action="/orgs" class="card">
  <div class="two">
    <div><label for="o-name">Organization name</label><input id="o-name" name="name" required maxlength="120" value="${esc(name)}"></div>
    <div><label for="o-kind">Type</label><select id="o-kind" name="kind">${options(ORG_KINDS)}</select></div>
    <div><label for="o-area">Area</label><select id="o-area" name="area">${options(AREAS)}</select></div>
    <div><label for="o-web">Website (optional)</label><input id="o-web" name="website" type="url" maxlength="300" placeholder="https://"></div>
  </div>
  <label for="o-about">About</label><textarea id="o-about" name="about" rows="3" maxlength="500" required placeholder="What you do and who you hire"></textarea>
  <button class="btn" type="submit" style="margin-top:1rem">Create profile</button>
</form>`;
  return html(layout("Create an organization", body, "/opportunities"));
}

export async function orgSubmit(req: Request, env: Env): Promise<Response> {
  const f = await req.formData();
  const s = (k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);
  const name = s("name", 120);
  if (!name || !s("about", 500)) return orgForm(new URL(req.url), "Add a name and a short about.");
  const exists = await env.DB.prepare(`SELECT id FROM orgs WHERE name = ?`).bind(name).first<{ id: number }>();
  if (exists) return new Response(null, { status: 303, headers: { location: `/orgs/${exists.id}` } });
  const web = s("website", 300);
  const row = await env.DB.prepare(`INSERT INTO orgs (name, kind, about, website, area, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`)
    .bind(name, ORG_KINDS.includes(s("kind", 40)) ? s("kind", 40) : "Company", s("about", 500), /^https?:\/\//.test(web) ? web : "", AREAS.includes(s("area", 40)) ? s("area", 40) : "", new Date().toISOString())
    .first<{ id: number }>();
  return new Response(null, { status: 303, headers: { location: `/orgs/${row!.id}?created=1` } });
}
