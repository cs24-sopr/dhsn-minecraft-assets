# Quest "Das Erwachen"

Source: [behavior_pack/scripts/quests/awakening-quest.js](../../behavior_pack/scripts/quests/awakening-quest.js) · Test setup: [behavior_pack/scripts/events/test-awakening.js](../../behavior_pack/scripts/events/test-awakening.js) · Building blocks: [Quest events](../Events.md) (German) · Ticket: #106

The first quest of the game. The player wakes up in the start building because of an alarm clock, looks out of the window, which starts a camera ride around the university, searches a chest for a backpack and food, leaves the building, takes the portal to the campus island and talks to the professor in front of the main entrance.

All dialog texts and the music are **placeholders** until the story team delivers the real ones. All chat output is **yellow**.

## Contents

- [Features](#features)
- [Moving the quest to the real map](#moving-the-quest-to-the-real-map)
- [Customization](#customization)
- [Testing](#testing)
- [Commands](#commands)
- [Known limitations](#known-limitations)
- [Technical overview](#technical-overview)

## Features

### Flow

```text
join the world (or test command) ──► wake up, alarm rings ──► walk up to the window ──► camera ride + title
        step "wake"                  (switching it off is optional)                              │
                                                                                                 ▼
 talk to the professor ◄── step "professor" ◄── use the portal ◄── step "portal" ◄── search the chest   step "chest"
        │                  (side quest starts)   (building can be left now)
        ▼
  quest done
```

| Step | What the player does | What happens |
| --- | --- | --- |
| `wake` | Wakes up. Optionally right-clicks the alarm clock (note block). Walks up to the window. | The alarm beeps twice per second until the player switches it off or looks out of the window. Right-clicking it switches it off instead of changing the pitch. Walking into the window area starts the camera ride. |
| `chest` | Right-clicks the chest in the room. | The chest does not open; the player gets a backpack and food directly (placeholder: a bundle, 3 bread, 2 apples). |
| `portal` | Leaves the building and steps onto the portal. | Screen fades out, the player is teleported to the gate of the campus island, the side quest "Gelände erkunden" starts. |
| `professor` | Right-clicks the professor in front of the gate. | A dialog with the placeholder welcome text; afterwards the quest is done. |
| `done` | - | The questlog entry disappears, the chat shows `Quest abgeschlossen: Das Erwachen (<name>)` to everyone. |

### Camera ride

Starts when the player enters the window area during the first step. It cannot be skipped: movement is disabled, the HUD is hidden, the camera flies through the shots of `cameraPath` with the intro music, and at the end the name of the university appears as a title (`TEXTS.universityName`). The screen then fades out and back in, and the player gets control back. After the ride the quest moves on to the chest.

The ride is described by a list of shots (see [`cameraPath`](#camera-path)). A player who leaves the world during the ride gets camera, movement and HUD back on the next join and has to look out of the window again.

### Leaving the building

Before the `portal` step (that is, until the ride **and** the chest are done), leaving the building area puts the player back at `buildingReturn` with a short hint. This is only a safety net; in the real map the builders should also keep the door closed in a way that fits the story (the ticket only asks that the building cannot be left before the ride).

### Questlog

The entry "Das Erwachen" shows the current objectives; finished ones turn green:

```text
Das Erwachen
 - Wecker ausschalten (optional)
 - Aus dem Fenster blicken
```

Later steps add `Die Truhe durchsuchen`, `Den Teleporter benutzen`, then `Nebenquest „Gelände erkunden“ gestartet` and `Den Professor am Haupteingang ansprechen`. With more than one player online the title gets the player's name, because the questlog is shared by all players.

### Progress storage

One world dynamic property per player: `dhsn:quest_awakening:<player id>`, JSON `{ "step": "wake" | "chest" | "portal" | "professor" | "done", "alarmOff": true | false }`. It survives `/reload`, restarting the world and rejoining. No value means the quest was never started.

## Moving the quest to the real map

The quest knows nothing about the map. Everything it needs is one `LAYOUT` object at the top of `awakening-quest.js`. Until it is filled in (it is `undefined`), the quest does nothing; the test setup provides its own layout instead (see [Testing](#testing)).

**Checklist for the real map**

1. **Builders:** build the start building, the alarm clock (a **note block**), a chest, the window, the portal, the gate of the island and put an NPC in front of it. Write down the coordinates.
2. **Fill in `LAYOUT`** in `awakening-quest.js` (the commented example above the constant shows all fields). Coordinates are the ones from "Show coordinates" in the game, see the table below.
3. **Tag the professor:** the NPC is the professor if it carries the tag `dhsn:awakening_professor`. For example, standing next to it:

   ```text
   /tag @e[type=<entity id>,r=5] add dhsn:awakening_professor
   ```

   Which NPC entity it is does not matter to the quest.
4. **World spawn point:** set it at the bed (`/setworldspawn`). The player is not moved when the quest starts on the first join (`AUTO_START`).
5. **Camera path:** fly the path once with `/scriptevent dhsn:quest_awakening_ride` and adjust `cameraPath` until it looks right. The ride can be replayed as often as needed without changing any progress.
6. **Delete the test setup:** remove `behavior_pack/scripts/events/test-awakening.js` and its import in `main.js`. The quest itself does not import it. If the file is missing, `startAwakening` and the commands of the quest still work.
7. **Replace the placeholders:** texts, music, the backpack item, the university name and the hooks for the side quest and the follow-up quest (see [Customization](#customization)).

Then remove any test layout that is still saved in the world with `/scriptevent dhsn:quest_test_awakening_clear`. The test layout takes precedence over `LAYOUT`, so a world in which the test was run **ignores `LAYOUT` until it is cleared**.

### Layout fields

| Field | Type | Meaning |
| --- | --- | --- |
| `dimension` | string, optional | Dimension id of everything below. Default `"minecraft:overworld"`. |
| `wake` | position | Where the player wakes up (feet). Only used by `/scriptevent dhsn:quest_awakening_start` and the test setup; the real map uses the world spawn point. |
| `wakeFacing` | position | The point the player looks at after waking up and after being put back into the building. |
| `alarm` | position | The note block that is the alarm clock. |
| `window` | two corners | The spot in front of the window. Entering it starts the ride. Keep it small and include some height, so it is hit by walking up to the window. |
| `chest` | position | The chest. Any block at this position works (chest, barrel, …). |
| `building` | two corners | The whole start building from the floor up to above the roof. Leaving it is blocked until the portal step. The exit should lead out of it, and the portal must lie outside. |
| `buildingReturn` | position | Where a player who left too early is put back (feet), inside the building. |
| `portal` | two corners | The portal area in front of the entrance (outside the building). Entering it teleports the player. |
| `islandGate` | position | Where the portal sends the player (feet): in front of the gate of the campus island. |
| `islandFacing` | position | The point the player looks at after the teleport, e.g. the gate. |
| `cameraPath` | list of shots | See below. |

A position is `{ x, y, z }`; "two corners" is `{ from: { x, y, z }, to: { x, y, z } }`. The corners can be given in any order, and both corner blocks belong to the box. Decimal numbers are rounded down to the block, except where the position is a standing place (`wake`, `buildingReturn`, `islandGate`): there `10.5` puts the player in the middle of a block.

### Camera path

```js
cameraPath: [
    { location: { x: 14, y: 65.6, z: 19.4 }, facing: { x: 14, y: 65.6, z: 5 }, seconds: 0 },
    { location: { x: 14, y: 70, z: 0 }, facing: { x: 10, y: 66, z: 20 }, seconds: 3, sound: "mob.phantom.swoop" },
]
```

| Field | Meaning |
| --- | --- |
| `location` | Where the camera is at the end of the shot. |
| `facing` | The point the camera looks at, also while it flies. |
| `seconds` | How long the flight to `location` takes. `0` jumps there. The first shot must be `0`; it is where the ride starts (usually the eyes of the player at the window, looking out). |
| `ease` | Optional. Easing of the flight (an `EasingType` name), default `"InOutSine"`. |
| `sound` | Optional. Sound id that plays when the shot starts, e.g. a whoosh. |

The suggestion of the ticket: once around the building, sideways through a window, along the corridor, down the stairs, out of the main entrance, then a turn that shows the university once more. The test setup flies a simple version of that around its small building. Without `cameraPath` the ride has no shots: only the title is shown.

## Customization

At the top of `awakening-quest.js`:

| Constant | Meaning |
| --- | --- |
| `LAYOUT` | The places of the quest, see above. |
| `AUTO_START` | `true`: a player without progress who joins the world starts the quest automatically (needs a layout). |
| `ALARM_SOUND` | Sound of the alarm clock. `note.pling` is one of the note block sounds. |
| `INTRO_MUSIC`, `INTRO_MUSIC_VOLUME` | Music of the camera ride. **Placeholder:** the vanilla music disc `record.otherside`. Empty string for no music. Custom music needs a sound definition in the resource pack. |
| `BACKPACK_ITEM`, `CHEST_LOOT` | What the chest hands out. **Placeholder:** `minecraft:bundle` as the backpack, 3 bread, 2 apples. If the inventory is full, the rest drops at the player's feet. |
| `PROFESSOR_TAG` | The tag that marks the professor NPC. |
| `TEXTS` | All texts, including the university name of the title (`universityName`, `universitySubtitle`; **placeholder**) and the professor's dialog. Chat texts must not contain color codes. |
| `startExploreCampusQuest(player)` | Empty hook, called when the player arrives on the island. The side quest "Gelände erkunden" is created separately and starts here. |
| `onQuestFinished(player)` | Empty hook, called when the quest is done. For whatever follows, e.g. "Operation Erstsemester" (#79). |

## Testing

Test environment: **flat world, adventure mode** (like the map), **cheats on**, DHSN behavior and resource pack active. Turn on the content log (Settings → Creator) to see script errors.

1. Stand on a free, flat spot and run `/scriptevent dhsn:quest_test_awakening`. Everything is built east of you (a building, a plaza with the portal, a second plaza as the island with a gate and the professor) and you are put into the building next to the bed. The quest has started: the alarm clock rings, the questlog shows the first objectives.
2. **Alarm:** right-click the note block (east of the bed): the ringing stops, the questlog line turns green. Note that it must not change its pitch.
3. **Too early:** walk out of the door in the east wall: you are put back into the room with a hint. Also try the chest: "Die Truhe läuft nicht weg."
4. **Camera ride:** walk to the window in the north wall (the glass panes). The ride starts: music, you cannot move, the camera flies around the building, through the window, out of the door and back for a last look. At the end the title `Duale Hochschule Sachsen` appears, the screen fades, you stand at the window again.
5. **Chest:** right-click the chest in the corner of the room (southeast). It does not open, the chat tells what you found and the inventory has a bundle, bread and apples. Right-click it again: "Die Truhe ist leer."
6. **Portal:** leave through the door and step onto the purple pad (enchanting table in the middle). The screen fades out, you arrive at the island gate and the chat shows `Neue Nebenquest: Gelände erkunden`.
7. **Professor:** talk to the NPC in front of the gate: the dialog opens (not the NPC screen). After closing it, the questlog entry is gone and the chat shows `Quest abgeschlossen: Das Erwachen (<name>)`.

Counter-checks:

- **Skip ahead:** `/scriptevent dhsn:quest_awakening_step portal` jumps to a step (without teleporting you) to test the end without everything before it.
- **Replay the ride only:** `/scriptevent dhsn:quest_awakening_ride` does not touch the progress.
- **Rejoin during the ride:** save and quit during the ride, open the world again: you can move and see normally again, the questlog still asks to look out of the window.
- **Rejoin with the alarm on:** save and quit before switching it off: after joining the alarm rings again.
- **Reload:** `/reload` at any step keeps the progress; the window, the building and the portal still react.
- **Restart:** run `/scriptevent dhsn:quest_test_awakening` again: the area is cleared, everything is rebuilt at your position and the quest starts from scratch.
- **Yellow chat:** every chat line of the quest and the test is yellow.

Resetting: `/scriptevent dhsn:quest_reset_awakening` throws away your progress (alarm, ride, questlog entry); it does **not** remove the test building. `/scriptevent dhsn:quest_test_awakening_clear` removes the saved test layout; the blocks stay in the world.

## Commands

All need cheats to be enabled.

| Command | Effect |
| --- | --- |
| `/scriptevent dhsn:quest_test_awakening` | **Test setup:** builds the scene east of you, saves its layout and starts the quest at the bed. See [Testing](#testing). |
| `/scriptevent dhsn:quest_test_awakening_clear` | Removes the layout saved by the test setup. Afterwards `LAYOUT` from the code applies again. The blocks stay. |
| `/scriptevent dhsn:quest_awakening_start` | Starts the quest from the beginning and puts you to the `wake` position of the current layout. |
| `/scriptevent dhsn:quest_reset_awakening` | Resets **your own** progress: alarm off, a running ride cancelled, questlog entry removed. |
| `/scriptevent dhsn:quest_awakening_state` | Writes your step, the state of the alarm and the layout to the chat. |
| `/scriptevent dhsn:quest_awakening_step <wake\|chest\|portal\|professor\|done>` | Jumps to a step. |
| `/scriptevent dhsn:quest_awakening_ride` | Plays the camera ride without changing the progress. |

## Known limitations

- **Tested in game:** the whole quest was played through in the game (test setup, flat world) and works. Not covered by that test: the real map, because the layout there is still missing.
- **Placeholders:** texts, the music (a vanilla disc), the backpack (a bundle), the professor (an existing NPC entity in the test) and the university name in the title.
- **Map not ready:** without `LAYOUT` the quest works only in a world where the test setup ran.
- **Shared questlog:** the same entries for all players, each with the player's name when several are online (see #105).
- **Professor editing:** an entity with the tag opens the quest dialog instead of the NPC editor, also in creative mode.
- **One alarm for the player only:** the alarm is audible only to the player it rings for; other players do not hear it.
- **Early exit is a safety net:** the building guard teleports the player back after they left it; it does not stop flying players or players in other dimensions.

## Technical overview

| Part | Where | How |
| --- | --- | --- |
| Window, building, portal | `onEnterTerritory` from [events](../Events.md) | Three areas from the layout. The building uses `onLeave`. |
| Alarm clock, chest | `onBlockInteract` from [events](../Events.md) (see [block-interact.md](../events/block-interact.md)) | Position only; `cancel: true` keeps the note block from changing its pitch and the chest from opening. |
| Professor | `world.beforeEvents.playerInteractWithEntity` | Cancels the NPC screen if the entity has `PROFESSOR_TAG`; opens the dialog on the next tick. |
| Dialog | `@minecraft/server-ui` (`ActionFormData`) | Retries while the player still has another screen open (`UserBusy`), like the library quest. |
| Camera ride | `player.camera.setCamera("minecraft:free", …)` | One call per shot with `easeOptions`; the first shot jumps. See also `camera_poc.js`. Shots are scheduled with `system.runTimeout`; the ids are kept per player so the ride can be cancelled. |
| Movement, HUD | `inputpermission set @s movement disabled`, `hud @s hide all` | Reset at the end, on cancel and on the next join. |
| Title | `onScreenDisplay.setTitle` | At the end of the ride. |
| Fades | `player.camera.fade` | Waking up, end of the ride, portal. |
| Layout | `getLayout()`; `setAwakeningTestLayout(layout)` | The saved test layout (`dhsn:awakening_test_layout`) takes precedence over `LAYOUT`. The listeners are registered again whenever the layout changes. |
| Questlog | `behavior_pack/scripts/questlog.js` | One entry per player, `order: 1`. |
| Progress | World dynamic property `dhsn:quest_awakening:<player id>` | JSON, see [Progress storage](#progress-storage). |
