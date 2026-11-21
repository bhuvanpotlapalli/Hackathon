# 🔥 Ember: mentorships that don't fizzle out

Built for **TechWomenAZ** at the FireBytes Hackathon 2026 · **Team fortfein:** Bhuvan Potlapalli, Shaurya, Aadi, sventy77s

**Live app:** https://fortfein.firebytehack.workers.dev · **Video:** (add link)

## The problem
TechWomenAZ helps college students and adults build careers in tech, with or without a tech degree, largely through mentorship. They told us three things are hard:
1. **Matching** mentees with mentors who actually have experience in the courses and path the mentee is on.
2. **Keeping pairs meeting**, so the relationship becomes useful instead of fizzling out.
3. **Connecting members to real opportunities** (internships, jobs, mentorship programs) that fit what they've studied, and showing sponsors before/after proof that the program works.

## How it works
1. **Coursework-first matching.** Mentees list the courses they're taking, mentors list the courses they've taken or teach. Ember ranks the top 3 mentors by career path, shared coursework, goals, schedule, format and open capacity, and AI explains why they'll click. The mentee chooses.
2. **Spark Plan.** Every pair gets a goal and 3 milestones (AI-suggested from the mentee's goal and courses). "Spark my next meeting" writes a 3-question agenda.
3. **The Flame.** Logging a meeting (one emoji, one takeaway, one next step) makes the pair's flame grow. Silence makes it fade:
   `heat = clamp(100 − 4 × days since last meeting + 5 × weekly streak, 0, 100)` → Blazing / Glowing / Flickering / Embers.
4. **The Campfire** (admin). Every pair as a flame, weakest first, a "Needs attention" list with one-click relight nudges, program stats, and a before/after confidence **Rise Report** (AI writes a sponsor-ready summary from combined numbers only).
5. **Opportunities board.** Employers and partners post internships, jobs and mentorship programs with the coursework they want. Ember scores each student's fit by coursework coverage, shows each mentee the openings they fit (and which courses would boost their fit), and shows posters their best-fit students.

### Scoring (simple and explainable)
| Mentor match | Points | Opportunity fit | Points |
|---|---|---|---|
| Same career path | 30 | Same career path | 30 |
| Shared coursework | up to 30 | Share of wanted courses taken | up to 60 |
| Goal keywords | up to 15 | Location / remote works | 10 |
| Availability | 10 | | |
| Format / area | 5 | | |
| Mentor has open capacity | 10 | | |

## Tech stack
- **Cloudflare Workers** (TypeScript, no framework): server-rendered pages + JSON endpoints
- **Cloudflare D1** (SQLite): users, pairs, milestones, check-ins, nudges, opportunities
- **Workers AI** (`@cf/google/gemma-4-26b-a4b-it`, thinking off, short answers): match explanations, milestones, meeting agendas, Rise Report. Every AI call has an 8-second timeout and a template fallback, so the app never breaks.

| File | Purpose |
|---|---|
| `src/index.ts` | Router |
| `src/pages.ts` | Pages, forms, JSON endpoints |
| `src/db.ts` | Schema, demo seed data, queries (all parameterized) |
| `src/logic.ts` | Flame, match and opportunity-fit formulas |
| `src/ai.ts` | Workers AI calls with fallbacks |
| `src/ui.ts` | Layout, styles, the pure-CSS flame |

## How to run it
```bash
npm install
npx wrangler dev -c wrangler.mock.jsonc   # local, no Cloudflare login needed (AI uses templates)
# open http://localhost:8787
```
Deploy:
```bash
npx wrangler d1 create ember-db           # paste the database_id into wrangler.jsonc
npx wrangler deploy
```
Tables and demo data are created automatically on the first request. The **Reset demo** button on `/campfire` reloads the demo data.

## Status
- ✅ **Finished:** signup, coursework matching, pairs, milestones, meeting logs, flames, Campfire dashboard, relight nudges (saved), Rise Report, opportunities board with coursework fit, AI features with fallbacks.
- 🧪 **Mocked:** nudges are saved and shown, not emailed. People, pairs and postings are **fictional demo data**.
- 🔜 **Next:** real email/SMS nudges, logins for mentors/mentees/admins, Speed Spark matching at live events, "Pass the Torch" (mentees who reach their goal become mentors), mentor course library with public/members-only sharing, paid memberships.

## Assumptions
- Mentees are college students or adults (18+); TechWomenAZ does not serve K-12.
- Pairs should meet about weekly; a flame fades after ~1–2 quiet weeks.
- Course names are free text; matching uses shared keywords ("Intro to Python" ≈ "Python for Data Science").

## Privacy & safety
Data consent at signup · 18+ only · meetings online or in public, contact details private until both agree · opportunity posters see fit, not contact details · the Rise Report uses combined, anonymous numbers only · every query is parameterized and all user text is HTML-escaped.
