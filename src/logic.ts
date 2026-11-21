// Ember's two formulas: flame heat and match score.
// Kept simple and explainable on purpose, so judges (and TechWomenAZ) can trust them.

export const DAY_MS = 24 * 60 * 60 * 1000;

export type Status = "Blazing" | "Glowing" | "Flickering" | "Embers";

export interface User {
  id: number;
  name: string;
  role: "mentor" | "mentee";
  career: string;
  no_degree: number;
  goal: string;
  headline: string;
  /** Mentee: courses they're taking or have taken. Mentor: courses they've taken or teach. Comma-separated. */
  courses: string;
  school: string;
  availability: string;
  format: string;
  area: string;
  confidence: number;
  capacity: number;
  /** Fun interests outside tech, comma-separated (e.g. "Hiking, Gaming"). */
  interests: string;
  created_at: string;
}

export const CAREERS = [
  "Software",
  "UX/Design",
  "Data/AI",
  "Product",
  "Cybersecurity",
  "IT/Support",
  "Tech Sales & Marketing",
  "Not sure yet",
];
export const FUN_INTERESTS = ["Gaming", "Hiking", "Art and crafts", "Reading", "Cooking", "Music", "Sports", "Travel"];
export const AVAILABILITY = ["Weekday evenings", "Weekends", "Flexible"];
export const FORMATS = ["Online", "In-person", "Both"];
export const AREAS = ["Phoenix", "Scottsdale", "East Valley", "West Valley", "Online only"];

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Monday 00:00 UTC of the week containing `d`. */
function weekStart(d: Date): number {
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY_MS;
}

/**
 * Consecutive weeks with at least one meeting, counting back from this week.
 * If there is no meeting yet this week, the streak counts from last week,
 * so a streak doesn't "break" just because it's Monday.
 */
export function streakWeeks(meetingDates: string[], now = new Date()): number {
  const weeks = new Set(meetingDates.map((d) => weekStart(new Date(d))));
  let w = weekStart(now);
  if (!weeks.has(w)) w -= 7 * DAY_MS;
  let streak = 0;
  while (weeks.has(w)) {
    streak++;
    w -= 7 * DAY_MS;
  }
  return streak;
}

export interface Flame {
  heat: number;
  status: Status;
  daysQuiet: number;
  streak: number;
}

/** heat = clamp(100 − 4 × daysSinceLastMeeting + 5 × streakWeeks, 0, 100) */
export function flameFor(meetingDates: string[], pairCreatedAt: string, now = new Date()): Flame {
  const last = meetingDates.length
    ? Math.max(...meetingDates.map((d) => new Date(d).getTime()))
    : new Date(pairCreatedAt).getTime();
  const daysQuiet = Math.max(0, Math.floor((now.getTime() - last) / DAY_MS));
  const streak = streakWeeks(meetingDates, now);
  const heat = clamp(100 - 4 * daysQuiet + 5 * streak, 0, 100);
  return { heat, status: statusFor(heat), daysQuiet, streak };
}

export function statusFor(heat: number): Status {
  if (heat >= 70) return "Blazing";
  if (heat >= 40) return "Glowing";
  if (heat >= 15) return "Flickering";
  return "Embers";
}

export const STATUS_LABEL: Record<Status, string> = {
  Blazing: "Blazing",
  Glowing: "Glowing",
  Flickering: "Flickering",
  Embers: "Embers",
};

const STOP = new Set(
  "a an and the to of for in on at by with from into my me i ii iii want get land learn more about become my our your their this that job role career tech intro introduction fundamentals basics principles methods computer science advanced applied".split(
    " ",
  ),
);

export function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

