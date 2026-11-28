/**
 * Spawn placement for Frau Sommer in a study office.
 * @typedef {object} MrsSommerSpawn
 * @property {import('@minecraft/server').Vector3} position Spawn coordinates.
 * @property {import('@minecraft/server').Vector2} rotation Spawn pitch and yaw.
 */

/**
 * Room-specific spawn configuration for Frau Sommer.
 * @typedef {object} MrsSommerConfig
 * @property {Record<113 | 114, MrsSommerSpawn>} spawn Placements by study office room.
 * @property {string} dimensionId Dimension containing both study offices.
 */

/** @type {MrsSommerConfig} */
export const MRS_SOMMER = {
    dimensionId: 'minecraft:overworld',
    spawn: {
        113: {
            position: { x: 14, y: -60, z: -6 },
            rotation: { x: 0, y: 0 },
        },
        114: {
            position: { x: 14, y: -60, z: -11 },
            rotation: { x: 0, y: 0 },
        },
    },
}

/**
 * Entrance trigger configuration shared by the quest and debug setup.
 * @typedef {object} TriggerZoneConfig
 * @property {import('./quest.js').QuestZone[]} zones Entrance volumes.
 */

/** @type {TriggerZoneConfig} No entrance listeners are started before setup. */
export const TRIGGER_ZONES = { zones: [] }

/**
 * Applies discovered debug placements for the current script session.
 * @param {MrsSommerConfig} sommer Discovered office placements.
 * @param {import('./quest.js').QuestZone[]} zones Discovered entrance volumes.
 * @returns {void}
 */
export function configureQuest(sommer, zones) {
    Object.assign(MRS_SOMMER, sommer)
    TRIGGER_ZONES.zones = zones
}
