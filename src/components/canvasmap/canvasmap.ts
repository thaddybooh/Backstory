// A topic map drawn as a mind map on an open canvas (a preview, at /lab/). The subject
// sits in the middle; its categories, topics and questions radiate out from it in
// sectors, so the whole map can be seen from above at once. Each topic and its questions
// form a loose group, like a group on a canvas. Click any bubble to fly into it: the
// camera frames it and what is inside, everything else fades back, and its answer opens
// in the side panel. Bubbles can be dragged to rearrange the canvas.

import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';

interface Source {
  title: string;
  publication: string;
  url: string;
}
interface Data {
  title: string;
  dek: string;
  nodes: {
    id: string;
    parent?: string;
    depth: number;
    category: string;
    label: string;
    question: string;
    answer: string[];
    sources: Source[];
    type?: string;
    when?: string;
    issue?: string;
    related: string[];
  }[];
  types: Record<string, string>;
  kinds: Record<string, string>;
}
interface Node {
  id: string;
  depth: number;
  category: string;
  label: string;
  question: string;
  answer: string[];
  sources: Source[];
  type?: string;
  when?: string;
  issue?: string;
  parent?: Node;
  children: Node[];
  related: Node[];
  el: HTMLButtonElement;
  link?: SVGPathElement;
  w: number;
  h: number;
  // Where the bubble sits (its centre), and the angle it hangs off the centre at.
  x: number;
  y: number;
  angle: number;
}

const SVG = 'http://www.w3.org/2000/svg';
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TYPE_TAG: Record<string, string> = {
  basics: 'Basics',
  initiative: 'Initiative',
  why: 'Why',
  what: 'What’s changing',
  who: 'Who’s affected',
  means: 'What it means',
  debate: 'Debate',
};
// Below this zoom the map is a bird's-eye view: questions shrink to coloured tiles and
// the big bubbles grow so their names stay readable.
const FAR = 0.62;

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

