import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { getIssues } from './issues';
import { mapProblems } from './topicmap.mjs';

export type TopicMap = CollectionEntry<'maps'>;
export type MapBranch = TopicMap['data']['branches'][number];
export type MapNode = MapBranch['children'][number];

export const QUESTION_TYPE: Record<MapNode['type'], string> = {
  basics: 'Policy basics',
  why: 'Why is this happening?',
  what: 'What’s changing?',
  who: 'Who does it affect?',
  means: 'What does it mean?',
  debate: 'Where people disagree',
};

/** A topic map, or every map, after checking the rules in topicmap.mjs (a broken map stops the build). */
async function checked(entry: TopicMap) {
  const issueIds = new Set((await getIssues()).map((i) => i.id));
  const problems = mapProblems(entry.data, issueIds);
  if (problems.length) throw new Error(`Topic map ${entry.id} has problems:\n- ${problems.join('\n- ')}`);
  return entry;
}
export async function getMaps() {
  const all = await getCollection('maps');
  return Promise.all(all.map(checked));
}
export async function getMap(id: string) {
  const entry = await getEntry('maps', id);
  return entry ? checked(entry) : undefined;
}

/** Number of questions in a map (every node below the branches, plus the branches). */
export function countNodes(nodes: { children?: unknown[] }[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes((n.children ?? []) as { children?: unknown[] }[]), 0);
}
