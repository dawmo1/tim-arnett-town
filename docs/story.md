# Story mode: plan and scaffold

Nothing is in the game yet. The plot below is a **draft for Dain to approve**; change anything.

## Decided (Dain, 2026-11-26)

- **Main character:** Flynn Arnett, Tim Arnett's son. Based on a real person, with permission; everything exaggerated GTA-style.
- **Tone:** drama-comedy GTA satire. Nothing off-limits.
- **Scope:** build Chapters 1 and 2 first, add more chapters later.
- **Solo only:** story missions are single-player; the online world stays as it is.
- **Real people:** only what Dain tells us goes in. No online lookups of private people. Friends and their families go in the public repo by first name.

## Flynn Arnett (from Dain)

- **17**, lives in **Geneseo, IL**. Geneseo High School (Maple Leafs): football team and trap shooting.
- **Looks:** about 5'10", heavy build, blonde hair. Grey sweatpants and a torn T-shirt, always.
- **Personality:** "dumb, funny, dumb." The clown. Everything makes him angry and everything makes him laugh. Says "bro" constantly.
- **Job:** dishwasher at GBC (Geneseo Brewing Company).
- **Car:** a beat-up Ford Escape (parody name in game) that he drives recklessly and hits people with.
- **Food:** McDonald's, everything on the menu.
- **Into:** gaming, the gym, cars, phonk and corny music.
- **Running gags:**
  - Tim keeps stealing Flynn's cart and hitting it himself.
  - Flynn calls his mom "Jugs."
  - Flynn beats up anyone who talks about his late grandma Lorece.
- **Family:** dad Tim Arnett, mom Rebecca Arnett ("Jugs"), late grandma Lorece.
- **Best friends:** Taefyl, Eric and Joshua. **Ex:** Neveah.

## Draft plot

**Premise.** In the game, Tim Arnett is the loudest man in Henry County. His face is on billboards all over the Quad Cities: Tim Arnett Injury Law, Arnett Auto, Arnett Arms, Tim's Threads and the Arnett Belle casino. Now he's running for mayor of Geneseo as "Mayor Tim." Flynn just wants his cart back, a McDonald's run and a quiet shift washing dishes at GBC. Every time Tim needs a dirty job done, Flynn gets dragged in, and Flynn's "help" makes everything ten times worse. Running thread: Flynn wants his dad to respect him (and stop stealing his cart); Tim wants a son who makes him look good on camera.

### Characters (draft)

- **Flynn Arnett:** the player.
- **Tim Arnett:** Flynn's dad. Game version: Quad Cities billboard mogul running for mayor, steals his son's cart. Waiting on Dain for what the real Tim is like.
- **Rebecca "Jugs" Arnett:** Flynn's mom. The only one who can make Flynn and Tim shut up. Waiting on Dain for her personality.
- **Grandma Lorece:** passed away. Her memory is sacred; insult her and a fight starts (a scripted brawl trigger).
- **Taefyl, Eric, Joshua:** Flynn's crew, who ride along on missions. Need one line each from Dain on what they're like.
- **Neveah:** Flynn's ex. Shows up at the worst possible moments.
- **Gloria Vance:** Tim's opponent for mayor (fictional).
- **"Big Lou" Ostrowski:** Rock Island money man secretly behind Tim's businesses (fictional). Chapter 2's villain.

### Chapter 1: "Bro" (Geneseo)

1. **Cart Thief.** Flynn wakes up and his cart is gone. Tim has it. Chase Tim around Geneseo in the Escape. Teaches driving, the map and the phone; ends with Tim hitting the cart in Flynn's face.
2. **Dish Pit.** A shift at GBC: a dishwashing minigame that goes off the rails when Tim brings his campaign team in for lunch and stiffs the bill. Flynn has to chase the campaign van down State Street.
3. **Two Cheeseburger Problem.** The crew does a McDonald's run in the Escape: "everything on the menu." Flynn hits a Vance campaign volunteer in the parking lot, and it's caught on camera. First wanted level.
4. **Friday Night Lights.** A football game at Bob Reade Field. Tim uses it as a campaign rally. Flynn has to keep Neveah away from Tim's camera crew, then the game turns into a brawl after a rival player talks about Grandma Lorece.
5. **Trap Day.** Trap shooting practice with the team (the trap-shooting activity from the roadmap). Tim shows up and wants Flynn to "accidentally" shoot down a Vance campaign drone.
6. **Town Hall.** Mayoral debate in downtown Geneseo by the Central Theatre. Tim wants Flynn to swap Vance's notes. Flynn finds a bag of cash in Tim's car from Big Lou. Tim wins the debate and Flynn realises Dad is in with Rock Island money.

