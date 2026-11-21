// Port Byron (incl. Rapids City and Hampton): the Illinois river villages above the I-80 bridge. Real names on Main St
// Port Byron, 2nd Ave (IL-84) Rapids City and State Ave Hampton; riverfront trail furniture, park signs, Hampton's
// water tower; models of Will B. Rolling, Black's Store and the Shuler's Shady Grove Park gazebo.
// Sources and guesses: docs/regions/port-byron.md. Models: assets/src/regions/port-byron/port_byron.py.
export default {
  id: 'port-byron',
  name: 'Port Byron',
  bounds: [13100, -12600, 26200, -2200],
  names: [
    // Port Byron, Main St downtown (odd numbers on the river side; split N/S at Cherry St)
    { match: { x: 20129, z: -9152, r: 12 }, name: 'Rams Riverhouse' }, // 102 S Main
    { match: { x: 20133, z: -9109, r: 12 }, name: "Jimmie Lee's Bar & Grill" }, // 108 S Main (position a guess)
    { match: { x: 20132, z: -9222, r: 12 }, name: "Duey's Corner Tap" }, // 102 N Main
    { match: { x: 20092, z: -9265, r: 12 }, name: 'Blue Suede Cocktails & Coffee' }, // 125 N Main
    { match: { x: 20092, z: -9317, r: 12 }, name: 'Tuggers Burger Bar & Ale House' }, // 201 N Main
    { match: { x: 20136, z: -9376, r: 10 }, name: 'Port Byron Post Office' }, // 105 Hickory St
    { match: { x: 20239, z: -9211, r: 15 }, name: 'Blackhawk Bank & Trust' }, // 105 N High St (2023 branch)
    { match: { x: 20230, z: -9046, r: 10 }, name: 'Port Byron Congregational Church' }, // 200 S High St
    { match: { x: 20120, z: -8653, r: 12 }, name: "Mean Mel's Steakhouse" }, // 708 S Main
    // Rapids City, 2nd Ave (IL-84) and 17th St
    { match: 768155886, name: 'Git-N-Go' }, // 1310 2nd Ave (OSM says GetGo; the village lists Git-N-Go #13)
    { match: 768155887, name: 'Git-N-Go' },
    { match: 768155891, name: 'QC Mart' }, // 1726 2nd Ave
    { match: 768155892, name: 'The Edge Eatery & Drinkatorium' }, // 1802 2nd Ave
    { match: 768155895, name: 'Brothers Family Restaurant' }, // 1718 2nd Ave
    { match: 768155900, name: 'Thai Town Cafe' }, // 403 17th St
    { match: 768155916, name: "Enright's Rapids City Car Wash" },
    { match: 768155917, name: "Gilanella's Italian Restaurant" },
    { match: 768155918, name: "McCarty's Precision Auto Pro" },
    // Hampton, State Ave (IL-84)
    { match: { x: 14025, z: -3624, r: 15 }, name: "Porter's Village Pizza" }, // 621 State Ave
    { match: { x: 13885, z: -3326, r: 32 }, name: "Floriana's Cafe" }, // 421 State Ave
    { match: { x: 13968, z: -3459, r: 25 }, name: 'Blimpie' }, // 510 State Ave
  ],
  places: [
    // Hampton's water tower: OSM maps it as a way (14483,-3110) inside a 38x31 m Microsoft footprint, so the map build
    // missed it; set just east of that footprint. Port Byron's and Rapids City's are OSM nodes the core already draws.
    { kind: 'watertower', x: 14506, z: -3108, height: 36, text: 'HAMPTON' },
    // Port Byron riverfront: the Great River Trail between Main St and the river
    { kind: 'sign', x: 20063, z: -9045, text: 'GREAT RIVER TRAIL', style: 'shop', w: 2.6 },
    { kind: 'sign', x: 20070, z: -8560, text: 'GREAT RIVER TUG FEST', style: 'shop', w: 3.0 },
    { kind: 'sign', x: 20085, z: -9175, text: 'WORLD WAR MEMORIAL', style: 'shop', w: 2.4 },
    { kind: 'prop', prop: 'flagpole', x: 20088, z: -9160 },
    { kind: 'prop', prop: 'bench', x: 20062, z: -9105, h: -Math.PI / 2 },
    { kind: 'prop', prop: 'bench', x: 20062, z: -9065, h: -Math.PI / 2 },
    { kind: 'prop', prop: 'bench', x: 20062, z: -9000, h: -Math.PI / 2 },
    { kind: 'prop', prop: 'bench', x: 20062, z: -8960, h: -Math.PI / 2 },
    { kind: 'prop', prop: 'bin', x: 20063, z: -9070 },
    { kind: 'prop', prop: 'bin', x: 20063, z: -8995 },
    { kind: 'light', x: 20066, z: -9120 }, { kind: 'light', x: 20066, z: -9080 }, { kind: 'light', x: 20066, z: -9010 },
    { kind: 'light', x: 20066, z: -8970 },
    // Main St downtown planters and the newsbox by the post office
    { kind: 'prop', prop: 'planter', x: 20113, z: -9170 }, { kind: 'prop', prop: 'planter', x: 20113, z: -9128 },
    { kind: 'prop', prop: 'planter', x: 20096, z: -9240 }, { kind: 'prop', prop: 'planter', x: 20096, z: -9290 },
    { kind: 'prop', prop: 'newsbox', x: 20120, z: -9385 },
    { kind: 'sign', x: 20135, z: -8975, text: 'RIVER VALLEY DISTRICT LIBRARY', style: 'shop', w: 3.0 },
    // parks
    { kind: 'sign', x: 19600, z: -6566, text: "SHULER'S SHADY GROVE PARK", style: 'shop', w: 3.0 },
    { kind: 'prop', prop: 'bench', x: 19655, z: -6588, h: Math.PI },
    { kind: 'prop', prop: 'bench', x: 19620, z: -6588, h: Math.PI },
    { kind: 'sign', x: 19113, z: -5664, text: 'RIVER BEND PARK', style: 'shop' },
    { kind: 'sign', x: 19768, z: -5718, text: 'SHADOW HILL PARK', style: 'shop' },
    { kind: 'sign', x: 19458, z: -6002, text: 'SULPHUR CREEK PARK', style: 'shop' },
    { kind: 'sign', x: 20668, z: -9730, text: 'DORRANCE PARK', style: 'shop' },
    { kind: 'sign', x: 13848, z: -3600, text: 'MUNSON PARK', style: 'shop' },
    { kind: 'sign', x: 13295, z: -2616, text: 'HAMPTON HERITAGE PARK', style: 'shop', w: 2.8 },
    { kind: 'sign', x: 14575, z: -4283, text: 'ILLINIWEK FOREST PRESERVE', style: 'shop', w: 3.0 },
    { kind: 'sign', x: 13626, z: -3712, text: 'BRETTUN & BLACK MUSEUM', style: 'shop', w: 2.6 },
  ],
  models: [
    // Will B. Rolling (2013): 30 ft penny-farthing rider on the riverfront by the Great River Trail, 120 S Main
    { file: 'willrolling', x: 20058, z: -9032, ground: true, load: 600, clear: [],
      solid: [[20058, -9032.4, 2.2, 4.6, 1.0], [20058, -9033.3, 0.5, 3.0, 8.5]] },
    // Black's Store (1849), 1st Ave at 6th St, Hampton: replaces OSM way 758040568
    { file: 'blacksstore', x: 13610.45, z: -3698.6, ground: true, load: 700, clear: [[13610.45, -3698.6, 6.6, 9]],
      solid: [[13610.45, -3698.6, 4.65, 8.1, 14, 0, -0.261]] },
    // Shuler's Shady Grove Park gazebo, Rapids City riverfront (1st Ave and 11th St)
    { file: 'gazebo', x: 19646, z: -6582, ground: true, load: 400, clear: [], solid: [[19646, -6582, 2.6, 2.6, 5]] },
  ],
  notes: 'Sources: docs/regions/port-byron.md. Riverdale High/Middle School (256th St N, ~25700,-10400) is outside these bounds. '
    + 'The Iowa side (Le Claire, Princeton) inside this box belongs to the le-claire and countryside agents.',
};
