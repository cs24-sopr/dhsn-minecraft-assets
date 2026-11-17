import { ItemStack, system, world } from "@minecraft/server";
import { questlog } from "../questlog.js";
import { onBlockPlaced, onEnterTerritory, onItemInHopper, onItemInShelf, onItemPickup } from "./index.js";

// Test course for the quest events. Stand on flat ground and run
//   /scriptevent dhsn:event_test
// It builds the course around you, gives you the needed items and registers every
// event once. Each event writes a chat message and ticks off its line in the questlog.
// Running the command again rebuilds the course at your new position.

const TEST_COMMAND = "dhsn:event_test";

const TESTS = {
    pickup: "Zeugnis aufheben",
    hopper: "Papier in den Trichter werfen",
    shelf: "Buch ins Regal stellen",
    shelfAmount: "3 Bücher in ein Regal stellen",
    block: "Goldblock auf das gelbe Feld setzen",
    territory: "Grünen Bereich betreten",
};

let stopListeners = [];
let testEntry;

function vec(base, dx, dy, dz) {
    return { x: base.x + dx, y: base.y + dy, z: base.z + dz };
}

function updateQuestlog(done) {
    const lines = Object.entries(TESTS).map(([key, text]) => (done.has(key) ? `§a[x] ${text}§r` : `[ ] ${text}`));

    if (testEntry) {
        testEntry.lines = lines;
    } else {
        testEntry = questlog.createEntry({ title: "Ereignis-Test", lines, order: 0 });
    }
}

function buildCourse(player) {
    const dimension = player.dimension;
    const origin = {
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y),
        z: Math.floor(player.location.z),
    };

    // Item pickup: a certificate ("Zeugnis") lying on the ground 3 blocks east of the player.
    dimension.spawnItem(new ItemStack("dhsn:certificate"), vec(origin, 3.5, 0.5, 0.5));

    // Item in hopper: a hopper 4 blocks south of the player. It points down into the ground,
    // so it keeps the items instead of passing them on.
    const hopper = vec(origin, 0, 0, 4);
    dimension.setBlockType(hopper, "minecraft:hopper");

    // Block placed: a yellow field 4 blocks north of the player. The gold block has to be
    // placed on top of it, at ground level.
    const target = vec(origin, 0, 0, -4);
    dimension.setBlockType(vec(target, 0, -1, 0), "minecraft:yellow_concrete");
    dimension.setBlockType(target, "minecraft:air");

    // Enter territory: a green 5x5 floor that starts 6 blocks east of the player.
    // The area reaches 3 blocks above the floor.
    const territoryFrom = vec(origin, 6, 0, -2);
    const territoryTo = vec(origin, 10, 3, 2);
    for (let x = territoryFrom.x; x <= territoryTo.x; x++) {
        for (let z = territoryFrom.z; z <= territoryTo.z; z++) {
            dimension.setBlockType({ x, y: origin.y - 1, z }, "minecraft:lime_concrete");
        }
    }

    const inventory = player.getComponent("minecraft:inventory")?.container;
    for (const [typeId, amount] of [
        ["minecraft:paper", 3],
        ["minecraft:gold_block", 2],
        ["myname:cs_book", 1],
        // Six books fill all slots of a chiseled bookshelf, or two oak shelves with one book per slot.
        ["minecraft:book", 6],
        ["minecraft:oak_shelf", 1],
        ["minecraft:chiseled_bookshelf", 1],
    ]) {
        inventory?.addItem(new ItemStack(typeId, amount));
    }

    return { dimensionId: dimension.id, hopper, target, territoryFrom, territoryTo };
}

function startTest(player) {
    for (const stop of stopListeners) stop();

    const course = buildCourse(player);
    const done = new Set();
    updateQuestlog(done);

    const report = (key, details) => {
        world.sendMessage(`§eEreignis ist eingetreten:§r ${TESTS[key]} (${details})`);
        done.add(key);
        updateQuestlog(done);
    };

    stopListeners = [
        onItemPickup(
            { itemType: "dhsn:certificate" },
            ({ player, itemStack }) => report("pickup", `${player.name} hat ${itemStack.typeId} aufgehoben`)
        ),
        onItemInHopper(
            { location: course.hopper, itemType: "minecraft:paper", consume: true, dimension: course.dimensionId },
            ({ amount, player }) => report("hopper", `${amount}x Papier, Spieler in der Nähe: ${player?.name ?? "keiner"}`)
        ),
        onItemInShelf(
            { itemType: ["myname:cs_book", "minecraft:book"], dimension: course.dimensionId },
            ({ player, block, itemStack }) => report("shelf", `${player.name}: ${itemStack.typeId} in ${block.typeId}`)
        ),
        onItemInShelf(
            { itemType: "minecraft:book", amount: 3, dimension: course.dimensionId },
            ({ player, block, count }) => report("shelfAmount", `${player.name}: ${count} Bücher in ${block.typeId}`)
        ),
        onBlockPlaced(
            { blockType: "minecraft:gold_block", location: course.target, dimension: course.dimensionId },
            ({ player }) => report("block", `${player.name} hat den Goldblock gesetzt`)
        ),
        onEnterTerritory(
            {
                from: course.territoryFrom,
                to: course.territoryTo,
                dimension: course.dimensionId,
                onLeave: ({ player }) => world.sendMessage(`${player.name} hat den grünen Bereich verlassen`),
            },
            ({ player }) => report("territory", `${player.name} hat den grünen Bereich betreten`)
        ),
    ];

    player.sendMessage("§aEreignis-Test aufgebaut. Für das Regal bitte im Überlebensmodus testen: /gamemode survival");
}

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
    if (id !== TEST_COMMAND) return;

    if (sourceEntity?.typeId !== "minecraft:player") {
        console.warn(`[Events] ${TEST_COMMAND} has to be run by a player.`);
        return;
    }

    startTest(sourceEntity);
});
