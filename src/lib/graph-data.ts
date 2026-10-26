import { getEntry, type CollectionEntry } from 'astro:content';
import type { Issue } from './issues';
import { graphProblems } from './graph.mjs';

export type IssueGraph = CollectionEntry<'graphs'>['data'];

/**
 * The question graph saved next to an issue, or undefined if it has none.
 * A graph that cites a link the issue doesn't, or points at a section that doesn't
 * exist, stops the build rather than going live with a broken or invented link.
 */
export async function getGraph(issue: Issue): Promise<IssueGraph | undefined> {
  const entry = await getEntry('graphs', issue.id);
  if (!entry) return undefined;
  const problems = graphProblems(entry.data, issue.body ?? '', issue.id);
  if (problems.length) {
    throw new Error(`Question graph for ${issue.id} has problems:\n- ${problems.join('\n- ')}`);
  }
  return entry.data;
}
