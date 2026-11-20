// Roulette: European single-zero wheel drawn on canvas, ball spirals in and bounces into the pocket.
// Chips go on numbers, red/black, odd/even, 1-18/19-36 and the dozens; they're paid for when placed.
import { canvas, el, money, sfx, PD, BC } from './core.js';

export const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const color = (n) => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black');
// what a bet returns per chip (stake included) when n comes up
export function returns(k, n) {
  if (k[0] === 'n') return +k.slice(1) === n ? 36 : 0;
  if (n === 0) return 0;
  const hit = { red: REDS.has(n), black: !REDS.has(n), odd: n % 2 === 1, even: n % 2 === 0, low: n <= 18, high: n >= 19,
    d1: n <= 12, d2: n > 12 && n <= 24, d3: n > 24 }[k];
  return hit ? (k[0] === 'd' ? 3 : 2) : 0;
}
const LABEL = { red: 'Red', black: 'Black', odd: 'Odd', even: 'Even', low: '1 to 18', high: '19 to 36', d1: '1st 12', d2: '2nd 12', d3: '3rd 12' };

const S = 440, C = S / 2, TAU = Math.PI * 2, STEP = TAU / 37;
const R_TRACK = 194, R_NUM_OUT = 178, R_NUM_IN = 146, R_POCKET = 128, R_CONE = 108;
const pt = (a, r) => [C + Math.sin(a) * r, C - Math.cos(a) * r];

