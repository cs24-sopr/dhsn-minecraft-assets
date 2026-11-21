import { BlockVolume, system, world } from '@minecraft/server'
import { setQuestZones } from './quest.js'

/**
 * Fixed search bounds for the temporary gold-block debug markers.
 * @typedef {object} TerritoryScanConfig
 * @property {string} dimensionId Dimension containing the debug area.
 * @property {import('@minecraft/server').Vector3} from First corner block to scan.
 * @property {import('@minecraft/server').Vector3} to Opposite corner block to scan.
 */

// Temporary bounds around the debugging command's test positions.
// Only loaded chunks are scanned. Adjust these corners for another test area.
/** @type {TerritoryScanConfig} */
const TERRITORY_SCAN = {
    dimensionId: 'minecraft:overworld',
    from: { x: -32, y: -64, z: -32 },
    to: { x: 32, y: -58, z: 32 },
}

/** @type {boolean} Whether this script instance has already started its scan. */
let territoriesScanned = false

/**
 * Builds a zone array from the currently loaded gold blocks in the debug area.
 * Each marker creates a 1 x 1 x 3 zone directly above it, excluding the block.
 * @returns {import('./quest.js').QuestZone[]} Zones to pass to the quest logic.
 * @throws {Error} If the block query fails.
 */
function createDebugZones() {
    const dimension = world.getDimension(TERRITORY_SCAN.dimensionId)
    const markers = dimension.getBlocks(
        new BlockVolume(TERRITORY_SCAN.from, TERRITORY_SCAN.to),
        { includeTypes: ['minecraft:gold_block'] },
        true
    )
    /** @type {import('./quest.js').QuestZone[]} */
    const zones = []
    for (const { x, y, z } of markers.getBlockLocationIterator()) {
        zones.push({
            dimensionId: TERRITORY_SCAN.dimensionId,
            from: { x, y: y + 1, z },
            to: { x, y: y + 3, z },
        })
    }
    return zones
}

/**
 * Rebuilds the debug zone array and gives it to the quest's entry detection.
 * Unloaded chunks are skipped, so stand near the markers when resetting.
 * @returns {void}
 * @throws {Error} If scanning or territory registration fails.
 */
export function rescanGoldTerritories() {
    territoriesScanned = true
    world.afterEvents.playerSpawn.unsubscribe(scanGoldTerritories)
    world.afterEvents.worldLoad.unsubscribe(initializeWhenPlayersAvailable)

    // Build the array first so a failed scan leaves the previous zones active.
    const zones = createDebugZones()
    setQuestZones(zones)
    console.warn(
        `[Operation Erstsemester] ${zones.length} Goldblock-Debug-Bereiche registriert (nur geladene Chunks).`
    )
}

/**
 * Finds gold markers automatically once per script load.
 * Later block edits require /dhsn:r or /reload to refresh the territories.
 * @returns {void}
 */
function scanGoldTerritories() {
    if (territoriesScanned) return
    try {
        rescanGoldTerritories()
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(
            `[Operation Erstsemester] Goldblock-Suche fehlgeschlagen: ${message}`
        )
    }
}

/**
 * Scans with existing players on reload, or waits for the first player spawn.
 * @returns {void}
 */
function initializeWhenPlayersAvailable() {
    if (world.getAllPlayers().length > 0) scanGoldTerritories()
}

world.afterEvents.worldLoad.subscribe(initializeWhenPlayersAvailable)
world.afterEvents.playerSpawn.subscribe(scanGoldTerritories)
// Also cover script reloads where players are already present.
system.run(initializeWhenPlayersAvailable)
