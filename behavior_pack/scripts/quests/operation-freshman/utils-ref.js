import {
    EasingType,
    InputPermissionCategory,
    system,
    world,
} from '@minecraft/server'

/**
 * Checks a condition once per tick
 * @param {number} timeoutTicks Server ticks until timeout
 * @param {string} timeoutMessage Error message if the condition is not reached.
 * @param {(elapsedTicks: number) => boolean} predicate Condition that completes the wait.
 * @returns {Promise<void>} Resolves when the condition is met.
 */
async function waitUntil(timeoutTicks, timeoutMessage, predicate) {
    for (let elapsed = 0; elapsed <= timeoutTicks; elapsed++) {
        if (predicate(elapsed)) return
        if (elapsed < timeoutTicks) await system.waitTicks(1)
    }

    throw new Error(timeoutMessage)
}

/**
 * A state wrapper that activates before an action and cleans up in finally.
 * @template T
 * @typedef {(action: () => T | Promise<T>) => Promise<T>} StateScope
 */

/**
 * Effects and the action to run inside them.
 * @template T
 * @typedef {object} EffectStackOptions
 * @property {StateScope<T>[]} effects State wrappers, outermost first.
 * @property {() => T | Promise<T>} action Action performed with all states active.
 */

/**
 * Runs an action inside a flat list of state wrappers.
 * Effects activate in array order and their finally blocks unwind in reverse.
 * Each wrapper remains responsible for its own setup and cleanup.
 * @template T
 * @param {EffectStackOptions<T>} options Effects and the action to wrap.
 * @returns {Promise<T>} The action's result; propagates wrapper or action failures.
 */
export async function withEffectStack({ effects, action }) {
    /** @type {() => T | Promise<T>} Action wrapped by the states processed so far. */
    let run = action

    for (let index = effects.length - 1; index >= 0; index--) {
        const state = effects[index]
        const next = run
        /** @returns {Promise<T>} Runs the next action inside this state. */
        run = () => state(next)
    }

    return await run()
}

/**
 * Keeps the player frozen until the supplied action finishes.
 * @template T
 * @param {import('@minecraft/server').Player} player Player to freeze.
 * @param {() => T | Promise<T>} action Action performed while frozen.
 * @returns {Promise<T>} The action's result.
 */
export async function freezeUntil(player, action) {
    try {
        player.inputPermissions.setPermissionCategory(
            InputPermissionCategory.Movement,
            false
        )
        player.inputPermissions.setPermissionCategory(
            InputPermissionCategory.Camera,
            false
        )

        player.clearVelocity()

        return await action()
    } finally {
        player.inputPermissions.setPermissionCategory(
            InputPermissionCategory.Movement,
            true
        )
        player.inputPermissions.setPermissionCategory(
            InputPermissionCategory.Camera,
            true
        )
    }
}

/**
 * Computes the view rotation from an eye position to a target.
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
 * Pans from the player's current view to a target, then tracks it during the action.
 * Applies a configured camera-position offset relative to the player's head.
 * The action starts after the initial one-second pan has finished.
 * Tracking updates use short linear easing and settle before normal view resumes.
 * Synchronizes the player with the last camera direction before restoring normal view.
 * A tracking failure does not cancel the supplied action.
 * @template T
 * @param {import('@minecraft/server').Player} player Player whose view is controlled.
 * @param {() => import('@minecraft/server').Vector3} getTargetPosition Current target position.
 * @param {() => T | Promise<T>} action Action performed while tracking the target.
 * @returns {Promise<T>} The action's result; rejects if the action or tracking fails.
 */
