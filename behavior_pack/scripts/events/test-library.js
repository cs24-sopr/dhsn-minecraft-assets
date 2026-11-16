import { BlockPermutation, SignSide, system, world } from "@minecraft/server";
import { questlog } from "../questlog.js";
import { onItemInShelf } from "./index.js";
import { clearShelfContents } from "./shelf-contents.js";

// Test quest for our own bookshelves. Stand on flat ground and run
//   /scriptevent dhsn:quest_test_library
// It places the five bookshelves of the study programs in a row 3 blocks north of you, each
// with a sign on top that names its study program, spawns the librarian at the east end of the
// row. The books come from her when you accept the library quest (see quests/library-quest.js).
// Every book has to go into its own shelf, e.g. the computer science book into the computer
// science bookshelf; the shelves only accept their own book (see "accepts" in the block JSONs).
// Each sorted book ticks off its line in the questlog; when all five are sorted, the quest is finished.
// Running the command again rebuilds the shelves at your new position.

const TEST_COMMAND = "dhsn:quest_test_library";

// sign: text on the sign above the shelf. Signs are narrow, so long names are split by hand.
const BOOK_SORTING = [
    { name: "Informatik", sign: "Informatik", book: "myname:cs_book", shelf: "myname:computer_science_bookshelf" },
    { name: "Controlling", sign: "Controlling", book: "myname:cofi_book", shelf: "myname:controlling_bookshelf" },
    { name: "Immobilienwirtschaft", sign: "Immobilien-\nwirtschaft", book: "myname:immo_book", shelf: "myname:immobilienwirtschaft_bookshelf" },
    { name: "Nachh. Ingenieurwiss.", sign: "Nachhaltige\nIngenieur-\nwissenschaften", book: "myname:niia_book", shelf: "myname:nachhaltige_ingenieurwissenschaften_bookshelf" },
    { name: "Steuerberatung", sign: "Steuer-\nberatung", book: "myname:stwp_book", shelf: "myname:steuerberatung_bookshelf" },
];

const QUEST_TITLE = "Bibliothek: Bücher sortieren";

const LIBRARIAN = "dhsn:librarian";
// Marks the librarian spawned by this test, so running the test again replaces her instead of adding another one.
const LIBRARIAN_TAG = "dhsn:library_test";

// Rough outline of the library quest, shown in the chat when the test starts.
const QUEST_SUMMARY = [
    "§6Bibliotheks-Quest \"Aushilfe in der Bibliothek\" in Kürze:§r",
    " 1. Bibliothekarin (am Ende der Regalreihe) per Rechtsklick ansprechen und Hilfe annehmen.",
    " 2. Du bekommst 5 Bücher, je eins pro Studiengang.",
    " 3. Jedes Buch ins Regal seines Studiengangs stellen (steht auf den Schildern).",
    " 4. Zurück zur Bibliothekarin: Runde abgeben, sie bietet eine zweite Runde mit neuen Büchern an.",
    " 5. Nach der zweiten Runde ist die Quest abgeschlossen.",
    "§7Neu starten: /scriptevent dhsn:quest_reset_library§r",
];

let stopListeners = [];
let questEntry;

function updateQuestlog(sorted) {
    const finished = sorted.size === BOOK_SORTING.length;
    const title = finished ? `§a${QUEST_TITLE} (fertig)§r` : QUEST_TITLE;
    const lines = BOOK_SORTING.map(({ name }) => (sorted.has(name) ? `§a[x] ${name}§r` : `[ ] ${name}`));

    if (questEntry) {
        questEntry.title = title;
        questEntry.lines = lines;
    } else {
        questEntry = questlog.createEntry({ title, lines, order: 1 });
    }
}

/**
 * Places a waxed oak sign with the text on both sides, so it is readable whichever way it turned out.
 * Direction 0 should face south, towards the player.
 */
function placeSign(dimension, location, text) {
    dimension.setBlockPermutation(location, BlockPermutation.resolve("minecraft:standing_sign", { ground_sign_direction: 0 }));

    const sign = dimension.getBlock(location)?.getComponent("minecraft:sign");
    if (!sign) return;

    sign.setText(text, SignSide.Front);
    sign.setText(text, SignSide.Back);
    sign.setWaxed(true);
}

function placeShelves(player) {
    const dimension = player.dimension;
    const x = Math.floor(player.location.x);
    const y = Math.floor(player.location.y);
    const z = Math.floor(player.location.z) - 3;

    BOOK_SORTING.forEach(({ shelf, sign }, index) => {
        const location = { x: x - 4 + index * 2, y, z };
        // The shelves face south, towards the player. Placed by hand, a shelf gets the
        // direction the player looks at, which is north here.
        dimension.setBlockPermutation(location, BlockPermutation.resolve(shelf, { "minecraft:cardinal_direction": "north" }));

        // A shelf placed by script is not seen by the counter, so reset leftovers from earlier runs.
        const block = dimension.getBlock(location);
        if (block) clearShelfContents(block);

        placeSign(dimension, { x: location.x, y: location.y + 1, z: location.z }, sign);
    });

    for (const librarian of dimension.getEntities({ type: LIBRARIAN, tags: [LIBRARIAN_TAG] })) librarian.remove();
    const librarian = dimension.spawnEntity(LIBRARIAN, { x: x + 6.5, y, z: z + 0.5 });
    librarian.addTag(LIBRARIAN_TAG);
    librarian.nameTag = "Bibliothekarin";

    return dimension.id;
}

function startQuest(player) {
    for (const stop of stopListeners) stop();

    const dimensionId = placeShelves(player);
    const sorted = new Set();
    updateQuestlog(sorted);

    stopListeners = BOOK_SORTING.map(({ name, book, shelf }) =>
        onItemInShelf({ itemType: book, shelfType: shelf, dimension: dimensionId }, ({ player }) => {
            if (sorted.has(name)) return;

            sorted.add(name);
            updateQuestlog(sorted);
            world.sendMessage(`§eEreignis ist eingetreten:§r ${name}-Buch ins ${name}-Regal (${player.name})`);

            if (sorted.size === BOOK_SORTING.length) {
                world.sendMessage("§aQuest abgeschlossen: Alle Bücher sind richtig sortiert!");
            }
        })
    );

    player.sendMessage("§aBibliotheks-Test aufgebaut: Stelle jedes Buch ins Regal seines Studiengangs.");
    for (const line of QUEST_SUMMARY) player.sendMessage(line);
}

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
    if (id !== TEST_COMMAND) return;

    if (sourceEntity?.typeId !== "minecraft:player") {
        console.warn(`[Events] ${TEST_COMMAND} has to be run by a player.`);
        return;
    }

    startQuest(sourceEntity);
});
