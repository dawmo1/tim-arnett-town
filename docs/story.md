# Story mode: plan and scaffold

Nothing is in the game yet. The plot below is a **draft for Dain to approve**; change anything.

## Decided (Dain, 2026-11-26)

- **Main character:** Flynn Arnett, Tim Arnett's son.
- **Tone:** drama-comedy GTA satire of the Midwest.
- **Scope:** build Chapters 1 and 2 first, add more chapters later.
- **Solo only:** story missions are single-player; the online world stays as it is.

## Draft plot

**Premise.** Tim Arnett's face is on every billboard in the Quad Cities: Tim Arnett Injury Law, Arnett Auto, Arnett Arms, Tim's Threads, the Arnett Belle casino, and now "Mayor Tim" for mayor of Davenport. Flynn, his twenty-something son, comes home broke after flaming out in Chicago. Tim puts him to work "in the family business" and Flynn slowly finds out how much of that business is a con. Running thread: Flynn wants his dad's respect, Tim wants a son who'll make him look good, and neither gets what he wants.

### Characters (draft)

- **Flynn Arnett:** the player. Sarcastic, a decent driver, terrible with money, better person than his dad.
- **Tim Arnett:** loud, beloved local celebrity and businessman, running for mayor. All handshake and no conscience, but he does love his kid in his own way.
- **Dez:** Flynn's best friend from high school, works the Arnett Auto lot, comic relief and getaway driver.
- **Aunt Rhonda Arnett:** Tim's sister, runs Arnett Arms, the only Arnett who tells Flynn the truth.
- **Gloria Vance:** Tim's opponent for mayor. Squeaky clean in public.
- **"Big Lou" Ostrowski:** Rock Island money man whose cash is quietly behind the Arnett Belle. Chapter 2's heavy.

### Chapter 1: "Prodigal Son" (Davenport)

1. **Homecoming.** Flynn gets off the bus downtown; Tim is late, sends Dez. Drive home to the Arnett house (the first safehouse). Teaches driving and the map.
2. **Billboard Duty.** Someone is defacing Tim's billboards. Drive around Davenport cleaning them, then chase the vandal (a Vance campaign kid) through the Village of East Davenport.
3. **Repo Man.** Arnett Auto needs a car "repossessed" from a customer in Bettendorf. It turns out the customer paid in full. First robbery-style mission and first wanted level.
4. **Slip and Fall.** Tim's law firm needs a client. Flynn stages a fender-bender at NorthPark Mall with a hired "victim" who keeps overacting. Comedy chase from mall security and police.
5. **Night at the Ballpark.** Tim hosts a campaign fundraiser at Modern Woodmen Park. Flynn has to keep a drunk donor away from the press, then deliver a bag of cash he isn't supposed to open. He opens it.
6. **The Debate.** Mayoral debate at the Adler Theatre. Tim wants Flynn to swap Vance's notes; Flynn finds out the cash bag came from Big Lou. Ends with Tim winning the debate and Flynn knowing his dad is in deep with Rock Island money.

### Chapter 2: "Across the River" (Rock Island, Moline, the river)

1. **Toll Bridge.** Tim sends Flynn over the Centennial Bridge to make a "payment" to Big Lou at The District in Rock Island. Lou says it's short and keeps Flynn's car as interest.
2. **Rhonda's Range.** Aunt Rhonda gears Flynn up at Arnett Arms and tells him the Arnett Belle has been losing money for years. Weapons and shooting mission.
3. **John Deere Joyride.** To cover the debt, Lou has Flynn steal a prototype tractor from Deere in Moline (ties into the planned tractor vehicle type). Slow-speed police chase played for laughs.
4. **Channel Cat.** A meeting on the Channel Cat water taxi goes wrong; Flynn finds out Gloria Vance is also taking Lou's money. Boat and foot chase along the riverfront.
5. **Belle of the Ball.** Election night party at the Arnett Belle. Flynn and Dez rob Lou's cut out of the casino's own counting room, with Tim's blessing or without it (player chooses).
6. **Lock and Dam.** Lou's crew chases Flynn up the river to Lock & Dam 15. Big chase, showdown at the lock. Ending: Tim wins the election, Lou is arrested, and in the last scene Tim tells Flynn the feds were tipped off by... Tim, who used his own son as bait. Cliffhanger into Chapter 3.

### Still to decide

- Flynn's look (age, hair, clothes) and Tim's look.
- Which real house is the Arnett house safehouse (for example a McClellan Heights or Prospect Park house in Davenport).
- Whether the Chapter 2 mission 5 choice changes the ending.

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
