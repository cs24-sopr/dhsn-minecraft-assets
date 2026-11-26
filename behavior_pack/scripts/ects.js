import { system, world } from "@minecraft/server";
import { takeOverPerPlayerValue } from "./util/storage.js";

// ECTS as experience levels (project#121): 1 ECTS = 1 level, at most 180 in the whole game.
//
// The real ECTS count is stored in the world (the map), once per world because the game is single
// player: "dhsn:ects". The player's experience level only displays it: a sync sets the level
// back to the ECTS count whenever something else changed it (XP from mobs, /xp, death).
//
// Quests give ECTS with addEcts(player, amount). Command blocks of the map can use
//   /scriptevent dhsn:ects_add <n>
// which goes through addEcts as well, so the limit cannot be bypassed.
//
// The title ("Erstie", "Fortgeschritten", ...) is shown in a label above the XP bar
// (resource_pack/ui/hud_screen.json). The script sends it through the title channel with the
// prefix "ects:"; the HUD shows such titles in the label and hides them in the middle of the screen.
//
// Documentation: docs/Ects.md

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

export const MAX_ECTS = 180;

// Titles by ECTS, based on a bachelor's degree: 180 ECTS = 3 study years of 60 ECTS.
// Each entry applies from `from` ECTS on; keep the list sorted by `from`.
const TITLES = [
    { from: 0, title: "Erstie" },
    { from: 60, title: "Fortgeschritten" },
    { from: 120, title: "bald fertig!" },
    { from: 180, title: "Abschluss 😄" },
];

// Prefix of the titles meant for the HUD label. Must match "$update_string" in hud_screen.json.
const HUD_PREFIX = "ects:";

// How often the experience level is checked against the ECTS count, in ticks.
const SYNC_INTERVAL = 20;

const TEXTS = {
    hudLabel: (title, ects) => `${title} · ${ects} ECTS`,
    gained: (amount, ects) => `+${amount} ECTS (jetzt ${ects}/${MAX_ECTS})`,
    capped: (lost) => `Du hast schon alle ${MAX_ECTS} ECTS. ${lost} ECTS verfallen.`,
    full: `Du hast schon alle ${MAX_ECTS} ECTS.`,
    status: (title, ects) => `${title}: ${ects}/${MAX_ECTS} ECTS`,
    newTitleSubtitle: (ects) => `${ects} ECTS`,
};

// Stored once per world: the game is single player. Older versions used "dhsn:ects:<player id>";
// such values are taken over (the highest, if there are several).
const PROPERTY = "dhsn:ects";
const SHOW_COMMAND = "dhsn:ects";
const ADD_COMMAND = "dhsn:ects_add";
const SET_COMMAND = "dhsn:ects_set";
const RESET_COMMAND = "dhsn:ects_reset";

// --------------------------------------------------
// ECTS COUNT
// --------------------------------------------------

function chat(player, text) {
    player.sendMessage(`§e${text}`);
}

function clamp(value) {
    return Math.max(0, Math.min(MAX_ECTS, Math.floor(value)));
}

/** The player parameter is kept so quests do not need to change if this ever becomes per player again. */
function propertyId(player) {
    return PROPERTY;
}

/**
 * @param {import("@minecraft/server").Player} player
 * @returns {number} The player's ECTS, 0 if none were given yet.
 */
export function getEcts(player) {
    const value = takeOverPerPlayerValue(propertyId(player), (values) => {
        const numbers = values.filter((v) => typeof v === "number");
        return numbers.length > 0 ? Math.max(...numbers) : undefined;
    });
    return typeof value === "number" ? clamp(value) : 0;
}

/**
 * @param {number} ects
 * @returns {string} The title for this ECTS count.
 */
export function getTitle(ects) {
    let title = TITLES[0].title;
    for (const entry of TITLES) {
        if (ects >= entry.from) title = entry.title;
    }
    return title;
}

/**
 * Sets the ECTS count (limited to 0–MAX_ECTS) and updates level, HUD label and title.
 * Meant for tests; quests use addEcts.
 * @param {import("@minecraft/server").Player} player
 * @param {number} value
 * @returns {number} The new ECTS count.
 */
export function setEcts(player, value) {
    const before = getEcts(player);
    const after = clamp(value);
    world.setDynamicProperty(propertyId(player), after);
    syncLevel(player);
    showHudLabel(player);
    if (getTitle(before) !== getTitle(after)) showNewTitle(player, after);
    return after;
}

