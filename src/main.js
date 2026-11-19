import * as THREE from 'three';
import * as W from './world.js';
import { makeCharacter, animateCharacter, randomLook, nameTag, mat } from './character.js';
import { createAllVehicles, stepVehicle, collideVehicles, pushCharOut, circles, trafficPose, charVehicle, makeVehicleMesh } from './vehicles.js';
import { initWalkers, updateWalkers, walkers, panicNear, spawnFleeing } from './npc.js';
import * as police from './police.js';
import * as fx from './fx.js';
import * as ui from './ui.js';
import { net, connect, joinRoom, sendState, setVehicle, removeVehicle, setCops, sendEvent, sendChat, hostUid } from './net.js';
import { clamp, angDiff, rayOBB, raySphere } from './util.js';

const WEAPONS = [
  { name: 'Fists', melee: true, dmg: 12, range: 1.8, rate: 2.5, kind: 'none' },
  { name: 'Bat', melee: true, dmg: 30, range: 2.4, rate: 1.6, kind: 'bat' },
  { name: 'Pistol', dmg: 22, rate: 3.5, spread: 0.012, range: 120, kind: 'gun', snd: 'pistol' },
  { name: 'SMG', dmg: 9, rate: 12, spread: 0.04, range: 90, kind: 'gun', auto: true, snd: 'smg' },
  { name: 'Shotgun', dmg: 11, pellets: 8, rate: 1.1, spread: 0.09, range: 40, kind: 'gun', snd: 'shotgun' },
  { name: 'Rifle', dmg: 34, rate: 5, spread: 0.006, range: 200, kind: 'gun', auto: true, snd: 'rifle' },
  { name: 'Grenade', grenade: true, rate: 0.8, kind: 'none' },
];
const r1 = (n) => Math.round(n * 10) / 10, r2 = (n) => Math.round(n * 100) / 100;

// ---------- renderer & scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fdcf5);
scene.fog = new THREE.Fog(0x9fdcf5, 130, 340);
const camera = new THREE.PerspectiveCamera(70, 1, 0.3, 360);
scene.add(new THREE.HemisphereLight(0xffffff, 0x99bb99, 2.3));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.6);
sun.position.set(80, 140, 40);
scene.add(sun);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
resize();

W.buildWorld(scene);
fx.initFx(scene);
initWalkers(scene);
const vehicles = createAllVehicles(scene);
const vehById = new Map(vehicles.map((v) => [v.id, v]));
const remotes = new Map();
const grenades = [];

const me = {
  name: '', look: null, ch: null, x: 0, y: 0, z: 0, h: 0, vy: 0, vx: 0, vz: 0, hp: 100, dead: false, deadT: 0,
  stars: 0, unseen: 0, weapon: 2, cd: 0, swing: 0, veh: null, swim: false, grounded: true, moveSpeed: 0,
  shotSeq: 0, shot: [0, 0, 0], hitCd: 0, lastBy: '', lastByUid: '',
};
let playing = false, isHost = true, shake = 0;

// ---------- input ----------
const keys = new Set();
let mouseDown = false, clicked = false, locked = false, typing = false;
let camYaw = 0, camPitch = 0.22, lastMouse = 0;
addEventListener('keydown', (e) => {
  if (typing) {
    if (e.key === 'Enter') { const m = ui.el.chatInput.value.trim(); if (m) sendChat(me.name, m.slice(0, 120)); closeChat(); }
    else if (e.key === 'Escape') closeChat();
    return;
  }
  if (!playing) return;
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyT') { e.preventDefault(); openChat(); }
  if (e.code === 'KeyH') ui.el.help.hidden = !ui.el.help.hidden;
  if (e.code === 'KeyE') toggleVehicle();
  if (/^Digit[1-7]$/.test(e.code)) selectWeapon(+e.code.slice(5) - 1);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouseDown = false; });
canvas.addEventListener('click', () => { if (playing && !typing) { lockMouse(); fx.unlockAudio(); } });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  ui.el.click.hidden = locked || typing;
  if (!locked) mouseDown = false;
});
addEventListener('mousemove', (e) => {
  if (!locked) return;
  camYaw -= e.movementX * 0.0025;
  camPitch = clamp(camPitch + e.movementY * 0.0025, -0.5, 1.2);
  lastMouse = performance.now();
});
addEventListener('mousedown', (e) => { if (locked && e.button === 0) { mouseDown = true; clicked = true; } });
addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
addEventListener('wheel', (e) => { if (locked) selectWeapon((me.weapon + (e.deltaY > 0 ? 1 : -1) + WEAPONS.length) % WEAPONS.length); });
function openChat() {
  typing = true; keys.clear(); mouseDown = false;
  ui.el.chatInput.hidden = false; ui.el.click.hidden = true;
  document.exitPointerLock?.();
  setTimeout(() => ui.el.chatInput.focus(), 0);
}
function closeChat() {
  typing = false; ui.el.chatInput.value = ''; ui.el.chatInput.hidden = true; ui.el.chatInput.blur();
  ui.el.click.hidden = locked;
}
function lockMouse() { try { const p = canvas.requestPointerLock?.(); p?.catch?.(() => {}); } catch { /* not allowed here */ } }
function selectWeapon(i) { me.weapon = i; ui.setWeapon(WEAPONS[i].name, i + 1); }

