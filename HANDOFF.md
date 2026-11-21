# TechWomenAZ mentorship (code name Ember): handoff

> For any Claude session or teammate picking this up. Last updated: Sat Nov 21, 2026, ~10:45 AM MST.
> **Deadline: submissions close 1:30 PM MST. JS wants everything done by 12:30.**

## What Ember is
A mentorship app for **TechWomenAZ** (FireBytes 2026). It serves **college students and adults (18+), not K-12**.
- **Coursework matching:** mentees list the courses they're taking, mentors list the courses they've taken or teach. Mentees get the top 3 mentors who have been through the same coursework.
- **Flame:** every mentor–mentee pair has a flame. Logging a meeting makes it grow, silence makes it fade.
- **Campfire (`/campfire`):** admin dashboard with every pair's flame, a "needs attention" list with relight nudges, and a before/after confidence Rise Report.
- **Opportunities (`/opportunities`):** employers and partners post internships, jobs and mentorship programs with the coursework they want. Ember scores each student's fit by coursework and shows matched students.

## Stack and files (TypeScript Cloudflare Worker, no framework)
| File | What it holds |
|---|---|
| `src/index.ts` | Router (all URLs) |
| `src/pages.ts` | Every page and form handler (server-rendered HTML) |
| `src/db.ts` | D1 schema, demo seed data, all SQL queries. Tables and seed are created **automatically on the first request** |
| `src/logic.ts` | Flame heat formula, mentor match score, opportunity fit score, starter milestones |
| `src/ui.ts` | Layout, CSS (design tokens, pure-CSS flame), HTML escaping |
| `wrangler.jsonc` | Worker `fortfein`, AI binding `AI`, D1 binding `DB` (`ember-db`) |
| `wrangler.mock.jsonc` | Local dev without a Cloudflare login (local D1, no AI) |

### Formulas
- Heat = clamp(100 − 4 × days since last meeting + 5 × streak weeks, 0, 100). Blazing 70+, Glowing 40–69, Flickering 15–39, Embers 0–14.
- Mentor match (0–100) = 30 same career path + up to 30 shared coursework (10/course) + up to 15 goal keywords + 10 availability + 5 format/area + 10 open capacity.
- Opportunity fit (0–100) = 30 career path + 60 × share of the posting's courses the student has + 10 location/format.

## Deploy (Bhuvan, Windows, logged in to Cloudflare)
```bash
git fetch origin && git checkout ember && npm install
npx wrangler d1 create ember-db          # copy the database_id it prints
# paste it into wrangler.jsonc, replacing PASTE-DATABASE-ID-HERE
npx tsc --noEmit                          # type-check
npx wrangler deploy                       # live at https://fortfein.firebytehack.workers.dev
```
Open `/campfire` once after deploying: tables and demo data are created automatically. The **Reset demo** button on the Campfire reloads the seed data.

Local test without a login: `npx wrangler dev -c wrangler.mock.jsonc` then open http://localhost:8787.

## Status
- ✅ **Step 1 done (branch `ember`)**: Home, Join (college+/18+ only, courses field, consent), Matches (top 3 + opportunities that fit), Pair page (flame, milestones, log meeting with flame-grow animation + 🔥 confetti), Campfire (stats, needs attention, relight nudge, before/after bars, print), Opportunities (list, "see fit for" a student, post form, matched students per posting), Reset demo. Smoke-tested locally on every route; type-checks.
- ✅ **Step 2 done**: Workers AI in `src/ai.ts` (Gemma 4, thinking off, short answers, 8 s timeout, template fallback):
  1. `/matches`: "why you'll click" per mentor, loaded by the page from `GET /api/why?mentee=&mentor=`.
  2. New pair: AI-suggested 3 milestones (`ai.suggestMilestones`, falls back to `starterMilestones`).
  3. `/pair/:id`: "Spark my next meeting" → `POST /api/agenda/:id`.
  4. `/campfire`: "Write Rise Report" → `POST /api/rise` (aggregate stats only).
  - Fallbacks tested locally in mock mode. **Real AI output has NOT been tested yet** (needs Bhuvan's Cloudflare login). After deploying, check `/matches/19`: if the "✨" lines read naturally, AI works; the JSON from `/api/why?mentee=19&mentor=1` shows `"ai": true` when the model answered.
- ✅ **README** rewritten (live link fixed to `fortfein`). Still to fill in: video link.
- ⏳ **Next**: deploy and check the live site in a private window, merge `ember` into `main`, record the video (script in the team playbook §12, mention coursework matching + the opportunities board), submit by 1:25.

## Latest (~11:05 AM)
- Site rebranded to **TechWomenAZ** (JS's call). The AI chat assistant is named **ember**.
- `/start`: chat signup with ember (quick-reply chips, AI reactions with fallbacks, creates the profile, redirects to matches). Code in `src/chat.ts`. The classic form is still at `/join`.
- Matches page shows "Courses to take next" from `COURSE_LIBRARY` in `src/logic.ts`, with which mentors took each one.
- 7 extra mentors seeded (ids after mentees, so `/matches/19` is still Elena). Every demo mentee except Ben now has a 70%+ best match. **After deploying a seed change, click Reset demo on /campfire.**
- Rise Report prompt forbids invented numbers/goals and gendered wording.

- ~11:35: home page is a scroll journey (hero, then full-screen Match / Meet / Launch / Your turn scenes; the Meet fire is lit by scrolling). Phone nav uses short labels (Match, Jobs).
- ~11:25: light/dark toggle (nav button, remembers choice), page-to-page arrival animations per destination (chat = ignite, Campfire = rise, pair = zoom, home = slide back, others slide), pokeable flames (click any flame: it flares and throws sparks), tighter copy, how-it-works flow replaces numbered cards. Guidance from the impeccable skill (JS's zip), read only; none of its scripts were run.

## Design rules (from taste-skill)
- No emoji in headings or buttons, no gradient text, no glow or shine sweeps, no scroll-in card reveals, no twinkling. Buttons step 1px up on hover and press on click; linked cards lift 2px. One hero entrance (split-text headline). The hero shows the real Campfire, not decoration.

## Rules
- **JS wants every reply to end with a TODO list of what they should do next.**
- Never push to `main` without JS's OK. Work on the `ember` branch, JS merges.
- Run `npx tsc --noEmit` before every push.
- Demo data is fictional; say so in the README.

- ~11:25 (final audit): README rewritten for TechWomenAZ + ember chat, with 4 screenshots in `docs/`. Test now checks the home page and /health (runs against the mock config, `npx vitest run` passes). package name is `fortfein`. No app code changed, so no redeploy needed. Remaining: merge PR #1 to main, record video, add its link to the README, submit by 1:25.
