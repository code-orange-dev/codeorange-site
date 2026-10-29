// Public proof-of-work page for one fellow (/fellowships/f/<github>), and the fellows list on
// /fellowships (#fw-fellows). Only public data comes from /api/fellowship: no payouts, ever.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ymLabel = (ym, k = 0) => {
    const n = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + k;
    return `${MONTHS[n % 12]} ${Math.floor(n / 12)}`;
  };
  const day = (iso) => {
    const d = new Date(iso);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };
  const linkify = (s) => esc(s).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 70)}</a>`);
  const avatar = (gh, size) => `https://github.com/${encodeURIComponent(gh)}.png?size=${size}`;
  const progress = (f) => Math.max(0, Math.min(f.month, f.months));

  // ── The list on /fellowships ──
  const list = $("#fw-fellows");
  if (list) {
    fetch("/api/fellowship?fellows=1")
      .then((r) => (r.ok ? r.json() : { fellows: [] }))
      .then(({ fellows }) => {
        if (!fellows || !fellows.length) return;
        $("#fw-fellows-grid").innerHTML = fellows
          .map((f) => `<a class="fw-person" href="/fellowships/f/${encodeURIComponent(f.github)}"><img src="${avatar(f.github, 112)}" alt="" loading="lazy" width="56" height="56"><strong>${esc(f.name)}</strong><span>${esc(f.project)}</span>
            <span>${f.graduated ? "Graduated 🎓" : f.month < 1 ? `Starts ${ymLabel(f.startMonth)}` : `Month ${progress(f)} of ${f.months}`} · ${f.milestonesDone}/${f.months} milestones</span>
            <div class="fw-bar"><i style="width:${Math.round((progress(f) / f.months) * 100)}%"></i></div></a>`)
          .join("");
        list.hidden = false;
      })
      .catch(() => {});
    return;
  }

  // ── One fellow ──
  const app = $("#fw-pow");
  if (!app) return;
  const m = location.pathname.match(/\/fellowships\/f\/([^/]+)/);
  const handle = decodeURIComponent((m && m[1]) || new URLSearchParams(location.search).get("f") || "");
  const prItem = (p) => `<li><span class="fw-state ${esc(p.state)}">${esc(p.state)}</span><div style="min-width:0"><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a><small>${esc(p.repo)} · ${day(p.createdAt)}</small></div></li>`;

  // Give each fellow's page its own canonical URL and description; hide empty or unknown pages from search.
  function setHead(canonical, description) {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
    link.href = canonical;
    const meta = document.querySelector('meta[name="description"]');
    if (meta && description) meta.content = description;
  }
  function noindex() {
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.content = "noindex, follow";
  }

  function render(d) {
    const f = d.fellow;
    const gh = d.github;
    const merged = gh.prs.filter((p) => p.state === "merged").length;
    const projects = new Set([...gh.prs, ...gh.reviews].map((p) => p.repo)).size;
    document.title = `${f.name} · Code Orange developer fellow`;
    setHead(`https://codeorange.dev/fellowships/f/${encodeURIComponent(handle)}`, `${f.name} is building ${f.project} as a Code Orange developer fellow: public pull requests, reviews and monthly reports.`);
    $("#me-hello").textContent = f.name;
    $("#me-sub").innerHTML = `Code Orange developer fellow building <strong>${esc(f.project)}</strong> · ${f.graduated ? "Graduated 🎓" : f.month < 1 ? `starts ${ymLabel(f.startMonth)}` : f.month > f.months ? "Fellowship finished" : `month ${f.month} of ${f.months}`}`;
    const links = (f.links || "").split(/\s+/).filter((u) => /^https?:\/\//.test(u));
    const url = location.origin + location.pathname;
    const share = encodeURIComponent(`${f.name} is building ${f.project} as a Code Orange developer fellow. Proof of work:`);
    app.innerHTML = `
      <section class="me-card me-wide">
        <img class="fw-avatar" src="${avatar(f.github, 176)}" alt="" width="88" height="88">
        <p class="me-label">Proof of work</p>
        <h2>${esc(f.project)}</h2>
        ${f.bio ? `<p>${esc(f.bio)}</p>` : ""}
        <p class="fw-links"><a href="https://github.com/${encodeURIComponent(f.github)}" target="_blank" rel="noopener">GitHub @${esc(f.github)}</a>${f.projectUrl ? `<a href="${esc(f.projectUrl)}" target="_blank" rel="noopener">Project repo</a>` : ""}${links.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 40))}</a>`).join("")}</p>
        <div class="me-stats"><span><strong>${gh.prs.length}</strong>PRs opened</span><span><strong>${merged}</strong>merged</span><span><strong>${gh.reviews.length}</strong>PRs reviewed</span><span><strong>${d.standupWeeks}</strong>weekly standups</span></div>
        <div class="fw-bar" title="Fellowship progress"><i style="width:${Math.round((progress(f) / f.months) * 100)}%"></i></div>
        <p class="me-small" style="margin-top:8px">${ymLabel(f.startMonth)} to ${ymLabel(f.startMonth, f.months - 1)}${f.mentor ? ` · mentored by ${esc(f.mentor)}` : ""} ${projects ? ` · work since the fellowship started, on ${projects} project${projects === 1 ? "" : "s"}` : ""}</p>
        <div class="me-row" style="justify-content:flex-start"><a class="ghost small" href="https://x.com/intent/post?text=${share}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener">Share on X</a><button class="ghost small" type="button" id="fw-copy">Copy link</button></div>
      </section>
      <section class="me-card"><p class="me-label">Milestones</p><h2>The ${f.months}-month plan</h2>
        <ol class="fw-plan read">${f.plan.map((p, i) => `<li class="${p.done ? "is-done" : ""}"><span class="fw-m">${i + 1}</span><span>${esc(p.goal)}</span></li>`).join("")}</ol></section>
      <section class="me-card"><p class="me-label">Live from GitHub</p><h2>Pull requests</h2>
        ${gh.prs.length ? `<ul class="fw-prs">${gh.prs.slice(0, 20).map(prItem).join("")}</ul>` : `<p>${gh.ok ? "No pull requests yet since the fellowship started." : "GitHub didn't answer just now. Try again in a bit."}</p>`}
        <h2 style="margin-top:22px">Reviews</h2>
        ${gh.reviews.length ? `<ul class="fw-prs">${gh.reviews.slice(0, 20).map(prItem).join("")}</ul>` : "<p>No reviews yet since the fellowship started.</p>"}
      </section>
      <section class="me-card me-wide"><p class="me-label">Monthly reports</p><h2>Month by month</h2>
        ${d.reports.length ? `<div class="fw-log">${d.reports.map((r, i) => `<details ${i === 0 ? "open" : ""}><summary>Month ${r.month} · ${ymLabel(f.startMonth, r.month - 1)}</summary><p>${linkify(r.summary)}</p>${r.prs ? `<p><strong>PRs:</strong><br>${linkify(r.prs)}</p>` : ""}${r.reviews ? `<p><strong>Reviews:</strong><br>${linkify(r.reviews)}</p>` : ""}${r.other ? `<p><strong>Other work:</strong><br>${linkify(r.other)}</p>` : ""}${r.next ? `<p><strong>Next:</strong> ${linkify(r.next)}</p>` : ""}</details>`).join("")}</div>` : "<p>The first monthly report appears here after month 1.</p>"}
        <p class="me-small" style="margin-top:14px">Code Orange developer fellows build Bitcoin and Nostr open source with a mentor. <a href="/fellowships/guidelines">How the fellowship works</a> · <a href="/fellowships/apply">Apply</a></p>
      </section>`;
    $("#fw-copy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(url); $("#fw-copy").textContent = "Copied ✓"; } catch {}
    });
  }

  if (!handle) {
    noindex();
    app.innerHTML = '<div class="me-card me-wide">No fellow picked. <a href="/fellowships">See all fellows</a>.</div>';
    return;
  }
  fetch(`/api/fellowship?fellow=${encodeURIComponent(handle)}`)
    .then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "This page didn't load.");
      render(d);
    })
    .catch((err) => {
      noindex();
      $("#me-hello").textContent = "Fellow not found";
      $("#me-sub").textContent = "";
      app.innerHTML = `<div class="me-card me-wide">${esc(err.message)} <a href="/fellowships">See all fellows</a>.</div>`;
    });
})();