// ---------- menu ----------
const nameInput = document.getElementById('nameInput');
const roomInput = document.getElementById('roomInput');
const playBtn = document.getElementById('playBtn');
const netStatus = document.getElementById('netStatus');
const cleanCode = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
const randomCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
roomInput.value = cleanCode(decodeURIComponent(location.hash.slice(1))) || randomCode();
const connecting = connect().then((ok) => {
  netStatus.textContent = ok ? 'Multiplayer is on. Friends who enter the same room code join your game.' : net.error;
});
for (const inp of [nameInput, roomInput]) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') playBtn.click(); });
playBtn.addEventListener('click', async () => {
  playBtn.disabled = true; playBtn.textContent = 'Joining…';
  const name = nameInput.value.trim().slice(0, 16) || 'Player' + Math.floor(100 + Math.random() * 900);
  const room = cleanCode(roomInput.value) || randomCode();
  await connecting;
  me.name = name; me.look = randomLook();
  try { await joinRoom(room, name, me.look); }
  catch (e) { console.error(e); netStatus.textContent = "Couldn't join the room: " + (e.code || e.message); playBtn.disabled = false; playBtn.textContent = 'Play'; return; }
  history.replaceState(null, '', '#' + room);
  me.ch = makeCharacter(me.look);
  scene.add(me.ch.g);
  respawn(true);
  ui.el.menu.hidden = true; ui.el.hud.hidden = false;
  playing = true;
  selectWeapon(2);
  fx.unlockAudio();
  lockMouse();
});

// ---------- network handlers ----------
net.handlers.chat = (c) => c && ui.addChat(String(c.n || '?').slice(0, 16), String(c.m || '').slice(0, 120));
net.handlers.cops = (obj) => { if (!isHost) police.applyRemote(obj); };
net.handlers.vehicle = (id, rec) => {
  const v = vehById.get(id);
  if (!v || !rec) return;
  v.touchedAt = net.now();
  if (me.veh === v) {
    if (rec.d && rec.d !== net.uid) { v.driver = rec.d; ejectMe(); v.tgt = { x: rec.x, z: rec.z, h: rec.h, y: rec.y || 0 }; }
    return;
  }
  if (v.localSim && !rec.d) return; // echo of our own sliding writes
  if (v.mode === 'traffic' || v.mode === 'parked') { v.x = rec.x; v.z = rec.z; v.h = rec.h; }
  v.mode = 'free'; v.localSim = false;
  v.tgt = { x: rec.x, z: rec.z, h: rec.h, y: rec.y || 0 };
  v.hp = rec.hp; v.driver = rec.d || ''; v.burnAt = rec.b || 0; v.burnBy = rec.bb || '';
  if (rec.e) v.exploded = true;
};
net.handlers.vehicleGone = (id) => { const v = vehById.get(id); if (v) resetVehicle(v); };
net.handlers.event = (e) => {
  switch (e.type) {
    case 'hit': if (e.to === net.uid) damageMe(+e.dmg || 0, String(e.by || 'someone'), e.from); break;
    case 'npc': { const w = walkers[e.id]; if (w && !w.dead) { w.dead = { x: e.x, z: e.z, h: e.h, t: e.t }; w.hp = 0; fx.bloodPool(e.x, e.z, 1.4); } break; }
    case 'vehHit': if (me.veh && me.veh.id === e.id) damageVehicle(me.veh, +e.dmg || 0); break;
    case 'copHit': if (isHost) police.damageCop(e.id, +e.dmg || 0); break;
    case 'boom': explode(e.x, e.y, e.z, String(e.by || 'an explosion'), e.bu, false); break;
    case 'nade': spawnNade({ x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, t: 2.4, mine: false }); break;
    case 'kill': ui.addFeed(String(e.text || '').slice(0, 80)); if (e.ku === net.uid) addStars(1); break;
    case 'jack': if (e.to === net.uid && me.veh && me.veh.id === e.id) { me.veh.driver = e.from; ejectMe(); ui.addFeed('Someone stole your ride!'); } break;
  }
};

// ---------- helpers ----------
function addStars(n) { me.stars = Math.min(5, me.stars + n); me.unseen = 0; }
function copCrime() { if (me.stars < 2) me.stars = 2; me.unseen = 0; }
function nameOf(uid) { if (uid === net.uid) return me.name; if (uid === 'police') return 'the police'; return net.players[uid]?.n || 'someone'; }
function distCam(x, z) { return Math.hypot(camera.position.x - x, camera.position.z - z); }

