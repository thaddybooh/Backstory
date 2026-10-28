// The interactive topic map. Like the issue question graph (../graph/graph.ts), it reads
// its questions from the list the page already rendered and draws them as SVG, so every
// node is a real focusable element styled by the site's CSS. What is different:
//
// - The map is a tree of any depth. Branches start folded; opening a question unfolds
//   the questions beneath it, so the map grows as the reader explores.
// - Positions come from a radial tree layout (each branch gets a slice of the circle in
//   proportion to how much of it is open); a light force simulation eases nodes there
//   and keeps labels from overlapping.
// - Dashed curves link related ideas across branches.
// - What the reader has opened is remembered in their browser, shown as a progress bar,
//   a ring around each branch, and a badge when a branch is fully explored.

import { forceSimulation, forceCollide, forceX, forceY, type SimulationNodeDatum } from 'd3-force';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';
import { drag as d3drag } from 'd3-drag';

type Kind = 'centre' | 'branch' | 'question';

interface Node extends SimulationNodeDatum {
  id: string;
  kind: Kind;
  depth: number;
  label: string;
  news: boolean;
  type?: string;
  when?: string;
  parent?: Node;
  branch?: Node;
  children: Node[];
  related: Node[];
  details?: HTMLDetailsElement;
  el?: SVGGElement;
  ring?: SVGCircleElement;
  badge?: SVGTextElement;
  r: number;
  tx: number;
  ty: number;
  phase: number;
}
interface Link {
  source: Node;
  target: Node;
  related: boolean;
  el: SVGPathElement;
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

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** Splits a label into lines of roughly `max` characters, at most `lines` lines. */
function wrap(text: string, max: number, lines = 3) {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > max) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  if (out.length > lines) {
    out.length = lines;
    out[lines - 1] = out[lines - 1].replace(/\s*\S*$/, '') + '…';
  }
  return out;
}

function addLabel(g: SVGGElement, text: string, y: number, max: number, lines = 3, extra?: string) {
  const t = svgEl('text', { class: 'qmap-label', y, 'text-anchor': 'middle' });
  wrap(text, max, lines).forEach((line, i) => {
    const span = svgEl('tspan', { x: 0, dy: i === 0 ? 0 : '1.15em' });
    span.textContent = line;
    t.append(span);
  });
  if (extra) {
    const span = svgEl('tspan', { x: 0, dy: '1.3em', class: 'tmap-when' });
    span.textContent = extra;
    t.append(span);
  }
  g.append(t);
}

