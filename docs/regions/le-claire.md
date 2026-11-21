# Le Claire (incl. Princeton): research notes

Region module: `src/regions/le-claire.js`. Models: `assets/src/regions/le-claire/le_claire.py` (background Blender,
landmark kit) → `assets/models/regions/le-claire/*.glb`. Game coords from `project()` in `tools/map-config.mjs`
and the OSM / Microsoft footprints in `tools/cache/chunks/`. [G] = guess (no source could be read for it).

## Layout (from the map data)
- **Cody Rd (US 67, Great River Rd)** runs north-south at x ≈ 19,500. Cross streets: Dodge St z -8078,
  Wisconsin St z -8180 (the N/S address divide), Jones St z -8290, Ewing St z -8509. Front St (levee) x ≈ 19,534.
  River edge x ≈ 19,605 by the museum. The land drops ~5 m from Cody Rd to the levee, so the east-side buildings
  show a basement storey on the river side.
- Addresses: even numbers on the west side of Cody Rd, odd on the river (east) side.
- **Princeton, IA** (41.67 N) is north of the map's bounding box (41.625 N): nothing to do there.
- **Lock & Dam 14** (41.573 N, -90.401 → about 14,750, -5,500) is south of this region's box; the countryside agent
  owns it. The Le Claire Canal / Lock Canal 14 (historic) runs along z ≈ -6,350 between x 15,000 and 17,000, with
  OSM piers (small-boat harbour) there.
- **I-80 bridge** to Port Byron: OSM motorway bridge from (17,502, -6,723) to (17,750, -6,184); the deck comes from
  OSM. South end of town (Eagle Ridge Rd / Canal Shore Dr) is the I-80 interchange strip: Fareway, McDonald's,
  Culver's, QC Mart, Comfort Inn, Eagle Ridge Inn, Holiday Inn Express (all already named in OSM).
- Water tower: OSM `man_made=water_tower` at (17,714, -7,666); the core already draws it with the town name.
  Whether it is painted could not be confirmed.

