# Tim Arnett Town V: handoff for new sessions

This file is the starting point for any new session working on this repo. Read it first, then `README.md` (player-facing features, controls, how online works).

**What it is:** a free, GTA V-style 3D open-world sandbox in the browser, set in a 1:1 Quad Cities (Davenport, Bettendorf, Rock Island, Moline and 8 more towns) built from OpenStreetMap. One shared online world for everyone.
**Live:** https://dawmo1.github.io/tim-arnett-town/ (GitHub Pages from `main`, deploys about a minute after a push).
**Owner:** Dain. He playtests and sends bug lists and roadmaps; he wants work pushed once it's done and tested.

## Working with Dain

- **Push when done and tested.** Work on a branch, test in a browser, merge into `main` and push. He often asks "is it all pushed?"; answer with `git status` and the last commit.
- **No tutorial pop-ups** ("press E to enter" and similar). Keys go in the Controls panel only.
- **Realism:** everything as close to 1:1 with the real Quad Cities as possible (real roads, real places, real business spots with parody names for national chains). Research references before modelling a landmark.
- **GTA V look:** Pricedown font, GTA V-style HUD, menus and loading screen. The loading screen is hands-off unless he asks for a change.
- **Model style (Dain, 2026-11-26):** people and players look like GTA San Andreas (PS2-era stylised proportions, painted-texture faces, chunky hair and clothes; research notes in `docs/people-style.md`). Cars, bikes, props and interiors keep the detailed style. Original designs only, never copied GTA assets. The HUD and menus stay GTA V style.
- **Helper agents:** as few as possible, each on Opus 5.5 at medium effort, unless he asks for more (he did once: one agent per town).
- **This Mac has 8 GB RAM:** only one Blender at a time (background `blender -b -P script.py`, never the shared Blender UI window for agents) and light node scripts (`--max-old-space-size=1024`). Locks used by parallel agents: `mkdir /private/tmp/claude-501/tat-blender.lock` and `tat-node.lock`.
- **Project board:** https://claude.ai/artifact/QhDWP3JvmEHRs6c7vbxot4, doc `projects/harbor-city`. Tick steps there when they're done (update `steps`, pinned with `if_version`).
- **Downloads:** free licenses only (CC0 preferred), and credit them in the menu's Credits panel (`index.html`, `#mmCredits`).

## Run and test

```bash
python3 tools/serve.py 8765
```

- Open http://localhost:8765 (the no-cache server means you don't need hard reloads).
- **Two players:** use two different browsers (for example the built-in browser pane plus Chrome). Two tabs of the same browser share one player.
- **Debugging:** a temporary hook appended to `src/main.js`, like `window.__dbg = { me, vehicles, net, ... }; // TEMP-DBG`, lets you drive the game from the console. Remove every `TEMP-DBG` line before committing (`grep -rn TEMP-DBG src`).
- **Syntax check:** run every changed file through `node --input-type=module --check < file.js`.
- **Map data checks:** `cd tools && npm run checks`, which runs check-roads and scan-placement. Both must pass after any builder change.
- A hidden browser pane runs very slowly; prefer a visible Chrome tab for timing-sensitive tests.

## Architecture (plain ES modules, no build step)

- `index.html`: the loading screen (the `tatNextArt(n = 10)` shuffle bag over `assets/load/art1-10.jpg`), the main menu and the panels.
- `style.css`: all UI styling.
- `vendor/`: bundled three.js r160 and Rapier. Rebuild with `cd tools && npm run vendor`.
- `src/main.js`, about 2,700 lines, the hub:
  - player, input, camera, combat and robbery
  - vehicles in and out (passengers too)
  - the menu, loading flow and spawn camera
  - the online wiring
  - the `update()` loop
- Feature modules, all fed by `main.js` through small context objects:
  - **Vehicles:** `vehicles.js` (physics), `carmodel.js`, `carlights.js`, `carmods.js`, `garage.js`
  - **NPCs and traffic:** `npc.js` (pedestrians), `traffic.js`
  - **Police and crime:** `police.js`, `wanted.js`, `gangs.js`, `carjack.js` (locked cars, window smash, hotwire, alarms, jacked drivers' reactions, gunpoint holdups of drivers, shot tyres / windows / fuel tank; its state rides in the vehicle record's `l` bits from 256 up)
  - **World:** `daynight.js`, `planes.js`, `breakables.js`, `interiors.js`, `venues.js` (bars and casino), `landmarks.js` (lazy-loaded GLB landmarks)
  - **Player features:** `phone.js`, `radio.js`, `drunk.js`, `economy.js`
  - **Effects and sound:** `fx.js` holds both the visual effects and all sound (see below)
