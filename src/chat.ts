// "ember" chat signup: a fast, friendly conversation instead of a form.
// Quick-reply chips collect structured answers; Workers AI adds a short, specific
// reaction to free-text answers (with template fallbacks so it never stalls).

import * as ai from "./ai";
import * as db from "./db";
import { AREAS, AVAILABILITY, CAREERS, COURSE_LIBRARY, ENG_DOMAINS, FORMATS, FUN_INTERESTS, clamp, normCareer } from "./logic";
import type { Env } from "./pages";
import { html, layout } from "./ui";

const INTERESTS: [string, string][] = [
  ["Building apps and websites", "Software"],
  ["Designing things people love to use", "UX/Design"],
  ["Finding patterns in data", "Data/AI"],
  ["Stopping hackers", "Cybersecurity"],
  ["Fixing tech for people", "IT/Support"],
  ["Leading the team and the plan", "Product"],
  ["Pitching and telling the story", "Tech Sales & Marketing"],
  ["Building machines and real-world things", "Engineering"],
  ["Making games", "Game Design"],
  ["Tech that helps patients", "Health Tech"],
  ["Money, markets and apps", "Fintech"],
];

const GOAL_IDEAS: Record<string, string[]> = {
  Software: ["Land a summer software internship", "Ship my first project to GitHub", "Pass coding interviews"],
  "UX/Design": ["Land a UX internship", "Build a 2-case-study portfolio", "Move into UX research"],
  "Data/AI": ["Become a data analyst", "Land a data internship", "Build my first ML project"],
  Product: ["Switch into product management", "Get my first PM interview", "Lead a real product project"],
  Cybersecurity: ["Pass Security+", "Get a SOC analyst job", "Build a home lab"],
  "IT/Support": ["Earn CompTIA A+", "Land a help desk job", "Move up to sysadmin"],
  "Tech Sales & Marketing": ["Break into tech sales", "Grow my LinkedIn network", "Land a marketing role"],
  Engineering: ["Land an engineering internship", "Pass the FE exam", "Build a design project for my portfolio"],
  "Cloud/DevOps": ["Earn a cloud certification", "Land a DevOps internship", "Automate my first deployment"],
  "Game Design": ["Publish my first game", "Land a game studio internship", "Build a playable portfolio"],
  Fintech: ["Land a fintech internship", "Become a financial data analyst", "Build a fintech side project"],
  "Health Tech": ["Land a health IT role", "Learn health data standards", "Build a health data project"],
};

