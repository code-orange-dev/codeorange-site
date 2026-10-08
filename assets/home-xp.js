// Homepage scroll experience: loader, cursor, section-by-section scrolling,
// the 3D voxel <₿> wordmark in the hero, and one 30,000-point particle cloud
// that morphs from a sphere (panel 2) to a laptop keyboard (panel 3) to the
// <₿> mark (panel 4). After panel 4 the page returns to normal scrolling.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

window.__xpBoot = true;
const html = document.documentElement;
const body = document.body;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(any-pointer: fine)").matches;
const isFilm = () => innerWidth >= 1100 && innerHeight >= 700;

const KEYBOARD_IMG = "/assets/uploaded-workshops/node-laptop-session.jpg";
const KEYBOARD_CROP = { x: 0.10, y: 0.655, w: 0.66, h: 0.165 }; // the laptop keyboard inside the photo
const ORANGE = new THREE.Color(0xF7931A);

/* ── Loader ─────────────────────────────────────────────────────────── */
const loader = $("#loader"), lf = $("#loader .lf"), lp = $("#loader .lp");
const got = new Set();
const ready = (k) => got.add(k);
let shown = 6, loaderDone = false;
setTimeout(() => ["bg", "glb", "keys", "font"].forEach(ready), 15000);
document.fonts.ready.then(() => ready("font"));
const poster = $("#heroPoster");
if (poster.complete) ready("bg"); else { poster.onload = poster.onerror = () => ready("bg"); }
function loaderTick() {
  if (loaderDone) return;
  const real = (got.size / 4) * 100;
  if (shown < real) shown = Math.min(real, shown + Math.max(0.5, (real - shown) * 0.10));
  const v = shown <= 6 && got.size === 0 ? 0 : shown;
  lf.style.width = v + "%";
  lp.style.left = v + "%";
  lp.textContent = Math.round(v) + "%";
  if (shown >= 100) {
    loaderDone = true;
    loader.classList.add("done");
    body.classList.remove("loading");
    layout();
    hero3d.fit();
    stage.resize();
    playHero();
    startHeroVideo();
    return;
  }
  requestAnimationFrame(loaderTick);
}
requestAnimationFrame(loaderTick);

function startHeroVideo() {
  const v = $("#heroVideo");
  if (!v || reduce || innerWidth < 760) return;
  v.src = v.dataset.src;
  v.addEventListener("playing", () => { poster.style.opacity = "0"; }, { once: true });
  v.play().catch(() => {});
}

/* ── Cursor ─────────────────────────────────────────────────────────── */
const cursor = $("#cursor"), cursorLabel = $("#cursorLabel");
const ptr = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0 };
const cur = { x: ptr.x, y: ptr.y };
addEventListener("pointermove", (e) => {
  ptr.x = e.clientX; ptr.y = e.clientY;
  ptr.nx = e.clientX / innerWidth - 0.5; ptr.ny = e.clientY / innerHeight - 0.5;
}, { passive: true });

/* ── Header: height, menu toggle ────────────────────────────────────── */
const header = $("#xpHeader"), navpill = $("#sitenav"), navtoggle = $(".navtoggle");
function setMenu(open) {
  navpill.classList.toggle("open", open);
  navtoggle.classList.toggle("open", open);
  navtoggle.setAttribute("aria-expanded", String(open));
  navtoggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}
navtoggle.addEventListener("click", () => setMenu(!navpill.classList.contains("open")));
addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
$$("a", navpill).forEach((a) => a.addEventListener("click", () => setMenu(false)));

/* ── Word split, dot-matrix type, reveals ───────────────────────────── */
$$(".rv").forEach((rv) => {
  const dot = rv.dataset.dot === "1";
  const words = rv.textContent.trim().split(/\s+/);
  rv.textContent = "";
  words.forEach((w, i) => {
    if (i) { const sp = document.createElement("span"); sp.innerHTML = "&nbsp;"; if (dot) sp.className = "dotfill"; rv.appendChild(sp); }
    const s = document.createElement("span"); s.textContent = w; if (dot) s.className = "dotfill"; rv.appendChild(s);
  });
  const base = +(rv.dataset.d || 0);
  [...rv.children].forEach((s, i) => { s.dataset.delay = base + i * 55; });
});
function regrid() {
  $$(".rv[data-dot='1']").forEach((rv) => {
    const host = rv.getBoundingClientRect();
    [...rv.children].forEach((s) => {
      const r = s.getBoundingClientRect();
      const ox = -(((r.left - host.left) % 6.5) + 6.5) % 6.5, oy = -(((r.top - host.top) % 6.5) + 6.5) % 6.5;
      s.style.backgroundPosition = `${ox}px ${oy}px`;
    });
  });
}
function play(section, heroFirst = false) {
  if (section.dataset.done) return;
  section.dataset.done = "1";
  const items = $$(".rv, .fade", section);
  items.forEach((el, i) => {
    setTimeout(() => {
      if (el.classList.contains("rv")) [...el.children].forEach((s) => { s.style.transitionDelay = s.dataset.delay + "ms"; });
      el.classList.add("in");
    }, heroFirst ? 140 + i * 110 : 40 + i * 90);
  });
}
function resetSection(section) {
  delete section.dataset.done;
  $$(".rv, .fade", section).forEach((el) => {
    el.classList.remove("in");
    if (el.classList.contains("rv")) [...el.children].forEach((s) => { s.style.transitionDelay = ""; });
  });
}
const playHero = () => play($("#hero"), true);

