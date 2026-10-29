// Developer fellowship: applications, the fellow dashboard (/fellowships/me), public
// proof-of-work pages (/fellowships/f/<github>) and the organiser page (/fellowships/admin).
// Same Neon database as the cohort; tables start with fw_.
//
// What is public and what isn't:
//   public   a fellow's project, milestones, monthly report highlights and GitHub work
//   private  applications, standups, blockers, help requests, payouts, addresses, emails
//
//   POST /api/fellowship {action:"apply", ...}                 application form
//   POST /api/fellowship {action:"link", email}                email a fellow their dashboard link
//   GET  /api/fellowship                                       my dashboard (X-FW-Token: token)
//   POST /api/fellowship {action:"standup"|"report"|"plan"|"check", token, ...}
//   GET  /api/fellowship?fellows=1                             public list of fellows
//   GET  /api/fellowship?fellow=<github>                       one fellow's public proof of work
//   GET  /api/fellowship?admin=1                               everything (X-MB-Admin: key)
//   GET  /api/fellowship?admin=1&rate=1                        Coinbase BTC/USD spot price now
//   GET  /api/fellowship?report=<key>                          everything minus emails and addresses
//   POST /api/fellowship {action:"admin-..."}                  organiser actions (X-MB-Admin: key)

const crypto = require("node:crypto");
const mail = require("./_lib/mail.js");

// Same keys as the Decoding Bitcoin cohort (MB_ADMIN_KEY / MB_REPORT_KEY override them).
const ADMIN_KEY_SHA256 = "72309790bc2a39b6f7cf37ca3d2dd89bfa87ed8fd6061a4fad74e331969bc48d";
const REPORT_KEY_SHA256 = "78bc5926a6f1adbd8ba91bdfd32734e40e290058d248fbe5f054794ccbcc0f34";
const ALERT_TO = process.env.FW_ALERT_EMAIL || process.env.MB_ALERT_EMAIL || "codeorangedevs@gmail.com";
const SITE = "https://codeorange.dev";
const STIPEND_USD = 512;
const MONTHS = 6;
const TOKEN_RE = /^[A-Za-z0-9_-]{24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GITHUB_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const MONTH_RE = /^20\d\d-(0[1-9]|1[0-2])$/;
const APP_STATUSES = ["new", "shortlisted", "interview", "waitlist", "accepted", "declined"];
const FELLOW_STATUSES = ["green", "yellow", "red", "paused", "graduated", "ended"];
// When the monthly report is due and when it's paid. Set per fellow by the organisers.
//   next  report by the 5th of the following month, paid by the 10th (the guidelines' default)
//   end   report by the 21st of the same month, paid by the end of that month
const SCHEDULES = ["next", "end"];
// The monthly to-dos a fellow ticks on their dashboard (private; organisers see them).
const CHECKS = ["reviews", "mentor", "crc", "privacy", "post"];
const DEFAULT_PLAN = [
  "Set up: build and tests pass, introduce yourself to the project, first small PR, refine this plan with your mentor",
  "Find your groove: 2+ PRs, one with real functionality; review others' PRs every week",
  "Keep shipping; month-3 review with your mentor",
  "Go deep: take on a feature, refactor or hard bug",
  "Finish the big piece; start your alumni handoff",
  "Land it: wrap up open PRs, document your work, demo it, line up your next step",
];

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
  if (!res.ok) {
    const err = new Error(data.message || `Database error (${res.status})`);
    err.code = data.code;
    err.constraint = data.constraint;
    throw err;
  }
  return data;
}

const sql = async (query, params = []) => (await neon({ query, params })).rows;
const q = (query, params = []) => ({ query, params });

