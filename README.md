# Tim Arnett Town

A free multiplayer 3D open-world sandbox that runs in the browser, set in **Davenport, Iowa at full 1:1 scale**: the real streets, hills, buildings and riverfront, streamed in as you move. Steal cars, rob stores, run from the cops, and keep an eye out for Mayor Tim Arnett's billboards.

**Play:** https://dawmo1.github.io/tim-arnett-town/

Everyone who types the same **room code** ends up in the same game. You can also send a link like `https://dawmo1.github.io/tim-arnett-town/#ABCD`.

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
| P | Phone: call the mechanic to drop off a car |
| G / H | Say hi / insult someone (some swing back) |
| N | Change radio station |
| Esc or M | Pause menu: map and GPS, goals, players, controls, settings |
| T | Chat |

## What's in Davenport

- **The city:** downtown and the riverfront, the East Village, Hilltop and Vander Veer, Brady, Harrison and Main up to Kimberly Road and NorthPark, and west Davenport. Real elevation, so the bluffs are steep. Illinois is across the river; the Centennial and Government bridges end at **ROAD CLOSED** halfway over.
- **Landmarks:** Centennial Bridge's arches, the Skybridge (lit at night), Modern Woodmen Park with its Ferris wheel, the LeClaire Park bandshell, the Adler Theatre, Hotel Blackhawk, the Figge, Palmer College, the Vander Veer fountain, NorthPark, and a freight train down 5th Street with crossing gates. Barge tows work the Mississippi. Shops have made-up names; public landmarks keep theirs.
- **Traffic** follows the real lanes, one-way streets, traffic lights and stop signs, pulls over for sirens and floors it away from gunfire. Lots of parked cars to steal, plus taxis, buses, garbage and tow trucks, limos, muscle cars and the odd monster truck.
- **People** walk the sidewalks and cross at corners on the walk signal: office workers downtown, students by Palmer, shoppers at NorthPark, joggers and dog walkers on the riverfront, bus stops, buskers, hot dog carts (buy one to heal), road crews, crowds at the ballpark and bandshell in the evening and outside bars at night. Squirrels, rabbits and cats too.
- **Police** patrol with traffic and give you a star the moment they see a crime. Units roll out of the real police stations and route along the streets; the helicopter lifts off the station roof. Ambulances revive people who went down nearby, fire trucks put out burning cars.
- **Crime and money:** rob 15 corner stores and gas stations (hold a gun on the clerk) or the **Arnett Belle** riverboat casino. Buy guns at Arnett Arms (knife, crowbar, pistol, SMG, shotgun, rifle, sniper, grenades, Molotovs, RPG), outfits, haircuts, beards, tattoos and masks (ski mask or a Tim Arnett mask) at Tim's Threads, and upgrades at Arnett Auto (paint, rims, engine, brakes, tires, nitro, armor, bulletproof tires). A helicopter waits on a downtown rooftop: take the roof-access stairs. Stop muggings, purse snatchers and car thieves for a reward.
- **Wanted level** works on witnesses: a cop has to see it or a bystander has to call it in. To shake the cops, get out of every vision cone (they show on the minimap while they search). Hiding inside a shop or a parking ramp loses them faster, unless they know you're in the place you just robbed. Respraying only repairs the car now.
- **Living world:** a day lasts 24 real minutes and the weather changes (clear, cloudy, rain, storms, river fog, snow), the same for everyone in the room. At night windows and shop signs light up, there are fewer people and more cops, and the odd drunk driver.
- **Looks:** people, cars, guns and street props are modeled in Blender (`assets/src/*.py` build them into `assets/models/*.glb`). Every person is mixed from bodies, painted faces, hair and outfits; every car has an interior, opening doors, dents, glass and a driver. Buildings have brick and stone relief, recessed windows that reflect the sky, cornices, shop awnings, fire escapes and rooftop tanks; houses get porches, fences, driveways and gardens; trees sway in the wind.
- **Gangs:** the Westside Wolves (West End), Hilltop Hounds (Hilltop) and Kimberly Kings (Kimberly Road) hang out on their turf, shown faintly on the map. Flash a gun there and they'll warn you off; start something and the whole crew joins in.
- **Getting wasted:** dying plays a slow-motion **WASTED**, then you wake up at the hospital minus a bill (you keep your guns).

