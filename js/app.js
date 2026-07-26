'use strict';

/* =========================================================================
   Remodel Studio — 2D floor plan designer
   Blueprint view  : white line-work on dark, like a hand-drawn plan
   Rendered view   : furnished top-down render with wood floors & tiles
   Compare view    : both at once, split by a draggable divider
   All coordinates are in centimetres; the view maps cm -> screen px.
   ========================================================================= */

const WALL = 14; // wall thickness, cm

/* Floor materials a room can be finished with */
const FLOOR_MATS = {
  wood:        { label: 'Light Oak' },
  oak:         { label: 'Dark Oak' },
  herringbone: { label: 'Herringbone' },
  tile:        { label: 'Aqua Tile' },
  marble:      { label: 'Marble' },
  stone:       { label: 'Stone' },
  concrete:    { label: 'Concrete' },
};

/* Material color options offered per furniture family */
const MAT_SWATCHES = {
  fabric: ['#b7a284', '#d6cdbc', '#a8a8a8', '#a3b08e', '#bf7d5e', '#6b7d94'],
  wood:   ['#b08d62', '#8a6f52', '#74573c', '#d9d2c4', '#4b453d'],
};

/* Catalog: default size (cm), palette category, draw order z, wall = sits on walls,
   mat/color = which material family the piece belongs to and its default color */
const TYPES = {
  door:        { label: 'Door',         w: 90,  h: 12, cat: 'Structure', z: 1, wall: true },
  opening:     { label: 'Opening',      w: 140, h: 12, cat: 'Structure', z: 1, wall: true },
  window:      { label: 'Window',       w: 140, h: 12, cat: 'Structure', z: 1, wall: true },
  sofa:        { label: 'Sofa',         w: 220, h: 95, cat: 'Living', z: 2, mat: 'fabric', color: '#b7a284' },
  armchair:    { label: 'Armchair',     w: 90,  h: 88, cat: 'Living', z: 2, mat: 'fabric', color: '#b7a284' },
  coffeeTable: { label: 'Coffee table', w: 110, h: 60, cat: 'Living', z: 3, mat: 'wood', color: '#b08d62' },
  tvstand:     { label: 'TV stand',     w: 160, h: 42, cat: 'Living', z: 2, mat: 'wood', color: '#8a6f52' },
  rug:         { label: 'Rug',          w: 230, h: 160, cat: 'Living', z: 1, mat: 'fabric', color: '#c3cfba' },
  plant:       { label: 'Plant',        w: 50,  h: 50, cat: 'Living', z: 3 },
  bookshelf:   { label: 'Bookshelf',    w: 120, h: 35, cat: 'Living', z: 2, mat: 'wood', color: '#8a6f52' },
  bedDouble:   { label: 'Double bed',   w: 180, h: 210, cat: 'Bedroom', z: 2, mat: 'fabric', color: '#d8ccb6' },
  bedSingle:   { label: 'Single bed',   w: 100, h: 200, cat: 'Bedroom', z: 2, mat: 'fabric', color: '#d8ccb6' },
  wardrobe:    { label: 'Wardrobe',     w: 180, h: 62, cat: 'Bedroom', z: 2, mat: 'wood', color: '#ab967b' },
  nightstand:  { label: 'Nightstand',   w: 46,  h: 40, cat: 'Bedroom', z: 2, mat: 'wood', color: '#b08d62' },
  desk:        { label: 'Desk',         w: 140, h: 60, cat: 'Bedroom', z: 2, mat: 'wood', color: '#b08d62' },
  counter:     { label: 'Counter',      w: 240, h: 62, cat: 'Kitchen & Dining', z: 2 },
  stove:       { label: 'Stove',        w: 62,  h: 62, cat: 'Kitchen & Dining', z: 3 },
  sinkK:       { label: 'Kitchen sink', w: 62,  h: 62, cat: 'Kitchen & Dining', z: 3 },
  fridge:      { label: 'Fridge',       w: 70,  h: 72, cat: 'Kitchen & Dining', z: 2 },
  diningTable: { label: 'Dining table', w: 160, h: 95, cat: 'Kitchen & Dining', z: 2, mat: 'wood', color: '#b08d62' },
  chair:       { label: 'Chair',        w: 46,  h: 48, cat: 'Kitchen & Dining', z: 2, mat: 'fabric', color: '#c4b291' },
  toilet:      { label: 'Toilet',       w: 42,  h: 66, cat: 'Bathroom', z: 2 },
  sinkB:       { label: 'Washbasin',    w: 56,  h: 46, cat: 'Bathroom', z: 2 },
  shower:      { label: 'Shower',       w: 95,  h: 95, cat: 'Bathroom', z: 1 },
  bathtub:     { label: 'Bathtub',      w: 170, h: 80, cat: 'Bathroom', z: 2 },
  washer:      { label: 'Washer',       w: 62,  h: 62, cat: 'Bathroom', z: 2 },
};

/* ---------- palettes ---------- */
const BP = { bg: '#14161c', floor: '#191c24', wall: '#e8ecf5', line: '#dfe6f2', label: '#aeb8cc', grid: 'rgba(160,175,205,0.07)' };
const RD = {
  bg: '#eae3d7', wallFill: '#faf7f0', wallEdge: '#9b9384',
  wood: '#d3b489',
  label: 'rgba(80,70,55,0.75)',
  fabric: '#b9a488', fabricLight: '#d0c2ac', fabricDark: '#a5906f',
  wood1: '#b08d62', wood2: '#8f7355',
  white: '#fafaf8', appliance: '#eceff1', metal: '#c7ccd1',
  green: '#7ba05b', greenDark: '#5d8144',
  glass: '#bcd8e6', textile: '#c9d3c2',
  outline: 'rgba(70,58,44,0.4)',
};

/* =========================================================================
   State
   ========================================================================= */
let state = { rooms: [], items: [], ref: null };  // ref = uploaded floor plan underlay
let refEl = null;                                 // decoded <img> for state.ref
let idSeq = 1;
const uid = () => 'e' + (idSeq++);

let viewMode = 'compare';           // blueprint | render | compare
let compareX = 0.5;                 // divider position, fraction of canvas width
let view = { x: -100, y: -100, scale: 0.8 }; // world cm of top-left, px per cm
let sel = null;                     // { kind: 'item'|'room', id }
let drag = null;                    // active pointer interaction

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let dpr = 1, cw = 0, ch = 0;

/* =========================================================================
   Helpers
   ========================================================================= */
