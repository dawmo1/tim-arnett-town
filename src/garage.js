// Arnett Auto mod shop (Los Santos Customs style: drive in, the camera circles the car, browse with live
// preview, buy with Enter) and the personal garage (saved cars in localStorage, delivered by the mechanic).
import { TYPES, V } from './vehicles.js';
import { applyMods, modsOf, newMods, horn, FINISHES, RIMS, TINTS, HORNS, PALETTE, NEONS } from './carmods.js';
import { eco, spend } from './economy.js';
import * as fx from './fx.js';
import * as ui from './ui.js';

// main.js fills this: { spawn(ti, color, label) -> v, remove(v), vehicles(), myVeh(), repair(v), writeVeh(v), close(), saved() }
let ctx = null;
export function initGarage(c) { ctx = c; }

// ---------- personal garage ----------
const KEY = 'tat-garage', MAX = 12;
let store = { cars: [], sel: 0 };
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && Array.isArray(s.cars)) store = s; } catch { /* private mode */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ignore */ } ctx?.saved?.(); };
// the saved profile carries the garage too (main.js); the server drops nulls, modsOf() fills them back in
export const data = () => clone(store);
export function setData(s) { if (s && Array.isArray(s.cars)) { store = { cars: s.cars.slice(0, MAX), sel: Math.max(0, Math.min(s.cars.length - 1, s.sel | 0)) }; try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ignore */ } } }
const clone = (o) => JSON.parse(JSON.stringify(o));
let live = null; // the delivered (or saved-in-the-shop) personal car out in the world
const alive = (v) => v && !v.exploded && ctx.vehicles().includes(v);

export const cars = () => store.cars.map((c, i) => ({ i, name: c.name, ti: c.ti, color: c.color, selected: i === store.sel }));
// add a car to the garage (phone dealership): TYPES index, 'Sports car' or 'SPORTS'. Returns its slot, or -1 when full.
export function addCar(type, color = 0xc62828) {
  const ti = typeof type === 'number' ? type : V[String(type).toUpperCase()] ?? TYPES.findIndex((t) => t.name.toLowerCase() === String(type).toLowerCase());
  if (!TYPES[ti] || store.cars.length >= MAX) return -1;
  store.sel = store.cars.push({ ti, color, name: TYPES[ti].name, mods: newMods({ color }) }) - 1;
  save();
  return store.sel;
}
// bring a saved car to the nearest road (one out at a time). Returns the vehicle.
export function deliver(i = store.sel) {
  const c = store.cars[i]; if (!c || !ctx) { ui.addFeed('No personal vehicle yet: save one at Arnett Auto'); return null; }
  store.sel = i; save();
  if (alive(live) && live.personal === i && live === ctx.myVeh()) return live;
  if (alive(live) && live !== ctx.myVeh() && !live.driver) ctx.remove(live);
  const v = ctx.spawn(c.ti, c.color, `personal ${c.name}`);
  v.mods = clone(c.mods); v.personal = i; v.keep = true;
  applyMods(v);
  return (live = v);
}
function remember(v) {
  const rec = { ti: v.ti, color: v.color, name: v.T.name, mods: clone(modsOf(v)) };
  if (v.personal !== undefined && store.cars[v.personal]) store.cars[v.personal] = rec;
  else if (store.cars.length < MAX) v.personal = store.cars.push(rec) - 1;
  else return false;
  store.sel = v.personal; v.stolenOnce = true; live = v; save();
  return true;
}
// map / minimap: your personal car while it's out and you aren't in it
export function blips() { return alive(live) && live !== ctx.myVeh() ? [{ x: live.x, z: live.z, type: 'car', name: `Personal ${live.T.name}` }] : []; }

