// Workers AI helpers. Every call has a timeout and a template fallback,
// so the demo never breaks (and works in mock mode where env.AI is missing).
// Free plan = 10,000 neurons/day for the whole team: thinking off, short answers.

import type { User } from "./logic";

const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const TIMEOUT_MS = 8000;

interface AiEnv {
  AI?: Ai;
}

/** Pulls text out of either reply shape (Gemma: choices[0].message.content, Llama: response). */
function extractText(r: unknown): string {
  const o = r as { response?: unknown; choices?: { message?: { content?: unknown } }[] };
  const t = o?.choices?.[0]?.message?.content ?? o?.response;
  return typeof t === "string" ? t.trim() : "";
}

/** One short AI answer, or null on any failure/timeout (caller uses its template instead). */
export async function ask(env: AiEnv, system: string, user: string, maxTokens = 200): Promise<string | null> {
  if (!env.AI) return null;
  try {
    // The model input is typed loosely so the call compiles across wrangler type versions.
    const run = env.AI.run.bind(env.AI) as unknown as (model: string, input: Record<string, unknown>) => Promise<unknown>;
    const call = run(MODEL, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_completion_tokens: maxTokens,
      chat_template_kwargs: { enable_thinking: false },
    });
    const timeout = new Promise<null>((res) => setTimeout(() => res(null), TIMEOUT_MS));
    const r = await Promise.race([call, timeout]);
    if (r === null) return null;
    const text = extractText(r).replace(/^["']|["']$/g, "");
    return text || null;
  } catch (e) {
    console.error("AI call failed", e);
    return null;
  }
}

function profile(u: User): string {
  return `${u.name} (${u.headline}; path: ${u.career}; courses: ${u.courses}; goal: ${u.goal}${u.no_degree ? "; no tech degree" : ""})`;
}

const VOICE = "You write for TechWomenAZ's mentorship program in Phoenix. Be specific, encouraging and brief. No preamble.";

/** One sentence on why this mentee and mentor will click. */
export async function whyClick(env: AiEnv, mentee: User, mentor: User, sharedCourses: string[]): Promise<{ text: string; ai: boolean }> {
  const fallback = sharedCourses.length
    ? `${mentor.name.split(" ")[0]} has already been through ${sharedCourses.slice(0, 2).join(" and ")}, so ${mentee.name.split(" ")[0]} gets advice from someone who knows exactly what those classes demand.`
    : `${mentor.name.split(" ")[0]} works in ${mentor.career} and can help ${mentee.name.split(" ")[0]} with: ${mentee.goal.toLowerCase()}.`;
  const t = await ask(
    env,
    VOICE,
    `Mentee: ${profile(mentee)}\nMentor: ${profile(mentor)}\nWrite ONE sentence (max 30 words) on why they'll click. Mention shared coursework if any.`,
    80,
  );
  return t ? { text: t.split("\n")[0], ai: true } : { text: fallback, ai: false };
}

/** Three milestones for a new pair, or null to use the starter template. */
export async function suggestMilestones(env: AiEnv, mentee: User, mentor: User): Promise<string[] | null> {
  const t = await ask(
    env,
    VOICE + " Reply with exactly 3 lines, one milestone per line, each under 12 words, no numbering or bullets.",
    `Mentee: ${profile(mentee)}\nMentor: ${profile(mentor)}\nSuggest 3 concrete milestones for the next 3 months toward the mentee's goal, using their coursework.`,
    120,
  );
  if (!t) return null;
  const lines = t
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/\*\*/g, "").trim())
    .filter((l) => l.length > 3)
    .slice(0, 3);
  return lines.length === 3 ? lines.map((l) => l.slice(0, 120)) : null;
}

/** A 3-question agenda for the next meeting. */
export async function agenda(
  env: AiEnv,
  ctx: { mentee: string; mentor: string; goal: string; open: string[]; lastNext: string | null },
): Promise<{ lines: string[]; ai: boolean }> {
  const fallback = [
    `What's one win since your last meeting${ctx.lastNext ? ` (you planned to: ${ctx.lastNext})` : ""}?`,
    `What's blocking progress on "${ctx.open[0] ?? ctx.goal}"?`,
    "What's one small step to finish before you meet again?",
  ];
  const t = await ask(
    env,
    VOICE + " Reply with exactly 3 questions, one per line, no numbering, each under 20 words.",
    `Mentee ${ctx.mentee}, mentor ${ctx.mentor}. Goal: ${ctx.goal}. Open milestones: ${ctx.open.join("; ") || "none"}. Last agreed next step: ${ctx.lastNext ?? "none yet"}.\nWrite a 3-question agenda for their next 20-minute meeting.`,
    120,
  );
  const lines = (t ?? "")
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/\*\*/g, "").trim())
    .filter((l) => l.length > 5)
    .slice(0, 3);
  return lines.length === 3 ? { lines, ai: true } : { lines: fallback, ai: false };
}

export interface RiseStats {
  pairs: number;
  activePct: number;
  meetings30: number;
  before: number;
  after: number;
  milestonesDone: number;
  milestonesTotal: number;
  noDegreePct: number;
  opportunities: number;
}

/** Sponsor-ready impact summary from combined numbers only (no names). */
export async function riseReport(env: AiEnv, s: RiseStats): Promise<{ text: string; ai: boolean }> {
  const fallback = `TechWomenAZ's mentorship program currently supports ${s.pairs} mentor–mentee pairs, and ${s.activePct}% of them are actively meeting. Members logged ${s.meetings30} mentoring sessions in the last 30 days.

Mentees' confidence about their tech careers rose from an average of ${s.before.toFixed(1)} to ${s.after.toFixed(1)} out of 10 since joining, and pairs have completed ${s.milestonesDone} of ${s.milestonesTotal} career milestones. ${s.noDegreePct}% of mentees are building a tech career without a tech degree.

With ${s.opportunities} partner internships, jobs and programs matched to members by coursework, every new sponsor dollar helps turn mentorship into real career outcomes in Phoenix.`;
  const t = await ask(
    env,
    VOICE + " Write for sponsors and donors. Use ONLY the numbers given. Never invent names, numbers, goals, targets or comparisons. Call participants \"mentees\" and \"mentors\" (the program includes people of every gender).",
    `Program stats: ${JSON.stringify(s)} (confidence is out of 10, before = when they joined, after = latest check-in).\nWrite a sponsor-ready impact summary in 3 short paragraphs, under 150 words total.`,
    260,
  );
  return t ? { text: t, ai: true } : { text: fallback, ai: false };
}
