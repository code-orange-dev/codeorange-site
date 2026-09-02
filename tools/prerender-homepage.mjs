import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputFlag = process.argv.indexOf("--out");
const outputRoot = outputFlag === -1 ? projectRoot : resolve(process.argv[outputFlag + 1] || projectRoot);
const sourcePath = resolve(projectRoot, "index.html");
const componentPath = resolve(projectRoot, "home.dc.html");
const source = readFileSync(sourcePath, "utf8");
const componentMatch = source.match(/<x-dc>[\s\S]*?<\/x-dc>/);
const sourceWithoutDcScript = source.replace(/<script type="text\/x-dc" data-dc-script>[\s\S]*?<\/script>\s*/g, "");
const staticMatch = sourceWithoutDcScript.match(/<main id="static-homepage">[\s\S]*?<\/main>/);
const componentSource = existsSync(componentPath) ? readFileSync(componentPath, "utf8") : componentMatch?.[0];

if (!componentSource) {
  throw new Error("Expected the homepage source or home.dc.html to contain one <x-dc> component.");
}

const staticHomepage = `
<main id="static-homepage">
  <style>
    #static-homepage { background: #0B1220; color: #F5F1EA; font-family: "Space Grotesk", system-ui, sans-serif; min-height: 100vh; overflow-x: hidden; }
    #static-homepage * { box-sizing: border-box; }
    #static-homepage img, #static-homepage video { max-width: 100%; }
    #static-homepage a { color: inherit; }
    #static-homepage .co-wrap { width: min(1240px, calc(100% - 40px)); margin: 0 auto; }
    #static-homepage .co-band { border-bottom: 1px solid rgba(255,255,255,.08); }
    #static-homepage .co-eyebrow { margin: 0 0 16px; color: #F7931A; font: 700 12px/1.4 "JetBrains Mono", monospace; letter-spacing: .14em; text-transform: uppercase; }
    #static-homepage h1, #static-homepage h2, #static-homepage h3 { font-family: "Special Elite", "Courier New", monospace; font-weight: 400; line-height: 1.08; }
    #static-homepage h1 { max-width: 850px; margin: 0; font-size: clamp(42px, 6vw, 72px); }
    #static-homepage h2 { max-width: 760px; margin: 0; font-size: clamp(31px, 4vw, 52px); }
    #static-homepage h3 { margin: 0; font-size: 22px; }
    #static-homepage p { color: #C8CDD9; line-height: 1.65; }
    #static-homepage .co-announce { display: block; padding: 10px 20px; background: #F7931A; color: #0B1220; font: 700 13px/1.4 "JetBrains Mono", monospace; text-align: center; text-decoration: none; }
    #static-homepage .co-nav { display: flex; align-items: center; justify-content: space-between; gap: 20px; min-height: 82px; }
    #static-homepage .co-nav img { width: 150px; height: auto; }
    #static-homepage .co-links, #static-homepage .co-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
    #static-homepage .co-links a { color: #C8CDD9; font-size: 14px; text-decoration: none; }
    #static-homepage .co-button { display: inline-block; padding: 13px 20px; border: 1px solid rgba(255,255,255,.16); border-radius: 8px; font-weight: 700; text-decoration: none; }
    #static-homepage .co-button.primary { border-color: #F7931A; background: #F7931A; color: #0B1220; }
    #static-homepage .co-hero { position: relative; overflow: hidden; padding: 88px 0 68px; background: #0B1220; }
    #static-homepage .co-hero:before { content: ""; position: absolute; inset: 0; background: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(180deg, rgba(11,18,32,.74), rgba(11,18,32,.88)), url("/assets/new-workshops/workshop-nodes-miners.jpg"); background-size: 48px 48px, 48px 48px, auto, cover; background-position: 0 0, 0 0, center, center; opacity: .92; }
    #static-homepage .co-hero .co-wrap { position: relative; }
    #static-homepage .co-lead { max-width: 710px; margin: 24px 0 30px; font-size: 18px; }
    #static-homepage .co-paths { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; max-width: 900px; margin-top: 42px; }
    #static-homepage .co-path { display: block; min-height: 192px; padding: 22px; border: 1px solid rgba(255,255,255,.13); border-radius: 16px; background: rgba(18,33,59,.84); text-decoration: none; }
    #static-homepage .co-path strong { display: block; margin: 8px 0; font-size: 18px; }
    #static-homepage .co-path span { color: #8C94A6; font-size: 14px; line-height: 1.5; }
    #static-homepage .co-section { padding: 88px 0; }
    #static-homepage .co-photo-section { position: relative; overflow: hidden; isolation: isolate; }
    #static-homepage .co-photo-section:before { content: ""; position: absolute; inset: 0; z-index: -1; background-image: linear-gradient(180deg, rgba(11,18,32,.9), rgba(11,18,32,.96)), var(--co-bg); background-size: cover; background-position: var(--co-bg-pos, center); }
    #static-homepage .co-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-top: 34px; }
    #static-homepage .co-card { padding: 24px; border: 1px solid rgba(255,255,255,.1); border-radius: 16px; background: #12213B; }
    #static-homepage .co-card p { margin: 12px 0 0; font-size: 14px; }
    #static-homepage .co-list { display: grid; gap: 12px; margin-top: 30px; }
    #static-homepage .co-list article { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 20px; padding: 22px; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; background: #12213B; }
    #static-homepage .co-list h3 { font-family: "Space Grotesk", system-ui, sans-serif; font-size: 18px; font-weight: 700; }
    #static-homepage .co-list p { margin: 7px 0 0; font-size: 14px; }
    #static-homepage .co-meta { align-self: center; color: #F7931A; font: 700 12px/1.5 "JetBrains Mono", monospace; text-align: right; }
    #static-homepage .co-dark { background: #0F1A2E; }
    #static-homepage .co-calendar { margin-top: 30px; border: 1px solid rgba(255,255,255,.1); border-radius: 16px; overflow: hidden; background: #fff; box-shadow: 0 24px 70px rgba(0,0,0,.36); }
    #static-homepage .co-calendar iframe { display: block; width: 100%; height: 620px; border: 0; background: #fff; }
    #static-homepage .co-people { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 32px; }
    #static-homepage .co-person { padding: 20px; border-left: 3px solid #F7931A; background: #12213B; }
    #static-homepage .co-person b { display: block; font-size: 16px; }
    #static-homepage .co-person span { display: block; margin-top: 5px; color: #8C94A6; font-size: 14px; }
    #static-homepage .co-host { padding: 38px; border: 1px solid rgba(247,147,26,.35); border-radius: 20px; background: linear-gradient(135deg, rgba(247,147,26,.14), #12213B 58%); }
    #static-homepage details { border-bottom: 1px solid rgba(255,255,255,.1); padding: 18px 0; }
    #static-homepage summary { cursor: pointer; color: #F5F1EA; font-weight: 700; }
    #static-homepage details p { max-width: 760px; margin: 14px 0 0; }
    #static-homepage .co-media-footer { position: relative; min-height: 260px; margin-bottom: 42px; border: 1px solid rgba(255,255,255,.1); border-radius: 16px; overflow: hidden; background: #0F1A2E; }
    #static-homepage .co-media-footer video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    #static-homepage .co-media-footer:after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(8,13,24,.88), rgba(8,13,24,.38) 58%, rgba(8,13,24,.74)); }
    #static-homepage .co-media-footer div { position: relative; z-index: 1; max-width: 560px; padding: 34px; }
    #static-homepage footer { padding: 56px 0; border-top: 1px solid rgba(255,255,255,.08); }
    #static-homepage .co-foot { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 20px; color: #8C94A6; font-size: 14px; }
    html.dc-live #static-homepage { display: none; }
    @media (max-width: 760px) {
      #static-homepage .co-wrap { width: min(100% - 36px, 1240px); }
      #static-homepage .co-nav { padding: 16px 0; align-items: flex-start; flex-direction: column; }
      #static-homepage .co-nav img { width: 132px; }
      #static-homepage .co-links { display: none; }
      #static-homepage h1 { font-size: clamp(34px, 10.5vw, 48px); line-height: 1.05; }
      #static-homepage h2 { font-size: clamp(30px, 8.5vw, 40px); line-height: 1.08; }
      #static-homepage .co-lead { font-size: 16px; line-height: 1.62; }
      #static-homepage .co-paths, #static-homepage .co-grid, #static-homepage .co-people { grid-template-columns: 1fr; }
      #static-homepage .co-path { min-height: 0; padding: 20px; border-radius: 14px; }
      #static-homepage .co-card, #static-homepage .co-person, #static-homepage .co-list article { border-radius: 14px; }
      #static-homepage .co-list article { grid-template-columns: 1fr; }
      #static-homepage .co-meta { text-align: left; }
      #static-homepage .co-calendar iframe { height: 520px; }
      #static-homepage .co-hero, #static-homepage .co-section { padding: 56px 0; }
      #static-homepage .co-host { padding: 28px 22px; }
      #static-homepage .co-actions { width: 100%; align-items: stretch; }
      #static-homepage .co-button { width: 100%; text-align: center; }
      #static-homepage .co-nav .co-button { width: auto; }
    }
    @media (max-width: 380px) {
      #static-homepage .co-wrap { width: min(100% - 32px, 1240px); }
      #static-homepage h1 { font-size: clamp(31px, 11vw, 40px); }
      #static-homepage h2 { font-size: clamp(27px, 9.5vw, 34px); }
      #static-homepage .co-nav .co-actions { gap: 8px; }
      #static-homepage .co-nav .co-button { padding: 11px 14px; font-size: 14px; }
    }
  </style>
  <a class="co-announce" href="/rawbit">⚡ rawBit cohort is live now · Bitcoin Privacy Track open for enrollment · Apply →</a>
  <header class="co-band"><div class="co-wrap co-nav">
    <a href="#top"><img src="/assets/logo-white.png" alt="Code Orange Dev School"></a>
    <nav class="co-links" aria-label="Primary"><a href="/programs">Programs</a><a href="/calendar">Calendar</a><a href="/community">Community</a><a href="/impact">Impact</a><a href="/about">About</a></nav>
    <div class="co-actions"><a class="co-button" href="https://discord.gg/ZtvA79paWa" target="_blank" rel="noopener">Discord</a><a class="co-button primary" href="/apply">Apply now</a></div>
  </div></header>
  <section id="top" class="co-hero"><div class="co-wrap">
    <p class="co-eyebrow">Asia's Bitcoin Developer School · Singapore 🇸🇬</p>
    <h1>A Bitcoin OSS contributor pipeline <span style="color:#F7931A">with a fellowship layer.</span></h1>
    <p class="co-lead">Learn practical Bitcoin skills, become a capable builder, or bring hands-on Bitcoin education to your local community. Code Orange runs cohorts, workshops, and public open-source contribution paths across Asia.</p>
    <div class="co-actions"><a class="co-button primary" href="https://discord.gg/ZtvA79paWa" target="_blank" rel="noopener">Join Discord, it’s free</a><a class="co-button" href="/programs">Browse programs</a></div>
    <div class="co-paths" aria-label="Choose your path">
      <a class="co-path" href="/programs/bitcoin-basics"><span aria-hidden="true" style="font-size:25px">₿</span><strong>Learn Bitcoin</strong><span>Start with self-custody, nodes, privacy, and Bitcoin fundamentals. No developer background required.</span></a>
      <a class="co-path" href="/rawbit"><span aria-hidden="true" style="font-size:25px">⌘</span><strong>Become a contributor</strong><span>Move from technical curiosity to an open-source contribution with structured peer support.</span></a>
      <a class="co-path" href="https://github.com/code-orange-dev/curriculum" target="_blank" rel="noopener"><span aria-hidden="true" style="font-size:25px">◎</span><strong>Host a workshop</strong><span>Use open, editable workshop material to bring Bitcoin education to your city.</span></a>
    </div>
  </div></section>
  <section class="co-section co-photo-section" style="--co-bg:url('/assets/latest-workshops/workshop-latest-table.jpg'); --co-bg-pos:center 52%;"><div class="co-wrap"><p class="co-eyebrow">Programs</p><h2>Pick a practical next step.</h2><div class="co-grid">
    <article class="co-card"><span>🛡️ Monthly workshop</span><h3>Sovereign Bitcoiner</h3><p>Self-custody, full nodes, multisig, inheritance, Ecash, and Fedimint for people who want real independence.</p></article>
    <article class="co-card"><span>₿ 10-week cohort</span><h3>rawBit</h3><p>A protocol deep-dive through transactions, Scripts, Taproot, PSBTs, and P2P networking - with homework and sats.</p></article>
    <article class="co-card"><span>🔐 12-month cohort</span><h3>Bitcoin Privacy Track</h3><p>Contribution-first developer training around Silent Payments, Payjoin, Floresta, Fedimint, and Lightning privacy.</p></article>
  </div><p style="margin-top:28px"><a class="co-button" href="/programs">View all programs →</a></p></div></section>
  <section class="co-section co-dark co-photo-section" style="--co-bg:url('/assets/latest-workshops/workshop-latest-custody.jpg'); --co-bg-pos:center 52%;"><div class="co-wrap"><p class="co-eyebrow">Recurring events</p><h2>Always something happening.</h2><p class="co-lead">See the live Code Orange calendar here, then add it to your own calendar so workshops, cohorts, and study calls stay visible.</p><div class="co-calendar"><iframe title="Code Orange public student calendar" src="https://calendar.google.com/calendar/embed?src=466de2be7431d78be2049f96f5fd31f9b06b5a9cd94f909ba3182b18442ed499%40group.calendar.google.com&ctz=Asia%2FMakassar" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div><p style="margin-top:28px"><a class="co-button" href="/calendar">Open calendar page →</a></p></div></section>
  <section class="co-section co-photo-section" style="--co-bg:url('/assets/latest-workshops/workshop-latest-builders.jpg'); --co-bg-pos:center 42%;"><div class="co-wrap"><p class="co-eyebrow">Developer community</p><h2>We build the community. They build Bitcoin.</h2><p class="co-lead">Mentorship, structured cohorts, and a peer network help contributors make visible progress in the Bitcoin ecosystem.</p><div class="co-people">
    <article class="co-person"><b>🇮🇳 Chaitika</b><span>Silent Payments and Lightning cohorts at Bitshala Incubator.</span></article>
    <article class="co-person"><b>🇺🇦 Vaan</b><span>Contributor to rust-bitcoin and BDK wallet infrastructure.</span></article>
    <article class="co-person"><b>🇷🇴 Razor</b><span>Bitcoin P2P security monitoring contributor and BOSS participant.</span></article>
    <article class="co-person"><b>🇳🇬 Arowolo</b><span>Async Payjoin (BIP77) contributor.</span></article>
  </div><p style="margin-top:28px"><a class="co-button" href="/community">Meet the community →</a></p></div></section>
  <section class="co-section co-dark co-photo-section" style="--co-bg:url('/assets/latest-workshops/workshop-latest-devices.jpg'); --co-bg-pos:center 48%;"><div class="co-wrap"><div class="co-host"><p class="co-eyebrow">For community leaders</p><h2>Run a Code Orange workshop in your city.</h2><p class="co-lead">Free, editable, localizable workshops for beginners through advanced Bitcoin learners. Get the materials, adapt them for your city, and join a network of hosts across Asia.</p><div class="co-actions"><a class="co-button primary" href="https://github.com/code-orange-dev/curriculum" target="_blank" rel="noopener">Get the workshop kit</a><a class="co-button" href="https://discord.gg/ZtvA79paWa" target="_blank" rel="noopener">Ask in Discord</a></div></div></div></section>
  <section class="co-section co-photo-section" style="--co-bg:url('/assets/latest-workshops/workshop-latest-table.jpg'); --co-bg-pos:center;"><div class="co-wrap"><p class="co-eyebrow">FAQ</p><h2>Common questions.</h2>
    <details open><summary>How much does it cost?</summary><p>All Code Orange programs are free for accepted students. The school is funded through Bitcoin grants, donations, and partnerships.</p></details>
    <details><summary>Do I need prior coding experience?</summary><p>rawBit and the Bitcoin Privacy Track expect comfort with a programming language. Bitcoin Basics, Sovereign Bitcoiner, OpenClaw, and Vibe Coding welcome curious beginners.</p></details>
    <details><summary>Can I join from outside Singapore or Bali?</summary><p>Yes. Most sessions run online through Discord, with in-person hardware sessions layered in where they help.</p></details>
    <details><summary>Can I run a workshop in my city?</summary><p>Yes. The curriculum is open source and the community can help with local adaptation, links, and promotion.</p></details>
  </div></section>
  <footer><div class="co-wrap">
    <div class="co-media-footer"><video data-lazy-video data-src="/assets/co-footer.mp4" poster="/assets/co-footer-poster.jpg" autoplay muted loop playsinline preload="none"></video><div><p class="co-eyebrow">Scenes from the school</p><h2>Real workshops. Real devices. Real Bitcoin builders.</h2></div></div>
    <div class="co-foot"><span>Code Orange Dev School · Singapore 🇸🇬</span><span><a href="mailto:hello@codeorange.dev">hello@codeorange.dev</a> · <a href="https://github.com/code-orange-dev" target="_blank" rel="noopener">GitHub</a> · <a href="https://discord.gg/ZtvA79paWa" target="_blank" rel="noopener">Discord</a></span></div>
  </div></footer>
</main>`;

