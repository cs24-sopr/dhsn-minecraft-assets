import {
    EasingType,
    InputPermissionCategory,
    system,
    world,
} from '@minecraft/server'
import { onEnterTerritory } from '../../events/index.js'

/**
 * A quest entry zone, independent of how its coordinates were obtained.
 * @typedef {object} QuestZone
 * @property {string} dimensionId Dimension containing the zone.
 * @property {import('@minecraft/server').Vector3} from First corner block, inclusive.
 * @property {import('@minecraft/server').Vector3} to Opposite corner block, inclusive.
 */

/**
 * Settings for the introductory encounter, without world coordinates.
 * @typedef {object} EncounterConfig
 * @property {number} searchDistance Maximum distance to the nearest Lucas.
 * @property {number} stopDistance Horizontal distance to stop from the player.
 * @property {number} walkSpeed Horizontal movement in blocks per tick.
 * @property {number} panTicks Duration of the camera pan after its setup.
 * @property {number} cameraHeight Fixed camera height above the frozen player's feet.
 * @property {number} turnTicks Pause between Lucas facing the player and walking.
 * @property {number} timeoutTicks Maximum total encounter duration.
 * @property {number} stuckTicks Maximum time without approaching the player.
 */

/** @type {EncounterConfig} */
const ENCOUNTER = {
    searchDistance: 32,
    stopDistance: 2,
    walkSpeed: 0.4,
    panTicks: 40,
    cameraHeight: 2.2,
    turnTicks: 8,
    timeoutTicks: 400,
    stuckTicks: 40,
}

/**
 * Player permissions saved before this module takes control.
 * @typedef {object} SavedPermission
 * @property {import('@minecraft/server').InputPermissionCategory} category Input category.
 * @property {boolean} enabled Previously enabled state.
 */

/**
 * A single player's cinematic, with exclusive ownership of one Lucas.
 * @typedef {object} Encounter
 * @property {import('@minecraft/server').Player} player Triggering player.
 * @property {import('@minecraft/server').Entity} lucas Selected coach.
 * @property {import('@minecraft/server').Vector3} position Frozen player position.
 * @property {import('@minecraft/server').Vector3} cameraPosition Fixed camera location.
 * @property {boolean} panStarted Whether the native eased turn has been requested.
 * @property {string} dimensionId Original dimension.
 * @property {number} startedTick Encounter start tick.
 * @property {number} lastProgressTick Last tick with meaningful progress.
 * @property {number} bestDistance Closest approach so far.
 * @property {number} revision Intro test revision at the time of entry.
 */

const RECOVERY_PROPERTY = 'dhsn:operation_freshman_controls'
const SEEN_PROPERTY = 'dhsn:operation_freshman_intro_shown'
const REVISION_PROPERTY = 'dhsn:operation_freshman_intro_revision'

// Restore parent categories before their individual child categories.
/** @type {import('@minecraft/server').InputPermissionCategory[]} */
const INPUT_CATEGORIES = [
    InputPermissionCategory.Movement,
    InputPermissionCategory.LateralMovement,
    InputPermissionCategory.MoveForward,
    InputPermissionCategory.MoveBackward,
    InputPermissionCategory.MoveLeft,
    InputPermissionCategory.MoveRight,
    InputPermissionCategory.Jump,
    InputPermissionCategory.Sneak,
    InputPermissionCategory.Mount,
    InputPermissionCategory.Dismount,
    InputPermissionCategory.Camera,
]

/** @type {Map<string, Encounter>} */
const encounters = new Map()
/** @type {Set<string>} */
const reservedCoaches = new Set()
/** @type {Array<() => void>} */
let zoneCleanups = []
/** @type {boolean} */
let zonesConfigured = false
/** @type {number} */
let dialogueCounter = 0

/**
 * Logs a failure without throwing out of an event or interval callback.
 * @param {unknown} error Failure from a Minecraft API operation.
 * @returns {void}
 */
