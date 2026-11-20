// Minigames: slots, blackjack, roulette, darts and pool as full-screen GTA-style overlays.
// start(kind, opts) -> Promise<{ won, net }>. While one is open it owns the keyboard and mouse;
// the world keeps rendering behind a dim backdrop. Money goes through economy.js (spend / addCash).
import { eco, spend, addCash } from '../economy.js';
import { el, money, sfx } from './core.js';
import slots from './slots.js';
import blackjack from './blackjack.js';
import roulette from './roulette.js';
import darts from './darts.js';
import pool from './pool.js';

const GAMES = {
  slots: { make: slots, title: 'Arnett Slots', sub: 'Riverboat Casino', bets: [10, 50, 100, 500] },
  blackjack: { make: blackjack, title: 'Blackjack', sub: 'Riverboat Casino', bets: [10, 50, 100, 500] },
  roulette: { make: roulette, title: 'Roulette', sub: 'Riverboat Casino · European wheel', bets: [10, 50, 100, 500], chips: true },
  darts: { make: darts, title: 'Darts', sub: '301 · straight out', bets: [0, 10, 50, 100, 500] },
  pool: { make: pool, title: '8-Ball', sub: 'Pool · solids and stripes', bets: [0, 10, 50, 100, 500] },
};

let cur = null; // { kind, leave }
// main.js checks this so the pointer unlock a minigame causes doesn't open the pause menu
export const isOpen = () => !!cur;
// Force-close whatever is open (player died, got arrested...): bets still on the table or mid-round are refunded.
export function close() { cur?.leave(true); }

export function start(kind, opts = {}) {
  const def = GAMES[kind];
  if (!def) return Promise.reject(new Error('Unknown minigame: ' + kind));
  if (cur) return Promise.resolve({ won: false, net: 0 });
  return new Promise((resolve) => open(kind, def, opts, resolve));
}

function open(kind, def, opts, resolve) {
  const root = el('div', 'mg', `
    <div class="mg-panel mg-k-${kind}" role="dialog" aria-label="${def.title}">
      <h2 class="mg-title"></h2>
      <div class="mg-sub"><span class="mg-subt"></span><span class="mg-cash"></span></div>
      <div class="mg-body"></div>
      <div class="mg-msg" aria-live="polite"></div>
      <div class="mg-foot"><div class="mg-bets"></div><div class="mg-keys"></div><button class="mg-leave" type="button">Leave <kbd>Esc</kbd></button></div>
    </div>`);
  const $ = (s) => root.querySelector(s);
  $('.mg-title').textContent = opts.title || def.title;
  $('.mg-subt').textContent = def.sub;
  const cashEl = $('.mg-cash'), msgEl = $('.mg-msg'), betsEl = $('.mg-bets');

  // ---------- bet selector ----------
  const bets = def.bets;
  const want = opts.bet ?? bets[1]; // closest preset to what the caller asked for
  let betI = bets.reduce((bi, b, i) => (Math.abs(b - want) < Math.abs(bets[bi] - want) ? i : bi), 0);
  betsEl.innerHTML = `<span>${def.chips ? 'Chip' : 'Bet'}</span>` + bets.map((b, i) => `<button type="button" data-i="${i}">${b ? money(b) : 'Free'}</button>`).join('');
  const betBtns = [...betsEl.querySelectorAll('button')];
  const showBet = () => betBtns.forEach((b, i) => b.classList.toggle('on', i === betI));
  betBtns.forEach((b) => b.addEventListener('click', () => { if (!ctx.betLocked) { betI = +b.dataset.i; showBet(); sfx.chip(); ctx.onBet?.(); } }));
  showBet();

  let net = 0, wins = 0, losses = 0, msgTimer = 0;
  const ctx = {
    kind, opts, root, body: $('.mg-body'), busy: false, betLocked: false, closed: false,
    get bet() { return bets[betI]; },
    cash: () => eco.cash,
    charge(n) { if (n <= 0) return true; if (!spend(n)) { ctx.say(`Not enough cash (${money(n)})`, 'bad'); sfx.lose(); return false; } net -= n; return true; },
    pay(n, why) { if (n <= 0) return; addCash(n, why); net += n; },
    result(won) { won ? wins++ : losses++; },
    lockBet(b) { ctx.betLocked = b; betsEl.classList.toggle('locked', b); },
    keys(html) { $('.mg-keys').innerHTML = html; },
    say(text, tone = '', ms = 0) {
      msgEl.innerHTML = text; msgEl.className = 'mg-msg ' + tone;
      clearTimeout(msgTimer); if (ms) msgTimer = setTimeout(() => { msgEl.textContent = ''; }, ms);
    },
  };

  const game = def.make(ctx);

  // ---------- input takeover ----------
  const onKey = (e) => {
    e.stopPropagation(); // main.js listens on window in the bubble phase; keep the player still
    if (e.repeat && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.key === 'Escape') { e.preventDefault(); leave(); return; }
    if (game.key?.(e)) { e.preventDefault(); return; }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !ctx.betLocked) {
      e.preventDefault(); betI = Math.max(0, Math.min(bets.length - 1, betI + (e.key === 'ArrowLeft' ? -1 : 1))); showBet(); sfx.click(); ctx.onBet?.();
    }
    if (e.code === 'Space') e.preventDefault();
  };
  const onKeyUp = (e) => game.keyup?.(e);
  const stop = (e) => e.stopPropagation();
  addEventListener('keydown', onKey, true);
  addEventListener('keyup', onKeyUp, true);
  for (const t of ['mousedown', 'mouseup', 'click', 'mousemove', 'wheel', 'contextmenu', 'pointerdown', 'pointerup']) root.addEventListener(t, stop);
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  // clicked buttons don't keep focus, or the next Space would press them again (Space after clicking Hit = another hit)
  root.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  $('.mg-leave').addEventListener('click', () => leave());

  dispatchEvent(new Event('blur')); // main.js clears held keys and the fire button on blur
  document.exitPointerLock?.();
  document.body.append(root);
  root.tabIndex = -1; root.focus({ preventScroll: true });

  let last = performance.now(), raf = 0, shownCash = -1;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (eco.cash !== shownCash) { shownCash = eco.cash; cashEl.textContent = money(eco.cash); }
    game.frame?.(dt, now / 1000);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  cur = { kind, leave };

  function leave(forced = false) {
    if (ctx.closed) return;
    if (ctx.busy && !forced) { ctx.say('Hang on, let it finish', 'bad', 1500); return; }
    ctx.closed = true;
    game.close?.(forced); // refunds unplayed chips; Esc forfeits a game in progress, a forced close refunds it
    cancelAnimationFrame(raf); clearTimeout(msgTimer);
    removeEventListener('keydown', onKey, true);
    removeEventListener('keyup', onKeyUp, true);
    root.remove(); cur = null;
    // give the mouse back to the game. Leave-button clicks get it; Esc isn't a user gesture so the browser refuses,
    // and the next click on the game canvas grabs it (main.js) instead of a pause menu popping up
    if (!forced) try { document.getElementById('game')?.requestPointerLock?.()?.catch?.(() => {}); } catch { /* not allowed here */ }
    resolve({ won: wins > losses || (wins === losses && net > 0), net });
  }
}
