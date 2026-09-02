import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const writtenPages = new Set();

const links = {
  discord: "https://discord.gg/ZtvA79paWa",
  github: "https://github.com/code-orange-dev",
  curriculum: "https://github.com/code-orange-dev/curriculum",
  prTracker: "https://github.com/code-orange-dev/PR-tracking-dashboard",
  devCommunity: "https://github.com/code-orange-dev/dev-community",
  impactReport: "https://github.com/code-orange-dev/impact-report",
  fellowshipsRepo: "https://github.com/code-orange-dev/fellowships",
  gradPipeline: "https://github.com/code-orange-dev/grad-pipeline",
  workshops: "https://github.com/code-orange-dev/workshops",
  bitcoinIsland: "https://github.com/code-orange-dev/bitcoin-island",
  seedBackup: "https://github.com/code-orange-dev/seed-phrase-backup-sheet",
  addressGenerator: "https://github.com/code-orange-dev/address-generator",
  rustBitcoin: "https://github.com/code-orange-dev/rust-bitcoin",
  bdk: "https://github.com/code-orange-dev/bdk",
  lnd: "https://github.com/code-orange-dev/lnd",
  lightning: "https://github.com/code-orange-dev/lightning",
  btcd: "https://github.com/code-orange-dev/btcd",
  geyser: "https://geyser.fund/project/codeorangedevschool",
  emailAddress: "hello@codeorange.dev",
  email: "mailto:hello@codeorange.dev",
  consultingBooking: "https://calendar.app.google/FdScUQokVkKVQK3F8",
  publicCalendar:
    "https://calendar.google.com/calendar/embed?src=466de2be7431d78be2049f96f5fd31f9b06b5a9cd94f909ba3182b18442ed499%40group.calendar.google.com&ctz=Asia%2FMakassar",
  x: "https://x.com/CodeOrangeDevs",
  instagram: "https://www.instagram.com/codeorangedevs",
  nostr: "https://njump.me/npub1gxqyeea3xspkd68mxlxsvvk3gdzdd555u504ynwpdj0ghg503mvq2gydt0",
  strategyReport: "/strategy-report.md",
};

const githubSnapshot = {
  repoCount: "26",
  sourceRepos: "21",
  forks: "5",
  languages: "TypeScript, JavaScript, Python, Shell, HTML",
  lastChecked: "2026-06-16",
};

const programs = [
  {
    slug: "privacy-track",
    title: "Bitcoin Privacy Track",
    type: "Developer Cohort",
    audience: "For Developers",
    duration: "12 months",
    schedule: "Bi-weekly sessions",
    format: "Online, Discord",
    level: "Advanced",
    href: "/privacy-track",
    image: "/assets/new-workshops/workshop-hands-on-devices.jpg",
    blurb:
      "A contribution-first curriculum covering Silent Payments, Payjoin, Floresta, Fedimint, and Lightning privacy.",
    lessons: ["Chain analysis defense", "Silent Payments", "Payjoin", "Floresta", "Fedimint privacy"],
  },
  {
    slug: "rawbit",
    title: "rawBit",
    type: "Study Cohort",
    audience: "For Developers",
    duration: "10 weeks",
    schedule: "Next cohort: May 11, 2026",
    format: "Online, Discord",
    level: "Intermediate",
    href: "/rawbit",
    image: "/assets/new-workshops/workshop-nodes-miners.jpg",
    blurb:
      "A protocol deep-dive turning developers into Bitcoin builders through transactions, Script, Taproot, PSBTs, and P2P networking.",
    lessons: ["Raw transactions", "Bitcoin Script", "Taproot and PSBTs", "P2P networking", "First open source PR"],
  },
  {
    slug: "sovereign-bitcoiner",
    title: "Sovereign Bitcoiner",
    type: "Workshop",
    audience: "For Bitcoiners",
    duration: "Monthly",
    schedule: "Every 2nd Wednesday, 11:00 UTC",
    format: "Online, Discord",
    level: "Intermediate",
    href: "/programs/sovereign-bitcoiner",
    image: "/assets/new-workshops/workshop-coldcard-table.jpg",
    blurb:
      "Deep technical training for bitcoiners who want real sovereignty: full nodes, multisig, self-custody, inheritance, Ecash, and Fedimint.",
    lessons: ["Full node setup", "Multisig operations", "Hardware wallets", "Inheritance planning", "Ecash and Fedimint"],
  },
  {
    slug: "openclaw",
    title: "OpenClaw",
    type: "Workshop",
    audience: "For Bitcoiners",
    duration: "Monthly",
    schedule: "Every 3rd Wednesday, 12:00 UTC",
    format: "Online, Discord",
    level: "All levels",
    href: "/programs/openclaw",
    image: "/assets/new-workshops/workshop-hardware-builders.jpg",
    blurb:
      "A hands-on open source Bitcoin workshop where learners practice GitHub workflow, code review, and shipping meaningful PRs.",
    lessons: ["GitHub contribution workflow", "Issue selection", "Code review basics", "Bitcoin library tour", "First meaningful PR"],
  },
  {
    slug: "vibe-coding",
    title: "Vibe Coding on Nostr",
    type: "Workshop",
    audience: "No Code Required",
    duration: "Monthly",
    schedule: "Every 4th Tuesday, 5:00 PM WITA",
    format: "In-person, Bitcoin House Bali",
    level: "Beginner",
    href: "/programs/vibe-coding",
    image: "/assets/new-workshops/workshop-table-builders.jpg",
    blurb:
      "Build censorship-resistant apps on the p2p internet using AI tools, Nostr, and Shakespeare.DIY.",
    lessons: ["Nostr protocol basics", "AI-assisted development", "Shakespeare.DIY", "Censorship-resistant apps", "Freedom tech stack"],
  },
  {
    slug: "bitcoin-basics",
    title: "Bitcoin Basics",
    type: "Online Meetup",
    audience: "For Everyone",
    duration: "Monthly",
    schedule: "Every 1st Thursday, 11:00 UTC",
    format: "Online, Discord",
    level: "Beginner",
    href: "/programs/bitcoin-basics",
    image: "/assets/new-workshops/workshop-bitcoin-toolkit.jpg",
    blurb:
      "A welcoming intro to technical Bitcoin fundamentals: keys, wallets, transactions, the mempool, and how self-custody actually works.",
    lessons: ["How Bitcoin works", "Keys and wallets", "On-chain transactions", "Mempool basics", "First sovereignty habits"],
  },
  {
    slug: "bitcoin-reading-club",
    title: "Bitcoin Reading Club",
    type: "Online Meetup",
    audience: "For Everyone",
    duration: "Monthly",
    schedule: "Every 4th Wednesday, 12:00 UTC",
    format: "Online, Discord",
    level: "All levels",
    href: "/programs/bitcoin-reading-club",
    image: "/assets/new-workshops/workshop-hardware-builders.jpg",
    blurb:
      "Monthly deep-reads of the essential Bitcoin canon, from monetary history to protocol design and cypherpunk culture.",
    lessons: ["The Bitcoin Standard", "Mastering Bitcoin", "The Blocksize War", "Cypherpunk history", "Group discussion"],
  },
  {
    slug: "talk-a-bit",
    title: "Talk-a-Bit",
    type: "Bitcoin Meetup",
    audience: "For Everyone",
    duration: "Monthly",
    schedule: "Every 15th, 19:00 WIB",
    format: "Online, Discord",
    level: "All levels",
    href: "/programs/talk-a-bit",
    image: "/assets/new-workshops/workshop-table-builders.jpg",
    blurb:
      "A free-flowing Bahasa and English meetup where bitcoiners across Southeast Asia connect, debate, and share what they are building.",
    lessons: ["Regional Bitcoin updates", "Open conversation", "Bahasa and English", "Community intros", "Builder signals"],
  },
  {
    slug: "accountability-sessions",
    title: "Accountability Sessions",
    type: "AIR Tool",
    audience: "For Builders",
    duration: "Monthly",
    schedule: "Every 1st Tuesday, 11:00 UTC",
    format: "Online, Discord",
    level: "All levels",
    href: "/programs/accountability-sessions",
    image: "/assets/new-workshops/workshop-hands-on-devices.jpg",
    blurb:
      "A lightweight rhythm for builders using Actions, Intentions, and Reflections to stay honest after the cohort ends.",
    lessons: ["Actions", "Intentions", "Reflections", "Peer accountability", "Shipping momentum"],
  },
];

