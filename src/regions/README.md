# Region modules

One module per town (`src/regions/<id>.js`) holds that town's real-world polish as plain data: business names,
street features and props, and Blender models. The core builder applies them; town agents never edit core files.

## How it loads

- `index.js` lists every region as `[id, x0, z0, x1, z1]`. Those bounds decide when the module loads, so town
  agents don't edit `index.js`. If you need a bigger box, say so in your report.
- The first time a tile within 300 m of a region's bounds is fetched, `src/city/data.js` imports the module.
  The tile waits for it, so names and places are there on the first build.
- A module that fails to load, or an entry with a bad shape, logs a warning and is skipped. It never breaks the map.

## Module shape

```js
export default {
  id: 'geneseo',                    // same as the file name and the index.js entry
  name: 'Geneseo',
  bounds: [x0, z0, x1, z1],         // same box as index.js
  names: [{ match, name }],
  places: [{ kind, ... }],
  models: [{ file, x, z, ... }],    // landmarks.js MODELS format
  notes: 'free text: sources, what is left to do',
};
```

Coordinates are game metres: x runs east, z runs south, and the origin is 3rd & Main in downtown Davenport.
To convert from lat/lon, use `project(lat, lon)` in `tools/map-config.mjs`.

### names

These override the name a building shows on its shop sign, pylon or big-box sign (`src/city/tile.js`).

- `match: 123456789`: the OSM way id of the building. Relations use `'r123'`. Every OSM building in the tile data
  carries its id as `extra.id`. Microsoft footprints have no id, so match those by position.
- `match: { x, z, r }`: the building whose centre is nearest to (x, z), within r metres (default 15).
- Give the real name. National chains are turned into parody names automatically (`src/city/names.js` PARODY).

### places

Point places go through the same checks as every other prop (`placeOff` in `src/city/detail.js`). A place on a
road carriageway or inside a junction is pushed to just past the kerb on its own side. One that is still on a road,
or inside a building, is dropped. `h` is the heading in radians (0 faces +z, south). If you leave it out, the place
faces the nearest road.

| kind | fields | notes |
|---|---|---|
| `sign` | x, z, h, text, style (`shop` / `street` / `pole`), w, height, lit | a post with a text panel |
| `statue` | x, z, h, scale | a plinth with a simple figure (use `models` for a real one) |
| `watertower` | x, z, height, text, color | tank on a pedestal, with the name round the tank |
| `mural` | x, z, h, w, hgt, y, text | painted panel on a wall face (not checked against buildings) |
| `prop` | x, z, h, prop, scale | any instanced prop kind: bench, bin, planter, hydrant, mailbox, newsbox, flagpole, busstop, dumpster, corral, featherflag, ... (`src/city/stream.js` PROP_FAR) |
| `tree` | x, z, tree (0 broadleaf, 1 conifer, 2 street), scale | |
| `light` | x, z, h | a street light |
| `roundabout` | x, z, r | the raised grass island; the ring road itself comes from OSM |
| `median` | pts [x, z, ...], w | raised kerbed median strip |
| `parking` | pts [x, z, ...] | paved lot polygon. It must be convex; split concave lots into several. |

Road features (`roundabout`, `median`, `parking`) are meant to be on the road, so they skip the off-road check.
An unknown kind logs one warning. If you need a new kind, describe it in your report.

### models

Models use the `landmarks.js` MODELS format. The file is `assets/models/regions/<id>/<file>.glb`.

- `x, z`: the anchor. Either give `y` (the base height), or set `ground: true` to sit the model on the terrain at
  the anchor (plus `dy`).
- `h`: heading. `load`: the stream-in radius in metres (default 700).
- `clear`: `[[cx, cz, halfX, halfZ], ...]`. OSM / Microsoft buildings under these boxes are dropped from the tiles.
- `solid`: `[[cx, cz, halfX, halfZ, height, baseAboveY?, heading?], ...]`. These are the collision walls.
- Name the mesh objects `<name>_lod0` (full) and `<name>_lod1` (shown from 260 m). Anything else counts as a moving
  part and is always shown.
- Materials named `lm_body`, `lm_glass`, `lm_lit` (glows at night) and `lm_neon` get the shared landmark
  materials. Bake the colours into vertex colours.

## Checking a region headless

```
cd tools
node scan-placement.mjs --region <id>
```

This builds every tile in the region's bounds with the real tile builder. It counts props, signs, lights and parked
cars that sit on a carriageway, in a junction or inside a building (target: 0). It also prints the triangle and
draw-call counts for the densest tile.

`example.js` is a tiny working demo in LeClaire Park, downtown Davenport. It has two renamed buildings, a statue, a
sign and an obelisk model.
