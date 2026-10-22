# Backstory: website build brief

## What this is
Backstory is a daily explainer website. Each day it publishes one long-form issue that takes a single story in the news and gives the reader the background to actually understand it: what is happening, how it got here, the economics and politics underneath, where people disagree, and what to watch next. Topics alternate between **World** (e.g. France's protests) and **Singapore** (e.g. the haze, BTO housing, healthcare).

Tagline: *the news, with the context left in.*

Owner: Miles, a Singapore-based economics graduate. The site should be good enough to share publicly and put on a LinkedIn profile or resume. Issues are AI-researched and must say so.

## Starting content
Two finished issues are in this folder as standalone HTML pages:
- `backstory-001-france.html`: Issue 001, World, 21 Oct 2026, "France's autumn of anger"
- `backstory-002-haze.html`: Issue 002, Singapore, 22 Oct 2026, "The year the haze came back"

**Treat these as content, not as design.** The owner does not like their current look. Extract the text and structure into the site's content format, and keep every section, figure, link and source.

## What to build
1. **Homepage**: today's (latest) issue featured prominently with headline, dek, World/Singapore tag, date and read time. Below it, recent issues.
2. **Issue page**: a long-form reading layout with a sticky or side table of contents, comfortable line length, sidenotes or margin notes for term definitions, and good handling of the recurring components below.
3. **Archive page**: all issues, newest first, filterable by World / Singapore, with a short summary of each.
4. **About page**: what Backstory is, how issues are made (AI-researched, sources listed, check important facts), and who runs it.
5. Responsive (phone first, since people read in the morning on their phones), with light and dark mode.

## Content model
Store each issue as its own file (Markdown or MDX with frontmatter) so adding an issue never means touching layout code. Suggested frontmatter:

```yaml
number: 2
title: "The year the haze came back"
dek: "One-sentence summary"
date: 2026-10-22
track: singapore   # or world
readTime: 25
tags: [Southeast Asia, Environment, Foreign policy]
hero:
  image: /images/002-hero.jpg
  credit: "Photographer / Source, licence"
```

Recurring components the issues use (build each as a reusable component):
- **What is happening**: opening narrative overview (always first)
- **In numbers**: grid of 6–8 key figures with labels
- **Timeline**: dated entries, with turning points highlighted
- **Numbered "why" list**: layered causes with headings
- **Answer box**: a highlighted plain-language conclusion
- **Sidenote**: term definitions in the margin on desktop, inline on mobile
- **Debate**: two-column "where reasonable people disagree" cards
- **What to watch**: date + description rows
- **Key terms**: glossary list
- **Go deeper**: reading list (title, link, one line on why) and concept cards
- **Sources**: numbered list of linked sources
- **Charts**: simple data visuals where useful (issue 002 has a PSI scale bar showing where the 2026 peak of 229 sits)

## Images
Add photos, especially a hero image per issue and portraits of key figures (e.g. Macron, Lecornu, Le Pen, Mélenchon for issue 001; Prabowo, Shanmugam, Grace Fu for issue 002), plus scene photos of the events. Use **only freely licensed images, mainly from Wikimedia Commons**, and show a visible credit with author, source and licence under every image. Never use images from news sites.

## Design direction
- Editorial and serious, but modern and inviting rather than old-fashioned newspaper. It should feel like something you look forward to opening each morning.
- Strong typography with a distinctive headline face and a highly readable body face. Long reads must be comfortable.
- A clear visual difference between World and Singapore issues (e.g. an accent colour per track).
- Avoid generic AI-looking templates (cream background + serif + terracotta, purple gradients, emoji section markers).
- Before building, propose 2–3 short design directions for the owner to pick from.

## Tech and hosting
- A static site generator that handles Markdown content well (e.g. Astro or Next.js). Choose what is simplest to maintain.
- Host free on Vercel or GitHub Pages, with the code in a GitHub repo. Leave room for a custom domain later.
- Basic SEO and social preview cards (Open Graph image per issue) so links look good when shared on LinkedIn.

## Future features (design for them, don't build yet)
- **Daily automation**: a scheduled job writes the next issue (from a topic queue, alternating World/Singapore) and commits it as a new content file.
- **Topic queue**: a simple file listing upcoming topics.
- **Email newsletter**: optional sign-up later.
- **Personalised topics**: readers choose interests (expensive; later).

## Editorial rules (apply to all content)
- Maximum 30-minute read per issue (about 4,000–5,000 words of body text, excluding sources).
- Written for any reader worldwide. No asides aimed specifically at Singaporeans.
- Go beyond surface explanations: answer *why* the underlying problem exists.
- Even-handed on contested politics; attribute claims; being named in a report is not proof of wrongdoing.
- Every issue ends with sources and a note that it is AI-researched.
