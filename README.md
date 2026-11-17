# hongyyu.github.io

My personal site: a profile page under an animated ASCII scene, with small isometric drawings for the projects and a pixel cat at the foot. Plain HTML, CSS and JavaScript, with no build step, served by GitHub Pages.

**[hongyyu.github.io](https://hongyyu.github.io/)**

## Run it locally

The scripts are ES modules, so the page needs a web server (opening `index.html` from disk will not load them).

```sh
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Change the content

Everything you read on the page is in [`index.html`](index.html): the intro, the buttons, the experience, the projects, the education and the skills. Edit it directly. There is a commented-out example of an email button next to the existing ones.

A project card whose name is a link opens that link. A name in a plain `<span>` leaves the card closed, which suits work with no public page.

## The scene

A band across the top of the page plays a piece from [ASCII Magic](https://www.ascii-magic.com/ascii), an open-source library of animated ASCII art. The bar under it switches the scene, switches the look (ASCII, letters, blocks, halftone dots and so on), pauses everything that moves, and opens the scene up to the whole window.

The band's height is `--band` at the top of [`assets/css/site.css`](assets/css/site.css).

To add a scene, copy its file into `vendor/ascii-magic-art/pieces/` (the [vendor notes](vendor/ascii-magic-art/README.md) show how) and add a line to `scenes.js`.

A link can open a particular scene and look: `/?scene=fuji-dawn-lake&look=dots`.

## The project figures

Each project card has a small looping drawing of a machine on a base plate: floor plates dropping onto two towers, requests riding tracks through a hub, a speaker with a row of bars for its voice. They are isometric line drawings made in code in [`assets/js/figures.js`](assets/js/figures.js): a scene is a list of boxes and cylinders for a given moment, sorted back to front and drawn as SVG. A card picks its drawing with `data-figure`.

With an odd number of cards, the first takes a full row.

## Sound

Sweeping the mouse across the skills ticks each one like a key, and links and buttons click. The sounds are made on the spot with Web Audio in [`assets/js/sound.js`](assets/js/sound.js); there are no sound files. Browsers only allow sound after the first click or key press, so hovering is silent until then. The speaker button in the bar turns sound off, and the choice is remembered.

## The cat

At the foot of the page a dark pixel cat sleeps across from a ball of yarn. Click the strip to drop the yarn, drag the yarn to throw it, and the cat chases it and bats it back. Move the pointer along the cat to pet it. With the keyboard, Tab to the cat or the yarn and press Enter.

The art is rows of characters, one per pixel, at the top of [`assets/js/yard.js`](assets/js/yard.js); change a row and the drawing changes. The count of pets is kept in the visitor's own browser, since the site has no server to hold a total.

## Files

| File | What it does |
| --- | --- |
| [`assets/js/scenes.js`](assets/js/scenes.js) | The list of scenes and looks. The first of each is the default. |
| [`assets/js/renderer.js`](assets/js/renderer.js) | Draws a scene on a canvas that covers the band, repainting only the characters that change. |
| [`assets/js/figures.js`](assets/js/figures.js) | The isometric drawings in the project cards, and the scramble on a card's name. |
| [`assets/js/sound.js`](assets/js/sound.js) | The interface sounds and the speaker button. |
| [`assets/js/yard.js`](assets/js/yard.js) | The cat and the yarn: the pixel art, the physics and what the cat does. |
| [`assets/js/main.js`](assets/js/main.js) | Loads scenes, runs the clock and wires up the bar. |
| [`vendor/ascii-magic-art/`](vendor/ascii-magic-art/) | The parts of the library this site uses, copied in so nothing loads from another site. |

Visitors who ask their system for reduced motion get still frames until they press play.

## Credits

- Scenes and drawing code: [ascii-magic-art](https://github.com/kailashsr38/ascii-magic-art), MIT License.
- The layout, the project figures, the key sounds and the cat with its yarn take after [glyph](https://github.com/franvy/glyph) by Franvy. No code or art is copied from it: the cat here is its own drawing.
