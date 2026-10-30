// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// The public address of the site, used for social preview cards and the sitemap.
// Set SITE_URL in Vercel when you add a custom domain; until then Vercel's own
// production address is used automatically.
const site =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:4321');

export default defineConfig({
  site,
  // /lab/ holds unlinked previews of new designs, kept out of the sitemap.
  integrations: [mdx(), sitemap({ filter: (page) => !page.includes('/lab/') })],
  trailingSlash: 'ignore',
});
