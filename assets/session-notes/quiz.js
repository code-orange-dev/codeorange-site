/* "Test yourself" quiz at the end of a recap. Questions come from the JSON block inside [data-quiz].
   Best score is kept in this browser (localStorage co-quiz-<slug>) and adds XP in the builder passport. */
(function () {
  var box = document.querySelector('[data-quiz]'); if (!box) return;
  var slug = box.getAttribute('data-quiz'), KEY = 'co-quiz-' + slug, QS;
  try { QS = JSON.parse(box.querySelector('script[type="application/json"]').textContent); } catch (e) { return; }
  var $ = function (s) { return box.querySelector(s); }, qi = 0, score = 0;
  function best() { try { return +localStorage.getItem(KEY) || 0; } catch (e) { return 0; } }
  function ask() {
    var c = QS[qi];
    $('.qz-n').textContent = 'Question ' + (qi + 1) + ' of ' + QS.length;
    $('.qz-bar i').style.width = (qi / QS.length * 100) + '%';
    $('.qz-q').textContent = c.q;
    var opts = $('.qz-opts'); opts.innerHTML = ''; $('.qz-why').hidden = true; $('.qz-next').hidden = true;
    c.o.forEach(function (t, i) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = t;
      b.addEventListener('click', function () {
        var all = opts.querySelectorAll('button');
        for (var k = 0; k < all.length; k++) { all[k].disabled = true; if (k === c.a) all[k].className = 'right'; }
        if (i === c.a) score++; else b.className = 'wrong';
        $('.qz-why').textContent = (i === c.a ? 'Correct. ' : 'Not quite. ') + c.w; $('.qz-why').hidden = false;
        $('.qz-next').textContent = qi === QS.length - 1 ? 'See my score' : 'Next question'; $('.qz-next').hidden = false;
      });
      opts.appendChild(b);
    });
  }
  function end() {
    var b = best(); if (score > b) { try { localStorage.setItem(KEY, score); } catch (e) {} }
    $('.qz-bar i').style.width = '100%';
    $('.qz-play').hidden = true; $('.qz-done').hidden = false;
    $('.qz-score').textContent = score + ' / ' + QS.length;
    var t = document.title.split(' - ')[0], msg = 'I scored ' + score + '/' + QS.length + ' on the "' + t + '" quiz from @CodeOrangeDevs. Can you beat me?';
    $('.qz-x').href = 'https://x.com/intent/post?text=' + encodeURIComponent(msg) + '&url=' + encodeURIComponent(location.origin + location.pathname);
    $('.qz-msg').textContent = score === QS.length ? 'Perfect. +' + score * 50 + ' XP in your builder passport.' : (score ? 'Nice. +' + score * 50 + ' XP in your builder passport. Go again for a perfect score?' : 'Have another look at the takeaways above and try again.');
  }
  $('.qz-next').addEventListener('click', function () { qi++; if (qi < QS.length) ask(); else end(); });
  $('.qz-again').addEventListener('click', function () { qi = 0; score = 0; $('.qz-done').hidden = true; $('.qz-play').hidden = false; ask(); });
  var b0 = best(); if (b0) $('.qz-best').textContent = 'Your best: ' + b0 + ' / ' + QS.length;
  ask();
})();
