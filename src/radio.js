// Car radio: three stations of procedurally generated (original) music, made on the fly with WebAudio.
import { audio } from './fx.js';

const STATIONS = [
  { name: 'Tim FM', sub: 'Island pop', bpm: 116, wave: 'square', bassWave: 'triangle', prog: [[0, 4, 7], [9, 0, 4], [5, 9, 0], [7, 11, 2]], root: 60, hat: 0.5, density: 0.7 },
  { name: 'Bayside Lo-Fi', sub: 'Chill beats', bpm: 78, wave: 'triangle', bassWave: 'sine', prog: [[2, 5, 9], [7, 11, 2], [0, 4, 7], [9, 0, 4]], root: 57, hat: 0.3, density: 0.45, swing: 0.12 },
  { name: 'Gator Country', sub: 'Boot-stompin\' hits', bpm: 104, wave: 'sawtooth', bassWave: 'triangle', prog: [[0, 4, 7], [5, 9, 0], [7, 11, 2], [0, 4, 7]], root: 55, hat: 0.4, density: 0.6 },
];
export const radio = { station: 0, on: true };
let master = null, timer = 0, nextNote = 0, step = 0;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function note(ac, t, freq, dur, type, vol) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function hit(ac, noise, t, dur, freq, vol, type = 'highpass') {
  const s = ac.createBufferSource(); s.buffer = noise;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
}
function kick(ac, t, vol) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.22);
}

function schedule() {
  const { ac, noise } = audio();
  if (!ac || !master) return;
  const st = STATIONS[radio.station];
  const eighth = 60 / st.bpm / 2;
  if (nextNote < ac.currentTime) nextNote = ac.currentTime + 0.05;
  while (nextNote < ac.currentTime + 0.35) {
    const t = nextNote + (step % 2 && st.swing ? st.swing * eighth : 0);
    const bar = Math.floor(step / 8) % st.prog.length, beat = step % 8, chord = st.prog[bar];
    if (beat % 4 === 0) kick(ac, t, 0.5);
    if (beat % 4 === 2) hit(ac, noise, t, 0.12, 1500, 0.22, 'bandpass');
    if (Math.random() < st.hat) hit(ac, noise, t, 0.04, 7000, 0.07);
    if (beat % 2 === 0) note(ac, t, midi(st.root - 24 + chord[0]), eighth * 1.8, st.bassWave, 0.18);
    if (beat === 0) for (const n of chord) note(ac, t, midi(st.root + n), eighth * 7, 'sine', 0.035);
    if (Math.random() < st.density) note(ac, t, midi(st.root + 12 + chord[Math.floor(Math.random() * 3)] + (Math.random() < 0.2 ? 12 : 0)), eighth * 0.9, st.wave, 0.04);
    nextNote += eighth; step++;
  }
}
// Call every frame: plays while you're in a car with the radio on.
export function updateRadio(inCar) {
  const { ac, out } = audio();
  if (!ac) return;
  if (!master) { master = ac.createGain(); master.gain.value = 0; master.connect(out); }
  const want = inCar && radio.on ? 0.55 : 0;
  master.gain.setTargetAtTime(want, ac.currentTime, 0.3);
  if (want > 0 && !timer) timer = setInterval(schedule, 100);
  if (want === 0 && timer && master.gain.value < 0.01) { clearInterval(timer); timer = 0; }
}
// Cycle stations: Tim FM -> Lo-Fi -> Country -> off. Returns {name, sub}.
export function nextStation() {
  if (!radio.on) { radio.on = true; radio.station = 0; }
  else if (radio.station === STATIONS.length - 1) radio.on = false;
  else radio.station++;
  step = 0;
  return radio.on ? STATIONS[radio.station] : { name: 'Radio off', sub: '' };
}
export const currentStation = () => (radio.on ? STATIONS[radio.station] : { name: 'Radio off', sub: '' });
