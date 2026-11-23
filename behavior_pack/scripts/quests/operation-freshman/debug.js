import {
    BlockVolume,
    InputPermissionCategory,
    system,
    world,
} from '@minecraft/server'
import { registerTriggerZoneEvents } from './quest.js'

/**
 * Clears all Operation Erstsemester world dynamic properties for a debug restart.
 * @returns {void}
 * @throws {Error} If reading or clearing world storage fails.
 */
export function resetPersist() {
    for (const propertyId of world.getDynamicPropertyIds()) {
        if (propertyId.startsWith('dhsn:operation_freshman_')) {
            world.setDynamicProperty(propertyId, undefined)
        }
    }
}

/**
 * Player placement used when restarting the temporary development sequence.
 * @typedef {object} PlayerDefaults
 * @property {string} dimensionId Dimension containing the starting position.
 * @property {import('@minecraft/server').Vector3} location Starting position.
 * @property {import('@minecraft/server').Vector2} rotation Starting pitch and yaw.
 */

// Temporary development coordinates, matching the active reset in command.js.
/** @type {PlayerDefaults} */
const PLAYER_DEFAULTS = {
    dimensionId: 'minecraft:overworld',
    location: { x: 0.5, y: -60, z: 0.5 },
    rotation: { x: 0, y: 270 },
}

/**
 * Restores the player's debug position, rotation, normal camera, and input.
 * @param {import('@minecraft/server').Player} player Player to reset.
 * @returns {void}
 * @throws {Error} If a player or destination operation fails.
 */
export function resetPlayer(player) {
    player.camera.clear()
    player.inputPermissions.setPermissionCategory(
        InputPermissionCategory.Movement,
        true
    )
    player.inputPermissions.setPermissionCategory(
        InputPermissionCategory.Camera,
        true
    )
    player.teleport(PLAYER_DEFAULTS.location, {
        dimension: world.getDimension(PLAYER_DEFAULTS.dimensionId),
        rotation: PLAYER_DEFAULTS.rotation,
    })
    player.clearVelocity()
}

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

/**
 * Starting placement for an NPC in the temporary development area.
 * @typedef {object} NpcPlacement
 * @property {string} typeId Existing behavior-pack entity identifier.
 * @property {string} nameTag German display name.
 * @property {string} dimensionId Dimension containing the NPC.
 * @property {import('@minecraft/server').Vector3} location Starting position.
 * @property {import('@minecraft/server').Vector2} rotation Starting pitch and yaw.
 */

/** @type {string[]} Entity types removed from the configured dimensions during a debug reset. */
const NPC_TYPES_TO_REMOVE = ['dhsn:ersti_coach', 'dhsn:studienorganisation']

// Temporary development coordinates, matching the reset command in command.js.
/** @type {NpcPlacement[]} */
const NPC_PLACEMENTS = [
    {
        typeId: 'dhsn:ersti_coach',
        nameTag: 'Lucas',
        dimensionId: 'minecraft:overworld',
        location: { x: 20, y: -60, z: 0.5 },
        rotation: { x: 0, y: 0 },
    },
]

/**
 * Removes loaded NPCs of the configured types and recreates the debug placements.
 * Checks destination chunks before removing any existing NPCs.
 * @returns {void}
 * @throws {Error} If a destination is unloaded or an NPC operation fails.
 */
export function resetNpcs() {
    for (const placement of NPC_PLACEMENTS) {
        const dimension = world.getDimension(placement.dimensionId)
        if (!dimension.getBlock(placement.location)) {
            throw new Error(
                `Debug-Position für ${placement.nameTag} ist noch nicht geladen.`
            )
        }
    }

    const dimensions = new Set(
        NPC_PLACEMENTS.map((placement) => placement.dimensionId)
    )
    for (const dimensionId of dimensions) {
        const dimension = world.getDimension(dimensionId)
        for (const type of NPC_TYPES_TO_REMOVE) {
            for (const npc of dimension.getEntities({ type })) npc.remove()
        }
    }

    for (const placement of NPC_PLACEMENTS) {
        const npc = world
            .getDimension(placement.dimensionId)
            .spawnEntity(placement.typeId, placement.location)
        npc.nameTag = placement.nameTag
        npc.setRotation(placement.rotation)
    }
}

/** @type {boolean} Whether the temporary debug zones have been registered. */
let zonesRegistered = false
/** @type {boolean} Whether the debug NPCs have been reset during this script load. */
let npcsReset = false
/** @type {boolean} Whether persistent quest storage has been reset during this script load. */
let persistReset = false
/** @type {Set<string>} Players already reset during this script load. */
const resetPlayerIds = new Set()

/**
 * Resets quest storage, players, and debug NPCs, then registers debug zones.
 * World load covers reloads; player spawn covers entering the world initially.
 * @returns {void}
 */
function initializeTriggerZones() {
    if (zonesRegistered) return
    const players = world.getAllPlayers()
    if (players.length === 0) return

    try {
        if (!persistReset) {
            resetPersist()
            persistReset = true
        }
        for (const player of players) {
            if (resetPlayerIds.has(player.id)) continue
            resetPlayer(player)
            resetPlayerIds.add(player.id)
        }
        if (!npcsReset) {
            resetNpcs()
            npcsReset = true
        }
        const zones = findTriggerZones()
        if (zones.length === 0) return

        registerTriggerZoneEvents(zones)
        zonesRegistered = true
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[Operation Erstsemester]: ${message}`)
    }
}

world.afterEvents.worldLoad.subscribe(initializeTriggerZones)
world.afterEvents.playerSpawn.subscribe(initializeTriggerZones)

// Also initialize after script startup when players are already present.
system.run(initializeTriggerZones)
