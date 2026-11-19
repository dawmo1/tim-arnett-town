import * as THREE from 'three';
import * as W from './world.js';
import { makeCharacter, animateCharacter, randomLook, nameTag, mat } from './character.js';
import { createAllVehicles, stepVehicle, collideVehicles, pushCharOut, circles, trafficPose, charVehicle, makeVehicleMesh, damageZone, applyDamageVisual, applyBump } from './vehicles.js';
import { initWalkers, updateWalkers, walkers, panicNear, spawnFleeing } from './npc.js';
import * as police from './police.js';
import * as fx from './fx.js';
import * as ui from './ui.js';
import { net, connect, joinRoom, sendState, setVehicle, removeVehicle, setCops, sendEvent, sendChat, hostUid } from './net.js';
import { clamp, angDiff, rayOBB, raySphere } from './util.js';
import { wanted, crime, updateWanted as tickWanted, resetWanted, cones, initWanted } from './wanted.js';

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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8def2);
scene.fog = new THREE.Fog(0xa8def2, 140, 345);
{ // gradient sky dome + sun
  const sky = new THREE.Mesh(new THREE.SphereGeometry(350, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x2f8fe0) }, bottom: { value: new THREE.Color(0xa8def2) } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float h; void main(){ gl_FragColor = vec4(mix(bottom, top, clamp(pow(max(h, 0.0), 0.6), 0.0, 1.0)), 1.0); }',
  }));
  sky.renderOrder = -1;
  scene.userData.sky = sky;
  scene.add(sky);
}
const camera = new THREE.PerspectiveCamera(70, 1, 0.3, 360);
scene.add(new THREE.HemisphereLight(0xffffff, 0x99bb99, 2.3));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.6);
sun.position.set(80, 140, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 300 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(60, 120, 30);
function followSun(x, z) {
  scene.userData.sky.position.set(x, 0, z);
  sun.position.set(x + SUN_OFF.x, SUN_OFF.y, z + SUN_OFF.z);
  sun.target.position.set(x, 0, z);
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
resize();

W.buildWorld(scene);
fx.initFx(scene);
initWalkers(scene);
const vehicles = createAllVehicles(scene);
ui.drawMapBase();
ui.buildWheel(WEAPONS, (i) => { selectWeapon(i); closeWheel(false); });
const vehById = new Map(vehicles.map((v) => [v.id, v]));
const remotes = new Map();
const grenades = [];

const me = {
  name: '', look: null, ch: null, x: 0, y: 0, z: 0, h: 0, vy: 0, vx: 0, vz: 0, hp: 100, dead: false, deadT: 0,
  stars: 0, unseen: 0, weapon: 2, cd: 0, swing: 0, veh: null, swim: false, grounded: true, moveSpeed: 0,
  shotSeq: 0, shot: [0, 0, 0], hitCd: 0, lastBy: '', lastByUid: '',
};
let playing = false, isHost = true, shake = 0, lastAttack = -1e9;
let wheelOpen = false, wheelSel = 0, wheelX = 0, wheelY = 0;

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
  if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyT') { e.preventDefault(); openChat(); }
  if (e.code === 'Tab' || e.code === 'KeyQ') { e.preventDefault(); openWheel(); }
  if (e.code === 'KeyH') ui.el.help.hidden = !ui.el.help.hidden;
  if (e.code === 'KeyE') toggleVehicle();
  if (/^Digit[1-7]$/.test(e.code)) selectWeapon(+e.code.slice(5) - 1);
});
addEventListener('keyup', (e) => { keys.delete(e.code); if ((e.code === 'Tab' || e.code === 'KeyQ') && wheelOpen) closeWheel(true); });
addEventListener('blur', () => { keys.clear(); mouseDown = false; });
canvas.addEventListener('click', () => { if (playing && !typing) { lockMouse(); fx.unlockAudio(); } });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  ui.el.click.hidden = locked || typing;
  if (!locked) mouseDown = false;
});
addEventListener('mousemove', (e) => {
  if (!locked) return;
  if (wheelOpen) {
    wheelX = clamp(wheelX + e.movementX, -120, 120); wheelY = clamp(wheelY + e.movementY, -120, 120);
    if (Math.hypot(wheelX, wheelY) > 25) { wheelSel = ui.wheelIndex(wheelX, wheelY, WEAPONS.length); ui.wheelHighlight(wheelSel, WEAPONS[wheelSel]); }
    return;
  }
  camYaw -= e.movementX * 0.0025;
  camPitch = clamp(camPitch + e.movementY * 0.0025, -0.5, 1.2);
  lastMouse = performance.now();
});
addEventListener('mousedown', (e) => { if (locked && e.button === 0 && !wheelOpen) { mouseDown = true; clicked = true; } });
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
function selectWeapon(i) { me.weapon = i; ui.setWeapon(WEAPONS[i].name); }
function openWheel() {
  if (wheelOpen || me.dead) return;
  wheelOpen = true; wheelSel = me.weapon; wheelX = wheelY = 0; mouseDown = false;
  ui.wheelHighlight(wheelSel, WEAPONS[wheelSel]); ui.showWheel(true);
}
function closeWheel(apply) {
  if (!wheelOpen) return;
  wheelOpen = false; ui.showWheel(false);
  if (apply) selectWeapon(wheelSel);
}

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
  if (Array.isArray(rec.dz)) { const [f, b, l, r] = rec.dz; if (f !== Math.round(v.dz.f) || b !== Math.round(v.dz.b) || l !== Math.round(v.dz.l) || r !== Math.round(v.dz.r)) { v.dz = { f, b, l, r }; applyDamageVisual(v); } }
};
net.handlers.vehicleGone = (id) => { const v = vehById.get(id); if (v) resetVehicle(v); };
net.handlers.event = (e) => {
  switch (e.type) {
    case 'hit': if (e.to === net.uid) damageMe(+e.dmg || 0, String(e.by || 'someone'), e.from); break;
    case 'npc': { const w = walkers[e.id]; if (w && !w.dead) { w.dead = { x: e.x, z: e.z, h: e.h, t: e.t }; w.hp = 0; fx.bloodPool(e.x, e.z, 1.4); } break; }
    case 'vehHit': if (me.veh && me.veh.id === e.id) damageVehicle(me.veh, +e.dmg || 0, e.imp ? { cp: [e.px, e.pz], imp: e.imp } : null); break;
    case 'bump': {
      if (me.veh && me.veh.id === e.id) applyBump(me.veh, e);
      else if (isHost) { const u = police.cops.get(e.id); if (u && u.kind < 2) applyBump(u.v, e); }
      break;
    }
    case 'copHit': if (isHost) police.damageCop(e.id, +e.dmg || 0); break;
    case 'boom': explode(e.x, e.y, e.z, String(e.by || 'an explosion'), e.bu, false); break;
    case 'nade': spawnNade({ x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, t: 2.4, mine: false }); break;
    case 'kill': ui.addFeed(String(e.text || '').slice(0, 80)); if (e.ku === net.uid) report('kill'); break;
    case 'jack': if (e.to === net.uid && me.veh && me.veh.id === e.id) { me.veh.driver = e.from; ejectMe(); ui.addFeed('Someone stole your ride!'); } break;
  }
};

