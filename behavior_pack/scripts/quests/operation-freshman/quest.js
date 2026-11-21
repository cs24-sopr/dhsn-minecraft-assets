import { system, world } from '@minecraft/server'
import { onEnterTerritory } from '../../events/index.js'
import {
    Sequence,
    freezePlayer,
    hasLanded,
    holdPlayerPosition,
    initializePlayerCamera,
    lookAtFor,
    openNpcDialogue,
    panCameraTowards,
    restorePlayerControls,
    startJump,
    stopEntityOnCleanup,
    updateApproach,
} from './utils.js'

/** @type {boolean} Whether Lucas waves before approaching the player. */
const LUCAS_SHOULD_WAVE = false

/**
 * A quest entry zone, independent of how its coordinates were obtained.
 * @typedef {object} QuestZone
 * @property {string} dimensionId Dimension containing the zone.
 * @property {import('@minecraft/server').Vector3} from First corner block, inclusive.
 * @property {import('@minecraft/server').Vector3} to Opposite corner block, inclusive.
 */

/**
 * Timing and movement settings for the introductory sequence.
 * @typedef {object} EncounterConfig
 * @property {number} stopDistance Horizontal distance at which Lucas stops.
 * @property {number} walkSpeed Horizontal movement in blocks per tick.
 * @property {number} panTicks Duration of the camera pan after setup.
 * @property {number} jumpImpulse Upward impulse for Lucas's greeting hop.
 * @property {number} jumpTimeoutTicks Maximum wait for takeoff or landing.
 * @property {number} turnTicks Pause between turning and waving or approaching.
 * @property {number} waveTicks Duration of the existing six-second wave.
 * @property {number} timeoutTicks Maximum total sequence duration.
 * @property {number} stuckTicks Maximum time without approach progress.
 */

/** @type {EncounterConfig} */
const ENCOUNTER = {
    stopDistance: 2,
    walkSpeed: 0.4,
    panTicks: 20,
    jumpImpulse: 0.42,
    jumpTimeoutTicks: 40,
    turnTicks: 8,
    // Matches animation.ersti_coachwaving without changing the resource asset.
    waveTicks: 120,
    timeoutTicks: 400,
    stuckTicks: 40,
}

/**
 * The single active encounter between the map's player and Lucas.
 * @typedef {object} Encounter
 * @property {import('@minecraft/server').Player} player Map's player.
 * @property {import('@minecraft/server').Entity} lucas Map's single Lucas.
 * @property {import('@minecraft/server').Vector3} position Frozen player position.
 * @property {import('@minecraft/server').Vector3} cameraPosition Fixed eye-level view.
 * @property {Sequence} sequence Cancellable waits for the linear introduction.
 * @property {string} dimensionId Original player dimension.
 * @property {number} startedTick Sequence start tick.
 * @property {number} revision Intro test revision when this sequence began.
 */

const SEEN_PROPERTY = 'dhsn:operation_freshman_intro_shown'
const REVISION_PROPERTY = 'dhsn:operation_freshman_intro_revision'

/** @type {Encounter | undefined} One sequence also guards against repeated zone triggers. */
let activeEncounter
/** @type {Array<() => void>} Cleanup callbacks for the configured entry zones. */
let zoneCleanups = []
/** @type {boolean} Whether zones were already configured during this script load. */
let zonesConfigured = false

/**
 * Reports sequence or recovery failures to the Content Log.
 * @param {unknown} error Failure from a Minecraft API operation.
 * @returns {void}
 */
