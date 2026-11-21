import { system, world } from '@minecraft/server'
import { onEnterTerritory } from '../../events/index.js'
import { createDebugZones } from './debug.js'

import { freezeUntil, lookAtUntil } from './utils-ref.js'

/**
 * A quest entry zone, independent of how its coordinates were obtained.
 * @typedef {object} QuestZone
 * @property {string} dimensionId Dimension containing the zone.
 * @property {import('@minecraft/server').Vector3} from First corner block, inclusive.
 * @property {import('@minecraft/server').Vector3} to Opposite corner block, inclusive.
 */

/**
 * TODO
 * @param {unknown} error Failure from a Minecraft API operation.
 * @returns {void}
 */
function logError(error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[Operation Erstsemester]: ${message}`)
}

/**
 * TODO
 * @param {import('@minecraft/server').Player} player Player
 */
async function startQuestSequence(player) {
    freezeUntil(player, async () => {})
}

/**
 * TODO
 * @param {QuestZone[]} zones Zones to monitor
 * @returns {void}
 */
function registerTriggerZoneEvents(zones) {
    /** @type {Array<() => void>} Cleanup callbacks for the configured entry zones. */
    const unsubscribers = zones.map((zone) =>
        onEnterTerritory(
            {
                dimension: zone.dimensionId,
                from: zone.from,
                to: zone.to,
                interval: 1,
            },
            (event) => {
                try {
                    unsubscribers.forEach((unsubscripe) => unsubscripe())
                    startQuestSequence(event.player)
                } catch (error) {
                    logError(error)
                }
            }
        )
    )
}
