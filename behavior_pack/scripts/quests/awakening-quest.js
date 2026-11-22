import { EasingType, ItemStack, system, world } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { onBlockInteract, onEnterTerritory } from "../events/index.js";
import { questlog } from "../questlog.js";

// Quest "Das Erwachen" (ticket #106), the very first quest of the game:
// 1. The player wakes up in the start building because of an alarm clock (a note block). Switching
//    it off is optional.
// 2. Walking up to the window starts the camera ride around the university. It cannot be skipped,
//    has music and ends with the name of the university as a title.
//    The building cannot be left before the ride and the next step are done.
// 3. The player searches the chest in the room and gets a backpack and food.
// 4. The player leaves the building and steps onto the portal in front of the entrance. It teleports
//    them to the gate of the campus island, where the side quest "Gelände erkunden" starts.
// 5. The player talks to the (chaotic) professor in front of the main entrance. The quest is done.
// The progress is stored in the world, per player, so it survives /reload and restarting the world.
// Commands: see the bottom of this file. Documentation: docs/quests/awakening-quest.md
//
// The quest does not know the map yet: all places are in one LAYOUT (see CONFIGURATION). Until the map
// is ready, the test setup in events/test-awakening.js (/scriptevent dhsn:quest_test_awakening) builds a
// small scene and provides its own layout. To move the quest to the real map, fill in LAYOUT and
// delete the test setup, see "Moving the quest to the real map" in the documentation.

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

/**
 * @typedef {import("@minecraft/server").Vector3} Vector3
 * @typedef {{ from: Vector3, to: Vector3 }} Corners Two corner blocks of a box, in any order. Both belong to the box.
 */

/**
 * One station of the camera ride.
 * @typedef {object} CameraShot
 * @property {Vector3} location Where the camera is at the end of the shot.
 * @property {Vector3} facing The point the camera looks at during and after the shot.
 * @property {number} seconds How long the flight to this position takes. 0 jumps there; the first shot should always be 0.
 * @property {string} [ease] Easing of the flight, an EasingType name. Defaults to "InOutSine".
 * @property {string} [sound] Optional sound id that is played when the shot starts.
 */

/**
 * Everything the quest needs to know about the map.
 * @typedef {object} AwakeningLayout
 * @property {string} [dimension] Dimension id of everything below, defaults to "minecraft:overworld".
 * @property {Vector3} wake Where the player wakes up (feet position). Used by the start command and the test setup;
 *     in the real map, the world spawn point at the bed does this job.
 * @property {Vector3} wakeFacing The point the player looks at after waking up.
 * @property {Vector3} alarm The note block that is the alarm clock.
 * @property {Corners} window The spot in front of the window; entering it starts the camera ride.
 * @property {Vector3} chest The chest block in the room.
 * @property {Corners} building The whole start building, from the floor to above the roof. Leaving it is blocked until the chest step is done.
 * @property {Vector3} buildingReturn Where a player who left the building too early is put back (feet position).
 * @property {Corners} portal The portal in front of the entrance; entering it teleports the player.
 * @property {Vector3} islandGate Where the portal sends the player: in front of the gate of the campus island (feet position).
 * @property {Vector3} islandFacing The point the player looks at after the teleport.
 * @property {CameraShot[]} cameraPath The camera ride, shot by shot.
 */

