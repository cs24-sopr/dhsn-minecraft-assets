import {
    CustomForm,
    ObservableBoolean,
    ObservableNumber,
    ObservableString,
} from '@minecraft/server-ui'
// import { readPlayerCourse, readPlayerName, writePlayerName } from './persist.js'

import * as Persist from './persist.js'

/**
 * German dropdown label and its persistent course identifier.
 * @typedef {object} CourseOption
 * @property {import('./persist.js').PlayerCourse} course Stored identifier.
 * @property {string} label German label displayed in the dropdown.
 */

/** @type {CourseOption[]} Course choices in the supplied display order. */
const COURSE_OPTIONS = [
    { course: 'controlling-and-finance', label: 'Controlling und Finance' },
    { course: 'real-estate-finance', label: 'Immobilienwirtschaft' },
    { course: 'computer-science', label: 'Informatik' },
    {
        course: 'sustainable-engineering',
        label: 'Nachhaltige Ingenieurwissenschaft für Immobilien und Anlagen',
    },
    {
        course: 'tax-consulting-and-auditing',
        label: 'Steuerberatung und Wirtschaftsprüfung',
    },
]

/**
 * Builds the numeric dropdown entry for a course choice.
 * @param {CourseOption} option Course choice to display.
 * @param {number} index Course index; dropdown value zero is reserved for the placeholder.
 * @returns {import('@minecraft/server-ui').DropdownItemData} Dropdown entry.
 */
function toDropdownItem(option, index) {
    return { label: option.label, value: index + 1 }
}

/**
 * Controls that a dialogue page can display in addition to its text.
 * @typedef {'name' | 'course'} LucasDialogControl
 */

/**
 * Content and optional controls for one dialogue page.
 * @typedef {object} LucasDialogPage
 * @property {string} text Dialogue text displayed on this page.
 * @property {LucasDialogControl[]} [show] Controls visible on this page.
 */

/** @type {LucasDialogPage[]} Ordered pages used by the dialogue. */
const lucasDialogPages = [
    {
        text: 'Halt, halt! Nicht so schnell, Erstsemester! Herzlich Willkommen an unserer Dualen Hochschule Sachsen in Leipzig! Schön, dass du es bis hierher geschafft hast. Das ist schon mal eine Leistung, die man nicht unterschätzen sollte.',
    },
    {
        text: 'Ich bin Lucas (mit c), dein Ersti-Coach und sozusagen dein ganz persönlicher Wegweiser durch den Hochschulalltag. Und glaub mir, ich habe einiges zu zeigen! Bevor du dich allerdings direkt ins Getümmel stürzt, sollten wir ein paar Dinge klären.',
    },
    {
        text: 'Dafür zunächst ein paar organisatorische Hinweise:\nAuf deinem Weg über den Campus wirst du in verschiedenen Etagen, in Räumen und Gebieten die eine oder andere Aufgabe entdecken, die dir unseren Hochschulalltag näherbringen soll',
    },
    {
        text: 'Halte also stets Augen und Ohren offen und sei hilfsbereit! Es gibt jede Menge zu entdecken, zu lernen und natürlich auch zu erleben.',
    },
    {
        text: 'Und wer weiß, vielleicht wartet hinter der nächsten Ecke schon deine nächste Quest! Ansonsten kannst du dich natürlich auch völlig frei auf unserem Campus bewegen. Schließlich gehört zum Studium nicht nur das Lernen, sondern auch das Entdecken!',
    },
    {
        text: 'Aber Moment mal! Jetzt habe ich dich schon die ganze Zeit vollgequatscht und noch nicht einmal, wie du heißt!\nAlso, wie darf ich dich nennen?',
        show: ['name'],
    },
    {
        text: 'Wie schön dich kennenzulernen {{playerName}}. Und sag mal, für welchen Studiengang hast du dich eigentlich entschieden?',
        show: ['course'],
    },
    {
        text: 'Ach wie genial! Dann sind wir ja tatsächlich im selben Studiengang! Ich bin sogar bereits im 5. Semester.  Du kannst dir also vorstellen, dass ich hier mittlerweile den ein oder anderen Winkel kenne. Wenn du also mal Fragen hast oder irgendwo nicht weiterkommst, kannst du jederzeit zu mir kommen. Ich helfe dir gerne weiter.',
    },
]

/**
 * Result of the configured dialogue, without completing the quest.
 * @typedef {{ confirmed: true, name?: string } | { confirmed: false }} LucasDialogResult
 */

