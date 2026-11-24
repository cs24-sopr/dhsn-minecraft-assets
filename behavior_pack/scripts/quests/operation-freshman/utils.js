import {
    EasingType,
    InputPermissionCategory,
    system,
    world,
} from '@minecraft/server'

import * as Config from './config.js'
import * as Persist from './persist.js'

/**
 * Outcomes of a walk; invalid arguments and unexpected API failures still reject.
 * @typedef {'arrived' | 'interrupted' | 'cancelled'} WalkToOutcome
 */

/**
 * Reasons a walk cannot start or continue.
 * @typedef {'entity_invalid' | 'target_invalid' | 'dimension_mismatch' | 'dimension_changed' | 'timeout'} WalkToCancellationReason
 */

/** Reports a walk's outcome and lets callers require a particular outcome. */
export class WalkToResult {
    /**
     * Creates a result for a completed, interrupted, or cancelled walk.
     * @param {WalkToOutcome} outcome Outcome reported by the walk.
     * @param {WalkToCancellationReason} [reason] Reason for a cancelled outcome.
     */
    constructor(outcome, reason) {
        /** @type {WalkToOutcome} @readonly Outcome of this walk. */
        this.outcome = outcome
        /** @type {WalkToCancellationReason | undefined} @readonly Present only for cancellation. */
        this.reason = outcome === 'cancelled' ? reason : undefined
    }

    /**
     * Requires this result to have the expected outcome.
     * @param {WalkToOutcome} expectedOutcome Outcome required by the caller.
     * @param {string} message Error message if the outcome does not match.
     * @returns {void}
     * @throws {Error} With the supplied message if the outcome does not match.
     */
    expect(expectedOutcome, message) {
        if (this.outcome !== expectedOutcome) throw new Error(message)
    }
}

/** @type {Map<string, () => void>} Interruption callbacks for the current walk in each dimension. */
const activeWalks = new Map()

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
 * Waits for an entity to touch the ground, resolving immediately if already grounded.
 * Checks once per server tick without changing movement or input permissions.
 * @param {import('@minecraft/server').Entity} entity Entity whose ground contact to await.
 * @param {number} [timeoutTicks=100] Positive integer limit for waiting, in server ticks.
 * @returns {Promise<void>} Resolves when the entity is on the ground.
 * @throws {Error} If the timeout is invalid, the entity becomes invalid, or landing times out.
 */
