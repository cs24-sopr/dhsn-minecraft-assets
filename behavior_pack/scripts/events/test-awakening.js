import { BlockPermutation, BlockVolume, system } from "@minecraft/server";
import { PROFESSOR_TAG, resetAwakening, setAwakeningTestLayout, startAwakening } from "../quests/awakening-quest.js";

// Test setup for the quest "Das Erwachen" (see quests/awakening-quest.js). It stands in for the real map,
// which does not exist yet. Stand on flat ground (best: flat world, adventure mode, cheats on) and run
//   /scriptevent dhsn:quest_test_awakening
// It builds everything the quest needs east of you and starts the quest at the bed:
// - a small start building: one room with a bed, the alarm clock (note block), a window in the north wall,
//   a chest and an exit in the east wall,
// - the portal (enchanting table on a purple pad) on a plaza in front of the exit,
// - the campus island, a second plaza some blocks further east, with the gate and the professor in front of it,
// - the camera path around the building, through the window and out of the door.
// The layout (all places) is saved in the world (see setAwakeningTestLayout), so it survives /reload and
// restarting the world and takes precedence over LAYOUT in the quest. /scriptevent dhsn:quest_test_awakening_clear
// removes it again.
// Running the command again clears the area, rebuilds everything at your new position and starts the quest again.
//
// THIS FILE IS NOT PART OF THE REAL MAP. When the quest moves to the real map, delete this file and its
// import in main.js and fill in LAYOUT in the quest instead (see docs/quests/awakening-quest.md).

const TEST_COMMAND = "dhsn:quest_test_awakening";

// The professor of the test is a placeholder: any NPC entity works, it only needs the tag of the quest.
const PROFESSOR_ENTITY = "dhsn:studienorganisation";
const PROFESSOR_NAME = "Chaotischer Professor";

const WALL = "minecraft:stone_bricks";
const FLOOR = "minecraft:oak_planks";
const PLAZA = "minecraft:stone_bricks";

/** Places the two halves of a bed. Falls back to wool if the bed states are not accepted. */
function placeBed(dimension, foot, head) {
    try {
        dimension.setBlockPermutation(foot, BlockPermutation.resolve("minecraft:bed", { direction: 0, head_piece_bit: false }));
        dimension.setBlockPermutation(head, BlockPermutation.resolve("minecraft:bed", { direction: 0, head_piece_bit: true }));
    } catch (error) {
        console.warn(`[awakening-test] Could not place a bed, using wool instead: ${error}`);
        dimension.setBlockType(foot, "minecraft:red_wool");
        dimension.setBlockType(head, "minecraft:white_wool");
    }
}