// The places in the real map. Undefined means "not built yet": the quest then does nothing, except in a
// world where the test setup saved its own layout (see setAwakeningTestLayout), which takes precedence.
// Example (all numbers are made up):
// const LAYOUT = {
//     wake: { x: 10.5, y: 64, z: 20.5 },
//     wakeFacing: { x: 14, y: 65, z: 20 },
//     alarm: { x: 12, y: 64, z: 22 },
//     window: { from: { x: 13, y: 64, z: 19 }, to: { x: 15, y: 66, z: 20 } },
//     chest: { x: 8, y: 64, z: 25 },
//     building: { from: { x: 0, y: 63, z: 10 }, to: { x: 20, y: 80, z: 30 } },
//     buildingReturn: { x: 10.5, y: 64, z: 15.5 },
//     portal: { from: { x: 25, y: 64, z: 14 }, to: { x: 27, y: 66, z: 16 } },
//     islandGate: { x: 200.5, y: 70, z: 40.5 },
//     islandFacing: { x: 200, y: 71, z: 50 },
//     cameraPath: [
//         { location: { x: 14, y: 65.6, z: 19.4 }, facing: { x: 14, y: 65.6, z: 5 }, seconds: 0 },
//         { location: { x: 14, y: 70, z: 0 }, facing: { x: 10, y: 66, z: 20 }, seconds: 3 },
//     ],
// };
/** @type {AwakeningLayout | undefined} */
const LAYOUT = undefined;

// Start the quest automatically when a player joins the world for the first time (a player without
// progress). Needs a layout. The player is not moved; the world spawn point has to be at the bed.
const AUTO_START = true;

// Sound of the alarm clock: two beeps per second until the player switches it off or looks out of the window.
const ALARM_SOUND = "note.pling";

// Music of the camera ride: resource_pack/sounds/intro_music.ogg, defined in sound_definitions.json.
// Empty string means no music.
const INTRO_MUSIC = "dhsn.intro_music";
const INTRO_MUSIC_VOLUME = 0.8;

// What the chest hands out. Placeholder for the backpack: the bundle, until there is a backpack item of our own.
const BACKPACK_ITEM = "minecraft:bundle";
const CHEST_LOOT = [
    { item: BACKPACK_ITEM, amount: 1 },
    { item: "minecraft:bread", amount: 3 },
    { item: "minecraft:apple", amount: 2 },
];

// The professor in front of the main entrance. Any NPC entity that carries this tag is the professor,
// so the quest does not depend on which entity the build team uses. In the world:
//   /tag @e[type=dhsn:studienorganisation,r=5] add dhsn:awakening_professor
export const PROFESSOR_TAG = "dhsn:awakening_professor";

// The steps of the quest, in order. The progress of a player is one of them.
const STEPS = ["wake", "chest", "portal", "professor", "done"];

// Texts. Placeholders until the story team delivers the real dialog. All chat output is yellow (see chat()),
// so texts should not contain color codes.
const TEXTS = {
    questTitle: "Das Erwachen",
    wakeUp: "Brrrring! Brrrring! Was ist das für ein Lärm? Du blinzelst ins Morgenlicht …",
    wakeHint: "Der Wecker nervt. Vielleicht wirfst du erst einmal einen Blick aus dem Fenster.",
    objAlarm: "Wecker ausschalten",
    optional: "(optional)",
    objWindow: "Aus dem Fenster blicken",
    objChest: "Die Truhe durchsuchen",
    objPortal: "Den Teleporter benutzen",
    objSideQuest: "Nebenquest „Gelände erkunden“ gestartet",
    objProfessor: "Den Professor am Haupteingang ansprechen",
    alarmOff: "Du haust auf den Wecker. Endlich Ruhe!",
    afterRide: "Wow, das also ist deine neue Hochschule! Im Zimmer steht noch eine Truhe. Sieh mal nach, was drin ist.",
    chestLocked: "Die Truhe läuft nicht weg. Schau dich erst einmal um.",
    chestFound: "In der Truhe liegen ein Rucksack, Brot und Äpfel. Das kann nicht schaden, du packst alles ein.",
    chestEmpty: "Die Truhe ist leer.",
    // What the player thinks when walking out of the building too early, by step.
    leaveBlocked: {
        wake: "So kannst du nicht los. Schau erst einmal aus dem Fenster.",
        chest: "Ohne Rucksack und etwas zu essen willst du nicht los. Sieh erst in der Truhe nach.",
    },
    teleporting: "Der Teleporter fängt an zu summen …",
    sideQuestStarted: "Neue Nebenquest: Gelände erkunden",
    portalNotYet: "Der Teleporter reagiert noch nicht.",
    // The title at the end of the camera ride.
    universityName: "Duale Hochschule Sachsen",
    universitySubtitle: "Willkommen",
    professorName: "Chaotischer Professor",
    professorWelcome: "Huch, ein neues Gesicht! Willkommen an der Hochschule! "
        + "Entschuldige das Durcheinander, ich suche seit Tagen meine Unterlagen. Sieh dich ruhig auf dem Gelände um, "
        + "wir sehen uns sicher bald wieder.",
    professorWelcomeButton: "Danke, bis bald!",
    professorNotYet: "Na, wer bist du denn? Komm später noch einmal, ich muss hier erst Ordnung schaffen.",
    professorDone: "Du schon wieder! Hast du zufällig meine Unterlagen gesehen?",
    close: "Tschüss!",
    questFinished: (player) => `Quest abgeschlossen: ${TEXTS.questTitle} (${player.name})`,
    reset: "Das Erwachen wurde zurückgesetzt.",
    noLayout: "Kein Layout: Die Quest kennt die Karte noch nicht. Mit /scriptevent dhsn:quest_test_awakening lässt sich ein Testaufbau erstellen.",
};