function writeVeh(v, force) {
  const n = performance.now();
  if (!force && n - v.lastWrite < 100) return;
  v.lastWrite = n;
  v.touchedAt = net.now();
  setVehicle(v.id, { x: r1(v.x), y: r2(v.y), z: r1(v.z), h: r2(v.h), hp: Math.round(v.hp), d: v.driver || '', b: v.burnAt || 0, bb: v.burnBy || '', e: v.exploded ? 1 : 0 });
}
function resetVehicle(v) {
  if (me.veh === v) return;
  fx.stopFire(v.fire); v.fire = null;
  scene.remove(v.mesh);
  v.mesh = makeVehicleMesh(v.T, v.color);
  scene.add(v.mesh);
  Object.assign(v, { hp: v.T.hp, driver: '', burnAt: 0, burnBy: '', exploded: false, charred: false, sinkT: 0, y: 0, vx: 0, vz: 0, tgt: null, localSim: false, mode: v.loop ? 'traffic' : 'parked', x: v.home.x, z: v.home.z, h: v.home.h });
}
function freeTraffic(v) {
  if (v.mode !== 'traffic') return;
  v.mode = 'free'; v.driver = ''; v.localSim = true;
  spawnFleeing(v.x + Math.cos(v.h) * 1.6, v.z - Math.sin(v.h) * 1.6, v.h + Math.PI / 2);
  writeVeh(v, true);
}
function damageVehicle(v, dmg) {
  if (v.exploded || dmg <= 0) return;
  if (v.driver && v.driver !== net.uid) { sendEvent('vehHit', { id: v.id, dmg: r1(dmg) }); return; }
  if (v.mode === 'traffic') freeTraffic(v);
  v.mode = 'free';
  v.hp -= dmg;
  if (v.hp <= 0 && !v.burnAt) { v.hp = 0; v.burnAt = net.now(); v.burnBy = net.uid; }
  writeVeh(v, true);
}
function damageCopUnit(u, dmg) {
  if (isHost) police.damageCop(u.id, dmg); else sendEvent('copHit', { id: u.id, dmg: r1(dmg) });
  copCrime();
}
function explodeVehicle(v) {
  v.exploded = true; v.hp = 0;
  writeVeh(v, true);
  boom(v.x, 0.5, v.z, nameOf(v.burnBy), v.burnBy || '');
}
function boom(x, y, z, by, bu) {
  explode(x, y, z, by, bu, true);
  sendEvent('boom', { x: r1(x), y: r1(y), z: r1(z), by, bu });
}
function explode(x, y, z, by, bu, origin) {
  fx.explosion(x, y, z);
  const dc = distCam(x, z);
  fx.soundBoom(dc);
  shake = Math.max(shake, 1.2 * (1 - dc / 60));
  const R = 7.5;
  const dm = Math.hypot(me.x - x, me.z - z);
  if (!me.dead && dm < R) damageMe(140 * (1 - dm / R), by, bu);
  if (me.veh) { const dv = Math.hypot(me.veh.x - x, me.veh.z - z); if (dv < R) damageVehicle(me.veh, 150 * (1 - dv / R)); }
  panicNear(x, z, 40);
  if (origin) {
    for (const w of walkers) { if (w.dead) continue; const d = Math.hypot(w.x - x, w.z - z); if (d < R) hurtWalker(w, 200, (w.x - x) / (d || 1), (w.z - z) / (d || 1)); }
    for (const v of vehicles) {
      if (v === me.veh || v.exploded || (v.driver && v.driver !== net.uid)) continue;
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < R) damageVehicle(v, 150 * (1 - d / R));
    }
    if ([...police.cops.values()].some((u) => Math.hypot(u.v.x - x, u.v.z - z) < R)) copCrime();
  }
  if (isHost) for (const u of police.cops.values()) { const d = Math.hypot(u.v.x - x, u.v.z - z); if (d < R) police.damageCop(u.id, 150 * (1 - d / R)); }
}
function hurtWalker(w, dmg, dx, dz, p) {
  if (w.dead) return;
  w.hp -= dmg;
  const hp = p || { x: w.x, y: 1.2, z: w.z };
  fx.blood(hp.x, hp.y, hp.z, dx, dz, 10);
  w.panic = 6;
  if (w.hp <= 0) {
    w.dead = { x: r1(w.x), z: r1(w.z), h: r2(w.h), t: net.now() };
    fx.bloodPool(w.x, w.z, 1.4);
    sendEvent('npc', { id: w.id, ...w.dead });
    addStars(1);
  }
}
function damageMe(dmg, by, bu) {
  if (me.dead || dmg <= 0) return;
  me.hp -= dmg; me.lastBy = by; me.lastByUid = bu || '';
  ui.flashHurt();
  fx.blood(me.x, me.y + 1.2, me.z, 0, 0, 6);
  if (me.hp <= 0) die();
}
function die() {
  me.hp = 0; me.dead = true; me.deadT = 5;
  if (me.veh) ejectMe();
  fx.bloodPool(me.x, me.z, 1.6);
  const text = !me.lastBy || me.lastByUid === net.uid ? `${me.name} died` : `${me.lastBy} killed ${me.name}`;
  ui.addFeed(text);
  sendEvent('kill', { text, ku: me.lastByUid });
  ui.el.dead.hidden = false;
}
function respawn(first) {
  const sp = first ? W.places.spawns[Math.floor(Math.random() * W.places.spawns.length)] : W.places.spawn;
  me.x = sp.x + (Math.random() - 0.5) * 3; me.z = sp.z + (Math.random() - 0.5) * 3; me.h = sp.h; me.y = 0; me.vy = 0;
  me.hp = 100; me.dead = false; me.stars = 0; me.unseen = 0; me.swim = false;
  camYaw = sp.h;
  ui.el.dead.hidden = true;
  me.ch.g.rotation.set(0, me.h, 0);
}

