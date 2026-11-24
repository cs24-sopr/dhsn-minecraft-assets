import { ItemStack, system, world } from "@minecraft/server";
import { ActionFormData, FormCancelationReason, ModalFormData } from "@minecraft/server-ui";
import { PROFESSOR_TAG, getAwakeningLayoutSource, previewAwakeningRide, resetAwakening, setAwakeningSetupLayout, startAwakening } from "./awakening-quest.js";

// Setup menu for the quest "Das Erwachen": the places of the real map are entered in the game instead of in the code.
// The builder stands at a place, opens the menu and clicks the matching button; the menu takes the position of the
// player (or the block the player looks at). Camera shots are taken the same way.
//   /scriptevent dhsn:awakening_setup   opens the menu and gives a compass; right-clicking the compass opens it too.
// When all places are set, the menu saves a layout in the world (see setAwakeningSetupLayout in the quest) that
// replaces the one of the test setup and takes precedence over LAYOUT. The raw values are kept in the world too.
// Documentation: docs/quests/awakening-setup.md
//
// THIS FILE IS A BUILDING TOOL, not part of the quest. It can be deleted together with its import in main.js
// once the numbers are final and copied into LAYOUT in the quest.

const SETUP_COMMAND = "dhsn:awakening_setup";
const RAW_PROPERTY = "dhsn:awakening_setup";
const ITEM_TYPE = "minecraft:compass";
const ITEM_NAME = "§bQuest-Setup §7(Rechtsklick)";

// How far a click on "look at a block" reaches.
const LOOK_DISTANCE = 10;
// How far in front of the player the camera looks after a shot or a teleport (a point in the view direction).
const FACING_DISTANCE = 10;
// The default flight time of a camera shot in seconds.
const DEFAULT_SECONDS = 3;

// The boxes of the quest are made of two corner blocks. The height is added: blocks below the lower corner,
// blocks above the upper corner. Window and portal: the player's body; building: floor to above the roof.
const BOXES = {
    window: { label: "Fenster", below: 0, above: 2 },
    building: { label: "Gebäude", below: 1, above: 2 },
    portal: { label: "Teleporter", below: 0, above: 2 },
};

/**
 * What the menu has collected. Everything is optional until the layout is complete.
 * @typedef {object} RawSetup
 * @property {string} [dimension]
 * @property {import("@minecraft/server").Vector3} [wake]
 * @property {import("@minecraft/server").Vector3} [wakeFacing]
 * @property {import("@minecraft/server").Vector3} [alarm]
 * @property {import("@minecraft/server").Vector3} [chest]
 * @property {import("@minecraft/server").Vector3} [buildingReturn]
 * @property {import("@minecraft/server").Vector3} [islandGate]
 * @property {import("@minecraft/server").Vector3} [islandFacing]
 * @property {{ a?: import("@minecraft/server").Vector3, b?: import("@minecraft/server").Vector3 }} [window]
 * @property {{ a?: import("@minecraft/server").Vector3, b?: import("@minecraft/server").Vector3 }} [building]
 * @property {{ a?: import("@minecraft/server").Vector3, b?: import("@minecraft/server").Vector3 }} [portal]
 * @property {{ location: import("@minecraft/server").Vector3, facing: import("@minecraft/server").Vector3, seconds: number }[]} [cameraPath]
 */

// --------------------------------------------------
// STORAGE AND LAYOUT
// --------------------------------------------------

/** @returns {RawSetup} */
function readRaw() {
    try {
        const text = world.getDynamicProperty(RAW_PROPERTY);
        return typeof text === "string" ? JSON.parse(text) : {};
    } catch {
        return {};
    }
}

/** Saves the raw values and (re)builds the layout of the quest from them: a complete one is activated, otherwise removed. */
function saveRaw(raw) {
    world.setDynamicProperty(RAW_PROPERTY, JSON.stringify(raw));
    setAwakeningSetupLayout(buildLayout(raw));
}

function boxOf(corners, spec) {
    const { a, b } = corners ?? {};
    if (!a || !b) return undefined;
    return {
        from: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) - spec.below, z: Math.min(a.z, b.z) },
        to: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) + spec.above, z: Math.max(a.z, b.z) },
    };
}

/**
 * The layout of the quest, or undefined while something is missing.
 * @param {RawSetup} raw
 */