export function splitCourses(text: string): string[] {
  return text
    .split(/[,;\n]+/)
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * Which of `mine` courses line up with `theirs`.
 * Two courses match if they share a meaningful word ("Intro to Python" ~ "Python for Data").
 */
export function sharedCourses(mine: string, theirs: string): string[] {
  const other = splitCourses(theirs).map(keywords);
  return splitCourses(mine).filter((c) => {
    const k = keywords(c);
    return other.some((o) => [...k].some((w) => o.has(w)));
  });
}

export interface MatchResult {
  mentor: User;
  score: number;
  reasons: string[];
  courses: string[];
}

/**
 * Match score (0–100). Coursework is the star: TechWomenAZ wants mentees matched
 * with mentors who have real experience in the courses they're taking.
 *   30 same career path
 * + up to 30 coursework overlap (10 per shared course)
 * + up to 15 goal keyword overlap
 * + 10 availability overlaps
 * +  5 format/area works
 * + 10 mentor has open capacity
 * + up to 10 shared fun interests (tiebreaker; total capped at 100)
 */
export function matchScore(mentee: User, mentor: User, mentorActivePairs: number): MatchResult {
  let score = 0;
  const reasons: string[] = [];

  if (mentee.career === mentor.career) {
    score += 30;
    reasons.push(`Same path: ${mentor.career}`);
  } else if (mentee.career === "Not sure yet") {
    score += 10;
    reasons.push(`Can show you ${mentor.career}`);
  }

  const courses = sharedCourses(mentee.courses, mentor.courses);
  if (courses.length) {
    score += Math.min(30, courses.length * 10);
    reasons.push(`Knows your coursework: ${courses.slice(0, 2).join(", ")}`);
  }

  const a = keywords(mentee.goal);
  const b = keywords(`${mentor.goal} ${mentor.headline}`);
  const shared = [...a].filter((w) => b.has(w));
  if (shared.length) {
    score += Math.min(15, shared.length * 5);
    reasons.push(`Shared focus: ${shared.slice(0, 2).join(", ")}`);
  }

  if (
    mentee.availability === mentor.availability ||
    mentee.availability === "Flexible" ||
    mentor.availability === "Flexible"
  ) {
    score += 10;
    reasons.push(
      mentee.availability === mentor.availability
        ? `Both free ${mentor.availability.toLowerCase()}`
        : "Schedules line up",
    );
  }

  const onlineOk = mentee.format !== "In-person" && mentor.format !== "In-person";
  const sameArea =
    mentee.area === mentor.area && mentee.area !== "Online only" && mentee.format !== "Online" && mentor.format !== "Online";
  if (sameArea) {
    score += 5;
    reasons.push(`Both in ${mentor.area}`);
  } else if (onlineOk) {
    score += 5;
    reasons.push("Can meet online");
  }

  const open = mentor.capacity - mentorActivePairs;
  if (open > 0) {
    score += 10;
    reasons.push(`${open} open spot${open > 1 ? "s" : ""}`);
  }

  // Fun tiebreaker: shared interests outside tech (+5 each, up to 10).
  const mine = new Set(splitCourses(mentee.interests ?? "").map((x) => x.toLowerCase()));
  const fun = splitCourses(mentor.interests ?? "").filter((x) => mine.has(x.toLowerCase()));
  if (fun.length) {
    score += Math.min(10, fun.length * 5);
    reasons.push(`Both into ${fun.slice(0, 2).join(" and ").toLowerCase()}`);
  }

  if (mentor.no_degree && mentee.no_degree) reasons.push("Also started without a tech degree");

  return { mentor, score: clamp(score, 0, 100), reasons, courses };
}

// ---------- Opportunities (jobs, internships, mentorship programs) ----------

export const OPP_KINDS = ["Internship", "Job", "Mentorship program"];

export interface Opportunity {
  id: number;
  kind: string;
  title: string;
  org: string;
  career: string;
  courses: string; // required / preferred coursework, comma-separated
  area: string;
  format: string;
  description: string;
  link: string;
  deadline: string;
  created_at: string;
}

export interface OppMatch {
  opp: Opportunity;
  score: number;
  reasons: string[];
  courses: string[];
  missing: string[];
}

/**
 * Opportunity fit (0–100): 30 career path + up to 60 coursework coverage + 10 location/format.
 * Coursework coverage = share of the posting's listed courses the mentee has taken.
 */
export function oppScore(mentee: User, opp: Opportunity): OppMatch {
  let score = 0;
  const reasons: string[] = [];
  if (opp.career === mentee.career) {
    score += 30;
    reasons.push(`Your path: ${opp.career}`);
  }
  const wanted = splitCourses(opp.courses);
  const have = sharedCourses(opp.courses, mentee.courses);
  const missing = wanted.filter((c) => !have.includes(c));
  if (wanted.length) {
    score += Math.round((60 * have.length) / wanted.length);
    if (have.length) reasons.push(`You have ${have.length}/${wanted.length} courses`);
  } else {
    score += 30;
  }
  if (opp.format !== "In-person" || opp.area === mentee.area) {
    score += 10;
    reasons.push(opp.format === "In-person" ? `In ${opp.area}` : opp.format === "Online" ? "Remote" : `Hybrid · ${opp.area}`);
  }
  return { opp, score: clamp(score, 0, 100), reasons, courses: have, missing };
}

/** Curated course list per path: what TechWomenAZ mentors recommend, in a sensible order. */
export const COURSE_LIBRARY: Record<string, string[]> = {
  Software: ["Intro to Java", "JavaScript", "HTML and CSS", "Data Structures and Algorithms", "Databases", "Discrete Math", "Calculus I", "React"],
  "UX/Design": ["Intro to UX Design", "User Research Methods", "Figma Prototyping", "Human-Computer Interaction", "Typography", "Design Systems"],
  "Data/AI": ["Statistics", "SQL Databases", "Excel", "Python for Data Science", "Machine Learning", "Linear Algebra"],
  Product: ["Product Management", "Agile Project Management", "Business Analytics", "User Research Methods", "Marketing Strategy"],
  Cybersecurity: ["Computer Networking", "Network Security", "Linux Administration", "Ethical Hacking", "Incident Response"],
  "IT/Support": ["Computer Hardware", "Help Desk Fundamentals", "Windows Administration", "Computer Networking"],
  "Tech Sales & Marketing": ["Sales Fundamentals", "Digital Marketing", "Marketing Strategy", "Business Communication"],
  "Not sure yet": ["Intro to Computer Science", "Statistics", "Intro to UX Design", "Computer Networking", "JavaScript"],
};

/** Starter milestones per career path (AI replaces these when available). */
export function starterMilestones(career: string, goal: string): string[] {
  const byCareer: Record<string, string[]> = {
    Software: ["Pick one beginner project and set it up", "Ship the project to GitHub with a README", "Do one mock technical interview"],
    "UX/Design": ["Redesign one everyday app screen", "Publish a 2-case-study portfolio", "Get portfolio feedback and apply to 5 roles"],
    "Data/AI": ["Finish a SQL basics course", "Build one dashboard from a public dataset", "Write up what the data shows in a blog post"],
    Product: ["Write a one-page product brief", "Interview 3 users about a real problem", "Present a roadmap to your mentor"],
    Cybersecurity: ["Set up a home lab", "Complete 5 beginner CTF challenges", "Study for and book Security+"],
    "IT/Support": ["Build and troubleshoot a PC or VM", "Earn a help-desk certification", "Apply to 5 IT support roles"],
    "Tech Sales & Marketing": ["Learn one product deeply and pitch it", "Shadow a sales or marketing call", "Update LinkedIn for tech roles"],
  };
  return byCareer[career] ?? ["Explore 3 tech roles with your mentor", `Pick one first step toward: ${goal.slice(0, 60)}`, "Make a 90-day plan together"];
}
