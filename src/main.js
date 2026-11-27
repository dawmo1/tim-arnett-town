import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as W from './world.js';
import { makeCharacter, animateCharacter, placeCharacter, randomLook, nameTag, mat, initCharacters, normLook, setProp, muzzleOf, weaponModel } from './character.js';
import { SKIN as SKIN_TONES, TOPS, BOTTOMS, HAIRS, HATS, CLOTH, HAIRC, SHOES, BEARDS, GLASSES, MASKS } from './people/looks.js';
import { createAllVehicles, makeParked, makeVehicle, V, TYPES, initFarCars, farCarsBegin, farCarAdd, farCarsEnd, stepVehicle, collideVehicles, pushCharOut, circles, charVehicle, damageZone, applyDamageVisual, repair, applyBump, animateDamage, tipLift } from './vehicles.js';
import { initTraffic, updateTraffic as tickTraffic, bumpTraffic, scareTraffic, updateSignals, traffic, patrolViewers } from './traffic.js';
import { initWalkers, updateWalkers, walkers, panicNear, spawnFleeing, scare, provoke, setNpcContext, cartNear, revive, incident, witnessFlee } from './npc.js';
import { joinTraffic } from './traffic.js';
import { GANGS } from './gangs.js';
import { initEmergency, updateEmergency, reportDown } from './emergency.js';
import { initLandmarks, updateLandmarks, doors, closedCrossings, trainCars, bargeList, landmarkMats } from './landmarks.js';
import * as interior from './interiors.js';
import { initVenues, useVenue, updateVenues, seatNear } from './venues.js';
import { initEvents, updateEvents, eventBlips, toggleJob } from './events.js';
import { say, line } from './npc.js';
import { initDayNight, updateDayNight, sky as weather, clockText, view as fogView } from './daynight.js';
import { initLife, updateLife, startle, updateAnimals } from './life.js';
import { loadAssets, geometryOf } from './assets.js';
import { animateWheels, setCarLamps } from './carmodel.js';
import { updateOccupants, emptyCar, setOccupantBudget } from './occupants.js';
import { initCarLights, updateCarLights, setLightQuality, wetUniform } from './carlights.js';
import { initPhysics, updateRagdolls, ragdoll, release, ragPos, syncPhysics, standUp } from './ragdoll.js';
import * as anim from './anim.js';
import * as combat from './combat.js';
import * as cover from './cover.js';
import * as swim from './swim.js';
import { initNav, updateNav } from './nav.js';
import { knock, flinch } from './npc.js';
import * as police from './police.js';
import { planeSpots, planeVisual } from './planes.js';
import { initBreakables, updateBreakables, setBreakQuality, hitByCar, blast as blastProps, shot as shootProps, benchNear } from './breakables.js';
import * as fx from './fx.js';
import * as ui from './ui.js';
import { net, connect, joinWorld, startPlaying, sendState, ensurePresence, watchCops, setVehicle, removeVehicle, setCops, sendEvent, sendChat, hostUid, setLook as netSetLook, setName as netSetName, setArea, loadProfile, saveProfile } from './net.js';
import { clamp, angDiff, rayOBB, raySphere, fmtDist } from './util.js';
import { wanted, crime, updateWanted as tickWanted, resetWanted, cones, initWanted, callCops } from './wanted.js';
import * as cj from './carjack.js';
import { eco, initEconomy, addCash, spend, goalDone, checkCountGoals, GOALS, storeNear, dropCash, updateEconomy, stores } from './economy.js';
import { updateRadio, nextStation, currentStation } from './radio.js';
import { drunk, drunkPass, drinkItems, resetDrunk, updateDrunk, wobble, drunkSteer, swayCamera, blackedOut } from './drunk.js';
import * as garage from './garage.js';
import * as ebikes from './ebike.js';
import { applyMods, modsOf, horn as modHorn, armorMul } from './carmods.js';
import * as phone from './phone.js';
import * as minigames from './minigames/index.js';
import { adm, initAdmin, isOpen as consoleOpen, openConsole, onAdminEvent } from './admin.js';

// Everyone owns every weapon (price is unused). mag/ammoPack: magazine size and rounds per purchase; ammoPrice: cost of one ammoPack
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
const r1 = (n) => Math.round(n * 10) / 10, r2 = (n) => Math.round(n * 100) / 100; const r3 = (n) => Math.round(n * 1000) / 1000;

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
// clamp blown-out pixels (shiny glass/wet road at a grazing angle) before bloom spreads them into black squares
composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main() { vec4 c = texture2D(tDiffuse, vUv); c.rgb = min(c.rgb, vec3(40.0)); if (c.r != c.r || c.g != c.g || c.b != c.b) c.rgb = vec3(0.0); gl_FragColor = c; }' }));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.88);
composer.addPass(bloom);
composer.addPass(drunkPass); // after bloom so the glow warps with the scene; disabled while sober
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
  weather.moonShadows = q === 'high';
  setLightQuality(q);
  setOccupantBudget(q === 'low' ? 4 : q === 'medium' ? 10 : 16);
  scene.userData.sky.material.uniforms.clouds.value = q === 'low' ? 0 : 1;
  // view distance + how much of the city is built in full detail
  camera.far = q === 'low' ? 900 : q === 'medium' ? 1500 : 2200; camera.updateProjectionMatrix();
  scene.userData.sky.scale.setScalar(camera.far * 0.9);
  fogView.near = camera.far * 0.2; fogView.far = camera.far * 0.88;
  W.setDetailRadius(q === 'low' ? 260 : q === 'medium' ? 400 : 520);
  W.setPropQuality(q); setBreakQuality(q);
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

// ---------- loading screen (TAT V): drifting full-screen art, the logo, a tip and a spinner ----------
// It covers the whole screen, so half-built streets never show. fade: just black + spinner (respawns).
const loader = document.getElementById('loader'), slidesEl = loader.querySelector('.slides');
// pictures come from a shuffled bag shared with index.html (which shows the first one before this code loads)
let artK = 0, artTimer = 0, loaderOut = 0;
function nextArt() {
  const url = `assets/load/art${window.tatNextArt() + 1}.jpg`, img = new Image();
  img.src = url; img.alt = '';
  img.decode().catch(() => {}).then(() => {
    if (loader.hidden || loader.classList.contains('fade')) return;
    const sl = document.createElement('div');
    sl.className = 'slide ' + (artK++ % 2 ? 'a' : 'b');
    const fill = document.createElement('div'); fill.className = 'fill'; fill.style.backgroundImage = `url(${url})`;
    sl.append(fill, img); slidesEl.append(sl);
    requestAnimationFrame(() => requestAnimationFrame(() => sl.classList.add('on')));
    const old = [...slidesEl.children].slice(0, -1);
    setTimeout(() => old.forEach((o) => o.remove()), 1600);
  });
}
// mode: 'art' (pictures, tip, spinner), 'fade' (black + spinner, for respawns), 'menu' (pictures behind the main menu)
// resolves once the screen is fully covered
function loading(on, label = '', mode = 'art') {
  clearInterval(artTimer); clearTimeout(loaderOut);
  fx.setMusic(on && mode !== 'fade'); // the beat plays behind the pictures and the menu, not on respawn fades
  if (!on) { loader.classList.add('out'); loaderOut = setTimeout(() => { loader.hidden = true; }, 650); return Promise.resolve(); }
  const wasHidden = loader.hidden || loader.classList.contains('out');
  loader.classList.toggle('fade', mode === 'fade'); loader.classList.toggle('menu', mode === 'menu');
  const tip = loader.querySelector('.tip'); tip.textContent = '';
  if (label) { const sm = document.createElement('small'); sm.textContent = label; tip.prepend(sm); }
  loadProgress(0);
  if (mode !== 'fade') artTimer = setInterval(nextArt, mode === 'menu' ? 7000 : 3200);
  if (!wasHidden) return Promise.resolve();
  loader.classList.add('out'); loader.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => loader.classList.remove('out')));
  return new Promise((r) => setTimeout(r, 650));
}
function loadProgress(p) { loader.querySelector('.bar i').style.width = Math.round(p * 100) + '%'; }
loading(true, 'Davenport, Iowa');

// ---------- load Davenport (the menu waits for the city around the riverfront) ----------
const playBtn = document.getElementById('playBtn');
playBtn.disabled = true; playBtn.textContent = 'Loading…';
// models, the map index and the first streets all download at the same time
let pModels = 0, pCity = 0;
const loadBar = () => loadProgress(pModels * 0.4 + pCity * 0.6);
const modelsReady = loadAssets((p) => { pModels = p; loadBar(); });
await W.initWorld(scene, activeQuality);
initBreakables(scene, activeQuality);
await Promise.all([modelsReady, W.prefetch(W.places.menu.x, W.places.menu.z, 320)]);
initCharacters(activeQuality);
fx.setCasingGeometry(geometryOf('weapons', 'casing'));
await W.preload(W.places.menu.x, W.places.menu.z, 320, (p) => { pCity = p; loadBar(); });
playBtn.disabled = false; playBtn.textContent = 'Story Mode';
let profile = null, savedPos = null; // the saved profile and where you left off ({x, z, h, s: 1 = find a sidewalk near it})
// main menu "Start in": the town you drop into (picked now so its streets can download while you're in the menu)
const startBtn = document.getElementById('startIn'), startOpts = ['Random', ...W.startTowns()];
let startI = 0, spawnP = null;
function pickStart(d) {
  startI = (startI + d + startOpts.length) % startOpts.length;
  // saved spot wins unless you pick a town
  const last = startI === 0 && savedPos;
  startBtn.textContent = `Start in: ${last ? 'Where you left off' : startOpts[startI]}`;
  spawnP = (last ? W.spawnNear(savedPos.x, savedPos.z, savedPos.h || 0, !savedPos.s) : W.spawnIn(startOpts[startI])).then((sp) => { W.prefetch(sp.x, sp.z, 260); return sp; });
}
pickStart(0);
startBtn.addEventListener('click', () => pickStart(1));
startBtn.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); pickStart(e.key === 'ArrowRight' ? 1 : -1); } });
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
await Promise.race([document.fonts.load('16px "Pricedown Bl"'), new Promise((r) => setTimeout(r, 3000))]).catch(() => {}); // the map labels use it
ui.drawMapBase();
ui.setTurfs(GANGS);
ui.buildWheel(WEAPONS, (i) => { selectWeapon(i); closeWheel(false); });
ui.setWheelInfo((i) => { const w = WEAPONS[i]; if (w.melee) return 'Melee'; const a = ammoOf(i); return w.grenade ? `${a.mag + a.res} grenades` : `${a.mag} / ${a.res} rounds`; });
const vehById = new Map(vehicles.map((v) => [v.id, v]));
const remotes = new Map();
const grenades = [];

const me = {
  name: '', look: null, ch: null, x: 0, y: 0, z: 0, h: 0, vy: 0, vx: 0, vz: 0, hp: 100, dead: false, deadT: 0,
  stars: 0, unseen: 0, weapon: 2, cd: 0, swing: 0, veh: null, seat: 0, swim: false, grounded: true, moveSpeed: 0,
  shotSeq: 0, shot: [0, 0, 0], hitCd: 0, lastBy: '', lastByUid: '',
  armor: 0, owned: new Set(WEAPONS.keys()), ammo: startAmmo(), reloadT: 0, aimT: 0, lockOn: null,
};
let aiming = false;
let playing = false, isHost = true, shake = 0, lastAttack = -1e9;
let myAct = null; // the player's current action pose { n, k, side } (src/anim.js), also sent to other players
let wheelOpen = false, wheelSel = 0, wheelX = 0, wheelY = 0;

