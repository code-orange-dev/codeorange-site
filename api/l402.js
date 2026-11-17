// L402 demo seller: a tiny paid API for the /agent-pay workshop demo.
//
// Flow (the L402 pattern):
//   1. GET /api/l402?tool=fees              -> 402 Payment Required
//      WWW-Authenticate: L402 macaroon="<credential>", invoice="<bolt11>"
//      The invoice comes from Code Orange's BTCPay Server (Lightning).
//   2. The buyer (the agent) pays the invoice and keeps the preimage.
//   3. GET /api/l402?tool=fees  with  Authorization: L402 <credential>:<preimage>
//      -> 200 with the data, plus X-L402-Token: the same credential with one call used.
//   Without a preimage (paid by scanning the QR from a phone) the seller asks its own
//   BTCPay Server whether the invoice is settled instead.
//
// One payment buys a bundle of calls (calls=1..5, 10 sats each). The credential is an
// HMAC-signed token, a simplified stand-in for a macaroon. It is stateless, so this is a
// teaching demo, not a production meter.
//
// If BTCPay can't be reached, the 402 says demo:true and the page offers practice mode
// (POST ?simulate=1), clearly labelled as no real sats.

const crypto = require("node:crypto");

const BTCPAY = (process.env.BTCPAY_URL || "https://pay.codeorange.app").replace(/\/+$/, "");
const STORE_ID = process.env.BTCPAY_STORE_ID || "6JFFeBchc5GpbuN7C5xZPADhmJjQ4EeoVEeh7A8hHiNw";
const SECRET = process.env.L402_SECRET || "code-orange-l402-workshop-demo-2026";
const SATS_PER_CALL = 10;
const MAX_CALLS = 5;
const TOKEN_TTL = 3 * 3600 * 1000;
const MEMPOOL = "https://mempool.space/api";

// ---------- credential (simplified macaroon) ----------

const b64u = (buf) => Buffer.from(buf).toString("base64url");
function sign(payload) {
  const body = b64u(JSON.stringify(payload));
  const mac = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}
function verify(token) {
  if (typeof token !== "string") return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const want = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!p || p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

// ---------- bolt11: read the payment hash ----------

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
function bolt11PaymentHash(invoice) {
  try {
    const s = String(invoice).toLowerCase().replace(/^lightning:/, "");
    const pos = s.lastIndexOf("1");
    const words = [];
    for (const c of s.slice(pos + 1, -6)) {
      const v = CHARSET.indexOf(c);
      if (v < 0) return null;
      words.push(v);
    }
    let i = 7; // skip 35-bit timestamp
    while (i + 3 <= words.length) {
      const type = words[i];
      const len = words[i + 1] * 32 + words[i + 2];
      const data = words.slice(i + 3, i + 3 + len);
      i += 3 + len;
      if (type === 1 && len === 52) {
        let acc = 0, bits = 0;
        const out = [];
        for (const w of data) {
          acc = (acc << 5) | w;
          bits += 5;
          while (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); }
        }
        return Buffer.from(out.slice(0, 32)).toString("hex");
      }
    }
  } catch {}
  return null;
}

// ---------- BTCPay ----------

