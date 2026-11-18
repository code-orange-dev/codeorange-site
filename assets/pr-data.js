// Code Orange PR data: one source of truth for every page that shows PR numbers.
// The data is data/prs.json in github.com/code-orange-dev/PR-tracking-dashboard, served through
// /api/pr-data (cached) with a direct GitHub fallback. Pages keep their printed numbers as a
// fallback; this script replaces them once the live data arrives.
//
// Markup hooks, filled automatically:
//   data-pr-stat="merged|open|repos|contributors|mergedSinceJoining|checked"
//   data-pr-person="<github login>"    -> "<n> merged"
//   data-pr-projects="<github login>"  -> "Merged PRs in: a, b, c."
(function () {
  var RAW = "https://raw.githubusercontent.com/code-orange-dev/PR-tracking-dashboard/main/data/prs.json";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function monthKey(m) {
    var p = String(m || "").split(" ");
    return (+p[1] || 0) * 12 + Math.max(0, MONTHS.indexOf(p[0]));
  }

  function longDate(iso) {
    try { return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }); }
    catch (e) { return iso; }
  }

  // prs.json -> the shape the pages use
  function normalize(raw) {
    var names = {}, notes = {};
    raw.contributors.forEach(function (c) { names[c.github] = c.name; notes[c.github] = c.note || ""; });
    var prs = raw.prs.map(function (p) {
      var proj = raw.projects[p.repo] || { name: p.repo };
      return {
        contributor: names[p.github] || p.github, github: p.github, project: proj.name, key: !!proj.key,
        education: !!proj.education, repo: p.repo, number: p.number,
        url: "https://github.com/" + p.repo + "/pull/" + p.number, note: p.note || "", status: p.status,
        date: p.month, monthKey: monthKey(p.month), pre: !!p.beforeJoining, fresh: p.firstSeen === raw.checked
      };
    });
    prs.sort(function (a, b) { return b.monthKey - a.monthKey || b.number - a.number; });
    var merged = prs.filter(function (p) { return p.status === "merged"; });
    var open = prs.filter(function (p) { return p.status === "open"; });
    var contributors = raw.contributors.map(function (c) {
      var mine = merged.filter(function (p) { return p.github === c.github; });
      var projects = [];
      mine.slice().sort(function (a, b) { return (b.key - a.key); }).forEach(function (p) { if (projects.indexOf(p.project) < 0) projects.push(p.project); });
      return {
        name: c.name, github: c.github, note: c.note || "", merged: mine.length,
        mergedSinceJoining: mine.filter(function (p) { return !p.pre; }).length,
        open: open.filter(function (p) { return p.github === c.github; }).length, projects: projects,
        first: mine.length ? mine[mine.length - 1].date : "", latest: mine.length ? mine[0].date : ""
      };
    }).sort(function (a, b) { return b.merged - a.merged; });
    var repos = {};
    merged.forEach(function (p) { repos[p.repo.toLowerCase()] = 1; });
    return {
      checked: raw.checked, updated: longDate(raw.checked), prs: prs, merged: merged, open: open,
      contributors: contributors,
      fresh: prs.filter(function (p) { return p.fresh; }),
      stats: {
        merged: merged.length, open: open.length, repos: Object.keys(repos).length,
        contributors: contributors.filter(function (c) { return c.merged > 0; }).length,
        mergedSinceJoining: merged.filter(function (p) { return !p.pre; }).length,
        checked: longDate(raw.checked)
      }
    };
  }

  function getJSON(url) {
    return fetch(url, { headers: { Accept: "application/json" } }).then(function (r) {
      if (!r.ok) throw new Error(url + " " + r.status);
      return r.json();
    });
  }

  var promise = null;
  function load() {
    if (!promise) {
      promise = getJSON("/api/pr-data").catch(function () { return getJSON(RAW); }).then(function (raw) {
        if (!raw || !raw.prs || !raw.contributors) throw new Error("bad PR data");
        return normalize(raw);
      });
    }
    return promise;
  }

  function fill(d) {
    var q = function (sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); };
    q("[data-pr-stat]", function (el) {
      var v = d.stats[el.getAttribute("data-pr-stat")];
      if (v !== undefined) el.textContent = v;
    });
    var by = {};
    d.contributors.forEach(function (c) { by[c.github.toLowerCase()] = c; });
    q("[data-pr-person]", function (el) {
      var c = by[el.getAttribute("data-pr-person").toLowerCase()];
      if (c) el.textContent = c.merged + " merged";
    });
    q("[data-pr-projects]", function (el) {
      var c = by[el.getAttribute("data-pr-projects").toLowerCase()];
      if (!c || !c.projects.length) return;
      var short = [];
      c.projects.forEach(function (n) { n = n.replace(/ \(.*\)$/, ""); if (short.indexOf(n) < 0) short.push(n); });
      el.textContent = "Merged PRs in: " + short.join(", ") + ".";
    });
  }

  window.coPR = { load: load, normalize: normalize, fill: fill, monthKey: monthKey, MONTHS: MONTHS };
  if (window.fetch && document.querySelector("[data-pr-stat],[data-pr-person],[data-pr-projects]")) {
    load().then(fill).catch(function () {});
  }
})();
