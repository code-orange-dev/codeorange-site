// Scroll motion shared by every page: fade-ins, the magnetic hero card,
// letters that light up as you scroll, the sliding photo rows and the
// stacking cards on the homepage. Pages work the same without it.
(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // Work out per-frame effects together so scrolling stays smooth.
  const onFrame = [];
  let queued = false;
  const tick = () => { queued = false; onFrame.forEach((fn) => fn()); };
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(tick); } };
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);

  // ── Fade-ins: elements rise into place the first time they come into view.
  const fadeSel = [
    "main section h2", "main section .eyebrow", "main section .co-eyebrow", "main section .lead", "main section .co-lead",
    ".card", ".program-card", ".stat", ".repo-card", ".feature-panel", ".booking-panel", ".article-card", ".newsletter-card",
    ".author-box", ".timeline-item", ".photo-card", ".cta-row",
    "#static-homepage .co-card", "#static-homepage .co-event-preview a", "#static-homepage .co-path a", "#static-homepage .co-person",
    "#static-homepage .co-calendar", "#static-homepage .co-calendar-subscribe", "#static-homepage .co-path-cta", "#static-homepage details",
    "#static-homepage .co-faq-cta", "#static-homepage .co-about .co-actions", "#static-homepage .co-media-footer", "#static-homepage .co-deco",
  ].join(",");
  if (!reduce && "IntersectionObserver" in window) {
    const skip = (el) => el.closest(".hero, .co-hero, .co-proof-card, .co-menu, [data-dc-script]");
    const items = [...document.querySelectorAll(fadeSel)].filter((el) => !skip(el));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { rootMargin: "50px 0px 50px 0px", threshold: 0 });
    // Siblings of the same kind come in one after another.
    const seen = new Map();
    items.forEach((el) => {
      const key = el.parentElement;
      const n = seen.get(key) || 0;
      seen.set(key, n + 1);
      if (el.classList.contains("co-deco")) {
        const left = /co-deco-(tl|bl)/.test(el.className);
        el.style.setProperty("--co-fx", left ? "-80px" : "80px");
        el.style.setProperty("--co-fd", ".9s");
        el.style.setProperty("--co-delay", `${[0.1, 0.25, 0.15, 0.3][["tl", "bl", "tr", "br"].findIndex((k) => el.classList.contains(`co-deco-${k}`))] || 0}s`);
      } else {
        el.style.setProperty("--co-delay", `${Math.min(n, 6) * 0.1}s`);
      }
      el.classList.add("co-fade");
      io.observe(el);
    });
    root.classList.add("co-motion");
  }

  if (reduce) return;

  // ── Magnet: the hero card leans toward the cursor when it comes close.
  document.querySelectorAll("[data-magnet], .hero .terminal-card").forEach((el) => {
    const padding = 150, strength = 3;
    el.classList.add("co-magnet");
    let active = false;
    window.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const near = e.clientX > r.left - padding && e.clientX < r.right + padding && e.clientY > r.top - padding && e.clientY < r.bottom + padding;
      if (near) {
        const x = (e.clientX - (r.left + r.width / 2)) / strength;
        const y = (e.clientY - (r.top + r.height / 2)) / strength;
        el.style.transition = "transform 0.3s ease-out";
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        active = true;
      } else if (active) {
        el.style.transition = "transform 0.6s ease-in-out";
        el.style.transform = "translate3d(0, 0, 0)";
        active = false;
      }
    }, { passive: true });
  });

  // ── Letters light up one by one as the paragraph scrolls through view.
  document.querySelectorAll("[data-reveal]").forEach((p) => {
    const chars = [];
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const w = document.createElement("span");
            w.className = "co-w";
            [...part].forEach((ch) => {
              const c = document.createElement("span");
              c.className = "co-c";
              c.textContent = ch;
              w.appendChild(c);
              chars.push(c);
            });
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) walk(child);
      });
    };
    walk(p);
    p.classList.add("co-reveal");
    const update = () => {
      const r = p.getBoundingClientRect(), vh = window.innerHeight;
      // 0 when the top reaches 80% of the screen, 1 when the bottom reaches 20%.
      const start = vh * 0.8, end = vh * 0.2;
      const progress = clamp((start - r.top) / (start - end + r.height), 0, 1);
      const lit = progress * chars.length;
      chars.forEach((c, i) => { c.style.opacity = (0.2 + 0.8 * clamp(lit - i, 0, 1)).toFixed(3); });
    };
    onFrame.push(update);
  });

  // ── Photo rows: one slides right, the other left, as the page scrolls.
  document.querySelectorAll(".co-marquee").forEach((section) => {
    const rows = [...section.querySelectorAll("[data-marquee]")];
    rows.forEach((row) => {
      const originals = [...row.children];
      for (let k = 0; k < 2; k++) originals.forEach((el) => {
        const copy = el.cloneNode(true);
        copy.setAttribute("aria-hidden", "true");
        copy.querySelectorAll("img").forEach((img) => { img.alt = ""; });
        row.appendChild(copy);
      });
    });
    section.classList.add("is-live");
    const update = () => {
      const r = section.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
      const offset = (window.innerHeight - r.top) * 0.3;
      rows.forEach((row) => {
        const set = row.scrollWidth / 3;
        if (!set) return;
        const shift = ((offset - 200) % set + set) % set;
        const x = row.dataset.marquee === "right" ? shift - set : -shift;
        row.style.transform = `translate3d(${x}px, 0, 0)`;
      });
    };
    onFrame.push(update);
  });

  // ── Stacking cards: each card shrinks a little as the next one slides over it.
  document.querySelectorAll(".co-proof-grid").forEach((grid) => {
    const cards = [...grid.querySelectorAll(".co-proof-card")];
    const total = cards.length;
    cards.forEach((card, i) => card.style.setProperty("--i", i));
    const update = () => {
      if (window.innerWidth <= 760) { cards.forEach((c) => { c.style.transform = ""; }); return; }
      const g = grid.getBoundingClientRect();
      cards.forEach((card, i) => {
        const target = 1 - (total - 1 - i) * 0.03;
        const item = card.parentElement.getBoundingClientRect();
        const span = g.bottom - item.top - window.innerHeight * 0.4;
        const progress = span > 0 ? clamp(-item.top / span, 0, 1) : 0;
        card.style.transform = `scale(${1 - (1 - target) * progress})`;
      });
    };
    onFrame.push(update);
  });

  request();
})();