function fitHeadings() {
  const aside = $("#heroAside");
  $$("#xp h1, #xp h2").forEach((h) => {
    h.style.fontSize = "";
    const lines = $$(".rv", h);
    if (!lines.length) return;
    const abs = getComputedStyle(h).position === "absolute";
    let avail;
    if (h.tagName === "H1" && abs && getComputedStyle(aside).position === "absolute") {
      avail = aside.getBoundingClientRect().left - h.getBoundingClientRect().left - 28;
    } else if (h.closest("#s4") && getComputedStyle($("#s4 .s4aside")).position === "absolute" && $("#s4 .s4aside").getBoundingClientRect().left > h.getBoundingClientRect().left + 200) {
      avail = $("#s4 .s4aside").getBoundingClientRect().left - h.getBoundingClientRect().left - 32;
    } else {
      const pad = parseFloat(getComputedStyle(html).getPropertyValue("--pad")) || 22;
      avail = innerWidth - 2 * pad - (abs ? Math.max(0, h.offsetLeft - pad) : 0);
    }
    let size = parseFloat(getComputedStyle(h).fontSize);
    const widest = () => Math.max(...lines.map((l) => l.scrollWidth));
    let guard = 60;
    while (widest() > avail && size > 20 && guard--) { size = Math.max(20, size * 0.96); h.style.fontSize = size + "px"; }
  });
  regrid();
}
function layout() {
  html.style.setProperty("--header-h", header.offsetHeight + "px");
  fitHeadings();
}

/* ── Hero number field ──────────────────────────────────────────────── */
const nums = $("#heroNums"), nctx = nums.getContext("2d");
let nt = 0;
const hash = (c, r) => { const v = Math.sin(c * 127.1 + r * 311.7) * 43758.5453; return v - Math.floor(v); };
function drawNums() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = nums.clientWidth, h = nums.clientHeight;
  if (nums.width !== Math.round(w * dpr) || nums.height !== Math.round(h * dpr)) { nums.width = Math.round(w * dpr); nums.height = Math.round(h * dpr); }
  nctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  nctx.clearRect(0, 0, w, h);
  nctx.font = '500 20px "Schibsted Grotesk", Helvetica, sans-serif';
  nctx.textBaseline = "top";
  const cols = Math.ceil(w / 47) + 1, rows = Math.ceil((h * 0.66) / 33);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (hash(c, r) < 0.12) continue;
    const v = clamp(Math.round(50 + 49 * Math.sin(c * 0.19 + r * 0.075 + nt * 0.22) * Math.cos(r * 0.14 - nt * 0.09 + c * 0.03)), 0, 99);
    nctx.fillStyle = `rgba(255,255,255,${0.17 + 0.33 * hash(r, c)})`;
    nctx.fillText(String(v), c * 47 + 10, r * 33 + 7);
  }
}
drawNums();
setInterval(() => { if (state.index === 0) { nt += 0.08; drawNums(); } }, 110);

