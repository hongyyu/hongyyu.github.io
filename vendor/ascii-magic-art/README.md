# ascii-magic-art (vendored)

Unmodified files from [ascii-magic-art](https://github.com/kailashsr38/ascii-magic-art) 1.1.0,
the open-source animated ASCII art library behind <https://www.ascii-magic.com/ascii>.
MIT licensed; see [LICENSE](LICENSE).

Only what this site uses is here:

- `runtime/glyphs.js` and `runtime/canvas.js`: the character sets and the painters.
- `lib/kit.js` and `lib/scene.js`: the toolkit the pieces are built with.
- `pieces/`: the scenes listed in `assets/js/scenes.js`.

The library's own player and `<ascii-art>` element are left out. `assets/js/renderer.js`
draws the pieces instead, so that only the characters that change are repainted.

To add a scene, copy its file from the package into `pieces/`:

```sh
npm pack ascii-magic-art@1.1.0
tar -xzf ascii-magic-art-1.1.0.tgz package/pieces/<slug>.js
mv package/pieces/<slug>.js vendor/ascii-magic-art/pieces/
```

Two pieces in the package, `ocean-sunset` and `starry-ridge`, are based on Unsplash
photographs and carry the Unsplash License instead of MIT. Neither is included here.
