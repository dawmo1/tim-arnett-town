import * as W from './world.js';

const $ = (id) => document.getElementById(id);
export const el = {
  hud: $('hud'), menu: $('menu'), stars: $('stars'), feed: $('feed'), chatLog: $('chatLog'), chatInput: $('chatInput'),
  weapon: $('weapon'), weaponIcon: $('weaponIcon'), hpfill: $('hpfill'), prompt: $('prompt'), dead: $('dead'),
  ammo: $('ammo'), armorfill: $('armorfill'), cash: $('cash'), helpbox: $('helpbox'), area: $('area'), areaName: $('areaName'), streetName: $('streetName'),
  pause: $('pause'), bigmap: $('bigmap'), pauseTabs: $('pauseTabs'), resumeBtn: $('resumeBtn'), deadSub: $('deadSub'), shareHint: $('shareHint'),
  roomInfo: $('roomInfo'), playerList: $('playerList'), help: $('help'), minimap: $('minimap'), hurt: $('hurt'),
  wheel: $('wheel'), wheelName: $('wheelName'), wheelStats: $('wheelStats'), announce: $('announce'), speedo: $('speedo'),
  crosshair: $('crosshair'), clock: $('clock'),
};

// Simple weapon silhouettes (viewBox 0 0 48 24).
export const ICONS = {
  Fists: '<path d="M10 8h22a4 4 0 0 1 4 4v4a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6z"/><path d="M14 8v-3h4v3M19 8v-4h4v4M24 8v-4h4v4M29 8v-3h4v3" stroke="currentColor" stroke-width="2" fill="none"/>',
  Bat: '<path d="M4 18 L36 4 Q44 1 45 5 Q46 9 38 11 L6 21z"/>',
  Pistol: '<path d="M6 6h32v6H22l-2 3h-4l-2 7H8l3-10H6z"/>',
  SMG: '<path d="M4 7h34v6H30v9h-5v-9h-6l-3 6h-5l2-6H4zM38 8h6v3h-6z"/>',
  Shotgun: '<path d="M2 8h34v4H24l-3 3H10l-6 5H1l3-7H2zM36 8h10v3H36z"/>',
  Rifle: '<path d="M2 9h36v5H28v8h-4v-8h-6l-6 6H6l4-6H2zM14 5h12v3H14zM38 10h8v2h-8z"/>',
  Grenade: '<circle cx="24" cy="14" r="8"/><path d="M21 4h6v4h-6zM27 5l7-2v3l-7 1z"/>',
};

export function setHealth(hp) {
  el.hpfill.style.width = Math.max(0, hp) + '%';
  el.hpfill.style.background = hp > 50 ? '#43d17a' : hp > 25 ? '#f5b041' : '#ec4747';
}
export function flashHurt() { el.hurt.classList.remove('on'); void el.hurt.offsetWidth; el.hurt.classList.add('on'); }
export function setWeapon(name, ammo = '') {
  el.weapon.textContent = name;
  el.ammo.textContent = ammo;
  el.weaponIcon.innerHTML = `<svg viewBox="0 0 48 24" fill="currentColor" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
let lastStars = 0;
export function setStars(n, flashing) {
  el.stars.innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('');
  el.stars.classList.toggle('flash', !!flashing && n > 0);
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
export function addChat(name, msg) {
  const li = document.createElement('li');
  const b = document.createElement('b'); b.textContent = name + ': ';
  li.append(b, document.createTextNode(msg));
  el.chatLog.append(li);
  while (el.chatLog.children.length > 8) el.chatLog.firstChild.remove();
  setTimeout(() => li.classList.add('old'), 15000);
}
let promptHold = 0;
export function setPrompt(t) { if (performance.now() < promptHold) return; el.prompt.textContent = t || ''; el.prompt.hidden = !t; }
export function flashPrompt(t) { el.prompt.textContent = t; el.prompt.hidden = false; promptHold = performance.now() + 1500; }
export function setArmor(a) { el.armorfill.style.width = Math.max(0, Math.min(100, a)) + '%'; }
let shownCash = -1;
export function setCash(n) {
  if (n === shownCash) return;
  if (shownCash >= 0) { el.cash.classList.remove('bump'); void el.cash.offsetWidth; el.cash.classList.add('bump'); }
  shownCash = n; el.cash.textContent = '$' + n.toLocaleString('en-US');
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
export function setPlayers(room, list, online) {
  el.roomInfo.textContent = online ? `Room ${room} · ${list.length} playing` : 'Solo mode';
  el.shareHint.textContent = online ? `Friends join with room code ${room}, or this link: ${location.origin}${location.pathname}#${room}` : 'Multiplayer turns on once Firebase is set up (see the README).';
  el.playerList.innerHTML = '';
  for (const p of list) {
    const li = document.createElement('li');
    li.textContent = `${p.name}${p.me ? ' (you)' : ''}${p.host ? ' · host' : ''}${p.stars ? ' ' + '★'.repeat(p.stars) : ''}`;
    el.playerList.append(li);
  }
}