export function mountTopicMap(section: HTMLElement) {
  const mapId = section.dataset.map!;
  const stage = section.querySelector<HTMLElement>('.qmap-stage')!;
  const panel = stage.querySelector<HTMLElement>('.qmap-panel')!;
  const panelTitle = panel.querySelector<HTMLElement>('.qmap-panel-title')!;
  const panelKicker = panel.querySelector<HTMLElement>('.qmap-panel-kicker')!;
  const panelBody = panel.querySelector<HTMLElement>('.qmap-panel-body')!;
  const panelNext = panel.querySelector<HTMLElement>('.qmap-panel-next')!;
  const toast = stage.querySelector<HTMLElement>('.tmap-toast')!;
  const toggles = [...section.querySelectorAll<HTMLButtonElement>('.qmap-toggle button')];
  const expandBtn = section.querySelector<HTMLButtonElement>('[data-action="expand"]')!;
  const surpriseBtn = section.querySelector<HTMLButtonElement>('[data-action="surprise"]')!;
  const chips = [...section.querySelectorAll<HTMLButtonElement>('.tmap-chip')];
  const narrow = () => stage.clientWidth < 560;

  // ---------- Nodes, read from the rendered list ----------
  const centre: Node = {
    id: '__centre', kind: 'centre', depth: 0, label: stage.dataset.title ?? '', news: false,
    children: [], related: [], r: 44, tx: 0, ty: 0, x: 0, y: 0, fx: 0, fy: 0, phase: 0,
  };
  const nodes: Node[] = [centre];
  const byId = new Map<string, Node>();
  for (const details of section.querySelectorAll<HTMLDetailsElement>('.tmap-list details')) {
    const d = details.dataset;
    const parent = d.parent ? byId.get(d.parent)! : centre;
    const depth = Number(d.depth);
    const n: Node = {
      id: d.node!, kind: depth === 1 ? 'branch' : 'question', depth, label: d.label!, news: d.kind === 'news',
      type: d.type, when: d.when, parent, children: [], related: [], details,
      r: depth === 1 ? 17 : depth === 2 ? 9 : 7, tx: 0, ty: 0, phase: Math.random() * Math.PI * 2,
    };
    n.branch = depth === 1 ? n : parent.branch;
    parent.children.push(n);
    nodes.push(n);
    byId.set(n.id, n);
  }
  // Related ideas work both ways: if A points to B, B's panel lists A too.
  for (const details of section.querySelectorAll<HTMLDetailsElement>('.tmap-list details[data-related]')) {
    const a = byId.get(details.dataset.node!)!;
    for (const id of details.dataset.related!.split(' ')) {
      const b = byId.get(id);
      if (!b) continue;
      if (!a.related.includes(b)) a.related.push(b);
      if (!b.related.includes(a)) b.related.push(a);
    }
  }
  const questions = nodes.filter((n) => n.kind !== 'centre');
  const branches = centre.children;
  const question = (n: Node) => n.details!.querySelector('summary')!.lastChild!.textContent!.trim();
  const descendants = (n: Node): Node[] => n.children.flatMap((c) => [c, ...descendants(c)]);

  // ---------- What the reader has explored, remembered per browser ----------
  const storeKey = `tmap:${mapId}`;
  const visited = new Set<string>();
  try {
    for (const id of JSON.parse(localStorage.getItem(storeKey) ?? '[]')) if (byId.has(id)) visited.add(id);
  } catch {}
  const save = () => {
    try {
      localStorage.setItem(storeKey, JSON.stringify([...visited]));
    } catch {}
  };
  const explored = section.querySelector<HTMLElement>('[data-explored]')!;
  const meter = section.querySelector<HTMLElement>('.tmap-meter')!;
  const badges = section.querySelector<HTMLElement>('[data-badges]')!;
  const branchDone = (b: Node) => [b, ...descendants(b)].every((n) => visited.has(n.id));

  function showProgress() {
    explored.textContent = String(visited.size);
    meter.setAttribute('aria-valuenow', String(visited.size));
    meter.querySelector('span')!.style.width = `${(visited.size / questions.length) * 100}%`;
    badges.replaceChildren(
      ...branches.filter(branchDone).map((b) => {
        const s = document.createElement('span');
        s.className = `tmap-badge${b.news ? ' is-news' : ''}`;
        s.textContent = `✓ ${b.label}`;
        return s;
      }),
    );
    for (const n of questions) {
      n.el?.classList.toggle('is-visited', visited.has(n.id));
      n.details!.classList.toggle('is-visited', visited.has(n.id));
    }
    for (const b of branches) {
      const all = [b, ...descendants(b)];
      const share = all.filter((n) => visited.has(n.id)).length / all.length;
      const c = 2 * Math.PI * (b.r + 5);
      b.ring!.setAttribute('stroke-dasharray', `${(share * c).toFixed(1)} ${c.toFixed(1)}`);
      b.ring!.style.opacity = share ? '1' : '0';
    }
  }

  let toastTimer = 0;
  function say(text: string) {
    toast.textContent = text;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('is-on'));
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('is-on');
      setTimeout(() => (toast.hidden = true), 300);
    }, 3200);
  }

  function visit(n: Node) {
    if (n.kind === 'centre' || visited.has(n.id)) return;
    const wasDone = branchDone(n.branch!);
    visited.add(n.id);
    save();
    showProgress();
    if (visited.size === questions.length) say('You’ve explored the whole map. Nicely done.');
    else if (!wasDone && branchDone(n.branch!)) say(`Branch explored: ${n.branch!.label} ✓`);
    else if (visited.size % 10 === 0) say(`${visited.size} questions explored. Keep going!`);
  }

  // ---------- View toggle (graph or list), remembered per browser ----------
  function setView(view: string) {
    document.documentElement.dataset.qmapView = view;
    for (const b of toggles) b.setAttribute('aria-pressed', String(b.dataset.view === view));
    try {
      localStorage.setItem('qmap-view', view);
    } catch {}
    if (view === 'graph') requestAnimationFrame(resize);
    else closePanel(false);
  }
  for (const b of toggles) b.addEventListener('click', () => setView(b.dataset.view!));
  for (const b of toggles)
    b.setAttribute('aria-pressed', String(b.dataset.view === (document.documentElement.dataset.qmapView ?? 'graph')));
  // Opening a question in the list counts as exploring it too.
  for (const n of questions) n.details!.addEventListener('toggle', () => n.details!.open && visit(n));

  // ---------- SVG ----------
  const svg = svgEl('svg', { class: 'qmap-svg tmap-svg', role: 'group', 'aria-label': 'Topic map' });
  const viewport = svgEl('g', { class: 'qmap-viewport' });
  const relatedLayer = svgEl('g', { class: 'tmap-related' });
  const linkLayer = svgEl('g', { class: 'qmap-links' });
  const nodeLayer = svgEl('g', { class: 'qmap-nodes' });
  viewport.append(relatedLayer, linkLayer, nodeLayer);
  svg.append(viewport);

  for (const n of nodes) {
    const g = svgEl('g', {
      class: `qmap-node tmap-node tmap-${n.kind} tmap-d${Math.min(n.depth, 3)} ${n.news ? 'tmap-news' : 'tmap-bg'}`,
      tabindex: 0,
    });
    if (n.type) g.dataset.type = n.type;
    n.el = g;
    g.append(svgEl('circle', { class: 'qmap-halo', r: n.r + 7 }));
    if (n.kind !== 'centre') g.append(svgEl('circle', { class: 'qmap-hit', r: n.r + 14 }));
    if (n.kind === 'branch') {
      n.ring = svgEl('circle', { class: 'tmap-ring', r: n.r + 5, transform: 'rotate(-90)' });
      g.append(svgEl('circle', { class: 'tmap-ring-track', r: n.r + 5 }), n.ring);
    }
    g.append(svgEl('circle', { class: 'qmap-dot', r: n.r }));
    if (n.kind === 'centre') {
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', `${n.label}: how to use this map`);
    } else {
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', question(n));
      g.setAttribute('aria-haspopup', 'dialog');
      if (n.children.length) {
        // A small "+N" tells the reader there are more questions folded inside.
        const bx = n.kind === 'branch' ? 0 : n.r + 5;
        const by = n.kind === 'branch' ? 5 : -n.r - 1;
        n.badge = svgEl('text', { class: 'tmap-more', x: bx, y: by, 'text-anchor': n.kind === 'branch' ? 'middle' : 'start' });
        g.append(n.badge);
      }
    }
    nodeLayer.append(g);
  }

  function drawLabels() {
    const small = narrow();
    for (const n of nodes) {
      n.el!.querySelector('.qmap-label')?.remove();
      if (n.kind === 'centre') addLabel(n.el!, n.label, 6, small ? 12 : 13, 3);
      else if (n.kind === 'branch') addLabel(n.el!, n.label, n.r + 20, small ? 14 : 16, 3, n.when);
      else addLabel(n.el!, n.label, n.r + (small ? 13 : 15), small ? 14 : 16, 3);
    }
    // The centre's title sits inside its circle, so shift it up by half its height.
    const t = centre.el!.querySelector<SVGTextElement>('.qmap-label')!;
    const lines = t.querySelectorAll('tspan').length;
    t.setAttribute('y', String(5 - (lines - 1) * 8.5));
  }

  stage.querySelector('.qmap-loading')?.remove();
  stage.prepend(svg);
  drawLabels();

  // ---------- Which nodes are showing ----------
  const expanded = new Set<Node>();
  const shown = (n: Node): boolean => n.kind === 'centre' || n.parent === centre || (expanded.has(n.parent!) && shown(n.parent!));
  let visible: Node[] = [];
  let links: Link[] = [];

  function syncVisible() {
    const next = nodes.filter(shown);
    const before = new Set(visible);
    for (const n of nodes) {
      const on = next.includes(n);
      if (on && !before.has(n) && n.parent) {
        // New nodes start on their parent, so the branch blooms outwards.
        n.x = (n.parent.x ?? 0) + (Math.random() - 0.5) * 6;
        n.y = (n.parent.y ?? 0) + (Math.random() - 0.5) * 6;
        n.vx = n.vy = 0;
      }
      if (on && !n.el!.isConnected) nodeLayer.append(n.el!);
      if (!on) n.el!.remove();
      if (n.badge) {
        const hidden = n.children.length;
        n.badge.textContent = expanded.has(n) ? '' : `+${hidden}`;
        n.el!.setAttribute('aria-expanded', String(expanded.has(n)));
      }
    }
    // Keep keyboard order the same as the list: re-append in tree order.
    for (const n of next) nodeLayer.append(n.el!);
    visible = next;

    for (const l of links) l.el.remove();
    links = [];
    for (const n of visible) {
      if (!n.parent) continue;
      const el = svgEl('path', { class: `qmap-link tmap-link tmap-link-d${Math.min(n.depth, 3)} ${n.news ? 'tmap-news' : 'tmap-bg'}` });
      linkLayer.append(el);
      links.push({ source: n.parent, target: n, related: false, el });
    }
    const seen = new Set<string>();
    for (const a of visible)
      for (const b of a.related) {
        const key = [a.id, b.id].sort().join('|');
        if (seen.has(key) || !visible.includes(b)) continue;
        seen.add(key);
        const el = svgEl('path', { class: 'tmap-rel' });
        relatedLayer.append(el);
        links.push({ source: a, target: b, related: true, el });
      }
    expandBtn.textContent = branches.every((b) => expanded.has(b)) ? 'Fold every branch' : 'Open every branch';
    layout();
    sim.nodes(visible);
    sim.alpha(0.8).restart();
    if (reducedMotion()) {
      for (const n of visible) if (n.kind !== 'centre') ((n.x = n.tx), (n.y = n.ty));
      sim.stop();
      render();
    }
    relight();
  }

  // ---------- Radial tree layout ----------
  // Each branch gets a slice of the circle in proportion to how many of its questions
  // are showing (with a floor, so folded branches keep room for their labels), and each
  // question gets a slice of its parent's slice.
  function layout() {
    const small = narrow();
    const weight = (n: Node): number => {
      const kids = n.children.filter((c) => visible.includes(c));
      const w = kids.length ? kids.reduce((s, c) => s + weight(c), 0) : 1;
      return n.kind === 'branch' ? Math.max(w, 2.4) : w;
    };
    const weights = branches.map(weight);
    const total = weights.reduce((a, b) => a + b, 0);
    const arc = small ? 60 : 78; // the space each question's label needs along its circle
    const step = small ? 100 : 145;
    // Questions sit on a ring one step outside the branches; make that ring long enough
    // to give every open question its own stretch of arc.
    const r1 = Math.max(small ? 125 : 165, (total * arc) / (2 * Math.PI) - step);
    const radius = (d: number) => (d === 0 ? 0 : r1 + (d - 1) * step - (d > 2 ? (d - 2) * 30 : 0));
    const place = (n: Node, a0: number, a1: number) => {
      const a = (a0 + a1) / 2;
      n.tx = Math.cos(a) * radius(n.depth);
      n.ty = Math.sin(a) * radius(n.depth);
      const kids = n.children.filter((c) => visible.includes(c));
      if (!kids.length) return;
      const ws = kids.map(weight);
      const sum = ws.reduce((x, y) => x + y, 0);
      // Pull a small family together around its parent rather than across its whole slice.
      const span = Math.min(a1 - a0, (sum * arc * 1.05) / radius(n.depth + 1));
      let s = a - span / 2;
      kids.forEach((c, i) => {
        const e = s + (span * ws[i]) / sum;
        place(c, s, e);
        s = e;
      });
    };
    let a = -Math.PI / 2 - (Math.PI * weights[0]) / total;
    branches.forEach((b, i) => {
      const e = a + (2 * Math.PI * weights[i]) / total;
      place(b, a, e);
      a = e;
    });
  }

  // ---------- Forces: ease each node to its place, keep labels apart ----------
  const sim = forceSimulation<Node>([])
    .force('x', forceX<Node>((n) => n.tx).strength(0.22))
    .force('y', forceY<Node>((n) => n.ty).strength(0.22))
    .force(
      'collide',
      forceCollide<Node>().radius((n) => (n.kind === 'centre' ? n.r + 30 : n.kind === 'branch' ? 46 : narrow() ? 28 : 40)).strength(0.7),
    )
    .velocityDecay(0.38)
    .alphaDecay(0.03);

  // A slow sway once things settle, so the map feels alive (skipped for reduced motion).
  let t = 0;
  const drift = () => {
    t += 1;
    for (const n of visible) {
      if (n.fx != null) continue;
      n.vx! += Math.cos(t * 0.012 + n.phase) * 0.012;
      n.vy! += Math.sin(t * 0.01 + n.phase * 1.3) * 0.012;
    }
  };
  if (!reducedMotion()) sim.force('drift', drift).alphaTarget(0.01);

  function render() {
    for (const l of links) {
      const { x: x1, y: y1 } = l.source as Required<Node>;
      const { x: x2, y: y2 } = l.target as Required<Node>;
      if (l.related) {
        // Bow cross-links towards the centre so they read as a different kind of line.
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        l.el.setAttribute('d', `M${x1.toFixed(1)},${y1.toFixed(1)} Q${(mx * 0.55).toFixed(1)},${(my * 0.55).toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`);
      } else l.el.setAttribute('d', `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`);
    }
    for (const n of visible) n.el!.setAttribute('transform', `translate(${n.x!.toFixed(1)},${n.y!.toFixed(1)})`);
  }
  sim.on('tick', render);

  // Pause the simulation when the map is off screen or the tab is hidden.
  let onScreen = true;
  const wake = () => {
    if (onScreen && !document.hidden && !reducedMotion()) sim.restart();
    else sim.stop();
  };
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    wake();
  }).observe(stage);
  document.addEventListener('visibilitychange', wake);

  // ---------- Zoom and pan ----------
  // Mouse: drag the background to pan, Ctrl/⌘ + scroll (or a trackpad pinch) to zoom.
  // Touch: one finger scrolls the page as normal; two fingers pan and pinch-zoom.
  let transform: ZoomTransform = zoomIdentity;
  const zoomer = d3zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 3])
    .filter((ev: any) => {
      if (ev.type === 'wheel') return ev.ctrlKey || ev.metaKey;
      if (ev.type.startsWith('touch')) return ev.touches.length >= 2;
      return !ev.button;
    })
    .on('zoom', (ev) => {
      transform = ev.transform;
      viewport.setAttribute('transform', transform.toString());
      svg.classList.toggle('is-zoomed-in', transform.k >= 0.95);
    });
  const svgSel = select(svg as SVGSVGElement);
  svgSel.call(zoomer).on('dblclick.zoom', null);

  let anim = 0;
  function animateTo(target: ZoomTransform, ms = 650) {
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

  /** Frames the given nodes (by default, everything showing), using where they are heading. */
  function fit(animate = false, only: Node[] = visible) {
    const { w, h } = viewBox();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of only) {
      const padX = n.kind === 'centre' ? 60 : 70;
      x0 = Math.min(x0, n.tx - padX);
      x1 = Math.max(x1, n.tx + padX);
      y0 = Math.min(y0, n.ty - 30);
      y1 = Math.max(y1, n.ty + (n.kind === 'branch' ? 90 : 62));
    }
    const k = Math.max(0.2, Math.min(1.1, w / (x1 - x0), h / (y1 - y0)));
    animateTo(zoomIdentity.translate(w / 2 - ((x0 + x1) / 2) * k, h / 2 - ((y0 + y1) / 2) * k).scale(k), animate ? 650 : 0);
  }

  for (const b of stage.querySelectorAll<HTMLButtonElement>('.qmap-controls button')) {
    b.addEventListener('click', () => {
      if (b.dataset.zoom === 'fit') return fit(true);
      const { w, h } = viewBox();
      const k = Math.max(0.2, Math.min(3, transform.k * (b.dataset.zoom === 'in' ? 1.3 : 1 / 1.3)));
      const cx = (w / 2 - transform.x) / transform.k;
      const cy = (h / 2 - transform.y) / transform.k;
      animateTo(zoomIdentity.translate(w / 2 - cx * k, h / 2 - cy * k).scale(k), 250);
    });
  }

  // ---------- Dragging nodes ----------
  let dragged = false;
  for (const n of questions) {
    select(n.el!).call(
      d3drag<SVGGElement, unknown>()
        .on('start', (ev) => {
          dragged = false;
          ev.sourceEvent.stopPropagation();
          if (!reducedMotion()) sim.alphaTarget(0.25).restart();
          n.fx = n.x;
          n.fy = n.y;
        })
        .on('drag', (ev) => {
          dragged = true;
          n.fx = ev.x;
          n.fy = ev.y;
          if (reducedMotion()) {
            n.x = ev.x;
            n.y = ev.y;
            render();
          }
        })
        .on('end', () => {
          if (!reducedMotion()) sim.alphaTarget(0.01);
          n.fx = null;
          n.fy = null;
        }),
    );
  }

  // ---------- Highlighting ----------
  let selected: Node | null = null;
  let filter: string | null = null;
  function light(n: Node | null) {
    const lit = new Set<Node>();
    if (n) {
      lit.add(n);
      if (n.parent) lit.add(n.parent);
      n.children.forEach((c) => lit.add(c));
      n.related.forEach((r) => lit.add(r));
    }
    svg.classList.toggle('has-focus', Boolean(n));
    for (const m of nodes) m.el!.classList.toggle('is-lit', lit.has(m));
    for (const l of links) l.el.classList.toggle('is-lit', Boolean(n && (l.source === n || l.target === n)));
  }
  const relight = () => light(selected);
  for (const n of nodes) {
    n.el!.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && light(n));
    n.el!.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && relight());
    n.el!.addEventListener('focus', () => light(n));
    n.el!.addEventListener('blur', relight);
  }

  // Question-type chips: highlight every "why" (or "who", ...) question in the map.
  function setFilter(type: string | null) {
    filter = filter === type ? null : type;
    for (const c of chips) c.setAttribute('aria-pressed', String(c.dataset.filter === filter));
    svg.classList.toggle('has-filter', Boolean(filter));
    for (const n of nodes) n.el!.classList.toggle('is-match', Boolean(filter && n.type === filter));
    if (filter) {
      for (const n of nodes) if (n.children.some((c) => c.type === filter || descendants(c).some((d) => d.type === filter))) expanded.add(n);
      syncVisible();
      fit(true);
      const count = nodes.filter((n) => n.type === filter).length;
      say(`${count} questions: ${TYPE_LABEL[filter]}`);
    }
  }
  for (const c of chips) c.addEventListener('click', () => setFilter(c.dataset.filter!));

  // ---------- Opening a question ----------
  /** Unfolds everything above a node so it is on the map. */
  function reveal(n: Node) {
    let changed = false;
    for (let p = n.parent; p && p !== centre; p = p.parent) {
      if (!expanded.has(p)) changed = true;
      expanded.add(p);
    }
    return changed;
  }

  function button(label: string, onClick: () => void, extra?: string) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (extra) {
      const s = document.createElement('span');
      s.className = 'tmap-next-meta';
      s.textContent = extra;
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
    selected?.el!.classList.remove('is-selected');
    selected = n;
    n.el!.classList.add('is-selected');
    opener = n.el!;
    visit(n);

    // Opening a question unfolds the questions beneath it.
    const grew = reveal(n) || (n.children.length > 0 && !expanded.has(n));
    if (n.children.length) expanded.add(n);
    if (grew) syncVisible();
    relight();

    panelNext.replaceChildren();
    if (n.kind === 'centre') {
      panelKicker.textContent = 'How to use this map';
      panelTitle.textContent = n.label;
      const intro = document.createElement('div');
      intro.className = 'qa';
      const p = document.createElement('p');
      p.textContent = section.closest('.tmap-page')?.querySelector('.tmap-intro')?.textContent ?? '';
      intro.append(p);
      panelBody.replaceChildren(intro);
      group('Start with the background', branches.filter((b) => !b.news).map((b) => button(b.label, () => open(b, true))));
      group('Then the news', branches.filter((b) => b.news).map((b) => button(b.label, () => open(b, true), b.when)), 'is-news');
    } else {
      const where = n.kind === 'branch' ? (n.news ? `In the news${n.when ? ` · ${n.when}` : ''}` : 'Background') : TYPE_LABEL[n.type!];
      panelKicker.textContent = n.kind === 'branch' ? where : `${where} · ${n.branch!.label}`;
      panelTitle.textContent = question(n);
      panelBody.replaceChildren(n.details!.querySelector('.qa')!.cloneNode(true));
      group(
        n.kind === 'branch' ? 'Questions on this branch' : 'Go deeper',
        n.children.map((c) => button(question(c), () => open(c, true), visited.has(c.id) ? '✓ explored' : TYPE_LABEL[c.type!])),
      );
      group(
        'Connected ideas',
        n.related.map((r) => button(question(r), () => open(r, true), `On “${r.branch!.label}”`)),
        'is-related',
      );
      if (n.parent && n.parent !== centre) group('Back to', [button(question(n.parent), () => open(n.parent!, true))], 'is-back');
    }

    const wasHidden = panel.hidden;
    panel.hidden = false;
    panel.scrollTop = 0;
    section.classList.add('has-panel');
    if (wasHidden) requestAnimationFrame(() => panel.classList.add('is-open'));
    // Frame the node with its family, so newly unfolded questions are in view.
    requestAnimationFrame(() => fit(true, n.kind === 'centre' ? visible : [n, ...(n.parent ? [n.parent] : []), ...n.children]));
    if (fromKeyboard || narrow()) panelTitle.focus({ preventScroll: true });
  }

  function closePanel(returnFocus = true) {
    if (panel.hidden) return;
    panel.classList.remove('is-open');
    section.classList.remove('has-panel');
    selected?.el!.classList.remove('is-selected');
    selected = null;
    relight();
    const done = () => {
      if (!panel.classList.contains('is-open')) panel.hidden = true;
    };
    if (reducedMotion()) done();
    else setTimeout(done, 260);
    if (returnFocus) opener?.focus({ preventScroll: true });
  }

  for (const n of nodes) {
    n.el!.addEventListener('click', () => {
      if (dragged) return void (dragged = false);
      open(n);
    });
    n.el!.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(n, true);
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
    if (!(e.target as Element).closest('.qmap-node')) closePanel(false);
  });

  expandBtn.addEventListener('click', () => {
    const all = branches.every((b) => expanded.has(b));
    closePanel(false);
    expanded.clear();
    if (!all) for (const n of nodes) if (n.children.length && n !== centre) expanded.add(n);
    syncVisible();
    fit(true);
  });
  surpriseBtn.addEventListener('click', () => {
    const left = questions.filter((n) => !visited.has(n.id));
    const pool = left.length ? left : questions;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (document.documentElement.dataset.qmapView === 'list') {
      reveal(pick);
      for (let p: Node | undefined = pick; p && p !== centre; p = p.parent) p.details!.open = p === pick || p.details!.open;
      pick.details!.open = true;
      pick.details!.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
      return;
    }
    open(pick, true);
    if (!left.length) say('You’ve seen them all, so here’s one to revisit.');
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
  function resize() {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    if (narrow() !== lastNarrow) {
      lastNarrow = narrow();
      drawLabels();
      layout();
      sim.alpha(0.6).restart();
    }
    fit(false);
  }
  new ResizeObserver(resize).observe(stage);

  syncVisible();
  showProgress();
  resize();
  stage.classList.add('is-ready');
}
