// D1 schema, demo seed data, and every query Ember uses.
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
];

// ---------- Demo seed data (fictional people, labelled as demo data in the README) ----------

type SeedUser = Omit<User, "id" | "created_at">;

// Mentors list courses they've taken or teach, so mentees get someone who has been through their classes.
const MENTORS: SeedUser[] = [
  { name: "Dana Ruiz", role: "mentor", career: "UX/Design", no_degree: 1, headline: "Senior UX Designer, Scottsdale fintech", school: "Google UX Certificate", courses: "Intro to UX Design, User Research Methods, Figma Prototyping, Human-Computer Interaction", goal: "portfolio reviews, UX research, landing a first design internship", availability: "Weekday evenings", format: "Both", area: "Scottsdale", confidence: 9, capacity: 3 },
  { name: "Priya Natarajan", role: "mentor", career: "Software", no_degree: 0, headline: "Backend Engineer, Phoenix health-tech", school: "ASU, B.S. Computer Science", courses: "Data Structures and Algorithms, Intro to Java, Operating Systems, Databases", goal: "coding interviews, first software job, GitHub projects", availability: "Weekends", format: "Online", area: "Phoenix", confidence: 9, capacity: 2 },
  { name: "Marcus Bell", role: "mentor", career: "Cybersecurity", no_degree: 1, headline: "SOC Analyst, Tempe (former Army signals)", school: "CompTIA Security+, Network+", courses: "Network Security, Computer Networking, Linux Administration, Ethical Hacking", goal: "Security+, home lab, career change into security", availability: "Flexible", format: "Both", area: "East Valley", confidence: 8, capacity: 3 },
  { name: "Lena Okafor", role: "mentor", career: "Data/AI", no_degree: 0, headline: "Data Scientist, Phoenix utilities", school: "UofA, M.S. Statistics", courses: "Statistics, Python for Data Science, SQL Databases, Machine Learning, Linear Algebra", goal: "SQL, Python, dashboards, machine learning, data analyst internship", availability: "Weekday evenings", format: "Online", area: "Phoenix", confidence: 9, capacity: 2 },
  { name: "Sofia Martinez", role: "mentor", career: "Product", no_degree: 0, headline: "Product Manager, Chandler SaaS", school: "GCU, MBA", courses: "Product Management, Business Analytics, Marketing Strategy, Agile Project Management", goal: "product management, roadmaps, switching from teaching into tech", availability: "Weekends", format: "In-person", area: "East Valley", confidence: 8, capacity: 2 },
  { name: "James Whitehorse", role: "mentor", career: "IT/Support", no_degree: 1, headline: "IT Manager, Glendale school district", school: "CompTIA A+, Rio Salado College", courses: "Computer Hardware, Windows Administration, Computer Networking, Help Desk Fundamentals", goal: "help desk, CompTIA A+, first IT job, career change", availability: "Weekday evenings", format: "Both", area: "West Valley", confidence: 8, capacity: 3 },
  { name: "Aisha Rahman", role: "mentor", career: "Tech Sales & Marketing", no_degree: 0, headline: "Account Executive, Phoenix cloud startup", school: "ASU, B.S. Marketing", courses: "Marketing Strategy, Digital Marketing, Business Communication, Sales Fundamentals", goal: "tech sales, LinkedIn, networking, marketing roles", availability: "Flexible", format: "Online", area: "Online only", confidence: 9, capacity: 2 },
  { name: "Kevin Tran", role: "mentor", career: "Software", no_degree: 1, headline: "Frontend Developer, bootcamp grad (ex-chef)", school: "Coding bootcamp", courses: "Web Development, JavaScript, HTML and CSS, React", goal: "bootcamp, JavaScript, web portfolio, career change into software", availability: "Weekday evenings", format: "Both", area: "Phoenix", confidence: 8, capacity: 2 },
];

