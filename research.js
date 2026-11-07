// Research page: three themes, each with a large edge-faded visual.
// The Decode panel hosts the shared SpuFz1 renderer (app.js), unchanged.

const NS = 'http://www.w3.org/2000/svg';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const tabs = [...document.querySelectorAll('.pillar')];
const panels = Object.fromEntries(tabs.map(tab => [tab.dataset.panel, document.getElementById(tab.getAttribute('aria-controls'))]));
let active = 'discover';
const hideTimers = {};

function seeded(seed) {
  return () => {
    seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function svg(tag, attrs = {}, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

/* ---------- Discover: part of a large circular tree of life ---------- */

// Simple line drawings, each centred on (0,0) within about ±22 units.
const ring = (n, r0, r1, alt) => Array.from({length:n}, (_, i) => {
  const a = i / n * Math.PI * 2, r = alt && i % 2 ? r1 - 4 : r1;
  return `M${(r0*Math.cos(a)).toFixed(1)} ${(r0*Math.sin(a)).toFixed(1)}L${(r*Math.cos(a)).toFixed(1)} ${(r*Math.sin(a)).toFixed(1)}`;
}).join('');
// One icon system: a ±27 grid, a single stroke weight and rounded ends.
const pentagon = (r, size) => Array.from({length:5}, (_, k) => {
  const a = k / 5 * Math.PI * 2 - Math.PI / 2;
  return `<circle class="dot" cx="${(r*Math.cos(a)).toFixed(1)}" cy="${(r*Math.sin(a)).toFixed(1)}" r="${size}"/>`;
}).join('');
const CRITTERS = {
  bacterium: {label:'bacterium', art:'<g transform="rotate(-20)"><rect x="-18" y="-8" width="36" height="16" rx="8"/><path d="M-9 0h6M2 0h6M18 0c4-4 7 4 11 0M-18 0c-4 4-7-4-11 0"/></g>'},
  archaeon: {label:'archaeon', art:'<g transform="rotate(8)"><rect x="-16" y="-16" width="32" height="32" rx="6"/><rect x="-9" y="-8" width="7" height="4" rx="2"/><rect x="2" y="-2" width="7" height="4" rx="2"/><rect x="-7" y="5" width="7" height="4" rx="2"/></g>'},
  diatom: {label:'diatom', art:`<circle r="23"/><circle r="19"/><circle r="7"/><path d="${ring(12, 7, 19, false)}"/>`},
  fern: {label:'fern', art:'<path d="M-3 26C-1 10 1-6 6-24"/><path d="M-2 16c-7 0-11-3-13-8M-1 16c7-1 11-4 13-9M0 6c-6 0-10-3-11-7M1 5c6-1 9-4 11-8M2-4c-5 0-8-2-9-6M3-5c5-1 7-3 9-7M4-13c-4 0-6-2-7-5M5-14c4-1 5-3 7-5"/>'},
  amoeba: {label:'amoeba', art:'<path d="M-20 3c-4-8 3-13 9-12 1-8 9-13 15-8 6-5 15-1 14 7 7 3 7 12 0 15 1 8-8 12-14 8-5 6-15 4-16-3-6 0-10-3-8-7z"/><circle cx="2" cy="1" r="5"/>'},
  chytrid: {label:'chytrid fungus', art:'<circle cx="-6" cy="-4" r="11"/><path d="M5-4c5-4 8 4 13 0s8 4 11 0M-12 6l-4 10M-6 7v11M0 6l4 10"/>'},
  mushroom: {label:'mushroom', art:'<path d="M-22 0a22 18 0 0 1 44 0z"/><path d="M-6 0v18a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V0"/><circle class="dot" cx="-9" cy="-8" r="1.6"/><circle class="dot" cx="3" cy="-12" r="1.6"/><circle class="dot" cx="11" cy="-5" r="1.6"/>'},
  jellyfish: {label:'jellyfish', art:'<path d="M-20 0a20 20 0 0 1 40 0c-3.3 3-6.7 3-10 0-3.3 3-6.7 3-10 0-3.3 3-6.7 3-10 0-3.3 3-6.7 3-10 0z"/><path d="M-12 5c-3 6 3 9 0 15M-4 5c3 6-3 9 0 15M4 5c-3 6 3 9 0 15M12 5c3 6-3 9 0 15"/>'},
  tardigrade: {label:'tardigrade', art:'<path d="M-22 0a10 10 0 0 1 10-10h22a12 12 0 0 1 12 12v0a8 8 0 0 1-8 8h-26a10 10 0 0 1-10-10z"/><path d="M-14 10v7M-5 10v7M4 10v7M13 10v7M-16 17h4M-7 17h4M2 17h4M11 17h4M-10-10v4M0-10v4"/><circle class="dot" cx="16" cy="-2" r="1.3"/>'},
  clam: {label:'hard clam', art:'<path d="M-22 6c0-16 10-24 22-24s22 8 22 24c-6 5-38 5-44 0z"/><path d="M-14 4c0-10 6-15 14-15s14 5 14 15M-6 4c0-4 2-7 6-7s6 3 6 7"/>'},
  urchin: {label:'sea urchin', accent:true, art:`<path d="${ring(20, 13, 27, true)}"/><circle r="13"/>${pentagon(6.5, 1.3)}`}
};
// Backbone follows the accepted relationships among the drawn organisms
// (two-domain tree: eukaryotes branch next to Asgard archaea). Each name is a
// clade of n tips with its drawing on tip `at`; the other tips are random.
const BACKBONE = [{name:'bacterium', n:424, at:419}, [{name:'archaeon', n:18, at:10}, [{n:6},
  [[{name:'diatom'}, {name:'fern'}],
   [{name:'amoeba'}, [[{name:'chytrid'}, {name:'mushroom'}],
     [{name:'jellyfish'}, [[{name:'tardigrade'}, {name:'clam'}], {name:'urchin'}]]]]]]]];

function buildTree(root) {
  const rand = seeded(20261031);
  const CX = 205, CY = 596, R = 500;
  let leaves = [];
  const icons = {};
  function grow(n, depth) {
    const node = {depth, children:[]};
    if (n <= 1) { leaves.push(node); return node; }
    const k = Math.max(1, Math.min(n - 1, Math.round(n * (0.2 + rand() * 0.6))));
    node.children = [grow(k, depth + 1), grow(n - k, depth + 1)];
    return node;
  }
  function build(spec, depth) {
    if (Array.isArray(spec)) return {depth, children:spec.map(s => build(s, depth + 1))};
    const first = leaves.length, n = spec.n || 8;
    const clade = grow(n, depth);
    if (spec.name) icons[spec.name] = leaves[first + (spec.at ?? n >> 1)];
    return clade;
  }
  const tree = build(BACKBONE, 0);
  const N = leaves.length;
  // Leaves sit evenly around the circle, rotated so the sea urchin lands at the
  // right of the view; the large bacterial clade runs on past the faded edge.
  const a0 = Math.PI * .04 - (leaves.indexOf(icons.urchin) + .5) / N * Math.PI * 2;
  leaves.forEach((leaf, i) => { leaf.a = a0 + (i + .5) / N * Math.PI * 2; });
  (function place(node, parentR) {
    if (node.children.length) {
      node.r = node.depth ? Math.max(parentR + 5, R * (1 - Math.pow(.87, node.depth)) * (.9 + rand() * .14)) : 0;
      node.children.forEach(c => place(c, node.r));
      const as = node.children.map(c => c.a);
      node.a = (Math.min(...as) + Math.max(...as)) / 2;
    } else node.r = R * (.975 + rand() * .025);
  })(tree, 0);

  const pt = (r, a) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  const f = n => n.toFixed(1);
  const layer = svg('g', {class:'tree-layer'}, root);
  const edges = svg('g', {}, layer), tips = svg('g', {}, layer), critters = svg('g', {}, layer);

  const chosen = Object.entries(icons).map(([name, leaf]) => ({name, leaf}));
  const urchinLeaf = chosen.find(c => c.name === 'urchin').leaf;
  (function mark(node) {
    node.onPath = node === urchinLeaf || node.children.some(mark);
    return node.onPath;
  })(tree);

  // Each branch picks up exactly where its parent stops, at a constant speed,
  // so growth flows without pauses. Speed drifts a little from clade to clade,
  // which keeps lineages out of step. Times are then scaled to a calm length.
  const pace = seeded(4242);
  (function time(node) {
    for (const c of node.children) {
      c.speed = Math.min(1.6, Math.max(.6, (node.speed || 1) * (.82 + pace() * .36)));
      const length = node.r * Math.abs(c.a - node.a) + (c.r - node.r);
      c.start = node.end || 0;
      c.end = c.start + length / c.speed;
      time(c);
    }
  })(tree);
  const ends = leaves.map(l => l.end).sort((a, b) => a - b);
  const scale = 6 / ends[Math.floor(ends.length * .9)];
  const sec = t => `${(t * scale).toFixed(2)}s`;

  (function draw(node) {
    for (const c of node.children) {
      const [x0, y0] = pt(node.r, node.a), [x1, y1] = pt(node.r, c.a), [x2, y2] = pt(c.r, c.a);
      const sweep = c.a > node.a ? 1 : 0, large = Math.abs(c.a - node.a) > Math.PI ? 1 : 0;
      const path = svg('path', {
        class: c.onPath ? 'edge on-path' : 'edge', pathLength:1,
        d:`M${f(x0)} ${f(y0)}A${f(node.r)} ${f(node.r)} 0 ${large} ${sweep} ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`,
        'stroke-width': Math.max(.7, 2.1 - c.depth * .09).toFixed(2),
        'stroke-opacity': c.onPath ? 1 : Math.max(.31, .75 - c.depth * .024).toFixed(2)
      }, edges);
      path.style.setProperty('--d', sec(c.start));
      path.style.setProperty('--t', sec(c.end - c.start));
      draw(c);
    }
  })(tree);
  for (const leaf of leaves) {
    const [x, y] = pt(leaf.r, leaf.a);
    const tip = svg('circle', {class:'tip', cx:f(x), cy:f(y), r:1.3}, tips);
    tip.style.setProperty('--d', sec(leaf.end));
  }

  chosen.forEach(({name, leaf}, i) => {
    const offset = 50 + (i % 2) * 26;
    const [x, y] = pt(leaf.r + offset, leaf.a), [tx, ty] = pt(leaf.r + 6, leaf.a), [ux, uy] = pt(leaf.r + offset - 24, leaf.a);
    const tie = svg('path', {class:'edge', pathLength:1, d:`M${f(tx)} ${f(ty)}L${f(ux)} ${f(uy)}`, 'stroke-width':.7, 'stroke-opacity':.45, 'stroke-linecap':'round'}, edges);
    tie.style.setProperty('--d', sec(leaf.end));
    tie.style.setProperty('--t', '.6s');
    addCritter(critters, name, x, y, sec(leaf.end + .25 / scale), 1.05);
  });
  return layer;
}
function addCritter(parent, name, x, y, delay, scale = 1) {
  const spec = CRITTERS[name];
  const g = svg('g', {class:`critter${spec.accent ? ' accent' : ''}`, transform:`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale})`}, parent);
  g.innerHTML = spec.art;
  g.setAttribute('aria-label', spec.label);
  g.style.setProperty('--d', delay);
}

const treeSvg = document.getElementById('tree');
const treeLayer = buildTree(treeSvg);
function growTree() {
  // Round caps would draw a dot at each ungrown branch; edges stay hidden until
  // their start time, and resetting skips the transitions entirely.
  treeSvg.classList.add('reset');
  treeSvg.classList.remove('grown');
  void treeSvg.getBoundingClientRect();
  treeSvg.classList.remove('reset');
  requestAnimationFrame(() => treeSvg.classList.add('grown'));
}
// A slight parallax so the tree seems to continue past the faded edge.
const visual = document.querySelector('.research-visual');
visual.addEventListener('pointermove', event => {
  if (active !== 'discover' || reducedMotion.matches || event.pointerType !== 'mouse') return;
  const box = visual.getBoundingClientRect();
  const dx = (event.clientX - box.left) / box.width - .5, dy = (event.clientY - box.top) / box.height - .5;
  treeLayer.style.transform = `translate(${(-dx * 36).toFixed(1)}px, ${(-dy * 28).toFixed(1)}px)`;
});
visual.addEventListener('pointerleave', () => { treeLayer.style.transform = ''; });

/* ---------- Redesign: a molecule designed together, written into DNA ---------- */

const genome = document.getElementById('genome');
const BASES = 'ACGT';
const rand = seeded(7);
const randomBase = () => BASES[Math.floor(rand() * 4)];
// The focus row sits near the top, just under the scientist and the AI model.
const ROWS = 11, FOCUS = 1, LENGTH = 220;
const rows = [];
for (let r = 0; r < ROWS; r++) {
  const row = document.createElement('div');
  row.className = `seq-row${r === FOCUS ? ' focus' : ''}`;
  row.setAttribute('aria-hidden', 'true');
  row.innerHTML = Array.from({length: r === FOCUS ? 150 : LENGTH}, () => `<b>${randomBase()}</b>`).join('');
  if (r !== FOCUS) {
    const distance = 3 + (r * 37 % 5), speed = 70 + (r * 53 % 60);
    row.animate([{transform:`translateX(${-distance}%)`}, {transform:`translateX(${distance}%)`}],
      {duration: speed * 1000, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out', delay: -r * 9000});
    row.style.opacity = Math.max(.14, 1 - Math.abs(r - FOCUS) / 9).toFixed(2);
  }
  genome.appendChild(row);
  rows.push(row);
}
const focusRow = rows[FOCUS];
const cellsOf = () => focusRow.children;
let editTimers = [], edited = [];
function blip() {
  const row = rows[Math.floor(rand() * ROWS)];
  if (row === focusRow) return;
  const cell = row.children[Math.floor(rand() * row.children.length)];
  cell.classList.add('blip');
  editTimers.push(setTimeout(() => cell.classList.remove('blip'), 1600));
}

/* Above the sequence: a scientist and an AI design a molecule together,
   in several rounds on one hand-drawn sketch. The DNA row below is the
   molecule's code, and every unit of the drawing owns its own letters there:
   one per base pair of DNA, one per nucleotide of RNA, three (a codon) per
   amino acid of a protein. Changes (coral) land on exactly those letters. A
   changed RNA base pair changes both partners, so the stem stays paired
   (covariation) and its two letters sit far apart, mirrored around the loop.
   It cycles through DNA, RNA and protein; research.html?cowork=rna shows RNA only. */

const MODE = new URLSearchParams(location.search).get('cowork') === 'rna' ? 'rna' : 'dogma';
const ORDER = MODE === 'dogma' ? ['dna', 'rna', 'protein'] : ['rna'];
const zh = document.documentElement.lang.startsWith('zh');
const W = 640, H = 226;
const coSvg = svg('svg', {class:'cowork', 'aria-hidden':'true'});
panels.redesign.appendChild(coSvg);
const scene = svg('g', {}, coSvg);
// One bust, facing right; the AI is the same figure mirrored and drawn in dots.
const BUST = 'M58 170C62 142 80 126 98 119C91 105 86 89 88 72C90 53 104 42 120 44C134 46 141 56 140 67L146 78L139 80C140 83 139 86 137 88C138 92 136 96 130 98C126 99 122 101 121 106L122 117C137 121 153 131 163 152';
const SHIFT = 85;
const human = svg('g', {class:'co-human'}, scene);
svg('path', {d:BUST, 'data-w':1.5}, human);
svg('circle', {class:'co-fill', cx:131, cy:63, r:1.4}, human);
const ai = svg('g', {class:'co-ai'}, scene);
svg('path', {d:BUST, 'data-w':2.1, 'data-dash':'0 4.6'}, ai);
const NODES = [[98,64],[109,52],[123,50],[132,62],[116,64],[102,80],[118,78],[131,76],[110,92],[124,90]];
const net = svg('g', {class:'co-net'}, ai);
NODES.forEach((a, i) => NODES.slice(i + 1).forEach(b => {
  if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 19) svg('line', {x1:a[0], y1:a[1], x2:b[0], y2:b[1], 'data-w':.8}, net);
}));
const nodes = NODES.map(([x, y]) => svg('circle', {cx:x, cy:y, r:1.9}, net));
const label = (x, text) => { svg('text', {class:'co-label', x, y:202}, scene).textContent = text; };
label(195, zh ? '科学家' : 'SCIENTIST');
label(W - 195, 'AI');

const design = svg('g', {}, scene);
const sketchG = svg('g', {}, design), marksG = svg('g', {}, design);
const check = svg('path', {class:'co-sketch', pathLength:1, 'data-w':1.5}, design);
// A faint arc between the two heads carries each hand-off.
const talk = svg('path', {class:'co-talk', d:'M206 38Q320 -14 434 38', 'data-w':1, 'data-dash':'0 4'}, scene);
const talkDot = svg('circle', {class:'co-particle', r:2}, scene);
const particles = Array.from({length:20}, () => svg('circle', {class:'co-particle', r:1.8}, scene));
const humanArm = svg('path', {class:'co-arm', 'data-w':1.5}, scene);
const pen = svg('line', {class:'co-arm', 'data-w':1.3}, scene);
const humanHand = svg('circle', {class:'co-arm', r:4.2, 'data-w':1.5}, scene);
const aiArm = svg('path', {class:'co-ai-arm', 'data-w':2.1, 'data-dash':'0 4.6'}, scene);
const aiHalo = svg('circle', {class:'co-halo', r:6.5, 'data-w':.8}, scene);
const aiTip = svg('circle', {class:'co-fill-ai', r:2.6}, scene);
const fanG = svg('g', {class:'co-fan'}, coSvg);

const clamp01 = v => Math.min(1, Math.max(0, v));
const ease = v => v < .5 ? 2 * v * v : 1 - (2 - 2 * v) ** 2 / 2;
const span = (t, a, b) => ease(clamp01((t - a) / (b - a)));
const mix = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
const f = v => v.toFixed(1), fp = p => `${f(p[0])} ${f(p[1])}`;
const toD = pts => 'M' + pts.map(fp).join('L');
const along = (pts, k) => {
  const x = clamp01(k) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(x));
  return mix(pts[i], pts[i + 1], x - i);
};
const stroke = (node, k) => { node.style.strokeDashoffset = 1 - clamp01(k); };
const pick = list => list[Math.floor(rand() * list.length)];
const shuffle = list => list.map(v => [rand(), v]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
const range = n => Array.from({length:n}, (_, i) => i);
// Hand-drawn wobble across the line, different every time.
function wobble(pts, amp = 1.3 + rand() * .8) {
  const f1 = rand() * 6, f2 = rand() * 6;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n = amp * Math.sin(i * .19 + f1) + .7 * Math.sin(i * .47 + f2);
    return [p[0] - (b[1] - a[1]) / len * n, p[1] + (b[0] - a[0]) / len * n];
  });
}
// Two-segment arm from shoulder to hand with a softly rounded elbow, which
// hangs below and forward (dir = +1 facing right, -1 facing left).
function arm(s, h, dir, a = 64, b = 60) {
  const dx = h[0] - s[0], dy = h[1] - s[1], d = Math.min(a + b - .5, Math.max(Math.abs(a - b) + 1, Math.hypot(dx, dy)));
  const base = Math.atan2(dy, dx), off = Math.acos((a * a + d * d - b * b) / (2 * a * d));
  const e = [base + off, base - off].map(t => [s[0] + a * Math.cos(t), s[1] + a * Math.sin(t)])
    .sort((p, q) => (q[1] + dir * q[0] * .6) - (p[1] + dir * p[0] * .6))[0];
  return `M${fp(s)}L${fp(mix(e, s, .28))}Q${fp(e)} ${fp(mix(e, h, .28))}L${fp(h)}`;
}
const PEN = [7, 13];
const HUMAN_SHOULDER = [146 + SHIFT, 130], HUMAN_CHIN = [141 + SHIFT, 103];
const AI_SHOULDER = [W - HUMAN_SHOULDER[0], 130], AI_CHIN = [W - HUMAN_CHIN[0], 99];
const REST = [HUMAN_CHIN[0] + PEN[0], HUMAN_CHIN[1] + PEN[1]], AI_REST = [AI_CHIN[0] - 4, AI_CHIN[1] + 6];

/* The code. DNA letters are the coding strand (T where the RNA has U). */
const COMP = {A:'T', T:'A', G:'C', C:'G'};
const CODE = {};  // standard genetic code: codon -> amino acid, '*' = stop
[...'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG'].forEach((a, n) => {
  CODE['TCAG'[n >> 4] + 'TCAG'[n >> 2 & 3] + 'TCAG'[n & 3]] = a;
});
const CODONS = {};
for (const [codon, a] of Object.entries(CODE)) (CODONS[a] ||= []).push(codon);
const AMINO = [...'ACDEFGHIKLMNPQRSTVWY'];
// Each molecule has its own stretch of the row.
const WINDOWS = {dna: 40, rna: 62, protein: 100};
const RNA_LEFT = i => 5 + (6 - i), RNA_RIGHT = i => 16 + i;  // stem pair i (0 = by the loop), 5'->3'
const letterAt = i => cellsOf()[i].textContent;
const setLetter = (i, v) => { cellsOf()[i].textContent = v; };
for (let i = 0; i < 7; i++) setLetter(WINDOWS.rna + RNA_RIGHT(i), COMP[letterAt(WINDOWS.rna + RNA_LEFT(i))]);
for (let c = 0; c < 8; c++) [...pick(CODONS[pick(AMINO)])].forEach((v, j) => setLetter(WINDOWS.protein + 3 * c + j, v));

/* Designs. Each gives the sketch strokes, a later redraw of part of one stroke,
   the editable marks (base pairs or residues) and every unit's place in the row. */
const LOOP_Y = 52, LOOP_R = 16, STEM = 9, JOIN = LOOP_Y + Math.sqrt(LOOP_R ** 2 - STEM ** 2);
const RUNGS = Array.from({length:7}, (_, i) => 77 + i * 10);
// The guide drawn from its 3' tail, up the right strand, round the loop, down to the 5' spacer.
const GUIDE_PTS = (() => {
  const pts = [[346, 156]], cubic = (a, b, c, d, n) => { for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t;
    pts.push([0, 1].map(k => u*u*u*a[k] + 3*u*u*t*b[k] + 3*u*t*t*c[k] + t*t*t*d[k])); } };
  const line = (a, b, n) => { for (let i = 1; i <= n; i++) pts.push(mix(a, b, i / n)); };
  cubic([346, 156], [338, 150], [329, 148], [329, 140], 6);
  line([329, 140], [329, JOIN], 24);
  const a0 = Math.atan2(JOIN - LOOP_Y, STEM), sweep = Math.PI * 2 - 2 * (Math.PI / 2 - a0);
  for (let i = 1; i <= 30; i++) { const a = a0 - sweep * i / 30; pts.push([320 + LOOP_R * Math.cos(a), LOOP_Y + LOOP_R * Math.sin(a)]); }
  line([311, JOIN], [311, 140], 24);
  cubic([311, 140], [311, 158], [318, 164], [318, 180], 10);
  line([318, 180], [318, 208], 10);
  return pts;
})();
const pairMark = (from, to, pos, alt) => ({kind:'pair', from, to, pos, alt,
  aim:[Math.max(to[0], 329) + 12, (from[1] + to[1]) / 2 - 4], probe:mix(from, to, .5), pen:k => mix(from, to, k)});
const BUILD = {
  rna() {
    const pts = wobble(GUIDE_PTS), s = y => (y - JOIN) / (140 - JOIN);
    const left = y => 60 + Math.round(s(y) * 24), right = y => 6 + Math.round((1 - s(y)) * 24);
    // 5'->3': spacer (5), left strand bottom to top (7), loop (4), right strand top to bottom (7), 3' tail (2).
    const order = [104, 100, 96, 92, 88, ...[6, 5, 4, 3, 2, 1, 0].map(i => left(RUNGS[i])), 54, 48, 42, 36, ...RUNGS.map(right), 4, 1];
    const marks = RUNGS.map((y, i) => pairMark([pts[left(y)][0] + 2.5, y + rand() * 2 - 1], [pts[right(y)][0] - 2.5, y + rand() * 2 - 1],
      [RNA_LEFT(i), RNA_RIGHT(i)], cur => [...pick(['GC', 'CG', 'AT', 'TA'].filter(p => p !== cur.join('')))]));
    const loop = wobble(pts.slice(30, 61).map(([x, y]) => [320 + (x - 320) * 1.08, LOOP_Y + (y - LOOP_Y) * 1.1 - 1]), 1);
    return {length:25, step:.24, strokes:[pts], fix:{stroke:0, i0:30, i1:60, pts:loop},
      units:order.map((j, p) => ({pt:pts[j], pos:[p]})), marks};
  },
  dna() {
    // One helical turn of ten base pairs, as in B-DNA; base pair i is letter i of the coding strand.
    const top = 48, bottom = 204, phase = y => (y - top) / (bottom - top) * Math.PI * 2 + .6;
    const strand = s => range(64).map(i => { const y = top + (bottom - top) * i / 63; return [320 + s * 15 * Math.sin(phase(y)), y]; });
    const A = wobble(strand(1), 1), B = wobble(strand(-1), 1), at = (pts, y) => along(pts, (y - top) / (bottom - top));
    const marks = range(10).map(i => {
      const y = 58 + i * 15.5, [l, r] = [at(A, y), at(B, y)].sort((p, q) => p[0] - q[0]), inset = Math.min(2.5, (r[0] - l[0]) / 4);
      return pairMark([l[0] + inset, y], [r[0] - inset, y], [i], cur => [pick([...'ACGT'].filter(b => b !== cur[0]))]);
    });
    return {length:10, step:.2, strokes:[A, B], fix:{stroke:1, i0:32, i1:63, pts:wobble(strand(-1).slice(32), 1.3)},
      units:marks.map((m, i) => ({pt:m.probe, pos:[i]})), marks};
  },
  protein() {
    // Eight residues on a hand-drawn chain; residue i is codon i (letters 3i to 3i + 2).
    const ideal = range(70).map(i => { const s = i / 69; return [320 + 17 * Math.sin(s * Math.PI * 2 + .4), 54 + 144 * s]; });
    const chain = wobble(ideal, 1);
    const marks = range(8).map(i => {
      const c = along(chain, (i + .5) / 8), r = 7;
      const ring = range(27).map(j => { const a = -Math.PI / 2 + j / 24 * Math.PI * 2, w = r + .5 * Math.sin(j * .9 + i); return [c[0] + w * Math.cos(a), c[1] + w * Math.sin(a)]; });
      // A different amino acid, spelled with the fewest letter changes.
      const alt = cur => {
        const next = pick(AMINO.filter(a => a !== CODE[cur.join('')])), diff = codon => [...codon].filter((v, j) => v !== cur[j]).length;
        const fewest = Math.min(...CODONS[next].map(diff));
        return [...pick(CODONS[next].filter(codon => diff(codon) === fewest))];
      };
      return {kind:'residue', c, r, ring, pos:[3 * i, 3 * i + 1, 3 * i + 2], alt, aim:[c[0] + 17, c[1] - 5], probe:c, pen:k => along(ring, k)};
    });
    return {length:24, step:.3, strokes:[chain], fix:{stroke:0, i0:22, i1:48, pts:wobble(ideal.slice(22, 49), 1.4)},
      units:marks.map(m => ({pt:m.c, pos:m.pos})), marks};
  },
};

let sx = 1, ox = 0, oy = 0, shift = 0, raf = 0, t0 = 0, cycle = 0, cycleStart = 0;
let D = null, S = null, base = 0, parts = [], fixEl = null, markEls = [], events = [], probes = [], humanPath = [], aiPath = [];
let fan = null, lit = false;
function panelBox() {
  const panel = panels.redesign, box = panel.getBoundingClientRect();
  return {box, w: panel.offsetWidth, h: panel.offsetHeight, k: box.width / panel.offsetWidth || 1};
}
function fit(root) {
  root.querySelectorAll('[data-w]').forEach(n => {
    n.setAttribute('stroke-width', (n.dataset.w / Math.max(sx, .5)).toFixed(2));
    if (n.dataset.dash) n.setAttribute('stroke-dasharray', n.dataset.dash.split(' ').map(v => (v / Math.max(sx, .5)).toFixed(2)).join(' '));
  });
}
function layoutCowork() {
  const {box, w, h, k} = panelBox();
  if (!w) return;
  coSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  // The drawing spans about 380 units around the design at x = 320.
  sx = Math.min(w * (w < 600 ? .94 : .6) / 380, 1.3);
  ox = w * (w < 600 ? .5 : .54) - 320 * sx;
  oy = Math.max(8, h * .04);
  scene.setAttribute('transform', `translate(${f(ox)} ${f(oy)}) scale(${sx.toFixed(4)})`);
  fit(scene);
  // Pull the sequence up so the focus row starts just below the scene.
  genome.style.paddingTop = '0px';
  const top = (focusRow.getBoundingClientRect().top - box.top) / k;
  genome.style.paddingTop = `${Math.max(0, oy + H * sx + 66 - top).toFixed(0)}px`;
}
// Slide the row so the current molecule's stretch sits under the drawing.
function pan(animate = true) {
  const {box, k} = panelBox(), cells = cellsOf();
  if (!box.width) return;
  const was = focusRow.style.transform;
  focusRow.style.transition = 'none';
  focusRow.style.transform = 'none';
  const a = cells[base].getBoundingClientRect(), b = cells[base + D.length - 1].getBoundingClientRect();
  const mid = ((a.left + b.right) / 2 - box.left) / k;
  focusRow.style.transform = was;
  void focusRow.offsetWidth;
  focusRow.style.transition = animate ? '' : 'none';
  shift = ox + 320 * sx - mid;
  focusRow.style.transform = `translateX(${f(shift)}px)`;
}

// One design session. Times are seconds into the cycle.
function schedule(n) {
  const step = D.step, len = step * .7, lead = ORDER.length > 1 ? .9 : .3;
  const s = {len, sketch:[lead + .2, lead + 2.4]};
  s.tick = i => s.sketch[1] + .2 + i * step;
  s.ticksEnd = s.tick(n);
  s.scan1 = [s.ticksEnd + .75, s.ticksEnd + .75 + n * .26];
  s.revert = s.scan1[1] + .95;
  s.fix = [s.revert + .5, s.revert + 1.5];
  s.scan2 = [s.fix[1] + .8, s.fix[1] + .8 + n * .19];
  s.check = [s.scan2[1] + .95, s.scan2[1] + 1.45];
  s.handoffs = [[s.ticksEnd + .15, 1], [s.scan1[1] + .2, -1], [s.fix[1] + .1, 1], [s.scan2[1] + .15, -1]];
  s.reg = [s.check[1] + .3, s.check[1] + 1.1];
  s.hit = s.reg[1] + .1;
  s.fade = [s.hit + 3.4, s.hit + 4.2];
  s.T = s.fade[1] + .5;
  s.scanAt = (scan, i) => scan[0] + (scan[1] - scan[0]) * i / (n - 1);
  return s;
}
function newCycle(n) {
  const key = ORDER[n % ORDER.length];
  D = BUILD[key]();
  D.key = key;
  base = WINDOWS[key];
  S = schedule(D.marks.length);
  clearWindow();
  fanG.replaceChildren(); fan = null; lit = false;
  sketchG.replaceChildren(); marksG.replaceChildren();

  // Strokes, drawn one after another; the stroke the scientist later redraws is split in three.
  const total = D.strokes.reduce((sum, p) => sum + p.length, 0);
  let at = S.sketch[0];
  parts = D.strokes.map((pts, j) => {
    const dur = (S.sketch[1] - S.sketch[0] - .15 * (D.strokes.length - 1)) * pts.length / total, t = [at, at + dur];
    at += dur + .15;
    const cuts = D.fix.stroke === j ? [[0, D.fix.i0], [D.fix.i0, D.fix.i1], [D.fix.i1, pts.length - 1]] : [[0, pts.length - 1]];
    return {pts, t, segs:cuts.map(([i0, i1]) => ({i0, i1, el:svg('path', {class:'co-sketch', pathLength:1, 'data-w':1.5, d:toD(pts.slice(i0, i1 + 1))}, sketchG)}))};
  });
  fixEl = svg('path', {class:'co-sketch', pathLength:1, 'data-w':1.5, d:toD(D.fix.pts)}, sketchG);
  // Above the resting elbow (about y 97), so the arm never covers the tick once it is back.
  const checkPts = wobble([[268, 82], [271, 85], [274, 89], [278, 83], [282, 77], [286, 71]], .5);
  check.setAttribute('d', toD(checkPts));

  // Marks and the changes made to them.
  markEls = D.marks.map(m => {
    m.orig = m.pos.map(p => letterAt(base + p));
    if (m.kind === 'pair') {
      const q = mix(m.from, m.to, .5);
      return {h:svg('path', {class:'co-sketch', pathLength:1, 'data-w':1.4, d:`M${fp(m.from)}Q${f(q[0])} ${f(q[1] + rand() * 3 - 1.5)} ${fp(m.to)}`}, marksG),
              c:svg('line', {class:'co-change', x1:f(m.from[0]), y1:f(m.from[1]), x2:f(m.to[0]), y2:f(m.to[1]), 'data-w':2.4}, marksG)};
    }
    const el = {h:svg('path', {class:'co-res', pathLength:1, 'data-w':1.4, d:toD(m.ring) + 'Z'}, marksG)};
    el.ht = svg('text', {class:'co-aa', x:f(m.c[0]), y:f(m.c[1])}, marksG); el.ht.textContent = CODE[m.orig.join('')];
    el.c = svg('circle', {class:'co-res-c', cx:f(m.c[0]), cy:f(m.c[1]), r:m.r + .4, 'data-w':1.4}, marksG);
    el.ct = svg('text', {class:'co-aa c', x:f(m.c[0]), y:f(m.c[1])}, marksG);
    return el;
  });
  const count = D.marks.length, first = shuffle(range(count)).slice(0, count >= 10 ? 3 : 2), reverted = first[0];
  const second = shuffle(range(count).filter(i => !first.includes(i))).slice(0, 2);
  events = D.marks.map((m, i) => [{t:S.tick(i), who:'h', v:m.orig}]);
  first.forEach(i => events[i].push({t:S.scanAt(S.scan1, i), who:'a', v:D.marks[i].alt(D.marks[i].orig)}));
  events[reverted].push({t:S.revert, who:'h', v:D.marks[reverted].orig});
  second.forEach(i => events[i].push({t:S.scanAt(S.scan2, i), who:'a', v:D.marks[i].alt(D.marks[i].orig)}));
  events.forEach((list, i) => { if (D.marks[i].kind === 'residue') list.forEach(e => { if (e.who === 'a') e.aa = CODE[e.v.join('')]; }); });
  probes = [...range(count).map(i => ({t:S.scanAt(S.scan1, i), i, hit:first.includes(i)})),
            ...range(count).map(i => ({t:S.scanAt(S.scan2, i), i, hit:second.includes(i)}))];

  // Pen and fingertip paths: [start, end, position at k].
  const rest = () => REST, aiRest = () => AI_REST, pointAt = k => along(D.marks.map(m => m.aim), k);
  humanPath = [[0, 0, rest], ...parts.map(p => [p.t[0], p.t[1], k => along(p.pts, k)]),
    ...D.marks.map((m, i) => [S.tick(i), S.tick(i) + S.len, m.pen]),
    [S.ticksEnd + .4, S.revert - .4, rest], [S.revert, S.revert + S.len, D.marks[reverted].pen],
    [S.fix[0], S.fix[1], k => along(D.fix.pts, k)], [S.fix[1] + .6, S.check[0] - .4, rest],
    [S.check[0], S.check[1], k => along(checkPts, k)], [S.check[1] + .7, S.T, rest]];
  aiPath = [[0, S.scan1[0] - .4, aiRest], [S.scan1[0], S.scan1[1], pointAt], [S.scan1[1] + .5, S.scan2[0] - .4, aiRest],
    [S.scan2[0], S.scan2[1], pointAt], [S.scan2[1] + .5, S.T, aiRest]];
  fit(design);
  pan(n > 0);
}
function follow(path, t) {
  for (let j = 0; j < path.length; j++) {
    const [a, b, at] = path[j];
    if (t <= b) return t >= a || !j ? at(b > a ? clamp01((t - a) / (b - a)) : 1) : mix(path[j - 1][2](1), at(0), span(t, path[j - 1][1], a));
  }
  return path[path.length - 1][2](1);
}
function clearWindow() {
  focusRow.querySelectorAll('.win').forEach(c => c.classList.remove('win', 'alt'));
}
// Rewrite one letter the moment its shot lands; it flashes, then stays coral.
function rewrite(i, v) {
  const c = cellsOf()[i];
  c.textContent = v;
  c.classList.add('new');
  editTimers.push(setTimeout(() => {
    c.classList.remove('new'); c.classList.add('done');
    edited.push(c);
    while (edited.length > 24) edited.shift().classList.remove('done');
  }, 1600));
}
// A shot: a short piece of line flies along the path and is gone at its far end.
const COMET = .2, LANDS = 1 / (1 + COMET);
function shoot(el, p) {
  // Hidden before and after the flight, so the round cap leaves no dot at either end.
  el.style.visibility = p > 0 && p < 1 ? 'visible' : 'hidden';
  el.style.strokeDasharray = `${COMET} 2`;
  el.style.strokeDashoffset = COMET - clamp01(p) * (1 + COMET);
}
// The approved design is laid onto the row: a faint shot from every unit to its
// letters, then a coral shot to each letter that changed.
function buildFan() {
  const {box, k} = panelBox(), cells = cellsOf();
  // Shots end just above the top of the letter itself, not the top of its line box.
  const size = parseFloat(getComputedStyle(focusRow).fontSize);
  const cell = p => { const r = cells[base + p].getBoundingClientRect(); return [((r.left + r.right) / 2 - box.left) / k, (r.top - box.top) / k + (r.height / k - .72 * size) / 2 - 1]; };
  const px = p => [ox + p[0] * sx, oy + p[1] * sx];
  const curve = (a, b, cls) => {
    const m = (b[1] - a[1]) * .55;
    return svg('path', {class:cls, pathLength:1, d:`M${fp(a)}C${f(a[0])} ${f(a[1] + m)} ${f(b[0])} ${f(b[1] - m)} ${fp(b)}`}, fanG);
  };
  const unitOf = p => D.units.find(u => u.pos.includes(p));
  const reg = D.units.map((u, j) => {
    const ends = u.pos.map(cell), to = [ends.reduce((s, e) => s + e[0], 0) / ends.length, ends[0][1]];
    return {el:curve(px(u.pt), to, 'reg'), t:S.reg[0] + j * .025};
  });
  const hits = [];
  D.marks.forEach((m, i) => {
    const final = events[i][events[i].length - 1].v;
    m.pos.forEach((p, j) => { if (final[j] !== m.orig[j]) hits.push({el:curve(px(unitOf(p).pt), cell(p), 'hit'), p, v:final[j]}); });
  });
  hits.forEach((h, j) => { h.t = S.hit + j * .12; });
  fan = {reg, hits};
}
function frame(t, now) {
  const breath = Math.sin(now / 1000 * 1.4) * .7;
  human.setAttribute('transform', `translate(${SHIFT} ${breath.toFixed(2)})`);
  ai.setAttribute('transform', `translate(${W} ${(-breath).toFixed(2)}) scale(-1 1) translate(${SHIFT} 0)`);
  design.style.opacity = (1 - span(t, ...S.fade)).toFixed(3);

  // Scientist's pen.
  const tip = follow(humanPath, t), hand = [tip[0] - PEN[0], tip[1] - PEN[1]];
  humanArm.setAttribute('d', arm([HUMAN_SHOULDER[0], HUMAN_SHOULDER[1] + breath], hand, 1));
  humanHand.setAttribute('cx', f(hand[0])); humanHand.setAttribute('cy', f(hand[1]));
  pen.setAttribute('x1', f(hand[0])); pen.setAttribute('y1', f(hand[1]));
  pen.setAttribute('x2', f(tip[0])); pen.setAttribute('y2', f(tip[1]));

  // The drawing, the redrawn part (the first try stays as a faint trace) and the approving tick.
  parts.forEach(p => {
    const drawn = clamp01((t - p.t[0]) / (p.t[1] - p.t[0])) * (p.pts.length - 1);
    p.segs.forEach(s => stroke(s.el, (drawn - s.i0) / (s.i1 - s.i0)));
  });
  parts[D.fix.stroke].segs[1].el.style.opacity = (1 - .8 * span(t, S.fix[0] + .3, S.fix[1])).toFixed(2);
  stroke(fixEl, (t - S.fix[0]) / (S.fix[1] - S.fix[0]));
  stroke(check, (t - S.check[0]) / (S.check[1] - S.check[0]));

  // Marks: the latest change wins. A changed mark turns coral over a faint trace
  // of the drawn one; one the scientist redraws is navy again.
  events.forEach((list, i) => {
    let cur = null, prev = null;
    for (const e of list) if (e.t <= t) { prev = cur; cur = e; }
    const el = markEls[i], res = D.marks[i].kind === 'residue';
    const show = (o, ...nodes) => nodes.forEach(n => { if (n) n.style.opacity = o; });
    if (!cur) { show(0, el.h, el.c, el.ht, el.ct); return; }
    const k = span(t, cur.t, cur.t + .25), drawn = (t - cur.t) / S.len;
    if (cur.who === 'h') {
      show(1, el.h); stroke(el.h, drawn);
      show(clamp01((drawn - .7) / .3), el.ht);
      show(prev && prev.who === 'a' ? (1 - k).toFixed(2) : 0, el.c, el.ct);
    } else {
      show((1 - .82 * k).toFixed(2), el.h); stroke(el.h, 1);
      show((1 - k).toFixed(2), el.ht);
      show(k.toFixed(2), el.c, el.ct);
      if (res) el.ct.textContent = cur.aa;
    }
  });

  // AI model's fingertip and probes.
  const finger = follow(aiPath, t);
  aiArm.setAttribute('d', arm([AI_SHOULDER[0], AI_SHOULDER[1] - breath], finger, -1));
  [aiTip, aiHalo].forEach(n => { n.setAttribute('cx', f(finger[0])); n.setAttribute('cy', f(finger[1])); });
  const busy = Math.max(...[S.scan1, S.scan2].map(s => span(t, s[0] - .4, s[0]) * (1 - span(t, s[1], s[1] + .5))));
  aiHalo.style.opacity = (busy * (.45 + .45 * Math.sin(now / 130))).toFixed(2);
  nodes.forEach((n, j) => {
    const idle = .45 + .2 * Math.sin(now / 900 + j * 1.3), fire = Math.max(0, Math.sin(now / 110 + j * 1.9));
    n.style.opacity = (idle + (1 - idle) * fire * busy).toFixed(2);
  });
  particles.forEach((c, j) => {
    const probe = probes[j], k = probe ? clamp01((t - probe.t + .35) / .35) : 0, live = k > 0 && k < 1;
    c.style.opacity = live ? 1 : 0;
    if (!live) return;
    c.classList.toggle('hit', probe.hit);
    const end = D.marks[probe.i].probe, mid = [(finger[0] + end[0]) / 2, Math.min(finger[1], end[1]) - 12], e = ease(k);
    const q = mix(mix(finger, mid, e), mix(mid, end, e), e);
    c.setAttribute('cx', f(q[0])); c.setAttribute('cy', f(q[1]));
  });

  // Hand-offs along the arc between the heads.
  let arc = 0, dot = -1;
  for (const [h, dir] of S.handoffs) {
    arc = Math.max(arc, span(t, h - .15, h) * (1 - span(t, h + .6, h + .85)));
    const k = (t - h) / .55;
    if (k > 0 && k < 1) dot = dir > 0 ? k : 1 - k;
  }
  talk.style.opacity = (.8 * arc).toFixed(2);
  talkDot.style.opacity = dot < 0 ? 0 : 1;
  if (dot >= 0) {
    const e = ease(dot), u = 1 - e;
    talkDot.setAttribute('cx', f(u * u * 206 + 2 * u * e * 320 + e * e * 434));
    talkDot.setAttribute('cy', f(u * u * 38 - 2 * u * e * 14 + e * e * 38));
  }

  // Approved: map the design onto its letters and rewrite the ones that changed.
  if (t >= S.reg[0] && !fan) {
    buildFan();
    const cells = cellsOf();
    for (let p = 0; p < D.length; p++) cells[base + p].classList.add('win', ...(D.key === 'protein' && (p / 3 | 0) % 2 ? ['alt'] : []));
    lit = true;
  }
  if (fan) {
    fan.reg.forEach(r => shoot(r.el, (t - r.t) / .55));
    fan.hits.forEach(h => {
      const p = (t - h.t) / .5;
      shoot(h.el, p);
      if (p >= LANDS && !h.done) { h.done = true; rewrite(base + h.p, h.v); }
    });
  }
  if (lit && t >= S.fade[1]) { clearWindow(); lit = false; }
}
function tick(now) {
  // A frame's timestamp can fall just before t0, so time never runs below zero.
  const elapsed = Math.max(0, (now - t0) / 1000);
  if (elapsed - cycleStart >= S.T) { cycleStart += S.T; newCycle(++cycle); }
  frame(elapsed - cycleStart, now);
  raf = requestAnimationFrame(tick);
}
addEventListener('resize', () => { if (active === 'redesign' && D) { layoutCowork(); pan(false); } });

let blipLoop = null;
function startGenome() {
  genome.getAnimations({subtree:true}).forEach(a => reducedMotion.matches ? a.pause() : a.play());
  layoutCowork();
  if (reducedMotion.matches) {
    // A still of the approved design.
    cycle = 0; newCycle(0); frame(S.check[1], 0);
    [talk, talkDot].forEach(n => { n.style.opacity = 0; });
    return;
  }
  if (raf) return;
  cycle = 0; cycleStart = 0; newCycle(0); t0 = performance.now();
  raf = requestAnimationFrame(tick);
  blipLoop = setInterval(blip, 260);
}
function stopGenome() {
  cancelAnimationFrame(raf); raf = 0;
  clearInterval(blipLoop); blipLoop = null;
  editTimers.forEach(t => { clearTimeout(t); clearInterval(t); }); editTimers = [];
  clearWindow();
  genome.querySelectorAll('.new').forEach(c => { c.classList.remove('new'); c.classList.add('done'); });
  genome.getAnimations({subtree:true}).forEach(a => a.pause());
}

/* ---------- Switching themes ---------- */

function activate(name, focus = false) {
  if (name === active) return;
  const previous = active;
  active = name;
  tabs.forEach(tab => {
    const on = tab.dataset.panel === name;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    if (on && focus) tab.focus();
  });
  const out = panels[previous], next = panels[name];
  out.classList.remove('is-active');
  // Hidden panels leave layout so the 3D view and loops stop working.
  hideTimers[previous] = setTimeout(() => { out.hidden = true; if (previous === 'redesign') stopGenome(); }, 700);
  clearTimeout(hideTimers[name]);
  next.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => next.classList.add('is-active')));
  if (name === 'discover') growTree();
  if (name === 'redesign') startGenome();
}
// A theme is chosen by click or keyboard (not hover), so its intro text can
// open below it without shifting the other themes under the pointer.
tabs.forEach((tab, i) => {
  const go = () => activate(tab.dataset.panel);
  tab.addEventListener('focus', go);
  tab.addEventListener('click', go);
  tab.addEventListener('keydown', event => {
    const step = {ArrowDown:1, ArrowRight:1, ArrowUp:-1, ArrowLeft:-1}[event.key];
    if (!step) return;
    event.preventDefault();
    activate(tabs[(i + step + tabs.length) % tabs.length].dataset.panel, true);
  });
});
// On narrow screens the visual is pinned; scrolling through the themes selects them.
const narrow = matchMedia('(max-width: 900px)');
const scrollPick = new IntersectionObserver(entries => {
  if (!narrow.matches) return;
  const hit = entries.find(e => e.isIntersecting);
  if (hit) activate(hit.target.dataset.panel);
}, {rootMargin:'-55% 0px -25% 0px'});
tabs.forEach(tab => scrollPick.observe(tab));
stopGenome();
growTree();
// Links such as research.html#decode open that theme directly.
const fromHash = () => { const name = location.hash.slice(1); if (panels[name]) activate(name); };
addEventListener('hashchange', fromHash);
fromHash();