const activeDevs = [
  ["Chaitika", "Silent Payments", "silent-pay-wallet and silent-pay-indexer work, plus Lightning cohort leadership in India."],
  ["Vaan", "rust-bitcoin and bdk-cli", "Wallet infrastructure contributions used across production Bitcoin applications."],
  ["Razor", "peer-observer", "Merged PRs into 0xB10C's Bitcoin P2P monitoring tool and mentors technical workshops."],
  ["Arowolo", "Async Payjoin", "First rust-payjoin PR approved for one of Bitcoin's most important privacy upgrades."],
  ["Psychemist", "BDK, LDK, BIP375", "Wallet, protocol, and Lightning contributions across several repositories."],
  ["Diegodev", "gossip-observer and BINST", "Bitcoin visuals and protocol experimentation, including BTC++ hackathon finalist work."],
];

const githubProofRepos = [
  ["PR-tracking-dashboard", "Contribution proof", "Tracks Code Orange community pull requests so student output can be inspected in public.", links.prTracker],
  ["curriculum", "Open education", "Reusable workshop and cohort material for communities that want to run Bitcoin education locally.", links.curriculum],
  ["dev-community", "Builder profiles", "Public developer profiles and emerging contributor records from the Code Orange community.", links.devCommunity],
  ["impact-report", "Funders and partners", "Impact reporting material that gives supporters a clearer view of the school output.", links.impactReport],
  ["fellowships", "Funding pipeline", "Public fellowship material for Bitcoin developers and technical educators.", links.fellowshipsRepo],
  ["grad-pipeline", "Next steps", "The graduate contribution pipeline that points builders from cohort work into public repositories.", links.gradPipeline],
];

const githubToolkitRepos = [
  ["workshops", "Workshop library", "Reusable Bitcoin workshop assets for hosts and educators.", links.workshops],
  ["bitcoin-island", "Local community", "A public project for the Bali Bitcoin community and local education surface.", links.bitcoinIsland],
  ["seed-phrase-backup-sheet", "Self-custody tool", "A printable backup worksheet for sovereignty workshops.", links.seedBackup],
  ["address-generator", "Learning app", "A small technical project for understanding Bitcoin addresses.", links.addressGenerator],
];

const githubProtocolRepos = [
  ["rust-bitcoin", "Rust Bitcoin library", links.rustBitcoin],
  ["bdk", "Bitcoin Dev Kit wallet library", links.bdk],
  ["lnd", "Lightning Network Daemon", links.lnd],
  ["lightning", "Core Lightning implementation", links.lightning],
  ["btcd", "Alternative full node implementation", links.btcd],
];

const workshopPhotos = {
  fellowshipRoundtable: ["/assets/workshops/workshop-fellowship-roundtable.jpg", "Fellowship roundtable at Bitcoin House Bali", "Fellowship pipeline roundtable"],
  siteDemo: ["/assets/workshops/workshop-site-demo.jpg", "Code Orange website shown during a workshop", "Website and program walkthrough"],
  roomWide: ["/assets/workshops/workshop-room-wide.jpg", "Code Orange workshop room with students around the table", "Students working around the table"],
  privacyTable: ["/assets/workshops/workshop-privacy-table.jpg", "Privacy workshop at Code Orange Dev School", "Privacy workshop in session"],
  miningKit: ["/assets/workshops/workshop-mining-kit.jpg", "ASIC miner and Code Orange workshop kit on a table", "Mining kit and workshop gear"],
  miningLaptop: ["/assets/workshops/workshop-mining-laptop.jpg", "Bitcoin mining lesson on a laptop at Code Orange", "Mining lesson with hardware"],
  hardwareCircle: ["/assets/workshops/workshop-hardware-circle.jpg", "Hardware sovereignty workshop with devices on the floor", "Hardware sovereignty circle"],
  september0514: ["/assets/workshops/workshop-september-0514.jpg", "September Code Orange workshop session", "September workshop session"],
  september0518: ["/assets/workshops/workshop-september-0518.jpg", "September Code Orange hands-on workshop", "Hands-on workshop table"],
  tableBuilders: ["/assets/new-workshops/workshop-table-builders.jpg", "Code Orange builders learning with Bitcoin workshop hardware", "Builders around real Bitcoin hardware"],
  nodesMiners: ["/assets/new-workshops/workshop-nodes-miners.jpg", "Bitcoin nodes, miners, and devices on a Code Orange workshop table", "Nodes, miners, and signers"],
  minerClose: ["/assets/new-workshops/workshop-miner-close.jpg", "Close-up of Code Orange Bitcoin mining hardware", "Mining hardware close-up"],
  hardwareBuilders: ["/assets/new-workshops/workshop-hardware-builders.jpg", "Code Orange students learning with laptops and hardware wallets", "Hands-on builder session"],
  handsOnDevices: ["/assets/new-workshops/workshop-hands-on-devices.jpg", "Hands-on Bitcoin devices during a Code Orange workshop", "Hands-on device lab"],
  coldcardTable: ["/assets/new-workshops/workshop-coldcard-table.jpg", "Bitcoin hardware wallet and workshop devices at Code Orange", "Self-custody device table"],
  bitcoinToolkit: ["/assets/new-workshops/workshop-bitcoin-toolkit.jpg", "Code Orange Bitcoin toolkit with workshop materials and devices", "Workshop toolkit"],
};

function pageShell({
  title,
  description,
  eyebrow,
  heading,
  intro,
  body,
  cta = true,
  heroPrimary = { label: "Apply to a Program", href: "/apply" },
  heroSecondary = { label: "Ask in Discord", href: links.discord, external: true },
  terminalUser = "student@codeorange",
  terminalLines = [
    ["$ whoami", ""],
    ["bitcoin_builder.apprentice", "muted"],
    ["$ cat mission.txt", ""],
    ["Train devs in Asia. Strengthen the network.", "orange"],
    ["$ ls programs/", ""],
    ["rawbit/ privacy-track/ openclaw/ sovereign-bitcoiner/", "muted"],
  ],
}) {
  const secondaryAttrs = heroSecondary.external ? ' target="_blank" rel="noopener"' : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} - Code Orange Dev School</title>
<meta name="description" content="${description}">
<meta name="theme-color" content="#F7931A">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Code Orange Dev School">
<meta property="og:title" content="${title} - Code Orange Dev School">
<meta property="og:description" content="${description}">
<meta property="og:image" content="https://codeorange.dev/assets/og-codeorange-workshop.jpg">
<meta property="og:image:secure_url" content="https://codeorange.dev/assets/og-codeorange-workshop.jpg">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Code Orange Dev School Bitcoin workshop in Bali">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title} - Code Orange Dev School">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="https://codeorange.dev/assets/og-codeorange-workshop.jpg">
<link rel="icon" type="image/svg+xml" href="/assets/favicon-bitcoin.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Special+Elite&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="/assets/lazy-video.js?v=20260902a" defer></script>
${styles()}
</head>
<body>
<a class="announce" href="/apply">rawBit cohort is live now &middot; Bitcoin Privacy Track open for enrollment <span>Apply &rarr;</span></a>
<header class="site-header">
  <div class="header-inner">
    <a class="brand" href="/" aria-label="Code Orange Dev School home"><img src="/assets/logo-white.png" alt="Code Orange Dev School"></a>
    <nav class="desktop-nav" aria-label="Primary">
      <a href="/programs">Programs</a>
      <a href="/consulting">Consulting</a>
      <a href="/fellowships">Fellowships</a>
      <a href="/calendar">Calendar</a>
      <a href="/community">Community</a>
      <a href="/impact">Impact</a>
      <a href="/strategy">Strategy</a>
      <a href="/about">About</a>
    </nav>
    <div class="header-actions">
      <a class="ghost small" href="${links.discord}" target="_blank" rel="noopener">Discord</a>
      <a class="button small" href="/apply">Apply Now</a>
    </div>
  </div>
  <nav class="mobile-nav" aria-label="Mobile">
    <a href="/programs">Programs</a>
    <a href="/consulting">Consulting</a>
    <a href="/calendar">Calendar</a>
    <a href="/community">Community</a>
    <a href="/impact">Impact</a>
    <a href="/strategy">Strategy</a>
    <a href="/about">About</a>
  </nav>
