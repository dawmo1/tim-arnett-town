// What people wear. A look is a short array of small numbers (cheap to send over the network):
// [2, body, face, skin, hair, hairCol, top, topA, topB, bottom, botCol, shoes, shoeCol, hat, hatCol,
//  glasses, beard, tattoo, mask, accent]
// Colours are palette indices. Old looks ([skin, shirt, pants, hair, style] with hex colours) still work.

export const BODIES = ['base', 'heavy', 'slim', 'female', 'muscle'];
export const SKIN = [0xf6d3bd, 0xeec1a0, 0xe0ac84, 0xc98e66, 0xa8714d, 0x8a5636, 0x6a3f27, 0x4a2b1b];
export const HAIRC = [0x14110f, 0x2b1b12, 0x4a2c1a, 0x6b3f22, 0x8e5a2b, 0xc89b52, 0xe1c78f, 0x7c7c7c, 0xd8d8d8, 0x7a1f1f, 0xd84d9b, 0x2f6fd6];
export const CLOTH = [0xf2f2f0, 0x1a1a1c, 0x5d6166, 0x9ea3a8, 0x1f2c4f, 0x2d5aa8, 0x7fb0dd, 0xb3232b, 0x6b1d2a, 0x2f7a3f, 0x5b6b34,
  0xc2b48a, 0x8f6a45, 0x5a3b26, 0xe8c547, 0xe0782c, 0xe48bb0, 0x6a3f99, 0x24868c, 0x3a5a86, 0xd9d1c0, 0x2a2f36, 0x90a4ae, 0x8e2b8e];
export const TOPS = ['tee', 'tank', 'polo', 'shirt_s', 'shirt_l', 'hoodie', 'zip', 'suit', 'sweater', 'flannel', 'track', 'blouse',
  'police', 'medic', 'fire', 'swat', 'hivis', 'varsity', 'coat', 'mascot'];
export const BOTTOMS = ['jeans', 'slacks', 'shorts', 'cargo', 'sweats', 'police', 'work', 'fire', 'skirt', 'mascot'];
export const SHOES = ['sneaker', 'dress', 'boot'];
export const HAIRS = [null, 'short', 'crew', 'buzz', 'curly', 'afro', 'mohawk', 'balding', 'long', 'bob', 'shoulder', 'pony', 'bun', 'dreads'];
export const HATS = [null, 'cap', 'beanie', 'police', 'hard', 'fire', 'swat'];
export const GLASSES = [null, 'shades', 'clear'];
export const BEARDS = [null, 'full', 'goatee', 'mustache'];
export const MASKS = [null, 'ski', 'tim', 'mascot'];
export const FACES = 10; // 0-5 men, 6-9 women

const R = (r) => (a) => (Array.isArray(a) ? a[Math.floor(r() * a.length)] : Math.floor(r() * a));
const ix = (list, v) => list.indexOf(v);

export function randomLook(r = Math.random, opts = {}) {
  const pick = R(r);
  const female = opts.female ?? r() < 0.48;
  const body = female ? 3 : pick([0, 0, 0, 1, 1, 2, 4]);
  const old = opts.old ?? r() < 0.12;
  const skin = pick(8);
  const dark = skin >= 5;
  let hair = female ? pick(['long', 'long', 'bob', 'shoulder', 'pony', 'bun', 'curly', dark ? 'afro' : 'short', dark ? 'dreads' : 'long'])
    : pick(['short', 'short', 'crew', 'crew', 'buzz', 'curly', dark ? 'afro' : 'short', 'balding', old ? 'balding' : 'short', dark ? 'dreads' : 'crew', r() < 0.1 ? 'mohawk' : null]);
  let hairCol = old ? pick([7, 8, 7]) : dark ? pick([0, 0, 1]) : pick([0, 1, 2, 3, 4, 5, 6, 1, 2, r() < 0.05 ? 10 : 11, 2]);
  if (r() < 0.04) hairCol = pick([9, 10, 11]);
  const top = pick(female ? ['tee', 'tank', 'blouse', 'blouse', 'sweater', 'hoodie', 'zip', 'polo', 'coat', 'shirt_l', 'varsity']
    : ['tee', 'tee', 'tee', 'tank', 'polo', 'shirt_s', 'shirt_l', 'hoodie', 'zip', 'sweater', 'flannel', 'track', 'varsity', 'coat']);
  const bottom = pick(female ? ['jeans', 'jeans', 'skirt', 'slacks', 'shorts', 'sweats'] : ['jeans', 'jeans', 'jeans', 'slacks', 'shorts', 'cargo', 'sweats']);
  const hat = r() < 0.18 ? pick(['cap', 'cap', 'beanie']) : null;
  return [2, body, female ? 6 + pick(4) : pick(6), skin, ix(HAIRS, hair), hairCol, ix(TOPS, top), pick(CLOTH.length), pick(CLOTH.length),
    ix(BOTTOMS, bottom), pick([4, 4, 5, 1, 2, 11, 12, 21, 19, 13]), pick([0, 0, 0, 1, 2]), pick([0, 1, 1, 2, 13, 7, 4]),
    ix(HATS, hat), pick(CLOTH.length), r() < 0.15 ? pick([1, 1, 2]) : 0, !female && r() < 0.3 ? pick([1, 1, 2, 3]) : 0,
    r() < 0.08 ? 1 : 0, 0, pick(CLOTH.length)];
}

