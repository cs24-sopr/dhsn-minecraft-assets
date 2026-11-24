import { system, world } from "@minecraft/server";
import { addEcts } from "../ects.js";
import { createArea, isInArea, isSameBlock } from "../events/area.js";
import { questlog } from "../questlog.js";

// Quest "Schaltalgebra" (project#173):
// 1. In a lecture room there is a redstone lamp with a stone button on top. Pressing the button
//    makes the lamp light up briefly (vanilla redstone), then the player is teleported into a
//    closed puzzle room. A student ID is required.
// 2. In the puzzle room the player sets four levers of a fixed redstone circuit. The circuit is
//    built by the building team (project#174); this script does not know the logic. The puzzle is
//    solved as soon as the target lamp at the end of the room lights up.
// 3. Solved: ECTS (once), the questlog line turns green, and the lamp in the lecture room stays lit.
// 4. A return button teleports the player back at any time; the puzzle can be tried again.
// The progress is stored in the world. Documentation: docs/quests/schaltalgebra-quest.md

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

/**
 * @typedef {object} Layout Positions in the map. Coordinates come from the building team.
 * @property {string} dimension Dimension id, e.g. "minecraft:overworld".
 * @property {import("@minecraft/server").Vector3} startButton Stone button on the lamp in the lecture room.
 * @property {import("@minecraft/server").Vector3} startLamp Redstone lamp in the lecture room. The block below it
 *     must be free for the script (floor block): it becomes a redstone block to keep the lamp lit.
 * @property {{ location: import("@minecraft/server").Vector3, facing?: import("@minecraft/server").Vector3 }} puzzleArrival
 *     Where the player lands in the puzzle room and where they look.
 * @property {import("@minecraft/server").Vector3} returnButton Button in the puzzle room that leads back.
 * @property {{ location: import("@minecraft/server").Vector3, facing?: import("@minecraft/server").Vector3 }} returnArrival
 *     Where the player lands in the lecture room and where they look.
 * @property {import("@minecraft/server").Vector3} targetLamp Redstone lamp at the end of the puzzle room.
 * @property {import("@minecraft/server").Vector3[]} levers The four levers; they are switched off on arrival.
 * @property {{ from: import("@minecraft/server").Vector3, to: import("@minecraft/server").Vector3 }} puzzleArea The puzzle room.
 */

// The real positions in the map. Two ways to set them:
// - in the finished map with command blocks: /scriptevent dhsn:schaltalgebra_set <variable> <coordinates>
//   (see MAP_VARIABLES below; saved in the world, no code change needed), or
// - here in the code.
// Undefined until the building team has built the rooms (project#174); until then the quest only works
// with the test setup (dhsn:quest_test_schaltalgebra), which saves its own layout in the world.
// Order of precedence: test setup, then the command block values, then this constant.
/** @type {Layout | undefined} */
const LAYOUT = undefined;

// Item the player needs to start the quest. Undefined switches the check off.
const REQUIRED_ITEM = "dhsn:studierendenausweis";

// ECTS for solving the puzzle (once). Placeholder until the story team decides (docs/Ects.md).
export const QUEST_ECTS = 10;

// Ticks between pressing the start button and the teleport, so the brief light is visible.
// A stone button stays pressed for 20 ticks.
const TELEPORT_DELAY = 20;

// How often the target lamp is checked while the player is in the puzzle room, in ticks.
const CHECK_INTERVAL = 5;

// Placeholder texts until the story team delivers the real ones. All chat output is yellow.
const TEXTS = {
    questTitle: "Schaltalgebra",
    objective: "Löse das Rätsel der Schaltalgebra",
    needsItem: "Ohne Studierendenausweis kommst du hier nicht weiter.",
    arrived: "Stell die vier Schalter so ein, dass die Lampe am Ende des Raumes leuchtet. Mit dem Knopf kommst du jederzeit zurück.",
    solved: "Die Lampe leuchtet! Du hast das Rätsel der Schaltalgebra gelöst.",
    solvedAgain: "Die Lampe leuchtet wieder. Das Rätsel hattest du schon gelöst.",
    reset: "Schaltalgebra wurde zurückgesetzt.",
};

const STATE_PREFIX = "dhsn:quest_schaltalgebra:";
const LAMP_PROPERTY = "dhsn:schaltalgebra_lamp_on";
const LAMP_BASE_PROPERTY = "dhsn:schaltalgebra_lamp_base";
const TEST_LAYOUT_PROPERTY = "dhsn:schaltalgebra_test_layout";
const MAP_LAYOUT_PROPERTY = "dhsn:schaltalgebra_map_layout";

