// Wanted level: crimes need witnesses, and stars depend on how bad the crime was.
// While no cop can see you, the police search your last known spot; their vision cones show on the minimap.
// HUD reads wanted.stars and wanted.search (true = cops lost sight and are searching, false = they see you).
import * as W from './world.js';
import * as police from './police.js';
import { walkers } from './npc.js';
import { angDiff } from './util.js';

export const wanted = { stars: 0, search: false, searchT: 0, lk: { x: 0, z: 0 }, copKills: 0, callers: [] };
let hooks = { announce() {}, onRaise() {} };
export function initWanted(h) { hooks = { ...hooks, ...h }; }
export function resetWanted() { Object.assign(wanted, { stars: 0, search: false, searchT: 0, copKills: 0, callers: [] }); }

// Can police unit c see the point? Cones are blocked by buildings.
export function sees(c, x, y, z) {
  const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
  if (d > c.range) return false;
  if (!c.heli && d > 5 && Math.abs(angDiff(c.h, Math.atan2(dx, dz))) > c.fov / 2) return false;
  return W.lineOfSight(c.x, c.y, c.z, x, y, z);
}
export function copSees(x, y, z) { return police.viewers().some((c) => sees(c, x, y, z)); }
const copNear = (x, z, r) => police.viewers().some((c) => Math.hypot(c.x - x, c.z - z) < r);

// A townsperson who saw it pulls out a phone; if they finish the call, the cops come.
function civilianCall(x, z, lvl, nowMs, r = 45) {
  let best = null, bd = r;
  for (const w of walkers) {
    if (w.dead || w.call) continue;
    const d = Math.hypot(w.x - x, w.z - z);
    if (d < bd && W.lineOfSight(w.x, (w.y || 0) + 1.6, w.z, x, W.groundHeight(x, z) + 1.2, z)) { bd = d; best = w; }
  }
  if (!best) return;
  best.call = { t: 4 + Math.random() * 2, lvl, x, z };
  wanted.callers.push(best);
}

function raise(lvl, x, z, spotted) {
  const n = Math.min(5, Math.max(wanted.stars, lvl));
  if (n > wanted.stars) { wanted.stars = n; hooks.onRaise(n); }
  if (spotted) { wanted.search = false; wanted.searchT = 0; wanted.lk = { x, z }; }
  else if (!wanted.search) { wanted.search = true; wanted.searchT = 0; wanted.lk = { x, z }; }
}

// type: assault | steal | carjack | gunfire | kill | bumpcop | ramcop | hitcop | killcop | killheli
// Crimes against the police always count, even at 0 stars: the cop it happened to is the witness.
export function crime(type, x, y, z) {
  const seen = copSees(x, y + 1.2, z);
  switch (type) {
    case 'assault': case 'steal': if (seen) raise(1, x, z, true); break;
    case 'carjack': if (seen) raise(1, x, z, true); else civilianCall(x, z, 1); break;
    // smashing into a parked car (carjack.js): a screaming alarm gets someone dialling, a quiet one only if they're close
    case 'breakin': if (seen) raise(1, x, z, true); else civilianCall(x, z, 1); break;
    case 'breakinQuiet': if (seen) raise(1, x, z, true); else if (Math.random() < 0.5) civilianCall(x, z, 1, 0, 18); break;
    case 'copcar': raise(1, x, z, seen); break; // a cruiser's break-in is logged at once
    case 'gunfire': if (copNear(x, z, 35)) raise(2, x, z, true); else if (seen || copNear(x, z, 80)) raise(1, x, z, seen); else if (Math.random() < 0.5) civilianCall(x, z, 1); break;
    case 'bumpcop': raise(1, x, z, true); break; // a tap on a cop car: they light up and chase
    case 'ramcop': raise(2, x, z, true); break; // a real ram
    case 'kill': if (seen) raise(3, x, z, true); else civilianCall(x, z, 2); break;
    case 'hitcop': raise(3, x, z, true); break;
    case 'robbery': raise(2, x, z, seen); break; // the clerk's alarm calls it in
    case 'casino': raise(3, x, z, seen); break; // casino security calls everyone
    case 'killcop': {
      wanted.copKills++;
      let lvl = 4;
      if (wanted.stars >= 4 && wanted.copKills % 3 === 0) lvl = wanted.stars + 1; // keep killing cops and it keeps climbing
      raise(lvl, x, z, true);
      break;
    }
    case 'killheli': raise(5, x, z, true); break;
  }
}

// Someone (a carjacked driver) phones it in themselves: lvl stars when they finish the call, unless they're stopped.
export function callCops(w, lvl, x, z) {
  if (!w || w.dead || w.call) return;
  w.call = { t: 4 + Math.random() * 2, lvl, x, z };
  wanted.callers.push(w);
}

// Returns 'lost' the frame the stars clear.
export function updateWanted(dt, me) {
  for (let i = wanted.callers.length - 1; i >= 0; i--) {
    const w = wanted.callers[i];
    if (!w.call || w.dead) { w.call = null; wanted.callers.splice(i, 1); continue; }
    w.call.t -= dt;
    if (w.call.t <= 0) {
      const c = w.call; w.call = null; wanted.callers.splice(i, 1);
      if (!me.dead) raise(c.lvl, c.x, c.z, false); // no banner: the stars (flashing while wanted.search) say it
    }
  }
  if (wanted.stars <= 0 || me.dead) return null;
  if (copSees(me.x, me.y + 1.2, me.z)) { wanted.search = false; wanted.searchT = 0; wanted.lk = { x: me.x, z: me.z }; return null; }
  if (!wanted.search) { wanted.search = true; wanted.searchT = 0; }
  if (!me.pinned) wanted.searchT += dt * (me.hiding ? 2.5 : 1); // inside a shop or a parking ramp they lose you much faster
  if (wanted.searchT > 8 + wanted.stars * 4) { resetWanted(); return 'lost'; }
  return null;
}

// Vision cones for the minimap, traced against buildings: [{x, z, pts: [[x,z]...], heli}]
export function cones() {
  const out = [];
  for (const c of police.viewers()) {
    if (c.heli) { out.push({ x: c.x, z: c.z, r: c.range, heli: true }); continue; }
    const pts = [];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = c.h - c.fov / 2 + (c.fov * i) / n;
      const dx = Math.sin(a), dz = Math.cos(a);
      const t = W.rayBuildings(c.x, c.y, c.z, dx, 0, dz, c.range);
      pts.push([c.x + dx * t, c.z + dz * t]);
    }
    out.push({ x: c.x, z: c.z, pts });
  }
  return out;
}