### Chapter 2: "Across the River" (Quad Cities)

1. **Road Trip.** Tim sends Flynn and the crew down I-74 to make a "payment" to Big Lou at The District in Rock Island. Lou says it's short and keeps the Escape as interest. Flynn has to get a new ride.
2. **Aunt's Range.** Gear up at Arnett Arms (Davenport). Weapons and shooting mission.
3. **John Deere Joyride.** To cover the debt, Lou has Flynn steal a prototype tractor from Deere in Moline. Slow-speed police chase played for laughs.
4. **Channel Cat.** A meeting on the Channel Cat water taxi goes wrong; Flynn finds out Vance is on Lou's payroll too. Boat and foot chase on the riverfront.
5. **Belle of the Ball.** Election night at the Arnett Belle casino. Flynn and the crew rob Lou's cut from the counting room, with or without Tim's blessing (player chooses). Jugs shows up mid-heist.
6. **Lock and Dam.** Lou's crew chases Flynn to Lock & Dam 15. Showdown at the lock; Flynn gets the Escape back, wrecked. Ending: Tim wins, Lou is arrested, and Tim admits he tipped off the feds and used Flynn as bait. Flynn hits Tim's cart. Cliffhanger into Chapter 3.

### Still to decide

- What the real Tim and Rebecca are like (job, personality, sayings, look).
- One line each on Taefyl, Eric, Joshua and Neveah.
- Which house is the Arnett house in Geneseo (the first safehouse); a street is enough.
- Flynn's ringtone (something stupid).
- Where the trap team actually shoots (Bi-State Sportsman's in Colona is the nearest real range found).

## Planning first (with Dain)

- **Story:** the premise, tone and how Tim Arnett fits in.
- **Protagonist:** one protagonist or several, GTA V-style.
- **Acts:** acts and a mission list. For each mission: title, who gives it, where it starts (a real Quad Cities place) and what you do.
- **Characters:** main characters, their looks and their phone contacts.
- **Safehouses:** which real houses become enterable safehouses (this ties in with the "enterable select houses" roadmap item).
- **Online:** solo only, or co-op with friends riding along as passengers.

## Proposed code layout

```
src/story/
  index.js          mission runner: offers, steps, pass/fail, saves, map blips
  missions/
    act1-*.js        one file per mission (data + small step functions)
  cutscenes.js      camera shots and dialogue lines
```

### Mission shape

```js
export default {
  id: 'a1-welcome',          // stable: it's what the save remembers
  act: 1,
  title: 'Welcome to Davenport',
  giver: 'Tim Arnett',       // its first letter becomes the map blip
  start: { x: 258, z: 89, name: 'Hotel Blackhawk' }, // map metres: x east, z south of the origin
  requires: [],              // missions that must be done first
  reward: 500,
  steps: [
    { goal: 'Drive Tim to @Modern Woodmen Park@.', setup(m) {}, update(m, dt) { /* return 'next' | 'fail' */ }, cleanup(m) {} },
  ],
};
```

### How it should plug in

- **Reuse the street-event toolkit** in `src/events/kit.js`: `marker`, `person`, `car`, `goTo`, `drive`, `stay`, `timer`, `mission()` (the banner, with `*bold*` / `#italic#` / `@underlined@`), `win` / `fail`. Give each running mission an event-style object (`{ marks: [], people: [], cars: [], props: [] }`) so those helpers work unchanged.
- **Blips:** yellow letter blips for missions you can start, plus the current step's target. Push them next to `eventBlips()` in the two blip loops in `main.js`.
- **Update:** call `updateStory(dt)` right after `updateEvents(...)` in `main.js`'s `update()`.
- **Pause street events** while a mission runs. Events already go quiet while you're wanted; add a story check the same way.
- **Saving:** completed missions go into the online profile. That needs a `story` field (a list of mission ids) in `database.rules.json` under `profiles/$uid`; publish the rules with the code.
- **Admin console:** add `mission <id>` (start or skip) and `story reset` commands in `src/admin.js` for testing.

## Later

- **Cutscenes:** camera shots plus dialogue in the GTA subtitle style.
- **Failing:** checkpoints and retry after a fail.
- **Phone:** calls and texts from mission givers.
- **Menus:** a replay list in the pause menu, and a "Story Mode" entry in the main menu.
