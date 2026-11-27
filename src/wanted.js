// Wanted level: a crime only counts once a cop sees it or a witness phones it in; stars depend on how bad it was.
// While no cop can see you, the police search your last known spot; their vision cones show on the minimap.
// HUD reads wanted.stars and wanted.search (true = cops lost sight and are searching, false = they see you).
import * as W from './world.js';
import * as police from './police.js';
import { walkers } from './npc.js';
import { angDiff } from './util.js';

export const wanted = { stars: 0, search: false, searchT: 0, lk: { x: 0, z: 0 }, copKills: 0, callers: [] };
let hooks = { announce() {}, onRaise() {}, feed() {}, witness() {} };
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

// ---------- witnesses ----------
// Nobody gets stars for a crime until it's reported. A cop who sees it is instant; a townsperson who sees it
// (in range, facing it or close enough to hear, nothing in the way) pulls out a phone and backs off, and only once
// the call goes through (a few seconds) do the stars come. Kill them, knock them down or stick a gun in their face
// first and the call never happens. Gang members never call the cops.
const NO_CALL = new Set(['hostile', 'gone', 'script', 'surrender']);
const nowMs = () => performance.now();
// everyone who could report a crime at (x, y, z): [{w, d}] nearest first
function witnesses(x, y, z, r, heard) {
  const out = [], ty = y + 1.2, t = nowMs();
  for (const w of walkers) {
    if (w.dead || w.ch?.rag || NO_CALL.has(w.mode) || w.gang || (w.noCallUntil || 0) > t) continue;
    const dx = x - w.x, dz = z - w.z, d = Math.hypot(dx, dz);
    if (d > r) continue;
    // out of the corner of your eye: behind you only counts close up (or if it's loud)
    if (!heard && d > 8 && Math.abs(angDiff(w.h, Math.atan2(dx, dz))) > 1.9) continue;
    if (!W.lineOfSight(w.x, (w.y || 0) + 1.6, w.z, x, ty, z)) continue;
    out.push({ w, d });
  }
  return out.sort((a, b) => a.d - b.d);
}
// Returns true if someone is (now) phoning it in. o: {r, chance, heard}
function witnessCall(x, y, z, lvl, o = {}) {
  const list = witnesses(x, y, z, o.r || 45, o.heard);
  if (!list.length) return false;
  // someone's already on the phone and saw this too: it goes in the same call
  const busy = list.find((q) => q.w.call);
  if (busy) { const c = busy.w.call; c.lvl = Math.max(c.lvl, lvl); c.x = x; c.z = z; return true; }
  if (Math.random() > (o.chance ?? 1)) return false;
  startCall(list[0].w, lvl, x, z, true);
  return true;
}
function startCall(w, lvl, x, z, flee) {
  w.call = { t: 4.5 + Math.random() * 3, lvl, x, z };
  if (!wanted.callers.includes(w)) wanted.callers.push(w);
  if (flee) hooks.witness(w, x, z); // backs off from you with the phone to their ear
}

function raise(lvl, x, z, spotted) {
  const n = Math.min(5, Math.max(wanted.stars, lvl));
  if (n > wanted.stars) { wanted.stars = n; hooks.onRaise(n); }
  if (spotted) { wanted.search = false; wanted.searchT = 0; wanted.lk = { x, z }; }
  else { wanted.search = true; wanted.searchT = 0; wanted.lk = { x, z }; } // a fresh report: they head for it
}

// type: assault | steal | carjack | breakin | breakinQuiet | copcar | gunfire | kill | robbery | casino | drunk | aimcop
//       | bumpcop | ramcop | hitcop | killcop | killheli
// Crimes against the police always count, even at 0 stars: the cop it happened to is the witness.
export function crime(type, x, y, z) {
  const seen = copSees(x, y + 1.2, z);
  const civ = (lvl, o) => { if (seen) raise(lvl, x, z, true); else witnessCall(x, y, z, lvl, o); };
  switch (type) {
    case 'assault': case 'steal': case 'carjack': civ(1); break;
    case 'drunk': if (seen) raise(1, x, z, true); break; // weaving about: only a cop cares
    // smashing into a parked car (carjack.js): a screaming alarm gets someone dialling, a quiet one only if they're close
    case 'breakin': civ(1, { r: 60, chance: 0.85, heard: true }); break;
    case 'breakinQuiet': civ(1, { r: 18, chance: 0.5 }); break;
    case 'copcar': raise(1, x, z, seen); break; // a cruiser's break-in is logged at once
    case 'aimcop': raise(1, x, z, true); break; // a gun pointed at a cop: that cop saw it
    // a cop who sees it close by goes straight to 2; one who only hears it nearby comes looking (1, searching)
    case 'gunfire':
      if (seen) raise(copNear(x, z, 35) ? 2 : 1, x, z, true);
      else if (copNear(x, z, 45)) raise(1, x, z, false);
      else witnessCall(x, y, z, 1, { r: 60, chance: 0.8, heard: true });
      break;
    case 'bumpcop': raise(1, x, z, true); break; // a tap on a cop car: they light up and chase
    case 'ramcop': raise(2, x, z, true); break; // a real ram
    case 'kill': civ(seen ? 3 : 2, { r: 55 }); break;
    case 'hitcop': raise(3, x, z, true); break;
    case 'robbery': raise(2, x, z, seen); break; // the clerk's silent alarm calls it in
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
  startCall(w, lvl, x, z, false);
}

// How far from the last known spot you need to be before the search clock runs at full speed.
const SEARCH_R = [0, 80, 120, 170, 230, 300];
// Returns 'lost' the frame the stars clear.
export function updateWanted(dt, me) {
  for (let i = wanted.callers.length - 1; i >= 0; i--) {
    const w = wanted.callers[i];
    // stopped: dead, knocked flat, held at gunpoint or fighting back. A scared witness won't try again for a while.
    if (!w.call || w.dead || w.ch?.rag || (NO_CALL.has(w.mode) && w.mode !== 'gone')) {
      if (w.call && !w.dead) w.noCallUntil = nowMs() + 30000;
      w.call = null; wanted.callers.splice(i, 1); continue;
    }
    w.call.t -= dt;
    if (w.call.t <= 0) {
      const c = w.call; w.call = null; wanted.callers.splice(i, 1);
      if (!me.dead) { raise(c.lvl, c.x, c.z, copSees(me.x, me.y + 1.2, me.z)); hooks.feed('Witness called 911'); }
    }
  }
  if (wanted.stars <= 0 || me.dead) return null;
  if (copSees(me.x, me.y + 1.2, me.z)) { wanted.search = false; wanted.searchT = 0; wanted.lk = { x: me.x, z: me.z }; return null; }
  if (!wanted.search) { wanted.search = true; wanted.searchT = 0; }
  // the clock only really runs once you're clear of where they last had you; hanging round there it barely moves
  const away = Math.hypot(me.x - wanted.lk.x, me.z - wanted.lk.z) > SEARCH_R[wanted.stars];
  if (!me.pinned) wanted.searchT += dt * (away ? 1 : 0.35) * (me.hiding ? 2.5 : 1); // inside a shop or a parking ramp they lose you much faster
  if (wanted.searchT > 10 + wanted.stars * 5) { resetWanted(); return 'lost'; }
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
