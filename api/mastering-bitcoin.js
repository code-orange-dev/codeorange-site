// Mastering Bitcoin study cohort: sign-ups and "done" ticks, stored in Neon Postgres.
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

const crypto = require("node:crypto");

const COHORT = "mb-2026";
const MAX_STUDENTS = 400;
const ITEM_RE = /^w(10|[1-9])-(q|e)([1-9]|1[0-9])$/;

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

// Neon's HTTP query endpoint (the same one @neondatabase/serverless uses), so the site
// needs no npm dependencies or build step.
async function neon(body) {
  const url = new URL(connectionString);
  const endpoint = `https://${url.hostname.replace(/^[^.]+\./, "api.")}/sql`;
  const res = await fetch(endpoint, {
    method: "POST",
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
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
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
  const students = await sql(
    "SELECT id, name, created_at FROM mb_students WHERE cohort = $1 AND NOT hidden ORDER BY created_at, id",
    [COHORT]
  );
  const done = await sql(
    "SELECT d.student_id, d.item FROM mb_done d JOIN mb_students s ON s.id = d.student_id WHERE s.cohort = $1 AND NOT s.hidden",
    [COHORT]
  );
  const byStudent = new Map(students.map((s) => [s.id, []]));
  for (const row of done) byStudent.get(row.student_id)?.push(row.item);
  let me = null;
  if (token) {
    const [row] = await sql("SELECT id, name, discord FROM mb_students WHERE cohort = $1 AND token = $2", [COHORT, token]);
    if (row) me = { id: Number(row.id), name: row.name, discord: row.discord };
  }
  return {
    students: students.map((s) => ({ id: Number(s.id), name: s.name, done: byStudent.get(s.id) })),
    me,
  };
}

async function signup(body) {
  if (body.website) return { status: 400, error: "Sign-up failed." }; // honeypot field
  const name = clean(body.name, 60);
  const discord = clean(body.discord, 40).replace(/^@/, "");
  const email = clean(body.email, 120);
  if (name.length < 2) return { status: 400, error: "Please enter your name." };
  if (discord.length < 2) return { status: 400, error: "Please enter your Discord username." };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { status: 400, error: "That email doesn't look right." };
  const [{ count }] = await sql("SELECT count(*) AS count FROM mb_students WHERE cohort = $1", [COHORT]);
  if (Number(count) >= MAX_STUDENTS) return { status: 409, error: "The cohort is full. Ask in Discord about the next one." };
  const token = crypto.randomBytes(18).toString("base64url");
  try {
    const [row] = await sql(
      "INSERT INTO mb_students (cohort, name, discord, email, token) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [COHORT, name, discord, email || null, token]
    );
    return { status: 200, data: { ok: true, token, me: { id: Number(row.id), name, discord } } };
  } catch (err) {
    if (err.code === "23505") {
      return { status: 409, error: "That Discord username is already signed up. Lost your personal link? Ask the organiser in Discord." };
    }
    throw err;
  }
}

async function tick(body) {
  const token = clean(body.token, 64);
  const item = clean(body.item, 12);
  if (!token) return { status: 401, error: "Sign up first, then you can tick things off." };
  if (!ITEM_RE.test(item)) return { status: 400, error: "Unknown item." };
  const [me] = await sql("SELECT id FROM mb_students WHERE cohort = $1 AND token = $2 AND NOT hidden", [COHORT, token]);
  if (!me) return { status: 401, error: "Your personal link isn't recognised. Ask the organiser in Discord." };
  if (body.done === false) {
    await sql("DELETE FROM mb_done WHERE student_id = $1 AND item = $2", [me.id, item]);
  } else {
    await sql("INSERT INTO mb_done (student_id, item) VALUES ($1, $2) ON CONFLICT DO NOTHING", [me.id, item]);
  }
  return { status: 200, data: { ok: true } };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!connectionString) {
    return res.status(503).json({ error: "Sign-ups open soon.", setup: true });
  }
  try {
    await ensureTables();
    if (req.method === "GET") {
      return res.status(200).json(await roster(clean(req.headers["x-mb-token"], 64)));
    }
    if (req.method === "POST") {
      const body = readBody(req);
      const result =
        body.action === "signup" ? await signup(body) : body.action === "done" ? await tick(body) : { status: 400, error: "Unknown action." };
      return res.status(result.status).json(result.error ? { error: result.error } : result.data);
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error("mastering-bitcoin api:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again in a minute." });
  }
};
