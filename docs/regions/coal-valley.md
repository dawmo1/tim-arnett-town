# Coal Valley, Niabi Zoo and Oak Grove (region `coal-valley`)

Module: `src/regions/coal-valley.js`. Models: `assets/src/regions/coal-valley/coal_valley.py` (background Blender,
`Blender -b --factory-startup -P coal_valley.py -- <name>`), GLBs in `assets/models/regions/coal-valley/`.
Game coordinates are from OSM (Overpass, 2026-11) through `tools/map-config.mjs` `project()`.
"(unverified)" = no source found; check against Street View before relying on it.

## Coal Valley village

- Village in Rock Island and Henry counties, pop. 3,873 (2020), 3.17 sq mi, mostly residential suburb. [W]
- Coal Valley Mining Company formed 1856 and named the town; mining boomed 1850s-1870s and ended 1942. Village
  incorporated March 1876 (first board 22 April 1876). [W][H]
- 1892-93 town hall built "identical to Orion's town hall" (under $3,000); 1900 one-storey fire station; Highway 150
  through the village 1929; Coal Valley High School 1939-1952. Whether the 1892 hall survives: unverified. [W]
- **Municipal Center, 900 1st Street** (built 2002): village hall, police, township, assessor and the Robert R. Jones
  Library. OSM: hall way 544439149 (~9665, 8884), library way 544439148 behind it; 1st Street runs N-S at x ~9717. [V]
  Look (one-storey brick, hipped shingle roofs, portico) is unverified; modelled as `cv_municipal`.
- Roads: **US 6 = 1st Avenue** (E-W, z ~7860); **1st Street** is the N-S main street (x ~9706-9832, z 7917-10247);
  **US 150** comes in from the south-west and runs along **23rd Avenue** (z ~10400-10580), leaving south-east.
  CR 77 = **Niabi Zoo Road**, from US 6 at (10753, 7879) to the zoo. (OSM ways.) The village's "Highways 6 and 150"
  corridor report exists (coalvalleyil.org/docs/CoalValleyHighways6and150FINALReport.pdf) but was too large to read.
- Businesses (OSM): Happy Joe's, Rudy's Tacos, Country Style Ice Cream, Mulligan's Valley Pub, Subway (strip at
  ~9450-9500, 7797 on 1st Ave); Dollar General (108 W 1st Ave); BP + 7-Eleven (1st Ave & 1st St); Fareway under
  construction at 109 1st Street (~9829, 7906). Blackhawk Bank at 200 1st St (no OSM building; Microsoft footprints
  only). Township Hall 104 W 1st Ave (not placed). [S1]
- Parks [P]: Coal Valley Municipal Park (1000 1st Street: enclosed shelter, tennis, ball diamond, playground; OSM
  "Coal Valley City Park" 9513, 9136); Post Office Park (115 E 22nd Ave; OSM 9776, 10407); Stanley B. Engstrom Park
  (405 E 19th Ave; not located in OSM, not placed); West 5th Street Park. Veterans Memorial Park (OSM 9277, 8138).
- School: Bicentennial Elementary (Moline-Coal Valley SD 40; OSM 884842733 at 9641, 9026). Henry County part is
  Orion CUSD 223. [W]
- Churches (OSM): Coal Valley Baptist, St Maria Goretti Catholic, First Bible Missionary, First Presbyterian,
  Trinity Lutheran.
- Water tower: OSM has one `man_made=water_tower` at (10813, 10187) (south-east side); the core already draws it from
  the tile data. No source on its paint or lettering; a second tower near the centre is unverified, so none added.
- Oakwood Country Club (13153, 8745) hosted the Hardee's Golf Classic 1986-94 (later the John Deere Classic). [W]
- **Black Hawk College Quad Cities campus** is in Moline (34th Ave area), not in Coal Valley; the village lists it
  as "Black Hawk College, Moline" [H]. Nothing added for it here.

## Niabi Zoo

- 40-acre zoo inside a 287-acre Rock Island County Forest Preserve; ~600 animals, ~200 species; open April-October.
  Roots: McLain's Wild Animal Farm 1959; zoo founded 1963; "Niabi" (Osage) = "the fawn spared by the hunter". [Z]
- Timeline [Z]: train 1975 (first the Mel McKay Express, a 1/3 Civil War-era replica); Bird House 1985 (now
  Biodiversity Hall); bald eagle exhibit 2003; gibbons and Australia walk-about 2005; **Passport to Africa 2007**
  (giraffes with a public feeding platform and giraffe house, colobus); red wolf 2008; **2011 Discovery Center**
  (education, administration and admissions) **with a new entry plaza and pond**; Oceans gallery 2017; White Rhino
  2021; painted dogs and prairie dogs 2023-24. Accredited ZAA 2020.
