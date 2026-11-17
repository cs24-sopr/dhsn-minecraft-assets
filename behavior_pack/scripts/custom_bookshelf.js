import { GameMode, ItemStack, system } from "@minecraft/server";
import { changeShelfContents, clearShelfContents, readShelfContents } from "./events/shelf-contents.js";

// Makes our own bookshelves (myname:*_bookshelf) usable: right-click with a book puts it in,
// right-click with an empty hand takes one out, breaking the shelf drops all books.
// The bookshelves have no inventory, so their contents are kept in the shelf counter of
// events/shelf-contents.js. That way onItemInShelf works for them like for vanilla shelves.
//
// Each bookshelf enables this in its block JSON and can configure it there:
//   "dhsn:bookshelf": { "capacity": 6, "accepts": ["myname:cs_book", ...] }

const COMPONENT_NAME = "dhsn:bookshelf";
const DEFAULT_CAPACITY = 6;
const DEFAULT_ACCEPTS = [
    "myname:cs_book",
    "myname:cofi_book",
    "myname:immo_book",
    "myname:niia_book",
    "myname:stwp_book",
    "minecraft:book",
];

/**
 * @param {unknown} params The component's parameters from the block JSON.
 * @returns {{ capacity: number, accepts: string[] }}
 */
function readParams(params) {
    const { capacity, accepts } = /** @type {{ capacity?: number, accepts?: string[] }} */ (params ?? {});
    return {
        capacity: typeof capacity === "number" ? capacity : DEFAULT_CAPACITY,
        accepts: Array.isArray(accepts) ? accepts : DEFAULT_ACCEPTS,
    };
}

function countAll(contents) {
    return Object.values(contents).reduce((sum, amount) => sum + amount, 0);
}

function putBookIn(player, block, hand, capacity) {
    const contents = readShelfContents(block);
    const count = countAll(contents);
    if (count >= capacity) {
        player.sendMessage(`§7Das Regal ist voll (${count}/${capacity}).`);
        return;
    }

    const beforeItemStack = hand.getItem();
    if (!beforeItemStack) return;

    if (player.getGameMode() !== GameMode.Creative) {
        if (beforeItemStack.amount > 1) {
            const rest = beforeItemStack.clone();
            rest.amount -= 1;
            hand.setItem(rest);
        } else {
            hand.setItem();
        }
    }

    changeShelfContents(player, block, new Map([[beforeItemStack.typeId, 1]]), beforeItemStack);
    player.dimension.playSound("insert.chiseled_bookshelf", block.center());
    player.sendMessage(`§7Buch einsortiert (${count + 1}/${capacity}).`);
}

function takeBookOut(player, block, hand, capacity) {
    const contents = readShelfContents(block);
    const typeId = Object.keys(contents)[0];
    if (!typeId) return;

    hand.setItem(new ItemStack(typeId, 1));
    changeShelfContents(player, block, new Map([[typeId, -1]]), undefined);
    player.dimension.playSound("pickup.chiseled_bookshelf", block.center());
    player.sendMessage(`§7Buch herausgenommen (${countAll(contents) - 1}/${capacity}).`);
}

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent(COMPONENT_NAME, {
        onPlayerInteract({ block, player }, { params }) {
            if (!player) return;

            const { capacity, accepts } = readParams(params);
            const hand = player.getComponent("minecraft:inventory")?.container?.getSlot(player.selectedSlotIndex);
            if (!hand) return;

            const held = hand.getItem();
            if (!held) {
                takeBookOut(player, block, hand, capacity);
            } else if (accepts.includes(held.typeId)) {
                putBookIn(player, block, hand, capacity);
            } else {
                player.sendMessage("§7Das passt nicht in dieses Regal.");
            }
        },

        onBreak({ block, dimension }) {
            const contents = readShelfContents(block);
            const location = block.center();
            // One by one, because our books only stack to 1.
            for (const [typeId, amount] of Object.entries(contents)) {
                for (let i = 0; i < amount; i++) dimension.spawnItem(new ItemStack(typeId, 1), location);
            }
            clearShelfContents(block);
        },
    });
});