// ---------- vehicles: enter / exit ----------
function nearestVehicle() {
  let best = null, bd = Infinity;
  for (const v of vehicles) {
    if (v.exploded || v.hp <= 0 || v.sinkT > 0) continue;
    const d = Math.hypot(v.x - me.x, v.z - me.z);
    if (d < v.T.len / 2 + 1.6 && d < bd) { bd = d; best = v; }
  }
  return best;
}
function toggleVehicle() {
  if (me.dead) return;
  if (me.veh) { ejectMe(); return; }
  const v = nearestVehicle();
  if (!v) return;
  if (v.mode === 'traffic') { freeTraffic(v); addStars(1); }
  else if (v.driver && v.driver !== net.uid) sendEvent('jack', { to: v.driver, id: v.id });
  me.veh = v; v.driver = net.uid; v.mode = 'free'; v.localSim = false; v.tgt = null;
  writeVeh(v, true);
}
function ejectMe() {
  const v = me.veh;
  if (!v) return;
  me.veh = null;
  const lx = Math.cos(v.h), lz = -Math.sin(v.h), off = v.T.wid / 2 + 0.7;
  const p = W.pushOutCircle(v.x + lx * off, v.z + lz * off, 0.4);
  me.x = p.x; me.z = p.z; me.y = Math.max(0, v.y); me.vy = 0; me.h = v.h;
  me.ch.g.rotation.set(0, me.h, 0);
  if (v.driver === net.uid) {
    v.driver = '';
    v.localSim = Math.hypot(v.vx, v.vz) > 0.5;
    writeVeh(v, true);
  }
}

// ---------- combat ----------
const tmpDir = new THREE.Vector3();
function aimRay() {
  camera.getWorldDirection(tmpDir);
  const c = camera.position;
  const t = Math.max(0, (me.x - c.x) * tmpDir.x + (me.y + 1.3 - c.y) * tmpDir.y + (me.z - c.z) * tmpDir.z);
  return { o: { x: c.x + tmpDir.x * t, y: c.y + tmpDir.y * t, z: c.z + tmpDir.z * t }, d: { x: tmpDir.x, y: tmpDir.y, z: tmpDir.z } };
}
function spread(d, s) {
  if (!s) return d;
  const x = d.x + (Math.random() - 0.5) * 2 * s, y = d.y + (Math.random() - 0.5) * 2 * s, z = d.z + (Math.random() - 0.5) * 2 * s;
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
}
function vehRay(o, d, v) {
  const T = v.T, hy = (0.3 + T.hgt) / 2;
  return rayOBB(o.x, o.y, o.z, d.x, d.y, d.z, v.x, v.y + hy, v.z, Math.cos(v.h), -Math.sin(v.h), T.wid / 2, hy, Math.sin(v.h), Math.cos(v.h), T.len / 2);
}
function raycast(o, d, maxT) {
  let best = { t: W.rayBuildings(o.x, o.y, o.z, d.x, d.y, d.z, maxT), kind: 'wall' };
  if (d.y < -1e-4) { const t = -o.y / d.y; if (t > 0 && t < best.t) best = { t, kind: 'ground' }; }
  const test = (t, kind, ref, head) => { if (t < best.t) best = { t, kind, ref, head }; };
  const near = (x, z) => Math.abs(x - o.x) < maxT && Math.abs(z - o.z) < maxT;
  for (const w of walkers) {
    if (w.dead || !near(w.x, w.z)) continue;
    test(raySphere(o.x, o.y, o.z, d.x, d.y, d.z, w.x, 1.05, w.z, 0.48), 'walker', w, false);
    test(raySphere(o.x, o.y, o.z, d.x, d.y, d.z, w.x, 1.72, w.z, 0.26), 'walker', w, true);
  }
  for (const r of remotes.values()) {
    if (r.dead || (r.vehObj && !r.vehObj.T.bike) || !near(r.x, r.z)) continue;
    test(raySphere(o.x, o.y, o.z, d.x, d.y, d.z, r.x, r.y + 1.05, r.z, 0.48), 'player', r, false);
    test(raySphere(o.x, o.y, o.z, d.x, d.y, d.z, r.x, r.y + 1.72, r.z, 0.26), 'player', r, true);
  }
  for (const v of vehicles) if (v !== me.veh && !v.exploded && near(v.x, v.z)) test(vehRay(o, d, v), 'veh', v);
  for (const u of police.cops.values()) if (!u.v.exploded && near(u.v.x, u.v.z)) test(vehRay(o, d, u.v), 'cop', u);
  best.p = { x: o.x + d.x * best.t, y: o.y + d.y * best.t, z: o.z + d.z * best.t };
  return best;
}
function applyHit(hit, w, d) {
  if (hit.kind === 'walker') hurtWalker(hit.ref, w.dmg * (hit.head ? 2.5 : 1), d.x, d.z, hit.p);
  else if (hit.kind === 'player') {
    sendEvent('hit', { to: hit.ref.uid, dmg: r1(w.dmg * (hit.head ? 2 : 1)), by: me.name });
    fx.blood(hit.p.x, hit.p.y, hit.p.z, d.x, d.z); fx.soundHit();
  } else if (hit.kind === 'veh') damageVehicle(hit.ref, w.dmg * 0.6);
  else if (hit.kind === 'cop') damageCopUnit(hit.ref, w.dmg * 0.6);
}
function handPos() {
  if (me.veh) return { x: me.veh.x, y: me.veh.y + 1.4, z: me.veh.z };
  return { x: me.x + Math.sin(me.h) * 0.6 - Math.cos(me.h) * 0.35, y: me.y + 1.35, z: me.z + Math.cos(me.h) * 0.6 + Math.sin(me.h) * 0.35 };
}
function fire(w) {
  me.cd = 1 / w.rate;
  if (w.melee) { me.swing = 1; me.h = camYaw; melee(w); return; }
  if (w.grenade) { throwGrenade(); return; }
  if (!me.veh) me.h = camYaw;
  const { o, d } = aimRay();
  const from = handPos();
  let last = null;
  for (let i = 0; i < (w.pellets || 1); i++) {
    const dd = spread(d, w.spread);
    const hit = raycast(o, dd, w.range);
    applyHit(hit, w, dd);
    if (i < 3) fx.tracer(from, hit.p);
    last = hit.p;
  }
  me.shotSeq++; me.shot = [last.x, last.y, last.z];
  fx.soundShot(w.snd);
  panicNear(me.x, me.z, 30);
}
function melee(w) {
  const fx_ = Math.sin(me.h), fz_ = Math.cos(me.h);
  const inFront = (x, z) => { const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz); return d < w.range && (dx * fx_ + dz * fz_) / (d || 1) > 0.35; };
  for (const wk of walkers) if (!wk.dead && inFront(wk.x, wk.z)) { hurtWalker(wk, w.dmg, fx_, fz_); fx.soundHit(); return; }
  for (const r of remotes.values()) if (!r.dead && !r.veh && inFront(r.x, r.z)) {
    sendEvent('hit', { to: r.uid, dmg: w.dmg, by: me.name }); fx.blood(r.x, r.y + 1.3, r.z, fx_, fz_); fx.soundHit(); return;
  }
}
const nadeGeo = new THREE.SphereGeometry(0.15, 6, 5);
function spawnNade(g) { g.m = new THREE.Mesh(nadeGeo, mat(0x2e7d32)); scene.add(g.m); grenades.push(g); }
function throwGrenade() {
  me.swing = 1;
  camera.getWorldDirection(tmpDir);
  const p = handPos();
  const g = { x: p.x, y: p.y + 0.3, z: p.z, vx: tmpDir.x * 17, vy: tmpDir.y * 17 + 4, vz: tmpDir.z * 17, t: 2.4, mine: true };
  spawnNade(g);
  sendEvent('nade', { x: r1(g.x), y: r1(g.y), z: r1(g.z), vx: r1(g.vx), vy: r1(g.vy), vz: r1(g.vz) });
}
function updateGrenades(dt) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.vy -= 18 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
    const land = W.isLand(g.x, g.z), gy = land ? 0.15 : -0.3;
    if (g.y < gy) {
      g.y = gy;
      if (land) { g.vy = -g.vy * 0.35; g.vx *= 0.6; g.vz *= 0.6; } else { g.vx *= 0.2; g.vz *= 0.2; g.vy = 0; }
    }
    const p = W.pushOutCircle(g.x, g.z, 0.15);
    if (p.hit) { const vn = g.vx * p.nx + g.vz * p.nz; if (vn < 0) { g.vx -= 1.6 * vn * p.nx; g.vz -= 1.6 * vn * p.nz; } g.x = p.x; g.z = p.z; }
    g.m.position.set(g.x, g.y, g.z);
    g.t -= dt;
    if (g.t <= 0) {
      scene.remove(g.m); grenades.splice(i, 1);
      if (g.mine) boom(g.x, Math.max(0, g.y), g.z, me.name, net.uid);
    }
  }
}

