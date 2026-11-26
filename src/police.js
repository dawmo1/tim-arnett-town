// Police. The host's computer runs every unit and shares them 5x a second; everyone else draws them.
// Unit kinds: 0 patrol car, 1 roadblock car, 2 officer on foot, 3 helicopter, 4 spike strip.
// Ids starting with 's' (SWAT van) or 'w' (SWAT officer) are the heavy squad at 4+ stars.
// Every unit rolls out of a station (stations()); parked cruisers (u.parked, no target) wait outside them.
import * as THREE from 'three';
import * as W from './world.js';
import { makeVehicle, stepVehicle, collideVehicles, circles, charVehicle, POLICE, V, farCarAdd } from './vehicles.js';
import { animateWheels } from './carmodel.js';
import { makeCharacter, animateCharacter, placeCharacter, mat } from './character.js';
import { ragdoll, ragPos } from './ragdoll.js';
import * as nav from './nav.js';
import * as fx from './fx.js';
import { clamp, angDiff } from './util.js';
import { hitByCar } from './breakables.js';

export const cops = new Map();
// ids start at a random offset: several group hosts run cops at once and hit/bump events name units by id
let scene, ctx, nextId = Math.floor(Math.random() * 1e6), spawnT = 0, syncT = 0;
const rbTimer = {}, since = {};
const OFFICER_LOOKS = [[0xe0ac69, 0x1f3a93, 0x111111, 0x111111], [0x8d5524, 0x1f3a93, 0x111111, 0x111111], [0xffdbac, 0x1f3a93, 0x111111, 0x3b2314], [0xc68642, 0x1f3a93, 0x111111, 0x111111]];

export function initPolice(s, c) { scene = s; ctx = c; }
export const posOf = (u) => (u.kind < 2 ? u.v : u);
export const isDown = (u) => (u.kind === 4 ? true : u.kind < 2 ? u.v.exploded || u.v.hp <= 0 : u.dead);

