
import {
    world,
    system,
    BlockPermutation
} from "@minecraft/server";

// --------------------------------------------------
// 1. CONFIGURATION
// --------------------------------------------------

const DOOR_BLOCK = "dhsn:frontdoor_empty";
const DOOR_ENTITY = "dhsn:frontdoor_entity";

const DOOR_BASE_PROPERTY = "dhsn:door_base";

// Create a block permutation when it is actually needed.
function getDoorPermutation(state) {
    return BlockPermutation.resolve(
        DOOR_BLOCK,
        {
            "dhsn:door_state": state
        }
    );
}

// --------------------------------------------------
// 2. DETERMINE PLAYER DIRECTION
// --------------------------------------------------

function getDoorDirection(player) {

    const view = player.getViewDirection();

    // Select the dominant horizontal direction.
    // The right vector determines the second door column.

    if (Math.abs(view.x) > Math.abs(view.z)) {

        if (view.x > 0) {
            // Player faces east.
            return {
                facing: "east",
                dx: 0,
                dz: 1,
                rotation: 90
            };
        }

        // Player faces west.
        return {
            facing: "west",
            dx: 0,
            dz: -1,
            rotation: 270
        };
    }

    if (view.z > 0) {
        // Player faces south.
        return {
            facing: "south",
            dx: -1,
            dz: 0,
            rotation: 180
        };
    }

    // Player faces north.
    return {
        facing: "north",
        dx: 1,
        dz: 0,
        rotation: 0
    };
}

// --------------------------------------------------
// 3. GET MULTIBLOCK POSITIONS
// --------------------------------------------------

function getDoorPositions(base) {

    const { x, y, z } = base;

    // Default values support previously saved Z-axis doors.
    const dx = base.dx ?? 0;
    const dz = base.dz ?? 1;

    return [
        { x, y, z },
        { x, y: y + 1, z },
        { x: x + dx, y, z: z + dz },
        { x: x + dx, y: y + 1, z: z + dz }
    ];
}

// --------------------------------------------------
// UPDATE DOOR COLLISION
// --------------------------------------------------

function updateDoorCollision(door) {

    const saved = door.getDynamicProperty(
        DOOR_BASE_PROPERTY
    );

    // Ignore door entities without stored multiblock data.
    if (typeof saved !== "string") return;

    let base;

    try {
        base = JSON.parse(saved);
    } catch {
        return;
    }

    // Retrieve the current entity variant.
    const variant = door.getComponent(
        "minecraft:variant"
    );

    if (!variant) return;

    const isOpen = variant.value === 1;

    // Use the stored direction for all four block positions.
    const positions = getDoorPositions(base);

    const targetPermutation = getDoorPermutation(
        isOpen ? "open" : "closed"
    );

    const wantedState = isOpen
        ? "open"
        : "closed";

    for (const position of positions) {

        const block = door.dimension.getBlock(position);

        // Never modify unrelated blocks.
        if (!block || block.typeId !== DOOR_BLOCK) {
            continue;
        }

        const currentState = block.permutation.getState(
            "dhsn:door_state"
        );

        // Avoid unnecessary block updates.
        if (currentState !== wantedState) {
            block.setPermutation(targetPermutation);
        }
    }
}


// --------------------------------------------------
// 4. DETECT PLACEMENT
// --------------------------------------------------

world.afterEvents.playerPlaceBlock.subscribe((event) => {

    const block = event.block;
    const player = event.player;

    if (block.typeId !== DOOR_BLOCK) return;

    // Capture the player's direction immediately.
    const direction = getDoorDirection(player);

    system.run(() => {
        try {
            placeFrontdoor(block, player, direction);
        } catch (error) {
            console.warn(
                "[Frontdoor] Placement error: " + error
            );

            player.sendMessage(
                "§cError placing Frontdoor."
            );
        }
    });
});

// --------------------------------------------------
// 5. CREATE MULTIBLOCK
// --------------------------------------------------

