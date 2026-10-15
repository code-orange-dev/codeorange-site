#!/usr/bin/env python3
"""Builds the session notes pages on codeorange.dev from tools/session-notes/sessions/.

Each session is two files in sessions/: <slug>.json (metadata, TL;DR, chapters,
resources) and <slug>.html (the Highlights + Key takeaways body). Running this script
writes session-notes/<slug>.html, session-notes.html, resources.html, their clean-URL
mirrors (x/index.html) and missing sitemap.xml entries. Run from anywhere:
    python3 tools/session-notes/build.py
"""
import re, pathlib
site = pathlib.Path(__file__).resolve().parents[2]
src = (site/'articles.html').read_text()

# shared pieces from the Articles page
head_end = src.index('</style>')
style = src[src.index('<style>'):head_end] + """
.notes-link { display:inline-flex; align-items:center; gap:8px; margin-top:4px; color: var(--dim); font: 600 13px "Plus Jakarta Sans", monospace; text-decoration:none; }
.notes-link:hover { color: var(--orange); }
.note-meta { display:flex; flex-wrap:wrap; gap:8px; margin:0; }
.prose h3 { margin: 30px 0 12px; font-size: 21px; color: var(--text); }
.prose ol li strong:first-child { color: var(--text); }
.source-box { margin: 40px 0 0; padding: 20px; background: var(--card); border: 1px solid var(--line); border-radius: 16px; color: var(--dim); font-size: 15px; line-height: 1.6; }
.source-box a { color: var(--orange); }
.tldr { margin: 0 0 40px; padding: 22px 24px; background: linear-gradient(145deg, rgba(247,147,26,.12), rgba(20,20,20,.9) 55%); border: 1px solid rgba(247,147,26,.3); border-radius: 16px; }
.tldr .eyebrow { margin: 0 0 10px; }
.tldr ul { margin: 0; padding-left: 20px; }
.tldr li { margin: 0 0 6px; color: var(--text); }
.viz { margin: 8px 0 36px; padding: 24px; background: var(--band); border: 1px solid var(--line); border-radius: 16px; font-size: 16px; line-height: 1.55; }
.viz .eyebrow { margin: 0 0 6px; }
.viz-title { margin: 0 0 18px; color: var(--text); font-size: 21px; font-weight: 600; }
.flow { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 0 0 18px; }
.flow-step { flex: 1 1 120px; padding: 14px 12px; text-align: center; background: var(--card); border: 1px solid rgba(255,255,255,.12); border-radius: 12px; color: var(--text); font-weight: 600; }
.flow-step small { display: block; margin-top: 4px; color: var(--dim); font: 600 11px "Plus Jakarta Sans", monospace; letter-spacing: .12em; text-transform: uppercase; }
.flow-hop { color: var(--orange); font: 700 15px "Plus Jakarta Sans", monospace; white-space: nowrap; }
.viz ul { margin: 0 0 16px; padding-left: 20px; }
.viz li { margin: 0 0 4px; }
.viz-fix { margin: 0; padding: 14px 16px; border-radius: 12px; background: rgba(247,147,26,.12); border: 1px solid rgba(247,147,26,.4); color: var(--text); }
.viz-fix b { color: var(--orange); }
.layers { display: grid; gap: 10px; }
.layer { padding: 16px 18px; background: var(--card); border: 1px solid rgba(255,255,255,.1); border-radius: 12px; }
.layer.top { background: rgba(247,147,26,.12); border-color: rgba(247,147,26,.5); }
.layer strong { display: block; color: var(--text); font-size: 18px; }
.layer p { margin: 4px 0 6px; }
.layer span { color: var(--orange); font: 600 13px "Plus Jakarta Sans", monospace; }
.layer-scale { display: flex; justify-content: space-between; margin: 0 0 8px; color: var(--dim); font: 700 11px "Plus Jakarta Sans", monospace; letter-spacing: .12em; text-transform: uppercase; }
.layer-scale b { color: var(--orange); }
.q-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
.q { padding: 16px; background: var(--card); border: 1px solid rgba(255,255,255,.1); border-radius: 12px; }
.q b { display: block; color: var(--orange); font: 700 13px "Plus Jakarta Sans", monospace; margin-bottom: 4px; }
.q span { color: var(--text); }
.share-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 32px 0 0; }
.share-row strong { color: var(--text); margin-right: 4px; }
.share-row a, .share-row button { min-height: 38px; padding: 8px 16px; border-radius: 999px; border: 1px solid rgba(255,255,255,.16); background: transparent; color: var(--text); font: 600 14px "Inter", system-ui, sans-serif; text-decoration: none; cursor: pointer; }
.share-row a:hover, .share-row button:hover { border-color: var(--orange); color: var(--orange); }
.note-figure img { aspect-ratio: 1200 / 630; }
.video { position: relative; margin: 0 0 14px; aspect-ratio: 16 / 9; border-radius: 16px; overflow: hidden; border: 1px solid var(--line); background: #000; box-shadow: 0 24px 70px rgba(0,0,0,.32); }
.video img, .video iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; object-fit: cover; }
.video button { position: absolute; inset: 0; width: 100%; border: 0; padding: 0; background: transparent; cursor: pointer; }
.video .play { position: absolute; left: 72%; top: 50%; width: 84px; height: 84px; margin: -42px 0 0 -42px; border-radius: 50%; background: var(--orange); box-shadow: 0 10px 40px rgba(0,0,0,.5); transition: transform .15s ease; }
.video .play:after { content: ""; position: absolute; left: 33px; top: 26px; border-style: solid; border-width: 16px 0 16px 26px; border-color: transparent transparent transparent #0A0A0A; }
.video button:hover .play { transform: scale(1.08); }
.video-note { margin: 0 0 32px; color: var(--dim); font: 500 13px/1.5 "Plus Jakarta Sans", monospace; }
.video-note a { color: var(--orange); }
.chapters { margin: 0 0 40px; border: 1px solid var(--line); border-radius: 16px; background: var(--band); }
.chapters summary { padding: 16px 20px; cursor: pointer; color: var(--text); font-weight: 600; list-style: none; display: flex; justify-content: space-between; align-items: center; }
.chapters summary::-webkit-details-marker { display: none; }
.chapters summary:after { content: "+"; color: var(--orange); font-size: 22px; line-height: 1; }
.chapters[open] summary:after { content: "−"; }
.chapters ol { list-style: none; margin: 0; padding: 0 8px 12px; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 2px 12px; }
.chapters li { margin: 0; }
.chapters a { display: flex; gap: 12px; padding: 8px 12px; border-radius: 8px; color: var(--muted); text-decoration: none; font-size: 15px; line-height: 1.4; }
.chapters a:hover { background: var(--card); color: var(--text); }
.chapters time { flex: 0 0 auto; min-width: 56px; color: var(--orange); font: 600 13px/1.6 "Plus Jakarta Sans", monospace; }
.quote { margin: 8px 0 32px; padding: 24px 26px; border-left: 3px solid var(--orange); background: var(--card); border-radius: 0 16px 16px 0; }
.quote p { margin: 0 0 10px; color: var(--text); font-size: 22px; line-height: 1.45; }
.quote cite { color: var(--dim); font: 600 13px "Plus Jakarta Sans", monospace; font-style: normal; }
.next-card { display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: center; margin: 40px 0 0; padding: 24px; background: linear-gradient(145deg, rgba(247,147,26,.14), rgba(20,20,20,.9) 55%); border: 1px solid rgba(247,147,26,.35); border-radius: 16px; }
.next-card .eyebrow { margin: 0 0 8px; }
.next-card h3 { font-size: 24px; }
.next-card p { margin: 6px 0 0; color: var(--muted); }
.next-card .cta-row { flex-wrap: wrap; }
@media (max-width: 700px) { .chapters ol { grid-template-columns: 1fr; } .next-card { grid-template-columns: 1fr; } .quote p { font-size: 19px; } }

@media (max-width: 560px) { .viz { padding: 18px; font-size: 15px; } .q-grid { grid-template-columns: 1fr; } .flow-hop { flex: 0 0 100%; text-align: center; } .flow-step { flex-basis: 100%; } .flow-hop i { display: inline-block; font-style: normal; transform: rotate(90deg); } }
"""
style += '</style>'
after_style = src[head_end+len('</style>'):]
tail_from = after_style.index('<link rel="stylesheet" href="/assets/theme.css')
header_to_main = after_style[tail_from:after_style.index('<main>')+len('<main>')]
hero_fx = re.search(r'<div class="co-fx".*?</div>\n', after_style, re.S).group(0)
final_cta = after_style[after_style.index('  <section class="section-inner final-cta">'):]
fonts = src[src.index('<link rel="preconnect"'):src.index('<style>')]

