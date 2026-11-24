# Library Quest "Aushilfe in der Bibliothek"

Source: [behavior_pack/scripts/quests/library-quest.js](../../behavior_pack/scripts/quests/library-quest.js) · Building blocks: [Quest events](../Events.md) (German)

The librarian asks the player to sort books into the bookshelves of their study programs. The quest is played in **rounds**: after the first stack of books, she hands out a second one. After the last round the quest is finished, and the librarian offers a repeatable **challenge** against the clock; the 3 best times are shown on a sign in the library.

All dialog texts are **placeholders** in German until the story team delivers the real dialog. All chat output is **yellow**.

## Contents

- [Features](#features)
- [Customization](#customization)
- [Setting up the finished map (command blocks)](#setting-up-the-finished-map-command-blocks)
- [Testing](#testing)
  - [Resetting the test](#resetting-the-test)
- [Known limitations](#known-limitations)
- [Technical overview](#technical-overview)

## Features

### Flow

```text
talk to librarian ──► offer round 1 ──accept──► round 1 active ──sort all books──► talk to librarian
        ▲                 │                          │                                   │
        │              decline             leave the library > 5 s                finish round 1
        │                 ▼                          ▼                                   ▼
        └──────── round stays offered ◄──────── round reset         offer round 2 ──accept──► round 2 active ──► …
                                                                                                    │
                                                         after the last round: reward, quest done, offer challenge
                                                                                                    │
                                                    challenge ──sort all books──► time, highscore sign ──► offer again
```

1. **Offer.** Right-clicking the librarian (`dhsn:librarian`) opens a dialog that offers the first round. If the player accepts, `playIntro(player)` is called (hook for the camera ride, empty for now), the player receives the round's books and a questlog entry appears.
2. **Books.** For every study program, the round hands out a **random number of books between 1 and the number of that program's bookshelves in the library**. The numbers are rolled when the round is accepted and stored, so they stay the same after rejoining.
3. **Sorting.** Every book has to go into a bookshelf of its study program inside the library, and **every shelf takes only one book per round**. Books cannot be taken out of the shelves again. Each book sorted writes `Buch einsortiert: Informatik (1/9)` to the chat and updates the questlog.
4. **Hand in.** Once all books of the round are sorted, the questlog line turns green and "Zurück zur Bibliothekarin" appears. Talking to the librarian shows the round's finish dialog. She then takes the round's books out of the shelves again ("tidies up"), so the shelves are free for the next round.
5. **Next round.** Right after finishing a round, the librarian offers the next one in the same conversation. Accepting hands out newly rolled books.
6. **Quest finished.** After the last round, the librarian gives the reward (placeholder: 3 emeralds) and **5 ECTS** (placeholder, see [ECTS](../Ects.md), German), the quest is done, the questlog entry disappears, and the chat shows `Quest abgeschlossen: Aushilfe in der Bibliothek (<name>)` to everyone.
7. **Challenge.** Right after the reward, the librarian offers the challenge ("Da du ja jetzt schon so geübt bist …"). See [Challenge](#challenge).

### Leaving the library

While a round or the challenge is running, the player has to stay inside the library (`LIBRARY_AREA`):

1. Leaving it shows a big text in the middle of the screen, `Halt!` with the short subtitle `Zurück in die Bibliothek! 5 s`, counting down every second. The librarian's sentence "Hey, wo gehst du mit meinen Büchern hin?" appears in the chat only, because a long subtitle does not fit on the screen.
2. Coming back within the 5 seconds removes the text ("Na also, da bist du ja wieder."); the round goes on. The challenge clock keeps running.
3. Staying outside resets the run: the round's books are taken out of the inventory and out of the shelves, the questlog entry disappears, and the round is offered again (with newly rolled books). A running challenge is cancelled without a time; the quest stays done.
4. Leaving the world while outside the library (e.g. during the countdown) resets the round on the next join, without grace period: `Deine Runde wurde zurückgesetzt.` Leaving the world inside the library keeps the round.

Without a library area (`LIBRARY_AREA` undefined and no test setup), leaving is not checked.

### Challenge

- **Offer:** after the quest reward, and every time the player talks to the librarian after the quest. Buttons "Challenge starten" and "Vielleicht später".
- **Books:** fixed, so times are comparable: one book per shelf of each program, but at most `CHALLENGE_MAX_PER_PROGRAM` (3) per program. With the same library, everyone gets the same books. (Normal rounds are random and have no such limit, on purpose.)
- **Clock:** starts when the books are handed out and stops when the **last book is sorted**; the player does not have to go back to the librarian. The questlog shows `Zeit: 0:42,3` while it runs.
- **Result:** `Bibliothekarin: Geschafft in 0:42,3!`, and `Neuer Rekord! Platz 2 auf der Bestenliste.` if the time made it onto the sign. The shelves are tidied up right away.
- **Talking to her during the challenge** shows the time so far and hands out lost books again.

### Highscore sign

One sign in the library shows the **3 best attempts**, no matter by whom (the game is single player, so usually all three are yours):

```text
Bestzeiten
1. Kai 0:42,3
2. Kai 0:55,0
3. -
```

- A new time gets onto the sign while there are fewer than 3 entries, or if it is better than place 3; place 3 then drops out. With equal times, the older entry stays in front.
- Names are cut to 8 characters, because signs are narrow.
- The sign is waxed; its text is written by the script when the world loads and after every new entry.
- Stored as the world dynamic property `dhsn:library_highscores` (JSON list `[{ name, timeMs }]`).

### Bookshelves during a round

| Situation | What happens |
| --- | --- |
| Book into the shelf of another program | Refused, the book stays in the hand. The librarian: "Halt! Das ist das Regal für Controlling. Das Buch für Informatik gehört woanders hin." |
| Book into a shelf that already got a book this round | Refused. The librarian: "In dieses Regal hast du schon ein Buch gestellt. Nimm ein anderes Informatik-Regal." |
| More books of a program than handed out (e.g. extra copies) | Refused. The librarian: "Du hast schon alle Informatik-Bücher einsortiert." |
| Right-click with an empty hand | Nothing comes out: "In diesem Regal steht 1 Buch. Herausnehmen geht nicht." |
| Book into a shelf outside the library | Not counted, no restriction. The book is gone from the hand; the librarian hands it out again when asked. |

Outside a round, the shelves behave as described in [Own bookshelves](../events/item-in-shelf.md#eigene-bücherregale) (German).

### Other behavior

| Situation | What happens |
| --- | --- |
| Player declines an offer | The librarian answers "Kein Problem, komm einfach wieder …". The round stays offered; the next talk offers it again. |
| Player talks to her during a round | She tells the progress ("Du hast schon 2 von 9 Büchern einsortiert …"). |
| Player lost books (dropped, put in a chest) | When talking to her during a round or challenge, she hands out again every missing book: handed out − sorted − in the inventory, per program. At that moment, **all books of the quest lying on the ground** (dropped item entities in the player's dimension, loaded area) **disappear**, so they cannot be picked up as extra copies. If nothing is missing, nothing is removed. |
| Player rejoins the world | Progress is kept; the questlog entry is shown again (unless the round is reset because the player is outside, see above). |

### Questlog

While a round is active, the questlog (top right) shows:

```text
Aushilfe in der Bibliothek
 - Runde 1/2
 - Bücher sortiert: 3/9
```

When all books of the round are sorted, the progress line turns green and a line `Zurück zur Bibliothekarin` is added. During the challenge:

```text
Bibliotheks-Challenge
 - Bücher sortiert: 7/15
 - Zeit: 0:31,4
```

After the quest there is no entry. Between rounds there is only an entry while the player is **outside** the library and round 2 (or a later round) waits for them, e.g. after declining it or after a reset:

```text
Aushilfe in der Bibliothek
 - Sprich mit der Bibliothekarin, sie scheint noch Bücher für dich zu haben.
```

It disappears as soon as the player is back inside the library or accepts the round. With more than one player online, the title gets the player's name, because the questlog is shared by all players.

### Progress storage

The progress is stored **in the world (the map)**, **once per world**, as the world dynamic property `dhsn:quest_library`: the game is single player, so there is no player id in the key. It survives `/reload`, restarting the world and leaving/rejoining, and it stays with the map file.

Older versions stored it per player: first on the player itself (player dynamic property `dhsn:quest_library`), later in the world as `dhsn:quest_library:<player id>`. Both are moved to `dhsn:quest_library` automatically the first time the progress is read. Overview of everything saved and the cleanup before handing out the map: [Speicherung](../Speicherung.md) (German).

Stored value (JSON):

| Field | Meaning |
| --- | --- |
| `round` | Index into `ROUNDS` (0 = first round). |
| `status` | `"offered"`: round offered but not accepted yet; `"active"`: round in progress; `"done"`: quest finished. |
| `books` | Only while a round is active: book id → number of books handed out. |
| `sorted` | Books sorted in the current round: `[{ book, shelf: { x, y, z } }]`. The shelf position is used for "one book per shelf" and for tidying up. |
| `challenge` | Only while a challenge is running: `{ startedAt, books, sorted }`. |

No value means the quest was never started. Progress saved by earlier versions is converted when read: without `round` it is round 1; `sorted` as plain item ids becomes entries without shelf (those books are not taken out of the shelves); an active round without `books` gets one book per program.

### Commands

| Command | Effect |
| --- | --- |
| `/scriptevent dhsn:quest_reset_library` | Resets **your own** quest progress. A running round or challenge is ended first: its books are taken out of your inventory and out of the shelves. |
| `/scriptevent dhsn:quest_library_state` | Writes your progress to the chat: round, status, books per program (sorted/handed out), the shelf of every sorted book, the library area. |
| `/scriptevent dhsn:library_highscores_add <name> <seconds>` | Adds a fake time to the highscore list, e.g. `Kai 42,5`. For testing the sign without playing many challenges. |
| `/scriptevent dhsn:library_highscores_reset` | Empties the highscore list. |
| `/scriptevent dhsn:quest_test_library` | Test setup: builds a small library, see [Testing](#testing). Starts nothing by itself. |
| `/scriptevent dhsn:quest_test_library_clear` | Removes the library area and sign saved by the test setup. |
| `/scriptevent dhsn:library_set <variable> <coordinates>` | Sets the library area or the highscore sign of the finished map (command block). |
| `/scriptevent dhsn:library_layout` | Lists the positions set for the map. |
| `/scriptevent dhsn:library_layout_clear` | Deletes the positions set for the map. |

All need cheats to be enabled.

## Customization

Everything that is meant to be changed is at the top of `library-quest.js`, in the `CONFIGURATION` section.

### Library area – `LIBRARY_AREA`

Only bookshelves inside this area count for the quest, their number per program decides how many books a round hands out, and leaving it during a round starts the countdown.

```js
const LIBRARY_AREA = { from: { x: 100, y: 64, z: 40 }, to: { x: 120, y: 70, z: 60 }, dimension: "minecraft:overworld" };
```

- Two corner blocks, in any order; both corners belong to the area. `dimension` is optional (default overworld).
- Include some height above the floor, so jumping or standing on a shelf does not count as leaving.
- The room should have one exit and no shelves directly at its border, so leaving is detected clearly.
- `undefined` (current value): every own bookshelf in the world counts, every program counts as having **one** shelf (so one book per program), and leaving is not checked. The corners come from the build team.
- Usually not needed: in the finished map the area is set with a command block (see [Setting up the finished map](#setting-up-the-finished-map-command-blocks)).
- An area saved by the test setup (`dhsn:library_test_area`) takes precedence over the command block value, which takes precedence over this constant. Remove a test area with `/scriptevent dhsn:quest_test_library_clear`.

### Highscore sign – `HIGHSCORE_SIGN`

Position `{ x, y, z }` of a sign block in the library, placed by the build team. `undefined` (current value): no sign. Usually set with a command block instead (`/scriptevent dhsn:library_set highscore_sign …`). A sign saved by the test setup (`dhsn:library_test_sign`) takes precedence, then the command block value, then this constant. `HIGHSCORE_SIZE` (3) is the number of places.

### Study programs – `PROGRAMS`

One entry per study program: its book, the name used in texts, and its bookshelf block.

```js
{ book: "myname:cs_book", name: "Informatik", shelf: "myname:computer_science_bookshelf" },
```

`ALL_BOOKS` is derived from it. A new program needs a book, a bookshelf that accepts it (see [Books and bookshelves](#books-and-bookshelves)) and an entry here.

### Rounds – `ROUNDS`

Each entry is one round, played in the order of the list. To add a third round, add a third entry; to have only one round, remove the second one. The questlog ("Runde 1/2") and the end of the quest adapt automatically. The books of a round are not configured here; they are rolled from the shelves in the library.

```js
{
    offer: {
        body: "Text of the offer dialog",
        accept: "Accept button",
        decline: "Decline button",
    },
    started: "Chat line after accepting",
    finish: {
        body: "Text of the dialog when handing in the round",
        button: "Button text",
    },
    reward: (player) => {
        player.sendMessage("Optional reward for this round");
    },
},
```

| Field | Required | Meaning |
| --- | --- | --- |
| `offer.body`, `offer.accept`, `offer.decline` | yes | Dialog that offers the round: text and the two buttons. |
| `started` | yes | Line the librarian says in the chat after the round was accepted. |
| `finish.body`, `finish.button` | yes | Dialog when the round is handed in. |
| `reward` | no | Function called after the round was handed in, e.g. to give items or experience. |

### Timing and challenge

| Constant | Value | Meaning |
| --- | --- | --- |
| `LEAVE_GRACE_SECONDS` | `5` | Seconds outside the library before a round is reset. |
| `CHALLENGE_MAX_PER_PROGRAM` | `3` | Books per program in the challenge: one per shelf, at most this many. |
| `HIGHSCORE_SIZE` | `3` | Places on the highscore sign. |

### Common texts – `TEXTS`

Texts used in every round. All chat output is made yellow by the script, so texts should not contain color codes (the green progress line in the questlog is the only exception).

| Key | Used for |
| --- | --- |
| `questTitle` | Questlog title and completion message |
| `librarianName` | Dialog title and name in chat lines |
| `declined` | Chat line after declining an offer |
| `reminder(sorted, total)` | Dialog text when talking to her during a round |
| `booksReturned` | Added to the reminder when lost books were handed out again |
| `allSorted` | Chat line when all books of a round are sorted |
| `close` | Button to close the reminder dialogs |
| `bookSorted(name, sorted, total)` | Chat line for every sorted book |
| `round(number, total)` | Questlog line with the round number |
| `objective`, `returnObjective`, `time` | Questlog lines for progress, "go back" and the challenge time |
| `questFinished(player)` | Chat message to everyone when the quest is finished |
| `reward(amount)` | Line the librarian says when handing out the quest reward. It names the item ("Smaragde"), so change it together with `QUEST_REWARD`. |
| `ectsReward(ects)` | Line the librarian says about the ECTS of the quest (`QUEST_ECTS`). |
| `reset` | Chat line after `/scriptevent dhsn:quest_reset_library` |
| `wrongShelf(shelfName, bookName)`, `shelfUsed(bookName)`, `programDone(bookName)` | What the librarian says when a shelf refuses a book during a round |
| `leaveTitle`, `leaveWarning`, `leaveCountdown(seconds)`, `leaveBack`, `leaveReset`, `rejoinReset` | Leaving the library. `leaveCountdown` is the subtitle in the middle of the screen; keep it short, longer texts run off the screen. |
| `pendingRound` | Questlog hint outside the library when the next round waits |
| `challengeTitle`, `challengeOffer`, `challengeAccept`, `challengeDecline`, `challengeStarted`, `challengeRunning(time)`, `challengeTime(time)`, `challengeRecord(rank)` | Challenge dialogs, questlog title and chat lines |
| `signTitle` | First line of the highscore sign |

### Rewards

- **Per round:** the optional `reward` function of each round.
- **For the whole quest:** `QUEST_REWARD`, handed out once after the last round by `giveQuestReward(player)`. **Placeholder:** 3 emeralds.
- **ECTS:** `QUEST_ECTS` (**placeholder: 5**), given in addition in `giveQuestReward(player)` with `addEcts` from `behavior_pack/scripts/ects.js`. `addEcts` respects the limit of 180 ECTS, writes `+5 ECTS (jetzt …/180)` to the chat and updates the level and the label above the XP bar. The story team decides the real value; all quests together should give 180 (budget table in [docs/Ects.md](../Ects.md), German).

```js
const QUEST_REWARD = { item: "minecraft:emerald", amount: 3 };
```

| Field | Meaning |
| --- | --- |
| `item` | Item id of the reward, e.g. a custom item like `dhsn:certificate` or a vanilla item. |
| `amount` | How many. Must not exceed the item's maximum stack size (our own books and items stack only to 1). |

The librarian announces the reward with `TEXTS.reward(amount)`; adjust that text when changing the item. If the inventory is full, the reward drops at the player's feet. For a reward that is more than one item, extend `giveQuestReward(player)`. The challenge has no reward and **no ECTS**, only the highscore. Resetting the quest with `/scriptevent dhsn:quest_reset_library` and finishing it again gives the ECTS again (for testing); the limit of 180 still applies.

### Camera ride – `playIntro(player)`

Empty function, called once when the first round is accepted, before the books are handed out. The camera ride (planned by the story team) goes there; `behavior_pack/scripts/camera_poc.js` shows how a camera ride works.

### Requirement to start – `canStartQuest(player)`

Called before the first round is offered. It returns `true` at the moment. This is where the check for the student ID card from "Operation Erstsemester" (#79) goes, for example:

```js
function canStartQuest(player) {
    return countInInventory(player, "dhsn:student_id") > 0; // item id is a placeholder
}
```

If it returns `false`, talking to the librarian does nothing yet; a dialog that sends the player to the student office can be added there.

### Librarian – `LIBRARIAN`

The entity type that starts the quest, `dhsn:librarian`. Every entity of this type in the world opens the quest dialog.

### Books and bookshelves

The bookshelves are configured in their block JSONs (`behavior_pack/blocks/*_bookshelf.block.json`), not in the quest:

```json
"dhsn:bookshelf": {
    "capacity": 6,
    "accepts": ["myname:cs_book"],
    "allow_take_out": false
}
```

- `accepts`: the books the shelf takes. Each shelf only takes the book of its study program.
- `allow_take_out`: `false`, books cannot be taken out again.
- `capacity`: how many books fit in. Because the librarian tidies the shelves up after every round, the quest itself never fills them.

The quest takes part in the shelves' decisions through `setShelfInsertCheck` (one book per shelf and round) and `onShelfRejected` (her answers). Full description: [Own bookshelves](../events/item-in-shelf.md#eigene-bücherregale) (German).

### Command and property names

`RESET_COMMAND`, `STATE_COMMAND`, `HIGHSCORES_RESET_COMMAND`, `HIGHSCORES_ADD_COMMAND` and `TEST_CLEAR_COMMAND` are the script event ids of the commands. `STATE_PROPERTY` (`dhsn:quest_library`) is the world property of the stored progress; changing it makes the quest start from scratch. `MAP_LAYOUT_PROPERTY` (`dhsn:library_map_layout`) holds the positions set with `dhsn:library_set`. `HIGHSCORE_PROPERTY`, `TEST_AREA_PROPERTY` and `TEST_SIGN_PROPERTY` are the world properties of the highscores and the test setup.

## Setting up the finished map (command blocks)

In the finished map, the library area and the highscore sign do not have to be written into the code. They are set **once with command blocks** and saved in the world (`dhsn:library_map_layout`):

```text
/scriptevent dhsn:library_set <variable> <coordinates>
```

| Variable | Numbers | Position |
| --- | --- | --- |
| `library_area` | x y z x y z | two opposite corners of the library room |
| `highscore_sign` | x y z | the sign that shows the best times of the challenge (a sign block placed by the builders) |

- **Coordinates** are absolute numbers or relative to the command block with `~` (`~`, `~3`, `~-2`), like in normal Minecraft commands. Minecraft does not resolve `~` inside script event messages; the script does, starting from the command block.
- **The dimension** is the one of the command block.
- **Feedback:** the chat says which variable was set and what is still missing, or what was wrong with the input.
- **Each variable works on its own:** with only `library_area` the quest already uses the library (shelves counted there, leaving resets the round); without `highscore_sign` there is just no sign.
- **Check:** `/scriptevent dhsn:library_layout` lists the values, `/scriptevent dhsn:library_layout_clear` deletes them.
- **Order of precedence:** test setup (if saved) → command block values → `LIBRARY_AREA` / `HIGHSCORE_SIGN` in the code. If a test area is still saved in the map, remove it with `/scriptevent dhsn:quest_test_library_clear`.
- Use **impulse command blocks** (run once), not repeating ones.
- **Area:** include some height above the floor, so jumping or standing on a shelf does not count as leaving; the room should have one exit and no shelves directly at its border.

Example, command block standing in a corner of the library on floor level:

```text
/scriptevent dhsn:library_set library_area ~1 ~-1 ~1 ~20 ~4 ~15
/scriptevent dhsn:library_set highscore_sign ~3 ~ ~2
```

## Testing

Test environment: **flat world, adventure mode** (like the map), **cheats on**, DHSN behavior and resource pack active. Turn on the content log (Settings → Creator) to see script errors.

1. Stand on a free spot and run `/scriptevent dhsn:quest_test_library`. It builds a small library (see [test-library.md](../events/test-library.md), German): an oak plank floor (the library area), five rows of shelves (Informatik 4, the others 3, a sign at the end of each row), the librarian and the highscore sign.
2. **Adventure mode first:** put any book into its shelf before starting the quest. If the shelf does not react, stop here: the quest cannot work in the map.
3. Right-click the librarian and accept. You get 1–4 Informatik books and 1–3 of every other program; `/scriptevent dhsn:quest_library_state` shows the numbers. The questlog shows `Runde 1/2` and `Bücher sortiert: 0/<total>`.
4. Put a book into the shelf of another program: refused, the librarian names the shelf. Put two books of the same program into the same shelf: the second is refused.
5. Right-click a shelf with an empty hand: nothing comes out.
   Drop two books (`Q`) and talk to her: she hands them out again, and the two books on the ground disappear.
6. Walk off the plank floor and come back within 2 seconds: the countdown appears and disappears, the round goes on.
7. Walk off and stay outside: after 5 seconds the books are gone from the inventory, the questlog entry disappears. Talk to the librarian: round 1 is offered again, with newly rolled books.
8. Sort all books. The chat shows `Buch einsortiert: … (n/<total>)` (only this line, the shelf itself writes nothing), at the end "Alle Bücher sind einsortiert …".
9. Talk to her: the finish dialog of round 1 appears, followed by the offer for round 2. Decline it and walk off the floor: the questlog shows "Sprich mit der Bibliothekarin …"; walk back: the entry disappears. `/scriptevent dhsn:quest_library_state` shows no sorted books any more (shelves tidied up).
10. Accept round 2, sort the books and hand them in: she gives 3 emeralds and 5 ECTS (level +5, chat `+5 ECTS (jetzt …/180)`), the chat shows `Quest abgeschlossen: …`, then she offers the challenge. Finishing the challenge later changes no ECTS.
11. Start the challenge: 3 Informatik books (4 shelves, limited to 3) and 3 of every other program. The questlog shows the running time. Sort all books: the time appears in the chat, and the sign shows it.
12. Play the challenge two more times: every time gets onto the sign while there are fewer than 3. A fourth, slower attempt does not change the sign; a faster one pushes place 3 out.
13. Start a challenge and walk off the floor for 5 seconds: the challenge is cancelled, no time.

Counter-checks:

- **Rejoin inside:** during a round, save and quit while standing on the floor, open the world again: the round goes on.
- **Rejoin outside:** during a round, walk off the floor and save and quit during the countdown, open the world again: the round is reset, `Deine Runde wurde zurückgesetzt.`
- **Reload:** `/reload` during a round: progress, questlog entry and library area are kept (walking off still shows the warning). After `/reload` or reopening the world the sign still shows the list.
- **Randomness:** reset the round five times (walk off, wait, accept again): the numbers change, always between 1 and the number of shelves; Informatik sometimes gets 4.
- **Pause:** pausing the game during the challenge (Esc) counts towards the time. Known limitation, just check and note.
- **Old progress:** with the previous version, accept a round and sort 2 books, close the world; install this version and open it: no errors in the content log, the round goes on.
- **Highscore sorting:** `/scriptevent dhsn:library_highscores_add Test 10` and other times: the sign sorts them and keeps the best 3.
- **Regression:** `/scriptevent dhsn:event_test` still works with all 6 events (see [test.md](../events/test.md), German).
- **Yellow chat:** every chat line of quest, shelves and test is yellow.

### Resetting the test

| Command | Resets | Does not reset |
| --- | --- | --- |
| `/scriptevent dhsn:quest_reset_library` | Your own quest progress; the books of a running round or challenge (inventory and shelves). | Highscores, library, librarian |
| `/scriptevent dhsn:library_highscores_reset` | The highscore list and sign. | Quest progress |
| `/scriptevent dhsn:quest_test_library` | The library: clears the area above the floor, lays the floor, rebuilds shelves, signs, librarian and highscore sign at your position, empties the shelf counters, saves the area. | **Your quest progress** and the highscores |
| `/scriptevent dhsn:quest_test_library_clear` | The saved test area and sign; afterwards `LIBRARY_AREA` and `HIGHSCORE_SIGN` from the code apply. | The blocks in the world |

Complete restart, in this order:

```text
/clear
/scriptevent dhsn:quest_reset_library
/scriptevent dhsn:library_highscores_reset
/scriptevent dhsn:quest_test_library
```

`/clear` removes books and emeralds from the inventory. It is optional but keeps the test clear.

If you moved between two runs, the old floor and shelves stay where they were. They no longer count, because the saved area points to the new setup. Build at the same spot or use a new world to keep things clean.

## Known limitations

- **Not tested in game yet:** the whole rework (random books, one book per shelf, leaving the library, challenge, highscore sign, yellow chat, the test setup). In particular, whether the own bookshelves react to clicks in **adventure mode** is unconfirmed.
- **Pause counts:** the challenge clock uses real time (`Date.now()`), so pausing the game counts towards the time.
- **Shared questlog:** the questlog shows the same entries to every player. With several players online, each entry carries the player's name in its title. A questlog per player would be a change in `questlog.js` (#105).
- **Librarian editing:** right-clicking any librarian opens the quest dialog instead of the NPC editor, also in creative mode. She can only be edited with commands.
- **Map not ready:** without `LIBRARY_AREA` and `HIGHSCORE_SIGN` (coordinates from the build team), the quest only works fully with the test setup.
- **Placeholders:** all dialog texts and the reward (3 emeralds) are placeholders until the story team decides on the real ones.

## Technical overview

| Part | Where | How |
| --- | --- | --- |
| Talking to the librarian | `world.beforeEvents.playerInteractWithEntity` | Cancels the default NPC screen and opens the quest dialog on the next tick. |
| Dialogs | `@minecraft/server-ui` 2.2.0 (`ActionFormData`) | Retries while the player still has another screen open (`UserBusy`). |
| Counting shelves | `Dimension.getBlocks` with `includeTypes: DHSN_SHELF_TYPES` | Counts the shelves per program inside the library when a round or challenge starts. |
| Detecting sorted books | `onItemInShelf` from [events](../Events.md) | Filtered to the run's books and the library area; stores the shelf position. |
| One book per shelf, her answers | `setShelfInsertCheck`, `onShelfRejected` from `custom_bookshelf.js` | The check refuses used shelves; the listener lets the librarian explain. |
| Tidying up | `changeShelfContents(player, block, …, -1)` | Takes the sorted books of a round out of the shelf counters again. |
| Leaving the library | `system.runInterval` every 5 ticks | Checks players with a running round; title and `updateSubtitle` for the countdown, `title @s clear` to remove it. Also updates the challenge clock once per second. |
| Rejoining outside | `world.afterEvents.playerSpawn` (`initialSpawn`) | Resets the round without grace period. |
| Highscore sign | `BlockSignComponent.setText`, `setWaxed` | Rewritten on `world.afterEvents.worldLoad` and after every new entry. |
| Test setup | `setLibraryTestSetup(area, sign)` | Saves area and sign as world dynamic properties. |
| Questlog | `behavior_pack/scripts/questlog.js` | One entry per player, `order: 2`. |
| Progress | World dynamic property `dhsn:quest_library` (once per world) | JSON, see [Progress storage](#progress-storage). Older per-player progress is moved over when read (`takeOverPerPlayerValue` in `util/storage.js`). |
| Map positions | World dynamic property `dhsn:library_map_layout` | Set with `/scriptevent dhsn:library_set`; coordinates parsed by `util/command-coordinates.js`. |
