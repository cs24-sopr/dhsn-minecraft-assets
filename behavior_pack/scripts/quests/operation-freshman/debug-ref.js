import { BlockVolume, world } from '@minecraft/server'

// Temporary bounds around the debugging command's test positions.
// Only loaded chunks are scanned. Adjust these corners for another test area.
/** @type {TerritoryScanConfig} */
const TERRITORY_SCAN = {
    dimensionId: 'minecraft:overworld',
    from: { x: -32, y: -64, z: -32 },
    to: { x: 32, y: -58, z: 32 },
}

/**
 * Builds a zone array from the currently loaded gold blocks in the debug area.
 * Each marker creates a 1 x 1 x 3 zone directly above it, excluding the block.
 * @returns {import('./quest.js').QuestZone[]} Zones to pass to the quest logic.
 * @throws {Error} If the block query fails.
 */
export function findTriggerZones() {
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
