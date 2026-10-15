# Session notes builder

Builds codeorange.dev/session-notes (one page per recap), the list page, and /resources (every link from every session).

## Add a recap

1. `sessions/<YYYY-MM-DD-series>.json`: copy the newest one and edit. Fields: slug, date, series, title, host, tag, summary, share_text, minutes, video (YouTube id, optional), duration, tldr[], chapters [[seconds, label]], next {title, when}, resources [{group, topic, title, url, by, note}], ideas.
2. `sessions/<slug>.html`: the Highlights and Key takeaways body. Reuse the `viz` blocks (`flow`, `layers`, `q-grid`, `quote`) for diagrams.
3. Share image: `node tools/session-notes/make-image.js <slug> assets/event-cards/<photo>.jpg`
4. Build: `python3 tools/session-notes/build.py` (writes x.html and x/index.html, sitemap entries). A new resource topic goes in `TOPIC_ORDER`.
5. Check desktop and phone, push to main, confirm the Vercel deploy is READY.
6. Also add the markdown copy to github.com/code-orange-dev/session-notes (`YYYY/<slug>.md`, image in `YYYY/img/`, row in README).

Rules: credit hosts only, never attendees' Discord handles. Chapter times come from the transcript.
