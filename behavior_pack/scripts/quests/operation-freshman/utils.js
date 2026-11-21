import { EasingType, InputPermissionCategory, system } from '@minecraft/server'

/**
 * A pending wait in a linear sequence.
 * @typedef {object} SequenceWait
 * @property {() => void} update Checks completion on the next game tick.
 * @property {() => void} cancel Rejects the wait when the sequence is cancelled.
 */

/** Tick-based waits shared by the steps of one cancellable sequence. */
export class Sequence {
    constructor() {
        /** @type {boolean} Whether this sequence has ended or been interrupted. */
        this.cancelled = false
        /** @type {SequenceWait | undefined} The step currently waiting. */
        this.pendingWait = undefined
    }

    /**
     * Prevents a cancelled sequence from starting another action.
     * @returns {void}
     */
    ensureActive() {
        if (this.cancelled) throw new Error('Sequenz abgebrochen.')
    }

    /**
     * Waits for a condition, checking immediately and once per subsequent tick.
     * Exceptions from the condition reject the wait and reach the sequence owner.
     * @param {() => boolean} condition Whether the action has completed.
     * @param {number} [timeoutTicks] Maximum wait duration, if bounded.
     * @param {string} [timeoutMessage] Error reported when the wait times out.
     * @returns {Promise<void>} Resolves on completion; rejects on failure or cancel.
     */
    waitUntil(
        condition,
        timeoutTicks = Infinity,
        timeoutMessage = 'Zeitüberschreitung in der Sequenz.'
    ) {
        this.ensureActive()
        const startedTick = system.currentTick
        /** @type {Promise<void>} */
        const completion = new Promise((resolve, reject) => {
            /** @returns {void} Checks this wait and settles its promise. */
            const update = () => {
                try {
                    this.ensureActive()
                    if (condition()) {
                        this.pendingWait = undefined
                        resolve()
                        return
                    }
                    if (system.currentTick - startedTick > timeoutTicks) {
                        throw new Error(timeoutMessage)
                    }
                } catch (error) {
                    this.pendingWait = undefined
                    reject(error)
                }
            }
            /** @returns {void} Releases this wait when its owner cancels. */
            const cancel = () => {
                this.pendingWait = undefined
                reject(new Error('Sequenz abgebrochen.'))
            }
            this.pendingWait = { update, cancel }
            update()
        })
        return completion
    }

    /**
     * Waits a fixed number of game ticks without blocking the game.
     * @param {number} ticks Duration of the pause.
     * @returns {Promise<void>} Resolves after the pause; rejects on cancellation.
     */
    waitTicks(ticks) {
        const endTick = system.currentTick + ticks
        return this.waitUntil(() => system.currentTick >= endTick)
    }

    /**
     * Advances the current wait from the owner's tick handler.
     * @returns {void}
     */
    update() {
        this.pendingWait?.update()
    }

    /**
     * Cancels the pending wait and prevents later steps from running.
     * @returns {void}
     */
    cancel() {
        this.cancelled = true
        this.pendingWait?.cancel()
    }
}

/**
 * Keeps an entity facing a target for a fixed duration.
 * @param {import('@minecraft/server').Entity} entity Entity to turn.
 * @param {() => import('@minecraft/server').Vector3} getTarget Current target position.
 * @param {number} ticks Duration of the look.
 * @param {Sequence} sequence Owner of the cancellable wait.
 * @returns {Promise<void>} Resolves after the duration; rejects on cancellation.
 */
export function lookAtFor(entity, getTarget, ticks, sequence) {
    const endTick = system.currentTick + ticks
    return sequence.waitUntil(() => {
        entity.lookAt(getTarget())
        return system.currentTick >= endTick
    })
}

/**
 * Input permission state saved before a sequence takes control.
 * @typedef {object} SavedPermission
 * @property {import('@minecraft/server').InputPermissionCategory} category Input category.
 * @property {boolean} enabled Previously enabled state.
 */

/**
 * Physical progress of a single jump.
 * @typedef {object} JumpState
 * @property {number} startY Entity's feet height before takeoff.
 * @property {boolean} leftGround Whether takeoff has been observed.
 */

/**
 * Settings for a straight-line approach.
 * @typedef {object} ApproachOptions
 * @property {number} stopDistance Horizontal distance at which to stop.
 * @property {number} walkSpeed Horizontal movement in blocks per tick.
 * @property {number} stuckTicks Maximum time without meaningful progress.
 */

