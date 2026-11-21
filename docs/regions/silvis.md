# Silvis and Carbon Cliff (region `silvis`)

Module: `src/regions/silvis.js`. Models: `assets/src/regions/silvis/silvis.py` (background Blender, reuses the
landmark kit) -> `assets/models/regions/silvis/{shop,hero}.glb`. Positions come from the OSM cache
(`tools/cache/chunks/*_pbf.json`) projected with `project()`.

## Town facts

- **Silvis rail shops.** The Chicago, Rock Island & Pacific began building its main locomotive shop here on 1 May 1903:
  a 45-stall roundhouse and turntable, an erecting shop, an office, a powerhouse, a water plant and a storehouse. The
  Rock Island shut down in March 1980. Chrome Locomotive took over in 1981, then National Railway Equipment from 1990
  until it closed the shop in March 2021. Railroading Heritage of Midwest America (RRHMA) bought it in 2022: about
  90 acres, the existing buildings and 11.4 miles of track. The main shop is about 400,000 sq ft. RRHMA is building a
  6-stall roundhouse on the old one's footprint, with a turntable from BNSF. The site is not open to the public.
  In the game the shop is OSM way 489120819, about 270 m long, north of 1st Ave. OSM calls the area the "Silvis
  Railway Industrial Park".
  Sources: https://rrhma.com/silvis-shop/, https://utahrails.net/loconotes/silvis.htm,
  https://www.wvik.org/wvik-top-stories/2022-01-11/railroad-preservation-group-buys-silvis-rail-shop,
  https://quadcitiesbusiness.com/?p=130861, https://towns-and-nature.blogspot.com/2016/02/silvis-il-rock-island-yard.html
- **Hero Street USA.** This was 2nd Street, renamed in 1967. It runs south of 1st Ave and is about a block and a half
  long. Hero Street Memorial Park was dedicated in 1971 and has a shelter, a playground, a memorial kiosk and a grotto.
  The monument was dedicated on 6 Oct 2007 and stands at the corner of 1st Avenue and Hero Street. It weighs over
  35 tons and is over 17 ft tall, with sculpted reliefs of the eight men on the base. On top is a bronze bald eagle
  with spread wings, holding a US flag and a Garand rifle. The sculptors were Guadalupe Diaz and Pedro Rodriguez;
  Jim Anderson did the portraits.
  Sources: https://www.historyillinois.org/historical-markers/hero-street-u.s.a., https://visitquadcities.com/listing?id=2056,
  https://silvisil.org/hero-street-resources.html, https://www.army.mil/article/40113/hero_street_usa,
  https://www.govinfo.gov/content/pkg/CREC-2011-11-01/html/CREC-2011-11-01-pt1-PgH7167-10.htm
- **1st Avenue** is IL 84 / IL 92 through the city centre. IDOT has a reconstruction study for it. Its businesses come
  from directory listings, so check them before relying on them:
  - Cafe Lolita's, 402 (already in OSM)
  - Frank's Pizzeria and the Torchlight Lounge, 711
  - Avenue Tap, 712
  - The Railhouse Bar & Grill, 803
  - Silvis Public Library, 806 (OSM; the city says it is in the City Hall basement)
  - Rick and Kathy's Lounge, 815
  - La Michoacana Ice Cream, 917, and La Canasta Bakery (OSM)
  - Mr. Panda Chinese Kitchen, 924
  - the Post Office, 1001
  - Triangle Inn / Tri-Cove, 1650

  Sources: https://idot.illinois.gov/programs-and-projects/featured-projects/rock-island-county--illinois-92-in-silvis-from-illinois-84-to-il.html,
  https://www.enjoyillinois.com/explore/listing/franks-pizzeria, https://tools.usps.com/locations/details/1361787 (and
  the MapQuest / Yellow Pages / BBB listings found by search).
- **Mural.** A downtown mural was unveiled on 22 Nov 2024 at the city parking lot beside the post office. Crysania Arms
  and Thomas McGehee designed it. It shows buildings, flowers, a "Hero Street" sign and, largest, a Rock Island Lines
  train. Which wall it is on is not confirmed: the game puts it on the post office's east wall, facing the lot.
  Sources: https://quadcitiesbusiness.com/?p=67992, https://wqad.com/article/news/local/new-mural-downtown-silvis/526-1b265440-3888-49d3-8406-c4f1640cff79