// ---------- creation ----------
function spawnCar(id, x, z, h, kind, target, existing = null) {
  const swat = id[0] === 's';
  const v = existing || makeVehicle(id, swat ? V.VAN : POLICE, swat ? 0x15171b : 0xffffff, { x, z, h });
  if (swat) { v.T = { ...v.T, siren: true, hp: 320 }; v.hp = 320; v.sirenOn = true; }
  v.mode = 'cop'; v.ag = null;
  v.mesh.userData.driverHead.visible = true;
  if (!existing) scene.add(v.mesh);
  const u = { id, kind, v, target, life: kind ? 40 : 1e9, cd: 1 + Math.random(), stuckT: 0, revT: 0, seq: 0, shot: [0, 0, 0], noTarget: 0, ramCd: 0, fire: null, deployed: [], recall: false, waitT: 0, deployCd: 0 };
  cops.set(id, u);
  return u;
}
let flankN = 0;
function spawnOfficer(id, x, z, h, target, car) {
  const swat = id[0] === 'w';
  const ch = makeCharacter(null, { role: swat ? 'swat' : 'police' });
  scene.add(ch.g);
  const u = { id, kind: 2, ch, x, z, y: W.groundHeight(x, z), h, hp: swat ? 120 : 60, target, car, cd: 0.8 + Math.random(), seq: 0, shot: [0, 0, 0], dead: false, deadAt: 0, spd: 0, idle: 0, swat, flank: [0, 1, -1][flankN++ % 3] };
  cops.set(id, u);
  return u;
}
// a spike strip laid across the road ahead of a roadblock
let spikeMat = null;
function spawnSpike(id, x, z, h, target) {
  spikeMat = spikeMat || new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.7 });
  const g = new THREE.Group(), w = 7;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.35), spikeMat); bar.position.y = 0.03; g.add(bar);
  for (let i = 0; i < 18; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), spikeMat); s.position.set(-w / 2 + (i + 0.5) * (w / 18), 0.1, (i % 2 - 0.5) * 0.18); g.add(s); }
  g.position.set(x, W.groundHeight(x, z) + 0.02, z); g.rotation.y = h; scene.add(g);
  const u = { id, kind: 4, mesh: g, x, z, h, w, target, life: 45, seq: 0, shot: [0, 0, 0] };
  cops.set(id, u);
  return u;
}
// cars crossing a strip burst their tyres (returns true once per strip per car)
export function spikesHit(v) {
  for (const u of cops.values()) {
    if (u.kind !== 4) continue;
    const dx = v.x - u.x, dz = v.z - u.z;
    const along = dx * Math.cos(u.h) - dz * Math.sin(u.h), across = dx * Math.sin(u.h) + dz * Math.cos(u.h);
    if (Math.abs(along) < u.w / 2 + 0.5 && Math.abs(across) < 0.6) return true;
  }
  return false;
}
function heliMesh() {
  const g = new THREE.Group();
  const add = (c, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat(c)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  add(0x1f3a93, 2.4, 1.9, 4.6, 0, 0, 0.3);
  add(0xffffff, 2.42, 0.5, 4.62, 0, -0.4, 0.3);
  add(0x26323f, 2.0, 1.0, 1.2, 0, 0.2, 2.4);
  add(0x1f3a93, 0.5, 0.5, 4.5, 0, 0.3, -3.8);
  add(0x1f3a93, 0.1, 1.4, 0.8, 0, 0.9, -5.9);
  add(0x333333, 0.12, 0.12, 3.6, 0.9, -1.3, 0.3); add(0x333333, 0.12, 0.12, 3.6, -0.9, -1.3, 0.3);
  add(0x333333, 0.12, 0.5, 0.12, 0.9, -1.05, 1.2); add(0x333333, 0.12, 0.5, 0.12, -0.9, -1.05, 1.2);
  const rotor = new THREE.Group(); rotor.position.set(0, 1.2, 0.3); g.add(rotor);
  for (const r of [0, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 10), mat(0x222222)); b.rotation.y = r; rotor.add(b); }
  const lightR = new THREE.MeshBasicMaterial({ color: 0xff1744 }), lightB = new THREE.MeshBasicMaterial({ color: 0x2979ff });
  const lr = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), lightR); lr.position.set(0.6, 1, 1.5); g.add(lr);
  const lb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), lightB); lb.position.set(-0.6, 1, 1.5); g.add(lb);
  g.userData = { rotor, lights: [lightR, lightB] };
  return g;
}
function spawnHeli(id, x, y, z, target) {
  const mesh = heliMesh();
  scene.add(mesh);
  const u = { id, kind: 3, mesh, x, y, z, h: 0, vy: 0, hp: 300, target, cd: 2, seq: 0, shot: [0, 0, 0], dead: false, deadAt: 0, life: 6, exploded: false, noTarget: 0 };
  cops.set(id, u);
  return u;
}
function remove(id) {
  const u = cops.get(id);
  if (!u) return;
  if (u.kind < 2) { fx.stopFire(u.fire); scene.remove(u.v.mesh); }
  else if (u.kind === 2) { scene.remove(u.ch.g); if (u.agent) nav.removeAgent(u.agent); }
  else scene.remove(u.mesh);
  cops.delete(id);
}
// A patrol car that saw the crime joins the chase.
export function adoptCar(v, target) { const u = spawnCar('c' + nextId++, v.x, v.z, v.h, 0, target, v); u.aimT = 0; return u; }
// Attacked at (x, z) by player uid (rammed, shot at): parked cruisers, idle officers and cars heading home nearby
// take the call, and the radio skips the usual wait so backup rolls out of the station right away. Host only.
export function alert(x, z, uid) {
  since[uid] = ctx.now() - 2500;
  for (const u of cops.values()) {
    if (isDown(u) || u.kind > 2) continue;
    const P = posOf(u);
    if (Math.hypot(P.x - x, P.z - z) > 90) continue;
    if (u.parked) u.parked = null;
    if (!u.target) { u.target = uid; u.aimT = 0; u.idle = 0; }
  }
}
// ---------- stations & dispatch ----------
// The OSM police stations. Units roll out from them and drive the streets to the suspect.
const NAMES = { 'Davenport Police Department': 'Davenport Police HQ', 'Scott County Sheriffs Office': 'Scott County Sheriff' };
let ST = null, P = [];
export function stations() {
  if (!ST && W.places.police) ST = W.places.police.map((p) => { p.name = NAMES[p.name] || p.name; return { name: p.name, x: p.x, z: p.z, lot: null }; });
  return ST || [];
}
const byDist = (x, z) => stations().map((s) => [Math.hypot(s.x - x, s.z - z), s]).sort((a, b) => a[0] - b[0]);
// nobody can see (x, z): every player is far off or has a building in the way
const unseen = (x, z, r) => P.every((o) => Math.hypot(o.x - x, o.z - z) > r && !W.lineOfSight(o.x, (o.y || 0) + 1.6, o.z, x, W.groundHeight(x, z) + 1.2, z));
// three spots on the curb in front of the station, nose to tail
function lotOf(s) {
  if (s.lot) return s.lot;
  const q = W.nearestEdge(s.x, s.z, 120, (e) => e.cls !== 'motor' && !e.bridge);
  if (!q) return (s.lot = []);
  const nx = Math.cos(q.h), nz = -Math.sin(q.h), side = (s.x - q.x) * nx + (s.z - q.z) * nz > 0 ? 1 : -1, off = q.e.width / 2 + 1.4;
  return (s.lot = [-6.5, 0, 6.5].map((k) => { const c = W.pushOutCircle(q.x + nx * side * off + Math.sin(q.h) * k, q.z + nz * side * off + Math.cos(q.h) * k, 1.4); return { x: c.x, z: c.z, h: q.h }; }));
}
// Parked cruisers appear while no player can see the lot and go away once everyone is far.
function stockStations() {
  for (const s of stations()) {
    const near = Math.min(...P.map((o) => Math.hypot(o.x - s.x, o.z - s.z)));
    if (near > 650) { for (const u of [...cops.values()]) if (u.parked === s) remove(u.id); continue; }
    if (near > 450) continue;
    lotOf(s).forEach((q, k) => {
      if ([...cops.values()].some((u) => u.parked === s && u.slot === k) || !unseen(q.x, q.z, 90)) return;
      const u = spawnCar('c' + nextId++, q.x, q.z, q.h, 0, null); u.parked = s; u.slot = k;
    });
  }
}
// The next unit for suspect p (pre 'c' cruiser, 's' SWAT van): a parked cruiser at the nearest station,
// else a fresh car pulling out of that station. Response time is the drive over.
function dispatch(pre, p, cx, cz) {
  const near = byDist(cx, cz).filter(([d]) => d < 1500);
  for (const [, s] of near) {
    const u = pre === 'c' && [...cops.values()].find((o) => o.parked === s && !isDown(o));
    if (u) { u.parked = null; u.target = p.uid; u.aimT = 0; return u; }
    const q = W.roadNear(s.x, s.z, cx, cz);
    if (q && !P.some((o) => Math.hypot(o.x - q.x, o.z - q.z) < 30) && ![...cops.values()].some((o) => o.kind < 2 && Math.hypot(o.v.x - q.x, o.v.z - q.z) < 8)) { const c = spawnCar(pre + nextId++, q.x, q.z, q.h, 0, p.uid); c.aimT = 0; return c; }
  }
  if (near.length) return null; // station's driveway is busy: try again next second
  // shortcut: every station is over 1.5 km away, so the unit is one already out on the far streets. It appears
  // on a road 240-340 m off that no player can see (never pops in on screen); a real patrol grid would replace this.
  const q = W.roadSpot(cx, cz, 240, 340);
  if (!q || !unseen(q.x, q.z, 200)) return null;
  const c = spawnCar(pre + nextId++, q.x, q.z, q.h, 0, p.uid); c.aimT = 0; return c;
}
function shoot(u, from, p, acc, dmg) {
  const hit = Math.random() < acc;
  u.seq++;
  u.shot = [p.x + (hit ? 0 : (Math.random() - 0.5) * 5), (p.y || 0) + (p.inVeh ? 1 : 1.2), p.z + (hit ? 0 : (Math.random() - 0.5) * 5)];
  ctx.copShot(from, u.shot);
  if (hit) ctx.damagePlayer(p.uid, dmg, 'the police');
}