- `src/ui.js`: HUD, minimap and big map (zoom levels, blip tiers, legend), feed, player list.
- `src/events.js` + `src/events/*.js`: street events (47 types). `src/events/kit.js` is the toolkit: markers, scripted people and cars, the mission banner, win/fail. Story mode reuses it.
- `src/minigames/*`: pool, darts, slots, blackjack, roulette.
- `src/admin.js`: the ~ console and admin commands.
- `src/net.js` + `database.rules.json`: online play (see below).
- `src/city/*`, `src/world.js`, `src/regions/*`: map streaming and building.
  - `data/` holds 200 m tiles plus road chunks in `data/roads/*.json`.
  - Map coordinates are metres: x east, z south from the origin at lat 41.5236, lon -90.5776.
  - Each town has a module in `src/regions/<id>.js`: `{ id, name, bounds, names, places, models, notes }`. See `src/regions/README.md`.
- `tools/`: the map builder.
  - `build-map.mjs` turns the OSM PBF extracts plus Microsoft building footprints in `tools/cache` (git-ignored) into `data/`.
  - Rebuild with `cd tools && npm run map`; it needs about 1.3 GB RAM and 50 s.
- `assets/`:
  - `models/*.glb` and `models/regions/<town>/*.glb`, built from the Blender Python sources in `assets/src/`
  - `sfx/` and `music/`
  - `load/`: the loading art

### Things that bite

- **Shadows:** never toggle `castShadow` at runtime, because it recompiles every material and freezes the game. Shadows switch off by collapsing the sun shadow camera's far plane (`daynight.js`).
- **Shader prewarm** (`prewarmShaders` in `main.js`) compiles only its own group. An object without geometry elsewhere in the scene once blocked Play.
- **Landmark GLBs:** Blender 5.2 exports real colours in `COLOR_1`, and the repack step must keep them, or the landmarks come out all white.
- **Profile saves are strictly validated** (`profiles/$uid`, `$other: false`). Any new saved field needs a rules change, published by hand.

## Online (Firebase)

- **Service:** Firebase Realtime Database plus anonymous auth, on project `tim-arnett-town`. The console is on Dain's BizarreHC Google account (console URL prefix `/u/1/`).
- **Plan:** free Spark plan, which allows 100 concurrent connections and 10 GB a month.
- **Data layout:** one room, `rooms/WORLD`, holding `players`, `vehicles`, `cops/{hostUid}`, `events` and `chat`. Outside the room:
  - `profiles/$uid`: saves
  - `admins`, `adminKeys` and `secret`: the admin console
- **Changing `database.rules.json`:** paste it into Realtime Database → Rules in the console and publish, in step with the code push.
- **Admin code:** stored only in `secret/adminCode`, which Dain set by hand in the Data tab. Never put it in the repo; the repo is public. The rules compare `adminKeys/{uid}` against it.
- **Police:** each group of players within about 1.2 km has one host running its cops.
- **Passengers:** they sit in player-state slot 20 (`s[20]`). Only the driver's client simulates the car.
- **Chat** keeps the last 100 messages.
- **Shared world state:** `rooms/WORLD/world` holds admin time offset, frozen clock, weather and game speed (admins only); `admin.js` applies it on every client.
- **Trust model:** it trusts clients, which is fine for friends but not cheat-proof.

## Sound

- **Recorded sounds (all CC0):** `assets/sfx/<name>_<n>.mp3`, listed in `SFX` in `fx.js` and played by `sample()`. The synth plays instead until a file loads. Sources:
  - Free Firearm Sound Library
  - Kenney Interface Sounds
  - OpenGameArt packs
  - Fantozzi's footsteps
  - Independent.nu hits and punches
- **Loading and menu music:** `assets/music/loading.mp3` ("Friendly Evil Gangsta Synth Hip Hop" by Mesostic, CC0). `fx.setMusic()` is called from `loading()`.
- **Still synthesized:** engines, siren, horn, the ambience loops, cash and UI jingles.
- Night crickets are random short chirps. Don't go back to a held tone; Dain heard it as ringing.

