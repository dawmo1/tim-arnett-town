// Materials for the city. Building walls share one texture atlas (4x4 cells, each 4 bays x 4 floors)
// so a whole tile's buildings draw in one call; a small shader patch repeats a cell across a wall.
import * as THREE from 'three';
import { rng } from '../util.js';
import { nameTexture } from './names.js';

// atlas cells: [col, row]
export const CELL = {
  brick: [0, 0], stone: [1, 0], siding: [2, 0], glass: [3, 0],
  stucco: [0, 1], metal: [1, 1], store: [2, 1], roof: [3, 1],
  shingle: [0, 2], brick2: [1, 2], office: [2, 2], plain: [3, 2],
  ramp: [0, 3], garage: [1, 3], church: [2, 3], brick3: [3, 3],
};
export const STYLE_CELL = ['brick', 'stone', 'siding', 'glass', 'stucco', 'metal'];
const N = 512;

// mode: 'day' colour, 'lit' night windows, 'height' (bumps -> normal map), 'orm' (G roughness, B metalness)
function atlas(mode, size = N * 4) {
  const lit = mode === 'lit', H = mode === 'height', O = mode === 'orm', DAY = mode === 'day';
  const c = document.createElement('canvas'); c.width = c.height = N * 4;
  const g = c.getContext('2d');
  const r = rng(lit ? 11 : 5);
  // per-mode fills: height uses grey levels, orm packs roughness (G) and metalness (B)
  const ormC = (rough, metal) => `rgb(0,${Math.round(rough * 255)},${Math.round(metal * 255)})`;
  const WALL = H ? '#808080' : O ? ormC(0.88, 0) : null;
  g.fillStyle = lit ? '#000' : H ? '#808080' : O ? ormC(0.88, 0) : '#fff'; g.fillRect(0, 0, N * 4, N * 4);
  const cell = (name, fn) => { const [cx, cy] = CELL[name]; g.save(); g.translate(cx * N, cy * N); g.beginPath(); g.rect(0, 0, N, N); g.clip(); fn(); g.restore(); };
  const litColor = () => ['#ffd27a', '#fff1c1', '#ffb85c', '#cfe3ff', '#ffe3a3'][Math.floor(r() * 5)];
  const fill = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  // window grid: 4 bays x 4 floors, each 128 x 128 px. Frames stand out, glass sits back and reflects.
  const windows = (wx, wy, ww, wh, frame, glass, sill, opts = {}) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const ox = i * 128, oy = j * 128;
      if (opts.skip && opts.skip(i, j)) continue;
      if (lit) { if (r() < (opts.litP ?? 0.42)) { g.fillStyle = litColor(); g.fillRect(ox + wx, oy + wy, ww, wh); g.fillStyle = '#000'; g.fillRect(ox + wx + ww / 2 - 2, oy + wy, 4, wh); } continue; }
      if (H) {
        // reveal: a dark recess round the glass, then the frame, then the glass further back
        fill('#3a3a3a', ox + wx - 7, oy + wy - 7, ww + 14, wh + 14);
        fill('#9a9a9a', ox + wx - 5, oy + wy - 5, ww + 10, wh + 10);
        fill('#202020', ox + wx, oy + wy, ww, wh);
        fill('#9a9a9a', ox + wx + ww / 2 - 2, oy + wy, 4, wh); fill('#9a9a9a', ox + wx, oy + wy + wh * 0.45, ww, 3);
        if (sill) { fill('#d8d8d8', ox + wx - 8, oy + wy + wh + 4, ww + 16, 7); }
        if (opts.arch) { g.fillStyle = '#c8c8c8'; g.beginPath(); g.ellipse(ox + wx + ww / 2, oy + wy - 4, ww / 2 + 6, 12, 0, Math.PI, 0); g.fill(); }
        continue;
      }
      if (O) {
        fill(ormC(0.5, 0.1), ox + wx - 5, oy + wy - 5, ww + 10, wh + 10);
        fill(ormC(0.05, 0.75), ox + wx, oy + wy, ww, wh);
        fill(ormC(0.5, 0.1), ox + wx + ww / 2 - 2, oy + wy, 4, wh);
        if (sill) fill(ormC(0.7, 0), ox + wx - 8, oy + wy + wh + 4, ww + 16, 7);
        continue;
      }
      g.fillStyle = frame; g.fillRect(ox + wx - 5, oy + wy - 5, ww + 10, wh + 10);
      const grd = g.createLinearGradient(0, oy + wy, 0, oy + wy + wh); grd.addColorStop(0, glass[0]); grd.addColorStop(1, glass[1]);
      g.fillStyle = grd; g.fillRect(ox + wx, oy + wy, ww, wh);
      // the recess throws a shadow across the top and one side of the glass
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(ox + wx, oy + wy, ww, 9); g.fillRect(ox + wx, oy + wy, 7, wh);
      g.fillStyle = frame; g.fillRect(ox + wx + ww / 2 - 2, oy + wy, 4, wh); g.fillRect(ox + wx, oy + wy + wh * 0.45, ww, 3);
      if (sill) { g.fillStyle = sill; g.fillRect(ox + wx - 8, oy + wy + wh + 4, ww + 16, 7); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(ox + wx - 8, oy + wy + wh + 11, ww + 16, 4); }
      if (opts.arch) { g.fillStyle = sill || frame; g.beginPath(); g.ellipse(ox + wx + ww / 2, oy + wy - 4, ww / 2 + 6, 12, 0, Math.PI, 0); g.fill(); }
    }
  };
  const noise = (col, n, a) => { if (!DAY) return; for (let k = 0; k < n; k++) { g.fillStyle = `rgba(${col},${(r() * a).toFixed(3)})`; g.fillRect(r() * N, r() * N, 2 + r() * 6, 2 + r() * 3); } };
  const bricks = (base, mortar, vary) => {
    if (lit) return;
    if (O) { fill(ormC(0.9, 0), 0, 0, N, N); return; }
    g.fillStyle = H ? '#5a5a5a' : mortar; g.fillRect(0, 0, N, N);
    for (let y = 0, row = 0; y < N; y += 8, row++) for (let x = (row % 2) * -8; x < N; x += 16) {
      if (H) { g.fillStyle = `rgb(${150 + r() * 25 | 0},0,0)`.replace(/rgb\((\d+),0,0\)/, (m, v) => `rgb(${v},${v},${v})`); g.fillRect(x + 1, y + 1, 14, 6); continue; }
      const k = 1 + (r() - 0.5) * vary; const [R, G, B] = base;
      g.fillStyle = `rgb(${R * k | 0},${G * k | 0},${B * k | 0})`; g.fillRect(x + 1, y + 1, 14, 6);
    }
  };
  const plainWall = (day) => { if (DAY) day(); else if (H) fill('#808080', 0, 0, N, N); else if (O) fill(ormC(0.85, 0), 0, 0, N, N); };
  // red brick with cream sills (downtown, older blocks)
  cell('brick', () => { bricks([150, 74, 56], '#a89a8c', 0.25); windows(30, 22, 68, 78, '#3a2a22', ['#56738c', '#2c3e50'], '#d8cbb0'); });
  // brown/tan brick with arched windows (East Village)
  cell('brick2', () => { bricks([128, 86, 60], '#9b8f80', 0.22); windows(34, 30, 60, 74, '#2d241f', ['#6a879d', '#33475a'], '#cbbd9e', { arch: true }); });
  cell('brick3', () => { bricks([176, 150, 120], '#8c8278', 0.15); windows(28, 24, 72, 74, '#4a4a4a', ['#5d7891', '#2b3b4c'], '#e8e0d0'); });
  // limestone blocks
  cell('stone', () => {
    if (DAY) { g.fillStyle = '#cdbf9f'; g.fillRect(0, 0, N, N); g.strokeStyle = 'rgba(90,80,60,.35)'; g.lineWidth = 2; for (let y = 0; y < N; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(N, y); g.stroke(); } noise('80,70,50', 600, 0.15); }
    else if (H) { fill('#8a8a8a', 0, 0, N, N); for (let y = 0; y < N; y += 32) fill('#505050', 0, y, N, 3); for (let y = 0, k = 0; y < N; y += 32, k++) for (let x = (k % 2) * 40; x < N; x += 80) fill('#505050', x, y, 3, 32); }
    else if (O) fill(ormC(0.8, 0), 0, 0, N, N);
    windows(36, 16, 56, 92, '#5b5446', ['#5d7891', '#2b3b4c'], '#e4dccb');
  });
  // painted clapboard siding (tinted per house with vertex colours)
  cell('siding', () => {
    if (DAY) { g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, N, N); for (let y = 0; y < N; y += 11) { g.fillStyle = 'rgba(0,0,0,.13)'; g.fillRect(0, y, N, 2); } }
    else if (H) { for (let y = 0; y < N; y += 11) { const gr = g.createLinearGradient(0, y, 0, y + 11); gr.addColorStop(0, '#5a5a5a'); gr.addColorStop(1, '#a8a8a8'); g.fillStyle = gr; g.fillRect(0, y, N, 11); } }
    else if (O) fill(ormC(0.7, 0), 0, 0, N, N);
    windows(38, 30, 52, 66, '#fafafa', ['#6d8aa0', '#344a5c'], null, { skip: (i) => i === 1 || i === 3, litP: 0.5 });
    if (DAY) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (i % 2 === 0) { g.fillStyle = '#2f3b33'; g.fillRect(i * 128 + 18, j * 128 + 28, 14, 70); g.fillRect(i * 128 + 96, j * 128 + 28, 14, 70); }
    if (H) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (i % 2 === 0) { fill('#a0a0a0', i * 128 + 18, j * 128 + 28, 14, 70); fill('#a0a0a0', i * 128 + 96, j * 128 + 28, 14, 70); }
  });
  // glass curtain wall
  cell('glass', () => {
    if (DAY) { const grd = g.createLinearGradient(0, 0, N, N); grd.addColorStop(0, '#7fa6c2'); grd.addColorStop(1, '#2f5068'); g.fillStyle = grd; g.fillRect(0, 0, N, N); g.fillStyle = '#c8d3db'; for (let x = 0; x < N; x += 64) g.fillRect(x, 0, 5, N); for (let y = 0; y < N; y += 128) g.fillRect(0, y, N, 9); }
    else if (H) { fill('#404040', 0, 0, N, N); for (let x = 0; x < N; x += 64) fill('#b0b0b0', x, 0, 5, N); for (let y = 0; y < N; y += 128) fill('#b0b0b0', 0, y, N, 9); }
    else if (O) { fill(ormC(0.04, 0.85), 0, 0, N, N); for (let x = 0; x < N; x += 64) fill(ormC(0.35, 0.8), x, 0, 5, N); for (let y = 0; y < N; y += 128) fill(ormC(0.35, 0.8), 0, y, N, 9); }
    else for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) if (r() < 0.35) { g.fillStyle = litColor(); g.fillRect(i * 64 + 6, j * 128 + 12, 54, 112); }
  });
  cell('office', () => {
    if (DAY) { g.fillStyle = '#b8bcbf'; g.fillRect(0, 0, N, N); g.fillStyle = '#2d4356'; for (let j = 0; j < 4; j++) g.fillRect(0, j * 128 + 30, N, 64); g.fillStyle = '#9aa3a8'; for (let x = 0; x < N; x += 42) g.fillRect(x, 0, 4, N); }
    else if (H) { fill('#909090', 0, 0, N, N); for (let j = 0; j < 4; j++) fill('#303030', 0, j * 128 + 30, N, 64); for (let x = 0; x < N; x += 42) fill('#a8a8a8', x, 0, 4, N); }
    else if (O) { fill(ormC(0.6, 0.2), 0, 0, N, N); for (let j = 0; j < 4; j++) fill(ormC(0.05, 0.8), 0, j * 128 + 30, N, 64); }
    else for (let i = 0; i < 12; i++) for (let j = 0; j < 4; j++) if (r() < 0.4) { g.fillStyle = litColor(); g.fillRect(i * 42 + 5, j * 128 + 30, 34, 64); }
  });
  // strip-mall stucco / EIFS
  cell('stucco', () => {
    if (DAY) { g.fillStyle = '#e6dcc8'; g.fillRect(0, 0, N, N); noise('120,100,80', 900, 0.08); g.fillStyle = '#c9b99c'; for (let j = 0; j < 4; j++) g.fillRect(0, j * 128 + 118, N, 10); }
    else if (H) { fill('#808080', 0, 0, N, N); for (let j = 0; j < 4; j++) fill('#a8a8a8', 0, j * 128 + 118, N, 10); }
    else if (O) fill(ormC(0.92, 0), 0, 0, N, N);
    windows(40, 40, 48, 40, '#776c5c', ['#5e7487', '#36495a'], null, { litP: 0.3 });
  });
  // corrugated metal
  cell('metal', () => {
    if (DAY) { g.fillStyle = '#b4b8bb'; g.fillRect(0, 0, N, N); for (let x = 0; x < N; x += 8) { g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x, 0, 3, N); } noise('120,80,50', 300, 0.25); }
    else if (H) { for (let x = 0; x < N; x += 8) { const gr = g.createLinearGradient(x, 0, x + 8, 0); gr.addColorStop(0, '#505050'); gr.addColorStop(0.5, '#b0b0b0'); gr.addColorStop(1, '#505050'); g.fillStyle = gr; g.fillRect(x, 0, 8, N); } }
    else if (O) fill(ormC(0.45, 0.6), 0, 0, N, N);
    windows(40, 34, 48, 26, '#666', ['#6d8295', '#3b4b58'], null, { skip: (i, j) => (i + j) % 3 !== 0, litP: 0.25 });
  });
  cell('garage', () => { if (DAY) { g.fillStyle = '#d9d9d9'; g.fillRect(0, 0, N, N); for (let y = 0; y < N; y += 16) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, y, N, 2); } } else if (H) { for (let y = 0; y < N; y += 16) fill('#505050', 0, y, N, 2); } });
  cell('church', () => { bricks([160, 150, 135], '#7d766c', 0.12); if (DAY) { g.fillStyle = '#3b5a7a'; for (let i = 0; i < 2; i++) { g.fillRect(i * 256 + 98, 60, 60, 300); g.beginPath(); g.arc(i * 256 + 128, 60, 30, Math.PI, 0); g.fill(); } } else if (lit) { for (let i = 0; i < 2; i++) if (r() < 0.6) { g.fillStyle = '#ffcf7a'; g.fillRect(i * 256 + 98, 60, 60, 300); } } else if (H) { for (let i = 0; i < 2; i++) fill('#202020', i * 256 + 98, 60, 60, 300); } else if (O) { for (let i = 0; i < 2; i++) fill(ormC(0.1, 0.5), i * 256 + 98, 60, 60, 300); } });
  cell('plain', () => plainWall(() => { g.fillStyle = '#eeeeee'; g.fillRect(0, 0, N, N); noise('0,0,0', 400, 0.05); }));
  // storefronts: 3 shops across, one storey (glass, door, sign band, awning stripe)
  cell('store', () => {
    for (let i = 0; i < 3; i++) {
      const ox = i * 171;
      if (lit) { if (r() < 0.85) { g.fillStyle = litColor(); g.fillRect(ox + 10, 190, 150, 250); } if (r() < 0.7) { g.fillStyle = ['#ff5a5a', '#5ad1ff', '#ffe066', '#7cff8a', '#ff8bd8'][Math.floor(r() * 5)]; g.fillRect(ox + 16, 60, 140, 60); } continue; }
      if (H) { fill('#909090', ox, 0, 171, N); fill('#b0b0b0', ox + 16, 60, 140, 60); fill('#303030', ox + 10, 190, 150, 250); fill('#202020', ox + 100, 250, 44, 190); fill('#c0c0c0', ox + 10, 440, 150, 8); continue; }
      if (O) { fill(ormC(0.6, 0.1), ox, 0, 171, N); fill(ormC(0.05, 0.7), ox + 10, 190, 150, 250); fill(ormC(0.3, 0.2), ox + 16, 60, 140, 60); continue; }
      g.fillStyle = ['#2e3b2f', '#3a2626', '#24303d', '#3d3424', '#2a2a2a'][Math.floor(r() * 5)]; g.fillRect(ox, 0, 171, N);
      g.fillStyle = ['#c0392b', '#2471a3', '#d4ac0d', '#1e8449', '#7d3c98', '#e67e22'][Math.floor(r() * 6)]; g.fillRect(ox + 16, 60, 140, 60);
      g.fillStyle = '#f4f4f4'; for (let k = 0; k < 5; k++) g.fillRect(ox + 28 + k * 24, 82, 14, 16);
      const grd = g.createLinearGradient(0, 190, 0, 440); grd.addColorStop(0, '#9fb8c9'); grd.addColorStop(1, '#3a4f5e');
      g.fillStyle = grd; g.fillRect(ox + 10, 190, 150, 250);
      g.fillStyle = '#1b1b1b'; g.fillRect(ox + 100, 250, 44, 190); g.fillRect(ox + 10, 440, 150, 8);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(ox + 18, 200, 12, 230);
      // goods on display behind the glass
      for (let k = 0; k < 6; k++) { g.fillStyle = `hsla(${r() * 360},40%,55%,0.55)`; g.fillRect(ox + 16 + k * 13, 360 + r() * 40, 10, 40); }
      for (let s = 0; s < 8; s++) { g.fillStyle = s % 2 ? '#f2f2f2' : ['#b03a2e', '#1f618d', '#196f3d'][i]; g.fillRect(ox + 10 + s * 19, 150, 19, 30); }
    }
    if (DAY) { g.fillStyle = '#8e8e8e'; g.fillRect(0, 448, N, 64); }
  });
  cell('roof', () => { if (DAY) { g.fillStyle = '#6d6d6a'; g.fillRect(0, 0, N, N); noise('30,30,30', 2500, 0.25); noise('200,200,200', 800, 0.12); g.fillStyle = '#9b9b96'; g.fillRect(0, 0, N, 6); g.fillRect(0, 0, 6, N); } else if (O) fill(ormC(0.95, 0), 0, 0, N, N); });
  cell('shingle', () => {
    if (lit || O) { if (O) fill(ormC(0.9, 0), 0, 0, N, N); return; }
    g.fillStyle = H ? '#808080' : '#ffffff'; g.fillRect(0, 0, N, N);
    for (let y = 0, row = 0; y < N; y += 16, row++) for (let x = (row % 2) * -12; x < N; x += 24) {
      if (H) { const gr = g.createLinearGradient(0, y, 0, y + 16); gr.addColorStop(0, '#606060'); gr.addColorStop(1, '#b0b0b0'); g.fillStyle = gr; g.fillRect(x + 1, y + 1, 22, 14); continue; }
      const k = 0.72 + r() * 0.28; g.fillStyle = `rgb(${255 * k | 0},${255 * k | 0},${255 * k | 0})`; g.fillRect(x + 1, y + 1, 22, 14);
    }
  });
  // parking ramp: concrete floor slabs with open dark bays between columns
  cell('ramp', () => {
    if (lit) { for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) if (r() < 0.5) { g.fillStyle = '#ffe9b0'; g.fillRect(i * 64 + 10, j * 128 + 60, 44, 6); } return; }
    if (H) { for (let j = 0; j < 4; j++) { fill('#202020', 0, j * 128 + 34, N, 74); for (let i = 0; i < 4; i++) fill('#a0a0a0', i * 128, j * 128 + 34, 16, 74); fill('#b0b0b0', 0, j * 128 + 96, N, 12); } return; }
    if (O) return;
    g.fillStyle = '#b9b6ae'; g.fillRect(0, 0, N, N);
    for (let j = 0; j < 4; j++) { g.fillStyle = '#2a2c2e'; g.fillRect(0, j * 128 + 34, N, 74); g.fillStyle = '#a19e96'; for (let i = 0; i < 4; i++) g.fillRect(i * 128, j * 128 + 34, 16, 74); g.fillStyle = '#c9c6be'; g.fillRect(0, j * 128 + 96, N, 12); }
    noise('60,60,60', 500, 0.12);
  });
  let out = c;
  if (size !== N * 4) { out = document.createElement('canvas'); out.width = out.height = size; out.getContext('2d').drawImage(c, 0, 0, size, size); }
  if (H) out = heightToNormal(out);
  const t = new THREE.CanvasTexture(out);
  t.colorSpace = DAY || lit ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