const RESET_COMMAND = "dhsn:quest_reset_schaltalgebra";
const STATE_COMMAND = "dhsn:quest_schaltalgebra_state";
const SOLVE_COMMAND = "dhsn:quest_schaltalgebra_solve";
const TEST_CLEAR_COMMAND = "dhsn:quest_test_schaltalgebra_clear";
const MAP_SET_COMMAND = "dhsn:schaltalgebra_set";
const MAP_SHOW_COMMAND = "dhsn:schaltalgebra_layout";
const MAP_CLEAR_COMMAND = "dhsn:schaltalgebra_layout_clear";

// Variables of /scriptevent dhsn:schaltalgebra_set and how many numbers each takes.
// 3 = one position (x y z); 6 = position plus the point the player looks at, or two corners.
const MAP_VARIABLES = {
    start_button: { numbers: [3], help: "Steinknopf auf der Lampe im Hochschulraum" },
    start_lamp: { numbers: [3], help: "Redstone-Lampe im Hochschulraum" },
    puzzle_arrival: { numbers: [3, 6], help: "Ankunft im Rätselraum (x y z), optional Blickziel (x y z)" },
    return_button: { numbers: [3], help: "Rückkehr-Knopf im Rätselraum" },
    return_arrival: { numbers: [3, 6], help: "Ankunft im Hochschulraum (x y z), optional Blickziel (x y z)" },
    target_lamp: { numbers: [3], help: "Ziel-Lampe am Ende des Rätselraums" },
    lever_1: { numbers: [3], help: "Hebel 1" },
    lever_2: { numbers: [3], help: "Hebel 2" },
    lever_3: { numbers: [3], help: "Hebel 3" },
    lever_4: { numbers: [3], help: "Hebel 4" },
    puzzle_area: { numbers: [6], help: "Rätselraum, zwei gegenüberliegende Ecken (x y z x y z)" },
};

const LIT_LAMP = "minecraft:lit_redstone_lamp";
const POWER_BLOCK = "minecraft:redstone_block";

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function chat(player, text) {
    player.sendMessage(`§e${text}`);
}

function readJson(id) {
    const value = world.getDynamicProperty(id);
    if (typeof value !== "string") return undefined;
    try {
        return JSON.parse(value);
    } catch {
        return undefined;
    }
}

/** The layout of the test setup, otherwise the one set by command blocks, otherwise LAYOUT. */
function getLayout() {
    return /** @type {Layout | undefined} */ (readJson(TEST_LAYOUT_PROPERTY)) ?? mapLayout() ?? LAYOUT;
}

// --------------------------------------------------
// LAYOUT FROM COMMAND BLOCKS (finished map)
// --------------------------------------------------

/** @returns {Record<string, any>} The variables set so far with /scriptevent dhsn:schaltalgebra_set. */
function readMapValues() {
    const values = readJson(MAP_LAYOUT_PROPERTY);
    return values && typeof values === "object" ? values : {};
}

function missingMapVariables(values) {
    return Object.keys(MAP_VARIABLES).filter((name) => !(name in values));
}

/** The layout from the command block values, or undefined while variables are missing. */
function mapLayout() {
    const values = readMapValues();
    if (missingMapVariables(values).length > 0) return undefined;
    return {
        dimension: values.dimension ?? "minecraft:overworld",
        startButton: values.start_button,
        startLamp: values.start_lamp,
        puzzleArrival: values.puzzle_arrival,
        returnButton: values.return_button,
        returnArrival: values.return_arrival,
        targetLamp: values.target_lamp,
        levers: [values.lever_1, values.lever_2, values.lever_3, values.lever_4],
        puzzleArea: values.puzzle_area,
    };
}

/**
 * Parses coordinates like in Minecraft commands: absolute numbers or "~" / "~5" relative to `origin`.
 * @returns {number[] | undefined}
 */
function parseCoordinates(tokens, origin) {
    const axes = ["x", "y", "z"];
    const numbers = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i].replace(",", ".");
        const relative = token.startsWith("~");
        const value = Number(relative ? token.slice(1) || "0" : token);
        if (!Number.isFinite(value)) return undefined;
        numbers.push(relative ? Math.floor(origin[axes[i % 3]]) + value : value);
    }
    return numbers;
}