</header>
<main>
  <section class="hero">
    <div class="glow"></div>
    <div class="hero-grid">
      <div>
        <p class="eyebrow">${eyebrow}</p>
        <h1>${heading}</h1>
        <p class="lead">${intro}</p>
        <div class="cta-row">
          <a class="button" href="${heroPrimary.href}">${heroPrimary.label}</a>
          <a class="ghost" href="${heroSecondary.href}"${secondaryAttrs}>${heroSecondary.label}</a>
        </div>
      </div>
      <div class="terminal-card" aria-label="Code Orange terminal card">
        <div class="terminal-bar"><span></span><span></span><span></span><strong>${terminalUser}</strong></div>
        <div class="terminal-body">
          ${terminalLines.map(([text, klass]) => `<p${klass ? ` class="${klass}"` : ""}>${text}</p>`).join("")}
        </div>
      </div>
    </div>
  </section>
  ${body}
  ${cta ? finalCta() : ""}
</main>
${footer()}
</body>
</html>`;
}

function styles() {
  return `<style>
:root { color-scheme: dark; --bg:#0B1220; --band:#0F1A2E; --card:#12213B; --text:#F5F1EA; --muted:#C8CDD9; --dim:#8C94A6; --orange:#F7931A; --orange2:#FFB347; --line:rgba(255,255,255,.08); }
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; overflow-x: hidden; background: var(--bg); color: var(--text); font-family: "Space Grotesk", system-ui, sans-serif; scroll-behavior: smooth; }
body { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
img, video, iframe { max-width: 100%; }
a { color: inherit; }
.announce { display: flex; justify-content: center; gap: 10px; padding: 9px 24px; background: var(--orange); color: var(--bg); text-decoration: none; font: 700 13px "JetBrains Mono", monospace; text-align: center; }
.announce span { text-decoration: underline; text-underline-offset: 3px; }
.site-header { position: sticky; top: 0; z-index: 50; background: rgba(11,18,32,.74); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); }
.header-inner { max-width: 1240px; height: 78px; margin: 0 auto; padding: 0 32px; display: flex; align-items: center; justify-content: space-between; gap: 22px; }
.brand img { display: block; width: auto; height: 50px; }
.desktop-nav, .header-actions, .cta-row { display: flex; align-items: center; gap: 12px; }
.desktop-nav a, .mobile-nav a { color: var(--muted); text-decoration: none; font-size: 14px; font-weight: 600; padding: 8px 10px; border-radius: 8px; }
.desktop-nav a:hover, .mobile-nav a:hover { color: var(--orange); }
.mobile-nav { display: none; gap: 8px; overflow-x: auto; padding: 0 16px 10px; scrollbar-width: none; -webkit-overflow-scrolling: touch; scroll-snap-type: x proximity; }
.mobile-nav::-webkit-scrollbar { display: none; }
.mobile-nav a { flex: 0 0 auto; scroll-snap-align: start; }
.button, .ghost { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 13px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; transition: border-color .15s ease, color .15s ease, background .15s ease, transform .15s ease; }
.button { background: var(--orange); color: var(--bg); }
.button:hover { background: var(--orange2); }
.ghost { border: 1px solid rgba(255,255,255,.16); color: var(--text); }
.ghost:hover { border-color: var(--orange); color: var(--orange); }
.small { min-height: 40px; padding: 9px 18px; font-size: 14px; }
.hero { position: relative; overflow: hidden; background-image: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px); background-size: 48px 48px; }
.hero-grid, .section-inner { max-width: 1240px; margin: 0 auto; padding: 96px 32px; }
.hero-grid { display: grid; grid-template-columns: minmax(0,1.08fr) minmax(320px,.92fr); gap: 64px; align-items: center; }
.glow { position: absolute; top: -160px; right: -110px; width: 740px; height: 740px; border-radius: 50%; background: radial-gradient(circle, rgba(247,147,26,.14), transparent 66%); pointer-events: none; }
.eyebrow { margin: 0 0 22px; color: var(--orange); font: 700 12px "JetBrains Mono", monospace; letter-spacing: .16em; text-transform: uppercase; }
h1, h2, h3 { font-family: "Special Elite", "Courier New", monospace; font-weight: 400; color: var(--text); }
h1 { margin: 0 0 26px; max-width: 780px; font-size: clamp(40px, 4.6vw, 68px); line-height: 1.05; }
h2 { margin: 0 0 18px; font-size: clamp(32px, 3.3vw, 50px); line-height: 1.08; }
h3 { margin: 0; font-size: 26px; line-height: 1.15; }
.lead { max-width: 620px; margin: 0 0 34px; color: var(--muted); font-size: 18px; line-height: 1.65; }
.terminal-card, .card, .program-card, .stat, .timeline-item { background: var(--card); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.32); }
.terminal-bar { display: flex; align-items: center; gap: 8px; padding: 14px 18px; background: var(--band); border-bottom: 1px solid var(--line); }
.terminal-bar span { width: 12px; height: 12px; border-radius: 50%; }
.terminal-bar span:nth-child(1){ background:#FF5F56; } .terminal-bar span:nth-child(2){ background:#FFBD2E; } .terminal-bar span:nth-child(3){ background:#27C93F; }
.terminal-bar strong { margin-left: 10px; color: var(--dim); font: 500 12px "JetBrains Mono", monospace; }
.terminal-body { padding: 24px; font: 14px/1.9 "JetBrains Mono", monospace; }
.terminal-body p { margin: 0; } .orange { color: var(--orange); } .muted { color: var(--dim); }
.band { background: var(--band); border-block: 1px solid var(--line); }
.grid { display: grid; gap: 22px; }
.grid.two { grid-template-columns: repeat(2, minmax(0,1fr)); } .grid.three { grid-template-columns: repeat(3, minmax(0,1fr)); }
.program-card { display: grid; grid-template-rows: 210px 1fr; text-decoration: none; transition: transform .18s ease, border-color .18s ease; }
.program-card:hover { transform: translateY(-4px); border-color: rgba(247,147,26,.55); }
.program-card img, .card > img { width: 100%; height: 100%; object-fit: cover; transform: scale(1.012); }
.card-body { padding: 24px; }
.meta { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 0; }
.pill { display: inline-flex; padding: 7px 12px; border: 1px solid rgba(255,255,255,.14); border-radius: 999px; color: var(--muted); font: 600 12px "JetBrains Mono", monospace; }
.pill.orange { color: var(--orange); border-color: rgba(247,147,26,.42); }
.card p, .program-card p, .timeline-item p { color: var(--muted); line-height: 1.65; }
.repo-card { display: block; text-decoration: none; transition: transform .18s ease, border-color .18s ease; }
.repo-card:hover { transform: translateY(-4px); border-color: rgba(247,147,26,.55); }
.repo-card h3 { margin-top: 14px; }
.stat { padding: 26px; }
.stat strong { display: block; color: var(--orange); font: 400 40px/1 "Special Elite", monospace; margin-bottom: 10px; }
.timeline { display: grid; gap: 14px; counter-reset: step; }
.timeline-item { display: grid; grid-template-columns: 70px 1fr; gap: 22px; padding: 24px; counter-increment: step; }
.timeline-item:before { content: counter(step, decimal-leading-zero); color: var(--orange); font: 700 16px "JetBrains Mono", monospace; }
.split { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 42px; align-items: start; }
.feature-panel { background: linear-gradient(145deg, rgba(247,147,26,.12), rgba(18,33,59,.86) 42%, rgba(15,26,46,.96)); border: 1px solid rgba(247,147,26,.26); border-radius: 16px; box-shadow: 0 28px 80px rgba(0,0,0,.34); overflow: hidden; }
.feature-panel-inner { padding: 28px; }
.photo-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; margin-top: 30px; }
.photo-card { position: relative; min-height: 300px; border-radius: 16px; overflow: hidden; border: 1px solid var(--line); background: var(--card); box-shadow: 0 20px 60px rgba(0,0,0,.28); }
.photo-card.tall { min-height: 420px; }
.photo-card.wide { grid-column: span 2; }
.photo-card img, .feature-photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: scale(1.012); }
.photo-card:after, .feature-photo:after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 45%, rgba(8,13,24,.78) 100%); pointer-events: none; }
.photo-caption { position: absolute; left: 14px; right: 14px; bottom: 14px; z-index: 1; display: inline-flex; width: max-content; max-width: calc(100% - 28px); padding: 7px 11px; border-radius: 999px; background: rgba(8,13,24,.78); border: 1px solid rgba(255,255,255,.13); color: var(--text); font: 700 11px "JetBrains Mono", monospace; letter-spacing: .08em; text-transform: uppercase; }
.feature-photo { position: relative; min-height: 430px; border-radius: 16px; overflow: hidden; border: 1px solid var(--line); background: var(--card); box-shadow: 0 24px 70px rgba(0,0,0,.32); }
.calendar-frame { margin-top: 28px; background: #fff; border: 1px solid rgba(255,255,255,.12); border-radius: 16px; overflow: hidden; box-shadow: 0 24px 70px rgba(0,0,0,.36); }
.calendar-frame iframe { display: block; width: 100%; height: 680px; border: 0; background: #fff; }
.booking-panel { display: grid; gap: 16px; padding: 24px; background: rgba(8,13,24,.48); border: 1px solid var(--line); border-radius: 16px; }
.price-tag { display: inline-flex; width: max-content; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 999px; background: rgba(247,147,26,.14); border: 1px solid rgba(247,147,26,.34); color: var(--orange); font: 700 13px "JetBrains Mono", monospace; }
.footer { border-top: 1px solid var(--line); background: #080D18; }
.footer-media { position: relative; max-width: 1240px; min-height: 300px; margin: 56px auto 0; border: 1px solid rgba(255,255,255,.1); border-radius: 16px; overflow: hidden; background: var(--band); box-shadow: 0 24px 70px rgba(0,0,0,.34); }
.footer-media video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.footer-media:after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(8,13,24,.9), rgba(8,13,24,.34) 56%, rgba(8,13,24,.74)); pointer-events: none; }
.footer-media-copy { position: relative; z-index: 1; max-width: 560px; padding: 42px; }
.footer-grid { max-width: 1240px; margin: 0 auto; padding: 56px 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
.footer a { color: var(--dim); text-decoration: none; } .footer a:hover { color: var(--orange); }
.link-list { display: grid; gap: 10px; }
.final-cta { text-align: center; border-top: 1px solid var(--line); }
@media (max-width: 900px) {
  .announce { padding: 8px 16px; line-height: 1.42; }
  .desktop-nav { display: none; } .mobile-nav { display: flex; padding-bottom: 12px; gap: 6px; }
  .header-inner { height: 62px; padding: 0 16px; gap: 12px; } .brand img { height: 40px; }
  .hero-grid, .section-inner { padding: 64px 20px; }
  .hero-grid { gap: 30px; }
  .hero-grid, .split, .grid.two, .grid.three { grid-template-columns: minmax(0, 1fr); }
  .glow { right: -260px; width: 520px; height: 520px; }
  h1 { font-size: clamp(34px, 10.5vw, 48px); line-height: 1.05; }
  h2 { font-size: clamp(30px, 8.5vw, 40px); line-height: 1.08; }
  h3 { font-size: clamp(21px, 6vw, 27px); }
  .lead { font-size: 16px; line-height: 1.62; }
  .terminal-body { padding: 20px; font-size: 12px; line-height: 1.75; overflow-wrap: anywhere; }
  .terminal-bar strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .program-card { grid-template-rows: 190px 1fr; border-radius: 14px; }
  .card-body, .stat, .timeline-item { padding: 20px; }
  .stat strong { font-size: 34px; overflow-wrap: anywhere; }
  .pill { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
  .photo-grid { grid-template-columns: 1fr; }
  .photo-card.wide { grid-column: auto; }
  .photo-card, .photo-card.tall, .feature-photo { min-height: 320px; }
  .photo-caption { width: auto; max-width: calc(100% - 28px); white-space: normal; border-radius: 8px; line-height: 1.35; }
  .feature-panel-inner { padding: 24px; }
  .booking-panel { padding: 20px; }
  .header-actions .ghost { display: none; }
  .cta-row { flex-direction: column; align-items: stretch; }
  .cta-row .button, .cta-row .ghost { width: 100%; }
  .footer-grid { grid-template-columns: 1fr; padding: 48px 20px; }
  .calendar-frame iframe { height: 560px; }
  .footer-media { min-height: 260px; margin: 42px 20px 0; }
  .footer-media-copy { padding: 30px 24px; }
}
@media (max-width: 560px) {
  .announce { flex-direction: column; gap: 2px; font-size: 12px; }
  .header-inner { height: 58px; padding-inline: 14px; }
  .brand img { height: 36px; }
  .mobile-nav { padding-inline: 12px; }
  .mobile-nav a { font-size: 12px; padding: 7px 12px; }
  .header-actions .button.small { min-height: 36px; padding: 8px 12px; font-size: 13px; }
  .hero-grid, .section-inner { padding: 54px 18px; }
  .button, .ghost { width: 100%; min-height: 46px; padding: 12px 18px; }
  .header-actions .button, .header-actions .ghost { width: auto; }
  .terminal-card, .card, .program-card, .stat, .timeline-item, .feature-panel, .calendar-frame, .booking-panel { border-radius: 14px; }
  .program-card { grid-template-rows: 174px 1fr; }
  .photo-card, .photo-card.tall, .feature-photo { min-height: 260px; }
  .timeline-item { grid-template-columns: 1fr; gap: 10px; }
  .timeline-item:before { font-size: 14px; }
  .calendar-frame iframe { height: 500px; }
  .footer-media { min-height: 240px; margin-inline: 18px; border-radius: 14px; }
  .footer-media-copy { padding: 26px 20px; }
  .feature-panel-inner { padding: 20px; }
  .footer-grid { padding: 42px 18px; }
}
@media (max-width: 380px) {
  .hero-grid, .section-inner { padding-inline: 16px; }
  .photo-card, .photo-card.tall, .feature-photo { min-height: 230px; }
  .calendar-frame iframe { height: 455px; }
  .mobile-nav a { font-size: 11px; padding-inline: 10px; }
}
</style>`;
}

function programCards(items = programs) {
  return `<div class="grid three">${items
    .map(
      (p) => `<a class="program-card" href="${p.href}">
  <img src="${p.image}" alt="${p.title} workshop at Code Orange" loading="lazy">
  <div class="card-body">
    <span class="pill orange">${p.audience}</span>
    <h3 style="margin-top:16px">${p.title}</h3>
    <p>${p.blurb}</p>
    <div class="meta"><span class="pill">${p.duration}</span><span class="pill">${p.level}</span></div>
  </div>
</a>`
    )
    .join("")}</div>`;
}

function stats(items) {
  return `<div class="grid three">${items
    .map((s) => `<div class="stat"><strong>${s[0]}</strong><span class="pill">${s[1]}</span><p>${s[2]}</p></div>`)
    .join("")}</div>`;
}

function list(items) {
  return `<div class="grid two">${items
    .map((item) => `<div class="card"><div class="card-body"><h3>${item[0]}</h3><p>${item[1]}</p></div></div>`)
    .join("")}</div>`;
}

function photoCard(photo, klass = "") {
  const [src, alt, caption] = photo;
  return `<div class="photo-card ${klass}">
  <img src="${src}" alt="${alt}" loading="lazy">
  <span class="photo-caption">${caption}</span>
</div>`;
}

function featurePhoto(photo) {
  const [src, alt, caption] = photo;
  return `<div class="feature-photo">
  <img src="${src}" alt="${alt}" loading="lazy">
  <span class="photo-caption">${caption}</span>
</div>`;
}

function photoGrid(items) {
  return `<div class="photo-grid">${items.map(([photo, klass]) => photoCard(photo, klass)).join("")}</div>`;
}

function repoCards(items) {
  return `<div class="grid three">${items
    .map(
      ([name, label, desc, href]) => `<a class="card repo-card" href="${href}" target="_blank" rel="noopener">
  <div class="card-body">
    <span class="pill orange">${label}</span>
    <h3>${name}</h3>
    <p>${desc}</p>
    <span class="pill">Open on GitHub</span>
  </div>
</a>`
    )
    .join("")}</div>`;
}

function timeline(items) {
  return `<div class="timeline">${items
    .map((item) => `<div class="timeline-item"><div><h3>${item[0]}</h3><p>${item[1]}</p></div></div>`)
    .join("")}</div>`;
}

function finalCta() {
  return `<section class="section-inner final-cta">
  <p class="eyebrow">Bitcoin Only</p>
  <h2>Ready to become a Bitcoin builder?</h2>
  <p class="lead" style="margin-left:auto;margin-right:auto">Join the next cohort, drop into a workshop, or come say hello in Discord. The community is free and open.</p>
  <div class="cta-row" style="justify-content:center"><a class="button" href="${links.discord}" target="_blank" rel="noopener">Join Discord</a><a class="ghost" href="/apply">Apply Now</a></div>
</section>`;
}

function footer() {
  return `<footer class="footer">
  <div class="footer-media">
    <video data-lazy-video data-src="/assets/co-footer.mp4" poster="/assets/co-footer-poster.jpg" autoplay muted loop playsinline preload="none"></video>
    <div class="footer-media-copy">
      <p class="eyebrow">Scenes from the school</p>
      <h2>Real workshops. Real devices. Real Bitcoin builders.</h2>
    </div>
  </div>
  <div class="footer-grid">
    <div>
      <img src="/assets/logo-white.png" alt="Code Orange Dev School" style="height:58px;width:auto;margin-bottom:18px">
      <p style="color:var(--dim);max-width:420px;line-height:1.7">Code Orange Dev School trains Bitcoin developers, node runners, and technical community leaders from Bali into the wider Asian Bitcoin ecosystem.</p>
      <p><a href="${links.email}">${links.emailAddress}</a></p>
      <div class="cta-row" style="gap:10px;justify-content:flex-start">
        <a class="ghost small" href="${links.x}" target="_blank" rel="noopener">X</a>
        <a class="ghost small" href="${links.instagram}" target="_blank" rel="noopener">Instagram</a>
        <a class="ghost small" href="${links.nostr}" target="_blank" rel="noopener">Nostr</a>
        <a class="ghost small" href="${links.discord}" target="_blank" rel="noopener">Discord</a>
      </div>
    </div>
    <div>
      <div class="link-list">
        <strong>School</strong>
        <a href="/about">About</a>
        <a href="/consulting">Consulting</a>
        <a href="/impact">Impact</a>
        <a href="/community">Community</a>
        <a href="/fellowships">Fellowships</a>
        <a href="/calendar">Calendar</a>
        <a href="/strategy">Strategy</a>
        <a href="${links.geyser}" target="_blank" rel="noopener">Support on Geyser</a>
      </div>
    </div>
  </div>
</footer>`;
}

function write(path, html) {
  const canonicalPath = path === "index.html" ? "/" : `/${path.replace(/\/index\.html$/, "").replace(/\.html$/, "")}`;
  const canonicalUrl = `https://codeorange.dev${canonicalPath}`;
  let output = html;
  if (!output.includes('rel="canonical"')) {
    output = output.replace(
      /(<meta name="description" content="[^"]*">\n)/,
      (match) => `${match}<link rel="canonical" href="${canonicalUrl}">\n`
    );
  }
  if (!output.includes('property="og:url"')) {
    output = output.replace(
      /(<meta property="og:site_name" content="Code Orange Dev School">\n)/,
      (match) => `${match}<meta property="og:url" content="${canonicalUrl}">\n`
    );
  }
  if (!output.includes('application/ld+json')) {
    const title = output.match(/<title>(.*?)<\/title>/)?.[1] || "Code Orange Dev School";
    const description = output.match(/<meta name="description" content="([^"]*)">/)?.[1] || "";
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      description,
      url: canonicalUrl,
      isPartOf: {
        "@type": "WebSite",
        name: "Code Orange Dev School",
        url: "https://codeorange.dev",
      },
      publisher: {
        "@type": "EducationalOrganization",
        name: "Code Orange Dev School",
        url: "https://codeorange.dev",
        email: "hello@codeorange.dev",
        sameAs: [links.github, links.x, links.instagram, links.nostr],
      },
    };
    output = output.replace(
      /(<link rel="icon" type="image\/svg\+xml" href="\/assets\/favicon-bitcoin\.svg">\n)/,
      (match) => `${match}<script type="application/ld+json">${JSON.stringify(structuredData)}</script>\n`
    );
  }
  const url = new URL(path, root);
  mkdirSync(new URL("./", url), { recursive: true });
  writeFileSync(url, output);
  if (path.endsWith(".html")) writtenPages.add(canonicalPath);
}