// ---------- the mod shop menu ----------
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const put = (o, p, val) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = val; };
// one option: sets mods[path] = val; installed when it already is
const opt = (label, path, val, price, extra = {}) => ({ label, path, val, price, ...extra });
const levels = (path, names, prices, info) => names.map((n, i) => opt(n, path, i, prices[i], { info }));
const swatch = (c) => `<i class="sw" style="background:#${c.toString(16).padStart(6, '0')}"></i>`;
function menu(v) {
  const bike = v.T.bike;
  const cats = [
    { label: 'Repair', price: 150, info: 'Fix the body, engine, tires and glass', no: 'Nothing to repair', ok: () => v.hp < v.T.hp || v.flat || v.dz.f + v.dz.b + v.dz.l + v.dz.r > 0, act: () => ctx.repair(v) },
    { label: 'Respray', view: 'orbit', items: [
      { label: 'Primary colour', items: PALETTE.map(([n, c]) => opt(swatch(c) + n, 'paint.c1', c, 100)) },
      { label: 'Secondary colour', items: [opt('Factory', 'paint.c2', null, 0), ...PALETTE.map(([n, c]) => opt(swatch(c) + n, 'paint.c2', c, 80))], info: 'Stripes, roof and trim on cars that have them' },
      { label: 'Finish', items: FINISHES.map((n, i) => opt(n, 'paint.f', i, [0, 150, 250, 400, 1500][i])) },
    ] },
    { label: 'Wheels', view: 'side', items: [
      { label: 'Rim style', items: RIMS.map((n, i) => opt(n, 'rims.s', i, [0, 300, 350, 450, 500, 550, 400, 600][i])) },
      { label: 'Rim colour', items: [opt('Chrome', 'rims.c', null, 0), ...PALETTE.map(([n, c]) => opt(swatch(c) + n, 'rims.c', c, 120))] },
      opt('Bulletproof tires', 'bp', 1, 500, { info: 'Gunfire and spike strips barely scratch them' }),
    ] },
    !bike && { label: 'Windows', items: TINTS.map((n, i) => opt(n, 'tint', i, [0, 100, 200, 350][i])) },
    !bike && { label: 'Neon kits', view: 'low', items: [opt('None', 'neon', null, 0), ...NEONS.map(([n, c]) => opt(swatch(c) + n, 'neon', c, 500))] },
    { label: 'Horns', items: HORNS.map((n, i) => opt(n, 'horn', i, [0, 150, 250, 300, 400, 500][i], { horn: i, info: 'H to honk while driving' })) },
    { label: 'Plate', view: 'rear', items: [{ label: 'Custom text', plate: true, price: 100, info: 'Up to 8 letters and numbers' }, opt('Standard (TIM 2026)', 'plate', '', 0)] },
    { label: 'Engine', items: levels('engine', ['Stock', 'EMS Upgrade, Level 1', 'EMS Upgrade, Level 2', 'EMS Upgrade, Level 3', 'EMS Upgrade, Level 4'], [0, 500, 1200, 2500, 4500], 'Acceleration and top speed') },
    { label: 'Brakes', items: levels('brakes', ['Stock', 'Street brakes', 'Sport brakes', 'Race brakes'], [0, 300, 700, 1400], 'Stop shorter') },
    { label: 'Suspension', view: 'side', items: levels('suspension', ['Stock', 'Lowered', 'Street', 'Sport'], [0, 250, 600, 1100], 'Sits lower, grips and rolls less') },
    { label: 'Turbo', items: [opt('None', 'turbo', 0, 0), opt('Turbo tuning', 'turbo', 1, 2000, { info: 'Much harder acceleration' })] },
    { label: 'Nitro', items: [opt('Stock tank', 'nitro', 0, 0), opt('Bigger nitro tank', 'nitro', 1, 350, { info: 'Boost lasts twice as long' })] },
    { label: 'Armor', items: levels('armor', ['None', 'Armor upgrade 20%', 'Armor upgrade 40%', 'Armor upgrade 60%', 'Armor upgrade 80%', 'Armor upgrade 100%'], [0, 500, 1000, 1800, 2800, 4000], 'Takes less damage (100% = half)') },
    { label: v.personal !== undefined ? 'Update personal vehicle' : 'Save as personal vehicle', price: 0, info: 'Keep this car with its mods. Call it from the phone any time', act: () => { if (!remember(v)) ui.flashPrompt('Your garage is full'); else ui.flashPrompt('Saved to your garage'); } },
  ];
  return cats.filter(Boolean);
}

