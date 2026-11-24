# TechWomenAZ — Changelog

All work done to turn the hackathon demo into a site a company can run. Live at
<https://fortfein.firebytehack.workers.dev>. Dates are 2026-11-24 unless noted.

Scope: 8 commits, 21 files, +2,211 / −925 lines, starting from the demo build
(`5c8d6bb`) and ending at `9d3980b`.

| Commit | What it did |
| --- | --- |
| `5c8d6bb` | Direct messages, month calendar, demo identity switcher |
| `8bb9659` | Replace the demo with real accounts, permissions and no seeded data |
| `a2d8e32` | Drop the unused demo-link styles from the home page |
| `a149bd7` | Close the access gaps and dead ends found in the production review |
| `5053abf` | Add email notifications, employer logins and account deletion |
| `a1ffc3f` | Require approval for employer accounts and let members export their data |
| `37729d8` | Tidy the navigation and give settings a single gear icon |
| `9d3980b` | Restore an Admin tab and link accounts to member profiles |

---

## 1. Removed the demo layer

- Deleted the demo identity switcher (`/switch`, `/enter`, `/join`) and every
  seeded fictional person, pair, course and opportunity.
- Removed the demo-link styles and demo screenshots (`docs/*.png`) from the repo.
- Added a one-time purge keyed on `meta.purge_demo_v1` so existing deployments
  clean themselves on first request instead of shipping fictional members.
- Manually removed the remaining hackathon test rows from production D1
  (`surya` ×3, `s`, `Shaurya`, `tanmay`, course `eqw3`) once database access
  was available.

## 2. Real accounts and sessions

- New `accounts` table plus first-party auth in `src/auth.ts`: passwords hashed
  with PBKDF2-SHA256 (100,000 iterations, per-account salt), never stored or
  logged in clear text.
- Session tokens are random, stored **hashed** in D1 with an expiry, and sent in
  an `HttpOnly`, `Secure`, `SameSite=Lax` cookie named `ember_session`.
- Roles: **mentee**, **mentor**, **employer** (account bound to an
  organization), and **admin** (`accounts.role`). Admin is also granted to
  `ADMIN_EMAIL` and to the first account created, so a fresh deployment cannot
  lock itself out.
- Login lockout: 15 minutes after repeated bad passwords.
- Self-service password reset: `/forgot` emails a single-use link; reset tokens
  are hashed in the database and expire in 24 hours. Admins can also generate a
  one-time reset link from `/admin/accounts`.
- Signup for mentees, mentors and employers, with validation, a minimum password
  length, and a redirect straight to matching for new mentees.

## 3. Access control and privacy

- Every route is gated by role: members-only pages, admin-only pages
  (`/campfire`, `/admin/accounts`), and employer-only pages (`/employer`).
