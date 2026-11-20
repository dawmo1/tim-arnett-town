import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as W from './world.js';
import { makeCharacter, animateCharacter, placeCharacter, randomLook, nameTag, mat, initCharacters, normLook, setProp, muzzleOf, weaponModel } from './character.js';
import { SKIN as SKIN_TONES, TOPS, BOTTOMS, HAIRS, HATS, CLOTH, HAIRC, SHOES, BEARDS, GLASSES, MASKS } from './people/looks.js';
import { createAllVehicles, makeParked, makeVehicle, V, TYPES, initFarCars, farCarsBegin, farCarAdd, farCarsEnd, stepVehicle, collideVehicles, pushCharOut, circles, charVehicle, makeVehicleMesh, damageZone, applyDamageVisual, applyBump } from './vehicles.js';
import { initTraffic, updateTraffic as tickTraffic, bumpTraffic, scareTraffic, updateSignals, traffic, patrolViewers } from './traffic.js';
import { initWalkers, updateWalkers, walkers, panicNear, spawnFleeing, scare, provoke, setNpcContext, cartNear, revive } from './npc.js';
import { initEmergency, updateEmergency, reportDown } from './emergency.js';
import { initLandmarks, updateLandmarks, doors, closedCrossings, trainCars, bargeList } from './landmarks.js';
import * as interior from './interiors.js';
import { initEvents, updateEvents, eventBlips } from './events.js';
import { say, line } from './npc.js';
import { initDayNight, updateDayNight, sky as weather, clockText, view as fogView } from './daynight.js';
import { initLife, updateLife, startle, updateAnimals } from './life.js';
import { loadAssets, geometryOf } from './assets.js';
import { initCarLights, updateCarLights, setLightQuality, wetUniform } from './carlights.js';
import { initPhysics, updateRagdolls, ragdoll, release, ragPos, syncPhysics } from './ragdoll.js';
import { initNav, updateNav } from './nav.js';
import { knock, flinch } from './npc.js';
import * as police from './police.js';
import * as fx from './fx.js';
import * as ui from './ui.js';
import { net, connect, joinRoom, sendState, setVehicle, removeVehicle, setCops, sendEvent, sendChat, hostUid, setLook as netSetLook } from './net.js';
import { clamp, angDiff, rayOBB, raySphere } from './util.js';
import { wanted, crime, updateWanted as tickWanted, resetWanted, cones, initWanted } from './wanted.js';
import { eco, initEconomy, addCash, spend, goalDone, checkCountGoals, GOALS, storeNear, dropCash, updateEconomy, stores } from './economy.js';
import { updateRadio, nextStation, currentStation } from './radio.js';

// price: cost at Arnett Arms (0 = you start with it); mag/ammoPack: magazine size and rounds per purchase
const WEAPONS = [
  { name: 'Fists', melee: true, dmg: 12, range: 1.8, rate: 2.5, kind: 'none', price: 0 },
  { name: 'Bat', melee: true, dmg: 30, range: 2.4, rate: 1.6, kind: 'bat', price: 60 },
  { name: 'Pistol', dmg: 22, rate: 3.5, spread: 0.012, range: 120, kind: 'gun', snd: 'pistol', price: 0, mag: 12, ammoPack: 48, ammoPrice: 40 },
  { name: 'SMG', dmg: 9, rate: 12, spread: 0.04, range: 90, kind: 'gun', auto: true, snd: 'smg', price: 450, mag: 30, ammoPack: 120, ammoPrice: 80 },
  { name: 'Shotgun', dmg: 11, pellets: 8, rate: 1.1, spread: 0.09, range: 40, kind: 'gun', snd: 'shotgun', price: 650, mag: 6, ammoPack: 30, ammoPrice: 70 },
  { name: 'Rifle', dmg: 34, rate: 5, spread: 0.006, range: 200, kind: 'gun', auto: true, snd: 'rifle', price: 1200, mag: 20, ammoPack: 80, ammoPrice: 120 },
  { name: 'Grenade', grenade: true, rate: 0.8, kind: 'none', price: 200, mag: 1, ammoPack: 5, ammoPrice: 200 },
  { name: 'Knife', melee: true, dmg: 34, range: 1.7, rate: 3, kind: 'none', price: 40, force: 3 },
  { name: 'Crowbar', melee: true, dmg: 30, range: 2.3, rate: 1.8, kind: 'bat', price: 50, force: 6.5 },
  { name: 'Sniper', dmg: 95, rate: 0.7, spread: 0.0015, range: 400, kind: 'gun', snd: 'rifle', price: 1800, mag: 5, ammoPack: 20, ammoPrice: 150, scope: true },
  { name: 'Molotov', grenade: true, molotov: true, rate: 0.8, kind: 'none', price: 150, mag: 1, ammoPack: 4, ammoPrice: 150 },
  { name: 'RPG', rocket: true, rate: 0.5, kind: 'gun', price: 3000, mag: 1, ammoPack: 4, ammoPrice: 500 },
];
const W_MODEL = { Fists: null, Bat: 'bat', Pistol: 'pistol', SMG: 'smg', Shotgun: 'shotgun', Rifle: 'rifle', Grenade: 'grenade', Knife: 'knife', Crowbar: 'crowbar', Sniper: 'sniper', Molotov: 'molotov', RPG: 'rpg' };
const TWO_HANDED = new Set(['SMG', 'Shotgun', 'Rifle', 'Sniper', 'RPG']);
for (const w of WEAPONS) { w.model = W_MODEL[w.name]; w.long = TWO_HANDED.has(w.name); }
const r1 = (n) => Math.round(n * 10) / 10, r2 = (n) => Math.round(n * 100) / 100;

// ---------- renderer & scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap; // blurred, soft-edged shadows
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8def2);
scene.fog = new THREE.Fog(0xa8def2, 260, 1100);
{ // gradient sky dome + sun
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    // gradient + sun disk and glow + sunset band toward the sun + drifting clouds
    uniforms: { top: { value: new THREE.Color(0x2f8fe0) }, bottom: { value: new THREE.Color(0xa8def2) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(0xffffff) },
      cloud: { value: 0 }, cloudCol: { value: new THREE.Color(0xffffff) }, time: { value: 0 }, sunVis: { value: 1 }, dusk: { value: 0 }, clouds: { value: 1 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 top, bottom, sunDir, sunCol, cloudCol; uniform float cloud, time, sunVis, dusk, clouds; varying vec3 vD;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        vec3 d = normalize(vD); float h = d.y;
        vec3 col = mix(bottom, top, clamp(pow(max(h, 0.0), 0.55), 0.0, 1.0));
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        // sunset: warm band hugging the horizon on the sun's side
        col += sunCol * dusk * pow(sd, 6.0) * (1.0 - smoothstep(0.0, 0.35, h)) * 0.8;
        col += sunCol * sunVis * (pow(sd, 400.0) * 6.0 + pow(sd, 24.0) * 0.35);
        if (clouds > 0.5 && h > 0.0) {
          vec2 uv = d.xz / (h + 0.12) * 1.6 + vec2(time * 0.006, time * 0.002);
          float c = n2(uv) * 0.55 + n2(uv * 2.3 + 7.0) * 0.3 + n2(uv * 5.1 + 3.0) * 0.15;
          float cov = mix(0.62, 0.28, cloud);
          float a = smoothstep(cov, cov + 0.22, c) * smoothstep(0.0, 0.18, h) * (0.55 + 0.45 * cloud);
          vec3 cc = cloudCol * (0.85 + 0.25 * c) + sunCol * pow(sd, 8.0) * 0.4 * sunVis;
          col = mix(col, cc, a);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  sky.renderOrder = -1;
  scene.userData.sky = sky;
  scene.add(sky);
}
const camera = new THREE.PerspectiveCamera(70, 1, 0.3, 1500);
const hemi = new THREE.HemisphereLight(0xffffff, 0x99bb99, 2.3);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e0, 2.6);
sun.position.set(80, 140, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 300 });
sun.shadow.bias = -0.0005;
sun.shadow.radius = 7; sun.shadow.blurSamples = 12;
scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(60, 120, 30);
function followSun(x, y, z) {
  scene.userData.sky.position.set(x, y, z);
  sun.position.set(x + weather.sunDir.x * 150, y + weather.sunDir.y * 150, z + weather.sunDir.z * 150);
  sun.target.position.set(x, y, z);
}
// Post-processing: bloom makes lamps, headlights, fire and windows glow; OutputPass applies tone mapping.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());
// ---------- settings (remembered in this browser only) ----------
const settings = { quality: 'auto', sens: 1, volume: 0.9, invertY: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem('tat-settings') || '{}')); } catch { /* private mode etc. */ }
const saveSettings = () => { try { localStorage.setItem('tat-settings', JSON.stringify(settings)); } catch { /* ignore */ } };
let activeQuality = 'medium';
// Low: no shadows/bloom, lower resolution, shorter view. High: sharper shadows and full resolution.
function applyQuality(q) {
  activeQuality = q;
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(q === 'low' ? Math.min(dpr, 0.75) : q === 'medium' ? Math.min(dpr, 1) : Math.min(dpr, 1.5));
  renderer.shadowMap.enabled = q !== 'low';
  const size = q === 'high' ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); sun.shadow.map?.dispose(); sun.shadow.map = null; }
  scene.traverse((o) => { if (o.material && o.material.needsUpdate !== undefined && o.receiveShadow) o.material.needsUpdate = true; });
  bloom.enabled = q !== 'low';
  setLightQuality(q);
  scene.userData.sky.material.uniforms.clouds.value = q === 'low' ? 0 : 1;
  // view distance + how much of the city is built in full detail
  camera.far = q === 'low' ? 900 : q === 'medium' ? 1500 : 2200; camera.updateProjectionMatrix();
  scene.userData.sky.scale.setScalar(camera.far * 0.9);
  fogView.near = camera.far * 0.2; fogView.far = camera.far * 0.88;
  W.setDetailRadius(q === 'low' ? 260 : q === 'medium' ? 400 : 520);
  resize();
  const note = document.getElementById('qualityNote');
  if (note) note.textContent = settings.quality === 'auto' ? `Auto picked ${q}. It drops a level if the game runs slowly.` : '';
}
function initSettingsUi() {
  const qb = document.getElementById('qualityBtns');
  const mark = () => { for (const b of qb.querySelectorAll('button')) b.classList.toggle('on', b.dataset.q === settings.quality); };
  qb.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; settings.quality = b.dataset.q; saveSettings(); mark(); applyQuality(b.dataset.q === 'auto' ? 'medium' : b.dataset.q); });
  const sens = document.getElementById('sensSlider'), vol = document.getElementById('volSlider'), inv = document.getElementById('invertY');
  sens.value = settings.sens; vol.value = settings.volume; inv.checked = settings.invertY;
  const show = () => { document.getElementById('sensOut').textContent = Number(settings.sens).toFixed(2) + '×'; document.getElementById('volOut').textContent = Math.round(settings.volume * 100) + '%'; };
  sens.addEventListener('input', () => { settings.sens = +sens.value; saveSettings(); show(); });
  vol.addEventListener('input', () => { settings.volume = +vol.value; fx.setVolume(settings.volume); saveSettings(); show(); });
  inv.addEventListener('change', () => { settings.invertY = inv.checked; saveSettings(); });
  mark(); show(); fx.setVolume(settings.volume);
}
// Auto quality: if the frame rate stays low, step down one level.
let fpsAcc = 0, fpsFrames = 0, fpsWarm = 0;
function watchFps(dt) {
  if (settings.quality !== 'auto' || paused || !playing) return;
  fpsWarm += dt; if (fpsWarm < 4) return;
  fpsAcc += dt; fpsFrames++;
  if (fpsAcc >= 4) {
    const fps = fpsFrames / fpsAcc; fpsAcc = 0; fpsFrames = 0;
    if (fps < 28 && activeQuality !== 'low') { applyQuality(activeQuality === 'high' ? 'medium' : 'low'); ui.flashPrompt(`Graphics lowered to ${activeQuality} to keep things smooth`); fpsWarm = 0; }
  }
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth / 2, innerHeight / 2);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
applyQuality(settings.quality === 'auto' ? 'medium' : settings.quality);
initSettingsUi();

// ---------- load Davenport (the menu waits for the city around the riverfront) ----------
const playBtn = document.getElementById('playBtn');
playBtn.disabled = true; playBtn.textContent = 'Loading models…';
await loadAssets((p) => { playBtn.textContent = `Loading models… ${Math.round(p * 100)}%`; });
initCharacters(activeQuality);
fx.setCasingGeometry(geometryOf('weapons', 'casing'));
playBtn.textContent = 'Loading Davenport…';
await W.initWorld(scene);
await W.preload(W.places.menu.x, W.places.menu.z, 320, (p) => { playBtn.textContent = `Loading Davenport… ${Math.round(p * 100)}%`; });
playBtn.disabled = false; playBtn.textContent = 'Play';
fx.initFx(scene);
initWalkers(scene);
initDayNight({ scene, sun, hemi, skyMat: scene.userData.sky.material, renderer });
initLife(scene);
initEconomy(scene, {
  announce: (t, sub, c) => ui.announce(t, sub, c || '#8fe38a'),
  sound: (k) => (k === 'goal' ? fx.soundGoal() : fx.soundCash()),
  feed: (t) => ui.addFeed(t),
});
const enginesReady = Promise.all([
  initPhysics().catch((e) => console.warn('physics unavailable', e)),
  initNav().catch((e) => console.warn('navigation unavailable', e)),
]);
initCarLights(scene);
const vehicles = createAllVehicles(scene, []);
initFarCars(scene);
ui.drawMapBase();
ui.buildWheel(WEAPONS, (i) => { selectWeapon(i); closeWheel(false); });
ui.setWheelInfo((i) => { const w = WEAPONS[i]; if (!me.owned.has(i)) return `Buy at Arnett Arms · $${w.price}`; if (w.melee) return 'Melee'; const a = ammoOf(i); return w.grenade ? `${a.mag + a.res} grenades` : `${a.mag} / ${a.res} rounds`; });
const vehById = new Map(vehicles.map((v) => [v.id, v]));
const remotes = new Map();
const grenades = [];

