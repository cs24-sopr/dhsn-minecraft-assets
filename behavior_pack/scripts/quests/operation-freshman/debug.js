import {
    BlockVolume,
    BlockTypes,
    CommandPermissionLevel,
    CustomCommandStatus,
    SignSide,
    system,
    world,
} from '@minecraft/server'
import * as Config from './config.js'
import { initializeQuest } from './quest.js'
import { initializeLucasCleanup } from './utils.js'

/**
 * Registers operator-only quest commands during script startup.
 * @param {import('@minecraft/server').StartupEvent} event Command registry access.
 * @returns {void}
 */
export function registerDebugCommands(event) {
    event.customCommandRegistry.registerCommand(
        {
            name: 'dhsn:quest_operation_freshman_start',
            description:
                'Richtet die Quest mit Raumschildern und Goldblöcken neu ein.',
            permissionLevel: CommandPermissionLevel.GameDirectors,
        },
        (origin) => {
            const player = origin.sourceEntity
            if (!player || player.typeId !== 'minecraft:player') {
                return {
                    status: CustomCommandStatus.Failure,
                    message:
                        'Diesen Befehl bitte als Spieler im Testbereich ausführen.',
                }
            }
            system.run(() => {
                void setupQuestEnvironment(
                    /** @type {import('@minecraft/server').Player} */ (player)
                )
            })
            return {
                status: CustomCommandStatus.Success,
                message:
                    'Quest-Einrichtung eingeplant (Suchbereich: ±128 Blöcke horizontal, ±8 vertikal).',
            }
        }
    )
}

/**
 * Validates debug markers, applies configuration, clears progress, and starts the quest.
 * Existing Lucas NPCs remain available for nearest-coach selection.
 * @param {import('@minecraft/server').Player} player Operator in the test area.
 * @returns {Promise<void>} Resolves after the quest finishes or a failure is reported.
 */
async function setupQuestEnvironment(player) {
    try {
        const { sommer, zones } = discoverQuestSetup(player)
        if (
            player.dimension.getEntities({ type: 'dhsn:ersti_coach' }).length === 0
        ) {
            throw new Error(
                'Bitte mindestens einen Lucas im Testbereich platzieren.'
            )
        }
        Config.configureQuest(sommer, zones)
        resetPersist()
        initializeLucasCleanup()
        player.sendMessage(
            `Operation Erstsemester neu eingerichtet: Räume 113 und 114, ${zones.length} Goldblock-Trigger. Die Quest ist bereit.`
        )
        await initializeQuest()
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[Operation Erstsemester]: ${message}`)
        if (player.isValid) {
            player.sendMessage(`Quest-Einrichtung fehlgeschlagen: ${message}`)
        }
    }
}

/**
 * Clears all Operation Erstsemester world dynamic properties for debug setup.
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

/** @type {import('@minecraft/server').Vector3} Temporary scan radius around the operator. */
const DEBUG_SCAN_RADIUS = { x: 128, y: 8, z: 128 }

/**
 * Discovers signs labelled exactly 113 or 114 and gold blocks near the operator.
 * Both sign sides are supported. Unloaded chunks in the search box are skipped.
 * Each gold block creates a 1 x 1 x 3 trigger immediately above it.
 * @param {import('@minecraft/server').Player} player Operator defining the search center.
 * @returns {{ sommer: import('./config.js').MrsSommerConfig, zones: import('./quest.js').QuestZone[] }} Validated placements.
 * @throws {Error} If loaded markers are missing, ambiguous, or unreadable.
 */
function discoverQuestSetup(player) {
    const dimension = player.dimension
    const location = player.location
    const center = {
        x: Math.floor(location.x),
        y: Math.floor(location.y),
        z: Math.floor(location.z),
    }
    const volume = new BlockVolume(
        {
            x: center.x - DEBUG_SCAN_RADIUS.x,
            y: Math.max(
                dimension.heightRange.min,
                center.y - DEBUG_SCAN_RADIUS.y
            ),
            z: center.z - DEBUG_SCAN_RADIUS.z,
        },
        {
            x: center.x + DEBUG_SCAN_RADIUS.x,
            y: Math.min(
                dimension.heightRange.max - 1,
                center.y + DEBUG_SCAN_RADIUS.y
            ),
            z: center.z + DEBUG_SCAN_RADIUS.z,
        }
    )
    const signTypes = BlockTypes.getAll()
        .filter((type) => type.id.endsWith('_sign'))
        .map((type) => type.id)
    const markers = dimension.getBlocks(
        volume,
        { includeTypes: ['minecraft:gold_block', ...signTypes] },
        true
    )
    /** @type {Partial<Record<113 | 114, import('./config.js').MrsSommerSpawn>>} */
    const rooms = {}
    /** @type {import('./quest.js').QuestZone[]} */
    const zones = []
    for (const { x, y, z } of markers.getBlockLocationIterator()) {
        const block = dimension.getBlock({ x, y, z })
        if (!block) continue
        if (block.typeId === 'minecraft:gold_block') {
            zones.push({
                dimensionId: dimension.id,
                from: { x, y: y + 1, z },
                to: { x, y: y + 3, z },
            })
            continue
        }
        const sign = block.getComponent('minecraft:sign')
        if (!sign) continue
        const labels = new Set([
            sign.getText(SignSide.Front)?.trim(),
            sign.getText(SignSide.Back)?.trim(),
        ])
        if (labels.has('113') && labels.has('114')) {
            throw new Error('Die Räume 113 und 114 benötigen getrennte Schilder.')
        }
        for (const room of /** @type {const} */ ([113, 114])) {
            if (!labels.has(String(room))) continue
            if (rooms[room]) {
                throw new Error(
                    `Mehrere Schilder mit der Raumnummer ${room} gefunden.`
                )
            }
            rooms[room] = {
                position: { x: x + 0.5, y, z: z + 0.5 },
                rotation: { x: 0, y: 0 },
            }
        }
    }
    if (!rooms[113] || !rooms[114]) {
        throw new Error(
            'Im Suchbereich wird je ein Schild mit genau 113 und 114 benötigt.'
        )
    }
    if (zones.length === 0) {
        throw new Error('Im Suchbereich wurden keine Goldblock-Trigger gefunden.')
    }
    return {
        sommer: {
            dimensionId: dimension.id,
            spawn: { 113: rooms[113], 114: rooms[114] },
        },
        zones,
    }
}

