// Fellowship organiser page (/fellowships/admin): applications, fellows, reports, payouts.
// Uses the same admin key as the Decoding Bitcoin organiser page.
(() => {
  const API = "/api/fellowship";
  const KEY = "mb-admin";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const linkify = (s) => esc(s).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
  const saved = {
    get() { try { return sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || ""; } catch { return ""; } },
    set(v, remember) { try { sessionStorage.setItem(KEY, v); if (remember) localStorage.setItem(KEY, v); } catch {} },
    clear() { try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch {} },
  };
  const app = $("#fw-admin");
  const STATUSES = ["new", "shortlisted", "interview", "waitlist", "accepted", "declined"];
  const FSTATUS = ["green", "yellow", "red", "paused", "graduated", "ended"];
  const READY = { learned: "Finished a course", pr: "Has a PR or review on the project", builds: "Builds and runs tests", time: "15-20 h/week", plan: "Monthly goals", public: "OK with public page", reviews: "Has reviewed PRs", vouch: "Maintainer knows them", privacy: "Privacy project", community: "Shows up" };
  let D;
  let filter = "open";

  function gate(msg) {
    app.innerHTML = `<section class="me-card me-signin"><p class="me-label">Organisers only</p><h2>Admin key</h2>
      <p>${msg ? esc(msg) : "Same key as the Decoding Bitcoin organiser page."}</p>
      <form id="fw-key" class="me-row"><input type="password" name="key" required autocomplete="current-password" style="flex:1;min-width:220px"><button class="button" type="submit">Open</button></form>
      <label class="me-help"><input type="checkbox" id="fw-remember"> <span>Remember on this device</span></label></section>`;
    $("#fw-key").addEventListener("submit", (e) => {
      e.preventDefault();
      saved.set(e.target.key.value, $("#fw-remember").checked);
      load();
    });
  }

  async function call(body) {
    const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", "X-MB-Admin": saved.get() }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "That didn't work.");
    return data;
  }
  async function load() {
    if (!saved.get()) return gate();
    const res = await fetch(`${API}?admin=1`, { headers: { "X-MB-Admin": saved.get() } });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { saved.clear(); return gate("Wrong key. Try again."); }
    if (!res.ok) { app.innerHTML = `<div class="me-card">${esc(data.error || "Didn't load.")}</div>`; return; }
    D = data;
    render();
  }
  const note = (msg) => {
    const t = $("#me-toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(note.t);
    note.t = setTimeout(() => (t.hidden = true), 3500);
  };

  function render() {
    const apps = D.applications;
    const open = apps.filter((a) => !["accepted", "declined"].includes(a.status));
    const active = D.fellows.filter((f) => ["green", "yellow", "red"].includes(f.status));
    const flags = D.fellows.reduce((n, f) => n + f.flags.length, 0);
    app.innerHTML = `
      <section class="me-card"><p class="me-label">Overview</p><h2>Developer fellowship</h2>
        <div class="me-stats"><span><strong>${apps.filter((a) => a.status === "new").length}</strong>new applications</span><span><strong>${open.length}</strong>open applications</span><span><strong>${active.length}</strong>active fellows</span><span><strong>${flags}</strong>things to check</span></div>
        <p class="me-small">Help requests, new applications and reports also arrive by email. Public list: <a href="/fellowships">/fellowships</a>. <button class="ghost small" id="fw-out" type="button">Sign out</button></p></section>
      <section class="me-card"><p class="me-label">Fellows</p><h2>Fellows (${D.fellows.length})</h2>${D.fellows.length ? D.fellows.map(fellowCard).join("") : "<p>No fellows yet. Accept an application below to create one.</p>"}</section>
      <section class="me-card"><p class="me-label">Applications</p><h2>Applications (${apps.length})</h2>
        <div class="fw-filter">${["open", ...STATUSES, "all"].map((s) => `<button type="button" data-filter="${s}" class="${filter === s ? "on" : ""}">${s} (${s === "all" ? apps.length : s === "open" ? open.length : apps.filter((a) => a.status === s).length})</button>`).join("")}</div>
        ${apps.filter((a) => (filter === "all" ? true : filter === "open" ? !["accepted", "declined"].includes(a.status) : a.status === filter)).map(appCard).join("") || "<p>Nothing here.</p>"}</section>`;
    wire();
  }

  function appCard(a) {
    const ready = Object.entries(a.ready || {});
    const yes = ready.filter(([, v]) => v).length;
    const next = new Date();
    next.setUTCMonth(next.getUTCMonth() + 1);
    const ym = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
    return `<article class="fw-app" data-app="${a.id}">
      <h3>${esc(a.name)} <span class="fw-badge">${esc(a.status)}</span></h3>
      <p class="me-small">#${a.id} · ${esc(a.project)} · applied ${a.createdAt.slice(0, 10)} · ready check ${yes}/${ready.length}</p>
      <dl>
        <dt>Contact</dt><dd>${esc(a.email || "")}${a.discord ? ` · Discord ${esc(a.discord)}` : ""}${a.nostr ? ` · ${esc(a.nostr)}` : ""}</dd>
        <dt>GitHub</dt><dd><a href="https://github.com/${esc(a.github)}" target="_blank" rel="noopener">@${esc(a.github)}</a> · <a href="https://github.com/search?q=author%3A${esc(a.github)}+is%3Apr&type=pullrequests" target="_blank" rel="noopener">their PRs</a></dd>
        <dt>Region / hours</dt><dd>${esc(a.region)} · ${esc(a.hours)}</dd>
        <dt>Project</dt><dd>${esc(a.project)} ${a.projectUrl ? linkify(a.projectUrl) : ""}</dd>
        <dt>Proof of work</dt><dd>${linkify(a.proof) || "<em>none given</em>"}</dd>
        <dt>6-month plan</dt><dd>${esc(a.plan)}</dd>
        <dt>Why</dt><dd>${esc(a.why)}</dd>
        <dt>Vouch / mentor</dt><dd>${esc(a.mentor)}</dd>
        <dt>Ready check</dt><dd>${ready.map(([k, v]) => `${v ? "✓" : "✗"} ${esc(READY[k] || k)}`).join(" · ")}</dd>
      </dl>
      <div class="fw-inline"><select data-f="status">${STATUSES.map((s) => `<option ${s === a.status ? "selected" : ""}>${s}</option>`).join("")}</select>
        <input type="text" data-f="notes" placeholder="Private notes" value="${esc(a.notes)}" style="flex:1;min-width:200px"><button class="ghost small" type="button" data-act="save-app">Save</button></div>
      ${a.status !== "accepted" ? `<details><summary class="me-small" style="cursor:pointer">Accept as a fellow…</summary>
        <div class="fw-inline"><label class="me-small">First month <input type="month" data-f="start" value="${ym}"></label>
        <input type="text" data-f="mentor" placeholder="Mentor (name)"><input type="text" data-f="project" value="${esc(a.project)}">
        <label class="me-small"><input type="checkbox" data-f="email" checked> email them their dashboard link</label>
        <button class="button small" type="button" data-act="accept">Accept</button></div>
        <p class="me-small">The guidelines say: only start once a mentor is confirmed.</p></details>` : ""}
    </article>`;
  }

  function fellowCard(f) {
    const rep = Object.fromEntries(f.reports.map((r) => [r.month, r]));
    const months = Array.from({ length: f.months }, (_, i) => i + 1);
    return `<article class="fw-app" data-fellow="${f.id}">
      <h3><span class="fw-dot ${esc(f.status)}"></span> ${esc(f.name)} <span class="fw-badge">${esc(f.status)}</span></h3>
      <p class="me-small">@${esc(f.github)} · ${esc(f.project)} · ${f.month < 1 ? `starts ${f.startMonth}` : `month ${f.month} of ${f.months}`} · ${f.standups.length} standups · $${f.paidUsd} paid
        · <a href="/fellowships/f/${encodeURIComponent(f.github)}" target="_blank">public page</a> · <button class="ghost small" type="button" data-act="copy-link" data-link="${esc(location.origin)}/fellowships/me?me=${esc(f.token)}">copy dashboard link</button></p>
      ${f.flags.length ? `<p>${f.flags.map((x) => `<span class="fw-flag">${esc(x)}</span>`).join("")}</p>` : ""}
      <div class="fw-inline">
        <select data-f="status">${FSTATUS.map((s) => `<option ${s === f.status ? "selected" : ""}>${s}</option>`).join("")}</select>
        <input type="text" data-f="mentor" placeholder="Mentor" value="${esc(f.mentor)}">
        <label class="me-small">Start <input type="month" data-f="start" value="${esc(f.startMonth)}"></label>
        <label class="me-small">Months <input type="number" data-f="months" min="1" max="12" value="${f.months}" style="width:70px;min-width:0"></label>
        <label class="me-small"><input type="checkbox" data-f="public" ${f.public ? "checked" : ""}> public page</label>
        <input type="text" data-f="notes" placeholder="Private notes" value="${esc(f.notes)}" style="flex:1;min-width:180px">
        <button class="ghost small" type="button" data-act="save-fellow">Save</button></div>
      <details><summary class="me-small" style="cursor:pointer">Reports and payouts</summary>
        <div class="fw-scroll"><table class="fw-pay"><thead><tr><th>Month</th><th>Due</th><th>Report</th><th>Paid</th></tr></thead><tbody>
        ${months.map((k) => {
          const r = rep[k];
          const p = f.payouts.filter((x) => x.month === k);
          return `<tr><td>${k}</td><td>${f.dueDates[k - 1]}</td><td>${r ? `${r.approved ? "✓ approved" : "sent"} <button class="ghost small" type="button" data-act="approve" data-month="${k}" data-to="${!r.approved}">${r.approved ? "un-approve" : "approve"}</button>${r.help ? ' <span class="fw-flag">help</span>' : ""}` : "—"}</td>
            <td>${p.map((x) => `${x.sats ? x.sats.toLocaleString("en-US") + " sats" : "$" + x.usd} (${(x.paidAt || "").slice(0, 10)}) <button class="ghost small" type="button" data-act="del-pay" data-pay="${x.id}" title="Delete payout">×</button>`).join("<br>") || "—"}</td></tr>`;
        }).join("")}</tbody></table></div>
        ${f.reports.map((r) => `<div class="fw-log"><details><summary>Month ${r.month} report (${(r.submittedAt || "").slice(0, 10)})</summary>
          <p>${linkify(r.summary)}</p>${r.prs ? `<p><strong>PRs</strong><br>${linkify(r.prs)}</p>` : ""}${r.reviews ? `<p><strong>Reviews</strong><br>${linkify(r.reviews)}</p>` : ""}${r.other ? `<p><strong>Other</strong><br>${linkify(r.other)}</p>` : ""}${r.next ? `<p><strong>Next</strong> ${linkify(r.next)}</p>` : ""}${r.blockers ? `<p><strong>Got in the way (private)</strong> ${linkify(r.blockers)}</p>` : ""}
          <p><strong>Pay by (private)</strong> ${esc(r.rail || "not given")} · <code style="word-break:break-all">${esc(r.address || "no address")}</code></p></details></div>`).join("")}
        <p class="me-label" style="margin-top:14px">Record a payout</p>
        <div class="fw-inline">
          <label class="me-small">Month <select data-p="month">${months.map((k) => `<option ${k === Math.max(1, Math.min(f.month - 1, f.months)) ? "selected" : ""}>${k}</option>`).join("")}</select></label>
          <label class="me-small">USD <input type="number" data-p="usd" value="512" style="width:90px;min-width:0"></label>
          <label class="me-small">BTC price <input type="number" data-p="rate" step="0.01" style="width:120px;min-width:0"></label>
          <button class="ghost small" type="button" data-act="rate">Coinbase price now</button>
          <label class="me-small">Sats <input type="number" data-p="sats" style="width:130px;min-width:0"></label>
          <select data-p="rail"><option>lightning</option><option>onchain</option><option>ecash</option></select>
          <input type="text" data-p="ref" placeholder="txid / payment hash (private)">
          <label class="me-small">Paid <input type="date" data-p="paidAt" value="${new Date().toISOString().slice(0, 10)}"></label>
          <button class="button small" type="button" data-act="pay">Save payout</button></div>
      </details>
      <details><summary class="me-small" style="cursor:pointer">Standups (${f.standups.length})</summary><div class="fw-log">
        ${f.standups.slice(0, 12).map((s) => `<details><summary>Week of ${s.week}${s.help ? ' <span class="fw-flag">help</span>' : ""}</summary>${s.did ? `<p><strong>Did</strong> ${linkify(s.did)}</p>` : ""}${s.next ? `<p><strong>Next</strong> ${linkify(s.next)}</p>` : ""}${s.blockers ? `<p><strong>Blocked</strong> ${linkify(s.blockers)}</p>` : ""}${s.links ? `<p>${linkify(s.links)}</p>` : ""}</details>`).join("") || "<p>None yet.</p>"}</div></details>
    </article>`;
  }

  function wire() {
    $("#fw-out").onclick = () => { saved.clear(); gate(); };
    app.querySelectorAll("[data-filter]").forEach((b) => (b.onclick = () => { filter = b.dataset.filter; render(); }));
    app.onclick = async (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const card = b.closest("[data-app], [data-fellow]");
      const val = (sel) => card.querySelector(sel);
      try {
        switch (b.dataset.act) {
          case "save-app":
            await call({ action: "admin-app", id: Number(card.dataset.app), status: val("[data-f=status]").value, notes: val("[data-f=notes]").value });
            note("Saved");
            return load();
          case "accept": {
            const r = await call({ action: "admin-accept", id: Number(card.dataset.app), start: val("[data-f=start]").value, mentor: val("[data-f=mentor]").value, project: val("[data-f=project]").value, email: val("[data-f=email]").checked });
            note(r.emailed ? "Accepted, and their dashboard link was emailed." : "Accepted. Copy their dashboard link from the fellow card.");
            return load();
          }
          case "save-fellow":
            await call({ action: "admin-fellow", id: Number(card.dataset.fellow), status: val("[data-f=status]").value, mentor: val("[data-f=mentor]").value, start: val("[data-f=start]").value, months: Number(val("[data-f=months]").value), public: val("[data-f=public]").checked, notes: val("[data-f=notes]").value });
            note("Saved");
            return load();
          case "approve":
            await call({ action: "admin-approve", id: Number(card.dataset.fellow), month: Number(b.dataset.month), approved: b.dataset.to === "true" });
            return load();
          case "rate": {
            const res = await fetch(`${API}?admin=1&rate=1`, { headers: { "X-MB-Admin": saved.get() } });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error);
            val("[data-p=rate]").value = d.rate;
            const usd = Number(val("[data-p=usd]").value) || 512;
            val("[data-p=sats]").value = Math.round((usd / d.rate) * 1e8);
            note(`Coinbase BTC-USD: $${d.rate.toLocaleString("en-US")} at ${d.at.slice(11, 16)} UTC`);
            return;
          }
          case "pay": {
            const g = (k) => val(`[data-p=${k}]`).value;
            const r = await call({ action: "admin-payout", id: Number(card.dataset.fellow), month: Number(g("month")), usd: Number(g("usd")), rate: Number(g("rate")) || null, sats: Number(g("sats")) || null, rail: g("rail"), ref: g("ref"), paidAt: g("paidAt") });
            note(`Payout saved${r.sats ? `: ${r.sats.toLocaleString("en-US")} sats` : ""}`);
            return load();
          }
          case "del-pay":
            if (!confirm("Delete this payout record?")) return;
            await call({ action: "admin-payout-delete", payout: Number(b.dataset.pay) });
            return load();
          case "copy-link":
            await navigator.clipboard.writeText(b.dataset.link);
            note("Dashboard link copied. It signs them in: send it only to them.");
            return;
        }
      } catch (err) {
        note(err.message);
      }
    };
  }

  load();
})();