const toVector = (n, offset = 0) => ({ x: n[offset], y: n[offset + 1], z: n[offset + 2] });
// Arrival points given as block coordinates are moved to the middle of the block.
const toBlockCenter = (v) => ({ x: Number.isInteger(v.x) ? v.x + 0.5 : v.x, y: v.y, z: Number.isInteger(v.z) ? v.z + 0.5 : v.z });

/**
 * Handles /scriptevent dhsn:schaltalgebra_set <variable> <coordinates>.
 * @returns {string} Feedback for the chat.
 */
function setMapVariable(message, origin, dimensionId) {
    const [name, ...tokens] = message.trim().split(/\s+/);
    const variable = MAP_VARIABLES[name];
    if (!variable) return `Unbekannte Variable „${name ?? ""}“. Möglich: ${Object.keys(MAP_VARIABLES).join(", ")}`;
    if (!variable.numbers.includes(tokens.length)) return `${name} braucht ${variable.numbers.join(" oder ")} Zahlen: ${variable.help}`;

    const numbers = parseCoordinates(tokens, origin);
    if (!numbers) return `${name}: Koordinaten nicht lesbar. Erlaubt sind Zahlen und ~ / ~5 (relativ zum Befehlsblock).`;

    let value;
    if (name === "puzzle_area") {
        value = { from: toVector(numbers, 0), to: toVector(numbers, 3) };
    } else if (name === "puzzle_arrival" || name === "return_arrival") {
        value = { location: toBlockCenter(toVector(numbers, 0)), facing: numbers.length === 6 ? toBlockCenter(toVector(numbers, 3)) : undefined };
    } else {
        value = toVector(numbers, 0);
    }

    const values = readMapValues();
    values[name] = value;
    values.dimension = dimensionId;
    world.setDynamicProperty(MAP_LAYOUT_PROPERTY, JSON.stringify(values));

    const missing = missingMapVariables(values);
    return `Schaltalgebra: ${name} = ${numbers.join(" ")}. ${missing.length === 0 ? "Alle Variablen gesetzt, die Quest ist aktiv." : `Es fehlen noch: ${missing.join(", ")}`}`;
}

function describeMapVariables() {
    const values = readMapValues();
    const lines = Object.keys(MAP_VARIABLES).map((name) => `${name}: ${name in values ? JSON.stringify(values[name]) : "fehlt"}`);
    if (readJson(TEST_LAYOUT_PROPERTY)) lines.push("Achtung: Ein Test-Layout ist gespeichert und hat Vorrang (/scriptevent dhsn:quest_test_schaltalgebra_clear).");
    return lines;
}

function getDimension(layout) {
    return world.getDimension(layout.dimension ?? "minecraft:overworld");
}

function below(location) {
    return { x: location.x, y: location.y - 1, z: location.z };
}

function hasItem(player, typeId) {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return false;
    for (let slot = 0; slot < inventory.size; slot++) {
        if (inventory.getItem(slot)?.typeId === typeId) return true;
    }
    return false;
}

// --------------------------------------------------
// STATE
// --------------------------------------------------

/** @typedef {{ status: "started" | "done" }} QuestState */

/** @returns {QuestState | undefined} */
function readState(player) {
    return readJson(`${STATE_PREFIX}${player.id}`);
}

/** @param {QuestState | undefined} state */
function writeState(player, state) {
    world.setDynamicProperty(`${STATE_PREFIX}${player.id}`, state ? JSON.stringify(state) : undefined);
}

// --------------------------------------------------
// LAMP IN THE LECTURE ROOM
// --------------------------------------------------

/**
 * Switches the lamp in the lecture room on or off for good. On: a redstone block below the lamp
 * powers it. Off: the block that was there before comes back.
 * Everything that switches the lamp goes through here, so a different lamp (e.g. the LED tube,
 * see the plan) would only change this function.
 */
function setStartLamp(on) {
    const layout = getLayout();
    if (!layout) return;

    try {
        const dimension = getDimension(layout);
        const location = below(layout.startLamp);
        const block = dimension.getBlock(location);
        if (!block) return;

        if (on) {
            if (block.typeId !== POWER_BLOCK) world.setDynamicProperty(LAMP_BASE_PROPERTY, block.typeId);
            block.setType(POWER_BLOCK);
        } else if (block.typeId === POWER_BLOCK) {
            const base = world.getDynamicProperty(LAMP_BASE_PROPERTY);
            block.setType(typeof base === "string" ? base : "minecraft:stone");
        }
        world.setDynamicProperty(LAMP_PROPERTY, on);
    } catch (error) {
        console.warn(`[schaltalgebra] Could not switch the lamp: ${error}`);
    }
}