// ---------- per-frame updates ----------
function collideAround(v, sliding) {
  let imp = 0;
  for (const o of vehicles) {
    if (o === v || Math.abs(o.x - v.x) > 8 || Math.abs(o.z - v.z) > 8) continue;
    const pushable = o.mode !== 'traffic' && !o.driver;
    const i = collideVehicles(v, o, pushable);
    if (i <= 0) continue;
    imp = Math.max(imp, i);
    if (sliding) continue;
    if (o.mode === 'traffic') { if (i > 5) { freeTraffic(o); damageVehicle(o, (i - 5) * 3); } }
    else if (pushable) { o.localSim = true; o.mode = 'free'; if (i > 7) damageVehicle(o, (i - 7) * 3); else writeVeh(o); }
    else if (o.driver !== net.uid && i > 7) sendEvent('vehHit', { id: o.id, dmg: r1((i - 7) * 3) });
  }
  for (const u of police.cops.values()) {
    if (Math.abs(u.v.x - v.x) > 8 || Math.abs(u.v.z - v.z) > 8) continue;
    const i = collideVehicles(v, u.v, false);
    imp = Math.max(imp, i);
    if (!sliding && i > 7) damageCopUnit(u, (i - 7) * 3);
  }
  return imp;
}

function updateVehicles(dt, tSec, nowMs) {
  for (const v of vehicles) {
    const head = v.mesh.userData.driverHead;
    if (v.mode === 'traffic') {
      const p = trafficPose(v, tSec);
      v.x = p.x; v.z = p.z; v.h = p.h; v.vx = p.vx; v.vz = p.vz; v.speed = Math.hypot(p.vx, p.vz);
      if (head) head.visible = true;
    } else {
      if (head) head.visible = false;
      if (v === me.veh) { /* driven in updatePlayer */ }
      else if (v.localSim) {
        stepVehicle(v, {}, dt);
        collideAround(v, true);
        if (Math.hypot(v.vx, v.vz) < 0.3) { v.localSim = false; v.vx = v.vz = 0; writeVeh(v, true); }
        else writeVeh(v);
      } else if (v.tgt) {
        const k = Math.min(1, dt * 8), ox = v.x, oz = v.z;
        v.x += (v.tgt.x - v.x) * k; v.z += (v.tgt.z - v.z) * k; v.h += angDiff(v.h, v.tgt.h) * k; v.y = v.tgt.y || 0;
        v.vx = (v.x - ox) / dt; v.vz = (v.z - oz) / dt;
      }
    }
    if (v.hp <= 0 && !v.exploded) {
      if (!v.fire) v.fire = fx.startFire(v.mesh);
      if (v.burnAt && nowMs - v.burnAt > 3000 && (v.burnBy === net.uid || (isHost && nowMs - v.burnAt > 7000))) explodeVehicle(v);
    }
    if (v.exploded && !v.charred) { v.charred = true; fx.stopFire(v.fire); v.fire = null; charVehicle(v); }
    v.mesh.position.set(v.x, v.y, v.z);
    v.mesh.rotation.y = v.h;
    v.mesh.userData.body.rotation.z = v.T.bike ? (v.driver ? v.tilt : 0.3) : 0;
  }
}

