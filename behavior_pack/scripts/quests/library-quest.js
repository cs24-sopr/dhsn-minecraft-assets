import { BlockVolume, ItemStack, system, world } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { onShelfRejected, setShelfInsertCheck } from "../custom_bookshelf.js";
import { createArea, isInArea, isSameBlock } from "../events/area.js";
import { onItemInShelf } from "../events/index.js";
import { changeShelfContents, DHSN_SHELF_TYPES } from "../events/shelf-contents.js";
import { addEcts } from "../ects.js";
import { questlog } from "../questlog.js";
import { takeOverPerPlayerValue } from "../util/storage.js";

// Library quest "Aushilfe in der Bibliothek", played in rounds (see ROUNDS):
// 1. The player talks to the librarian, accepts a round and gets that round's books: for every
//    study program a random number between 1 and the number of its bookshelves in the library.
// 2. The player sorts every book into a bookshelf of its study program inside the library.
//    The shelves only accept their own book (see custom_bookshelf.js), and each shelf takes only
//    one book per round. Books cannot be taken out again.
// 3. The player returns to the librarian to finish the round. She tidies the shelves up and
//    offers the next round; after the last round the quest is finished.
// 4. After the quest, the librarian offers a challenge: sort a fixed set of books as fast as
//    possible. The challenge can be repeated; the 3 best times are shown on a sign.
// Leaving the library during a round or the challenge shows a warning with a countdown;
// staying outside resets the round (the books are taken away).
// The progress is stored in the world, once per world (the game is single player), so it survives
// /reload and restarting the world.
// Commands: see the bottom of this file. Documentation: docs/quests/library-quest.md

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const LIBRARIAN = "dhsn:librarian";

// The library room. Only shelves inside it count, and leaving it resets a running round.
// Undefined means "every shelf in the world counts, leaving is not checked", until the library
// is built in the map and its corners are known.
// In the finished map the area and the highscore sign are set in the game with the setup menu instead:
//   /scriptevent dhsn:library_setup   (compass "Quest-Setup", see quests/library-setup.js)
// Order of precedence: test setup (dhsn:quest_test_library), then the setup menu, then these constants.
// Saving in the setup menu removes a saved test setup, so the last saved one always applies.
// Example: { from: { x: 100, y: 64, z: 40 }, to: { x: 120, y: 70, z: 60 }, dimension: "minecraft:overworld" }
/** @type {{ from: import("@minecraft/server").Vector3, to: import("@minecraft/server").Vector3, dimension?: string } | undefined} */
const LIBRARY_AREA = undefined;

// Position of the highscore sign in the library (a sign block placed by the builders).
// Undefined means there is no sign; the test setup places its own.
/** @type {import("@minecraft/server").Vector3 | undefined} */
const HIGHSCORE_SIGN = undefined;

// The study programs: their book, the name shown in texts and their bookshelf.
const PROGRAMS = [
    { book: "myname:cs_book", name: "Informatik", shelf: "myname:computer_science_bookshelf" },
    { book: "myname:cofi_book", name: "Controlling", shelf: "myname:controlling_bookshelf" },
    { book: "myname:immo_book", name: "Immobilienwirtschaft", shelf: "myname:immobilienwirtschaft_bookshelf" },
    { book: "myname:niia_book", name: "Nachh. Ingenieurwiss.", shelf: "myname:nachhaltige_ingenieurwissenschaften_bookshelf" },
    { book: "myname:stwp_book", name: "Steuerberatung", shelf: "myname:steuerberatung_bookshelf" },
];

const ALL_BOOKS = PROGRAMS.map((program) => program.book);

// Seconds a player may spend outside the library during a round before it is reset.
const LEAVE_GRACE_SECONDS = 5;

// Books per study program in the challenge: one per shelf, but at most this many.
const CHALLENGE_MAX_PER_PROGRAM = 3;

// How many times the highscore sign shows.
const HIGHSCORE_SIZE = 3;

/**
 * @typedef {object} Round
 * @property {{ body: string, accept: string, decline: string }} offer Dialog that offers the round.
 * @property {string} started Chat line after the round was accepted.
 * @property {{ body: string, button: string }} finish Dialog when the round is handed in.
 * @property {(player: import("@minecraft/server").Player) => void} [reward] Optional reward for the round.
 */

