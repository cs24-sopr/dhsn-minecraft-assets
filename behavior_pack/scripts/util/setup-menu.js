import { ItemLockMode, ItemStack, system, world } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";

// Shared parts of the quest setup menus (e.g. quests/awakening-setup.js, quests/library-setup.js).
// With a setup menu the places of the real map are entered in the game instead of in the code: the builder
// stands at a place, opens the menu and clicks the matching button.
//
// ONE compass "Quest-Setup" serves all quests. Each quest registers its menu with registerSetupMenu and has
// its own command that gives the compass and opens its menu directly. Right-clicking the compass opens the
// menu the player opened last; sneaking + right-click shows a choice of all registered menus.
// The places a menu sets are saved in the world by the quest. Only the last opened menu is saved on the player,
// so several builders can set up different quests at the same time.
// Documentation: docs/setup-menu.md

const ITEM_TYPE = "minecraft:compass";
const ITEM_NAME = "§bQuest-Setup §7(Rechtsklick)";

// The id of the menu the player opened last, so the compass opens it again. Saved on the player (an exception
// to "everything in the world"): every builder keeps their own. dhsn:map_cleanup does not touch it.
const LAST_MENU_PROPERTY = "dhsn:setup_menu_last";

// How far a click on "look at a block" reaches.
const LOOK_DISTANCE = 10;
// How far in front of the player a "look point" lies (a point in the view direction).
const FACING_DISTANCE = 10;

// --------------------------------------------------
// CAPTURING POSITIONS
// --------------------------------------------------

const round = (value) => Math.round(value * 100) / 100;

/** A position rounded to two decimals. */
export const vec = (v) => ({ x: round(v.x), y: round(v.y), z: round(v.z) });

/** "x y z" for messages. */
export const format = (v) => `${v.x} ${v.y} ${v.z}`;

/** ✔ or ✘ in front of a menu button. */
export const mark = (ok) => (ok ? "§a✔ §r" : "§c✘ §r");

/**
 * The block position of the player's feet.
 * @param {import("@minecraft/server").Player} player
 */
export function feetBlock(player) {
    const { x, y, z } = player.location;
    return { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) };
}

/**
 * A point some blocks in front of the player's eyes: what the camera or the player should look at.
 * @param {import("@minecraft/server").Player} player
 */
export function lookPoint(player) {
    const head = player.getHeadLocation();
    const dir = player.getViewDirection();
    return vec({ x: head.x + dir.x * FACING_DISTANCE, y: head.y + dir.y * FACING_DISTANCE, z: head.z + dir.z * FACING_DISTANCE });
}

/**
 * The block the player looks at. Returns an error text if there is none or it is not one of the allowed types.
 * @param {import("@minecraft/server").Player} player
 * @param {(typeId: string) => boolean} accepts
 * @param {string} what Name of the expected block for the error text.
 * @returns {{ location?: import("@minecraft/server").Vector3, error?: string }}
 */
export function lookedBlock(player, accepts, what) {
    const hit = player.getBlockFromViewDirection({ maxDistance: LOOK_DISTANCE });
    if (!hit) return { error: `Du schaust auf keinen Block (max. ${LOOK_DISTANCE} Blöcke). Das Menü merkt sich die Blickrichtung beim Öffnen.` };
    const block = hit.block;
    if (!accepts(block.typeId)) return { error: `Du schaust auf ${block.typeId}, erwartet: ${what}.` };
    return { location: { x: block.x, y: block.y, z: block.z } };
}

/** The maximum distance of lookedBlock, e.g. for entity look-ups of a quest. */
export const LOOK_RANGE = LOOK_DISTANCE;

/**
 * A box from two corner blocks. The height is added: `below` blocks below the lower corner,
 * `above` blocks above the upper corner.
 * @param {{ a?: import("@minecraft/server").Vector3, b?: import("@minecraft/server").Vector3 } | undefined} corners
 * @param {{ below: number, above: number }} spec
 * @returns {{ from: import("@minecraft/server").Vector3, to: import("@minecraft/server").Vector3 } | undefined}
 */
export function boxOf(corners, spec) {
    const { a, b } = corners ?? {};
    if (!a || !b) return undefined;
    return {
        from: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) - spec.below, z: Math.min(a.z, b.z) },
        to: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) + spec.above, z: Math.max(a.z, b.z) },
    };
}

// --------------------------------------------------
// FORMS AND MENUS
// --------------------------------------------------

/**
 * Shows a form; a form that is refused because the chat or another screen is open is retried for a few seconds.
 * @returns {Promise<any>} The response, or undefined if canceled.
 */
