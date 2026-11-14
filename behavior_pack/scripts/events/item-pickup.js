import { system, world } from "@minecraft/server";
import { createArea, isInArea, toDimensionId } from "./area.js";

// world.afterEvents.entityItemPickup did not fire for players in the game test, so a pickup
// is detected from two events instead: an item entity disappears from the ground, and in the
// same moment a player close to it gets more of that item in their inventory.

// How close (in blocks) the player has to be to the item entity that disappeared.
const PICKUP_DISTANCE = 3;
// How many ticks the disappearance and the inventory change may be apart.
const MAX_TICK_DIFFERENCE = 2;

/**
 * @typedef {object} ItemPickupOptions
 * @property {string | string[]} itemType Item id(s) that count, e.g. "dhsn:certificate".
 * @property {{ from: import("./area.js").Vector3, to: import("./area.js").Vector3 }} [area]
 *     Optional: only pickups inside this area count.
 * @property {string} [dimension] Dimension of the area, defaults to "overworld".
 */

/**
 * @typedef {object} ItemPickupEvent
 * @property {import("@minecraft/server").Player} player The player who picked up the item.
 * @property {import("@minecraft/server").ItemStack} itemStack The picked up item stack.
 */

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Calls the callback whenever a player picks up a matching item from the ground.
 * @param {ItemPickupOptions} options
 * @param {(event: ItemPickupEvent) => void} callback
 * @returns {() => void} Call this function to stop listening.
 */
export function onItemPickup(options, callback) {
    const itemTypes = Array.isArray(options.itemType) ? options.itemType : [options.itemType];
    const area = options.area && createArea(options.area.from, options.area.to);
    const dimensionId = toDimensionId(options.dimension);

    /** @type {{ itemStack: import("@minecraft/server").ItemStack, location: import("./area.js").Vector3, dimensionId: string, tick: number }[]} */
    let removedItems = [];

    const removeListener = world.beforeEvents.entityRemove.subscribe(({ removedEntity }) => {
        if (removedEntity.typeId !== "minecraft:item") return;

        let itemStack;
        try {
            itemStack = removedEntity.getComponent("minecraft:item")?.itemStack;
        } catch {
            return;
        }
        if (!itemStack || !itemTypes.includes(itemStack.typeId)) return;

        removedItems.push({
            itemStack,
            location: removedEntity.location,
            dimensionId: removedEntity.dimension.id,
            tick: system.currentTick,
        });
    });

    const inventoryListener = world.afterEvents.playerInventoryItemChange.subscribe(
        ({ player, beforeItemStack, itemStack }) => {
            removedItems = removedItems.filter((removed) => system.currentTick - removed.tick <= MAX_TICK_DIFFERENCE);
            if (!itemStack || !itemTypes.includes(itemStack.typeId)) return;

            const amountBefore = beforeItemStack?.typeId === itemStack.typeId ? beforeItemStack.amount : 0;
            if (itemStack.amount <= amountBefore) return;

            const index = removedItems.findIndex((removed) =>
                removed.itemStack.typeId === itemStack.typeId
                && removed.dimensionId === player.dimension.id
                && distance(removed.location, player.location) <= PICKUP_DISTANCE
            );
            if (index === -1) return;

            const [removed] = removedItems.splice(index, 1);
            if (area && (player.dimension.id !== dimensionId || !isInArea(area, player.location))) return;

            callback({ player, itemStack: removed.itemStack });
        }
    );

    return () => {
        world.beforeEvents.entityRemove.unsubscribe(removeListener);
        world.afterEvents.playerInventoryItemChange.unsubscribe(inventoryListener);
    };
}
