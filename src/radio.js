// Car radio: four stations of procedurally generated (original) music, made on the fly with WebAudio.
// The Illinois-side station also has a DJ: local news and jokes between songs (shown as text).
import { audio } from './fx.js';

const STATIONS = [
  { name: 'Tim FM', sub: 'River pop', bpm: 116, wave: 'square', bassWave: 'triangle', prog: [[0, 4, 7], [9, 0, 4], [5, 9, 0], [7, 11, 2]], root: 60, hat: 0.5, density: 0.7 },
  { name: 'Bayside Lo-Fi', sub: 'Chill beats', bpm: 78, wave: 'triangle', bassWave: 'sine', prog: [[2, 5, 9], [7, 11, 2], [0, 4, 7], [9, 0, 4]], root: 57, hat: 0.3, density: 0.45, swing: 0.12 },
  { name: 'Gator Country', sub: 'Boot-stompin\' hits', bpm: 104, wave: 'sawtooth', bassWave: 'triangle', prog: [[0, 4, 7], [5, 9, 0], [7, 11, 2], [0, 4, 7]], root: 55, hat: 0.4, density: 0.6 },
  { name: '97.3 The Other Side', sub: 'Illinois-side rock, news & nonsense', bpm: 122, wave: 'sawtooth', bassWave: 'square', prog: [[0, 4, 7], [10, 2, 5], [5, 9, 0], [7, 11, 2]], root: 52, hat: 0.6, density: 0.55, talk: true },
];
// made-up local news and jokes for The Other Side (Rock Island, Moline, East Moline, Silvis, Milan, Geneseo...)
const TALK = [
  "This is 97.3 The Other Side, broadcasting from the side of the river with the better sunsets. Fight us, Davenport.",
  'Traffic: the I-74 bridge is open, both arches are still standing, and yes, they still light up purple for no reason.',
  'Moline news: John Deere unveils a tractor so big it now has its own zip code.',
  'Rock Island: The District reports a record night. Police report a record number of people asking where they parked.',
  'East Moline residents remind everyone it is "East Moline", not "Moline but further". Noted.',
  'Silvis: the rail yard reports 400 freight cars came through today. Locals report 400 horn blasts at 3 a.m.',
  'Geneseo is holding its annual "we are not in the Quad Cities" festival. Attendance: everyone from the Quad Cities.',
  'The Channel Cat is running. Ten minutes across the Mississippi, two hours to decide which side has better pizza.',
  "Lock and Dam 15 update: a barge went through. Then another barge. That's the whole update. Back to the music.",
  "Weather: humid. Tomorrow: humid. The weekend: Mississippi-level humid. Bring a towel and a fan and a second fan.",
  'Coal Valley: the zoo says a goat escaped and was found at a bar on John Deere Road. It had a tab.',
  'Milan reminds drivers it is pronounced MY-lun. Italy has been notified.',
  'Port Byron news: someone saw a bald eagle. Then everyone saw a bald eagle. Port Byron is now 40 percent eagle photographers.',
  'Breaking: a Davenport man crossed the Centennial Bridge into Rock Island and immediately asked where the Iowa side was.',
  'Colona: population steady, Rock River steady, corn absolutely thriving.',
  'Coming up after the break: forty minutes of guitar solos and a man named Dale reading the grain prices.',
  'Reminder: Quad City taco pizza is a food group. Your doctor disagrees. Your doctor is wrong.',
  'Sports: the River Bandits won. Or lost. Either way, the Ferris wheel was nice.',
];
let talkT = 25, talkI = Math.floor(Math.random() * TALK.length);
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
// Call every frame: plays while you're in a car with the radio on. Returns a DJ line now and then (talk stations), else ''.
export function updateRadio(inCar, dt = 1 / 60) {
  const { ac, out } = audio();
  if (!ac) return '';
  if (!master) { master = ac.createGain(); master.gain.value = 0; master.connect(out); }
  const want = inCar && radio.on ? 0.55 : 0;
  master.gain.setTargetAtTime(want, ac.currentTime, 0.3);
  if (want > 0 && !timer) timer = setInterval(schedule, 100);
  if (want === 0 && timer && master.gain.value < 0.01) { clearInterval(timer); timer = 0; }
  if (want > 0 && STATIONS[radio.station].talk && (talkT -= dt) <= 0) { talkT = 40 + Math.random() * 30; talkI = (talkI + 1 + Math.floor(Math.random() * 3)) % TALK.length; return TALK[talkI]; }
  return '';
}
// Cycle stations: Tim FM -> Lo-Fi -> Country -> The Other Side -> off. Returns {name, sub}.
export function nextStation() {
  if (!radio.on) { radio.on = true; radio.station = 0; }
  else if (radio.station === STATIONS.length - 1) radio.on = false;
  else radio.station++;
  step = 0;
  return radio.on ? STATIONS[radio.station] : { name: 'Radio off', sub: '' };
}
export const currentStation = () => (radio.on ? STATIONS[radio.station] : { name: 'Radio off', sub: '' });
