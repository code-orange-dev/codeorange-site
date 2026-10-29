// Fellow dashboard (/fellowships/me): weekly standup, monthly report (the invoice), milestones,
// this month's to-dos, PRs to keep moving, private payout history and a link to the public
// proof-of-work page. Data: /api/fellowship.
(() => {
  const API = "/api/fellowship";
  const TOKEN_KEY = "fw-token";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
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
  const app = $("#me-app");
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ymLabel = (ym, k = 0) => {
    const n = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + k;
    return `${MONTHS[n % 12]} ${Math.floor(n / 12)}`;
  };
  const dayLabel = (d) => {
    const [y, m, dd] = d.split("-").map(Number);
    return `${dd} ${MONTHS[m - 1]} ${y}`;
  };
  const sats = (n) => (n == null ? "" : `${Math.round(n).toLocaleString("en-US")} sats`);
  const linkify = (s) => esc(s).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 70)}</a>`);

  function toast(msg) {
    const t = $("#me-toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (t.hidden = true), 3200);
  }
  async function post(body) {
    const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, token: store.get() }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "That didn't save. Please try again.");
    return data;
  }

  function signIn(msg) {
    $("#me-hello").textContent = "Your fellow dashboard";
    $("#me-sub").textContent = "Fellows sign in with the personal link from their welcome email.";
    app.innerHTML = `<section class="me-card me-wide me-signin">
      <p class="me-label">Sign in</p>
      <h2>Lost your link?</h2>
      <p>${msg ? esc(msg) + " " : ""}Enter the email you applied with and we'll send your personal link again.</p>
      <form id="fw-link" class="me-row"><input type="email" name="email" placeholder="you@example.com" required autocomplete="email"><button class="button" type="submit">Email me my link</button></form>
      <p class="me-note" id="fw-link-note"></p>
      <p class="me-small">Not a fellow yet? <a href="/fellowships/guidelines">Read the guidelines</a> and <a href="/fellowships/apply">apply</a>.</p>
    </section>`;
    $("#fw-link").addEventListener("submit", async (e) => {
      e.preventDefault();
      const note = $("#fw-link-note");
      note.textContent = "Sending…";
      try {
        const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "link", email: e.target.email.value }) });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "That didn't work.");
        note.textContent = "If that email belongs to a fellow, the link is on its way. Check your spam folder too.";
      } catch (err) {
        note.textContent = err.message;
      }
    });
  }

  let D;
  async function load() {
    const token = store.get();
    if (!token) return signIn();
    try {
      const res = await fetch(API, { headers: { "X-FW-Token": token } });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        store.set("");
        return signIn(data.error);
      }
      if (!res.ok) throw new Error(data.error || "The dashboard didn't load.");
      D = data;
      render();
    } catch (err) {
      app.innerHTML = `<div class="me-card me-wide">${esc(err.message)} <button class="ghost small" id="fw-retry">Try again</button></div>`;
      $("#fw-retry").onclick = load;
    }
  }

  function state() {
    const me = D.me;
    const month = me.month;
    const reports = Object.fromEntries(D.reports.map((r) => [r.month, r]));
    const paid = {};
    for (const p of D.payouts) (paid[p.month] ||= []).push(p);
    const today = new Date().toISOString().slice(0, 10);
    const thisStandup = D.standups.find((s) => s.week === D.thisWeek);
    // The report owed right now: the first month without a report whose report window has opened.
    let owed = null;
    for (const c of cal()) if (!reports[c.month] && today >= c.opens) { owed = c.month; break; }
    return { me, month, reports, paid, today, thisStandup, owed };
  }
  // Report and pay dates per month (from the API; older API answers only had dueDates).
  const cal = () => D.calendar || D.dueDates.map((due, i) => ({ month: i + 1, due, payBy: `${due.slice(0, 8)}10`, opens: `${due.slice(0, 8)}01` }));
  const calOf = (k) => cal()[k - 1] || {};
  const isEnd = () => D.schedule === "end";
  const rhythmLine = () => (isEnd() ? "report by the 21st, paid before the month ends" : "report by the 5th of the next month, paid by the 10th");
  const payLine = (k) => `paid by ${dayLabel(calOf(k).payBy)}`;

  function render() {
    const S = state();
    const { me, month } = S;
    const first = me.name.split(" ")[0];
    $("#me-hello").textContent = `Hi ${first} 👋`;
    $("#me-sub").innerHTML =
      month < 1 ? `Your fellowship on <strong>${esc(me.project)}</strong> starts on 1 ${ymLabel(me.startMonth)}. Set your milestones now.` :
      month > me.months ? `You finished your ${me.months}-month fellowship on <strong>${esc(me.project)}</strong>. Thank you for building. 🧡` :
      `Month <strong>${month} of ${me.months}</strong> on <strong>${esc(me.project)}</strong>${me.mentor ? ` · mentor: ${esc(me.mentor)}` : ""}`;
    app.innerHTML = [nextStep(S), timeline(S), monthCard(S), focusCard(S), standupCard(S), reportCard(S), planCard(S), payoutsCard(S), proofCard(S), rhythmCard(S)].join("");
    wire(S);
  }

  function nextStep(S) {
    const { me, month, thisStandup, owed } = S;
    let title, text, href, label;
    if (month < 1) {
      title = `Check your ${me.months} milestones`; text = `Your fellowship starts on 1 ${ymLabel(me.startMonth)}. Agree the milestones with your mentor, add the PRs you want to keep moving, and post your first check-in on the first Monday.`; href = "#fw-plan"; label = "See my milestones";
    } else if (owed) {
      const due = D.dueDates[owed - 1];
      const late = S.today > due;
      title = `Send your month ${owed} report`; text = `${late ? "It was due on" : "It's due on"} ${dayLabel(due)}. It's also your invoice: once it's approved you're ${payLine(owed)}.`; href = "#fw-report"; label = "Write my report";
    } else if (month <= me.months && !thisStandup) {
      title = "Post this week's standup"; text = "Two minutes: what you did, what's next, what's blocking you."; href = "#fw-standup"; label = "Post my standup";
    } else if (month === me.months && !S.reports[month]) {
      title = "Last month: land it and show it"; text = "Wrap up open PRs, document your work and plan your demo. Your final report is due on " + dayLabel(D.dueDates[month - 1]) + "."; href = "#fw-report"; label = "Start my final report";
    } else {
      title = "You're all caught up ✓"; text = "Standup posted and reports in. Go build, and review one PR by someone else this week."; href = "#fw-proof"; label = "See my proof of work";
    }
    return `<section class="me-card me-wide me-nextstep"><div><p class="me-label">Next step</p><h2>${esc(title)}</h2><p style="margin:0">${esc(text)}</p></div><a class="button" href="${href}">${esc(label)}</a></section>`;
  }

  function timeline(S) {
    const { me, month, reports, paid } = S;
    const items = Array.from({ length: me.months }, (_, i) => {
      const k = i + 1;
      const r = reports[k];
      const p = paid[k];
      const st = p ? "Paid" : r && r.approved ? "Approved" : r ? "Report sent" : k < month ? "Report due" : k === month ? "Now" : "";
      const cls = p ? "is-done" : k === month ? "is-now" : k > month ? "is-later" : "";
      return `<li class="${cls}"><b>${k}</b>${ymLabel(me.startMonth, i)}<br>${esc(st)}</li>`;
    }).join("");
    const st = D.standups.length;
    const doneM = me.plan.filter((p) => p.done).length;
    return `<section class="me-card me-wide"><p class="me-label">Your fellowship</p><h2>${me.months} months, one step at a time</h2>
      <ol class="fw-months" style="grid-template-columns:repeat(${Math.min(me.months, 6)},1fr)">${items}</ol>
      <div class="me-stats"><span><strong>${Math.max(0, Math.min(month, me.months))}/${me.months}</strong>months in</span><span><strong>${st}</strong>standups posted</span><span><strong>${D.reports.length}</strong>reports sent</span><span><strong>${doneM}/${me.months}</strong>milestones done</span></div></section>`;
  }

  // This month's to-dos: ticked by the fellow, seen by the organisers.
  const TODOS = [
    ["reviews", "Reviewed other people's PRs", "aim for 3+ solid reviews a month"],
    ["mentor", "Call with your mentor", "at least once a month; bring questions"],
    ["crc", "Code Review Club", "join, and present a PR when it's your turn"],
    ["privacy", "Privacy Track session", "1st & 3rd Tuesday, 07:00 UTC"],
    ["post", "One public post about your work", "X, Nostr or a blog: what you shipped and learned"],
  ];
  function monthCard(S) {
    const { me, month } = S;
    if (month < 1 || month > me.months) return "";
    const done = (D.checks && D.checks[month]) || {};
    const ym = ymLabel(me.startMonth, month - 1);
    const monthStart = `${ym.slice(-4)}-${String(MONTHS.indexOf(ym.slice(0, 3)) + 1).padStart(2, "0")}-01`;
    const standups = D.standups.filter((s) => s.week >= monthStart && s.week.slice(0, 7) === monthStart.slice(0, 7)).length;
    const ticked = TODOS.filter(([k]) => done[k]).length;
    const reviewsUrl = `https://github.com/pulls?q=${encodeURIComponent(`is:pr reviewed-by:${me.github} -author:${me.github} updated:>=${monthStart}`)}`;
    const c = calOf(month);
    return `<section class="me-card me-wide" id="fw-month"><p class="me-label">This month · ${esc(ym)}</p><h2>Month ${month} to-dos <span class="fw-badge ${ticked === TODOS.length ? "ok" : ""}">${ticked}/${TODOS.length}</span></h2>
      <p class="me-small">Tick them as you go. Private: only you and the organisers see this.</p>
      <ul class="fw-todo">${TODOS.map(([k, t, hint]) => `<li><button type="button" class="mb-tick fw-tick ${done[k] ? "is-done" : ""}" data-check="${k}" aria-pressed="${done[k] ? "true" : "false"}"><span class="mb-box">${done[k] ? "✓" : ""}</span></button><div><strong>${esc(t)}</strong><span>${esc(hint)}${k === "reviews" ? ` · <a href="${reviewsUrl}" target="_blank" rel="noopener">see my reviews on GitHub</a>` : ""}</span></div></li>`).join("")}
        <li class="fw-auto"><span class="fw-autobox">${standups}</span><div><strong>Monday check-ins this month</strong><span>counted automatically</span></div></li>
        <li class="fw-auto"><span class="fw-autobox">${S.reports[month] ? "✓" : "…"}</span><div><strong>Monthly report</strong><span>due ${dayLabel(c.due)}, ${payLine(month)}</span></div></li>
      </ul></section>`;
  }

  // PRs the fellow wants to keep moving, with their live state from GitHub.
  // Full GitHub links, or "#1105" for a PR on the fellow's own project repository.
  function prRefs(text, projectUrl) {
    const out = [];
    const base = String(projectUrl || "").match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
    for (const m of String(text || "").matchAll(/https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/(?:pull|issues)\/(\d+)|(?:^|[\s,(])#(\d+)\b/g)) {
      if (m[1]) out.push({ owner: m[1], repo: m[2], num: m[3], url: `https://github.com/${m[1]}/${m[2]}/pull/${m[3]}` });
      else if (base) out.push({ owner: base[1], repo: base[2], num: m[4], url: `https://github.com/${base[1]}/${base[2]}/pull/${m[4]}` });
    }
    return out.filter((r, i) => out.findIndex((x) => x.url === r.url) === i).slice(0, 12);
  }
  function focusCard(S) {
    const refs = prRefs(S.me.focus, S.me.projectUrl);
    const body = refs.length
      ? `<ul class="fw-prs">${refs.map((r) => `<li data-pr="${esc(`${r.owner}/${r.repo}/${r.num}`)}"><a href="${esc(r.url)}" target="_blank" rel="noopener"><span class="fw-badge">#${esc(r.num)}</span> <span class="fw-pr-title">${esc(`${r.repo} #${r.num}`)}</span></a><span class="fw-pr-state"></span></li>`).join("")}</ul>`
      : `<p>Add the links of the PRs you want to keep moving (yours or ones you're reviewing) under <a href="#fw-plan">your plan</a>. Their live status shows up here.</p>`;
    return `<section class="me-card" id="fw-focus"><p class="me-label">PRs to keep moving</p><h2>Open work</h2>${body}</section>`;
  }
  const prCache = new Map();
  async function loadPrStates() {
    for (const li of app.querySelectorAll("[data-pr]")) {
      const [owner, repo, num] = li.dataset.pr.split("/");
      try {
        let d = prCache.get(li.dataset.pr);
        if (!d) {
          const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${num}`, { headers: { Accept: "application/vnd.github+json" } });
          if (!r.ok) continue;
          d = await r.json();
          prCache.set(li.dataset.pr, d);
        }
        const merged = d.pull_request && d.pull_request.merged_at;
        const st = merged ? "merged" : d.state === "closed" ? "closed" : d.draft ? "draft" : "open";
        li.querySelector(".fw-pr-title").textContent = d.title;
        const el = li.querySelector(".fw-pr-state");
        el.textContent = st;
        el.className = `fw-pr-state fw-badge ${st === "merged" ? "ok" : st === "closed" ? "late" : ""}`;
      } catch {}
    }
  }

  function standupCard(S) {
    const { month, me, thisStandup } = S;
    if (month < 1 || month > me.months) {
      return `<section class="me-card" id="fw-standup"><p class="me-label">Weekly standup</p><h2>Every Monday</h2><p>${month < 1 ? "Your first standup is due on the first Monday of your fellowship." : "Your fellowship has ended, so no more standups."}</p>${pastStandups()}</section>`;
    }
    const s = thisStandup || {};
    return `<section class="me-card" id="fw-standup"><p class="me-label">Weekly standup · week of ${dayLabel(D.thisWeek)}</p>
      <h2>${thisStandup ? "This week's standup ✓" : "Post this week's standup"}</h2>
      <p class="me-small">Private: only you and the organisers see standups.</p>
      <form id="fw-standup-form">
        <label class="me-field">What did you do last week?<textarea name="did" rows="3" maxlength="2000" placeholder="Opened PR #… on …, reviewed …, read …">${esc(s.did)}</textarea></label>
        <label class="me-field">What's next this week?<textarea name="next" rows="2" maxlength="1500">${esc(s.next)}</textarea></label>
        <label class="me-field">Anything blocking you?<textarea name="blockers" rows="2" maxlength="1500" placeholder="Waiting on review, build fails on …, not sure how …">${esc(s.blockers)}</textarea></label>
        <label class="me-field">Links <span class="fw-hint">(PRs, reviews, notes; one per line)</span><textarea name="links" rows="2" maxlength="2000">${esc(s.links)}</textarea></label>
        <label class="me-help"><input type="checkbox" name="help" ${s.help ? "checked" : ""}> <span>I'd like help this week. An organiser will reach out.</span></label>
        <button class="button" type="submit">${thisStandup ? "Update standup" : "Post standup"}</button>
      </form>${pastStandups()}</section>`;
  }
  function pastStandups() {
    const old = D.standups.filter((s) => s.week !== D.thisWeek).slice(0, 6);
    if (!old.length) return "";
    return `<div class="fw-log">${old.map((s) => `<details><summary>Week of ${dayLabel(s.week)}${s.help ? '<span class="fw-badge due">asked for help</span>' : ""}</summary>${s.did ? `<p><strong>Did:</strong> ${linkify(s.did)}</p>` : ""}${s.next ? `<p><strong>Next:</strong> ${linkify(s.next)}</p>` : ""}${s.blockers ? `<p><strong>Blocked:</strong> ${linkify(s.blockers)}</p>` : ""}${s.links ? `<p>${linkify(s.links)}</p>` : ""}</details>`).join("")}</div>`;
  }

  function reportCard(S) {
    const { me, month, reports, paid } = S;
    const open = Math.min(Math.max(month, 0), me.months);
    if (open < 1) return `<section class="me-card" id="fw-report"><p class="me-label">Monthly report · your invoice</p><h2>${isEnd() ? "Due on the 21st" : "Due on the 5th"}</h2><p>Your first report covers ${ymLabel(me.startMonth)} and is due on ${dayLabel(calOf(1).due)}. Once it's approved you're ${payLine(1)}.</p><p class="me-small">It covers: milestone progress, PRs and reviews (links), a short note from your mentor, and next month's plan.</p></section>`;
    const pick = S.owed || (reports[open] ? open : open);
    const options = Array.from({ length: open }, (_, i) => i + 1).map((k) => `<option value="${k}" ${k === pick ? "selected" : ""}>Month ${k} · ${ymLabel(me.startMonth, k - 1)}${reports[k] ? " ✓" : ""}</option>`).join("");
    return `<section class="me-card" id="fw-report"><p class="me-label">Monthly report · your invoice</p>
      <h2>Report on a month</h2>
      <form id="fw-report-form">
        <label class="me-field">Which month?<select name="month">${options}</select></label>
        <p class="me-small" id="fw-report-status"></p>
        <label class="me-field">Summary <span class="fw-hint">(public) What happened this month, in a few sentences.</span><textarea name="summary" rows="4" maxlength="4000"></textarea></label>
        <label class="me-field">PRs opened and merged <span class="fw-hint">(public) Links, one per line.</span><textarea name="prs" rows="3" maxlength="3000"></textarea></label>
        <label class="me-field">Reviews you wrote <span class="fw-hint">(public)</span><textarea name="reviews" rows="2" maxlength="3000"></textarea></label>
        <label class="me-field">Other work <span class="fw-hint">(public) Code Review Club talks, Privacy Track sessions, issues, tests, docs, write-ups.</span><textarea name="other" rows="2" maxlength="2000"></textarea></label>
        <label class="me-field">Next month's focus <span class="fw-hint">(public)</span><textarea name="next" rows="2" maxlength="2000"></textarea></label>
        <label class="me-field">Note from your mentor <span class="fw-hint">(private) A line or two from ${esc(me.mentor || "your mentor")} on how the month went. Paste it from chat or email.</span><textarea name="mentorNote" rows="2" maxlength="2000"></textarea></label>
        <label class="me-field">What got in the way? <span class="fw-hint">(private)</span><textarea name="blockers" rows="2" maxlength="2000"></textarea></label>
        <fieldset class="me-pills"><legend>Pay me by <span class="fw-hint">(private)</span></legend>
          ${[["lightning", "Lightning"], ["onchain", "On-chain"], ["ecash", "eCash"]].map(([v, l]) => `<label><input type="radio" name="rail" value="${v}"><span>${l}</span></label>`).join("")}
        </fieldset>
        <label class="me-field">Address, Lightning address or invoice note <span class="fw-hint">(private) A changed address is confirmed with you on a second channel before we pay.</span><input type="text" name="address" maxlength="600" autocapitalize="off" spellcheck="false"></label>
        <label class="me-help"><input type="checkbox" name="help"> <span>I'd like to talk about how the fellowship is going.</span></label>
        <button class="button" type="submit">Send report</button>
      </form></section>`;
  }

  function fillReport(k) {
    const f = $("#fw-report-form");
    if (!f) return;
    const r = state().reports[k] || {};
    for (const n of ["summary", "prs", "reviews", "other", "next", "mentorNote", "blockers", "address"]) f[n].value = r[n] || "";
    // Carry the last payout choice forward to a new report.
    const lastRail = r.rail || (D.reports.length ? D.reports[D.reports.length - 1].rail : "");
    const lastAddr = r.address || (D.reports.length ? D.reports[D.reports.length - 1].address : "");
    f.address.value = lastAddr || "";
    f.querySelectorAll("input[name=rail]").forEach((x) => (x.checked = x.value === lastRail));
    f.help.checked = !!r.help;
    const paid = state().paid[k];
    const due = D.dueDates[k - 1];
    $("#fw-report-status").innerHTML = paid
      ? `<span class="fw-badge ok">Paid</span> ${paid.map((p) => sats(p.sats) || `$${p.usd}`).join(" + ")}`
      : r.approved ? `<span class="fw-badge ok">Approved</span> Payment is on its way, ${payLine(k)}.`
      : r.submittedAt ? `<span class="fw-badge">Sent</span> Waiting for approval. You can still edit it.`
      : `<span class="fw-badge ${S_today() > due ? "late" : "due"}">Due ${dayLabel(due)}</span> Once approved, you're ${payLine(k)}.`;
    f.querySelector("button[type=submit]").textContent = r.submittedAt ? "Update report" : "Send report";
  }
  const S_today = () => new Date().toISOString().slice(0, 10);

  function planCard(S) {
    const { me } = S;
    return `<section class="me-card" id="fw-plan"><p class="me-label">Milestones · public</p><h2>Your ${me.months}-month plan</h2>
      <p class="me-small">One goal per month, agreed with your mentor. If priorities shift, your mentor has the final say: just update it here. Tick each one when it's done.</p>
      <form id="fw-plan-form"><ol class="fw-plan">${me.plan.map((p, i) => `<li class="${p.done ? "is-done" : ""}"><span class="fw-m">${i + 1}</span><input type="checkbox" name="done${i}" ${p.done ? "checked" : ""} aria-label="Month ${i + 1} done"><textarea name="goal${i}" rows="2" maxlength="400" aria-label="Month ${i + 1} goal">${esc(p.goal)}</textarea></li>`).join("")}</ol>
      <label class="me-field">PRs to keep moving <span class="fw-hint">(#numbers on your project, or full GitHub links)</span><textarea name="focus" rows="3" maxlength="1500" placeholder="#1105, or a full GitHub link">${esc(me.focus)}</textarea></label>
      <label class="me-field">About you <span class="fw-hint">(public, one or two lines)</span><textarea name="bio" rows="2" maxlength="600">${esc(me.bio)}</textarea></label>
      <label class="me-field">Your links <span class="fw-hint">(public: Nostr, X, blog; one per line)</span><textarea name="links" rows="2" maxlength="600">${esc(me.links)}</textarea></label>
      <label class="me-field">Project repository<input type="url" name="projectUrl" maxlength="300" value="${esc(me.projectUrl)}" placeholder="https://github.com/…"></label>
      <button class="button" type="submit">Save plan</button></form></section>`;
  }

  function payoutsCard(S) {
    const total = D.payouts.reduce((n, p) => n + (p.sats || 0), 0);
    const usd = D.payouts.reduce((n, p) => n + (p.usd || 0), 0);
    const rows = D.payouts.map((p) => `<tr><td>Month ${p.month}</td><td>$${p.usd}</td><td>${sats(p.sats)}</td><td>${p.rate ? `$${Math.round(p.rate).toLocaleString("en-US")}` : ""}</td><td>${p.paidAt ? dayLabel(p.paidAt.slice(0, 10)) : ""}</td></tr>`).join("");
    return `<section class="me-card" id="fw-pay"><p class="me-label">Payouts · private</p><h2>Your payments</h2>
      <p class="fw-private">🔒 Only you and the organisers see this. Never shown publicly.</p>
      ${D.payouts.length ? `<div class="me-stats me-stats-3" style="grid-template-columns:repeat(3,1fr)"><span><strong>${D.payouts.length}</strong>payments</span><span><strong>$${usd.toLocaleString("en-US")}</strong>received</span><span><strong>${(total / 1e8).toFixed(4)}</strong>BTC</span></div>
      <div class="fw-scroll"><table class="fw-pay"><thead><tr><th>For</th><th>USD</th><th>Sats</th><th>BTC price</th><th>Paid</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p>No payments yet. Each month: ${isEnd() ? "send your report by the 21st, it gets approved, and you're paid" : "send your report by the 5th, it gets approved, and you're paid"} <strong>$${D.stipendUsd} in bitcoin</strong> ${isEnd() ? "before the month ends" : "by the 10th"}, at the Coinbase BTC-USD price when we send it.</p>`}
    </section>`;
  }

  function proofCard(S) {
    const url = `${location.origin}/fellowships/f/${encodeURIComponent(D.me.github)}`;
    const text = encodeURIComponent(`I'm a Code Orange developer fellow, building ${D.me.project} in public. My proof of work:`);
    return `<section class="me-card" id="fw-proof"><p class="me-label">Proof of work · public</p><h2>Your public page</h2>
      ${D.me.public ? `<p>Your PRs, reviews, milestones and monthly highlights, updated as you work. Share it with maintainers and anyone hiring.</p>
      <p><a class="button" href="${url}">Open my proof-of-work page</a></p>
      <div class="me-row" style="justify-content:flex-start"><a class="ghost small" href="https://x.com/intent/post?text=${text}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener">Share on X</a><button class="ghost small" type="button" id="fw-copy">Copy link</button></div>`
      : "<p>Your page is private, as agreed. Ask an organiser if you'd like it public.</p>"}
    </section>`;
  }

  function rhythmCard() {
    return `<section class="me-card"><p class="me-label">Your rhythm</p><h2>Every week</h2>
      <ul class="me-check" style="list-style:none">
        <li>🗓️ <strong>Monday:</strong> check-in here: what you did (PR links), what's next, blockers, rough hours</li>
        <li>🔍 <strong>Every week:</strong> review a PR by someone else (3+ a month)</li>
        <li>📞 <strong>Every month:</strong> a call with your mentor${D.me.mentor ? ` (${esc(D.me.mentor)})` : ""}</li>
        <li>🎤 <strong>Code Review Club:</strong> join, and present a PR when it's your turn</li>
        <li>🛡️ <strong>Privacy Track:</strong> 1st &amp; 3rd Tuesday, 07:00 UTC · 15:00 UTC+8</li>
        <li>🧾 <strong>Monthly report:</strong> ${rhythmLine()}</li>
      </ul>
      <p class="me-small"><a href="/fellowships/guidelines">Guidelines</a> · <a href="https://discord.gg/ZtvA79paWa" target="_blank" rel="noopener">#fellowships on Discord</a> · <a href="/calendar">Calendar</a> · <a href="/privacy-track">Privacy Track</a></p>
      <p class="me-small"><button class="ghost small" type="button" id="fw-signout">Sign out on this device</button></p></section>`;
  }

  function wire() {
    const sf = $("#fw-standup-form");
    sf && sf.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await post({ action: "standup", week: D.thisWeek, did: f.did.value, next: f.next.value, blockers: f.blockers.value, links: f.links.value, help: f.help.checked });
        toast(f.help.checked ? "Standup posted. We'll reach out to help." : "Standup posted ✓");
        load();
      } catch (err) { toast(err.message); }
    });
    const rf = $("#fw-report-form");
    if (rf) {
      fillReport(Number(rf.month.value));
      rf.month.addEventListener("change", () => fillReport(Number(rf.month.value)));
      rf.addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = e.target;
        const rail = (f.querySelector("input[name=rail]:checked") || {}).value || "";
        try {
          await post({ action: "report", month: Number(f.month.value), summary: f.summary.value, prs: f.prs.value, reviews: f.reviews.value, other: f.other.value, next: f.next.value, mentorNote: f.mentorNote.value, blockers: f.blockers.value, rail, address: f.address.value, help: f.help.checked });
          toast(`Report sent ✓ We'll review it; once approved you're ${payLine(Number(f.month.value))}.`);
          load();
        } catch (err) { toast(err.message); }
      });
    }
    const pf = $("#fw-plan-form");
    pf && pf.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const plan = D.me.plan.map((_, i) => ({ goal: f[`goal${i}`].value, done: f[`done${i}`].checked }));
      try {
        await post({ action: "plan", plan, bio: f.bio.value, links: f.links.value, projectUrl: f.projectUrl.value, focus: f.focus.value });
        toast("Plan saved ✓");
        load();
      } catch (err) { toast(err.message); }
    });
    const copy = $("#fw-copy");
    copy && copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(`${location.origin}/fellowships/f/${D.me.github}`); toast("Link copied"); } catch { toast("Couldn't copy"); }
    });
    $("#fw-signout").addEventListener("click", () => { store.set(""); signIn(); });
    app.querySelectorAll("[data-check]").forEach((b) => b.addEventListener("click", async () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      const month = D.me.month;
      try {
        const r = await post({ action: "check", month, key: b.dataset.check, on });
        D.checks = r.checks;
        render();
        if (on) toast("Ticked ✓");
      } catch (err) { toast(err.message); }
    }));
    loadPrStates();
  }

  load();
})();
