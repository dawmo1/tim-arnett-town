// Help someone: a broken-down car, a lost tourist, someone hurt, a hitchhiker (not all of them are
// nice), a witness who needs to get to the police, someone who can't get across the street, a lost
// wallet, and a driver whose car just got stolen.
import { provoke } from '../npc.js';
import { V } from '../vehicles.js';
import { setProp, roleLook } from '../character.js';
import { K, pick, rnd, chance, dP, money, fresh, shout, chatter, THANKS, spot, lane, placeNear, destination, hospital, policeStation, LANDMARKS, person, pose, face, move, goTo, live, stopped, beaten,
  car, drive, carGone, carSide, hazards, prop, PROPS, stay, mission, timer, win, fail, text, pickup, riding, dropOff, dented, inCar, goal, timeLeft, marker, dropMarker, fx, W, dropScripted } from './kit.js';

const sedan = () => pick([V.SEDAN, V.HATCH, V.SUV, V.MINIVAN, V.PICKUP]);
// a ride to somewhere: wait for pickup, then drive them there. Returns 'there' | 'left' | 'wreck' | ''
function rideTo(ev, dt, w, opts, onBoard) {
  if (!ev.ride) { if (pickup(ev, w, dt, opts)) { onBoard(); } return ''; }
  if (ev.limit) timer(ev, timeLeft(ev));
  if (ev.chat && Math.random() < dt * 0.06) inCar(ev.ride.v, ev.chat);
  const r = riding(ev, ev.dest, dt);
  if (r === 'there' || r === 'left') { dropOff(ev); timer(ev, null); }
  return r;
}