function mirrorCleanUrl(path) {
  const html = readFileSync(new URL(`${path}.html`, root), "utf8");
  write(`${path}/index.html`, html);
}

write(
  "programs.html",
  pageShell({
    title: "Programs",
    description: "All Code Orange Dev School programs, cohorts, workshops, meetups, and accountability sessions.",
    eyebrow: "/Programs_",
    heading: 'Pick your path into <span class="orange">Bitcoin.</span>',
    intro:
      "From zero to sovereign. From curious to contributor. Every program is hands-on, practical, and Bitcoin-only.",
    body: `<section class="section-inner">
  <div class="split"><div><p class="eyebrow">All Programs</p><h2>Developer cohorts, sovereignty workshops, and community sessions.</h2></div><p class="lead">Use this page as the front desk for the school: choose a technical cohort if you write code, a sovereignty workshop if you want practical self-custody, or a recurring meetup if you want a gentle first step.</p></div>
  ${programCards()}
  ${photoGrid([[workshopPhotos.nodesMiners, "wide"], [workshopPhotos.tableBuilders, ""], [workshopPhotos.handsOnDevices, ""], [workshopPhotos.coldcardTable, "wide"]])}
  <div class="cta-row" style="margin-top:34px"><a class="ghost" href="${links.curriculum}" target="_blank" rel="noopener">Browse Curriculum on GitHub</a><a class="ghost" href="${links.workshops}" target="_blank" rel="noopener">Open Workshop Assets</a></div>
</section>`,
  })
);

