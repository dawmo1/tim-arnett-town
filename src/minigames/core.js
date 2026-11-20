// Shared bits for the minigames: a tiny WebAudio synth, canvas helpers and fonts.
export const PD = '"Pricedown Bl", Pricedown, Impact, sans-serif';
export const BC = '"Barlow Condensed", "Arial Narrow", sans-serif';

export const rand = (a, b) => a + Math.random() * (b - a);
export const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

// A crisp canvas: draw in logical w x h units, the backing store follows the screen's pixel ratio.
export function canvas(w, h, cls = '') {
  const c = document.createElement('canvas'), d = Math.min(2, devicePixelRatio || 1);
  c.width = w * d; c.height = h * d; c.className = 'mg-cv ' + cls;
  c.style.width = `min(${w}px, 100%, calc((100vh - 280px) * ${(w / h).toFixed(3)}))`; // fits the panel without stretching
  const g = c.getContext('2d'); g.scale(d, d);
  return [c, g];
}
// mouse event -> logical canvas coordinates
export function local(c, e, w) { const b = c.getBoundingClientRect(), k = w / b.width; return [(e.clientX - b.left) * k, (e.clientY - b.top) * k]; }

// ---------- sound: own small synth (fx.js keeps its tone() private) ----------
let ac = null, out = null, noiseBuf = null;
function audio() {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      out = ac.createGain(); out.gain.value = 0.5; out.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { ac = null; return null; }
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
export function tone(freq, dur, { type = 'sine', vol = 0.2, at = 0, slide = 0 } = {}) {
  if (!audio()) return;
  const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
}
export function hiss(dur, { vol = 0.2, freq = 2000, at = 0, type = 'bandpass', q = 1 } = {}) {
  if (!audio()) return;
  const t = ac.currentTime + at, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
export const sfx = {
  click: () => tone(1100, 0.04, { type: 'square', vol: 0.05 }),
  chip: () => { hiss(0.05, { freq: 4200, vol: 0.35, q: 3 }); tone(2600, 0.06, { type: 'triangle', vol: 0.06, at: 0.015 }); },
  tick: () => hiss(0.025, { freq: 5200, vol: 0.18, q: 4 }),
  thud: () => { tone(120, 0.14, { vol: 0.35, slide: -60 }); hiss(0.07, { freq: 700, vol: 0.25 }); },
  card: () => hiss(0.09, { freq: 3000, vol: 0.22, type: 'highpass' }),
  dart: () => { hiss(0.04, { freq: 1500, vol: 0.4 }); tone(180, 0.08, { vol: 0.25, slide: -80 }); },
  clack: (v = 1) => { hiss(0.03, { freq: 3800, vol: 0.12 + 0.5 * v, q: 6 }); tone(2100 + Math.random() * 300, 0.035, { type: 'triangle', vol: 0.04 + 0.12 * v }); },
  rail: (v = 1) => tone(95, 0.12, { vol: 0.08 + 0.3 * v, slide: -30 }),
  pocket: () => { tone(160, 0.25, { vol: 0.3, slide: -90 }); hiss(0.15, { freq: 500, vol: 0.2, at: 0.05 }); },
  coin: (at = 0) => { tone(1318, 0.07, { type: 'square', vol: 0.05, at }); tone(1976, 0.12, { type: 'square', vol: 0.05, at: at + 0.06 }); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.16, at: i * 0.08 })),
  lose: () => [392, 311, 233].forEach((f, i) => tone(f, 0.26, { type: 'sawtooth', vol: 0.05, at: i * 0.14 })),
  jackpot: () => { for (let r = 0; r < 4; r++) [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.2, { type: 'square', vol: 0.06, at: r * 0.45 + i * 0.07 })); },
  suspense: () => tone(220, 0.9, { type: 'sawtooth', vol: 0.04, slide: 440 }),
};
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
