import { system, world } from '@minecraft/server'
import { onEnterTerritory } from '../../events/index.js'

import * as Util from './utils-ref.js'
import * as Debug from './debug-ref.js'

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
 * @param {import('@minecraft/server').Entity} lucas Lucas
 */
async function startQuestSequence(player, lucas) {
    await Util.withEffectStack({
        effects: [
            (action) => Util.freezeUntil(player, action),
            (action) => Util.invisibleUntil(player, action),
            (action) =>
                Util.lookAtUntil(player, () => lucas.getHeadLocation(), action),
        ],
        action: async () => {
            await Util.hop(lucas, 0.35)
            await system.waitTicks(40)
        },
    })
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
            async (event) => {
                try {
                    const lucas = Util.getLucas()
                    unsubscribers.forEach((unsubscripe) => unsubscripe())

                    await startQuestSequence(event.player, lucas)
                } catch (error) {
                    logError(error)
                }
            }
        )
    )
}

/** @type {boolean} Whether the temporary debug zones have been registered. */
let zonesRegistered = false
/** @type {boolean} Whether the debug NPCs have been reset during this script load. */
let npcsReset = false
/** @type {Set<string>} Players already reset during this script load. */
const resetPlayerIds = new Set()

/**
 * Resets players and debug NPCs, then registers zones in the debug area.
 * World load covers reloads; player spawn covers entering the world initially.
 * @returns {void}
 */
function initializeTriggerZones() {
    if (zonesRegistered) return
    const players = world.getAllPlayers()
    if (players.length === 0) return

    try {
        for (const player of players) {
            if (resetPlayerIds.has(player.id)) continue
            Debug.resetPlayer(player)
            resetPlayerIds.add(player.id)
        }
        if (!npcsReset) {
            Debug.resetNpcs()
            npcsReset = true
        }
        const zones = Debug.findTriggerZones()
        if (zones.length === 0) return

        registerTriggerZoneEvents(zones)
        zonesRegistered = true
    } catch (error) {
        logError(error)
    }
}

world.afterEvents.worldLoad.subscribe(initializeTriggerZones)
world.afterEvents.playerSpawn.subscribe(initializeTriggerZones)
// Also initialize after script startup when players are already present.
system.run(initializeTriggerZones)
