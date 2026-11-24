import { COURSE_SCHEMA } from "./courses";
import { PERSONAL_SCHEMA } from "./personal";
import { MEETINGS_SCHEMA, MESSAGES_SCHEMA, ORGS_SCHEMA, PROFILE_MIGRATIONS } from "./social";
import { DM_SCHEMA } from "./inbox";
// D1 schema and every query the app uses.
// All queries use prepare(...).bind(...); user input is never concatenated into SQL.

import { DAY_MS, starterMilestones, type Opportunity, type User } from "./logic";

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('mentor','mentee')),
    career TEXT NOT NULL,
    no_degree INTEGER NOT NULL DEFAULT 0,
    goal TEXT NOT NULL DEFAULT '',
    headline TEXT NOT NULL DEFAULT '',
    courses TEXT NOT NULL DEFAULT '',
    school TEXT NOT NULL DEFAULT '',
    availability TEXT NOT NULL,
    format TEXT NOT NULL,
    area TEXT NOT NULL,
    confidence INTEGER NOT NULL DEFAULT 5,
    capacity INTEGER NOT NULL DEFAULT 0,
    interests TEXT NOT NULL DEFAULT '',
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS pairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mentor_id INTEGER NOT NULL REFERENCES users(id),
    mentee_id INTEGER NOT NULL REFERENCES users(id),
    goal TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair_id INTEGER NOT NULL REFERENCES pairs(id),
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair_id INTEGER NOT NULL REFERENCES pairs(id),
    met_at TEXT NOT NULL,
    rating TEXT NOT NULL,
    takeaway TEXT NOT NULL DEFAULT '',
    next_step TEXT NOT NULL DEFAULT '',
    confidence INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS nudges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair_id INTEGER NOT NULL REFERENCES pairs(id),
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    org TEXT NOT NULL,
    career TEXT NOT NULL,
    courses TEXT NOT NULL DEFAULT '',
    area TEXT NOT NULL,
    format TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    deadline TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_checkins_pair ON checkins(pair_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pairs_mentee ON pairs(mentee_id)`,
  COURSE_SCHEMA,
  PERSONAL_SCHEMA,
  MESSAGES_SCHEMA,
  MEETINGS_SCHEMA,
  ORGS_SCHEMA,
  ...DM_SCHEMA,
  // Accounts and sessions (see auth.ts for the logic).
  `CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    pass_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    failed INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id)`,
  `CREATE TABLE IF NOT EXISTS password_resets (
    token TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
];

let ready: Promise<void> | null = null;

/** Creates the tables, and once removes the old demo fixtures. Safe to call on every request. */
export function ensureDb(db: D1Database): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.batch(SCHEMA.map((s) => db.prepare(s)));
      // Older databases: add columns introduced after the first launch.
      await db.prepare(`ALTER TABLE users ADD COLUMN interests TEXT NOT NULL DEFAULT ''`).run().catch(() => {});
      for (const m of PROFILE_MIGRATIONS) await db.prepare(m).run().catch(() => {});
      // Employer accounts (org_id) and who posted each opportunity/course.
      await db.prepare(`ALTER TABLE accounts ADD COLUMN org_id INTEGER`).run().catch(() => {});
      await db.prepare(`ALTER TABLE opportunities ADD COLUMN account_id INTEGER`).run().catch(() => {});
      await db.prepare(`ALTER TABLE courses ADD COLUMN account_id INTEGER`).run().catch(() => {});
      // One-time cleanup: this deployment started as a hackathon demo with fictional people.
      // Remove those rows so the live program only ever contains real accounts.
      const purged = await db.prepare(`SELECT v FROM meta WHERE k = 'purge_demo_v1'`).first<{ v: string }>();
      if (!purged) {
        const demo = `SELECT id FROM users WHERE is_demo = 1`;
        const demoPairs = `SELECT id FROM pairs WHERE mentor_id IN (${demo}) OR mentee_id IN (${demo})`;
        await db.batch([
          db.prepare(`DELETE FROM dm_messages WHERE thread_id IN (SELECT id FROM dm_threads WHERE a_key IN (SELECT 'u:' || id FROM users WHERE is_demo = 1) OR b_key IN (SELECT 'u:' || id FROM users WHERE is_demo = 1))`),
          db.prepare(`DELETE FROM dm_threads WHERE a_key IN (SELECT 'u:' || id FROM users WHERE is_demo = 1) OR b_key IN (SELECT 'u:' || id FROM users WHERE is_demo = 1)`),
          db.prepare(`DELETE FROM meetings WHERE pair_id IN (${demoPairs})`),
          db.prepare(`DELETE FROM checkins WHERE pair_id IN (${demoPairs})`),
          db.prepare(`DELETE FROM milestones WHERE pair_id IN (${demoPairs})`),
          db.prepare(`DELETE FROM nudges WHERE pair_id IN (${demoPairs})`),
          db.prepare(`DELETE FROM messages WHERE pair_id IN (${demoPairs})`),
          db.prepare(`DELETE FROM pairs WHERE mentor_id IN (${demo}) OR mentee_id IN (${demo})`),
          db.prepare(`DELETE FROM personal_courses WHERE demo = 1 OR mentor_id IN (${demo}) OR mentee_id IN (${demo})`),
          db.prepare(`DELETE FROM courses WHERE author LIKE '%(demo)%' OR provider LIKE '%(demo)%' OR author IN (SELECT name FROM users WHERE is_demo = 1)`),
          db.prepare(`DELETE FROM opportunities WHERE org LIKE '%(demo)%'`),
          db.prepare(`DELETE FROM orgs WHERE name LIKE '%(demo)%'`),
          db.prepare(`DELETE FROM users WHERE is_demo = 1`),
          db.prepare(`INSERT INTO meta (k, v) VALUES ('purge_demo_v1', ?)`).bind(new Date().toISOString()),
        ]);
      }
    })().catch((e) => {
      ready = null; // retry on the next request
      throw e;
    });
  }
  return ready;
}

