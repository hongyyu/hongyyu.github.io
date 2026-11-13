# hongyyu.github.io

My personal site: a profile page over an animated ASCII scene. Plain HTML, CSS and JavaScript, with no build step, served by GitHub Pages.

**[hongyyu.github.io](https://hongyyu.github.io/)**

## Run it locally

The scripts are ES modules, so the page needs a web server (opening `index.html` from disk will not load them).

```sh
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Change the content

Everything you read on the page is in [`index.html`](index.html): the intro, the buttons, the projects, the path and the skills. Edit it directly. There are commented-out examples for an email and a LinkedIn button next to the existing ones.

## The scene

The background is a piece from [ASCII Magic](https://www.ascii-magic.com/ascii), an open-source library of animated ASCII art. The bar above the page switches the scene, switches the look (ASCII, letters, blocks, halftone dots and so on), pauses it, and hides the page so the scene can be seen on its own.

| File | What it does |
| --- | --- |
| [`assets/js/scenes.js`](assets/js/scenes.js) | The list of scenes and looks. The first of each is the default. |
| [`assets/js/renderer.js`](assets/js/renderer.js) | Draws a scene on a canvas that covers the window, repainting only the characters that change. |
| [`assets/js/main.js`](assets/js/main.js) | Loads scenes, runs the clock and wires up the buttons. |
| [`vendor/ascii-magic-art/`](vendor/ascii-magic-art/) | The parts of the library this site uses, copied in so nothing loads from another site. |

To add a scene, copy its file into `vendor/ascii-magic-art/pieces/` (the [vendor notes](vendor/ascii-magic-art/README.md) show how) and add a line to `scenes.js`.

A link can open a particular scene and look: `/?scene=fuji-dawn-lake&look=dots`.

Visitors who ask their system for reduced motion get a still frame until they press play.

## Credits

- Scenes and drawing code: [ascii-magic-art](https://github.com/kailashsr38/ascii-magic-art), MIT License.
- The layout takes after [glyph](https://github.com/franvy/glyph) by Franvy.