function updatePlayer(dt) {
  const px = me.x, pz = me.z;
  if (me.dead) {
    me.deadT -= dt;
    animateCharacter(me.ch, dt, { dead: true });
    me.ch.g.visible = true;
    me.ch.g.position.set(me.x, me.y, me.z);
    if (me.deadT <= 0) respawn(false);
    return;
  }
  me.cd -= dt; me.hitCd -= dt;
  if (me.swing > 0) me.swing = Math.max(0, me.swing - dt * 3);
  const fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const side = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  if (me.veh) driveUpdate(dt, fwd, side); else footUpdate(dt, fwd, side);
  if (!me.veh) { me.vx = (me.x - px) / dt; me.vz = (me.z - pz) / dt; }
  const w = WEAPONS[me.weapon];
  const wantFire = locked && (w.auto ? mouseDown : clicked);
  clicked = false;
  if (wantFire && me.cd <= 0 && !me.dead && !me.swim && !(me.veh && w.melee)) fire(w);
}

function footUpdate(dt, fwd, side) {
  const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const speed = me.swim ? 2.6 : sprint ? 8 : 4.5;
  const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
  let mx = Math.sin(camYaw) * fwd + rx * side, mz = Math.cos(camYaw) * fwd + rz * side;
  const ml = Math.hypot(mx, mz);
  if (ml > 0) { mx /= ml; mz /= ml; }
  const wk = WEAPONS[me.weapon].kind;
  const aiming = wk === 'gun' && !me.swim;
  if (ml > 0 || aiming || me.swing > 0) {
    const target = aiming || me.swing > 0 ? camYaw : Math.atan2(mx, mz);
    me.h += angDiff(me.h, target) * Math.min(1, dt * 12);
  }
  me.x += mx * speed * dt; me.z += mz * speed * dt;
  const p = W.pushOutCircle(me.x, me.z, 0.4);
  me.x = p.x; me.z = p.z;
  const pushers = [...vehicles];
  for (const u of police.cops.values()) pushers.push(u.v);
  for (const v of pushers) {
    if (Math.abs(v.x - me.x) > 5 || Math.abs(v.z - me.z) > 5) continue;
    const before = { x: me.x, z: me.z };
    const q = pushCharOut(me.x, me.z, 0.4, v);
    me.x = q.x; me.z = q.z;
    const moved = Math.hypot(q.x - before.x, q.z - before.z) > 1e-4;
    const vs = Math.hypot(v.vx || 0, v.vz || 0);
    if (moved && vs > 6 && me.hitCd <= 0 && (v.mode === 'traffic')) { damageMe(vs * 2.5, 'traffic', ''); me.vy = 5; me.hitCd = 1; }
  }
  // keep players from swimming off forever
  const far = Math.hypot(me.x, me.z);
  if (far > 1500) { me.x *= 1500 / far; me.z *= 1500 / far; }
  const land = W.isLand(me.x, me.z);
  me.vy -= 20 * dt;
  me.y += me.vy * dt;
  if (land) {
    me.swim = false;
    if (me.y <= 0) { me.y = 0; me.vy = 0; me.grounded = true; } else me.grounded = false;
    if (me.grounded && keys.has('Space')) { me.vy = 6.5; me.grounded = false; }
  } else {
    if (me.y <= -0.95) { me.y = -0.95; me.vy = 0; me.swim = true; }
    me.grounded = false;
  }
  me.moveSpeed = ml > 0 ? speed : 0;
  me.ch.g.visible = true;
  me.ch.g.position.set(me.x, me.y, me.z);
  me.ch.g.rotation.set(0, me.h, 0);
  animateCharacter(me.ch, dt, { speed: me.moveSpeed, aim: aiming, swim: me.swim, swing: me.swing, weapon: me.swim ? 'none' : wk });
}

