/*
 * Draws one piece from the ascii-magic-art library on a canvas that covers its host.
 *
 * The library's own player repaints every character on every frame. In these
 * scenes only a few percent of the characters change from one frame to the next,
 * so this renderer keeps the last frame and redraws just the cells that differ.
 * That is what makes a full-window scene cheap enough to leave running.
 *
 * It still uses the library for everything that decides how a scene looks: the
 * piece itself, the character sets (restyle) and the halftone dot painter (paint).
 */
import { restyle } from "../../vendor/ascii-magic-art/runtime/glyphs.js";
import { paint, CELL_W, FONT, SHAPE_LOOKS } from "../../vendor/ascii-magic-art/runtime/canvas.js";

const MAX_BITMAP = 3456; // widest canvas to draw, in device pixels; CSS stretches it beyond that
const INK = "#d4d4d8"; // for cells a piece leaves uncoloured
const SHAPE_FPS = 10; // dot looks are repainted whole, so they run slower
const SPACE = 32;

/** Every glyph in every colour, drawn once and then stamped with drawImage. */
class GlyphAtlas {
  constructor(width, height, font) {
    this.w = width;
    this.h = height;
    this.font = font;
    this.perRow = Math.max(1, Math.floor(2048 / width));
    this.count = 0;
    this.tiles = new Map();
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.perRow * width;
    this.canvas.height = height * 8;
    this.ctx = this.canvas.getContext("2d");
  }

  /** Where a glyph sits in the atlas, as [x, y]. Draws it on first use. */
  tile(glyph, colour) {
    const key = glyph + colour;
    let at = this.tiles.get(key);
    if (at) return at;
    const i = this.count++;
    const x = (i % this.perRow) * this.w, y = Math.floor(i / this.perRow) * this.h;
    if (y + this.h > this.canvas.height) this.grow();
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, this.w, this.h);
    ctx.clip(); // a glyph never spills into the next cell
    ctx.font = this.font;
    ctx.textBaseline = "middle";
    ctx.fillStyle = colour;
    ctx.fillText(glyph, x, y + this.h / 2);
    ctx.restore();
    at = [x, y];
    this.tiles.set(key, at);
    return at;
  }

  grow() {
    const old = this.canvas;
    this.canvas = document.createElement("canvas");
    this.canvas.width = old.width;
    this.canvas.height = old.height * 2;
    this.ctx = this.canvas.getContext("2d");
    this.ctx.drawImage(old, 0, 0);
  }
}

const signatures = new WeakMap();
/** A string that changes when a palette's colours do, so a new palette forces a full redraw. */
function signature(palette) {
  if (!palette) return "";
  let s = signatures.get(palette);
  if (s === undefined) signatures.set(palette, (s = Object.values(palette).join()));
  return s;
}

export class SceneCanvas {
  /**
   * host   the element the canvas has to cover (it is measured, not written to)
   * mod    a piece module: { meta, default: create }
   * focus  the point of the picture to keep in view when it is cropped, as
   *        fractions of its width and height ([0.5, 1] is bottom centre)
   */
  constructor(host, mod, focus = [0.5, 1]) {
    this.host = host;
    this.meta = mod.meta;
    this.focus = focus;
    this.draw = mod.default(); // paints the still part of the scene once
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.t = 0; // seconds into the scene
    this.fps = 15;
  }

  /** look: { id, cell } from scenes.js. Redraws at once. */
  setLook(look) {
    const square = this.meta.cell === "square";
    this.look = look.id;
    this.mode = SHAPE_LOOKS[look.id] || "text";
    // merging cell x cell squares into one character only works for pictures drawn as text
    const merge = this.mode === "text" && square && look.cell > 1 ? look.cell : 1;
    this.style = { look: look.id, merge: merge > 1 ? merge : undefined, lift: square ? false : undefined };
    this.cols = Math.ceil(this.meta.cols / merge);
    this.rows = Math.ceil(this.meta.rows / merge);
    this.aspect = square ? 1 : 1 / CELL_W; // text cells are taller than they are wide
    this.fps = Math.min(this.meta.fps || 15, this.mode === "text" ? 30 : SHAPE_FPS);
    this.cell = 0; // forces layout to start the bitmap again
    this.layout();
  }

