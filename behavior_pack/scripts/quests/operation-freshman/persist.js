import { world } from '@minecraft/server'

/** @type {string} Persistent world property shared with the Lucas dialogue. */
const NAME_PROPERTY = 'dhsn:operation_freshman_name'

/** @type {string} Persistent world property containing the selected course. */
const COURSE_PROPERTY = 'dhsn:operation_freshman_course'

/** @type {string} Persistent world property containing the last dialogue result. */
const LUCAS_DIALOG_PROPERTY = 'dhsn:operation_freshman_lucas_dialog'

/** @type {string} Persistent world property containing Frau Sommer's last dialogue result. */
const MRS_SOMMER_DIALOG_PROPERTY = 'dhsn:operation_freshman_mrs_sommer_dialog'

/** @type {string} Persistent entity ID of the Lucas selected by the first zone entry. */
const SELECTED_LUCAS_PROPERTY = 'dhsn:operation_freshman_selected_lucas'

/**
 * Reads the selected Lucas identity, including while his chunk is unloaded.
 * @returns {string | undefined} Selected entity ID, if an entrance was claimed.
 */
export function readSelectedLucasId() {
    const value = world.getDynamicProperty(SELECTED_LUCAS_PROPERTY)
    return typeof value === 'string' ? value : undefined
}

/**
 * Persists the selected Lucas before removing the other coaches.
 * @param {string} entityId Selected Lucas entity ID.
 * @returns {void}
 * @throws {Error} If writing world storage fails.
 */
export function writeSelectedLucasId(entityId) {
    world.setDynamicProperty(SELECTED_LUCAS_PROPERTY, entityId)
}

/**
 * Supported course identifiers for Operation Erstsemester.
 * @typedef {'controlling-and-finance' | 'real-estate-finance' | 'computer-science' | 'sustainable-engineering' | 'tax-consulting-and-auditing'} PlayerCourse
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
 * Stores the preferred name in the world's persistent dynamic properties.
 * Replaces any previously stored name and preserves the supplied string.
 * @param {string} name Preferred name to persist.
 * @returns {void}
 * @throws {Error} If the storage operation fails.
 */
export function writePlayerName(name) {
    world.setDynamicProperty(NAME_PROPERTY, name)
}

/**
 * Reads the preferred name from the world's persistent dynamic properties.
 * @returns {string | undefined} Stored name, or undefined if no string is stored.
 * @throws {Error} If the storage operation fails.
 */
export function readPlayerName() {
    const name = world.getDynamicProperty(NAME_PROPERTY)
    return typeof name === 'string' ? name : undefined
}

/**
 * Stores the selected course in the world's persistent dynamic properties.
 * Replaces any previously stored course.
 * @param {PlayerCourse} course Supported course identifier to persist.
 * @returns {void}
 * @throws {RangeError} If the course is not one of the five supported choices.
 * @throws {Error} If the storage operation fails.
 */
export function writePlayerCourse(course) {
    if (!isPlayerCourse(course)) {
        throw new RangeError('Ungültiger Studiengang.')
    }
    world.setDynamicProperty(COURSE_PROPERTY, course)
}

/**
 * Reads the selected course from the world's persistent dynamic properties.
 * @returns {PlayerCourse | undefined} Stored course, or undefined if missing or unsupported.
 * @throws {Error} If the storage operation fails.
 */
export function readPlayerCourse() {
    const course = world.getDynamicProperty(COURSE_PROPERTY)
    return isPlayerCourse(course) ? course : undefined
}

/**
 * Reads the world's last Lucas dialogue result.
 * @returns {import('./dialog.js').LucasDialogResult | undefined} Saved result, if present.
 * @throws {Error} If reading or parsing the saved result fails.
 */
export function readLucasDialogResult() {
    const value = world.getDynamicProperty(LUCAS_DIALOG_PROPERTY)
    if (typeof value !== 'string') return undefined
    return JSON.parse(value)
}

/**
 * Stores the last page and completion status in the world.
 * @param {import('./dialog.js').LucasDialogResult} result Result to persist.
 * @returns {void}
 * @throws {Error} If writing the saved result fails.
 */
export function writeLucasDialogResult(result) {
    world.setDynamicProperty(LUCAS_DIALOG_PROPERTY, JSON.stringify(result))
}

/**
 * Reads the world's last Frau Sommer dialogue result.
 * @returns {import('./dialog.js').MrsSommerDialogResult | undefined} Saved result, if present.
 * @throws {Error} If reading or parsing the saved result fails.
 */
export function readMrsSommerDialogResult() {
    const value = world.getDynamicProperty(MRS_SOMMER_DIALOG_PROPERTY)
    if (typeof value !== 'string') return undefined
    return JSON.parse(value)
}

/**
 * Stores Frau Sommer's last page and completion status in the world.
 * @param {import('./dialog.js').MrsSommerDialogResult} result Result to persist.
 * @returns {void}
 * @throws {Error} If writing the saved result fails.
 */
export function writeMrsSommerDialogResult(result) {
    world.setDynamicProperty(MRS_SOMMER_DIALOG_PROPERTY, JSON.stringify(result))
}

