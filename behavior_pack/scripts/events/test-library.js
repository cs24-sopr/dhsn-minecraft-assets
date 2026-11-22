import { BlockPermutation, BlockVolume, SignSide, system } from "@minecraft/server";
import { setLibraryTestSetup } from "../quests/library-quest.js";
import { clearShelfContents } from "./shelf-contents.js";

// Test setup for the library quest (see quests/library-quest.js). Stand on flat ground
// (best: flat world, adventure mode, cheats on) and run
//   /scriptevent dhsn:quest_test_library
// It builds a small library around you:
// - one row of bookshelves per study program, north of you (Informatik has 4 shelves, the others 3),
//   with a sign on the last shelf of each row that names the study program,
// - an oak plank floor that marks the library area (leaving it during a round starts the countdown),
// - the librarian east of the rows and the highscore sign of the challenge.
// The library area and the sign are saved in the world (see setLibraryTestSetup), so they survive
// /reload and restarting the world. /scriptevent dhsn:quest_test_library_clear removes them again.
// It starts nothing: the quest, its books and its questlog entry only begin when you talk to the librarian.
// Running the command again clears the area and rebuilds the library at your new position.

const TEST_COMMAND = "dhsn:quest_test_library";

// One row per study program, from south (closest to the player) to north.
// sign: text on the sign at the end of the row. Signs are narrow, so long names are split by hand.
const ROWS = [
    { shelf: "myname:computer_science_bookshelf", count: 4, sign: "Informatik" },
    { shelf: "myname:controlling_bookshelf", count: 3, sign: "Controlling" },
    { shelf: "myname:immobilienwirtschaft_bookshelf", count: 3, sign: "Immobilien-\nwirtschaft" },
    { shelf: "myname:nachhaltige_ingenieurwissenschaften_bookshelf", count: 3, sign: "Nachhaltige\nIngenieur-\nwissenschaften" },
    { shelf: "myname:steuerberatung_bookshelf", count: 3, sign: "Steuer-\nberatung" },
];

const FLOOR_BLOCK = "minecraft:oak_planks";

const LIBRARIAN = "dhsn:librarian";
// Marks the librarian spawned by this test, so running the test again replaces her instead of adding another one.
const LIBRARIAN_TAG = "dhsn:library_test";

// Rough outline of the library quest, shown in the chat when the test starts.
const QUEST_SUMMARY = [
    "Bibliotheks-Quest \"Aushilfe in der Bibliothek\" in Kürze:",
    " 1. Bibliothekarin (östlich der Regale) per Rechtsklick ansprechen und Hilfe annehmen.",
    " 2. Du bekommst pro Studiengang 1 bis so viele Bücher, wie er Regale hat.",
    " 3. Jedes Buch in ein Regal seines Studiengangs stellen, pro Regal nur ein Buch.",
    " 4. Zurück zur Bibliothekarin: Runde abgeben, danach folgt Runde 2, dann die Challenge auf Zeit.",
    " 5. Den Holzboden während einer Runde nicht verlassen, sonst ist die Runde nach 5 s zurückgesetzt.",
    "Neu starten: /scriptevent dhsn:quest_reset_library",
];

function say(player, text) {
    player.sendMessage(`§e${text}`);
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

function buildScene(player) {
    const dimension = player.dimension;
    const x = Math.floor(player.location.x);
    const y = Math.floor(player.location.y);
    const z = Math.floor(player.location.z);

    // The library: from 2 blocks south of the player to 2 blocks behind the last row,
    // from the floor to 4 blocks above the feet, so jumping does not count as leaving.
    const area = {
        from: { x: x - 4, y: y - 1, z: z - 3 - 2 * (ROWS.length - 1) - 2 },
        to: { x: x + 6, y: y + 4, z: z + 2 },
        dimension: dimension.id,
    };

    // Clear the room (removes shelves and signs of an earlier run at the same place) and lay the floor.
    dimension.fillBlocks(new BlockVolume({ ...area.from, y }, area.to), "minecraft:air");
    dimension.fillBlocks(new BlockVolume(area.from, { ...area.to, y: y - 1 }), FLOOR_BLOCK);

    ROWS.forEach(({ shelf, count, sign }, rowIndex) => {
        // Rows 3, 5, 7, … blocks north of the player, with a walkway between them.
        const rowZ = z - 3 - rowIndex * 2;
        for (let i = 0; i < count; i++) {
            const location = { x: x - 2 + i, y, z: rowZ };
            // The shelves face south, towards the player. Placed by hand, a shelf gets the
            // direction the player looks at, which is north here.
            dimension.setBlockPermutation(location, BlockPermutation.resolve(shelf, { "minecraft:cardinal_direction": "north" }));

            // A shelf placed by script is not seen by the counter, so reset leftovers from earlier runs.
            const block = dimension.getBlock(location);
            if (block) clearShelfContents(block);

            // Only the last shelf of the row gets a sign.
            if (i === count - 1) placeSign(dimension, { x: location.x, y: y + 1, z: rowZ }, sign);
        }
    });

    for (const librarian of dimension.getEntities({ type: LIBRARIAN, tags: [LIBRARIAN_TAG] })) librarian.remove();
    const librarian = dimension.spawnEntity(LIBRARIAN, { x: x + 4.5, y, z: z - 2.5 });
    librarian.addTag(LIBRARIAN_TAG);
    librarian.nameTag = "Bibliothekarin";

    // Highscore sign of the challenge, east of the rows. Its text is written by the quest.
    const signLocation = { x: x + 4, y, z: z - 6 };
    placeSign(dimension, signLocation, "");
    setLibraryTestSetup(area, signLocation);

    say(player, "Bibliotheks-Test aufgebaut. Sprich die Bibliothekarin an, um die Quest zu starten.");
    say(player, `Bibliothek (Holzboden): ${area.from.x} ${area.from.y} ${area.from.z} bis ${area.to.x} ${area.to.y} ${area.to.z}`);
    for (const line of QUEST_SUMMARY) say(player, line);
}

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
    if (id !== TEST_COMMAND) return;

    if (sourceEntity?.typeId !== "minecraft:player") {
        console.warn(`[Events] ${TEST_COMMAND} has to be run by a player.`);
        return;
    }

    buildScene(sourceEntity);
});