function placeFrontdoor(baseBlock, player, direction) {

    if (!baseBlock.isValid) return;

    const dimension = baseBlock.dimension;

    const base = {
        ...baseBlock.location,
        dx: direction.dx,
        dz: direction.dz
    };

    const positions = getDoorPositions(base);
    const additionalPositions = positions.slice(1);

    // ------------------------------------------------
    // 6. CHECK SPACE
    // ------------------------------------------------

    for (const position of additionalPositions) {

        const target = dimension.getBlock(position);

        if (!target || !target.isAir) {

            baseBlock.setType("minecraft:air");

            player.sendMessage(
                "§cNot enough space for a 2x2 Frontdoor."
            );

            return;
        }
    }

    // ------------------------------------------------
    // 7. SET ADDITIONAL BLOCKS
    // ------------------------------------------------

    // Create the closed permutation during normal execution.
    const doorBlock = getDoorPermutation("closed");

    // Initialize the original placed block.
    baseBlock.setPermutation(doorBlock);

    // Place the three additional blocks.
    for (const position of additionalPositions) {

        const target = dimension.getBlock(position);
        target.setPermutation(doorBlock);
    }


    // ------------------------------------------------
    // 8. CALCULATE ENTITY POSITION
    // ------------------------------------------------

    const entityPosition = {
        x: base.x + 0.5 + direction.dx * 0.5,
        y: base.y,
        z: base.z + 0.5 + direction.dz * 0.5
    };

    // ------------------------------------------------
    // 9. SPAWN AND ROTATE ENTITY
    // ------------------------------------------------

    const doorEntity = dimension.spawnEntity(
        DOOR_ENTITY,
        entityPosition
    );

    doorEntity.setRotation({
        x: 0,
        y: direction.rotation
    });

    // Initialize the existing entity behavior.
    doorEntity.triggerEvent("frontdoor:init");

    // Store base position and direction.
    doorEntity.setDynamicProperty(
        DOOR_BASE_PROPERTY,
        JSON.stringify(base)
    );

    // Reapply rotation on the following tick.
    // This helps when spawn initialization changes orientation.
    system.run(() => {
        if (doorEntity.isValid) {
            doorEntity.setRotation({
                x: 0,
                y: direction.rotation
            });
        }
    });

    player.sendMessage(
        "§aFrontdoor placed facing " +
        direction.facing + "!"
    );

    console.warn(
        `[Frontdoor] Placed at ${base.x}, ${base.y}, ${base.z}, facing ${direction.facing}`
    );
}

// --------------------------------------------------
// 10. FIND ENTITY BY BLOCK POSITION
// --------------------------------------------------

function findDoorAtBlock(dimension, position) {

    const doors = dimension.getEntities({
        type: DOOR_ENTITY
    });

    for (const door of doors) {

        const saved = door.getDynamicProperty(
            DOOR_BASE_PROPERTY
        );

        if (typeof saved !== "string") continue;

        let base;

        try {
            base = JSON.parse(saved);
        } catch {
            continue;
        }

        const positions = getDoorPositions(base);

        const belongsToDoor = positions.some(p =>
            p.x === position.x &&
            p.y === position.y &&
            p.z === position.z
        );

        if (belongsToDoor) return door;
    }

    return undefined;
}

// --------------------------------------------------
// 11. REMOVE ENTIRE MULTIBLOCK
// --------------------------------------------------

function removeFrontdoor(door) {

    if (!door.isValid) return;

    const saved = door.getDynamicProperty(
        DOOR_BASE_PROPERTY
    );

    if (typeof saved !== "string") return;

    let base;

    try {
        base = JSON.parse(saved);
    } catch {
        return;
    }

    const dimension = door.dimension;
    const positions = getDoorPositions(base);

    // Remove only blocks belonging to this door.
    for (const position of positions) {

        const block = dimension.getBlock(position);

        if (block?.typeId === DOOR_BLOCK) {
            block.setType("minecraft:air");
        }
    }

    if (door.isValid) {
        door.remove();
    }

    console.warn("[Frontdoor] Frontdoor removed.");
}

// --------------------------------------------------
// 12. DETECT LEFT CLICK ON ENTITY
// --------------------------------------------------

world.afterEvents.entityHitEntity.subscribe((event) => {

    const player = event.damagingEntity;
    const target = event.hitEntity;

    if (player.typeId !== "minecraft:player") return;
    if (target.typeId !== DOOR_ENTITY) return;

    system.run(() => {
        try {
            removeFrontdoor(target);
        } catch (error) {
            console.warn(
                "[Frontdoor] Entity removal error: " + error
            );
        }
    });
});

// --------------------------------------------------
// 13. DETECT BREAKING AN INVISIBLE BLOCK
// --------------------------------------------------

world.afterEvents.playerBreakBlock.subscribe((event) => {

    if (
        event.brokenBlockPermutation.type.id !== DOOR_BLOCK
    ) return;

    const dimension = event.dimension;
    const position = { ...event.block.location };

    system.run(() => {
        try {

            const door = findDoorAtBlock(
                dimension,
                position
            );

            if (door) {
                removeFrontdoor(door);
            }

        } catch (error) {
            console.warn(
                "[Frontdoor] Block removal error: " + error
            );
        }
    });
});

// --------------------------------------------------
// SYNCHRONIZE DOOR COLLISION
// --------------------------------------------------

system.runInterval(() => {

    const dimensionIds = [
        "overworld",
        "nether",
        "the_end"
    ];

    for (const dimensionId of dimensionIds) {

        try {
            const dimension = world.getDimension(
                dimensionId
            );

            const doors = dimension.getEntities({
                type: DOOR_ENTITY
            });

            for (const door of doors) {

                try {
                    updateDoorCollision(door);
                } catch (error) {
                    console.warn(
                        "[Frontdoor] Collision update error: " +
                        error
                    );
                }
            }

        } catch (error) {
            console.warn(
                "[Frontdoor] Dimension update error: " +
                error
            );
        }
    }

}, 2);
