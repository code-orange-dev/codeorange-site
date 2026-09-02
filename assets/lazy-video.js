(() => {
  const loaded = new WeakSet();

  const load = (video) => {
    if (!video || loaded.has(video)) return;
    const src = video.getAttribute("data-src");
    if (!src || src.includes("{{")) return;
    loaded.add(video);
    video.src = src;
    video.load();
    if (video.hasAttribute("autoplay")) {
      video.play().catch(() => {});
    }
  };

  const observe = (video) => {
    if (!video || video.__coLazyVideoObserved) return;
    video.__coLazyVideoObserved = true;
    if (!("IntersectionObserver" in window)) {
      load(video);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(video);
        load(video);
      }
    }, { rootMargin: "600px 0px" });
    observer.observe(video);
  };

  const scan = (root = document) => {
    if (root.matches?.("[data-lazy-video]")) observe(root);
    root.querySelectorAll?.("[data-lazy-video]").forEach(observe);
  };

  const start = () => {
    scan();
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) scan(node);
        });
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
