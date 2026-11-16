# Library Quest "Aushilfe in der Bibliothek"

Source: [behavior_pack/scripts/quests/library-quest.js](../../behavior_pack/scripts/quests/library-quest.js) · Building blocks: [Quest events](../Events.md) (German)

The librarian asks the player to sort books into the bookshelves of their study programs. The quest is played in **rounds**: after the first stack of books, she hands out a second one. After the last round the quest is finished.

All dialog texts are **placeholders** in German until the story team delivers the real dialog.

## Contents

- [Features](#features)
- [Customization](#customization)
- [Testing](#testing)
  - [Resetting the test](#resetting-the-test)
- [Known limitations](#known-limitations)
- [Technical overview](#technical-overview)

## Features

### Flow

```text
talk to librarian ──► offer round 1 ──accept──► round 1 active ──sort all books──► talk to librarian
        ▲                 │                                                              │
        │              decline                                                    finish round 1
        │                 ▼                                                              ▼
        └──────── round stays offered ◄──decline── offer round 2 ──accept──► round 2 active ──► …
                                                                                          │
                                                                    after the last round: quest done
```

1. **Offer.** Right-clicking the librarian (`dhsn:librarian`) opens a dialog that offers the first round. If the player accepts, they receive the round's books and a questlog entry appears.
2. **Sorting.** Every book has to go into the bookshelf of its study program. The shelves only accept their own book, so a book cannot end up in the wrong shelf (see [Own bookshelves](../events/item-in-shelf.md#eigene-bücherregale), German). Each book sorted writes `Buch einsortiert: Informatik (1/5)` to the chat and updates the questlog.
3. **Hand in.** Once all books of the round are sorted, the questlog line turns green and "Zurück zur Bibliothekarin" appears. Talking to the librarian shows the round's finish dialog.
4. **Next round.** Right after finishing a round, the librarian offers the next one in the same conversation. Accepting hands out the new books and the next round starts.
5. **Quest finished.** After the last round, the librarian gives the reward (placeholder: 3 emeralds, "Als Dankeschön bekommst du 3 Smaragde von mir."), the quest is done, the questlog entry disappears, and the chat shows `Quest abgeschlossen: Aushilfe in der Bibliothek (<name>)` to everyone.

### Behavior in detail

| Situation | What happens |
| --- | --- |
| Player declines an offer | The librarian answers "Kein Problem, komm einfach wieder …". The round stays offered; the next talk offers it again. |
| Player talks to her during a round | She tells the progress ("Du hast schon 2 von 5 Büchern einsortiert …"). |
| Player lost books (dropped, put in a chest) | When talking to her during a round, she hands out again every book of the round that is not sorted yet and not in the inventory. |
| Player sorts a book twice | Counts only once per round. |
| Player puts a book of the round into a shelf outside the library | Does not count once `LIBRARY_AREA` is set (see [Customization](#customization)). |
| Player talks to her after the quest | She only thanks the player again. |
| Player rejoins the world | Progress is kept; the questlog entry is shown again. |

### Questlog

While a round is active, the questlog (top right) shows:

```text
Aushilfe in der Bibliothek
 - Runde 1/2
 - Bücher sortiert: 3/5
```

When all books of the round are sorted, the progress line turns green and a line `Zurück zur Bibliothekarin` is added. Between rounds and after the quest there is no entry. With more than one player online, the title gets the player's name, because the questlog is shared by all players.

### Progress storage

The progress is stored per player as the dynamic property `dhsn:quest_library`, so it survives `/reload`, restarting the world and leaving/rejoining. Stored value (JSON):

| Field | Meaning |
| --- | --- |
| `round` | Index into `ROUNDS` (0 = first round). |
| `status` | `"offered"`: round offered but not accepted yet; `"active"`: round in progress; `"done"`: quest finished. |
| `sorted` | Item ids already sorted in the current round. |

No value means the quest was never started. Progress saved by the earlier version without rounds is read as round 1.

### Commands

| Command | Effect |
| --- | --- |
| `/scriptevent dhsn:quest_reset_library` | Resets **your own** quest progress, so you can start over. |
| `/scriptevent dhsn:quest_test_library` | Test setup: places the five bookshelves with signs and the librarian, see [Testing](#testing). |

Both need cheats to be enabled.

## Customization

Everything that is meant to be changed is at the top of `library-quest.js`, in the `CONFIGURATION` section.

### Library area – `LIBRARY_AREA`

Only bookshelves inside this area count for the quest.

```js
const LIBRARY_AREA = { from: { x: 100, y: 64, z: 40 }, to: { x: 120, y: 70, z: 60 } };
```

- Two corner blocks, in any order; both corners belong to the area.
- `undefined` (current value) means every own bookshelf in the world counts. Set the corners as soon as the library is built in the map.

### Rounds – `ROUNDS`

Each entry is one round, played in the order of the list. To add a third round, add a third entry; to have only one round, remove the second one. The questlog ("Runde 1/2") and the end of the quest adapt automatically.

```js
{
    books: ["myname:cs_book", "myname:cofi_book"],
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
| `books` | yes | Item ids the librarian hands out for this round; each has to be sorted once. **Each id may appear only once per round**, because progress is tracked per item id. Every book needs a bookshelf that accepts it (see [Books and bookshelves](#books-and-bookshelves)). |
| `offer.body`, `offer.accept`, `offer.decline` | yes | Dialog that offers the round: text and the two buttons. |
| `started` | yes | Line the librarian says in the chat after the round was accepted. |
| `finish.body`, `finish.button` | yes | Dialog when the round is handed in. |
| `reward` | no | Function called after the round was handed in, e.g. to give items or experience. |

Currently both rounds use all five books (`ALL_BOOKS`), because the repository has exactly one book per study program.

### Book names – `BOOK_NAMES`

Maps item ids to the names shown in the chat (`Buch einsortiert: <name>`). `ALL_BOOKS` is derived from it. A book without an entry is shown with its item id.

### Common texts – `TEXTS`

Texts used in every round:

| Key | Used for |
| --- | --- |
| `questTitle` | Questlog title and completion message |
| `librarianName` | Dialog title and name in chat lines |
| `declined` | Chat line after declining an offer |
| `reminder(sorted, total)` | Dialog text when talking to her during a round |
| `booksReturned` | Added to the reminder when lost books were handed out again |
| `allSorted` | Chat line when all books of a round are sorted |
| `done` | Dialog text after the quest is finished |
| `close` | Button to close the reminder and the thank-you dialog |
| `bookSorted(name, sorted, total)` | Chat line for every sorted book |
| `round(number, total)` | Questlog line with the round number |
| `objective`, `returnObjective` | Questlog lines for progress and "go back" |
| `questFinished(player)` | Chat message to everyone when the quest is finished |
| `reward(amount)` | Line the librarian says when handing out the quest reward. It names the item ("Smaragde"), so change it together with `QUEST_REWARD`. |
| `reset` | Chat line after `/scriptevent dhsn:quest_reset_library` |

Texts can contain Minecraft formatting codes such as `§a` (green) or `§l` (bold).

### Rewards

- **Per round:** the optional `reward` function of each round.
- **For the whole quest:** `QUEST_REWARD`, handed out once after the last round by `giveQuestReward(player)`. **Placeholder:** 3 emeralds.

```js
const QUEST_REWARD = { item: "minecraft:emerald", amount: 3 };
```

| Field | Meaning |
| --- | --- |
| `item` | Item id of the reward, e.g. a custom item like `dhsn:certificate` or a vanilla item. |
| `amount` | How many. Must not exceed the item's maximum stack size (our own books and items stack only to 1). |

The librarian announces the reward with `TEXTS.reward(amount)`; adjust that text when changing the item. If the inventory is full, the reward drops at the player's feet.

For a reward that is more than one item (several items, experience, a title …), extend `giveQuestReward(player)`:

```js
function giveQuestReward(player) {
    giveItem(player, QUEST_REWARD.item, QUEST_REWARD.amount);
    giveItem(player, "minecraft:book", 1);
    player.addExperience(50);
    say(player, TEXTS.reward(QUEST_REWARD.amount));
}
```

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
    "accepts": ["myname:cs_book"]
}
```

- `accepts`: the books the shelf takes. Currently each shelf only takes the book of its study program.
- `capacity`: how many books fit in. See [Known limitations](#known-limitations).

> **Where the capacity is defined:**
> - **Authoritative:** `capacity` in each bookshelf's block JSON, `behavior_pack/blocks/<shelf>.block.json` → `components` → `dhsn:bookshelf`. Each of the five shelves has its own value, currently `6` everywhere.
> - **Fallback only:** `DEFAULT_CAPACITY` in `behavior_pack/scripts/custom_bookshelf.js` (also `6`). It is used only if a block JSON has no `capacity`.
> - **After changing it:** rejoin the world. `/reload` does not reload block definitions.
> - **For this quest:** each round leaves one book per player in every shelf, so with two rounds and `6`, a shelf is full after three players. For the real map, use a higher value.

Full description: [Own bookshelves](../events/item-in-shelf.md#eigene-bücherregale) (German).

### Command names – `RESET_COMMAND`, `STATE_PROPERTY`

`RESET_COMMAND` (`dhsn:quest_reset_library`) is the script event id of the reset command. `STATE_PROPERTY` (`dhsn:quest_library`) is the name of the stored progress; changing it makes all players start from scratch.

## Testing

1. Open a world with **cheats enabled** and both packs, and stand on a flat, open area.
2. Run `/scriptevent dhsn:quest_test_library`. It places the five bookshelves with a sign each 3 blocks north, the librarian 2 blocks east of the last shelf, and writes a short quest summary to the chat. It does not hand out books. (The test also has its own questlog entry "Bibliothek: Bücher sortieren", which can be ignored here.)
3. Right-click the librarian and accept. The five books are in your inventory, and the questlog shows `Runde 1/2` and `Bücher sortiert: 0/5`.
4. Talk to her again: she reports 0 of 5.
5. Drop a book (`Q`) and talk to her: she hands it out again.
6. Put every book into the shelf named on its sign. The chat shows `Buch einsortiert: … (n/5)`, at the end "Alle Bücher sind einsortiert …".
7. Talk to her: the finish dialog of round 1 appears, followed directly by the offer for round 2.
8. Choose "Jetzt gerade nicht." She says she will wait; there is no questlog entry.
9. Talk to her again: round 2 is offered again. Accept: five new books, questlog `Runde 2/2`.
10. Sort the books again and talk to her: finish dialog of round 2. She gives you 3 emeralds ("Als Dankeschön bekommst du 3 Smaragde von mir."), the chat shows `Quest abgeschlossen: Aushilfe in der Bibliothek`, and the questlog entry disappears.
11. Talk to her once more: she only thanks you.

Counter-checks:

- Put a book into the wrong shelf: rejected with `Das passt nicht in dieses Regal.`, no progress.
- Run `/reload` in the middle of a round: progress and questlog entry are kept.
- `/scriptevent dhsn:quest_reset_library`: the quest starts again from round 1.

### Resetting the test

Two separate things can be reset; for a complete restart you need both.

| Command | Resets | Does not reset |
| --- | --- | --- |
| `/scriptevent dhsn:quest_reset_library` | Your own quest progress: the librarian offers round 1 again, the quest's questlog entry disappears. Only for the player running the command. | Shelves, librarian, inventory |
| `/scriptevent dhsn:quest_test_library` | The test setup: rebuilds the five shelves with signs at your current position and empties their counters, replaces the librarian from the previous run, resets the test's own questlog entry. | **Your quest progress.** Without the reset command the quest continues where you left off, or the librarian only thanks you if it is already finished. |

Complete restart, in this order:

```text
/clear
/scriptevent dhsn:quest_reset_library
/scriptevent dhsn:quest_test_library
```

`/clear` removes books and emeralds from the inventory. It is optional but keeps the test clear.

If you moved between two runs, the shelves of the previous run stay where they were; the test command only builds at your current position. Break the old shelves, or stand on the same spot before rebuilding.

## Known limitations

- **Shared questlog:** the questlog shows the same entries to every player. With several players online, each entry carries the player's name in its title. A questlog per player would be a change in `questlog.js` (#105).
- **Full shelves:** every shelf holds 6 books (`capacity`). Each round leaves one book per shelf, so with two rounds a shelf is full after three players. Raise `capacity` in the block JSONs (see [Books and bookshelves](#books-and-bookshelves)), or take books out.
- **Librarian editing:** right-clicking any librarian opens the quest dialog instead of the NPC editor, also in creative mode. She can only be edited with commands.
- **Not tested in game yet:** the dialogs (first use of `@minecraft/server-ui` in this repository) and the round flow.
- **Placeholders:** all dialog texts and the reward (3 emeralds) are placeholders until the story team decides on the real ones.

## Technical overview

| Part | Where | How |
| --- | --- | --- |
| Talking to the librarian | `world.beforeEvents.playerInteractWithEntity` | Cancels the default NPC screen and opens the quest dialog on the next tick. |
| Dialogs | `@minecraft/server-ui` 2.2.0 (`ActionFormData`) | Added to `behavior_pack/manifest.json`. Retries while the player still has another screen open (`UserBusy`). |
| Detecting sorted books | `onItemInShelf` from [events](../Events.md) | Filtered to the round's books, the own bookshelves (`DHSN_SHELF_TYPES`) and `LIBRARY_AREA`. |
| Bookshelf behavior | `behavior_pack/scripts/custom_bookshelf.js` | Custom block component `dhsn:bookshelf`. |
| Questlog | `behavior_pack/scripts/questlog.js` | One entry per player, `order: 2`. |
| Progress | Player dynamic property `dhsn:quest_library` | JSON, see [Progress storage](#progress-storage). |
