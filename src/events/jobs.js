// Races and side jobs. Street races and car meets wait at a start line; stunt jumps and package
// pickups wait on the street. Driving a taxi, an ambulance, a fire truck or a police car (or riding a
// scooter up to a restaurant) starts that vehicle's side job (fares, patients, fires, suspects, pizzas).
import * as W from '../world.js';
import { V } from '../vehicles.js';
import { spend, eco } from '../economy.js';
import { setProp } from '../character.js';
import { angDiff } from '../util.js';
import { K, pick, rnd, chance, dP, money, fresh, shout, chatter, spot, lane, destination, hospital, LANDMARKS, person, pose, face, live, car, drive, carGone, carStopped, carSide,
  prop, PROPS, marker, moveMarker, dropMarker, mission, timer, win, fail, text, pickup, riding, dropOff, dented, inCar, goal, timeLeft, fx } from './kit.js';

const inA = (c, f) => !!c.veh && f(c.veh.T) && c.vehT > 3;
const FOOD = new Set(['restaurant', 'fast_food']);
const nearFood = (v) => (W.D.index.poi || []).some((p) => FOOD.has(p.kind) && Math.abs(p.x - v.x) < 35 && Math.abs(p.z - v.z) < 35);
const ORD = ['1st', '2nd', '3rd', '4th', '5th'];
const fast = () => pick([V.SPORTS, V.MUSCLE, V.CONVERTIBLE, V.SPORTS, V.MUSCLE, V.HATCH]);
const COOL = [0xd9762b, 0xe3c33b, 0x2f8fd0, 0x4fae6e, 0xb02a2a, 0x1c1d20, 0xf2f2f0, 0x6a3f99];

// a fare / patient: wait for pickup, then a timed drive. pay(ev) on arrival.
function fareJob(ev, dt, w, opts, onBoard, pay, failText) {
  if (!ev.ride) {
    if (pickup(ev, w, dt, opts)) onBoard();
    else if (!live(w) || ev.t > (ev.pickT || 120)) return fail(ev, failText.gone);
    return;
  }
  timer(ev, timeLeft(ev));
  if (ev.chat && Math.random() < dt * 0.06) inCar(ev.ride.v, ev.chat);
  const r = riding(ev, ev.dest, dt);
  if (r === 'there') { dropOff(ev); return pay(ev); }
  if (r === 'left') { dropOff(ev); return fail(ev, failText.left); }
  if (r === 'wreck') return fail(ev, failText.wreck);
  if (ev.strict && timeLeft(ev) <= 0) { dropOff(ev); fail(ev, failText.late); }
}

