// Decoding Bitcoin study cohort (formerly Mastering Bitcoin): sign-ups and "done" ticks, stored in Neon Postgres.
//
// No passwords. Signing up returns a private token that the browser keeps (and that the
// student can bookmark as a personal link); ticking "done" needs that token. Students can
// also sign up and sign back in with Nostr (see _lib/nostr.js).
// The class list (names, progress, who owns which question) is shown to signed-in students
// only, until ROSTER_PUBLIC is set to true. Organisers see everyone (with emails) at
// /decoding-bitcoin/admin, using the admin key, and can hide people there.
// Welcome emails, "email me my link" and the MailerLite sync are in _lib/mail.js.
//
// Setup: connect a Neon database to the Vercel project (Storage tab). Vercel then sets
// DATABASE_URL and the tables are created on first use.
//
//   GET  /api/mastering-bitcoin                      roster + done ticks (+ "me" with X-MB-Token)
//   GET  /api/mastering-bitcoin?admin=1              everyone, with emails (X-MB-Admin: key)
//   POST /api/mastering-bitcoin {action:"signup", email, discord, name?, nostr?}
//   POST /api/mastering-bitcoin {action:"email-link", email}  email the personal link
//   POST /api/mastering-bitcoin {action:"nostr", event}  sign in with a signed Nostr event
//   POST /api/mastering-bitcoin {action:"done", token, item, done}
//   POST /api/mastering-bitcoin {action:"admin-hide", id, hidden}  (X-MB-Admin: key)
//   POST /api/mastering-bitcoin {action:"admin-mailerlite"}  add everyone to MailerLite (X-MB-Admin: key)
//
// Items: w<week>-q<n> (discussion question), w<week>-e<n> (exercise), w<week>-r1 (read the chapter).

const crypto = require("node:crypto");

const { verifyAuthEvent } = require("./_lib/nostr.js");
const mail = require("./_lib/mail.js");

