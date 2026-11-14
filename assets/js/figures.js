/*
 * The small animated ASCII figures in the project cards.
 *
 * Each figure is a function that draws one frame onto a grid of characters. The grid
 * is shown as one <span> per cell, each exactly one character wide, so the picture
 * stays lined up even where a font is missing a glyph. Only cells that change are
 * touched, and a figure only runs while it is on screen.
 *
 * To add a figure: write a draw(grid, t) function, add it to FIGURES below, and put
 * <div class="figure" data-figure="its-name"> in a card.
 */

const FPS = 12;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
/** A repeatable pseudo-random number in 0..1 for a whole number. */
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** A frame: one character and one tone (a CSS class) per cell. */
class Grid {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.chars = new Array(cols * rows);
    this.tones = new Array(cols * rows);
    this.clear();
  }

  clear() {
    this.chars.fill(" ");
    this.tones.fill("");
  }

  put(x, y, char, tone = "") {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const i = y * this.cols + x;
    this.chars[i] = char;
    this.tones[i] = tone;
  }

  text(x, y, string, tone = "") {
    for (let i = 0; i < string.length; i++) this.put(x + i, y, string[i], tone);
  }

  /** A box in single lines, corners at (x, y) and (x + w - 1, y + h - 1). */
  box(x, y, w, h, tone = "ln", corners = "┌┐└┘") {
    for (let i = 1; i < w - 1; i++) {
      this.put(x + i, y, "─", tone);
      this.put(x + i, y + h - 1, "─", tone);
    }
    for (let j = 1; j < h - 1; j++) {
      this.put(x, y + j, "│", tone);
      this.put(x + w - 1, y + j, "│", tone);
    }
    this.put(x, y, corners[0], tone);
    this.put(x + w - 1, y, corners[1], tone);
    this.put(x, y + h - 1, corners[2], tone);
    this.put(x + w - 1, y + h - 1, corners[3], tone);
  }
}

/* ── Dado: floors stacking up into two buildings ─────────────────────── */

/**
 * A block of floors in the classic ASCII box projection. The front is w characters
 * wide with its bottom row at `bottom`; the top and side lean d characters back.
 * `floors` holds a tone per floor, lowest first.
 *
 *       ________
 *      /       /|
 *     /_______/ |
 *     |_______| /
 *     |_______|/
 */
function slab(g, x, bottom, w, d, floors) {
  const n = floors.length;
  if (!n) return;
  const top = bottom - n + 1; // the first row of the front
  // the back edge of the roof
  for (let i = 0; i < w - 1; i++) g.put(x + d + i, top - d - 1, "_", "ln");
  // the roof
  for (let j = 0; j < d; j++) {
    const left = x + d - 1 - j, row = top - d + j;
    g.put(left, row, "/", "ln");
    for (let i = 1; i < w - 1; i++) g.put(left + i, row, j === d - 1 ? "_" : " ", "ln");
    g.put(left + w - 1, row, "/", "ln");
  }
  // the front: one row per floor, in that floor's tone
  for (let i = 0; i < n; i++) {
    const row = top + i, tone = floors[n - 1 - i];
    g.put(x, row, "|", "ln");
    for (let k = 1; k < w - 1; k++) g.put(x + k, row, "_", tone);
    g.put(x + w - 1, row, "|", "ln");
  }
  // the side: blank what it covers, so it hides whatever is behind, then draw its far edge
  const edge = x + w - 1 + d;
  for (let row = top - d; row <= bottom; row++) {
    const from = row < top ? x + w + (top - 1 - row) : x + w; // just right of the roof, or of the front
    const to = row <= bottom - d ? edge - 1 : edge - (row - (bottom - d)); // just left of the far edge
    for (let col = from; col <= to; col++) g.put(col, row, " ");
  }
  for (let row = top - d; row <= bottom - d; row++) g.put(edge, row, "|", "ln");
  for (let i = 0; i < d; i++) g.put(edge - i, bottom - d + 1 + i, "/", "ln");
}

const DADO = {
  bottom: 10,
  depth: 2,
  buildings: [
    { x: 1, w: 10, floors: ["c1", "c1", "c2", "c3", "c3", "c4"] },
    { x: 15, w: 10, floors: ["c2", "c2", "c1", "c4"] },
  ],
  // which building gets the next floor
  order: [0, 1, 0, 1, 0, 1, 0, 1, 0, 0],
  step: 0.55, // seconds per floor
  hold: 3.2,
  clear: 0.7,
};

