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

export const collections = { issues };
