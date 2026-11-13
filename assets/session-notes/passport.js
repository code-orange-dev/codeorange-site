/* Builder passport for session notes: one stamp per recap you finish, plus XP from the mini-games.
   Everything stays in this browser (localStorage). No accounts, nothing sent anywhere. */
(function () {
  var KEY = 'co-passport-v1';
  function load() { try { var v = JSON.parse(localStorage.getItem(KEY)); if (v && v.s) return v; } catch (e) {} return { s: {} }; }
  function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  function gameXp() {
    var xp = 0;
    try { var wn = JSON.parse(localStorage.getItem('co-wn-2026-11-11')); if (wn && wn.b) { for (var k in wn.b) if (wn.b[k]) xp += 100; xp += (wn.best || 0) * 50; } } catch (e) {}
    try { xp += (+localStorage.getItem('rc1-best') || 0) * 50; } catch (e) {}
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('co-quiz-') === 0) xp += (+localStorage.getItem(k) || 0) * 50; if (k && k.indexOf('co-badges-') === 0) { var bd = JSON.parse(localStorage.getItem(k)); if (bd && bd.b) for (var q in bd.b) if (bd.b[q]) xp += 100; } } } catch (e) {}
    return xp;
  }
  var RANKS = [[0, 'Visitor'], [1, 'Pleb'], [3, 'Builder'], [5, 'Reviewer'], [7, 'Cypherpunk']];
  function rank(n, total) { if (total && n >= total) return 'Sovereign'; var r = RANKS[0][1]; for (var i = 0; i < RANKS.length; i++) if (n >= RANKS[i][0]) r = RANKS[i][1]; return r; }
  function css() {
    if (document.getElementById('pp-css')) return;
    var s = document.createElement('style'); s.id = 'pp-css';
    s.textContent = '.pp{margin:0 0 28px;padding:22px 24px;border:1px solid rgba(247,147,26,.35);border-radius:16px;background:linear-gradient(145deg,rgba(247,147,26,.1),rgba(20,20,20,.92))}' +
      '.pp-top{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap}' +
      '.pp-top h2{margin:0;font-size:22px}.pp-top p{margin:4px 0 0;color:#B8B8B8;font-size:14px;line-height:1.5}' +
      '.pp-nums{display:flex;gap:10px;flex-wrap:wrap}.pp-nums span{padding:8px 12px;border-radius:10px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.08);font:700 13px "Plus Jakarta Sans",sans-serif;color:#B8B8B8}.pp-nums b{color:#F7931A;font-size:16px;margin-right:4px}' +
      '.pp-bar{height:8px;border-radius:99px;background:rgba(255,255,255,.08);margin:16px 0 14px;overflow:hidden}.pp-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#F7931A,#FFB347);border-radius:99px;transition:width .8s ease}' +
      '.pp-stamps{display:flex;gap:10px;flex-wrap:wrap;margin:0;padding:0;list-style:none}' +
      '.pp-stamps a{display:flex;flex-direction:column;align-items:center;justify-content:center;width:76px;height:76px;border-radius:50%;border:2px dashed rgba(255,255,255,.18);color:#858585;text-decoration:none;font:700 10px/1.2 "Plus Jakarta Sans",sans-serif;text-align:center;letter-spacing:.04em;text-transform:uppercase;transition:transform .15s ease,border-color .15s ease}' +
      '.pp-stamps a:hover{transform:translateY(-2px);border-color:#F7931A;color:#F7931A}.pp-stamps a small{font-size:9px;opacity:.8;margin-top:2px}' +
      '.pp-stamps a.got{border:2px solid #F7931A;color:#F7931A;background:rgba(247,147,26,.12);transform:rotate(-6deg)}.pp-stamps a.got:hover{transform:rotate(-6deg) translateY(-2px)}' +
      '.pp-share{display:flex;gap:16px;align-items:center;margin:12px 0 0;font-size:13px}.pp-share a{color:#F7931A;font-weight:700}.pp-reset{background:none;border:0;padding:0;color:#858585;font:500 12px Inter,sans-serif;text-decoration:underline;cursor:pointer}' +
      '.pp-got{border-color:#F7931A!important;color:#F7931A!important}' +
      '.pp-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,140%);z-index:60;max-width:calc(100vw - 32px);padding:14px 18px;border-radius:12px;background:#141414;border:1px solid #F7931A;color:#F5F5F5;font:600 14px Inter,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.6);transition:transform .35s ease;text-decoration:none;display:block}.pp-toast.go{transform:translate(-50%,0)}.pp-toast b{color:#F7931A}' +
      '@media (max-width:560px){.pp{padding:18px}.pp-stamps a{width:64px;height:64px;font-size:9px}}';
    document.head.appendChild(s);
  }

  /* Recap page: collect the stamp when the reader reaches the end. */
  var me = document.currentScript, slug = me && me.getAttribute('data-slug'), total = +(me && me.getAttribute('data-total')) || 0;
  if (slug) {
    var end = document.querySelector('.share-row');
    if (end && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return; io.disconnect();
        var v = load(); if (v.s[slug]) return; v.s[slug] = Date.now(); save(v);
        var n = Object.keys(v.s).length; css();
        var t = document.createElement('a'); t.className = 'pp-toast'; t.href = '/session-notes#passport';
        t.innerHTML = '<b>Stamp collected.</b> ' + n + (total ? ' of ' + total : '') + ' in your builder passport &rarr;';
        document.body.appendChild(t); setTimeout(function () { t.classList.add('go'); }, 50); setTimeout(function () { t.classList.remove('go'); }, 6000);
      }, { threshold: .5 });
      io.observe(end);
    }
    return;
  }

  /* List page: draw the passport and mark the cards. */
  var box = document.getElementById('passport'), list = window.SN_SESSIONS || [];
  if (!box || !list.length) return;
  css();
  function draw() {
    var v = load(), n = 0, stamps = '';
    for (var i = list.length - 1; i >= 0; i--) {
      var s = list[i], got = !!v.s[s.slug]; if (got) n++;
      stamps += '<li><a class="' + (got ? 'got' : '') + '" href="/session-notes/' + s.slug + '" title="' + s.title + '">' + s.short + '<small>' + s.day + '</small></a></li>';
    }
    var xp = n * 100 + gameXp();
    box.className = 'pp';
    box.innerHTML = '<div class="pp-top"><div><h2>Your builder passport</h2><p>' +
      (n ? (n >= list.length ? 'Every recap stamped. Come to the next session and collect a new one.' : 'Read a recap to the end to collect its stamp. Play the games for extra XP.') : 'Read a recap to the end to collect your first stamp. Play the games for extra XP.') +
      '</p></div><div class="pp-nums"><span><b>' + n + '/' + list.length + '</b>stamps</span><span><b>' + xp + '</b>XP</span><span><b>' + rank(n, list.length) + '</b>rank</span></div></div>' +
      '<div class="pp-bar"><i></i></div><ol class="pp-stamps">' + stamps + '</ol>' + (n ? '<p class="pp-share"><a target="_blank" rel="noopener" href="https://x.com/intent/post?text=' + encodeURIComponent('My Bitcoin builder passport: ' + n + '/' + list.length + ' stamps, ' + xp + ' XP, rank ' + rank(n, list.length) + '. Free workshop notes and games from @CodeOrangeDevs') + '&url=' + encodeURIComponent('https://codeorange.dev/session-notes') + '">Share my rank on X</a><button type="button" class="pp-reset">Start over</button></p>' : '');
    setTimeout(function () { var b = box.querySelector('.pp-bar i'); if (b) b.style.width = (n / list.length * 100) + '%'; }, 60);
    var r = box.querySelector('.pp-reset'); if (r) r.addEventListener('click', function () { if (confirm('Clear your stamps on this device?')) { save({ s: {} }); draw(); } });
    list.forEach(function (s) {
      var p = document.querySelector('[data-stamp="' + s.slug + '"]'); if (!p) return;
      var got = !!v.s[s.slug]; p.hidden = false; p.textContent = got ? '✓ Stamped' : 'Collect stamp'; p.classList.toggle('pp-got', got);
    });
  }
  draw();
  window.addEventListener('pageshow', function (e) { if (e.persisted) draw(); });
})();
