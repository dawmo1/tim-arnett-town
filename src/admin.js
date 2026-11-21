// ~ console (Source/GTA style drop-down). Everyone gets a few harmless commands; the admin code (checked only by the
// database rules, never stored in this repo) unlocks the rest. main.js passes its internals in initAdmin(ctx).
import * as W from './world.js';
import { TYPES } from './vehicles.js';
import { sky, DAY_SECONDS } from './daynight.js';
import * as ui from './ui.js';
import { net, sendEvent, isAdmin, tryAdminCode, adminLogout, clearChat } from './net.js';

// cheat state main.js reads every frame
export const adm = { god: false, fly: false, speed: 1, jump: 1, gravity: 1, slowmo: 1, neverWanted: false, frozen: false, spectate: null, clockOff: 0, clockFrozen: null };
let C = null; // ctx from main.js
const el = document.createElement('div');
el.id = 'console'; el.hidden = true;
el.innerHTML = '<div class="conHead">Console <small>help · Tab completes · ↑↓ history · Esc closes</small></div><ol class="conOut" aria-live="polite"></ol><input class="conIn" autocomplete="off" spellcheck="false" maxlength="200" aria-label="Console command">';
document.body.append(el);
const out = el.querySelector('.conOut'), inp = el.querySelector('.conIn');
const hist = []; let hi = 0;
export const isOpen = () => !el.hidden;
function print(t, cls = '') {
  const li = document.createElement('li'); li.textContent = t; if (cls) li.className = cls;
  out.append(li); while (out.children.length > 300) out.firstChild.remove();
  out.scrollTop = out.scrollHeight;
}
const err = (t) => print(t, 'err'), ok = (t) => print(t, 'ok');
export function openConsole() {
  el.hidden = false;
  if (!out.children.length) print('Tim Arnett Town console. Type help.');
  setTimeout(() => inp.focus(), 0);
}
export function closeConsole() { el.hidden = true; inp.blur(); C?.closed(); }
// focus can be lost while the pointer lock is being released: any key while open goes back to the input
addEventListener('keydown', () => { if (!el.hidden && document.activeElement !== inp) inp.focus(); }, true);

// ---------- lookups ----------
const playersList = () => Object.entries(net.players).filter(([, p]) => p).map(([uid, p]) => ({ uid, name: uid === net.uid ? C.me.name : String(p.n || '?').slice(0, 16), p }));
// case-insensitive name prefix; ambiguous or none prints why and returns null
function findPlayer(q, quiet = false) {
  if (!q) { if (!quiet) err('Which player?'); return null; }
  const l = q.toLowerCase(), all = playersList();
  const exact = all.filter((x) => x.name.toLowerCase() === l), hit = exact.length ? exact : all.filter((x) => x.name.toLowerCase().startsWith(l));
  if (hit.length === 1) return hit[0];
  if (!quiet) { if (!hit.length) err(`No player named "${q}"`); else err(`"${q}" matches: ${hit.map((x) => x.name).join(', ')}`); }
  return null;
}
const posOf = (x) => (x.uid === net.uid ? { x: C.me.x, z: C.me.z } : Array.isArray(x.p.s) ? { x: x.p.s[0], z: x.p.s[2] } : null);
let placeCache = null;
function places() {
  if (placeCache && placeCache.length) return placeCache;
  const I = W.D.index || {}, P = [];
  for (const t of I.towns || []) P.push({ name: t.name, x: t.x, z: t.z });
  for (const h of I.hoods || []) P.push({ name: h.name, x: h.x, z: h.z });
  for (const h of W.places.hospitals || []) P.push({ name: h.name, x: h.x, z: h.z });
  for (const s of C.police.stations()) P.push({ name: s.name, x: s.x, z: s.z });
  for (const p of I.poi || []) if (p.name) P.push({ name: p.name, x: p.x, z: p.z });
  return (placeCache = P);
}
function findPlace(q) {
  const l = q.toLowerCase(), P = places();
  return P.find((p) => p.name.toLowerCase() === l) || P.find((p) => p.name.toLowerCase().startsWith(l)) || P.find((p) => p.name.toLowerCase().includes(l));
}
const num = (s) => (s !== undefined && s !== '' && Number.isFinite(+s) ? +s : null);
const toggle = (k, label) => { adm[k] = !adm[k]; ok(`${label} ${adm[k] ? 'ON' : 'OFF'}`); };
const playing = () => { if (!C.playing()) { err('Start playing first.'); return false; } return true; };
const myCar = () => { const v = C.me.veh; if (!v || C.me.seat) { err("You're not driving anything."); return null; } return v; };
const dist = (a, b) => Math.round(Math.hypot(a.x - b.x, a.z - b.z));
function tpPlayer(t) { const q = posOf(t); if (!q) return err(`${t.name} is in the menu.`); C.teleport(q.x + 2, q.z + 2, true); ok(`Teleported to ${t.name}`); }

