import { world } from '@minecraft/server'
import { onEnterTerritory } from '../../events/index.js'

import * as Utils from './utils.js'
import * as Debug from './debug.js'
import * as Persist from './persist.js'

import { completedLucasDialog, initialLucasDialog } from './dialog.js'

/**
 * A quest entry zone, independent of how its coordinates were obtained.
 * @typedef {object} QuestZone
 * @property {string} dimensionId Dimension containing the zone.
 * @property {import('@minecraft/server').Vector3} from First corner block, inclusive.
 * @property {import('@minecraft/server').Vector3} to Opposite corner block, inclusive.
 */

/**
 * Runs Lucas's initial approach and one dialogue attempt inside the effect stack.
 * @param {import('@minecraft/server').Player} player Player
 * @param {import('@minecraft/server').Entity} lucas Lucas
 * @returns {Promise<void>} Resolves when the initial conversation closes and effects end.
 * @throws {Error} If the approach, dialogue, or an effect fails.
 */
async function sequenceInitialLucasDialog(player, lucas) {
    await Utils.freezeUntil(player, async () => {
        await Utils.onGround(player)

        return Utils.withEffectStack({
            effects: [
                (action) => Utils.invisibleUntil(player, action),
                (action) =>
                    Utils.lookAtUntil(
                        player,
                        () => lucas.getHeadLocation(),
                        action
                    ),
            ],
            action: async () => {
                await Promise.all([
                    Utils.hop(lucas, 0.35),
                    Utils.turnToPlayer(player, lucas, 20),
                ])

                // TODO better error handling
                await Utils.walkTo(lucas, player, 2.5, 20 * 20).then((result) =>
                    result.expect('arrived', 'Lucas did not arrive')
                )

                await initialLucasDialog(player)
            },
        })
    })
}

/**
 * Waits for an entrance, then runs the initial approach and dialogue attempt.
 * Entrance listeners are removed on entry, disconnect, or registration failure.
 * @returns {Promise<void>} Resolves when the initial dialogue completes or is cancelled.
 * @throws {Error} If no player remains, zone setup fails, or the sequence fails.
 */
async function stepInitialLucasDialog() {
    const zones = Debug.findTriggerZones()

    if (zones.length === 0) {
        throw new Error('No trigger zones found')
    }

    /** @type {Array<() => void>} Cleanup callbacks for the entrance listeners. */
    const unsubscribers = []

    /** @type {import('@minecraft/server').Player} Player entering either entrance. */
    let player

    try {
        player = await new Promise((resolve, reject) => {
            /** @returns {void} Rejects the entrance wait when the single player leaves. */
            function onPlayerLeave() {
                reject(new Error('Player left before entering a quest zone.'))
            }
            world.afterEvents.playerLeave.subscribe(onPlayerLeave)
            unsubscribers.push(() =>
                world.afterEvents.playerLeave.unsubscribe(onPlayerLeave)
            )
            for (const zone of zones) {
                unsubscribers.push(
                    onEnterTerritory(
                        {
                            dimension: zone.dimensionId,
                            from: zone.from,
                            to: zone.to,
                            interval: 1,
                        },
                        (event) => resolve(event.player)
                    )
                )
            }
        })
    } finally {
        unsubscribers.forEach((unsubscriber) => unsubscriber())
    }

    await sequenceInitialLucasDialog(player, Utils.getLucas())
}

/**
 * Waits for interaction retries until Lucas's dialogue is confirmed.
 * @returns {Promise<void>} Resolves after dialogue completion.
 * @throws {Error} If waiting for dialogue completion fails.
 */
async function stepCompletedLucasDialog() {
    await completedLucasDialog()
}

/**
 * Placeholder for the later Frau Sommer dialogue step.
 * @returns {Promise<void>} Resolves without performing enrollment yet.
 */
async function stepCompletedSummerDialog() {}

/**
 * Resumes the single-player quest at its saved world checkpoint.
 * An absent dialogue result means Lucas has not opened his conversation yet.
 * @returns {Promise<void>} Resolves after the currently implemented quest steps.
 * @throws {Error} If storage, entrance monitoring, or a quest step fails.
 */
export async function initializeQuest() {
    if (!Persist.readLucasDialogResult()) {
        await stepInitialLucasDialog()
    }

    if (!Persist.readLucasDialogResult()?.confirmed) {
        await stepCompletedLucasDialog()
    }

    const mrsSommerRoom = Utils.getMrsSommerRoom(Persist.readPlayerCourse())
    Utils.spawnMrsSommer(mrsSommerRoom)
}
