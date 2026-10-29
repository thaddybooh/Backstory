---
name: write-issue
description: Write the next But Why? issue in this repo (a researched explainer of at most 40 minutes on one news story, World or Singapore) and open a pull request for Miles to approve. Use when Miles asks for a new But Why? issue or "today's issue", and for the daily scheduled run.
---

# Write the next But Why? issue

But Why? is Miles's daily explainer: one story in the news, because there is always more to the story. The reader should
finish with a real understanding of a current issue, not just the headlines. It is written for any member of
the public, anywhere, not specifically for Singaporeans.

The output is **one new MDX file** in `src/content/issues/`, its **question graph** (a `.graph.json` file next to
it), the issue's **news story on its topic map** (in `src/content/maps/`) and an updated `topics/queue.md`,
delivered as a
**pull request to `main`**. Miles reviews the Vercel preview and merges it to publish. **Never merge the pull
request yourself and never push to `main`.**

If this is the scheduled daily run, nobody is watching: don't ask questions, make sensible choices, and record
anything uncertain in the pull request description.

## 1. Set up

```sh
git fetch origin main
git checkout -B <branch> origin/main   # see "Branch" below
npm ci                                 # or npm install if node_modules is missing
npm run next                           # prints number, track, date and the queued topic
```

- **Branch**: if this session's instructions name a branch to work on, use that. Otherwise use
  `issue/NNN-short-title`.
- `npm run next` decides the issue **number**, **track** (alternates World / Singapore) and **date**
  (today in Singapore). Use them as given.
- **Topic**: if Miles named a topic in his request, use it (even if it breaks the alternation; then set the
  track to match). Otherwise use `topic` and `note` from `npm run next`. If `topic` is null, pick the most
  significant story of the last few days for that track: one with enough substance for a deep explainer, not
  already covered under "Published" in `topics/queue.md` in the last two months. A Singapore topic can be
  domestic policy (BTO housing, healthcare, CPF) or Singapore's place in a regional story (haze, Johor, ASEAN).

## 2. Research (do this first, thoroughly)

- Search current news first (use extended search mode for fast-moving stories), then official sources
  (governments, statistics agencies, central banks, courts), then analysis (think tanks, investigative outlets,
  academic explainers). Wikipedia is a useful map of a story, not a final source.
- Get hard numbers: scale, dates, money, polls, and who says what.
- Go past the surface. For every "X is happening because of Y", ask why Y exists: the structural, economic,
  political and historical causes. Miles explicitly wants the critical layer: is it corruption, incompetence,
  economics, incentives, institutional design? Who benefits? What constrains the government? Answer directly.
- Note where figures conflict (government vs organisers vs media) and say which you use.
- Keep a running list of every source (title, outlet, date, URL) as you go.
- Some websites may be blocked from the cloud environment. If a page won't open, use other reporting of the same
  facts rather than guessing what it says. Never cite something you haven't read.

## 3. Write the issue

Copy `docs/issue-template.mdx` to `src/content/issues/NNN-short-title.mdx` (lowercase, hyphens; NNN from
`npm run next`). The template shows every building block; `NOTES.md` lists what each component is for.

**Frontmatter**: fill every field. `about` must say the issue is AI-researched, give the date it was compiled,
and tell readers to check important facts against the sources. Add any caveat specific to the story (fast-
changing figures; "being named is not proof of wrongdoing" when companies or people are named).

**Length**: there is no word target. A reader who reads the whole issue should finish in about 30 to 40 minutes
at most (the checker counts about 200 words a minute, so roughly 8,000 words of body text excluding Sources is
the ceiling). Use the length the story needs; cut repetition and secondary examples before cutting explanation.
Set `readTime` to match (the checker warns if it is off).

**Structure** (adapt to the story; this is the default):

1. `<Overview>`: "What is happening". About 3 short paragraphs of plain narrative: who did what, where, how big
   (with figures), and the main reasons why. The reader must understand the event before seeing any numbers. If
   dramatic footage differs from the overall picture (riots vs mostly peaceful marches), say so.
2. `## ... in numbers` with `<Numbers>`: 6 to 8 key figures, each with a one-line label, then `<SmallPrint>`
   saying where they come from.
3. `## How ... unfolded` with `<Timeline>`: about 6 to 12 entries; mark the real turning points with `turning`.
4. Explanatory sections shaped to the story: the mechanism (how the thing actually works), the economics, the
   politics and institutions, the players and what they want, how the response is being handled. Use
   `<Sidenote>` to define terms the first time they appear, `<Chain>` for cause-and-effect sequences, `<Rows>`
   for options or playbooks, `<Spectrum>`/`<Converge>`/`<ScaleBar>` where they genuinely help.