const me = {
  name: '', look: null, ch: null, x: 0, y: 0, z: 0, h: 0, vy: 0, vx: 0, vz: 0, hp: 100, dead: false, deadT: 0,
  stars: 0, unseen: 0, weapon: 2, cd: 0, swing: 0, veh: null, swim: false, grounded: true, moveSpeed: 0,
  shotSeq: 0, shot: [0, 0, 0], hitCd: 0, lastBy: '', lastByUid: '',
  armor: 0, owned: new Set([0, 2]), ammo: { 2: { mag: 12, res: 48 } }, reloadT: 0, aimT: 0, lockOn: null,
};
let aiming = false;
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
  if (paused) return;
  if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyT') { e.preventDefault(); openChat(); }
  if (e.code === 'Tab' || e.code === 'KeyQ') { e.preventDefault(); openWheel(); }
  if (e.code === 'KeyM') { document.exitPointerLock?.(); openPause('map'); }
  if (e.code === 'KeyE') { const d = doorNear(); if (d) useDoor(d); else if (!useStore()) toggleVehicle(); }
  if (e.code === 'KeyR') startReload();
  if (e.code === 'KeyN' && me.veh && !me.veh.T.bike) { const st = nextStation(); ui.flashPrompt(st.sub ? `📻 ${st.name} · ${st.sub}` : st.name); }
  if (e.code === 'KeyP') openPhone();
  if (e.code === 'KeyG' || e.code === 'KeyH') talk(e.code === 'KeyG');
});
addEventListener('keyup', (e) => { keys.delete(e.code); if ((e.code === 'Tab' || e.code === 'KeyQ') && wheelOpen) closeWheel(true); });
addEventListener('blur', () => { keys.clear(); mouseDown = false; });
canvas.addEventListener('click', () => { if (playing && !typing) { lockMouse(); fx.unlockAudio(); } });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked) mouseDown = false;
  if (locked) closePause();
  else if (playing && !typing && !wheelOpen && !shopOpen) openPause();
});
addEventListener('mousemove', (e) => {
  if (!locked) return;
  if (wheelOpen) {
    wheelX = clamp(wheelX + e.movementX, -120, 120); wheelY = clamp(wheelY + e.movementY, -120, 120);
    if (Math.hypot(wheelX, wheelY) > 25) { wheelSel = ui.wheelIndex(wheelX, wheelY, WEAPONS.length); ui.wheelHighlight(wheelSel, WEAPONS[wheelSel]); }
    return;
  }
  const sens = (aiming ? (WEAPONS[me.weapon].scope ? 0.0005 : 0.0013) : 0.0025) * settings.sens;
  camYaw -= e.movementX * sens;
  camPitch = clamp(camPitch + e.movementY * sens * (settings.invertY ? -1 : 1), -0.5, 1.2);
  lastMouse = performance.now();
});
addEventListener('mousedown', (e) => {
  if (!locked || wheelOpen) return;
  if (e.button === 0) { mouseDown = true; clicked = true; }
  if (e.button === 2) { aiming = true; me.lockOn = findLockTarget(); }
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; if (e.button === 2) { aiming = false; me.lockOn = null; } });
addEventListener('contextmenu', (e) => { if (playing) e.preventDefault(); });
function openChat() {
  typing = true; keys.clear(); mouseDown = false;
  ui.el.chatInput.hidden = false;
  document.exitPointerLock?.();
  setTimeout(() => ui.el.chatInput.focus(), 0);
}
function closeChat() {
  typing = false; ui.el.chatInput.value = ''; ui.el.chatInput.hidden = true; ui.el.chatInput.blur();
}
// ---------- pause menu, map and waypoint ----------
let paused = false, waypoint = null;
function openPause(tab) {
  if (!playing) return;
  paused = true; keys.clear(); mouseDown = false;
  ui.el.pause.hidden = false;
  if (tab) showTab(tab);
  drawPauseMap();
}
function closePause() { if (shopOpen) { shopOpen = false; document.getElementById('shop').hidden = true; } paused = false; ui.el.pause.hidden = true; }
function showTab(tab) {
  for (const b of ui.el.pauseTabs.querySelectorAll('button')) b.classList.toggle('on', b.dataset.tab === tab);
  for (const p of ui.el.pause.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== tab;
  if (tab === 'map') drawPauseMap();
  if (tab === 'goals') drawGoals();
}
function drawGoals() {
  const ul = document.getElementById('goalList');
  ul.innerHTML = '';
  for (const g of GOALS) {
    const li = document.createElement('li'), done = eco.done.has(g.id);
    li.className = done ? 'done' : '';
    const prog = g.max && !done ? `<span class="prog">${Math.min(g.get(), g.max)}/${g.max}</span>` : '';
    li.innerHTML = `<span class="check">${done ? '✔' : '○'}</span><span>${g.text}${prog}</span><span class="reward">$${g.reward}</span>`;
    ul.append(li);
  }
}
ui.el.pauseTabs.addEventListener('click', (e) => { const t = e.target.closest('button'); if (t) showTab(t.dataset.tab); });
ui.el.resumeBtn.addEventListener('click', () => { closePause(); lockMouse(); fx.unlockAudio(); });
ui.el.bigmap.addEventListener('click', (e) => {
  if (ui.bigMapDragged()) return;
  const p = ui.bigMapToWorld(e);
  waypoint = waypoint && Math.hypot(waypoint.x - p.x, waypoint.z - p.z) < 40 ? null : p;
  gpsRoute = waypoint ? W.route(me.veh ? me.veh.x : me.x, me.veh ? me.veh.z : me.z, waypoint.x, waypoint.z) : null; routeT = 3;
  drawPauseMap();
});
// ---------- GPS: a route along real streets to the waypoint ----------
let gpsRoute = null, routeT = 0;
function updateRoute(dt) {
  if (!waypoint) { gpsRoute = null; gpsEl.hidden = true; return; }
  const x = me.veh ? me.veh.x : me.x, z = me.veh ? me.veh.z : me.z;
  routeT -= dt;
  if (gpsRoute) {
    // follow along: drop the points already passed, and re-plan if you leave the route
    gpsRoute[0] = [x, z];
    while (gpsRoute.length > 2 && Math.hypot(gpsRoute[2][0] - x, gpsRoute[2][1] - z) < Math.hypot(gpsRoute[2][0] - gpsRoute[1][0], gpsRoute[2][1] - gpsRoute[1][1]) + 2) gpsRoute.splice(1, 1);
    const off = Math.hypot(gpsRoute[1][0] - x, gpsRoute[1][1] - z) > 45;
    if (routeT <= 0 && off) { gpsRoute = W.route(x, z, waypoint.x, waypoint.z); routeT = 3; }
  } else if (routeT <= 0) { gpsRoute = W.route(x, z, waypoint.x, waypoint.z); routeT = 3; }
  gpsText(x, z);
}
// "In 120 m turn right onto Brady Street"
const gpsEl = Object.assign(document.createElement('div'), { id: 'gpsNext', hidden: true });
document.getElementById('hud').append(gpsEl);
let gpsTextT = 0;
function gpsText(x, z) {
  gpsTextT -= 0.016; if (gpsTextT > 0) return; gpsTextT = 0.25;
  const R = gpsRoute;
  if (!R || R.length < 3 || !waypoint) { gpsEl.hidden = true; return; }
  let dist = Math.hypot(R[1][0] - x, R[1][1] - z), msg = null;
  for (let i = 1; i < R.length - 1; i++) {
    const ax = R[i][0] - R[i - 1][0], az = R[i][1] - R[i - 1][1], bx = R[i + 1][0] - R[i][0], bz = R[i + 1][1] - R[i][1];
    const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
    if (la > 0.5 && lb > 0.5) {
      const turn = Math.atan2(ax * bz - az * bx, ax * bx + az * bz); // + = right (x east, z south)
      if (Math.abs(turn) > 0.6) {
        const q = W.nearestEdge(R[i][0] + (bx / lb) * Math.min(12, lb), R[i][1] + (bz / lb) * Math.min(12, lb), 10);
        const onto = q && q.e.name ? ` onto ${q.e.name}` : '';
        const dir = Math.abs(turn) > 2.4 ? 'Make a U-turn' : turn > 0 ? 'Turn right' : 'Turn left';
        msg = `<b>${turn > 0 ? '↱' : '↰'}</b>${dist < 25 ? 'Now' : `In ${Math.round(dist / 10) * 10} m`} · ${dir}${onto}`;
        break;
      }
    }
    dist += lb;
  }
  if (!msg) msg = `<b>⚑</b>${dist < 60 ? 'Arriving at your waypoint' : `Waypoint in ${dist > 1000 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist / 10) * 10 + ' m'}`}`;
  gpsEl.innerHTML = msg; gpsEl.hidden = false;
}
function mapBlips() {
  const b = [];
  for (const h of W.places.hospitals) b.push({ x: h.x, z: h.z, color: '#e5484d', size: 6, shape: 'square', label: '+', name: h.name.replace(/^MercyOne /, ''), dy: 12 });
  for (const p of W.places.police) b.push({ x: p.x, z: p.z, color: '#2f6fdc', size: 6, shape: 'square', label: '★', name: p.name });
  for (const s of storeList(true)) b.push(s);
  for (const e of eventBlips()) b.push(e);
  for (const r of remotes.values()) if (!r.dead) b.push({ x: r.x, z: r.z, color: '#4aa3ff', size: 5, name: r.name });
  return b;
}
function storeList(all) {
  const out = [];
  for (const s of stores) {
    if (s.kind === 'guns') out.push({ x: s.x, z: s.z, color: '#e5484d', size: 6, shape: 'square', label: '⌖', name: 'Arnett Arms' });
    else if (s.kind === 'body') out.push({ x: s.x, z: s.z, color: '#4aa3ff', size: 6, shape: 'square', label: '✦', name: 'Arnett Auto' });
    else if (s.kind === 'rob' && all) out.push({ x: s.x, z: s.z, color: '#8fe38a', size: 4.5, label: '$', name: s.name });
  }
  return out;
}
function drawPauseMap() { ui.drawBigMap(me, mapBlips(), waypoint, gpsRoute); }

function lockMouse() { try { const p = canvas.requestPointerLock?.(); p?.catch?.(() => {}); } catch { /* not allowed here */ } }
function selectWeapon(i) {
  const w = WEAPONS[i];
  if (!me.owned.has(i)) { ui.flashPrompt(`${w.name}: buy it at Arnett Arms ($${w.price})`); return; }
  me.weapon = i; me.reloadT = 0; refreshWeaponHud();
}
function ammoOf(i) { return me.ammo[i] || (me.ammo[i] = { mag: 0, res: 0 }); }
function refreshWeaponHud() {
  const w = WEAPONS[me.weapon], a = ammoOf(me.weapon);
  ui.setWeapon(w.name, w.melee ? '' : w.grenade ? `× ${a.mag + a.res}` : me.reloadT > 0 ? 'Reloading…' : `${a.mag} / ${a.res}`);
}
function startReload() {
  const w = WEAPONS[me.weapon], a = ammoOf(me.weapon);
  if (w.melee || w.grenade || me.reloadT > 0 || a.mag >= w.mag || a.res <= 0) return;
  me.reloadT = w.name === 'Shotgun' ? 1.8 : 1.3; fx.soundReload(); refreshWeaponHud();
}
// Right-click aim: snap onto the nearest threat (or person) roughly where you're looking.
function findLockTarget() {
  let best = null, bs = 0.26;
  const consider = (x, y, z, ref, kind) => {
    const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz);
    if (d > 45 || d < 1) return;
    const off = Math.abs(angDiff(camYaw, Math.atan2(dx, dz)));
    const score = off + d * 0.004 - (kind === 'threat' ? 0.1 : 0);
    if (off < 0.35 && score < bs && W.lineOfSight(me.x, me.y + 1.5, me.z, x, y, z)) { bs = score; best = { ref, kind }; }
  };
  for (const u of police.cops.values()) if (!police.isDown(u)) { const P = police.posOf(u); consider(P.x, u.kind === 3 ? u.y : (P.y || 0) + 1.2, P.z, u, 'threat'); }
  for (const w of walkers) if (!w.dead && !w.ch.rag) consider(w.x, (w.y || 0) + 1.2, w.z, w, w.mode === 'hostile' ? 'threat' : 'person');
  for (const r of remotes.values()) if (!r.dead) consider(r.x, r.y + 1.2, r.z, r, 'player');
  return best;
}
function lockPos(t) {
  const r = t.ref;
  if (t.kind === 'threat' && r.kind !== undefined) { if (police.isDown(r)) return null; const P = police.posOf(r); return { x: P.x, y: r.kind === 3 ? r.y : (P.y || 0) + (r.kind < 2 ? 1.0 : 1.2), z: P.z }; }
  if (r.dead || (r.ch && r.ch.rag)) return null;
  return { x: r.x, y: (r.y || 0) + 1.2, z: r.z };
}
function openWheel() {
  if (wheelOpen || me.dead) return;
  wheelOpen = true; wheelSel = me.weapon; wheelX = wheelY = 0; mouseDown = false;
  ui.wheelHighlight(wheelSel, WEAPONS[wheelSel]); ui.setWheelLocked(me.owned, WEAPONS.map((w) => w.price)); ui.showWheel(true);
}
function closeWheel(apply) {
  if (!wheelOpen) return;
  wheelOpen = false; ui.showWheel(false);
  if (apply) selectWeapon(wheelSel);
}

// ---------- menu ----------
const nameInput = document.getElementById('nameInput');
const roomInput = document.getElementById('roomInput');
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
  playBtn.textContent = 'Loading Davenport…';
  await enginesReady;
  // drop in somewhere random in the city (load the streets around you first)
  const sp = W.randomSpawn();
  ui.el.menu.hidden = true; loading(true, W.areaAt(sp.x, sp.z)[0]);
  await W.preload(sp.x, sp.z, 260, (p) => { loadProgress(p); playBtn.textContent = `Loading Davenport… ${Math.round(p * 100)}%`; });
  loading(false);
  manageParked(0, sp.x, sp.z, true);
  me.name = name; me.look = randomLook();
  try { await joinRoom(room, name, me.look); }
  catch (e) { console.error(e); netStatus.textContent = "Couldn't join the room: " + (e.code || e.message); playBtn.disabled = false; playBtn.textContent = 'Play'; return; }
  history.replaceState(null, '', '#' + room);
  me.ch = makeCharacter(me.look);
  scene.add(me.ch.g);
  respawn(true, sp);
  ui.el.menu.hidden = true; ui.el.hud.hidden = false;
  playing = true;
  selectWeapon(2);
  fx.unlockAudio();
  ui.help('Welcome to <b>Tim Arnett Town</b>. <kbd>WASD</kbd> to move, mouse to look. Press <kbd>Esc</kbd> or <kbd>M</kbd> for the map.', 7);
  ui.help('Walk up to any car and press <kbd>E</kbd>. If someone is driving, you will drag them out.', 6);
  ui.help('Hold <kbd>Tab</kbd> for the weapon wheel. Crimes seen by the cops or reported by witnesses give you stars.', 7);
  ui.help('<kbd>G</kbd> says hi, <kbd>H</kbd> insults. <kbd>P</kbd> calls the mechanic. Hold <kbd>C</kbd> in a car to look back. An orange <b>!</b> on the map is a crime you can stop.', 8);
  ui.help('Looking for something to do? Press <kbd>Esc</kbd> and open <b>Goals</b> for crime sprees that pay cash. Click the map to set a GPS route.', 8);
  lockMouse();
});

