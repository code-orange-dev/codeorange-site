// Relays an already-signed Nostr event from the Code Orange meme bot to public relays.
// The bot's secret key never touches this server: events are signed elsewhere, and this
// endpoint only forwards events whose pubkey is the bot's. Relays verify the signature.
const BOT_PUBKEY = "ad85eb35e67d758b82f316997dd594adfaf57ec212d94579e6ef34077c3beafd";
const RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net", "wss://relay.nostr.band", "wss://nostr.mom"];

function publish(url, event) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done) { done = true; try { ws.close(); } catch {} resolve(r); } };
    let ws;
    try { ws = new WebSocket(url); } catch (e) { return resolve({ ok: false, msg: String(e.message || e) }); }
    const t = setTimeout(() => finish({ ok: false, msg: "timeout" }), 7000);
    ws.onopen = () => ws.send(JSON.stringify(["EVENT", event]));
    ws.onmessage = (m) => {
      try {
        const d = JSON.parse(m.data);
        if (d[0] === "OK" && d[1] === event.id) { clearTimeout(t); finish({ ok: !!d[2], msg: d[3] || "" }); }
      } catch {}
    };
    ws.onerror = () => { clearTimeout(t); finish({ ok: false, msg: "connection error" }); };
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  let event;
  try {
    const raw = req.method === "POST" ? (typeof req.body === "string" ? req.body : JSON.stringify(req.body)) : Buffer.from(String((req.query || {}).e || ""), "base64url").toString("utf8");
    event = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: "Bad event" });
  }
  if (!event || event.pubkey !== BOT_PUBKEY || !event.sig || !event.id) return res.status(403).json({ error: "Only the meme bot's events are relayed" });
  const results = await Promise.all(RELAYS.map((r) => publish(r, event)));
  return res.status(200).json({ id: event.id, relays: Object.fromEntries(RELAYS.map((r, i) => [r, results[i]])) });
};
