// Multiplayer through Firebase Realtime Database. Without a config the game runs solo.
// One world for everyone: rooms/WORLD/players/{uid}, vehicles/{id}, cops, events/{push}, chat/{push}.
// Player profiles (cash, ammo, garage, last spot...) live in profiles/{uid}, with a localStorage copy.
import { firebaseConfig } from './firebase-config.js';

const V = '10.12.2';
export const ROOM = 'WORLD';
export const net = {
  online: false, uid: 'me', offset: 0, room: ROOM, players: {}, error: '',
  handlers: { player() {}, playerGone() {}, vehicle() {}, vehicleGone() {}, cops() {}, event() {}, chat() {} },
  now() { return Date.now() + this.offset; },
};
let db, M, roomRef, meRef;

export async function connect() {
  if (!firebaseConfig || !firebaseConfig.databaseURL) { net.error = 'Firebase not set up yet: solo mode.'; return false; }
  try {
    const [app, auth, dbm] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-database.js`),
    ]);
    M = dbm;
    const fb = app.initializeApp(firebaseConfig);
    const cred = await auth.signInAnonymously(auth.getAuth(fb)); // the anonymous uid stays the same in this browser
    net.uid = cred.user.uid;
    db = M.getDatabase(fb);
    await new Promise((res) => {
      const t = setTimeout(res, 3000);
      M.onValue(M.ref(db, '.info/serverTimeOffset'), (s) => { net.offset = s.val() || 0; clearTimeout(t); res(); });
    });
    net.online = true;
    return true;
  } catch (e) {
    console.error(e);
    net.error = "Couldn't reach the online server: solo mode. (" + (e.code || e.message) + ')';
    return false;
  }
}

// Joined from the main menu: presence (name, look, area) without a state array until you start playing.
export async function joinWorld(name, look) {
  if (!net.online) { net.players[net.uid] = { n: name, c: look, a: '' }; return; }
  roomRef = M.ref(db, 'rooms/' + ROOM);
  meRef = M.child(roomRef, 'players/' + net.uid);
  await M.set(meRef, { n: name, c: look, a: '' });
  M.onDisconnect(meRef).remove();
  const pl = M.child(roomRef, 'players');
  const up = (s) => { net.players[s.key] = s.val(); net.handlers.player(s.key, s.val()); };
  M.onChildAdded(pl, up);
  M.onChildChanged(pl, up);
  M.onChildRemoved(pl, (s) => { delete net.players[s.key]; net.handlers.playerGone(s.key); });
  const vh = M.child(roomRef, 'vehicles');
  M.onChildAdded(vh, (s) => net.handlers.vehicle(s.key, s.val()));
  M.onChildChanged(vh, (s) => net.handlers.vehicle(s.key, s.val()));
  M.onChildRemoved(vh, (s) => net.handlers.vehicleGone(s.key));
  M.onValue(M.child(roomRef, 'cops'), (s) => net.handlers.cops(s.val() || {}));
  const evq = M.query(M.child(roomRef, 'events'), M.orderByChild('t'), M.startAt(net.now() - 1000));
  M.onChildAdded(evq, (s) => { const e = s.val(); if (e && e.from !== net.uid) net.handlers.event(e); });
  M.onChildAdded(M.query(M.child(roomRef, 'chat'), M.limitToLast(30)), (s) => net.handlers.chat(s.val()));
  pruneChat();
  setInterval(() => { if (hostUid() === net.uid) pruneChat(); }, 600000);
}
// Chat keeps the newest 100 messages: anything older than those and over an hour old is deleted (the rules allow
// deleting a message only once it's an hour old). shortcut: removes up to 500 per run, so a huge backlog takes a few runs.
async function pruneChat() {
  try {
    const chat = M.child(roomRef, 'chat');
    const keep = await M.get(M.query(chat, M.orderByKey(), M.limitToLast(100)));
    if (keep.size < 100) return;
    let first = null; keep.forEach((c) => { first ??= c.key; });
    const old = await M.get(M.query(chat, M.orderByKey(), M.endBefore(first), M.limitToFirst(500)));
    const cut = net.now() - 3700000, del = {};
    old.forEach((c) => { const t = c.child('t').val(); if (typeof t === 'number' && t < cut) del[c.key] = null; });
    if (Object.keys(del).length) await M.update(chat, del);
  } catch (e) { console.warn('chat prune failed', e); }
}
// Story Mode pressed: j = when you started playing (the earliest player runs the police).
export function startPlaying() {
  if (net.online && meRef) M.set(M.child(meRef, 'j'), M.serverTimestamp());
  else if (net.players[net.uid]) net.players[net.uid].j = 0;
}
const setMine = (k, val) => {
  if (net.players[net.uid]) net.players[net.uid][k] = val;
  if (net.online && meRef) M.set(M.child(meRef, k), val);
};
export const setLook = (look) => setMine('c', look); // a new outfit from the clothing store
export const setName = (name) => setMine('n', name);
export const setArea = (area) => setMine('a', String(area).slice(0, 40));
export function sendState(arr) {
  if (net.online && meRef) M.set(M.child(meRef, 's'), arr);
  else if (net.players[net.uid]) net.players[net.uid].s = arr;
}
export function setVehicle(id, rec) { if (net.online && roomRef) M.set(M.child(roomRef, 'vehicles/' + id), rec); }
export function removeVehicle(id) { if (net.online && roomRef) M.remove(M.child(roomRef, 'vehicles/' + id)); }
// each group host writes its own units to cops/{uid} (null clears them when it stops hosting)
let copsCleanup = false;
export function setCops(obj) {
  if (!net.online || !roomRef) return;
  const r = M.child(roomRef, 'cops/' + net.uid);
  if (!copsCleanup) { copsCleanup = true; M.onDisconnect(r).remove(); }
  M.set(r, obj);
}
export function sendEvent(type, data) {
  if (!net.online || !roomRef) return;
  const r = M.push(M.child(roomRef, 'events'));
  M.set(r, { ...data, type, from: net.uid, t: M.serverTimestamp() });
  setTimeout(() => M.remove(r), 8000);
}
export function sendChat(name, msg) {
  if (!net.online || !roomRef) { net.handlers.chat({ n: name, m: msg }); return; }
  M.push(M.child(roomRef, 'chat'), { n: name, m: msg, t: M.serverTimestamp() });
}

// The police are run per group: playing players chained together within ~1.2 km share one host (the one who
// started first); a player far from everyone else hosts their own cops. In the menu you see the global earliest.
const LINK = 1200, UNLINK = 1600; // hysteresis so a group doesn't flap (and drop its cops) right at the edge
let linked = new Set();
net.group = linked;
export function hostUid() {
  const play = [];
  for (const uid in net.players) { const p = net.players[uid]; if (p && Array.isArray(p.s)) play.push(uid); }
  const mine = net.players[net.uid], group = new Set();
  if (mine && Array.isArray(mine.s)) {
    group.add(net.uid);
    for (const a of group) { // grows while iterating: a flood fill over the chain of nearby players
      const sa = net.players[a].s;
      for (const b of play) {
        if (group.has(b)) continue;
        const sb = net.players[b].s, d = Math.hypot(sa[0] - sb[0], sa[2] - sb[2]);
        if (d < (linked.has(b) ? UNLINK : LINK)) group.add(b);
      }
    }
  } else for (const uid of play) group.add(uid);
  linked = net.group = group;
  let best = null, bj = Infinity;
  for (const uid of group) {
    const p = net.players[uid], j = typeof p.j === 'number' ? p.j : Infinity;
    if (j < bj || (j === bj && (best === null || uid < best))) { bj = j; best = uid; }
  }
  return best || net.uid;
}

// ---------- profile ----------
const PKEY = 'tat-profile';
const localProfile = () => { try { return JSON.parse(localStorage.getItem(PKEY) || 'null'); } catch { return null; } };
// the newer of the server copy and this browser's copy (you may have played offline since)
export async function loadProfile() {
  const loc = localProfile();
  if (!net.online) return loc;
  try {
    const s = await M.get(M.ref(db, 'profiles/' + net.uid)), srv = s.val();
    return srv && (!loc || (srv.t || 0) >= (loc.t || 0)) ? srv : loc;
  } catch (e) { console.warn('profile load failed', e); return loc; }
}
export function saveProfile(p) {
  try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch { /* private mode */ }
  if (net.online) M.set(M.ref(db, 'profiles/' + net.uid), p).catch((e) => console.warn('profile save failed', e));
}
