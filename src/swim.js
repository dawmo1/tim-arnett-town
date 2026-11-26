// Swimming, GTA-style, anywhere the map has water (the Mississippi and its sloughs, the Rock River, lakes and ponds).
//  - on the surface: breaststroke, freestyle while sprinting (it uses stamina; out of breath you're back to
//    breaststroke until it recovers), treading water when still; weapons are holstered
//  - C dives (a duck dive) and C / Space swim down / up underwater; W swims where the camera looks; your breath
//    runs out in about 25 s (faster sprinting), then you start drowning; it refills at the surface
//  - swimming into a low bank, a riverside wall or a boat's side climbs out; falling in from a height plunges you
//    under for a moment
//  - splashes, strokes and bubbles (fx.js), recorded CC0 water sounds, a murky green-brown view and muffled sound
//    underwater
// main.js calls update() each frame while me.swim; the pose goes to people/pose.js (st.swim) and to other players as
// anim.js state codes (swimTread / swimBreast / swimCrawl / swimUnder / swimDive, k = pitch).
import * as W from './world.js';
import { angDiff } from './util.js';

const RATE = { tread: 1.1, breast: 0.85, crawl: 1.25, under: 0.75 }; // strokes a second (matches people/pose.js)
const SPEED = { tread: 0, breast: 1.6, crawl: 3.3, under: 1.9, underFast: 2.9 };
const BREATH = 25, BREATH_FAST = 17, REFILL = 3.5, STAMINA = 9, REST = 7;
export const BODY = 0.6; // the body's middle above me.y while swimming flat

const S = { under: false, breath: 1, stam: 1, tired: false, v: 0, vy: 0, pitch: 0, diveT: 0, plunge: 0, climb: null, ph: 0, splashT: 0, bubbleT: 0, low: false, style: 'tread' };
export const state = S;
let ctx = { splash() {}, stroke() {}, bubbles() {}, gasp() {} };
export function initSwim(c) { Object.assign(ctx, c); }
export const under = () => S.under;
export const breath = () => S.breath;
export const stamina = () => S.stam;
export function reset() { S.under = false; S.breath = 1; S.stam = 1; S.tired = false; S.v = 0; S.vy = 0; S.pitch = 0; S.diveT = 0; S.plunge = 0; S.climb = null; S.style = 'tread'; }
// the river bed under (x, z): how low the body can go
const floorY = (x, z) => W.terrainHeight(x, z) - 0.3;
const canDive = (x, z) => floorY(x, z) < W.SWIM_Y - 0.9;

// Into the water: from a fall (vy: m/s, < 0) you go under and bob back up; a car sinking with you in it: under = true
export function enter(me, vy = 0, underAt = null) {
  S.climb = null; S.diveT = 0; S.v = Math.min(S.v, 1.5);
  if (underAt !== null && canDive(me.x, me.z)) { S.under = true; me.y = Math.max(floorY(me.x, me.z), Math.min(W.SWIM_Y - 0.6, underAt)); S.vy = 0; S.plunge = 0; return; }
  const v = -vy;
  ctx.splash(me.x, me.z, Math.min(1, v / 9), true);
  if (v > 6.5 && canDive(me.x, me.z)) { S.under = true; S.plunge = 1; S.vy = -Math.min(6, v * 0.45); me.y = W.SWIM_Y - 0.3; }
  else { S.under = false; me.y = W.SWIM_Y; }
}
// C pressed on the surface: duck dive
export function dive(me) {
  if (S.under || S.climb || !canDive(me.x, me.z)) return false;
  S.under = true; S.diveT = 0.55; S.vy = -1.6; S.pitch = 45;
  ctx.splash(me.x + Math.sin(me.h) * 0.5, me.z + Math.cos(me.h) * 0.5, 0.35, false);
  return true;
}
// holding your breath somewhere other than swimming (in a car that's gone under): true once it's run out
export function holdBreath(dt) { S.breath = Math.max(0, S.breath - dt / BREATH); return S.breath <= 0; }

