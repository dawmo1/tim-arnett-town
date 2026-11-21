# Tim Arnett Town

A free multiplayer 3D open-world sandbox that runs in the browser, set in **Davenport, Iowa at full 1:1 scale**: the real streets, hills, buildings and riverfront, streamed in as you move. Steal cars, rob stores, run from the cops, and keep an eye out for Mayor Tim Arnett's billboards.

**Play:** https://dawmo1.github.io/tim-arnett-town/

Everyone plays in one shared online world: open the link and you're in. Your money, guns, cars and spot are saved.

## Controls

| Key | Does |
|---|---|
| WASD | Move / drive |
| Mouse | Look and aim (click the game first) |
| Click | Attack / shoot |
| Hold Tab or Q | Weapon wheel: move the mouse, release to equip. It is the only way to switch weapons |
| Right click | Aim (zooms in and locks onto nearby targets; the sniper zooms further) |
| R | Reload |
| Shift | Sprint. Driving: nitro. Helicopter: descend (Space climbs) |
| Space | Jump / handbrake. In front of a wall, fence or car: climb up or vault over |
| C (on foot) | Crouch. Crouch next to a wall or car to take cover |
| E | Get in or out of a vehicle (yanks the driver out) · go into shops, take stairs, use counters |
| C (driving) | Look behind |
| W + S (stopped) | Burnout. Flipped on a side or the roof: hold A or D to rock it back over. In the air: A / D roll, W / S tip the nose |
| ↑ (up arrow) | Phone: contacts (mechanic, taxi to your waypoint, 911, Arnett Auto, locals), messages, internet. Arrows move, Enter picks, Backspace / Esc go back, ↓ on the bottom row puts it away |
| P | Call the mechanic to drop off a car |
| G / H | Say hi / insult someone (some swing back). H while driving: horn |
| N | Change radio station |
| Esc or M | Pause menu: map and GPS, goals, players, controls, settings |
| T | Chat |

## What's in Davenport

- **The city:** downtown and the riverfront, the East Village, Hilltop and Vander Veer, Brady, Harrison and Main up to Kimberly Road and NorthPark, and west Davenport. Real elevation, so the bluffs are steep. Illinois is across the river; the Centennial and Government bridges end at **ROAD CLOSED** halfway over.
- **Landmarks:** Centennial Bridge's arches, the Skybridge (lit at night), Modern Woodmen Park with its Ferris wheel, the LeClaire Park bandshell, the Adler Theatre, Hotel Blackhawk, the Figge, Palmer College, the Vander Veer fountain, NorthPark, and a freight train down 5th Street with crossing gates. Barge tows work the Mississippi. Shops have made-up names; public landmarks keep theirs.
- **Traffic** follows the real lanes, one-way streets, traffic lights and stop signs, pulls over for sirens and floors it away from gunfire. Lots of parked cars to steal, plus taxis, buses, garbage and tow trucks, limos, muscle cars and the odd monster truck.
- **People** walk the sidewalks and cross at corners on the walk signal: office workers downtown, students by Palmer, shoppers at NorthPark, joggers and dog walkers on the riverfront, bus stops, buskers, hot dog carts (buy one to heal), road crews, crowds at the ballpark and bandshell in the evening and outside bars at night. Squirrels, rabbits and cats too.
- **Police** patrol with traffic and give you a star the moment they see a crime. Units roll out of the real police stations and route along the streets; the helicopter lifts off the station roof. Ambulances revive people who went down nearby, fire trucks put out burning cars.
- **Crime and money:** rob 15 corner stores and gas stations (hold a gun on the clerk) or the **Arnett Belle** riverboat casino. Everyone starts with every weapon (knife, crowbar, pistol, SMG, shotgun, rifle, sniper, grenades, Molotovs, RPG); buy ammo, discounted full loadouts and body armor at the four Arnett Arms (red ⌖ on the map), or pistol, SMG and shotgun rounds at any corner store counter. Buy outfits, haircuts, beards, tattoos and masks (ski mask or a Tim Arnett mask) at Tim's Threads, and mod your car at Arnett Auto: drive up to the blue ring and press E (respray with five finishes, rims, window tint, neon, horns, custom plates, engine, brakes, suspension, turbo, nitro, armor, bulletproof tires) and save it as your personal vehicle, which the mechanic delivers on call and which stays saved between sessions. A helicopter waits on a downtown rooftop: take the roof-access stairs. Street events (orange ! on the map) happen around you all the time, 47 kinds with lots of variations: stop muggings, carjackings, store holdups, armored-truck robberies and drunk drivers; catch runaway carts, loose dogs and escaped goats; break up food fights and rally scuffles; help stranded drivers, lost tourists and the injured (some hitchhikers are trouble). Street races, car meets, stunt jumps and delivery rushes wait at markers on the street, and driving a taxi, ambulance, fire truck, police car or scooter starts that vehicle's side job.
- **Bars and the casino:** about 20 walk-in bars on Davenport's real bar and pub spots (parody names, pink glass on the map). Order beer, whiskey, shots or cocktails at the counter (E), play pool or darts, or start a bar fight with the regulars (bump, insult with H, or punch). The Arnett Belle's casino floor has slots, blackjack, roulette and a bar (E at a machine or table); rob the cashier cage as before.
- **Wanted level** works on witnesses: a cop has to see it or a bystander has to call it in. To shake the cops, get out of every vision cone (they show on the minimap while they search). Hiding inside a shop or a parking ramp loses them faster, unless they know you're in the place you just robbed. Respraying only repairs the car now.
- **Living world:** a day lasts 24 real minutes and the weather changes (clear, cloudy, rain, storms, river fog, snow), the same for everyone online. At night windows and shop signs light up, there are fewer people and more cops, and the odd drunk driver.
- **Looks:** people, cars, guns and street props are modeled in Blender (`assets/src/*.py` build them into `assets/models/*.glb`). Every person is mixed from bodies, painted faces, hair and outfits; every car has an interior, opening doors, dents, glass and a driver. Buildings have brick and stone relief, recessed windows that reflect the sky, cornices, shop awnings, fire escapes and rooftop tanks; houses get porches, fences, driveways and gardens; trees sway in the wind.
- **Gangs:** the Westside Wolves (West End), Hilltop Hounds (Hilltop) and Kimberly Kings (Kimberly Road) hang out on their turf, shown faintly on the map. Flash a gun there and they'll warn you off; start something and the whole crew joins in.
- **Getting wasted:** dying plays a slow-motion **WASTED**, then you wake up at the hospital minus a bill (you keep your guns).