def head(title, desc, url, og_type='website', extra='', img='/assets/og-codeorange-workshop.jpg', img_alt='Code Orange Dev School Bitcoin workshop'):
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="https://codeorange.dev{url}">
<meta name="theme-color" content="#F7931A">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="Code Orange Dev School">
<meta property="og:url" content="https://codeorange.dev{url}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="https://codeorange.dev{img}">
<meta property="og:image:secure_url" content="https://codeorange.dev{img}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{img_alt}">
{extra}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@CodeOrangeDevs">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="https://codeorange.dev{img}">
<link rel="icon" type="image/svg+xml" href="/assets/favicon-co.svg">
{fonts}{style}
{header_to_main}'''

def hero(eyebrow, h1, lead, byline=''):
    return f'''
  <section class="hero article-hero">{hero_fx}    <div class="glow"></div>
    <div class="hero-grid">
      <div>
        <p class="eyebrow">{eyebrow}</p>
        <h1>{h1}</h1>
        <p class="lead">{lead}</p>{byline}
      </div>
    </div>
  </section>
'''


import json, html as _html
from datetime import date as _date

style = style.replace('</style>', '''.res-tools { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 0 0 28px; }
.res-tools input { flex: 1 1 260px; min-height: 46px; padding: 10px 16px; border-radius: 999px; border: 1px solid rgba(255,255,255,.18); background: var(--card); color: var(--text); font: 500 16px "Inter", system-ui, sans-serif; }
.res-tools input:focus { outline: 2px solid var(--orange); outline-offset: 1px; }
.chip { min-height: 38px; padding: 8px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,.16); background: transparent; color: var(--muted); font: 600 13px "Plus Jakarta Sans", monospace; cursor: pointer; }
.chip:hover, .chip[aria-pressed="true"] { border-color: var(--orange); color: var(--orange); }
.res-group { margin: 0 0 36px; }
.res-group h2 { font-size: clamp(24px, 2.4vw, 32px); margin: 0 0 14px; }
.res-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
.res { display: block; padding: 18px 20px; background: var(--card); border: 1px solid var(--line); border-radius: 14px; text-decoration: none; transition: border-color .15s ease, transform .15s ease; }
a.res:hover { border-color: rgba(247,147,26,.55); transform: translateY(-2px); }
.res strong { display: block; color: var(--text); font-size: 17px; line-height: 1.35; }
.res p { margin: 6px 0 10px; color: var(--muted); font-size: 15px; line-height: 1.5; }
.res small { color: var(--dim); font: 600 12px "Plus Jakarta Sans", monospace; }
.res small a { color: var(--orange); text-decoration: none; position: relative; z-index: 1; }
.res-empty { color: var(--dim); }
@media (max-width: 700px) { .res-grid { grid-template-columns: 1fr; } }
</style>''')

REPO = 'https://github.com/code-orange-dev/session-notes'
DISCORD = 'https://discord.gg/ZtvA79paWa'
HERE = pathlib.Path(__file__).resolve().parent
TOPIC_ORDER = ['Bitcoin basics', 'Privacy', 'Cypherpunk history', 'History', 'Lightning', 'Ecash', 'Wallets', 'Security', 'Explorers', 'Messaging', 'Code Orange']

def esc(s): return _html.escape(s, quote=True)
def strip_tags(s): return re.sub(r'<[^>]+>', '', s)

def human_date(iso):
    d = _date.fromisoformat(iso)
    return f"{d.strftime('%B')} {d.day}, {d.year}"

def ts(sec):
    h, m, x = sec // 3600, sec % 3600 // 60, sec % 60
    return f"{h}:{m:02d}:{x:02d}" if h else f"{m:02d}:{x:02d}"

def a(href, text):
    if href.startswith('/'): return f'<a href="{href}">{text}</a>'
    return f'<a href="{href}" target="_blank" rel="noopener">{text}</a>'

def load_sessions():
    out = []
    for jf in sorted((HERE/'sessions').glob('*.json')):
        n = json.loads(jf.read_text())
        n['body'] = jf.with_suffix('.html').read_text()
        n['url'] = f"/session-notes/{n['slug']}"
        n['img'] = f"/assets/session-notes/{n['slug']}.jpg"
        out.append(n)
    return sorted(out, key=lambda n: n['date'], reverse=True)

def ld_json(d): return '<script type="application/ld+json">' + json.dumps(d, ensure_ascii=False) + '</script>\n'

def article_ld(n):
    d = {"@context": "https://schema.org", "@type": "Article", "headline": f"{n['series']}: {n['title']}", "description": strip_tags(n['summary']),
         "datePublished": n['date'], "url": f"https://codeorange.dev{n['url']}", "image": f"https://codeorange.dev{n['img']}",
         "author": {"@type": "Organization", "name": "Code Orange Dev School", "url": "https://codeorange.dev"},
         "publisher": {"@type": "EducationalOrganization", "name": "Code Orange Dev School", "url": "https://codeorange.dev"}}
    if n.get('video'):
        d["video"] = {"@type": "VideoObject", "name": f"{n['series']}: {n['title']}", "description": strip_tags(n['summary']), "uploadDate": n['date'],
                      "thumbnailUrl": f"https://codeorange.dev{n['img']}", "embedUrl": f"https://www.youtube-nocookie.com/embed/{n['video']}",
                      "contentUrl": f"https://www.youtube.com/watch?v={n['video']}"}
    return ld_json(d)

def resource_li(r):
    t = a(r['url'], r['title']) if r.get('url') else r['title']
    extra = ', '.join(x for x in [r.get('by')] if x)
    s = t + (f", {extra}" if extra else '') + (f": {r['note']}" if r.get('note') else '')
    return f'        <li>{s}</li>\n'

def resources_html(n):
    groups = {}
    for r in n.get('resources', []): groups.setdefault(r['group'], []).append(r)
    out = '      <h2>Resources shared</h2>\n'
    for g, items in groups.items():
        out += f'      <h3>{g}</h3>\n      <ul>\n' + ''.join(resource_li(r) for r in items) + '      </ul>\n'
    if n.get('ideas'): out += f'      <p>{n["ideas"]}</p>\n'
    out += '      <p><a href="/resources">Browse every resource from every session &rarr;</a></p>\n'
    return out

SCRIPT = '''<script>document.querySelectorAll('[data-copy]').forEach(function(b){b.addEventListener('click',function(){navigator.clipboard&&navigator.clipboard.writeText(b.dataset.copy).then(function(){b.textContent='Link copied';});});});
(function(){var v=document.getElementById('video');if(!v)return;function play(t){v.innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/'+v.dataset.yt+'?autoplay=1&rel=0&start='+(t||0)+'" title="Session recording" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';}v.querySelector('button').addEventListener('click',function(){play(0);});document.querySelectorAll('.chapters a[data-t]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();play(a.dataset.t);v.scrollIntoView({behavior:'smooth',block:'center'});});});})();</script>'''

def recap_page(n):
    url, title = n['url'], f"{n['series']}: {n['title']} - Session Notes"
    words = n['title'].rsplit(' ', 1)
    h1 = f'{words[0]} <span class="orange">{words[1]}.</span>' if len(words) == 2 else f'<span class="orange">{words[0]}.</span>'
    pills = [f'<span class="pill orange">{n["series"]}</span>', f'<span class="pill"><time datetime="{n["date"]}">{human_date(n["date"])}</time></span>']
    if n.get('host'): pills.append(f'<span class="pill">Hosted by {n["host"]}</span>')
    if n.get('minutes'): pills.append(f'<span class="pill">{n["minutes"]} min read</span>')
    if n.get('video'): pills.append('<a class="pill" href="#video" style="text-decoration:none">&#9654; Recording</a>')
    page = head(title, esc(strip_tags(n['summary'])), url, 'article',
                f'<meta property="article:published_time" content="{n["date"]}">\n' + article_ld(n), n['img'], esc(f"{n['series']}: {n['title']}"))
    page += hero(f'<a href="/session-notes" style="text-decoration:none">/Session-notes</a>/{n["date"]}_', h1, n['summary'],
                 '\n        <p class="note-meta">' + ''.join(pills) + '</p>')
    page += '  <article class="article-wrap">\n'
    if n.get('video'):
        page += f'''    <div class="video" id="video" data-yt="{n['video']}"><img src="{n['img']}" alt="{esc(n['series'] + ': ' + n['title'])}" width="1200" height="630"><button type="button" aria-label="Play the session recording"><span class="play"></span></button></div>
    <p class="video-note">Full recording{', ' + n['duration'] if n.get('duration') else ''}. Plays from youtube-nocookie.com. <a href="https://www.youtube.com/watch?v={n['video']}" target="_blank" rel="noopener">Watch on YouTube</a></p>
'''
        if n.get('chapters'):
            lis = ''.join(f'<li><a href="https://www.youtube.com/watch?v={n["video"]}&amp;t={t}s" data-t="{t}"><time>{ts(t)}</time><span>{label}</span></a></li>' for t, label in n['chapters'])
            page += f'    <details class="chapters"><summary>Jump to a chapter <span style="color:var(--dim);font-weight:500">({len(n["chapters"])} chapters)</span></summary><ol>{lis}</ol></details>\n'
    else:
        page += f'    <figure class="article-figure note-figure"><img src="{n["img"]}" alt="{esc(n["series"] + ": " + n["title"])}" width="1200" height="630"></figure>\n'
    page += '    <div class="prose">\n'
    if n.get('tldr'):
        page += '      <div class="tldr">\n        <p class="eyebrow">TL;DR</p>\n        <ul>\n' + ''.join(f'          <li>{x}</li>\n' for x in n['tldr']) + '        </ul>\n      </div>\n\n'
    page += n['body'] + '\n' + resources_html(n) + '    </div>\n'
    if n.get('next'):
        page += f'''    <aside class="next-card"><div><p class="eyebrow">Next session</p><h3>{n['next']['title']}</h3><p>{n['next']['when']}</p></div><div class="cta-row"><a class="button small" href="/calendar">See the calendar</a><a class="ghost small" href="{DISCORD}" target="_blank" rel="noopener">Join Discord</a></div></aside>\n'''
    share = urllib.parse.quote(n.get('share_text') or f"{n['series']}: {n['title']} - notes from @CodeOrangeDevs", safe='')
    page += f'''    <div class="share-row"><strong>Share these notes:</strong><a href="https://x.com/intent/post?text={share}&amp;url={urllib.parse.quote('https://codeorange.dev' + url, safe='')}" target="_blank" rel="noopener">Post on X</a><button type="button" data-copy="https://codeorange.dev{url}">Copy link</button></div>
    {SCRIPT}
    <p class="source-box">These notes are also on GitHub: {a(f"{REPO}/blob/main/{n['date'][:4]}/{n['slug']}.md", "code-orange-dev/session-notes")}. Free to share and reuse (CC0).</p>
  </article>
''' + final_cta
    return page

import urllib.parse

def list_page(sessions):
    cards = ''.join(f'''      <a class="article-card" href="{n['url']}">
        <img src="{n['img']}" alt="" loading="lazy" style="object-position:left center">
        <div class="card-body">
          <span class="pill orange">{n['tag']}</span>
          <h3 style="margin-top:16px">{n['series']}: {n['title']}</h3>
          <p>{n['summary']}</p>
          <div class="meta"><span class="pill"><time datetime="{n['date']}">{human_date(n['date'])}</time></span>{f'<span class="pill">Hosted by {n["host"]}</span>' if n.get('host') else ''}{'<span class="pill">&#9654; Recording</span>' if n.get('video') else ''}</div>
        </div>
      </a>
''' for n in sessions)
    desc = 'Short recaps of Code Orange Dev School sessions: highlights, key takeaways and every resource shared on the call.'
    page = head('Session Notes - Code Orange Dev School', desc, '/session-notes',
                extra=ld_json({"@context": "https://schema.org", "@type": "CollectionPage", "name": "Session Notes", "description": desc, "url": "https://codeorange.dev/session-notes"}))
    page += hero('/Session-notes_', 'Session <span class="orange">notes.</span>',
                 'Short recaps of our sessions: one or two highlights, the key takeaways, and every resource shared on the call.',
                 f'\n        <p class="note-meta"><a class="pill orange" href="/resources" style="text-decoration:none">Resource library &rarr;</a><a class="pill" href="{REPO}" target="_blank" rel="noopener" style="text-decoration:none">Also on GitHub &rarr;</a></p>')
    page += f'  <section class="section-inner" style="padding-top:56px">\n    <div class="article-list">\n{cards}    </div>\n  </section>\n' + final_cta
    return page

def resources_page(sessions):
    by_url = {}
    for n in sorted(sessions, key=lambda n: n['date']):
        for r in n.get('resources', []):
            key = r.get('url') or strip_tags(r['title'])
            e = by_url.setdefault(key, dict(r, sessions=[]))
            e['sessions'].append(n)
    topics = {}
    for e in by_url.values(): topics.setdefault(e['topic'], []).append(e)
    order = [t for t in TOPIC_ORDER if t in topics] + sorted(t for t in topics if t not in TOPIC_ORDER)
    def card(e):
        src = ' &middot; '.join(f'<a href="{n["url"]}">{n["series"]}, {human_date(n["date"])}</a>' for n in e['sessions'])
        desc = ', '.join(x for x in [e.get('by'), e.get('note')] if x)
        text = esc(strip_tags(e['title'] + ' ' + desc + ' ' + e['topic'])).lower()
        inner = f'<strong>{e["title"]}</strong>' + (f'<p>{desc[0].upper() + desc[1:]}</p>' if desc else '<p></p>') + f'<small>Shared in: {src}</small>'
        if e.get('url'):
            ext = '' if e['url'].startswith('/') else ' target="_blank" rel="noopener"'
            # the session link sits inside the card, so the card is a div with an overlay link
            return f'<div class="res" data-text="{text}" style="position:relative"><a href="{e["url"]}"{ext} style="position:absolute;inset:0;z-index:0" aria-label="{esc(strip_tags(e["title"]))}"></a>{inner}</div>'
        return f'<div class="res" data-text="{text}">{inner}</div>'
    groups = ''.join(f'''    <div class="res-group" data-topic="{esc(t)}">
      <h2>{t}</h2>
      <div class="res-grid">{''.join(card(e) for e in topics[t])}</div>
    </div>
''' for t in order)
    chips = '<button class="chip" type="button" aria-pressed="true" data-chip="">All</button>' + ''.join(f'<button class="chip" type="button" aria-pressed="false" data-chip="{esc(t)}">{t}</button>' for t in order)
    count = len(by_url)
    desc = f'Every book, article, tool and wallet shared in Code Orange Dev School sessions, in one searchable list ({count} so far).'
    page = head('Resource Library - Code Orange Dev School', desc, '/resources',
                extra=ld_json({"@context": "https://schema.org", "@type": "CollectionPage", "name": "Resource Library", "description": desc, "url": "https://codeorange.dev/resources"}))
    page += hero('<a href="/session-notes" style="text-decoration:none">/Session-notes</a>/resources_', 'Resource <span class="orange">library.</span>',
                 f'Every book, article, tool and wallet shared in our sessions, in one place. {count} resources from {len(sessions)} session{"s" if len(sessions) != 1 else ""} so far.',
                 '\n        <p class="note-meta"><a class="pill" href="/session-notes" style="text-decoration:none">&larr; All session notes</a></p>')
    page += f'''  <section class="section-inner" style="padding-top:48px">
    <div class="res-tools"><input type="search" id="res-q" placeholder="Search resources, e.g. Lightning, wallet, Schneier" aria-label="Search resources">{chips}</div>
{groups}    <p class="res-empty" id="res-empty" hidden>Nothing matches that search yet.</p>
  </section>
  <script>(function(){{var q=document.getElementById('res-q'),topic='';function run(){{var s=q.value.trim().toLowerCase(),any=false;document.querySelectorAll('.res-group').forEach(function(g){{var shown=0;g.querySelectorAll('.res').forEach(function(r){{var ok=(!topic||g.dataset.topic===topic)&&(!s||r.dataset.text.indexOf(s)>-1);r.hidden=!ok;if(ok)shown++;}});g.hidden=!shown;if(shown)any=true;}});document.getElementById('res-empty').hidden=any;}}q.addEventListener('input',run);document.querySelectorAll('[data-chip]').forEach(function(c){{c.addEventListener('click',function(){{topic=c.dataset.chip;document.querySelectorAll('[data-chip]').forEach(function(x){{x.setAttribute('aria-pressed',x===c);}});run();}});}});}})();</script>
''' + final_cta
    return page

def write(rel, text):
    p = site / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)
    mirror = site / rel.replace('.html', '/index.html')
    mirror.parent.mkdir(parents=True, exist_ok=True)
    mirror.write_text(text)

sessions = load_sessions()
for n in sessions:
    if not (site / n['img'].lstrip('/')).exists():
        raise SystemExit(f"Missing share image {n['img']}: run tools/session-notes/make-image.js first")
    write(f"session-notes/{n['slug']}.html", recap_page(n))
write('session-notes.html', list_page(sessions))
write('resources.html', resources_page(sessions))

sm = site / 'sitemap.xml'
xml = sm.read_text()
for path in ['/session-notes', '/resources'] + [n['url'] for n in sessions]:
    loc = f'<loc>https://codeorange.dev{path}</loc>'
    if loc not in xml:
        xml = xml.replace('</urlset>', f'  <url>\n    {loc}\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n</urlset>')
sm.write_text(xml)
print(f"Built {len(sessions)} session page(s), session-notes, resources")
