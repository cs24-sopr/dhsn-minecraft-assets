import { system, world } from "@minecraft/server";
import { createArea, isInArea, toDimensionId } from "./area.js";

/**
 * @typedef {object} EnterTerritoryOptions
 * @property {import("./area.js").Vector3} from First corner block of the area, e.g. of a room.
 * @property {import("./area.js").Vector3} to Opposite corner block of the area. Both corners belong to the area.
 * @property {string} [dimension] Defaults to "overworld".
 * @property {number} [interval] How often player positions are checked, in ticks. Defaults to 5.
 * @property {(event: TerritoryEvent) => void} [onLeave] Optional: called when a player leaves the area.
 */

/**
 * @typedef {object} TerritoryEvent
 * @property {import("@minecraft/server").Player} player The player who entered (or left) the area.
 */

/**
 * Calls the callback whenever a player enters the area. A player has to leave the
 * area before entering it again triggers the callback again.
 * @param {EnterTerritoryOptions} options
 * @param {(event: TerritoryEvent) => void} callback
 * @returns {() => void} Call this function to stop listening.
 */
export function onEnterTerritory(options, callback) {
    const area = createArea(options.from, options.to);
    const dimensionId = toDimensionId(options.dimension);

    // Ids of the players that were inside the area at the last check.
    let playersInside = new Set();

    const intervalId = system.runInterval(() => {
        const players = world.getAllPlayers();
        const nowInside = new Set();

        for (const player of players) {
            if (player.dimension.id !== dimensionId || !isInArea(area, player.location)) continue;

            nowInside.add(player.id);
            if (!playersInside.has(player.id)) callback({ player });
        }

        if (options.onLeave) {
            for (const player of players) {
                if (playersInside.has(player.id) && !nowInside.has(player.id)) options.onLeave({ player });
            }
        }

        playersInside = nowInside;
    }, options.interval ?? 5);

    return () => system.clearRun(intervalId);
}