- Discovery Center is "the first exhibit upon entry": rotating galleries (Rainforest Trek, Oceans, Spineless
  Wonders) and a tamarin habitat. [Z] OSM's "Tamarins" node sits inside relation 12581094, so that footprint
  (centre ~11861, 8806) is the Discovery Center; relation 12581095 (building=roof) is the covered entry walk to the
  parking lot; the entry-plaza pond is OSM way 628716058 (11907, 8799).
- Maps are shown at the Wild Things Gift Shop and the Endangered Species Carousel near the entry [M]. OSM shop=gift
  node is inside way 930691003 (11955, 8811), next to the Train Depot (930691004). Rides: Niabi Zoo Express train,
  Endangered Species Carousel (OSM attraction=carousel, 11915, 8971). Koi pond with a deck under a gazebo (OSM
  "Koi Pond" 12066, 8898 with piers). [E]
- OSM exhibits (game x, z): Giraffe Habitat 11951,9079; Giraffe Feeding shelter 11970,9088; giraffe house (way
  628930321) 11931,9128; Biodiversity Hall 11972,9110; Colobus 11906,9098; Tortoises 11946,9125; Painted Dogs
  11911,9035; Big Cats (Large Cat Habitat) 11862,8979; Reptile House 11816,9015; Wolfridge Grill 11793,8999; Red
  Wolves 11772,9036; Eagle Deck 11764,8978; White Rhino 12000,8773; Gibbons 12015,8846; Domestic Animals
  12011,8906; Festival Lawn 11953,8984; Bactrian Camel 11989,9162; Treehouse Snack Shack 11938,8831.
- Look of the buildings: no source found describing the Discovery Center's cladding. Modelled as a forest-preserve
  lodge (stone base, cedar siding, green metal roofs, timber posts): **unverified**. Giraffe house colours and the
  thatch-look feeding-deck roof: **unverified** (typical for such exhibits).

## Oak Grove

- Village in Rock Island County, pop. 476 (2020), 0.66 sq mi; mostly Sherrard CUSD 200, north part Rock
  Island-Milan SD 41. [OG] OSM place node at (726, 12158); US 67 (divided) runs N-S through it, crossing 106th
  Avenue West at (702, 12138). Coyne Center (fire station, elementary) is just south, outside the region box.

## What the module adds

- 10 names, 39 places (gateway signs on US 6 / US 150 / US 67, zoo road and lot signs, Municipal Center, school and
  park signs, zoo exhibit signs, benches/bins/planters/flagpoles), 4 models:
  - `niabi_entrance` (52 KB, 2,752 / 58 tris): Discovery Center, entry canopy with NIABI ZOO fascia, stone monument.
  - `niabi_giraffe` (32 KB, 1,650 / 32 tris): giraffe house with PASSPORT TO AFRICA, feeding deck, two giraffes.
  - `niabi_carousel` (29 KB, 1,440 / 44 tris): Endangered Species Carousel house with animals.
  - `cv_municipal` (60 KB, 3,107 / 44 tris): Municipal Center + Robert R. Jones Library, portico, three flagpoles.
  All exported through `landmarks.py` `finish()`: COLOR_0 present and not all white (checked).

## Sources

- [W] https://en.wikipedia.org/wiki/Coal_Valley,_Illinois
- [H] https://www.coalvalleyil.org/about/our-history/ ; https://www.coalvalleyil.org/about/
- [V] https://www.coalvalleyil.org/about/ (900 1st Street, Municipal Center 2002)
- [P] https://www.coalvalleyil.org/departments/parks/
- [S1] https://coalvalleyil.org/wp-content/uploads/2024/09/New-Village-Packet-2024.pdf (search snippets: Blackhawk
  Bank 200 1st St, Fareway 109 1st Street, Township Hall 104 W 1st Ave)
- [Z] https://en.wikipedia.org/wiki/Niabi_Zoo
- [M] https://niabizoo.com/plan-your-visit/park-map
- [E] https://www.niabizoo.com/experiences/
- [OG] https://en.wikipedia.org/wiki/Oak_Grove,_Illinois
- OSM data via the Overpass API (zoo attractions, POIs) and https://api.openstreetmap.org (relation 12581094/5 tags).