// ---------- input ----------
const keys = new Set();
let mouseDown = false, clicked = false, locked = false, typing = false;
let camYaw = 0, camPitch = 0.22, lastMouse = 0;
addEventListener('keydown', (e) => {
  if (consoleOpen()) return; // its input handles its own keys
  if (typing) {
    if (e.key === 'Enter') { const m = ui.el.chatInput.value.trim(); if (m) sendChat(me.name, m.slice(0, 120)); closeChat(); }
    else if (e.key === 'Escape') closeChat();
    return;
  }
  if (!playing) return;
  if (shopOpen && (e.key === 'Escape' || e.code === 'KeyE') && !e.repeat) { e.preventDefault(); closeShop(); return; }
  if (paused) { pauseKey(e); return; }
  if (e.code === 'Backquote' && !e.repeat && !minigames.isOpen()) { e.preventDefault(); keys.clear(); mouseDown = false; aiming = false; closeWheel(false); document.exitPointerLock?.(); openConsole(); return; }
  if (blackedOut() && e.key !== 'Escape') { e.preventDefault(); return; } // passed out: no moving, shooting or using things
  if (phone.key(e)) { e.preventDefault(); mouseDown = false; aiming = false; me.lockOn = null; return; } // phone up: arrows / Enter / Backspace / Esc belong to it; drop held fire/aim
  if (e.key === 'Escape' && !locked) { openPause(); return; }
  if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyT') { e.preventDefault(); openChat(); }
  if ((e.code === 'Tab' || e.code === 'KeyQ') && !phone.isOpen()) { e.preventDefault(); openWheel(); }
  if (e.code === 'KeyM') { document.exitPointerLock?.(); openPause('map'); }
  if (e.code === 'KeyE') { const d = doorNear(); if (d) useDoor(d); else if (!useStore()) toggleVehicle(); }
  if (e.code === 'KeyR') startReload();
  if (e.code === 'KeyN' && me.veh && !me.veh.T.bike) { const st = nextStation(); ui.flashPrompt(st.sub ? `📻 ${st.name} · ${st.sub}` : st.name); }
  if (e.code === 'KeyP') callMechanic();
  if (e.code === 'KeyJ' && !toggleJob()) ui.flashPrompt('No side job for this ride'); // taxi, ambulance, fire truck, police car, scooter
  if (e.code === 'KeyH' && me.veh && !me.seat && !me.dead) { if (me.veh.T.ebike) ebikes.bell(); else modHorn(me.veh); } // horn (carmods.js: the car's own horn mod)
  else if (e.code === 'KeyG' || e.code === 'KeyH') talk(e.code === 'KeyG');
  if (e.code === 'KeyC' && me.swim && !me.veh && !me.dead) swim.dive(me); // (held: swim down)
  else if (e.code === 'KeyC' && playing && !me.veh && !me.dead && !typing && !cover.active()) { me.crouch = !me.crouch; ui.flashPrompt(me.crouch ? 'Crouching (C to stand)' : 'Standing'); }
  if (e.code === 'KeyF' && !me.veh && !me.dead && !me.swim && !me.enter && !me.move && !me.ch.rag && !me.rag && !anim.busy()) { if (cover.press(me, Math.sin(camYaw), Math.cos(camYaw))) me.crouch = false; } // take cover (src/cover.js)
});
addEventListener('keyup', (e) => { keys.delete(e.code); if ((e.code === 'Tab' || e.code === 'KeyQ') && wheelOpen) closeWheel(true); });
addEventListener('blur', () => { keys.clear(); mouseDown = false; });
canvas.addEventListener('click', () => { if (playing && !typing && !consoleOpen()) { lockMouse(); fx.unlockAudio(); } });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked) mouseDown = false;
  if (locked) closePause();
  else if (playing && !typing && !consoleOpen() && !wheelOpen && !shopOpen && !phone.unlocked() && !minigames.isOpen()) openPause(); // Esc with the phone up only backs the phone
});
addEventListener('mousemove', (e) => {
  if (!locked) return;
  if (wheelOpen) {
    wheelX = clamp(wheelX + e.movementX, -120, 120); wheelY = clamp(wheelY + e.movementY, -120, 120);
    if (Math.hypot(wheelX, wheelY) > 25) { wheelSel = ui.wheelIndex(wheelX, wheelY, WEAPONS.length); ui.wheelHighlight(wheelSel, WEAPONS[wheelSel]); }
    return;
  }
  const sens = (aiming ? (WEAPONS[me.weapon].scope ? 0.00065 : 0.0017) : 0.0034) * settings.sens;
  camYaw -= e.movementX * sens;
  camPitch = clamp(camPitch + e.movementY * sens * (settings.invertY ? -1 : 1), -0.5, 1.2);
  if (me.lockOn && combat.pullLock(e.movementX, e.movementY)) me.lockOn = null; // a hard pull away breaks the lock-on
  lastMouse = performance.now();
});
addEventListener('mousedown', (e) => {
  if (!locked || wheelOpen || blackedOut() || phone.isOpen()) return; // no shooting, aiming or melee on the phone
  if (e.button === 0) { mouseDown = true; clicked = true; }
  if (e.button === 2) { aiming = true; me.lockOn = findLockTarget(); me.lockT = 0; combat.resetLock(); }
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
let paused = false, waypoint = null, pausedAt = 0;
const pauseTabs = [...ui.el.pauseTabs.querySelectorAll('[data-tab]')];
function openPause(tab) {
  if (!playing) return;
  paused = true; keys.clear(); mouseDown = false; pausedAt = performance.now();
  document.getElementById('pauseName').textContent = me.name;
  ui.el.pause.hidden = false;
  showTab(tab || pauseTabs.find((b) => b.classList.contains('on')).dataset.tab);
}
function stepTab(d) { const i = pauseTabs.findIndex((b) => b.classList.contains('on')); showTab(pauseTabs[(i + d + pauseTabs.length) % pauseTabs.length].dataset.tab); }
// GTA keys while paused: Q/E or arrows switch tabs, Esc goes back to the game (click the game to grab the mouse again)
function pauseKey(e) {
  if (e.repeat || e.target.tagName === 'INPUT') return; // sliders keep their arrow keys
  if (e.key.startsWith('Arrow') && ui.mapActive()) return; // on the map the arrows pan it (ui.js)
  if (e.code === 'KeyQ' || e.key === 'ArrowLeft') stepTab(-1);
  else if (e.code === 'KeyE' || e.key === 'ArrowRight') stepTab(1);
  else if (e.key === 'Escape' && performance.now() - pausedAt > 400) closePause(); // the Esc that unlocked the mouse also opened this
}
function closePause() { if (shopOpen) { shopOpen = false; document.getElementById('shop').hidden = true; } paused = false; ui.el.pause.hidden = true; }
function showTab(tab) {
  for (const b of ui.el.pauseTabs.querySelectorAll('button')) b.classList.toggle('on', b.dataset.tab === tab);
  for (const p of ui.el.pause.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== tab;
  if (tab === 'map') drawPauseMap();
  if (tab === 'goals') drawGoals();
  if (tab === 'stats') drawStats();
  if (tab === 'players') ui.setPlayers(playerRows(), net.online);
}
function drawStats() {
  const rows = [['Cash', '$' + eco.cash.toLocaleString('en-US')], ['Stores robbed', eco.robbed], ['Cars jacked', eco.jacked], ['Cop cars wrecked', eco.copCars],
    ['Goals complete', `${eco.done.size} / ${GOALS.length}`], ['Wanted level', '★'.repeat(wanted.stars) || 'None']];
  document.getElementById('statList').innerHTML = rows.map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join('');
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
ui.el.pauseTabs.addEventListener('click', (e) => { const t = e.target.closest('button'); if (t) t.dataset.dir ? stepTab(+t.dataset.dir) : showTab(t.dataset.tab); });
ui.el.resumeBtn.addEventListener('click', () => { closePause(); lockMouse(); fx.unlockAudio(); });
// click sets / clears the waypoint; held back a moment so a double-click (zoom in, ui.js) doesn't also move it
let wpClickT = 0;
ui.el.bigmap.addEventListener('click', (e) => {
  clearTimeout(wpClickT);
  if (ui.bigMapDragged() || e.detail > 1) return;
  const p = ui.bigMapToWorld(e);
  wpClickT = setTimeout(() => {
    waypoint = waypoint && Math.hypot(waypoint.x - p.x, waypoint.z - p.z) < 40 ? null : p;
    gpsRoute = waypoint ? W.route(me.veh ? me.veh.x : me.x, me.veh ? me.veh.z : me.z, waypoint.x, waypoint.z) : null; routeT = 3;
    drawPauseMap();
  }, 260);
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
        msg = `<b>${turn > 0 ? '↱' : '↰'}</b>${dist < 25 ? 'Now' : `In ${fmtDist(dist)}`} · ${dir}${onto}`;
        break;
      }
    }
    dist += lb;
  }
  if (!msg) msg = `<b>⚑</b>${dist < 60 ? 'Arriving at your waypoint' : `Waypoint in ${fmtDist(dist)}`}`;
  gpsEl.innerHTML = msg; gpsEl.hidden = false;
}
// map blips carry a type (icon, colour and legend row live in ui.BLIP_TYPES)
function mapBlips() {
  const b = poiBlips().slice();
  for (const h of W.places.hospitals) b.push({ x: h.x, z: h.z, type: 'hospital', name: h.name.replace(/^MercyOne /, '') });
  for (const p of police.stations()) b.push({ x: p.x, z: p.z, type: 'police', name: p.name });
  b.push(...storeList(true));
  for (const e of eventBlips()) b.push({ type: 'event', ...e });
  b.push(...garage.blips());
  b.push(...ebikes.blips(me.x, me.z));
  for (const r of remotes.values()) if (!r.dead) b.push({ x: r.x, z: r.z, type: 'player', name: r.name });
  return b;
}
const STORE_TYPE = { rob: 'rob', guns: 'guns', clothes: 'clothes', body: 'garage', casino: 'casino', bar: 'bar' };
function storeList(all) {
  const out = [];
  for (const s of stores) {
    const type = STORE_TYPE[s.kind];
    // minimap: gun stores, garages and the casino from anywhere, robbable stores within 400 m (more would pile up on its edge),
    // clothes and bars only within 150 m; dimmed while the till is empty
    if (type && (all || s.kind === 'guns' || s.kind === 'body' || s.kind === 'casino' || Math.hypot(s.x - me.x, s.z - me.z) < (s.kind === 'rob' ? 400 : 150))) out.push({ x: s.x, z: s.z, type, name: s.kind === 'casino' ? 'The Arnett Belle casino' : s.name, dim: s.cooldown > 0 });
  }
  return out;
}
// real Davenport places from OSM -> blip type (churches, salons and the like stay off to keep the map readable)
const POI_TYPE = {
  fuel: 'gas', supermarket: 'shop', department_store: 'shop', mall: 'shop', variety_store: 'shop', convenience: 'shop', alcohol: 'shop',
  restaurant: 'food', fast_food: 'food', cafe: 'cafe', pastry: 'cafe', bar: 'bar', pub: 'bar', bank: 'bank', pharmacy: 'pharmacy', chemist: 'pharmacy',
  park: 'park', school: 'school', college: 'school', university: 'school', car_repair: 'garage', tyres: 'garage',
  museum: 'landmark', attraction: 'landmark', stadium: 'landmark', theatre: 'landmark', cinema: 'landmark', gallery: 'landmark',
};
let poiCache = null, poiStores = 0;
function poiBlips() {
  if (poiCache && poiStores === stores.length) return poiCache; // stores are planned town by town as you travel
  poiStores = stores.length;
  if (!stores.length) return []; // stores aren't placed yet; try again next time
  // our own stores sit on some of these spots (Tim-Mart on a real gas station): don't double them up
  poiCache = W.D.index.poi.filter((p) => POI_TYPE[p.kind] && !stores.some((s) => s.kind !== 'meds' && (s.kind !== 'bar' || POI_TYPE[p.kind] === 'bar') && Math.hypot(s.x - p.x, s.z - p.z) < 60))
    .map((p) => ({ x: p.x, z: p.z, type: POI_TYPE[p.kind], name: p.name, tier: POI_TYPE[p.kind] === 'garage' ? 2 : undefined })); // OSM repair shops aren't Arnett Auto: close-in only
  for (const f of W.places.fire) poiCache.push({ x: f.x, z: f.z, type: 'fire', name: f.name });
  return poiCache;
}
function drawPauseMap() { ui.drawBigMap(me, mapBlips(), waypoint, gpsRoute); }

function lockMouse() { try { const p = canvas.requestPointerLock?.(); p?.catch?.(() => {}); } catch { /* not allowed here */ } }
function selectWeapon(i) {
  me.owned.add(i); // everything is unlocked
  me.weapon = i; me.reloadT = 0; refreshWeaponHud();
}
function ammoOf(i) { return me.ammo[i] || (me.ammo[i] = { mag: 0, res: 0 }); }
// starting ammo: a full mag + one ammoPack per gun, 3 grenades / Molotovs
function startAmmo() {
  const a = {};
  WEAPONS.forEach((w, i) => { if (!w.melee) a[i] = w.grenade ? { mag: 1, res: 2 } : { mag: w.mag, res: w.ammoPack }; });
  return a;
}
function refreshWeaponHud() {
  const w = WEAPONS[me.weapon], a = ammoOf(me.weapon);
  ui.setWeapon(w.name, w.melee ? '' : w.grenade ? `× ${a.mag + a.res}` : me.reloadT > 0 ? 'Reloading…' : `${a.mag} / ${a.res}`);
}
function startReload() {
  const w = WEAPONS[me.weapon], a = ammoOf(me.weapon);
  if (w.melee || w.grenade || me.reloadT > 0 || a.mag >= w.mag || a.res <= 0) return;
  me.reloadT = combat.reloadTime(w); fx.soundReload(); refreshWeaponHud();
}
// Right-click aim: snap onto the nearest threat (or person) roughly where you're looking.
function findLockTarget() {
  // in a shop the only target is the clerk (the casino room sits underground, so lineOfSight below would refuse it)
  const R = interior.room;
  if (R) return R.clerk && Math.abs(angDiff(camYaw, Math.atan2(R.clerk.x - me.x, R.clerk.z - me.z))) < 0.7 ? { ref: R.clerk, kind: 'person' } : null;
  let best = null, bs = 0.26;
  const consider = (x, y, z, ref, kind) => {
    const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz);
    if (d > 45 || d < 1) return;
    const off = Math.abs(angDiff(camYaw, Math.atan2(dx, dz)));
    const score = off + d * 0.004 - (kind === 'threat' ? 0.1 : 0);
    if (off < 0.35 && score < bs && W.lineOfSight(me.x, me.y + 1.5, me.z, x, y, z)) { bs = score; best = { ref, kind }; }
  };
  for (const u of police.cops.values()) if (!police.isDown(u) && !u.parked) { const P = police.posOf(u); consider(P.x, u.kind === 3 ? u.y : (P.y || 0) + 1.2, P.z, u, 'threat'); }
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
  ui.wheelHighlight(wheelSel, WEAPONS[wheelSel]); ui.showWheel(true);
}
function closeWheel(apply) {
  if (!wheelOpen) return;
  wheelOpen = false; ui.showWheel(false);
  if (apply) selectWeapon(wheelSel);
}

// ---------- menu: one online world, joined straight from the main menu ----------
const netStatus = document.getElementById('netStatus');
// names: 1-16 characters, no markup or control characters (shown with textContent everywhere, this is belt and braces)
const cleanName = (s) => String(s || '').replace(/[<>&"'`\\\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
const randomName = () => 'Player' + Math.floor(100 + Math.random() * 900);
let storedName = ''; try { storedName = cleanName(localStorage.getItem('tat-name')); } catch { /* private mode */ }
function setMyName(n) {
  me.name = n; storedName = n;
  try { localStorage.setItem('tat-name', n); } catch { /* ignore */ }
  netSetName(n);
  for (const el of [document.getElementById('nameField')]) if (el && document.activeElement !== el) el.value = n;
  if (me.ch && playing) markDirty();
}
// first launch: a small GTA-style prompt in the menu
function askName() {
  const f = document.getElementById('namePrompt'), inp = document.getElementById('nameAsk'), err = document.getElementById('nameErr');
  inp.value = randomName(); f.hidden = false;
  setTimeout(() => { inp.focus(); inp.select(); }, 0);
  return new Promise((res) => f.addEventListener('submit', function ok(e) {
    e.preventDefault();
    const n = cleanName(inp.value);
    if (!n) { err.textContent = 'Pick a name (1 to 16 letters or numbers).'; return; }
    f.removeEventListener('submit', ok); f.hidden = true; res(n);
  }));
}
const connecting = connect().then(async (ok) => {
  netStatus.textContent = kickNote() || (ok ? 'Everyone plays in one world. Chat here or with T in the game.' : net.error);
  profile = await loadProfile();
  if (profile && profile.pos && typeof profile.pos.x === 'number') savedPos = profile.pos;
  me.name = storedName || cleanName(profile && profile.n) || randomName();
  me.look = profile && Array.isArray(profile.look) ? normLook(profile.look) : randomLook();
  if (startI === 0) pickStart(0); // the start picker now offers where you left off
  try { await joinWorld(me.name, me.look); }
  catch (e) { console.error(e); net.online = false; netStatus.textContent = "Couldn't join the online world: solo mode. (" + (e.code || e.message) + ')'; await joinWorld(me.name, me.look); }
  initNameField();
  refreshOnline();
  if (!storedName) setMyName(profile && cleanName(profile.n) ? me.name : await askName()); // asked once, on first launch
});
// ---------- main menu: Story Mode / Controls / Settings / Credits, by mouse or arrow keys ----------
const mmItems = [...document.querySelectorAll('.mmList button')], mmPanel = document.getElementById('mmPanel');
const borrowed = []; // the pause menu lends its Controls and Settings panels; they go back when you start
function mmShow(which) {
  for (const b of borrowed.splice(0)) b.home.append(b.el);
  mmPanel.hidden = !which;
  if (!which) return;
  const src = which === 'credits' ? document.getElementById('mmCredits') : which === 'online' ? document.getElementById('mmOnline') : document.querySelector(`[data-panel="${which}"]`);
  mmPanel.querySelector('h2').textContent = which;
  const body = mmPanel.querySelector('.mmBody');
  for (const el of [...src.children]) { borrowed.push({ el, home: src }); body.append(el); }
}
function mmSelect(i) { mmItems.forEach((b, k) => b.classList.toggle('on', k === i)); mmShow(mmItems[i].dataset.mm || null); }
const mmSideBySide = matchMedia('(min-width: 1001px) and (min-height: 561px)'); // stacked layout: hover must not swap the panel while the mouse heads down to it
mmItems.forEach((b, i) => { b.addEventListener('mouseenter', () => { if (mmSideBySide.matches) mmSelect(i); }); b.addEventListener('focus', () => mmSelect(i)); if (b.dataset.mm) b.addEventListener('click', () => mmSelect(i)); });
addEventListener('keydown', (e) => {
  if (ui.el.menu.hidden || playing || !document.getElementById('namePrompt').hidden) return;
  if (e.target.tagName === 'INPUT' && e.key !== 'Escape') return; // typing a chat message or your name
  const i = Math.max(0, mmItems.findIndex((b) => b.classList.contains('on')));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); mmItems[(i + (e.key === 'ArrowDown' ? 1 : mmItems.length - 1)) % mmItems.length].focus(); }
  else if (e.key === 'Enter' && e.target.tagName !== 'INPUT' && e.target !== mmItems[i]) { e.preventDefault(); mmItems[i].click(); }
  else if (e.key === 'Escape') mmItems[0].focus();
});
playBtn.addEventListener('click', async () => {
  if (!document.getElementById('namePrompt').hidden) return;
  if (kickNote()) { netStatus.textContent = kickNote(); return; }
  playBtn.disabled = true; playBtn.textContent = 'Joining…';
  await connecting;
  playBtn.textContent = `Loading ${startI === 0 ? (savedPos ? 'your spot' : 'the Quad Cities') : startOpts[startI]}…`;
  await enginesReady;
  // drop in somewhere random in the city (load the streets around you first)
  const sp = await spawnP;
  mmShow(null);
  await loading(true, W.areaAt(sp.x, sp.z)[0]);
  menuFocus = sp;
  prewarmShaders();
  const pics = new Promise((r) => setTimeout(r, 22000)); // the pictures always get ~22 s, longer if the streets still aren't in
  ui.el.menu.hidden = true;
  await W.preload(sp.x, sp.z, 260, loadProgress);
  manageParked(0, sp.x, sp.z, true);
  applyProfile(profile);
  me.ch = makeCharacter(me.look);
  scene.add(me.ch.g);
  respawn(true, sp);
  if (profile && profile.hp > 0) me.hp = clamp(profile.hp, 25, 100); // respawn() just set a full bar
  startPlaying();
  profileReady = true;
  await pics;
  ui.el.menu.hidden = true; ui.el.hud.hidden = false;
  playing = true;
  setTimeout(() => { loading(false); startSpawnCam(); }, 250); // a few frames to settle behind the cover
  selectWeapon(2);
  fx.unlockAudio();
  lockMouse();
});

// ---------- network handlers ----------
const mmChat = document.getElementById('mmChat'), mmChatInput = document.getElementById('mmChatInput');
net.handlers.chat = (c) => {
  if (!c) return;
  const n = String(c.n || '?').slice(0, 16), m = String(c.m || '').slice(0, 120), admin = !!c.u && net.admins[c.u] === true;
  ui.addChat(n, m, admin);
  const li = document.createElement('li'), b = document.createElement('b'); b.textContent = n + ':';
  if (admin) b.prepend(ui.adminBadge());
  li.append(b, document.createTextNode(m)); mmChat.append(li);
  while (mmChat.children.length > 50) mmChat.firstChild.remove();
  mmChat.scrollTop = mmChat.scrollHeight;
};
mmChatInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const m = mmChatInput.value.trim(); if (m && me.name) sendChat(me.name, m.slice(0, 120));
  mmChatInput.value = '';
});
// who's on: name, where they are, stars, playing or still in the menu (pause ONLINE tab, menu Online panel)
function playerRows() {
  const host = hostUid(), list = [];
  for (const [uid, p] of Object.entries(net.players)) {
    if (!p) continue;
    const s = Array.isArray(p.s) ? p.s : null, mine = uid === net.uid;
    list.push({ name: mine ? me.name : String(p.n || '?').slice(0, 16), me: mine, playing: mine ? playing : !!s, host: !!s && host === uid, admin: net.admins[uid] === true, stars: mine ? (playing ? wanted.stars : 0) : (s && s[7]) || 0, area: String(p.a || '').slice(0, 40) });
  }
  if (!list.some((p) => p.me)) list.unshift({ name: me.name, me: true, playing, host: false, admin: net.admins[net.uid] === true, stars: wanted.stars, area: '' });
  return list.sort((a, b) => b.me - a.me || b.playing - a.playing || a.name.localeCompare(b.name));
}
// Settings: Name (shared by the main menu and the pause menu); updates your presence live
function initNameField() {
  const f = document.getElementById('nameField'), out = document.getElementById('nameOut');
  f.value = me.name; out.textContent = '';
  f.addEventListener('keydown', (e) => { if (e.key === 'Enter') f.blur(); });
  f.addEventListener('change', () => {
    const n = cleanName(f.value);
    if (n) { setMyName(n); out.textContent = 'Saved'; } else out.textContent = '1 to 16 characters';
    f.value = me.name; setTimeout(() => { out.textContent = ''; }, 2500);
  });
}
// ---------- saved profile: cash, ammo, armor, health, stats, goals, look, garage and where you were ----------
let profileReady = false, profT = 30, dirtyT = 0, lastCash = null;
const markDirty = () => { if (!dirtyT) dirtyT = 3; }; // debounced: a burst of purchases is one write
function applyProfile(p) {
  if (!p) return;
  if (Number.isFinite(p.cash)) eco.cash = clamp(Math.round(p.cash), 0, 1e9);
  if (Number.isFinite(p.armor)) me.armor = clamp(p.armor, 0, 100);
  if (Array.isArray(p.st)) { eco.robbed = +p.st[0] || 0; eco.jacked = +p.st[1] || 0; eco.copCars = +p.st[2] || 0; }
  if (Array.isArray(p.done)) eco.done = new Set(p.done.filter((g) => GOALS.some((x) => x.id === g)));
  if (Array.isArray(p.ammo)) WEAPONS.forEach((w, i) => { if (!w.melee && Number.isFinite(p.ammo[i * 2])) me.ammo[i] = { mag: clamp(p.ammo[i * 2] | 0, 0, w.mag || 99), res: clamp(p.ammo[i * 2 + 1] | 0, 0, 99999) }; });
  if (p.gar) garage.setData(p.gar);
  lastCash = eco.cash;
}
function profileNow() {
  // on foot on the ground: that exact spot. In a car, swimming, up on a roof or in a shop: a sidewalk near it next time
  if (!me.dead) {
    const o = interior.room && me.outside, v = me.veh, x = o ? o.x : v ? v.x : me.x, z = o ? o.z : v ? v.z : me.z;
    const odd = !!(o || v || me.swim || me.y > W.groundHeight(me.x, me.z) + 1.5);
    savedPos = { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, h: Math.round(angDiff(0, v ? v.h : me.h) * 100) / 100, s: odd ? 1 : 0 };
  }
  const ammo = []; WEAPONS.forEach((w, i) => { const a = me.ammo[i]; ammo.push(a ? a.mag | 0 : 0, a ? a.res | 0 : 0); });
  const p = { v: 1, n: me.name, cash: eco.cash, armor: Math.round(me.armor), hp: Math.round(clamp(me.hp, 0, 100)), ammo, st: [eco.robbed, eco.jacked, eco.copCars], done: [...eco.done], look: me.look, gar: garage.data(), t: Date.now() };
  if (savedPos) p.pos = savedPos;
  return JSON.parse(JSON.stringify(p)); // no undefined anywhere (the database refuses it)
}
function saveNow() { if (!profileReady) return; profT = 30; dirtyT = 0; profile = profileNow(); saveProfile(profile); }
function tickProfile(dt) {
  if (eco.cash !== lastCash) { lastCash = eco.cash; markDirty(); }
  if (dirtyT > 0 && (dirtyT -= dt) <= 0) saveNow();
  if ((profT -= dt) <= 0) saveNow();
}
// Tabbed out: the browser stops drawing frames, so update() (and with it every network write) stops too. A slow timer
// keeps our record alive and marked away (s[23] = 1: others keep showing you, and don't make you run their cops), and
// coming back starts clean: our record is put back if the server dropped it, timers reset, no backlog replayed.
let awayTimer = 0, lastState = null;
const awayState = () => { if (!lastState) return null; const s = lastState.slice(); s[23] = 1; s[4] = 0; return s; };
function onHidden() {
  saveNow();
  if (!playing) return;
  fx.suspendAudio(true);
  keys.clear(); mouseDown = false; // the key-up events go to the other tab
  const s = awayState(); if (s) sendState(s);
  if (isHost) { setCops(null); isHost = false; hostT = 0; } // the group picks another host while we're gone
  clearInterval(awayTimer);
  awayTimer = setInterval(() => { if (!document.hidden) return; ensurePresence(); const a = awayState(); if (a) sendState(a); }, 5000);
}
function onShown() {
  clearInterval(awayTimer); awayTimer = 0;
  fx.suspendAudio(false);
  last = performance.now(); fpsWarm = 0; fpsAcc = 0; fpsFrames = 0; // no giant first frame, and the fps watcher waits
  sendT = 0; crowdT = 0; snapRemotes = true;
  ensurePresence();
}
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') onHidden(); else onShown(); });
addEventListener('pagehide', saveNow);
const onlineBtn = document.getElementById('onlineBtn');
function refreshOnline() {
  if (ui.el.menu.hidden) return;
  const list = playerRows(), n = list.length;
  onlineBtn.innerHTML = 'Online'; const sm = document.createElement('small'); sm.textContent = net.online ? `${n} on` : 'solo'; onlineBtn.append(sm);
  if (!playBtn.disabled) { playBtn.textContent = net.online ? 'Play Online' : 'Story Mode'; }
  ui.renderPlayers(document.getElementById('mmPlayers'), list);
}
setInterval(refreshOnline, 1000);
// Snapshots are applied once per frame, newest only: a hidden or frozen tab (no frames) otherwise works through its
// whole backlog in one go when you come back. cops/{host}: only our group's host.
let pendingCops = null;
const pendingVeh = new Map();
net.handlers.cops = (all) => { pendingCops = all; };
net.handlers.vehicle = (id, rec) => { if (rec) { rec.seen = net.now(); pendingVeh.set(id, rec); } };
// Cars other players use far away (the whole map's worth: often 50+) are kept as plain records and only built once
// you get near; built ones that end up far away go back to being records.
const farVeh = new Map(), NET_NEAR = 650, NET_FAR = 900;
let netCullT = 0;
function applyNetSnapshots(dt) {
  if (pendingCops) { const all = pendingCops; pendingCops = null; if (!isHost) police.applyRemote(all[hostUid()] || {}); }
  const cx = camera.position.x, cz = camera.position.z;
  if (pendingVeh.size) {
    for (const [id, rec] of pendingVeh) {
      if (!vehById.has(id) && Number.isFinite(+rec.x) && Math.hypot(rec.x - cx, rec.z - cz) > NET_NEAR) farVeh.set(id, rec);
      else { farVeh.delete(id); applyVehicle(id, rec); }
    }
    pendingVeh.clear();
  }
  if ((netCullT -= dt) > 0) return;
  netCullT = 1;
  for (const [id, rec] of farVeh) if (Math.hypot(rec.x - cx, rec.z - cz) < NET_NEAR) { farVeh.delete(id); applyVehicle(id, rec); }
  for (const v of [...vehicles]) {
    if (!v.netRec || v === me.veh || v.localSim || v.fire || me.enter?.v === v || Math.hypot(v.x - cx, v.z - cz) < NET_FAR) continue;
    farVeh.set(v.id, v.netRec); resetVehicle(v);
  }
}
function applyVehicle(id, rec) {
  let v = vehById.get(id);
  if (!v && rec && Number.isInteger(rec.ti) && rec.ti >= 0 && rec.ti < V_COUNT) {
    // a car another player is using that we haven't seen yet
    v = makeVehicle(id, rec.ti, typeof rec.c === 'number' ? rec.c : 0xffffff, { x: +rec.x || 0, z: +rec.z || 0, h: +rec.h || 0 });
    for (const o of [...vehicles]) if (o.mode === 'parked' && !o.keep && Math.hypot(o.x - v.x, o.z - v.z) < 3) resetVehicle(o); // our copy of the same kerb car
    v.mode = 'free'; v.remote = true; scene.add(v.mesh); vehicles.push(v); vehById.set(id, v);
  }
  if (!v || !rec) return;
  v.touchedAt = net.now(); v.netRec = rec;
  if (me.veh === v && !me.seat) { // (riding as a passenger: take the driver's updates like any remote car)
    if (rec.d && rec.d !== net.uid) { v.driver = rec.d; ejectMe(); v.tgt = netTarget(rec); }
    return;
  }
  if (v.localSim && !rec.d) return; // echo of our own sliding writes
  if (v.mode === 'traffic' || v.mode === 'parked') { v.x = rec.x; v.z = rec.z; v.h = rec.h; }
  v.mode = 'free'; v.localSim = false;
  v.tgt = netTarget(rec);
  v.hp = rec.hp; v.driver = rec.d || ''; v.burnAt = rec.b || 0; v.burnBy = rec.bb || '';
  if (!v.burnAt && v.fire) { fx.stopFire(v.fire); v.fire = null; } // put out (extinguisher or a repair) on the owner's side
  if (rec.e) v.exploded = true;
  if (typeof rec.p === 'number') { v.pitch = rec.p; v.roll = +rec.r || 0; } // planes: nose and bank (planeVisual)
  if (Array.isArray(rec.m)) {
    const key = rec.c + ',' + rec.m.join(',');
    if (key !== v.modKey) {
      v.modKey = key;
      const [c2, f, rs, rc, tint, neon, su, plate] = rec.m, m = modsOf(v), num = (c) => (typeof c === 'number' && c >= 0 ? c : null);
      m.paint = { c1: typeof rec.c === 'number' ? rec.c : v.color, c2: num(c2), f: f | 0 }; m.rims = { s: rs | 0, c: num(rc) };
      m.tint = tint | 0; m.neon = num(neon); m.suspension = su | 0; m.plate = String(plate || '').slice(0, 8);
      applyMods(v);
    }
  }
  if (typeof rec.l === 'number') { const l = rec.l; v.sirenOn = !!(l & 1); v.netBrake = !!(l & 2); v.netRev = !!(l & 4); v.doorOpen = l & 8 ? 1 : 0; v.flat = !!(l & 16); v.brokenHead = !!(l & 32); v.brokenTail = !!(l & 64); v.netPedal = !!(l & 128); cj.applyBits(v, l); }
  if (Array.isArray(rec.dz)) { const [f, b, l, r] = rec.dz; if (f !== Math.round(v.dz.f) || b !== Math.round(v.dz.b) || l !== Math.round(v.dz.l) || r !== Math.round(v.dz.r)) { if (f + b + l + r === 0) { repair(v); applyMods(v); } else { v.dz = { f, b, l, r }; applyDamageVisual(v); } } } // all zero = repaired at Arnett Auto
}
// Where a car someone else drives is heading: its spot, velocity and turn rate when they wrote it (t, on the shared
// server clock). followNet() extrapolates from there, so the car glides between the 10 Hz writes instead of
// stepping toward each one (that stepping was the jerky ride a passenger got, with the camera shaking along).
function netTarget(rec) {
  const t = { x: +rec.x || 0, z: +rec.z || 0, h: +rec.h || 0, y: +rec.y || 0, vel: typeof rec.vx === 'number' };
  if (t.vel) { t.vx = rec.vx; t.vz = +rec.vz || 0; t.vy = +rec.vy || 0; t.w = +rec.w || 0; t.t = typeof rec.t === 'number' ? rec.t : net.now() - 60; }
  return t;
}
const NET_LEAD = 0.5; // extrapolate at most this far (s) when writes stop coming
function followNet(v, dt) {
  const t = v.tgt;
  if (!t.vel) { // an older client's record: no velocity, ease toward it as before
    const k = Math.min(1, dt * 8), ox = v.x, oz = v.z;
    v.x += (t.x - v.x) * k; v.z += (t.z - v.z) * k; v.h += angDiff(v.h, t.h) * k; v.y = t.y || 0;
    v.vx = (v.x - ox) / dt; v.vz = (v.z - oz) / dt;
    return;
  }
  const age = clamp((net.now() - t.t) / 1000, 0, NET_LEAD), ff = age < NET_LEAD ? dt : 0;
  v.x += t.vx * ff; v.z += t.vz * ff; v.y += t.vy * ff; v.h += t.w * ff; // carry on at their speed...
  const px = t.x + t.vx * age, pz = t.z + t.vz * age, ph = t.h + t.w * age, py = t.y + t.vy * age;
  const ex = px - v.x, ez = pz - v.z;
  if (ex * ex + ez * ez > 144) { v.x = px; v.z = pz; v.h = ph; v.y = py; } // way off (respawned, teleported): jump
  else { const k = Math.min(1, dt * 4); v.x += ex * k; v.z += ez * k; v.h += angDiff(v.h, ph) * k; v.y += (py - v.y) * Math.min(1, dt * 10); } // ...and ease out the error
  v.vx = t.vx; v.vz = t.vz;
  v.speed = t.vx * Math.sin(v.h) + t.vz * Math.cos(v.h); // wheels, speedo, the passenger's camera
}
net.handlers.reconnected = () => { sendT = 0; if (me.veh && !me.seat) writeVeh(me.veh, true); }; // net.js already put our player record back
net.handlers.vehicleGone = (id) => { pendingVeh.delete(id); farVeh.delete(id); const v = vehById.get(id); if (!v) return; if (me.veh === v && me.seat) ejectMe(); resetVehicle(v); };
net.handlers.event = (e) => {
  switch (e.type) {
    case 'hit': if (e.to === net.uid && !shotBlocked(e)) damageMe(+e.dmg || 0, String(e.by || 'someone'), e.from, e.ix !== undefined ? { x: +e.ix, y: 3.5, z: +e.iz } : null); break;
    case 'vehHit': if (me.veh && !me.seat && me.veh.id === e.id) damageVehicle(me.veh, +e.dmg || 0, e.imp ? { cp: [e.px, e.pz], imp: e.imp } : null); break;
    case 'bump': {
      if (me.veh && !me.seat && me.veh.id === e.id) applyBump(me.veh, e);
      else if (isHost) { const u = police.cops.get(e.id); if (u && u.kind < 2) applyBump(u.v, e); }
      break;
    }
    case 'copHit': if (isHost) police.damageCop(e.id, +e.dmg || 0); break;
    case 'boom': explode(e.x, e.y, e.z, String(e.by || 'an explosion'), e.bu, false); break;
    case 'nade': spawnNade({ x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, t: e.k === 'molotov' ? 6 : e.k === 'rocket' ? 4 : 2.4, mine: false, kind: e.k || 'nade' }); break;
    case 'kill': ui.addFeed(String(e.text || '').slice(0, 80)); if (e.ku === net.uid) report('kill'); break;
    case 'adm': if (net.admins[e.from] === true) onAdminEvent(e); break; // the rules make from = the sender's real uid
    case 'bust': if (e.to === net.uid && wanted.stars > 0) bustMe(); break; // the police host's officer cuffed me
    case 'jack': if (e.to === net.uid && me.veh && me.veh.id === e.id) { me.veh.driver = e.from; ejectMe(); ui.addFeed('Someone stole your ride!'); } break;
  }
};

// ---------- helpers ----------
function report(type, x = me.x, z = me.z) {
  lastAttack = performance.now(); crime(type, x, me.y, z); phone.log(type, x, z);
  if (isHost && wanted.stars > 0 && /cop|gunfire/.test(type)) police.alert(x, z, net.uid); // radio for backup, nearby units take the call
}
// rammed a cop car: a tap is 1 star and a chase, a real hit 2 (once a second, so a scrape doesn't spam)
function copBump(i, x, z) {
  if (i <= 2 || performance.now() - (copBump.t || 0) < 1000) return;
  copBump.t = performance.now(); report(i > 7 ? 'ramcop' : 'bumpcop', x, z);
}
initWanted({ announce: (t) => ui.announce(t, '', '#ff5e5b'), feed: (t) => ui.addFeed(t), witness: witnessFlee });
function nameOf(uid) { if (uid === net.uid) return me.name; if (uid === 'police') return 'the police'; return net.players[uid]?.n || 'someone'; }
function distCam(x, z) { return Math.hypot(camera.position.x - x, camera.position.z - z); }

