// The interactive topic map, drawn as a left-to-right tree: the subject on the left,
// then its categories, then topics and news stories, then their questions. It reads
// everything from the nested list the page already rendered (see TopicMap.astro) and
// draws each node as an SVG box, so boxes are real focusable elements styled by the
// site's CSS.
//
// Only one path is open at a time: opening a box unfolds what is inside it and folds its
// siblings away, so the tree stays readable. "Open everything" shows the whole map.

import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';

interface Node {
  id: string;
  depth: number;
  label: string;
  category: string;
  type?: string;
  when?: string;
  parent?: Node;
  children: Node[];
  related: Node[];
  details?: HTMLDetailsElement;
  el: SVGGElement;
  link?: SVGPathElement;
  w: number;
  h: number;
  block: number;
  // Where the box is drawn (top-left corner), where it is heading, and where it came from.
  x: number;
  y: number;
  tx: number;
  ty: number;
  fx: number;
  fy: number;
}

const SVG = 'http://www.w3.org/2000/svg';
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TYPE_LABEL: Record<string, string> = {
  basics: 'Policy basics',
  why: 'Why is this happening?',
  what: 'What’s changing?',
  who: 'Who does it affect?',
  means: 'What does it mean?',
  debate: 'Where people disagree',
};
// The short tag printed at the top of a question's box.
const TYPE_TAG: Record<string, string> = {
  basics: 'Basics',
  why: 'Why',
  what: 'What’s changing',
  who: 'Who’s affected',
  means: 'What it means',
  debate: 'Debate',
};
const CATEGORY_LABEL: Record<string, string> = { basics: 'The basics', ideas: 'Big ideas and debates', news: 'In the news' };

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

