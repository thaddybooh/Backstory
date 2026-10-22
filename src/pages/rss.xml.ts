import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getIssues, issueUrl } from '../lib/issues';
import { SITE } from '../lib/site';

export async function GET(context: APIContext) {
  const issues = await getIssues();
  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site!,
    items: issues.map((issue) => ({
      title: issue.data.title,
      description: issue.data.dek,
      pubDate: issue.data.date,
      link: issueUrl(issue),
      categories: [issue.data.track, ...issue.data.tags],
    })),
  });
}
