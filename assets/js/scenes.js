/*
 * The scenes this site can play behind the page, and the ways to draw them.
 *
 * To add a scene:
 *   1. Pick one at https://www.ascii-magic.com/ascii (the name in its URL is the slug).
 *   2. Copy node_modules/ascii-magic-art/pieces/<slug>.js into vendor/ascii-magic-art/pieces/.
 *   3. Add a line below.
 *
 * accent  colours the links, the cursor and the hover states while the scene is up.
 * focus   is the point of the picture to keep in view when the window is narrower or
 *         shorter than the scene: how far across and how far down, from 0 to 1
 *         ([0.5, 1] is bottom centre).
 */
export const SCENES = [
  { slug: "aurora-cabin-snowfall", name: "Aurora Cabin Snowfall", accent: "#86e3b4", focus: [0.3, 1] },
  { slug: "desert-camp-milky-way", name: "Desert Camp Milky Way", accent: "#f0b97a", focus: [0.5, 1] },
  { slug: "cliff-lighthouse-night", name: "Cliff Lighthouse Night", accent: "#f2d58a", focus: [0.8, 1] },
  { slug: "harbour-neon-skyline", name: "Neon Harbour Ferry", accent: "#f08fc0", focus: [0.4, 1] },
  { slug: "orbit-window-earth", name: "Orbit Window Earth", accent: "#8cc8f5", focus: [0.45, 0.6] },
  { slug: "white-salt-desert-moon", name: "White Salt Desert Moon", accent: "#b9c7f2", focus: [0.6, 1] },
  { slug: "moonlit-mausoleum", name: "Moonlit Mausoleum", accent: "#a9c4ee", focus: [0.5, 1] },
  { slug: "river-lantern-festival", name: "River Lantern Festival", accent: "#f5b06a", focus: [0.5, 1] },
  { slug: "riverfront-tower-night", name: "Riverfront Tower Night", accent: "#d79bf0", focus: [0.3, 1] },
  { slug: "fuji-dawn-lake", name: "Fuji Dawn Lake", accent: "#f4a6b4", focus: [0.5, 1] },
  { slug: "summit-cloud-sea", name: "Summit Above Clouds", accent: "#f6b0a0", focus: [0.5, 1] },
];

/*
 * key   is what gets remembered between visits (and what ?look= accepts).
 * id    is the library's name for the character set.
 * cell  merges cell x cell squares of the picture into one character: 1 is the
 *       scene's full 192 x 108 grid, 2 is 96 x 54 with characters twice the size.
 *       The dot and square looks are drawn as shapes, so they always use 1.
 */
export const LOOKS = [
  { key: "ascii", id: "ascii", name: "ASCII", cell: 1 },
  { key: "dense", id: "dense", name: "Dense ASCII", cell: 1 },
  { key: "big", id: "ascii", name: "Big ASCII", cell: 2 },
  { key: "letters", id: "letters", name: "Letters", cell: 1 },
  { key: "binary", id: "binary", name: "Binary", cell: 1 },
  { key: "blocks", id: "blocks", name: "Blocks", cell: 1 },
  { key: "dots", id: "dots", name: "Halftone dots", cell: 1 },
];