function writeVeh(v, force) {
  const n = performance.now();
  if (!force && n - v.lastWrite < (crowd ? 100 : 1000)) return; // 10 Hz with someone near, 1 Hz alone
  // velocity and turn rate let the other screens extrapolate between writes (followNet); w and vy are averaged
  // over the time since the last write so a wobble in one frame doesn't get sent
  const gap = (n - (v.lastWrite || 0)) / 1000, ok = gap > 0.02 && gap < 1.5 && v.wH !== undefined;
  const w = ok ? angDiff(v.wH, v.h) / gap : 0, vy = ok ? (v.y - v.wY) / gap : 0;
  v.lastWrite = n; v.wH = v.h; v.wY = v.y;
  v.touchedAt = net.now();
  const still = !v.vx && !v.vz && !w;
  const rec = { ti: v.ti, c: v.color, x: r2(v.x), y: r2(v.y), z: r2(v.z), h: r3(v.h), vx: still ? 0 : r2(v.vx || 0), vz: still ? 0 : r2(v.vz || 0), vy: Math.abs(vy) < 0.05 ? 0 : r2(vy), w: Math.abs(w) < 0.01 ? 0 : r3(w), t: Math.round(net.now()), hp: Math.round(v.hp), d: v.driver || '', b: v.burnAt || 0, bb: v.burnBy || '', e: v.exploded ? 1 : 0, dz: [v.dz.f, v.dz.b, v.dz.l, v.dz.r].map(Math.round), l: vehBits(v) };
  if (v.T.plane || v.T.heli) { rec.p = r2(v.pitch || 0); rec.r = r2(v.roll || 0); }
  if (v.mods) rec.m = modBits(v.mods);
  setVehicle(v.id, rec);
}
// the looks of an Arnett Auto car (paint finish + 2nd colour, rims, tint, neon, ride height, plate); performance stays local
function modBits(m) {
  const pt = m.paint || {}, rm = m.rims || {}, n = (c) => (typeof c === 'number' ? c : -1);
  return [n(pt.c2), pt.f | 0, rm.s | 0, n(rm.c), m.tint | 0, n(m.neon), m.suspension | 0, String(m.plate || '').slice(0, 8)];
}
// someone near you (another player within 600 m): send at full rate; nobody near: just enough for map blips
let crowd = false, crowdT = 0;
function updateCrowd(dt) {
  if ((crowdT -= dt) > 0) return; crowdT = 1;
  const x = me.veh ? me.veh.x : me.x, z = me.veh ? me.veh.z : me.z;
  crowd = [...remotes.values()].some((r) => Math.hypot(r.x - x, r.z - z) < 600);
}
// siren, brake/reverse lights, open door, flat tyres and smashed lamps, packed for the network
function vehBits(v) {
  const mine = v === me.veh, fwd = keys.has('KeyS') || keys.has('ArrowDown');
  const braking = mine ? (fwd && v.speed > 0.5) || keys.has('Space') : false, reversing = mine && v.speed < -0.4;
  return (v.sirenOn ? 1 : 0) | (braking ? 2 : 0) | (reversing ? 4 : 0) | (v.doorOpen ? 8 : 0) | (v.flat ? 16 : 0) | (v.brokenHead ? 32 : 0) | (v.brokenTail ? 64 : 0) | (mine && v.T.ebike && (keys.has('KeyW') || keys.has('ArrowUp')) ? 128 : 0) | cj.bits(v); // 128: pedalling; 256 up: carjack.js
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
  // planes parked at the airport / farm strips once their ground is loaded (free to take: no stars for flying)
  for (const s of planeSpots(x, z)) if (!vehById.has(s.id)) { const v = makeVehicle(s.id, s.kind === 'duster' ? V.DUSTER : V.PLANE, s.color, s); v.keep = true; v.stolenOnce = true; scene.add(v.mesh); vehicles.push(v); vehById.set(v.id, v); }
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
  // keepDriver = crash impact: the driver reacts a beat after the car comes to rest (see driverReacts)
  if (keepDriver) {
    const imp = keepDriver, r = Math.random();
    v.npcDriver = true; v.npcOutT = 0.6 + Math.random() * 0.9;
    if (imp >= 13 && Math.random() < (imp > 22 ? 0.85 : 0.55)) { // knocked out cold, hazards on; a third come to and stagger out
      v.npcReact = 'ko'; v.ko = true; v.npcOutT = Math.random() < 0.35 ? 8 + Math.random() * 12 : 0; v.alarmUntil = performance.now() / 1000 + 90;
    } else v.npcReact = r < 0.25 + Math.min(0.2, (imp - 4) * 0.02) ? 'angry' : r < 0.55 ? 'flee' : imp < 13 && r < 0.78 ? 'drive' : 'stay';
  }
  else if (!noFlee) spawnFleeing(v.x + Math.cos(v.h) * 1.6, v.z - Math.sin(v.h) * 1.6, v.h + Math.PI / 2);
  writeVeh(v, true);
}
const DRIVER_YELLS = ['Learn to drive!', 'Are you blind?!', 'Hey! My car!', 'Watch it, pal!', 'Seriously?!'];
function honkYell(v) { fx.soundHorn(distCam(v.x, v.z)); if (Math.random() < 0.5) say(v.yeller || (v.yeller = { ch: { g: v.mesh } }), DRIVER_YELLS[Math.floor(Math.random() * DRIVER_YELLS.length)]); }
// A driver whose car got hit decides what to do: floor it back into traffic, sit and yell, or get out
// (angry ones come at you, the rest run; a knocked-out driver who comes to stumbles out and falls).
function driverReacts(v) {
  const k = v.npcReact, lx = Math.cos(v.h), lz = -Math.sin(v.h);
  if (k === 'drive' && v.hp > 0 && joinTraffic(v)) { v.ag.panicT = 5 + Math.random() * 4; honkYell(v); writeVeh(v, true); return; }
  if (k === 'drive' || k === 'stay') { honkYell(v); return; }
  v.npcDriver = false; v.doorOpen = 1; v.doorCloseAt = performance.now() + 1200;
  const n = emptyCar(v);
  spawnFleeing(v.x + lx * 1.7, v.z + lz * 1.7, v.h + Math.PI / 2, k === 'ko' ? 1.6 : 0, k === 'angry');
  for (let i = 1; i < n; i++) spawnFleeing(v.x - lx * 1.6 + Math.sin(v.h) * (i - 1.5), v.z - lz * 1.6 + Math.cos(v.h) * (i - 1.5), v.h - Math.PI / 2, 0);
}
function damageVehicle(v, dmg, hit) {
  if (v.exploded || dmg <= 0) return;
  if (v.driver && v.driver !== net.uid) { sendEvent('vehHit', { id: v.id, dmg: r1(dmg), px: hit ? r1(hit.cp[0]) : 0, pz: hit ? r1(hit.cp[1]) : 0, imp: hit ? r1(hit.imp) : 0 }); return; }
  if (v.mode === 'traffic') freeTraffic(v);
  v.mode = 'free';
  if (hit) damageZone(v, hit.cp[0], hit.cp[1], hit.imp);
  dmg *= armorMul(v); // Arnett Auto armor (v.mods.armor)
  v.hp = Math.max(-v.T.hp, v.hp - dmg);
  // at 0 the engine dies; it only catches fire if you keep wrecking it
  if (v.hp <= -v.T.hp * 0.4 && !v.burnAt) { v.burnAt = net.now(); v.burnBy = net.uid; }
  writeVeh(v, true);
}
let lastIncident = 0;
function crashFx(v, hit) {
  const [px, pz] = hit.cp, d = distCam(px, pz);
  if (hit.imp > 4) { fx.sparks(px, v.y + 0.6, pz, Math.min(24, Math.round(hit.imp * 1.2)), hit.nx, hit.nz); fx.soundCrunch(hit.imp / 18, d); }
  else if (hit.imp > 0.6) { fx.sparks(px, v.y + 0.5, pz, 2, hit.nx, hit.nz); fx.soundScrape(d); }
  if (hit.imp > 15) fx.glass(px, v.y + 1, pz, 8);
  if (hit.imp > 12 && (!lastIncident || performance.now() - lastIncident > 8000)) { lastIncident = performance.now(); incident(px, pz, 'crash'); }
  if (v === me.veh && hit.imp > 8) shake = Math.max(shake, Math.min(1, hit.imp / 30));
}
// Hand out impulses that couldn't be applied here (other players' cars, host-run cops).
function flushBump(o) {
  const b = o.pending;
  if (!b) return;
  o.pending = null;
  if (o === me.veh && !me.seat) { applyBump(o, b); return; }
  if (o.mode === 'cop') { if (isHost) applyBump(o, b); else sendEvent('bump', { id: o.id, jx: r2(b.jx), jz: r2(b.jz), jw: r2(b.jw) }); return; }
  if (o.driver && o.driver !== net.uid) sendEvent('bump', { id: o.id, jx: r2(b.jx), jz: r2(b.jz), jw: r2(b.jw) });
  else { applyBump(o, b); o.localSim = true; }
}
function damageCopUnit(u, dmg, crimeType = 'hitcop') {
  if (u.kind === 2) { const dx = u.x - me.x, dz = u.z - me.z, l = Math.hypot(dx, dz) || 1; u.hitDir = { x: dx / l, z: dz / l }; combat.react(u.ch, u.h || 0, dx / l, dz / l, 1.2, Math.min(1, dmg / 30)); }
  const hp = u.kind < 2 ? u.v.hp : u.hp;
  let killed;
  if (isHost) killed = police.damageCop(u.id, dmg);
  else { sendEvent('copHit', { id: u.id, dmg: r1(dmg) }); killed = hp > 0 && hp - dmg <= 0; }
  report(killed ? (u.kind === 3 ? 'killheli' : 'killcop') : crimeType, u.kind < 2 ? u.v.x : u.x, u.kind < 2 ? u.v.z : u.z);
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
  scare(x, z, 45, 'explosion'); startle(x, z, 60); scareTraffic(x, z, 90); blastProps(x, y, z, R + 1.5);
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
function copDist(u, x, y, z) { if (u.kind === 4) return 1e9; const P = police.posOf(u); return Math.hypot(P.x - x, (u.kind < 2 ? u.v.y : u.y || 0) - y, P.z - z); }
// force: how hard the hit shoves them (bullets ~3, bat 7, cars and explosions much more)
function hurtWalker(w, dmg, dx, dz, p, force = 3, byNpc = false) {
  if (w.dead) return;
  w.hp -= dmg;
  const hp = p || { x: w.x, y: (w.y || 0) + 1.2, z: w.z };
  fx.blood(hp.x, hp.y, hp.z, dx, dz, 10);
  const vel = { x: dx * force, y: 1.2 + force * 0.25, z: dz * force };
  if (w.hp > 0) {
    if (force >= 6) knock(w, vel, false);
    else {
      flinch(w); w.ch.flinch = 0; if (!byNpc) provoke(w);
      // flinch the way the blow pushes them (combat.js react), a solid one shoves them back a step;
      // a leg hit makes them limp, a body hit makes them clutch the wound
      const hy = hp.y - (w.y || 0);
      combat.react(w.ch, w.h, dx, dz, hy, Math.min(1, force / 6));
      if (force >= 2.5) combat.push(w, dx, dz, 0.12 * force);
      if (hy < 0.8) w.limp = 30; else if (hy < 1.5 && Math.random() < 0.6) w.clutch = 12;
    }
  }
  else knock(w, vel, true);
  if (w.hp <= 0) {
    w.dead = { x: r1(w.x), z: r1(w.z), h: r2(w.h), t: net.now() };
    if (force >= 6 || byNpc) setTimeout(() => incident(w.x, w.z, 'down'), 1500);
    setTimeout(() => { const p = w.ch.rag ? ragPos(w.ch) : w; fx.bloodPool(p.x, p.z, 1.4); }, 1300); // pool forms where the body comes to rest
    if (!byNpc) report('kill', w.x, w.z);
    if (Math.random() < 0.75) dropCash(w.x, w.z, 5 + Math.floor(Math.random() * 40));
    reportDown(w);
    return true;
  }
  return false;
}
// imp (optional): a push like {x, y, z}; big pushes knock you over
// A bullet from (sx, sy, sz) at you in cover hits the cover instead: sparks or dust where it struck. true = you're safe.
function coverSaves(sx, sy, sz) {
  const p = !me.veh && cover.blocks(me, sx, sy, sz);
  if (!p) return false;
  fx.impact(p, { x: p.nx, y: 0, z: p.nz }, p.metal ? 'metal' : 'wall');
  if (p.metal) fx.sparks(p.x, p.y, p.z, 4, p.nx, p.nz);
  return true;
}
// a shot from another player or the police host: blocked by the cover you're behind?
function shotBlocked(e) {
  if (e.sx !== undefined) return coverSaves(+e.sx, +e.sy, +e.sz);
  const r = e.g && remotes.get(e.from);
  return !!r && coverSaves(r.x, r.y + 1.4, r.z);
}
function damageMe(dmg, by, bu, imp) {
  if (me.dead || dmg <= 0 || adm.god) return;
  dmg *= 0.45; // the player is tougher than everyone else (about 2.2x the health, bar still reads 0-100)
  if (me.armor > 0) { const soak = Math.min(me.armor, dmg * 0.7); me.armor -= soak; dmg -= soak; }
  me.hp -= dmg; me.lastBy = by; me.lastByUid = bu || '';
  me.lastImpulse = imp || null;
  ui.flashHurt();
  fx.blood(me.x, me.y + 1.2, me.z, 0, 0, 6);
  if (me.hp <= 0) { die(); return; }
  if (imp && Math.hypot(imp.x, imp.z) > 5 && !me.veh) knockMe(imp);
  else if (!me.veh) { // flinch (the way a push came from, else a random one) and jolt the camera
    const l = imp ? Math.hypot(imp.x, imp.z) : 0;
    combat.react(me.ch, me.h, l > 0.1 ? imp.x / l : 0, l > 0.1 ? imp.z / l : 0, 1.1 + Math.random() * 0.5, Math.min(1, dmg / 12), l > 0.1 ? null : ['gut', 'head', 'side'][Math.floor(Math.random() * 3)]);
  }
  combat.addTrauma(Math.min(0.35, 0.08 + dmg * 0.02));
}
// Knocked off your feet: physics takes over until you get back up.
function knockMe(vel, getUp = 2.2) {
  if (me.veh) return false;
  if (me.ch.rag) { ragdoll(me.ch, vel); return true; }
  closeWheel(false); cancelEnter();
  return !!ragdoll(me.ch, vel, { getUp, onUp: (p, h) => { me.x = p.x; me.z = p.z; me.h = h; me.y = W.isLand(p.x, p.z) ? W.groundHeight(p.x, p.z) : W.SWIM_Y; me.vy = 0; } });
}
function die() {
  closeWheel(false); minigames.close(); // shot at the card table: the bet on the table comes back
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
// After dying you wake up outside the nearest hospital (the streets there load first).
let respawning = false;
// BUSTED: cuffed at 1 star. Booked at the nearest station: stars gone, a fine, back out on the sidewalk outside.
async function bustMe() {
  if (respawning || me.dead) return;
  respawning = true;
  if (me.veh) ejectMe();
  cancelEnter(); closeWheel(false); minigames.close();
  ui.announce('BUSTED', '', '#ff5e5b');
  resetWanted(); me.busted = true; // the stars go at once (the cops stand down) while you're led off
  const st = police.stations().map((s) => [Math.hypot(s.x - me.x, s.z - me.z), s]).sort((a, b) => a[0] - b[0])[0]?.[1];
  await new Promise((r) => setTimeout(r, 1800));
  await loading(true, '', 'fade');
  if (st) await W.preload(st.x, st.z, 200, loadProgress);
  const sp = st ? { ...W.sidewalkSpot({ x: st.x, z: st.z, r: 70 }), name: st.name } : W.hospitalSpawn(me.x, me.z);
  if (!st) await W.preload(sp.x, sp.z, 200, loadProgress);
  manageParked(0, sp.x, sp.z, true);
  respawn(true, sp); // (no hospital bill)
  const fine = Math.min(eco.cash, Math.max(100, Math.round(eco.cash * 0.08)));
  eco.cash -= fine;
  ui.addFeed(`Released from ${sp.name || 'jail'}${fine ? `: fined $${fine}` : ''}`);
  setTimeout(() => { loading(false); startSpawnCam(); }, 300);
  respawning = false;
}
async function beginRespawn() {
  if (respawning) return;
  respawning = true;
  const sp = W.hospitalSpawn(me.x, me.z);
  await loading(true, '', 'fade'); // WASTED fades to black
  ui.el.dead.hidden = true;
  await W.preload(sp.x, sp.z, 200, loadProgress);
  manageParked(0, sp.x, sp.z, true);
  respawn(false, sp);
  ui.addFeed(`Patched up at ${sp.name || 'the hospital'}`);
  setTimeout(() => { loading(false); startSpawnCam(); }, 300);
  respawning = false;
}
function respawn(first, sp) {
  interior.leave(); me.outside = null;
  me.x = sp.x; me.z = sp.z; me.h = sp.h; me.y = W.groundHeight(sp.x, sp.z); me.vy = 0;
  if (!first && eco.cash > 0) { const bill = Math.min(eco.cash, Math.max(50, Math.round(eco.cash * 0.1))); eco.cash -= bill; ui.addFeed(`Hospital bill: -$${bill}`); }
  me.hp = 100; me.dead = false; me.busted = false; resetWanted(); resetDrunk(); me.enter = null; me.exitT = 0; me.reloadT = 0; me.swim = false; swim.reset(); cover.leave(); deathSpin = 0; me.rag = null;
  release(me.ch);
  me.ch.body.rotation.set(0, 0, 0); me.ch.body.position.y = 0;
  camYaw = sp.h;
  ui.el.dead.hidden = true;
  canvas.classList.remove('dead');
  me.ch.g.rotation.set(0, me.h, 0);
}

// G: say hi to whoever's in front of you. H: insult them (some people swing back).
function talk(nice) {
  if (me.dead || me.veh || (interior.room && interior.room.kind !== 'bar')) return;
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
    // distance to the car's body (not its centre), so you have to be right next to it
    const dx = me.x - v.x, dz = me.z - v.z, lf = dx * Math.sin(v.h) + dz * Math.cos(v.h), lr = dx * Math.cos(v.h) - dz * Math.sin(v.h);
    const d = Math.hypot(Math.max(0, Math.abs(lr) - v.T.wid / 2), Math.max(0, Math.abs(lf) - v.T.len / 2));
    if (d < reach && d < bd) { bd = d; best = v; }
  }
  return best;
}
// Getting in is a short sequence: walk to the door, open it, yank out whoever's driving, climb in.
function toggleVehicle() {
  if (me.dead || me.rag) return;
  if (me.enter) { cancelEnter(); return; }
  if (me.veh) { leaveVehicle(); return; }
  const v = nearestVehicle(1.3) || cj.cruiserNear(); // (a parked cruiser outside a station: break into it)
  if (!v) return;
  if (Math.hypot(v.vx || 0, v.vz || 0) > 3.5) { ui.flashPrompt("It's moving too fast to grab"); return; }
  if (!ebikes.beforeEnter(v)) return; // a docked Arnett Bike: pay to unlock it
  const seat = driverPlayer(v) ? freeSeat(v) : 0; // another player drives: ride along (no free seat: carjack as before)
  me.enter = { v, phase: 'walk', t: 0, seat };
  v.jackHold = !seat;
}
// ---------- passengers: me.veh with me.seat > 0 is riding in another player's car; only the driver's client simulates it ----------
const driverPlayer = (v) => !!(v.driver && v.driver !== net.uid && net.players[v.driver]);
// passenger seats (the driver's not counted)
const passSeats = (T) => (T.ebike ? 0 : T.bus ? 7 : T.limo ? 5 : T.bike || T.duster || T.truck || T.monster || T.cabbed || T.muscle || T.convertible || T.name === 'Sports car' ? 1 : 3);
function freeSeat(v) {
  const taken = new Set();
  for (const [uid, p] of Object.entries(net.players)) if (uid !== net.uid && p && Array.isArray(p.s) && p.s[5] === v.id && p.s[20] > 0) taken.add(p.s[20]);
  for (let i = 1; i <= passSeats(v.T); i++) if (!taken.has(i)) return i;
  return 0;
}
// Two players can grab the same seat in the same instant; the lower uid keeps it and the other moves to a free seat.
function seatClash(v) {
  for (const [uid, p] of Object.entries(net.players)) if (uid < net.uid && p && Array.isArray(p.s) && p.s[5] === v.id && p.s[20] === me.seat) return true;
  return false;
}
// world spot of seat i (0 driver, 1 front passenger, then rear rows left/right): the model's seat empties, else from the car's size
const SEAT_KEYS = ['D', 'P', 'RL', 'RR'], seatTmp = new THREE.Vector3();
function seatPos(v, i) {
  const loc = SEAT_KEYS[i] && v.mesh.userData.parts?.seats?.[SEAT_KEYS[i]], root = v.mesh.userData.body?.children[0];
  if (loc && root) { root.updateWorldMatrix(true, false); seatTmp.set(loc.x, loc.y - 0.5, loc.z); root.localToWorld(seatTmp); return { x: seatTmp.x, y: seatTmp.y, z: seatTmp.z }; }
  const T = v.T, sx = T.bike ? 0 : (i & 1 ? -1 : 1) * T.wid * 0.22, sz = T.bike ? -0.65 : T.len * 0.05 - (i >> 1) * Math.min(1.1, T.len * 0.2);
  return { x: v.x + Math.cos(v.h) * sx + Math.sin(v.h) * sz, y: v.y + (T.bike ? 0.25 : T.hgt * 0.1), z: v.z - Math.sin(v.h) * sx + Math.cos(v.h) * sz };
}
// sit in the seat and follow the car the driver's client sends (updateVehicles interpolates it like any remote car)
function rideUpdate(dt) {
  const v = me.veh;
  if (!driverPlayer(v) || v.exploded) { ejectMe(); return; } // driver got out, left the game, or the car's wrecked
  if (seatClash(v)) { const s = freeSeat(v); if (!s) { ejectMe(); ui.addFeed('No room in that car'); return; } me.seat = s; } // two of us took the same seat at once
  v.speed = Math.hypot(v.vx || 0, v.vz || 0); // for the speedo
  me.x = v.x; me.z = v.z; me.y = Math.max(W.SWIM_Y, v.y); me.h = v.h; me.vx = v.vx || 0; me.vz = v.vz || 0; me.moveSpeed = 0;
  const p = seatPos(v, me.seat);
  me.ch.g.visible = true; me.ch.g.position.set(p.x, p.y, p.z); me.ch.g.rotation.set(0, v.h, 0);
  animateCharacter(me.ch, dt, { sit: true, weapon: WEAPONS[me.weapon].kind === 'gun' ? 'gun' : 'none' });
}
function cancelEnter() {
  const e = me.enter; if (!e) return;
  e.v.jackHold = false; e.v.doorOpen = 0; me.enter = null;
}
function doorSpot(v, seat = 0) {
  const sg = seat & 1 ? -1 : 1, lx = Math.cos(v.h) * sg, lz = -Math.sin(v.h) * sg, off = v.T.bike ? 0.7 : v.T.wid / 2 + 0.55;
  const fw = seat > 1 && !v.T.bike ? 0.25 - (seat >> 1) * Math.min(1.1, v.T.len * 0.2) : 0.25; // rear seats: the back door
  return { x: v.x + lx * off + Math.sin(v.h) * fw, z: v.z + lz * off + Math.cos(v.h) * fw };
}
function enterUpdate(dt) {
  const e = me.enter, v = e.v;
  e.t += dt;
  if (v.exploded || v.hp <= 0 || v.sinkT > 0 || Math.hypot(v.vx || 0, v.vz || 0) > 5) { cancelEnter(); return; }
  const occupied = v.mode === 'traffic' || v.npcDriver || (v.driver && v.driver !== net.uid);
  const sg = e.seat & 1 ? -1 : 1; // which side of the car: the pose is mirrored on the passenger side
  let pose = { speed: 0 };
  if (e.phase === 'walk') {
    const d = doorSpot(v, e.seat), dx = d.x - me.x, dz = d.z - me.z, dist = Math.hypot(dx, dz);
    if (dist < 0.6 || e.t > 1.8) { e.phase = v.T.bike ? 'in' : cj.firstPhase(v, e.seat); e.t = 0; } // locked: try the handle first (carjack.js)
    else {
      const sp = Math.min(dist / dt, 5.5);
      me.x += (dx / dist) * sp * dt; me.z += (dz / dist) * sp * dt;
      me.h += angDiff(me.h, Math.atan2(dx, dz)) * Math.min(1, dt * 12);
      pose = { speed: 5 };
    }
  } else {
    if (e.phase !== 'in') me.h += angDiff(me.h, v.h - sg * Math.PI / 2) * Math.min(1, dt * 10); // face the car
    const brk = cj.enterStep(e, v, dt, sg); // try the handle, smash the window, reach in for the lock
    if (brk) pose = brk;
    else if (e.phase === 'open') { // reach for the handle and swing the door open (the animated door is the driver's)
      const k = Math.min(1, e.t / 0.55);
      if (!e.seat && k > 0.45) v.doorOpen = 1;
      pose = { act: { n: 'carOpen', k, side: sg } };
      if (e.t > 0.55) { e.t = 0; const jack = occupied && !e.seat; e.phase = jack ? 'yank' : 'in'; if (jack) yankDriver(v); }
    } else if (e.phase === 'yank') {
      pose = { pull: Math.min(1, e.t / 0.9) };
      if (e.t > 0.9) { e.phase = 'in'; e.t = 0; }
    } else if (e.phase === 'in') { // duck under the roof, then turn and slide into the seat
      const dur = v.T.bike ? 0.45 : 0.8, k = Math.min(1, e.t / dur), u = Math.max(0, (k * k * (3 - 2 * k) - 0.3) / 0.7);
      if (!e.from) e.from = { x: me.x, y: me.y, z: me.z, h: me.h };
      const st = v.T.bike ? { x: v.x - Math.sin(v.h) * 0.25, y: v.y + 0.2, z: v.z - Math.cos(v.h) * 0.25 } : seatPos(v, e.seat);
      me.x = e.from.x + (st.x - e.from.x) * u; me.z = e.from.z + (st.z - e.from.z) * u; me.y = e.from.y + (st.y - e.from.y) * u;
      me.h = e.from.h + angDiff(e.from.h, v.h) * u;
      pose = v.T.bike ? { sit: k > 0.5 } : { act: { n: 'carIn', k, side: sg } };
      if (k >= 1) { finishEnter(v); return; }
    }
  }
  myAct = pose.act || null;
  me.ch.g.visible = true;
  me.ch.g.position.set(me.x, me.y, me.z);
  me.ch.g.rotation.set(0, me.h, 0);
  animateCharacter(me.ch, dt, pose);
}
// your engine: rpm climbs through five gears; muscle and sports cars pop on lift-off
let lastGear = 0, offT = 0;
function engineSound(v, fwd, dt) {
  if (v.T.ebike) { ebikes.ebikeSound(v, fwd, dt); return; }
  const T = v.T, kind = T.bike ? (T.name === 'Scooter' ? 'scooter' : 'bike') : T.heli ? 'heli' : T.plane ? 'plane' : T.boat ? 'boat' : T.muscle || T.monster ? 'muscle' : T.name === 'Sports car' || T.convertible ? 'sports' : T.truck || T.bus || T.cabbed ? 'truck' : 'car';
  if (v.hp <= 0) { fx.setEngine(null); return; }
  const s = Math.min(1, Math.abs(v.speed || 0) / T.max), g = Math.min(4, Math.floor(s * 5)), frac = s * 5 - g;
  const rpm = T.heli ? (v.driver || v.y > 0.5 ? 0.6 + 0.4 * (fwd !== 0 ? 1 : 0) : 0) : T.plane ? 0.15 + 0.85 * (v.thr || 0) : s < 0.02 ? (fwd > 0 ? 0.35 : 0.06) : 0.2 + 0.8 * frac;
  fx.setEngine(kind, rpm, fwd > 0 ? 1 : 0.25);
  const tail = { x: v.x - Math.sin(v.h) * (T.len / 2 + 0.1), y: v.y + 0.35, z: v.z - Math.cos(v.h) * (T.len / 2 + 0.1) };
  if (fwd > 0 && s < 0.35 && Math.random() < dt * 6) fx.exhaust(tail.x, tail.y, tail.z, -(v.vx || 0), -(v.vz || 0));
  // lift off at high revs: pop pop
  if (fwd <= 0 && lastGear >= 0 && rpm > 0.65 && (kind === 'muscle' || kind === 'sports' || kind === 'bike') && offT <= 0 && Math.random() < 0.5) {
    fx.soundBackfire(); fx.exhaust(tail.x, tail.y, tail.z, -(v.vx || 0), -(v.vz || 0), true); offT = 1.2;
  }
  offT -= dt; lastGear = g;
}
function yankDriver(v) {
  if (v.mode === 'traffic' || v.npcDriver) cj.yank(v); // thrown down, then they run, fight, pull a gun or call the cops; passengers bail
  else if (v.driver && v.driver !== net.uid) { sendEvent('jack', { to: v.driver, id: v.id }); ui.announce('CARJACKED', nameOf(v.driver)); }
  if (v.patrol || v.T.police) report('hitcop', v.x, v.z); // dragging a cop out of a squad car
  eco.jacked++; checkCountGoals();
  fx.soundHit();
  report('carjack', v.x, v.z);
  ui.announce('CARJACKED');
}
function finishEnter(v) {
  if (me.enter.seat && driverPlayer(v)) { // (if the driver got out meanwhile you take the wheel instead)
    me.enter = null; v.jackHold = false;
    const seat = freeSeat(v); // again: someone may have taken it while we walked up
    if (!seat) { ui.flashPrompt('No free seat'); return; }
    me.veh = v; me.seat = seat;
    ui.flashPrompt(`Riding with ${nameOf(v.driver)}`);
    return;
  }
  const wasParked = v.mode === 'parked' || (!v.driver && v.mode !== 'traffic');
  me.enter = null;
  v.jackHold = false;
  if (!v.T.bike) { v.doorOpen = 1; v.doorCloseAt = performance.now() + 330; cj.afterEnter(v, anim.play('carShut', 0.6, { lock: false })); } else { v.doorOpen = 0; cj.afterEnter(v); } // (a broken-into car still needs hotwiring)
  me.veh = v; v.driver = net.uid; v.mode = 'free'; v.localSim = false; v.tgt = null; v.vx = v.vx || 0; v.vz = v.vz || 0;
  me.ch.g.visible = true; // you can see yourself at the wheel
  writeVeh(v, true);
  if (wasParked && !v.stolenOnce) { v.stolenOnce = true; report('steal', v.x, v.z); }
  if (v.T.police) goalDone('copcar');
}
// Getting out: slow = step out through the door, fast = bail and tumble.
function leaveVehicle() {
  const v = me.veh;
  if (v.sinkT > 0 && !v.T.boat && !me.seat) { // a car in the river: out through the door and swim for it (under, if it's gone under)
    const y = v.y + 0.4;
    ejectMe(); me.swim = true; me.x = v.x + (me.x - v.x) * 0.6; me.z = v.z + (me.z - v.z) * 0.6;
    swim.enter(me, 0, y < W.SWIM_Y - 0.6 ? y : null);
    return;
  }
  const sp = Math.hypot(v.vx, v.vz);
  if (sp > 9 && !v.T.bike) {
    const sg = me.seat & 1 ? -1 : 1, lx = Math.cos(v.h) * sg, lz = -Math.sin(v.h) * sg; // out of your own side
    ejectMe();
    const bv = { x: v.vx * 0.55 + lx * 3, y: 3, z: v.vz * 0.55 + lz * 3 };
    if (!knockMe(bv, 2)) me.rag = { t: 1.8, vx: bv.x, vy: bv.y, vz: bv.z, spin: 6, landed: false };
    damageMe(Math.min(45, sp * 0.8), 'bailing out', '');
    ui.announce('BAILED OUT');
    return;
  }
  if (v.T.bike || me.exitT > 0 || me.seat) { ejectMe(); return; } // (a passenger never steps the car, so no slow exit)
  me.exitT = 0.4;
  v.doorOpen = 1;
}
function ejectMe() {
  const v = me.veh;
  if (!v) return;
  me.veh = null;
  me.exitT = 0; me.exitStep = null; anim.stop('carShut');
  v.doorOpen = 1; v.doorCloseAt = performance.now() + 500;
  const lx = Math.cos(v.h), lz = -Math.sin(v.h), off = v.T.wid / 2 + 0.7, seat = me.seat;
  me.seat = 0;
  const d = seat ? doorSpot(v, seat) : { x: v.x + lx * off, z: v.z + lz * off }; // passengers: out beside their own seat
  const p = W.pushOutCircle(d.x, d.z, 0.4);
  me.x = p.x; me.z = p.z; me.y = W.isLand(p.x, p.z) ? W.groundHeight(p.x, p.z) : W.SWIM_Y; me.vy = 0; me.h = v.h;
  me.ch.g.position.set(me.x, me.y, me.z); me.ch.g.rotation.set(0, me.h, 0); // (the body was left where you got in; a ragdoll would start there)
  me.ch.g.visible = true;
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
    const wy = (w.y || 0) - (w.ducked && w.mode === 'hostile' ? 0.5 : 0); // (crouched behind cover)
    test(raySphere(o.x, o.y, o.z, d.x, d.y, d.z, w.x, wy + 1.05, w.z, 0.48), 'walker', w, false);
    test(raySphere(o.x, o.y, o.z, d.x, d.y, d.z, w.x, wy + 1.72, w.z, 0.26), 'walker', w, true);
  }
  for (const r of remotes.values()) {
    if (r.dead || (r.vehObj && !r.vehObj.T.bike) || !near(r.x, r.z)) continue;
    const ry = r.y - (r.coverLow ? 0.5 : 0);
    test(raySphere(o.x, o.y, o.z, d.x, d.y, d.z, r.x, ry + 1.05, r.z, 0.48), 'player', r, false);
    test(raySphere(o.x, o.y, o.z, d.x, d.y, d.z, r.x, ry + 1.72, r.z, 0.26), 'player', r, true);
  }
  for (const v of vehicles) if (v !== me.veh && !v.exploded && near(v.x, v.z)) test(vehRay(o, d, v), 'veh', v);
  for (const u of police.cops.values()) {
    if (police.isDown(u)) continue;
    if (u.kind < 2) { if (near(u.v.x, u.v.z)) test(vehRay(o, d, u.v), 'cop', u); }
    else if (u.kind === 2) { if (near(u.x, u.z)) { const uy = (u.y || 0) - (u.inCover && (u.aimT || 0) < 0.5 ? 0.5 : 0); test(raySphere(o.x, o.y, o.z, d.x, d.y, d.z, u.x, uy + 1.05, u.z, 0.48), 'cop', u, false); test(raySphere(o.x, o.y, o.z, d.x, d.y, d.z, u.x, uy + 1.72, u.z, 0.26), 'cop', u, true); } }
    else test(raySphere(o.x, o.y, o.z, d.x, d.y, d.z, u.x, u.y, u.z, 2.8), 'cop', u);
  }
  best.p = { x: o.x + d.x * best.t, y: o.y + d.y * best.t, z: o.z + d.z * best.t };
  return best;
}
function applyHit(hit, w, d) {
  if (hit.kind === 'walker') { const k = hurtWalker(hit.ref, w.dmg * (hit.head ? 2.5 : 1), d.x, d.z, hit.p, w.pellets ? 2.2 : w.name === 'Rifle' ? 4.5 : 3); ui.hitMarker(k); fx.soundHitMark(k); }
  else if (hit.kind === 'player') {
    sendEvent('hit', { to: hit.ref.uid, dmg: r1(w.dmg * (hit.head ? 2 : 1)), by: me.name, g: 1 });
    combat.react(hit.ref.ch, hit.ref.h, d.x, d.z, hit.p.y - hit.ref.y, 0.4); // (their own screen plays it too, and sends it on)
    fx.blood(hit.p.x, hit.p.y, hit.p.z, d.x, d.z); fx.soundHitMark(false); ui.hitMarker(false);
  } else if (hit.kind === 'veh') { cj.bulletHit(hit.ref, hit.p); damageVehicle(hit.ref, w.dmg * 0.45 * (hit.ref.mods?.bp ? 0.4 : 1)); if (hit.ref.patrol) report('hitcop', hit.ref.x, hit.ref.z); }
  else if (hit.kind === 'cop') { damageCopUnit(hit.ref, w.dmg * (hit.ref.kind === 2 ? (hit.head ? 2.5 : 1) : 0.6)); if (hit.ref.kind === 2) fx.soundHitMark(!!hit.ref.dead); }
}
function handPos() {
  if (me.veh) return { x: me.veh.x, y: me.veh.y + 1.4, z: me.veh.z };
  const mz = muzzleOf(me.ch); if (mz) return { x: mz.x, y: mz.y, z: mz.z };
  return { x: me.x + Math.sin(me.h) * 0.6 - Math.cos(me.h) * 0.35, y: me.y + 1.35, z: me.z + Math.cos(me.h) * 0.6 + Math.sin(me.h) * 0.35 };
}
function fire(w) {
  if (w.melee) { me.cd = 0; melee(w); return; } // (combat.js paces the combo and buffers presses)
  me.cd = combat.nextShot(me.cd, w, lastDt);
  const a = ammoOf(me.weapon);
  if (me.reloadT > 0) return;
  if (a.mag <= 0) { if (a.res > 0) startReload(); else { fx.soundClick(); ui.flashPrompt('Out of ammo. Buy more at Arnett Arms (red ⌖ on the map) or a corner store.'); } return; }
  a.mag--;
  if (w.grenade) { if (a.mag <= 0 && a.res > 0) { a.mag = 1; a.res--; } throwGrenade(w.molotov ? 'molotov' : 'nade'); refreshWeaponHud(); return; }
  if (w.rocket) { if (a.mag <= 0 && a.res > 0) startReload(); fireRocket(); refreshWeaponHud(); return; }
  me.aimT = 0.8;
  const blind = cover.blind() && !aiming; // blind-firing over / round cover: wild
  if (blind) cover.blindShot();
  if (!me.veh && !cover.inCover()) me.h = camYaw;
  const { o, d } = aimRay();
  const from = handPos();
  let last = null;
  for (let i = 0; i < (w.pellets || 1); i++) {
    const dd = spread(d, w.spread * combat.spreadMul(aiming, me.crouch || cover.inCover()) * (me.veh ? 1.6 : 1) * (blind ? 3.2 : 1) * (1 + Math.min(1, drunk.lvl) * 1.5));
    const hit = raycast(o, dd, w.range);
    shootProps(o, dd, hit.t);
    applyHit(hit, w, dd);
    bulletMarks(hit, dd);
    if (i < 3) fx.tracer(from, hit.p);
    last = hit.p;
  }
  me.shotSeq++; me.shot = [last.x, last.y, last.z];
  fx.muzzleFlash(from, d, w.pellets || w.name === 'Sniper' ? 1.5 : w.name === 'Pistol' ? 0.85 : 1);
  fx.soundShot(w.name === 'Sniper' ? 'sniper' : w.snd);
  me.recoil = 1; combat.shot(w, aiming);
  if (!w.rocket && !me.veh) fx.casing({ x: from.x - Math.sin(me.h) * 0.25, y: from.y + 0.03, z: from.z - Math.cos(me.h) * 0.25 }, { x: -Math.cos(me.h), z: Math.sin(me.h) });
  if (performance.now() - lastAttack > 1000) report('gunfire'); else lastAttack = performance.now();
  if (a.mag <= 0 && a.res > 0) startReload();
  refreshWeaponHud();
  panicNear(me.x, me.z, 30); startle(me.x, me.z, 30); scareTraffic(me.x, me.z, 60); bailOut(me.x, me.z, 22);
}
// Gunfire next to a car stuck in traffic: some drivers jump out and run, leaving the door open.
function bailOut(x, z, r) {
  for (const v of [...vehicles]) {
    if (v.mode !== 'traffic' || Math.abs(v.speed || 0) > 3 || v.T.bike || Math.hypot(v.x - x, v.z - z) > r || Math.random() > 0.35) continue;
    freeTraffic(v, true); v.npcDriver = false; v.doorOpen = 1; v.doorCloseAt = 0;
    const n = emptyCar(v), lx = Math.cos(v.h), lz = -Math.sin(v.h);
    for (let i = 0; i < Math.max(1, n); i++) spawnFleeing(v.x + lx * (i % 2 ? -1.7 : 1.7), v.z + lz * (i % 2 ? -1.7 : 1.7), Math.atan2(v.x - x, v.z - z), 0);
  }
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
// Melee: combat.js runs the combo (wind-up, contact, recovery, a buffered next press); a press picks who you're
// going for (the body turns and steps in during the wind-up) and meleeLand deals the blow at the contact frame.
const isLow = (wk) => wk.ch.rag || wk.ch.getUp > 0 || wk.mode === 'cower' || wk.freezeT > 0 || (wk.mode === 'surrender' && wk.giveUp && wk.giveUp !== 'cash');
function meleeTargets() {
  const L = [];
  for (const wk of walkers) if (!wk.dead) L.push({ x: wk.x, z: wk.z, ref: wk, kind: 'walker' });
  for (const u of police.cops.values()) if (u.kind === 2 && !u.dead) L.push({ x: u.x, z: u.z, ref: u, kind: 'cop' });
  for (const r of remotes.values()) if (!r.dead && !r.veh) L.push({ x: r.x, z: r.z, ref: r, kind: 'player' });
  return L;
}
function melee(w) {
  const t = combat.meleeTarget(me.x, me.z, camYaw, meleeTargets(), 3);
  me.meleeTgt = t ? t.ref : null;
  combat.meleePress(w, !!(t && t.kind === 'walker' && isLow(t.ref)), meleeLand);
}
function meleeLand(n, mv, low) {
  const w = WEAPONS[me.weapon];
  lastAttack = performance.now();
  const fx_ = Math.sin(me.h), fz_ = Math.cos(me.h);
  const inFront = (x, z) => { const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz); return d < mv.range && (dx * fx_ + dz * fz_) / (d || 1) > 0.3; };
  const hy = low ? 0.3 : mv.react === 'head' ? 1.6 : mv.react === 'gut' ? 1.05 : 1.35;
  const landed = () => { fx.soundHit(); combat.hitPause(mv.pause); combat.addTrauma(mv.down ? 0.38 : 0.1 + mv.dmg * 0.005); };
  for (const wk of walkers) if (!wk.dead && inFront(wk.x, wk.z)) {
    const k = hurtWalker(wk, mv.dmg, fx_, fz_, { x: wk.x, y: (wk.y || 0) + hy, z: wk.z }, mv.force);
    if (!k) report('assault', wk.x, wk.z); ui.hitMarker(k); landed();
    if (performance.now() - lastIncident > 6000) { lastIncident = performance.now(); incident(wk.x, wk.z, 'fight'); }
    return;
  }
  for (const u of police.cops.values()) if (u.kind === 2 && !u.dead && inFront(u.x, u.z)) { damageCopUnit(u, mv.dmg); landed(); return; }
  for (const r of remotes.values()) if (!r.dead && !r.veh && inFront(r.x, r.z)) {
    sendEvent('hit', { to: r.uid, dmg: mv.dmg, by: me.name, ...(mv.down ? { ix: r1(fx_ * 7), iz: r1(fz_ * 7) } : {}) }); // a finisher knocks them over
    combat.react(r.ch, r.h, fx_, fz_, hy, 0.6);
    report('assault', r.x, r.z); fx.blood(r.x, r.y + hy, r.z, fx_, fz_); landed(); return;
  }
  fx.soundSwish(w.kind === 'bat'); // nothing there
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
      const i = me.seat ? 0 : collideVehicles(me.veh, o, false); // (a passenger's car is the driver's to collide)
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
  anim.play('door', 0.5); // push it open as the screen fades
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
      if (o.patrol && !sliding) {
        copBump(Math.max(2.1, i0), o.x, o.z); // any touch on a patrol car counts as a tap
        if (isHost && wanted.stars > 0) { // it takes the call on the spot: now a police unit that chases you
          const u = adoptPatrol(o); if (pb) applyBump(o, pb);
          const hit = v.hit; if (!best || hit.imp > best.imp) best = hit;
          crashFx(v, hit); damageZone(o, hit.cp[0], hit.cp[1], hit.imp);
          if (hit.imp > 7) police.damageCop(u.id, (hit.imp - 7) * 3);
          continue;
        }
      }
      // tap: they brake, then a beat later lean on the horn and yell, or floor it out of there.
      // Anything harder knocks the car loose with the driver still in it; freeTraffic picks how they react.
      if (i0 < 4) {
        bumpTraffic(o);
        if (!o.honkCd || performance.now() > o.honkCd) { o.honkCd = performance.now() + 2500; setTimeout(() => { if (o.mode !== 'traffic' || !o.ag) return; if (Math.random() < 0.3) o.ag.panicT = 4 + Math.random() * 3; else honkYell(o); }, 600 + Math.random() * 900); }
      }
      else { freeTraffic(o, false, i0); if (pb) applyBump(o, pb); o.alarmUntil = Math.max(o.alarmUntil || 0, performance.now() / 1000 + 45); } // knocked loose: hazards on (pileups)
    } else {
      const pushable = !o.driver || o.driver === net.uid;
      if (collideVehicles(v, o, pushable) <= 0) continue;
      if (o.patrol && !sliding) copBump(v.hit.imp, o.x, o.z);
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
    if (!sliding && i > 7) damageCopUnit(u, (i - 7) * 3, 'ramcop'); else if (!sliding) copBump(i, u.v.x, u.v.z);
  }
  v.hit = best;
  return best ? best.imp : 0;
}

