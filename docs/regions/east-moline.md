# East Moline (IL): research notes

Notes for `src/regions/east-moline.js` and the models in `assets/src/regions/east-moline/east_moline.py`.
Game coordinates: x east, z south, metres from 3rd & Main, Davenport. Positions come from the OSM / Microsoft data
already in `data/tiles` and `data/roads`. [G] marks a guess.

## Layout (from the map data)
- Downtown is **15th Avenue** between 6th St (10838, 882) and 13th St (12027, 738). The avenues run roughly east-west and
  the streets north-south. Addresses go up by 100 per block from 6th St, with odd numbers on the north side (the library
  at 745 16th Ave is on the north side of 16th). 16th Ave runs about 100 m south of 15th.
- **12th Avenue** runs along the railway just north of downtown. **The Bend** riverfront is at the west end: Bend Blvd,
  the Hyatt House/Place (10089, 314), The Bend Event Center (10020, 537), Bend XPO at 922 Mississippi Pkwy
  (10288, 527) and Murphy Park.
- **John Deere Harvester Works** is at 1100 13th Ave. It covers about 90 acres under roof and has built combines since
  1912/13 (S7, S700, X9). It occupies the OSM industrial area "John Deere Harvester" north of 13th Ave: buildings 166847265
  (151,700 m²), 956330336 and 163606903, centred near (11774, -463). John Deere Information Systems is at 1400 13th St
  (12149, 586).
- **Avenue of the Cities** is the commercial strip on the south side: Kennedy Square, Jewel-Osco, UTHS and Skate City.
- **United Township High School** is at 1275 Avenue of the Cities, building r8904176 (12005, 3571). It opened in 1915 as
  East Moline High School, and the current building dates from 1960 with a newer Student Life Center entrance. The Area
  Career Center and the municipal pool sit beside it. Soule Bowl stadium is on Archer Dr (12184, 1372).
- **Black Hawk College**: the main campus is in Moline (6600 34th Ave), not East Moline. The "Black Hawk College Optional
  Education" building (10223, 3645, 301 Ave of the Cities) and the Black Hawk Area Education Center (11801, 4331) are in
  East Moline. Both were already named in OSM or left as they were.
- **Campbell's Island**: Island Ave and State St. The memorial is OSM node 8082222040 at (11757, -1637), on park land with
  the river about 27 m to the west.
- **Empire Park** is on IL-84 (19th/20th St) at the Hampton line (13136, -2171). It has a boat launch next door, three
  pavilions and a big wooden playground.
- **Water towers** (OSM; the core draws them with the town name): (11559, 1112) downtown, (11155, 2851) Glenview,
  (10820, 4203) Wiman Park, (13162, -1166) Hillcrest Rd, (13526, -326) Morton Dr. The twin towers at (10113, -1310) are
  Riverdale, Iowa, not East Moline.