write(
  "about.html",
  pageShell({
    title: "About",
    description: "The story, values, and operating model behind Code Orange Dev School in Canggu, Bali.",
    eyebrow: "/Our_Story_",
    heading: 'Built in Bali, for <span class="orange">Asia\'s Bitcoiners.</span>',
    intro:
      "Code Orange started with a simple observation: Bitcoin adoption in Southeast Asia was growing fast, but technical expertise was not keeping up.",
    body: `<section class="section-inner">
  <div class="split"><div><p class="eyebrow">Our Values</p><h2>What we believe.</h2></div><p class="lead">Bitcoin only. Hands-on first. Open source by default. Sovereignty over convenience. Community before credentials.</p></div>
  ${list([
    ["Bitcoin Only", "We teach Bitcoin, not crypto, blockchain, or web3. The signal, not the noise."],
    ["Hands-On First", "Every session ends with something built, deployed, configured, reviewed, or running."],
    ["Open Source", "Graduates contribute in public, learn from maintainers, and build reputations through proof of work."],
    ["Built for Asia", "Bali is home base, but the school reaches communities across Indonesia, Malaysia, Thailand, Vietnam, the Philippines, and beyond."],
  ])}
</section>
<section class="band"><div class="section-inner split">
  <div><p class="eyebrow">Home Base</p><h2>Code Orange Dev School, Canggu.</h2><p class="lead">The space is equipped for practical Bitcoin education: hardware wallets, ASIC miners, Raspberry Pi nodes, signing devices, and enough tables for people to break things productively.</p></div>
  ${featurePhoto(workshopPhotos.tableBuilders)}
</div></section>`,
  })
);

