// Mentor page (/fellowships/mentor?k=<key>): a private link the organisers send a fellow's mentor.
// The mentor confirms with one click (no email needed) and can follow the fellow's plan,
// this month's to-dos and recent Monday check-ins. Data: /api/fellowship?mentor=<key>.
(() => {
  const API = "/api/fellowship";
  const KEY = "fw-mentor-key";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const store = {
    get() { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch {} },
  };
  // Keep the key out of the address bar (screenshots, shared screens) once it's saved.
  const params = new URLSearchParams(location.search);
  let key = params.get("k") || "";
  if (key) {
    store.set(key);
    params.delete("k");
    history.replaceState(null, "", location.pathname + (params.toString() ? `?${params}` : "") + location.hash);
  } else key = store.get();

  const app = $("#me-app");
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ymLabel = (ym, k = 0) => {
    const n = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + k;
    return `${MONTHS[n % 12]} ${Math.floor(n / 12)}`;
  };
  const dayLabel = (d) => {
    const [y, m, dd] = d.slice(0, 10).split("-").map(Number);
    return `${dd} ${MONTHS[m - 1]} ${y}`;
  };
  const TODOS = { reviews: "3+ reviews", mentor: "Call with you", crc: "Code Review Club", privacy: "Privacy Track", post: "Public post" };
  const prLinks = (text, projectUrl) =>
    esc(text).replace(/(https?:\/\/github\.com\/[^\s<]+\/pull\/(\d+))|#(\d+)/g, (m, url, n1, n2) => {
      const href = url || (projectUrl ? `${projectUrl.replace(/\/$/, "")}/pull/${n2}` : "");
      return href ? `<a href="${href}" target="_blank" rel="noopener">#${n1 || n2}</a>` : m;
    });

  function fail(msg) {
    $("#me-hello").textContent = "Mentor page";
    $("#me-sub").textContent = "";
    app.innerHTML = `<section class="me-card me-wide"><h2>This link didn't open</h2><p>${esc(msg)}</p><p class="me-small">Mentor pages open from the private link the Code Orange team sends you. Ask in Discord or email <a href="mailto:hello@codeorange.dev">hello@codeorange.dev</a>.</p></section>`;
  }

  function render(d) {
    const f = d.fellow;
    const who = f.nick || f.name.split(" ")[0];
    const end = f.schedule === "end";
    const cur = Math.max(1, Math.min(f.month, f.months));
    const cal = f.calendar[cur - 1];
    $("#me-hello").textContent = f.mentor ? `Hi ${f.mentor.split(" ")[0]} 👋` : "Hi 👋";
    $("#me-sub").innerHTML = `You're mentoring <strong>${esc(who)}</strong> on <strong>${esc(f.project)}</strong>, ${ymLabel(f.startMonth)} to ${ymLabel(f.startMonth, f.months - 1)}.`;

    const confirm = d.mentorOk
      ? `<section class="me-card me-wide"><p class="me-label">Mentoring</p><h2>✓ Confirmed on ${dayLabel(d.mentorOk)}</h2><p>Thank you! The Code Orange team has been told. ${d.mentorNote ? `Your note: “${esc(d.mentorNote)}”` : ""}</p></section>`
      : `<section class="me-card me-wide"><p class="me-label">One click</p><h2>Will you mentor ${esc(who)}?</h2>
          <p>What it involves, for ${f.months} month${f.months === 1 ? "" : "s"}:</p>
          <ul class="fw-todo read"><li>A call with ${esc(who)} once a month (30 to 60 minutes)</li><li>A short note for their monthly report, ${end ? "due on the 21st" : "due on the 5th of the next month"}</li><li>A quick reply when they're stuck on a review or a design question</li></ul>
          <form id="mt-ok" class="me-form" style="margin-top:14px">
            <label class="me-field">Your name <input type="text" name="name" value="${esc(f.mentor)}" maxlength="120" autocomplete="name"></label>
            <label class="me-field">A note for the team (optional) <textarea name="note" rows="2" maxlength="1000" placeholder="Best time for calls, anything we should know"></textarea></label>
            <button class="button" type="submit">Yes, I'll mentor ${esc(who)}</button>
          </form></section>`;

    const plan = `<section class="me-card"><p class="me-label">Milestones</p><h2>The ${f.months}-month plan</h2>
      <ol class="fw-plan read">${f.plan.map((p, i) => `<li class="${p.done ? "is-done" : ""}"><span class="fw-m">${i + 1}</span><span><strong>${ymLabel(f.startMonth, i)}</strong> · ${esc(p.goal)}</span></li>`).join("")}</ol>
      ${f.focus ? `<p class="me-small" style="margin-top:12px"><strong>PRs to keep moving:</strong> ${prLinks(f.focus, f.projectUrl)}</p>` : ""}</section>`;

    const ticked = (f.checks || {})[cur] || {};
    const month = `<section class="me-card"><p class="me-label">${f.month < 1 ? `Starts ${ymLabel(f.startMonth)}` : `Month ${cur} · ${ymLabel(f.startMonth, cur - 1)}`}</p><h2>This month</h2>
      <ul class="fw-todo read">${Object.entries(TODOS).map(([k, label]) => `<li class="${ticked[k] ? "is-done" : ""}">${ticked[k] ? "✓" : "○"} ${esc(label)}</li>`).join("")}</ul>
      <p class="me-small" style="margin-top:10px">Their report for this month is due on <strong>${dayLabel(cal.due)}</strong>. It includes a short note from you: ${esc(who)} will ask for it.</p></section>`;

    const ticks = d.weekTicks || {};
    const checkins = `<section class="me-card me-wide"><p class="me-label">Monday check-ins</p><h2>Recent weeks</h2>
      ${d.checkins.length ? `<div class="fw-log">${d.checkins.map((c, i) => `<details ${i === 0 ? "open" : ""}><summary>Week of ${dayLabel(c.week)}${c.hours ? ` · ${c.hours} h` : ""}${c.ticks.includes("blocked") ? " · ⚠️ blocked" : ""}</summary>
        ${c.ticks.length ? `<p>${c.ticks.map((t) => `${t === "blocked" ? "⚠️" : "✓"} ${esc(ticks[t] || t)}`).join(" · ")}</p>` : ""}
        ${c.did ? `<p><strong>Did:</strong> ${esc(c.did)}</p>` : ""}${c.next ? `<p><strong>Next:</strong> ${esc(c.next)}</p>` : ""}${c.blockers ? `<p><strong>Blockers:</strong> ${esc(c.blockers)}</p>` : ""}</details>`).join("")}</div>`
        : `<p>No check-ins yet. ${esc(who)} posts one every Monday${f.month < 1 ? ` once the fellowship starts in ${ymLabel(f.startMonth)}` : ""}.</p>`}
      <p class="me-small" style="margin-top:14px">Public proof of work: <a href="/fellowships/f/${encodeURIComponent(f.github)}">codeorange.dev/fellowships/f/${esc(f.github)}</a> · <a href="/fellowships/guidelines">How the fellowship works</a></p>
      <p class="me-small">This page is private to you. Keep the link to yourself; it's how you open it again.</p></section>`;

    app.innerHTML = confirm + plan + month + checkins;
    const form = $("#mt-ok");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button");
        btn.disabled = true;
        btn.textContent = "Saving…";
        try {
          const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mentor-confirm", key, name: form.name.value, note: form.note.value }) });
          const out = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(out.error || "That didn't save. Please try again.");
          load();
        } catch (err) {
          btn.disabled = false;
          btn.textContent = `Yes, I'll mentor ${who}`;
          alert(err.message);
        }
      });
    }
  }

  function load() {
    if (!key) return fail("There's no mentor key in this link.");
    fetch(`${API}?mentor=${encodeURIComponent(key)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "This page didn't load.");
        render(d);
      })
      .catch((err) => fail(err.message));
  }
  load();
})();