// Mentees: college students and adult career changers (TechWomenAZ serves college and above).
const MENTEES: SeedUser[] = [
  { name: "Maya Chen", role: "mentee", career: "UX/Design", no_degree: 0, headline: "ASU junior, Graphic Design", school: "Arizona State University", courses: "Intro to UX Design, Figma Prototyping, Typography", goal: "Land a UX design internship by May with a strong portfolio", availability: "Weekday evenings", format: "Both", area: "Scottsdale", confidence: 4, capacity: 0 },
  { name: "Rosa Delgado", role: "mentee", career: "Data/AI", no_degree: 1, headline: "Former nurse, career changer", school: "Online certificate", courses: "SQL Databases, Statistics, Excel", goal: "Become a data analyst using SQL and dashboards", availability: "Weekday evenings", format: "Online", area: "Phoenix", confidence: 3, capacity: 0 },
  { name: "Tyler Brooks", role: "mentee", career: "Cybersecurity", no_degree: 1, headline: "Retail manager, career changer", school: "Maricopa Community College", courses: "Computer Networking, Network Security", goal: "Pass Security+ and get a SOC analyst job", availability: "Flexible", format: "Both", area: "East Valley", confidence: 4, capacity: 0 },
  { name: "Jordan Lee", role: "mentee", career: "Software", no_degree: 0, headline: "GCC freshman, Computer Science", school: "Glendale Community College", courses: "Intro to Java, Calculus I", goal: "Build my first project for GitHub", availability: "Weekends", format: "Online", area: "Phoenix", confidence: 5, capacity: 0 },
  { name: "Grace Kim", role: "mentee", career: "Product", no_degree: 0, headline: "Middle school teacher", school: "NAU, B.A. Education", courses: "Agile Project Management, Business Analytics", goal: "Switch from teaching into product management", availability: "Weekends", format: "In-person", area: "East Valley", confidence: 5, capacity: 0 },
  { name: "Andre Wilson", role: "mentee", career: "IT/Support", no_degree: 1, headline: "Warehouse lead", school: "Rio Salado College", courses: "Computer Hardware, Help Desk Fundamentals", goal: "Earn CompTIA A+ and land a help desk job", availability: "Weekday evenings", format: "Both", area: "West Valley", confidence: 3, capacity: 0 },
  { name: "Nina Patel", role: "mentee", career: "Software", no_degree: 0, headline: "GCU sophomore, Software Engineering", school: "Grand Canyon University", courses: "Data Structures and Algorithms, Databases, Discrete Math", goal: "Prepare for coding interviews for a summer internship", availability: "Weekends", format: "Online", area: "Phoenix", confidence: 5, capacity: 0 },
  { name: "Carmen Lopez", role: "mentee", career: "Tech Sales & Marketing", no_degree: 1, headline: "Real estate agent", school: "Online courses", courses: "Digital Marketing, Sales Fundamentals", goal: "Move into tech sales and build my LinkedIn network", availability: "Flexible", format: "Online", area: "Online only", confidence: 6, capacity: 0 },
  { name: "Sam Rivera", role: "mentee", career: "Software", no_degree: 1, headline: "Bootcamp student", school: "Coding bootcamp", courses: "JavaScript, HTML and CSS", goal: "Finish bootcamp and build a web portfolio", availability: "Weekday evenings", format: "Both", area: "Phoenix", confidence: 4, capacity: 0 },
  { name: "Olivia Grant", role: "mentee", career: "Data/AI", no_degree: 0, headline: "ASU senior, Statistics", school: "Arizona State University", courses: "Python for Data Science, Machine Learning, Linear Algebra", goal: "Learn machine learning for a data internship", availability: "Weekday evenings", format: "Online", area: "Phoenix", confidence: 5, capacity: 0 },
  // Two unmatched mentees so judges can try Spark Match on existing profiles.
  { name: "Elena Vasquez", role: "mentee", career: "UX/Design", no_degree: 1, headline: "Graphic designer, career changer", school: "Scottsdale Community College", courses: "User Research Methods, Human-Computer Interaction", goal: "Move from print design into UX research", availability: "Weekday evenings", format: "Both", area: "Scottsdale", confidence: 4, capacity: 0 },
  { name: "Ben Carter", role: "mentee", career: "Not sure yet", no_degree: 1, headline: "Barista exploring tech", school: "Phoenix College", courses: "Intro to Computer Science, Statistics", goal: "Figure out which tech career fits me", availability: "Flexible", format: "Online", area: "Online only", confidence: 2, capacity: 0 },
];

