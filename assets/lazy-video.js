(() => {
  const loaded = new WeakSet();

  const prepare = (video) => {
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("loop", "");
    video.setAttribute("autoplay", "");
    video.setAttribute("playsinline", "");
  };

  const play = (video) => {
    if (!video || !video.hasAttribute("autoplay")) return;
    const attempt = () => video.play().catch(() => {});
    if (video.readyState >= 2) {
      attempt();
    } else {
      video.addEventListener("loadeddata", attempt, { once: true });
      video.addEventListener("canplay", attempt, { once: true });
    }
  };

  const load = (video) => {
    if (!video) return;
    prepare(video);
    if (loaded.has(video)) {
      play(video);
      return;
    }
    const src = video.getAttribute("data-src");
    loaded.add(video);
    if (src && !src.includes("{{")) {
      video.src = src;
      video.load();
    }
    play(video);
  };

  const observe = (video) => {
    if (!video) return;
    prepare(video);
    if (video.__coLazyVideoObserved) {
      if (!video.hasAttribute("data-lazy-video") || video.currentSrc || video.src) play(video);
      return;
    }
    if (!video.hasAttribute("data-lazy-video")) {
      load(video);
      return;
    }
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

  const loadNearby = () => {
    document.querySelectorAll("video[data-lazy-video]").forEach((video) => {
      const rect = video.getBoundingClientRect();
      if (rect.top < window.innerHeight + 900 && rect.bottom > -900) load(video);
    });
  };

  const scan = (root = document) => {
    if (root.matches?.("video")) observe(root);
    root.querySelectorAll?.("video").forEach(observe);
    loadNearby();
  };

  const start = () => {
    scan();
    let rescans = 0;
    const rescanTimer = window.setInterval(() => {
      scan();
      rescans += 1;
      if (rescans >= 12) window.clearInterval(rescanTimer);
    }, 750);
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) scan(node);
        });
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("scroll", loadNearby, { passive: true });
    window.addEventListener("resize", loadNearby, { passive: true });
    window.setTimeout(() => {
      document.querySelectorAll("video[data-lazy-video]").forEach(load);
    }, 3500);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
