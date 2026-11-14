import { createArea, isInArea, isSameBlock, toDimensionId, toTypeSet } from "./area.js";
import { getShelfCount, onShelfChange, SHELF_TYPES } from "./shelf-contents.js";

export { SHELF_TYPES };

/**
 * @typedef {object} ItemInShelfOptions
 * @property {string | string[]} itemType Item id(s) that count, e.g. "minecraft:book".
 * @property {string | string[]} [shelfType] Shelf block id(s) that count. Defaults to SHELF_TYPES.
 * @property {number} [amount] Optional: how many matching items have to be in one shelf. Without it,
 *     every single placement is reported. With it, the event happens once the shelf holds this many.
 * @property {import("./area.js").Vector3} [location] Optional: only this shelf counts.
 * @property {{ from: import("./area.js").Vector3, to: import("./area.js").Vector3 }} [area]
 *     Optional: only shelves inside this area count.
 * @property {string} [dimension] Defaults to "overworld".
 */

/**
 * @typedef {object} ItemInShelfEvent
 * @property {import("@minecraft/server").Player} player The player who put the item into the shelf.
 * @property {import("@minecraft/server").Block} block The shelf.
 * @property {import("@minecraft/server").ItemStack} itemStack The item the player was holding.
 * @property {number} count How many matching items are in the shelf now.
 */

/**
 * Calls the callback whenever a player puts a matching item into a shelf, or with the
 * amount option, once a shelf holds the given number of matching items.
 *
 * Shelves do not offer an inventory to scripts, so the contents are counted by
 * shelf-contents.js from the item in the player's hand. Because items in hand are not
 * used up in creative mode, this only works in survival or adventure mode.
 * @param {ItemInShelfOptions} options
 * @param {(event: ItemInShelfEvent) => void} callback
 * @returns {() => void} Call this function to stop listening.
 */
export function onItemInShelf(options, callback) {
    const itemTypes = toTypeSet(options.itemType) ?? new Set();
    const shelfTypes = toTypeSet(options.shelfType ?? SHELF_TYPES) ?? new Set();
    const area = options.area && createArea(options.area.from, options.area.to);
    const dimensionId = toDimensionId(options.dimension);

    return onShelfChange(({ player, block, changes, beforeItemStack }) => {
        if (!beforeItemStack || !itemTypes.has(beforeItemStack.typeId)) return;
        if (!shelfTypes.has(block.typeId) || block.dimension.id !== dimensionId) return;
        if (options.location && !isSameBlock(options.location, block.location)) return;
        if (area && !isInArea(area, block.location)) return;

        let added = 0;
        for (const typeId of itemTypes) added += changes.get(typeId) ?? 0;
        if (added <= 0) return;

        const count = getShelfCount(block, itemTypes);
        // With an amount, only report the click that reaches it, not every click after that.
        if (options.amount !== undefined && (count < options.amount || count - added >= options.amount)) return;

        callback({ player, block, itemStack: beforeItemStack, count });
    });
}