/**
 * Checks whether a page requests the name input.
 * @param {LucasDialogPage} page Page configuration to inspect.
 * @returns {boolean} Whether the name input should be visible.
 */
function showsNameInput(page) {
    return page.show?.includes('name') ?? false
}

/**
 * Checks whether a page requests the course dropdown.
 * @param {LucasDialogPage} page Page configuration to inspect.
 * @returns {boolean} Whether the course dropdown should be visible.
 */
function showsCourseInput(page) {
    return page.show?.includes('course') ?? false
}

/**
 * Replaces all supported markers with their persistently stored values.
 * Missing values leave their markers unchanged; inserted text is not processed again.
 * @param {import('@minecraft/server').Player} player Player whose values to read.
 * @param {string} text Text containing {{playerName}} or {{playerCourse}} markers.
 * @returns {string} Text with available player values substituted literally.
 * @throws {Error} If reading persistent player storage fails.
 */
export function replaceMarkers(player, text) {
    /** @type {{ playerName: string | undefined, playerCourse: string | undefined }} */
    const values = {
        playerName: Persist.readPlayerName(player),
        playerCourse: Persist.readPlayerCourse(player),
    }

    /**
     * Supplies a literal replacement for one matched marker.
     * @param {string} marker Complete matched marker.
     * @param {'playerName' | 'playerCourse'} key Stored value to substitute.
     * @returns {string} Stored value or the original unresolved marker.
     */
    function replaceMarker(marker, key) {
        return values[key] ?? marker
    }

    return text.replace(/\{\{(playerName|playerCourse)\}\}/g, replaceMarker)
}

/**
 * Displays lucasDialogPages in one updating form for the single-player quest.
 * Each page selects its text and visible controls through its configuration.
 * Navigation preserves input; leaving an input page saves its confirmed value.
 * Closing the form does not confirm the dialogue or advance the quest.
 * @param {import('@minecraft/server').Player} player Player viewing the dialogue.
 * @returns {Promise<LucasDialogResult>} Confirmed dialogue or an unfinished result.
 * @throws {Error} If form setup or display fails; the caller handles cleanup.
 */
