// Cohort certificates: a PDF + image per graduate and a share/verify page at /certificates/<id>.
// 1. Add people to tools/certificates/graduates.json:
//    {"id": "db26-satoshi", "name": "Satoshi Nakamoto", "cohort": "decoding-bitcoin-2026", "github": "optional"}
// 2. Run: node tools/certificates/make.js            (all graduates)
//         node tools/certificates/make.js --sample   (writes a sample to /tmp only, nothing published)
//         node tools/certificates/make.js --publish-sample   (the public example at /certificates/sample)
// Writes assets/certificates/<id>.jpg, .pdf, -share.jpg and certificates/<id>.html (+ /index.html mirror).
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const root = path.resolve(__dirname, '../..');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'graduates.json'), 'utf8'));
const sample = process.argv.includes('--sample');
const publishSample = process.argv.includes('--publish-sample');
const people = (sample || publishSample) ? [{ id: 'sample', name: 'Satoshi Nakamoto', cohort: Object.keys(data.cohorts)[0] }] : data.graduates;
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nice = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const logo = 'file://' + path.join(root, 'tools/session-notes/image/logo.png');
const tpl = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
const jpg = (png, out, w) => execFileSync('python3', ['-c',
  `from PIL import Image; im=Image.open(${JSON.stringify(png)}).convert('RGB'); im.thumbnail((${w},${w})); im.save(${JSON.stringify(out)}, quality=88, optimize=True, progressive=True)`]);

function page(g, c) {
  const url = `https://codeorange.dev/certificates/${g.id}`;
  const title = `${g.name} completed ${c.name} - Code Orange Dev School`;
  const d = new Date(c.date + 'T00:00:00Z');
  const li = 'https://www.linkedin.com/profile/add?' + new URLSearchParams({ startTask: 'CERTIFICATION_NAME', name: c.name, organizationName: 'Code Orange Dev School', issueYear: d.getUTCFullYear(), issueMonth: d.getUTCMonth() + 1, certUrl: url, certId: g.id });
  const x = 'https://x.com/intent/post?' + new URLSearchParams({ text: `I completed ${c.name} at @codeorangedev 🧡`, url });
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="robots" content="noindex"><meta name="description" content="${esc(`${g.name} completed ${c.name} at Code Orange Dev School on ${nice(c.date)}.`)}">
<link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:url" content="${url}"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="Certificate of completion from Code Orange Dev School."><meta property="og:image" content="https://codeorange.dev/assets/certificates/${g.id}-share.jpg">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="https://codeorange.dev/assets/certificates/${g.id}-share.jpg">
<link rel="icon" type="image/svg+xml" href="/assets/favicon-co.svg"><style>
body{margin:0;background:#0A0A0A;color:#F5F5F5;font-family:Inter,system-ui,sans-serif}main{max-width:1000px;margin:0 auto;padding:40px 18px 70px}
a{color:#F7931A}.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px}.top img{height:34px}
.cert{width:100%;height:auto;border-radius:16px;border:1px solid rgba(255,255,255,.12);display:block}
h1{font-size:clamp(26px,4vw,40px);margin:28px 0 8px}p{color:#B8B8B8;line-height:1.6;margin:0 0 8px}
.ok{display:inline-flex;gap:8px;align-items:center;padding:6px 12px;border-radius:99px;background:rgba(61,220,132,.12);color:#3ddc84;font-weight:600;font-size:14px}
.btns{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}.btns a{padding:12px 18px;border-radius:999px;border:1px solid rgba(247,147,26,.5);color:#F5F5F5;text-decoration:none;font-weight:600}
.btns a.p{background:#F7931A;color:#0A0A0A;border-color:#F7931A}</style></head><body><main>
<div class="top"><a href="/"><img src="/assets/logo-dot-wordmark.svg" alt="Code Orange Dev School"></a>${g.id === 'sample' ? '<span class="ok" style="background:rgba(247,147,26,.14);color:#F7931A">Sample certificate</span>' : '<span class="ok">&#10003; Verified certificate</span>'}</div>
<img class="cert" src="/assets/certificates/${g.id}.jpg" alt="Certificate of completion for ${esc(g.name)}" width="1600" height="1131">
<h1>${esc(g.name)} completed ${esc(c.name)}</h1>
<p>Issued by Code Orange Dev School on ${nice(c.date)}. Certificate ID: ${esc(g.id)}.${g.github ? ` GitHub: <a href="https://github.com/${esc(g.github)}">@${esc(g.github)}</a>.` : ''}</p>
<div class="btns"><a class="p" href="${esc(li)}" target="_blank" rel="noopener">Add to LinkedIn</a><a href="${esc(x)}" target="_blank" rel="noopener">Share on X</a><a href="/assets/certificates/${g.id}.pdf" download>Download PDF</a><a href="/start">Join Code Orange</a></div>
</main></body></html>`;
}

(async () => {
  const b = await chromium.launch();
  for (const g of people) {
    const c = data.cohorts[g.cohort];
    if (!c) throw new Error(`Unknown cohort ${g.cohort} for ${g.id}`);
    const html = tpl.replace('LOGO', logo).replace('NAME', esc(g.name)).replace('COHORT', esc(c.name)).replace('DETAILS', esc(c.details || '.'))
      .replace('TAGS', (c.topics || []).map((t) => `<span>${esc(t)}</span>`).join(''))
      .replace('DATE', nice(c.date)).replace('ID', esc(g.id))
      .replace('HOSTS', c.hosts ? `<div><small>Issued by</small><span>${esc(c.hosts)}</span></div>` : '');
    const tmp = path.join(os.tmpdir(), `cert-${g.id}.html`); fs.writeFileSync(tmp, html);
    const p = await b.newPage({ viewport: { width: 1600, height: 1131 } });
    await p.goto('file://' + tmp); await p.waitForTimeout(400);
    const outDir = sample ? os.tmpdir() : path.join(root, 'assets/certificates'); fs.mkdirSync(outDir, { recursive: true });
    const png = tmp.replace('.html', '.png'); await p.screenshot({ path: png });
    await p.pdf({ path: path.join(outDir, `${g.id}.pdf`), width: '1600px', height: '1131px', printBackground: true, pageRanges: '1' });
    jpg(png, path.join(outDir, `${g.id}.jpg`), 1600);
    // share card: certificate centred on a 1200x630 dark canvas
    const sp = await b.newPage({ viewport: { width: 1200, height: 630 } });
    const st = tmp.replace('.html', '-share.html'); fs.writeFileSync(st, `<body style="margin:0;width:1200px;height:630px;display:grid;place-items:center;background:radial-gradient(60% 70% at 50% 40%,#2a1703,#0A0A0A)"><img src="file://${png}" style="height:560px;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.6)"></body>`);
    await sp.goto('file://' + st); await sp.waitForTimeout(300); const spng = png.replace('.png', '-share.png'); await sp.screenshot({ path: spng });
    jpg(spng, path.join(outDir, `${g.id}-share.jpg`), 1200);
    if (!sample) {
      const out = page(g, c);
      fs.mkdirSync(path.join(root, 'certificates', g.id), { recursive: true });
      fs.writeFileSync(path.join(root, 'certificates', `${g.id}.html`), out);
      fs.writeFileSync(path.join(root, 'certificates', g.id, 'index.html'), out);
    } else fs.writeFileSync(path.join(outDir, 'sample-page.html'), page(g, c));
    console.log('Wrote', g.id, sample ? `(sample in ${outDir})` : '');
  }
  await b.close();
})();