// ---------- host simulation ----------
// players: [{uid, x, z, vx, vz, speed, stars, alive, inVeh}]
export function hostUpdate(dt, players) {
  const now = ctx.now();
  P = players;
  spawnT -= dt;
  const tick = spawnT <= 0; // once a second: the line-of-sight checks
  if (tick) {
    spawnT = 1;
    stockStations();
    for (const p of players) {
      if (!p.alive || p.stars <= 0) { delete since[p.uid]; continue; }
      since[p.uid] ??= now;
      // 1-2 stars: a couple of cruisers; 3: + roadblocks; 4: + SWAT van and helicopter; 5: everything, more of it
      const want = [0, 2, 2, 3, 4, 6][p.stars];
      let have = 0, heli = false, swat = 0;
      for (const u of cops.values()) {
        if (u.target !== p.uid) continue;
        if (u.kind === 0 && !isDown(u)) { have++; if (u.id[0] === 's') swat++; }
        if (u.kind === 3 && !u.dead) heli = true;
      }
      const cx = p.search ? p.lkx : p.x, cz = p.search ? p.lkz : p.z;
      // patrol cars already on the streets nearby get adopted first (main.js); the station rolls out 2.5 s later
      if (have < want && now - since[p.uid] > 2500) dispatch('c', p, cx, cz);
      if (p.stars >= 4 && !heli) {
        // lifts off the nearest station's roof and flies over (speed-capped in heliStep), or comes in high from out of sight
        const st = byDist(cx, cz)[0], a = Math.random() * Math.PI * 2, home = st && st[0] < 3000;
        const hx = home ? st[1].x : cx + Math.cos(a) * 600, hz = home ? st[1].z : cz + Math.sin(a) * 600;
        spawnHeli('h' + nextId++, hx, W.groundHeight(hx, hz) + (home ? 25 : 80), hz, p.uid);
        ctx.announce?.(p.uid, 'POLICE HELICOPTER INBOUND');
      }
      if (p.stars >= 4 && swat < (p.stars >= 5 ? 2 : 1) && dispatch('s', p, cx, cz)) ctx.announce?.(p.uid, 'SWAT INBOUND');
      if (p.stars >= 3) {
        rbTimer[p.uid] = (rbTimer[p.uid] ?? 3) - 1;
        if (rbTimer[p.uid] <= 0) {
          rbTimer[p.uid] = p.stars >= 5 ? 15 : 25;
          // set up out of the suspect's sight if a closer spot allows it, else far enough to be a speck
          const sp = Math.hypot(p.vx, p.vz) || 1;
          let q = null;
          for (const ahead of [150, 220]) {
            q = W.nearestEdge(p.x + (p.vx / sp) * ahead, p.z + (p.vz / sp) * ahead, 60, (e) => e.cls !== 'service' && !e.bridge);
            if (q && (ahead === 220 || unseen(q.x, q.z, 0))) break;
          }
          if (q) {
            for (const dd of [-1, 1]) { const o = dd * q.e.width / 4; spawnCar('r' + nextId++, q.x - Math.cos(q.h) * o, q.z + Math.sin(q.h) * o, q.h + Math.PI / 2, 1, p.uid); }
            // spikes 12 m before the block, on the side the suspect is coming from
            const tx = Math.sin(q.h), tz = Math.cos(q.h), toward = ((p.x - q.x) * tx + (p.z - q.z) * tz) > 0 ? 1 : -1;
            spawnSpike('k' + nextId++, q.x + tx * 12 * toward, q.z + tz * 12 * toward, q.h, p.uid);
          }
        }
      }
    }
  }

  const vehicles = ctx.vehicles();
  const findTarget = (u) => {
    let p = players.find((q) => q.uid === u.target && q.alive && q.stars > 0);
    if (!p) { p = players.find((q) => q.alive && q.stars > 0); if (p) u.target = p.uid; }
    if (!p || !p.search) return p;
    // suspect is hiding: sweep around the last known spot instead of homing in on them
    if (!u.sweep || now > u.sweep.until || Math.hypot(u.sweep.cx - p.lkx, u.sweep.cz - p.lkz) > 1) {
      const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 35;
      u.sweep = { cx: p.lkx, cz: p.lkz, x: p.lkx + Math.cos(a) * r, z: p.lkz + Math.sin(a) * r, until: now + 7000 };
    }
    return { ...p, x: u.sweep.x, z: u.sweep.z, sweeping: true };
  };
  for (const u of [...cops.values()]) {
    if (u.kind === 4) { u.life -= dt; if (u.life <= 0) remove(u.id); continue; }
    if (u.kind === 2) { officerStep(u, dt, now, findTarget(u)); continue; }
    if (u.kind === 3) { heliStep(u, dt, now, findTarget(u)); continue; }
    const v = u.v;
    if (v.exploded) { u.life = Math.min(u.life, 6) - dt; if (u.life <= 0) remove(u.id); continue; }
    if (v.hp <= 0) {
      // wrecked: engine dead. Only catches fire if you keep wrecking it.
      if (!v.burnAt && v.hp <= -v.T.hp * 0.4) v.burnAt = now;
      stepVehicle(v, { handbrake: true }, dt);
      if (v.burnAt && now - v.burnAt > 12000) { v.exploded = true; ctx.explode(v.x, v.y, v.z, 'a police car'); }
      continue;
    }
    if (u.kind === 1) { u.life -= dt; if (u.life <= 0 && tick && unseen(v.x, v.z, 120)) remove(u.id); continue; }
    if (u.parked) { stepVehicle(v, { handbrake: true }, dt); continue; } // empty, waiting at the station
    let p = findTarget(u);
    u.deployCd -= dt;
    // officers are out: wait parked, call them back when the suspect drives off
    if (u.deployed.length) {
      stepVehicle(v, { handbrake: true }, dt);
      if (!p || (p.inVeh && p.speed > 4) || Math.hypot(p.x - v.x, p.z - v.z) > 70) u.recall = true;
      if (u.recall) {
        u.waitT += dt;
        u.deployed = u.deployed.filter((id) => cops.has(id) && !cops.get(id).dead);
        if (!u.deployed.length || u.waitT > 8) { u.deployed = []; u.recall = false; u.waitT = 0; u.deployCd = 5; }
      }
      continue;
    }
    if (!p) {
      // chase over: lights off, drive back to the station, and only vanish once nobody can see the car
      u.target = null; u.noTarget += dt;
      if (tick && unseen(v.x, v.z, 120)) { remove(u.id); continue; }
      const st = byDist(v.x, v.z)[0];
      if (!st) { stepVehicle(v, { handbrake: true }, dt); continue; }
      p = { x: st[1].x, z: st[1].z, home: true, inVeh: true, speed: 0 };
    } else u.noTarget = 0;
    const dx = p.x - v.x, dz = p.z - v.z, dist = Math.hypot(dx, dz);
    // suspect on foot (or sitting in a stopped car at 2+ stars) and we're close: stop, get out, take cover, return fire
    if ((!p.inVeh || (p.stars >= 2 && (p.speed || 0) < 3 && !p.home)) && dist < 18 && Math.abs(v.speed) < 3 && u.deployCd <= 0 && (!p.sweeping || dist < 12)) {
      const lx = Math.cos(v.h), lz = -Math.sin(v.h);
      const swat = u.id[0] === 's';
      for (const side of swat ? [1, -1, 1, -1] : [1, -1]) {
        const back = u.deployed.length >= 2 ? -2.2 : 0;
        const o = spawnOfficer((swat ? 'w' : 'o') + nextId++, v.x + lx * side * 1.8 - Math.sin(v.h) * back, v.z + lz * side * 1.8 - Math.cos(v.h) * back, v.h, p.uid, u.id);
        u.deployed.push(o.id);
      }
      u.recall = false; u.waitT = 0;
      continue;
    }
    // far away: follow the streets (GPS route); close and in sight: drive straight at them
    let gx = p.x, gz = p.z;
    u.pathT = (u.pathT || 0) - dt;
    if (u.pathT <= 0) { u.pathT = 2.5; u.path = dist > 45 ? W.route(v.x, v.z, p.x, p.z, { any: true, heading: v.h }) : null; u.pi = 0; }
    if (u.path && dist > 30) {
      while (u.pi < u.path.length - 1 && Math.hypot(u.path[u.pi][0] - v.x, u.path[u.pi][1] - v.z) < 11) u.pi++;
      gx = u.path[u.pi][0]; gz = u.path[u.pi][1];
    }
    // chasing a car up close: go for its rear quarter to spin it out (PIT)
    if (p.inVeh && dist < 16 && p.speed > 6) {
      const sp = p.speed || 1, fx_ = (p.vx || 0) / sp, fz_ = (p.vz || 0) / sp, side = ((v.x - p.x) * fz_ - (v.z - p.z) * fx_) > 0 ? 1 : -1;
      gx = p.x - fx_ * 1.2 + fz_ * side * 1.3; gz = p.z - fz_ * 1.2 - fx_ * side * 1.3;
    }
    const ad = angDiff(v.h, Math.atan2(gx - v.x, gz - v.z));
    let inp = { throttle: Math.abs(ad) > 0.7 && v.speed > 13 ? 0 : 1, brake: Math.abs(ad) > 0.9 && v.speed > 15 ? 0.6 : 0, steer: clamp(ad * 2, -1, 1), handbrake: Math.abs(ad) > 1.3 && v.speed > 12 };
    if (dist < (p.sweeping ? 6 : 10 + Math.abs(v.speed) * 0.9) && (!p.inVeh || (p.stars >= 2 && (p.speed || 0) < 3 && !p.home))) inp = { throttle: 0, brake: v.speed > 0.5 ? 1 : 0, steer: inp.steer };
    if (p.home && (v.speed > 12 || dist < 15)) inp = { throttle: 0, brake: dist < 15 ? 1 : 0.3, steer: inp.steer }; // no hurry heading home
    if (u.revT > 0) { u.revT -= dt; inp = { throttle: 0, brake: 1, steer: -inp.steer }; }
    else if (inp.throttle > 0 && Math.abs(v.speed) < 1.5) {
      u.stuckT += dt;
      if (u.stuckT > 1.5) { u.revT = 1.3; u.stuckT = 0; u.unstick = (u.unstick || 0) + 1; }
      // wedged for good and nobody's watching: send a fresh unit instead
      if (u.unstick > 4 && dist > 70) { remove(u.id); continue; }
    }
    else if (Math.abs(v.speed) > 6) u.unstick = 0;
    else u.stuckT = 0;
    const imp = stepVehicle(v, inp, dt);
    hitByCar(v); // cruisers in a chase knock over street props too
    if (imp > 10) v.hp -= (imp - 10) * 2;
    for (const o of vehicles) if (Math.abs(o.x - v.x) < 8 && Math.abs(o.z - v.z) < 8 && !o.exploded) collideVehicles(v, o, false);
    for (const o of cops.values()) if (o.kind < 2 && o.v !== v && Math.abs(o.v.x - v.x) < 8 && Math.abs(o.v.z - v.z) < 8) collideVehicles(v, o.v, false);
    u.ramCd -= dt;
    if (u.ramCd <= 0 && Math.abs(v.speed) > 6) {
      for (const q of players) {
        if (!q.alive || q.inVeh) continue;
        if (circles(v).some((c) => Math.hypot(c.x - q.x, c.z - q.z) < c.r + 0.5)) { ctx.damagePlayer(q.uid, Math.abs(v.speed) * 3, 'the police'); u.ramCd = 1; }
      }
    }
    // shoot from the side window only (no shooting through the windshield)
    u.cd -= dt;
    const side = Math.abs(angDiff(v.h, Math.atan2(dx, dz)));
    const canShoot = !p.sweeping && !p.home && dist < 30 && (side > 0.9 || Math.abs(v.speed) < 3) && W.lineOfSight(v.x, v.y + 1.4, v.z, p.x, (p.y || 0) + 1.2, p.z);
    u.aimT = canShoot ? (u.aimT || 0) + dt : 0; // they need a moment to line up a shot
    if (u.cd <= 0 && canShoot && u.aimT > 1.2) {
      u.cd = 1.8 - p.stars * 0.12;
      let acc = 0.1 + p.stars * 0.03;
      if (p.speed > 10) acc *= 0.5;
      if (Math.abs(v.speed) > 5) acc *= 0.6;
      shoot(u, { x: v.x, y: v.y + 1.5, z: v.z }, p, acc, 6 + Math.random() * 3);
    }
  }

  syncT -= dt;
  if (syncT <= 0) {
    syncT = 0.2;
    const obj = {};
    for (const u of cops.values()) {
      const P = posOf(u), y = u.kind < 2 ? u.v.y : u.y;
      const dead = u.kind < 2 ? (u.v.exploded ? 1 : 0) : u.dead ? 1 : 0;
      obj[u.id] = [r1(P.x), r1(P.z), r2(P.h), Math.round(u.kind < 2 ? u.v.hp : u.hp), u.seq, r1(u.shot[0]), r1(u.shot[1]), r1(u.shot[2]), u.kind, dead, u.target || '', (u.kind < 2 ? u.v.burnAt : 0) || 0, r1(y || 0), r1(u.spd || 0), u.parked ? 1 : 0];
    }
    ctx.sync(obj);
  }
}
const r1 = (n) => Math.round(n * 10) / 10, r2 = (n) => Math.round(n * 100) / 100;