// ---------- Queries ----------

export interface PairRow {
  id: number;
  mentor_id: number;
  mentee_id: number;
  goal: string;
  created_at: string;
  mentor_name: string;
  mentee_name: string;
  mentor_headline: string;
  mentee_headline: string;
  career: string;
  start_confidence: number;
}

const PAIR_SELECT = `
  SELECT p.id, p.mentor_id, p.mentee_id, p.goal, p.created_at,
         m.name AS mentor_name, m.headline AS mentor_headline,
         e.name AS mentee_name, e.headline AS mentee_headline,
         e.career AS career, e.confidence AS start_confidence
  FROM pairs p JOIN users m ON m.id = p.mentor_id JOIN users e ON e.id = p.mentee_id`;

export function getUser(db: D1Database, id: number) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first<User>();
}

export async function listMentors(db: D1Database) {
  const { results } = await db
    .prepare(
      // Employer contacts keep a mentor-shaped row, but they are not mentors to be matched with.
      `SELECT u.*, (SELECT COUNT(*) FROM pairs p WHERE p.mentor_id = u.id AND p.active = 1) AS active_pairs
       FROM users u WHERE u.role = 'mentor'
         AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.user_id = u.id AND a.org_id IS NOT NULL)`,
    )
    .all<User & { active_pairs: number }>();
  return results;
}

export async function mentorIdsForMentee(db: D1Database, menteeId: number): Promise<Set<number>> {
  const { results } = await db.prepare(`SELECT mentor_id FROM pairs WHERE mentee_id = ?`).bind(menteeId).all<{ mentor_id: number }>();
  return new Set(results.map((r) => r.mentor_id));
}

export async function listMenteePairs(db: D1Database, menteeId: number) {
  const { results } = await db.prepare(`${PAIR_SELECT} WHERE p.mentee_id = ?`).bind(menteeId).all<PairRow>();
  return results;
}

export function getPair(db: D1Database, id: number) {
  return db.prepare(`${PAIR_SELECT} WHERE p.id = ?`).bind(id).first<PairRow>();
}

export async function listPairs(db: D1Database) {
  const { results } = await db.prepare(`${PAIR_SELECT} WHERE p.active = 1`).all<PairRow>();
  return results;
}

export interface Checkin {
  id: number;
  pair_id: number;
  met_at: string;
  rating: string;
  takeaway: string;
  next_step: string;
  confidence: number;
}

export async function listCheckins(db: D1Database, pairId?: number) {
  const q = pairId
    ? db.prepare(`SELECT * FROM checkins WHERE pair_id = ? ORDER BY met_at DESC`).bind(pairId)
    : db.prepare(`SELECT * FROM checkins ORDER BY met_at DESC`);
  const { results } = await q.all<Checkin>();
  return results;
}

export interface Milestone {
  id: number;
  pair_id: number;
  title: string;
  done: number;
  position: number;
}

export async function listMilestones(db: D1Database, pairId?: number) {
  const q = pairId
    ? db.prepare(`SELECT * FROM milestones WHERE pair_id = ? ORDER BY position`).bind(pairId)
    : db.prepare(`SELECT * FROM milestones ORDER BY pair_id, position`);
  const { results } = await q.all<Milestone>();
  return results;
}

export async function createUser(db: D1Database, u: Omit<User, "id" | "created_at" | "interests"> & { interests?: string }): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO users (name, role, career, no_degree, goal, headline, courses, school, availability, format, area, confidence, capacity, interests, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(u.name, u.role, u.career, u.no_degree, u.goal, u.headline, u.courses, u.school, u.availability, u.format, u.area, u.confidence, u.capacity, u.interests ?? "", new Date().toISOString())
    .first<{ id: number }>();
  return row!.id;
}

export async function createPair(db: D1Database, mentorId: number, mentee: User, milestones: string[]): Promise<number> {
  const row = await db
    .prepare(`INSERT INTO pairs (mentor_id, mentee_id, goal, active, created_at) VALUES (?, ?, ?, 1, ?) RETURNING id`)
    .bind(mentorId, mentee.id, mentee.goal, new Date().toISOString())
    .first<{ id: number }>();
  const pairId = row!.id;
  await db.batch(
    milestones.map((t, i) => db.prepare(`INSERT INTO milestones (pair_id, title, done, position) VALUES (?, ?, 0, ?)`).bind(pairId, t, i)),
  );
  return pairId;
}

