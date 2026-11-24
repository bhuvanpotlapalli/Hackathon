# TechWomenAZ Mentorship

A mentorship platform for **TechWomenAZ**: college students and adults (18+) get matched with mentors by
the coursework they share, every pair has a flame that grows when they meet, and program staff can see who is
going quiet before they drop out.

Live: https://fortfein.firebytehack.workers.dev

## What members get

- **Accounts.** Email + password, server-side sessions, password changes, and one-time reset links issued by an admin.
- **Coursework matching.** Mentees list the courses they're taking, mentors list what they've taken or teach. Top 3 mentors, ranked by shared courses, path, goals, schedule, format, capacity and shared interests.
- **The flame.** Every pair has a flame. Logging a meeting grows it; silence fades it.
  `heat = clamp(100 − 4 × days since last meeting + 5 × weekly streak, 0, 100)` → Blazing / Glowing / Flickering / Embers.
- **Pairs.** Goals, AI-suggested (or starter) milestones, meeting log with confidence tracking, a private pair chat, and meetings that export to Google/Apple/Outlook with one click.
- **Messages.** Private conversations between any two members, plus a message to the program team from an opportunity.
- **Calendar.** Month view of your meetings and the meetings that fed your flame, with a booking form either person can use.
- **Opportunities.** Program staff post internships, jobs and mentorship programs with the coursework they want; each student sees their fit and matched students are listed for staff.
- **Courses.** Mentors add courses they teach or recommend; students filter by path, level, cost, format and tags, track lesson progress and save courses. Workers AI picks the courses that cover each posting, and a mentor can have ember write a 4-part course for one mentee.
- **Profiles.** Bio, pronouns, experience, fun facts, interests, availability, format and area, with a Member directory for starting conversations.
- **Privacy.** Personalized courses are visible only to the mentor and mentee they were built for (admins can see all), and conversations, pairs, meetings and calendars are visible only to their members.
- **Employer logins.** A company contact signs up as an employer, gets an organization profile, posts roles and prep courses under that organization, and sees which students fit each posting (with links to their profiles). Employers cannot see the campfire, other organizations' postings or program administration.
- **Admin.** `/campfire` for every pair's flame, retention, weekly meeting chart and a before-and-after confidence Rise Report; `/admin/accounts` for members, admin roles, password resets, and deleting an account and its data.

## Security and privacy

- Passwords are hashed with **PBKDF2-SHA256, 100,000 iterations** (WebCrypto) with a per-user salt; the comparison is constant-time.
- Members can **delete their own account** (password plus a typed confirmation) and admins can delete an account from `/admin/accounts`. Deletion removes the account, its pairs, check-ins, milestones, meetings, nudges, pair chat, direct messages, personal courses, postings and organization, sessions and reset tokens. The last remaining admin cannot be deleted.
- Sessions are random 256-bit tokens stored **hashed** in D1, sent as `HttpOnly; Secure; SameSite=Lax` cookies, 30 days, and rotated out on password change/reset. Eight failed logins lock an account for 15 minutes.
- Every page except the marketing home, sign-in, sign-up and reset requires a session. Pair pages, chats, meetings, messages and the calendar are checked against the signed-in member, so one member cannot read another's pair or conversation.
- Profile edits are limited to your own profile; only admins can post opportunities, manage organizations and accounts, see `/campfire`, or send nudges.
- Cross-site form posts are rejected (Origin check plus SameSite cookies), and every response carries CSP, HSTS, `X-Frame-Options: DENY`, `nosniff` and a referrer policy. All SQL is parameterized and all user text is HTML-escaped.
- Admin bootstrap: the email in `ADMIN_EMAIL` (see `wrangler.jsonc`) becomes an admin when it signs up; on a fresh install the first account is an admin regardless.

## Running it

```bash
npm install
npx wrangler dev -c wrangler.mock.jsonc   # local, no Cloudflare login; AI falls back to templates
# open http://localhost:8787
```

Deploy (Needs a Cloudflare account with Workers + D1):

```bash
npx wrangler d1 create ember-db    # once; paste database_id into wrangler.jsonc
npx wrangler deploy
```

Set `ADMIN_EMAIL` in `wrangler.jsonc` to the program lead's email before deploying. Tables are created on the
first request; there is no demo data — the site starts empty.

Local tests: `npx vitest run` (home page and `/health`). Type-check: `npx tsc --noEmit`.

## Operations

- **Reset a password:** `/admin/accounts` → *Reset link* → send the one-time URL (valid 24 hours) to the member. Only a hash of that token is stored, so a database copy cannot be used to reset accounts.
- **Make someone an admin:** same page → *Make admin*.
- **Email:** messages go out through [Resend](https://resend.com) over their REST API. Add the key as a Worker secret, then verify the sending domain in Resend (or keep the test sender and only mail your own address):
  ```bash
  npx wrangler secret put RESEND_API_KEY
  ```
  Set `EMAIL_FROM` (and optionally `EMAIL_REPLY_TO`, `APP_ORIGIN`) in `wrangler.jsonc`. Sent automatically: welcome, new-member notice to admins, password reset links, new opportunity for students on that path, meeting booked, meeting cancelled, a direct message when the other person has not written in that thread for 30 minutes, program-team nudges, and account-deletion notices. With no key the site works normally, sends nothing, and the employer dashboard says notifications are off.
- **Password resets:** members use `/forgot` and get a link by email (one use, 24 hours). Admins can still issue a link from `/admin/accounts`, which is also emailed when a sender is configured.
- **Nudges:** the relight button on `/campfire` posts a short note from the program team that shows at the top of that pair's page and, when email is on, mails both members.
- **Backups:** `npx wrangler d1 export ember-db --remote --output backup.sql` on a schedule.
- **Workers plan:** password hashing uses real CPU; the Workers **Paid** plan ($5/mo) is the safe choice. The free plan's 10 ms CPU budget can time out on sign-in.
- **Email:** there is no email sender configured. Password resets are admin-issued links, and invitations are shared by link (`/signup`). Add a transactional email provider if you want automatic reset emails.
- **Employer accounts:** employers do not log in yet. Staff post on their behalf, and members reach the program team from an opportunity page.

## Code map

| File | Purpose |
|---|---|
| `src/index.ts` | Router and access control for every URL |
| `src/auth.ts` | Accounts, sessions, password hashing, reset links, admin account pages |
| `src/db.ts` | D1 schema, migrations, queries |
| `src/pages.ts` | Home, dashboard, matches, pairs, campfire, opportunities |
| `src/social.ts` | Profiles, pair chat, meetings, organization profiles |
| `src/inbox.ts` | Direct messages and the calendar |
| `src/email.ts` | Email transport (Resend) and every message template |
| `src/employer.ts` | Employer dashboard, postings and organization profile |
| `src/courses.ts` | Course library, filters, AI course picks per posting |
| `src/personal.ts` | Personalized courses written by ember for one mentee |
| `src/logic.ts` | Flame, match and opportunity-fit formulas, course library |
| `src/ai.ts` | Workers AI calls, each with a timeout and a template fallback |
| `src/ui.ts` | Layout, styles, light/dark theme, the CSS flame |

Stack: one Cloudflare Worker (TypeScript, no framework), Cloudflare D1, Resend for email, and Workers AI
(`@cf/google/gemma-4-26b-a4b-it`) with template fallbacks. AI and email run only in the Worker.
