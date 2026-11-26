// GTA-style car crime and street mechanics, fed by main.js through a small context:
//  - Parked cars are mostly locked. E at one: try the handle, elbow the driver's window in (the glass stays broken),
//    reach in and pop the lock, get in, then hotwire it (a few seconds hunched under the dash; it creeps along while it
//    catches). Some set off an alarm: hazards flash, the horn pulses, people look round and someone phones it in.
//    Cars you've been in stay open; your own (garage, mechanic) never need breaking into; police cruisers are always
//    locked and breaking into one is a star. Parked cruisers outside a station can be broken into too.
//  - Dragging a driver out: they hit the ground, get up and react by personality (run, fight, pull a gun, call the
//    cops); passengers bail out. Run at a car stopped at a light with a gun out and the driver locks the doors (and may
//    floor it through the red); aim at a stopped driver and they put their hands up and get out, or floor it.
//  - Bullets: side windows break, tyres go flat one by one (the car pulls toward the flat), and a shot into the fuel
//    tank of a badly damaged car starts a fire that ends in an explosion.
// Network: windows, alarm, unlocked and flat tyres ride along in the vehicle record's lamp bits (main.js vehBits / l).
import * as THREE from 'three';
import * as fx from './fx.js';
import * as police from './police.js';
import { spawnJacked, say, incident } from './npc.js';
import { turfAt } from './gangs.js';
import { angDiff } from './util.js';

let ctx = null;
export function initCarjack(c) { ctx = c; }
const now = () => performance.now() / 1000;
const hash = (s) => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const occupied = (v) => v.mode === 'traffic' || !!v.npcDriver;

// ---------- windows ----------
const WIN = { doorL: 1, doorR: 2, doorL2: 4, doorR2: 8 };
function doorGlass(v, key) {
  const P = v.mesh.userData.parts, d = P && P[key];
  if (!d || !P.glass) return [];
  const out = [];
  d.traverse((m) => { if (m.isMesh && P.glass.includes(m)) out.push(m); });
  return out;
}
// the window's middle in world space (for the glass burst)
const tmpV = new THREE.Vector3();
function windowPos(v, key) {
  const d = v.mesh.userData.parts?.[key];
  if (!d) return { x: v.x, y: v.y + v.T.hgt * 0.75, z: v.z };
  d.updateWorldMatrix(true, false);
  tmpV.set(0, v.T.hgt * 0.68, key.endsWith('2') ? -0.35 : -0.45); d.localToWorld(tmpV);
  return { x: tmpV.x, y: tmpV.y, z: tmpV.z };
}
// knock the glass out of one door: it stays broken until Arnett Auto repairs the car (vehicles.js repair resets v.win)
export function breakWindow(v, key, loud = true) {
  const bit = WIN[key];
  if (!bit || (v.win || 0) & bit) return false;
  const glass = doorGlass(v, key);
  if (!glass.length) return false;
  v.win = (v.win || 0) | bit;
  for (const m of glass) m.visible = false;
  if (loud && v.mesh.visible) {
    const p = windowPos(v, key);
    fx.glass(p.x, p.y, p.z, 26);
    fx.soundGlass(ctx.distCam(p.x, p.z));
  }
  return true;
}

