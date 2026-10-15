// "Up next" strip on the homepage: the next three different sessions from the Google Calendar (/api/calendar).
// The section stays hidden if the calendar can't be loaded.
(function () {
  var box = document.querySelector("[data-upnext]");
  if (!box || !window.fetch) return;
  var TZ = "Asia/Makassar";
  var esc = function (s) { return String(s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var fmt = function (d, opts) { return new Intl.DateTimeFormat("en-GB", Object.assign({ timeZone: TZ }, opts)).format(d); };
  fetch("/api/calendar", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.events) return;
      var now = Date.now(), seen = {}, picks = [];
      d.events
        .filter(function (e) { return !e.allDay && Date.parse(e.end) > now; })
        .sort(function (a, b) { return Date.parse(a.start) - Date.parse(b.start); })
        .forEach(function (e) {
          var k = e.title.toLowerCase();
          if (picks.length < 3 && !seen[k]) { seen[k] = 1; picks.push(e); }
        });
      if (!picks.length) return;
      var here = Intl.DateTimeFormat().resolvedOptions().timeZone;
      box.querySelector("[data-upnext-list]").innerHTML = picks.map(function (e) {
        var s = new Date(e.start), live = Date.parse(e.start) <= now;
        var local = here && here !== TZ && fmt(s, { hour: "2-digit", minute: "2-digit" }) !== new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(s)
          ? '<small>' + esc(s.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })) + " your time</small>" : "";
        var where = /discord/i.test(e.location + " " + (e.url || "")) ? "Online · Discord" : (e.location ? e.location.split(",")[0] : "Code Orange");
        return '<a class="co-upnext-card" href="' + esc(e.url || "/calendar") + '"' + (e.url ? ' target="_blank" rel="noopener"' : "") + ">" +
          '<span class="co-upnext-date"><b>' + esc(fmt(s, { weekday: "short" })) + "</b>" + esc(fmt(s, { day: "numeric" })) + "<i>" + esc(fmt(s, { month: "short" })) + "</i></span>" +
          '<span class="co-upnext-text">' + (live ? '<em>Live now</em>' : "") + "<strong>" + esc(e.title) + "</strong>" +
          "<span>" + esc(fmt(s, { hour: "numeric", minute: "2-digit", hour12: true })) + " Bali time · " + esc(where) + "</span>" + local + "</span></a>";
      }).join("");
      box.hidden = false;
    })
    .catch(function () {});
})();