/** @type {Round[]} Placeholder texts until the story team delivers the real dialog. The books are rolled, see rollRoundBooks. */
const ROUNDS = [
    {
        offer: {
            body: "Hallo! Schön, dass du da bist. Mir sind Bücher durcheinandergeraten. "
                + "Kannst du sie in die richtigen Regale einsortieren? Auf den Schildern steht, welcher Studiengang wohin gehört. "
                + "In jedes Regal kommt nur ein Buch.",
            accept: "Klar, ich helfe!",
            decline: "Vielleicht später.",
        },
        started: "Hier sind die Bücher. Jedes gehört in ein Regal seines Studiengangs.",
        finish: {
            body: "Wunderbar, alles ist an seinem Platz! Vielen Dank für deine Hilfe.",
            button: "Gern geschehen!",
        },
    },
    {
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

// Texts that are the same in every round. All chat output is yellow (see chat()), so texts
// should not contain color codes.
const TEXTS = {
    questTitle: "Aushilfe in der Bibliothek",
    librarianName: "Bibliothekarin",
    declined: "Kein Problem, komm einfach wieder, wenn du Zeit hast.",
    reminder: (sorted, total) => `Du hast schon ${sorted} von ${total} Büchern einsortiert. Die anderen warten noch auf dich!`,
    booksReturned: "Hier, ich habe dir die fehlenden Bücher noch einmal gegeben.",
    allSorted: "Alle Bücher sind einsortiert. Geh zurück zur Bibliothekarin.",
    close: "Tschüss!",
    bookSorted: (name, sorted, total) => `Buch einsortiert: ${name} (${sorted}/${total})`,
    round: (number, total) => `Runde ${number}/${total}`,
    objective: "Bücher sortiert",
    returnObjective: "Zurück zur Bibliothekarin",
    questFinished: (player) => `Quest abgeschlossen: ${TEXTS.questTitle} (${player.name})`,
    reward: (amount) => `Als Dankeschön bekommst du ${amount} Smaragde von mir.`,
    ectsReward: (ects) => `Dafür bekommst du außerdem ${ects} ECTS.`,
    reset: "Aushilfe in der Bibliothek wurde zurückgesetzt.",
    wrongShelf: (shelfName, bookName) => `Halt! Das ist das Regal für ${shelfName}. Das Buch für ${bookName} gehört woanders hin.`,
    shelfUsed: (bookName) => `In dieses Regal hast du schon ein Buch gestellt. Nimm ein anderes ${bookName}-Regal.`,
    programDone: (bookName) => `Du hast schon alle ${bookName}-Bücher einsortiert.`,
    leaveTitle: "Halt!",
    leaveWarning: "Hey, wo gehst du mit meinen Büchern hin?",
    // Shown as subtitle in the middle of the screen, so it has to be short.
    leaveCountdown: (seconds) => `Zurück in die Bibliothek! ${seconds} s`,
    leaveBack: "Na also, da bist du ja wieder.",
    leaveReset: "Jetzt sind die Bücher weg. Komm zu mir, wenn du es noch einmal versuchen willst.",
    rejoinReset: "Deine Runde wurde zurückgesetzt.",
    pendingRound: "Sprich mit der Bibliothekarin, sie scheint noch Bücher für dich zu haben.",
    challengeTitle: "Bibliotheks-Challenge",
    challengeOffer: "Da du ja jetzt schon so geübt bist im Bücher-Verräumen, wie wäre es mit einer Challenge? "
        + "Verräume diese Bücher so schnell wie möglich und zeig, was du kannst!",
    challengeAccept: "Challenge starten",
    challengeDecline: "Vielleicht später",
    challengeStarted: "Los geht's! Die Zeit läuft.",
    challengeRunning: (time) => `Die Challenge läuft schon seit ${time}. Beeil dich!`,
    challengeTime: (time) => `Geschafft in ${time}!`,
    challengeRecord: (rank) => `Neuer Rekord! Platz ${rank} auf der Bestenliste.`,
    time: "Zeit",
    signTitle: "Bestzeiten",
};

// The progress is stored in the world (the map) under STATE_PROPERTY, once per world: the game is
// single player. Older versions stored it per player, first on the player itself, later in the world
// as "dhsn:quest_library:<player id>"; both are moved to STATE_PROPERTY the first time it is read.
const STATE_PROPERTY = "dhsn:quest_library";
const HIGHSCORE_PROPERTY = "dhsn:library_highscores";
const TEST_AREA_PROPERTY = "dhsn:library_test_area";
const TEST_SIGN_PROPERTY = "dhsn:library_test_sign";
const MAP_LAYOUT_PROPERTY = "dhsn:library_map_layout";

const RESET_COMMAND = "dhsn:quest_reset_library";
const STATE_COMMAND = "dhsn:quest_library_state";
const HIGHSCORES_RESET_COMMAND = "dhsn:library_highscores_reset";
const HIGHSCORES_ADD_COMMAND = "dhsn:library_highscores_add";
const TEST_CLEAR_COMMAND = "dhsn:quest_test_library_clear";

// Prepared for "Operation Erstsemester" (#79): later this checks for the student ID card.
function canStartQuest(player) {
    return true;
}

// Reward for finishing the whole quest. Placeholder until the story team decides on the real reward.
const QUEST_REWARD = { item: "minecraft:emerald", amount: 3 };

// ECTS for finishing the whole quest, in addition to QUEST_REWARD (see ects.js, project#121).
// Placeholder until the story team decides; all quests together should give 180 (docs/Ects.md).
// The challenge after the quest gives no ECTS.
export const QUEST_ECTS = 5;

// Called once after the last round.
function giveQuestReward(player) {
    giveItem(player, QUEST_REWARD.item, QUEST_REWARD.amount);
    say(player, TEXTS.reward(QUEST_REWARD.amount));
    say(player, TEXTS.ectsReward(QUEST_ECTS));
    addEcts(player, QUEST_ECTS);
}

// Hook for the camera ride (planned by the story team). Called once when the first round is accepted.
function playIntro(player) {}

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const PROGRAM_BY_BOOK = new Map(PROGRAMS.map((program) => [program.book, program]));
const PROGRAM_BY_SHELF = new Map(PROGRAMS.map((program) => [program.shelf, program]));

function bookName(typeId) {
    return PROGRAM_BY_BOOK.get(typeId)?.name ?? typeId;
}

// All chat output of the quest is yellow.
function chat(target, text) {
    target.sendMessage(`§e${text}`);
}

function say(player, text) {
    chat(player, `${TEXTS.librarianName}: ${text}`);
}

/** @param {number} ms */
function formatTime(ms) {
    const tenths = Math.floor(ms / 100);
    const minutes = Math.floor(tenths / 600);
    const seconds = Math.floor(tenths / 10) % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")},${tenths % 10}`;
}

function readJsonProperty(owner, id) {
    const value = owner.getDynamicProperty(id);
    if (typeof value !== "string") return undefined;
    try {
        return JSON.parse(value);
    } catch {
        return undefined;
    }
}

function inventoryOf(player) {
    return player.getComponent("minecraft:inventory")?.container;
}

function countInInventory(player, typeId) {
    const inventory = inventoryOf(player);
    if (!inventory) return 0;

    let count = 0;
    for (let slot = 0; slot < inventory.size; slot++) {
        const itemStack = inventory.getItem(slot);
        if (itemStack?.typeId === typeId) count += itemStack.amount;
    }
    return count;
}

function removeFromInventory(player, typeIds) {
    const inventory = inventoryOf(player);
    if (!inventory) return;

    for (let slot = 0; slot < inventory.size; slot++) {
        const itemStack = inventory.getItem(slot);
        if (itemStack && typeIds.includes(itemStack.typeId)) inventory.setItem(slot);
    }
}

function giveItem(player, typeId, amount = 1) {
    const leftover = inventoryOf(player)?.addItem(new ItemStack(typeId, amount));
    if (leftover) player.dimension.spawnItem(leftover, player.location);
}

/** Our books stack only to 1, so each one is handed out separately. */
function giveBooks(player, books) {
    for (const [book, amount] of Object.entries(books)) {
        for (let i = 0; i < amount; i++) giveItem(player, book);
    }
}

function totalBooks(books) {
    return Object.values(books).reduce((sum, amount) => sum + amount, 0);
}

// --------------------------------------------------
// LIBRARY AREA AND SHELVES
// --------------------------------------------------

/**
 * @typedef {object} Library
 * @property {import("../events/area.js").Area} area
 * @property {string} dimension Dimension id.
 * @property {{ from: import("@minecraft/server").Vector3, to: import("@minecraft/server").Vector3 }} corners
 */

/**
 * The library area: the one saved by the test setup, otherwise the one of the setup menu, otherwise LIBRARY_AREA.
 * @returns {Library | undefined}
 */
function getLibrary() {
    const map = readMapValues();
    const fromMap = map.library_area && { ...map.library_area, dimension: map.dimension };
    const source = readJsonProperty(world, TEST_AREA_PROPERTY) ?? fromMap ?? LIBRARY_AREA;
    if (!source) return undefined;

    return {
        area: createArea(source.from, source.to),
        dimension: source.dimension ?? "minecraft:overworld",
        corners: { from: source.from, to: source.to },
    };
}

/** @returns {import("@minecraft/server").Vector3 | undefined} */
function getHighscoreSign() {
    return readJsonProperty(world, TEST_SIGN_PROPERTY) ?? readMapValues().highscore_sign ?? HIGHSCORE_SIGN;
}

// --------------------------------------------------
// LIBRARY POSITIONS FROM THE SETUP MENU (finished map)
// --------------------------------------------------

/**
 * The values saved by the setup menu (quests/library-setup.js) in the world:
 * { dimension, library_area: { from, to }, library_area_corners: { a, b }, highscore_sign: { x, y, z } }.
 * @returns {Record<string, any>}
 */
function readMapValues() {
    const values = readJsonProperty(world, MAP_LAYOUT_PROPERTY);
    return values && typeof values === "object" ? values : {};
}

/** @returns {Record<string, any>} A copy of the values saved by the setup menu. */
export function getLibraryMapValues() {
    return readMapValues();
}

/**
 * Saves values of the setup menu (merged into the saved ones; undefined deletes a value). A saved test setup
 * is removed, so the menu values apply. The highscore sign is rewritten.
 * @param {Record<string, any>} changes
 */
export function setLibraryMapValues(changes) {
    const values = { ...readMapValues(), ...changes };
    for (const key of Object.keys(values)) if (values[key] === undefined) delete values[key];
    world.setDynamicProperty(MAP_LAYOUT_PROPERTY, Object.keys(values).length > 0 ? JSON.stringify(values) : undefined);
    clearLibraryTestSetup();
    updateHighscoreSign();
}

/** Deletes all values of the setup menu. */
export function clearLibraryMapValues() {
    world.setDynamicProperty(MAP_LAYOUT_PROPERTY, undefined);
}

/** @returns {string | undefined} Where the active library area comes from, for the setup menu. */
export function getLibraryLayoutSource() {
    if (readJsonProperty(world, TEST_AREA_PROPERTY)) return "Testaufbau";
    if (readMapValues().library_area) return "Setup-Menü";
    return LIBRARY_AREA ? "LIBRARY_AREA im Code" : undefined;
}

/**
 * For the setup menu: number of shelves per study program in the active library area, all programs listed.
 * @returns {{ name: string, shelves: number }[] | undefined} undefined without library area.
 */
export function getShelfCountsPerProgram() {
    if (!getLibrary()) return undefined;
    const counts = countShelves();
    return PROGRAMS.map((program) => ({ name: program.name, shelves: counts[program.book] ?? 0 }));
}

/** @returns {number} Number of librarians in the active library area (0 without area). */
export function countLibrariansInLibrary() {
    const library = getLibrary();
    if (!library) return 0;
    try {
        return world.getDimension(library.dimension).getEntities({ type: LIBRARIAN }).filter((entity) => isInArea(library.area, entity.location)).length;
    } catch {
        return 0;
    }
}

function isInLibrary(library, dimensionId, location) {
    return !library || (dimensionId === library.dimension && isInArea(library.area, location));
}

/**
 * Counts our bookshelves in the library per book. Without a library area, every program
 * counts as having one shelf.
 * @returns {Record<string, number>} Book id -> number of shelves.
 */
function countShelves() {
    /** @type {Record<string, number>} */
    const counts = {};
    const library = getLibrary();
    if (!library) {
        for (const book of ALL_BOOKS) counts[book] = 1;
        return counts;
    }

    const dimension = world.getDimension(library.dimension);
    try {
        const volume = new BlockVolume(library.area.min, library.area.max);
        for (const location of dimension.getBlocks(volume, { includeTypes: DHSN_SHELF_TYPES }).getBlockLocationIterator()) {
            const program = PROGRAM_BY_SHELF.get(dimension.getBlock(location)?.typeId ?? "");
            if (program) counts[program.book] = (counts[program.book] ?? 0) + 1;
        }
    } catch (error) {
        console.warn(`[library-quest] Could not count the bookshelves: ${error}`);
    }
    return counts;
}

/** Normal round: for every program a random number from 1 to its number of shelves. */
function rollRoundBooks() {
    /** @type {Record<string, number>} */
    const books = {};
    for (const [book, shelves] of Object.entries(countShelves())) {
        if (shelves > 0) books[book] = 1 + Math.floor(Math.random() * shelves);
    }
    return books;
}

/** Challenge: one book per shelf, at most CHALLENGE_MAX_PER_PROGRAM per program, the same for everyone. */
function challengeBooks() {
    /** @type {Record<string, number>} */
    const books = {};
    for (const [book, shelves] of Object.entries(countShelves())) {
        if (shelves > 0) books[book] = Math.min(shelves, CHALLENGE_MAX_PER_PROGRAM);
    }
    return books;
}

/** Takes the given sorted books out of their shelves again ("the librarian tidies up"). */
function clearSortedBooks(player, sorted) {
    const dimension = world.getDimension(getLibrary()?.dimension ?? player.dimension.id);
    for (const { book, shelf } of sorted) {
        if (!shelf) continue;
        try {
            const block = dimension.getBlock(shelf);
            if (block && DHSN_SHELF_TYPES.includes(block.typeId)) changeShelfContents(player, block, new Map([[book, -1]]), undefined);
        } catch {
            // Shelf not loaded or gone: nothing to tidy up.
        }
    }
}

// --------------------------------------------------
// QUEST STATE
// --------------------------------------------------

/**
 * @typedef {object} SortedBook
 * @property {string} book Item id.
 * @property {import("@minecraft/server").Vector3 | undefined} shelf Where it went; undefined for progress saved by older versions.
 */

/**
 * @typedef {object} Run A round or the challenge while it is being played.
 * @property {Record<string, number>} books Book id -> how many were handed out.
 * @property {SortedBook[]} sorted Books already sorted.
 */

/**
 * @typedef {object} Challenge
 * @property {number} startedAt Date.now() when it started.
 * @property {Record<string, number>} books
 * @property {SortedBook[]} sorted
 */

/**
 * @typedef {object} QuestState
 * @property {number} round Index into ROUNDS.
 * @property {"offered" | "active" | "done"} status "offered": the round was offered but not accepted yet.
 * @property {Record<string, number>} [books] Books of the active round (book id -> amount).
 * @property {SortedBook[]} sorted Books already sorted in the active round.
 * @property {Challenge} [challenge] Only while a challenge runs (after the quest is done).
 */

/** @returns {QuestState | undefined} */
function readState(player) {
    // Older per-player progress in the world ("dhsn:quest_library:<player id>") is taken over first.
    const raw = takeOverPerPlayerValue(STATE_PROPERTY);
    let state = typeof raw === "string" ? readJsonProperty(world, STATE_PROPERTY) : undefined;
    if (state === undefined) {
        // Progress of the oldest versions on the player: move it to the world.
        state = readJsonProperty(player, STATE_PROPERTY);
        if (state !== undefined) {
            world.setDynamicProperty(STATE_PROPERTY, JSON.stringify(state));
            player.setDynamicProperty(STATE_PROPERTY, undefined);
        }
    }
    if (!state || typeof state !== "object") return undefined;

    // States saved before rounds existed have no round number; they belong to the first round.
    state.round ??= 0;
    // Older versions stored only item ids and handed out one book of every program.
    state.sorted = (state.sorted ?? []).map((entry) => (typeof entry === "string" ? { book: entry, shelf: undefined } : entry));
    if (state.status === "active" && !state.books) state.books = Object.fromEntries(ALL_BOOKS.map((book) => [book, 1]));
    return state;
}

/** @param {QuestState | undefined} state */
function writeState(player, state) {
    world.setDynamicProperty(STATE_PROPERTY, state ? JSON.stringify(state) : undefined);
}

/**
 * The round or challenge the player is playing right now.
 * @param {QuestState | undefined} state
 * @returns {Run | undefined}
 */
function currentRun(state) {
    if (state?.status === "active" && state.books) return { books: state.books, sorted: state.sorted };
    if (state?.status === "done" && state.challenge) return state.challenge;
    return undefined;
}

function sortedCount(run, book) {
    return run.sorted.filter((entry) => entry.book === book).length;
}

// --------------------------------------------------
// QUESTLOG
// --------------------------------------------------

// The questlog is shared by all players, so every player gets an own entry.
const questlogEntries = new Map();

// Players who are outside the library while the next round waits for them (round 2 or later offered).
// They get a hint in the questlog to go back to the librarian.
const pendingHints = new Set();

/** @param {QuestState | undefined} state */
function updateQuestlog(player, state) {
    const existing = questlogEntries.get(player.id);
    const run = currentRun(state);
    const showHint = !run && state?.status === "offered" && pendingHints.has(player.id);
    if (!state || (!run && !showHint)) {
        if (existing) questlog.removeEntry(existing);
        questlogEntries.delete(player.id);
        return;
    }

    let title;
    let lines;
    if (!run) {
        title = TEXTS.questTitle;
        lines = [TEXTS.pendingRound];
    } else if (state.challenge) {
        const total = totalBooks(run.books);
        const progress = `${TEXTS.objective}: ${run.sorted.length}/${total}`;
        title = TEXTS.challengeTitle;
        lines = [progress, `${TEXTS.time}: ${formatTime(Date.now() - state.challenge.startedAt)}`];
    } else {
        const total = totalBooks(run.books);
        const allSorted = run.sorted.length >= total;
        const progress = `${TEXTS.objective}: ${run.sorted.length}/${total}`;
        title = TEXTS.questTitle;
        lines = [TEXTS.round(state.round + 1, ROUNDS.length), allSorted ? `§a${progress}§r` : progress];
        if (allSorted) lines.push(TEXTS.returnObjective);
    }

    if (world.getAllPlayers().length > 1) title = `${title} (${player.name})`;
    if (existing) {
        existing.title = title;
        existing.lines = lines;
    } else {
        questlogEntries.set(player.id, questlog.createEntry({ title, lines, order: 2 }));
    }
}

// --------------------------------------------------
// HIGHSCORES
// --------------------------------------------------

/** @returns {{ name: string, timeMs: number }[]} */
function readHighscores() {
    const list = readJsonProperty(world, HIGHSCORE_PROPERTY);
    return Array.isArray(list) ? list : [];
}

/**
 * Adds a time. The list keeps the HIGHSCORE_SIZE best attempts, no matter by whom.
 * @returns {number} The place on the list (1 = best), or 0 if the time is not good enough.
 */
function addHighscore(name, timeMs) {
    const entry = { name, timeMs };
    // Stable sort: with equal times the older entry stays in front.
    const list = [...readHighscores(), entry].sort((a, b) => a.timeMs - b.timeMs).slice(0, HIGHSCORE_SIZE);
    world.setDynamicProperty(HIGHSCORE_PROPERTY, JSON.stringify(list));
    updateHighscoreSign();
    return list.indexOf(entry) + 1;
}

function updateHighscoreSign() {
    const location = getHighscoreSign();
    if (!location) return;

    const dimension = world.getDimension(getLibrary()?.dimension ?? "minecraft:overworld");
    try {
        const sign = dimension.getBlock(location)?.getComponent("minecraft:sign");
        if (!sign) return;

        const list = readHighscores();
        const lines = [TEXTS.signTitle];
        for (let i = 0; i < HIGHSCORE_SIZE; i++) {
            const entry = list[i];
            // Signs are narrow, so long names are cut.
            lines.push(entry ? `${i + 1}. ${entry.name.slice(0, 8)} ${formatTime(entry.timeMs)}` : `${i + 1}. -`);
        }
        sign.setWaxed(false);
        sign.setText(lines.join("\n"));
        sign.setWaxed(true);
    } catch (error) {
        console.warn(`[library-quest] Could not update the highscore sign: ${error}`);
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

    if (roundIndex === 0) playIntro(player);

    /** @type {QuestState} */
    const state = { round: roundIndex, status: "active", books: rollRoundBooks(), sorted: [] };
    writeState(player, state);
    giveBooks(player, state.books);
    updateQuestlog(player, state);
    say(player, round.started);
}

/** Gives back books the player lost, e.g. dropped or put into a chest. */
function returnMissingBooks(player, run) {
    /** @type {[string, number][]} */
    const missing = [];
    for (const [book, amount] of Object.entries(run.books)) {
        const count = amount - sortedCount(run, book) - countInInventory(player, book);
        if (count > 0) missing.push([book, count]);
    }
    if (missing.length === 0) return false;

    // Books lying on the ground would be duplicates of the new ones, so they disappear.
    removeQuestBooksOnGround(player.dimension);
    for (const [book, count] of missing) {
        for (let i = 0; i < count; i++) giveItem(player, book);
    }
    return true;
}

/** Removes every book of the library quest that lies on the ground (item entity) in the dimension. */
function removeQuestBooksOnGround(dimension) {
    for (const entity of dimension.getEntities({ type: "minecraft:item" })) {
        try {
            const typeId = entity.getComponent("minecraft:item")?.itemStack.typeId;
            if (typeId && ALL_BOOKS.includes(typeId)) entity.remove();
        } catch {
            // The item was picked up or despawned in the meantime.
        }
    }
}

async function progressDialog(player, state) {
    const run = /** @type {Run} */ (currentRun(state));
    const returned = returnMissingBooks(player, run);
    const body = TEXTS.reminder(run.sorted.length, totalBooks(run.books)) + (returned ? `\n\n${TEXTS.booksReturned}` : "");
    await showForm(message(body, TEXTS.close), player);
}

async function finishRound(player, state) {
    const round = ROUNDS[state.round];
    await showForm(message(round.finish.body, round.finish.button), player);
    clearSortedBooks(player, state.sorted);
    round.reward?.(player);

    const isLastRound = state.round === ROUNDS.length - 1;
    if (isLastRound) {
        /** @type {QuestState} */
        const done = { round: state.round, status: "done", sorted: [] };
        writeState(player, done);
        updateQuestlog(player, done);
        giveQuestReward(player);
        world.sendMessage(`§e${TEXTS.questFinished(player)}`);
        await offerChallenge(player);
        return;
    }

    // Offer the next round right away; declining keeps it offered for the next visit.
    writeState(player, { round: state.round + 1, status: "offered", sorted: [] });
    updateQuestlog(player, undefined);
    await offerRound(player, state.round + 1);
}

async function offerChallenge(player) {
    const response = await showForm(
        new ActionFormData()
            .title(TEXTS.librarianName)
            .body(TEXTS.challengeOffer)
            .button(TEXTS.challengeAccept)
            .button(TEXTS.challengeDecline),
        player
    );
    if (response?.selection !== 0) return;

    const state = readState(player);
    if (state?.status !== "done") return;

    state.challenge = { startedAt: 0, books: challengeBooks(), sorted: [] };
    giveBooks(player, state.challenge.books);
    // The clock starts after the books are handed out.
    state.challenge.startedAt = Date.now();
    writeState(player, state);
    updateQuestlog(player, state);
    say(player, TEXTS.challengeStarted);
}

async function challengeProgressDialog(player, state) {
    const returned = returnMissingBooks(player, state.challenge);
    const body = TEXTS.challengeRunning(formatTime(Date.now() - state.challenge.startedAt)) + (returned ? `\n\n${TEXTS.booksReturned}` : "");
    await showForm(message(body, TEXTS.close), player);
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
            if (state.challenge) await challengeProgressDialog(player, state);
            else await offerChallenge(player);
        } else if (state.sorted.length >= totalBooks(state.books ?? {})) {
            await finishRound(player, state);
        } else {
            await progressDialog(player, state);
        }
    } finally {
        playersInDialog.delete(player.id);
    }
}

function finishChallenge(player, state) {
    const challenge = /** @type {Challenge} */ (state.challenge);
    const timeMs = Date.now() - challenge.startedAt;
    clearSortedBooks(player, challenge.sorted);
    delete state.challenge;
    writeState(player, state);
    updateQuestlog(player, state);

    say(player, TEXTS.challengeTime(formatTime(timeMs)));
    const rank = addHighscore(player.name, timeMs);
    if (rank > 0) chat(player, TEXTS.challengeRecord(rank));
}

// --------------------------------------------------
// RESET (leaving the library, reset command)
// --------------------------------------------------

/**
 * Ends the current round or challenge without result: the books are taken away and out of the
 * shelves. A round is offered again (with newly rolled books), the quest stays done after a challenge.
 */
function resetRun(player, state) {
    const run = currentRun(state);
    if (!state || !run) return;

    removeFromInventory(player, Object.keys(run.books));
    clearSortedBooks(player, run.sorted);
    if (state.challenge) {
        delete state.challenge;
    } else {
        state.status = "offered";
        delete state.books;
        state.sorted = [];
    }
    writeState(player, state);
    updateQuestlog(player, state);
}

/** @type {Map<string, { endTick: number, shownSeconds: number }>} Players outside the library with a running round. */
const countdowns = new Map();

function clearTitle(player) {
    try {
        player.runCommand("title @s clear");
    } catch {
        // The player may have left in the meantime.
    }
}

function cancelCountdown(player, comeBack) {
    if (!countdowns.delete(player.id)) return;
    clearTitle(player);
    if (comeBack) say(player, TEXTS.leaveBack);
}

// Checks 4 times per second where players with a running round are, and updates the challenge clock.
let checks = 0;
system.runInterval(() => {
    checks++;
    const library = getLibrary();
    for (const player of world.getAllPlayers()) {
        const state = readState(player);
        const run = currentRun(state);

        // Challenge clock in the questlog, once per second (every 4th check).
        if (state?.challenge && checks % 4 === 0) updateQuestlog(player, state);

        // After the first round: outside the library, remind the player that the librarian has more books.
        const wantsHint = !run && state?.status === "offered" && state.round > 0
            && !!library && !isInLibrary(library, player.dimension.id, player.location);
        if (wantsHint !== pendingHints.has(player.id)) {
            if (wantsHint) pendingHints.add(player.id);
            else pendingHints.delete(player.id);
            updateQuestlog(player, state);
        }

        if (!run || !library) {
            cancelCountdown(player, false);
            continue;
        }

        const inside = isInLibrary(library, player.dimension.id, player.location);
        const countdown = countdowns.get(player.id);
        if (inside) {
            cancelCountdown(player, true);
        } else if (!countdown) {
            countdowns.set(player.id, { endTick: system.currentTick + LEAVE_GRACE_SECONDS * 20, shownSeconds: LEAVE_GRACE_SECONDS });
            player.onScreenDisplay.setTitle(TEXTS.leaveTitle, {
                subtitle: TEXTS.leaveCountdown(LEAVE_GRACE_SECONDS),
                fadeInDuration: 0,
                stayDuration: (LEAVE_GRACE_SECONDS + 1) * 20,
                fadeOutDuration: 10,
            });
            say(player, TEXTS.leaveWarning);
        } else {
            const seconds = Math.ceil((countdown.endTick - system.currentTick) / 20);
            if (seconds <= 0) {
                countdowns.delete(player.id);
                clearTitle(player);
                resetRun(player, state);
                say(player, TEXTS.leaveReset);
            } else if (seconds !== countdown.shownSeconds) {
                countdown.shownSeconds = seconds;
                player.onScreenDisplay.updateSubtitle(TEXTS.leaveCountdown(seconds));
            }
        }
    }
}, 5);

// --------------------------------------------------
// BOOKSHELVES
// --------------------------------------------------

/** The run the shelf click belongs to, or undefined if the click does not concern the quest. */
function runForShelf(player, block, book) {
    const state = readState(player);
    const run = currentRun(state);
    if (!state || !run || !(book in run.books)) return undefined;
    if (!isInLibrary(getLibrary(), block.dimension.id, block.location)) return undefined;
    return { state, run };
}

// One book per shelf and round, and not more books of a program than were handed out.
setShelfInsertCheck(({ player, block, itemStack }) => {
    const found = runForShelf(player, block, itemStack.typeId);
    if (!found) return true;

    const { run } = found;
    const shelfUsed = run.sorted.some((entry) => entry.shelf && isSameBlock(entry.shelf, block.location));
    return !shelfUsed && sortedCount(run, itemStack.typeId) < run.books[itemStack.typeId];
});

// During a round, the librarian explains why a book was refused.
onShelfRejected(({ player, block, itemStack, reason }) => {
    const found = runForShelf(player, block, itemStack.typeId);
    if (!found) return false;

    const name = bookName(itemStack.typeId);
    if (reason === "wrong_shelf") {
        const shelfProgram = PROGRAM_BY_SHELF.get(block.typeId);
        if (!shelfProgram) return false;
        say(player, TEXTS.wrongShelf(shelfProgram.name, name));
        return true;
    }
    if (reason === "blocked") {
        const done = sortedCount(found.run, itemStack.typeId) >= found.run.books[itemStack.typeId];
        say(player, done ? TEXTS.programDone(name) : TEXTS.shelfUsed(name));
        return true;
    }
    return false;
});

onItemInShelf({ itemType: ALL_BOOKS, shelfType: DHSN_SHELF_TYPES }, ({ player, block, itemStack }) => {
    const found = runForShelf(player, block, itemStack.typeId);
    if (!found) return;

    const { state, run } = found;
    run.sorted.push({ book: itemStack.typeId, shelf: { ...block.location } });
    writeState(player, state);
    updateQuestlog(player, state);

    const total = totalBooks(run.books);
    chat(player, TEXTS.bookSorted(bookName(itemStack.typeId), run.sorted.length, total));
    if (run.sorted.length < total) return;

    if (state.challenge) finishChallenge(player, state);
    else chat(player, TEXTS.allSorted);
});

// --------------------------------------------------
// TEST SETUP (used by events/test-library.js)
// --------------------------------------------------

/**
 * Saves the library area and the highscore sign of the test setup in the world, so they
 * survive /reload and restarting the world. They take precedence over LIBRARY_AREA and HIGHSCORE_SIGN.
 * @param {{ from: import("@minecraft/server").Vector3, to: import("@minecraft/server").Vector3, dimension: string }} area
 * @param {import("@minecraft/server").Vector3} sign
 */
export function setLibraryTestSetup(area, sign) {
    world.setDynamicProperty(TEST_AREA_PROPERTY, JSON.stringify(area));
    world.setDynamicProperty(TEST_SIGN_PROPERTY, JSON.stringify(sign));
    updateHighscoreSign();
}

/**
 * Resets the quest progress (also used by the setup menu): the books of a running round or challenge are
 * taken away and out of the shelves.
 * @param {import("@minecraft/server").Player} player
 */
export function resetLibraryQuest(player) {
    const state = readState(player);
    resetRun(player, state);
    cancelCountdown(player, false);
    writeState(player, undefined);
    updateQuestlog(player, undefined);
    chat(player, TEXTS.reset);
}

function clearLibraryTestSetup() {
    world.setDynamicProperty(TEST_AREA_PROPERTY, undefined);
    world.setDynamicProperty(TEST_SIGN_PROPERTY, undefined);
}

// --------------------------------------------------
// EVENTS AND COMMANDS
// --------------------------------------------------

// The librarian is an NPC entity; cancel its default NPC screen and show our dialog instead.
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    if (event.target.typeId !== LIBRARIAN) return;

    event.cancel = true;
    const player = event.player;
    system.run(() => talkToLibrarian(player));
});

