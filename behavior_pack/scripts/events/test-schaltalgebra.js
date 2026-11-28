import { BlockPermutation, BlockVolume, ItemStack, SignSide, system, world } from "@minecraft/server";
import { setSchaltalgebraTestLayout } from "../quests/schaltalgebra-quest.js";

// Test setup for the quest "Schaltalgebra" (see quests/schaltalgebra-quest.js), until the building
// team has built the real rooms (project#174). Stand on flat ground (best: flat world, adventure
// mode, cheats on) with about 26 blocks free to the east and run
//   /scriptevent dhsn:quest_test_schaltalgebra
// It builds, from the player towards the east (+X):
// - a lecture room with a redstone lamp and a stone button on top, and a chest with the student ID,
// - a closed puzzle room with four levers A–D, a target lamp and a return button.
// The real circuit comes from the building team. Here a SUBSTITUTE CIRCUIT in this script lights the
// target lamp when the levers match TEST_SOLUTION (it places a redstone block behind the lamp).
// The quest does not know about it: it only sees "the target lamp is lit", as in the real map.
// The layout is saved in the world; /scriptevent dhsn:quest_test_schaltalgebra_clear removes it.
// It does not change the quest progress; use /scriptevent dhsn:quest_reset_schaltalgebra for that.

const TEST_COMMAND = "dhsn:quest_test_schaltalgebra";

// The one lever combination that lights the target lamp in the test (A, B, C, D; true = on).
// Expressed as logic: A UND (NICHT B) UND C UND D. "All off" keeps the lamp off.
const TEST_SOLUTION = [true, false, true, true];
const TEST_SOLUTION_TEXT = "A UND (NICHT B) UND C UND D";

// Item the quest requires to start; the test puts one into a chest in the lecture room.
const STUDENT_ID = "dhsn:studierendenausweis";

const WALL = "minecraft:stone_bricks";
const FLOOR = "minecraft:oak_planks";
const PUZZLE_FLOOR = "minecraft:smooth_stone";

// Saved here for the substitute circuit; also written into the world with the layout.
/** @type {{ dimension: string, levers: import("@minecraft/server").Vector3[], power: import("@minecraft/server").Vector3, powerOff: string } | undefined} */
let substitute;

function say(player, text) {
    player.sendMessage(`§e${text}`);
}

function placeSign(dimension, location, text) {
    dimension.setBlockPermutation(location, BlockPermutation.resolve("minecraft:standing_sign", { ground_sign_direction: 0 }));
    const sign = dimension.getBlock(location)?.getComponent("minecraft:sign");
    if (!sign) return;
    sign.setText(text, SignSide.Front);
    sign.setText(text, SignSide.Back);
    sign.setWaxed(true);
}

/** Walls of a room from (x1, z1) to (x2, z2), 4 blocks high, without roof. */
function buildWalls(dimension, y, x1, z1, x2, z2) {
    for (const [from, to] of [
        [{ x: x1, y, z: z1 }, { x: x2, y: y + 3, z: z1 }],
        [{ x: x1, y, z: z2 }, { x: x2, y: y + 3, z: z2 }],
        [{ x: x1, y, z: z1 }, { x: x1, y: y + 3, z: z2 }],
        [{ x: x2, y, z: z1 }, { x: x2, y: y + 3, z: z2 }],
    ]) {
        dimension.fillBlocks(new BlockVolume(from, to), WALL);
    }
}