- **City.** City Hall is at 121 11th Street, built 1921-22; it is not matched to a footprint. Norman Schadt Park is at
  12th St and 4th Ave, next to the McGehee Center. It has 3 shelters, ball, tennis, pickleball, volleyball and
  basketball courts, and an all-inclusive playground. Other parks (from OSM): Phipps Prairie, Friendship, Silvis
  Heights, Sisters (Garden Club), 17th Street and the MiniPark.
  Sources: https://silvisil.org/schadt-park.html, https://silvisil.org/silvis-library.html, https://silvisil.org/silvis-parks.html
- **Churches.** Our Lady of Guadalupe is at 800 17th St. Its first church, dedicated in 1927, was built from railway
  boxcars; the parish is now Divine Mercy. The other churches come from OSM: Grace UMC, Silvis UMC, First Baptist,
  Crosstown Baptist, St Mark's Episcopal, Nazarene, Holy Spirit, Faith Walk and The Sanctuary.
  Sources: https://cdop.org/parishes/our-lady-of-guadalupe-silvis, https://en.wikipedia.org/wiki/Silvis,_Illinois
- **Schools (OSM).** George S. Barr Silvis Junior High, Bowlesburg Elementary, Eagle Ridge School and Apollo Elementary
  (Carbon Cliff). The city's schools belong to districts 34, 36 and 37 and United Township HSD 30.
- **Water towers.** There are three, all already in OSM, so they are drawn by the core water-tower pass with the town
  name: one downtown beside Schadt Park (13506, 1538), one south (13882, 3531) and one in Carbon Cliff (15235, 2642).
  A golf-ball paint scheme reported in an undated article is not confirmed, so the towers keep the default colours.
  Source: https://www.americancityandcounty.com/?p=38519
- **Carbon Cliff.** The Village Hall is at 1001 Mansur Ave and houses the village war memorial; the village website's
  map gives 41.504652, -90.395653. Carbon Cliff Park is at 343 N 1st Ave, with Little League fields, a pond and a
  pavilion. IL 84 runs through the village along 2nd Avenue and then joins Colona Road. The Carbon Cliff-Barstow Fire
  Protection District is at 401 Sinclair Blvd.
  Sources: https://carboncliff.gov/village-hall, https://carboncliff.gov/welcome-to-carbon-cliff,
  https://carboncliff.gov/business-listings, https://www.aaroads.com/guides/il-084-north-quad-cities
- **Outside this region** (checked so they are not duplicated):
  - Quad City Downs: 5005 Morton Dr, East Moline, about game (15720, -265). It closed on 31 Jan 2015.
    Source: https://en.wikipedia.org/wiki/Quad_City_Downs
  - Jumer's / Bally's: Rock Island.
  - TPC Deere Run: has a Silvis address, but its course lies west of x 12600.
  - The Hennepin Canal / Green Rock lock 29 sits at the south edge (about 15640, 5815) and belongs to the
    countryside / Colona region.

## What the module adds

- **Names:**
  - the Post Office
  - La Michoacana
  - Mr. Panda
  - Tony's Grocery (135 Hero St)
  - Carbon Cliff Village Hall
- **Places:**
  - a HERO STREET USA street blade at the memorial corner, and a flagpole behind the monument
  - a Hero Street Memorial Park sign
  - the 2024 mural on the post office's east wall
  - a USPS mailbox
  - a La Canasta Bakery sign
  - an RRHMA Silvis Shop sign at 9th St (the address 300 9th St appears only in a photo file name)
  - a Norman Schadt Park sign
  - a Village of Carbon Cliff sign at the hall
  - a Carbon Cliff Park sign
- **Models:**
  - `shop`: the Rock Island shop. Red-brown brick, two tiers of tall shop windows between pilasters, two glazed
    clerestory monitors, track doors on the west end and a ROCK ISLAND herald facing 1st Ave. The overall look is
    generic Rock Island-era; no close-up photo was available, and the herald is stylised.
  - `hero`: the Hero Street monument. A stone block with eight relief portraits, "HERO STREET U.S.A." lettering, a
    bronze eagle with raised wings and the flag, on a round plaza with two benches.

## Left to do

- The tile data has no footprints on the 700-800 blocks of 1st Ave (x 13290-13500, z 1200-1290), so those bars
  can't be renamed yet.
- City Hall (121 11th St) has no footprint match.
- The new RRHMA 6-stall roundhouse and turntable could be modelled once photos exist.
- The Hero Street Park grotto and kiosk are not modelled.
