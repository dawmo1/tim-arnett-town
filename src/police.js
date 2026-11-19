// Police: the host's computer drives every cop car and shares their positions 5x a second.
// Everyone else just draws them.
import * as W from './world.js';
import { makeVehicle, stepVehicle, collideVehicles, circles, charVehicle, POLICE } from './vehicles.js';
import * as fx from './fx.js';
import { clamp, angDiff } from './util.js';

export const cops = new Map();
let scene, ctx, nextId = 0, spawnT = 0, syncT = 0;
const rbTimer = {};

export function initPolice(s, c) { scene = s; ctx = c; }

function spawn(id, x, z, h, kind, target) {
  const v = makeVehicle(id, POLICE, 0xffffff, { x, z, h });
  v.mode = 'cop';
  v.mesh.userData.driverHead.visible = true;
  scene.add(v.mesh);
  const u = { id, v, target, kind, life: kind ? 40 : 1e9, cd: 1 + Math.random(), stuckT: 0, revT: 0, seq: 0, shot: [0, 0, 0], noTarget: 0, ramCd: 0, fire: null };
  cops.set(id, u);
  return u;
}
function remove(id) {
  const u = cops.get(id);
  if (!u) return;
  fx.stopFire(u.fire);
  scene.remove(u.v.mesh);
  cops.delete(id);
}

function roadD(s, d) {
  const opts = s > 140 && s < 960 ? [0, 48, -48] : [0];
  let best = 0;
  for (const o of opts) if (Math.abs(d - o) < Math.abs(d - best)) best = o;
  return best;
}

// players: [{uid, x, z, vx, vz, stars, alive, inVeh}]
export function hostUpdate(dt, players) {
  spawnT -= dt;
  if (spawnT <= 0) {
    spawnT = 1;
    for (const p of players) {
      if (!p.alive || p.stars <= 0) continue;
      const want = [0, 1, 2, 3, 4, 6][p.stars];
      let have = 0;
      for (const u of cops.values()) if (u.target === p.uid && u.kind === 0 && u.v.hp > 0) have++;
      const sd = W.toSD(p.x, p.z);
      if (have < want) {
        let dir = Math.random() < 0.5 ? -1 : 1;
        if (sd.s + dir * 170 < 15 || sd.s + dir * 170 > W.L - 15) dir = -dir;
        const s = clamp(sd.s + dir * 170, 15, W.L - 15);
        const q = W.P(s, Math.random() < 0.5 ? 3.5 : -3.5);
        spawn('c' + nextId++, q.x, q.z, Math.atan2(p.x - q.x, p.z - q.z), 0, p.uid);
      }
      if (p.stars >= 4) {
        rbTimer[p.uid] = (rbTimer[p.uid] ?? 3) - 1;
        if (rbTimer[p.uid] <= 0) {
          rbTimer[p.uid] = 25;
          const ahead = W.toSD(p.x + p.vx, p.z + p.vz).s - sd.s;
          const dir = Math.abs(ahead) > 0.5 ? Math.sign(ahead) : 1;
          const s = clamp(sd.s + dir * 110, 20, W.L - 20);
          for (const dd of [-3, 3]) { const q = W.P(s, dd); spawn('r' + nextId++, q.x, q.z, -W.theta(s) + Math.PI / 2, 1, p.uid); }
        }
      }
    }
  }

  const vehicles = ctx.vehicles();
  for (const u of [...cops.values()]) {
    const v = u.v;
    if (v.exploded) { u.life = Math.min(u.life, 6) - dt; if (u.life <= 0) remove(u.id); continue; }
    if (v.hp <= 0) {
      if (!v.burnAt) v.burnAt = ctx.now();
      stepVehicle(v, {}, dt);
      if (ctx.now() - v.burnAt > 2500) { v.exploded = true; ctx.explode(v.x, 0, v.z, 'a police car'); }
      continue;
    }
    if (u.kind === 1) { u.life -= dt; if (u.life <= 0) remove(u.id); continue; }
    let p = players.find((q) => q.uid === u.target && q.alive && q.stars > 0);
    if (!p) {
      p = players.find((q) => q.alive && q.stars > 0);
      if (p) u.target = p.uid;
    }
    if (!p) {
      u.noTarget += dt;
      if (u.noTarget > 4) { remove(u.id); continue; }
      stepVehicle(v, { brake: 1 }, dt);
      continue;
    }
    u.noTarget = 0;
    const dx = p.x - v.x, dz = p.z - v.z, dist = Math.hypot(dx, dz);
    const ms = W.toSD(v.x, v.z), ts = W.toSD(p.x, p.z);
    let gx = p.x, gz = p.z;
    if (Math.abs(ts.s - ms.s) > 35 && dist > 40) {
      const s2 = ms.s + Math.sign(ts.s - ms.s) * 30;
      const rd = roadD(s2, ms.d);
      const g = W.P(s2, rd + (Math.sign(ts.s - ms.s) > 0 ? 3.5 : -3.5));
      gx = g.x; gz = g.z;
    }
    const ad = angDiff(v.h, Math.atan2(gx - v.x, gz - v.z));
    let inp = { throttle: 1, brake: 0, steer: clamp(ad * 2, -1, 1), handbrake: Math.abs(ad) > 1.2 && v.speed > 12 };
    if (dist < 11 && !p.inVeh) inp = { throttle: 0, brake: v.speed > 0.5 ? 1 : 0, steer: inp.steer };
    if (u.revT > 0) { u.revT -= dt; inp = { throttle: 0, brake: 1, steer: -inp.steer }; }
    else if (inp.throttle > 0 && Math.abs(v.speed) < 1.5) { u.stuckT += dt; if (u.stuckT > 1.5) { u.revT = 1.3; u.stuckT = 0; } }
    else u.stuckT = 0;
    const imp = stepVehicle(v, inp, dt);
    if (imp > 10) v.hp -= (imp - 10) * 2;
    for (const o of vehicles) if (Math.abs(o.x - v.x) < 8 && Math.abs(o.z - v.z) < 8 && !o.exploded) collideVehicles(v, o, false);
    for (const o of cops.values()) if (o.v !== v && Math.abs(o.v.x - v.x) < 8 && Math.abs(o.v.z - v.z) < 8) collideVehicles(v, o.v, false);
    // ram people on foot
    u.ramCd -= dt;
    if (u.ramCd <= 0 && Math.abs(v.speed) > 6) {
      for (const q of players) {
        if (!q.alive || q.inVeh) continue;
        if (circles(v).some((c) => Math.hypot(c.x - q.x, c.z - q.z) < c.r + 0.5)) { ctx.damagePlayer(q.uid, Math.abs(v.speed) * 3, 'the police'); u.ramCd = 1; }
      }
    }
    // shoot
    u.cd -= dt;
    if (u.cd <= 0 && dist < 38 && W.lineOfSight(v.x, 1.4, v.z, p.x, 1.2, p.z)) {
      u.cd = 1.4 - p.stars * 0.13;
      const hit = Math.random() < 0.28 + p.stars * 0.06;
      u.seq++;
      u.shot = [p.x + (hit ? 0 : (Math.random() - 0.5) * 5), 1.2, p.z + (hit ? 0 : (Math.random() - 0.5) * 5)];
      ctx.copShot(v, u.shot);
      if (hit) ctx.damagePlayer(p.uid, 6 + Math.random() * 4, 'the police');
    }
  }

  syncT -= dt;
  if (syncT <= 0) {
    syncT = 0.2;
    const obj = {};
    for (const u of cops.values()) {
      const v = u.v;
      obj[u.id] = [r1(v.x), r1(v.z), r2(v.h), Math.round(v.hp), u.seq, r1(u.shot[0]), r1(u.shot[1]), r1(u.shot[2]), u.kind, v.exploded ? 1 : 0, u.target || '', v.burnAt || 0];
    }
    ctx.sync(obj);
  }
}
const r1 = (n) => Math.round(n * 10) / 10, r2 = (n) => Math.round(n * 100) / 100;

