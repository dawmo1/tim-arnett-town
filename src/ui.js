import { outline } from './world.js';

const $ = (id) => document.getElementById(id);
export const el = {
  hud: $('hud'), menu: $('menu'), stars: $('stars'), feed: $('feed'), chatLog: $('chatLog'), chatInput: $('chatInput'),
  weapon: $('weapon'), hpfill: $('hpfill'), prompt: $('prompt'), dead: $('dead'), click: $('clickToPlay'),
  roomInfo: $('roomInfo'), playerList: $('playerList'), help: $('help'), minimap: $('minimap'), hurt: $('hurt'),
};

export function setHealth(hp) {
  el.hpfill.style.width = Math.max(0, hp) + '%';
  el.hpfill.style.background = hp > 50 ? '#43d17a' : hp > 25 ? '#f5b041' : '#ec4747';
}
export function flashHurt() { el.hurt.classList.remove('on'); void el.hurt.offsetWidth; el.hurt.classList.add('on'); }
export function setWeapon(name, slot) { el.weapon.textContent = `${slot}  ${name}`; }
export function setStars(n, flashing) {
  el.stars.innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('');
  el.stars.classList.toggle('flash', !!flashing && n > 0);
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
  el.roomInfo.textContent = online ? `Room ${room} · share: ${location.origin}${location.pathname}#${room}` : 'Solo mode (multiplayer not set up)';
  el.playerList.innerHTML = '';
  for (const p of list) {
    const li = document.createElement('li');
    li.textContent = `${p.name}${p.me ? ' (you)' : ''}${p.host ? ' · host' : ''}${p.stars ? ' ' + '★'.repeat(p.stars) : ''}`;
    el.playerList.append(li);
  }
}

// ---------- minimap ----------
const mm = el.minimap.getContext('2d');
const pts = outline();
let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
const pad = 12, size = el.minimap.width;
const scale = (size - pad * 2) / Math.max(maxX - minX, maxZ - minZ);
const ox = pad + (size - pad * 2 - (maxX - minX) * scale) / 2, oz = pad + (size - pad * 2 - (maxZ - minZ) * scale) / 2;
const mx = (x) => ox + (x - minX) * scale, mz = (z) => oz + (z - minZ) * scale;
const bg = document.createElement('canvas'); bg.width = bg.height = size;
{
  const g = bg.getContext('2d');
  g.fillStyle = '#2aa9c9'; g.fillRect(0, 0, size, size);
  g.fillStyle = '#e8dfb0'; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(mx(p.x), mz(p.z)) : g.moveTo(mx(p.x), mz(p.z)))); g.closePath(); g.fill();
}
export function drawMinimap(me, friends, copsList, t) {
  mm.drawImage(bg, 0, 0);
  for (const c of copsList) { mm.fillStyle = Math.floor(t * 4) % 2 ? '#ff1744' : '#2979ff'; mm.fillRect(mx(c.x) - 2.5, mz(c.z) - 2.5, 5, 5); }
  for (const f of friends) { mm.fillStyle = '#ffffff'; mm.beginPath(); mm.arc(mx(f.x), mz(f.z), 3.2, 0, 7); mm.fill(); }
  // me as an arrow
  mm.save(); mm.translate(mx(me.x), mz(me.z)); mm.rotate(-me.h);
  mm.fillStyle = '#ffeb3b'; mm.strokeStyle = '#000'; mm.lineWidth = 1.5;
  mm.beginPath(); mm.moveTo(0, 7); mm.lineTo(4.5, -4.5); mm.lineTo(-4.5, -4.5); mm.closePath(); mm.fill(); mm.stroke();
  mm.restore();
}
