/*
 * The yard at the foot of the page: a pixel cat and a ball of yarn.
 *
 *   click or tap the yard        the yarn drops there
 *   drag the yarn and let go     it flies; the cat chases a ball you threw and bats it back
 *   move the pointer on the cat  it purrs; every few strokes is a pet, and pets are counted
 *   click the cat                it jumps
 *   keyboard                     Tab to the cat or the yarn, then Enter to pet or toss
 *
 * Left alone, the cat wanders over to the yarn and goes back to sleep.
 * The count of pets is kept in this browser only: the site has no server to keep a total.
 */
import { play } from "./sound.js";

const GRAVITY = 1500; // pixels per second, per second
const PX = 3; // screen pixels per pixel of art
const R = 10.5; // the yarn's radius in screen pixels
const WALK = 62, RUN = 215; // pixels per second
const REACH = 34; // how close the yarn has to be for a swat
const EDGE = 40; // the cat keeps this far from the walls, so its drawing stays in view
const KEEN = 0.25; // below this much interest the cat stops playing
const PETS_KEY = "pets";

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ── the art ─────────────────────────────────────────────────────────── */

// One string per row of pixels, one character per pixel. "." is empty.
const INK = {
  "#": "#cfa46b", // fur
  s: "#8b5a2b", // stripes, and eyes when they are shut
  w: "#f3efe6", // muzzle and socks
  e: "#17171a", // eyes
  p: "#f08fc0", // nose, blush and hearts
  a: "#f2766b", // yarn
  A: "#b94f4a", // yarn, the strands in shadow
  z: "#8f8f99", // a sleepy z
};

/** The cat sitting, seen from the front. `eyes` are its two eye rows; the rest can be swapped by row number. */
function front(eyes, swap = {}) {
  const rows = [
    "..#.......#....",
    ".###.....###...",
    ".###########...",
    ".###s#s#s###...",
    eyes[0],
    eyes[1],
    ".###########...",
    ".####wpw####...",
    "..###www###....",
    "..#########..#.",
    ".###########.#.",
    ".#s#######s#.s.",
    ".##ww###ww####.",
  ];
  for (const [row, pixels] of Object.entries(swap)) rows[row] = pixels;
  return rows;
}
const OPEN = ".###########...";

/** The cat from the side, facing right. */
function side({ tail = "up", eye = "e", legs, paw = false }) {
  const up = tail === "up";
  return [
    "............#...#..",
    "...........###.###.",
    `${up ? ".#........." : "..........."}#######.`,
    `${up ? ".#........." : "..........."}#${eye}###${eye}#.`,
    `${up ? "..#........" : "###........"}###p###.`,
    "...#########wwwww..",
    `...##s##s##s####${paw ? "##w" : "..."}`,
    "...#############...",
    "...############....",
    ...legs,
  ];
}

// Front views never flip. Side views are drawn facing right and flipped for left.
const CAT = {
  sit: front([OPEN, ".##e#####e##..."]),
  wag: front([OPEN, ".##e#####e##..."], { 9: "..#########...#" }),
  blink: front([OPEN, ".##s#####s##..."]),
  left: front([OPEN, ".#e#####e###..."]),
  right: front([OPEN, ".###e#####e#..."]),
  happy: front([".##s#####s##...", ".#s#s###s#s#..."], { 6: ".#p#######p#..." }),
  wow: front([".##e#####e##...", ".##e#####e##..."], { 9: "..#########..#.", 8: "..###wew###...." }),
  sulk: front([".#s#######s#...", ".##s#####s##..."], { 7: ".####www####..." }),
  sleep: [
    "..#.......#....",
    ".###.....###...",
    ".###########...",
    ".###s#s#s###...",
    ".##s#####s##...",
    ".####wpw####...",
    ".#############.",
    "##s#########s##",
  ],
  ready: [ // low to the ground, eyes wide, tail up
    "..#.......#...#",
    ".###.....###..#",
    ".###########.s.",
    ".##e#####e##.#.",
    ".##e#####e##.#.",
    ".####wpw####.#.",
    ".#############.",
    "##ww######ww##.",
  ],
  walk: [
    side({ legs: ["...#.#......#.#....", "...#.#......#.#...."] }),
    side({ legs: ["...#..#....#..#....", "..#....#..#....#..."] }),
  ],
  run: [
    side({ tail: "back", legs: ["..##..........##...", ".#..............#.."] }),
    side({ tail: "back", legs: [".....##....##......", "......#....#......."] }),
  ],
  swat: side({ eye: "s", paw: true, legs: ["...#.#......#......", "...#.#......#......"] }),
};

