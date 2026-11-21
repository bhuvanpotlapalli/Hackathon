// Shared layout, styles, and small HTML helpers.

import { STATUS_LABEL, type Flame, type Status } from "./logic";

/** HTML-escape any user-supplied text before it goes into a page. */
export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

const FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🔥</text></svg>`);

const CSS = `
:root{--plum:#2B1A3D;--sand:#FBF4EC;--ember:#FF6B35;--gold:#FFB627;--sage:#4F9D69;--ink:#2a2230;--muted:#6f6577;--card:#fff;--line:#eadfd3}
*{box-sizing:border-box}
body{margin:0;background:var(--sand);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
h1,h2,h3,.brand{font-family:"Space Grotesk",system-ui,sans-serif;line-height:1.15;margin:0 0 .5rem}
a{color:var(--ember)}
nav{background:var(--plum);color:#fff;display:flex;gap:1rem;align-items:center;padding:.75rem 1rem;flex-wrap:wrap}
nav a{color:#fff;text-decoration:none;opacity:.85;padding:.35rem .2rem}
nav a:hover,nav a[aria-current]{opacity:1;border-bottom:2px solid var(--gold)}
.brand{font-size:1.35rem;font-weight:700;margin:0 auto 0 0;color:#fff!important;opacity:1!important;border:0!important}
main{max-width:1040px;margin:0 auto;padding:1.25rem 1rem 3rem}
.hero{background:linear-gradient(160deg,var(--plum),#4a2747 70%,#7a3a3a);color:#fff;border-radius:20px;padding:2.5rem 1.5rem;margin-bottom:1.5rem;position:relative;overflow:hidden}
.hero h1{font-size:clamp(1.9rem,5vw,3rem)}
.hero p{opacity:.9;max-width:36rem}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:1.1rem 1.2rem;box-shadow:0 2px 10px rgba(43,26,61,.06)}
.grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
.row{display:flex;gap:.75rem;flex-wrap:wrap;align-items:center}
.btn{display:inline-block;background:var(--ember);color:#fff;border:0;border-radius:12px;padding:.75rem 1.15rem;font:600 1rem system-ui;cursor:pointer;text-decoration:none;min-height:44px}
.btn:hover{filter:brightness(1.05)}
.btn.ghost{background:transparent;color:var(--ember);border:2px solid var(--ember)}
.btn.light{background:#fff;color:var(--plum)}
.btn.small{padding:.45rem .8rem;font-size:.9rem;min-height:36px}
.chip{display:inline-block;background:#fff3e6;color:#8a3d12;border-radius:999px;padding:.2rem .65rem;font-size:.82rem;margin:.15rem .25rem .15rem 0}
.chip.sage{background:#e8f4ec;color:#2d6a42}
.chip.plum{background:#efe8f6;color:var(--plum)}
.muted{color:var(--muted)}
.score{font:700 1.6rem "Space Grotesk",sans-serif;color:var(--ember)}
label{display:block;font-weight:600;margin:.8rem 0 .3rem}
input,select,textarea{accent-color:var(--ember);width:100%;padding:.7rem;border:1px solid #d9cbbd;border-radius:10px;font:inherit;background:#fff;min-height:44px}
input[type=checkbox],input[type=radio]{width:auto;min-height:0;margin-right:.4rem;transform:scale(1.2)}
.check{display:flex;align-items:center;font-weight:500}
fieldset{border:0;padding:0;margin:0}
.two{display:grid;gap:0 1rem;grid-template-columns:1fr 1fr}
@media (max-width:600px){.two{grid-template-columns:1fr}}
.stats{display:grid;gap:.75rem;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:1.25rem}
.stat b{display:block;font:700 1.8rem "Space Grotesk",sans-serif;color:var(--plum)}
.toast{position:fixed;left:50%;bottom:1.25rem;transform:translateX(-50%);background:var(--plum);color:#fff;padding:.9rem 1.2rem;border-radius:12px;max-width:92vw;box-shadow:0 8px 30px rgba(0,0,0,.25);display:none;z-index:9}
.status{font-weight:700}
.st-Blazing{color:#c2410c}.st-Glowing{color:#b45309}.st-Flickering{color:#8a6d00}.st-Embers{color:#555}
.milestone{display:flex;align-items:center;gap:.5rem;padding:.4rem 0;border-bottom:1px dashed var(--line)}
.milestone.done span{text-decoration:line-through;color:var(--muted)}
.notice{background:#e8f4ec;border:1px solid #bfe0ca;color:#24543a;border-radius:12px;padding:.75rem 1rem;margin-bottom:1rem}
footer{text-align:center;color:var(--muted);font-size:.85rem;padding:2rem 1rem}

/* ---- The flame: pure CSS, size scales with heat ---- */
.flame-wrap{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:calc(var(--max,200px) + 20px)}
.flame{position:relative;width:calc(var(--s) * .62);height:var(--s);transition:all 1.2s cubic-bezier(.2,1.4,.4,1)}
.flame i{position:absolute;left:50%;bottom:0;transform:translateX(-50%);border-radius:50% 50% 45% 45% / 60% 60% 40% 40%;animation:flick 1.6s ease-in-out infinite alternate;transform-origin:50% 90%}
.flame .o{width:100%;height:100%;background:radial-gradient(circle at 50% 75%,var(--gold),var(--ember) 55%,rgba(255,107,53,0) 72%);filter:blur(1px)}
.flame .m{width:66%;height:72%;background:radial-gradient(circle at 50% 80%,#fff3c4,var(--gold) 60%,rgba(255,182,39,0) 75%);animation-duration:1.1s}
.flame .c{width:34%;height:40%;background:radial-gradient(circle at 50% 80%,#fff,#fff6d8 60%,rgba(255,255,255,0) 75%);animation-duration:.8s}
.flame.Flickering i{animation-duration:.45s}
.flame.Flickering .o{opacity:.8}
.flame.Embers i{animation:glow 2.4s ease-in-out infinite alternate;border-radius:50%}
.flame.Embers .o{background:radial-gradient(circle,#ff8a50,#7a2e12 55%,rgba(60,30,20,0) 72%);height:40%;width:100%}
.flame.Embers .m,.flame.Embers .c{display:none}
.logs{width:calc(var(--max,200px) * .55);height:10px;background:linear-gradient(90deg,#5b3a29,#8b5a3c,#5b3a29);border-radius:6px;margin-top:-2px}
@keyframes flick{0%{transform:translateX(-50%) scale(1,1) skewX(0)}50%{transform:translateX(-50%) scale(.96,1.04) skewX(2deg)}100%{transform:translateX(-50%) scale(1.03,.97) skewX(-2deg)}}
@keyframes glow{from{opacity:.55}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.flame i{animation:none!important}.flame{transition:none}}
.mini{display:flex;flex-direction:column;align-items:center;text-decoration:none;color:inherit}
.mini .flame-wrap{--max:90px}
@media print{nav,.no-print,footer{display:none}body{background:#fff}.card{box-shadow:none}}
/* ================= Visual layer: motion, glow, depth ================= */
body{background:
  radial-gradient(1200px 500px at 85% -10%,rgba(255,182,39,.18),transparent 60%),
  radial-gradient(900px 500px at -10% 10%,rgba(255,107,53,.12),transparent 60%),
  var(--sand);background-attachment:fixed}
nav{position:sticky;top:0;z-index:7;background:rgba(43,26,61,.86);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 6px 24px rgba(43,26,61,.25)}
.brand .word{background:linear-gradient(90deg,#fff,var(--gold),var(--ember));-webkit-background-clip:text;background-clip:text;color:transparent}
.brand .ico{display:inline-block;animation:bob 2.4s ease-in-out infinite}
h1{letter-spacing:-.02em}
.grad{background:linear-gradient(90deg,var(--ember),var(--gold) 50%,var(--ember));background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:shine 6s linear infinite}

/* cards: lift + glow border + entrance */
.card{position:relative;transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s;backdrop-filter:blur(4px)}
.card:hover{transform:translateY(-4px);box-shadow:0 14px 34px rgba(255,107,53,.18),0 2px 8px rgba(43,26,61,.08)}
.card::before{content:"";position:absolute;inset:-1px;border-radius:inherit;padding:1px;background:linear-gradient(135deg,rgba(255,107,53,.0),rgba(255,182,39,.0));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;transition:background .35s;pointer-events:none}
.card:hover::before{background:linear-gradient(135deg,var(--ember),var(--gold))}
.reveal{opacity:0;transform:translateY(18px)}
.reveal.in{opacity:1;transform:none;transition:opacity .7s ease,transform .7s cubic-bezier(.2,.8,.2,1)}

/* buttons: gradient, glow, shine sweep */
.btn{background:linear-gradient(135deg,var(--ember),#ff8a3d 60%,var(--gold));box-shadow:0 6px 18px rgba(255,107,53,.35);position:relative;overflow:hidden;transition:transform .2s,box-shadow .2s}
.btn:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(255,107,53,.5)}
.btn::after{content:"";position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.45),transparent);transform:skewX(-20deg);transition:left .6s}
.btn:hover::after{left:130%}
.btn.ghost{background:transparent;box-shadow:none}
.btn.light{background:#fff;color:var(--plum);box-shadow:0 6px 18px rgba(0,0,0,.18)}
.chip{transition:transform .2s}.chip:hover{transform:scale(1.06)}

/* floating embers (whole site) */
.embers{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
.embers i{position:absolute;bottom:-20px;width:6px;height:6px;border-radius:50%;background:radial-gradient(circle,#fff6d0,var(--gold) 40%,var(--ember) 70%,transparent 72%);box-shadow:0 0 10px 2px rgba(255,140,50,.6);opacity:0;animation:rise linear infinite}
main,footer{position:relative;z-index:1}

/* ---------- HERO: animated Arizona sunset ---------- */
.hero{padding:0;min-height:440px;display:flex;align-items:center;background:linear-gradient(180deg,#1b0f2b 0%,#3a1d4a 30%,#8a3552 55%,#e2603f 75%,#ffb05a 100%);background-size:100% 160%;animation:dusk 14s ease-in-out infinite alternate;box-shadow:0 24px 60px rgba(43,26,61,.35)}
.hero .inner{position:relative;z-index:3;padding:3rem 1.75rem 7.5rem;max-width:620px}
.hero h1{font-size:clamp(2.2rem,6vw,3.6rem);text-shadow:0 4px 30px rgba(0,0,0,.35)}
.hero .tag{display:inline-block;font:600 .8rem system-ui;letter-spacing:.12em;text-transform:uppercase;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);padding:.35rem .8rem;border-radius:999px;margin-bottom:1rem}
.hero .sun{position:absolute;right:12%;bottom:26%;width:190px;height:190px;border-radius:50%;background:radial-gradient(circle,#fff3c4,#ffc35a 45%,#ff7a3d 70%,rgba(255,107,53,0) 72%);filter:blur(.5px);animation:pulse 5s ease-in-out infinite;z-index:1}
.hero .stars{position:absolute;inset:0 0 50% 0;background-image:radial-gradient(1.5px 1.5px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 70% 20%,#fff,transparent),radial-gradient(1.5px 1.5px at 40% 12%,#fff,transparent),radial-gradient(1px 1px at 85% 40%,#fff,transparent),radial-gradient(1px 1px at 10% 8%,#fff,transparent),radial-gradient(1.5px 1.5px at 58% 35%,#fff,transparent),radial-gradient(1px 1px at 92% 10%,#fff,transparent);animation:twinkle 4s ease-in-out infinite alternate;z-index:0}
.hero svg.land{position:absolute;left:0;right:0;bottom:0;width:100%;height:46%;z-index:2}
.hero .bigflame{position:absolute;right:9%;bottom:8%;z-index:3}
.hero .bigflame .flame-wrap{--max:170px}
@media (max-width:700px){.hero .sun{width:70px;height:70px;right:14px;top:14px;bottom:auto;opacity:.85}.hero .tag{margin-right:70px}.hero .bigflame{display:none}.hero .inner{padding-bottom:6rem}}

/* steps row */
.steps .card h3{display:flex;align-items:center;gap:.6rem}
.steps .num{display:inline-grid;place-items:center;width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,var(--ember),var(--gold));color:#fff;font:700 1.1rem "Space Grotesk";box-shadow:0 6px 16px rgba(255,107,53,.35)}
.steps .emoji{font-size:2.2rem;display:block;margin-bottom:.3rem;animation:bob 3s ease-in-out infinite}
.steps .card:nth-child(2) .emoji{animation-delay:.4s}.steps .card:nth-child(3) .emoji{animation-delay:.8s}.steps .card:nth-child(4) .emoji{animation-delay:1.2s}

/* match score ring */
.ring{--p:0;width:74px;height:74px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--ember) calc(var(--p)*1%),#f3e6da 0);transition:--p 1s;flex:none}
.ring b{display:grid;place-items:center;width:58px;height:58px;border-radius:50%;background:#fff;font:700 1.15rem "Space Grotesk";color:var(--ember)}
.topmatch{border:2px solid transparent!important;background:linear-gradient(#fff,#fff) padding-box,linear-gradient(135deg,var(--ember),var(--gold)) border-box!important}
.badge{position:absolute;top:-12px;left:16px;background:linear-gradient(135deg,var(--ember),var(--gold));color:#fff;font:700 .75rem system-ui;padding:.25rem .6rem;border-radius:999px;box-shadow:0 4px 12px rgba(255,107,53,.4)}

/* page banner (dark night) */
.banner{position:relative;overflow:hidden;border-radius:20px;padding:1.6rem 1.5rem;margin-bottom:1.25rem;color:#fff;background:linear-gradient(135deg,#1b0f2b,#3a1d4a 60%,#6b2c4a);box-shadow:0 18px 40px rgba(43,26,61,.3)}
.banner h1{color:#fff}.banner p{opacity:.85;margin:.2rem 0 0}
.banner::after{content:"";position:absolute;inset:0;background-image:radial-gradient(1.5px 1.5px at 15% 25%,#fff,transparent),radial-gradient(1px 1px at 65% 15%,#fff,transparent),radial-gradient(1.5px 1.5px at 85% 60%,#fff,transparent),radial-gradient(1px 1px at 35% 70%,#fff,transparent),radial-gradient(1px 1px at 92% 22%,#fff,transparent);animation:twinkle 3s ease-in-out infinite alternate;pointer-events:none}
.banner .btn.ghost{color:#fff;border-color:rgba(255,255,255,.6)}
.stat{overflow:hidden}
.stat::after{content:"";position:absolute;right:-20px;bottom:-20px;width:90px;height:90px;border-radius:50%;background:radial-gradient(circle,rgba(255,182,39,.25),transparent 70%)}
.stat b{background:linear-gradient(135deg,var(--plum),var(--ember));-webkit-background-clip:text;background-clip:text;color:transparent}
.mini{background:linear-gradient(180deg,#fff 0%,#fff 55%,#fff4ea 100%)}
.mini.st-hot{box-shadow:0 0 0 1px rgba(255,107,53,.2),0 10px 30px rgba(255,107,53,.18)}
.barfill{animation:grow 1.4s cubic-bezier(.2,.8,.2,1) both}

@keyframes rise{0%{transform:translateY(0) translateX(0) scale(1);opacity:0}10%{opacity:.9}100%{transform:translateY(-105vh) translateX(var(--dx,30px)) scale(.4);opacity:0}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes shine{to{background-position:200% center}}
@keyframes dusk{from{background-position:0 0}to{background-position:0 100%}}
@keyframes pulse{0%,100%{transform:scale(1);opacity:.95}50%{transform:scale(1.06);opacity:1}}
@keyframes twinkle{from{opacity:.4}to{opacity:1}}
@keyframes grow{from{transform:scaleX(0);transform-origin:left}to{transform:scaleX(1);transform-origin:left}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}.reveal{opacity:1;transform:none}.embers{display:none}}
/* taste-skill ideas: hero enters once, buttons press, underlines draw */
.hero .inner>*{opacity:0;transform:translateY(16px);animation:enter .8s cubic-bezier(.2,.8,.2,1) forwards}
.hero .inner>*:nth-child(2){animation-delay:.12s}.hero .inner>*:nth-child(3){animation-delay:.24s}.hero .inner>*:nth-child(4){animation-delay:.36s}
.hero .bigflame{opacity:0;animation:enter 1.1s .45s cubic-bezier(.2,.8,.2,1) forwards}
.btn:active{transform:translateY(0) scale(.97)}
nav a:not(.brand){border-bottom:0!important;background:linear-gradient(var(--gold),var(--gold)) no-repeat left bottom/0 2px;transition:background-size .3s}
nav a:not(.brand):hover,nav a[aria-current]{background-size:100% 2px}
@keyframes enter{to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.hero .inner>*,.hero .bigflame{opacity:1!important;transform:none!important}}
`;

export function layout(title: string, body: string, active = "", description = "Ember: mentorships that don't fizzle out. Built for TechWomenAZ."): string {
  const link = (href: string, label: string) =>
    `<a href="${href}"${active === href ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Ember</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<nav aria-label="Main"><a class="brand" href="/"><span class="ico">🔥</span> <span class="word">ember</span></a>${link("/", "Home")}${link("/join", "Join")}${link("/opportunities", "Opportunities")}${link("/campfire", "Campfire")}</nav>
<div class="embers" aria-hidden="true"><i style="left:0%;animation-duration:9s;animation-delay:0s;--dx:-40px;width:3px;height:3px"></i><i style="left:37%;animation-duration:16s;animation-delay:2s;--dx:-11px;width:4px;height:4px"></i><i style="left:74%;animation-duration:14s;animation-delay:4s;--dx:18px;width:5px;height:5px"></i><i style="left:11%;animation-duration:12s;animation-delay:6s;--dx:-33px;width:6px;height:6px"></i><i style="left:48%;animation-duration:10s;animation-delay:8s;--dx:-4px;width:3px;height:3px"></i><i style="left:85%;animation-duration:17s;animation-delay:10s;--dx:25px;width:4px;height:4px"></i><i style="left:22%;animation-duration:15s;animation-delay:1s;--dx:-26px;width:5px;height:5px"></i><i style="left:59%;animation-duration:13s;animation-delay:3s;--dx:3px;width:6px;height:6px"></i><i style="left:96%;animation-duration:11s;animation-delay:5s;--dx:32px;width:3px;height:3px"></i><i style="left:33%;animation-duration:9s;animation-delay:7s;--dx:-19px;width:4px;height:4px"></i><i style="left:70%;animation-duration:16s;animation-delay:9s;--dx:10px;width:5px;height:5px"></i><i style="left:7%;animation-duration:14s;animation-delay:0s;--dx:39px;width:6px;height:6px"></i><i style="left:44%;animation-duration:12s;animation-delay:2s;--dx:-12px;width:3px;height:3px"></i><i style="left:81%;animation-duration:10s;animation-delay:4s;--dx:17px;width:4px;height:4px"></i><i style="left:18%;animation-duration:17s;animation-delay:6s;--dx:-34px;width:5px;height:5px"></i><i style="left:55%;animation-duration:15s;animation-delay:8s;--dx:-5px;width:6px;height:6px"></i><i style="left:92%;animation-duration:13s;animation-delay:10s;--dx:24px;width:3px;height:3px"></i><i style="left:29%;animation-duration:11s;animation-delay:1s;--dx:-27px;width:4px;height:4px"></i></div>
<main>${body}</main>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<footer>Ember for TechWomenAZ · FireBytes 2026 · Every phoenix starts as an ember.</footer>
<script>
(function(){
  // Scroll/entrance reveal for cards, staggered
  var els=document.querySelectorAll('main .card');
  els.forEach(function(el,i){el.classList.add('reveal');el.style.transitionDelay=Math.min(i,10)*60+'ms';});
  var io='IntersectionObserver' in window?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}})},{threshold:.08}):null;
  els.forEach(function(el){io?io.observe(el):el.classList.add('in')});
  // Count-up numbers: <b data-count="70" data-suffix="%">
  document.querySelectorAll('[data-count]').forEach(function(el){var to=parseFloat(el.dataset.count),dec=(el.dataset.count.split('.')[1]||'').length,pre=el.dataset.prefix||'',suf=el.dataset.suffix||'',t0=null;
    function step(t){if(!t0)t0=t;var k=Math.min(1,(t-t0)/1200),e=1-Math.pow(1-k,3);el.textContent=pre+(to*e).toFixed(dec)+suf;if(k<1)requestAnimationFrame(step)}requestAnimationFrame(step);});
  // Score rings animate from 0
  document.querySelectorAll('.ring[data-p]').forEach(function(r){var to=+r.dataset.p,t0=null;function st(t){if(!t0)t0=t;var k=Math.min(1,(t-t0)/1100),e=1-Math.pow(1-k,3);r.style.setProperty('--p',(to*e).toFixed(1));r.querySelector('b').textContent=Math.round(to*e)+'%';if(k<1)requestAnimationFrame(st)}requestAnimationFrame(st);});
})();
function toast(msg){var t=document.getElementById('toast');t.textContent=msg;t.style.display='block';clearTimeout(window.__tt);window.__tt=setTimeout(function(){t.style.display='none'},4500)}
</script>
</body></html>`;
}

/** Flame size in px for a given heat (0–100). */
export function flameSize(heat: number, max = 200): number {
  return Math.round(max * (0.28 + 0.72 * (heat / 100)));
}

export function flameHtml(f: Flame, max = 200, id = ""): string {
  return `<div class="flame-wrap" style="--max:${max}px" aria-hidden="true">
  <div class="flame ${f.status}"${id ? ` id="${id}"` : ""} style="--s:${flameSize(f.heat, max)}px"><i class="o"></i><i class="m"></i><i class="c"></i></div>
  <div class="logs"></div></div>`;
}

export function statusHtml(s: Status): string {
  return `<span class="status st-${s}">${STATUS_LABEL[s]}</span>`;
}

export function options(list: string[], selected = ""): string {
  return list.map((o) => `<option${o === selected ? " selected" : ""}>${esc(o)}</option>`).join("");
}

export function chips(list: string[], cls = ""): string {
  return list.map((r) => `<span class="chip ${cls}">${esc(r)}</span>`).join("");
}