write(
  "community.html",
  pageShell({
    title: "Community",
    description: "The Code Orange developer community, regional network, and public open source contribution culture.",
    eyebrow: "/Community_",
    heading: 'We build the community. <span class="orange">They build Bitcoin.</span>',
    intro:
      "Code Orange supports a global network of Bitcoin developers with mentorship, structured cohorts, accountability, and a peer community.",
    body: `<section class="section-inner">
  <div class="split"><div><p class="eyebrow">Active Developers</p><h2>Public work, real repositories.</h2></div><p class="lead">The community is measured by open contribution, not certificates. Students are pointed toward maintainers, issues, reviews, and long-term contribution paths.</p></div>
  <div class="grid three">${activeDevs
    .map(([name, project, desc]) => `<div class="card"><div class="card-body"><span class="pill orange">${project}</span><h3 style="margin-top:16px">${name}</h3><p>${desc}</p></div></div>`)
    .join("")}</div>
  <div class="cta-row" style="margin-top:34px"><a class="button" href="${links.devCommunity}" target="_blank" rel="noopener">View Developer Profiles</a><a class="ghost" href="${links.github}" target="_blank" rel="noopener">Open GitHub Org</a></div>
  ${photoGrid([[workshopPhotos.hardwareBuilders, "wide tall"], [workshopPhotos.handsOnDevices, "tall"]])}
</section>
<section class="band"><div class="section-inner">
  <div class="split"><div><p class="eyebrow">Regional Reach</p><h2>Southeast Asia is our backyard.</h2></div><p class="lead">Based in Bali and active across the region, Code Orange partners with community hubs and teaches in English, Bahasa, Malay, Thai, Vietnamese, and Mandarin.</p></div>
  ${stats([["Indonesia", "Bali, Jakarta", "The home base and workshop laboratory."],["Malaysia", "Kuala Lumpur", "Regional community connections."],["Thailand", "Bangkok, Chiang Mai", "Growing technical education loops."],["Vietnam", "Ho Chi Minh City", "Emerging builder community."],["Philippines", "Growing", "More sessions and partners ahead."],["Online", "Discord global", "The persistent place where cohorts keep moving."]])}
</div></section>`,
  })
);

write(
  "impact.html",
  pageShell({
    title: "Impact",
    description: "Code Orange Dev School outcomes, Bitcoin Dojo proof, open source goals, and public impact metrics.",
    eyebrow: "/Impact_",
    heading: 'Specific goals. <span class="orange">Real deadlines.</span>',
    intro:
      "Code Orange measures success in nodes deployed, pull requests merged, and community leaders empowered, not vague completion numbers.",
    body: `<section class="section-inner">
  ${stats([["50+", "Graduates", "People trained through cohorts and technical workshops."],["21", "Dojo graduates", "Finished the Chaincode Labs BOSS Challenge aligned Bitcoin Dojo cohort."],["13", "Active devs", "Community members with live or recently reviewed OSS work."],["8+", "Countries", "Learners and contributors across Asia and beyond."],[githubSnapshot.repoCount, "Public repos", "GitHub repositories across curriculum, impact, workshops, tools, and protocol practice."],[githubSnapshot.sourceRepos, "Source repos", "Original Code Orange public repositories, with 5 forks used for protocol practice."]])}
  ${photoGrid([[workshopPhotos.nodesMiners, "wide tall"], [workshopPhotos.minerClose, "tall"]])}
</section>
<section class="band"><div class="section-inner split">
  <div><p class="eyebrow">Proof it works</p><h2>Bitcoin Dojo Cohort: 21 graduates.</h2><p class="lead">In partnership with Chaincode Labs BOSS Challenge, Code Orange ran an 8-week protocol deep-dive. 49 enrolled. 21 finished with a clear plan to contribute to Bitcoin open source.</p></div>
  ${timeline([["Weeks 1-2", "Finite fields, elliptic curves, and secp256k1."],["Week 3", "ECDSA signing, verification, and the discrete log problem."],["Week 5", "Transactions, UTXO set, sighash flags, and timelocks."],["Week 7", "P2P networking, mempool propagation, and compact blocks."],["Week 8", "Mining, difficulty adjustment, Stratum V2, and Taproot."]])}
</div></section>
<section class="section-inner">
  <div class="split"><div><p class="eyebrow">Public Proof on GitHub</p><h2>Proof of work. All inspectable.</h2></div><p class="lead">The Code Orange GitHub account lists ${githubSnapshot.repoCount} public repositories: ${githubSnapshot.sourceRepos} source repos and ${githubSnapshot.forks} forks across contribution tracking, curriculum, impact reporting, community profiles, fellowship material, workshop assets, and Bitcoin project practice. This is the public layer behind the school.</p></div>
  ${repoCards(githubProofRepos)}
  <div class="cta-row" style="margin-top:28px"><a class="button" href="${links.github}" target="_blank" rel="noopener">View GitHub Org</a><a class="ghost" href="${links.prTracker}" target="_blank" rel="noopener">Open PR Tracker</a></div>
</section>
<section class="band"><div class="section-inner">
  <div class="split"><div><p class="eyebrow">Contribution Surfaces</p><h2>Where students learn to work in public.</h2></div><p class="lead">Code Orange keeps practical tools and learning materials public, while pointing advanced students toward Bitcoin and Lightning codebases where real review happens.</p></div>
  <div class="grid two">
    <div class="card"><div class="card-body"><span class="pill orange">Education toolkit</span><h3>Reusable community assets.</h3><p>Workshop slides, local community projects, backup worksheets, and small learning apps help community leaders teach from the same public base.</p><div class="meta">${githubToolkitRepos.map(([name, label, desc, href]) => `<a class="pill" href="${href}" target="_blank" rel="noopener">${name}</a>`).join("")}</div></div></div>
    <div class="card"><div class="card-body"><span class="pill orange">Protocol practice</span><h3>Real Bitcoin repositories.</h3><p>Advanced contributors learn against forks of Bitcoin and Lightning projects before moving work upstream or into ecosystem repositories.</p><div class="meta">${githubProtocolRepos.map(([name, desc, href]) => `<a class="pill" href="${href}" target="_blank" rel="noopener">${name}</a>`).join("")}</div></div></div>
  </div>
</div></section>`,
  })
);