// ---------- commands ----------
// a: admin only. run(args, line) -> nothing; print what happened.
const CMDS = {
  help: { help: 'List commands', run() {
    for (const [n, c] of Object.entries(CMDS)) if (!c.a || isAdmin()) print(`${n}${c.use ? ' ' + c.use : ''}  ·  ${c.help}`);
    if (!isAdmin()) print('More commands unlock with an admin code.', 'dim');
  } },
  clear: { help: 'Clear the console', run() { out.innerHTML = ''; } },
  fps: { help: 'Frames per second (1 s sample)', run() {
    let n = 0; const t0 = performance.now();
    const f = (t) => { n++; if (t - t0 < 1000) requestAnimationFrame(f); else print(`${Math.round((n * 1000) / (t - t0))} fps`); };
    requestAnimationFrame(f);
  } },
  pos: { help: 'Where you are', run() { const m = C.me, [a, st] = W.areaAt(m.x, m.z); print(`x ${m.x.toFixed(1)}  y ${m.y.toFixed(1)}  z ${m.z.toFixed(1)}  heading ${m.h.toFixed(2)}  ·  ${a}${st ? ', ' + st : ''}`); } },
  login: { use: '<code>', help: 'Enter the admin code (typing just the code works too)', run(a, line) { tryCode(line.replace(/^\s*login\s+/i, '')); } },
  logout: { a: 1, help: 'Give up admin on this browser', async run() { try { await adminLogout(); Object.assign(adm, { god: false, fly: false, speed: 1, jump: 1, gravity: 1, slowmo: 1, neverWanted: false, spectate: null }); ok('Admin access removed'); } catch (e) { err('Logout failed: ' + (e.code || e.message)); } } },
  // ----- self -----
  god: { a: 1, help: 'Toggle invincibility', run() { toggle('god', 'God mode'); } },
  heal: { a: 1, use: '[player]', help: 'Full health (you, or a player)', run([p]) { if (p) return remote('heal', p); C.me.hp = 100; ok('Healed'); } },
  armor: { a: 1, help: 'Full armor', run() { C.me.armor = 100; ok('Armor 100'); } },
  money: { a: 1, use: '<n|+n|-n>', help: 'Set or add cash', run([s]) {
    const n = num(s); if (n === null) return err('money <n|+n|-n>');
    C.eco.cash = Math.round(Math.max(0, Math.min(1e9, /^[+-]/.test(s) ? C.eco.cash + n : n))); ok(`Cash $${C.eco.cash.toLocaleString('en-US')}`);
  } },
  weapons: { a: 1, help: 'Every weapon with max ammo', run() { fillAmmo(); ok('All weapons, max ammo'); } },
  ammo: { a: 1, help: 'Max ammo', run() { fillAmmo(); ok('Max ammo'); } },
  wanted: { a: 1, use: '<0-5>', help: 'Set your wanted level', run([s]) {
    const n = num(s); if (n === null || n < 0 || n > 5) return err('wanted <0-5>');
    if (!n) C.resetWanted(); else Object.assign(C.wanted, { stars: n | 0, search: false, searchT: 0, lk: { x: C.me.x, z: C.me.z } });
    ok(`Wanted level ${n | 0}`);
  } },
  neverwanted: { a: 1, help: 'Toggle never wanted', run() { toggle('neverWanted', 'Never wanted'); if (adm.neverWanted) C.resetWanted(); } },
  noclip: { a: 1, help: 'Toggle fly through walls (WASD, Space up, Shift down, Ctrl fast)', run() { if (C.me.veh) return err('Get out of the vehicle first.'); toggle('fly', 'Noclip'); } },
  speed: { a: 1, use: '<mult>', help: 'On-foot speed multiplier (1 = normal)', run([s]) { const n = num(s); if (n === null || n <= 0) return err('speed <mult>'); adm.speed = Math.min(10, Math.max(0.1, n)); ok(`Speed ×${adm.speed}`); } },
  superjump: { a: 1, help: 'Toggle super jump', run() { adm.jump = adm.jump > 1 ? 1 : 3; ok(`Super jump ${adm.jump > 1 ? 'ON' : 'OFF'}`); } },
  gravity: { a: 1, use: '<x>', help: 'Your gravity (1 = normal)', run([s]) { const n = num(s); if (n === null || n <= 0) return err('gravity <x>'); adm.gravity = Math.min(5, Math.max(0.05, n)); ok(`Gravity ×${adm.gravity}`); } },
  slowmo: { a: 1, use: '<x>', help: 'Game speed on your screen (1 = normal, 0.3 = slow)', run([s]) { const n = num(s); if (n === null || n <= 0) return err('slowmo <x>'); adm.slowmo = Math.min(1, Math.max(0.05, n)); ok(`Game speed ×${adm.slowmo}`); } },
  tp: { a: 1, use: '<x z | waypoint | place | player>', help: 'Teleport', run(a) {
    if (!playing()) return;
    if (!a.length) return err('tp <x z | waypoint | place | player>');
    const x = num(a[0]), z = num(a[1]);
    if (x !== null && z !== null) { C.teleport(x, z, true); return ok(`Teleported to ${x}, ${z}`); }
    const q = a.join(' ');
    if (/^(waypoint|wp)$/i.test(q)) { const w = C.waypoint(); if (!w) return err('No waypoint set (pick one on the map).'); C.teleport(w.x, w.z, false); return ok('Teleported to the waypoint'); }
    const pl = findPlayer(q, true);
    if (pl && pl.uid !== net.uid) return tpPlayer(pl);
    const p = findPlace(q);
    if (p) { C.teleport(p.x, p.z, false); return ok(`Teleported to ${p.name}`); }
    findPlayer(q); // says whether it was ambiguous
  } },
  places: { a: 1, use: '<text>', help: 'Find place names for tp', run(a) {
    const l = a.join(' ').toLowerCase(); if (!l) return err('places <text>');
    const hit = places().filter((p) => p.name.toLowerCase().includes(l)).slice(0, 15);
    print(hit.length ? hit.map((p) => p.name).join(' · ') : 'Nothing matches');
  } },
  car: { a: 1, use: '<type | list>', help: 'Spawn a vehicle in front of you', run(a) {
    const q = a.join(' ').toLowerCase();
    if (!q || q === 'list') return print(TYPES.map((t) => t.name).join(' · '));
    if (!playing()) return;
    const ti = [TYPES.findIndex((t) => t.name.toLowerCase() === q), TYPES.findIndex((t) => t.name.toLowerCase().startsWith(q)), TYPES.findIndex((t) => t.name.toLowerCase().includes(q))].find((i) => i >= 0);
    if (ti === undefined) return err(`No vehicle "${q}" (car list)`);
    C.spawnCar(ti); ok(`Spawned a ${TYPES[ti].name}`);
  } },
  fix: { a: 1, help: 'Repair your vehicle', run() { const v = myCar(); if (v) { C.repairCar(v); ok('Repaired'); } } },
  boost: { a: 1, help: 'Refill nitro and launch forward', run() { const v = myCar(); if (!v) return; v.nitro = 1; v.vx += Math.sin(v.h) * 15; v.vz += Math.cos(v.h) * 15; ok('Boost!'); } },
  flip: { a: 1, help: 'Put your vehicle back on its wheels', run() { const v = myCar(); if (!v) return; v.fr = v.fp = v.frV = v.fpV = 0; v.y += 0.8; ok('Flipped upright'); } },
  explode: { a: 1, help: 'Blow up the vehicle under your crosshair (or the nearest one)', run() { if (playing()) { const n = C.explodeTarget(); n ? ok(`Boom: ${n}`) : err('No vehicle nearby'); } } },
  time: { a: 1, use: '<hh[:mm] | freeze | auto>', help: 'Set the time of day (only on your screen)', run([s = '']) {
    if (/^freeze$/i.test(s)) return freezeTime();
    if (/^auto$/i.test(s)) { adm.clockOff = 0; adm.clockFrozen = null; return ok('Clock back to the shared time'); }
    const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(s); if (!m || +m[1] > 23 || +(m[2] || 0) > 59) return err('time <hh[:mm] | freeze | auto>');
    const now = adm.clockFrozen ?? net.now() + adm.clockOff, cur = ((now / 1000 / DAY_SECONDS + 0.33) % 1 + 1) % 1, want = (+m[1] + (+m[2] || 0) / 60) / 24;
    const shift = (((want - cur) % 1) + 1) % 1 * DAY_SECONDS * 1000;
    if (adm.clockFrozen !== null) adm.clockFrozen += shift; else adm.clockOff += shift;
    ok(`Time ${m[1].padStart(2, '0')}:${(m[2] || '00')}`);
  } },
  weather: { a: 1, use: '<clear|cloudy|rain|storm|fog|snow|auto>', help: 'Set the weather (only on your screen)', run([s = '']) {
    const w = s.toLowerCase(); if (w === 'auto') { sky.force = null; return ok('Weather back to the shared forecast'); }
    if (!['clear', 'cloudy', 'rain', 'storm', 'fog', 'snow'].includes(w)) return err('weather <clear|cloudy|rain|storm|fog|snow|auto>');
    sky.force = w; ok(`Weather: ${w} (it eases in)`);
  } },
  killpeds: { a: 1, use: '[radius]', help: 'Knock out pedestrians near you (default 60 m)', run([s]) { ok(`${C.killPeds(num(s) || 60)} down`); } },
  clearcops: { a: 1, help: 'Remove the police and clear your stars', run() { C.clearCops(); ok('Cops cleared'); } },
  cleartraffic: { a: 1, use: '[radius]', help: 'Remove traffic near you (default 150 m)', run([s]) { ok(`${C.clearTraffic(num(s) || 150)} cars removed`); } },
  // ----- online moderation (receivers check net.admins[from]) -----
  players: { a: 1, help: 'Who is online', run() {
    for (const x of playersList()) {
      const q = posOf(x), me = { x: C.me.x, z: C.me.z };
      print(`${x.name}${net.admins[x.uid] ? ' [ADMIN]' : ''}  ·  ${x.uid.slice(0, 6)}  ·  ${String(x.p.a || (q ? '' : 'in the menu')).slice(0, 40)}${q && x.uid !== net.uid ? `  ·  ${dist(q, me)} m` : x.uid === net.uid ? '  ·  you' : ''}`);
    }
  } },
  goto: { a: 1, use: '<player>', help: 'Teleport to a player', run(a) { const t = playing() && findPlayer(a.join(' ')); if (t) t.uid === net.uid ? err("That's you.") : tpPlayer(t); } },
  bring: { a: 1, use: '<player>', help: 'Teleport a player to you', run(a) { if (playing()) remote('bring', a.join(' '), { x: Math.round(C.me.x * 10) / 10, z: Math.round(C.me.z * 10) / 10 }); } },
  kick: { a: 1, use: '<player> [reason]', help: 'Send a player to the menu (2 min block)', run([p, ...r]) { remote('kick', p, { reason: r.join(' ').slice(0, 80) }); } },
  kill: { a: 1, use: '[player]', help: 'Kill a player (or yourself)', run([p]) { if (p) return remote('kill', p); if (playing()) C.killMe(); } },
  freeze: { a: 1, use: '<player | time>', help: 'Toggle freezing a player in place (or the clock)', run([p]) {
    if (/^time$/i.test(p || '')) return freezeTime();
    const t = findPlayer(p); if (!t) return;
    frozen[t.uid] = !frozen[t.uid]; send('freeze', t, { on: frozen[t.uid] }); ok(`${t.name} ${frozen[t.uid] ? 'frozen' : 'unfrozen'}`);
  } },
  unfreeze: { a: 1, use: '<player>', help: 'Unfreeze a player', run([p]) { const t = findPlayer(p); if (t) { frozen[t.uid] = false; send('freeze', t, { on: false }); ok(`${t.name} unfrozen`); } } },
  give: { a: 1, use: 'money <player> <n>', help: 'Give a player cash', run([what, p, s]) {
    const n = num(s); if (!/^money$/i.test(what || '') || n === null || n <= 0) return err('give money <player> <n>');
    remote('money', p, { n: Math.min(1e6, Math.round(n)) });
  } },
  announce: { a: 1, use: '<message>', help: 'Big banner for everyone', run(a, line) {
    const msg = line.replace(/^\s*announce\s+/i, '').trim().slice(0, 100); if (!msg || /^announce$/i.test(msg)) return err('announce <message>');
    sendEvent('adm', { op: 'announce', msg }); showAnnounce(msg); ok('Announced');
  } },
  clearchat: { a: 1, help: 'Delete every chat message', async run() {
    try { const n = await clearChat(); sendEvent('adm', { op: 'clearchat' }); C.clearChatLog(); ok(`Chat cleared (${n} messages)`); } catch (e) { err('Clear failed: ' + (e.code || e.message)); }
  } },
  spectate: { a: 1, use: '[player]', help: 'Follow a player with the camera (spectate again to stop)', run(a) {
    if (adm.spectate || !a.length) { adm.spectate = null; return ok('Spectate off'); }
    const t = findPlayer(a.join(' ')); if (!t) return;
    if (t.uid === net.uid || !Array.isArray(t.p.s)) return err(`${t.name} isn't playing.`);
    adm.spectate = t.uid; ok(`Spectating ${t.name} (type spectate to stop)`);
  } },
};
CMDS.fly = CMDS.noclip; CMDS.nitro = CMDS.boost; CMDS.teleport = CMDS.tp;
const frozen = {};
function freezeTime() {
  if (adm.clockFrozen === null) { adm.clockFrozen = net.now() + adm.clockOff; ok('Clock frozen'); }
  else { adm.clockOff = adm.clockFrozen - net.now(); adm.clockFrozen = null; ok('Clock running'); }
}
function fillAmmo() {
  C.WEAPONS.forEach((w, i) => { if (!w.melee) C.me.ammo[i] = { mag: w.mag || 1, res: 9999 }; C.me.owned.add(i); });
  C.refreshWeaponHud();
}
function send(op, t, data = {}) { sendEvent('adm', { op, to: t.uid, ...data }); }
function remote(op, q, data) {
  const t = findPlayer(q); if (!t) return;
  if (t.uid === net.uid) { onAdminEvent({ op, to: net.uid, ...data }, true); return; }
  if (!net.online) return err('Offline: no other players.');
  send(op, t, data); ok(`${op} → ${t.name}`);
}

