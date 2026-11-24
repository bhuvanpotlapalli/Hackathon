import * as auth from "./auth";
import * as courses from "./courses";
import * as inbox from "./inbox";
import * as pages from "./pages";
import * as personal from "./personal";
import * as social from "./social";
// TechWomenAZ mentorship (Ember): one Cloudflare Worker, server-rendered, D1-backed.
// Every page except the marketing home, sign in and sign up needs a session.

import { ensureDb } from "./db";
import type { Env } from "./auth";
import type { Me } from "./auth";
import { esc, html, layout } from "./ui";

export type { Env };

const redirect = (to: string) => new Response(null, { status: 303, headers: { location: to } });

async function pairIdsFor(env: Env, userId: number): Promise<Set<number>> {
  const { results } = await env.DB.prepare(`SELECT id FROM pairs WHERE mentor_id = ? OR mentee_id = ?`).bind(userId, userId).all<{ id: number }>();
  return new Set(results.map((r) => r.id));
}

async function pairBelongsTo(env: Env, userId: number, pairId: number): Promise<boolean> {
  const row = await env.DB.prepare(`SELECT id FROM pairs WHERE id = ? AND (mentor_id = ? OR mentee_id = ?)`).bind(pairId, userId, userId).first<{ id: number }>();
  return !!row;
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method;

  if (path === "/health") return Response.json({ ok: true, db: !!env.DB, ai: !!env.AI });

  if (!env.DB) {
    return html(layout("Setup needed", `<div class="card"><h1>Database not connected</h1><p>The D1 binding <code>DB</code> is missing from this deployment.</p></div>`), 500);
  }

  try {
    await ensureDb(env.DB);
    if (!auth.sameOrigin(request)) return html(layout("Not allowed", `<div class="card"><h1>Cross-site request blocked</h1><p>Please try again from the site itself.</p></div>`), 403);
    const user = await auth.me(request, env);
    const m = (re: RegExp) => path.match(re);
    let r: RegExpMatchArray | null;

    // ---------------- Public
    if (method === "GET") {
      if (path === "/") return pages.home(env, user);
      if (path === "/login")
        return auth.loginPage(url.searchParams.get("next") ?? "", "", url.searchParams.get("reset") ? "Password saved. Sign in with your new password." : "");
      if (path === "/signup") return auth.signupPage();
      if (path === "/reset") return auth.resetForm(request, env, url);
    }
    if (method === "POST") {
      if (path === "/login") return auth.loginSubmit(request, env);
      if (path === "/signup") return auth.signupSubmit(request, env);
      if (path === "/reset") return auth.resetSubmit(request, env);
      if (path === "/logout") return auth.logout(request, env);
    }
    if (path === "/start" || path === "/join") return redirect("/signup");
    if (path === "/api/me") return user ? inbox.apiMe(env, user) : Response.json({ user: null });

    // ---------------- Everything below needs an account
    if (!user) {
      if (method === "GET" && path !== "/" && path !== "/login" && path !== "/signup") {
        return redirect(`/login?next=${encodeURIComponent(path)}`);
      }
      return redirect("/login");
    }
    const admin = user.role === "admin";
    const isSelf = (id: number) => user.userId === id;

    if (method === "GET") {
      if (path === "/home") return pages.dashboard(env, user);
      if (path === "/account") return auth.accountPage(request, env, url);
      if (path === "/admin/accounts") return admin ? auth.adminAccounts(request, env, url) : auth.forbidden();
      if (path === "/campfire") return admin ? pages.campfire(env, url) : auth.forbidden();
      if ((r = m(/^\/mentor\/(\d+)$/))) return admin || isSelf(+r[1]) ? pages.mentorWelcome(env, +r[1], user) : auth.forbidden();
      if ((r = m(/^\/matches\/(\d+)$/))) return admin || isSelf(+r[1]) ? pages.matches(env, +r[1], url, user) : auth.forbidden();
      if ((r = m(/^\/pair\/(\d+)$/))) {
        const pairId = +r[1];
        if (!admin && !(await pairBelongsTo(env, user.userId, pairId))) return auth.forbidden();
        return pages.pairPage(env, pairId, url, user);
      }
      if ((r = m(/^\/pair\/(\d+)\/meetings\/(\d+)\.ics$/))) {
        const pairId = +r[1];
        if (!admin && !(await pairBelongsTo(env, user.userId, pairId))) return auth.forbidden();
        return social.meetingIcs(env, pairId, +r[2]);
      }
      if ((r = m(/^\/api\/pair\/(\d+)\/messages$/))) {
        const pairId = +r[1];
        if (!admin && !(await pairBelongsTo(env, user.userId, pairId))) return auth.forbidden();
        return social.apiMessages(request, env, pairId, user);
      }
      if ((r = m(/^\/profile\/(\d+)$/))) return social.profilePage(env, +r[1], url, user);
      if (path === "/orgs") return social.orgsPage(env, url);
      if (path === "/orgs/new") return admin ? social.orgForm(url) : auth.forbidden();
      if (path === "/org") return social.orgByName(env, url);
      if ((r = m(/^\/orgs\/(\d+)$/))) return social.orgPage(env, +r[1], url);
      if (path === "/courses") return courses.coursesPage(env, url);
      if (path === "/courses/new") return user.role === "mentor" || admin ? courses.courseForm(env, url) : auth.forbidden();
      if (path === "/courses/personal") return user.role === "mentor" || admin ? personal.personalPage(env, url) : auth.forbidden();
      if ((r = m(/^\/courses\/personal\/(\d+)$/))) return personal.personalDetail(env, +r[1], url);
      if ((r = m(/^\/courses\/(\d+)$/))) return courses.courseDetail(env, +r[1]);
      if ((r = m(/^\/api\/opp-courses\/(\d+)$/))) return courses.apiOppCourses(env, +r[1]);
      if (path === "/opportunities") return pages.opportunities(env, url);
      if (path === "/opportunities/new") return admin ? pages.oppForm(url) : auth.forbidden();
      if ((r = m(/^\/opportunities\/(\d+)$/))) return pages.oppDetail(env, +r[1], url);
      if (path === "/api/why") return pages.apiWhy(env, url);
      if (path === "/messages") return inbox.inboxPage(env, user, url);
      if ((r = m(/^\/messages\/u:(\d+)$/))) return inbox.threadPage(env, user, +r[1]);
      if ((r = m(/^\/api\/dm\/(\d+)$/))) return inbox.apiDm(request, env, user, +r[1]);
      if (path === "/calendar") return inbox.calendarPage(env, user, url);
    }

    if (method === "POST") {
      if ((r = m(/^\/admin\/accounts\/(\d+)\/reset$/))) return admin ? auth.adminIssueReset(request, env, +r[1]) : auth.forbidden();
      if ((r = m(/^\/admin\/accounts\/(\d+)\/role$/))) return admin ? auth.adminSetRole(request, env, +r[1]) : auth.forbidden();
      if (path === "/account/password") return auth.changePassword(request, env);
      if (path === "/choose") return pages.choose(request, env, user);
      if ((r = m(/^\/pair\/(\d+)\/log$/))) {
        const pairId = +r[1];
        return admin || (await pairBelongsTo(env, user.userId, pairId)) ? pages.logMeeting(request, env, pairId) : auth.forbidden();
      }
      if ((r = m(/^\/pair\/(\d+)\/milestone\/(\d+)$/))) {
        const pairId = +r[1];
        return admin || (await pairBelongsTo(env, user.userId, pairId)) ? pages.milestone(env, pairId, +r[2]) : auth.forbidden();
      }
      if ((r = m(/^\/pair\/(\d+)\/meetings$/))) {
        const pairId = +r[1];
        return admin || (await pairBelongsTo(env, user.userId, pairId)) ? social.meetingSubmit(request, env, pairId) : auth.forbidden();
      }
      if ((r = m(/^\/pair\/(\d+)\/meetings\/(\d+)\/cancel$/))) {
        const pairId = +r[1];
        return admin || (await pairBelongsTo(env, user.userId, pairId)) ? social.meetingCancel(env, pairId, +r[2]) : auth.forbidden();
      }
      if ((r = m(/^\/api\/pair\/(\d+)\/messages$/))) {
        const pairId = +r[1];
        return admin || (await pairBelongsTo(env, user.userId, pairId)) ? social.apiMessages(request, env, pairId, user) : auth.forbidden();
      }
      if ((r = m(/^\/api\/agenda\/(\d+)$/))) {
        const pairId = +r[1];
        return admin || (await pairBelongsTo(env, user.userId, pairId)) ? pages.apiAgenda(env, pairId) : auth.forbidden();
      }
      if ((r = m(/^\/nudge\/(\d+)$/))) return admin ? pages.nudge(env, +r[1]) : auth.forbidden();
      if (path === "/api/rise") return admin ? pages.apiRise(env) : auth.forbidden();
      if (path === "/opportunities") return admin ? pages.oppSubmit(request, env) : auth.forbidden();
      if (path === "/orgs") return admin ? social.orgSubmit(request, env) : auth.forbidden();
      if ((r = m(/^\/profile\/(\d+)$/))) return admin || isSelf(+r[1]) ? social.profileSubmit(request, env, +r[1]) : auth.forbidden();
      if (path === "/courses") return user.role === "mentor" || admin ? courses.courseSubmit(request, env, user) : auth.forbidden();
      if (path === "/courses/personal") return user.role === "mentor" || admin ? personal.personalSubmit(request, env) : auth.forbidden();
      if (path === "/calendar") return inbox.calendarSchedule(request, env, user);
      if ((r = m(/^\/api\/dm\/(\d+)$/))) return inbox.apiDm(request, env, user, +r[1]);
    }

    return html(layout("Not found", `<div class="card"><h1>Page not found</h1><p><a href="/home">Back to your dashboard</a></p></div>`), 404);
  } catch (err) {
    console.error(err);
    return html(
      layout("Something went wrong", `<div class="card"><h1>Something went wrong</h1><p class="muted">${esc(err instanceof Error ? err.message : String(err))}</p><p><a href="/home">Back to your dashboard</a></p></div>`),
      500,
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return auth.secure(await route(request, env));
  },
} satisfies ExportedHandler<Env>;
