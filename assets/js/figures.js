/*
 * The small isometric drawings in the project cards: each one a little machine on a
 * base plate that works the way its project does.
 *
 *   dado      floor plates drop onto two towers, one at a time
 *   pharmacy  requests ride tracks from stores, through a hub, to services and back
 *   alexa     a speaker listens, thinks and answers; a row of bars shows the voice
 *
 * A drawing is a function of time that returns solids (boxes and cylinders, in units
 * on the plate) and marks (lines drawn flat on the plate). Each frame they are sorted
 * back to front and drawn as SVG paths. A figure only runs while it is on screen.
 *
 * To add a figure: write a scene(t) function, add it to FIGURES below, and put
 * <div class="figure" data-figure="its-name"> in a card.
 */

const SVG = "http://www.w3.org/2000/svg";
const FPS = 24;
const VIEW = "0 0 300 225";
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const easeOut = (p) => 1 - (1 - p) ** 3;
/** A repeatable pseudo-random number in 0..1 for a whole number. */
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/* ── the projection ──────────────────────────────────────────────────── */

// True isometric: x runs down to the right, y down to the left, z straight up.
const COS = Math.cos(Math.PI / 6), SIN = 0.5;
const SCALE = 1.32, ORIGIN = [127, 55];
const P = (x, y, z = 0) => [ORIGIN[0] + (x - y) * COS * SCALE, ORIGIN[1] + (x + y) * SIN * SCALE - z * SCALE];
const n = (v) => v.toFixed(1);
const at = (p) => `${n(p[0])} ${n(p[1])}`;
const poly = (points) => `M${points.map(at).join("L")}Z`;
const line = (points) => `M${points.map(at).join("L")}`;
const ellipse = (x, y, rx, ry) => `M${n(x - rx)} ${n(y)}A${n(rx)} ${n(ry)} 0 1 0 ${n(x + rx)} ${n(y)}A${n(rx)} ${n(ry)} 0 1 0 ${n(x - rx)} ${n(y)}Z`;

/* ── drawing ─────────────────────────────────────────────────────────── */

/** Paths are made once and reused: each frame only rewrites what changed. */
class Pen {
  constructor(svg) {
    this.svg = svg;
    this.pool = [];
    this.used = 0;
  }

  begin() {
    this.used = 0;
  }

  path(d, kind, style = "") {
    let el = this.pool[this.used];
    if (!el) {
      el = document.createElementNS(SVG, "path");
      el.now = {};
      this.svg.append(el);
      this.pool.push(el);
    }
    this.used++;
    if (el.now.d !== d) el.setAttribute("d", (el.now.d = d));
    if (el.now.kind !== kind) el.setAttribute("class", (el.now.kind = kind));
    if (el.now.style !== style) el.setAttribute("style", (el.now.style = style));
  }

  end() {
    for (let i = this.used; i < this.pool.length; i++) {
      const el = this.pool[i];
      if (el.now.d !== "") el.setAttribute("d", (el.now.d = ""));
    }
  }
}

/** A box: the three faces that can be seen. `lit` turns it the accent colour. */
function drawBox(pen, b) {
  const { x0, y0, z0, x1, y1, z1 } = b, lit = b.lit ? " lit" : "";
  pen.path(poly([P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)]), `left${lit}`);
  pen.path(poly([P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), P(x1, y0, z0)]), `right${lit}`);
  pen.path(poly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)]), `top${lit}`);
}

/** A cylinder standing on its end, with an optional ring drawn on its top. */
function drawCylinder(pen, c) {
  const [x, bottom] = P(c.cx, c.cy, c.z0), top = P(c.cx, c.cy, c.z1)[1];
  const rx = c.r * COS * Math.SQRT2 * SCALE, ry = c.r * SIN * Math.SQRT2 * SCALE;
  const lit = c.lit ? " lit" : "";
  pen.path(`M${n(x - rx)} ${n(top)}L${n(x - rx)} ${n(bottom)}A${n(rx)} ${n(ry)} 0 0 0 ${n(x + rx)} ${n(bottom)}L${n(x + rx)} ${n(top)}Z`, `left${lit}`);
  pen.path(ellipse(x, top, rx, ry), `top${lit}`);
  if (c.ring) pen.path(ellipse(x, top, rx * 0.68, ry * 0.68), `ring${c.ring.lit ? " lit" : ""}`, c.ring.style || "");
}

