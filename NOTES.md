# Backstory: working notes

Decisions and current state, so a future session can pick up where we left off.
Read `BRIEF.md` for the original brief and `GUIDE.md` for the owner's step-by-step instructions.

## Status (28 Oct 2026)

- **Topic maps added** (branch `claude/loving-heisenberg-y8hp8s`): a standalone, deeper version of the question
  graph for a whole subject, at `/maps/<slug>/` (index at `/maps/`, "Maps" in the nav). First map: Singapore's
  education system (3 categories, 63 questions, 60 sources, no article), drawn as a left-to-right tree. Then
  maps for AI and jobs (issue 008) and ageing (issue 004), linked both ways with their issues. See "Topic maps".

## Status (26 Oct 2026)

- **Question graph added** (branch `claude/clever-carson-2a0amt`): an interactive graph of the questions a reader
  would ask about each issue, at the top of every issue page and as the opening band of the homepage. All six
  (001–006) have graphs. See "Question graph" below.

## Status (23 Oct 2026)

- Site renamed to But Why? and About page rewritten in the owner's words (owner: Thaddeus).
- Site merged to `main` (PR #1) and live on Vercel. Owner checked the photos on the live site: they look good.
- Automation steps 1 to 3 (topic queue, checker, write-issue skill) are built; see "Automation plan".
- Both issues converted. Every word, link and source was checked against the original HTML by script:
  issue 001 has 16 sections, 64 external links and 47 sources; issue 002 has 18 sections, 45 links and 35 sources.
  Only intentional differences remain (see "Conversion" below).
- Photos download from Wikimedia Commons during each Vercel build. The cloud environment used for these
  sessions could not reach Wikimedia, so photos can't be previewed or checked from inside a session yet.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Length and policy section | No word target: a full read must take 40 minutes at most (`check-issue` caps the body at 8,000 words, 200 a minute). Every issue needs a section on what the story means for policymakers; the checker warns if no heading mentions policy or government. | Owner's choice (23 Oct 2026). |
| Name | **But Why?**, slogan *there is always more to the story* (renamed from Backstory on 23 Oct 2026). Lives in `src/lib/site.ts`. The repo, Vercel project and file names still say backstory. | Owner's choice. |
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
| Question graph | d3-force + d3-zoom + d3-drag drawn as SVG (not canvas libraries such as force-graph or Cytoscape). One `NNN-slug.graph.json` per issue, next to it. | SVG nodes are real focusable elements (keyboard, screen readers) styled by the site's CSS variables, so dark mode and track colours just work; about 24KB gzipped, loaded only when the graph scrolls into view. |
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
docs/graph-template.json      copy this to start an issue's question graph
src/content/issues/*.graph.json  one question graph per issue (questions, answers, sources, section ids)
src/components/graph/         QuestionGraph.astro (list + panel markup) and graph.ts (the interactive graph)
src/lib/graph.mjs             graph rules + anchor ids, shared by the build and check:issue
src/styles/qmap.css           question graph styles
topics/queue.md               upcoming topics + published log (owner edits on GitHub)
scripts/next-issue.mjs        `npm run next`: next number, track, date (SGT) and queued topic
scripts/check-issue.mjs       `npm run check:issue`: checks a new issue against the brief's rules
.claude/skills/write-issue/   the step-by-step instructions Claude follows to write an issue and open a PR
```

## Topic maps

Owner's idea (28 Oct 2026): the question graph, but with many more branches and sub-branches, for a whole topic
rather than one issue, as a research tool. No article is written for a map; each box carries its own summarised
answer and sources. Gamification (progress, badges) was tried and removed at the owner's request: they will design
it themselves first.

- **Structure:** subject → categories → topics or news stories → questions → follow-ups. The education map has
  three categories: `basics` (how it works), `ideas` (big ideas and debates, the policy lens) and `news` (recent
  changes, newest first). Every news story must open with the same four questions, in order: `why`, `what`, `who`,
  `means` (enforced by the build); extra questions go after them.
- **Data:** one `src/content/maps/<slug>.json` per map with `categories`. Every node has `id`, `label` (≤34 chars,
  the text on the box), `question`, `answer` (paragraphs, 60–220 words), `sources` (1–4) and `children`. Questions
  (below topics) need a `type` (`basics`, `why`, `what`, `who`, `means`, `debate`); news stories have a `when`.
  Optional `related` ids (listed both ways under "Connected ideas" in the answer panel) and `issue` (link to a But
  Why? issue). Rules in `src/lib/topicmap.mjs`; a map that breaks them stops the build.
- **Layout (owner chose it over the circle, 28 Oct 2026):** a left-to-right tree of boxes with curved connectors.
  Columns by depth; each box is centred on the boxes it opens into; text is wrapped with real font measurements.
  Only one path is open at a time (opening a box folds its siblings). Clicking a box opens its answer and unfolds
  it; the round button on its right edge only folds/unfolds. Arrow keys fold and unfold too. "Open everything"
  grows the map to the tree's full height so the page scrolls through it like an outline (the answer panel follows
  the reader down). Colour by category (slate, teal, track colour); the stripe and small caps tag on a question
  show its type; the "Highlight" chips light up one type across the whole map.
- **Code:** `src/components/topicmap/` (TopicMap.astro, MapItem.astro for the nested list, topicmap.ts for the
  tree), `src/styles/topicmap.css` (builds on qmap.css), `src/pages/maps/`.
- **Maps and daily issues are linked (28 Oct 2026):** maps are the long-term backbone (one per "beat"), daily
  issues plug into them as news stories. A box's `issue` field links it to an issue. Each issue page then shows a
  "Where this fits" strip at the top (map › category › story, plus up to three "New to this? Start with" background
  boxes, taken from the story's `related` background ids, then the map's basics topics), and the homepage links
  today's issue to its map. Logic: `getPlacement` in `src/lib/topicmap-data.ts` (prefers a news story over a
  passing mention). Links like `/maps/<slug>/#<box-id>` open the map at that box, and the address updates as the
  reader opens boxes. Maps so far: Singapore's education system (no issue yet), AI and jobs in Singapore (issue
  008) and Singapore's ageing society (issue 004); the last two were built only from those issues' sources.
- **Next step (not built):** have the write-issue skill add or update a story on the matching map with each new
  issue, so maps grow daily. Until then, link new issues by hand with the `issue` field.
- **Sources:** unlike issue graphs, a map's sources are not checked against an article (there isn't one). The
  education map's answers were written from web research on 28 Oct 2026; some pages (moe.gov.sg,
  schoolbag.edu.sg) could not be opened from the cloud session and were cited from search results.

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

`<Why>`, `<Answer>` and `<Debate>` get stable ids from their titles (`why-…`, `answer-…`, `debate-…`, see
`anchorId` in `src/lib/graph.mjs`), so links can jump to a specific block. Changing a title changes its id.

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

1. Done: merged and deployed; photos reviewed by the owner.
2. Add a Grace Fu portrait if a free one turns up.
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
1. **Done.** `topics/queue.md`: "Up next" lines like `- world: Topic -- note`, and a "Published" log
   (`- NNN | track | Title | date`). `npm run next` reads it plus the issue files and prints the next number,
   track (alternates from the last issue), today's SGT date and the first queued topic for that track (or null,
   meaning "pick the day's biggest story"). Starter queue has two Singapore topics from the brief's examples
   (BTO housing, healthcare); no World topics, because current world news should be chosen on the day.
2. **Done.** `npm run check:issue` (scripts/check-issue.mjs). By default checks issues changed vs `origin/main`
   (else the newest). Errors: frontmatter fields, file name/number, number = previous + 1, date order, readTime
   <= 30, "AI-researched" in `about`, leftover template text, Overview first, Sources last with links, required
   sections (disagree / what to watch / key terms / go deeper), Debate has 2 sides, unknown components, lines
   starting with `>`, broken `#anchors`, body > 6,000 words before Sources, Commons files missing or non-free.
   Warnings: same track twice, 6–8 stats, missing Timeline/WhyList/Answer, < 15 sources, length outside
   4,000–5,000, readTime mismatch, Singapore-specific asides, Commons unreachable. `--offline`, `--links`.
   Issue 001 fails the length rule (7,011 words); it's grandfathered because the default mode only checks new
   or changed issues.
3. **Done.** Repo skill `.claude/skills/write-issue/SKILL.md`: the old account-level `backstory-issue`
   skill's research and writing rules, plus the repo workflow (npm run next, template, photos, queue update,
   checker, build, PR, never merge). The account-level `backstory-issue` skill (synced from claude.ai, can't be
   edited from a session) still says "publish as an HTML artifact"; the owner should update or remove it so it
   doesn't compete (replacement text in GUIDE.md section 10).
4. **Owner action next.** Allow `en.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org` in the cloud
   environment's network settings so research and photo checks work.
5. Run it by hand for a few days ("write today's issue"), review quality, then create the daily scheduled task:
   fresh session each run, about 5am SGT so the PR is ready by 6am, prompt = "Use the write-issue skill to write
   today's Backstory issue and open a pull request."

## Question graph

- **What it is:** the story's headline (with its hero photo) in the centre, 6–10 questions around it, up to 3
  follow-ups per question. Clicking a question opens a panel (bottom sheet on phones) with a short answer, 2–4
  sources and a "Read this in today's issue" link to the section that covers it; the section briefly highlights
  when you land. Graph/List toggle (remembered per browser); without JavaScript the list shows.
- **Where:** first thing on every issue page, and the homepage's opening "Today" band (headline, issue number and summary beside the graph on wide screens; headline, graph, then summary on phones). The old homepage cover only shows if the latest issue has no graph.
- **Interaction:** force layout that settles then drifts slowly (static for readers who turn off motion); drag nodes; mouse
  drag to pan, Ctrl/⌘ + scroll or the +/− buttons to zoom; on touch, one finger scrolls the page and two fingers
  pan/pinch so readers never get trapped; Tab/Enter/Esc for keyboard. Follow-up labels are hidden on phones until
  their question is highlighted.
- **Grounding rules** (enforced by `src/lib/graph.mjs` in both `npm run check:issue` and the build): every source
  URL must appear in the issue; every `section` must be a real heading or titled block; 6–10 questions, 0–3
  follow-ups, 2–4 sources, 60–220-word answers, labels of 34 characters or fewer. A new issue without a graph
  fails the checker; an issue without a graph still builds (the graph simply doesn't show).
- **Backfill (26 Oct 2026):** graphs for 001–006 were written from each issue's own text. Sources were matched to
  answers using the issue's attributions and the source titles; the source pages were not re-opened to confirm
  each claim.

## Designed for, not built yet

- **Daily automation and topic queue**: see "Automation plan" above.
- **Newsletter**: RSS already exists (`/rss.xml`); most newsletter tools can send from RSS. A sign-up box would go
  in `Base.astro` footer.
- **Personalised topics**: would need accounts or local preferences; not started.