export async function lookAtUntil(player, getTargetPosition, action) {
    /** @type {number | undefined} Handle for the camera tracking interval. */
    let trackingRun
    /** @type {import('@minecraft/server').Vector2 | undefined} Destination of the last camera turn. */
    let lastCameraRotation
    /** @type {boolean} Whether a tracking transition needs time to finish during cleanup. */
    let trackingEasePending = false
    /** @type {number} Duration of the initial eased turn, matching the old sequence. */
    const panTicks = 20
    /** @type {number} Duration of each linear tracking transition, in ticks. */
    const trackingEaseTicks = 2

    /** @type {import('@minecraft/server').Vector3} Camera offset from the player's head, in blocks. */
    const cameraOffset = { x: 0, y: 0.1, z: 0 }

    /**
     * Gets the camera origin with the configured position offset applied.
     * @returns {import('@minecraft/server').Vector3} Offset camera position.
     */
    function getCameraPosition() {
        const head = player.getHeadLocation()
        return {
            x: head.x + cameraOffset.x,
            y: head.y + cameraOffset.y,
            z: head.z + cameraOffset.z,
        }
    }

    /**
     * Updates the camera from the player's current eye position to the target.
     * @returns {void}
     */
    function updateView() {
        const eye = getCameraPosition()
        const target = getTargetPosition()
        player.camera.setCamera('minecraft:free', {
            location: eye,
            facingLocation: target,
            easeOptions: {
                easeTime: trackingEaseTicks / 20,
                easeType: EasingType.Linear,
            },
        })
        lastCameraRotation = getLookRotation(eye, target)
        trackingEasePending = true
    }

    try {
        // Let the outer invisibility effect reach the client before entering the head.
        await system.waitTicks(2)
        const cameraPosition = getCameraPosition()
        player.camera.setCamera('minecraft:free', {
            location: cameraPosition,
            rotation: player.getRotation(),
        })

        // Initialize the free camera before sending the eased turn.
        await system.waitTicks(2)
        const panTarget = { ...getTargetPosition() }
        player.camera.setCamera('minecraft:free', {
            location: cameraPosition,
            facingLocation: panTarget,
            easeOptions: {
                easeTime: panTicks / 20,
                easeType: EasingType.InOutSine,
            },
        })
        await system.waitTicks(panTicks)
        lastCameraRotation = getLookRotation(cameraPosition, panTarget)

        // Per-tick updates start after the pan so they cannot overwrite its easing.
        /** @type {Promise<never>} Rejects if a later camera update fails. */
        const trackingFailure = new Promise((_resolve, reject) => {
            /** @returns {void} Tracks the target or reports an update failure. */
            function trackTarget() {
                if (trackingRun === undefined) return
                try {
                    updateView()
                } catch (error) {
                    reject(error)
                }
            }
            trackingRun = system.runInterval(trackTarget, 1)
        })

        return await Promise.race([action(), trackingFailure])
    } finally {
        if (trackingRun !== undefined) system.clearRun(trackingRun)
        trackingRun = undefined
        try {
            // Stop sending updates, then let the final tracking turn reach its destination.
            if (trackingEasePending && player.isValid) {
                await system.waitTicks(trackingEaseTicks)
            }
            if (player.isValid && lastCameraRotation) {
                player.teleport(player.location, {
                    rotation: lastCameraRotation,
                })
            }
        } finally {
            // Let the player rotation reach the client before restoring normal view.
            await system.waitTicks(1)
            if (player.isValid) player.camera.clear()
        }
    }
}

/**
 * Keeps the player invisible until the supplied action finishes.
 * Leaves existing invisibility untouched until it expires and removes only
 * invisibility added by this wrapper. Short effects are refreshed internally
 * so they expire naturally if a script reload interrupts cleanup.
 * A refresh failure does not cancel the supplied action.
 * @template T
 * @param {import('@minecraft/server').Player} player Player to hide.
 * @param {() => T | Promise<T>} action Action performed while invisible.
 * @returns {Promise<T>} The action's result; rejects if the action or refresh fails.
 */
export async function invisibleUntil(player, action) {
    /** @type {number | undefined} Handle for the invisibility refresh interval. */
    let refreshRun
    /** @type {boolean} Whether this wrapper has applied its own invisibility. */
    let addedInvisibility = false

    /**
     * Applies or renews invisibility without replacing a pre-existing effect.
     * @returns {void}
     */
    function maintainInvisibility() {
        const effect = player.getEffect('invisibility')
        if (effect && (!addedInvisibility || effect.duration > 20)) return
        player.addEffect('invisibility', 40, { showParticles: false })
        addedInvisibility = true
    }

    try {
        maintainInvisibility()

        /** @type {Promise<never>} Rejects if a later invisibility refresh fails. */
        const refreshFailure = new Promise((_resolve, reject) => {
            /** @returns {void} Maintains invisibility or reports a refresh failure. */
            function refreshInvisibility() {
                try {
                    maintainInvisibility()
                } catch (error) {
                    reject(error)
                }
            }
            refreshRun = system.runInterval(refreshInvisibility, 1)
        })

        return await Promise.race([action(), refreshFailure])
    } finally {
        if (refreshRun !== undefined) system.clearRun(refreshRun)
        if (addedInvisibility && player.isValid) {
            player.removeEffect('invisibility')
        }
    }
}

/**
 * Makes an entity hop once and waits for takeoff followed by an actual landing.
 * Requires an entity with gravity and a solid surface to land on.
 * @param {import('@minecraft/server').Entity} entity Entity to make hop.
 * @param {number} [impulse=0.42] Positive upward impulse applied after clearing velocity.
 * @returns {Promise<void>} Resolves after landing with near-zero vertical velocity.
 * @throws {Error} If the impulse is invalid, the entity becomes invalid, or a wait times out.
 */