/** The base plate: a slab with rounded corners. */
function drawPlate(pen, s) {
  const { x0, y0, x1, y1, z0, z1, r } = s;
  const outline = (z) => {
    const p = (x, y) => at(P(x, y, z));
    return `M${p(x0 + r, y0)}L${p(x1 - r, y0)}Q${p(x1, y0)} ${p(x1, y0 + r)}L${p(x1, y1 - r)}Q${p(x1, y1)} ${p(x1 - r, y1)}`
      + `L${p(x0 + r, y1)}Q${p(x0, y1)} ${p(x0, y1 - r)}L${p(x0, y0 + r)}Q${p(x0, y0)} ${p(x0 + r, y0)}Z`;
  };
  // where the rounded corners reach furthest left and right on screen
  const leftmost = (z) => P(x0 + r / 4, y1 - r / 4, z), rightmost = (z) => P(x1 - r / 4, y0 + r / 4, z);
  pen.path(outline(z0), "right");
  pen.path(poly([leftmost(z1), rightmost(z1), rightmost(z0), leftmost(z0)]), "right fill");
  pen.path(line([leftmost(z1), leftmost(z0)]) + line([rightmost(z1), rightmost(z0)]), "edge");
  pen.path(outline(z1), "top");
}

/** -1 if a has to be drawn before b, 1 if after, 0 if it does not matter. */
function order(a, b) {
  const x = a.x1 <= b.x0 ? -1 : b.x1 <= a.x0 ? 1 : 0;
  const y = a.y1 <= b.y0 ? -1 : b.y1 <= a.y0 ? 1 : 0;
  if (x && y && x !== y) return 0; // side by side across the view: neither hides the other
  if (x || y) return x || y;
  return a.z1 <= b.z0 ? -1 : b.z1 <= a.z0 ? 1 : 0;
}

/** Back to front: keep taking a solid that nothing left has to come before. */
function backToFront(solids) {
  const left = solids.slice(), sorted = [];
  while (left.length) {
    let pick = left.findIndex((a) => !left.some((b) => b !== a && order(b, a) < 0));
    if (pick < 0) pick = 0; // a cycle: should not happen in these scenes
    sorted.push(left.splice(pick, 1)[0]);
  }
  return sorted;
}

const box = (x0, y0, x1, y1, z0, z1, lit = false) => ({ x0, y0, x1, y1, z0, z1, lit });
const cylinder = (cx, cy, r, z0, z1, more = {}) => ({ round: true, cx, cy, r, x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r, z0, z1, ...more });

const PLATE = { x0: 0, y0: 0, x1: 120, y1: 80, z0: -7, z1: 0, r: 11 };

function render(pen, scene) {
  pen.begin();
  drawPlate(pen, PLATE);
  for (const mark of scene.marks || []) pen.path(line(mark.map(([x, y]) => P(x, y, 0))), "mark");
  for (const solid of backToFront(scene.solids)) (solid.round ? drawCylinder : drawBox)(pen, solid);
  pen.end();
}

/* ── Dado: floor plates dropping onto two towers ─────────────────────── */

const DADO = {
  towers: [
    { x0: 14, y0: 12, x1: 50, y1: 48 },
    { x0: 66, y0: 24, x1: 98, y1: 56 },
  ],
  order: [0, 1, 0, 1, 0, 1, 0, 0], // which tower gets the next floor
  floor: 6, // how thick a floor is
  pitch: 7.6, // floor to floor
  step: 0.6, // seconds per floor
  hold: 3.4,
  clear: 0.9,
};

function dado(t) {
  const { towers, order: turns, floor, pitch, step, hold, clear } = DADO;
  const build = turns.length * step, now = t % (build + hold + clear);
  const solids = [];
  for (const tower of towers) solids.push(box(tower.x0 - 3, tower.y0 - 3, tower.x1 + 3, tower.y1 + 3, 0, 1.2)); // its footing
  const levels = towers.map(() => 0);
  turns.forEach((which, i) => {
    const level = levels[which]++;
    let lift = 0, lit = false;
    if (now < build) { // dropping in, one after another
      const age = now - i * step;
      if (age < 0) return;
      lift = (1 - easeOut(clamp(age / 0.42))) * 36;
      lit = age < step; // the newest floor glows
    } else if (now < build + hold) { // a highlight walks the floors
      lit = Math.floor((now - build) / 0.42) % turns.length === i;
    } else { // lifted away, last floor first
      const gone = ((now - build - hold) / clear) * turns.length - (turns.length - 1 - i);
      if (gone >= 1) return;
      lift = gone > 0 ? gone * gone * 36 : 0;
    }
    const tower = towers[which], z = 1.2 + level * pitch + lift;
    solids.push(box(tower.x0, tower.y0, tower.x1, tower.y1, z, z + floor, lit));
  });
  solids.push(cylinder(108, 68, 4.5, 0, 3)); // a dial on the plate
  return { solids, marks: [[[8, 66], [22, 66]], [[8, 71], [22, 71]]] };
}

