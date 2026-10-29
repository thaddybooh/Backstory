// Rules for a topic map (src/content/maps/<slug>.json), checked at build time so a map
// with a broken cross-link, a duplicate id or an over-long answer never goes live.
// Plain JavaScript, like graph.mjs, so a Node script can reuse it.

import { LIMITS as GRAPH_LIMITS } from './graph.mjs';

export const LIMITS = {
  categories: [2, 6],
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

/**
 * Where an issue sits in the topic maps, for check:issue. Every new issue joins a map as one
 * or more news stories whose `issue` field names it; those stories and the questions under
 * them may only cite links the issue itself cites, like its question graph. (A passing
 * mention deeper in a map, linked with `issue`, may cite wider research.)
 * @param {{ id: string, map: any }[]} maps every parsed map with its file name (minus .json)
 * @param {string} issueId the issue's file name without .mdx
 * @param {string} body the issue's MDX body
 * @returns {{ errors: string[], warnings: string[], placements: string[] }} placements as "map › category › box"
 */
export function issuePlacementProblems(maps, issueId, body) {
  const errors = [];
  const warnings = [];
  const placements = [];
  for (const { id, map } of maps) {
    for (const category of map.categories ?? []) {
      for (const { node, depth } of walk(category.children ?? [], 2)) {
        if (node.issue !== issueId) continue;
        const story = category.kind === 'news' && depth === 2;
        placements.push({ map: id, path: `${id} › ${category.id} › ${node.id}${story ? '' : ' (passing mention)'}`, story });
        if (!story) continue;
        // The story and the questions under it, except any that point to a different issue.
        const own = [...walk([node])].filter(({ node: n }) => n === node || !n.issue || n.issue === issueId);
        for (const { node: n } of own)
          for (const s of n.sources ?? [])
            if (!s?.url || (!body.includes(`(${s.url})`) && !body.includes(`"${s.url}"`)))
              errors.push(`Map ${id}, box "${n.id}": source ${s?.url ?? '(no url)'} does not appear in the issue. Only cite links the issue itself cites.`);
      }
    }
  }
  const storyMaps = new Set(placements.filter((p) => p.story).map((p) => p.map));
  if (!placements.length)
    errors.push(`No topic map links to this issue. Add it as a news story (with "issue": "${issueId}") to the map for its beat, or start a new map.`);
  else if (!storyMaps.size)
    warnings.push('The issue is linked from a topic map, but not as a news story in an "In the news" category.');
  if (storyMaps.size > 1)
    warnings.push(`The issue has news stories on ${storyMaps.size} maps (${[...storyMaps].join(', ')}); one map is usually enough (link others with "issue" on a deeper box).`);
  return { errors, warnings, placements: placements.map((p) => p.path) };
}
