// Works out what the next issue should be: its number, track, date and topic.
//
//   npm run next
//
// Prints JSON, e.g.
//   {"number":3,"track":"world","date":"2026-10-23","topic":null,"note":null,"fileStem":"003-"}
// `topic` is null when the queue has nothing for that track (pick the day's biggest story).

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT = path.join(ROOT, 'src/content/issues');
const QUEUE = path.join(ROOT, 'topics/queue.md');

export async function readIssues() {
  const issues = [];
  for (const name of await readdir(CONTENT)) {
    if (!name.endsWith('.mdx')) continue;
    const text = await readFile(path.join(CONTENT, name), 'utf8');
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) continue;
    issues.push({ file: name, data: parse(fm[1]) });
  }
  return issues.sort((a, b) => a.data.number - b.data.number);
}

/** Topics listed under "## Up next" in topics/queue.md. */
export async function readQueue() {
  const text = await readFile(QUEUE, 'utf8');
  const section = text.split(/^## /m).find((s) => s.startsWith('Up next'));
  if (!section) return [];
  return [...section.matchAll(/^- (world|singapore):\s*(.+?)\s*$/gim)].map((m) => {
    const [topic, note] = m[2].split(/\s+--\s+/);
    return { track: m[1].toLowerCase(), topic: topic.trim(), note: note?.trim() ?? null, line: m[0] };
  });
}

/** Today's date in Singapore, as YYYY-MM-DD. */
export function todaySingapore() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(new Date());
}

async function main() {
  const issues = await readIssues();
  const last = issues.at(-1);
  const number = (last?.data.number ?? 0) + 1;
  const track = last?.data.track === 'world' ? 'singapore' : 'world';
  const pick = (await readQueue()).find((q) => q.track === track);
  console.log(
    JSON.stringify(
      {
        number,
        track,
        date: todaySingapore(),
        topic: pick?.topic ?? null,
        note: pick?.note ?? null,
        queueLine: pick?.line ?? null,
        fileStem: `${String(number).padStart(3, '0')}-`,
        lastIssue: last ? { number: last.data.number, track: last.data.track, title: last.data.title } : null,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  await main();
}