export async function showLucasDialog(player) {
    if (lucasDialogPages.length === 0) return { confirmed: false }

    /** @type {number} Index of the currently displayed page. */
    let pageIndex = 0

    /** @type {LucasDialogResult} Remains unfinished until the last page is confirmed. */
    let result = { confirmed: false }

    /** @type {boolean} Whether any configured page collects a name. */
    const requiresName = lucasDialogPages.some(showsNameInput)

    /** @type {string | undefined} Previously confirmed name, if any. */
    const savedName = Persist.readPlayerName(player)

    /** @type {import('./persist.js').PlayerCourse | undefined} Previously selected course. */
    const savedCourse = Persist.readPlayerCourse(player)

    /**
     * Finds the dropdown choice matching the stored course.
     * @param {CourseOption} option Course choice to compare.
     * @returns {boolean} Whether this is the previously saved course.
     */
    function matchesSavedCourse(option) {
        return option.course === savedCourse
    }

    /** @type {ObservableNumber} Selected dropdown value; zero means no course selected. */
    const course = new ObservableNumber(
        COURSE_OPTIONS.findIndex(matchesSavedCourse) + 1,
        { clientWritable: true }
    )

    /** @type {ObservableString} Dialogue text selected by the current page. */
    const text = new ObservableString('')

    /** @type {ObservableString} Form title including the current page indicator. */
    const title = new ObservableString('Lucas (mit c)')

    /** @type {ObservableString} Input retained while navigating between pages. */
    const name = new ObservableString(savedName ?? '', { clientWritable: true })

    /** @type {ObservableBoolean} Whether the previous button is disabled. */
    const previousDisabled = new ObservableBoolean(true)

    /** @type {ObservableBoolean} Whether the current page has invalid required input. */
    const nextDisabled = new ObservableBoolean(false)

    /** @type {ObservableString} Next button label, changing on the final page. */
    const nextLabel = new ObservableString('Weiter')

    /** @type {ObservableBoolean} Name input visibility from the page's show list. */
    const nameVisible = new ObservableBoolean(false)

    /** @type {ObservableBoolean} Course dropdown visibility from the page's show list. */
    const courseVisible = new ObservableBoolean(false)

    /** @type {ObservableString} Full German name of the current dropdown selection. */
    const courseLabel = new ObservableString('')

    /** @type {ObservableBoolean} Lower divider visibility when the name input is hidden. */
    const dividerVisible = new ObservableBoolean(true)

    /** @type {CustomForm} One form instance for the configured pages. */
    const form = new CustomForm(player, title)

    /**
     * Reads the choice corresponding to the dropdown's numeric value.
     * @returns {CourseOption | undefined} Selected course, or undefined for the placeholder or an invalid value.
     */
    function selectedCourse() {
        const index = course.getData() - 1
        return Number.isInteger(index) ? COURSE_OPTIONS[index] : undefined
    }

    /**
     * Updates the forward button when the page, name, or course changes.
     * @returns {void}
     */
    function updateNextDisabled() {
        const page = lucasDialogPages[pageIndex]
        nextDisabled.setData(
            (showsNameInput(page) && name.getData().trim().length === 0) ||
                (showsCourseInput(page) && selectedCourse() === undefined)
        )
    }

    /**
     * Updates the selected-course label and validation without saving the draft.
     * @returns {void}
     */
    function updateCourseSelection() {
        courseLabel.setData(
            `Ausgewählt:\n${selectedCourse()?.label ?? 'Keine Auswahl'}`
        )
        updateNextDisabled()
    }

    /**
     * Applies the current page's text and controls to the existing form.
     * @returns {void}
     */
    function updatePage() {
        const page = lucasDialogPages[pageIndex]
        text.setData(replaceMarkers(player, page.text))
        title.setData(
            `Lucas (mit c) [${pageIndex + 1} von ${lucasDialogPages.length}]`
        )
        nameVisible.setData(showsNameInput(page))
        courseVisible.setData(showsCourseInput(page))
        dividerVisible.setData(!nameVisible.getData())
        previousDisabled.setData(pageIndex === 0)
        nextLabel.setData(
            pageIndex === lucasDialogPages.length - 1 ? 'Abschließen' : 'Weiter'
        )
        updateCourseSelection()
    }

    /** @returns {void} Displays the previous configured page. */
    function previousPage() {
        if (!form.isShowing() || pageIndex === 0) return
        pageIndex--
        updatePage()
    }

    /**
     * Validates visible input, then advances or confirms the final page.
     * @returns {void}
     */
    function nextPage() {
        if (!player.isValid || !form.isShowing()) return
        const page = lucasDialogPages[pageIndex]
        const preferredName = name.getData().trim()
        const courseOption = selectedCourse()
        if (showsNameInput(page) && preferredName.length === 0) {
            return
        }
        if (showsCourseInput(page) && courseOption === undefined) return

        if (
            showsNameInput(page) ||
            (requiresName && pageIndex === lucasDialogPages.length - 1)
        ) {
            try {
                Persist.writePlayerName(player, preferredName)
            } catch (error) {
                console.error(`[Operation Erstsemester]: ${String(error)}`)
                return
            }
        }

        if (showsCourseInput(page) && courseOption) {
            try {
                Persist.writePlayerCourse(player, courseOption.course)
            } catch (error) {
                console.error(`[Operation Erstsemester]: ${String(error)}`)
                return
            }
        }

        if (pageIndex < lucasDialogPages.length - 1) {
            pageIndex++
            updatePage()
            return
        }

        result = requiresName
            ? { confirmed: true, name: preferredName }
            : { confirmed: true }
        form.close()
    }

    form.divider()
        .label(text)
        .spacer({ visible: nameVisible })
        .textField('Dein Name', name, { visible: nameVisible })
        .spacer({ visible: courseVisible })
        .dropdown(
            'Dein Studiengang',
            course,
            [
                { label: 'Keine Auswahl', value: 0 },
                ...COURSE_OPTIONS.map(toDropdownItem),
            ],
            { visible: courseVisible }
        )
        .label(courseLabel, { visible: courseVisible })
        .divider()
        .button('Zurück', previousPage, { disabled: previousDisabled })
        .button(nextLabel, nextPage, { disabled: nextDisabled })

    /** @type {(value: string) => void} Listener updating the button as the name is edited. */
    const nameChanged = name.subscribe(updateNextDisabled)
    /** @type {(value: number) => void} Listener updating the label and button as the course changes. */
    const courseChanged = course.subscribe(updateCourseSelection)
    try {
        updatePage()
        await form.show()
        return result
    } finally {
        name.unsubscribe(nameChanged)
        course.unsubscribe(courseChanged)
    }
}
