// Money, things to buy, stores to rob, hidden Tim gnomes and the goals list. Local to each player
// (nothing is saved between sessions).
import * as THREE from 'three';
import * as W from './world.js';
import { rng } from './util.js';
import { mat } from './character.js';

export const eco = { cash: 200, robbed: 0, gnomes: 0, stunts: 0, done: new Set() };
let scene, hooks = { announce() {}, sound() {}, feed() {} };
export function initEconomy(s, h) { scene = s; hooks = { ...hooks, ...h }; placeGnomes(); markStores(); }

export function addCash(n, why) {
  eco.cash = Math.max(0, Math.round(eco.cash + n));
  if (n > 0 && why) hooks.feed(`+$${n} ${why}`);
}
export function spend(n) { if (eco.cash < n) return false; eco.cash -= n; return true; }

// ---------- goals ----------
export const GOALS = [
  { id: 'bridge', text: 'Jump the broken bridge', reward: 500 },
  { id: 'stunts', text: 'Land 5 stunt jumps', reward: 300, max: 5, get: () => eco.stunts },
  { id: 'rob', text: 'Rob 3 stores', reward: 600, max: 3, get: () => eco.robbed },
  { id: 'gnomes', text: 'Find all 15 hidden Tim gnomes', reward: 2000, max: 15, get: () => eco.gnomes },
  { id: 'lose3', text: 'Lose a 3-star wanted level', reward: 400 },
  { id: 'heli', text: 'Take down the police helicopter', reward: 1000 },
  { id: 'armor', text: 'Buy body armor', reward: 100 },
  { id: 'fly', text: 'Fly the helicopter over the Tim statue', reward: 400 },
  { id: 'boat', text: 'Take a boat around Lighthouse Point', reward: 300 },
  { id: 'survive5', text: 'Survive 60 seconds at 5 stars', reward: 1500 },
];
export function goalDone(id) {
  if (eco.done.has(id)) return;
  const g = GOALS.find((x) => x.id === id);
  if (!g) return;
  eco.done.add(id);
  addCash(g.reward);
  hooks.announce('GOAL COMPLETE', `${g.text} · +$${g.reward}`);
  hooks.sound('goal');
}
export function checkCountGoals() { for (const g of GOALS) if (g.max && g.get() >= g.max) goalDone(g.id); }

// ---------- hidden Tim gnomes ----------
const gnomes = [];
function gnomeMesh() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc94a, emissive: 0x6b4a00, metalness: 0.6, roughness: 0.35 });
  const add = (geo, y, m = gold) => { const x = new THREE.Mesh(geo, m); x.position.y = y; x.castShadow = true; g.add(x); return x; };
  add(new THREE.CylinderGeometry(0.22, 0.28, 0.45, 8), 0.22);
  add(new THREE.SphereGeometry(0.17, 10, 8), 0.58);
  add(new THREE.ConeGeometry(0.2, 0.42, 8), 0.88, new THREE.MeshStandardMaterial({ color: 0xe5484d, emissive: 0x400000 }));
  add(new THREE.BoxGeometry(0.26, 0.12, 0.06), 0.5, mat(0xf2f2f2)); // the beard
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.65, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.position.y = 0.05; g.add(ring);
  return g;
}
function placeGnomes() {
  const r = rng(31337), spots = [];
  const P = W.P;
  // tucked-away places: dock ends, islets, the bridge stub, the lighthouse, the park, beach corners, alleys
  for (const k of W.docks) spots.push(P(k.s, k.d0 + 2));
  for (const i of W.islets.filter((x) => x.r > 9).slice(0, 3)) spots.push({ x: i.x + 2, z: i.z });
  spots.push(P(-190, 10), P(1068, -10), P(1095, 0));
  if (W.places.park) spots.push(P(W.places.park.s - 30, 36));
  for (let k = 0; k < 3; k++) spots.push(P(180 + k * 300 + r() * 60, 80));
  for (let k = 0; k < 3; k++) { const c = W.CROSS[2 + k * 3]; spots.push(P(c + 6.5, -60 - r() * 15)); }
  spots.push(P(40, 20), P(990, -24));
  for (const p of spots.slice(0, 15)) {
    const m = gnomeMesh();
    const y = W.isLand(p.x, p.z) ? W.groundHeight(p.x, p.z) : 0.05;
    m.position.set(p.x, y, p.z);
    scene.add(m);
    gnomes.push({ m, x: p.x, z: p.z, got: false });
  }
}
export function gnomeList() { return gnomes; }

// ---------- stores ----------
// kind: 'rob' (aim a gun at the door to empty the till), 'guns', 'meds', 'body'
export const stores = [];
const ROB = ['TIM-MART', 'TACO TIM', 'KEY LIME CAFE', 'SUNSET VIDEO', 'LUCKY 7 LAUNDRY', 'ARNETT GAS', 'PELICAN PIZZA', 'CONCH BURGER'];
function markStores() {
  for (const s of W.env.shops || []) {
    const kind = s.name === 'ARNETT ARMS' ? 'guns' : s.name === 'ARNETT AUTO' ? 'body' : ROB.includes(s.name) ? 'rob' : null;
    if (kind) stores.push({ ...s, kind, cooldown: 0, progress: 0 });
  }
  if (W.places.clinic) { const c = W.places.clinic, p = W.P(c.s, c.d + c.depth / 2 + 2.2); stores.push({ name: 'ARNETT CLINIC', kind: 'meds', x: p.x, z: p.z }); }
}
export function storeNear(x, z, r = 3.2) {
  let best = null, bd = r;
  for (const s of stores) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } }
  return best;
}

// ---------- cash pickups ----------
const pickups = [];
const cashGeo = new THREE.BoxGeometry(0.35, 0.12, 0.2);
const cashMat = new THREE.MeshStandardMaterial({ color: 0x59c96a, emissive: 0x1d5a25, roughness: 0.5 });
export function dropCash(x, z, amount) {
  const m = new THREE.Mesh(cashGeo, cashMat);
  m.position.set(x + (Math.random() - 0.5), 0.15, z + (Math.random() - 0.5));
  scene.add(m);
  pickups.push({ m, amount, t: 60 });
}

// Per frame: spin gnomes, collect pickups, and return what was collected.
export function updateEconomy(dt, me, time) {
  for (const g of gnomes) {
    if (g.got) continue;
    g.m.rotation.y += dt * 1.5;
    g.m.position.y += Math.sin(time * 3 + g.x) * 0.002;
    if (!me.dead && !me.veh && Math.hypot(me.x - g.x, me.z - g.z) < 1.4) {
      g.got = true; scene.remove(g.m); eco.gnomes++;
      addCash(100);
      hooks.announce('TIM GNOME FOUND', `${eco.gnomes} of ${gnomes.length} · +$100`, '#ffc94a');
      hooks.sound('gnome');
      checkCountGoals();
    }
  }
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.t -= dt; p.m.rotation.y += dt * 3;
    if (!me.dead && !me.veh && Math.hypot(me.x - p.m.position.x, me.z - p.m.position.z) < 1.3) {
      addCash(p.amount); hooks.sound('cash'); p.t = 0;
    }
    if (p.t <= 0) { scene.remove(p.m); pickups.splice(i, 1); }
  }
  for (const s of stores) if (s.cooldown > 0) s.cooldown -= dt;
}