// The progress of every player is stored in the world (the map), one world dynamic property per
// player: "dhsn:quest_awakening:<player id>".
const STATE_PROPERTY = "dhsn:quest_awakening";
const TEST_LAYOUT_PROPERTY = "dhsn:awakening_test_layout";

const RESET_COMMAND = "dhsn:quest_reset_awakening";
const STATE_COMMAND = "dhsn:quest_awakening_state";
const START_COMMAND = "dhsn:quest_awakening_start";
const STEP_COMMAND = "dhsn:quest_awakening_step";
const RIDE_COMMAND = "dhsn:quest_awakening_ride";
const TEST_CLEAR_COMMAND = "dhsn:quest_test_awakening_clear";

// Hook for the side quest "Gelände erkunden" (created separately). Called once when the player arrives on
// the campus island.
function startExploreCampusQuest(player) {}

// Hook for what follows the quest, e.g. "Operation Erstsemester" (#79). Called once when the quest is finished.
function onQuestFinished(player) {}

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

// All chat output of the quest is yellow.
function chat(target, text) {
    target.sendMessage(`§e${text}`);
}

function say(player, name, text) {
    chat(player, `${name}: ${text}`);
}

function readJsonProperty(owner, id) {
    const value = owner.getDynamicProperty(id);
    if (typeof value !== "string") return undefined;
    try {
        return JSON.parse(value);
    } catch {
        return undefined;
    }
}

function inventoryOf(player) {
    return player.getComponent("minecraft:inventory")?.container;
}

function giveItem(player, typeId, amount = 1) {
    const leftover = inventoryOf(player)?.addItem(new ItemStack(typeId, amount));
    if (leftover) player.dimension.spawnItem(leftover, player.location);
}

/** Runs a command for the player; ignores errors, e.g. because the player has left in the meantime. */
function runCommand(player, command) {
    try {
        player.runCommand(command);
    } catch {
        // The player may have left in the meantime.
    }
}

function playSound(player, soundId, options) {
    if (!soundId) return;
    try {
        player.playSound(soundId, options);
    } catch {
        // The player may have left in the meantime.
    }
}

/** Fades the screen to black and back. Times are in seconds. */
function fadeScreen(player, fadeInTime, holdTime, fadeOutTime) {
    try {
        player.camera.fade({
            fadeColor: { red: 0, green: 0, blue: 0 },
            fadeTime: { fadeInTime, holdTime, fadeOutTime },
        });
    } catch {
        // The player may have left in the meantime.
    }
}

function center(location) {
    return { x: Math.floor(location.x) + 0.5, y: Math.floor(location.y) + 0.5, z: Math.floor(location.z) + 0.5 };
}

