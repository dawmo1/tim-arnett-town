# Bettendorf, Riverdale and Panorama Park

Notes behind `src/regions/bettendorf.js` and `assets/src/regions/bettendorf/bettendorf.py`. Game coords: x east,
z south, metres from 3rd & Main, Davenport. Positions are from OpenStreetMap (the Geofabrik extract the map is built
from). [G] = guess, no source found.

## Town facts

- Bettendorf: population 39,102 (2020), incorporated 1903. The Bettendorf brothers moved their iron wagon works
  to the village of Gilbert around 1900 (Wikipedia, Bettendorf, Iowa).
- Riverdale: population 379, incorporated 1950. Bettendorf surrounds it on three sides and the Mississippi is on
  the fourth. Pleasant Valley High School and Scott Community College (500 Belmont Rd) are inside Riverdale
  (Wikipedia, Riverdale, Iowa).
- Panorama Park: population 139, 0.06 sq mi, main street Park Avenue. It incorporated in 1953 to maintain its own
  dirt road (Wikipedia, Panorama Park, Iowa).
- Arconic (formerly Alcoa) Davenport Works, Riverdale: built 1946–48, about a mile long on the river. It grew from
  about 5.5 to about 11 million sq ft in the 2012–14 expansion, and a $175M casthouse was started in 2026. It
  employs about 2,000–2,500 people (clui.org Riverdale Aluminum Plant; quadcitieschamber.com; industrialinfo.com).
  OSM maps the main mill as one 487,700 m² building (r12867212, centre 9856,-1531) with a 12.7 m height. The real
  mill bays are taller [G].
- The I-74 bridge (2017–2021) replaced the 1935 and 1959 spans. Downtown buildings along the corridor were
  demolished from 2012 on (Wikipedia).

## Downtown (State St / Grant St)

- In OSM, State St (z about -185) and Grant St (z about -295) are the one-way US 67 pair through downtown, each
  three lanes. The 2017 Snyder study proposed making State St a low-speed two-way street with on-street parking
  from 15th to 26th St, with Grant staying US 67. Its streetscape options were benches, decorative lighting, bike
  racks and gateway signage, plus a lamppost banner photo (snyder-associates.com; wvik.org 2017-09-25).
- State St work from 17th to 23rd St (roadway and sidewalks) began on 12 May 2026 (qctimes.com). Whether State
  St is now two-way is not confirmed, so the module leaves the lanes as OSM has them.
- 2018: the city set aside $400,000 for landscaping in front of City Hall, including a fountain and a sculpture.
  Ascentra Credit Union HQ went between Grant and State, across from the convention centre. The Isle paid for a
  jetty park where its riverboat used to dock (wvik.org 2018-04-02). The model puts the fountain and sculpture on
  the State St side of City Hall [G position].
- **City Hall, 1609 State St.** OSM shows one civic block: City Hall (east, 22 x 37 m, a round corner and a round
  stair drum), the Police Department (middle) and Fire Station 1 (west). Council meets in the 2nd-floor chambers
  (bettendorf.org). Modelled as 2-storey red-brown brick with stone trim [G]. The rounded NE corner is glass
  [G]. The fire station has 4 apparatus doors facing State St [G]. Flags out front are placed as props [G].
- **Quad Cities Waterfront Convention Center, 2021 State St.** Built 2006–08 and opened 24 Jan 2009 at a cost of
  $20M. 24,000 sq ft with a 15,000 sq ft ballroom and eight meeting rooms. The city owns it; it was operated by the
  Isle and is linked to it by a skywalk. Wikipedia files it under modernist architecture. It was first called the
  Bettendorf Events Center. Modelled as a tan precast ballroom block with a two-storey glass lobby on State St, an
  entrance canopy and the name on the glass [G]. The low east link is where OSM's footprint reaches toward the Isle.
- Isle Casino Hotel (already modelled, `landmarks.js` isle). Leach Park, Urban Park and McManus Park are close by.

## Learning Campus (18th St / Learning Campus Dr)

- **Family Museum, 2900 Learning Campus Dr.** Built 1997, with 44,000 sq ft of programme space and a 10,400 sq ft
  exhibit hall. It sits next to Faye's Field and the Bettendorf Public Library (familymuseum.org/about). The Fox
  Hollow renovation (2013, $1.3M) was the first big update (wvik.org 2013-02-15). The footprint is OSM's: a
  west wing and a long east wing with a curved bay. Modelled as buff masonry with teal trim, a curved glass bay,
  a glass entrance box with a yellow arched canopy toward the end of Learning Campus Dr, and two coloured roof
  drums [G: all facade details].
- Faye's Field, 2850 Learning Campus Dr: Rotary Row (five big outdoor musical instruments: hand drums and four
  aluminium chimes) is in its SE corner (quadcities.com). Not placed, because there is no instrument prop.
