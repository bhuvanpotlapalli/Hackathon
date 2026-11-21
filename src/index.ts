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
        if (path === "/courses") return courses.coursesPage(env, url);
        if (path === "/courses/new") return courses.courseForm(env, url);
        if (path === "/courses/personal") return personal.personalPage(env, url);
        if ((r = m(/^\/courses\/personal\/(\d+)$/))) return personal.personalDetail(env, +r[1], url);
        if ((r = m(/^\/courses\/(\d+)$/))) return courses.courseDetail(env, +r[1]);
        if ((r = m(/^\/api\/opp-courses\/(\d+)$/))) return courses.apiOppCourses(env, +r[1]);
        if (path === "/opportunities") return pages.opportunities(env, url);
        if (path === "/opportunities/new") return pages.oppForm();
        if ((r = m(/^\/opportunities\/(\d+)$/))) return pages.oppDetail(env, +r[1], url);
        if (path === "/api/why") return pages.apiWhy(env, url);
      }

      if (method === "POST") {
        if (path === "/join") return pages.joinSubmit(request, env);
        if (path === "/choose") return pages.choose(request, env);
        if (path === "/api/chat/react") return chat.chatReact(request, env);
        if (path === "/api/chat/finish") return chat.chatFinish(request, env);
        if ((r = m(/^\/pair\/(\d+)\/log$/))) return pages.logMeeting(request, env, +r[1]);
        if ((r = m(/^\/pair\/(\d+)\/milestone\/(\d+)$/))) return pages.milestone(env, +r[1], +r[2]);
        if ((r = m(/^\/nudge\/(\d+)$/))) return pages.nudge(env, +r[1]);
        if (path === "/opportunities") return pages.oppSubmit(request, env);
        if (path === "/courses") return courses.courseSubmit(request, env);
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
