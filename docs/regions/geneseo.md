# Geneseo, IL — town notes (region `geneseo`)

Henry County, "the Maple City" / "Victorian Geneseo", pop. 6,539 (2020). Founded 1836 as a Congregationalist colony
from Geneseo and Bergen, NY. At I-80 / US 6 / IL 82, about 20 miles east of the Quad Cities.
Game coordinates come from OSM (local `tools/cache/chunks/*_pbf.json`) through `project()` in `tools/map-config.mjs`.
`[U]` = unverified: no source found, so it is a guess.

## Downtown: State Street and City Park
- **State St** is the main north-south street (x ≈ 35157). Between North St and Main St it is a divided boulevard with
  grass medians (OSM traffic islands 1505928204, 1505965899, 1505965900) and lamp posts on both sides. Commercial blocks:
  Exchange St (z 7658) → 1st St (7786) → 2nd St (7928). City Park sits west of State from North St (8068) to Main St
  (US 6, 8366), split by Pearl St (8213).
- **City Park** stands on the central lot of the colony's Geneseo Seminary (closed 1857). Township High School (1910-11)
  was later demolished to enlarge it (Wikipedia). Features (OSM):
  - an octagonal **gazebo / bandstand**, ~9 m across, in the north block at (35065, 8105), way 706132429. Modelled as `bandstand`.
  - a smaller gazebo (35082, 8318), the restroom pavilion (35084, 8272), a gabled picnic shelter (35032, 8262), a small
    amphitheatre roof (35083, 8261), a playground (35054, 8276), a decorative fountain (35033, 8107) and a flower bed.
  - a **bronze statue** at (35040, 8189), node 13919219395. Its subject is unknown.
  - the **veterans' plaza** at State & Main: a war memorial (35125, 8292), a Vietnam memorial (35137, 8292), US / Navy / Marine
    flagpoles, four memorial benches, a cannon (35126, 8304) and a stone (35139, 8322). The Spanish-American War memorial is
    at (35069, 8335).
  - The **Civil War memorial** was erected in 1891 at S State St & W Pearl St (hmdb.org 160094; nationalwarmemorialregistry.org).
    Whether it has a soldier on top is [U].
- **Central Bank Pavilion**, 218 N State: an outdoor stage that hosts free summer concerts (Central Bank Illinois, founded 1907
  and headquartered in Geneseo). OSM way 1499741693 (`leisure=bandstand`) is ~13 x 5 m at (35189, 7588).
- **Central Theatre**, 111 N State: opened 1924 as the New Geneseo Theatre and renamed Central later. It is run by the Geneseo
  Park District, with one screen. The 1997 renovation was paid for by Central Trust & Savings Bank, which owns the building
  and is next door. The canopy marquee was rebuilt to resemble the original one (cinematreasures.org/theaters/4354; NIU 1997).
- **Horse Fountain**: a historic fountain behind the Geneseo Historical Museum, 205 S State. It is shown in the first mural
  (geneseo.org). OSM decorative fountain at (35062, 7968). Its form is [U], so it is not modelled.
- **Abraham Lincoln statue**: State St at the museum (35141, 7940), node 13759909986.
- **Geneseo Historical Museum**: 205 S State, plus the Stees Brothers Carriage House at 205 S Center.
- **Murals** (Geneseo Mural Project, Walldogs-led; geneseo.org/mural-project):
  1. *Welcome to Historic Downtown Geneseo* (2022), south wall of 134 S State, showing the downtown and the Horse Fountain.
  2. *The Fabric of Geneseo* (2023), 100 E Main.
  3. *Bring On The Band* (2023), 112 N State: the Maple City Band (founded 1906), the Black Knights Drum & Bugle Corps and the GHS band.
  4. *Harold E. Neumann, aviation pioneer* (2024), 118 N State. No OSM point; not placed.
  5. *It Looks Like Geneseo* (2026), Richmond Hill Park, Shelter #4.
  6. *Donor mural* (2026), downtown.
- **Real downtown businesses** in OSM, already named on the map: Central Bank Illinois (101 N State), Brown & Ray (115),
  Mel Foster Co. (119), Katsch Boutique, Geneseo Brewery, JW's Shooting Parlor (207 N State), Leamen's Bar & Grill (209),
  Raelyn's Pub (217), Geneseo Donut Shop (215), Tim's Barber Shop (221), Barney's Korner (206 N State), Sam's La Roma
  (103 E Exchange), The Local Motive, Sweet Marie's, Carl's Barber Shop (E 1st St), Thai Town Cafe 2, State Street Cafe,
  Anthology for Books, Vorac Pharmacy, The Village Florist, Geneseo Home Furnishings (134 S State), Urban Farmhouse,
  Central Schoolhouse Inn (115 E North St, historic school), City Hall / Police (115-119 S Oakwood), Fire Dept (209 S Oakwood),
  Post Office (120 W 1st).

## Churches (many steeples; OSM)
First Congregational UCC, 319 S State, at the east edge of City Park's north block (organised 1836; the 1855-56 church on
this site was "the finest west of Chicago", henry.illinoisgenweb.org). First Presbyterian (35279, 8039). Concordia
Lutheran (35352, 8108). First Lutheran (E Main, 35214, 8412). Kingswood Methodist, 300 N State. Grace United Methodist
(35081, 7390). St Malachy Catholic, 595 E Ogden. First Baptist (36643, 8337). Evangelical Free (N Chicago St). Church of
Christ and New Life Fellowship (west side). Muzzy Chapel (35443, 9578). The First Congregational church is modelled as
`congregational`. The OSM footprint gives the massing; the red brick, the stone trim and the tower over the south porch
are [U].

