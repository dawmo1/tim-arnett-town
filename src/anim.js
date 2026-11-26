// The player's interactive animations: short timed actions (getting in and out of cars, doors, buying at a counter,
// sitting, minigames, the phone) that pose the body through people/pose.js (st.act), may hold the player still while
// they play, and reach other players through two slots of the player state: s[21] = action code (negative when the
// pose is mirrored: the passenger side) and s[22] = progress 0..1. main.js starts them and feeds the result into
// animateCharacter; remote players are posed from the same two numbers (remoteAct).
import { setProp } from './character.js';

// codes are sent over the network: only ever append
const LIST = ['', 'carOpen', 'carIn', 'carShut', 'carOut', 'shutStand', 'door', 'give', 'take', 'eat', 'pool', 'darts', 'table', 'slots', 'sit', 'stool',
  'phone', 'call', 'getUpFront', 'getUpBack', 'fillBag'];
const CODE = new Map(LIST.map((n, i) => [n, i]));
export const codeOf = (n) => CODE.get(n) || 0;
// props held during an action (character.js PROP_AT)
const PROPS = { give: 'cash', eat: 'hotdog', pool: 'cue', darts: 'dart', table: 'cards', phone: 'phone', call: 'phone' };

let cur = null; // { n, t, dur, loop, side, lock, onDone, next }
const queue = [];
// play(name, seconds, { side, loop, lock, onDone }) replaces whatever is playing; then(...) queues after it
export function play(n, dur, o = {}) {
  queue.length = 0;
  cur = { n, t: 0, dur, side: o.side || 1, loop: !!o.loop, lock: o.lock !== false, onDone: o.onDone, prop: o.prop };
  return api;
}
const api = { then(n, dur, o = {}) { queue.push({ n, t: 0, dur, side: o.side || 1, loop: !!o.loop, lock: o.lock !== false, onDone: o.onDone, prop: o.prop }); return api; } };
export function stop(n) { if (!n || cur?.n === n) { cur = null; queue.length = 0; } }
export const playing = (n) => !!cur && (!n || cur.n === n);
// true while an action holds the player in place
export const busy = () => !!cur && cur.lock;
export const name = () => cur?.n || '';

let last = null; // the pose state from the last update
// advance; returns { n, k, side } for st.act, or null
export function update(dt) {
  if (!cur) { last = null; return null; }
  cur.t += dt;
  let k = cur.t / cur.dur;
  if (k >= 1) {
    if (cur.loop) { cur.t %= cur.dur; k = cur.t / cur.dur; }
    else {
      const done = cur;
      cur = queue.shift() || null;
      done.onDone?.();
      last = { n: done.n, k: 1, side: done.side, prop: done.prop };
      return last;
    }
  }
  last = { n: cur.n, k, side: cur.side, prop: cur.prop };
  return last;
}
export const current = () => last;
// what to send: [code (sign = side), progress]
export function netState() {
  if (!last) return [0, 0];
  const c = CODE.get(last.n) || 0;
  return [c * (last.side < 0 ? -1 : 1), Math.round(last.k * 100) / 100];
}
// a remote player's two numbers back to an st.act (phone poses use their own flags)
export function remoteAct(code, k) {
  const n = LIST[Math.abs(code | 0)];
  if (!n) return null;
  return { n, k: +k || 0, side: code < 0 ? -1 : 1 };
}
// st fields for an action: phone poses stack on walking, the rest take over the body
export function poseFields(a) {
  if (!a) return {};
  if (a.n === 'phone') return { text: true };
  if (a.n === 'call') return { phone: true };
  return { act: a };
}
// show the prop that goes with the action (and hide the others)
export function holdProps(ch, a) {
  const want = a ? a.prop || PROPS[a.n] || null : null;
  if (ch.animProp === want) return;
  if (ch.animProp) setProp(ch, ch.animProp, false);
  ch.animProp = want;
  if (want) setProp(ch, want, true);
}
