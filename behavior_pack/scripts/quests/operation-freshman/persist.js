/** @type {string} Persistent player property shared with the Lucas dialogue. */
const NAME_PROPERTY = 'dhsn:operation_freshman_name'

/** @type {string} Persistent player property containing the selected course. */
const COURSE_PROPERTY = 'dhsn:operation_freshman_course'

/**
 * Supported course identifiers for Operation Erstsemester.
 * @typedef {
 *     'controlling-and-finance' |
 *     'real-estate-finance' |
 *     'computer-science' |
 *     'sustainable-engineering' |
 *     'tax-consulting-and-auditing'
 * } PlayerCourse
 */

/** @type {Set<string>} Allowed values for the persistent course property. */
const PLAYER_COURSES = new Set([
    'controlling-and-finance',
    'real-estate-finance',
    'computer-science',
    'sustainable-engineering',
    'tax-consulting-and-auditing',
])

/**
 * Checks whether a value is one of the supported course identifiers.
 * @param {unknown} value Value to inspect.
 * @returns {value is PlayerCourse} Whether the value is a supported course.
 */
function isPlayerCourse(value) {
    return typeof value === 'string' && PLAYER_COURSES.has(value)
}

/**
 * Stores the preferred name in the player's persistent dynamic properties.
 * Replaces any previously stored name and preserves the supplied string.
 * @param {import('@minecraft/server').Player} player Player whose name to store.
 * @param {string} name Preferred name to persist.
 * @returns {void}
 * @throws {Error} If the player is invalid or the storage operation fails.
 */
export function writePlayerName(player, name) {
    player.setDynamicProperty(NAME_PROPERTY, name)
}

/**
 * Reads the preferred name from the player's persistent dynamic properties.
 * @param {import('@minecraft/server').Player} player Player whose name to read.
 * @returns {string | undefined} Stored name, or undefined if no string is stored.
 * @throws {Error} If the player is invalid or the storage operation fails.
 */
export function readPlayerName(player) {
    const name = player.getDynamicProperty(NAME_PROPERTY)
    return typeof name === 'string' ? name : undefined
}

/**
 * Stores the selected course in the player's persistent dynamic properties.
 * Replaces any previously stored course.
 * @param {import('@minecraft/server').Player} player Player whose course to store.
 * @param {PlayerCourse} course Supported course identifier to persist.
 * @returns {void}
 * @throws {RangeError} If the course is not one of the five supported choices.
 * @throws {Error} If the player is invalid or the storage operation fails.
 */
export function writePlayerCourse(player, course) {
    if (!isPlayerCourse(course)) {
        throw new RangeError('Ungültiger Studiengang.')
    }
    player.setDynamicProperty(COURSE_PROPERTY, course)
}

/**
 * Reads the selected course from the player's persistent dynamic properties.
 * @param {import('@minecraft/server').Player} player Player whose course to read.
 * @returns {PlayerCourse | undefined} Stored course, or undefined if missing or unsupported.
 * @throws {Error} If the player is invalid or the storage operation fails.
 */
export function readPlayerCourse(player) {
    const course = player.getDynamicProperty(COURSE_PROPERTY)
    return isPlayerCourse(course) ? course : undefined
}
