# Backstory: working notes

Decisions and current state, so a future session can pick up where we left off.
Read `BRIEF.md` for the original brief and `GUIDE.md` for the owner's step-by-step instructions.

## Status (22 Oct 2026)

- Site built and pushed to branch `claude/backstory-website-build-7x0ic8`. Not merged to `main` yet, not deployed yet.
- Both issues converted. Every word, link and source was checked against the original HTML by script:
  issue 001 has 16 sections, 64 external links and 47 sources; issue 002 has 18 sections, 45 links and 35 sources.
  Only intentional differences remain (see "Conversion" below).
- **Photos are wired up but not downloaded yet.** The build environment for this session could not reach
  Wikimedia (commons.wikimedia.org and upload.wikimedia.org were blocked by its network policy). Photos download
  automatically when the site builds on Vercel. Nobody has looked at the real photos yet: check them after the
  first deploy.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Design direction | **Daybreak**, chosen by the owner from three options. The other two were "Briefing room" (data-forward, Schibsted Grotesk + Literata, grey-green and saffron/teal) and "Cover story" (photographic magazine, Archivo + Newsreader, indigo/coral). | Owner may revisit later; all colours and fonts live in `src/styles/tokens.css`. |
| Fonts | Bricolage Grotesque (headlines, variable width axis used for condensed display) + Source Serif 4 (body). Self-hosted via Fontsource npm packages. | Distinctive headline face, very readable body; no Google Fonts request. |
| Colours | Paper `#f5f7fa`, ink navy `#14213d`. World = ultramarine `#2b44d6`, Singapore = Singapore red `#d21f3c`. Dark mode is night-sky navy `#0f1830`. | Clear track difference; avoids cream/terracotta and black/neon clichés. |
| Signature element | Giant issue number in the track colour, headline overlapping it with a paper-coloured halo. | The one bold move; everything else stays quiet. |
| Generator | Astro 7 (static output), MDX content collection. | Simplest Markdown-first option; free on Vercel. |
| Hosting | Vercel (free Hobby plan). `vercel.json` forces `npm run build` so photos are fetched. | Owner asked for Vercel. |
| Site address | `astro.config.mjs` uses `SITE_URL` env var if set, otherwise Vercel's production URL. | Custom domain later = add domain in Vercel + set `SITE_URL`. |
| Issue URLs | `/issues/<file-name>/`, e.g. `/issues/001-frances-autumn-of-anger/`. | Readable, stable, number first so files sort. |
| Section numbers | Every `##` heading is numbered automatically (01, 02...) and listed in the contents. "What is happening" is unnumbered. | The issue text refers to "section 06" etc., so numbers must match heading order. |
| Images | Only Wikimedia Commons, referenced by exact file name. `scripts/fetch-images.mjs` pulls the image plus author/licence from the Commons API, so credits are never typed by hand. Non-free licences (NC/ND) are refused. A photo that hasn't been fetched simply doesn't render (dev mode shows a dashed placeholder). | Brief requires free licences and visible credits; avoids invented credits. |
| Social cards | Generated per issue at build time (`/og/<issue>.png`, satori + resvg), number + headline + track/date. | LinkedIn previews. |
| Extras | RSS at `/rss.xml`, sitemap, robots.txt, 404 page, light/dark toggle remembered per browser. | Cheap and useful. |

## Where things are

```
src/content/issues/*.mdx      one file per issue (frontmatter + body)
src/content.config.ts         the frontmatter rules (what fields an issue must have)
src/components/issue/         the reusable issue components (+ index.ts registers them)
src/styles/tokens.css         ALL colours, fonts, sizes: change the look here
src/styles/global.css         site-wide styles (masthead, cover, lists, pages)
src/styles/issue.css          issue page layout + component styles
src/pages/                    homepage, archive, about, issue pages, OG images, RSS
src/data/commons-images.json  written by the image script: file -> local path + credit
scripts/fetch-images.mjs      downloads Commons photos and credits (runs before every build)
docs/issue-template.mdx       copy this to start a new issue (it is tested to build)
```

## Components available in issue files

No imports needed; they are passed in globally by the issue page.