## Online: one world for everyone

There are no room codes. Everyone who opens the game joins the same world automatically, right from the main menu:

- **Main menu → Online** shows who's on (name, where they are, wanted stars, playing or still in the menu) and a chat box. It's the same chat as **T** in the game.
- **Your name** is asked once the first time you play. Change it any time in **Settings → Name**.
- **Your progress is saved:** cash, ammo, armor, health, stats, completed goals, your outfit, your personal garage cars with their mods, and where you were. Next time you start where you left off (on the nearest sidewalk if you were driving, swimming or inside a shop). Pick a town under **Start in** to start there instead. Settings stay in this browser only.
- Saves go to the online database every 30 seconds, a few seconds after your cash changes or you save a car, and when you close or switch away from the tab. A copy is kept in the browser too, so solo mode saves as well.
- Your save belongs to this browser (an anonymous sign-in, no account). Another browser or a cleared browser starts fresh.

### Server setup (already done once)

The game uses Google Firebase's free plan (Anonymous sign-in plus Realtime Database). [`src/firebase-config.js`](src/firebase-config.js) holds the web config; with `null` there the game runs in solo mode. The security rules are in [`database.rules.json`](database.rules.json): after changing them, paste the file into **Realtime Database → Rules** in the Firebase console and click **Publish**. Keep anonymous-account auto clean-up off, because saves are keyed by the anonymous account. The config values aren't passwords: they're meant to be in the website's code, and the rules keep it safe.

## Free plan limits

The Firebase free plan includes 10 GB of downloads a month and 100 players connected at once. With 8 players, that's roughly 60+ hours of play a month. You can check usage in the Firebase console under **Realtime Database → Usage**.

## Run it on your own computer

```bash
python3 tools/serve.py 8765
```

Then open http://localhost:8765. Open two browser windows to test online play (two tabs of the same browser are the same player, so use a private window or another browser for the second one).

## How it works

- Plain HTML + JavaScript with no build step. Libraries are bundled into `vendor/` (three.js for 3D, Rapier for ragdoll physics), so the game loads nothing from CDNs. To update them: `cd tools && npm install && npm run vendor`.
- **The map** is baked once from OpenStreetMap and open elevation data by `tools/build-map.mjs` into `data/`: 200 m tiles (ground heights and land use, building footprints, trees, parking spots), the road graph in 2 km chunks loaded on demand (lanes, one-ways, signals, stop signs, names, bridges), the railways and a low-detail overview. It covers the whole Quad Cities region: Davenport, Bettendorf, Le Claire, Port Byron, Rock Island, Moline, East Moline, Milan, Silvis, Colona, Coal Valley and Geneseo, with every river bridge drivable. The game streams tiles around you (a small first load, the rest in the background) and builds each one a few milliseconds per frame. To rebuild it: `cd tools && npm install && npm run fetch && npm run map`.
- **Graphics settings:** Low (no shadows or bloom, shorter view, fewer cars and people) is meant for school Chromebooks; Auto drops a level if the game runs slowly.
- Traffic and pedestrians are local to each player. A car you interact with (steal, crash, set on fire) gets its own id and syncs to everyone. Traffic lights, trains, barges, time and weather run on a shared clock, so everyone sees the same thing.
- Each player's browser sends its own position 10 times a second while another player is within 600 m, and once a second otherwise (enough for the map). Cars, planes (with pitch and bank) and car mods (paint, rims, tint, neon, ride height, plate) sync the same way. Minigames, the phone, being drunk and broken props stay on your own screen. The player who started playing first runs the police for everyone; if they leave, the next player takes over.
- It trusts each player's own computer, which is fine for friends but not cheat-proof.

## Credits

- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, available under the Open Database License (ODbL).
- Elevation from the [AWS Open Data Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (USGS and other public sources).
- 3D models built for this game in [Blender](https://www.blender.org/) from Python scripts; car brands are made-up parodies.
- Font: [Pricedown](https://typodermicfonts.com/pricedown/) by Typodermic Fonts, loaded from cdnfonts.com. Loading-screen art is in `assets/load/`.
- Business names in the game are made up. Tim Arnett is not actually the mayor. Yet.
