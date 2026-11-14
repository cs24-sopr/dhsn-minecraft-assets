// Shared helpers for the quest event building blocks in this folder.

/**
 * @typedef {{ x: number, y: number, z: number }} Vector3
 * @typedef {{ min: Vector3, max: Vector3 }} Area
 */

/**
 * Creates an area from two corner blocks. The corners can be given in any order
 * and both corner blocks belong to the area.
 * @param {Vector3} from
 * @param {Vector3} to
 * @returns {Area}
 */
export function createArea(from, to) {
    return {
        min: {
            x: Math.floor(Math.min(from.x, to.x)),
            y: Math.floor(Math.min(from.y, to.y)),
            z: Math.floor(Math.min(from.z, to.z)),
        },
        max: {
            x: Math.floor(Math.max(from.x, to.x)),
            y: Math.floor(Math.max(from.y, to.y)),
            z: Math.floor(Math.max(from.z, to.z)),
        },
    };
}

/**
 * Checks whether a location lies inside the area. Entity locations are
 * converted to the block they are standing in.
 * @param {Area} area
 * @param {Vector3} location
 * @returns {boolean}
 */
export function isInArea(area, location) {
    const x = Math.floor(location.x);
    const y = Math.floor(location.y);
    const z = Math.floor(location.z);

    return x >= area.min.x && x <= area.max.x
        && y >= area.min.y && y <= area.max.y
        && z >= area.min.z && z <= area.max.z;
}

/**
 * Checks whether a location is exactly the given block.
 * @param {Vector3} block
 * @param {Vector3} location
 * @returns {boolean}
 */
export function isSameBlock(block, location) {
    return Math.floor(block.x) === Math.floor(location.x)
        && Math.floor(block.y) === Math.floor(location.y)
        && Math.floor(block.z) === Math.floor(location.z);
}

/**
 * Converts "overworld" or "minecraft:overworld" to the full dimension id.
 * @param {string} [dimension] Defaults to the overworld.
 * @returns {string}
 */
export function toDimensionId(dimension = "overworld") {
    return dimension.includes(":") ? dimension : `minecraft:${dimension}`;
}

/**
 * Converts a single type id or a list of type ids to a Set.
 * Returns undefined if no type was given, which means "every type".
 * @param {string | string[] | undefined} types
 * @returns {Set<string> | undefined}
 */
export function toTypeSet(types) {
    if (types === undefined) return undefined;

    return new Set(Array.isArray(types) ? types : [types]);
}