export function chatPage(): Response {
  const cfg = JSON.stringify({ eng: ENG_DOMAINS, fun: FUN_INTERESTS, careers: CAREERS, interests: INTERESTS, courses: COURSE_LIBRARY, goals: GOAL_IDEAS, availability: AVAILABILITY, formats: FORMATS, areas: AREAS }).replace(/</g, "\\u003c");
  const body = `
<div class="chatwrap">
  <div class="chathead">
    <div class="avatar" aria-hidden="true"><span>🔥</span></div>
    <div><b>ember</b><div class="muted" style="font-size:.85rem">TechWomenAZ's AI matchmaker · about 2 minutes</div></div>
    <div class="prog" aria-hidden="true"><b id="prog"></b></div>
  </div>
  <div class="msgs" id="msgs" aria-live="polite"></div>
  <div class="dock" id="dock"></div>
  <p class="muted" style="text-align:center;font-size:.85rem;margin:.6rem 0 0">Prefer a form? <a href="/join">Use the classic signup</a>.</p>
</div>
<script>
var C=${cfg};
var P={role:'mentee',courses:[],no_degree:0,confidence:5,capacity:2,format:'Both',area:'Phoenix',availability:'Flexible'};
var msgs=document.getElementById('msgs'),dock=document.getElementById('dock'),prog=document.getElementById('prog');
var TOTAL=9,stepN=0;
function progress(){stepN++;prog.style.width=Math.min(100,stepN/TOTAL*100)+'%'}
function el(t,c,txt){var e=document.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=txt;return e}
function scroll(){msgs.scrollTop=msgs.scrollHeight}
function bot(text){return new Promise(function(res){var t=el('div','msg bot typing');t.appendChild(el('span'));t.appendChild(el('span'));t.appendChild(el('span'));msgs.appendChild(t);scroll();
  setTimeout(function(){t.className='msg bot';t.textContent=text;scroll();res()},Math.min(900,250+text.length*9))})}
function me(text){var m=el('div','msg me',text);msgs.appendChild(m);scroll()}
function clear(){dock.innerHTML=''}
function chips(list,onPick,opts){clear();opts=opts||{};var row=el('div','chips');list.forEach(function(item,i){var label=Array.isArray(item)?item[0]:item;var b=el('button','chip-btn',label);b.type='button';b.style.animationDelay=(i*40)+'ms';
  b.onclick=function(){if(opts.multi){b.classList.toggle('on');b.setAttribute('aria-pressed',b.classList.contains('on'));count();return}clear();me(label);onPick(item)};if(opts.multi)b.setAttribute('aria-pressed','false');row.appendChild(b)});dock.appendChild(row);
  if(opts.multi){var other=el('input');other.placeholder=opts.placeholder||'Add your own (comma-separated)';other.className='chat-in';dock.appendChild(other);
    var go=el('button','btn',opts.done||'Done');go.type='button';var hint=el('div','chat-hint');function count(){var n=row.querySelectorAll('.on').length;go.textContent=(opts.done||'Done')+(n?' · '+n+' picked':'');if(n)hint.textContent=''}
    go.onclick=function(){var picked=[].slice.call(row.querySelectorAll('.on')).map(function(b){return b.textContent});
      other.value.split(',').map(function(s){return s.trim()}).filter(Boolean).forEach(function(s){picked.push(s)});if(!picked.length&&!opts.allowEmpty){hint.textContent='Tap at least one class, or type your own.';other.focus();return}clear();me(picked.length?picked.join(', '):'None yet');onPick(picked)};other.addEventListener('input',function(){if(other.value.trim())hint.textContent=''});dock.appendChild(go);dock.appendChild(hint)}}
function ask(placeholder,onAnswer,suggest){clear();var f=el('form','askrow');var i=el('input');i.className='chat-in';i.placeholder=placeholder;i.maxLength=200;i.required=true;i.setAttribute('aria-label',placeholder);
  var b=el('button','btn','Send');f.appendChild(i);f.appendChild(b);f.onsubmit=function(e){e.preventDefault();var v=i.value.trim();if(!v)return;clear();me(v);onAnswer(v)};
  if(suggest&&suggest.length){var row=el('div','chips');suggest.forEach(function(s){var c=el('button','chip-btn ghosty',s);c.type='button';c.onclick=function(){i.value=s;i.focus()};row.appendChild(c)});dock.appendChild(row)}
  dock.appendChild(f);setTimeout(function(){i.focus()},50)}
function react(step,answer){return fetch('/api/chat/react',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({step:step,answer:answer,profile:P})})
  .then(function(r){return r.json()}).then(function(d){return d.text}).catch(function(){return ''})}

function howMany(onPick){clear();var w=el('div','howmany');var big=el('div','hm-big','2');var r=el('input');r.type='range';r.min='1';r.max='10';r.value='2';r.className='hm-range';r.setAttribute('aria-label','Mentees, slider');
  var n=el('input');n.type='number';n.min='1';n.max='20';n.value='2';n.className='chat-in hm-num';n.setAttribute('aria-label','Mentees, type a number');
  function set(v,src){v=Math.max(1,Math.min(20,Math.round(+v||1)));big.textContent=v;big.classList.remove('bump');void big.offsetWidth;big.classList.add('bump');if(src!=='r')r.value=Math.min(10,v);if(src!=='n')n.value=v;r.style.setProperty('--p',((Math.min(10,v)-1)/9*100)+'%')}
  r.oninput=function(){set(r.value,'r')};n.oninput=function(){if(n.value!=='')set(n.value,'n')};set(2);
  var row=el('div','hm-row');row.appendChild(r);row.appendChild(n);var go=el('button','btn','That many');go.type='button';
  go.onclick=function(){var v=Math.max(1,Math.min(20,Math.round(+n.value||+r.value||1)));clear();me(v+' mentee'+(v>1?'s':''));onPick(v)};
  w.appendChild(big);w.appendChild(row);w.appendChild(go);dock.appendChild(w)}
async function run(){
  progress();
  await bot("Hey, I'm ember 🔥");
  await bot("A few taps and you'll meet your mentor matches. What's your name?");
  ask('Your first name',async function(name){P.name=name;progress();
    await bot('Nice to meet you, '+name+'! Are you here to find a mentor, or to be one?');
    chips(['Find a mentor','Be a mentor'],async function(r){P.role=r==='Be a mentor'?'mentor':'mentee';progress();
      await bot(P.role==='mentor'?'Love that. Which field do you work in?':'Big question first: what field are you going into?');
      chips(C.careers.concat(['Other']),async function(c){
        if(c==='Engineering'){await bot('Engineering is huge. Which kind?');
          chips(C.eng.concat(['Other']),async function(d){
            if(d==='Other'){await bot('What kind of engineering?');ask('e.g. Robotics, Nuclear, Materials',function(v){P.career='Engineering · '+v.slice(0,30);field()})}
            else{P.career='Engineering · '+d;field()}});return}
        if(c==='Other'){await bot('Cool. What field is it?');ask('e.g. Robotics, Fintech, EdTech',function(v){P.career='Other: '+v.slice(0,40);field()});return}
        if(c==='Not sure yet'&&P.role==='mentee'){await bot("Totally fine, most people start there. Which of these sounds the most fun?");
          chips(C.interests,async function(it){P.career=it[1];await bot('Then '+it[1]+' could be your thing. Your mentor can help you test that.');field()})}
        else{P.career=c;field()}})})});
}
async function field(){progress();
  var t=await react('field',P.career);if(t)await bot(t);
  await bot("Where are you coming from?");
  chips(P.role==='mentor'?['Tech degree','Bootcamp','Self-taught','Career changer']:['College student, tech major','College student, other major','Career changer','Bootcamp or self-taught'],async function(bg){
    P.headline=bg;P.no_degree=/tech major|Tech degree/.test(bg)?0:1;progress();
    var base=P.career.indexOf('Engineering')===0?'Engineering':P.career;var list=(C.courses[P.career]||C.courses[base]||C.courses['Not sure yet']);
    await bot(P.role==='mentor'?'Tap the classes you’ve taken or could teach.':'Tap the classes you’ve taken or are taking.');
    chips(list,async function(picked){P.courses=picked;progress();
      await bot(picked.length?(picked.length+' class'+(picked.length>1?'es':'')+'. Nice.'):'No worries, your mentor will help you pick your first one.');
      if(P.role==='mentor'){await bot('What can you help mentees with?');ask('e.g. portfolio reviews, interview practice',goal)}
      else{await bot("What's the one thing you want in the next 6 months?");ask('Your goal',goal,C.goals[P.career]||C.goals[P.career.indexOf('Engineering')===0?'Engineering':'']||[])}
    },{multi:true,allowEmpty:P.role==='mentee',placeholder:'Other courses (comma-separated)'})});
}
async function goal(g){P.goal=g;progress();
  var t=await react('goal',g);if(t)await bot(t);
  await bot('When are you usually free?');
  chips(C.availability,async function(a){P.availability=a;progress();
    await bot('And where do you want to meet?');
    chips(['Online','Phoenix','Scottsdale','East Valley','West Valley'],async function(w){if(w==='Online'){P.format='Online';P.area='Online only'}else{P.format='Both';P.area=w}progress();
      if(P.role==='mentor'){await bot('How many mentees can you take on? Slide or type it.');howMany(function(n){P.capacity=n;fun()})}
      else{await bot('How confident do you feel about tech right now? 1 to 10.');chips(['1','2','3','4','5','6','7','8','9','10'],function(n){P.confidence=+n;fun()})}
    })})}
async function fun(){progress();
  await bot('Fun one! Off the clock, what are you into? Pick any.');
  chips(C.fun,async function(picked){P.interests=picked;progress();
    await bot(picked.length?'Love it. That helps us find someone you’ll actually click with.':'All good, mystery mode it is.');consent()},{multi:true,allowEmpty:true,done:'That’s me',placeholder:'Something else? (comma-separated)'})}
async function consent(){progress();
  await bot("Last thing: you're 18+ and OK with us saving your answers to run the program?");
  chips(["I'm 18+ and that's fine",'Not right now'],async function(c){
    if(c==='Not right now'){await bot('No problem. Come back anytime 🔥');return}
    await bot(P.role==='mentor'?'Saving your profile…':'Lighting your matches…');
    fetch('/api/chat/finish',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(P)}).then(function(r){return r.json()}).then(function(d){
      if(!d.url){bot('Something went wrong saving that. Try the classic signup?');return}
      burst();setTimeout(function(){location.href=d.url},900)}).catch(function(){bot('Something went wrong saving that. Try the classic signup?')})})}
function burst(){for(var i=0;i<26;i++){var s=document.createElement('span');s.textContent='🔥';s.setAttribute('aria-hidden','true');
  s.style.cssText='position:fixed;z-index:8;pointer-events:none;font-size:'+(16+Math.random()*22)+'px;left:'+(Math.random()*100)+'vw;top:100vh;transition:transform 1.4s ease-out,opacity 1.4s';
  document.body.appendChild(s);(function(s){setTimeout(function(){s.style.transform='translateY(-'+(50+Math.random()*60)+'vh)';s.style.opacity='0'},30);setTimeout(function(){s.remove()},1600)})(s)}}
run();
</script>`;
  return html(layout("Chat with ember", body, "/start", "Chat with ember to get matched with a TechWomenAZ mentor who has taken your courses."));
}

