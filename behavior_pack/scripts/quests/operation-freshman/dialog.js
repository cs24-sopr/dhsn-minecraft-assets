import { system, world } from '@minecraft/server'
import {
    CustomForm,
    ObservableBoolean,
    ObservableNumber,
    ObservableString,
} from '@minecraft/server-ui'

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
 *
 * @param {string} text Text to highlight
 * @returns {string}
 */
function highlight(text) {
    return `§6${text}§r`
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
        text: `Ich bin ${highlight('Lucas (mit c)')}, dein Ersti-Coach und sozusagen dein ganz persönlicher Wegweiser durch den Hochschulalltag. Und glaub mir, ich habe einiges zu zeigen! Bevor du dich allerdings direkt ins Getümmel stürzt, sollten wir ein paar Dinge klären.`,
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
        text: `Wie schön dich kennenzulernen ${highlight('{{playerName}}')}. Und sag mal, für welchen Studiengang hast du dich eigentlich entschieden?`,
        show: ['course'],
    },
    {
        text: 'Ach wie genial! Dann sind wir ja tatsächlich im selben Studiengang! Ich bin sogar bereits im 5. Semester.  Du kannst dir also vorstellen, dass ich hier mittlerweile den ein oder anderen Winkel kenne. Wenn du also mal Fragen hast oder irgendwo nicht weiterkommst, kannst du jederzeit zu mir kommen. Ich helfe dir gerne weiter.',
    },
    {
        text: `So! Und jetzt will ich dich auch gar nicht länger aufhalten. Es gibt schließlich noch einiges zu entdecken! Als Nächstes solltest du deinen Studentenausweis bei der Studienorganisation in ${highlight('Raum {{playerRoom}}')} abholen.`,
    },
    {
        text: 'Ach und bevor ich es vergesse: Hier, nimm diesen Gebäudeplan! Damit findest du dich auf dem Campus hoffentlich etwas leichter zurecht. Und vielleicht entdeckst du dabei ja auch schon den einen oder anderen Ort, den ich dir noch gar nicht gezeigt habe.',
    },
    {
        text: `Also dann, ${highlight('{{playerName}}')}: Ich wünsche dir einen fantastischen Studienstart und ganz viel Spaß an der DHSN. Und denk dran: Immer schön neugierig bleiben!`,
    },
]

/**
 * Result of the configured dialogue, without completing the quest.
 * @typedef {{ confirmed: true, page: number, name?: string } | { confirmed: false, page: number }} LucasDialogResult
 */

/**
 * Shows one attempt at the world's saved page and persists its result on closing.
 * An already confirmed dialogue returns without opening another form.
 * Only confirmed input is restored from persistent storage on a new attempt.
 * @param {import('@minecraft/server').Player} player Player viewing the dialogue.
 * @returns {Promise<LucasDialogResult>} Result when this attempt finishes or closes.
 * @throws {Error} If the player is invalid, storage fails, or the dialogue fails.
 */
export async function initialLucasDialog(player) {
    if (!player.isValid) throw new Error('Player is no longer available.')

    const savedResult = Persist.readLucasDialogResult()
    if (savedResult?.confirmed) return savedResult

    const result = await showLucasDialog(player, savedResult?.page ?? 0)
    Persist.writeLucasDialogResult(result)
    return result
}

/**
 * Checks the world's saved dialogue result once per tick until it is confirmed.
 * While waiting, interaction with Lucas resumes the saved page with confirmed input.
 * Repeated interactions cannot open overlapping attempts. The listener is removed
 * when the dialogue completes or waiting fails.
 * @returns {Promise<LucasDialogResult>} Confirmed result, immediately if already finished.
 * @throws {Error} If storage or a retry fails, or no player remains while waiting.
 */