// ---------- locks ----------
const lockable = (v) => !v.T.bike && !v.T.boat && !v.T.heli && !v.T.plane && doorGlass(v, 'doorL').length > 0;
// decided once per car: most kerbside cars are locked, the nicer ones more often alarmed. Cruisers always locked.
function lockInfo(v) {
  if (v.lockInfo) return v.lockInfo;
  let locked = false, alarm = false;
  if (lockable(v)) {
    if (v.copCar || v.T.police) locked = true;
    else if (v.spotKey && v.mode === 'parked') {
      const T = v.T, fancy = T.name === 'Sports car' || T.muscle || T.convertible || T.limo || T.suv;
      locked = hash(v.id + 'lock') < 0.8;
      alarm = locked && hash(v.id + 'alarm') < (fancy ? 0.55 : 0.3);
    }
  }
  return (v.lockInfo = { locked, alarm });
}
export function isLocked(v) {
  if (v.unlocked || (v.driver && v.driver !== ctx.uid())) return false;
  if (!v.mesh.userData.parts?.doorL) return false; // the door's been torn off
  if (occupied(v)) return !!v.npcLocked;
  return lockInfo(v).locked;
}
// The first step at the door: 'open' as before, or try a locked handle ('reach' when the window's already gone).
export function firstPhase(v, seat) {
  if (seat || v.T.bike || !isLocked(v)) return 'open';
  return (v.win || 0) & WIN.doorL ? 'reach' : 'try';
}
// ---------- the break-in, step by step (main.js enterUpdate hands its phases over while they're ours) ----------
const T_TRY = 0.8, T_SMASH = 0.85, T_REACH = 0.75;
export function enterStep(e, v, dt, sg) {
  const dist = ctx.distCam(v.x, v.z), occ = occupied(v);
  if (e.phase === 'try') {
    const k = Math.min(1, e.t / T_TRY);
    if (!e.rattled && k > 0.3) { e.rattled = true; fx.soundLatch(dist, 2); v.rock = 0.5; }
    if (k >= 1) {
      e.t = 0; e.phase = 'smash';
      // a driver who locked up on you may just floor it while you're stood at the door
      if (occ && v.ag && Math.random() < 0.45) { v.jackHold = false; floorIt(v); }
    }
    return { act: { n: 'carTry', k, side: sg } };
  }
  if (e.phase === 'smash') {
    const k = Math.min(1, e.t / T_SMASH);
    if (!e.smashed && k > 0.47) { e.smashed = true; breakWindow(v, 'doorL'); v.rock = 1; ctx.shake?.(0.08); breakInCrime(v, occ); }
    if (k >= 1) { e.t = 0; e.phase = 'reach'; }
    return { act: { n: 'carSmash', k, side: sg } };
  }
  if (e.phase === 'reach') {
    const k = Math.min(1, e.t / T_REACH);
    if (!e.popped && k > 0.62) { e.popped = true; fx.soundUnlock(dist); }
    if (k >= 1) {
      e.t = 0; e.phase = 'open';
      v.unlocked = true; v.npcLocked = false;
      if (!occ) v.needsHotwire = true; // nobody left the engine running: hotwire it once you're in
      ctx.writeVeh(v, true);
    }
    return { act: { n: 'carReach', k, side: sg } };
  }
  return null;
}
function breakInCrime(v, occ) {
  if (v.copCar || v.T.police) { ctx.report('copcar', v.x, v.z); return; }
  if (occ) return; // dragging them out is reported as the carjack
  if (lockInfo(v).alarm) { startAlarm(v, 22); ctx.report('breakin', v.x, v.z); incident(v.x, v.z, 'alarm'); }
  else ctx.report('breakinQuiet', v.x, v.z);
}

// ---------- alarms ----------
const alarms = new Set();
function startAlarm(v, secs) {
  v.alarmEnd = now() + secs; v.alarmHonk = 0;
  alarms.add(v);
  ctx.writeVeh(v, true);
}
const alarming = (v) => (v.alarmEnd || 0) > now();
function updateAlarms(dt) {
  const t = now();
  for (const v of alarms) {
    if (!(v.alarmEnd > t) || v.exploded || !ctx.vehicles.includes(v)) { alarms.delete(v); v.alarmEnd = 0; if (!v.exploded) ctx.writeVeh(v, true); continue; }
    v.alarmUntil = t + 0.35; // hazards (main.js updateLamps)
    // GTA-style: honk-honk-honk, a short gap, again
    v.alarmHonk = (v.alarmHonk || 0) - dt;
    if (v.alarmHonk <= 0) { v.alarmN = ((v.alarmN || 0) + 1) % 4; v.alarmHonk = v.alarmN === 0 ? 0.75 : 0.42; if (v.alarmN) fx.soundHorn(ctx.distCam(v.x, v.z)); }
  }
}

// ---------- hotwiring ----------
// after getting in (api: the anim.js chain playing 'carShut', so the hunch follows the door pull)
export function afterEnter(v, api) {
  v.unlocked = true;
  if (!v.needsHotwire || v.T.bike) return;
  if (!(v.hotwireT > 0)) { v.hotwireDur = 2.8 + Math.random() * 1.6; v.hotwireT = v.hotwireDur; }
  v.sparkT = 0.4;
  api?.then('hotwire', 1.3, { lock: false, loop: true });
}
export const hotwiring = (v) => !!v && v.needsHotwire && v.hotwireT > 0;
// throttle you get (gas held): nothing for the first moment, then a stuttering creep while it catches
export function gas(v) {
  if (!hotwiring(v)) return 1;
  return v.hotwireDur - v.hotwireT > 0.8 ? 0.3 + Math.random() * 0.2 : 0;
}
// the engine while you hotwire (true = handled, main.js skips its own engine note)
export function engine(v, dt, gasOn) {
  if (!hotwiring(v)) return false;
  const d = ctx.distCam(v.x, v.z);
  v.hotwireT -= dt; v.sparkT -= dt;
  if (v.sparkT <= 0) {
    v.sparkT = 0.25 + Math.random() * 0.5;
    fx.soundSpark(d);
    const fx_ = Math.sin(v.h), fz = Math.cos(v.h), lx = Math.cos(v.h), lz = -Math.sin(v.h);
    fx.sparks(v.x + fx_ * 0.55 + lx * 0.3, v.y + 0.75, v.z + fz * 0.55 + lz * 0.3, 3);
    if (Math.random() < 0.45) fx.soundCrank(d, 0.3 + Math.random() * 0.4);
  }
  if (gasOn && v.hotwireDur - v.hotwireT > 0.8) fx.setEngine('car', 0.05 + Math.random() * 0.12, 0.3); // coughing along
  else fx.setEngine(null);
  if (v.hotwireT <= 0) {
    v.hotwireT = 0; v.needsHotwire = false;
    fx.soundCatch(d);
    ctx.anim.stop('hotwire');
    const tx = v.x - Math.sin(v.h) * (v.T.len / 2), tz = v.z - Math.cos(v.h) * (v.T.len / 2);
    fx.exhaust(tx, v.y + 0.35, tz, -Math.sin(v.h) * 2, -Math.cos(v.h) * 2, true);
    return false;
  }
  return true;
}

