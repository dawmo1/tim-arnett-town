// Combat feel: everything about fighting that isn't "who got hit for how much" (main.js still owns targets and damage).
//  - aim: a smoothed 0..1 aim blend the camera eases its zoom, shoulder offset and field of view by, a sticky lock-on
//    that eases onto a target and lets go when you pull the mouse away, and a crosshair whose gap is the real spread
//  - guns: per-weapon recoil (a kick to the view that springs back), bloom from moving and firing that settles when
//    still, frame-rate independent fire timing, reload times, a hit-marker tick
//  - camera: smooth shake (layered sines scaled by "trauma", not per-frame random jumps) and a short hit pause
//  - melee: combos with wind-up, a contact frame (damage lands there, not on the click), recovery, and a buffered
//    next press; a stomp for people on the ground
//  - hit reactions: which way a person flinches from where they were hit (people/pose.js plays ch.react)
// Moves and hurt reactions reach other players as action codes in s[21]/s[22] (src/anim.js).
import { angDiff } from './util.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);

// ---------- guns ----------
// kick: view climb per shot (radians), yaw: random sideways, rec: recovery rate, bloom: crosshair growth per shot,
// spread: the weapon's own spread multiplier while hip-firing/moving, trauma: camera shake per shot, reload: seconds
const FEEL = {
  Pistol: { kick: 0.032, yaw: 0.008, rec: 10, bloom: 0.45, trauma: 0.12, reload: 1.3, fov: 50 },
  SMG: { kick: 0.011, yaw: 0.009, rec: 12, bloom: 0.16, trauma: 0.07, reload: 1.5, fov: 52 },
  Shotgun: { kick: 0.085, yaw: 0.012, rec: 6, bloom: 0.9, trauma: 0.42, reload: 1.8, fov: 52 },
  Rifle: { kick: 0.02, yaw: 0.007, rec: 10, bloom: 0.22, trauma: 0.13, reload: 1.6, fov: 44 },
  Sniper: { kick: 0.075, yaw: 0.004, rec: 4, bloom: 1, trauma: 0.3, reload: 2.2, fov: 16 },
  RPG: { kick: 0.06, yaw: 0, rec: 5, bloom: 1, trauma: 0.5, reload: 2.4, fov: 50 },
};
const F0 = { kick: 0.02, yaw: 0.006, rec: 9, bloom: 0.3, trauma: 0.1, reload: 1.3, fov: 50 };
export const feel = (w) => FEEL[w.name] || F0;
export const reloadTime = (w) => feel(w).reload;

const S = {
  aim: 0, // 0..1 aim blend (camera zoom / shoulder / fov)
  rp: 0, rv: 0, ry: 0, ryv: 0, // recoil offsets (pitch, yaw) and their velocities
  bloom: 0, // 0..1 extra spread from firing
  move: 0, // 0..1 smoothed movement (spread)
  trauma: 0, shakeT: 0, // camera shake
  pause: 0, pauseScale: 1, // hit pause (real seconds left)
  lockPull: 0, // how hard you've pulled away from the lock-on
};

