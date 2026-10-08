// Mastering Bitcoin study cohort dashboard: curriculum, question assignments,
// sign-up form and "done" ticks. Settings and curriculum live in cohort.js.
(() => {
  const C = window.MB_COHORT;
  const API = "/api/mastering-bitcoin";
  const TOKEN_KEY = "mb-token";
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const pad = (n) => String(n).padStart(2, "0");
  const chapterUrl = (file) => `https://github.com/bitcoinbook/bitcoinbook/blob/develop/${file}`;

  const store = {
    get() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } },
    set(v) { try { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); } catch {} },
  };

  // A personal link (?me=TOKEN) signs the student in on any device.
  const params = new URLSearchParams(location.search);
  if (params.get("me")) {
    store.set(params.get("me"));
    params.delete("me");
    history.replaceState(null, "", location.pathname + (params.toString() ? `?${params}` : "") + location.hash);
  }

  const state = { token: store.get(), students: [], me: null, online: false, loaded: false, open: new Set() };

  // ── Dates ──
  const sessionDates = C.weeks.map((_, i) => {
    if (!C.startDate) return null;
    const [y, m, d] = C.startDate.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + 7 * i, C.sessionUtcHour));
  });
  const fmtDay = (d) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Singapore" });
  const fmtLocal = (d) => d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  const currentWeek = (() => {
    if (!C.startDate) return -1;
    const now = Date.now();
    if (now < sessionDates[0] - 7 * 864e5) return -1;
    let w = 0;
    // A week stays "current" until a day after its session.
    while (w < sessionDates.length - 1 && now > sessionDates[w].getTime() + 864e5) w++;
    return w;
  })();
  if (currentWeek >= 0) state.open.add(currentWeek); else state.open.add(0);

  // ── Assignments: questions go round-robin through the roster (in sign-up order),
  // carrying on from week to week so everyone gets an even share. ──
  function assignments() {
    const map = {};
    const n = state.students.length;
    let k = 0;
    C.weeks.forEach((w, wi) =>
      w.questions.forEach((_, qi) => {
        map[`w${wi + 1}-q${qi + 1}`] = n ? state.students[k % n] : null;
        k++;
      })
    );
    return map;
  }

  const isDone = (student, item) => !!student && student.done.includes(item);
  const meStudent = () => state.me && state.students.find((s) => s.id === state.me.id);

  // ── Rendering ──
  function tickButton(item, done, label) {
    return `<button type="button" class="mb-tick${done ? " is-done" : ""}" data-item="${item}" aria-pressed="${done}" aria-label="${esc(label)}">
      <span class="mb-box" aria-hidden="true">${done ? "✓" : ""}</span><span>${done ? "Done" : "Mark done"}</span></button>`;
  }

  function renderWeeks() {
    const assigned = assignments();
    const me = meStudent();
    $("#mb-weeks").innerHTML = C.weeks
      .map((w, wi) => {
        const wk = wi + 1;
        const date = sessionDates[wi];
        const chapters = w.chapters
          .map((c) => `<a href="${chapterUrl(c.file)}" target="_blank" rel="noopener">Ch ${c.n} · ${esc(c.title)}</a>`)
          .join("");
        const extra = (w.extra || [])
          .map((c) => `<a class="is-extra" href="${chapterUrl(c.file)}" target="_blank" rel="noopener">Optional: Ch ${c.n} · ${esc(c.title)}</a>`)
          .join("");
        const questions = w.questions
          .map((q, qi) => {
            const item = `w${wk}-q${qi + 1}`;
            const who = assigned[item];
            const mine = me && who && who.id === me.id;
            const done = isDone(who, item);
            const whoLabel = who
              ? `<span class="mb-who${mine ? " is-me" : ""}${done ? " is-done" : ""}">${done ? "✓ " : ""}${mine ? "You" : esc(who.name)}</span>`
              : `<span class="mb-who is-empty">Assigned at sign-up</span>`;
            return `<li class="${mine ? "is-mine" : ""}"><span class="mb-num">Q${qi + 1}</span><div><p>${esc(q)}</p><div class="mb-row">${whoLabel}${mine ? tickButton(item, done, `Mark question ${qi + 1} of week ${wk} done`) : ""}</div></div></li>`;
          })
          .join("");
        const exercises = w.exercises
          .map((e, ei) => {
            const item = `w${wk}-e${ei + 1}`;
            const count = state.students.filter((s) => s.done.includes(item)).length;
            return `<li><span class="mb-num">E${ei + 1}</span><div><p>${esc(e)}</p><div class="mb-row"><span class="mb-count">${count} done</span>${me ? tickButton(item, isDone(me, item), `Mark exercise ${ei + 1} of week ${wk} done`) : ""}</div></div></li>`;
          })
          .join("");
        const myQs = me ? w.questions.filter((_, qi) => assigned[`w${wk}-q${qi + 1}`]?.id === me.id).length : 0;
        return `<details class="mb-week${wi === currentWeek ? " is-current" : ""}" data-week="${wi}"${state.open.has(wi) ? " open" : ""}>
          <summary>
            <span class="mb-wk">Week ${pad(wk)}</span>
            <span class="mb-title">${esc(w.title)}${wi === currentWeek ? ' <span class="mb-now">This week</span>' : ""}${myQs ? ` <span class="mb-mine">${myQs} for you</span>` : ""}</span>
            <span class="mb-date">${date ? fmtDay(date) : "Date TBA"}</span>
          </summary>
          <div class="mb-week-body">
            <p class="mb-summary">${esc(w.summary)}</p>
            <div class="mb-chapters">${chapters}${extra}</div>
            ${date ? `<p class="mb-when">Session: ${fmtDay(date)}, 7pm UTC+8 · your time: ${fmtLocal(date)} · on Discord</p>` : ""}
            <div class="mb-cols">
              <div><h3>Discussion questions</h3><p class="mb-hint">Each question has one owner. Post your answer in the cohort channel on Discord before the session, then tick it done.</p><ol class="mb-list">${questions}</ol></div>
              <div><h3>Exercises</h3><p class="mb-hint">Everyone does these. Share what you got on Discord and tick each one off.</p><ol class="mb-list">${exercises}</ol></div>
            </div>
          </div>
        </details>`;
      })
      .join("");
  }

  function renderMe() {
    const me = meStudent();
    const box = $("#mb-me");
    if (!me) {
      box.hidden = true;
      return;
    }
    const assigned = assignments();
    const mine = Object.keys(assigned).filter((k) => assigned[k]?.id === me.id);
    const qDone = mine.filter((k) => me.done.includes(k)).length;
    const exTotal = C.weeks.reduce((n, w) => n + w.exercises.length, 0);
    const exDone = me.done.filter((k) => k.includes("-e")).length;
    const link = `${location.origin}${location.pathname}?me=${encodeURIComponent(state.token)}`;
    const focus = currentWeek >= 0 ? currentWeek : 0;
    const thisWeek = mine.filter((k) => k.startsWith(`w${focus + 1}-`));
    box.hidden = false;
    box.innerHTML = `<div class="mb-me-head"><div><p class="eyebrow">Your dashboard</p><h2>Hi ${esc(me.name)}.</h2></div>
      <div class="mb-me-stats"><span><strong>${qDone}/${mine.length}</strong> questions</span><span><strong>${exDone}/${exTotal}</strong> exercises</span></div></div>
      <p class="mb-me-week">${thisWeek.length ? `Week ${focus + 1}: you own ${thisWeek.map((k) => `Q${k.split("-q")[1]}`).join(" and ")}. ${thisWeek.every((k) => me.done.includes(k)) ? "All done, nice." : `Open week ${focus + 1} below to find ${thisWeek.length > 1 ? "them" : "it"}.`}` : `No questions for you in week ${focus + 1}. Do the exercises and join the discussion.`}</p>
      <div class="mb-link"><span>Your personal link (open it on any device to tick things off):</span><code>${esc(link)}</code><button type="button" class="ghost small" data-copy="${esc(link)}">Copy link</button><button type="button" class="mb-signout" data-signout>Not you? Sign out</button></div>`;
  }

  function renderRoster() {
    const assigned = assignments();
    const exTotal = C.weeks.reduce((n, w) => n + w.exercises.length, 0);
    $("#mb-count").textContent = state.loaded ? String(state.students.length) : "–";
    if (!state.students.length) {
      $("#mb-roster").innerHTML = `<p class="mb-empty">${state.online || !state.loaded ? "No one has signed up yet. Be the first." : "The roster appears here once sign-ups open."}</p>`;
      return;
    }
    const rows = state.students
      .map((s, i) => {
        const mine = Object.keys(assigned).filter((k) => assigned[k]?.id === s.id);
        const q = mine.filter((k) => s.done.includes(k)).length;
        const e = s.done.filter((k) => k.includes("-e")).length;
        const pct = Math.round(((q + e) / Math.max(1, mine.length + exTotal)) * 100);
        return `<div class="mb-roster-row${state.me && s.id === state.me.id ? " is-me" : ""}"><span class="mb-num">${pad(i + 1)}</span><span class="mb-name">${esc(s.name)}</span><span>${q}/${mine.length} Q</span><span>${e}/${exTotal} E</span><span class="mb-bar" aria-label="${pct}% done"><i style="width:${pct}%"></i></span></div>`;
      })
      .join("");
    $("#mb-roster").innerHTML = `<div class="mb-roster-row mb-roster-head"><span>#</span><span>Student</span><span><b class="mb-long">Questions</b><b class="mb-short">Q</b></span><span><b class="mb-long">Exercises</b><b class="mb-short">E</b></span><span>Progress</span></div>${rows}`;
  }

  function renderSignup() {
    const form = $("#mb-signup");
    const note = $("#mb-signup-note");
    const me = meStudent();
    if (me) {
      form.hidden = true;
      note.innerHTML = `You're signed up as <strong>${esc(me.name)}</strong>. See you on Discord, ${esc(C.sessionLabel)}.`;
      return;
    }
    const closed = state.loaded && (!state.online || !C.signupsOpen);
    form.hidden = false;
    form.querySelectorAll("input, button").forEach((el) => (el.disabled = closed));
    note.textContent = closed
      ? state.online ? "Sign-ups are closed for this cohort. Ask in Discord about the next one." : "Sign-ups open soon. Check back in a few days or ask in Discord."
      : "";
  }

  function render() {
    renderWeeks();
    renderMe();
    renderRoster();
    renderSignup();
  }

  // ── Data ──
  async function load() {
    try {
      const res = await fetch(API, { headers: state.token ? { "X-MB-Token": state.token } : {} });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load");
      state.students = data.students;
      state.me = data.me;
      state.online = true;
      if (state.token && !data.me) { store.set(""); state.token = ""; }
    } catch {
      state.online = false;
    }
    state.loaded = true;
    render();
  }

  async function post(body) {
    const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  function toast(msg) {
    const t = $("#mb-toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.hidden = true), 4200);
  }

  // ── Events ──
  document.addEventListener("click", async (ev) => {
    const tick = ev.target.closest(".mb-tick");
    if (tick) {
      const me = meStudent();
      if (!me) return;
      const item = tick.dataset.item;
      const done = !me.done.includes(item);
      me.done = done ? [...me.done, item] : me.done.filter((k) => k !== item);
      render();
      try {
        await post({ action: "done", token: state.token, item, done });
      } catch (err) {
        me.done = done ? me.done.filter((k) => k !== item) : [...me.done, item];
        render();
        toast(err.message);
      }
      return;
    }
    const copy = ev.target.closest("[data-copy]");
    if (copy) {
      try {
        await navigator.clipboard.writeText(copy.dataset.copy);
        toast("Link copied. Bookmark it or keep it somewhere safe.");
      } catch {
        toast("Select the link and copy it by hand.");
      }
      return;
    }
    if (ev.target.closest("[data-signout]")) {
      store.set("");
      state.token = "";
      state.me = null;
      render();
    }
  });

  document.addEventListener("toggle", (ev) => {
    const d = ev.target;
    if (!d.matches || !d.matches("details.mb-week")) return;
    const wi = Number(d.dataset.week);
    d.open ? state.open.add(wi) : state.open.delete(wi);
  }, true);

  $("#mb-signup").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const button = form.querySelector("button[type=submit]");
    const f = new FormData(form);
    button.disabled = true;
    button.textContent = "Signing you up…";
    try {
      const data = await post({
        action: "signup",
        name: f.get("name"),
        discord: f.get("discord"),
        email: f.get("email"),
        website: f.get("website"),
      });
      store.set(data.token);
      state.token = data.token;
      form.reset();
      await load();
      $("#mb-me").scrollIntoView({ behavior: "smooth", block: "start" });
      toast("You're in! Save your personal link so you can tick things off on any device.");
    } catch (err) {
      $("#mb-signup-note").textContent = err.message;
    } finally {
      button.disabled = false;
      button.textContent = "Sign me up";
    }
  });

  // ── Static bits ──
  const first = sessionDates[0];
  $("#mb-start").textContent = first ? fmtDay(first) : "TBA";
  $("#mb-start-label").textContent = first ? "Week 1 · 7pm UTC+8" : "Start date";
  document.querySelectorAll("[data-mb-start]").forEach((el) => {
    el.textContent = first ? `Starts ${fmtDay(first)}` : "Start date TBA";
  });

  render();
  load();
})();
