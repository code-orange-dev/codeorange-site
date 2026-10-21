// Homepage tip strip: sends a tip invoice to Code Orange's BTCPay Server.
// Stays hidden until data-btcpay holds a public https address.
(function () {
  var box = document.querySelector('[data-co-tips]');
  if (!box) return;
  var base = (box.getAttribute('data-btcpay') || '').replace(/\/+$/, '');
  if (!/^https:\/\//.test(base)) return;
  var form = box.querySelector('form');
  var price = form.querySelector('[name=price]');
  form.action = base + '/api/v1/invoices';
  box.hidden = false;
  box.querySelectorAll('[data-sats]').forEach(function (b) {
    b.addEventListener('click', function () {
      price.value = b.getAttribute('data-sats');
      box.querySelectorAll('[data-sats]').forEach(function (o) { o.setAttribute('aria-pressed', o === b); });
    });
  });
  price.addEventListener('input', function () {
    box.querySelectorAll('[data-sats]').forEach(function (o) { o.setAttribute('aria-pressed', o.getAttribute('data-sats') === price.value); });
  });
})();