const rad = d => d * Math.PI / 180;
const snap = v => Math.round(v / 5) * 5;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* deterministic pseudo-random in [0,1) — stable across frames, no flicker */
function rnd(a, b = 0) {
  const s = Math.sin(a * 127.1 + b * 311.7 + 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/* color mixing for material shading */
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
const tintC = (c, t) => mix(c, '#ffffff', t);
const darkC = (c, t) => mix(c, '#000000', t);

function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function getById(list, id) { return list.find(e => e.id === id); }
function selectedObj() {
  if (!sel) return null;
  return sel.kind === 'room' ? getById(state.rooms, sel.id) : getById(state.items, sel.id);
}

function planBounds() {
  let all = [];
  for (const r of state.rooms) all.push([r.x, r.y], [r.x + r.w, r.y + r.h]);
  for (const it of state.items) {
    const rx = Math.max(it.w, it.h) / 2;
    all.push([it.x - rx, it.y - rx], [it.x + rx, it.y + rx]);
  }
  if (!all.length) return { x: 0, y: 0, w: 600, h: 600 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of all) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/* =========================================================================
   Furniture drawing — every shape is drawn centred on the origin.
   'blueprint' = line-work, 'render' = realistic fills with gradients.
   ========================================================================= */
function drawItem(c, it, mode) {
  const bp = mode === 'blueprint';
  c.save();
  c.translate(it.x, it.y);
  c.rotate(rad(it.rot || 0));
  const w = it.w, h = it.h, hw = w / 2, hh = h / 2;
  const col = it.color || TYPES[it.type]?.color || '#b08d62';   // chosen material color

  if (bp) { c.strokeStyle = BP.line; c.lineWidth = 2.2; c.fillStyle = 'transparent'; }
  else { c.strokeStyle = RD.outline; c.lineWidth = 1.6; }

  // linear gradient helper (only meaningful in rendered mode)
  const lg = (x0, y0, x1, y1, c0, c1) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    return g;
  };

  // Soft contact shadow under solid furniture in rendered mode
  const shadow = on => {
    if (!bp && on) { c.shadowColor = 'rgba(50,40,25,0.3)'; c.shadowBlur = 12; c.shadowOffsetY = 4; }
    else { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0; }
  };
  const paint = fill => { if (bp) c.stroke(); else { c.fillStyle = fill; c.fill(); shadow(false); c.stroke(); } };

  switch (it.type) {
    case 'sofa': {
      shadow(true); rr(c, -hw, -hh, w, h, 16); paint(lg(0, -hh, 0, hh, tintC(col, 0.12), darkC(col, 0.1)));
      rr(c, -hw + 4, -hh + 4, w - 8, 24, 10); paint(lg(0, -hh + 4, 0, -hh + 28, darkC(col, 0.28), darkC(col, 0.12))); // back rest
      rr(c, -hw + 4, -hh + 4, 19, h - 8, 9); paint(lg(-hw + 4, 0, -hw + 23, 0, darkC(col, 0.22), darkC(col, 0.05))); // arms
      rr(c, hw - 23, -hh + 4, 19, h - 8, 9); paint(lg(hw - 23, 0, hw - 4, 0, darkC(col, 0.05), darkC(col, 0.22)));
      const sw = (w - 54) / 2;
      rr(c, -hw + 25, -hh + 30, sw, h - 36, 9); paint(lg(0, -hh + 30, 0, hh - 6, tintC(col, 0.38), tintC(col, 0.12))); // seat cushions
      rr(c, -hw + 29 + sw, -hh + 30, sw, h - 36, 9); paint(lg(0, -hh + 30, 0, hh - 6, tintC(col, 0.38), tintC(col, 0.12)));
      if (!bp) { // back pillows, slightly tilted
        c.save(); c.translate(-w * 0.22, -hh + 20); c.rotate(-0.06); rr(c, -26, -11, 52, 22, 9); paint(tintC(col, 0.5)); c.restore();
        c.save(); c.translate(w * 0.22, -hh + 20); c.rotate(0.07); rr(c, -26, -11, 52, 22, 9); paint(darkC(col, 0.08)); c.restore();
      }
      break;
    }
    case 'armchair': {
      shadow(true); rr(c, -hw, -hh, w, h, 15); paint(lg(0, -hh, 0, hh, tintC(col, 0.12), darkC(col, 0.1)));
      rr(c, -hw + 4, -hh + 4, w - 8, 19, 8); paint(lg(0, -hh + 4, 0, -hh + 23, darkC(col, 0.28), darkC(col, 0.12)));
      rr(c, -hw + 4, -hh + 4, 15, h - 8, 8); paint(darkC(col, 0.18));
      rr(c, hw - 19, -hh + 4, 15, h - 8, 8); paint(darkC(col, 0.18));
      rr(c, -hw + 20, -hh + 24, w - 40, h - 30, 8); paint(lg(0, -hh + 24, 0, hh - 6, tintC(col, 0.4), tintC(col, 0.15)));
      if (!bp) { c.save(); c.rotate(0.15); rr(c, -19, -14, 38, 30, 8); paint(darkC(col, 0.12)); c.restore(); }        // throw pillow
      break;
    }
    case 'coffeeTable': {
      shadow(true); rr(c, -hw, -hh, w, h, 12); paint(lg(-hw, -hh, hw, hh, tintC(col, 0.06), darkC(col, 0.14)));
      if (bp) { rr(c, -hw + 7, -hh + 7, w - 14, h - 14, 8); c.stroke(); break; }
      c.strokeStyle = 'rgba(70,45,20,0.18)'; c.beginPath();                                              // wood grain
      for (let i = 1; i < 4; i++) { const y = -hh + h * i / 4; c.moveTo(-hw + 8, y); c.lineTo(hw - 8, y); }
      c.stroke(); c.strokeStyle = RD.outline;
      rr(c, -hw + 14, -13, 34, 26, 3); paint('#ddd3c0');                                                 // stacked books
      rr(c, -hw + 17, -10, 34, 26, 3); paint('#b0674f');
      c.beginPath(); c.arc(hw - 26, 0, 9, 0, 7); paint('#f2ede2');                                       // coffee cup
      c.beginPath(); c.arc(hw - 26, 0, 4.5, 0, 7); paint('#6b4a35');
      break;
    }
    case 'tvstand': {
      shadow(true); rr(c, -hw, -hh, w, h, 6); paint(lg(0, -hh, 0, hh, tintC(col, 0.08), darkC(col, 0.12)));
      if (!bp) {
        c.beginPath(); c.moveTo(-w / 6, -hh + 3); c.lineTo(-w / 6, hh - 3);                              // door seams
        c.moveTo(w / 6, -hh + 3); c.lineTo(w / 6, hh - 3); c.stroke();
      }
      rr(c, -hw + 14, -hh - 5, w - 28, 9, 2); paint(lg(-hw, 0, hw, 0, '#3a3e45', '#181a1e'));            // TV panel
      if (!bp) {
        c.beginPath(); c.moveTo(-hw + 18, -hh - 3); c.lineTo(-hw + 44, -hh - 3);                         // screen glint
        c.strokeStyle = 'rgba(255,255,255,0.35)'; c.stroke(); c.strokeStyle = RD.outline;
      }
      break;
    }
    case 'rug': {
      c.setLineDash(bp ? [9, 7] : []);
      rr(c, -hw, -hh, w, h, 20); paint(lg(-hw, -hh, hw, hh, tintC(col, 0.08), darkC(col, 0.08)));
      c.setLineDash([]);
      if (bp) break;
      rr(c, -hw + 9, -hh + 9, w - 18, h - 18, 14);
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 3; c.stroke();                             // border band
      c.save();
      rr(c, -hw + 14, -hh + 14, w - 28, h - 28, 10); c.clip();
      c.lineWidth = 1.2; c.strokeStyle = darkC(col, 0.45); c.globalAlpha = 0.25; c.beginPath();          // woven lattice
      for (let x = -hw - h; x < hw; x += 22) { c.moveTo(x, -hh); c.lineTo(x + h, hh); }
      c.stroke(); c.globalAlpha = 1;
      c.restore();
      c.lineWidth = 1.6; c.strokeStyle = RD.outline;
      break;
    }
    case 'plant': {
      const r = Math.min(hw, hh);
      if (bp) {
        c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke();
        c.beginPath(); c.arc(0, 0, r * 0.55, 0, 7); c.stroke();
        break;
      }
      shadow(true); c.beginPath(); c.arc(0, 0, r * 0.8, 0, 7); paint('#a56b4c');                         // terracotta pot
      c.beginPath(); c.arc(0, 0, r * 0.66, 0, 7); paint('#8a5137');
      for (let i = 0; i < 9; i++) {                                                                      // leaves
        const a = i * 0.698 + rnd(i, it.x) * 0.5;
        const lr = r * (0.55 + rnd(i, 9) * 0.45);
        c.save(); c.rotate(a); c.translate(lr * 0.55, 0);
        c.beginPath(); c.ellipse(0, 0, lr * 0.62, lr * 0.24, 0, 0, 7);
        c.fillStyle = `hsl(${95 + rnd(i, 2) * 30}, 34%, ${28 + rnd(i, 5) * 16}%)`; c.fill();
        c.restore();
      }
      c.beginPath(); c.arc(r * 0.15, -r * 0.15, r * 0.2, 0, 7);
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.fill();                                                  // top light
      break;
    }
    case 'bookshelf': {
      shadow(true); rr(c, -hw, -hh, w, h, 4); paint(lg(0, -hh, 0, hh, tintC(col, 0.08), darkC(col, 0.14)));
      c.beginPath();
      for (let i = 1; i < 4; i++) { const x = -hw + w * i / 4; c.moveTo(x, -hh + 3); c.lineTo(x, hh - 3); }
      c.stroke();
      break;
    }
    case 'bedDouble': case 'bedSingle': {
      shadow(true); rr(c, -hw, -hh, w, h, 10); paint(lg(0, -hh, 0, hh, '#c2a67f', '#a98c65'));           // frame
      rr(c, -hw + 6, -hh + 6, w - 12, h - 12, 8); paint('#f1ece1');                                      // mattress
      const single = it.type === 'bedSingle';
      const duvetY = -hh + 62;
      if (bp) {
        const pw = single ? w - 32 : (w - 36) / 2;
        rr(c, -hw + 14, -hh + 14, pw, 30, 8); c.stroke();
        if (!single) { rr(c, -hw + 22 + pw, -hh + 14, pw, 30, 8); c.stroke(); }
        rr(c, -hw + 6, duvetY, w - 12, hh - 6 - duvetY, 8); c.stroke();
        c.beginPath(); c.moveTo(-hw + 6, duvetY + 16); c.lineTo(hw - 6, duvetY + 16); c.stroke();
        break;
      }
      // duvet with a soft wavy top edge
      c.beginPath();
      c.moveTo(-hw + 6, duvetY + 6);
      c.bezierCurveTo(-w * 0.2, duvetY - 8, w * 0.05, duvetY + 16, hw - 6, duvetY + 2);
      c.lineTo(hw - 6, hh - 14); c.quadraticCurveTo(hw - 6, hh - 6, hw - 14, hh - 6);
      c.lineTo(-hw + 14, hh - 6); c.quadraticCurveTo(-hw + 6, hh - 6, -hw + 6, hh - 14);
      c.closePath();
      c.fillStyle = lg(0, duvetY, 0, hh, tintC(col, 0.4), col); c.fill(); c.stroke();
      c.strokeStyle = darkC(col, 0.5); c.globalAlpha = 0.35; c.beginPath();                              // fold crease
      c.moveTo(-hw + 12, duvetY + 26); c.bezierCurveTo(-w * 0.15, duvetY + 18, w * 0.1, duvetY + 34, hw - 12, duvetY + 24);
      c.stroke(); c.globalAlpha = 1; c.strokeStyle = RD.outline;
      const th = it.color ? darkC(col, 0.22) : '#b08060';                                                // throw blanket
      rr(c, -hw + 6, hh - 46, w - 12, 26, 6); paint(lg(0, hh - 46, 0, hh - 20, tintC(th, 0.08), darkC(th, 0.12)));
      const pw = single ? w - 40 : (w - 48) / 2;                                                         // pillows
      const px = single ? [-hw + 18] : [-hw + 18, -hw + 30 + pw];
      for (let i = 0; i < px.length; i++) {
        c.save(); c.translate(px[i] + pw / 2, -hh + 30); c.rotate(i === 0 ? -0.05 : 0.05);
        rr(c, -pw / 2, -15, pw, 30, 10);
        c.fillStyle = lg(0, -15, 0, 15, '#ffffff', '#e9e4d8'); c.fill(); c.stroke();
        c.restore();
      }
      break;
    }
    case 'wardrobe': {
      shadow(true); rr(c, -hw, -hh, w, h, 4); paint(lg(0, -hh, 0, hh, tintC(col, 0.08), darkC(col, 0.12)));
      c.beginPath(); c.moveTo(0, -hh + 4); c.lineTo(0, hh - 4); c.stroke();                              // door seam
      if (bp) {
        c.beginPath();
        for (let x = -hw + 20; x < hw - 12; x += 24) { c.moveTo(x, -8); c.lineTo(x, 8); }
        c.stroke();
      } else {
        c.fillStyle = darkC(col, 0.45);
        for (const dx of [-7, 7]) { c.beginPath(); c.arc(dx, 0, 2.5, 0, 7); c.fill(); }                  // handles
      }
      break;
    }
    case 'nightstand': {
      shadow(true); rr(c, -hw, -hh, w, h, 6); paint(lg(-hw, -hh, hw, hh, tintC(col, 0.05), darkC(col, 0.15)));
      if (bp) { c.beginPath(); c.arc(0, 0, 4, 0, 7); c.stroke(); break; }
      c.beginPath(); c.arc(0, 0, Math.min(hw, hh) * 0.55, 0, 7);
      c.fillStyle = 'rgba(255,244,200,0.5)'; c.fill();                                                   // lamp glow
      c.beginPath(); c.arc(0, 0, Math.min(hw, hh) * 0.3, 0, 7); paint('#e9dfc8');                        // lamp shade
      break;
    }
    case 'desk': {
      shadow(true); rr(c, -hw, -hh, w, h, 6); paint(lg(0, -hh, 0, hh, tintC(col, 0.05), darkC(col, 0.13)));
      rr(c, -hw + 12, -hh + 10, 42, h - 20, 4); paint('#d9d2c2');                                        // desk pad
      if (!bp) {
        rr(c, 8, -13, 40, 26, 3); paint(lg(8, 0, 48, 0, '#3c4046', '#23262b'));                          // laptop
        c.beginPath(); c.moveTo(28, -13); c.lineTo(28, 13);
        c.strokeStyle = 'rgba(255,255,255,0.2)'; c.stroke(); c.strokeStyle = RD.outline;
      }
      break;
    }
    case 'counter': {
      shadow(true); rr(c, -hw, -hh, w, h, 4); paint(lg(0, -hh, 0, hh, '#efe9db', '#ddd5c2'));
      if (!bp) {
        c.strokeStyle = 'rgba(140,130,110,0.35)'; c.lineWidth = 1;
        for (let i = 0; i < 4; i++) {                                                                    // marble veins
          const x0 = -hw + rnd(i, it.x) * w;
          c.beginPath(); c.moveTo(x0, -hh + 3);
          c.bezierCurveTo(x0 + 18, -hh + h * 0.35, x0 - 14, -hh + h * 0.65, x0 + 8, hh - 3);
          c.stroke();
        }
        c.lineWidth = 1.6; c.strokeStyle = RD.outline;
      }
      c.beginPath(); c.moveTo(-hw + 4, hh - 8); c.lineTo(hw - 4, hh - 8); c.stroke();
      break;
    }
    case 'stove': {
      rr(c, -hw, -hh, w, h, 5); paint(lg(-hw, -hh, hw, hh, '#3d4147', '#22252a'));
      const o = Math.min(hw, hh) * 0.42, br = Math.min(hw, hh) * 0.27;
      for (const [dx, dy] of [[-o, -o], [o, -o], [-o, o], [o, o]]) {
        c.beginPath(); c.arc(dx, dy, br, 0, 7);
        if (bp) { c.stroke(); continue; }
        c.fillStyle = '#17191c'; c.fill();
        c.strokeStyle = '#565b63'; c.stroke();
        c.beginPath(); c.arc(dx, dy, br * 0.45, 0, 7); c.stroke();
        c.strokeStyle = RD.outline;
      }
      break;
    }
    case 'sinkK': {
      rr(c, -hw, -hh, w, h, 4); paint(lg(0, -hh, 0, hh, '#efe9db', '#ddd5c2'));
      rr(c, -hw + 8, -hh + 13, w - 16, h - 21, 7); paint(lg(0, -hh + 13, 0, hh - 8, '#d3d8dc', '#aeb5bb'));
      if (!bp) {
        rr(c, -hw + 12, -hh + 17, w - 24, h - 29, 5);
        c.strokeStyle = 'rgba(0,0,0,0.15)'; c.stroke(); c.strokeStyle = RD.outline;                       // basin depth
      }
      c.beginPath(); c.arc(0, -hh + 7, 3.5, 0, 7); paint('#8f979e');                                      // faucet
      if (!bp) { c.beginPath(); c.moveTo(0, -hh + 7); c.lineTo(0, -hh + 16); c.stroke(); }
      break;
    }
    case 'fridge': {
      shadow(true); rr(c, -hw, -hh, w, h, 8); paint(lg(-hw, 0, hw, 0, '#e9edf0', '#c4cad0'));
      c.beginPath(); c.moveTo(0, -hh + 4); c.lineTo(0, hh - 4); c.stroke();
      if (!bp) {
        c.fillStyle = '#8b939b';
        rr(c, -9, -hh + 8, 4, 18, 2); c.fill();                                                          // handles
        rr(c, 5, -hh + 8, 4, 18, 2); c.fill();
      }
      break;
    }
    case 'diningTable': {
      shadow(true); rr(c, -hw, -hh, w, h, 14); paint(lg(-hw, -hh, hw, hh, tintC(col, 0.05), darkC(col, 0.15)));
      if (bp) { rr(c, -20, -12, 40, 24, 8); c.stroke(); break; }
      c.strokeStyle = 'rgba(70,45,20,0.15)'; c.beginPath();                                              // wood grain
      for (let i = 1; i < 5; i++) { const x = -hw + w * i / 5; c.moveTo(x, -hh + 6); c.lineTo(x, hh - 6); }
      c.stroke(); c.strokeStyle = RD.outline;
      rr(c, -hw + 10, -14, w - 20, 28, 6); paint('rgba(240,234,220,0.55)');                              // table runner
      c.beginPath(); c.arc(0, 0, 11, 0, 7); paint('#8a9a6b');                                            // centrepiece
      c.beginPath(); c.arc(-2, -2, 4, 0, 7); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill();
      break;
    }
    case 'chair': {
      shadow(true); rr(c, -hw, -hh + 10, w, h - 10, 9); paint(lg(0, -hh + 10, 0, hh, tintC(col, 0.25), col));
      rr(c, -hw, -hh, w, 12, 5); paint(lg(0, -hh, 0, -hh + 12, '#8a6f50', '#75593c'));
      break;
    }
    case 'toilet': {
      shadow(true); rr(c, -hw, -hh, w, 20, 5); paint(lg(0, -hh, 0, -hh + 20, '#ffffff', '#e4e6e6'));     // cistern
      if (!bp) { rr(c, -8, -hh + 6, 16, 7, 3); c.fillStyle = '#cfd4d6'; c.fill(); }                       // flush button
      c.beginPath(); c.ellipse(0, 9, hw - 3, hh - 15, 0, 0, 7); paint(lg(0, -8, 0, hh, '#ffffff', '#dfe3e4'));
      c.beginPath(); c.ellipse(0, 10, hw - 10, hh - 22, 0, 0, 7);
      if (bp) c.stroke(); else { c.fillStyle = '#eef1f2'; c.fill(); c.stroke(); }
      break;
    }
    case 'sinkB': {
      shadow(true); rr(c, -hw, -hh, w, h, 9); paint(lg(0, -hh, 0, hh, '#ffffff', '#e6e9e9'));
      c.beginPath(); c.ellipse(0, 3, hw - 9, hh - 12, 0, 0, 7);
      paint(bp ? 'transparent' : lg(0, -hh + 8, 0, hh - 6, '#e2e9ec', '#c5d0d5'));
      c.beginPath(); c.arc(0, -hh + 7, 3, 0, 7); paint('#8f979e');
      break;
    }
    case 'shower': {
      rr(c, -hw, -hh, w, h, 6);
      if (bp) {
        c.stroke();
        c.beginPath(); c.moveTo(-hw, -hh); c.lineTo(hw, hh); c.moveTo(hw, -hh); c.lineTo(-hw, hh); c.stroke();
        break;
      }
      c.fillStyle = '#d9ecec'; c.fill(); c.stroke();
      const ts = Math.min(w, h) / 6;                                                                     // mosaic floor
      for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
        c.fillStyle = `hsl(180, 26%, ${84 + (rnd(i, j + 20) - 0.5) * 6}%)`;
        c.fillRect(-hw + i * ts + 1, -hh + j * ts + 1, ts - 2, ts - 2);
      }
      c.beginPath(); c.arc(0, 0, 6, 0, 7); c.fillStyle = '#aeb6bc'; c.fill(); c.stroke();                // drain
      c.beginPath(); c.arc(0, 0, 2.5, 0, 7); c.fillStyle = '#7c848a'; c.fill();
      c.fillStyle = 'rgba(255,255,255,0.55)';                                                            // glass walls
      c.fillRect(-hw, hh - 5, w, 5); c.fillRect(hw - 5, -hh, 5, h);
      c.beginPath(); c.arc(-hw + 14, -hh + 14, 7, 0, 7); c.fillStyle = '#c3c9ce'; c.fill(); c.stroke();  // shower head
      break;
    }
    case 'bathtub': {
      shadow(true); rr(c, -hw, -hh, w, h, 20); paint(lg(0, -hh, 0, hh, '#ffffff', '#e3e7e8'));
      rr(c, -hw + 9, -hh + 9, w - 18, h - 18, 15);
      paint(bp ? 'transparent' : lg(0, -hh + 9, 0, hh - 9, '#e8eef0', '#ccd7db'));
      c.beginPath(); c.arc(-hw + 24, 0, 4, 0, 7); paint('#9aa0a6');                                      // faucet
      if (!bp) {
        c.fillStyle = '#b7bdc2';
        for (const dy of [-11, 11]) { c.beginPath(); c.arc(-hw + 24, dy, 2.5, 0, 7); c.fill(); }         // taps
      }
      break;
    }
    case 'washer': {
      shadow(true); rr(c, -hw, -hh, w, h, 6); paint(lg(0, -hh, 0, hh, '#f2f4f5', '#d8dcdf'));
      c.beginPath(); c.moveTo(-hw + 5, -hh + 10); c.lineTo(hw - 5, -hh + 10); c.stroke();                // control panel
      if (!bp) { c.beginPath(); c.arc(hw - 13, -hh + 5.5, 2.5, 0, 7); c.fillStyle = '#8b939b'; c.fill(); }
      const dr = Math.min(hw, hh) * 0.55;
      c.beginPath(); c.arc(0, 4, dr, 0, 7);
      paint(bp ? 'transparent' : lg(-dr, 4 - dr, dr, 4 + dr, '#c3ccd3', '#98a3ac'));                     // door ring
      c.beginPath(); c.arc(0, 4, dr * 0.6, 0, 7);
      paint(bp ? 'transparent' : lg(0, 4 - dr, 0, 4 + dr, '#5c666f', '#39424a'));                        // drum glass
      if (!bp) {
        c.beginPath(); c.arc(-dr * 0.25, 4 - dr * 0.25, dr * 0.2, 0, 7);
        c.fillStyle = 'rgba(255,255,255,0.4)'; c.fill();                                                 // glass glint
      }
      break;
    }
    /* -------- wall-mounted -------- */
    case 'door': {
      c.fillStyle = bp ? BP.bg : '#efe8da';
      c.fillRect(-hw, -WALL / 2 - 2, w, WALL + 4);                                                       // cut the wall
      if (bp) {
        c.beginPath(); c.moveTo(-hw, 0); c.lineTo(-hw, w); c.stroke();                                   // leaf
        c.beginPath(); c.arc(-hw, 0, w, 0, Math.PI / 2); c.stroke();                                     // swing
      } else {
        c.strokeStyle = 'rgba(70,58,44,0.3)';
        c.beginPath(); c.arc(-hw, 0, w, 0, Math.PI / 2); c.stroke();
        c.strokeStyle = RD.outline;
        rr(c, -hw - 2, 0, 5, w, 2); paint(lg(-hw - 2, 0, -hw + 3, 0, '#c2a273', '#a2825a'));             // leaf
      }
      break;
    }
    case 'opening': {
      c.fillStyle = bp ? BP.bg : '#efe8da';
      c.fillRect(-hw, -WALL / 2 - 2, w, WALL + 4);
      c.setLineDash([6, 6]);
      c.strokeStyle = bp ? 'rgba(223,230,242,0.45)' : 'rgba(70,58,44,0.25)';
      c.beginPath(); c.moveTo(-hw, 0); c.lineTo(hw, 0); c.stroke();
      c.setLineDash([]);
      break;
    }
    case 'window': {
      if (bp) {
        c.fillStyle = BP.bg; c.fillRect(-hw, -WALL / 2 - 1, w, WALL + 2);
        c.beginPath();
        for (const y of [-WALL / 2, 0, WALL / 2]) { c.moveTo(-hw, y); c.lineTo(hw, y); }
        c.stroke();
      } else {
        c.fillStyle = RD.wallFill; c.fillRect(-hw, -WALL / 2 - 1, w, WALL + 2);
        rr(c, -hw, -4, w, 8, 2);
        c.fillStyle = lg(0, -4, 0, 4, '#d8ecf5', '#a9cde0'); c.fill(); c.stroke();                       // glass
        c.beginPath(); c.moveTo(-hw, 0); c.lineTo(hw, 0);
        c.strokeStyle = 'rgba(255,255,255,0.7)'; c.stroke();
      }
      break;
    }
    default: {
      rr(c, -hw, -hh, w, h, 6); paint('#c9c2b4');
    }
  }
  c.restore();
}

/* =========================================================================
   Scene drawing
   ========================================================================= */
function drawFloor(c, room, mode) {
  const bp = mode === 'blueprint';
  if (bp) { c.fillStyle = BP.floor; c.fillRect(room.x, room.y, room.w, room.h); return; }

  c.save();
  c.beginPath(); c.rect(room.x, room.y, room.w, room.h); c.clip();

  const f = FLOOR_MATS[room.floor] ? room.floor : 'wood';
  if (f === 'tile') {
    c.fillStyle = '#b9d6d2'; c.fillRect(room.x, room.y, room.w, room.h);         // grout
    const s = 30;
    for (let y = room.y, j = 0; y < room.y + room.h; y += s, j++)
      for (let x = room.x, i = 0; x < room.x + room.w; x += s, i++) {
        c.fillStyle = `hsl(172, 28%, ${80 + (rnd(i, j) - 0.5) * 6}%)`;
        c.fillRect(x, y, s - 1.5, s - 1.5);
      }
  } else if (f === 'marble') {
    c.fillStyle = '#cfc9bd'; c.fillRect(room.x, room.y, room.w, room.h);         // grout
    const s = 60;
    for (let y = room.y, j = 0; y < room.y + room.h; y += s, j++)
      for (let x = room.x, i = 0; x < room.x + room.w; x += s, i++) {
        c.fillStyle = `hsl(40, 14%, ${88 + (rnd(i, j + 70) - 0.5) * 4}%)`;
        c.fillRect(x, y, s - 1.5, s - 1.5);
        if (rnd(i + 3, j + 11) > 0.5) {                                          // faint veins
          c.strokeStyle = 'rgba(125,118,105,0.3)'; c.lineWidth = 1;
          c.beginPath(); c.moveTo(x + rnd(i, j) * s, y + 2);
          c.bezierCurveTo(x + s * 0.6, y + s * 0.3, x + s * 0.2, y + s * 0.7, x + rnd(j, i) * s, y + s - 2);
          c.stroke();
        }
      }
  } else if (f === 'stone') {
    c.fillStyle = '#c8c0ae'; c.fillRect(room.x, room.y, room.w, room.h);
    const s = 45;
    for (let y = room.y, j = 0; y < room.y + room.h; y += s, j++)                // running-bond stone
      for (let x = room.x - (j % 2) * s / 2, i = 0; x < room.x + room.w; x += s, i++) {
        c.fillStyle = `hsl(40, 18%, ${82 + (rnd(i, j + 50) - 0.5) * 7}%)`;
        c.fillRect(x, y, s - 1.5, s - 1.5);
      }
  } else if (f === 'concrete') {
    c.fillStyle = '#b4afa6'; c.fillRect(room.x, room.y, room.w, room.h);
    const s = 70;
    for (let y = room.y, j = 0; y < room.y + room.h; y += s, j++)                // soft blotches
      for (let x = room.x, i = 0; x < room.x + room.w; x += s, i++) {
        c.fillStyle = `hsl(42, 7%, ${70 + (rnd(i, j + 33) - 0.5) * 5}%)`;
        c.fillRect(x, y, s, s);
      }
    c.strokeStyle = 'rgba(80,75,65,0.14)'; c.lineWidth = 1.2; c.beginPath();     // control joints
    for (let x = room.x + 140; x < room.x + room.w; x += 140) { c.moveTo(x, room.y); c.lineTo(x, room.y + room.h); }
    for (let y = room.y + 140; y < room.y + room.h; y += 140) { c.moveTo(room.x, y); c.lineTo(room.x + room.w, y); }
    c.stroke();
  } else if (f === 'herringbone') {
    c.fillStyle = '#9c7f57'; c.fillRect(room.x, room.y, room.w, room.h);
    const s = 34;
    for (let y = room.y - s, j = 0; y < room.y + room.h + s; y += s, j++)        // zigzag planks
      for (let x = room.x - s, i = 0; x < room.x + room.w + s; x += s, i++) {
        c.save();
        c.translate(x + s / 2, y + s / 2);
        c.rotate(((i + j) % 2 ? 45 : -45) * Math.PI / 180);
        c.fillStyle = `hsl(30, 40%, ${58 + (rnd(i, j + 5) - 0.5) * 12}%)`;
        c.fillRect(-s * 0.68, -s * 0.17, s * 1.36, s * 0.34);
        c.restore();
      }
  } else {
    const dark = f === 'oak';
    c.fillStyle = dark ? '#4a3826' : '#b6935f';                                  // plank gaps
    c.fillRect(room.x, room.y, room.w, room.h);
    const rh = 19;
    for (let y = room.y, j = 0; y < room.y + room.h; y += rh, j++) {             // staggered planks
      let x = room.x - rnd(j, 3) * 90, i = 0;
      while (x < room.x + room.w) {
        const len = 95 + rnd(i, j) * 70;
        c.fillStyle = dark
          ? `hsl(26, 38%, ${38 + (rnd(i + 7, j) - 0.5) * 10}%)`
          : `hsl(33, 42%, ${64 + (rnd(i + 7, j) - 0.5) * 12}%)`;
        c.fillRect(x + 1, y + 1, len - 2, rh - 2);
        x += len; i++;
      }
    }
  }

  // ambient occlusion where the floor meets the walls
  const ao = 26, col = 'rgba(90,65,35,0.18)', tr = 'rgba(90,65,35,0)';
  let g;
  g = c.createLinearGradient(room.x, 0, room.x + ao, 0);
  g.addColorStop(0, col); g.addColorStop(1, tr);
  c.fillStyle = g; c.fillRect(room.x, room.y, ao, room.h);
  g = c.createLinearGradient(room.x + room.w, 0, room.x + room.w - ao, 0);
  g.addColorStop(0, col); g.addColorStop(1, tr);
  c.fillStyle = g; c.fillRect(room.x + room.w - ao, room.y, ao, room.h);
  g = c.createLinearGradient(0, room.y, 0, room.y + ao);
  g.addColorStop(0, col); g.addColorStop(1, tr);
  c.fillStyle = g; c.fillRect(room.x, room.y, room.w, ao);
  g = c.createLinearGradient(0, room.y + room.h, 0, room.y + room.h - ao);
  g.addColorStop(0, col); g.addColorStop(1, tr);
  c.fillStyle = g; c.fillRect(room.x, room.y + room.h - ao, room.w, ao);

  c.restore();
}

function drawWalls(c, mode) {
  const bp = mode === 'blueprint';
  for (const r of state.rooms) {
    if (bp) {
      c.strokeStyle = BP.wall; c.lineWidth = WALL;
      c.strokeRect(r.x, r.y, r.w, r.h);
      c.strokeStyle = BP.bg; c.lineWidth = WALL - 7;                              // hollow double-line walls
      c.strokeRect(r.x, r.y, r.w, r.h);
    } else {
      c.save();
      c.shadowColor = 'rgba(60,45,25,0.45)'; c.shadowBlur = 14; c.shadowOffsetY = 4;
      c.strokeStyle = RD.wallEdge; c.lineWidth = WALL + 3;                        // walls cast onto the floor
      c.strokeRect(r.x, r.y, r.w, r.h);
      c.restore();
      c.strokeStyle = RD.wallFill; c.lineWidth = WALL;
      c.strokeRect(r.x, r.y, r.w, r.h);
    }
  }
}

function drawSunlight(c) {
  if (!state.rooms.length) return;
  c.save();
  c.beginPath();
  for (const r of state.rooms) c.rect(r.x, r.y, r.w, r.h);
  c.clip();
  for (const it of state.items) {
    if (it.type !== 'window') continue;
    const reach = it.w * 1.6;
    const g = c.createRadialGradient(it.x, it.y, 8, it.x, it.y, reach);
    g.addColorStop(0, 'rgba(255,250,225,0.5)');
    g.addColorStop(1, 'rgba(255,250,225,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(it.x, it.y, reach, 0, 7); c.fill();
  }
  c.restore();
}

function drawLabels(c, mode) {
  const bp = mode === 'blueprint';
  c.textAlign = 'center';
  for (const r of state.rooms) {
    if (!r.name) continue;
    const size = clamp(Math.min(r.w, r.h) * 0.11, 13, 24);
    c.fillStyle = bp ? BP.label : RD.label;
    c.font = `600 ${size}px "Segoe UI", system-ui, sans-serif`;
    c.fillText(r.name.toUpperCase(), r.x + r.w / 2, r.y + r.h / 2 - 25 - size * 0.2);
    c.font = `${size * 0.72}px "Segoe UI", system-ui, sans-serif`;
    c.globalAlpha = 0.75;
    c.fillText((r.w * r.h / 10000).toFixed(1) + ' m²', r.x + r.w / 2, r.y + r.h / 2 - 25 + size * 0.85);
    c.globalAlpha = 1;
  }
}

function drawGrid(c) {
  const step = 100;
  const x0 = Math.floor(view.x / step) * step, y0 = Math.floor(view.y / step) * step;
  const x1 = view.x + cw / view.scale, y1 = view.y + ch / view.scale;
  c.strokeStyle = BP.grid; c.lineWidth = 1 / view.scale;
  c.beginPath();
  for (let x = x0; x <= x1; x += step) { c.moveTo(x, view.y); c.lineTo(x, y1); }
  for (let y = y0; y <= y1; y += step) { c.moveTo(view.x, y); c.lineTo(x1, y); }
  c.stroke();
}

function drawWorld(c, mode) {
  if (mode === 'blueprint') drawGrid(c);
  for (const r of state.rooms) drawFloor(c, r, mode);
  if (mode === 'render') drawSunlight(c);
  drawWalls(c, mode);
  if (mode === 'blueprint' && state.ref && refEl && refEl.complete) {
    c.save();
    c.globalAlpha = state.ref.opacity;              // traceable underlay above floors, below furniture
    c.drawImage(refEl, state.ref.x, state.ref.y, state.ref.w, state.ref.w * refEl.height / refEl.width);
    c.restore();
  }
  const sorted = [...state.items].sort((a, b) => (TYPES[a.type]?.z ?? 2) - (TYPES[b.type]?.z ?? 2));
  for (const it of sorted) if (TYPES[it.type]?.wall) drawItem(c, it, mode);
  for (const it of sorted) if (!TYPES[it.type]?.wall) drawItem(c, it, mode);
  drawLabels(c, mode);
}

function drawPass(mode, px0, px1) {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.beginPath(); ctx.rect(px0, 0, px1 - px0, ch); ctx.clip();
  ctx.fillStyle = mode === 'blueprint' ? BP.bg : RD.bg;
  ctx.fillRect(px0, 0, px1 - px0, ch);
  ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, -view.x * view.scale * dpr, -view.y * view.scale * dpr);
  drawWorld(ctx, mode);
  if (mode === 'render') {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);                                       // soft vignette
    const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.8);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(75,55,30,0.16)');
    ctx.fillStyle = g;
    ctx.fillRect(px0, 0, px1 - px0, ch);
  }
  ctx.restore();
}

