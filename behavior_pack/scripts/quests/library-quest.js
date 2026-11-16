import { ItemStack, system, world } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { onItemInShelf } from "../events/index.js";
import { DHSN_SHELF_TYPES } from "../events/shelf-contents.js";
import { questlog } from "../questlog.js";

// Library quest "Aushilfe in der Bibliothek", played in rounds (see ROUNDS):
// 1. The player talks to the librarian, accepts a round and gets that round's books.
// 2. The player sorts every book into the bookshelf of its study program inside the library.
//    The shelves only accept their own book (see custom_bookshelf.js), so sorting is always correct.
// 3. The player returns to the librarian to finish the round. She then offers the next round;
//    after the last round the quest is finished.
// The progress is stored per player, so it survives /reload and restarting the world.
// For testing, /scriptevent dhsn:quest_reset_library resets your own progress.
// Documentation: docs/quests/library-quest.md

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const LIBRARIAN = "dhsn:librarian";

// The library room. Only shelves inside it count. Undefined means "every shelf in the world",
// until the library is built in the map and its corners are known.
// Example: { from: { x: 100, y: 64, z: 40 }, to: { x: 120, y: 70, z: 60 } }
const LIBRARY_AREA = undefined;

// Display names of the books, used in chat messages.
/** @type {Record<string, string>} */
const BOOK_NAMES = {
    "myname:cs_book": "Informatik",
    "myname:cofi_book": "Controlling",
    "myname:immo_book": "Immobilienwirtschaft",
    "myname:niia_book": "Nachh. Ingenieurwiss.",
    "myname:stwp_book": "Steuerberatung",
};

const ALL_BOOKS = Object.keys(BOOK_NAMES);

/**
 * @typedef {object} Round
 * @property {string[]} books Item ids the librarian hands out; each has to be sorted once.
 *     Every id may appear only once per round.
 * @property {{ body: string, accept: string, decline: string }} offer Dialog that offers the round.
 * @property {string} started Chat line after the round was accepted.
 * @property {{ body: string, button: string }} finish Dialog when the round is handed in.
 * @property {(player: import("@minecraft/server").Player) => void} [reward] Optional reward for the round.
 */

/** @type {Round[]} Placeholder texts until the story team delivers the real dialog. */
const ROUNDS = [
    {
        books: ALL_BOOKS,
        offer: {
            body: "Hallo! Schön, dass du da bist. Mir ist ein Stapel Bücher durcheinandergeraten. "
                + "Kannst du sie in die richtigen Regale einsortieren? Auf jedem Regal steht, welcher Studiengang dort hingehört.",
            accept: "Klar, ich helfe!",
            decline: "Vielleicht später.",
        },
        started: "Hier sind die Bücher. Jedes gehört in das Regal seines Studiengangs.",
        finish: {
            body: "Wunderbar, alles ist an seinem Platz! Vielen Dank für deine Hilfe.",
            button: "Gern geschehen!",
        },
    },
    {
        books: ALL_BOOKS,
        offer: {
            body: "Oh, gerade kam noch ein Stapel Rückgaben herein. Hilfst du mir auch dabei?",
            accept: "Na klar!",
            decline: "Jetzt gerade nicht.",
        },
        started: "Danke! Hier ist der zweite Stapel.",
        finish: {
            body: "Jetzt ist die Bibliothek wieder ordentlich. Du warst mir eine große Hilfe!",
            button: "Immer wieder gern!",
        },
    },
];

// Texts that are the same in every round.
const TEXTS = {
    questTitle: "Aushilfe in der Bibliothek",
    librarianName: "Bibliothekarin",
    declined: "Kein Problem, komm einfach wieder, wenn du Zeit hast.",
    reminder: (sorted, total) => `Du hast schon ${sorted} von ${total} Büchern einsortiert. Die anderen warten noch auf dich!`,
    booksReturned: "Hier, ich habe dir die fehlenden Bücher noch einmal gegeben.",
    allSorted: "Alle Bücher sind einsortiert. Geh zurück zur Bibliothekarin.",
    done: "Danke noch einmal für deine Hilfe mit den Büchern!",
    close: "Tschüss!",
    bookSorted: (name, sorted, total) => `Buch einsortiert: ${name} (${sorted}/${total})`,
    round: (number, total) => `Runde ${number}/${total}`,
    objective: "Bücher sortiert",
    returnObjective: "Zurück zur Bibliothekarin",
    questFinished: (player) => `§aQuest abgeschlossen:§r ${TEXTS.questTitle} (${player.name})`,
    reward: (amount) => `Als Dankeschön bekommst du ${amount} Smaragde von mir.`,
    reset: "Aushilfe in der Bibliothek wurde zurückgesetzt.",
};