// ---------- helpers ----------
function report(type, x = me.x, z = me.z) { lastAttack = performance.now(); crime(type, x, me.y, z); }
initWanted({ announce: (t) => ui.announce(t, '', '#ff5e5b') });
function nameOf(uid) { if (uid === net.uid) return me.name; if (uid === 'police') return 'the police'; return net.players[uid]?.n || 'someone'; }
function distCam(x, z) { return Math.hypot(camera.position.x - x, camera.position.z - z); }

function writeVeh(v, force) {
  const n = performance.now();
  if (!force && n - v.lastWrite < 100) return;
  v.lastWrite = n;
  v.touchedAt = net.now();
  setVehicle(v.id, { x: r1(v.x), y: r2(v.y), z: r1(v.z), h: r2(v.h), hp: Math.round(v.hp), d: v.driver || '', b: v.burnAt || 0, bb: v.burnBy || '', e: v.exploded ? 1 : 0, dz: [v.dz.f, v.dz.b, v.dz.l, v.dz.r].map(Math.round) });
}
function resetVehicle(v) {
  if (me.veh === v) return;
  fx.stopFire(v.fire); v.fire = null;
  scene.remove(v.mesh);
  v.mesh = makeVehicleMesh(v.T, v.color);
  scene.add(v.mesh);
  Object.assign(v, { lag: 0, sf: 1, off: 0, offT: 0, w: 0, dz: { f: 0, b: 0, l: 0, r: 0 }, headFor: '', vy: 0, air: 0, hp: v.T.hp, driver: '', burnAt: 0, burnBy: '', exploded: false, charred: false, sinkT: 0, y: 0, vx: 0, vz: 0, tgt: null, localSim: false, mode: v.loop ? 'traffic' : 'parked', x: v.home.x, z: v.home.z, h: v.home.h });
}
function freeTraffic(v, noFlee) {
  if (v.mode !== 'traffic') return;
  v.mode = 'free'; v.driver = ''; v.localSim = true;
  if (!noFlee) spawnFleeing(v.x + Math.cos(v.h) * 1.6, v.z - Math.sin(v.h) * 1.6, v.h + Math.PI / 2);
  writeVeh(v, true);
}
function damageVehicle(v, dmg, hit) {
  if (v.exploded || dmg <= 0) return;
  if (v.driver && v.driver !== net.uid) { sendEvent('vehHit', { id: v.id, dmg: r1(dmg), px: hit ? r1(hit.cp[0]) : 0, pz: hit ? r1(hit.cp[1]) : 0, imp: hit ? r1(hit.imp) : 0 }); return; }
  if (v.mode === 'traffic') freeTraffic(v);
  v.mode = 'free';
  if (hit) damageZone(v, hit.cp[0], hit.cp[1], hit.imp);
  v.hp = Math.max(-v.T.hp, v.hp - dmg);
  // at 0 the engine dies; it only catches fire if you keep wrecking it
  if (v.hp <= -v.T.hp * 0.4 && !v.burnAt) { v.burnAt = net.now(); v.burnBy = net.uid; }
  writeVeh(v, true);
}
function crashFx(v, hit) {
  const [px, pz] = hit.cp, d = distCam(px, pz);
  if (hit.imp > 4) { fx.sparks(px, v.y + 0.6, pz, Math.min(24, Math.round(hit.imp * 1.2)), hit.nx, hit.nz); fx.soundCrunch(hit.imp / 18, d); }
  else if (hit.imp > 0.6) { fx.sparks(px, v.y + 0.5, pz, 2, hit.nx, hit.nz); fx.soundScrape(d); }
  if (hit.imp > 15) fx.glass(px, v.y + 1, pz, 8);
  if (v === me.veh && hit.imp > 8) shake = Math.max(shake, Math.min(1, hit.imp / 30));
}
// Hand out impulses that couldn't be applied here (other players' cars, host-run cops).
function flushBump(o) {
  const b = o.pending;
  if (!b) return;
  o.pending = null;
  if (o === me.veh) { applyBump(o, b); return; }
  if (o.mode === 'cop') { if (isHost) applyBump(o, b); else sendEvent('bump', { id: o.id, jx: r2(b.jx), jz: r2(b.jz), jw: r2(b.jw) }); return; }
  if (o.driver && o.driver !== net.uid) sendEvent('bump', { id: o.id, jx: r2(b.jx), jz: r2(b.jz), jw: r2(b.jw) });
  else { applyBump(o, b); o.localSim = true; }
}
function damageCopUnit(u, dmg) {
  const hp = u.kind < 2 ? u.v.hp : u.hp;
  let killed;
  if (isHost) killed = police.damageCop(u.id, dmg);
  else { sendEvent('copHit', { id: u.id, dmg: r1(dmg) }); killed = hp > 0 && hp - dmg <= 0; }
  report(killed ? (u.kind === 3 ? 'killheli' : 'killcop') : 'hitcop', u.kind < 2 ? u.v.x : u.x, u.kind < 2 ? u.v.z : u.z);
  if (u.kind === 2) fx.blood(u.x, 1.2, u.z, 0, 0, 8);
  ui.hitMarker(killed);
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
    if ([...police.cops.values()].some((u) => copDist(u, x, y, z) < R)) report('hitcop', x, z);
  }
  if (isHost) for (const u of police.cops.values()) { const d = copDist(u, x, y, z); if (d < R) police.damageCop(u.id, 150 * (1 - d / R)); }
}
function copDist(u, x, y, z) { const P = police.posOf(u); return Math.hypot(P.x - x, (u.kind === 3 ? u.y : 0) - y, P.z - z); }
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
    report('kill', w.x, w.z);
    return true;
  }
  return false;
}
function damageMe(dmg, by, bu) {
  if (me.dead || dmg <= 0) return;
  me.hp -= dmg; me.lastBy = by; me.lastByUid = bu || '';
  ui.flashHurt();
  fx.blood(me.x, me.y + 1.2, me.z, 0, 0, 6);
  if (me.hp <= 0) die();
}
function die() {
  closeWheel(false);
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
  me.hp = 100; me.dead = false; resetWanted(); me.enter = null; me.exitT = 0; me.swim = false; deathSpin = 0; me.rag = null;
  me.ch.body.rotation.set(0, 0, 0); me.ch.body.position.y = 0;
  camYaw = sp.h;
  ui.el.dead.hidden = true;
  me.ch.g.rotation.set(0, me.h, 0);
}

