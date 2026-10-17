// Latest merged pull requests by Code Orange builders, for the live wall on /impact (assets/co-builders.js).
// Asks GitHub search for merged PRs by the community members listed on /dashboard and keeps only
// repositories run by the Bitcoin projects they already contribute to (the owners below).
// Set GITHUB_TOKEN in Vercel for a higher rate limit; it works without one thanks to the cache.

const BUILDERS = ["pzafonte", "va-an", "dayvvo", "muhahahmad68", "psychemist", "RazorBest", "Arowolokehinde", "0xlaga", "alexgrad42", "alexxie16", "mwihoti"];

const OWNERS = new Set(["aaron-recompile", "bitcoin", "bitcoin-core", "bitcoindevkit", "bitcoinppl", "bitcointranscripts", "btrustteam", "cashubtc", "danielabrozzoni", "fedibtc", "fedimint", "getalby", "getfloresta", "jharveyb", "joinmarket-org", "joinmarket-webui", "kdmukai", "kernel-node", "libreriadesatoshi", "lightningdevkit", "lightning", "lightningnetwork", "mostrop2p", "opentollgate", "payjoin", "peer-observer", "rust-bitcoin", "saving-satoshi", "sedited", "yancyribbens"]);

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const q = ["is:pr", "is:merged", ...BUILDERS.map((u) => `author:${u}`)].join(" ");
    const url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=100`;
    const headers = { Accept: "application/vnd.github+json", "User-Agent": "codeorange.dev builders wall" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`GitHub returned ${r.status}`);
    const data = await r.json();
    const prs = (data.items || [])
      .map((it) => {
        const repo = (it.repository_url || "").split("/repos/")[1] || "";
        return {
          title: it.title,
          url: it.html_url,
          repo,
          author: it.user && it.user.login,
          mergedAt: it.pull_request && it.pull_request.merged_at,
        };
      })
      .filter((p) => p.mergedAt && OWNERS.has(p.repo.split("/")[0].toLowerCase()))
      .sort((a, b) => (a.mergedAt < b.mergedAt ? 1 : -1));
    const since = Date.now() - 30 * 86400000;
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({
      updated: new Date().toISOString(),
      last30Days: prs.filter((p) => Date.parse(p.mergedAt) >= since).length,
      prs: prs.slice(0, 12),
    });
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: "GitHub unavailable" });
  }
};