// Big center-screen callouts ("STUNT JUMP", "WANTED") one at a time.
const queue = [];
let showing = false;
export function announce(text, sub = '', color = '#ffd23f') {
  if (queue.some((q) => q.text === text)) return;
  queue.push({ text, sub, color });
  if (!showing) nextAnnounce();
}
function nextAnnounce() {
  const a = queue.shift();
  if (!a) { showing = false; return; }
  showing = true;
  el.announce.innerHTML = '';
  const t = document.createElement('div'); t.className = 'big'; t.textContent = a.text; t.style.color = a.color;
  el.announce.append(t);
  if (a.sub) { const s = document.createElement('div'); s.className = 'sub'; s.textContent = a.sub; el.announce.append(s); }
  el.announce.classList.remove('on'); void el.announce.offsetWidth; el.announce.classList.add('on');
  setTimeout(nextAnnounce, 2200);
}

const WX = { clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', storm: 'Storm' };
export function setClock(time, wx, night) { el.clock.textContent = `${time} · ${WX[wx] || wx}${night ? ' · Night' : ''}`; }
export function setSpeedo(v, station = '', nitro = 0) {
  if (!v) { el.speedo.hidden = true; return; }
  el.speedo.hidden = false;
  const alt = v.T.heli ? `<span>Altitude ${Math.round(v.alt ?? v.y)} m</span>` : '';
  const nb = !v.T.bike && !v.T.heli ? `<div id="nitro" title="Nitro"><i style="width:${Math.round(nitro * 100)}%"></i></div>` : '';
  el.speedo.innerHTML = `<b>${Math.round(Math.abs(v.speed) * 3.6)}</b><small>km/h</small><span>${v.T.name}${station ? ' · ' + station : ''}</span>${alt}${nb}`;
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
  const n = weapons.length, gap = 0.025;
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '-100 -100 200 200'); svg.classList.add('wheelSvg');
  const hubBg = document.createElementNS(SVGNS, 'circle');
  hubBg.setAttribute('r', '47'); hubBg.classList.add('hubBg'); svg.append(hubBg);
  slices = weapons.map((w, i) => {
    const mid = -Math.PI / 2 + (i * Math.PI * 2) / n, half = Math.PI / n;
    const g = document.createElementNS(SVGNS, 'g'); g.classList.add('slice');
    const path = document.createElementNS(SVGNS, 'path');
    path.setAttribute('d', sector(mid - half + gap, mid + half - gap, 50, 97));
    g.append(path);
    const ix = Math.cos(mid) * 73, iy = Math.sin(mid) * 73;
    const icon = document.createElementNS(SVGNS, 'g');
    icon.setAttribute('transform', `translate(${(ix - 20).toFixed(1)} ${(iy - 13).toFixed(1)}) scale(0.84)`);
    icon.innerHTML = ICONS[w.name] || '';
    icon.classList.add('icon'); g.append(icon);
    const num = document.createElementNS(SVGNS, 'text');
    num.setAttribute('x', (Math.cos(mid) * 90).toFixed(1)); num.setAttribute('y', (Math.sin(mid) * 90 + 2).toFixed(1));
    num.textContent = i + 1; num.classList.add('num'); g.append(num);
    const price = document.createElementNS(SVGNS, 'text');
    price.setAttribute('x', ix.toFixed(1)); price.setAttribute('y', (iy + 19).toFixed(1));
    price.classList.add('price'); g.append(price);
    g.addEventListener('pointerenter', () => wheelHighlight(i, weapons[i]));
    g.addEventListener('click', () => onPick(i));
    svg.append(g);
    return { g, price };
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
export function setWheelLocked(owned, prices) {
  slices.forEach((s, i) => { const locked = !owned.has(i); s.g.classList.toggle('locked', locked); s.price.textContent = locked ? `$${prices[i]}` : ''; });
}

// ---------- maps ----------
// The whole city is pre-drawn once at 1 px = 4 m (water, land, every street); the minimap and a
// zoomed-in pause map draw crisp vector streets and loaded buildings on top.
const mm = el.minimap.getContext('2d');
const SCALE = 0.6; // minimap pixels per metre (before zoom)
const BASE_S = 0.25;
let minX = 0, minZ = 0, maxX = 1, maxZ = 1, base = null;
const ROAD_STYLE = { motor: ['#ffd27a', 1.2], trunk: ['#ffe6a8', 1.15], primary: ['#ffffff', 1.1], secondary: ['#f4f4f4', 1.05], tertiary: ['#e9ecef', 1], minor: ['#dfe3e6', 1], residential: ['#dfe3e6', 1], service: ['#c9ced2', 0.9] };
const WATER = '#3d8fb0', LAND = '#6f7d68', OFFMAP = '#66735f', BLDG = '#545e57';
export function drawMapBase() {
  const I = W.D.index;
  minX = I.tx0 * 200; maxX = (I.tx1 + 1) * 200; minZ = I.tz0 * 200; maxZ = (I.tz1 + 1) * 200;
  base = document.createElement('canvas');
  base.width = Math.ceil((maxX - minX) * BASE_S); base.height = Math.ceil((maxZ - minZ) * BASE_S);
  const g = base.getContext('2d');
  // land / water from the coarse grid, smoothed by scaling up
  const c = W.D.coarse, sm = document.createElement('canvas'); sm.width = c.w; sm.height = c.h;
  const sg = sm.getContext('2d'), img = sg.createImageData(c.w, c.h);
  const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const CW = rgb(WATER), CL = rgb(LAND), CO = rgb(OFFMAP);
  for (let k = 0; k < c.w * c.h; k++) { const col = c.kind[k] === 1 ? CW : c.kind[k] === 2 ? CO : CL; img.data.set([...col, 255], k * 4); }
  sg.putImageData(img, 0, 0);
  g.fillStyle = WATER; g.fillRect(0, 0, base.width, base.height);
  g.imageSmoothingEnabled = true;
  g.drawImage(sm, (c.x0 - minX) * BASE_S - c.step * BASE_S / 2, (c.z0 - minZ) * BASE_S - c.step * BASE_S / 2, c.w * c.step * BASE_S, c.h * c.step * BASE_S);
  g.save(); g.scale(BASE_S, BASE_S); g.translate(-minX, -minZ); g.lineCap = 'round'; g.lineJoin = 'round';
  for (const cls of ['service', 'residential', 'minor', 'tertiary', 'secondary', 'primary', 'trunk', 'motor']) {
    const [color, k] = ROAD_STYLE[cls];
    g.strokeStyle = color; g.lineWidth = Math.max(1 / BASE_S, 0);
    g.beginPath();
    for (const e of W.G.edges) { if (e.cls !== cls) continue; g.lineWidth = Math.max(5, e.width * k * 1.3); polyline(g, e.pts); }
    g.lineWidth = cls === 'service' ? 4 : cls === 'residential' || cls === 'minor' ? 7 : 12;
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
  g.strokeStyle = 'rgba(182, 120, 255, 0.95)'; g.lineWidth = 4.5 / pxPerM; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(route[from][0], route[from][1]); for (let i = from + 1; i < route.length; i++) g.lineTo(route[i][0], route[i][1]); g.stroke();
}
export function drawMinimap(view, me, blips, zoom = 1, cones = null, waypoint = null, route = null) {
  const Wd = el.minimap.width, Ht = el.minimap.height, cx = Wd / 2, cy = Ht * 0.6, k = zoom;
  const alpha = -Math.PI / 2 - Math.atan2(Math.cos(view.yaw), Math.sin(view.yaw));
  const raw = (x, z) => { const dx = (x - view.x) * SCALE * k, dz = (z - view.z) * SCALE * k; return [cx + dx * Math.cos(alpha) - dz * Math.sin(alpha), cy + dx * Math.sin(alpha) + dz * Math.cos(alpha)]; };
  // keep a point inside the frame (for blips that are off the edge)
  const clampPt = ([x, y], m = 8) => {
    const dx = x - cx, dy = y - cy;
    const sx = dx ? (dx > 0 ? (Wd - m - cx) / dx : (m - cx) / dx) : Infinity, sy = dy ? (dy > 0 ? (Ht - m - cy) / dy : (m - cy) / dy) : Infinity;
    const t = Math.min(1, sx, sy);
    return [cx + dx * t, cy + dy * t, t < 1];
  };
  mm.save();
  mm.clearRect(0, 0, Wd, Ht);
  mm.fillStyle = WATER; mm.fillRect(0, 0, Wd, Ht);
  const ppm = SCALE * k;
  mm.translate(cx, cy); mm.rotate(alpha); mm.scale(ppm, ppm); mm.translate(-view.x, -view.z);
  if (base) mm.drawImage(base, minX, minZ, base.width / BASE_S, base.height / BASE_S);
  drawVectors(mm, view.x, view.z, Math.hypot(Wd, Ht) / ppm * 0.75, ppm);
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
  for (const b of blips) {
    const [x, y] = clampPt(raw(b.x, b.z));
    mm.fillStyle = b.color; mm.strokeStyle = 'rgba(0,0,0,.65)'; mm.lineWidth = 1.5;
    mm.beginPath();
    if (b.shape === 'square') mm.rect(x - b.size, y - b.size, b.size * 2, b.size * 2);
    else mm.arc(x, y, b.size, 0, 7);
    mm.fill(); mm.stroke();
    if (b.label) { mm.fillStyle = '#fff'; mm.font = 'bold 10px system-ui'; mm.textAlign = 'center'; mm.textBaseline = 'middle'; mm.fillText(b.label, x, y + 0.5); }
  }
  const [nx, ny] = clampPt(raw(view.x, view.z - 100000), 11);
  mm.fillStyle = 'rgba(8,12,18,.85)'; mm.beginPath(); mm.arc(nx, ny, 8, 0, 7); mm.fill();
  mm.fillStyle = '#fff'; mm.font = 'bold 10px system-ui'; mm.textAlign = 'center'; mm.textBaseline = 'middle'; mm.fillText('N', nx, ny + 0.5);
  const [px, py] = raw(me.x, me.z);
  const hx = Math.sin(me.h), hz = Math.cos(me.h);
  const ang = Math.atan2(hx * Math.sin(alpha) + hz * Math.cos(alpha), hx * Math.cos(alpha) - hz * Math.sin(alpha));
  mm.save(); mm.translate(px, py); mm.rotate(ang);
  mm.fillStyle = '#fff'; mm.strokeStyle = '#000'; mm.lineWidth = 1.5;
  mm.beginPath(); mm.moveTo(8, 0); mm.lineTo(-5, 5.5); mm.lineTo(-2, 0); mm.lineTo(-5, -5.5); mm.closePath(); mm.fill(); mm.stroke();
  mm.restore();
}

// pause map view: centre + pixels per metre (wheel zooms, drag pans)
const big = { cx: 0, cz: 0, s: 0, fit: 0, last: null, drag: null, moved: false };
const bm = el.bigmap.getContext('2d');
function bigFitScale() { return Math.min(el.bigmap.width / (maxX - minX), el.bigmap.height / (maxZ - minZ)); }
export function drawBigMap(me, blips, waypoint, route) {
  big.last = [me, blips, waypoint, route];
  const Wd = el.bigmap.width, Ht = el.bigmap.height;
  if (!big.s) { big.fit = bigFitScale(); big.s = big.fit * 2.2; big.cx = me.x; big.cz = me.z; }
  const s = big.s;
  bm.save();
  bm.fillStyle = WATER; bm.fillRect(0, 0, Wd, Ht);
  bm.translate(Wd / 2, Ht / 2); bm.scale(s, s); bm.translate(-big.cx, -big.cz);
  if (base) { bm.imageSmoothingEnabled = true; bm.drawImage(base, minX, minZ, base.width / BASE_S, base.height / BASE_S); }
  if (s > 0.45) drawVectors(bm, big.cx, big.cz, Math.hypot(Wd, Ht) / s * 0.55, s);
  drawRoute(bm, route, s);
  bm.restore();
  const P = (x, z) => [Wd / 2 + (x - big.cx) * s, Ht / 2 + (z - big.cz) * s];
  // neighbourhood names when zoomed out a bit
  for (const b of blips) {
    const [x, y] = P(b.x, b.z);
    if (x < -20 || y < -20 || x > Wd + 20 || y > Ht + 20) continue;
    bm.fillStyle = b.color; bm.strokeStyle = '#000'; bm.lineWidth = 1.5;
    bm.beginPath(); if (b.shape === 'square') bm.rect(x - b.size, y - b.size, b.size * 2, b.size * 2); else bm.arc(x, y, b.size, 0, 7); bm.fill(); bm.stroke();
    if (b.label) { bm.fillStyle = '#fff'; bm.font = 'bold 11px system-ui'; bm.textAlign = 'center'; bm.textBaseline = 'middle'; bm.fillText(b.label, x, y + 0.5); }
    if (b.name && s > big.fit * 1.6) { bm.font = '600 11px Inter, system-ui'; bm.textAlign = 'left'; bm.lineWidth = 3; bm.strokeStyle = 'rgba(0,0,0,.75)'; bm.strokeText(b.name, x + 9, y + (b.dy || 1)); bm.fillStyle = '#fff'; bm.fillText(b.name, x + 9, y + (b.dy || 1)); }
  }
  if (waypoint) { const [x, y] = P(waypoint.x, waypoint.z); bm.fillStyle = '#b678ff'; bm.strokeStyle = '#000'; bm.lineWidth = 1.5; bm.beginPath(); bm.arc(x, y, 8, 0, 7); bm.fill(); bm.stroke(); }
  const [px, py] = P(me.x, me.z);
  bm.save(); bm.translate(px, py); bm.rotate(Math.atan2(Math.cos(me.h), Math.sin(me.h)));
  bm.fillStyle = '#fff'; bm.strokeStyle = '#000'; bm.lineWidth = 2;
  bm.beginPath(); bm.moveTo(11, 0); bm.lineTo(-7, 7); bm.lineTo(-3, 0); bm.lineTo(-7, -7); bm.closePath(); bm.fill(); bm.stroke();
  bm.restore();
  bm.fillStyle = 'rgba(0,0,0,.55)'; bm.fillRect(8, Ht - 26, 330, 18);
  bm.fillStyle = '#fff'; bm.font = '12px system-ui'; bm.textAlign = 'left'; bm.textBaseline = 'middle';
  bm.fillText('Scroll to zoom · drag to move · click to set a waypoint', 14, Ht - 17);
}
const canvasPt = (ev) => { const r = el.bigmap.getBoundingClientRect(); return [((ev.clientX - r.left) / r.width) * el.bigmap.width, ((ev.clientY - r.top) / r.height) * el.bigmap.height]; };
export function bigMapToWorld(ev) {
  const [x, y] = canvasPt(ev);
  return { x: big.cx + (x - el.bigmap.width / 2) / big.s, z: big.cz + (y - el.bigmap.height / 2) / big.s };
}
export const bigMapDragged = () => big.moved;
const redraw = () => big.last && drawBigMap(...big.last);
el.bigmap.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const p = bigMapToWorld(ev), f = ev.deltaY > 0 ? 1 / 1.25 : 1.25;
  const ns = Math.max(big.fit * 0.9, Math.min(3, big.s * f));
  // keep the point under the cursor still
  const [x, y] = canvasPt(ev);
  big.s = ns; big.cx = p.x - (x - el.bigmap.width / 2) / ns; big.cz = p.z - (y - el.bigmap.height / 2) / ns;
  redraw();
}, { passive: false });
el.bigmap.addEventListener('mousedown', (ev) => { big.drag = canvasPt(ev); big.moved = false; });
addEventListener('mousemove', (ev) => {
  if (!big.drag) return;
  const [x, y] = canvasPt(ev), dx = x - big.drag[0], dy = y - big.drag[1];
  if (Math.abs(dx) + Math.abs(dy) > 4) big.moved = true;
  if (!big.moved) return;
  big.cx -= dx / big.s; big.cz -= dy / big.s; big.drag = [x, y]; redraw();
});
addEventListener('mouseup', () => { big.drag = null; });
