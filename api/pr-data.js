// PR dashboard data for codeorange.dev (assets/pr-data.js).
// Source of truth: data/prs.json in github.com/code-orange-dev/PR-tracking-dashboard.
// Merging a change there updates every page within about ten minutes.

const SOURCE = "https://raw.githubusercontent.com/code-orange-dev/PR-tracking-dashboard/main/data/prs.json";

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const r = await fetch(SOURCE, { headers: { "User-Agent": "codeorange.dev pr-data" } });
    if (!r.ok) throw new Error(`GitHub returned ${r.status}`);
    const data = await r.json();
    if (!Array.isArray(data.prs) || !Array.isArray(data.contributors) || !data.projects) throw new Error("Unexpected data shape");
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
    return res.status(200).json(data);
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: "PR data unavailable", detail: String(err.message || err) });
  }
};
