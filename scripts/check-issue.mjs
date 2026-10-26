// Checks a new issue against But Why?'s rules before it is published.
//
//   npm run check:issue                     checks issues changed since origin/main (or the newest one)
//   npm run check:issue -- path/to/file.mdx checks specific files
//   npm run check:issue -- --offline        skips the Wikimedia Commons photo check
//   npm run check:issue -- --links          also tries to open every link (slow; warnings only)
//
// It also checks the issue's question graph (NNN-slug.graph.json next to the issue).
//
// Errors must be fixed before publishing. Warnings are worth a look but don't block.
// Exits with code 1 if there are any errors. It does not build the site: run `npm run build` too.

import { readFile, readdir, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { parse } from 'yaml';
import { graphProblems, issueAnchors } from '../src/lib/graph.mjs';
import { filesInText, licenceProblem, lookup, stripHtml } from './fetch-images.mjs';
import { readIssues } from './next-issue.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT = path.join(ROOT, 'src/content/issues');
const args = process.argv.slice(2);
const OFFLINE = args.includes('--offline');
const CHECK_LINKS = args.includes('--links');

const WORDS_PER_MINUTE = 200;
const MAX_MINUTES = 40; // a full read-through should take 30 to 40 minutes at most
const MAX_WORDS = MAX_MINUTES * WORDS_PER_MINUTE; // body text before Sources

async function knownComponents() {
  const text = await readFile(path.join(ROOT, 'src/components/issue/index.ts'), 'utf8');
  const block = text.match(/issueComponents = \{([\s\S]*?)\}/)?.[1] ?? '';
  return new Set(block.split(/[\s,]+/).filter(Boolean));
}

function changedIssueFiles() {
  try {
    const out = execFileSync('git', ['diff', '--name-only', 'origin/main', '--', 'src/content/issues'], { cwd: ROOT })
      .toString()
      .trim();
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', 'src/content/issues'], {
      cwd: ROOT,
    })
      .toString()
      .trim();
    // A changed graph means its issue is checked too.
    return [...new Set([...out.split('\n'), ...untracked.split('\n')].map((f) => f.replace(/\.graph\.json$/, '.mdx')))]
      .filter((f) => f.endsWith('.mdx'))
      .map((f) => path.join(ROOT, f));
  } catch {
    return [];
  }
}

