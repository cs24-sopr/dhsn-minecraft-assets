import { GameMode, ItemStack, system } from "@minecraft/server";
import { changeShelfContents, clearShelfContents, readShelfContents } from "./events/shelf-contents.js";

// Makes our own bookshelves (myname:*_bookshelf) usable: right-click with a book puts it in,
// right-click with an empty hand takes one out (if allowed), breaking the shelf drops all books.
// The bookshelves have no inventory, so their contents are kept in the shelf counter of
// events/shelf-contents.js. That way onItemInShelf works for them like for vanilla shelves.
//
// Each bookshelf enables this in its block JSON and can configure it there:
//   "dhsn:bookshelf": { "capacity": 6, "accepts": ["myname:cs_book", ...], "allow_take_out": false }
//
// Quests can take part in the decision (see setShelfInsertCheck and onShelfRejected below),
// e.g. to allow only one book per shelf or to answer a wrong shelf with an own message.

const COMPONENT_NAME = "dhsn:bookshelf";
const DEFAULT_CAPACITY = 6;
const DEFAULT_ALLOW_TAKE_OUT = true;
const DEFAULT_ACCEPTS = [
    "myname:cs_book",
    "myname:cofi_book",
    "myname:immo_book",
    "myname:niia_book",
    "myname:stwp_book",
    "minecraft:book",
];

// All chat messages of the bookshelves are yellow.
const CHAT_COLOR = "§e";

/**
 * @typedef {object} ShelfRejection
 * @property {import("@minecraft/server").Player} player The player who tried to put the item in.
 * @property {import("@minecraft/server").Block} block The bookshelf.
 * @property {import("@minecraft/server").ItemStack} itemStack The item in the player's hand.
 * @property {"wrong_shelf" | "full" | "blocked"} reason "wrong_shelf": the shelf does not accept this item;
 *     "full": the shelf is full; "blocked": the insert check (setShelfInsertCheck) said no.
 */

/** @type {Set<(rejection: ShelfRejection) => boolean | void>} */
const rejectionListeners = new Set();

/** @type {((insert: { player: import("@minecraft/server").Player, block: import("@minecraft/server").Block, itemStack: import("@minecraft/server").ItemStack }) => boolean) | undefined} */
let insertCheck;

/**
 * Calls the listener when one of our bookshelves refuses an item. If a listener returns true,
 * it has told the player why, and the bookshelf does not send its own message.
 * @param {(rejection: ShelfRejection) => boolean | void} listener
 * @returns {() => void} Call this function to stop listening.
 */
export function onShelfRejected(listener) {
    rejectionListeners.add(listener);
    return () => rejectionListeners.delete(listener);
}

/**
 * Sets a check that runs before an accepted item goes into one of our bookshelves. If it returns
 * false, the item stays in the hand and onShelfRejected is called with reason "blocked".
 * There is only one check; setting a new one replaces the old one, undefined removes it.
 * @param {typeof insertCheck} check
 */
export function setShelfInsertCheck(check) {
    insertCheck = check;
}

function say(player, text) {
    player.sendMessage(`${CHAT_COLOR}${text}`);
}

/** Informs the listeners; sends the fallback text only if no listener took care of it. */
function reject(rejection, fallbackText) {
    let handled = false;
    for (const listener of rejectionListeners) {
        if (listener(rejection) === true) handled = true;
    }
    if (!handled) say(rejection.player, fallbackText);
}

/**
 * @param {unknown} params The component's parameters from the block JSON.
 * @returns {{ capacity: number, accepts: string[], allowTakeOut: boolean }}
 */
function readParams(params) {
    const { capacity, accepts, allow_take_out } = /** @type {{ capacity?: number, accepts?: string[], allow_take_out?: boolean }} */ (params ?? {});
    return {
        capacity: typeof capacity === "number" ? capacity : DEFAULT_CAPACITY,
        accepts: Array.isArray(accepts) ? accepts : DEFAULT_ACCEPTS,
        allowTakeOut: typeof allow_take_out === "boolean" ? allow_take_out : DEFAULT_ALLOW_TAKE_OUT,
    };
}

function countAll(contents) {
    return Object.values(contents).reduce((sum, amount) => sum + amount, 0);
}

function putBookIn(player, block, hand, capacity) {
    const beforeItemStack = hand.getItem();
    if (!beforeItemStack) return;

    const contents = readShelfContents(block);
    const count = countAll(contents);
    if (count >= capacity) {
        reject({ player, block, itemStack: beforeItemStack, reason: "full" }, `Das Regal ist voll (${count}/${capacity}).`);
        return;
    }

    if (insertCheck && !insertCheck({ player, block, itemStack: beforeItemStack })) {
        reject({ player, block, itemStack: beforeItemStack, reason: "blocked" }, "Hier kannst du gerade kein Buch einstellen.");
        return;
    }

    if (player.getGameMode() !== GameMode.Creative) {
        if (beforeItemStack.amount > 1) {
            const rest = beforeItemStack.clone();
            rest.amount -= 1;
            hand.setItem(rest);
        } else {
            hand.setItem();
        }
    }

    changeShelfContents(player, block, new Map([[beforeItemStack.typeId, 1]]), beforeItemStack);
    // No chat line here: the shelf counter is not interesting for players, quests report progress themselves.
    player.dimension.playSound("insert.chiseled_bookshelf", block.center());
}

function takeBookOut(player, block, hand, capacity, allowTakeOut) {
    const contents = readShelfContents(block);
    const count = countAll(contents);

    if (!allowTakeOut) {
        const books = count === 1 ? "steht 1 Buch" : `stehen ${count} Bücher`;
        say(player, count > 0 ? `In diesem Regal ${books}. Herausnehmen geht nicht.` : "Dieses Regal ist leer.");
        return;
    }

    const typeId = Object.keys(contents)[0];
    if (!typeId) return;

    hand.setItem(new ItemStack(typeId, 1));
    changeShelfContents(player, block, new Map([[typeId, -1]]), undefined);
    player.dimension.playSound("pickup.chiseled_bookshelf", block.center());
    say(player, `Buch herausgenommen (${count - 1}/${capacity}).`);
}

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent(COMPONENT_NAME, {
        onPlayerInteract({ block, player }, { params }) {
            if (!player) return;

            const { capacity, accepts, allowTakeOut } = readParams(params);
            const hand = player.getComponent("minecraft:inventory")?.container?.getSlot(player.selectedSlotIndex);
            if (!hand) return;

            const held = hand.getItem();
            if (!held) {
                takeBookOut(player, block, hand, capacity, allowTakeOut);
            } else if (accepts.includes(held.typeId)) {
                putBookIn(player, block, hand, capacity);
            } else {
                reject({ player, block, itemStack: held, reason: "wrong_shelf" }, "Das passt nicht in dieses Regal.");
            }
        },

        onBreak({ block, dimension }) {
            const contents = readShelfContents(block);
            const location = block.center();
            // One by one, because our books only stack to 1.
            for (const [typeId, amount] of Object.entries(contents)) {
                for (let i = 0; i < amount; i++) dimension.spawnItem(new ItemStack(typeId, 1), location);
            }
            clearShelfContents(block);
        },
    });
});
