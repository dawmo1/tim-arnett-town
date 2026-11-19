import * as W from './world.js';

const $ = (id) => document.getElementById(id);
export const el = {
  hud: $('hud'), menu: $('menu'), stars: $('stars'), feed: $('feed'), chatLog: $('chatLog'), chatInput: $('chatInput'),
  weapon: $('weapon'), weaponIcon: $('weaponIcon'), hpfill: $('hpfill'), prompt: $('prompt'), dead: $('dead'), click: $('clickToPlay'),
  roomInfo: $('roomInfo'), playerList: $('playerList'), help: $('help'), minimap: $('minimap'), hurt: $('hurt'),
  wheel: $('wheel'), wheelName: $('wheelName'), wheelStats: $('wheelStats'), announce: $('announce'), speedo: $('speedo'),
  crosshair: $('crosshair'),
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
export function setWeapon(name) {
  el.weapon.textContent = name;
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
export function setPrompt(t) { el.prompt.textContent = t || ''; el.prompt.hidden = !t; }
export function setPlayers(room, list, online) {
  el.roomInfo.textContent = online ? `Room ${room}` : 'Solo mode';
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

export function setSpeedo(v) {
  if (!v) { el.speedo.hidden = true; return; }
  el.speedo.hidden = false;
  el.speedo.innerHTML = `<b>${Math.round(Math.abs(v.speed) * 3.6)}</b><small>km/h</small><span>${v.T.name}</span>`;
}
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
  g.fillStyle = '#4fb3cf'; g.fillRect(0, 0, map.width, map.height);
  g.fillStyle = '#e9dfae';
  g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(mx(p.x), mz(p.z)) : g.moveTo(mx(p.x), mz(p.z)))); g.closePath(); g.fill();
  for (const i of W.islets) { g.beginPath(); g.arc(mx(i.x), mz(i.z), i.r * SCALE, 0, 7); g.fill(); }
  const line = (s0, s1, d, w, c) => { g.strokeStyle = c; g.lineWidth = w * SCALE; g.beginPath(); for (let s = s0; s <= s1; s += 10) { const p = W.P(s, d); s === s0 ? g.moveTo(mx(p.x), mz(p.z)) : g.lineTo(mx(p.x), mz(p.z)); } g.stroke(); };
  line(W.BRIDGE_END, W.L, 0, 14, '#ffffff');
  line(-198, -158, 5, 26, '#ffffff');
  line(135, 965, 48, 10, '#f5f5f5'); line(135, 965, -48, 10, '#f5f5f5');
  for (const c of W.CROSS) { const a = W.P(c, -53), b = W.P(c, 53); g.strokeStyle = '#f5f5f5'; g.lineWidth = 10 * SCALE; g.beginPath(); g.moveTo(mx(a.x), mz(a.z)); g.lineTo(mx(b.x), mz(b.z)); g.stroke(); }
  g.fillStyle = '#b9b2a0';
  for (const b of W.colliders) {
    if (b.h < 2) continue;
    g.save(); g.translate(mx(b.cx), mz(b.cz)); g.rotate(Math.atan2(b.uz, b.ux));
    g.fillRect(-b.hu * SCALE, -b.hv * SCALE, b.hu * 2 * SCALE, b.hv * 2 * SCALE); g.restore();
  }
  g.fillStyle = '#ffb300';
  for (const r of W.ramps) { g.beginPath(); g.arc(mx(r.x), mz(r.z), 3, 0, 7); g.fill(); }
}
// view: {x, z, yaw}; blips: [{x, z, color, size, h}]
export function drawMinimap(view, me, blips, zoom = 1) {
  const S = el.minimap.width, c = S / 2, k = zoom;
  const alpha = -Math.PI / 2 - Math.atan2(Math.cos(view.yaw), Math.sin(view.yaw));
  mm.save();
  mm.clearRect(0, 0, S, S);
  mm.beginPath(); mm.arc(c, c, c, 0, 7); mm.clip();
  mm.fillStyle = '#4fb3cf'; mm.fillRect(0, 0, S, S);
  mm.translate(c, c); mm.rotate(alpha); mm.scale(k, k);
  mm.drawImage(map, -mx(view.x), -mz(view.z));
  mm.restore();
  const toScreen = (x, z) => {
    const dx = (x - view.x) * SCALE * k, dz = (z - view.z) * SCALE * k;
    let sx = dx * Math.cos(alpha) - dz * Math.sin(alpha), sy = dx * Math.sin(alpha) + dz * Math.cos(alpha);
    const d = Math.hypot(sx, sy), lim = c - 7;
    if (d > lim) { sx *= lim / d; sy *= lim / d; }
    return [c + sx, c + sy];
  };
  for (const b of blips) {
    const [x, y] = toScreen(b.x, b.z);
    mm.fillStyle = b.color; mm.strokeStyle = 'rgba(0,0,0,.6)'; mm.lineWidth = 1.5;
    mm.beginPath();
    if (b.shape === 'square') mm.rect(x - b.size, y - b.size, b.size * 2, b.size * 2);
    else mm.arc(x, y, b.size, 0, 7);
    mm.fill(); mm.stroke();
    if (b.label) { mm.fillStyle = '#fff'; mm.font = 'bold 10px system-ui'; mm.textAlign = 'center'; mm.textBaseline = 'middle'; mm.fillText(b.label, x, y + 0.5); }
  }
  // north marker
  const [nx, ny] = toScreen(view.x, view.z - 10000);
  mm.fillStyle = '#263238'; mm.beginPath(); mm.arc(nx, ny, 8, 0, 7); mm.fill();
  mm.fillStyle = '#fff'; mm.font = 'bold 10px system-ui'; mm.textAlign = 'center'; mm.textBaseline = 'middle'; mm.fillText('N', nx, ny + 0.5);
  // me
  const [px, py] = toScreen(me.x, me.z);
  const hx = Math.sin(me.h), hz = Math.cos(me.h);
  const ang = Math.atan2(hx * Math.sin(alpha) + hz * Math.cos(alpha), hx * Math.cos(alpha) - hz * Math.sin(alpha));
  mm.save(); mm.translate(px, py); mm.rotate(ang);
  mm.fillStyle = '#ffeb3b'; mm.strokeStyle = '#000'; mm.lineWidth = 1.5;
  mm.beginPath(); mm.moveTo(8, 0); mm.lineTo(-5, 5); mm.lineTo(-2, 0); mm.lineTo(-5, -5); mm.closePath(); mm.fill(); mm.stroke();
  mm.restore();
}