function driveUpdate(dt, fwd, side) {
  const v = me.veh;
  const imp = stepVehicle(v, { throttle: fwd > 0 ? 1 : 0, brake: fwd < 0 ? 1 : 0, steer: -side, handbrake: keys.has('Space') }, dt);
  const total = Math.max(imp, collideAround(v, false));
  if (total > 7) {
    damageVehicle(v, (total - 7) * 3);
    if (total > 14) damageMe((total - 14) * (v.T.bike ? 4 : 2), 'a crash', '');
    if (me.dead) return;
    if (v.T.bike && total > 13) { ejectMe(); me.vy = 4; return; }
  }
  // run people over
  if (Math.abs(v.speed) > 5) {
    const cs = circles(v);
    const hits = (x, z) => cs.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 0.45);
    for (const w of walkers) if (!w.dead && Math.abs(w.x - v.x) < 5 && Math.abs(w.z - v.z) < 5 && hits(w.x, w.z)) hurtWalker(w, Math.abs(v.speed) * 5, Math.sin(v.h), Math.cos(v.h));
    const now = performance.now();
    for (const r of remotes.values()) {
      if (r.dead || r.veh || (r.hitCd || 0) > now || Math.abs(r.x - v.x) > 5 || Math.abs(r.z - v.z) > 5 || !hits(r.x, r.z)) continue;
      sendEvent('hit', { to: r.uid, dmg: r1(Math.abs(v.speed) * 3), by: me.name });
      fx.blood(r.x, r.y + 1, r.z, Math.sin(v.h), Math.cos(v.h));
      r.hitCd = now + 1000;
    }
  }
  if (v.sinkT > 2.5 && !v.exploded) {
    v.exploded = true; v.hp = 0; v.burnAt = net.now(); writeVeh(v, true);
    ejectMe(); me.y = -0.95; me.swim = true;
    return;
  }
  me.x = v.x; me.z = v.z; me.y = Math.max(-0.95, v.y); me.h = v.h; me.vx = v.vx; me.vz = v.vz; me.moveSpeed = 0;
  writeVeh(v);
  me.ch.g.visible = v.T.bike;
  if (v.T.bike) {
    me.ch.g.position.set(v.x - Math.sin(v.h) * 0.25, v.y + 0.2, v.z - Math.cos(v.h) * 0.25);
    me.ch.g.rotation.set(0, v.h, 0);
    me.ch.g.rotateZ(v.tilt);
    animateCharacter(me.ch, dt, { sit: true, weapon: WEAPONS[me.weapon].kind === 'gun' ? 'gun' : 'none' });
  }
}

function updateRemotes(dt) {
  for (const [uid, p] of Object.entries(net.players)) {
    if (uid === net.uid || !p || !Array.isArray(p.s)) continue;
    const s = p.s;
    let r = remotes.get(uid);
    if (!r) {
      const ch = makeCharacter(Array.isArray(p.c) ? p.c : randomLook());
      const tag = nameTag(String(p.n || '?').slice(0, 16));
      ch.g.add(tag); scene.add(ch.g);
      r = { uid, name: String(p.n || '?'), ch, tag, x: s[0], y: s[1], z: s[2], h: s[3], seq: s[9], vx: 0, vz: 0 };
      remotes.set(uid, r);
      ui.addFeed(`${r.name} joined`);
    }
    const k = Math.min(1, dt * 10), ox = r.x, oz = r.z;
    r.x += (s[0] - r.x) * k; r.y += (s[1] - r.y) * k; r.z += (s[2] - r.z) * k; r.h += angDiff(r.h, s[3]) * k;
    r.vx = (r.x - ox) / dt; r.vz = (r.z - oz) / dt;
    r.speed = s[4]; r.veh = s[5] || ''; r.hp = s[6]; r.dead = s[6] <= 0; r.stars = s[7] || 0; r.weapon = s[8] || 0;
    if (s[9] !== r.seq) {
      r.seq = s[9];
      fx.tracer({ x: r.x + Math.sin(r.h) * 0.6, y: r.y + 1.35, z: r.z + Math.cos(r.h) * 0.6 }, { x: s[10], y: s[11], z: s[12] });
      fx.soundShot(WEAPONS[r.weapon]?.snd || 'pistol', distCam(r.x, r.z));
      panicNear(r.x, r.z, 30);
    }
    const vo = r.veh ? vehById.get(r.veh) : null;
    r.vehObj = vo;
    const wk = WEAPONS[r.weapon]?.kind || 'none';
    if (vo) {
      r.ch.g.visible = vo.T.bike;
      if (vo.T.bike) { r.ch.g.position.set(vo.x - Math.sin(vo.h) * 0.25, vo.y + 0.2, vo.z - Math.cos(vo.h) * 0.25); r.ch.g.rotation.set(0, vo.h, 0); animateCharacter(r.ch, dt, { sit: true, weapon: wk }); }
    } else {
      r.ch.g.visible = true;
      r.ch.g.position.set(r.x, r.y, r.z); r.ch.g.rotation.set(0, r.h, 0);
      animateCharacter(r.ch, dt, { speed: r.speed, aim: wk === 'gun', swim: r.y < -0.5, dead: r.dead, weapon: r.y < -0.5 ? 'none' : wk });
    }
    r.tag.visible = !r.dead;
  }
  for (const [uid, r] of remotes) if (!net.players[uid]) { scene.remove(r.ch.g); remotes.delete(uid); ui.addFeed(`${r.name} left`); }
}

function updateWanted(dt) {
  if (me.stars <= 0 || me.dead) return;
  let seen = false;
  for (const u of police.cops.values()) {
    if (u.v.exploded || u.v.hp <= 0) continue;
    const d = Math.hypot(u.v.x - me.x, u.v.z - me.z);
    if (d < 35 || (d < 90 && W.lineOfSight(u.v.x, 1.4, u.v.z, me.x, me.y + 1.2, me.z))) { seen = true; break; }
  }
  if (seen) me.unseen = 0; else me.unseen += dt;
  if (me.unseen > 6 + me.stars * 3) { me.stars = 0; me.unseen = 0; ui.addFeed('You lost the cops'); }
}