export async function hop(entity, impulse = 0.42) {
    if (!Number.isFinite(impulse) || impulse <= 0) {
        throw new Error(
            'Der Sprungimpuls muss eine positive, endliche Zahl sein.'
        )
    }

    /**
     * Ensures the entity can still participate in the hop.
     * @returns {void}
     * @throws {Error} If the entity is no longer valid.
     */
    function checkEntityValid() {
        if (!entity.isValid) {
            throw new Error('Die Entität ist für den Sprung nicht mehr gültig.')
        }
    }

    /**
     * Checks whether the entity is ready to start the hop.
     * @returns {boolean} Whether the entity is on the ground.
     * @throws {Error} If the entity is no longer valid.
     */
    function entityIsReady() {
        checkEntityValid()
        return entity.isOnGround
    }

    /** @type {number} Maximum ticks for initial ground contact and, separately, the hop. */
    const timeoutTicks = 40

    await waitUntil(
        timeoutTicks,
        'Die Entität steht für den Sprung nicht auf dem Boden.',
        entityIsReady
    )

    const startY = entity.location.y
    /** @type {boolean} Whether takeoff has been observed since applying the impulse. */
    let leftGround = false

    entity.clearVelocity()
    entity.applyImpulse({ x: 0, y: impulse, z: 0 })

    /** @returns {boolean} Whether the entity has landed after an observed takeoff. */
    function entityHasLanded() {
        checkEntityValid()

        const onGround = entity.isOnGround
        if (!onGround || entity.location.y - startY > 0.03) leftGround = true
        return leftGround && onGround && Math.abs(entity.getVelocity().y) < 0.05
    }

    // Let physics advance before checking whether the impulse caused takeoff.
    await system.waitTicks(1)
    await waitUntil(
        timeoutTicks,
        'Die Entität konnte den Sprung nicht abschließen.',
        entityHasLanded
    )
}

/**
 * Turns an entity toward the player's head position at the start of the turn.
 * Eases pitch and yaw over the configured duration, taking the shortest yaw path.
 * @param {import('@minecraft/server').Player} player Player to face.
 * @param {import('@minecraft/server').Entity} entity Entity to turn.
 * @param {number} [turnTicks=8] Positive integer duration of the turn, in server ticks.
 * @returns {Promise<void>} Resolves after the final rotation has been applied.
 * @throws {Error} If the duration is invalid, either participant becomes invalid,
 * or the participants are in different dimensions.
 */
export async function turnToPlayer(player, entity, turnTicks = 8) {
    if (!Number.isInteger(turnTicks) || turnTicks <= 0) {
        throw new Error(
            'Die Drehdauer muss eine positive, ganze Tickzahl sein.'
        )
    }

    /**
     * Ensures both participants can still take part in the turn.
     * @returns {void}
     * @throws {Error} If a participant is invalid or their dimensions differ.
     */
    function checkParticipantsValid() {
        if (!entity.isValid || !player.isValid) {
            throw new Error(
                'Die Entität oder der Spieler ist nicht mehr gültig.'
            )
        }
    }

    checkParticipantsValid()
    const startRotation = entity.getRotation()
    const eye = entity.getHeadLocation()
    const target = player.getHeadLocation()
    const targetRotation = getLookRotation(eye, target)

    // Keep the existing yaw when the player is directly above or below the entity.
    if (Math.hypot(target.x - eye.x, target.z - eye.z) < 0.0001) {
        targetRotation.y = startRotation.y
    }

    const yawDifference =
        ((((targetRotation.y - startRotation.y + 180) % 360) + 360) % 360) - 180

    for (let tick = 1; tick <= turnTicks; tick++) {
        await system.waitTicks(1)
        checkParticipantsValid()

        const progress = (1 - Math.cos((tick / turnTicks) * Math.PI)) / 2
        entity.setRotation({
            x:
                startRotation.x +
                (targetRotation.x - startRotation.x) * progress,
            y:
                ((((startRotation.y + yawDifference * progress + 180) % 360) +
                    360) %
                    360) -
                180,
        })
    }
}

/**
 * Try and fetch the entity of lucas
 * @returns {import('@minecraft/server').Entity} The entity of lucas
 */
export function getLucas() {
    const entities = world.getDimension('overworld').getEntities({
        type: 'dhsn:ersti_coach',
    })

    if (entities.length !== 1) {
        throw Error('TODO') // TODO
    }

    return entities[0]
}
