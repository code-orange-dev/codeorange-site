// Guidelines page: highlight the section you're reading in the side menu.
(() => {
  const links = [...document.querySelectorAll(".fw-toc a")];
  if (!links.length || !("IntersectionObserver" in window)) return;
  const byId = Object.fromEntries(links.map((a) => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.classList.remove("is-on"));
      const a = byId[e.target.id];
      a && a.classList.add("is-on");
    });
  }, { rootMargin: "-30% 0px -60% 0px" });
  document.querySelectorAll(".fw-doc section[id]").forEach((s) => io.observe(s));
})();
