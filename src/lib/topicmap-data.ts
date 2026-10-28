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

export interface MapLink {
  id: string;
  label: string;
  question: string;
  href: string;
}
export interface Placement {
  map: TopicMap;
  mapHref: string;
  category: MapLink;
  story: MapLink;
  /** Background boxes to read first if the topic is new to the reader. */
  primers: MapLink[];
}

/**
 * Where an issue sits in the topic maps: the box that links to it (a news story if
 * possible), the category above it, and a few background boxes to read first. Returns
 * undefined when no map links to the issue.
 */
export async function getPlacement(issueId: string): Promise<Placement | undefined> {
  let best: { rank: number; placement: Placement } | undefined;
  for (const map of await getMaps()) {
    const mapHref = `/maps/${map.id}/`;
    const link = (n: MapCategory | MapNode): MapLink => ({ id: n.id, label: n.label, question: n.question, href: `${mapHref}#${n.id}` });
    const byId = new Map<string, { node: MapNode; category: MapCategory; depth: number }>();
    const visit = (nodes: MapNode[], category: MapCategory, depth: number) =>
      nodes.forEach((n) => {
        byId.set(n.id, { node: n, category, depth });
        visit(n.children, category, depth + 1);
      });
    for (const c of map.data.categories) visit(c.children, c, 2);
    for (const { node, category, depth } of byId.values()) {
      if (node.issue !== issueId) continue;
      // Prefer the news story the issue reports, over a passing mention deeper in a map.
      const rank = category.kind === 'news' ? (depth === 2 ? 0 : 1) : 2;
      if (best && best.rank <= rank) continue;
      const background = (id: string) => byId.get(id)?.category.kind !== 'news';
      const related = node.related.filter(background).map((id) => link(byId.get(id)!.node));
      const basics = map.data.categories.find((c) => c.kind === 'basics')?.children ?? [];
      const primers = [...related, ...basics.map(link)].filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i).slice(0, 3);
      best = { rank, placement: { map, mapHref, category: link(category), story: link(node), primers } };
    }
  }
  return best?.placement;
}
