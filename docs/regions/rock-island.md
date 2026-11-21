# Rock Island (incl. Arsenal Island and Andalusia)

Region module: `src/regions/rock-island.js`. Models: `assets/src/regions/rock-island/ri_models.py` (headless Blender) ->
`assets/models/regions/rock-island/*.glb`. Game coordinates come from OSM (tools/cache/chunks) through `project()`.
Already modelled elsewhere (not duplicated): Augustana Old Main, Circa '21 / Fort Armstrong, Clock Tower Building,
Lock & Dam 15 and the locks, Government Bridge, Centennial Bridge.

## Downtown ("The District", rebranded "Downtown Rock Island")
- Rebuild Downtown (2024-25, $8.7M): 18th St rebuilt from 1st to 3rd Ave, and 2nd and 3rd Ave from 18th to 19th St.
  The former lot at 2nd Ave & 18th St (where the Daiquiri Factory was) is now the Green Lawn (1801 2nd Ave), an event
  green. There is a mini roundabout at 2nd Ave & 18th St, ten patios, new street lighting and landscaping, and two
  murals in Arts Alley. Source: wvik.org 2024-04-15 groundbreaking; quadcitiesbusiness.com "Rock Island celebrating new energy".
- Steel ROCK ISLAND block letters, 4.5 ft tall, at 2nd Ave & 18th St beside the Green Lawn (yahoo/QC Times, photo contest article).
- Gateway arch "Welcome to Downtown Rock Island" at 1st Ave & 18th St, across from Schwiebert Park. It is installed,
  but no source describes its look. **The model is generic**: stone piers and a dark steel arch with lit lettering.
- The 1800 block of 2nd Ave runs as a festival street; the QC Farmers Market uses it on Saturdays, May-Oct
  (quadcitiesbusiness.com, 2025).
- 2nd Ave pedestrian mall: a 2026 survey sought input on reconstruction plans, including a gateway to Schwiebert Park.
  Nothing has been built yet.
- Businesses, verified:
  - RIBCO (Rock Island Brewing Co., 1815 2nd Ave): closed Dec 2023, reopened 19 Dec 2025 (quadcities.com).
  - Huckleberry's Great Pizza & Calzones, 223 18th St (MapQuest/Yellow Pages).
  - Rozz-Tox, 2108 3rd Ave (dice.fm, indieonthemove).
  - In OSM already: Bent River Brewing (512 24th St), Wake Brewing (2529 5th Ave), Jim's Rib Haven, Acapulco Cafe,
    Awake Coffee, NEST Cafe, Circa 21.
- Businesses, not used:
  - Blue Cat Brew Pub (113 18th St): status conflicts.
  - Theo's Java Club: closed or reopened, unclear.
  - Steve's Old Time Tap: no current source.
  - Daytrotter: moved away.
- Footprint matching is a guess: RIBCO is the 3-storey building nearest 1815 2nd Ave (OSM 542881923), and Rozz-Tox is
  OSM 876203315. Odd numbers sit on the north side of the avenues and the east side of the streets (WHBF-TV at
  231 18th St is OSM east side).
- Streets: avenues run east-west and are numbered from the river; streets run north-south. 1st Ave (IL 92) is a one-way
  pair downtown (OSM oneway). 4th Ave is one-way westbound downtown.

## Schwiebert Riverfront Park (101 17th St)
Opened 2010, named for former mayor Mark Schwiebert. Has a main stage and Great Lawn, a triangular lawn, a ground-level
fountain/splash pad, a playground, an observation shelter, art sculptures and the promenade (rigov.org facility 34;
visitquadcities; WQAD tour). Added: a park sign on 1st Ave and benches on the promenade. The stage and fountain
positions are not mapped yet.