// Looks for jobs and roles. `r` is a random function.
export function roleLook(role, r = Math.random) {
  const L = randomLook(r, role === 'elderly' ? { old: true } : {});
  const pick = R(r), set = (k, v) => { L[k] = v; };
  const top = (n) => set(6, ix(TOPS, n)), bot = (n) => set(9, ix(BOTTOMS, n)), hat = (n) => set(13, ix(HATS, n));
  switch (role) {
    case 'office': top(pick(['suit', 'shirt_l', 'shirt_l', 'blouse'])); bot('slacks'); set(10, pick([1, 21, 2, 4])); set(11, 1); set(12, pick([1, 13])); set(7, pick([1, 21, 4, 2, 19])); set(8, pick([0, 6, 20, 7])); hat(null); break;
    case 'worker': top('hivis'); bot('work'); set(11, 2); hat('hard'); set(14, pick([14, 15, 0])); set(7, pick([15, 14])); break;
    case 'mail': top('shirt_s'); set(7, 6); bot('shorts'); set(10, 4); hat('cap'); set(14, 4); break;
    case 'jogger': top(pick(['tank', 'tee'])); bot(pick(['shorts', 'sweats'])); set(11, 0); set(7, pick([16, 6, 14, 0, 1, 15])); set(16, 0); break;
    case 'vendor': top('tee'); set(7, 0); bot('jeans'); hat('cap'); set(14, 7); break;
    case 'police': top('police'); bot('police'); set(11, 1); set(12, 1); hat('police'); set(15, r() < 0.3 ? 1 : 0); set(16, r() < 0.2 ? 3 : 0); break;
    case 'swat': top('swat'); bot('police'); set(10, 21); set(11, 2); set(12, 1); hat('swat'); set(15, 1); set(16, 0); break;
    case 'medic': top('medic'); bot('slacks'); set(10, 4); set(11, 0); hat(null); break;
    case 'fire': top('fire'); bot('fire'); set(11, 2); set(12, 1); hat('fire'); break;
    case 'elderly': top(pick(['sweater', 'shirt_l', 'coat', 'blouse'])); bot(pick(['slacks', 'slacks', 'skirt'])); if (L[1] !== 3 && L[9] === ix(BOTTOMS, 'skirt')) bot('slacks'); set(15, r() < 0.5 ? 2 : 0); break;
    case 'preacher': top('suit'); set(7, 1); set(8, 0); bot('slacks'); set(10, 1); set(11, 1); set(12, 1); hat(null); break;
    case 'protest': top(pick(['tee', 'hoodie'])); hat(r() < 0.3 ? 'beanie' : null); break;
    case 'skater': top(pick(['hoodie', 'tee', 'tank'])); bot(pick(['shorts', 'cargo', 'jeans'])); hat(pick(['beanie', 'cap', null])); set(11, 0); break;
    case 'mascot': top('mascot'); bot('mascot'); set(18, 3); set(4, 0); hat(null); set(15, 0); set(16, 0); break;
    case 'bar': top(pick(['flannel', 'tee', 'shirt_s', 'blouse', 'zip'])); break;
    case 'student': top(pick(['hoodie', 'tee', 'varsity', 'zip'])); bot(pick(['jeans', 'sweats', 'shorts'])); break;
    case 'crook': top(pick(['hoodie', 'zip', 'tee'])); set(7, pick([1, 21, 2])); bot(pick(['jeans', 'sweats'])); set(10, 1); hat(pick(['beanie', null, 'cap'])); set(14, 1); break;
    default: break;
  }
  if (L[1] === 3 && L[16]) L[16] = 0;
  return L;
}
export const isFemale = (L) => L[1] === 3;

// convert an old look ([skin, shirt, pants, hair, styleBits] with hex colours) to the new kind
const near = (pal, hex) => { let b = 0, bd = 1e9; const r = (hex >> 16) & 255, g = (hex >> 8) & 255, bl = hex & 255; pal.forEach((c, i) => { const d = (r - ((c >> 16) & 255)) ** 2 + (g - ((c >> 8) & 255)) ** 2 + (bl - (c & 255)) ** 2; if (d < bd) { bd = d; b = i; } }); return b; };
export function normLook(look, r = Math.random) {
  if (Array.isArray(look) && look[0] === 2 && look.length >= 20) return look;
  if (!Array.isArray(look) || look.length < 5) return randomLook(r);
  const [skin, shirt, pants, hair, style] = look;
  const L = randomLook(r, { female: false });
  L[3] = near(SKIN, skin); L[7] = near(CLOTH, shirt); L[10] = near(CLOTH, pants); L[5] = near(HAIRC, hair);
  const hatType = style & 3; L[13] = hatType === 1 ? 1 : hatType === 2 ? 2 : 0;
  if ((style >> 2) & 1) L[9] = ix(BOTTOMS, 'shorts');
  L[15] = ((style >> 3) & 3) === 0 ? 1 : 0;
  if (((style >> 6) & 3) === 0) L[6] = ix(TOPS, 'tank');
  return L;
}
export const lookKey = (L) => L.join(',');