// once per frame, with the real (unscaled) dt
export function tick(dt, o) {
  // aim blend: fast in, a touch slower out (critically damped look: exponential with a high rate)
  S.aim += ((o.aiming ? 1 : 0) - S.aim) * ease(o.aiming ? 14 : 9, dt);
  if (Math.abs(S.aim - (o.aiming ? 1 : 0)) < 0.002) S.aim = o.aiming ? 1 : 0;
  // recoil: the kick is a velocity that dies fast, the offset springs back to rest
  const f = o.weapon ? feel(o.weapon) : F0;
  S.rp += S.rv * dt; S.rv *= Math.exp(-dt * 28); S.rp *= Math.exp(-dt * f.rec * (o.firing ? 0.35 : 1));
  S.ry += S.ryv * dt; S.ryv *= Math.exp(-dt * 28); S.ry *= Math.exp(-dt * f.rec);
  // spread: firing blooms it, standing still settles it
  S.bloom = Math.max(0, S.bloom - dt * (o.firing ? 1.4 : 3.2));
  S.move += ((o.moving ? 1 : 0) - S.move) * ease(8, dt);
  S.trauma = Math.max(0, S.trauma - dt * 1.6); S.shakeT += dt;
  S.lockPull = Math.max(0, S.lockPull - dt * 3);
  if (S.pause > 0) S.pause -= dt;
}
export const aimBlend = () => S.aim;
// the view offset recoil adds right now (radians: pitch up, yaw)
export const recoilPitch = () => S.rp, recoilYaw = () => S.ry;
// a shot went off: kick the view, bloom the crosshair, shake a little
export function shot(w, aiming) {
  const f = feel(w), k = aiming ? 1 : 0.7;
  S.rv += f.kick * 28 * k * (0.85 + Math.random() * 0.3);
  S.ryv += (Math.random() - 0.5) * 2 * f.yaw * 28;
  S.bloom = Math.min(1, S.bloom + f.bloom);
  addTrauma(f.trauma * (aiming ? 0.8 : 1));
}
// the spread multiplier to apply to a weapon's base spread for the next shot
export function spreadMul(aiming, crouch) {
  return (aiming ? 1 : 2.0) * (1 + S.move * 0.8 + S.bloom * 1.4) * (crouch ? 0.75 : 1);
}
// time between shots, carrying the remainder so the rate doesn't depend on the frame rate
export function nextShot(cd, w, dt) { return Math.max(cd, -dt) + 1 / w.rate; }

// ---------- camera ----------
export function addTrauma(a) { S.trauma = Math.min(1, S.trauma + a); }
export function traumaAtLeast(a) { S.trauma = Math.max(S.trauma, Math.min(1, a)); }
// smooth shake offsets for the camera: { x, y, roll }; amount = trauma squared
export function shakeOffset() {
  const a = S.trauma * S.trauma, t = S.shakeT;
  if (a < 1e-4) return null;
  const n = (f, p) => Math.sin(t * f + p) * 0.6 + Math.sin(t * f * 2.13 + p * 1.7) * 0.4;
  return { x: n(31, 1) * a * 0.35, y: n(27, 4) * a * 0.3, roll: n(23, 7) * a * 0.05 };
}
// a short freeze-frame on a solid hit: sec of real time at the given speed
export function hitPause(sec, scale = 0.08) { if (sec > S.pause) { S.pause = sec; S.pauseScale = scale; } }
export const timeScale = () => (S.pause > 0 ? S.pauseScale : 1);

// ---------- lock-on ----------
// mouse movement while locked: a sharp pull lets go of the target (returns true)
export function pullLock(mx, my) { S.lockPull += Math.hypot(mx, my) * 0.012; return S.lockPull > 1; }
export function resetLock() { S.lockPull = 0; }
// how fast the view eases onto the target: snappy for the first moment, then sticky
export const lockRate = (heldFor) => (heldFor < 0.25 ? 16 : 8);

// ---------- crosshair ----------
let xh = null, xhGap = -1;
// px: the spread as a half-gap in pixels (0 hides the ticks)
export function crosshair(px) {
  if (!xh) { xh = document.getElementById('crosshair'); if (!xh) return; }
  const g = Math.round(clamp(px, 0, 60));
  if (g !== xhGap) { xhGap = g; xh.style.setProperty('--gap', g + 'px'); xh.classList.toggle('ticks', g > 0); }
}
// pixels on screen of an angular spread s at the camera's fov (degrees), screen height h
export const spreadPx = (s, fov, h) => (Math.atan(s) / ((fov * Math.PI) / 360)) * (h / 2);

