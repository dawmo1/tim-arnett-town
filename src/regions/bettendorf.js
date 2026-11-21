// Bettendorf (incl. Riverdale and Panorama Park): real names, street features and signature models.
// Sources and what is a guess: docs/regions/bettendorf.md. Pure data: no imports, nothing runs at load.
// Coordinates are game metres (x east, z south, origin 3rd & Main, Davenport); positions come from OpenStreetMap
// (Geofabrik extract in tools/cache, projected with tools/map-config.mjs project()).
export default {
  id: 'bettendorf',
  name: 'Bettendorf',
  bounds: [3750, -9800, 12700, 250],
  // Business / building names: OSM shop/amenity points that sit in (or right next to) a building with no name yet,
  // limited to the Bettendorf, Riverdale and Panorama Park city limits (the box also covers part of Davenport).
  names: [
    {match: 755315625, name: 'UI Health Care'},
    {match: 755316946, name: 'Family Care Partners of the Quad Cities'},
    {match: {x: 10608, z: -3730, r: 8}, name: 'All Seasons Baptist Church'},
    {match: 342664840, name: 'Palmer Grill'},
    {match: 776882907, name: 'Bulldog Arms'},
    {match: 755315385, name: 'Subway'},
    {match: 343141610, name: "Papa Murphy's"},
    {match: 342662117, name: 'Dunn Brothers'},
    {match: 755318761, name: 'Big Ten Mart'},
    {match: 813320709, name: 'Hurts Donut Company'},
    {match: {x: 5425, z: -556, r: 8}, name: 'Abel-keppy Animal Hospital'},
    {match: {x: 5442, z: -355, r: 8}, name: 'Blaze Restoration Inc'},
    {match: {x: 5470, z: -370, r: 8}, name: 'Electric Doctor'},
    {match: {x: 12102, z: -4384, r: 8}, name: 'A1 Self Storage'},
    {match: 464918456, name: "Cat's Eye Distillery"},
    {match: 813320708, name: 'N7 Nitrogen Ice Cream'},
    {match: 813320711, name: 'Subway'},
    {match: 755320289, name: "Domino's"},
    {match: 755320757, name: 'Harris Pizza'},
    {match: 755320932, name: 'Jiffy Lube'},
    {match: 342665425, name: 'Great Southern Bank'},
    {match: 343141618, name: 'Power Wash'},
    {match: 755320168, name: 'Unity Point Clinic'},
    {match: 852224023, name: 'Unity Point'},
    {match: 755320702, name: 'QCA Electric'},
    {match: 'r11174842', name: 'Eagle View Behavioral Health'},
    {match: 1316966994, name: "Jersey Mike's Subs"},
    {match: 755322508, name: 'Harborview Health & Wellness at Fit'},
    {match: 1347154015, name: 'Willys Wine and Spirits'},
    {match: 160496921, name: 'Lynco Products'},
    {match: 464888345, name: 'Sports Fans'},
    {match: 776881556, name: 'Republic Services Bettendorf'},
    {match: 813194757, name: 'Beef + Bourbon Chophouse'},
    {match: 755321952, name: 'Visiting Angels'},
    {match: 343138119, name: 'Pleasant Valley School District Office'},
    {match: 755320273, name: 'Herbert Hoover Elementary School'},
    {match: 'r11154066', name: 'Bettendorf Middle School'},
    {match: 342371639, name: 'Trinity Bettendorf'},
    {match: 785983491, name: 'Rivermont Collegiate'},
    {match: {x: 6471, z: -2440, r: 8}, name: 'The Landing Ice Rink'},
    {match: 'r10986676', name: 'Bettendorf High School'},
    {match: 343133279, name: 'Hopewell Elementary School'},
    {match: 755321247, name: 'Paul Norton Elementary School'},
    {match: {x: 5478, z: -3036, r: 10}, name: 'Grant Wood Elementary School'},
    {match: 342664512, name: 'Riverdale Heights Elementary School'},
    {match: 'r12867212', name: 'Arconic Davenport Works'},
    {match: 776881331, name: 'Arconic'},
  ],
  places: [
    // ---- downtown: City Hall flags, State St furniture in front of the convention centre (2026 State St streetscape, 17th-23rd St)
    { kind: 'prop', prop: 'flagpole', x: 5713, z: -167 },
    { kind: 'prop', prop: 'flagpole', x: 5716.5, z: -167 },
    { kind: 'prop', prop: 'flagpole', x: 5720, z: -167 },
    { kind: 'prop', prop: 'bench', x: 5988, z: -176.5, h: Math.PI },
    { kind: 'prop', prop: 'planter', x: 5998, z: -176.5 },
    { kind: 'prop', prop: 'bin', x: 6004, z: -176.5 },
    { kind: 'prop', prop: 'planter', x: 6028, z: -177 },
    { kind: 'prop', prop: 'bench', x: 6038, z: -177, h: Math.PI },
    { kind: 'prop', prop: 'bench', x: 5730, z: -174, h: Math.PI },
    { kind: 'prop', prop: 'planter', x: 5740, z: -174.5 },
    // ---- riverfront overlook (OSM tourism=viewpoint)
    { kind: 'sign', x: 8064, z: 92, text: 'PAT & JACK BUSH SCENIC OVERLOOK', style: 'shop', w: 3.2, height: 1.8 },
    { kind: 'prop', prop: 'bench', x: 8058, z: 98, h: 0 },
    { kind: 'prop', prop: 'bench', x: 8070, z: 98, h: 0 },
    // ---- park, school and golf course entrance signs: on the park / school ground, 4 m in from the corner nearest a named street
    {kind: 'sign', x: 4501.4, z: -305.3, text: 'MEIER PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 9254.3, z: -8940, text: 'HIDDEN HILLS GOLF COURSE', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 6724.9, z: -2615.2, text: 'PALMER HILLS GOLF COURSE', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 10268.1, z: -4173.1, text: 'SUNRISE GOLF COURSE', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 8490.7, z: -1267.3, text: 'DEVILS GLEN PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 6265.9, z: -1519.5, text: 'EDGEWOOD PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 6858.1, z: -869.4, text: 'LINCOLN PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 6590.8, z: -2405.9, text: 'MIDDLE PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 6744.6, z: -1239.1, text: 'WESSEL PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 5177.9, z: -724.7, text: 'MCMANUS PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 8193.1, z: -6541, text: 'HOPEWELL ELEMENTARY', style: 'shop', w: 3.2, height: 2.2, lit: true},
    {kind: 'sign', x: 9768.2, z: -5351.4, text: 'FRIENDSHIP PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 5115.5, z: -41.2, text: 'LEACH PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 9023.4, z: -2860, text: 'PLEASANT VALLEY HIGH SCHOOL', style: 'shop', w: 3.2, height: 2.2, lit: true},
    {kind: 'sign', x: 7859, z: -5100.8, text: 'CROW CREEK PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 6794.9, z: -3459.7, text: 'BETTENDORF HIGH SCHOOL', style: 'shop', w: 3.2, height: 2.2, lit: true},
    {kind: 'sign', x: 5126.9, z: -3816.4, text: 'OPTIMIST PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 7090.6, z: -5096.6, text: 'ED SCHECK PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 6283.7, z: -3858.3, text: 'HOOVER PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 6112.4, z: -3551.7, text: 'HERBERT HOOVER ELEMENTARY', style: 'shop', w: 3.2, height: 2.2, lit: true},
    {kind: 'sign', x: 6048.4, z: -4528.7, text: 'KIWANIS PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 5918.8, z: -4710.4, text: 'PAUL NORTON ELEMENTARY', style: 'shop', w: 3.2, height: 2.2, lit: true},
    {kind: 'sign', x: 7489.6, z: -875.2, text: 'NEIL ARMSTRONG ELEMENTARY', style: 'shop', w: 3.2, height: 2.2, lit: true},
    {kind: 'sign', x: 5844.9, z: -1570, text: 'MARK TWAIN ELEMENTARY', style: 'shop', w: 3.2, height: 2.2, lit: true},
    {kind: 'sign', x: 5414.4, z: -3074.1, text: 'GRANT WOOD ELEMENTARY', style: 'shop', w: 3.2, height: 2.2, lit: true},
    {kind: 'sign', x: 6217.2, z: -2874.1, text: 'BETTENDORF MIDDLE SCHOOL', style: 'shop', w: 3.2, height: 2.2, lit: true},
    {kind: 'sign', x: 7844.4, z: -2482.1, text: 'RIVERDALE HEIGHTS ELEMENTARY', style: 'shop', w: 3.2, height: 2.2, lit: true},
    {kind: 'sign', x: 6286.3, z: -438, text: 'SUNNY CREST PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 10247.2, z: -3743.5, text: 'PANORAMA PARK COMMON SPACE', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 11152.9, z: -4470.6, text: 'MCLAMARRAH PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 6366.2, z: -3099.6, text: 'LEARNING CAMPUS', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 11768.2, z: -3391.3, text: 'PIGEON CREEK PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 11403.4, z: -2893.1, text: 'EAGLES LANDING PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 9405.4, z: -4447.5, text: 'WYNDHAM POND', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 7428.2, z: -6353, text: 'FIELD SIKE PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 11297.5, z: -7612.2, text: 'FOREST GROVE PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 6461, z: -1671.6, text: 'VETERANS MEMORIAL PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 11438.1, z: -4472.5, text: 'PLEASANT VIEW ELEMENTARY', style: 'shop', w: 3.2, height: 2.2, lit: true},
    {kind: 'sign', x: 9280.3, z: -2119.1, text: 'BICENTENNIAL PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 10911.6, z: -7376.5, text: 'FOREST GROVE ELEMENTARY', style: 'shop', w: 3.2, height: 2.2, lit: true},
    {kind: 'sign', x: 5862.4, z: -736.7, text: 'RIVERMONT COLLEGIATE', style: 'shop', w: 3.2, height: 2.2, lit: true},
    {kind: 'sign', x: 9366.8, z: -2160, text: 'VOLUNTEER SQUARE PARK', style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 5425.7, z: -4081.2, text: 'MORNINGSTAR ACADEMY', style: 'shop', w: 3.2, height: 2.2, lit: true},
    {kind: 'sign', x: 8695.3, z: -853.8, text: "PEGGY'S PARK", style: 'shop', w: 2.8, height: 1.8, lit: false},
    {kind: 'sign', x: 11867.8, z: -6588.1, text: 'SAINT JOAN OF ARC CATHOLIC SCHOOL', style: 'shop', w: 3.2, height: 2.2, lit: true},
    // ---- roundabout islands (OSM junction=roundabout rings; island radius = ring radius - half the ring width - 0.6 m):
    //      Middle Rd & 53rd Ave, Wyndham Pond area, and the Forest Grove Dr / Middle Rd / Competition Dr ring of four by TBK
    {kind: 'roundabout', x: 9467, z: -5735, r: 14.7},
    {kind: 'roundabout', x: 9292.9, z: -4997.5, r: 8.4},
    {kind: 'roundabout', x: 9564, z: -7341.6, r: 15.2},
    {kind: 'roundabout', x: 9831, z: -7350.9, r: 18.4},
    {kind: 'roundabout', x: 9873.4, z: -7517.9, r: 14.8},
    {kind: 'roundabout', x: 10110.9, z: -7348.1, r: 14.3},
    // ---- raised medians: where OSM maps the road as two one-way carriageways 1-4 m apart (kerb to kerb), trimmed 10 m
    //      back from each junction. Wider grass medians are left as ground.
    {kind: 'median', w: 2.4, pts: [4603.4,-1647.9,4629.6,-1648,4641.3,-1648]}, // Middle Road
    {kind: 'median', w: 2.3, pts: [4668.5,-1648.6,4691,-1652.7,4710.5,-1659.3]}, // Middle Road
    {kind: 'median', w: 1.8, pts: [4874.7,-1077.7,4885.4,-1059.6,4897.2,-1039.7,4908.9,-1019.7,4921.3,-999.7,4933.6,-981.2,4947.4,-963,4961,-945.8,4974.4,-929.6,4988.1,-914.6,5001.9,-900.1,5020.9,-881.5,5037.4,-867,5054,-853.7,5070.1,-841.3,5086.3,-829,5104.5,-815,5123.3,-800.1,5140.4,-785,5144.6,-781.4]}, // Kimberly Road
    {kind: 'median', w: 1.5, pts: [5041.2,-1981.4,5059,-1999.5,5074.7,-2014.7,5090.9,-2028.9,5111.2,-2044.1,5130,-2057.1,5132.8,-2058.8]}, // Middle Road
    {kind: 'median', w: 2.6, pts: [5132.7,-286.4,5156.5,-289.6,5178.9,-291.9,5202,-294.3,5225.1,-296.1,5248.2,-297.4,5272,-298,5284.9,-298.3]}, // Grant Street
    {kind: 'median', w: 2.5, pts: [4814.9,-3450,4835,-3449.4,4856.5,-3448.8,4878.9,-3448.3,4902.3,-3447.8,4925.7,-3446.7,4948.5,-3444.2,4961.8,-3441.6]}, // Spruce Hills Drive
    {kind: 'median', w: 3.2, pts: [7824,-3182.9,7823.5,-3162.9,7823.8,-3140.9,7824.7,-3117.9,7826.2,-3103.9]}, // Devils Glen Road
    {kind: 'median', w: 3.6, pts: [7836.8,-3007.7,7836.9,-2981.1,7836.4,-2967.6]}, // Devils Glen Road
    {kind: 'median', w: 1.1, pts: [6600.5,-5697.4,6621,-5697.7,6626.2,-5697.8]}, // 53rd Avenue
    {kind: 'median', w: 1.7, pts: [6653.8,-5698,6674.7,-5698.3,6697.8,-5698.6,6720.9,-5698.8,6744,-5699.1,6767.2,-5699.3,6788,-5699.6]}, // 53rd Avenue
    {kind: 'median', w: 2.3, pts: [6815.7,-5699.9,6842.8,-5700.4,6865.1,-5700.8,6887.3,-5701.1,6910.3,-5701.2,6933.2,-5701.3,6956.2,-5701.4,6979.7,-5700.8,7001.3,-5698.8,7006.4,-5698.3]}, // 53rd Avenue
    {kind: 'median', w: 2.3, pts: [7033.3,-5694,7059.9,-5688.7,7081.7,-5684.3,7093.7,-5681.9]}, // 53rd Avenue
    {kind: 'median', w: 3.6, pts: [7120.6,-5676.4,7142,-5671.8,7165.4,-5666.7,7188.7,-5661.7,7212,-5656.6,7235.4,-5651.6,7258.7,-5646.5,7282.1,-5641.5,7305.4,-5636.5,7326.7,-5631.8]}, // 53rd Avenue
    {kind: 'median', w: 3.4, pts: [7354.1,-5625.9,7374.5,-5621.5,7397.2,-5616.5,7419.8,-5611.6,7442.5,-5606.7,7465,-5601.9,7487.7,-5597.2,7493,-5596.1]}, // 53rd Avenue
    {kind: 'median', w: 3.6, pts: [7519.6,-5590.4,7545.2,-5584.8,7566.4,-5580.1,7587.8,-5575.6,7609.6,-5571.3,7631.3,-5567,7652.3,-5564.1,7673,-5562.6,7689.2,-5562.2]}, // 53rd Avenue
    {kind: 'median', w: 3.1, pts: [7842.2,-5546.4,7842.5,-5532]}, // Devils Glen Road
    {kind: 'median', w: 2.4, pts: [7843.2,-5482.5,7843.4,-5460.6,7843.7,-5437.5]}, // Devils Glen Road
    {kind: 'median', w: 3.2, pts: [7841.2,-5634.6,7841.5,-5614.4,7841.7,-5591.8,7841.8,-5587.2]}, // Devils Glen Road
    {kind: 'median', w: 1.1, pts: [7841.3,-5714.9,7841.1,-5704.1]}, // Devils Glen Road
    {kind: 'median', w: 2.7, pts: [8337.9,-3430.9,8353.1,-3415.8,8368.9,-3400.4,8383.2,-3387.1]}, // Belmont Road
    {kind: 'median', w: 2, pts: [8364.2,-3477.2,8373.7,-3485.8]}, // Middle Road
    {kind: 'median', w: 2, pts: [9466.4,-5707.3,9466.5,-5683,9464.1,-5660.8,9463.3,-5656.6]}, // Middle Road
    {kind: 'median', w: 3.2, pts: [9708.6,-5737.6,9729,-5737.7,9751.7,-5737.9,9774.5,-5738.1,9797.2,-5738.3,9820,-5738.4,9820.4,-5738.4]}, // 53rd Avenue
    {kind: 'median', w: 2.9, pts: [9468.3,-5840.3,9468,-5814.5,9467.6,-5792.1,9467.5,-5770.4,9467.6,-5767.7]}, // Middle Road
    {kind: 'median', w: 3.2, pts: [8643.9,-5698.1,8663.6,-5702.8,8688.2,-5708.3,8714.2,-5713.4,8738.6,-5717,8765.3,-5720.5,8788.4,-5722.7,8812.1,-5724.2,8835,-5725.2,8840.1,-5725.3]}, // 53rd Avenue
    {kind: 'median', w: 3.1, pts: [8867.7,-5726,8894.8,-5726.4,8917.1,-5726.7,8929.3,-5727]}, // 53rd Avenue
    {kind: 'median', w: 3.6, pts: [8968,-5727.5,8989.5,-5727.8,9013.2,-5728.2,9036.8,-5728.6,9060.4,-5729,9084.1,-5729.4,9107.7,-5729.8,9131.3,-5730.2,9155,-5730.6,9178.6,-5731,9200.1,-5731.4]}, // 53rd Avenue
    {kind: 'median', w: 3.6, pts: [9492.2,-5734.6,9515.3,-5735.7,9539,-5735.9,9562.8,-5736,9586.6,-5736.1,9592.4,-5736.1]}, // 53rd Avenue
    {kind: 'median', w: 1.9, pts: [9763.9,-7353.8,9785,-7358.1,9794.9,-7358.4]}, // Forest Grove Drive
    {kind: 'median', w: 2.4, pts: [9776.9,-7231.6,9788.3,-7248.2,9802,-7269.2,9811.8,-7293,9816,-7313.2,9817.5,-7319.2]}, // Middle Road
    {kind: 'median', w: 1.1, pts: [10002.8,-7350.6,10028.9,-7350,10049.7,-7350.1,10058.7,-7350.6]}, // Forest Grove Drive
    {kind: 'median', w: 3.1, pts: [9862.4,-7482.8,9860,-7459,9856.4,-7437.2,9851.8,-7413.8,9847.7,-7394.1,9843.2,-7379.5]}, // Middle Road
    {kind: 'median', w: 2.1, pts: [9863.4,-7614.7,9865.8,-7592.6,9871.9,-7568.5,9875.3,-7551.5]}, // Middle Road
    {kind: 'median', w: 1.7, pts: [9861.4,-7667.6,9861.8,-7647.4,9861.9,-7641.9]}, // Middle Road
    {kind: 'median', w: 1.1, pts: [10138.3,-7345.3,10160.9,-7347.4,10182.9,-7350.2,10203.1,-7352.7,10220.6,-7353.6]}, // Forest Grove Drive
  ],
  models: [
    // Quad Cities Waterfront Convention Center (2021 State St, 2009): glass lobby on State St, precast ballroom block
    { file: 'convention', x: 6020, z: -135, ground: true, load: 800, clear: [[6021, -135, 49.5, 35.5]],
      solid: [[6012, -134, 39, 34, 11], [6060.6, -136.8, 9.4, 4.2, 7]] },
    // City Hall + Police + Fire Station 1 (1609 State St), the fountain and sculpture in front
    { file: 'cityhall', x: 5664, z: -145, ground: true, load: 800, clear: [[5664.2, -145.2, 46.5, 19]],
      solid: [[5697, -144, 11.3, 17.5, 10], [5671, -145, 15, 15, 9], [5637.5, -147.5, 19, 12.5, 8], [5701.5, -159.5, 4.3, 4.3, 10.6],
        [5707.3, -151.5, 3, 3, 11.2], [5700, -170.5, 3.2, 3.2, 0.6], [5680, -170.5, 1.6, 0.8, 4]] },
    // Family Museum (2900 Learning Campus Dr, 1997)
    { file: 'museum', x: 6252, z: -3226, ground: true, load: 700, clear: [[6250, -3226, 34, 41.5]],
      solid: [[6237.5, -3211, 20.5, 16, 8.5], [6268, -3205, 13, 18, 11], [6262, -3248, 9, 18.5, 11], [6269, -3186, 7.5, 2.5, 13]] },
  ],
  notes: 'Sources and guesses: docs/regions/bettendorf.md. Models (assets/src/regions/bettendorf/bettendorf.py) use the OSM '
    + 'footprints; facade colours are guesses. Not done: Arconic Davenport Works massing (1.6 km mill, OSM height 12.7 m is low), '
    + 'Bettendorf High School model, State St two-way conversion (unconfirmed), Faye\'s Field Rotary Row instruments.',
};
