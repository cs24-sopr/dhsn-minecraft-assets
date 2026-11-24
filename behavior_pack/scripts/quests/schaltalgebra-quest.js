import { system, world } from "@minecraft/server";
import { addEcts, getEcts, MAX_ECTS } from "../ects.js";
import { createArea, isInArea, isSameBlock } from "../events/area.js";
import { questlog } from "../questlog.js";
import { commandSource, parseCoordinates, toVector } from "../util/command-coordinates.js";
import { keepOnCleanup, parseJson, takeOverPerPlayerValue } from "../util/storage.js";

// Quest "Schaltalgebra" (project#173):
// 1. In a lecture room there is a redstone lamp with a stone button on top. Pressing the button
//    makes the lamp light up briefly (vanilla redstone), then the player is teleported into a
//    closed puzzle room. A student ID is required.
// 2. In the puzzle room the player sets four levers of a fixed redstone circuit. The circuit is
//    built by the building team (project#174); this script does not know the logic. The puzzle is
//    solved as soon as the target lamp at the end of the room lights up.
// 3. Solved: ECTS (once), the questlog line turns green, and the lamp in the lecture room stays lit.
// 4. A return button teleports the player back at any time; the puzzle can be tried again.
//
// The game is single player: the progress is stored once per world. Steps that belong together
// (quest done, ECTS given, lamp on) are checked again regularly and completed if one of them got
// lost, e.g. because the game was closed in between or the lamp was not loaded.
// Documentation: docs/quests/schaltalgebra-quest.md

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

// Ticks after the levers were switched off before the target lamp is checked, so the circuit
// can settle and a lamp that was still lit from before does not count as a solution.
const SETTLE_TICKS = 10;

// How often the target lamp is checked while the player is in the puzzle room, in ticks.
const CHECK_INTERVAL = 5;

// How often unfinished completion steps (ECTS, lamp) are checked and repaired, in ticks.
const RECONCILE_INTERVAL = 40;

// Placeholder texts until the story team delivers the real ones. All chat output is yellow.
const TEXTS = {
    questTitle: "Schaltalgebra",
    objective: "Löse das Rätsel der Schaltalgebra",
    needsItem: "Ohne Studierendenausweis kommst du hier nicht weiter.",
    arrived: "Stell die vier Schalter so ein, dass die Lampe am Ende des Raumes leuchtet. Mit dem Knopf kommst du jederzeit zurück.",
    teleportFailed: "Der Teleport hat nicht geklappt. Versuch es noch einmal.",
    solved: "Die Lampe leuchtet! Du hast das Rätsel der Schaltalgebra gelöst.",
    solvedAgain: "Die Lampe leuchtet wieder. Das Rätsel hattest du schon gelöst.",
    reset: "Schaltalgebra wurde zurückgesetzt.",
};

// Saved in the world, once per world (single player). Older versions used
// "dhsn:quest_schaltalgebra:<player id>" and a separate lamp flag; both are taken over / removed.
const STATE_PROPERTY = "dhsn:quest_schaltalgebra";
const OLD_LAMP_PROPERTY = "dhsn:schaltalgebra_lamp_on";
// The floor block below the lamp before the script replaced it; part of the map, kept by the cleanup.
const LAMP_BASE_PROPERTY = "dhsn:schaltalgebra_lamp_base";
keepOnCleanup(LAMP_BASE_PROPERTY);
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
    return parseJson(id, world.getDynamicProperty(id));
}