function drawWheel() {
  const [c, g] = canvas(S, S);
  // wooden bowl and ball track
  let gr = g.createRadialGradient(C, C, 150, C, C, 218); gr.addColorStop(0, '#2a1608'); gr.addColorStop(0.6, '#6b3b17'); gr.addColorStop(1, '#2a1406');
  g.fillStyle = gr; g.beginPath(); g.arc(C, C, 218, 0, TAU); g.fill();
  gr = g.createRadialGradient(C, C, R_NUM_OUT, C, C, 204); gr.addColorStop(0, '#3b2416'); gr.addColorStop(0.5, '#8a6a4a'); gr.addColorStop(1, '#3b2416');
  g.fillStyle = gr; g.beginPath(); g.arc(C, C, 204, 0, TAU); g.fill();
  for (let i = 0; i < 37; i++) {
    const n = ORDER[i], a0 = i * STEP - STEP / 2, a1 = a0 + STEP;
    // number ring
    g.fillStyle = { green: '#14833b', red: '#b8141c', black: '#141414' }[color(n)];
    g.beginPath(); g.arc(C, C, R_NUM_OUT, a0 - Math.PI / 2, a1 - Math.PI / 2); g.arc(C, C, R_POCKET, a1 - Math.PI / 2, a0 - Math.PI / 2, true); g.closePath(); g.fill();
    g.save(); g.translate(...pt(i * STEP, (R_NUM_OUT + R_NUM_IN) / 2)); g.rotate(i * STEP);
    g.fillStyle = '#fff'; g.font = `600 17px ${BC}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 0, 1); g.restore();
    // frets
    g.strokeStyle = '#d9c38a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(...pt(a0, R_CONE)); g.lineTo(...pt(a0, R_NUM_OUT)); g.stroke();
  }
  g.strokeStyle = '#d9c38a'; g.lineWidth = 2;
  for (const r of [R_NUM_OUT, R_NUM_IN, R_POCKET]) { g.beginPath(); g.arc(C, C, r, 0, TAU); g.stroke(); }
  // pocket floor shading
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(C, C, R_NUM_IN, 0, TAU); g.arc(C, C, R_POCKET, 0, TAU, true); g.fill();
  // cone and turret
  gr = g.createRadialGradient(C - 20, C - 20, 5, C, C, R_CONE); gr.addColorStop(0, '#a5703c'); gr.addColorStop(1, '#3d2210');
  g.fillStyle = gr; g.beginPath(); g.arc(C, C, R_CONE, 0, TAU); g.fill();
  g.strokeStyle = '#e6c56a'; g.lineWidth = 7; g.lineCap = 'round';
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; g.beginPath(); g.moveTo(C, C); g.lineTo(...pt(a, 54)); g.stroke(); g.fillStyle = '#e6c56a'; g.beginPath(); g.arc(...pt(a, 54), 7, 0, TAU); g.fill(); }
  gr = g.createRadialGradient(C - 6, C - 6, 2, C, C, 20); gr.addColorStop(0, '#fff3c0'); gr.addColorStop(1, '#a77b1d');
  g.fillStyle = gr; g.beginPath(); g.arc(C, C, 18, 0, TAU); g.fill();
  return c;
}

export default function roulette(ctx) {
  const [cv, g] = canvas(S, S, 'mg-wheel');
  const wheelImg = drawWheel();
  const board = el('div', 'mg-rt-board');
  const side = el('div', 'mg-side mg-actions');
  const right = el('div', 'mg-rt-right');
  right.append(board, side);
  ctx.body.append(cv, right);
  ctx.keys('<kbd>Click</kbd> Place chip <kbd>Right-click</kbd> Remove <kbd>Space</kbd> Spin <kbd>R</kbd> Rebet <kbd>C</kbd> Clear');

  // ---------- betting table ----------
  const cells = {};
  const cell = (k, label, cls, col, row, span = 1, rows = 1) => {
    const b = el('button', 'mg-rt-cell ' + cls, `<span>${label}</span>`); b.type = 'button';
    b.style.gridColumn = `${col} / span ${span}`; b.style.gridRow = `${row} / span ${rows}`;
    b.addEventListener('click', () => place(k, 1));
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); place(k, -1); });
    board.append(b); cells[k] = b;
  };
  cell('n0', '0', 'green', 1, 1, 1, 3);
  for (let n = 1; n <= 36; n++) cell('n' + n, n, color(n), 2 + Math.floor((n - 1) / 3), 3 - ((n - 1) % 3));
  ['d1', 'd2', 'd3'].forEach((k, i) => cell(k, LABEL[k], 'out', 2 + i * 4, 4, 4));
  ['low', 'even', 'red', 'black', 'odd', 'high'].forEach((k, i) => cell(k, k === 'red' || k === 'black' ? `<i class="mg-dia ${k}"></i>` : LABEL[k], 'out', 2 + i * 2, 5, 2));

  const btn = (label, key, fn) => { const b = el('button', 'mg-btn', `${label} <kbd>${key}</kbd>`); b.type = 'button'; b.addEventListener('click', fn); side.append(b); return b; };
  const spinB = btn('Spin', 'Space', spin), rebetB = btn('Rebet', 'R', rebet), clearB = btn('Clear', 'C', clear);
  const hist = el('div', 'mg-rt-hist'); side.append(hist);

  let bets = {}, lastBets = {}, spinning = false, result = null, resultT = 0;
  let W = 0, R = 0, ballR = R_TRACK, t = 0, target = 0, R0 = 0, Rf = 0, wBoost = 0, lastBounce = -1, ballShown = false;
  const staked = () => Object.values(bets).reduce((a, b) => a + b, 0);

  function show() {
    for (const [k, b] of Object.entries(cells)) {
      let chip = b.querySelector('.mg-chip');
      if (bets[k]) { if (!chip) { chip = el('i', 'mg-chip'); b.append(chip); } chip.textContent = bets[k] >= 1000 ? `${bets[k] / 1000}k` : bets[k]; } else chip?.remove();
    }
    const sum = staked();
    spinB.disabled = spinning || !sum; clearB.disabled = spinning || !sum; rebetB.disabled = spinning || !!sum || !Object.keys(lastBets).length;
    ctx.lockBet(spinning);
  }
  function place(k, dir) {
    if (spinning || ctx.closed) return;
    clearResult();
    if (dir > 0) { if (!ctx.charge(ctx.bet)) return; bets[k] = (bets[k] || 0) + ctx.bet; sfx.chip(); }
    else if (bets[k]) { const back = Math.min(bets[k], ctx.bet); bets[k] -= back; if (!bets[k]) delete bets[k]; ctx.pay(back); sfx.click(); }
    ctx.say(`On the table: <b class="mg-money">${money(staked())}</b>`);
    show();
  }
  function clear() { if (spinning) return; const s = staked(); if (s) ctx.pay(s); bets = {}; sfx.click(); ctx.say('Chips back in your pocket'); show(); }
  function rebet() {
    if (spinning || staked()) return;
    const sum = Object.values(lastBets).reduce((a, b) => a + b, 0);
    if (!sum || !ctx.charge(sum)) return;
    clearResult(); bets = { ...lastBets }; sfx.chip(); ctx.say(`Same again: <b class="mg-money">${money(sum)}</b>`); show();
  }
  function clearResult() { result = null; for (const b of Object.values(cells)) b.classList.remove('hit'); }

  function spin() {
    if (spinning || !staked() || ctx.closed) return;
    clearResult(); spinning = true; ctx.busy = true; show();
    const idx = Math.floor(Math.random() * 37); target = ORDER[idx];
    R0 = ballShown ? R : -W + Math.random() * TAU;
    const m = Math.ceil((idx * STEP - R0) / TAU + 7);
    Rf = idx * STEP - m * TAU; // ball runs against the wheel, many turns
    t = 0; wBoost = 2.6; lastBounce = -1; ballShown = true;
    ctx.say('No more bets');
  }
  function land() {
    spinning = false; ctx.busy = false;
    result = target; resultT = 0;
    let back = 0;
    for (const [k, v] of Object.entries(bets)) back += v * returns(k, target);
    const stake = staked();
    cells['n' + target].classList.add('hit');
    for (const k of Object.keys(LABEL)) if (returns(k, target)) cells[k].classList.add('hit');
    const name = `<b class="mg-rt-num ${color(target)}">${target}</b> ${target ? (REDS.has(target) ? 'Red' : 'Black') : 'Green'}`;
    if (back) { ctx.pay(back, 'Roulette'); ctx.say(`${name} · You win <b class="mg-money">${money(back)}</b>`, back > stake ? 'good' : ''); sfx.win(); }
    else { ctx.say(`${name} · House wins ${money(stake)}`, 'bad'); sfx.lose(); }
    lastBets = bets; bets = {};
    const h = el('b', 'mg-rt-num ' + color(target), target); hist.prepend(h); while (hist.children.length > 10) hist.lastChild.remove();
    show();
  }

  const easeOut = (u) => 1 - Math.pow(1 - u, 3);
  const TB = 5.4; // seconds until the ball drops into a pocket
  function frame(dt) {
    wBoost = Math.max(0, wBoost - dt * 0.38);
    W += (0.35 + wBoost) * dt;
    if (spinning) {
      t += dt; const u = Math.min(1, t / TB);
      R = R0 + (Rf - R0) * easeOut(u);
      // stay on the track, spiral down the bowl, rattle over the frets, then settle in the pocket
      if (u < 0.5) ballR = R_TRACK;
      else if (u < 0.68) { const k = (u - 0.5) / 0.18; ballR = R_TRACK - (R_TRACK - R_NUM_IN + 4) * k * k; }
      else if (u < 0.92) {
        const k = (u - 0.68) / 0.24, b = Math.abs(Math.sin(k * Math.PI * 5)) * 22 * (1 - k);
        ballR = R_POCKET + 6 + b;
        const n = Math.floor(k * 5); if (n !== lastBounce) { lastBounce = n; sfx.clack(0.6 * (1 - k)); }
      } else ballR = R_POCKET + 6;
      if (u >= 1) land();
    } else if (result != null) resultT += dt;
    draw();
  }
  function draw() {
    g.clearRect(0, 0, S, S);
    g.save(); g.translate(C, C); g.rotate(W); g.drawImage(wheelImg, -C, -C, S, S); g.restore();
    if (ballShown) {
      const [x, y] = pt(W + R, ballR);
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(x + 2, y + 3, 7, 0, TAU); g.fill();
      const gr = g.createRadialGradient(x - 2, y - 2, 1, x, y, 7); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#bfc4c8');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fill();
    }
    if (result != null && resultT > 0.3) {
      const a = Math.min(1, (resultT - 0.3) * 4);
      g.globalAlpha = a;
      g.fillStyle = { green: '#14833b', red: '#c0161f', black: '#111' }[color(result)];
      g.beginPath(); g.arc(C, C, 46, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#fff'; g.font = `54px ${PD}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(result, C, C + 3);
      g.globalAlpha = 1;
    }
  }

  show();
  ctx.say('Place your chips, then spin.');
  return {
    frame,
    key(e) {
      if (e.code === 'Space' || e.key === 'Enter') { spin(); return true; }
      if (e.code === 'KeyR') { rebet(); return true; }
      if (e.code === 'KeyC') { clear(); return true; }
      return false;
    },
    close() { if (staked()) ctx.pay(staked()); }, // chips still on the table go back (mid-spin only on a forced close)
  };
}