function officerStep(u, dt, now, p) {
  if (u.dead) { if (u.agent) { nav.removeAgent(u.agent); u.agent = null; } if (now - u.deadAt > 15000) remove(u.id); return; }
  const car = cops.get(u.car);
  const goCar = car && car.kind === 0 && car.recall && !isDown(car);
  let tx, tz;
  if (goCar) { tx = car.v.x; tz = car.v.z; }
  else if (p) { tx = p.x; tz = p.z; u.idle = 0; }
  else { u.idle += dt; u.spd = 0; if (u.idle > 15 && Math.random() < dt && unseen(u.x, u.z, 60)) remove(u.id); return; } // ~1 LOS check a second
  let dx = tx - u.x, dz = tz - u.z, dist = Math.hypot(dx, dz);
  const tdist = dist, tdx = dx, tdz = dz;
  if (goCar && dist < 2.4) { remove(u.id); return; } // got back in
  // in a gunfight: get to cover (a car between you and the suspect) or work round their flank
  u.coverT = (u.coverT || 0) - dt;
  if (!goCar && p && !p.sweeping && dist < 34) {
    if (u.coverT <= 0) {
      u.coverT = 3 + Math.random() * 2; u.coverAt = null;
      let best = 15;
      for (const o of [...ctx.vehicles(), ...[...cops.values()].filter((c) => c.kind < 2).map((c) => c.v)]) {
        const d = Math.hypot(o.x - u.x, o.z - u.z); if (d > best) continue;
        const ox = o.x - p.x, oz = o.z - p.z, ol = Math.hypot(ox, oz) || 1;
        if (ol < 6) continue;
        best = d; u.coverAt = { x: o.x + (ox / ol) * (o.T.wid / 2 + 0.9), z: o.z + (oz / ol) * (o.T.wid / 2 + 0.9) };
      }
      if (!u.coverAt && u.flank) { const a = Math.atan2(u.x - p.x, u.z - p.z) + u.flank * 0.9; u.coverAt = { x: p.x + Math.sin(a) * 14, z: p.z + Math.cos(a) * 14, flank: true }; }
    }
    if (u.coverAt) { tx = u.coverAt.x; tz = u.coverAt.z; }
  } else u.coverAt = null;
  const cdx = tx - u.x, cdz = tz - u.z, cdist = Math.hypot(cdx, cdz);
  let move = 0;
  if (goCar) move = 5.5;
  else if (u.coverAt) move = cdist > 0.8 ? 5.5 : 0;
  else if (dist > (p.sweeping ? 3 : 11)) move = p.sweeping ? 3.5 : 5.2;
  else if (dist < 5) move = -2;
  u.inCover = !!(u.coverAt && !u.coverAt.flank && cdist < 1.2);
  if (u.coverAt) { dx = cdx; dz = cdz; dist = cdist; }
  u.h += angDiff(u.h, move > 0 && !u.inCover ? Math.atan2(dx, dz) : Math.atan2(tdx, tdz)) * Math.min(1, dt * 8);
  if (!u.agent && nav.navReady()) u.agent = nav.addAgent(u.x, u.z, 5.5);
  if (u.agent) {
    // path around buildings and other people
    u.retarget = (u.retarget || 0) - dt;
    if (u.retarget <= 0) {
      u.retarget = 0.4;
      nav.setSpeed(u.agent, Math.abs(move) || 3);
      if (move > 0) nav.moveTo(u.agent, tx, tz);
      else if (move < 0) nav.moveTo(u.agent, u.x - dx / (dist || 1) * 4, u.z - dz / (dist || 1) * 4);
      else u.agent.resetMoveTarget();
    }
    const st = nav.agentState(u.agent);
    u.x = st.x; u.z = st.z; u.spd = st.speed;
  } else {
    if (move) {
      const nx = u.x + (dx / (dist || 1)) * move * dt, nz = u.z + (dz / (dist || 1)) * move * dt;
      const q = W.pushOutCircle(nx, nz, 0.4);
      if (W.isLand(q.x, q.z)) { u.x = q.x; u.z = q.z; }
    }
    u.spd = Math.abs(move);
  }
  u.y = W.groundHeight(u.x, u.z);
  u.cd -= dt;
  const canShoot = !goCar && p && !p.sweeping && tdist < 32 && W.lineOfSight(u.x, u.y + 1.4, u.z, p.x, (p.y || 0) + 1.2, p.z);
  u.aimT = canShoot ? (u.aimT || 0) + dt : 0;
  if (canShoot && u.cd <= 0 && u.aimT > 0.9) {
    u.cd = 1.2 + Math.random() * 0.8;
    let acc = (u.swat ? 0.22 : 0.15) + p.stars * 0.035;
    if (u.inCover) acc *= 0.85;
    if (p.inVeh) acc *= 0.6;
    if (p.speed > 6) acc *= 0.6;
    shoot(u, { x: u.x, y: u.y + 1.4, z: u.z }, p, acc, 7 + Math.random() * 3);
  }
}

