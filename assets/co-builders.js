// Refreshes the "Latest merged" list on /impact from /api/builders. The page already shows a fallback list.
(function () {
  var feed = document.querySelector("[data-cob-feed]");
  if (!feed || !window.fetch) return;
  var fmt = function (iso) {
    try { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; }
  };
  var esc = function (s) { return String(s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  fetch("/api/builders", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.prs || !d.prs.length) return;
      feed.innerHTML = d.prs.slice(0, 6).map(function (p) {
        return '<li><a href="' + esc(p.url) + '" target="_blank" rel="noopener"><b>' + esc(p.title) + "</b><span>" +
          esc(p.repo) + " · @" + esc(p.author) + " · " + esc(fmt(p.mergedAt)) + "</span></a></li>";
      }).join("");
      var n = document.querySelector("[data-cob-30]");
      var l = document.querySelector("[data-cob-30-label]");
      if (n && l && d.last30Days > 0) { n.textContent = d.last30Days; l.textContent = "merged in the last 30 days"; }
    })
    .catch(function () {});
})();