const STATE_PROPERTY = "dhsn:quest_library";
const RESET_COMMAND = "dhsn:quest_reset_library";

// Prepared for "Operation Erstsemester" (#79): later this checks for the student ID card.
function canStartQuest(player) {
    return true;
}

// Reward for finishing the whole quest. Placeholder until the story team decides on the real reward.
const QUEST_REWARD = { item: "minecraft:emerald", amount: 3 };

// Called once after the last round.
function giveQuestReward(player) {
    giveItem(player, QUEST_REWARD.item, QUEST_REWARD.amount);
    say(player, TEXTS.reward(QUEST_REWARD.amount));
}

// --------------------------------------------------
// QUEST STATE
// --------------------------------------------------

/**
 * @typedef {object} QuestState
 * @property {number} round Index into ROUNDS.
 * @property {"offered" | "active" | "done"} status "offered": the round was offered but not accepted yet.
 * @property {string[]} sorted Item ids of the books the player already sorted in this round.
 */

/** @returns {QuestState | undefined} */
function readState(player) {
    const value = player.getDynamicProperty(STATE_PROPERTY);
    if (typeof value !== "string") return undefined;

    try {
        const state = JSON.parse(value);
        // States saved before rounds existed have no round number; they belong to the first round.
        return { round: 0, ...state };
    } catch {
        return undefined;
    }
}

/** @param {QuestState | undefined} state */
function writeState(player, state) {
    player.setDynamicProperty(STATE_PROPERTY, state ? JSON.stringify(state) : undefined);
}

// --------------------------------------------------
// QUESTLOG
// --------------------------------------------------

// The questlog is shared by all players, so every player gets an own entry.
const questlogEntries = new Map();

function updateQuestlog(player, state) {
    const existing = questlogEntries.get(player.id);
    if (!state || state.status !== "active") {
        if (existing) questlog.removeEntry(existing);
        questlogEntries.delete(player.id);
        return;
    }

    const total = ROUNDS[state.round].books.length;
    const allSorted = state.sorted.length === total;
    const progress = `${TEXTS.objective}: ${state.sorted.length}/${total}`;
    const lines = [TEXTS.round(state.round + 1, ROUNDS.length), allSorted ? `§a${progress}§r` : progress];
    if (allSorted) lines.push(TEXTS.returnObjective);

    const title = world.getAllPlayers().length > 1 ? `${TEXTS.questTitle} (${player.name})` : TEXTS.questTitle;
    if (existing) {
        existing.title = title;
        existing.lines = lines;
    } else {
        questlogEntries.set(player.id, questlog.createEntry({ title, lines, order: 2 }));
    }
}

// --------------------------------------------------
// DIALOGS
// --------------------------------------------------

const playersInDialog = new Set();

/**
 * Shows a form and retries while the player still has another screen open,
 * e.g. right after the interaction.
 */
async function showForm(form, player) {
    for (let attempt = 0; attempt < 10; attempt++) {
        const response = await form.show(player);
        if (response.cancelationReason !== FormCancelationReason.UserBusy) return response;
        await new Promise((resolve) => system.runTimeout(() => resolve(undefined), 5));
    }
    return undefined;
}

function message(body, button) {
    return new ActionFormData().title(TEXTS.librarianName).body(body).button(button);
}

function say(player, text) {
    player.sendMessage(`§6${TEXTS.librarianName}:§r ${text}`);
}

function countInInventory(player, typeId) {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return 0;

    let count = 0;
    for (let slot = 0; slot < inventory.size; slot++) {
        const itemStack = inventory.getItem(slot);
        if (itemStack?.typeId === typeId) count += itemStack.amount;
    }
    return count;
}

function giveItem(player, typeId, amount = 1) {
    const leftover = player.getComponent("minecraft:inventory")?.container?.addItem(new ItemStack(typeId, amount));
    if (leftover) player.dimension.spawnItem(leftover, player.location);
}

