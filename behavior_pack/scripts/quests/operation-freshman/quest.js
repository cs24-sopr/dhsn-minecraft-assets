import { onEnterTerritory } from '../../events/index.js'

import * as Util from './utils.js'
import { completedLucasDialog, initialLucasDialog } from './dialog.js'

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
    await Util.freezeUntil(player, async () => {
        await Util.onGround(player)

        return Util.withEffectStack({
            effects: [
                (action) => Util.invisibleUntil(player, action),
                (action) =>
                    Util.lookAtUntil(
                        player,
                        () => lucas.getHeadLocation(),
                        action
                    ),
            ],
            action: async () => {
                await Promise.all([
                    Util.hop(lucas, 0.35),
                    Util.turnToPlayer(player, lucas, 20),
                ])

                // TODO better error handling
                await Util.walkTo(lucas, player, 2.5, 20 * 20).then((result) =>
                    result.expect('arrived', 'Lucas did not arrive')
                )

                await initialLucasDialog(player)
            },
        })
    })

    await completedLucasDialog()
    player.sendMessage('Done')
}

/**
 * TODO
 * @param {QuestZone[]} zones Zones to monitor
 * @returns {void}
 */
export function registerTriggerZoneEvents(zones) {
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
