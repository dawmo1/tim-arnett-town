// Shared settings for the map build.
// The whole Quad Cities region: Davenport (incl. the west edge), Bettendorf, Le Claire, Port Byron (IL), Rock Island,
// Moline, East Moline, Milan, Silvis, Colona, Coal Valley and Geneseo, plus the countryside between them.
export const BBOX = { s: 41.400, w: -90.720, n: 41.625, e: -90.120 };
// Overpass downloads are split into this grid of chunks (each about the size of the old Davenport-only map).
export const FETCH_GRID = { cols: 6, rows: 4 };
// Local metres: origin downtown Davenport (3rd & Main), x = east, z = south. Never change: every placed thing uses it.
export const ORIGIN = { lat: 41.5236, lon: -90.5776 };
export const TILE = 200; // metres per streamed tile
export const ROAD_CHUNK = 2000; // metres per road-graph chunk (data/roads/{cx}_{cz}.json)
const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LON = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
export const project = (lat, lon) => [(lon - ORIGIN.lon) * M_PER_DEG_LON, -(lat - ORIGIN.lat) * M_PER_DEG_LAT];
export const unproject = (x, z) => [ORIGIN.lat - z / M_PER_DEG_LAT, ORIGIN.lon + x / M_PER_DEG_LON];
