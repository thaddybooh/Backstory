// Rules for a topic map (src/content/maps/<slug>.json), checked at build time so a map
// with a broken cross-link, a duplicate id or an over-long answer never goes live.
// Plain JavaScript, like graph.mjs, so a Node script can reuse it.

import { LIMITS as GRAPH_LIMITS } from './graph.mjs';

export const LIMITS = {
  categories: [2, 5],
  sources: [1, 4],
  answerWords: GRAPH_LIMITS.answerWords,
  labelChars: GRAPH_LIMITS.labelChars,
};

/** The four questions every news story opens with, in this order. */
export const STORY_QUESTIONS = ['why', 'what', 'who', 'means'];

const words = (s) => s.split(/\s+/).filter(Boolean).length;

/** Every node in the map, depth-first, with its depth (categories are depth 1). */
export function* walk(nodes, depth = 1, parent) {
  for (const n of nodes) {
    yield { node: n, depth, parent };
    yield* walk(n.children ?? [], depth + 1, n);
  }
}

/**
 * Checks a parsed map. Returns a list of problems (empty = fine).
 * @param {any} map parsed JSON
 * @param {Set<string>} issueIds ids of published issues, for the optional "issue" links
 */
export function mapProblems(map, issueIds) {
  const problems = [];
  const P = (m) => problems.push(m);
  const categories = Array.isArray(map?.categories) ? map.categories : [];
  const [minC, maxC] = LIMITS.categories;
  if (categories.length < minC || categories.length > maxC)
    P(`Has ${categories.length} categories; a map needs ${minC} to ${maxC}.`);

  const ids = new Set();
  const all = [...walk(categories)];
  for (const { node: n, depth } of all) {
    const name = `Node "${n?.id ?? '?'}"`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(n.id ?? '')) P(`${name}: id must be lowercase words joined by hyphens.`);
    if (ids.has(n.id)) P(`${name}: id is used twice.`);
    ids.add(n.id);
    if (!n.label || n.label.length > LIMITS.labelChars)
      P(`${name}: label must be 1 to ${LIMITS.labelChars} characters (it is the text on the box).`);
    if (!/\?$/.test(n.question ?? '')) P(`${name}: question must end with a question mark.`);
    const count = (n.answer ?? []).reduce((sum, p) => sum + words(String(p)), 0);
    const [minW, maxW] = LIMITS.answerWords;
    if (count < minW || count > maxW) P(`${name}: answer is ${count} words; keep it between ${minW} and ${maxW}.`);
    const [minS, maxS] = LIMITS.sources;
    const sources = n.sources ?? [];
    if (sources.length < minS || sources.length > maxS) P(`${name}: has ${sources.length} sources; needs ${minS} to ${maxS}.`);
    if (new Set(sources.map((s) => s.url)).size !== sources.length) P(`${name}: a source is listed twice.`);
    if (depth >= 3 && !n.type) P(`${name}: questions below a topic need a "type".`);
    if (n.issue && !issueIds.has(n.issue)) P(`${name}: issue "${n.issue}" does not exist.`);
  }
  // Every news story answers the same four questions first, so readers learn one pattern.
  for (const story of categories.filter((c) => c.kind === 'news').flatMap((c) => c.children ?? [])) {
    const first = (story.children ?? []).slice(0, STORY_QUESTIONS.length).map((c) => c.type);
    if (first.join() !== STORY_QUESTIONS.join())
      P(`News story "${story.id}": its first questions must be ${STORY_QUESTIONS.join(', ')} (has ${first.join(', ') || 'none'}).`);
  }
  for (const { node: n } of all)
    for (const r of n.related ?? []) {
      if (!ids.has(r)) P(`Node "${n.id}": related id "${r}" is not in the map.`);
      if (r === n.id) P(`Node "${n.id}": can't be related to itself.`);
    }
  return problems;
}
