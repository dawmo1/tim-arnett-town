// Three made-up street gangs, each holding a neighbourhood. They hang out on their corners in
// their colours, deal, warn you off when you flash a weapon, fight you if you start something,
// and now and then two crews clash. There's no turf war for you to win; it's their patch.
export const GANGS = [
  { id: 'wolves', name: 'Westside Wolves', hood: 'West End', color: '#2aa7a2', cloth: 18, lat: 41.5195, lon: -90.6060, r: 520, cars: [14, 11] },
  { id: 'hounds', name: 'Hilltop Hounds', hood: 'Hilltop', color: '#e0782c', cloth: 15, lat: 41.5305, lon: -90.5760, r: 420, cars: [12, 14] },
  { id: 'kings', name: 'Kimberly Kings', hood: 'Kimberly Road', color: '#8a1f33', cloth: 8, lat: 41.5585, lon: -90.5870, r: 520, cars: [11, 16] },
];
// same projection as the map (src/city/data.js)
const M_LAT = 110574, M_LON = 111320 * Math.cos((41.5236 * Math.PI) / 180);
for (const g of GANGS) { g.x = (g.lon + 90.5776) * M_LON; g.z = -(g.lat - 41.5236) * M_LAT; }
export function turfAt(x, z) {
  for (const g of GANGS) if (g.x !== undefined && Math.hypot(x - g.x, z - g.z) < g.r) return g;
  return null;
}
export const gangById = (id) => GANGS.find((g) => g.id === id);
// their look: the crew colour on the top and the cap
export function gangLook(g, roleLook, r = Math.random) {
  const L = roleLook('crook', r);
  L[7] = g.cloth; L[14] = g.cloth;
  if (r() < 0.5) L[13] = 1; // cap
  if (r() < 0.5) L[6] = [5, 0, 17, 6][Math.floor(r() * 4)]; // hoodie, tee, varsity, zip
  return L;
}
const WARN = ['You lost?', 'This is our block.', 'Keep walking.', 'Wrong neighbourhood.', 'Put that away. Now.'];
export const warnLine = (g) => (Math.random() < 0.4 ? `${g.name} turf, pal.` : WARN[Math.floor(Math.random() * WARN.length)]);