// ---------- the admin code ----------
const tries = [];
async function tryCode(code) {
  code = code.trim();
  const now = Date.now(); while (tries.length && now - tries[0] > 60000) tries.shift();
  if (!code || code.length > 64) return err('Unknown command. Type help.');
  if (tries.length >= 5) return err(`Too many tries. Wait ${Math.ceil((60000 - (now - tries[0])) / 1000)} s.`);
  tries.push(now);
  try {
    if (await tryAdminCode(code)) { ok('Admin access granted. Type help.'); fx(); }
    else err('Unknown command. Type help.');
  } catch (e) { err('Unknown command. Type help.'); console.warn('admin check failed', e); }
}
const fx = () => ui.announce('ADMIN', 'Access granted', '#ffc94a');

function run(line) {
  const t = line.trim(); if (!t) return;
  print('> ' + t, 'cmd');
  if (hist[hist.length - 1] !== t) hist.push(t); hi = hist.length;
  const [name, ...args] = t.split(/\s+/), c = CMDS[name.toLowerCase()];
  if (c && (!c.a || isAdmin())) {
    try { const r = c.run(args, t); if (r && r.catch) r.catch((e) => err(String(e.message || e))); } catch (e) { err('Error: ' + e.message); console.error(e); }
  } else if (isAdmin()) err('Unknown command. Type help.');
  else tryCode(t); // not a command: maybe it's the code
}
function complete() {
  const v = inp.value; if (/\s/.test(v.trimStart())) return;
  const l = v.trim().toLowerCase(), names = Object.keys(CMDS).filter((n) => (!CMDS[n].a || isAdmin()) && n.startsWith(l));
  if (names.length === 1) { inp.value = names[0] + ' '; return; }
  if (!names.length) return;
  let p = names[0]; for (const n of names) while (!n.startsWith(p)) p = p.slice(0, -1);
  inp.value = p; print(names.join('  '), 'dim');
}
inp.addEventListener('keydown', (e) => {
  e.stopPropagation(); // the game's key handlers never see console typing
  if (e.code === 'Backquote' || e.key === 'Escape') { e.preventDefault(); closeConsole(); }
  else if (e.key === 'Enter') { run(inp.value); inp.value = ''; }
  else if (e.key === 'Tab') { e.preventDefault(); complete(); }
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault(); if (!hist.length) return;
    hi = Math.max(0, Math.min(hist.length, hi + (e.key === 'ArrowUp' ? -1 : 1))); inp.value = hist[hi] || '';
  }
});
inp.addEventListener('keyup', (e) => e.stopPropagation());