export async function onGround(entity, timeoutTicks = 100) {
    if (!Number.isInteger(timeoutTicks) || timeoutTicks <= 0) {
        throw new Error(
            'Die Wartezeit muss eine positive, ganze Tickzahl sein.'
        )
    }

    await waitUntil(
        timeoutTicks,
        'Die Entität hat den Boden nicht rechtzeitig erreicht.',
        () => {
            if (!entity.isValid) {
                throw new Error(
                    'Die Entität ist beim Warten auf Bodenkontakt nicht mehr gültig.'
                )
            }
            return entity.isOnGround
        }
    )
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
        if (player.dimension.id !== entity.dimension.id) {
            throw new Error(
                'Die Entität oder der Spieler sind nicht in derselben Dimension.'
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
 * Uses the entity's native follow behavior to walk toward a player or marker entity.
 * Requires the follow events and target filter configured on dhsn:ersti_coach.
 * A new walk interrupts the previous walk in the same dimension, since the target
 * filter uses a shared tag. The timeout starts after the previous follow behavior
 * has stopped. Arrival allows a small tolerance
 * around the two-block stop distance configured in the entity JSON.
 * Clears the shared target tag from loaded entities in the dimension before
 * assigning it to the new target, including tags left by a previous script load.
 * Stops following, clears remaining velocity, and removes its own tag in finally.
 * @todo Replace the total-duration timeout with an inactivity timeout: cancel as
 * stuck only after no meaningful position change for a configured number of ticks.
 * Measure displacement from a reference position so slow movement accumulates,
 * ignore small physics jitter, and allow detours that increase distance to the target.
 * @todo Investigate the observed roughly two-second pause before movement starts,
 * even after the hop and turn have finished. The native startup cause is unconfirmed.
 * Compare enabling the follow behavior beforehand and assigning the target tag only
 * when walking should begin, to distinguish behavior activation from target acquisition
 * or navigation startup. If keeping the behavior enabled, ensure cleanup still stops
 * movement reliably when the target tag is removed.
 * @param {import('@minecraft/server').Entity} entity Entity that should walk.
 * @param {import('@minecraft/server').Entity} target Player or marker to approach.
 * @param {number} arrivalDistance Positive number of distance for for measure of arrival
 * @param {number} [timeoutTicks=400] Positive integer limit for the active walk.
 * @returns {Promise<WalkToResult>} Arrival, interruption, or cancellation result, after cleanup.
 * @throws {Error} If the timeout is invalid, the entity targets itself, or an API operation fails.
 */
export async function walkTo(
    entity,
    target,
    arrivalDistance,
    timeoutTicks = 400
) {
    if (!Number.isInteger(timeoutTicks) || timeoutTicks <= 0) {
        throw new Error(
            'Die Wartezeit muss eine positive, ganze Tickzahl sein.'
        )
    }

    if (entity.id === target.id) {
        throw new Error(
            'Die Entität kann sich nicht selbst als Laufziel haben.'
        )
    }

    /** @type {boolean} Whether a newer walk has replaced this call. */
    let interrupted = false

    /**
     * Reports replacement or world state that prevents starting or continuing.
     * @param {string} [startDimensionId] Original dimension, once the walk has started.
     * @returns {WalkToResult | undefined} A terminal result, or undefined while viable.
     */
    function getStoppedResult(startDimensionId) {
        if (interrupted) return new WalkToResult('interrupted')
        if (!entity.isValid) {
            return new WalkToResult('cancelled', 'entity_invalid')
        }
        if (!target.isValid) {
            return new WalkToResult('cancelled', 'target_invalid')
        }
        const entityDimensionId = entity.dimension.id
        if (entityDimensionId !== target.dimension.id) {
            return new WalkToResult('cancelled', 'dimension_mismatch')
        }
        if (
            startDimensionId !== undefined &&
            entityDimensionId !== startDimensionId
        ) {
            return new WalkToResult('cancelled', 'dimension_changed')
        }
    }

    // Use the same world-state checks before setup and during the active walk.
    const startResult = getStoppedResult()
    if (startResult) return startResult
    const dimension = entity.dimension

    /** @type {string} Must match the follow_mob filter in ersti_coach.behavior.json. */
    const targetTag = 'dhsn:lucas_follow_target'

    /** @type {boolean} Whether this call added the target tag. */
    let addedTargetTag = false

    /** @type {boolean} Whether starting native following was attempted. */
    let followingStarted = false

    /**
     * Stops this call's follow behavior and removes its own tag, at most once.
     * @returns {void}
     */
    function cleanup() {
        try {
            if (followingStarted) {
                followingStarted = false
                if (entity.isValid) {
                    try {
                        entity.triggerEvent('dhsn:stop_following')
                    } finally {
                        if (entity.isValid) entity.clearVelocity()
                    }
                }
            }
        } finally {
            if (addedTargetTag) {
                addedTargetTag = false
                if (target.isValid) target.removeTag(targetTag)
            }
        }
    }

    /**
     * Interrupts this walk and immediately releases its follow behavior and target.
     * @returns {void}
     */
    function interruptWalk() {
        interrupted = true
        cleanup()
    }

    /**
     * Checks arrival without treating a target on another floor as reached.
     * Called only after checking that participants remain valid in this dimension.
     * @returns {boolean} Whether the entity is grounded and within talking distance.
     */
    function hasArrived() {
        const location = entity.location
        const destination = target.location
        return (
            entity.isOnGround &&
            Math.abs(destination.y - location.y) <= 1 &&
            Math.hypot(
                destination.x - location.x,
                destination.y - location.y,
                destination.z - location.z
            ) <= arrivalDistance
        )
    }

    /**
     * Checks arrival, interruption, cancellation, or expiration of the time limit.
     * Finishes at the limit so a timeout becomes a result instead of an exception.
     * @param {number} elapsedTicks Server ticks spent waiting for this walk.
     * @returns {boolean} Whether waiting for this walk should finish.
     */
    function hasFinished(elapsedTicks) {
        return (
            getStoppedResult(dimension.id) !== undefined ||
            hasArrived() ||
            elapsedTicks >= timeoutTicks
        )
    }

    const interruptPreviousWalk = activeWalks.get(dimension.id)
    interruptPreviousWalk?.()
    activeWalks.set(dimension.id, interruptWalk)

    try {
        // Allow the previous stop event to apply before starting a new follow goal.
        if (interruptPreviousWalk) await system.waitTicks(1)
        const initialResult = getStoppedResult(dimension.id)
        if (initialResult) return initialResult
        const arrived = hasArrived()

        for (const candidate of dimension.getEntities({ tags: [targetTag] })) {
            candidate.removeTag(targetTag)
        }
        if (arrived) return new WalkToResult('arrived')

        addedTargetTag = target.addTag(targetTag)
        entity.clearVelocity()
        followingStarted = true
        entity.triggerEvent('dhsn:start_following')

        await waitUntil(
            timeoutTicks,
            'Die Entität konnte das Laufziel nicht rechtzeitig erreichen.',
            hasFinished
        )
        const stoppedResult = getStoppedResult(dimension.id)
        if (stoppedResult) return stoppedResult
        if (hasArrived()) return new WalkToResult('arrived')
        return new WalkToResult('cancelled', 'timeout')
    } finally {
        // A replaced call must never stop or untag its successor's walk.
        if (activeWalks.get(dimension.id) === interruptWalk) {
            try {
                cleanup()
                await system.waitTicks(1)
            } finally {
                if (activeWalks.get(dimension.id) === interruptWalk) {
                    activeWalks.delete(dimension.id)
                }
            }
        }
    }
}

/**
 * Reuses or spawns Frau Sommer, then applies the configured study office position and rotation.
 * @param {'113' | '114'} room Study office room whose placement to use.
 * @returns {import('@minecraft/server').Entity} The existing or newly spawned Frau Sommer entity.
 * @throws {Error} If querying, spawning, or configuring the entity fails.
 */
export function spawnMrsSommer(room) {
    const dimension = world.getDimension(Config.MRS_SOMMER.dimensionId)

    const existingSommer = dimension.getEntities({
        type: 'dhsn:studienorganisation',
    })[0]

    const { position, rotation } = Config.MRS_SOMMER.spawn[room]

    const sommer =
        existingSommer ??
        dimension.spawnEntity('dhsn:studienorganisation', position)

    sommer.nameTag = 'Frau Sommer'
    sommer.teleport(position, { rotation })

    return sommer
}

/**
 * Checks whether a page requests the course dropdown.
 * @param {import('./persist.js').PlayerCourse} playerCourse Player course
 * @returns {'113' | '114'}
 */
export function getMrsSommerRoom(playerCourse) {
    if (
        playerCourse === 'computer-science' ||
        playerCourse === 'sustainable-engineering'
    ) {
        return '113'
    }

    return '114'
}

/** @type {string} Existing coach entity type; every instance participates in this quest. */
const LUCAS_TYPE = 'dhsn:ersti_coach'

/**
 * Removes other loaded coaches after an entrance has been claimed.
 * The selected ID remains authoritative even if its entity is currently unloaded.
 * @returns {void}
 * @throws {Error} If storage, entity queries, or removal fails.
 */
export function removeOtherLucases() {
    const selectedId = Persist.readSelectedLucasId()
    if (!selectedId) return

    for (const dimensionId of ['overworld', 'nether', 'the_end']) {
        for (const lucas of world
            .getDimension(dimensionId)
            .getEntities({ type: LUCAS_TYPE })) {
            if (lucas.id !== selectedId) lucas.remove()
        }
    }
}

/**
 * Selects the nearest loaded coach in the entering player's dimension.
 * Equal distances are resolved by entity ID. A saved selection is never replaced.
 * @param {import('@minecraft/server').Player} player Player entering a quest zone.
 * @returns {import('@minecraft/server').Entity | undefined} Selected loaded coach.
 * @throws {Error} If querying entities or saving the selection fails.
 */
export function selectLucas(player) {
    const selectedId = Persist.readSelectedLucasId()
    const candidates = player.dimension.getEntities({ type: LUCAS_TYPE })
    if (selectedId) {
        return candidates.find((lucas) => lucas.id === selectedId)
    }

    const origin = player.location
    /**
     * Computes squared distance without changing the entity's location.
     * @param {import('@minecraft/server').Entity} entity Candidate coach.
     * @returns {number} Squared distance from the entering player.
     */
    function distanceSquared(entity) {
        const location = entity.location
        return (
            (location.x - origin.x) ** 2 +
            (location.y - origin.y) ** 2 +
            (location.z - origin.z) ** 2
        )
    }

    /**
     * Orders loaded coaches by distance, then by stable identity for ties.
     * @param {import('@minecraft/server').Entity} left First candidate.
     * @param {import('@minecraft/server').Entity} right Second candidate.
     * @returns {number} Candidate ordering.
     */
    function compareCandidates(left, right) {
        return (
            distanceSquared(left) - distanceSquared(right) ||
            left.id.localeCompare(right.id)
        )
    }

    candidates.sort(compareCandidates)
    const lucas = candidates[0]
    if (lucas) Persist.writeSelectedLucasId(lucas.id)
    return lucas
}

/**
 * Removes a previously unloaded duplicate when its chunk becomes available.
 * @param {import('@minecraft/server').EntityLoadAfterEvent} event Loaded entity.
 * @returns {void}
 */
function onEntityLoad(event) {
    const entity = event.entity
    if (entity.typeId !== LUCAS_TYPE) return

    try {
        const selectedId = Persist.readSelectedLucasId()
        if (selectedId && entity.id !== selectedId) entity.remove()
    } catch (error) {
        console.error(`[Operation Erstsemester]: ${String(error)}`)
    }
}

world.afterEvents.entityLoad.subscribe(onEntityLoad)
system.run(() => {
    try {
        removeOtherLucases()
    } catch (error) {
        console.error(`[Operation Erstsemester]: ${String(error)}`)
    }
})