function drawSelection() {
  const o = selectedObj();
  if (!o) return;
  ctx.save();
  ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, -view.x * view.scale * dpr, -view.y * view.scale * dpr);
  ctx.strokeStyle = '#ff5a76';
  ctx.lineWidth = 2.5 / view.scale;
  ctx.setLineDash([8 / view.scale, 6 / view.scale]);
  if (sel.kind === 'room') {
    ctx.strokeRect(o.x - 4, o.y - 4, o.w + 8, o.h + 8);
  } else {
    ctx.translate(o.x, o.y); ctx.rotate(rad(o.rot || 0));
    ctx.strokeRect(-o.w / 2 - 6, -o.h / 2 - 6, o.w + 12, o.h + 12);
  }
  ctx.restore();
}

function drawDivider(px) {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, ch); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(px, ch / 2, 17, 0, 7);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.fillStyle = '#222';
  ctx.font = '700 13px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('⇔', px, ch / 2 + 1);
  // corner tags
  ctx.textBaseline = 'alphabetic';
  const tag = (text, x, align, dark) => {
    ctx.font = '700 12px "Segoe UI", sans-serif'; ctx.textAlign = align;
    ctx.fillStyle = dark ? 'rgba(20,22,28,0.55)' : 'rgba(255,255,255,0.6)';
    const w = ctx.measureText(text).width + 16;
    ctx.beginPath();
    rr(ctx, align === 'left' ? x - 8 : x - w + 8, 12, w, 24, 12); ctx.fill();
    ctx.fillStyle = dark ? '#fff' : '#333';
    ctx.fillText(text, x, 28);
  };
  if (px > 90) tag('BLUEPRINT', 16, 'left', true);
  if (cw - px > 90) tag('RENDERED', cw - 16, 'right', false);
  ctx.restore();
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (viewMode === 'compare') {
    const px = cw * compareX;
    drawPass('blueprint', 0, px);
    drawPass('render', px, cw);
    drawSelection();
    drawDivider(px);
  } else {
    drawPass(viewMode, 0, cw);
    drawSelection();
  }
}