function updateCamera(dt) {
  const tx = me.veh ? me.veh.x : me.x, tz = me.veh ? me.veh.z : me.z;
  const ty = me.veh ? me.veh.y + 1.7 : me.swim ? -0.3 : me.y + 1.6;
  if (me.veh && performance.now() - lastMouse > 1200 && Math.abs(me.veh.speed) > 3) {
    camYaw += angDiff(camYaw, me.veh.speed > 0 ? me.veh.h : me.veh.h + Math.PI) * Math.min(1, dt * 2.5);
  }
  const dist = me.veh ? 5 + me.veh.T.len : me.dead ? 7 : 4.2;
  const cp = Math.cos(camPitch), dx = Math.sin(camYaw) * cp, dy = -Math.sin(camPitch), dz = Math.cos(camYaw) * cp;
  const sh = me.veh ? 0 : 0.55, ax = tx - Math.cos(camYaw) * sh, az = tz + Math.sin(camYaw) * sh;
  const back = W.rayBuildings(ax, ty, az, -dx, -dy, -dz, dist);
  const d = Math.max(0.8, Math.min(dist, back - 0.3));
  camera.position.set(ax - dx * d, Math.max(0.2, ty - dy * d), az - dz * d);
  camera.lookAt(ax + dx * 20, ty + dy * 20, az + dz * 20);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 2.5);
  }
}

function policePlayers() {
  const arr = [{ uid: net.uid, x: me.x, z: me.z, vx: me.vx, vz: me.vz, stars: me.stars, alive: !me.dead, inVeh: !!me.veh }];
  for (const r of remotes.values()) arr.push({ uid: r.uid, x: r.x, z: r.z, vx: r.vx, vz: r.vz, stars: r.stars, alive: !r.dead, inVeh: !!r.veh });
  return arr;
}
police.initPolice(scene, {
  now: () => net.now(),
  vehicles: () => vehicles,
  damagePlayer: (uid, dmg, by) => { if (uid === net.uid) damageMe(dmg, by, 'police'); else sendEvent('hit', { to: uid, dmg: r1(dmg), by }); },
  explode: (x, y, z, by) => boom(x, y, z, by, 'police'),
  copShot: (v, s) => { fx.tracer({ x: v.x, y: 1.5, z: v.z }, { x: s[0], y: s[1], z: s[2] }); fx.soundShot('pistol', distCam(v.x, v.z)); },
  sync: (obj) => setCops(obj),
});

let cleanT = 5;
function hostChores(dt, nowMs) {
  cleanT -= dt;
  if (cleanT > 0) return;
  cleanT = 5;
  const anyoneNear = (v, r) => Math.hypot(me.x - v.x, me.z - v.z) < r || [...remotes.values()].some((p) => Math.hypot(p.x - v.x, p.z - v.z) < r);
  for (const v of vehicles) {
    if (v === me.veh || v.driver || v.localSim) continue;
    const wrecked = v.exploded && nowMs - (v.burnAt || 0) > 60000;
    const abandoned = v.mode === 'free' && !v.exploded && nowMs - (v.touchedAt || nowMs) > 180000;
    if ((wrecked || abandoned) && !anyoneNear(v, 70)) { removeVehicle(v.id); resetVehicle(v); }
  }
}

let sendT = 0, uiT = 0, mmT = 0;
function updateHud(dt, t) {
  uiT -= dt;
  if (uiT <= 0) {
    uiT = 0.2;
    ui.setHealth(me.hp);
    ui.setStars(me.stars, me.unseen > 1.5);
    const host = hostUid();
    const list = [{ name: me.name, me: true, host: host === net.uid, stars: me.stars }];
    for (const r of remotes.values()) list.push({ name: r.name, host: host === r.uid, stars: r.stars });
    ui.setPlayers(net.room, list, net.online);
  }
  let prompt = '';
  if (!me.dead) {
    if (me.veh) prompt = '';
    else { const v = nearestVehicle(); if (v) prompt = `E: ${v.mode === 'traffic' || v.driver ? 'Steal' : 'Drive'} ${v.T.name}`; }
  }
  ui.setPrompt(prompt);
  mmT -= dt;
  if (mmT <= 0) {
    mmT = 0.1;
    ui.drawMinimap(me, [...remotes.values()].filter((r) => !r.dead), [...police.cops.values()].filter((u) => !u.v.exploded).map((u) => u.v), t);
  }
}

function update(dt, t) {
  const nowMs = net.now(), tSec = nowMs / 1000;
  isHost = hostUid() === net.uid;
  updateVehicles(dt, tSec, nowMs);
  updatePlayer(dt);
  updateRemotes(dt);
  updateWalkers(dt, tSec, nowMs, camera.position);
  if (isHost) { police.hostUpdate(dt, policePlayers()); hostChores(dt, nowMs); }
  police.render(dt, isHost, t);
  updateGrenades(dt);
  updateWanted(dt);
  updateCamera(dt);
  fx.updateFx(dt);
  sendT -= dt;
  if (sendT <= 0) {
    sendT = 0.1;
    sendState([r1(me.x), r2(me.y), r1(me.z), r2(me.h), r1(me.moveSpeed), me.veh ? me.veh.id : '', Math.round(me.hp), me.stars, me.weapon, me.shotSeq, r1(me.shot[0]), r1(me.shot[1]), r1(me.shot[2])]);
  }
  updateHud(dt, t);
}

// Slow orbit around the statue while the menu is open.
function menuCamera(t) {
  const p = W.P(W.places.park.s, W.places.park.d);
  camera.position.set(p.x + Math.cos(t * 0.08) * 45, 22, p.z + Math.sin(t * 0.08) * 45);
  camera.lookAt(p.x, 4, p.z);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (playing) update(dt, now / 1000);
  else {
    const nowMs = net.now();
    updateVehicles(dt, nowMs / 1000, nowMs);
    updateWalkers(dt, nowMs / 1000, nowMs, camera.position);
    menuCamera(now / 1000);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