function buildScene(player) {
    const dimension = player.dimension;
    const ox = Math.floor(player.location.x);
    const oy = Math.floor(player.location.y);
    const oz = Math.floor(player.location.z);

    // A position relative to the player's block; y = 0 is the floor level the player stands on.
    const at = (dx, dy, dz) => ({ x: ox + dx, y: oy + dy, z: oz + dz });
    const fill = (from, to, type) => dimension.fillBlocks(new BlockVolume(from, to), type);

    // Clear everything above the ground: removes the scene of an earlier run at the same place.
    fill(at(-2, 0, -2), at(36, 8, 10), "minecraft:air");

    // --- The start building: x 0..8, z 0..8. The window is in the north wall (z = 0), the exit in the east wall (x = 8). ---
    fill(at(0, -1, 0), at(8, -1, 8), FLOOR);
    fill(at(0, 0, 0), at(8, 3, 8), WALL);
    fill(at(1, 0, 1), at(7, 3, 7), "minecraft:air");
    fill(at(0, 4, 0), at(8, 4, 8), WALL);
    fill(at(4, 4, 4), at(4, 4, 4), "minecraft:sea_lantern");
    fill(at(3, 1, 0), at(5, 2, 0), "minecraft:glass_pane");
    fill(at(8, 0, 4), at(8, 1, 4), "minecraft:air");

    placeBed(dimension, at(1, 0, 6), at(1, 0, 7));
    dimension.setBlockType(at(2, 0, 7), "minecraft:noteblock");
    dimension.setBlockType(at(7, 0, 7), "minecraft:chest");

    // --- The plaza in front of the exit with the portal. ---
    fill(at(9, -1, 0), at(16, -1, 8), PLAZA);
    fill(at(12, -1, 3), at(14, -1, 5), "minecraft:purple_concrete");
    dimension.setBlockType(at(13, 0, 4), "minecraft:enchanting_table");

    // --- The campus island: a second plaza with a gate (iron bars between two pillars). ---
    fill(at(24, -1, 0), at(34, -1, 8), PLAZA);
    fill(at(33, 0, 0), at(33, 2, 8), "minecraft:iron_bars");
    fill(at(33, 0, 3), at(33, 2, 5), "minecraft:air");
    fill(at(33, 0, 2), at(33, 3, 2), WALL);
    fill(at(33, 0, 6), at(33, 3, 6), WALL);

    for (const professor of dimension.getEntities({ tags: [PROFESSOR_TAG] })) professor.remove();
    const professor = dimension.spawnEntity(PROFESSOR_ENTITY, at(31.5, 0, 4.5));
    professor.addTag(PROFESSOR_TAG);
    professor.nameTag = PROFESSOR_NAME;

    // --- The camera ride: around the building, through the window, out of the door, a last look back. ---
    const lookAtBuilding = at(4.5, 2.5, 4.5);
    const cameraPath = [
        // Start at the window, looking out.
        { location: at(4.5, 1.6, 1.4), facing: at(4.5, 1.6, -8), seconds: 0 },
        // Pull back and around the building: north, west, south, east.
        { location: at(4.5, 5, -9.5), facing: lookAtBuilding, seconds: 3, sound: "mob.phantom.swoop" },
        { location: at(-9.5, 7, 4.5), facing: lookAtBuilding, seconds: 3.5 },
        { location: at(4.5, 8, 18.5), facing: lookAtBuilding, seconds: 3.5 },
        { location: at(18.5, 7, 4.5), facing: lookAtBuilding, seconds: 3.5 },
        // Back to the north side, in front of the window, then through it.
        { location: at(4.5, 2, -4), facing: at(4.5, 1.6, 4.5), seconds: 3.5, sound: "mob.phantom.swoop" },
        { location: at(4.5, 1.6, 1.6), facing: at(8.5, 1.4, 4.5), seconds: 2.5 },
        // Along the room to the exit and out of the door.
        { location: at(7.2, 1.5, 4.5), facing: at(14, 1.5, 4.5), seconds: 2, sound: "random.door_open" },
        { location: at(12, 2, 4.5), facing: at(24, 2, 4.5), seconds: 2.5 },
        // Turn around and show the whole building once more.
        { location: at(24, 8, 4.5), facing: lookAtBuilding, seconds: 4 },
    ];

    const layout = {
        dimension: dimension.id,
        wake: at(2.5, 0, 5.5),
        wakeFacing: at(4.5, 1.6, 0.5),
        alarm: at(2, 0, 7),
        window: { from: at(3, 0, 1), to: at(5, 2, 2) },
        chest: at(7, 0, 7),
        building: { from: at(0, -1, 0), to: at(8, 5, 8) },
        buildingReturn: at(7.5, 0, 4.5),
        portal: { from: at(12, 0, 3), to: at(14, 2, 5) },
        islandGate: at(28.5, 0, 4.5),
        islandFacing: at(33, 1.6, 4.5),
        cameraPath,
    };
    setAwakeningTestLayout(layout);
    return layout;
}

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
    if (id !== TEST_COMMAND) return;

    if (sourceEntity?.typeId !== "minecraft:player") {
        console.warn(`[Awakening] ${TEST_COMMAND} has to be run by a player.`);
        return;
    }

    const player = sourceEntity;
    buildScene(player);

    // Start from scratch, like a player who joins the real map for the first time.
    resetAwakening(player);
    startAwakening(player, true);

    // One line only: the chat should not be flooded. The outline of the quest is in docs/quests/awakening-quest.md.
    player.sendMessage("§eTest für \"Das Erwachen\" aufgebaut. Zurücksetzen: /scriptevent dhsn:quest_reset_awakening");
});
