// Decoding Bitcoin study cohort (formerly Mastering Bitcoin): sign-ups and "done" ticks, stored in Neon Postgres.
//
// No accounts. Signing up returns a private token that the browser keeps (and that the
// student can bookmark as a personal link); ticking "done" needs that token.
// Organisers manage the roster in the Neon console (tables mb_students / mb_done):
// set hidden = true on a row to take someone off the page.
//
// Setup: connect a Neon database to the Vercel project (Storage tab). Vercel then sets
// DATABASE_URL and the tables are created on first use.
//
//   GET  /api/mastering-bitcoin                      roster + done ticks (+ "me" with X-MB-Token)
//   POST /api/mastering-bitcoin {action:"signup", name, discord, email?}
//   POST /api/mastering-bitcoin {action:"done", token, item, done}
//
// Items: w<week>-q<n> (discussion question), w<week>-e<n> (exercise), w<week>-r1 (read the chapter).

const crypto = require("node:crypto");

const COHORT = "mb-2026";
const MAX_STUDENTS = 400;
const ITEM_RE = /^w(10|[1-9])-(q|e|r)([1-9]|1[0-9])$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{24}$/;
// Discord usernames: 2-32 lowercase letters, digits, "_" or "." (old-style name#1234 also accepted).
const DISCORD_RE = /^(?:[a-z0-9_.]{2,32}|[^@#:`]{2,32}#\d{4})$/;
// Anti-spam: sign-ups allowed per network (IP) per hour, and for the whole cohort per 10 minutes.
const SIGNUPS_PER_IP_HOUR = 8;
const SIGNUPS_PER_10_MIN = 40;

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

// Neon's HTTP query endpoint (the same one @neondatabase/serverless uses), so the site
// needs no npm dependencies or build step.
async function neon(body) {
  const url = new URL(connectionString);
  const endpoint = `https://${url.hostname.replace(/^[^.]+\./, "api.")}/sql`;
  const res = await fetch(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      "Content-Type": "application/json",
      "Neon-Connection-String": connectionString,
      "Neon-Raw-Text-Output": "true",
      "Neon-Array-Mode": "false",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Database error (${res.status})`);
    err.code = data.code;
    throw err;
  }
  return data;
}

const sql = async (query, params = []) => (await neon({ query, params })).rows;

let ready;
function ensureTables() {
  ready ||= neon({
    queries: [
      {
        query: `CREATE TABLE IF NOT EXISTS mb_students (
          id serial PRIMARY KEY,
          cohort text NOT NULL,
          name text NOT NULL,
          discord text NOT NULL,
          email text,
          token text NOT NULL UNIQUE,
          hidden boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now()
        )`,
        params: [],
      },
      { query: "CREATE UNIQUE INDEX IF NOT EXISTS mb_students_discord ON mb_students (cohort, lower(discord))", params: [] },
      { query: "ALTER TABLE mb_students ADD COLUMN IF NOT EXISTS ip_hash text", params: [] },
      {
        query: `CREATE TABLE IF NOT EXISTS mb_done (
          student_id integer NOT NULL REFERENCES mb_students(id) ON DELETE CASCADE,
          item text NOT NULL,
          done_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (student_id, item)
        )`,
        params: [],
      },
    ],
  }).catch((err) => {
    ready = undefined;
    throw err;
  });
  return ready;
}

const clean = (value, max) =>
  (typeof value === "string" ? value : "")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return {};
  }
}

async function roster(token) {
  // One round trip to the database for the whole page.
  const { results } = await neon({
    queries: [
      {
        query: "SELECT id, name, floor(extract(epoch FROM created_at) * 1000) AS joined FROM mb_students WHERE cohort = $1 AND NOT hidden ORDER BY created_at, id",
        params: [COHORT],
      },
      {
        query: "SELECT d.student_id, d.item FROM mb_done d JOIN mb_students s ON s.id = d.student_id WHERE s.cohort = $1 AND NOT s.hidden",
        params: [COHORT],
      },
      { query: "SELECT id, name, discord FROM mb_students WHERE cohort = $1 AND token = $2", params: [COHORT, token || ""] },
    ],
  });
  const [students, done, [row]] = results.map((r) => r.rows);
  const byStudent = new Map(students.map((s) => [s.id, []]));
  for (const row of done) byStudent.get(row.student_id)?.push(row.item);
  const me = token && row ? { id: Number(row.id), name: row.name, discord: row.discord } : null;
  return {
    students: students.map((s) => ({ id: Number(s.id), name: s.name, joined: Number(s.joined), done: byStudent.get(s.id) })),
    me,
  };
}

// Only a hash of the visitor's IP is kept, to rate-limit sign-ups.
function ipHash(req) {
  const ip = String(req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return crypto.createHash("sha256").update(`${COHORT}:${ip}`).digest("base64url").slice(0, 22);
}

async function signup(body, req) {
  if (body.website) return { status: 400, error: "Sign-up failed." }; // honeypot field
  const name = clean(body.name, 60);
  const discord = clean(body.discord, 40).replace(/^@/, "").toLowerCase();
  const email = clean(body.email, 120);
  if (name.length < 2) return { status: 400, error: "Please enter your name." };
  if (!DISCORD_RE.test(discord)) {
    return { status: 400, error: "Please enter your Discord username (letters, numbers, _ and . only, like satoshi_n)." };
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { status: 400, error: "That email doesn't look right." };
  const ip = ipHash(req);
  const token = crypto.randomBytes(18).toString("base64url");
  const limits = `SELECT count(*) AS total,
         count(*) FILTER (WHERE ip_hash = $2 AND created_at > now() - interval '1 hour') AS mine,
         count(*) FILTER (WHERE created_at > now() - interval '10 minutes') AS recent
    FROM mb_students WHERE cohort = $1`;
  let results;
  try {
    // One transaction: a lock so simultaneous sign-ups are checked one at a time,
    // the current counts, then the insert, which only happens if the limits allow it.
    ({ results } = await neon({
      queries: [
        { query: "SELECT pg_advisory_xact_lock(hashtext('mb_students_signup'))::text AS locked", params: [] },
        { query: limits, params: [COHORT, ip] },
        {
          query: `INSERT INTO mb_students (cohort, name, discord, email, token, ip_hash)
                  SELECT $1, $2, $3, $4, $5, $6 FROM (${limits.replace("$2", "$6")}) c
                   WHERE c.total < ${MAX_STUDENTS} AND c.mine < ${SIGNUPS_PER_IP_HOUR} AND c.recent < ${SIGNUPS_PER_10_MIN}
                  RETURNING id`,
          params: [COHORT, name, discord, email || null, token, ip],
        },
      ],
    }));
  } catch (err) {
    if (err.code === "23505") {
      return { status: 409, error: "That Discord username is already signed up. Lost your personal link? Ask the organiser in Discord." };
    }
    throw err;
  }
  const [{ total }] = results[1].rows;
  const [row] = results[2].rows;
  if (!row) {
    return Number(total) >= MAX_STUDENTS
      ? { status: 409, error: "The cohort is full. Ask in Discord about the next one." }
      : { status: 429, error: "Lots of sign-ups right now. Please try again in a little while." };
  }
  return { status: 200, data: { ok: true, token, me: { id: Number(row.id), name, discord } } };
}

async function tick(body) {
  const token = clean(body.token, 64);
  const item = clean(body.item, 12);
  if (!token) return { status: 401, error: "Sign up first, then you can tick things off." };
  if (!TOKEN_RE.test(token)) return { status: 401, error: "Your personal link isn't recognised. Ask the organiser in Discord." };
  if (!ITEM_RE.test(item)) return { status: 400, error: "Unknown item." };
  if (typeof body.done !== "boolean") return { status: 400, error: "Unknown action." };
  const [me] = await sql("SELECT id FROM mb_students WHERE cohort = $1 AND token = $2 AND NOT hidden", [COHORT, token]);
  if (!me) return { status: 401, error: "Your personal link isn't recognised. Ask the organiser in Discord." };
  if (body.done === false) {
    await sql("DELETE FROM mb_done WHERE student_id = $1 AND item = $2", [me.id, item]);
  } else {
    await sql("INSERT INTO mb_done (student_id, item) VALUES ($1, $2) ON CONFLICT DO NOTHING", [me.id, item]);
  }
  return { status: 200, data: { ok: true } };
}

// Browsers send Origin on POST; refuse requests made from other websites.
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!connectionString) {
    return res.status(503).json({ error: "Sign-ups open soon.", setup: true });
  }
  try {
    await ensureTables();
    if (req.method === "GET") {
      const token = clean(req.headers["x-mb-token"], 64);
      return res.status(200).json(await roster(TOKEN_RE.test(token) ? token : ""));
    }
    if (req.method === "POST") {
      if (!sameOrigin(req)) return res.status(403).json({ error: "Please sign up from codeorange.dev." });
      const body = readBody(req);
      const result =
        body.action === "signup" ? await signup(body, req) : body.action === "done" ? await tick(body) : { status: 400, error: "Unknown action." };
      return res.status(result.status).json(result.error ? { error: result.error } : result.data);
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error("mastering-bitcoin api:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again in a minute." });
  }
};