/* ── Pharmacy portal: requests crossing a hub between stores and services ── */

const ROWS = [13, 40, 67];
const PORTAL = (() => {
  // the track from a store to the hub, and from the hub to a service
  const inbound = (i) => (i === 1 ? [[22, 40], [42, 40]] : [[22, ROWS[i]], [32, ROWS[i]], [32, 40], [42, 40]]);
  const outbound = (j) => (j === 1 ? [[78, 40], [98, 40]] : [[78, 40], [88, 40], [88, ROWS[j]], [98, ROWS[j]]]);
  const length = (track) => track.slice(1).reduce((sum, p, k) => sum + Math.hypot(p[0] - track[k][0], p[1] - track[k][1]), 0);
  /** The point a distance d along a track. */
  const along = (track, d) => {
    for (let k = 1; k < track.length; k++) {
      const a = track[k - 1], b = track[k], seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d <= seg) return [a[0] + ((b[0] - a[0]) * d) / seg, a[1] + ((b[1] - a[1]) * d) / seg];
      d -= seg;
    }
    return track[track.length - 1];
  };
  const SPEED = 58; // units a second
  /** A request: store i -> hub -> service j, a pause, and the answer back the same way. */
  const trip = (i, j) => {
    const a = inbound(i), b = outbound(j), ta = length(a) / SPEED, tb = length(b) / SPEED;
    const stages = [
      [0.15, () => ({ store: i })],
      [ta, (p) => ({ packet: along(a, p * length(a)), lit: true })],
      [0.25, () => ({ hub: true })],
      [tb, (p) => ({ packet: along(b, p * length(b)), lit: true })],
      [0.35, () => ({ service: j })],
      [tb, (p) => ({ packet: along(b, (1 - p) * length(b)) })],
      [0.25, () => ({ hub: true })],
      [ta, (p) => ({ packet: along(a, (1 - p) * length(a)) })],
      [0.15, () => ({ store: i })],
    ];
    return (time) => {
      for (const [duration, what] of stages) {
        if (time < duration) return what(time / duration);
        time -= duration;
      }
      return null;
    };
  };
  return {
    cycle: 7.4,
    flows: [[0, trip(0, 1)], [1.6, trip(2, 0)], [3.2, trip(1, 2)], [4.6, trip(0, 2)]],
    marks: [0, 1, 2].flatMap((k) => [inbound(k), outbound(k)]),
  };
})();

function pharmacy(t) {
  const busy = { stores: new Set(), services: new Set(), hub: false }, packets = [];
  for (const [start, trip] of PORTAL.flows) {
    const what = trip((((t - start) % PORTAL.cycle) + PORTAL.cycle) % PORTAL.cycle);
    if (!what) continue;
    if (what.packet) packets.push(what);
    else if (what.hub) busy.hub = true;
    else if ("store" in what) busy.stores.add(what.store);
    else busy.services.add(what.service);
  }
  const solids = [];
  ROWS.forEach((y, i) => {
    solids.push(box(6, y - 7, 20, y + 7, 0, 9, busy.stores.has(i))); // a store
    solids.push(box(100, y - 7, 114, y + 7, 0, 13, busy.services.has(i))); // a service
  });
  solids.push(box(44, 24, 76, 56, 0, 20, busy.hub)); // the hub
  // the pharmacy cross on its roof, always lit
  solids.push(box(50, 37, 57, 43, 20, 22, true), box(57, 30, 63, 50, 20, 22, true), box(63, 37, 70, 43, 20, 22, true));
  for (const { packet: [x, y], lit } of packets) solids.push(box(x - 2, y - 2, x + 2, y + 2, 0, 4, lit));
  return { solids, marks: PORTAL.marks };
}

/* ── Alexa: a voice comes in, a pause, an answer goes out ────────────── */

const VOICE = { cycle: 8, bars: 7 };