function findPlayer(playerId) {
    return world.getAllPlayers().find((player) => player.id === playerId);
}

// --------------------------------------------------
// LAYOUT
// --------------------------------------------------

/**
 * The layout of the quest: the one saved by the test setup, otherwise LAYOUT.
 * @returns {AwakeningLayout | undefined}
 */
function getLayout() {
    return readJsonProperty(world, TEST_LAYOUT_PROPERTY) ?? LAYOUT;
}

function dimensionOf(layout) {
    return world.getDimension(layout.dimension ?? "minecraft:overworld");
}

// --------------------------------------------------
// QUEST STATE
// --------------------------------------------------

/**
 * @typedef {object} QuestState
 * @property {string} step One of STEPS: the step the player is working on, "done" when the quest is finished.
 * @property {boolean} [alarmOff] True if the player switched the alarm clock off.
 */

function stateKey(playerId) {
    return `${STATE_PROPERTY}:${playerId}`;
}

/** @returns {QuestState | undefined} */
function readState(playerId) {
    const state = readJsonProperty(world, stateKey(playerId));
    if (!state || typeof state !== "object" || !STEPS.includes(state.step)) return undefined;
    return state;
}

/** @param {QuestState | undefined} state */
function writeState(playerId, state) {
    world.setDynamicProperty(stateKey(playerId), state ? JSON.stringify(state) : undefined);
}

function stepIndex(state) {
    return STEPS.indexOf(state.step);
}

/** Sets the step of a player, e.g. after the player finished the previous one. */
function advanceTo(player, step) {
    const state = readState(player.id) ?? { step };
    state.step = step;
    writeState(player.id, state);
    updateQuestlog(player, state);
}

// --------------------------------------------------
// QUESTLOG
// --------------------------------------------------

// The questlog is shared by all players, so every player gets an own entry.
const questlogEntries = new Map();

/** @param {QuestState | undefined} state */
function updateQuestlog(player, state) {
    const existing = questlogEntries.get(player.id);
    if (!state || state.step === "done") {
        if (existing) questlog.removeEntry(existing);
        questlogEntries.delete(player.id);
        return;
    }

    const index = stepIndex(state);
    const done = (text) => `§a${text}§r`;
    const lines = [];
    // The alarm clock only matters at the beginning, and it is optional.
    if (index === 0) lines.push(state.alarmOff ? done(TEXTS.objAlarm) : `${TEXTS.objAlarm} ${TEXTS.optional}`);
    lines.push(index > 0 ? done(TEXTS.objWindow) : TEXTS.objWindow);
    if (index >= 1) lines.push(index > 1 ? done(TEXTS.objChest) : TEXTS.objChest);
    if (index >= 2) lines.push(index > 2 ? done(TEXTS.objPortal) : TEXTS.objPortal);
    if (index >= 3) lines.push(done(TEXTS.objSideQuest), TEXTS.objProfessor);

    let title = TEXTS.questTitle;
    if (world.getAllPlayers().length > 1) title = `${title} (${player.name})`;
    if (existing) {
        existing.title = title;
        existing.lines = lines;
    } else {
        questlogEntries.set(player.id, questlog.createEntry({ title, lines, order: 1 }));
    }
}

// --------------------------------------------------
// ALARM CLOCK
// --------------------------------------------------

/** @type {Map<string, number>} Run ids of the ringing alarm clocks, per player id. */
const alarms = new Map();

function startAlarm(player, layout) {
    stopAlarm(player.id);

    const location = center(layout.alarm);
    let beat = 0;
    const runId = system.runInterval(() => {
        try {
            // Every 2 ticks; two short beeps, then a pause: once per second.
            const phase = beat++ % 10;
            if (phase === 0 || phase === 2) player.playSound(ALARM_SOUND, { location, volume: 1.5, pitch: 2 });
        } catch {
            // The player left the world.
            stopAlarm(player.id);
        }
    }, 2);
    alarms.set(player.id, runId);
}

