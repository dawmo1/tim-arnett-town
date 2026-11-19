// Materials for the city. Building walls share one texture atlas (4x4 cells, each 4 bays x 4 floors)
// so a whole tile's buildings draw in one call; a small shader patch repeats a cell across a wall.
import * as THREE from 'three';
import { rng } from '../util.js';

// atlas cells: [col, row]
export const CELL = {
  brick: [0, 0], stone: [1, 0], siding: [2, 0], glass: [3, 0],
  stucco: [0, 1], metal: [1, 1], store: [2, 1], roof: [3, 1],
  shingle: [0, 2], brick2: [1, 2], office: [2, 2], plain: [3, 2],
  ramp: [0, 3], garage: [1, 3], church: [2, 3], brick3: [3, 3],
};
export const STYLE_CELL = ['brick', 'stone', 'siding', 'glass', 'stucco', 'metal'];
const N = 512;

function atlas(lit) {
  const c = document.createElement('canvas'); c.width = c.height = N * 4;
  const g = c.getContext('2d');
  const r = rng(lit ? 11 : 5);
  g.fillStyle = lit ? '#000' : '#fff'; g.fillRect(0, 0, N * 4, N * 4);
  const cell = (name, fn) => { const [cx, cy] = CELL[name]; g.save(); g.translate(cx * N, cy * N); g.beginPath(); g.rect(0, 0, N, N); g.clip(); fn(); g.restore(); };
  const litColor = () => ['#ffd27a', '#fff1c1', '#ffb85c', '#cfe3ff', '#ffe3a3'][Math.floor(r() * 5)];
  // window grid: 4 bays x 4 floors, each 128 x 128 px
  const windows = (wx, wy, ww, wh, frame, glass, sill, opts = {}) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const ox = i * 128, oy = j * 128;
      if (opts.skip && opts.skip(i, j)) continue;
      if (lit) { if (r() < (opts.litP ?? 0.42)) { g.fillStyle = litColor(); g.fillRect(ox + wx, oy + wy, ww, wh); g.fillStyle = '#000'; g.fillRect(ox + wx + ww / 2 - 2, oy + wy, 4, wh); } continue; }
      g.fillStyle = frame; g.fillRect(ox + wx - 5, oy + wy - 5, ww + 10, wh + 10);
      const grd = g.createLinearGradient(0, oy + wy, 0, oy + wy + wh); grd.addColorStop(0, glass[0]); grd.addColorStop(1, glass[1]);
      g.fillStyle = grd; g.fillRect(ox + wx, oy + wy, ww, wh);
      g.fillStyle = frame; g.fillRect(ox + wx + ww / 2 - 2, oy + wy, 4, wh); g.fillRect(ox + wx, oy + wy + wh * 0.45, ww, 3);
      if (sill) { g.fillStyle = sill; g.fillRect(ox + wx - 8, oy + wy + wh + 4, ww + 16, 7); }
      if (opts.arch) { g.fillStyle = sill || frame; g.beginPath(); g.ellipse(ox + wx + ww / 2, oy + wy - 4, ww / 2 + 6, 12, 0, Math.PI, 0); g.fill(); }
    }
  };
  const noise = (col, n, a) => { if (lit) return; for (let k = 0; k < n; k++) { g.fillStyle = `rgba(${col},${(r() * a).toFixed(3)})`; g.fillRect(r() * N, r() * N, 2 + r() * 6, 2 + r() * 3); } };
  const bricks = (base, mortar, vary) => {
    if (lit) return;
    g.fillStyle = mortar; g.fillRect(0, 0, N, N);
    for (let y = 0, row = 0; y < N; y += 8, row++) for (let x = (row % 2) * -8; x < N; x += 16) {
      const k = 1 + (r() - 0.5) * vary; const [R, G, B] = base;
      g.fillStyle = `rgb(${R * k | 0},${G * k | 0},${B * k | 0})`; g.fillRect(x + 1, y + 1, 14, 6);
    }
  };
  // red brick with cream sills (downtown, older blocks)
  cell('brick', () => { bricks([150, 74, 56], '#a89a8c', 0.25); windows(30, 22, 68, 78, '#3a2a22', ['#56738c', '#2c3e50'], '#d8cbb0'); });
  // brown/tan brick with arched windows (East Village)
  cell('brick2', () => { bricks([128, 86, 60], '#9b8f80', 0.22); windows(34, 30, 60, 74, '#2d241f', ['#6a879d', '#33475a'], '#cbbd9e', { arch: true }); });
  cell('brick3', () => { bricks([176, 150, 120], '#8c8278', 0.15); windows(28, 24, 72, 74, '#4a4a4a', ['#5d7891', '#2b3b4c'], '#e8e0d0'); });
  // limestone
  cell('stone', () => {
    if (!lit) { g.fillStyle = '#cdbf9f'; g.fillRect(0, 0, N, N); g.strokeStyle = 'rgba(90,80,60,.35)'; g.lineWidth = 2; for (let y = 0; y < N; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(N, y); g.stroke(); } noise('80,70,50', 600, 0.15); }
    windows(36, 16, 56, 92, '#5b5446', ['#5d7891', '#2b3b4c'], '#e4dccb');
  });
  // painted clapboard siding (tinted per house with vertex colours)
  cell('siding', () => {
    if (!lit) { g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, N, N); for (let y = 0; y < N; y += 11) { g.fillStyle = 'rgba(0,0,0,.13)'; g.fillRect(0, y, N, 2); } }
    windows(38, 30, 52, 66, '#fafafa', ['#6d8aa0', '#344a5c'], null, { skip: (i) => i === 1 || i === 3, litP: 0.5 });
    if (!lit) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (i % 2 === 0) { g.fillStyle = '#2f3b33'; g.fillRect(i * 128 + 18, j * 128 + 28, 14, 70); g.fillRect(i * 128 + 96, j * 128 + 28, 14, 70); }
  });
  // glass curtain wall
  cell('glass', () => {
    if (!lit) { const grd = g.createLinearGradient(0, 0, N, N); grd.addColorStop(0, '#7fa6c2'); grd.addColorStop(1, '#2f5068'); g.fillStyle = grd; g.fillRect(0, 0, N, N); g.fillStyle = '#c8d3db'; for (let x = 0; x < N; x += 64) g.fillRect(x, 0, 5, N); for (let y = 0; y < N; y += 128) g.fillRect(0, y, N, 9); }
    else for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) if (r() < 0.35) { g.fillStyle = litColor(); g.fillRect(i * 64 + 6, j * 128 + 12, 54, 112); }
  });
  cell('office', () => {
    if (!lit) { g.fillStyle = '#b8bcbf'; g.fillRect(0, 0, N, N); g.fillStyle = '#2d4356'; for (let j = 0; j < 4; j++) g.fillRect(0, j * 128 + 30, N, 64); g.fillStyle = '#9aa3a8'; for (let x = 0; x < N; x += 42) g.fillRect(x, 0, 4, N); }
    else for (let i = 0; i < 12; i++) for (let j = 0; j < 4; j++) if (r() < 0.4) { g.fillStyle = litColor(); g.fillRect(i * 42 + 5, j * 128 + 30, 34, 64); }
  });
  // strip-mall stucco / EIFS
  cell('stucco', () => {
    if (!lit) { g.fillStyle = '#e6dcc8'; g.fillRect(0, 0, N, N); noise('120,100,80', 900, 0.08); g.fillStyle = '#c9b99c'; for (let j = 0; j < 4; j++) g.fillRect(0, j * 128 + 118, N, 10); }
    windows(40, 40, 48, 40, '#776c5c', ['#5e7487', '#36495a'], null, { litP: 0.3 });
  });
  // corrugated metal
  cell('metal', () => {
    if (!lit) { g.fillStyle = '#b4b8bb'; g.fillRect(0, 0, N, N); for (let x = 0; x < N; x += 8) { g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x, 0, 3, N); } noise('120,80,50', 300, 0.25); }
    windows(40, 34, 48, 26, '#666', ['#6d8295', '#3b4b58'], null, { skip: (i, j) => (i + j) % 3 !== 0, litP: 0.25 });
  });
  cell('garage', () => { if (!lit) { g.fillStyle = '#d9d9d9'; g.fillRect(0, 0, N, N); for (let y = 0; y < N; y += 16) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, y, N, 2); } } });
  cell('church', () => { bricks([160, 150, 135], '#7d766c', 0.12); if (!lit) { g.fillStyle = '#3b5a7a'; for (let i = 0; i < 2; i++) { g.fillRect(i * 256 + 98, 60, 60, 300); g.beginPath(); g.arc(i * 256 + 128, 60, 30, Math.PI, 0); g.fill(); } } else for (let i = 0; i < 2; i++) if (r() < 0.6) { g.fillStyle = '#ffcf7a'; g.fillRect(i * 256 + 98, 60, 60, 300); } });
  cell('plain', () => { if (!lit) { g.fillStyle = '#eeeeee'; g.fillRect(0, 0, N, N); noise('0,0,0', 400, 0.05); } });
  // storefronts: 3 shops across, one storey (glass, door, sign band, awning stripe)
  cell('store', () => {
    for (let i = 0; i < 3; i++) {
      const ox = i * 171;
      if (lit) { if (r() < 0.85) { g.fillStyle = litColor(); g.fillRect(ox + 10, 190, 150, 250); } if (r() < 0.7) { g.fillStyle = ['#ff5a5a', '#5ad1ff', '#ffe066', '#7cff8a', '#ff8bd8'][Math.floor(r() * 5)]; g.fillRect(ox + 16, 60, 140, 60); } continue; }
      g.fillStyle = ['#2e3b2f', '#3a2626', '#24303d', '#3d3424', '#2a2a2a'][Math.floor(r() * 5)]; g.fillRect(ox, 0, 171, N);
      g.fillStyle = ['#c0392b', '#2471a3', '#d4ac0d', '#1e8449', '#7d3c98', '#e67e22'][Math.floor(r() * 6)]; g.fillRect(ox + 16, 60, 140, 60);
      g.fillStyle = '#f4f4f4'; for (let k = 0; k < 5; k++) g.fillRect(ox + 28 + k * 24, 82, 14, 16);
      const grd = g.createLinearGradient(0, 190, 0, 440); grd.addColorStop(0, '#9fb8c9'); grd.addColorStop(1, '#3a4f5e');
      g.fillStyle = grd; g.fillRect(ox + 10, 190, 150, 250);
      g.fillStyle = '#1b1b1b'; g.fillRect(ox + 100, 250, 44, 190); g.fillRect(ox + 10, 440, 150, 8);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(ox + 18, 200, 12, 230);
      for (let s = 0; s < 8; s++) { g.fillStyle = s % 2 ? '#f2f2f2' : ['#b03a2e', '#1f618d', '#196f3d'][i]; g.fillRect(ox + 10 + s * 19, 150, 19, 30); }
    }
    if (!lit) { g.fillStyle = '#8e8e8e'; g.fillRect(0, 448, N, 64); }
  });
  cell('roof', () => { if (!lit) { g.fillStyle = '#6d6d6a'; g.fillRect(0, 0, N, N); noise('30,30,30', 2500, 0.25); noise('200,200,200', 800, 0.12); g.fillStyle = '#9b9b96'; g.fillRect(0, 0, N, 6); g.fillRect(0, 0, 6, N); } });
  cell('shingle', () => {
    if (lit) return;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, N, N);
    for (let y = 0, row = 0; y < N; y += 16, row++) for (let x = (row % 2) * -12; x < N; x += 24) { const k = 0.72 + r() * 0.28; g.fillStyle = `rgb(${255 * k | 0},${255 * k | 0},${255 * k | 0})`; g.fillRect(x + 1, y + 1, 22, 14); }
  });
  // parking ramp: concrete floor slabs with open dark bays between columns
  cell('ramp', () => {
    if (lit) { for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) if (r() < 0.5) { g.fillStyle = '#ffe9b0'; g.fillRect(i * 64 + 10, j * 128 + 60, 44, 6); } return; }
    g.fillStyle = '#b9b6ae'; g.fillRect(0, 0, N, N);
    for (let j = 0; j < 4; j++) { g.fillStyle = '#2a2c2e'; g.fillRect(0, j * 128 + 34, N, 74); g.fillStyle = '#a19e96'; for (let i = 0; i < 4; i++) g.fillRect(i * 128, j * 128 + 34, 16, 74); g.fillStyle = '#c9c6be'; g.fillRect(0, j * 128 + 96, N, 12); }
    noise('60,60,60', 500, 0.12);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// Shader patch: repeat one atlas cell across the surface (textureGrad keeps mipmaps seam-free).
function atlasPatch(m) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 atlas;\nvarying vec2 vAtlas;\nvarying vec2 vAUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvAtlas = atlas; vAUv = uv;');
    const sample = (tex) => `textureGrad(${tex}, fract(vAUv) * 0.234 + vAtlas + 0.008, dFdx(vAUv) * 0.234, dFdy(vAUv) * 0.234)`;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vAtlas;\nvarying vec2 vAUv;')
      .replace('#include <map_fragment>', `diffuseColor *= ${sample('map')};`)
      .replace('#include <emissivemap_fragment>', `totalEmissiveRadiance *= ${sample('emissiveMap')}.rgb;`);
  };
  m.customProgramCacheKey = () => 'atlas1';
  return m;
}

