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
  const alt = v.T.heli ? `<span>Altitude ${Math.round(v.y)} m</span>` : '';
  const nb = !v.T.bike && !v.T.heli ? `<div id="nitro" title="Nitro"><i style="width:${Math.round(nitro * 100)}%"></i></div>` : '';
  el.speedo.innerHTML = `<b>${Math.round(Math.abs(v.speed) * 3.6)}</b><small>km/h</small><span>${v.T.name}${station ? ' · ' + station : ''}</span>${alt}${nb}`;
}
export function setWheelLocked(owned) { slots.forEach((s, i) => s.classList.toggle('locked', !owned.has(i))); }
let hitT = 0;
export function hitMarker(kill) {
  el.crosshair.classList.add(kill ? 'kill' : 'hit');
  clearTimeout(hitT);
  hitT = setTimeout(() => el.crosshair.classList.remove('hit', 'kill'), 160);
}

// ---------- weapon wheel ----------
let slots = [];
export function buildWheel(weapons, onPick) {
  const ring = el.wheel.querySelector('.ring');
  const n = weapons.length;
  slots = weapons.map((w, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / n;
    const b = document.createElement('button');
    b.className = 'slot';
    b.style.left = `calc(50% + ${Math.cos(a) * 41}% )`;
    b.style.top = `calc(50% + ${Math.sin(a) * 41}% )`;
    b.innerHTML = `<svg viewBox="0 0 48 24" fill="currentColor" aria-hidden="true">${ICONS[w.name] || ''}</svg><span>${i + 1}</span>`;
    b.setAttribute('aria-label', w.name);
    b.addEventListener('click', () => onPick(i));
    ring.append(b);
    return b;
  });
}
export function showWheel(on) { el.wheel.hidden = !on; }
export function wheelHighlight(i, w) {
  slots.forEach((s, k) => s.classList.toggle('sel', k === i));
  el.wheelName.textContent = w.name;
  const dmg = w.grenade ? 100 : Math.min(100, (w.dmg * (w.pellets || 1)) / 0.9);
  const rate = Math.min(100, w.rate * 8);
  const range = w.melee ? 5 : w.grenade ? 30 : Math.min(100, w.range / 2);
  el.wheelStats.innerHTML = [['Damage', dmg], ['Fire rate', rate], ['Range', range]]
    .map(([k, v]) => `<div><span>${k}</span><i><b style="width:${v}%"></b></i></div>`).join('');
}
export function wheelIndex(dx, dy, n) {
  const a = Math.atan2(dy, dx) + Math.PI / 2;
  return ((Math.round(a / ((Math.PI * 2) / n)) % n) + n) % n;
}