function stopAlarm(playerId) {
    const runId = alarms.get(playerId);
    if (runId === undefined) return;
    system.clearRun(runId);
    alarms.delete(playerId);
}

// --------------------------------------------------
// CAMERA RIDE
// --------------------------------------------------

// Ticks the free camera needs to take effect after it was set without a flight.
const CAMERA_SETTLE_TICKS = 2;
// The title at the end: fade in 20, stay 100, fade out 30 ticks.
const TITLE_TICKS = 20 + 100 + 30;

/** @type {Map<string, number[]>} Scheduled steps of the running camera rides, per player id. A ride is running while the player is in here. */
const rides = new Map();

function schedule(playerId, ticks, callback) {
    const runId = system.runTimeout(() => {
        try {
            callback();
        } catch {
            // The player left the world during the ride. The ride cleans up after itself on the next join.
        }
    }, Math.max(1, Math.round(ticks)));
    rides.get(playerId)?.push(runId);
}

function flyTo(player, shot) {
    // The first shot (or any shot without time) jumps there; the others fly there.
    const options = { location: shot.location, facingLocation: shot.facing };
    if (shot.seconds > 0) options.easeOptions = { easeTime: shot.seconds, easeType: shot.ease ?? EasingType.InOutSine };

    player.camera.setCamera("minecraft:free", options);
    playSound(player, shot.sound);
}

/**
 * Plays the camera ride: the player cannot move, the camera flies through all shots with music, the title
 * shows at the end, then the player gets control back.
 * @param {import("@minecraft/server").Player} player
 * @param {AwakeningLayout} layout
 * @param {(player: import("@minecraft/server").Player) => void} [onFinished] Called when the ride ended normally.
 * @returns {boolean} False if the player is already on a ride.
 */
function playRide(player, layout, onFinished) {
    const playerId = player.id;
    if (rides.has(playerId)) return false;
    rides.set(playerId, []);

    stopAlarm(playerId);
    runCommand(player, "inputpermission set @s movement disabled");
    runCommand(player, "hud @s hide all");
    playSound(player, INTRO_MUSIC, { volume: INTRO_MUSIC_VOLUME });

    let tick = 1;
    (layout.cameraPath ?? []).forEach((shot, index) => {
        schedule(playerId, tick, () => flyTo(player, shot));
        tick += index === 0 || shot.seconds <= 0 ? CAMERA_SETTLE_TICKS : shot.seconds * 20;
    });

    // The screen fades to black, the camera is switched off behind it, the fade lets the player see the room again.
    const fadeAt = tick + 10;
    const endAt = tick + 22;
    schedule(playerId, fadeAt, () => fadeScreen(player, 0.4, 0.1, 0.6));
    schedule(playerId, endAt, () => finishRide(playerId, true, onFinished));

    // The name of the university appears during the last part of the ride.
    schedule(playerId, endAt - TITLE_TICKS, () => {
        player.onScreenDisplay.setTitle(TEXTS.universityName, {
            subtitle: TEXTS.universitySubtitle,
            fadeInDuration: 20,
            stayDuration: 100,
            fadeOutDuration: 30,
        });
    });
    return true;
}

/**
 * Ends a ride: gives the camera, movement and HUD back and stops the music. Also used to cancel a ride.
 * @param {string} playerId
 * @param {boolean} completed True if the ride ran to its end.
 * @param {(player: import("@minecraft/server").Player) => void} [onFinished]
 */
function finishRide(playerId, completed, onFinished) {
    for (const runId of rides.get(playerId) ?? []) system.clearRun(runId);
    rides.delete(playerId);

    const player = findPlayer(playerId);
    if (!player) return;

    restorePlayer(player);
    if (completed) onFinished?.(player);
}