let drawQueued = false;
function requestDraw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => { drawQueued = false; draw(); });
}

/* =========================================================================
   Coordinate transforms & hit testing
   ========================================================================= */
function toWorld(px, py) { return { x: view.x + px / view.scale, y: view.y + py / view.scale }; }

function hitItem(wx, wy) {
  const sorted = [...state.items].sort((a, b) => (TYPES[b.type]?.z ?? 2) - (TYPES[a.type]?.z ?? 2));
  for (const it of sorted) {
    const a = -rad(it.rot || 0);
    const dx = wx - it.x, dy = wy - it.y;
    const lx = dx * Math.cos(a) - dy * Math.sin(a);
    const ly = dx * Math.sin(a) + dy * Math.cos(a);
    const pad = 6 / view.scale + 4;
    if (Math.abs(lx) <= it.w / 2 + pad && Math.abs(ly) <= Math.max(it.h, WALL) / 2 + pad) return it;
  }
  return null;
}

function hitRoom(wx, wy) {
  for (let i = state.rooms.length - 1; i >= 0; i--) {
    const r = state.rooms[i];
    if (wx >= r.x - WALL && wx <= r.x + r.w + WALL && wy >= r.y - WALL && wy <= r.y + r.h + WALL) return r;
  }
  return null;
}