// ---------- network handlers ----------
net.handlers.chat = (c) => c && ui.addChat(String(c.n || '?').slice(0, 16), String(c.m || '').slice(0, 120));
net.handlers.cops = (obj) => { if (!isHost) police.applyRemote(obj); };
net.handlers.vehicle = (id, rec) => {
  let v = vehById.get(id);
  if (!v && rec && Number.isInteger(rec.ti) && rec.ti >= 0 && rec.ti < V_COUNT) {
    // a car another player is using that we haven't seen yet
    v = makeVehicle(id, rec.ti, typeof rec.c === 'number' ? rec.c : 0xffffff, { x: +rec.x || 0, z: +rec.z || 0, h: +rec.h || 0 });
    for (const o of [...vehicles]) if (o.mode === 'parked' && !o.keep && Math.hypot(o.x - v.x, o.z - v.z) < 3) resetVehicle(o); // our copy of the same kerb car
    v.mode = 'free'; v.remote = true; scene.add(v.mesh); vehicles.push(v); vehById.set(id, v);
  }
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
    case 'hit': if (e.to === net.uid) damageMe(+e.dmg || 0, String(e.by || 'someone'), e.from, e.ix !== undefined ? { x: +e.ix, y: 3.5, z: +e.iz } : null); break;
    case 'vehHit': if (me.veh && me.veh.id === e.id) damageVehicle(me.veh, +e.dmg || 0, e.imp ? { cp: [e.px, e.pz], imp: e.imp } : null); break;
    case 'bump': {
      if (me.veh && me.veh.id === e.id) applyBump(me.veh, e);
      else if (isHost) { const u = police.cops.get(e.id); if (u && u.kind < 2) applyBump(u.v, e); }
      break;
    }
    case 'copHit': if (isHost) police.damageCop(e.id, +e.dmg || 0); break;
    case 'boom': explode(e.x, e.y, e.z, String(e.by || 'an explosion'), e.bu, false); break;
    case 'nade': spawnNade({ x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, t: e.k === 'molotov' ? 6 : e.k === 'rocket' ? 4 : 2.4, mine: false, kind: e.k || 'nade' }); break;
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
  setVehicle(v.id, { ti: v.ti, c: v.color, x: r1(v.x), y: r2(v.y), z: r1(v.z), h: r2(v.h), hp: Math.round(v.hp), d: v.driver || '', b: v.burnAt || 0, bb: v.burnBy || '', e: v.exploded ? 1 : 0, dz: [v.dz.f, v.dz.b, v.dz.l, v.dz.r].map(Math.round) });
}
function resetVehicle(v) {
  if (me.veh === v) return;
  fx.stopFire(v.fire); v.fire = null;
  scene.remove(v.mesh);
  const i = vehicles.indexOf(v); if (i >= 0) vehicles.splice(i, 1);
  vehById.delete(v.id);
  if (v.spotKey) usedSpots.delete(v.spotKey);
}
const V_COUNT = TYPES.length;
// Vehicles this player spawns get ids nobody else uses (a<uid>_<tag><n>); landmark ones are shared.
let idN = 0;
const newId = (tag = '') => `a${(net.uid || 'me').replace(/[^A-Za-z0-9]/g, '').slice(0, 28)}_${tag}${idN++}`;
// ---------- parked cars on real curbs and lots around you ----------
const usedSpots = new Set();
let parkT = 0, parkN = 0;
const spotHash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
function manageParked(dt, x, z, force) {
  parkT -= dt; if (parkT > 0 && !force) return; parkT = 2.5;
  const R = activeQuality === 'low' ? 170 : 240, want = activeQuality === 'low' ? 18 : activeQuality === 'medium' ? 32 : 44;
  for (const v of [...vehicles]) {
    if (v === me.veh || v.driver || v.localSim || v.keep || v.remote) continue;
    const d = Math.hypot(v.x - x, v.z - z);
    if ((v.mode === 'parked' && !v.stolenOnce && d > R + 120) || (v.mode === 'free' && d > 480)) resetVehicle(v);
  }
  let have = vehicles.filter((v) => v.mode === 'parked' && Math.hypot(v.x - x, v.z - z) < R).length;
  if (have >= want) return;
  const cand = [];
  for (const t of W.tiles.values()) {
    if (Math.abs(t.ox + 100 - x) > R + 100 || Math.abs(t.oz + 100 - z) > R + 100) continue;
    for (let i = 0; i < t.k.length; i += 4) {
      const key = t.key + ':' + i; if (usedSpots.has(key) || spotHash(t.tx * 31 + i, t.tz) > 0.42) continue;
      const px = t.k[i] + t.ox, pz = t.k[i + 1] + t.oz, d = Math.hypot(px - x, pz - z);
      if (d > R || (!force && d < 70)) continue; // new cars appear out of sight
      let sx = px, sz = pz;
      if (!t.k[i + 3]) { const q = W.nearestEdge(px, pz, 8); if (q) { const ox = px - q.x, oz = pz - q.z, l = Math.hypot(ox, oz) || 1; sx += (ox / l) * 0.3; sz += (oz / l) * 0.3; } }
      cand.push({ key, x: sx, z: sz, h: t.k[i + 2] + (spotHash(i, t.tx) < 0.5 ? 0 : Math.PI), d });
    }
  }
  cand.sort((a, b) => a.d - b.d);
  for (const c of cand) {
    if (have >= want) break;
    if (vehicles.some((v) => Math.abs(v.x - c.x) < 5 && Math.abs(v.z - c.z) < 5)) continue;
    const v = makeParked(newId(), c, () => spotHash(c.x, c.z + parkN++));
    v.spotKey = c.key; usedSpots.add(c.key);
    scene.add(v.mesh); vehicles.push(v); vehById.set(v.id, v); have++;
  }
}
function freeTraffic(v, noFlee, keepDriver) {
  if (v.mode !== 'traffic') return;
  v.mode = 'free'; v.driver = ''; v.localSim = true;
  if (keepDriver) { v.npcDriver = true; v.npcOutT = 2 + Math.random() * 2.5; v.npcAngry = Math.random() < 0.5; }
  else if (!noFlee) spawnFleeing(v.x + Math.cos(v.h) * 1.6, v.z - Math.sin(v.h) * 1.6, v.h + Math.PI / 2);
  writeVeh(v, true);
}
function damageVehicle(v, dmg, hit) {
  if (v.exploded || dmg <= 0) return;
  if (v.driver && v.driver !== net.uid) { sendEvent('vehHit', { id: v.id, dmg: r1(dmg), px: hit ? r1(hit.cp[0]) : 0, pz: hit ? r1(hit.cp[1]) : 0, imp: hit ? r1(hit.imp) : 0 }); return; }
  if (v.mode === 'traffic') freeTraffic(v);
  v.mode = 'free';
  if (hit) damageZone(v, hit.cp[0], hit.cp[1], hit.imp);
  dmg *= v.T.armor || 1;
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
  if (u.kind === 2) { const dx = u.x - me.x, dz = u.z - me.z, l = Math.hypot(dx, dz) || 1; u.hitDir = { x: dx / l, z: dz / l }; u.ch.flinch = 1; }
  const hp = u.kind < 2 ? u.v.hp : u.hp;
  let killed;
  if (isHost) killed = police.damageCop(u.id, dmg);
  else { sendEvent('copHit', { id: u.id, dmg: r1(dmg) }); killed = hp > 0 && hp - dmg <= 0; }
  report(killed ? (u.kind === 3 ? 'killheli' : 'killcop') : 'hitcop', u.kind < 2 ? u.v.x : u.x, u.kind < 2 ? u.v.z : u.z);
  if (killed && u.kind === 2) dropCash(u.x, u.z, 60);
  if (killed && u.kind < 2) { eco.copCars++; checkCountGoals(); }
  if (killed && u.kind === 3) goalDone('heli');
  if (u.kind === 2) fx.blood(u.x, 1.2, u.z, 0, 0, 8);
  ui.hitMarker(killed);
}
function explodeVehicle(v) {
  v.exploded = true; v.hp = 0;
  writeVeh(v, true);
  boom(v.x, v.y + 0.5, v.z, nameOf(v.burnBy), v.burnBy || '');
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
  if (!me.dead && dm < R) damageMe(140 * (1 - dm / R), by, bu, { x: ((me.x - x) / (dm || 1)) * 14, y: 8, z: ((me.z - z) / (dm || 1)) * 14 });
  if (me.veh) { const dv = Math.hypot(me.veh.x - x, me.veh.z - z); if (dv < R) damageVehicle(me.veh, 150 * (1 - dv / R)); }
  scare(x, z, 45, 'explosion'); startle(x, z, 60); scareTraffic(x, z, 90);
  if (origin) {
    for (const w of walkers) { if (w.dead) continue; const d = Math.hypot(w.x - x, w.z - z); if (d < R) hurtWalker(w, 200, (w.x - x) / (d || 1), (w.z - z) / (d || 1), null, 16 * (1 - d / R) + 6); }
    for (const v of vehicles) {
      if (v === me.veh || v.exploded || (v.driver && v.driver !== net.uid)) continue;
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < R) damageVehicle(v, 150 * (1 - d / R));
    }
    if ([...police.cops.values()].some((u) => copDist(u, x, y, z) < R)) report('hitcop', x, z);
  }
  if (isHost) for (const u of police.cops.values()) { const d = copDist(u, x, y, z); if (d < R) police.damageCop(u.id, 150 * (1 - d / R)); }
}
function copDist(u, x, y, z) { const P = police.posOf(u); return Math.hypot(P.x - x, (u.kind < 2 ? u.v.y : u.y || 0) - y, P.z - z); }
// force: how hard the hit shoves them (bullets ~3, bat 7, cars and explosions much more)
function hurtWalker(w, dmg, dx, dz, p, force = 3) {
  if (w.dead) return;
  w.hp -= dmg;
  const hp = p || { x: w.x, y: (w.y || 0) + 1.2, z: w.z };
  fx.blood(hp.x, hp.y, hp.z, dx, dz, 10);
  const vel = { x: dx * force, y: 1.2 + force * 0.25, z: dz * force };
  if (w.hp > 0) {
    if (force >= 6) knock(w, vel, false);
    else {
      flinch(w); provoke(w);
      // stagger away from the hit; a leg hit makes them limp, a body hit makes them clutch the wound
      const c = w.ch, ch_ = Math.cos(w.h), sh = Math.sin(w.h);
      c.hitT = 1; c.hitX = dx * ch_ - dz * sh; c.hitZ = dx * sh + dz * ch_;
      const hy = hp.y - (w.y || 0);
      if (hy < 0.8) w.limp = 30; else if (hy < 1.5 && Math.random() < 0.6) w.clutch = 12;
    }
  }
  else knock(w, vel, true);
  if (w.hp <= 0) {
    w.dead = { x: r1(w.x), z: r1(w.z), h: r2(w.h), t: net.now() };
    setTimeout(() => { const p = w.ch.rag ? ragPos(w.ch) : w; fx.bloodPool(p.x, p.z, 1.4); }, 1300); // pool forms where the body comes to rest
    report('kill', w.x, w.z);
    if (Math.random() < 0.75) dropCash(w.x, w.z, 5 + Math.floor(Math.random() * 40));
    reportDown(w);
    return true;
  }
  return false;
}
// imp (optional): a push like {x, y, z}; big pushes knock you over
function damageMe(dmg, by, bu, imp) {
  if (me.dead || dmg <= 0) return;
  if (me.armor > 0) { const soak = Math.min(me.armor, dmg * 0.7); me.armor -= soak; dmg -= soak; }
  me.hp -= dmg; me.lastBy = by; me.lastByUid = bu || '';
  me.lastImpulse = imp || null;
  ui.flashHurt();
  fx.blood(me.x, me.y + 1.2, me.z, 0, 0, 6);
  if (me.hp <= 0) { die(); return; }
  if (imp && Math.hypot(imp.x, imp.z) > 5 && !me.veh) knockMe(imp);
  else me.ch.flinch = 1;
}
// Knocked off your feet: physics takes over until you get back up.
function knockMe(vel, getUp = 2.2) {
  if (me.veh) return false;
  if (me.ch.rag) { ragdoll(me.ch, vel); return true; }
  closeWheel(false); cancelEnter();
  return !!ragdoll(me.ch, vel, { getUp, onUp: (p, h) => { me.x = p.x; me.z = p.z; me.h = h; me.y = W.isLand(p.x, p.z) ? W.groundHeight(p.x, p.z) : W.SWIM_Y; me.vy = 0; } });
}
function die() {
  closeWheel(false);
  me.hp = 0; me.dead = true; me.deadT = 5; me.deadAt = performance.now();
  fx.soundWasted();
  if (me.veh) ejectMe();
  cancelEnter();
  const imp = me.lastImpulse || { x: (Math.random() - 0.5) * 3, y: 1, z: (Math.random() - 0.5) * 3 };
  ragdoll(me.ch, imp, { dead: true });
  fx.bloodPool(me.x, me.z, 1.6);
  const text = !me.lastBy || me.lastByUid === net.uid ? `${me.name} died` : `${me.lastBy} killed ${me.name}`;
  ui.addFeed(text);
  sendEvent('kill', { text, ku: me.lastByUid });
  ui.el.dead.hidden = false;
  canvas.classList.add('dead');
}
// Loading screen: a slow pan over the city with the logo, a tip and a progress bar.
const TIPS = ['Hold Tab for the weapon wheel.', 'Press M for the map, click it to set a GPS route.', "Stores, Arnett Arms, Tim's Threads and the casino have doors: press E.", 'Hide in a shop or a parking ramp to shake the cops faster.', 'P calls the mechanic: he drops a car off near you.', 'Hold C while driving to look behind you.', 'G says hi. H insults people. Some swing back.', "Freight trains don't stop. Neither do barges.", 'Re-elect Mayor Tim Arnett.'];
const loadEl = Object.assign(document.createElement('div'), { id: 'loading', hidden: true });
loadEl.innerHTML = '<h1>TIM ARNETT <span>TOWN</span></h1><p></p><div class="bar"><i></i></div>';
document.body.append(loadEl);
function loading(on, label) {
  loadEl.hidden = !on;
  if (on) { loadEl.querySelector('p').textContent = (label ? label + ' · ' : '') + TIPS[Math.floor(Math.random() * TIPS.length)]; loadEl.querySelector('i').style.width = '0%'; }
}
const loadProgress = (p) => { loadEl.querySelector('i').style.width = Math.round(p * 100) + '%'; };
// After dying you wake up outside the nearest hospital (the streets there load first).
let respawning = false;
async function beginRespawn() {
  if (respawning) return;
  respawning = true;
  const sp = W.hospitalSpawn(me.x, me.z);
  loading(true, sp.name || 'To the hospital');
  await W.preload(sp.x, sp.z, 200, loadProgress);
  loading(false);
  manageParked(0, sp.x, sp.z, true);
  respawn(false, sp);
  ui.addFeed(`Patched up at ${sp.name || 'the hospital'}`);
  respawning = false;
}
function respawn(first, sp) {
  interior.leave(); me.outside = null;
  me.x = sp.x; me.z = sp.z; me.h = sp.h; me.y = W.groundHeight(sp.x, sp.z); me.vy = 0;
  if (!first && eco.cash > 0) { const bill = Math.min(eco.cash, Math.max(50, Math.round(eco.cash * 0.1))); eco.cash -= bill; ui.addFeed(`Hospital bill: -$${bill}`); }
  me.hp = 100; me.dead = false; resetWanted(); me.enter = null; me.exitT = 0; me.reloadT = 0; me.swim = false; deathSpin = 0; me.rag = null;
  release(me.ch);
  me.ch.body.rotation.set(0, 0, 0); me.ch.body.position.y = 0;
  camYaw = sp.h;
  ui.el.dead.hidden = true;
  canvas.classList.remove('dead');
  me.ch.g.rotation.set(0, me.h, 0);
}