/** Camera, movement and HUD back to normal, no music. Safe to call at any time. */
function restorePlayer(player) {
    try {
        player.camera.clear();
    } catch {
        // The player may have left in the meantime.
    }
    runCommand(player, "inputpermission set @s movement enabled");
    runCommand(player, "hud @s reset all");
    if (INTRO_MUSIC) runCommand(player, `stopsound @s ${INTRO_MUSIC}`);
}

// --------------------------------------------------
// STEPS
// --------------------------------------------------

/**
 * Starts the quest for a player from the beginning: wake up, alarm clock rings.
 * @param {import("@minecraft/server").Player} player
 * @param {boolean} [teleport] Put the player to the wake position of the layout first. The real map does not need it,
 *     the world spawn point is at the bed.
 * @returns {boolean} False if there is no layout.
 */
export function startAwakening(player, teleport = false) {
    const layout = getLayout();
    if (!layout) return false;

    if (rides.has(player.id)) finishRide(player.id, false);
    /** @type {QuestState} */
    const state = { step: "wake", alarmOff: false };
    writeState(player.id, state);
    updateQuestlog(player, state);

    if (teleport) {
        player.teleport(layout.wake, { dimension: dimensionOf(layout), facingLocation: layout.wakeFacing });
    }

    // Waking up: the screen is black first and clears up slowly.
    fadeScreen(player, 0, 1.5, 2);
    startAlarm(player, layout);
    system.runTimeout(() => {
        chat(player, TEXTS.wakeUp);
        chat(player, TEXTS.wakeHint);
    }, 30);
    return true;
}

/** Looking out of the window: camera ride, then the next step. */
function lookOutOfWindow(player, layout) {
    playRide(player, layout, (rider) => {
        // The progress may have been reset during the ride.
        if (readState(rider.id)?.step !== "wake") return;
        advanceTo(rider, "chest");
        chat(rider, TEXTS.afterRide);
    });
}

function switchOffAlarm(player) {
    const state = readState(player.id);
    if (state?.step !== "wake" || state.alarmOff) return;

    stopAlarm(player.id);
    state.alarmOff = true;
    writeState(player.id, state);
    updateQuestlog(player, state);
    chat(player, TEXTS.alarmOff);
}

function searchChest(player, layout) {
    const state = readState(player.id);
    if (!state) return;

    const index = stepIndex(state);
    if (index < 1) {
        chat(player, TEXTS.chestLocked);
    } else if (index > 1) {
        chat(player, TEXTS.chestEmpty);
    } else {
        for (const { item, amount } of CHEST_LOOT) giveItem(player, item, amount);
        playSound(player, "random.chestopen", { location: center(layout.chest) });
        advanceTo(player, "portal");
        chat(player, TEXTS.chestFound);
    }
}

/** @type {Set<string>} Players who are being teleported right now. */
const teleporting = new Set();

function useTeleporter(player, layout) {
    const state = readState(player.id);
    if (!state || state.step !== "portal" || teleporting.has(player.id)) return;
    teleporting.add(player.id);

    chat(player, TEXTS.teleporting);
    playSound(player, "mob.endermen.portal");
    fadeScreen(player, 0.5, 0.5, 0.7);

    const playerId = player.id;
    system.runTimeout(() => {
        teleporting.delete(playerId);
        try {
            // The player may have been reset or may have left during the fade.
            if (readState(playerId)?.step !== "portal") return;

            player.teleport(layout.islandGate, { dimension: dimensionOf(layout), facingLocation: layout.islandFacing });
            advanceTo(player, "professor");
            // Arriving on the island starts the side quest.
            startExploreCampusQuest(player);
            chat(player, TEXTS.sideQuestStarted);
        } catch {
            // The player left the world.
        }
    }, 10);
}

/** A player walked out of the building: before the portal step, they are put back. */
function keepInBuilding(player, layout) {
    const state = readState(player.id);
    if (!state || rides.has(player.id) || teleporting.has(player.id)) return;

    const index = stepIndex(state);
    if (index >= 2) return;

    player.teleport(layout.buildingReturn, { dimension: dimensionOf(layout), facingLocation: layout.wakeFacing });
    chat(player, TEXTS.leaveBlocked[STEPS[index]]);
}

