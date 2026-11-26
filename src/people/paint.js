// The people atlas: every face, outfit, shoe, hair and hat texture painted once at startup into one
// 2048x2048 texture (8x8 cells of 256 px), so a whole crowd shares one texture.
// RGB holds the painted detail; alpha says how each pixel is coloured in the shader:
//   255 = the region's main colour (tint A)   204 = its second colour (tint B)
//   153 = the person's skin tone              102 = no tint (the painted colour as is)
// Body UVs: u = region + local u, v = local v (see assets/src/people.py).
import * as THREE from 'three';

// 8 x 12 cells: the first 64 are the original layout, the rest hold the newer faces, tops, bottoms and hats
export const ROWS = 12;
export const CELL = {
  face: (f, scared) => (f < 10 ? (scared ? 10 : 0) + f : 64 + (f - 10) * 2 + (scared ? 1 : 0)), ski: 20, tim: 21, mascotFace: 22, skin: 23, hair: 24, hat: 25, hatPolice: 26,
  fixed: 27, tattoo: 28, shoeBoot: 31, top: (i) => (i < 20 ? 32 + i : 72 + i - 20), bottom: (i) => (i < 10 ? 52 + i : 82 + i - 10), shoe: (i) => (i === 2 ? 31 : 62 + i),
  trucker: 84,
};
const S = 256, N = 8, SIZE = S * N, SIZEY = S * ROWS;
const A = 255, B = 204, K = 153, F = 102;