export function addCheckin(db: D1Database, pairId: number, c: { rating: string; takeaway: string; next_step: string; confidence: number }) {
  return db
    .prepare(`INSERT INTO checkins (pair_id, met_at, rating, takeaway, next_step, confidence) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(pairId, new Date().toISOString(), c.rating, c.takeaway, c.next_step, c.confidence)
    .run();
}

export function toggleMilestone(db: D1Database, pairId: number, milestoneId: number) {
  return db.prepare(`UPDATE milestones SET done = 1 - done WHERE id = ? AND pair_id = ?`).bind(milestoneId, pairId).run();
}

export function addNudge(db: D1Database, pairId: number, message: string) {
  return db.prepare(`INSERT INTO nudges (pair_id, message, created_at) VALUES (?, ?, ?)`).bind(pairId, message, new Date().toISOString()).run();
}

export async function nudgeCounts(db: D1Database): Promise<Map<number, number>> {
  const { results } = await db.prepare(`SELECT pair_id, COUNT(*) AS n FROM nudges GROUP BY pair_id`).all<{ pair_id: number; n: number }>();
  return new Map(results.map((r) => [r.pair_id, r.n]));
}

export async function listOpportunities(db: D1Database) {
  const { results } = await db.prepare(`SELECT * FROM opportunities ORDER BY created_at DESC`).all<Opportunity>();
  return results;
}

export async function createOpportunity(db: D1Database, o: Omit<Opportunity, "id" | "created_at">, accountId: number | null = null): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO opportunities (kind, title, org, career, courses, area, format, description, link, deadline, account_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(o.kind, o.title, o.org, o.career, o.courses, o.area, o.format, o.description, o.link, o.deadline, accountId, new Date().toISOString())
    .first<{ id: number }>();
  return row!.id;
}

/**
 * Deletes an account and everything that belongs to it: pairs with their check-ins, milestones,
 * meetings, nudges and pair chat; direct messages; personal and posted courses; postings; the
 * organization it owns; sessions and reset tokens. There are no foreign keys in D1 here, so the
 * order below is what keeps the data consistent.
 */
export async function deleteAccount(db: D1Database, accountId: number): Promise<{ email: string; name: string } | null> {
  const acct = await db
    .prepare(`SELECT a.id, a.user_id, a.org_id, a.email, u.name FROM accounts a JOIN users u ON u.id = a.user_id WHERE a.id = ?`)
    .bind(accountId)
    .first<{ id: number; user_id: number; org_id: number | null; email: string; name: string }>();
  if (!acct) return null;
  const userId = acct.user_id;
  const { results: pairs } = await db.prepare(`SELECT id FROM pairs WHERE mentor_id = ? OR mentee_id = ?`).bind(userId, userId).all<{ id: number }>();
  const ids = pairs.map((p) => p.id);
  if (ids.length) {
    const list = ids.map(() => "?").join(",");
    await db.batch([
      db.prepare(`DELETE FROM meetings WHERE pair_id IN (${list})`).bind(...ids),
      db.prepare(`DELETE FROM checkins WHERE pair_id IN (${list})`).bind(...ids),
      db.prepare(`DELETE FROM milestones WHERE pair_id IN (${list})`).bind(...ids),
      db.prepare(`DELETE FROM nudges WHERE pair_id IN (${list})`).bind(...ids),
      db.prepare(`DELETE FROM messages WHERE pair_id IN (${list})`).bind(...ids),
    ]);
  }
  await db.batch([
    db.prepare(`DELETE FROM pairs WHERE mentor_id = ? OR mentee_id = ?`).bind(userId, userId),
    db.prepare(`DELETE FROM personal_courses WHERE mentor_id = ? OR mentee_id = ?`).bind(userId, userId),
    db.prepare(`DELETE FROM courses WHERE account_id = ?`).bind(accountId),
    db.prepare(`DELETE FROM opportunities WHERE account_id = ?`).bind(accountId),
    db.prepare(`DELETE FROM dm_messages WHERE sender_key = ?`).bind(`u:${userId}`),
    db.prepare(`DELETE FROM dm_threads WHERE a_key = ? OR b_key = ?`).bind(`u:${userId}`, `u:${userId}`),
    db.prepare(`DELETE FROM password_resets WHERE account_id = ?`).bind(accountId),
    db.prepare(`DELETE FROM sessions WHERE account_id = ?`).bind(accountId),
    db.prepare(`DELETE FROM accounts WHERE id = ?`).bind(accountId),
    db.prepare(`DELETE FROM users WHERE id = ?`).bind(userId),
    ...(acct.org_id ? [db.prepare(`DELETE FROM orgs WHERE id = ?`).bind(acct.org_id)] : []),
  ]);
  return { email: acct.email, name: acct.name };
}

export async function listMentees(db: D1Database) {
  const { results } = await db.prepare(`SELECT * FROM users WHERE role = 'mentee' ORDER BY name`).all<User>();
  return results;
}
