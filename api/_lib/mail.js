// Emails for the Decoding Bitcoin cohort, and syncing sign-ups to MailerLite.
//
// Both switch on by themselves once their keys are in Vercel's environment variables:
//   RESEND_API_KEY      sends the welcome email and "email me my link" (resend.com)
//   MB_EMAIL_FROM       optional sender, default "Code Orange Dev School <cohort@codeorange.dev>"
//                       (the domain must be verified in Resend)
//   MAILERLITE_API_KEY  adds every sign-up to a MailerLite group, for reminders before each Monday
//   MAILERLITE_GROUP    optional group name, default "Decoding Bitcoin cohort" (created if missing)
// Without the keys nothing is sent and sign-ups work as before.

const SITE = "https://codeorange.dev";
const DISCORD = "https://discord.gg/ZtvA79paWa";
// Keep in step with assets/mastering-bitcoin/cohort.js.
const FIRST_SESSION = new Date("2026-11-16T11:00:00Z"); // Monday 7pm UTC+8
const SESSION_MINUTES = 90;
const WEEKS = 10;

const emailOn = () => !!process.env.RESEND_API_KEY;
const mailerliteOn = () => !!process.env.MAILERLITE_API_KEY;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const personalLink = (token) => `${SITE}/decoding-bitcoin?me=${encodeURIComponent(token)}`;

function calendarLink() {
  const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = new Date(FIRST_SESSION.getTime() + SESSION_MINUTES * 6e4);
  return "https://calendar.google.com/calendar/render?" + new URLSearchParams({
    action: "TEMPLATE",
    text: "Decoding Bitcoin study cohort",
    dates: `${stamp(FIRST_SESSION)}/${stamp(end)}`,
    recur: `RRULE:FREQ=WEEKLY;COUNT=${WEEKS}`,
    details: `Weekly session on Discord: ${DISCORD}\nThis week's lessons and questions: ${SITE}/decoding-bitcoin`,
    location: "Discord",
  });
}

async function send(to, subject, lines) {
  const html = `<div style="font:16px/1.55 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;max-width:560px">${lines
    .map((l) => (l.startsWith("<") ? l : `<p>${l}</p>`))
    .join("")}<p style="color:#777;font-size:13px">Code Orange Dev School · <a href="${SITE}" style="color:#d97706">codeorange.dev</a></p></div>`;
  const text = html.replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, "$2 ($1)").replace(/<\/(p|li)>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MB_EMAIL_FROM || "Code Orange Dev School <cohort@codeorange.dev>",
      reply_to: "hello@codeorange.dev",
      to: [to],
      subject,
      html,
      text,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

const button = (href, label) =>
  `<p><a href="${href}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#F7931A;color:#000;font-weight:700;text-decoration:none">${label}</a></p>`;

function sendWelcome({ email, name, token }) {
  const link = personalLink(token);
  return send(email, "You're in: Decoding Bitcoin study cohort", [
    `Hi ${esc(name)},`,
    "You're signed up for the Decoding Bitcoin study cohort. We start on <strong>Monday 16 November, 7 to 8:30pm (UTC+8)</strong> on Discord, every Monday for 10 weeks.",
    "<p><strong>1. Join our Discord</strong>. That's where the sessions happen.</p>",
    button(DISCORD, "Join the Discord"),
    "<p><strong>2. Keep your personal link</strong>. It opens your dashboard with this week's lessons, your questions and the exercises, on any device.</p>",
    button(link, "Open my dashboard"),
    `<p><strong>3. Add the sessions to your calendar</strong>: <a href="${calendarLink()}" style="color:#d97706">Google Calendar</a> or <a href="${SITE}/assets/mastering-bitcoin/sessions.ics" style="color:#d97706">Apple / Outlook (.ics)</a>.</p>`,
    `Before the first session, do the welcome lessons on <a href="https://bitcoindevs.xyz/decoding" style="color:#d97706">Decoding Bitcoin</a>.`,
    "See you on Monday!",
  ]);
}

function sendLink({ email, name, token }) {
  return send(email, "Your Decoding Bitcoin link", [
    `Hi ${esc(name)},`,
    "Here's your personal link for the Decoding Bitcoin study cohort. Open it on any device to see your dashboard and tick things off.",
    button(personalLink(token), "Open my dashboard"),
    "Didn't ask for this? You can ignore this email.",
  ]);
}

// ── MailerLite ──
const ML = "https://connect.mailerlite.com/api";
const mlFetch = async (path, init = {}) => {
  const res = await fetch(`${ML}${path}`, {
    ...init,
    signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${process.env.MAILERLITE_API_KEY}`, "Content-Type": "application/json", Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`MailerLite ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
};

let groupId;
async function mlGroup() {
  if (groupId) return groupId;
  const name = process.env.MAILERLITE_GROUP || "Decoding Bitcoin cohort";
  const found = await mlFetch(`/groups?filter[name]=${encodeURIComponent(name)}&limit=50`);
  const match = (found.data || []).find((g) => g.name === name);
  groupId = match ? match.id : (await mlFetch("/groups", { method: "POST", body: JSON.stringify({ name }) })).data.id;
  return groupId;
}

const subscriber = (s, group) => ({ email: s.email, fields: { name: s.name }, groups: [group] });

async function addToMailerLite(student) {
  const group = await mlGroup();
  await mlFetch("/subscribers", { method: "POST", body: JSON.stringify(subscriber(student, group)) });
}

// Adds everyone in one go (MailerLite's batch endpoint takes 50 requests at a time).
async function syncMailerLite(students) {
  const group = await mlGroup();
  let added = 0;
  for (let i = 0; i < students.length; i += 50) {
    const chunk = students.slice(i, i + 50);
    const out = await mlFetch("/batch", {
      method: "POST",
      body: JSON.stringify({ requests: chunk.map((s) => ({ method: "POST", path: "api/subscribers", body: subscriber(s, group) })) }),
    });
    added += (out.responses || []).filter((r) => r.code >= 200 && r.code < 300).length;
  }
  return added;
}

module.exports = { emailOn, mailerliteOn, sendWelcome, sendLink, addToMailerLite, syncMailerLite };
