// Darts: 301 straight out against a bar regular. Your aim wobbles (more when you're drunk);
// hold Shift or the right mouse button to steady your hand for a moment. Three darts a turn.
import { canvas, el, money, sfx, gauss, clamp, sleep, PD, BC } from './core.js';
// loaded lazily so the pure game logic can be checked under node (selftest.mjs) without three.js
let drunk = { lvl: 0 };
import('../drunk.js').then((m) => { drunk = m.drunk; }).catch(() => {});

export const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
// board radii in mm (regulation)
const BULL = 6.35, OUTER_BULL = 15.9, TR_IN = 99, TR_OUT = 107, DB_IN = 162, DB_OUT = 170, EDGE = 225;
export function scoreAt(x, y) { // mm from the centre, y down
  const d = Math.hypot(x, y);
  if (d <= BULL) return { pts: 50, label: 'BULL' };
  if (d <= OUTER_BULL) return { pts: 25, label: '25' };
  if (d > DB_OUT) return { pts: 0, label: 'MISS' };
  const deg = ((Math.atan2(x, -y) * 180) / Math.PI + 360 + 9) % 360, n = ORDER[Math.floor(deg / 18)];
  if (d >= TR_IN && d <= TR_OUT) return { pts: n * 3, label: 'T' + n };
  if (d >= DB_IN) return { pts: n * 2, label: 'D' + n };
  return { pts: n, label: String(n) };
}
const NPCS = [['Big Mike', 15], ['Darlene', 13], ['Quad City Kenny', 11], ['Old Walt', 17], ['Trish', 14]];

const S = 560, C = S / 2, K = 245 / EDGE; // px per mm
const toPx = (x, y) => [C + x * K, C + y * K];
const segPoint = (n, r) => { const a = (ORDER.indexOf(n) * 18 * Math.PI) / 180; return [Math.sin(a) * r, -Math.cos(a) * r]; };

