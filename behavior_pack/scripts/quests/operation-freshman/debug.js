import {
    BlockVolume,
    CommandPermissionLevel,
    CustomCommandStatus,
    InputPermissionCategory,
    system,
    world,
} from '@minecraft/server'

/**
 * Resets the temporary quest environment from a scheduled command callback.
 * Script reload remains a separate action to restart the running quest sequence.
 * @returns {void}
 */
function resetQuestEnvironment() {
    try {
        resetNpcs()
        for (const player of world.getAllPlayers()) {
            resetPlayer(player)
            player.removeTag('dhsn:lucas_follow_target')
        }
        resetPersist()
        world.sendMessage(
            'Operation Erstsemester zurückgesetzt. Bitte jetzt /reload ausführen, um den Questablauf neu zu starten.'
        )
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[Operation Erstsemester]: ${message}`)
        world.sendMessage(`Quest-Reset fehlgeschlagen: ${message}`)
    }
}

/**
 * Schedules the debug reset outside the custom command's restricted execution.
 * @returns {import('@minecraft/server').CustomCommandResult} Scheduling status.
 */
function resetQuestCommand() {
    system.run(resetQuestEnvironment)
    return {
        status: CustomCommandStatus.Success,
        message: 'Quest-Reset eingeplant.',
    }
}

/**
 * Registers the operator-only quest reset command during script startup.
 * @param {import('@minecraft/server').StartupEvent} event Command registry access.
 * @returns {void}
 */
function registerDebugCommands(event) {
    event.customCommandRegistry.registerCommand(
        {
            name: 'dhsn:reset',
            description: 'Setzt Quest-Speicher, Spieler und Debug-NPCs zurück.',
            permissionLevel: CommandPermissionLevel.GameDirectors,
        },
        resetQuestCommand
    )
}

system.beforeEvents.startup.subscribe(registerDebugCommands)

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
 * Restores normal camera and input after a reload interrupts the quest effects.
 * @param {import('@minecraft/server').Player} player Player whose controls to restore.
 * @returns {void}
 * @throws {Error} If restoring camera or input fails.
 */
export function resetPlayerControls(player) {
    player.camera.clear()
    player.inputPermissions.setPermissionCategory(
        InputPermissionCategory.Movement,
        true
    )
    player.inputPermissions.setPermissionCategory(
        InputPermissionCategory.Camera,
        true
    )
}

/**
 * Restores the player's debug position, rotation, normal camera, and input.
 * @param {import('@minecraft/server').Player} player Player to reset.
 * @returns {void}
 * @throws {Error} If a player or destination operation fails.
 */
export function resetPlayer(player) {
    resetPlayerControls(player)
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
 * Removes all loaded Lucas NPCs across dimensions without spawning replacements.
 * Also preserves the existing cleanup of Frau Sommer in the overworld.
 * Entities in unloaded chunks cannot be removed by this query.
 * @returns {void}
 * @throws {Error} If an entity query or removal fails.
 */
export function resetNpcs() {
    for (const dimensionId of ['overworld', 'nether', 'the_end']) {
        const dimension = world.getDimension(dimensionId)
        for (const lucas of dimension.getEntities({ type: 'dhsn:ersti_coach' })) {
            lucas.remove()
        }
    }

    for (const sommer of world
        .getDimension('overworld')
        .getEntities({ type: 'dhsn:studienorganisation' })) {
        sommer.remove()
    }
}
