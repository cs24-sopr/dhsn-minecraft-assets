import { BlockPermutation, SignSide, system } from "@minecraft/server";
import { clearShelfContents } from "./shelf-contents.js";

// Test setup for the library quest (see quests/library-quest.js). Stand on flat ground and run
//   /scriptevent dhsn:quest_test_library
// It only builds the scene: the five bookshelves of the study programs in a row 3 blocks north
// of you, each with a sign on top that names its study program, and the librarian at the east end
// of the row. It starts nothing: the quest, its books and its questlog entry only begin when you
// talk to the librarian. A short summary of the quest is written to the chat.
// Running the command again rebuilds the scene at your new position.

const TEST_COMMAND = "dhsn:quest_test_library";

// sign: text on the sign above the shelf. Signs are narrow, so long names are split by hand.
const SHELVES = [
    { shelf: "myname:computer_science_bookshelf", sign: "Informatik" },
    { shelf: "myname:controlling_bookshelf", sign: "Controlling" },
    { shelf: "myname:immobilienwirtschaft_bookshelf", sign: "Immobilien-\nwirtschaft" },
    { shelf: "myname:nachhaltige_ingenieurwissenschaften_bookshelf", sign: "Nachhaltige\nIngenieur-\nwissenschaften" },
    { shelf: "myname:steuerberatung_bookshelf", sign: "Steuer-\nberatung" },
];

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

function buildScene(player) {
    const dimension = player.dimension;
    const x = Math.floor(player.location.x);
    const y = Math.floor(player.location.y);
    const z = Math.floor(player.location.z) - 3;

    SHELVES.forEach(({ shelf, sign }, index) => {
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

    player.sendMessage("§aBibliotheks-Test aufgebaut. Sprich die Bibliothekarin an, um die Quest zu starten.");
    for (const line of QUEST_SUMMARY) player.sendMessage(line);
}

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
    if (id !== TEST_COMMAND) return;

    if (sourceEntity?.typeId !== "minecraft:player") {
        console.warn(`[Events] ${TEST_COMMAND} has to be run by a player.`);
        return;
    }

    buildScene(sourceEntity);
});