write(
  "strategy.html",
  pageShell({
    title: "Strategy",
    description:
      "The Code Orange operating strategy: community entry, Bitcoin technical training, public GitHub contribution, and sustainable fellowships.",
    eyebrow: "/Strategy_",
    heading: 'The Code Orange <span class="orange">builder flywheel.</span>',
    intro:
      "A practical strategy for turning free community sessions into cohorts, cohorts into public GitHub work, public work into credibility, and credibility into fellowships and regional workshop hosts.",
    heroPrimary: { label: "Apply to a Program", href: "/apply" },
    heroSecondary: { label: "Open GitHub", href: links.github, external: true },
    terminalUser: "strategy@codeorange",
    terminalLines: [
      ["$ cat north-star.txt", ""],
      ["Asia's most credible Bitcoin technical education pipeline", "orange"],
      ["$ inspect github", ""],
      [`${githubSnapshot.repoCount} public repos / ${githubSnapshot.sourceRepos} source / ${githubSnapshot.forks} forks`, "muted"],
      ["$ next action", ""],
      ["turn students into public contributors", "muted"],
    ],
    body: `<section class="section-inner">
  <div class="split"><div><p class="eyebrow">Positioning</p><h2>Not a coding bootcamp. Not a crypto community.</h2></div><p class="lead">Code Orange is a Bitcoin-only technical school that connects sovereignty education, developer training, public contribution, fellowships, and local workshop hosting into one system.</p></div>
  ${stats([["Community", "Entry layer", "Discord sessions, meetups, reading groups, and beginner workshops bring people into the school."],["Training", "Skill layer", "rawBit, Bitcoin Privacy Track, OpenClaw, and Sovereign Bitcoiner turn curiosity into capability."],["GitHub", "Proof layer", `${githubSnapshot.repoCount} public repos make curriculum, impact, profiles, and contribution paths inspectable.`],["Fellowships", "Funding layer", "Developers and educators can be sponsored to contribute, teach, and mentor."],["Consulting", "Revenue layer", "$100 sessions convert practical Bitcoin expertise into sustainable support."],["Hosts", "Regional layer", "Community leaders reuse the curriculum to run workshops in their own cities."]])}
</section>
<section class="band"><div class="section-inner">
  <div class="split"><div><p class="eyebrow">The Flywheel</p><h2>How the system compounds.</h2></div><p class="lead">Every part of the school should feed another part. The goal is not isolated events. The goal is a repeatable path from first workshop to public proof of work.</p></div>
  ${timeline([
    ["Community entry", "People discover Code Orange through Discord, the calendar, social posts, local meetups, and free beginner sessions."],
    ["Structured training", "Learners choose the right path: beginner Bitcoin, sovereignty, rawBit, privacy, OpenClaw, or reading club."],
    ["Public contribution", "Graduates move into GitHub issues, PR tracking, developer profiles, and contribution review."],
    ["Credibility", "Visible output helps funders, maintainers, hosts, and partners understand why the school matters."],
    ["Sustainability", "Fellowships, grants, donations, and consulting fund more mentors and more workshops."],
    ["Regional replication", "Workshop hosts reuse open curriculum and bring Bitcoin technical education into more Asian cities."],
  ])}
</div></section>
<section class="section-inner">
  <div class="split"><div><p class="eyebrow">GitHub Operating Layer</p><h2>Make public work easier to inspect.</h2></div><p class="lead">GitHub is not only a place to store code. For Code Orange it is the credibility layer for funders, developers, students, and workshop hosts.</p></div>
  ${repoCards(githubProofRepos)}
  <div class="grid two" style="margin-top:22px">
    <div class="card"><div class="card-body"><span class="pill orange">Repo hygiene</span><h3>What to improve next.</h3><p>Add descriptions to repos without them, pin the six strategic repos, keep READMEs current, and add student-ready labels.</p><div class="meta"><span class="pill">good-first-issue</span><span class="pill">student-ready</span><span class="pill">workshop-asset</span><span class="pill">curriculum</span></div></div></div>
    <div class="card"><div class="card-body"><span class="pill orange">Current snapshot</span><h3>${githubSnapshot.repoCount} public repositories.</h3><p>Current public repository mix: ${githubSnapshot.sourceRepos} source repos, ${githubSnapshot.forks} forks, and languages including ${githubSnapshot.languages}. Snapshot checked ${githubSnapshot.lastChecked}.</p><a class="pill" href="${links.github}" target="_blank" rel="noopener">Open GitHub account</a></div></div>
  </div>
</section>
<section class="band"><div class="section-inner">
  <div class="split"><div><p class="eyebrow">90-Day Plan</p><h2>What to ship next.</h2></div><p class="lead">The practical path from a strong website into a stronger public institution.</p></div>
  ${timeline([
    ["Days 1-30", "Publish strategy, make Impact and GitHub proof explicit, tighten CTAs, and keep the monthly social calendar workflow alive."],
    ["Days 31-60", "Add a contribution dashboard page, program-fit guidance, host-a-workshop intake, sponsor tiers, and stronger repo READMEs."],
    ["Days 61-90", "Publish monthly impact notes, add a graduate map, expose contribution logs, and turn workshop assets into a public library."],
  ])}
  <div class="cta-row" style="margin-top:30px"><a class="button" href="${links.strategyReport}">Read full strategy report</a><a class="ghost" href="/impact">View impact proof</a></div>
</div></section>
<section class="section-inner">
  <div class="split"><div><p class="eyebrow">Weekly Metrics</p><h2>Measure the flywheel.</h2></div><p class="lead">Track the signals that prove Code Orange is moving people from attendance into contribution.</p></div>
  ${list([
    ["Community growth", "New Discord members, event attendance, repeat participation, and host interest."],
    ["Applications", "Program applications, fellowship proposals, and program-fit conversations."],
    ["Contribution", "PRs opened, reviewed, merged, and tracked in public GitHub surfaces."],
    ["Sustainability", "Consulting bookings, grant leads, donations, and sponsor conversations."],
  ])}
</section>`,
  })
);

write(
  "fellowships.html",
  pageShell({
    title: "Fellowships",
    description: "Code Orange fellowships for Bitcoin open source developers and technical educators.",
    eyebrow: "/Fellowships_",
    heading: 'Get paid to build <span class="orange">Bitcoin open source.</span>',
    intro:
      "Fellowships fund developers and educators to contribute to Bitcoin open source software and technical education for six months.",
    body: `<section class="section-inner">
  <div class="grid two">
    <div class="card"><div class="card-body"><span class="pill orange">Developer Track</span><h2>$500/month</h2><p>6 months, extendable. 15-20 hours per week contributing to Bitcoin open source with mentor review on every PR.</p><a class="button" href="/apply?program=fellowship-developer">Apply by Email</a></div></div>
    <div class="card"><div class="card-body"><span class="pill orange">Educator Track</span><h2>$250/month</h2><p>6 months, extendable. 10-15 hours per week creating educational material, running workshops, and growing local builder communities.</p><a class="button" href="/apply?program=fellowship-educator">Apply by Email</a></div></div>
  </div>
  ${photoGrid([[workshopPhotos.hardwareBuilders, "wide tall"], [workshopPhotos.tableBuilders, "tall"]])}
</section>
<section class="band"><div class="section-inner">
  <div class="split"><div><p class="eyebrow">The Process</p><h2>How it works.</h2></div><p class="lead">No portals. Send a focused proposal with your GitHub, project target, background, and what you plan to build or teach. Applications go to ${links.emailAddress}.</p></div>
  ${timeline([["Apply", `Send a proposal to ${links.emailAddress} with your project, background, and plan.`],["Get accepted", "Selection is based on technical ability, project fit, and commitment to Bitcoin open source."],["Onboard", "Month 1 is environment setup, mentor matching, codebase orientation, and first small PR."],["Build", "Months 2-5 are focused contribution, weekly check-ins, and open status updates."],["Graduate", "Month 6 ends with review, demo, and paths into grants, roles, or extended contribution."]])}
</div></section>
<section class="section-inner">${stats([["$3,000", "Developer fellow", "Six months total to sponsor one developer fellow."],["$1,500", "Educator fellow", "Six months total to sponsor one educator fellow."],["6+ PRs", "Minimum output", "Expected open source output per developer fellow."]])}</section>`,
  })
);