## Story mode (planned, nothing in the game yet)

- No story code exists yet. **On hold (Dain, 2026-11-26): online must be fully polished before story mode is worked on.**
- The chosen premise is version 5, "Dead Dad Walking" (Flynn Arnett, 17, Geneseo; Tim fakes his death), in `docs/story.md`, with open questions for Dain.
- **The plot is Dain's call.** Plan acts, characters and missions with him before writing any code or content.

## Roadmap (Dain, 2026-11-25), in no fixed order

1. **E-bikes:** a rideable e-bike vehicle type (bike physics like the motorbike, quiet motor sound, pedal animation), parked and ridden around town, rentable at real bike-share spots.
2. **Much better car models:** redo every car GLB with real proportions and detail: body panels, proper wheels and tyres, lights, interiors, LODs. Keep the parts contract `carmodel.js` expects (seats, doors, lights, sign boxes).
3. **Better animations for everything interactive:** entering and exiting cars, opening doors, robbing, buying at counters, sitting, minigames, phone, climbing, punching, reloading, ragdoll recovery.
4. **Better character models:** bodies, faces, hair and clothes (`src/people/*`, `assets/src/` person builders), while keeping the mix-and-match looks system and its performance.
5. **Enterable landmarks:** finish interiors for the remaining landmarks: Vibrant Arena, Old Main, Circa '21, Deere HQ, Clock Tower, the airport, NorthPark, the Black Hawk lodge and Riverdale HS (see `docs/landmarks-references.md`).
6. **Enterable select houses:** a set of real houses you can walk into (safehouse candidates for story mode), built with the interiors system.
7. **Story mode:** plan the plot with Dain, then build it following `docs/story.md`.

### Older open items (also on the board)

- Fountain, playground and billboard place kinds; Welcome to Iowa / Illinois bridge signs.
- Tractor and semi-trailer vehicle types; Lock & Dam 15 lock animation; exact Channel Cat landings.
- Future: properties and businesses that earn money from the phone; activities (golf, bowling, fishing, drive-in, tractor pulls, trap shooting at Bi-State Sportsman's in Colona).

### Known limits and loose ends

- Admin moderation (kick, freeze) only works on unmodified clients.
- Shadow-pass shaders and the tracer material aren't prewarmed.
- Licence plate and taxi-sign text use the same fix as the bus sign, which reads correctly in-game ("12 ARNETT AVE"); the plates and taxi sign weren't checked in-game themselves.

## Session status (2026-11-27)

- Everything below is merged into `main` and live.
- **Roadmap items done:** 1 e-bikes, 2 car models, 3 animations, 4 character models, 5 enterable landmarks (Riverdale HS skipped: outside the map).
- **Also done:**
  - Carjacking and street mechanics (`src/carjack.js`).
  - Combat feel (`src/combat.js`).
  - Online fixes: shared admin time/weather/slowmo, passenger-seat clash, stale event cleanup.
  - GTA V-style top-right HUD with new weapon icons (`src/weapon-icons.js`).
- **People and animations** (`src/anim.js`, `src/people/pose.js`):
  - San Andreas style.
  - Confirmed headless: car in/out, get-up, doors, counters, sitting (bar seats and street benches), phone, pool, slots, e-bike pedalling.
  - Sync between players checked only with a simulated remote player (`s[21]`/`s[22]`).
- **Not done / loose ends:**
  - A take-cover key.
  - NPC melee damage still lands at the start of their swing (`npc.js`).
  - Two players breaking into the same parked car each run their own copy.
  - Alarm timing on remote screens is local.
  - A stolen station cruiser's spot can get a new cruiser.
  - The window-smash pose reads as a forearm more than an elbow.
  - Nothing new has been tested with two real browsers.
- **Dain:**
  - Publish the new `database.rules.json` (adds the `world` node and old-event deletion; backward compatible).
  - Run `cd tools && npm run checks` on the Mac (check-roads needs `tools/cache`).
- The dark-blue box in headless screenshots is a quirk of headless software rendering (Dain doesn't see it).
- Blender 5.2.5 is installed in the cloud container at `/opt/blender-dl`; scripts read the repo root from `TAT_ROOT` (`TAT_ROOT=$PWD/ blender -b -P assets/src/<script>.py`).