function adoptPatrol(v) { const i = vehicles.indexOf(v); if (i >= 0) vehicles.splice(i, 1); vehById.delete(v.id); return police.adoptCar(v, net.uid); }
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
  for (const u of police.cops.values()) if (u.kind < 2 && !police.isDown(u)) { allCars.push(u.v); if (chase && u.kind === 0 && u.target) sirens.push({ x: u.v.x, z: u.v.z }); }
  for (const v of vehicles) if (v.T.siren && v.sirenOn) sirens.push({ x: v.x, z: v.z });
  const fxp = me.veh ? me.veh.x : me.x, fzp = me.veh ? me.veh.z : me.z;
  camera.getWorldDirection(tmpDir);
  const q = activeQuality, night = weather.night > 0.5;
  const count = Math.round((q === 'low' ? 14 : q === 'medium' ? 30 : 42) * (night ? 0.6 : 1));
  const patrols = wanted.stars > 0 ? 0 : Math.round((q === 'low' ? 1 : q === 'medium' ? 2 : 3) * (night ? 1.5 : 1));
  tickTraffic(dt, { x: fxp, z: fzp }, { x: camera.position.x, z: camera.position.z, fx: tmpDir.x, fz: tmpDir.z }, obs, sirens, tSec, { radius: q === 'low' ? 200 : q === 'medium' ? 260 : 320, count, night, patrols });
  // once you're wanted, the nearest patrol car out on the streets takes the call (one at a time, while the response is short)
  if (wanted.stars > 0 && isHost) {
    let best = null, bd = 420;
    for (const v of traffic) { const d = v.patrol && v.mode === 'traffic' ? Math.hypot(v.x - fxp, v.z - fzp) : 1e9; if (d < bd) { bd = d; best = v; } }
    if (best && police.wantsUnit(net.uid)) adoptPatrol(best);
  }
  updateSignals(tSec);
}