function drawBoard() {
  const [c, g] = canvas(S, S);
  g.fillStyle = '#111'; g.beginPath(); g.arc(C, C, EDGE * K, 0, 7); g.fill();
  const ring = (r0, r1, a0, a1, col) => { g.fillStyle = col; g.beginPath(); g.arc(C, C, r1 * K, a0, a1); g.arc(C, C, r0 * K, a1, a0, true); g.closePath(); g.fill(); };
  for (let i = 0; i < 20; i++) {
    const a0 = ((i * 18 - 9 - 90) * Math.PI) / 180, a1 = a0 + (18 * Math.PI) / 180, even = i % 2 === 0;
    ring(OUTER_BULL, DB_OUT, a0, a1, even ? '#161616' : '#efe1bd');
    ring(TR_IN, TR_OUT, a0, a1, even ? '#c81e28' : '#17783a');
    ring(DB_IN, DB_OUT, a0, a1, even ? '#c81e28' : '#17783a');
    const [x, y] = toPx(...segPoint(ORDER[i], 196));
    g.fillStyle = '#f2f2f2'; g.font = `600 ${Math.round(26 * K * 1.6)}px ${BC}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ORDER[i], x, y);
  }
  g.fillStyle = '#17783a'; g.beginPath(); g.arc(C, C, OUTER_BULL * K, 0, 7); g.fill();
  g.fillStyle = '#c81e28'; g.beginPath(); g.arc(C, C, BULL * K, 0, 7); g.fill();
  // wire
  g.strokeStyle = 'rgba(210,210,210,.75)'; g.lineWidth = 1;
  for (const r of [BULL, OUTER_BULL, TR_IN, TR_OUT, DB_IN, DB_OUT]) { g.beginPath(); g.arc(C, C, r * K, 0, 7); g.stroke(); }
  for (let i = 0; i < 20; i++) { const a = ((i * 18 - 9) * Math.PI) / 180; g.beginPath(); g.moveTo(...toPx(Math.sin(a) * OUTER_BULL, -Math.cos(a) * OUTER_BULL)); g.lineTo(...toPx(Math.sin(a) * DB_OUT, -Math.cos(a) * DB_OUT)); g.stroke(); }
  return c;
}

// where the regular aims for a given remainder (straight out: any finish counts)
function npcTarget(rem) {
  if (rem > 60) return segPoint(20, (TR_IN + TR_OUT) / 2);
  if (rem === 50 || rem === 25) return [0, 0];
  if (rem <= 20) return segPoint(rem, 135);
  if (rem % 3 === 0 && rem <= 60) return segPoint(rem / 3, (TR_IN + TR_OUT) / 2);
  if (rem % 2 === 0 && rem <= 40) return segPoint(rem / 2, (DB_IN + DB_OUT) / 2);
  return segPoint(Math.min(20, rem - 20), 135); // set up a finish
}

export default function darts(ctx) {
  const [cv, g] = canvas(S, S, 'mg-dartboard');
  const boardImg = drawBoard();
  const [npcName, npcSigma] = NPCS[Math.floor(Math.random() * NPCS.length)];
  const side = el('div', 'mg-side mg-chalk', `
    <div class="mg-chalk-row" data-p0><span>You</span><b>301</b></div>
    <div class="mg-chalk-row" data-p1><span>${npcName}</span><b>301</b></div>
    <div class="mg-chalk-turn"></div>`);
  const startB = el('button', 'mg-btn mg-big', 'New game <kbd>Space</kbd>'); startB.type = 'button'; side.append(startB);
  ctx.body.append(cv, side);
  ctx.keys('<kbd>Mouse</kbd> Aim <kbd>Click</kbd> Throw <kbd>Shift</kbd>/<kbd>Right-click</kbd> Steady <kbd>Space</kbd> New game');

  let phase = 'ready', scores = [301, 301], turn = 0, turnStart = 301, darts = [], flying = null, stake = 0, gen = 0;
  let mouse = [0, 0], steady = false, breath = 1, tWob = 0, npcAim = null, pops = [];
  const turnEl = side.querySelector('.mg-chalk-turn');

  cv.addEventListener('mousemove', (e) => { const [x, y] = local(e); mouse = [x, y]; });
  cv.addEventListener('mousedown', (e) => { if (e.button === 2) steady = true; else if (e.button === 0) playerThrow(); });
  cv.addEventListener('mouseup', (e) => { if (e.button === 2) steady = false; });
  cv.addEventListener('mouseleave', () => { steady = false; });
  startB.addEventListener('click', newGame);
  function local(e) { const b = cv.getBoundingClientRect(), k = S / b.width; return [((e.clientX - b.left) * k - C) / K, ((e.clientY - b.top) * k - C) / K]; }

  function board() {
    side.querySelector('[data-p0] b').textContent = scores[0];
    side.querySelector('[data-p1] b').textContent = scores[1];
    side.querySelector('[data-p0]').classList.toggle('on', phase === 'play');
    side.querySelector('[data-p1]').classList.toggle('on', phase === 'npc');
    turnEl.innerHTML = darts.map((d) => `<span>${d.label}</span>`).join('') + (darts.length ? `<b>${darts.reduce((a, d) => a + d.pts, 0)}</b>` : '');
    startB.disabled = phase !== 'ready' && phase !== 'over';
    cv.style.cursor = phase === 'play' ? 'none' : 'default'; // the reticle is the cursor while you throw
  }
  function newGame() {
    if ((phase !== 'ready' && phase !== 'over') || ctx.closed) return;
    if (!ctx.charge(ctx.bet)) return;
    stake = ctx.bet; gen++; scores = [301, 301]; darts = []; turn = 0; turnStart = 301; phase = 'play';
    ctx.lockBet(true); sfx.chip();
    ctx.say(stake ? `${npcName} puts up ${money(stake)} too. First to zero takes ${money(stake * 2)}.` : `Friendly game with ${npcName}. First to zero wins.`);
    board();
  }

  function aimPoint() {
    const a = (6 + drunk.lvl * 26) * (steady && breath > 0 ? 0.28 : 1);
    return [mouse[0] + a * (Math.sin(tWob * 1.7) + 0.5 * Math.sin(tWob * 4.1 + 1.3)) / 1.5,
      mouse[1] + a * (Math.cos(tWob * 1.3 + 0.4) + 0.5 * Math.sin(tWob * 3.3)) / 1.5];
  }
  function playerThrow() {
    if (phase !== 'play' || flying || darts.length >= 3) return;
    const [x, y] = aimPoint();
    launch(0, x + gauss() * 2.5, y + gauss() * 2.5);
  }
  function launch(who, x, y) { flying = { who, x, y, t: 0 }; sfx.card(); }

  async function landed(f) {
    const s = scoreAt(f.x, f.y), d = { ...s, x: f.x, y: f.y, who: f.who, tilt: (Math.random() - 0.5) * 0.5 };
    darts.push(d); pops.push({ x: f.x, y: f.y, text: s.label === 'MISS' ? 'MISS' : `${s.label}${s.pts && s.label !== String(s.pts) ? ' · ' + s.pts : ''}`, t: 0 });
    s.pts ? sfx.dart() : sfx.thud();
    const left = scores[f.who] - s.pts, my = gen;
    if (left < 0) { ctx.say(`<b>Bust!</b> ${f.who ? npcName : 'You'} back on ${turnStart}`, 'bad', 1800); sfx.lose(); scores[f.who] = turnStart; board(); return endTurn(my); }
    scores[f.who] = left; board();
    if (left === 0) return finish(f.who === 0);
    if (darts.length >= 3) return endTurn(my);
  }
  async function endTurn(my) {
    const was = phase; phase = 'between'; board();
    await sleep(1100); if (ctx.closed || my !== gen) return;
    darts = []; turn = 1 - turn; turnStart = scores[turn];
    phase = turn ? 'npc' : 'play'; board();
    if (was !== 'npc' && turn === 1) npcTurn(my);
    else ctx.say('Your throw', '', 1200);
  }
  async function npcTurn(my) {
    ctx.say(`${npcName} steps up…`);
    for (let i = 0; i < 3; i++) {
      await sleep(700); if (ctx.closed || my !== gen || phase !== 'npc') return;
      const [tx, ty] = npcTarget(scores[1]);
      const gx = tx + gauss() * npcSigma * (1 + drunk.lvl * 0.2), gy = ty + gauss() * npcSigma;
      npcAim = { x: gx + gauss() * 30, y: gy + gauss() * 30, tx: gx, ty: gy, t: 0 };
      await sleep(650); if (ctx.closed || my !== gen || phase !== 'npc') return;
      npcAim = null; launch(1, gx, gy);
      await sleep(260); if (ctx.closed || my !== gen || phase !== 'npc') return;
    }
  }
  function finish(won) {
    phase = 'over'; ctx.lockBet(false); ctx.result(won);
    if (won) { if (stake) ctx.pay(stake * 2, 'Darts'); ctx.say(`<b>Game shot!</b> You beat ${npcName}${stake ? ` · <b class="mg-money">${money(stake * 2)}</b>` : ''}`, 'good'); sfx.win(); }
    else { ctx.say(`${npcName} checks out. ${stake ? `You lose ${money(stake)}.` : 'Rematch?'}`, 'bad'); sfx.lose(); }
    stake = 0; board();
  }

  function frame(dt) {
    tWob += dt * (1 + drunk.lvl * 0.6);
    breath = steady ? Math.max(0, breath - dt * 0.55) : Math.min(1, breath + dt * 0.3);
    if (flying) { flying.t += dt; if (flying.t >= 0.17) { const f = flying; flying = null; landed(f); } }
    if (npcAim) { npcAim.t = Math.min(1, npcAim.t + dt * 2); }
    pops = pops.filter((p) => (p.t += dt) < 1.2);
    draw();
  }
  function drawDart(x, y, who, tilt, scale = 1) {
    const [px, py] = toPx(x, y);
    g.save(); g.translate(px, py); g.rotate(0.5 + tilt); g.scale(scale, scale);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(4, 3, 3, 2, 0, 0, 7); g.fill();
    g.strokeStyle = '#c9c9c9'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -12); g.stroke();
    g.strokeStyle = '#333'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, -12); g.lineTo(0, -26); g.stroke();
    g.fillStyle = who ? '#e0393e' : '#3d8bff';
    g.beginPath(); g.moveTo(0, -24); g.lineTo(-7, -36); g.lineTo(0, -32); g.lineTo(7, -36); g.closePath(); g.fill();
    g.restore();
  }
  function draw() {
    const bg = g.createRadialGradient(C, C, 200, C, C, 420); bg.addColorStop(0, '#3a2a1c'); bg.addColorStop(1, '#120c07');
    g.fillStyle = bg; g.fillRect(0, 0, S, S);
    g.drawImage(boardImg, 0, 0, S, S);
    for (const d of darts) drawDart(d.x, d.y, d.who, d.tilt);
    if (flying) { const u = flying.t / 0.17; drawDart(flying.x, flying.y + (1 - u) * 140, flying.who, 0, 1 + (1 - u) * 1.6); }
    for (const p of pops) {
      const [x, y] = toPx(p.x, p.y);
      g.globalAlpha = 1 - Math.max(0, p.t - 0.7) / 0.5;
      g.font = `30px ${PD}`; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = '#000';
      g.strokeText(p.text, x, y - 30 - p.t * 30); g.fillStyle = p.text === 'MISS' ? '#ff6b6b' : '#fff'; g.fillText(p.text, x, y - 30 - p.t * 30);
      g.globalAlpha = 1;
    }
    if (npcAim) { const k = 1 - Math.pow(1 - npcAim.t, 3); reticle(npcAim.x + (npcAim.tx - npcAim.x) * k, npcAim.y + (npcAim.ty - npcAim.y) * k, '#ff5a5a'); }
    if (phase === 'play' && !flying) {
      const [x, y] = aimPoint(); reticle(x, y, steady && breath > 0 ? '#9cff9c' : '#fff');
      // breath meter
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(20, S - 30, 120, 12);
      g.fillStyle = breath > 0.25 ? '#72c472' : '#e5484d'; g.fillRect(22, S - 28, 116 * breath, 8);
      g.fillStyle = '#fff'; g.font = `600 14px ${BC}`; g.textAlign = 'left'; g.fillText(drunk.lvl > 0.3 ? 'STEADY (you\'ve been drinking)' : 'STEADY', 20, S - 36);
    }
    if (phase === 'ready' || phase === 'over') {
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, C - 40, S, 80);
      g.fillStyle = '#fff'; g.font = `38px ${PD}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(phase === 'ready' ? 'Press Space to play' : 'Space for a rematch', C, C); g.textBaseline = 'alphabetic';
    }
  }
  function reticle(x, y, col) {
    const [px, py] = toPx(clamp(x, -EDGE, EDGE), clamp(y, -EDGE, EDGE));
    g.strokeStyle = col; g.lineWidth = 2;
    g.beginPath(); g.arc(px, py, 10, 0, 7); g.moveTo(px - 16, py); g.lineTo(px - 5, py); g.moveTo(px + 5, py); g.lineTo(px + 16, py); g.moveTo(px, py - 16); g.lineTo(px, py - 5); g.moveTo(px, py + 5); g.lineTo(px, py + 16); g.stroke();
  }

  board();
  ctx.say(`${npcName} is waiting at the oche. Pick a bet, then Space.`);
  return {
    frame,
    key(e) {
      if (e.code === 'Space' || e.key === 'Enter') { if (phase === 'play') playerThrow(); else newGame(); return true; }
      if (e.key === 'Shift') { steady = true; return true; }
      return false;
    },
    keyup(e) { if (e.key === 'Shift') steady = false; },
    close(forced) { if (phase === 'play' || phase === 'npc' || phase === 'between') { gen++; forced ? ctx.pay(stake) : ctx.result(false); } },
  };
}