// ---------- rotating minimap ----------
const mm = el.minimap.getContext('2d');
const SCALE = 0.6;
const pts = W.outline();
let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
minX -= 260; maxX += 260; minZ -= 260; maxZ += 260;
const map = document.createElement('canvas');
map.width = Math.ceil((maxX - minX) * SCALE); map.height = Math.ceil((maxZ - minZ) * SCALE);
const mx = (x) => (x - minX) * SCALE, mz = (z) => (z - minZ) * SCALE;
export function drawMapBase() {
  const g = map.getContext('2d');
  g.fillStyle = '#2f6d8c'; g.fillRect(0, 0, map.width, map.height);
  g.fillStyle = '#7c8a72';
  g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(mx(p.x), mz(p.z)) : g.moveTo(mx(p.x), mz(p.z)))); g.closePath(); g.fill();
  for (const i of W.islets) { g.beginPath(); g.arc(mx(i.x), mz(i.z), i.r * SCALE, 0, 7); g.fill(); }
  const line = (s0, s1, d, w, c) => { g.strokeStyle = c; g.lineWidth = w * SCALE; g.beginPath(); for (let s = s0; s <= s1; s += 10) { const p = W.P(s, d); s === s0 ? g.moveTo(mx(p.x), mz(p.z)) : g.lineTo(mx(p.x), mz(p.z)); } g.stroke(); };
  line(W.BRIDGE_END, W.L, 0, 14, '#e9ecef');
  line(-198, -158, 5, 26, '#ffffff');
  line(135, 965, 48, 10, '#f5f5f5'); line(135, 965, -48, 10, '#f5f5f5');
  for (const c of W.CROSS) { const a = W.P(c, -53), b = W.P(c, 53); g.strokeStyle = '#f5f5f5'; g.lineWidth = 10 * SCALE; g.beginPath(); g.moveTo(mx(a.x), mz(a.z)); g.lineTo(mx(b.x), mz(b.z)); g.stroke(); }
  g.fillStyle = '#58625a';
  for (const b of W.colliders) {
    if (b.h < 2) continue;
    g.save(); g.translate(mx(b.cx), mz(b.cz)); g.rotate(Math.atan2(b.uz, b.ux));
    g.fillRect(-b.hu * SCALE, -b.hv * SCALE, b.hu * 2 * SCALE, b.hv * 2 * SCALE); g.restore();
  }
  g.fillStyle = '#ffb300';
  for (const r of W.ramps) { g.beginPath(); g.arc(mx(r.x), mz(r.z), 3, 0, 7); g.fill(); }
}
// view: {x, z, yaw}; blips: [{x, z, color, size, shape, label}]; waypoint: {x, z} or null
export function drawMinimap(view, me, blips, zoom = 1, cones = null, waypoint = null) {
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
  mm.fillStyle = '#3d8fb0'; mm.fillRect(0, 0, Wd, Ht);
  mm.translate(cx, cy); mm.rotate(alpha); mm.scale(k, k);
  mm.drawImage(map, -mx(view.x), -mz(view.z));
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
    const [px, py] = raw(me.x, me.z), [wx, wy, edge] = clampPt(raw(waypoint.x, waypoint.z), 10);
    mm.strokeStyle = 'rgba(190, 120, 255, 0.85)'; mm.lineWidth = 3; mm.setLineDash([6, 5]);
    mm.beginPath(); mm.moveTo(px, py); mm.lineTo(wx, wy); mm.stroke(); mm.setLineDash([]);
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

// Full-screen pause map. Returns nothing; use bigMapToWorld for clicks.
const bm = el.bigmap.getContext('2d');
let bigFit = { s: 1, ox: 0, oy: 0 };
export function drawBigMap(me, blips, waypoint) {
  const Wd = el.bigmap.width, Ht = el.bigmap.height;
  const s = Math.min(Wd / map.width, Ht / map.height), ox = (Wd - map.width * s) / 2, oy = (Ht - map.height * s) / 2;
  bigFit = { s, ox, oy };
  bm.fillStyle = '#3d8fb0'; bm.fillRect(0, 0, Wd, Ht);
  bm.drawImage(map, ox, oy, map.width * s, map.height * s);
  const P = (x, z) => [ox + mx(x) * s, oy + mz(z) * s];
  for (const b of blips) {
    const [x, y] = P(b.x, b.z);
    bm.fillStyle = b.color; bm.strokeStyle = '#000'; bm.lineWidth = 1.5;
    bm.beginPath(); if (b.shape === 'square') bm.rect(x - b.size, y - b.size, b.size * 2, b.size * 2); else bm.arc(x, y, b.size, 0, 7); bm.fill(); bm.stroke();
    if (b.label) { bm.fillStyle = '#fff'; bm.font = 'bold 11px system-ui'; bm.textAlign = 'center'; bm.textBaseline = 'middle'; bm.fillText(b.label, x, y + 0.5); }
    if (b.name) { bm.font = '600 11px Inter, system-ui'; bm.textAlign = 'left'; bm.lineWidth = 3; bm.strokeStyle = 'rgba(0,0,0,.75)'; bm.strokeText(b.name, x + 9, y + (b.dy || 1)); bm.fillStyle = '#fff'; bm.fillText(b.name, x + 9, y + (b.dy || 1)); }
  }
  if (waypoint) { const [x, y] = P(waypoint.x, waypoint.z); bm.fillStyle = '#b678ff'; bm.strokeStyle = '#000'; bm.beginPath(); bm.arc(x, y, 8, 0, 7); bm.fill(); bm.stroke(); }
  const [px, py] = P(me.x, me.z);
  bm.save(); bm.translate(px, py); bm.rotate(Math.atan2(Math.cos(me.h), Math.sin(me.h)));
  bm.fillStyle = '#fff'; bm.strokeStyle = '#000'; bm.lineWidth = 2;
  bm.beginPath(); bm.moveTo(11, 0); bm.lineTo(-7, 7); bm.lineTo(-3, 0); bm.lineTo(-7, -7); bm.closePath(); bm.fill(); bm.stroke();
  bm.restore();
}
export function bigMapToWorld(ev) {
  const r = el.bigmap.getBoundingClientRect();
  const cxp = ((ev.clientX - r.left) / r.width) * el.bigmap.width, cyp = ((ev.clientY - r.top) / r.height) * el.bigmap.height;
  return { x: (cxp - bigFit.ox) / bigFit.s / SCALE + minX, z: (cyp - bigFit.oy) / bigFit.s / SCALE + minZ };
}
