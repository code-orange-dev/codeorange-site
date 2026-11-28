// Decoding Bitcoin personal dashboard (/decoding-bitcoin/me): this week, weekly check-in,
// goals, skill map, study buddy, progress and badges, and alumni follow-ups.
// Curriculum and dates come from cohort.js; data from /api/cohort-me and /api/mastering-bitcoin.
(() => {
  const C = window.MB_COHORT;
  const Q = window.MB_QUIZ || { weeks: [], check: [] };
  // Shuffle each question's options in a fixed order (seeded by the question), so the right
  // answer isn't always in the same place but stays put between visits.
  Q.weeks.forEach((wk) => wk.forEach((x) => {
    let h = 0;
    for (const ch of x.q) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const order = x.options.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
      const j = Math.floor((h / 4294967296) * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    x.answer = order.indexOf(x.answer);
    x.options = order.map((i) => x.options[i]);
  }));
  const API = "/api/cohort-me";
  const COHORT_API = "/api/mastering-bitcoin";
  const TOKEN_KEY = "mb-token";
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const listJoin = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}` : a.join(""));
  // Exercises are plain text or { text, url, label } (a link to where you do it).
  const exText = (e) => (typeof e === "string" ? e : e.text);
  const exLink = (e) => (e && e.url ? `<a class="me-exlink" href="${esc(e.url)}" target="_blank" rel="noopener">Open ${esc(e.label || "it")} ↗</a>` : "");
  // Questions you own that get discussed at week `wk`'s session (C.discussAt = { 1: 2 }: week 1's questions in week 2's session).
  function questionsFor(wk, assigned) {
    return Object.keys(assigned).filter((k) => /^w\d+-q\d+$/.test(k) && owns(assigned[k], state.me.id)).filter((k) => { const qw = Number(k.slice(1, k.indexOf("-"))); return ((C.discussAt || {})[qw] || qw) === wk; })
      .map((k) => { const qw = Number(k.slice(1, k.indexOf("-"))), qi = Number(k.split("-q")[1]); return { key: k, week: qw, n: qi, text: C.weeks[qw - 1].questions[qi - 1], with: assigned[k].name.includes(" & ") ? assigned[k].name : "" }; });
  }
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
    while (w < sessionDates.length - 1 && now > sessionDates[w].getTime() + 2 * 36e5) w++;
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
  // Manual question owners (C.assigned in cohort.js), e.g. after a session: "w1-q1": ["andywong31"].
  // A name can list aliases with "|" (Discord name|sign-up name). Matched to the roster by name,
  // and to the signed-in student by their Discord name or name. Overrides the round-robin.
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const owns = (who, id) => !!who && id != null && (who.ids ? who.ids.includes(id) : who.id === id);
  function manualOwner(names) {
    const people = names.map((n) => {
      const keys = n.split("|").map(norm).filter(Boolean);
      const me = state.me && (keys.includes(norm(state.me.discord)) || keys.includes(norm(state.me.name))) ? state.me : null;
      const s = state.students.find((x) => (me && x.id === me.id) || keys.includes(norm(x.name)));
      return { id: s ? s.id : me ? me.id : null, name: n.split("|")[0].trim(), done: (s && s.done) || [] };
    });
    return { id: people[0].id, ids: people.map((p) => p.id).filter((x) => x != null), name: people.map((p) => p.name).join(" & "), done: [...new Set(people.flatMap((p) => p.done))], manual: true };
  }
  function applyManual(map) {
    Object.entries(C.assigned || {}).forEach(([item, names]) => { if (Array.isArray(names) && names.length) map[item] = manualOwner(names); });
    // Weeks with hand-picked owners skip the automatic seminar roles.
    Object.keys(C.assigned || {}).forEach((item) => { const wk = item.split("-")[0]; (C.roles || []).forEach((_, ri) => { delete map[`${wk}-role${ri}`]; }); });
    return map;
  }
  function assignments() {
    const map = {};
    if (!state.rosterVisible) return map;
    // Round-robin owners only when C.autoAssign is on; otherwise owners come from C.assigned (picked after each session).
    if (C.autoAssign === false) return applyManual(map);
    const roles = C.roles || [];
    let k = 0, r = 0;
    C.weeks.forEach((w, wi) => {
      const opens = weekOpens(wi);
      const locked = now >= opens ? state.students.filter((s) => !s.joined || s.joined < opens) : [];
      const pool = locked.length ? locked : state.students;
      w.questions.forEach((_, qi) => { map[`w${wi + 1}-q${qi + 1}`] = pool.length ? pool[k % pool.length] : null; k++; });
      roles.slice(0, pool.length).forEach((_, ri) => { map[`w${wi + 1}-role${ri}`] = pool[r % pool.length]; r++; });
    });
    return applyManual(map);
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
      ["🔥", "On a roll", "3 weeks in a row", s.streak >= 3],
      ["🛠️", "Hands on", "Finished 10 exercises", s.exDone >= 10],
      ["⛰️", "Halfway", "Lessons done for 5 weeks", s.lessons >= 5],
      ["🧠", "Quiz whiz", "Got every question right in a weekly quiz", Object.entries(d.quizzes || {}).some(([k, x]) => k.startsWith("w") && x.best === x.total)],
      ["🚀", "Shipped", "Shared your final project", !!d.project],
      ["🎓", "Graduate", "Lessons done for all 10 weeks", s.lessons >= C.weeks.length],
    ];
    return list.map(([icon, name, why, got]) => `<li class="${got ? "is-got" : ""}" title="${esc(why)}"><span aria-hidden="true">${icon}</span><b>${esc(name)}</b><small>${esc(why)}</small></li>`).join("");
  }

  function certBox(s, compact) {
    const need = { lessons: 8, checkins: 6, exercises: 22, ...(state.data.certificate || {}) };
    // Required exercises are the ones in non-intro weeks.
    const reqEx = [...state.done].filter((k) => { const m = /^w(\d+)-e\d+$/.exec(k); return m && C.weeks[m[1] - 1] && !C.weeks[m[1] - 1].intro; }).length;
    const parts = [
      ["Lessons", Math.min(s.lessons, need.lessons), need.lessons, "weeks"],
      ["Exercises", Math.min(reqEx, need.exercises), need.exercises, "done"],
    ];
    const pct = Math.round((parts.reduce((a, [, h, n]) => a + h / n, 0) / parts.length) * 100);
    const got = parts.every(([, h, n]) => h >= n);
    const rows = parts.map(([label, h, n, unit]) => `<li class="${h >= n ? "is-got" : ""}"><b>${label}</b><span class="me-bar"><i style="width:${Math.round((h / n) * 100)}%"></i></span><small>${h}/${n} ${unit}</small></li>`).join("");
    return `<div class="me-cert${got ? " is-got" : ""}${compact ? " me-card me-wide" : ""}" id="cert"><div class="me-row"><b>${got ? "🎓 You've earned your certificate!" : "Your certificate"}</b><span>${pct}%</span></div>
      <span class="me-bar"><i style="width:${pct}%"></i></span>
      <ul class="me-cert-parts">${rows}</ul>
      <small>${got ? "We'll send it after graduation. Add your GitHub username in your goals so it shows on it." : `To earn it: lessons for ${need.lessons} of 10 weeks and ${need.exercises} of the 27 exercises (weeks 2–10). Missed a Monday? Post your work on Discord and it counts. <a href="/certificates/sample">See a sample</a>`}</small></div>`;
  }

  // "I finished week N": a shareable image for X / Nostr (drawn by share-card.js), linking back to sign-up.
  function finishedWeek() {
    let f = 0;
    C.weeks.forEach((_, i) => { if (state.done.has(`w${i + 1}-r1`)) f = i + 1; });
    return f;
  }
  const SHARE_URL = (n) => `https://codeorange.dev/decoding-bitcoin?ref=week${n}`;
  const shareText = (n) => `I just finished week ${n} of 10 of Decoding Bitcoin: ${C.weeks[n - 1].title}. Free study cohort, Mondays on Discord, join anytime.`;
  function shareCard() {
    const n = finishedWeek();
    if (!n || !window.MBShareCard) return "";
    return `<div class="me-card me-wide me-brag" id="share-week">
      <div class="me-brag-text"><p class="me-label">Week ${n} done · share it</p>
      <h2>Tell people you finished week ${n}.</h2>
      <p class="me-small">One tap makes your image. Post it on X or Nostr: it keeps you going, and brings friends into the cohort.</p>
      <div class="me-brag-btns"><button class="button small" type="button" data-brag="share">Share my week ${n} image</button><a class="ghost small" target="_blank" rel="noopener" href="https://x.com/intent/post?${new URLSearchParams({ text: shareText(n), url: SHARE_URL(n) })}">Post on X</a><button class="ghost small" type="button" data-brag="nostr">Copy for Nostr</button></div></div>
      <img class="me-brag-img" alt="Your week ${n} share image" hidden>
    </div>`;
  }
  async function bragImage() {
    const n = finishedWeek(), w = C.weeks[n - 1];
    const blob = await window.MBShareCard.make({ week: n, weeks: C.weeks.length, title: w.title, name: (state.me && state.me.name) || "", topics: (w.lessons || []).map((l) => l.title.replace(/^Optional:\s*/, "")) });
    return { n, blob, file: new File([blob], `decoding-bitcoin-week-${n}.png`, { type: "image/png" }) };
  }
  async function brag(kind, btn) {
    if (kind === "nostr") {
      const n = finishedWeek();
      try { await navigator.clipboard.writeText(`${shareText(n)} ${SHARE_URL(n)} #bitcoin #DecodingBitcoin`); toast("Copied. Paste it into your Nostr app, and attach your image."); } catch (e) { toast("Couldn't copy on this device."); }
      return;
    }
    btn.disabled = true;
    try {
      const { n, blob, file } = await bragImage();
      const img = document.querySelector(".me-brag-img");
      if (img) { img.src = URL.createObjectURL(blob); img.hidden = false; }
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], text: `${shareText(n)} ${SHARE_URL(n)}` }); return; } catch (e) { if (e && e.name === "AbortError") return; }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
      toast("Image saved. Attach it to your post on X or Nostr.");
    } catch (e) { toast("Couldn't make the image on this device."); }
    finally { btn.disabled = false; }
  }

  function weekStrip(s) {
    return C.weeks.map((w, i) => {
      const n = i + 1;
      const cls = [s.weeksActive.has(n) ? "is-done" : "", i === currentWeek ? "is-now" : "", i > currentWeek ? "is-later" : ""].join(" ");
      return `<li class="${cls}" title="${i > currentWeek ? `Week ${n} unlocks later` : `Week ${n}: ${esc(w.title)}`}"><span>${n}</span></li>`;
    }).join("");
  }

  function tick(item, label, after = "") {
    const done = state.done.has(item);
    return `<li class="${done ? "is-done" : ""}"><div class="me-tick" role="checkbox" tabindex="0" data-item="${item}" aria-checked="${done}"><span class="me-box" aria-hidden="true">${done ? "✓" : ""}</span><span>${label}</span></div>${after}</li>`;
  }

  // The one thing to do next, worked out from where the student is.
  function nextStep(s) {
    const d = state.data;
    const p = d.profile || {};
    const wk = currentWeek + 1;
    const go = (href, label) => `<a class="button small" href="${href}">${label}</a>`;
    if (followupMonths) return null;
    // Session day: within 14h before a session until it ends, joining it is the one thing to do.
    const live = !finished && sessionDates.find((t) => now > t.getTime() - 14 * 36e5 && now < t.getTime() + 90 * 6e4);
    if (live) return [now >= live.getTime() ? "The session is on now. Join us!" : "Session today. See you there!", `${sessionLine(live)} · live on Discord, cameras off is fine.`, `<a class="button small" href="${C.discordEvent || C.discord}" target="_blank" rel="noopener">Join the Discord event</a>`];
    const qs = currentWeek >= 0 ? questionsFor(wk, assignments()).filter((q) => !state.done.has(q.key)) : [];
    if (qs.length) return [`Prepare your question for Monday: Q${qs[0].n}.`, esc(qs[0].text), go("#my-question", "See my question")];
    if (!p.why && !p.build) return ["Start by writing down why you joined.", "People who name a goal are far more likely to finish.", go("#goals", "Set my goals")];
    if (!p.skillsStart) return ["Rate your starting skills.", "Thirty seconds now, and in week 9 you'll see exactly how far you've come.", go("#skills", "Rate my skills")];
    if (finished) return p.skillsEnd ? null : ["Rate your skills one last time.", "See how far you've come since the start.", go("#skills", "Rate again")];
    if (!d.quizzes?.pre && !finished && currentWeek < 2) return ["Take the 2-minute knowledge check.", "10 quick questions, not graded. You'll take it again at the end to see what you've learned.", go("#check", "Start the check")];
    if (currentWeek >= C.weeks.length - 2 && d.quizzes?.pre && !d.quizzes?.post) return ["Take the knowledge check again.", "Same 10 questions as at the start. See how far you've come.", go("#check", "Take it again")];
    if (currentWeek < 0) return ["You're all set for week 1.", `Lessons go up the week before. First session: ${sessionLine(sessionDates[0])}.`, go(`/assets/mastering-bitcoin/sessions.ics?v=20261114b`, "Add the sessions to my calendar")];
    if (C.weeks[currentWeek].intro && !state.done.has(`w${wk}-r1`)) return ["Week 1 is the intro week: no homework.", "Just come to Monday's session. Homework starts in week 2.", go("#week", "See week 1")];
    if (!state.done.has(`w${wk}-r1`)) return [`Do this week's lessons before Monday.`, esc(C.weeks[currentWeek].lessons.map((l) => l.title).join(", ")), go("#week", "See this week")];
    if (currentWeek >= C.weeks.length - 2 && !p.skillsEnd) return ["Rate your skills again.", "See how far you've come since the start.", go("#skills", "Rate again")];
    return ["You're on top of this week. 🙌", s.streak >= 2 ? `${s.streak}-week streak. See you Monday!` : "See you Monday!", ""];
  }
  function nextCardTop(s) {
    const n = nextStep(s);
    if (!n) return "";
    return `<div class="me-card me-wide me-nextstep"><div><p class="me-label">Your next step</p><h2>${n[0]}</h2><p>${n[1]}</p></div>${n[2]}</div>`;
  }

  // First visit: a 3-step "how this works", dismissed for good with one tap.
  const seen = { get() { try { return localStorage.getItem("mb-welcomed") === "1"; } catch { return true; } }, set() { try { localStorage.setItem("mb-welcomed", "1"); } catch {} } };
  function welcomeCard() {
    if (finished || followupMonths || seen.get()) return "";
    return `<div class="me-card me-wide me-welcome" id="welcome">
      <p class="me-label">Welcome · how this works</p>
      <h2>Four things a week.</h2>
      <ol class="me-steps">
        <li><b>1</b><span><strong>Do the lessons</strong> on Decoding Bitcoin and tick them off below.</span></li>
        <li><b>2</b><span><strong>Do the exercises.</strong> They are required for the certificate.</span></li>
        <li><b>3</b><span><strong>Prepare your question</strong> and explain it in about 3 minutes on Monday.</span></li>
        <li><b>4</b><span><strong>Join Monday's session</strong> on Discord, ${esc(utcLabel(sessionDates[0]))} / ${pad(plus8(sessionDates[0]).getUTCHours())}:00 UTC+8. Can't make it? Post on Discord and it counts.</span></li>
      </ol>
      <p class="me-small">This page is your personal link, no password. Bookmark it, or open it from any weekly email.</p>
      <button class="button small" type="button" data-welcome-ok>Got it</button>
    </div>`;
  }
  // Recordings and recaps: fill C.recordings[week] = { video, recap } in cohort.js after each session.
  function recordingBox(wi) {
    const r = (C.recordings || {})[wi + 1];
    if (!r || !(r.video || r.recap)) return "";
    const links = [r.video && `<a class="button small" href="${esc(r.video)}" target="_blank" rel="noopener">▶ Watch the recording</a>`, r.recap && `<a class="ghost small" href="${esc(r.recap)}" target="_blank" rel="noopener">Read the recap</a>`].filter(Boolean).join(" ");
    return `<div class="me-rec"><p class="me-label">Week ${wi + 1} session · missed it or want a rewatch?</p><div class="me-rec-links">${links}</div></div>`;
  }
  // The latest session that has finished (index), or -1.
  const lastHeld = () => { let i = -1; sessionDates.forEach((t, k) => { if (now > t.getTime() + 90 * 6e4) i = k; }); return i; };

  function thisWeekCard() {
    if (finished) {
      return `<div class="me-card"><p class="me-label">The cohort</p><h2>You made it to the end 🎉</h2><p>All 10 weeks are done. Fill in your end-of-cohort skill map below, then pick a next step.</p><a class="ghost small" href="/decoding-bitcoin/curriculum">Look back at the weeks</a></div>`;
    }
    const wi = Math.max(0, currentWeek);
    const wk = wi + 1;
    const w = C.weeks[wi];
    const assigned = assignments();
    const myQs = questionsFor(wk, assigned);
    const roles = w.intro ? [] : (C.roles || []).filter((_, ri) => owns(assigned[`w${wk}-role${ri}`], state.me.id));
    const before = currentWeek < 0;
    const items = [
      tick(`w${wk}-r1`, `${w.intro ? "Optional, after the session: read the lesson" : "Do the lesson"}${w.lessons.length > 1 ? "s" : ""}: ${w.lessons.map((l) => `<a href="${lessonUrl(l.slug)}" target="_blank" rel="noopener">${esc(l.title)}</a>`).join(", ")}`),
      ...w.exercises.map((ex, ei) => tick(`w${wk}-e${ei + 1}`, `${w.intro ? "Warm-up exercise" : "Exercise"} ${ei + 1}: ${esc(exText(ex))}`, exLink(ex))),
    ].join("");
    return `<div class="me-card me-week" id="week">
      <p class="me-label">${before ? "Coming up · week 1" : `This week · week ${wk} of ${C.weeks.length}`}</p>
      <h2>${esc(w.title)}</h2>
      <p class="me-when">${now > sessionDates[wi].getTime() + 90 * 6e4 ? "Session held" : "Next session"}: <strong>${esc(sessionLine(sessionDates[wi]))}</strong> on <a href="${C.discord}" target="_blank" rel="noopener">Discord</a></p>
      ${roles.length ? `<p class="me-role">On Monday you're the <strong>${roles.map((r) => esc(r.name)).join("</strong> and <strong>")}</strong>. ${esc(roles[0].job)}</p>` : ""}
      ${myQs.length ? `<div class="me-myq" id="my-question"><p class="me-label">Your question${myQs.length > 1 ? "s" : ""} for Monday</p>${myQs.map((q) => `<p class="me-myq-text">Q${q.n}${q.week !== wk ? ` (week ${q.week})` : ""}: ${esc(q.text)}</p>${q.with ? `<p class="me-small">Shared by ${esc(q.with)}: prepare it together.</p>` : ""}`).join("")}<p class="me-small">Be ready to explain it in a few minutes on Monday. Post your answer in the cohort channel on Discord before the session.</p><ul class="me-check">${myQs.map((q) => tick(q.key, `Q${q.n}: I've prepared my answer and posted it on Discord`)).join("")}</ul></div>` : ""}
      ${w.intro ? `<p class="me-role"><strong>Intro week: no homework.</strong> ${esc(w.introNote || "")}</p>` : `<p class="me-role"><strong>Exercises are required for the certificate.</strong> Missed Monday? Post your work on Discord and it counts.</p>`}
      ${lastHeld() >= 0 ? recordingBox(lastHeld()) : ""}
      <p class="me-open">Opening question: <em>${esc(w.opening)}</em></p>
      <ul class="me-check">${items}</ul>
      ${w.practice ? `<a class="button small me-practice" href="${esc(w.practice)}" target="_blank" rel="noopener">Do this week's exercises on Decoding Bitcoin ↗</a>` : ""}
      <p class="me-jumps"><a class="me-jump" href="/decoding-bitcoin/curriculum#week-${wk}">Open week ${wk} in the weekly plan →</a> <a class="me-jump" href="/assets/mastering-bitcoin/sessions.ics?v=20261114b" download="decoding-bitcoin-sessions.ics">Add sessions to my calendar</a></p>
    </div>`;
  }

  // Everyone's questions for the next session, with who owns each one (Discord names from cohort.js).
  function allQuestionsCard() {
    if (finished || currentWeek < 0) return "";
    const wk = currentWeek + 1;
    const keys = Object.keys(C.assigned || {}).filter((k) => { const m = /^w(\d+)-q(\d+)$/.exec(k); return m && (((C.discussAt || {})[m[1]] || Number(m[1])) === wk); });
    if (!keys.length) return "";
    const mine = new Set(questionsFor(wk, assignments()).map((q) => q.key));
    const rows = keys.map((k) => {
      const [, qw, qi] = /^w(\d+)-q(\d+)$/.exec(k);
      const names = C.assigned[k].map((n) => esc(n.split("|")[0].trim())).join(", ");
      return `<li class="${mine.has(k) ? "is-mine" : ""}"><b>Q${qi}</b><span>${esc(C.weeks[qw - 1].questions[qi - 1])}<small>${names}${mine.has(k) ? " · that's you" : ""}</small></span></li>`;
    }).join("");
    return `<div class="me-card me-wide" id="questions"><p class="me-label">Monday's questions · who has which</p><h2>${esc(dayLabel(plus8(sessionDates[currentWeek])))}</h2><ol class="me-allq">${rows}</ol><p class="me-small">Each group explains its question in about 3 minutes, then we all discuss it. Not on the list? Come anyway and join the discussion.</p></div>`;
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
      </div>
      <ol class="me-strip" aria-label="The 10 weeks">${weekStrip(s)}</ol>

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
    const wk = Math.max(1, Math.min(C.weeks.length, currentWeek + 1));
    let body;
    if (d.buddy) {
      const handle = d.buddy.discord ? `@${d.buddy.discord}` : d.buddy.name;
      body = `<h2>${esc(d.buddy.name)}</h2>
        <p>Discord: <strong>${esc(d.buddy.discord || "ask in the cohort channel")}</strong></p>
        <ol class="me-buddy-steps"><li><b>Say hi</b> on Discord this week.</li><li><b>15 minutes before Monday:</b> compare answers, unstick each other.</li><li><b>Nudge</b> each other to tick off the week.</li></ol>
        <ul class="me-check">${tick(`w${wk}-b1`, `We talked this week (week ${wk})`)}</ul>
        <div class="me-brag-btns"><button class="button small" type="button" data-buddy-hi="${esc(handle)}">Copy a hello message</button><a class="ghost small" href="${C.discord}" target="_blank" rel="noopener">Open Discord</a></div>
        <p class="me-small">A quick weekly chat keeps you both going. Only your names and Discord usernames are shared with each other.</p>`;
    } else if (Date.now() < from.getTime()) {
      body = `<h2>Coming ${esc(dayLabel(plus8(from)))}</h2><p>A week before the first session we'll pair you with another student. You'll keep each other going for the 10 weeks.</p>`;
    } else {
      body = `<h2>Finding your buddy…</h2><p>You'll be paired with the next classmate who opens their dashboard. Check back soon.</p>`;
    }
    return `<div class="me-card me-wide me-buddy" id="buddy"><p class="me-label">Your study buddy</p>${body}</div>`;
  }

  // ── Quizzes ──
  // One renderer for the weekly quizzes and the knowledge check. Answers are checked here in the
  // browser (it's practice), and only the score is saved.
  const quizState = {};
  function quizForm(id, questions) {
    const st = quizState[id];
    return `<form class="me-quiz" data-quiz="${id}">${questions.map((x, qi) => {
      const picked = st ? st.picked[qi] : null;
      return `<fieldset class="me-q${st ? (picked === x.answer ? " is-right" : " is-wrong") : ""}"><legend><b>${qi + 1}.</b> ${esc(x.q)}</legend>
        ${x.options.map((o, oi) => `<label class="${st && oi === x.answer ? "is-answer" : ""}${st && oi === picked && oi !== x.answer ? " is-picked" : ""}"><input type="radio" name="q${qi}" value="${oi}"${picked === oi ? " checked" : ""}${st ? " disabled" : ""} required><span>${esc(o)}</span></label>`).join("")}
        ${st ? `<p class="me-why">${picked === x.answer ? "✓ Right." : "✗ Not quite."} ${esc(x.why)}</p>` : ""}</fieldset>`;
    }).join("")}
    ${st ? (id === "pre" ? `<p class="me-score"><b>${st.score}/${questions.length}</b> That's your starting point. You'll take the same check in week 9.</p>` : `<div class="me-row"><p class="me-score"><b>${st.score}/${questions.length}</b> ${st.score === questions.length ? "Perfect! 🧠" : st.score >= questions.length * 0.75 ? "Nice work." : "Read the explanations, then try again."}</p><button type="button" class="ghost small" data-retry="${id}">Try again</button></div>`) : `<button class="button small" type="submit">Check my answers</button>`}</form>`;
  }

  function quizCard() {
    if (currentWeek < 0 || !Q.weeks.length) return "";
    const last = Math.min(C.weeks.length, currentWeek + 1);
    const wk = Number(quizCard.week) || last;
    const best = state.data.quizzes?.[`w${wk}`];
    const options = Array.from({ length: last }, (_, i) => {
      const b = state.data.quizzes?.[`w${i + 1}`];
      return `<option value="${i + 1}"${i + 1 === wk ? " selected" : ""}>Week ${i + 1}${b ? ` · ${b.best}/${b.total}` : ""}</option>`;
    }).join("");
    return `<div class="me-card me-wide me-quizcard" id="quiz"><div class="me-row"><div><p class="me-label">Weekly check · 5 questions · answers explained</p><h2>Test yourself on week ${wk}</h2></div><select aria-label="Quiz week" data-quiz-week>${options}</select></div>
      <p class="me-small">Recalling something is how it sticks. ${best ? `Your best: ${best.best}/${best.total} (${best.attempts} ${best.attempts === 1 ? "try" : "tries"}).` : "Only you see your score."}</p>
      ${quizForm(`w${wk}`, Q.weeks[wk - 1] || [])}</div>`;
  }

  function checkCard() {
    if (!Q.check.length) return "";
    const d = state.data.quizzes || {};
    const endOpen = finished || currentWeek >= C.weeks.length - 2;
    const id = endOpen && d.pre ? "post" : "pre";
    const questions = Q.check.map(([w, i]) => Q.weeks[w][i]);
    const pct = (x, k) => (x ? Math.round(((k === "first" ? x.first : x.best) / x.total) * 100) : null);
    const before = pct(d.pre, "first"), after = pct(d.post, "best");
    const compare = before != null
      ? `<div class="me-stats me-stats-3"><span><strong>${before}%</strong>at the start</span><span><strong>${after != null ? `${after}%` : "–"}</strong>at the end</span><span><strong>${after != null ? `${after - before >= 0 ? "+" : ""}${after - before}` : "–"}</strong>points gained</span></div>`
      : "";
    if (id === "pre" && d.pre && !quizState.pre) {
      return `<div class="me-card me-check-card" id="check"><p class="me-label">Knowledge check</p><h2>Your starting point: ${before}%</h2>${compare}<p class="me-small">You'll take the same 10 questions again in week 9. Most people jump a long way.</p></div>`;
    }
    return `<div class="me-card me-wide me-check-card" id="check"><p class="me-label">Knowledge check · 10 questions · not graded</p>
      <h2>${id === "pre" ? "Where are you starting from?" : "How much have you learned?"}</h2>
      <p class="me-small">${id === "pre" ? "Don't look anything up and don't worry about wrong answers: this is your starting point, and you'll take the same check at the end." : "The same 10 questions as at the start."}</p>
      ${compare}${quizForm(id, questions)}</div>`;
  }

  function projectCard() {
    const p = state.data.project;
    if (!p && currentWeek < 6 && !finished) return "";
    return `<div class="me-card me-wide me-project" id="project"><p class="me-label">Your final project</p>
      <h2>${p ? esc(p.title) : "Show what you built"}</h2>
      <p class="me-small">Your stack machine from week 8, your Taproot capstone, or anything you built along the way. A public repo is proof of work that employers and fellowship programmes look at. See the <a href="/decoding-bitcoin/projects">projects wall</a>.</p>
      <form id="me-project" class="me-project-form">
        <label class="me-field">Project name<input type="text" name="title" maxlength="100" required value="${esc(p?.title || "")}" placeholder="e.g. Script stack machine in Rust"></label>
        <label class="me-field">GitHub link<input type="url" name="repo" maxlength="300" value="${esc(p?.repo || "")}" placeholder="https://github.com/you/project"></label>
        <label class="me-field">Demo or write-up link <small class="me-small">(optional)</small><input type="url" name="demo" maxlength="300" value="${esc(p?.demo || "")}"></label>
        <label class="me-field">What it does, in a sentence or two<textarea name="about" rows="2" maxlength="500">${esc(p?.about || "")}</textarea></label>
        <label class="me-help"><input type="checkbox" name="share"${p?.share ? " checked" : ""}> Show it on the public projects wall with my name</label>
        <button class="button small" type="submit">${p ? "Update project" : "Save project"}</button>
      </form></div>`;
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
      ? [followupCard(), welcomeCard(), nextCardTop(s), goalsCard(), skillsCard(), checkCard(), thisWeekCard(), progressCard(s), buddyCard(), askCard(), nextCard(), linkCard()]
      : [followupCard(), welcomeCard(), nextCardTop(s), thisWeekCard(), allQuestionsCard(), buddyCard(), shareCard(), certBox(s, true), quizCard(),
        `<details class="me-more me-wide" id="more"><summary>More: progress, goals, skills</summary><div class="me-more-grid">`,
        progressCard(s), askCard(), projectCard(), checkCard(), goalsCard(), skillsCard(), nextCard(), linkCard(),
        `</div></details>`];
    $("#me-app").innerHTML = cards.join("");
    // Links like #goals may point inside the collapsed "More" section: open it first.
    if (!state.moreBound) $("#me-app").addEventListener("click", (e) => {
      const ok = e.target.closest("[data-welcome-ok]");
      if (ok) { seen.set(); ok.closest(".me-welcome")?.remove(); return; }
      const hi = e.target.closest("[data-buddy-hi]");
      if (hi) {
        const wk = Math.max(1, Math.min(C.weeks.length, currentWeek + 1));
        const msg = `Hey ${hi.dataset.buddyHi}! I'm your Decoding Bitcoin study buddy. Want to do a quick 15-minute call before Monday to go over week ${wk} and our questions?`;
        navigator.clipboard.writeText(msg).then(() => toast("Copied. Paste it in a Discord message to your buddy."), () => toast(msg));
        return;
      }
      const bb = e.target.closest("[data-brag]");
      if (bb) { brag(bb.dataset.brag, bb); return; }
      const a = e.target.closest('a[href^="#"]');
      const t = a && document.getElementById(a.getAttribute("href").slice(1));
      const box = t && t.closest("details.me-more");
      if (box && !box.open) { box.open = true; e.preventDefault(); t.scrollIntoView({ block: "start", behavior: "smooth" }); }
    });
    state.moreBound = true;
    bind();
    const bimg = document.querySelector(".me-brag-img");
    if (bimg) bragImage().then(({ blob }) => { bimg.src = URL.createObjectURL(blob); bimg.hidden = false; }).catch(() => {});
    if (followupMonths) $("#followup")?.scrollIntoView({ block: "start" });
  }

  function formObj(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function bind() {
    const app = $("#me-app");
    // A link inside a to-do opens the link only; it must not tick the box.
    app.querySelectorAll(".me-tick").forEach((b) => b.addEventListener("keydown", (e) => {
      if (e.target === b && (e.key === " " || e.key === "Enter")) { e.preventDefault(); b.click(); }
    }));
    app.querySelectorAll(".me-tick").forEach((b) => b.addEventListener("click", async (e) => {
      if (e.target.closest("a")) return;
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
    app.querySelectorAll("form[data-quiz]").forEach((f) => f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = f.dataset.quiz;
      const questions = id.startsWith("w") ? Q.weeks[Number(id.slice(1)) - 1] : Q.check.map(([w, i]) => Q.weeks[w][i]);
      const picked = questions.map((_, qi) => (f[`q${qi}`].value === "" ? null : Number(f[`q${qi}`].value)));
      const score = picked.filter((v, qi) => v === questions[qi].answer).length;
      quizState[id] = { picked, score };
      const prev = state.data.quizzes?.[id];
      state.data.quizzes = { ...(state.data.quizzes || {}), [id]: id === "pre" && prev ? prev : { best: Math.max(prev?.best ?? 0, score), last: score, total: questions.length, attempts: (prev?.attempts || 0) + 1, first: prev ? prev.first : score } };
      render();
      $(`form[data-quiz="${id}"]`)?.scrollIntoView({ block: "start" });
      try { await post(API, { action: "quiz", token: state.token, quiz: id, score, total: questions.length }); } catch (err) { toast(err.message); }
    }));
    app.querySelectorAll("[data-retry]").forEach((b) => b.addEventListener("click", () => { delete quizState[b.dataset.retry]; render(); $(`form[data-quiz="${b.dataset.retry}"]`)?.scrollIntoView({ block: "start" }); }));
    app.querySelector("[data-quiz-week]")?.addEventListener("change", (e) => { quizCard.week = Number(e.target.value); render(); $("#quiz")?.scrollIntoView({ block: "start" }); });
    $("#me-project")?.addEventListener("submit", (e) => save(e, async () => {
      const f = formObj(e.target);
      const body = { title: f.title, repo: f.repo, demo: f.demo, about: f.about, share: !!f.share };
      await post(API, { action: "project", token: state.token, ...body });
      state.data.project = body;
      return body.share ? "Saved. It's on the projects wall." : "Project saved.";
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
