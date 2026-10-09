// Mastering Bitcoin study cohort dashboard: curriculum, question assignments,
// sign-up form and "done" ticks. Settings and curriculum live in cohort.js.
(() => {
  const C = window.MB_COHORT;
  document.documentElement.classList.add("mb-js");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const API = "/api/mastering-bitcoin";
  const TOKEN_KEY = "mb-token";
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const listJoin = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}` : a.join(""));
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

  const state = { token: store.get(), students: [], me: null, online: false, loaded: false, open: new Set(), popped: "" };

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
  // carrying on from week to week so everyone gets an even share. A week's owners
  // are fixed once that week opens (the previous Monday's session): people who join
  // later only pick up questions from weeks that haven't opened yet. ──
  const weekOpens = (wi) => (sessionDates[wi] ? sessionDates[wi].getTime() - 7 * 864e5 : Infinity);
  // Seminar roles rotate the same way, on their own counter, one person per role.
  const roles = C.roles || [];
  function assignments() {
    const map = {};
    const now = Date.now();
    let k = 0;
    let r = 0;
    C.weeks.forEach((w, wi) => {
      const opens = weekOpens(wi);
      const locked = now >= opens ? state.students.filter((s) => !s.joined || s.joined < opens) : [];
      const pool = locked.length ? locked : state.students;
      w.questions.forEach((_, qi) => {
        map[`w${wi + 1}-q${qi + 1}`] = pool.length ? pool[k % pool.length] : null;
        k++;
      });
      roles.slice(0, pool.length).forEach((_, ri) => {
        map[`w${wi + 1}-role${ri}`] = pool[r % pool.length];
        r++;
      });
    });
    return map;
  }
  const myRoles = (assigned, me, wk) => roles.filter((_, ri) => me && assigned[`w${wk}-role${ri}`]?.id === me.id);
  const readCount = (wk) => state.students.filter((s) => s.done.includes(`w${wk}-r1`)).length;

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
        const read = readCount(wk);
        const total = state.students.length;
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
            return `<li><span class="mb-num">E${ei + 1}</span><div><p>${esc(e)}</p><div class="mb-row"><span class="mb-count">${total ? `${count} of ${total} done` : "0 done"}</span>${me ? tickButton(item, isDone(me, item), `Mark exercise ${ei + 1} of week ${wk} done`) : ""}</div></div></li>`;
          })
          .join("");
        const myQs = me ? w.questions.filter((_, qi) => assigned[`w${wk}-q${qi + 1}`]?.id === me.id).length : 0;
        const roleChips = roles
          .map((role, ri) => {
            const who = assigned[`w${wk}-role${ri}`];
            const mine = me && who && who.id === me.id;
            return `<li class="${mine ? "is-mine" : ""}" title="${esc(role.job)}"><b>${esc(role.name)}</b><span>${who ? (mine ? "You" : esc(who.name)) : "Assigned at sign-up"}</span></li>`;
          })
          .join("");

        return `<details id="week-${wk}" class="mb-week${wi === currentWeek ? " is-current" : ""}" data-week="${wi}"${state.open.has(wi) ? " open" : ""}>
          <summary>
            <span class="mb-wk">Week ${pad(wk)}</span>
            <span class="mb-title">${esc(w.title)}${wi === currentWeek ? ' <span class="mb-now">This week</span>' : ""}${myQs ? ` <span class="mb-mine">${myQs} for you</span>` : ""}</span>
            <span class="mb-date">${date ? fmtDay(date) : "Date TBA"}</span>
          </summary>
          <div class="mb-week-body">
            <p class="mb-summary">${esc(w.summary)}</p>
            <div class="mb-chapters">${chapters}${extra}</div>
            ${date ? `<p class="mb-when">Session: ${fmtDay(date)}, 7–8:30pm UTC+8 · your time: ${fmtLocal(date)} · on Discord</p>` : ""}
            <div class="mb-read"><span class="mb-count">${total ? `${read} of ${total} have read it` : "Read it before Monday"}</span>${me ? tickButton(`w${wk}-r1`, isDone(me, `w${wk}-r1`), `I've read week ${wk}`).replace(/>Mark done</, ">I've read it<").replace(/>Done</, ">Read<") : ""}</div>
            <div class="mb-opening"><p class="mb-label">Opening question · everyone</p><p>${esc(w.opening)}</p></div>
            <div class="mb-roles-wrap"><p class="mb-label">Seminar roles this week</p><ul class="mb-roles">${roleChips}</ul></div>
            <div class="mb-cols">
              <div><h3>Discussion questions</h3><p class="mb-hint">Each question has one owner. Post your answer in the cohort channel on Discord before the session, then tick it done.</p><ol class="mb-list">${questions}</ol></div>
              <div><h3>Exercises</h3><p class="mb-hint">Everyone does these. Share what you got on Discord and tick each one off.</p><ol class="mb-list">${exercises}</ol></div>
            </div>
          </div>
        </details>`;
      })
      .join("");
  }

  // The 10-week rail above the accordion: your progress per week (or the cohort's
  // reading progress for visitors), with the current week highlighted.
  function renderRail() {
    const me = meStudent();
    const assigned = assignments();
    $("#mb-rail").innerHTML = C.weeks
      .map((w, wi) => {
        const wk = wi + 1;
        let pct;
        if (me) {
          const items = [`w${wk}-r1`, ...w.exercises.map((_, ei) => `w${wk}-e${ei + 1}`), ...w.questions.map((_, qi) => `w${wk}-q${qi + 1}`).filter((k) => assigned[k]?.id === me.id)];
          pct = (items.filter((k) => me.done.includes(k)).length / items.length) * 100;
        } else {
          pct = state.students.length ? (readCount(wk) / state.students.length) * 100 : 0;
        }
        const cls = wi === currentWeek ? "is-current" : currentWeek > wi ? "is-past" : "";
        return `<a href="#week-${wk}" class="${cls}" title="Week ${wk}: ${esc(w.title)} · ${Math.round(pct)}% ${me ? "done by you" : "of the cohort have read it"}"><i><b style="--p:${pct.toFixed(1)}%"></b></i><span>W${pad(wk)}${sessionDates[wi] ? `<em> · ${sessionDates[wi].toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Singapore" })}</em>` : ""}</span></a>`;
      })
      .join("");
  }

  // A small burst of orange confetti from an element, for finishing a week.
  function confetti(from) {
    if (reduceMotion || !from) return;
    const r = from.getBoundingClientRect();
    const colors = ["#F7931A", "#FFB347", "#27C93F", "#FFFFFF"];
    for (let i = 0; i < 28; i++) {
      const el = document.createElement("i");
      el.className = "mb-confetti";
      el.style.background = colors[i % colors.length];
      document.body.appendChild(el);
      const angle = (Math.PI * 2 * i) / 28 + Math.random() * 0.4;
      const dist = 70 + Math.random() * 110;
      el.animate(
        [
          { transform: `translate(${r.left + r.width / 2}px, ${r.top + r.height / 2}px) rotate(0)`, opacity: 1 },
          { transform: `translate(${r.left + r.width / 2 + Math.cos(angle) * dist}px, ${r.top + r.height / 2 + Math.sin(angle) * dist + 60}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
        ],
        { duration: 900 + Math.random() * 500, easing: "cubic-bezier(.2,.8,.2,1)" }
      ).onfinish = () => el.remove();
    }
  }

  function renderMe() {
    const me = meStudent();
    const box = $("#mb-me");
    if (!me) {
      box.hidden = true;
      return;
    }
    const assigned = assignments();
    const mine = Object.keys(assigned).filter((k) => k.includes("-q") && assigned[k]?.id === me.id);
    const qDone = mine.filter((k) => me.done.includes(k)).length;
    const exTotal = C.weeks.reduce((n, w) => n + w.exercises.length, 0);
    const exDone = me.done.filter((k) => k.includes("-e")).length;
    const link = `${location.origin}${location.pathname}?me=${encodeURIComponent(state.token)}`;
    const focus = currentWeek >= 0 ? currentWeek : 0;
    const thisWeek = mine.filter((k) => k.startsWith(`w${focus + 1}-`));
    box.hidden = false;
    box.innerHTML = `<div class="mb-me-head"><div><p class="eyebrow">Your dashboard</p><h2>Hi ${esc(me.name)}.</h2></div>
      <div class="mb-me-stats"><span><strong>${me.done.filter((k) => k.endsWith("-r1")).length}/${C.weeks.length}</strong> chapters read</span><span><strong>${qDone}/${mine.length}</strong> questions</span><span><strong>${exDone}/${exTotal}</strong> exercises</span></div></div>
      ${weekChecklist(me, assigned, focus, thisWeek)}
      <div class="mb-link"><span>Your personal link (open it on any device to tick things off):</span><code>${esc(link)}</code><button type="button" class="ghost small" data-copy="${esc(link)}">Copy link</button><button type="button" class="mb-signout" data-signout>Not you? Sign out</button></div>
      <div class="cta-row mb-me-cta"><a class="button small" href="${C.discord}" target="_blank" rel="noopener">Join the Discord</a>${first ? `<a class="ghost small" href="${esc(gcalHref())}" target="_blank" rel="noopener">Add to Google Calendar</a>` : ""}</div>`;
  }

  // "Before Monday" list for the student's current week: read, own questions, role, exercises.
  function weekChecklist(me, assigned, focus, thisWeek) {
    const wk = focus + 1;
    const w = C.weeks[focus];
    const exItems = w.exercises.map((_, ei) => `w${wk}-e${ei + 1}`);
    const exDone = exItems.filter((k) => me.done.includes(k)).length;
    const rolesNow = myRoles(assigned, me, wk);
    const line = (done, text) => `<li class="${done ? "is-done" : ""}"><span class="mb-box" aria-hidden="true">${done ? "✓" : ""}</span><span>${text}</span></li>`;
    const items = [
      line(me.done.includes(`w${wk}-r1`), `Read ${w.chapters.map((c) => `chapter ${c.n}`).join(" and ")}`),
      thisWeek.length
        ? line(thisWeek.every((k) => me.done.includes(k)), `Answer your question${thisWeek.length > 1 ? "s" : ""} (${listJoin(thisWeek.map((k) => `Q${k.split("-q")[1]}`))}) on Discord`)
        : "",
      line(exDone === exItems.length, `Do the exercises (${exDone} of ${exItems.length})`),
      rolesNow.length ? line(false, `On Monday you're the <strong>${rolesNow.map((r) => esc(r.name)).join("</strong> and <strong>")}</strong>: ${esc(rolesNow[0].job.charAt(0).toLowerCase() + rolesNow[0].job.slice(1))}`) : "",
      line(false, `Think about the opening question: <em>${esc(w.opening)}</em>`),
    ].join("");
    return `<div class="mb-me-week"><p class="mb-label">Week ${wk} · before ${sessionDates[focus] ? fmtDay(sessionDates[focus]) : "the session"}</p><ul class="mb-check">${items}</ul><a class="mb-jump" href="#week-${wk}">Open week ${wk} →</a></div>`;
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
        const mine = Object.keys(assigned).filter((k) => k.includes("-q") && assigned[k]?.id === s.id);
        const q = mine.filter((k) => s.done.includes(k)).length;
        const e = s.done.filter((k) => k.includes("-e")).length;
        const r = s.done.filter((k) => k.endsWith("-r1")).length;
        const pct = Math.round(((q + e + r) / Math.max(1, mine.length + exTotal + C.weeks.length)) * 100);
        return `<div class="mb-roster-row${state.me && s.id === state.me.id ? " is-me" : ""}"><span class="mb-num">${pad(i + 1)}</span><span class="mb-name">${esc(s.name)}</span><span>${r}/${C.weeks.length} R</span><span>${q}/${mine.length} Q</span><span>${e}/${exTotal} E</span><span class="mb-bar" aria-label="${pct}% done"><i style="width:${pct}%"></i></span></div>`;
      })
      .join("");
    $("#mb-roster").innerHTML = `<div class="mb-roster-row mb-roster-head"><span>#</span><span>Student</span><span><b class="mb-long">Read</b><b class="mb-short">R</b></span><span><b class="mb-long">Questions</b><b class="mb-short">Q</b></span><span><b class="mb-long">Exercises</b><b class="mb-short">E</b></span><span>Progress</span></div>${rows}`;
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
    renderRail();
    renderMe();
    renderRoster();
    renderSignup();
    if (state.popped) {
      document.querySelectorAll(`.mb-tick[data-item="${state.popped}"].is-done`).forEach((el) => el.classList.add("is-pop"));
      state.popped = "";
    }
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
      if (done) state.popped = item;
      render();
      if (done) {
        const wk = Number(item.slice(1).split("-")[0]);
        const w = C.weeks[wk - 1];
        const assigned = assignments();
        const items = [`w${wk}-r1`, ...w.exercises.map((_, ei) => `w${wk}-e${ei + 1}`), ...w.questions.map((_, qi) => `w${wk}-q${qi + 1}`).filter((k) => assigned[k]?.id === me.id)];
        if (items.every((k) => me.done.includes(k))) {
          confetti(document.querySelector(`.mb-tick[data-item="${item}"]`));
          toast(`Week ${wk} complete. Nice work!`);
        }
      }
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
    const jump = ev.target.closest(".mb-jump");
    if (jump) {
      const d = document.querySelector(jump.getAttribute("href"));
      if (d) { d.open = true; state.open.add(Number(d.dataset.week)); }
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

  // Smooth open/close for the weeks.
  document.addEventListener("click", (ev) => {
    const summary = ev.target.closest("details.mb-week > summary");
    if (!summary || reduceMotion) return;
    const d = summary.parentElement;
    const body = d.querySelector(".mb-week-body");
    if (!body || d.dataset.animating) return;
    ev.preventDefault();
    d.dataset.animating = "1";
    const done = () => { delete d.dataset.animating; body.style.height = ""; };
    if (!d.open) {
      d.open = true;
      const h = body.scrollHeight;
      body.animate([{ height: "0px", opacity: 0 }, { height: `${h}px`, opacity: 1 }], { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" }).onfinish = done;
    } else {
      const h = body.scrollHeight;
      body.animate([{ height: `${h}px`, opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 240, easing: "ease-in" }).onfinish = () => { d.open = false; done(); };
    }
  });
  // Rail links open the week they point to.
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest(".mb-rail a");
    if (!a) return;
    const d = document.querySelector(a.getAttribute("href"));
    if (d) { d.open = true; state.open.add(Number(d.dataset.week)); }
  });

  // Cursor-following glow on cards.
  const GLOW = ".mb-week, .stat, .mb-agenda ol li, .mb-role-list div, .feature-panel, .mb-roster";
  document.addEventListener("pointermove", (ev) => {
    const el = ev.target.closest && ev.target.closest(GLOW);
    if (!el) return;
    el.classList.add("mb-glow");
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${ev.clientX - r.left}px`);
    el.style.setProperty("--my", `${ev.clientY - r.top}px`);
  }, { passive: true });

  // The book tilts towards the cursor.
  const book = $(".mb-book");
  if (book && !reduceMotion && window.matchMedia("(hover: hover)").matches) {
    book.addEventListener("pointermove", (ev) => {
      const r = book.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width - 0.5;
      const y = (ev.clientY - r.top) / r.height - 0.5;
      book.style.transform = `perspective(900px) rotateY(${x * 14}deg) rotateX(${-y * 10}deg) rotate(-2deg) translateY(-4px)`;
    });
    book.addEventListener("pointerleave", () => (book.style.transform = ""));
  }

  // Sections fade in as they scroll into view.
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }), { rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll("main > section:not(.hero):not(.mb-me-wrap), .timeline-item, .mb-agenda > div").forEach((el) => {
      el.classList.add("mb-reveal");
      io.observe(el);
    });
  } else {
    document.documentElement.classList.remove("mb-js");
  }

  // ── Static bits ──
  const first = sessionDates[0];
  const daysToGo = first ? Math.ceil((first - Date.now()) / 864e5) : null;
  $("#mb-start").textContent = first ? fmtDay(first) : "TBA";
  $("#mb-start-label").textContent = first ? "Week 1 · 7pm UTC+8" : "Start date";
  document.querySelectorAll("[data-mb-start]").forEach((el) => {
    el.textContent = !first ? "Start date TBA" : daysToGo > 1 ? `Starts ${fmtDay(first)} · in ${daysToGo} days` : daysToGo === 1 ? `Starts tomorrow, ${fmtDay(first)}` : daysToGo === 0 ? "Starts today" : `Started ${fmtDay(first)}`;
  });
  const cd = document.querySelector("[data-mb-countdown]");
  if (cd && first && first > Date.now()) {
    cd.hidden = false;
    const tick = () => {
      const left = Math.max(0, first - Date.now());
      const parts = { d: Math.floor(left / 864e5), h: Math.floor(left / 36e5) % 24, m: Math.floor(left / 6e4) % 60, s: Math.floor(left / 1e3) % 60 };
      for (const k in parts) cd.querySelector(`[data-cd="${k}"]`).textContent = pad(parts[k]);
      if (!left) { clearInterval(timer); cd.hidden = true; }
    };
    const timer = setInterval(tick, 1000);
    tick();
  }
  function gcalHref() {
    if (!first) return "";
    const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const end = new Date(first.getTime() + (C.sessionMinutes || 60) * 6e4);
    return "https://calendar.google.com/calendar/render?" + new URLSearchParams({
      action: "TEMPLATE",
      text: "Mastering Bitcoin study cohort",
      dates: `${stamp(first)}/${stamp(end)}`,
      recur: `RRULE:FREQ=WEEKLY;COUNT=${C.weeks.length}`,
      details: `Weekly session on Discord: ${C.discord}\nThis week's chapter, questions and exercises: ${location.origin}/mastering-bitcoin`,
      location: "Discord",
    });
  }
  document.querySelectorAll("[data-mb-gcal]").forEach((a) => (a.href = gcalHref()));
  if (!first) document.querySelectorAll("[data-mb-cal]").forEach((el) => (el.hidden = true));
  document.addEventListener("click", async (ev) => {
    if (!ev.target.closest("[data-mb-share]")) return;
    const url = `${location.origin}/mastering-bitcoin`;
    const text = "Join the Mastering Bitcoin study cohort: 10 weeks, one chapter a week, Mondays on Discord. Free.";
    try {
      if (navigator.share) return await navigator.share({ title: "Mastering Bitcoin study cohort", text, url });
      await navigator.clipboard.writeText(url);
      toast("Link copied. Send it to a friend!");
    } catch {}
  });

  const roleList = $("#mb-role-list");
  if (roleList) roleList.innerHTML = roles.map((r) => `<div><strong>${esc(r.name)}</strong>${esc(r.job)}</div>`).join("");

  render();
  load();
})();