let g, m; // colour + mask contexts
let ox = 0, oy = 0; // current cell origin
const rnd = mulberry(1234);
function mulberry(a) { return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gray = (v) => `rgb(${v},${v},${v})`;
// each cell keeps a PAD border (filled by stretching its edge pixels) so mipmaps don't bleed in the neighbouring cell
export const PAD = 0.06;
const X = (u) => ox + (PAD + u * (1 - 2 * PAD)) * S, Y = (v) => oy + (PAD + (1 - v) * (1 - 2 * PAD)) * S;
function bleed(c, cols, rows) {
  const p = Math.round(PAD * S), q = S - 2 * p;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const x = k * S, y = r * S;
    c.drawImage(c.canvas, x + p, y, 1, S, x, y, p, S); c.drawImage(c.canvas, x + p + q - 1, y, 1, S, x + p + q, y, p, S);
    c.drawImage(c.canvas, x, y + p, S, 1, x, y, S, p); c.drawImage(c.canvas, x, y + p + q - 1, S, 1, x, y + p + q, S, p);
  }
}
function cell(i) { ox = (i % N) * S; oy = Math.floor(i / N) * S; }
// paint a shape into both canvases: col = css colour (or grey level 0-255), lvl = mask level
function paint(lvl, col, fn) {
  g.fillStyle = typeof col === 'number' ? gray(col) : col; m.fillStyle = gray(lvl);
  g.strokeStyle = g.fillStyle; m.strokeStyle = m.fillStyle;
  fn(g); fn(m);
}
// (snapped to whole pixels: anti-aliased edges between two fills would blend mask levels into a different tint)
const rect = (lvl, col, u0, v0, u1, v1) => paint(lvl, col, (c) => { const x0 = Math.round(X(u0)), y0 = Math.round(Y(v1)); c.fillRect(x0, y0, Math.round(X(u1)) - x0, Math.round(Y(v0)) - y0); });
const ell = (lvl, col, u, v, ru, rv, rot = 0) => paint(lvl, col, (c) => { c.beginPath(); c.ellipse(X(u), Y(v), ru * S, rv * S, rot, 0, 7); c.fill(); });
const line = (lvl, col, pts, w) => paint(lvl, col, (c) => { c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach(([u, v], i) => (i ? c.lineTo(X(u), Y(v)) : c.moveTo(X(u), Y(v)))); c.stroke(); });
const poly = (lvl, col, pts) => paint(lvl, col, (c) => { c.beginPath(); pts.forEach(([u, v], i) => (i ? c.lineTo(X(u), Y(v)) : c.moveTo(X(u), Y(v)))); c.closePath(); c.fill(); });
// colour-only touches (shading, folds, noise) that keep the mask as is
function shade(fn, alpha = 1, op = 'source-over') { g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = op; fn(g); g.restore(); }
const darken = (u0, v0, u1, v1, a) => shade((c) => { c.fillStyle = '#000'; c.fillRect(X(u0), Y(v1), X(u1) - X(u0), Y(v0) - Y(v1)); }, a);
function grad(u0, v0, u1, v1, stops, a = 1) { shade((c) => { const gr = c.createLinearGradient(X(u0), Y(v0), X(u1), Y(v1)); for (const [o, col] of stops) gr.addColorStop(o, col); c.fillStyle = gr; c.fillRect(ox, oy, S, S); }, a); }
function radial(u, v, r, col, a = 1) { shade((c) => { const gr = c.createRadialGradient(X(u), Y(v), 0, X(u), Y(v), r * S); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(ox, oy, S, S); }, a); }
let noiseCanvas;
function noise(a = 0.12, scale = 1) {
  shade((c) => { c.drawImage(noiseCanvas, 0, 0, 256 / scale, 256 / scale, ox, oy, S, S); }, a, 'overlay');
}
function makeNoise() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'), d = x.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) { const v = 90 + rnd() * 76; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0); return c;
}
// soft fabric folds: a few darker bands
function folds(u0, u1, v0, v1, n = 5, a = 0.12, diag = 0.3) {
  shade((c) => {
    for (let k = 0; k < n; k++) {
      const u = u0 + (u1 - u0) * rnd(), v = v0 + (v1 - v0) * rnd(), len = 0.06 + rnd() * 0.12;
      const gr = c.createLinearGradient(X(u - 0.02), 0, X(u + 0.02), 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.strokeStyle = gr; c.lineWidth = 3 + rnd() * 5; c.beginPath(); c.moveTo(X(u), Y(v)); c.lineTo(X(u + (rnd() - 0.5) * diag * len), Y(v - len)); c.stroke();
    }
  }, a);
}
const stitch = (pts) => shade((c) => { c.setLineDash([3, 3]); c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1.2; c.beginPath(); pts.forEach(([u, v], i) => (i ? c.lineTo(X(u), Y(v)) : c.moveTo(X(u), Y(v)))); c.stroke(); });

// ---------------- faces ----------------
const FACE = [ // eye spacing, eye size, brow thick, nose width, lip width, lip full, age, stubble, iris
  { es: 0.105, ez: 1.0, bt: 1.2, nw: 1.0, lw: 1.0, lf: 0.8, age: 0, stub: 0.6, iris: '#4b2e1e' },
  { es: 0.11, ez: 0.9, bt: 1.5, nw: 1.2, lw: 1.1, lf: 1.0, age: 0.2, stub: 0, iris: '#2d1d14' },
  { es: 0.1, ez: 1.05, bt: 1.0, nw: 0.9, lw: 0.9, lf: 0.7, age: 0, stub: 0, iris: '#3f6f9a' },
  { es: 0.112, ez: 0.95, bt: 1.3, nw: 1.25, lw: 1.15, lf: 1.2, age: 0.4, stub: 0.9, iris: '#2a1a10' },
  { es: 0.104, ez: 0.85, bt: 1.4, nw: 1.05, lw: 1.0, lf: 0.8, age: 1, stub: 0.3, iris: '#556b3a' },
  { es: 0.108, ez: 1.0, bt: 1.1, nw: 1.0, lw: 1.05, lf: 0.9, age: 0.6, stub: 0, iris: '#3b2a1d' },
  { es: 0.106, ez: 1.12, bt: 0.75, nw: 0.85, lw: 0.95, lf: 1.1, age: 0, stub: 0, iris: '#4a3020', fem: 1 },
  { es: 0.11, ez: 1.08, bt: 0.8, nw: 0.95, lw: 1.05, lf: 1.3, age: 0, stub: 0, iris: '#2b1b12', fem: 1 },
  { es: 0.104, ez: 1.15, bt: 0.7, nw: 0.85, lw: 0.9, lf: 1.0, age: 0.1, stub: 0, iris: '#3c79a8', fem: 1 },
  { es: 0.108, ez: 1.0, bt: 0.85, nw: 0.95, lw: 1.0, lf: 0.9, age: 0.8, stub: 0, iris: '#5a4a35', fem: 1 },
  // 10 teen boy (smooth, no stubble, a few freckles), 11 teen girl, 12 older man (lined, heavy brows), 13 woman with freckles
  { es: 0.11, ez: 1.08, bt: 0.95, nw: 0.92, lw: 0.95, lf: 0.85, age: 0, stub: 0, iris: '#3f6f9a', teen: 1, freck: 0.5 },
  { es: 0.11, ez: 1.14, bt: 0.7, nw: 0.85, lw: 0.92, lf: 1.05, age: 0, stub: 0, iris: '#4b3524', fem: 1, teen: 1 },
  { es: 0.112, ez: 0.88, bt: 1.6, nw: 1.15, lw: 1.05, lf: 0.75, age: 1.2, stub: 0.4, iris: '#5d7183' },
  { es: 0.112, ez: 1.05, bt: 0.8, nw: 0.9, lw: 1.0, lf: 1.1, age: 0.15, stub: 0, iris: '#58703f', fem: 1, freck: 1 },
];
for (const f of FACE) f.es = 0.112 + (f.es - 0.106) * 0.4; // eyes sit in the sculpted sockets (people.py)
// face cell coordinates (u around the head, 0.5 = front; v up). Key heights:
const EYE = 0.54, BROW = 0.6, NOSE = 0.45, MOUTH = 0.37, CHIN = 0.27;
function faceBase() {
  rect(K, 236, 0, 0, 1, 1);
  noise(0.06, 1.5);
  // gentle form shading: lighter forehead and cheeks, darker temples, under the jaw and the back
  radial(0.5, 0.72, 0.28, 'rgba(255,255,255,0.18)');
  radial(0.5, 0.46, 0.22, 'rgba(255,255,255,0.12)');
  grad(0.5, 0, 0.5, 0.3, [[0, 'rgba(60,30,20,0.4)'], [1, 'rgba(0,0,0,0)']]);
  for (const s of [-1, 1]) radial(0.5 + s * 0.2, 0.55, 0.08, 'rgba(70,40,30,0.18)');
}
function eye(cu, v, f, scared, s) {
  const w = 0.062 * f.ez * (scared ? 1.1 : 1), h = 0.032 * f.ez * (scared ? 1.45 : 1);
  radial(cu, v + 0.004, 0.08, 'rgba(60,30,30,0.4)'); // socket shadow
  if (f.fem) radial(cu, v + 0.012, 0.045, 'rgba(120,70,110,0.25)'); // eye shadow
  ell(F, '#ece8e2', cu, v, w, h);
  ell(F, f.iris, cu + s * 0.002, v - 0.001, h * 0.95, h * 0.95);
  ell(F, '#0d0b0a', cu + s * 0.002, v - 0.001, h * 0.42, h * 0.42);
  ell(F, '#ffffff', cu + s * 0.002 - 0.006, v + 0.006, h * 0.22, h * 0.22);
  // upper lid + lashes, lower lid
  line(F, f.fem ? '#120c0a' : '#2a1a14', [[cu - w, v - 0.002], [cu - w * 0.4, v + h * 0.95], [cu + w * 0.4, v + h * 0.95], [cu + w, v - 0.002]], f.fem ? 6 : 5);
  if (f.fem) line(F, '#120c0a', [[cu + s * w, v + 0.002], [cu + s * (w + 0.012), v + 0.012]], 2);
  line(K, 200, [[cu - w * 0.8, v - h * 0.9], [cu + w * 0.8, v - h * 0.9]], 1.4);
}
function brow(cu, v, f, scared, angry, s) {
  const t = 10 * f.bt, w = 0.07;
  const inner = scared ? 0.025 : angry ? -0.02 : 0, outer = scared ? -0.005 : angry ? 0.012 : 0.004;
  line(B, f.fem ? 95 : 70, [[cu - s * w, v + inner], [cu, v + 0.012 + (inner + outer) / 2], [cu + s * w, v + outer]], t);
}
function paintFace(i, scared) {
  const f = FACE[i];
  faceBase();
  if (f.stub) { // stubble: a soft blue-grey shadow over the jaw and upper lip (PS2 style), with a fine grain
    shade((c) => { c.fillStyle = `rgba(45,45,60,${0.3 * f.stub})`; c.beginPath(); c.ellipse(X(0.5), Y(0.3), 0.21 * S, 0.12 * S, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(X(0.5), Y(0.4), 0.07 * S, 0.025 * S, 0, 0, 7); c.fill(); });
    shade((c) => { c.fillStyle = 'rgba(30,30,40,0.25)'; for (let k = 0; k < 2500 * f.stub; k++) { const u = 0.5 + (rnd() - 0.5) * 0.42, v = 0.2 + rnd() * 0.22, dx = (u - 0.5) / 0.21, dv = (v - 0.3) / 0.12; if (v < 0.4 && dx * dx + dv * dv > 1.2) continue; if (v > 0.4 && Math.abs(u - 0.5) > 0.07) continue; c.fillRect(X(u), Y(v), 1, 1); } });
  }
  if (f.age) {
    for (let k = 0; k < 3; k++) line(K, 196, [[0.42, 0.72 + k * 0.025], [0.5, 0.725 + k * 0.025], [0.58, 0.72 + k * 0.025]], 1.2 * f.age + 0.4);
    for (const s of [-1, 1]) line(K, 190, [[0.5 + s * 0.045, NOSE - 0.005], [0.5 + s * 0.065, MOUTH - 0.01]], 1.6 * f.age + 0.5);
  }
  for (const s of [-1, 1]) {
    const cu = 0.5 + s * f.es;
    eye(cu, EYE, f, scared, s);
    brow(cu, BROW, f, scared, false, s);
  }
  // nose: shadow on the sides, highlight down the ridge, nostrils
  // (the nose is sculpted: only a little colour at the tip and the nostrils)
  const nw = 0.034 * f.nw;
  radial(0.5, NOSE, 0.03, 'rgba(190,80,70,0.12)');
  for (const s of [-1, 1]) ell(K, 110, 0.5 + s * nw * 0.5, NOSE - 0.016, 0.009, 0.005);
  if (f.freck) for (let k = 0; k < 160 * f.freck; k++) { const u = 0.5 + (rnd() - 0.5) * 0.36, v = 0.42 + rnd() * 0.12; if (Math.abs(u - 0.5) < 0.03 && v > 0.47) continue; ell(K, 150 + rnd() * 30, u, v, 0.0025, 0.0025); }
  if (f.teen) radial(0.5, 0.45, 0.2, 'rgba(255,255,255,0.06)');
  line(K, 200, [[0.48, CHIN + 0.035], [0.52, CHIN + 0.035]], 2);
  // cheeks
  for (const s of [-1, 1]) radial(0.5 + s * 0.1, 0.45, 0.07, f.fem ? 'rgba(220,90,90,0.3)' : 'rgba(200,90,80,0.15)');
  // mouth
  const lw = 0.064 * f.lw, lf = f.lf * 1.35;
  if (scared) {
    ell(F, '#3a1414', 0.5, MOUTH - 0.004, lw * 0.75, 0.026);
    rect(F, '#f1ece2', 0.5 - lw * 0.55, MOUTH + 0.01, 0.5 + lw * 0.55, MOUTH + 0.019);
    line(K, f.fem ? 175 : 190, [[0.5 - lw * 0.85, MOUTH], [0.5, MOUTH + 0.026], [0.5 + lw * 0.85, MOUTH]], 3);
  } else {
    const lip = f.fem ? '#a83a4e' : 'rgb(190,128,118)';
    const lvl = f.fem ? F : K;
    poly(lvl, lip, [[0.5 - lw, MOUTH], [0.5 - lw * 0.4, MOUTH + 0.012 * lf], [0.5, MOUTH + 0.008 * lf], [0.5 + lw * 0.4, MOUTH + 0.012 * lf], [0.5 + lw, MOUTH], [0.5, MOUTH - 0.004]]);
    poly(lvl, lip, [[0.5 - lw * 0.9, MOUTH], [0.5, MOUTH - 0.004], [0.5 + lw * 0.9, MOUTH], [0.5 + lw * 0.5, MOUTH - 0.016 * lf], [0.5 - lw * 0.5, MOUTH - 0.016 * lf]]);
    line(f.fem ? F : K, f.fem ? '#4a1720' : 'rgb(95,50,45)', [[0.5 - lw, MOUTH], [0.5, MOUTH - 0.003], [0.5 + lw, MOUTH]], 2.6);
  }
  radial(0.5, CHIN + 0.02, 0.05, 'rgba(255,255,255,0.12)');
}
function paintSkiMask() {
  rect(F, '#202124', 0, 0, 1, 1); noise(0.35, 3);
  for (let k = 0; k < 40; k++) shade((c) => { c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(X(rnd()), oy, 2, S); });
  for (const s of [-1, 1]) { ell(K, 225, 0.5 + s * 0.105, EYE, 0.065, 0.04); }
  const f = FACE[1];
  for (const s of [-1, 1]) eye(0.5 + s * 0.105, EYE, f, false, s);
  ell(K, 210, 0.5, MOUTH, 0.06, 0.03); line(K, 150, [[0.45, MOUTH], [0.55, MOUTH]], 2);
}
function paintTimMask() {
  rect(F, '#f2c9a5', 0, 0, 1, 1); noise(0.05);
  rect(F, '#3a2412', 0, 0.68, 1, 1); // painted-on slick hair
  poly(F, '#3a2412', [[0.3, 0.68], [0.6, 0.66], [0.75, 0.7], [0.3, 0.72]]);
  line(F, '#f2c9a5', [[0.43, 0.97], [0.47, 0.72]], 3); // parting
  for (const s of [-1, 1]) {
    ell(F, '#ffffff', 0.5 + s * 0.1, EYE, 0.05, 0.035); ell(F, '#3b6fb0', 0.5 + s * 0.1, EYE, 0.022, 0.022); ell(F, '#000', 0.5 + s * 0.1, EYE, 0.01, 0.01);
    line(F, '#3a2412', [[0.5 + s * 0.05, BROW + 0.02], [0.5 + s * 0.15, BROW + 0.035]], 6);
    ell(F, '#f0a090', 0.5 + s * 0.13, 0.43, 0.04, 0.025);
  }
  ell(F, '#e8a88f', 0.5, NOSE + 0.01, 0.03, 0.045);
  paint(F, '#7a1d1d', (c) => { c.beginPath(); c.ellipse(X(0.5), Y(MOUTH + 0.01), 0.12 * S, 0.07 * S, 0, 0, Math.PI); c.fill(); });
  rect(F, '#ffffff', 0.4, MOUTH - 0.005, 0.6, MOUTH + 0.01);
  g.save(); g.fillStyle = '#1d3c78'; g.font = `900 ${S * 0.09}px Impact, Arial Black`; g.textAlign = 'center';
  g.fillText('VOTE TIM', X(0.05), Y(0.55)); g.fillText('VOTE TIM', X(0.95), Y(0.55)); g.restore();
}
function paintMascotFace() {
  rect(F, '#8c8f94', 0, 0, 1, 1); noise(0.3, 2);
  ell(F, '#d9d4cb', 0.5, 0.42, 0.13, 0.14);
  for (const s of [-1, 1]) { ell(F, '#ffffff', 0.5 + s * 0.08, 0.6, 0.06, 0.06); ell(F, '#111', 0.5 + s * 0.07, 0.59, 0.03, 0.035); ell(F, '#fff', 0.5 + s * 0.06, 0.61, 0.01, 0.01); }
  ell(F, '#e07a8a', 0.5, 0.47, 0.035, 0.025);
  rect(F, '#fff8e8', 0.47, 0.3, 0.495, 0.37); rect(F, '#fff8e8', 0.505, 0.3, 0.53, 0.37);
  line(F, '#2a2a2a', [[0.42, 0.38], [0.5, 0.36], [0.58, 0.38]], 3);
}

// ---------------- tops (torso u 0..0.6, front at 0.3; left arm 0.6..0.8, right 0.8..1; v up) ----------------
const ARM_L = [0.6, 0.8], ARM_R = [0.8, 1.0];
function topBase(lvl = A, col = 225, sleeve = 1) {
  rect(lvl, col, 0, 0, 0.6, 1);
  for (const [a0, a1] of [ARM_L, ARM_R]) { rect(lvl, col, a0, 1 - sleeve, a1, 1); if (sleeve < 1) rect(K, 232, a0, 0, a1, 1 - sleeve); }
  noise(0.1);
  folds(0.05, 0.55, 0.15, 0.9, 7, 0.17);
  // baked PS2-style shading: lit chest, darker sides and armpits, the back a touch darker
  shade((c) => { const gr = c.createLinearGradient(X(0), 0, X(0.6), 0); for (const [o, a] of [[0, 0.22], [0.25, 0.3], [0.38, 0.05], [0.5, 0.0], [0.62, 0.05], [0.75, 0.3], [1, 0.22]]) gr.addColorStop(o, `rgba(0,0,0,${a})`); c.fillStyle = gr; c.fillRect(X(0), Y(1), X(0.6) - X(0), Y(0) - Y(1)); });
  radial(0.3, 0.72, 0.16, 'rgba(255,255,255,0.16)');
  for (const u of [0.15, 0.45]) radial(u, 0.9, 0.07, 'rgba(0,0,0,0.3)');
  for (const [a0, a1] of [ARM_L, ARM_R]) shade((c) => { const gr = c.createLinearGradient(X(a0), 0, X(a1), 0); gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)'); c.fillStyle = gr; c.fillRect(X(a0), Y(1), X(a1) - X(a0), Y(1 - sleeve) - Y(1)); });
  for (const s of [0.15, 0.45]) stitch([[s, 0.02], [s, 0.95]]); // side seams
  darken(0, 0, 0.6, 0.04, 0.12); // hem
  // armpit / sleeve creases
  for (const [a0, a1] of [ARM_L, ARM_R]) folds(a0 + 0.02, a1 - 0.02, 1 - sleeve + 0.05, 0.95, 3, 0.1, 0.8);
}
function collar(lvl = A, col = 200, depth = 0.05) { poly(lvl, col, [[0.25, 1], [0.3, 1 - depth], [0.35, 1]]); }
function vneck(depth = 0.14, lvl = K, col = 232) { poly(lvl, col, [[0.26, 1], [0.3, 1 - depth], [0.34, 1]]); }
function buttons(col = '#e8e6e0', n = 7, top = 0.92, v0 = 0.05) { for (let k = 0; k < n; k++) ell(F, col, 0.3, top - k * (top - v0) / (n - 1), 0.006, 0.006); }
function placket() { line(A, 200, [[0.3, 0.98], [0.3, 0.02]], 5); shade((c) => { c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(X(0.307), Y(0.98)); c.lineTo(X(0.307), Y(0.02)); c.stroke(); }); }
function shirtCollar(lvl = A, col = 238) { for (const s of [-1, 1]) poly(lvl, col, [[0.3, 0.985], [0.3 + s * 0.08, 1], [0.3 + s * 0.065, 0.92]]); }
function cuffs(v = 0.0, h = 0.05, lvl = A, col = 200) { for (const [a0, a1] of [ARM_L, ARM_R]) rect(lvl, col, a0, v, a1, v + h); }
function pocket(u, v, w = 0.05, h = 0.07, lvl = A, col = 210) { rect(lvl, col, u - w / 2, v - h, u + w / 2, v); stitch([[u - w / 2, v], [u - w / 2, v - h], [u + w / 2, v - h], [u + w / 2, v]]); }
function text(str, u, v, size, col = '#fff', lvl = F, font = 'Arial Black') {
  // (u runs right-to-left across the front of the body and hats, so text is drawn mirrored to read the right way)
  for (const c of [g, m]) { c.save(); c.font = `900 ${size * S}px ${font}, Impact`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = c === g ? col : gray(lvl); c.translate(X(u), Y(v)); c.scale(-1, 1); c.fillText(str, 0, 0); c.restore(); }
}
function reflective(v0, v1, col = '#d8dbe0', armsToo = true) {
  rect(F, col, 0, v0, 0.6, v1);
  if (armsToo) for (const [a0, a1] of [ARM_L, ARM_R]) rect(F, col, a0, v0 - 0.25, a1, v1 - 0.25);
  shade((c) => { c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(X(0), Y(v1), X(0.6) - X(0), 2); });
}
const TOP_PAINT = {
  tee: () => { topBase(A, 228, 0.3); collar(K, 232, 0.035); line(A, 205, [[0.24, 1], [0.3, 0.955], [0.36, 1]], 4); for (const [a0, a1] of [ARM_L, ARM_R]) darken(a0, 0.7, a1, 0.72, 0.2); },
  tank: () => { topBase(A, 228, 0); for (const s of [0, 0.45]) rect(K, 232, s, 0.82, s + 0.15, 1); vneck(0.12); },
  polo: () => { topBase(A, 225, 0.3); shirtCollar(B, 230); placket(); buttons('#f4f2ec', 3, 0.94, 0.78); cuffs(0.7, 0.04, B, 225); },
  shirt_s: () => { topBase(A, 232, 0.3); shirtCollar(); placket(); buttons(); pocket(0.37, 0.8); },
  shirt_l: () => { topBase(A, 235, 1); shirtCollar(); placket(); buttons(); cuffs(0, 0.06); pocket(0.37, 0.8); if (rnd() < 0.5) { poly(B, 140, [[0.29, 0.96], [0.31, 0.96], [0.32, 0.5], [0.3, 0.45], [0.28, 0.5]]); } },
  hoodie: () => { topBase(A, 222, 1); rect(A, 200, 0, 0.88, 0.12, 1); rect(A, 200, 0.48, 0.88, 0.6, 1); poly(A, 190, [[0.18, 0.4], [0.42, 0.4], [0.45, 0.12], [0.15, 0.12]]); stitch([[0.18, 0.4], [0.15, 0.12], [0.45, 0.12], [0.42, 0.4]]); for (const s of [-1, 1]) line(F, '#eeeeee', [[0.3 + s * 0.02, 0.97], [0.3 + s * 0.025, 0.8]], 3); cuffs(0, 0.06, A, 195); rect(A, 195, 0, 0, 0.6, 0.06); },
  zip: () => { topBase(A, 215, 1); rect(B, 230, 0.27, 0.0, 0.33, 0.98); line(F, '#9aa0a6', [[0.27, 0.98], [0.27, 0.02]], 2.2); shirtCollar(A, 200); cuffs(0, 0.06, A, 190); pocket(0.2, 0.35, 0.06, 0.12, A, 205); pocket(0.4, 0.35, 0.06, 0.12, A, 205); },
  suit: () => { topBase(A, 205, 1); poly(B, 245, [[0.24, 1], [0.36, 1], [0.32, 0.55], [0.3, 0.5], [0.28, 0.55]]); poly(F, '#6b1d24', [[0.293, 0.96], [0.307, 0.96], [0.314, 0.6], [0.3, 0.55], [0.286, 0.6]]); for (const s of [-1, 1]) line(A, 160, [[0.3 + s * 0.07, 1], [0.3 + s * 0.04, 0.55]], 3); buttons('#222', 2, 0.42, 0.3); pocket(0.2, 0.75, 0.05, 0.01, A, 170); cuffs(0, 0.03, B, 245); },
  sweater: () => { topBase(A, 220, 1); collar(K, 232, 0.03); line(A, 195, [[0.24, 1], [0.3, 0.96], [0.36, 1]], 6); rect(A, 190, 0, 0, 0.6, 0.08); cuffs(0, 0.08, A, 190); for (let k = 0; k < 60; k++) shade((c) => { c.fillStyle = 'rgba(0,0,0,0.06)'; c.fillRect(ox + rnd() * S, oy, 1, S); }); if (rnd() < 0.6) rect(B, 225, 0, 0.62, 0.6, 0.72); },
  flannel: () => { topBase(A, 225, 1); for (let k = 0; k < 9; k++) { rect(B, 210, 0, k * 0.12, 1, k * 0.12 + 0.035); rect(B, 210, k * 0.11, 0, k * 0.11 + 0.03, 1); } shade((c) => { c.fillStyle = 'rgba(0,0,0,0.15)'; for (let k = 0; k < 30; k++) c.fillRect(ox + k * 9, oy, 1, S); }); shirtCollar(A, 210); placket(); buttons('#d8d0c0'); cuffs(0, 0.05); },
  track: () => { topBase(A, 225, 1); line(F, '#a8adb2', [[0.3, 0.98], [0.3, 0.02]], 2); for (const [a0, a1] of [ARM_L, ARM_R]) { const c = (a0 + a1) / 2; rect(B, 240, c - 0.03, 0, c - 0.018, 1); rect(B, 240, c + 0.018, 0, c + 0.03, 1); } for (const s of [0.15, 0.45]) rect(B, 240, s - 0.012, 0, s + 0.012, 1); shirtCollar(A, 210); },
  blouse: () => { topBase(A, 238, 0.45); vneck(0.12); for (let k = 0; k < 4; k++) line(A, 250, [[0.22 + k * 0.01, 0.95 - k * 0.05], [0.38 - k * 0.01, 0.95 - k * 0.05]], 1.5); for (const [a0, a1] of [ARM_L, ARM_R]) line(A, 205, [[a0, 0.56], [a1, 0.56]], 3); },
  police: () => { topBase(F, '#1f2c4f', 0.3); shirtCollar(F, '#1a2442'); placket(); buttons('#c8c8c8', 6); pocket(0.22, 0.8, 0.06, 0.08, F, '#24325a'); pocket(0.38, 0.8, 0.06, 0.08, F, '#24325a'); paint(F, '#e3c25b', (c) => { c.beginPath(); for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, r = (k % 2 ? 0.012 : 0.026) * S; c.lineTo(X(0.38) + Math.sin(a) * r, Y(0.86) - Math.cos(a) * r); } c.fill(); }); rect(F, '#cfd3d6', 0.18, 0.86, 0.26, 0.88); for (const [a0, a1] of [ARM_L, ARM_R]) { ell(F, '#2b3f78', (a0 + a1) / 2, 0.88, 0.04, 0.05); ell(F, '#e3c25b', (a0 + a1) / 2, 0.88, 0.025, 0.03); } rect(F, '#111', 0, 0, 0.6, 0.06); rect(F, '#c9a648', 0.28, 0.01, 0.32, 0.05); },
  medic: () => { topBase(F, '#f1f4f7', 0.3); shirtCollar(F, '#e2e6ea'); placket(); buttons('#bbb', 6); rect(F, '#2a5fae', 0, 0.62, 0.6, 0.66); for (const [a0, a1] of [ARM_L, ARM_R]) { ell(F, '#2a5fae', (a0 + a1) / 2, 0.86, 0.035, 0.05); text('+', (a0 + a1) / 2, 0.86, 0.07); } text('PARAMEDIC', 0.08, 0.84, 0.035, '#2a5fae'); text('PARAMEDIC', 0.52, 0.84, 0.035, '#2a5fae'); },
  fire: () => { topBase(F, '#5e5135', 1); noise(0.2); reflective(0.18, 0.23, '#e8e070'); reflective(0.25, 0.28, '#d8dbe0', false); rect(F, '#e8e070', 0, 0.62, 0.6, 0.66); text('FIRE', 0.08, 0.8, 0.07, '#e8e070'); text('FIRE', 0.52, 0.8, 0.07, '#e8e070'); line(F, '#222', [[0.3, 0.98], [0.3, 0.02]], 4); cuffs(0, 0.06, F, '#222'); },
  swat: () => { topBase(F, '#2a2e33', 1); rect(F, '#1b1e22', 0.0, 0.08, 0.6, 0.85); for (const u of [0.2, 0.3, 0.4]) rect(F, '#23272c', u - 0.035, 0.12, u + 0.035, 0.3); text('POLICE', 0.3, 0.66, 0.07, '#e8e8e8'); text('SWAT', 0.06, 0.62, 0.06, '#e8e8e8'); text('SWAT', 0.54, 0.62, 0.06, '#e8e8e8'); stitch([[0, 0.85], [0.6, 0.85]]); },
  hivis: () => { topBase(B, 228, 0.3); rect(A, 235, 0.0, 0.05, 0.6, 0.93); vneck(0.15, B, 228); reflective(0.3, 0.36, '#e4e6e8', false); reflective(0.5, 0.56, '#e4e6e8', false); for (const u of [0.22, 0.38]) rect(F, '#e4e6e8', u - 0.02, 0.56, u + 0.02, 0.93); },
  varsity: () => { topBase(A, 220, 1); for (const [a0, a1] of [ARM_L, ARM_R]) rect(B, 238, a0, 0.06, a1, 1); cuffs(0, 0.06, A, 200); for (let k = 0; k < 3; k++) rect(B, 240, 0, 0.015 + k * 0.025, 0.6, 0.025 + k * 0.025); text('D', 0.38, 0.78, 0.13, '#ffffff', B); buttons('#e8e6e0', 5, 0.9, 0.12); collar(B, 240, 0.04); },
  coat: () => { topBase(A, 210, 1); rect(A, 195, 0.28, 0.0, 0.32, 1); buttons('#2a2a2a', 5, 0.88, 0.2); for (let k = 0; k < 5; k++) ell(F, '#2a2a2a', 0.36, 0.88 - k * 0.17, 0.006, 0.006); shirtCollar(B, 235); pocket(0.18, 0.35, 0.08, 0.02, A, 175); pocket(0.42, 0.35, 0.08, 0.02, A, 175); cuffs(0, 0.06, A, 185); },
  mascot: () => { rect(F, '#8c8f94', 0, 0, 1, 1); noise(0.4, 2); ell(F, '#d9d4cb', 0.3, 0.45, 0.14, 0.35); for (let k = 0; k < 400; k++) shade((c) => { c.fillStyle = `rgba(255,255,255,${rnd() * 0.15})`; c.fillRect(ox + rnd() * S, oy + rnd() * S, 1, 4); }); },  // ---- newer tops (appended to TOPS) ----
  puffer: () => { topBase(A, 226, 1); for (let k = 0; k < 9; k++) { const v = k * 0.115; shade((c) => { const gr = c.createLinearGradient(0, Y(v + 0.115), 0, Y(v)); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(0.92, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)'); c.fillStyle = gr; c.fillRect(ox, Y(v + 0.115), S, Y(v) - Y(v + 0.115)); }); } line(F, '#2a2a2a', [[0.3, 0.98], [0.3, 0.02]], 2.5); rect(B, 230, 0.27, 0.9, 0.33, 1); cuffs(0, 0.05, F, '#1d1d1f'); rect(F, '#1d1d1f', 0, 0, 0.6, 0.04); },
  denim: () => { topBase(A, 214, 1); shade((c) => { c.fillStyle = 'rgba(255,255,255,0.07)'; for (let k = 0; k < 500; k++) c.fillRect(ox + rnd() * S, oy + rnd() * S, 1, 3); }); shirtCollar(A, 200); placket(); buttons('#b08d57', 6); for (const u of [0.2, 0.4]) { pocket(u, 0.82, 0.08, 0.1, A, 205); line(A, 196, [[u - 0.06, 0.65], [u - 0.06, 0.05]], 1.5); stitch([[u - 0.06, 0.65], [u - 0.06, 0.05]]); } rect(A, 205, 0, 0, 0.6, 0.07); cuffs(0, 0.07, A, 205); stitch([[0, 0.07], [0.6, 0.07]]); },
  jersey: () => { topBase(A, 230, 0.32); vneck(0.1, B, 235); for (const [a0, a1] of [ARM_L, ARM_R]) { rect(B, 235, a0, 0.72, a1, 0.76); rect(B, 235, a0, 0.79, a1, 0.81); } text('23', 0.3, 0.6, 0.2, '#fff', B, 'Arial Black'); text('23', 0.05, 0.55, 0.16, '#fff', B); text('23', 0.55, 0.55, 0.16, '#fff', B); text('QC', 0.3, 0.84, 0.06, '#fff', B); for (const s of [0.15, 0.45]) rect(B, 238, s - 0.008, 0.0, s + 0.008, 0.9); },
  scrubs: () => { topBase(A, 232, 0.3); vneck(0.16, K, 232); line(A, 205, [[0.24, 1], [0.3, 0.84], [0.36, 1]], 3); pocket(0.38, 0.8, 0.06, 0.08, A, 215); line(F, '#e8e8e8', [[0.37, 0.82], [0.37, 0.74]], 2); rect(A, 215, 0, 0, 0.6, 0.05); },
  apron: () => { topBase(B, 228, 0.3); collar(K, 232, 0.035); rect(A, 225, 0.17, 0.0, 0.43, 0.78); poly(A, 225, [[0.2, 0.78], [0.4, 0.78], [0.37, 0.98], [0.23, 0.98]]); for (const u of [0.0, 0.5]) rect(A, 215, u + 0.02, 0.35, u + 0.08, 0.38); pocket(0.3, 0.42, 0.18, 0.12, A, 210); text('HY-WAY', 0.3, 0.68, 0.045, '#fff', F); line(F, '#d03a2f', [[0.22, 0.62], [0.38, 0.62]], 2); stitch([[0.17, 0.0], [0.17, 0.78], [0.43, 0.78], [0.43, 0.0]]); },
  chore: () => { topBase(A, 212, 1); noise(0.18, 0.7); shirtCollar(B, 200); for (let k = 0; k < 14; k++) line(B, 185, [[0.22 + k * 0.012, 1], [0.22 + k * 0.012, 0.93]], 1); placket(); buttons('#3a2a1a', 5, 0.9, 0.2); for (const u of [0.18, 0.42]) { pocket(u, 0.38, 0.1, 0.13, A, 200); pocket(u, 0.82, 0.07, 0.09, A, 200); } cuffs(0, 0.05, A, 195); for (const [a0, a1] of [ARM_L, ARM_R]) radial((a0 + a1) / 2, 0.5, 0.06, 'rgba(0,0,0,0.15)'); },
  graphic: () => { topBase(A, 228, 0.3); collar(K, 232, 0.035); line(A, 205, [[0.24, 1], [0.3, 0.955], [0.36, 1]], 4); text('QUAD', 0.3, 0.8, 0.065, '#fff', B); text('CITIES', 0.3, 0.72, 0.065, '#fff', B); for (let k = 0; k < 3; k++) line(B, 235, [[0.2, 0.62 - k * 0.03], [0.25, 0.64 - k * 0.03], [0.3, 0.62 - k * 0.03], [0.35, 0.64 - k * 0.03], [0.4, 0.62 - k * 0.03]], 3); for (const [a0, a1] of [ARM_L, ARM_R]) darken(a0, 0.7, a1, 0.72, 0.2); },
  camo: () => { topBase(A, 205, 1); for (let k = 0; k < 70; k++) ell(B, 215, rnd(), rnd(), 0.02 + rnd() * 0.05, 0.015 + rnd() * 0.03, rnd() * 3); for (let k = 0; k < 50; k++) ell(F, '#3a3222', rnd(), rnd(), 0.015 + rnd() * 0.035, 0.01 + rnd() * 0.025, rnd() * 3); for (let k = 0; k < 40; k++) ell(F, '#6b6a3e', rnd(), rnd(), 0.015 + rnd() * 0.03, 0.01 + rnd() * 0.02, rnd() * 3); line(F, '#2a2a2a', [[0.3, 0.98], [0.3, 0.02]], 2); shirtCollar(F, '#3e3a2a'); rect(F, '#e0782c', 0, 0.52, 0.6, 0.56); },
  cardigan: () => { topBase(A, 220, 1); for (let k = 0; k < 60; k++) shade((c) => { c.fillStyle = 'rgba(0,0,0,0.05)'; c.fillRect(ox + rnd() * S, oy, 1, S); }); poly(B, 232, [[0.24, 1], [0.36, 1], [0.33, 0.45], [0.27, 0.45]]); for (const s_ of [-1, 1]) line(A, 200, [[0.3 + s_ * 0.06, 1], [0.3 + s_ * 0.03, 0.45], [0.3 + s_ * 0.03, 0]], 5); buttons('#d8cfc0', 4, 0.42, 0.08); rect(A, 195, 0, 0, 0.6, 0.06); cuffs(0, 0.07, A, 195); },
  torn: () => { // a worn-out tee: rips showing skin, a ragged hem, grime
    topBase(A, 222, 0.26); collar(K, 232, 0.04); line(A, 200, [[0.24, 1], [0.3, 0.95], [0.36, 1]], 3);
    for (const [u, v, r] of [[0.22, 0.42, 0.03], [0.4, 0.62, 0.022], [0.05, 0.3, 0.028], [0.52, 0.2, 0.03], [0.33, 0.12, 0.02], [0.64, 0.83, 0.02]]) {
      const pts = []; for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2, rr = r * (0.6 + rnd() * 0.7); pts.push([u + Math.cos(a) * rr, v + Math.sin(a) * rr * 1.4]); }
      poly(K, 232, pts); shade((c) => { c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1.5; c.beginPath(); pts.forEach(([pu, pv], i) => (i ? c.lineTo(X(pu), Y(pv)) : c.moveTo(X(pu), Y(pv)))); c.closePath(); c.stroke(); });
    }
    const hem = [[0, 0]]; for (let k = 0; k <= 24; k++) hem.push([k / 40, 0.02 + rnd() * 0.06]); hem.push([0.6, 0]); poly(K, 232, hem);
    for (let k = 0; k < 14; k++) radial(rnd() * 0.6, rnd(), 0.03 + rnd() * 0.04, 'rgba(70,55,35,0.25)');
    for (const [a0, a1] of [ARM_L, ARM_R]) { const sl = []; for (let k = 0; k <= 8; k++) sl.push([a0 + (a1 - a0) * k / 8, 0.74 + rnd() * 0.03]); sl.push([a1, 0.7]); sl.push([a0, 0.7]); poly(K, 232, sl); }
  },
};
// ---------------- bottoms (pelvis band v 0.8..1 around; legs: left u 0..0.5, right 0.5..1, v 0 ankle .. 0.8 hip) ----------------
const KNEE = 0.376;
function botBase(lvl = A, col = 220, to = 0) {
  rect(lvl, col, 0, 0.8, 1, 1);
  for (const l0 of [0, 0.5]) { rect(lvl, col, l0, to, l0 + 0.5, 0.8); if (to > 0) rect(K, 232, l0, 0, l0 + 0.5, to); }
  noise(0.1);
  for (const l0 of [0, 0.5]) shade((c) => { const gr = c.createLinearGradient(X(l0), 0, X(l0 + 0.5), 0); gr.addColorStop(0, 'rgba(0,0,0,0.28)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.28)'); c.fillStyle = gr; c.fillRect(X(l0), Y(0.8), X(l0 + 0.5) - X(l0), Y(to) - Y(0.8)); });
  for (const l0 of [0, 0.5]) { folds(l0 + 0.05, l0 + 0.45, to + 0.05, 0.78, 6, 0.17, 0.4); shade((c) => { c.fillStyle = 'rgba(0,0,0,0.12)'; for (let k = 0; k < 4; k++) c.fillRect(X(l0 + 0.15 + rnd() * 0.2), Y(KNEE + 0.02 * k), S * 0.12, 2); }); }
  // (no painted leg seams: at a distance they read as stray lines)
}
function belt(col = '#2a1d14', buckle = '#c9a648') { rect(F, col, 0, 0.955, 1, 0.995); rect(F, buckle, 0.48, 0.95, 0.52, 1); for (const u of [0.15, 0.35, 0.65, 0.85]) rect(F, col, u - 0.006, 0.93, u + 0.006, 1); }
const BOT_PAINT = {
  jeans: () => { botBase(A, 215); belt(); shade((c) => { c.fillStyle = 'rgba(255,255,255,0.06)'; for (let k = 0; k < 400; k++) c.fillRect(ox + rnd() * S, oy + rnd() * S, 1, 3); }); for (const s of [-1, 1]) { poly(A, 200, [[0.5 + s * 0.06, 0.95], [0.5 + s * 0.16, 0.95], [0.5 + s * 0.16, 0.86]]); stitch([[0.5 + s * 0.06, 0.95], [0.5 + s * 0.16, 0.86]]); } stitch([[0.5, 0.95], [0.505, 0.82]]); for (const l0 of [0, 0.5]) { radial(l0 + 0.25, 0.55, 0.12, 'rgba(255,255,255,0.12)'); darken(l0, 0, l0 + 0.5, 0.025, 0.25); } },
  slacks: () => { botBase(A, 212); belt('#151515', '#bbb'); for (const l0 of [0, 0.5]) line(A, 228, [[l0 + 0.25, 0.78], [l0 + 0.25, 0.02]], 1.4); },
  shorts: () => { botBase(A, 218, 0.47); belt(); for (const l0 of [0, 0.5]) darken(l0, 0.47, l0 + 0.5, 0.49, 0.25); },
  cargo: () => { botBase(A, 214); belt('#333', '#888'); for (const l0 of [0, 0.5]) { rect(A, 196, l0 + 0.04, 0.42, l0 + 0.16, 0.58); rect(A, 186, l0 + 0.04, 0.56, l0 + 0.16, 0.58); stitch([[l0 + 0.04, 0.42], [l0 + 0.16, 0.42], [l0 + 0.16, 0.58], [l0 + 0.04, 0.58], [l0 + 0.04, 0.42]]); } },
  sweats: () => { botBase(A, 222); rect(A, 200, 0, 0.94, 1, 1); for (const l0 of [0, 0.5]) { rect(B, 240, l0 + 0.115, 0.03, l0 + 0.135, 0.8); rect(A, 196, l0, 0, l0 + 0.5, 0.04); } line(F, '#eee', [[0.49, 0.96], [0.485, 0.88]], 2); line(F, '#eee', [[0.51, 0.96], [0.515, 0.88]], 2); },
  police: () => { botBase(F, '#1c2747'); for (const l0 of [0, 0.5]) rect(F, '#151d36', l0 + 0.115, 0, l0 + 0.135, 0.8); rect(F, '#111', 0, 0.94, 1, 1); rect(F, '#2b2b2b', 0.68, 0.86, 0.78, 0.98); rect(F, '#2b2b2b', 0.2, 0.86, 0.3, 0.98); },
  work: () => { botBase(A, 205); belt('#3b2a18', '#999'); for (const l0 of [0, 0.5]) { rect(F, '#d8dbe0', l0, 0.07, l0 + 0.5, 0.11); rect(A, 190, l0 + 0.18, 0.33, l0 + 0.32, 0.42); } },
  fire: () => { botBase(F, '#5e5135'); noise(0.2); for (const l0 of [0, 0.5]) { rect(F, '#e8e070', l0, 0.12, l0 + 0.5, 0.17); rect(F, '#d8dbe0', l0, 0.17, l0 + 0.5, 0.19); } rect(F, '#2a2a2a', 0, 0.93, 1, 1); },
  skirt: () => { botBase(A, 220, 0.5); for (const l0 of [0, 0.5]) { darken(l0, 0.5, l0 + 0.5, 0.52, 0.3); for (let k = 0; k < 5; k++) line(A, 205, [[l0 + 0.05 + k * 0.1, 0.78], [l0 + 0.05 + k * 0.1, 0.52]], 2); } rect(A, 200, 0, 0.95, 1, 1); },
  mascot: () => { rect(F, '#8c8f94', 0, 0, 1, 1); noise(0.4, 2); for (let k = 0; k < 400; k++) shade((c) => { c.fillStyle = `rgba(255,255,255,${rnd() * 0.15})`; c.fillRect(ox + rnd() * S, oy + rnd() * S, 1, 4); }); rect(F, '#5a3b26', 0, 0, 1, 0.08); },  leggings: () => { botBase(A, 214, 0.06); rect(A, 200, 0, 0.95, 1, 1); for (const l0 of [0, 0.5]) { radial(l0 + 0.25, 0.55, 0.14, 'rgba(255,255,255,0.18)'); radial(l0 + 0.25, 0.25, 0.1, 'rgba(255,255,255,0.12)'); } },
  scrubs: () => { botBase(A, 226); rect(A, 210, 0, 0.94, 1, 1); line(F, '#eee', [[0.5, 0.96], [0.49, 0.86]], 2); for (const l0 of [0, 0.5]) { pocket(l0 + 0.1, 0.6, 0.1, 0.1, A, 215); rect(A, 205, l0, 0, l0 + 0.5, 0.03); } },
};
// ---------------- shoes (left u 0..0.5, right 0.5..1; within a shoe u goes round from the sole; v heel..toe) ----------------
function shoe(kind) {
  for (const l0 of [0, 0.5]) {
    const U = (u) => l0 + u * 0.5;
    rect(A, kind === 'dress' ? 200 : 230, l0, 0, l0 + 0.5, 1);
    noise(kind === 'dress' ? 0.05 : 0.12);
    // sole wraps the bottom of the loft (u near 0 and 1)
    const soleH = kind === 'boot' ? 0.16 : 0.12;
    rect(kind === 'sneaker' ? B : F, kind === 'sneaker' ? 240 : '#1c1715', U(0), 0, U(soleH), 1);
    rect(kind === 'sneaker' ? B : F, kind === 'sneaker' ? 240 : '#1c1715', U(1 - soleH), 0, U(1), 1);
    if (kind !== 'dress') for (let k = 0; k < 5; k++) line(F, kind === 'boot' ? '#c8b48a' : '#f2f2f2', [[U(0.44), 0.42 + k * 0.06], [U(0.56), 0.45 + k * 0.06]], 2.5);
    if (kind === 'sneaker') line(B, 238, [[U(0.25), 0.2], [U(0.32), 0.55], [U(0.22), 0.75]], 4);
    if (kind === 'dress') radial(U(0.5), 0.8, 0.08, 'rgba(255,255,255,0.35)');
    darken(l0, 0.0, l0 + 0.5, 0.05, 0.2);
  }
}

// ---------------- the rest ----------------
function paintSkin() {
  rect(K, 236, 0, 0, 1, 1); noise(0.05, 1.5);
  // hand region (u .55-.95, v .55-.95): knuckle lines and nails
  for (let k = 0; k < 4; k++) line(K, 205, [[0.6 + k * 0.08, 0.9], [0.6 + k * 0.08, 0.6]], 1.2);
}
function paintHair() {
  rect(A, 200, 0, 0, 1, 1);
  shade((c) => { for (let k = 0; k < 900; k++) { const x = ox + rnd() * S, y = oy + rnd() * S; c.strokeStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${0.08 + rnd() * 0.14})`; c.lineWidth = 1 + rnd(); c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 6, y + 10 + rnd() * 30); c.stroke(); } });
  grad(0, 1, 0, 0, [[0, 'rgba(255,255,255,0.15)'], [1, 'rgba(0,0,0,0.25)']]);
}
function paintHat(police) {
  if (police) {
    rect(F, '#1a2442', 0, 0, 1, 1); noise(0.15);
    rect(F, '#0d0d0d', 0, 0, 1, 0.2); rect(F, '#0d0d0d', 0.4, 0, 0.6, 0.15);
    rect(F, '#111', 0, 0.3, 1, 0.36);
    paint(F, '#e3c25b', (c) => { c.beginPath(); for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, r = (k % 2 ? 0.02 : 0.045) * S; c.lineTo(X(0.5) + Math.sin(a) * r, Y(0.5) - Math.cos(a) * r); } c.fill(); });
    return;
  }
  rect(A, 225, 0, 0, 1, 1); noise(0.12);
  for (let k = 1; k < 6; k++) stitch([[k / 6, 1], [k / 6, 0.3]]);
  ell(B, 215, 0.5, 0.6, 0.035, 0.03); // small logo patch on the front
  rect(A, 205, 0, 0.0, 1, 0.12);
}
function paintTrucker() { // mesh-back seed cap: solid front panel with a patch, mesh behind, coloured brim
  rect(B, 238, 0, 0, 1, 1);
  shade((c) => { c.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = 0; y < S; y += 4) for (let x = (y / 4) % 2 * 2; x < S; x += 4) c.fillRect(ox + x, oy + y, 2, 2); });
  rect(A, 225, 0.32, 0.25, 0.68, 1); noise(0.1); rect(A, 215, 0, 0, 1, 0.16);
  ell(F, '#f4f1e6', 0.5, 0.58, 0.11, 0.08); text('QC SEED', 0.5, 0.6, 0.045, '#2f7a3f', F); paint(F, '#e8c547', (c) => { c.beginPath(); c.ellipse(X(0.5), Y(0.53), 0.02 * S, 0.01 * S, 0, 0, 7); c.fill(); });
  for (let k = 1; k < 6; k++) stitch([[k / 6, 1], [k / 6, 0.3]]);
}
function paintFixed() {
  rect(F, '#1b1c1f', 0, 0.5, 0.5, 1); radial(0.18, 0.85, 0.12, 'rgba(255,255,255,0.25)'); // black plastic / dark lenses
  rect(F, '#7c838a', 0.5, 0.5, 1, 1); // metal
  rect(F, '#a9bccb', 0, 0, 0.5, 0.5); // clear lens / phone glass
  rect(F, '#7a4f2c', 0.5, 0, 1, 0.5); noise(0.15); // wood / cardboard
}
function paintTattoo() {
  // cleared mask (0) = no tattoo; ink is painted with level 102
  const ink = '#1f2b3a';
  for (const [a0, a1] of [ARM_L, ARM_R]) {
    const c = (a0 + a1) / 2;
    for (let k = 0; k < 6; k++) line(F, ink, [[a0 + 0.02, 0.62 - k * 0.04], [c, 0.66 - k * 0.04], [a1 - 0.02, 0.62 - k * 0.04]], 3);
    ell(F, ink, c, 0.4, 0.03, 0.05);
    ell(F, '#8a2131', c, 0.4, 0.016, 0.03);
  }
  line(F, ink, [[0.18, 0.9], [0.24, 0.84], [0.3, 0.86], [0.36, 0.84], [0.42, 0.9]], 3);
}

export function paintAtlas(size = SIZE) {
  const cv = document.createElement('canvas'), mk = document.createElement('canvas');
  cv.width = mk.width = SIZE; cv.height = mk.height = SIZEY;
  g = cv.getContext('2d'); m = mk.getContext('2d');
  m.fillStyle = '#000'; m.fillRect(0, 0, SIZE, SIZEY);
  g.fillStyle = '#ccc'; g.fillRect(0, 0, SIZE, SIZEY);
  noiseCanvas = makeNoise();
  for (let i = 0; i < FACE.length; i++) { cell(CELL.face(i, false)); paintFace(i, false); cell(CELL.face(i, true)); paintFace(i, true); }
  cell(CELL.trucker); paintTrucker();
  cell(CELL.ski); paintSkiMask(); cell(CELL.tim); paintTimMask(); cell(CELL.mascotFace); paintMascotFace();
  cell(CELL.skin); paintSkin(); cell(CELL.hair); paintHair(); cell(CELL.hat); paintHat(false); cell(CELL.hatPolice); paintHat(true);
  cell(CELL.fixed); paintFixed(); cell(CELL.tattoo); paintTattoo();
  const tops = Object.keys(TOP_PAINT);
  tops.forEach((k, i) => { cell(CELL.top(i)); TOP_PAINT[k](); });
  Object.keys(BOT_PAINT).forEach((k, i) => { cell(CELL.bottom(i)); BOT_PAINT[k](); });
  ['sneaker', 'dress', 'boot'].forEach((k, i) => { cell(CELL.shoe(i)); shoe(k); });
  for (const c of [g, m]) { c.save(); c.imageSmoothingEnabled = false; bleed(c, N, ROWS); c.restore(); }
  // combine colour + mask into one RGBA texture (canvas alpha would be premultiplied and lose colour)
  let cw = cv, mw = mk;
  const sizeY = size * ROWS / N;
  if (size !== SIZE) {
    cw = document.createElement('canvas'); mw = document.createElement('canvas'); cw.width = mw.width = size; cw.height = mw.height = sizeY;
    cw.getContext('2d').drawImage(cv, 0, 0, size, sizeY); const mctx = mw.getContext('2d'); mctx.imageSmoothingEnabled = false; mctx.drawImage(mk, 0, 0, size, sizeY);
  }
  const cd = cw.getContext('2d').getImageData(0, 0, size, sizeY).data, md = mw.getContext('2d').getImageData(0, 0, size, sizeY).data;
  const out = new Uint8Array(size * sizeY * 4);
  for (let y = 0; y < sizeY; y++) {
    const src = y * size * 4, dst = (sizeY - 1 - y) * size * 4; // flip: canvas top = v 1
    for (let x = 0; x < size * 4; x += 4) {
      out[dst + x] = cd[src + x]; out[dst + x + 1] = cd[src + x + 1]; out[dst + x + 2] = cd[src + x + 2]; out[dst + x + 3] = md[src + x];
    }
  }
  const t = new THREE.DataTexture(out, size, sizeY, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4; t.needsUpdate = true;
  t.userData.debugCanvas = cv;
  return t;
}
export const TOP_NAMES = Object.keys(TOP_PAINT), BOT_NAMES = Object.keys(BOT_PAINT);