function heliStep(u, dt, now, p) {
  if (u.dead) {
    u.vy -= 15 * dt; u.y += u.vy * dt; u.h += dt * 4;
    const gy = W.groundHeight(u.x, u.z) + 0.5;
    if (u.y <= gy && !u.exploded) { u.exploded = true; u.y = gy; ctx.explode(u.x, gy, u.z, 'a police helicopter'); }
    if (u.exploded) { u.life -= dt; if (u.life <= 0) remove(u.id); }
    return;
  }
  if (!p || p.stars < 4) {
    u.noTarget += dt; u.y += dt * 8;
    if (u.noTarget > 6) remove(u.id);
    return;
  }
  u.noTarget = 0;
  const t = now / 1000;
  const gx = p.x + Math.cos(t * 0.35) * 24, gz = p.z + Math.sin(t * 0.35) * 24, gy = Math.max(W.groundHeight(gx, gz), p.y || 0) + 28;
  const k = Math.min(1, dt * 0.8), mx = (gx - u.x) * k, mz = (gz - u.z) * k, cap = Math.min(1, (45 * dt) / (Math.hypot(mx, mz) || 1));
  u.x += mx * cap; u.z += mz * cap; u.y += (gy - u.y) * k; // 45 m/s top speed, so the flight from the station takes time
  u.h += angDiff(u.h, Math.atan2(p.x - u.x, p.z - u.z)) * Math.min(1, dt * 2);
  u.cd -= dt;
  const canShoot = !p.sweeping && W.lineOfSight(u.x, u.y - 1.5, u.z, p.x, (p.y || 0) + 1.2, p.z);
  u.aimT = canShoot ? (u.aimT || 0) + dt : 0;
  if (u.cd <= 0 && canShoot && u.aimT > 1.5) {
    u.cd = 1.1;
    shoot(u, { x: u.x, y: u.y - 1.2, z: u.z }, p, p.inVeh ? 0.07 : 0.12, 7);
  }
}

