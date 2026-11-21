// Davenport outside downtown: Village of East Davenport, Kimberly / Elmore / 53rd / Brady strips, NorthPark, Vander Veer,
// Hilltop, West End, McClellan Heights, the north side and Davenport Municipal Airport. Pure data (see README.md).
// Sources and notes: docs/regions/davenport.md. Coordinates: game metres (tools/map-config.mjs project()).
// OSM already names ~740 buildings here; these fill the gaps: real tenants of unnamed buildings (OSM shop/amenity nodes
// matched to the footprint they stand in), schools / hospitals / churches whose OSM name sits on a site polygon or node.
export default {
  id: 'davenport',
  name: 'Davenport',
  bounds: [-9200, -11100, 7250, 1200],
  names: [
    // hospitals (OSM hospital sites; the buildings are unnamed)
    { match: 884416903, name: 'MercyOne Genesis West Medical Center' }, // 1401 W Central Park Ave
    { match: 884416917, name: 'MercyOne Genesis West Medical Center' },
    { match: 884416915, name: 'MercyOne Genesis West Medical Center' },
    { match: 'r4861889', name: 'MercyOne Genesis Davenport Medical Center' }, // 1227 E Rusholme St
    { match: 'r11312044', name: 'MercyOne Genesis Davenport Medical Center' },
    { match: 342661135, name: 'MercyOne Genesis Davenport Medical Center' },
    // schools (OSM school site / node -> its main building)
    { match: 'r9733900', name: 'Assumption High School' }, // 1020 W Central Park Ave
    { match: 'r4210785', name: 'Davenport West High School' }, // 3505 W Locust St
    { match: 'r11548279', name: 'Williams Intermediate School' }, // 3040 N Division St
    { match: 841021947, name: 'Adams Elementary School' }, // 3029 N Division St
    { match: 841023560, name: 'Mid City High School' }, // 3801 N Marquette St
    { match: 841023559, name: 'John F. Kennedy Catholic School' },
    { match: 841023558, name: 'Harrison Elementary School' },
    { match: 698708370, name: 'Truman Elementary School' },
    { match: 'r11548265', name: 'Jackson Elementary School' },
    { match: 'r11548293', name: 'Garfield Elementary School' },
    { match: 226405687, name: 'Sudlow Intermediate School' }, // 1414 E Locust St
    { match: 342662571, name: 'McKinley Elementary School' },
    { match: 700442246, name: 'Trinity Lutheran Church' }, // 1122 W Central Park Ave
    { match: 955371630, name: 'Faith United Church of Christ' },
    { match: 758725737, name: 'Christian Science Reading Room' },
    { match: 794414141, name: 'U.S. Post Office' },
    // Annie Wittenmyer Complex (the old Iowa Soldiers' Orphans' Home, 2800 Eastern Ave); OSM calls them Building A-K
    ...[757997099, 757996179, 757997533, 757997313, 757996136, 757998306, 757997573, 757997802, 757997398, 757996690, 757997660]
      .map((match) => ({ match, name: 'Annie Wittenmyer Complex' })),
    // NorthPark Mall (320 W Kimberly Rd): the mall building itself
    { match: 343809418, name: 'NorthPark Mall' },
    // Village of East Davenport (E 11th / Mound / Christie)
    { match: 676691246, name: "Bleyart's" },
    { match: 757996340, name: 'Colman Florist and Greenhouses' },
    { match: 757996557, name: 'Corner Deli' },
    { match: 676695597, name: 'Grilled Cheese Bar' },
    { match: 757997676, name: "Here's The Scoop Ice Cream" },
    { match: 757998136, name: 'Mississippi Fine Arts' },
    { match: 757996209, name: 'Religious Supply' },
    { match: 757998297, name: 'Star Salon and Spa' },
    // Kimberly Rd / Brady St / NorthPark area
    { match: 777204368, name: "Arby's" },
    { match: 777204352, name: 'Big Lots' },
    { match: 66410169, name: 'Shoe Carnival' }, // strip with Five Below, Dollar Tree, Citi Trends, Iowa DOT
    { match: 66410178, name: 'Tobacco Outlet Plus' },
    { match: 104472379, name: "Hero's Pub" },
    { match: 66406022, name: 'Time Bank' },
    { match: 777204372, name: "Sancho's Mexican Restaurant" },
    { match: 777204367, name: 'The Filling Station' },
    { match: 677192435, name: 'QC Power Equipment' },
    { match: 344525555, name: 'QC Antiques' },
    { match: 343600652, name: "Famous Dave's" },
    { match: 343600653, name: 'Los Portales' },
    { match: 343600657, name: 'Starbucks' },
    { match: 343600651, name: 'Runge Mortuary' },
    { match: 104453099, name: 'On Two Wheels' },
    { match: 104452319, name: 'IowaWORKS' },
    { match: 342659198, name: 'Dollar General' },
    { match: 1197582759, name: 'Innovative Dentistry' },
    { match: 1383642801, name: 'Rent-A-Center' }, // W Kimberly strip with Avis / Budget
    { match: 1383642802, name: 'Fannie May' },
    { match: 464914029, name: 'Amana Care Clinic' },
    { match: 102923970, name: "Rudy's Tacos" },
    { match: 592714218, name: 'Greenleaf Tobacco & Vape' },
    { match: 759847551, name: "Happy Joe's" }, // W Locust
    // Brady St north / 53rd St / Elmore Ave
    { match: 343602462, name: 'AutoZone' },
    { match: 343603552, name: 'Olympic Gyros' },
    { match: 343602449, name: 'Top Shape Gym' },
    { match: 343296262, name: 'Tooth & Nail Tattoo' },
    { match: 343296278, name: 'Two Men and a Truck' },
    { match: 466921068, name: 'Casa Loma Inn & Suites' },
    { match: 359697084, name: 'Holiday Inn Express & Suites Davenport North' },
    { match: 163600319, name: 'Flavors of India' },
    { match: 1528668470, name: 'Mission BBQ' },
    { match: 1528668468, name: 'UI Urgent Care' },
    { match: 342651447, name: 'Black Tie Flooring' },
    { match: 342652191, name: "David's Bridal" },
    { match: 342656739, name: 'Ashley HomeStore' },
    { match: 342655737, name: 'GameStop' },
    { match: 342655738, name: "Men's Wearhouse" },
    { match: 342650860, name: "DXL Men's Apparel" },
    { match: 674037266, name: 'Sally Beauty' },
    { match: 342657159, name: 'Active Endeavors' },
    { match: 342657155, name: 'Lane Bryant' },
    { match: 342657464, name: 'Panera Bread' },
    { match: 342670844, name: 'Great Clips' },
    { match: 755322476, name: 'Buffalo Wild Wings' },
    { match: 755317224, name: 'Los Agaves' },
    { match: 755316956, name: 'Bayside Tan' },
    { match: 784810261, name: 'Natural Grocers' },
    // Northwest Blvd / I-80
    { match: 235551492, name: "Denny's" },
    { match: 698709085, name: 'Minh Gourmet' },
    { match: 1381807524, name: 'Subway' },
    // footprints without an OSM id (Microsoft) or a node beside the building: by position
    { match: { x: 2693, z: -3735, r: 15 }, name: "McAlister's Deli" },
    { match: { x: 568, z: -5674, r: 12 }, name: 'Big 10 Mart' },
    { match: { x: -3940, z: -281, r: 25 }, name: 'Davenport Good Samaritan Center' },
    { match: { x: -4544, z: -1628, r: 12 }, name: "Dale's Service Center" },
    { match: { x: -1087, z: -4092, r: 12 }, name: 'Iowa Illinois Pest Control' },
    { match: { x: -9104, z: -1714, r: 15 }, name: 'New Life Baptist Church' },
  ],
  places: [
    // ---- Village of East Davenport: gateway signs, E 11th St street furniture, Lindsay Park
    { kind: 'sign', x: 2582, z: -820, text: 'VILLAGE OF EAST DAVENPORT', style: 'shop', w: 3.2, height: 2.4 },
    { kind: 'sign', x: 2812, z: -818, text: 'VILLAGE OF EAST DAVENPORT', style: 'shop', w: 3.2, height: 2.4 },
    ...[2605, 2640, 2675, 2715, 2750, 2785].flatMap((x, i) => [
      { kind: 'light', x, z: i % 2 ? -834.5 : -821.5 },
      { kind: 'prop', prop: i % 2 ? 'bench' : 'planter', x: x + 8, z: -834.5 },
      { kind: 'prop', prop: i % 2 ? 'planter' : 'bench', x: x + 8, z: -821.5 },
    ]),
    { kind: 'prop', prop: 'bin', x: 2620, z: -834.5 }, { kind: 'prop', prop: 'bin', x: 2730, z: -821.5 },
    { kind: 'prop', prop: 'bin', x: 2700, z: -834.5 }, { kind: 'prop', prop: 'newsbox', x: 2690, z: -834.5 },
    { kind: 'prop', prop: 'bench', x: 2586, z: -870 }, { kind: 'prop', prop: 'planter', x: 2599, z: -860 }, // Mound St
    { kind: 'sign', x: 2762, z: -722, text: 'LINDSAY PARK', style: 'shop', w: 2.6 },
    { kind: 'sign', x: 2923, z: -791, text: 'CAMP McCLELLAN 1861', style: 'shop', w: 2.2, height: 1.6 },
    { kind: 'statue', x: 2839, z: -628, scale: 1.2 }, { kind: 'statue', x: 2820, z: -634, scale: 1.0 }, { kind: 'statue', x: 2826, z: -626, scale: 1.4 }, // Lindsay Park sculpture park
    { kind: 'prop', prop: 'flagpole', x: 2808, z: -820 }, // Hose Station No. 4 / fire museum
    // ---- parks
    { kind: 'sign', x: 250, z: -2413, text: 'VANDER VEER BOTANICAL PARK', style: 'shop', w: 3.4 },
    { kind: 'sign', x: 3895, z: -1726, text: 'DUCK CREEK PARK', style: 'shop', w: 2.8 },
    { kind: 'sign', x: -2311, z: -850, text: 'FEJERVARY PARK', style: 'shop', w: 2.6 },
    { kind: 'sign', x: -5470, z: 900, text: 'SUNDERBRUCH PARK', style: 'shop', w: 2.6 },
    { kind: 'sign', x: -5284, z: -1982, text: 'EMEIS PARK', style: 'shop', w: 2.4 },
    { kind: 'sign', x: -8990, z: -10, text: 'WEST LAKE PARK', style: 'shop', w: 2.6 },
    { kind: 'sign', x: 2435, z: -747, text: 'INDIAN SPRINGS PARK', style: 'shop', w: 2.6 },
    { kind: 'sign', x: 1124, z: -1820, text: 'TYLER PARK', style: 'shop', w: 2.2 },
    { kind: 'sign', x: -320, z: -1708, text: 'MARIAN GROTTO', style: 'shop', w: 2.2, height: 1.8 },
    // ---- schools, campuses, venues
    { kind: 'sign', x: -170, z: -5646, text: 'NORTH HIGH SCHOOL', style: 'shop', w: 3.0 },
    { kind: 'sign', x: -4120, z: -1598, text: 'WEST HIGH SCHOOL', style: 'shop', w: 3.0 },
    { kind: 'sign', x: -841, z: -2440, text: 'ASSUMPTION HIGH SCHOOL', style: 'shop', w: 3.2 },
    { kind: 'sign', x: -200, z: -1630, text: 'ST. AMBROSE UNIVERSITY', style: 'shop', w: 3.2 },
    { kind: 'sign', x: 780, z: -3665, text: 'BRADY STREET STADIUM', style: 'shop', w: 3.0 },
    { kind: 'sign', x: -995, z: -3830, text: 'MID CITY HIGH SCHOOL', style: 'shop', w: 3.0 },
    // ---- Davenport Municipal Airport (KDVN): entrance sign on E 90th St at Harrison St, flags at the terminal
    { kind: 'sign', x: -125, z: -9676, text: 'DAVENPORT MUNICIPAL AIRPORT', style: 'pole', w: 4.2, height: 3.2, lit: true },
    { kind: 'prop', prop: 'flagpole', x: -600, z: -9675 }, { kind: 'prop', prop: 'flagpole', x: -596, z: -9670 },
    // ---- the 1.5 MG tank by Kimberly Rd & Northwest Blvd (OSM tags it on a way, so the builder doesn't draw it)
    { kind: 'watertower', x: -286, z: -3924, height: 40, text: 'IOWA AMERICAN WATER', color: 0xe9eef0 },
    // ---- roundabout islands (the rings are OSM): I-80 / Northwest Blvd, NorthPark (Welcome Way), north side
    { kind: 'roundabout', x: -1709.7, z: -8896, r: 16.3 },
    { kind: 'roundabout', x: -1827.9, z: -8883.6, r: 16.8 },
    { kind: 'roundabout', x: -2104.8, z: -8870.5, r: 15.2 },
    { kind: 'roundabout', x: 354.6, z: -5374.6, r: 6.5 },
    { kind: 'roundabout', x: 1858, z: -6770.6, r: 3.0 },
    { kind: 'roundabout', x: 752.6, z: -9665, r: 17.4 },
    { kind: 'roundabout', x: 3193.1, z: -7269.4, r: 16.8 },
    { kind: 'roundabout', x: 3672.4, z: -6609.9, r: 7.2 },
  ],
  models: [
    // Hose Station No. 4 (2301 E 11th St, 1931; International Fire Museum): front faces 11th St (north)
    { file: 'hosestation4', x: 2801.1, z: -806.7, ground: true, load: 500, clear: [[2801.1, -806.7, 2, 2]],
      solid: [[2801.1, -806.7, 4.3, 8.3, 9], [2798.6, -813.3, 1.6, 1.6, 13.5]] },
    // Lagomarcino's (2132 E 11th St): shopfronts on 11th St (south) and Christie St (east)
    { file: 'lagomarcinos', x: 2694.9, z: -869.25, ground: true, load: 500, clear: [[2694.9, -869.25, 2, 2]],
      solid: [[2694.9, -869.25, 6.7, 13.15, 10.5]] },
    // Davenport Municipal Airport FBO terminal + hangar (2011; 9230 Harrison St): replaces OSM way 37970516
    { file: 'dvnterminal', x: -638.75, z: -9627.55, ground: true, load: 1200, clear: [[-638.75, -9627.55, 2, 2]],
      solid: [[-638.75, -9627.55, 19.2, 24.4, 12.7, 0, 0.570], [-660, -9658, 12, 9, 9], [-624, -9603, 7, 4, 5]] },
  ],
  notes: 'Research and sources: docs/regions/davenport.md. Palmer College and Central High sit inside the downtown box '
    + '(davenport-downtown). Bettendorf-side businesses in this box are left to bettendorf.js.',
};