// A small seeded random number generator, so the canvas looks the same on every visit.
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function mountCanvasMap(section: HTMLElement) {
  const data: Data = JSON.parse(section.querySelector('#cv-data')!.textContent!);
  const stage = section.querySelector<HTMLElement>('.cv-stage')!;
  const world = section.querySelector<HTMLElement>('.cv-world')!;
  const linkSvg = section.querySelector<SVGSVGElement>('.cv-links')!;
  const nodeLayer = section.querySelector<HTMLElement>('.cv-nodes')!;
  const trail = section.querySelector<HTMLElement>('.cv-trail')!;
  const panel = section.querySelector<HTMLElement>('.cv-panel')!;
  const panelKicker = panel.querySelector<HTMLElement>('.cv-panel-kicker')!;
  const panelTitle = panel.querySelector<HTMLElement>('.cv-panel-title')!;
  const panelBody = panel.querySelector<HTMLElement>('.cv-panel-body')!;
  const mini = section.querySelector<SVGSVGElement>('.cv-mini svg')!;
  const narrow = () => section.clientWidth < 640;

  // ---------- Nodes ----------
  const card = (n: Pick<Node, 'id' | 'depth' | 'category' | 'label' | 'type' | 'when' | 'issue'>, kids: number) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'cv-node';
    el.dataset.depth = String(Math.min(n.depth, 3));
    el.dataset.id = n.id;
    if (n.category) el.dataset.category = n.category;
    if (n.type) el.dataset.type = n.type;
    const tag = n.type ? TYPE_TAG[n.type] : n.when ? n.when : n.depth === 1 ? data.kinds[n.category] : '';
    el.innerHTML = `<span class="cv-scale"><span class="cv-card">${
      tag && n.depth >= 2 ? `<span class="cv-tag">${tag}${n.issue && n.depth === 2 ? ' · Issue' : ''}</span>` : ''
    }<span class="cv-label"></span>${kids && n.depth >= 1 ? `<span class="cv-count">${kids}</span>` : ''}</span></span>`;
    el.querySelector('.cv-label')!.textContent = n.label;
    // A gentle drift, each bubble on its own rhythm.
    el.style.setProperty('--float', `${(-Math.random() * 8).toFixed(2)}s`);
    return el;
  };

  const root: Node = {
    id: '__root', depth: 0, category: '', label: data.title, question: data.title, answer: [data.dek], sources: [],
    children: [], related: [], el: undefined!, w: 0, h: 0, x: 0, y: 0, angle: 0,
  };
  const byId = new Map<string, Node>();
  const nodes: Node[] = [root];
  for (const d of data.nodes) {
    const parent = d.parent ? byId.get(d.parent)! : root;
    const n: Node = { ...d, parent, children: [], related: [], el: undefined!, w: 0, h: 0, x: 0, y: 0, angle: 0 };
    parent.children.push(n);
    byId.set(n.id, n);
    nodes.push(n);
  }
  // Related ideas work both ways: if A points to B, B lists A too.
  for (const d of data.nodes)
    for (const id of d.related) {
      const a = byId.get(d.id)!;
      const b = byId.get(id);
      if (!b) continue;
      if (!a.related.includes(b)) a.related.push(b);
      if (!b.related.includes(a)) b.related.push(a);
    }
  for (const n of nodes) {
    n.el = card(n, n.children.length);
    n.el.setAttribute('aria-label', n === root ? `${n.label}: the whole map` : n.question);
    nodeLayer.append(n.el);
  }
  const ancestors = (n: Node) => {
    const out: Node[] = [];
    for (let p = n.parent; p; p = p.parent) out.push(p);
    return out;
  };
  const descendants = (n: Node): Node[] => n.children.flatMap((c) => [c, ...descendants(c)]);

  // ---------- Links and groups ----------
  const groupLayer = svgEl('g', { class: 'cv-groups' });
  const linkLayer = svgEl('g', { class: 'cv-tree' });
  const relatedLayer = svgEl('g', { class: 'cv-related' });
  linkSvg.append(groupLayer, linkLayer, relatedLayer);
  for (const n of nodes) {
    if (!n.parent) continue;
    n.link = svgEl('path', { class: 'cv-link', 'data-category': n.category, 'data-depth': Math.min(n.depth, 3), pathLength: 1 });
    n.link.style.setProperty('--delay', `${(n.depth * 0.16).toFixed(2)}s`);
    linkLayer.append(n.link);
  }
  // Each topic with questions under it gets a soft group behind it and its questions.
  const groups = nodes
    .filter((n) => n.depth === 2 && n.children.length)
    .map((n) => {
      const g = svgEl('g', { class: 'cv-group', 'data-category': n.category });
      const path = svgEl('path');
      g.append(path);
      groupLayer.append(g);
      return { node: n, g, path };
    });

  // ---------- Layout ----------
  // A radial tree: every leaf gets an equal share of the circle, so busy branches get
  // wider sectors. Categories sit on an inner ring, topics on a middle ring and their
  // questions fan out beyond them. A little seeded jitter keeps it from looking like a
  // dartboard, then overlapping bubbles push each other apart.
  function measure() {
    for (const n of nodes) {
      n.w = n.el.offsetWidth;
      n.h = n.el.offsetHeight;
    }
  }
  function layout() {
    const rand = seeded(7);
    const small = narrow();
    const R1 = small ? 620 : 700;
    const R2 = small ? 1100 : 1220;
    const R3 = small ? 1520 : 1680;
    // A topic with no questions under it still needs room for its own (big) bubble.
    const weight = (n: Node): number =>
      n.children.length ? n.children.reduce((s, c) => s + weight(c), 0) + 0.6 : n.depth <= 2 ? 1.8 : 1;
    const cats = root.children;
    const gap = 0.07;
    const total = cats.reduce((s, c) => s + weight(c), 0);
    const span = Math.PI * 2 - gap * cats.length;
    // Start so the first category sits at the top left.
    let a = -Math.PI * 0.95;
    for (const c of cats) {
      const share = (weight(c) / total) * span;
      c.angle = a + share / 2;
      const topics = c.children;
      const tw = topics.reduce((s, t) => s + weight(t), 0);
      let ta = a;
      topics.forEach((t, i) => {
        const tShare = (weight(t) / tw) * share;
        t.angle = ta + tShare / 2 + (rand() - 0.5) * tShare * 0.15;
        // Neighbouring topics alternate between two rings when they are crowded.
        const crowded = tShare * R2 < 440;
        const r = R2 + (crowded && i % 2 ? 220 : 0) + (rand() - 0.5) * 60;
        t.x = Math.cos(t.angle) * r;
        t.y = Math.sin(t.angle) * r;
        const qs = t.children;
        qs.forEach((q, j) => {
          const qa = ta + (tShare * (j + 0.5)) / qs.length;
          q.angle = qa + (rand() - 0.5) * (tShare / qs.length) * 0.3;
          const tight = (tShare / qs.length) * R3 < 200;
          const qr = r - R2 + R3 + (tight && j % 2 ? 190 : 0) + (rand() - 0.5) * 50;
          q.x = Math.cos(q.angle) * qr;
          q.y = Math.sin(q.angle) * qr;
          // Anything deeper hangs further out still.
          descendants(q).forEach((d, k) => {
            d.angle = q.angle;
            d.x = Math.cos(q.angle) * (qr + 220 * (k + 1));
            d.y = Math.sin(q.angle) * (qr + 220 * (k + 1));
          });
        });
        ta += tShare;
      });
      // A category sits between the middle of its sector and the middle of its topics.
      c.x = Math.cos(c.angle) * R1;
      c.y = Math.sin(c.angle) * R1;
      a += share + gap;
    }
    // Stretch the circle into an oval that matches the screen, so the bird's-eye view
    // fills a wide window (or a tall phone) instead of leaving empty sides.
    const stretch = Math.max(0.8, Math.min(1.4, Math.sqrt(stage.clientWidth / stage.clientHeight)));
    for (const n of nodes) {
      n.x *= stretch;
      n.y /= stretch;
    }
    separate();
  }
  // Push overlapping bubbles apart (the centre stays put; big bubbles move less), while
  // a weak spring keeps each near where the radial layout put it.
  function separate(only?: Set<Node>) {
    const home = new Map(nodes.map((n) => [n, { x: n.x, y: n.y }]));
    const M = 30;
    const mass = (n: Node) => (n === root ? Infinity : n.depth === 1 ? 4 : n.depth === 2 ? 2 : 1);
    // The big bubbles grow in the bird's-eye view (see canvasmap.css), so give them room.
    const grow = (n: Node) => (n.depth === 2 ? 1.9 : n.depth < 2 ? 1.5 : 1);
    for (let it = 0; it < 260; it++) {
      let moved = false;
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const p = nodes[i];
          const q = nodes[j];
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const ox = (p.w * grow(p) + q.w * grow(q)) / 2 + M - Math.abs(dx);
          const oy = (p.h * grow(p) + q.h * grow(q)) / 2 + M - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          moved = true;
          const mp = only && !only.has(p) ? Infinity : mass(p);
          const mq = only && !only.has(q) ? Infinity : mass(q);
          if (mp === Infinity && mq === Infinity) continue;
          const sp = mp === Infinity ? 0 : mq === Infinity ? 1 : mq / (mp + mq);
          const sq = 1 - sp;
          // Move along the axis that needs the smaller push, plus a little outward drift.
          if (ox < oy) {
            const s = Math.sign(dx) || 1;
            p.x -= s * ox * sp;
            q.x += s * ox * sq;
          } else {
            const s = Math.sign(dy) || 1;
            p.y -= s * oy * sp;
            q.y += s * oy * sq;
          }
        }
      if (it < 200)
        for (const n of nodes) {
          if (n === root || (only && !only.has(n))) continue;
          const h = home.get(n)!;
          n.x += (h.x - n.x) * 0.03;
          n.y += (h.y - n.y) * 0.03;
        }
      if (!moved && it > 200) break;
    }
  }

  // ---------- Drawing ----------
  function place(n: Node) {
    n.el.style.setProperty('--x', `${n.x.toFixed(1)}px`);
    n.el.style.setProperty('--y', `${n.y.toFixed(1)}px`);
  }
  // Branches curve out from the centre: each end of the curve leaves along the line
  // from the centre, so the map reads as one organism rather than a wiring diagram.
  function curve(a: Node, b: Node, bend = 0.42) {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const out = (n: Node) => {
      const r = Math.hypot(n.x, n.y) || 1;
      return n === root ? [(b.x - a.x) / d, (b.y - a.y) / d] : [n.x / r, n.y / r];
    };
    const [ax, ay] = out(a);
    const [bx, by] = out(b);
    const c = d * bend;
    return `M${a.x.toFixed(1)},${a.y.toFixed(1)} C${(a.x + ax * c).toFixed(1)},${(a.y + ay * c).toFixed(1)} ${(b.x - bx * c).toFixed(1)},${(b.y - by * c).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  }
  function drawLink(n: Node) {
    if (n.link && n.parent) n.link.setAttribute('d', curve(n.parent, n));
  }
  // A group's outline: the convex hull around its bubbles, drawn with a thick round
  // stroke so its corners are soft.
  function hull(members: Node[]) {
    const pad = 18;
    const pts: [number, number][] = [];
    for (const n of members)
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) pts.push([n.x + sx * (n.w / 2 + pad), n.y + sy * (n.h / 2 + pad)]);
    pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower: [number, number][] = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper: [number, number][] = [];
    for (const p of pts.reverse()) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    const h = [...lower.slice(0, -1), ...upper.slice(0, -1)];
    return `M${h.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}Z`;
  }
  function drawGroups() {
    for (const g of groups) g.path.setAttribute('d', hull([g.node, ...descendants(g.node)]));
  }
  function drawAll() {
    nodes.forEach(place);
    nodes.forEach(drawLink);
    drawGroups();
    drawMini();
  }

  // ---------- Camera ----------
  let t: ZoomTransform = zoomIdentity;
  const zoom = d3zoom<HTMLElement, unknown>()
    .scaleExtent([0.05, 2.2])
    // Ctrl/⌘ + scroll (and trackpad pinch) zooms; plain scroll pans, as on most canvases.
    // Mouse drags that start on a bubble move the bubble instead of the canvas.
    .filter((e: any) => {
      if (e.type === 'wheel') return e.ctrlKey || e.metaKey;
      if (e.type === 'mousedown' && (e.target as Element).closest('.cv-node')) return false;
      return !e.button;
    })
    .on('zoom', (e) => apply(e.transform));
  const sel = select(stage);
  sel.call(zoom).on('dblclick.zoom', null);
  stage.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      stopFlight();
      zoom.translateBy(sel, -e.deltaX / t.k, -e.deltaY / t.k);
    },
    { passive: false },
  );

  function apply(next: ZoomTransform) {
    t = next;
    world.style.transform = `translate(${t.x}px,${t.y}px) scale(${t.k})`;
    world.style.setProperty('--k', String(t.k));
    stage.dataset.zoom = t.k < FAR ? 'far' : 'near';
    // The dotted canvas moves with the map.
    const g = 28 * t.k;
    stage.style.backgroundSize = `${g}px ${g}px`;
    stage.style.backgroundPosition = `${t.x}px ${t.y}px`;
    drawMiniView();
  }

  // The area of the stage not covered by the panel, where framed bubbles should sit.
  let panelOpen = false;
  function viewBox() {
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    if (!panelOpen) return { x: 0, y: 0, w: W, h: H };
    if (narrow()) return { x: 0, y: 0, w: W, h: H * 0.56 };
    const pw = panel.offsetWidth + 24;
    return { x: 0, y: 0, w: W - pw, h: H };
  }
  function frameFor(members: Node[], maxK = 1.15) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of members) {
      x0 = Math.min(x0, n.x - n.w / 2);
      y0 = Math.min(y0, n.y - n.h / 2);
      x1 = Math.max(x1, n.x + n.w / 2);
      y1 = Math.max(y1, n.y + n.h / 2);
    }
    const v = viewBox();
    const pad = narrow() ? 24 : 56;
    // Leave room for the title in the top left.
    const top = members.length > 3 ? (narrow() ? (active ? 64 : 100) : 110) : 40;
    const kw = (v.w - pad * 2) / (x1 - x0);
    const kh = (v.h - pad - top) / (y1 - y0);
    // On a tall, narrow phone, fitting the whole width leaves the map tiny: let it run
    // off the sides a little instead, to be panned.
    const k = Math.min(maxK, narrow() && v.h > v.w ? Math.min(kh, kw * 1.7) : Math.min(kw, kh));
    return zoomIdentity
      .translate(v.x + v.w / 2, v.y + top + (v.h - pad - top) / 2)
      .scale(k)
      .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
  }
  // Fly the camera: zoom out a little on long trips, so you see where you are going.
  let flight = 0;
  const stopFlight = () => {
    cancelAnimationFrame(flight);
    flight = 0;
  };
  function fly(to: ZoomTransform, ms = 950) {
    stopFlight();
    if (reducedMotion()) return sel.call(zoom.transform, to);
    const from = t;
    const W = stage.clientWidth / 2;
    const H = stage.clientHeight / 2;
    // Work in "which world point is in the middle, at what scale".
    const c0 = [(W - from.x) / from.k, (H - from.y) / from.k];
    const c1 = [(W - to.x) / to.k, (H - to.y) / to.k];
    const dist = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]);
    const bump = Math.min(1.1, (dist * Math.min(from.k, to.k)) / (stage.clientWidth * 1.4));
    const start = performance.now();
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const e = ease(p);
      const k = Math.exp(Math.log(from.k) + (Math.log(to.k) - Math.log(from.k)) * e - bump * Math.sin(Math.PI * e));
      const cx = c0[0] + (c1[0] - c0[0]) * e;
      const cy = c0[1] + (c1[1] - c0[1]) * e;
      sel.call(zoom.transform, zoomIdentity.translate(W - cx * k, H - cy * k).scale(k));
      flight = p < 1 ? requestAnimationFrame(tick) : 0;
    };
    flight = requestAnimationFrame(tick);
  }
  stage.addEventListener('pointerdown', stopFlight);

  const overview = () => frameFor(nodes, 1);
  section.querySelector('[data-zoom="in"]')!.addEventListener('click', () => fly(scaleAround(1.5), 350));
  section.querySelector('[data-zoom="out"]')!.addEventListener('click', () => fly(scaleAround(1 / 1.5), 350));
  section.querySelector('[data-zoom="fit"]')!.addEventListener('click', () => select_(undefined));
  function scaleAround(f: number) {
    const v = viewBox();
    const k = Math.max(0.05, Math.min(2.2, t.k * f));
    const cx = (v.x + v.w / 2 - t.x) / t.k;
    const cy = (v.y + v.h / 2 - t.y) / t.k;
    return zoomIdentity.translate(v.x + v.w / 2 - cx * k, v.y + v.h / 2 - cy * k).scale(k);
  }

  // ---------- Minimap ----------
  // A tiny bird's-eye view in the corner, with the part on screen outlined.
  let miniBox = { x: 0, y: 0, w: 1, h: 1 };
  const miniView = svgEl('rect', { class: 'cv-mini-view', rx: 6 });
  function drawMini() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nodes) {
      x0 = Math.min(x0, n.x - n.w / 2);
      y0 = Math.min(y0, n.y - n.h / 2);
      x1 = Math.max(x1, n.x + n.w / 2);
      y1 = Math.max(y1, n.y + n.h / 2);
    }
    const pad = 80;
    miniBox = { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
    mini.setAttribute('viewBox', `${miniBox.x} ${miniBox.y} ${miniBox.w} ${miniBox.h}`);
    mini.replaceChildren(
      ...nodes.map((n) =>
        svgEl('circle', {
          cx: n.x.toFixed(0),
          cy: n.y.toFixed(0),
          r: [90, 70, 48, 28][Math.min(n.depth, 3)],
          'data-category': n.category,
          'data-depth': Math.min(n.depth, 3),
          class: n.el.classList.contains('is-dim') ? 'is-dim' : '',
        }),
      ),
      miniView,
    );
    drawMiniView();
  }
  function drawMiniView() {
    miniView.setAttribute('x', String(-t.x / t.k));
    miniView.setAttribute('y', String(-t.y / t.k));
    miniView.setAttribute('width', String(stage.clientWidth / t.k));
    miniView.setAttribute('height', String(stage.clientHeight / t.k));
  }
  function miniJump(e: PointerEvent) {
    const r = mini.getBoundingClientRect();
    // The SVG keeps its aspect ratio, so work out the drawn area inside the element.
    const s = Math.min(r.width / miniBox.w, r.height / miniBox.h);
    const wx = miniBox.x + (e.clientX - r.left - (r.width - miniBox.w * s) / 2) / s;
    const wy = miniBox.y + (e.clientY - r.top - (r.height - miniBox.h * s) / 2) / s;
    stopFlight();
    sel.call(zoom.transform, zoomIdentity.translate(stage.clientWidth / 2 - wx * t.k, stage.clientHeight / 2 - wy * t.k).scale(t.k));
  }
  mini.addEventListener('pointerdown', (e) => {
    mini.setPointerCapture(e.pointerId);
    miniJump(e);
    const move = (ev: PointerEvent) => miniJump(ev);
    mini.addEventListener('pointermove', move);
    mini.addEventListener('pointerup', () => mini.removeEventListener('pointermove', move), { once: true });
  });

  // ---------- Focus: flying into a bubble ----------
  let active: Node | undefined;
  function select_(n: Node | undefined, opts: { fly?: boolean; focusPanel?: boolean } = {}) {
    active = n && n !== root ? n : undefined;
    const lit = new Set<Node>();
    const path = new Set<Node>();
    if (active) {
      ancestors(active).forEach((a) => path.add(a));
      [active, ...path, ...descendants(active), ...active.related].forEach((m) => lit.add(m));
      // A question keeps its brothers and sisters in view, so you can read across.
      if (!active.children.length && active.parent) active.parent.children.forEach((s) => lit.add(s));
    }
    for (const m of nodes) {
      m.el.classList.toggle('is-active', m === active);
      m.el.classList.toggle('is-path', path.has(m));
      m.el.classList.toggle('is-related', !!active && active.related.includes(m));
      m.el.classList.toggle('is-dim', !!active && !lit.has(m));
      m.link?.classList.toggle('is-lit', !!active && (path.has(m) || m === active || (lit.has(m) && lit.has(m.parent!))));
      m.link?.classList.toggle('is-dim', !!active && !lit.has(m));
    }
    for (const g of groups) g.g.classList.toggle('is-dim', !!active && !lit.has(g.node));
    drawRelated();
    drawMini();
    showTrail();
    section.classList.toggle('is-focused', !!active);
    if (active) openPanel(active, opts.focusPanel);
    else closePanel();
    if (opts.fly !== false) {
      if (!active) fly(overview(), 1100);
      else {
        const members = active.children.length
          ? [active, ...active.children]
          : [active.parent!, ...active.parent!.children];
        fly(frameFor(members, active.children.length ? 1.1 : 1.2));
      }
    }
    try {
      history.replaceState(null, '', active ? `#${active.id}` : location.pathname);
    } catch {}
  }
  // Dashed threads to related ideas elsewhere on the map.
  function drawRelated() {
    relatedLayer.replaceChildren(
      ...(active?.related ?? []).map((r) =>
        svgEl('path', { class: 'cv-rel', d: curve(active!, r, 0.25), 'data-category': r.category, pathLength: 1 }),
      ),
    );
  }
  function showTrail() {
    if (!active) {
      trail.hidden = true;
      return;
    }
    trail.hidden = false;
    const steps = [...ancestors(active).reverse(), active];
    trail.replaceChildren(
      ...steps.flatMap((s, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = s === root ? 'Whole map' : s.label;
        if (s === active) b.setAttribute('aria-current', 'location');
        b.addEventListener('click', () => select_(s));
        if (i === 0) return [b];
        const sep = document.createElement('span');
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '›';
        return [sep, b];
      }),
    );
  }

  // ---------- The answer panel ----------
  function openPanel(n: Node, focus = false) {
    panelOpen = true;
    const cat = n.depth === 1 ? n : ancestors(n).find((a) => a.depth === 1)!;
    panel.dataset.category = n.category;
    panelKicker.textContent = [data.kinds[cat.category], n.type ? data.types[n.type] : n.when].filter(Boolean).join(' · ');
    panelTitle.textContent = n.question;
    const h = (tag: string, cls: string, text = '') => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      el.textContent = text;
      return el;
    };
    const out: HTMLElement[] = n.answer.map((p) => h('p', '', p));
    if (n.issue) {
      const a = h('a', 'cv-read', 'Read the full But Why? issue →') as HTMLAnchorElement;
      a.href = `/issues/${n.issue}/`;
      out.push(a);
    }
    const jumpList = (title: string, list: Node[]) => {
      if (!list.length) return;
      out.push(h('p', 'cv-label-sm', title));
      const ul = h('ul', 'cv-jumps');
      for (const m of list) {
        const li = document.createElement('li');
        const b = h('button', '', '') as HTMLButtonElement;
        b.type = 'button';
        b.dataset.category = m.category;
        if (m.type) b.dataset.type = m.type;
        b.append(h('span', 'cv-jump-tag', m.type ? TYPE_TAG[m.type] : m.when ?? data.kinds[m.category] ?? ''), h('span', '', m.question));
        b.addEventListener('click', () => select_(m, { focusPanel: true }));
        li.append(b);
        ul.append(li);
      }
      out.push(ul);
    };
    jumpList('Go deeper', n.children);
    jumpList('Connected ideas elsewhere on the map', n.related);
    if (n.sources.length) {
      out.push(h('p', 'cv-label-sm', 'Sources to dig deeper'));
      const ul = h('ul', 'cv-sources');
      for (const s of n.sources) {
        const li = document.createElement('li');
        const a = h('a', '', s.title) as HTMLAnchorElement;
        a.href = s.url;
        a.rel = 'noopener';
        li.append(a, h('span', '', s.publication));
        ul.append(li);
      }
      out.push(ul);
    }
    if (n.parent && n.parent !== root) {
      const up = h('button', 'cv-up', `↑ Back to ${n.parent.label}`) as HTMLButtonElement;
      up.type = 'button';
      up.addEventListener('click', () => select_(n.parent));
      out.push(up);
    }
    panelBody.replaceChildren(...out);
    panel.scrollTop = 0;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('is-open'));
    if (focus) panelTitle.focus({ preventScroll: true });
  }
  function closePanel() {
    panelOpen = false;
    panel.classList.remove('is-open');
    setTimeout(() => {
      if (!panel.classList.contains('is-open')) panel.hidden = true;
    }, 300);
  }
  panel.querySelector('.cv-close')!.addEventListener('click', () => {
    const n = active;
    select_(undefined, { fly: false });
    n?.el.focus({ preventScroll: true });
  });
  section.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Step back out one level at a time.
    select_(active?.parent);
  });

  // ---------- Clicking, hovering and dragging bubbles ----------
  for (const n of nodes) {
    n.el.addEventListener('click', (e) => {
      if (dragged) {
        e.preventDefault();
        return;
      }
      select_(n === active ? n.parent : n);
    });
    n.el.addEventListener('pointerenter', () => hot(n, true));
    n.el.addEventListener('pointerleave', () => hot(n, false));
    n.el.addEventListener('focus', () => hot(n, true));
    n.el.addEventListener('blur', () => hot(n, false));
  }
  function hot(n: Node, on: boolean) {
    for (const a of [n, ...ancestors(n)]) a.link?.classList.toggle('is-hot', on);
    for (const c of n.children) c.link?.classList.toggle('is-hot', on);
  }
  // Clicking empty canvas (without dragging) goes back to the whole map.
  let down: { x: number; y: number } | undefined;
  stage.addEventListener('pointerdown', (e) => {
    if (!(e.target as Element).closest('.cv-node')) down = { x: e.clientX, y: e.clientY };
  });
  stage.addEventListener('pointerup', (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5 && active) select_(undefined, { fly: false });
    down = undefined;
  });

  // Drag a bubble with a mouse or pen to move it; its lines and group follow.
  let dragged = false;
  nodeLayer.addEventListener('pointerdown', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('.cv-node');
    if (!el || e.pointerType === 'touch' || e.button) return;
    const n = nodes.find((m) => m.el === el)!;
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = n.x;
    const oy = n.y;
    dragged = false;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / t.k;
      const dy = (ev.clientY - sy) / t.k;
      if (!dragged && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      if (!dragged) {
        dragged = true;
        el.setPointerCapture(e.pointerId);
        el.classList.add('is-dragging');
      }
      n.x = ox + dx;
      n.y = oy + dy;
      place(n);
      drawLink(n);
      n.children.forEach(drawLink);
      drawGroups();
      if (active) drawRelated();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      el.classList.remove('is-dragging');
      if (dragged) drawMini();
      // Let the click that follows a drag see the flag, then clear it.
      setTimeout(() => (dragged = false), 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  });

  // ---------- Start ----------
  function build() {
    measure();
    layout();
    drawAll();
  }
  build();
  // Every bubble starts tucked into the centre, then the map blooms outwards, ring by ring.
  const final = nodes.map((n) => ({ x: n.x, y: n.y }));
  apply(overview());
  sel.call(zoom.transform, overview());
  const linger = !reducedMotion();
  if (linger) {
    for (const n of nodes) {
      n.el.style.setProperty('--x', '0px');
      n.el.style.setProperty('--y', '0px');
      n.el.style.setProperty('--delay', `${(n.depth * 0.16 + Math.random() * 0.12).toFixed(2)}s`);
    }
    section.classList.add('is-blooming');
  }
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      nodes.forEach((n, i) => {
        n.x = final[i].x;
        n.y = final[i].y;
        place(n);
      });
      section.classList.add('is-ready');
      setTimeout(() => {
        section.classList.remove('is-blooming');
        nodes.forEach((n) => n.el.style.removeProperty('--delay'));
      }, 1900);
      const fromHash = byId.get(decodeURIComponent(location.hash.slice(1)));
      if (fromHash) setTimeout(() => select_(fromHash), linger ? 900 : 0);
    }),
  );

  // Re-frame when the window changes size.
  let resizeTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (active) select_(active);
      else sel.call(zoom.transform, overview());
    }, 150);
  }).observe(stage);
}
