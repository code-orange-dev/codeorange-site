// Public Code Orange calendar as JSON, for the site's own calendar widget (assets/co-calendar.js).
// Reads the public iCal feed of the "Workshops - Code Orange Dev School" Google Calendar,
// expands recurring events and returns the occurrences in a window around today.
// No npm deps: a small iCal parser and RRULE expander that covers what Google Calendar emits.

const CAL_ID = "466de2be7431d78be2049f96f5fd31f9b06b5a9cd94f909ba3182b18442ed499@group.calendar.google.com";
const ICS_URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CAL_ID)}/public/basic.ics`;
const CAL_TZ = "Asia/Makassar";
const DAY = 86400000;

// ---------- iCal parsing ----------

function unfold(text) {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function unescapeText(v) {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

function parseLine(line) {
  const colon = line.search(/:(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = head.split(";");
  const params = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: parts[0].toUpperCase(), params, value };
}

function parseICS(text) {
  const events = [];
  let cur = null;
  for (const raw of unfold(text).split("\n")) {
    const line = raw.trimEnd();
    if (line === "BEGIN:VEVENT") { cur = { exdates: [], rdates: [] }; continue; }
    if (line === "END:VEVENT") { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const p = parseLine(line);
    if (!p) continue;
    switch (p.name) {
      case "UID": cur.uid = p.value; break;
      case "SUMMARY": cur.summary = unescapeText(p.value); break;
      case "DESCRIPTION": cur.description = unescapeText(p.value); break;
      case "LOCATION": cur.location = unescapeText(p.value); break;
      case "STATUS": cur.status = p.value.toUpperCase(); break;
      case "DTSTART": cur.dtstart = parseDate(p); break;
      case "DTEND": cur.dtend = parseDate(p); break;
      case "DURATION": cur.duration = parseDuration(p.value); break;
      case "RRULE": cur.rrule = parseRRule(p.value); break;
      case "RECURRENCE-ID": cur.recurrenceId = parseDate(p); break;
      case "EXDATE": for (const v of p.value.split(",")) cur.exdates.push(parseDate({ params: p.params, value: v })); break;
      case "RDATE": for (const v of p.value.split(",")) cur.rdates.push(parseDate({ params: p.params, value: v })); break;
    }
  }
  return events;
}

// A date value as wall-clock parts plus its zone ("UTC", a TZID, or null for all-day).
function parseDate(p) {
  const v = p.value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const allDay = !m[4] || p.params.VALUE === "DATE";
  return {
    y: +m[1], mo: +m[2], d: +m[3],
    h: allDay ? 0 : +m[4], mi: allDay ? 0 : +m[5], s: allDay ? 0 : +m[6],
    allDay,
    tz: allDay ? null : m[7] ? "UTC" : p.params.TZID || CAL_TZ,
  };
}

function parseDuration(v) {
  const m = v.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const ms = ((+m[2] || 0) * 7 * DAY) + ((+m[3] || 0) * DAY) + ((+m[4] || 0) * 3600000) + ((+m[5] || 0) * 60000) + ((+m[6] || 0) * 1000);
  return m[1] === "-" ? -ms : ms;
}

function parseRRule(v) {
  const r = {};
  for (const part of v.split(";")) {
    const [k, val] = part.split("=");
    if (k && val !== undefined) r[k.toUpperCase()] = val;
  }
  const rule = { freq: r.FREQ, interval: Math.max(1, +r.INTERVAL || 1) };
  if (r.COUNT) rule.count = +r.COUNT;
  if (r.UNTIL) rule.until = parseDate({ params: {}, value: r.UNTIL });
  if (r.BYDAY) rule.byday = r.BYDAY.split(",").map((s) => {
    const m = s.match(/^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/);
    return m ? { n: m[1] ? +m[1] : 0, wd: WD[m[2]] } : null;
  }).filter(Boolean);
  if (r.BYMONTHDAY) rule.bymonthday = r.BYMONTHDAY.split(",").map(Number);
  if (r.BYMONTH) rule.bymonth = r.BYMONTH.split(",").map(Number);
  if (r.BYSETPOS) rule.bysetpos = r.BYSETPOS.split(",").map(Number);
  rule.wkst = WD[r.WKST] ?? 1;
  return rule;
}

const WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

// ---------- time zones ----------

const fmtCache = {};
function tzOffsetMs(tz, utcMs) {
  if (tz === "UTC") return 0;
  let f = fmtCache[tz];
  if (!f) {
    try {
      f = fmtCache[tz] = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch { return tzOffsetMs(CAL_TZ, utcMs); }
  }
  const p = {};
  for (const x of f.formatToParts(new Date(utcMs))) p[x.type] = x.value;
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

// Wall-clock time in a zone -> epoch ms.
function toUtc(d) {
  const wall = Date.UTC(d.y, d.mo - 1, d.d, d.h, d.mi, d.s);
  if (d.allDay) return wall;
  const tz = d.tz || CAL_TZ;
  let t = wall - tzOffsetMs(tz, wall);
  t = wall - tzOffsetMs(tz, t);
  return t;
}

// ---------- recurrence expansion ----------
// Works on calendar days (as UTC-midnight day numbers) in the event's own zone,
// then rebuilds each occurrence with DTSTART's wall-clock time.

function dayNum(y, mo, d) { return Math.floor(Date.UTC(y, mo - 1, d) / DAY); }
function fromDayNum(n) { const t = new Date(n * DAY); return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() }; }
function daysInMonth(y, mo) { return new Date(Date.UTC(y, mo, 0)).getUTCDate(); }

function monthDayMatches(rule, start, c) {
  const dim = daysInMonth(c.y, c.mo);
  if (rule.byday && rule.byday.length) {
    const hits = [];
    for (let d = 1; d <= dim; d++) {
      const wd = new Date(Date.UTC(c.y, c.mo - 1, d)).getUTCDay();
      for (const b of rule.byday) {
        if (b.wd !== wd) continue;
        if (!b.n) { hits.push(d); continue; }
        const nth = Math.ceil(d / 7);
        const nthFromEnd = -Math.ceil((dim - d + 1) / 7);
        if (b.n === nth || b.n === nthFromEnd) hits.push(d);
      }
    }
    let set = [...new Set(hits)].sort((a, b) => a - b);
    if (rule.bymonthday) set = set.filter((d) => rule.bymonthday.some((m) => (m > 0 ? m : dim + m + 1) === d));
    if (rule.bysetpos) set = rule.bysetpos.map((p) => (p > 0 ? set[p - 1] : set[set.length + p])).filter(Boolean);
    return set.includes(c.d);
  }
  if (rule.bymonthday) return rule.bymonthday.some((m) => (m > 0 ? m : dim + m + 1) === c.d);
  return c.d === start.d;
}

function occurrenceDays(ev, fromDay, toDay) {
  const rule = ev.rrule;
  const s = ev.dtstart;
  const startDay = dayNum(s.y, s.mo, s.d);
  const startWd = fromDayNum(startDay).wd;
  const untilMs = rule.until ? toUtc(rule.until.allDay ? { ...rule.until, h: 23, mi: 59, s: 59 } : rule.until) : Infinity;
  // Week index with weeks starting on WKST (Monday by default). Day 0 (1970-01-01) was a Thursday.
  const weekOf = (n) => Math.floor((n + 11 - rule.wkst) / 7);
  const out = [];
  let count = 0;
  const hardEnd = Math.min(toDay, startDay + 365 * 6);
  for (let n = startDay; n <= hardEnd; n++) {
    const c = fromDayNum(n);
    let ok = false;
    switch (rule.freq) {
      case "DAILY":
        ok = (n - startDay) % rule.interval === 0;
        if (ok && rule.byday) ok = rule.byday.some((b) => b.wd === c.wd);
        break;
      case "WEEKLY": {
        if ((weekOf(n) - weekOf(startDay)) % rule.interval !== 0) break;
        ok = rule.byday && rule.byday.length ? rule.byday.some((b) => b.wd === c.wd) : c.wd === startWd;
        break;
      }
      case "MONTHLY": {
        const md = (c.y - s.y) * 12 + (c.mo - s.mo);
        if (md % rule.interval !== 0) break;
        ok = monthDayMatches(rule, s, c);
        break;
      }
      case "YEARLY": {
        if ((c.y - s.y) % rule.interval !== 0) break;
        const months = rule.bymonth || [s.mo];
        if (!months.includes(c.mo)) break;
        ok = rule.byday || rule.bymonthday ? monthDayMatches(rule, s, c) : c.d === s.d;
        break;
      }
    }
    if (!ok) continue;
    const occ = { ...s, y: c.y, mo: c.mo, d: c.d };
    if (toUtc(occ) > untilMs) break;
    count++;
    if (n >= fromDay) out.push(occ);
    if (rule.count && count >= rule.count) break;
  }
  return out;
}

const key = (d) => `${d.y}-${d.mo}-${d.d}`;

// ---------- output ----------

function plainText(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstUrl(...texts) {
  for (const t of texts) {
    const m = t && t.match(/https?:\/\/[^\s<>"']+/);
    if (m) return m[0].replace(/[.,)]+$/, "");
  }
  return null;
}

function buildEvents(text, now) {
  const all = parseICS(text).filter((e) => e.dtstart && e.uid);
  const fromDay = Math.floor(now / DAY) - 62;
  const toDay = Math.floor(now / DAY) + 400;
  const overrides = {};
  for (const e of all) if (e.recurrenceId) (overrides[e.uid] ||= {})[key(e.recurrenceId)] = e;

  const out = [];
  const push = (ev, start) => {
    if (ev.status === "CANCELLED") return;
    const startMs = toUtc(start);
    let len = ev.duration;
    if (!len && ev.dtend) len = toUtc(ev.dtend) - toUtc(ev.dtstart);
    if (!len) len = ev.dtstart.allDay ? DAY : 3600000;
    const desc = plainText(ev.description);
    out.push({
      id: `${ev.uid}|${key(start)}`,
      title: ev.summary || "Code Orange session",
      // All-day events are plain dates; timed events are UTC instants.
      start: ev.dtstart.allDay ? new Date(startMs).toISOString().slice(0, 10) : new Date(startMs).toISOString(),
      end: ev.dtstart.allDay ? new Date(startMs + len).toISOString().slice(0, 10) : new Date(startMs + len).toISOString(),
      allDay: !!ev.dtstart.allDay,
      location: ev.location || "",
      url: firstUrl(ev.location, ev.description),
      description: desc.length > 1200 ? desc.slice(0, 1200).trimEnd() + "…" : desc,
    });
  };

  for (const ev of all) {
    if (ev.recurrenceId) continue;
    if (!ev.rrule) {
      const d = Math.floor(toUtc(ev.dtstart) / DAY);
      if (d >= fromDay && d <= toDay) push(ev, ev.dtstart);
      continue;
    }
    const ex = new Set(ev.exdates.filter(Boolean).map(key));
    const ov = overrides[ev.uid] || {};
    const days = occurrenceDays(ev, fromDay, toDay);
    for (const r of ev.rdates.filter(Boolean)) days.push({ ...ev.dtstart, y: r.y, mo: r.mo, d: r.d });
    for (const occ of days) {
      const k = key(occ);
      if (ex.has(k)) continue;
      if (ov[k]) { push(ov[k], ov[k].dtstart); delete ov[k]; continue; }
      push(ev, occ);
    }
    // Overrides moved into the window from an occurrence outside it.
    for (const o of Object.values(ov)) {
      const d = Math.floor(toUtc(o.dtstart) / DAY);
      if (d >= fromDay && d <= toDay) push(o, o.dtstart);
    }
  }
  // Orphan overrides whose series isn't in the feed.
  const seriesUids = new Set(all.filter((e) => !e.recurrenceId).map((e) => e.uid));
  for (const e of all) {
    if (!e.recurrenceId || seriesUids.has(e.uid)) continue;
    const d = Math.floor(toUtc(e.dtstart) / DAY);
    if (d >= fromDay && d <= toDay) push(e, e.dtstart);
  }
  const seen = new Set();
  return out
    .filter((e) => (seen.has(e.id) ? false : seen.add(e.id)))
    .sort((a, b) => a.start.localeCompare(b.start));
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const r = await fetch(ICS_URL, { headers: { "User-Agent": "codeorange.dev calendar" } });
    if (!r.ok) throw new Error(`Calendar feed returned ${r.status}`);
    const text = await r.text();
    const events = buildEvents(text, Date.now());
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
    return res.status(200).json({ timeZone: CAL_TZ, updated: new Date().toISOString(), events });
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: "Calendar unavailable" });
  }
};

module.exports.buildEvents = buildEvents;
