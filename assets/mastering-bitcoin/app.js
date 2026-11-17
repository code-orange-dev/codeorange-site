// Decoding Bitcoin study cohort dashboard: curriculum, question assignments,
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
  // Exercises are plain text or { text, url, label } (a link to the tool or page where you do it).
  const exText = (e) => (typeof e === "string" ? e : e.text);
  const exLink = (e, cls = "mb-exlink") => (e && e.url ? `<a class="${cls}" href="${esc(e.url)}" target="_blank" rel="noopener">Open ${esc(e.label || "it")} ↗</a>` : "");
  const lessonUrl = (slug) => `${C.courseUrl}/${slug}`;

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

    // rosterVisible: whether the class list is shown (signed-in students, or everyone once
  // it's public; the API decides); emailLinks: "email me my link" is on; nostr: a Nostr key that
  // signed in but hasn't signed up yet.
  const state = { token: store.get(), students: [], me: null, rosterVisible: false, emailLinks: false, nostr: "", online: false, loaded: false, open: new Set(), popped: "" };

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
  // A link to a week (#week-3) opens that week.
  const hashWeek = /^#week-(\d+)$/.exec(location.hash);
  if (hashWeek) state.open.add(Number(hashWeek[1]) - 1);
  // The weekly plan lives on its own page; the landing page links to it.
  const PLAN = "/decoding-bitcoin/curriculum";
  const onPlan = () => !!$("#mb-weeks");
  const weekHref = (wk) => (onPlan() ? `#week-${wk}` : `${PLAN}#week-${wk}`);

  // ── Assignments: questions go round-robin through the roster (in sign-up order),
  // carrying on from week to week so everyone gets an even share. A week's owners
  // are fixed once that week opens (the previous Monday's session): people who join
  // later only pick up questions from weeks that haven't opened yet. ──
  const weekOpens = (wi) => (sessionDates[wi] ? sessionDates[wi].getTime() - 7 * 864e5 : Infinity);
  // Weeks unlock one at a time, by date: a week's lessons, questions and exercises appear
  // right after the previous Monday's session (week 1 is always visible). Organisers can
  // see everything with ?preview=all.
  const previewAll = new URLSearchParams(location.search).get("preview") === "all";
  const isUnlocked = (wi) => previewAll || wi === 0 || Date.now() >= weekOpens(wi);
  const fmtUnlock = (wi) => (sessionDates[wi - 1] ? fmtDay(sessionDates[wi - 1]) : "soon");
  // Seminar roles rotate the same way, on their own counter, one person per role.
  const roles = C.roles || [];
  // Visitors who aren't signed in don't see who has which question.
  // Manual question owners (C.assigned in cohort.js), e.g. after a session: "w1-q1": ["andywong31"].
  // A name can list aliases with "|" (Discord name|sign-up name). Matched to the roster by name,
  // and to the signed-in student by their Discord name or name. Overrides the round-robin.
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const owns = (who, id) => !!who && id != null && (who.ids ? who.ids.includes(id) : who.id === id);
  const manualWeek = (wk) => Object.keys(C.assigned || {}).some((k) => k.startsWith(`w${wk}-q`));
  // Which session a week's questions are discussed at: C.discussAt = { 1: 2 } means week 1's questions are discussed in week 2's session.
  const discussLabel = (wk) => { const at = (C.discussAt || {})[wk] || wk; const d = sessionDates[at - 1]; return d ? `on Monday ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}` : "on Monday"; };
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
    return applyManual(map);
  }
  const myRoles = (assigned, me, wk) => roles.filter((_, ri) => me && owns(assigned[`w${wk}-role${ri}`], me.id));
  const readCount = (wk) => state.students.filter((s) => s.done.includes(`w${wk}-r1`)).length;

  const isDone = (student, item) => !!student && student.done.includes(item);
  const meStudent = () => state.me && state.students.find((s) => s.id === state.me.id);

  // ── Rendering ──
  function tickButton(item, done, label) {
    return `<button type="button" class="mb-tick${done ? " is-done" : ""}" data-item="${item}" aria-pressed="${done}" aria-label="${esc(label)}">
      <span class="mb-box" aria-hidden="true">${done ? "✓" : ""}</span><span>${done ? "Done" : "Mark done"}</span></button>`;
  }

  function renderWeeks() {
    if (!onPlan()) return;
    const assigned = assignments();
    const me = meStudent();
    const nextLocked = C.weeks.findIndex((_, wi) => !isUnlocked(wi));
    const lockedCount = nextLocked < 0 ? 0 : C.weeks.length - nextLocked;
    const lockedCard = nextLocked < 0 ? "" : `<div id="week-${nextLocked + 1}" class="mb-week mb-locked" aria-label="Week ${nextLocked + 1} is locked">
          <span class="mb-wk">Week ${pad(nextLocked + 1)}</span>
          <span class="mb-title"><span aria-hidden="true">🔒</span> Unlocks after the session on ${fmtUnlock(nextLocked)}</span>
          <span class="mb-date">${lockedCount > 1 ? `${lockedCount} weeks to go` : "Last week"}</span>
        </div>`;
    $("#mb-weeks").innerHTML = C.weeks
      .map((w, wi) => {
        if (!isUnlocked(wi)) return "";
        const wk = wi + 1;
        const date = sessionDates[wi];
        const read = readCount(wk);
        const total = state.rosterVisible ? state.students.length : 0;
        const pending = !state.rosterVisible ? "Sign up to get yours" : C.autoAssign === false ? "Assigned after Monday's session" : "Assigned at sign-up";
        const chapters = w.lessons
          .map((c) => `<a href="${lessonUrl(c.slug)}" target="_blank" rel="noopener">${esc(c.title)} ↗</a>`)
          .join("");
        const extra = (w.extra || [])
          .map((c) => `<a class="is-extra" href="${lessonUrl(c.slug)}" target="_blank" rel="noopener">${esc(c.title)} ↗</a>`)
          .join("");
        const questions = w.questions
          .map((q, qi) => {
            const item = `w${wk}-q${qi + 1}`;
            const who = w.intro && !assigned[item]?.manual ? null : assigned[item];
            const mine = me && owns(who, me.id);
            const done = isDone(who, item);
            if (!who && w.intro) return `<li><span class="mb-num">Q${qi + 1}</span><div><p>${esc(q)}</p></div></li>`;
            const whoLabel = who
              ? `<span class="mb-who${mine ? " is-me" : ""}${done ? " is-done" : ""}">${done ? "✓ " : ""}${mine ? (who.name.includes(" & ") ? `${esc(who.name)} (you)` : "You") : esc(who.name)}</span>`
              : `<span class="mb-who is-empty">${pending}</span>`;
            return `<li class="${mine ? "is-mine" : ""}"><span class="mb-num">Q${qi + 1}</span><div><p>${esc(q)}</p><div class="mb-row">${whoLabel}${mine ? tickButton(item, done, `Mark question ${qi + 1} of week ${wk} done`) : ""}</div></div></li>`;
          })
          .join("");
        const exercises = w.exercises
          .map((e, ei) => {
            const item = `w${wk}-e${ei + 1}`;
            const count = state.students.filter((s) => s.done.includes(item)).length;
            return `<li><span class="mb-num">E${ei + 1}</span><div><p>${esc(exText(e))}</p><div class="mb-row">${exLink(e)}${total ? `<span class="mb-count">${count} of ${total} done</span>` : ""}${me ? tickButton(item, isDone(me, item), `Mark exercise ${ei + 1} of week ${wk} done`) : ""}</div></div></li>`;
          })
          .join("");
        const myQs = me ? w.questions.filter((_, qi) => owns(assigned[`w${wk}-q${qi + 1}`], me.id)).length : 0;
        const roleChips = roles
          .map((role, ri) => {
            const who = assigned[`w${wk}-role${ri}`];
            const mine = me && owns(who, me.id);
            return `<li class="${mine ? "is-mine" : ""}" title="${esc(role.job)}"><b>${esc(role.name)}</b><span>${who ? (mine ? "You" : esc(who.name)) : pending}</span></li>`;
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
            ${w.intro ? `<div class="mb-intro"><strong>Intro week: no homework.</strong> ${esc(w.introNote || "")}</div>` : ""}
            <div class="mb-read"><span class="mb-count">${w.intro ? "Optional: read these after the session, any time this week" : total ? `${read} of ${total} have done the lessons` : "Do the lessons before Monday"}</span>${me ? tickButton(`w${wk}-r1`, isDone(me, `w${wk}-r1`), `I've done the week ${wk} lessons`).replace(/>Mark done</, ">I've done the lessons<").replace(/>Done</, ">Lessons done<") : ""}</div>
            <div class="mb-opening"><p class="mb-label">Opening question · everyone</p><p>${esc(w.opening)}</p></div>
            ${w.intro || C.autoAssign === false ? "" : `<div class="mb-roles-wrap"><p class="mb-label">Seminar roles this week</p><ul class="mb-roles">${roleChips}</ul></div>`}
            <div class="mb-cols">
              <div><h3>Discussion questions</h3><p class="mb-hint">${w.intro && !manualWeek(wk) ? "Nothing to prepare. We'll talk these through together in the session." : manualWeek(wk) ? `Each question has an owner. Be ready to explain yours in a few minutes ${discussLabel(wk)}, and post your answer in the cohort channel on Discord.` : "Each question has one owner. Post your answer in the cohort channel on Discord before the session, then tick it done."}</p><ol class="mb-list">${questions}</ol></div>
              <div><h3>Exercises</h3><p class="mb-hint">${w.intro ? "Week 1 warm-ups, not counted. From week 2, exercises are required for the certificate." : "<strong>Required for the certificate.</strong> Do them on Decoding Bitcoin, share what you got on Discord, then tick each one off. Can't make Monday live? Posting your work on Discord counts as attending."}</p>${w.practice ? `<a class="button small mb-practice" href="${esc(w.practice)}" target="_blank" rel="noopener">Do this week's exercises on Decoding Bitcoin ↗</a>` : ""}<ol class="mb-list">${exercises}</ol></div>
            </div>
            <a class="mb-checklink" href="/decoding-bitcoin/check#week-${wk}"><b>Weekly check</b> · 5 questions on this week, answers explained →</a>
            <a class="mb-guidelink" href="https://github.com/code-orange-dev/curriculum/tree/main/decoding-bitcoin/week-${pad(wk)}" target="_blank" rel="noopener"><b>Study guide</b> · slides, notes and model answers on GitHub ↗</a>
          </div>
        </details>`;
      })
      .join("") + lockedCard;
  }

  // The 10-week rail above the accordion: your progress per week (or the cohort's
  // reading progress for visitors), with the current week highlighted.
  function renderRail() {
    if (!$("#mb-rail")) return;
    const me = meStudent();
    const assigned = assignments();
    $("#mb-rail").innerHTML = C.weeks
      .map((w, wi) => {
        const wk = wi + 1;
        const dateTag = sessionDates[wi] ? `<em> · ${sessionDates[wi].toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Singapore" })}</em>` : "";
        if (!isUnlocked(wi)) return `<span class="is-locked" title="Week ${wk} unlocks after the session on ${fmtUnlock(wi)}"><i><b style="--p:0%"></b></i><span>W${pad(wk)}${dateTag}</span></span>`;
        let pct;
        if (me) {
          const items = [`w${wk}-r1`, ...w.exercises.map((_, ei) => `w${wk}-e${ei + 1}`), ...w.questions.map((_, qi) => `w${wk}-q${qi + 1}`).filter((k) => owns(assigned[k], me.id))];
          pct = (items.filter((k) => me.done.includes(k)).length / items.length) * 100;
        } else {
          pct = state.rosterVisible && state.students.length ? (readCount(wk) / state.students.length) * 100 : 0;
        }
        const cls = wi === currentWeek ? "is-current" : currentWeek > wi ? "is-past" : "";
        return `<a href="#week-${wk}" class="${cls}" title="Week ${wk}: ${esc(w.title)} · ${Math.round(pct)}% ${me ? "done by you" : "of the cohort have done the lessons"}"><i><b style="--p:${pct.toFixed(1)}%"></b></i><span>W${pad(wk)}${sessionDates[wi] ? `<em> · ${sessionDates[wi].toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Singapore" })}</em>` : ""}</span></a>`;
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
    if (!box) return;
    if (!me) {
      box.hidden = true;
      return;
    }
    const assigned = assignments();
    const mine = Object.keys(assigned).filter((k) => k.includes("-q") && owns(assigned[k], me.id));
    const qDone = mine.filter((k) => me.done.includes(k)).length;
    const exTotal = C.weeks.reduce((n, w) => n + w.exercises.length, 0);
    const exDone = me.done.filter((k) => k.includes("-e")).length;
    const link = `${location.origin}${location.pathname}?me=${encodeURIComponent(state.token)}`;
    const focus = currentWeek >= 0 ? currentWeek : 0;
    const thisWeek = mine.filter((k) => k.startsWith(`w${focus + 1}-`));
    box.hidden = false;
    box.innerHTML = `<div class="mb-me-head"><div><p class="eyebrow">Your dashboard</p><h2>Hi ${esc(me.name)}.</h2></div>
      <div class="mb-me-stats"><span><strong>${me.done.filter((k) => k.endsWith("-r1")).length}/${C.weeks.length}</strong> weeks of lessons</span>${state.rosterVisible ? `<span><strong>${qDone}/${mine.length}</strong> questions</span>` : ""}<span><strong>${exDone}/${exTotal}</strong> exercises</span></div></div>
      ${weekChecklist(me, assigned, focus, thisWeek)}
      <div class="mb-link"><span>Your personal link (open it on any device to tick things off):</span><code>${esc(link)}</code><button type="button" class="ghost small" data-copy="${esc(link)}">Copy link</button><button type="button" class="mb-signout" data-signout>Not you? Sign out</button></div>
      <div class="cta-row mb-me-cta"><a class="button small" href="/decoding-bitcoin/me">Open my full dashboard →</a>${onPlan() ? "" : `<a class="ghost small" href="${PLAN}">See the weekly plan</a>`}<a class="ghost small" href="${C.discord}" target="_blank" rel="noopener">Join the Discord</a>${first ? `<a class="ghost small" href="${esc(gcalHref())}" target="_blank" rel="noopener">Add to Google Calendar</a>` : ""}</div>`;
  }

  // "Before Monday" list for the student's current week: read, own questions, role, exercises.
  function weekChecklist(me, assigned, focus, thisWeek) {
    const wk = focus + 1;
    const w = C.weeks[focus];
    const exItems = w.exercises.map((_, ei) => `w${wk}-e${ei + 1}`);
    const exDone = exItems.filter((k) => me.done.includes(k)).length;
    const rolesNow = myRoles(assigned, me, wk);
    const line = (done, text) => `<li class="${done ? "is-done" : ""}"><span class="mb-box" aria-hidden="true">${done ? "✓" : ""}</span><span>${text}</span></li>`;
    if (w.intro) {
      return `<div class="mb-me-week"><p class="mb-label">Week ${wk} · ${sessionDates[focus] ? fmtDay(sessionDates[focus]) : "the first session"}</p><ul class="mb-check">${line(false, `<strong>Intro week: no homework.</strong> ${esc(w.introNote || "")}`)}${line(false, `Think about the opening question: <em>${esc(w.opening)}</em>`)}</ul><a class="mb-jump" href="${weekHref(wk)}">Open week ${wk} →</a></div>`;
    }
    const items = [
      line(me.done.includes(`w${wk}-r1`), `Do the lesson${w.lessons.length > 1 ? "s" : ""} on Decoding Bitcoin: ${esc(w.lessons.map((c) => c.title).join(", "))}`),
      thisWeek.length
        ? line(thisWeek.every((k) => me.done.includes(k)), `Answer your question${thisWeek.length > 1 ? "s" : ""} (${listJoin(thisWeek.map((k) => `Q${k.split("-q")[1]}`))}) on Discord`)
        : "",
      line(exDone === exItems.length, `Do the exercises (${exDone} of ${exItems.length})`),
      rolesNow.length ? line(false, `On Monday you're the <strong>${rolesNow.map((r) => esc(r.name)).join("</strong> and <strong>")}</strong>: ${esc(rolesNow[0].job.charAt(0).toLowerCase() + rolesNow[0].job.slice(1))}`) : "",
      line(false, `Think about the opening question: <em>${esc(w.opening)}</em>`),
    ].join("");
    return `<div class="mb-me-week"><p class="mb-label">Week ${wk} · before ${sessionDates[focus] ? fmtDay(sessionDates[focus]) : "the session"}</p><ul class="mb-check">${items}</ul><a class="mb-jump" href="${weekHref(wk)}">Open week ${wk} →</a></div>`;
  }

  // Other students' names are blurred for privacy; the real name never reaches the page,
  // only its first letter and a stand-in of similar length.
  function nameCell(s) {
    if (state.me && s.id === state.me.id) return `<span class="mb-name">${esc(s.name)} <em>(you)</em></span>`;
    const len = Math.min(Math.max(String(s.name).length, 5), 14);
    const fake = (String(s.name)[0] || "x") + "abcdefghijklmn".slice(0, len - 1);
    return `<span class="mb-name is-blur" aria-label="Student ${esc(String(s.id))}">${esc(fake)}</span>`;
  }

  function renderRoster() {
    const assigned = assignments();
    const exTotal = C.weeks.reduce((n, w) => n + w.exercises.length, 0);
    if ($("#mb-count")) $("#mb-count").textContent = state.loaded ? String(state.students.length) : "–";
    const joined = $(".mb-joined");
    if (joined) joined.hidden = !(state.rosterVisible && state.students.length > 0);
    // The class list stays off the page until the organisers make it public.
    const section = $("#progress");
    if (section) section.hidden = !state.rosterVisible;
    if (!state.rosterVisible || !$("#mb-roster")) return;
    if (!state.students.length) {
      $("#mb-roster").innerHTML = `<p class="mb-empty">${state.online || !state.loaded ? "No one has signed up yet. Be the first." : "The roster appears here once sign-ups open."}</p>`;
      return;
    }
    const rows = state.students
      .map((s, i) => {
        const mine = Object.keys(assigned).filter((k) => k.includes("-q") && owns(assigned[k], s.id));
        const q = mine.filter((k) => s.done.includes(k)).length;
        const e = s.done.filter((k) => k.includes("-e")).length;
        const r = s.done.filter((k) => k.endsWith("-r1")).length;
        const pct = Math.round(((q + e + r) / Math.max(1, mine.length + exTotal + C.weeks.length)) * 100);
        return `<div class="mb-roster-row${state.me && s.id === state.me.id ? " is-me" : ""}"><span class="mb-num">${pad(i + 1)}</span>${nameCell(s)}<span>${r}/${C.weeks.length} R</span><span>${q}/${mine.length} Q</span><span>${e}/${exTotal} E</span><span class="mb-bar" aria-label="${pct}% done"><i style="width:${pct}%"></i></span></div>`;
      })
      .join("");
    $("#mb-roster").innerHTML = `<div class="mb-roster-row mb-roster-head"><span>#</span><span>Student</span><span><b class="mb-long">Read</b><b class="mb-short">R</b></span><span><b class="mb-long">Questions</b><b class="mb-short">Q</b></span><span><b class="mb-long">Exercises</b><b class="mb-short">E</b></span><span>Progress</span></div>${rows}`;
  }

  function renderSignup() {
    const form = $("#mb-signup");
    const note = $("#mb-signup-note");
    if (!form || !note) return;
    const me = meStudent();
    if (me) {
      form.hidden = true;
      if ($("#mb-lost")) $("#mb-lost").hidden = true;
      note.innerHTML = `You're signed up as <strong>${esc(me.name)}</strong>. Next step: <a href="https://discord.gg/ZtvA79paWa" target="_blank" rel="noopener">join our Discord</a>. See you there, ${esc(C.sessionLabel)}.`;
      return;
    }
    const closed = state.loaded && (!state.online || !C.signupsOpen);
    form.hidden = false;
    // Signed in with a Nostr key that hasn't signed up yet: it gets linked to this sign-up.
    const on = form.querySelector(".mb-nostr-on");
    on.hidden = !state.nostr;
    if (state.nostr) on.querySelector("code").textContent = npubShort(state.nostr);
    form.querySelector("[data-mb-nostr]").hidden = !!state.nostr;
    const lost = $("#mb-lost");
    if (lost) lost.hidden = !state.emailLinks || closed;
    form.querySelectorAll("input, button").forEach((el) => (el.disabled = closed));
    note.textContent = closed
      ? state.online ? "Sign-ups are closed for this cohort. Ask in Discord about the next one." : "Sign-ups open soon. Check back in a few days or ask in Discord."
      : "";
  }

  let scrolled = false;
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
    // Scroll to a linked week once it's on the page.
    if (hashWeek && !scrolled && state.loaded) {
      scrolled = true;
      const d = document.getElementById(`week-${hashWeek[1]}`);
      if (d) requestAnimationFrame(() => d.scrollIntoView({ block: "start" }));
    }
  }

  // ── Nostr: a browser extension (NIP-07) if there is one, otherwise nostr-login
  // (loaded only when needed) for remote signers like nsec.app. The private key stays
  // in the signer; the server only checks a signature on a short-lived event (NIP-98). ──
  const NOSTR_LIB = "/assets/vendor/nostr-login-1.7.12.js";
  function nostrProvider() {
    if (window.nostr) return Promise.resolve(window.nostr);
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = NOSTR_LIB;
      Object.assign(s.dataset, {
        methods: "connect,extension",
        perms: "sign_event:27235",
        noBanner: "true",
        darkMode: "true",
        title: "Decoding Bitcoin cohort",
        description: "Sign in with your Nostr key. Code Orange never sees your private key.",
      });
      s.onload = () => (window.nostr ? resolve(window.nostr) : reject(new Error("Nostr sign-in couldn't start. Try again.")));
      s.onerror = () => reject(new Error("Nostr sign-in couldn't load. Try again."));
      document.head.appendChild(s);
    });
  }
  async function nostrEvent() {
    const nostr = await nostrProvider();
    const pubkey = await nostr.getPublicKey();
    return nostr.signEvent({ kind: 27235, created_at: Math.floor(Date.now() / 1000), tags: [["u", `${location.origin}${API}`], ["method", "POST"]], content: "", pubkey });
  }
  // Hex public key to npub (bech32), shortened for display.
  function npubShort(hex) {
    const CH = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
    const data = [];
    let acc = 0, bits = 0;
    for (const h of hex.match(/../g)) {
      acc = ((acc << 8) | parseInt(h, 16)) & 0xffff;
      bits += 8;
      while (bits >= 5) { bits -= 5; data.push((acc >> bits) & 31); }
    }
    if (bits) data.push((acc << (5 - bits)) & 31);
    const polymod = (values) => {
      let chk = 1;
      for (const v of values) {
        const top = chk >> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ v;
        [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3].forEach((g, i) => { if ((top >> i) & 1) chk ^= g; });
      }
      return chk;
    };
    const hrp = [..."npub"].map((c) => c.charCodeAt(0));
    const pm = polymod([...hrp.map((c) => c >> 5), 0, ...hrp.map((c) => c & 31), ...data, 0, 0, 0, 0, 0, 0]) ^ 1;
    const full = "npub1" + [...data, ...[0, 1, 2, 3, 4, 5].map((i) => (pm >> (5 * (5 - i))) & 31)].map((d) => CH[d]).join("");
    return `${full.slice(0, 12)}…${full.slice(-6)}`;
  }

  // ── Data ──
  async function load() {
    try {
      const res = await fetch(API, { headers: state.token ? { "X-MB-Token": state.token } : {} });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load");
      state.students = data.students;
      state.rosterVisible = !!data.rosterVisible;
      state.emailLinks = !!data.emailLinks;
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
        const items = [`w${wk}-r1`, ...w.exercises.map((_, ei) => `w${wk}-e${ei + 1}`), ...w.questions.map((_, qi) => `w${wk}-q${qi + 1}`).filter((k) => owns(assigned[k], me.id))];
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
    if (jump && jump.getAttribute("href").startsWith("#")) {
      const d = document.querySelector(jump.getAttribute("href"));
      if (d) { d.open = true; state.open.add(Number(d.dataset.week)); }
      return;
    }
    if (ev.target.closest("[data-signout]")) {
      store.set("");
      state.token = "";
      state.me = null;
      if (window.nostr && document.querySelector(`script[src="${NOSTR_LIB}"]`)) document.dispatchEvent(new Event("nlLogout"));
      render();
      return;
    }
    const nostrBtn = ev.target.closest("[data-mb-nostr]");
    if (nostrBtn) {
      const note = $("#mb-signup-note");
      nostrBtn.disabled = true;
      note.textContent = "Waiting for your Nostr signer…";
      try {
        const data = await post({ action: "nostr", event: await nostrEvent() });
        if (data.known) {
          store.set(data.token);
          state.token = data.token;
          state.nostr = "";
          note.textContent = "";
          await load();
          $("#mb-me").scrollIntoView({ behavior: "smooth", block: "start" });
          toast(`Welcome back, ${data.me.name}.`);
        } else {
          state.nostr = data.pubkey;
          renderSignup();
          note.textContent = "Nostr connected. Add your email and Discord to finish signing up.";
          $("#mb-signup [name=email]").focus();
        }
      } catch (err) {
        note.textContent = err && err.message ? err.message : "Nostr sign-in was cancelled.";
      } finally {
        nostrBtn.disabled = false;
      }
    }
  });

  document.addEventListener("toggle", (ev) => {
    const d = ev.target;
    if (!d.matches || !d.matches("details.mb-week")) return;
    const wi = Number(d.dataset.week);
    d.open ? state.open.add(wi) : state.open.delete(wi);
  }, true);

  // Remember ?ref=… (e.g. from a student's shared "I finished week N" image) so the sign-up can be credited.
  try { const r = new URLSearchParams(location.search).get("ref"); if (r && /^[a-z0-9_-]{1,40}$/i.test(r)) sessionStorage.setItem("mb-ref", r); } catch (e) {}
  // Came from a friend's shared image: greet them on the cohort page.
  (() => {
    const m = /^week(10|[1-9])$/i.exec(new URLSearchParams(location.search).get("ref") || "");
    const intro = document.querySelector(".mb-intro");
    if (!m || !intro) return;
    const put = () => { intro.innerHTML = `<strong>A friend just finished week ${m[1]}. You can still join, free.</strong> <a href="#catch-up">Catch up</a> in 15 minutes, then <a href="#signup">sign up</a>.`; };
    put();
    document.addEventListener("DOMContentLoaded", () => setTimeout(put, 0));
  })();
  if ($("#mb-signup")) $("#mb-signup").addEventListener("submit", async (ev) => {
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
        ref: (() => { try { return sessionStorage.getItem("mb-ref") || undefined; } catch (e) { return undefined; } })(),
        // A fresh signature ties the Nostr key to this sign-up.
        nostr: state.nostr ? await nostrEvent() : undefined,
      });
      store.set(data.token);
      state.token = data.token;
      state.nostr = "";
      form.reset();
      await load();
      $("#mb-me").scrollIntoView({ behavior: "smooth", block: "start" });
      toast(data.emailed ? "You're in! We've emailed you your personal link." : "You're in! Save your personal link so you can tick things off on any device.");
    } catch (err) {
      $("#mb-signup-note").textContent = err.message;
    } finally {
      button.disabled = false;
      button.textContent = "Sign me up";
    }
  });

  // "Email me my link" for students on a new device.
  const lostForm = $("#mb-lost form");
  if (lostForm) lostForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const btn = lostForm.querySelector("button");
    const out = $("#mb-lost-note");
    btn.disabled = true;
    try {
      await post({ action: "email-link", email: new FormData(lostForm).get("email") });
      out.textContent = "If that email is signed up, your link is on its way. Check your inbox (and spam).";
      lostForm.reset();
    } catch (err) {
      out.textContent = err.message;
    } finally {
      btn.disabled = false;
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
    if (!a || !a.getAttribute("href").startsWith("#")) return;
    const d = document.querySelector(a.getAttribute("href"));
    if (d) { d.open = true; state.open.add(Number(d.dataset.week)); }
  });

  // The course card tilts towards the cursor.
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
  if ($("#mb-start")) $("#mb-start").textContent = first ? fmtDay(first) : "TBA";
  if ($("#mb-start-label")) $("#mb-start-label").textContent = first ? "Week 1 · 7pm UTC+8" : "Start date";
  // The next session that hasn't finished yet (drives the pill, countdown and "Next session" line).
  const sessLen = (C.sessionMinutes || 90) * 6e4;
  const nextIdx = sessionDates.findIndex((d) => d.getTime() + sessLen > Date.now());
  const nextS = nextIdx >= 0 ? sessionDates[nextIdx] : null;
  document.querySelectorAll("[data-mb-start]").forEach((el) => {
    el.textContent = !first ? "Start date TBA" : nextIdx > 0 ? `Week ${nextIdx + 1} of ${sessionDates.length}: ${fmtDay(nextS)}` : nextIdx < 0 ? "Cohort finished" : daysToGo > 1 ? `Starts ${fmtDay(first)} · in ${daysToGo} days` : daysToGo === 1 ? `Starts tomorrow, ${fmtDay(first)}` : daysToGo === 0 ? "Starts today" : nextS ? `Week ${nextIdx + 1} of ${sessionDates.length}: ${fmtDay(nextS)}` : "Cohort finished";
  });
  document.querySelectorAll("[data-mb-next]").forEach((el) => {
    if (nextS) el.textContent = `Week ${nextIdx + 1}, ${fmtDay(nextS)}, 7pm WITA`;
  });
  const cd = document.querySelector("[data-mb-countdown]");
  if (cd && nextS && nextS > Date.now()) {
    cd.hidden = false;
    const tick = () => {
      const left = Math.max(0, nextS - Date.now());
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
      text: "Decoding Bitcoin study cohort",
      dates: `${stamp(first)}/${stamp(end)}`,
      recur: `RRULE:FREQ=WEEKLY;COUNT=${C.weeks.length}`,
      details: `Live on Discord, every Monday for 10 weeks. Join here: ${C.discordEvent || C.discord}\nThis week's lessons and questions: ${location.origin}${PLAN}`,
      location: "Discord",
    });
  }
  document.querySelectorAll("[data-mb-gcal]").forEach((a) => (a.href = gcalHref()));
  // Show the Monday session in the visitor's own time zone.
  if (first) {
    let tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ").split("/").pop(); } catch (e) {}
    const t = (d) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const end = new Date(first.getTime() + (C.sessionMinutes || 90) * 6e4);
    const day = first.toLocaleDateString(undefined, { weekday: "long" });
    document.querySelectorAll("[data-mb-yourtime]").forEach((el) => {
      el.innerHTML = `Your time${tz ? ` (${esc(tz)})` : ""}: <b>${esc(day)}s, ${esc(t(first))}–${esc(t(end))}</b>`;
      el.hidden = false;
    });
  }
  if (!first) document.querySelectorAll("[data-mb-cal]").forEach((el) => (el.hidden = true));
  document.addEventListener("click", async (ev) => {
    if (!ev.target.closest("[data-mb-share]")) return;
    const url = `${location.origin}/decoding-bitcoin`;
    const text = "Join the Decoding Bitcoin study cohort: 10 weeks of interactive lessons on transactions, Script and Taproot, Mondays on Discord. Free.";
    try {
      if (navigator.share) return await navigator.share({ title: "Decoding Bitcoin study cohort", text, url });
      await navigator.clipboard.writeText(url);
      toast("Link copied. Send it to a friend!");
    } catch {}
  });

  const roleList = $("#mb-role-list");
  if (roleList) roleList.innerHTML = roles.map((r) => `<div><strong>${esc(r.name)}</strong>${esc(r.job)}</div>`).join("");

  render();
  load();
})();