export async function mountTopicMap(section: HTMLElement) {
  const stage = section.querySelector<HTMLElement>('.qmap-stage')!;
  const panel = stage.querySelector<HTMLElement>('.qmap-panel')!;
  const panelTitle = panel.querySelector<HTMLElement>('.qmap-panel-title')!;
  const panelKicker = panel.querySelector<HTMLElement>('.qmap-panel-kicker')!;
  const panelBody = panel.querySelector<HTMLElement>('.qmap-panel-body')!;
  const panelNext = panel.querySelector<HTMLElement>('.qmap-panel-next')!;
  const toggles = [...section.querySelectorAll<HTMLButtonElement>('.qmap-toggle button')];
  const expandBtn = section.querySelector<HTMLButtonElement>('[data-action="expand"]')!;
  const chips = [...section.querySelectorAll<HTMLButtonElement>('.tmap-chip')];
  const narrow = () => stage.clientWidth < 560;

  // ---------- View toggle (map or list), remembered per browser ----------
  function setView(view: string) {
    document.documentElement.dataset.qmapView = view;
    for (const b of toggles) b.setAttribute('aria-pressed', String(b.dataset.view === view));
    try {
      localStorage.setItem('qmap-view', view);
    } catch {}
    if (view === 'graph') requestAnimationFrame(() => resize());
    else closePanel(false);
  }
  for (const b of toggles) b.addEventListener('click', () => setView(b.dataset.view!));
  for (const b of toggles)
    b.setAttribute('aria-pressed', String(b.dataset.view === (document.documentElement.dataset.qmapView ?? 'graph')));

  // ---------- Nodes, read from the rendered list ----------
  const blank = { children: [], related: [], w: 0, h: 0, block: 0, x: 0, y: 0, tx: 0, ty: 0, fx: 0, fy: 0 };
  const root: Node = { ...blank, id: '__root', depth: 0, label: stage.dataset.title ?? '', category: '', el: svgEl('g') };
  const nodes: Node[] = [root];
  const byId = new Map<string, Node>();
  for (const details of section.querySelectorAll<HTMLDetailsElement>('.tmap-list details')) {
    const d = details.dataset;
    const parent = d.parent ? byId.get(d.parent)! : root;
    const n: Node = {
      ...blank, children: [], related: [], id: d.node!, depth: Number(d.depth), label: d.label!,
      category: d.category!, type: d.type, when: d.when, parent, details, el: svgEl('g'),
    };
    parent.children.push(n);
    nodes.push(n);
    byId.set(n.id, n);
  }
  // Related ideas work both ways: if A points to B, B's panel lists A too.
  for (const details of section.querySelectorAll<HTMLDetailsElement>('.tmap-list details[data-related]')) {
    const a = byId.get(details.dataset.node!)!;
    for (const b of details.dataset.related!.split(' ').map((id) => byId.get(id))) {
      if (!b) continue;
      if (!a.related.includes(b)) a.related.push(b);
      if (!b.related.includes(a)) b.related.push(a);
    }
  }
  const question = (n: Node) => n.details?.querySelector('.tmap-q')?.textContent?.trim() ?? n.label;
  const ancestors = (n: Node) => {
    const out: Node[] = [];
    for (let p = n.parent; p; p = p.parent) out.push(p);
    return out;
  };
  const categoryOf = (n: Node) => (n.depth <= 1 ? n : ancestors(n).find((a) => a.depth === 1)!);

  // ---------- Box sizes ----------
  // Text is wrapped with real font measurements, so boxes fit their labels exactly.
  await document.fonts?.ready;
  const ctx = document.createElement('canvas').getContext('2d')!;
  const fontFamily = getComputedStyle(section).getPropertyValue('--font-display').trim() || 'system-ui';
  const style = (depth: number) => {
    const small = narrow();
    // [box width, label font size, label weight]
    const table: [number, number, number][] = small
      ? [[150, 16, 750], [150, 14.5, 750], [168, 13.5, 650], [176, 13, 600], [168, 12.5, 550]]
      : [[184, 19, 750], [188, 16.5, 750], [214, 15, 650], [226, 14, 600], [214, 13.5, 550]];
    return table[Math.min(depth, 4)];
  };
  const PAD_X = 14;
  const PAD_Y = 10;
  function lines(text: string, size: number, weight: number, width: number) {
    ctx.font = `${weight} ${size}px ${fontFamily}`;
    const out: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > width) {
        out.push(line);
        line = word;
      } else line = next;
    }
    if (line) out.push(line);
    return out;
  }

  // ---------- Drawing each box ----------
  const svg = svgEl('svg', { class: 'qmap-svg tmap-svg', role: 'group', 'aria-label': 'Topic map' });
  const viewport = svgEl('g', { class: 'qmap-viewport' });
  const linkLayer = svgEl('g', { class: 'tmap-links' });
  const nodeLayer = svgEl('g', { class: 'tmap-nodes' });
  viewport.append(linkLayer, nodeLayer);
  svg.append(viewport);

  function drawBox(n: Node) {
    const [width, size, weight] = style(n.depth);
    const g = n.el;
    g.replaceChildren();
    g.setAttribute('class', `tmap-node tmap-d${Math.min(n.depth, 4)}`);
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    if (n.category) g.dataset.category = n.category;
    if (n.type) g.dataset.type = n.type;
    const hasKids = n.children.length > 0;
    const textW = width - PAD_X * 2 - (n.depth >= 2 ? 6 : 0);
    const main = lines(n.label, size, weight, textW);
    // A small line above the label: the kind of question, or a news story's date.
    const kicker = n.type ? TYPE_TAG[n.type] : n.when ? n.when : n.depth === 1 ? `${n.children.length} topics` : '';
    const kickerSize = narrow() ? 10.5 : 11;
    const lineH = size * 1.2;
    const top = PAD_Y + (kicker ? kickerSize * 1.45 : 0);
    n.w = width;
    n.h = Math.round(top + main.length * lineH + PAD_Y);

    g.append(svgEl('rect', { class: 'tmap-box', width: n.w, height: n.h, rx: n.depth <= 1 ? 12 : 9 }));
    if (n.depth >= 2) g.append(svgEl('rect', { class: 'tmap-stripe', x: 0, y: 0, width: 5, height: n.h, rx: 2.5 }));
    const x0 = PAD_X + (n.depth >= 2 ? 4 : 0);
    if (kicker) {
      const k = svgEl('text', { class: 'tmap-kicker-text', x: x0, y: PAD_Y + kickerSize });
      k.textContent = kicker.toUpperCase();
      g.append(k);
    }
    const t = svgEl('text', { class: 'tmap-label', x: x0, y: top + size * 0.95, style: `font-size:${size}px;font-weight:${weight}` });
    main.forEach((line, i) => {
      const s = svgEl('tspan', { x: x0, dy: i ? lineH : 0 });
      s.textContent = line;
      t.append(s);
    });
    g.append(t);
    if (hasKids && n !== root) {
      // The fold button on the right edge: "+5" when folded, "−" when open.
      const tg = svgEl('g', { class: 'tmap-fold', transform: `translate(${n.w},${n.h / 2})` });
      tg.append(svgEl('circle', { r: 12 }), svgEl('text', { 'text-anchor': 'middle', y: 4 }));
      g.append(tg);
    }
    if (n === root) g.setAttribute('aria-label', `${n.label}: how to use this map`);
    else {
      g.setAttribute('aria-label', question(n));
      g.setAttribute('aria-haspopup', 'dialog');
    }
  }
  const drawAll = () => nodes.forEach(drawBox);

  // ---------- Which boxes are showing ----------
  const expanded = new Set<Node>([root]);
  let openAll = false;
  const shown = (n: Node): boolean => n === root || (expanded.has(n.parent!) && shown(n.parent!));
  let visible: Node[] = [];

  function setFold(n: Node, open: boolean) {
    if (open) {
      expanded.add(n);
      // One path at a time: opening a box folds its siblings (unless everything is open).
      if (!openAll && n.parent)
        for (const s of n.parent.children) if (s !== n) [s, ...descendants(s)].forEach((d) => expanded.delete(d));
    } else [n, ...descendants(n)].forEach((d) => expanded.delete(d));
  }
  const descendants = (n: Node): Node[] => n.children.flatMap((c) => [c, ...descendants(c)]);

  // ---------- Tidy tree layout ----------
  // Columns by depth; each box sits in the middle of the boxes it opens into.
  function layout() {
    const small = narrow();
    const colGap = small ? 44 : 70;
    const rowGap = small ? 10 : 12;
    const groupGap = small ? 18 : 26; // extra space between whole categories
    const colX: number[] = [0];
    for (let d = 1; d <= 5; d++) colX[d] = colX[d - 1] + style(d - 1)[0] + colGap;
    const kids = (n: Node) => (expanded.has(n) ? n.children : []);
    const gap = (n: Node) => (n.depth === 1 ? groupGap : rowGap);
    const measure = (n: Node): number => {
      const ks = kids(n);
      const inner = ks.reduce((s, c) => s + measure(c), 0) + Math.max(0, ks.length - 1) * (ks[0] ? gap(ks[0]) : 0);
      return (n.block = Math.max(n.h, inner));
    };
    const place = (n: Node, top: number) => {
      n.tx = colX[n.depth];
      n.ty = top + n.block / 2 - n.h / 2;
      const ks = kids(n);
      const inner = ks.reduce((s, c) => s + c.block, 0) + Math.max(0, ks.length - 1) * (ks[0] ? gap(ks[0]) : 0);
      let y = top + (n.block - inner) / 2;
      for (const c of ks) {
        place(c, y);
        y += c.block + gap(c);
      }
    };
    measure(root);
    place(root, -root.block / 2);
  }

  function showFold(n: Node) {
    n.el.classList.toggle('is-open', expanded.has(n) && n.children.length > 0);
    if (!n.children.length || n === root) return;
    n.el.setAttribute('aria-expanded', String(expanded.has(n)));
    const label = n.el.querySelector('.tmap-fold text');
    if (label) label.textContent = expanded.has(n) ? '−' : `+${n.children.length}`;
  }

  function sync(focus?: Node) {
    const before = new Set(visible);
    visible = nodes.filter(shown);
    for (const n of nodes) {
      const on = visible.includes(n);
      if (!on) {
        n.el.remove();
        n.link?.remove();
        continue;
      }
      showFold(n);
      if (n.parent && !n.link) n.link = svgEl('path', { class: 'tmap-link' });
      if (n.link) {
        n.link.dataset.category = n.category;
        linkLayer.append(n.link);
      }
    }
    // Keep keyboard order the same as the list.
    for (const n of visible) nodeLayer.append(n.el);
    layout();
    for (const n of visible) {
      if (!before.has(n)) {
        // New boxes grow out of their parent's fold button.
        const p = n.parent!;
        n.x = p.x + p.w - n.w * 0.3;
        n.y = p.y + p.h / 2 - n.h / 2;
        n.el.classList.add('is-new');
      }
      n.fx = n.x;
      n.fy = n.y;
    }
    animate();
    expandBtn.textContent = openAll ? 'Fold everything' : 'Open everything';
    if (!openAll) {
      stage.style.height = '';
      stage.classList.remove('is-tall');
      panel.style.top = '';
    }
    frame(focus);
    trail();
  }

  // Boxes glide to their new places.
  let raf = 0;
  function animate() {
    cancelAnimationFrame(raf);
    const ms = reducedMotion() ? 0 : 420;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = ms ? Math.min(1, (now - t0) / ms) : 1;
      const e = 1 - Math.pow(1 - p, 3);
      for (const n of visible) {
        n.x = n.fx + (n.tx - n.fx) * e;
        n.y = n.fy + (n.ty - n.fy) * e;
      }
      render();
      if (p < 1) raf = requestAnimationFrame(step);
      else for (const n of visible) n.el.classList.remove('is-new');
    };
    raf = requestAnimationFrame(step);
  }

  function render() {
    for (const n of visible) {
      n.el.setAttribute('transform', `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`);
      if (!n.link || !n.parent) continue;
      const p = n.parent;
      const x1 = p.x + p.w + 12; // from the fold button
      const y1 = p.y + p.h / 2;
      const x2 = n.x;
      const y2 = n.y + n.h / 2;
      const mx = (x1 + x2) / 2;
      n.link.setAttribute('d', `M${x1.toFixed(1)},${y1.toFixed(1)} C${mx.toFixed(1)},${y1.toFixed(1)} ${mx.toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`);
    }
  }

  // ---------- Zoom and pan ----------
  // Mouse: drag the background to pan, Ctrl/⌘ + scroll (or a trackpad pinch) to zoom.
  // Touch: one finger scrolls the page as normal; two fingers pan and pinch-zoom.
  let transform: ZoomTransform = zoomIdentity;
  const zoomer = d3zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.25, 1.8])
    .filter((ev: any) => {
      if (ev.type === 'wheel') return ev.ctrlKey || ev.metaKey;
      if (ev.type.startsWith('touch')) return ev.touches.length >= 2;
      return !ev.button;
    })
    .on('zoom', (ev) => {
      transform = ev.transform;
      viewport.setAttribute('transform', transform.toString());
    });
  const svgSel = select(svg as SVGSVGElement);
  svgSel.call(zoomer).on('dblclick.zoom', null);

  let anim = 0;
  function animateTo(target: ZoomTransform, ms = 500) {
    cancelAnimationFrame(anim);
    if (reducedMotion() || ms === 0) return void svgSel.call(zoomer.transform, target);
    const from = transform;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      svgSel.call(
        zoomer.transform,
        zoomIdentity
          .translate(from.x + (target.x - from.x) * e, from.y + (target.y - from.y) * e)
          .scale(from.k + (target.k - from.k) * e),
      );
      if (p < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  /** The visible area, leaving room for the answer panel on wide screens. */
  function viewBox() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const side = !panel.hidden && !narrow() ? panel.offsetWidth + 24 : 0;
    return { w: w - side, h };
  }

  /** Frames a set of boxes (by their destinations), never zooming in past life size. */
  function fitTo(boxes: Node[], animate = true) {
    const { w, h } = viewBox();
    const pad = narrow() ? 20 : 48;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of boxes) {
      x0 = Math.min(x0, n.tx);
      y0 = Math.min(y0, n.ty);
      x1 = Math.max(x1, n.tx + n.w + 14);
      y1 = Math.max(y1, n.ty + n.h);
    }
    const left = 40; // the zoom buttons
    const k = Math.max(0.25, Math.min(1, (w - left - pad * 2) / (x1 - x0), (h - pad * 2 - 30) / (y1 - y0)));
    const target = zoomIdentity
      .translate(left + (w - left) / 2 - ((x0 + x1) / 2) * k, (h - 24) / 2 - ((y0 + y1) / 2) * k)
      .scale(k);
    animateTo(target, animate ? 500 : 0);
  }
  /**
   * With everything open the tree is far taller than the screen, so instead of shrinking
   * it to an unreadable size, the stage grows to the tree's full height and the page
   * scrolls through it like an outline.
   */
  function fitWhole(animate = true) {
    const w = stage.clientWidth;
    const pad = narrow() ? 16 : 40;
    const left = 40; // the zoom buttons
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of visible) {
      x0 = Math.min(x0, n.tx);
      y0 = Math.min(y0, n.ty);
      x1 = Math.max(x1, n.tx + n.w + 14);
      y1 = Math.max(y1, n.ty + n.h);
    }
    const k = Math.max(0.5, Math.min(1, (w - left - pad * 2) / (x1 - x0)));
    stage.style.height = `${Math.ceil((y1 - y0) * k + pad * 2 + 30)}px`;
    stage.classList.add('is-tall');
    pinPanel();
    animateTo(zoomIdentity.translate(left + pad - x0 * k, pad - y0 * k).scale(k), animate ? 500 : 0);
  }

  /** On a tall stage, keep the answer panel level with the part of the map on screen. */
  function pinPanel() {
    if (!stage.classList.contains('is-tall') || narrow()) return;
    const top = stage.getBoundingClientRect().top;
    const max = stage.clientHeight - panel.offsetHeight - 12;
    panel.style.top = `${Math.max(12, Math.min(max, 12 - top))}px`;
  }
  window.addEventListener('scroll', pinPanel, { passive: true });

  /**
   * After a change, frame the box that was opened with its parent and what it opened
   * into; with nothing in focus, frame everything that is showing.
   */
  function frame(focus?: Node, animate = true) {
    if (openAll) return fitWhole(animate);
    if (!focus) return fitTo(visible, animate);
    const family = [focus, ...(expanded.has(focus) ? focus.children : [])];
    if (focus.parent) family.push(focus.parent);
    fitTo(family, animate);
  }

  for (const b of stage.querySelectorAll<HTMLButtonElement>('.qmap-controls button')) {
    b.addEventListener('click', () => {
      if (b.dataset.zoom === 'fit') return frame(undefined);
      const { w, h } = viewBox();
      const k = Math.max(0.25, Math.min(1.8, transform.k * (b.dataset.zoom === 'in' ? 1.25 : 1 / 1.25)));
      const cx = (w / 2 - transform.x) / transform.k;
      const cy = (h / 2 - transform.y) / transform.k;
      animateTo(zoomIdentity.translate(w / 2 - cx * k, h / 2 - cy * k).scale(k), 250);
    });
  }

  // ---------- Selection: the selected box and the path back to the centre ----------
  let selected: Node | null = null;
  function trail() {
    const path = new Set(selected ? [selected, ...ancestors(selected)] : []);
    for (const n of nodes) {
      n.el.classList.toggle('is-selected', n === selected);
      n.el.classList.toggle('is-trail', path.has(n) && n !== selected);
      n.link?.classList.toggle('is-trail', path.has(n));
    }
  }

  // Question-type chips: show the whole map and highlight one kind of question.
  let filter: string | null = null;
  function setFilter(type: string | null) {
    filter = filter === type ? null : type;
    for (const c of chips) c.setAttribute('aria-pressed', String(c.dataset.filter === filter));
    svg.classList.toggle('has-filter', Boolean(filter));
    for (const n of nodes) n.el.classList.toggle('is-match', Boolean(filter && n.type === filter));
    if (filter) {
      openAll = true;
      for (const n of nodes) if (n.children.length) expanded.add(n);
      closePanel(false);
      sync();
    }
  }
  for (const c of chips) c.addEventListener('click', () => setFilter(c.dataset.filter!));

  // ---------- Opening a box ----------
  function button(label: string, onClick: () => void, meta?: string) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (meta) {
      const s = document.createElement('span');
      s.className = 'tmap-next-meta';
      s.textContent = meta;
      b.append(s);
    }
    b.addEventListener('click', onClick);
    li.append(b);
    return li;
  }
  function group(title: string, items: HTMLLIElement[], cls = '') {
    if (!items.length) return;
    const label = document.createElement('p');
    label.className = 'qa-label';
    label.textContent = title;
    const list = document.createElement('ul');
    if (cls) list.className = cls;
    list.append(...items);
    panelNext.append(label, list);
  }

  let opener: SVGGElement | null = null;
  function open(n: Node, fromKeyboard = false) {
    selected = n;
    opener = n.el;
    // Opening a box unfolds the path to it and what is inside it.
    for (const a of ancestors(n).reverse()) if (!expanded.has(a)) setFold(a, true);
    if (n.children.length) setFold(n, true);
    else if (n.parent && !openAll) for (const s of n.parent.children) if (s !== n) [s, ...descendants(s)].forEach((d) => expanded.delete(d));

    panelNext.replaceChildren();
    if (n === root) {
      panelKicker.textContent = 'How to use this map';
      panelTitle.textContent = n.label;
      const intro = document.createElement('div');
      intro.className = 'qa';
      const p = document.createElement('p');
      p.textContent = section.closest('.tmap-page')?.querySelector('.tmap-intro')?.textContent ?? '';
      intro.append(p);
      panelBody.replaceChildren(intro);
      group('Where to start', n.children.map((c) => button(c.label, () => open(c, true), question(c))));
    } else {
      const cat = categoryOf(n);
      panelKicker.textContent =
        n.depth === 1
          ? CATEGORY_LABEL[n.category]
          : n.type
            ? `${TYPE_LABEL[n.type]} · ${(n.depth >= 3 ? ancestors(n).find((a) => a.depth === 2)! : cat).label}`
            : n.when
              ? `In the news · ${n.when}`
              : cat.label;
      panelTitle.textContent = question(n);
      panelBody.replaceChildren(n.details!.querySelector('.qa')!.cloneNode(true));
      const inside = n.depth === 1 ? (n.category === 'news' ? 'Stories, newest first' : 'Topics') : n.depth === 2 ? 'Questions' : 'Go deeper';
      group(inside, n.children.map((c) => button(question(c), () => open(c, true), c.type ? TYPE_LABEL[c.type] : c.when)));
      group('Connected ideas', n.related.map((r) => button(question(r), () => open(r, true), categoryOf(r).label.startsWith('In ') ? categoryOf(r).label : `In ${categoryOf(r).label}`)), 'is-related');
      if (n.parent && n.parent !== root) group('Back to', [button(question(n.parent), () => open(n.parent!, true))], 'is-back');
    }

    const wasHidden = panel.hidden;
    panel.hidden = false;
    panel.scrollTop = 0;
    section.classList.add('has-panel');
    if (wasHidden) requestAnimationFrame(() => panel.classList.add('is-open'));
    pinPanel();
    sync(n === root ? undefined : n);
    if (fromKeyboard || narrow()) panelTitle.focus({ preventScroll: true });
  }

  function closePanel(returnFocus = true) {
    if (panel.hidden) return;
    panel.classList.remove('is-open');
    section.classList.remove('has-panel');
    selected = null;
    trail();
    const done = () => {
      if (!panel.classList.contains('is-open')) panel.hidden = true;
    };
    if (reducedMotion()) done();
    else setTimeout(done, 260);
    if (returnFocus) opener?.focus({ preventScroll: true });
  }

  for (const n of nodes) {
    n.el.addEventListener('click', (e) => {
      // The fold button only folds or unfolds; the rest of the box opens the answer.
      if ((e.target as Element).closest('.tmap-fold')) {
        e.stopPropagation();
        setFold(n, !expanded.has(n));
        return sync(expanded.has(n) ? n : n.parent);
      }
      open(n);
    });
    n.el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(n, true);
      } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && n.children.length) {
        e.preventDefault();
        setFold(n, e.key === 'ArrowRight');
        sync(n);
      }
    });
  }
  panel.querySelector('.qmap-close')!.addEventListener('click', () => closePanel());
  section.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      e.preventDefault();
      closePanel();
    }
  });
  svg.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('.tmap-node')) closePanel(false);
  });

  expandBtn.addEventListener('click', () => {
    openAll = !openAll;
    expanded.clear();
    expanded.add(root);
    if (openAll) for (const n of nodes) if (n.children.length) expanded.add(n);
    if (!openAll && filter) setFilter(filter);
    closePanel(false);
    sync();
  });

  // Swipe the bottom sheet down to close it (phones).
  const grab = panel.querySelector<HTMLElement>('.qmap-grab')!;
  let startY: number | null = null;
  panel.addEventListener('touchstart', (e) => {
    if (e.target === grab || panel.scrollTop <= 0) startY = e.touches[0].clientY;
  }, { passive: true });
  panel.addEventListener('touchmove', (e) => {
    if (startY === null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0 && panel.scrollTop <= 0) panel.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  panel.addEventListener('touchend', (e) => {
    if (startY === null) return;
    const dy = e.changedTouches[0].clientY - startY;
    panel.style.transform = '';
    startY = null;
    if (dy > 90 && panel.scrollTop <= 0) closePanel(false);
  });

  // ---------- Size ----------
  let lastNarrow = narrow();
  function resize(force = false) {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    if (force || narrow() !== lastNarrow) {
      lastNarrow = narrow();
      drawAll();
      nodes.forEach(showFold);
      layout();
      for (const n of visible) ((n.x = n.tx), (n.y = n.ty));
      render();
    }
    frame(selected && selected !== root ? selected : undefined, false);
  }

  stage.querySelector('.qmap-loading')?.remove();
  stage.prepend(svg);
  drawAll();
  // Start with the three categories showing.
  visible = nodes.filter(shown);
  for (const n of visible) nodeLayer.append(n.el);
  sync();
  for (const n of visible) ((n.x = n.tx), (n.y = n.ty));
  render();
  new ResizeObserver(() => resize()).observe(stage);
  resize(true);
  stage.classList.add('is-ready');
}