function buildLayout(raw) {
    return missing(raw).length > 0
        ? undefined
        : {
              dimension: raw.dimension,
              wake: raw.wake,
              wakeFacing: raw.wakeFacing,
              alarm: raw.alarm,
              window: boxOf(raw.window, BOXES.window),
              chest: raw.chest,
              building: boxOf(raw.building, BOXES.building),
              buildingReturn: raw.buildingReturn,
              portal: boxOf(raw.portal, BOXES.portal),
              islandGate: raw.islandGate,
              islandFacing: raw.islandFacing,
              cameraPath: raw.cameraPath ?? [],
          };
}

/** The names of everything that is not set yet. */
function missing(raw) {
    const list = [];
    if (!raw.wake) list.push("Aufwachpunkt");
    if (!raw.alarm) list.push("Wecker");
    if (!raw.window?.a) list.push("Fenster Ecke 1");
    if (!raw.window?.b) list.push("Fenster Ecke 2");
    if (!raw.chest) list.push("Truhe");
    if (!raw.building?.a) list.push("Gebäude Ecke 1");
    if (!raw.building?.b) list.push("Gebäude Ecke 2");
    if (!raw.buildingReturn) list.push("Rückkehrpunkt");
    if (!raw.portal?.a) list.push("Teleporter Ecke 1");
    if (!raw.portal?.b) list.push("Teleporter Ecke 2");
    if (!raw.islandGate) list.push("Insel-Tor");
    return list;
}

// --------------------------------------------------
// CAPTURING
// --------------------------------------------------

const round = (value) => Math.round(value * 100) / 100;
const vec = (v) => ({ x: round(v.x), y: round(v.y), z: round(v.z) });
const format = (v) => `${v.x} ${v.y} ${v.z}`;

/** The block position of the player's feet. */
function feetBlock(player) {
    const { x, y, z } = player.location;
    return { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) };
}

/** A point some blocks in front of the player's eyes: what the camera should look at. */
function lookPoint(player) {
    const head = player.getHeadLocation();
    const dir = player.getViewDirection();
    return vec({ x: head.x + dir.x * FACING_DISTANCE, y: head.y + dir.y * FACING_DISTANCE, z: head.z + dir.z * FACING_DISTANCE });
}

/** The block the player looks at. Returns undefined plus a reason if it is not one of the allowed types. */
function lookedBlock(player, accepts, what) {
    const hit = player.getBlockFromViewDirection({ maxDistance: LOOK_DISTANCE });
    if (!hit) return { error: `Du schaust auf keinen Block (max. ${LOOK_DISTANCE} Blöcke). Das Menü merkt sich die Blickrichtung beim Öffnen.` };
    const block = hit.block;
    if (!accepts(block.typeId)) return { error: `Du schaust auf ${block.typeId}, erwartet: ${what}.` };
    return { location: { x: block.x, y: block.y, z: block.z } };
}

// --------------------------------------------------
// MENU
// --------------------------------------------------

/** Shows a form; a form that is refused because the chat or another screen is open is retried for a few seconds. */
async function show(player, form) {
    for (let attempt = 0; attempt < 40; attempt++) {
        let response;
        try {
            response = await form.show(player);
        } catch {
            return undefined; // The player left.
        }
        if (response.canceled && response.cancelationReason === FormCancelationReason.UserBusy) {
            await system.waitTicks(10);
            continue;
        }
        return response.canceled ? undefined : response;
    }
    return undefined;
}

const open = new Set();

/**
 * The main menu. Every click saves something and shows the menu again, until it is closed.
 * @param {import("@minecraft/server").Player} player
 * @param {string} [note] Shown at the top: the result of the last click.
 */