/* =========================================================================
   Pointer interaction
   ========================================================================= */
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  const px = e.offsetX, py = e.offsetY;
  const wpt = toWorld(px, py);

  if (viewMode === 'compare' && Math.abs(px - cw * compareX) < 14) {
    drag = { kind: 'divider' };
    return;
  }
  if (e.shiftKey && state.ref && viewMode !== 'render') {
    drag = { kind: 'ref', ox: wpt.x - state.ref.x, oy: wpt.y - state.ref.y, moved: false };
    return;
  }
  const it = hitItem(wpt.x, wpt.y);
  if (it) {
    sel = { kind: 'item', id: it.id };
    drag = { kind: 'item', id: it.id, ox: wpt.x - it.x, oy: wpt.y - it.y, moved: false };
    syncProps(); requestDraw();
    return;
  }
  const room = hitRoom(wpt.x, wpt.y);
  if (room) {
    sel = { kind: 'room', id: room.id };
    drag = { kind: 'room', id: room.id, ox: wpt.x - room.x, oy: wpt.y - room.y, moved: false };
    syncProps(); requestDraw();
    return;
  }
  sel = null; syncProps();
  drag = { kind: 'pan', sx: px, sy: py, vx: view.x, vy: view.y };
  requestDraw();
});

canvas.addEventListener('pointermove', e => {
  const px = e.offsetX, py = e.offsetY;
  if (!drag) {
    canvas.style.cursor =
      viewMode === 'compare' && Math.abs(px - cw * compareX) < 14 ? 'ew-resize' : 'default';
    return;
  }
  const wpt = toWorld(px, py);
  if (drag.kind === 'divider') {
    compareX = clamp(px / cw, 0.05, 0.95);
  } else if (drag.kind === 'pan') {
    view.x = drag.vx - (px - drag.sx) / view.scale;
    view.y = drag.vy - (py - drag.sy) / view.scale;
  } else if (drag.kind === 'item') {
    const it = getById(state.items, drag.id);
    if (it) { it.x = snap(wpt.x - drag.ox); it.y = snap(wpt.y - drag.oy); drag.moved = true; }
  } else if (drag.kind === 'room') {
    const r = getById(state.rooms, drag.id);
    if (r) { r.x = snap(wpt.x - drag.ox); r.y = snap(wpt.y - drag.oy); drag.moved = true; }
  } else if (drag.kind === 'ref') {
    if (state.ref) { state.ref.x = snap(wpt.x - drag.ox); state.ref.y = snap(wpt.y - drag.oy); drag.moved = true; }
  }
  requestDraw();
});

