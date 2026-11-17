import { system, world } from '@minecraft/server'

/**
 * @typedef {object} EntryOptions
 * @property {string} title
 * @property {string[]} lines
 * @property {number|null} [order] Omit or use null for unspecified ordering.
 */

class QuestlogEntry {
    /**
     * Creates a display entry and registers its cache-invalidation callback.
     * @param {string} title
     * @param {string[]} lines
     * @param {number|null|undefined} order
     * @param {() => void} changed Invalidates the owning questlog's cached text.
     */
    constructor(title, lines, order, changed) {
        this._title = title
        this._lines = lines
        this._order = order
        this._changed = changed

        this._text = null
    }

    /**
     * Replaces the title and invalidates the entry and questlog text caches.
     * @param {string} value
     */
    set title(value) {
        this._text = null
        this._changed()

        this._title = value
    }

    /** @returns {string} The current title without generated formatting. */
    get title() {
        return this._title
    }

    /**
     * Replaces the lines and invalidates the entry and questlog text caches.
     * @param {string[]} value
     */
    set lines(value) {
        this._text = null
        this._changed()

        this._lines = value
    }

    /** @returns {string[]} The stored lines array; direct mutations bypass invalidation. */
    get lines() {
        return this._lines
    }

    /**
     * Changes the sort order and invalidates the questlog's cached text.
     * @param {number|null} value
     */
    set order(value) {
        this._changed()

        this._order = value
    }

    /** @returns {number|null|undefined} The explicit order, or an unspecified value. */
    get order() {
        return this._order
    }

    /**
     * Returns the numeric value used when sorting entries.
     * @returns {number} The explicit order, or Number.MAX_SAFE_INTEGER if unspecified.
     */
    normalizedOrder() {
        return this._order ?? Number.MAX_SAFE_INTEGER
    }

    /**
     * Formats the title and objective lines, reusing cached text when available.
     * @returns {string} A gold title followed by prefixed lines separated by newlines.
     */
    toText() {
        if (this._text != null) return this._text

        const lines = this._lines.map((line) => ` - ${line}`).join('\n')
        this._text = `§6${this._title}§r\n${lines}`

        return this._text
    }
}

class Questlog {
    /** Creates an empty questlog with no cached display text. */
    constructor() {
        this._entries = []
        this._text = null
    }

    /**
     * Creates and adds an entry owned by this questlog.
     * @param {EntryOptions} entryOptions The entry's initial display data.
     * @returns {QuestlogEntry} A handle for changing or removing the entry.
     */
    createEntry(entryOptions) {
        const entry = new QuestlogEntry(
            entryOptions.title,
            entryOptions.lines,
            entryOptions.order,

            () => {
                this._text = null
            }
        )

        this._entries.push(entry)
        this._text = null

        return entry
    }

    /**
     * Removes an entry by object identity; does nothing if it is not in this log.
     * @param {QuestlogEntry} entry The handle returned by createEntry.
     * @returns {void}
     */
    removeEntry(entry) {
        const index = this._entries.indexOf(entry)

        if (index != -1) {
            this._entries.splice(index, 1)
            this._text = null
        }
    }

    /**
     * Formats entries in ascending order without rearranging the stored array.
     * @returns {string} Cached display text, with a blank line between entries.
     */
    toText() {
        if (this._text != null) return this._text

        const sortedEntries = [...this._entries].sort(
            (a, b) => a.normalizedOrder() - b.normalizedOrder()
        )

        this._text = sortedEntries.map((entry) => entry.toText()).join('\n\n')
        return this._text
    }
}

export const questlog = new Questlog()

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        player.onScreenDisplay.setActionBar(questlog.toText())
    }
}, 20)
