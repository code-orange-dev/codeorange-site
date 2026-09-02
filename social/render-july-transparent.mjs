import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const logoPath = path.join(root, "assets", "logo-white.png");
const logo = fs.readFileSync(logoPath).toString("base64");

const W = 1080;
const H = 1350;
const orange = "#F7931A";
const paper = "#F5F1EA";
const muted = "#C8CDD9";
const dim = "#8C94A6";
const navy = "#0B1220";
const card = "#070D18";
const mono = `JetBrains Mono, Courier New, monospace`;
const sans = `Space Grotesk, Inter, Arial, sans-serif`;
const slab = `Courier New, monospace`;
const statsY = 448;
const eventStartY = 554;

const events = [
  ["JUL 02", "THU", "Bitcoin Basics", "19:00-20:30 - Discord", "Beginner"],
  ["06/13/20/27", "MON", "rawBit Study Cohort", "19:00 - Learn Bitcoin transactions from scratch", "Cohort"],
  ["JUL 08", "WED", "Sovereign Bitcoiner Workshop", "19:00-20:00 - Self-custody, nodes, privacy", "Sovereignty"],
  ["JUL 15", "WED", "OpenClaw Workshop for Bitcoiners", "20:00 - Discord Bitcoiner Lounge", "AI Tools"],
  ["JUL 15", "WED", "Vibe Coding on Nostr", "20:00-21:30 - Build censorship-resistant apps", "Nostr"],
  ["JUL 22", "WED", "Bitcoin Reading Club", "20:00-21:30 - Read, discuss, ship better notes", "Reading"],
  ["JUL 26", "SUN", "Bitcoin Workshop", "17:00-18:00 - Bitcoin House Bali", "In person"],
  ["JUL 27", "MON", "Bitcoin Meetup Ubud", "18:00-19:00 - Pizza Napoli Style, Ubud", "In person"],
  ["JUL 28", "TUE", "OpenClaw + Vibe Coding Workshop", "17:00-18:00 - Bitcoin House Bali", "In person"],
];

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function roundedRect(x, y, width, height, radius, attrs = "") {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" ry="${radius}" ${attrs}/>`;
}

function stat(x, value, label) {
  return `
    ${roundedRect(x, statsY, 314, 82, 8, `fill="${card}" stroke="#F5F1EA"`)}
    <text x="${x + 16}" y="${statsY + 43}" fill="${orange}" font-family="${sans}" font-size="35" font-weight="800">${value}</text>
    <text x="${x + 16}" y="${statsY + 69}" fill="${dim}" font-family="${mono}" font-size="15" font-weight="700" letter-spacing="1.1">${esc(label)}</text>
  `;
}

function eventRow(event, index) {
  const [date, day, title, meta, tag] = event;
  const y = eventStartY + index * 70;
  const dateSize = date.length > 8 ? 18 : 23;
  return `
    ${roundedRect(54, y, 972, 64, 8, `fill="${card}" stroke="#F5F1EA"`)}
    <rect x="54" y="${y}" width="4" height="64" rx="2" fill="${orange}"/>
    ${roundedRect(69, y + 8, 118, 48, 7, `fill="${orange}"`)}
    <text x="128" y="${y + 29}" fill="${navy}" font-family="${mono}" font-size="${dateSize}" font-weight="900" text-anchor="middle">${esc(date)}</text>
    <text x="128" y="${y + 49}" fill="${navy}" font-family="${mono}" font-size="14" font-weight="900" letter-spacing="1.1" text-anchor="middle">${esc(day)}</text>
    <text x="207" y="${y + 30}" fill="${paper}" font-family="${sans}" font-size="23" font-weight="800">${esc(title)}</text>
    <text x="207" y="${y + 53}" fill="${dim}" font-family="${mono}" font-size="15">${esc(meta)}</text>
    ${roundedRect(884, y + 16, 126, 32, 16, `fill="#1B1208" stroke="${orange}"`)}
    <text x="947" y="${y + 37}" fill="${paper}" font-family="${mono}" font-size="13" text-anchor="middle">${esc(tag)}</text>
  `;
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <image href="data:image/png;base64,${logo}" x="54" y="48" width="205" height="93" preserveAspectRatio="xMidYMid meet"/>
  ${roundedRect(864, 48, 162, 52, 8, `fill="${orange}"`)}
  <text x="945" y="82" fill="${navy}" font-family="${mono}" font-size="22" font-weight="800" letter-spacing="1.3" text-anchor="middle">JULY 2026</text>

  <text x="54" y="187" fill="${orange}" font-family="${mono}" font-size="18" font-weight="700" letter-spacing="2.9">CODE ORANGE DEV SCHOOL</text>
  <text x="54" y="257" fill="${paper}" stroke="${card}" stroke-width="5" paint-order="stroke" font-family="${slab}" font-size="72" font-weight="900">Bitcoin events for</text>
  <text x="54" y="325" fill="${orange}" stroke="${card}" stroke-width="5" paint-order="stroke" font-family="${slab}" font-size="72" font-weight="900">builders.</text>

  <text x="54" y="370" fill="${muted}" stroke="${card}" stroke-width="4" paint-order="stroke" font-family="${sans}" font-size="25">
    <tspan x="54" dy="0">Save the dates for workshops, cohorts, meetups, reading clubs,</tspan>
    <tspan x="54" dy="32">and Bali sessions. All times are WITA (UTC+8).</tspan>
    <tspan x="54" dy="32" fill="${orange}" font-weight="800">Book your calendar at codeorange.dev/calendar.</tspan>
  </text>

  ${stat(54, "12", "Total sessions")}
  ${stat(383, "9", "Event types")}
  ${stat(712, "3", "Bali meetups")}

  ${events.map(eventRow).join("\n")}
</svg>`;

await sharp(Buffer.from(svg))
  .png()
  .toFile(path.join(import.meta.dirname, "code-orange-july-events-2026-transparent.png"));
