import { system, world } from "@minecraft/server";
import { toDimensionId } from "./area.js";

/**
 * @typedef {object} ItemInHopperOptions
 * @property {import("./area.js").Vector3} location Position of the hopper.
 * @property {string | string[]} itemType Item id(s) that count, e.g. "minecraft:paper".
 * @property {number} [amount] How many matching items have to be in the hopper, defaults to 1.
 * @property {boolean} [consume] Removes the matching items from the hopper once the event happened,
 *     e.g. for a trash can. Defaults to false.
 * @property {number} [interval] How often the hopper is checked, in ticks. Defaults to 5.
 * @property {string} [dimension] Defaults to "overworld".
 */

/**
 * @typedef {object} ItemInHopperEvent
 * @property {import("@minecraft/server").Block} block The hopper.
 * @property {number} amount Number of matching items in the hopper.
 * @property {import("@minecraft/server").Player | undefined} player The nearest player within
 *     8 blocks, because hoppers do not know who put the item in.
 */

/**
 * Calls the callback once matching items arrive in the hopper at the given location.
 * Works for items thrown onto the hopper as well as items put in through its inventory.
 *
 * The hopper should not be connected to another container, otherwise it passes the
 * items on and they might be gone before the next check.
 * @param {ItemInHopperOptions} options
 * @param {(event: ItemInHopperEvent) => void} callback
 * @returns {() => void} Call this function to stop listening.
 */
export function onItemInHopper(options, callback) {
    const itemTypes = Array.isArray(options.itemType) ? options.itemType : [options.itemType];
    const requiredAmount = options.amount ?? 1;
    const dimensionId = toDimensionId(options.dimension);

    // Only report the moment the items arrive, not every check while they stay inside.
    let wasFulfilled = false;

    const intervalId = system.runInterval(() => {
        const dimension = world.getDimension(dimensionId);
        if (!dimension.isChunkLoaded(options.location)) return;

        const block = dimension.getBlock(options.location);
        const container = block?.typeId === "minecraft:hopper"
            ? block.getComponent("minecraft:inventory")?.container
            : undefined;
        if (!block || !container) return;

        const matchingSlots = [];
        let amount = 0;
        for (let slot = 0; slot < container.size; slot++) {
            const itemStack = container.getItem(slot);
            if (itemStack && itemTypes.includes(itemStack.typeId)) {
                matchingSlots.push(slot);
                amount += itemStack.amount;
            }
        }

        const isFulfilled = amount >= requiredAmount;
        if (isFulfilled && !wasFulfilled) {
            const [player] = dimension.getPlayers({ location: block.center(), maxDistance: 8, closest: 1 });

            if (options.consume) {
                for (const slot of matchingSlots) container.setItem(slot);
            }

            callback({ block, amount, player });
        }
        wasFulfilled = isFulfilled && !options.consume;
    }, options.interval ?? 5);

    return () => system.clearRun(intervalId);
}
