import {
    EasingType,
    InputPermissionCategory,
    system,
    world,
} from '@minecraft/server'

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
 * The action starts after the initial one-second pan has finished.
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
    /** @type {import('@minecraft/server').Vector2 | undefined} Last completed camera direction. */
    let lastCameraRotation
    /** @type {number} Duration of the initial eased turn, matching the old sequence. */
    const panTicks = 20

    /**
     * Updates the camera from the player's current eye position to the target.
     * @returns {void}
     */
    function updateView() {
        const eye = player.getHeadLocation()
        const target = getTargetPosition()
        player.camera.setCamera('minecraft:free', {
            location: eye,
            facingLocation: target,
        })
        lastCameraRotation = getLookRotation(eye, target)
    }

    try {
        // Let the outer invisibility effect reach the client before entering the head.
        await system.waitTicks(2)
        const cameraPosition = player.getHeadLocation()
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
