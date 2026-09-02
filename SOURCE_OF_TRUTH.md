# Code Orange Website Source of Truth

Canonical local source folder:

`/Users/pet/Documents/New project 4/codeorange-site`

Canonical production site:

`https://codeorange.dev`

Known good Vercel deployment provided by the owner:

`https://codeorange-biuzd7s2i-codeorangedevs-7554s-projects.vercel.app`

Current live baseline for future work:

- Verified on `2026-09-02 11:45:25 WITA`
- Production URL: `https://codeorange.dev`
- Vercel deployment URL: `https://codeorange-lla5bbnru-codeorangedevs-7554s-projects.vercel.app`
- Live homepage SHA-256: `50895571f7a3cce93403397d7f2d06a255704fd4ee68cc2010fd13845356f609`
- Local deploy homepage SHA-256: `e049e3b45f22f1e66c8328ad99cc3bf3a50743c1b19cdf9a663497af9f12687f`

The live and local homepage hashes can differ by Vercel delivery formatting, but the deployed markers must match: Google Calendar embed, latest workshop background images, footer video, and no footer program list.

Latest optimized deployment:

- Verified on `2026-09-02`
- Vercel deployment URL: `https://codeorange-1lg0dc6kq-codeorangedevs-7554s-projects.vercel.app`
- Production URL: `https://codeorange.dev`
- SEO/speed changes included: canonical URLs, sitemap.xml, robots.txt, structured data, deferred scripts, lazy-loaded footer videos, compressed site images, long-lived asset cache headers, and a Vercel deploy ignore list for unused heavy media.

Current workflow:

1. Make website edits in this folder only.
2. Regenerate pages with `node tools/generate-pages.mjs` and `node tools/prerender-homepage.mjs --out .`.
3. Deploy from this folder with `npx -y vercel@50.28.0 deploy --prod`.

Do not use these older folders as the website source:

- `/Users/pet/Documents/New project 4/codeorange-live-site`
- `/Users/pet/Downloads/deploy`
- `/Users/pet/Downloads/github-push-4-copy/code-orange-dev`

GitHub status:

This folder is pushed to the dedicated website repository:

`https://github.com/code-orange-dev/codeorange-site`

Use this repository as the website source of truth going forward.
