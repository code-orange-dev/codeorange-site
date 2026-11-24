// Builds the 1200x630 link-preview images (og:image) with a real Code Orange photo behind each title.
// Run from the repo root: node tools/og-photos.mjs   (needs Playwright + Chromium)
// Output: assets/og/<slug>.jpg. Edit CARDS to add or change a card.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
import path from 'node:path';

const CARDS = {
  home:        ['hero/builder-roundtable', 'Bitcoin developer school', 'Learn to build on', 'Bitcoin.', 'Hands-on workshops, study cohorts and open-source fellowships.'],
  about:       ['hero/builder-roundtable', 'Our story', 'Built for', 'Bitcoin builders.', 'A free, hands-on Bitcoin developer school.'],
  apply:       ['hero/community-circle', 'Apply', 'Join a free', 'Bitcoin program.', 'Workshops, cohorts and fellowships. Free for everyone joining.'],
  articles:    ['hero/whiteboard', 'Articles', 'Notes from', 'the school.', 'Self-custody, privacy and open-source Bitcoin development.'],
  builders:    ['hero/node-laptop', 'Builders', 'Proof of work,', 'in public.', 'Community members with pull requests merged into Bitcoin projects.'],
  calendar:    ['hero/mining-class', 'Calendar', 'Always something', 'happening.', 'Cohorts, workshops, reading groups and community calls.'],
  community:   ['hero/community-circle', 'Community', 'We build the community.', 'They build Bitcoin.', 'Mentorship, cohorts and accountability for Bitcoin builders.'],
  dashboard:   ['hero/node-laptop', 'PR dashboard', 'Pull requests', 'merged.', 'Live count of community contributions to Bitcoin open source.'],
  'decoding-bitcoin': ['hero/meetup-projector', 'Study cohort · free', 'Decoding Bitcoin.', 'Learn it together.', '10 weeks, Mondays on Discord. Transactions, Script, Taproot.'],
  fellowships: ['hero/fellowship-presentation', 'Fellowships', 'Get paid to build', 'Bitcoin open source.', 'Developer and educator fellowships. Apply now.'],
  portal:      ['hero/node-laptop', 'Student portal', 'Your Code Orange', 'dashboard.', 'Track sessions, homework and certificates.'],
  'privacy-track': ['hero/privacy-roundtable', 'Bitcoin privacy track', 'Payjoin, Silent Payments', 'and more.', 'Biweekly sessions on Discord. Free and open to all.'],
  programs:    ['hero/september', 'Programs', 'Pick your path', 'into Bitcoin.', 'From curious to contributor. Every program is free and hands-on.'],
  rawbit:      ['hero/mining-laptop', 'Study cohort', 'rawBit.', 'Bitcoin protocol, raw.', 'A 10-week Bitcoin protocol cohort.'],
  resources:   ['hero/ecash-session', 'Resource library', 'Every link', 'we have shared.', 'Searchable Bitcoin learning resources from our sessions.'],
  'session-notes': ['hero/projector', 'Session notes', 'What we learned', 'this week.', 'Recaps of every workshop and call, with recordings.'],
  start:       ['hero/bitcoin-house', 'Start here', 'Where do you', 'want to start?', 'Pick a free path and follow three steps.'],
  'programs-accountability-sessions': ['hero/roundtable', 'Accountability sessions', 'Ship a little', 'every week.', 'Weekly check-ins for Bitcoin builders.'],
  'programs-agentic-engineering': ['hero/site-screen', 'Workshop', 'Agentic engineering', 'for Bitcoiners.', 'Use AI coding tools to build on Bitcoin.'],
  'programs-bitcoin-basics': ['hero/community-screen', 'Beginner workshop', 'Bitcoin', 'basics.', 'Keys, wallets and transactions. Bring questions, not experience.'],
  'programs-bitcoin-reading-club': ['hero/floor-circle', 'Reading club', 'Read the', 'Bitcoin canon.', 'From the whitepaper to the cypherpunks, together.'],
  'programs-sovereign-bitcoiner': ['hero/miner-build', 'Workshop', 'Sovereign', 'Bitcoiner.', 'Full nodes, multisig, inheritance, ecash and Fedimint.'],
  'programs-talk-a-bit': ['hero/bitcoin-house', 'Meetup · Bali', 'Talk-a-Bit.', 'Bitcoin, out loud.', 'A friendly Bitcoin meetup in Bahasa and English.'],
  'programs-vibe-coding': ['hero/mining-laptop', 'Workshop', 'Vibe coding', 'on Nostr.', 'Build censorship-resistant apps with AI.'],
};

const root = process.cwd();
const dataUri = (p, type) => `data:${type};base64,${fs.readFileSync(path.join(root, p)).toString('base64')}`;
const logo = dataUri('assets/logo-dot-wordmark.svg', 'image/svg+xml');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const html = ([photo, eyebrow, white, accent, sub]) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;800&family=Plus+Jakarta+Sans:wght@700&display=swap" rel="stylesheet">
<style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#0A0A0A;font-family:Inter,sans-serif;color:#F5F5F5;position:relative;overflow:hidden}
.ph{position:absolute;top:0;right:0;bottom:0;left:300px;background:url(${dataUri('assets/' + photo + '.jpg', 'image/jpeg')}) center 40%/cover;
  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 40%)}
.sh{position:absolute;inset:0;background:linear-gradient(90deg,#0A0A0A 0%,rgba(10,10,10,.88) 38%,rgba(10,10,10,.2) 75%,rgba(10,10,10,.05) 100%),linear-gradient(0deg,rgba(10,10,10,.85) 0%,rgba(10,10,10,0) 40%)}
.in{position:absolute;left:64px;top:56px;bottom:56px;width:760px;display:flex;flex-direction:column}
.logo{height:46px;width:auto;align-self:flex-start}
.eb{margin-top:auto;font:700 18px 'Plus Jakarta Sans',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#F7931A}
h1{margin-top:16px;font-weight:800;font-size:66px;line-height:1.04;letter-spacing:-.025em;text-transform:uppercase}
h1 u{text-decoration:underline;text-decoration-color:#F7931A;text-decoration-thickness:.1em;text-underline-offset:.14em;text-decoration-skip-ink:none}
p{margin-top:22px;font-weight:500;font-size:24px;line-height:1.4;color:rgba(255,255,255,.78);max-width:640px}
</style></head><body><div class="ph"></div><div class="sh"></div>
<div class="in"><img class="logo" src="${logo}"><div class="eb">${esc(eyebrow)}</div><h1>${esc(white)} <u>${esc(accent)}</u></h1><p>${esc(sub)}</p></div></body></html>`;

const only = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const [slug, card] of Object.entries(CARDS)) {
  if (only.length && !only.includes(slug)) continue;
  await page.setContent(html(card), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(root, 'assets/og', slug + '.jpg'), type: 'jpeg', quality: 82 });
  console.log('assets/og/' + slug + '.jpg');
}
await browser.close();