function noiseTex(size, base, amt, seed, lines = null) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let k = 0; k < size * size * 0.06; k++) { const v = Math.floor(r() * 255); g.fillStyle = `rgba(${v},${v},${v},${amt})`; g.fillRect(r() * size, r() * size, 1 + r() * 3, 1 + r() * 3); }
  if (lines) lines(g, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Made-up business names for lit shop signs (8 x 16 grid of 256 x 64 cells).
export const SIGN_NAMES = ["Tim's Diner", 'Arnett Hardware', 'River City Pawn', 'Quad Coffee', 'Big Muddy BBQ', 'Bix Records', 'Lock & Dam Liquor', 'Bluff Barbers', 'Mississippi Mattress', 'Hilltop Tavern', 'Arnett Pharmacy', 'Paddlewheel Pizza', 'Barge Burgers', 'Brady St. Tattoo', 'Quad Nails', 'Iowa Cell Repair', 'Tim Taco', 'Village Bakery', 'River Rat Bait', 'Corn Belt Cafe', 'Dam Good Donuts', 'Arnett Insurance', 'Hawkeye Hobbies', 'Gold Coast Gifts', 'Eagle Point Optical', 'Riverbend Books', 'Bluff City Bikes', 'Pinewood Pub', 'Quad Vapes', 'Mayor Tim HQ', 'Prairie Florist', 'Second Hand Rose', 'Sweet Corn Sweets', 'Bridge View Bar', 'Davenport Dry Clean', 'Lucky Arnett Laundry', 'Steamboat Subs', 'Old Town Antiques', 'Muddy Waters Coffee', 'Kimberly Kicks', 'Heartland Hair', 'Arsenal Army Surplus', 'Cornfield Comics', 'Rust Belt Records', 'Quad City Cleaners', 'Pork Tenderloin Palace', 'Tim Mart Express', 'Bettendorf Bagels', 'Rock Island Rugs', 'Moline Mobile', 'Lindsay Park Pets', 'River Drive Rentals', 'Bandshell Brews', 'Ferris Wheel Fun', 'Skybridge Sushi', 'Westside Wings', 'Northside Nutrition', 'Bucktown Bistro', 'Freight House Fitness', 'Locust St. Loans', 'Harrison Hot Dogs', 'Union Station Sandwiches', 'Mayor\'s Meat Market', 'Davenport Donuts'];
function signAtlas(lit) {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
  const g = c.getContext('2d');
  const COLS = [['#b71c1c', '#fff'], ['#0d47a1', '#fff'], ['#1b5e20', '#fff'], ['#212121', '#ffd54f'], ['#4a148c', '#fff'], ['#f9a825', '#212121'], ['#004d40', '#ffeb3b'], ['#e65100', '#fff'], ['#fafafa', '#c62828'], ['#263238', '#80deea']];
  for (let i = 0; i < 128; i++) {
    const x = (i % 8) * 256, y = Math.floor(i / 8) * 64, name = SIGN_NAMES[i % SIGN_NAMES.length], [bg, fg] = COLS[(i * 7) % COLS.length];
    g.fillStyle = lit ? '#0a0a0a' : bg; g.fillRect(x + 2, y + 2, 252, 60);
    if (!lit) { g.strokeStyle = fg; g.lineWidth = 3; g.strokeRect(x + 6, y + 6, 244, 52); }
    g.fillStyle = lit ? fg : fg; g.font = `bold ${name.length > 16 ? 24 : 30}px Arial Black, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name.toUpperCase(), x + 128, y + 33, 236);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// spray-paint tags for older walls (4 x 2 grid)
function graffitiAtlas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d'); const r = rng(77);
  const TAGS = ['TIM!', 'QC', 'BIX', 'RIVR', 'IOWA', 'SK8', 'DVN', 'ARNT'];
  for (let i = 0; i < 8; i++) {
    const x = (i % 4) * 256, y = Math.floor(i / 4) * 256, col = ['#ff1744', '#00e5ff', '#76ff03', '#ffea00', '#d500f9', '#ff9100'][Math.floor(r() * 6)];
    g.save(); g.translate(x + 128, y + 128); g.rotate((r() - 0.5) * 0.4);
    g.font = `900 ${70 + r() * 30}px Impact, Arial Black`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 14; g.strokeStyle = '#111'; g.strokeText(TAGS[i], 0, 0); g.fillStyle = col; g.fillText(TAGS[i], 0, 0);
    for (let k = 0; k < 6; k++) { g.fillStyle = col; g.fillRect(-90 + r() * 180, 30 + r() * 20, 3, 20 + r() * 40); } // drips
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const M = {};
export function initMaterials() {
  if (M.building) return M;
  const day = atlas(false), night = atlas(true);
  M.building = atlasPatch(new THREE.MeshStandardMaterial({ map: day, emissiveMap: night, emissive: 0xffd9a0, emissiveIntensity: 0, vertexColors: true, roughness: 0.82, metalness: 0 }));
  M.terrain = new THREE.MeshStandardMaterial({ vertexColors: true, map: noiseTex(256, '#d8d8d8', 0.18, 3), roughness: 0.95 });
  M.road = new THREE.MeshStandardMaterial({ vertexColors: true, map: noiseTex(256, '#bdbdbd', 0.22, 4, (g, s) => { g.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(Math.random() * s, 0); g.lineTo(Math.random() * s, s); g.lineWidth = 1; g.strokeStyle = 'rgba(30,30,30,.25)'; g.stroke(); } }), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  M.walk = new THREE.MeshStandardMaterial({ vertexColors: true, map: noiseTex(128, '#e4e1db', 0.12, 5, (g, s) => { g.fillStyle = 'rgba(80,80,80,.35)'; g.fillRect(0, 0, s, 2); g.fillRect(0, 0, 2, s); }), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  M.mark = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  M.signs = new THREE.MeshStandardMaterial({ map: signAtlas(false), emissiveMap: signAtlas(true), emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.graffiti = new THREE.MeshStandardMaterial({ map: graffitiAtlas(), transparent: true, alphaTest: 0.3, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.rail = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  M.water = new THREE.MeshStandardMaterial({ color: 0x3f6f7a, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.93 });
  M.far = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  M.farBox = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, emissive: 0xffc070, emissiveIntensity: 0 });
  return M;
}