function buildScene(player) {
    const dimension = player.dimension;
    const x = Math.floor(player.location.x);
    const y = Math.floor(player.location.y);
    const z = Math.floor(player.location.z);

    // Clear everything above the floor and lay the floors.
    dimension.fillBlocks(new BlockVolume({ x: x - 1, y, z: z - 4 }, { x: x + 25, y: y + 5, z: z + 4 }), "minecraft:air");
    dimension.fillBlocks(new BlockVolume({ x: x - 1, y: y - 1, z: z - 4 }, { x: x + 7, y: y - 1, z: z + 4 }), FLOOR);
    dimension.fillBlocks(new BlockVolume({ x: x + 12, y: y - 1, z: z - 4 }, { x: x + 25, y: y - 1, z: z + 4 }), PUZZLE_FLOOR);

    // Lecture room: x-1..x+7, open towards the west so the player can walk in and out.
    buildWalls(dimension, y, x - 1, z - 4, x + 7, z + 4);
    dimension.fillBlocks(new BlockVolume({ x: x - 1, y, z: z - 1 }, { x: x - 1, y: y + 2, z: z + 1 }), "minecraft:air");
    const startLamp = { x: x + 4, y, z };
    dimension.setBlockType(startLamp, "minecraft:redstone_lamp");
    const startButton = { x: x + 4, y: y + 1, z };
    dimension.setBlockPermutation(startButton, BlockPermutation.resolve("minecraft:stone_button", { facing_direction: 1 }));

    // Chest with the student ID in the corner of the lecture room. It is refilled on every run.
    const chestLocation = { x: x + 1, y, z: z + 3 };
    dimension.setBlockType(chestLocation, "minecraft:chest");
    try {
        dimension.getBlock(chestLocation)?.getComponent("minecraft:inventory")?.container?.addItem(new ItemStack(STUDENT_ID, 1));
    } catch (error) {
        console.warn(`[Events] Could not fill the chest of the Schaltalgebra test: ${error}`);
    }
    placeSign(dimension, { x: x + 2, y, z: z + 3 }, "Studierenden-\nausweis");

    // Puzzle room: x+12..x+25, closed.
    buildWalls(dimension, y, x + 12, z - 4, x + 25, z + 4);
    /** @type {import("@minecraft/server").Vector3[]} */
    const levers = [];
    ["A", "B", "C", "D"].forEach((name, index) => {
        const lever = { x: x + 15 + index * 2, y, z: z - 1 };
        dimension.setBlockPermutation(lever, BlockPermutation.resolve("minecraft:lever", { lever_direction: "up_north_south", open_bit: false }));
        levers.push(lever);
        placeSign(dimension, { x: lever.x, y, z: z - 3 }, `Schalter ${name}`);
    });
    // Target lamp on a pedestal; the substitute circuit replaces the pedestal by a redstone block.
    const pedestal = { x: x + 23, y, z };
    dimension.setBlockType(pedestal, PUZZLE_FLOOR);
    const targetLamp = { x: x + 23, y: y + 1, z };
    dimension.setBlockType(targetLamp, "minecraft:redstone_lamp");
    const returnButton = { x: x + 14, y, z: z + 2 };
    dimension.setBlockPermutation(returnButton, BlockPermutation.resolve("minecraft:stone_button", { facing_direction: 1 }));
    placeSign(dimension, { x: x + 14, y, z: z + 3 }, "Zurück");
    placeSign(dimension, { x: x + 22, y, z: z + 3 }, `Lösung im Test:\n${TEST_SOLUTION_TEXT}`);

    substitute = { dimension: dimension.id, levers, power: pedestal, powerOff: PUZZLE_FLOOR };

    setSchaltalgebraTestLayout({
        dimension: dimension.id,
        startButton,
        startLamp,
        puzzleArrival: { location: { x: x + 14.5, y, z: z + 0.5 }, facing: { x: x + 20, y: y + 1, z: z - 1 } },
        returnButton,
        returnArrival: { location: { x: x + 2.5, y, z: z + 0.5 }, facing: { x: x + 4.5, y: y + 1, z: z + 0.5 } },
        targetLamp,
        levers,
        puzzleArea: { from: { x: x + 12, y: y - 1, z: z - 4 }, to: { x: x + 25, y: y + 4, z: z + 4 } },
    });
    world.setDynamicProperty("dhsn:schaltalgebra_test_substitute", JSON.stringify(substitute));

    say(player, "Schaltalgebra-Test aufgebaut.");
    say(player, " 1. Studierendenausweis aus der Kiste in der Ecke nehmen, dann den Knopf auf der Lampe drücken.");
    say(player, " 2. Im Rätselraum die Schalter A–D so stellen, dass die Lampe am Ende leuchtet.");
    say(player, ` 3. Test-Lösung: ${TEST_SOLUTION_TEXT}. Zurück über den Knopf beim Schild „Zurück“.`);
    say(player, "Neu starten: /scriptevent dhsn:quest_reset_schaltalgebra");
}

// Substitute circuit: reads the levers and powers the target lamp for TEST_SOLUTION.
system.runInterval(() => {
    if (!substitute) {
        const saved = world.getDynamicProperty("dhsn:schaltalgebra_test_substitute");
        if (typeof saved !== "string") return;
        try {
            substitute = JSON.parse(saved);
        } catch {
            return;
        }
    }
    if (!substitute) return;

    try {
        const dimension = world.getDimension(substitute.dimension);
        const states = substitute.levers.map((location) => dimension.getBlock(location)?.permutation.getState("open_bit") === true);
        const solved = states.every((on, index) => on === TEST_SOLUTION[index]);
        const block = dimension.getBlock(substitute.power);
        if (!block) return;
        if (solved && block.typeId !== "minecraft:redstone_block") block.setType("minecraft:redstone_block");
        if (!solved && block.typeId === "minecraft:redstone_block") block.setType(substitute.powerOff);
    } catch {
        // Test area not loaded.
    }
}, 4);

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
    if (id === "dhsn:quest_test_schaltalgebra_clear") {
        substitute = undefined;
        world.setDynamicProperty("dhsn:schaltalgebra_test_substitute", undefined);
        return;
    }
    if (id !== TEST_COMMAND) return;

    if (sourceEntity?.typeId !== "minecraft:player") {
        console.warn(`[Events] ${TEST_COMMAND} has to be run by a player.`);
        return;
    }
    buildScene(sourceEntity);
});
