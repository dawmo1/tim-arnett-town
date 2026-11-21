# Moline (region `moline`)

Module: `src/regions/moline.js`. Models: `assets/src/regions/moline/moline.py` -> `assets/models/regions/moline/*.glb`.
Already modelled in core (not duplicated here): John Deere Pavilion, Deere & Co. World HQ, Vibrant Arena, the QCIA
terminal / tower / Elliott hangar, the I-74 arches. Coordinates are game metres (`tools/map-config.mjs` `project()`).

## What the city looks like (research notes)

- **Downtown ("Moline Centre")**: a street grid turned about 26 degrees. Numbered avenues run east-west and streets run
  north-south. 5th Ave is the main street; its streetscape runs from 12th to 19th St. Buildings are 1890-1930 brick,
  2-5 storeys, with the LeClaire (15 floors), KONE Tower and KONE Centre above them. River Dr runs along the river past
  the arena and John Deere Commons; it is dual carriageway at the Commons. See `docs/references.md` section 6.
- **Businesses on 5th / 6th / 4th Ave, River Dr and the cross streets** (molinecentre.org directory, read Nov 2026).
  Each is matched to the OSM building on its block face, ordered by street number (see the module's `names`). Examples:
  Bent River Brewing 1413 5th Ave, Lagomarcino's 1422 5th Ave (already OSM), Take Cover Tiki Club 1401 (OSM),
  O'Keefe's 1331, Tony's Chicago Style Pizza 1321, Meli's Pancake House 1320, Le Mekong 1606, Fifth Avenue Syndicate
  1630, The Black Box Theatre 1623, Atlas Collective 1801, Central Craft 1810, The Spotlight Theatre 1800 7th Ave,
  Johnny's Italian Steakhouse / John Deere Store 1300 River Dr, Pop the Cork 1500 River Dr, Sins Tavern 1522 River Dr.
  Not placed (no matching building face): Bad Boyz Pizza 313 16th St, Arlo & Elm 417 14th St, Trimble Funeral Home
  701 12th St, River House 1510 / The Other Bar 1534 / Simply Amish 1505 / Renew Moline 1506 River Dr (OSM has one
  building for the whole River Dr block), Corazon Latino 1514 and Fatwoods 1516 5th Ave (only the named Old National
  Bank / University Club buildings on that face).
- **LeClaire Hotel** (421 19th St, OSM 41.5086, -90.5114): Kirsch & Kolb, 1921-22, 15 storeys, 51 m, reinforced
  concrete. Brick with a stone ground floor and mezzanine, symmetrical front with a round-arched entry flanked by
  round-arched windows, belt courses, deep bracketed eaves. NRHP 1994; now LeClaire Apartments.
- **Wharton Field House** (1800 20th Ave): William Schulzke, opened 21 Dec 1928, ~6,000-7,250 seats, home of the
  NBL / NBA Tri-Cities Blackhawks 1946-51 and Moline HS (Maroons). Next to Browning Field. The OSM footprint is
  45.6 x 60.2 m. Unverified: the shallow barrel roof, the arched three-bay entrance front and the brick colour (from
  memory of photos; no text source found).
- **Deere-Wiman House "Overlook"** (817 11th Ave): built 1872 for Charles Deere on the bluff, attributed to William
  LeBaron Jenney, Swiss-villa / chalet style in clapboard. After the 1899 fire, the steep roof was replaced by a shallower
  one over a full third floor. The 1908 work added rounded bays (NE living room, south breakfast room), and a domed
  steel-framed conservatory replaced the SE porch. Local landmark 2024. **Butterworth Center "Hillcrest"** (1892,
  1105 8th St) is the neighbouring house. Unverified: paint colours (modelled cream with dark green trim).
- **WIU Quad Cities riverfront campus** (3300 River Dr): Phase I (2012) is the former John Deere Technology Center
  donated by Deere (OSM "Quad Cities Complex", renamed). Phase II Riverfront Hall (2014) is LEED Gold, ~95,000 sq ft.
  A Phase III building was planned but not confirmed built.
- **SouthPark Mall** (John Deere Rd / 16th St): 802,000 sq ft. 2014 redevelopment demolished Sears + food court and
  added new entrances and monument signs. Sold by Macerich to Kohan, April 2025.
- **Parks**: Prospect Park (1889, Echo Lake, historic dance pavilion, 2.1 mi path). Riverside Park, on the river
  side of Riverside Cemetery, has diamonds, a pond, shelters and trails. Ben Butterworth Parkway is the riverfront trail
  park east of WIU, and the Great River Trail runs along the river past the Commons.
- **The Bend / Bend XPO** (922 Mississippi Pkwy) are in **East Moline**, on the former Case IH site, so they are
  left to the east-moline agent.
- **Moline High School**: 3600 Avenue of the Cities, OSM building relation r11183728 (270 x 150 m). Named here.
- **Water towers**: four OSM `man_made=water_tower` nodes in Moline proper (41.49861,-90.52818; 41.49608,-90.51424;
  41.51151,-90.51446; 41.49772,-90.47767). No source found for their colours or lettering, so they are modelled
  pale blue-grey with "MOLINE".
- **Statues**: "Deere" statue at the Commons (OSM 14093094143), the "Bling" Rocky statue at WIU (5771122062), and the
  Deere Cross monument (7602897434).

## Sources

- molinecentre.org: /eat-and-drink, /shopping, /services, /attractions (business addresses)
- en.wikipedia.org/wiki/LeClaire_Hotel; en.wikipedia.org/wiki/Wharton_Field_House; en.wikipedia.org/wiki/Moline_High_School
- butterworthcenter.com/overlook, butterworthcenter.com/hillcrest; rcreader.com (Deere-Wiman landmark status)
- wiu.edu/qc/about/history.php; wvik.org 2014-09-03 (WIU QC phase 2); tradelineinc.com (WIU riverfront campus)
- en.wikipedia.org/wiki/SouthPark_Mall_(Illinois); wvik.org 2014 SouthPark renovation stories
- wqad.com 2018-07-18 (Prospect Park history); wqad.com virtual tour of Riverside Park; visitquadcities.com
- commercialcafe.com / cvent.com (The Bend, Bend XPO, East Moline)
- OpenStreetMap via tools/cache/chunks (positions, footprints, water towers, statues, trails)

## Open issues / to do

- Model the SouthPark Mall entrance, WIU Riverfront Hall and Moline High School.
- Check whether John Deere Rd and Avenue of the Cities need `median` strips between their carriageways.
- Placement scan results are in the agent report.
