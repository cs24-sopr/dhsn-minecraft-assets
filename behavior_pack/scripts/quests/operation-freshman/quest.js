import { system, world } from '@minecraft/server'
import { onEnterTerritory } from '../../events/index.js'
import {
    freezePlayer,
    hasLanded,
    holdPlayerPosition,
    initializePlayerCamera,
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
 * @typedef {'waiting' | 'jumping' | 'turning' | 'waving' | 'complete'} GreetingPhase
 */

/**
 * The single active encounter between the map's player and Lucas.
 * @typedef {object} Encounter
 * @property {import('@minecraft/server').Player} player Map's player.
 * @property {import('@minecraft/server').Entity} lucas Map's single Lucas.
 * @property {import('@minecraft/server').Vector3} position Frozen player position.
 * @property {import('@minecraft/server').Vector3} cameraPosition Fixed eye-level view.
 * @property {boolean} cameraInitialized Whether the free camera is active.
 * @property {boolean} panStarted Whether native camera easing has started.
 * @property {GreetingPhase} greetingPhase Current stage of Lucas's greeting.
 * @property {number} greetingTick Start of the greeting stage; -1 before it begins.
 * @property {import('./utils.js').JumpState} jump Physical hop progress.
 * @property {import('./utils.js').ApproachState} approach Physical approach progress.
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

    activeEncounter = {
        player,
        lucas,
        position: { ...player.location },
        cameraPosition: { ...player.getHeadLocation() },
        cameraInitialized: false,
        panStarted: false,
        greetingPhase: 'waiting',
        greetingTick: -1,
        jump: { startY: lucas.location.y, leftGround: false },
        approach: {
            bestDistance: Infinity,
            lastProgressTick: system.currentTick,
        },
        dimensionId: player.dimension.id,
        startedTick: system.currentTick,
        revision,
    }

    try {
        freezePlayer(player, ENCOUNTER.timeoutTicks + 20)
        lucas.clearVelocity()
    } catch (error) {
        finishEncounter()
        throw error
    }
}

/**
 * Orders Lucas's hop, landing, turn, and optional existing wave.
 * @param {Encounter} encounter Active sequence.
 * @returns {boolean} Whether Lucas is ready to approach.
 */
function updateLucasGreeting(encounter) {
    const { lucas, player } = encounter
    const now = system.currentTick
    if (encounter.greetingTick < 0) encounter.greetingTick = now

    if (encounter.greetingPhase === 'waiting') {
        if (now - encounter.greetingTick > ENCOUNTER.jumpTimeoutTicks) {
            throw new Error(
                'Lucas steht für den Begrüßungssprung nicht auf dem Boden.'
            )
        }
        if (!lucas.isOnGround) return false
        encounter.jump = startJump(lucas, ENCOUNTER.jumpImpulse)
        encounter.greetingPhase = 'jumping'
        encounter.greetingTick = now
        return false
    }

    if (encounter.greetingPhase === 'jumping') {
        if (!hasLanded(lucas, encounter.jump)) {
            if (now - encounter.greetingTick > ENCOUNTER.jumpTimeoutTicks) {
                throw new Error(
                    'Lucas konnte den Begrüßungssprung nicht abschließen.'
                )
            }
            return false
        }
        encounter.greetingPhase = 'turning'
        encounter.greetingTick = now
    }

    lucas.lookAt(player.getHeadLocation())
    if (encounter.greetingPhase === 'turning') {
        if (now - encounter.greetingTick < ENCOUNTER.turnTicks) return false
        if (!LUCAS_SHOULD_WAVE) {
            encounter.greetingPhase = 'complete'
            encounter.approach.lastProgressTick = now
            return true
        }
        lucas.playAnimation('animation.ersti_coachwaving')
        encounter.greetingPhase = 'waving'
        encounter.greetingTick = now
        return false
    }
    if (encounter.greetingPhase === 'waving') {
        if (now - encounter.greetingTick < ENCOUNTER.waveTicks) return false
        encounter.greetingPhase = 'complete'
        encounter.approach.lastProgressTick = now
    }
    return encounter.greetingPhase === 'complete'
}

/**
 * Advances camera setup -> pan -> greeting -> approach -> dialogue.
 * @param {Encounter} encounter Active sequence to advance.
 * @returns {void}
 */
function updateEncounter(encounter) {
    const { player, lucas } = encounter
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
    // Let invisibility reach the client before putting the camera in the head.
    if (elapsed < 2) return
    if (!encounter.cameraInitialized) {
        initializePlayerCamera(player, encounter.cameraPosition)
        encounter.cameraInitialized = true
    }
    // Give the free camera two ticks to initialize before native easing.
    if (elapsed < 4) return
    if (!encounter.panStarted) {
        panCameraTowards(
            player,
            encounter.cameraPosition,
            lucas.getHeadLocation(),
            ENCOUNTER.panTicks
        )
        encounter.panStarted = true
    }
    if (elapsed < 4 + ENCOUNTER.panTicks) return
    if (!updateLucasGreeting(encounter)) return
    if (
        !updateApproach(
            lucas,
            encounter.position,
            ENCOUNTER,
            encounter.approach
        )
    ) {
        return
    }

    openNpcDialogue(player, lucas)
    player.setDynamicProperty(SEEN_PROPERTY, encounter.revision)
    finishEncounter()
}

/**
 * Updates the one active sequence or recovers the returning map player.
 * @returns {void}
 */
function tickEncounter() {
    if (activeEncounter) {
        try {
            updateEncounter(activeEncounter)
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