export async function showForm(player, form) {
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

/**
 * @typedef {object} MenuEntry
 * @property {string} text Button text.
 * @property {() => string | undefined | Promise<string | undefined>} run What the button does. Returns a note for
 *     the top of the menu, or "close" to close the menu.
 */

// Players with an open menu, per menu id.
const openMenus = new Set();

/**
 * A setup menu: every click runs an entry and shows the menu again with the result at the top, until it is
 * closed. `render` is called before every showing, so ✔ / ✘ are always current.
 * @param {import("@minecraft/server").Player} player
 * @param {{ id: string, title: string, render: () => { lines: string[], entries: MenuEntry[] }, note?: string }} menu
 */
export async function runMenu(player, { id, title, render, note }) {
    const key = `${id}:${player.id}`;
    if (!note && openMenus.has(key)) return;
    openMenus.add(key);
    rememberMenu(player, id);
    try {
        for (;;) {
            const { lines, entries } = render();
            const hint = menus.length > 1 ? ["§7Andere Quest einrichten: Schleichen + Rechtsklick mit dem Kompass.§r"] : [];
            const body = note ? [`§e${note}§r`, "", ...lines, ...hint] : [...lines, ...hint];
            const form = new ActionFormData().title(title).body(body.join("\n"));
            for (const entry of entries) form.button(entry.text);

            const response = await showForm(player, form);
            if (!response || response.selection === undefined) return;

            const entry = entries[response.selection];
            const result = await runEntry(player, entry);
            if (result === "close") return;
            note = result;
        }
    } finally {
        openMenus.delete(key);
    }
}

/**
 * Runs the action of a button. An error does not close the menu: it is written to the chat in yellow (and to the
 * content log), and the menu shows a short note.
 * @param {import("@minecraft/server").Player} player
 * @param {MenuEntry} entry
 * @returns {Promise<string | undefined>}
 */
async function runEntry(player, entry) {
    try {
        return await entry.run();
    } catch (error) {
        const button = entry.text.replace(/§./g, "").replace(/^[✔✘] /, "");
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[setup-menu] Button "${button}" failed: ${message}`);
        try {
            player.sendMessage(`§eFehler bei „${button}“: ${message}`);
        } catch {
            // The player left.
        }
        return `Fehler bei „${button}“, siehe Chat.`;
    }
}

/**
 * Asks for confirmation; resolves to true if the first button was chosen.
 * @param {import("@minecraft/server").Player} player
 */
export async function confirm(player, title, body, yes = "Ja", no = "Abbrechen") {
    const response = await showForm(player, new ActionFormData().title(title).body(body).button(yes).button(no));
    return response?.selection === 0;
}

// --------------------------------------------------
// REGISTRY AND COMPASS
// --------------------------------------------------

/** @type {{ id: string, title: string, open: (player: import("@minecraft/server").Player) => any }[]} */
const menus = [];

/**
 * Registers the setup menu of a quest, so the compass can offer it.
 * @param {{ id: string, title: string, open: (player: import("@minecraft/server").Player) => any }} menu
 */
export function registerSetupMenu(menu) {
    if (!menus.some((m) => m.id === menu.id)) menus.push(menu);
}

function hasCompass(player) {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return true;
    for (let slot = 0; slot < container.size; slot++) {
        if (container.getItem(slot)?.nameTag === ITEM_NAME) return true;
    }
    return false;
}

/**
 * Gives the compass "Quest-Setup" unless the player has it already.
 * @param {import("@minecraft/server").Player} player
 */
export function giveSetupCompass(player) {
    if (hasCompass(player)) return;
    const item = new ItemStack(ITEM_TYPE, 1);
    item.nameTag = ITEM_NAME;
    item.lockMode = ItemLockMode.inventory;
    player.getComponent("minecraft:inventory")?.container?.addItem(item);
}

/**
 * Saves on the player which menu they just opened.
 * @param {import("@minecraft/server").Player} player
 * @param {string} id
 */
function rememberMenu(player, id) {
    try {
        player.setDynamicProperty(LAST_MENU_PROPERTY, id);
    } catch (error) {
        console.warn(`[setup-menu] Could not save the last menu: ${error}`);
    }
}

/**
 * The registered menu the player opened last, or undefined (none yet, or its quest no longer has a setup menu).
 * @param {import("@minecraft/server").Player} player
 */
function lastMenu(player) {
    let id;
    try {
        id = player.getDynamicProperty(LAST_MENU_PROPERTY);
    } catch {
        return undefined;
    }
    return menus.find((menu) => menu.id === id);
}

const choosing = new Set();

/**
 * Right-click with the compass: the only menu directly; otherwise the menu this player opened last, or a choice of all
 * registered menus when sneaking or when no menu was opened yet.
 * @param {import("@minecraft/server").Player} player
 */
async function openFromCompass(player) {
    if (menus.length === 0) return;
    if (menus.length === 1) {
        menus[0].open(player);
        return;
    }
    const last = lastMenu(player);
    if (last && !player.isSneaking) {
        last.open(player);
        return;
    }
    if (choosing.has(player.id)) return;
    choosing.add(player.id);
    try {
        const form = new ActionFormData().title("Quest-Setup").body("Welche Quest willst du einrichten?\n§7Der Kompass merkt sich deine Wahl. Wechseln: Schleichen + Rechtsklick.§r");
        for (const menu of menus) form.button(menu === last ? `${menu.title} §7(zuletzt)§r` : menu.title);
        form.button("Schließen");
        const response = await showForm(player, form);
        const menu = response && menus[response.selection];
        if (menu) menu.open(player);
    } finally {
        choosing.delete(player.id);
    }
}

world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
    if (itemStack.typeId !== ITEM_TYPE || itemStack.nameTag !== ITEM_NAME) return;
    openFromCompass(source);
});
