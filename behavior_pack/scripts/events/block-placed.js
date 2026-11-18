import { world } from "@minecraft/server";
import { createArea, isInArea, isSameBlock, toDimensionId, toTypeSet } from "./area.js";

/**
 * @typedef {object} BlockPlacedOptions
 * @property {string | string[]} [blockType] Block id(s) that count, e.g. "minecraft:gold_block".
 *     Omit it to accept every block.
 * @property {import("./area.js").Vector3} [location] The exact block position the block has to be placed at.
 * @property {{ from: import("./area.js").Vector3, to: import("./area.js").Vector3 }} [area]
 *     Alternative to location: the block has to be placed somewhere inside this area.
 * @property {string} [dimension] Defaults to "overworld".
 */

/**
 * @typedef {object} BlockPlacedEvent
 * @property {import("@minecraft/server").Player} player The player who placed the block.
 * @property {import("@minecraft/server").Block} block The placed block.
 */

/**
 * Calls the callback whenever a player places a matching block at the configured place.
 * @param {BlockPlacedOptions} options
 * @param {(event: BlockPlacedEvent) => void} callback
 * @returns {() => void} Call this function to stop listening.
 */
export function onBlockPlaced(options, callback) {
    const blockTypes = toTypeSet(options.blockType);
    const area = options.area && createArea(options.area.from, options.area.to);
    const dimensionId = toDimensionId(options.dimension);

    const listener = world.afterEvents.playerPlaceBlock.subscribe(({ player, block, dimension }) => {
        if (dimension.id !== dimensionId) return;
        if (blockTypes && !blockTypes.has(block.typeId)) return;
        if (options.location && !isSameBlock(options.location, block.location)) return;
        if (area && !isInArea(area, block.location)) return;

        callback({ player, block });
    });

    return () => world.afterEvents.playerPlaceBlock.unsubscribe(listener);
}
