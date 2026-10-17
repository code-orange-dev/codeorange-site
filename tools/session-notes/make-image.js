// Renders the 1200x630 share image for one session: assets/session-notes/<slug>.jpg
// Usage: node tools/session-notes/make-image.js <slug> [photo path relative to the repo root]
// Needs Playwright with Chromium and the Inter Display fonts (installed in Claude's cloud sessions).
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const [slug, photo = 'assets/event-cards/self-custody.jpg'] = process.argv.slice(2);
const s = JSON.parse(fs.readFileSync(path.join(__dirname, 'sessions', slug + '.json'), 'utf8'));
const d = new Date(s.date + 'T00:00:00Z');
const date = `${d.getUTCDate()} ${d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })} ${d.getUTCFullYear()}`;
const words = s.title.split(' '), last = words.pop();
const title = `${words.join(' ')}<br><span class="o">${last.toLowerCase()}.</span>`;
const pill = [s.series, s.host && `Hosted by ${s.host}`].filter(Boolean).join(' <i></i> ');
const html = fs.readFileSync(path.join(__dirname, 'image/og.html'), 'utf8')
  .replace('PHOTO', 'file://' + path.join(root, photo)).replace('DATE', date)
  .replace('TITLE', title.charAt(0).toUpperCase() + title.slice(1).toLowerCase())
  .replace('PILL', pill).replace('src="logo.png"', 'src="file://' + path.join(__dirname, 'image/logo.png') + '"');
const tmp = path.join(require('os').tmpdir(), `og-${slug}.html`), png = tmp.replace('.html', '.png');
fs.writeFileSync(tmp, html);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.goto('file://' + tmp); await p.waitForTimeout(500); await p.screenshot({ path: png }); await b.close();
  const out = path.join(root, 'assets/session-notes', slug + '.jpg');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync('python3', ['-c', `from PIL import Image; Image.open(${JSON.stringify(png)}).convert('RGB').save(${JSON.stringify(out)}, quality=86, optimize=True, progressive=True)`]);
  console.log('Wrote', path.relative(root, out));
})();
