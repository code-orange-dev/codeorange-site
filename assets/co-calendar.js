// Code Orange calendar widget: replaces the Google Calendar embed with a black/orange
// month + list view built from /api/calendar. If the feed can't be loaded the original
// Google iframe stays, so the page never ends up without a calendar.
(function () {
  "use strict";
  var TZ = "Asia/Makassar";
  var TZ_LABEL = "Bali time (UTC+8)";
  var CAL_ID = "466de2be7431d78be2049f96f5fd31f9b06b5a9cd94f909ba3182b18442ed499@group.calendar.google.com";
  var SUBSCRIBE = "https://calendar.google.com/calendar/r?cid=" + encodeURIComponent(CAL_ID);
  var WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var MAX_CHIPS = 3;

  // Pages mark the embed with data-cocal-src instead of src, so Google's heavy embed is
  // only downloaded if our own calendar can't load.
  var frames = [].slice.call(document.querySelectorAll('iframe[data-cocal-src], iframe[src*="calendar.google.com/calendar/embed"]'));
  if (!frames.length) return;
  function fallback(f) {
    if (f.getAttribute("data-cocal-src") && !f.getAttribute("src")) f.src = f.getAttribute("data-cocal-src");
    f.style.display = "";
  }
  if (!window.fetch) { frames.forEach(fallback); return; }

  // ---------- date helpers (everything is shown in the calendar's own zone) ----------
  var partsFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23", weekday: "short" });
  function zparts(iso) {
    if (iso.length === 10) {
      var a = iso.split("-");
      var wd = new Date(Date.UTC(+a[0], +a[1] - 1, +a[2])).getUTCDay();
      return { y: +a[0], m: +a[1], d: +a[2], h: 0, mi: 0, wd: wd };
    }
    var p = {};
    partsFmt.formatToParts(new Date(iso)).forEach(function (x) { p[x.type] = x.value; });
    return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
  }
  function dkey(p) { return p.y + "-" + (p.m < 10 ? "0" : "") + p.m + "-" + (p.d < 10 ? "0" : "") + p.d; }
  function todayParts() { return zparts(new Date().toISOString()); }
  function shortTime(p) {
    var h = p.h % 12 || 12;
    return h + (p.mi ? ":" + (p.mi < 10 ? "0" : "") + p.mi : "") + (p.h < 12 ? "am" : "pm");
  }
  function timeRange(ev) {
    if (ev.allDay) return "All day";
    return shortTime(zparts(ev.start)) + " – " + shortTime(zparts(ev.end));
  }
  function longDate(p) {
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][p.wd] + ", " + p.d + " " + MONTHS[p.m - 1] + " " + p.y;
  }
  function viewerTime(ev) {
    if (ev.allDay) return "";
    try {
      var here = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!here || new Date(ev.start).toLocaleString("en-US", { timeZone: here }) === new Date(ev.start).toLocaleString("en-US", { timeZone: TZ })) return "";
      return new Date(ev.start).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) + " your time";
    } catch (e) { return ""; }
  }
  function gcalLink(ev) {
    var f = function (iso) { return iso.length === 10 ? iso.replace(/-/g, "") : iso.replace(/[-:]/g, "").replace(/\.\d{3}/, ""); };
    var q = "action=TEMPLATE&text=" + encodeURIComponent(ev.title) + "&dates=" + f(ev.start) + "/" + f(ev.end) +
      "&details=" + encodeURIComponent((ev.url ? ev.url + "\n\n" : "") + "https://codeorange.dev/calendar") +
      (ev.location ? "&location=" + encodeURIComponent(ev.location) : "");
    return "https://calendar.google.com/calendar/render?" + q;
  }
  function icsFile(ev) {
    var f = function (iso) { return iso.length === 10 ? ";VALUE=DATE:" + iso.replace(/-/g, "") : ":" + iso.replace(/[-:]/g, "").replace(/\.\d{3}/, ""); };
    var esc = function (t) { return String(t || "").replace(/([\\;,])/g, "\\$1").replace(/\r?\n/g, "\\n"); };
    var stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Code Orange//Calendar//EN", "BEGIN:VEVENT",
      "UID:" + esc(ev.id) + "@codeorange.dev", "DTSTAMP:" + stamp, "DTSTART" + f(ev.start), "DTEND" + f(ev.end),
      "SUMMARY:" + esc(ev.title), "DESCRIPTION:" + esc((ev.url ? ev.url + "\n\n" : "") + "https://codeorange.dev/calendar")];
    if (ev.location) lines.push("LOCATION:" + esc(ev.location));
    if (ev.url) lines.push("URL:" + ev.url);
    lines.push("END:VEVENT", "END:VCALENDAR");
    return "data:text/calendar;charset=utf-8," + encodeURIComponent(lines.join("\r\n"));
  }
  function store(key, val) {
    try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; }
  }
  function place(ev) {
    var loc = ev.location || "";
    if (/discord\./i.test(loc) || /discord\./i.test(ev.url || "")) return "Discord";
    if (/^https?:\/\//i.test(loc)) return "Online";
    return loc.split(",")[0];
  }

  // ---------- tiny DOM helper ----------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ---------- widget ----------
  function Widget(frame, data) {
    this.frame = frame;
    this.events = data.events || [];
    this.byDay = {};
    var self = this;
    this.events.forEach(function (ev) {
      var k = dkey(zparts(ev.start));
      (self.byDay[k] = self.byDay[k] || []).push(ev);
    });
    var t = todayParts();
    this.today = dkey(t);
    this.year = t.y;
    this.month = t.m;
    var saved = store("cocal-view");
    this.view = saved === "month" || saved === "list" ? saved : (window.matchMedia && window.matchMedia("(max-width: 720px)").matches ? "list" : "month");
    // The next session that hasn't finished yet gets a "Next up" / "Live now" badge.
    var now = Date.now();
    this.next = this.events.filter(function (ev) { return !ev.allDay && new Date(ev.end).getTime() > now; })
      .sort(function (a, b) { return new Date(a.start) - new Date(b.start); })[0] || null;
    this.root = el("div", "cocal");
    this.root.setAttribute("data-view", this.view);
    this.build();
  }

  Widget.prototype.build = function () {
    var self = this;
    var head = el("div", "cocal-head");
    this.title = el("h3", "cocal-title");
    this.title.setAttribute("aria-live", "polite");
    var nav = el("div", "cocal-nav");
    var prev = el("button", "cocal-btn cocal-arrow", "‹"); prev.type = "button"; prev.setAttribute("aria-label", "Previous month");
    var today = el("button", "cocal-btn", "Today"); today.type = "button";
    var next = el("button", "cocal-btn cocal-arrow", "›"); next.type = "button"; next.setAttribute("aria-label", "Next month");
    prev.onclick = function () { self.shift(-1); };
    next.onclick = function () { self.shift(1); };
    today.onclick = function () { var t = todayParts(); self.year = t.y; self.month = t.m; self.render(); };
    var seg = el("div", "cocal-seg");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "Calendar view");
    ["month", "list"].forEach(function (v) {
      var b = el("button", "cocal-seg-btn", v === "month" ? "Month" : "List");
      b.type = "button";
      b.setAttribute("data-v", v);
      b.onclick = function () { self.view = v; store("cocal-view", v); self.root.setAttribute("data-view", v); self.render(); };
      seg.appendChild(b);
    });
    this.seg = seg;
    nav.appendChild(prev); nav.appendChild(today); nav.appendChild(next); nav.appendChild(seg);
    head.appendChild(this.title); head.appendChild(nav);

    this.body = el("div", "cocal-body");
    // Swipe left/right on touch screens to change month.
    var sx = null, sy = 0;
    this.body.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    this.body.addEventListener("touchend", function (e) {
      if (sx == null) return;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      sx = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) self.shift(dx < 0 ? 1 : -1);
    }, { passive: true });

    var foot = el("div", "cocal-foot");
    foot.appendChild(el("span", "", "Times in " + TZ_LABEL));
    var sub = el("a", "", "Add all events to Google Calendar ↗");
    sub.href = SUBSCRIBE; sub.target = "_blank"; sub.rel = "noopener";
    foot.appendChild(sub);

    this.root.appendChild(head);
    this.root.appendChild(this.body);
    this.root.appendChild(foot);
    this.render();
  };

  Widget.prototype.shift = function (n) {
    this.month += n;
    if (this.month < 1) { this.month = 12; this.year--; }
    if (this.month > 12) { this.month = 1; this.year++; }
    this.render();
  };

  Widget.prototype.render = function () {
    this.title.innerHTML = "";
    this.title.appendChild(document.createTextNode(MONTHS[this.month - 1] + " "));
    this.title.appendChild(el("span", "", String(this.year)));
    [].forEach.call(this.seg.children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === this.view)); }, this);
    this.body.innerHTML = "";
    this.body.appendChild(this.view === "month" ? this.renderMonth() : this.renderList());
  };

  Widget.prototype.badge = function (ev) {
    if (!this.next || ev !== this.next) return null;
    var live = new Date(ev.start).getTime() <= Date.now();
    return el("em", "cocal-badge" + (live ? " is-live" : ""), live ? "Live now" : "Next up");
  };

  Widget.prototype.chip = function (ev) {
    var self = this;
    var b = el("button", "cocal-chip");
    b.type = "button";
    if (!ev.allDay) b.appendChild(el("b", "", shortTime(zparts(ev.start))));
    b.appendChild(el("span", "", ev.title));
    b.title = ev.title + " · " + timeRange(ev);
    if (new Date(ev.end) < new Date()) b.classList.add("is-past");
    if (ev === this.next) b.classList.add("is-next");
    b.onclick = function () { self.open(ev); };
    return b;
  };

  Widget.prototype.renderMonth = function () {
    var self = this;
    var grid = el("div", "cocal-grid");
    WEEKDAYS.forEach(function (w) { grid.appendChild(el("div", "cocal-wd", w)); });
    var first = new Date(Date.UTC(this.year, this.month - 1, 1));
    var lead = (first.getUTCDay() + 6) % 7; // Monday first
    var start = Date.UTC(this.year, this.month - 1, 1 - lead);
    var dim = new Date(Date.UTC(this.year, this.month, 0)).getUTCDate();
    var cells = Math.ceil((lead + dim) / 7) * 7;
    for (var i = 0; i < cells; i++) {
      var dt = new Date(start + i * 86400000);
      var p = { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
      var k = dkey(p);
      var cell = el("div", "cocal-day");
      if (p.m !== this.month) cell.classList.add("is-out");
      if (k === this.today) cell.classList.add("is-today");
      if (k < this.today) cell.classList.add("is-before");
      var num = el("span", "cocal-num", String(p.d));
      cell.appendChild(num);
      var evs = this.byDay[k] || [];
      if (evs.length) cell.classList.add("has-ev");
      evs.slice(0, evs.length > MAX_CHIPS ? MAX_CHIPS - 1 : MAX_CHIPS).forEach(function (ev) { cell.appendChild(self.chip(ev)); });
      if (evs.length > MAX_CHIPS) {
        var more = el("button", "cocal-more", "+" + (evs.length - MAX_CHIPS + 1) + " more");
        more.type = "button";
        (function (list, day) { more.onclick = function () { self.openDay(day, list); }; })(evs, p);
        cell.appendChild(more);
      }
      // Phone-sized grid shows dots; tapping the day opens its sessions.
      var dots = el("span", "cocal-dots");
      evs.forEach(function () { dots.appendChild(el("i")); });
      cell.appendChild(dots);
      if (evs.length) {
        (function (list, day) {
          cell.addEventListener("click", function (e) {
            if (e.target.closest("button")) return;
            if (list.length === 1) self.open(list[0]); else self.openDay(day, list);
          });
        })(evs, p);
      }
      grid.appendChild(cell);
    }
    return grid;
  };

  Widget.prototype.row = function (ev) {
    var self = this;
    var p = zparts(ev.start);
    var r = el("button", "cocal-row");
    r.type = "button";
    if (new Date(ev.end) < new Date()) r.classList.add("is-past");
    var date = el("span", "cocal-date");
    date.appendChild(el("b", "", String(p.d)));
    date.appendChild(el("span", "", WEEKDAYS[(p.wd + 6) % 7]));
    var info = el("span", "cocal-info");
    var name = el("strong", "", ev.title);
    var bd = this.badge(ev);
    if (bd) { name.appendChild(document.createTextNode(" ")); name.appendChild(bd); r.classList.add("is-next"); }
    info.appendChild(name);
    var meta = el("span", "cocal-meta", timeRange(ev));
    var where = place(ev);
    if (where) { meta.appendChild(el("i", "", "·")); meta.appendChild(document.createTextNode(where)); }
    info.appendChild(meta);
    r.appendChild(date); r.appendChild(info); r.appendChild(el("span", "cocal-go", "→"));
    r.onclick = function () { self.open(ev); };
    return r;
  };

  Widget.prototype.renderList = function () {
    var self = this;
    var wrap = el("div", "cocal-list");
    var prefix = this.year + "-" + (this.month < 10 ? "0" : "") + this.month;
    var keys = Object.keys(this.byDay).filter(function (k) { return k.indexOf(prefix) === 0; }).sort();
    // In the current month, start at today so the list reads as "what's next".
    var isNow = prefix === this.today.slice(0, 7);
    if (isNow) keys = keys.filter(function (k) { return k >= self.today; });
    if (!keys.length) {
      var empty = el("p", "cocal-empty", isNow ? "No more sessions this month. " : "No sessions this month yet. ");
      var nx = el("button", "cocal-link", "See next month →");
      nx.type = "button";
      nx.onclick = function () { self.shift(1); };
      empty.appendChild(nx);
      wrap.appendChild(empty);
      return wrap;
    }
    keys.forEach(function (k) { self.byDay[k].forEach(function (ev) { wrap.appendChild(self.row(ev)); }); });
    return wrap;
  };

  // ---------- details dialog ----------
  Widget.prototype.modal = function () {
    if (this.dlg) return this.dlg;
    var self = this;
    var back = el("div", "cocal-modal");
    back.setAttribute("role", "dialog");
    back.setAttribute("aria-modal", "true");
    back.hidden = true;
    var card = el("div", "cocal-card");
    var close = el("button", "cocal-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.onclick = function () { self.close(); };
    var inner = el("div", "cocal-card-inner");
    card.appendChild(close); card.appendChild(inner);
    back.appendChild(card);
    back.addEventListener("click", function (e) { if (e.target === back) self.close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !back.hidden) self.close(); });
    document.body.appendChild(back);
    this.dlg = { back: back, inner: inner, close: close };
    return this.dlg;
  };
  Widget.prototype.show = function (fill) {
    var d = this.modal();
    d.inner.innerHTML = "";
    fill(d.inner);
    this.lastFocus = document.activeElement;
    d.back.hidden = false;
    document.documentElement.classList.add("cocal-lock");
    d.close.focus();
  };
  Widget.prototype.close = function () {
    if (!this.dlg) return;
    this.dlg.back.hidden = true;
    document.documentElement.classList.remove("cocal-lock");
    if (this.lastFocus && this.lastFocus.focus) this.lastFocus.focus();
  };

  Widget.prototype.open = function (ev) {
    var self = this;
    var p = zparts(ev.start);
    this.show(function (box) {
      box.appendChild(el("p", "cocal-eyebrow", longDate(p)));
      box.appendChild(el("h3", "cocal-card-title", ev.title));
      var bd = self.badge(ev);
      if (bd) box.appendChild(bd);
      var when = el("p", "cocal-when");
      when.appendChild(el("b", "", timeRange(ev)));
      if (!ev.allDay) when.appendChild(document.createTextNode(" " + TZ_LABEL));
      box.appendChild(when);
      var vt = viewerTime(ev);
      if (vt) box.appendChild(el("p", "cocal-local", vt));
      var where = place(ev);
      if (where) box.appendChild(el("p", "cocal-where", "📍 " + (where === "Discord" ? "Online on Discord" : ev.location)));
      if (ev.description) {
        // Make links in the description clickable (built as text nodes, never as HTML).
        var desc = el("div", "cocal-desc");
        ev.description.split(/(https?:\/\/[^\s<>"]+)/).forEach(function (part, i) {
          if (i % 2) {
            var url = part.replace(/[.,)]+$/, ""), rest = part.slice(url.length);
            var a = el("a", "", url.replace(/^https?:\/\//, ""));
            a.href = url; a.target = "_blank"; a.rel = "noopener";
            desc.appendChild(a);
            if (rest) desc.appendChild(document.createTextNode(rest));
          } else if (part) desc.appendChild(document.createTextNode(part));
        });
        box.appendChild(desc);
      }
      var acts = el("div", "cocal-actions");
      if (ev.url) {
        var join = el("a", "cocal-primary", place(ev) === "Discord" ? "Join on Discord →" : "Open link →");
        join.href = ev.url; join.target = "_blank"; join.rel = "noopener";
        acts.appendChild(join);
      }
      var add = el("a", "cocal-secondary", "Add to Google Calendar");
      add.href = gcalLink(ev); add.target = "_blank"; add.rel = "noopener";
      acts.appendChild(add);
      var ics = el("a", "cocal-secondary", "Apple / Outlook");
      ics.href = icsFile(ev);
      ics.download = (ev.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase().slice(0, 60) || "code-orange-session") + ".ics";
      acts.appendChild(ics);
      box.appendChild(acts);
    });
  };

  Widget.prototype.openDay = function (p, list) {
    var self = this;
    var full = zparts(list[0].start);
    this.show(function (box) {
      box.appendChild(el("p", "cocal-eyebrow", longDate(full)));
      box.appendChild(el("h3", "cocal-card-title", list.length + " sessions"));
      var l = el("div", "cocal-list cocal-list-tight");
      list.forEach(function (ev) {
        var r = self.row(ev);
        r.onclick = function () { self.open(ev); };
        l.appendChild(r);
      });
      box.appendChild(l);
    });
  };

  // ---------- search engines: list upcoming sessions as schema.org Events ----------
  function addEventSchema(events) {
    var now = Date.now();
    var list = events.filter(function (ev) { return !ev.allDay && new Date(ev.end).getTime() > now; })
      .sort(function (a, b) { return new Date(a.start) - new Date(b.start); }).slice(0, 20)
      .map(function (ev) {
        var online = place(ev) === "Discord" || place(ev) === "Online";
        var item = {
          "@type": "Event", name: ev.title, startDate: ev.start, endDate: ev.end,
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: online ? "https://schema.org/OnlineEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
          location: online ? { "@type": "VirtualLocation", url: ev.url || "https://codeorange.dev/calendar" }
            : { "@type": "Place", name: place(ev), address: ev.location },
          organizer: { "@type": "Organization", name: "Code Orange Dev School", url: "https://codeorange.dev" },
          isAccessibleForFree: true,
          image: "https://codeorange.dev/assets/og-codeorange-workshop.jpg"
        };
        if (ev.description) item.description = ev.description.slice(0, 300);
        return item;
      });
    if (!list.length) return;
    var s = document.createElement("script");
    s.type = "application/ld+json";
    s.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": list });
    document.head.appendChild(s);
  }

  // ---------- boot ----------
  frames.forEach(function (f) {
    f.style.display = "none";
    var wrap = f.parentNode;
    wrap.classList.add("has-cocal");
    var loading = el("div", "cocal cocal-loading", "Loading the calendar…");
    wrap.insertBefore(loading, f);
    f._cocalLoading = loading;
  });

  fetch("/api/calendar", { headers: { Accept: "application/json" } })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      if (!data || !Array.isArray(data.events)) throw new Error("bad data");
      frames.forEach(function (f) {
        var w = new Widget(f, data);
        f.parentNode.replaceChild(w.root, f._cocalLoading);
        f.parentNode.removeChild(f);
      });
      if (location.pathname.replace(/\/$/, "") === "/calendar") addEventSchema(data.events);
    })
    .catch(function () {
      // Fall back to Google's own embed.
      frames.forEach(function (f) {
        f.parentNode.classList.remove("has-cocal");
        if (f._cocalLoading) f._cocalLoading.remove();
        fallback(f);
      });
    });
})();