let S = null; // { v, saved mods, stack: [{ title, items, sel, view }], yaw, el }
let root = null;
function dom() {
  if (root) return root;
  const css = document.createElement('style');
  css.textContent = `#lsc{position:absolute;inset:0;pointer-events:auto;padding:8vh 3vw;background:linear-gradient(90deg,rgba(0,0,0,.4),rgba(0,0,0,0) 50%)}
#lsc h2{background:linear-gradient(125deg,#1d5c9e,#0b2240 70%)}
#lscItems{list-style:none;margin:0;padding:0;display:grid;max-height:52vh;overflow:auto;font:500 19px/1.2 var(--hud)}
#lscItems li{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:8px 14px;background:var(--box);color:#fff;cursor:pointer}
#lscItems li.sel{background:#fff;color:#000}#lscItems li.off{color:rgba(255,255,255,.4)}#lscItems li.sel.off{color:rgba(0,0,0,.45)}
#lscItems .price{font-weight:600;color:#72c472;font-variant-numeric:tabular-nums}#lscItems li.sel .price{color:#1f7a2a}
#lscItems .sw{display:inline-block;width:13px;height:13px;margin-right:9px;vertical-align:-1px;border:1px solid rgba(255,255,255,.7)}
#lscItems input{font:inherit;width:100%;border:0;background:transparent;color:inherit;text-transform:uppercase;outline:none}
#lscInfo{padding:7px 14px;background:rgba(0,0,0,.85);border-top:2px solid rgba(255,255,255,.15);font:500 16px/1.3 var(--hud);color:rgba(255,255,255,.8);min-height:1.3em}
#lscKeys{padding:5px 14px;font:500 14px var(--hud);color:rgba(255,255,255,.6);text-shadow:0 1px 2px #000}`;
  document.head.append(css);
  root = document.createElement('div'); root.id = 'lsc'; root.hidden = true;
  root.innerHTML = '<div class="shopCard"><h2>Arnett Auto</h2><div class="shopSub"><span id="lscCat"></span><b id="lscCount"></b></div><ul id="lscItems"></ul><div id="lscInfo"></div><div id="lscKeys">↑↓ Browse · Enter Buy · Backspace Back · Esc Leave</div></div>';
  (document.getElementById('shop')?.parentNode || document.body).append(root);
  root.querySelector('#lscItems').addEventListener('pointerover', (e) => { const li = e.target.closest('li'); if (li && S) move(+li.dataset.i - top().sel); });
  root.querySelector('#lscItems').addEventListener('click', (e) => { const li = e.target.closest('li'); if (li && S && !e.target.matches('input')) { move(+li.dataset.i - top().sel); choose(); } });
  return root;
}
const top = () => S.stack[S.stack.length - 1];
const installed = (it) => it.path && JSON.stringify(get(S.saved, it.path) ?? null) === JSON.stringify(it.val ?? null);
function render() {
  const T = top(), ul = root.querySelector('#lscItems');
  root.querySelector('#lscCat').textContent = T.title;
  root.querySelector('#lscCount').textContent = `${T.sel + 1} / ${T.items.length}`;
  ul.innerHTML = '';
  T.items.forEach((it, i) => {
    const li = document.createElement('li'); li.dataset.i = i;
    if (i === T.sel) li.className = 'sel';
    if (it.price !== undefined && !installed(it) && (eco.cash < it.price || (it.ok && !it.ok()))) li.classList.add('off');
    const right = it.items ? '›' : installed(it) ? '✔' : it.price ? `$${it.price}` : it.act ? '' : 'Free';
    li.innerHTML = `<span>${it.label}</span><span class="price">${right}</span>`;
    ul.append(li);
  });
  ul.children[T.sel]?.scrollIntoView({ block: 'nearest' });
  const it = T.items[T.sel], short = it && it.price > eco.cash && !installed(it) ? ` · need $${it.price - eco.cash} more` : '';
  root.querySelector('#lscInfo').textContent = ((it && it.info) || T.info || '') + short;
}
// live preview: whatever row is highlighted is shown on the car until you back out
function preview() {
  const it = top().items[top().sel], m = clone(S.saved);
  if (it && it.path) put(m, it.path, it.val);
  S.v.mods = m; applyMods(S.v);
  if (it && it.horn !== undefined) horn(S.v, 0, it.horn);
}
function move(d) { const T = top(); if (!d) return; T.sel = (T.sel + d + T.items.length) % T.items.length; preview(); render(); }
function buy(it, after) {
  if (it.ok && !it.ok()) { if (it.no) ui.flashPrompt(it.no); return; }
  if (it.price && !spend(it.price)) { ui.flashPrompt(`Not enough cash (need $${it.price - eco.cash} more)`); return; }
  if (it.price) { fx.soundCash(); ui.setCash(eco.cash); }
  after();
  S.saved = clone(modsOf(S.v));
  if (S.v.personal !== undefined && S.v === live) remember(S.v); // your personal car keeps its mods
  ctx.writeVeh(S.v);
  render();
}
function choose() {
  const T = top(), it = T.items[T.sel]; if (!it) return;
  if (it.items) { S.stack.push({ title: it.label.replace(/<[^>]+>/g, ''), items: it.items, sel: Math.max(0, it.items.findIndex(installed)), view: it.view || T.view, info: it.info }); preview(); render(); return; }
  if (it.act) { buy(it, it.act); if (it.label.includes('personal')) { S.stack[0].items = menu(S.v); render(); } return; }
  if (it.plate) { plateInput(it); return; }
  if (installed(it)) return;
  buy(it, () => { put(modsOf(S.v), it.path, it.val); applyMods(S.v); });
}
function plateInput(it) {
  const li = root.querySelector('#lscItems').children[top().sel];
  li.firstChild.innerHTML = '<input maxlength="8" placeholder="TYPE YOUR PLATE">';
  const inp = li.querySelector('input'); inp.value = S.saved.plate || ''; inp.focus();
  const show = () => { S.v.mods = clone(S.saved); S.v.mods.plate = inp.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 8); applyMods(S.v); };
  inp.addEventListener('input', show);
  inp.addEventListener('keydown', (e) => {
    e.stopPropagation(); // keep typing out of the game's own key handler
    if (e.key === 'Enter') { const t = S.v.mods.plate; e.preventDefault(); if (t && t !== S.saved.plate) buy(it, () => { modsOf(S.v).plate = t; applyMods(S.v); }); else { preview(); render(); } }
    else if (e.key === 'Escape') { e.preventDefault(); preview(); render(); }
  });
}
function back() {
  if (S.stack.length > 1) { S.stack.pop(); preview(); render(); } else closeModShop();
}
function onKey(e) {
  if (!S || e.target.matches?.('#lsc input')) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (e.repeat && !/Arrow|KeyW|KeyS/.test(e.code)) return;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') move(-1);
  else if (e.code === 'ArrowDown' || e.code === 'KeyS') move(1);
  else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') choose();
  else if (e.code === 'Backspace' || e.code === 'ArrowLeft' || e.code === 'KeyA') back();
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (top().items[top().sel]?.items) choose(); }
  else if (e.code === 'Escape' || e.code === 'KeyE') closeModShop();
}
export function openModShop(v) {
  dom();
  v.vx = v.vz = v.speed = 0;
  const m = modsOf(v);
  S = { v, saved: clone(m), stack: [{ title: v.T.name, items: menu(v), sel: 0 }], yaw: 0.9 };
  root.hidden = false;
  addEventListener('keydown', onKey, true);
  render();
}
export function closeModShop() {
  if (!S) return;
  S.v.mods = clone(S.saved); applyMods(S.v);
  S = null; root.hidden = true;
  removeEventListener('keydown', onKey, true);
  ctx.close();
}
// camera: a slow orbit around the car; wheels and suspension from the side, the plate from behind, neon from low
const VIEWS = { orbit: null, side: [Math.PI / 2, 0.7, 0.85], rear: [Math.PI, 1.0, 0.8], low: [2.4, 0.35, 1.05] };
export function shopCam(camera, dt) {
  if (!S) return false;
  const v = S.v;
  if (!alive(v) || v.hp <= -v.T.hp * 0.4) { closeModShop(); return false; }
  const view = VIEWS[top().view] || null;
  if (view) S.yaw += (((view[0] - S.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 3);
  else S.yaw += dt * 0.3;
  S.yaw %= Math.PI * 2;
  const y = view ? view[1] : 1.3, d = (v.T.len * 0.55 + 3) * (view ? view[2] : 1), a = v.h + S.yaw;
  camera.position.set(v.x + Math.sin(a) * d, v.y + y + 0.4, v.z + Math.cos(a) * d);
  camera.lookAt(v.x, v.y + 0.6, v.z);
  return true;
}
