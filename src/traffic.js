// Ambient traffic on Davenport's real road graph. Each player simulates their own traffic around
// them (only cars somebody interacts with get networked). Cars follow lanes with the IDM car-following
// model, obey traffic lights (shared clock, so every player sees the same lights), take turns at
// all-way stops, respect one-way streets, turn through junctions on smooth curves, change lanes,
// pass blockages, pull over for sirens and floor it away from gunfire.
import * as THREE from 'three';
import * as W from './world.js';
import { G, pointOnEdge, canGo, district } from './city/data.js';
import { nodeRadius } from './city/tile.js';
import { makeVehicle, V, CAR_COLORS, alignToGround } from './vehicles.js';
import { angDiff } from './util.js';

export const traffic = [];
let scene, ctx;
let spawnT = 0, nextId = 0;
const N = () => G.nodes;
const hash = (n) => { const s = Math.sin(n * 91.345 + 7.13) * 43758.5453; return s - Math.floor(s); };

export function initTraffic(s, c) { scene = s; ctx = c; initSignals(); }

// ---------- lanes ----------
// lateral offset (along the a->b right-hand normal) of lane `lane` for travel direction dir
// streets with kerb parking keep ~1.9 m clear on each side for the parked cars
export const parkable = (e) => ['residential', 'tertiary', 'minor', 'secondary'].includes(e.cls) && !e.bridge;
function laneOffset(e, dir, lane) {
  const lanes = Math.max(1, e.lf + e.lb), lw = Math.max(2.1, (e.width - (parkable(e) ? 3.8 : 0)) / lanes), c0 = ((e.lb - e.lf) * lw) / 2;
  return dir > 0 ? c0 + (lane + 0.5) * lw : c0 - (lane + 0.5) * lw;
}
const lanesOf = (e, dir) => Math.max(1, dir > 0 ? e.lf : e.lb);
const startNode = (e, dir) => (dir > 0 ? e.a : e.b);
const endNode = (e, dir) => (dir > 0 ? e.b : e.a);
const trim = (k) => (G.adj[k].length >= 3 ? nodeRadius(k) + 0.6 : 0);
function edgePose(e, dir, s, off) {
  const p = pointOnEdge(e, dir > 0 ? s : e.len - s);
  return { x: p.x - Math.cos(p.h) * off, z: p.z + Math.sin(p.h) * off, h: dir > 0 ? p.h : p.h + Math.PI };
}

// ---------- traffic lights: two phases per junction on the shared clock ----------
const CYCLE = 50;
export function signalState(k, heading, tSec) {
  const e0 = G.edges[G.adj[k][0]], ax = Math.atan2(e0.pts[2] - e0.pts[0], e0.pts[3] - e0.pts[1]);
  const d = Math.abs(angDiff(ax, heading)) % Math.PI, group = d > Math.PI / 4 && d < (3 * Math.PI) / 4 ? 1 : 0;
  const ph = (tSec + hash(k) * CYCLE) % CYCLE, p = group ? (ph + 25) % CYCLE : ph;
  return p < 21 ? 'g' : p < 24 ? 'y' : 'r';
}

