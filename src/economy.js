// Money, things to buy, stores to rob and the crime-spree goals. Local to each player
// (nothing is saved between sessions).
import * as THREE from 'three';
import * as W from './world.js';
import { lots, lotHits, lotNear, pointOnEdge, TILE } from './city/data.js';

export const eco = { cash: 200, robbed: 0, jacked: 0, copCars: 0, done: new Set() };
let scene, hooks = { announce() {}, sound() {}, feed() {} };
export function initEconomy(s, h) { scene = s; hooks = { ...hooks, ...h }; markStores(stores); }

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
// kind: 'rob' (walk in, aim a gun at the clerk to empty the till), 'guns', 'meds', 'body', 'clothes', 'casino', 'bar' (venues.js)
export const stores = [];
// kinds that are a real building you walk into (built by interiors.js): [width, depth] in m
export const WALK_IN = { rob: [14, 11], guns: [16, 11], clothes: [18, 13], bar: [16, 12] };
// Made-up names on real gas stations and corner stores across the Quad Cities.
const ROB_NAMES = ['Tim-Mart', 'Arnett Gas', 'Big River Liquor', 'Hilltop Pantry', 'QuikTim', 'River Bend Fuel', 'Corner Tim', 'Bluff Mart', 'Lucky Arnett', 'Mississippi Mini Mart', 'Quad Stop', 'Eagle Point Liquor', 'Kimberly Quick Stop', 'Brady Street Market', 'Village Pantry', 'Northside Gas',
  'Rock River Fuel', 'Deere Country Mart', 'Avenue of the Cities Stop', 'Blackhawk Gas & Go', 'Hy-Tim', 'Lock 15 Liquors', 'Silvis Switchyard Mart', 'Geneseo Gas & Grub', 'Bettendorf Bargain Fuel', 'Barge Stop', 'Corn Belt Convenience', 'Milan Mini Mart'];
// Parody names on Davenport's real bars and pubs (OSM bar / pub points).
const BAR_NAMES = ["Tim's Tap", 'The Rusty Barge', 'Quad City Swill', 'The Leaky Levee', 'Lock & Dam Lounge', 'The Muddy Paddle', "Arnett's Last Call", 'The Drunken Bix',
  'Skybridge Spirits', 'Bettendorf Bad Decisions', 'The Floodwall', 'Hangover Hill', 'River Rat Saloon', 'The Tipsy Towboat', 'Brady Street Brawlhouse', 'Cornbelt Cocktails',
  'Pint of No Return', 'The Barge Inn', 'Palmer Spine & Stein', 'The Hawkeye Hiccup', 'Credit Island Tab', 'Duck Creek Dive', 'The Fog Horn', 'Two Rivers Too Many',
  'Kimberly Road Rage', 'The Sinking Paddlewheel', 'Iowa Nice & Icy', 'Village Idiot Pub', 'The Corn Mash', 'Centennial Bridge Burner'];
