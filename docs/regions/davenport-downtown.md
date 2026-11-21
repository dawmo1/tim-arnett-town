# Davenport downtown + riverfront (region `davenport-downtown`)

Notes for `src/regions/davenport-downtown.js` and the models in `assets/src/regions/davenport-downtown/build.py`.
General downtown facts (one-way history, streetscape standard, tower heights) are in `docs/references.md` section 1.
"(unverified)" = one weak source or general knowledge.

## Grid in game metres (from data/roads)

- E-W streets: 5th St z -116, 4th St z 8, 3rd St z 131, 2nd St z 252, River Dr z 367 / 378 (twin carriageways).
- N-S streets: Gaines x -447, Western x -323, Scott x -199, Ripley x -77, Harrison x 46, Main x 168, Brady x 292,
  Perry x 413, Pershing x 535, Iowa x 658.
- **Address numbering splits at Brady St, not Main** (correcting references.md): 100 W = Brady-Main, 200 W = Main-Harrison,
  300 W = Harrison-Ripley, 400 W = Ripley-Scott ...; 100 E = Brady-Perry, 200 E = Perry-Pershing, 300 E = Pershing-Iowa.
  Even numbers on the north side of E-W streets. Checked against OSM-tagged addresses (Wells Fargo 203 W 3rd, Kilkenny's
  300 W 3rd, Adler 136 E 3rd, Hotel Blackhawk 200 E 3rd, DoubleTree 111 E 2nd, Sippi's 406 W 2nd, GAHC 712 W 2nd).
- N-S numbering: River Dr-2nd = 100 block, 2nd-3rd = 200, 3rd-4th = 300; odd numbers on the east side
  (Library 321 Main, Forrest Block 401 Brady).

## Modelled places

- **Kahl Building + Capitol Theatre**, 326 W 3rd St (NE corner 3rd & Ripley), 1920, Arthur Ebeling; theatre interior Rapp &
  Rapp; 1925 seven-storey stage house (Clausen & Kruse). Ten storeys, 146 ft (45 m), white terra cotta over steel, Chicago
  School after Sullivan's Wainwright: ornament heavier low down, continuous piers with recessed spandrels, paired round-arch
  windows in the top storey, elaborate cornice. Capitol marquee on 3rd St; vertical CAPITOL blade sign (unverified look).
  Now ~65 apartments + the restored theatre. OSM footprint (L-shaped) 166629453 = Capitol 1521136855.
  Sources: en.wikipedia.org/wiki/Kahl_Building; cinematreasures.org/theaters/1193; wvik.org 2021-05-28.
- **Union Station + Burlington Freight House**, 120 S Harrison St, 1924, Georgian/Colonial Revival. Two storeys of tan brick on
  concrete; twin facades (south to the tracks, north to the River Dr lot), each a stylised temple front of four attached
  square columns under a dentilled entablature with medallions; arched first-floor windows with concrete keystones; heavy
  cornice; deep awnings over the entrances. One-storey freight house in the same brick, concrete band at the cornice, oversized
  dock doors; a wood post-and-beam shelter joins them. NRHP 1983. Iowa Welcome Center / Visit Quad Cities Destination Center
  since 2022. Roof form not documented (modelled as a low hip behind the parapet, unverified).
  Sources: en.wikipedia.org/wiki/Union_Station_(Davenport,_Iowa); wvik.org 2022-11-30; visitquadcities.com.
- **The Freight House** (Chicago, Milwaukee, St. Paul & Pacific Freight House), 421 W River Dr / 102 S Ripley, 1917, on the
  levee across Ripley from Union Station. Brick walls, concrete floors/columns; two-storey office block at the east end,
  one-storey warehouse to the west; NRHP 1985. Now the year-round Freight House Farmers Market (outdoor stalls May-Oct),
  Front Street Brewery taproom, Antonella's II, Boozie's. Canopy, garage-door glazing and sign placement are unverified.
  Sources: en.wikipedia.org/wiki/Chicago,_Milwaukee,_St._Paul_and_Pacific_Freight_House; freighthousefarmersmarket.com;
  downtowndavenport.com/explore/dining.
- **Dillon Memorial** (1918, Ware & Ware with Paul Schulz), foot of Main St south of River Dr; stood in the middle of Main until
  the 1997 plaza. Fluted marble column (30-40 ft; sources differ) with a bronze beacon lantern; water from lion heads into a
  raised basin; lion-head and garland panels on the base. NRHP 1983.
  Sources: en.wikipedia.org/wiki/Dillon_Memorial; rcreader.com "Art in Plain Sight: Main Street fountains".
- Not modelled (ideas for later): Redstone Building / River Music Experience (1892, 129 Main, modelled on Chicago's Rookery;
  now "Common Chord", Redstone Room moved to the ground floor 2026); German American Heritage Center (712 W 2nd, Germania /
  Miller / Standard Hotel, 1871-76, four storeys per NRHP); Davenport Public Library main (321 Main, 1968).
  The Hotel Davenport (324 Main, 1907) partly collapsed 28 May 2023 and was demolished: do not model it.

## Businesses (downtowndavenport.com, Nov 2026) and where they were matched

Matched to OSM buildings by address block/side (names[]): Me & Billy (200 W 3rd), Style District 220, Bootleg Hill Honey Meads
(226 W 3rd), Source Bookstore (232 W 3rd), 392 Caffe (502 W 3rd), Del-Rich Pawn (318 Brady), Devon's Complaint Dept. (304 E 3rd,
replaces OSM's Triple Crown), Barrel House 211 (211 E 2nd), Raccoon Motel (315 E 2nd), Habano Cigar Lounge (432 E 4th),
Front Street Pub & Eatery (208 E River Dr), Stompbox Brewery (210 E River Dr). OSM already has Kilkenny's, Carriage Haus,
Mac's Tavern, Daiquiri Factory, Mantra, Antonella's, The Office, Sippi's, Armored Gardens, Great River Brewery, Artisan Grain.
Not placed (no separate footprint / unsure): Duck City Bistro 115 E 3rd (in Union Arcade), Soi 3 102 E 3rd, Cru 221 Brady,
M Lounge 217 Brady, Maldon 229 Brady, Neat Stuff 320 Brady, Brady St. Blends 423 Brady, Greyhound Lounge 310 N Main,
NEEKO 410 N Main, The Half Nelson 321 E 2nd, Mississippi River Distilling lounge 318 E 2nd, Blue Spruce 217 E 2nd,
Ragged Records/Trash Can Annie 311 E 2nd, Redband Coffee 329 E 4th, Soul Ties 118 E 4th, Abernathy's 432 W 3rd, Doodads 430 W 3rd,
Hot Glass 104 Western, Chocolate Manor 110 E 2nd, The Current Iowa hotel 215 N Main (in the modelled Putnam), Me & Billy's
neighbours on 300 N Main.

## Public art

- Alternating Currents Mural Fest (2023-): Emerson Place alley, five garage-door murals on the rear of 221 E 2nd (2023);
  "Once Upon Motor Row" (Atlanta Dawn, 2026) at Klemme Motorsports 301 E 3rd: vintage Firestone / Mobil ads, newspaper look;
  "Carry Love with You" (Andrey Key Detail, 2026) at Ragged Records 311 E 2nd; "Parking in Technicolor" (Molly Keen, 2025)
  inside the RiverCenter ramp walkway; 2024 fest along 3rd St. MLK Park mural (Cbabi Bayoc, June 2026) at 5th & Brady by the
  MLK Interpretive Center (501 N Brady) - not placed (wall unknown).
- Rotating Quad City Arts sculptures on 2nd St: "The Nature of Healing" (Tim Adams) outside The Current at 2nd & Main;
  "Wending" (Ted Sitting Crow Garner) at the W 2nd parking ramp.
- Bix 7 runner sculptures (Ted McElhiney) - location not found.
  Sources: downtowndavenport.com/explore/public-art and /acqc-mural-fest pages; quadcities.com (Emerson Place); wvik.org 2026-06.

## Riverfront

- LeClaire Park (bandshell, ballpark, Skybridge landing) west of Main; **Main Street Landing**: a 10-acre park from Main St east
  toward the roller dams (Lock & Dam 15), Sasaki design, ARPA-funded, construction from 2025: adventure play tower, roller-dam
  slides, splash pad / water feature, multi-use court that is an ice rink in winter, Main St plaza entry, hillside overlook,
  picnic area; key parts sit above the frequent flood stage. Only the sign, benches, bins, lights and trees are placed
  (no place kind for a play tower / splash pad).
  Sources: cityofdavenportiowa.hosted.civiclive.com/mainstreetlanding; sasaki.com/projects/davenport-main-street-landing.
- Davenport has no flood wall; the trail along the river is the Mississippi River Trail.

## Data problems seen in this box (game metres)

- Heights: Davenport Public Library 166628871 (207, 42) is 41.5 m (real ~2 storeys); MidAmerican Energy Building 553131188
  (324, 228) is 23.4 m (real 66 m, 15 floors); parking ramps 166628869 (83, 165) 43.7 m and 553140316 (353, 213) 44.5 m
  (real ~5 levels); Scott County Community College 553109000 (232, 165) 46.2 m; unnamed 104392549 (889, 65) 46.9 m,
  573330331 (743, 43) 46.7 m, 758725699 (608, -35) 44.1 m, 675907790 (-639, -32) 40 m, MS footprint (-372, 188) 44.3 m.
- River Dr (23300-23308, 10096-10097, 21048, 23070, 9689, 19949): twin one-way carriageways only ~10 m apart, each tagged
  4 lanes / 17 m (or 14.2 m), so the two overlap by ~7 m. Real River Dr downtown is 2 lanes each way with turn lanes
  (unverified count).
- 3rd St (18746, 22719, 9588-9590) is 1+1 / 9.5 m; since 6 Nov 2025 it is 1+1 with a centre turn lane (~12-13 m).
- Ground Transportation Center 166629443 (x -69..36, z 312..360) reaches 1.3 m into River Dr's north carriageway.
- Duplicate Microsoft footprints on top of each other at (226, 499), (461, 454) and (819, 179).
