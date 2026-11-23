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
 */

/** @type {MrsSommerConfig} */
export const MRS_SOMMER = {
    spawn: {
        113: {
            position: {},
            rotation: {},
        },
        114: {
            position: {},
            rotation: {},
        },
    },
}