// grey height -> tangent-space normal map (Sobel), strength in "pixels per unit height"
function heightToNormal(cv, strength = 2.2) {
  const w = cv.width, h = cv.height, src = cv.getContext('2d').getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const ctx = out.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  const H = (x, y) => src[((Math.min(h - 1, Math.max(0, y)) * w) + Math.min(w - 1, Math.max(0, x))) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return out;
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
    if (m.userData.orm) {
      // roughness (G) and metalness (B) per atlas cell: glass and frames shine, brick stays matte
      sh.uniforms.ormMap = { value: m.userData.orm };
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D ormMap;')
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n{ vec4 ormT = ${sample('ormMap')}; roughnessFactor *= ormT.g / 0.88; metalnessFactor = ormT.b; }`);
    }
    if (m.normalMap) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('texture2D( normalMap, vNormalMapUv )', sample('normalMap')));
  };
  m.customProgramCacheKey = () => 'atlas2' + (m.normalMap ? 'n' : '') + (m.userData.orm ? 'o' : '');
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
// Weather on the city's surfaces: wet roads go dark and glossy with puddles that mirror the sky and
// headlights; snow settles on anything facing up (roofs, lawns, and a thinner, slushy layer on roads).
export const WX = { wet: { value: 0 }, snow: { value: 0 }, puddles: { value: null } };
function puddleTex() {
  const n = 256, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), r = rng(91);
  g.fillStyle = '#000'; g.fillRect(0, 0, n, n);
  g.filter = 'blur(6px)';
  for (let k = 0; k < 70; k++) {
    const x = r() * n, y = r() * n, rad = 6 + r() * 22;
    for (const [ox, oy] of [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n]]) { g.fillStyle = `rgba(255,255,255,${0.5 + r() * 0.5})`; g.beginPath(); g.ellipse(x + ox, y + oy, rad * (1 + r()), rad, r() * 3, 0, 7); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; return t;
}
function weatherPatch(m, kind) {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(m, sh, r);
    sh.uniforms.wxWet = WX.wet; sh.uniforms.wxSnow = WX.snow; sh.uniforms.wxPud = WX.puddles;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWxN; varying vec2 vWxP;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvWxN = normalize(mat3(modelMatrix) * objectNormal);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWxP = (modelMatrix * vec4(position, 1.0)).xz;');
    const road = kind === 'road', walk = kind === 'walk';
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float wxWet; uniform float wxSnow; uniform sampler2D wxPud; varying vec3 vWxN; varying vec2 vWxP;')
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        {
          float up = smoothstep(0.55, 0.9, normalize(vWxN).y);
          ${road || walk ? `
          float pud = texture2D(wxPud, vWxP * 0.045).r;
          float wk = wxWet * (1.0 - wxSnow) * (${road ? '0.6 + 0.4 * pud' : '0.45 + 0.3 * pud'});
          roughnessFactor = mix(roughnessFactor, ${road ? '0.06' : '0.22'}, wk);
          diffuseColor.rgb *= 1.0 - ${road ? '0.5' : '0.3'} * wk;` : kind === 'ground' ? `
          diffuseColor.rgb *= 1.0 - 0.22 * wxWet * (1.0 - wxSnow);` : ''}
          float sn = wxSnow * up * ${road ? '(0.55 + 0.25 * texture2D(wxPud, vWxP * 0.11).r)' : kind === 'roof' ? '1.0' : '0.95'};
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.98), sn);
          roughnessFactor = mix(roughnessFactor, 0.75, sn);
        }`);
  };
  m.customProgramCacheKey = () => prevKey + 'wx-' + kind;
  return m;
}
// Crop rows (30-inch corn/soy rows, tinted per field by vertex colour); u runs across the rows, 1 unit = 1 row.
function cropTex() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#6e5a46'; g.fillRect(0, 0, 32, 64);
  g.fillStyle = '#ffffff'; g.fillRect(6, 0, 20, 64);
  g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < 64; y += 4) g.fillRect(8 + ((y * 7) % 5), y, 16, 2);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
