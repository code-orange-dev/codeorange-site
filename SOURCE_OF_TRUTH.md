# Code Orange Website — Handoff Guide

## Source of truth

- GitHub repository: `https://github.com/code-orange-dev/codeorange-site`
- Branch: `main`
- Production website: `https://codeorange.dev`
- Hosting: Vercel

`main` is the authoritative source. Pushing a reviewed change to `main` automatically deploys it to production through the linked Vercel project.

## Current status

The site was last updated on 2026-09-26. The repository working tree was clean after the latest deployment.

Recent completed work includes:

- Homepage workshop gallery, event links, and direct Google Calendar subscription CTA.
- Homepage calendar directly below the hero.
- Agentic Engineering workshop rename, including a redirect from `/programs/openclaw`.
- Fellowship card layout and current $512 / $256 monthly pricing.
- Funding/grant/sponsor language removed from public website copy; program copy says sessions are free of charge.
- Homepage hero video is `/assets/co-hero-agentic.mp4`; the old hero video was removed.
- Homepage SEO metadata, schema, image loading, and mobile layout refinements.

## Where to edit

- Homepage: `index.html`
- Calendar page: `calendar.html` and `calendar/index.html` (keep these two files identical)
- Application page: `apply.html` and `apply/index.html` (keep these two files identical)
- Fellowship page: `fellowships.html` and `fellowships/index.html` (keep these two files identical)
- Other clean-URL pages commonly have both `page.html` and `page/index.html`. **Edit `page.html`** (with `cleanUrls`, that's the file Vercel serves) and run `node tools/generate-pages.mjs` to copy it to `page/index.html`.
- Public assets: `assets/`
- Deployment configuration and legacy redirects: `vercel.json`

The production homepage is maintained directly in `index.html`. `home.dc.html` and `tools/prerender-homepage.mjs` are older source templates: do not regenerate the homepage blindly, because a regeneration can overwrite newer production edits. The prerender script now refuses to write unless given `--overwrite-static-homepage`. Compare generated output with `index.html` first and preserve all current live functionality.

## Safe workflow

1. Pull or clone this repository and work from its root.
2. Check `git status` before editing; preserve unrelated changes.
3. Edit the listed source files. Then run `node tools/generate-pages.mjs`: it copies every `page.html` to `page/index.html` and rebuilds `sitemap.xml` from the pages on disk, leaving out alias pages whose canonical URL points elsewhere (like `/programs/openclaw`). It does not regenerate page content; its old templates only run with `--legacy-templates`, which would overwrite hand edits and reintroduce retired copy.
4. Check `git diff --check` and test relevant pages locally.
5. Commit a focused change and push it to `main`.
6. Verify the production page with `curl -L https://codeorange.dev` after Vercel completes deployment.

## Important product rules

- Do not reintroduce funding, grant, donation, sponsor, or funder messaging in public copy.
- Describe programs as “free of charge for everyone joining.”
- Use “Agentic Engineering,” not “OpenClaw.” Keep the old URL redirect in `vercel.json`.
- Keep the homepage hero video lazy/non-preloaded and retain the lightweight mobile image fallback.
- Do not invent event dates, testimonials, outcomes, partners, or claims. Use the public calendar and GitHub sources.
- The Google Calendar subscription URL is intentionally used in the homepage and calendar CTAs; preserve it when editing calendar UI.