/** The layout of the test setup, otherwise the one set by command blocks, otherwise LAYOUT. */
function getLayout() {
    return /** @type {Layout | undefined} */ (readJson(TEST_LAYOUT_PROPERTY)) ?? mapLayout() ?? LAYOUT;
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

function isInPuzzleRoom(player, layout) {
    const area = createArea(layout.puzzleArea.from, layout.puzzleArea.to);
    return player.dimension.id === layout.dimension && isInArea(area, player.location);
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

// --------------------------------------------------
// STATE (once per world)
// --------------------------------------------------

/**
 * @typedef {object} QuestState
 * @property {"started" | "done"} status
 * @property {boolean} [rewarded] Only with "done": whether the ECTS were given. Missing ECTS are given later.
 */

/** @returns {QuestState | undefined} */
function readState() {
    // Older per-player progress: take over a finished one if there is one.
    const raw = takeOverPerPlayerValue(STATE_PROPERTY, (values) => values.find((v) => typeof v === "string" && v.includes('"done"')) ?? values[0]);
    const state = parseJson(STATE_PROPERTY, raw);
    if (!state || (state.status !== "started" && state.status !== "done")) return undefined;
    // Done states of older versions had no "rewarded"; their ECTS were given right away.
    if (state.status === "done" && state.rewarded === undefined) state.rewarded = true;
    return state;
}

/** @param {QuestState | undefined} state */
function writeState(state) {
    world.setDynamicProperty(STATE_PROPERTY, state ? JSON.stringify(state) : undefined);
}

// --------------------------------------------------
// LAMP IN THE LECTURE ROOM
// --------------------------------------------------

/**
 * Switches the lamp in the lecture room on or off for good. On: a redstone block below the lamp
 * powers it. Off: the block that was there before comes back. Whether the lamp should be on is not
 * saved separately: it is on exactly when the quest is done (see reconcile).
 * Everything that switches the lamp goes through here, so a different lamp (e.g. the LED tube,
 * see the plan) would only change this function.
 * @returns {boolean} Whether the lamp is now in the wanted state (false if not loaded).
 */
function setStartLamp(on) {
    const layout = getLayout();
    if (!layout) return false;

    try {
        const block = getDimension(layout).getBlock(below(layout.startLamp));
        if (!block) return false;

        if (on && block.typeId !== POWER_BLOCK) {
            world.setDynamicProperty(LAMP_BASE_PROPERTY, block.typeId);
            block.setType(POWER_BLOCK);
        } else if (!on && block.typeId === POWER_BLOCK) {
            const base = world.getDynamicProperty(LAMP_BASE_PROPERTY);
            block.setType(typeof base === "string" ? base : "minecraft:stone");
        }
        return true;
    } catch (error) {
        console.warn(`[schaltalgebra] Could not switch the lamp: ${error}`);
        return false;
    }
}

/** @returns {boolean | undefined} Whether the lamp is powered; undefined if it is not loaded. */
function isStartLampOn() {
    const layout = getLayout();
    if (!layout) return undefined;
    try {
        const block = getDimension(layout).getBlock(below(layout.startLamp));
        return block ? block.typeId === POWER_BLOCK : undefined;
    } catch {
        return undefined;
    }
}

// --------------------------------------------------
// QUESTLOG
// --------------------------------------------------

/** @type {any} The entry of this quest in the shared questlog, if shown. */
let questlogEntry;

/**
 * Shown while the quest is started, and green while the quest is done and the player is still in
 * the puzzle room. Derived from the saved state and the player's position, so it is right after
 * a reload as well.
 */
function updateQuestlog(player) {
    const state = readState();
    const layout = getLayout();
    const inRoom = layout ? isInPuzzleRoom(player, layout) : false;
    const show = state?.status === "started" || (state?.status === "done" && inRoom);

    if (!show) {
        if (questlogEntry) questlog.removeEntry(questlogEntry);
        questlogEntry = undefined;
        return;
    }

    const lines = [state?.status === "done" ? `§a${TEXTS.objective}§r` : TEXTS.objective];
    if (questlogEntry) {
        questlogEntry.lines = lines;
    } else {
        questlogEntry = questlog.createEntry({ title: TEXTS.questTitle, lines, order: 3 });
    }
}

// --------------------------------------------------
// COMPLETION (with repair of lost steps)
// --------------------------------------------------

/**
 * Gives the ECTS once. "rewarded" is only saved if the ECTS count really went up (or was already
 * full), so a failed attempt is repeated later and a successful one is never repeated.
 */
function giveReward(player) {
    const state = readState();
    if (state?.status !== "done" || state.rewarded) return;

    const before = getEcts(player);
    try {
        addEcts(player, QUEST_ECTS);
    } catch (error) {
        console.warn(`[schaltalgebra] Could not give the ECTS: ${error}`);
    }
    if (getEcts(player) > before || before >= MAX_ECTS) writeState({ status: "done", rewarded: true });
}

/**
 * Completes steps that should have happened but are missing (ECTS, lamp on), and keeps the lamp in
 * the lecture room equal to the quest state: on exactly when the quest is done. So the lamp also
 * goes off again after the progress was deleted (reset, /scriptevent dhsn:map_cleanup).
 */
function reconcile() {
    const state = readState();
    const done = state?.status === "done";

    const player = world.getAllPlayers()[0];
    if (done && player && !state.rewarded) giveReward(player);

    const lampOn = isStartLampOn();
    if (lampOn !== undefined && lampOn !== done) setStartLamp(done);
}

/** @param {{ force?: boolean }} [options] force: solve without a started quest (test command). */
function solve(player, options = {}) {
    const state = readState();
    if (state?.status === "done") {
        chat(player, TEXTS.solvedAgain);
        return;
    }
    if (state?.status !== "started" && !options.force) return;

    // First the state, so nothing is lost; ECTS and lamp follow and are repaired by reconcile if needed.
    writeState({ status: "done", rewarded: false });
    chat(player, TEXTS.solved);
    giveReward(player);
    setStartLamp(true);
    updateQuestlog(player);
}

// --------------------------------------------------
// TELEPORTS AND ARRIVAL
// --------------------------------------------------

// Whether a teleport is under way; further button presses are ignored meanwhile.
let teleporting = false;
// Tick from which the target lamp may count as a solution; undefined = not armed.
/** @type {number | undefined} */
let armedFrom;

/**
 * Fades the screen out and back in and teleports the player while it is black.
 * @returns {Promise<boolean>} Whether the player arrived at the target.
 */
function teleportWithFade(player, target, layout) {
    try {
        player.camera.fade({ fadeColor: { red: 0, green: 0, blue: 0 }, fadeTime: { fadeInTime: 0.3, holdTime: 0.4, fadeOutTime: 0.3 } });
    } catch {
        // Fading is only decoration.
    }
    return new Promise((resolve) => {
        system.runTimeout(() => {
            try {
                /** @type {import("@minecraft/server").TeleportOptions} */
                const options = { dimension: getDimension(layout) };
                if (target.facing) options.facingLocation = target.facing;
                player.teleport(target.location, options);
                const { x, y, z } = player.location;
                const distance = Math.hypot(x - target.location.x, y - target.location.y, z - target.location.z);
                resolve(distance < 3);
            } catch (error) {
                console.warn(`[schaltalgebra] Teleport failed: ${error}`);
                resolve(false);
            }
        }, 8);
    });
}

/**
 * Called when the player is in the puzzle room (after the teleport, or after joining there):
 * switches the levers off now that the room is loaded, and only checks the target lamp after the
 * circuit had time to settle.
 */
function arrive(layout) {
    const dimension = getDimension(layout);
    for (const location of layout.levers) {
        try {
            const block = dimension.getBlock(location);
            if (block?.typeId === "minecraft:lever") block.setPermutation(block.permutation.withState("open_bit", false));
        } catch {
            // Lever not loaded or missing.
        }
    }
    armedFrom = system.currentTick + SETTLE_TICKS;
    // The first check after settling only records whether the lamp is lit; only a change from off
    // to on counts. So a lamp that is still lit from before (e.g. the levers could not be switched
    // off) is not taken for a solution.
    baselinePending = true;
}

function enterPuzzleRoom(player, layout) {
    if (REQUIRED_ITEM && !hasItem(player, REQUIRED_ITEM)) {
        chat(player, TEXTS.needsItem);
        return;
    }

    teleporting = true;
    // Wait until the brief light of the lamp was visible, then teleport.
    system.runTimeout(async () => {
        const arrived = await teleportWithFade(player, layout.puzzleArrival, layout);
        teleporting = false;
        if (!arrived) {
            chat(player, TEXTS.teleportFailed);
            return;
        }
        if (!readState()) writeState({ status: "started" });
        arrive(layout);
        wasInRoom = true;
        updateQuestlog(player);
        chat(player, TEXTS.arrived);
    }, TELEPORT_DELAY);
}

async function leavePuzzleRoom(player, layout) {
    teleporting = true;
    armedFrom = undefined;
    await teleportWithFade(player, layout.returnArrival, layout);
    teleporting = false;
    wasInRoom = false;
    updateQuestlog(player);
}

world.afterEvents.buttonPush.subscribe(({ block, source }) => {
    if (source?.typeId !== "minecraft:player" || teleporting) return;
    const player = /** @type {import("@minecraft/server").Player} */ (source);

    const layout = getLayout();
    if (!layout || block.dimension.id !== layout.dimension) return;

    if (isSameBlock(layout.startButton, block.location)) enterPuzzleRoom(player, layout);
    else if (isSameBlock(layout.returnButton, block.location)) leavePuzzleRoom(player, layout);
});

// --------------------------------------------------
// PUZZLE DETECTION
// --------------------------------------------------

// Whether the target lamp was lit at the last check: only a change from off to on counts.
let lampWasLit = false;
// Whether the next check after arriving only records the lamp state (see arrive).
let baselinePending = false;
// Whether the player was in the puzzle room at the last check, to notice joining inside or leaving.
let wasInRoom = false;

system.runInterval(() => {
    const layout = getLayout();
    const player = world.getAllPlayers()[0];
    if (!layout || !player || teleporting) return;

    const inRoom = isInPuzzleRoom(player, layout);
    if (inRoom !== wasInRoom) {
        wasInRoom = inRoom;
        // E.g. joined the world inside the puzzle room: switch the levers off and settle, like on arrival.
        if (inRoom && armedFrom === undefined) arrive(layout);
        if (!inRoom) armedFrom = undefined;
        updateQuestlog(player);
    }
    if (!inRoom || armedFrom === undefined || system.currentTick < armedFrom) return;

    let lit;
    try {
        lit = getDimension(layout).getBlock(layout.targetLamp)?.typeId === LIT_LAMP;
    } catch {
        return; // Puzzle room not loaded.
    }
    if (baselinePending) {
        baselinePending = false;
        lampWasLit = lit;
        return;
    }
    if (lit && !lampWasLit) solve(player);
    lampWasLit = lit;
}, CHECK_INTERVAL);

// Repair lost completion steps regularly.
system.runInterval(reconcile, RECONCILE_INTERVAL);

// --------------------------------------------------
// WORLD LOAD, JOIN, COMMANDS
// --------------------------------------------------

world.afterEvents.worldLoad.subscribe(() => {
    // The lamp flag of older versions is no longer needed; the lamp follows the quest state.
    world.setDynamicProperty(OLD_LAMP_PROPERTY, undefined);
    reconcile();
});

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!initialSpawn) return;
    // Let the detection loop look at the position fresh (joined inside the room -> arrive again).
    wasInRoom = false;
    armedFrom = undefined;
    updateQuestlog(player);
});

