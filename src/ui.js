import { ICONS } from './weapon-icons.js';
import * as W from './world.js';
import { FT, fmtSpeed, fmtDist } from './util.js';

const $ = (id) => document.getElementById(id);
export const el = {
  hud: $('hud'), menu: $('menu'), stars: $('stars'), feed: $('feed'), chatLog: $('chatLog'), chatInput: $('chatInput'),
  weapon: $('weapon'), weaponIcon: $('weaponIcon'), weaponBox: $('weaponBox'), hpfill: $('hpfill'), prompt: $('prompt'), dead: $('dead'),
  ammo: $('ammo'), armorfill: $('armorfill'), cash: $('cash'), helpbox: $('helpbox'), area: $('area'), areaName: $('areaName'), streetName: $('streetName'),
  pause: $('pause'), bigmap: $('bigmap'), pauseTabs: $('pauseTabs'), resumeBtn: $('resumeBtn'), deadSub: $('deadSub'), shareHint: $('shareHint'),
  roomInfo: $('roomInfo'), playerList: $('playerList'), help: $('help'), minimap: $('minimap'), hurt: $('hurt'),
  wheel: $('wheel'), wheelName: $('wheelName'), wheelStats: $('wheelStats'), announce: $('announce'), speedo: $('speedo'),
  crosshair: $('crosshair'), clock: $('clock'),
  cashDelta: $('cashDelta'), vehName: $('vehName'), bottomleft: $('bottomleft'), pauseCash: $('pauseCash'), pauseTime: $('pauseTime'), pauseDay: $('pauseDay'), shopCash: $('shopCash'),
  spfill: $('spfill'), mmDist: $('mmDist'),
};
// the pause menu has its own owner now; its cash/time slots may or may not exist
const setText = (node, t) => { if (node) node.textContent = t; };
// restart a one-shot CSS animation; the class drops itself when it ends
function replay(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
for (const n of [el.cashDelta, el.vehName]) n.addEventListener('animationend', () => n.classList.remove('on'));

// Simple weapon silhouettes (viewBox 0 0 48 24).
export { ICONS }; // (src/weapon-icons.js)

export function setHealth(hp) {
  el.hpfill.style.width = Math.max(0, hp) + '%';
  el.hpfill.style.background = hp > 50 ? '#5bb85b' : hp > 25 ? '#d9a63a' : '#d23c30';
}
export function flashHurt() { el.hurt.classList.remove('on'); void el.hurt.offsetWidth; el.hurt.classList.add('on'); }
// GTA V style: the weapon's silhouette with the ammo beside it (all you're carrying in white, the clip in grey);
// nothing at all with bare fists. The name shows for a moment when you switch.
let shownWeapon = '';
export function setWeapon(name, ammo = '') {
  el.weaponBox.classList.toggle('none', name === 'Fists');
  const m = /^(\d+) \/ (\d+)$/.exec(ammo); // "clip / reserve"
  if (m) el.ammo.innerHTML = `<b>${(+m[1] + +m[2]).toLocaleString('en-US')}</b><span>${m[1]}</span>`;
  else el.ammo.innerHTML = ammo ? `<b>${ammo.replace(/^× /, '')}</b>` : '';
  el.ammo.classList.toggle('busy', /…$/.test(ammo));
  if (name === shownWeapon) return;
  shownWeapon = name;
  el.weapon.textContent = name; replay(el.weapon, 'on');
  el.weaponIcon.innerHTML = `<svg viewBox="0 0 48 24" fill="currentColor" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
// Hidden until wanted. Cops see you: solid stars, red/blue siren glow (and on the minimap frame).
// Searching: stars blink grey, "waning away" until they are lost. Rebuilt only when the count changes.
let lastStars = 0;
export function setStars(n, searching) {
  if (n !== lastStars) el.stars.innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
  el.stars.classList.toggle('none', n <= 0);
  el.stars.classList.toggle('flash', n > 0 && !!searching);
  el.stars.classList.toggle('hot', n > 0 && !searching);
  el.bottomleft.classList.toggle('hot', n > 0 && !searching);
  const up = n > lastStars;
  lastStars = n;
  return up;
}
export function addFeed(text) {
  const li = document.createElement('li'); li.textContent = text;
  el.feed.prepend(li);
  while (el.feed.children.length > 5) el.feed.lastChild.remove();
  setTimeout(() => li.remove(), 8000);
}
export const adminBadge = () => Object.assign(document.createElement('i'), { className: 'admBadge', textContent: 'Admin' });
export function addChat(name, msg, admin = false) {
  const li = document.createElement('li');
  const b = document.createElement('b'); b.textContent = name + ': ';
  if (admin) b.prepend(adminBadge());
  li.append(b, document.createTextNode(msg));
  el.chatLog.append(li);
  while (el.chatLog.children.length > 8) el.chatLog.firstChild.remove();
  setTimeout(() => li.classList.add('old'), 15000);
}
let promptHold = 0;
// bar (0..1 or null): a GTA-style progress bar under the text (robbery bag filling)
export function setPrompt(t, bar = null) {
  if (performance.now() < promptHold) return;
  el.prompt.textContent = t || ''; el.prompt.hidden = !t;
  if (t && bar !== null) { const b = document.createElement('i'); b.className = 'pbar'; const f = document.createElement('b'); f.style.width = Math.round(bar * 100) + '%'; b.append(f); el.prompt.append(b); }
}
export function flashPrompt(t) { el.prompt.textContent = t; el.prompt.hidden = false; promptHold = performance.now() + 1500; }
let breathOn = false, armorW = '0%';
export function setArmor(a) { armorW = Math.max(0, Math.min(100, a)) + '%'; if (!breathOn) el.armorfill.style.width = armorW; }
// the breath meter (src/swim.js): while it's draining or refilling it takes over the armor bar, in pale blue, and
// flashes when it's nearly gone; null hands the bar back to the armor
export function setBreath(f) {
  const on = f !== null && f !== undefined;
  if (on !== breathOn) { breathOn = on; el.armorfill.parentElement.classList.toggle('breath', on); if (!on) { el.armorfill.style.width = armorW; el.armorfill.parentElement.classList.remove('low'); } }
  if (on) { el.armorfill.style.width = Math.round(Math.max(0, Math.min(1, f)) * 100) + '%'; el.armorfill.parentElement.classList.toggle('low', f < 0.25); }
}
// yellow bar under the minimap (GTA's special ability slot): nitro in a car, how drunk you are on foot (0..1)
export function setSpecial(f) { el.spfill.style.width = Math.round(Math.max(0, Math.min(1, f)) * 100) + '%'; }
let shownCash = -1, deltaSum = 0, deltaUntil = 0;
export function setCash(n) {
  if (n === shownCash) return;
  if (shownCash >= 0) {
    replay(el.cash, 'bump');
    // +$ / -$ under the cash; changes close together add up, like GTA
    const now = performance.now(); deltaSum = (now < deltaUntil ? deltaSum : 0) + n - shownCash; deltaUntil = now + 2500;
    el.cashDelta.textContent = (deltaSum >= 0 ? '+$' : '-$') + Math.abs(deltaSum).toLocaleString('en-US');
    el.cashDelta.classList.toggle('down', deltaSum < 0); replay(el.cashDelta, 'on');
  }
  shownCash = n;
  const t = '$' + n.toLocaleString('en-US');
  el.cash.textContent = t; setText(el.pauseCash, t); setText(el.shopCash, t);
}
// Top-left help box: short tips, one at a time. Text may contain <kbd>X</kbd>.
const helpQ = []; let helpT = 0;
const seenHelp = new Set();
export function help(html, secs = 6, once = true) {
  if (once && seenHelp.has(html)) return;
  seenHelp.add(html); helpQ.push({ html, secs });
  if (!helpT) nextHelp();
}
function nextHelp() {
  const h = helpQ.shift();
  if (!h) { el.helpbox.hidden = true; helpT = 0; return; }
  el.helpbox.innerHTML = h.html; el.helpbox.hidden = false;
  helpT = setTimeout(nextHelp, h.secs * 1000);
}
// Area + street name, shown for a few seconds when it changes.
let areaKey = '', areaT = 0;
export function showArea(name, street) {
  const key = name + '|' + street;
  if (key === areaKey) return;
  areaKey = key; el.areaName.textContent = name; el.streetName.textContent = street;
  el.area.classList.add('on'); clearTimeout(areaT); areaT = setTimeout(() => el.area.classList.remove('on'), 4000);
}
// list: [{ name, me, host, stars, area, playing }] for the pause ONLINE tab and the main menu's Online panel
export function renderPlayers(ul, list) {
  ul.innerHTML = '';
  for (const p of list) {
    const li = document.createElement('li'), b = document.createElement('b'), sp = document.createElement('span');
    li.classList.toggle('me', !!p.me);
    b.textContent = p.name + (p.stars ? ' ' + '★'.repeat(p.stars) : '');
    if (p.admin) b.append(' ', adminBadge());
    sp.textContent = p.playing ? [p.area, p.host ? 'runs the police' : ''].filter(Boolean).join(' · ') || 'Playing' : 'In the menu';
    li.append(b, sp); ul.append(li);
  }
}
export function setPlayers(list, online) {
  const n = list.filter((p) => p.playing).length;
  el.roomInfo.textContent = online ? `Online · ${list.length} on, ${n} playing` : 'Solo mode';
  el.shareHint.textContent = online ? `Everyone plays in the same world. Send friends this link: ${location.origin}${location.pathname}` : 'Online play turns on once Firebase is set up (see the README).';
  renderPlayers(el.playerList, list);
}

// Big center-screen callouts ("STUNT JUMP", "WANTED") one at a time.
const queue = [];
let showing = false;
export function announce(text, sub = '', color = '#ffd23f') {
  if (queue.some((q) => q.text === text)) return;
  queue.push({ text, sub, color });
  if (!showing) nextAnnounce();
}
// "MISSION PASSED"-style: big coloured title, then a dark band with a strip in the same colour.
function nextAnnounce() {
  const a = queue.shift();
  if (!a) { showing = false; return; }
  showing = true;
  el.announce.innerHTML = '';
  const t = document.createElement('div'); t.className = 'big'; t.textContent = a.text; t.style.color = a.color;
  el.announce.append(t);
  const band = document.createElement('div'); band.className = 'band';
  if (a.sub) { const s = document.createElement('div'); s.className = 'sub'; s.textContent = a.sub; band.append(s); }
  el.announce.append(band); el.announce.style.setProperty('--c', a.color);
  el.announce.classList.remove('on'); void el.announce.offsetWidth; el.announce.classList.add('on');
  setTimeout(nextAnnounce, 2600);
}

// "Friday 9:41 PM" above the minimap
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
let dayIdx = new Date().getDay(), lastHour = -1; // shortcut: weekday counts locally from today's, so players may disagree on the day; upgrade if daynight.js ever exports a day number
export function setClock(time) { // (main.js also passes weather and night; the HUD no longer shows them)
  const [h, m] = time.split(':').map(Number);
  if (h < lastHour) dayIdx = (dayIdx + 1) % 7;
  lastHour = h;
  const hm = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`, t = `${DAYS[dayIdx]} ${hm}`;
  if (el.clock.textContent !== t) el.clock.textContent = t;
  setText(el.pauseDay, DAYS[dayIdx]); setText(el.pauseTime, hm);
}
let lastVeh = null;
export function setSpeedo(v, station = '', nitro = 0) {
  // vehicle name, big and bottom-right for a few seconds after getting in (GTA does this)
  if (v !== lastVeh) { lastVeh = v; if (v) { el.vehName.textContent = v.T.name; replay(el.vehName, 'on'); } }
  if (!v) { el.speedo.hidden = true; return; }
  el.speedo.hidden = false;
  let alt = v.T.heli || v.T.plane ? `<span>Altitude ${Math.round((v.alt ?? v.y) * FT)} ft</span>` : '';
  // planes: a little artificial horizon (the line tilts with the bank and moves with the pitch) + throttle
  if (v.T.plane) alt += `<span style="display:flex;align-items:center;gap:8px;justify-content:flex-end">Throttle ${Math.round((v.thr || 0) * 100)}%<i style="position:relative;display:inline-block;width:44px;height:28px;overflow:hidden;border-radius:4px;background:#2b6fb3;box-shadow:0 0 0 1px rgba(0,0,0,.6)"><i style="position:absolute;left:-30px;right:-30px;top:50%;height:60px;background:#7a5a33;transform:translateY(${Math.round(Math.max(-0.8, Math.min(0.8, v.pitch || 0)) * 30)}px) rotate(${(-(v.roll || 0)).toFixed(2)}rad);transform-origin:50% 0"></i><i style="position:absolute;left:14px;right:14px;top:13px;height:2px;background:#ffd23f"></i></i></span>`;
  // damage meter: green when healthy, red when it's about to give up
  const hp = Math.max(0, Math.min(1, v.hp / v.T.hp)), hc = hp > 0.6 ? '#7cf29a' : hp > 0.3 ? '#ffc94a' : '#ff5e5b';
  const dm = `<div id="vdmg" title="Damage"><i style="width:${Math.round(hp * 100)}%;background:${hc}"></i></div>`;
  el.speedo.innerHTML = `<b>${fmtSpeed(v.speed)}</b><small>mph</small>${station ? `<span>${station}</span>` : ''}${alt}${dm}`;
}
let hitT = 0;
export function hitMarker(kill) {
  el.crosshair.classList.add(kill ? 'kill' : 'hit');
  clearTimeout(hitT);
  hitT = setTimeout(() => el.crosshair.classList.remove('hit', 'kill'), 160);
}

// ---------- weapon wheel: a ring of slices, the hovered one lights up ----------
let slices = [];
const SVGNS = 'http://www.w3.org/2000/svg';
function sector(a0, a1, r0, r1) {
  const p = (r, a) => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`;
}
export function buildWheel(weapons, onPick) {
  const ring = el.wheel.querySelector('.ring');
  const n = weapons.length, gap = 0;
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '-100 -100 200 200'); svg.classList.add('wheelSvg');
  const hubBg = document.createElementNS(SVGNS, 'circle');
  hubBg.setAttribute('r', '47'); hubBg.classList.add('hubBg'); svg.append(hubBg);
  slices = weapons.map((w, i) => {
    const mid = -Math.PI / 2 + (i * Math.PI * 2) / n, half = Math.PI / n;
    const g = document.createElementNS(SVGNS, 'g'); g.classList.add('slice');
    const path = document.createElementNS(SVGNS, 'path');
    path.setAttribute('d', sector(mid - half + gap, mid + half - gap, 58, 97));
    // teal arc along the outer edge, shown on the selected slice
    const arc = document.createElementNS(SVGNS, 'path');
    arc.setAttribute('d', sector(mid - half + 0.02, mid + half - 0.02, 93.5, 97)); arc.classList.add('arc');
    g.append(path, arc);
    const ix = Math.cos(mid) * 77, iy = Math.sin(mid) * 77;
    const icon = document.createElementNS(SVGNS, 'g');
    icon.setAttribute('transform', `translate(${(ix - 17).toFixed(1)} ${(iy - 8.5).toFixed(1)}) scale(0.7)`);
    icon.innerHTML = ICONS[w.name] || '';
    icon.classList.add('icon'); g.append(icon);
    g.addEventListener('pointerenter', () => wheelHighlight(i, weapons[i]));
    g.addEventListener('click', () => onPick(i));
    svg.append(g);
    return { g };
  });
  ring.prepend(svg);
}
export function showWheel(on) { el.wheel.hidden = !on; }
let wheelInfo = () => '';
export function setWheelInfo(fn) { wheelInfo = fn; }
export function wheelHighlight(i, w) {
  slices.forEach((s, k) => s.g.classList.toggle('sel', k === i));
  el.wheelName.textContent = w.name;
  const dmg = w.grenade ? 100 : Math.min(100, (w.dmg * (w.pellets || 1)) / 0.9);
  const rate = Math.min(100, w.rate * 8);
  const range = w.melee ? 5 : w.grenade ? 30 : Math.min(100, w.range / 2);
  el.wheelStats.innerHTML = `<p class="ammoLine">${wheelInfo(i)}</p>` + [['Damage', dmg], ['Fire rate', rate], ['Range', range]]
    .map(([k, v]) => `<div><span>${k}</span><i><b style="width:${v}%"></b></i></div>`).join('');
}
export function wheelIndex(dx, dy, n) {
  const a = Math.atan2(dy, dx) + Math.PI / 2;
  return ((Math.round(a / ((Math.PI * 2) / n)) % n) + n) % n;
}

// ---------- maps ----------
// The whole city is pre-drawn once at 1 px = 4 m (water, land, every street); the minimap and a
// zoomed-in pause map draw crisp vector streets and loaded buildings on top.
const mm = el.minimap.getContext('2d');
const SCALE = 0.6; // minimap pixels per metre (before zoom)
let BASE_S = 0.25; // shrunk for the whole region so the base canvas stays under 4096 px
let minX = 0, minZ = 0, maxX = 1, maxZ = 1, base = null;
// GTA V radar palette: slate land, translucent grey roads (wider on highways), blocks barely lighter than
// the land, water a lighter blue-grey with a pale shoreline. Shared with the pause map. roads: [colour, width factor]
export const MAP_COLORS = {
  land: '#2f3842', offmap: '#2b333d', water: '#3e4c5b', shore: '#7c8a98', bldg: '#37414c', route: '#a65cff',
  roads: { motor: ['rgba(160,167,174,.92)', 1.35], trunk: ['rgba(152,159,166,.9)', 1.25], primary: ['rgba(142,149,156,.86)', 1.1], secondary: ['rgba(142,149,156,.82)', 1], tertiary: ['rgba(142,149,156,.78)', 0.95], minor: ['rgba(142,149,156,.66)', 0.85], residential: ['rgba(142,149,156,.66)', 0.85], service: ['rgba(142,149,156,.5)', 0.7] },
};
const ROAD_STYLE = MAP_COLORS.roads, WATER = MAP_COLORS.water, BLDG = MAP_COLORS.bldg;
export function drawMapBase() {
  const I = W.D.index;
  minX = I.tx0 * 200; maxX = (I.tx1 + 1) * 200; minZ = I.tz0 * 200; maxZ = (I.tz1 + 1) * 200;
  BASE_S = Math.min(0.25, 4096 / (maxX - minX), 4096 / (maxZ - minZ));
  base = document.createElement('canvas');
  base.width = Math.ceil((maxX - minX) * BASE_S); base.height = Math.ceil((maxZ - minZ) * BASE_S);
  const g = base.getContext('2d');
  // land / water from the coarse grid, smoothed by scaling up
  // land as a mask (water left transparent): drawn pale and nudged around first for the shoreline, then land on top
  const c = W.D.coarse;
  const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const landMask = (colOf) => {
    const cv = document.createElement('canvas'); cv.width = c.w; cv.height = c.h;
    const cg = cv.getContext('2d'), img = cg.createImageData(c.w, c.h);
    for (let k = 0; k < c.w * c.h; k++) if (c.kind[k] !== 1) img.data.set([...colOf(c.kind[k]), 255], k * 4);
    cg.putImageData(img, 0, 0); return cv;
  };
  const SH = rgb(MAP_COLORS.shore), CL = rgb(MAP_COLORS.land), CO = rgb(MAP_COLORS.offmap);
  const shore = landMask(() => SH), land = landMask((kind) => (kind === 2 ? CO : CL));
  g.fillStyle = WATER; g.fillRect(0, 0, base.width, base.height);
  g.imageSmoothingEnabled = true;
  const lx = (c.x0 - minX) * BASE_S - c.step * BASE_S / 2, lz = (c.z0 - minZ) * BASE_S - c.step * BASE_S / 2, lw = c.w * c.step * BASE_S, lh = c.h * c.step * BASE_S;
  for (const [ox, oz] of [[-0.8, 0], [0.8, 0], [0, -0.8], [0, 0.8]]) g.drawImage(shore, lx + ox, lz + oz, lw, lh);
  g.drawImage(land, lx, lz, lw, lh);
  g.save(); g.scale(BASE_S, BASE_S); g.translate(-minX, -minZ); g.lineCap = 'round'; g.lineJoin = 'round';
  for (const cls of ['service', 'residential', 'minor', 'tertiary', 'secondary', 'primary', 'trunk', 'motor']) {
    const [color, k] = ROAD_STYLE[cls];
    g.strokeStyle = color; g.lineWidth = Math.max(1 / BASE_S, 0);
    g.beginPath();
    for (const P of W.D.overview.roads?.[cls] || []) polyline(g, P); // major roads for the whole region (street chunks load on demand)
    g.lineWidth = Math.max(cls === 'service' ? 4 : cls === 'residential' || cls === 'minor' ? 7 : 12, (cls === 'motor' || cls === 'trunk' ? 1.6 : 1.1) / BASE_S);
    g.stroke();
  }
  g.restore();
}
function polyline(g, P) { g.moveTo(P[0], P[1]); for (let i = 2; i < P.length; i += 2) g.lineTo(P[i], P[i + 1]); }
// streets + buildings as vectors in world coordinates (the context is already transformed)
function drawVectors(g, x, z, r, pxPerM) {
  g.fillStyle = BLDG;
  g.beginPath();
  for (const f of W.footprintsNear(x, z, r)) { g.moveTo(f[0], f[1]); for (let i = 2; i < f.length; i += 2) g.lineTo(f[i], f[i + 1]); g.closePath(); }
  g.fill();
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (r < 3000) W.ensureRoads(x - r, z - r, x + r, z + r); // the streets you're looking at
  const ids = W.edgesNear(x, z, r), byCls = {};
  for (const id of ids) { const e = W.G.edges[id]; (byCls[e.cls] = byCls[e.cls] || []).push(e); }
  for (const cls of ['service', 'residential', 'minor', 'tertiary', 'secondary', 'primary', 'trunk', 'motor']) {
    const list = byCls[cls]; if (!list) continue;
    const [color, k] = ROAD_STYLE[cls];
    g.strokeStyle = color; g.lineWidth = Math.max(list[0].width * k, 2.2 / pxPerM);
    g.beginPath(); for (const e of list) polyline(g, e.pts); g.stroke();
  }
}
function drawRoute(g, route, pxPerM, from = 0) {
  if (!route || route.length < 2) return;
  g.strokeStyle = MAP_COLORS.route; g.lineWidth = 6 / pxPerM; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(route[from][0], route[from][1]); for (let i = from + 1; i < route.length; i++) g.lineTo(route[i][0], route[i][1]); g.stroke();
}
// gang turf: faint coloured circles on both maps
let turfs = [];
export function setTurfs(list) { turfs = list; }
function drawTurfs(c, lineW) {
  for (const g of turfs) {
    c.fillStyle = g.color + '22'; c.strokeStyle = g.color + '88'; c.lineWidth = lineW;
    c.beginPath(); c.arc(g.x, g.z, g.r, 0, 7); c.fill(); c.stroke();
  }
}
// The minimap canvas is tilted back in CSS (rotateX inside #mmView), so only part of it is on screen:
// VIS is that part as fractions of the canvas (the narrow bottom edge sets the sides), CY puts the player
// a little below the middle of what you see.
const VIS = { x0: 1 / 7, x1: 6 / 7, y0: 0.07, y1: 1 }, CY = 0.64;
let lastDist = '';
const MAP_FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
// ---------- map blips: GTA-style coloured discs with a white ring and a small white glyph ----------
// icons draw in a 20x20 box centred on 0,0 (the disc has radius 10); fill/stroke are preset to the ink colour
const ICON = {
  text: (t) => (g) => { g.font = `700 14px ${MAP_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 0, 1); },
  gun: (g) => { g.fillRect(-6, -3.5, 12, 3); g.beginPath(); g.moveTo(-5, -1); g.lineTo(-1, -1); g.lineTo(-2.2, 5); g.lineTo(-5.6, 5); g.fill(); },
  shirt: (g) => { g.beginPath(); for (const [x, y] of [[-2.5, -5], [2.5, -5], [6, -2.5], [4.5, 0.5], [3, -0.5], [3, 5], [-3, 5], [-3, -0.5], [-4.5, 0.5], [-6, -2.5]]) g.lineTo(x, y); g.fill(); },
  wrench: (g) => { g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-4.5, 4.5); g.lineTo(2, -2); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(3.2, -3.2, 2.6, 0.8, 5.5); g.stroke(); },
  cross: (g) => { g.fillRect(-1.8, -5.5, 3.6, 11); g.fillRect(-5.5, -1.8, 11, 3.6); },
  star: (g) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 2.5 : 6; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill(); },
  flame: (g) => { g.beginPath(); g.moveTo(0, -6.5); g.quadraticCurveTo(6, -0.5, 3.6, 3.8); g.quadraticCurveTo(0, 7, -3.6, 3.8); g.quadraticCurveTo(-5.5, 0, -1.5, -2.5); g.quadraticCurveTo(-0.5, -4, 0, -6.5); g.fill(); },
  pump: (g) => { g.fillRect(-5, -5.5, 6.5, 11); g.lineWidth = 1.4; g.beginPath(); g.moveTo(1.5, -3.5); g.lineTo(4.5, -1.5); g.lineTo(4.5, 3.5); g.stroke(); },
  cart: (g) => { g.lineWidth = 1.5; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-6.5, -4.5); g.lineTo(-4.5, -4.5); g.lineTo(-2.8, 2); g.lineTo(4.5, 2); g.lineTo(5.8, -2.8); g.lineTo(-3.8, -2.8); g.stroke(); g.beginPath(); g.arc(-1.8, 4.4, 1.3, 0, 7); g.arc(3.6, 4.4, 1.3, 0, 7); g.fill(); },
  food: (g) => {
    g.lineWidth = 1.2; g.beginPath(); for (const x of [-4.5, -3, -1.5]) { g.moveTo(x, -5.5); g.lineTo(x, -1.5); } g.moveTo(-4.5, -1.5); g.quadraticCurveTo(-3, 0.8, -1.5, -1.5); g.stroke();
    g.fillRect(-3.8, -0.5, 1.6, 6); g.beginPath(); g.moveTo(2, -5.5); g.quadraticCurveTo(5.5, -3, 4.2, 1); g.lineTo(2, 1); g.fill(); g.fillRect(2, 0.5, 1.6, 5);
  },
  cup: (g) => { g.beginPath(); g.moveTo(-5.5, -3); g.lineTo(3, -3); g.lineTo(2, 4.5); g.lineTo(-4.5, 4.5); g.fill(); g.lineWidth = 1.5; g.beginPath(); g.arc(3, 0, 2.3, -1.4, 1.4); g.stroke(); },
  glass: (g) => { g.beginPath(); g.moveTo(-5.5, -4.5); g.lineTo(5.5, -4.5); g.lineTo(0, 1.5); g.fill(); g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, 1); g.lineTo(0, 5); g.moveTo(-3, 5.2); g.lineTo(3, 5.2); g.stroke(); },
  bank: (g) => { g.beginPath(); g.moveTo(-6.5, -2); g.lineTo(0, -6); g.lineTo(6.5, -2); g.fill(); for (const x of [-5, -1, 3]) g.fillRect(x, -1, 2, 5); g.fillRect(-6.5, 4.5, 13, 1.6); },
  tree: (g) => { g.beginPath(); g.arc(0, -1.5, 4.8, 0, 7); g.fill(); g.fillRect(-1, 2, 2, 4.5); },
  school: (g) => { g.beginPath(); g.moveTo(-7, -2); g.lineTo(0, -5.5); g.lineTo(7, -2); g.lineTo(0, 1.5); g.fill(); g.beginPath(); g.moveTo(-4, -0.5); g.lineTo(-4, 3.5); g.quadraticCurveTo(0, 6, 4, 3.5); g.lineTo(4, -0.5); g.lineTo(0, 1.5); g.fill(); },
  monument: (g) => { g.beginPath(); g.moveTo(-1.8, 3.5); g.lineTo(-1.2, -4); g.lineTo(0, -6); g.lineTo(1.2, -4); g.lineTo(1.8, 3.5); g.fill(); g.fillRect(-4.5, 3.5, 9, 2.2); },
  diamond: (g) => { g.beginPath(); g.moveTo(0, -6); g.lineTo(5, 0); g.lineTo(0, 6); g.lineTo(-5, 0); g.fill(); },
  arrow: (g) => { g.beginPath(); g.moveTo(0, -7); g.lineTo(5.5, 6); g.lineTo(0, 3); g.lineTo(-5.5, 6); g.fill(); },
  bike: (g) => { g.lineWidth = 1.5; g.beginPath(); g.arc(-3.8, 2.2, 2.9, 0, 7); g.moveTo(6.7, 2.2); g.arc(3.8, 2.2, 2.9, 0, 7); g.moveTo(-3.8, 2.2); g.lineTo(-1, -2.6); g.lineTo(3, -2.6); g.lineTo(3.8, 2.2); g.moveTo(0, 2.2); g.lineTo(-1, -2.6); g.moveTo(-2.4, -4.4); g.lineTo(0.2, -4.4); g.moveTo(3, -2.6); g.lineTo(2.2, -5); g.lineTo(4.2, -5); g.stroke(); },
  car: (g) => { g.beginPath(); g.moveTo(-6.5, 2.5); g.lineTo(-6.5, -0.5); g.lineTo(-4, -1.2); g.lineTo(-2.5, -4.5); g.lineTo(2.5, -4.5); g.lineTo(4, -1.2); g.lineTo(6.5, -0.5); g.lineTo(6.5, 2.5); g.fill(); g.beginPath(); g.arc(-3.8, 3, 1.9, 0, 7); g.fill(); g.beginPath(); g.arc(3.8, 3, 1.9, 0, 7); g.fill(); },
};
// legend order; tier = how far out the pause map still shows it (0 = always, 1 = mid zoom, 2 = close in).
// Tier 0 is also what the minimap keeps beyond ~150 m (main.js filters the rest by distance).
export const BLIP_TYPES = {
  you: { name: 'You', color: '#20262d', icon: ICON.arrow, fixed: true },
  waypoint: { name: 'Waypoint', color: MAP_COLORS.route, tier: 0 },
  rob: { name: 'Convenience store', color: '#2fbf4a', icon: ICON.text('$'), tier: 0 },
  guns: { name: 'Gun store', color: '#d23c30', icon: ICON.gun, tier: 0 },
  clothes: { name: 'Clothing', color: '#b45ad6', icon: ICON.shirt, tier: 1 },
  garage: { name: 'Mechanic / garage', color: '#3f8fe0', icon: ICON.wrench, tier: 0 },
  car: { name: 'Personal vehicle', color: '#2f80ed', icon: ICON.car, tier: 0 },
  ebike: { name: 'Arnett Bike dock (e-bikes)', color: '#1e6fd0', icon: ICON.bike, tier: 1 },
  casino: { name: 'Casino', color: '#d4a017', icon: ICON.diamond, tier: 0 },
  hospital: { name: 'Hospital', color: '#fff', ink: '#d23c30', icon: ICON.cross, tier: 0 },
  police: { name: 'Police', color: '#2f6fdc', icon: ICON.star, tier: 0 },
  fire: { name: 'Fire station', color: '#e8622c', icon: ICON.flame, tier: 1 },
  event: { name: 'Event', color: '#ff9100', icon: ICON.text('!'), tier: 0 },
  gas: { name: 'Gas station', color: '#7d8a97', icon: ICON.pump, tier: 1 },
  shop: { name: 'Shop', color: '#23a090', icon: ICON.cart, tier: 2 },
  food: { name: 'Restaurant', color: '#e0962c', icon: ICON.food, tier: 2 },
  cafe: { name: 'Cafe', color: '#9a6a45', icon: ICON.cup, tier: 2 },
  bar: { name: 'Bar', color: '#b8427c', icon: ICON.glass, tier: 1 },
  bank: { name: 'Bank', color: '#3d8a5a', icon: ICON.bank, tier: 1 },
  pharmacy: { name: 'Pharmacy', color: '#3fae6a', icon: ICON.cross, tier: 2 },
  park: { name: 'Park', color: '#4f8a3e', icon: ICON.tree, tier: 2 },
  school: { name: 'School', color: '#c9a227', icon: ICON.school, tier: 2 },
  landmark: { name: 'Landmark', color: '#7c6bd0', icon: ICON.monument, tier: 1 },
  player: { name: 'Players', color: '#40c4ff', tier: 0 },
};
// one blip: typed blips get their colour + glyph (grey when b.dim); untyped ones (cops, players) keep b.color / b.label
function drawBlip(g, b, x, y, r) {
  const T = BLIP_TYPES[b.type];
  g.fillStyle = b.dim ? '#7a7f87' : T ? T.color : b.color; g.strokeStyle = '#fff'; g.lineWidth = Math.max(1.4, r * 0.24);
  g.beginPath();
  if (!T && b.shape === 'square') g.rect(x - r, y - r, r * 2, r * 2); else g.arc(x, y, r, 0, 7);
  g.fill(); g.stroke();
  if (T && T.icon) { g.save(); g.translate(x, y); g.scale(r / 10, r / 10); g.fillStyle = g.strokeStyle = T.ink || '#fff'; T.icon(g); g.restore(); }
  else if (b.label) { g.fillStyle = '#141414'; g.font = `600 ${Math.round(r * 1.8)}px ${MAP_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(b.label, x, y + 0.5); }
}
export function drawMinimap(view, me, blips, zoom = 1, cones = null, waypoint = null, route = null) {
  const Wd = el.minimap.width, Ht = el.minimap.height, cx = Wd / 2, cy = Ht * CY, k = zoom;
  const alpha = -Math.PI / 2 - Math.atan2(Math.cos(view.yaw), Math.sin(view.yaw));
  const raw = (x, z) => { const dx = (x - view.x) * SCALE * k, dz = (z - view.z) * SCALE * k; return [cx + dx * Math.cos(alpha) - dz * Math.sin(alpha), cy + dx * Math.sin(alpha) + dz * Math.cos(alpha)]; };
  // keep a point inside the frame (for blips that are off the edge)
  const clampPt = ([x, y], m = 8) => {
    const dx = x - cx, dy = y - cy;
    const sx = dx ? (dx > 0 ? (Wd * VIS.x1 - m - cx) / dx : (Wd * VIS.x0 + m - cx) / dx) : Infinity, sy = dy ? (dy > 0 ? (Ht * VIS.y1 - m - cy) / dy : (Ht * VIS.y0 + m - cy) / dy) : Infinity;
    const t = Math.min(1, sx, sy);
    return [cx + dx * t, cy + dy * t, t < 1];
  };
  mm.save();
  mm.clearRect(0, 0, Wd, Ht);
  mm.fillStyle = WATER; mm.fillRect(0, 0, Wd, Ht);
  const ppm = SCALE * k;
  mm.translate(cx, cy); mm.rotate(alpha); mm.scale(ppm, ppm); mm.translate(-view.x, -view.z);
  if (base) mm.drawImage(base, minX, minZ, base.width / BASE_S, base.height / BASE_S);
  drawVectors(mm, view.x, view.z, Math.hypot(Wd / 2, Ht * CY) / ppm, ppm);
  drawTurfs(mm, 2 / ppm);
  drawRoute(mm, route, ppm);
  mm.restore();
  if (cones) {
    for (const cn of cones) {
      mm.fillStyle = 'rgba(229, 72, 77, 0.3)'; mm.strokeStyle = 'rgba(229, 72, 77, 0.7)'; mm.lineWidth = 1;
      mm.beginPath();
      if (cn.heli) { const [hx, hy] = raw(cn.x, cn.z); mm.arc(hx, hy, cn.r * SCALE * k, 0, 7); }
      else { const [sx, sy] = raw(cn.x, cn.z); mm.moveTo(sx, sy); for (const p of cn.pts) { const [px, py] = raw(p[0], p[1]); mm.lineTo(px, py); } mm.closePath(); }
      mm.fill(); mm.stroke();
    }
  }
  if (waypoint) {
    const [wx, wy, edge] = clampPt(raw(waypoint.x, waypoint.z), 10);
    if (!route) { const [px, py] = raw(me.x, me.z); mm.strokeStyle = 'rgba(190, 120, 255, 0.85)'; mm.lineWidth = 3; mm.setLineDash([6, 5]); mm.beginPath(); mm.moveTo(px, py); mm.lineTo(wx, wy); mm.stroke(); mm.setLineDash([]); }
    mm.fillStyle = '#b678ff'; mm.strokeStyle = '#000'; mm.lineWidth = 1.5;
    mm.beginPath(); mm.arc(wx, wy, edge ? 5 : 6.5, 0, 7); mm.fill(); mm.stroke();
  }
  for (const b of blips) { const [x, y] = clampPt(raw(b.x, b.z)); drawBlip(mm, b, x, y, b.type ? 6.5 : b.size); }
  const [nx, ny] = clampPt(raw(view.x, view.z - 100000), 11);
  mm.fillStyle = 'rgba(20,24,28,.9)'; mm.beginPath(); mm.arc(nx, ny, 8, 0, 7); mm.fill();
  mm.fillStyle = '#fff'; mm.font = '600 12px "Barlow Condensed", "Arial Narrow", sans-serif'; mm.textAlign = 'center'; mm.textBaseline = 'middle'; mm.fillText('N', nx, ny + 0.5);
  // distance left to the waypoint, along the GPS route when there is one
  let dist = '';
  if (waypoint) {
    let d = 0;
    if (route && route.length > 1) { d = Math.hypot(route[0][0] - view.x, route[0][1] - view.z); for (let i = 1; i < route.length; i++) d += Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]); }
    else d = Math.hypot(waypoint.x - view.x, waypoint.z - view.z);
    dist = '↑ ' + fmtDist(d);
  }
  if (dist !== lastDist) { lastDist = dist; el.mmDist.textContent = dist; }
  const [px, py] = raw(me.x, me.z);
  const hx = Math.sin(me.h), hz = Math.cos(me.h);
  const ang = Math.atan2(hx * Math.sin(alpha) + hz * Math.cos(alpha), hx * Math.cos(alpha) - hz * Math.sin(alpha));
  mm.save(); mm.translate(px, py); mm.rotate(ang);
  mm.fillStyle = '#fff'; mm.strokeStyle = '#000'; mm.lineWidth = 1.5;
  mm.beginPath(); mm.moveTo(8, 0); mm.lineTo(-5, 5.5); mm.lineTo(-2, 0); mm.lineTo(-5, -5.5); mm.closePath(); mm.fill(); mm.stroke();
  mm.restore();
}

// ---------- pause map ----------
// Zoom bands in pixels per metre. Far out: IOWA / ILLINOIS and the river; mid: town names over soft tinted town limits;
// in: neighbourhood names and borders; closest: street names and every place. Each fades over a 1.7x zoom band.
const Z = { city: 0.035, t1: 0.1, hood: 0.2, t2: 0.35, street: 0.9, max: 3 };
const TIER_S = [0, Z.t1, Z.t2];
const fade = (s, at) => Math.max(0, Math.min(1, Math.log(s / at) / Math.log(1.7) + 0.5));
// view: centre + pixels per metre; ts/za = zoom target and the world point kept under the cursor while easing there.
// w/h = the canvas's CSS size; off = blip types switched off in the legend, hl = the type whose legend row is hovered
const big = { cx: 0, cz: 0, s: 0, ts: 0, za: null, fit: 0, w: el.bigmap.width, h: el.bigmap.height, last: null, drag: null, moved: false, off: new Set(), hl: null, keys: new Set(), raf: 0, t: 0 };
const bm = el.bigmap.getContext('2d');
// towns, counties, states, neighbourhoods and the river label, built once from the region index (paths in world metres)
const IOWA_COUNTIES = new Set(['Scott County', 'Clinton County', 'Muscatine County', 'Cedar County']);
let regions = null;
function regionData() {
  if (regions) return regions;
  const I = W.D.index;
  const pathOf = (rings) => { const p = new Path2D(); for (const r of rings) { p.moveTo(r[0], r[1]); for (let i = 2; i < r.length; i += 2) p.lineTo(r[i], r[i + 1]); p.closePath(); } return p; };
  const centre = (rings) => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const r of rings) for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); z0 = Math.min(z0, r[i + 1]); z1 = Math.max(z1, r[i + 1]); } return [(x0 + x1) / 2, (z0 + z1) / 2]; };
  const circle = (x, z, r) => { const p = new Path2D(); p.arc(x, z, r, 0, Math.PI * 2); return p; };
  const counties = (I.counties || []).filter((c) => c.rings?.length).map((c) => { const [x, z] = centre(c.rings); return { path: pathOf(c.rings), x, z, iowa: IOWA_COUNTIES.has(c.name) }; });
  const states = [];
  for (const [name, iowa] of [['IOWA', true], ['ILLINOIS', false]]) {
    const cs = counties.filter((c) => c.iowa === iowa);
    if (cs.length) states.push({ name, x: cs.reduce((a, c) => a + c.x, 0) / cs.length, z: cs.reduce((a, c) => a + c.z, 0) / cs.length });
  }
  const towns = (I.towns || []).map((t, i) => ({ name: t.name, place: t.place, x: t.x, z: t.z, hue: Math.round((i * 137.5) % 360), path: t.rings?.length ? pathOf(t.rings) : null }));
  const hoods = (I.hoods || []).map((h) => ({ name: h.name, x: h.x, z: h.z, path: h.rings?.length ? pathOf(h.rings) : circle(h.x, h.z, h.r || 500) }));
  let river = null;
  const R = I.river;
  if (R?.length > 8) {
    const n = R.length / 2, i = Math.floor(n / 2) * 2, a = Math.max(0, i - 20), b = Math.min(R.length - 2, i + 20);
    let ang = Math.atan2(R[b + 1] - R[a + 1], R[b] - R[a]);
    if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
    river = { x: R[i], z: R[i + 1], ang };
  }
  return (regions = { counties, states, towns, hoods, river });
}
// world-space layers under the roads: tinted town limits, dashed county lines, neighbourhood borders
function drawRegions(g, s) {
  const R = regionData();
  const tint = fade(s, Z.city) * (1 - 0.7 * fade(s, Z.street));
  if (tint > 0.02) {
    g.lineWidth = 1.5 / s;
    for (const t of R.towns) if (t.path) {
      g.fillStyle = `hsla(${t.hue},60%,62%,${(0.14 * tint).toFixed(3)})`; g.fill(t.path, 'evenodd');
      g.strokeStyle = `hsla(${t.hue},60%,72%,${(0.5 * tint).toFixed(3)})`; g.stroke(t.path);
    }
  }
  const ca = 1 - fade(s, Z.street);
  if (ca > 0.02) { g.setLineDash([8 / s, 6 / s]); g.lineWidth = 1.2 / s; g.strokeStyle = `rgba(255,255,255,${(0.25 * ca).toFixed(3)})`; for (const c of R.counties) g.stroke(c.path); }
  const ha = fade(s, Z.hood);
  if (ha > 0.02) { g.setLineDash([4 / s, 4 / s]); g.lineWidth = 1.2 / s; g.strokeStyle = `rgba(255,255,255,${(0.4 * ha).toFixed(3)})`; for (const h of R.hoods) g.stroke(h.path); }
  g.setLineDash([]);
}
// screen-space labels; free(box) reserves a rectangle and says no if it would overlap one already placed
function regionLabels(g, P, s, Wd, Ht, free) {
  const R = regionData();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.6)';
  const label = (text, wx, wz, font, color, a, spacing = '0px', ang = 0) => {
    if (a < 0.05) return;
    const [x, y] = P(wx, wz);
    if (x < -150 || y < -40 || x > Wd + 150 || y > Ht + 40) return;
    g.font = font; g.letterSpacing = spacing;
    const w = g.measureText(text).width, h = parseInt(font.match(/(\d+)px/)[1], 10), c = Math.abs(Math.cos(ang)), sn = Math.abs(Math.sin(ang));
    const hw = (w * c + h * sn) / 2 + 3, hh = (w * sn + h * c) / 2;
    if (free([x - hw, y - hh, x + hw, y + hh])) {
      g.save(); g.globalAlpha = a; g.fillStyle = color; g.translate(x, y); g.rotate(ang);
      g.strokeText(text, 0, 1); g.fillText(text, 0, 1); g.restore();
    }
    g.letterSpacing = '0px';
  };
  const far = 1 - fade(s, Z.city * 2.5);
  for (const st of R.states) label(st.name, st.x, st.z, `700 34px ${MAP_FONT}`, 'rgba(255,255,255,.6)', far, '10px');
  if (R.river) label('MISSISSIPPI RIVER', R.river.x, R.river.z, `italic 600 16px ${MAP_FONT}`, '#b9cddd', 1 - fade(s, Z.hood), '3px', R.river.ang);
  const out = 1 - fade(s, Z.street * 1.5);
  for (const t of R.towns) {
    const big_ = t.place === 'city', at = big_ ? Z.city * 0.8 : t.place === 'town' ? Z.city * 1.4 : t.place === 'village' ? Z.t1 : Z.hood;
    const font = big_ ? `700 21px ${MAP_FONT}` : t.place === 'town' ? `600 18px ${MAP_FONT}` : t.place === 'village' ? `600 16px ${MAP_FONT}` : `500 14px ${MAP_FONT}`;
    label(big_ ? t.name.toUpperCase() : t.name, t.x, t.z, font, '#fff', fade(s, at) * out, big_ ? '2px' : '0px');
  }
  for (const h of R.hoods) label(h.name, h.x, h.z, `italic 500 15px ${MAP_FONT}`, '#e6ecf2', fade(s, Z.hood) * (1 - 0.4 * fade(s, Z.street)));
}
// street names along the longest straight bit of each named street, one label per name per ~260 px
const nameW = new Map();
function streetLabels(g, P, s, Wd, Ht, free) {
  const a = fade(s, Z.street);
  if (a < 0.05) return;
  g.font = `500 13px ${MAP_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = 'rgba(20,24,28,.85)'; g.fillStyle = '#e8edf2'; g.globalAlpha = a;
  const placed = new Map();
  let n = 0;
  for (const id of W.edgesNear(big.cx, big.cz, Math.hypot(Wd, Ht) / s * 0.55)) {
    const e = W.G.edges[id];
    if (!e.name || e.cls === 'service' || n > 90) continue;
    let w = nameW.get(e.name); if (w === undefined) { w = g.measureText(e.name).width; nameW.set(e.name, w); }
    const pts = e.pts;
    let best = 0, bi = 0;
    for (let i = 0; i + 3 < pts.length; i += 2) { const l = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]); if (l > best) { best = l; bi = i; } }
    if (best * s < w + 12) continue;
    const [x, y] = P((pts[bi] + pts[bi + 2]) / 2, (pts[bi + 1] + pts[bi + 3]) / 2);
    if (x < 0 || y < 0 || x > Wd || y > Ht) continue;
    const prev = placed.get(e.name);
    if (prev && prev.some(([px, py]) => Math.hypot(px - x, py - y) < 260)) continue;
    let ang = Math.atan2(pts[bi + 3] - pts[bi + 1], pts[bi + 2] - pts[bi]);
    if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
    const c = Math.abs(Math.cos(ang)), sn = Math.abs(Math.sin(ang)), hw = (w * c + 13 * sn) / 2 + 2, hh = (w * sn + 13 * c) / 2;
    if (!free([x - hw, y - hh, x + hw, y + hh])) continue;
    (prev || placed.set(e.name, []).get(e.name)).push([x, y]); n++;
    g.save(); g.translate(x, y); g.rotate(ang); g.strokeText(e.name, 0, 1); g.fillText(e.name, 0, 1); g.restore();
  }
  g.globalAlpha = 1;
}
export function drawBigMap(me, blips, waypoint, route) {
  big.last = [me, blips, waypoint, route];
  // match the buffer to the on-screen size (sharp on hi-dpi); a hidden tab keeps the last size
  const r = el.bigmap.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5);
  if (r.width && r.height) {
    big.w = r.width; big.h = r.height;
    const bw = Math.round(r.width * dpr), bh = Math.round(r.height * dpr);
    if (el.bigmap.width !== bw || el.bigmap.height !== bh) { el.bigmap.width = bw; el.bigmap.height = bh; }
  }
  const Wd = big.w, Ht = big.h;
  big.fit = Math.min(Wd / (maxX - minX), Ht / (maxZ - minZ));
  if (!big.s) { big.s = big.ts = Math.min(Z.max, Math.max(big.fit * 2.2, 0.12)); big.cx = me.x; big.cz = me.z; }
  const s = big.s;
  // keep the view on the map: past its edge there is no data (that showed as a blank strip)
  const keep = (c, lo, hi, half) => (hi - lo <= half * 2 ? (lo + hi) / 2 : Math.max(lo + half, Math.min(hi - half, c)));
  big.cx = keep(big.cx, minX, maxX, Wd / 2 / s); big.cz = keep(big.cz, minZ, maxZ, Ht / 2 / s);
  bm.setTransform(el.bigmap.width / Wd, 0, 0, el.bigmap.height / Ht, 0, 0);
  bm.save();
  bm.fillStyle = MAP_COLORS.offmap; bm.fillRect(0, 0, Wd, Ht);
  bm.translate(Wd / 2, Ht / 2); bm.scale(s, s); bm.translate(-big.cx, -big.cz);
  if (base) { bm.imageSmoothingEnabled = true; bm.drawImage(base, minX, minZ, base.width / BASE_S, base.height / BASE_S); }
  drawRegions(bm, s);
  if (s > 0.45) drawVectors(bm, big.cx, big.cz, Math.hypot(Wd, Ht) / s * 0.55, s);
  drawTurfs(bm, 2 / s);
  drawRoute(bm, route, s);
  bm.restore();
  const P = (x, z) => [Wd / 2 + (x - big.cx) * s, Ht / 2 + (z - big.cz) * s];
  const boxes = [], free = (b) => { if (boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) return false; boxes.push(b); return true; };
  regionLabels(bm, P, s, Wd, Ht, free);
  // blips by tier (further out only the important ones); minor underneath; hovering a legend row shows that type at any zoom
  const shown = [];
  for (const b of blips) {
    if (b.type && big.off.has(b.type)) continue;
    const T = BLIP_TYPES[b.type], tier = b.tier ?? T?.tier ?? 0, hl = !!big.hl && b.type === big.hl;
    if (!hl && s < TIER_S[tier]) continue;
    const [x, y] = P(b.x, b.z);
    if (x < -20 || y < -20 || x > Wd + 20 || y > Ht + 20) continue;
    shown.push({ b, x, y, r: (tier === 0 ? 7.5 : s > Z.street ? 6.5 : 5) * (hl ? 1.35 : 1), imp: tier === 0, hl });
  }
  shown.sort((a, b) => a.hl - b.hl || a.imp - b.imp);
  for (const d of shown) { bm.globalAlpha = big.hl && !d.hl ? 0.3 : 1; drawBlip(bm, d.b, d.x, d.y, d.r); }
  bm.globalAlpha = 1;
  // names: hovered type first, then important ones, minor places only close in; skip any that would overlap
  bm.font = `600 15px ${MAP_FONT}`; bm.textAlign = 'left'; bm.textBaseline = 'middle'; bm.lineWidth = 3; bm.strokeStyle = 'rgba(0,0,0,.8)'; bm.fillStyle = '#fff';
  for (let i = shown.length - 1; i >= 0; i--) {
    const { b, x, y, r: rr, imp, hl } = shown[i];
    if (!b.name || big.hl && !hl || !hl && s < (imp ? Z.hood : Z.street)) continue;
    const bx = x + rr + 5, w = bm.measureText(b.name).width;
    if (!free([bx - 2, y - 9, bx + w + 2, y + 9])) continue;
    bm.strokeText(b.name, bx, y + 1); bm.fillText(b.name, bx, y + 1);
  }
  streetLabels(bm, P, s, Wd, Ht, free);
  if (waypoint && !big.off.has('waypoint')) { const [x, y] = P(waypoint.x, waypoint.z); drawBlip(bm, { type: 'waypoint' }, x, y, 8 * (big.hl === 'waypoint' ? 1.35 : 1)); }
  const [px, py] = P(me.x, me.z);
  bm.save(); bm.translate(px, py); bm.rotate(Math.atan2(Math.cos(me.h), Math.sin(me.h)));
  bm.fillStyle = '#fff'; bm.strokeStyle = '#000'; bm.lineWidth = 2;
  bm.beginPath(); bm.moveTo(12, 0); bm.lineTo(-8, 8); bm.lineTo(-4, 0); bm.lineTo(-8, -8); bm.closePath(); bm.fill(); bm.stroke();
  bm.restore();
  bm.font = `500 13px ${MAP_FONT}`; bm.textAlign = 'right'; bm.fillStyle = 'rgba(255,255,255,.7)';
  bm.fillText('Map data © OpenStreetMap contributors', Wd - 10, Ht - 12);
}
const canvasPt = (ev) => { const r = el.bigmap.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
export function bigMapToWorld(ev) {
  const [x, y] = canvasPt(ev);
  return { x: big.cx + (x - big.w / 2) / big.s, z: big.cz + (y - big.h / 2) / big.s };
}
export const bigMapDragged = () => big.moved;
export const mapActive = () => !el.pause.hidden && !el.bigmap.closest('[data-panel]').hidden;
const redraw = () => big.last && drawBigMap(...big.last);
addEventListener('resize', () => { if (!el.pause.hidden) redraw(); });
// Smooth zoom and key panning: frames run only while something moves; at rest the map is drawn once per change.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const PAN = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
function tick(now) {
  big.raf = 0;
  if (!mapActive()) { big.keys.clear(); big.za = null; big.s = big.ts || big.s; big.t = 0; return; }
  const dt = big.t ? Math.min(0.05, (now - big.t) / 1000) : 1 / 60; big.t = now;
  let moving = false;
  const gap = Math.log((big.ts || big.s) / big.s);
  if (Math.abs(gap) > 0.003 && !reduceMotion.matches) { big.s *= Math.exp(gap * (1 - Math.exp(-dt * 12))); moving = true; } else big.s = big.ts || big.s;
  if (big.za) { big.cx = big.za.wx - (big.za.sx - big.w / 2) / big.s; big.cz = big.za.wz - (big.za.sy - big.h / 2) / big.s; if (!moving) big.za = null; }
  let kx = 0, kz = 0;
  for (const c of big.keys) { kx += PAN[c][0]; kz += PAN[c][1]; }
  if (kx || kz) { const l = Math.hypot(kx, kz) || 1; big.cx += (kx / l) * 650 * dt / big.s; big.cz += (kz / l) * 650 * dt / big.s; moving = true; }
  redraw();
  if (moving) big.raf = requestAnimationFrame(tick); else big.t = 0;
}
const kick = () => { if (!big.raf) { big.t = 0; big.raf = requestAnimationFrame(tick); } };
function zoomAt(ev, f) {
  if (!big.s) return;
  const [x, y] = canvasPt(ev), p = bigMapToWorld(ev);
  big.ts = Math.max(big.fit * 0.9, Math.min(Z.max, (big.ts || big.s) * f));
  big.za = { wx: p.x, wz: p.z, sx: x, sy: y };
  kick();
}
// legend: a small tab on the map's edge (or L) slides it in over the right side; closed by default
const legend = $('mapLegend'), legendTab = $('mapLegendTab');
function toggleLegend(open = !legend.classList.contains('open')) { legend.classList.toggle('open', open); legend.inert = !open; legendTab.setAttribute('aria-expanded', String(open)); }
legend.inert = true;
legendTab.addEventListener('click', () => toggleLegend());
addEventListener('keydown', (e) => {
  if (!mapActive() || e.target.tagName === 'INPUT') return;
  if (PAN[e.code]) { e.preventDefault(); big.keys.add(e.code); big.za = null; kick(); }
  else if (e.code === 'KeyL' && !e.repeat) toggleLegend();
});
addEventListener('keyup', (e) => { big.keys.delete(e.code); });
addEventListener('blur', () => { big.keys.clear(); });
// legend rows: one per blip type with its icon; click toggles the type, hover highlights it
{
  const ul = legend.querySelector('ul'), dpr = Math.min(devicePixelRatio || 1, 2);
  for (const [type, T] of Object.entries(BLIP_TYPES)) {
    const li = document.createElement('li'), row = document.createElement(T.fixed ? 'div' : 'button'), ic = document.createElement('canvas');
    ic.width = ic.height = 22 * dpr; const g = ic.getContext('2d'); g.scale(dpr, dpr); drawBlip(g, { type }, 11, 11, 9);
    row.append(ic, T.name); li.append(row); ul.append(li);
    if (T.fixed) continue;
    row.setAttribute('aria-pressed', 'true');
    row.addEventListener('click', () => { const on = big.off.has(type); big.off[on ? 'delete' : 'add'](type); row.setAttribute('aria-pressed', String(on)); redraw(); });
    row.addEventListener('mouseenter', () => { big.hl = type; redraw(); });
    row.addEventListener('mouseleave', () => { big.hl = null; redraw(); });
  }
}
// area and street under the cursor, bottom-left of the map
const mapLoc = $('mapLoc');
el.bigmap.addEventListener('mousemove', (ev) => { const p = bigMapToWorld(ev), [area, street] = W.areaAt(p.x, p.z); mapLoc.textContent = street ? `${area} · ${street}` : area; mapLoc.hidden = !area; });
el.bigmap.addEventListener('mouseleave', () => { mapLoc.hidden = true; });
el.bigmap.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const dy = ev.deltaY * (ev.deltaMode === 1 ? 33 : ev.deltaMode === 2 ? 400 : 1);
  zoomAt(ev, Math.exp(-Math.max(-150, Math.min(150, dy)) * 0.0035));
}, { passive: false });
el.bigmap.addEventListener('dblclick', (ev) => zoomAt(ev, 2.4));
// drag to pan (pointer events, so a finger works too)
el.bigmap.addEventListener('pointerdown', (ev) => { big.drag = canvasPt(ev); big.moved = false; big.za = null; });
addEventListener('pointermove', (ev) => {
  if (!big.drag) return;
  const [x, y] = canvasPt(ev), dx = x - big.drag[0], dy = y - big.drag[1];
  if (Math.abs(dx) + Math.abs(dy) > 4) big.moved = true;
  if (!big.moved) return;
  big.cx -= dx / big.s; big.cz -= dy / big.s; big.drag = [x, y]; redraw();
});
addEventListener('pointerup', () => { big.drag = null; });
addEventListener('pointercancel', () => { big.drag = null; });
