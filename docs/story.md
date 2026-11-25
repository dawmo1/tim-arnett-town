# Story mode: plan and scaffold

Nothing is in the game yet. This is the proposed structure, so a future session can start building once Dain has planned the plot with it.

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