async function openMenu(player, note) {
    if (!note && open.has(player.id)) return;
    open.add(player.id);
    try {
        for (;;) {
            const raw = readRaw();
            const todo = missing(raw);
            const mark = (ok) => (ok ? "§a✔ §r" : "§c✘ §r");
            const source = getAwakeningLayoutSource() ?? "keines";

            const lines = [];
            if (note) lines.push(`§e${note}§r`, "");
            lines.push(todo.length === 0 ? "§aAlles gesetzt: das Layout ist aktiv.§r" : `§7Es fehlt noch: ${todo.join(", ")}§r`);
            lines.push(`§7Aktives Layout: ${source}. Kamerafahrt: ${raw.cameraPath?.length ?? 0} Aufnahmen.§r`);

            /** @type {{ text: string, run: () => string | undefined | Promise<string | undefined> }[]} */
            const entries = [
                { text: `${mark(raw.wake)}Aufwachpunkt (Position + Blick)`, run: () => setPoint(player, "wake", "wakeFacing", "Aufwachpunkt") },
                { text: `${mark(raw.alarm)}Wecker (Notenblock ansehen)`, run: () => setBlock(player, "alarm", (t) => t === "minecraft:noteblock", "Notenblock", "Wecker") },
                { text: `${mark(raw.window?.a)}Fenster: Ecke 1`, run: () => setCorner(player, "window", "a") },
                { text: `${mark(raw.window?.b)}Fenster: Ecke 2`, run: () => setCorner(player, "window", "b") },
                { text: `${mark(raw.chest)}Truhe (ansehen)`, run: () => setBlock(player, "chest", (t) => t.includes("chest"), "Truhe", "Truhe") },
                { text: `${mark(raw.building?.a)}Gebäude: Ecke 1 (am Boden)`, run: () => setCorner(player, "building", "a") },
                { text: `${mark(raw.building?.b)}Gebäude: Ecke 2 (gegenüber, auf dem Dach)`, run: () => setCorner(player, "building", "b") },
                { text: `${mark(raw.buildingReturn)}Rückkehrpunkt im Gebäude`, run: () => setPoint(player, "buildingReturn", undefined, "Rückkehrpunkt") },
                { text: `${mark(raw.portal?.a)}Teleporter: Ecke 1`, run: () => setCorner(player, "portal", "a") },
                { text: `${mark(raw.portal?.b)}Teleporter: Ecke 2`, run: () => setCorner(player, "portal", "b") },
                { text: `${mark(raw.islandGate)}Insel-Tor (Position + Blick)`, run: () => setPoint(player, "islandGate", "islandFacing", "Insel-Tor") },
                { text: `${mark(hasProfessor(player))}Professor (NPC ansehen)`, run: () => setProfessor(player) },
                { text: `${mark((raw.cameraPath?.length ?? 0) > 0)}Kamerafahrt …`, run: () => cameraMenu(player) },
                { text: "Quest neu starten (am Aufwachpunkt)", run: () => restartQuest(player) },
                { text: "Alles löschen", run: () => clearAll(player) },
                { text: "Schließen", run: () => "close" },
            ];

            const form = new ActionFormData().title("Quest-Setup: Das Erwachen").body(lines.join("\n"));
            for (const entry of entries) form.button(entry.text);

            const response = await show(player, form);
            if (!response || response.selection === undefined) return;

            const result = await entries[response.selection].run();
            if (result === "close") return;
            note = result;
        }
    } finally {
        open.delete(player.id);
    }
}

/** A position and, if given, the view direction of the player. */
function setPoint(player, key, facingKey, label) {
    const raw = readRaw();
    raw.dimension = player.dimension.id;
    raw[key] = vec(player.location);
    if (facingKey) raw[facingKey] = lookPoint(player);
    saveRaw(raw);
    return `${label} gesetzt: ${format(raw[key])}`;
}

/** The block the player looks at. */
function setBlock(player, key, accepts, what, label) {
    const result = lookedBlock(player, accepts, what);
    if (result.error) return `${label} nicht gesetzt. ${result.error}`;
    const raw = readRaw();
    raw.dimension = player.dimension.id;
    raw[key] = result.location;
    saveRaw(raw);
    return `${label} gesetzt: ${format(result.location)}`;
}

/** One corner of a box: the block the player stands in. */
function setCorner(player, key, corner) {
    const raw = readRaw();
    raw.dimension = player.dimension.id;
    raw[key] = { ...raw[key], [corner]: feetBlock(player) };
    saveRaw(raw);
    const spec = BOXES[key];
    return `${spec.label}: Ecke ${corner === "a" ? 1 : 2} gesetzt: ${format(raw[key][corner])}`;
}

/** True if an entity with the professor tag exists in the dimension of the player. */
function hasProfessor(player) {
    try {
        return player.dimension.getEntities({ tags: [PROFESSOR_TAG] }).length > 0;
    } catch {
        return false;
    }
}

/** Tags the NPC the player looks at as the professor. The tag is on the entity, not in the layout. */
function setProfessor(player) {
    const hit = player.getEntitiesFromViewDirection({ maxDistance: LOOK_DISTANCE }).find((h) => h.entity.id !== player.id);
    if (!hit) return `Kein NPC im Blick (max. ${LOOK_DISTANCE} Blöcke). Das Menü merkt sich die Blickrichtung beim Öffnen.`;
    for (const old of player.dimension.getEntities({ tags: [PROFESSOR_TAG] })) old.removeTag(PROFESSOR_TAG);
    hit.entity.addTag(PROFESSOR_TAG);
    return `Professor gesetzt: ${hit.entity.nameTag || hit.entity.typeId}`;
}

