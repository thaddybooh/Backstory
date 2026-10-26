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

export const collections = { issues, graphs };
