import { getCollection, type CollectionEntry } from 'astro:content';

export type Issue = CollectionEntry<'issues'>;
export type Track = Issue['data']['track'];

export const TRACK_LABEL: Record<Track, string> = {
  world: 'World',
  singapore: 'Singapore',
};

/** All published issues, newest first. */
export async function getIssues(): Promise<Issue[]> {
  const all = await getCollection('issues', ({ data }) => import.meta.env.DEV || !data.draft);
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || b.data.number - a.data.number);
}

export function issueUrl(issue: Issue) {
  return `/issues/${issue.id}/`;
}

export function issueNumber(n: number) {
  return String(n).padStart(3, '0');
}

const longDate = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Singapore',
});
const shortDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Singapore',
});

export const formatLongDate = (d: Date) => longDate.format(d);
export const formatShortDate = (d: Date) => shortDate.format(d);