export async function completedLucasDialog() {
    const savedResult = Persist.readLucasDialogResult()
    if (savedResult?.confirmed) return savedResult

    /** @type {boolean} Whether this checkpoint is still waiting for completion. */
    let waiting = true
    /** @type {boolean} Whether a retry is scheduled or showing its form. */
    let retryActive = false
    /** @type {Error | undefined} Failure to propagate through the awaited checkpoint. */
    let retryError

    /**
     * Runs one retry and forwards failures to the checkpoint's polling loop.
     * @param {import('@minecraft/server').Player} player Player interacting with Lucas.
     * @returns {Promise<void>} Resolves after this attempt has closed or failed.
     */
    async function retryDialog(player) {
        try {
            if (waiting) await initialLucasDialog(player)
        } catch (error) {
            retryError = error instanceof Error ? error : new Error(String(error))
        } finally {
            retryActive = false
        }
    }

    /**
     * Cancels Lucas's default interaction and schedules a retry outside restricted execution.
     * @param {import('@minecraft/server').PlayerInteractWithEntityBeforeEvent} event Interaction to inspect.
     * @returns {void}
     */
    function onLucasInteraction(event) {
        if (event.target.typeId !== 'dhsn:ersti_coach') return
        event.cancel = true
        if (!waiting || retryActive || retryError) return

        retryActive = true
        const player = event.player
        system.run(() => {
            void retryDialog(player)
        })
    }

    world.beforeEvents.playerInteractWithEntity.subscribe(onLucasInteraction)
    try {
        while (true) {
            if (retryError) throw retryError
            const result = Persist.readLucasDialogResult()
            if (result?.confirmed) return result
            if (world.getAllPlayers().length === 0) {
                throw new Error('Player left before the Lucas dialogue completed.')
            }
            await system.waitTicks(1)
        }
    } finally {
        waiting = false
        world.beforeEvents.playerInteractWithEntity.unsubscribe(onLucasInteraction)
    }
}

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
 * Checks whether a page requests the course dropdown.
 * @param {import('./persist.js').PlayerCourse} playerCourse Player course
 * @returns {'113' | '114'}
 */
function getPlayerRoom(playerCourse) {
    if (
        playerCourse === 'computer-science' ||
        playerCourse === 'sustainable-engineering'
    ) {
        return '113'
    }

    return '114'
}

/**
 * Replaces all supported markers with their persistently stored values.
 * Missing values leave their markers unchanged; inserted text is not processed again.
 * @param {string} text Text containing {{playerName}} or {{playerCourse}} markers.
 * @returns {string} Text with available player values substituted literally.
 * @throws {Error} If reading persistent world storage fails.
 */
export function replaceMarkers(text) {
    const playerName = Persist.readPlayerName()
    const playerCourse = Persist.readPlayerCourse()
    const playerRoom = getPlayerRoom(playerCourse)

    /** @type {{ playerName: string | undefined, playerCourse: string | undefined }} */
    const values = { playerName, playerCourse, playerRoom }

    /**
     * Supplies a literal replacement for one matched marker.
     * @param {string} marker Complete matched marker.
     * @param {'playerName' | 'playerCourse'} key Stored value to substitute.
     * @returns {string} Stored value or the original unresolved marker.
     */
    function replaceMarker(marker, key) {
        return values[key] ?? marker
    }

    return text.replace(
        /\{\{(playerName|playerCourse|playerRoom)\}\}/g,
        replaceMarker
    )
}

/**
 * Displays lucasDialogPages in one updating form for the single-player quest.
 * Each page selects its text and visible controls through its configuration.
 * Navigation preserves input; leaving an input page saves its confirmed value.
 * Closing the form does not confirm the dialogue or advance the quest.
 * @param {import('@minecraft/server').Player} player Player viewing the dialogue.
 * @param {number} [startPage=0] Zero-based page at which to open the dialogue.
 * @returns {Promise<LucasDialogResult>} Confirmed dialogue or an unfinished result.
 * @throws {Error} If form setup or display fails; the caller handles cleanup.
 */
export async function showLucasDialog(player, startPage = 0) {
    if (
        !Number.isInteger(startPage) ||
        startPage < 0 ||
        startPage >= lucasDialogPages.length
    ) {
        throw new RangeError('Lucas dialogue start page is out of range.')
    }

    /** @type {number} Index of the currently displayed page. */
    let pageIndex = startPage

    /** @type {LucasDialogResult} Remains unfinished until the last page is confirmed. */
    let result = { confirmed: false, page: startPage }

    /** @type {boolean} Whether any configured page collects a name. */
    const requiresName = lucasDialogPages.some(showsNameInput)

    /** @type {string | undefined} Previously confirmed name, if any. */
    const savedName = Persist.readPlayerName()

    /** @type {import('./persist.js').PlayerCourse | undefined} Previously selected course. */
    const savedCourse = Persist.readPlayerCourse()

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

        text.setData(replaceMarkers(page.text))
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
                Persist.writePlayerName(preferredName)
            } catch (error) {
                console.error(`[Operation Erstsemester]: ${String(error)}`)
                return
            }
        }

        if (showsCourseInput(page) && courseOption) {
            try {
                Persist.writePlayerCourse(courseOption.course)
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
            ? { confirmed: true, page: pageIndex, name: preferredName }
            : { confirmed: true, page: pageIndex }
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
        return { ...result, page: pageIndex }
    } finally {
        name.unsubscribe(nameChanged)
        course.unsubscribe(courseChanged)
    }
}