export default [
  { // ---------- broken-down car ----------
    id: 'breakdown', theme: 'help', name: 'Broken-down car', weight: 1,
    variants: [
      { kind: 'flat', goal: 'Help the @driver@ change a *flat tire*.', secs: 3, cash: 90, lines: ['Flat tire. Of course.', "I've never changed a tire!", 'Do you know how to use a jack?', 'Can you help me?'] },
      { kind: 'battery', goal: 'Pull your car up and give the @driver@ a *jump start*.', secs: 3, cash: 110, lines: ['Dead battery!', 'Anybody have cables?', 'It just clicks!', 'Can you give me a jump?'] },
      { kind: 'smoke', goal: 'Help the @driver@ with the *engine*.', secs: 3.5, cash: 80, lines: ["It's smoking!", 'Is that normal?!', 'The light came on a month ago...', 'Something smells burnt!'] },
      { kind: 'gas', goal: 'Give the @driver@ a ride to a *gas station*.', cash: 120, lines: ['Out of gas. Again.', 'The gauge said a quarter tank!', 'Can you take me to a gas station?', 'Ugh, I ran it dry.'] },
    ],
    start(ev) {
      const L = lane(70, 150); if (!L) return false;
      const v = (ev.v = car(ev, sedan(), L.kx, L.kz, L.h)); hazards(v);
      if (ev.V.kind === 'flat') v.flat = true;
      const s = carSide(v, -1, 1.6);
      ev.d = person(ev, pick(['walk', 'office', 'elderly', 'shopper']), s.x, s.z, v.h);
      ev.x = v.x; ev.z = v.z; ev.goal = ev.V.goal;
      if (ev.V.kind === 'gas') { ev.fuel = placeNear(['fuel'], 80, 1600, true); if (!ev.fuel) return false; }
      return true;
    },
    update(ev, dt) {
      const v = ev.v, d = ev.d;
      if (ev.V.kind === 'gas') {
        const r = rideTo(ev, dt, d, {}, () => goal(ev, ev.fuel, `Take the @driver@ to *${ev.fuel.name || 'the gas station'}*.`));
        if (r === 'there') return win(ev, money(ev.V.cash * 0.8, ev.V.cash * 1.2), 'You got a stranded driver some gas');
        if (r) return fail(ev, 'You left the driver stranded.');
        if (!ev.ride) chatter(d, ev.V.lines, dt, 0.25);
        if (!ev.ride && (!live(d) || ev.st > 120)) fail(ev, '');
        return;
      }
      if (!live(d) || d.mode !== 'script') return fail(ev, '');
      pose(d, { wave: true }, 0); face(d, K.P.x, K.P.z, dt); chatter(d, ev.V.lines, dt, 0.25);
      if (ev.V.kind === 'smoke' && Math.random() < dt * 5) fx.smokePuff(v.x + Math.sin(v.h) * 1.6, v.y + 1.2, v.z + Math.cos(v.h) * 1.6, true, 0.5);
      const done = ev.V.kind === 'battery' ? !!K.P.veh && K.P.veh !== v && stay(ev, v.x, v.z, v.T.len / 2 + 7, ev.V.secs, dt, false) : stay(ev, v.x, v.z, v.T.len / 2 + 1.6, ev.V.secs, dt);
      if (done) {
        v.flat = false; shout(d, THANKS);
        dropScripted(d); v.npcDriver = true; v.alarmUntil = 0; drive(v, 0);
        return win(ev, money(ev.V.cash * 0.8, ev.V.cash * 1.2), 'You helped a stranded driver');
      }
      if (ev.st > 120) fail(ev, '');
    },
  },
  { // ---------- lost tourist ----------
    id: 'tourist', theme: 'help', name: 'Lost tourist', weight: 0.9, when: (c) => (c.night ? 0.5 : 1.2),
    variants: [
      { from: 'Ohio', cash: 120, chat: ['Is that the Mississippi?!', 'We have rivers in Ohio too. Smaller.', 'Do you know Tim Arnett personally?', 'Everyone here is so nice!'] },
      { from: 'Germany', cash: 160, chat: ['Ze river is very big!', 'Where is ze beer garden?', 'You drive very... American.', 'Wunderbar!'] },
      { from: 'Texas', cash: 140, chat: ["Y'all call this a hill?", 'Everything is smaller up here.', 'Nice truck. Oh wait.', 'Where can I get brisket?'] },
      { from: 'Des Moines', cash: 100, chat: ['Des Moines is better, honestly.', 'Is this the big city?', 'We have a skywalk too, you know.', 'Do you take Hy-Vee points?'] },
    ],
    start(ev) {
      const p = spot(60, 140); if (!p) return false;
      ev.w = person(ev, pick(['walk', 'shopper']), p.x, p.z, p.h); setProp(ev.w.ch, 'phone');
      ev.to = destination(450, 1500, LANDMARKS); if (!ev.to || !ev.to.name) return false;
      ev.chat = ev.V.chat;
      ev.x = p.x; ev.z = p.z; ev.goal = `A @tourist@ from ${ev.V.from} needs a ride.`;
      return true;
    },
    update(ev, dt) {
      const w = ev.w;
      if (!ev.ride) chatter(w, ['Excuse me! Taxi?', 'Hello? Can you help?', 'Which way to the river?', 'My phone says I am IN the river.'], dt, 0.25);
      const r = rideTo(ev, dt, w, {}, () => { const d = dP(ev.to.x, ev.to.z); goal(ev, ev.to, `Take the @tourist@ to *${ev.to.name}*.`, d * 1.4 / 12 + 30); });
      if (r === 'there') { const tip = Math.min(ev.V.cash, Math.max(0, timeLeft(ev)) * 1.5) - dented(ev) * 0.6; return win(ev, ev.V.cash + tip, `You showed a tourist from ${ev.V.from} around`); }
      if (r === 'left') return fail(ev, 'You left the tourist behind.');
      if (r === 'wreck') return fail(ev, 'The tourist is never coming back to Davenport.');
      if (!ev.ride && (!live(w) || ev.st > 100)) fail(ev, '');
    },
  },
  { // ---------- someone hurt: rush them to the hospital ----------
    id: 'injured', theme: 'help', name: 'Injured person', weight: 0.8,
    variants: [
      { why: 'fell off a ladder', cash: 260, chat: ['Ow... ow... ow...', 'Is it bad? Don\'t tell me.', 'Hit every pothole, why don\'t you!', 'I can see the light... oh, it\'s a streetlight.'] },
      { why: 'sprained an ankle jogging', cash: 200, chat: ['I was so close to my personal best!', 'Owww.', 'Never jogging again.', 'Can we stop for a smoothie? Kidding. OW.'] },
      { why: 'got hit by a scooter', cash: 240, chat: ['Those scooters are a menace!', 'My hip!', 'Faster! But gentler!', 'I want to speak to the scooter\'s manager.'] },
      { why: 'ate a bad gas station burrito', cash: 220, chat: ['Oh no. Oh no no no.', 'Drive smooth. PLEASE.', 'Never trust a 3 AM burrito.', 'Windows down! WINDOWS DOWN!'] },
    ],
    start(ev) {
      const p = spot(60, 140); if (!p) return false;
      ev.w = person(ev, pick(['walk', 'jogger', 'worker', 'office']), p.x, p.z, p.h);
      ev.f = person(ev, pick(['walk', 'office', 'shopper']), p.x + Math.sin(p.h) * 1.5, p.z + Math.cos(p.h) * 1.5, p.h);
      ev.to = hospital();
      ev.chat = ev.V.chat;
      ev.x = p.x; ev.z = p.z; ev.goal = `Someone ${ev.V.why}. Get them to the *hospital*.`;
      return true;
    },
    update(ev, dt) {
      const { w, f } = ev;
      if (!ev.ride && live(f) && f.mode === 'script') { pose(f, { wave: true }, 0); face(f, K.P.x, K.P.z, dt); chatter(f, ['Over here!', 'Somebody help!', 'He needs a doctor!', 'Can you drive us?', 'The ambulance is taking forever!'], dt, 0.5); }
      const r = rideTo(ev, dt, w, { idle: { lie: true }, walk: { limp: true }, speed: 1.2 }, () => { const d = dP(ev.to.x, ev.to.z); goal(ev, ev.to, `Get them to *${ev.to.name}*.`, d * 1.35 / 13 + 35); if (live(f)) { f.leaveNow = true; shout(f, 'Thank you!'); } });
      if (r === 'there') return win(ev, ev.V.cash + Math.min(ev.V.cash, Math.max(0, timeLeft(ev)) * 2) - dented(ev) * 0.8, 'You got someone to the hospital in time', 'LIFE SAVER');
      if (r) return fail(ev, r === 'left' ? 'You left them on the curb.' : 'That did not help.');
      if (ev.ride && timeLeft(ev) <= 0) { dropOff(ev); return fail(ev, 'They needed a doctor sooner.'); }
      if (!ev.ride && (!live(w) || ev.st > 90)) fail(ev, '');
    },
  },
  { // ---------- hitchhiker: most just want a lift... ----------
    id: 'hitchhiker', theme: 'help', name: 'Hitchhiker', weight: 0.8,
    variants: [
      { crazy: false, cash: 90, chat: ['Thanks for stopping!', "I'm walking to Chicago. Well, was.", 'You seem trustworthy.', 'Got any snacks?'] },
      { crazy: false, cash: 70, chat: ['I collect spoons. Want to see?', 'Do you believe in aliens?', 'The government reads my mind. Not yours. Mine.', 'Nice car. Smells like fries.'] },
      { crazy: true, cash: 220, chat: ['Nice car...', 'Do you like knives? I like knives.', 'Drive a little slower...', 'Pull over up here.'] },
      { crazy: true, cash: 260, chat: ['I just got out. Of... college.', 'Is this car insured?', "Don't look at me.", 'Hmm hmm hmm.'] },
      { crazy: false, cash: 110, chat: ['Thanks, my band van broke down.', 'Want a free CD?', 'We play polka-metal!', 'Rock on, driver!'] },
    ],
    start(ev) {
      const p = spot(70, 150); if (!p) return false;
      ev.w = person(ev, ev.V.crazy ? 'crook' : pick(['walk', 'student', 'skater']), p.x, p.z, Math.atan2(-p.nx, -p.nz));
      ev.to = destination(500, 1300); if (!ev.to) return false;
      ev.chat = ev.V.chat;
      ev.x = p.x; ev.z = p.z; ev.goal = 'A @hitchhiker@ needs a lift.';
      return true;
    },
    update(ev, dt) {
      if (ev.bad) { // they pulled a gun
        if (beaten(ev.bad)) return win(ev, money(ev.V.cash * 0.8, ev.V.cash * 1.2), 'You dealt with a crazy hitchhiker', 'CLOSE CALL');
        if (dP(ev.bad.x, ev.bad.z) > 150 || ev.t - ev.badT > 90) fail(ev, 'The hitchhiker got away.');
        return;
      }
      const r = rideTo(ev, dt, ev.w, { idle: { point: true } }, () => { ev.d0 = dP(ev.to.x, ev.to.z); goal(ev, ev.to, `Drop the @hitchhiker@ off at *${ev.to.name}*.`, ev.d0 * 1.4 / 12 + 30); });
      if (ev.ride && ev.V.crazy && !r && !ev.demand && dP(ev.to.x, ev.to.z) < ev.d0 * 0.55) { ev.demand = ev.t; inCar(ev.ride.v, ['Pull over. NOW.', 'Stop the car.', 'Pull over right here, friend.']); }
      if (ev.demand && !r && (Math.abs(ev.ride.v.speed || 0) < 4 || ev.t - ev.demand > 8)) { // out comes the gun
        const v = ev.ride.v, d = carSide(v, -1, 1);
        ev.bad = person(ev, 'crook', d.x, d.z, v.h - Math.PI / 2, ev.look); ev.bad.temper = 'gunman'; ev.badT = ev.t;
        inCar(v, ['Get out of the car!', 'This is my car now!', 'Pull over. NOW.']); provoke(ev.bad);
        for (const m of [...ev.marks]) dropMarker(ev, m); ev.dest = null; timer(ev, null);
        mission(ev, 'Deal with the #hitchhiker#.');
        return;
      }
      if (r === 'there') return win(ev, ev.V.cash + Math.min(ev.V.cash, Math.max(0, timeLeft(ev))) - dented(ev) * 0.5, 'You gave a hitchhiker a lift');
      if (r) return fail(ev, r === 'left' ? 'You left the hitchhiker behind.' : '');
      if (!ev.ride && ev.st > 90) fail(ev, '');
    },
  },
  { // ---------- witness: get them to the police before the thugs do ----------
    id: 'witness', theme: 'help', name: 'Witness', weight: 0.6,
    variants: [{ n: 2, cash: 300 }, { n: 3, cash: 380 }, { n: 2, cash: 320, gun: true }],
    start(ev) {
      const p = spot(60, 140); if (!p) return false;
      ev.w = person(ev, pick(['office', 'walk', 'shopper']), p.x, p.z, p.h);
      ev.to = policeStation(); if (!ev.to) return false;
      ev.x = p.x; ev.z = p.z; ev.goal = 'A @witness@ needs a ride to the *police station*.';
      ev.chat = ['They saw me! They saw me!', 'I just want to testify and go home.', 'Drive faster!', 'Is that them behind us?!', 'I should have stayed in Moline.'];
      return true;
    },
    update(ev, dt) {
      if (!ev.ride) chatter(ev.w, ["Please, they're after me!", 'I saw everything!', 'Get me to the police!', 'Hurry!'], dt, 0.4);
      const r = rideTo(ev, dt, ev.w, { idle: { wave: true } }, () => {
        goal(ev, ev.to, 'Get the @witness@ to the *police station*. Lose the #thugs#.', dP(ev.to.x, ev.to.z) * 1.4 / 12 + 40);
        const v = ev.ride.v;
        for (let i = 0; i < ev.V.n; i++) { const a = v.h + Math.PI + (i - 1) * 0.5, x = v.x + Math.sin(a) * 28, z = v.z + Math.cos(a) * 28; if (!W.isLand(x, z)) continue; const t = person(ev, 'crook', x, z, a + Math.PI, null, 1); t.temper = ev.V.gun || i === 0 ? 'gunman' : 'brawler'; provoke(t); }
      });
      if (r === 'there') return win(ev, ev.V.cash + Math.min(ev.V.cash, Math.max(0, timeLeft(ev)) * 2), 'You got the witness to the police', 'WITNESS PROTECTED');
      if (r) return fail(ev, r === 'left' ? 'You left the witness behind.' : 'The witness was hurt.');
      if (ev.ride && timeLeft(ev) <= 0) { dropOff(ev); return fail(ev, 'The witness got cold feet.'); }
      if (!ev.ride && (!live(ev.w) || ev.st > 90)) fail(ev, '');
    },
  },
  { // ---------- help someone across the street ----------
    id: 'crossing', theme: 'help', name: 'Elderly crossing', weight: 0.8, when: (c) => (c.night ? 0.3 : 1.2),
    variants: [{ who: 'Mrs. Kowalski', cash: 60 }, { who: 'Mr. Jensen', cash: 70 }, { who: 'Grandma Ruth', cash: 80 }, { who: 'Old Man Dietz', cash: 50, grump: true }],
    start(ev) {
      const p = spot(50, 130); if (!p || p.e.width < 7 || p.e.width > 18) return false;
      ev.w = person(ev, 'elderly', p.x, p.z, Math.atan2(-p.nx, -p.nz));
      const across = p.e.width + 2.4;
      ev.to = { x: p.x - p.nx * across, z: p.z - p.nz * across };
      ev.x = p.x; ev.z = p.z; ev.goal = `Help @${ev.V.who}@ cross the street.`;
      return true;
    },
    update(ev, dt) {
      const w = ev.w;
      if (stopped(w)) return fail(ev, ev.go ? `${ev.V.who} took a tumble. Ouch.` : '');
      if (!ev.go) {
        pose(w, { cane: !!w.cane }, 0); chatter(w, ev.V.grump ? ['Darn cars!', 'In my day we had horses!', 'Nobody stops anymore!', 'Hmph!'] : ['Oh dear, so many cars...', 'Could someone help me?', 'My eyes aren\'t what they were.', 'Young man? Young lady?'], dt, 0.3);
        if (stay(ev, w.x, w.z, 2.5, 1, dt)) { ev.go = true; shout(w, ['Oh, thank you, dear.', 'What a nice young person!', 'Fine. Hold my arm.']); }
      } else {
        if (dP(w.x, w.z) < 5) { if (goTo(w, ev.to.x, ev.to.z, 0.85, dt, 0.5) < 0.6) { shout(w, ev.V.grump ? ['Took you long enough. Thanks.', 'Here, buy yourself a haircut.'] : THANKS); return win(ev, money(ev.V.cash * 0.8, ev.V.cash * 1.2), `You helped ${ev.V.who} cross the street`); } pose(w, { cane: !!w.cane }); }
        else { pose(w, {}, 0); chatter(w, ['Wait for me, dear!', 'Where did you go?', 'Hello?'], dt, 0.5); }
        ev.x = w.x; ev.z = w.z;
      }
      if (ev.st > 120) fail(ev, '');
    },
  },
  { // ---------- lost wallet: give it back (or don't) ----------
    id: 'wallet', theme: 'help', name: 'Lost wallet', weight: 0.8,
    variants: [{ cash: 120, keep: 80, nice: true }, { cash: 15, keep: 60, nice: false }, { cash: 200, keep: 150, nice: true, rich: true }],
    start(ev) {
      const p = spot(50, 120); if (!p) return false;
      ev.h = p.h + (chance(0.5) ? 0 : Math.PI);
      ev.wal = prop(ev, PROPS.wallet, p.x, p.z, Math.random() * 6);
      ev.mk = marker(ev, p.x, p.z, 0x7cf29a, 0.5, 0.6);
      ev.o = person(ev, ev.V.rich ? 'office' : pick(['walk', 'shopper', 'student']), p.x + Math.sin(ev.h) * 14, p.z + Math.cos(ev.h) * 14, ev.h);
      ev.x = p.x; ev.z = p.z; ev.wx = p.x; ev.wz = p.z; ev.goal = 'Someone dropped a *wallet*.';
      return true;
    },
    update(ev, dt) {
      const o = ev.o;
      if (!live(o)) return fail(ev, '');
      if (!ev.got) {
        ev.h = move(o, ev.h, 1.1, dt); pose(o, { phone: true });
        if (dP(ev.wx, ev.wz) < (K.P.foot ? 1.6 : 3)) { ev.got = true; ev.wal.visible = false; dropMarker(ev, ev.mk); mission(ev, 'Return the wallet to its @owner@.'); }
        if (ev.st > 120) fail(ev, '');
        return;
      }
      ev.x = o.x; ev.z = o.z;
      if (o.mode === 'script' && !ev.met) { ev.h = move(o, ev.h, 1.1, dt); pose(o, { phone: true }); }
      if (dP(o.x, o.z) < 3) {
        ev.met = true; pose(o, {}, 0); face(o, K.P.x, K.P.z, dt);
        shout(o, ev.V.nice ? ['My wallet! Thank you!', 'You are a saint!', 'Here, take this. Really!'] : ['Oh. Thanks. Here\'s... a five.', "Is everything still in here? Hmm.", 'Took you long enough.']);
        return win(ev, money(ev.V.cash * 0.8, ev.V.cash * 1.2), ev.V.nice ? 'You returned a lost wallet' : 'You returned a lost wallet. Cheapskate.', 'GOOD SAMARITAN');
      }
      if (dP(o.x, o.z) > 220) win(ev, money(ev.V.keep * 0.7, ev.V.keep * 1.3), 'You kept a lost wallet', 'FINDERS KEEPERS');
    },
  },
  { // ---------- carjacked: get their car back ----------
    id: 'carback', theme: 'help', name: 'Stolen car', weight: 0.7,
    variants: [{ ti: V.SEDAN, cash: 260, name: 'Betsy' }, { ti: V.CONVERTIBLE, cash: 320, name: 'my baby' }, { ti: V.MINIVAN, cash: 240, name: 'the minivan' }, { ti: V.MUSCLE, cash: 340, name: "my dad's Charger" }],
    start(ev) {
      const L = lane(70, 140); if (!L) return false;
      const e = L.q.e, off = e.width / 2 + 1.2;
      ev.o = person(ev, pick(['office', 'walk', 'elderly', 'shopper']), L.q.x - Math.cos(L.h) * off, L.q.z + Math.sin(L.h) * off, L.h);
      ev.v = car(ev, ev.V.ti, L.x + Math.sin(L.h) * 6, L.z + Math.cos(L.h) * 6, L.h); ev.v.npcDriver = true;
      if (!drive(ev.v, 300)) return false;
      ev.x = L.x; ev.z = L.z; ev.goal = `Someone stole @their@ car. Get *${ev.V.name}* back.`;
      return true;
    },
    update(ev, dt) {
      const { o, v } = ev;
      if (v.exploded || v.hp <= 0) return fail(ev, 'The car is wrecked.');
      if (!ev.back) {
        if (live(o) && o.mode === 'script') { face(o, v.x, v.z, dt); pose(o, { point: true }); chatter(o, ['They took my car!', `Not ${ev.V.name}!`, 'Somebody stop them!', 'Please, get it back!', 'I just washed it!'], dt, 0.5); }
        if (v.ag) v.ag.panicT = Math.max(v.ag.panicT, 5);
        ev.x = v.x; ev.z = v.z;
        if (v === K.P.veh) { ev.back = true; ev.dest = { x: o.x, z: o.z }; mission(ev, `Return the car to its @owner@.`); }
        else if (carGone(v) || dP(v.x, v.z) > 420) fail(ev, 'The car thief got away.');
        return;
      }
      if (!live(o)) return fail(ev, '');
      ev.dest = { x: o.x, z: o.z }; ev.x = o.x; ev.z = o.z;
      if (live(o) && o.mode === 'script') { pose(o, { wave: true }, 0); face(o, v.x, v.z, dt); }
      if (K.P.veh === v && Math.hypot(v.x - o.x, v.z - o.z) < 10 && Math.abs(v.speed || 0) < 2.5) { shout(o, [`${ev.V.name}! You're back!`, 'You found it!', THANKS[0], 'I could kiss you! I won\'t. But I could.']); return win(ev, money(ev.V.cash * 0.85, ev.V.cash * 1.15) - dented({ ride: { hp: v.T.hp, v } }) * 0.5, 'You got a stolen car back'); }
      if (K.P.veh !== v && dP(v.x, v.z) > 150) fail(ev, 'You stole the stolen car. Classic.');
    },
  },
];