// G: say hi to whoever's in front of you. H: insult them (some people swing back).
function talk(nice) {
  if (me.dead || me.veh || interior.room) return;
  let best = null, bd = 7;
  for (const w of walkers) {
    if (w.dead || w.mode === 'flee' || w.mode === 'gone') continue;
    const dx = w.x - me.x, dz = w.z - me.z, d = Math.hypot(dx, dz);
    if (d < bd && Math.abs(angDiff(me.h, Math.atan2(dx, dz))) < 1) { bd = d; best = w; }
  }
  say(me, nice ? ['Hey!', 'Hi there!', "How's it going?", 'Nice day!'][Math.floor(Math.random() * 4)] : ['Nice shirt... not.', 'Move it!', 'What are you looking at?', 'Hey, loser!'][Math.floor(Math.random() * 4)]);
  if (!best) return;
  setTimeout(() => {
    if (best.dead) return;
    best.h = Math.atan2(me.x - best.x, me.z - best.z);
    if (nice) say(best, line('greet'));
    else if (best.temper !== 'normal' && Math.random() < 0.6) provoke(best);
    else say(best, line('insulted'));
  }, 500);
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
  const occupied = v.mode === 'traffic' || v.npcDriver || (v.driver && v.driver !== net.uid);
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
  if (v.mode === 'traffic' || v.npcDriver) { freeTraffic(v, true); v.npcDriver = false; spawnFleeing(d.x, d.z, v.h + Math.PI / 2, 1.2); }
  else if (v.driver && v.driver !== net.uid) { sendEvent('jack', { to: v.driver, id: v.id }); ui.announce('CARJACKED', nameOf(v.driver)); }
  if (v.patrol || v.T.police) report('hitcop', v.x, v.z); // dragging a cop out of a squad car
  eco.jacked++; checkCountGoals();
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
  if (v.T.police) goalDone('copcar');
}
// Getting out: slow = step out through the door, fast = bail and tumble.
function leaveVehicle() {
  const v = me.veh;
  const sp = Math.hypot(v.vx, v.vz);
  if (sp > 9 && !v.T.bike) {
    const lx = Math.cos(v.h), lz = -Math.sin(v.h);
    ejectMe();
    const bv = { x: v.vx * 0.55 + lx * 3, y: 3, z: v.vz * 0.55 + lz * 3 };
    if (!knockMe(bv, 2)) me.rag = { t: 1.8, vx: bv.x, vy: bv.y, vz: bv.z, spin: 6, landed: false };
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
  me.x = p.x; me.z = p.z; me.y = W.isLand(p.x, p.z) ? W.groundHeight(p.x, p.z) : W.SWIM_Y; me.vy = 0; me.h = v.h;
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
  { const t = W.rayGround(o.x, o.y, o.z, d.x, d.y, d.z, Math.min(best.t, maxT)); if (t < best.t) best = { t, kind: 'ground' }; }
  const test = (t, kind, ref, head) => { if (t < best.t) best = { t, kind, ref, head }; };
  const near = (x, z) => Math.abs(x - o.x) < maxT && Math.abs(z - o.z) < maxT;
  for (const w of walkers) {
    if (w.dead || !near(w.x, w.z)) continue;
    const wy = w.y || 0;
    test(raySphere(o.x, o.y, o.z, d.x, d.y, d.z, w.x, wy + 1.05, w.z, 0.48), 'walker', w, false);
    test(raySphere(o.x, o.y, o.z, d.x, d.y, d.z, w.x, wy + 1.72, w.z, 0.26), 'walker', w, true);
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
    else if (u.kind === 2) { if (near(u.x, u.z)) { const uy = u.y || 0; test(raySphere(o.x, o.y, o.z, d.x, d.y, d.z, u.x, uy + 1.05, u.z, 0.48), 'cop', u, false); test(raySphere(o.x, o.y, o.z, d.x, d.y, d.z, u.x, uy + 1.72, u.z, 0.26), 'cop', u, true); } }
    else test(raySphere(o.x, o.y, o.z, d.x, d.y, d.z, u.x, u.y, u.z, 2.8), 'cop', u);
  }
  best.p = { x: o.x + d.x * best.t, y: o.y + d.y * best.t, z: o.z + d.z * best.t };
  return best;
}
function applyHit(hit, w, d) {
  if (hit.kind === 'walker') ui.hitMarker(hurtWalker(hit.ref, w.dmg * (hit.head ? 2.5 : 1), d.x, d.z, hit.p, w.pellets ? 2.2 : w.name === 'Rifle' ? 4.5 : 3));
  else if (hit.kind === 'player') {
    sendEvent('hit', { to: hit.ref.uid, dmg: r1(w.dmg * (hit.head ? 2 : 1)), by: me.name });
    fx.blood(hit.p.x, hit.p.y, hit.p.z, d.x, d.z); fx.soundHit(); ui.hitMarker(false);
  } else if (hit.kind === 'veh') damageVehicle(hit.ref, w.dmg * 0.45 * (hit.ref.T.bulletproof ? 0.4 : 1));
  else if (hit.kind === 'cop') damageCopUnit(hit.ref, w.dmg * (hit.ref.kind === 2 ? (hit.head ? 2.5 : 1) : 0.6));
}
function handPos() {
  if (me.veh) return { x: me.veh.x, y: me.veh.y + 1.4, z: me.veh.z };
  const mz = muzzleOf(me.ch); if (mz) return { x: mz.x, y: mz.y, z: mz.z };
  return { x: me.x + Math.sin(me.h) * 0.6 - Math.cos(me.h) * 0.35, y: me.y + 1.35, z: me.z + Math.cos(me.h) * 0.6 + Math.sin(me.h) * 0.35 };
}
function fire(w) {
  me.cd = 1 / w.rate;
  if (w.melee) { me.swing = 1; me.h = camYaw; melee(w); return; }
  const a = ammoOf(me.weapon);
  if (me.reloadT > 0) return;
  if (a.mag <= 0) { if (a.res > 0) startReload(); else { fx.soundClick(); ui.flashPrompt('Out of ammo. Buy more at Arnett Arms.'); } return; }
  a.mag--;
  if (w.grenade) { if (a.mag <= 0 && a.res > 0) { a.mag = 1; a.res--; } throwGrenade(w.molotov ? 'molotov' : 'nade'); refreshWeaponHud(); return; }
  if (w.rocket) { if (a.mag <= 0 && a.res > 0) startReload(); fireRocket(); refreshWeaponHud(); return; }
  me.aimT = 0.8;
  if (!me.veh) me.h = camYaw;
  const { o, d } = aimRay();
  const from = handPos();
  let last = null;
  for (let i = 0; i < (w.pellets || 1); i++) {
    const dd = spread(d, w.spread * (aiming ? 1 : 2.2) * (me.veh ? 1.6 : 1));
    const hit = raycast(o, dd, w.range);
    applyHit(hit, w, dd);
    bulletMarks(hit, dd);
    if (i < 3) fx.tracer(from, hit.p);
    last = hit.p;
  }
  me.shotSeq++; me.shot = [last.x, last.y, last.z];
  fx.muzzleFlash(from);
  fx.soundShot(w.name === 'Sniper' ? 'sniper' : w.snd);
  me.recoil = 1;
  if (!w.rocket && !me.veh) fx.casing({ x: from.x - Math.sin(me.h) * 0.25, y: from.y + 0.03, z: from.z - Math.cos(me.h) * 0.25 }, { x: -Math.cos(me.h), z: Math.sin(me.h) });
  if (performance.now() - lastAttack > 1000) report('gunfire'); else lastAttack = performance.now();
  if (w.name === 'Shotgun' || w.name === 'Rifle') shake = Math.max(shake, 0.12);
  if (a.mag <= 0 && a.res > 0) startReload();
  refreshWeaponHud();
  panicNear(me.x, me.z, 30); startle(me.x, me.z, 30); scareTraffic(me.x, me.z, 60);
}
// Where a bullet ends: holes and dust on walls and the ground, sparks off metal, and blood sprayed
// onto the wall or the road behind whoever got hit.
function bulletMarks(hit, d) {
  const p = hit.p;
  if (hit.kind === 'wall') fx.impact(p, W.wallNormal(p.x, p.y, p.z), 'wall');
  else if (hit.kind === 'ground') fx.impact(p, { x: 0, y: 1, z: 0 }, 'ground');
  else if (hit.kind === 'veh' || (hit.kind === 'cop' && hit.ref.kind !== 2)) fx.impact(p, { x: -d.x, y: -d.y, z: -d.z }, 'metal');
  else if (hit.kind === 'walker' || hit.kind === 'player' || hit.kind === 'cop') {
    const t = W.rayBuildings(p.x, p.y, p.z, d.x, d.y, d.z, 3.5);
    if (t < 3.5) { const q = { x: p.x + d.x * t, y: p.y + d.y * t, z: p.z + d.z * t }; fx.mark('splat', q, W.wallNormal(q.x, q.y, q.z), 0.8 + Math.random() * 0.5); }
    else if (Math.random() < 0.6) { const gx = p.x + d.x * 1.5, gz = p.z + d.z * 1.5; if (W.isLand(gx, gz)) fx.mark('splat', { x: gx, y: W.groundHeight(gx, gz) + 0.03, z: gz }, { x: 0, y: 1, z: 0 }, 0.7); }
  }
}
function melee(w) {
  const fx_ = Math.sin(me.h), fz_ = Math.cos(me.h);
  const inFront = (x, z) => { const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz); return d < w.range && (dx * fx_ + dz * fz_) / (d || 1) > 0.35; };
  lastAttack = performance.now();
  for (const wk of walkers) if (!wk.dead && inFront(wk.x, wk.z)) { const k = hurtWalker(wk, w.dmg, fx_, fz_, null, w.name === 'Bat' ? 7.5 : w.force || (Math.random() < 0.25 ? 6 : 3)); if (!k) report('assault', wk.x, wk.z); ui.hitMarker(k); fx.soundHit(); return; }
  for (const u of police.cops.values()) if (u.kind === 2 && !u.dead && inFront(u.x, u.z)) { damageCopUnit(u, w.dmg); fx.soundHit(); return; }
  for (const r of remotes.values()) if (!r.dead && !r.veh && inFront(r.x, r.z)) {
    sendEvent('hit', { to: r.uid, dmg: w.dmg, by: me.name }); report('assault', r.x, r.z); fx.blood(r.x, r.y + 1.3, r.z, fx_, fz_); fx.soundHit(); return;
  }
}
const nadeGeo = new THREE.SphereGeometry(0.15, 6, 5);
const rocketGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.8, 8).rotateX(Math.PI / 2), bottleGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.3, 8);
// g.kind: 'nade' (bounces, 2.4 s fuse) | 'molotov' (smashes and burns) | 'rocket' (flies straight, blows on contact)
function spawnNade(g) {
  g.kind = g.kind || 'nade';
  g.m = weaponModel(g.kind === 'rocket' ? 'rocket' : g.kind === 'molotov' ? 'molotov' : 'grenade') || new THREE.Mesh(g.kind === 'rocket' ? rocketGeo : g.kind === 'molotov' ? bottleGeo : nadeGeo, mat(0x2e7d32));
  if (g.kind === 'rocket') g.m.lookAt(g.m.position.x + g.vx, g.m.position.y + g.vy, g.m.position.z + g.vz);
  scene.add(g.m); grenades.push(g);
}
function throwGrenade(kind = 'nade') {
  me.swing = 1;
  camera.getWorldDirection(tmpDir);
  const p = handPos();
  const g = { x: p.x, y: p.y + 0.3, z: p.z, vx: tmpDir.x * 17, vy: tmpDir.y * 17 + 4, vz: tmpDir.z * 17, t: kind === 'molotov' ? 6 : 2.4, mine: true, kind };
  spawnNade(g);
  sendEvent('nade', { x: r1(g.x), y: r1(g.y), z: r1(g.z), vx: r1(g.vx), vy: r1(g.vy), vz: r1(g.vz), k: kind });
}
function fireRocket() {
  me.aimT = 0.8; if (!me.veh) me.h = camYaw;
  const { d } = aimRay(), p = handPos();
  const g = { x: p.x + d.x, y: p.y + d.y, z: p.z + d.z, vx: d.x * 55, vy: d.y * 55, vz: d.z * 55, t: 4, mine: true, kind: 'rocket' };
  spawnNade(g);
  sendEvent('nade', { x: r1(g.x), y: r1(g.y), z: r1(g.z), vx: r1(g.vx), vy: r1(g.vy), vz: r1(g.vz), k: 'rocket' });
  fx.soundShot('shotgun'); shake = Math.max(shake, 0.25);
  report('gunfire'); panicNear(me.x, me.z, 40); scareTraffic(me.x, me.z, 80);
}
// burning patches left by Molotovs
const fires = [];
function molotovFire(x, y, z, mine) {
  const holder = new THREE.Group(); holder.position.set(x, y, z); scene.add(holder);
  fires.push({ x, y, z, t: 7, mine, fire: fx.startFire(holder), holder });
  fx.soundBoom(distCam(x, z) * 2.5);
  scare(x, z, 25, 'attack');
  if (mine) report('assault', x, z);
}
function updateFires(dt) {
  for (let i = fires.length - 1; i >= 0; i--) {
    const f = fires[i]; f.t -= dt;
    if (Math.random() < dt * 3) fx.smokePuff(f.x + (Math.random() - 0.5) * 3, f.y + 0.3, f.z + (Math.random() - 0.5) * 3);
    const burns = (x, z) => Math.hypot(x - f.x, z - f.z) < 3.2;
    if (!me.dead && !me.veh && burns(me.x, me.z)) damageMe(22 * dt, f.mine ? 'a Molotov' : 'a fire', '');
    if (f.mine) {
      for (const w of walkers) if (!w.dead && burns(w.x, w.z)) { w.burnT = (w.burnT || 0) + dt; if (w.burnT > 0.5) { w.burnT = 0; hurtWalker(w, 12, 0, 0, null, 1); } }
      for (const v of vehicles) if (!v.exploded && !v.burnAt && burns(v.x, v.z) && v !== me.veh) { v.hp = Math.min(v.hp, -v.T.hp * 0.5); v.burnAt = net.now(); v.burnBy = net.uid; v.mode = 'free'; writeVeh(v, true); }
    }
    if (f.t <= 0) { fx.stopFire(f.fire); scene.remove(f.holder); fires.splice(i, 1); }
  }
}
function updateGrenades(dt) {
  updateFires(dt);
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    if (g.kind === 'rocket') { // straight line until it hits something
      const sp = Math.hypot(g.vx, g.vy, g.vz), dx = g.vx / sp, dy = g.vy / sp, dz = g.vz / sp, step = sp * dt;
      const hit = raycast({ x: g.x, y: g.y, z: g.z }, { x: dx, y: dy, z: dz }, step);
      g.t -= dt;
      if (hit.t < step || g.t <= 0) { scene.remove(g.m); grenades.splice(i, 1); if (g.mine) boom(hit.p.x, hit.p.y, hit.p.z, me.name, net.uid); else fx.explosion(hit.p.x, hit.p.y, hit.p.z); continue; }
      g.x += dx * step; g.y += dy * step; g.z += dz * step;
      g.m.position.set(g.x, g.y, g.z); g.m.lookAt(g.x + dx, g.y + dy, g.z + dz);
      if (Math.random() < 0.7) fx.smokePuff(g.x, g.y, g.z, true, 0.4);
      continue;
    }
    g.vy -= 18 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
    const land = W.isLand(g.x, g.z), gy = land ? W.groundHeight(g.x, g.z) + 0.07 : W.WATER_Y - 0.15;
    if (g.y < gy) {
      g.y = gy;
      if (g.kind === 'molotov') { scene.remove(g.m); grenades.splice(i, 1); fx.glass(g.x, g.y, g.z, 10); if (land) molotovFire(g.x, gy, g.z, g.mine); continue; }
      if (land) { g.vy = -g.vy * 0.35; g.vx *= 0.6; g.vz *= 0.6; } else { g.vx *= 0.2; g.vz *= 0.2; g.vy = 0; }
    }
    const p = W.pushOutCircle(g.x, g.z, 0.15);
    if (p.hit) { const vn = g.vx * p.nx + g.vz * p.nz; if (vn < 0) { g.vx -= 1.6 * vn * p.nx; g.vz -= 1.6 * vn * p.nz; } g.x = p.x; g.z = p.z; }
    g.m.position.set(g.x, g.y, g.z);
    g.t -= dt;
    if (g.t <= 0) {
      scene.remove(g.m); grenades.splice(i, 1);
      if (g.mine) boom(g.x, g.y, g.z, me.name, net.uid);
    }
  }
}