// ---------- racing: AI cars follow the GPS route along real streets ----------
function buildRoute(x, z, h) {
  for (let i = 0; i < 5; i++) {
    const a = h + (Math.random() - 0.5) * 1.4, d = rnd(800, 1400);
    const R = W.route(x, z, x + Math.sin(a) * d, z + Math.cos(a) * d);
    if (!R || R.length < 3) continue;
    const cum = [0]; for (let k = 1; k < R.length; k++) cum.push(cum[k - 1] + Math.hypot(R[k][0] - R[k - 1][0], R[k][1] - R[k - 1][1]));
    if (cum[cum.length - 1] > 600) return { pts: R, cum, total: cum[cum.length - 1] };
  }
  return null;
}
function at(rt, s, r) { // point at distance s along the route (r.i caches the segment)
  const { pts, cum } = rt; let i = Math.min(r.i || 0, pts.length - 2);
  while (i < pts.length - 2 && cum[i + 1] < s) i++;
  while (i > 0 && cum[i] > s) i--;
  r.i = i;
  const L = cum[i + 1] - cum[i] || 1, k = Math.max(0, Math.min(1, (s - cum[i]) / L));
  const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
  return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, h: Math.atan2(bx - ax, bz - az), i };
}
// how far along the route is (x, z), searching near s0
function project(rt, x, z, s0) {
  let best = s0, bd = Infinity;
  for (let s = Math.max(0, s0 - 120); s < Math.min(rt.total, s0 + 160); s += 6) { const p = at(rt, s, {}), d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = s; } }
  return best;
}
function placeRacer(rt, r, dt) {
  const v = r.v, p = at(rt, r.s, r), ox = v.x, oz = v.z;
  v.x = p.x - Math.cos(p.h) * r.lat; v.z = p.z + Math.sin(p.h) * r.lat;
  v.h += angDiff(v.h, p.h) * Math.min(1, dt * 6); v.y = W.groundHeight(v.x, v.z);
  v.vx = dt > 0 ? (v.x - ox) / dt : 0; v.vz = dt > 0 ? (v.z - oz) / dt : 0; v.speed = r.spd;
}
// checkpoints every ~200 m; the last one is the finish
function startRace(ev, rt, racers) {
  ev.rt = rt; ev.racers = racers; ev.cps = [];
  for (let s = 200; s < rt.total - 80; s += 200) ev.cps.push(s);
  ev.cps.push(rt.total);
  ev.cp = 0; ev.phase = 'count'; ev.goT = ev.t + 3.2; ev.job = true; ev.label = 'Race';
  const p = at(rt, ev.cps[0], {}); ev.cpMark = marker(ev, p.x, p.z, 0xffd23f, 7, 9); ev.dest = { x: p.x, z: p.z };
  for (const r of racers) { r.v.mode = 'race'; r.v.npcDriver = true; r.v.keep = true; r.s = r.s ?? project(rt, r.v.x, r.v.z, 0); r.spd = 0; r.i = 0; r.done = false; }
}
function updateRace(ev, dt) {
  const P = K.P;
  if (ev.phase === 'count') {
    const n = Math.ceil(ev.goT - ev.t);
    if (n !== ev.lastN) { ev.lastN = n; mission(ev, n > 0 ? `${n}` : 'GO!', 2); fx.soundClick(); if (n <= 0) { ev.phase = 'race'; ev.raceT = ev.t; fx.soundGoal(); } }
    for (const r of ev.racers) if (r.v.mode === 'race') placeRacer(ev.rt, r, dt);
    return;
  }
  // you
  const cpS = ev.cps[ev.cp], cpP = at(ev.rt, cpS, {});
  if (dP(cpP.x, cpP.z) < 13) {
    ev.cp++; fx.soundClick();
    if (ev.cp >= ev.cps.length) { // finished
      const place = 1 + ev.racers.filter((r) => r.done).length;
      for (const r of ev.racers) if (r.v.mode === 'race') { r.v.mode = 'parked'; if (!drive(r.v, 2)) r.v.npcDriver = false; }
      return place === 1 ? win(ev, ev.prize, `You won the ${ev.V.name}`, 'RACE WON') : fail(ev, `You finished ${ORD[place - 1] || 'last'}.`);
    }
    const n = at(ev.rt, ev.cps[ev.cp], {}); moveMarker(ev.cpMark, n.x, n.z); ev.dest = { x: n.x, z: n.z };
    if (ev.cp === ev.cps.length - 1) { ev.cpMark.material.color.setHex(0xffffff); mission(ev, 'Cross the *finish line*.', 3); }
  }
  ev.x = cpP.x; ev.z = cpP.z;
  const pS = ev.cp > 0 ? Math.max(ev.cps[ev.cp - 1], ev.cps[ev.cp] - dP(cpP.x, cpP.z)) : Math.max(0, ev.cps[0] - dP(cpP.x, cpP.z));
  // them
  for (const r of ev.racers) {
    const v = r.v;
    if (r.done || r.out) continue;
    if (v.mode !== 'race') { // knocked off the line: back on once it stops
      if (v === P.veh || carGone(v) || v.exploded || v.hp <= 0) { r.out = true; continue; }
      if (!v.localSim && Math.abs(v.speed || 0) < 0.5) { r.s = project(ev.rt, v.x, v.z, r.s); r.spd = 0; v.mode = 'race'; v.npcDriver = true; }
      continue;
    }
    const a = at(ev.rt, r.s, {}), b = at(ev.rt, Math.min(ev.rt.total, r.s + 28), {});
    let cap = r.top * (1 - Math.min(0.65, Math.abs(angDiff(a.h, b.h)) / 1.7));
    if (r.s - pS > 140) cap *= 0.82; else if (pS - r.s > 90) cap *= 1.12; // keep it close
    r.spd += Math.max(-12 * dt, Math.min(7 * dt, Math.max(8, cap) - r.spd));
    r.s += r.spd * dt;
    if (r.s >= ev.rt.total) { r.done = true; r.s = ev.rt.total; v.mode = 'parked'; v.vx = v.vz = 0; v.speed = 0; continue; }
    placeRacer(ev.rt, r, dt);
  }
  if (!P.veh) { ev.offT = (ev.offT || 0) + dt; if (ev.offT > 10) return fail(ev, 'You left the race.'); } else ev.offT = 0;
  if (dP(cpP.x, cpP.z) > 600 || ev.t - ev.raceT > 300) fail(ev, 'You left the race.');
}
function raceEnd(ev) { for (const r of ev.racers || []) if (r.v.mode === 'race') { r.v.mode = 'parked'; r.v.npcDriver = false; } }
// pull into the start marker (in a car) to race; bets are paid up front
function atStart(ev, dt) {
  const P = K.P, m = ev.startMark;
  if (!m || !P.veh || P.veh.T.boat || P.veh.T.heli || dP(m.position.x, m.position.z) > 5 || P.speed > 4) { ev.askT = 0; return false; }
  if ((ev.askT = (ev.askT || 0) + dt) < 0.6) return false;
  if (ev.V.bet && !ev.paid) {
    if (!spend(ev.V.bet)) { if (!ev.broke) { ev.broke = true; mission(ev, `The buy-in is *$${ev.V.bet}*. Come back with cash.`, 4); } return false; }
    ev.paid = true; K.ctx.feed?.(`Race buy-in: -$${ev.V.bet}`);
  }
  return true;
}

