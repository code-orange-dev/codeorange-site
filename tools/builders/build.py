"""Builds the "Builders wall" section on /impact from the data on /dashboard.

Run after updating dashboard.html:  python3 tools/builders/build.py
It rewrites the block between <!-- builders:start --> and <!-- builders:end --> in impact.html and impact/index.html.
The "Latest merged" list is refreshed live in the browser from /api/builders; the list written here is the fallback.
"""
import html, json, re, pathlib
from datetime import datetime

ROOT = pathlib.Path(__file__).resolve().parents[2]
d = json.loads(re.search(r'const DATA = (\{.*?\});\n', (ROOT / 'dashboard.html').read_text(), re.S).group(1))
e = html.escape
s = d['stats']

def month(p):
    try: return datetime.strptime(p['date'], '%b %Y')
    except Exception: return datetime(2000, 1, 1)

merged = sorted([p for p in d['prs'] if p['status'] == 'merged' and not p.get('pre')], key=month, reverse=True)[:6]

cards = ''.join(
    f'<a class="cob-person" href="https://github.com/{e(c["github"])}" target="_blank" rel="noopener">'
    f'<img src="https://github.com/{e(c["github"])}.png?size=96" alt="" width="48" height="48" loading="lazy" decoding="async">'
    f'<span><b>{e(c["name"])}</b><small>{c["merged"]} merged</small></span></a>'
    for c in d['contributors'] if c['merged'] > 0)

feed = ''.join(
    f'<li><a href="{e(p["url"])}" target="_blank" rel="noopener"><b>{e(p.get("title") or p["project"] + " #" + str(p["number"]))}</b>'
    f'<span>{e(p["repo"])} · {e(p["contributor"])} · {e(p["date"])}</span></a></li>'
    for p in merged)

block = f'''<!-- builders:start -->
<section class="cob" id="builders" aria-labelledby="cob-title"><div class="section-inner">
  <div class="split"><div><p class="eyebrow">Builders wall</p><h2 id="cob-title">Real code, merged into real Bitcoin projects.</h2></div>
  <p class="lead">Every pull request is public on GitHub. The latest merges below update automatically, and the totals are checked by hand each month on the <a href="/dashboard">PR dashboard</a>.</p></div>
  <div class="cob-stats">
    <div><strong>{s["merged"]}</strong><span>merged pull requests</span></div>
    <div><strong>{s["reposWithMerged"]}</strong><span>open-source repos</span></div>
    <div><strong>{s["contributorsWithMerged"]}</strong><span>builders with merged code</span></div>
    <div><strong data-cob-30>{s["open"]}</strong><span data-cob-30-label>open pull requests in review</span></div>
  </div>
  <div class="cob-grid">
    <div class="cob-feed"><p class="cob-label"><i aria-hidden="true"></i>Latest merged</p><ul data-cob-feed>{feed}</ul></div>
    <div class="cob-people"><p class="cob-label">The builders</p><div class="cob-people-grid">{cards}</div>
    <a class="cob-more" href="/dashboard">See every pull request &rarr;</a></div>
  </div>
</div></section>
<!-- builders:end -->'''

head = '<link rel="stylesheet" href="/assets/co-builders.css?v=1"><script src="/assets/co-builders.js?v=1" defer></script>'
for f in ['impact.html', 'impact/index.html']:
    p = ROOT / f; t = p.read_text()
    if '<!-- builders:start -->' in t:
        t = re.sub(r'<!-- builders:start -->.*?<!-- builders:end -->', lambda m: block, t, flags=re.S)
    else:
        t = t.replace('<section class="band"><div class="section-inner split">\n  <div><p class="eyebrow">Example program</p>', block + '\n<section class="band"><div class="section-inner split">\n  <div><p class="eyebrow">Example program</p>', 1)
    if 'co-builders.css' not in t:
        t = t.replace('</head>', head + '\n</head>', 1)
    p.write_text(t); print('wrote', f, '<!-- builders:start -->' in t)
