import { system, world } from "@minecraft/server";
import { isSameBlock, toDimensionId, toTypeSet } from "./area.js";

/**
 * @typedef {object} BlockInteractOptions
 * @property {string | string[]} [blockType] Block id(s) that count, e.g. "minecraft:chest".
 *     Omit it to accept every block.
 * @property {import("./area.js").Vector3} [location] The exact block position that has to be clicked.
 * @property {string} [dimension] Defaults to "overworld".
 * @property {boolean} [cancel] If true, the normal reaction of the block (chest opens, note block
 *     changes its pitch, door opens, ...) is suppressed for every matching click. Defaults to false.
 */

/**
 * @typedef {object} BlockInteractEvent
 * @property {import("@minecraft/server").Player} player The player who right-clicked the block.
 * @property {import("@minecraft/server").Block} block The clicked block.
 */

/**
 * Calls the callback whenever a player right-clicks a matching block.
 * @param {BlockInteractOptions} options
 * @param {(event: BlockInteractEvent) => void} callback
 * @returns {() => void} Call this function to stop listening.
 */
export function onBlockInteract(options, callback) {
    const blockTypes = toTypeSet(options.blockType);
    const dimensionId = toDimensionId(options.dimension);

    const listener = world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
        const { player, block } = event;
        if (block.dimension.id !== dimensionId) return;
        if (blockTypes && !blockTypes.has(block.typeId)) return;
        if (options.location && !isSameBlock(options.location, block.location)) return;

        if (options.cancel) event.cancel = true;

        // The game sends this event several times per click (once per hand, and again while the
        // button is held). Only the first one counts.
        if (!event.isFirstEvent) return;

        // Before-events are read-only: the callback runs on the next tick, so it may change the world.
        system.run(() => callback({ player, block }));
    });

    return () => world.beforeEvents.playerInteractWithBlock.unsubscribe(listener);
}