// ---------- everyone else: mirror the host ----------
export function applyRemote(obj) {
  for (const id of [...cops.keys()]) if (!obj[id]) remove(id);
  for (const [id, a] of Object.entries(obj)) {
    const kind = a[8];
    let u = cops.get(id);
    if (!u) {
      if (kind < 2) u = spawnCar(id, a[0], a[1], a[2], kind, a[10]);
      else if (kind === 2) u = spawnOfficer(id, a[0], a[1], a[2], a[10], '');
      else if (kind === 4) u = spawnSpike(id, a[0], a[1], a[2], a[10]);
      else u = spawnHeli(id, a[0], a[12], a[1], a[10]);
      u.seq = a[4];
    }
    u.target = a[10]; u.parked = !!a[14];
    if (kind < 2) {
      const v = u.v;
      v.tgt = { x: a[0], z: a[1], h: a[2], y: a[12] };
      v.hp = a[3]; v.burnAt = a[11];
      if (a[9] && !v.exploded) v.exploded = true;
    } else {
      u.tgt = { x: a[0], z: a[1], h: a[2], y: a[12] };
      u.hp = a[3]; u.spd = a[13];
      if (a[9] && !u.dead) { u.dead = true; u.deadAt = ctx.now(); if (kind === 2) fx.bloodPool(a[0], a[1], 1.4); }
    }
    if (a[4] !== u.seq) {
      u.seq = a[4]; u.shot = [a[5], a[6], a[7]];
      const P = kind < 2 ? u.v : u;
      ctx.copShot({ x: P.x, y: kind === 3 ? (u.y || 20) - 1.2 : (P.y || 0) + 1.45, z: P.z }, u.shot);
    }
  }
}