// Second mentors per path, appended after the mentees so existing demo links (/matches/19) keep their ids.
const EXTRA_MENTORS: SeedUser[] = [
  { name: "Hannah Brooks", role: "mentor", career: "UX/Design", no_degree: 0, headline: "Product Designer, Tempe ed-tech", school: "ASU, B.S. Graphic Information Technology", courses: "Intro to UX Design, Figma Prototyping, Typography, Design Systems, User Research Methods", goal: "UX portfolio, design internships, Figma, career change into UX", availability: "Weekday evenings", format: "Both", area: "Scottsdale", confidence: 9, capacity: 3 },
  { name: "Daniel Okoye", role: "mentor", career: "Data/AI", no_degree: 1, headline: "Analytics Engineer, Phoenix logistics (ex-pharmacy tech)", school: "Google Data Analytics Certificate", courses: "SQL Databases, Statistics, Excel, Python for Data Science, Machine Learning, Linear Algebra", goal: "data analyst roles, SQL, dashboards, machine learning internship, career change", availability: "Flexible", format: "Online", area: "Phoenix", confidence: 9, capacity: 3 },
  { name: "Maria Santos", role: "mentor", career: "Software", no_degree: 0, headline: "Software Engineer, Phoenix payments company", school: "GCU, B.S. Software Engineering", courses: "Intro to Java, Calculus I, Data Structures and Algorithms, Discrete Math, Databases, JavaScript, HTML and CSS", goal: "first project, GitHub, coding interviews, summer internship, web portfolio", availability: "Flexible", format: "Online", area: "Phoenix", confidence: 9, capacity: 3 },
  { name: "Ray Castillo", role: "mentor", career: "Cybersecurity", no_degree: 1, headline: "Security Engineer, Chandler chipmaker", school: "Security+, CySA+", courses: "Computer Networking, Network Security, Linux Administration, Incident Response", goal: "Security+, SOC analyst job, home lab, career change into security", availability: "Flexible", format: "Both", area: "East Valley", confidence: 9, capacity: 3 },
  { name: "Tasha Greene", role: "mentor", career: "IT/Support", no_degree: 1, headline: "Systems Administrator, Mesa hospital", school: "CompTIA A+, Network+", courses: "Computer Hardware, Help Desk Fundamentals, Windows Administration, Computer Networking", goal: "CompTIA A+, help desk job, first IT job, career change", availability: "Weekday evenings", format: "Both", area: "West Valley", confidence: 9, capacity: 3 },
  { name: "Nora Klein", role: "mentor", career: "Product", no_degree: 0, headline: "Senior Product Manager, Scottsdale health-tech (ex-teacher)", school: "NAU, B.A. Education", courses: "Agile Project Management, Business Analytics, Product Management, User Research Methods", goal: "product management, switching from teaching into tech, roadmaps", availability: "Weekends", format: "Both", area: "East Valley", confidence: 9, capacity: 3 },
  { name: "Luis Romero", role: "mentor", career: "Tech Sales & Marketing", no_degree: 1, headline: "Sales Engineer, Phoenix cybersecurity startup (ex-realtor)", school: "Online courses", courses: "Digital Marketing, Sales Fundamentals, Business Communication", goal: "tech sales, LinkedIn network, career change into sales", availability: "Flexible", format: "Online", area: "Online only", confidence: 9, capacity: 3 },
];

