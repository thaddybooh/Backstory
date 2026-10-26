// The interactive question graph. It reads the questions from the list the page already
// rendered (see QuestionGraph.astro), lays them out with a force simulation and draws
// them as SVG, so every node is a real focusable element styled by the site's CSS.

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  forceRadial,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';
import { drag as d3drag } from 'd3-drag';

type Kind = 'centre' | 'question' | 'follow';

interface Node extends SimulationNodeDatum {
  id: string;
  kind: Kind;
  label: string;
  parent?: string;
  details?: HTMLDetailsElement;
  el?: SVGGElement;
  r: number;
  phase: number;
}
type Link = SimulationLinkDatum<Node> & { source: Node; target: Node };

const SVG = 'http://www.w3.org/2000/svg';
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

function addLabel(g: SVGGElement, text: string, y: number, max: number, lines?: number) {
  const t = svgEl('text', { class: 'qmap-label', y, 'text-anchor': 'middle' });
  wrap(text, max, lines).forEach((line, i) => {
    const span = svgEl('tspan', { x: 0, dy: i === 0 ? 0 : '1.15em' });
    span.textContent = line;
    t.append(span);
  });
  g.append(t);
}

export function mountGraph(section: HTMLElement) {
  const stage = section.querySelector<HTMLElement>('.qmap-stage')!;
  const panel = stage.querySelector<HTMLElement>('.qmap-panel')!;
  const panelTitle = panel.querySelector<HTMLElement>('.qmap-panel-title')!;
  const panelKicker = panel.querySelector<HTMLElement>('.qmap-panel-kicker')!;
  const panelBody = panel.querySelector<HTMLElement>('.qmap-panel-body')!;
  const panelNext = panel.querySelector<HTMLElement>('.qmap-panel-next')!;
  const toggles = [...section.querySelectorAll<HTMLButtonElement>('.qmap-toggle button')];

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
  for (const b of toggles) b.setAttribute('aria-pressed', String(b.dataset.view === (document.documentElement.dataset.qmapView ?? 'graph')));

  // ---------- Nodes and links, read from the rendered list ----------
  const narrow = () => stage.clientWidth < 560;
  const centre: Node = { id: '__centre', kind: 'centre', label: stage.dataset.title ?? '', r: 40, phase: 0, fx: 0, fy: 0 };
  const nodes: Node[] = [centre];
  const links: Link[] = [];
  const byId = new Map<string, Node>([[centre.id, centre]]);
  const questions = [...section.querySelectorAll<HTMLDetailsElement>('.qmap-list details')];
  const topCount = questions.filter((d) => !d.dataset.parent).length;
  let qi = 0;
  for (const details of questions) {
    const parent = details.dataset.parent ? byId.get(details.dataset.parent) : undefined;
    const kind: Kind = parent ? 'follow' : 'question';
    // Start everything close to the centre, fanned out, so the graph blooms outwards.
    const angle = parent ? Math.atan2(parent.y!, parent.x!) + (Math.random() - 0.5) : (qi++ / topCount) * Math.PI * 2;
    const dist = parent ? 40 : 20;
    const node: Node = {
      id: details.dataset.node!,
      kind,
      label: details.dataset.label!,
      parent: parent?.id,
      details,
      r: kind === 'question' ? 11 : 6.5,
      phase: Math.random() * Math.PI * 2,
      x: (parent?.x ?? 0) + Math.cos(angle) * dist,
      y: (parent?.y ?? 0) + Math.sin(angle) * dist,
    };
    nodes.push(node);
    byId.set(node.id, node);
    links.push({ source: parent ?? centre, target: node });
  }
  const neighbours = new Map<Node, Set<Node>>(nodes.map((n) => [n, new Set([n])]));
  for (const l of links) {
    neighbours.get(l.source)!.add(l.target);
    neighbours.get(l.target)!.add(l.source);
  }

  // ---------- SVG ----------
  const svg = svgEl('svg', { class: 'qmap-svg', role: 'group', 'aria-label': 'Question graph' });
  const defs = svgEl('defs');
  const clipId = `qmap-clip-${Math.random().toString(36).slice(2, 8)}`;
  const clip = svgEl('clipPath', { id: clipId });
  const clipCircle = svgEl('circle', { r: centre.r });
  clip.append(clipCircle);
  defs.append(clip);
  const viewport = svgEl('g', { class: 'qmap-viewport' });
  const linkLayer = svgEl('g', { class: 'qmap-links' });
  const nodeLayer = svgEl('g', { class: 'qmap-nodes' });
  viewport.append(linkLayer, nodeLayer);
  svg.append(defs, viewport);

  const linkEls = links.map((l) => {
    const line = svgEl('line', { class: `qmap-link qmap-link-${l.target.kind}` });
    linkLayer.append(line);
    return line;
  });

  // Keyboard order follows the list: the story, then each question followed by its follow-ups.
  for (const n of nodes) {
    const g = svgEl('g', { class: `qmap-node qmap-${n.kind}`, tabindex: 0 });
    n.el = g;
    if (n.kind === 'centre') {
      g.setAttribute('role', 'link');
      g.setAttribute('aria-label', stage.dataset.centreLabel ?? n.label);
      g.append(svgEl('circle', { class: 'qmap-halo', r: n.r + 7 }));
      g.append(svgEl('circle', { class: 'qmap-dot', r: n.r }));
      if (stage.dataset.image) {
        g.append(
          svgEl('image', {
            href: stage.dataset.image,
            x: -n.r,
            y: -n.r,
            width: n.r * 2,
            height: n.r * 2,
            preserveAspectRatio: 'xMidYMid slice',
            'clip-path': `url(#${clipId})`,
          }),
        );
      }
      g.append(svgEl('circle', { class: 'qmap-ring', r: n.r }));
    } else {
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', n.details!.querySelector('summary')!.textContent!.trim());
      g.setAttribute('aria-haspopup', 'dialog');
      g.append(svgEl('circle', { class: 'qmap-halo', r: n.r + 6 }));
      g.append(svgEl('circle', { class: 'qmap-hit', r: n.r + 14 }));
      g.append(svgEl('circle', { class: 'qmap-dot', r: n.r }));
    }
    nodeLayer.append(g);
  }

  function drawLabels() {
    const small = narrow();
    for (const n of nodes) {
      n.el!.querySelector('.qmap-label')?.remove();
      if (n.kind === 'centre') {
        const r = small ? 32 : 42;
        n.r = r;
        for (const c of n.el!.querySelectorAll('circle')) c.setAttribute('r', String(c.classList.contains('qmap-halo') ? r + 7 : r));
        clipCircle.setAttribute('r', String(r));
        const img = n.el!.querySelector('image');
        img?.setAttribute('x', String(-r));
        img?.setAttribute('y', String(-r));
        img?.setAttribute('width', String(r * 2));
        img?.setAttribute('height', String(r * 2));
        addLabel(n.el!, n.label, r + 22, small ? 18 : 22, 3);
      } else addLabel(n.el!, n.label, n.r + (small ? 14 : 16), small ? 14 : 17, 3);
    }
  }

  stage.querySelector('.qmap-loading')?.remove();
  stage.prepend(svg);
  drawLabels();

  // ---------- Force layout ----------
  const spread = () => {
    const s = Math.min(stage.clientWidth, stage.clientHeight);
    return { q: Math.max(110, Math.min(205, s * 0.36)), f: narrow() ? 64 : 108 };
  };
  const linkForce = forceLink<Node, Link>(links)
    .distance((l) => (l.target.kind === 'follow' ? spread().f : spread().q))
    .strength((l) => (l.target.kind === 'follow' ? 0.9 : 0.6));
  const ringForce = forceRadial<Node>((n) => (n.kind === 'follow' ? spread().q + spread().f : n.kind === 'question' ? spread().q : 0))
    .strength((n) => (n.kind === 'centre' ? 0 : n.kind === 'follow' ? 0.35 : 0.2));
  const sim = forceSimulation<Node>(nodes)
    .force('link', linkForce)
    .force('charge', forceManyBody<Node>().strength((n) => (n.kind === 'follow' ? -140 : -420)).distanceMax(420))
    .force('collide', forceCollide<Node>().radius((n) => (n.kind === 'centre' ? n.r + 50 : n.kind === 'question' ? 58 : 46)))
    // Questions settle on an inner ring and follow-ups on an outer one, so a follow-up's
    // label never sits on top of its question's.
    .force('ring', ringForce)
    .force('x', forceX<Node>(0).strength(0.02))
    .force('y', forceY<Node>(0).strength(0.04))
    .velocityDecay(0.35)
    .alphaDecay(0.025);

  // A slow sway once the layout has settled, so the graph feels alive (skipped for reduced motion).
  let t = 0;
  const drift = () => {
    t += 1;
    for (const n of nodes) {
      if (n.fx != null) continue;
      n.vx! += Math.cos(t * 0.012 + n.phase) * 0.018;
      n.vy! += Math.sin(t * 0.010 + n.phase * 1.3) * 0.018;
    }
  };

  function render() {
    links.forEach((l, i) => {
      const el = linkEls[i];
      el.setAttribute('x1', l.source.x!.toFixed(1));
      el.setAttribute('y1', l.source.y!.toFixed(1));
      el.setAttribute('x2', l.target.x!.toFixed(1));
      el.setAttribute('y2', l.target.y!.toFixed(1));
    });
    for (const n of nodes) n.el!.setAttribute('transform', `translate(${n.x!.toFixed(1)},${n.y!.toFixed(1)})`);
  }

  let fitted = false;
  sim.on('tick', () => {
    render();
    if (!fitted && sim.alpha() < 0.12) {
      fitted = true;
      fit(true);
      if (!reducedMotion()) sim.force('drift', drift).alphaTarget(0.012);
    }
  });
  if (reducedMotion()) {
    sim.stop();
    sim.tick(320);
    render();
    fitted = true;
  }

  // Pause the simulation when the graph is off screen or the tab is hidden.
  let visible = true;
  const wake = () => {
    if (visible && !document.hidden && !reducedMotion()) return void sim.restart();
    sim.stop();
    // Off screen before the layout settled: finish it now so the graph is ready, and
    // framed, when the reader scrolls to it.
    if (!fitted) {
      while (sim.alpha() > 0.12) sim.tick();
      render();
      fitted = true;
      fit(false);
      if (!reducedMotion()) sim.force('drift', drift).alphaTarget(0.012);
    }
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    wake();
  }).observe(stage);
  document.addEventListener('visibilitychange', wake);

  // ---------- Zoom and pan ----------
  // Mouse: drag the background to pan, Ctrl/⌘ + scroll (or a trackpad pinch) to zoom.
  // Touch: one finger scrolls the page as normal; two fingers pan and pinch-zoom.
  let transform: ZoomTransform = zoomIdentity;
  const zoomer = d3zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.35, 3])
    .filter((ev: any) => {
      if (ev.type === 'wheel') return ev.ctrlKey || ev.metaKey;
      if (ev.type.startsWith('touch')) return ev.touches.length >= 2;
      return !ev.button;
    })
    .on('zoom', (ev) => {
      transform = ev.transform;
      viewport.setAttribute('transform', transform.toString());
      svg.classList.toggle('is-zoomed-in', transform.k >= 1.25);
    });
  const svgSel = select(svg as SVGSVGElement);
  svgSel.call(zoomer).on('dblclick.zoom', null);

  function animateTo(target: ZoomTransform, ms = 650) {
    if (reducedMotion() || ms === 0) {
      svgSel.call(zoomer.transform, target);
      return;
    }
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
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** The visible area, leaving room for the answer panel on wide screens. */
  function viewBox() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const side = !panel.hidden && !narrow() ? panel.offsetWidth + 24 : 0;
    return { w: w - side, h };
  }

  function fit(animate = false) {
    const { w, h } = viewBox();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nodes) {
      const pad = n.kind === 'centre' ? 80 : 62;
      x0 = Math.min(x0, n.x! - pad);
      x1 = Math.max(x1, n.x! + pad);
      y0 = Math.min(y0, n.y! - 30);
      y1 = Math.max(y1, n.y! + (n.kind === 'centre' ? 110 : 66));
    }
    const k = Math.max(0.35, Math.min(1.1, w / (x1 - x0), h / (y1 - y0)));
    const target = zoomIdentity
      .translate(w / 2 - ((x0 + x1) / 2) * k, h / 2 - ((y0 + y1) / 2) * k)
      .scale(k);
    animateTo(target, animate ? 650 : 0);
  }

  /** Brings a node into the part of the graph the panel doesn't cover. */
  function reveal(n: Node) {
    const { w, h } = viewBox();
    const k = transform.k;
    const sx = transform.x + n.x! * k;
    const sy = transform.y + n.y! * k;
    const marginX = Math.min(120, w / 4);
    const visibleH = narrow() && !panel.hidden ? h * 0.38 : h;
    if (sx > marginX && sx < w - marginX && sy > 60 && sy < visibleH - 60) return;
    animateTo(zoomIdentity.translate(w / 2 - n.x! * k, visibleH / 2 - n.y! * k).scale(k), 450);
  }

  for (const b of stage.querySelectorAll<HTMLButtonElement>('.qmap-controls button')) {
    b.addEventListener('click', () => {
      if (b.dataset.zoom === 'fit') return fit(true);
      const { w, h } = viewBox();
      const k = Math.max(0.35, Math.min(3, transform.k * (b.dataset.zoom === 'in' ? 1.3 : 1 / 1.3)));
      const cx = (w / 2 - transform.x) / transform.k;
      const cy = (h / 2 - transform.y) / transform.k;
      animateTo(zoomIdentity.translate(w / 2 - cx * k, h / 2 - cy * k).scale(k), 250);
    });
  }

  // ---------- Dragging nodes ----------
  let dragged = false;
  for (const n of nodes) {
    if (n.kind === 'centre') continue;
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
          // d3-drag reports positions in the node layer's coordinates, which already
          // account for zoom and pan.
          const { x, y } = ev;
          n.fx = x;
          n.fy = y;
          if (reducedMotion()) {
            n.x = x;
            n.y = y;
            sim.tick(4);
            render();
          }
        })
        .on('end', () => {
          if (!reducedMotion()) sim.alphaTarget(0.012);
          n.fx = null;
          n.fy = null;
        }),
    );
  }

  // ---------- Highlighting ----------
  let selected: Node | null = null;
  function light(n: Node | null) {
    const lit = n ? neighbours.get(n)! : null;
    svg.classList.toggle('has-focus', Boolean(n));
    for (const m of nodes) m.el!.classList.toggle('is-lit', Boolean(lit?.has(m)));
    links.forEach((l, i) => linkEls[i].classList.toggle('is-lit', Boolean(n && (l.source === n || l.target === n))));
  }
  const relight = () => light(selected);
  for (const n of nodes) {
    n.el!.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && light(n));
    n.el!.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && relight());
    n.el!.addEventListener('focus', () => light(n));
    n.el!.addEventListener('blur', relight);
  }

  // ---------- Opening a question ----------
  let opener: SVGGElement | null = null;
  function open(n: Node, fromKeyboard = false) {
    if (n.kind === 'centre') {
      const href = stage.dataset.href!;
      if (href.startsWith('#')) document.getElementById(href.slice(1))?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
      else location.href = href;
      return;
    }
    selected?.el!.classList.remove('is-selected');
    selected = n;
    n.el!.classList.add('is-selected');
    n.el!.setAttribute('aria-expanded', 'true');
    opener = n.el!;
    relight();

    const parent = n.parent ? byId.get(n.parent) : undefined;
    const index = nodes.filter((m) => m.kind === 'question').indexOf(parent ?? n) + 1;
    panelKicker.textContent = parent ? `Follow-up to “${parent.label}”` : `Question ${index} of ${topCount}`;
    panelTitle.textContent = n.details!.querySelector('summary')!.textContent;
    panelBody.replaceChildren(n.details!.querySelector('.qa')!.cloneNode(true));

    // Links to the follow-ups, or back to the question this follows on from.
    panelNext.replaceChildren();
    const next = parent ? [parent] : nodes.filter((m) => m.parent === n.id);
    if (next.length) {
      const label = document.createElement('p');
      label.className = 'qa-label';
      label.textContent = parent ? 'Back to' : 'Follow-up questions';
      const list = document.createElement('ul');
      for (const m of next) {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = m.details!.querySelector('summary')!.textContent;
        b.addEventListener('click', () => open(m, true));
        li.append(b);
        list.append(li);
      }
      panelNext.append(label, list);
    }

    // Going to the section closes the panel; on the issue page it is a jump within the page.
    panelBody.querySelector('.qa-read')?.addEventListener('click', () => closePanel(false));

    const wasHidden = panel.hidden;
    panel.hidden = false;
    panel.scrollTop = 0;
    section.classList.add('has-panel');
    if (wasHidden) requestAnimationFrame(() => panel.classList.add('is-open'));
    reveal(n);
    if (fromKeyboard || narrow()) panelTitle.focus({ preventScroll: true });
  }

  function closePanel(returnFocus = true) {
    if (panel.hidden) return;
    panel.classList.remove('is-open');
    section.classList.remove('has-panel');
    selected?.el!.classList.remove('is-selected');
    selected?.el!.setAttribute('aria-expanded', 'false');
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
  // Clicking the empty background closes the panel.
  svg.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('.qmap-node')) closePanel(false);
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
      linkForce.distance((l) => (l.target.kind === 'follow' ? spread().f : spread().q));
      ringForce.radius((n) => (n.kind === 'follow' ? spread().q + spread().f : n.kind === 'question' ? spread().q : 0));
      sim.alpha(0.5).restart();
      fitted = false;
    } else if (fitted) fit(false);
  }
  new ResizeObserver(resize).observe(stage);
  resize();
  stage.classList.add('is-ready');
}
