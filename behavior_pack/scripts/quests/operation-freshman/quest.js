import { ItemStack, world } from '@minecraft/server'
import { onEnterTerritory } from '../../events/index.js'

import * as Debug from './debug.js'
import * as Dialog from './dialog.js'
import * as Persist from './persist.js'
import { questlog } from '../../questlog.js'
import * as Utils from './utils.js'

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

                await Dialog.initialLucasDialog(player)
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

    /** @returns {void} Removes each registered listener at most once. */
    function stopListening() {
        for (const unsubscribe of unsubscribers.splice(0)) unsubscribe()
    }

    /** @type {boolean} Prevents competing zone callbacks from starting another sequence. */
    let claimed = false

    /** @type {{ player: import('@minecraft/server').Player, lucas: import('@minecraft/server').Entity }} Selected participants. */
    let participants

    try {
        participants = await new Promise((resolve, reject) => {
            /**
             * Claims the first usable zone before any asynchronous dialogue work.
             * Missing coaches leave the listeners active for a later zone entry.
             * @param {import('../../events/enter-territory.js').TerritoryEvent} event Entering player.
             * @returns {void}
             */
            function onZoneEntry(event) {
                if (claimed) return
                claimed = true
                try {
                    const lucas = Utils.selectLucas(event.player)
                    if (!lucas) {
                        claimed = false
                        event.player.sendMessage(
                            'Kein verfügbarer Lucas gefunden. Bitte die Quest-Platzierung und geladene Chunks prüfen und die Zone erneut betreten.'
                        )
                        return
                    }
                    stopListening()
                    Utils.removeOtherLucases()
                    resolve({ player: event.player, lucas })
                } catch (error) {
                    reject(error)
                }
            }

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
                        onZoneEntry
                    )
                )
            }
        })
    } finally {
        stopListening()
    }

    await sequenceInitialLucasDialog(participants.player, participants.lucas)
}

/**
 * Waits for interaction retries until Lucas's dialogue is confirmed.
 * @returns {Promise<void>} Resolves after dialogue completion.
 * @throws {Error} If waiting for dialogue completion fails.
 */
async function stepCompletedLucasDialog() {
    await Dialog.completedLucasDialog()
}

/**
 * Waits for Frau Sommer's dialogue to complete, then gives the personalized student ID.
 * If the inventory is full, the ID is dropped at the player's location.
 * @returns {Promise<void>} Resolves after dialogue completion and reward delivery.
 * @throws {Error} If the dialogue fails, the player leaves, the saved name is missing, or inventory or storage access fails.
 */
async function stepCompletedSummerDialog() {
    await Dialog.completedMrsSommerDialog()

    const name = Persist.readPlayerName()
    if (!name) throw new Error('Player name is missing for the student ID.')

    const player = world.getAllPlayers()[0]
    if (!player) {
        throw new Error('Player left before the student ID was delivered.')
    }

    const inventory = player.getComponent('minecraft:inventory')?.container
    if (!inventory) throw new Error('Player inventory is unavailable.')

    /** @type {ItemStack} Personalized student ID reward. */
    const studentId = new ItemStack('dhsn:studierendenausweis', 1)
    studentId.nameTag = `${name}s Studentenausweis`

    const remainder = inventory.addItem(studentId)
    if (remainder) player.dimension.spawnItem(remainder, player.location)
}

/**
 * Resumes the single-player quest at its saved world checkpoint.
 * An absent dialogue result means Lucas has not opened his conversation yet.
 * @returns {Promise<void>} Resolves after the currently implemented quest steps.
 * @throws {Error} If storage, entrance monitoring, or a quest step fails.
 */
export async function initializeQuest() {
    const firstLine = 'mit dem Ersti-Coach Lucas (mit c) gesprochen'

    const questlogEntry = questlog.createEntry({
        title: 'Operation Erstsemester',
        lines: [firstLine],
    })

    const lucasDialogResult = Persist.readLucasDialogResult()
    // Older unfinished saves have dialogue progress but no selected coach yet.
    if (
        !lucasDialogResult ||
        (!lucasDialogResult.confirmed && !Persist.readSelectedLucasId())
    ) {
        await stepInitialLucasDialog()
    }

    if (!Persist.readLucasDialogResult()?.confirmed) {
        await stepCompletedLucasDialog()
    }

    const mrsSommerRoom = Utils.getMrsSommerRoom(Persist.readPlayerCourse())
    Utils.spawnMrsSommer(mrsSommerRoom)

    const secondLine = `mit Frau Sommer sprechen (Raum ${mrsSommerRoom})`
    questlogEntry.lines = [`§a${firstLine}§r`, secondLine]

    if (!Persist.readMrsSommerDialogResult()?.confirmed) {
        await stepCompletedSummerDialog()
    }

    questlog.removeEntry(questlogEntry)
}