function dado(g, t) {
  const { bottom, depth, buildings, order, step, hold, clear } = DADO;
  const build = order.length * step, cycle = build + hold + clear;
  const at = t % cycle;

  let placed = order.length, flying = -1, drop = 0, lit = -1;
  if (at < build) {
    placed = Math.floor(at / step);
    flying = placed;
    const p = clamp(((at % step) / step) * 1.5); // lands two thirds of the way through its step
    drop = Math.round((1 - p * p) * 4); // rows still to fall
  } else if (at < build + hold) {
    lit = Math.floor((at - build) / 0.32) % order.length; // a highlight walks the floors
  } else {
    placed = Math.floor((1 - (at - build - hold) / clear) * order.length); // lifted away, last floor first
  }

  // the empty sites
  for (const b of buildings) for (let i = 0; i < b.w; i++) g.put(b.x + i, bottom, "·", "fa");

  buildings.forEach((b, index) => {
    const mine = order.map((owner, i) => (owner === index ? i : -1)).filter((i) => i >= 0);
    const done = mine.filter((i) => i < placed).length;
    const floors = b.floors.slice(0, done).map((tone, level) => (mine[level] === lit ? "hi" : tone));
    slab(g, b.x, bottom, b.w, depth, floors);
    if (flying >= 0 && order[flying] === index && drop > 0) {
      slab(g, b.x, bottom - done - drop, b.w, depth, [b.floors[done]]);
    } else if (flying >= 0 && order[flying] === index) {
      slab(g, b.x, bottom, b.w, depth, [...floors, b.floors[done]]); // it has landed
    }
  });
}

/* ── Pharmacy portal: requests crossing a hub between stores and services ── */

const ROWS = [1, 4, 7];
const PORTAL = (() => {
  const toHub = (i) => {
    const r = ROWS[i], cells = [[4, r], [5, r]];
    for (let y = r; y !== 4; y += Math.sign(4 - r)) cells.push([6, y]);
    cells.push([6, 4], [7, 4], [8, 4]);
    return cells;
  };
  const fromHub = (j) => {
    const r = ROWS[j], cells = [[18, 4], [19, 4]];
    for (let y = 4; y !== r; y += Math.sign(r - 4)) cells.push([20, y]);
    cells.push([20, r], [21, r], [22, r]);
    return cells;
  };
  // a request goes store -> hub -> service, waits, and its answer comes back the same way
  const trip = (i, j) => {
    const a = toHub(i), b = fromHub(j);
    const wait = (what, n) => new Array(n).fill(what);
    return [
      ...wait({ store: i }, 2),
      ...a.map((cell) => ({ cell, tone: "ac" })),
      ...wait({ hub: true }, 3),
      ...b.map((cell) => ({ cell, tone: "ac" })),
      ...wait({ service: j }, 4),
      ...[...b].reverse().map((cell) => ({ cell, tone: "hi" })),
      ...wait({ hub: true }, 3),
      ...[...a].reverse().map((cell) => ({ cell, tone: "hi" })),
      ...wait({ store: i }, 2),
    ];
  };
  return {
    speed: 13, // steps a second
    cycle: 7.2,
    flows: [
      { start: 0, steps: trip(0, 1) },
      { start: 1.5, steps: trip(2, 0) },
      { start: 3.1, steps: trip(1, 2) },
      { start: 4.4, steps: trip(0, 2) },
    ],
  };
})();

function pharmacy(g, t) {
  const now = { stores: new Set(), services: new Set(), hub: false, dots: [] };
  for (const flow of PORTAL.flows) {
    const local = (((t - flow.start) % PORTAL.cycle) + PORTAL.cycle) % PORTAL.cycle;
    const step = flow.steps[Math.floor(local * PORTAL.speed)];
    if (!step) continue;
    if (step.cell) now.dots.push(step);
    else if (step.hub) now.hub = true;
    else if ("store" in step) now.stores.add(step.store);
    else now.services.add(step.service);
  }

  const services = ["DB", "ID", "WS"];
  ROWS.forEach((r, i) => {
    // a store on the left
    const store = now.stores.has(i) ? "hi" : "ln";
    g.box(0, r - 1, 4, 3, store);
    g.text(1, r, "Rx", now.stores.has(i) ? "hi" : "");
    g.put(3, r, "├", store);
    g.text(4, r, "──", "ln");
    // a service on the right
    const service = now.services.has(i) ? "ac" : "ln";
    g.box(23, r - 1, 4, 3, service);
    g.text(24, r, services[i], now.services.has(i) ? "ac" : "");
    g.put(23, r, "┤", service);
    g.text(21, r, "──", "ln");
  });
  // the two buses that gather the links
  for (let y = 2; y <= 6; y++) {
    g.put(6, y, "│", "ln");
    g.put(20, y, "│", "ln");
  }
  g.put(6, 1, "┐", "ln"); g.put(6, 4, "┼", "ln"); g.put(6, 7, "┘", "ln");
  g.put(20, 1, "┌", "ln"); g.put(20, 4, "┼", "ln"); g.put(20, 7, "└", "ln");
  g.text(7, 4, "──", "ln");
  g.text(18, 4, "──", "ln");
  // the hub, with a pharmacy cross
  const hub = now.hub ? "hi" : "ln";
  g.box(9, 2, 9, 5, hub);
  g.put(9, 4, "┤", hub);
  g.put(17, 4, "├", hub);
  const cross = now.hub ? "hi" : "ac";
  g.put(13, 3, "┃", cross);
  g.text(12, 4, "━╋━", cross);
  g.put(13, 5, "┃", cross);

  for (const dot of now.dots) g.put(dot.cell[0], dot.cell[1], "●", dot.tone);
}

