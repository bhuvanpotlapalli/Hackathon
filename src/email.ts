// Email: one place for every message the program sends.
// Transport is Resend (https://resend.com) over plain fetch, so it works in a Worker.
// Without RESEND_API_KEY nothing is sent and every call is a no-op; EMAIL_LOG=1 prints
// the messages instead so local development can see exactly what would go out.
export interface MailEnv {
  DB: D1Database;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_REPLY_TO?: string;
  EMAIL_LOG?: string;
  APP_ORIGIN?: string;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

const DEFAULT_FROM = "TechWomenAZ <onboarding@resend.dev>";
const DEFAULT_ORIGIN = "https://fortfein.firebytehack.workers.dev";

export const appUrl = (env: MailEnv, path: string) => `${(env.APP_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, "")}${path}`;

export function mailEnabled(env: MailEnv): boolean {
  return !!env.RESEND_API_KEY || env.EMAIL_LOG === "1";
}

/** False when the program has not added a sending key yet (pages say so instead of pretending). */
export function mailConfigured(env: MailEnv): boolean {
  return !!env.RESEND_API_KEY;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function bodyHtml(mail: Mail): string {
  const paragraphs = mail.text
    .split("\n")
    .map((line) => (line.trim() ? `<p style="margin:0 0 .8rem;line-height:1.5">${escapeHtml(line)}</p>` : ""))
    .join("");
  const url = mail.text.match(/https?:\/\/\S+/)?.[0];
  return `<!doctype html><html><body style="margin:0;background:#f7f1e8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#241a2e">
<div style="max-width:560px;margin:0 auto;padding:24px 20px">
  <div style="background:#241a2e;border-radius:16px;padding:20px 22px;color:#fff">
    <div style="font-size:20px;font-weight:700">Tech<span style="color:#ff6b35">Women</span>AZ</div>
    <div style="opacity:.75;font-size:13px;margin-top:4px">Mentorship program</div>
  </div>
  <div style="background:#fff;border-radius:16px;padding:22px;margin-top:14px;border:1px solid #e7ddcf">
    ${paragraphs}
    ${url ? `<p style="margin:1.2rem 0 0"><a href="${escapeHtml(url)}" style="background:#ff6b35;color:#fff;text-decoration:none;padding:.7rem 1.1rem;border-radius:10px;font-weight:600;display:inline-block">Open TechWomenAZ</a></p>` : ""}
  </div>
  <p style="color:#7a6f85;font-size:12px;margin:14px 2px">You get this because you have a TechWomenAZ mentorship account. Reply to this email to reach the program team.</p>
</div></body></html>`;
}

/** Sends one message. Never throws: email problems must not break a page. */
export async function sendMail(env: MailEnv, mail: Mail): Promise<boolean> {
  if (!mail.to) return false;
  if (!env.RESEND_API_KEY) {
    if (env.EMAIL_LOG === "1") {
      console.log(`[email:log] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
      return true;
    }
    console.warn(`[email:skipped] no RESEND_API_KEY, dropped "${mail.subject}" to ${mail.to}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM || DEFAULT_FROM,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: bodyHtml(mail),
        ...(env.EMAIL_REPLY_TO ? { reply_to: env.EMAIL_REPLY_TO } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`[email:failed] ${res.status} ${await res.text().catch(() => "")} subject="${mail.subject}"`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email:failed]", err);
    return false;
  }
}

export async function sendMails(env: MailEnv, mails: Mail[]): Promise<void> {
  for (const m of mails) if (m.to) await sendMail(env, m);
}

// ---------------------------------------------------------------- recipients
export interface Person {
  user_id: number;
  name: string;
  email: string;
}

export async function pairPeople(env: MailEnv, pairId: number): Promise<Person[]> {
  const { results } = await env.DB.prepare(
    `SELECT u.id AS user_id, u.name, a.email
     FROM pairs p JOIN users u ON u.id IN (p.mentor_id, p.mentee_id) JOIN accounts a ON a.user_id = u.id
     WHERE p.id = ?`,
  )
    .bind(pairId)
    .all<Person>();
  return results;
}

export async function adminPeople(env: MailEnv): Promise<Person[]> {
  const { results } = await env.DB.prepare(
    `SELECT u.id AS user_id, u.name, a.email FROM accounts a JOIN users u ON u.id = a.user_id WHERE a.role = 'admin'`,
  ).all<Person>();
  return results;
}

export async function menteePeople(env: MailEnv, career?: string): Promise<Person[]> {
  const { results } = await env.DB.prepare(
    `SELECT u.id AS user_id, u.name, a.email FROM users u JOIN accounts a ON a.user_id = u.id
     WHERE u.role = 'mentee'${career ? " AND u.career = ?" : ""} ORDER BY u.name LIMIT 200`,
  )
    .bind(...(career ? [career] : []))
    .all<Person>();
  return results;
}

// ---------------------------------------------------------------- messages
const first = (n: string) => (n || "").split(" ")[0];

export const mail = {
  welcome: (to: string, name: string, what: string, href: string): Mail => ({
    to,
    subject: "Welcome to TechWomenAZ mentorship",
    text: `Hi ${first(name)},\n\nYour TechWomenAZ account is ready. You signed up as ${what}.\n\nStart here: ${href}\n\nYour mentor or mentee will show up on your dashboard, and you can message anyone in the program from the Messages tab. If you ever need a password reset, use "Forgot your password?" on the sign-in page.\n\n— The TechWomenAZ program team`,
  }),

  reset: (to: string, name: string, href: string): Mail => ({
    to,
    subject: "Reset your TechWomenAZ password",
    text: `Hi ${first(name)},\n\nUse this link to set a new password. It works once and expires in 24 hours.\n\n${href}\n\nIf you didn't ask for this, you can ignore this email — your password stays the same.`,
  }),

  nudge: (to: string, name: string, partner: string, message: string, href: string): Mail => ({
    to,
    subject: `A note from the program team about you and ${first(partner)}`,
    text: `Hi ${first(name)},\n\n${message}\n\nYour pair page: ${href}`,
  }),

  meeting: (to: string, name: string, partner: string, when: string, topic: string, href: string): Mail => ({
    to,
    subject: `Meeting booked with ${first(partner)}`,
    text: `Hi ${first(name)},\n\nYou and ${partner} have a meeting on ${when} (Arizona time)${topic ? ` about ${topic}` : ""}.\n\nAdd it to your calendar from the pair page: ${href}`,
  }),

  meetingCancelled: (to: string, name: string, partner: string, when: string, href: string): Mail => ({
    to,
    subject: `Meeting cancelled with ${first(partner)}`,
    text: `Hi ${first(name)},\n\nThe meeting on ${when} (Arizona time) with ${partner} was cancelled. You can book a new time from the pair page: ${href}`,
  }),

  message: (to: string, name: string, from: string, body: string, href: string): Mail => ({
    to,
    subject: `${from} sent you a message`,
    text: `Hi ${first(name)},\n\n${from} wrote:\n\n"${body.slice(0, 400)}"\n\nReply here: ${href}`,
  }),

  opportunity: (to: string, name: string, title: string, org: string, href: string): Mail => ({
    to,
    subject: `New for your path: ${title}`,
    text: `Hi ${first(name)},\n\n${org} just posted "${title}" and it matches the path you picked.\n\nSee the posting and your fit: ${href}`,
  }),

  newMember: (to: string, name: string, member: string, email: string, what: string, href: string): Mail => ({
    to,
    subject: `New ${what} account: ${member}`,
    text: `Hi ${first(name)},\n\n${member} (${email}) just created a ${what} account.\n\nAccounts: ${href}`,
  }),

  deleted: (to: string, name: string): Mail => ({
    to,
    subject: "Your TechWomenAZ account was deleted",
    text: `Hi ${first(name)},\n\nYour account and its data — pairs, messages, meetings and courses — have been deleted. This cannot be undone.\n\nIf this was a mistake, ask the program team to set you up again.`,
  }),

  deletedByAdmin: (to: string, name: string): Mail => ({
    to,
    subject: "Your TechWomenAZ account was closed",
    text: `Hi ${first(name)},\n\nThe program team closed your TechWomenAZ account and deleted its data. Reply to this email if you think that was a mistake.`,
  }),
};
