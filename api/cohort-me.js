// Decoding Bitcoin personal dashboard (/decoding-bitcoin/me): weekly check-ins, goals,
// skill map, study buddies and alumni follow-ups. Sign-ups and "done" ticks stay in
// mastering-bitcoin.js; this file only adds to the same Neon database.
//
// Check-ins are private: a student sees their own, organisers see everyone's.
//
//   GET  /api/cohort-me                       my dashboard (X-MB-Token: token)
//   GET  /api/cohort-me?admin=1               everyone, with risk flags and class pulse (X-MB-Admin: key)
//   GET  /api/cohort-me?report=<key>          the same without emails, for the weekly report
//   GET  /api/cohort-me?report=<key>&send-followup=3   email the 3/6/12-month follow-up (once, after it's due)
//   POST /api/cohort-me {action:"checkin", token, week, confidence, hours, clicked, blocked, help}
//   POST /api/cohort-me {action:"profile", token, why, build, experience, goal, skillsStart, skillsEnd}
//   POST /api/cohort-me {action:"followup", token, months, answer}
//   POST /api/cohort-me {action:"admin-followup", months}   (X-MB-Admin: key)

const crypto = require("node:crypto");
const mail = require("./_lib/mail.js");

const COHORT = "mb-2026";
// Same admin key as mastering-bitcoin.js (MB_ADMIN_KEY overrides it).
const ADMIN_KEY_SHA256 = "72309790bc2a39b6f7cf37ca3d2dd89bfa87ed8fd6061a4fad74e331969bc48d";
// Read-only key for the weekly report (no emails in what it returns). MB_REPORT_KEY overrides it.
const REPORT_KEY_SHA256 = "78bc5926a6f1adbd8ba91bdfd32734e40e290058d248fbe5f054794ccbcc0f34";
// Keep in step with assets/mastering-bitcoin/cohort.js.
const FIRST_SESSION = Date.parse("2026-11-16T11:00:00Z");
const LAST_SESSION = Date.parse("2027-01-18T11:00:00Z");
const WEEKS = 10;
// Buddies are paired from a week before the first session.
const PAIR_FROM = FIRST_SESSION - 7 * 864e5;
const FOLLOWUP_MONTHS = [3, 6, 12];
const SKILLS = ["utxo", "structure", "fees", "signing", "script", "p2sh", "taproot", "build"];
const ALERT_TO = process.env.MB_ALERT_EMAIL || "codeorangedevs@gmail.com";
const TOKEN_RE = /^[A-Za-z0-9_-]{24}$/;

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

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
  if (!res.ok) throw new Error(data.message || `Database error (${res.status})`);
  return data;
}

const sql = async (query, params = []) => (await neon({ query, params })).rows;
const q = (query, params = []) => ({ query, params });

let ready;
function ensureTables() {
  ready ||= neon({
    queries: [
      q(`CREATE TABLE IF NOT EXISTS mb_checkins (
        student_id integer NOT NULL REFERENCES mb_students(id) ON DELETE CASCADE,
        week integer NOT NULL,
        confidence integer,
        hours numeric,
        clicked text,
        blocked text,
        help boolean NOT NULL DEFAULT false,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (student_id, week)
      )`),
      q(`CREATE TABLE IF NOT EXISTS mb_profile (
        student_id integer PRIMARY KEY REFERENCES mb_students(id) ON DELETE CASCADE,
        why text,
        build text,
        experience text,
        goal text,
        skills_start jsonb,
        skills_end jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`),
      q(`CREATE TABLE IF NOT EXISTS mb_buddies (
        student_id integer PRIMARY KEY REFERENCES mb_students(id) ON DELETE CASCADE,
        buddy_id integer NOT NULL REFERENCES mb_students(id) ON DELETE CASCADE,
        paired_at timestamptz NOT NULL DEFAULT now()
      )`),
      q(`CREATE TABLE IF NOT EXISTS mb_followups (
        student_id integer NOT NULL REFERENCES mb_students(id) ON DELETE CASCADE,
        months integer NOT NULL,
        answer jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (student_id, months)
      )`),
      q(`CREATE TABLE IF NOT EXISTS mb_followup_sends (
        cohort text NOT NULL,
        months integer NOT NULL,
        sent integer NOT NULL DEFAULT 0,
        sent_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (cohort, months)
      )`),
    ],
  }).catch((err) => {
    ready = undefined;
    throw err;
  });
  return ready;
}

