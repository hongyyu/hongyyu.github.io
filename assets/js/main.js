/*
 * The animated ASCII scene behind the page, and the small console that drives it.
 *
 * scenes.js   the scenes and looks on offer
 * renderer.js draws one scene on a canvas that covers the window
 * this file   loads scenes, runs the clock and wires up the buttons
 */
import { SceneCanvas } from "./renderer.js";
import { SCENES, LOOKS } from "./scenes.js";

const PIECES = new URL("../../vendor/ascii-magic-art/pieces/", import.meta.url);
const FADE_MS = 900; // matches the opacity transition on .scene-layer

const host = document.getElementById("scene");
const $ = (id) => document.getElementById(id);

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage is off: nothing to remember */ } },
};

const params = new URLSearchParams(location.search);
const indexOf = (list, field, wanted) => Math.max(0, list.findIndex((item) => item[field] === wanted));

const state = {
  scene: indexOf(SCENES, "slug", params.get("scene") ?? store.get("scene")),
  look: indexOf(LOOKS, "key", params.get("look") ?? store.get("look")),
  paused: matchMedia("(prefers-reduced-motion: reduce)").matches,
};

let current = null; // the SceneCanvas on screen
let request = 0;

/* ── the clock ───────────────────────────────────────────────────────── */

let raf = 0, lastTick = 0, lastDraw = 0;

function tick(now) {
  raf = requestAnimationFrame(tick);
  if (!current) return;
  // a tab that was in the background comes back with one huge gap: don't jump the scene ahead
  if (lastTick) current.t += Math.min(0.25, (now - lastTick) / 1000);
  lastTick = now;
  const step = 1000 / current.fps;
  if (now - lastDraw < step) return;
  lastDraw = now - ((now - lastDraw) % step); // keep the rhythm instead of drifting
  current.render();
}

function run() {
  if (raf || state.paused) return;
  lastTick = 0;
  raf = requestAnimationFrame(tick);
}

function halt() {
  cancelAnimationFrame(raf);
  raf = 0;
}

/* ── scenes ──────────────────────────────────────────────────────────── */

/** Load the current scene and fade it in over the one before. */
async function show() {
  const id = ++request;
  const scene = SCENES[state.scene];
  let mod;
  try {
    mod = await import(new URL(`${scene.slug}.js`, PIECES).href);
  } catch (error) {
    console.warn(`Scene "${scene.slug}" did not load.`, error);
    return;
  }
  if (id !== request) return; // a newer choice overtook this one

  const layer = document.createElement("div");
  layer.className = "scene-layer";
  host.append(layer);
  const next = new SceneCanvas(host, mod, scene.focus);
  layer.append(next.canvas);
  next.setLook(LOOKS[state.look]); // draws the first frame

  const previous = current?.canvas.parentElement;
  current = next;
  layer.getBoundingClientRect(); // settle the layer at opacity 0, so adding the class fades it
  layer.classList.add("is-on");
  if (previous) { // the old scene dissolves out as the new one comes in
    previous.classList.remove("is-on");
    setTimeout(() => previous.remove(), FADE_MS + 100);
  }
  run();
}

/* ── the console ─────────────────────────────────────────────────────── */

const pad = (n) => String(n).padStart(2, "0");

function sync() {
  const scene = SCENES[state.scene], look = LOOKS[state.look];
  document.documentElement.style.setProperty("--accent", scene.accent);
  if ($("scene-name")) $("scene-name").textContent = scene.name;
  if ($("scene-count")) $("scene-count").textContent = `${pad(state.scene + 1)}/${pad(SCENES.length)}`;
  if ($("look-name")) $("look-name").textContent = look.name;
  if ($("credit-scene")) $("credit-scene").textContent = scene.name;
  $("btn-scene")?.setAttribute("aria-label", `Scene ${state.scene + 1} of ${SCENES.length}: ${scene.name}. Show the next scene.`);
  $("btn-look")?.setAttribute("aria-label", `Drawn as ${look.name}. Switch to the next look.`);
  $("btn-pause")?.setAttribute("aria-pressed", String(state.paused));
  $("btn-pause")?.setAttribute("aria-label", state.paused ? "Play the animation" : "Pause the animation");
}

$("btn-scene")?.addEventListener("click", (event) => {
  const step = event.shiftKey ? SCENES.length - 1 : 1; // shift-click goes back
  state.scene = (state.scene + step) % SCENES.length;
  store.set("scene", SCENES[state.scene].slug);
  sync();
  show();
});

$("btn-look")?.addEventListener("click", (event) => {
  const step = event.shiftKey ? LOOKS.length - 1 : 1;
  state.look = (state.look + step) % LOOKS.length;
  store.set("look", LOOKS[state.look].key);
  sync();
  current?.setLook(LOOKS[state.look]);
});

$("btn-pause")?.addEventListener("click", () => {
  state.paused = !state.paused;
  sync();
  if (state.paused) halt();
  else run();
});

function setSceneOnly(on) {
  document.body.classList.toggle("scene-only", on);
  $("btn-view")?.setAttribute("aria-pressed", String(on));
  $("btn-view")?.setAttribute("aria-label", on ? "Bring the page back" : "Hide the page and look at the scene");
  if (on) window.scrollTo({ top: 0 });
}

$("btn-view")?.addEventListener("click", () => setSceneOnly(!document.body.classList.contains("scene-only")));
addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("scene-only")) setSceneOnly(false);
});

/* ── keep the canvas covering the window ─────────────────────────────── */

new ResizeObserver(() => current?.layout()).observe(host);

sync();
show();