// The freight train and the barges don't stop for anyone.
function trainAndBargeHits(dt) {
  if (me.dead) return;
  const px = me.veh ? me.veh.x : me.x, pz = me.veh ? me.veh.z : me.z;
  const big = [];
  for (const c of trainCars) if (c.active && Math.abs(c.x - px) < 30 && Math.abs(c.z - pz) < 30) big.push(c);
  for (const b of bargeList()) if (Math.abs(b.x - px) < 140 && Math.abs(b.z - pz) < 140) big.push(b);
  for (const o of big) {
    if (me.veh) {
      const i = collideVehicles(me.veh, o, false);
      if (i > 0) { crashFx(me.veh, me.veh.hit); if (i > 6) damageVehicle(me.veh, (i - 4) * 3, me.veh.hit); }
    } else if (!me.ch.rag) {
      const q = pushCharOut(me.x, me.z, 0.4, o);
      if (Math.hypot(q.x - me.x, q.z - me.z) > 1e-3) {
        me.x = q.x; me.z = q.z;
        if (o.len && Math.hypot(o.vx, o.vz) > 2 && me.hitCd <= 0) { damageMe(260, 'a freight train', '', { x: o.vx * 1.5 + (q.x - o.x), y: 6, z: o.vz * 1.5 + (q.z - o.z) }); me.hitCd = 1; }
      }
    }
  }
}
// Stairwells (the rooftop helipad): a quick fade and you're there.
const fadeEl = Object.assign(document.createElement('div'), { id: 'fade' });
Object.assign(fadeEl.style, { position: 'fixed', inset: '0', background: '#000', opacity: '0', pointerEvents: 'none', transition: 'opacity .35s', zIndex: '50' });
document.body.append(fadeEl);
function doorNear() { if (me.veh || me.dead) return null; for (const d of doors) if (Math.hypot(d.x - me.x, d.z - me.z) < 2.2 && Math.abs(d.y - me.y) < 3) return d; return null; }
function useDoor(d) {
  fadeEl.style.opacity = '1';
  setTimeout(() => { me.x = d.to.x; me.z = d.to.z; me.y = d.to.y; me.vy = 0; me.h = d.to.h; camYaw = d.to.h; fadeEl.style.opacity = '0'; }, 380);
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
      // tap: they brake and lean on the horn. Real hit: the car is knocked loose with the driver still in it.
      // Big crash: the driver jumps out and runs.
      if (i0 < 4) { bumpTraffic(o); if (!o.honkCd || performance.now() > o.honkCd) { fx.soundHorn(distCam(o.x, o.z)); o.honkCd = performance.now() + 1500; } }
      else { freeTraffic(o, false, i0 < 13); if (pb) applyBump(o, pb); }
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

// Traffic: local to each player (see traffic.js). Cars stop for anyone in front of them unless that
// person is wanted or just attacked someone, and pull over for police chasing a suspect.
const allCars = [];
function updateTraffic(dt, tSec) {
  const nowP = performance.now();
  const obs = [];
  if (playing && !me.dead && !me.veh && !(wanted.stars > 0 || nowP - lastAttack < 15000)) obs.push({ x: me.x, z: me.z, r: 0.5, person: true });
  for (const r of remotes.values()) {
    if (r.dead || r.vehObj || r.stars > 0 || nowP - (r.lastShot || -1e9) < 15000) continue;
    obs.push({ x: r.x, z: r.z, r: 0.5, person: true });
  }
  for (const w of walkers) if (!w.dead && w.mode !== 'gone') obs.push({ x: w.x, z: w.z, r: 0.45, person: true });
  for (const d of fx.debrisList) obs.push({ x: d.m.position.x, z: d.m.position.z, r: 0.6 });
  for (const c of closedCrossings()) obs.push({ x: c.x, z: c.z, r: c.e.width / 2 + 1, hl: 4, h: c.rh + Math.PI / 2 });
  for (const c of trainCars) if (c.active) obs.push({ x: c.x, z: c.z, r: 1.6, hl: c.len / 2, h: c.h });
  allCars.length = 0; allCars.push(...vehicles);
  const sirens = [];
  const chase = wanted.stars > 0 || [...remotes.values()].some((r) => r.stars > 0);
  for (const u of police.cops.values()) if (u.kind < 2 && !police.isDown(u)) { allCars.push(u.v); if (chase && u.kind === 0) sirens.push({ x: u.v.x, z: u.v.z }); }
  for (const v of vehicles) if (v.T.siren && v.sirenOn) sirens.push({ x: v.x, z: v.z });
  const fxp = me.veh ? me.veh.x : me.x, fzp = me.veh ? me.veh.z : me.z;
  camera.getWorldDirection(tmpDir);
  const q = activeQuality, night = weather.night > 0.5;
  const count = Math.round((q === 'low' ? 14 : q === 'medium' ? 30 : 42) * (night ? 0.6 : 1));
  const patrols = wanted.stars > 0 ? 0 : Math.round((q === 'low' ? 1 : q === 'medium' ? 2 : 3) * (night ? 1.5 : 1));
  tickTraffic(dt, { x: fxp, z: fzp }, { x: camera.position.x, z: camera.position.z, fx: tmpDir.x, fz: tmpDir.z }, obs, sirens, tSec, { radius: q === 'low' ? 200 : q === 'medium' ? 260 : 320, count, night, patrols });
  // patrol cars nearby join the chase once you're wanted
  if (wanted.stars > 0 && isHost) for (const v of [...traffic]) if (v.patrol && v.mode === 'traffic' && Math.hypot(v.x - fxp, v.z - fzp) < 260) { const i = vehicles.indexOf(v); if (i >= 0) vehicles.splice(i, 1); vehById.delete(v.id); police.adoptCar(v, net.uid); }
  updateSignals(tSec);
}

// beyond this distance a car is drawn as a simple instanced silhouette
const farCarDist = () => (activeQuality === 'low' ? 45 : activeQuality === 'medium' ? 70 : 95) * (weather.night > 0.5 ? 1.6 : 1);
function updateVehicles(dt, tSec, nowMs) {
  updateTraffic(dt, tSec);
  farCarsBegin();
  const FAR = farCarDist(), cx = camera.position.x, cz = camera.position.z;
  for (const v of vehicles) {
    const head = v.mesh.userData.driverHead;
    if (v.mode === 'traffic') {
      if (head) head.visible = true;
    } else {
      if (head) {
        head.visible = (!!v.driver || !!v.npcDriver) && !v.exploded;
        // a driver whose car got knocked loose: stays in and honks, or climbs out angry
        if (v.npcDriver && v.npcOutT > 0 && v.speed < 1 && me.enter?.v !== v) {
          v.npcOutT -= dt;
          if (v.npcOutT <= 0) {
            if (v.npcAngry) { v.npcDriver = false; const lx = Math.cos(v.h), lz = -Math.sin(v.h); spawnFleeing(v.x + lx * 1.7, v.z + lz * 1.7, v.h + Math.PI / 2, 0, true); }
            else fx.soundHorn(distCam(v.x, v.z));
          }
        }
        if (v.driver && v.headFor !== v.driver) {
          v.headFor = v.driver;
          const look = v.driver === net.uid ? me.look : net.players[v.driver]?.c;
          if (Array.isArray(look)) { const L = normLook(look); head.material = mat(SKIN_TONES[L[3]]); }
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
      if (nowMs - v.burnAt > 12000 && (v.burnBy === net.uid || (isHost && nowMs - v.burnAt > 16000))) explodeVehicle(v);
    }
    if (v.exploded && !v.charred) { v.charred = true; fx.stopFire(v.fire); v.fire = null; charVehicle(v); }
    if (v.doorCloseAt && performance.now() > v.doorCloseAt) { v.doorOpen = 0; v.doorCloseAt = 0; }
    const dl = v.mesh.userData.parts && v.mesh.userData.parts.doorL;
    if (dl) { v.doorAng = (v.doorAng || 0) + ((v.doorOpen ? 1.15 : 0) - (v.doorAng || 0)) * Math.min(1, dt * 9); dl.rotation.y = -v.doorAng; }
    v.mesh.position.set(v.x, v.y, v.z);
    v.mesh.rotation.y = v.h;
    const isFar = v !== me.veh && !v.fire && Math.hypot(v.x - cx, v.z - cz) > FAR && farCarAdd(v);
    v.mesh.visible = !isFar;
    if (isFar) continue;
    const body = v.mesh.userData.body;
    body.rotation.z = v.T.bike ? (v.driver ? v.tilt : 0.3) : 0;
    body.rotation.x = v.T.boat || v.T.heli ? v.pitch || 0 : v.air > 0.05 ? clamp(-(v.vy || 0) * 0.025, -0.35, 0.35) + (v.gp || 0) : v.gp || 0;
    if (!v.T.bike && !v.T.heli && !v.T.boat) body.rotation.z = v.gr || 0;
    if (v.T.heli) { body.rotation.z = v.tilt || 0; const rt = v.mesh.userData.rotor; if (rt) rt.rotation.y += dt * (v.driver || v.y > 0.5 ? 32 : 0); }
    if (v.hp < v.T.hp * 0.35 && !v.exploded && (v.hp > 0 || Math.random() < 0.6) && Math.abs(v.x - camera.position.x) < 120 && Math.abs(v.z - camera.position.z) < 120) fx.damageSmoke(v);
  }
}

function updatePlayer(dt) {
  const px = me.x, pz = me.z;
  if (me.ch.rag) {
    // ragdolled: the body is physics-driven; we just follow it
    const p = ragPos(me.ch); me.x = p.x; me.z = p.z; me.y = W.isLand(p.x, p.z) ? W.groundHeight(p.x, p.z) : W.SWIM_Y;
    me.ch.g.visible = true; me.moveSpeed = 0;
    if (me.dead && performance.now() - me.deadAt > 5200) beginRespawn();
    me.vx = (me.x - px) / dt; me.vz = (me.z - pz) / dt;
    return;
  }
  if (me.dead) {
    me.deadT = 5 - (performance.now() - me.deadAt) / 1000;
    animateCharacter(me.ch, dt, { dead: true });
    me.ch.g.visible = true;
    placeCharacter(me.ch, me.x, me.y, me.z, me.h);
    if (me.deadT <= 0) beginRespawn();
    return;
  }
  me.cd -= dt; me.hitCd -= dt; me.aimT = Math.max(0, me.aimT - dt);
  if (me.reloadT > 0) {
    me.reloadT -= dt;
    if (me.reloadT <= 0) { const w = WEAPONS[me.weapon], a = ammoOf(me.weapon), n = Math.min(w.mag - a.mag, a.res); a.mag += n; a.res -= n; refreshWeaponHud(); }
  }
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
  if (!knockMe({ x: vx, y: vy, z: vz }, 2.6)) me.rag = { t: 2.6, vx, vy, vz, spin: 8 + Math.random() * 5, landed: false };
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
  const land = W.isLand(me.x, me.z), gy = land ? W.groundHeight(me.x, me.z) : W.SWIM_Y;
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
  const speed = me.swim ? 2.6 : aiming ? 2.6 : sprint ? 8 : 4.5;
  const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
  let mx = Math.sin(camYaw) * fwd + rx * side, mz = Math.cos(camYaw) * fwd + rz * side;
  const ml = Math.hypot(mx, mz);
  if (ml > 0) { mx /= ml; mz /= ml; }
  const wk = WEAPONS[me.weapon].kind;
  const aimPose = wk === 'gun' && !me.swim && (aiming || me.aimT > 0);
  if (ml > 0 || aimPose || me.swing > 0) {
    const target = aimPose || me.swing > 0 ? camYaw : Math.atan2(mx, mz);
    me.h += angDiff(me.h, target) * Math.min(1, dt * 12);
  }
  const ox = me.x, oz = me.z;
  me.x += mx * speed * dt; me.z += mz * speed * dt;
  // walls of earth: steep steps block you (but you can climb out of the river onto the bank)
  if (!interior.room && (W.offMap(me.x, me.z) || (W.isLand(me.x, me.z) && W.surfaceHeight(me.x, me.z, me.y) - me.y > (me.swim ? 1.9 : 0.7)))) { me.x = ox; me.z = oz; }
  const p = W.pushOutCircle(me.x, me.z, 0.4, me.y);
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
    if (moved && vs > 6 && me.hitCd <= 0 && (v.mode === 'traffic')) { damageMe(vs * 2.5, 'traffic', '', { x: v.vx * 0.8, y: 3.5, z: v.vz * 0.8 }); me.hitCd = 1; }
  }
  const land = !!interior.room || W.isLand(me.x, me.z);
  me.vy -= 20 * dt;
  me.y += me.vy * dt;
  if (land) {
    me.swim = false;
    const gh = interior.room ? interior.room.y : W.surfaceHeight(me.x, me.z, me.y); // roofs count when you're on them
    if (me.y <= gh + 0.05 && me.vy <= 0) { me.y = gh; me.vy = 0; me.grounded = true; } else me.grounded = false;
    if (me.grounded && keys.has('Space')) { me.vy = 6.5; me.grounded = false; }
  } else {
    if (me.y <= W.SWIM_Y) { me.y = W.SWIM_Y; me.vy = 0; me.swim = true; }
    me.grounded = false;
  }
  me.moveSpeed = ml > 0 ? speed : 0;
  me.ch.g.visible = true;
  me.ch.g.position.set(me.x, me.y, me.z);
  me.ch.g.rotation.set(0, me.h, 0);
  const wpn = WEAPONS[me.weapon];
  me.recoil = Math.max(0, (me.recoil || 0) - dt * 8);
  animateCharacter(me.ch, dt, { speed: aimPose ? Math.min(me.moveSpeed, 3) : me.moveSpeed, aim: aimPose, swim: me.swim, swing: me.swing, weapon: me.swim ? 'none' : wk, wmodel: me.swim ? null : wpn.model, rifle: wpn.long, recoil: me.recoil, reload: me.reloadT > 0 ? 1 - me.reloadT / (wpn.name === 'Shotgun' ? 1.8 : 1.3) : 0, pitch: aimPose ? -camPitch * 57 : 0, carry: !aimPose && wpn.long });
}

function driveUpdate(dt, fwd, side) {
  const v = me.veh;
  const pre = { vx: v.vx, vz: v.vz, speed: v.speed };
  const shift = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const imp = stepVehicle(v, { throttle: fwd > 0 ? 1 : 0, brake: fwd < 0 ? 1 : 0, steer: -side, handbrake: !v.T.heli && keys.has('Space'), nitro: shift && !v.T.heli, up: keys.has('Space'), down: shift }, dt);
  if (v.boosting) { fx.sparks(v.x - Math.sin(v.h) * v.T.len / 2, v.y + 0.4, v.z - Math.cos(v.h) * v.T.len / 2, 2, -Math.sin(v.h), -Math.cos(v.h)); if (!v.boostSnd) { fx.soundNitro(); v.boostSnd = true; } } else v.boostSnd = false;
  if (v.T.boat && Math.abs(v.speed) > 6 && Math.random() < 0.5) fx.smokePuff(v.x - Math.sin(v.h) * v.T.len / 2, -0.1, v.z - Math.cos(v.h) * v.T.len / 2, true, 0.6);
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
    if (frontal && !v.T.boat && !v.T.heli && (v.T.bike ? pre.speed > 14 && dv > 8 : pre.speed > 28 && dv > 18)) {
      damageVehicle(v, (total - 7) * 3, mainHit);
      launchMe(v, pre.vx * 0.7, 5, pre.vz * 0.7);
      return;
    }
  }
  if (v.landed > 14) total = Math.max(total, v.landed * 0.8);
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
    for (const w of walkers) if (!w.dead && Math.abs(w.x - v.x) < 5 && Math.abs(w.z - v.z) < 5 && hits(w.x, w.z)) hurtWalker(w, Math.abs(v.speed) * 5, Math.sin(v.h), Math.cos(v.h), null, Math.abs(v.speed) * 0.9 + 3);
    for (const u of police.cops.values()) if (u.kind === 2 && !u.dead && Math.abs(u.x - v.x) < 5 && Math.abs(u.z - v.z) < 5 && hits(u.x, u.z) && !u.ranOver) { u.ranOver = true; damageCopUnit(u, Math.abs(v.speed) * 5); setTimeout(() => { u.ranOver = false; }, 800); }
    const now = performance.now();
    for (const r of remotes.values()) {
      if (r.dead || r.veh || (r.hitCd || 0) > now || Math.abs(r.x - v.x) > 5 || Math.abs(r.z - v.z) > 5 || !hits(r.x, r.z)) continue;
      sendEvent('hit', { to: r.uid, dmg: r1(Math.abs(v.speed) * 3), by: me.name, ix: r1(v.vx * 0.8), iz: r1(v.vz * 0.8) });
      fx.blood(r.x, r.y + 1, r.z, Math.sin(v.h), Math.cos(v.h));
      r.hitCd = now + 1000;
    }
  }
  if (v.sinkT > 2.5 && !v.exploded) {
    v.exploded = true; v.hp = 0; v.burnAt = net.now(); writeVeh(v, true);
    ejectMe(); me.y = W.SWIM_Y; me.swim = true;
    return;
  }
  me.x = v.x; me.z = v.z; me.y = Math.max(W.SWIM_Y, v.y); me.h = v.h; me.vx = v.vx; me.vz = v.vz; me.moveSpeed = 0;
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
    const lk = JSON.stringify(p.c || null);
    if (r.lookKey === undefined) r.lookKey = lk;
    else if (r.lookKey !== lk && Array.isArray(p.c) && !r.ch.rag) { r.lookKey = lk; const pos = r.ch.g.position.clone(); scene.remove(r.ch.g); r.ch = makeCharacter(p.c); r.ch.g.add(r.tag); r.ch.g.position.copy(pos); scene.add(r.ch.g); }
    const k = Math.min(1, dt * 10), ox = r.x, oz = r.z;
    r.x += (s[0] - r.x) * k; r.y += (s[1] - r.y) * k; r.z += (s[2] - r.z) * k; r.h += angDiff(r.h, s[3]) * k;
    r.vx = (r.x - ox) / dt; r.vz = (r.z - oz) / dt;
    r.speed = s[4]; r.veh = s[5] || ''; r.hp = s[6]; r.dead = s[6] <= 0; r.stars = s[7] || 0; r.weapon = s[8] || 0;
    r.search = !!s[13]; r.lkx = s[14] ?? r.x; r.lkz = s[15] ?? r.z;
    if (s[9] !== r.seq) {
      r.seq = s[9]; r.lastShot = performance.now();
      fx.tracer({ x: r.x + Math.sin(r.h) * 0.6, y: r.y + 1.35, z: r.z + Math.cos(r.h) * 0.6 }, { x: s[10], y: s[11], z: s[12] });
      fx.soundShot(WEAPONS[r.weapon]?.snd || 'pistol', distCam(r.x, r.z));
      panicNear(r.x, r.z, 30); startle(r.x, r.z, 30); scareTraffic(r.x, r.z, 60);
    }
    const vo = r.veh ? vehById.get(r.veh) : null;
    r.vehObj = vo;
    const wk = WEAPONS[r.weapon]?.kind || 'none';
    if (vo) {
      r.ch.g.visible = !!vo.T.bike;
      if (vo.T.bike) { r.ch.g.position.set(vo.x - Math.sin(vo.h) * 0.25, vo.y + 0.2, vo.z - Math.cos(vo.h) * 0.25); r.ch.g.rotation.set(0, vo.h, 0); animateCharacter(r.ch, dt, { sit: true, weapon: wk }); }
    } else if ((r.dead || s[16]) && !r.ch.rag) {
      ragdoll(r.ch, { x: r.vx * 0.6, y: 2, z: r.vz * 0.6 }, { dead: true }); // their computer simulates the real fall
    } else if (r.ch.rag) {
      if (!r.dead && !s[16]) release(r.ch);
    } else {
      r.ch.g.visible = true;
      placeCharacter(r.ch, r.x, r.y, r.z, r.h);
      const sw = r.y < W.SWIM_Y + 0.4;
      animateCharacter(r.ch, dt, { speed: r.speed, aim: wk === 'gun', swim: sw, dead: r.dead, weapon: sw ? 'none' : wk, wmodel: sw ? null : WEAPONS[r.weapon]?.model ?? null, rifle: !!WEAPONS[r.weapon]?.long });
    }
    r.tagT = (r.tagT || 0) - dt;
    if (r.tagT <= 0) { r.tagT = 0.3; const d = Math.hypot(r.x - camera.position.x, r.z - camera.position.z); r.tagOn = !r.dead && d < 40 && W.lineOfSight(camera.position.x, camera.position.y, camera.position.z, r.x, r.y + 2.2, r.z); }
    r.tag.visible = !!r.tagOn;
  }
  for (const [uid, r] of remotes) if (!net.players[uid]) { scene.remove(r.ch.g); remotes.delete(uid); ui.addFeed(`${r.name} left`); }
}

