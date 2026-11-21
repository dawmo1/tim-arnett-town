# Port Byron, Rapids City and Hampton (region `port-byron`)

The Illinois river villages on IL-84 (the Great River Road) above and below the I-80 bridge. Module:
`src/regions/port-byron.js`. Models: `assets/src/regions/port-byron/port_byron.py` -> `assets/models/regions/port-byron/`.
The bounds also cover the Iowa bank (Le Claire, Princeton); that side is left to the le-claire / countryside agents.

## Positions

Coordinates were taken from the OSM tile data (`data/tiles`, `data/roads`, `data/index.json`), from OSM itself through
Overpass, and from Nominatim address lookups, then projected with `project()` (tools/map-config.mjs). Nominatim
addresses are TIGER interpolations, so the building a name sits on is the nearest footprint on the right side of the
street. In Port Byron, odd numbers fall on the river (west) side of Main St and the N/S split is at Cherry St (z -9181).

## Port Byron

- Main St runs north-south at x 20106. Downtown sits between Hickory St (z -9394) and Linn St (z -9075), with the river
  and the Great River Trail on the west side.
- **Businesses** (directory listings, so check that they are still open):
  - Rams Riverhouse, 102 S Main (also listed as Harrington's Pub). A reviewer notes the river view.
    https://www.mapquest.com/us/illinois/rams-riverhouse-427383886
  - Jimmie Lee's Bar & Grill, 108 S Main. https://www.yellowpages.com/port-byron-il/brew-pubs
  - Duey's Corner Tap, 102 N Main. https://www.superpages.com/port-byron-il/bars
  - Tuggers Burger Bar & Ale House, 201 N Main. https://visitquadcities.com/listing?id=1899
  - Blue Suede Cocktails & Coffee, 125 N Main. https://www.iexitapp.com/guide/Iowa/10/Port%20Byron/9278
  - Mean Mel's Steakhouse, 708 S Main. https://www.city-data.com/local/Restaurants/Port-Byron-IL.html
  - Blackhawk Bank & Trust, 105 N High St. A new branch opened in May 2023 on the hill above downtown.
    https://quadcitiesbusiness.com/?p=42135
  - Morton Community Bank, 1006 N High St, and Dollar General, 1100 N High St. No footprint at either geocode, so
    neither is named in the module.
  - The post office is at 105 Hickory St. https://www.postallocations.com/il/port-byron/port-byron
- **Congregational Church**, 200 S High St, organised in 1849. https://illinoisgenealogy.org/statewide/port_byron_congregational_church.htm
- **River Valley District Library**, 214 S Main (already in OSM).
- **Will B. Rolling** (13 Nov 2013): a 30 ft FAST Corp. fibreglass rider on an 1890s penny-farthing.
  - It is a recoloured cast of Sparta WI's "Ben Bikin'": blue jacket, white trousers, John Deere green tie and hat band.
  - It stands on a concrete slab beside the Great River Trail on the riverfront, at 120 / 200 block S Main.
  - It was a gift from former mayor Lawrence Bay and his wife Carol, and won River Action's 2014 Eddy Award.
  - Sources: https://en.wikipedia.org/wiki/Port_Byron,_Illinois, https://portbyronil.com/will,
    https://www.wqad.com/article/news/local/drone/8-in-the-air/biking-statue-rolls-into-port-byron/526-3119b2a7-66d1-4d6b-8007-f41d52ebc0e0
- **Great River Tug Fest**: a tug-of-war across the river to Le Claire, held since 1987. OSM maps the "Illinois Tug
  Pit" at 20078,-8536. (Wikipedia, above.)
- **World War Memorial** and a cannon are OSM nodes at 20092,-9165. The module adds a sign and a flagpole there.
- **Water tower**: OSM node at 20650,-9268. The core already draws it with the town name.
- **Riverdale CUSD 100**: Riverdale High and Middle School are on 256th St N, about 3 miles east (game ~25720,-10370 and
  25733,-10840). They are **outside this region's bounds**, so they are not modelled. Sources:
  https://en.wikipedia.org/wiki/Riverdale_High_School_(Port_Byron,_Illinois), plus Nominatim / OSM node 8997161730.
- **The old Port Byron High School building**: sources conflict on whether it still stands. It is not placed.

## Rapids City

Rapids City is on 2nd Ave (IL-84) between the I-80 bridge's Illinois end (x ~17950, z ~-5760) and 11th St. Business
names and addresses come from the village directory: https://rapidscity.us/local-activities.php

- The Edge Eatery & Drinkatorium, 1802 2nd Ave. It is a cash-only dive bar.
  https://www.restaurantji.com/il/rapids-city/the-edge-/
- Brothers Family Restaurant, 1718 2nd Ave.
- QC Mart, 1726 2nd Ave. OSM calls it "BP Shop".
- Git-N-Go #13, 1310 2nd Ave. OSM says "GetGo", which looks wrong, so the module renames it to the directory name.
- TBK Bank, 1700 2nd Ave (already in OSM).
- Thai Town Cafe, 403 17th St.
- Gilanella's, McCarty's Precision Auto Pro, 2028 2nd Ave, and Enright's Rapids City Car Wash, 2040 2nd Ave.
- Bar 84 / Pulse 84, 210 11th St: no footprint near the geocode, so it is not named.
- **Parks** (village page):
  - River Bend Park, top of the 17th St hill.
  - Shadow Hill Park, top of the 12th St hill.
  - Sulphur Creek Park, 14th St and 4th Ave.
  - Shuler's Shady Grove Park, 1st Ave and 11th St, with the public boat ramp, a gazebo with a scenic overlook and
    a stretch of the Great River Trail.
- **Water tower**: OSM node at 19106,-5755, already drawn by the core.
- **Saint John's Catholic Church**: on 3rd Ave in OSM; its bell is an OSM node.

## Hampton

- **Black's Store (Brettun & Black Museum)**, 1st Ave at 6th St, NRHP 76000727 (1976).
  - Built in 1849, it was the largest store in northwest Illinois. It is a three-storey brick building with one of
    the first elevators in the Midwest.
  - It was a riverboat stop and a Galena stagecoach stop, and stayed a store until 1906. It is now the Hampton
    Historical Society museum.
  - Sources: https://en.wikipedia.org/wiki/Black%27s_Store, https://hamptonil.org/attractions.php, https://riveraction.org/node/128
  - Footprint: OSM way 758040568 (9.3 x 16.2 m), with the long sides along 1st Ave.
- **Attractions page** (https://hamptonil.org/attractions.php):
  - Heritage Park: a pavilion by the river and the Heritage Interpretive Center.
  - Munson playground, 5th St and 3rd Ave.
  - The elementary school, 4th St and 3rd Ave (Hampton Elementary in OSM).
  - Soldier's Monument and Village Hall, north of Heritage Park on the bike path. They have no position, so they are
    not placed.
  - Illiniwek Forest Preserve (206 acres, a campground, and the 1996-97 "nature spiral" of carved boulders).
  - Fisherman's Corner, by Lock and Dam 14.
  - Stone's Apple Barn and Golfmohr Golf Course, both on Hubbard Rd.
- **State Ave (IL-84) businesses**, from directory listings:
  - Porter's Village pizza, 621 State Ave. https://slicelife.com/restaurants/il/hampton/61256/porter-s-village/menu
  - Floriana's Cafe, 421 State Ave.
  - Blimpie, 510 State Ave. The core turns it into a parody name.
  - The Logger House, 256 S State Ave. Nominatim found no position, so it is not placed.
    https://www.allmenus.com/il/hampton/662842-the-logger-house-bar-and-grill/menu/
- **Water tower**: OSM maps it as a way (center 14483,-3110) inside a 38 x 31 m Microsoft footprint. The map build only
  turns water-tower nodes into towers, so the module adds one just east of that footprint, at 14506,-3108.

## Models

Each model has LOD0 and LOD1, with vertex colours checked by `colour_ok`.

| file | place | size | triangles (lod0 / lod1) | what is guessed |
|---|---|---|---|---|
| willrolling.glb | Will B. Rolling, Port Byron riverfront | 34 KB | 1582 / 106 | which way he faces (north, up the river), the slab size, the plaque, the cap colour (navy) |
| blacksstore.glb | Black's Store, Hampton | 51 KB | 1946 / 26 | brick colour, side-gable roof, shopfront on the 1st Ave side, sign band text, end chimneys |
| gazebo.glb | Shuler's Shady Grove Park gazebo, Rapids City | 13 KB | 450 / 76 | everything but its existence: white octagon, green roof, position near the river edge of the park |

## Left to do

- Get photos to check Black's Store: roof form, which face fronts the street, and the porch.
- Check the Will B. Rolling slab orientation.
- Find the Rapids City gazebo's exact spot.
- Riverdale High School is out of bounds. It needs a bigger box: x1 ~26200, z0 ~-11200.
- The Port Byron riverfront strip west of Main St (x ~20030-20065) is classed farmland in the ground map. It should
  be park or lawn.
- The Hampton Heritage Center building and the Soldier's Monument have no positions.
- The Port Byron village hall address is unclear: directories say 120 S Main, the chamber says "Route 84".
