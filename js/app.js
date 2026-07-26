'use strict';

/* =========================================================================
   Remodel Studio — 2D floor plan designer
   Blueprint view  : white line-work on dark, like a hand-drawn plan
   Rendered view   : furnished top-down render with wood floors & tiles
   Compare view    : both at once, split by a draggable divider
   All coordinates are in centimetres; the view maps cm -> screen px.
   ========================================================================= */

const WALL = 14; // wall thickness, cm

const FLOORS = { wood: 'Wood', tile: 'Tile', stone: 'Stone' };

/* Catalog: default size (cm), palette category, draw order z, wall = sits on walls */
const TYPES = {
  door:        { label: 'Door',         w: 90,  h: 12, cat: 'Structure', z: 1, wall: true },
  opening:     { label: 'Opening',      w: 140, h: 12, cat: 'Structure', z: 1, wall: true },
  window:      { label: 'Window',       w: 140, h: 12, cat: 'Structure', z: 1, wall: true },
  sofa:        { label: 'Sofa',         w: 220, h: 95, cat: 'Living', z: 2 },
  armchair:    { label: 'Armchair',     w: 90,  h: 88, cat: 'Living', z: 2 },
  coffeeTable: { label: 'Coffee table', w: 110, h: 60, cat: 'Living', z: 3 },
  tvstand:     { label: 'TV stand',     w: 160, h: 42, cat: 'Living', z: 2 },
  rug:         { label: 'Rug',          w: 230, h: 160, cat: 'Living', z: 1 },
  plant:       { label: 'Plant',        w: 50,  h: 50, cat: 'Living', z: 3 },
  bookshelf:   { label: 'Bookshelf',    w: 120, h: 35, cat: 'Living', z: 2 },
  bedDouble:   { label: 'Double bed',   w: 180, h: 210, cat: 'Bedroom', z: 2 },
  bedSingle:   { label: 'Single bed',   w: 100, h: 200, cat: 'Bedroom', z: 2 },
  wardrobe:    { label: 'Wardrobe',     w: 180, h: 62, cat: 'Bedroom', z: 2 },
  nightstand:  { label: 'Nightstand',   w: 46,  h: 40, cat: 'Bedroom', z: 2 },
  desk:        { label: 'Desk',         w: 140, h: 60, cat: 'Bedroom', z: 2 },
  counter:     { label: 'Counter',      w: 240, h: 62, cat: 'Kitchen & Dining', z: 2 },
  stove:       { label: 'Stove',        w: 62,  h: 62, cat: 'Kitchen & Dining', z: 3 },
  sinkK:       { label: 'Kitchen sink', w: 62,  h: 62, cat: 'Kitchen & Dining', z: 3 },
  fridge:      { label: 'Fridge',       w: 70,  h: 72, cat: 'Kitchen & Dining', z: 2 },
  diningTable: { label: 'Dining table', w: 160, h: 95, cat: 'Kitchen & Dining', z: 2 },
  chair:       { label: 'Chair',        w: 46,  h: 48, cat: 'Kitchen & Dining', z: 2 },
  toilet:      { label: 'Toilet',       w: 42,  h: 66, cat: 'Bathroom', z: 2 },
  sinkB:       { label: 'Washbasin',    w: 56,  h: 46, cat: 'Bathroom', z: 2 },
  shower:      { label: 'Shower',       w: 95,  h: 95, cat: 'Bathroom', z: 1 },
  bathtub:     { label: 'Bathtub',      w: 170, h: 80, cat: 'Bathroom', z: 2 },
  washer:      { label: 'Washer',       w: 62,  h: 62, cat: 'Bathroom', z: 2 },
};