const clean = (value, max) =>
  (typeof value === "string" ? value : "")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿<>]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
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

// Neon's text output gives timestamps like "2026-10-16 03:00:00.12+00"; make them ISO.
const iso = (v) => (v ? new Date(String(v).replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")).toISOString() : null);
const bool = (v) => v === true || v === "t" || v === "true";
const int = (v, lo, hi) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};
const skills = (v) => {
  if (!v || typeof v !== "object") return null;
  const out = {};
  for (const k of SKILLS) {
    const n = int(v[k], 0, 4);
    if (n !== null) out[k] = n;
  }
  return Object.keys(out).length ? out : null;
};
const parseJson = (v) => {
  if (v == null) return null;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

// The cohort week a date falls in (1-10), 0 before it starts. A week runs from the day after
// the previous session to the day after its own, like the main page.
function weekAt(t = Date.now()) {
  if (t < PAIR_FROM) return 0;
  let w = 1;
  while (w < WEEKS && t > FIRST_SESSION + (w - 1) * 7 * 864e5 + 864e5) w++;
  return w;
}

async function student(token) {
  if (!TOKEN_RE.test(token || "")) return null;
  const [row] = await sql("SELECT id, name, discord, email, created_at FROM mb_students WHERE cohort = $1 AND token = $2 AND NOT hidden", [COHORT, token]);
  return row ? { ...row, id: Number(row.id) } : null;
}

// Pairs the student with the longest-waiting unpaired classmate. Only people who open their
// dashboard get paired, so buddies are both active. Pairs with someone who's since been hidden are undone.
async function pairBuddy(me) {
  if (Date.now() < PAIR_FROM) return;
  await neon({
    queries: [
      q("SELECT pg_advisory_xact_lock(hashtext('mb_buddies_pair'))::text AS locked"),
      q(`DELETE FROM mb_buddies b USING mb_students s
          WHERE s.hidden AND (s.id = b.buddy_id OR s.id = b.student_id) AND (b.student_id = $1 OR b.buddy_id = $1)`, [me.id]),
      q(`DELETE FROM mb_buddies b WHERE b.student_id = $1 AND NOT EXISTS (SELECT 1 FROM mb_buddies r WHERE r.student_id = b.buddy_id)`, [me.id]),
      q(`WITH mine AS (SELECT $1::int AS id WHERE NOT EXISTS (SELECT 1 FROM mb_buddies WHERE student_id = $1)),
              mate AS (SELECT s.id FROM mb_students s, mine
                        WHERE s.cohort = $2 AND NOT s.hidden AND s.id <> mine.id
                          AND NOT EXISTS (SELECT 1 FROM mb_buddies b WHERE b.student_id = s.id)
                          AND (EXISTS (SELECT 1 FROM mb_checkins c WHERE c.student_id = s.id)
                               OR EXISTS (SELECT 1 FROM mb_profile p WHERE p.student_id = s.id)
                               OR EXISTS (SELECT 1 FROM mb_done d WHERE d.student_id = s.id))
                        ORDER BY s.created_at, s.id LIMIT 1)
         INSERT INTO mb_buddies (student_id, buddy_id)
         SELECT mine.id, mate.id FROM mine, mate UNION ALL SELECT mate.id, mine.id FROM mine, mate
         ON CONFLICT DO NOTHING`, [me.id, COHORT]),
    ],
  });
}

async function dashboard(token) {
  const me = await student(token);
  if (!me) return { status: 401, error: "Your personal link isn't recognised. Open the link from your welcome email." };
  await pairBuddy(me).catch((err) => console.error("cohort-me: pairing:", err.message));
  const { results } = await neon({
    queries: [
      q("SELECT week, confidence, hours, clicked, blocked, help, updated_at FROM mb_checkins WHERE student_id = $1 ORDER BY week", [me.id]),
      q("SELECT why, build, experience, goal, skills_start, skills_end FROM mb_profile WHERE student_id = $1", [me.id]),
      q(`SELECT s.name, s.discord, (SELECT max(week) FROM mb_checkins c WHERE c.student_id = s.id) AS last_week
           FROM mb_buddies b JOIN mb_students s ON s.id = b.buddy_id WHERE b.student_id = $1 AND NOT s.hidden`, [me.id]),
      q("SELECT months, answer FROM mb_followups WHERE student_id = $1", [me.id]),
      q("SELECT item, done_at FROM mb_done WHERE student_id = $1", [me.id]),
    ],
  });
  const [checkins, [profile], [buddy], followups, done] = results.map((r) => r.rows);
  return {
    status: 200,
    data: {
      me: { id: me.id, name: me.name, discord: me.discord, joined: iso(me.created_at) },
      week: weekAt(),
      checkins: checkins.map((c) => ({ week: Number(c.week), confidence: c.confidence == null ? null : Number(c.confidence), hours: c.hours == null ? null : Number(c.hours), clicked: c.clicked || "", blocked: c.blocked || "", help: bool(c.help), at: iso(c.updated_at) })),
      profile: profile
        ? { why: profile.why || "", build: profile.build || "", experience: profile.experience || "", goal: profile.goal || "", skillsStart: parseJson(profile.skills_start), skillsEnd: parseJson(profile.skills_end) }
        : null,
      buddy: buddy ? { name: buddy.name, discord: buddy.discord, lastWeek: buddy.last_week == null ? 0 : Number(buddy.last_week) } : null,
      buddyFrom: new Date(PAIR_FROM).toISOString(),
      followups: Object.fromEntries(followups.map((f) => [f.months, parseJson(f.answer)])),
      done: done.map((d) => ({ item: d.item, at: iso(d.done_at) })),
    },
  };
}

async function checkin(body) {
  const me = await student(clean(body.token, 64));
  if (!me) return { status: 401, error: "Your personal link isn't recognised. Open the link from your welcome email." };
  const week = int(body.week, 1, WEEKS);
  if (!week) return { status: 400, error: "Unknown week." };
  if (week > Math.max(1, weekAt())) return { status: 400, error: "That week hasn't started yet." };
  const confidence = int(body.confidence, 1, 5);
  const hours = Number.isFinite(Number(body.hours)) && body.hours !== "" && body.hours != null ? Math.min(80, Math.max(0, Math.round(Number(body.hours) * 2) / 2)) : null;
  const clicked = clean(body.clicked, 1000);
  const blocked = clean(body.blocked, 1000);
  const help = body.help === true;
  if (!confidence && hours === null && !clicked && !blocked && !help) return { status: 400, error: "Fill in at least one thing." };
  const [row] = await sql(
    `WITH old AS (SELECT help FROM mb_checkins WHERE student_id = $1 AND week = $2)
     INSERT INTO mb_checkins (student_id, week, confidence, hours, clicked, blocked, help)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (student_id, week) DO UPDATE SET confidence = $3, hours = $4, clicked = $5, blocked = $6, help = $7, updated_at = now()
     RETURNING (SELECT help FROM old) AS was_help`,
    [me.id, week, confidence, hours, clicked, blocked, help]
  );
  // "I'd like some help": tell the organisers once, when it's first asked.
  if (help && !bool(row?.was_help) && mail.emailOn()) {
    await mail
      .sendTo(ALERT_TO, `${me.name} would like some help (Decoding Bitcoin, week ${week})`, [
        `<strong>${mail.esc(me.name)}</strong> ticked "I'd like some help" in their week ${week} check-in.`,
        `<ul style="padding-left:20px"><li>Discord: ${mail.esc(me.discord || "not given")}</li><li>Email: ${mail.esc(me.email || "not given")}</li><li>Confidence: ${confidence ? `${confidence}/5` : "not given"}</li><li>Stuck on: ${mail.esc(blocked || "not said")}</li></ul>`,
        `A quick DM on Discord usually does it. All check-ins are on the <a href="https://codeorange.dev/decoding-bitcoin/admin" style="color:#d97706">organiser page</a>.`,
      ], me.email)
      .catch((err) => console.error("cohort-me: help alert:", err.message));
  }
  return { status: 200, data: { ok: true } };
}

async function profile(body) {
  const me = await student(clean(body.token, 64));
  if (!me) return { status: 401, error: "Your personal link isn't recognised. Open the link from your welcome email." };
  const fields = {
    why: clean(body.why, 1000),
    build: clean(body.build, 1000),
    experience: ["new", "some", "dev", "bitcoin-dev"].includes(body.experience) ? body.experience : "",
    goal: clean(body.goal, 1000),
  };
  const start = skills(body.skillsStart);
  const end = skills(body.skillsEnd);
  await sql(
    `INSERT INTO mb_profile (student_id, why, build, experience, goal, skills_start, skills_end)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
     ON CONFLICT (student_id) DO UPDATE SET why = $2, build = $3, experience = $4, goal = $5,
       skills_start = COALESCE($6::jsonb, mb_profile.skills_start), skills_end = COALESCE($7::jsonb, mb_profile.skills_end), updated_at = now()`,
    [me.id, fields.why, fields.build, fields.experience, fields.goal, start && JSON.stringify(start), end && JSON.stringify(end)]
  );
  return { status: 200, data: { ok: true } };
}

const FOLLOWUP_FIELDS = { status: 40, doing: 1000, contributions: 1000, links: 600, wish: 1000, quote: 600 };
async function followup(body) {
  const me = await student(clean(body.token, 64));
  if (!me) return { status: 401, error: "Your personal link isn't recognised. Open the link from your email." };
  const months = Number(body.months);
  if (!FOLLOWUP_MONTHS.includes(months)) return { status: 400, error: "Unknown follow-up." };
  const a = body.answer && typeof body.answer === "object" ? body.answer : {};
  const answer = Object.fromEntries(Object.entries(FOLLOWUP_FIELDS).map(([k, max]) => [k, clean(a[k], max)]));
  answer.share = a.share === true;
  await sql(
    `INSERT INTO mb_followups (student_id, months, answer) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (student_id, months) DO UPDATE SET answer = $3::jsonb, updated_at = now()`,
    [me.id, months, JSON.stringify(answer)]
  );
  return { status: 200, data: { ok: true } };
}

// ── Organisers ──
const sha = (v) => crypto.createHash("sha256").update(v).digest();
function keyMatches(key, envKey, fallbackHex) {
  if (!key) return false;
  const expected = envKey ? sha(envKey) : Buffer.from(fallbackHex, "hex");
  return crypto.timingSafeEqual(sha(key), expected);
}
const isAdmin = (req) => keyMatches(String(req.headers["x-mb-admin"] || ""), process.env.MB_ADMIN_KEY, ADMIN_KEY_SHA256);
const isReport = (req) => keyMatches(String(req.query?.report || req.headers["x-mb-report"] || ""), process.env.MB_REPORT_KEY, REPORT_KEY_SHA256);

// Everyone's dashboard data with simple risk flags, for the organiser page and the weekly report.
async function overview(withEmails) {
  const { results } = await neon({
    queries: [
      q("SELECT id, name, discord, email, hidden, created_at FROM mb_students WHERE cohort = $1 ORDER BY created_at, id", [COHORT]),
      q("SELECT c.* FROM mb_checkins c JOIN mb_students s ON s.id = c.student_id WHERE s.cohort = $1 ORDER BY c.week", [COHORT]),
      q("SELECT p.* FROM mb_profile p JOIN mb_students s ON s.id = p.student_id WHERE s.cohort = $1", [COHORT]),
      q("SELECT b.student_id, b.buddy_id FROM mb_buddies b JOIN mb_students s ON s.id = b.student_id WHERE s.cohort = $1", [COHORT]),
      q("SELECT d.student_id, d.item, d.done_at FROM mb_done d JOIN mb_students s ON s.id = d.student_id WHERE s.cohort = $1", [COHORT]),
      q("SELECT f.student_id, f.months, f.answer, f.updated_at FROM mb_followups f JOIN mb_students s ON s.id = f.student_id WHERE s.cohort = $1", [COHORT]),
      q("SELECT months, sent, sent_at FROM mb_followup_sends WHERE cohort = $1", [COHORT]),
    ],
  });
  const [students, checkins, profiles, buddies, done, followups, sends] = results.map((r) => r.rows);
  const week = weekAt();
  const by = (rows) => {
    const m = new Map();
    for (const r of rows) {
      const id = Number(r.student_id);
      if (!m.has(id)) m.set(id, []);
      m.get(id).push(r);
    }
    return m;
  };
  const cBy = by(checkins), dBy = by(done), fBy = by(followups);
  const pBy = new Map(profiles.map((p) => [Number(p.student_id), p]));
  const bBy = new Map(buddies.map((b) => [Number(b.student_id), Number(b.buddy_id)]));
  const names = new Map(students.map((s) => [Number(s.id), s.name]));
  // Weeks that have had their session (check-ins are expected for those).
  const pastWeeks = Math.max(0, Math.min(WEEKS, Math.floor((Date.now() - FIRST_SESSION) / (7 * 864e5)) + 1));

  const list = students.map((s) => {
    const id = Number(s.id);
    const cs = (cBy.get(id) || []).map((c) => ({ week: Number(c.week), confidence: c.confidence == null ? null : Number(c.confidence), hours: c.hours == null ? null : Number(c.hours), clicked: c.clicked || "", blocked: c.blocked || "", help: bool(c.help), at: iso(c.updated_at) }));
    const ds = dBy.get(id) || [];
    const p = pBy.get(id);
    const lastActive = [iso(s.created_at), ...ds.map((d) => iso(d.done_at)), ...cs.map((c) => c.at)].sort().pop();
    const last = cs[cs.length - 1];
    const flags = [];
    const running = Date.now() < LAST_SESSION + 2 * 864e5;
    if (running && pastWeeks >= 2 && !cs.some((c) => c.week >= pastWeeks - 1)) flags.push("missed 2 check-ins");
    if (last && last.week >= week - 1 && last.help) flags.push("asked for help");
    if (last && last.week >= week - 1 && last.confidence && last.confidence <= 2) flags.push("low confidence");
    if (last && last.week >= week - 1 && last.blocked) flags.push("stuck");
    if (running && pastWeeks >= 1 && Date.now() - Date.parse(lastActive) > 14 * 864e5) flags.push("quiet 2+ weeks");
    return {
      id,
      name: s.name,
      discord: s.discord,
      ...(withEmails ? { email: s.email } : {}),
      hidden: bool(s.hidden),
      joined: iso(s.created_at),
      lastActive,
      ticks: ds.length,
      lessonsRead: ds.filter((d) => /-r1$/.test(d.item)).length,
      exercises: ds.filter((d) => /-e\d+$/.test(d.item)).length,
      checkins: cs,
      profile: p ? { why: p.why || "", build: p.build || "", experience: p.experience || "", goal: p.goal || "", skillsStart: parseJson(p.skills_start), skillsEnd: parseJson(p.skills_end) } : null,
      buddy: bBy.has(id) ? names.get(bBy.get(id)) || null : null,
      followups: Object.fromEntries((fBy.get(id) || []).map((f) => [f.months, parseJson(f.answer)])),
      flags: bool(s.hidden) ? [] : flags,
    };
  });
  const active = list.filter((s) => !s.hidden);
  const pulse = Array.from({ length: WEEKS }, (_, i) => {
    const w = i + 1;
    const cs = active.flatMap((s) => s.checkins.filter((c) => c.week === w));
    const avg = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
    return {
      week: w,
      checkins: cs.length,
      confidence: avg(cs.map((c) => c.confidence).filter((v) => v != null)),
      hours: avg(cs.map((c) => c.hours).filter((v) => v != null)),
      help: cs.filter((c) => c.help).length,
      read: active.filter((s) => done.some((d) => Number(d.student_id) === s.id && d.item === `w${w}-r1`)).length,
    };
  });
  const skillAvg = (key) => {
    const vals = active.map((s) => s.profile?.[key]).filter(Boolean);
    return Object.fromEntries(SKILLS.map((k) => {
      const xs = vals.map((v) => v[k]).filter((n) => typeof n === "number");
      return [k, xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null];
    }));
  };
  return {
    now: new Date().toISOString(),
    week,
    pastWeeks,
    total: active.length,
    atRisk: active.filter((s) => s.flags.length).length,
    pulse,
    skills: { start: skillAvg("skillsStart"), end: skillAvg("skillsEnd") },
    followupsSent: Object.fromEntries(sends.map((r) => [r.months, { sent: Number(r.sent), at: iso(r.sent_at) }])),
    students: list,
  };
}

const followupDue = (months) => {
  const d = new Date(LAST_SESSION);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.getTime();
};

// Emails everyone their follow-up link, once per follow-up and only once it's due.
async function sendFollowups(months) {
  if (!FOLLOWUP_MONTHS.includes(months)) return { status: 400, error: "Follow-ups are at 3, 6 or 12 months." };
  if (Date.now() < followupDue(months) - 2 * 864e5) return { status: 400, error: `The ${months}-month follow-up isn't due until ${new Date(followupDue(months)).toISOString().slice(0, 10)}.` };
  if (!mail.emailOn()) return { status: 503, error: "Email isn't switched on (RESEND_API_KEY)." };
  const [claim] = await sql("INSERT INTO mb_followup_sends (cohort, months) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING months", [COHORT, months]);
  if (!claim) return { status: 409, error: `The ${months}-month follow-up has already been sent.` };
  const rows = await sql("SELECT name, email, token FROM mb_students WHERE cohort = $1 AND NOT hidden AND email IS NOT NULL ORDER BY id", [COHORT]);
  let sent = 0;
  for (const s of rows) {
    try {
      await mail.sendFollowup({ ...s, months });
      sent++;
    } catch (err) {
      console.error("cohort-me: follow-up to", s.email, err.message);
    }
  }
  await sql("UPDATE mb_followup_sends SET sent = $3 WHERE cohort = $1 AND months = $2", [COHORT, months, sent]);
  return { status: 200, data: { ok: true, sent, total: rows.length } };
}

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
  if (!connectionString) return res.status(503).json({ error: "The dashboard opens soon." });
  try {
    await ensureTables();
    if (req.method === "GET") {
      if (req.query?.report !== undefined) {
        if (!isReport(req)) return res.status(401).json({ error: "Wrong report key." });
        if (req.query["send-followup"] !== undefined) {
          const r = await sendFollowups(Number(req.query["send-followup"]));
          return res.status(r.status).json(r.error ? { error: r.error } : r.data);
        }
        return res.status(200).json(await overview(false));
      }
      if (req.query?.admin !== undefined) {
        if (!isAdmin(req)) return res.status(401).json({ error: "Wrong admin key." });
        return res.status(200).json(await overview(true));
      }
      const r = await dashboard(clean(req.headers["x-mb-token"], 64));
      return res.status(r.status).json(r.error ? { error: r.error } : r.data);
    }
    if (req.method === "POST") {
      if (!sameOrigin(req)) return res.status(403).json({ error: "Please use codeorange.dev." });
      const body = readBody(req);
      const actions = {
        checkin: () => checkin(body),
        profile: () => profile(body),
        followup: () => followup(body),
        "admin-followup": () => (isAdmin(req) ? sendFollowups(Number(body.months)) : { status: 401, error: "Wrong admin key." }),
      };
      const r = Object.hasOwn(actions, body.action) ? await actions[body.action]() : { status: 400, error: "Unknown action." };
      return res.status(r.status).json(r.error ? { error: r.error } : r.data);
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error("cohort-me api:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again in a minute." });
  }
};