/* ── Alexa: a voice comes in, a pause, an answer goes out ────────────── */

const LEVELS = " ▁▂▃▄▅▆▇█";
const VOICE = { cycle: 8, bars: 24, rows: 6, left: 2, base: 6 };

function alexa(g, t) {
  const at = t % VOICE.cycle;
  // idle, listening, thinking, answering, idle
  const phase = at < 0.8 ? "idle" : at < 3.2 ? "listen" : at < 4.2 ? "think" : at < 7.2 ? "answer" : "idle";
  const tick = Math.floor(t * FPS);

  // how loud each moment is: syllables for a voice, a steadier swell for the answer
  let loud = 0;
  if (phase === "listen") loud = 0.35 + 0.65 * Math.abs(Math.sin(at * 7.3)) * (0.5 + 0.5 * hash(Math.floor(at * 5)));
  if (phase === "answer") loud = 0.55 + 0.4 * Math.sin(at * 3.1) * Math.sin(at * 1.7 + 1);
  const edge = Math.min(1, (at - (phase === "listen" ? 0.8 : 4.2)) * 4, ((phase === "listen" ? 3.2 : 7.2) - at) * 4);
  loud *= clamp(edge);

  const tone = phase === "answer" ? "ac" : "hi";
  for (let c = 0; c < VOICE.bars; c++) {
    const x = (c + 0.5) / VOICE.bars;
    const window = Math.sin(Math.PI * x) ** 1.4; // quieter towards the edges
    const wobble = phase === "answer"
      ? 0.5 + 0.5 * Math.sin(c * 0.9 - t * 9) * Math.sin(c * 0.37 + t * 4)
      : hash(c * 13 + tick * 7);
    const level = Math.round(clamp(loud * window * (0.35 + 0.65 * wobble)) * VOICE.rows * 8);
    for (let r = 0; r < VOICE.rows; r++) {
      const fill = clamp(level - r * 8, 0, 8);
      if (fill) g.put(VOICE.left + c, VOICE.base - r, LEVELS[fill], tone);
    }
    if (!level) g.put(VOICE.left + c, VOICE.base, "·", "fa"); // silence
  }

  // the speaker, with its light ring
  g.box(0, 7, 28, 3, "ln", "╭╮╰╯");
  const head = (tick * 2) % VOICE.bars; // where the bright stretch is while it thinks
  for (let c = 0; c < VOICE.bars; c++) {
    let lamp = "fa";
    if (phase === "listen") lamp = "ac";
    if (phase === "think") lamp = (c - head + VOICE.bars) % VOICE.bars < 6 ? "hi" : "ln";
    if (phase === "answer") lamp = Math.sin(at * 6) > -0.2 ? "ac" : "ln";
    g.put(VOICE.left + c, 8, "━", lamp);
  }
}

/* ── the stage ───────────────────────────────────────────────────────── */

/** still: the moment to show when nothing may move. */
const FIGURES = {
  dado: { cols: 28, rows: 11, draw: dado, still: 6.5 },
  pharmacy: { cols: 27, rows: 9, draw: pharmacy, still: 0.9 },
  alexa: { cols: 28, rows: 10, draw: alexa, still: 5.3 },
};

/** One frame of a figure as plain text, for trying a figure out in the browser console. */
export function frameText(name, t) {
  const figure = FIGURES[name], grid = new Grid(figure.cols, figure.rows);
  figure.draw(grid, t);
  const lines = [];
  for (let y = 0; y < grid.rows; y++) lines.push(grid.chars.slice(y * grid.cols, (y + 1) * grid.cols).join(""));
  return lines.join("\n");
}

const stage = []; // every figure on the page
let raf = 0, last = 0, paused = false;

function mount(el) {
  const figure = FIGURES[el.dataset.figure];
  if (!figure) return null;
  const grid = new Grid(figure.cols, figure.rows);
  const cells = [];
  el.textContent = "";
  for (let y = 0; y < figure.rows; y++) {
    const row = document.createElement("div");
    for (let x = 0; x < figure.cols; x++) {
      const cell = document.createElement("span");
      cell.textContent = " ";
      row.append(cell);
      cells.push(cell);
    }
    el.append(row);
  }
  return { el, figure, grid, cells, t: 0, visible: true, shown: { chars: [], tones: [] } };
}

function draw(item) {
  const { grid, cells, shown } = item;
  grid.clear();
  item.figure.draw(grid, item.t);
  for (let i = 0; i < cells.length; i++) {
    if (grid.chars[i] !== shown.chars[i]) cells[i].textContent = shown.chars[i] = grid.chars[i];
    if (grid.tones[i] !== shown.tones[i]) cells[i].className = shown.tones[i] = grid.tones[i];
  }
}

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
    item.t = item.figure.still;
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