- `<Overview>` "What is happening", always first. First paragraph is shown larger.
- `<Numbers>` + `<Stat value="...">label</Stat>`: the "in numbers" grid (aim for 6–8).
- `<Timeline>` + `<Event date="..." turning>`: `turning` marks a turning point. Also used for history chronologies.
- `<Converge target="..." outcome="...">` + `<Flow label title>`: several causes meeting in one event (issue 001).
- `<WhyList>` + `<Why title="...">`: numbered layered causes (put blank lines around paragraphs inside).
- `<Answer title="...">`: highlighted plain-language conclusion.
- `<Sidenote term="...">`: margin note on wide screens, inline box on phones. Place it before the paragraph it explains.
- `<Chain>` wrapping a normal numbered Markdown list: cause-and-effect chain.
- `<Rows>` + `<Row label="...">`: "What to watch" (label = date) and option lists.
- `<Spectrum>` + `<Bloc position="left|centre|right" title>`: political blocs.
- `<Debate topic="...">` + two `<Side title>`: "Where reasonable people disagree".
- `<Quote cite="...">`: pull quote.
- `<Reads>` + `<Read href title>`, `<Concepts>` + `<Concept title>`: "Go deeper".
- `<KeyTerms>` + `<Term name>`: glossary.
- `<Sources>` wrapping a numbered Markdown list of links.
- `<SmallPrint>`: small note (e.g. where figures come from).
- `<ScaleBar>`: coloured scale with a marked value (the PSI chart in 002).
- `<Photo file alt caption wide>` and `<People>` + `<Person file name role>`: Commons photos with credits.

MDX gotchas found while building: a line that starts with `>` is read as a quote, so close multi-line component
tags at the end of a line (`]}>`), not on a new line. Escape `{ } < >` in plain text.

## Conversion of the original HTML issues

- Done by a one-off script (BeautifulSoup) so text was not retyped. Intentional changes:
  "Stream 1 · Youth" labels became "Youth"; list numbers are drawn by CSS; inline `<q>` became curly quotes;
  each debate topic label now appears once as a heading over its two sides; the `<em>` accent word in each
  headline was dropped (design choice).
- The TOC is generated from headings, so two TOC labels now match their headings exactly
  (e.g. "Further context: a country that argues in the street").
- Issue 001 is about 7,800 words including sources and reading lists, above the brief's 4,000–5,000 word body
  target. Kept as-is because the owner asked to keep everything; trim in a future edit if wanted.

## Photos chosen (unverified until first Vercel build)

Issue 001: hero `Manifestation lycéenne du 6 octobre 2026 à Paris 25.jpg`; Limoges town hall fire; Blois lycée
blockade; fuel price board (Vonnas, 2020); Assemblée nationale chamber; gilets jaunes acte V (Dec 2018);
portraits of Macron, Lecornu, Le Pen, Mélenchon.
Issue 002: hero `Kalimantan (Borneo) under thick smoke haze, August 2026.jpg`; burned peatland; burnt tree in
Central Kalimantan; NASA Borneo fires 2002; haze on Clemenceau Avenue (2015); portraits of Prabowo and Shanmugam.
File names came from web search results of Commons pages; exact names are in the `.mdx` files.

Missing: **no Grace Fu portrait** (no suitable Commons file found by search). After the first build, check the
Vercel build log for lines starting `images:` (not found / skipped licence) and look at every photo and crop.

## Open items / next steps

1. Owner: merge the branch and deploy on Vercel (see GUIDE.md).
2. After first deploy: review every photo, caption and crop; fix any `not found` file names; add Grace Fu if a
   free portrait exists. Optionally commit the downloaded images so builds don't depend on Commons.
3. Owner to confirm the About page wording (who runs it, contact/LinkedIn link, any review step before publishing).
   I removed claims I couldn't verify ("reviewed before publishing", "no advertising").
4. Future sessions that need photos locally: allow `commons.wikimedia.org` and `upload.wikimedia.org` in the
   cloud environment's network settings.

## Automation plan (agreed 22 Oct 2026, not built yet)

Owner's decisions:
- **Approve first.** Each run opens a pull request with the new issue; Vercel posts a preview link; the owner
  merges to publish. May switch to fully automatic later once quality is trusted.
- **Topics: queue + fallback.** `topics/queue.md` lists upcoming topics (owner edits it on GitHub). If empty,
  Claude picks the biggest story for that day's track. Tracks alternate World / Singapore.
- **Timing: ready by 6am Singapore time** daily (scheduled task starting ~5am SGT to allow for research).

Build order:
1. `topics/queue.md` (format + a few starter topics) and a "published" log so topics aren't repeated.
2. `scripts/check-issue.mjs` (`npm run check`): frontmatter valid, number = last + 1, track alternates,
   Overview first, body ≤ ~5,000 words, has Key terms / Go deeper / Sources, every Commons file exists and is
   free-licensed, site builds.
3. Update the `backstory-issue` skill (currently outputs standalone HTML) to write MDX using
   `docs/issue-template.mdx` and the editorial rules in BRIEF.md, then run the checker and open a PR.
4. Allow `en.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org` in the cloud environment's network
   settings (owner action) so research and photo checks work.
5. Run it by hand for a few days, review quality, then create the daily scheduled task
   (fresh session each run, branch `issue/NNN-slug`, PR to `main`).

## Designed for, not built yet

- **Daily automation and topic queue**: see "Automation plan" above.
- **Newsletter**: RSS already exists (`/rss.xml`); most newsletter tools can send from RSS. A sign-up box would go
  in `Base.astro` footer.
- **Personalised topics**: would need accounts or local preferences; not started.