/** Plain words of the body, with markup removed. Attribute text (titles, labels) is kept. */
function proseWords(body) {
  const text = body
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/<\/?[A-Za-z][^>]*?>/g, (tag) => ' ' + [...tag.matchAll(/(?:title|label|value|topic|term|name|date|cite|target|outcome)=["{]"?([^"}]*)/g)].map((m) => m[1]).join(' ') + ' ')
    .replace(/[#*_`>|\\[\]]/g, ' ');
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
}

function section(body, headingPattern) {
  const parts = body.split(/^## /m);
  const hit = parts.find((p) => headingPattern.test(p.split('\n')[0]));
  return hit ?? null;
}

async function checkFile(file, all, components) {
  const errors = [];
  const warnings = [];
  const E = (m) => errors.push(m);
  const W = (m) => warnings.push(m);

  const name = path.basename(file);
  const text = await readFile(file, 'utf8');
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fmMatch) return { errors: ['No frontmatter block (--- ... ---) at the top of the file.'], warnings };
  let fm;
  try {
    fm = parse(fmMatch[1]);
  } catch (err) {
    return { errors: [`Frontmatter is not valid YAML: ${err.message}`], warnings };
  }
  const body = text.slice(fmMatch[0].length);

  // ---------- Frontmatter ----------
  for (const field of ['number', 'title', 'dek', 'summary', 'date', 'track', 'readTime', 'about']) {
    if (fm[field] === undefined || fm[field] === '') E(`Frontmatter is missing "${field}".`);
  }
  if (fm.track && !['world', 'singapore'].includes(fm.track)) E(`track must be "world" or "singapore", not "${fm.track}".`);

  const fileMatch = name.match(/^(\d{3})-([a-z0-9]+(?:-[a-z0-9]+)*)\.mdx$/);
  if (!fileMatch) E(`File name "${name}" should look like "003-short-title.mdx" (lowercase, hyphens).`);
  else if (Number(fileMatch[1]) !== fm.number) E(`File name starts with ${fileMatch[1]} but number is ${fm.number}.`);

  const others = all.filter((i) => i.file !== name);
  if (others.some((i) => i.data.number === fm.number)) E(`Issue number ${fm.number} is already used.`);
  const previous = others.filter((i) => i.data.number < fm.number).at(-1);
  if (previous) {
    if (fm.number !== previous.data.number + 1)
      E(`Number should be ${previous.data.number + 1} (the previous issue is ${previous.data.number}).`);
    if (fm.track === previous.data.track)
      W(`Same track as the previous issue (${fm.track}). Issues normally alternate World and Singapore.`);
    if (fm.date && new Date(fm.date) < new Date(previous.data.date)) E('Date is earlier than the previous issue.');
  }
  const dateString = fm.date instanceof Date ? fm.date.toISOString().slice(0, 10) : String(fm.date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) E(`date should be written as YYYY-MM-DD, not "${fm.date}".`);

  if (fm.readTime > MAX_MINUTES) E(`readTime is ${fm.readTime} minutes; the limit is ${MAX_MINUTES}.`);
  if (fm.about && !/AI-researched/i.test(fm.about)) E('The "about" note must say the issue is AI-researched.');
  if (fm.about && !/source/i.test(fm.about)) W('The "about" note should point readers to the sources.');
  const count = (s) => String(s ?? '').split(/\s+/).filter(Boolean).length;
  if (count(fm.dek) > 60) W(`The dek is ${count(fm.dek)} words; aim for 60 or fewer.`);
  if (count(fm.summary) > 40) W(`The summary is ${count(fm.summary)} words; aim for 40 or fewer.`);
  if (!fm.tags?.length) W('No tags.');
  if (!fm.hero) W('No hero image.');
  else {
    if (!fm.hero.alt) E('hero needs "alt" text describing the photo.');
    if (fm.hero.image && /^https?:/.test(fm.hero.image))
      E('hero.image points to another website. Use a Wikimedia Commons file via hero.commons instead.');
    if (!fm.hero.commons && fm.hero.image && !fm.hero.credit) E('A local hero image needs a "credit".');
  }

  // ---------- Leftover template text ----------
  for (const bit of ['Headline in sentence case', 'Commons file name.jpg', 'Exact Wikimedia Commons file name', 'example.com', 'Something happened.', 'Why it\'s worth reading.']) {
    if (text.includes(bit)) E(`Template placeholder text left in: "${bit}".`);
  }

  // ---------- Structure ----------
  if (!body.trimStart().startsWith('<Overview>')) E('The issue must start with <Overview> ("What is happening").');
  const overview = body.match(/<Overview>([\s\S]*?)<\/Overview>/)?.[1] ?? '';
  const overviewParas = overview.split(/\n\s*\n/).filter((p) => p.trim()).length;
  if (overview && overviewParas < 2) W('"What is happening" has only one paragraph; it normally has about three.');

  const headings = [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
  if (headings.length < 8) W(`Only ${headings.length} numbered sections; issues usually have 12 or more.`);
  if (headings.at(-1) !== 'Sources') E('The last section must be "## Sources".');
  for (const [label, re] of [
    ['Where reasonable people disagree', /disagree/i],
    ['What to watch next', /what to watch/i],
    ['Key terms', /^key terms$/i],
    ['Go deeper', /^go deeper$/i],
  ]) {
    if (!headings.some((h) => re.test(h))) E(`Missing the "${label}" section.`);
  }
  if (!headings.some((h) => /polic|govern|playbook/i.test(h)))
    W('No section heading mentions policy or government; every issue needs a section on what the story means for policymakers.');

  const stats = (body.match(/<Stat\b/g) ?? []).length;
  if (!body.includes('<Numbers>')) E('Missing the "in numbers" grid (<Numbers> with <Stat>s).');
  else if (stats < 6 || stats > 8) W(`The numbers grid has ${stats} figures; aim for 6 to 8.`);
  if (!body.includes('<Timeline>')) W('No <Timeline>.');
  if (!body.includes('<WhyList>')) W('No numbered "why" list (<WhyList>). Most issues need one.');
  if (!body.includes('<Answer ')) W('No <Answer> box with the plain-language conclusion.');
  for (const debate of body.matchAll(/<Debate\b[\s\S]*?<\/Debate>/g)) {
    const sides = (debate[0].match(/<Side\b/g) ?? []).length;
    if (sides !== 2) E(`Each <Debate> needs exactly 2 <Side>s; one has ${sides}.`);
  }
  if (!body.includes('<Debate')) E('Missing <Debate> cards in "Where reasonable people disagree".');
  if (!body.includes('<KeyTerms>')) E('Missing <KeyTerms> in "Key terms".');
  if (!body.includes('<Reads>')) E('Missing a <Reads> reading list in "Go deeper".');

  const sources = section(body, /^Sources$/);
  const sourceLinks = sources ? [...sources.matchAll(/^\d+\.\s.*\]\((https?:\/\/[^)\s]+)\)/gm)].map((m) => m[1]) : [];
  if (sources && !sources.includes('<Sources>')) E('Wrap the source list in <Sources> ... </Sources>.');
  if (sourceLinks.length === 0) E('No linked sources found in the Sources section (numbered list of [title](url)).');
  else if (sourceLinks.length < 15) W(`Only ${sourceLinks.length} linked sources; issues usually cite 30 or more.`);
  const dupes = sourceLinks.filter((u, i) => sourceLinks.indexOf(u) !== i);
  if (dupes.length) W(`Sources listed twice: ${[...new Set(dupes)].join(', ')}`);

  // ---------- Components and MDX safety ----------
  for (const m of body.matchAll(/<([A-Z][A-Za-z]+)/g)) {
    if (!components.has(m[1])) E(`Unknown component <${m[1]}>. See src/components/issue/index.ts.`);
  }
  const lines = body.split('\n');
  lines.forEach((line, i) => {
    if (/^>/.test(line)) E(`Line ${i + 1} starts with ">", which MDX reads as a quote. Use <Quote> or move the ">".`);
  });

  // ---------- Internal links ----------
  const ids = issueAnchors(body);
  for (const m of body.matchAll(/\]\(#([^)]+)\)/g)) {
    if (!ids.has(m[1])) E(`Link to "#${m[1]}" doesn't match any section heading.`);
  }

  // ---------- Length ----------
  const beforeSources = body.split(/^## Sources$/m)[0];
  const words = proseWords(beforeSources).length;
  const minutes = Math.round(words / WORDS_PER_MINUTE);
  if (words > MAX_WORDS)
    E(`Body is ${words.toLocaleString('en')} words (about ${minutes} min, excluding sources); a full read must take ${MAX_MINUTES} minutes at most. Trim it.`);
  else if (words < 3000) W(`Body is only ${words.toLocaleString('en')} words; issues usually need more room to explain the story.`);
  if (fm.readTime && Math.abs(fm.readTime - minutes) > 5)
    W(`readTime says ${fm.readTime} minutes, but the length suggests about ${minutes}.`);

  // ---------- Editorial rules that a script can spot ----------
  const sgAside = /\b(?:to|for) (?:someone|readers?|people) (?:from|in) Singapore\b|\bas (?:a )?Singaporeans?\b|\bSingaporeans (?:will|may|might) (?:know|recognise|remember)/i;
  const asideHit = body.match(sgAside);
  if (asideHit) W(`Possible aside aimed at Singaporeans: "${asideHit[0]}". Issues are written for any reader.`);

  // ---------- Photos ----------
  const photos = filesInText(text);
  if (photos.length === 0) W('No Wikimedia Commons photos.');
  if (!OFFLINE && photos.length) {
    try {
      const info = await lookup(photos);
      for (const f of photos) {
        const page = info.get(f);
        const ii = page?.imageinfo?.[0];
        if (!page || page.missing || !ii) {
          E(`Photo not found on Wikimedia Commons: "${f}". Check the exact file name.`);
          continue;
        }
        const problem = licenceProblem(stripHtml(ii.extmetadata?.LicenseShortName?.value ?? ''));
        if (problem) E(`Photo "${f}" can't be used: ${problem}.`);
      }
    } catch (err) {
      W(`Couldn't reach Wikimedia Commons to check ${photos.length} photos (${err.message}). Vercel will skip any that don't exist.`);
    }
  }

  // ---------- Question graph ----------
  const graphFile = file.replace(/\.mdx$/, '.graph.json');
  const hasGraph = await access(graphFile).then(() => true, () => false);
  let graphSummary = 'no question graph';
  if (!hasGraph) E(`No question graph. Write ${path.basename(graphFile)} (see docs/graph-template.json).`);
  else {
    try {
      const graph = JSON.parse(await readFile(graphFile, 'utf8'));
      const qs = graph.questions ?? [];
      graphSummary = `graph: ${qs.length} questions, ${qs.reduce((n, q) => n + (q.followUps?.length ?? 0), 0)} follow-ups`;
      for (const problem of graphProblems(graph, body, name.replace(/\.mdx$/, ''))) E(`Graph: ${problem}`);
    } catch (err) {
      E(`Graph file is not valid JSON: ${err.message}`);
    }
  }

  // ---------- Links (optional) ----------
  if (CHECK_LINKS) {
    const urls = [...new Set([...body.matchAll(/\]\((https?:\/\/[^)\s]+)\)|href="(https?:\/\/[^"]+)"/g)].map((m) => m[1] ?? m[2]))];
    await Promise.all(
      urls.map(async (url) => {
        try {
          const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15000) });
          if (res.status === 404 || res.status === 410) W(`Link is broken (${res.status}): ${url}`);
        } catch (err) {
          W(`Couldn't open link (${err.cause?.code ?? err.message}): ${url}`);
        }
      }),
    );
  }

  return { errors, warnings, words, minutes, photos: photos.length, sources: sourceLinks.length, graphSummary };
}

async function main() {
  const fileArgs = args.filter((a) => !a.startsWith('--')).map((a) => path.resolve(a.replace(/\.graph\.json$/, '.mdx')));
  const all = await readIssues();
  let files = fileArgs.length ? fileArgs : changedIssueFiles();
  if (files.length === 0 && all.length) files = [path.join(CONTENT, all.at(-1).file)];
  if (files.length === 0) {
    console.log('No issues to check.');
    return;
  }

  const components = await knownComponents();
  let failed = false;
  for (const file of files) {
    const r = await checkFile(file, all, components);
    console.log(`\n${path.relative(ROOT, file)}`);
    if (r.words !== undefined)
      console.log(
        `  ${r.words.toLocaleString('en')} words before Sources (about ${r.minutes} min), ${r.sources} sources, ${r.photos} photos, ${r.graphSummary}`,
      );
    for (const e of r.errors) console.log(`  ERROR    ${e}`);
    for (const w of r.warnings) console.log(`  warning  ${w}`);
    if (!r.errors.length && !r.warnings.length) console.log('  All checks passed.');
    if (r.errors.length) failed = true;
  }
  console.log(failed ? '\nFix the errors above before publishing.' : '\nNo errors.');
  process.exitCode = failed ? 1 : 0;
}

await main();
