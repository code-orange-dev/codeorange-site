// Fellowship application (/fellowships/apply): readiness check, then the form, posted to /api/fellowship.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const DRAFT = "fw-apply-draft";

  // key, label, why, highly recommended, what to do if not yet
  const CHECKS = [
    ["learned", "I've finished a Bitcoin dev course or serious self-study", "Decoding Bitcoin, Chaincode, Summer of Bitcoin, Btrust, or your own deep study.", true, 'Join <a href="/decoding-bitcoin">Decoding Bitcoin</a> (free, 10 weeks) or the <a href="/privacy-track">Privacy Track</a>.'],
    ["pr", "I've opened at least one PR (or written a real review) on the project I want to work on", "Small is fine. It proves you can find your way around the codebase.", true, "Pick a good first issue on your project and open a PR. Ask in #fellowships on Discord if you're stuck finding one."],
    ["builds", "I can build the project and run its tests on my machine", "", true, "Follow the project's CONTRIBUTING or build guide until the tests pass. That's day one of the fellowship anyway."],
    ["time", "I can give 10–15 hours a week for 6 months", "", true, "If your time is tighter right now, apply in a later round. Pausing is allowed, but the fellowship needs steady weeks."],
    ["plan", "I have a goal for each of the 6 months", "", true, "Talk to the project: read open issues and the roadmap, then sketch one goal per month."],
    ["public", "I'm okay with my work being shown on a public proof-of-work page", "Payments stay private. If being public is risky where you live, tell us and we'll keep it private.", true, "Read the public vs private table in the guidelines."],
    ["clubs", "I'll join Code Review Club and the Privacy Track, and present my work at Code Review Club", "Present at least once every 2 months. Privacy Track: 1st & 3rd Tuesday, 07:00 UTC.", true, 'Drop into a <a href="/calendar">Code Review Club or Privacy Track session</a> before you apply.'],
    ["reviews", "I've reviewed someone else's PR", "", false, "Review one open PR on your project this week. Even questions count."],
    ["vouch", "A maintainer or contributor of the project knows my work", "", false, "Introduce yourself in the project's chat and ask for feedback on your first PR."],
    ["privacy", "My project is on the Privacy Track list", "Payjoin, Silent Payments, Floresta, JoinMarket, OpenSwap, Fedimint, ecash.", false, ""],
    ["community", "I show up: Code Review Club, BitDevs, project calls or Discord", "", false, 'Drop into <a href="/calendar">a session</a> this month.'],
  ];

  const draft = (() => { try { return JSON.parse(localStorage.getItem(DRAFT) || "{}"); } catch { return {}; } })();
  const saveDraft = () => { try { localStorage.setItem(DRAFT, JSON.stringify(draft)); } catch {} };
  draft.ready ||= {};

  const ready = $("#fw-ready");
  ready.innerHTML = CHECKS.map(([k, label, why, must]) => `<label><input type="checkbox" data-k="${k}" ${draft.ready[k] ? "checked" : ""}><span>${esc(label)}${must ? '<span class="must">Highly recommended</span>' : ""}${why ? `<small>${esc(why)}</small>` : ""}</span></label>`).join("");

  function verdict() {
    const musts = CHECKS.filter((c) => c[3]);
    const missing = musts.filter((c) => !draft.ready[c[0]]);
    const extras = CHECKS.filter((c) => !c[3] && draft.ready[c[0]]).length;
    const score = CHECKS.filter((c) => draft.ready[c[0]]).length;
    $("#fw-meter").style.width = `${Math.round((score / CHECKS.length) * 100)}%`;
    let html;
    const list = `<ul>${missing.map((c) => `<li><strong>${esc(c[1])}.</strong> ${c[4]}</li>`).join("")}</ul>`;
    if (!missing.length) {
      html = `<h3>🟠 You're ready. Apply below.</h3><p class="me-small" style="margin:0">${extras >= 2 ? "Strong application: you tick the boxes that make people stand out." : "To make it stronger, review a PR or get a maintainer to vouch for you before you send it."}</p>`;
    } else if (musts.length - missing.length >= 4) {
      html = `<h3>🟠 Looking good. Apply below.</h3><p class="me-small" style="margin:0 0 4px">You don't need every box ticked. These would make your application even stronger:</p>${list}`;
    } else {
      html = `<h3>You can still apply.</h3><p class="me-small" style="margin:0 0 4px">These are the things that help most. Working on a few of them first makes a big difference:</p>${list}`;
    }
    $("#fw-verdict").innerHTML = html;
  }
  ready.addEventListener("change", (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    draft.ready[k] = e.target.checked;
    saveDraft();
    verdict();
  });
  verdict();

  // ── Form ──
  const form = $("#fw-form");
  const PLAN_HINT = "Month 1: …\nMonth 2: …\nMonth 3: …\nMonth 4: …\nMonth 5: …\nMonth 6: …";
  form.plan.placeholder = PLAN_HINT;
  for (const el of form.elements) {
    if (!el.name || el.name === "website") continue;
    if (draft[el.name] != null) el.type === "checkbox" ? (el.checked = !!draft[el.name]) : (el.value = draft[el.name]);
  }
  const params = new URLSearchParams(location.search);
  if (params.get("project") && !form.project.value) {
    const want = params.get("project").toLowerCase();
    const opt = [...form.project.options].find((o) => o.text.toLowerCase().includes(want));
    if (opt) form.project.value = opt.value || opt.text;
  }
  const otherBox = $("#fw-other");
  const syncOther = () => { otherBox.hidden = form.project.value !== "other"; };
  const planCount = () => {
    const n = form.plan.value.trim().length;
    $("#fw-plan-count").textContent = n < 200 ? `${n} / 200 characters at least` : `${n} characters ✓`;
  };
  syncOther();
  planCount();
  form.addEventListener("input", (e) => {
    const el = e.target;
    if (!el.name || el.name === "website") return;
    draft[el.name] = el.type === "checkbox" ? el.checked : el.value;
    saveDraft();
    if (el.name === "plan") planCount();
  });
  form.project.addEventListener("change", syncOther);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const note = $("#fw-note");
    const btn = form.querySelector("button[type=submit]");
    const v = (n) => form[n].value.trim();
    const project = form.project.value === "other" ? v("projectOther") : form.project.value;
    const problem =
      v("name").length < 2 ? "Please add your name (a nym is fine)." :
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v("email")) ? "Please check your email." :
      !v("github") ? "Please add your GitHub username." :
      !project ? "Which project do you want to work on?" :
      v("plan").length < 200 ? "Your 6-month plan needs a goal for each month (200 characters at least)." :
      !form.agree.checked ? "Please tick that you've read the guidelines." : "";
    if (problem) {
      note.textContent = problem;
      return;
    }
    btn.disabled = true;
    note.textContent = "Sending…";
    try {
      const res = await fetch("/api/fellowship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          name: v("name"), email: v("email"), github: v("github"), discord: v("discord"), nostr: v("nostr"), region: v("region"),
          project, project_url: v("project_url"), hours: form.hours.value, proof: v("proof"), plan: v("plan"), why: v("why"), mentor: v("mentor"),
          agree: form.agree.checked, ready: draft.ready, website: form.website.value,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That didn't work. Please try again.");
      try { localStorage.removeItem(DRAFT); } catch {}
      $("#fw-apply").innerHTML = `<div class="fw-done"><p class="me-label">Application sent</p><h2>Thank you, ${esc(v("name"))}! 🧡</h2>
        <p>We've emailed you a copy of your application. We'll get in touch with you directly within 2 weeks.</p>
        <p>Best thing to do while you wait: keep building. Open or review a PR on ${esc(project)} and share it in #fellowships.</p>
        <div class="fw-cta" style="justify-content:center"><a class="button" href="https://discord.gg/ZtvA79paWa" target="_blank" rel="noopener">Join #fellowships on Discord</a><a class="ghost" href="/fellowships/guidelines">Re-read the guidelines</a></div></div>`;
      $("#fw-apply").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      note.textContent = err.message;
      btn.disabled = false;
    }
  });
})();