// Fictional demo postings (labelled as demo data in the README).
const OPPS: Omit<Opportunity, "id" | "created_at">[] = [
  { kind: "Internship", title: "UX Design Intern (Summer)", org: "Saguaro Health (demo)", career: "UX/Design", courses: "Intro to UX Design, User Research Methods, Figma Prototyping", area: "Scottsdale", format: "Both", description: "Help redesign our patient app. Portfolio required.", link: "", deadline: "2027-02-15" },
  { kind: "Internship", title: "Data Analyst Intern", org: "Valley Water Co. (demo)", career: "Data/AI", courses: "SQL Databases, Statistics, Python for Data Science", area: "Phoenix", format: "Online", description: "Build dashboards on water usage data.", link: "", deadline: "2027-03-01" },
  { kind: "Job", title: "Junior SOC Analyst", org: "Desert Shield Security (demo)", career: "Cybersecurity", courses: "Network Security, Computer Networking, Linux Administration", area: "East Valley", format: "In-person", description: "Entry-level. Security+ preferred, no degree required.", link: "", deadline: "2027-01-10" },
  { kind: "Internship", title: "Software Engineering Intern", org: "Copper State Tech (demo)", career: "Software", courses: "Data Structures and Algorithms, Databases, Intro to Java", area: "Phoenix", format: "Both", description: "12-week paid internship on our backend team.", link: "", deadline: "2027-01-31" },
  { kind: "Job", title: "IT Help Desk Technician", org: "Sun Valley Schools (demo)", career: "IT/Support", courses: "Help Desk Fundamentals, Computer Hardware, Windows Administration", area: "West Valley", format: "In-person", description: "Support 2,000 students and staff. A+ preferred.", link: "", deadline: "2026-12-20" },
  { kind: "Mentorship program", title: "Women in Product Circle", org: "TechWomenAZ (demo)", career: "Product", courses: "Product Management, Agile Project Management", area: "Phoenix", format: "Online", description: "6-week small-group mentorship for aspiring PMs.", link: "", deadline: "2027-01-05" },
];

// [mentorIndex, menteeIndex, pairAgeDays, meetingDaysAgo[], milestonesDone]
// Chosen so the Campfire shows every flame level (Blazing → Embers).
const PAIRS: [number, number, number, number[], number][] = [
  [0, 0, 60, [1, 8, 15, 22, 29, 36], 2], // Maya + Dana: Blazing, long streak
  [3, 1, 45, [2, 9, 16, 23], 1], // Rosa + Lena: Blazing
  [2, 2, 40, [4, 11, 25], 1], // Tyler + Marcus: Blazing
  [1, 3, 30, [6, 13], 1], // Jordan + Priya: Glowing
  [4, 4, 35, [9, 20], 1], // Grace + Sofia: Glowing
  [5, 5, 40, [12, 26], 0], // Andre + James: Glowing
  [7, 8, 30, [17], 0], // Sam + Kevin: Flickering
  [6, 7, 35, [18, 30], 0], // Carmen + Aisha: Flickering
  [1, 6, 40, [22], 0], // Nina + Priya: Embers
  [3, 9, 45, [25, 38], 0], // Olivia + Lena: Embers
];

// Six meetings that progress toward a goal; each pair walks through them in order, so nothing repeats.
const TAKEAWAYS = [
  ["Set the goal and mapped out the next three months", "Pick the first milestone and a date for it"],
  ["Matched coursework to the goal and chose a starter project", "Write a one-page project outline"],
  ["Walked through the project outline together", "Finish a first rough version"],
  ["Reviewed the first version and found two gaps", "Fix the gaps and share it with one peer"],
  ["Practiced a mock interview using the project", "Rewrite two answers using the STAR format"],
  ["Polished the resume and LinkedIn headline", "Apply to three roles and log them"],
];

function iso(daysAgo: number, now: number): string {
  return new Date(now - daysAgo * DAY_MS - 3 * 60 * 60 * 1000).toISOString();
}