function logEncounterError(error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[Operation Erstsemester] Begegnung: ${message}`)
}

/**
 * Reads the persistent intro revision used by the debug reset.
 * @returns {number} Current intro test revision.
 */
function getIntroRevision() {
    const revision = world.getDynamicProperty(REVISION_PROPERTY)
    return typeof revision === 'number' ? revision : 0
}

/**
 * Ends the active sequence on success, cancellation, reset, or failure.
 * A disconnected player keeps the saved recovery record until returning.
 * @returns {void}
 */
function finishEncounter() {
    const encounter = activeEncounter
    if (!encounter) return
    activeEncounter = undefined
    encounter.sequence.cancel()
    stopEntityOnCleanup(encounter.lucas)
    try {
        if (encounter.player.isValid) restorePlayerControls(encounter.player)
    } catch (error) {
        logEncounterError(error)
    }
}

/**
 * Starts the introduction once, across all configured zones.
 * The map guarantees exactly one Lucas; no NPC selection or availability check
 * is needed. Resolve him on each start because the debug reset recreates NPCs.
 * @param {import('@minecraft/server').Player} player Map's player entering a zone.
 * @returns {void}
 */
function startEncounter(player) {
    if (activeEncounter) return
    restorePlayerControls(player)
    const revision = getIntroRevision()
    if (player.getDynamicProperty(SEEN_PROPERTY) === revision) return
    const [lucas] = player.dimension.getEntities({ type: 'dhsn:ersti_coach' })

    /** @type {Encounter} */
    const encounter = {
        player,
        lucas,
        position: { ...player.location },
        cameraPosition: { ...player.getHeadLocation() },
        sequence: new Sequence(),
        dimensionId: player.dimension.id,
        startedTick: system.currentTick,
        revision,
    }
    activeEncounter = encounter
    void playIntroduction(encounter)
}

/**
 * Plays the introduction in story order and always releases its controls.
 * @param {Encounter} encounter Active introduction.
 * @returns {Promise<void>} Resolves after completion, failure, or cancellation.
 */
async function playIntroduction(encounter) {
    const { player, lucas, sequence } = encounter
    try {
        freezePlayer(player, ENCOUNTER.timeoutTicks + 20)
        lucas.clearVelocity()

        await panToLucas(encounter)
        await jumpLucas(encounter)
        await turnLucasToPlayer(encounter)

        if (LUCAS_SHOULD_WAVE) {
            await waveLucas(encounter)
        }

        await approachPlayer(encounter)
        sequence.ensureActive()
        openNpcDialogue(player, lucas)
        player.setDynamicProperty(SEEN_PROPERTY, encounter.revision)
    } catch (error) {
        if (!sequence.cancelled) logEncounterError(error)
    } finally {
        // An interrupted introduction must not finish a newer one after reset.
        if (activeEncounter === encounter) finishEncounter()
    }
}

/**
 * Sets up the hidden player's eye-level camera, then pans towards Lucas.
 * @param {Encounter} encounter Active introduction.
 * @returns {Promise<void>} Resolves when the native eased pan has finished.
 */
async function panToLucas(encounter) {
    const { player, lucas, cameraPosition, sequence } = encounter
    // Let invisibility reach the client before putting the camera in the head.
    await sequence.waitTicks(2)
    sequence.ensureActive()
    initializePlayerCamera(player, cameraPosition)

    // Give the free camera two ticks to initialize before native easing.
    await sequence.waitTicks(2)
    sequence.ensureActive()
    panCameraTowards(
        player,
        cameraPosition,
        lucas.getHeadLocation(),
        ENCOUNTER.panTicks
    )
    await sequence.waitTicks(ENCOUNTER.panTicks)
}

/**
 * Makes Lucas hop once and waits for his actual landing.
 * @param {Encounter} encounter Active introduction.
 * @returns {Promise<void>} Resolves once Lucas has taken off and landed.
 */
async function jumpLucas(encounter) {
    const { lucas, sequence } = encounter
    await sequence.waitUntil(
        () => lucas.isOnGround,
        ENCOUNTER.jumpTimeoutTicks,
        'Lucas steht für den Begrüßungssprung nicht auf dem Boden.'
    )
    sequence.ensureActive()
    const jump = startJump(lucas, ENCOUNTER.jumpImpulse)
    await sequence.waitUntil(
        () => hasLanded(lucas, jump),
        ENCOUNTER.jumpTimeoutTicks,
        'Lucas konnte den Begrüßungssprung nicht abschließen.'
    )
}

/**
 * Turns Lucas towards the player and pauses before the next action.
 * @param {Encounter} encounter Active introduction.
 * @returns {Promise<void>} Resolves after the turning pause.
 */
function turnLucasToPlayer(encounter) {
    return lookAtFor(
        encounter.lucas,
        () => encounter.player.getHeadLocation(),
        ENCOUNTER.turnTicks,
        encounter.sequence
    )
}

/**
 * Plays the existing wave while Lucas keeps facing the player.
 * @param {Encounter} encounter Active introduction.
 * @returns {Promise<void>} Resolves after the full wave duration.
 */
async function waveLucas(encounter) {
    const { lucas, player, sequence } = encounter
    sequence.ensureActive()
    lucas.playAnimation('animation.ersti_coachwaving')
    await lookAtFor(
        lucas,
        () => player.getHeadLocation(),
        ENCOUNTER.waveTicks,
        sequence
    )
}

/**
 * Walks Lucas towards the frozen player until he reaches talking distance.
 * @param {Encounter} encounter Active introduction.
 * @returns {Promise<void>} Resolves at talking distance; rejects if stuck.
 */
function approachPlayer(encounter) {
    const { lucas, player, sequence } = encounter
    /** @type {import('./utils.js').ApproachState} */
    const progress = {
        bestDistance: Infinity,
        lastProgressTick: system.currentTick,
    }
    return sequence.waitUntil(() => {
        lucas.lookAt(player.getHeadLocation())
        return updateApproach(lucas, encounter.position, ENCOUNTER, progress)
    })
}

/**
 * Holds the player still, handles interruptions, and advances the current wait.
 * @param {Encounter} encounter Active introduction.
 * @returns {void}
 */
function maintainEncounter(encounter) {
    const { player } = encounter
    if (
        !player.isValid ||
        player.dimension.id !== encounter.dimensionId ||
        player.getComponent('minecraft:health')?.currentValue === 0
    ) {
        finishEncounter()
        return
    }
    const elapsed = system.currentTick - encounter.startedTick
    if (elapsed > ENCOUNTER.timeoutTicks) {
        throw new Error('Zeitüberschreitung beim Annähern von Lucas.')
    }

    holdPlayerPosition(player, encounter.position, ENCOUNTER.timeoutTicks + 20)
    encounter.sequence.update()
}

/**
 * Updates the one active sequence or recovers the returning map player.
 * @returns {void}
 */
function tickEncounter() {
    if (activeEncounter) {
        try {
            maintainEncounter(activeEncounter)
        } catch (error) {
            logEncounterError(error)
            finishEncounter()
        }
    }
    if (activeEncounter || system.currentTick % 20 !== 0) return
    const [player] = world.getAllPlayers()
    if (!player) return
    try {
        restorePlayerControls(player)
    } catch (error) {
        logEncounterError(error)
    }
}

/**
 * Cancels any interrupted sequence and restores the player after spawning.
 * @param {import('@minecraft/server').PlayerSpawnAfterEvent} event Spawn event.
 * @returns {void}
 */
function onPlayerSpawn(event) {
    finishEncounter()
    try {
        restorePlayerControls(event.player)
    } catch (error) {
        logEncounterError(error)
    }
}

/**
 * Connects a configured entry zone to the introduction.
 * @param {QuestZone} zone Zone to monitor.
 * @returns {() => void} Stops entry detection for this zone.
 */
function registerQuestZone(zone) {
    /**
     * Starts the introduction when the player enters.
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
 * Replaces entry zones and cancels the active sequence, including on /dhsn:r.
 * Reconfiguration after startup restarts the intro test for the map player.
 * Reloading alone preserves progress through the existing revision properties.
 * @param {QuestZone[]} zones Zones to monitor; an empty array removes them all.
 * @returns {void}
 */
export function setQuestZones(zones) {
    finishEncounter()
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

world.afterEvents.playerLeave.subscribe(finishEncounter)
world.afterEvents.playerSpawn.subscribe(onPlayerSpawn)
system.runInterval(tickEncounter, 1)