// --------------------------------------------------
// DIALOGS
// --------------------------------------------------

const playersInDialog = new Set();

/**
 * Shows a form and retries while the player still has another screen open,
 * e.g. right after the interaction.
 */
async function showForm(form, player) {
    for (let attempt = 0; attempt < 10; attempt++) {
        const response = await form.show(player);
        if (response.cancelationReason !== FormCancelationReason.UserBusy) return response;
        await new Promise((resolve) => system.runTimeout(() => resolve(undefined), 5));
    }
    return undefined;
}

function message(body, button) {
    return new ActionFormData().title(TEXTS.professorName).body(body).button(button);
}

async function talkToProfessor(player) {
    if (playersInDialog.has(player.id)) return;
    playersInDialog.add(player.id);

    try {
        const state = readState(player.id);
        if (state?.step === "done") {
            await showForm(message(TEXTS.professorDone, TEXTS.close), player);
        } else if (state?.step !== "professor") {
            await showForm(message(TEXTS.professorNotYet, TEXTS.close), player);
        } else {
            await showForm(message(TEXTS.professorWelcome, TEXTS.professorWelcomeButton), player);
            // The progress may have been reset while the dialog was open.
            if (readState(player.id)?.step !== "professor") return;

            advanceTo(player, "done");
            world.sendMessage(`§e${TEXTS.questFinished(player)}`);
            onQuestFinished(player);
        }
    } finally {
        playersInDialog.delete(player.id);
    }
}

// --------------------------------------------------
// LISTENERS
// --------------------------------------------------

// The listeners depend on the layout, so they are registered again whenever the layout changes.
let stopListeners = [];

function applyLayout() {
    for (const stop of stopListeners) stop();
    stopListeners = [];

    const layout = getLayout();
    if (!layout) return;

    const dimension = layout.dimension ?? "minecraft:overworld";
    stopListeners = [
        // Walking up to the window: the camera ride.
        onEnterTerritory({ ...layout.window, dimension }, ({ player }) => {
            if (readState(player.id)?.step === "wake") lookOutOfWindow(player, layout);
        }),
        // The building cannot be left too early.
        onEnterTerritory({ ...layout.building, dimension, onLeave: ({ player }) => keepInBuilding(player, layout) }, () => {}),
        // The portal.
        onEnterTerritory({ ...layout.portal, dimension }, ({ player }) => useTeleporter(player, layout)),
        // The alarm clock: a click switches it off instead of changing the pitch of the note block.
        onBlockInteract({ location: layout.alarm, dimension, cancel: true }, ({ player }) => switchOffAlarm(player)),
        // The chest: a click searches it instead of opening it.
        onBlockInteract({ location: layout.chest, dimension, cancel: true }, ({ player }) => searchChest(player, layout)),
    ];
}

// The professor is an NPC entity; cancel its default NPC screen and show our dialog instead.
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    if (!event.target.hasTag(PROFESSOR_TAG)) return;

    event.cancel = true;
    const player = event.player;
    system.run(() => talkToProfessor(player));
});

world.afterEvents.worldLoad.subscribe(() => applyLayout());

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!initialSpawn) return;

    // Left the world during a camera ride: give the camera, movement and HUD back.
    // The step was not finished, so the player can look out of the window again.
    restorePlayer(player);

    const state = readState(player.id);
    if (!state) {
        if (AUTO_START && getLayout()) startAwakening(player);
        return;
    }

    updateQuestlog(player, state);
    const layout = getLayout();
    if (layout && state.step === "wake" && !state.alarmOff) startAlarm(player, layout);
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    const entry = questlogEntries.get(playerId);
    if (entry) questlog.removeEntry(entry);
    questlogEntries.delete(playerId);
    stopAlarm(playerId);
    teleporting.delete(playerId);
    // The camera and permissions of a player who left cannot be restored; that happens on the next join.
    for (const runId of rides.get(playerId) ?? []) system.clearRun(runId);
    rides.delete(playerId);
});