## Schools
- **Geneseo High School**, 700 N State: Maple Leafs, kelly green and white. On this site since the 1960s, when it was
  J. D. Darnall Senior High. It includes the Ted McAvoy Career & Technical Education Center (2022-23), **Bob Reade Field**
  (football, artificial turf, lit), a soccer field and the GFAC (Geneseo Foundation Activity Center). The building outline
  is OSM relation r20810336 and is left to the tile builder. Geneseo is known for its football and music programmes.
- Geneseo Middle School (333 E Ogden), Northside, Southwest and Millikin elementaries, St Malachy's school, and the
  Geneseo CUSD 228 office.

## Parks, water, roads
- **Richmond Hill Park** (H K Robinson Dr): wooded disc golf course, the Richmond Hill Players theatre (600 H K Robinson Dr),
  shelters including the "Large Gazebo" (Shelter #5, cityofgeneseo.com), and the Florence Love Wildflower Garden.
- Anderson Memorial Park, Champion Park, Lodge Community Park, Geneseo Prairie Park (nature reserve), the John & Carla Edwards
  Aquatic Center with the indoor pool / community center (541 E North St), the JF Edwards Sports Complex, Bollen Field and
  Indian Creek Mini Golf.
- **Hennepin Canal** runs north of town (z 4670-6800), with a lock gate and bridge on Grange Rd at (36289, 5343). Hennepin Canal
  Parkway trail. **Ikes Park** (Izaak Walton League Geneseo chapter, 22870 IL 82) is on the canal: picnics, fishing, camping,
  boat ramp and lodge (iwla.org). It has no shooting range listed.
- **Green River** to the north-east. **Geneseo Creek** runs through the west and south of town. The **Edwards River does not
  pass Geneseo**: it is further south, in Henry and Mercer counties.
- Roads: I-80 along the south edge (exit to IL 82 / S Oakwood Ave), US 6 = W Main / E Main / US 6 East, and IL 82 = N College
  Ave. S Oakwood Ave is the strip: Hy-Vee, Walmart, Culver's, Best Western, Casey's. The Iowa Interstate Railroad runs
  east-west north of downtown. A downtown stop is planned on the Chicago-Quad Cities Amtrak line.
- **Water tower**: OSM 13943702383, white steel, 36 m, at (34819, 6871) near Hammond-Henry Hospital. The core already builds it
  from OSM and labels it with the town name. Geneseo's tower was nominated for Tnemec's 2026 Tank of the Year (fox32chicago);
  its paint design is [U]. OSM also has "Geneseo Water Tower Fish" (attraction, 35881, 7995) by the aquatic center; what
  that is was not verified.
- Industry: Wyffels Hybrids (seed corn) and Springfield Armory Inc. (650 N 2250th Ave) are based in Geneseo.

## Trap range (Geneseo trap team)
No trap or shotgun range inside Geneseo could be found online. Search covered geneseo.org, BBB, shootata.com, IWLA, the
GHS / USA Clay Target League pages, QC Times (paywalled) and midwestoutdoors.com, and OSM has no `sport=shooting` in the
region. The nearest verified trap fields are at **Bi-State Sportsman's**, 571 Cleveland Rd, Colona (OSM ways 941111528 /
941111529, about 41.4896, -90.3418). It is the Quad Cities' main shotgun complex and the home range of the Youth Shooting
Sports Association, which a former Geneseo HS trap shooter is quoted in. That range is in the `colona` region. Other nearby
shotgun clubs: Kewanee Izaak Walton (Baker Park) and Coleta Sportsmen's Club. **Open: where does the Geneseo team
actually shoot?** Dain would know. Once that is confirmed, model it: trap houses, five stations per field on the 16-yard
arc, and the clubhouse.

## Models (assets/src/regions/geneseo/geneseo.py → assets/models/regions/geneseo/)
| file | what | anchor | size / tris | notes |
|---|---|---|---|---|
| bandstand | City Park octagonal gazebo | 35065.1, 8105 | 26 KB, 1064 / 126 | white posts and spindles, brick base, green roof, lantern [colours U] |
| storefronts | 101-119 N State row | 35131, 7746 | 81 KB, 3390 / 84 | OSM footprints, CENTRAL marquee, CENTRAL BANK lettering |
| congregational | First Congregational UCC | 35128, 8180 | 35 KB, 1349 / 52 | nave + porch tower + 37 m spire + west wing |

## Sources
en.wikipedia.org/wiki/Geneseo,_Illinois; en.wikipedia.org/wiki/Geneseo_High_School; geneseo.org/visitor-guide;
geneseo.org/mural-project; cinematreasures.org/theaters/4354; ipo.lib.niu.edu/1997/ip971108.html;
shawlocal.com (Central Bank summer concerts, 2026-05-25); henry.illinoisgenweb.org/history-of-geneseo-churches.html;
nationalwarmemorialregistry.org (Geneseo IL Civil War memorial); cityofgeneseo.com/shelterresapp;
iwla.org (Illinois chapters); midwestoutdoors.com (YSSA article); fox32chicago.com (Tank of the Year nominees);
OpenStreetMap (ids above).
