import * as THREE from 'three';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// The game runs in metres and m/s; the player only ever sees US units.
export const FT = 3.28084, MPH = 2.23694;
export const fmtDist = (m) => (m < 320 ? `${Math.round((m * FT) / 50) * 50} ft` : `${(m / 1609.344).toFixed(1)} mi`);
export const fmtSpeed = (ms) => `${Math.round(Math.abs(ms) * MPH)}`; // mph, caller adds the label

// Seeded random (mulberry32) so every player builds the exact same island.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function angDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Heading convention: forward = (sin h, cos h) in x/z, same as object.rotation.y = h.
export const headingOf = (dx, dz) => Math.atan2(dx, dz);

export function textTexture(lines, { w = 512, h = 128, bg = '#ffffff', fg = '#1b1b1b', size = 56, border = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  if (border) { x.strokeStyle = border; x.lineWidth = 10; x.strokeRect(5, 5, w - 10, h - 10); }
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  const arr = Array.isArray(lines) ? lines : [lines];
  arr.forEach((ln, i) => {
    const sz = i === 0 ? size : Math.round(size * 0.5);
    x.font = `900 ${sz}px "Arial Black", Impact, system-ui, sans-serif`;
    const y = arr.length === 1 ? h / 2 : h * (0.4 + i * 0.32);
    x.fillText(ln, w / 2, y, w - 30);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Ray vs oriented box (box axes: A and B horizontal, Y vertical). Returns hit distance or Infinity.
export function rayOBB(ox, oy, oz, dx, dy, dz, cx, cy, cz, ax, az, ha, hy, bx, bz, hb) {
  const px = cx - ox, py = cy - oy, pz = cz - oz;
  let tmin = 0, tmax = 1e9;
  for (let k = 0; k < 3; k++) {
    let e, f, h;
    if (k === 0) { e = ax * px + az * pz; f = ax * dx + az * dz; h = ha; }
    else if (k === 1) { e = py; f = dy; h = hy; }
    else { e = bx * px + bz * pz; f = bx * dx + bz * dz; h = hb; }
    if (Math.abs(f) > 1e-9) {
      let t1 = (e + h) / f, t2 = (e - h) / f;
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return Infinity;
    } else if (-e - h > 0 || -e + h < 0) return Infinity;
  }
  return tmin;
}

// Ray vs sphere. Returns distance or Infinity.
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const px = cx - ox, py = cy - oy, pz = cz - oz;
  const t = px * dx + py * dy + pz * dz;
  if (t < 0) return Infinity;
  const qx = px - dx * t, qy = py - dy * t, qz = pz - dz * t;
  const d2 = qx * qx + qy * qy + qz * qz;
  if (d2 > r * r) return Infinity;
  return t - Math.sqrt(r * r - d2);
}