const loader = `
<script>
  (() => {
    const markLiveWhenReady = () => {
      if (document.querySelector('#dc-root .sc-host')) {
        document.documentElement.classList.add('dc-live');
        return true;
      }
      return false;
    };
    const boot = () => {
      if (typeof window.__dcBoot !== 'function') return false;
      window.__dcBoot();
      requestAnimationFrame(() => requestAnimationFrame(markLiveWhenReady));
      return true;
    };
    fetch('/home.dc.html', { cache: 'force-cache' })
      .then((response) => response.ok ? response.text() : Promise.reject(new Error('Unable to load homepage component')))
      .then((html) => {
        const staging = document.createElement('template');
        staging.innerHTML = html.trim();
        const component = staging.content.querySelector('x-dc');
        if (!component) throw new Error('Homepage component is missing');
        document.body.append(component);
        if (boot()) return;
        const timer = window.setInterval(() => {
          if (boot()) window.clearInterval(timer);
        }, 50);
      })
      .catch(() => {
        // The static homepage remains available if JavaScript or this request fails.
      });
  })();
</script>`;

let productionHtml = sourceWithoutDcScript;
if (componentMatch) {
  productionHtml = sourceWithoutDcScript.replace(componentMatch[0], staticHomepage);
} else if (staticMatch) {
  productionHtml = sourceWithoutDcScript.replace(staticMatch[0], staticHomepage);
} else {
  productionHtml = sourceWithoutDcScript.replace(/<body[^>]*>/, (bodyTag) => `${bodyTag}\n${staticHomepage}`);
}

if (!productionHtml.includes("fetch('/home.dc.html'")) {
  productionHtml = productionHtml.replace(/<\/body>/, `${loader}\n</body>`);
}

mkdirSync(outputRoot, { recursive: true });
writeFileSync(resolve(outputRoot, "home.dc.html"), componentSource);
writeFileSync(resolve(outputRoot, "index.html"), productionHtml);