world.afterEvents.worldLoad.subscribe(() => updateHighscoreSign());

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!initialSpawn) return;

    // Left the world while outside the library (e.g. during the countdown): no grace period.
    const state = readState(player);
    const library = getLibrary();
    if (currentRun(state) && library && !isInLibrary(library, player.dimension.id, player.location)) {
        resetRun(player, state);
        chat(player, TEXTS.rejoinReset);
        return;
    }

    // Show the questlog entry again after joining.
    updateQuestlog(player, state);
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    const entry = questlogEntries.get(playerId);
    if (entry) questlog.removeEntry(entry);
    questlogEntries.delete(playerId);
    countdowns.delete(playerId);
    pendingHints.delete(playerId);
});

function describeState(state) {
    if (!state) return ["Kein Stand: Quest noch nicht begonnen."];

    const lines = [`Runde ${state.round + 1}/${ROUNDS.length}, Status: ${state.status}`];
    const run = currentRun(state);
    if (run) {
        lines.push(state.challenge ? `Challenge läuft seit ${formatTime(Date.now() - state.challenge.startedAt)}` : "Runde läuft");
        for (const [book, amount] of Object.entries(run.books)) {
            lines.push(` ${bookName(book)}: ${sortedCount(run, book)}/${amount} einsortiert`);
        }
        for (const { book, shelf } of run.sorted) {
            lines.push(`  ${bookName(book)} -> ${shelf ? `${shelf.x} ${shelf.y} ${shelf.z}` : "unbekanntes Regal"}`);
        }
    }
    const library = getLibrary();
    lines.push(library ? `Bibliothek: ${JSON.stringify(library.corners)}` : "Bibliothek: kein Bereich gesetzt");
    return lines;
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    const commands = [RESET_COMMAND, STATE_COMMAND, HIGHSCORES_RESET_COMMAND, HIGHSCORES_ADD_COMMAND, TEST_CLEAR_COMMAND];
    if (!commands.includes(id) || sourceEntity?.typeId !== "minecraft:player") return;

    const player = /** @type {import("@minecraft/server").Player} */ (sourceEntity);
    switch (id) {
        case RESET_COMMAND:
            resetLibraryQuest(player);
            break;
        case STATE_COMMAND:
            for (const line of describeState(readState(player))) chat(player, line);
            break;
        case HIGHSCORES_RESET_COMMAND:
            world.setDynamicProperty(HIGHSCORE_PROPERTY, undefined);
            updateHighscoreSign();
            chat(player, "Bestenliste geleert.");
            break;
        case HIGHSCORES_ADD_COMMAND: {
            // /scriptevent dhsn:library_highscores_add <Name> <Sekunden>
            const [name, seconds] = message.trim().split(/\s+/);
            const timeMs = Math.round(Number(seconds?.replace(",", ".")) * 1000);
            if (!name || !(timeMs > 0)) {
                chat(player, `Aufruf: /scriptevent ${HIGHSCORES_ADD_COMMAND} <Name> <Sekunden>`);
                break;
            }
            const rank = addHighscore(name, timeMs);
            chat(player, rank > 0 ? `${name} mit ${formatTime(timeMs)} auf Platz ${rank} eingetragen.` : `${formatTime(timeMs)} reicht nicht für die Bestenliste.`);
            break;
        }
        case TEST_CLEAR_COMMAND:
            clearLibraryTestSetup();
            chat(player, "Test-Bereich und Test-Schild der Bibliothek gelöscht. Es gelten wieder die Werte aus dem Setup-Menü oder dem Code.");
            break;
    }
});