// ---------- picking cars ----------
const pick = (list, r) => { let t = 0; for (const [, w] of list) t += w; let x = r * t; for (const [v, w] of list) { x -= w; if (x <= 0) return v; } return list[0][0]; };
function chooseType(x, z, night, r) {
  const d = district(x, z);
  const everyday = [[V.SEDAN, 10], [V.HATCH, 5], [V.SUV, 8], [V.PICKUP, d === 'north' || d === 'west' ? 7 : 4], [V.MINIVAN, 3], [V.SPORTS, 1], [V.TAXI, d === 'downtown' ? 3 : 0.3], [V.VAN, 1.5], [V.TRUCK, d === 'riverfront' ? 2 : 0.7], [V.BUS, d === 'downtown' ? 1 : 0.3]];
  const work = night ? [] : [[V.GARBAGE, 0.35], [V.TOW, 0.3]];
  const fun = [[V.MUSCLE, 0.6], [V.CONVERTIBLE, 0.5], [V.LIMO, d === 'downtown' ? 0.4 : 0.1], [V.MONSTER, 0.08], [V.BIKE, 0.7], [V.SCOOTER, d === 'village' || d === 'downtown' ? 0.5 : 0.1]];
  return pick([...everyday, ...work, ...fun], r);
}
function colorFor(ti, r) {
  if (ti === V.TAXI) return 0xf2c230;
  if (ti === V.BUS) return 0x1f5fa8;
  if (ti === V.LIMO) return r < 0.7 ? 0x111214 : 0xf2f2f0;
  if (ti === V.GARBAGE) return 0x2e7d32;
  if (ti === V.TOW) return 0xf9a825;
  if (ti === V.MONSTER) return [0x7cb342, 0xe53935, 0x1e88e5][Math.floor(r * 3)];
  if (ti === V.MUSCLE) return [0xc62828, 0x1565c0, 0xf9a825, 0x111111, 0x2e7d32][Math.floor(r * 5)];
  return CAR_COLORS[Math.floor(r * CAR_COLORS.length)];
}

// ---------- spawning ----------
const drivable = (e) => e.cls !== 'service' && e.cls !== 'motor' && e.len > 25;
function trySpawn(fx, fz, R, cam, night) {
  const ids = [...W.edgesNear(fx, fz, R)];
  for (let tries = 0; tries < 12; tries++) {
    const e = G.edges[ids[Math.floor(Math.random() * ids.length)]];
    if (!e || !drivable(e)) continue;
    const dirs = []; if (e.lf > 0) dirs.push(1); if (e.lb > 0) dirs.push(-1); if (!dirs.length) continue;
    const dir = dirs[Math.floor(Math.random() * dirs.length)], lane = Math.floor(Math.random() * lanesOf(e, dir));
    const s0 = trim(startNode(e, dir)), s1 = e.len - trim(endNode(e, dir)); if (s1 - s0 < 12) continue;
    const s = s0 + 4 + Math.random() * (s1 - s0 - 8), off = laneOffset(e, dir, lane), p = edgePose(e, dir, s, off);
    const d = Math.hypot(p.x - fx, p.z - fz);
    if (d > R || d < 90) continue;
    // appear out of sight: behind the camera or far away
    if (cam && d < 220) { const dx = p.x - cam.x, dz = p.z - cam.z, l = Math.hypot(dx, dz) || 1; if ((dx * cam.fx + dz * cam.fz) / l > 0.35) continue; }
    if (ctx.vehicles().some((v) => Math.abs(v.x - p.x) < 14 && Math.abs(v.z - p.z) < 14)) continue;
    const r = Math.random(), ti = chooseType(p.x, p.z, night, r);
    const v = makeVehicle('t' + nextId++, ti, colorFor(ti, Math.random()), { x: p.x, z: p.z, h: p.h });
    v.mode = 'traffic';
    v.ag = { e, dir, lane, s, off, offT: off, speed: e.speed * 0.6, phase: 'edge', temper: 0.85 + Math.random() * 0.25, next: null, blockT: 0, honkT: 0, drunk: night && Math.random() < 0.05 };
    ctx.add(v);
    traffic.push(v);
    return true;
  }
  return false;
}

