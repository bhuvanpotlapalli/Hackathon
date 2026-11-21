import { LOGO_MARK, FAVICON_PNG } from "./logo";
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
.brand{letter-spacing:-.02em;display:inline-flex;align-items:center;gap:.45rem}.brand .logo{width:30px;height:30px;transition:transform .35s cubic-bezier(.34,1.56,.64,1)}.brand:hover .logo{transform:rotate(-8deg) scale(1.12)}
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

/* ---------- Spark chat ---------- */
.chatwrap{max-width:680px;margin:0 auto}
.chathead{display:flex;align-items:center;gap:.8rem;background:var(--plum);color:#fff;border-radius:18px 18px 0 0;padding:.9rem 1.1rem;position:relative;overflow:hidden}
.chathead .muted{color:rgba(255,255,255,.7)}
.avatar{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 50% 65%,var(--gold),var(--ember) 70%);font-size:1.4rem;animation:breathe 2.4s ease-in-out infinite}
.prog{position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(255,255,255,.12)}
.prog b{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--ember),var(--gold));transition:width .5s var(--ease-enter)}
.msgs{background:#fffaf4;border:1px solid var(--line);border-top:0;height:min(52vh,460px);overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.55rem;scroll-behavior:smooth}
.msg{max-width:84%;padding:.65rem .9rem;border-radius:16px;line-height:1.4;animation:pop .28s var(--ease-enter) both}
.msg.bot{align-self:flex-start;background:#fff;border:1px solid var(--line);border-bottom-left-radius:4px}
.msg.me{align-self:flex-end;background:var(--ember);color:#fff;border-bottom-right-radius:4px}
.msg.typing{display:flex;gap:4px;padding:.8rem .9rem}
.msg.typing span{width:7px;height:7px;border-radius:50%;background:#c9b8a8;animation:dot 1s infinite}
.msg.typing span:nth-child(2){animation-delay:.15s}.msg.typing span:nth-child(3){animation-delay:.3s}
.dock{background:#fff;border:1px solid var(--line);border-top:0;border-radius:0 0 18px 18px;padding:.9rem;min-height:84px;display:flex;flex-direction:column;gap:.6rem}
.chips{display:flex;flex-wrap:wrap;gap:.5rem}
.chip-btn{border:1.5px solid var(--ember);background:#fff;color:var(--ink);border-radius:999px;padding:.55rem .95rem;font:600 .95rem system-ui;cursor:pointer;min-height:42px;animation:pop .3s var(--ease-enter) both;transition:transform .15s,background-color .15s}
.chip-btn:hover{transform:translateY(-1px);background:#fff3ea}
.chip-btn:active{transform:translateY(1px) scale(.985)}
.chip-btn.on,.chip-btn.on:hover,html[data-theme=dark] .chip-btn.on,html[data-theme=dark] .chip-btn.on:hover{background:var(--ember);border-color:var(--ember);color:#fff;opacity:1}
.chip-btn.on::before{content:'✓ ';font-weight:700}
.howmany{display:grid;gap:.6rem;justify-items:center}.hm-big{font:700 3rem "Space Grotesk",system-ui;color:var(--ember);line-height:1}.hm-big.bump{animation:bump .35s cubic-bezier(.34,1.56,.64,1)}
@keyframes bump{from{transform:scale(1.35)}to{transform:none}}
.hm-row{display:flex;gap:.7rem;align-items:center;width:100%}.hm-num{width:5.5rem!important;flex:none;text-align:center;font-weight:700}
input.hm-range{flex:1;-webkit-appearance:none;appearance:none;height:10px!important;min-height:0!important;padding:0!important;border:0!important;box-shadow:none!important;border-radius:99px;background:linear-gradient(var(--ember),var(--ember)) no-repeat 0/var(--p,11%) 100%,rgba(128,128,128,.28)!important;cursor:pointer;margin:0}
.hm-range::-webkit-slider-thumb{-webkit-appearance:none;width:28px;height:28px;border-radius:50%;background:var(--ember);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);transition:transform .15s}.hm-range::-webkit-slider-thumb:hover{transform:scale(1.15)}
.hm-range::-moz-range-thumb{width:24px;height:24px;border-radius:50%;background:var(--ember);border:3px solid #fff}
.chat-hint{color:var(--ember);font:600 .9rem system-ui;margin-top:.4rem;min-height:1px}
.chip-btn.ghosty{border-color:var(--line);font-weight:500;font-size:.88rem}
.askrow{display:flex;gap:.5rem}.askrow .chat-in{flex:1}
.chat-in{min-height:44px}
@keyframes pop{from{opacity:0;transform:translateY(6px) scale(.98)}to{opacity:1;transform:none}}
@keyframes dot{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}
@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.course-row{display:flex;justify-content:space-between;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px dashed var(--line)}
.course-row:last-child{border-bottom:0}
@media (max-width:480px){nav{gap:.55rem;padding:.55rem .7rem;flex-wrap:nowrap}nav a{font-size:.85rem;white-space:nowrap}.brand{font-size:1.02rem;gap:.3rem}.brand .logo{width:24px;height:24px}nav{gap:.45rem!important}nav a[href="/"]:not(.brand){display:none}nav a span.l{display:none}nav a span.s{display:inline}.theme-btn{width:34px;height:34px;flex:none}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}[data-split] .w>span,.hero .inner>p,.hero .inner>.row,.hero .shot{transform:none!important;opacity:1!important}}
/* How-it-works flow: one connected line, each step a link */
.flow{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin:1.5rem 0 1.25rem;position:relative}
.flow::before{content:"";position:absolute;left:12%;right:12%;top:22px;height:2px;background:linear-gradient(90deg,var(--ember),var(--gold));opacity:.5}
.step{position:relative;text-align:center;text-decoration:none;color:var(--ink);padding:0 .5rem}
.step::before{content:"";display:block;width:16px;height:16px;margin:15px auto 14px;border-radius:50%;background:var(--sand);border:3px solid var(--ember);transition:transform .2s var(--ease-enter),background-color .2s}
.step:hover::before{transform:scale(1.35);background:var(--ember)}
.step b{display:block;font:700 1.25rem "Space Grotesk",sans-serif}
.step span{color:var(--muted);font-size:.92rem}
@media (max-width:640px){.flow{grid-template-columns:1fr 1fr;row-gap:1rem}.flow::before{display:none}}


nav .s{display:none}
/* ================= Home journey: scenes that unbox as you scroll ================= */
.scrollcue{display:flex;justify-content:center;margin:1.2rem 0 0}
.scrollcue span{width:24px;height:38px;border:2px solid var(--muted);border-radius:14px;position:relative;opacity:.7}
.scrollcue span::after{content:"";position:absolute;left:50%;top:7px;width:4px;height:8px;margin-left:-2px;border-radius:2px;background:var(--ember);animation:cue 1.6s ease-in-out infinite}
@keyframes cue{0%{opacity:0;transform:translateY(0)}40%{opacity:1}100%{opacity:0;transform:translateY(12px)}}
.scene{overflow-x:clip;min-height:86vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:3rem 0;position:relative}
.big{font-size:clamp(3.4rem,13vw,9rem);line-height:.9;letter-spacing:-.045em;margin:0;opacity:0;transform:translateY(60px) scale(.96);filter:blur(10px);transition:all .9s var(--ease-enter)}
.scene .line{font-size:clamp(1.05rem,2.4vw,1.35rem);color:var(--muted);margin:.8rem 0 2rem;opacity:0;transform:translateY(20px);transition:all .8s var(--ease-enter) .15s}
.scene.on .big,.scene.on .line{opacity:1;transform:none;filter:none}
.s-match .big{color:var(--ember)}.s-meet .big{color:var(--gold)}.s-launch .big{color:var(--plum)}
html[data-theme=dark] .s-launch .big{color:#cdb5f0}

/* Match: two cards slide together, shared classes snap into the middle */
.matchbox{position:relative;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:1rem;width:min(720px,100%)}
.pcard{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:1.2rem;display:flex;flex-direction:column;align-items:center;gap:.2rem;box-shadow:0 12px 30px rgba(31,23,41,.08);opacity:0;transition:transform 1s var(--ease-enter) .2s,opacity .6s .2s}
.pcard.left{transform:translateX(-120px) rotate(-6deg)}.pcard.right{transform:translateX(120px) rotate(6deg)}
.scene.on .pcard{opacity:1;transform:none}
.av{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;font:700 1.4rem "Space Grotesk";font-style:normal;color:#fff;background:var(--ember)}
.av2{background:var(--plum)}
.pcard small{color:var(--muted)}
.links{display:flex;flex-direction:column;gap:.5rem}
.links span{background:var(--gold);color:#2b1a3d;font-weight:700;font-size:.85rem;padding:.35rem .7rem;border-radius:999px;opacity:0;transform:scale(.3);transition:all .6s var(--ease-enter) .9s}
.links span:nth-child(2){transition-delay:1.05s}
.scene.on .links span{opacity:1;transform:none}
.pct{transform:scale(.2);opacity:0;font:700 2.4rem "Space Grotesk";color:var(--ember);transition:all .7s cubic-bezier(.34,1.56,.64,1) 1.3s;line-height:1}
.scene.on .pct{opacity:1;transform:none}
@media (max-width:600px){.matchbox{grid-template-columns:1fr 1fr;gap:.6rem}.links{grid-column:1/-1;grid-row:2;flex-direction:row;justify-content:center;align-items:center}.pct{font-size:1.8rem}}

/* Meet: the scroll-driven fire */
.bigfire .flame-wrap{--max:240px;height:270px}
.bigfire .flame{transition:none}
.heatread{display:flex;align-items:baseline;gap:.4rem;margin-top:.6rem}
.heatread b{font:700 3rem "Space Grotesk";color:var(--ember);font-variant-numeric:tabular-nums;min-width:3ch}
.heatread span{color:var(--muted)}

/* Launch: offer cards fan out */
.fan{position:relative;height:230px;width:min(560px,100%)}
.ocard{position:absolute;left:50%;top:10px;width:220px;margin-left:-110px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:1rem 1.1rem;text-align:left;box-shadow:0 18px 40px rgba(31,23,41,.12);display:flex;flex-direction:column;gap:.2rem;transition:transform 1s var(--ease-enter),opacity .5s;opacity:0;transform:translateY(60px)}
.ocard small{color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-size:.72rem;font-weight:700}
.ocard b{font-family:"Space Grotesk";font-size:1.1rem}
.ocard em{font-style:normal;font-weight:700;color:var(--sage)}
.scene.on .ocard{opacity:1}
.scene.on .ocard:nth-child(1){transform:translateX(-235px) translateY(20px) rotate(-9deg);transition-delay:.25s}
.scene.on .ocard:nth-child(2){transform:translateY(-8px);z-index:2;transition-delay:.4s}
.scene.on .ocard:nth-child(3){transform:translateX(235px) translateY(20px) rotate(9deg);transition-delay:.55s}
.scene.on .ocard:hover{transform:translateY(-18px) scale(1.04);z-index:3}
@media (max-width:600px){.scene.on .ocard:nth-child(1){transform:translateX(-80px) rotate(-10deg)}.scene.on .ocard:nth-child(3){transform:translateX(80px) rotate(10deg)}.ocard{width:180px;margin-left:-90px}}

/* Final call */
.btn.xl{padding:1rem 1.7rem;font-size:1.15rem;border-radius:14px}
.demo-names{margin-top:1.5rem;font-size:.92rem}
@media (prefers-reduced-motion:reduce){.big,.scene .line,.pcard,.links span,.pct,.ocard{opacity:1!important;transform:none!important;filter:none!important}}
/* ---------- Home slideshow ---------- */
.deck{position:relative;height:max(560px,calc(100svh - 190px));overflow:hidden;border-radius:24px;isolation:isolate}
.deck::before{content:"";position:absolute;left:0;top:0;height:3px;width:var(--prog,0%);background:linear-gradient(90deg,var(--ember),var(--gold));z-index:6;transition:width .7s var(--ease-enter)}
.slide{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;visibility:hidden;opacity:0;transform:translateX(70px) scale(.94) rotate(.6deg);filter:blur(8px);transition:opacity .5s var(--ease-enter),transform .7s var(--ease-enter),filter .5s,visibility 0s .7s}
.deck[data-dir=back] .slide:not(.cur){transform:translateX(-70px) scale(.94) rotate(-.6deg)}
.slide.cur{visibility:visible;opacity:1;transform:none;filter:none;transition:opacity .55s var(--ease-enter) .05s,transform .75s var(--ease-enter),filter .55s,visibility 0s}
.slide.leaving{opacity:0;transform:translateX(-90px) scale(.9) rotate(-1deg);filter:blur(10px)}
.deck[data-dir=back] .slide.leaving{transform:translateX(90px) scale(.9) rotate(1deg)}
.slide .hero{margin:0;min-height:100%}
.slide .scene{min-height:100%;padding:2rem 1rem}
.wipe{position:absolute;inset:0;z-index:5;pointer-events:none;background:linear-gradient(100deg,transparent 0,var(--ember) 30%,var(--gold) 50%,var(--ember) 70%,transparent 100%);transform:translateX(-110%) skewX(-12deg);opacity:0}
.wipe.run{animation:wipe .75s cubic-bezier(.7,0,.3,1)}
.deck[data-dir=back] .wipe.run{animation-name:wipeBack}
@keyframes wipe{from{transform:translateX(-110%) skewX(-12deg);opacity:.9}to{transform:translateX(110%) skewX(-12deg);opacity:.9}}
@keyframes wipeBack{from{transform:translateX(110%) skewX(-12deg);opacity:.9}to{transform:translateX(-110%) skewX(-12deg);opacity:.9}}
.slide.cur .big{animation:bigIn .8s cubic-bezier(.34,1.56,.64,1) .2s both}
@keyframes bigIn{from{opacity:0;transform:translateY(40px) scale(.7);letter-spacing:.2em}to{opacity:1;transform:none}}
.deck-nav{display:flex;align-items:center;justify-content:space-between;gap:.8rem;margin:1rem 0 0}
.dn-btn{width:48px;height:48px;border-radius:50%;border:1.5px solid var(--line);background:var(--card,#fff);color:var(--ink);font-size:1.3rem;cursor:pointer;transition:transform .15s,opacity .2s}
.dn-btn:hover:not(:disabled){transform:translateX(-3px)}.dn-btn:disabled{opacity:.3;cursor:default}
.dn-next{min-width:11rem;animation:nudge 2.4s ease-in-out 2s infinite}
@keyframes nudge{0%,80%,100%{transform:none}88%{transform:translateX(5px)}94%{transform:translateX(-2px)}}
.dots{display:flex;gap:.35rem;flex-wrap:wrap;justify-content:center}
.dot{display:flex;align-items:center;gap:.4rem;border:0;background:none;color:var(--muted);font:600 .82rem system-ui;cursor:pointer;padding:.4rem .5rem;border-radius:99px;transition:background-color .2s,color .2s}
.dot i{width:10px;height:10px;border-radius:50%;background:var(--line);transition:transform .35s cubic-bezier(.34,1.56,.64,1),background-color .3s,width .35s}
.dot.seen i{background:var(--gold)}
.dot.on{color:var(--ink);background:rgba(255,107,53,.1)}.dot.on i{background:var(--ember);width:22px;border-radius:6px}
.dot:hover i{transform:scale(1.3)}
.feed{margin-top:1rem}
@media (max-width:640px){.dot span{display:none}.dn-next{min-width:0;flex:1;max-width:14rem}.deck{height:calc(100svh - 170px);min-height:520px}}
@media (prefers-reduced-motion:reduce){.slide,.slide.cur,.slide.leaving{transform:none!important;filter:none!important}.wipe{display:none}}


/* ================= Theme: light / dark (toggle in nav, remembers choice) ================= */
::selection{background:rgba(255,107,53,.28)}
:focus-visible{outline:2px solid var(--ember);outline-offset:2px;border-radius:6px}
html{scrollbar-color:#cdb9a6 transparent}
.theme-btn{margin-left:.25rem;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.22);background:transparent;color:#fff;display:grid;place-items:center;cursor:pointer;transition:transform .2s var(--ease-enter),background-color .15s}
.theme-btn:hover{background:rgba(255,255,255,.1)}
.theme-btn:active{transform:scale(.9) rotate(-20deg)}
.theme-btn svg{width:20px;height:20px}
.theme-btn .moon{display:none}
html[data-theme=dark] .theme-btn .sun{display:none}html[data-theme=dark] .theme-btn .moon{display:block}
html[data-theme=dark]{--sand:#140c1c;--card:#211629;--line:#3a2b46;--ink:#f3ebe3;--muted:#b9abc4;color-scheme:dark;scrollbar-color:#4a3858 transparent}
html[data-theme=dark] body{background:var(--sand);color:var(--ink)}
html[data-theme=dark] .card,html[data-theme=dark] .msg.bot,html[data-theme=dark] .dock,html[data-theme=dark] .ring b{background:var(--card);color:var(--ink);border-color:var(--line)}
html[data-theme=dark] .msgs{background:#1a1122;border-color:var(--line)}
html[data-theme=dark] input,html[data-theme=dark] select,html[data-theme=dark] textarea{background:#1a1122;color:var(--ink);border-color:var(--line)}
html[data-theme=dark] .chip-btn{background:transparent;color:var(--ink)}
html[data-theme=dark] .chip-btn:hover{background:rgba(255,107,53,.12)}
html[data-theme=dark] .chip{background:rgba(255,182,39,.12);color:#ffcf8a}
html[data-theme=dark] .chip.sage{background:rgba(79,157,105,.18);color:#9fd8b2}
html[data-theme=dark] .chip.plum{background:rgba(190,160,230,.16);color:#d9c6f2}
html[data-theme=dark] .notice{background:rgba(79,157,105,.14);border-color:rgba(79,157,105,.35);color:#bfe8cc}
html[data-theme=dark] .mini{background:var(--card)}
html[data-theme=dark] .stat b,html[data-theme=dark] .ring b{color:var(--ink)}
html[data-theme=dark] .banner{background:#2a1838;box-shadow:0 0 0 1px var(--line)}
html[data-theme=dark] .app{background:#1f1528;color:var(--ink)}
html[data-theme=dark] .app .bar{background:#2a1d35;border-color:var(--line);color:var(--muted)}
html[data-theme=dark] .app .r{border-color:var(--line)}
html[data-theme=dark] .app .meter,html[data-theme=dark] .app .bar i{background:#3a2b46}
html[data-theme=dark] .btn.light{background:#f3ebe3;color:#211629}
html[data-theme=dark] .st-Blazing{color:#ff8f5e}html[data-theme=dark] .st-Glowing{color:#ffbe5c}html[data-theme=dark] .st-Flickering{color:#e8cf6a}html[data-theme=dark] .st-Embers{color:#a99bb3}
html[data-theme=dark] .logs{filter:brightness(.8)}
html[data-theme=dark] main a:not([class]){color:#ff9466}
html[data-theme=dark] [role=img][style*="f1e7dc"]{background:#3a2b46!important}
html[data-theme=dark] .btn{color:#fff}html[data-theme=dark] .btn.ghost{color:#ff9466}html[data-theme=dark] .btn.light{color:#211629}
html[data-theme=dark] footer{color:var(--muted)}
html.theme-anim *{transition:background-color .35s ease,color .35s ease,border-color .35s ease!important}

/* ================= Page-to-page motion: each kind of button has its own arrival ================= */
@view-transition{navigation:auto}
::view-transition-old(root){animation:vtOut .22s ease both}
::view-transition-new(root){animation:none}
nav{view-transition-name:topnav}
::view-transition-group(topnav){animation:none}
html[data-go] main{animation-duration:.55s;animation-timing-function:var(--ease-enter);animation-fill-mode:both}
html[data-go=ignite] main{animation-name:goIgnite}
html[data-go=rise] main{animation-name:goRise}
html[data-go=slide] main{animation-name:goSlide}
html[data-go=back] main{animation-name:goBack}
html[data-go=zoom] main{animation-name:goZoom}
@keyframes vtOut{to{opacity:0;filter:blur(4px)}}
@keyframes goIgnite{from{opacity:0;transform:scale(.96) translateY(18px);filter:blur(8px) saturate(1.6)}to{opacity:1;transform:none;filter:none}}
@keyframes goRise{from{opacity:0;transform:translateY(48px)}to{opacity:1;transform:none}}
@keyframes goSlide{from{opacity:0;transform:translateX(56px)}to{opacity:1;transform:none}}
@keyframes goBack{from{opacity:0;transform:translateX(-56px)}to{opacity:1;transform:none}}
@keyframes goZoom{from{opacity:0;transform:scale(.92);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}

/* ================= Play: poke any flame ================= */
.flame-wrap{cursor:pointer;-webkit-tap-highlight-color:transparent}
.flame-wrap .flame{transition:transform .5s var(--ease-enter),width 1.2s,height 1.2s}
.flame-wrap:hover .flame{transform:scale(1.08)}
.flame-wrap.flare .flame{animation:flare .9s var(--ease-enter)}
@keyframes flare{0%{transform:scale(1)}25%{transform:scale(1.45) translateY(-6%)}100%{transform:scale(1)}}
.spark{position:fixed;z-index:9;width:6px;height:6px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,#fff6d0,var(--gold) 45%,var(--ember) 75%);box-shadow:0 2px 8px rgba(255,107,53,.5)}
@media (prefers-reduced-motion:reduce){html[data-go] main{animation:none}::view-transition-old(root){animation:none}}
`;

export function layout(title: string, body: string, active = "", description = "TechWomenAZ mentorship: matched by coursework, kept going with a flame for every pair."): string {
  const link = (href: string, label: string) =>
    `<a href="${href}"${active === href ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · TechWomenAZ</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" type="image/png" href="${FAVICON_PNG}"><link rel="apple-touch-icon" href="${LOGO_MARK}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<script>try{var t=localStorage.getItem('theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;var g=sessionStorage.getItem('go');if(g){document.documentElement.dataset.go=g;sessionStorage.removeItem('go')}}catch(e){}</script>
<style>${CSS}</style></head><body>
<nav aria-label="Main"><a class="brand" href="/"><img class="logo" src="${LOGO_MARK}" alt="" width="30" height="30"> <span class="word">TechWomen<span class="accent">AZ</span></span></a>${link("/", "Home")}${link("/start", '<span class="l">Get matched</span><span class="s">Match</span>')}${link("/opportunities", '<span class="l">Opportunities</span><span class="s">Jobs</span>')}${link("/campfire", "Campfire")}<button class="theme-btn" type="button" aria-label="Switch light or dark mode" onclick="toggleTheme()"><svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button></nav>
<main>${body}</main>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<footer>TechWomenAZ mentorship · built by team fortfein at FireBytes 2026 · people and postings shown are demo data</footer>
<script>
(function(){
  // Split text: wrap each word of [data-split] so it rises once on load (text stays in the HTML)
  document.querySelectorAll('[data-split]').forEach(function(h){var i=0;
    (function walk(node){Array.from(node.childNodes).forEach(function(n){
      if(n.nodeType===3){var frag=document.createDocumentFragment();n.textContent.split(/(\\s+)/).forEach(function(part){
        if(!part)return;if(/^\\s+$/.test(part)){frag.appendChild(document.createTextNode(part));return}
        var w=document.createElement('span');w.className='w';var inner=document.createElement('span');inner.textContent=part;inner.style.animationDelay=(i++*70)+'ms';w.appendChild(inner);frag.appendChild(w);});
        n.parentNode.replaceChild(frag,n);}
      else if(n.nodeType===1)walk(n);});})(h);});
  // Count-up numbers: <b data-count="70" data-suffix="%">
  document.querySelectorAll('[data-count]').forEach(function(el){var to=parseFloat(el.dataset.count),dec=(el.dataset.count.split('.')[1]||'').length,pre=el.dataset.prefix||'',suf=el.dataset.suffix||'',t0=null;
    function step(t){if(!t0)t0=t;var k=Math.min(1,(t-t0)/1200),e=1-Math.pow(1-k,3);el.textContent=pre+(to*e).toFixed(dec)+suf;if(k<1)requestAnimationFrame(step)}requestAnimationFrame(step);});
  // Score rings animate from 0
  document.querySelectorAll('.ring[data-p]').forEach(function(r){var to=+r.dataset.p,t0=null;function st(t){if(!t0)t0=t;var k=Math.min(1,(t-t0)/1100),e=1-Math.pow(1-k,3);r.style.setProperty('--p',(to*e).toFixed(1));r.querySelector('b').textContent=Math.round(to*e)+'%';if(k<1)requestAnimationFrame(st)}requestAnimationFrame(st);});
})();
function toggleTheme(){var h=document.documentElement;h.classList.add('theme-anim');h.dataset.theme=h.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('theme',h.dataset.theme)}catch(e){}setTimeout(function(){h.classList.remove('theme-anim')},400)}
// Each destination gets its own arrival animation, set by the link or form that leads there.
function goFor(href){try{var u=new URL(href,location.href);if(u.origin!==location.origin)return null;var p=u.pathname;
  if(p==='/start'||p==='/join'||p==='/choose')return 'ignite';if(p.indexOf('/campfire')===0||p==='/admin/reset')return 'rise';if(p.indexOf('/pair')===0||p.indexOf('/mentor')===0)return 'zoom';if(p==='/')return 'back';return 'slide'}catch(e){return null}}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a||a.target==='_blank'||e.metaKey||e.ctrlKey)return;var g=a.dataset.go||goFor(a.href);if(g)try{sessionStorage.setItem('go',g)}catch(_){}});
document.addEventListener('submit',function(e){var f=e.target;var g=f.dataset.go||goFor(f.action||location.href);if(g)try{sessionStorage.setItem('go',g)}catch(_){}});
// Poke a flame: it flares and throws sparks.
document.addEventListener('click',function(e){var w=e.target.closest&&e.target.closest('.flame-wrap');if(!w)return;if(w.closest('a'))e.preventDefault();
  w.classList.remove('flare');void w.offsetWidth;w.classList.add('flare');
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var r=w.querySelector('.flame').getBoundingClientRect();
  for(var i=0;i<14;i++){(function(){var s=document.createElement('span');s.className='spark';var x=r.left+r.width/2,y=r.top+r.height*.4;s.style.left=x+'px';s.style.top=y+'px';document.body.appendChild(s);
    var ang=-Math.PI/2+(Math.random()-.5)*2.2,d=40+Math.random()*90;s.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:'translate('+Math.cos(ang)*d+'px,'+Math.sin(ang)*d+'px) scale(.2)',opacity:0}],{duration:700+Math.random()*500,easing:'cubic-bezier(.22,1,.36,1)'}).onfinish=function(){s.remove()}})()}});
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
