import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// One file per issue in src/content/issues/. The file name (minus .mdx)
// becomes the web address: /issues/<file-name>/
const issues = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/issues' }),
  schema: z.object({
    number: z.number().int().positive(),
    title: z.string(),
    dek: z.string(),
    // One or two sentences for the archive and homepage lists.
    summary: z.string(),
    date: z.coerce.date(),
    track: z.enum(['world', 'singapore']),
    readTime: z.number().int().positive(),
    tags: z.array(z.string()).default([]),
    // Shown under the headline, e.g. "Researched from 40+ reports".
    research: z.string().optional(),
    hero: z
      .object({
        // A Wikimedia Commons file name. The image and its credit are fetched
        // from Commons by scripts/fetch-images.mjs.
        commons: z.string().optional(),
        // Or a local image in public/ with a hand-written credit.
        image: z.string().optional(),
        credit: z.string().optional(),
        alt: z.string(),
        caption: z.string().optional(),
      })
      .optional(),
    // The issue-specific "About this issue" note printed at the end.
    about: z.string(),
    draft: z.boolean().default(false),
  }),
});

// One question graph per issue, saved next to it as NNN-slug.graph.json. The entry id
// is the issue's id, so graphs and issues pair up by name. The rules a graph must
// follow beyond this shape (real sources, real sections) live in src/lib/graph.mjs.
const source = z.object({
  title: z.string(),
  publication: z.string(),
  url: z.string().url(),
});
const followUp = z.object({
  id: z.string(),
  // Short text drawn on the node; the full question is shown in the panel.
  label: z.string(),
  question: z.string(),
  // Paragraphs of plain text.
  answer: z.array(z.string()).min(1),
  sources: z.array(source),
  // The id of the heading or titled block in the issue that covers this question.
  section: z.string(),
});
const graphs = defineCollection({
  loader: glob({
    pattern: '**/*.graph.json',
    base: './src/content/issues',
    generateId: ({ entry }) => entry.replace(/\.graph\.json$/, ''),
  }),
  schema: z.object({
    issue: z.string(),
    questions: z.array(followUp.extend({ followUps: z.array(followUp).default([]) })),
  }),
});

// Topic maps: a standalone, deeper question graph for a whole subject (not one issue),
// saved as src/content/maps/<slug>.json and published at /maps/<slug>/. Three or so
// categories come off the centre (the basics, the big ideas, the news); under them sit
// topics and news stories, and under those the questions, as deep as the topic needs.
// The rules beyond this shape (unique ids, real cross-links, the four questions every
// news story answers) live in src/lib/topicmap.mjs.
type MapNode = z.infer<typeof followUp> & {
  type?: 'basics' | 'initiative' | 'why' | 'what' | 'who' | 'means' | 'debate';
  when?: string;
  related: string[];
  issue?: string;
  children: MapNode[];
};
const mapNode: z.ZodType<MapNode> = z.lazy(() =>
  followUp.omit({ section: true }).extend({
    // What kind of question it is; drives its colour and the "highlight" buttons.
    // Topics and news stories (the level under a category) leave it out.
    // 'initiative' marks a government programme, law or body (in the policy category).
    type: z.enum(['basics', 'initiative', 'why', 'what', 'who', 'means', 'debate']).optional(),
    // For a news story: when it happened, shown on the box, e.g. "Sep 2026".
    when: z.string().optional(),
    // Ids of nodes elsewhere in the map this one connects to (listed in its answer panel).
    related: z.array(z.string()).default([]),
    // Optional id of a But Why? issue that covers this in depth.
    issue: z.string().optional(),
    children: z.array(mapNode).default([]),
  }),
) as z.ZodType<MapNode>;
const maps = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/maps' }),
  schema: z.object({
    title: z.string(),
    track: z.enum(['world', 'singapore']),
    updated: z.coerce.date(),
    dek: z.string(),
    intro: z.string(),
    // A cover photo for the topic's card: a Wikimedia Commons file name, fetched with its
    // credit by scripts/fetch-images.mjs like issue photos.
    cover: z.object({ commons: z.string(), alt: z.string() }).optional(),
    categories: z.array(
      followUp.omit({ section: true }).extend({
        // basics: how it works; ideas: the policy thinking and debates; policy: what the
        // government is doing (its standing initiatives); news: recent changes.
        kind: z.enum(['basics', 'ideas', 'policy', 'news']),
        children: z.array(mapNode).default([]),
      }),
    ),
  }),
});

export const collections = { issues, graphs, maps };