// ---------- route choice at a junction ----------
function chooseNext(ag) {
  const k = endNode(ag.e, ag.dir), inH = edgePose(ag.e, ag.dir, ag.e.len, 0).h;
  const opts = [];
  for (const id of G.adj[k]) {
    const e2 = G.edges[id];
    if (e2 === ag.e || !canGo(e2, k) || N().closed[e2.a === k ? e2.b : e2.a] && e2.len < 30) continue;
    const dir = e2.a === k ? 1 : -1, outH = edgePose(e2, dir, 0, 0).h, turn = angDiff(inH, outH);
    let w = e2.cls === 'service' ? 0.05 : e2.cls === 'residential' ? 0.6 : 1;
    w *= Math.abs(turn) < 0.5 ? 2.2 : 1;
    opts.push([{ e: e2, dir, turn }, w]);
  }
  if (!opts.length) return { e: ag.e, dir: -ag.dir, turn: Math.PI, uturn: true }; // dead end or road closed: turn around
  return pick(opts, Math.random());
}
function laneFor(next, curLane) {
  const n = lanesOf(next.e, next.dir);
  if (next.turn > 0.5) return n - 1 - 0; // right turn: kerb lane is the last one
  if (next.turn < -0.5) return 0;
  return Math.min(curLane, n - 1);
}
// cubic curve through the junction
function makeTurn(ag, k) {
  const nx = ag.next, lane = nx.uturn ? 0 : laneFor(nx, ag.lane);
  const p0 = edgePose(ag.e, ag.dir, ag.s, ag.off), s2 = trim(startNode(nx.e, nx.dir)), off2 = laneOffset(nx.e, nx.dir, lane), p3 = edgePose(nx.e, nx.dir, s2, off2);
  const L = Math.hypot(p3.x - p0.x, p3.z - p0.z), k0 = nx.uturn ? 6 : L * 0.45;
  const P = [[p0.x, p0.z], [p0.x + Math.sin(p0.h) * k0, p0.z + Math.cos(p0.h) * k0], [p3.x - Math.sin(p3.h) * k0, p3.z - Math.cos(p3.h) * k0], [p3.x, p3.z]];
  let len = 0, px = p0.x, pz = p0.z;
  for (let i = 1; i <= 8; i++) { const q = bez(P, i / 8); len += Math.hypot(q[0] - px, q[1] - pz); px = q[0]; pz = q[1]; }
  ag.turn = { P, len: Math.max(0.5, len), u: 0, node: k, lane, s2, off2, t0: ++turnSeq };
  ag.phase = 'turn';
}
function bez(P, t) { const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t; return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]]; }

// ---------- per frame ----------
let turnSeq = 0;
const queues = new Map(); // all-way stop arrival order: node -> [vehicle]
const turningAt = (k, me) => traffic.some((o) => o !== me && o.ag.phase === 'turn' && o.ag.turn.node === k);
export function bumpTraffic(v) { if (v.ag) { v.ag.speed = 0; v.ag.blockT = Math.max(v.ag.blockT, 1); } }
export function scareTraffic(x, z, r) { for (const v of traffic) if (Math.hypot(v.x - x, v.z - z) < r) v.ag.panicT = 10 + Math.random() * 6; }

