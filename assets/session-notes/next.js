/* "Come to the next one" card at the end of each recap: the real upcoming sessions from /api/calendar,
   with add-to-calendar links. If the calendar can't be loaded the static card stays as it is. */
(function () {
  var box = document.querySelector('[data-next]');
  if (!box) return;
  var form = box.querySelector('form'), msg = box.querySelector('.nx-msg');
  if (form && window.fetch) form.addEventListener('submit', function (e) {
    e.preventDefault(); var b = form.querySelector('button'); b.disabled = true;
    fetch(form.action, { method: 'POST', body: new FormData(form) }).then(function (r) { return r.json(); }).then(function (d) {
      msg.hidden = false;
      if (d && d.success) { msg.textContent = 'Almost done: check your inbox and click the confirmation link.'; form.reset(); }
      else msg.textContent = 'That did not work. Please check the email address and try again.';
    }).catch(function () { form.target = '_blank'; form.submit(); }).then(function () { b.disabled = false; });
  });
  if (!window.fetch) return;
  var TZ = 'Asia/Makassar', norm = function (t) { return String(t || '').toLowerCase().replace(/[-\s]+/g, ' '); }, match = norm(box.getAttribute('data-match'));
  var esc = function (s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var fmt = function (d, o) { return new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: TZ }, o)).format(d); };
  var utc = function (d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''); };
  fetch('/api/calendar', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.events) return;
      var now = Date.now(), seen = {}, all = [];
      d.events.filter(function (e) { return !e.allDay && Date.parse(e.end) > now; })
        .sort(function (a, b) { return Date.parse(a.start) - Date.parse(b.start); })
        .forEach(function (e) { var k = e.title.toLowerCase(); if (!seen[k]) { seen[k] = 1; all.push(e); } });
      if (!all.length) return;
      var same = match ? all.filter(function (e) { return norm(e.title).indexOf(match) >= 0; })[0] : null;
      var picks = same ? [same] : [];
      all.forEach(function (e) { if (picks.length < 3 && e !== same) picks.push(e); });
      picks.sort(function (a, b) { return Date.parse(a.start) - Date.parse(b.start); });
      var here = ''; try { here = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
      box.querySelector('[data-next-list]').innerHTML = picks.map(function (e) {
        var s = new Date(e.start), en = new Date(e.end), live = s.getTime() <= now;
        var g = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(e.title + ' (Code Orange)') +
          '&dates=' + utc(s) + '/' + utc(en) + '&location=' + encodeURIComponent('Code Orange Discord') +
          '&details=' + encodeURIComponent('Free session. Join on Discord: ' + (e.url || 'https://codeorange.dev/calendar'));
        var mine = here && here !== TZ && here !== 'UTC' ? ' · ' + esc(s.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })) + ' your time' : '';
        return '<li' + (e === same ? ' class="same"' : '') + '><span class="nx-date"><b>' + esc(fmt(s, { weekday: 'short' })) + '</b>' + esc(fmt(s, { day: 'numeric' })) + '<i>' + esc(fmt(s, { month: 'short' })) + '</i></span>' +
          '<span class="nx-text">' + (live ? '<em>Live now</em>' : (e === same ? '<em>Next in this series</em>' : '')) + '<strong>' + esc(e.title) + '</strong>' +
          '<span>' + esc(s.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })) + ' UTC · ' + esc(fmt(s, { hour: '2-digit', minute: '2-digit' })) + ' UTC+8' + mine + '</span></span>' +
          '<a class="nx-add" href="' + g + '" target="_blank" rel="noopener" aria-label="Add ' + esc(e.title) + ' to Google Calendar">+ Calendar</a></li>';
      }).join('');
      var st = box.querySelector('[data-next-static]'); if (st) st.hidden = true;
      box.querySelector('[data-next-live]').hidden = false;
    })
    .catch(function () {});
})();