let peakStars = 0, survive5 = 0, robberyPrompt = '';
function updateWantedLevel(dt) {
  peakStars = Math.max(peakStars, wanted.stars);
  if (tickWanted(dt, me) === 'lost') { ui.announce('COPS LOST', '', '#7cf29a'); if (peakStars >= 4) goalDone('lose4'); if (peakStars >= 5) goalDone('lose5'); peakStars = 0; }
  if (wanted.stars === 0) peakStars = 0;
  updateRobbery(dt);
}
// Robbing: inside, point a gun at the clerk (or the casino cashier) and keep it there.
// Corner stores: the clerk hits the silent alarm partway through. The casino calls it in at once.
function updateRobbery(dt) {
  robberyPrompt = '';
  const R = interior.room;
  if (!R || !R.clerk || (R.kind !== 'rob' && R.kind !== 'casino')) return;
  const st = R.store, w = WEAPONS[me.weapon], c = R.clerk;
  if (st.cooldown > 0) { R.held = false; if (aiming) robberyPrompt = R.kind === 'casino' ? 'The cage is empty. Come back later.' : 'The till is empty. Come back later.'; return; }
  const facing = Math.abs(angDiff(camYaw, Math.atan2(c.x - me.x, c.z - me.z))) < 0.35 && Math.hypot(c.x - me.x, c.z - me.z) < 16;
  R.held = aiming && w.kind === 'gun' && facing;
  if (!R.held) { st.progress = Math.max(0, (st.progress || 0) - dt * 0.15); if (st.progress > 0) robberyPrompt = `Keep aiming at the ${R.kind === 'casino' ? 'cashier' : 'clerk'}`; return; }
  st.progress = (st.progress || 0) + dt / (R.kind === 'casino' ? 14 : 8);
  if (!st.alarm && (R.kind === 'casino' || st.progress > 0.35)) {
    st.alarm = true; st.alarmed = true;
    crime(R.kind === 'casino' ? 'casino' : 'robbery', st.x, me.outside ? me.outside.y : me.y, st.z);
    ui.help(R.kind === 'casino' ? 'Casino security called it in. The whole department is coming.' : 'The clerk hit the silent alarm. Grab the cash and get out!', 4);
  }
  const bars = Math.round(Math.min(1, st.progress) * 10);
  robberyPrompt = `Robbing ${st.name}  ${'▮'.repeat(bars)}${'▯'.repeat(10 - bars)}`;
  if (st.progress >= 1) {
    const take = R.kind === 'casino' ? 2500 + Math.floor(Math.random() * 2000) : 150 + Math.floor(Math.random() * 300);
    st.progress = 0; st.cooldown = R.kind === 'casino' ? 900 : 300; st.alarm = false; R.held = false;
    addCash(take);
    if (R.kind === 'casino') goalDone('casino'); else { eco.robbed++; checkCountGoals(); }
    ui.announce(R.kind === 'casino' ? 'CASINO ROBBED' : 'STORE ROBBED', `${st.name} · +$${take}`, '#8fe38a');
    fx.soundCash();
  }
}
const storesRobbing = new Set();

// Shops you walk (or drive) into with E. Returns true if a shop opened.
function storeAt(x, z, r) { const c = !me.veh && cartNear(x, z, 3.5); return c ? { kind: 'food', name: 'Hot dog cart', x: c.x, z: c.z } : storeNear(x, z, r); }
function enterRoom(st) {
  fadeEl.style.opacity = '1';
  setTimeout(() => {
    me.outside = { x: st.x, z: st.z, y: W.groundHeight(st.x, st.z), h: st.face + Math.PI };
    const p = interior.enter(st, me.outside.y);
    me.x = p.x; me.y = p.y; me.z = p.z; me.vy = 0; me.h = 0; camYaw = 0;
    fadeEl.style.opacity = '0';
  }, 350);
}
function leaveRoom() {
  fadeEl.style.opacity = '1';
  setTimeout(() => {
    if (interior.room) interior.room.store.alarmed = false;
    interior.leave();
    const o = me.outside || { x: me.x, z: me.z, y: W.groundHeight(me.x, me.z), h: 0 };
    me.x = o.x + Math.sin(o.h) * 1.2; me.z = o.z + Math.cos(o.h) * 1.2; me.y = o.y; me.vy = 0; me.h = o.h; camYaw = o.h; me.outside = null;
    fadeEl.style.opacity = '0';
  }, 350);
}
function useStore() {
  if (me.dead || me.enter) return false;
  if (interior.room) {
    if (interior.nearExit(me.x, me.z)) { leaveRoom(); return true; }
    if (interior.nearCounter(me.x, me.z) && interior.room.kind === 'guns') { openShop('Arnett Arms', gunShopItems()); return true; }
    if (interior.nearCounter(me.x, me.z) && interior.room.kind === 'clothes') { openShop(interior.room.store.name, clothingItems()); return true; }
    return true;
  }
  const st = storeAt(me.veh ? me.veh.x : me.x, me.veh ? me.veh.z : me.z, me.veh ? 7 : 3.2);
  if (!st) return false;
  if (st.kind === 'body' && me.veh && !me.veh.T.boat && !me.veh.T.heli) { bodyShop(me.veh); return true; }
  if (me.veh) return false;
  if (st.kind === 'guns' || st.kind === 'rob' || st.kind === 'clothes' || st.kind === 'casino') { enterRoom(st); return true; }
  if (st.kind === 'food') { if (me.hp >= 100) { ui.flashPrompt("You're not hungry"); return true; } if (!spend(8)) { ui.flashPrompt('A hot dog is $8'); return true; } me.hp = Math.min(100, me.hp + 30); fx.soundCash(); ui.flashPrompt('Hot dog: +30 health'); return true; }
  if (st.kind === 'meds') { openShop('Hospital Pharmacy', [{ label: 'Patch me up', sub: 'Full health', price: 60, ok: () => me.hp < 100, buy: () => { me.hp = 100; } }]); return true; }
  return false;
}
function gunShopItems() {
  const items = [];
  WEAPONS.forEach((w, i) => {
    if (i === 0) return;
    if (!me.owned.has(i)) items.push({ label: w.name, sub: w.melee ? 'Melee weapon' : `Comes with ${w.ammoPack} ${w.grenade ? 'grenades' : 'rounds'}`, price: w.price, buy: () => { me.owned.add(i); if (!w.melee) { const a = ammoOf(i); if (w.grenade) { a.mag = 1; a.res = w.ammoPack - 1; } else { a.mag = w.mag; a.res = w.ammoPack - w.mag; } } selectWeapon(i); } });
    else if (!w.melee) items.push({ label: `${w.name} ammo`, sub: `+${w.ammoPack} ${w.grenade ? 'grenades' : 'rounds'}`, price: w.ammoPrice, buy: () => { ammoOf(i).res += w.ammoPack; refreshWeaponHud(); } });
  });
  items.push({ label: 'Body armor', sub: 'Soaks up most incoming damage', price: 250, ok: () => me.armor < 100, buy: () => { me.armor = 100; } });
  return items;
}
// Arnett Auto: repairs, paint and wheels, performance, armor. Upgrades belong to that car.
function modT(v) { if (!v.T.own) v.T = { ...v.T, own: true }; return v.T; }
function rebuildCar(v) { scene.remove(v.mesh); v.mesh = makeVehicleMesh(v.T, v.color); scene.add(v.mesh); applyDamageVisual(v); if (v.rims) paintRims(v); v.headFor = ''; }
function paintRims(v) { for (const w of v.mesh.userData.parts.wheels) w.children.forEach((c, i) => { if (i === 1) c.material = mat(v.rims); }); }
function bodyShop(v) { openShop('Arnett Auto', autoItems(v)); }
function autoItems(v) {
  const done = (k) => v.mods && v.mods[k];
  const mod = (k, f) => () => { v.mods = v.mods || {}; v.mods[k] = true; f(modT(v)); ui.announce('UPGRADED', v.T.name); };
  const paint = (name, c) => ({ label: `Paint: ${name}`, sub: 'Fresh coat, same car', price: 100, buy: () => { v.color = c; rebuildCar(v); writeVeh(v, true); } });
  return [
    { label: 'Repair', sub: 'Fix the body, engine and glass (the cops still know your face)', price: 150, ok: () => v.hp < v.T.hp || v.dz.f + v.dz.b + v.dz.l + v.dz.r > 0, buy: () => { v.hp = v.T.hp; v.dz = { f: 0, b: 0, l: 0, r: 0 }; v.burnAt = 0; rebuildCar(v); writeVeh(v, true); } },
    paint('Arnett Red', 0xc62828), paint('River Blue', 0x1565c0), paint('Midnight Black', 0x111214), paint('Pearl White', 0xf2f2f0), paint('Cornfield Gold', 0xe0a526), paint('Bluff Green', 0x2e7d32),
    { label: 'Wheels: chrome', sub: 'Shiny rims', price: 120, buy: () => { v.rims = 0xeceff1; paintRims(v); } },
    { label: 'Wheels: gold', sub: 'Flashy rims', price: 180, buy: () => { v.rims = 0xd4af37; paintRims(v); } },
    { label: 'Engine tune', sub: '+20% top speed and acceleration', price: 600, ok: () => !done('engine'), buy: mod('engine', (T) => { T.max *= 1.2; T.acc *= 1.2; }) },
    { label: 'Race brakes', sub: 'Stop much shorter', price: 300, ok: () => !done('brakes'), buy: mod('brakes', (T) => { T.brakeMul = 1.5; }) },
    { label: 'Sport tires', sub: 'More grip in corners', price: 400, ok: () => !done('grip'), buy: mod('grip', (T) => { T.grip *= 1.3; T.turn *= 1.08; }) },
    { label: 'Bigger nitro tank', sub: 'Boost lasts twice as long', price: 350, ok: () => !done('nitro'), buy: mod('nitro', (T) => { T.nitroMul = 2; }) },
    { label: 'Armor plating', sub: 'Takes half the damage', price: 800, ok: () => !done('armor'), buy: mod('armor', (T) => { T.armor = 0.5; T.hp *= 1.5; v.hp = T.hp; }) },
    { label: 'Bulletproof tires', sub: 'Gunfire barely scratches it', price: 500, ok: () => !done('bp'), buy: mod('bp', (T) => { T.bulletproof = true; }) },
  ];
}
// ---- clothing store: Tim's Threads (outfits, a barber, tattoos and masks)
const COLS = [['White', 0], ['Black', 1], ['Grey', 2], ['Navy', 4], ['Blue', 5], ['Red', 7], ['Maroon', 8], ['Green', 9], ['Olive', 10], ['Khaki', 11], ['Brown', 12], ['Gold', 14], ['Orange', 15], ['Pink', 16], ['Purple', 17], ['Teal', 18]];
const HAIR_COLS = [['Black', 0], ['Dark brown', 1], ['Brown', 3], ['Auburn', 4], ['Blonde', 6], ['Grey', 7], ['Pink', 10], ['Blue', 11]];
const NAMES = { tee: 'T-shirt', tank: 'Tank top', polo: 'Polo', shirt_s: 'Short-sleeve shirt', shirt_l: 'Dress shirt & tie', hoodie: 'Hoodie', zip: 'Zip jacket', suit: 'Suit jacket', sweater: 'Sweater', flannel: 'Flannel', track: 'Track jacket', blouse: 'Blouse', varsity: 'Varsity jacket', coat: 'Winter coat', hivis: 'Hi-vis vest',
  jeans: 'Jeans', slacks: 'Slacks', shorts: 'Shorts', cargo: 'Cargo pants', sweats: 'Sweatpants', skirt: 'Skirt', sneaker: 'Sneakers', dress: 'Dress shoes', boot: 'Boots',
  short: 'Short', crew: 'Crew cut', buzz: 'Buzz cut', curly: 'Curly', afro: 'Afro', mohawk: 'Mohawk', balding: 'Bald patch', long: 'Long', bob: 'Bob', shoulder: 'Shoulder length', pony: 'Ponytail', bun: 'Bun', dreads: 'Dreadlocks',
  cap: 'Baseball cap', beanie: 'Beanie', hard: 'Hard hat', full: 'Full beard', goatee: 'Goatee', mustache: 'Mustache', shades: 'Sunglasses', clear: 'Glasses', ski: 'Ski mask', tim: 'Tim Arnett mask' };
