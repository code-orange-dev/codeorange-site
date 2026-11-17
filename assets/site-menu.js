// "Session notes" lives in the menu without adding a top-level button:
// on desktop it sits in a small drop-down under Programs, on phones it is its own row.
const CO_EXTRA = [["/session-notes", "Session notes"], ["/articles", "Articles"]];
(() => {
  const nav = document.querySelector('.co-links, .desktop-nav, .nav-links, [data-mq="nav-links"]');
  if (!nav) return;
  const host = [...nav.querySelectorAll("a[href]")].find((a) => /^\/programs\/?$/.test(a.getAttribute("href")));
  if (!host) return;
  const css = document.createElement("style");
  css.textContent =
    ".co-dd-host::after{content:'';display:inline-block;width:5px;height:5px;margin:0 0 3px 7px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg);opacity:.7}" +
    ".co-dd{position:fixed;z-index:1000;min-width:190px;padding:8px;border-radius:14px;background:#141414;border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 50px rgba(0,0,0,.55);display:none}" +
    ".co-dd.open{display:block}" +
    ".co-dd a{display:block;padding:10px 14px;border-radius:9px;color:#F5F5F5;font:600 14px/1.2 Inter,system-ui,sans-serif;text-decoration:none;white-space:nowrap}" +
    ".co-dd a:hover,.co-dd a:focus-visible{background:rgba(247,147,26,.14);color:#F7931A;outline:none}";
  document.head.appendChild(css);
  host.classList.add("co-dd-host");
  host.setAttribute("aria-haspopup", "true");
  const dd = document.createElement("div");
  dd.className = "co-dd";
  dd.setAttribute("role", "menu");
  dd.innerHTML = `<a role="menuitem" href="/programs">All programs</a>` + CO_EXTRA.map(([h, t]) => `<a role="menuitem" href="${h}">${t}</a>`).join("");
  document.body.appendChild(dd);
  let timer;
  const show = () => {
    clearTimeout(timer);
    if (getComputedStyle(nav).display === "none") return;
    const r = host.getBoundingClientRect();
    dd.style.left = Math.max(8, Math.min(r.left - 14, innerWidth - 210)) + "px";
    dd.style.top = r.bottom + 6 + "px";
    dd.classList.add("open");
  };
  const hide = (now) => { clearTimeout(timer); timer = setTimeout(() => dd.classList.remove("open"), now ? 0 : 180); };
  host.addEventListener("mouseenter", show);
  host.addEventListener("mouseleave", () => hide());
  host.addEventListener("focus", show);
  host.addEventListener("blur", () => hide());
  dd.addEventListener("mouseenter", show);
  dd.addEventListener("mouseleave", () => hide());
  dd.addEventListener("focusin", show);
  dd.addEventListener("focusout", () => hide());
  host.addEventListener("keydown", (e) => { if (e.key === "ArrowDown") { e.preventDefault(); show(); dd.querySelector("a").focus(); } });
  dd.addEventListener("keydown", (e) => { if (e.key === "Escape") { hide(true); host.focus(); } });
  window.addEventListener("scroll", () => hide(true), { passive: true });
  window.addEventListener("resize", () => hide(true));
})();

// Full-screen mobile menu, shared by every page. It reuses the page's own
// primary nav links, so menus stay in sync with each page's header.
(() => {
  // Pages rendered by support.js keep their own built-in mobile nav.
  if (document.querySelector("[data-dc-script], [data-mq=\"nav-mobile\"]")) return;
  const nav = document.querySelector('.co-links, .desktop-nav, .nav-links, [data-mq="nav-links"]');
  if (!nav) return;
  const links = [...nav.querySelectorAll("a[href]")];
  if (!links.length) return;
  const row = nav.parentElement;
  const header = nav.closest("header") || row;
  const actions = header.querySelector(".co-actions, .header-actions");
  const logo = header.querySelector("img");

  const icon = (paths) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const menuIcon = icon('<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>');
  const closeIcon = icon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');

  const button = document.createElement("button");
  button.type = "button";
  button.className = "co-burger";
  button.setAttribute("aria-label", "Open menu");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", "co-menu");
  button.innerHTML = menuIcon;
  button.hidden = true;
  row.appendChild(button);

  const menu = document.createElement("div");
  menu.id = "co-menu";
  menu.className = "co-menu";
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-modal", "true");
  menu.setAttribute("aria-label", "Site menu");
  menu.setAttribute("aria-hidden", "true");
  menu.innerHTML =
    `<div class="co-menu-top">${logo ? `<img src="${logo.getAttribute("src")}" alt="${logo.getAttribute("alt") || ""}">` : "<span></span>"}` +
    `<button type="button" class="co-menu-close" aria-label="Close menu">${closeIcon}</button></div>` +
    `<nav class="co-menu-links" aria-label="Menu"></nav><div class="co-menu-actions"></div>`;
  const list = menu.querySelector(".co-menu-links");
  links.forEach((a) => {
    const copy = document.createElement("a");
    copy.href = a.getAttribute("href");
    copy.textContent = a.textContent.trim();
    if (a.target) { copy.target = a.target; copy.rel = a.rel || "noopener"; }
    list.appendChild(copy);
  });
  // Phone menu only: one extra row for Session notes (not a desktop top-level button).
  if (!links.some((a) => /^\/session-notes\/?$/.test(a.getAttribute("href")))) {
    const extra = document.createElement("a");
    extra.href = "/session-notes";
    extra.textContent = "Session notes";
    const before = [...list.children].find((a) => /^\/(community|about)\/?$/.test(a.getAttribute("href")));
    list.insertBefore(extra, before || null);
  }
  if (actions) {
    const box = menu.querySelector(".co-menu-actions");
    actions.querySelectorAll("a[href]").forEach((a) => {
      const copy = a.cloneNode(true);
      copy.removeAttribute("style");
      box.appendChild(copy);
    });
  }
  document.body.appendChild(menu);
  document.documentElement.classList.add("co-has-menu");

  const closeBtn = menu.querySelector(".co-menu-close");
  const setOpen = (open) => {
    menu.classList.toggle("open", open);
    menu.setAttribute("aria-hidden", String(!open));
    button.setAttribute("aria-expanded", String(open));
    document.documentElement.classList.toggle("co-menu-open", open);
    if (open) closeBtn.focus();
    else if (document.activeElement && menu.contains(document.activeElement)) button.focus();
  };
  button.addEventListener("click", () => setOpen(true));
  closeBtn.addEventListener("click", () => setOpen(false));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menu.classList.contains("open")) setOpen(false); });

  // Show the button only when the page's own desktop nav is hidden.
  const sync = () => {
    const hidden = getComputedStyle(nav).display === "none";
    button.hidden = !hidden;
    if (!hidden && menu.classList.contains("open")) setOpen(false);
  };
  sync();
  window.addEventListener("resize", sync);
})();

/* Cookie-free visitor counts (Vercel Web Analytics): no cookies, no personal data, skipped on localhost. */
(function () {
  if (/^(localhost|127\.)/.test(location.hostname) || document.querySelector('script[src*="/_vercel/insights/"]')) return;
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  var s = document.createElement("script"); s.defer = true; s.src = "/_vercel/insights/script.js";
  document.head.appendChild(s);
})();
