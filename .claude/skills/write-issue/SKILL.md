---
name: write-issue
description: Write the next But Why? issue in this repo (a researched explainer of at most 40 minutes on one news story, World or Singapore) and open a pull request for Miles to approve. Use when Miles asks for a new But Why? issue or "today's issue", and for the daily scheduled run.
---

# Write the next But Why? issue

But Why? is Miles's daily explainer: one story in the news, because there is always more to the story. The reader should
finish with a real understanding of a current issue, not just the headlines. It is written for any member of
the public, anywhere, not specifically for Singaporeans.

The output is **one new MDX file** in `src/content/issues/` plus an updated `topics/queue.md`, delivered as a
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

## 5. Update the topic queue

In `topics/queue.md`, remove the topic's line from "Up next" (if it came from the queue) and add a line under
"Published": `- NNN | track | Title | YYYY-MM-DD`.

## 6. Check, build, fix

```sh
npm run check:issue    # rules from the brief; fix every ERROR, read every warning
npm run build          # must finish with "Complete!"
```

Repeat until both pass. If Wikimedia Commons can't be reached, the checker warns instead of checking photos; say
so in the pull request. Then undo files the build changes:

```sh
git checkout -- src/data/commons-images.json
```

## 7. Commit and open the pull request

- Commit only the new issue and `topics/queue.md`. Message: `Issue NNN: <title>`.
- Push the branch and open a pull request to `main` with the GitHub tools available in the session.
  Title: `Issue NNN (World|Singapore): <title>`. Description:
  - one paragraph on what the issue covers and its angle;
  - word count, read time, number of sources and photos (from `npm run check:issue`);
  - any remaining checker warnings, and anything Miles should verify (conflicting figures, single-source
    claims, photos that couldn't be checked);
  - "Merge this pull request to publish. Vercel posts a preview link below."
- If you couldn't produce an issue that passes the checks, open it as a **draft** pull request and explain
  exactly what is blocking.

## 8. Reply

Tell Miles in a few lines: the topic, the pull request link, and any caveats. Don't repeat the content.
