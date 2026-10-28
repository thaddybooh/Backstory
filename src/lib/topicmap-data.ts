import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { getIssues } from './issues';
import { mapProblems } from './topicmap.mjs';

export type TopicMap = CollectionEntry<'maps'>;
export type MapCategory = TopicMap['data']['categories'][number];
export type MapNode = MapCategory['children'][number];
export type QuestionType = NonNullable<MapNode['type']>;

export const QUESTION_TYPE: Record<QuestionType, string> = {
  basics: 'Policy basics',
  why: 'Why is this happening?',
  what: 'What’s changing?',
  who: 'Who does it affect?',
  means: 'What does it mean?',
  debate: 'Where people disagree',
};

export const CATEGORY_KIND: Record<MapCategory['kind'], string> = {
  basics: 'The basics',
  ideas: 'Big ideas and debates',
  news: 'In the news',
};

/** A topic map, or every map, after checking the rules in topicmap.mjs (a broken map stops the build). */
async function checked(entry: TopicMap) {
  const issueIds = new Set((await getIssues()).map((i) => i.id));
  const problems = mapProblems(entry.data, issueIds);
  if (problems.length) throw new Error(`Topic map ${entry.id} has problems:\n- ${problems.join('\n- ')}`);
  return entry;
}
export async function getMaps() {
  return Promise.all((await getCollection('maps')).map(checked));
}
export async function getMap(id: string) {
  const entry = await getEntry('maps', id);
  return entry ? checked(entry) : undefined;
}

type Tree = { children?: Tree[] };
/** Number of questions in a map: every node below the categories. */
export function countQuestions(categories: Tree[]): number {
  const count = (nodes: Tree[]): number => nodes.reduce((sum, n) => sum + 1 + count(n.children ?? []), 0);
  return categories.reduce((sum, c) => sum + count(c.children ?? []), 0);
}