// --------------------------------------------------
// QUESTLOG
// --------------------------------------------------

// The questlog is shared by all players, so every player gets an own entry.
const questlogEntries = new Map();
// Players who solved the puzzle and are still in the puzzle room: their line is shown green.
const solvedInRoom = new Set();

function updateQuestlog(player) {
    const state = readState(player);
    const existing = questlogEntries.get(player.id);
    const show = state?.status === "started" || solvedInRoom.has(player.id);
    if (!show) {
        if (existing) questlog.removeEntry(existing);
        questlogEntries.delete(player.id);
        return;
    }

    const line = state?.status === "done" ? `§a${TEXTS.objective}§r` : TEXTS.objective;
    const title = world.getAllPlayers().length > 1 ? `${TEXTS.questTitle} (${player.name})` : TEXTS.questTitle;
    if (existing) {
        existing.title = title;
        existing.lines = [line];
    } else {
        questlogEntries.set(player.id, questlog.createEntry({ title, lines: [line], order: 3 }));
    }
}

// --------------------------------------------------
// TELEPORTS
// --------------------------------------------------

// Players whose teleport is under way; further button presses are ignored meanwhile.
const teleporting = new Set();

/** Fades the screen out and back in and teleports the player while it is black. */
function teleportWithFade(player, target, layout) {
    teleporting.add(player.id);
    try {
        player.camera.fade({ fadeColor: { red: 0, green: 0, blue: 0 }, fadeTime: { fadeInTime: 0.3, holdTime: 0.4, fadeOutTime: 0.3 } });
    } catch {
        // Fading is only decoration.
    }
    return new Promise((resolve) => {
        system.runTimeout(() => {
            try {
                const options = { dimension: getDimension(layout) };
                if (target.facing) options.facingLocation = target.facing;
                player.teleport(target.location, options);
            } catch (error) {
                console.warn(`[schaltalgebra] Teleport failed: ${error}`);
            }
            teleporting.delete(player.id);
            resolve(undefined);
        }, 8);
    });
}

function resetLevers(layout) {
    const dimension = getDimension(layout);
    for (const location of layout.levers) {
        try {
            const block = dimension.getBlock(location);
            if (block?.typeId === "minecraft:lever") block.setPermutation(block.permutation.withState("open_bit", false));
        } catch {
            // Lever not loaded or missing.
        }
    }
}

function enterPuzzleRoom(player, layout) {
    if (REQUIRED_ITEM && !hasItem(player, REQUIRED_ITEM)) {
        chat(player, TEXTS.needsItem);
        return;
    }

    teleporting.add(player.id);
    // Wait until the brief light of the lamp was visible, then teleport.
    system.runTimeout(async () => {
        resetLevers(layout);
        await teleportWithFade(player, layout.puzzleArrival, layout);
        if (!readState(player)) writeState(player, { status: "started" });
        updateQuestlog(player);
        chat(player, TEXTS.arrived);
    }, TELEPORT_DELAY);
}

async function leavePuzzleRoom(player, layout) {
    await teleportWithFade(player, layout.returnArrival, layout);
    solvedInRoom.delete(player.id);
    updateQuestlog(player);
}

world.afterEvents.buttonPush.subscribe(({ block, source }) => {
    if (source?.typeId !== "minecraft:player") return;
    const player = /** @type {import("@minecraft/server").Player} */ (source);
    if (teleporting.has(player.id)) return;

    const layout = getLayout();
    if (!layout || block.dimension.id !== layout.dimension) return;

    if (isSameBlock(layout.startButton, block.location)) enterPuzzleRoom(player, layout);
    else if (isSameBlock(layout.returnButton, block.location)) leavePuzzleRoom(player, layout);
});

// --------------------------------------------------
// PUZZLE
// --------------------------------------------------

function solve(player) {
    const state = readState(player);
    if (state?.status === "done") {
        chat(player, TEXTS.solvedAgain);
        return;
    }

    writeState(player, { status: "done" });
    solvedInRoom.add(player.id);
    updateQuestlog(player);
    chat(player, TEXTS.solved);
    addEcts(player, QUEST_ECTS);
    setStartLamp(true);
}

