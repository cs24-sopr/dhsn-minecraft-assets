// Helpers for /scriptevent commands that take coordinates, e.g. from command blocks of the map.
// Minecraft does not resolve "~" inside script event messages, so it is done here.

/**
 * Parses coordinates like in Minecraft commands: absolute numbers or "~" / "~5" / "~-2" relative to `origin`.
 * Decimal commas are accepted. Tokens are read as x, y, z, x, y, z, ...
 * @param {string[]} tokens
 * @param {import("@minecraft/server").Vector3} origin Usually the command block (sourceBlock) or the player.
 * @returns {number[] | undefined} The numbers, or undefined if a token is not a coordinate.
 */
export function parseCoordinates(tokens, origin) {
    const axes = ["x", "y", "z"];
    const numbers = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i].replace(",", ".");
        const relative = token.startsWith("~");
        const value = Number(relative ? token.slice(1) || "0" : token);
        if (!Number.isFinite(value)) return undefined;
        numbers.push(relative ? Math.floor(origin[axes[i % 3]]) + value : value);
    }
    return numbers;
}

/**
 * @param {number[]} numbers
 * @param {number} [offset]
 * @returns {import("@minecraft/server").Vector3}
 */
export function toVector(numbers, offset = 0) {
    return { x: numbers[offset], y: numbers[offset + 1], z: numbers[offset + 2] };
}

/**
 * Where a script event came from: the command block if there is one, otherwise the entity.
 * @param {{ sourceBlock?: import("@minecraft/server").Block, sourceEntity?: import("@minecraft/server").Entity }} event
 * @returns {{ origin: import("@minecraft/server").Vector3, dimensionId: string }}
 */
export function commandSource({ sourceBlock, sourceEntity }) {
    return {
        origin: sourceBlock?.location ?? sourceEntity?.location ?? { x: 0, y: 0, z: 0 },
        dimensionId: sourceBlock?.dimension.id ?? sourceEntity?.dimension.id ?? "minecraft:overworld",
    };
}
