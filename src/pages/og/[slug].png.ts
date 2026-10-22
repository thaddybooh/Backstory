// Social preview cards (the image LinkedIn and others show when a link is shared).
// One per issue at /og/<issue>.png, plus /og/default.png for other pages.
import type { APIContext } from 'astro';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { getIssues, issueNumber, formatLongDate, TRACK_LABEL, type Issue } from '../../lib/issues';
import { SITE } from '../../lib/site';

const require = createRequire(import.meta.url);
const font = (weight: number) =>
  readFile(require.resolve(`@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-${weight}-normal.woff`));

const COLOURS = { paper: '#f5f7fa', ink: '#14213d', soft: '#46536d', world: '#2b44d6', singapore: '#d21f3c' };

export async function getStaticPaths() {
  const issues = await getIssues();
  return [
    ...issues.map((issue) => ({ params: { slug: issue.id }, props: { issue } })),
    { params: { slug: 'default' }, props: { issue: undefined } },
  ];
}

type Node = { type: string; props: Record<string, unknown> & { children?: unknown } };
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: { style, children },
});

function card(issue?: Issue): Node {
  const accent = issue ? COLOURS[issue.data.track] : COLOURS.world;
  const title = issue?.data.title ?? SITE.name;
  const sub = issue
    ? `${TRACK_LABEL[issue.data.track]}, ${formatLongDate(issue.data.date)}`
    : 'A daily explainer: one story, with the context left in.';
  return h(
    'div',
    {
      width: '1200px',
      height: '630px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      background: COLOURS.paper,
      padding: '56px 72px',
      fontFamily: 'Bricolage',
      color: COLOURS.ink,
      position: 'relative',
    },
    [
      h(
        'div',
        {
          position: 'absolute',
          right: '64px',
          top: '40px',
          fontSize: '260px',
          fontWeight: 800,
          color: accent,
          lineHeight: 0.8,
        },
        issue ? issueNumber(issue.data.number) : '',
      ),
      h('div', { display: 'flex', alignItems: 'center', gap: '18px', fontSize: '36px', fontWeight: 800 }, [
        h('div', { width: '24px', height: '24px', background: accent, borderRadius: '5px' }),
        SITE.name,
      ]),
      h('div', { display: 'flex', flexDirection: 'column', gap: '24px' }, [
        h(
          'div',
          { fontSize: title.length > 34 ? '72px' : '88px', fontWeight: 800, lineHeight: 1.05, width: '1000px', display: 'flex' },
          title,
        ),
        h('div', { fontSize: '30px', fontWeight: 700, color: COLOURS.soft, display: 'flex' }, sub),
      ]),
    ],
  );
}

export async function GET({ props }: APIContext) {
  const { issue } = props as { issue?: Issue };
  const [w700, w800] = await Promise.all([font(700), font(800)]);
  const svg = await satori(card(issue) as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Bricolage', data: w700, weight: 700, style: 'normal' },
      { name: 'Bricolage', data: w800, weight: 800, style: 'normal' },
    ],
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
