import { BlockPermutation, BlockVolume, ItemStack, SignSide, system } from "@minecraft/server";
import { getEcts, MAX_ECTS } from "../ects.js";
import { QUEST_ECTS, clearLibraryTestSetup, setLibraryTestSetup } from "../quests/library-quest.js";
import { giveSetupCompass } from "../util/setup-menu.js";
import { clearShelfContents } from "./shelf-contents.js";

// Test setup for the library quest (see quests/library-quest.js). Two ways:
//
//   /scriptevent dhsn:quest_test_library
// Test of the setup menu: gives the materials to build a library yourself and set it up with the compass
// "Quest-Setup", like the map team does (docs/quests/library-quest-map-guide.md): bookshelves of all study
// programs, a librarian spawn egg, signs and the setup compass. A test area saved earlier is removed, so the
// values of the setup menu apply. Instructions are written to the chat.
//
//   /scriptevent dhsn:quest_test_library aufbau
// Quick test of the quest itself: stand on flat ground (best: flat world, adventure mode, cheats on).
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
const BUILD_ARGUMENT = "aufbau";

// Materials for the test of the setup menu. The numbers of shelves make the book rule visible: Informatik
// has more than 5 shelves (at most 5 books per program), and together more than 14 books are possible
// (at most 14 per round).
const MATERIALS = [
    { item: "myname:computer_science_bookshelf", amount: 6 },
    { item: "myname:controlling_bookshelf", amount: 5 },
    { item: "myname:immobilienwirtschaft_bookshelf", amount: 4 },
    { item: "myname:nachhaltige_ingenieurwissenschaften_bookshelf", amount: 3 },
    { item: "myname:steuerberatung_bookshelf", amount: 3 },
    // One for the highscore sign, five to label the shelves.
    { item: "minecraft:oak_sign", amount: 6 },
];
// Spawn egg of the librarian; if the item does not exist, the librarian is spawned next to the player instead.
const LIBRARIAN_EGG = "dhsn:librarian_spawn_egg";

const SETUP_STEPS = [
    "Test des Setup-Menüs der Bibliothek:",
    " 1. /gamemode creative und eine Bibliothek bauen: Regale aufstellen (je Studiengang mindestens 1),",
    "    Bibliothekarin mit dem Ei setzen, ein Schild für die Bestenliste aufstellen.",
    " 2. Mit dem Kompass „Quest-Setup“ (Rechtsklick; andere Quest: Schleichen + Rechtsklick) Ecke 1 und 2 am Boden setzen,",
    "    das Schild ansehen und „Highscore-Schild“ klicken, „Regale prüfen“ und „Bibliothekarin prüfen“.",
    " 3. /gamemode adventure und die Quest bei der Bibliothekarin starten.",
    "Anleitung: docs/quests/library-quest-map-guide.md. Automatischer Aufbau: /scriptevent dhsn:quest_test_library aufbau",
];

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
    " 2. Du bekommst gemischt pro Studiengang 1 bis 5 Bücher (höchstens so viele, wie er Regale hat), insgesamt höchstens 14.",
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
    // The test does not change the ECTS; resetting them is up to the tester (/scriptevent dhsn:ects_reset).
    say(player, `ECTS: du hast ${getEcts(player)}/${MAX_ECTS}, die Quest gibt beim Abschluss ${QUEST_ECTS} (nicht die Challenge).`);
}

function giveItem(player, typeId, amount) {
    const stack = new ItemStack(typeId, amount);
    const leftover = player.getComponent("minecraft:inventory")?.container?.addItem(stack);
    if (leftover) player.dimension.spawnItem(leftover, player.location);
}

/** Gives everything needed to build a library and set it up with the setup menu. */
function giveSetupMaterials(player) {
    // The menu values must apply, not an area of an earlier automatic test setup.
    clearLibraryTestSetup();

    for (const { item, amount } of MATERIALS) giveItem(player, item, amount);
    try {
        giveItem(player, LIBRARIAN_EGG, 1);
    } catch {
        // No spawn egg item for the librarian: spawn her next to the player instead.
        const librarian = player.dimension.spawnEntity(LIBRARIAN, { x: player.location.x + 2, y: player.location.y, z: player.location.z });
        librarian.nameTag = "Bibliothekarin";
        say(player, "Kein Spawn-Ei für die Bibliothekarin gefunden, sie steht jetzt neben dir.");
    }
    giveSetupCompass(player);

    for (const line of SETUP_STEPS) say(player, line);
    say(player, `ECTS: du hast ${getEcts(player)}/${MAX_ECTS}, die Quest gibt beim Abschluss ${QUEST_ECTS} (nicht die Challenge).`);
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    if (id !== TEST_COMMAND) return;

    if (sourceEntity?.typeId !== "minecraft:player") {
        console.warn(`[Events] ${TEST_COMMAND} has to be run by a player.`);
        return;
    }

    if (message.trim() === BUILD_ARGUMENT) buildScene(sourceEntity);
    else giveSetupMaterials(sourceEntity);
});