- Personalized courses (a mentor's course written for one mentee) are visible
  only to that mentee, the authoring mentor and admins.
- Mentees can list their own learning plans; other members' plans stay private.
- Mutating requests are checked for same-origin, blocking cross-site form posts.
- Security headers on every response: CSP, HSTS, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`.
- Unexpected errors return a generic 500 page with a reference id instead of a
  stack trace.
- The course form no longer discards a rejected submission silently; the author
  is forced to be the signed-in mentor.

## 4. Mentorship core

- Matching by shared coursework and career area, with a match score, mentor
  capacity, availability and format filters.
- Pairs: mentee picks a mentor, a pair is created, and both sides get a pair
  page with chat, meetings, check-ins, milestones and nudges.
- The "flame" retention model: heat, streak and status per pair, plus the
  Campfire admin view with the Rise Report across every pair.
- Nudges: stored per pair, shown as a banner on the pair page, and emailed to
  the pair when sent.

## 5. Messaging and calendar

- Direct messages between members with unread counts, threads and a
  conversation view (`src/inbox.ts`, `/messages`, `/api/dm/:id`).
- Email notification on a new DM, but only when the recipient has been idle for
  30 minutes, so a live conversation does not spam inboxes.
- Month calendar (`/calendar`) listing upcoming meetings with booking, cancel
  and reschedule flows; booking and cancellation both email the other person.

## 6. Courses and opportunities

- Course library with filters by career area; mentors and employers can publish
  courses, and courses can be shared.
- Personalized courses: a mentor builds a course for one mentee, with stages and
  progress.
- Opportunities board: post a role or program, with career area, area, format
  and links; members see which postings fit their courses.

## 7. Employer accounts

- Employer signup creates an organization and an account bound to it
  (`accounts.org_id`); the person's profile row stays a mentor with zero
  capacity, so employers never appear as mentors to mentees.
- Employer dashboard (`/employer`): edit the organization profile, post roles
  and courses under the organization, and see which students fit each posting.
- Employer-authored courses and postings carry `account_id`, so renaming the
  organization updates everything it posted.
- Employers cannot see the campfire, other organizations' postings, or program
  administration.
- **Approval gate:** new employer accounts are created unapproved, land on
  `/pending`, and cannot post or open the dashboard until an admin approves them
  on `/admin/accounts`. Approval emails the contact.

## 8. Email system

- `src/email.ts` talks to the Resend REST API directly (no SDK), with an HTML
  wrapper and templates for: welcome, password reset, nudge, meeting booked,
  meeting cancelled, new direct message, new opportunity, new member (to
  admins), account deleted, account deleted by an admin, and employer approved.
- Recipient helpers resolve the right people (pair members, admins, mentees of a
  mentor) and `appUrl()` builds absolute links from `APP_ORIGIN`.
- With no `RESEND_API_KEY`, sending is a silent no-op and the UI says email is
  not set up yet. Failures are logged with the HTTP status, never thrown into a
  request.
- `EMAIL_LOG=1` (used by `wrangler.mock.jsonc` locally) logs mail instead of
  sending it.
- Production: the key is installed as the Worker secret `RESEND_API_KEY` and a
  real send was accepted by Resend (message id returned).

## 9. Account management

- Change password from `/account`, requiring the current password.
- **Delete my own account**: password plus a typed confirmation; removes the
  account, profile, pairs, meetings, check-ins, milestones, messages and
  courses, and invalidates the session.
- Admins can delete any account from `/admin/accounts`; the member is emailed.
- Admins can promote or demote admins, with guards against removing your own
  admin access or deleting the last admin.
- **Data export**: `GET /account/export` downloads `techwomenaz-export.json`
  with the member's account, profile, organization, pairs (meetings, check-ins,
  milestones), direct-message threads, courses and personalized courses. No
  password hashes or session tokens are included.

## 10. Interface

- Navigation decluttered: the redundant Home link and the Admin/Employer chips
  are gone, replaced by a single **settings gear** that opens `/account`, with
  the theme toggle beside it. Signed-out visitors see a "Sign in" pill instead.
- An **Admin** tab appears in the nav for program leads and goes to
  `/admin/accounts`.
- Accounts list shows name, role chips (Admin / Employer / Pending), email,
  organization, join date and active sessions, with actions: View profile,
  Approve, Reset link, Make/Remove admin, Delete.
- More breathing room: wider page frame, card padding, grid gaps and banner
  spacing.

## 11. Schema and configuration

- `accounts` table (`email`, `role`, `org_id`, `approved`, `user_id`,
  `password_hash`), `sessions`, `password_resets`, `dm_threads`, `dm_messages`.
- Migrations added: `accounts.org_id`, `accounts.approved`,
  `opportunities.account_id`, `courses.account_id`.
- `wrangler.jsonc` variables: `ADMIN_EMAIL`, `APP_ORIGIN`, `EMAIL_FROM`,
  `EMAIL_REPLY_TO`. `wrangler.mock.jsonc` adds `EMAIL_LOG=1` for local work.
- README rewritten for operators: setup, Resend configuration, employer
  accounts and approval, deletion and export.

## 12. Verification performed

- `npx tsc --noEmit` clean at every commit; `vitest` 2/2; `wrangler deploy
  --dry-run` clean.
- Local end-to-end on a fresh database, 0 server errors: admin/mentor/mentee/
  employer signup, matches, pair, meeting, DM, nudge, course, opportunity,
  employer posting and organization rename, approval gate, forgot/reset, delete
  self, admin delete, last-admin guard, export contents, 16 logged emails.
- Production smoke test with a throwaway member: signup, all member pages,
  export JSON, logout/login, delete with a wrong password refused, delete with
  the right password, database back to its pre-test state.
- Production route sweep: public pages 200, member and admin routes 303 to
  sign-in for guests, `/campfire` 403 for non-admins, security headers present,
  `/health` reports `{ok:true,db:true,ai:true}`.
- Production database inspected once D1 access was granted: 19 tables, schema
  intact, demo data absent.

## 13. Known limitations

- **Email delivery**: `EMAIL_FROM` still points at Resend's test sender
  (`onboarding@resend.dev`), which Resend only delivers to the account owner's
  address. A domain must be verified and `EMAIL_FROM` updated before students,
  mentors and employers can receive mail. The Worker logs the 403 and carries on.
- The site runs on the `workers.dev` hostname; a custom domain is not configured.
- No browser click-through or screenshot review was done, so visual layout and
  mobile behaviour are unverified.
- No privacy policy or terms page; no scheduled backups beyond Cloudflare's
  30-day D1 point-in-time history.
