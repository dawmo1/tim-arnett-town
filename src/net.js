// Multiplayer through Firebase Realtime Database. Without a config the game runs solo.
// Room layout: rooms/{CODE}/players/{uid}, vehicles/{id}, cops, events/{push}, chat/{push}
import { firebaseConfig } from './firebase-config.js';

const V = '10.12.2';
export const net = {
  online: false, uid: 'me', offset: 0, room: '', players: {}, error: '',
  handlers: { player() {}, playerGone() {}, vehicle() {}, vehicleGone() {}, cops() {}, event() {}, chat() {} },
  now() { return Date.now() + this.offset; },
};
let db, M, roomRef;

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
    const cred = await auth.signInAnonymously(auth.getAuth(fb));
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
    net.error = "Couldn't reach the multiplayer server: solo mode. (" + (e.code || e.message) + ')';
    return false;
  }
}

export async function joinRoom(code, name, look) {
  net.room = code;
  if (!net.online) {
    net.players[net.uid] = { n: name, c: look, j: 0, s: null };
    return;
  }
  roomRef = M.ref(db, 'rooms/' + code);
  const meRef = M.child(roomRef, 'players/' + net.uid);
  await M.set(meRef, { n: name, c: look, j: M.serverTimestamp(), s: [0, 0, 0, 0, 0, '', 100, 0, 0, 0, 0, 0, 0] });
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
  M.onChildAdded(M.query(M.child(roomRef, 'chat'), M.limitToLast(15)), (s) => net.handlers.chat(s.val()));
}

// A new outfit from the clothing store.
export function setLook(look) {
  if (net.players[net.uid]) net.players[net.uid].c = look;
  if (net.online && roomRef) M.set(M.child(roomRef, 'players/' + net.uid + '/c'), look);
}
export function sendState(arr) {
  if (net.online) M.set(M.child(roomRef, `players/${net.uid}/s`), arr);
  else if (net.players[net.uid]) net.players[net.uid].s = arr;
}
export function setVehicle(id, rec) { if (net.online) M.set(M.child(roomRef, 'vehicles/' + id), rec); }
export function removeVehicle(id) { if (net.online) M.remove(M.child(roomRef, 'vehicles/' + id)); }
export function setCops(obj) { if (net.online) M.set(M.child(roomRef, 'cops'), obj); }
export function sendEvent(type, data) {
  if (!net.online) return;
  const r = M.push(M.child(roomRef, 'events'));
  M.set(r, { ...data, type, from: net.uid, t: M.serverTimestamp() });
  setTimeout(() => M.remove(r), 8000);
}
export function sendChat(name, msg) {
  if (!net.online) { net.handlers.chat({ n: name, m: msg }); return; }
  M.push(M.child(roomRef, 'chat'), { n: name, m: msg, t: M.serverTimestamp() });
}

// The host runs the police. Host = the player who joined first.
export function hostUid() {
  let best = null, bj = Infinity;
  for (const [uid, p] of Object.entries(net.players)) {
    const j = typeof p.j === 'number' ? p.j : Infinity;
    if (j < bj || (j === bj && (best === null || uid < best))) { bj = j; best = uid; }
  }
  return best || net.uid;
}