// Returns true if this hit killed the unit.
export function damageCop(id, dmg) {
  const u = cops.get(id);
  if (!u) return false;
  if (u.kind < 2) { const was = u.v.hp; u.v.hp = Math.max(-u.v.T.hp, u.v.hp - dmg); return was > 0 && u.v.hp <= 0; }
  if (u.dead) return false;
  u.hp -= dmg;
  if (u.hp <= 0) {
    u.dead = true; u.deadAt = ctx.now();
    if (u.kind === 2) fx.bloodPool(u.x, u.z, 1.4);
    if (u.kind === 3) u.vy = 0;
    return true;
  }
  return false;
}

export function render(dt, isHost, t, cam = null, farDist = 1e9) {
  const flash = Math.floor(t * 6) % 2;
  for (const u of cops.values()) {
    if (u.kind === 4) continue;
    if (u.kind < 2) {
      const v = u.v;
      if (!isHost && v.tgt) {
        const k = Math.min(1, dt * 8);
        v.x += (v.tgt.x - v.x) * k; v.z += (v.tgt.z - v.z) * k; v.h += angDiff(v.h, v.tgt.h) * k; v.y = v.tgt.y || 0;
      }
      v.mesh.position.set(v.x, v.y, v.z);
      v.mesh.rotation.y = v.h;
      v.mesh.userData.body.rotation.set(v.gp || 0, 0, v.gr || 0);
      animateWheels(v, dt);
      const isFar = cam && !u.fire && Math.hypot(v.x - cam.x, v.z - cam.z) > farDist && farCarAdd(v);
      v.mesh.visible = !isFar;
      const L = v.mesh.userData.lights;
      const on = flash && u.target; // light bar only while on a call
      if (L && !v.exploded) { L[0].color.setHex(on ? 0xff1744 : 0x550000); L[1].color.setHex(u.target && !flash ? 0x2979ff : 0x0d1b55); }
      v.mesh.userData.driverHead.visible = !v.exploded && !u.deployed?.length && !u.parked;
      if (v.burnAt && !v.exploded && !u.fire) u.fire = fx.startFire(v.mesh);
      if (v.hp <= 0 && !v.exploded && Math.random() < 0.3) fx.smokePuff(v.x, v.y + 1.2, v.z);
      if (v.exploded && !v.charred) { v.charred = true; fx.stopFire(u.fire); u.fire = null; charVehicle(v); v.mesh.userData.driverHead.visible = false; }
      if (v.hp > 0 && v.hp < 50) fx.damageSmoke(v);
      continue;
    }
    if (!isHost && u.tgt) {
      const k = Math.min(1, dt * 8);
      u.x += (u.tgt.x - u.x) * k; u.z += (u.tgt.z - u.z) * k; u.h += angDiff(u.h, u.tgt.h) * k; u.y += ((u.tgt.y || 0) - u.y) * k;
    }
    if (u.kind === 2) {
      if (u.dead && !u.ragged) { u.ragged = true; const k = u.hitDir || { x: 0, z: 0 }; ragdoll(u.ch, { x: k.x * 4, y: 2, z: k.z * 4 }, { dead: true }); }
      if (u.ch.rag) { const rp = ragPos(u.ch); if (!isHost) { u.x = rp.x; u.z = rp.z; } continue; }
      placeCharacter(u.ch, u.x, u.y ?? W.groundHeight(u.x, u.z), u.z, u.h);
      animateCharacter(u.ch, dt, { speed: u.spd || 0, aim: !u.dead && !(u.inCover && (u.aimT || 0) < 0.5), dead: u.dead, weapon: 'gun', wmodel: u.swat ? 'rifle' : 'pistol', rifle: u.swat, cover: u.inCover && (u.aimT || 0) < 0.5 });
    } else {
      u.mesh.position.set(u.x, u.y, u.z);
      u.mesh.rotation.y = u.h;
      u.mesh.rotation.z = u.dead ? Math.sin(t * 9) * 0.3 : 0;
      u.mesh.userData.rotor.rotation.y += dt * 30;
      const L = u.mesh.userData.lights;
      L[0].color.setHex(flash ? 0xff1744 : 0x550000); L[1].color.setHex(flash ? 0x0d1b55 : 0x2979ff);
      if (u.dead && Math.random() < 0.5) fx.smokePuff(u.x, u.y, u.z);
    }
  }
}