canvas.addEventListener('pointerup', () => {
  if (drag && drag.moved) saveState();
  if (drag && (drag.kind === 'item' || drag.kind === 'room')) syncProps();
  drag = null;
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = Math.exp(-e.deltaY * 0.0012);
  const ns = clamp(view.scale * factor, 0.12, 4);
  const wpt = toWorld(e.offsetX, e.offsetY);
  view.x = wpt.x - e.offsetX / ns;
  view.y = wpt.y - e.offsetY / ns;
  view.scale = ns;
  requestDraw();
}, { passive: false });

/* =========================================================================
   Keyboard
   ========================================================================= */
window.addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
  const o = selectedObj();
  if (e.key === 'Escape') { sel = null; syncProps(); requestDraw(); return; }
  if (!o) return;
  if (e.key === 'r' || e.key === 'R') {
    if (sel.kind === 'item') { o.rot = ((o.rot || 0) + 90) % 360; changed(); }
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelected();
  } else if (e.key.startsWith('Arrow')) {
    e.preventDefault();
    const d = e.shiftKey ? 1 : 5;
    if (e.key === 'ArrowLeft') o.x -= d;
    if (e.key === 'ArrowRight') o.x += d;
    if (e.key === 'ArrowUp') o.y -= d;
    if (e.key === 'ArrowDown') o.y += d;
    changed();
  }
});

function deleteSelected() {
  if (!sel) return;
  if (sel.kind === 'room') state.rooms = state.rooms.filter(r => r.id !== sel.id);
  else state.items = state.items.filter(i => i.id !== sel.id);
  sel = null;
  changed();
}

function changed() { syncProps(); saveState(); requestDraw(); }

/* =========================================================================
   Properties panel
   ========================================================================= */
const props = document.getElementById('props');
const propTitle = document.getElementById('propTitle');
const propName = document.getElementById('propName');
const propW = document.getElementById('propW');
const propH = document.getElementById('propH');
const propRot = document.getElementById('propRot');
const fieldName = document.getElementById('fieldName');
const fieldFloor = document.getElementById('fieldFloor');
const fieldColor = document.getElementById('fieldColor');
const fieldRot = document.getElementById('fieldRot');
const floorSwatches = document.getElementById('floorSwatches');
const colorSwatches = document.getElementById('colorSwatches');

/* floor material picker — each swatch is a live render of the material */
for (const [k, def] of Object.entries(FLOOR_MATS)) {
  const b = document.createElement('button');
  b.className = 'swatch'; b.title = def.label; b.dataset.mat = k;
  const cnv = document.createElement('canvas');
  cnv.width = 72; cnv.height = 54;
  const sc = cnv.getContext('2d');
  sc.scale(0.6, 0.6);
  drawFloor(sc, { x: 0, y: 0, w: 120, h: 90, floor: k }, 'render');
  b.appendChild(cnv);
  b.addEventListener('click', () => {
    const o = selectedObj();
    if (o && sel.kind === 'room') { o.floor = k; changed(); }
  });
  floorSwatches.appendChild(b);
}

/* furniture color picker — options depend on the piece's material family */
function buildColorSwatches(o, isRoom) {
  colorSwatches.innerHTML = '';
  const matKind = isRoom ? null : TYPES[o.type]?.mat;
  if (!matKind) { fieldColor.style.display = 'none'; return; }
  fieldColor.style.display = '';
  const cur = (o.color || TYPES[o.type].color).toLowerCase();
  for (const colr of MAT_SWATCHES[matKind]) {
    const b = document.createElement('button');
    b.className = 'swatch round';
    b.style.background = colr;
    b.title = matKind === 'wood' ? 'Wood tone' : 'Fabric color';
    if (colr.toLowerCase() === cur) b.classList.add('sel');
    b.addEventListener('click', () => { o.color = colr; changed(); });
    colorSwatches.appendChild(b);
  }
}

let syncing = false;
function syncProps() {
  const o = selectedObj();
  if (!o) { props.classList.add('hidden'); return; }
  syncing = true;
  props.classList.remove('hidden');
  const isRoom = sel.kind === 'room';
  propTitle.textContent = isRoom ? 'Room' : (TYPES[o.type]?.label || o.type);
  fieldName.style.display = isRoom ? '' : 'none';
  fieldFloor.style.display = isRoom ? '' : 'none';
  fieldRot.style.display = isRoom ? 'none' : '';
  if (isRoom) {
    propName.value = o.name || '';
    const cur = FLOOR_MATS[o.floor] ? o.floor : 'wood';
    for (const b of floorSwatches.children) b.classList.toggle('sel', b.dataset.mat === cur);
  } else {
    propRot.value = o.rot || 0;
  }
  buildColorSwatches(o, isRoom);
  propW.value = o.w; propH.value = o.h;
  syncing = false;
}

function applyProps() {
  if (syncing) return;
  const o = selectedObj();
  if (!o) return;
  o.w = clamp(+propW.value || o.w, 10, 3000);
  o.h = clamp(+propH.value || o.h, 10, 3000);
  if (sel.kind === 'room') {
    o.name = propName.value;
  } else {
    o.rot = ((+propRot.value || 0) % 360 + 360) % 360;
  }
  saveState(); requestDraw();
}
for (const el of [propName, propW, propH, propRot]) el.addEventListener('input', applyProps);

document.getElementById('btnRotate').addEventListener('click', () => {
  const o = selectedObj();
  if (o && sel.kind === 'item') { o.rot = ((o.rot || 0) + 90) % 360; changed(); }
});
document.getElementById('btnDelete').addEventListener('click', deleteSelected);
document.getElementById('btnDuplicate').addEventListener('click', () => {
  const o = selectedObj();
  if (!o) return;
  const copy = { ...o, id: uid(), x: o.x + 40, y: o.y + 40 };
  if (sel.kind === 'room') state.rooms.push(copy); else state.items.push(copy);
  sel = { kind: sel.kind, id: copy.id };
  changed();
});

/* =========================================================================
   Palette
   ========================================================================= */
function buildPalette() {
  const pal = document.getElementById('palette');
  pal.innerHTML = '';
  const cats = new Map();
  for (const [type, def] of Object.entries(TYPES)) {
    if (!cats.has(def.cat)) cats.set(def.cat, []);
    cats.get(def.cat).push(type);
  }
  for (const [cat, types] of cats) {
    const h = document.createElement('h3');
    h.textContent = cat;
    pal.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'pal-grid';
    if (cat === 'Structure') {
      grid.appendChild(makePaletteButton('room', 'Room', drawRoomThumb));
    }
    for (const t of types) {
      grid.appendChild(makePaletteButton(t, TYPES[t].label, tc => drawTypeThumb(tc, t)));
    }
    pal.appendChild(grid);
  }
}

function makePaletteButton(type, label, thumbFn) {
  const btn = document.createElement('button');
  btn.className = 'pal-item';
  const tc = document.createElement('canvas');
  tc.width = 100; tc.height = 64;
  tc.style.width = '50px'; tc.style.height = '32px';
  thumbFn(tc);
  btn.appendChild(tc);
  const span = document.createElement('span');
  span.textContent = label;
  btn.appendChild(span);
  btn.addEventListener('click', () => addFromPalette(type));
  return btn;
}

