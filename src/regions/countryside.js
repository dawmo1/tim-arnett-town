// Countryside, highways and rivers: everything between the towns (the whole map box; only things outside the town
// boxes, plus Black Hawk State Historic Site, which this region was given). Pure data, see README.md / _template.js.
// Sources and what is left to do: docs/regions/countryside.md. Models: assets/src/regions/countryside/countryside.py.
// Highway sign positions come from the game's own road graph (carriageway centre, heading of travel): mile markers sit
// on the right shoulder facing traffic, guide-sign / gantry anchors are on the carriageway centre line.
export default {
  id: 'countryside',
  name: 'Countryside, highways and rivers',
  bounds: [-12000, -11400, 38200, 13800],
  names: [
    { match: 1558249637, name: 'Tyson Fresh Meats' }, // Joslin beef plant by I-88 exit 6 (closed early 2026)
    // rural churches (OSM / GNIS church points, matched to the nearest building)
    { match: { x: 34971, z: -1182, r: 8 }, name: 'Ebenezer Community Church' },
    { match: { x: 28895, z: 2672, r: 8 }, name: 'Faith Church' },
    { match: { x: 23258, z: -3569, r: 8 }, name: 'Church of the Cross' },
    { match: { x: 1347, z: 12933, r: 8 }, name: 'Coyne Center Baptist Church' },
    { match: 1135527680, name: 'Buffalo Friends Church' },
    { match: 1560048926, name: 'Saint Johns Lutheran Church' },
  ],
  places: [
    // ---- Black Hawk State Historic Site (Watch Tower Lodge is a model below)
    { kind: 'sign', x: 326, z: 6497, text: 'BLACK HAWK STATE HISTORIC SITE', style: 'shop', w: 3.8, height: 2.4 }, // drive off Blackhawk Rd (IL 5)
    { kind: 'sign', x: 348, z: 6560, h: -Math.PI / 2, text: 'HAUBERG INDIAN MUSEUM', style: 'shop', w: 2.6, height: 2.2 },
    // ---- Hennepin Canal Parkway, Lock 26 (model below) and its campground
    { kind: 'sign', x: 26300, z: 5528, text: 'HENNEPIN CANAL LOCK 26', style: 'shop', w: 3.0, height: 2.2 }, // Canal Road
    { kind: 'sign', x: 26335, z: 5598, text: 'LOCK 26 CAMPGROUND', style: 'shop', w: 2.6, height: 2.0 },
    // ---- interstate mile markers (I-80 miles 11-18 between the Big X and Geneseo, I-88 miles 7-11 by Joslin and Hillsdale)
    { kind: 'sign', x: 21545.7, z: 9248.1, h: 4.703, text: 'MILE 11', style: 'street', w: 1.4, height: 1.5 }, // I-80 EB
    { kind: 'sign', x: 22474.6, z: 9245.8, h: 4.719, text: 'MILE 12', style: 'street', w: 1.4, height: 1.5 }, // I-80 EB
    { kind: 'sign', x: 24075.6, z: 9240.3, h: 4.714, text: 'MILE 13', style: 'street', w: 1.4, height: 1.5 }, // I-80 EB
    { kind: 'sign', x: 25684.8, z: 9236, h: 4.717, text: 'MILE 14', style: 'street', w: 1.4, height: 1.5 }, // I-80 EB
    { kind: 'sign', x: 27284.8, z: 9228.1, h: 4.717, text: 'MILE 15', style: 'street', w: 1.4, height: 1.5 }, // I-80 EB
    { kind: 'sign', x: 28904.7, z: 9197.2, h: 4.734, text: 'MILE 16', style: 'street', w: 1.4, height: 1.5 }, // I-80 EB
    { kind: 'sign', x: 30504.3, z: 9176.5, h: 4.716, text: 'MILE 17', style: 'street', w: 1.4, height: 1.5 }, // I-80 EB
    { kind: 'sign', x: 32124.2, z: 9175.6, h: 4.707, text: 'MILE 18', style: 'street', w: 1.4, height: 1.5 }, // I-80 EB
    { kind: 'sign', x: 22517.2, z: 9198.9, h: 1.578, text: 'MILE 12', style: 'street', w: 1.4, height: 1.5 }, // I-80 WB
    { kind: 'sign', x: 24126.5, z: 9191.7, h: 1.572, text: 'MILE 13', style: 'street', w: 1.4, height: 1.5 }, // I-80 WB
    { kind: 'sign', x: 25735.7, z: 9190.2, h: 1.571, text: 'MILE 14', style: 'street', w: 1.4, height: 1.5 }, // I-80 WB
    { kind: 'sign', x: 27355.6, z: 9179.9, h: 1.585, text: 'MILE 15', style: 'street', w: 1.4, height: 1.5 }, // I-80 WB
    { kind: 'sign', x: 28955.2, z: 9150, h: 1.594, text: 'MILE 16', style: 'street', w: 1.4, height: 1.5 }, // I-80 WB
    { kind: 'sign', x: 30575.1, z: 9126.9, h: 1.578, text: 'MILE 17', style: 'street', w: 1.4, height: 1.5 }, // I-80 WB
    { kind: 'sign', x: 32175.2, z: 9128.9, h: 1.565, text: 'MILE 18', style: 'street', w: 1.4, height: 1.5 }, // I-80 WB
    { kind: 'sign', x: 29164, z: -4803.6, h: 5.513, text: 'MILE 7', style: 'street', w: 1.4, height: 1.5 }, // I-88 EB
    { kind: 'sign', x: 30292.1, z: -5965.8, h: 5.512, text: 'MILE 8', style: 'street', w: 1.4, height: 1.5 }, // I-88 EB
    { kind: 'sign', x: 31414.2, z: -7106.2, h: 5.515, text: 'MILE 9', style: 'street', w: 1.4, height: 1.5 }, // I-88 EB
    { kind: 'sign', x: 31997.3, z: -10999.8, h: 5.929, text: 'MILE 11', style: 'street', w: 1.4, height: 1.5 }, // I-88 EB
    { kind: 'sign', x: 29123.6, z: -4847.6, h: 2.369, text: 'MILE 7', style: 'street', w: 1.4, height: 1.5 }, // I-88 WB
    { kind: 'sign', x: 30243.5, z: -5990.4, h: 2.364, text: 'MILE 8', style: 'street', w: 1.4, height: 1.5 }, // I-88 WB
    { kind: 'sign', x: 31377, z: -7147.8, h: 2.366, text: 'MILE 9', style: 'street', w: 1.4, height: 1.5 }, // I-88 WB
    { kind: 'sign', x: 31926.5, z: -10962.2, h: 2.852, text: 'MILE 11', style: 'street', w: 1.4, height: 1.5 }, // I-88 WB
  ],
  models: [
    // Watch Tower Lodge (1934-42, CCC): over the OSM building (way 628712511); inside the rock-island box
    { file: 'lodge', x: 400, z: 6560, ground: true, load: 800, clear: [[398, 6562, 44, 17]],
      solid: [[435.5, 6557.85, 5.5, 6.15, 8.2], // the hall and the museum's walls: lodge_int (src/landmarks.js)
        [421, 6556.05, 9, 0.25, 3.4], [421, 6561, 9, 5, 3, 3.0]] },
    // Express Lane truck stop, I-88 exit 10 Hillsdale: store, car canopy, diesel canopy and the high-rise pylon
    { file: 'truckstop', x: 32590, z: -9860, ground: true, load: 1200, clear: [[32596, -9864, 25, 25]],
      solid: [[32571.7, -9875.2, 2.7, 0.8, 2, 0, -0.775], [32565.8, -9869.2, 2.7, 0.8, 2, 0, -0.775], [32559.9, -9863.2, 2.7, 0.8, 2, 0, -0.775], [32554, -9857.2, 2.7, 0.8, 2, 0, -0.775],
        [32575.9, -9834.7, 2.7, 0.8, 2, 0, -0.15], [32574.7, -9823.7, 2.7, 0.8, 2, 0, -0.15], [32595.4, -9863, 27.6, 13.5, 6.4, 0, 1.122], [32505, -9775, 0.8, 0.8, 31]] },
    // Hennepin Canal Lock 26: chamber walls, upper weir, lower Marshall gate (the trail bridge over it is OSM)
    { file: 'lock26', x: 26291, z: 5563, ground: true, load: 700, clear: [],
      solid: [[26291, 5556.4, 33, 1.2, 3.2], [26291, 5569.6, 33, 1.2, 3.2], [26319.7, 5563, 1.3, 5.4, 1.5]] },
    // farm grain leg (22.86 m) with five bins and a dryer, replacing the OSM bins (Edford Township)
    { file: 'grainleg', x: 25983, z: 7695, ground: true, load: 1200,
      clear: [[25976, 7663, 2, 2], [26012, 7664, 2, 2], [25994, 7663, 2, 2], [25974, 7702, 2, 2], [25992, 7703, 2, 2], [25983, 7695, 1, 1]],
      solid: [[25975.2, 7663.1, 6.2, 6.2, 16.3], [26011.2, 7664.4, 6.2, 6.2, 16.3], [25993.3, 7662.5, 5.4, 5.4, 14.2], [25973.2, 7702.8, 6.2, 6.2, 16.3], [25991.1, 7703.5, 6.2, 6.2, 16.3],
        [25983, 7695, 1.3, 1.3, 25.5], [26003, 7690, 1.6, 2.4, 13]] },
    // guide signs: overhead gantries at the I-80 / I-74 / I-280 "Big X", ground-mounted advance signs at I-88 exits 6
    // and 10 and I-80 exit 19; billboards along I-80 and I-88
    { file: 'gantry_i80w', x: 23266.5, z: 9201.3, ground: true, h: -1.568, load: 900, clear: [], solid: [[23266.5, 9191.6, 0.6, 1.3, 9, 0, -1.568], [23266.5, 9211, 0.6, 1.3, 9, 0, -1.568]] },
    { file: 'gantry_i74n', x: 20750.3, z: 10835.7, ground: true, h: -3.136, load: 900, clear: [], solid: [[20760, 10835.6, 0.6, 1.3, 9, 0, -3.136], [20740.6, 10835.8, 0.6, 1.3, 9, 0, -3.136]] },
    { file: 'exit10w', x: 31858, z: -10457.7, ground: true, h: 0.037, load: 900, clear: [], solid: [[31842.4, -10457, 0.35, 0.35, 5, 0, 0.037], [31846.8, -10457.1, 0.35, 0.35, 5, 0, 0.037]] },
    { file: 'exit10e', x: 32139.2, z: -8330.8, ground: true, h: 2.916, load: 900, clear: [], solid: [[32154.4, -8327.5, 0.35, 0.35, 5, 0, 2.916], [32150.1, -8328.4, 0.35, 0.35, 5, 0, 2.916]] },
    { file: 'exit6w', x: 28749.1, z: -4450.5, ground: true, h: -0.773, load: 900, clear: [], solid: [[28738.2, -4460.9, 0.35, 0.35, 5, 0, -0.773], [28741, -4458.1, 0.35, 0.35, 5, 0, -0.773]] },
    { file: 'exit6e', x: 27273.1, z: -2889.3, ground: true, h: 2.371, load: 900, clear: [], solid: [[27284, -2878.9, 0.35, 0.35, 5, 0, 2.371], [27281.2, -2881.7, 0.35, 0.35, 5, 0, 2.371]] },
    { file: 'exit19e', x: 32954.2, z: 9173, ground: true, h: 1.542, load: 900, clear: [], solid: [[32953.9, 9188.6, 0.35, 0.35, 5, 0, 1.542], [32954, 9184.2, 0.35, 0.35, 5, 0, 1.542]] },
    { file: 'billboard_a', x: 26524.9, z: 9254.8, ground: true, h: 1.469, load: 900, clear: [], solid: [[26525.7, 9254.9, 0.7, 0.7, 17, 0, 1.469]] },
    { file: 'billboard_b', x: 30124.4, z: 9200.7, ground: true, h: 1.468, load: 900, clear: [], solid: [[30125.2, 9200.8, 0.7, 0.7, 17, 0, 1.468]] },
    { file: 'billboard_b', x: 31295.2, z: 9102, ground: true, h: -1.679, load: 900, clear: [], solid: [[31294.4, 9101.9, 0.7, 0.7, 17, 0, -1.679]] },
    { file: 'billboard_a', x: 27795.2, z: 9150.8, ground: true, h: -1.663, load: 900, clear: [], solid: [[27794.4, 9150.7, 0.7, 0.7, 17, 0, -1.663]] },
    { file: 'billboard_a', x: 29696.2, z: -5318, ground: true, h: 2.245, load: 900, clear: [], solid: [[29696.8, -5318.5, 0.7, 0.7, 17, 0, 2.245]] },
    { file: 'billboard_b', x: 30199.1, z: -5978, ground: true, h: -0.883, load: 900, clear: [], solid: [[30198.5, -5977.5, 0.7, 0.7, 17, 0, -0.883]] },
  ],
  notes: 'Research and sources: docs/regions/countryside.md. Not done: Welcome to Iowa / Illinois signs at the I-80 and I-280 river bridges (both ends sit in town boxes: le-claire / port-byron / rock-island), Iowa-side interstates (I-80 / I-280 west of Davenport are all inside the davenport box), rest areas (none inside the map), a commercial grain elevator (no co-op elevator outside the town boxes in OSM).',
};
