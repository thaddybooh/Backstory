// Rules for an issue's question graph (src/content/issues/NNN-slug.graph.json).
// Shared by the build (src/components/graph/QuestionGraph.astro), which refuses to
// publish a graph that breaks them, and by `npm run check:issue`, which explains why.
// Plain JavaScript so the Node scripts can import it without a build step.

import GithubSlugger, { slug } from 'github-slugger';

export const LIMITS = {
  questions: [6, 10],
  followUps: [0, 3],
  sources: [2, 4],
  answerWords: [60, 220],
  labelChars: 34,
};

/** Stable anchor ids for components that carry a title (see Why, Answer and Debate). */
export const anchorId = {
  why: (title) => `why-${slug(title)}`,
  answer: (title) => `answer-${slug(title)}`,
  debate: (topic) => `debate-${slug(topic)}`,
};

/**
 * Every id a reader can jump to in an issue: the headings (slugged the same way Astro
 * does, in order, so repeated headings get -1, -2) plus the titled components.
 * @param {string} body the MDX body, frontmatter removed or not
 */
export function issueAnchors(body) {
  const ids = new Set(['what-is-happening', 'about-this-issue']);
  const slugger = new GithubSlugger();
  for (const m of body.matchAll(/^#{1,6} (.+)$/gm)) {
    const text = m[1]
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`]/g, '')
      .trim();
    ids.add(slugger.slug(text));
  }
  const attr = (tag, name) =>
    [...body.matchAll(new RegExp(`<${tag}\\b[^>]*?\\b${name}="([^"]+)"`, 'g'))].map((m) => m[1]);
  for (const t of attr('Why', 'title')) ids.add(anchorId.why(t));
  for (const t of attr('Answer', 'title')) ids.add(anchorId.answer(t));
  for (const t of attr('Debate', 'topic')) ids.add(anchorId.debate(t));
  return ids;
}

const words = (s) => s.split(/\s+/).filter(Boolean).length;

/**
 * Checks a parsed graph against its issue. Returns a list of problems (empty = fine).
 * @param {any} graph parsed JSON
 * @param {string} body the issue's MDX source
 * @param {string} issueId file name without .mdx
 */
export function graphProblems(graph, body, issueId) {
  const problems = [];
  const P = (m) => problems.push(m);
  if (!graph || typeof graph !== 'object') return ['The graph file is not a JSON object.'];
  if (graph.issue !== issueId) P(`"issue" should be "${issueId}", not "${graph.issue}".`);

  const anchors = issueAnchors(body);
  const seen = new Set();
  const [minQ, maxQ] = LIMITS.questions;
  const questions = Array.isArray(graph.questions) ? graph.questions : [];
  if (questions.length < minQ || questions.length > maxQ)
    P(`Has ${questions.length} questions; a graph needs ${minQ} to ${maxQ}.`);

  const checkNode = (q, where) => {
    const name = `${where} "${q?.id ?? '?'}"`;
    if (!q || typeof q !== 'object') return P(`${where} is not an object.`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(q.id ?? '')) P(`${name}: id must be lowercase words joined by hyphens.`);
    if (seen.has(q.id)) P(`${name}: id is used twice.`);
    seen.add(q.id);
    if (!q.label || q.label.length > LIMITS.labelChars)
      P(`${name}: label must be 1 to ${LIMITS.labelChars} characters (it is the text on the node).`);
    if (!/\?$/.test(q.question ?? '')) P(`${name}: question must end with a question mark.`);
    const answer = Array.isArray(q.answer) ? q.answer : [];
    const n = answer.reduce((sum, p) => sum + words(String(p)), 0);
    const [minW, maxW] = LIMITS.answerWords;
    if (n < minW || n > maxW) P(`${name}: answer is ${n} words; keep it between ${minW} and ${maxW}.`);
    const sources = Array.isArray(q.sources) ? q.sources : [];
    const [minS, maxS] = LIMITS.sources;
    if (sources.length < minS || sources.length > maxS) P(`${name}: has ${sources.length} sources; needs ${minS} to ${maxS}.`);
    const urls = new Set();
    for (const s of sources) {
      if (!s?.title || !s?.publication) P(`${name}: every source needs a title and a publication.`);
      if (!s?.url || (!body.includes(`(${s.url})`) && !body.includes(`"${s.url}"`)))
        P(`${name}: source ${s?.url ?? '(no url)'} does not appear in the issue. Only cite links the issue itself cites.`);
      if (urls.has(s?.url)) P(`${name}: source ${s.url} is listed twice.`);
      urls.add(s?.url);
    }
    if (!anchors.has(q.section))
      P(`${name}: section "${q.section}" is not a heading or titled block in the issue.`);
  };

  for (const q of questions) {
    checkNode(q, 'Question');
    const follow = q?.followUps ?? [];
    const [, maxF] = LIMITS.followUps;
    if (!Array.isArray(follow) || follow.length > maxF) P(`Question "${q?.id}": at most ${maxF} follow-ups.`);
    for (const f of Array.isArray(follow) ? follow : []) {
      checkNode(f, 'Follow-up');
      if (f?.followUps?.length) P(`Follow-up "${f.id}": follow-ups can't have follow-ups of their own.`);
    }
  }
  return problems;
}