/** Builds the seed statements. Dates are relative to "now" so flames always look right. */
export function seedStatements(db: D1Database): D1PreparedStatement[] {
  const now = Date.now();
  const stmts: D1PreparedStatement[] = [];
  const insertUser = db.prepare(
    `INSERT INTO users (id, name, role, career, no_degree, goal, headline, courses, school, availability, format, area, confidence, capacity, is_demo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
  );
  const all = [...MENTORS, ...MENTEES, ...EXTRA_MENTORS];
  all.forEach((u, i) => {
    stmts.push(
      insertUser.bind(i + 1, u.name, u.role, u.career, u.no_degree, u.goal, u.headline, u.courses, u.school, u.availability, u.format, u.area, u.confidence, u.capacity, iso(70, now)),
    );
  });

  PAIRS.forEach(([mi, ei, age, meetings, done], p) => {
    const pairId = p + 1;
    const mentorId = mi + 1;
    const mentee = MENTEES[ei];
    const menteeId = MENTORS.length + ei + 1;
    stmts.push(
      db.prepare(`INSERT INTO pairs (id, mentor_id, mentee_id, goal, active, created_at) VALUES (?, ?, ?, ?, 1, ?)`).bind(pairId, mentorId, menteeId, mentee.goal, iso(age, now)),
    );
    starterMilestones(mentee.career, mentee.goal).forEach((title, k) => {
      stmts.push(
        db.prepare(`INSERT INTO milestones (pair_id, title, done, position) VALUES (?, ?, ?, ?)`).bind(pairId, title, k < done ? 1 : 0, k),
      );
    });
    // Oldest meeting first; confidence climbs a little each meeting.
    [...meetings].reverse().forEach((daysAgo, k) => {
      const [takeaway, next] = TAKEAWAYS[k % TAKEAWAYS.length];
      const conf = Math.min(10, mentee.confidence + 1 + Math.floor(k * 0.8));
      stmts.push(
        db.prepare(`INSERT INTO checkins (pair_id, met_at, rating, takeaway, next_step, confidence) VALUES (?, ?, ?, ?, ?, ?)`).bind(pairId, iso(daysAgo, now), k % 3 === 2 ? "🙂" : "🔥", takeaway, next, conf),
      );
    });
  });
  OPPS.forEach((o, i) => {
    stmts.push(
      db
        .prepare(`INSERT INTO opportunities (kind, title, org, career, courses, area, format, description, link, deadline, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(o.kind, o.title, o.org, o.career, o.courses, o.area, o.format, o.description, o.link, o.deadline, iso(10 - i, now)),
    );
  });
  return stmts;
}

let ready: Promise<void> | null = null;

/** Creates tables and loads demo data the first time the app runs. Safe to call on every request. */
export function ensureDb(db: D1Database): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.batch(SCHEMA.map((s) => db.prepare(s)));
      const row = await db.prepare(`SELECT COUNT(*) AS n FROM users`).first<{ n: number }>();
      if (!row || row.n === 0) await db.batch(seedStatements(db));
    })().catch((e) => {
      ready = null; // retry on the next request
      throw e;
    });
  }
  return ready;
}

/** Wipes everything and reloads the demo data (admin "Reset demo" button). */
export async function resetDb(db: D1Database): Promise<void> {
  await db.batch(
    ["DROP TABLE IF EXISTS opportunities", "DROP TABLE IF EXISTS nudges", "DROP TABLE IF EXISTS checkins", "DROP TABLE IF EXISTS milestones", "DROP TABLE IF EXISTS pairs", "DROP TABLE IF EXISTS users"].map((s) => db.prepare(s)),
  );
  ready = null;
  await ensureDb(db);
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
      `SELECT u.*, (SELECT COUNT(*) FROM pairs p WHERE p.mentor_id = u.id AND p.active = 1) AS active_pairs
       FROM users u WHERE u.role = 'mentor'`,
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

export async function createUser(db: D1Database, u: Omit<User, "id" | "created_at">): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO users (name, role, career, no_degree, goal, headline, courses, school, availability, format, area, confidence, capacity, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(u.name, u.role, u.career, u.no_degree, u.goal, u.headline, u.courses, u.school, u.availability, u.format, u.area, u.confidence, u.capacity, new Date().toISOString())
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

export async function createOpportunity(db: D1Database, o: Omit<Opportunity, "id" | "created_at">): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO opportunities (kind, title, org, career, courses, area, format, description, link, deadline, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(o.kind, o.title, o.org, o.career, o.courses, o.area, o.format, o.description, o.link, o.deadline, new Date().toISOString())
    .first<{ id: number }>();
  return row!.id;
}

export async function listMentees(db: D1Database) {
  const { results } = await db.prepare(`SELECT * FROM users WHERE role = 'mentee' ORDER BY name`).all<User>();
  return results;
}