## Downtown businesses (15th Ave)
Palace Tavern 701, Ike's All-American Cafe 635, Jaded Java 615 (closed), Drunken Barrels 821, Bragg BBQ 905 (Jim's Rib
Haven was listed at 907), Keg Tavern 924 (closed), Queen of Hearts / Elixir 930, Greenleaf Tobacco & Vape 932 (OSM),
Racers Edge (earlier P K Dugan's) 936 (building for sale in 2026), Latin Village Restaurant 1114. Off 15th Ave: City Hall
at 915 16th Ave (council chambers on the 2nd floor), City Hall Annex at 912 16th Ave, the Public Library at 745 16th Ave
and the Post Office. Drunken Barrels has no footprint at its address (an empty lot in the data), so it isn't placed.

## Streetscape (RAISE grant)
The 2022 RAISE application won $23.7-24M; the whole project is about $30M. Construction ran 2025-26 and covers:
- 15th Ave from 6th to 13th St as a complete street, with a festival-street design from 7th to 9th St, concrete-paver
  parking lanes, decorative lighting, landscaping and decorative arches over the street.
- A gateway at 7th St and 15th Ave.
- 12th Ave from 1st to 7th St and 7th St from 12th to 15th Ave, with a 10 ft shared-use path.
- The Bend Blvd / Mississippi Pkwy streetscape, and about 2,800 ft of Bend Blvd extension to 7th St.

The city built an event stage at 8th St and 15th Ave (2017, about $250k); its design isn't known, so it isn't modelled.
There is a free public lot at 649 15th Ave, reached from the alley north of 15th; it isn't placed because the exact lot
isn't known.

## Models
- **rustbelt** (533/537 12th Ave): the former Moline-Knight / Moline Automobile Co. works (cars 1904-1919), later
  QC Metal Pickling. It reopened in February 2019 (Streamline Architects; AIA Iowa Impact Award 2020) as a venue for
  4,000 with Midwest Ale Works (537), Iron + Grain Coffee, Jennie's Boxcar, a salon, a gym, studios and an architecture
  firm, 111,239 sq ft in all. The model extrudes OSM relation 14963815: the 2-storey works along 12th Ave plus the long,
  narrow north wing. Red-brown brick, steel-sash windows, a clerestory on the north wing, the rusted-steel parapet sign,
  tenant signs and the stamping press out front are [G]. 237 KB, 8.3k tris lod0, 0.9k lod1.
- **campbell**: a 35 ft North Carolina granite obelisk (1908, A. L. Van der Berghen). An 8 ft bronze battle relief is
  on the base, with Wisconsin red granite tablets on the other three faces, inside a low concrete wall with an inner
  walk. The 1998 peace garden has four concrete benches in a Sacred Circle with Sauk/Meskwaki mosaic tiles. The monument
  was restored in 2018 and rededicated in 2020. Which way the relief faces (east, toward the drive) and where the garden
  sits are [G]. 18 KB.
- **emarch**: a 15th Ave arch, placed twice: the 7th St gateway (11078, 857) and the 13th St end (12007, 742). The
  arches are real, but their design is not published: brick piers with lanterns, a black steel truss and a lit
  DOWNTOWN EAST MOLINE panel are [G]. 44 KB.

Every GLB passed `colour_ok` (COLOR_0 present and not all white).

## Sources
- eastmoline.com RAISE narrative (2022): https://eastmoline.com/DocumentCenter/View/6919
- Hutchison Engineering, Greater Downtown Reconstruction/Streetscape: https://www.hutchisoneng.com/greater-downtown-reconstruction-streetscape
- QC Business, downtown construction (2025-07-17): https://quadcitiesbusiness.com/?p=125856
- WVIK, 2026 projects: https://www.wvik.org/wvik-top-stories/2026-03-26/east-moline-works-in-partnerships-on-many-improvement-projects
- WVIK, downtown stage (2017): https://www.wvik.org/community/2017-03-28/new-stage-for-downtown-east-moline
- Iowa Architecture, The Rust Belt: https://www.iowaarchitecture.org/discover/project-details/the-rust-belt/6ec9a0e69dd95dcf/
- towns-and-nature blog (CB&Q depot, Rust Belt, Harvester Works): https://towns-and-nature.blogspot.com/2024/12/east-moline-il-cb-depot-and-rust.html ,
  https://towns-and-nature.blogspot.com/2018/03/east-molene-il-john-deere-plant.html
- Little Village / beer sites (Midwest Ale Works at 537 12th Ave, Rust Belt tenants)
- Deere factory tours (Harvester Works, 1100 13th Ave): https://about.deere.com/en-us/explore-john-deere/visit-us/factory-tours ; factorytoursusa.com
- Illinois DNR, Campbell's Island: https://dnrhistoric.illinois.gov/experience/sites/site.campbells-island.html ;
  Wikipedia; WVIK (restoration): https://www.wvik.org/post/campbells-island-monument-being-restored
- City of East Moline, Empire Park: https://eastmoline.com/Facilities/Facility/Details/Empire-Park-2
- City Hall address and council: https://eastmoline.com/218/City-Council
- UTHS: Wikipedia; Tri-City Electric (Student Life Center)
- 15th Ave listings: Yelp (Bragg BBQ 905, Keg Tavern 924), Apple Maps (Palace Tavern 701), Yellow Pages and Superpages
  (Queen of Hearts 930, Racers Edge 936, Drunken Barrels 821, Ike's 635, Latin Village 1114)
- OpenStreetMap (points, areas, town boundaries in tools/cache/chunks), via the repo's own cache