let ready;
function ensureTables() {
  ready ||= neon({
    queries: [
      q(`CREATE TABLE IF NOT EXISTS fw_applications (
        id serial PRIMARY KEY,
        track text NOT NULL DEFAULT 'developer',
        name text NOT NULL,
        email text NOT NULL,
        discord text,
        github text NOT NULL,
        nostr text,
        region text,
        hours text,
        project text NOT NULL,
        project_url text,
        proof text,
        plan text NOT NULL,
        why text,
        mentor text,
        ready jsonb,
        status text NOT NULL DEFAULT 'new',
        notes text,
        ip_hash text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`),
      q("CREATE UNIQUE INDEX IF NOT EXISTS fw_applications_email ON fw_applications (track, lower(email))"),
      q(`CREATE TABLE IF NOT EXISTS fw_fellows (
        id serial PRIMARY KEY,
        application_id integer REFERENCES fw_applications(id) ON DELETE SET NULL,
        github text NOT NULL UNIQUE,
        name text NOT NULL,
        email text NOT NULL,
        discord text,
        token text NOT NULL UNIQUE,
        project text NOT NULL,
        project_url text,
        mentor text,
        start_month text NOT NULL,
        months integer NOT NULL DEFAULT ${MONTHS},
        status text NOT NULL DEFAULT 'green',
        public boolean NOT NULL DEFAULT true,
        bio text,
        links text,
        plan jsonb,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`),
      q(`CREATE TABLE IF NOT EXISTS fw_standups (
        fellow_id integer NOT NULL REFERENCES fw_fellows(id) ON DELETE CASCADE,
        week text NOT NULL,
        did text,
        next text,
        blockers text,
        links text,
        help boolean NOT NULL DEFAULT false,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (fellow_id, week)
      )`),
      q(`CREATE TABLE IF NOT EXISTS fw_reports (
        fellow_id integer NOT NULL REFERENCES fw_fellows(id) ON DELETE CASCADE,
        month integer NOT NULL,
        summary text,
        prs text,
        reviews text,
        other text,
        blockers text,
        next text,
        rail text,
        address text,
        help boolean NOT NULL DEFAULT false,
        approved boolean NOT NULL DEFAULT false,
        submitted_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (fellow_id, month)
      )`),
      q("ALTER TABLE fw_fellows ADD COLUMN IF NOT EXISTS schedule text NOT NULL DEFAULT 'next'"),
      q("ALTER TABLE fw_fellows ADD COLUMN IF NOT EXISTS focus text"),
      q("ALTER TABLE fw_fellows ADD COLUMN IF NOT EXISTS checks jsonb"),
      q("ALTER TABLE fw_reports ADD COLUMN IF NOT EXISTS mentor_note text"),
      q(`CREATE TABLE IF NOT EXISTS fw_payouts (
        id serial PRIMARY KEY,
        fellow_id integer NOT NULL REFERENCES fw_fellows(id) ON DELETE CASCADE,
        month integer NOT NULL,
        usd numeric NOT NULL,
        rate numeric,
        sats bigint,
        rail text,
        ref text,
        paid_at timestamptz NOT NULL DEFAULT now()
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

const iso = (v) => (v ? new Date(String(v).replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")).toISOString() : null);
const bool = (v) => v === true || v === "t" || v === "true";
const num = (v) => (v == null || v === "" ? null : Number(v));
const parseJson = (v) => {
  if (v == null) return null;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};
const urlish = (v, max = 300) => {
  const s = clean(v, max);
  return /^https?:\/\/\S+$/i.test(s) ? s : "";
};

// ---------- Fellowship calendar ----------
// A fellowship runs in calendar months from start_month ("2027-01"). When month k's report
// is due depends on the fellow's schedule (see SCHEDULES).
const monthNo = (ym) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
const ymOf = (n) => `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`;
function fellowMonth(startYm, t = Date.now()) {
  const d = new Date(t);
  return d.getUTCFullYear() * 12 + d.getUTCMonth() - monthNo(startYm) + 1;
}
const lastDay = (ym) => String(new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate()).padStart(2, "0");
const scheduleOf = (f) => (SCHEDULES.includes(f.schedule) ? f.schedule : "next");
function reportDue(f, k) {
  if (scheduleOf(f) === "end") return `${ymOf(monthNo(f.start_month) + k - 1)}-21`;
  return `${ymOf(monthNo(f.start_month) + k)}-05`;
}
function payBy(f, k) {
  if (scheduleOf(f) === "end") {
    const ym = ymOf(monthNo(f.start_month) + k - 1);
    return `${ym}-${lastDay(ym)}`;
  }
  return `${ymOf(monthNo(f.start_month) + k)}-10`;
}
// The day the dashboard starts asking for month k's report: a week before an "end" due
// date, or the first day of the next month for "next".
function reportOpens(f, k) {
  if (scheduleOf(f) === "end") return `${ymOf(monthNo(f.start_month) + k - 1)}-14`;
  return `${ymOf(monthNo(f.start_month) + k)}-01`;
}
const calendarOf = (f) =>
  Array.from({ length: Number(f.months) || MONTHS }, (_, i) => ({ month: i + 1, due: reportDue(f, i + 1), payBy: payBy(f, i + 1), opens: reportOpens(f, i + 1) }));
function checksOf(f) {
  const c = parseJson(f.checks) || {};
  const out = {};
  for (const [m, v] of Object.entries(c)) if (v && typeof v === "object") out[m] = Object.fromEntries(CHECKS.map((k) => [k, !!v[k]]));
  return out;
}
// Weeks are keyed by their Monday (UTC).
function mondayOf(t = Date.now()) {
  const d = new Date(t);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function planOf(row) {
  const plan = parseJson(row.plan);
  const n = Number(row.months) || MONTHS;
  return Array.from({ length: n }, (_, i) => ({
    goal: (plan && plan[i] && plan[i].goal) || DEFAULT_PLAN[i] || "",
    done: !!(plan && plan[i] && plan[i].done),
  }));
}

// ---------- Keys ----------
const hash = (v) => crypto.createHash("sha256").update(v).digest();
function keyMatches(given, envKey, fallbackHex) {
  if (!given) return false;
  const expected = envKey ? hash(envKey) : Buffer.from(fallbackHex, "hex");
  return crypto.timingSafeEqual(hash(given), expected);
}
const isAdmin = (req) => keyMatches(String(req.headers["x-mb-admin"] || ""), process.env.MB_ADMIN_KEY, ADMIN_KEY_SHA256);
const isReport = (req) => keyMatches(String(req.query?.report || ""), process.env.MB_REPORT_KEY, REPORT_KEY_SHA256);

function ipHash(req) {
  const ip = String(req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return crypto.createHash("sha256").update(`fw:${ip}`).digest("base64url").slice(0, 22);
}

async function alert(subject, lines) {
  if (!mail.emailOn()) return;
  try {
    await mail.sendTo(ALERT_TO, subject, lines);
  } catch (err) {
    console.error("fellowship: alert failed", err.message);
  }
}

const dashLink = (token) => `${SITE}/fellowships/me?me=${encodeURIComponent(token)}`;
const box = (label, value) => (value ? `<p><strong>${mail.esc(label)}</strong><br>${mail.esc(value).replace(/\n/g, "<br>")}</p>` : "");

// ---------- Applicant's copy ----------
const READY_LABELS = {
  learned: "Finished a Bitcoin dev course or serious self-study",
  pr: "Opened a PR (or written a review) on the project",
  builds: "Can build the project and run its tests",
  time: "Can give 10–15 hours a week for 6 months",
  plan: "Has a goal for each of the 6 months",
  public: "OK with a public proof-of-work page",
  clubs: "Will join Code Review Club and the Privacy Track",
  reviews: "Has reviewed someone else's PR",
  vouch: "A maintainer or contributor knows their work",
  privacy: "Project is on the Privacy Track list",
  community: "Shows up at sessions and on Discord",
};

// The confirmation every applicant gets, with a full copy of what they sent.
function sendCopy(a, opts = {}) {
  const ready = Object.entries(a.ready || {}).filter(([, v]) => v).map(([k]) => READY_LABELS[k] || k);
  return mail.sendTo(
    a.email,
    "Your Code Orange fellowship application",
    [
      `Hey ${mail.esc(a.name)}, thanks for applying for the Code Orange developer fellowship. 🧡`,
      "We'll get in touch with you directly within 2 weeks.",
      "While you wait, keep building: open or review a PR on your project, and share what you're doing in #fellowships on Discord. That's the best thing you can add to your application.",
      `<p>Guidelines: <a href="${SITE}/fellowships/guidelines" style="color:#d97706">codeorange.dev/fellowships/guidelines</a></p>`,
      `<div style="margin-top:22px;padding:16px 18px;border:1px solid #eee;border-radius:12px;background:#fafafa"><p style="margin:0 0 10px;font-weight:700">Your application</p>${[
        box("Name", a.name),
        box("GitHub", a.github ? `github.com/${a.github}` : ""),
        box("Discord", a.discord),
        box("Nostr", a.nostr),
        box("Region", a.region),
        box("Project", [a.project, a.project_url].filter(Boolean).join(" · ")),
        box("Hours you can give", a.hours),
        box("Proof of work", a.proof),
        box("6-month plan", a.plan),
        box("Why this project", a.why),
        box("Mentor / vouch", a.mentor),
        box("Ready check (what you ticked)", ready.length ? ready.map((r) => `✓ ${r}`).join("\n") : "Nothing ticked"),
      ].join("")}</div>`,
    ],
    undefined,
    opts,
  );
}

// Organiser: email an applicant their copy again (optionally BCC the organiser inbox).
async function adminCopy(body) {
  if (!mail.emailOn()) return { status: 400, error: "Email isn't switched on." };
  const [a] = await sql("SELECT * FROM fw_applications WHERE id = $1", [Number(body.id)]);
  if (!a) return { status: 404, error: "Unknown application." };
  await sendCopy({ ...a, ready: parseJson(a.ready) || {} }, body.bcc ? { bcc: ALERT_TO } : {});
  return { status: 200, data: { ok: true, to: a.email } };
}

// ---------- Applications ----------
async function apply(body, req) {
  if (body.website) return { status: 400, error: "Application failed." }; // honeypot
  const a = {
    name: clean(body.name, 80),
    email: clean(body.email, 120).toLowerCase(),
    discord: clean(body.discord, 40).replace(/^@/, ""),
    github: clean(body.github, 60).replace(/^@/, "").replace(/^https?:\/\/github\.com\//i, "").replace(/\/.*$/, ""),
    nostr: clean(body.nostr, 100),
    region: clean(body.region, 80),
    hours: clean(body.hours, 40),
    project: clean(body.project, 120),
    project_url: urlish(body.project_url),
    proof: clean(body.proof, 3000),
    plan: clean(body.plan, 6000),
    why: clean(body.why, 3000),
    mentor: clean(body.mentor, 300),
  };
  if (a.name.length < 2) return { status: 400, error: "Please add your name (a nym is fine)." };
  if (!EMAIL_RE.test(a.email)) return { status: 400, error: "That email doesn't look right." };
  if (!GITHUB_RE.test(a.github)) return { status: 400, error: "Please add your GitHub username." };
  if (a.project.length < 2) return { status: 400, error: "Which project do you want to work on?" };
  if (a.plan.length < 200) return { status: 400, error: "Your 6-month plan is a bit short. Give each month a goal (200 characters at least)." };
  if (!body.agree) return { status: 400, error: "Please tick that you've read the guidelines." };
  const readyIn = body.ready && typeof body.ready === "object" ? body.ready : {};
  const readyOut = {};
  for (const k of Object.keys(readyIn).slice(0, 12)) readyOut[clean(k, 30)] = !!readyIn[k];
  const ip = ipHash(req);
  const limits = `SELECT count(*) FILTER (WHERE ip_hash = $1 AND created_at > now() - interval '1 hour') AS mine,
                         count(*) FILTER (WHERE created_at > now() - interval '10 minutes') AS recent,
                         count(*) AS total FROM fw_applications`;
  let results;
  try {
    ({ results } = await neon({
      queries: [
        q("SELECT pg_advisory_xact_lock(hashtext('fw_apply'))::text AS locked"),
        q(
          `INSERT INTO fw_applications (name, email, discord, github, nostr, region, hours, project, project_url, proof, plan, why, mentor, ready, ip_hash)
           SELECT $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$1 FROM (${limits}) c
            WHERE c.mine < 3 AND c.recent < 20 AND c.total < 2000
           RETURNING id`,
          [ip, a.name, a.email, a.discord || null, a.github, a.nostr || null, a.region || null, a.hours || null, a.project, a.project_url || null, a.proof || null, a.plan, a.why || null, a.mentor || null, JSON.stringify(readyOut)],
        ),
      ],
    }));
  } catch (err) {
    if (err.code === "23505") return { status: 409, error: "You've already applied with this email. We'll be in touch; ask in Discord if anything changed." };
    throw err;
  }
  if (!results[1].rows.length) return { status: 429, error: "Too many applications right now. Please try again in an hour." };
  const id = Number(results[1].rows[0].id);
  const readyCount = Object.values(readyOut).filter(Boolean).length;
  await alert(`New fellowship application: ${a.name} (${a.project})`, [
    `<p><strong>${mail.esc(a.name)}</strong> applied for the developer fellowship. Ready check: ${readyCount}/${Object.keys(readyOut).length}.</p>`,
    box("GitHub", `https://github.com/${a.github}`),
    box("Project", `${a.project} ${a.project_url}`),
    box("Proof of work", a.proof),
    box("6-month plan", a.plan),
    box("Why", a.why),
    box("Mentor", a.mentor),
    box("Hours / region", `${a.hours} · ${a.region}`),
    `<p><a href="${SITE}/fellowships/admin" style="color:#d97706">Open the organiser page</a> (application #${id})</p>`,
  ]);
  if (mail.emailOn()) {
    try {
      await sendCopy({ ...a, ready: readyOut });
    } catch (err) {
      console.error("fellowship: confirmation failed", err.message);
    }
  }
  return { status: 200, data: { ok: true, id } };
}

// ---------- Fellow dashboard ----------
async function fellowByToken(token) {
  if (!TOKEN_RE.test(token)) return null;
  const [f] = await sql("SELECT * FROM fw_fellows WHERE token = $1", [token]);
  return f || null;
}

const shapeStandup = (s) => ({ week: s.week, did: s.did || "", next: s.next || "", blockers: s.blockers || "", links: s.links || "", help: bool(s.help), updatedAt: iso(s.updated_at) });
const shapeReport = (r, priv) => ({
  month: Number(r.month),
  summary: r.summary || "",
  prs: r.prs || "",
  reviews: r.reviews || "",
  other: r.other || "",
  next: r.next || "",
  submittedAt: iso(r.submitted_at),
  ...(priv ? { mentorNote: r.mentor_note || "", blockers: r.blockers || "", rail: r.rail || "", address: r.address || "", help: bool(r.help), approved: bool(r.approved) } : {}),
});
const shapePayout = (p) => ({ id: Number(p.id), month: Number(p.month), usd: num(p.usd), rate: num(p.rate), sats: num(p.sats), rail: p.rail || "", ref: p.ref || "", paidAt: iso(p.paid_at) });

function fellowCore(f) {
  const month = fellowMonth(f.start_month);
  return {
    github: f.github,
    name: f.name,
    project: f.project,
    projectUrl: f.project_url || "",
    mentor: f.mentor || "",
    startMonth: f.start_month,
    months: Number(f.months),
    month,
    bio: f.bio || "",
    links: f.links || "",
    plan: planOf(f),
    focus: f.focus || "",
  };
}

async function dashboard(token) {
  const f = await fellowByToken(token);
  if (!f) return { status: 401, error: "That link didn't work. Use \"Email me my link\" or ask in Discord." };
  const { results } = await neon({
    queries: [
      q("SELECT * FROM fw_standups WHERE fellow_id = $1 ORDER BY week DESC", [f.id]),
      q("SELECT * FROM fw_reports WHERE fellow_id = $1 ORDER BY month", [f.id]),
      q("SELECT * FROM fw_payouts WHERE fellow_id = $1 ORDER BY month, paid_at", [f.id]),
    ],
  });
  const [standups, reports, payouts] = results.map((r) => r.rows);
  const core = fellowCore(f);
  return {
    status: 200,
    data: {
      me: { ...core, email: f.email, discord: f.discord || "", status: f.status, public: bool(f.public) },
      thisWeek: mondayOf(),
      stipendUsd: STIPEND_USD,
      schedule: scheduleOf(f),
      calendar: calendarOf(f),
      dueDates: calendarOf(f).map((c) => c.due),
      checks: checksOf(f),
      standups: standups.map(shapeStandup),
      reports: reports.map((r) => shapeReport(r, true)),
      payouts: payouts.map(shapePayout),
    },
  };
}

async function standup(body) {
  const f = await fellowByToken(clean(body.token, 64));
  if (!f) return { status: 401, error: "Please sign in again." };
  const now = mondayOf();
  const prev = mondayOf(Date.now() - 7 * 864e5);
  const week = [now, prev].includes(body.week) ? body.week : now;
  const s = { did: clean(body.did, 2000), next: clean(body.next, 1500), blockers: clean(body.blockers, 1500), links: clean(body.links, 2000), help: !!body.help };
  if (!s.did && !s.next) return { status: 400, error: "Write a line about what you did or what's next." };
  const [old] = await sql("SELECT help FROM fw_standups WHERE fellow_id = $1 AND week = $2", [f.id, week]);
  await sql(
    `INSERT INTO fw_standups (fellow_id, week, did, next, blockers, links, help) VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (fellow_id, week) DO UPDATE SET did = $3, next = $4, blockers = $5, links = $6, help = $7, updated_at = now()`,
    [f.id, week, s.did, s.next, s.blockers, s.links, s.help],
  );
  if (s.help && !(old && bool(old.help))) {
    await alert(`Fellow needs help: ${f.name}`, [
      `<p><strong>${mail.esc(f.name)}</strong> (${mail.esc(f.project)}) asked for help in their standup for the week of ${week}.</p>`,
      box("Blocked on", s.blockers),
      box("Did", s.did),
      box("Next", s.next),
      f.discord ? box("Discord", f.discord) : "",
      box("Email", f.email),
    ]);
  }
  return { status: 200, data: { ok: true, week } };
}

async function report(body) {
  const f = await fellowByToken(clean(body.token, 64));
  if (!f) return { status: 401, error: "Please sign in again." };
  const month = Math.round(Number(body.month));
  const current = fellowMonth(f.start_month);
  if (!(month >= 1 && month <= Number(f.months) && month <= current)) return { status: 400, error: "You can report on this month once it has started." };
  const r = {
    summary: clean(body.summary, 4000),
    prs: clean(body.prs, 3000),
    reviews: clean(body.reviews, 3000),
    other: clean(body.other, 2000),
    blockers: clean(body.blockers, 2000),
    next: clean(body.next, 2000),
    rail: ["lightning", "onchain", "ecash"].includes(body.rail) ? body.rail : "",
    address: clean(body.address, 600),
    mentor_note: clean(body.mentorNote, 2000),
    help: !!body.help,
  };
  if (r.summary.length < 40) return { status: 400, error: "Add a short summary of the month (a few sentences)." };
  const [old] = await sql("SELECT month FROM fw_reports WHERE fellow_id = $1 AND month = $2", [f.id, month]);
  await sql(
    `INSERT INTO fw_reports (fellow_id, month, summary, prs, reviews, other, blockers, next, rail, address, help, mentor_note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (fellow_id, month) DO UPDATE SET summary = $3, prs = $4, reviews = $5, other = $6, blockers = $7,
       next = $8, rail = $9, address = $10, help = $11, mentor_note = $12, submitted_at = now()`,
    [f.id, month, r.summary, r.prs, r.reviews, r.other, r.blockers, r.next, r.rail, r.address, r.help, r.mentor_note],
  );
  await alert(`${old ? "Updated" : "New"} monthly report: ${f.name}, month ${month}`, [
    `<p><strong>${mail.esc(f.name)}</strong> ${old ? "updated" : "sent"} the report for month ${month} of ${f.months} (${mail.esc(f.project)}).${r.help ? " <strong>They asked for help.</strong>" : ""}</p>`,
    box("Summary", r.summary),
    box("PRs", r.prs),
    box("Reviews", r.reviews),
    box("Note from the mentor", r.mentor_note),
    box("Blocked on", r.blockers),
    box("Paid by", `${r.rail} ${r.address}`),
    `<p><a href="${SITE}/fellowships/admin" style="color:#d97706">Approve it on the organiser page</a></p>`,
  ]);
  return { status: 200, data: { ok: true } };
}

async function plan(body) {
  const f = await fellowByToken(clean(body.token, 64));
  if (!f) return { status: 401, error: "Please sign in again." };
  const given = Array.isArray(body.plan) ? body.plan : [];
  const out = planOf(f).map((p, i) => ({
    goal: given[i] && typeof given[i].goal === "string" ? clean(given[i].goal, 400) || p.goal : p.goal,
    done: given[i] ? !!given[i].done : p.done,
  }));
  await sql("UPDATE fw_fellows SET plan = $2::jsonb, bio = $3, links = $4, project_url = COALESCE(NULLIF($5, ''), project_url), focus = COALESCE($6, focus) WHERE id = $1", [
    f.id,
    JSON.stringify(out),
    clean(body.bio, 600),
    clean(body.links, 600),
    urlish(body.projectUrl),
    typeof body.focus === "string" ? clean(body.focus, 1500) : null,
  ]);
  return { status: 200, data: { ok: true } };
}

// Tick or untick one of this month's to-dos.
async function check(body) {
  const f = await fellowByToken(clean(body.token, 64));
  if (!f) return { status: 401, error: "Please sign in again." };
  const month = Math.round(Number(body.month));
  if (!(month >= 1 && month <= Number(f.months)) || !CHECKS.includes(body.key)) return { status: 400, error: "Unknown to-do." };
  const all = checksOf(f);
  all[month] = { ...Object.fromEntries(CHECKS.map((k) => [k, false])), ...(all[month] || {}), [body.key]: !!body.on };
  await sql("UPDATE fw_fellows SET checks = $2::jsonb WHERE id = $1", [f.id, JSON.stringify(all)]);
  return { status: 200, data: { ok: true, checks: all } };
}

async function emailLink(body) {
  const email = clean(body.email, 120).toLowerCase();
  if (!EMAIL_RE.test(email)) return { status: 400, error: "That email doesn't look right." };
  if (!mail.emailOn()) return { status: 503, error: "Email isn't switched on yet. Ask in Discord." };
  const [f] = await sql("SELECT name, email, token FROM fw_fellows WHERE lower(email) = $1", [email]);
  if (f) {
    await mail.sendTo(f.email, "Your Code Orange fellowship dashboard", [
      `Hey ${mail.esc(f.name)}, here's your personal link. Keep it private: it signs you in.`,
      `<p><a href="${dashLink(f.token)}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#F7931A;color:#000;font-weight:700;text-decoration:none">Open my fellow dashboard</a></p>`,
    ]);
  }
  // Same answer either way, so the form doesn't reveal who is a fellow.
  return { status: 200, data: { ok: true } };
}

// ---------- Public proof of work ----------
const ghHeaders = () => {
  const h = { Accept: "application/vnd.github+json", "User-Agent": "codeorange.dev fellowship" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
};
async function ghSearch(query) {
  const r = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=created&order=desc&per_page=50`, {
    headers: ghHeaders(),
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  const data = await r.json();
  return (data.items || []).map((it) => ({
    title: it.title,
    url: it.html_url,
    repo: (it.repository_url || "").split("/repos/")[1] || "",
    state: it.pull_request && it.pull_request.merged_at ? "merged" : it.state,
    createdAt: it.created_at,
  }));
}

// PRs they opened on other people's repositories since starting, and PRs they reviewed.
async function githubWork(github, startYm) {
  const since = `${startYm}-01`;
  try {
    const [prs, reviews] = await Promise.all([
      ghSearch(`is:pr author:${github} -user:${github} created:>=${since}`),
      ghSearch(`is:pr reviewed-by:${github} -author:${github} -user:${github} updated:>=${since}`),
    ]);
    return { prs, reviews, ok: true };
  } catch (err) {
    console.error("fellowship: github", err.message);
    return { prs: [], reviews: [], ok: false };
  }
}

async function publicList() {
  const rows = await sql("SELECT * FROM fw_fellows WHERE public AND status <> 'ended' ORDER BY start_month, id");
  return {
    fellows: rows.map((f) => {
      const c = fellowCore(f);
      return { github: c.github, name: c.name, project: c.project, month: c.month, months: c.months, startMonth: c.startMonth, graduated: f.status === "graduated", milestonesDone: c.plan.filter((p) => p.done).length };
    }),
  };
}

async function publicFellow(github) {
  if (!GITHUB_RE.test(github)) return { status: 404, error: "No fellow with that name." };
  const [f] = await sql("SELECT * FROM fw_fellows WHERE lower(github) = lower($1) AND public", [github]);
  if (!f) return { status: 404, error: "No fellow with that name." };
  const { results } = await neon({
    queries: [
      q("SELECT * FROM fw_reports WHERE fellow_id = $1 ORDER BY month DESC", [f.id]),
      q("SELECT count(*) AS n, max(week) AS last FROM fw_standups WHERE fellow_id = $1", [f.id]),
    ],
  });
  const [reports, [st]] = results.map((r) => r.rows);
  return {
    status: 200,
    data: {
      fellow: { ...fellowCore(f), graduated: f.status === "graduated" },
      reports: reports.map((r) => shapeReport(r, false)),
      standupWeeks: Number(st.n),
      lastStandup: st.last || null,
      github: await githubWork(f.github, f.start_month),
    },
  };
}

// ---------- Organisers ----------
async function overview(withPrivate) {
  const { results } = await neon({
    queries: [
      q("SELECT * FROM fw_applications ORDER BY created_at DESC"),
      q("SELECT * FROM fw_fellows ORDER BY start_month, id"),
      q("SELECT * FROM fw_standups ORDER BY week DESC"),
      q("SELECT * FROM fw_reports ORDER BY month"),
      q("SELECT * FROM fw_payouts ORDER BY paid_at"),
    ],
  });
  const [apps, fellows, standups, reports, payouts] = results.map((r) => r.rows);
  const thisWeek = mondayOf();
  const lastWeek = mondayOf(Date.now() - 7 * 864e5);
  const today = new Date().toISOString().slice(0, 10);
  return {
    thisWeek,
    applications: apps.map((a) => ({
      id: Number(a.id),
      name: a.name,
      ...(withPrivate ? { email: a.email } : {}),
      discord: a.discord || "",
      github: a.github,
      nostr: a.nostr || "",
      region: a.region || "",
      hours: a.hours || "",
      project: a.project,
      projectUrl: a.project_url || "",
      proof: a.proof || "",
      plan: a.plan,
      why: a.why || "",
      mentor: a.mentor || "",
      ready: parseJson(a.ready) || {},
      status: a.status,
      notes: a.notes || "",
      createdAt: iso(a.created_at),
    })),
    fellows: fellows.map((f) => {
      const id = f.id;
      const mine = standups.filter((s) => s.fellow_id === id);
      const reps = reports.filter((r) => r.fellow_id === id);
      const pays = payouts.filter((p) => p.fellow_id === id);
      const core = fellowCore(f);
      const flags = [];
      const active = ["green", "yellow", "red"].includes(f.status) && core.month >= 1 && core.month <= core.months + 1;
      if (active) {
        if (!mine.some((s) => s.week === thisWeek || s.week === lastWeek) && core.month >= 1) flags.push("No standup for 2 weeks");
        for (let k = 1; k <= Math.min(core.month, core.months); k++) {
          if (!reps.some((r) => Number(r.month) === k) && today > reportDue(f, k)) flags.push(`Month ${k} report overdue`);
          else if (reps.some((r) => Number(r.month) === k && bool(r.approved)) && !pays.some((p) => Number(p.month) === k)) flags.push(`Month ${k} approved, pay by ${payBy(f, k)}`);
        }
      }
      if (mine.some((s) => bool(s.help) && s.week >= lastWeek) || reps.some((r) => bool(r.help) && Number(r.month) >= core.month - 1)) flags.push("Asked for help");
      return {
        id: Number(id),
        ...core,
        ...(withPrivate ? { email: f.email, token: f.token } : {}),
        discord: f.discord || "",
        status: f.status,
        public: bool(f.public),
        notes: f.notes || "",
        flags,
        schedule: scheduleOf(f),
        calendar: calendarOf(f),
        dueDates: calendarOf(f).map((c) => c.due),
        checks: checksOf(f),
        standups: mine.map(shapeStandup),
        reports: reps.map((r) => {
          const out = shapeReport(r, true);
          if (!withPrivate) delete out.address;
          return out;
        }),
        payouts: pays.map(shapePayout),
        paidUsd: pays.reduce((n, p) => n + Number(p.usd || 0), 0),
      };
    }),
  };
}

async function coinbaseRate() {
  const r = await fetch("https://api.coinbase.com/v2/prices/BTC-USD/spot", { signal: AbortSignal.timeout(6000) }).catch(() => null);
  if (!r || !r.ok) return { status: 502, error: "Coinbase didn't answer. Try again or type the price in." };
  const data = await r.json();
  const rate = Number(data && data.data && data.data.amount);
  if (!(rate > 0)) return { status: 502, error: "Coinbase sent an odd price." };
  return { status: 200, data: { rate, sats: Math.round((STIPEND_USD / rate) * 1e8), at: new Date().toISOString(), source: "Coinbase BTC-USD spot" } };
}

async function adminApp(body) {
  const id = Number(body.id);
  if (!Number.isInteger(id)) return { status: 400, error: "Unknown application." };
  const status = APP_STATUSES.includes(body.status) ? body.status : null;
  await sql("UPDATE fw_applications SET status = COALESCE($2, status), notes = COALESCE($3, notes), updated_at = now() WHERE id = $1", [
    id,
    status,
    typeof body.notes === "string" ? clean(body.notes, 3000) : null,
  ]);
  return { status: 200, data: { ok: true } };
}

async function adminAccept(body) {
  const id = Number(body.id);
  const [a] = await sql("SELECT * FROM fw_applications WHERE id = $1", [id]);
  if (!a) return { status: 404, error: "Unknown application." };
  const start = MONTH_RE.test(body.start) ? body.start : null;
  if (!start) return { status: 400, error: "Pick the first month (like 2027-01)." };
  const months = Number.isInteger(body.months) && body.months >= 1 && body.months <= 12 ? body.months : MONTHS;
  const schedule = SCHEDULES.includes(body.schedule) ? body.schedule : "next";
  const mentor = clean(body.mentor, 120);
  // Milestones typed by the organiser, one line per month (optional; the fellow can edit them).
  const lines = clean(body.plan, 3000).split("\n").map((l) => l.replace(/^\s*(?:month\s*\d+|[A-Za-z]{3,9}|\d+)\s*[:.)]\s*/i, "").trim()).filter(Boolean);
  const plan = lines.length ? JSON.stringify(Array.from({ length: months }, (_, i) => ({ goal: clean(lines[i] || "", 400), done: false }))) : null;
  const focus = clean(body.focus, 1500) || null;
  const token = crypto.randomBytes(18).toString("base64url");
  let fellow;
  try {
    [fellow] = await sql(
      `INSERT INTO fw_fellows (application_id, github, name, email, discord, token, project, project_url, mentor, start_month, months, schedule, plan, focus)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14) RETURNING id`,
      [a.id, a.github, a.name, a.email, a.discord, token, clean(body.project, 120) || a.project, a.project_url, mentor || null, start, months, schedule, plan, focus],
    );
  } catch (err) {
    if (err.code === "23505") return { status: 409, error: "This GitHub user is already a fellow." };
    throw err;
  }
  await sql("UPDATE fw_applications SET status = 'accepted', updated_at = now() WHERE id = $1", [a.id]);
  let emailed = false;
  if (mail.emailOn() && body.email !== false) {
    const MN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const startLabel = `1 ${MN[Number(start.slice(5, 7)) - 1]} ${start.slice(0, 4)}`;
    const rhythm = schedule === "end" ? "send your monthly report by the 21st, and you're paid before the end of that month" : "send your monthly report by the 5th of the next month, and you're paid by the 10th";
    try {
      await mail.sendTo(a.email, "Your Code Orange fellow dashboard 🧡", [
        `Hey ${mail.esc(a.name)}, welcome to the Code Orange developer fellowship! It starts on ${startLabel} and runs for ${months} months${mentor ? `, with ${mail.esc(mentor)} as your mentor` : ""}.`,
        "Everything lives on your fellow dashboard: your Monday check-in, your monthly report (it doubles as your invoice), your milestones, this month's to-dos and your payouts. The link below signs you in, so keep it private.",
        `<p><a href="${dashLink(token)}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#F7931A;color:#000;font-weight:700;text-decoration:none">Open my fellow dashboard</a></p>`,
        `The rhythm: a short check-in every Monday; ${rhythm}.`,
        "First steps: check your milestones on the dashboard, add the PRs you want to keep moving, and post your first check-in on the first Monday.",
        `<p>Guidelines: <a href="${SITE}/fellowships/guidelines" style="color:#d97706">codeorange.dev/fellowships/guidelines</a></p>`,
      ]);
      emailed = true;
    } catch (err) {
      console.error("fellowship: welcome failed", err.message);
    }
  }
  return { status: 200, data: { ok: true, id: Number(fellow.id), link: dashLink(token), emailed } };
}

async function adminFellow(body) {
  const id = Number(body.id);
  if (!Number.isInteger(id)) return { status: 400, error: "Unknown fellow." };
  const status = FELLOW_STATUSES.includes(body.status) ? body.status : null;
  const months = Number.isInteger(body.months) && body.months >= 1 && body.months <= 12 ? body.months : null;
  await sql(
    `UPDATE fw_fellows SET status = COALESCE($2, status), mentor = COALESCE($3, mentor), public = COALESCE($4, public),
       months = COALESCE($5, months), start_month = COALESCE($6, start_month), project = COALESCE($7, project), notes = COALESCE($8, notes),
       schedule = COALESCE($9, schedule)
     WHERE id = $1`,
    [
      id,
      status,
      typeof body.mentor === "string" ? clean(body.mentor, 120) : null,
      typeof body.public === "boolean" ? body.public : null,
      months,
      MONTH_RE.test(body.start) ? body.start : null,
      typeof body.project === "string" && body.project.trim() ? clean(body.project, 120) : null,
      typeof body.notes === "string" ? clean(body.notes, 3000) : null,
      SCHEDULES.includes(body.schedule) ? body.schedule : null,
    ],
  );
  return { status: 200, data: { ok: true } };
}

async function adminApprove(body) {
  const id = Number(body.id);
  const month = Number(body.month);
  await sql("UPDATE fw_reports SET approved = $3 WHERE fellow_id = $1 AND month = $2", [id, month, body.approved !== false]);
  return { status: 200, data: { ok: true } };
}

async function adminPayout(body) {
  const id = Number(body.id);
  const month = Number(body.month);
  const usd = Number(body.usd || STIPEND_USD);
  const rate = Number(body.rate) || null;
  if (!Number.isInteger(id) || !(month >= 1 && month <= 12) || !(usd > 0 && usd < 100000)) return { status: 400, error: "Check the month and amount." };
  const sats = Number(body.sats) > 0 ? Math.round(Number(body.sats)) : rate ? Math.round((usd / rate) * 1e8) : null;
  const paid = /^\d{4}-\d\d-\d\d$/.test(body.paidAt) ? body.paidAt : null;
  await sql("INSERT INTO fw_payouts (fellow_id, month, usd, rate, sats, rail, ref, paid_at) VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz, now()))", [
    id,
    month,
    usd,
    rate,
    sats,
    clean(body.rail, 30),
    clean(body.ref, 300),
    paid,
  ]);
  return { status: 200, data: { ok: true, sats } };
}

async function adminPayoutDelete(body) {
  await sql("DELETE FROM fw_payouts WHERE id = $1", [Number(body.payout)]);
  return { status: 200, data: { ok: true } };
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
  if (!connectionString) return res.status(503).json({ error: "Applications open soon." });
  try {
    await ensureTables();
    const send = (r) => res.status(r.status).json(r.error ? { error: r.error } : r.data);
    if (req.method === "GET") {
      const query = req.query || {};
      if (query.report !== undefined) {
        if (!isReport(req)) return res.status(401).json({ error: "Wrong report key." });
        return res.status(200).json(await overview(false));
      }
      if (query.admin !== undefined) {
        if (!isAdmin(req)) return res.status(401).json({ error: "Wrong admin key." });
        if (query.rate !== undefined) return send(await coinbaseRate());
        return res.status(200).json(await overview(true));
      }
      if (query.fellows !== undefined) {
        res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
        return res.status(200).json(await publicList());
      }
      if (query.fellow !== undefined) {
        const r = await publicFellow(clean(String(query.fellow), 60));
        if (!r.error) res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
        return send(r);
      }
      return send(await dashboard(clean(req.headers["x-fw-token"], 64)));
    }
    if (req.method === "POST") {
      if (!sameOrigin(req)) return res.status(403).json({ error: "Please use codeorange.dev." });
      const body = readBody(req);
      const admin = (fn) => (isAdmin(req) ? fn(body) : { status: 401, error: "Wrong admin key." });
      const actions = {
        apply: () => apply(body, req),
        link: () => emailLink(body),
        standup: () => standup(body),
        report: () => report(body),
        plan: () => plan(body),
        check: () => check(body),
        "admin-app": () => admin(adminApp),
        "admin-copy": () => admin(adminCopy),
        "admin-accept": () => admin(adminAccept),
        "admin-fellow": () => admin(adminFellow),
        "admin-approve": () => admin(adminApprove),
        "admin-payout": () => admin(adminPayout),
        "admin-payout-delete": () => admin(adminPayoutDelete),
      };
      return send(Object.hasOwn(actions, body.action) ? await actions[body.action]() : { status: 400, error: "Unknown action." });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error("fellowship api:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again in a minute." });
  }
};
