import { system, world } from "@minecraft/server";

// Shared helpers for what the add-on saves in the world (world dynamic properties).
//
// The game is single player, so quest progress is stored ONCE PER WORLD, without player id,
// e.g. "dhsn:quest_library". Earlier versions stored it per player ("dhsn:quest_library:<player id>");
// takeOverPerPlayerValue moves such values to the new key.
//
// Commands:
//   /scriptevent dhsn:progress            lists everything the add-on saved in this world
//   /scriptevent dhsn:map_cleanup confirm deletes all saved progress and test data before the map
//                                         is handed out; only the map setup (*_map_layout) stays

const PREFIX = "dhsn:";
const PROGRESS_COMMAND = "dhsn:progress";
const CLEANUP_COMMAND = "dhsn:map_cleanup";

// Saved values that belong to the finished map and must survive the cleanup.
const KEEP_ON_CLEANUP = /_map_layout$/;

// Keys already searched for old per-player values in this script load.
const checkedKeys = new Set();

/**
 * Returns the value of `key`. If it is missing, takes over an old per-player value
 * ("<key>:<player id>"): moves it to `key` and deletes all old per-player values of this key.
 * With several old values, `choose` picks one (default: the first).
 * @param {string} key
 * @param {(values: (string | number | boolean | import("@minecraft/server").Vector3)[]) => any} [choose]
 * @returns {string | number | boolean | import("@minecraft/server").Vector3 | undefined}
 */
export function takeOverPerPlayerValue(key, choose = (values) => values[0]) {
    const current = world.getDynamicProperty(key);
    if (current !== undefined || checkedKeys.has(key)) return current;
    // New per-player values are never written any more, so one search per script load is enough.
    checkedKeys.add(key);

    const oldIds = world.getDynamicPropertyIds().filter((id) => id.startsWith(`${key}:`));
    if (oldIds.length === 0) return undefined;

    const values = oldIds.map((id) => world.getDynamicProperty(id)).filter((value) => value !== undefined);
    const value = values.length > 0 ? choose(values) : undefined;
    if (value !== undefined) world.setDynamicProperty(key, value);
    for (const id of oldIds) world.setDynamicProperty(id, undefined);
    return value;
}

/**
 * Reads a JSON value; a broken value counts as missing and is reported in the content log.
 * @param {string} key
 * @param {string | number | boolean | import("@minecraft/server").Vector3 | undefined} raw
 */
export function parseJson(key, raw) {
    if (typeof raw !== "string") return undefined;
    try {
        return JSON.parse(raw);
    } catch {
        console.warn(`[storage] ${key} is not valid JSON and is ignored.`);
        return undefined;
    }
}

function shorten(value) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== PROGRESS_COMMAND && id !== CLEANUP_COMMAND) return;

    const ids = world.getDynamicPropertyIds().filter((key) => key.startsWith(PREFIX)).sort();

    if (id === PROGRESS_COMMAND) {
        // Shelf counters are many small values; only their number is shown.
        const shelves = ids.filter((key) => key.startsWith("dhsn:shelf_contents:"));
        const lines = ids.filter((key) => !shelves.includes(key)).map((key) => `${key} = ${shorten(world.getDynamicProperty(key))}`);
        if (shelves.length > 0) lines.push(`dhsn:shelf_contents:… = ${shelves.length} Regale mit Inhalt`);
        world.sendMessage(`§eGespeichert in dieser Welt (${lines.length === 0 ? "nichts" : `${ids.length} Werte`}):`);
        for (const line of lines) world.sendMessage(`§e ${line}`);
        return;
    }

    // Cleanup needs "confirm", so a mistyped command does not delete anything.
    if (message.trim() !== "confirm") {
        world.sendMessage(`§eLöscht allen Fortschritt und alle Testdaten dieser Welt, nur die Map-Einstellungen (*_map_layout) bleiben. Ausführen mit: /scriptevent ${CLEANUP_COMMAND} confirm`);
        return;
    }
    const removed = ids.filter((key) => !KEEP_ON_CLEANUP.test(key));
    for (const key of removed) world.setDynamicProperty(key, undefined);
    world.sendMessage(`§e${removed.length} Werte gelöscht, ${ids.length - removed.length} Map-Einstellungen behalten. Welt neu betreten, damit Questlog und Anzeigen frisch starten.`);
});