const YARN = [
  "..aaa..",
  ".aAaaa.",
  "aaaAaAa",
  "aAaaAaa",
  "aaAaaAa",
  ".aaaAa.",
  "..aaa..",
];
const HEART = [".p.p.", "ppppp", "ppppp", ".ppp.", "..p.."];
const ZED = ["zzzz", "..z.", ".z..", "zzzz"];

/** Draw a sprite on a canvas, one canvas pixel per pixel of art. Returns its width on screen. */
function paint(canvas, rows) {
  const w = rows[0].length, h = rows.length;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w * PX}px`;
    canvas.style.height = `${h * PX}px`;
  }
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ink = INK[row[x]];
      if (!ink) continue;
      ctx.fillStyle = ink;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return w * PX;
}

/* ── the yard ────────────────────────────────────────────────────────── */

let paused = false;
let resume = () => {};

/** Pause or resume the yard along with everything else that moves. */
export function setYardPaused(value) {
  paused = value;
  resume();
}

export function startYard({ startPaused = false } = {}) {
  const yard = document.getElementById("yard");
  if (!yard) return;
  const catEl = yard.querySelector(".cat"), catArt = catEl.querySelector("canvas");
  const yarnEl = yard.querySelector(".yarn"), yarnArt = yarnEl.querySelector("canvas");
  const thread = yard.querySelector(".thread polyline");
  const countEl = document.getElementById("pet-count");
  paused = startPaused;
  paint(yarnArt, YARN);

  let width = yard.clientWidth, height = yard.clientHeight;

  const cat = { x: 64, y: 0, vy: 0, face: 1, state: "sleep", since: 0, stride: 0, strokes: 0, sulkUntil: -9, keyPet: -9, goal: 0 };
  const ball = { x: 150, y: 0, vx: 0, vy: 0, angle: 0, held: false };
  const pointer = { x: 0, y: 0, inside: false, down: false, lastMove: -9, lastStroke: -9, travel: 0 };
  let clock = 0; // seconds the yard has been running
  let interest = 0; // 1 after you throw or drop the yarn; every swat spends some
  let drag = null;
  let lastZ = 0;
  let shown = null, shownWidth = 0;
  let trail = []; // where the yarn has just been: the loose thread behind it
  let trailAt = 0;

  let pets = 0;
  try { pets = Number(localStorage.getItem(PETS_KEY)) || 0; } catch { /* storage is off: count from zero */ }
  const showPets = () => { if (countEl) countEl.textContent = pets.toLocaleString("en-US"); };
  showPets();

  const set = (state) => {
    cat.state = state;
    cat.since = clock;
  };
  const played = () => yard.classList.add("played"); // the hint has done its job

  /** Where an event is in the yard: x from the left, y up from the ground. */
  const local = (event) => {
    const box = yard.getBoundingClientRect();
    return { x: event.clientX - box.left, y: box.bottom - event.clientY };
  };
  const onCat = (p) => Math.abs(p.x - cat.x) < 30 && p.y >= 0 && p.y < 44 + cat.y;

  /* ── things that float up and fade ── */

  function float(rows, x, y) {
    const el = document.createElement("canvas");
    el.className = "floater";
    const w = paint(el, rows);
    el.style.setProperty("--x", `${Math.round(x - w / 2)}px`);
    el.style.setProperty("--y", `${Math.round(-y)}px`);
    el.style.setProperty("--drift", `${Math.round(rand(-9, 9))}px`);
    yard.append(el);
    setTimeout(() => el.remove(), 1400);
  }

  function pet() {
    pets++;
    try { localStorage.setItem(PETS_KEY, String(pets)); } catch { /* storage is off: nothing to remember */ }
    showPets();
    float(HEART, cat.x + rand(-12, 12), 42 + cat.y);
    play("heart");
  }

  /** One pass of the pointer along the cat. Every third one is a pet. */
  function stroke() {
    pointer.lastStroke = clock;
    played();
    if (clock < cat.sulkUntil) return;
    cat.strokes++;
    if (cat.strokes % 3 === 0) pet();
  }

  /* ── the yarn ── */

  function throwYarn(vx, vy) {
    ball.held = false;
    ball.vx = vx;
    ball.vy = vy;
    interest = 1;
    played();
  }

  function stepBall(dt) {
    if (ball.held) return;
    ball.vy -= GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.angle += (ball.vx * dt) / R;
    const thud = (speed) => { if (speed > 170) play("bounce", clamp(speed / 900, 0.25, 1)); };
    if (ball.x < R) {
      ball.x = R;
      if (ball.vx < 0) { thud(-ball.vx); ball.vx *= -0.6; }
    } else if (ball.x > width - R) {
      ball.x = width - R;
      if (ball.vx > 0) { thud(ball.vx); ball.vx *= -0.6; }
    }
    const ceiling = height - 2 * R;
    if (ball.y > ceiling) {
      ball.y = ceiling;
      if (ball.vy > 0) ball.vy *= -0.4;
    }
    if (ball.y <= 0) {
      ball.y = 0;
      if (ball.vy < -90) { thud(-ball.vy); ball.vy *= -0.52; } else ball.vy = 0;
      ball.vx *= Math.exp(-1.8 * dt); // it rolls to a stop
      if (Math.abs(ball.vx) < 6) ball.vx = 0;
    }
  }

  /** The thread: a short line through where the yarn has just been. It reels in when the yarn rests. */
  function stepTrail() {
    const head = trail[trail.length - 1];
    const moved = !head || Math.hypot(ball.x - head[0], ball.y - head[1]) > 5;
    if (moved) {
      trail.push([ball.x, ball.y]);
      if (trail.length > 16) trail.shift();
      trailAt = clock;
    } else if (trail.length > 1 && clock - trailAt > 0.05) {
      trail.shift();
      trailAt = clock;
    }
  }

  /* ── the cat ── */

  /** Step towards x at a speed. True once it is there. */
  function go(x, speed, dt) {
    const gap = x - cat.x, step = speed * dt;
    if (Math.abs(gap) <= step) {
      cat.x = x;
      return true;
    }
    cat.face = gap > 0 ? 1 : -1;
    cat.x += cat.face * step;
    cat.stride += step;
    return false;
  }

  function swat() {
    set("swat");
    let dir = ball.x >= cat.x ? 1 : -1;
    if (ball.x < 70) dir = 1; // never into the near wall
    else if (ball.x > width - 70) dir = -1;
    cat.face = dir;
    ball.vx = dir * rand(240, 460) * (0.55 + 0.45 * interest);
    ball.vy = rand(330, 520) * Math.sqrt(interest);
    ball.y = Math.max(ball.y, 1);
    interest *= 0.72;
    play("type");
  }

  function stepCat(dt) {
    const t = clock - cat.since;
    const gap = ball.x - cat.x;
    const sulking = clock < cat.sulkUntil;
    const stroked = clock - pointer.lastStroke < 0.7 && onCat(pointer);
    const petting = !sulking && (stroked || clock - cat.keyPet < 0.9);
    const keen = interest > KEEN && !ball.held;

    if (cat.y > 0 || cat.vy > 0) { // in the air
      cat.vy -= GRAVITY * dt;
      cat.y += cat.vy * dt;
      if (cat.y <= 0) { cat.y = 0; cat.vy = 0; }
    }

    switch (cat.state) {
      case "sleep":
        if (clock - lastZ > 1.7) {
          lastZ = clock;
          float(ZED, cat.x + 26, 30);
        }
        if (keen || ball.held) set("wake");
        else if (petting) set("pet");
        break;
      case "wake":
        if (t > 0.45) set("sit");
        break;
      case "sit":
        if (petting) {
          cat.strokes = 0;
          set("pet");
        } else if (keen && (Math.abs(gap) > REACH || ball.y > 40)) set("chase");
        else if (keen) swat();
        else if (t > 14 && clock - pointer.lastMove > 6 && !ball.held) set(Math.abs(gap) > 50 ? "stroll" : "sleep");
        break;
      case "pet":
        if (cat.strokes > 36) { // enough: cats get overstimulated
          cat.strokes = 0;
          cat.sulkUntil = clock + 4;
          cat.goal = cat.x < width / 2 ? width - 60 : 60;
          set("flee");
        } else if (!petting && t > 0.4) set("sit");
        break;
      case "hop":
        if (cat.y === 0 && t > 0.1) set("sit");
        break;
      case "chase": {
        if (ball.held) { set("sit"); break; }
        if (!keen || t > 7) { interest = 0; set("stroll"); break; }
        // run to where the yarn is heading while it is in the air
        const ahead = clamp(ball.x + (ball.y > 0 ? ball.vx * 0.22 : 0), EDGE, width - EDGE);
        go(ahead, RUN, dt);
        if (Math.abs(ball.x - cat.x) < REACH && ball.y < 36) swat();
        break;
      }
      case "swat": // holds the pose for a moment
        if (t > 0.24) set(keen ? "chase" : "stroll");
        break;
      case "stroll": { // amble over and sit by the yarn
        if (keen) { set("chase"); break; }
        const beside = clamp(ball.x + (cat.x < ball.x ? -34 : 34), EDGE, width - EDGE);
        if (go(beside, WALK, dt)) {
          cat.face = ball.x >= cat.x ? 1 : -1;
          set("sit");
        }
        break;
      }
      case "flee":
        if (go(cat.goal, RUN, dt)) set("sit");
        break;
    }
  }

  /** The drawing for this moment, and whether it is flipped to face left. */
  function drawing() {
    const moving = { chase: CAT.run, flee: CAT.run, stroll: CAT.walk }[cat.state];
    if (moving) return [moving[Math.floor(cat.stride / 15) % 2], cat.face < 0];
    switch (cat.state) {
      case "sleep": return [CAT.sleep, false];
      case "wake":
      case "hop": return [CAT.wow, false];
      case "pet": return [CAT.happy, false];
      case "swat": return [CAT.swat, cat.face < 0];
    }
    // sitting
    if (clock < cat.sulkUntil) return [CAT.sulk, false];
    if (ball.held) return [CAT.ready, ball.x < cat.x];
    if ((clock + 1.3) % 4.4 < 0.14) return [CAT.blink, false];
    const moved = clock - pointer.lastMove < 2.5 && pointer.inside;
    const watch = ball.y > 0 || ball.vx !== 0 ? ball : moved ? pointer : null;
    if (watch && watch.x < cat.x - 34) return [CAT.left, false];
    if (watch && watch.x > cat.x + 34) return [CAT.right, false];
    return [clock % 1.6 < 0.8 ? CAT.sit : CAT.wag, false];
  }

  function draw() {
    const [sprite, flip] = drawing();
    if (sprite !== shown) {
      shown = sprite;
      shownWidth = paint(catArt, sprite);
    }
    catEl.classList.toggle("flip", flip);
    // whole pixels, so the art stays crisp
    catEl.style.transform = `translate(${Math.round(cat.x - shownWidth / 2)}px, ${Math.round(-cat.y)}px)`;
    yarnEl.style.transform = `translate(${Math.round(ball.x - R)}px, ${Math.round(-ball.y)}px)`;
    yarnArt.style.transform = `rotate(${Math.round(ball.angle / (Math.PI / 2)) * 90}deg)`; // quarter turns
    thread?.setAttribute("points", trail.map(([x, y]) => `${x.toFixed(1)},${(height - y - R).toFixed(1)}`).join(" "));
  }

  /* ── input ── */

  yard.addEventListener("pointermove", (event) => {
    const p = local(event), from = pointer.x;
    Object.assign(pointer, p);
    pointer.lastMove = clock;
    if (event.pointerType === "mouse") pointer.inside = true;
    if (drag) return;
    // stroking: the pointer travelling along the cat (a finger has to be down)
    if (onCat(p) && (event.pointerType === "mouse" || pointer.down)) {
      pointer.travel += Math.abs(p.x - from);
      if (pointer.travel > 26) {
        pointer.travel = 0;
        stroke();
      }
    }
  });
  yard.addEventListener("pointerleave", () => { pointer.inside = false; });
  yard.addEventListener("pointerdown", () => { pointer.down = true; });
  window.addEventListener("pointerup", () => { pointer.down = false; });

  // a click on the open yard drops the yarn there
  yard.addEventListener("click", (event) => {
    if (event.target.closest(".cat, .yarn")) return;
    const p = local(event);
    ball.x = clamp(p.x, R, width - R);
    ball.y = clamp(p.y - R, 0, height - 2 * R);
    trail = [];
    throwYarn(0, 0);
    play("select");
  });

  catEl.addEventListener("click", (event) => {
    played();
    if (event.detail === 0) { // the keyboard: a pet
      if (clock >= cat.sulkUntil) {
        cat.keyPet = clock;
        if (cat.state === "sleep" || cat.state === "sit") set("pet");
        pet();
      }
      return;
    }
    if (cat.y > 0) return;
    cat.vy = 330; // the mouse: a start
    set("hop");
    play("select");
  });

  yarnEl.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || drag) return;
    try { yarnEl.setPointerCapture(event.pointerId); } catch { /* the drag still works while the pointer stays on the yarn */ }
    const p = local(event);
    drag = { id: event.pointerId, start: p, moved: 0, samples: [{ ...p, t: event.timeStamp }] };
    ball.held = true;
    ball.vx = ball.vy = 0;
    played();
  });
  yarnEl.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const p = local(event);
    drag.samples = drag.samples.filter((s) => event.timeStamp - s.t < 90).concat({ ...p, t: event.timeStamp });
    drag.moved = Math.max(drag.moved, Math.hypot(p.x - drag.start.x, p.y - drag.start.y));
    ball.x = clamp(p.x, R, width - R);
    ball.y = clamp(p.y - R, 0, height - 2 * R);
  });
  const toss = () => throwYarn(rand(-1, 1) > 0 ? rand(140, 320) : rand(-320, -140), rand(420, 560));
  yarnEl.addEventListener("pointerup", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const { samples, moved } = drag;
    drag = null;
    if (moved < 5) return toss(); // a click on the yarn, not a drag
    // the speed of the hand over its last moments, kept within reason
    const a = samples[0], b = samples[samples.length - 1];
    const dt = Math.max(0.016, (b.t - a.t) / 1000);
    let vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
    const speed = Math.hypot(vx, vy);
    if (speed > 1500) { vx *= 1500 / speed; vy *= 1500 / speed; }
    throwYarn(vx, vy);
  });
  const letGo = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    throwYarn(0, 0);
  };
  yarnEl.addEventListener("pointercancel", letGo);
  yarnEl.addEventListener("lostpointercapture", letGo);
  yarnEl.addEventListener("click", (event) => { if (event.detail === 0) toss(); }); // the keyboard

  /* ── the loop: only while the yard is on screen and nothing is paused ── */

  let raf = 0, last = 0, visible = true;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.034, (now - last) / 1000) : 0; // a stalled tab must not fling the yarn
    last = now;
    clock += dt;
    stepBall(dt);
    stepTrail();
    stepCat(dt);
    draw();
  }
  resume = () => {
    const run = visible && !paused;
    if (run && !raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    } else if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  new ResizeObserver(() => {
    width = yard.clientWidth;
    height = yard.clientHeight;
    cat.x = clamp(cat.x, EDGE, width - EDGE);
    ball.x = clamp(ball.x, R, width - R);
    trail = [];
    draw();
  }).observe(yard);
  if (typeof IntersectionObserver !== "undefined") {
    new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      resume();
    }).observe(yard);
  }

  draw();
  resume();
}

/** Every drawing, by name, for looking the art over: `(await import("/assets/js/yard.js")).ART`. */
export const ART = { ...CAT, yarn: YARN, heart: HEART, zed: ZED, INK, PX };