// Remembers whether the target lamp was lit at the last check, so "solved again" is said once per lighting.
const lampWasLit = new Map();

system.runInterval(() => {
    const layout = getLayout();
    if (!layout) return;

    const area = createArea(layout.puzzleArea.from, layout.puzzleArea.to);
    let lit = false;
    try {
        lit = getDimension(layout).getBlock(layout.targetLamp)?.typeId === LIT_LAMP;
    } catch {
        return; // Puzzle room not loaded.
    }

    for (const player of world.getAllPlayers()) {
        const inside = player.dimension.id === layout.dimension && isInArea(area, player.location);
        const wasLit = lampWasLit.get(player.id) ?? false;
        lampWasLit.set(player.id, inside && lit);
        if (inside && lit && !wasLit && !teleporting.has(player.id)) solve(player);
    }
}, CHECK_INTERVAL);

// --------------------------------------------------
// WORLD LOAD, JOIN, COMMANDS
// --------------------------------------------------

// The redstone block below the lamp is part of the world, but restore it if it got lost.
world.afterEvents.worldLoad.subscribe(() => {
    if (world.getDynamicProperty(LAMP_PROPERTY) === true) setStartLamp(true);
});

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (initialSpawn) updateQuestlog(player);
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    const entry = questlogEntries.get(playerId);
    if (entry) questlog.removeEntry(entry);
    questlogEntries.delete(playerId);
    solvedInRoom.delete(playerId);
    teleporting.delete(playerId);
    lampWasLit.delete(playerId);
});

/**
 * Saves the layout of the test setup in the world; it takes precedence over LAYOUT.
 * @param {Layout} layout
 */
export function setSchaltalgebraTestLayout(layout) {
    world.setDynamicProperty(TEST_LAYOUT_PROPERTY, JSON.stringify(layout));
}

/** @returns {boolean} Whether the lamp in the lecture room is switched on for good. */
export function isStartLampOn() {
    return world.getDynamicProperty(LAMP_PROPERTY) === true;
}

// Setting up the finished map: works from command blocks (no player needed). Feedback goes to the chat
// of everyone in the world, so it is visible when the command block is triggered.
system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity, sourceBlock }) => {
    if (![MAP_SET_COMMAND, MAP_SHOW_COMMAND, MAP_CLEAR_COMMAND].includes(id)) return;

    const origin = sourceBlock?.location ?? sourceEntity?.location ?? { x: 0, y: 0, z: 0 };
    const dimensionId = sourceBlock?.dimension.id ?? sourceEntity?.dimension.id ?? "minecraft:overworld";
    /** @type {string[]} */
    let lines;
    switch (id) {
        case MAP_SET_COMMAND:
            lines = [setMapVariable(message, origin, dimensionId)];
            break;
        case MAP_SHOW_COMMAND:
            lines = describeMapVariables();
            break;
        default:
            world.setDynamicProperty(MAP_LAYOUT_PROPERTY, undefined);
            lines = ["Schaltalgebra: alle Variablen der Map gelöscht."];
    }
    for (const line of lines) world.sendMessage(`§e${line}`);
});

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
    if (![RESET_COMMAND, STATE_COMMAND, SOLVE_COMMAND, TEST_CLEAR_COMMAND].includes(id)) return;
    if (sourceEntity?.typeId !== "minecraft:player") return;
    const player = /** @type {import("@minecraft/server").Player} */ (sourceEntity);

    switch (id) {
        case RESET_COMMAND:
            writeState(player, undefined);
            solvedInRoom.delete(player.id);
            updateQuestlog(player);
            setStartLamp(false);
            chat(player, TEXTS.reset);
            break;
        case STATE_COMMAND: {
            const state = readState(player);
            chat(player, `Schaltalgebra: ${state?.status ?? "nicht begonnen"}, Lampe im Hochschulraum: ${isStartLampOn() ? "an" : "aus"}`);
            chat(player, getLayout() ? "Layout: gesetzt" : "Layout: fehlt (Testaufbau oder LAYOUT im Code)");
            break;
        }
        case SOLVE_COMMAND:
            solve(player);
            break;
        case TEST_CLEAR_COMMAND:
            world.setDynamicProperty(TEST_LAYOUT_PROPERTY, undefined);
            chat(player, "Test-Layout der Schaltalgebra gelöscht. Es gilt wieder LAYOUT aus dem Code.");
            break;
    }
});