/* ── Voxel glyphs from canvas drawings ──────────────────────────────── */
// Each glyph is drawn into a 320px canvas, cropped to its opaque box and
// sampled onto a grid; a cell is "on" when at least half of it is covered.
function drawChevron(ctx, S) {
  ctx.beginPath();
  ctx.moveTo(S * 0.80, S * 0.06); ctx.lineTo(S * 0.20, S * 0.50); ctx.lineTo(S * 0.80, S * 0.94);
  ctx.lineWidth = S * 0.19; ctx.lineJoin = "miter"; ctx.lineCap = "butt"; ctx.strokeStyle = "#fff"; ctx.stroke();
}
function drawBitcoin(ctx, S) {
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${S * 0.86}px "Schibsted Grotesk", Helvetica, Arial, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("B", S * 0.5, S * 0.52);
  const m = ctx.measureText("B"), left = S * 0.5 - m.width / 2;
  const bw = S * 0.07; // the two strokes poking out of the top and bottom of the ₿
  const top = S * 0.52 - m.actualBoundingBoxAscent, bot = S * 0.52 + m.actualBoundingBoxDescent;
  [left + m.width * 0.20, left + m.width * 0.50].forEach((x) => { ctx.fillRect(x, top - S * 0.11, bw, S * 0.13); ctx.fillRect(x, bot - S * 0.02, bw, S * 0.13); });
}
function voxelGrid(draw, rows) {
  const S = 320, c = document.createElement("canvas"); c.width = c.height = S;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  draw(ctx, S);
  const d = ctx.getImageData(0, 0, S, S).data;
  let x0 = S, y0 = S, x1 = 0, y1 = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 128) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, cell = bh / rows, cols = Math.max(1, Math.round(bw / cell));
  const cw = bw / cols, grid = [];
  for (let r = 0; r < rows; r++) { const row = []; for (let q = 0; q < cols; q++) {
    let on = 0, tot = 0;
    for (let y = Math.floor(y0 + r * cell); y < Math.floor(y0 + (r + 1) * cell); y++) for (let x = Math.floor(x0 + q * cw); x < Math.floor(x0 + (q + 1) * cw); x++) { tot++; if (d[(y * S + x) * 4 + 3] > 128) on++; }
    row.push(tot && on / tot >= 0.5); } grid.push(row); }
  return { grid, rows, cols };
}
function voxelGeometry({ grid, rows, cols }) {
  const boxes = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!grid[r][c]) continue;
    const h = hash(c + 3, r + 7);
    const [depth, z] = h < 0.14 ? [1.15, 0.20] : h < 0.30 ? [0.60, -0.10] : [0.82, 0];
    const g = new THREE.BoxGeometry(0.97, 0.97, depth);
    g.translate(c + 0.5, rows - r - 0.5, z);
    boxes.push(g);
  }
  const geo = mergeGeometries(boxes);
  geo.computeBoundingBox();
  const ctr = new THREE.Vector3(); geo.boundingBox.getCenter(ctr); geo.translate(-ctr.x, -ctr.y, 0);
  geo.computeBoundingBox();
  return geo;
}
let glyphs = null;
function buildGlyphs() {
  const chev = voxelGrid(drawChevron, 12), btc = voxelGrid(drawBitcoin, 17);
  glyphs = { chev: voxelGeometry(chev), btc: voxelGeometry(btc), rows: Math.max(chev.rows, btc.rows) };
}
function wordmark(matChev, matBtc) {
  const g = new THREE.Group();
  const w = (geo) => geo.boundingBox.max.x - geo.boundingBox.min.x;
  const GAP = 1, wc = w(glyphs.chev), wb = w(glyphs.btc);
  const total = wc + GAP + wb + GAP + wc;
  const l = new THREE.Mesh(glyphs.chev, matChev); l.position.x = -total / 2 + wc / 2;
  const b = new THREE.Mesh(glyphs.btc, matBtc); b.position.x = -total / 2 + wc + GAP + wb / 2;
  const r = new THREE.Mesh(glyphs.chev, matChev); r.scale.x = -1; r.position.x = total / 2 - wc / 2;
  g.add(l, b, r);
  g.scale.setScalar(1 / glyphs.rows);
  return g;
}

