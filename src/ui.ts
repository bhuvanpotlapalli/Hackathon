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
/* ================= Visual system (taste-skill rules: one ground, quiet hover, one entrance) ================= */
:root{--ink:#1f1729;--line:#e7dccf;--ease-enter:cubic-bezier(.22,1,.36,1)}
body{background:var(--sand);color:var(--ink)}
h1,h2,h3{letter-spacing:-.025em}
h1{font-weight:700}
nav{position:sticky;top:0;z-index:7;background:var(--plum);box-shadow:none;border-bottom:1px solid rgba(255,255,255,.08)}
nav a:not(.brand){opacity:.78;border-bottom:0!important;background:linear-gradient(#fff,#fff) no-repeat left calc(100% - 2px)/0 1px;transition:background-size .15s ease,opacity .15s}
nav a:not(.brand):hover{opacity:1;background-size:100% 1px}
nav a[aria-current]{opacity:1;background:linear-gradient(var(--gold),var(--gold)) no-repeat left bottom/100% 2px}
.brand{letter-spacing:-.02em}.brand .ico{margin-right:.15rem}
.accent{color:var(--ember)}
.hero .accent{color:var(--gold)}

/* Cards: flat, hairline; only linked cards lift 2px */
.card{box-shadow:none;border:1px solid var(--line);transition:transform .18s ease,border-color .18s,box-shadow .18s}
a.card:hover{transform:translateY(-2px);border-color:#d6c6b5;box-shadow:0 10px 24px rgba(31,23,41,.08)}

/* Buttons: solid fill, step 1px up, press 1px down + .985 */
.btn{background:var(--ember);box-shadow:none;transition:transform .15s ease,background-color .15s ease}
.btn:hover{background:#e85a26;transform:translateY(-1px)}
.btn:active{transform:translateY(1px) scale(.985);transition-duration:.09s}
.btn.ghost{background:transparent;color:var(--ember);border:1.5px solid var(--ember)}
.btn.ghost:hover{background:rgba(255,107,53,.08)}
.btn.light{background:#fff;color:var(--plum);box-shadow:none}
.btn.light:hover{background:#f3ece5}

/* ---------- HERO: still Arizona dusk ground + Ember's own Campfire screen ---------- */
.hero{padding:0;min-height:520px;display:grid;grid-template-columns:1.05fr 1fr;align-items:center;gap:2rem;background:linear-gradient(180deg,#1d1030 0%,#3b1c47 38%,#7c3150 66%,#d75b3c 88%,#f39a4f 100%);border-radius:24px;box-shadow:none}
.hero .inner{position:relative;z-index:3;padding:3.25rem 0 3.25rem 2.5rem}
.hero h1{font-size:clamp(2.4rem,5.4vw,4rem);line-height:1.02;margin-bottom:1rem}
.hero p{font-size:1.1rem;opacity:.88}
.hero .tag{display:inline-block;font:600 .78rem system-ui;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.8);margin-bottom:1.1rem}
.hero svg.land{position:absolute;left:0;right:0;bottom:0;width:100%;height:34%;z-index:1;pointer-events:none}
.hero .shot{position:relative;z-index:3;padding:2.5rem 2.5rem 2.5rem 0}
@media (max-width:860px){.hero{grid-template-columns:1fr}.hero .inner{padding:2.5rem 1.4rem 0}.hero .shot{padding:0 1rem 2rem}}

/* App frame: the real Campfire, small */
.app{background:#fffaf4;border-radius:16px;box-shadow:0 30px 60px rgba(20,8,30,.45),0 0 0 1px rgba(255,255,255,.12);overflow:hidden;color:var(--ink);text-decoration:none;display:block;transition:transform .18s ease}
.app:hover{transform:translateY(-2px)}
.app .bar{display:flex;align-items:center;gap:6px;padding:.6rem .8rem;background:#f1e7dc;border-bottom:1px solid var(--line);font:600 .78rem system-ui;color:#6f6577}
.app .bar i{width:10px;height:10px;border-radius:50%;background:#e0d2c4}
.app .bar span{margin-left:.5rem}
.app .rows{padding:.4rem .9rem .8rem}
.app .r{display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:.7rem;padding:.5rem 0;border-bottom:1px solid #f0e6dc}
.app .r:last-child{border-bottom:0}
.app .r .flame-wrap{--max:44px;height:50px}
.app .r .logs{height:5px}
.app .nm{font-weight:600;font-size:.95rem;line-height:1.2}
.app .sub{font-size:.8rem;color:#6f6577}
.app .meter{width:84px;height:6px;border-radius:6px;background:#efe3d6;overflow:hidden}
.app .meter b{display:block;height:100%;background:var(--ember);border-radius:6px}

/* Split-text hero entrance: words rise once, under 1.1s total */
[data-split] .w{display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.08em;margin-bottom:-.08em}
[data-split] .w>span{display:inline-block;transform:translateY(105%);animation:wordUp .7s var(--ease-enter) forwards}
.hero .inner>p,.hero .inner>.row{opacity:0;transform:translateY(10px);animation:enter .6s var(--ease-enter) .45s forwards}
.hero .shot{opacity:0;transform:translateY(16px);animation:enter .8s var(--ease-enter) .3s forwards}
@keyframes wordUp{to{transform:none}}
@keyframes enter{to{opacity:1;transform:none}}

/* Steps */
.steps .card h3{display:flex;align-items:center;gap:.6rem}
.steps .num{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:8px;background:var(--plum);color:#fff;font:700 .95rem "Space Grotesk"}

/* Match score ring */
.ring{--p:0;width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--ember) calc(var(--p)*1%),#f1e5d8 0);flex:none}
.ring b{display:grid;place-items:center;width:50px;height:50px;border-radius:50%;background:#fff;font:700 1rem "Space Grotesk";color:var(--ink)}
.topmatch{border-color:var(--ember)!important}
.badge{position:absolute;top:-11px;left:16px;background:var(--ember);color:#fff;font:700 .72rem system-ui;letter-spacing:.04em;text-transform:uppercase;padding:.22rem .6rem;border-radius:6px}

/* Page banners: plum ground, no stars */
.banner{position:relative;border-radius:18px;padding:1.5rem 1.5rem;margin-bottom:1.25rem;color:#fff;background:var(--plum)}
.banner h1{color:#fff;font-size:clamp(1.6rem,3.6vw,2.3rem)}.banner p{opacity:.8;margin:.2rem 0 0}
.banner .btn.ghost{color:#fff;border-color:rgba(255,255,255,.55)}
.banner .btn.ghost:hover{background:rgba(255,255,255,.08)}
.stat b{color:var(--ink)}
.barfill{transform-origin:left;animation:grow 1s var(--ease-enter) both}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}[data-split] .w>span,.hero .inner>p,.hero .inner>.row,.hero .shot{transform:none!important;opacity:1!important}}
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
<main>${body}</main>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<footer>Ember · built for TechWomenAZ at FireBytes 2026 · people and postings shown are demo data</footer>
<script>
(function(){
  // Split text: wrap each word of [data-split] so it rises once on load (text stays in the HTML)
  document.querySelectorAll('[data-split]').forEach(function(h){var i=0;
    (function walk(node){Array.from(node.childNodes).forEach(function(n){
      if(n.nodeType===3){var frag=document.createDocumentFragment();n.textContent.split(/(\s+)/).forEach(function(part){
        if(!part)return;if(/^\s+$/.test(part)){frag.appendChild(document.createTextNode(part));return}
        var w=document.createElement('span');w.className='w';var inner=document.createElement('span');inner.textContent=part;inner.style.animationDelay=(i++*70)+'ms';w.appendChild(inner);frag.appendChild(w);});
        n.parentNode.replaceChild(frag,n);}
      else if(n.nodeType===1)walk(n);});})(h);});
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