/* ---------- palettes ---------- */
const BP = { bg: '#14161c', floor: '#191c24', wall: '#e8ecf5', line: '#dfe6f2', label: '#aeb8cc', grid: 'rgba(160,175,205,0.07)' };
const RD = {
  bg: '#e7e2d9', wallFill: '#f8f5ee', wallEdge: '#a9a294',
  wood: '#d6bd97', woodLine: 'rgba(120,90,55,0.18)',
  tile: '#c8e2e0', tileLine: 'rgba(255,255,255,0.55)',
  stone: '#ddd7cb', stoneLine: 'rgba(120,110,95,0.15)',
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
let state = { rooms: [], items: [] };
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
   mode 'bp' = blueprint line-work, 'rd' = rendered fills.
   ========================================================================= */
function drawItem(c, it, mode) {
  const bp = mode === 'blueprint';
  c.save();
  c.translate(it.x, it.y);
  c.rotate(rad(it.rot || 0));
  const w = it.w, h = it.h, hw = w / 2, hh = h / 2;

  if (bp) { c.strokeStyle = BP.line; c.lineWidth = 2.2; c.fillStyle = 'transparent'; }
  else { c.strokeStyle = RD.outline; c.lineWidth = 1.6; }

  // Soft shadow under solid furniture in rendered mode
  const shadow = on => {
    if (!bp && on) { c.shadowColor = 'rgba(50,40,25,0.25)'; c.shadowBlur = 9; c.shadowOffsetY = 3; }
    else { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0; }
  };
  const paint = fill => { if (bp) c.stroke(); else { c.fillStyle = fill; c.fill(); shadow(false); c.stroke(); } };

  switch (it.type) {
    case 'sofa': {
      shadow(true); rr(c, -hw, -hh, w, h, 14); paint(RD.fabric);
      rr(c, -hw + 5, -hh + 5, w - 10, 22, 9); paint(RD.fabricDark);          // back rest
      rr(c, -hw + 5, -hh + 5, 20, h - 10, 9); paint(RD.fabricDark);          // arms
      rr(c, hw - 25, -hh + 5, 20, h - 10, 9); paint(RD.fabricDark);
      const sw = (w - 56) / 2;
      rr(c, -hw + 26, -hh + 28, sw, h - 34, 8); paint(RD.fabricLight);       // seat cushions
      rr(c, -hw + 28 + sw, -hh + 28, sw, h - 34, 8); paint(RD.fabricLight);
      break;
    }
    case 'armchair': {
      shadow(true); rr(c, -hw, -hh, w, h, 14); paint(RD.fabric);
      rr(c, -hw + 4, -hh + 4, w - 8, 18, 8); paint(RD.fabricDark);
      rr(c, -hw + 4, -hh + 4, 15, h - 8, 8); paint(RD.fabricDark);
      rr(c, hw - 19, -hh + 4, 15, h - 8, 8); paint(RD.fabricDark);
      rr(c, -hw + 20, -hh + 23, w - 40, h - 28, 7); paint(RD.fabricLight);
      break;
    }
    case 'coffeeTable': {
      shadow(true); rr(c, -hw, -hh, w, h, 12); paint(RD.wood1);
      rr(c, -hw + 7, -hh + 7, w - 14, h - 14, 8); if (bp) c.stroke(); else { c.strokeStyle = 'rgba(255,255,255,0.25)'; c.stroke(); c.strokeStyle = RD.outline; }
      break;
    }
    case 'tvstand': {
      shadow(true); rr(c, -hw, -hh, w, h, 6); paint(RD.wood2);
      rr(c, -hw + 12, -hh - 4, w - 24, 8, 2); paint('#2b2e33');              // TV panel on front edge
      break;
    }
    case 'rug': {
      c.setLineDash(bp ? [9, 7] : []);
      rr(c, -hw, -hh, w, h, 18); paint(RD.textile);
      c.setLineDash([]);
      if (!bp) { rr(c, -hw + 10, -hh + 10, w - 20, h - 20, 12); c.strokeStyle = 'rgba(255,255,255,0.45)'; c.stroke(); }
      break;
    }
    case 'plant': {
      const r = Math.min(hw, hh);
      shadow(true); c.beginPath(); c.arc(0, 0, r, 0, 7); paint('#b9a08a');   // pot
      if (!bp) {
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          c.beginPath(); c.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.42, 0, 7);
          c.fillStyle = i % 2 ? RD.green : RD.greenDark; c.fill();
        }
        c.beginPath(); c.arc(0, 0, r * 0.3, 0, 7); c.fillStyle = RD.green; c.fill();
      } else {
        c.beginPath(); c.arc(0, 0, r * 0.55, 0, 7); c.stroke();
      }
      break;
    }
    case 'bookshelf': {
      shadow(true); rr(c, -hw, -hh, w, h, 4); paint(RD.wood2);
      c.beginPath();
      for (let i = 1; i < 4; i++) { const x = -hw + w * i / 4; c.moveTo(x, -hh + 3); c.lineTo(x, hh - 3); }
      c.stroke();
      break;
    }
    case 'bedDouble': case 'bedSingle': {
      shadow(true); rr(c, -hw, -hh, w, h, 10); paint('#c9b596');             // frame
      rr(c, -hw + 6, -hh + 6, w - 12, h - 12, 8); paint('#efe9dd');          // mattress
      const single = it.type === 'bedSingle';
      const pw = single ? w - 32 : (w - 36) / 2;
      rr(c, -hw + 14, -hh + 14, pw, 30, 8); paint(RD.white);                 // pillows
      if (!single) rr(c, -hw + 22 + pw, -hh + 14, pw, 30, 8); paint(RD.white);
      rr(c, -hw + 6, -hh + 58, w - 12, h - 64, 8); paint('#cfc4b0');         // blanket
      c.beginPath(); c.moveTo(-hw + 6, -hh + 74); c.lineTo(hw - 6, -hh + 74); c.stroke();
      break;
    }
    case 'wardrobe': {
      shadow(true); rr(c, -hw, -hh, w, h, 4); paint('#b9a58a');
      c.beginPath(); c.moveTo(-hw + 8, 0); c.lineTo(hw - 8, 0); c.stroke(); // hanging rail
      c.beginPath();
      for (let x = -hw + 20; x < hw - 12; x += 24) { c.moveTo(x, -8); c.lineTo(x, 8); }
      c.stroke();
      break;
    }
    case 'nightstand': {
      shadow(true); rr(c, -hw, -hh, w, h, 6); paint(RD.wood1);
      c.beginPath(); c.arc(0, 0, 4, 0, 7); paint('#e8e2d4');
      break;
    }
    case 'desk': {
      shadow(true); rr(c, -hw, -hh, w, h, 6); paint(RD.wood1);
      rr(c, -hw + 10, -hh + 8, 40, h - 16, 4); paint('#d9d2c2');             // desk pad
      break;
    }
    case 'counter': {
      shadow(true); rr(c, -hw, -hh, w, h, 4); paint('#e9e3d5');
      c.beginPath(); c.moveTo(-hw + 4, hh - 8); c.lineTo(hw - 4, hh - 8); c.stroke();
      break;
    }
    case 'stove': {
      rr(c, -hw, -hh, w, h, 4); paint('#3a3d42');
      const o = Math.min(hw, hh) * 0.44;
      for (const [dx, dy] of [[-o, -o], [o, -o], [-o, o], [o, o]]) {
        c.beginPath(); c.arc(dx, dy, Math.min(hw, hh) * 0.3, 0, 7);
        if (bp) c.stroke(); else { c.fillStyle = '#25272b'; c.fill(); c.strokeStyle = '#5c6066'; c.stroke(); c.strokeStyle = RD.outline; }
      }
      break;
    }
    case 'sinkK': {
      rr(c, -hw, -hh, w, h, 4); paint('#e9e3d5');
      rr(c, -hw + 8, -hh + 12, w - 16, h - 20, 7); paint(RD.metal);
      c.beginPath(); c.arc(0, -hh + 7, 3.5, 0, 7); paint('#9aa0a6');         // faucet
      break;
    }
    case 'fridge': {
      shadow(true); rr(c, -hw, -hh, w, h, 8); paint(RD.appliance);
      c.beginPath(); c.moveTo(0, -hh + 4); c.lineTo(0, hh - 4); c.stroke();
      break;
    }
    case 'diningTable': {
      shadow(true); rr(c, -hw, -hh, w, h, 14); paint(RD.wood1);
      rr(c, -20, -12, 40, 24, 8); paint('#d9d2c2');                          // centrepiece
      break;
    }
    case 'chair': {
      shadow(true); rr(c, -hw, -hh + 10, w, h - 10, 9); paint(RD.fabricLight); // seat
      rr(c, -hw, -hh, w, 12, 5); paint(RD.wood2);                            // back rest
      break;
    }
    case 'toilet': {
      shadow(true); rr(c, -hw, -hh, w, 20, 5); paint(RD.white);              // cistern
      c.beginPath(); c.ellipse(0, 8, hw - 3, hh - 14, 0, 0, 7); paint(RD.white);
      c.beginPath(); c.ellipse(0, 8, hw - 10, hh - 21, 0, 0, 7); c.stroke();
      break;
    }
    case 'sinkB': {
      shadow(true); rr(c, -hw, -hh, w, h, 8); paint(RD.white);
      c.beginPath(); c.ellipse(0, 2, hw - 9, hh - 11, 0, 0, 7); paint(bp ? 'transparent' : '#dde4e8');
      c.beginPath(); c.arc(0, -hh + 6, 3, 0, 7); paint('#9aa0a6');
      break;
    }
    case 'shower': {
      rr(c, -hw, -hh, w, h, 6);
      if (bp) {
        c.stroke();
        c.beginPath(); c.moveTo(-hw, -hh); c.lineTo(hw, hh); c.moveTo(hw, -hh); c.lineTo(-hw, hh); c.stroke();
      } else {
        c.fillStyle = '#d7ebec'; c.fill(); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.6)'; c.beginPath();
        for (let x = -hw + w / 4; x < hw; x += w / 4) { c.moveTo(x, -hh + 3); c.lineTo(x, hh - 3); }
        for (let y = -hh + h / 4; y < hh; y += h / 4) { c.moveTo(-hw + 3, y); c.lineTo(hw - 3, y); }
        c.stroke(); c.strokeStyle = RD.outline;
        c.beginPath(); c.arc(0, 0, 5, 0, 7); c.fillStyle = RD.metal; c.fill(); c.stroke();
      }
      break;
    }
    case 'bathtub': {
      shadow(true); rr(c, -hw, -hh, w, h, 18); paint(RD.white);
      rr(c, -hw + 9, -hh + 9, w - 18, h - 18, 14); paint(bp ? 'transparent' : '#e4eaee');
      c.beginPath(); c.arc(-hw + 26, 0, 4, 0, 7); paint('#9aa0a6');
      break;
    }
    case 'washer': {
      shadow(true); rr(c, -hw, -hh, w, h, 6); paint(RD.appliance);
      c.beginPath(); c.arc(0, 3, Math.min(hw, hh) * 0.55, 0, 7); paint(bp ? 'transparent' : '#aeb8c2');
      c.beginPath(); c.arc(0, 3, Math.min(hw, hh) * 0.32, 0, 7); paint(bp ? 'transparent' : '#7c8894');
      c.beginPath(); c.moveTo(-hw + 5, -hh + 9); c.lineTo(hw - 5, -hh + 9); c.stroke();
      break;
    }
    /* -------- wall-mounted -------- */
    case 'door': {
      c.fillStyle = bp ? BP.bg : '#efe8da';
      c.fillRect(-hw, -WALL / 2 - 2, w, WALL + 4);                            // cut the wall
      if (bp) {
        c.beginPath(); c.moveTo(-hw, 0); c.lineTo(-hw, w); c.stroke();       // leaf
        c.beginPath(); c.arc(-hw, 0, w, 0, Math.PI / 2); c.stroke();         // swing
      } else {
        c.strokeStyle = 'rgba(70,58,44,0.3)';
        c.beginPath(); c.arc(-hw, 0, w, 0, Math.PI / 2); c.stroke();
        c.strokeStyle = RD.outline;
        rr(c, -hw - 2, 0, 5, w, 2); paint(RD.wood1);                          // leaf
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
        rr(c, -hw, -4, w, 8, 2); c.fillStyle = RD.glass; c.fill(); c.stroke();
        c.beginPath(); c.moveTo(-hw, 0); c.lineTo(hw, 0); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.stroke();
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

  const base = room.floor === 'tile' ? RD.tile : room.floor === 'stone' ? RD.stone : RD.wood;
  c.fillStyle = base;
  c.fillRect(room.x, room.y, room.w, room.h);

  c.save();
  c.beginPath(); c.rect(room.x, room.y, room.w, room.h); c.clip();
  c.lineWidth = 1.3;
  c.beginPath();
  if (room.floor === 'tile') {
    c.strokeStyle = RD.tileLine;
    for (let x = room.x; x <= room.x + room.w; x += 30) { c.moveTo(x, room.y); c.lineTo(x, room.y + room.h); }
    for (let y = room.y; y <= room.y + room.h; y += 30) { c.moveTo(room.x, y); c.lineTo(room.x + room.w, y); }
  } else if (room.floor === 'stone') {
    c.strokeStyle = RD.stoneLine;
    for (let x = room.x; x <= room.x + room.w; x += 45) { c.moveTo(x, room.y); c.lineTo(x, room.y + room.h); }
    for (let y = room.y; y <= room.y + room.h; y += 45) { c.moveTo(room.x, y); c.lineTo(room.x + room.w, y); }
  } else {
    c.strokeStyle = RD.woodLine;
    for (let y = room.y; y <= room.y + room.h; y += 19) { c.moveTo(room.x, y); c.lineTo(room.x + room.w, y); }
  }
  c.stroke();
  c.restore();
}

function drawWalls(c, mode) {
  const bp = mode === 'blueprint';
  for (const r of state.rooms) {
    if (bp) {
      c.strokeStyle = BP.wall; c.lineWidth = WALL;
      c.strokeRect(r.x, r.y, r.w, r.h);
      c.strokeStyle = BP.bg; c.lineWidth = WALL - 7;                          // hollow double-line walls
      c.strokeRect(r.x, r.y, r.w, r.h);
    } else {
      c.strokeStyle = RD.wallEdge; c.lineWidth = WALL + 3;
      c.strokeRect(r.x, r.y, r.w, r.h);
      c.strokeStyle = RD.wallFill; c.lineWidth = WALL;
      c.strokeRect(r.x, r.y, r.w, r.h);
    }
  }
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
  drawWalls(c, mode);
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
const propFloor = document.getElementById('propFloor');
const propW = document.getElementById('propW');
const propH = document.getElementById('propH');
const propRot = document.getElementById('propRot');
const fieldName = document.getElementById('fieldName');
const fieldFloor = document.getElementById('fieldFloor');
const fieldRot = document.getElementById('fieldRot');

for (const [k, v] of Object.entries(FLOORS)) {
  const opt = document.createElement('option');
  opt.value = k; opt.textContent = v;
  propFloor.appendChild(opt);
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
  if (isRoom) { propName.value = o.name || ''; propFloor.value = o.floor || 'wood'; }
  else propRot.value = o.rot || 0;
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
    o.floor = propFloor.value;
  } else {
    o.rot = ((+propRot.value || 0) % 360 + 360) % 360;
  }
  saveState(); requestDraw();
}
for (const el of [propName, propFloor, propW, propH, propRot]) el.addEventListener('input', applyProps);

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
for (const btn of document.querySelectorAll('.view-switch button')) {
  btn.addEventListener('click', () => {
    viewMode = btn.dataset.mode;
    for (const b of document.querySelectorAll('.view-switch button')) b.classList.toggle('active', b === btn);
    requestDraw();
  });
}

document.getElementById('btnFit').addEventListener('click', () => { fitView(); requestDraw(); });
document.getElementById('btnDemo').addEventListener('click', () => { loadDemo(); fitView(); changed(); });
document.getElementById('btnClear').addEventListener('click', () => {
  if (state.rooms.length || state.items.length) {
    if (!confirm('Start a new empty plan? The current plan will be discarded.')) return;
  }
  state = { rooms: [], items: [] };
  sel = null;
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
    state = { rooms: data.rooms, items: data.items };
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
      R(0, 290, 380, 340, 'Living Room', 'wood'),
      R(380, 230, 260, 400, 'Kitchen', 'stone'),
      R(0, 630, 250, 330, 'Entry Hall', 'stone'),
      R(250, 630, 190, 330, 'Laundry', 'tile'),
      R(440, 630, 200, 330, 'Storage', 'wood'),
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
      I('armchair', 160, 562, 320),
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
resize();
fitView();
requestDraw();