// ---------- melee ----------
// dur: seconds, hit: contact as a fraction of dur, dmg/force (knockback), react: the victim's flinch,
// down: knocks them over (the combo finisher), pause: hit pause, lunge: metres stepped in during the wind-up
const MOVES = {
  jab: { dur: 0.3, hit: 0.4, dmg: 8, range: 1.75, force: 1.6, react: 'head', pause: 0.035, lunge: 0.25 },
  cross: { dur: 0.36, hit: 0.42, dmg: 11, range: 1.85, force: 2.2, react: 'head', pause: 0.045, lunge: 0.3 },
  hook: { dur: 0.42, hit: 0.48, dmg: 13, range: 1.75, force: 3, react: 'side', pause: 0.055, lunge: 0.2, stagger: 0.45 },
  upper: { dur: 0.62, hit: 0.42, dmg: 18, range: 1.8, force: 6.5, react: 'head', down: true, pause: 0.1, lunge: 0.35 },
  kick: { dur: 0.58, hit: 0.42, dmg: 16, range: 2.0, force: 6, react: 'gut', down: true, pause: 0.09, lunge: 0.2 },
  stomp: { dur: 0.52, hit: 0.55, dmg: 14, range: 1.7, force: 1, react: 'gut', low: true, pause: 0.06, lunge: 0.3 },
  slashR: { dur: 0.32, hit: 0.45, dmg: 22, range: 1.75, force: 2, react: 'side', pause: 0.04, lunge: 0.3 },
  slashL: { dur: 0.34, hit: 0.45, dmg: 22, range: 1.75, force: 2, react: 'side', pause: 0.04, lunge: 0.25 },
  stab: { dur: 0.5, hit: 0.45, dmg: 40, range: 1.8, force: 3.5, react: 'gut', pause: 0.08, lunge: 0.45, stagger: 0.5 },
  swingR: { dur: 0.55, hit: 0.5, dmg: 24, range: 2.4, force: 4, react: 'side', pause: 0.07, lunge: 0.25, stagger: 0.6 },
  swingL: { dur: 0.55, hit: 0.5, dmg: 24, range: 2.4, force: 4, react: 'side', pause: 0.07, lunge: 0.2, stagger: 0.6 },
  smash: { dur: 0.8, hit: 0.52, dmg: 38, range: 2.3, force: 7.5, react: 'head', down: true, pause: 0.12, lunge: 0.35 },
};
export const MOVE_NAMES = Object.keys(MOVES);
const COMBOS = { fists: ['jab', 'cross', 'hook', 'upper'], knife: ['slashR', 'slashL', 'stab'], bat: ['swingR', 'swingL', 'smash'] };
export const styleOf = (w) => (w.name === 'Knife' ? 'knife' : w.kind === 'bat' ? 'bat' : 'fists');
export const moveInfo = (n) => MOVES[n];

const M = { cur: null, t: 0, i: -1, style: '', queued: false, chain: 0, hitDone: false, onHit: null, w: null, low: false };
// Press attack. low: the target in front is on the ground (stomp it). Returns true if something started or was queued.
export function meleePress(w, low, onHit) {
  const style = styleOf(w);
  if (M.cur) { // mid-move: buffer the next one (if we're past the wind-up)
    if (M.t / MOVES[M.cur].dur > 0.2) M.queued = { low };
    return true;
  }
  startNext(style, w, low, onHit);
  return true;
}
function startNext(style, w, low, onHit) {
  const list = COMBOS[style];
  if (M.style !== style || M.chain <= 0) M.i = -1;
  M.style = style; M.w = w; M.onHit = onHit || M.onHit;
  let n;
  if (low && style !== 'knife') { n = style === 'bat' ? 'smash' : 'stomp'; M.i = -1; }
  else { M.i = (M.i + 1) % list.length; n = list[M.i]; }
  M.cur = n; M.t = 0; M.hitDone = false; M.queued = false; M.low = low;
}
// advance the move playing (with the game's dt, so a hit pause freezes it too)
export function tickMelee(dt) {
  M.chain -= dt;
  if (!M.cur) return;
  const mv = MOVES[M.cur];
  M.t += dt;
  const k = M.t / mv.dur;
  if (!M.hitDone && k >= mv.hit) { M.hitDone = true; M.onHit?.(M.cur, mv, M.low); }
  // a buffered press cuts the recovery short (after the hit has landed and the arm is on its way back)
  const cancelAt = Math.max(mv.hit + 0.18, 0.72);
  if ((M.queued && k >= cancelAt) || k >= 1) {
    const q = M.queued;
    M.cur = null; M.chain = 0.5; // a short window to keep the combo going
    if (q) startNext(M.style, M.w, q.low);
    else if (M.i === COMBOS[M.style].length - 1) M.chain = 0; // finisher done: start over
  }
}
export function meleeCancel() { M.cur = null; M.queued = false; M.chain = 0; }
// the move playing: { n, k } or null
export const meleeNow = () => (M.cur ? { n: M.cur, k: Math.min(1, M.t / MOVES[M.cur].dur) } : null);
// still in the wind-up (before contact): the body turns toward the target and steps in
export const meleeWindup = () => !!M.cur && !M.hitDone;
// how much a move holds your feet: 1 = free, 0 = planted
export const meleeMoveScale = () => (M.cur ? 0.25 : 1);

