// Downloads the Wikimedia Commons photos that issues refer to, together with
// their author and licence, so credits always come from Commons itself.
//
//   npm run images
//
// It reads every `commons: "..."` (hero images) and `file="..."` (photos and
// portraits) in src/content/issues/*.mdx, asks the Commons API about each file,
// saves a web-sized copy to public/images/commons/ and records the credit in
// src/data/commons-images.json. Files already downloaded are skipped.
//
// It runs before every build. If Commons can't be reached it prints a warning
// and the build carries on; pages simply leave out photos that aren't fetched.

import { readFile, writeFile, readdir, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT = path.join(ROOT, 'src/content/issues');
const OUT_DIR = path.join(ROOT, 'public/images/commons');
const DATA = path.join(ROOT, 'src/data/commons-images.json');
const API = 'https://commons.wikimedia.org/w/api.php';
const WIDTH = 1600;
const HEADERS = { 'User-Agent': 'BackstoryBuild/1.0 (https://github.com/thaddybooh/backstory)' };

// Only licences that allow reuse on a public website with attribution.
const FREE = /^(cc0|cc[ -]by(-sa)?([ -]\d(\.\d)?)?|public domain|pd\b|attribution|gfdl)/i;
const NOT_FREE = /\b(nc|nd|non-?commercial|no ?derivatives)\b/i;

const key = (f) => f.replace(/^File:/i, '').replace(/_/g, ' ').trim();
const slug = (f) =>
  key(f)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
const stripHtml = (s = '') =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Commons file names referenced in one issue's text. */
export function filesInText(text) {
  const files = new Set();
  for (const m of text.matchAll(/^\s*commons:\s*["'](.+?)["']\s*$/gm)) files.add(key(m[1]));
  for (const m of text.matchAll(/\bfile=\{?"([^"]+)"\}?/g)) files.add(key(m[1]));
  return [...files];
}

async function collectFiles() {
  const files = new Set();
  for (const name of await readdir(CONTENT)) {
    if (!name.endsWith('.mdx')) continue;
    for (const f of filesInText(await readFile(path.join(CONTENT, name), 'utf8'))) files.add(f);
  }
  return [...files];
}

/** Why a licence is unacceptable, or null if it is fine to use. */
export function licenceProblem(licence) {
  if (!licence) return 'licence unknown';
  if (!FREE.test(licence) || NOT_FREE.test(licence)) return `licence "${licence}" is not on the free list`;
  return null;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function lookup(files) {
  const info = new Map();
  for (let i = 0; i < files.length; i += 40) {
    const batch = files.slice(i, i + 40);
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'imageinfo',
      iiprop: 'url|size|extmetadata',
      iiurlwidth: String(WIDTH),
      titles: batch.map((f) => `File:${f}`).join('|'),
    });
    const json = await fetchJson(`${API}?${params}`);
    const renamed = new Map((json.query.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of json.query.pages ?? []) {
      const asked = key(renamed.get(page.title) ?? page.title);
      info.set(asked, page);
    }
  }
  return info;
}

async function main() {
  const data = JSON.parse(await readFile(DATA, 'utf8').catch(() => '{}'));
  const wanted = await collectFiles();
  const todo = [];
  for (const f of wanted) {
    const have = data[f] && (await exists(path.join(ROOT, 'public', data[f].src)));
    if (!have) todo.push(f);
  }
  if (todo.length === 0) {
    console.log(`images: all ${wanted.length} Commons images already downloaded.`);
    return;
  }

  console.log(`images: fetching ${todo.length} of ${wanted.length} Commons images...`);
  let info;
  try {
    info = await lookup(todo);
  } catch (err) {
    console.warn(`images: could not reach Wikimedia Commons (${err.message}). Building without new photos.`);
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });
  let ok = 0;
  for (const f of todo) {
    const page = info.get(f);
    const ii = page?.imageinfo?.[0];
    if (!page || page.missing || !ii) {
      console.warn(`images: not found on Commons: "${f}"`);
      continue;
    }
    const meta = ii.extmetadata ?? {};
    const licence = stripHtml(meta.LicenseShortName?.value ?? '');
    const problem = licenceProblem(licence);
    if (problem) {
      console.warn(`images: skipped "${f}": ${problem}.`);
      continue;
    }
    const url = ii.thumburl ?? ii.url;
    const ext = path.extname(new URL(url).pathname).toLowerCase() || '.jpg';
    const name = `${slug(f)}${ext}`;
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await writeFile(path.join(OUT_DIR, name), Buffer.from(await res.arrayBuffer()));
    } catch (err) {
      console.warn(`images: download failed for "${f}" (${err.message}).`);
      continue;
    }
    data[f] = {
      file: f,
      src: `/images/commons/${name}`,
      width: ii.thumbwidth ?? ii.width,
      height: ii.thumbheight ?? ii.height,
      author: stripHtml(meta.Artist?.value) || 'Unknown author',
      licence,
      licenceUrl: meta.LicenseUrl?.value,
      page: ii.descriptionurl,
    };
    ok++;
    console.log(`images: saved ${name} (${data[f].author}, ${licence})`);
  }

  const sorted = Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(DATA, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`images: ${ok} downloaded, ${todo.length - ok} skipped.`);
}

export { key as commonsKey, stripHtml };

// Run only when called directly (npm run images / npm run build), not when imported.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    // Never fail the build over photos.
    console.warn(`images: unexpected error, continuing without new photos: ${err.stack ?? err}`);
  });
}