// beyond this distance a car is drawn as a simple instanced silhouette
const farCarDist = () => (activeQuality === 'low' ? 45 : activeQuality === 'medium' ? 70 : 95) * (weather.night > 0.5 ? 1.6 : 1);
function updateVehicles(dt, tSec, nowMs) {
  applyNetSnapshots(dt);
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
        // a driver whose car got knocked loose reacts once it has come to rest
        if (v.npcDriver && v.npcOutT > 0 && Math.abs(v.speed || 0) < 1 && me.enter?.v !== v) {
          v.npcOutT -= dt;
          if (v.npcOutT <= 0) driverReacts(v);
        }
        if (v.driver && v.headFor !== v.driver) {
          v.headFor = v.driver;
          const look = v.driver === net.uid ? me.look : net.players[v.driver]?.c;
          if (Array.isArray(look)) { const L = normLook(look); head.material = mat(SKIN_TONES[L[3]]); }
        }
      }

      if (v === me.veh && !me.seat) { /* driven in updatePlayer */ }
      else if (v.localSim) {
        const wi = stepVehicle(v, {}, dt);
        if (v.hit && wi > 6) { crashFx(v, v.hit); damageZone(v, v.hit.cp[0], v.hit.cp[1], wi, v.hit.ly); }
        collideAround(v, true);
        if (Math.hypot(v.vx, v.vz) < 0.3 && Math.abs(v.frV || 0) + Math.abs(v.fpV || 0) < 0.2 && !(v.air > 0)) { v.localSim = false; v.vx = v.vz = 0; writeVeh(v, true); }
        else writeVeh(v);
      } else if (v.tgt) followNet(v, dt);
    }
    if (v.burnAt && !v.exploded) {
      if (!v.fire) v.fire = fx.startFire(v.mesh);
      if (nowMs - v.burnAt > 12000 && (v.burnBy === net.uid || (isHost && nowMs - v.burnAt > 16000))) explodeVehicle(v);
    }
    if (v.exploded && !v.charred) { v.charred = true; fx.stopFire(v.fire); v.fire = null; charVehicle(v); if (v.mesh.userData.neon) v.mesh.userData.neon.visible = false; } // no neon glow under a burnt-out shell
    if (v.doorCloseAt && performance.now() > v.doorCloseAt) { v.doorOpen = 0; v.doorCloseAt = 0; }
    const dl = v.mesh.userData.parts && v.mesh.userData.parts.doorL;
    if (dl) { v.doorAng = (v.doorAng || 0) + ((v.doorOpen ? 1.15 : 0) - (v.doorAng || 0)) * Math.min(1, dt * 9); dl.rotation.y = -v.doorAng; }
    v.mesh.position.set(v.x, v.y, v.z);
    v.mesh.rotation.y = v.h;
    const isFar = v !== me.veh && !v.fire && Math.hypot(v.x - cx, v.z - cz) > FAR && farCarAdd(v);
    v.mesh.visible = !isFar;
    if (isFar) continue;
    const body = v.mesh.userData.body;
    animateWheels(v, dt);
    body.rotation.z = v.T.bike ? (v.driver ? v.tilt : v.dock ? 0 : 0.3) : 0;
    body.rotation.x = v.T.boat || v.T.heli ? v.pitch || 0 : v.air > 0.05 ? clamp(-(v.vy || 0) * 0.025, -0.35, 0.35) + (v.gp || 0) : v.gp || 0;
    // cars: ground slope + weight transfer / suspension (sr, sp, sy) + tipping over (fr, fp), lifted onto the lowest corner
    if (v.T.plane) planeVisual(v, body, dt);
    else if (!v.T.bike && !v.T.heli && !v.T.boat) {
      body.rotation.set((v.gp || 0) + (v.sp || 0) + (v.fp || 0), 0, (v.gr || 0) + (v.sr || 0) + (v.fr || 0));
      body.position.y = (v.sy || 0) + tipLift(v.T, v.fr, v.fp);
      animateDamage(v, dt);
    }
    if (v.T.heli) { body.rotation.z = v.tilt || 0; const rt = v.mesh.userData.rotor; if (rt) rt.rotation.y += dt * (v.driver || v.y > 0.5 ? 32 : 0); }
    if (v.hp < v.T.hp * 0.35 && !v.exploded && (v.hp > 0 || Math.random() < 0.6) && Math.abs(v.x - camera.position.x) < 120 && Math.abs(v.z - camera.position.z) < 120) fx.damageSmoke(v);
  }
}

function updatePlayer(dt) {
  const px = me.x, pz = me.z;
  if (me.ch.rag || me.dead || me.rag || me.enter) { combat.meleeCancel(); cover.leave(); }
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
  if (me.busted) { // hands up while they cuff you (bustMe)
    animateCharacter(me.ch, dt, { handsUp: true }); me.ch.g.visible = true;
    placeCharacter(me.ch, me.x, me.y, me.z, me.h); me.vx = me.vz = 0; me.moveSpeed = 0;
    return;
  }
  me.cd -= dt; me.hitCd -= dt; me.aimT = Math.max(0, me.aimT - dt); lastDt = dt;
  combat.tickMelee(dt);
  if (me.reloadT > 0) {
    me.reloadT -= dt;
    if (me.reloadT <= 0) { const w = WEAPONS[me.weapon], a = ammoOf(me.weapon), n = Math.min(w.mag - a.mag, a.res); a.mag += n; a.res -= n; refreshWeaponHud(); }
  }
  myAct = anim.update(dt); // the action playing now (src/anim.js), if any
  me.ch.g.visible = true;
  if (me.enter) { enterUpdate(dt); me.vx = (me.x - px) / dt; me.vz = (me.z - pz) / dt; me.moveSpeed = 3; return; }
  if (me.exitT > 0 && me.veh) { // still sat: push the door open
    const v = me.veh;
    me.exitT -= dt;
    stepVehicle(v, { handbrake: true }, dt);
    me.x = v.x; me.z = v.z;
    const p = seatPos(v, 0);
    me.ch.g.position.set(p.x, p.y, p.z); me.ch.g.rotation.set(0, v.h, 0);
    myAct = { n: 'carOut', k: 0.3 * (1 - me.exitT / 0.4), side: 1 };
    animateCharacter(me.ch, dt, { act: myAct });
    if (me.exitT <= 0) { ejectMe(); me.exitStep = { v, from: p, to: { x: me.x, y: me.y, z: me.z }, h0: v.h, t: 0 }; v.doorCloseAt = performance.now() + 1200; }
    return;
  }
  if (me.exitStep) { exitStep(dt); me.vx = (me.x - px) / dt; me.vz = (me.z - pz) / dt; return; }
  if (me.rag) { ragdollUpdate(dt); me.vx = (me.x - px) / dt; me.vz = (me.z - pz) / dt; return; }
  if (me.swing > 0) me.swing = Math.max(0, me.swing - dt * 3);
  const still = adm.frozen ? 0 : 1; // frozen by an admin: no moving or shooting
  const fwd = still * ((keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0));
  const side = still * ((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0));
  if (me.seat) rideUpdate(dt); else if (me.veh) driveUpdate(dt, fwd, side); else if (adm.fly) flyUpdate(dt, fwd, side); else if (me.swim && !me.move && !anim.busy()) swimStep(dt, fwd, side); else footUpdate(dt, fwd, side);
  if (!me.veh) { me.vx = (me.x - px) / dt; me.vz = (me.z - pz) / dt; }
  const w = WEAPONS[me.weapon];
  const wantFire = locked && still && (w.auto ? mouseDown : clicked);
  clicked = false;
  if (wantFire && w.melee && cover.active()) cover.leave(); // a punch from cover: step out and throw it
  if (wantFire && (me.cd <= 0 || w.melee) && !me.dead && !me.swim && !(me.veh && w.melee)) fire(w);
  if (me.veh || me.swim || me.dead || !w.melee) combat.meleeCancel();
  if (me.veh && me.swim) { me.swim = false; swim.reset(); } // climbed into a boat from the water
  if (!me.swim && !(me.veh && me.veh.sinkT > 0)) swim.state.breath = Math.min(1, swim.state.breath + dt / 3.5); // air again
}
let lastDt = 1 / 60;

// Out of the seat: swing the legs out, stand up beside the car (turning toward the door and back), then shove it shut.
function exitStep(dt) {
  const e = me.exitStep;
  e.t += dt;
  const k = Math.min(1, e.t / 0.7), u = k * k * (3 - 2 * k);
  if (keys.has('KeyW') || keys.has('KeyS') || keys.has('KeyA') || keys.has('KeyD') ? k > 0.6 : false) e.t = 0.7; // in a hurry: cut it short
  me.x = e.from.x + (e.to.x - e.from.x) * u; me.z = e.from.z + (e.to.z - e.from.z) * u; me.y = e.from.y + (e.to.y - e.from.y) * u;
  me.h = e.h0 + Math.PI / 2 * Math.sin(Math.min(1, k * 1.4) * Math.PI) * 0.7;
  myAct = { n: 'carOut', k: 0.3 + 0.7 * k, side: 1 };
  me.moveSpeed = 0; me.vy = 0;
  me.ch.g.position.set(me.x, me.y, me.z); me.ch.g.rotation.set(0, me.h, 0);
  animateCharacter(me.ch, dt, { act: myAct });
  if (k >= 1) { me.exitStep = null; me.h = e.h0; e.v.doorCloseAt = performance.now() + 220; anim.play('shutStand', 0.5, { lock: false }); }
}

// Thrown out of a car: tumble, bounce, lie there, get up.
function launchMe(v, vx, vy, vz) {
  me.veh = null;
  me.exitT = 0;
  if (v.driver === net.uid) { v.driver = ''; v.localSim = true; writeVeh(v, true); }
  const f = { x: Math.sin(v.h), z: Math.cos(v.h) };
  // start at the windshield, not past the bumper (that's inside whatever you hit)
  me.x = v.x + f.x * v.T.len * 0.2; me.z = v.z + f.z * v.T.len * 0.2; me.y = v.y + 1.2; me.h = v.h;
  // the body mesh was left where you got in: move it here first, the ragdoll is built from its matrix
  me.ch.g.position.set(me.x, me.y, me.z); me.ch.g.rotation.set(0, v.h, 0); me.ch.g.visible = true;
  syncPhysics(me.x, me.z); // ground/walls exist only near the last sync point; a fast car can outrun it
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

// Space in front of something: climb onto a low roof or wall top, or vault over a car / low wall.
function tryClimb() {
  const fx_ = Math.sin(me.h), fz_ = Math.cos(me.h);
  // a parked car right in front: vault the hood
  for (const v of vehicles) {
    if (v.T.bike || v.T.boat || v.T.heli || Math.abs(v.x - me.x) > 4 || Math.abs(v.z - me.z) > 4 || v.T.hgt > 1.95) continue;
    const ahead = { x: me.x + fx_ * 0.9, z: me.z + fz_ * 0.9 }, q = pushCharOut(ahead.x, ahead.z, 0.3, v);
    if (Math.hypot(q.x - ahead.x, q.z - ahead.z) < 1e-3) continue;
    const across = v.T.wid + 1.0, to = { x: me.x + fx_ * across, z: me.z + fz_ * across };
    if (W.pushOutCircle(to.x, to.z, 0.4).hit) return false;
    me.move = { kind: 'vault', t: 0, dur: 0.75, from: { x: me.x, y: me.y, z: me.z }, to: { x: to.x, y: W.groundHeight(to.x, to.z), z: to.z }, peak: v.y + v.T.hgt + 0.15 };
    return true;
  }
  // a wall: is its top (a roof) within reach?
  const t = W.rayBuildings(me.x, me.y + 0.5, me.z, fx_, 0, fz_, 1.1);
  if (t > 1.05) return false;
  const tx = me.x + fx_ * (t + 0.45), tz = me.z + fz_ * (t + 0.45), top = W.roofAt(tx, tz), rise = top - me.y;
  if (!(rise > 0.6 && rise < 2.7)) return false;
  me.move = { kind: rise < 1.3 ? 'vault' : 'climb', t: 0, dur: rise < 1.3 ? 0.6 : 1.1, from: { x: me.x, y: me.y, z: me.z }, to: { x: tx, y: top + 0.05, z: tz }, peak: top + 0.25 };
  return true;
}
function footUpdate(dt, fwd, side) {
  const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  if (anim.busy() && !me.move) { // an action holds you: doors, the counter, a seat, a minigame
    const sitting = anim.playing('sit') || anim.playing('stool');
    if (sitting && (fwd || side || me.sitAt?.bench?.broken)) standUp_(); // (a car took the bench out)
    else {
      if (me.sitAt) { me.x = me.sitAt.x; me.z = me.sitAt.z; me.h = me.sitAt.h; }
      me.moveSpeed = 0; me.vy = 0; me.netPose = 0; me.netK = 0;
      me.ch.g.position.set(me.x, me.y, me.z); me.ch.g.rotation.set(0, me.h, 0);
      anim.holdProps(me.ch, myAct);
      animateCharacter(me.ch, dt, { ...anim.poseFields(myAct), weapon: 'none', wmodel: null });
      return;
    }
  }
  // mid-climb / mid-vault: the move drives you, no steering
  if (me.move) {
    const m = me.move; m.t += dt;
    const k = Math.min(1, m.t / m.dur), e = k * k * (3 - 2 * k);
    me.x = m.from.x + (m.to.x - m.from.x) * (m.kind === 'climb' ? Math.max(0, (k - 0.55) / 0.45) : e);
    me.z = m.from.z + (m.to.z - m.from.z) * (m.kind === 'climb' ? Math.max(0, (k - 0.55) / 0.45) : e);
    me.y = m.kind === 'climb' ? m.from.y + (m.to.y - m.from.y) * Math.min(1, k / 0.6) : m.from.y + (m.to.y - m.from.y) * e + Math.sin(k * Math.PI) * Math.max(0.3, m.peak - Math.max(m.from.y, m.to.y));
    me.vy = 0; me.moveSpeed = 0;
    me.ch.g.position.set(me.x, me.y, me.z); me.ch.g.rotation.set(0, me.h, 0);
    me.netPose = m.kind === 'climb' ? 8 : 16; me.netK = Math.round(k * 100) / 100;
    animateCharacter(me.ch, dt, m.kind === 'climb' ? { climb: k } : { vault: k });
    if (k >= 1) { me.move = null; me.grounded = true; }
    return;
  }
  if (cover.active() && !me.swim && coverStep(dt, fwd, side)) return;
  const crouch = !!me.crouch && !me.swim;
  const mv = combat.meleeNow(); // throwing a punch / swinging: feet mostly planted
  const speed = (me.swim ? 2.6 : aiming ? 2.6 : crouch ? 2.0 : sprint ? 8 : 4.5) * adm.speed * (mv ? combat.meleeMoveScale() : 1);
  if (sprint && crouch && fwd) me.crouch = false;
  const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
  let mx = Math.sin(camYaw) * fwd + rx * side, mz = Math.cos(camYaw) * fwd + rz * side;
  const ml = Math.hypot(mx, mz);
  if (ml > 0) { mx /= ml; mz /= ml; }
  if (ml > 0 && drunk.lvl > 0.15 && !me.swim) { const d = wobble(dt) * 0.6; [mx, mz] = [mx + mz * d, mz - mx * d]; } // drunk: weave sideways
  const wk = WEAPONS[me.weapon].kind;
  const aimPose = wk === 'gun' && !me.swim && (aiming || me.aimT > 0 || me.robAim); // (holding up a store: gun on the clerk)
  let lunge = 0;
  if (mv) { // face who you're hitting (or where you look) and step in during the wind-up
    const t = me.meleeTgt && !me.meleeTgt.dead ? me.meleeTgt : null;
    const tx = t ? t.x - me.x : Math.sin(camYaw), tz = t ? t.z - me.z : Math.cos(camYaw);
    me.h += angDiff(me.h, Math.atan2(tx, tz)) * Math.min(1, dt * 22);
    const info = combat.moveInfo(mv.n);
    if (combat.meleeWindup() && t && Math.hypot(tx, tz) > 1.05) lunge = (info.lunge / (info.dur * info.hit)) * dt;
  } else if (ml > 0 || aimPose || me.swing > 0) {
    const target = aimPose || me.swing > 0 ? camYaw : Math.atan2(mx, mz);
    me.h += angDiff(me.h, target) * Math.min(1, dt * 12);
  }
  const ox = me.x, oz = me.z;
  me.x += mx * speed * dt + Math.sin(me.h) * lunge; me.z += mz * speed * dt + Math.cos(me.h) * lunge;
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
  me.vy -= 20 * adm.gravity * dt;
  me.y += me.vy * dt;
  if (land) {
    me.swim = false;
    const gh = interior.room ? interior.room.y : W.surfaceHeight(me.x, me.z, me.y); // roofs count when you're on them
    if (me.y <= gh + 0.05 && me.vy <= 0) { me.y = gh; me.vy = 0; me.grounded = true; } else me.grounded = false;
    if (me.grounded && keys.has('Space') && !me.move) { if (!tryClimb()) { me.vy = 6.5 * adm.jump; me.grounded = false; me.crouch = false; } }
  } else {
    if (me.y <= W.SWIM_Y) { const vy = me.vy; me.y = W.SWIM_Y; me.vy = 0; me.swim = true; me.crouch = false; cover.leave(); swim.enter(me, vy); } // in: src/swim.js takes over
    me.grounded = false;
  }
  me.moveSpeed = ml > 0 ? speed : 0;
  // footsteps: twice per walk cycle, a sound for the ground under you
  if (me.grounded && ml > 0) {
    const ph = Math.floor((me.ch.walk || 0) / Math.PI);
    if (ph !== me.stepPh) {
      me.stepPh = ph;
      const cls = interior.room ? 'wood' : W.classAt(me.x, me.z), onRoof = W.buildingKindAt(me.x, me.z) >= 0 && me.y > W.groundHeight(me.x, me.z) + 1;
      const kind = weather.snow > 0.4 && !interior.room ? 'snow' : weather.wet > 0.6 ? 'water' : onRoof ? 'metal' : cls === W.C.lawn || cls === W.C.park || cls === W.C.wood ? 'grass' : 'concrete';
      fx.footstep(kind, sprint ? 1.3 : 1);
    }
  }
  me.ch.g.visible = true;
  me.ch.g.position.set(me.x, me.y, me.z);
  me.ch.g.rotation.set(0, me.h, 0);
  const wpn = WEAPONS[me.weapon];
  me.recoil = Math.max(0, (me.recoil || 0) - dt * 8);
  me.netPose = ((crouch && !aimPose) ? 1 : 0) | (me.reloadT > 0 ? 4 : 0); me.netPitch = aimPose ? Math.round(-camPitch * 57) : 0; me.netK = 0;
  // the phone: thumbing it in front of you, or held to your ear on a call (stacks with walking)
  if (phone.isOpen() && !myAct) myAct = { n: phone.inCall() ? 'call' : 'phone', k: 0, side: 1 };
  if (myAct && me.moveSpeed > 0 && !anim.busy() && myAct.n !== 'phone' && myAct.n !== 'call') { anim.stop(); myAct = null; } // walking off cancels a small action
  anim.holdProps(me.ch, myAct);
  animateCharacter(me.ch, dt, { ...anim.poseFields(myAct), crouch: crouch && !aimPose, speed: aimPose ? Math.min(me.moveSpeed, 3) : me.moveSpeed, aim: aimPose, swim: me.swim,
    melee: me.swim ? null : mv, swing: me.swing > 0 ? 1 - me.swing : 0, // (swing: a grenade throw)
    moveRel: aimPose && ml > 0 ? angDiff(me.h, Math.atan2(mx, mz)) : 0, aimYaw: aimPose ? angDiff(me.h, camYaw) : 0,
    weapon: me.swim ? 'none' : wk, wmodel: me.swim ? null : wpn.model, rifle: wpn.long, recoil: me.recoil, reload: me.reloadT > 0 ? 1 - me.reloadT / combat.reloadTime(wpn) : 0, pitch: aimPose ? -camPitch * 57 : 0, carry: !aimPose && wpn.long });
}

// In cover (src/cover.js works out where you are along it and how far you've popped out); false = you just left it.
function coverStep(dt, fwd, side) {
  const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
  let mx = Math.sin(camYaw) * fwd + rx * side, mz = Math.cos(camYaw) * fwd + rz * side;
  const ml = Math.hypot(mx, mz); if (ml > 0) { mx /= ml; mz /= ml; }
  const wpn = WEAPONS[me.weapon], wk = wpn.kind;
  const r = cover.update(dt, { x: me.x, y: me.y, z: me.z, mx, mz, cfx: Math.sin(camYaw), cfz: Math.cos(camYaw), aiming: aiming || !!me.robAim, gun: wk === 'gun', jump: keys.has('Space') });
  if (r.left) {
    if (r.x !== undefined) { me.x = r.x; me.z = r.z; }
    if (r.vault) { me.h = r.h; tryClimb(); }
    return false;
  }
  me.x = r.x; me.z = r.z;
  const aimPose = !!r.aimOut;
  me.h += angDiff(me.h, aimPose ? camYaw : r.h) * Math.min(1, dt * 14);
  const gh = interior.room ? interior.room.y : W.surfaceHeight(me.x, me.z, me.y);
  me.y = gh; me.vy = 0; me.grounded = true;
  me.moveSpeed = r.speed;
  me.recoil = Math.max(0, (me.recoil || 0) - dt * 8);
  me.netPose = me.reloadT > 0 ? 4 : 0; me.netPitch = aimPose ? Math.round(-camPitch * 57) : 0; me.netK = 0;
  me.ch.g.visible = true; me.ch.g.position.set(me.x, me.y, me.z); me.ch.g.rotation.set(0, me.h, 0);
  if (myAct && !anim.busy() && myAct.n !== 'phone' && myAct.n !== 'call') { anim.stop(); myAct = null; }
  anim.holdProps(me.ch, myAct);
  animateCharacter(me.ch, dt, { ...anim.poseFields(myAct), ...r.pose, speed: r.speed, aim: aimPose, aimYaw: aimPose ? angDiff(me.h, camYaw) : 0,
    weapon: wk, wmodel: wpn.model, rifle: wpn.long, recoil: me.recoil, reload: me.reloadT > 0 ? 1 - me.reloadT / combat.reloadTime(wpn) : 0, pitch: aimPose ? -camPitch * 57 : 0 });
  return true;
}
// In the water (src/swim.js does the strokes, diving, breath and climbing out).
function swimStep(dt, fwd, side) {
  cover.leave(); me.crouch = false; aiming = false; me.lockOn = null;
  const r = swim.update(dt, me, { fwd, side, camYaw, camPitch: camPitch - 0.22, sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'), up: keys.has('Space'), down: keys.has('KeyC') });
  me.x = r.x; me.y = r.y; me.z = r.z; me.h = r.h; me.vy = 0; me.grounded = false; me.moveSpeed = r.speed;
  if (r.drown) drownMe(r.drown);
  me.netPose = 0; me.netK = 0; me.netPitch = 0;
  me.ch.g.visible = true; me.ch.g.position.set(me.x, me.y, me.z); me.ch.g.rotation.set(0, me.h, 0);
  if (myAct && !anim.busy()) { anim.stop(); myAct = null; }
  anim.holdProps(me.ch, null);
  if (r.out) { me.swim = false; me.grounded = true; animateCharacter(me.ch, dt, { speed: 0, weapon: 'none', wmodel: null }); return; }
  if (r.climb !== undefined) { me.netPose = 8; me.netK = Math.round(r.climb * 100) / 100; animateCharacter(me.ch, dt, { climb: r.climb }); return; }
  animateCharacter(me.ch, dt, { ...r.pose, speed: r.speed, weapon: 'none', wmodel: null });
}
// out of breath underwater: armor doesn't help
function drownMe(d) {
  if (me.dead || adm.god) return;
  me.hp -= d; me.lastBy = 'drowning'; me.lastByUid = '';
  if (Math.random() < 0.08) ui.flashHurt();
  if (me.hp <= 0) die();
}
// the view under the water: murky green-brown, short sight, no sky, sound muffled
const UNDER_COL = new THREE.Color(0x335a4c);
let riverBed = null; // a muddy floor under you while diving (the map has no mesh under open water)
function waterView() {
  const c = camera.position, uw = playing && c.y < W.WATER_Y - 0.05 && !W.isLand(c.x, c.z) && !interior.room;
  scene.userData.sky.visible = !uw;
  if (uw) {
    scene.fog.color.copy(UNDER_COL); scene.background.copy(UNDER_COL); scene.fog.near = 0.5; scene.fog.far = 26;
    if (!riverBed) { riverBed = new THREE.Mesh(new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x5a5638 })); riverBed.receiveShadow = false; scene.add(riverBed); }
    riverBed.position.set(c.x, W.terrainHeight(c.x, c.z) - 0.03, c.z);
  }
  if (riverBed) riverBed.visible = uw;
  fx.setUnderwater(uw);
}
// admin noclip: fly where the camera looks, through everything. Space up, Shift down, Ctrl fast.
function flyUpdate(dt, fwd, side) {
  const sp = (keys.has('ControlLeft') || keys.has('ControlRight') ? 60 : 18) * adm.speed, cp = Math.cos(camPitch);
  const up = (keys.has('Space') ? 1 : 0) - (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1 : 0);
  me.x += (Math.sin(camYaw) * cp * fwd - Math.cos(camYaw) * side) * sp * dt;
  me.z += (Math.cos(camYaw) * cp * fwd + Math.sin(camYaw) * side) * sp * dt;
  me.y = Math.max(W.SWIM_Y - 30, me.y + (-Math.sin(camPitch) * fwd + up) * sp * dt);
  me.vy = 0; me.h = camYaw; me.swim = false; me.grounded = false; me.move = null; me.moveSpeed = 0; me.netPose = 0; me.netK = 0;
  me.ch.g.visible = true; me.ch.g.position.set(me.x, me.y, me.z); me.ch.g.rotation.set(0, me.h, 0);
  animateCharacter(me.ch, dt, { speed: 0, weapon: WEAPONS[me.weapon].kind, wmodel: WEAPONS[me.weapon].model });
}
function driveUpdate(dt, fwd, side) {
  const v = me.veh;
  const pre = { vx: v.vx, vz: v.vz, speed: v.speed };
  const shift = keys.has('ShiftLeft') || keys.has('ShiftRight');
  // gas and brake read separately so holding both does a burnout
  const gas = keys.has('KeyW') || keys.has('ArrowUp'), brk = keys.has('KeyS') || keys.has('ArrowDown');
  const imp = stepVehicle(v, { throttle: gas ? cj.gas(v) : 0, brake: brk ? 1 : 0, steer: drunkSteer(dt, -side), handbrake: !v.T.heli && !v.T.plane && keys.has('Space'), nitro: shift && !v.T.heli && !v.T.plane, up: keys.has('Space'), down: shift }, dt);
  if (!cj.engine(v, dt, gas)) engineSound(v, v.burnout ? 1 : fwd, dt); // (hotwiring: cranking and sparks instead)
  // police spike strip: tyres burst (bulletproof tyres shrug it off)
  if (!v.flat && !v.mods?.bp && !v.T.boat && !v.T.heli && police.spikesHit(v)) { v.flat = true; fx.sparks(v.x, v.y + 0.3, v.z, 14); fx.soundBoom(30); ui.flashPrompt('Tyres blown!'); }
  if (v.flat && Math.abs(v.speed) > 4 && Math.random() < dt * 8) fx.sparks(v.x - Math.sin(v.h) * v.T.len * 0.35, v.y + 0.1, v.z - Math.cos(v.h) * v.T.len * 0.35, 2);
  if (v.boosting) { fx.sparks(v.x - Math.sin(v.h) * v.T.len / 2, v.y + 0.4, v.z - Math.cos(v.h) * v.T.len / 2, 2, -Math.sin(v.h), -Math.cos(v.h)); if (!v.boostSnd) { fx.soundNitro(); v.boostSnd = true; } } else v.boostSnd = false;
  if (v.T.boat && Math.abs(v.speed) > 6 && Math.random() < 0.5) fx.smokePuff(v.x - Math.sin(v.h) * v.T.len / 2, -0.1, v.z - Math.cos(v.h) * v.T.len / 2, true, 0.6);
  const wallHit = v.hit;
  if (wallHit) { crashFx(v, wallHit); if (imp > 6) damageZone(v, wallHit.cp[0], wallHit.cp[1], imp, wallHit.ly); }
  hitByCar(v); // mailboxes, hydrants, poles...
  const vImp = collideAround(v, false);
  const vHit = v.hit;
  let total = Math.max(imp, vImp);
  // how hard the crash was = the speed change it caused this frame (≈ closing speed × 1.15 off a wall)
  if (wallHit || vHit) total = Math.max(total, Math.hypot(v.vx - pre.vx, v.vz - pre.vz) - 0.6);
  // loops: tyre screech by slip, metal scraping (with sparks streaming off the contact) by slide speed, turbo
  const land = v.air === 0 && v.sinkT === 0 && !v.T.boat && !v.T.heli;
  fx.setScreech(!land ? 0 : v.burnout ? 1 : clamp((v.slip - 3) / 8, 0, 1) * clamp((Math.abs(v.speed) - 3) / 6, 0, 1));
  const tc = v.touch, spd = Math.hypot(v.vx, v.vz);
  let scrape = 0, sp0 = null;
  if (v.upset && land && spd > 2) { scrape = Math.min(1, spd / 15); sp0 = [v.x, v.y + 0.2, v.z]; }
  else if (tc && performance.now() - tc.t < 150) { scrape = clamp((Math.abs(-v.vx * tc.nz + v.vz * tc.nx) - 1.5) / 12, 0, 1); sp0 = [tc.cp[0], v.y + 0.45, tc.cp[1]]; }
  fx.setScrape(scrape);
  if (scrape > 0.05 && Math.random() < 0.8) fx.scrapeSparks(sp0[0], sp0[1], sp0[2], v.vx, v.vz, 1 + Math.round(scrape * 4));
  fx.setTurbo(v.spool || 0, gas);
  if (v.rough && land && spd > 6) shake = Math.max(shake, Math.min(0.08, spd * 0.004)); // bumpy off-road
  // through the windshield: big frontal hit with no time to brake
  const mainHit = imp >= vImp ? wallHit : vHit;
  if (mainHit && !me.dead) {
    const dv = Math.hypot(v.vx - pre.vx, v.vz - pre.vz);
    const frontal = mainHit.nx * Math.sin(v.h) + mainHit.nz * Math.cos(v.h) < -0.55;
    if (frontal && !v.T.boat && !v.T.heli && !v.T.plane && (v.T.ebike ? pre.speed > 5 && dv > 4 : v.T.bike ? pre.speed > 14 && dv > 8 : pre.speed > 25 && dv > 18)) {
      damageVehicle(v, (total - 7) * 3, mainHit);
      launchMe(v, pre.vx * 0.7, 4 + pre.speed * 0.08, pre.vz * 0.7);
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
    if (Math.random() < (v.burnout ? 0.9 : 0.3)) fx.smokePuff(v.x + bx, v.y + 0.3, v.z + bz, true, v.burnout ? 0.8 : 0.5);
  }
  if (total > 5) {
    // sedan: 13 m/s head-on into a wall ≈ 24 HP, 27 m/s ≈ 77 HP (wrecked); scrapes under 5 m/s are free
    damageVehicle(v, (total - 5) * 2 * (1 + (total - 5) / 60) * (1.3 / v.T.mass) ** 0.5);
    if (total > 14) damageMe((total - 14) * (v.T.bike ? 4 : 2), 'a crash', '');
    if (me.dead) return;
    if (v.T.bike && total > (v.T.ebike ? 6 : 13)) { ejectMe(); syncPhysics(me.x, me.z); if (!knockMe({ x: pre.vx * 0.6, y: 4, z: pre.vz * 0.6 }, 2.2)) me.vy = 4; return; }
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
  // in the river: it sinks (vehicles.js); once the cabin's under you're holding your breath, and when that runs out you
  // bail out (still under, a long way from air). E gets you out any time.
  if (v.sinkT > 0 && !v.T.boat && !v.T.plane) {
    if (W.WATER_Y - (v.y + v.T.hgt * 0.75) > 0 && swim.holdBreath(dt)) { leaveVehicle(); drownMe(9 * dt); return; }
  }
  me.x = v.x; me.z = v.z; me.y = Math.max(W.SWIM_Y, v.y); me.h = v.h; me.vx = v.vx; me.vz = v.vz; me.moveSpeed = 0;
  writeVeh(v);
  me.ch.g.visible = true;
  if (v.T.ebike) { animateCharacter(me.ch, dt, { ...ebikes.rideEbike(me.ch, v, dt, fwd > 0), weapon: WEAPONS[me.weapon].kind === 'gun' ? 'gun' : 'none' }); ebikes.afterRide(me.ch); }
  else if (v.T.bike) {
    me.ch.g.position.set(v.x - Math.sin(v.h) * 0.25, v.y + 0.2, v.z - Math.cos(v.h) * 0.25);
    me.ch.g.rotation.set(0, v.h, 0);
    me.ch.g.rotateZ(v.tilt);
    animateCharacter(me.ch, dt, { sit: true, weapon: WEAPONS[me.weapon].kind === 'gun' ? 'gun' : 'none' });
  } else { // at the wheel (pulling the door shut just after getting in)
    const p = seatPos(v, 0);
    me.ch.g.position.set(p.x, p.y, p.z); me.ch.g.rotation.set(0, v.h, 0);
    animateCharacter(me.ch, dt, myAct ? { act: myAct } : { drive: true, steer: v.steerVis || 0 });
  }
}

let snapRemotes = false; // back from a hidden tab: put everyone where they are now instead of sliding them there
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
    if (p !== r.pRef) { // (a new record arrives up to 10 times a second: name and outfit are checked then, not every frame)
      const nm = String(p.n || '?').slice(0, 16);
      if (nm !== r.name) { r.ch.g.remove(r.tag); r.tag = nameTag(nm); r.ch.g.add(r.tag); r.name = nm; } // renamed in Settings
      const lk = JSON.stringify(p.c || null);
      if (r.lookKey === undefined) r.lookKey = lk;
      else if (r.lookKey !== lk && Array.isArray(p.c) && !r.ch.rag) { r.lookKey = lk; const pos = r.ch.g.position.clone(); scene.remove(r.ch.g); r.ch = makeCharacter(p.c); r.ch.g.add(r.tag); r.ch.g.position.copy(pos); scene.add(r.ch.g); }
      if (r.lookKey === lk || !Array.isArray(p.c)) r.pRef = p; // (in a ragdoll: try again next frame)
    }
    const k = snapRemotes ? 1 : Math.min(1, dt * 10), ox = r.x, oz = r.z;
    r.x += (s[0] - r.x) * k; r.y += (s[1] - r.y) * k; r.z += (s[2] - r.z) * k; r.h += angDiff(r.h, s[3]) * k;
    r.vx = snapRemotes ? 0 : (r.x - ox) / dt; r.vz = snapRemotes ? 0 : (r.z - oz) / dt;
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
      const seat = s[20] | 0; // > 0: riding as a passenger, sat in that seat
      const ra = anim.remoteAct(s[21], s[22]);
      r.ch.g.visible = true;
      if (seat > 0) { const sp = seatPos(vo, seat); r.ch.g.position.set(sp.x, sp.y, sp.z); r.ch.g.rotation.set(0, vo.h, 0); animateCharacter(r.ch, dt, { sit: true, weapon: wk }); }
      else if (vo.T.ebike) { animateCharacter(r.ch, dt, { ...ebikes.rideEbike(r.ch, vo, dt, !!vo.netPedal), weapon: wk }); ebikes.afterRide(r.ch); }
      else if (vo.T.bike) { r.ch.g.position.set(vo.x - Math.sin(vo.h) * 0.25, vo.y + 0.2, vo.z - Math.cos(vo.h) * 0.25); r.ch.g.rotation.set(0, vo.h, 0); animateCharacter(r.ch, dt, { sit: true, weapon: wk }); }
      else { const sp = seatPos(vo, 0); r.ch.g.position.set(sp.x, sp.y, sp.z); r.ch.g.rotation.set(0, vo.h, 0); animateCharacter(r.ch, dt, ra && ra.n === 'carShut' ? { act: ra } : { drive: true, steer: vo.steerVis || 0 }); }
    } else if (r.veh && farVeh.has(r.veh) && !r.dead) {
      r.ch.g.visible = false; // in a car too far off to be built (a speck at that range): don't stand them in the road
    } else if ((r.dead || s[16]) && !r.ch.rag) {
      r.ch.g.visible = true; ragdoll(r.ch, { x: r.vx * 0.6, y: 2, z: r.vz * 0.6 }, { dead: true }); // their computer simulates the real fall
    } else if (r.ch.rag) {
      if (!r.dead && !s[16]) standUp(r.ch); // they're back up: play the get-up
    } else {
      r.ch.g.visible = true;
      placeCharacter(r.ch, r.x, r.y, r.z, r.h);
      const sw = r.y < W.SWIM_Y + 0.4, bits = s[17] | 0, wr = WEAPONS[r.weapon];
      const ra = anim.remoteAct(s[21], s[22]);
      anim.holdProps(r.ch, ra);
      if (bits & 24) animateCharacter(r.ch, dt, bits & 8 ? { climb: +s[19] || 0 } : { vault: +s[19] || 0 });
      else if (ra && ra.n !== 'phone' && ra.n !== 'call' && !anim.isCombat(ra.n) && !anim.isState(ra.n)) animateCharacter(r.ch, dt, { act: ra });
      else {
        const cv = ra && ra.n.startsWith('cover') ? ra : null; // in cover: k = how far they've popped out
        r.coverLow = !!cv && !cv.n.endsWith('High') && cv.k < 0.5;
        const pf = anim.poseFields(ra);
        animateCharacter(r.ch, dt, { ...pf, ...combat.remoteFields(r, ra, dt), moveRel: wk === 'gun' && r.speed > 0.5 ? angDiff(r.h, Math.atan2(r.vx, r.vz)) : 0, speed: r.speed, aim: wk === 'gun' && !sw && (cv ? cv.k > 0.55 : !(bits & 2)), swim: pf.swim || sw, dead: r.dead, crouch: !!(bits & 1), cover: !!(bits & 2) && !cv, reload: bits & 4 ? (performance.now() / 1300) % 1 : 0, pitch: +s[18] || 0, carry: !!wr?.long && wk !== 'gun', weapon: sw ? 'none' : wk, wmodel: sw ? null : wr?.model ?? null, rifle: !!wr?.long });
      }
    }
    r.tagT = (r.tagT || 0) - dt;
    if (r.tagT <= 0) { r.tagT = 0.3; const d = Math.hypot(r.x - camera.position.x, r.z - camera.position.z); r.tagOn = !r.dead && d < 40 && W.lineOfSight(camera.position.x, camera.position.y, camera.position.z, r.x, r.y + 2.2, r.z); }
    r.tag.visible = !!r.tagOn;
  }
  for (const [uid, r] of remotes) if (!net.players[uid]) { scene.remove(r.ch.g); remotes.delete(uid); ui.addFeed(`${r.name} left`); }
  snapRemotes = false;
}