5. A **"why" section** that answers the critical question underneath (why schools got this bad; why the
   government can't stop the fires): `<WhyList>` with numbered layers of causes, then `<Answer>` with the plain
   conclusion ("So is it X, Y or Z?").
6. **A policy section (required in every issue)**: what the story means for governments and policymakers.
   Name the policy problem, the real challenges and trade-offs (who bears the costs, what the tools are and why
   each is hard to use, what can and can't be done by one government alone), and what is actually on the table.
   For a Singapore issue this is usually a section on the Singapore government's options and playbook (see
   issue 002, "Singapore’s playbook at home" and "Dealing with a giant neighbour"); for a World issue, a section
   such as `## What this means for policymakers` (see issue 003). Analyse; don't advocate, and attribute any
   claim about what a government will do.
7. `## Where reasonable people disagree`: one or two `<Debate>`s, each with exactly two `<Side>`s giving the
   strongest form of each argument.
8. `## What to watch next`: `<Rows>` with dated events and indicators to watch.
9. `## Further context: ...`: history or background that helps but isn't essential. Short, near the end.
10. `## Key terms` (`<KeyTerms>`, about 8 to 10), `## Go deeper` (`### Start with these (Wikipedia)` with about 5
    `<Read>`s, `### Then read these articles` with about 5, `### Concepts worth learning properly` with about 4
    `<Concept>`s from economics or political science).
11. `## Sources` (always last): `<Sources>` wrapping a numbered Markdown list of every source as
    `[Title](url), Outlet, date`. Finish with a `<SmallPrint>` noting anything drawn from general knowledge.

Section headings are numbered automatically in order, so refer to other sections by number ("see section 06")
only after the structure is final, and link to them with `[section 06](#heading-slug)`.

**Writing rules**

- Plain, direct sentences. Explain every term the first time it appears.
- No analogies or asides aimed at Singaporeans specifically ("to someone from Singapore..."). Keep it universal.
- Be even-handed on contested politics: describe what each side actually says and does.
- When naming companies or people linked to wrongdoing, attribute the claim to the official body or report that
  made it, and say that being named is not proof.
- Don't overstate: hedge single-source claims, never invent figures or quotes.
- Use `<mark>` sparingly for the one or two sentences per section a skimming reader must not miss.

**MDX gotchas**: a line starting with `>` is read as a blockquote, so close multi-line component tags at the
end of a line (`]}>`), never on a line of their own. Escape `{ } < >` in plain text with a backslash. Put blank
lines around paragraphs inside `<Overview>`, `<Why>` and `<Answer>`.

## 4. Photos

Only freely licensed photos from **Wikimedia Commons**. Never use images from news sites or agencies.

- A hero photo (frontmatter `hero.commons`, with `alt` and `caption`), 3 to 5 scene photos (`<Photo>`), and
  portraits of the 2 to 4 key people (`<People>` + `<Person>`).
- Find real file names by searching with `allowed_domains: ["commons.wikimedia.org"]`. Prefer photos of the
  current events, then recent scene-setting photos, then older ones. Use the exact file name from the Commons
  page title (after `File:`).
- Captions must be accurate about what the photo shows and when it was taken. If a photo is older than the
  story, say so in the caption ("photographed in 2020").
- Don't write credits: the build fetches author and licence from Commons. The checker rejects files that don't
  exist or aren't free.

## 5. Build the question graph

Every issue has a question graph: the story in the middle, the questions a curious reader would ask about it
around it, and follow-ups off some of them. It is shown at the top of the issue page and on the homepage. Write it
**after** the issue is final, because it points into the issue's sections.

Copy `docs/graph-template.json` to `src/content/issues/NNN-short-title.graph.json` (same name as the issue, with
`.graph.json` instead of `.mdx`) and set `issue` to the file name without the extension.

- **6 to 10 questions**, the ones a curious reader would most likely ask: why now, who gains and who loses, what
  happened last time, what it means for ordinary people, what the root causes are, what governments can do, and
  the questions specific to this story. Order them roughly as a reader would ask them.
- **0 to 3 follow-ups** per question, only where they add something (a deeper "why", the other side of a debate).
  Follow-ups have no follow-ups of their own.
- `label`: the short text on the node, at most 34 characters (e.g. "Who gains, who loses?"). `question`: the full
  question, ending with `?`. `id`: lowercase words joined by hyphens, unique in the file.
- `answer`: one or two paragraphs, 60 to 220 words in all, in the issue's critical, root-causes style: answer
  directly, then say why. **Use only what the issue itself says.** No new facts, figures or quotes. If the issue
  can't answer a question well, drop the question rather than guess.
- `sources`: 2 to 4 per answer, each with `title`, `publication` and `url`. **Copy URLs exactly from the
  issue's Sources list or reading lists.** Never add a link the issue doesn't cite. Pick the sources the issue
  attributes those facts to ("according to Reuters", "CBC calculated"), or whose titles cover them.
- `section`: the id of the part of the issue that covers the question, so "Read this in today's issue" lands in
  the right place. Use a heading's id (`## Why did Meta settle?` becomes `why-did-meta-settle`), or the more
  precise id of a titled block: `why-` + the slugged `<Why title>`, `answer-` + the slugged `<Answer title>`, or
  `debate-` + the slugged `<Debate topic>` (e.g. `<Why title="The cost was affordable">` becomes
  `why-the-cost-was-affordable`).

`npm run check:issue` checks all of this: a missing graph, a link the issue doesn't cite, or a section that
doesn't exist is an ERROR, and the build refuses such a graph too.

## 6. Add the issue to its topic map

Topic maps (`src/content/maps/<slug>.json`, shown at `/topics/<slug>/`) are the long-term backbone: one per beat,
and every daily issue joins one as a news story. The issue page then shows "Where this fits" and the homepage
puts that map first. Do this **after** the question graph, from the same finished issue.

**Pick the map.** Read the `title`, `track` and `dek` of every map in `src/content/maps/`. Use the map whose beat
the story most belongs to (an issue on school phone bans goes on the education map; one on CPF payouts goes on the
ageing map). A map's track doesn't have to match the issue's if the subject clearly fits.

**If no map fits, start one** for the beat, named for the lasting subject rather than this week's event (e.g.
`energy-and-oil.json` "Oil, energy and the world economy", not "The Iran war energy shock"). Copy the top-level
fields from an existing map (`title`, `track`, `updated`, `dek`, `intro`, `cover`, `categories`) and give it two
categories: `basics` (`"kind": "basics"`, with 2 to 4 topics explaining how the underlying system works, drawn
from the issue's mechanism and background sections, each with 1 to 3 `basics` or `why` questions) and `news`
(`"kind": "news"`, holding this issue's story). Add `ideas` or `policy` categories only if the issue gives enough
material for at least two topics in them. The `cover` can reuse the issue's hero photo. Say in the pull request
that you started a new map.

**Add the story** as the first child of the map's `news` category (stories run newest first). Use
`rung-warning` in `src/content/maps/ai-and-jobs.json` as the model:

- `id` (unique in the map), `label` (at most 34 characters: the event, e.g. "Leaders warn on the ‘bottom rung’"),
  `when` (e.g. `"Oct 2026"`), `question` (ending in `?`), `answer` (60 to 220 words: what happened, with the key
  figures), `sources` (1 to 4), and `"issue": "NNN-short-title"`.
- `children`: the four questions every story opens with, **in this order**, with these `type`s: `why` ("Why
  now?"), `what` ("What's changing?"), `who` ("Who does it affect?"), `means` ("What does it mean?"). Then, if the
  issue supports them, up to 3 more (`debate` for "Where reasonable people disagree", or a second `why` for the
  deeper cause). Each child can have its own children, typed the same way.
- `related`: ids of the map's existing background boxes (basics, ideas or policy topics) a reader new to the
  subject should open first. The first ones become the issue page's "New to this? Start with" links, so pick the
  most useful two or three. If the issue covers a government initiative that has a box in the `policy` category,
  relate to it.
- If the issue has two or three separate developments (a policy change and a court case, say), add each as its
  own story with the same `issue`, newest first. Never put the same issue's stories on two different maps.

**Same rules as the question graph**: use only what the issue says, and copy every source URL exactly from the
issue's Sources list or reading lists. Answers are short versions of the issue's own explanation, not new
research.

**Update the rest of the map**:

- If the map already has a box for this development (a story added by hand without `issue`, or an initiative in
  `policy`), update that box with the issue's newer facts and add `"issue"` to it instead of adding a duplicate.
- If the issue changes a fact stated elsewhere in the map (a new figure, a scheme that has ended), correct that
  box and say so in the pull request.
- Set the map's `updated` to the issue's date.

`npm run check:issue` errors if no map links the issue, if a story cites a link the issue doesn't, or if any map
breaks the build's rules (ids, label length, answer length, the four story questions, `related` ids).

## 7. Update the topic queue

In `topics/queue.md`, remove the topic's line from "Up next" (if it came from the queue) and add a line under
"Published": `- NNN | track | Title | YYYY-MM-DD`.

## 8. Check, build, fix

```sh
npm run check:issue    # rules from the brief; fix every ERROR, read every warning
npm run build          # must finish with "Complete!"
```

Repeat until both pass. If Wikimedia Commons can't be reached, the checker warns instead of checking photos; say
so in the pull request. Then undo files the build changes:

```sh
git checkout -- src/data/commons-images.json
```

## 9. Commit and open the pull request

- Commit only the new issue, its `.graph.json`, the topic map you changed or started and `topics/queue.md`.
  Message: `Issue NNN: <title>`.
- Push the branch and open a pull request to `main` with the GitHub tools available in the session.
  Title: `Issue NNN (World|Singapore): <title>`. Description:
  - one paragraph on what the issue covers and its angle;
  - word count, read time, number of sources and photos (from `npm run check:issue`), and the number of
    questions and follow-ups in the graph;
  - which topic map the issue joined (or that you started a new one), the stories added and any other boxes you
    changed;
  - any remaining checker warnings, and anything Miles should verify (conflicting figures, single-source
    claims, photos that couldn't be checked);
  - "Merge this pull request to publish. Vercel posts a preview link below."
- If you couldn't produce an issue that passes the checks, open it as a **draft** pull request and explain
  exactly what is blocking.

## 10. Reply

Tell Miles in a few lines: the topic, the topic map it joined, the pull request link, and any caveats. Don't repeat the content.
