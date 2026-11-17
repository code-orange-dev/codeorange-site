// "I finished week N" share image for Decoding Bitcoin students. Drawn on a canvas in the browser:
// nothing is uploaded. window.MBShareCard.make({ week, weeks, title, name, topics }) -> Promise<Blob>.
(() => {
  const W = 1200, H = 675, OR = "#F7931A", BG = "#0A0A0A";
  const FONT = '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
  const MONO = '"Plus Jakarta Sans", ui-monospace, monospace';

  function wrap(ctx, text, maxW) {
    const words = String(text).split(/\s+/), lines = [];
    let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  function logo(ctx, x, y, size) {
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#F5F5F5";
    ctx.fillText("code", x, y);
    let cx = x + ctx.measureText("code ").width;
    const r = size * 0.3;
    ctx.fillStyle = OR;
    ctx.beginPath(); ctx.arc(cx + r, y - size * 0.33, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#F5F5F5";
    ctx.fillText("range", cx + r * 2 + 1, y);
  }

  async function make({ week, weeks = 10, title = "", name = "", topics = [] }) {
    try { await document.fonts.ready; } catch (e) {}
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");

    // Background: black, soft orange glow, faint grid.
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * 0.86, H * 0.12, 20, W * 0.86, H * 0.12, 620);
    g.addColorStop(0, "rgba(247,147,26,.38)"); g.addColorStop(0.5, "rgba(194,98,10,.12)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,.035)"; ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 48) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
    ctx.fillStyle = OR; ctx.fillRect(0, 0, W, 8);

    const L = 72;
    // Eyebrow
    ctx.font = `700 22px ${MONO}`;
    ctx.fillStyle = OR;
    ctx.fillText("DECODING BITCOIN · STUDY COHORT", L, 92);

    // Headline
    ctx.fillStyle = "#F5F5F5";
    ctx.font = `800 92px ${FONT}`;
    ctx.fillText(`I finished`, L, 208);
    ctx.fillStyle = OR;
    ctx.fillText(`week ${week}.`, L, 306);

    // Week title
    ctx.fillStyle = "#D6D6D6";
    ctx.font = `500 34px ${FONT}`;
    const tl = wrap(ctx, title, 700).slice(0, 2);
    tl.forEach((t, i) => ctx.fillText(t, L, 370 + i * 44));

    // Topic chips
    let x = L, y = 370 + tl.length * 44 + 22;
    ctx.font = `600 20px ${MONO}`;
    for (const t of topics.slice(0, 3)) {
      const label = String(t).slice(0, 28), w = ctx.measureText(label).width + 32;
      if (x + w > 820) break;
      ctx.strokeStyle = "rgba(247,147,26,.55)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x, y, w, 40, 20); ctx.stroke();
      ctx.fillStyle = OR; ctx.fillText(label, x + 16, y + 27);
      x += w + 12;
    }

    // Progress: 10 blocks
    const by = 560, bw = 50, gap = 10;
    for (let i = 0; i < weeks; i++) {
      ctx.fillStyle = i < week ? OR : "rgba(255,255,255,.12)";
      ctx.beginPath(); ctx.roundRect(L + i * (bw + gap), by, bw, 14, 7); ctx.fill();
    }
    ctx.font = `600 22px ${MONO}`;
    ctx.fillStyle = "#A3A3A3";
    ctx.fillText(`${week} of ${weeks} weeks${name ? " · " + String(name).slice(0, 28) : ""}`, L, by + 52);

    // Right column: course card
    const cx = 860, cy = 150, cw = 268, ch = 330;
    ctx.fillStyle = "rgba(20,20,20,.92)";
    ctx.strokeStyle = "rgba(247,147,26,.45)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(cx, cy, cw, ch, 22); ctx.fill(); ctx.stroke();
    ["#F7931A", "#3a3a3a", "#3a3a3a"].forEach((col, i) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + 28 + i * 20, cy + 30, 6, 0, Math.PI * 2); ctx.fill(); });
    ctx.font = `600 15px ${MONO}`; ctx.fillStyle = "#8a8a8a"; ctx.fillText("bitcoindevs.xyz/decoding", cx + 96, cy + 35);
    ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(cx, cy + 56, cw, 1);
    const mods = [["01", "Transactions", week >= 5], ["02", "Scripts", week >= 8], ["03", "Taproot", week >= 10]];
    mods.forEach(([n, t, done], i) => {
      const yy = cy + 112 + i * 62;
      ctx.font = `700 18px ${MONO}`; ctx.fillStyle = OR; ctx.fillText(n, cx + 28, yy);
      ctx.font = `600 26px ${FONT}`; ctx.fillStyle = "#F5F5F5"; ctx.fillText(t, cx + 72, yy);
      if (done) { ctx.font = `700 22px ${FONT}`; ctx.fillStyle = OR; ctx.fillText("✓", cx + cw - 44, yy); }
    });
    ctx.font = `500 15px ${MONO}`; ctx.fillStyle = "#6f6f6f";
    ctx.fillText("OP_DUP OP_HASH160 …", cx + 28, cy + ch - 28);

    // Call to action
    ctx.fillStyle = OR;
    ctx.beginPath(); ctx.roundRect(cx - 4, 520, cw + 8, 64, 32); ctx.fill();
    ctx.fillStyle = "#0A0A0A"; ctx.font = `800 24px ${FONT}`;
    const cta = "Join free →", ctw = ctx.measureText(cta).width;
    ctx.fillText(cta, cx + cw / 2 - ctw / 2, 561);
    ctx.font = `600 19px ${MONO}`; ctx.fillStyle = "#D6D6D6";
    const url = "codeorange.dev/decoding-bitcoin", uw = ctx.measureText(url).width;
    ctx.fillText(url, cx + cw / 2 - uw / 2, 620);

    logo(ctx, L, 650, 26);

    return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
  }

  window.MBShareCard = { make };
})();