let peakStars = 0, survive5 = 0, robberyPrompt = '', robberyBar = null;
function updateWantedLevel(dt) {
  peakStars = Math.max(peakStars, wanted.stars);
  if (tickWanted(dt, me) === 'lost') { if (peakStars >= 4) goalDone('lose4'); if (peakStars >= 5) goalDone('lose5'); peakStars = 0; }
  if (wanted.stars === 0) peakStars = 0;
  updateRobbery(dt);
}
// Robbing, GTA V style: inside, point any gun (hip or aimed) roughly at the clerk, the bartender or the casino cashier.
// Hands go up at once and the bag fills; looking away only slows it, shots near the till speed it up, walking out drops it.
// Corner stores: the clerk hits the silent alarm partway through. The casino calls it in at once.
const ROB_SHOUTS = ['Fill the bag!', 'Empty the register!', 'Hands up! The cash, now!', "Don't try anything!", 'Move it, move it!'];
const CLERK_PLEAS = ['Okay, okay!', "Don't shoot!", 'Take it, take it!', 'Please!'];
function updateRobbery(dt) {
  robberyPrompt = ''; robberyBar = null; me.robAim = false;
  const R = interior.room;
  if (!R || !R.clerk || (R.kind !== 'rob' && R.kind !== 'casino' && R.kind !== 'bar')) return;
  const st = R.store, w = WEAPONS[me.weapon], c = R.clerk, casino = R.kind === 'casino', who = casino ? 'cashier' : R.kind === 'bar' ? 'bartender' : 'clerk', till = casino ? 'cage' : 'till';
  // corner stores: a gun pointed the clerk's way is enough. The casino and bars are places you go to play and drink with a
  // gun on your hip, so there it takes a real aim (right mouse). Nothing happens while a table or machine has you.
  const gun = w.kind === 'gun' && !me.dead && !minigames.isOpen() && !phone.isOpen(), facing = Math.abs(angDiff(camYaw, Math.atan2(c.x - me.x, c.z - me.z))) < 0.6 && Math.hypot(c.x - me.x, c.z - me.z) < 16;
  const started = (st.progress || 0) > 0, pointing = gun && facing && !(st.cooldown > 0) && (R.kind === 'rob' || aiming);
  me.robAim = pointing;
  R.held = pointing || (started && !(st.cooldown > 0));
  if (!R.held && (interior.nearExit(me.x, me.z) || canBuyAtCounter())) return; // let "E: Leave" / "E: Buy ammo" show
  if (st.cooldown > 0) { const s = Math.ceil(st.cooldown); robberyPrompt = `The ${till} is empty. Come back in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; return; }
  if (!R.held) { robberyPrompt = facing && !gun && w.melee ? `The ${who} laughs at your ${w.name.toLowerCase()}. Point a gun.` : ''; return; }
  if (!started) { say(me, ROB_SHOUTS[Math.floor(Math.random() * ROB_SHOUTS.length)]); say(c, CLERK_PLEAS[Math.floor(Math.random() * CLERK_PLEAS.length)]); }
  // a shot landing near the clerk or the till hurries them along
  if (R.robShot !== me.shotSeq) {
    if (R.robShot !== undefined && started && me.shot && Math.hypot(me.shot[0] - c.x, me.shot[2] - c.z) < 4) { st.progress += 0.08; say(c, CLERK_PLEAS[Math.floor(Math.random() * CLERK_PLEAS.length)]); }
    R.robShot = me.shotSeq;
  }
  st.progress = Math.max(st.progress || 0, 0.001) + (pointing ? 1 : gun ? 0.35 : 0) * dt / (casino ? 12 : 7);
  if (!st.alarm && (casino || st.progress > 0.35)) {
    st.alarm = true; st.alarmed = true;
    crime(casino ? 'casino' : 'robbery', st.x, me.outside ? me.outside.y : me.y, st.z);
    ui.help(casino ? 'Casino security called it in. The whole department is coming.' : 'The clerk hit the silent alarm. Grab the cash and get out!', 4);
  }
  const bars = Math.round(Math.min(1, st.progress) * 10);
  robberyPrompt = `${st.progress < 0.5 ? `The ${who} is emptying the ${till}` : `The ${who} is filling your bag`}${pointing ? '' : `, keep your gun on the ${who}`}`; robberyBar = Math.min(1, st.progress);
  if (st.progress >= 1) {
    const take = casino ? 2500 + Math.floor(Math.random() * 2000) : 150 + Math.floor(Math.random() * 300);
    st.progress = 0; st.cooldown = casino ? 900 : 300; st.alarm = false; R.held = false;
    addCash(take, `robbed ${st.name}`);
    R.clerkAct = { at: performance.now(), seq: [['give', 0.7]] }; anim.play('take', 0.6, { lock: false, prop: 'moneybag' }); // the bag comes over the counter
    if (casino) goalDone('casino'); else { eco.robbed++; checkCountGoals(); }
    ui.announce(casino ? 'CASINO ROBBED' : 'STORE ROBBED', `${st.name} · +$${take}`, '#8fe38a');
    fx.soundCash();
  }
}

// Shops you walk (or drive) into with E. Returns true if a shop opened.
function storeAt(x, z, r) { const c = !me.veh && cartNear(x, z, 3.5); return c ? { kind: 'food', name: 'Hot dog cart', x: c.x, z: c.z } : storeNear(x, z, r); }
function enterRoom(st) {
  fadeEl.style.opacity = '1';
  setTimeout(() => {
    me.outside = { x: st.x, z: st.z, y: W.groundHeight(st.x, st.z), h: st.face + Math.PI };
    const p = interior.enter(st, me.outside.y);
    if (me.swim) { me.swim = false; swim.reset(); } // (from the water's edge: the room floor is dry)
    me.x = p.x; me.y = p.y; me.z = p.z; me.vy = 0; me.h = 0; camYaw = 0;
    fadeEl.style.opacity = '0';
  }, 350);
}
function leaveRoom() {
  fadeEl.style.opacity = '1';
  setTimeout(() => {
    const st = interior.room && interior.room.store;
    if (st) { Object.assign(st, { alarmed: false, alarm: false, progress: 0 }); interior.room.held = false; } // walking out drops the robbery
    interior.leave();
    // the casino brings you back to its door; a storefront (e.g. passing out inside) puts you on the sidewalk outside
    const o = me.outside || (st && st.w ? { x: st.x, z: st.z, y: W.groundHeight(st.x, st.z), h: st.face + Math.PI } : { x: me.x, z: me.z, y: W.groundHeight(me.x, me.z), h: 0 });
    me.x = o.x + Math.sin(o.h) * 1.2; me.z = o.z + Math.cos(o.h) * 1.2; me.y = o.y; me.vy = 0; me.h = o.h; camYaw = o.h; me.outside = null;
    fadeEl.style.opacity = '0';
  }, 350);
}
// drank past the limit: black out, come to outside the store or a few steps away, half sobered
function passOut() {
  drunk.lvl = 0.6; drunk.out = performance.now() + 2500;
  keys.clear(); mouseDown = false; aiming = false; me.lockOn = null; // frozen until you come to
  fadeEl.style.opacity = '1';
  ui.addFeed('Everything goes dark...');
  setTimeout(() => {
    if (interior.room && !me.dead) { leaveRoom(); return; }
    const a = Math.random() * Math.PI * 2, x = me.x + Math.sin(a) * 6, z = me.z + Math.cos(a) * 6;
    if (!me.dead && !me.veh && W.isLand(x, z) && !W.offMap(x, z)) { const p = W.pushOutCircle(x, z, 0.4); me.x = p.x; me.z = p.z; me.y = W.groundHeight(p.x, p.z); me.vy = 0; }
    fadeEl.style.opacity = '0';
    ui.flashPrompt('You wake up with a headache');
  }, 2500);
}
function useStore() {
  if (me.dead || me.enter) return false;
  if (me.sitAt) { standUp_(); return true; }
  if (interior.room) {
    if (interior.nearExit(me.x, me.z)) { leaveRoom(); return true; }
    if (useVenue(me)) return true; // bars and the casino: drinks, pool, darts, slots, blackjack, roulette
    const seat = seatNear(me); // a free bar stool or booth seat
    if (seat) { me.sitAt = seat; anim.play(seat.pose === 'coffee' ? 'stool' : 'sit', 6, { loop: true }); return true; }
    if (interior.nearCounter(me.x, me.z) && interior.room.kind === 'guns') { openShop('Arnett Arms', gunShopItems(), gunShopItems); return true; }
    if (canBuyAtCounter()) { const basic = () => [...gunShopItems(true), ...drinkItems()]; openShop(interior.room.store.name, basic(), basic); return true; }
    if (interior.nearCounter(me.x, me.z) && interior.room.kind === 'clothes') { openShop(interior.room.store.name, clothingItems()); return true; }
    return true;
  }
  // a street bench (unless a car is right there: E is for the car then)
  const bench = !me.veh && !me.seat && benchNear(me.x, me.z);
  if (bench && !nearestVehicle(1.0)) { me.sitAt = { x: bench.x - Math.sin(bench.h) * 0.12, z: bench.z - Math.cos(bench.h) * 0.12, h: bench.h, bench: bench.ref }; me.y = bench.y; me.vy = 0; anim.play('sit', 6, { loop: true }); return true; }
  const st = storeAt(me.veh ? me.veh.x : me.x, me.veh ? me.veh.z : me.z, me.veh ? 7 : 3.2);
  if (!st) return false;
  if (st.kind === 'body' && me.veh && !me.seat && !me.veh.T.boat && !me.veh.T.heli) { bodyShop(me.veh); return true; }
  if (me.veh) return false;
  if (st.kind === 'body' && !nearestVehicle(1.3)) { // on foot at Arnett Auto (no car to get into right there): pick up a car from your garage
    const mine = () => garage.cars().map((c) => ({ label: c.name, sub: c.selected ? 'Your last ride · brought round to the street' : 'Brought round to the street', price: 0, buy: () => { closeShop(); garage.deliver(c.i); } }));
    if (!garage.cars().length) { ui.flashPrompt('Arnett Auto: your garage is empty'); return true; }
    openShop('Arnett Auto: your garage', mine());
    return true;
  }
  if (st.kind === 'casino') { enterRoom(st); return true; } // other shops are buildings you walk into (interiors.js)
  if (st.kind === 'food') { if (me.hp >= 100) { ui.flashPrompt("You're not hungry"); return true; } if (!spend(8)) { ui.flashPrompt('A hot dog is $8'); return true; } me.hp = Math.min(100, me.hp + 30); fx.soundCash(); ui.flashPrompt('Hot dog: +30 health'); me.h = Math.atan2(st.x - me.x, st.z - me.z); anim.play('give', 0.55).then('eat', 1.8); return true; }
  if (st.kind === 'meds') { openShop('Hospital Pharmacy', [{ label: 'Patch me up', sub: 'Full health', price: 60, ok: () => me.hp < 100, buy: () => { me.hp = 100; } }]); return true; }
  return false;
}
function standUp_() { me.sitAt = null; anim.stop(); }
// a purchase at a counter: you hand over the cash, the clerk hands you the goods
function counterSale() {
  if (me.veh) return;
  anim.play('give', 0.55).then('take', 0.55);
  const R = interior.room;
  if (R?.clerk) R.clerkAct = { at: performance.now(), seq: [['take', 0.55], ['give', 0.55]] };
}
// corner stores and gas stations sell basic rounds at the counter while you aren't robbing them
const BASIC_AMMO = ['Pistol', 'SMG', 'Shotgun'];
function canBuyAtCounter() {
  const R = interior.room;
  return !!R && R.kind === 'rob' && !!R.clerk && interior.nearCounter(me.x, me.z) && !aiming && !(R.store.progress > 0) && !R.store.alarmed;
}
// Everyone owns every weapon, so the shop sells ammo packs and discounted full loadouts (Arnett Arms only, with armor).
function gunShopItems(basic = false) {
  const items = [];
  WEAPONS.forEach((w, i) => {
    if (w.melee || (basic && !BASIC_AMMO.includes(w.name))) return;
    const a = ammoOf(i), unit = w.grenade ? 'grenades' : 'rounds', have = w.grenade ? a.mag + a.res : a.res;
    items.push({ label: w.grenade ? `${w.name}s` : `${w.name} ammo`, sub: `+${w.ammoPack} ${unit} · you have ${have}`, price: w.ammoPrice, buy: () => { a.res += w.ammoPack; refreshWeaponHud(); } });
    if (basic) return;
    const price = Math.round((w.ammoPrice * 2.5) / 10) * 10;
    items.push({ label: `${w.name} loadout`, sub: `${w.grenade ? '' : 'Full mag '}+${w.ammoPack * 3} ${unit} (save $${w.ammoPrice * 3 - price})`, price, buy: () => { me.owned.add(i); a.mag = w.mag; a.res += w.ammoPack * 3; refreshWeaponHud(); } });
  });
  if (!basic) items.push({ label: 'Body armor', sub: 'Soaks up most incoming damage', price: 250, ok: () => me.armor < 100, buy: () => { me.armor = 100; } });
  return items;
}
// Arnett Auto: the mod shop and personal cars live in garage.js, the looks and horns in carmods.js (v.mods)
function bodyShop(v) { shopOpen = true; paused = true; keys.clear(); mouseDown = false; document.exitPointerLock?.(); garage.openModShop(v); }
// fixed in place (same mesh: plate, rims, neon stay); repair() straightens panels, refits lost parts, glass and lamps, applyMods puts the tint back
function repairCar(v) { v.hp = v.T.hp; v.burnAt = 0; v.burnBy = ''; fx.stopFire(v.fire); v.fire = null; v.flat = false; repair(v); applyMods(v); writeVeh(v, true); }
garage.initGarage({ spawn: (ti, c, label) => deliverCar(ti, label, c), remove: (v) => { removeVehicle(v.id); resetVehicle(v); }, vehicles: () => vehicles, myVeh: () => (me.seat ? null : me.veh), repair: repairCar, writeVeh: (v) => writeVeh(v, true), close: closeShop, saved: () => markDirty() });
ebikes.initEbikes({ scene, vehicles: () => vehicles, add: (v) => { scene.add(v.mesh); vehicles.push(v); vehById.set(v.id, v); }, remove: (v) => { removeVehicle(v.id); resetVehicle(v); }, make: makeVehicle, newId, myVeh: () => (me.seat ? null : me.veh), writeVeh });
// ---- clothing store: Tim's Threads (outfits, a barber, tattoos and masks)
const COLS = [['White', 0], ['Black', 1], ['Grey', 2], ['Navy', 4], ['Blue', 5], ['Red', 7], ['Maroon', 8], ['Green', 9], ['Olive', 10], ['Khaki', 11], ['Brown', 12], ['Gold', 14], ['Orange', 15], ['Pink', 16], ['Purple', 17], ['Teal', 18]];
const HAIR_COLS = [['Black', 0], ['Dark brown', 1], ['Brown', 3], ['Auburn', 4], ['Blonde', 6], ['Grey', 7], ['Pink', 10], ['Blue', 11]];
const NAMES = { tee: 'T-shirt', tank: 'Tank top', polo: 'Polo', shirt_s: 'Short-sleeve shirt', shirt_l: 'Dress shirt & tie', hoodie: 'Hoodie', zip: 'Zip jacket', suit: 'Suit jacket', sweater: 'Sweater', flannel: 'Flannel', track: 'Track jacket', blouse: 'Blouse', varsity: 'Varsity jacket', coat: 'Winter coat', hivis: 'Hi-vis vest',
  jeans: 'Jeans', slacks: 'Slacks', shorts: 'Shorts', cargo: 'Cargo pants', sweats: 'Sweatpants', skirt: 'Skirt', sneaker: 'Sneakers', dress: 'Dress shoes', boot: 'Boots',
  short: 'Short', crew: 'Crew cut', buzz: 'Buzz cut', curly: 'Curly', afro: 'Afro', mohawk: 'Mohawk', balding: 'Bald patch', long: 'Long', bob: 'Bob', shoulder: 'Shoulder length', pony: 'Ponytail', bun: 'Bun', dreads: 'Dreadlocks',
  cap: 'Baseball cap', beanie: 'Beanie', hard: 'Hard hat', full: 'Full beard', goatee: 'Goatee', mustache: 'Mustache', shades: 'Sunglasses', clear: 'Glasses', ski: 'Ski mask', tim: 'Tim Arnett mask',
  puffer: 'Puffer jacket', denim: 'Denim jacket', jersey: 'Sports jersey', scrubs: 'Scrubs', chore: 'Work jacket', graphic: 'Quad Cities tee', camo: 'Camo hunting jacket', cardigan: 'Cardigan', torn: 'Torn T-shirt', leggings: 'Leggings',
  trucker: 'Seed cap', cowboy: 'Cowboy hat', bucket: 'Bucket hat', sidepart: 'Side part', slick: 'Slicked back', fade: 'Skin fade', pixie: 'Pixie cut', wavy: 'Long waves', braids: 'Braids', manbun: 'Man bun', chinstrap: 'Chin strap', boxed: 'Short beard' };
function setLook(look) {
  me.look = look;
  const g = me.ch.g, pos = g.position.clone(), rot = g.rotation.y;
  scene.remove(g); me.ch = makeCharacter(look); scene.add(me.ch.g); me.ch.g.position.copy(pos); me.ch.g.rotation.y = rot;
  netSetLook(look); markDirty();
}
function clothingItems() {
  const L = () => normLook(me.look).slice();
  const items = [], put = (label, price, k, v, sub) => items.push({ label, sub, price, buy: () => { const l = L(); for (let i = 0; i < k.length; i++) l[k[i]] = v[i]; setLook(l); } });
  for (const n of ['tee', 'tank', 'polo', 'shirt_s', 'shirt_l', 'hoodie', 'zip', 'suit', 'sweater', 'flannel', 'track', 'blouse', 'varsity', 'coat', 'hivis', 'puffer', 'denim', 'jersey', 'scrubs', 'chore', 'graphic', 'camo', 'cardigan', 'torn']) put(`Top: ${NAMES[n]}`, 40, [6], [TOPS.indexOf(n)]);
  for (const [n, c] of COLS) put(`Top colour: ${n}`, 10, [7], [c]);
  for (const [n, c] of COLS) put(`Second colour: ${n}`, 10, [8], [c], 'Stripes, collars, the shirt under a jacket');
  for (const n of ['jeans', 'slacks', 'shorts', 'cargo', 'sweats', 'skirt', 'leggings', 'scrubs']) put(`Bottoms: ${NAMES[n]}`, 40, [9], [BOTTOMS.indexOf(n)]);
  for (const [n, c] of [['Denim', 4], ['Light denim', 19], ['Black', 1], ['Grey', 2], ['Khaki', 11], ['Brown', 13], ['Olive', 10], ['White', 0]]) put(`Bottoms colour: ${n}`, 10, [10], [c]);
  for (const n of ['sneaker', 'dress', 'boot']) put(`Shoes: ${NAMES[n]}`, 30, [11], [SHOES.indexOf(n)]);
  for (const [n, c] of [['White', 0], ['Black', 1], ['Brown', 12], ['Red', 7], ['Blue', 5]]) put(`Shoe colour: ${n}`, 10, [12], [c]);
  for (const n of ['cap', 'beanie', 'hard', 'trucker', 'cowboy', 'bucket']) put(`Hat: ${NAMES[n]}`, 25, [13], [HATS.indexOf(n)]);
  for (const [n, c] of COLS.slice(0, 8)) put(`Hat colour: ${n}`, 5, [14], [c]);
  put('No hat', 0, [13], [0]);
  for (const n of ['shades', 'clear']) put(NAMES[n], 20, [15], [GLASSES.indexOf(n)]);
  put('No glasses', 0, [15], [0]);
  for (const n of ['short', 'crew', 'buzz', 'curly', 'afro', 'mohawk', 'long', 'bob', 'shoulder', 'pony', 'bun', 'dreads', 'balding', 'sidepart', 'slick', 'fade', 'pixie', 'wavy', 'braids', 'manbun']) put(`Barber: ${NAMES[n]}`, 25, [4], [HAIRS.indexOf(n)]);
  put('Barber: Shave it all off', 15, [4], [0]);
  for (const [n, c] of HAIR_COLS) put(`Hair dye: ${n}`, 15, [5], [c]);
  for (const n of ['full', 'goatee', 'mustache', 'chinstrap', 'boxed']) put(`Barber: ${NAMES[n]}`, 15, [16], [BEARDS.indexOf(n)]);
  put('Barber: Clean shave', 10, [16], [0]);
  put('Tattoo: Arm sleeves', 120, [17], [1], 'Shows with short sleeves');
  put('Laser tattoo removal', 60, [17], [0]);
  put('Mask: Ski mask', 60, [18], [MASKS.indexOf('ski')], 'Witnesses can\'t describe you... well, they can describe the mask');
  put('Mask: Tim Arnett', 80, [18], [MASKS.indexOf('tim')], 'Vote Tim');
  put('Take off the mask', 0, [18], [0]);
  return items;
}
// ---- phone: call a mechanic to drop a car off near you
function callMechanic() {
  if (!playing || me.dead || interior.room) return;
  const car = (label, ti, price) => ({ label, sub: 'Delivered to the nearest street', price, buy: () => deliverCar(ti, label) });
  openShop('Phone: Arnett Auto mechanic', [car('Sedan', V.SEDAN, 100), car('Hatchback', V.HATCH, 90), car('SUV', V.SUV, 150), car('Pickup', V.PICKUP, 150), car('Motorbike', V.BIKE, 120), car('E-bike', V.EBIKE, 60), car('Sports car', V.SPORTS, 300), car('Muscle car', V.MUSCLE, 400), car('Monster truck', V.MONSTER, 900)]);
}
let deliverN = 0;
// phone taxi: fade to black, stream the streets at the waypoint, step out on the sidewalk there
async function taxiTo(x, z) {
  await loading(true, '', 'fade');
  const sp = W.sidewalkSpot({ x, z, r: 60 });
  await W.preload(sp.x, sp.z, 200, loadProgress);
  manageParked(0, sp.x, sp.z, true);
  me.x = sp.x; me.z = sp.z; me.h = sp.h; me.y = W.groundHeight(sp.x, sp.z); me.vy = 0; camYaw = sp.h;
  waypoint = null; gpsRoute = null;
  setTimeout(() => loading(false), 300);
}
function deliverCar(ti, label, color = [0xc62828, 0x1565c0, 0x111214, 0xf2f2f0, 0xe0a526][Math.floor(Math.random() * 5)]) {
  const o = (interior.room && me.outside) || me; // (in the casino: the street by its door, not under it)
  const sp = W.roadSpot(o.x, o.z, 25, 60) || { x: o.x + 6, z: o.z, h: 0 };
  const v = makeVehicle(newId('d'), ti, color, sp);
  v.stolenOnce = true; v.keep = true; scene.add(v.mesh); vehicles.push(v); vehById.set(v.id, v);
  waypoint = { x: sp.x, z: sp.z }; gpsRoute = null; routeT = 0;
  ui.addFeed(`Your ${label} is parked nearby (follow the GPS)`);
  setTimeout(() => { if (v.personal === undefined) v.keep = false; }, 120000); // personal cars (garage.js) stay put
  return v;
}
// ---------- ~ console / admin commands (admin.js) ----------
async function teleport(x, z, exact) {
  if (!playing || me.dead) return;
  await loading(true, '', 'fade');
  let sp = { x, z };
  if (!exact) { await W.ensureRoads(x - 500, z - 500, x + 500, z + 500); sp = W.sidewalkSpot({ x, z, r: 60 }) || sp; } // a place name: the nearest sidewalk
  await W.preload(sp.x, sp.z, 200, loadProgress);
  manageParked(0, sp.x, sp.z, true);
  const y = W.isLand(sp.x, sp.z) ? W.groundHeight(sp.x, sp.z) : W.SWIM_Y, v = !me.seat && me.veh;
  if (v) { v.x = sp.x; v.z = sp.z; v.y = y; v.vx = v.vz = v.speed = 0; writeVeh(v, true); me.x = v.x; me.z = v.z; }
  else {
    if (me.veh) ejectMe();
    if (me.ch.rag) release(me.ch);
    interior.leave(); me.outside = null; me.rag = null; me.move = null; me.enter = null;
    me.x = sp.x; me.z = sp.z; me.y = y; me.vy = 0;
  }
  setTimeout(() => loading(false), 300);
}
function spawnCar(ti) {
  const d = 3 + TYPES[ti].len / 2, x = me.x + Math.sin(camYaw) * d, z = me.z + Math.cos(camYaw) * d;
  const v = makeVehicle(newId('d'), ti, [0xc62828, 0x1565c0, 0x111214, 0xf2f2f0, 0xe0a526][Math.floor(Math.random() * 5)], { x, z, h: camYaw });
  v.stolenOnce = true; v.keep = true; scene.add(v.mesh); vehicles.push(v); vehById.set(v.id, v);
  setTimeout(() => { if (v.personal === undefined) v.keep = false; }, 120000);
}
function explodeTarget() {
  const { o, d } = aimRay(), hit = raycast(o, d, 200);
  let v = hit.kind === 'veh' ? hit.ref : null, bd = 40;
  if (!v) for (const c of vehicles) { const dd = Math.hypot(c.x - me.x, c.z - me.z); if (c !== me.veh && !c.exploded && dd < bd) { bd = dd; v = c; } }
  if (!v) return '';
  explodeVehicle(v); return v.T.name;
}
const nearMe = (o, r) => Math.hypot(o.x - me.x, o.z - me.z) < r;
const kickNote = () => {
  let k = null; try { k = JSON.parse(localStorage.getItem('tat-kick') || 'null'); } catch { /* private mode */ }
  const left = k ? Math.ceil((k.until - Date.now()) / 1000) : 0;
  return left > 0 ? `Kicked by an admin${k.reason ? ': ' + String(k.reason).slice(0, 80) : ''}. You can rejoin in ${left} s.` : '';
};
initAdmin({
  me, WEAPONS, eco, wanted, resetWanted, police, refreshWeaponHud, teleport, spawnCar, repairCar, explodeTarget,
  playing: () => playing, waypoint: () => waypoint,
  killMe: () => { me.lastBy = ''; me.lastByUid = ''; die(); },
  killPeds: (r) => { let n = 0; for (const w of walkers) if (!w.dead && nearMe(w, r)) { hurtWalker(w, 999, 0, 0, null, 3, true); n++; } return n; },
  clearCops: () => { police.clearAll(); resetWanted(); }, // shortcut: on a non-host the host's cops sync back in
  clearTraffic: (r) => { let n = 0; for (const v of [...vehicles]) if (v.mode === 'traffic' && v !== me.veh && nearMe(v, r)) { v.mode = 'free'; resetVehicle(v); n++; } return n; },
  clearChatLog: () => { ui.el.chatLog.innerHTML = ''; mmChat.innerHTML = ''; },
  // shortcut: the block lives in this browser's localStorage, so a modified client or cleared storage gets around it
  kick: (reason) => { try { localStorage.setItem('tat-kick', JSON.stringify({ until: Date.now() + 120000, reason })); } catch { /* private mode */ } saveNow(); location.reload(); },
  closed: () => { if (playing && !paused && !shopOpen) lockMouse(); },
});
let shopOpen = false;
function openShop(title, items, rebuild) { // rebuild: () => items, re-run after each purchase so counts stay current
  shopOpen = true; paused = true; keys.clear(); mouseDown = false;
  document.exitPointerLock?.();
  const el = document.getElementById('shop'), list = document.getElementById('shopItems');
  document.getElementById('shopTitle').textContent = title;
  const render = () => {
    list.innerHTML = '';
    for (const it of items) {
      const li = document.createElement('li'), b = document.createElement('button');
      const broke = eco.cash < it.price;
      b.innerHTML = `<span>${it.label}<small>${it.sub || ''}${broke ? ` · not enough cash (need $${it.price - eco.cash} more)` : ''}</small></span><span class="price">$${it.price}</span>`;
      b.disabled = broke || (it.ok && !it.ok());
      b.addEventListener('click', () => { if (spend(it.price)) { it.buy(); fx.soundCash(); counterSale(); ui.setCash(eco.cash); if (rebuild) items = rebuild(); render(); } });
      li.append(b); list.append(li);
    }
  };
  render();
  el.hidden = false;
  ui.el.pause.hidden = true;
}
function closeShop() { shopOpen = false; paused = false; document.getElementById('shop').hidden = true; lockMouse(); }
document.getElementById('shopClose').addEventListener('click', closeShop);

let deathSpin = 0, camLag = null, camDist = null, baseFov = 70;
// GTA-style arrival: a high overhead shot, a few hard cuts down toward you, then a swoop into the chase cam
let spawnCam = null;
const SPAWN_STEPS = [420, 170, 60], SPAWN_HOLD = 0.7, SPAWN_SWOOP = 1.1;
const startSpawnCam = () => { spawnCam = { t: 0, step: -1 }; };
const _from = new THREE.Vector3(), _to = new THREE.Vector3(), _look = new THREE.Vector3();
function spawnCamera(dt, tx, ty, tz, lx, ly, lz) {
  const S = spawnCam; S.t += dt;
  const step = Math.floor(S.t / SPAWN_HOLD);
  if (step !== S.step && step <= SPAWN_STEPS.length) { S.step = step; fx.soundWhoosh(); }
  if (step < SPAWN_STEPS.length) {
    const h = SPAWN_STEPS[step] * (1 - ((S.t % SPAWN_HOLD) / SPAWN_HOLD) * 0.15); // a slow push in during each shot
    camera.position.set(tx, ty + h, tz + h * 0.12); // a hair off vertical so lookAt keeps north up
    camera.lookAt(tx, ty, tz);
    return;
  }
  // swoop from just overhead into wherever the chase cam already is this frame
  const k = Math.min(1, (S.t - SPAWN_STEPS.length * SPAWN_HOLD) / SPAWN_SWOOP), e = k * k * (3 - 2 * k);
  _to.copy(camera.position);
  _from.set(tx, ty + 45, tz + 6);
  camera.position.lerpVectors(_from, _to, e);
  _look.set(tx, ty, tz).lerp(_to.set(lx, ly, lz), e);
  camera.lookAt(_look);
  if (k >= 1) spawnCam = null;
}
function updateCamera(dt) {
  const spec = adm.spectate && remotes.get(adm.spectate);
  if (spec) { // admin spectate: a chase cam on them, the mouse still turns it
    const cp = Math.cos(camPitch), d = spec.vehObj ? 9 : 5, ty = spec.y + (spec.vehObj ? 2 : 1.6);
    camera.position.set(spec.x - Math.sin(camYaw) * cp * d, ty + Math.sin(camPitch) * d, spec.z - Math.cos(camYaw) * cp * d);
    camera.lookAt(spec.x, ty, spec.z); followSun(spec.x, spec.y, spec.z); return;
  } else if (adm.spectate && !net.players[adm.spectate]) { adm.spectate = null; ui.addFeed('Spectate ended: they left'); }
  if (garage.shopCam(camera, dt)) { followSun(me.veh ? me.veh.x : me.x, me.y, me.veh ? me.veh.z : me.z); return; } // Arnett Auto orbit
  const spd = me.veh ? Math.abs(me.veh.speed) : 0;
  const aimZoom = aiming && !me.dead && WEAPONS[me.weapon].kind === 'gun';
  // aiming eases in and out (combat.js aimBlend): zoom, shoulder offset and field of view all follow one smooth blend
  const ab = me.dead ? 0 : combat.aimBlend();
  baseFov += (70 + clamp(spd - 15, 0, 30) * 0.45 + (me.veh && me.veh.boosting ? 8 : 0) - baseFov) * Math.min(1, dt * 3);
  const fov = baseFov + (combat.feel(WEAPONS[me.weapon]).fov - baseFov) * ab;
  // soft lock-on: eases onto your target (quickly at first, then sticky) while you hold aim; pulling away breaks it
  if (aimZoom && me.lockOn) {
    const lp = lockPos(me.lockOn);
    me.lockT = (me.lockT || 0) + dt;
    if (!lp) me.lockOn = null;
    else {
      const c = camera.position, dx = lp.x - c.x, dz = lp.z - c.z, k = Math.min(1, dt * combat.lockRate(me.lockT));
      camYaw += angDiff(camYaw, Math.atan2(dx, dz)) * k;
      camPitch += (-Math.atan2(lp.y - c.y, Math.hypot(dx, dz)) - camPitch) * k;
    }
  }
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  if (me.dead) { deathSpin += dt; camYaw += dt * 0.35; camPitch += (1.0 - camPitch) * Math.min(1, dt * 1.2); }
  // the chase cam trails the car a little (springy), so turns and speed read clearly
  let tx = me.veh ? me.veh.x : me.x, tz = me.veh ? me.veh.z : me.z;
  const diving = me.swim && swim.under() && !me.veh;
  const ty = me.veh ? me.veh.y + 1.7 : diving ? me.y + swim.BODY + 0.35 : me.swim ? W.WATER_Y - 0.15 : me.y + 1.6 + 0.08 * ab;
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
  const dist = me.veh ? (me.veh.T.heli ? 16 : me.veh.T.plane ? 9 + me.veh.T.len + Math.min(6, spd * 0.06) : 4.6 + me.veh.T.len + Math.min(4, spd * 0.09)) : me.dead ? 5 + deathSpin * 4 : 4.2 - 1.9 * ab;
  const cp = Math.cos(camPitch), dx = Math.sin(camYaw) * cp, dy = -Math.sin(camPitch), dz = Math.cos(camYaw) * cp;
  const sh = me.veh ? 0 : 0.55 + 0.3 * ab, ax = tx - Math.cos(camYaw) * sh, az = tz + Math.sin(camYaw) * sh;
  let back = W.rayBuildings(ax, ty, az, -dx, -dy, -dz, dist);
  // other cars between you and the camera push it in too (looking out from inside a car is a black box)
  if (me.veh) for (const v of [...vehicles, ...[...police.cops.values()].map((u) => u.v)]) if (v && v !== me.veh && !v.exploded && Math.abs(v.x - ax) < dist + 6 && Math.abs(v.z - az) < dist + 6) back = Math.min(back, vehRay({ x: ax, y: ty, z: az }, { x: -dx, y: -dy, z: -dz }, v));
  // in a car never pull in past your own bumper; snap in fast, ease back out so walls don't make it flicker
  const minD = me.veh && !me.veh.T.heli ? me.veh.T.len * 0.5 + 1.2 : 0.8;
  const want = Math.max(minD, Math.min(dist, back - 0.3));
  camDist = camDist === null || want < camDist ? want : camDist + (want - camDist) * Math.min(1, dt * 4);
  const d = camDist;
  const camX = ax - dx * d, camZ = az - dz * d;
  const floorY = interior.room ? interior.room.y + 0.35 : W.isLand(camX, camZ) ? W.groundHeight(camX, camZ) + 0.35 : diving ? W.terrainHeight(camX, camZ) + 0.3 : W.WATER_Y + 0.2;
  camera.position.set(camX, Math.max(floorY, diving ? Math.min(W.WATER_Y - 0.12, ty - dy * d) : ty - dy * d), camZ); // diving: the camera stays under with you
  // recoil kicks the view (not the camera's orbit) up and a little sideways, then springs back
  const lp_ = camPitch - combat.recoilPitch(), ly_ = camYaw + combat.recoilYaw(), lc = Math.cos(lp_);
  camera.lookAt(ax + Math.sin(ly_) * lc * 20, ty - Math.sin(lp_) * 20, az + Math.cos(ly_) * lc * 20);
  swayCamera(camera);
  if (spawnCam) spawnCamera(dt, tx, ty, tz, ax + dx * 20, ty + dy * 20, az + dz * 20);
  followSun(tx, ty, tz);
  // shake: older code sets `shake`, it becomes combat.js trauma, which shakes smoothly (no per-frame random jumps)
  if (shake > 0) { combat.traumaAtLeast(Math.sqrt(shake * 0.7)); shake = 0; }
  const so = combat.shakeOffset();
  if (so) { camera.translateX(so.x); camera.translateY(so.y); camera.rotateZ(so.roll); }
}

function policePlayers() {
  const arr = [{ uid: net.uid, x: me.x, y: me.y, z: me.z, vx: me.vx, vz: me.vz, speed: Math.hypot(me.vx, me.vz), stars: wanted.stars, alive: !me.dead, inVeh: !!me.veh, search: wanted.search, lkx: wanted.lk.x, lkz: wanted.lk.z }];
  for (const r of remotes.values()) if (net.group.has(r.uid)) arr.push({ uid: r.uid, x: r.x, y: r.y, z: r.z, vx: r.vx, vz: r.vz, speed: Math.hypot(r.vx, r.vz), stars: r.stars, alive: !r.dead, inVeh: !!r.veh, search: r.search, lkx: r.lkx, lkz: r.lkz });
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
    if (aimCopT > 1 && wanted.stars === 0) { report('aimcop', me.x, me.z); aimCopT = -5; }
  }
  threatState = armed ? { x: me.x, z: me.z, armed: w.kind === 'gun', aimAt } : null;
}
// where the camera is and which way it looks (so people and cars appear out of sight)
const camDir = new THREE.Vector3();
function camView() { camera.getWorldDirection(camDir); const l = Math.hypot(camDir.x, camDir.z) || 1; return { x: camera.position.x, z: camera.position.z, fx: camDir.x / l, fz: camDir.z / l }; }
cover.initCover({
  vehicles: () => { const L = vehicles.slice(); for (const u of police.cops.values()) if (u.kind < 2 && u.v) L.push(u.v); return L; },
  myVeh: () => me.veh,
  sound: (kind) => fx.footstep(kind === 'veh' ? 'metal' : 'concrete', 1.6),
});
swim.initSwim({
  splash: (x, z, size, big) => { fx.waterSplash(x, z, size); fx.soundSplash(big ? size : size * 0.5, distCam(x, z)); },
  stroke: (x, z, size) => { fx.waterSplash(x, z, size * 0.45); fx.soundStroke(size); },
  bubbles: (x, y, z, n) => { fx.bubbles(x, y, z, n); if (n > 1 && Math.random() < 0.5) fx.soundBubble(); },
  gasp: () => fx.soundGasp(),
});
setNpcContext({
  focus: () => (playing ? { x: me.veh ? me.veh.x : me.x, z: me.veh ? me.veh.z : me.z } : W.places.menu),
  quality: () => activeQuality,
  threat: () => threatState,
  target: () => (playing && !me.dead ? { x: me.veh ? me.veh.x : me.x, y: me.veh ? me.veh.y : me.y, z: me.veh ? me.veh.z : me.z, dead: me.dead, inVeh: !!me.veh } : null),
  // blow (a punch or swing landing on its contact frame, npc.js brawl): { n, down, fx, fz }: you flinch away from it, and an
  // uppercut or a bat smash can put you down
  hitPlayer: (dmg, by, w, blow) => {
    if (w && w.hostile === 'gun' && coverSaves(w.x, (w.y || 0) + 1.4, w.z)) return;
    if (blow) { fx.soundHit(); combat.hitPause(0.03); combat.addTrauma(blow.down ? 0.3 : 0.12); }
    damageMe(dmg, by, '', blow ? (blow.down && Math.random() < 0.6 ? { x: blow.fx * 6, y: 2, z: blow.fz * 6 } : { x: blow.fx, y: 0, z: blow.fz }) : null);
  },
  swish: (x, z, heavy) => { if (Math.hypot(x - me.x, z - me.z) < 20) fx.soundSwish(heavy); },
  vehicles: () => movingVehicles,
  allVehicles: () => vehicles,
  player: () => (playing ? { x: me.veh ? me.veh.x : me.x, z: me.veh ? me.veh.z : me.z, dead: me.dead, inVeh: !!me.veh, speed: me.moveSpeed || 0, vehSpeed: me.veh ? Math.abs(me.veh.speed) : 0, fancy: me.veh && (me.veh.T.limo || me.veh.T.name === 'Sports car' || me.veh.T.muscle), stars: wanted.stars, armed: WEAPONS[me.weapon].kind !== 'none' || WEAPONS[me.weapon].name === 'Knife', mask: MASKS[normLook(me.look)[18]], top: TOPS[normLook(me.look)[6]] } : null),
  driveOff: (v) => { if (v.mode !== 'parked' || me.enter?.v === v) return false; const ok = joinTraffic(v); if (ok) { v.crew = null; writeVeh(v, true); } return ok; },
  hurtNpc: (w, dmg, dx, dz, force) => hurtWalker(w, dmg, dx, dz, null, force, true),
  dropCash: (x, z, n) => dropCash(x, z, n),
  callIn: (x, z) => report('assault', x, z),
  shove: (w) => { if (!me.veh && !me.dead) { me.vx += Math.sin(w.h) * 3; me.vz += Math.cos(w.h) * 3; me.x += Math.sin(w.h) * 0.4; me.z += Math.cos(w.h) * 0.4; me.ch.hitT = 0.7; me.ch.hitX = 0; me.ch.hitZ = -1; } },
  shot: (w, to) => { const from = { x: w.x + Math.sin(w.h) * 0.5, y: (w.y || 0) + 1.4, z: w.z + Math.cos(w.h) * 0.5 }; fx.tracer(from, to); fx.muzzleFlash(from); fx.soundShot('pistol', distCam(w.x, w.z)); },
});
initTraffic(scene, {
  newId,
  vehicles: () => allCars,
  add: (v) => { scene.add(v.mesh); vehicles.push(v); vehById.set(v.id, v); },
  remove: (v) => resetVehicle(v),
  honk: (v) => fx.soundHorn(distCam(v.x, v.z)),
});
cj.initCarjack({
  me: () => me, uid: () => net.uid, netNow: () => net.now(), isHost: () => isHost, vehicles, anim,
  aiming: () => aiming, camYaw: () => camYaw, weapon: () => (playing ? WEAPONS[me.weapon] : null),
  report: (type, x, z) => report(type, x, z), writeVeh: (v, f) => writeVeh(v, f), distCam,
  freeTraffic: (v, noFlee) => freeTraffic(v, noFlee), emptyCar: (v) => emptyCar(v), doorSpot: (v, seat) => doorSpot(v, seat), newId,
  addVehicle: (v) => { scene.add(v.mesh); vehicles.push(v); vehById.set(v.id, v); },
  callCops: (w) => callCops(w, 1, w.x, w.z), shake: (k) => { shake = Math.max(shake, k); },
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
initVenues({ openShop, clothingItems });
phone.initPhone({
  player: () => ({ x: me.veh ? me.veh.x : me.x, z: me.veh ? me.veh.z : me.z, dead: me.dead, inVeh: !!me.veh, inRoom: !!interior.room, inHall: !!interior.room?.hall, speed: me.veh ? Math.abs(me.veh.speed || 0) : 0 }),
  waypoint: () => waypoint,
  mechanic: () => callMechanic(),
  taxi: (x, z) => taxiTo(x, z),
  deliver: (ti, label) => deliverCar(ti, label),
  ammoItems: () => gunShopItems(),
  heal: () => { me.hp = 100; },
  busy: () => paused || shopOpen || !loader.hidden || !!document.querySelector('body > .mg'), // pause / shop / loading / minigame: phone goes away
});
initEvents({
  newId,
  vehicles: () => vehicles,
  add: (v) => { scene.add(v.mesh); vehicles.push(v); vehById.set(v.id, v); },
  reward: (amount, text, title = 'GOOD SAMARITAN') => { addCash(amount); ui.announce(title, `${text} · +$${amount}`, '#7cf29a'); ui.addFeed(`${text} (+$${amount})`); fx.soundCash(); },
  alarm: (v) => { v.alarmUntil = performance.now() / 1000 + 4.5; let n = 0; const iv = setInterval(() => { fx.soundHorn(distCam(v.x, v.z)); if (++n > 6) clearInterval(iv); }, 600); },
  // street events (src/events/*.js): the scene for markers/props, you, your aim, car removal, the fire crew's extinguish
  scene, me: () => me, threat: () => threatState, remove: (v) => resetVehicle(v), feed: (t) => ui.addFeed(t), now: () => net.now(),
  collide: (v) => collideAround(v, true), // street racers crash into traffic, free cars and you like any car
  extinguish: (v) => { v.burnAt = 0; v.burnBy = ''; fx.stopFire(v.fire); v.fire = null; v.hp = Math.max(v.hp, -v.T.hp * 0.3); writeVeh(v, true); },
});
initLandmarks(scene, {
  onCasino: (door, face) => { const st = { name: 'The Arnett Belle', kind: 'casino', x: door.x, z: door.z, face, cooldown: 0, progress: 0 }; stores.push(st); return st; },
  addHeli: (x, y, z) => { const v = makeVehicle('heli-roof', V.HELI, 0x263238, { x, z, h: 0 }); v.y = y; v.keep = true; scene.add(v.mesh); vehicles.push(v); vehById.set(v.id, v); },
  addBoat: (x, z, h) => { const v = makeVehicle(`boat_${Math.round(x)}_${Math.round(z)}`, V.BOAT, [0xffffff, 0xe5484d, 0x1e88e5][Math.floor(Math.random() * 3)], { x, z, h }); v.y = W.WATER_Y - 0.35; v.keep = true; scene.add(v.mesh); vehicles.push(v); vehById.set(v.id, v); },
  horn: (x, z) => fx.soundHorn(distCam(x, z) * 0.6),
});
police.initPolice(scene, {
  extraViewers: () => patrolViewers(),
  now: () => net.now(),
  vehicles: () => vehicles,
  damagePlayer: (uid, dmg, by, from) => { if (uid === net.uid) { if (!(from && coverSaves(from.x, from.y, from.z))) damageMe(dmg, by, 'police'); } else sendEvent('hit', { to: uid, dmg: r1(dmg), by, ...(from ? { sx: r1(from.x), sy: r1(from.y), sz: r1(from.z) } : {}) }); },
  explode: (x, y, z, by) => boom(x, y, z, by, 'police'),
  copShot: (from, s) => { fx.tracer(from, { x: s[0], y: s[1], z: s[2] }); fx.muzzleFlash(from); fx.soundShot('pistol', distCam(from.x, from.z)); },
  announce: (uid, text) => { if (uid === net.uid) ui.announce(text, '', '#ff5e5b'); },
  sync: (obj) => setCops(net.group.size > 1 ? obj : null), // nobody else in our group: nobody to send them to
  arrest: (uid) => { if (uid === net.uid) bustMe(); else sendEvent('bust', { to: uid }); },
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
  for (const [id, rec] of farVeh) { // the same for the far-away ones we only hold as records
    const wrecked = rec.e && nowMs - (rec.b || 0) > 60000, abandoned = !rec.d && !rec.e && nowMs - (rec.seen || nowMs) > 180000;
    if ((wrecked || abandoned) && !anyoneNear(rec, 90)) { farVeh.delete(id); removeVehicle(id); }
  }
}

let sendT = 0, uiT = 0, mmT = 0, lastArea = '';
function updateHud(dt, t) {
  uiT -= dt;
  if (uiT <= 0) {
    uiT = 0.2;
    ui.setHealth(me.hp);
    ui.setCash(eco.cash);
    ui.setArmor(me.armor);
    ui.setBreath((me.swim && swim.under() && !me.dead) || swim.breath() < 1 ? swim.breath() : null); // underwater: the breath meter takes the armor bar
    ui.setSpecial(me.veh ? me.veh.nitro ?? 1 : me.swim ? swim.stamina() : drunk.lvl); // yellow bar: nitro while driving, swimming stamina, drunkenness on foot
    // drunk driving where a cop can see it: 1 star (same rule as assault: only counts if seen)
    if (me.veh && !me.seat && drunk.lvl > 0.6 && Math.abs(me.veh.speed) > 5 && wanted.stars === 0 && Math.random() < 0.1) crime('drunk', me.veh.x, me.veh.y, me.veh.z);
    if (wanted.stars >= 5 && !me.dead) { survive5 += 0.2; if (survive5 >= 60) goalDone('survive5'); } else survive5 = 0;
    if (ui.setStars(wanted.stars, wanted.search)) fx.soundWanted(); // no banner: the stars alone show it
    ui.setSpeedo(me.veh, me.veh && !me.veh.T.bike ? currentStation().name : '', me.veh ? me.veh.nitro ?? 1 : 0);
    const [area, street] = W.areaAt(me.veh ? me.veh.x : me.x, me.veh ? me.veh.z : me.z); ui.showArea(area, street);
    if (waypoint && Math.hypot(waypoint.x - me.x, waypoint.z - me.z) < 25) { waypoint = null; gpsRoute = null; ui.help('You reached your waypoint.', 3, false); }
    const wk = WEAPONS[me.weapon];
    ui.el.crosshair.classList.toggle('off', me.dead || (!!me.veh && wk.kind !== 'gun') || (!me.veh && wk.melee));
    ui.setClock(clockText(), weather.weather, weather.night > 0.5);
    if (area !== lastArea) { lastArea = area; setArea(area); } // presence: where you are, for everyone's player list
    if (!ui.el.pause.hidden) ui.setPlayers(playerRows(), net.online);
  }
  const prompt = robberyPrompt || (me.seat && me.veh ? `Passenger · ${nameOf(me.veh.driver)} is driving` : ''); // no key hints: the Controls tab explains E, Tab and the rest
  ui.setPrompt(prompt, robberyPrompt && prompt === robberyPrompt ? robberyBar : null);
  mmT -= dt;
  if (mmT <= 0) {
    mmT = 0.1;
    const flash = Math.floor(t * 4) % 2 ? '#ff1744' : '#2979ff';
    // minor places only nearby (they'd crowd the radar); the important ones as before
    const blips = poiBlips().filter((p) => Math.abs(p.x - me.x) < 150 && Math.abs(p.z - me.z) < 150);
    for (const h of W.places.hospitals) if (Math.abs(h.x - me.x) < 400 && Math.abs(h.z - me.z) < 400) blips.push({ x: h.x, z: h.z, type: 'hospital' });
    for (const r of remotes.values()) if (!r.dead) blips.push({ x: r.x, z: r.z, color: '#40c4ff', size: 4.5 });
    for (const sb of storeList(false)) blips.push(sb);
    for (const e of eventBlips()) blips.push({ type: 'event', ...e });
    blips.push(...garage.blips());
    blips.push(...ebikes.blips(me.x, me.z, 400));
    for (const s of police.stations()) if (Math.abs(s.x - me.x) < 400 && Math.abs(s.z - me.z) < 400) blips.push({ x: s.x, z: s.z, type: 'police' });
    for (const u of police.cops.values()) if (!police.isDown(u) && !u.parked) { const P = police.posOf(u); blips.push({ x: P.x, z: P.z, color: flash, size: u.kind === 3 ? 6 : u.kind === 2 ? 2.5 : 4 }); }
    const spd = me.veh ? Math.abs(me.veh.speed) : 0;
    ui.drawMinimap({ x: me.veh ? me.veh.x : me.x, z: me.veh ? me.veh.z : me.z, yaw: camYaw }, me, blips, spd > 15 ? 0.75 : 1.1, wanted.search ? cones() : null, waypoint, gpsRoute);
    // siren volume from the nearest active police unit
    let nd = Infinity;
    for (const u of police.cops.values()) if (!police.isDown(u) && u.kind !== 2 && u.target) { const P = police.posOf(u); nd = Math.min(nd, Math.hypot(P.x - me.x, P.z - me.z)); }
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
    else if (v.driver) { braking = v.netBrake !== undefined ? v.netBrake || Math.abs(v.speed || 0) < 0.3 : Math.abs(v.speed || 0) < 0.3; reversing = !!v.netRev; }
    lampList.push({ v, on: on && driven, braking: driven && braking, reversing, signal: hazard ? 2 : v.mode === 'traffic' ? v.signal : 0, bar: !!(v.T.siren && v.sirenOn) });
  }
  // lamp lenses glow on the cars that have their lights on (and dark on everything else)
  const lit = new Set();
  for (const c of lampList) { setCarLamps(c.v, c.on, c.braking); lit.add(c.v); }
  for (const v of vehicles) if (!lit.has(v)) setCarLamps(v, false, false);
  for (const u of police.cops.values()) if (u.kind < 2 && !police.isDown(u)) { lampList.push({ v: u.v, on: on && !u.parked, braking: Math.abs(u.v.speed || 0) < 0.5, reversing: (u.v.speed || 0) < -0.4, signal: 0, bar: chase && !!u.target }); setCarLamps(u.v, on && !u.parked, Math.abs(u.v.speed || 0) < 0.5); }
  updateCarLights(lampList, camera.position, Math.max(n, weather.rain * 0.5, weather.fog * 0.5), me.veh, t);
}

// Drivers and passengers of the cars around the camera (traffic, cops, ambulances, fire trucks).
const seatList = [];
function seatPeople(dt) {
  seatList.length = 0;
  for (const v of vehicles) if (v !== me.veh && !v.driver && (v.mode === 'traffic' || v.mode === 'service' || v.npcDriver)) seatList.push({ v });
  for (const u of police.cops.values()) if (u.kind < 2 && !police.isDown(u) && !u.deployed?.length && !u.parked) seatList.push({ v: u.v });
  updateOccupants(seatList, camera.position, dt);
}

// Sky, weather, lights, wildlife and ambience. Runs in the menu too.
function updateWorldLife(dt, nowMs, t) {
  weather.indoors = !!interior.room;
  const thunder = updateDayNight(dt, adm.clockFrozen ?? nowMs + adm.clockOff, camera.position); // admin time cheats (local only)
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
    let near = 0, crew = 0; for (const w of walkers) { if (w.dead) continue; const d = Math.hypot(w.x - c.x, w.z - c.z); if (d < 25) near++; if (d < 30 && w.role === 'worker') crew++; }
    const cops = [...police.cops.values()].filter((u) => u.kind < 2 && !police.isDown(u)).length;
    fx.setAmbient({ hum: (1 - shore * 0.6) * (0.6 + 0.4 * weather.day), rain: weather.rain, waves: shore, crickets: n * (1 - weather.rain), birds: weather.day * (1 - weather.rain) * (1 - weather.night),
      crowd: Math.min(1, near / 14), wind: (weather.storm ? 1 : 0) + weather.snowing * 0.5 + (c.y > 30 ? 0.5 : 0), work: Math.min(1, crew / 2) * weather.day, sirens: cops > 0 ? 0 : 0.6 + n * 0.6 });
  }
}

// while a minigame is open, the player plays it in the world too: bent over the pool table, throwing darts, at the slots
const MG_POSE = { pool: ['pool', 2.4], darts: ['darts', 1.8], slots: ['slots', 2.2], blackjack: ['table', 3], roulette: ['table', 3] };
let lastMg = null;
function poseForMinigame() {
  const mg = minigames.current();
  if (mg === lastMg) return;
  if (lastMg && anim.playing(MG_POSE[lastMg]?.[0])) anim.stop();
  lastMg = mg;
  if (mg && MG_POSE[mg] && !me.veh) anim.play(MG_POSE[mg][0], MG_POSE[mg][1], { loop: true });
}
let movingVehicles = [], physT = 0, hostT = 0;
function update(dt, t) {
  dt *= adm.slowmo;
  { // combat feel (combat.js): aim blend, recoil, crosshair spread and shake run on real time; a hit pause slows the rest
    const w = WEAPONS[me.weapon], gun = w.kind === 'gun' && !w.rocket;
    combat.tick(dt, { aiming: aiming && !me.dead && !me.swim && w.kind === 'gun', weapon: w, firing: mouseDown && gun && me.cd > -0.1, moving: (me.moveSpeed || 0) > 0.5 || !!me.veh });
    combat.tickPushes(dt, (x, z) => W.pushOutCircle(x, z, 0.4));
    combat.crosshair(gun && !w.scope && !me.dead ? combat.spreadPx(w.spread * (w.pellets ? 1 : 1.6) * combat.spreadMul(aiming, me.crouch), camera.fov, innerHeight) + 3 : 0);
    dt *= combat.timeScale();
  }
  if (adm.neverWanted && wanted.stars) resetWanted();
  if (wheelOpen && remotes.size === 0) dt *= 0.3; // slow motion while choosing a weapon (solo only)
  if (me.dead && remotes.size === 0) { const k = (performance.now() - me.deadAt) / 1000; dt *= k < 3 ? 0.28 : Math.min(1, 0.28 + (k - 3) * 0.5); }
  const nowMs = net.now(), tSec = nowMs / 1000;
  movingVehicles = vehicles.filter((v) => Math.abs(v.vx || 0) + Math.abs(v.vz || 0) > 5 && !v.sinkT);
  for (const u of police.cops.values()) if (u.kind < 2 && Math.abs(u.v.vx || 0) + Math.abs(u.v.vz || 0) > 5) movingVehicles.push(u.v);
  updateNav(dt);
  updateThreat(dt);
  const spec = adm.spectate && remotes.get(adm.spectate); // spectating: stream the streets around them
  const fxp = spec ? spec.x : me.veh ? me.veh.x : me.x, fzp = spec ? spec.z : me.veh ? me.veh.z : me.z;
  W.updateWorld(fxp, fzp, dt);
  manageParked(dt, fxp, fzp);
  updateRoute(dt);
  physT -= dt; if (physT <= 0) { physT = 0.5; syncPhysics(fxp, fzp); }
  const wasHost = isHost;
  if ((hostT -= dt) <= 0) { hostT = 0.25; const h = hostUid(); isHost = h === net.uid; watchCops(isHost ? null : h); } // (a flood fill over every player: 4 Hz is plenty)
  if (wasHost && !isHost) setCops(null); // another player's group took over: drop our copy of the cops
  updateVehicles(dt, tSec, nowMs);
  poseForMinigame();
  updatePlayer(dt);
  updateDrunk(dt);
  if (drunk.lvl >= 1 && !me.veh && !me.dead && !me.enter && !me.move && !me.rag && !shopOpen) passOut();
  updateRemotes(dt);
  updateWalkers(dt, tSec, nowMs, camView());
  updateEmergency(dt, { x: me.veh ? me.veh.x : me.x, z: me.veh ? me.veh.z : me.z }, camView(), tSec);
  updateLandmarks(dt, tSec, { x: me.veh ? me.veh.x : me.x, z: me.veh ? me.veh.z : me.z }, weather.night);
  interior.updateRoom(dt, me, threatState);
  updateVenues(dt, me);
  updateEvents(dt, { x: me.veh ? me.veh.x : me.x, z: me.veh ? me.veh.z : me.z }, camView(), wanted.stars > 0 || !!interior.room);
  phone.update(dt);
  // hiding: inside a shop or a parking ramp they lose you faster, unless they know you're in there (you just robbed it)
  me.pinned = !!(interior.room && interior.room.store.alarmed);
  me.hiding = !me.pinned && (!!interior.room || (!me.veh && W.buildingKindAt(me.x, me.z) === 1) || (me.veh && W.buildingKindAt(me.veh.x, me.veh.z) === 1));
  trainAndBargeHits(dt);
  if (isHost) { police.hostUpdate(dt, policePlayers()); hostChores(dt, nowMs); }
  for (const v of vehicles) if (v.pending) flushBump(v);
  police.render(dt, isHost, t, camera.position, farCarDist());
  farCarsEnd();
  updateGrenades(dt);
  cj.update(dt);
  seatPeople(dt);
  updateWantedLevel(dt);
  updateRagdolls(dt);
  updateCamera(dt);
  updateWorldLife(dt, nowMs, t);
  waterView();
  updateEconomy(dt, me, t);
  ebikes.updateEbikes(dt, me.veh ? me.veh.x : me.x, me.veh ? me.veh.z : me.z);
  { const talk = updateRadio(!!me.veh && !me.veh.T.bike && !me.dead, dt); if (talk) ui.flashPrompt('📻 ' + talk); }
  if (!me.veh || me.dead) fx.setEngine(null);
  fx.updateFx(dt);
  updateBreakables(dt, me.x, me.z);
  sendT -= dt;
  if (sendT <= 0) {
    sendT = crowd ? 0.1 : 1;
    lastState = [r1(me.x), r2(me.y), r1(me.z), r2(me.h), r1(me.moveSpeed), me.veh ? me.veh.id : '', Math.round(me.hp), wanted.stars, me.weapon, me.shotSeq, r1(me.shot[0]), r1(me.shot[1]), r1(me.shot[2]), wanted.search ? 1 : 0, r1(wanted.lk.x), r1(wanted.lk.z), me.ch.rag && !me.dead ? 1 : 0, me.netPose || 0, me.netPitch || 0, me.netK || 0, me.seat || 0, ...actNet(), 0]; // s[23]: 1 = tabbed out
    sendState(lastState);
  }
  updateCrowd(dt);
  tickProfile(dt);
  updateHud(dt, t);
}

// the player's action for other players: [code (negative = mirrored), progress] in s[21], s[22] (src/anim.js)
function actNet() { if (!myAct) { const sw = me.swim && !me.veh && me.netPose !== 8 && swim.netAct(); if (sw) return [anim.codeOf(sw.n), sw.k]; const cv = cover.netAct(); if (cv) return [anim.codeOf(cv.n) * cv.side, cv.k]; const c = combat.netAct(me.ch); return c ? [anim.codeOf(c.n), Math.round(c.k * 100) / 100] : [0, 0]; } const c = anim.codeOf(myAct.n); return [c * (myAct.side < 0 ? -1 : 1), Math.round((myAct.k || 0) * 100) / 100]; }
// Slow pan over the riverfront while the menu is open.
let menuFocus = null; // once you press Play the (hidden) menu camera streams around your spawn instead
function menuCamera(t) {
  const p = menuFocus || W.places.menu, a = t * 0.05;
  camera.position.set(p.x + Math.cos(a) * 230, 115, p.z + Math.sin(a) * 230);
  camera.lookAt(p.x, 10, p.z - 160);
  followSun(p.x, 0, p.z);
  W.updateWorld(p.x, p.z, 0.016);
}

// Compile the shaders that otherwise first show up mid-game (landmark models, explosions, fire, blood, glass) while
// the loading art is up, so the first landmark or gunfight doesn't hitch.
function prewarmShaders() {
  const g = new THREE.Group(), geo = new THREE.BoxGeometry(0.01, 0.01, 0.01);
  for (const m of [...landmarkMats(), ...fx.warmMats()]) { const o = new THREE.Mesh(geo, m); o.position.copy(camera.position); o.frustumCulled = false; g.add(o); }
  scene.add(g);
  const done = () => { scene.remove(g); geo.dispose(); };
  // compile just this group (with the scene's lights); a stray geometry-less object elsewhere must never block Play
  try { renderer.compileAsync(g, camera, scene).catch(() => {}).finally(done); } catch { done(); }
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
// let a few frames render (and shaders compile) behind the loading screen, then show the menu
setTimeout(() => { loading(true, '', 'menu'); ui.el.menu.hidden = false; playBtn.focus(); }, 400);
// meanwhile, download the streets where you'll start



