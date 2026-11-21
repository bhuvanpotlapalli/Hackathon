# Ember: handoff (where to pick up)

> For any Claude session or teammate picking this up. Last updated: Sat Nov 21, 2026, ~10:30 AM MST.
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
- ⏳ **Step 2 (next): AI with Workers AI**, all with template fallbacks so the demo never breaks:
  1. `/matches`: one-sentence "why you'll click" per mentor (the page already has an empty `<p class="why" data-mentor="ID">` placeholder per card).
  2. New pair: AI-suggested 3 milestones based on goal + courses (replace `starterMilestones` call in `pages.choose`).
  3. `/pair/:id`: "Spark my next meeting" button → 3-question agenda (placeholder `<div id="agenda">` exists).
  4. `/campfire`: "Write Rise Report" button → sponsor-ready summary from aggregate stats only (placeholder `<div id="rise">` exists).
  - Model: `@cf/google/gemma-4-26b-a4b-it`, pass `chat_template_kwargs: { enable_thinking: false }`, short `max_tokens` (~200). Free plan = 10,000 neurons/day for the whole team. Wrap every call in an 8 s timeout + template fallback. `env.AI` is optional (undefined in mock mode).
- ⏳ **Step 3**: README (replace the template; change the live link from `hello-ai` to `fortfein`), video script, submission checklist.

## Rules
- Never push to `main` without JS's OK. Work on the `ember` branch, JS merges.
- Run `npx tsc --noEmit` before every push.
- Demo data is fictional; say so in the README.
