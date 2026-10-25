# Powder Lab

A falling-sand physics sandbox built for CrazyGames. Pure HTML5 + vanilla JS: no build step, no dependencies, and no audio or image files (every sound is synthesized).

Open `index.html` through any static server (for example `python3 -m http.server`) to play.

## What's in it

- **72 elements** in 8 categories: powders, liquids, gases, solids, life, energy, explosives and special.
- **Real systems, not just colors.** Heat spreads between cells, and materials melt, boil, freeze and condense. Burning spreads through the heat model, electricity travels along metal and water, explosions throw debris around as physics particles, and lightning, lasers, fireworks, black holes, cloners, viruses and fish each have their own behaviour.
- **Emergent chains.** Burning wood can leave coal, burning coal can melt stone into lava, lava meeting water turns into obsidian, and glass shattered by an explosion becomes glitter.
- **Progression loop.** Creating an element in the sandbox for the first time *discovers* it. Discoveries and missions give XP, and leveling up unlocks bigger toys (TNT, lasers, black holes, a nuke). Missions rotate and scale with your level, and they start with a short tutorial chain.
- **Juice.** A bloom/glow layer, things glowing when hot, screen shake, a flash for big blasts, blast popups ("KABOOM!"), a combo meter with bonus XP, toasts, a confetti level-up screen and a soft generative soundtrack.
- **Tools.** Circle, square, line and spray brushes. Mix, heat and cool tools. Select with copy, cut, fill, delete and stamp. Zoom and pan, an eyedropper, undo, ambient temperature, simulation speed (up to 4x) and four canvas sizes. Saving and loading creations, and the canvas autosaves.
- **Responsive.** Desktop has a three-panel layout. Phones (portrait and landscape) get a compact toolbar and a horizontally scrolling palette. Touch works through pointer events.
- **Performance.** Typed-array simulation (about 2.5 ms per tick for 42k cells), bloom done in JS on downsampled buffers, and the glow switches off automatically on slow devices.

## Controls

| Input | Action |
| --- | --- |
| Left click / touch | Draw |
| Right click | Erase |
| Middle click / `P` | Pick the element under the cursor |
| Scroll, `[` `]` | Brush size |
| Ctrl + scroll | Zoom (drag with the Zoom tool to pan) |
| `Space` | Pause |
| Ctrl + `Z` | Undo |
| `1`-`4` | Circle / Square / Line / Spray |
| `M` `H` `C` | Mix / Heat / Cool tools |
| `E` | Eraser |

## CrazyGames integration (`js/platform.js`)

- Loads SDK v3 (`https://sdk.crazygames.com/crazygames-sdk-v3.js`) and calls `SDK.init()`.
- Calls `loadingStart` / `loadingStop` around boot.
- Calls `gameplayStart` on the first interaction and `gameplayStop` while menus or modals are open.
- Calls `happytime()` on discoveries and level-ups.
- **Midgame ad** on *Clear canvas*, at most once every 3 minutes. Audio is muted while the ad plays.
- **Rewarded ad**: "Unlock now" on a locked element's card.
- Progress and the canvas are saved through `SDK.data` on CrazyGames, or `localStorage` when the game runs standalone.
- Every SDK call is wrapped, so the game runs offline or off-platform with no changes.

To submit, zip the folder contents (`index.html`, `css/`, `js/`, `assets/`) and upload the zip.

## Project layout

```
index.html
css/style.css
js/elements.js   element definitions + lookup tables
js/sim.js        simulation (movement, heat, reactions, electricity, explosions, particles)
js/render.js     ImageData renderer + bloom
js/audio.js      synthesized SFX + generative music
js/platform.js   CrazyGames SDK wrapper / storage
js/progress.js   XP, levels, discoveries, missions
js/icons.js      inline SVG icons
js/ui.js         panels, palette, input, camera, modals, toasts
js/main.js       boot, starter scene, main loop
assets/fonts/    Silkscreen + Pixelify Sans (SIL Open Font License)
```

## Credits

Fonts: [Silkscreen](https://fonts.google.com/specimen/Silkscreen) by Jason Kottke and [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans) by Stefie Justprince, both under the SIL Open Font License 1.1.
