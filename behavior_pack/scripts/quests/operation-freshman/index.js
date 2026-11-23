import { system, world } from '@minecraft/server'
import { initializeQuest } from './quest.js'

/** @type {boolean} Prevents concurrent quest initialization during this script load. */
let questRunning = false

/**
 * Starts or resumes the quest once a player is available.
 * @returns {Promise<void>} Resolves when the implemented flow ends or fails.
 */
async function startQuest() {
    if (questRunning) return

    const player = world.getAllPlayers()[0]
    if (!player) return

    questRunning = true

    try {
        await initializeQuest()
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[Operation Erstsemester]: ${message}`)
    } finally {
        questRunning = false
    }
}

world.afterEvents.playerSpawn.subscribe(startQuest)
system.run(startQuest)