// ---------- jacking occupied cars ----------
// how a driver reacts to being dragged out (gang members on their own turf are the dangerous ones)
function personality(v) {
  if (v.ko) return { react: 'flee' };
  const g = turfAt(v.x, v.z), gang = g && (g.cars?.includes(v.ti) ? Math.random() < 0.75 : Math.random() < 0.2) ? g.id : null, r = Math.random();
  if (gang) return { gang, react: r < 0.4 ? 'gun' : r < 0.85 ? 'fight' : 'flee' };
  return { react: r < 0.46 ? 'flee' : r < 0.68 ? 'fight' : r < 0.93 ? 'call' : 'gun' };
}
// out of the driver's door: thrown down beside the car, then up and reacting; everyone else bails out the far side
export function yank(v) {
  const d = ctx.doorSpot(v, 0), fx_ = Math.sin(v.h), fz = Math.cos(v.h), lx = Math.cos(v.h), lz = -Math.sin(v.h);
  const p = personality(v), ko = !!v.ko;
  ctx.freeTraffic(v, true); v.npcDriver = false; v.npcLocked = false; v.handsUp = 0;
  const n = ctx.emptyCar(v);
  const at = { x: d.x - fx_ * 0.8 + lx * 0.25, z: d.z - fz * 0.8 + lz * 0.25 };
  spawnJacked(at.x, at.z, v.h + Math.PI / 2, p.react, {
    gang: p.gang, fall: { x: lx * 0.9 - fx_ * 0.3, y: 0.4, z: lz * 0.9 - fz * 0.3 }, down: ko ? 4 : 1 + Math.random() * 0.7,
    onCall: (w) => ctx.callCops(w),
  });
  bailPassengers(v, n, 'flee');
}
function bailPassengers(v, n, react) {
  const fx_ = Math.sin(v.h), fz = Math.cos(v.h), lx = Math.cos(v.h), lz = -Math.sin(v.h);
  for (let i = 1; i < n; i++) {
    const s = i === 2 ? 1 : -1, back = i >= 2 ? -0.9 : 0.3; // front passenger and the right rear out the right, the left rear out the left
    const x = v.x + lx * s * (v.T.wid / 2 + 0.6) + fx_ * back, z = v.z + lz * s * (v.T.wid / 2 + 0.6) + fz * back;
    setTimeout(() => spawnJacked(x, z, v.h + (s > 0 ? Math.PI / 2 : -Math.PI / 2), react), 250 + i * 200);
  }
}
// a driver at gunpoint gives it up: door open, hands up, out and backing off; the engine's left running
function surrender(v) {
  ctx.freeTraffic(v, true); v.npcDriver = false; v.handsUp = 0; v.unlocked = true; v.needsHotwire = false;
  v.doorOpen = 1; v.doorCloseAt = 0;
  const n = ctx.emptyCar(v), d = ctx.doorSpot(v, 0);
  const me = ctx.me();
  spawnJacked(d.x, d.z, Math.atan2(me.x - d.x, me.z - d.z), 'surrender');
  bailPassengers(v, n, 'flee');
  ctx.writeVeh(v, true);
}
function floorIt(v) {
  if (!v.ag) return;
  v.npcLocked = true; v.ag.panicT = 9 + Math.random() * 5; v.ag.blockT = 0; v.ag.yieldT = 0; // panicking drivers run the red (traffic.js)
  fx.soundLatch(ctx.distCam(v.x, v.z), 1);
  fx.soundSqueal(ctx.distCam(v.x, v.z));
  if (Math.random() < 0.6) fx.soundHorn(ctx.distCam(v.x, v.z));
}
// Drivers stopped in traffic watch you: a gun out and running at them, or a gun pointed at them.
let watchT = 0;
function watchDrivers(dt) {
  if ((watchT -= dt) > 0) return;
  watchT = 0.15;
  const me = ctx.me(), w = ctx.weapon();
  if (!me || me.dead || me.veh || me.enter || !w || w.kind !== 'gun') return;
  const aim = ctx.aiming(), yaw = ctx.camYaw(), fh = me.h;
  for (const v of ctx.vehicles) {
    if (v.mode !== 'traffic' || !v.ag || v.T.bike || v.T.bus || v.T.siren || v.patrol || v.T.police) continue;
    const dx = v.x - me.x, dz = v.z - me.z, d = Math.hypot(dx, dz);
    if (d > 24 || v.ag.speed > 3) continue;
    const dir = Math.atan2(dx, dz);
    if (aim && !v.aimReact && d < 20 && Math.abs(angDiff(yaw, dir)) < 0.16) {
      v.aimReact = true;
      const r = Math.random();
      if (r < 0.5) { v.handsUp = 1.2 + Math.random() * 1.2; v.jackHold = true; say(sayer(v), pick(["Don't shoot!", 'OK! OK!', 'Take it!'])); }
      else floorIt(v);
      continue;
    }
    if (!v.runReact && d < 14 && (me.moveSpeed || 0) > 4 && Math.abs(angDiff(fh, dir)) < 0.5) {
      v.runReact = true;
      const r = Math.random();
      if (r < 0.65) { v.npcLocked = true; fx.soundLatch(ctx.distCam(v.x, v.z), 1); if (Math.random() < 0.5) say(sayer(v), pick(['No no no!', 'Get away!', 'Not today!'])); if (r < 0.32) floorIt(v); }
    }
  }
}
const sayer = (v) => v.yeller || (v.yeller = { ch: { g: v.mesh } });
function updateHandsUp(dt) {
  for (const v of ctx.vehicles) {
    if (!(v.handsUp > 0)) continue;
    if (v.mode !== 'traffic') { v.handsUp = 0; continue; }
    v.handsUp -= dt;
    if (v.handsUp <= 0) { v.handsUp = 0; v.jackHold = false; if (ctx.me().enter?.v !== v) surrender(v); }
  }
}

