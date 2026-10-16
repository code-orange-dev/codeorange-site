// Decoding Bitcoin personal dashboard (/decoding-bitcoin/me): this week, weekly check-in,
// goals, skill map, study buddy, progress and badges, and alumni follow-ups.
// Curriculum and dates come from cohort.js; data from /api/cohort-me and /api/mastering-bitcoin.
(() => {
  const C = window.MB_COHORT;
  const API = "/api/cohort-me";
  const COHORT_API = "/api/mastering-bitcoin";
  const TOKEN_KEY = "mb-token";
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const listJoin = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}` : a.join(""));
  const lessonUrl = (slug) => `${C.courseUrl}/${slug}`;

  const store = {
    get() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } },
    set(v) { try { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); } catch {} },
  };
  const params = new URLSearchParams(location.search);
  if (params.get("me")) {
    store.set(params.get("me"));
    params.delete("me");
    history.replaceState(null, "", location.pathname + (params.toString() ? `?${params}` : "") + location.hash);
  }
  const followupMonths = [3, 6, 12].includes(Number(params.get("followup"))) ? Number(params.get("followup")) : 0;

  const SKILLS = [
    ["utxo", "Transactions & UTXOs"],
    ["structure", "Transaction structure"],
    ["fees", "Fees"],
    ["signing", "Signing"],
    ["script", "Script (P2PK, P2PKH)"],
    ["p2sh", "P2SH & multisig"],
    ["taproot", "Taproot & Schnorr"],
    ["build", "Building your own tools"],
  ];
  const LEVELS = ["New to me", "Heard of it", "Could explain it", "Could use it", "Could teach it"];
  const CONF = ["", "Lost", "Shaky", "Getting there", "Good", "Nailed it"];

  // ── Dates (same rules as the main cohort page) ──
  const sessionDates = C.weeks.map((_, i) => {
    const [y, m, d] = C.startDate.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + 7 * i, C.sessionUtcHour));
  });
  const now = Date.now();
  const currentWeek = (() => {
    if (now < sessionDates[0] - 7 * 864e5) return -1;
    let w = 0;
    while (w < sessionDates.length - 1 && now > sessionDates[w].getTime() + 864e5) w++;
    return w;
  })();
  const finished = now > sessionDates[sessionDates.length - 1].getTime() + 864e5;
  const weekOpens = (wi) => sessionDates[wi].getTime() - 7 * 864e5;
  const pad = (n) => String(n).padStart(2, "0");
  const utcLabel = (d) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
  const plus8 = (d) => new Date(d.getTime() + 8 * 36e5);
  const dayLabel = (d) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  function sessionLine(d) {
    const p = plus8(d);
    let s = `${dayLabel(p)} · ${utcLabel(d)} · ${pad(p.getUTCHours())}:${pad(p.getUTCMinutes())} UTC+8`;
    const offset = -new Date().getTimezoneOffset();
    if (offset !== 0 && offset !== 480) s += ` · ${d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })} your time`;
    return s;
  }

  const state = { token: store.get(), me: null, data: null, students: [], rosterVisible: false, done: new Set(), busy: false };

  // Question owners and seminar roles, as on the main page (round-robin in sign-up order,
  // fixed once a week opens).
  function assignments() {
    const map = {};
    if (!state.rosterVisible) return map;
    const roles = C.roles || [];
    let k = 0, r = 0;
    C.weeks.forEach((w, wi) => {
      const opens = weekOpens(wi);
      const locked = now >= opens ? state.students.filter((s) => !s.joined || s.joined < opens) : [];
      const pool = locked.length ? locked : state.students;
      w.questions.forEach((_, qi) => { map[`w${wi + 1}-q${qi + 1}`] = pool.length ? pool[k % pool.length] : null; k++; });
      roles.slice(0, pool.length).forEach((_, ri) => { map[`w${wi + 1}-role${ri}`] = pool[r % pool.length]; r++; });
    });
    return map;
  }

  // ── Data ──
  async function getJson(url, headers) {
    const res = await fetch(url, { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || "Couldn't load."); e.status = res.status; throw e; }
    return data;
  }
  async function post(url, body) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }
  async function load() {
    if (!state.token) return renderSignedOut();
    try {
      const [mine, roster] = await Promise.all([
        getJson(API, { "X-MB-Token": state.token }),
        getJson(COHORT_API, { "X-MB-Token": state.token }).catch(() => ({ students: [], rosterVisible: false })),
      ]);
      state.data = mine;
      state.me = mine.me;
      state.students = roster.students || [];
      state.rosterVisible = !!roster.rosterVisible;
      state.done = new Set((mine.done || []).map((d) => d.item));
      render();
    } catch (err) {
      if (err.status === 401) { store.set(""); state.token = ""; return renderSignedOut(); }
      $("#me-app").innerHTML = `<div class="me-card me-wide"><h2>Couldn't load your dashboard</h2><p>${esc(err.message)} Please refresh in a minute.</p></div>`;
    }
  }

  function toast(msg) {
    const t = $("#me-toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { t.hidden = true; }, 3200);
  }

  // ── Signed out ──
  function renderSignedOut() {
    $("#me-hello").textContent = "Your Decoding Bitcoin dashboard";
    $("#me-sub").textContent = "Open it with the personal link from your welcome email, or get the link sent again.";
    $("#me-app").innerHTML = `<div class="me-card me-wide me-signin">
      <h2>Sign in</h2>
      <p>Your personal link is in the email you got when you signed up. Lost it? Enter the email you signed up with.</p>
      <form id="me-lost" class="me-row"><input type="email" name="email" required placeholder="you@example.com" autocomplete="email" aria-label="Your email"><button class="button small" type="submit">Email me my link</button></form>
      <p class="me-note" id="me-lost-note" role="status"></p>
      <p class="me-small">Not signed up yet? <a href="/decoding-bitcoin#signup">Join the cohort, it's free</a>.</p>
    </div>`;
    $("#me-lost").addEventListener("submit", async (e) => {
      e.preventDefault();
      const note = $("#me-lost-note");
      try {
        await post(COHORT_API, { action: "email-link", email: e.target.email.value });
        note.textContent = "If that email is signed up, your link is on its way. Check your inbox (and spam).";
      } catch (err) { note.textContent = err.message; }
    });
  }

  // ── Signed in ──
  function stats() {
    const d = state.data;
    const lessons = C.weeks.filter((_, i) => state.done.has(`w${i + 1}-r1`)).length;
    const exTotal = C.weeks.reduce((n, w) => n + w.exercises.length, 0);
    const exDone = [...state.done].filter((k) => /-e\d+$/.test(k)).length;
    const weeksActive = new Set([...d.checkins.map((c) => c.week), ...C.weeks.map((_, i) => (state.done.has(`w${i + 1}-r1`) ? i + 1 : 0)).filter(Boolean)]);
    // Streak: weeks in a row with a check-in or the lessons done, up to this week (or last week, if this one isn't done yet).
    let streak = 0;
    let w = currentWeek + 1;
    if (w >= 1 && !weeksActive.has(w)) w--;
    while (w >= 1 && weeksActive.has(w)) { streak++; w--; }
    return { lessons, exTotal, exDone, checkins: d.checkins.length, streak, weeksActive };
  }

  function badges(s) {
    const d = state.data;
    const p = d.profile || {};
    const list = [
      ["🧡", "Joined", "Signed up for the cohort", true],
      ["🎯", "Goals set", "Wrote down why you joined", !!(p.why || p.build)],
      ["🗺️", "Mapped", "Rated your starting skills", !!p.skillsStart],
      ["📝", "First check-in", "Did your first weekly check-in", s.checkins >= 1],
      ["🔥", "On a roll", "3 weeks in a row", s.streak >= 3],
      ["🙋", "Brave ask", "Asked for help (the best habit there is)", d.checkins.some((c) => c.help)],
      ["🛠️", "Hands on", "Finished 10 exercises", s.exDone >= 10],
      ["⛰️", "Halfway", "Lessons done for 5 weeks", s.lessons >= 5],
      ["🎓", "Graduate", "Lessons done for all 10 weeks", s.lessons >= C.weeks.length],
    ];
    return list.map(([icon, name, why, got]) => `<li class="${got ? "is-got" : ""}" title="${esc(why)}"><span aria-hidden="true">${icon}</span><b>${esc(name)}</b><small>${esc(why)}</small></li>`).join("");
  }

  function certBox(s) {
    const need = state.data.certificate || { lessons: 8, checkins: 6 };
    const pct = Math.round(((Math.min(s.lessons, need.lessons) + Math.min(s.checkins, need.checkins)) / (need.lessons + need.checkins)) * 100);
    const got = pct >= 100;
    return `<div class="me-cert${got ? " is-got" : ""}"><div class="me-row"><b>${got ? "🎓 You've earned your certificate!" : "Certificate"}</b><span>${pct}%</span></div>
      <span class="me-bar"><i style="width:${pct}%"></i></span>
      <small>${got ? "We'll send it after graduation. Add your GitHub username in your goals so it shows on it." : `Lessons for ${need.lessons} of 10 weeks (${Math.min(s.lessons, need.lessons)}/${need.lessons}) and ${need.checkins} check-ins (${Math.min(s.checkins, need.checkins)}/${need.checkins}). <a href="/certificates/sample">See a sample</a>`}</small></div>`;
  }

  function weekStrip(s) {
    return C.weeks.map((w, i) => {
      const n = i + 1;
      const cls = [s.weeksActive.has(n) ? "is-done" : "", i === currentWeek ? "is-now" : "", i > currentWeek ? "is-later" : ""].join(" ");
      return `<li class="${cls}" title="Week ${n}: ${esc(w.title)}"><span>${n}</span></li>`;
    }).join("");
  }

  function tick(item, label) {
    const done = state.done.has(item);
    return `<li class="${done ? "is-done" : ""}"><button type="button" class="me-tick" data-item="${item}" aria-pressed="${done}"><span class="me-box" aria-hidden="true">${done ? "✓" : ""}</span><span>${label}</span></button></li>`;
  }

  // The one thing to do next, worked out from where the student is.
  function nextStep(s) {
    const d = state.data;
    const p = d.profile || {};
    const wk = currentWeek + 1;
    const go = (href, label) => `<a class="button small" href="${href}">${label}</a>`;
    if (followupMonths) return null;
    if (!p.why && !p.build) return ["Start by writing down why you joined.", "People who name a goal are far more likely to finish.", go("#goals", "Set my goals")];
    if (!p.skillsStart) return ["Rate your starting skills.", "Thirty seconds now, and in week 9 you'll see exactly how far you've come.", go("#skills", "Rate my skills")];
    if (finished) return p.skillsEnd ? null : ["Rate your skills one last time.", "See how far you've come since the start.", go("#skills", "Rate again")];
    if (currentWeek < 0) return ["You're all set for week 1.", `Lessons go up the week before. First session: ${sessionLine(sessionDates[0])}.`, go(`/assets/mastering-bitcoin/sessions.ics?v=20261010a`, "Add the sessions to my calendar")];
    if (!state.done.has(`w${wk}-r1`)) return [`Do this week's lessons before Monday.`, esc(C.weeks[currentWeek].lessons.map((l) => l.title).join(", ")), go("#week", "See this week")];
    if (!d.checkins.some((c) => c.week === wk)) return ["Do your 2-minute check-in.", "It's how we spot who's stuck and what to cover on Monday.", go("#checkin", "Check in")];
    if (currentWeek >= C.weeks.length - 2 && !p.skillsEnd) return ["Rate your skills again.", "See how far you've come since the start.", go("#skills", "Rate again")];
    if (d.buddy && d.buddy.lastWeek < wk) return [`Nudge your buddy ${esc(d.buddy.name)}.`, "They haven't checked in this week yet. A quick hello on Discord helps.", `<a class="button small" href="${C.discord}" target="_blank" rel="noopener">Open Discord</a>`];
    return ["You're on top of this week. 🙌", s.streak >= 2 ? `${s.streak}-week streak. See you Monday!` : "See you Monday!", ""];
  }
  function nextCardTop(s) {
    const n = nextStep(s);
    if (!n) return "";
    return `<div class="me-card me-wide me-nextstep"><div><p class="me-label">Your next step</p><h2>${n[0]}</h2><p>${n[1]}</p></div>${n[2]}</div>`;
  }

  function thisWeekCard() {
    if (finished) {
      return `<div class="me-card"><p class="me-label">The cohort</p><h2>You made it to the end 🎉</h2><p>All 10 weeks are done. Fill in your end-of-cohort skill map below, then pick a next step.</p><a class="ghost small" href="/decoding-bitcoin#curriculum">Look back at the weeks</a></div>`;
    }
    const wi = Math.max(0, currentWeek);
    const wk = wi + 1;
    const w = C.weeks[wi];
    const assigned = assignments();
    const myQs = w.questions.map((_, qi) => `w${wk}-q${qi + 1}`).filter((k) => assigned[k]?.id === state.me.id);
    const roles = (C.roles || []).filter((_, ri) => assigned[`w${wk}-role${ri}`]?.id === state.me.id);
    const before = currentWeek < 0;
    const items = [
      tick(`w${wk}-r1`, `Do the lesson${w.lessons.length > 1 ? "s" : ""}: ${w.lessons.map((l) => `<a href="${lessonUrl(l.slug)}" target="_blank" rel="noopener">${esc(l.title)}</a>`).join(", ")}`),
      ...myQs.map((k) => tick(k, `Answer your question Q${k.split("-q")[1]} on Discord: <em>${esc(w.questions[Number(k.split("-q")[1]) - 1])}</em>`)),
      ...w.exercises.map((ex, ei) => tick(`w${wk}-e${ei + 1}`, `Exercise ${ei + 1}: ${esc(ex)}`)),
    ].join("");
    return `<div class="me-card me-week" id="week">
      <p class="me-label">${before ? "Coming up · week 1" : `This week · week ${wk} of ${C.weeks.length}`}</p>
      <h2>${esc(w.title)}</h2>
      <p class="me-when">Next session: <strong>${esc(sessionLine(sessionDates[wi]))}</strong> on <a href="${C.discord}" target="_blank" rel="noopener">Discord</a></p>
      ${roles.length ? `<p class="me-role">On Monday you're the <strong>${roles.map((r) => esc(r.name)).join("</strong> and <strong>")}</strong>. ${esc(roles[0].job)}</p>` : ""}
      <p class="me-open">Opening question: <em>${esc(w.opening)}</em></p>
      <ul class="me-check">${items}</ul>
      <p class="me-jumps"><a class="me-jump" href="/decoding-bitcoin#week-${wk}">Open week ${wk} on the cohort page →</a> <a class="me-jump" href="/assets/mastering-bitcoin/sessions.ics?v=20261010a" download="decoding-bitcoin-sessions.ics">Add sessions to my calendar</a></p>
    </div>`;
  }

  function checkinCard() {
    if (currentWeek < 0) {
      return `<div class="me-card"><p class="me-label">Weekly check-in</p><h2>Two minutes, once a week</h2><p>From week 1 you'll answer four quick questions here after each session: how confident you feel, how long you spent, what clicked and where you got stuck. Only you and the organisers see your answers.</p><p class="me-small">Opens ${esc(dayLabel(plus8(new Date(weekOpens(0) + 7 * 864e5))))}.</p></div>`;
    }
    const last = Math.min(C.weeks.length, currentWeek + 1);
    const sel = Number(checkinCard.week) || last;
    const c = state.data.checkins.find((x) => x.week === sel) || {};
    const options = Array.from({ length: last }, (_, i) => `<option value="${i + 1}"${i + 1 === sel ? " selected" : ""}>Week ${i + 1}${state.data.checkins.some((x) => x.week === i + 1) ? " ✓" : ""}</option>`).join("");
    return `<div class="me-card me-checkin" id="checkin">
      <p class="me-label">Weekly check-in · private to you and the organisers</p>
      <form id="me-checkin">
        <div class="me-row"><h2>How did it go?</h2><select name="week" aria-label="Week">${options}</select></div>
        <fieldset class="me-scale"><legend>How confident do you feel about this week's topic?</legend>
          ${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="confidence" value="${n}"${c.confidence === n ? " checked" : ""}><span><b>${n}</b>${CONF[n]}</span></label>`).join("")}
        </fieldset>
        <fieldset class="me-pills"><legend>Did you make it to Monday's session?</legend>${[["yes", "Yes"], ["no", "Not this time"]].map(([v, l]) => `<label><input type="radio" name="attended" value="${v}"${c.attended === (v === "yes") && c.attended != null ? " checked" : ""}><span>${l}</span></label>`).join("")}</fieldset>
        <label class="me-field">Hours spent this week<input type="number" name="hours" min="0" max="80" step="0.5" inputmode="decimal" value="${c.hours ?? ""}" placeholder="e.g. 3"></label>
        <label class="me-field">What clicked?<textarea name="clicked" rows="2" maxlength="1000" placeholder="One thing that made sense this week">${esc(c.clicked || "")}</textarea></label>
        <label class="me-field">Where did you get stuck?<textarea name="blocked" rows="2" maxlength="1000" placeholder="Anything confusing, broken or slow">${esc(c.blocked || "")}</textarea></label>
        <label class="me-help"><input type="checkbox" name="help"${c.help ? " checked" : ""}> I'd like some help with this (an organiser will reach out on Discord)</label>
        <button class="button small" type="submit">${c.week ? "Update check-in" : "Save check-in"}</button>
      </form>
      ${shareBox(c.week ? c.clicked : "")}
    </div>`;
  }

  // Learning in public: turn "what clicked" into a post. Builders who share what they learn get noticed.
  function shareBox(clicked) {
    const text = state.shareText || clicked;
    if (!text || text.length < 9) return "";
    const post = `This week in #DecodingBitcoin I learned: ${text.slice(0, 200)}\n\nStudying with @CodeOrangeDevs, free 10-week cohort: https://codeorange.dev/decoding-bitcoin`;
    return `<div class="me-share"><p><b>Learn in public.</b> Share what clicked: it helps you remember it, and people notice builders who share.</p>
      <div class="me-row"><a class="ghost small" href="https://x.com/intent/post?text=${encodeURIComponent(post)}" target="_blank" rel="noopener">Post on X</a><button type="button" class="ghost small" data-copy="${esc(post)}" data-copy-msg="Copied. Paste it into your Nostr app.">Copy for Nostr</button></div></div>`;
  }

  function progressCard(s) {
    const cs = state.data.checkins.filter((c) => c.confidence);
    let spark = "";
    if (cs.length >= 2) {
      const W = 220, H = 48;
      const x = (wk) => ((wk - 1) / (C.weeks.length - 1)) * (W - 8) + 4;
      const y = (v) => H - 4 - ((v - 1) / 4) * (H - 8);
      const pts = cs.map((c) => `${x(c.week).toFixed(1)},${y(c.confidence).toFixed(1)}`).join(" ");
      spark = `<figure class="me-spark"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Your confidence by week"><polyline points="${pts}" fill="none" stroke="#F7931A" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${cs.map((c) => `<circle cx="${x(c.week).toFixed(1)}" cy="${y(c.confidence).toFixed(1)}" r="3.5" fill="#F7931A"/>`).join("")}</svg><figcaption>Your confidence, week by week</figcaption></figure>`;
    }
    return `<div class="me-card me-progress">
      <p class="me-label">Your progress</p>
      <div class="me-stats">
        <span><strong>${s.streak}</strong>week streak</span>
        <span><strong>${s.lessons}/${C.weeks.length}</strong>weeks of lessons</span>
        <span><strong>${s.exDone}/${s.exTotal}</strong>exercises</span>
        <span><strong>${s.checkins}</strong>check-ins</span>
      </div>
      <ol class="me-strip" aria-label="The 10 weeks">${weekStrip(s)}</ol>
      ${certBox(s)}
      ${spark}
      <p class="me-label">Badges</p>
      <ul class="me-badges">${badges(s)}</ul>
    </div>`;
  }

  function goalsCard() {
    const p = state.data.profile || {};
    const exp = [["new", "New to coding"], ["some", "I code a bit"], ["dev", "I'm a developer"], ["bitcoin-dev", "I already build on Bitcoin"]];
    return `<div class="me-card me-goals" id="goals">
      <p class="me-label">Your goals · private</p>
      <h2>Why you're here</h2>
      <form id="me-profile">
        <label class="me-field">Why did you join?<textarea name="why" rows="2" maxlength="1000" placeholder="e.g. I want to understand what my wallet is really doing">${esc(p.why || "")}</textarea></label>
        <label class="me-field">What would you love to build or do with Bitcoin?<textarea name="build" rows="2" maxlength="1000" placeholder="e.g. a Lightning tip jar, my first PR to Bitcoin Core">${esc(p.build || "")}</textarea></label>
        <label class="me-field">Your goal for the 10 weeks<textarea name="goal" rows="2" maxlength="1000" placeholder="One thing you'll be able to do by the end">${esc(p.goal || "")}</textarea></label>
        <label class="me-field">Your GitHub username <small class="me-small">(for your certificate and the builders wall)</small><input type="text" name="github" maxlength="80" value="${esc(p.github || "")}" placeholder="satoshi" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
        <fieldset class="me-pills"><legend>Your experience</legend>${exp.map(([v, l]) => `<label><input type="radio" name="experience" value="${v}"${p.experience === v ? " checked" : ""}><span>${l}</span></label>`).join("")}</fieldset>
        <button class="button small" type="submit">Save goals</button>
      </form>
    </div>`;
  }

  function skillsCard() {
    const p = state.data.profile || {};
    const endOpen = finished || currentWeek >= C.weeks.length - 2;
    const which = endOpen && p.skillsStart ? "end" : "start";
    const current = (which === "end" ? p.skillsEnd : p.skillsStart) || {};
    const rows = SKILLS.map(([k, label]) => {
      const a = p.skillsStart?.[k], b = p.skillsEnd?.[k];
      const bars = `<span class="me-bar"><i style="width:${a == null ? 0 : (a / 4) * 100}%"></i>${b != null ? `<i class="is-end" style="width:${(b / 4) * 100}%"></i>` : ""}</span>`;
      return `<li><span class="me-skill">${esc(label)}</span>${bars}<select name="${k}" aria-label="${esc(label)}"><option value="">Rate…</option>${LEVELS.map((l, i) => `<option value="${i}"${current[k] === i ? " selected" : ""}>${l}</option>`).join("")}</select></li>`;
    }).join("");
    return `<div class="me-card me-skills" id="skills">
      <p class="me-label">Skill map · ${which === "end" ? "rate yourself again at the end" : "rate yourself at the start"}</p>
      <h2>${which === "end" ? "How far you've come" : "Where you're starting from"}</h2>
      <p class="me-small">${which === "end" ? "Grey is where you started, orange is now." : "No wrong answers. You'll rate these again in week 9 to see how far you've come."}</p>
      <form id="me-skills" data-which="${which}"><ul class="me-skill-list">${rows}</ul><button class="button small" type="submit">Save skill map</button></form>
    </div>`;
  }

  function buddyCard() {
    const d = state.data;
    const from = new Date(d.buddyFrom);
    let body;
    if (d.buddy) {
      const wk = currentWeek + 1;
      const status = wk >= 1 ? (d.buddy.lastWeek >= wk ? `checked in for week ${wk} ✓` : d.buddy.lastWeek ? `last checked in for week ${d.buddy.lastWeek}` : "hasn't checked in yet") : "";
      body = `<h2>${esc(d.buddy.name)}</h2>
        <p>Discord: <strong>${esc(d.buddy.discord || "ask in the cohort channel")}</strong>${status ? ` · ${esc(status)}` : ""}</p>
        <p class="me-small">Say hi this week. Try a 15-minute call before Monday: compare answers, unstick each other, and nudge each other to check in.</p>
        <a class="ghost small" href="${C.discord}" target="_blank" rel="noopener">Message on Discord</a>`;
    } else if (Date.now() < from.getTime()) {
      body = `<h2>Coming ${esc(dayLabel(plus8(from)))}</h2><p>A week before the first session we'll pair you with another student. You'll keep each other going for the 10 weeks.</p>`;
    } else {
      body = `<h2>Finding your buddy…</h2><p>You'll be paired with the next classmate who opens their dashboard. Check back soon.</p>`;
    }
    return `<div class="me-card me-buddy"><p class="me-label">Study buddy</p>${body}</div>`;
  }

  function classCard() {
    const c = state.data.class;
    if (!c || currentWeek < 0) return "";
    const body = c.confidence != null
      ? `<div class="me-stats me-stats-3"><span><strong>${c.checkins}/${c.students}</strong>checked in</span><span><strong>${c.confidence}</strong>avg confidence</span><span><strong>${c.hours ?? "–"}</strong>avg hours</span></div>
         <p class="me-small">${c.read} of ${c.students} have done this week's lessons. ${c.confidence < 3 ? "A tough week for everyone, so you're not alone. Bring your questions on Monday." : "Nice work, everyone."}</p>`
      : `<p>${c.checkins} of ${c.students} have checked in for week ${c.week} so far. Class averages show up once a few more people have.</p>`;
    return `<div class="me-card me-class"><p class="me-label">The class this week · anonymous</p><h2>How everyone's doing</h2>${body}</div>`;
  }

  function askCard() {
    if (finished) return "";
    return `<div class="me-card me-ask" id="ask"><p class="me-label">Ask anonymously</p><h2>Stuck on something?</h2>
      <p>Ask a question for the next session. Your name is never shown with it, not even to the organisers. We answer it on Monday.</p>
      <form id="me-ask"><label class="me-field"><span class="me-sr">Your question</span><textarea name="text" rows="3" maxlength="800" required placeholder="e.g. Why does the witness not count towards the txid?"></textarea></label>
      <div class="me-row"><button class="button small" type="submit">Send question</button>${state.data.asked ? `<span class="me-small">You've asked ${state.data.asked} this week.</span>` : ""}</div></form></div>`;
  }

  function nextCard() {
    const links = [
      ["Code Review Club", "Review real Bitcoin pull requests together every week.", "https://discord.gg/6XPJ96sCY4?event=1545332635348246528"],
      ["Privacy Track", "PayJoin, Silent Payments, ecash: every 1st and 3rd Tuesday.", "/privacy-track"],
      ["Fellowships", "Get paid to work on open-source Bitcoin projects.", "/fellowships"],
      ["Your certificate", "Finish the cohort and get a certificate to share.", "/certificates/sample"],
    ];
    return `<div class="me-card me-next"><p class="me-label">What next</p><h2>Keep going</h2><ul>${links.map(([t, s, h]) => `<li><a href="${h}"${h.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}><b>${t} →</b><span>${s}</span></a></li>`).join("")}</ul></div>`;
  }

  function followupCard() {
    if (!followupMonths) return "";
    const a = state.data.followups?.[followupMonths] || {};
    const statuses = ["Building something on Bitcoin", "Contributing to open source", "Working in Bitcoin", "Still learning", "Taking a break"];
    return `<div class="me-card me-wide me-followup" id="followup">
      <p class="me-label">${followupMonths === 12 ? "One year" : `${followupMonths} months`} on</p>
      <h2>How's it going?</h2>
      <form id="me-followup">
        <fieldset class="me-pills"><legend>Right now I'm mostly…</legend>${statuses.map((s) => `<label><input type="radio" name="status" value="${esc(s)}"${a.status === s ? " checked" : ""}><span>${esc(s)}</span></label>`).join("")}</fieldset>
        <label class="me-field">What have you been up to?<textarea name="doing" rows="3" maxlength="1000">${esc(a.doing || "")}</textarea></label>
        <label class="me-field">Any open-source contributions, projects or new roles?<textarea name="contributions" rows="2" maxlength="1000">${esc(a.contributions || "")}</textarea></label>
        <label class="me-field">Links (GitHub, PRs, projects)<input type="text" name="links" maxlength="600" value="${esc(a.links || "")}" placeholder="https://github.com/…"></label>
        <label class="me-field">What would help you take the next step?<textarea name="wish" rows="2" maxlength="1000">${esc(a.wish || "")}</textarea></label>
        <label class="me-field">One line about the cohort<input type="text" name="quote" maxlength="600" value="${esc(a.quote || "")}"></label>
        <label class="me-help"><input type="checkbox" name="share"${a.share ? " checked" : ""}> You can quote me on codeorange.dev</label>
        <button class="button small" type="submit">Send</button>
      </form>
    </div>`;
  }

  function linkCard() {
    const link = `${location.origin}/decoding-bitcoin/me?me=${encodeURIComponent(state.token)}`;
    return `<div class="me-card me-wide me-link"><p>Your personal link signs you in on any device. Keep it private.</p><code>${esc(link)}</code><div class="me-row"><button type="button" class="ghost small" data-copy="${esc(link)}">Copy link</button><button type="button" class="me-signout" data-signout>Not you? Sign out</button></div></div>`;
  }

  function render() {
    const s = stats();
    const first = state.me.name.split(" ")[0];
    $("#me-hello").textContent = `Hi ${first}.`;
    $("#me-sub").textContent = finished
      ? "The cohort's done. Here's everything you did."
      : currentWeek < 0
        ? `We start ${dayLabel(plus8(sessionDates[0]))}. Set your goals and rate your skills so you can see how far you come.`
        : `Week ${currentWeek + 1} of ${C.weeks.length}. ${s.streak >= 2 ? `${s.streak}-week streak, keep it going!` : "One step at a time."}`;
    const cards = currentWeek < 0
      ? [followupCard(), nextCardTop(s), goalsCard(), skillsCard(), thisWeekCard(), progressCard(s), buddyCard(), checkinCard(), askCard(), nextCard(), linkCard()]
      : [followupCard(), nextCardTop(s), thisWeekCard(), checkinCard(), progressCard(s), classCard() || askCard(), buddyCard(), classCard() ? askCard() : "", goalsCard(), skillsCard(), nextCard(), linkCard()];
    $("#me-app").innerHTML = cards.join("");
    bind();
    if (followupMonths) $("#followup")?.scrollIntoView({ block: "start" });
  }

  function formObj(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function bind() {
    const app = $("#me-app");
    app.querySelectorAll(".me-tick").forEach((b) => b.addEventListener("click", async () => {
      const item = b.dataset.item;
      const done = !state.done.has(item);
      done ? state.done.add(item) : state.done.delete(item);
      render();
      try {
        await post(COHORT_API, { action: "done", token: state.token, item, done });
        if (done) toast("Nice, ticked off.");
      } catch (err) {
        done ? state.done.delete(item) : state.done.add(item);
        render();
        toast(err.message);
      }
    }));
    $("#me-checkin")?.week?.addEventListener("change", (e) => { checkinCard.week = Number(e.target.value); render(); $("#checkin")?.scrollIntoView({ block: "start" }); });
    $("#me-checkin")?.addEventListener("submit", (e) => save(e, async () => {
      const f = formObj(e.target);
      const body = { action: "checkin", token: state.token, week: Number(f.week), confidence: f.confidence ? Number(f.confidence) : null, hours: f.hours === "" ? null : Number(f.hours), clicked: f.clicked, blocked: f.blocked, help: !!f.help, attended: f.attended ? f.attended === "yes" : null };
      await post(API, body);
      const rest = state.data.checkins.filter((c) => c.week !== body.week);
      state.data.checkins = [...rest, { ...body, at: new Date().toISOString() }].sort((a, b) => a.week - b.week);
      state.shareText = body.clicked && body.clicked.length > 8 ? body.clicked : "";
      return body.help ? "Saved. An organiser will reach out on Discord soon." : "Check-in saved. Thank you!";
    }));
    const profileBody = (extra) => {
      const p = state.data.profile || {};
      return { action: "profile", token: state.token, why: p.why || "", build: p.build || "", goal: p.goal || "", github: p.github || "", experience: p.experience || "", ...extra };
    };
    $("#me-profile")?.addEventListener("submit", (e) => save(e, async () => {
      const f = formObj(e.target);
      const body = profileBody({ why: f.why, build: f.build, goal: f.goal, github: f.github.trim(), experience: f.experience || "" });
      await post(API, body);
      state.data.profile = { ...(state.data.profile || {}), why: body.why, build: body.build, goal: body.goal, github: body.github.replace(/^@|^(https?:\/\/)?(www\.)?github\.com\//i, "").replace(/\/.*$/, ""), experience: body.experience };
      return "Goals saved.";
    }));
    $("#me-skills")?.addEventListener("submit", (e) => save(e, async () => {
      const f = formObj(e.target);
      const ratings = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]));
      if (!Object.keys(ratings).length) throw new Error("Rate at least one topic.");
      const key = e.target.dataset.which === "end" ? "skillsEnd" : "skillsStart";
      await post(API, profileBody({ [key]: ratings }));
      state.data.profile = { ...(state.data.profile || {}), [key]: ratings };
      return "Skill map saved.";
    }));
    $("#me-followup")?.addEventListener("submit", (e) => save(e, async () => {
      const f = formObj(e.target);
      await post(API, { action: "followup", token: state.token, months: followupMonths, answer: { ...f, share: !!f.share } });
      state.data.followups = { ...(state.data.followups || {}), [followupMonths]: { ...f, share: !!f.share } };
      return "Thank you! We read every one.";
    }));
    app.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", (e) => {
      const el = e.currentTarget;
      navigator.clipboard?.writeText(el.dataset.copy).then(() => toast(el.dataset.copyMsg || "Link copied."), () => toast("Couldn't copy. Select the text and copy it."));
    }));
    $("#me-ask")?.addEventListener("submit", (e) => save(e, async () => {
      await post(API, { action: "ask", token: state.token, text: e.target.text.value });
      state.data.asked = (state.data.asked || 0) + 1;
      return "Sent anonymously. We'll pick it up on Monday.";
    }));
    app.querySelector("[data-signout]")?.addEventListener("click", () => { store.set(""); state.token = ""; renderSignedOut(); });
  }

  async function save(e, fn) {
    e.preventDefault();
    if (state.busy) return;
    state.busy = true;
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const msg = await fn();
      render();
      toast(msg);
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    } finally {
      state.busy = false;
    }
  }

  load();
})();