// --------------------------------------------------
// TEST SETUP (used by events/test-awakening.js)
// --------------------------------------------------

/**
 * Saves the layout of the test setup in the world, so it survives /reload and restarting the world.
 * It takes precedence over LAYOUT.
 * @param {AwakeningLayout} layout
 */
export function setAwakeningTestLayout(layout) {
    world.setDynamicProperty(TEST_LAYOUT_PROPERTY, JSON.stringify(layout));
    applyLayout();
}

function clearAwakeningTestLayout() {
    world.setDynamicProperty(TEST_LAYOUT_PROPERTY, undefined);
    applyLayout();
}

/**
 * Throws away the progress of a player and everything that belongs to it: alarm, camera ride, questlog entry.
 * @param {import("@minecraft/server").Player} player
 */
export function resetAwakening(player) {
    stopAlarm(player.id);
    if (rides.has(player.id)) finishRide(player.id, false);
    writeState(player.id, undefined);
    updateQuestlog(player, undefined);
}

// --------------------------------------------------
// COMMANDS
// --------------------------------------------------

function describeState(state) {
    if (!state) return ["Kein Stand: Quest noch nicht begonnen."];

    const lines = [`Schritt: ${state.step} (${STEPS.indexOf(state.step) + 1}/${STEPS.length})`];
    if (state.step === "wake") lines.push(`Wecker: ${state.alarmOff ? "aus" : "klingelt"}`);
    const layout = getLayout();
    lines.push(layout ? `Layout: ${JSON.stringify(layout.window)} (Fenster), ${JSON.stringify(layout.portal)} (Portal)` : "Layout: nicht gesetzt");
    return lines;
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    const commands = [RESET_COMMAND, STATE_COMMAND, START_COMMAND, STEP_COMMAND, RIDE_COMMAND, TEST_CLEAR_COMMAND];
    if (!commands.includes(id) || sourceEntity?.typeId !== "minecraft:player") return;

    const player = /** @type {import("@minecraft/server").Player} */ (sourceEntity);
    const layout = getLayout();
    switch (id) {
        case RESET_COMMAND:
            resetAwakening(player);
            chat(player, TEXTS.reset);
            break;
        case STATE_COMMAND:
            for (const line of describeState(readState(player.id))) chat(player, line);
            if (rides.has(player.id)) chat(player, "Kamerafahrt läuft");
            break;
        case START_COMMAND:
            // Starts from the beginning at the wake position. Does the same as the first join in the map.
            if (!startAwakening(player, true)) chat(player, TEXTS.noLayout);
            break;
        case STEP_COMMAND: {
            // /scriptevent dhsn:quest_awakening_step <wake|chest|portal|professor|done>
            const step = message.trim();
            if (!STEPS.includes(step)) {
                chat(player, `Aufruf: /scriptevent ${STEP_COMMAND} <${STEPS.join("|")}>`);
                break;
            }
            // Jumps to a step, e.g. to test the portal without playing everything before it.
            if (rides.has(player.id)) finishRide(player.id, false);
            stopAlarm(player.id);
            advanceTo(player, step);
            if (layout && step === "wake") startAlarm(player, layout);
            chat(player, `Schritt gesetzt: ${step}`);
            break;
        }
        case RIDE_COMMAND:
            // Plays the camera ride only, without touching the progress. For adjusting the camera path.
            if (!layout) chat(player, TEXTS.noLayout);
            else if (!playRide(player, layout)) chat(player, "Die Kamerafahrt läuft schon.");
            break;
        case TEST_CLEAR_COMMAND:
            clearAwakeningTestLayout();
            chat(player, "Layout des Testaufbaus gelöscht. Es gilt wieder LAYOUT aus dem Code.");
            break;
    }
});