/* ── Hero 3D wordmark ───────────────────────────────────────────────── */
const hero3d = (() => {
  const canvas = $("#heroGL");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 6000); camera.position.z = 600;

  // Studio environment: warm sky, dark ground, one bright key light.
  const ec = document.createElement("canvas"); ec.width = 1024; ec.height = 512;
  const x = ec.getContext("2d");
  let g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "#fbf3ea"); g.addColorStop(0.55, "#dcc3a8"); g.addColorStop(1, "#8a6a4f");
  x.fillStyle = g; x.fillRect(0, 0, 1024, 256);
  g = x.createLinearGradient(0, 254, 0, 512); g.addColorStop(0, "#f6efe6"); g.addColorStop(0.07, "#a8836c"); g.addColorStop(0.26, "#5a3b2e"); g.addColorStop(1, "#241812");
  x.fillStyle = g; x.fillRect(0, 254, 1024, 258);
  g = x.createRadialGradient(300, 84, 0, 300, 84, 210); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
  const etex = new THREE.CanvasTexture(ec); etex.mapping = THREE.EquirectangularReflectionMapping; etex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(etex).texture;
  scene.add(new THREE.HemisphereLight(0xe6f1fa, 0x4a352c, 0.22));
  const d1 = new THREE.DirectionalLight(0xffffff, 0.60); d1.position.set(-3, 2.4, 3.4); scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffe6c9, 0.22); d2.position.set(2.7, -1.5, 1.5); scene.add(d2);

  const matChev = new THREE.MeshPhysicalMaterial({ color: 0xeef3f8, metalness: 0.88, roughness: 0.09, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 1, iridescenceIOR: 1.32, iridescenceThicknessRange: [130, 540], envMapIntensity: 1.45, reflectivity: 0.94 });
  const matBtc = new THREE.MeshPhysicalMaterial({ color: 0xF7931A, metalness: 0.9, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.09, iridescence: 0.35, iridescenceIOR: 1.28, iridescenceThicknessRange: [160, 470], envMapIntensity: 1.15, reflectivity: 0.86 });

  const root = new THREE.Group(), bobber = new THREE.Group(), spinner = new THREE.Group();
  root.add(bobber); bobber.add(spinner); scene.add(root);
  let mark = null, span = new THREE.Vector3(1, 1, 1), worldPerPx = 1;

  const s = { rotY: 0.22, rotX: -0.07, tY: 0.22, tX: -0.07, bias: 0, vY: 0, drag: false, lx: 0, ly: 0 };
  canvas.addEventListener("pointerdown", (e) => { s.drag = true; s.lx = e.clientX; s.ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    if (!s.drag) return;
    const dx = e.clientX - s.lx, dy = e.clientY - s.ly; s.lx = e.clientX; s.ly = e.clientY;
    s.bias += dx * 0.0092; s.tX = clamp(s.tX + dy * 0.0062, -0.62, 0.62); s.vY = dx * 0.0007;
  });
  const up = () => { s.drag = false; };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("pointerenter", () => { s.over = true; }); canvas.addEventListener("pointerleave", () => { s.over = false; });

  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (!mark) { camera.updateProjectionMatrix(); return; }
    let frac = 0.535, rise = 84;
    const tanH = Math.tan(THREE.MathUtils.degToRad(16));
    const hdr = header.offsetHeight + 8;
    const textTop = Math.min(...$$("#heroCopy h1, #heroAside").map((el) => el.getBoundingClientRect().top)) - 46;
    let centerY = null;
    if (w < 1100 || h < 700) {
      const band = Math.max(40, textTop - hdr);
      const flatH = band * 0.52;
      frac = clamp((flatH * (span.x / span.y)) / w, 0.16, 0.535);
      centerY = hdr + band * 0.32;
      if (h < 560) { const room = Math.max(30, textTop - hdr); frac = Math.min(frac, (room * (span.x / span.y)) / w); centerY = hdr + room / 2; }
    }
    worldPerPx = span.x / (frac * w);
    camera.position.z = (h * worldPerPx / 2) / tanH;
    root.position.y = centerY === null ? rise * worldPerPx : (h / 2 - centerY) * worldPerPx;
    camera.updateProjectionMatrix();
  }
  function setGlyphs() {
    mark = wordmark(matChev, matBtc);
    spinner.add(mark);
    const box = new THREE.Box3().setFromObject(mark); box.getSize(span);
    fit();
  }
  function frame(t) {
    if (!mark) return;
    const ampl = innerHeight < 560 ? 0.30 * 0.35 : 0.30;
    if (!s.drag) {
      s.vY *= 0.955; s.bias *= 0.992; s.bias += s.vY;
      s.tX = lerp(s.tX, -0.06 + ptr.ny * 0.10, 0.04);
    }
    s.tY = 0.22 + Math.sin((t / 13) * Math.PI * 2) * ampl + s.bias;
    s.rotY = lerp(s.rotY, s.tY, 0.085); s.rotX = lerp(s.rotX, s.tX, 0.085);
    spinner.rotation.set(s.rotX, s.rotY, 0);
    bobber.position.y = Math.sin(t * 0.62) * 7 * worldPerPx;
    bobber.rotation.z = Math.sin(t * 0.43) * 0.012;
    bobber.rotation.y = ptr.nx * 0.09;
    renderer.render(scene, camera);
  }
  return { fit, frame, setGlyphs, state: s, canvas };
})();