// obs: [{x, z, r, person, speed}] things to stop for. sirens: [{x, z}] emergency vehicles with sirens on.
export function updateTraffic(dt, focus, cam, obs, sirens, tSec, opts) {
  const R = opts.radius, want = opts.count;
  // spawn / despawn
  spawnT -= dt;
  if (spawnT <= 0) {
    spawnT = 0.25;
    if (traffic.length < want) trySpawn(focus.x, focus.z, R, cam, opts.night);
    for (let i = traffic.length - 1; i >= 0; i--) {
      const v = traffic[i];
      if (v.mode !== 'traffic') { traffic.splice(i, 1); v.ag = null; continue; } // knocked loose: now a normal car
      const d = Math.hypot(v.x - focus.x, v.z - focus.z);
      let behind = true;
      if (cam) { const dx = v.x - cam.x, dz = v.z - cam.z; behind = (dx * cam.fx + dz * cam.fz) / (Math.hypot(dx, dz) || 1) < 0.2; }
      if (d > R + 160 || (d > R + 40 && behind) || traffic.length > want + 4 && d > 150 && behind) { traffic.splice(i, 1); ctx.remove(v); }
    }
  }
  const others = ctx.vehicles();
  for (const v of traffic) {
    const ag = v.ag; if (!ag) continue;
    const T = v.T, fx = Math.sin(v.h), fz = Math.cos(v.h);
    // ---- what's ahead of me? ----
    let gap = 60, lead = 0, person = false, blockerStill = null;
    // hl/hw: the other thing's half length / half width along its own heading oh
    const look = (x, z, hl, hw, oh, spd, isPerson, ref) => {
      const dx = x - v.x, dz = z - v.z, a = dx * fx + dz * fz;
      if (a <= 0 || a > 55) return;
      const c = Math.abs(Math.cos(oh - v.h)), sn = Math.abs(Math.sin(oh - v.h));
      const l = Math.abs(dx * fz - dz * fx);
      if (l > T.wid / 2 + sn * hl + c * hw + (isPerson ? 0.35 : 0.12)) return;
      const g = a - T.len / 2 - (c * hl + sn * hw);
      if (g < gap) { gap = g; lead = spd; person = isPerson; blockerStill = ref && spd < 0.5 ? ref : null; }
    };
    for (const o of others) {
      if (o === v || o.sinkT > 0 || Math.abs(o.x - v.x) > 55 || Math.abs(o.z - v.z) > 55) continue;
      const sp = o.ag ? o.ag.speed : Math.hypot(o.vx || 0, o.vz || 0);
      // other traffic coming the other way in its own lane doesn't count
      if (o.ag && Math.sin(o.h) * fx + Math.cos(o.h) * fz < -0.5) continue;
      // inside a junction, whoever entered first has priority (no deadlocks)
      if (o.ag && ag.phase === 'turn' && o.ag.phase === 'turn' && o.ag.turn.node === ag.turn.node && o.ag.turn.t0 > ag.turn.t0) continue;
      if (o.ag && ag.ghostT > 0) continue;
      look(o.x, o.z, o.T.len / 2, o.T.wid / 2, o.h, sp, false, o.mode !== 'traffic' ? o : null);
    }
    for (const o of obs) look(o.x, o.z, o.hl ?? o.r, o.r, o.h ?? v.h, o.speed || 0, o.person, null);
    // ---- desired speed ----
    let v0 = (ag.phase === 'turn' ? Math.min(7, ag.e.speed) : ag.e.speed) * ag.temper;
    if (T.bus || T.cabbed || T.truck) v0 *= 0.85;
    const panic = (ag.panicT = Math.max(0, (ag.panicT || 0) - dt)) > 0;
    if (panic) v0 = Math.min(26, v0 * 1.5);
    let stopAt = Infinity;
    // ---- junction control ahead ----
    if (ag.phase === 'edge') {
      const k = endNode(ag.e, ag.dir), sEnd = ag.e.len - trim(k), toEnd = sEnd - ag.s;
      if (!ag.next && toEnd < 45) ag.next = chooseNext(ag);
      const deg = G.adj[k].length, ctrl = N().ctrl[k];
      if (deg >= 3 && toEnd < 60 && !panic && !(ag.drunk && hash(nextId + k) < 0.4)) {
        const inH = v.h;
        if (ctrl === 1) {
          const st = signalState(k, inH, tSec);
          if (st === 'r' || (st === 'y' && (ag.speed * ag.speed) / 7 < toEnd - 1)) stopAt = sEnd - 1.5;
          ag.light = st;
        } else if (ctrl === 2 && !ag.stopDone) {
          stopAt = sEnd - 1.2;
          if (toEnd < 3.5 && ag.speed < 0.7) {
            ag.waitT = (ag.waitT || 0) + dt;
            // queue in arrival order (dropping cars that left or vanished)
            const q = (queues.get(k) || []).filter((o) => o.ag && o.mode === 'traffic' && o.ag.phase === 'edge' && endNode(o.ag.e, o.ag.dir) === k);
            if (!q.includes(v)) q.push(v);
            queues.set(k, q);
            if (ag.waitT > 0.8 && q[0] === v && !turningAt(k, v)) { ag.stopDone = true; q.shift(); }
          }
        } else if (!ctrl) {
          v0 = Math.min(v0, 8);
          if (toEnd < 6 && turningAt(k, v)) stopAt = sEnd - 1;
        }
      }
      if (ag.next && ag.next.uturn) v0 = Math.min(v0, 5);
    }
    // ---- sirens behind or ahead: pull over and wait ----
    let pullOver = false;
    for (const s of sirens) if (Math.hypot(s.x - v.x, s.z - v.z) < 55) { pullOver = true; break; }
    if (pullOver) { ag.yieldT = 3; }
    ag.yieldT = Math.max(0, (ag.yieldT || 0) - dt);
    if (ag.yieldT > 0 && ag.phase === 'edge') v0 = 0;
    if (v.jackHold) v0 = 0;
    // ---- IDM ----
    const aMax = panic ? 3.5 : 2.2, b = 3.2, s0 = 2.2, Th = panic ? 0.7 : 1.3;
    let g = gap;
    if (stopAt < Infinity) g = Math.min(g, stopAt - ag.s);
    const sp = ag.speed, dv = sp - (stopAt < Infinity && stopAt - ag.s <= gap ? 0 : lead);
    const sStar = s0 + Math.max(0, sp * Th + (sp * dv) / (2 * Math.sqrt(aMax * b)));
    let acc = v0 > 0.1 ? aMax * (1 - (sp / v0) ** 4 - (sStar / Math.max(0.2, g)) ** 2) : -b * 2;
    if (ag.blockT > 0) { ag.blockT -= dt; acc = Math.min(acc, -b); }
    acc = Math.max(-9, acc);
    ag.speed = Math.max(0, Math.min(v0 > 0 ? v0 * 1.05 : sp, sp + acc * dt));
    if (g < 0.3) ag.speed = 0;
    // ---- honk, pass a blockage ----
    const stuck = ag.speed < 0.3 && gap < 8 && stopAt === Infinity;
    ag.stuckT = stuck ? (ag.stuckT || 0) + dt : 0;
    // jammed for ages behind other traffic (gridlock): squeeze through
    ag.ghostT = Math.max(0, (ag.ghostT || 0) - dt);
    if (stuck && !person && !blockerStill && ag.stuckT > 7) { ag.ghostT = 2.5; ag.stuckT = 0; }
    if (stuck && ((person && ag.stuckT > 1.6) || ag.stuckT > 4)) { ag.honkT -= dt; if (ag.honkT <= 0) { ag.honkT = 1.8 + Math.random() * 2; ctx.honk(v); } }
    if (ag.phase === 'edge' && blockerStill && ag.stuckT > 2.5 && !ag.passT) {
      // go around in the next lane over (or the oncoming lane on a two-way street)
      const n = lanesOf(ag.e, ag.dir), lw = ag.e.width / Math.max(1, ag.e.lf + ag.e.lb);
      if (ag.lane > 0) { ag.lane--; ag.passT = 0.01; }
      else if (ag.lane < n - 1) { ag.lane++; ag.passT = 0.01; }
      else if (ag.e.lf > 0 && ag.e.lb > 0) { ag.passT = 6; ag.passShift = (ag.dir > 0 ? -1 : 1) * lw; }
    }
    if (ag.passT > 0) { ag.passT -= dt; if (ag.passT <= 0) { ag.passT = 0; ag.passShift = 0; } }
    // ---- move ----
    const step = ag.speed * dt;
    if (ag.phase === 'edge') {
      ag.s += step;
      // lateral: lane centre, plus kerb when pulling over, plus pass shift, plus a drunk weave
      const right = ag.dir > 0 ? 1 : -1, lw = ag.e.width / Math.max(1, ag.e.lf + ag.e.lb);
      ag.offT = laneOffset(ag.e, ag.dir, Math.min(ag.lane, lanesOf(ag.e, ag.dir) - 1)) + (ag.yieldT > 0 ? right * lw * 0.45 : 0) + (ag.passShift || 0) + (ag.drunk ? Math.sin(tSec * 0.8 + v.x) * 0.9 : 0);
      ag.off += Math.sign(ag.offT - ag.off) * Math.min(Math.abs(ag.offT - ag.off), dt * (ag.drunk ? 0.8 : 1.6));
      const k = endNode(ag.e, ag.dir);
      if (ag.s >= ag.e.len - trim(k)) {
        if (!ag.next) ag.next = chooseNext(ag);
        makeTurn(ag, k);
        ag.stopDone = false; ag.waitT = 0;
        const q = queues.get(k); if (q) { const i = q.indexOf(v); if (i >= 0) q.splice(i, 1); }
      }
    }
    if (ag.phase === 'turn') {
      const t = ag.turn;
      t.u += ag.phase === 'turn' && ag.s >= 0 ? step : 0;
      if (t.u >= t.len) {
        ag.e = ag.next.e; ag.dir = ag.next.dir; ag.lane = t.lane; ag.s = t.s2 + (t.u - t.len); ag.off = ag.offT = t.off2;
        ag.next = null; ag.phase = 'edge'; ag.turn = null; ag.passShift = 0; ag.passT = 0;
      }
    }
    // ---- pose ----
    let x, z, h;
    if (ag.phase === 'turn') {
      const t = ag.turn, k = Math.min(1, t.u / t.len), q = bez(t.P, k), q2 = bez(t.P, Math.min(1, k + 0.04));
      x = q[0]; z = q[1]; h = Math.hypot(q2[0] - q[0], q2[1] - q[1]) > 1e-4 ? Math.atan2(q2[0] - q[0], q2[1] - q[1]) : v.h;
    } else {
      const p = edgePose(ag.e, ag.dir, ag.s, ag.off); x = p.x; z = p.z; h = p.h;
      h += Math.atan2((ag.offT - ag.off) * (ag.dir > 0 ? 1 : -1) * -1, Math.max(4, ag.speed * 1.5)) * 0.5;
    }
    v.vx = dt > 0 ? (x - v.x) / dt : 0; v.vz = dt > 0 ? (z - v.z) / dt : 0;
    if (Math.hypot(v.vx, v.vz) > 40) { v.vx = Math.sin(h) * ag.speed; v.vz = Math.cos(h) * ag.speed; } // first frame / teleport
    v.x = x; v.z = z; v.h += angDiff(v.h, h) * Math.min(1, dt * 10); v.speed = ag.speed;
    v.y = W.groundHeight(x, z);
    alignToGround(v, dt);
  }
}