## Turn on multiplayer (one-time, about 5 minutes)

Until this is done the game runs in **solo mode**. Multiplayer uses Google Firebase's free plan, which also works on school Wi-Fi.

1. Go to https://console.firebase.google.com and sign in with a Google account.
2. Click **Create a project** (or "Add project"). Name it `tim-arnett-town`. You can turn **Google Analytics off**. Click through to finish.
3. **Turn on sign-in:** left menu, **Build → Authentication → Get started**. Under **Sign-in method**, click **Anonymous**, switch it **on**, and save.
4. **Allow the website:** still in Authentication, open **Settings → Authorized domains → Add domain** and add `dawmo1.github.io`.
5. **Create the database:** left menu, **Build → Realtime Database → Create database**. Pick the location closest to you, choose **Start in locked mode**, and click Enable.
6. **Paste the rules:** in Realtime Database, open the **Rules** tab, delete everything, paste in the contents of [`database.rules.json`](database.rules.json), and click **Publish**.
7. **Get the config:** click the gear icon (top left), **Project settings**. Scroll to **Your apps** and click the **`</>`** (Web) icon. Name it `web` and **don't** tick "Firebase Hosting". Click Register. You'll see a block like `const firebaseConfig = { apiKey: ..., ... }`.
8. Copy that whole `{ ... }` block and send it to Claude, or paste it into [`src/firebase-config.js`](src/firebase-config.js) in place of `null`. Make sure it includes a `databaseURL` line. If it doesn't, copy the URL shown at the top of the Realtime Database page.

These config values aren't passwords. They're meant to be in the website's code, and the database rules are what keep it safe.

## Free plan limits

The Firebase free plan includes 10 GB of downloads a month and 100 players connected at once. With 8 players, that's roughly 60+ hours of play a month. You can check usage in the Firebase console under **Realtime Database → Usage**.

## Run it on your own computer

```bash
python3 tools/serve.py 8765
```

Then open http://localhost:8765. Open two browser tabs with the same room code to test multiplayer.

## How it works

- Plain HTML + JavaScript with no build step. Libraries are bundled into `vendor/` (three.js for 3D, Rapier for ragdoll physics), so the game loads nothing from CDNs. To update them: `cd tools && npm install && npm run vendor`.
- **The map** is baked once from OpenStreetMap and open elevation data by `tools/build-map.mjs` into `data/`: 200 m tiles (ground heights and land use, building footprints, trees, parking spots), the road graph (lanes, one-ways, signals, stop signs, names), the railways and a low-detail overview. The game streams tiles around you (a small first load, the rest in the background) and builds each one a few milliseconds per frame. To rebuild it: `cd tools && npm install && npm run fetch && npm run map`.
- **Graphics settings:** Low (no shadows or bloom, shorter view, fewer cars and people) is meant for school Chromebooks; Auto drops a level if the game runs slowly.
- Traffic and pedestrians are local to each player. A car you interact with (steal, crash, set on fire) gets its own id and syncs to everyone. Traffic lights, trains, barges, time and weather run on a shared clock, so everyone sees the same thing.
- Each player's browser sends its own position 10 times a second. The player who joined first runs the police for everyone; if they leave, the next player takes over.
- It trusts each player's own computer, which is fine for friends but not cheat-proof.

## Credits

- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, available under the Open Database License (ODbL).
- Elevation from the [AWS Open Data Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (USGS and other public sources).
- 3D models built for this game in [Blender](https://www.blender.org/) from Python scripts; car brands are made-up parodies.
- Business names in the game are made up. Tim Arnett is not actually the mayor. Yet.