## Rock Island Arsenal
- **Quarters One** (HABS IL-1001E, OCR'd from the DENIX PDF), built 1870-71 to Rodman's design.
  - Three-storey Italianate villa of smooth ashlar Joliet limestone, with rusticated quoins and a bracketed stone cornice.
  - Main block 74' x 52'. Truncated hip roof with a copper flat deck and a single pedimented gable to the north.
  - Four-storey square tower (19' x 11') centred on the EAST (front) elevation, with an arched walnut double door,
    a parapet and a tall third storey.
  - A one-storey porch with paired cast-iron columns wraps the east front and the east end of the north side. It ends
    south in a 19' x 18' porte cochere.
  - Rear wing 31' x 44', hipped. Two one-storey bay windows on the south. Three limestone chimneys.
  - About 20,000 sq ft (army.mil self-guided tour).
  - **Modelled** as `quarters1`, using the OSM footprint (way 704734357).
- **Stone Shops**: ten Joliet-limestone shops built 1867-93 under Rodman's plan (army.mil self-guided tour "Stone Shops").
  - Five on Armory Row, north of Rodman Ave: small arms. Five on Arsenal Row, south: equipment. The forge and foundry
    are the middle buildings.
  - LOC/HAER call them "Greek Revival stone shops on Rodman Avenue". Building 60 (Shop B) houses the Arsenal Museum.
  - The 1917-18 two-storey links (e.g. Building 61) are concrete with stone veneer (HAER IL-20, OCR).
  - Each shop is a U open away from Rodman Ave in OSM.
  - **Modelled** as `shops_n` and `shops_s` from the OSM outlines: three storeys of stone-headed windows, cornice,
    belt course and a pedimented centre on each Rodman Ave front. Roof form unverified (modelled flat, slate grey).
- Rock Island Arsenal Museum: Building 60, reopened 29 June 2023 after renovation (army.mil 268146).
- Mississippi River Visitor Center: overlooks Lock 15, with an indoor observation area and an outdoor deck
  (army.mil 220171). It is on Rodman Ave in OSM.
- Rock Island National Cemetery: 66.8 acres, east end of the island (nps.gov itinerary). Confederate Cemetery is on
  Rodman Ave (OSM).
- Access: the Moline gate Visitor Control Center (OSM, 23 Prospect Dr) issues passes.

## Rest of the city
- Water towers: six elevated towers (rigov.org/199).
  - In OSM, so the core already draws them: 38th St & 31st Ave, 24th St & 16th Ave, 24th St & 31st Ave, and
    9010 Ridgewood Rd (by the Southwest Branch library).
  - Added: 14th St & 42nd Ave, and 36th St & 14th Ave (in Old Horace Mann Park). The corner is guessed for both.
  - Also in OSM: a tower on the Arsenal (1736, 949).
- Rock Island Public Library, 401 19th St (1901-03, Drack & Kerns, Ionic / Italian Renaissance, sandstone frieze of
  twelve authors, 1986 addition). Not modelled: no description of the facade was found.
- Old Rock Island County Courthouse: demolished in spring/summer 2023, and the site was landscaped (WVIK 2023-12-06).
  The Justice Center (OSM) remains.
- Longview Park, 1300 17th St, 39 acres: 1937 WPA conservatory, Whitewater Junction water park, disc golf
  (Wikipedia). Sign added.
- Quad City Botanical Center, 2525 4th Ave: sign added.
- Schools:
  - Rock Island High School, 1400 25th Ave: sign added.
  - Alleman High School, 1103 40th St: not in OSM. A sign was placed at 40th St & 11th Ave; which side is guessed.
  - Augustana College: sign at 38th St & 7th Ave. Campus buildings are named in OSM.
- Andalusia: village of about 1,184 people at the west edge of the map. IL 92 runs as 6th Ave E / 78th Ave W.
  Lions Park, Andalusia Slough (2 mi west, off the map) (Wikipedia; villageofandalusiail.org). Welcome sign on IL 92.
- Bally's Quad Cities Casino & Hotel (777 Bally Blvd) is named in OSM.

## Checks (headless, tools/scan-placement.mjs --box)
- Boxes scanned:
  - -300,1100,3200,3000 (downtown, Arsenal west, Augustana): 209 tiles, 0 violations.
  - -300,3000,3200,6400 (south Rock Island): 342 tiles, 0 violations.
  - 1000,100,5100,1100 (Arsenal): 115 tiles, 0 violations.
  - -11750,9000,-10600,9900 (Andalusia): 35 tiles, 0 violations.
  - -3200,6800,-2600,7400 (Bally's): 15 tiles, 0 violations.
- Every place was built: none dropped or moved more than 7 m. Names were applied, and the clear boxes removed the OSM
  shop and Quarters One footprints.
- Ground: the shop rows span about 3.5 m of terrain, so dy lifts them (north 0.6, south 1.0) and the -3 m walls hide
  the gap at the low end.