/**
 * Saves the layout of the test setup in the world; it takes precedence over the map values and LAYOUT.
 * @param {Layout} layout
 */
export function setSchaltalgebraTestLayout(layout) {
    world.setDynamicProperty(TEST_LAYOUT_PROPERTY, JSON.stringify(layout));
}

// Setting up the finished map: works from command blocks (no player needed). Feedback goes to the chat
// of everyone in the world, so it is visible when the command block is triggered.
system.afterEvents.scriptEventReceive.subscribe((event) => {
    const { id, message } = event;
    if (![MAP_SET_COMMAND, MAP_SHOW_COMMAND, MAP_CLEAR_COMMAND].includes(id)) return;

    const { origin, dimensionId } = commandSource(event);
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
            writeState(undefined);
            setStartLamp(false);
            updateQuestlog(player);
            chat(player, TEXTS.reset);
            break;
        case STATE_COMMAND: {
            const state = readState();
            const status = state ? `${state.status}${state.status === "done" ? (state.rewarded ? ", ECTS vergeben" : ", ECTS ausstehend") : ""}` : "nicht begonnen";
            const lamp = isStartLampOn();
            chat(player, `Schaltalgebra: ${status}, Lampe im Hochschulraum: ${lamp === undefined ? "nicht geladen" : lamp ? "an" : "aus"}`);
            chat(player, getLayout() ? "Layout: gesetzt" : "Layout: fehlt (Testaufbau, Befehlsblöcke oder LAYOUT im Code)");
            break;
        }
        case SOLVE_COMMAND:
            solve(player, { force: true });
            break;
        case TEST_CLEAR_COMMAND:
            world.setDynamicProperty(TEST_LAYOUT_PROPERTY, undefined);
            chat(player, "Test-Layout der Schaltalgebra gelöscht. Es gelten wieder die Map-Werte oder LAYOUT aus dem Code.");
            break;
    }
});