function alexa(t) {
  const now = t % VOICE.cycle;
  // idle, listening, thinking, answering, idle
  const phase = now < 0.8 ? "idle" : now < 3.2 ? "listen" : now < 4.2 ? "think" : now < 7.2 ? "answer" : "idle";
  const tick = Math.floor(t * 12);

  // how loud each moment is: syllables for a voice, a steadier swell for the answer
  let loud = 0;
  if (phase === "listen") loud = 0.35 + 0.65 * Math.abs(Math.sin(now * 7.3)) * (0.5 + 0.5 * hash(Math.floor(now * 5)));
  if (phase === "answer") loud = 0.6 + 0.35 * Math.sin(now * 3.1) * Math.sin(now * 1.7 + 1);
  const from = phase === "listen" ? 0.8 : 4.2, to = phase === "listen" ? 3.2 : 7.2;
  loud *= clamp(Math.min((now - from) * 4, (to - now) * 4));

  const solids = [];
  // the speaker, with its light ring
  const ring = { lit: phase !== "idle" };
  if (phase === "think") ring.style = `stroke-dasharray:10 8;stroke-dashoffset:${-tick * 3}`; // the light chases round
  if (phase === "answer" && Math.sin(now * 6) < -0.2) ring.lit = false; // and pulses as it speaks
  solids.push(cylinder(40, 40, 22, 0, 30, { ring }));
  // the voice, as a row of bars
  for (let i = 0; i < VOICE.bars; i++) {
    const middle = Math.sin((Math.PI * (i + 0.5)) / VOICE.bars) ** 1.2; // taller towards the middle
    const wobble = phase === "answer"
      ? 0.5 + 0.5 * Math.sin(i * 0.9 - t * 9) * Math.sin(i * 0.37 + t * 4)
      : hash(i * 13 + tick * 7);
    const height = 1.5 + clamp(loud * middle * (0.35 + 0.65 * wobble)) * 30;
    const x = 72 + i * 6.3;
    solids.push(box(x, 33, x + 4.3, 47, 0, height, phase === "answer" && height > 3));
  }
  return { solids, marks: [[[70, 56], [116, 56]], [[70, 24], [116, 24]]] };
}

/* ── the stage ───────────────────────────────────────────────────────── */

/** still: the moment to show when nothing may move. */
const FIGURES = {
  dado: { scene: dado, still: 6 },
  pharmacy: { scene: pharmacy, still: 0.6 },
  alexa: { scene: alexa, still: 5.3 },
};

const stage = []; // every figure on the page
let raf = 0, last = 0, paused = false;

function mount(el) {
  const figure = FIGURES[el.dataset.figure];
  if (!figure) return null;
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", VIEW);
  svg.setAttribute("class", "iso");
  el.textContent = "";
  el.append(svg);
  return { el, figure, pen: new Pen(svg), t: figure.still, visible: true };
}

const draw = (item) => render(item.pen, item.figure.scene(item.t));

function tick(now) {
  raf = requestAnimationFrame(tick);
  if (now - last < 1000 / FPS) return;
  const dt = last ? Math.min(0.25, (now - last) / 1000) : 0;
  last = now;
  for (const item of stage) {
    if (!item.visible) continue;
    item.t += dt;
    draw(item);
  }
}

function run() {
  if (raf || paused || !stage.length) return;
  last = 0;
  raf = requestAnimationFrame(tick);
}

/** Pause or resume every figure. */
export function setFiguresPaused(value) {
  paused = value;
  if (paused) {
    cancelAnimationFrame(raf);
    raf = 0;
  } else run();
}

/** Find the figures on the page and start them. startPaused shows each one's still moment. */
export function startFigures({ startPaused = false } = {}) {
  for (const el of document.querySelectorAll("[data-figure]")) {
    const item = mount(el);
    if (!item) continue;
    draw(item);
    stage.push(item);
  }
  if (typeof IntersectionObserver !== "undefined") {
    const seen = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const item = stage.find((it) => it.el === entry.target);
        if (item) item.visible = entry.isIntersecting;
      }
    }, { rootMargin: "80px" });
    for (const item of stage) seen.observe(item.el);
  }
  setFiguresPaused(startPaused);
}

/* ── names that resolve out of noise ─────────────────────────────────── */

const NOISE = "!<>-_\\/[]{}=+*^?#";

/** Scramble an element's text and let it resolve left to right, as a card is entered. */
export function scramble(el, ms = 300) {
  const text = el.dataset.text ?? (el.dataset.text = el.textContent);
  cancelAnimationFrame(el._scramble);
  const start = performance.now();
  const step = (now) => {
    // a frame's time can be a touch earlier than `start` when both fall in the same frame
    const progress = Math.max(0, (now - start) / ms);
    if (progress >= 1) {
      el.textContent = text;
      return;
    }
    const settled = Math.floor(progress * text.length);
    let out = text.slice(0, settled);
    for (let i = settled; i < text.length; i++) out += text[i] === " " ? " " : NOISE[Math.floor(Math.random() * NOISE.length)];
    el.textContent = out;
    el._scramble = requestAnimationFrame(step);
  };
  el._scramble = requestAnimationFrame(step);
}
