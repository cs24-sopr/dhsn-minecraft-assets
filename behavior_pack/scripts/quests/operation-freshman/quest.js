import { onEnterTerritory } from '../../events/index.js'

/**
 * A quest entry zone, independent of how its coordinates were obtained.
 * @typedef {object} QuestZone
 * @property {string} dimensionId Dimension containing the zone.
 * @property {import('@minecraft/server').Vector3} from First corner block, inclusive.
 * @property {import('@minecraft/server').Vector3} to Opposite corner block, inclusive.
 */

/** @type {Array<() => void>} Cleanup callbacks for the current quest zones. */
let zoneCleanups = []

/**
 * Registers player entry detection for a configured quest zone.
 * @param {QuestZone} zone Zone whose entry should be detected.
 * @returns {() => void} Stops detecting entry into this zone.
 */
function registerQuestZone(zone) {
    const { x, y, z } = zone.from

    /**
     * Reports entry to the triggering player until the quest interaction is added.
     * @param {import('../../events/enter-territory.js').TerritoryEvent} event Entry event.
     * @returns {void}
     */
    function reportEntry({ player }) {
        player.sendMessage(`§aQuest-Bereich (${x}, ${y}, ${z}) betreten.§r`)
    }

    return onEnterTerritory(
        {
            dimension: zone.dimensionId,
            from: zone.from,
            to: zone.to,
            // Narrow zones can be crossed quickly while sprinting.
            interval: 1,
        },
        reportEntry
    )
}

/**
 * Replaces the active quest zones without accumulating entry listeners.
 * An empty array removes all current zones.
 * @param {QuestZone[]} zones Zones to monitor for player entry.
 * @returns {void}
 */
export function setQuestZones(zones) {
    for (const cleanup of zoneCleanups) cleanup()
    zoneCleanups = []
    for (const zone of zones) {
        zoneCleanups.push(registerQuestZone(zone))
    }
}