// One frame. i: { fwd, side, camYaw, camPitch, sprint, up, down }, me: { x, y, z, h }
// Returns { x, y, z, h, speed, pose, drown (damage this frame), climb (0..1 climbing out), out (back on land) }
export function update(dt, me, i) {
  let { x, y, z, h } = me;
  // ---- climbing out onto a bank / a wall / a boat's side ----
  if (S.climb) {
    const c = S.climb; c.t += dt;
    const k = Math.min(1, c.t / c.dur);
    y = c.from.y + (c.to.y - c.from.y) * Math.min(1, k / 0.6);
    const m = Math.max(0, (k - 0.55) / 0.45);
    x = c.from.x + (c.to.x - c.from.x) * m; z = c.from.z + (c.to.z - c.from.z) * m;
    if (k > 0.2 && !c.drip) { c.drip = true; ctx.splash(c.from.x, c.from.z, 0.25, false); }
    if (k >= 1) { S.climb = null; S.under = false; return { x, y: c.to.y, z, h, speed: 0, out: true }; }
    return { x, y, z, h, speed: 0, climb: k };
  }
  const cy = Math.sin(i.camYaw), cz = Math.cos(i.camYaw), rx = -Math.cos(i.camYaw), rz = Math.sin(i.camYaw);
  let mx = cy * i.fwd + rx * i.side, mz = cz * i.fwd + rz * i.side;
  const ml = Math.hypot(mx, mz);
  if (ml > 0) { mx /= ml; mz /= ml; }
  // stamina: sprint strokes use it, resting refills it; empty = tired until it's back over a third
  const sprinting = i.sprint && ml > 0 && !S.tired;
  S.stam = Math.max(0, Math.min(1, S.stam + (sprinting ? -dt / STAMINA : dt / REST)));
  if (S.stam <= 0) S.tired = true; else if (S.stam > 0.6) S.tired = false;
  let drown = 0;
  if (S.under) {
    // ---- underwater: swim where the camera looks (W), C / Space down / up, the breath meter running ----
    S.breath = Math.max(0, S.breath - dt / (sprinting ? BREATH_FAST : BREATH));
    if (S.breath <= 0) drown = 9 * dt;
    if (S.breath < 0.3 && !S.low) { S.low = true; ctx.bubbles(x, y + BODY + 0.3, z, 8); }
    const want = ml > 0 ? (sprinting ? SPEED.underFast : SPEED.under) : 0;
    S.v += (want - S.v) * Math.min(1, dt * 2.5);
    const look = i.fwd > 0 ? Math.max(-1.2, Math.min(1.2, i.camPitch * 1.6)) : 0; // pitch down: dive deeper
    const vert = (i.up ? 1 : 0) - (i.down ? 1 : 0);
    S.diveT = Math.max(0, S.diveT - dt);
    if (S.plunge > 0) { S.vy = Math.min(1.8, S.vy + 7 * dt); if (i.down) S.plunge = 0; } // after a plunge you bob back up (unless you swim down: C)
    else S.vy += ((vert * 1.8 - Math.sin(look) * S.v * (i.fwd > 0 ? 1 : 0)) + (vert === 0 && ml === 0 ? 0.25 : 0) - S.vy) * Math.min(1, dt * 3) + (S.diveT > 0 ? -2.5 * dt : 0);
    if (ml > 0) h += angDiff(h, Math.atan2(mx, mz)) * Math.min(1, dt * 5);
    const fx = Math.sin(h) * Math.cos(look) * S.v, fz = Math.cos(h) * Math.cos(look) * S.v;
    let nx = x + fx * dt, nz = z + fz * dt, ny = y + S.vy * dt;
    // banks and walls under the water
    const fl = floorY(nx, nz);
    if (W.isLand(nx, nz) && W.terrainHeight(nx, nz) > ny + BODY) { nx = x; nz = z; }
    const q = W.pushOutCircle(nx, nz, 0.4, ny); nx = q.x; nz = q.z;
    if (ny < fl) { ny = fl; S.vy = Math.max(0, S.vy); }
    if (ny >= W.SWIM_Y) { // back up for air
      ny = W.SWIM_Y; S.under = false; S.vy = 0; S.diveT = 0; S.plunge = 0;
      ctx.splash(nx, nz, 0.3, false);
      if (S.low || S.breath < 0.5) ctx.gasp();
      S.low = false;
    }
    x = nx; z = nz; y = ny;
    const pitchTo = S.diveT > 0 ? 50 : ml > 0 ? Math.max(-70, Math.min(70, -S.vy / Math.max(0.6, S.v + 0.4) * 50)) : 0;
    S.pitch += (pitchTo - S.pitch) * Math.min(1, dt * 4);
    S.bubbleT -= dt;
    if (S.bubbleT <= 0) { S.bubbleT = (S.low ? 0.35 : 1.1) + Math.random() * 0.9; ctx.bubbles(x + Math.sin(h) * 0.6, y + BODY + 0.15, z + Math.cos(h) * 0.6, S.low ? 4 : 2); }
  } else {
    // ---- on the surface ----
    S.breath = Math.min(1, S.breath + dt / REFILL);
    if (i.down && dive({ x, y, z, h })) return { x, y, z, h, speed: S.v, pose: pose(dt, 0, i), drown: 0 };
    const style = ml === 0 ? 'tread' : sprinting ? 'crawl' : 'breast';
    S.v += (SPEED[style] - S.v) * Math.min(1, dt * (style === 'tread' ? 1.5 : 2.2));
    if (ml > 0) h += angDiff(h, Math.atan2(mx, mz)) * Math.min(1, dt * 3.5);
    const fx = Math.sin(h), fz = Math.cos(h);
    let nx = x + fx * S.v * dt, nz = z + fz * S.v * dt;
    // the edge: a bank, a riverside wall or a dock low enough to haul yourself out (or a beach to wade out of); higher
    // than you can reach, it stops you
    const q = W.pushOutCircle(nx, nz, 0.4, y), blocked = q.hit || (W.isLand(nx, nz) && W.groundHeight(nx, nz) > W.WATER_Y + 0.3);
    if (ml > 0 && mx * fx + mz * fz > 0.5) {
      let dl = -1;
      for (let d = 0.5; d <= 2.01; d += 0.25) if (W.isLand(x + fx * d, z + fz * d)) { dl = d; break; }
      if (dl > 0 && (dl <= 0.9 || (blocked && dl <= 2))) {
        const lx = x + fx * dl, lz = z + fz * dl, top = W.surfaceHeight(lx, lz, W.WATER_Y + 2.6), rise = top - W.WATER_Y;
        const wall = W.rayBuildings(x, W.WATER_Y + 2.6, z, fx, 0, fz, dl + 0.6) < dl + 0.6; // something taller than you can reach in the way
        if (rise < 0.35 && !blocked) return { x: lx, y: W.groundHeight(lx, lz), z: lz, h, speed: S.v, out: true }; // a shelving beach: just wade out
        if (rise < 2.5 && !wall) {
          const tx = lx + fx * 0.55, tz = lz + fz * 0.55, ty = W.isLand(tx, tz) ? W.surfaceHeight(tx, tz, top + 0.5) : top;
          if (W.isLand(tx, tz) && !W.pushOutCircle(tx, tz, 0.35, ty).hit && Math.abs(ty - top) < 0.7) {
            S.climb = { t: 0, dur: 0.85 + Math.max(0, rise) * 0.25, from: { x, y, z }, to: { x: tx, y: ty, z: tz } };
            return { x, y, z, h, speed: 0, climb: 0 };
          }
        }
      }
    }
    if (blocked) { S.v *= 0.5; if (!q.hit) { nx = x; nz = z; } else { nx = q.x; nz = q.z; } }
    x = nx; z = nz;
    y = W.SWIM_Y;
    S.pitch += (0 - S.pitch) * Math.min(1, dt * 4);
    S.style = style;
  }
  // strokes: a splash (and a paddle sound) each time a hand comes over / through the water
  const style = S.under ? 'under' : S.style;
  const prev = S.ph;
  S.ph = (S.ph + dt * RATE[style] * (style === 'tread' || S.v > 0.2 ? 1 : 0.35)) % 1;
  const wrap = (a) => (prev < a && S.ph >= a) || (prev > S.ph && (S.ph >= a || prev < a));
  if (!S.under) {
    if ((style === 'breast' && wrap(0.45)) || (style === 'crawl' && (wrap(0.5) || wrap(0))) || (style === 'tread' && wrap(0.5) && Math.random() < 0.4)) {
      const side = style === 'crawl' ? (S.ph < 0.5 ? 1 : -1) : 0, lx = Math.cos(h) * side * 0.3, lz = -Math.sin(h) * side * 0.3;
      ctx.stroke(x + Math.sin(h) * 0.8 + lx, z + Math.cos(h) * 0.8 + lz, style === 'crawl' ? 0.6 : style === 'tread' ? 0.15 : 0.4);
    }
  } else if (wrap(0.5) && S.v > 0.5) ctx.bubbles(x - Math.sin(h) * 0.8, y + BODY - 0.1, z - Math.cos(h) * 0.8, 1);
  return { x, y, z, h, speed: S.v, pose: pose(dt, 0, i), drown };
}
function pose() {
  if (S.under && S.diveT > 0) return { swim: { style: 'dive', k: 1 - S.diveT / 0.55 } };
  return { swim: { style: S.under ? 'under' : S.style, pitch: S.pitch } };
}
// what to send to other players: { n, k } (k: the pitch underwater, -90..90 mapped to 0..1)
export function netAct() {
  if (S.climb) return null;
  const n = S.under ? (S.diveT > 0 ? 'swimDive' : 'swimUnder') : S.style === 'crawl' ? 'swimCrawl' : S.style === 'breast' ? 'swimBreast' : 'swimTread';
  return { n, k: Math.round(Math.max(0, Math.min(0.99, S.pitch / 180 + 0.5)) * 100) / 100, side: 1 };
}