// ---------- the station's parked cruisers ----------
export function cruiserNear() {
  if (!ctx.isHost()) return null;
  const me = ctx.me(), v = police.takeParked(me.x, me.z, 3.4);
  if (!v) return null;
  v.id = ctx.newId('pc'); v.mode = 'parked'; v.copCar = true; v.driver = ''; v.ag = null; v.sirenOn = false; v.vx = v.vz = v.w = 0;
  ctx.addVehicle(v);
  return v;
}

// ---------- bullets ----------
// p: where the round hit the car (world)
export function bulletHit(v, p) {
  if (v.exploded || v.T.boat || v.T.heli || v.T.plane) return;
  const P = v.mesh.userData.parts; if (!P) return;
  const dx = p.x - v.x, dz = p.z - v.z, lf = dx * Math.sin(v.h) + dz * Math.cos(v.h), lx = dx * Math.cos(v.h) - dz * Math.sin(v.h), ly = p.y - v.y;
  const T = v.T, mine = !v.driver || v.driver === ctx.uid();
  // a tyre: the nearest wheel, if the hit's on it
  if (P.wheels && !v.mods?.bp && ly < 1.1) {
    let best = null, bd = Infinity;
    for (const w of P.wheels) { const r = w.userData.r || 0.33, d = Math.hypot(lx - w.position.x, ly - (w.userData.y0 ?? w.position.y), lf - w.position.z) / r; if (d < bd) { bd = d; best = w; } }
    if (best && bd < 1.35) {
      const bit = wheelBit(best, T);
      if (bit && !((v.flats || 0) & bit)) {
        v.flats = (v.flats || 0) | bit; v.flat = true;
        fx.soundBackfire(ctx.distCam(p.x, p.z)); fx.smokePuff(p.x, p.y, p.z, true, 0.4);
        if (mine) ctx.writeVeh(v, true);
      }
      return;
    }
  }
  if (T.bike) return;
  // the side glass
  if (ly > T.hgt * 0.55 && ly < T.hgt * 0.97 && Math.abs(lx) > T.wid * 0.3) {
    const s = lx > 0 ? 'L' : 'R', a = P['door' + s], b = P['door' + s + '2'];
    const key = b && a ? (Math.abs(lf - (b.position.z - 0.4)) < Math.abs(lf - (a.position.z - 0.45)) ? 'door' + s + '2' : 'door' + s) : a ? 'door' + s : b ? 'door' + s + '2' : null;
    if (key && breakWindow(v, key) && mine) ctx.writeVeh(v, true);
    return;
  }
  // the fuel tank (rear quarter, low): a badly smashed-up car starts leaking, catches and goes up
  if (mine && lf < -T.len * 0.18 && ly < T.hgt * 0.6 && v.hp < T.hp * 0.45 && !v.burnAt && !v.fuelHit && Math.random() < 0.4) {
    v.fuelHit = 1.4; leaking.add(v);
  }
}
const leaking = new Set();
function updateLeaks(dt) {
  for (const v of leaking) {
    if (v.exploded || v.burnAt || !ctx.vehicles.includes(v)) { leaking.delete(v); continue; }
    v.fuelHit -= dt;
    const tx = v.x - Math.sin(v.h) * v.T.len * 0.35, tz = v.z - Math.cos(v.h) * v.T.len * 0.35;
    if (Math.random() < dt * 10) fx.smokePuff(tx, v.y + 0.25, tz, true, 0.3);
    if (v.fuelHit <= 0) {
      leaking.delete(v);
      v.burnAt = ctx.netNow() - 6000; v.burnBy = ctx.uid(); // 12 s from burnAt to the bang (main.js): ~6 s of fire
      fx.sparks(tx, v.y + 0.4, tz, 12); fx.soundBackfire(ctx.distCam(tx, tz));
      ctx.writeVeh(v, true);
    }
  }
}
// wheel bit: FL 1, FR 2, RL 4, RR 8 (wheels are car-local, +x = the left side); bikes front 1, back 4
function wheelBit(w, T) {
  const front = w.userData.front ?? w.position.z > 0;
  if (T.bike) return front ? 1 : 4;
  return (front ? 1 : 4) << (w.position.x < 0 ? 1 : 0);
}

