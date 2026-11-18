import { world } from "@minecraft/server";

// Shelves do not offer their inventory to scripts, so this module counts what players put
// into each shelf and take out of it. The counts are stored as world dynamic properties,
// so they survive /reload and restarting the world.
//
// A right-click on a shelf changes the item in the player's hand. Whatever the hand lost
// went into the shelf, whatever the hand gained came out of it:
//   6 books -> 5 books : 1 book into the shelf (chiseled bookshelf)
//   6 books -> nothing : 6 books into the shelf (shelf takes the whole stack)
//   nothing -> 1 book  : 1 book out of the shelf
//   books   -> paper   : books in, paper out (swap)

// Every block a player can put items into by right-clicking it.
export const SHELF_TYPES = [
    "minecraft:chiseled_bookshelf",
    "minecraft:oak_shelf",
    "minecraft:spruce_shelf",
    "minecraft:birch_shelf",
    "minecraft:jungle_shelf",
    "minecraft:acacia_shelf",
    "minecraft:dark_oak_shelf",
    "minecraft:mangrove_shelf",
    "minecraft:cherry_shelf",
    "minecraft:pale_oak_shelf",
    "minecraft:bamboo_shelf",
    "minecraft:crimson_shelf",
    "minecraft:warped_shelf",
];

const SHELF_TYPE_SET = new Set(SHELF_TYPES);
const PROPERTY_PREFIX = "dhsn:shelf_contents:";

/**
 * @typedef {object} ShelfChange
 * @property {import("@minecraft/server").Player} player The player who used the shelf.
 * @property {import("@minecraft/server").Block} block The shelf.
 * @property {Map<string, number>} changes Item id -> amount put in (positive) or taken out (negative).
 * @property {import("@minecraft/server").ItemStack | undefined} beforeItemStack The item in hand before the click.
 */

/** @type {Set<(change: ShelfChange) => void>} */
const listeners = new Set();

function propertyId(block) {
    const { x, y, z } = block.location;
    return `${PROPERTY_PREFIX}${block.dimension.id}:${x},${y},${z}`;
}

/**
 * @param {import("@minecraft/server").Block} block
 * @returns {Record<string, number>} Item id -> amount that is currently in the shelf.
 */
function readContents(block) {
    const value = world.getDynamicProperty(propertyId(block));
    if (typeof value !== "string") return {};

    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
}

function writeContents(block, contents) {
    const isEmpty = Object.keys(contents).length === 0;
    world.setDynamicProperty(propertyId(block), isEmpty ? undefined : JSON.stringify(contents));
}

function clearContents(block) {
    world.setDynamicProperty(propertyId(block), undefined);
}

/**
 * Returns how many items of the given types are in the shelf, as far as players were seen
 * putting them in since the shelf was placed.
 * @param {import("@minecraft/server").Block} block
 * @param {Iterable<string>} itemTypes
 * @returns {number}
 */
export function getShelfCount(block, itemTypes) {
    const contents = readContents(block);
    let count = 0;
    for (const typeId of itemTypes) count += contents[typeId] ?? 0;
    return count;
}

/**
 * Calls the listener after a player put items into a shelf or took items out of it.
 * The counts are already updated when the listener is called.
 * @param {(change: ShelfChange) => void} listener
 * @returns {() => void} Call this function to stop listening.
 */
export function onShelfChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

world.afterEvents.playerInteractWithBlock.subscribe(({ player, block, beforeItemStack, itemStack }) => {
    if (!SHELF_TYPE_SET.has(block.typeId)) return;

    const changes = new Map();
    if (beforeItemStack) changes.set(beforeItemStack.typeId, beforeItemStack.amount);
    if (itemStack) changes.set(itemStack.typeId, (changes.get(itemStack.typeId) ?? 0) - itemStack.amount);
    for (const [typeId, amount] of changes) {
        if (amount === 0) changes.delete(typeId);
    }
    if (changes.size === 0) return;

    const contents = readContents(block);
    for (const [typeId, amount] of changes) {
        const newAmount = Math.max(0, (contents[typeId] ?? 0) + amount);
        if (newAmount === 0) {
            delete contents[typeId];
        } else {
            contents[typeId] = newAmount;
        }
    }
    writeContents(block, contents);

    for (const listener of listeners) listener({ player, block, changes, beforeItemStack });
});

// A newly placed or a broken shelf is empty.
world.afterEvents.playerPlaceBlock.subscribe(({ block }) => {
    if (SHELF_TYPE_SET.has(block.typeId)) clearContents(block);
});

world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation }) => {
    if (SHELF_TYPE_SET.has(brokenBlockPermutation.type.id)) clearContents(block);
});