async function offerRound(player, roundIndex) {
    const round = ROUNDS[roundIndex];
    const response = await showForm(
        new ActionFormData()
            .title(TEXTS.librarianName)
            .body(round.offer.body)
            .button(round.offer.accept)
            .button(round.offer.decline),
        player
    );

    if (response?.selection !== 0) {
        writeState(player, { round: roundIndex, status: "offered", sorted: [] });
        say(player, TEXTS.declined);
        return;
    }

    /** @type {QuestState} */
    const state = { round: roundIndex, status: "active", sorted: [] };
    writeState(player, state);
    for (const book of round.books) giveItem(player, book);
    updateQuestlog(player, state);
    say(player, round.started);
}

async function progressDialog(player, state) {
    // Give back books the player lost, e.g. dropped or put into a chest.
    const missing = ROUNDS[state.round].books.filter((book) => !state.sorted.includes(book) && countInInventory(player, book) === 0);
    for (const book of missing) giveItem(player, book);

    const total = ROUNDS[state.round].books.length;
    const body = TEXTS.reminder(state.sorted.length, total) + (missing.length > 0 ? `\n\n${TEXTS.booksReturned}` : "");
    await showForm(message(body, TEXTS.close), player);
}

async function finishRound(player, state) {
    const round = ROUNDS[state.round];
    await showForm(message(round.finish.body, round.finish.button), player);
    round.reward?.(player);

    const isLastRound = state.round === ROUNDS.length - 1;
    if (isLastRound) {
        /** @type {QuestState} */
        const done = { round: state.round, status: "done", sorted: [] };
        writeState(player, done);
        updateQuestlog(player, done);
        giveQuestReward(player);
        world.sendMessage(TEXTS.questFinished(player));
        return;
    }

    // Offer the next round right away; declining keeps it offered for the next visit.
    writeState(player, { round: state.round + 1, status: "offered", sorted: [] });
    updateQuestlog(player, undefined);
    await offerRound(player, state.round + 1);
}

async function talkToLibrarian(player) {
    if (playersInDialog.has(player.id)) return;
    playersInDialog.add(player.id);

    try {
        const state = readState(player);
        if (!state) {
            if (canStartQuest(player)) await offerRound(player, 0);
        } else if (state.status === "offered") {
            await offerRound(player, state.round);
        } else if (state.status === "done") {
            await showForm(message(TEXTS.done, TEXTS.close), player);
        } else if (state.sorted.length === ROUNDS[state.round].books.length) {
            await finishRound(player, state);
        } else {
            await progressDialog(player, state);
        }
    } finally {
        playersInDialog.delete(player.id);
    }
}

// --------------------------------------------------
// EVENTS
// --------------------------------------------------

// The librarian is an NPC entity; cancel its default NPC screen and show our dialog instead.
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    if (event.target.typeId !== LIBRARIAN) return;

    event.cancel = true;
    const player = event.player;
    system.run(() => talkToLibrarian(player));
});

onItemInShelf(
    { itemType: ALL_BOOKS, shelfType: DHSN_SHELF_TYPES, area: LIBRARY_AREA },
    ({ player, itemStack }) => {
        const state = readState(player);
        if (state?.status !== "active") return;

        const books = ROUNDS[state.round].books;
        if (!books.includes(itemStack.typeId) || state.sorted.includes(itemStack.typeId)) return;

        state.sorted.push(itemStack.typeId);
        writeState(player, state);
        updateQuestlog(player, state);

        const name = BOOK_NAMES[itemStack.typeId] ?? itemStack.typeId;
        player.sendMessage(`§e${TEXTS.bookSorted(name, state.sorted.length, books.length)}§r`);
        if (state.sorted.length === books.length) player.sendMessage(`§a${TEXTS.allSorted}§r`);
    }
);

// Show the questlog entry again after joining.
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (initialSpawn) updateQuestlog(player, readState(player));
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    const entry = questlogEntries.get(playerId);
    if (entry) questlog.removeEntry(entry);
    questlogEntries.delete(playerId);
});

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
    if (id !== RESET_COMMAND || sourceEntity?.typeId !== "minecraft:player") return;

    const player = /** @type {import("@minecraft/server").Player} */ (sourceEntity);
    writeState(player, undefined);
    updateQuestlog(player, undefined);
    player.sendMessage(`§a${TEXTS.reset}`);
});
