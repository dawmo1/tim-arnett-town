// Shared settings for the Davenport map build.
// Playable area: downtown + riverfront, East Village, Vander Veer, Brady/Harrison/Main up to Kimberly Rd
// and NorthPark, and west Davenport out to about Division St. The bbox is a little larger for scenery.
export const BBOX = { s: 41.508, w: -90.642, n: 41.568, e: -90.540 };
// Local metres: origin downtown (3rd & Main), x = east, z = south.
export const ORIGIN = { lat: 41.5236, lon: -90.5776 };
export const TILE = 200; // metres per streamed tile
const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LON = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
export const project = (lat, lon) => [(lon - ORIGIN.lon) * M_PER_DEG_LON, -(lat - ORIGIN.lat) * M_PER_DEG_LAT];
export const unproject = (x, z) => [ORIGIN.lat - z / M_PER_DEG_LAT, ORIGIN.lon + x / M_PER_DEG_LON];