function setLook(look) {
  me.look = look;
  const g = me.ch.g, pos = g.position.clone(), rot = g.rotation.y;
  scene.remove(g); me.ch = makeCharacter(look); scene.add(me.ch.g); me.ch.g.position.copy(pos); me.ch.g.rotation.y = rot;
  netSetLook(look);
}
function clothingItems() {
  const L = () => normLook(me.look).slice();
  const items = [], put = (label, price, k, v, sub) => items.push({ label, sub, price, buy: () => { const l = L(); for (let i = 0; i < k.length; i++) l[k[i]] = v[i]; setLook(l); } });
  for (const n of ['tee', 'tank', 'polo', 'shirt_s', 'shirt_l', 'hoodie', 'zip', 'suit', 'sweater', 'flannel', 'track', 'blouse', 'varsity', 'coat', 'hivis']) put(`Top: ${NAMES[n]}`, 40, [6], [TOPS.indexOf(n)]);
  for (const [n, c] of COLS) put(`Top colour: ${n}`, 10, [7], [c]);
  for (const [n, c] of COLS) put(`Second colour: ${n}`, 10, [8], [c], 'Stripes, collars, the shirt under a jacket');
  for (const n of ['jeans', 'slacks', 'shorts', 'cargo', 'sweats', 'skirt']) put(`Bottoms: ${NAMES[n]}`, 40, [9], [BOTTOMS.indexOf(n)]);
  for (const [n, c] of [['Denim', 4], ['Light denim', 19], ['Black', 1], ['Grey', 2], ['Khaki', 11], ['Brown', 13], ['Olive', 10], ['White', 0]]) put(`Bottoms colour: ${n}`, 10, [10], [c]);
  for (const n of ['sneaker', 'dress', 'boot']) put(`Shoes: ${NAMES[n]}`, 30, [11], [SHOES.indexOf(n)]);
  for (const [n, c] of [['White', 0], ['Black', 1], ['Brown', 12], ['Red', 7], ['Blue', 5]]) put(`Shoe colour: ${n}`, 10, [12], [c]);
  for (const n of ['cap', 'beanie', 'hard']) put(`Hat: ${NAMES[n]}`, 25, [13], [HATS.indexOf(n)]);
  for (const [n, c] of COLS.slice(0, 8)) put(`Hat colour: ${n}`, 5, [14], [c]);
  put('No hat', 0, [13], [0]);
  for (const n of ['shades', 'clear']) put(NAMES[n], 20, [15], [GLASSES.indexOf(n)]);
  put('No glasses', 0, [15], [0]);
  for (const n of ['short', 'crew', 'buzz', 'curly', 'afro', 'mohawk', 'long', 'bob', 'shoulder', 'pony', 'bun', 'dreads', 'balding']) put(`Barber: ${NAMES[n]}`, 25, [4], [HAIRS.indexOf(n)]);
  put('Barber: Shave it all off', 15, [4], [0]);
  for (const [n, c] of HAIR_COLS) put(`Hair dye: ${n}`, 15, [5], [c]);
  for (const n of ['full', 'goatee', 'mustache']) put(`Barber: ${NAMES[n]}`, 15, [16], [BEARDS.indexOf(n)]);
  put('Barber: Clean shave', 10, [16], [0]);
  put('Tattoo: Arm sleeves', 120, [17], [1], 'Shows with short sleeves');
  put('Laser tattoo removal', 60, [17], [0]);
  put('Mask: Ski mask', 60, [18], [MASKS.indexOf('ski')], 'Witnesses can\'t describe you... well, they can describe the mask');
  put('Mask: Tim Arnett', 80, [18], [MASKS.indexOf('tim')], 'Vote Tim');
  put('Take off the mask', 0, [18], [0]);
  return items;
}
// ---- phone: call a mechanic to drop a car off near you
function openPhone() {
  if (!playing || me.dead || interior.room) return;
  const car = (label, ti, price) => ({ label, sub: 'Delivered to the nearest street', price, buy: () => deliverCar(ti, label) });
  openShop('Phone: Arnett Auto mechanic', [car('Sedan', V.SEDAN, 100), car('Hatchback', V.HATCH, 90), car('SUV', V.SUV, 150), car('Pickup', V.PICKUP, 150), car('Motorbike', V.BIKE, 120), car('Sports car', V.SPORTS, 300), car('Muscle car', V.MUSCLE, 400), car('Monster truck', V.MONSTER, 900)]);
}
let deliverN = 0;
function deliverCar(ti, label) {
  const sp = W.roadSpot(me.x, me.z, 25, 60) || { x: me.x + 6, z: me.z, h: 0 };
  const v = makeVehicle(newId('d'), ti, [0xc62828, 0x1565c0, 0x111214, 0xf2f2f0, 0xe0a526][Math.floor(Math.random() * 5)], sp);
  v.stolenOnce = true; v.keep = true; scene.add(v.mesh); vehicles.push(v); vehById.set(v.id, v);
  waypoint = { x: sp.x, z: sp.z }; gpsRoute = null; routeT = 0;
  ui.addFeed(`Your ${label} is parked nearby (follow the GPS)`);
  setTimeout(() => { v.keep = false; }, 120000);
}
let shopOpen = false;
function openShop(title, items) {
  shopOpen = true; paused = true; keys.clear(); mouseDown = false;
  document.exitPointerLock?.();
  const el = document.getElementById('shop'), list = document.getElementById('shopItems');
  document.getElementById('shopTitle').textContent = title;
  const render = () => {
    list.innerHTML = '';
    for (const it of items) {
      const li = document.createElement('li'), b = document.createElement('button');
      b.innerHTML = `<span>${it.label}<small>${it.sub || ''}</small></span><span class="price">$${it.price}</span>`;
      b.disabled = eco.cash < it.price || (it.ok && !it.ok());
      b.addEventListener('click', () => { if (spend(it.price)) { it.buy(); fx.soundCash(); ui.setCash(eco.cash); if (title === 'Arnett Arms') items = gunShopItems(); render(); } });
      li.append(b); list.append(li);
    }
  };
  render();
  el.hidden = false;
  ui.el.pause.hidden = true;
}
function closeShop() { shopOpen = false; paused = false; document.getElementById('shop').hidden = true; lockMouse(); }
document.getElementById('shopClose').addEventListener('click', closeShop);

let deathSpin = 0, camLag = null;
function updateCamera(dt) {
  const spd = me.veh ? Math.abs(me.veh.speed) : 0;
  const aimZoom = aiming && !me.dead && WEAPONS[me.weapon].kind === 'gun';
  const fov = aimZoom ? (WEAPONS[me.weapon].scope ? 16 : 48) : 70 + clamp(spd - 15, 0, 30) * 0.45 + (me.veh && me.veh.boosting ? 8 : 0);
  // soft lock-on keeps the crosshair on your target while you hold aim
  if (aimZoom && me.lockOn) {
    const lp = lockPos(me.lockOn);
    if (!lp) me.lockOn = null;
    else {
      const c = camera.position, dx = lp.x - c.x, dz = lp.z - c.z;
      camYaw += angDiff(camYaw, Math.atan2(dx, dz)) * Math.min(1, dt * 9);
      camPitch += (-Math.atan2(lp.y - c.y, Math.hypot(dx, dz)) - camPitch) * Math.min(1, dt * 9);
    }
  }
  if (Math.abs(camera.fov - fov) > 0.1) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
  if (me.dead) { deathSpin += dt; camYaw += dt * 0.35; camPitch += (1.0 - camPitch) * Math.min(1, dt * 1.2); }
  // the chase cam trails the car a little (springy), so turns and speed read clearly
  let tx = me.veh ? me.veh.x : me.x, tz = me.veh ? me.veh.z : me.z;
  const ty = me.veh ? me.veh.y + 1.7 : me.swim ? W.WATER_Y - 0.15 : me.y + 1.6 + (aimZoom ? 0.08 : 0);
  if (me.veh && !me.veh.T.heli) {
    if (!camLag || Math.hypot(camLag.x - tx, camLag.z - tz) > 20) camLag = { x: tx, z: tz };
    const k = 1 - Math.exp(-dt * 9);
    camLag.x += (tx - camLag.x) * k; camLag.z += (tz - camLag.z) * k;
    tx = camLag.x; tz = camLag.z;
  } else camLag = null;
  // hold C to look behind you while driving
  if (me.veh && keys.has('KeyC')) camYaw = me.veh.h + Math.PI + (me.lookBack ? 0 : 0) , me.lookBack = true;
  else if (me.lookBack) { me.lookBack = false; if (me.veh) camYaw = me.veh.h; }
  if (me.veh && !me.lookBack && performance.now() - lastMouse > 1200 && Math.abs(me.veh.speed) > 3) {
    camYaw += angDiff(camYaw, me.veh.speed > 0 ? me.veh.h : me.veh.h + Math.PI) * Math.min(1, dt * (1.6 + Math.min(2.4, Math.abs(me.veh.speed) * 0.08)));
  }
  const dist = me.veh ? (me.veh.T.heli ? 16 : 4.6 + me.veh.T.len + Math.min(4, spd * 0.09)) : me.dead ? 5 + deathSpin * 4 : aimZoom ? 2.3 : 4.2;
  const cp = Math.cos(camPitch), dx = Math.sin(camYaw) * cp, dy = -Math.sin(camPitch), dz = Math.cos(camYaw) * cp;
  const sh = me.veh ? 0 : aimZoom ? 0.85 : 0.55, ax = tx - Math.cos(camYaw) * sh, az = tz + Math.sin(camYaw) * sh;
  const back = W.rayBuildings(ax, ty, az, -dx, -dy, -dz, dist);
  const d = Math.max(0.8, Math.min(dist, back - 0.3));
  const camX = ax - dx * d, camZ = az - dz * d;
  const floorY = interior.room ? interior.room.y + 0.35 : W.isLand(camX, camZ) ? W.groundHeight(camX, camZ) + 0.35 : W.WATER_Y + 0.2;
  camera.position.set(camX, Math.max(floorY, ty - dy * d), camZ);
  camera.lookAt(ax + dx * 20, ty + dy * 20, az + dz * 20);
  followSun(tx, ty, tz);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 2.5);
  }
}

function policePlayers() {
  const arr = [{ uid: net.uid, x: me.x, y: me.y, z: me.z, vx: me.vx, vz: me.vz, speed: Math.hypot(me.vx, me.vz), stars: wanted.stars, alive: !me.dead, inVeh: !!me.veh, search: wanted.search, lkx: wanted.lk.x, lkz: wanted.lk.z }];
  for (const r of remotes.values()) arr.push({ uid: r.uid, x: r.x, y: r.y, z: r.z, vx: r.vx, vz: r.vz, speed: Math.hypot(r.vx, r.vz), stars: r.stars, alive: !r.dead, inVeh: !!r.veh, search: r.search, lkx: r.lkx, lkz: r.lkz });
  return arr;
}
// What townspeople see: is the player armed, and who (if anyone) is the gun pointed at?
let threatState = null, threatT = 0, aimCopT = 0;
function updateThreat(dt) {
  threatT -= dt;
  if (threatT > 0) return;
  threatT = 0.15;
  const w = WEAPONS[me.weapon];
  if (!playing || me.dead || me.veh || paused) { threatState = null; return; }
  const armed = w.kind === 'gun' || w.kind === 'bat' || w.name === 'Knife';
  let aimAt = null;
  if (aiming && w.kind === 'gun') {
    if (me.lockOn && me.lockOn.ref && walkers.includes(me.lockOn.ref)) aimAt = me.lockOn.ref;
    else {
      let best = 0.14;
      for (const p of walkers) {
        if (p.dead || p.ch.rag) continue;
        const dx = p.x - me.x, dz = p.z - me.z, d = Math.hypot(dx, dz);
        if (d > 40) continue;
        const off = Math.abs(angDiff(camYaw, Math.atan2(dx, dz)));
        if (off < best && W.lineOfSight(me.x, me.y + 1.5, me.z, p.x, (p.y || 0) + 1.4, p.z)) { best = off; aimAt = p; }
      }
    }
    // pointing a gun at a cop is a crime all by itself
    const cop = me.lockOn && me.lockOn.ref && police.cops.has(me.lockOn.ref.id) ? me.lockOn.ref : null;
    aimCopT = cop ? aimCopT + 0.15 : 0;
    if (aimCopT > 1 && wanted.stars === 0) { report('assault', me.x, me.z); aimCopT = -5; }
  }
  threatState = armed ? { x: me.x, z: me.z, armed: w.kind === 'gun', aimAt } : null;
}
// where the camera is and which way it looks (so people and cars appear out of sight)
const camDir = new THREE.Vector3();
function camView() { camera.getWorldDirection(camDir); const l = Math.hypot(camDir.x, camDir.z) || 1; return { x: camera.position.x, z: camera.position.z, fx: camDir.x / l, fz: camDir.z / l }; }
setNpcContext({
  focus: () => (playing ? { x: me.veh ? me.veh.x : me.x, z: me.veh ? me.veh.z : me.z } : W.places.menu),
  quality: () => activeQuality,
  threat: () => threatState,
  target: () => (playing && !me.dead ? { x: me.veh ? me.veh.x : me.x, y: me.veh ? me.veh.y : me.y, z: me.veh ? me.veh.z : me.z, dead: me.dead, inVeh: !!me.veh } : null),
  hitPlayer: (dmg, by, w) => damageMe(dmg, by, '', w && w.hostile === 'melee' && Math.random() < 0.2 ? { x: Math.sin(w.h) * 6, y: 2, z: Math.cos(w.h) * 6 } : null),
  vehicles: () => movingVehicles,
  shot: (w, to) => { const from = { x: w.x + Math.sin(w.h) * 0.5, y: (w.y || 0) + 1.4, z: w.z + Math.cos(w.h) * 0.5 }; fx.tracer(from, to); fx.muzzleFlash(from); fx.soundShot('pistol', distCam(w.x, w.z)); },
});
initTraffic(scene, {
  newId,
  vehicles: () => allCars,
  add: (v) => { scene.add(v.mesh); vehicles.push(v); vehById.set(v.id, v); },
  remove: (v) => resetVehicle(v),
  honk: (v) => fx.soundHorn(distCam(v.x, v.z)),
});
initEmergency(scene, {
  newId,
  vehicles: () => vehicles,
  add: (v) => { scene.add(v.mesh); vehicles.push(v); vehById.set(v.id, v); },
  remove: (v) => resetVehicle(v),
  revive: (w) => { if (revive(w)) ui.addFeed('Paramedics revived someone'); },
  extinguish: (v) => { v.burnAt = 0; v.burnBy = ''; fx.stopFire(v.fire); v.fire = null; v.hp = Math.max(v.hp, -v.T.hp * 0.3); writeVeh(v, true); },
});
interior.initInteriors(scene);
initEvents({
  newId,
  vehicles: () => vehicles,
  add: (v) => { scene.add(v.mesh); vehicles.push(v); vehById.set(v.id, v); },
  reward: (amount, text) => { addCash(amount); ui.announce('GOOD SAMARITAN', `${text} · +$${amount}`, '#7cf29a'); fx.soundCash(); },
  alarm: (v) => { v.alarmUntil = performance.now() / 1000 + 4.5; let n = 0; const iv = setInterval(() => { fx.soundHorn(distCam(v.x, v.z)); if (++n > 6) clearInterval(iv); }, 600); },
});
initLandmarks(scene, {
  onCasino: (door, face) => stores.push({ name: 'The Arnett Belle', kind: 'casino', x: door.x, z: door.z, face, cooldown: 0, progress: 0 }),
  addHeli: (x, y, z) => { const v = makeVehicle('heli-roof', V.HELI, 0x263238, { x, z, h: 0 }); v.y = y; v.keep = true; scene.add(v.mesh); vehicles.push(v); vehById.set(v.id, v); },
  addBoat: (x, z, h) => { const v = makeVehicle(`boat_${Math.round(x)}_${Math.round(z)}`, V.BOAT, [0xffffff, 0xe5484d, 0x1e88e5][Math.floor(Math.random() * 3)], { x, z, h }); v.y = W.WATER_Y - 0.35; v.keep = true; scene.add(v.mesh); vehicles.push(v); vehById.set(v.id, v); },
  horn: (x, z) => fx.soundHorn(distCam(x, z) * 0.6),
});
police.initPolice(scene, {
  extraViewers: () => patrolViewers(),
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
    if ((wrecked || abandoned) && !anyoneNear(v, 90)) { removeVehicle(v.id); resetVehicle(v); }
  }
}