/**
 * Physical progress of an approach.
 * @typedef {object} ApproachState
 * @property {number} bestDistance Closest horizontal distance reached.
 * @property {number} lastProgressTick Last tick with meaningful progress.
 */

// Keep the existing keys and permission record format for reload recovery.
const RECOVERY_PROPERTY = 'dhsn:operation_freshman_controls'
const VISIBILITY_PROPERTY = 'dhsn:operation_freshman_invisible'

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

/**
 * Hides the player without particles, leaving existing invisibility untouched.
 * If that effect expires, the sequence can supply its own temporary effect.
 * @param {import('@minecraft/server').Player} player Player to hide.
 * @param {number} durationTicks Duration of invisibility added by this module.
 * @returns {void}
 */
export function hidePlayerForEncounter(player, durationTicks) {
    if (player.getEffect('invisibility')) return
    player.setDynamicProperty(VISIBILITY_PROPERTY, true)
    const effect = player.addEffect('invisibility', durationTicks, {
        showParticles: false,
    })
    if (!effect) {
        throw new Error(
            'Spieler konnte für die Kamerafahrt nicht versteckt werden.'
        )
    }
}

/**
 * Removes only invisibility added by this module, including after reload.
 * @param {import('@minecraft/server').Player} player Player whose model can return.
 * @returns {void}
 */
function restorePlayerVisibility(player) {
    if (player.getDynamicProperty(VISIBILITY_PROPERTY) !== true) return
    player.removeEffect('invisibility')
    player.setDynamicProperty(VISIBILITY_PROPERTY, undefined)
}

/**
 * Saves input permissions persistently, freezes input, and hides the player.
 * @param {import('@minecraft/server').Player} player Player to freeze.
 * @param {number} invisibilityTicks Duration of the temporary hiding effect.
 * @returns {void}
 */
export function freezePlayer(player, invisibilityTicks) {
    /** @type {SavedPermission[]} */
    const permissions = []
    for (const category of INPUT_CATEGORIES) {
        permissions.push({
            category,
            enabled:
                player.inputPermissions.isPermissionCategoryEnabled(category),
        })
    }
    // Save before changing anything, so partial failures and reloads can recover.
    player.setDynamicProperty(RECOVERY_PROPERTY, JSON.stringify(permissions))
    player.inputPermissions.setPermissionCategory(
        InputPermissionCategory.Movement,
        false
    )
    player.inputPermissions.setPermissionCategory(
        InputPermissionCategory.Camera,
        false
    )
    player.clearVelocity()
    hidePlayerForEncounter(player, invisibilityTicks)
    player.camera.clear()
}

/**
 * Restores saved controls, camera, and owned invisibility after a sequence.
 * Records remain on failure so recovery can retry after a reload or respawn.
 * @param {import('@minecraft/server').Player} player Player to recover.
 * @returns {void}
 */
export function restorePlayerControls(player) {
    const record = player.getDynamicProperty(RECOVERY_PROPERTY)
    if (typeof record !== 'string') {
        restorePlayerVisibility(player)
        return
    }
    /** @type {SavedPermission[]} */
    const permissions = JSON.parse(record)
    player.camera.clear()
    restorePlayerVisibility(player)
    for (const { category, enabled } of permissions) {
        player.inputPermissions.setPermissionCategory(category, enabled)
    }
    player.setDynamicProperty(RECOVERY_PROPERTY, undefined)
}

/**
 * Prevents drift without sending repeated teleports while the player is still.
 * Also maintains temporary invisibility for an eye-level camera.
 * @param {import('@minecraft/server').Player} player Frozen player.
 * @param {import('@minecraft/server').Vector3} position Position to hold.
 * @param {number} invisibilityTicks Duration of any replacement hiding effect.
 * @returns {void}
 */
export function holdPlayerPosition(player, position, invisibilityTicks) {
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
    hidePlayerForEncounter(player, invisibilityTicks)
}

/**
 * Initializes a stationary free camera using the current player view rotation.
 * @param {import('@minecraft/server').Player} player Owner of the camera.
 * @param {import('@minecraft/server').Vector3} position Fixed camera position.
 * @returns {void}
 */
export function initializePlayerCamera(player, position) {
    player.camera.setCamera('minecraft:free', {
        location: position,
        rotation: player.getRotation(),
    })
}