function restartQuest(player) {
    if (missing(readRaw()).length > 0) return "Es fehlt noch etwas, die Quest ist noch nicht aktiv.";
    resetAwakening(player);
    if (!startAwakening(player, true)) return "Die Quest konnte nicht starten.";
    return "close"; // The player has to see the room, not the menu.
}

async function clearAll(player) {
    const response = await show(player, new ActionFormData().title("Alles löschen?").body("Alle gesetzten Orte und die Kamerafahrt werden gelöscht.").button("Ja, löschen").button("Abbrechen"));
    if (response?.selection !== 0) return "Nichts gelöscht.";
    world.setDynamicProperty(RAW_PROPERTY, undefined);
    setAwakeningSetupLayout(undefined);
    return "Alles gelöscht.";
}

// --------------------------------------------------
// CAMERA SUBMENU
// --------------------------------------------------

async function cameraMenu(player) {
    let note = "";
    for (;;) {
        const raw = readRaw();
        const path = raw.cameraPath ?? [];
        const body = [
            note ? `§e${note}§r\n` : "",
            `${path.length} Aufnahmen. Stell dich hin, schau in die gewünschte Richtung, öffne das Menü und füge die Aufnahme hinzu. Die erste Aufnahme ist der Start der Fahrt, jede weitere ist ein Flug dorthin.`,
        ].join("\n");
        const form = new ActionFormData()
            .title("Kamerafahrt")
            .body(body)
            .button("Aufnahme hinzufügen (Position + Blick)")
            .button("Letzte Aufnahme entfernen")
            .button("Alle Aufnahmen löschen")
            .button("Vorschau abspielen")
            .button("Zurück");
        const response = await show(player, form);
        if (!response || response.selection === 4) return note || undefined;

        switch (response.selection) {
            case 0: {
                let seconds = 0;
                if (path.length > 0) {
                    const modal = await show(player, new ModalFormData().title("Neue Aufnahme").textField("Flugzeit zu dieser Aufnahme in Sekunden", String(DEFAULT_SECONDS)));
                    if (!modal) {
                        note = "Abgebrochen.";
                        break;
                    }
                    const value = parseFloat(String(modal.formValues?.[0] ?? "").replace(",", "."));
                    seconds = Number.isFinite(value) && value > 0 ? value : DEFAULT_SECONDS;
                }
                // The head position and view direction are read after the form, not before.
                path.push({ location: vec(player.getHeadLocation()), facing: lookPoint(player), seconds });
                raw.cameraPath = path;
                saveRaw(raw);
                note = `Aufnahme ${path.length} hinzugefügt (${seconds} s).`;
                break;
            }
            case 1:
                path.pop();
                raw.cameraPath = path;
                saveRaw(raw);
                note = "Letzte Aufnahme entfernt.";
                break;
            case 2:
                raw.cameraPath = [];
                saveRaw(raw);
                note = "Alle Aufnahmen gelöscht.";
                break;
            case 3:
                if (path.length === 0) {
                    note = "Noch keine Aufnahmen.";
                    break;
                }
                if (!previewAwakeningRide(player, path)) {
                    note = "Die Kamerafahrt läuft schon.";
                    break;
                }
                return "close"; // Close the menu so the ride is visible.
        }
    }
}

// --------------------------------------------------
// OPENING THE MENU
// --------------------------------------------------

function hasItem(player) {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return true;
    for (let slot = 0; slot < container.size; slot++) {
        if (container.getItem(slot)?.nameTag === ITEM_NAME) return true;
    }
    return false;
}

function giveItem(player) {
    if (hasItem(player)) return;
    const item = new ItemStack(ITEM_TYPE, 1);
    item.nameTag = ITEM_NAME;
    item.lockMode = "inventory";
    player.getComponent("minecraft:inventory")?.container?.addItem(item);
}

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
    if (id !== SETUP_COMMAND || sourceEntity?.typeId !== "minecraft:player") return;
    const player = /** @type {import("@minecraft/server").Player} */ (sourceEntity);
    giveItem(player);
    player.sendMessage("§eQuest-Setup: Rechtsklick mit dem Kompass öffnet das Menü. Es öffnet sich gleich, sobald der Chat zu ist.");
    openMenu(player);
});

world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
    if (itemStack.typeId !== ITEM_TYPE || itemStack.nameTag !== ITEM_NAME) return;
    openMenu(source);
});