const COHORT = "mb-2026";
// Show the class list (names and progress) to everyone, not just signed-in students.
const ROSTER_PUBLIC = false;
// SHA-256 of the organisers' admin key (MB_ADMIN_KEY in Vercel's environment overrides it).
const ADMIN_KEY_SHA256 = "72309790bc2a39b6f7cf37ca3d2dd89bfa87ed8fd6061a4fad74e331969bc48d";
const MAX_STUDENTS = 400;
const ITEM_RE = /^w(10|[1-9])-(q|e|r)([1-9]|1[0-9])$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{24}$/;
// Discord usernames: 2-32 lowercase letters, digits, "_" or "." (old-style name#1234 also accepted).
const DISCORD_RE = /^(?:[a-z0-9_.]{2,32}|[^@#:`]{2,32}#\d{4})$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
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
    err.constraint = data.constraint || "";
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
      // Discord became optional and Nostr sign-in was added (October 2026).
      { query: "ALTER TABLE mb_students ALTER COLUMN discord DROP NOT NULL", params: [] },
      { query: "ALTER TABLE mb_students ADD COLUMN IF NOT EXISTS nostr text", params: [] },
      { query: "CREATE UNIQUE INDEX IF NOT EXISTS mb_students_nostr ON mb_students (cohort, nostr) WHERE nostr IS NOT NULL", params: [] },
      { query: "ALTER TABLE mb_students ADD COLUMN IF NOT EXISTS link_sent_at timestamptz", params: [] },
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
  })
    // One sign-up per email from now on. Kept separate so that older duplicate emails
    // (from when email was optional) can't stop the page from working.
    .then(() =>
      sql("CREATE UNIQUE INDEX IF NOT EXISTS mb_students_email ON mb_students (cohort, lower(email)) WHERE email IS NOT NULL").catch((err) =>
        console.error("mastering-bitcoin api: email index not created:", err.message)
      )
    )
    .catch((err) => {
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
  // One round trip to the database for the whole page. Visitors who aren't signed in get
  // no class list unless it's public.
  const visible = `NOT s.hidden AND (${ROSTER_PUBLIC} OR EXISTS (SELECT 1 FROM mb_students m WHERE m.cohort = $1 AND m.token = $2 AND NOT m.hidden))`;
  const params = [COHORT, token || ""];
  const { results } = await neon({
    queries: [
      {
        query: `SELECT s.id, s.name, floor(extract(epoch FROM s.created_at) * 1000) AS joined FROM mb_students s WHERE s.cohort = $1 AND ${visible} ORDER BY s.created_at, s.id`,
        params,
      },
      {
        query: `SELECT d.student_id, d.item FROM mb_done d JOIN mb_students s ON s.id = d.student_id WHERE s.cohort = $1 AND ${visible}`,
        params,
      },
      { query: "SELECT id, name, discord FROM mb_students WHERE cohort = $1 AND token = $2", params: [COHORT, token || ""] },
    ],
  });
  const [students, done, [row]] = results.map((r) => r.rows);
  const byStudent = new Map(students.map((s) => [s.id, []]));
  for (const row of done) byStudent.get(row.student_id)?.push(row.item);
  const me = token && row ? { id: Number(row.id), name: row.name, discord: row.discord } : null;
  return {
    rosterVisible: ROSTER_PUBLIC || students.length > 0,
    emailLinks: mail.emailOn(),
    students: students.map((s) => ({ id: Number(s.id), name: s.name, joined: Number(s.joined), done: byStudent.get(s.id) })),
    me,
  };
}

// The URL a Nostr sign-in event must be signed for.
const apiUrl = (req) => `${req.headers["x-forwarded-proto"] === "http" ? "http" : "https"}://${req.headers.host}/api/mastering-bitcoin`;

// Sign in with Nostr: returns the student's token if this key has signed up before.
async function nostrSignIn(body, req) {
  const pubkey = verifyAuthEvent(body.event, apiUrl(req));
  if (!pubkey) return { status: 401, error: "Nostr sign-in didn't work. Check your device's clock and try again." };
  const [row] = await sql("SELECT id, name, discord, token FROM mb_students WHERE cohort = $1 AND nostr = $2 AND NOT hidden", [COHORT, pubkey]);
  if (!row) return { status: 200, data: { ok: true, known: false, pubkey } };
  return { status: 200, data: { ok: true, known: true, token: row.token, me: { id: Number(row.id), name: row.name, discord: row.discord } } };
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
  const email = clean(body.email, 120).toLowerCase();
  let nostr = "";
  if (body.nostr) {
    nostr = verifyAuthEvent(body.nostr, apiUrl(req));
    if (!nostr) return { status: 401, error: "Nostr sign-in didn't work. Check your device's clock and try again." };
  }
  if (!EMAIL_RE.test(email)) return { status: 400, error: email ? "That email doesn't look right." : "Please enter your email." };
  if (!DISCORD_RE.test(discord)) {
    return { status: 400, error: discord ? "That Discord username doesn't look right (letters, numbers, _ and . only, like satoshi_n)." : "Please enter your Discord username." };
  }
  // The name is optional: the Discord username stands in for it.
  const shown = name.length >= 2 ? name : discord;
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
          query: `INSERT INTO mb_students (cohort, name, discord, email, token, ip_hash, nostr)
                  SELECT $1, $2, $3, $4, $5, $6, $7 FROM (${limits.replace("$2", "$6")}) c
                   WHERE c.total < ${MAX_STUDENTS} AND c.mine < ${SIGNUPS_PER_IP_HOUR} AND c.recent < ${SIGNUPS_PER_10_MIN}
                  RETURNING id`,
          params: [COHORT, shown, discord, email, token, ip, nostr || null],
        },
      ],
    }));
  } catch (err) {
    if (err.code === "23505") {
      const what = /email/.test(err.constraint + err.message) ? "email" : /nostr/.test(err.constraint + err.message) ? "Nostr key" : "Discord username";
      const lost = mail.emailOn() ? 'Use "Email me my link" below.' : "Ask the organiser in Discord.";
      return { status: 409, error: `That ${what} is already signed up. Lost your personal link? ${lost}` };
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
  // Welcome email and MailerLite, when their keys are set. A failure here never undoes the sign-up.
  const student = { email, name: shown, token };
  const jobs = [mail.emailOn() && mail.sendWelcome(student), mail.mailerliteOn() && mail.addToMailerLite(student)].filter(Boolean);
  for (const r of await Promise.allSettled(jobs)) if (r.status === "rejected") console.error("mastering-bitcoin api: after sign-up:", r.reason?.message);
  return { status: 200, data: { ok: true, token, me: { id: Number(row.id), name: shown, discord }, emailed: mail.emailOn() } };
}

// "Email me my link": the same answer whether or not the email is signed up, and at most
// one email per person every 5 minutes.
async function emailLink(body) {
  if (!mail.emailOn()) return { status: 503, error: "Emailing links isn't switched on yet. Ask the organiser in Discord." };
  const email = clean(body.email, 120).toLowerCase();
  if (!EMAIL_RE.test(email)) return { status: 400, error: "That email doesn't look right." };
  const [row] = await sql(
    `UPDATE mb_students SET link_sent_at = now()
      WHERE cohort = $1 AND lower(email) = $2 AND NOT hidden AND (link_sent_at IS NULL OR link_sent_at < now() - interval '5 minutes')
      RETURNING name, token`,
    [COHORT, email]
  );
  if (row) await mail.sendLink({ email, name: row.name, token: row.token });
  return { status: 200, data: { ok: true } };
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

function isAdmin(req) {
  const key = String(req.headers["x-mb-admin"] || "");
  if (!key) return false;
  const hash = (v) => crypto.createHash("sha256").update(v).digest();
  const expected = process.env.MB_ADMIN_KEY ? hash(process.env.MB_ADMIN_KEY) : Buffer.from(ADMIN_KEY_SHA256, "hex");
  return crypto.timingSafeEqual(hash(key), expected);
}

async function adminList() {
  const { results } = await neon({
    queries: [
      {
        query: `SELECT id, name, email, discord, nostr, hidden, created_at FROM mb_students WHERE cohort = $1 ORDER BY created_at, id`,
        params: [COHORT],
      },
      { query: "SELECT d.student_id, count(*) AS n FROM mb_done d JOIN mb_students s ON s.id = d.student_id WHERE s.cohort = $1 GROUP BY 1", params: [COHORT] },
    ],
  });
  const [students, done] = results.map((r) => r.rows);
  const ticks = new Map(done.map((d) => [d.student_id, Number(d.n)]));
  return {
    rosterPublic: ROSTER_PUBLIC,
    email: mail.emailOn(),
    mailerlite: mail.mailerliteOn(),
    max: MAX_STUDENTS,
    students: students.map((s) => ({
      id: Number(s.id),
      name: s.name,
      email: s.email,
      discord: s.discord,
      nostr: s.nostr,
      hidden: s.hidden === "t" || s.hidden === true || s.hidden === "true",
      joined: s.created_at,
      ticks: ticks.get(s.id) || 0,
    })),
  };
}

async function adminHide(body) {
  const id = Number(body.id);
  if (!Number.isInteger(id) || typeof body.hidden !== "boolean") return { status: 400, error: "Unknown student." };
  const rows = await sql("UPDATE mb_students SET hidden = $3 WHERE cohort = $1 AND id = $2 RETURNING id", [COHORT, id, body.hidden]);
  return rows.length ? { status: 200, data: { ok: true } } : { status: 404, error: "Unknown student." };
}

async function selfTest(q) {
  const out = { email: mail.emailOn(), mailerlite: mail.mailerliteOn() };
  const to = clean(q.to, 120).toLowerCase();
  if (out.email && EMAIL_RE.test(to)) {
    try {
      await mail.sendWelcome({ email: to, name: "test", token: "selftest-not-a-real-link" });
      out.emailResult = "sent";
    } catch (err) {
      out.emailResult = err.message;
    }
  }
  if (out.mailerlite) {
    try {
      out.mailerliteResult = q.sync ? (await adminMailerLite()).data : "connected (group ready)";
      if (!q.sync) await mail.syncMailerLite([]);
    } catch (err) {
      out.mailerliteResult = err.message;
    }
  }
  return out;
}

async function adminMailerLite() {
  if (!mail.mailerliteOn()) return { status: 503, error: "Add MAILERLITE_API_KEY in Vercel first." };
  const rows = await sql("SELECT name, email FROM mb_students WHERE cohort = $1 AND NOT hidden AND email IS NOT NULL ORDER BY id", [COHORT]);
  return { status: 200, data: { ok: true, added: await mail.syncMailerLite(rows), total: rows.length } };
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
    // Organiser self-test: GET ?selftest=<admin key>&to=<email>[&sync=1] sends a test welcome
    // email and checks MailerLite (sync=1 also adds everyone to the group).
    if (req.method === "GET" && req.query?.selftest !== undefined) {
      req.headers["x-mb-admin"] = String(req.query.selftest);
      if (!isAdmin(req)) return res.status(401).json({ error: "Wrong admin key." });
      return res.status(200).json(await selfTest(req.query));
    }
    if (req.method === "GET" && req.query?.admin !== undefined) {
      if (!isAdmin(req)) return res.status(401).json({ error: "Wrong admin key." });
      return res.status(200).json(await adminList());
    }
    if (req.method === "GET") {
      const token = clean(req.headers["x-mb-token"], 64);
      return res.status(200).json(await roster(TOKEN_RE.test(token) ? token : ""));
    }
    if (req.method === "POST") {
      if (!sameOrigin(req)) return res.status(403).json({ error: "Please sign up from codeorange.dev." });
      const body = readBody(req);
      const actions = {
        signup: () => signup(body, req),
        nostr: () => nostrSignIn(body, req),
        done: () => tick(body),
        "email-link": () => emailLink(body),
        "admin-hide": () => (isAdmin(req) ? adminHide(body) : { status: 401, error: "Wrong admin key." }),
        "admin-mailerlite": () => (isAdmin(req) ? adminMailerLite() : { status: 401, error: "Wrong admin key." }),
      };
      const result = Object.hasOwn(actions, body.action) ? await actions[body.action]() : { status: 400, error: "Unknown action." };
      return res.status(result.status).json(result.error ? { error: result.error } : result.data);
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error("mastering-bitcoin api:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again in a minute." });
  }
};
