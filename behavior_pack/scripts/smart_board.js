import { BlockPermutation, system, world } from "@minecraft/server";

const SMART_BOARD = "myname:smart_board";
const PART_STATE = "myname:smart_board_part";
const FACING_STATE = "minecraft:cardinal_direction";
const WIDTH_STATE = "myname:smart_board_width";

const WIDTH_AXES = {
    east: { x: 1, z: 0 },
    west: { x: -1, z: 0 },
    south: { x: 0, z: 1 },
    north: { x: 0, z: -1 },
};

function getWidthAxisFromPlayer(player) {
    const view = player.getViewDirection();

    if (Math.abs(view.x) > Math.abs(view.z)) {
        return view.x > 0 ? "south" : "north";
    }

    return view.z > 0 ? "west" : "east";
}

function getPartPositions(center, widthDirection) {
    const { x, y, z } = center;
    const { x: dx, z: dz } = widthDirection;

    return [
        { part: 0, x: x - dx, y, z: z - dz },
        { part: 1, x, y, z },
        { part: 2, x: x + dx, y, z: z + dz },
        { part: 3, x: x - dx, y: y + 1, z: z - dz },
        { part: 4, x, y: y + 1, z },
        { part: 5, x: x + dx, y: y + 1, z: z + dz },
    ];
}

world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
    if (block.typeId !== SMART_BOARD) return;

    const dimension = block.dimension;
    const location = { ...block.location };
    const facing = block.permutation.getState(FACING_STATE);
    const widthName = getWidthAxisFromPlayer(player);
    const widthDirection = WIDTH_AXES[widthName];
    const createdLocations = [location];

    system.run(() => {
        try {
            const base = dimension.getBlock(location);
            if (!base || base.typeId !== SMART_BOARD) return;

            if (!widthDirection) {
                base.setType("minecraft:air");
                player.sendMessage("§cSmart board placement failed: unknown facing.");
                return;
            }

            const positions = getPartPositions(location, widthDirection);
            for (const position of positions) {
                if (position.part === 1) continue;

                const target = dimension.getBlock(position);
                if (!target || !target.isAir) {
                    base.setType("minecraft:air");
                    player.sendMessage("§cSmart board needs a clear 3×2 area.");
                    return;
                }
            }

            for (const position of positions) {
                const target = dimension.getBlock(position);
                if (!target) {
                    throw new Error(`Missing block at ${position.x}, ${position.y}, ${position.z}`);
                }
                if (position.part !== 1) createdLocations.push(position);
                target.setPermutation(
                    BlockPermutation.resolve(SMART_BOARD, {
                        [PART_STATE]: position.part,
                        [FACING_STATE]: facing,
                        [WIDTH_STATE]: widthName,
                    }),
                );
            }
        } catch (error) {
            for (const position of createdLocations) {
                const target = dimension.getBlock(position);
                if (target?.typeId === SMART_BOARD) {
                    target.setType("minecraft:air");
                }
            }
            console.warn(`[SmartBoard] Placement failed: ${error}`);
            player.sendMessage("§cSmart board placement failed. Check the Content Log.");
        }
    });
});

world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation }) => {
    if (brokenBlockPermutation.type.id !== SMART_BOARD) return;

    const part = brokenBlockPermutation.getState(PART_STATE);
    const facing = brokenBlockPermutation.getState(FACING_STATE);
    const widthName = brokenBlockPermutation.getState(WIDTH_STATE);
    const widthDirection =
        typeof widthName === "string"
            ? WIDTH_AXES[widthName]
            : WIDTH_AXES[facing];
    if (typeof part !== "number" || !widthDirection) return;

    const dimension = block.dimension;
    const location = { ...block.location };
    const column = part % 3 - 1;
    const row = Math.floor(part / 3);
    const center = {
        x: location.x - column * widthDirection.x,
        y: location.y - row,
        z: location.z - column * widthDirection.z,
    };

    system.run(() => {
        for (const position of getPartPositions(center, widthDirection)) {
            if (position.part === part) continue;

            const target = dimension.getBlock(position);
            if (
                target?.typeId === SMART_BOARD &&
                target.permutation.getState(PART_STATE) === position.part &&
                target.permutation.getState(FACING_STATE) === facing
            ) {
                target.setType("minecraft:air");
            }
        }
    });
});
