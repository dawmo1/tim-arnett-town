# Tim Arnett Town

A free multiplayer 3D island sandbox that runs in the browser. Steal cars, cause chaos, run from the cops, all on one long tropical key named after a local legend.

**Play:** https://dawmo1.github.io/tim-arnett-town/

Everyone who types the same **room code** ends up in the same game. You can also send a link like `https://dawmo1.github.io/tim-arnett-town/#ABCD`.

## Controls

| Key | Does |
|---|---|
| WASD | Move / drive |
| Mouse | Look and aim (click the game first) |
| Click | Attack / shoot |
| Hold Tab or Q | Weapon wheel (move the mouse, release to equip). 1–7 or scroll also work |
| Right click | Aim (zooms in and locks onto nearby targets) |
| R | Reload |
| Shift (driving) | Nitro. In the helicopter: descend (Space climbs) |
| N | Change radio station |
| Esc or M | Pause menu: map and waypoints, goals, players, controls, settings |
| Shift | Sprint |
| Space | Jump / handbrake |
| E | Get in or out of a vehicle (steals it if someone's driving) |
| T | Chat |
| H | Controls help |

**Wanted level** works on witnesses and how bad the crime was:
- Punching someone or stealing a parked car only counts if a cop sees it.
- Gunfire counts if a cop hears it, or a bystander may call it in.
- Killing someone: a bystander phones the cops (2 stars, unless you stop them), or 3 stars if a cop sees it.
- Attacking a cop: 3. Killing a cop: 4. Keep killing cops (or down the helicopter) and it climbs to 5.

When no cop can see you, the stars flash and the police search your last known spot. Their vision cones show on the minimap (walls block them). Stay out of every cone until the stars clear.

Getting into a car takes a moment: you walk to the door, open it and yank out whoever's driving. You can't grab a car that's moving. Jump out of a fast car and you'll tumble.

Traffic stops for people in the road, unless you're wanted or just attacked someone.

**Money and things to do:** you start with $200. Earn cash from stunt jumps, robbing stores (stand at the door and hold your aim on the clerk; the alarm brings the cops), whatever people drop, the 15 hidden Tim gnomes, and the Goals list in the pause menu. Spend it at Arnett Arms (guns, ammo, body armor), the clinic pharmacy (health) and Arnett Auto (repair and respray, which also shakes off searching cops). There are speedboats at the docks and a helicopter on the beach helipad.

**Living world:** one day lasts 24 real minutes and the weather changes every 6 (clear, cloudy, rain, thunderstorms), the same for everyone in the room. At night windows light up, streetlights glow and cars run their headlights. Rain makes the roads slippery. Townspeople walk dogs, jog, sit on benches, sunbathe, chat and talk on the phone. When trouble starts they run, cower, call the cops, and some fight back with fists or a pistol. Pigeons scatter, gulls circle the beach and ducks paddle by the docks.

Find the yellow-and-black stunt ramps on the beach, at the far tip, and at the end of the broken bridge. Yes, you can jump it.

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

- Plain HTML + JavaScript with no build step. Libraries are bundled into `vendor/` (three.js for 3D, Rapier for ragdoll physics, Recast for NPC navigation), so the game loads nothing from CDNs. To update them: `cd tools && npm install && npm run vendor`.
- Each player's browser sends its own position 10 times a second. Walkers and traffic follow the same clock-driven routes on every computer, so only events (a walker dies, a car gets stolen) go over the network.
- The player who joined first runs the police for everyone. If they leave, the next player takes over.
- It trusts each player's own computer, which is fine for friends but not cheat-proof.