function drawTypeThumb(tc, type) {
  const c = tc.getContext('2d');
  const def = TYPES[type];
  c.fillStyle = '#f0ece3';
  c.fillRect(0, 0, tc.width, tc.height);
  const s = Math.min((tc.width - 22) / def.w, (tc.height - 14) / Math.max(def.h, def.wall ? 40 : def.h));
  c.translate(tc.width / 2, tc.height / 2);
  c.scale(s, s);
  drawItem(c, { type, x: 0, y: 0, rot: 0, w: def.w, h: def.h }, 'render');
}

function drawRoomThumb(tc) {
  const c = tc.getContext('2d');
  c.fillStyle = '#f0ece3';
  c.fillRect(0, 0, tc.width, tc.height);
  c.fillStyle = RD.wood;
  c.fillRect(24, 12, 52, 40);
  c.strokeStyle = RD.wallEdge; c.lineWidth = 7;
  c.strokeRect(24, 12, 52, 40);
  c.strokeStyle = RD.wallFill; c.lineWidth = 5;
  c.strokeRect(24, 12, 52, 40);
}

function addFromPalette(type) {
  const cx = snap(view.x + cw / view.scale / 2);
  const cy = snap(view.y + ch / view.scale / 2);
  if (type === 'room') {
    const room = { id: uid(), x: cx - 150, y: cy - 150, w: 300, h: 300, name: 'Room', floor: 'wood' };
    state.rooms.push(room);
    sel = { kind: 'room', id: room.id };
  } else {
    const def = TYPES[type];
    const it = { id: uid(), type, x: cx, y: cy, rot: 0, w: def.w, h: def.h };
    state.items.push(it);
    sel = { kind: 'item', id: it.id };
  }
  changed();
}

/* =========================================================================
   Toolbar
   ========================================================================= */
function setViewMode(mode) {
  viewMode = mode;
  for (const b of document.querySelectorAll('.view-switch button')) b.classList.toggle('active', b.dataset.mode === mode);
  requestDraw();
}
for (const btn of document.querySelectorAll('.view-switch button')) {
  btn.addEventListener('click', () => setViewMode(btn.dataset.mode));
}

/* ---------- reference image (uploaded floor plan to trace over) ---------- */
const refPanel = document.getElementById('refpanel');
const fileInput = document.getElementById('fileInput');

function setRefImage(src) {
  refEl = new Image();
  refEl.onload = requestDraw;
  refEl.src = src;
}

function syncRefPanel() {
  if (!state.ref) { refPanel.classList.add('hidden'); return; }
  refPanel.classList.remove('hidden');
  document.getElementById('refOpacity').value = Math.round(state.ref.opacity * 100);
  document.getElementById('refSize').value = state.ref.w;
}

function clearRefImage() {
  state.ref = null;
  refEl = null;
  syncRefPanel();
}

function handleImageFile(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      // downscale so the stored data URL fits comfortably in localStorage
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const cn = document.createElement('canvas');
      cn.width = Math.max(1, Math.round(img.width * k));
      cn.height = Math.max(1, Math.round(img.height * k));
      cn.getContext('2d').drawImage(img, 0, 0, cn.width, cn.height);
      const src = cn.toDataURL('image/jpeg', 0.82);
      const wcm = 900;                                       // initial width, resizable via slider
      const hcm = wcm * cn.height / cn.width;
      state.ref = {
        src, w: wcm, opacity: 0.6,
        x: snap(view.x + cw / view.scale / 2 - wcm / 2),
        y: snap(view.y + ch / view.scale / 2 - hcm / 2),
      };
      setRefImage(src);
      if (viewMode === 'render') setViewMode('blueprint');   // the underlay only shows in blueprint
      syncRefPanel(); saveState(); requestDraw();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files && fileInput.files[0];
  fileInput.value = '';
  handleImageFile(file);
});

// drag & drop an image anywhere onto the canvas
const canvasWrap = document.getElementById('canvas-wrap');
canvasWrap.addEventListener('dragover', e => { e.preventDefault(); canvasWrap.classList.add('dropping'); });
canvasWrap.addEventListener('dragleave', e => {
  if (!canvasWrap.contains(e.relatedTarget)) canvasWrap.classList.remove('dropping');
});
canvasWrap.addEventListener('drop', e => {
  e.preventDefault();
  canvasWrap.classList.remove('dropping');
  handleImageFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
});

// paste an image (Ctrl/Cmd+V) from the clipboard
window.addEventListener('paste', e => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type && item.type.startsWith('image/')) { handleImageFile(item.getAsFile()); break; }
  }
});

/* ---------- Auto-remodel: Claude analyzes the uploaded plan and builds the layout ---------- */
const API_KEY_STORE = 'remodel-studio-api-key';
const API_BASE_STORE = 'remodel-studio-api-base';
const API_AUTH_STORE = 'remodel-studio-api-auth';   // 'x-api-key' | 'bearer'
const DEFAULT_API_BASE = 'https://api.anthropic.com';
const autoStatus = document.getElementById('autoStatus');
const autoKeyRow = document.getElementById('autoKeyRow');
const btnAuto = document.getElementById('btnAuto');

function apiBase() {
  const stored = (localStorage.getItem(API_BASE_STORE) || '').trim();
  return (stored || DEFAULT_API_BASE).replace(/\/+$/, '');
}

/* Accepts a plain base (…/v1/messages appended), a base ending in /v1
   (only /messages appended), or a full endpoint ending in /messages (as-is) —
   so gateway URLs with their own path structure work unchanged. */
function apiEndpoint() {
  const base = apiBase();
  if (/\/messages$/i.test(base)) return base;
  if (/\/v\d+$/i.test(base)) return base + '/messages';
  return base + '/v1/messages';
}

function apiAuthStyle() {
  return localStorage.getItem(API_AUTH_STORE) === 'bearer' ? 'bearer' : 'x-api-key';
}

function setAutoStatus(msg, cls) {
  autoStatus.textContent = msg || '';
  autoStatus.className = cls || '';
}

function layoutSchema() {
  const num = { type: 'number' };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['rooms', 'items'],
    properties: {
      rooms: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['x', 'y', 'w', 'h', 'name', 'floor'],
          properties: {
            x: num, y: num, w: num, h: num,
            name: { type: 'string' },
            floor: { type: 'string', enum: Object.keys(FLOOR_MATS) },
          },
        },
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'x', 'y', 'rot', 'w', 'h'],
          properties: {
            type: { type: 'string', enum: Object.keys(TYPES) },
            x: num, y: num, rot: num, w: num, h: num,
          },
        },
      },
    },
  };
}

function layoutPrompt() {
  const catalog = Object.entries(TYPES)
    .map(([k, d]) => `${k} (${d.label}, default ${d.w}x${d.h}cm)`)
    .join('; ');
  return [
    'Analyze this 2D floor plan image and reconstruct it as structured layout data for a floor plan editor.',
    '',
    'Coordinate system: centimeters, origin at top-left, x grows right, y grows down. Estimate realistic dimensions from the image (a door is ~80-90cm wide; whole apartments are typically 500-1200cm per side).',
    '',
    'Rooms are rectangles with x,y at the top-left corner. They should tile the apartment with adjacent rooms sharing edges; walls are drawn automatically along each rectangle edge. Give each room a short name and a sensible floor material (tile or marble for bathrooms/kitchens, wood/oak/herringbone for living spaces).',
    '',
    'Items have x,y at their CENTER and rot in degrees clockwise (prefer 0, 90, 180, 270). At rot 0 an item faces down the +y axis with its back at -y (bed headboard, sofa back, chair back at the top edge).',
    'door, window, and opening items must be centered exactly ON a room edge line: rot 0 on horizontal walls, 90 on vertical walls. Include the entrance door, interior doors, and windows on exterior walls.',
    'Place every piece of furniture visible in the plan using the closest catalog type, sized via w/h to match the image. If the plan shows no furniture, furnish it sensibly based on the room labels.',
    '',
    `Item catalog: ${catalog}.`,
    `Floor materials: ${Object.entries(FLOOR_MATS).map(([k, d]) => `${k} (${d.label})`).join(', ')}.`,
  ].join('\n');
}

function applyLayout(layout) {
  const rooms = (layout.rooms || []).slice(0, 40).map(r => ({
    id: uid(),
    x: snap(+r.x || 0), y: snap(+r.y || 0),
    w: clamp(Math.round(+r.w || 300), 60, 3000),
    h: clamp(Math.round(+r.h || 300), 60, 3000),
    name: String(r.name || 'Room').slice(0, 24),
    floor: FLOOR_MATS[r.floor] ? r.floor : 'wood',
  }));
  const items = (layout.items || []).slice(0, 200).filter(it => TYPES[it.type]).map(it => ({
    id: uid(),
    type: it.type,
    x: snap(+it.x || 0), y: snap(+it.y || 0),
    rot: ((Math.round(+it.rot || 0) % 360) + 360) % 360,
    w: clamp(Math.round(+it.w || TYPES[it.type].w), 10, 3000),
    h: clamp(Math.round(+it.h || TYPES[it.type].h), 10, 3000),
  }));
  if (!rooms.length) throw new Error('No rooms were recognized in this image. Try a clearer floor plan.');
  state.rooms = rooms;
  state.items = items;
  if (state.ref) state.ref.opacity = 0.25;   // fade the underlay so the traced result reads clearly
  sel = null;
  syncProps(); syncRefPanel();
  setViewMode('compare');
  fitView();
  saveState(); requestDraw();
}