// Pick a melee target in front: the nearest within reach and a wide cone, preferring what you're facing.
// list: [{ x, z, ref }]; returns the best entry or null
export function meleeTarget(x, z, h, list, reach = 2.6) {
  let best = null, bs = 1e9;
  for (const e of list) {
    const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz);
    if (d > reach || d < 0.05) continue;
    const off = Math.abs(angDiff(h, Math.atan2(dx, dz)));
    if (off > 1.1) continue;
    const s = d + off * 1.4;
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}

// ---------- hit reactions ----------
// Set a flinch on a character. dx, dz: the direction the blow travelled; hy: height of the hit above their feet;
// big: 0..1 how hard. Kinds: head (snaps back), gut (doubles over), side (twists away), back (pitched forward), leg (buckles)
export function react(ch, h, dx, dz, hy = 1.2, big = 0.5, kind = null) {
  if (!ch) return null;
  const fx = Math.sin(h), fz = Math.cos(h), lx = Math.cos(h), lz = -Math.sin(h); // their forward and left
  const along = dx * fx + dz * fz, side = dx * lx + dz * lz; // + travelling the way they face (hit from behind), + pushed to their left
  if (!kind) {
    if (hy < 0.75) kind = 'leg';
    else if (along > 0.55) kind = 'back';
    else if (Math.abs(side) > 0.6) kind = 'side';
    else kind = hy > 1.45 ? 'head' : 'gut';
  }
  ch.react = { kind, t: 0, dur: 0.38 + big * 0.35, mag: 0.6 + big * 0.6, sx: side >= 0 ? 1 : -1 };
  return kind;
}
// a short code for a reaction kind, sent to other players (anim.js LIST)
export const REACT_CODE = { head: 'hurtHead', gut: 'hurtGut', side: 'hurtSide', back: 'hurtBack', leg: 'hurtLeg' };
export const CODE_REACT = Object.fromEntries(Object.entries(REACT_CODE).map(([k, v]) => [v, k]));

// Knockback: a person slides away from a blow over a moment (feet stay on the ground).
const pushes = [];
export function push(obj, dx, dz, dist, dur = 0.22) { const l = Math.hypot(dx, dz) || 1; pushes.push({ obj, x: dx / l, z: dz / l, v: dist / dur * 1.6, t: dur }); }
// collide(x, z) -> {x, z} keeps them out of walls
export function tickPushes(dt, collide) {
  for (let i = pushes.length - 1; i >= 0; i--) {
    const p = pushes[i], o = p.obj;
    p.t -= dt;
    if (p.t <= 0 || o.dead || o.ch?.rag) { pushes.splice(i, 1); continue; }
    const s = p.v * dt; p.v *= Math.exp(-dt * 7);
    const q = collide(o.x + p.x * s, o.z + p.z * s);
    o.x = q.x; o.z = q.z;
  }
}

// ---------- other players ----------
// what to send in s[21]/s[22]: the move playing, else a fresh flinch; null when neither
export function netAct(ch) {
  const m = meleeNow();
  if (m) return m;
  const r = ch && ch.react;
  if (r && r.t < r.dur) return { n: REACT_CODE[r.kind], k: r.t / r.dur };
  return null;
}
// a remote player's combat code -> pose fields (their move played on a local clock, so it stays smooth between
// updates), and their flinch started once. Returns null for any other code.
export function remoteFields(r, a, dt) {
  const n = a && a.n;
  if (n && CODE_REACT[n]) {
    if (r.cHurt !== n || a.k + 0.05 < (r.cHurtK ?? 1)) react(r.ch, r.h, 0, 0, 1.2, 0.5, CODE_REACT[n]);
    r.cHurt = n; r.cHurtK = a.k; r.cMove = null;
    return {};
  }
  r.cHurt = null;
  const mv = n && MOVES[n];
  if (!mv) { r.cMove = null; return null; }
  if (r.cMove !== n || a.k + 0.05 < r.cK) { r.cMove = n; r.cT = a.k * mv.dur; } else r.cT += dt;
  r.cK = a.k;
  return { melee: { n, k: Math.min(1, r.cT / mv.dur) } };
}