// ---------- traffic lights + stop signs you can see ----------
let sig = null;
const sigList = []; // {k, heading, lampIdx}
function initSignals() {
  const housing = new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.6 });
  const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; scene.add(m); return m; };
  const stopTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#c62828'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; g.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62); } g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('STOP', 64, 66); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  sig = {
    pole: mk(new THREE.CylinderGeometry(0.11, 0.13, 1, 6).translate(0, 0.5, 0), housing, 600),
    arm: mk(new THREE.BoxGeometry(0.12, 0.12, 1).translate(0, 0, 0.5), housing, 600),
    head: mk(new THREE.BoxGeometry(0.42, 1.15, 0.32), housing, 600),
    lamp: mk(new THREE.CircleGeometry(0.13, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }), 1800),
    stop: mk(new THREE.PlaneGeometry(0.75, 0.75), new THREE.MeshStandardMaterial({ map: stopTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 }), 800),
  };
  W.onStream('built', () => { sigDirty = true; });
  W.onStream('unloaded', () => { sigDirty = true; });
}
let sigDirty = false;
function rebuildSignals() {
  const o = new THREE.Object3D();
  let np = 0, na = 0, nh = 0, nl = 0, ns = 0;
  sigList.length = 0;
  const loaded = (x, z) => W.builtTiles.has(`${Math.floor(x / 200)}_${Math.floor(z / 200)}`);
  const Nn = N();
  for (let k = 0; k < Nn.n; k++) {
    const ctrl = Nn.ctrl[k]; if (!ctrl || G.adj[k].length < 3 || !loaded(Nn.x[k], Nn.z[k])) continue;
    const r = nodeRadius(k);
    for (const id of G.adj[k]) {
      const e = G.edges[id], fromA = e.a === k, inbound = fromA ? e.lb > 0 : e.lf > 0;
      if (!inbound || e.len < r + 8 || e.cls === 'service') continue;
      // the corner on the incoming driver's right, just before the stop line
      const p = pointOnEdge(e, fromA ? r + 1.2 : e.len - r - 1.2), travelH = fromA ? p.h + Math.PI : p.h;
      const rx = -Math.cos(travelH), rz = Math.sin(travelH), side = e.width / 2 + 0.9;
      const px = p.x + rx * side, pz = p.z + rz * side, py = W.terrainHeight(px, pz);
      const face = travelH + Math.PI; // faces oncoming traffic
      if (ctrl === 1 && np < 600) {
        const armLen = Math.min(e.width * 0.6, 7);
        o.position.set(px, py, pz); o.rotation.set(0, 0, 0); o.scale.set(1, 6.2, 1); o.updateMatrix(); sig.pole.setMatrixAt(np++, o.matrix);
        o.position.set(px, py + 6, pz); o.rotation.set(0, travelH - Math.PI / 2, 0); o.scale.set(1, 1, armLen); o.updateMatrix(); sig.arm.setMatrixAt(na++, o.matrix);
        const hx = px - rx * armLen, hz = pz - rz * armLen;
        o.position.set(hx, py + 5.35, hz); o.rotation.set(0, face, 0); o.scale.set(1, 1, 1); o.updateMatrix(); sig.head.setMatrixAt(nh++, o.matrix);
        const fx = Math.sin(face) * 0.17, fz = Math.cos(face) * 0.17;
        sigList.push({ k, heading: travelH, lamp: nl });
        for (const dy of [0.36, 0, -0.36]) { o.position.set(hx + fx, py + 5.35 + dy, hz + fz); o.rotation.set(0, face, 0); o.updateMatrix(); sig.lamp.setMatrixAt(nl++, o.matrix); }
      } else if (ctrl === 2 && ns < 800) {
        o.position.set(px, py, pz); o.rotation.set(0, 0, 0); o.scale.set(0.5, 2.6, 0.5); o.updateMatrix(); sig.pole.setMatrixAt(np++, o.matrix);
        o.position.set(px, py + 2.3, pz); o.rotation.set(0, face, 0); o.scale.set(1, 1, 1); o.updateMatrix(); sig.stop.setMatrixAt(ns++, o.matrix);
      }
    }
  }
  sig.pole.count = np; sig.arm.count = na; sig.head.count = nh; sig.lamp.count = nl; sig.stop.count = ns;
  for (const m of Object.values(sig)) m.instanceMatrix.needsUpdate = true;
}
const C_RED = new THREE.Color(0xff2a1a), C_YEL = new THREE.Color(0xffc21a), C_GRN = new THREE.Color(0x2bff6a), C_OFF = new THREE.Color(0x1d1f22);
export function updateSignals(tSec) {
  if (sigDirty) { sigDirty = false; rebuildSignals(); }
  for (const s of sigList) {
    const st = signalState(s.k, s.heading, tSec);
    sig.lamp.setColorAt(s.lamp, st === 'r' ? C_RED : C_OFF);
    sig.lamp.setColorAt(s.lamp + 1, st === 'y' ? C_YEL : C_OFF);
    sig.lamp.setColorAt(s.lamp + 2, st === 'g' ? C_GRN : C_OFF);
  }
  if (sig.lamp.instanceColor) sig.lamp.instanceColor.needsUpdate = true;
}