/**
 * Sends one native eased camera turn for the client to interpolate.
 * @param {import('@minecraft/server').Player} player Owner of the camera.
 * @param {import('@minecraft/server').Vector3} position Fixed camera position.
 * @param {import('@minecraft/server').Vector3} target Location to face.
 * @param {number} durationTicks Duration of the camera turn.
 * @returns {void}
 */
export function panCameraTowards(player, position, target, durationTicks) {
    player.camera.setCamera('minecraft:free', {
        location: position,
        facingLocation: target,
        easeOptions: {
            easeTime: durationTicks / 20,
            easeType: EasingType.InOutSine,
        },
    })
}

/**
 * Starts one physical hop.
 * @param {import('@minecraft/server').Entity} entity Entity to jump.
 * @param {number} impulse Upward impulse.
 * @returns {JumpState} State used to observe takeoff and landing.
 */
export function startJump(entity, impulse) {
    const startY = entity.location.y
    entity.clearVelocity()
    entity.applyImpulse({ x: 0, y: impulse, z: 0 })
    return { startY, leftGround: false }
}

/**
 * Observes actual takeoff and landing without confusing the apex with landing.
 * @param {import('@minecraft/server').Entity} entity Jumping entity.
 * @param {JumpState} jump Mutable physical jump progress.
 * @returns {boolean} Whether the entity has landed after taking off.
 */
export function hasLanded(entity, jump) {
    const height = entity.location.y - jump.startY
    if (!entity.isOnGround || height > 0.03) jump.leftGround = true
    return (
        jump.leftGround &&
        entity.isOnGround &&
        Math.abs(height) < 0.1 &&
        Math.abs(entity.getVelocity().y) < 0.05
    )
}

/**
 * Advances a physical straight-line approach, preserving block collisions.
 * @param {import('@minecraft/server').Entity} entity Entity to move.
 * @param {import('@minecraft/server').Vector3} target Destination to approach.
 * @param {ApproachOptions} options Speed, stopping distance, and stuck timeout.
 * @param {ApproachState} progress Mutable approach progress.
 * @returns {boolean} Whether the entity is within stopping distance.
 * @throws {Error} If movement changes floors or stops making progress.
 */
export function updateApproach(entity, target, options, progress) {
    const location = entity.location
    const dx = target.x - location.x
    const dz = target.z - location.z
    const distance = Math.hypot(dx, dz)
    if (Math.abs(target.y - location.y) > 1.25) {
        throw new Error(
            'Lucas und Spieler sind nicht mehr auf derselben Ebene.'
        )
    }
    if (distance <= options.stopDistance) return true
    if (distance < progress.bestDistance - 0.02) {
        progress.bestDistance = distance
        progress.lastProgressTick = system.currentTick
    }
    if (system.currentTick - progress.lastProgressTick > options.stuckTicks) {
        throw new Error('Lucas kann den Spieler nicht erreichen.')
    }

    const speed = Math.min(options.walkSpeed, distance - options.stopDistance)
    const velocity = entity.getVelocity()
    entity.applyImpulse({
        x: (dx / distance) * speed - velocity.x,
        y: 0,
        z: (dz / distance) * speed - velocity.z,
    })
    return false
}

/**
 * Computes pitch and yaw from eye position to a target location.
 * @param {import('@minecraft/server').Vector3} eye View origin.
 * @param {import('@minecraft/server').Vector3} target Location to face.
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
 * Opens the map's single NPC of this type for the map's player.
 * Synchronizes the normal player view once before the free camera is cleared.
 * @param {import('@minecraft/server').Player} player Player receiving the dialogue.
 * @param {import('@minecraft/server').Entity} npc Guaranteed map NPC.
 * @returns {void}
 */
export function openNpcDialogue(player, npc) {
    npc.clearVelocity()
    npc.lookAt(player.getHeadLocation())
    player.teleport(player.location, {
        rotation: getLookRotation(
            player.getHeadLocation(),
            npc.getHeadLocation()
        ),
    })
    const result = player.runCommand(`dialogue open @e[type=${npc.typeId}] @s`)
    if (result.successCount < 1) {
        throw new Error('NPC-Dialog konnte nicht geöffnet werden.')
    }
}

/**
 * Stops remaining motion during cleanup, even if a debug reset removed the NPC.
 * @param {import('@minecraft/server').Entity} entity Sequence's entity reference.
 * @returns {void}
 */
export function stopEntityOnCleanup(entity) {
    try {
        entity.clearVelocity()
    } catch {
        // /dhsn:r recreates NPCs before it cancels the old sequence.
    }
}
