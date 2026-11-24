import * as social from "./social";
import * as inbox from "./inbox";
import * as personal from "./personal";
import * as courses from "./courses";
// Ember: mentorships that don't fizzle out. Built for TechWomenAZ at FireBytes 2026.
// One Cloudflare Worker: routes requests to server-rendered pages (pages.ts),
// stores data in D1 (db.ts), and uses the flame + match formulas in logic.ts.

import { ensureDb, resetDb } from "./db";
import * as chat from "./chat";
import * as pages from "./pages";
import type { Env } from "./pages";
import { esc, html, layout } from "./ui";

export type { Env };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method;

    if (path === "/health") return Response.json({ ok: true, db: !!env.DB, ai: !!env.AI });

    if (!env.DB) {
      return html(
        layout(
          "Setup needed",
          `<div class="card"><h1>Database not connected</h1><p>Run <code>npx wrangler d1 create ember-db</code>, paste the database_id into <code>wrangler.jsonc</code>, then deploy again.</p></div>`,
        ),
        500,
      );
    }

    try {
      await ensureDb(env.DB);
      const m = (re: RegExp) => path.match(re);
      let r: RegExpMatchArray | null;

      if (method === "GET") {
        if (path === "/") return pages.home(env);
        if (path === "/join") return pages.joinForm(url);
        if (path === "/start") return chat.chatPage();
        if ((r = m(/^\/mentor\/(\d+)$/))) return pages.mentorWelcome(env, +r[1]);
        if ((r = m(/^\/matches\/(\d+)$/))) return pages.matches(env, +r[1], url);
        if ((r = m(/^\/pair\/(\d+)$/))) return pages.pairPage(env, +r[1], url);
        if (path === "/campfire") return pages.campfire(env, url);
        if (path === "/switch") return inbox.switchPage(request, env, url);
        if (path === "/enter") return inbox.enter(request, env, url);
        if (path === "/api/me") return inbox.apiMe(request, env);
        if (path === "/messages") return inbox.inboxPage(request, env, url);
        if ((r = m(/^\/messages\/([uo]:\d+)$/))) return inbox.threadPage(request, env, r[1]);
        if ((r = m(/^\/api\/dm\/(\d+)$/))) return inbox.apiDm(request, env, +r[1]);
        if (path === "/calendar") return inbox.calendarPage(request, env, url);
        if ((r = m(/^\/profile\/(\d+)$/))) return social.profilePage(env, +r[1], url, request);
        if (path === "/orgs") return social.orgsPage(env, url);
        if (path === "/orgs/new") return social.orgForm(url);
        if (path === "/org") return social.orgByName(env, url);
        if ((r = m(/^\/orgs\/(\d+)$/))) return social.orgPage(env, +r[1], url);
        if ((r = m(/^\/pair\/(\d+)\/meetings\/(\d+)\.ics$/))) return social.meetingIcs(env, +r[1], +r[2]);
        if ((r = m(/^\/api\/pair\/(\d+)\/messages$/))) return social.apiMessages(request, env, +r[1]);
        if (path === "/courses") return courses.coursesPage(env, url);
        if (path === "/courses/new") return courses.courseForm(env, url);
        if (path === "/courses/personal") return personal.personalPage(env, url);
        if ((r = m(/^\/courses\/personal\/(\d+)$/))) return personal.personalDetail(env, +r[1], url);
        if ((r = m(/^\/courses\/(\d+)$/))) return courses.courseDetail(env, +r[1]);
        if ((r = m(/^\/api\/opp-courses\/(\d+)$/))) return courses.apiOppCourses(env, +r[1]);
        if (path === "/opportunities") return pages.opportunities(env, url);
        if (path === "/opportunities/new") return pages.oppForm(url);
        if ((r = m(/^\/opportunities\/(\d+)$/))) return pages.oppDetail(env, +r[1], url);
        if (path === "/api/why") return pages.apiWhy(env, url);
      }

      if (method === "POST") {
        // Forms must arrive as form data; anything else goes back where it came from.
        const ct = request.headers.get("content-type") ?? "";
        if (!path.startsWith("/api/") && !path.startsWith("/admin/") && !/form/i.test(ct)) {
          const ref = request.headers.get("referer");
          const back = ref && new URL(ref).host === url.host ? new URL(ref).pathname : "/";
          return new Response(null, { status: 303, headers: { location: back } });
        }
        if (path === "/join") return pages.joinSubmit(request, env);
        if (path === "/choose") return pages.choose(request, env);
        if (path === "/api/chat/react") return chat.chatReact(request, env);
        if (path === "/api/chat/finish") return chat.chatFinish(request, env);
        if (path === "/switch") return inbox.switchSubmit(request, env);
        if (path === "/calendar") return inbox.calendarSchedule(request, env);
        if ((r = m(/^\/api\/dm\/(\d+)$/))) return inbox.apiDm(request, env, +r[1]);
        if ((r = m(/^\/pair\/(\d+)\/log$/))) return pages.logMeeting(request, env, +r[1]);
        if ((r = m(/^\/pair\/(\d+)\/milestone\/(\d+)$/))) return pages.milestone(env, +r[1], +r[2]);
        if ((r = m(/^\/nudge\/(\d+)$/))) return pages.nudge(env, +r[1]);
        if (path === "/opportunities") return pages.oppSubmit(request, env);
        if (path === "/courses") return courses.courseSubmit(request, env);
        if ((r = m(/^\/profile\/(\d+)$/))) return social.profileSubmit(request, env, +r[1]);
        if (path === "/orgs") return social.orgSubmit(request, env);
        if ((r = m(/^\/pair\/(\d+)\/meetings$/))) return social.meetingSubmit(request, env, +r[1]);
        if ((r = m(/^\/pair\/(\d+)\/meetings\/(\d+)\/cancel$/))) return social.meetingCancel(env, +r[1], +r[2]);
        if ((r = m(/^\/api\/pair\/(\d+)\/messages$/))) return social.apiMessages(request, env, +r[1]);
        if (path === "/courses/personal") return personal.personalSubmit(request, env);
        if ((r = m(/^\/api\/agenda\/(\d+)$/))) return pages.apiAgenda(env, +r[1]);
        if (path === "/api/rise") return pages.apiRise(env);
        if (path === "/admin/reset") {
          await resetDb(env.DB);
          return new Response(null, { status: 303, headers: { location: "/campfire?reset=1" } });
        }
      }

      return html(layout("Not found", `<div class="card"><h1>Page not found</h1><p><a href="/">Back home</a></p></div>`), 404);
    } catch (err) {
      console.error(err);
      return html(
        layout("Something went wrong", `<div class="card"><h1>Something went wrong</h1><p class="muted">${esc(err instanceof Error ? err.message : String(err))}</p><p><a href="/">Back home</a></p></div>`),
        500,
      );
    }
  },
} satisfies ExportedHandler<Env>;