function logEncounterError(error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[Operation Erstsemester] Begegnung: ${message}`)
}

/**
 * Reads the persistent intro revision, shared by both entrances.
 * @returns {number} Current intro test revision.
 */
function getIntroRevision() {
    const revision = world.getDynamicProperty(REVISION_PROPERTY)
    return typeof revision === 'number' ? revision : 0
}

/**
 * Restores only controls saved by this module, including after script reload.
 * The recovery record remains if an API fails, allowing a later retry.
 * @param {import('@minecraft/server').Player} player Player to recover.
 * @returns {void}
 */
function restorePlayerControls(player) {
    const record = player.getDynamicProperty(RECOVERY_PROPERTY)
    if (typeof record !== 'string') return
    /** @type {SavedPermission[]} */
    const permissions = JSON.parse(record)
    player.camera.clear()
    for (const { category, enabled } of permissions) {
        player.inputPermissions.setPermissionCategory(category, enabled)
    }
    player.setDynamicProperty(RECOVERY_PROPERTY, undefined)
}

/**
 * Releases an encounter on success, cancellation, reset, or error.
 * Invalid/disconnected players retain their recovery record until they return.
 * @param {Encounter} encounter Encounter whose control must be released.
 * @returns {void}
 */
function finishEncounter(encounter) {
    encounters.delete(encounter.player.id)
    reservedCoaches.delete(encounter.lucas.id)
    try {
        if (encounter.lucas.isValid) encounter.lucas.clearVelocity()
    } catch (error) {
        logEncounterError(error)
    }
    try {
        if (encounter.player.isValid) restorePlayerControls(encounter.player)
    } catch (error) {
        logEncounterError(error)
    }
}

/**
 * Chooses the nearest coach in this player's dimension, without stealing a
 * coach reserved by another encounter. Real entrance assignments can be added
 * to the zone configuration later.
 * @param {import('@minecraft/server').Player} player Player entering a zone.
 * @returns {import('@minecraft/server').Entity | undefined} Available nearest coach.
 */
function findLucas(player) {
    const [lucas] = player.dimension.getEntities({
        type: 'dhsn:ersti_coach',
        location: player.location,
        maxDistance: ENCOUNTER.searchDistance,
        closest: 1,
    })
    if (!lucas || reservedCoaches.has(lucas.id)) return undefined
    return lucas
}

/**
 * Computes a view rotation from eye position to a target location.
 * @param {import('@minecraft/server').Vector3} eye View origin.
 * @param {import('@minecraft/server').Vector3} target Location to look at.
 * @returns {import('@minecraft/server').Vector2} Pitch and yaw in degrees.
 */
function getLookRotation(eye, target) {
    const dx = target.x - eye.x
    const dz = target.z - eye.z
    return {
        x: (-Math.atan2(target.y - eye.y, Math.hypot(dx, dz)) * 180) / Math.PI,
        y: (Math.atan2(-dx, dz) * 180) / Math.PI,
    }
}

/**
 * Requests one native eased turn from the fixed camera position towards Lucas.
 * Minecraft interpolates the view on the client; no per-tick rotations are sent.
 * @param {Encounter} encounter Encounter whose camera should pan.
 * @returns {void}
 */
function startCameraPan(encounter) {
    encounter.player.camera.setCamera('minecraft:free', {
        location: encounter.cameraPosition,
        facingLocation: encounter.lucas.getHeadLocation(),
        easeOptions: {
            easeTime: ENCOUNTER.panTicks / 20,
            easeType: EasingType.InOutSine,
        },
    })
    encounter.panStarted = true
}

/**
 * Locks player controls and starts the camera from the current eye rotation.
 * Progress is only recorded after the NPC dialogue actually opens.
 * @param {import('@minecraft/server').Player} player Player entering any quest zone.
 * @returns {void}
 */
function startEncounter(player) {
    if (encounters.has(player.id)) return
    restorePlayerControls(player)
    const revision = getIntroRevision()
    if (player.getDynamicProperty(SEEN_PROPERTY) === revision) return
    const lucas = findLucas(player)
    if (!lucas) return

    const position = { ...player.location }
    // The scripted approach is for a clear route on the same floor.
    if (Math.abs(lucas.location.y - position.y) > 1.25) return
    /** @type {Encounter} */
    const encounter = {
        player,
        lucas,
        position,
        cameraPosition: {
            x: position.x,
            y: position.y + ENCOUNTER.cameraHeight,
            z: position.z,
        },
        panStarted: false,
        dimensionId: player.dimension.id,
        startedTick: system.currentTick,
        lastProgressTick: system.currentTick,
        bestDistance: Infinity,
        revision,
    }
    encounters.set(player.id, encounter)
    reservedCoaches.add(lucas.id)

    try {
        /** @type {SavedPermission[]} */
        const permissions = []
        for (const category of INPUT_CATEGORIES) {
            permissions.push({
                category,
                enabled:
                    player.inputPermissions.isPermissionCategoryEnabled(
                        category
                    ),
            })
        }
        // Persist before disabling anything, so reloads can recover the player.
        player.setDynamicProperty(
            RECOVERY_PROPERTY,
            JSON.stringify(permissions)
        )
        player.inputPermissions.setPermissionCategory(
            InputPermissionCategory.Movement,
            false
        )
        player.inputPermissions.setPermissionCategory(
            InputPermissionCategory.Camera,
            false
        )
        player.clearVelocity()
        lucas.clearVelocity()
        // Match the tested fixed camera above the head, then ease after setup.
        player.camera.clear()
        player.camera.setCamera('minecraft:free', {
            location: encounter.cameraPosition,
            rotation: player.getRotation(),
        })
    } catch (error) {
        finishEncounter(encounter)
        throw error
    }
}

/**
 * Opens the selected coach's existing NPC dialogue for exactly this player.
 * This does not add replacement quest text or complete the welcome dialogue.
 * The native dialogue UI takes over; our cinematic input lock is released.
 * @param {Encounter} encounter Encounter that has reached talking distance.
 * @returns {void}
 */
function openLucasDialogue(encounter) {
    const { player, lucas } = encounter
    const tag = `of_dialogue_${Date.now()}_${dialogueCounter++}`
    lucas.clearVelocity()
    lucas.lookAt(player.getHeadLocation())
    // Synchronize the normal player view once before the cinematic is cleared.
    player.teleport(player.location, {
        rotation: getLookRotation(
            player.getHeadLocation(),
            lucas.getHeadLocation()
        ),
    })
    lucas.addTag(tag)
    try {
        const result = player.runCommand(
            `dialogue open @e[type=dhsn:ersti_coach,tag=${tag},c=1] @s`
        )
        if (result.successCount < 1) {
            throw new Error('Lucas’ Dialog konnte nicht geöffnet werden.')
        }
        player.setDynamicProperty(SEEN_PROPERTY, encounter.revision)
    } finally {
        lucas.removeTag(tag)
    }
    finishEncounter(encounter)
}

/**
 * Advances freeze -> camera pan -> facing -> physical approach -> dialogue.
 * Physical impulses preserve collisions and drive the existing walk animation;
 * this is straight-line movement, not native AI pathfinding around obstacles.
 * @param {Encounter} encounter Active encounter to update.
 * @returns {void}
 */
function updateEncounter(encounter) {
    const { player, lucas, position } = encounter
    if (
        !player.isValid ||
        !lucas.isValid ||
        player.dimension.id !== encounter.dimensionId ||
        lucas.dimension.id !== encounter.dimensionId ||
        player.getComponent('minecraft:health')?.currentValue === 0
    ) {
        finishEncounter(encounter)
        return
    }
    const elapsed = system.currentTick - encounter.startedTick
    if (elapsed > ENCOUNTER.timeoutTicks) {
        throw new Error('Zeitüberschreitung beim Annähern von Lucas.')
    }

    // Also stop drift, gravity, or pushing while the cinematic owns the player.
    const drift = player.location
    if (
        Math.hypot(
            drift.x - position.x,
            drift.y - position.y,
            drift.z - position.z
        ) > 0.03
    ) {
        player.teleport(position)
    }
    player.clearVelocity()
    if (elapsed < 2) return
    if (!encounter.panStarted) startCameraPan(encounter)
    if (elapsed < 2 + ENCOUNTER.panTicks) return
    lucas.lookAt(player.getHeadLocation())
    if (elapsed < 2 + ENCOUNTER.panTicks + ENCOUNTER.turnTicks) return

    const location = lucas.location
    const dx = position.x - location.x
    const dz = position.z - location.z
    const distance = Math.hypot(dx, dz)
    if (Math.abs(position.y - location.y) > 1.25) {
        throw new Error(
            'Lucas und Spieler sind nicht mehr auf derselben Ebene.'
        )
    }
    if (distance <= ENCOUNTER.stopDistance) {
        openLucasDialogue(encounter)
        return
    }
    if (distance < encounter.bestDistance - 0.02) {
        encounter.bestDistance = distance
        encounter.lastProgressTick = system.currentTick
    }
    if (
        system.currentTick - encounter.lastProgressTick >
        ENCOUNTER.stuckTicks
    ) {
        throw new Error('Lucas kann den Spieler nicht erreichen.')
    }

    const speed = Math.min(
        ENCOUNTER.walkSpeed,
        distance - ENCOUNTER.stopDistance
    )
    const velocity = lucas.getVelocity()
    // Correct horizontal velocity rather than adding speed on every tick.
    lucas.applyImpulse({
        x: (dx / distance) * speed - velocity.x,
        y: 0,
        z: (dz / distance) * speed - velocity.z,
    })
}

/**
 * Updates each independent encounter and recovers interrupted input locks.
 * @returns {void}
 */
function tickEncounters() {
    for (const encounter of encounters.values()) {
        try {
            updateEncounter(encounter)
        } catch (error) {
            logEncounterError(error)
            finishEncounter(encounter)
        }
    }
    // Recovery also covers reconnects, respawns, and transient cleanup failures.
    if (system.currentTick % 20 !== 0) return
    for (const player of world.getAllPlayers()) {
        if (encounters.has(player.id)) continue
        try {
            restorePlayerControls(player)
        } catch (error) {
            logEncounterError(error)
        }
    }
}

/**
 * Releases the reserved coach immediately when its player disconnects.
 * @param {import('@minecraft/server').PlayerLeaveAfterEvent} event Leave event.
 * @returns {void}
 */
function onPlayerLeave(event) {
    const encounter = encounters.get(event.playerId)
    if (encounter) finishEncounter(encounter)
}

/**
 * Recovers a player's saved permissions before movement resumes after spawning.
 * @param {import('@minecraft/server').PlayerSpawnAfterEvent} event Spawn event.
 * @returns {void}
 */
function onPlayerSpawn(event) {
    const encounter = encounters.get(event.player.id)
    if (encounter) finishEncounter(encounter)
    try {
        restorePlayerControls(event.player)
    } catch (error) {
        logEncounterError(error)
    }
}

/**
 * Registers player entry detection for a configured quest zone.
 * @param {QuestZone} zone Zone whose entry should be detected.
 * @returns {() => void} Stops detecting entry into this zone.
 */
function registerQuestZone(zone) {
    /**
     * Starts the encounter once per player across all entrance zones.
     * @param {import('../../events/enter-territory.js').TerritoryEvent} event Entry event.
     * @returns {void}
     */
    function onEntry({ player }) {
        try {
            startEncounter(player)
        } catch (error) {
            logEncounterError(error)
        }
    }

    return onEnterTerritory(
        {
            dimension: zone.dimensionId,
            from: zone.from,
            to: zone.to,
            interval: 1,
        },
        onEntry
    )
}

/**
 * Replaces zones and cancels active cinematics, including during /dhsn:r.
 * Reconfiguring zones after startup restarts this intro test for all players,
 * matching the debug reset's shared NPC recreation. The revision survives
 * reloads, so merely reconnecting/reloading does not repeat a shown intro.
 * An empty array removes all current zones.
 * @param {QuestZone[]} zones Zones to monitor for player entry.
 * @returns {void}
 */
export function setQuestZones(zones) {
    for (const encounter of encounters.values()) finishEncounter(encounter)
    for (const cleanup of zoneCleanups) cleanup()
    zoneCleanups = []
    if (zonesConfigured) {
        world.setDynamicProperty(REVISION_PROPERTY, getIntroRevision() + 1)
    }
    zonesConfigured = true
    for (const zone of zones) {
        zoneCleanups.push(registerQuestZone(zone))
    }
}

world.afterEvents.playerLeave.subscribe(onPlayerLeave)
world.afterEvents.playerSpawn.subscribe(onPlayerSpawn)
system.runInterval(tickEncounters, 1)
