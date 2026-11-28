import { system } from "@minecraft/server";
import { boxOf, confirm, feetBlock, format, giveSetupCompass, lookedBlock, mark, registerSetupMenu, runMenu } from "../util/setup-menu.js";
import {
    clearLibraryMapValues,
    countLibrariansInLibrary,
    getLibraryLayoutSource,
    getLibraryMapValues,
    getShelfCountsPerProgram,
    resetLibraryQuest,
    setLibraryMapValues,
} from "./library-quest.js";

// Setup menu for the library quest: the library area and the highscore sign of the real map are entered in
// the game instead of in the code, like the setup menu of "Das Erwachen" (quests/awakening-setup.js).
//   /scriptevent dhsn:library_setup   opens the menu and gives the compass "Quest-Setup"; right-clicking the
//                                     compass opens the menu opened last, sneaking + right-click offers all quests.
// The values are saved in the world (dhsn:library_map_layout, see setLibraryMapValues in the quest).
// The general parts (compass, forms, positions, boxes) are shared: util/setup-menu.js.
// Documentation: docs/quests/library-quest-map-guide.md

const SETUP_COMMAND = "dhsn:library_setup";

// The library area from two corner blocks at floor level: 1 block below the feet (the floor) and 4 blocks
// above them, so jumping or standing on a shelf does not count as leaving (like the test setup).
const AREA_HEIGHT = { below: 1, above: 4 };

function isSign(typeId) {
    return typeId.includes("sign");
}

/** One corner of the library: the block the player stands in. The area is rebuilt when both are set. */
function setCorner(player, corner) {
    const values = getLibraryMapValues();
    const corners = { ...values.library_area_corners, [corner]: feetBlock(player) };
    setLibraryMapValues({
        dimension: player.dimension.id,
        library_area_corners: corners,
        library_area: boxOf(corners, AREA_HEIGHT),
    });
    return `Bibliothek: Ecke ${corner === "a" ? 1 : 2} gesetzt: ${format(corners[corner])}`;
}

function setSign(player) {
    const result = lookedBlock(player, isSign, "Schild");
    if (result.error) return `Highscore-Schild nicht gesetzt. ${result.error}`;
    setLibraryMapValues({ dimension: player.dimension.id, highscore_sign: result.location });
    return `Highscore-Schild gesetzt: ${format(result.location)}`;
}

function checkShelves() {
    const counts = getShelfCountsPerProgram();
    if (!counts) return "Erst die Bibliothek (beide Ecken) setzen.";
    const parts = counts.map(({ name, shelves }) => `${shelves > 0 ? "§a" : "§c"}${name}: ${shelves}§r`);
    const empty = counts.filter(({ shelves }) => shelves === 0).length;
    return `Regale im Bereich: ${parts.join(", ")}${empty > 0 ? ` §c(${empty} Studiengang/-gänge ohne Regal: deren Bücher gibt es nicht)§r` : ""}`;
}

function checkLibrarian() {
    if (!getShelfCountsPerProgram()) return "Erst die Bibliothek (beide Ecken) setzen.";
    const count = countLibrariansInLibrary();
    if (count === 0) return "§cKeine Bibliothekarin (dhsn:librarian) im Bereich.§r";
    return count === 1 ? "Bibliothekarin steht im Bereich." : `§e${count} Bibliothekarinnen im Bereich, eine reicht.§r`;
}

async function clearAll(player) {
    if (!(await confirm(player, "Alles löschen?", "Bereich und Highscore-Schild der Bibliothek werden gelöscht.", "Ja, löschen"))) return "Nichts gelöscht.";
    clearLibraryMapValues();
    return "Alles gelöscht.";
}

async function resetProgress(player) {
    if (!(await confirm(player, "Quest-Stand zurücksetzen?", "Dein Fortschritt der Bibliotheks-Quest wird gelöscht, Bücher einer laufenden Runde werden weggenommen.", "Ja, zurücksetzen"))) {
        return "Nichts zurückgesetzt.";
    }
    resetLibraryQuest(player);
    return "Quest-Stand zurückgesetzt.";
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} [note]
 */
function openMenu(player, note) {
    return runMenu(player, {
        id: "library",
        title: "Quest-Setup: Bibliothek",
        note,
        render: () => {
            const values = getLibraryMapValues();
            const corners = values.library_area_corners ?? {};
            const missing = [];
            if (!corners.a) missing.push("Ecke 1");
            if (!corners.b) missing.push("Ecke 2");

            const lines = [
                missing.length === 0 ? "§aBereich gesetzt: die Bibliothek ist aktiv.§r" : `§7Es fehlt noch: ${missing.join(", ")}§r`,
                `§7Aktive Quelle: ${getLibraryLayoutSource() ?? "keine"}. Highscore-Schild: ${values.highscore_sign ? format(values.highscore_sign) : "keins (optional)"}.§r`,
            ];
            const entries = [
                { text: `${mark(corners.a)}Bibliothek: Ecke 1 (am Boden)`, run: () => setCorner(player, "a") },
                { text: `${mark(corners.b)}Bibliothek: Ecke 2 (gegenüber, am Boden)`, run: () => setCorner(player, "b") },
                { text: `${mark(values.highscore_sign)}Highscore-Schild (ansehen)`, run: () => setSign(player) },
                { text: "Regale prüfen", run: () => checkShelves() },
                { text: "Bibliothekarin prüfen", run: () => checkLibrarian() },
                { text: "Quest-Stand zurücksetzen", run: () => resetProgress(player) },
                { text: "Alles löschen", run: () => clearAll(player) },
                { text: "Schließen", run: () => "close" },
            ];
            return { lines, entries };
        },
    });
}

registerSetupMenu({ id: "library", title: "Bibliothek", open: (player) => openMenu(player) });

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
    if (id !== SETUP_COMMAND || sourceEntity?.typeId !== "minecraft:player") return;
    const player = /** @type {import("@minecraft/server").Player} */ (sourceEntity);
    giveSetupCompass(player);
    player.sendMessage("§eQuest-Setup: Rechtsklick mit dem Kompass öffnet das Menü. Es öffnet sich gleich, sobald der Chat zu ist.");
    openMenu(player);
});
