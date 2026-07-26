# 🏠 Remodel Studio — 2D Floor Plan Designer

A browser-based 2D floor plan designer inspired by "before/after" home-remodel apps:
draw your apartment as a classic **blueprint**, then flip the switch and see it as a
furnished, **rendered** top-down view — or drag a divider to compare both at once.

## Features

- **Three view modes**
  - **Blueprint** — white line-work on dark, like a hand-drawn architectural plan
  - **Rendered** — furnished top-down render with wood floors, tiles and soft shadows
  - **Compare** — split screen with a draggable before/after divider
- **Room editor** — add rooms, rename them, and pick a floor material from live-rendered
  swatches (light oak, dark oak, herringbone, aqua tile, marble, stone, concrete);
  room area is computed and shown automatically
- **Furniture materials** — recolor upholstered pieces (sofas, beds, rugs, chairs) with
  fabric swatches and wooden pieces (tables, wardrobes, shelves) with wood tones
- **25+ furniture pieces** — sofas, beds, wardrobes, kitchen counters, appliances,
  bathroom fixtures, doors, windows, and more, each drawn in both styles
- **Full editing** — drag to move, rotate (R or the ⟳ button), resize, duplicate, delete,
  arrow-key nudging, snap-to-grid
- **Demo apartment** — a preloaded one-bedroom apartment to explore
- **Autosave** — your plan is saved to `localStorage` as you work
- **Export** — download the current view as a PNG

## Running

No build step and no dependencies — it's plain HTML/CSS/JS:

```bash
# open directly
open index.html

# or serve it
python3 -m http.server 8000
# then visit http://localhost:8000
```

It also works out of the box on GitHub Pages.

## Controls

| Action | How |
| --- | --- |
| Add furniture / room | Click an item in the left palette |
| Move | Drag it on the canvas |
| Rotate | Select, then press `R` (or use the properties panel) |
| Resize / rename | Select, then edit in the properties panel |
| Delete | Select, then press `Delete` |
| Nudge | Arrow keys (`Shift` for fine 1 cm steps) |
| Zoom / pan | Mouse wheel / drag empty space |
| Compare | Drag the white divider in Compare view |

## Project structure

```
index.html      — page layout (toolbar, palette, canvas, properties panel)
css/style.css   — dark UI theme
js/app.js       — canvas engine, furniture catalog, interactions, demo plan
```
