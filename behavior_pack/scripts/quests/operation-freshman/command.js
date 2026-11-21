import {
    CommandPermissionLevel,
    GameMode,
    Player,
    system,
    world,
} from '@minecraft/server'
import { rescanGoldTerritories } from './debug.js'

/**
 * NPC defaults used by the local debugging command.
 * @typedef {object} NpcPlacement
 * @property {string} id Descriptive key for this placement.
 * @property {string} typeId Existing behavior-pack entity identifier.
 * @property {string} nameTag German display name.
 * @property {string} dimensionId Dimension containing the NPC.
 * @property {import('@minecraft/server').Vector3} location Starting x/y/z position.
 * @property {import('@minecraft/server').Vector2} rotation Pitch (x) and yaw (y), in degrees.
 */

/**
 * Editable defaults applied to the player running the debugging command.
 * @typedef {object} PlayerDefaults
 * @property {string} dimensionId Dimension identifier, e.g. 'minecraft:overworld'.
 * @property {import('@minecraft/server').Vector3} location Starting x/y/z position.
 * @property {import('@minecraft/server').Vector2} rotation Pitch (x) and yaw (y), in degrees.
 * @property {import('@minecraft/server').GameMode} gameMode Creative, Survival, Adventure, or Spectator.
 * @property {number} health Health points; 20 is ten hearts for a normal player.
 * @property {boolean} clearInventory Whether to empty the hotbar and main inventory.
 */

// Temporary development coordinates: replace these with positions in your world.
/** @type {PlayerDefaults} */
const PLAYER_DEFAULTS = {
    dimensionId: 'minecraft:overworld',
    location: { x: 0.5, y: -60, z: 0.5 },
    rotation: { x: 0, y: 270 },
    gameMode: GameMode.Creative,
    health: 20,
    clearInventory: true,
}

// Temporary development coordinates: replace these with your NPC positions.
/** @type {NpcPlacement[]} */
const NPC_PLACEMENTS = [
    {
        id: 'lucas',
        typeId: 'dhsn:ersti_coach',
        nameTag: 'Lucas',
        dimensionId: 'minecraft:overworld',
        location: { x: 20, y: -60, z: 0.5 },
        rotation: { x: 0, y: 0 },
    },
    {
        id: 'frau-sommer',
        typeId: 'dhsn:studienorganisation',
        nameTag: 'Frau Sommer',
        dimensionId: 'minecraft:overworld',
        location: { x: 22, y: -60, z: 0.5 },
        rotation: { x: 0, y: 0 },
    },
]

/**
 * Applies PLAYER_DEFAULTS through the Minecraft Player API.
 * Teleport sets position/dimension/rotation; components expose health/inventory.
 * Inventory clearing affects the hotbar and main inventory, not equipped items.
 * @param {Player} player Player running the debugging command.
 * @returns {void}
 * @see https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/player
 */
function resetPlayer(player) {
    player.teleport(PLAYER_DEFAULTS.location, {
        dimension: world.getDimension(PLAYER_DEFAULTS.dimensionId),
        rotation: PLAYER_DEFAULTS.rotation,
    })

    // player.setGameMode(PLAYER_DEFAULTS.gameMode)
    // player
    //     .getComponent('minecraft:health')
    //     ?.setCurrentValue(PLAYER_DEFAULTS.health)

    // if (PLAYER_DEFAULTS.clearInventory) {
    //     player.getComponent('minecraft:inventory')?.container?.clearAll()
    // }
}

/**
 * Recreates the NPCs, restores player defaults, and rescans debug territories.
 * Run near the NPC locations so their chunks are loaded.
 * @param {Player} player Player whose character should be reset.
 * @returns {void}
 * @throws {Error} If a Minecraft API operation fails, e.g. in an unloaded chunk.
 */
export function resetOperationFreshman(player) {
    const dimensions = new Set(
        NPC_PLACEMENTS.map((placement) => placement.dimensionId)
    )
    const types = new Set(NPC_PLACEMENTS.map((placement) => placement.typeId))
    for (const dimensionId of dimensions) {
        const dimension = world.getDimension(dimensionId)
        for (const type of types) {
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

    resetPlayer(player)
    rescanGoldTerritories()
}

/**
 * Applies the debugging reset in a writable tick.
 * @param {import('@minecraft/server').CustomCommandOrigin} origin Command source.
 * @returns {void}
 */
function requestReset(origin) {
    const player = origin.sourceEntity
    if (!(player instanceof Player)) return

    system.run(() => {
        try {
            resetOperationFreshman(player)
            player.sendMessage('§aDebug-Reset ausgeführt.§r')
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error)
            player.sendMessage(`§cDebug-Reset fehlgeschlagen: ${message}§r`)
        }
    })
}

/**
 * Registers /dhsn:r for local debugging.
 * @param {import('@minecraft/server').StartupEvent} event Command registry event.
 * @returns {void}
 */
function registerResetCommand(event) {
    event.customCommandRegistry.registerCommand(
        {
            name: 'dhsn:r',
            description: 'Setzt NPCs und Spieler auf ihre Standardwerte zurück.',
            permissionLevel: CommandPermissionLevel.Admin,
            cheatsRequired: true,
        },
        requestReset
    )
}

system.beforeEvents.startup.subscribe(registerResetCommand)
