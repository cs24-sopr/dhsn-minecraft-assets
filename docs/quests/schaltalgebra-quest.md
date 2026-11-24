# Quest "Schaltalgebra"

Source: [behavior_pack/scripts/quests/schaltalgebra-quest.js](../../behavior_pack/scripts/quests/schaltalgebra-quest.js) · Test setup: [test-schaltalgebra.md](../events/test-schaltalgebra.md) (German) · Ticket: `project#173` · Rooms: `project#174` (building team)

In a lecture room there is a redstone lamp with a stone button on top. Pressing it lights the lamp briefly and teleports the player into a closed puzzle room. There the player sets four levers of a redstone circuit so that a lamp at the end of the room lights up. Solving the puzzle gives ECTS and keeps the lamp in the lecture room lit for good.

All texts are **placeholders** until the story team delivers the real ones. All chat output is **yellow**.

## Contents

- [Flow](#flow)
- [How the puzzle is detected](#how-the-puzzle-is-detected)
- [Configuration](#configuration)
- [What the building team has to provide](#what-the-building-team-has-to-provide)
- [Progress storage](#progress-storage)
- [Commands](#commands)
- [Testing](#testing)
- [Known limitations](#known-limitations)

## Flow

| Step | Player | Script |
| --- | --- | --- |
| Start | presses the stone button on the lamp in the lecture room | Without the student ID (`dhsn:studierendenausweis`): only a hint in the chat. With it: after 1 s (the lamp lights briefly by itself, vanilla redstone) the screen fades and the player is teleported into the puzzle room. All levers are switched off first. The first time, the questlog shows "Schaltalgebra – Löse das Rätsel der Schaltalgebra". |
| Puzzle | sets the four levers | Every 5 ticks: if the player is in the puzzle room and the target lamp is lit, the puzzle is solved. |
| Solved | sees the target lamp light up | Chat message, **ECTS** (`QUEST_ECTS`, once, via `addEcts` from [ects.js](../Ects.md)), the questlog line turns green, the lamp in the lecture room is switched on for good. |
| Return | presses the return button | Fade, teleport back into the lecture room. Possible at any time, also without solving. After solving, the questlog entry disappears. |

- **No failure:** without solving, the player simply comes back; the next visit starts again with all levers off.
- **After solving:** the teleport still works; solving again gives no more ECTS ("Das Rätsel hattest du schon gelöst.").
- **Adventure mode:** the circuit cannot be broken or changed; levers and buttons can be used.
- **Leaving the world in the puzzle room:** the player is still there after rejoining and comes back with the return button. An open questlog entry is restored.

## How the puzzle is detected

The script does **not** know the logic of the circuit. The building team builds the real redstone circuit (`project#174`, circuit plan from the story team). The puzzle counts as solved as soon as the **target lamp** is a lit redstone lamp (`minecraft:lit_redstone_lamp`). Changing the puzzle therefore needs no code change.

### Lamp in the lecture room

A redstone lamp only stays lit with power. To keep it on, the script puts a **redstone block directly below the lamp** (hidden in the floor) and remembers the block that was there before; resetting the quest puts it back. Everything that switches this lamp goes through `setStartLamp(on)`, so a different lamp (e.g. the LED tube, see the plan) would only change this function.

## Configuration

At the top of `schaltalgebra-quest.js`:

| Constant | Meaning |
| --- | --- |
| `LAYOUT` | All positions in the map (see below). `undefined` until the rooms exist; the test setup saves its own layout, which takes precedence. |
| `REQUIRED_ITEM` | `dhsn:studierendenausweis`. `undefined` switches the check off. |
| `QUEST_ECTS` | ECTS for solving, **placeholder 10**. All quests together should give 180 ([docs/Ects.md](../Ects.md), German). |
| `TELEPORT_DELAY` | Ticks between button and teleport (20; a stone button stays pressed for 20 ticks). |
| `CHECK_INTERVAL` | How often the target lamp is checked (5 ticks). |
| `TEXTS` | All texts. |

`LAYOUT` fields:

| Field | Position |
| --- | --- |
| `dimension` | e.g. `"minecraft:overworld"` |
| `startButton` | stone button on the lamp in the lecture room |
| `startLamp` | redstone lamp in the lecture room |
| `puzzleArrival` | `{ location, facing }`: where the player lands in the puzzle room and what they look at |
| `returnButton` | button in the puzzle room that leads back |
| `returnArrival` | `{ location, facing }`: where the player lands in the lecture room |
| `targetLamp` | redstone lamp at the end of the puzzle room |
| `levers` | the four levers |
| `puzzleArea` | `{ from, to }`: corners of the puzzle room |

## What the building team has to provide

- All positions of the `LAYOUT` table.
- The block **directly below the lamp** in the lecture room must be a plain floor block with no redstone around it; the script replaces it by a redstone block.
- The circuit must keep the target lamp **off when all levers are off**, because the script switches them off on every arrival.
- The puzzle room must be closed; the only way out is the return button.

## Progress storage

In the world (the map):

| Property | Content |
| --- | --- |
| `dhsn:quest_schaltalgebra:<player id>` | `{ "status": "started" }` or `{ "status": "done" }`; none = not started |
| `dhsn:schaltalgebra_lamp_on` | whether the lamp in the lecture room is on for good |
| `dhsn:schaltalgebra_lamp_base` | the floor block below the lamp before the redstone block was placed |
| `dhsn:schaltalgebra_test_layout` | layout of the test setup (only while testing) |

## Commands

| Command | Effect |
| --- | --- |
| `/scriptevent dhsn:quest_reset_schaltalgebra` | Resets your own progress and switches the lamp in the lecture room off. |
| `/scriptevent dhsn:quest_schaltalgebra_state` | Status and lamp in the chat. |
| `/scriptevent dhsn:quest_schaltalgebra_solve` | Solves the puzzle without a circuit (testing). |
| `/scriptevent dhsn:quest_test_schaltalgebra` | Test setup, see [test-schaltalgebra.md](../events/test-schaltalgebra.md). |
| `/scriptevent dhsn:quest_test_schaltalgebra_clear` | Removes the saved test layout. |

## Testing

Test environment: flat world, adventure mode, cheats on, DHSN packs active, content log on. Run `/scriptevent dhsn:quest_test_schaltalgebra` and follow the playtest checklist in the plan (`notizen/schaltalgebra/plan_schaltalgebra.md`, not in the repository) or these steps:

1. Press the button on the lamp without a student ID: hint, no teleport.
2. Take the student ID from the chest in the corner of the lecture room (or `/give @s dhsn:studierendenausweis`), press again: the lamp lights briefly, fade, teleport; questlog entry.
3. Levers A–D are all off. Set a wrong combination: nothing happens.
4. Press the return button: back in the lecture room, lamp off, questlog entry still open.
5. Go back, set the test solution (shown on a sign): the target lamp lights, chat message, ECTS, questlog line green.
6. Return: the lamp in the lecture room stays lit; also after `/reload` and after reopening the world.
7. Solve again: no more ECTS.
8. `/scriptevent dhsn:quest_reset_schaltalgebra`: quest open again, lamp off.

## Known limitations

- **Not tested in game yet.** Checked with `node --check`, `tsc` and a logic test with a mocked `@minecraft/server`.
- **Lever reset:** whether a lever switched by script (`setPermutation`) updates the circuit has to be checked in game. If not, the reset has no visible effect and the player switches the levers themselves.
- **Rooms not built yet:** until `project#174` is done, the quest only works with the test setup.
- **Lamp state is per world, not per player:** the game is single player.
- **Placeholders:** texts and ECTS amount.