  /**
   * Size and place the canvas so it covers the host. A cell is a whole number of
   * device pixels, so characters stay sharp and a single cell can be cleared cleanly.
   */
  layout() {
    const width = this.host.clientWidth, height = this.host.clientHeight;
    if (!width || !height || !this.cols) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cover = Math.max(width / this.cols, height / (this.rows * this.aspect));
    const cell = Math.max(2, Math.min(Math.ceil(cover * dpr), Math.floor(MAX_BITMAP / this.cols)));
    const cellH = this.aspect === 1 ? cell : Math.round(cell * this.aspect);
    const W = this.cols * cell, H = this.rows * cellH;
    const scale = Math.max(1, (width * dpr) / W, (height * dpr) / H); // above 1 only when MAX_BITMAP held the canvas back
    const cssW = (W / dpr) * scale, cssH = (H / dpr) * scale;
    const snap = (v) => Math.round(v * dpr) / dpr;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.style.left = `${snap((width - cssW) * this.focus[0])}px`;
    this.canvas.style.top = `${snap((height - cssH) * this.focus[1])}px`;
    if (cell === this.cell && this.canvas.width === W && this.canvas.height === H) return;
    this.cell = cell;
    this.cellH = cellH;
    this.canvas.width = W; // this also clears it
    this.canvas.height = H;
    this.atlas = new GlyphAtlas(cell, cellH, `${cell / CELL_W}px ${FONT}`);
    this.last = null;
    this.render();
  }

  /** Draw the scene at this.t. */
  render() {
    if (!this.cell) return;
    const raw = this.draw(this.t);
    if (this.mode !== "text") return this.repaint(raw, this.mode);
    const frame = restyle(raw, this.meta.palette, this.style);
    const text = typeof frame === "string" ? frame : frame.text;
    // The fast path reads characters by position, which needs every row to be exactly
    // `cols` single-unit characters. Anything else goes to the library's painter.
    if (text.length !== this.rows * (this.cols + 1) - 1) return this.repaint(frame, "text");
    this.update(text, typeof frame === "string" ? null : frame.color, frame.palette || this.meta.palette);
  }

  /** Redraw only the cells that changed since the last frame. */
  update(text, colour, palette) {
    const { ctx, atlas, cell, cellH, cols, rows } = this;
    const sig = signature(palette);
    const last = this.last && this.last.sig === sig && this.last.text.length === text.length ? this.last : null;
    if (!last) ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let r = 0, i = 0; r < rows; r++, i++) { // the extra i++ steps over the row's newline
      const y = r * cellH;
      for (let c = 0; c < cols; c++, i++) {
        const glyph = text.charCodeAt(i), key = colour ? colour.charCodeAt(i) : SPACE;
        if (last && glyph === last.text.charCodeAt(i) && (!colour || key === last.colour.charCodeAt(i))) continue;
        const x = c * cell;
        if (last) ctx.clearRect(x, y, cell, cellH);
        if (glyph === SPACE) continue;
        const fill = (key !== SPACE && palette && palette[colour[i]]) || INK;
        if (glyph === 0x2588) { // a full block is the whole cell
          ctx.fillStyle = fill;
          ctx.fillRect(x, y, cell, cellH);
          continue;
        }
        const at = atlas.tile(text[i], fill);
        ctx.drawImage(atlas.canvas, at[0], at[1], cell, cellH, x, y, cell, cellH);
      }
    }
    this.last = { text, colour, sig };
  }

  /** Paint the whole frame with the library: halftone dots, and pieces the fast path cannot read. */
  repaint(frame, mode) {
    const { ctx, cell, cellH } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    paint(ctx, frame, frame.palette || this.meta.palette, {
      ...(this.meta.dots || {}), // the piece's own halftone tuning
      ...this.style,
      cw: cell,
      ch: cellH,
      mode,
      ink: INK,
      dpr: 1, // the canvas is already in device pixels
    });
    this.last = null;
  }
}
