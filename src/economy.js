// Money, things to buy, stores to rob and the crime-spree goals. Local to each player
// (nothing is saved between sessions).
import * as THREE from 'three';
import * as W from './world.js';
import { textTexture } from './util.js';

export const eco = { cash: 200, robbed: 0, jacked: 0, copCars: 0, done: new Set() };
let scene, hooks = { announce() {}, sound() {}, feed() {} };
export function initEconomy(s, h) { scene = s; hooks = { ...hooks, ...h }; markStores(); }

export function addCash(n, why) {
  eco.cash = Math.max(0, Math.round(eco.cash + n));
  if (n > 0 && why) hooks.feed(`+$${n} ${why}`);
}
export function spend(n) { if (eco.cash < n) return false; eco.cash -= n; return true; }

// ---------- goals ----------
export const GOALS = [
  { id: 'rob', text: 'Rob 5 stores', reward: 1200, max: 5, get: () => eco.robbed },
  { id: 'casino', text: 'Rob the riverboat casino', reward: 3000 },
  { id: 'lose4', text: 'Escape a 4-star chase', reward: 800 },
  { id: 'lose5', text: 'Escape a 5-star chase', reward: 2000 },
  { id: 'survive5', text: 'Survive 60 seconds at 5 stars', reward: 1500 },
  { id: 'heli', text: 'Take down a police helicopter', reward: 1000 },
  { id: 'copcar', text: 'Steal a police car', reward: 500 },
  { id: 'cops5', text: 'Wreck 5 police cars', reward: 900, max: 5, get: () => eco.copCars },
  { id: 'jack10', text: 'Carjack 10 cars', reward: 700, max: 10, get: () => eco.jacked },
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

// ---------- stores ----------
// kind: 'rob' (walk in, aim a gun at the clerk to empty the till), 'guns', 'meds', 'body', 'clothes', 'casino'
export const stores = [];
// Made-up names on real Davenport gas stations and corner stores.
const ROB_NAMES = ['Tim-Mart', 'Arnett Gas', 'Big River Liquor', 'Hilltop Pantry', 'QuikTim', 'River Bend Fuel', 'Corner Tim', 'Bluff Mart', 'Lucky Arnett', 'Mississippi Mini Mart', 'Quad Stop', 'Eagle Point Liquor', 'Kimberly Quick Stop', 'Brady Street Market', 'Village Pantry', 'Northside Gas'];
// a sidewalk spot in front of a point of interest: {x, z} to stand on, door toward the building
function frontOf(px, pz) {
  const q = W.nearestEdge(px, pz, 80, (e) => e.cls !== 'service' && !e.bridge);
  if (!q) return null;
  const dx = px - q.x, dz = pz - q.z, l = Math.hypot(dx, dz) || 1, off = q.e.width / 2 + 1.6;
  const x = q.x + (dx / l) * off, z = q.z + (dz / l) * off;
  return { x, z, doorX: x + (dx / l) * 2.2, doorZ: z + (dz / l) * 2.2, face: Math.atan2(dx, dz) };
}
function markStores() {
  const poi = W.D.index.poi;
  const spaced = (list, minD) => { const out = []; for (const p of list) if (!out.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < minD)) out.push(p); return out; };
  const rob = spaced(poi.filter((p) => ['fuel', 'convenience', 'alcohol'].includes(p.kind)), 220);
  rob.slice(0, 15).forEach((p, i) => { const f = frontOf(p.x, p.z); if (f) stores.push({ name: ROB_NAMES[i % ROB_NAMES.length], kind: 'rob', ...f, cooldown: 0, progress: 0 }); });
  // Arnett Arms downtown and by NorthPark; Tim's Threads downtown + NorthPark, Arnett Auto on Brady St
  for (const [x, z, name, kind] of [[60, -330, 'Arnett Arms', 'guns'], [300, -3990, 'Arnett Arms', 'guns'], [-30, -1450, 'Arnett Auto', 'body'], [230, 40, "Tim's Threads", 'clothes'], [420, -4200, "Tim's Threads", 'clothes']]) { const f = frontOf(x, z); if (f) stores.push({ name, kind, ...f, cooldown: 0, progress: 0 }); }
  // two more Arnett Arms at real shop spots on the far east and west sides (so every part of town has one)
  const spare = rob.slice(15), ends = spare.length ? [spare.reduce((a, b) => (b.x > a.x ? b : a)), spare.reduce((a, b) => (b.x < a.x ? b : a))] : [];
  for (const p of ends) { const f = frontOf(p.x, p.z); if (f) stores.push({ name: 'Arnett Arms', kind: 'guns', ...f, cooldown: 0, progress: 0 }); }
  for (const h of W.D.index.hospitals) { const f = frontOf(h.x, h.z); if (f) stores.push({ name: 'Hospital pharmacy', kind: 'meds', ...f }); }
  // a soft glowing ring on the sidewalk so you can find the door
  const ringGeo = new THREE.RingGeometry(0.7, 0.9, 28).rotateX(-Math.PI / 2);
  const COL = { rob: 0x8fe38a, guns: 0xe5484d, body: 0x4aa3ff, meds: 0xffffff, clothes: 0xff80ab };
  for (const s of stores) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: COL[s.kind], transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(s.x, W.groundHeight(s.x, s.z) + 0.12, s.z); scene.add(m); s.ring = m;
  }
  // robbable stores also get a floating "$" over the door (faded while the till is empty, see updateEconomy)
  const robTex = textTexture('$', { w: 128, h: 128, bg: '#2fbf4a', fg: '#ffffff', size: 100, border: '#ffffff' });
  for (const s of stores) if (s.kind === 'rob') {
    const t = new THREE.Sprite(new THREE.SpriteMaterial({ map: robTex, transparent: true, opacity: 0.9 }));
    t.scale.set(1.1, 1.1, 1); t.position.set(s.x, W.groundHeight(s.x, s.z) + 3.4, s.z); scene.add(t); s.tag = t;
  }
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
  const px = x + (Math.random() - 0.5), pz = z + (Math.random() - 0.5);
  m.position.set(px, W.groundHeight(px, pz) + 0.1, pz);
  scene.add(m);
  pickups.push({ m, amount, t: 60 });
}

// Per frame: collect cash pickups, tick store cooldowns.
export function updateEconomy(dt, me, time) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.t -= dt; p.m.rotation.y += dt * 3;
    if (!me.dead && !me.veh && Math.hypot(me.x - p.m.position.x, me.z - p.m.position.z) < 1.3) {
      addCash(p.amount); hooks.sound('cash'); p.t = 0;
    }
    if (p.t <= 0) { scene.remove(p.m); pickups.splice(i, 1); }
  }
  for (const s of stores) {
    if (s.cooldown > 0) s.cooldown -= dt;
    if (s.tag) s.tag.material.opacity = s.cooldown > 0 ? 0.2 : 0.9;
  }
}