write(
  "consulting.html",
  pageShell({
    title: "Code Orange Consulting",
    description:
      "Bitcoin consulting for self-custody, hardware wallets, inheritance, node running, mining, privacy, and team education at $100 per session.",
    eyebrow: "/Consulting_",
    heading: 'Code Orange<br><span class="orange">Consulting.</span>',
    intro:
      "Private Bitcoin consulting for people and teams who want to hold keys correctly, run their own infrastructure, and make calmer security decisions.",
    cta: false,
    heroPrimary: { label: "Book $100 Session", href: links.consultingBooking },
    heroSecondary: { label: "Email First", href: links.email },
    terminalUser: "consulting@codeorange",
    terminalLines: [
      ["$ book --service bitcoin-consulting", ""],
      ["session.price = $100", "orange"],
      ["topics = custody, nodes, privacy, mining", "muted"],
      ["$ outcome", ""],
      ["clear setup, fewer assumptions, stronger keys", "muted"],
    ],
    body: `<section class="section-inner">
  <div class="split">
    <div>
      <p class="eyebrow">Bitcoin consulting</p>
      <h2>$100/session. Practical, private, hands-on.</h2>
      <p class="lead">Bring your real questions. We help you design a sane Bitcoin setup, understand the tradeoffs, and leave with a clear next action instead of a pile of tabs and anxiety.</p>
      <div class="cta-row"><a class="button" href="${links.consultingBooking}">Book a consultation</a><a class="ghost" href="${links.email}">Email first</a></div>
    </div>
    <div class="feature-panel">
      <div class="feature-panel-inner">
        <span class="price-tag">$100 per session</span>
        <h3 style="margin-top:18px">For people who want Bitcoin security to feel understandable.</h3>
        <p style="color:var(--muted);line-height:1.7">A consultation can be a one-time setup review, a family custody plan, a founder education session, or a practical walk-through of nodes, wallets, and privacy habits.</p>
        <div class="booking-panel">
          <strong>Best fit</strong>
          <p style="margin:0;color:var(--muted);line-height:1.65">Individuals, families, founders, Bitcoin houses, educators, and small teams who want direct guidance without handing control of keys to anyone else.</p>
        </div>
      </div>
    </div>
  </div>
</section>
<section class="band"><div class="section-inner">
  <div class="split" style="margin-bottom:42px"><div><p class="eyebrow">Hands-on context</p><h2>Consulting starts with real devices and real questions.</h2><p class="lead">The same hardware-first teaching style from Code Orange workshops carries into private consulting: wallets, nodes, miners, backups, and the operational details that matter when the keys are yours.</p></div>${featurePhoto(workshopPhotos.coldcardTable)}</div>
  <div class="split"><div><p class="eyebrow">What we help with</p><h2>True Bitcoin ownership, taught calmly.</h2></div><p class="lead">Inspired by the best Bitcoin mentorship services: patient guidance, privacy-respecting support, and no pressure to buy products you do not need.</p></div>
  ${list([
    ["Self-custody setup", "Hardware wallets, mobile wallets, seed backups, passphrases, wallet recovery, and everyday spending workflows."],
    ["Multisig and inheritance", "Collaborative custody options, family backup plans, estate handoff, and practical failure-mode planning."],
    ["Node running", "Full node setup, wallet connection, privacy tradeoffs, maintenance, and what a node does and does not protect."],
    ["Privacy review", "Coin control basics, address reuse, Payjoin, Fedimint, Lightning tradeoffs, and safer operational habits."],
    ["Mining and hardware", "ASIC basics, home mining, heat/noise expectations, pool setup, and whether mining makes sense for you."],
    ["Team education", "Bitcoin onboarding sessions for founders, finance teams, community houses, and local Bitcoin groups."],
  ])}
</div></section>
<section class="section-inner">
  <div class="split"><div><p class="eyebrow">How a session works</p><h2>No jargon theater. Just your setup, made better.</h2></div><p class="lead">We begin with your goals and current setup, map the biggest risks, explain the tradeoffs, and end with a concrete checklist.</p></div>
  ${timeline([
    ["Book", "Choose a time, tell us what you want help with, and bring only the information you are comfortable sharing."],
    ["Diagnose", "We map your current wallet, backup, privacy, and operational assumptions."],
    ["Build", "We configure, test, or plan the setup together. You stay in control of your keys at all times."],
    ["Leave with a checklist", "You get the next steps, backup checks, and follow-up options if you want more help."],
  ])}
</section>
<section class="section-inner final-cta">
  <p class="eyebrow">Code Orange Consulting</p>
  <h2>Book Bitcoin consulting.</h2>
  <p class="lead" style="margin-left:auto;margin-right:auto">$100 per session for self-custody, multisig, inheritance, nodes, privacy, mining, and Bitcoin education.</p>
  <div class="cta-row" style="justify-content:center"><a class="button" href="${links.consultingBooking}">Book a consultation</a><a class="ghost" href="${links.email}">Ask by email</a></div>
</section>`,
  })
);

write(
  "calendar.html",
  pageShell({
    title: "Calendar",
    description: "Recurring Code Orange Dev School workshops, study calls, reading clubs, and community sessions.",
    eyebrow: "/Calendar_",
    heading: 'Always something <span class="orange">happening.</span>',
    intro:
      "The school runs on a monthly rhythm of cohorts, workshops, reading groups, accountability calls, and open community sessions.",
    heroPrimary: { label: "Open Calendar", href: links.publicCalendar },
    heroSecondary: { label: "Join Discord", href: links.discord, external: true },
    terminalUser: "calendar@codeorange",
    terminalLines: [
      ["$ next --month", ""],
      ["cohorts, workshops, reading groups", "muted"],
      ["$ timezone", ""],
      ["Asia/Makassar + online sessions", "orange"],
      ["$ reminder", ""],
      ["show up prepared. leave with proof of work.", "muted"],
    ],
    body: `<section class="section-inner">
  <div class="split"><div><p class="eyebrow">Student Calendar</p><h2>The live monthly rhythm.</h2></div><p class="lead">Use this calendar as the source of truth for cohorts, workshops, reading clubs, and community sessions. Save the page, check the month ahead, and plan your Bitcoin study time with intention.</p></div>
  <div class="calendar-frame" aria-label="Code Orange public student calendar">
    <div class="terminal-bar"><span></span><span></span><span></span><strong>codeorange.dev/calendar</strong></div>
    <iframe title="Code Orange public student calendar" src="${links.publicCalendar}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
  </div>
</section>
<section class="band"><div class="section-inner">
  <div class="split"><div><p class="eyebrow">Recurring Events</p><h2>Build your Bitcoin week.</h2></div><p class="lead">Most sessions happen in Discord so people across Asia can join, with in-person Bali sessions layered in when hands-on hardware matters.</p></div>
  ${timeline(programs.slice(2).map((p) => [p.title, `${p.schedule}. ${p.blurb}`]))}
</div></section>`,
  })
);

for (const p of programs.filter((item) => item.href.startsWith("/programs/"))) {
  write(
    `programs/${p.slug}.html`,
    pageShell({
      title: p.title,
      description: p.blurb,
      eyebrow: `/Programs/${p.slug}_`,
      heading: `${p.title}. <span class="orange">${p.type}.</span>`,
      intro: p.blurb,
      body: `<section class="section-inner split">
  <div class="card"><img src="${p.image}" alt="${p.title} workshop image" style="width:100%;height:300px;object-fit:cover"><div class="card-body"><h2>Program Details</h2>${stats([[p.duration, "Duration", p.schedule],[p.format, "Format", "How the session is delivered."],[p.level, "Level", p.audience]])}</div></div>
  <div><p class="eyebrow">What you'll learn</p><h2>Practical skills, not passive content.</h2>${list(p.lessons.map((lesson) => [lesson, `You will leave with a working understanding of ${lesson.toLowerCase()} and how it fits into the Bitcoin ecosystem.`]))}</div>
</section>
<section class="band"><div class="section-inner"><div class="split"><div><p class="eyebrow">Next Step</p><h2>Ready to join ${p.title}?</h2></div><p class="lead">Apply now or jump into Discord to ask questions first. We will help you find the right starting point.</p></div><div class="cta-row"><a class="button" href="/apply?program=${p.slug}">Join Workshop</a><a class="ghost" href="${links.discord}" target="_blank" rel="noopener">Ask in Discord</a></div></div></section>
<section class="section-inner"><div class="split"><div><p class="eyebrow">Other Programs</p><h2>Keep exploring.</h2></div><p class="lead">Code Orange is designed as a pipeline. Beginners can start with fundamentals, developers can move into cohorts, and graduates can keep shipping in public.</p></div>${programCards(programs.filter((item) => item.slug !== p.slug).slice(0, 3))}</section>`,
    })
  );
}

["programs", "about", "community", "impact", "strategy", "fellowships", "calendar", "consulting", "rawbit", "privacy-track", "apply"].forEach((path) => {
  try {
    mirrorCleanUrl(path);
  } catch {}
});

for (const p of programs.filter((item) => item.href.startsWith("/programs/"))) {
  mirrorCleanUrl(`programs/${p.slug}`);
}

const sitemapUrls = [
  "/",
  ...Array.from(writtenPages).filter((path) => path !== "/").sort(),
];

writeFileSync(
  new URL("robots.txt", root),
  `User-agent: *
Allow: /

Sitemap: https://codeorange.dev/sitemap.xml
`
);

writeFileSync(
  new URL("sitemap.xml", root),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map(
    (path) => `  <url>
    <loc>https://codeorange.dev${path}</loc>
    <changefreq>${path === "/" ? "weekly" : "monthly"}</changefreq>
    <priority>${path === "/" ? "1.0" : path.includes("/programs/") ? "0.7" : "0.8"}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`
);