/* ── Particle stage ─────────────────────────────────────────────────── */
const stage = (() => {
  const el = $("#stage");
  const renderer = new THREE.WebGLRenderer({ canvas: el, alpha: true, antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 8000);
  const PN = 30000;
  const pA = new Float32Array(PN * 3), pB = new Float32Array(PN * 3), pC = new Float32Array(PN * 3);
  const sd = new Float32Array(PN), sc = new Float32Array(PN), al = new Float32Array(PN);
  const R = 302, golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < PN; i++) {
    sd[i] = Math.random(); sc[i] = 0.50 + Math.random() * 0.85; const u = Math.random(); al[i] = 0.22 + 0.78 * u * u;
    const y = 1 - (i / (PN - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), th = golden * i, j = 1 + (Math.random() - 0.5) * 0.06;
    pA[i * 3] = Math.cos(th) * r * R * j; pA[i * 3 + 1] = y * R * j; pA[i * 3 + 2] = Math.sin(th) * r * R * j;
  }
  const pA0 = pA.slice();
  pB.set(pA0); pC.set(pA0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pA.slice(), 3));
  geo.setAttribute("pA", new THREE.BufferAttribute(pA, 3));
  geo.setAttribute("pB", new THREE.BufferAttribute(pB, 3));
  geo.setAttribute("pC", new THREE.BufferAttribute(pC, 3));
  geo.setAttribute("sd", new THREE.BufferAttribute(sd, 1));
  geo.setAttribute("sc", new THREE.BufferAttribute(sc, 1));
  geo.setAttribute("al", new THREE.BufferAttribute(al, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3000);
  const uni = { wA: { value: 1 }, wB: { value: 0 }, wC: { value: 0 }, squeeze: { value: 1 }, time: { value: 0 }, psize: { value: 2.2 }, tint: { value: ORANGE } };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec3 pA;
attribute vec3 pB;
attribute vec3 pC;
attribute float sd;
attribute float sc;
attribute float al;
uniform float wA, wB, wC, squeeze, time, psize;
varying float vA;
varying float vBoost;
varying float vOrange;
void main(){
  vec3 p = pA*wA + pB*wB + pC*wC;
  float s = sd*6.2831;
  p += vec3(sin(time*.55+s*3.1), cos(time*.47+s*2.3), sin(time*.61+s*4.7))*1.8;
  p.x *= squeeze;
  p.z *= squeeze;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = psize * sc * (760.0 / max(1.0, -mv.z));
  vA = al * clamp(1.0 - (-mv.z - 520.0) / 2600.0, .22, 1.0);
  vBoost = clamp(wB + wC, 0.0, 1.0);
  vOrange = wC;
}`,
    fragmentShader: `
precision mediump float;
uniform vec3 tint;
varying float vA;
varying float vBoost;
varying float vOrange;
void main(){
  float m = 1.0 - smoothstep(.30, .5, length(gl_PointCoord - 0.5));
  if (m <= 0.002) discard;
  float a = m * vA * mix(1.0, 1.9, vBoost);
  gl_FragColor = vec4(mix(vec3(1.0), tint, vOrange), min(a, 1.0));
}`,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  // Keyboard samples (form B) and wordmark samples (form C), kept raw so
  // they can be re-scaled on every resize.
  let kb = null, mk = null;
  function layoutA() {
    const s = isFilm() ? 1 : Math.min(1, innerWidth / 1100, innerHeight / 780);
    for (let i = 0; i < pA.length; i++) pA[i] = pA0[i] * s;
    geo.attributes.pA.needsUpdate = true;
  }
  function layoutB() {
    if (!kb) return;
    let SRC_W, TOP_Y, OX, zScale;
    if (isFilm()) { SRC_W = 1605; TOP_Y = 148; OX = -12; zScale = 1; }
    else {
      SRC_W = Math.min(innerWidth * 0.96, 1605 * (innerWidth / 1440));
      if (SRC_W * kb.h / kb.w > innerHeight * 0.62) SRC_W = innerHeight * 0.62 * kb.w / kb.h;
      TOP_Y = Math.min(148 * (innerHeight / 900), innerHeight * 0.18); OX = -12 * (innerWidth / 1440); zScale = Math.min(1, innerWidth / 1440);
    }
    const k = SRC_W / kb.w, srcH = SRC_W * kb.h / kb.w;
    for (let i = 0; i < PN; i++) {
      const o = i * 3, q = kb.pick[i];
      pB[o] = (kb.x[q] / kb.w - 0.5) * SRC_W + OX + kb.j[o] * k * 0.9;
      pB[o + 1] = TOP_Y - (kb.y[q] / kb.h) * srcH + kb.j[o + 1] * k * 0.9;
      pB[o + 2] = kb.j[o + 2] * 10 * zScale; // keep it nearly flat: depth smears it under perspective
    }
    geo.attributes.pB.needsUpdate = true;
  }
  function layoutC() {
    if (!mk) return;
    let markW, OY;
    if (isFilm()) { markW = 1108; OY = -23; }
    else {
      markW = Math.min(innerWidth * 0.88, 1108 * (innerWidth / 1440));
      let cap = Math.max(80, innerHeight * 0.36);
      OY = -Math.min(36, innerHeight * 0.03);
      // Stacked phone layout: sit the mark in the gap between heading and buttons.
      const h2b = $("#s4 h2").getBoundingClientRect().bottom, asTop = $("#s4 .s4aside").getBoundingClientRect().top;
      if (asTop > h2b + 60 && asTop < innerHeight * 0.75) { cap = (asTop - h2b) * 0.72; OY = innerHeight / 2 - (h2b + asTop) / 2; }
      if (markW * (mk.sy * 0.669) / mk.sx > cap) markW = cap * mk.sx / (mk.sy * 0.669);
    }
    const KX = markW / mk.sx, KY = KX * 0.669;
    for (let i = 0; i < PN; i++) { const o = i * 3; pC[o] = mk.raw[o] * KX; pC[o + 1] = mk.raw[o + 1] * KY + OY; pC[o + 2] = mk.raw[o + 2] * KX; }
    geo.attributes.pC.needsUpdate = true;
  }
  function loadKeyboard() {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const cw = 420, sx = img.width * KEYBOARD_CROP.x, sy = img.height * KEYBOARD_CROP.y, sw = img.width * KEYBOARD_CROP.w, sh = img.height * KEYBOARD_CROP.h;
      const ch = Math.round(cw * sh / sw);
      const c = document.createElement("canvas"); c.width = cw; c.height = ch;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
      const d = ctx.getImageData(0, 0, cw, ch).data;
      const xs = [], ys = [], Ls = [], cum = [];
      let tot = 0;
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        // The keys are dark on a silver deck, so the darkness is what glows.
        const o = (y * cw + x) * 4, L = 1 - (d[o] * 0.299 + d[o + 1] * 0.587 + d[o + 2] * 0.114) / 255;
        if (L > 0.62) { xs.push(x); ys.push(y); Ls.push(L); tot += L * L * L; cum.push(tot); }
      }
      if (!xs.length) { ready("keys"); return; }
      const pick = new Uint32Array(PN), j = new Float32Array(PN * 3);
      for (let i = 0; i < PN; i++) {
        const r = Math.random() * tot; let lo = 0, hi = cum.length - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
        pick[i] = lo; j[i * 3] = Math.random() - 0.5; j[i * 3 + 1] = Math.random() - 0.5; j[i * 3 + 2] = Math.random() - 0.5;
      }
      kb = { w: cw, h: ch, x: xs, y: ys, L: Ls, pick, j };
      layoutB();
      ready("keys");
    };
    img.onerror = () => ready("keys");
    img.src = KEYBOARD_IMG;
  }
  function buildMark() {
    const g = wordmark(new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial());
    g.updateMatrixWorld(true);
    const tris = [], areas = [];
    let total = 0;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
    g.children.forEach((m) => {
      const pos = m.geometry.attributes.position, idx = m.geometry.index;
      const n = idx ? idx.count : pos.count;
      for (let t = 0; t < n; t += 3) {
        const ia = idx ? idx.getX(t) : t, ib = idx ? idx.getX(t + 1) : t + 1, ic = idx ? idx.getX(t + 2) : t + 2;
        a.fromBufferAttribute(pos, ia).applyMatrix4(m.matrixWorld);
        b.fromBufferAttribute(pos, ib).applyMatrix4(m.matrixWorld);
        c.fromBufferAttribute(pos, ic).applyMatrix4(m.matrixWorld);
        const area = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
        total += area; areas.push(total); tris.push(a.clone(), b.clone(), c.clone());
      }
    });
    const raw = new Float32Array(PN * 3), box = new THREE.Box3(), v = new THREE.Vector3();
    for (let i = 0; i < PN; i++) {
      const r = Math.random() * total; let lo = 0, hi = areas.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (areas[mid] < r) lo = mid + 1; else hi = mid; }
      let u = Math.random(), w = Math.random(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
      const A = tris[lo * 3], B = tris[lo * 3 + 1], C = tris[lo * 3 + 2];
      v.copy(A).addScaledVector(ab.subVectors(B, A), u).addScaledVector(ac.subVectors(C, A), w);
      raw[i * 3] = v.x; raw[i * 3 + 1] = v.y; raw[i * 3 + 2] = v.z; box.expandByPoint(v);
    }
    const ctr = new THREE.Vector3(), size = new THREE.Vector3(); box.getCenter(ctr); box.getSize(size);
    for (let i = 0; i < PN; i++) { raw[i * 3] -= ctr.x; raw[i * 3 + 1] -= ctr.y; raw[i * 3 + 2] -= ctr.z; }
    mk = { raw, sx: size.x, sy: size.y };
    layoutC();
  }
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.position.z = (innerHeight / 2) / Math.tan(22.5 * Math.PI / 180);
    camera.updateProjectionMatrix();
    uni.psize.value = 2.2 * clamp(Math.min(innerWidth / 1100, innerHeight / 780), 0.55, 1);
    layoutA(); layoutB(); layoutC();
  }
  resize();
  let spin = 0;
  function frame(now, dt) {
    uni.time.value = now / 1000;
    spin += dt * (0.085 * uni.wA.value + 0.006 * (uni.wB.value + uni.wC.value));
    points.rotation.y = spin * uni.wA.value + ptr.nx * 0.16;
    points.rotation.x = ptr.ny * 0.09;
    renderer.render(scene, camera);
  }
  return { el, uni, frame, resize, loadKeyboard, buildMark };
})();

/* ── View: progress y drives the hero parallax, particles, rail, cursor ─ */
const heroBg = $("#heroBg"), rail = $("#rail"), railFill = $("#railFill");
let viewY = 0;
function applyView(y) {
  viewY = y;
  const vh = innerHeight;
  heroBg.style.transform = `translate3d(0, ${y * 0.30}px, 0)`;
  stage.el.classList.toggle("on", y > vh * 0.55 && !html.classList.contains("xp-free"));
  rail.classList.toggle("on", y > vh * 0.75 && !html.classList.contains("xp-free"));
  const t = clamp(y / vh - 1, 0, 2);
  let wA, wB, wC, sq = 1, k;
  if (t < 0.30) { wA = 1; wB = 0; wC = 0; }
  else if (t < 0.70) { k = smooth((t - 0.30) / 0.40); wA = 1 - k; wB = k; wC = 0; sq = 1 - 0.93 * Math.sin(Math.PI * clamp(k, 0, 1)); }
  else if (t < 1.30) { wA = 0; wB = 1; wC = 0; }
  else if (t < 1.70) { k = smooth((t - 1.30) / 0.40); wA = 0; wB = 1 - k; wC = k; sq = 1 - 0.93 * Math.sin(Math.PI * clamp(k, 0, 1)); }
  else { wA = 0; wB = 0; wC = 1; }
  stage.uni.wA.value = wA; stage.uni.wB.value = wB; stage.uni.wC.value = wC; stage.uni.squeeze.value = Math.max(sq, 0.02);
  railFill.style.height = clamp(y / (vh * 3), 0, 1) * 100 + "%";
  const big = y > vh * 0.70;
  cursor.classList.toggle("big", big);
  cursorLabel.classList.toggle("on", big && y < vh * 2.55);
}

/* ── Section stepping ───────────────────────────────────────────────── */
const sections = $$("#xp > section");
const REST = sections.length; // index after the last panel = normal scrolling
const state = { index: 0, busy: false, coolUntil: 0 };
const LEAVE_MS = 900, ENTER_MS = 750;
function tweenView(from, to, ms) {
  const t0 = performance.now();
  const step = (now) => {
    const k = clamp((now - t0) / ms, 0, 1);
    applyView(lerp(from, to, k));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function finish() { state.busy = false; state.coolUntil = performance.now() + 420; }
function go(next) {
  if (state.busy || next === state.index || next < 0 || next > REST) return;
  state.busy = true;
  const prev = state.index, down = next > prev;
  state.index = next;
  if (prev === REST) { // leaving the normal-scroll part: bring the panels back
    html.classList.remove("xp-free");
    scrollTo(0, 0);
    tweenView(REST * innerHeight, (REST - 1) * innerHeight, 10);
    present(sections[next]);
    return;
  }
  const old = sections[prev];
  old.classList.add(down ? "out-up" : "out-down");
  tweenView(prev * innerHeight, Math.min(next, REST - 1) * innerHeight, LEAVE_MS);
  let done = false;
  const after = () => {
    if (done) return; done = true;
    old.classList.remove("show", "out-up", "out-down");
    resetSection(old);
    if (next === REST) { // release into normal page scrolling
      html.classList.add("xp-free");
      scrollTo(0, 0);
      applyView(REST * innerHeight);
      $(".xp-rest").focus?.({ preventScroll: true });
      setTimeout(finish, 600);
      return;
    }
    present(sections[next]);
  };
  old.addEventListener("transitionend", function te(e) { if (e.target === old && e.propertyName === "transform") { old.removeEventListener("transitionend", te); after(); } });
  setTimeout(after, 980);
}
function present(sec) {
  sec.style.transition = "none"; sec.style.opacity = "0";
  sec.classList.add("show");
  void sec.offsetWidth;
  sec.style.transition = ""; sec.style.opacity = "";
  play(sec);
  if (sec.id === "s4") startSteps();
  let done = false;
  const unlock = () => { if (!done) { done = true; finish(); } };
  sec.addEventListener("transitionend", function te(e) { if (e.target === sec && e.propertyName === "opacity") { sec.removeEventListener("transitionend", te); unlock(); } });
  setTimeout(unlock, ENTER_MS + 80);
}

// Inner boxes that may scroll on their own before the page moves on.
function innerScroller(target, dir, axis = "y") {
  const box = target.closest?.("#steps, .navpill, .note, .step, #heroAside");
  if (!box) return null;
  if (axis === "y") {
    if (box.scrollHeight <= box.clientHeight + 1) return null;
    if (dir > 0 && box.scrollTop + box.clientHeight < box.scrollHeight - 1) return box;
    if (dir < 0 && box.scrollTop > 0) return box;
  }
  return null;
}
let acc = 0, lastWheel = 0;
addEventListener("wheel", (e) => {
  if (!loaderDone) { e.preventDefault(); return; }
  if (state.index === REST) {
    // Normal page: only an upward push at the very top goes back to the panels.
    if (scrollY <= 0 && e.deltaY < 0) {
      e.preventDefault();
      const now = performance.now(); if (now - lastWheel > 160) acc = 0; lastWheel = now;
      acc += e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? innerHeight : 1);
      if (acc < -48 && !state.busy && now > state.coolUntil) { acc = 0; go(REST - 1); }
    }
    return;
  }
  if (innerScroller(e.target, Math.sign(e.deltaY))) return;
  e.preventDefault();
  const now = performance.now();
  if (state.busy || now < state.coolUntil) { acc = 0; return; }
  if (now - lastWheel > 160) acc = 0;
  lastWheel = now;
  acc += e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? innerHeight : 1);
  if (Math.abs(acc) > 48) { const dir = Math.sign(acc); acc = 0; go(state.index + dir); }
}, { passive: false });
let ts = null;
addEventListener("touchstart", (e) => { const t = e.touches[0]; ts = { x: t.clientX, y: t.clientY, target: e.target, top: scrollY }; }, { passive: true });
addEventListener("touchend", (e) => {
  if (!ts || !loaderDone) return;
  const t = e.changedTouches[0], dx = t.clientX - ts.x, dy = t.clientY - ts.y;
  const start = ts; ts = null;
  if (Math.abs(dx) > Math.abs(dy)) return;
  if (state.index === REST) { if (start.top <= 0 && scrollY <= 0 && dy > 48) go(REST - 1); return; }
  if (innerScroller(start.target, -Math.sign(dy))) return;
  if (Math.abs(dy) > 48) go(state.index + (dy < 0 ? 1 : -1));
}, { passive: true });
addEventListener("keydown", (e) => {
  if (!loaderDone || e.target.closest?.("input, textarea, select")) return;
  const fwd = ["ArrowDown", "PageDown", " "].includes(e.key), back = ["ArrowUp", "PageUp"].includes(e.key);
  if (!fwd && !back) return;
  if (state.index === REST) { if (back && scrollY <= 0) { e.preventDefault(); go(REST - 1); } return; }
  e.preventDefault();
  if (!state.busy && performance.now() > state.coolUntil) go(state.index + (fwd ? 1 : -1));
});
// "Back to top" links return to the hero.
$$('a[href="#top"]').forEach((a) => a.addEventListener("click", (e) => {
  e.preventDefault();
  if (state.index === REST) { html.classList.remove("xp-free"); scrollTo(0, 0); sections.forEach((s) => s.classList.remove("show")); state.index = 0; present(sections[0]); resetSection(sections[0]); play(sections[0]); applyView(0); }
  else go(0);
}));
// Keyboard focus moving into a hidden panel brings that panel into view.
sections.forEach((sec, i) => sec.addEventListener("focusin", () => { if (state.index !== i && !state.busy) go(i); }));

/* ── Step cards autoplay ────────────────────────────────────────────── */
const stepsEl = $("#steps"), stepEls = $$(".step", stepsEl);
let stepI = -1, stepTimer = null, pauseUntil = 0;
function advanceStep() {
  if (performance.now() < pauseUntil) return;
  stepEls.forEach((s) => s.classList.remove("act"));
  stepI = (stepI + 1) % stepEls.length;
  const s = stepEls[stepI];
  s.style.setProperty("--dwell", "4200ms");
  void s.offsetWidth;
  s.classList.add("act");
  if (stepsEl.scrollWidth > stepsEl.clientWidth + 1) {
    const pad = parseFloat(getComputedStyle(stepsEl).paddingLeft) || 0;
    stepsEl.scrollTo({ left: s.offsetLeft - pad, behavior: "smooth" });
  }
}
function startSteps() { if (stepTimer) return; advanceStep(); stepTimer = setInterval(advanceStep, 4200); }
stepsEl.addEventListener("pointerdown", () => { pauseUntil = performance.now() + 12000; });

/* ── Resize ─────────────────────────────────────────────────────────── */
function onResize() {
  if (getComputedStyle(navtoggle).display === "none") setMenu(false);
  layout();
  hero3d.fit();
  drawNums();
  stage.resize();
  if (!state.busy) applyView(Math.min(state.index, REST) * innerHeight);
}
addEventListener("resize", onResize);
window.visualViewport?.addEventListener("resize", onResize);

/* ── Boot ───────────────────────────────────────────────────────────── */
layout();
applyView(0);
stage.loadKeyboard();
document.fonts.ready.then(() => {
  layout();
  buildGlyphs();
  hero3d.setGlyphs();
  stage.buildMark();
  ready("glb");
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  cur.x += (ptr.x - cur.x) * 0.22; cur.y += (ptr.y - cur.y) * 0.22;
  cursor.style.transform = `translate(${cur.x}px, ${cur.y}px)`;
  cursorLabel.style.transform = `translate(${cur.x}px, ${cur.y}px) translate(-50%, 25px)`;
  cursor.classList.toggle("dot", state.index === 0 && (hero3d.state.over || hero3d.state.drag));
  if (state.index === 0 || state.busy) hero3d.frame(now / 1000);
  if (!html.classList.contains("xp-free")) stage.frame(now, dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
