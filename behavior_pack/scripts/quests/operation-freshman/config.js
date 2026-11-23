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
            position: { x: 14, y: -60, z: -6 },
            rotation: { x: 0, y: 0 },
        },
        114: {
            position: { x: 14, y: -60, z: -11 },
            rotation: { x: 0, y: 0 },
        },
    },
}
