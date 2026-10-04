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
