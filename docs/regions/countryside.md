# Countryside, highways and rivers

Region module: `src/regions/countryside.js` (bounds = the whole map, only things outside the town boxes, plus Black
Hawk State Historic Site). Models: `assets/src/regions/countryside/countryside.py` (headless Blender, one model per
run: `Blender -b --factory-startup -P countryside.py -- lodge`), GLBs in `assets/models/regions/countryside/`.

Most of the map is inside a town box: the boxes that are left outside are roughly x 25150-33350 (I-80, I-88 and
the Hennepin Canal between Colona and Geneseo), x > 37750, x < -11750 (Buffalo IA, Andalusia IL) and the far
south / north strips. Facts marked (unverified) had no source found.

## Map facts checked against the bbox

- Map bbox (tools/map-config.mjs): 41.400-41.625 N, 90.720-90.120 W. **Iowa 80 Truckstop, Walcott** (41.60 N,
  90.78 W) is about 5 km west of the map edge, so it is out. The nearest real interstate truck stop outside the town
  boxes is the **Hillsdale Express Lane** at I-88 exit 10.
- Interchanges outside the town boxes (OSM motorway_junction): the I-80 / I-74 / I-280 "Big X" south-east of
  Colona (x 19900-21300, z 9100-9900), I-88 exit 6 (IL 92, Joslin; x 27700-28300, z -3300..-4000) and I-88 exit 10
  (IL 2 / Moline Road, Hillsdale; x 31900-32200, z -8900..-9900). I-80 exit 19 (IL 82, Geneseo) is in the geneseo box.
- At the Big X, OSM routes I-80 westbound off as a one-lane ramp to the north (Colona, the river bridge) while the
  through lanes carry on as I-280 west / I-74 east; I-74 runs south toward Galesburg. The gantries follow that.
- No rest area, welcome centre or water tower in OSM outside the town boxes. No commercial grain elevator either:
  the elevators are in the towns (left to the town agents).

## Black Hawk State Historic Site (Rock Island)

- 207-208 acres on the bluff above the Rock River (south edge: ~150 ft bluff); 4-6 miles of marked trails;
  Singing Bird Nature Center in the north-west of the park. Sources: [Wikipedia](https://en.wikipedia.org/wiki/Black_Hawk_State_Historic_Site),
  [IL DNR](https://dnrhistoric.illinois.gov/experience/sites/site.black-hawk.html),
  [Visit Quad Cities](https://visitquadcities.com/media-qc/insiders-blog/forest-in-the-middle-of-urbanscape).
- **Watch Tower Lodge**: designed 1932 by state architect Joseph Booton, built 1934-42 by the CCC (opened 19 July
  1942), native limestone and rough-hewn timber; three buildings joined by a covered walkway: the Hauberg Indian
  Museum, a CCC museum and the central meeting hall. Main room: cedar timber vaulted ceiling, two floor-to-ceiling
  stone fireplaces, 1936 WPA murals by Otto Hake. A loggia with a stone floor, a terrace with a guardrail.
  NRHP 1985. Sources: [Waymarking](https://www.waymarking.com/waymarks/wm1Z7N_Black_Hawk_Lodge_and_State_Park_Rock_Island_Illinois),
  [Farnsworth Group restoration page](https://f-w.com/node/736), [Living New Deal](https://livingnewdeal.org/sites/black-hawk-state-historic-site-watchtower-lodge-murals-rock-island-il/),
  [Illinois State Park Lodges thematic NRHP](https://npgallery.nps.gov/AssetDetail/NRIS/90001679).
- Footprint: OSM way 628712511 (~86 x 32 m): west block 23 x 31 m, central hall 34 x 18 m, walkway 18 x 10 m,
  small east block. Which block is the museum and the roof forms are (unverified): modelled as gabled cedar-shingle
  roofs, the tallest over the hall, chimneys on the hall's east gable and north wall.

## Hennepin Canal (Hennepin Canal Parkway State Park)

- Built 1890s-1907; the first American canal built of concrete without cut-stone facing; locks 170 x 35 ft
  (52 x 11 m); fourteen locks had Marshall gates (unique to the Hennepin, hinged on a horizontal axis); five locks
  restored to working order but unused. Sources: [IL DNR park page](https://dnr.illinois.gov/parks/about/park.hennepincanal.html),
  [Army Corps 115 years article](https://www.army.mil/article/262168/chicago_district_celebrates_115_years_of_the_hennepin_canal).
- Western section falls west to the Rock River: Lock 29 at Colona (colona box), 28 in old Colona (colona box),
  27 (x 22720, east-moline box), **26** (x 26258-26324, z 5557-5569, outside all boxes), 24 by Geneseo (geneseo box).
  OSM has a weir at Lock 26's upper end, a trail bridge (the Parkway, way 142285224) over its lower end and the
  Lock 26 campground just south. An aqueduct (way 1051665349) at x 33000, z 4690.
- Lock 26 water lift ~2.5 m and the gate leaf look are (unverified).

## Interstates

- I-88 exit 10: Express Lane, 32000 IL 2 (Moline Road), Hillsdale: Shell fuel, 24/7, diner, ~50 truck spaces, CAT
  scale #770 (OSM), Subway. Store and both canopies are mapped in OSM (ways 1558244314/5/6). Sources:
  [Truck Stop Report](https://www.truckstopreport.com/USA/Illinois/IH88/index.html), [AllStays](https://allstays.com/truckstops-details/91578.php),
  [GasBuddy](https://test.gasbuddy.com/station/114059), [iExit](https://www.iexitapp.com/Illinois/I-88/Exit%2010/10022).
- I-88 exit 6: IL 92 west to Joslin (OSM destination tags). The Tyson beef plant at Joslin is closed (OSM note).
- Guide signs: MUTCD green, white legend and border; overhead box-truss gantries at system interchanges, ground
  mounts on the right shoulder at rural diamond exits; mile markers on the right shoulder. Mile numbers here are
  interpolated from the exit numbers (I-80 exit 19 = mile 19; I-88 exits 6 and 10), so they can be ~100 m off.
- Billboards: 14 x 48 ft bulletins on steel monopoles with a catwalk and lamps along rural interstates (unverified
  for these exact spots; the ads are invented local ones).

## Not here (town boxes)

- Rock River dams / Sears dam, Sunset Park, Lock & Dam 14 and 15, the I-80 / I-280 / I-74 river bridges and any
  Welcome to Iowa / Illinois signs are inside town boxes (port-byron, le-claire, rock-island, milan, davenport).