// Non-host: mirror what the host sent.
export function applyRemote(obj) {
  for (const id of [...cops.keys()]) if (!obj[id]) remove(id);
  for (const [id, a] of Object.entries(obj)) {
    let u = cops.get(id);
    if (!u) { u = spawn(id, a[0], a[1], a[2], a[8], a[10]); u.seq = a[4]; }
    const v = u.v;
    v.tgt = { x: a[0], z: a[1], h: a[2] };
    v.hp = a[3];
    u.target = a[10];
    v.burnAt = a[11];
    if (a[4] !== u.seq) { u.seq = a[4]; u.shot = [a[5], a[6], a[7]]; ctx.copShot(v, u.shot); }
    if (a[9] && !v.exploded) v.exploded = true;
  }
}

export function damageCop(id, dmg) {
  const u = cops.get(id);
  if (u && u.v.hp > 0) u.v.hp -= dmg;
}

export function render(dt, isHost, t) {
  for (const u of cops.values()) {
    const v = u.v;
    if (!isHost && v.tgt) {
      const k = Math.min(1, dt * 8);
      v.x += (v.tgt.x - v.x) * k; v.z += (v.tgt.z - v.z) * k; v.h += angDiff(v.h, v.tgt.h) * k;
    }
    v.mesh.position.set(v.x, v.y, v.z);
    v.mesh.rotation.y = v.h;
    const L = v.mesh.userData.lights;
    if (L && !v.exploded) { const on = Math.floor(t * 6) % 2; L[0].color.setHex(on ? 0xff1744 : 0x550000); L[1].color.setHex(on ? 0x0d1b55 : 0x2979ff); }
    if (v.hp <= 0 && !v.exploded && !u.fire) u.fire = fx.startFire(v.mesh);
    if (v.exploded && !v.charred) { v.charred = true; fx.stopFire(u.fire); u.fire = null; charVehicle(v); v.mesh.userData.driverHead.visible = false; }
  }
}

export function clearAll() { for (const id of [...cops.keys()]) remove(id); }