// Police eyes: cars and officers see in a cone, the helicopter sees all around.
export function viewers() {
  const out = ctx.extraViewers ? ctx.extraViewers() : [];
  for (const u of cops.values()) {
    if (isDown(u) || u.parked) continue; // nobody in a parked car
    const P = posOf(u);
    if (u.kind === 3) out.push({ x: P.x, y: u.y - 1.5, z: P.z, h: u.h, heli: true, range: 60, fov: Math.PI * 2 });
    else out.push({ x: P.x, y: (P.y || 0) + 1.5, z: P.z, h: P.h, heli: false, range: u.kind === 2 ? 50 : 65, fov: 2.0 });
  }
  return out;
}
// A parked cruiser outside a station within r of (x, z) leaves the roster and is handed back as a plain car (a
// player is breaking into it: carjack.js). Host only: the host's roster is the one everybody sees.
export function takeParked(x, z, r) {
  for (const u of cops.values()) {
    if (!u.parked || u.kind !== 0 || isDown(u) || u.id[0] === 's' || Math.hypot(u.v.x - x, u.v.z - z) > r) continue;
    cops.delete(u.id); fx.stopFire(u.fire);
    return u.v;
  }
  return null;
}
export function clearAll() { for (const id of [...cops.keys()]) remove(id); }