export default [
  { // ---------- street race: 2-4 racers at a start line ----------
    id: 'race', theme: 'race', name: 'Street race', weight: 0.9, when: (c) => (c.foot ? 0.15 : 1) * (c.night ? 1.8 : 0.6), life: 150, seeR: 70,
    variants: [
      { name: 'Brady Street Sprint', n: 1, bet: 100, top: 30 },
      { name: 'River Drive Run', n: 2, bet: 150, top: 31 },
      { name: 'Hilltop Hustle', n: 3, bet: 200, top: 32 },
      { name: 'Midnight Mile', n: 2, bet: 250, top: 34 },
      { name: 'Quad City Shootout', n: 3, bet: 0, top: 29, prize: 400 },
    ],
    start(ev) {
      const L = lane(110, 220); if (!L) return false;
      const rt = buildRoute(L.x, L.z, L.h); if (!rt) return false;
      ev.rt0 = rt; ev.racers = [];
      for (let i = 0; i < ev.V.n; i++) {
        const s = 22 - Math.floor(i / 2) * 9, lat = i % 2 ? 1.8 : -1.8, p = at(rt, s, {});
        const v = car(ev, fast(), p.x - Math.cos(p.h) * lat, p.z + Math.sin(p.h) * lat, p.h, pick(COOL)); v.npcDriver = true; v.mode = 'race';
        ev.racers.push({ v, s, lat, top: ev.V.top * rnd(0.92, 1.02), spd: 0 });
      }
      const sp = at(rt, 8, {});
      ev.startMark = marker(ev, sp.x, sp.z, 0x4aa3ff, 3, 3);
      ev.fans = [0, 1, 2].map((i) => { const k = at(rt, 14 + i * 3, {}), q = W.pushOutCircle(k.x - Math.cos(k.h) * 7, k.z + Math.sin(k.h) * 7, 0.5); return person(ev, pick(['walk', 'student', 'skater']), q.x, q.z, k.h - Math.PI / 2); });
      ev.prize = ev.V.prize || ev.V.bet * (ev.V.n + 1) + 100;
      ev.x = sp.x; ev.z = sp.z; ev.goal = ev.V.bet ? `Street race: pull up to the *start line*. Buy-in $${ev.V.bet}.` : 'Street race: pull up to the *start line*.';
      return true;
    },
    update(ev, dt) {
      if (!ev.phase) {
        ev.fans.forEach((w, i) => { pose(w, i % 2 ? { clap: true } : { handsUp: Math.sin(ev.t * 3 + i) > 0 }); chatter(w, ['Race! Race!', "Who's next?!", 'Burn some rubber!', "Let's go!"], dt, 0.08); });
        if (Math.random() < dt * 0.5 && dP(ev.x, ev.z) < 60) fx.soundBackfire(dP(ev.x, ev.z));
        if (atStart(ev, dt)) { dropMarker(ev, ev.startMark); ev.startMark = null; startRace(ev, ev.rt0, ev.racers); }
        else if (ev.st > (ev.life || 150)) fail(ev, '');
        return;
      }
      updateRace(ev, dt);
    },
    end: raceEnd,
  },
  { // ---------- car meet: tuners parked with the music on; challenge one ----------
    id: 'carmeet', theme: 'race', name: 'Car meet', weight: 0.7, when: (c) => (c.foot ? 0.2 : 1) * (c.night ? 2 : 0.5), life: 180, seeR: 70,
    variants: [{ n: 4, bet: 200, top: 32, name: 'car meet race' }, { n: 5, bet: 300, top: 34, name: 'car meet race' }, { n: 6, bet: 0, top: 31, prize: 350, name: 'pink slip race... for cash' }],
    start(ev) {
      const L = lane(100, 200); if (!L) return false;
      const fx_ = Math.sin(L.h), fz = Math.cos(L.h);
      ev.cars2 = [];
      for (let i = 0; i < ev.V.n; i++) { const v = car(ev, fast(), L.kx + fx_ * i * 6.2, L.kz + fz * i * 6.2, L.h, pick(COOL)); ev.cars2.push(v); }
      const off = L.q.e.width / 2 + 1.4, sx = L.q.x - Math.cos(L.h) * off, sz = L.q.z + Math.sin(L.h) * off;
      ev.crowd = Array.from({ length: Math.min(6, ev.V.n + 1) }, (_, i) => person(ev, pick(['walk', 'student', 'skater', 'bar']), sx + fx_ * (i * 5 + 1), sz + fz * (i * 5 + 1), L.h - Math.PI / 2 + (i % 2 ? 0.6 : -0.6)));
      ev.startMark = marker(ev, L.x - fx_ * 10, L.z - fz * 10, 0x4aa3ff, 3, 3);
      ev.prize = ev.V.prize || ev.V.bet * 2 + 100;
      ev.x = L.x; ev.z = L.z; ev.goal = 'Car meet. Pull into the *marker* to challenge a driver.';
      return true;
    },
    update(ev, dt) {
      if (!ev.phase) {
        ev.crowd.forEach((w, i) => { pose(w, i % 3 === 0 ? { lean: true, smoke: true } : { chat: true }); chatter(w, ['Nice rims.', 'What is she pushing?', 'Turbo or supercharger?', 'That exhaust is LOUD.', 'Stock? No way.', 'Cops are coming, act natural.'], dt, 0.05); });
        if (Math.random() < dt * 0.6 && dP(ev.x, ev.z) < 60) fx.soundBackfire(dP(ev.x, ev.z));
        if (atStart(ev, dt)) {
          const v = pick(ev.cars2.filter((c) => !carGone(c) && c.mode === 'parked' && c.hp > 0)); if (!v) return fail(ev, '');
          const rt = buildRoute(v.x, v.z, v.h); if (!rt) return fail(ev, 'No race tonight.');
          dropMarker(ev, ev.startMark); ev.startMark = null;
          shout(pick(ev.crowd), ['Ooooh, a challenger!', "Let's see what you got!", 'Race! Race! Race!']);
          startRace(ev, rt, [{ v, s: 6, lat: 1.6, top: ev.V.top * rnd(0.95, 1.03) }]);
        } else if (ev.st > (ev.life || 180)) fail(ev, '');
        return;
      }
      updateRace(ev, dt);
    },
    end: raceEnd,
  },
  { // ---------- stunt jump: hit the kicker ramp fast ----------
    id: 'stunt', theme: 'race', name: 'Stunt jump', weight: 0.7, when: (c) => (c.foot ? 0.2 : 1.2), life: 160, seeR: 80,
    variants: [{ min: 13, per: 6 }, { min: 15, per: 7 }, { min: 17, per: 9 }],
    start(ev) {
      for (let i = 0; i < 6; i++) {
        const L = lane(90, 200); if (!L) return false;
        if (L.q.e.len < 90 || L.q.e.cls === 'residential') continue;
        ev.r = { x: L.x, z: L.z, h: L.h }; ev.ramp = prop(ev, PROPS.ramp, L.x, L.z, L.h);
        ev.mk = marker(ev, L.x - Math.sin(L.h) * 4, L.z - Math.cos(L.h) * 4, 0xffd23f, 2.4, 1.2);
        ev.x = L.x; ev.z = L.z; ev.goal = 'Hit the *stunt jump*.';
        return true;
      }
      return false;
    },
    update(ev, dt) {
      const v = K.P.veh, r = ev.r;
      if (ev.fly) { // in the air: measure from takeoff to landing
        if (v !== ev.fly.v) return fail(ev, '');
        if (!(v.air > 0) && ev.t - ev.fly.t > 0.25) {
          const d = Math.hypot(v.x - ev.fly.x, v.z - ev.fly.z), ft = Math.round(d * 3.28084);
          fx.soundStunt();
          return win(ev, Math.max(50, d * ev.V.per), `Stunt jump: ${ft} ft`, 'STUNT JUMP');
        }
        return;
      }
      if (!v || v.T.boat || v.T.heli || ev.cool > ev.t) { if (ev.st > (ev.life || 160)) fail(ev, ''); return; }
      const dx = v.x - r.x, dz = v.z - r.z, along = dx * Math.sin(r.h) + dz * Math.cos(r.h), lat = Math.abs(dx * Math.cos(r.h) - dz * Math.sin(r.h));
      if (lat < 2.4 && Math.abs(along) < 2.5 && Math.abs(angDiff(v.h, r.h)) < 0.7 && !(v.air > 0)) {
        const sp = Math.abs(v.speed || 0);
        if (sp < ev.V.min) { ev.cool = ev.t + 3; mission(ev, 'Too slow. Hit it *faster*.', 3); return; }
        v.vy = 4.5 + sp * 0.22; v.y += 0.45; v.air = 0.01; // the kicker launches you
        ev.fly = { v, x: v.x, z: v.z, t: ev.t };
      }
      if (ev.st > (ev.life || 160)) fail(ev, '');
    },
  },
  { // ---------- delivery rush: grab the package, beat the clock ----------
    id: 'delivery', theme: 'race', name: 'Delivery rush', weight: 0.8, life: 120,
    variants: [
      { what: 'package', p: 'parcel', cash: 150, goal: 'Deliver the *package*.' },
      { what: 'legal papers', p: 'parcel', cash: 200, goal: 'Deliver the *legal papers* before court.', tight: 0.85 },
      { what: 'wedding cake', p: 'cake', cash: 260, goal: "Deliver the *wedding cake*. Don't crash.", fragile: true },
      { what: 'mystery box', p: 'parcel', cash: 300, goal: "Deliver the *mystery box*. Don't ask.", tight: 0.8 },
    ],
    start(ev) {
      const p = spot(50, 130); if (!p) return false;
      ev.box = prop(ev, PROPS[ev.V.p], p.x, p.z, p.h); ev.mk = marker(ev, p.x, p.z, 0xffd23f, 1.4, 2);
      ev.x = p.x; ev.z = p.z; ev.goal = `A *${ev.V.what}* needs delivering. Grab it.`;
      return true;
    },
    update(ev, dt) {
      const P = K.P;
      if (!ev.got) {
        if (dP(ev.x, ev.z) < (P.foot ? 1.8 : 4)) {
          ev.got = true; ev.job = true; ev.box.visible = false; dropMarker(ev, ev.mk);
          ev.to = destination(450, 1100, chance(0.5) ? LANDMARKS : null); if (!ev.to) return fail(ev, '');
          goal(ev, ev.to, ev.V.goal + (ev.to.name ? ` (${ev.to.name})` : ''), (dP(ev.to.x, ev.to.z) * 1.35 / 13 + 25) * (ev.V.tight || 1));
        } else if (ev.st > (ev.life || 120)) fail(ev, '');
        return;
      }
      timer(ev, timeLeft(ev));
      if (ev.V.fragile && P.veh) { if (P.veh === ev.hv && P.veh.hp < ev.hp - 12) return fail(ev, 'The cake is ruined.'); ev.hv = P.veh; ev.hp = P.veh.hp; }
      if (dP(ev.to.x, ev.to.z) < 9 && P.speed < 3) { const w = person(ev, pick(['walk', 'office']), ev.to.x, ev.to.z, 0); w.leaveNow = true; shout(w, ['Finally!', 'Thanks!', 'Right on time.', 'Is it ticking?']); return win(ev, ev.V.cash + Math.min(ev.V.cash, Math.max(0, timeLeft(ev)) * 3), `You delivered the ${ev.V.what}`, 'DELIVERED'); }
      if (timeLeft(ev) <= 0) fail(ev, `Too late. The ${ev.V.what} wasn't delivered.`);
    },
  },
  { // ---------- taxi fares ----------
    id: 'taxi', theme: 'job', name: 'Fare', trigger: (c) => inA(c, (T) => T.taxi),
    variants: [
      { cash: 25, chat: ['Step on it!', 'I tip in cash.', 'Do you know a shortcut?', "I'm late for a very important date!"] },
      { cash: 30, chat: ['Nice cab. Smells like pine trees.', 'My ex lives on this street. Drive faster.', 'Can you turn the radio up?', 'Are you even a real cabbie?'] },
      { cash: 35, chat: ['I just won at the casino!', 'Davenport, baby!', 'Take the scenic route. Kidding. Hurry.', 'Five stars if we get there alive.'] },
      { cash: 28, chat: ['Shh. I have a migraine.', 'Gentle on the brakes.', 'Why is everyone honking at you?', 'Was that a red light?!'] },
    ],
    start(ev) {
      const p = spot(70, 220); if (!p) return false;
      ev.w = person(ev, pick(['office', 'walk', 'shopper', 'student', 'elderly']), p.x, p.z, p.h);
      ev.to = destination(400, 1300, chance(0.5) ? LANDMARKS : null); if (!ev.to) return false;
      ev.chat = ev.V.chat; ev.pickT = 120;
      ev.x = p.x; ev.z = p.z; ev.goal = 'Pick up the @fare@.';
      return true;
    },
    update(ev, dt) {
      fareJob(ev, dt, ev.w, {}, () => { const d = dP(ev.to.x, ev.to.z); ev.d0 = d; goal(ev, ev.to, `Take the @fare@ to *${ev.to.name || 'the drop-off'}*.`, d * 1.35 / 13 + 20); }, (e) => {
        const fare = Math.round(e.V.cash + e.d0 * 0.05), tip = Math.max(0, Math.round(timeLeft(e) * 1.2 - dented(e) * 0.5));
        win(e, fare + tip, tip > 0 ? `Fare $${fare} + $${tip} tip` : `Fare $${fare}, no tip`, 'FARE COMPLETE');
      }, { gone: 'The fare found another ride.', left: 'You ditched your fare.', wreck: 'Your fare ran off screaming.' });
    },
  },
  { // ---------- ambulance: pick up the patient, rush to the hospital ----------
    id: 'ambulance', theme: 'job', name: 'Patient', trigger: (c) => inA(c, (T) => T.cabbed === 'ambulance'),
    variants: [{ why: 'Chest pains', cash: 220 }, { why: 'Broken leg', cash: 180 }, { why: 'Allergic reaction', cash: 240 }, { why: 'Fell off a roof', cash: 260 }, { why: 'Ate the whole cornfield challenge', cash: 200 }],
    start(ev) {
      const p = spot(90, 280); if (!p) return false;
      ev.w = person(ev, pick(['walk', 'office', 'worker', 'elderly']), p.x, p.z, p.h);
      ev.to = hospital(); ev.strict = true; ev.pickT = 90;
      ev.chat = ['Ow...', 'Am I gonna make it?', 'Is that the siren or me?', 'Hurry...', 'Tell my cat I love her.'];
      ev.x = p.x; ev.z = p.z; ev.goal = `${ev.V.why}. Pick up the @patient@.`;
      return true;
    },
    update(ev, dt) {
      if (!ev.ride) timer(ev, ev.pickT - ev.t);
      fareJob(ev, dt, ev.w, { idle: { lie: true }, walk: { limp: true }, speed: 1.4 }, () => goal(ev, ev.to, `Rush the @patient@ to *${ev.to.name}*.`, dP(ev.to.x, ev.to.z) * 1.3 / 14 + 30),
        (e) => win(e, e.V.cash + Math.min(e.V.cash, Math.max(0, timeLeft(e)) * 2), 'Patient delivered', 'LIFE SAVED'),
        { gone: 'The patient needed help sooner.', left: 'You left the patient behind.', wreck: 'The ambulance is wrecked.', late: 'The patient needed help sooner.' });
    },
  },
  { // ---------- fire truck: reach the fire and put it out ----------
    id: 'firejob', theme: 'job', name: 'Fire', trigger: (c) => inA(c, (T) => T.cabbed === 'fire'),
    variants: [{ kind: 'car', what: 'car fire', cash: 260 }, { kind: 'dumpster', what: 'dumpster fire', cash: 180 }, { kind: 'trash', what: 'trash fire', cash: 160 }, { kind: 'van', what: 'food truck fire', cash: 300 }],
    start(ev) {
      const L = lane(180, 450); if (!L) return false;
      if (ev.V.kind === 'car' || ev.V.kind === 'van') { const v = (ev.v = car(ev, ev.V.kind === 'van' ? V.VAN : pick([V.SEDAN, V.HATCH, V.SUV]), L.kx, L.kz, L.h)); v.hp = -v.T.hp * 0.2; v.burnAt = K.ctx.now(); v.burnBy = ''; }
      else { const off = L.q.e.width / 2 + 1.6, x = L.q.x - Math.cos(L.h) * off, z = L.q.z + Math.sin(L.h) * off; ev.pr = prop(ev, PROPS[ev.V.kind], x, z, L.h); ev.fire = fx.startFire(ev.pr); }
      ev.fx = ev.v ? ev.v.x : ev.pr.position.x; ev.fz = ev.v ? ev.v.z : ev.pr.position.z;
      ev.x = ev.fx; ev.z = ev.fz; ev.goal = `Put out the *${ev.V.what}*.`;
      ev.limit = dP(ev.fx, ev.fz) * 1.4 / 13 + 45; ev.legT = 0; ev.dest = { x: ev.fx, z: ev.fz };
      return true;
    },
    update(ev, dt) {
      const v = ev.v;
      if (v) { if (!v.burnAt || v.exploded) return fail(ev, v.exploded ? 'The car exploded.' : ''); v.burnAt = K.ctx.now(); }
      timer(ev, timeLeft(ev));
      if (Math.random() < dt * 2 && dP(ev.fx, ev.fz) < 120) fx.smokePuff(ev.fx, W.groundHeight(ev.fx, ev.fz) + 2, ev.fz, false, 1);
      const P = K.P;
      if (P.veh && P.veh.T.cabbed === 'fire' && dP(ev.fx, ev.fz) < 16 && P.speed < 3) { // spraying
        ev.sprayT = (ev.sprayT || 0) + dt;
        if (Math.random() < dt * 8) fx.smokePuff(ev.fx + (Math.random() - 0.5) * 2, W.groundHeight(ev.fx, ev.fz) + 1 + Math.random(), ev.fz + (Math.random() - 0.5) * 2, true, 0.8);
        if (ev.sprayT > 3.5) {
          if (v) K.ctx.extinguish(v); else { fx.stopFire(ev.fire); ev.fire = null; }
          return win(ev, ev.V.cash + Math.min(ev.V.cash, Math.max(0, timeLeft(ev)) * 2), `You put out a ${ev.V.what}`, 'FIRE OUT');
        }
      }
      if (timeLeft(ev) <= 0) { if (v) v.burnAt = K.ctx.now() - 15200; fail(ev, v ? 'Too late. It blew.' : 'The fire spread.'); }
      if (!P.veh || P.veh.T.cabbed !== 'fire') { ev.offT = (ev.offT || 0) + dt; if (ev.offT > 15) fail(ev, 'You left the fire truck.'); } else ev.offT = 0;
    },
    end(ev) { if (ev.fire) { fx.stopFire(ev.fire); ev.fire = null; } },
  },
  { // ---------- police car: run down a fleeing suspect ----------
    id: 'vigilante', theme: 'job', name: 'Suspect', trigger: (c) => inA(c, (T) => T.police),
    variants: [{ what: 'robbery suspect', cash: 300 }, { what: 'stolen car', cash: 260 }, { what: 'hit-and-run driver', cash: 320 }, { what: 'drug dealer', cash: 350 }, { what: 'guy who stole a parrot', cash: 240 }],
    start(ev) {
      const L = lane(120, 220); if (!L) return false;
      ev.v = car(ev, pick([V.SEDAN, V.MUSCLE, V.SUV, V.HATCH, V.PICKUP, V.SPORTS]), L.x, L.z, L.h); ev.v.npcDriver = true;
      if (!drive(ev.v, 999)) return false;
      ev.limit = 180; ev.legT = 0;
      ev.x = L.x; ev.z = L.z; ev.goal = `Stop the #${ev.V.what}#.`;
      return true;
    },
    update(ev, dt) {
      const v = ev.v;
      ev.x = v.x; ev.z = v.z; timer(ev, timeLeft(ev));
      if (carStopped(ev, v, dt)) return win(ev, money(ev.V.cash * 0.85, ev.V.cash * 1.15), `You stopped the ${ev.V.what}`, 'SUSPECT STOPPED');
      if (carGone(v) || dP(v.x, v.z) > 450 || timeLeft(ev) <= 0) fail(ev, `The ${ev.V.what} got away.`);
    },
  },
  { // ---------- scooter: pizza (and friends) delivery ----------
    id: 'pizza', theme: 'job', name: 'Delivery', trigger: (c) => inA(c, (T) => T.name === 'Scooter') && nearFood(c.veh), // only when you ride up to a restaurant (scooters are everywhere)
    variants: [{ what: 'pizza', from: "Tim's Pizza", cash: 30 }, { what: 'tacos', from: 'Taco Tim', cash: 28 }, { what: 'noodles', from: 'Wok n Roll', cash: 32 }, { what: 'wings', from: 'Wing Arnett', cash: 34 }, { what: 'sushi', from: 'Mississushi', cash: 40 }],
    start(ev) {
      ev.to = destination(250, 750); if (!ev.to) return false;
      ev.job = true;
      goal(ev, ev.to, `Deliver the *${ev.V.what}* from ${ev.V.from}.`, dP(ev.to.x, ev.to.z) * 1.35 / 12 + 20);
      ev.x = ev.to.x; ev.z = ev.to.z; ev.goal = '';
      return true;
    },
    update(ev, dt) {
      const P = K.P;
      timer(ev, timeLeft(ev));
      if (dP(ev.to.x, ev.to.z) < 9 && P.speed < 2.5 && P.veh) {
        const w = person(ev, pick(['walk', 'student', 'office']), ev.to.x, ev.to.z, 0); w.leaveNow = true;
        const t = timeLeft(ev), tip = Math.max(0, Math.round(t * 0.8));
        shout(w, t > 0 ? ['Still hot!', 'Yesss!', 'Keep the change!', 'You are a legend.'] : ['Cold. Again.', 'Thirty minutes, my foot.', 'No tip for you.']);
        if (chance(0.25)) text(ev.V.from, t > 0 ? 'Nice hustle out there. Keep it up!' : 'Customers are complaining. Faster!');
        return win(ev, ev.V.cash + tip, t > 0 ? `${ev.V.what} delivered, $${tip} tip` : `${ev.V.what} delivered cold`, 'DELIVERED');
      }
      if (timeLeft(ev) < -30) return fail(ev, `The ${ev.V.what} order was cancelled.`);
      if (!P.veh || P.veh.T.name !== 'Scooter') { ev.offT = (ev.offT || 0) + dt; if (ev.offT > 12) fail(ev, 'You ditched the delivery.'); } else ev.offT = 0;
    },
  },
];