- Bettendorf Public Library, 2950 Learning Campus Dr (OSM building).

## Schools

- Bettendorf High School, 3333 18th St: built 1973, a six-building complex around a courtyard, black and gold
  (Wikipedia). OSM relation r10986676 (21,800 m²) is named by the module. The 1951 school is now the Mississippi
  Bend AEA (OSM, already named).
- Pleasant Valley High School, 604 Belmont Rd, Riverdale: opened 1960–61 (architects Swanson and Maiwald), navy and
  grey (Wikipedia). It is already named in OSM.
- Elementary schools (OSM areas): Hoover, Paul Norton, Grant Wood, Mark Twain, Neil Armstrong, Riverdale Heights,
  Hopewell, Pleasant View and Forest Grove. Also Bettendorf Middle School, Lourdes Catholic, Rivermont Collegiate
  (in the Joseph F. Bettendorf mansion), Edison Academy, Morning Star Academy and St Joan of Arc.

## Roads

- Roundabouts: Middle Rd & 53rd Ave (Iowa DOT roundabout inventory). Forest Grove Dr by TBK has four rings
  (Kittelson roundabout database: Forest Grove Dr / Championship Dr, plus 2023 and 2024 entries). The module draws
  islands at the six OSM junction=roundabout rings inside Bettendorf. Each island radius = OSM ring radius minus
  half the ring width, minus 0.6 m. The ring at 6050,-5844 is inside Davenport's limits and is left to that region.
- Medians: wherever OSM maps a street as two one-way carriageways with a 1–4 m kerb-to-kerb gap, a raised concrete
  median is added, trimmed 10 m back from each junction. This covers 53rd Ave, Middle Rd, Devils Glen Rd, Forest
  Grove Dr, Kimberly Rd, Spruce Hills Dr, Grant St and Belmont Rd. Wider gaps are left as grass.
- Middle Rd is Bettendorf's main arterial, about 5.7 mi from I-74 to I-80. It is being rebuilt in phases, and the
  Forest Grove Dr section reopened in Oct 2023 (millermeeks.house.gov project sheet).
- Signals, stop signs, lamps and parking lots already come from OSM. Water towers: the OSM ones (two at Arconic in
  Riverdale, one near Utica Ridge) are already drawn by the core. No source found for others.

## Retail (OSM names already in the tiles)

- Duck Creek Plaza (Middle Rd & Lincoln Rd), Cumberland Square (Middle Rd & 18th St), Middle Road Plaza, Hy-Vee
  (Middle Rd; Utica Ridge Rd).
- Utica Ridge / 53rd St strip: Barrel House, Granite City, Biaggi's, Osaka, TJ Maxx, Books-A-Million.
- Forest Grove Dr / TBK: Twin Span Brewing, Cambria Hotel, Foundry Food + Tap, Hurts Donut, Flips.
- Local institutions: Whitey's Ice Cream (Middle Rd), Happy Joe's (founded in Bettendorf 1972), Harris Pizza,
  Ross' Restaurant (not in OSM, not placed).

## Sources

- https://en.wikipedia.org/wiki/Bettendorf,_Iowa ; https://en.wikipedia.org/wiki/Riverdale,_Iowa ;
  https://en.wikipedia.org/wiki/Panorama_Park,_Iowa
- https://en.wikipedia.org/wiki/Quad_Cities_Waterfront_Convention_Center
- https://en.wikipedia.org/wiki/Bettendorf_High_School ; https://en.wikipedia.org/wiki/Pleasant_Valley_High_School_(Iowa)
- https://clui.org/ludb/site/riverdale-aluminum-plant ; https://quadcitieschamber.com/news/blog/175-million-investment-marks-major-expansion-at-arconic-davenport-works ;
  https://www.industrialinfo.com/news/article/alcoa-holds-groundbreaking-ceremony-for-300-million-expansion-of-davenport-works-in-iowa--202820
- https://www.familymuseum.org/about ; https://www.wvik.org/2013-02-15/fox-hollow-opens
- https://www.wvik.org/economy/2018-04-02/bettendorf-spruces-up-downtown ;
  https://www.wvik.org/government-politics/2017-09-25/possible-realignment-for-grant-and-state-streets ;
  https://www.snyder-associates.com/projects/downtown-revitalization-plan-starts-with-market-analysis-traffic-feasibility-study-bettendorf/
- https://iowadot.gov/traffic/roundabouts/Roundabouts-in-IA ; https://roundabout.kittelson.com/Roundabouts/Details/534
- https://www.quadcities.com/arts-and-entertainment-news/entertainment/rotary-row-offers-learning-and-musical-entertainment
- https://millermeeks.house.gov/sites/evo-subsites/millermeeks.house.gov/files/evo-media-document/Middle%20Road%20Reconstruction%20in%20Bettendorf%20Iowa.pdf
- OpenStreetMap contributors (ODbL), via tools/cache/chunks.