const pick = (v: unknown, list: string[], d: string) => (typeof v === "string" && list.includes(v) ? v : d);
const txt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function chatReact(req: Request, env: Env): Promise<Response> {
  const b = (await req.json().catch(() => ({}))) as { step?: string; answer?: string; profile?: Record<string, unknown> };
  const step = b.step === "goal" ? "goal" : "field";
  const answer = txt(b.answer, 200);
  const name = txt(b.profile?.name, 40);
  const mentor = b.profile?.role === "mentor";
  const fallback =
    step === "field"
      ? `${answer} is a great path, and TechWomenAZ has mentors working in it right now.`
      : mentor
        ? "That's exactly the kind of help mentees ask for."
        : "Love that goal. Let's find someone who has already done it.";
  const t = await ai.ask(
    env,
    "You are ember, the upbeat AI matchmaker for TechWomenAZ's mentorship program in Phoenix. Reply with ONE short, specific, encouraging sentence (max 22 words). No questions. No hashtags. At most one emoji.",
    step === "field"
      ? `${name || "The user"} (${mentor ? "a mentor" : "a mentee"}) is going into ${answer}. React to that choice with one concrete, true detail about the field.`
      : `${name || "The user"} (${mentor ? "a mentor who can help with" : "a mentee whose goal is"}): "${answer}". React to it.`,
    60,
  );
  return Response.json({ text: (t ?? fallback).split("\n")[0] });
}