async function withTimeout(url, opts = {}, ms = 9000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function createInvoice(sats, calls) {
  const form = new URLSearchParams({
    storeId: STORE_ID,
    price: String(sats),
    currency: "SATS",
    checkoutDesc: `Agent demo: ${calls} API call${calls > 1 ? "s" : ""} (L402)`,
    jsonResponse: "true",
  });
  const r = await withTimeout(`${BTCPAY}/api/v1/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form.toString(),
    redirect: "manual",
  });
  let id = null;
  const text = await r.text();
  try {
    const j = JSON.parse(text);
    id = j.invoiceId || j.InvoiceId || j.id || null;
  } catch {}
  if (!id) {
    const loc = r.headers.get("location") || "";
    const m = loc.match(/\/i\/([A-Za-z0-9]+)/) || text.match(/\/i\/([A-Za-z0-9]{10,})/);
    if (m) id = m[1];
  }
  if (!id) throw new Error(`BTCPay invoice failed (${r.status})`);
  const bolt11 = await getBolt11(id);
  return { id, bolt11, checkout: `${BTCPAY}/i/${id}` };
}

async function checkoutStatus(id, pm) {
  const q = pm ? `?paymentMethodId=${encodeURIComponent(pm)}` : "";
  const r = await withTimeout(`${BTCPAY}/i/${id}/status${q}`, { headers: { Accept: "application/json" } });
  if (!r.ok) return null;
  return r.text();
}

function findBolt11(text) {
  const m = String(text || "").match(/ln(?:bc|tb|bcrt|tbs)[0-9]*[munp]?1[02-9ac-hj-np-z]{100,}/i);
  return m ? m[0].toLowerCase() : null;
}

async function getBolt11(id) {
  for (const pm of ["BTC-LN", "BTC_LightningLike", "BTC-LNURL", ""]) {
    try {
      const t = await checkoutStatus(id, pm);
      const b = findBolt11(t);
      if (b) return b;
    } catch {}
  }
  throw new Error("No Lightning invoice from BTCPay");
}

async function isPaid(id) {
  for (const pm of ["BTC-LN", ""]) {
    try {
      const t = await checkoutStatus(id, pm);
      if (!t) continue;
      const j = JSON.parse(t);
      const s = String(j.status || j.invoiceStatus || "").toLowerCase();
      if (/settled|complete|confirmed|paid|processing/.test(s)) return true;
      if (s) return false;
    } catch {}
  }
  return false;
}

// ---------- the paid tools ----------

async function getJSON(path) {
  const r = await withTimeout(MEMPOOL + path, { headers: { Accept: "application/json" } }, 8000);
  if (!r.ok) throw new Error(`mempool ${r.status}`);
  return r.json();
}

const TOOLS = {
  block: {
    label: "Latest block",
    run: async () => {
      const blocks = await getJSON("/v1/blocks");
      const b = blocks[0];
      return { height: b.height, txCount: b.tx_count, minutesAgo: Math.max(0, Math.round((Date.now() / 1000 - b.timestamp) / 60)), pool: b.extras?.pool?.name || null };
    },
  },
  fees: { label: "Fee rates", run: async () => getJSON("/v1/fees/recommended") },
  price: {
    label: "BTC price",
    run: async () => {
      const p = await getJSON("/v1/prices");
      return { USD: p.USD, EUR: p.EUR, IDR: p.IDR ?? null, satsPerDollar: p.USD ? Math.round(1e8 / p.USD) : null };
    },
  },
  mempool: {
    label: "Mempool",
    run: async () => {
      const m = await getJSON("/mempool");
      return { txCount: m.count, vMB: Math.round(m.vsize / 1e5) / 10, totalFeeBTC: Math.round(m.total_fee) / 1e8 };
    },
  },
  hashrate: {
    label: "Hashrate",
    run: async () => {
      const h = await getJSON("/v1/mining/hashrate/3d");
      return { exahash: Math.round((h.currentHashrate || 0) / 1e18), difficultyT: Math.round((h.currentDifficulty || 0) / 1e12 * 10) / 10 };
    },
  },
};

// ---------- handler ----------

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function parseAuth(req) {
  const h = String(req.headers.authorization || "");
  const m = h.match(/^(?:L402|LSAT)\s+([^\s:]+)(?::([0-9a-fA-F]{64}))?\s*$/);
  return m ? { token: m[1], preimage: m[2] ? m[2].toLowerCase() : null } : null;
}

async function challenge(res, calls, practice) {
  const sats = calls * SATS_PER_CALL;
  const base = { v: 1, sats, calls, used: 0, exp: Date.now() + TOKEN_TTL, n: crypto.randomBytes(6).toString("hex") };
  let token, invoice, checkout = null, demo = false, reason = null;
  try {
    if (practice) throw new Error("practice mode");
    const inv = await createInvoice(sats, calls);
    token = sign({ ...base, iid: inv.id, ph: bolt11PaymentHash(inv.bolt11) });
    invoice = inv.bolt11;
    checkout = inv.checkout;
  } catch (e) {
    demo = true;
    token = sign({ ...base, demo: true });
    invoice = null;
    reason = String((e && e.message) || e).slice(0, 200);
  }
  if (invoice) res.setHeader("WWW-Authenticate", `L402 macaroon="${token}", invoice="${invoice}"`);
  return send(res, 402, {
    error: "Payment Required",
    price: { sats, calls, satsPerCall: SATS_PER_CALL },
    macaroon: token,
    invoice,
    checkout,
    demo,
    reason,
    note: demo
      ? "Practice mode (Lightning node offline or practice requested): no real sats."
      : "Pay the invoice, then retry with  Authorization: L402 <macaroon>:<preimage>",
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, X-L402-Token");
  if (req.method === "OPTIONS") return res.status(204).end();

  const q = req.query || {};
  const auth = parseAuth(req);

  if (q.probe === "btcpay") {
    const out = {};
    try {
      const form = new URLSearchParams({ storeId: STORE_ID, price: "10", currency: "SATS", checkoutDesc: "Agent demo probe", jsonResponse: "true" });
      const r = await withTimeout(`${BTCPAY}/api/v1/invoices`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: form.toString(), redirect: "manual" });
      out.create = { status: r.status, location: r.headers.get("location"), body: (await r.text()).slice(0, 400) };
      const m = (out.create.body + " " + (out.create.location || "")).match(/(?:"invoiceId"\s*:\s*"|\/i\/)([A-Za-z0-9]{10,})/i);
      if (m) {
        for (const pm of ["BTC-LN", "BTC_LightningLike", ""]) {
          const t = await checkoutStatus(m[1], pm).catch((e) => "ERR " + e.message);
          out["status_" + (pm || "default")] = String(t).slice(0, 700);
        }
      }
    } catch (e) { out.error = String(e.message || e); }
    return send(res, 200, out);
  }

  // Payment status, for the page while it waits for a QR payment.
  if (q.check) {
    const p = auth && verify(auth.token);
    if (!p) return send(res, 401, { error: "Bad credential" });
    if (p.paid) return send(res, 200, { paid: true, token: auth.token });
    if (p.demo) return send(res, 200, { paid: false, demo: true });
    const paid = await isPaid(p.iid);
    return send(res, 200, { paid, token: paid ? sign({ ...p, paid: true }) : auth.token });
  }

  // Practice mode only: pretend the invoice was paid.
  if (q.simulate && req.method === "POST") {
    const p = auth && verify(auth.token);
    if (!p || !p.demo) return send(res, 400, { error: "Practice mode only" });
    return send(res, 200, { paid: true, token: sign({ ...p, paid: true }) });
  }

  const name = String(q.tool || "");
  const tool = TOOLS[name];
  if (!tool) {
    return send(res, 200, {
      about: "Code Orange L402 demo API. Every tool costs 10 sats per call, paid over Lightning.",
      tools: Object.fromEntries(Object.entries(TOOLS).map(([k, t]) => [k, t.label])),
      try: "curl -i 'https://codeorange.dev/api/l402?tool=price'",
    });
  }
  const calls = Math.min(MAX_CALLS, Math.max(1, parseInt(q.calls, 10) || 1));
  const practice = !!q.practice;

  if (!auth) return challenge(res, calls, practice);
  const p = verify(auth.token);
  if (!p) return challenge(res, calls, practice);

  // Is the credential paid for?
  let paid = !!p.paid;
  let proof = p.paid ? "credential" : null;
  if (!paid && auth.preimage && p.ph) {
    const h = crypto.createHash("sha256").update(Buffer.from(auth.preimage, "hex")).digest("hex");
    if (h === p.ph) { paid = true; proof = "preimage"; }
  }
  if (!paid && !p.demo && p.iid) {
    paid = await isPaid(p.iid);
    if (paid) proof = "seller checked its node";
  }
  if (!paid) return send(res, 402, { error: "Invoice not paid yet", macaroon: auth.token });
  if (p.used >= p.calls) return challenge(res, calls, practice || p.demo); // bundle used up: fresh 402

  let data;
  try {
    data = await tool.run();
  } catch (e) {
    return send(res, 502, { error: "Data source unavailable, your call was not used", macaroon: auth.token });
  }
  const next = sign({ ...p, paid: true, used: p.used + 1 });
  res.setHeader("X-L402-Token", next);
  return send(res, 200, {
    tool: name,
    label: tool.label,
    data,
    paid: { proof, demo: !!p.demo, callsLeft: p.calls - p.used - 1, bundle: p.calls, sats: p.sats },
    macaroon: next,
  });
};

module.exports.bolt11PaymentHash = bolt11PaymentHash;