// a sidewalk spot in front of a point of interest: {x, z} to stand on, door toward the building
const street = (e) => e.cls !== 'service' && !e.bridge;
const spot = (e, qx, qz, nx, nz) => { const off = e.width / 2 + 1.6, x = qx + nx * off, z = qz + nz * off; return { x, z, doorX: x + nx * 2.2, doorZ: z + nz * 2.2, face: Math.atan2(nx, nz) }; };
function frontOf(px, pz) {
  const q = W.nearestEdge(px, pz, 80, street);
  if (!q) return null;
  const dx = px - q.x, dz = pz - q.z, l = Math.hypot(dx, dz) || 1;
  return spot(q.e, q.x, q.z, dx / l, dz / l);
}
// spots for a walk-in store: in front of (px, pz), then slid 10..60 m along that road on the same side;
// `far` (Arnett Arms, Tim's Threads) then tries the roads round points 60 and 120 m away
function* spots(px, pz, far) {
  const q = W.nearestEdge(px, pz, 80, street);
  if (q) {
    yield frontOf(px, pz);
    const side = Math.sign((px - q.x) * Math.cos(q.h) - (pz - q.z) * Math.sin(q.h)) || 1;
    for (let off = 10; off <= 60; off += 10) for (const s of [q.s + off, q.s - off]) {
      if (s < 0 || s > q.e.len) continue;
      const p = pointOnEdge(q.e, s);
      yield spot(q.e, p.x, p.z, side * Math.cos(p.h), -side * Math.sin(p.h));
    }
  }
  if (far) for (const r of [60, 120]) for (let a = 0; a < 8; a++) yield* spots(px + r * Math.cos(a * Math.PI / 4), pz + r * Math.sin(a * Math.PI / 4), false);
}
// a walk-in store's lot: front wall 2 m behind the sidewalk spot, door facing the street, 1 m spare round it
const lotOf = (s) => ({ x: s.cx, z: s.cz, fx: Math.sin(s.face), fz: Math.cos(s.face), hw: s.w / 2 + 1, hd: s.d / 2 + 1 });
const corners = (L) => [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, f]) => [L.x + L.fz * a * L.hw + L.fx * f * L.hd, L.z - L.fx * a * L.hw + L.fz * f * L.hd]);
const apart = (A, B) => [[A.fz, -A.fx, A.hw], [A.fx, A.fz, A.hd]].some(([ax, az, h]) => { const p = corners(B).map(([x, z]) => (x - A.x) * ax + (z - A.z) * az); return Math.min(...p) >= h || Math.max(...p) <= -h; });
const overlaps = (A, B) => !apart(A, B) && !apart(B, A);
const polyArea = (p) => { let a = 0; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) a += p[j] * p[i + 1] - p[i] * p[j + 1]; return Math.abs(a) / 2; };
// the store's walls must stay off every road (centreline + half width; service lanes too, bridges pass over)
function onRoad(s) {
  const fx = Math.sin(s.face), fz = Math.cos(s.face);
  for (const id of W.edgesNear(s.cx, s.cz, 30)) {
    const e = W.G.edges[id], { pts } = e, r = e.width / 2;
    if (e.bridge) continue;
    for (let i = 2; i < pts.length; i += 2) {
      const n = Math.ceil(Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]));
      for (let k = 0; k <= n; k++) {
        const dx = pts[i - 2] + ((pts[i] - pts[i - 2]) * k) / n - s.cx, dz = pts[i - 1] + ((pts[i + 1] - pts[i - 1]) * k) / n - s.cz;
        if (Math.abs(dx * fz - dz * fx) < s.w / 2 + r && Math.abs(dx * fx + dz * fz) < s.d / 2 + r) return true;
      }
    }
  }
  return false;
}
// tiles whose buildings city/data.js checks against lot L
const lotTiles = (L) => { const out = []; for (let tx = Math.floor((L.x - 230) / TILE); tx <= Math.floor((L.x + 30) / TILE); tx++) for (let tz = Math.floor((L.z - 230) / TILE); tz <= Math.floor((L.z + 30) / TILE); tz++) if (lotNear(L, tx * TILE, tz * TILE)) out.push([tx, tz]); return out; };
// a lot is fine when it misses roads, other lots and landmarks, and every OSM building it would knock down is
// small (under 2.5x the lot): a big block or mall next to a store stays, the store moves along the street instead
async function fits(s, tileB) {
  const L = lotOf(s), big = 2.5 * 4 * L.hw * L.hd;
  if (onRoad(s) || [...stores.filter((o) => o.w).map(lotOf), ...lots.extra].some((o) => overlaps(L, o))) return false;
  for (const [tx, tz] of lotTiles(L)) for (const rec of await tileB(tx, tz)) if (lotHits(L, rec[0], tx * TILE, tz * TILE) && polyArea(rec[0]) > big) return false;
  return true;
}
// the first spot near (px, pz) whose lot fits; no spot -> no store (there are plenty)
async function place(store, px, pz, tileB, far = false) {
  for (const f of spots(px, pz, far)) {
    const s = { ...store, ...f, cooldown: 0, progress: 0 };
    [s.w, s.d] = WALK_IN[s.kind];
    s.cx = s.x + Math.sin(s.face) * (2 + s.d / 2); s.cz = s.z + Math.cos(s.face) * (2 + s.d / 2);
    if (await fits(s, tileB)) { stores.push(s); return; }
  }
}
// stable pick from a list by position (so a store keeps its name whatever order the map loads in)
const hashPick = (list, x, z) => list[Math.abs(Math.floor(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453)) % list.length];
// Davenport's hand-placed stores; every other town gets an Arnett Arms and a Tim's Threads near its middle (planned with that chunk)
const FIXED = [[60, -330, 'Arnett Arms', 'guns'], [300, -3990, 'Arnett Arms', 'guns'], [-30, -1450, 'Arnett Auto', 'body'], [230, 40, "Tim's Threads", 'clothes'], [420, -4200, "Tim's Threads", 'clothes']];
const ROB_KINDS = ['fuel', 'convenience', 'alcohol'];
// Plans the stores whose real spot lies in `area` (one 2 km road chunk; city/data.js calls this lazily as you travel).
// Density matches Davenport's: up to 2 robbable gas/corner stores per chunk (220 m apart), every real bar, the hospital pharmacies.
async function planStores(tileB, area) {
  const inA = (p) => p.x >= area.x0 && p.x < area.x1 && p.z >= area.z0 && p.z < area.z1;
  const poi = W.D.index.poi.filter(inA);
  const spaced = (list, minD) => { const out = []; for (const p of list) if (!out.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < minD)) out.push(p); return out; };
  const rob = spaced(poi.filter((p) => ROB_KINDS.includes(p.kind)).sort((a, b) => a.x - b.x || a.z - b.z), 220).slice(0, 2);
  const bars = poi.filter((p) => p.kind === 'bar' || p.kind === 'pub');
  const fixed = FIXED.filter(([x, z]) => inA({ x, z }));
  for (const t of W.D.index.towns) {
    if (t.name === 'Davenport' || !inA(t) || !(t.pop >= 1500 || t.place === 'city' || t.place === 'town')) continue;
    // at the real shop nearest the town's middle
    const shops = W.D.index.poi.filter((p) => p.name && Math.hypot(p.x - t.x, p.z - t.z) < Math.max(600, t.r * 0.6) && (p.kind === 'clothes' || p.kind === 'department_store' || p.kind === 'mall' || p.kind === 'hardware' || p.kind === 'supermarket' || p.kind === 'convenience'));
    const near = (k) => shops.filter((p) => !k || p.kind === k).sort((a, b) => Math.hypot(a.x - t.x, a.z - t.z) - Math.hypot(b.x - t.x, b.z - t.z))[0];
    const g = near('hardware') || near() || t, c = near('clothes') || near('department_store') || shops.find((p) => p !== g) || { x: t.x + 120, z: t.z };
    fixed.push([g.x, g.z, 'Arnett Arms', 'guns'], [c.x, c.z, "Tim's Threads", 'clothes']);
  }
  // fetch the tiles round every spot at once (the checks below then wait on them one by one)
  await Promise.all([...rob, ...bars, ...fixed.map(([x, z]) => ({ x, z }))].flatMap((p) => lotTiles({ x: p.x, z: p.z, hw: 0, hd: 0 })).map(([tx, tz]) => tileB(tx, tz)));
  const before = stores.length;
  for (const p of rob) await place({ name: hashPick(ROB_NAMES, p.x, p.z), kind: 'rob' }, p.x, p.z, tileB);
  for (const [x, z, name, kind] of fixed) {
    if (WALK_IN[kind]) await place({ name, kind }, x, z, tileB, true);
    else { const f = frontOf(x, z); if (f) stores.push({ name, kind, ...f, cooldown: 0, progress: 0 }); }
  }
  for (const h of W.D.index.hospitals) if (inA(h)) { const f = frontOf(h.x, h.z); if (f) stores.push({ name: 'Hospital pharmacy', kind: 'meds', ...f }); }
  // downtown bars sit door to door: a bar slides along the street past the stores and bars already placed
  for (const p of bars) await place({ name: hashPick(BAR_NAMES, p.x, p.z), kind: 'bar' }, p.x, p.z, tileB);
  const added = stores.slice(before);
  if (scene) markStores(added);
  return added;
}
// city/data.js awaits this for each chunk before building tiles near it, and drops any OSM building on these lots
lots.plan = async (tileB, area) => (await planStores(tileB, area)).filter((s) => s.w).map(lotOf);
function markStores(list) {
  // a soft glowing ring on the sidewalk for the walk-up counters (pharmacy, body shop); walk-in stores are buildings (interiors.js)
  const ringGeo = new THREE.RingGeometry(0.7, 0.9, 28).rotateX(-Math.PI / 2);
  const COL = { body: 0x4aa3ff, meds: 0xffffff };
  for (const s of list) if (!s.w && !s.ring) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: COL[s.kind], transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(s.x, W.groundHeight(s.x, s.z) + 0.12, s.z); scene.add(m); s.ring = m;
  }
}
export function storeNear(x, z, r = 3.2) {
  let best = null, bd = r;
  for (const s of stores) { if (s.w) continue; const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } } // walk-in stores have a real door instead
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
