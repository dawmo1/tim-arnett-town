# Davenport (outside downtown): research notes

Region module: `src/regions/davenport.js`. Models: `assets/src/regions/davenport/davenport.py` ->
`assets/models/regions/davenport/*.glb`. Game coords: x = east m, z = south m from 3rd & Main
(x = dlon * 83,370, z = -dlat * 110,574). Town-wide street, neighbourhood and strip notes are in `docs/references.md`
sections 2-4 (not repeated here). [G] = my guess.

## What OSM already gives
- ~740 named buildings in the box (outside the downtown box), incl. NorthPark anchors, Hy-Vees, St. Ambrose halls,
  Lujack's on Harrison, the Elmore / 53rd big boxes, East Village bars. The module only fills gaps.
- Gaps filled: buildings whose OSM name sits on a site polygon or a node inside the footprint (matched by
  point-in-polygon against the tile data, Overpass, Nov 2026): hospitals, 12 schools, ~70 shops/restaurants.
- Water towers: 4 OSM point towers are drawn by the core. The 1.5 MG tank by Kimberly Rd & Northwest Blvd (NorthPark)
  is an OSM way, so the module adds it (Iowa American Water logo on one side, city logo on the other: amwater.com
  press release).
- Roundabouts: 8 OSM rings (I-80 / Northwest Blvd interchange x3, Welcome Way, north-side subdivisions, E 90th St);
  the module adds the islands, radius = ring radius - half the road width - ~0.6 m.

## Places
- **Village of East Davenport** (NRHP 1980, 1848-1910 stock; shops on E 11th St, Mound St): Lagomarcino's (2132 E 11th,
  confections + soda fountain, here since 1997; "pastel" front per travel press), Bayside Bistro (1105 Christie),
  11th Street Precinct, Grumpy's, McClellan Stockade, Rudy's Tacos, Baked Beer & Bread (1113 Mound), Village
  Theatre (old East Turner Hall), Grilled Cheese Bar, Here's The Scoop, Corner Deli, Colman Florist. Street: E 11th
  is a two-lane street with kerb parking; benches, planters and lamps added along it [G: spacing].
  Sources: en.wikipedia.org/wiki/Village_of_East_Davenport; lagomarcinos.com; visitquadcities.com/listing?id=1913;
  islands.com (2025 feature).
- **Hose Station No. 4** (2301 E 11th St, 1931; International Fire Museum since 1986): red brick Italianate, brick
  quoins, hipped tile roof, one dormer over the front, a single pair of engine doors on 11th St with two large
  windows above, side pedestrian door, short hose-drying tower at the rear. NRHP 1980.
  Sources: en.wikipedia.org/wiki/Hose_Station_No._4; iowapbs.org historic buildings clip 13494.
- **Lindsay Park** (31 acres, 2200 E 11th): Camp McClellan parade ground (1861), sculpture park along the riverfront,
  ballfields, yacht club / boat docks. No bandstand found. Source: en.wikipedia.org/wiki/Lindsay_Park_(Davenport,_Iowa);
  davenportiowa.com parks page.
- **Duck Creek Park** (211 acres, 3300 E Locust): 1930s public-works park, 18-hole golf course, Duck Creek Lodge,
  Stampe Lilac Garden & Gazebo (wedding site; position not found, not modelled). Source:
  en.wikipedia.org/wiki/Duck_Creek_Park_and_Golf_Course; cityofdavenportiowa.com park listing.
- **Fejervary Park** (75 acres, west end): old Mother Goose Land zoo (1909-2008), only the carriage barn and the Mother
  Goose entryway remain; aquatic centre. Source: en.wikipedia.org/wiki/Fejervary_Park.
- **Vander Veer Botanical Park** (33 acres, 1885, ex fairgrounds; conservatory, Grand Allee, rose garden, fountain,
  lagoon): conservatory and fountain already modelled in landmarks. Source: en.wikipedia.org/wiki/Vander_Veer_Botanical_Park.
- **Annie Wittenmyer Complex** (Iowa Soldiers' Orphans' Home, 2800 Eastern Ave, 1865; NRHP 1982): cottage plan,
  Administration Building c.1890 by John W. Ross. OSM names its buildings "Building A-K"; renamed to the complex.
  Which footprint is the Administration Building is not clear, so it is not modelled.
  Sources: en.wikipedia.org/wiki/Iowa_Soldiers'_Orphans'_Home; blogs.davenportlibrary.com (2017-06-23).
- **Davenport Municipal Airport** (KDVN, 9230 Harrison St): runways 15/33 5,511 x 100 ft and 3/21 4,001 x 100 ft,
  concrete; Quad City Air Show since 1987. 2011 FBO: 7,460 sq ft terminal + 20,000 sq ft hangar, built by Carver
  Aero (became Revv Aviation 2022; Jet Air bought the FBO in 2026). The OSM terminal way 37970516's 38 x 49 m main
  block is the hangar (1,870 m2 = 20,000 sq ft); its north wing is the terminal. Entrance: E 90th St from Harrison.
  Sources: en.wikipedia.org/wiki/Davenport_Municipal_Airport_(Iowa); rebusinessonline.com (28,000 sq ft complex);
  ainonline.com 2026-03-16.
- **Schools / campuses** (OSM sites): Davenport North (626 W 53rd), West (3505 W Locust), Assumption (1020 W Central
  Park), Mid City (3801 N Marquette), Williams, Wood, Sudlow intermediate schools; St. Ambrose University (Locust &
  Harrison; Ambrose Hall already modelled). Palmer College and Central High are inside the downtown box.
- **Hospitals**: MercyOne Genesis West (1401 W Central Park), MercyOne Genesis Davenport (1227 E Rusholme; the
  skybridge over Rusholme is OSM building=bridge).

## Streets checked (data/roads)
- **E 53rd St, Brady to Elmore**: rebuilt and widened 2019-23 to four lanes plus a centre left-turn lane
  (davenportiowa.com "Phase II E 53rd St"; whoradio 2023-12-14). The data still has it as a 2-lane, 11 m road from
  x 1105 to 3511 (z ~-5640..-5664) and 1-lane one-way pairs west of x 832. Needs a core/OSM fix (see report).
- **US 61 / N Harrison St north of I-80** (x ~-90..280, z -9600..-8300): divided highway drawn as two 1-lane, 4.8 m
  one-ways; real road is 2 lanes each way [G from aerial memory; confirm].
- Brady (NB) / Harrison (SB) one-way pair: 3-4 lanes, 13.8-17 m: plausible. Kimberly Rd: divided pairs east of
  NorthPark, 13 m rural 2-lane west of x -4480 (with shoulders): plausible.