// ---------- vehicles: enter / exit ----------
function nearestVehicle(reach = 1.6) {
  let best = null, bd = Infinity;
  for (const v of vehicles) {
    if (v.exploded || v.hp <= 0 || v.sinkT > 0) continue;
    const d = Math.hypot(v.x - me.x, v.z - me.z);
    if (d < v.T.len / 2 + reach && d < bd) { bd = d; best = v; }
  }
  return best;
}
// Getting in is a short sequence: walk to the door, open it, yank out whoever's driving, climb in.
function toggleVehicle() {
  if (me.dead || me.rag) return;
  if (me.enter) { cancelEnter(); return; }
  if (me.veh) { leaveVehicle(); return; }
  const v = nearestVehicle(4.5);
  if (!v) return;
  if (Math.hypot(v.vx || 0, v.vz || 0) > 3.5) { ui.flashPrompt("It's moving too fast to grab"); return; }
  me.enter = { v, phase: 'walk', t: 0 };
  v.jackHold = true;
}
function cancelEnter() {
  const e = me.enter; if (!e) return;
  e.v.jackHold = false; e.v.doorOpen = 0; me.enter = null;
}
function doorSpot(v) {
  const lx = Math.cos(v.h), lz = -Math.sin(v.h), off = v.T.bike ? 0.7 : v.T.wid / 2 + 0.55;
  return { x: v.x + lx * off + Math.sin(v.h) * 0.25, z: v.z + lz * off + Math.cos(v.h) * 0.25 };
}
function enterUpdate(dt) {
  const e = me.enter, v = e.v;
  e.t += dt;
  if (v.exploded || v.hp <= 0 || v.sinkT > 0 || Math.hypot(v.vx || 0, v.vz || 0) > 5) { cancelEnter(); return; }
  const occupied = v.mode === 'traffic' || (v.driver && v.driver !== net.uid);
  let pose = { speed: 0 };
  if (e.phase === 'walk') {
    const d = doorSpot(v), dx = d.x - me.x, dz = d.z - me.z, dist = Math.hypot(dx, dz);
    if (dist < 0.6 || e.t > 1.8) { e.phase = v.T.bike ? 'in' : 'open'; e.t = 0; }
    else {
      const sp = Math.min(dist / dt, 5.5);
      me.x += (dx / dist) * sp * dt; me.z += (dz / dist) * sp * dt;
      me.h += angDiff(me.h, Math.atan2(dx, dz)) * Math.min(1, dt * 12);
      pose = { speed: 5 };
    }
  } else {
    me.h += angDiff(me.h, v.h - Math.PI / 2) * Math.min(1, dt * 10); // face the car
    if (e.phase === 'open') {
      v.doorOpen = 1;
      pose = { reach: true };
      if (e.t > 0.4) { e.t = 0; e.phase = occupied ? 'yank' : 'in'; if (occupied) yankDriver(v); }
    } else if (e.phase === 'yank') {
      pose = { pull: Math.min(1, e.t / 0.9) };
      if (e.t > 0.9) { e.phase = 'in'; e.t = 0; }
    } else if (e.phase === 'in') {
      const k = Math.min(1, e.t / 0.45);
      me.x += (v.x - me.x) * k * 0.25; me.z += (v.z - me.z) * k * 0.25;
      pose = { sit: k > 0.5 };
      if (e.t > 0.45) { finishEnter(v); return; }
    }
  }
  me.ch.g.visible = true;
  me.ch.g.position.set(me.x, me.y, me.z);
  me.ch.g.rotation.set(0, me.h, 0);
  animateCharacter(me.ch, dt, pose);
}
function yankDriver(v) {
  const d = doorSpot(v);
  if (v.mode === 'traffic') { freeTraffic(v, true); spawnFleeing(d.x, d.z, v.h + Math.PI / 2, 1.2); }
  else if (v.driver && v.driver !== net.uid) { sendEvent('jack', { to: v.driver, id: v.id }); ui.announce('CARJACKED', nameOf(v.driver)); }
  fx.soundHit();
  report('carjack', v.x, v.z);
  ui.announce('CARJACKED');
}
function finishEnter(v) {
  const wasParked = v.mode === 'parked' || (!v.driver && v.mode !== 'traffic');
  me.enter = null;
  v.jackHold = false; v.doorOpen = 0;
  me.veh = v; v.driver = net.uid; v.mode = 'free'; v.localSim = false; v.tgt = null; v.vx = v.vx || 0; v.vz = v.vz || 0;
  me.ch.g.visible = !!v.T.bike;
  writeVeh(v, true);
  if (wasParked && !v.stolenOnce) { v.stolenOnce = true; report('steal', v.x, v.z); }
}
// Getting out: slow = step out through the door, fast = bail and tumble.
function leaveVehicle() {
  const v = me.veh;
  const sp = Math.hypot(v.vx, v.vz);
  if (sp > 9 && !v.T.bike) {
    const lx = Math.cos(v.h), lz = -Math.sin(v.h);
    ejectMe();
    me.rag = { t: 1.8, vx: v.vx * 0.55 + lx * 3, vy: 3, vz: v.vz * 0.55 + lz * 3, spin: 6, landed: false };
    damageMe(Math.min(45, sp * 0.8), 'bailing out', '');
    ui.announce('BAILED OUT');
    return;
  }
  if (v.T.bike || me.exitT > 0) { ejectMe(); return; }
  me.exitT = 0.45;
  v.doorOpen = 1;
}
function ejectMe() {
  const v = me.veh;
  if (!v) return;
  me.veh = null;
  me.exitT = 0;
  v.doorOpen = 1; v.doorCloseAt = performance.now() + 500;
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
  for (const u of police.cops.values()) {
    if (police.isDown(u)) continue;
    if (u.kind < 2) { if (near(u.v.x, u.v.z)) test(vehRay(o, d, u.v), 'cop', u); }
    else if (u.kind === 2) { if (near(u.x, u.z)) { test(raySphere(o.x, o.y, o.z, d.x, d.y, d.z, u.x, 1.05, u.z, 0.48), 'cop', u, false); test(raySphere(o.x, o.y, o.z, d.x, d.y, d.z, u.x, 1.72, u.z, 0.26), 'cop', u, true); } }
    else test(raySphere(o.x, o.y, o.z, d.x, d.y, d.z, u.x, u.y, u.z, 2.8), 'cop', u);
  }
  best.p = { x: o.x + d.x * best.t, y: o.y + d.y * best.t, z: o.z + d.z * best.t };
  return best;
}
function applyHit(hit, w, d) {
  if (hit.kind === 'walker') ui.hitMarker(hurtWalker(hit.ref, w.dmg * (hit.head ? 2.5 : 1), d.x, d.z, hit.p));
  else if (hit.kind === 'player') {
    sendEvent('hit', { to: hit.ref.uid, dmg: r1(w.dmg * (hit.head ? 2 : 1)), by: me.name });
    fx.blood(hit.p.x, hit.p.y, hit.p.z, d.x, d.z); fx.soundHit(); ui.hitMarker(false);
  } else if (hit.kind === 'veh') damageVehicle(hit.ref, w.dmg * 0.45);
  else if (hit.kind === 'cop') damageCopUnit(hit.ref, w.dmg * (hit.ref.kind === 2 ? (hit.head ? 2.5 : 1) : 0.6));
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
  fx.muzzleFlash(from);
  fx.soundShot(w.snd);
  if (performance.now() - lastAttack > 1000) report('gunfire'); else lastAttack = performance.now();
  if (w.name === 'Shotgun' || w.name === 'Rifle') shake = Math.max(shake, 0.12);
  panicNear(me.x, me.z, 30);
}
function melee(w) {
  const fx_ = Math.sin(me.h), fz_ = Math.cos(me.h);
  const inFront = (x, z) => { const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz); return d < w.range && (dx * fx_ + dz * fz_) / (d || 1) > 0.35; };
  lastAttack = performance.now();
  for (const wk of walkers) if (!wk.dead && inFront(wk.x, wk.z)) { const k = hurtWalker(wk, w.dmg, fx_, fz_); if (!k) report('assault', wk.x, wk.z); ui.hitMarker(k); fx.soundHit(); return; }
  for (const u of police.cops.values()) if (u.kind === 2 && !u.dead && inFront(u.x, u.z)) { damageCopUnit(u, w.dmg); fx.soundHit(); return; }
  for (const r of remotes.values()) if (!r.dead && !r.veh && inFront(r.x, r.z)) {
    sendEvent('hit', { to: r.uid, dmg: w.dmg, by: me.name }); report('assault', r.x, r.z); fx.blood(r.x, r.y + 1.3, r.z, fx_, fz_); fx.soundHit(); return;
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
// Crash v (simulated here) into everything nearby. Returns the biggest hit this frame.
function collideAround(v, sliding) {
  let best = null;
  for (const o of vehicles) {
    if (o === v || o.sinkT > 0 || Math.abs(o.x - v.x) > 8 || Math.abs(o.z - v.z) > 8) continue;
    // a traffic car that gets hit becomes a real physics car
    if (o.mode === 'traffic') {
      const i0 = collideVehicles(v, o, false);
      if (i0 <= 0) continue;
      const pb = o.pending; o.pending = null;
      if (i0 > 2.5) { freeTraffic(o); if (pb) applyBump(o, pb); }
    } else {
      const pushable = !o.driver || o.driver === net.uid;
      if (collideVehicles(v, o, pushable) <= 0) continue;
      if (pushable) { o.mode = 'free'; o.localSim = true; } else flushBump(o);
    }
    const hit = v.hit, i = hit.imp;
    if (!best || i > best.imp) best = hit;
    crashFx(v, hit);
    if (i > 6) {
      damageZone(v, hit.cp[0], hit.cp[1], i);
      damageVehicle(o, Math.max(0, i - 8) * 1.8 * (v.T.mass / o.T.mass) ** 0.5, { cp: hit.cp, imp: i });
    } else if (!o.driver) writeVeh(o);
  }
  for (const u of police.cops.values()) {
    if (u.kind > 1 || Math.abs(u.v.x - v.x) > 8 || Math.abs(u.v.z - v.z) > 8) continue;
    const i = collideVehicles(v, u.v, false);
    if (i <= 0) continue;
    flushBump(u.v);
    const hit = v.hit;
    if (!best || i > best.imp) best = hit;
    crashFx(v, hit);
    damageZone(u.v, hit.cp[0], hit.cp[1], i);
    if (!sliding && i > 7) damageCopUnit(u, (i - 7) * 3);
  }
  v.hit = best;
  return best ? best.imp : 0;
}

// Traffic follows the shared clock, but each car can fall behind ("lag") when it stops for people.
// Cars stop for anyone in front of them unless that person is wanted or just attacked someone.
function updateTraffic(dt, tSec) {
  const nowP = performance.now();
  const obs = [];
  if (playing && !me.dead && !(wanted.stars > 0 || nowP - lastAttack < 15000)) obs.push(me.veh ? { x: me.veh.x, z: me.veh.z, r: 1.6, person: false } : { x: me.x, z: me.z, r: 0.5, person: true });
  for (const r of remotes.values()) {
    if (r.dead || r.stars > 0 || nowP - (r.lastShot || -1e9) < 15000) continue;
    obs.push(r.vehObj ? { x: r.vehObj.x, z: r.vehObj.z, r: 1.6, person: false } : { x: r.x, z: r.z, r: 0.5, person: true });
  }
  for (const u of police.cops.values()) if (u.kind < 2 && !u.v.exploded) obs.push({ x: u.v.x, z: u.v.z, r: 1.6, person: false });
  // things to drive around (not people): stopped cars, wrecks, loose parts
  const avoid = [];
  for (const o of vehicles) if (o.mode !== 'traffic' && Math.hypot(o.vx || 0, o.vz || 0) < 1.5 && o.sinkT === 0) avoid.push({ x: o.x, z: o.z, r: o.T.wid / 2 + 0.4 });
  for (const d of fx.debrisList) avoid.push({ x: d.m.position.x, z: d.m.position.z, r: 0.8 });
  const tr = vehicles.filter((v) => v.mode === 'traffic');
  for (const v of tr) {
    v.lag = v.lag || 0; if (v.sf === undefined) v.sf = 1; v.off = v.off || 0; v.offT = v.offT || 0;
    const lp = v.loop;
    v._u = (((lp.speed * (tSec - v.lag) + (v.slot * lp.len) / lp.count) % lp.len) + lp.len) % lp.len;
    v._p = trafficPose(v, tSec - v.lag);
    v._p.x += Math.cos(v._p.h) * v.off; v._p.z -= Math.sin(v._p.h) * v.off;
  }
  for (const v of tr) {
    let block = false, person = false;
    const fx_ = Math.sin(v._p.h), fz_ = Math.cos(v._p.h);
    // obstacle in our lane ahead? swing into the other lane if it's clear, otherwise wait
    let obstacle = false;
    for (const o of avoid) {
      const dx = o.x - v._p.x, dz = o.z - v._p.z, a = dx * fx_ + dz * fz_, l = dx * fz_ - dz * fx_;
      if (a > 2 && a < 24 && Math.abs(l + v.off) < 1.2 + o.r && Math.abs(l) < 1.2 + o.r + 3.6) { obstacle = true; break; }
    }
    if (obstacle && v.offT === 0) {
      let clear = true;
      for (const o of tr) {
        if (o === v) continue;
        const dx = o._p.x - v._p.x, dz = o._p.z - v._p.z, a = dx * fx_ + dz * fz_, l = dx * fz_ - dz * fx_;
        if (a > -6 && a < 40 && l < -1.5 && l > -6.5) { clear = false; break; }
      }
      if (clear) { v.offT = v.loop.lane * 2; v.offHold = 3.5; } else block = true;
    } else if (v.offT && !obstacle) { v.offHold -= dt; if (v.offHold <= 0) v.offT = 0; }
    const before = v.off;
    v.off += Math.sign(v.offT - v.off) * Math.min(Math.abs(v.offT - v.off), dt * 3);
    v._offRate = (v.off - before) / dt;
    for (const o of obs) {
      const dx = o.x - v._p.x, dz = o.z - v._p.z, a = dx * fx_ + dz * fz_, l = Math.abs(dx * fz_ - dz * fx_);
      if (a > 1.5 && a < 13 && l < 1.5 + o.r) { block = true; person = o.person; break; }
    }
    if (!block) for (const o of tr) {
      if (o === v || o.loop !== v.loop) continue;
      const gap = (((o._u - v._u) % v.loop.len) + v.loop.len) % v.loop.len;
      if (gap > 0 && gap < 8.5) { block = true; break; }
    }
    if (v.jackHold) { block = true; person = false; }
    v.sf = block ? Math.max(0, v.sf - dt * (v.jackHold ? 8 : 3)) : Math.min(1, v.sf + dt * 0.6);
    v.lag += dt * (1 - v.sf);
    if (block && person && v.sf < 0.1) { v.honkT = (v.honkT || 0) + dt; if (v.honkT > 1.6) { v.honkT = -1.2; fx.soundHorn(distCam(v.x, v.z)); } }
    else v.honkT = 0;
  }
  for (const v of tr) {
    const p = trafficPose(v, tSec - v.lag);
    v.x = p.x + Math.cos(p.h) * v.off; v.z = p.z - Math.sin(p.h) * v.off;
    v.h = p.h + Math.atan2(v._offRate || 0, Math.max(3, v.loop.speed * v.sf));
    v.vx = p.vx * v.sf; v.vz = p.vz * v.sf; v.speed = Math.hypot(v.vx, v.vz);
  }
}

function updateVehicles(dt, tSec, nowMs) {
  updateTraffic(dt, tSec);
  for (const v of vehicles) {
    const head = v.mesh.userData.driverHead;
    if (v.mode === 'traffic') {
      if (head) head.visible = true;
    } else {
      if (head) {
        head.visible = !!v.driver && !v.exploded;
        if (v.driver && v.headFor !== v.driver) {
          v.headFor = v.driver;
          const look = v.driver === net.uid ? me.look : net.players[v.driver]?.c;
          if (Array.isArray(look)) head.material = mat(look[0]);
        }
      }

      if (v === me.veh) { /* driven in updatePlayer */ }
      else if (v.localSim) {
        const wi = stepVehicle(v, {}, dt);
        if (v.hit && wi > 6) { crashFx(v, v.hit); damageZone(v, v.hit.cp[0], v.hit.cp[1], wi); }
        collideAround(v, true);
        if (Math.hypot(v.vx, v.vz) < 0.3) { v.localSim = false; v.vx = v.vz = 0; writeVeh(v, true); }
        else writeVeh(v);
      } else if (v.tgt) {
        const k = Math.min(1, dt * 8), ox = v.x, oz = v.z;
        v.x += (v.tgt.x - v.x) * k; v.z += (v.tgt.z - v.z) * k; v.h += angDiff(v.h, v.tgt.h) * k; v.y = v.tgt.y || 0;
        v.vx = (v.x - ox) / dt; v.vz = (v.z - oz) / dt;
      }
    }
    if (v.burnAt && !v.exploded) {
      if (!v.fire) v.fire = fx.startFire(v.mesh);
      if (nowMs - v.burnAt > 5000 && (v.burnBy === net.uid || (isHost && nowMs - v.burnAt > 9000))) explodeVehicle(v);
    }
    if (v.exploded && !v.charred) { v.charred = true; fx.stopFire(v.fire); v.fire = null; charVehicle(v); }
    if (v.doorCloseAt && performance.now() > v.doorCloseAt) { v.doorOpen = 0; v.doorCloseAt = 0; }
    const dl = v.mesh.userData.parts && v.mesh.userData.parts.doorL;
    if (dl) { v.doorAng = (v.doorAng || 0) + ((v.doorOpen ? 1.15 : 0) - (v.doorAng || 0)) * Math.min(1, dt * 9); dl.rotation.y = -v.doorAng; }
    v.mesh.position.set(v.x, v.y, v.z);
    v.mesh.rotation.y = v.h;
    const body = v.mesh.userData.body;
    body.rotation.z = v.T.bike ? (v.driver ? v.tilt : 0.3) : 0;
    body.rotation.x = v.air > 0.05 ? clamp(-(v.vy || 0) * 0.025, -0.35, 0.35) : 0;
    if (v.hp < v.T.hp * 0.35 && !v.exploded && (v.hp > 0 || Math.random() < 0.6) && Math.abs(v.x - camera.position.x) < 120 && Math.abs(v.z - camera.position.z) < 120) fx.damageSmoke(v);
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
  me.ch.g.visible = !me.veh || !!me.veh.T.bike;
  if (me.enter) { enterUpdate(dt); me.vx = (me.x - px) / dt; me.vz = (me.z - pz) / dt; me.moveSpeed = 3; return; }
  if (me.exitT > 0 && me.veh) {
    me.exitT -= dt;
    stepVehicle(me.veh, { handbrake: true }, dt);
    me.x = me.veh.x; me.z = me.veh.z;
    if (me.exitT <= 0) ejectMe();
    return;
  }
  if (me.rag) { ragdollUpdate(dt); me.vx = (me.x - px) / dt; me.vz = (me.z - pz) / dt; return; }
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

// Thrown out of a car: tumble, bounce, lie there, get up.
function launchMe(v, vx, vy, vz) {
  me.veh = null;
  me.exitT = 0;
  if (v.driver === net.uid) { v.driver = ''; v.localSim = true; writeVeh(v, true); }
  const f = { x: Math.sin(v.h), z: Math.cos(v.h) };
  me.x = v.x + f.x * (v.T.len / 2 + 0.8); me.z = v.z + f.z * (v.T.len / 2 + 0.8); me.y = v.y + 1.3;
  me.rag = { t: 2.6, vx, vy, vz, spin: 8 + Math.random() * 5, landed: false };
  fx.glass(me.x, me.y, me.z, 20);
  ui.announce('THROUGH THE WINDSHIELD', '', '#ff5e5b');
  damageMe(Math.min(70, Math.hypot(vx, vz) * 1.4), 'a windshield', '');
}
function ragdollUpdate(dt) {
  const r = me.rag;
  r.t -= dt;
  r.vy -= 20 * dt;
  me.x += r.vx * dt; me.y += r.vy * dt; me.z += r.vz * dt;
  const p = W.pushOutCircle(me.x, me.z, 0.4);
  if (p.hit) { me.x = p.x; me.z = p.z; r.vx *= -0.3; r.vz *= -0.3; damageMe(8, 'a wall', ''); }
  const land = W.isLand(me.x, me.z), gy = land ? W.groundHeight(me.x, me.z) : -0.95;
  if (me.y <= gy) {
    if (r.vy < -5) { fx.blood(me.x, gy + 0.3, me.z, r.vx * 0.1, r.vz * 0.1, 6); fx.soundHit(); }
    me.y = gy; r.vy = Math.abs(r.vy) > 3 ? -r.vy * 0.3 : 0; r.vx *= 0.55; r.vz *= 0.55; r.spin *= 0.5; r.landed = true;
    if (!land) { me.swim = true; r.t = Math.min(r.t, 0.1); }
  }
  me.ch.g.position.set(me.x, me.y, me.z);
  me.ch.g.rotation.y = Math.atan2(r.vx, r.vz) || me.ch.g.rotation.y;
  if (r.landed && Math.hypot(r.vx, r.vz) < 2) animateCharacter(me.ch, dt, { dead: true });
  else { me.ch.body.rotation.x += r.spin * dt; me.ch.body.position.y = 0.6; }
  if (me.dead) return;
  if (r.t <= 0) { me.rag = null; me.ch.body.rotation.set(0, 0, 0); me.ch.body.position.y = 0; me.vy = 0; me.h = me.ch.g.rotation.y; }
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
  const ox = me.x, oz = me.z;
  me.x += mx * speed * dt; me.z += mz * speed * dt;
  if (W.groundHeight(me.x, me.z) - me.y > 0.7) { me.x = ox; me.z = oz; }
  const p = W.pushOutCircle(me.x, me.z, 0.4);
  me.x = p.x; me.z = p.z;
  const pushers = [...vehicles];
  for (const u of police.cops.values()) if (u.kind < 2) pushers.push(u.v);
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
    const gh = W.groundHeight(me.x, me.z);
    if (me.y <= gh + 0.05 && me.vy <= 0) { me.y = gh; me.vy = 0; me.grounded = true; } else me.grounded = false;
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
  const pre = { vx: v.vx, vz: v.vz, speed: v.speed };
  const imp = stepVehicle(v, { throttle: fwd > 0 ? 1 : 0, brake: fwd < 0 ? 1 : 0, steer: -side, handbrake: keys.has('Space') }, dt);
  const wallHit = v.hit;
  if (wallHit) { crashFx(v, wallHit); if (imp > 6) damageZone(v, wallHit.cp[0], wallHit.cp[1], imp); }
  const vImp = collideAround(v, false);
  const vHit = v.hit;
  let total = Math.max(imp, vImp);
  if (v.slip > 6 && v.air === 0 && Math.abs(v.speed) > 6) fx.soundSqueal();
  // through the windshield: big frontal hit with no time to brake
  const mainHit = imp >= vImp ? wallHit : vHit;
  if (mainHit && !me.dead) {
    const dv = Math.hypot(v.vx - pre.vx, v.vz - pre.vz);
    const frontal = mainHit.nx * Math.sin(v.h) + mainHit.nz * Math.cos(v.h) < -0.55;
    if (frontal && (v.T.bike ? pre.speed > 14 && dv > 8 : pre.speed > 28 && dv > 18)) {
      damageVehicle(v, (total - 7) * 3, mainHit);
      launchMe(v, pre.vx * 0.7, 5, pre.vz * 0.7);
      return;
    }
  }
  if (v.landed > 14) total = Math.max(total, v.landed * 0.8);
  // stunt jumps
  if (v.lastAir > 0.9 && v.air === 0) {
    const sd = W.toSD(v.x, v.z);
    if (sd.s < -160) ui.announce('BRIDGE JUMPED!', `${v.lastAir.toFixed(1)}s of air`, '#7cf29a');
    else ui.announce('STUNT JUMP', `${v.lastAir.toFixed(1)}s of air`);
    fx.soundStunt();
    v.lastAir = 0;
  }
  if (v.air === 0) v.lastAir = 0;
  // skid marks and tire smoke
  const handbrake = keys.has('Space');
  if (v.air === 0 && v.sinkT === 0 && (v.slip > 3.5 || (handbrake && Math.abs(v.speed) > 8))) {
    const bx = -Math.sin(v.h) * (v.T.len / 2 - 0.8), bz = -Math.cos(v.h) * (v.T.len / 2 - 0.8);
    const sx = Math.cos(v.h) * (v.T.wid / 2 - 0.1), sz = -Math.sin(v.h) * (v.T.wid / 2 - 0.1);
    fx.skid(v.x + bx + sx, v.z + bz + sz, v.h, v.y); if (!v.T.bike) fx.skid(v.x + bx - sx, v.z + bz - sz, v.h, v.y);
    if (Math.random() < 0.3) fx.smokePuff(v.x + bx, v.y + 0.3, v.z + bz, true, 0.5);
  }
  if (total > 9) {
    damageVehicle(v, (total - 9) * 1.8 * (1.3 / v.T.mass) ** 0.5);
    if (total > 14) damageMe((total - 14) * (v.T.bike ? 4 : 2), 'a crash', '');
    if (me.dead) return;
    if (v.T.bike && total > 13) { ejectMe(); me.vy = 4; return; }
  }
  // run people over
  if (Math.abs(v.speed) > 5) {
    const cs = circles(v);
    const hits = (x, z) => cs.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 0.45);
    for (const w of walkers) if (!w.dead && Math.abs(w.x - v.x) < 5 && Math.abs(w.z - v.z) < 5 && hits(w.x, w.z)) hurtWalker(w, Math.abs(v.speed) * 5, Math.sin(v.h), Math.cos(v.h));
    for (const u of police.cops.values()) if (u.kind === 2 && !u.dead && Math.abs(u.x - v.x) < 5 && Math.abs(u.z - v.z) < 5 && hits(u.x, u.z) && !u.ranOver) { u.ranOver = true; damageCopUnit(u, Math.abs(v.speed) * 5); setTimeout(() => { u.ranOver = false; }, 800); }
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
  me.ch.g.visible = !!v.T.bike;
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
    r.search = !!s[13]; r.lkx = s[14] ?? r.x; r.lkz = s[15] ?? r.z;
    if (s[9] !== r.seq) {
      r.seq = s[9]; r.lastShot = performance.now();
      fx.tracer({ x: r.x + Math.sin(r.h) * 0.6, y: r.y + 1.35, z: r.z + Math.cos(r.h) * 0.6 }, { x: s[10], y: s[11], z: s[12] });
      fx.soundShot(WEAPONS[r.weapon]?.snd || 'pistol', distCam(r.x, r.z));
      panicNear(r.x, r.z, 30);
    }
    const vo = r.veh ? vehById.get(r.veh) : null;
    r.vehObj = vo;
    const wk = WEAPONS[r.weapon]?.kind || 'none';
    if (vo) {
      r.ch.g.visible = !!vo.T.bike;
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

function updateWantedLevel(dt) {
  if (tickWanted(dt, me) === 'lost') ui.announce('COPS LOST', '', '#7cf29a');
}

let deathSpin = 0;
function updateCamera(dt) {
  const spd = me.veh ? Math.abs(me.veh.speed) : 0;
  const fov = 70 + clamp(spd - 15, 0, 30) * 0.45;
  if (Math.abs(camera.fov - fov) > 0.1) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
  if (me.dead) { deathSpin += dt; camYaw += dt * 0.5; camPitch += (0.6 - camPitch) * Math.min(1, dt * 2); }
  const tx = me.veh ? me.veh.x : me.x, tz = me.veh ? me.veh.z : me.z;
  const ty = me.veh ? me.veh.y + 1.7 : me.swim ? -0.3 : me.y + 1.6;
  if (me.veh && performance.now() - lastMouse > 1200 && Math.abs(me.veh.speed) > 3) {
    camYaw += angDiff(camYaw, me.veh.speed > 0 ? me.veh.h : me.veh.h + Math.PI) * Math.min(1, dt * 2.5);
  }
  const dist = me.veh ? 5 + me.veh.T.len + spd * 0.04 : me.dead ? 6 + deathSpin * 1.5 : 4.2;
  const cp = Math.cos(camPitch), dx = Math.sin(camYaw) * cp, dy = -Math.sin(camPitch), dz = Math.cos(camYaw) * cp;
  const sh = me.veh ? 0 : 0.55, ax = tx - Math.cos(camYaw) * sh, az = tz + Math.sin(camYaw) * sh;
  const back = W.rayBuildings(ax, ty, az, -dx, -dy, -dz, dist);
  const d = Math.max(0.8, Math.min(dist, back - 0.3));
  camera.position.set(ax - dx * d, Math.max(0.2, ty - dy * d), az - dz * d);
  camera.lookAt(ax + dx * 20, ty + dy * 20, az + dz * 20);
  followSun(tx, tz);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 2.5);
  }
}

function policePlayers() {
  const arr = [{ uid: net.uid, x: me.x, z: me.z, vx: me.vx, vz: me.vz, speed: Math.hypot(me.vx, me.vz), stars: wanted.stars, alive: !me.dead, inVeh: !!me.veh, search: wanted.search, lkx: wanted.lk.x, lkz: wanted.lk.z }];
  for (const r of remotes.values()) arr.push({ uid: r.uid, x: r.x, z: r.z, vx: r.vx, vz: r.vz, speed: Math.hypot(r.vx, r.vz), stars: r.stars, alive: !r.dead, inVeh: !!r.veh, search: r.search, lkx: r.lkx, lkz: r.lkz });
  return arr;
}
police.initPolice(scene, {
  now: () => net.now(),
  vehicles: () => vehicles,
  damagePlayer: (uid, dmg, by) => { if (uid === net.uid) damageMe(dmg, by, 'police'); else sendEvent('hit', { to: uid, dmg: r1(dmg), by }); },
  explode: (x, y, z, by) => boom(x, y, z, by, 'police'),
  copShot: (from, s) => { fx.tracer(from, { x: s[0], y: s[1], z: s[2] }); fx.muzzleFlash(from); fx.soundShot('pistol', distCam(from.x, from.z)); },
  announce: (uid, text) => { if (uid === net.uid) ui.announce(text, '', '#ff5e5b'); },
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
    if (ui.setStars(wanted.stars, wanted.search)) { ui.announce('WANTED', '★'.repeat(wanted.stars), '#ff5e5b'); fx.soundWanted(); }
    ui.setSpeedo(me.veh);
    const host = hostUid();
    const list = [{ name: me.name, me: true, host: host === net.uid, stars: wanted.stars }];
    for (const r of remotes.values()) list.push({ name: r.name, host: host === r.uid, stars: r.stars });
    ui.setPlayers(net.room, list, net.online);
  }
  let prompt = '';
  if (!me.dead) {
    if (me.veh) prompt = '';
    else if (!me.enter) { const v = nearestVehicle(4.5); if (v) prompt = Math.hypot(v.vx || 0, v.vz || 0) > 3.5 ? '' : `E: ${v.mode === 'traffic' || v.driver ? 'Carjack' : 'Enter'} ${v.T.name}`; }
  }
  ui.setPrompt(prompt);
  mmT -= dt;
  if (mmT <= 0) {
    mmT = 0.1;
    const flash = Math.floor(t * 4) % 2 ? '#ff1744' : '#2979ff';
    const blips = [];
    if (W.places.clinic) { const c = W.P(W.places.clinic.s, -12); blips.push({ x: c.x, z: c.z, color: '#e53935', size: 6, shape: 'square', label: '+' }); }
    for (const r of remotes.values()) if (!r.dead) blips.push({ x: r.x, z: r.z, color: '#40c4ff', size: 4.5 });
    for (const u of police.cops.values()) if (!police.isDown(u)) { const P = police.posOf(u); blips.push({ x: P.x, z: P.z, color: flash, size: u.kind === 3 ? 6 : u.kind === 2 ? 2.5 : 4 }); }
    const spd = me.veh ? Math.abs(me.veh.speed) : 0;
    ui.drawMinimap({ x: me.veh ? me.veh.x : me.x, z: me.veh ? me.veh.z : me.z, yaw: camYaw }, me, blips, spd > 15 ? 0.8 : 1.15, wanted.search ? cones() : null);
    // siren volume from the nearest active police unit
    let nd = Infinity;
    for (const u of police.cops.values()) if (!police.isDown(u) && u.kind !== 2) { const P = police.posOf(u); nd = Math.min(nd, Math.hypot(P.x - me.x, P.z - me.z)); }
    fx.setSiren(nd < 150 ? 1 - nd / 150 : 0);
  }
}

function update(dt, t) {
  if (wheelOpen && remotes.size === 0) dt *= 0.3; // slow motion while choosing a weapon (solo only)
  const nowMs = net.now(), tSec = nowMs / 1000;
  isHost = hostUid() === net.uid;
  updateVehicles(dt, tSec, nowMs);
  updatePlayer(dt);
  updateRemotes(dt);
  updateWalkers(dt, tSec, nowMs, camera.position);
  if (isHost) { police.hostUpdate(dt, policePlayers()); hostChores(dt, nowMs); }
  for (const v of vehicles) if (v.pending) flushBump(v);
  police.render(dt, isHost, t);
  updateGrenades(dt);
  updateWantedLevel(dt);
  updateCamera(dt);
  fx.updateFx(dt);
  sendT -= dt;
  if (sendT <= 0) {
    sendT = 0.1;
    sendState([r1(me.x), r2(me.y), r1(me.z), r2(me.h), r1(me.moveSpeed), me.veh ? me.veh.id : '', Math.round(me.hp), wanted.stars, me.weapon, me.shotSeq, r1(me.shot[0]), r1(me.shot[1]), r1(me.shot[2]), wanted.search ? 1 : 0, r1(wanted.lk.x), r1(wanted.lk.z)]);
  }
  updateHud(dt, t);
}

// Slow orbit around the statue while the menu is open.
function menuCamera(t) {
  const p = W.P(W.places.park.s, W.places.park.d);
  camera.position.set(p.x + Math.cos(t * 0.08) * 45, 22, p.z + Math.sin(t * 0.08) * 45);
  camera.lookAt(p.x, 4, p.z);
  followSun(p.x, p.z);
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

