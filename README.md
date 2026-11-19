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
| 1–7 or wheel | Fists, bat, pistol, SMG, shotgun, rifle, grenade |
| Shift | Sprint |
| Space | Jump / handbrake |
| E | Get in or out of a vehicle (steals it if someone's driving) |
| T | Chat |
| H | Controls help |

Crimes (killing people, stealing cars, attacking cops) give you wanted stars. At 4+ stars the police set up roadblocks. Stay out of police sight long enough and the stars go away.

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
python3 -m http.server 8765
```

Then open http://localhost:8765. Open two browser tabs with the same room code to test multiplayer.

## How it works

- Plain HTML + JavaScript with no build step. 3D uses [three.js](https://threejs.org) loaded from a CDN.
- Each player's browser sends its own position 10 times a second. Walkers and traffic follow the same clock-driven routes on every computer, so only events (a walker dies, a car gets stolen) go over the network.
- The player who joined first runs the police for everyone. If they leave, the next player takes over.
- It trusts each player's own computer, which is fine for friends but not cheat-proof.