/**
 * Gives the player ECTS, at most up to MAX_ECTS. ECTS above the limit are lost.
 * Writes a yellow chat line, updates level and HUD label and shows a new title if it changed.
 * @param {import("@minecraft/server").Player} player
 * @param {number} amount Positive number of ECTS.
 * @returns {number} How many ECTS were actually given.
 */
export function addEcts(player, amount) {
    const requested = Math.max(0, Math.floor(amount));
    const before = getEcts(player);
    const after = setEcts(player, before + requested);
    const given = after - before;

    if (given > 0) chat(player, TEXTS.gained(given, after));
    if (given < requested) chat(player, given === 0 ? TEXTS.full : TEXTS.capped(requested - given));
    return given;
}

// --------------------------------------------------
// DISPLAY
// --------------------------------------------------

/** Sets the experience level to the ECTS count; removes any other XP. */
function syncLevel(player) {
    const ects = getEcts(player);
    if (player.level === ects && player.xpEarnedAtCurrentLevel === 0) return;
    player.resetLevel();
    if (ects > 0) player.addLevels(ects);
}

/**
 * Sends "Title · N ECTS" to the label above the XP bar. The HUD keeps the last such title,
 * so it only has to be sent after a change and when the player joins.
 */
function showHudLabel(player) {
    const ects = getEcts(player);
    player.onScreenDisplay.setTitle(`${HUD_PREFIX}${TEXTS.hudLabel(getTitle(ects), ects)}`, {
        fadeInDuration: 0,
        stayDuration: 1,
        fadeOutDuration: 0,
    });
}

/** Shows a new title big in the middle of the screen, a little after the HUD label update. */
function showNewTitle(player, ects) {
    // Wait a few ticks: a title sent in the same tick would replace the HUD label title
    // before the HUD has seen it.
    system.runTimeout(() => {
        try {
            player.onScreenDisplay.setTitle(getTitle(ects), {
                subtitle: TEXTS.newTitleSubtitle(ects),
                fadeInDuration: 10,
                stayDuration: 60,
                fadeOutDuration: 20,
            });
            player.dimension.playSound("random.levelup", player.location);
        } catch {
            // The player left in the meantime.
        }
    }, 5);
}

// --------------------------------------------------
// EVENTS AND COMMANDS
// --------------------------------------------------

// Keep the level equal to the ECTS count (XP from mobs, /xp, death ...).
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        try {
            syncLevel(player);
        } catch {
            // The player may be leaving.
        }
    }
}, SYNC_INTERVAL);

// After joining or respawning: level and HUD label. The HUD forgets the label when the world is
// opened again, so it is sent again; the delay gives the HUD time to load.
world.afterEvents.playerSpawn.subscribe(({ player }) => {
    system.runTimeout(() => {
        try {
            syncLevel(player);
            showHudLabel(player);
        } catch {
            // The player left in the meantime.
        }
    }, 40);
});

/** Players a command applies to: the player who ran it, otherwise (command block) everyone online. */
function commandTargets(sourceEntity) {
    if (sourceEntity?.typeId === "minecraft:player") return [/** @type {import("@minecraft/server").Player} */ (sourceEntity)];
    return world.getAllPlayers();
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    if (![SHOW_COMMAND, ADD_COMMAND, SET_COMMAND, RESET_COMMAND].includes(id)) return;

    const raw = message.trim();
    const number = raw === "" ? NaN : Number(raw);
    for (const player of commandTargets(sourceEntity)) {
        switch (id) {
            case SHOW_COMMAND: {
                const ects = getEcts(player);
                chat(player, TEXTS.status(getTitle(ects), ects));
                break;
            }
            case ADD_COMMAND:
                if (!(number > 0)) {
                    chat(player, `Aufruf: /scriptevent ${ADD_COMMAND} <Anzahl>`);
                    break;
                }
                addEcts(player, number);
                break;
            case SET_COMMAND:
                if (!(number >= 0)) {
                    chat(player, `Aufruf: /scriptevent ${SET_COMMAND} <Anzahl>`);
                    break;
                }
                chat(player, TEXTS.status(getTitle(setEcts(player, number)), getEcts(player)));
                break;
            case RESET_COMMAND:
                setEcts(player, 0);
                chat(player, TEXTS.status(getTitle(0), 0));
                break;
        }
    }
});
