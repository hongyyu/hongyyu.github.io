/*
 * Interface sounds, made on the spot with Web Audio (there are no sound files).
 *
 *   sweep the mouse across the skills   each one ticks like a key
 *   hover a button                      a soft tick
 *   click a link or a button            a tap, or a two-part click for a toggle
 *   the first click or key press        a short "ready", so the reader knows sound is on
 *   the yard at the foot of the page    the yarn thuds, a swat ticks, a pet chimes (yard.js)
 *
 * Browsers only let a page make sound after the reader has clicked or pressed a key,
 * so hovering is silent until then. The speaker button turns sound off and on, and
 * the choice is remembered.
 */

const KEY = "sound"; // localStorage: sound is on unless this holds "off"
const root = document.documentElement;

let ctx = null, out = null, noise = null;
let enabled = root.dataset.sound !== "off";

function context() {
  if (ctx) return ctx;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  ctx = new AudioContext();
  out = ctx.createGain();
  out.gain.value = 0.7;
  out.connect(ctx.destination);
  // a quarter second of white noise, the raw material for every click
  noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

/** Start the audio. Only works from a click or a key press; resolves to whether sound can play. */
async function unlock() {
  const c = context();
  if (!c) return false;
  if (c.state !== "running") {
    try { await c.resume(); } catch { return false; }
  }
  return c.state === "running";
}

/** The click of a switch: a few milliseconds of noise through a narrow filter. */
function click(at, { freq, q = 1.4, gain, decay }) {
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = q;
  const level = ctx.createGain();
  level.gain.setValueAtTime(gain, at);
  level.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  source.connect(filter).connect(level).connect(out);
  source.start(at, Math.random() * 0.2);
  source.stop(at + decay + 0.01);
}

/** The body under the click: a low note that drops and dies quickly. */
function thock(at, { freq, gain, decay, type = "sine" }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, at + decay);
  const level = ctx.createGain();
  level.gain.setValueAtTime(gain, at);
  level.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  osc.connect(level).connect(out);
  osc.start(at);
  osc.stop(at + decay + 0.01);
}

/** A soft, clean note. */
function note(at, freq, gain, length) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;
  const level = ctx.createGain();
  level.gain.setValueAtTime(0.0001, at);
  level.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  level.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(level).connect(out);
  osc.start(at);
  osc.stop(at + length + 0.01);
}

const vary = () => 0.9 + Math.random() * 0.22; // no two key presses sound quite the same

const CUES = {
  // a key on a mechanical keyboard, played quietly
  type(at) {
    const v = vary();
    click(at, { freq: 3400 * v, gain: 0.11, decay: 0.014 });
    thock(at, { freq: 210 * v, gain: 0.05, decay: 0.032 });
  },
  // lighter than a key: something came under the pointer
  select(at) {
    click(at, { freq: 2300 * vary(), q: 2, gain: 0.07, decay: 0.02 });
  },
  // a firm press
  tap(at) {
    const v = vary();
    click(at, { freq: 2700 * v, gain: 0.16, decay: 0.016 });
    thock(at, { freq: 165 * v, gain: 0.1, decay: 0.045 });
  },
  // a switch: down, then up
  toggle(at) {
    click(at, { freq: 2100, gain: 0.15, decay: 0.016 });
    thock(at, { freq: 150, gain: 0.09, decay: 0.04 });
    click(at + 0.07, { freq: 3300, gain: 0.11, decay: 0.012 });
  },
  // sound is on
  ready(at) {
    note(at, 660, 0.05, 0.16);
    note(at + 0.09, 990, 0.045, 0.22);
  },
  // the yarn hitting the ground or a wall; `amount` is how hard, 0 to 1
  bounce(at, amount) {
    thock(at, { freq: 120 + 40 * amount, gain: 0.12 * amount, decay: 0.06 });
    click(at, { freq: 900, q: 0.8, gain: 0.05 * amount, decay: 0.02 });
  },
  // a pet
  heart(at) {
    note(at, 1175, 0.035, 0.14);
    note(at + 0.06, 1568, 0.03, 0.2);
  },
};

/** Play a cue, if sound is on and the browser has let audio start. `amount` scales the cues that take one. */
export function play(cue, amount = 1) {
  if (!enabled || !ctx || ctx.state !== "running") return;
  CUES[cue]?.(ctx.currentTime + 0.002, amount);
}

/** A throttle: true for the first call, then false until gapMs has passed. */
function gate(gapMs) {
  let last = -Infinity;
  return (now) => {
    if (now - last < gapMs) return false;
    last = now;
    return true;
  };
}

/** True when the pointer has just come onto `el` from outside it. */
const entered = (el, event) => el && !(event.relatedTarget instanceof Node && el.contains(event.relatedTarget));

export function startSound() {
  const button = document.getElementById("btn-sound");
  const sync = () => {
    button?.setAttribute("aria-pressed", String(enabled));
    button?.setAttribute("aria-label", enabled ? "Sound effects are on. Turn them off." : "Sound effects are off. Turn them on.");
  };
  sync();

  // Sweeping across the skills ticks each one. The gate keeps a fast sweep from piling up.
  const sweep = gate(45);
  document.addEventListener("pointerover", (event) => {
    if (event.pointerType !== "mouse" || !(event.target instanceof Element)) return;
    if (entered(event.target.closest(".chips li"), event)) {
      if (sweep(event.timeStamp)) play("type");
    } else if (entered(event.target.closest(".btn"), event)) {
      play("select");
    }
  });

  // Every link and button answers a click. The sound button plays its own, below.
  window.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const el = event.target.closest("a, button");
    if (!el || el === button || el.closest(".yard")) return; // the yard makes its own sounds
    const cue = el.matches("button[aria-pressed]") ? "toggle" : "tap";
    void unlock().then((ok) => ok && play(cue));
  }, { capture: true });

  // The first click or key press is where the browser lets audio start.
  const gestures = ["pointerdown", "keydown"];
  const greet = (event) => {
    for (const type of gestures) window.removeEventListener(type, greet, { capture: true });
    if (!enabled) return;
    const onControl = event.target instanceof Element && event.target.closest("a, button, .yard");
    void unlock().then((ok) => ok && !onControl && play("ready"));
  };
  for (const type of gestures) window.addEventListener(type, greet, { capture: true });

  button?.addEventListener("click", () => {
    const turningOn = !enabled;
    if (turningOn) {
      enabled = true;
      delete root.dataset.sound;
      void unlock().then((ok) => ok && play("toggle"));
    } else {
      play("toggle"); // let it be heard before the sound goes
      enabled = false;
      root.dataset.sound = "off";
    }
    try { localStorage.setItem(KEY, enabled ? "on" : "off"); } catch { /* storage is off: nothing to remember */ }
    sync();
  });
}