## Businesses and places (names override)
| Place | Address | Where in game | Source |
|---|---|---|---|
| Mississippi River Distilling Co. | 303 N Cody Rd | OSM 791117506 (modelled) | mrdistilling.com; Des Moines Register 2023 |
| Green Tree Brewery | 309 N Cody Rd, next to the distillery | OSM 791117505 (OSM name kept) | Register 2023; onlyinyourstate |
| Bard Hotel (3 storeys, tallest in the district; later Sneaky Pete's) | 207 N Cody Rd | OSM 791117512 (modelled) | Wikipedia Cody Road HD; commercialcafe listing |
| Old City Hall | 201-203 N Cody Rd | OSM 791117511 = Los Amigos (OSM name kept) | Wikipedia |
| Wide River Winery tasting room | 106 N Cody Rd | west side, first lot north of Wisconsin St (position [G]) | visitquadcities listing 1937 |
| Cody Road Coffee | 114 N Cody Rd | west side, 100 N block (position [G]) | visitquadcities listing 2413 |
| Faithful Pilot Cafe (opened 1991, Steve & Nancy Rosetti) | 117 N Cody Rd [address from memory, unverified] | river side, 100 N block | traveliowa, rcreader |
| Crane & Pelican Cafe | 127 S 2nd St, the 1851 Dawley House | OSM 981000401 | Register 2023 |
| Aunt Hattie's, Zarubas, Shelly's | 102 / 110 / 106 S Cody | OSM names kept | OSM |
| Steventon's (river view, two decks, fire pit) | 1399 Eagle Ridge Rd | big MS footprint by the Holiday Inn Express on the river (position [G]) | Register 2023 |
| Hungry Hobo | Canal Shore Dr | OSM point inside 1316992675 | OSM |
| Antique Archaeology, Buffalo Bill Museum + Lone Star | 115 Davenport St; 199 N Front St | already in src/landmarks.js | docs/landmarks-references.md |
| Mississippi Cottage Antiques (1915 two-storey house) | 606 N Cody Rd | not placed (lot not identified) | Register 2023 |
| La Ragazza, Happy Joe's, Crafted QC, Emily Found It | Cody Rd | not placed (no address found) | islands.com 2025 |

Other OSM-named places already showing: Le Claire City Hall, Library (323 N 3rd St), Post Office, Police, Fire Dept
(201 N 15th St), Bridgeview Elementary (316 S 12th St), Pleasant Valley Junior High (3501 Wisconsin St), Cody
Elementary, First Presbyterian, Le Claire Baptist, Hope Church, Riverside Foursquare Church, Little Wayside Chapel,
Veterans Memorial Park + skatepark, Hollyhock Park, Scout Park, Shuler's Shady Grove Park, the 9/11 memorial, the
NRHP houses (Van Sant, Rambo, Tromley, Suiter, Dawley...). Former Albert Gross School: 425 N 3rd St (Wikipedia).

## The levee
- **Scott County Freedom Rock**: 7.5-ton boulder painted by Ray "Bubba" Sorensen II, moved to the levee June 2014;
  "Honor and Remember", flag and Scott County Medal of Honor recipients. OSM point (19,555, -8,086). Modelled.
- **Riverboat Twilight**: Victorian replica, 1987 (Capt. Dennis Trone), 140 passengers, three decks with wrap-around
  windows and a pilot house, calliope; not a paddle-wheeler; departs from the Port of LeClaire landing (the old steam
  ferry City of Baton Rouge serves as the landing boat). Dimensions and colours [G]. Modelled at (19,617, -8,345).
- Boat ramp (OSM "Laclaire boat ramp") at z ≈ -8,386; Iowa Tug Pit (Tugfest tug-of-war across the river to Port
  Byron, August) at (19,599, -8,354).
- Green Tree: a giant elm by the river (died 1960s) that names the brewery; marker by the picnic pavilion west of
  the museum (position [G]).
- Welcome sign at the north end of town with a painted paddle steamer (waymarking WMN9N3).
- Cody Rd has speakers on the street trees playing music (Register 2023).

## Models
| file | what | size | tris lod0 / lod1 | COLOR_0 |
|---|---|---|---|---|
| distillery | tan brick 2 storeys + gable, glass storefront, sign, copper cupola [G], river deck [G] | 44 KB | 1836 / 20 | ok (not white) |
| bard | red brick 3-storey Italianate, bracketed cornice, shopfront, "BARD HOTEL" | 74 KB | 2494 / 104 | ok |
| twilight | three-deck white riverboat, red trim, twin stacks, pilot house, name boards | 75 KB | 3385 / 73 | ok |
| freedomrock | painted boulder | 4 KB | 100 / 10 | ok |

## Sources
- https://en.wikipedia.org/wiki/Cody_Road_Historic_District (NRHP 1979; ~60 buildings, 9 blocks; Bard Hotel; old city hall)
- https://en.wikipedia.org/wiki/Le_Claire,_Iowa (schools, Lock & Dam 14 eagles, 2020 derailment)
- https://www.yahoo.com/news/where-eat-drink-shop-relax-110037671.html (Des Moines Register, Aug 2023: addresses)
- https://www.islands.com/1785447/iowa-le-claire-storybook-city-mississippi-historic-district-great-food-eclectic-shops
- https://www.mrdistilling.com/more/our-story/ ; https://www.twin-shores.com/project/mississippi-river-distilling-company-celebration-center/
- https://visitquadcities.com/listing?id=1937 (Wide River Winery, 106 N Cody) ; https://visitquadcities.com/listing?id=2413 (Cody Road Coffee)
- https://www.riverboattwilight.com/ ; https://www.steamboats.org/traveller/upper-mississippi-river/leclaire.html
- https://www.waymarking.com/waymarks/WMN0DQ_LeClaire_Freedom_Rock_LeClaire_IA ; https://www.waymarking.com/waymarks/WMN9N3_Welcome_to_LeClaire_LeClaire_IA
- https://www.commercialcafe.com/commercial-property/us/ia/le-claire/203-north-cody-road/ (207 N Cody, 1850, Sneaky Pete's)
- OpenStreetMap (tools/cache/chunks, Nov 2026 extract)