// House night life in one material: porch lamps, TV / lamp glow in windows, Christmas lights when it snows,
// neon. Vertex 'atlas' = (kind, phase): 0 porch, 1 window glow, 2 Christmas bulbs (uv.x counts bulbs), 3 neon.
export const GLOW = { night: { value: 0 }, time: { value: 0 } };
function glowMaterial() {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.gNight = GLOW.night; sh.uniforms.gTime = GLOW.time; sh.uniforms.gSnow = WX.snow;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 atlas; varying vec2 vK; varying vec2 vGUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvK = atlas; vGUv = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float gNight; uniform float gTime; uniform float gSnow; varying vec2 vK; varying vec2 vGUv;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float k = vK.x, ph = vK.y; vec3 c = diffuseColor.rgb;
        if (k < 0.5) { c = mix(c, vec3(1.0, 0.8, 0.5) * 2.2, gNight * step(ph, 0.85)); }
        else if (k < 1.5) {
          float on = gNight * step(ph, 0.55); if (on < 0.02) discard;
          float fl = 0.65 + 0.35 * sin(gTime * 9.0 + ph * 40.0) * sin(gTime * 2.7 + ph * 17.0);
          c = ph < 0.3 ? vec3(0.4, 0.6, 1.0) * 1.3 * fl : vec3(1.0, 0.78, 0.5) * 1.25;
          c *= on;
        } else if (k < 2.5) {
          if (gSnow < 0.15) discard;
          if (fract(vGUv.x) > 0.45) discard;
          float i = mod(floor(vGUv.x), 5.0);
          vec3 b = i < 1.0 ? vec3(1.0, 0.15, 0.1) : i < 2.0 ? vec3(0.1, 1.0, 0.25) : i < 3.0 ? vec3(0.2, 0.4, 1.0) : i < 4.0 ? vec3(1.0, 0.8, 0.15) : vec3(1.0, 0.3, 0.8);
          c = b * (0.45 + gNight * 2.2 * (0.75 + 0.25 * sin(gTime * 3.0 + floor(vGUv.x) * 1.7)));
        } else { c *= 0.5 + gNight * 1.8; }
        diffuseColor.rgb = c;
      }`);
  };
  m.customProgramCacheKey = () => 'houseGlow';
  return m;
}
export const M = {};
export function initMaterials(quality = 'medium') {
  if (M.building) return M;
  const day = atlas('day'), night = atlas('lit');
  const bm = new THREE.MeshStandardMaterial({ map: day, emissiveMap: night, emissive: 0xffd9a0, emissiveIntensity: 0, vertexColors: true, roughness: 0.88, metalness: 0 });
  if (quality !== 'low') { bm.normalMap = atlas('height', 1024); bm.normalScale.set(1, 1); bm.userData.orm = atlas('orm', 512); }
  M.building = atlasPatch(bm);
  M.terrain = new THREE.MeshStandardMaterial({ vertexColors: true, map: noiseTex(256, '#d8d8d8', 0.18, 3), roughness: 0.95 });
  M.road = new THREE.MeshStandardMaterial({ vertexColors: true, map: noiseTex(256, '#bdbdbd', 0.22, 4, (g, s) => { g.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(Math.random() * s, 0); g.lineTo(Math.random() * s, s); g.lineWidth = 1; g.strokeStyle = 'rgba(30,30,30,.25)'; g.stroke(); } }), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -20 });
  M.walk = new THREE.MeshStandardMaterial({ vertexColors: true, map: noiseTex(128, '#e4e1db', 0.12, 5, (g, s) => { g.fillStyle = 'rgba(80,80,80,.35)'; g.fillRect(0, 0, s, 2); g.fillRect(0, 0, 2, s); }), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -6 });
  M.mark = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -30 });
  // ground layers, bottom to top, each a clear step of depth offset apart (a few cm of lift alone fights at 150 m+):
  // terrain < crops -2 < sidewalks -6 < lots/driveways/aisles -10 < minor roads -14 < major roads + junctions -20 < paint -30
  M.lot = M.road.clone(); M.lot.polygonOffsetFactor = -1; M.lot.polygonOffsetUnits = -10;
  M.roadLo = M.road.clone(); M.roadLo.polygonOffsetUnits = -14;
  M.lod = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }); // far-LOD buildings (tile.js buildTileLite)
  M.signs = new THREE.MeshStandardMaterial({ map: signAtlas(false), emissiveMap: signAtlas(true), emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.graffiti = new THREE.MeshStandardMaterial({ map: graffitiAtlas(), transparent: true, alphaTest: 0.3, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.rail = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -24 });
  M.water = new THREE.MeshStandardMaterial({ color: 0x3f6f7a, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.93 });
  M.far = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  M.farBox = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, emissive: 0xffc070, emissiveIntensity: 0 });
  // area-realism detail (src/city/areas.js): merged per tile, one draw call each
  M.wire = new THREE.LineBasicMaterial({ color: 0x23211f });
  M.crop = new THREE.MeshStandardMaterial({ vertexColors: true, map: cropTex(), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  // every text panel in one material: vertex 'atlas'.x = 1 glows at night (neon / shop / pylon), 0 doesn't (street, ghost signs)
  M.names = new THREE.MeshStandardMaterial({ map: nameTexture(), emissiveMap: nameTexture(), emissive: 0xffffff, emissiveIntensity: 0, alphaTest: 0.5, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.names.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 atlas; varying float vEm;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvEm = atlas.x;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vEm;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vEm;');
  };
  M.names.customProgramCacheKey = () => 'namesGlow';
  M.namesLit = M.names;
  M.glow = glowMaterial();
  WX.puddles.value = puddleTex();
  weatherPatch(M.crop, 'ground'); weatherPatch(M.building, 'roof'); weatherPatch(M.terrain, 'ground'); weatherPatch(M.road, 'road'); weatherPatch(M.roadLo, 'road'); weatherPatch(M.lot, 'road'); weatherPatch(M.lod, 'roof'); weatherPatch(M.walk, 'walk'); weatherPatch(M.far, 'ground'); weatherPatch(M.farBox, 'roof');
  return M;
}
