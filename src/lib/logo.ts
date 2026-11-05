// The Deepdle submarine, drawn once and used everywhere: the masthead, the homepage title
// screen (via Logo.astro) and the social cards (as a data URI, in og/[slug].png.ts).
// Its periscope curls into a question mark.
//
// `line` is the outline colour. On the site it is a CSS variable, so the outline turns light
// in dark mode; the social cards pass a fixed navy.

export const SUB_VIEWBOX = '0 -26 166 128';

export function submarine(line = 'var(--sub-line)'): string {
  return `
  <g fill="none" stroke="${line}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
    <circle cx="13" cy="32" r="5" fill="#dbeafe" stroke-width="3"/>
    <circle cx="6" cy="16" r="3.5" fill="#dbeafe" stroke-width="2.5"/>
    <circle cx="14" cy="3" r="2.5" fill="#dbeafe" stroke-width="2"/>
    <ellipse cx="22" cy="58" rx="6" ry="15" fill="#2b44d6"/>
    <path d="M85 18 V4 C85 -2 97 -3 97 -12 C97 -24 73 -24 73 -12" stroke-width="5"/>
    <circle cx="73" cy="-7" r="3.5" fill="#2b44d6" stroke-width="2.5"/>
    <rect x="64" y="16" width="42" height="26" rx="9" fill="#ffcf3f"/>
    <rect x="30" y="34" width="120" height="50" rx="25" fill="#ffcf3f"/>
    <circle cx="58" cy="58" r="7" fill="#dbeafe" stroke-width="3"/>
    <circle cx="80" cy="58" r="7" fill="#dbeafe" stroke-width="3"/>
    <circle cx="118" cy="54" r="13" fill="#fff"/>
    <path d="M118 75 Q125 81 132 75" stroke-width="3.5"/>
  </g>
  <circle cx="121" cy="55" r="6.5" fill="#14213d"/>
  <circle cx="123.5" cy="52" r="2.3" fill="#fff"/>
  <ellipse cx="139" cy="68" rx="5" ry="3.2" fill="#ff8fa3"/>
  <path d="M38 46 Q50 38 66 40" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>`;
}

/** A standalone SVG document, for places that need an image rather than inline markup. */
export function submarineSvg(line = '#14213d'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SUB_VIEWBOX}">${submarine(line)}</svg>`;
}