async function autoRemodel() {
  if (!state.ref) return;
  const key = (localStorage.getItem(API_KEY_STORE) || '').trim();
  const base = apiBase();
  // A key is required for the official API; a custom proxy may inject its own.
  if (!key && base === DEFAULT_API_BASE) {
    autoKeyRow.classList.remove('hidden');
    setAutoStatus('Enter your Claude API key (or a proxy base URL) to run Auto-remodel.');
    return;
  }
  btnAuto.disabled = true;
  setAutoStatus('Analyzing your floor plan with Claude… this can take a minute.');
  try {
    const headers = {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    if (key) {
      if (apiAuthStyle() === 'bearer') headers['authorization'] = 'Bearer ' + key;
      else headers['x-api-key'] = key;
    }
    const res = await fetch(apiEndpoint(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-opus-5',
        max_tokens: 16000,
        output_config: { format: { type: 'json_schema', schema: layoutSchema() } },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: state.ref.src.split(',')[1] } },
            { type: 'text', text: layoutPrompt() },
          ],
        }],
      }),
    });
    if (res.status === 401) {
      localStorage.removeItem(API_KEY_STORE);
      autoKeyRow.classList.remove('hidden');
      throw new Error('That API key was rejected — please enter it again.');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error((err && err.error && err.error.message) || `API error ${res.status}`);
    }
    const data = await res.json();
    if (data.stop_reason === 'refusal') {
      throw new Error('The model declined this request. Try a different floor plan image.');
    }
    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock || !textBlock.text) throw new Error('No layout was returned — please try again.');
    applyLayout(JSON.parse(textBlock.text));
    setAutoStatus('Done! Your plan is traced and rendered — drag the divider to compare.', 'ok');
  } catch (e) {
    if (e instanceof TypeError) {
      let host = 'the API endpoint';
      try { host = new URL(apiEndpoint()).host; } catch (_) { /* keep generic */ }
      setAutoStatus(
        `The browser blocked the request to ${host} before it was sent. Usual causes: ` +
        'an ad blocker or Brave Shields (allow this site and retry), a VPN or firewall, ' +
        'or a gateway that does not accept browser (CORS) requests. ' +
        'In the claude.ai preview all network access is blocked by design — use the public site instead.',
        'error');
    } else {
      setAutoStatus(e.message || 'Something went wrong — please try again.', 'error');
    }
  } finally {
    btnAuto.disabled = false;
  }
}

btnAuto.addEventListener('click', autoRemodel);
document.getElementById('autoSettings').addEventListener('click', e => {
  e.preventDefault();
  autoKeyRow.classList.toggle('hidden');
  if (!autoKeyRow.classList.contains('hidden')) {
    document.getElementById('autoKey').value = localStorage.getItem(API_KEY_STORE) || '';
    document.getElementById('autoBase').value = localStorage.getItem(API_BASE_STORE) || '';
    document.getElementById('autoAuth').value = apiAuthStyle();
  }
});
document.getElementById('autoKeySave').addEventListener('click', () => {
  const key = document.getElementById('autoKey').value.trim();
  const baseVal = document.getElementById('autoBase').value.trim().replace(/\/+$/, '');
  const auth = document.getElementById('autoAuth').value;
  if (baseVal && !/^https?:\/\//.test(baseVal)) {
    setAutoStatus('The base URL must start with https:// (or http:// for local proxies).', 'error');
    return;
  }
  try {
    if (key) localStorage.setItem(API_KEY_STORE, key); else localStorage.removeItem(API_KEY_STORE);
    if (baseVal) localStorage.setItem(API_BASE_STORE, baseVal); else localStorage.removeItem(API_BASE_STORE);
    localStorage.setItem(API_AUTH_STORE, auth);
  } catch (_) { /* private mode */ }
  autoKeyRow.classList.add('hidden');
  autoRemodel();
});

document.getElementById('refOpacity').addEventListener('input', e => {
  if (state.ref) { state.ref.opacity = +e.target.value / 100; saveState(); requestDraw(); }
});
document.getElementById('refSize').addEventListener('input', e => {
  if (state.ref) { state.ref.w = +e.target.value; saveState(); requestDraw(); }
});
document.getElementById('refRemove').addEventListener('click', () => {
  clearRefImage(); saveState(); requestDraw();
});

document.getElementById('btnFit').addEventListener('click', () => { fitView(); requestDraw(); });
document.getElementById('btnDemo').addEventListener('click', () => { loadDemo(); syncRefPanel(); fitView(); changed(); });
document.getElementById('btnClear').addEventListener('click', () => {
  if (state.rooms.length || state.items.length) {
    if (!confirm('Start a new empty plan? The current plan will be discarded.')) return;
  }
  state = { rooms: [], items: [], ref: null };
  refEl = null;
  sel = null;
  syncRefPanel();
  fitView();
  changed();
});

document.getElementById('btnExport').addEventListener('click', () => {
  draw(); // make sure the canvas is fresh
  const a = document.createElement('a');
  a.download = 'floor-plan.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
});

function fitView() {
  const b = planBounds();
  const margin = 80;
  const s = clamp(Math.min(cw / (b.w + margin * 2), ch / (b.h + margin * 2)), 0.12, 4);
  view.scale = s;
  view.x = b.x + b.w / 2 - cw / s / 2;
  view.y = b.y + b.h / 2 - ch / s / 2;
}

/* =========================================================================
   Persistence
   ========================================================================= */
const STORE_KEY = 'remodel-studio-plan-v1';
let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...state, idSeq })); } catch (_) { /* private mode */ }
  }, 250);
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.rooms) || !Array.isArray(data.items)) return false;
    state = { rooms: data.rooms, items: data.items, ref: data.ref || null };
    idSeq = data.idSeq || 1000;
    return true;
  } catch (_) { return false; }
}

/* =========================================================================
   Demo apartment — modelled on the before/after ad this app recreates
   ========================================================================= */
function loadDemo() {
  idSeq = 1;
  const R = (x, y, w, h, name, floor) => ({ id: uid(), x, y, w, h, name, floor });
  const I = (type, x, y, rot = 0, w, h) => ({ id: uid(), type, x, y, rot, w: w ?? TYPES[type].w, h: h ?? TYPES[type].h });

  state = {
    rooms: [
      R(0, 0, 360, 290, 'Bedroom', 'wood'),
      R(360, 0, 280, 230, 'Bathroom', 'tile'),
      R(0, 290, 380, 340, 'Living Room', 'herringbone'),
      R(380, 230, 260, 400, 'Kitchen', 'marble'),
      R(0, 630, 250, 330, 'Entry Hall', 'stone'),
      R(250, 630, 190, 330, 'Laundry', 'tile'),
      R(440, 630, 200, 330, 'Storage', 'concrete'),
    ],
    items: [
      // Bedroom
      I('bedDouble', 150, 135),
      I('nightstand', 42, 55),
      I('nightstand', 266, 55),
      I('wardrobe', 170, 254),
      I('plant', 325, 45),
      // Bathroom
      I('shower', 583, 66),
      I('toilet', 602, 170, 90),
      I('sinkB', 392, 140, 270),
      // Living room
      I('sofa', 70, 430, 270),
      { ...I('armchair', 160, 562, 320), color: '#bf7d5e' },
      I('coffeeTable', 195, 435, 90),
      I('rug', 210, 450, 90),
      I('tvstand', 352, 430, 270),
      I('plant', 348, 322),
      // Kitchen & dining
      I('counter', 595, 355, 90),
      I('stove', 595, 300, 90),
      I('sinkK', 595, 420, 90),
      I('fridge', 597, 570, 90),
      I('diningTable', 460, 420, 90),
      I('chair', 460, 315, 0),
      I('chair', 460, 525, 180),
      I('chair', 398, 420, 270),
      I('chair', 522, 420, 90),
      // Entry hall
      I('bookshelf', 34, 780, 90),
      I('rug', 130, 800, 0, 150, 90),
      I('plant', 60, 918),
      // Laundry
      I('washer', 302, 682),
      I('washer', 370, 682),
      I('bookshelf', 345, 936, 180),
      // Storage
      I('wardrobe', 540, 678),
      I('desk', 540, 912, 180),
      // Doors & openings
      I('door', 300, 290),
      I('door', 420, 230),
      I('door', 125, 630),
      I('door', 345, 630),
      I('door', 540, 630),
      I('door', 140, 960),
      I('opening', 380, 470, 90, 160),
      // Windows
      I('window', 170, 0),
      I('window', 500, 0),
      I('window', 0, 430, 90),
      I('window', 0, 560, 90),
      I('window', 640, 330, 90),
      I('window', 540, 960),
    ],
  };
  state.ref = null;
  refEl = null;
  sel = null;
}

/* =========================================================================
   Init
   ========================================================================= */
function resize() {
  dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  cw = Math.max(1, Math.round(rect.width));
  ch = Math.max(1, Math.round(rect.height));
  canvas.width = cw * dpr;
  canvas.height = ch * dpr;
  requestDraw();
}
new ResizeObserver(resize).observe(canvas.parentElement);
window.addEventListener('resize', resize);

buildPalette();
if (!loadState()) loadDemo();
if (state.ref) setRefImage(state.ref.src);
syncRefPanel();
resize();
fitView();
requestDraw();