let sendT = 0, uiT = 0, mmT = 0;
function updateHud(dt, t) {
  uiT -= dt;
  if (uiT <= 0) {
    uiT = 0.2;
    ui.setHealth(me.hp);
    ui.setCash(eco.cash);
    ui.setArmor(me.armor);
    if (wanted.stars >= 5 && !me.dead) { survive5 += 0.2; if (survive5 >= 60) goalDone('survive5'); } else survive5 = 0;
    if (ui.setStars(wanted.stars, wanted.search)) { ui.announce('WANTED', '★'.repeat(wanted.stars), '#ff5e5b'); fx.soundWanted(); }
    ui.setSpeedo(me.veh, me.veh && !me.veh.T.bike ? currentStation().name : '', me.veh ? me.veh.nitro ?? 1 : 0);
    const [area, street] = W.areaAt(me.veh ? me.veh.x : me.x, me.veh ? me.veh.z : me.z); ui.showArea(area, street);
    if (waypoint && Math.hypot(waypoint.x - me.x, waypoint.z - me.z) < 25) { waypoint = null; gpsRoute = null; ui.help('You reached your waypoint.', 3, false); }
    const wk = WEAPONS[me.weapon];
    ui.el.crosshair.classList.toggle('off', me.dead || (!!me.veh && wk.kind !== 'gun') || (!me.veh && wk.melee));
    if (wanted.stars > 0) ui.help('<b>Wanted!</b> Get out of police sight. While they search, their vision cones show red on the minimap.', 7);
    if (weather.night > 0.6) ui.help('Night has fallen. Streetlights and headlights are on, and the cops see less in the dark.', 5);
    if (weather.rain > 0.4) ui.help('Rain makes the roads slippery. Brake earlier.', 5);
    ui.setClock(clockText(), weather.weather, weather.night > 0.5);
    const host = hostUid();
    const list = [{ name: me.name, me: true, host: host === net.uid, stars: wanted.stars }];
    for (const r of remotes.values()) list.push({ name: r.name, host: host === r.uid, stars: r.stars });
    ui.setPlayers(net.room, list, net.online);
  }
  let prompt = robberyPrompt;
  if (!me.dead && !prompt) {
    const st = storeAt(me.veh ? me.veh.x : me.x, me.veh ? me.veh.z : me.z, me.veh ? 7 : 3.2);
    if (interior.room) prompt = interior.nearExit(me.x, me.z) ? 'E: Leave' : interior.nearCounter(me.x, me.z) && interior.room.kind === 'guns' ? 'E: Buy weapons' : interior.nearCounter(me.x, me.z) && interior.room.kind === 'clothes' ? 'E: Try on clothes' : interior.room.clerk && (interior.room.kind === 'rob' || interior.room.kind === 'casino') && !robberyPrompt ? `Aim a gun at the ${interior.room.kind === 'casino' ? 'cashier' : 'clerk'} (right click) to rob ${interior.room.store.name}` : '';
    else if (st && st.kind === 'food') prompt = 'E: Buy a hot dog ($8, +30 health)';
    else if (st && (st.kind === 'guns' || st.kind === 'clothes' || st.kind === 'rob' || st.kind === 'casino') && !me.veh) prompt = `E: Go into ${st.name}`;
    else if (st && st.kind === 'meds' && !me.veh) prompt = 'E: Pharmacy (heal $60)';
    else if (st && st.kind === 'body' && me.veh && !me.veh.T.boat && !me.veh.T.heli) prompt = 'E: Arnett Auto (repairs & upgrades)';
  }
  if (!me.dead && !prompt) { const d = doorNear(); if (d) prompt = `E: ${d.label}`; }
  if (!me.dead && !prompt) {
    if (me.veh) prompt = '';
    else if (!me.enter) { const v = nearestVehicle(4.5); if (v) prompt = Math.hypot(v.vx || 0, v.vz || 0) > 3.5 ? '' : `E: ${v.mode === 'traffic' || v.driver ? 'Carjack' : 'Enter'} ${v.T.name}`; }
  }
  ui.setPrompt(prompt);
  mmT -= dt;
  if (mmT <= 0) {
    mmT = 0.1;
    const flash = Math.floor(t * 4) % 2 ? '#ff1744' : '#2979ff';
    const blips = [];
    for (const h of W.places.hospitals) if (Math.abs(h.x - me.x) < 400 && Math.abs(h.z - me.z) < 400) blips.push({ x: h.x, z: h.z, color: '#e53935', size: 6, shape: 'square', label: '+' });
    for (const r of remotes.values()) if (!r.dead) blips.push({ x: r.x, z: r.z, color: '#40c4ff', size: 4.5 });
    for (const sb of storeList(false)) blips.push(sb);
    for (const e of eventBlips()) blips.push(e);
    for (const u of police.cops.values()) if (!police.isDown(u)) { const P = police.posOf(u); blips.push({ x: P.x, z: P.z, color: flash, size: u.kind === 3 ? 6 : u.kind === 2 ? 2.5 : 4 }); }
    const spd = me.veh ? Math.abs(me.veh.speed) : 0;
    ui.drawMinimap({ x: me.veh ? me.veh.x : me.x, z: me.veh ? me.veh.z : me.z, yaw: camYaw }, me, blips, spd > 15 ? 0.75 : 1.1, wanted.search ? cones() : null, waypoint, gpsRoute);
    // siren volume from the nearest active police unit
    let nd = Infinity;
    for (const u of police.cops.values()) if (!police.isDown(u) && u.kind !== 2) { const P = police.posOf(u); nd = Math.min(nd, Math.hypot(P.x - me.x, P.z - me.z)); }
    fx.setSiren(nd < 150 ? 1 - nd / 150 : 0);
  }
}

// Every car's lamps: headlights when it's dark or raining, brake/reverse/turn signals, light bars.
const lampList = [];
function updateLamps(n, t) {
  wetUniform.value = weather.wet * (1 - weather.snow) * (0.25 + 0.75 * n);
  const on = n > 0.05 || weather.rain > 0.3 || weather.fog > 0.3;
  const chase = wanted.stars > 0 || [...remotes.values()].some((r) => r.stars > 0);
  lampList.length = 0;
  const fwd = (keys.has('KeyS') || keys.has('ArrowDown'));
  for (const v of vehicles) {
    const mine = v === me.veh, driven = mine || !!v.driver || v.mode === 'traffic' || v.mode === 'service' || v.npcDriver;
    const hazard = (v.alarmUntil || 0) > t;
    if (!driven && !hazard) continue;
    let braking = v.braking, reversing = false;
    if (mine) { braking = (fwd && v.speed > 0.5) || keys.has('Space') || Math.abs(v.speed) < 0.3; reversing = v.speed < -0.4; }
    else if (v.driver) { braking = Math.abs(v.speed || 0) < 0.3; }
    lampList.push({ v, on: on && driven, braking: driven && braking, reversing, signal: hazard ? 2 : v.mode === 'traffic' ? v.signal : 0, bar: !!(v.T.siren && v.sirenOn) });
  }
  for (const u of police.cops.values()) if (u.kind < 2 && !police.isDown(u)) lampList.push({ v: u.v, on, braking: Math.abs(u.v.speed || 0) < 0.5, reversing: (u.v.speed || 0) < -0.4, signal: 0, bar: chase });
  updateCarLights(lampList, camera.position, Math.max(n, weather.rain * 0.5, weather.fog * 0.5), me.veh, t);
}

// Sky, weather, lights, wildlife and ambience. Runs in the menu too.
function updateWorldLife(dt, nowMs, t) {
  const thunder = updateDayNight(dt, nowMs, camera.position);
  if (thunder) setTimeout(() => fx.soundThunder(0.6 + Math.random() * 0.4), thunder * 1000);
  const n = weather.night;
  updateLamps(n, t);
  // tires through puddles throw spray
  if (weather.wet > 0.4 && weather.snow < 0.5) for (const v of vehicles) {
    const sp = Math.abs(v.speed || 0);
    if (sp < 7 || v.T.boat || v.T.heli || v.air || Math.random() > sp * 0.012) continue;
    const dx = v.x - camera.position.x, dz = v.z - camera.position.z; if (dx * dx + dz * dz > 60 * 60) continue;
    const side = Math.random() < 0.5 ? 1 : -1, bx_ = Math.cos(v.h) * side * v.T.wid * 0.45, bz_ = -Math.sin(v.h) * side * v.T.wid * 0.45;
    fx.splash(v.x + bx_ - Math.sin(v.h) * v.T.len * 0.35, v.y, v.z + bz_ - Math.cos(v.h) * v.T.len * 0.35, v.vx || 0, v.vz || 0, 3);
  }
  const threats = [];
  if (playing && !me.dead) threats.push({ x: me.x, z: me.z, r: me.veh ? 4 : 3.2 });
  for (const r of remotes.values()) threats.push({ x: r.x, z: r.z, r: 3.2 });
  for (const v of vehicles) if (v.speed > 3) threats.push({ x: v.x, z: v.z, r: 3.5 });
  updateLife(dt, threats, t);
  updateAnimals(dt, playing ? { x: me.veh ? me.veh.x : me.x, z: me.veh ? me.veh.z : me.z } : null, threats, t);
  if (Math.random() < 0.25) {
    const c = camera.position;
    let wet = 0; for (const [ox, oz] of [[0, 0], [45, 0], [-45, 0], [0, 45], [0, -45]]) if (!W.isLand(c.x + ox, c.z + oz)) wet++;
    const shore = (wet / 5) * 0.5;
    let walls = 0; for (let k = 0; k < 6; k++) { const a = k * 1.047; if (W.rayBuildings(c.x, c.y, c.z, Math.sin(a), 0, Math.cos(a), 35) < 35) walls++; }
    fx.setEcho(walls / 6); // street canyons echo
    fx.setAmbient({ hum: (1 - shore * 0.6) * (0.6 + 0.4 * weather.day), rain: weather.rain, waves: shore, crickets: n * (1 - weather.rain), birds: weather.day * (1 - weather.rain) * (1 - weather.night) });
  }
}

let movingVehicles = [], physT = 0;
function update(dt, t) {
  if (wheelOpen && remotes.size === 0) dt *= 0.3; // slow motion while choosing a weapon (solo only)
  if (me.dead && remotes.size === 0) { const k = (performance.now() - me.deadAt) / 1000; dt *= k < 3 ? 0.28 : Math.min(1, 0.28 + (k - 3) * 0.5); }
  const nowMs = net.now(), tSec = nowMs / 1000;
  movingVehicles = vehicles.filter((v) => Math.abs(v.vx || 0) + Math.abs(v.vz || 0) > 5 && !v.sinkT);
  for (const u of police.cops.values()) if (u.kind < 2 && Math.abs(u.v.vx || 0) + Math.abs(u.v.vz || 0) > 5) movingVehicles.push(u.v);
  updateNav(dt);
  updateThreat(dt);
  const fxp = me.veh ? me.veh.x : me.x, fzp = me.veh ? me.veh.z : me.z;
  W.updateWorld(fxp, fzp, dt);
  manageParked(dt, fxp, fzp);
  updateRoute(dt);
  physT -= dt; if (physT <= 0) { physT = 0.5; syncPhysics(fxp, fzp); }
  isHost = hostUid() === net.uid;
  updateVehicles(dt, tSec, nowMs);
  updatePlayer(dt);
  updateRemotes(dt);
  updateWalkers(dt, tSec, nowMs, camView());
  updateEmergency(dt, { x: me.veh ? me.veh.x : me.x, z: me.veh ? me.veh.z : me.z }, camView(), tSec);
  updateLandmarks(dt, tSec, { x: me.veh ? me.veh.x : me.x, z: me.veh ? me.veh.z : me.z }, weather.night);
  interior.updateRoom(dt, me, threatState);
  updateEvents(dt, { x: me.veh ? me.veh.x : me.x, z: me.veh ? me.veh.z : me.z }, camView(), wanted.stars > 0 || !!interior.room);
  // hiding: inside a shop or a parking ramp they lose you faster, unless they know you're in there (you just robbed it)
  me.pinned = !!(interior.room && interior.room.store.alarmed);
  me.hiding = !me.pinned && (!!interior.room || (!me.veh && W.buildingKindAt(me.x, me.z) === 1) || (me.veh && W.buildingKindAt(me.veh.x, me.veh.z) === 1));
  trainAndBargeHits(dt);
  if (isHost) { police.hostUpdate(dt, policePlayers()); hostChores(dt, nowMs); }
  for (const v of vehicles) if (v.pending) flushBump(v);
  police.render(dt, isHost, t, camera.position, farCarDist());
  farCarsEnd();
  updateGrenades(dt);
  updateWantedLevel(dt);
  updateRagdolls(dt);
  updateCamera(dt);
  updateWorldLife(dt, nowMs, t);
  updateEconomy(dt, me, t);
  updateRadio(!!me.veh && !me.veh.T.bike && !me.dead);
  fx.updateFx(dt);
  sendT -= dt;
  if (sendT <= 0) {
    sendT = 0.1;
    sendState([r1(me.x), r2(me.y), r1(me.z), r2(me.h), r1(me.moveSpeed), me.veh ? me.veh.id : '', Math.round(me.hp), wanted.stars, me.weapon, me.shotSeq, r1(me.shot[0]), r1(me.shot[1]), r1(me.shot[2]), wanted.search ? 1 : 0, r1(wanted.lk.x), r1(wanted.lk.z), me.ch.rag && !me.dead ? 1 : 0]);
  }
  updateHud(dt, t);
}

// Slow pan over the riverfront while the menu is open.
function menuCamera(t) {
  const p = W.places.menu, a = t * 0.05;
  camera.position.set(p.x + Math.cos(a) * 230, 115, p.z + Math.sin(a) * 230);
  camera.lookAt(p.x, 10, p.z - 160);
  followSun(p.x, 0, p.z);
  W.updateWorld(p.x, p.z, 0.016);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (playing) { update(dt, now / 1000); watchFps(dt); }
  else {
    const nowMs = net.now();
    updateVehicles(dt, nowMs / 1000, nowMs);
    farCarsEnd();
    updateNav(dt);
    updateWalkers(dt, nowMs / 1000, nowMs, camView());
    updateRagdolls(dt);
    updateLandmarks(dt, nowMs / 1000, W.places.menu, weather.night);
    menuCamera(now / 1000);
    updateWorldLife(dt, nowMs, now / 1000);
  }
  bloom.strength = 0.25 + weather.night * 0.55;
  composer.render();
}
requestAnimationFrame(frame);

