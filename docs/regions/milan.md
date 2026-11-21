# Milan, IL: research notes

Module: `src/regions/milan.js`. Models: `assets/src/regions/milan/milan.py` → `assets/models/regions/milan/*.glb`.
Game coords from `project()` (tools/map-config.mjs). [G] = guess, [OSM] = from the OSM extract in tools/cache.

## Town
- Village in Rock Island County on the Rock River, about 4 miles above its mouth. Pop. 5,097 (2020). Platted 1837
  as "Hampton"; called Camden Mills by 1841 after the wool-carding and clamshell pearl-button mills on Mill Creek.
  Eagle Food Centers was headquartered here until 2003; John Deere's parts distribution centre is on the east side
  (OSM landuse "John Deere Parts Distribution Center", ~2650, 8400). [Wikipedia](https://en.wikipedia.org/wiki/Milan,_Illinois)
- Most of the village is in Rock Island–Milan School District 41: Thomas Jefferson Elementary, 1307 4th St W
  (OSM, 491, 9428). Rockridge High is in Taylor Ridge, ~15 mi SW, not in Milan.
  [Rockridge HS](https://en.wikipedia.org/wiki/Rockridge_High_School), [RIMSD 41](https://en.wikipedia.org/wiki/Rock_Island%E2%80%93Milan_School_District_41)
- No Rock Island County fairgrounds in Milan were found (the Rock Island County Fair is held in East Moline, from memory, not checked). Lake Potter is in
  Sunset Park, Rock Island, outside this region.

## Street grid (from the road graph)
- US 67 comes over the Rock River bridges from Rock Island, runs east along **W 1st Ave** (z ~7780) and turns south
  down **1st St** (x ~865), which is the commercial spine south to Camden Park and the **Milan Beltway** (CR 78,
  z ~10587 at US 67). I-280 crosses the north edge.
- Streets west of 1st St every ~125 m: 2nd St W x 740, 3rd 612, 4th 482, 5th 354, 6th 222. Avenues south: 2nd Ave
  z 7895, 3rd 8001, 4th 8138, 5th 8248, 10th 8941, 20th 10136. Address block numbers follow this grid (100 per block),
  which is how the unnamed Microsoft footprints below were matched.

## Businesses (names[])
OSM already names Hy-Vee, Starbucks, American Bank & Trust, KFC, CVS, Walgreens, Two Sisters Restaurant (522 1st St W),
Milan License & Title, McDonald's (400 1st St W), Hardee's, Save-A-Lot, Maid-Rite, Subway (313 1st Ave W), Blackhawk
Bank, Vibrant Credit Union, the post office, Blackhawk Fire Dept (102 W 3rd St), churches etc. Added by address:
| Name | Address | Matched footprint | Confidence |
|---|---|---|---|
| Dizzy Horse (ex Legends Corner Bar & Grill) | 432 1st Ave W | 454, 7806 (corner of 4th St W) | medium |
| Spinner's Pizza (Neal Spinner's Inc) | 319 1st Ave W | 541, 7737 (next to Subway, 313) | medium |
| Pagalo's Pizzeria & Gelato Cafe | 119 1st Ave W | 793, 7755 | medium |
| Milan American Legion | 515 1st Ave W | 332, 7737 | low |
| Finn's Grill & Bar (status unclear: one listing says closed) | 527 2nd St W | 721, 8329 | medium |
| Backyard Bowl & Abides Bar and Grill (old Milan Lanes, 14 lanes) | 2020 1st St W | 698, 10303 (big box S of 20th Ave) | medium |
| Vega's 1 Bar | 1011 4th St W | 505, 8968 | low |

Sources: [BBB Milan bars](https://www.bbb.org/us/il/milan/category/bar), [MapQuest Dizzy Horse](https://phoenix.aws.mapquest.com/us/illinois/dizzy-horse-646199381),
[MapQuest Finn's](https://phoenix.aws.mapquest.com/us/illinois/finns-grill-643467332), [580 1st St W listing](https://www.commercialcafe.com/commercial-property/us/il/milan/580-1st-street-w/),
[Backyard Bowl, QuadCities.com](https://www.quadcities.com/articles/entertainment/new-backyard-bowl-hits-a-strike-for-great-food-fun-lebowski-references),
[city-data Milan restaurants](https://city-data.com/local/Restaurants/Milan-IL.html), [Pagalo's](https://startpage.mapquest.com/us/illinois/pagalos-pizzeria-gelato-cafe-304466723).
Not placed: Knoxville Tap (8716 Knoxville Rd), Toucan's / Skinny Legs BBQ (older names at 2020 1st St W).

## Civic and parks
- **Milan Municipal Building**, 405 E 1st St (OSM w975247345, 962, 8192): the village moved here from a 7,000 sq ft
  one-floor hall at 321 2nd Ave W into a 35,000 sq ft two-storey building (village offices, board room, police).
  (search snippet citing [Waymarking](https://www.waymarking.com/waymarks/WMX0E2_Milan_Illinois); not opened). No photos found: brick, cast stone,
  the glazed drum lobby (the OSM outline has a round bay in the inside corner) and the garage wing are [G].
- **Camden Park** (90 acres, US 67 & Milan Beltway): 6 rentable shelters, a lodge, 3 softball fields (2 lit), a
  2-mile walk path, sledding hill with heated lodge, 18-hole disc golf, Milan Area Girls Softball; Milan Fireworks
  every July 3. [Waymarking Camden Park](https://www.waymarking.com/waymarks/wm5MC4_Camden_Park__Milan_Illinois)
- **The Camden Centre** (former Milan Community Center), 2701 1st St E in Camden Park at the Beltway / Route 67
  corner; banquet hall for 300-400. [milanil.org](https://www.milanil.org/camden-centre), [Zola](https://www.zola.com/wedding-vendors/wedding-venues/the-camden-centre).
  Look (one storey, tan walls, brown mansard fascia, west entrance canopy) is [G].
- Village parks (7, all with shelters, grills, playgrounds; lightning sirens at Camden, Dickson, Little League):
  OSM has Camden, Dickson (pool), Collinson, Nel Daniels, Little League, First Presbyterian, Pappas, Shadybrook, West Park.
- **Water towers**: three OSM `man_made=water_tower` nodes (673, 9139 by St Matthew Lutheran; 1053, 10655 in Camden
  Park; -1409, 10433 in SW Rock Island). The core already draws them with the town name, so no places were added.
  Real colours/logos not found.

## Rock River and Hennepin Canal
- Hennepin Canal (1890-1907, National Register) meets the Rock River at Milan. Access: Steel Dam / Lock 30 (OSM lock
  2497, 7034; Steel Dam weir 2439, 6884), Route 67 bridge / Lock 31 (-1322, 6896), Big Island Rd / Lock 32.
  [River Action](https://riveraction.org/node/542), [IL DNR Hennepin Canal](https://dnr.illinois.gov/recreation/greenwaysandtrails/hennepincanal.html)
- **Sears Dam** (OSM weir -46, 6891) just east of the US 67 bridge, named for dam- and town-builder David B. Sears;
  no safe portage. Disused **Sears Hydroelectric Plant** (City of Rock Island, closed 2021-03, -197, 6909) and the
  **Cotton Mill Building** (-31, 6738) beside it. A 2026 state feasibility study covers modifying Sears and Steel dams.
  [IL DNR Sears & Steel report](https://dnr.illinois.gov/content/dam/soi/en/web/dnr/waterresources/documents/SearsSteelProjectPlanningFeasibilityReport2026.pdf),
  [Industrial Scenery: Steel Dam](https://industrialscenery.blogspot.com/2025/04/steel-dam-on-rock-river-and-hennepin.html)
- Locks and dams are left to the countryside agent (its brief); Milan adds only the access signs.

## Places added
Welcome sign on US 67 at the north entry [G position]; park name signs at each park's nearest street; Lock 30 and
Lock 31 signs; post office flagpole and collection box; fire station flagpole; a lot polygon between 1st St E and
the municipal building [G].