export async function chatFinish(req: Request, env: Env): Promise<Response> {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = txt(b.name, 80);
  const goal = txt(b.goal, 200);
  if (!name || !goal) return Response.json({ error: "missing name or goal" }, { status: 400 });
  const role = b.role === "mentor" ? "mentor" : "mentee";
  const courses = (Array.isArray(b.courses) ? b.courses : [])
    .map((c) => txt(c, 60))
    .filter(Boolean)
    .slice(0, 12)
    .join(", ");
  const id = await db.createUser(env.DB, {
    name,
    role,
    career: normCareer(b.career),
    no_degree: b.no_degree ? 1 : 0,
    goal,
    headline: txt(b.headline, 120),
    courses,
    school: "",
    availability: pick(b.availability, AVAILABILITY, "Flexible"),
    format: pick(b.format, FORMATS, "Both"),
    area: pick(b.area, AREAS, "Phoenix"),
    confidence: clamp(Number(b.confidence) || 5, 1, 10),
    capacity: role === "mentor" ? clamp(Math.round(Number(b.capacity)) || 2, 1, 20) : 0,
    interests: (Array.isArray(b.interests) ? b.interests : [])
      .map((c) => txt(c, 30))
      .filter(Boolean)
      .slice(0, 8)
      .join(", "),
  });
  const next = role === "mentor" ? `/mentor/${id}` : `/matches/${id}?new=1`;
  // /enter signs the new profile in (demo cookie) and then lands on their page.
  return Response.json({ id, url: `/enter?key=u:${id}&next=${encodeURIComponent(next)}` });
}