// ---------- network: carried in the vehicle record's lamp bits ----------
export const bits = (v) => ((v.win || 0) << 8) | (alarming(v) ? 4096 : 0) | (v.unlocked ? 8192 : 0) | ((v.flats || 0) << 14);
export function applyBits(v, l) {
  const win = (l >> 8) & 15;
  if (win !== (v.win || 0)) {
    for (const k in WIN) if (win & WIN[k] && !((v.win || 0) & WIN[k])) breakWindow(v, k, ctx.distCam(v.x, v.z) < 60); // (glass only breaks here: a repair resets it via repair())
  }
  if (l & 4096) { if (!alarming(v)) startAlarmRemote(v); } else if (alarms.has(v)) { v.alarmEnd = 0; }
  if (l & 8192) v.unlocked = true;
  const fl = (l >> 14) & 15;
  if (fl !== (v.flats || 0)) { v.flats = fl; if (fl) v.flat = true; }
}
function startAlarmRemote(v) { v.alarmEnd = now() + 30; v.alarmHonk = 0; alarms.add(v); } // the owner's record turns it off

// ---------- per frame ----------
export function update(dt) {
  if (!ctx) return;
  updateAlarms(dt);
  updateLeaks(dt);
  updateHandsUp(dt);
  watchDrivers(dt);
  // a shaken car: a little rock on the springs (handle rattles, the elbow)
  for (const v of ctx.vehicles) {
    const body = v.mesh.visible && v.mesh.userData.body;
    if (!body) continue;
    if (v.rock > 0) { v.rock = Math.max(0, v.rock - dt * 2.5); body.rotation.z += Math.sin(v.rock * 30) * 0.012 * v.rock; }
    if (v.flats) sagOnFlats(v, body);
  }
}
// flat tyres sit lower and squash, and the car leans onto them
function sagOnFlats(v, body) {
  const P = v.mesh.userData.parts; if (!P?.wheels) return;
  let roll = 0, pitch = 0;
  for (const w of P.wheels) {
    const bit = wheelBit(w, v.T), flat = (v.flats & bit) !== 0;
    w.scale.y = flat ? 0.8 : 1;
    if (!flat) continue;
    w.position.y -= (w.userData.r || 0.33) * 0.22;
    roll += w.position.x > 0 ? -1 : 1; pitch += w.position.z > 0 ? 1 : -1;
  }
  if (!v.T.bike) { body.rotation.z += roll * 0.022; body.rotation.x += pitch * 0.014; body.position.y -= 0.03 * Math.min(2, Math.abs(roll) + Math.abs(pitch) * 0.5); }
}