// ---------- events from admins (main.js only calls this when net.admins[e.from] is true) ----------
function showAnnounce(msg) { msg.length <= 24 ? ui.announce(msg, 'Announcement', '#ffc94a') : ui.announce('ANNOUNCEMENT', msg, '#ffc94a'); ui.addFeed('Announcement: ' + msg); }
export function onAdminEvent(e, local = false) {
  if (e.op === 'announce') return showAnnounce(String(e.msg || '').slice(0, 100));
  if (e.op === 'clearchat') return C.clearChatLog();
  if (e.to !== net.uid) return;
  const by = local ? 'You' : 'An admin';
  switch (e.op) {
    case 'heal': C.me.hp = 100; ui.addFeed(`${by} healed you`); break;
    case 'kill': if (C.playing() && !C.me.dead) C.killMe(); break;
    case 'freeze': adm.frozen = !!e.on; ui.announce(adm.frozen ? 'FROZEN' : 'UNFROZEN', adm.frozen ? 'An admin froze you' : '', '#7fd3ff'); break;
    case 'money': { const n = Math.max(0, Math.min(1e6, Math.round(+e.n || 0))); C.eco.cash = Math.min(1e9, C.eco.cash + n); ui.addFeed(`${by} gave you $${n.toLocaleString('en-US')}`); break; }
    case 'bring': if (C.playing() && Number.isFinite(+e.x) && Number.isFinite(+e.z)) { C.teleport(+e.x + 2, +e.z + 2, true); ui.addFeed(`${by} brought you to them`); } break;
    case 'kick': if (local) { err("You can't kick yourself."); break; } C.kick(String(e.reason || '').slice(0, 80)); break;
  }
}

export function initAdmin(ctx) { C = ctx; }
