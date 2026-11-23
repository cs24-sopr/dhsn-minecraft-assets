import { system, world } from '@minecraft/server'
import {
    CustomForm,
    ObservableBoolean,
    ObservableNumber,
    ObservableString,
} from '@minecraft/server-ui'

import * as Persist from './persist.js'
import * as Utils from './utils.js'

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
        text: `So! Und jetzt will ich dich auch gar nicht länger aufhalten. Es gibt schließlich noch einiges zu entdecken! Als Nächstes solltest du deinen Studentenausweis bei der Studienorganisation in ${highlight('Raum {{mrsSommerRoom}}')} abholen.`,
    },
    {
        text: 'Ach und bevor ich es vergesse: Hier, nimm diesen Gebäudeplan! Damit findest du dich auf dem Campus hoffentlich etwas leichter zurecht. Und vielleicht entdeckst du dabei ja auch schon den einen oder anderen Ort, den ich dir noch gar nicht gezeigt habe.',
    },
    {
        text: `Also dann, ${highlight('{{playerName}}')}: Ich wünsche dir einen fantastischen Studienstart und ganz viel Spaß an der DHSN. Und denk dran: Immer schön neugierig bleiben!`,
    },
]

/**
 * Text-only page for Frau Sommer's dialogue.
 * @typedef {object} MrsSommerDialogPage
 * @property {string} text Dialogue text displayed on this page.
 */

/** @type {MrsSommerDialogPage[]} Ordered pages used by Frau Sommer's dialogue. */
const mrsSommerDialogPages = [
    {
        text: 'Ah, du gehörst wohl zu den neuen Erstsemestern. Herzlich willkommen, ich bin Frau Sommer! Lucas hat dich bereits angekündigt. Dann nehmen wir dich mal offiziell bei uns auf. Keine Sorge, das dauert auch gar nicht lange. Zumindest, wenn die Technik heute mitspielt ',
    },
    {
        text: `Zunächst ist deine Einschreibung abzuschließen. Dazu gehört natürlich auch dein Studentenausweis. Schließlich sollst du auf dem Campus nicht ständig erklären müssen, dass du wirklich hier studierst. Einen kleinen Moment bitte ... Dein Ausweis ist gleich fertig!`,
    },
    {
        text: 'So, bitteschön! Jetzt hast du deinen ganz persönlichen Studentenausweis. Bewahre ihn gut auf. Es ist dein offizieller Nachweis, dass du auf unsere Universität gehst. Damit ist deine Anmeldung bei uns auch schon abgeschlossen. Herzlichen Glückwunsch.',
    },
    {
        text: 'Hab viel Spaß beim Erkunden des Campus und Erfüllen der Aufgaben. Bei weiteren Fragen rund um das Studium wende dich gerne jederzeit wieder an mich.',
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
            retryError =
                error instanceof Error ? error : new Error(String(error))
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
                throw new Error(
                    'Player left before the Lucas dialogue completed.'
                )
            }
            await system.waitTicks(1)
        }
    } finally {
        waiting = false
        world.beforeEvents.playerInteractWithEntity.unsubscribe(
            onLucasInteraction
        )
    }
}

/**
 * Saved page and completion status for Frau Sommer's dialogue.
 * @typedef {object} MrsSommerDialogResult
 * @property {boolean} confirmed Whether the final page was explicitly confirmed.
 * @property {number} page Zero-based page to resume after closing.
 */

/**
 * Waits for interaction with Frau Sommer until her dialogue is confirmed.
 * Each attempt resumes the saved page without an initial approach sequence.
 * Repeated interactions cannot open overlapping attempts. The listener is removed
 * when the dialogue completes or waiting fails.
 * @returns {Promise<MrsSommerDialogResult>} Confirmed result, immediately if already finished.
 * @throws {Error} If storage or an attempt fails, or no player remains while waiting.
 */
export async function completedMrsSommerDialog() {
    const savedResult = Persist.readMrsSommerDialogResult()
    if (savedResult?.confirmed) return savedResult

    /** @type {boolean} Whether this checkpoint is still waiting for completion. */
    let waiting = true
    /** @type {boolean} Whether an attempt is scheduled or showing its form. */
    let dialogActive = false
    /** @type {Error | undefined} Failure to propagate through the checkpoint's polling loop. */
    let dialogError

    /**
     * Opens one attempt at the saved page and persists its closing result.
     * @param {import('@minecraft/server').Player} player Player interacting with Frau Sommer.
     * @returns {Promise<void>} Resolves after this attempt has closed or failed.
     */
    async function runDialog(player) {
        try {
            if (!waiting) return
            const result = Persist.readMrsSommerDialogResult()
            if (result?.confirmed) return
            const closedResult = await showMrsSommerDialog(
                player,
                result?.page ?? 0
            )
            Persist.writeMrsSommerDialogResult(closedResult)
        } catch (error) {
            dialogError =
                error instanceof Error ? error : new Error(String(error))
        } finally {
            dialogActive = false
        }
    }

    /**
     * Cancels the default NPC interaction and schedules the dialogue outside restricted execution.
     * @param {import('@minecraft/server').PlayerInteractWithEntityBeforeEvent} event Interaction to inspect.
     * @returns {void}
     */
    function onMrsSommerInteraction(event) {
        if (event.target.typeId !== 'dhsn:studienorganisation') return
        event.cancel = true
        if (!waiting || dialogActive || dialogError) return

        dialogActive = true
        const player = event.player
        system.run(() => {
            void runDialog(player)
        })
    }

    world.beforeEvents.playerInteractWithEntity.subscribe(onMrsSommerInteraction)
    try {
        while (true) {
            if (dialogError) throw dialogError
            const result = Persist.readMrsSommerDialogResult()
            if (result?.confirmed) return result
            if (world.getAllPlayers().length === 0) {
                throw new Error(
                    'Player left before the Frau Sommer dialogue completed.'
                )
            }
            await system.waitTicks(1)
        }
    } finally {
        waiting = false
        world.beforeEvents.playerInteractWithEntity.unsubscribe(
            onMrsSommerInteraction
        )
    }
}

/**
 * Displays Frau Sommer's prepared text pages in one updating form without inputs.
 * Navigation saves the current page; closing does not confirm the dialogue.
 * @param {import('@minecraft/server').Player} player Player viewing the dialogue.
 * @param {number} [startPage=0] Zero-based page at which to open the dialogue.
 * @returns {Promise<MrsSommerDialogResult>} Completion status and last displayed page.
 * @throws {Error} If the player is invalid, storage fails, or form setup or display fails.
 */
export async function showMrsSommerDialog(player, startPage = 0) {
    if (!player.isValid) throw new Error('Player is no longer available.')
    if (
        !Number.isInteger(startPage) ||
        startPage < 0 ||
        startPage >= mrsSommerDialogPages.length
    ) {
        throw new RangeError('Frau Sommer dialogue start page is out of range.')
    }

    /** @type {number} Index of the currently displayed page. */
    let pageIndex = startPage
    /** @type {boolean} Remains false until the final page is confirmed. */
    let confirmed = false
    /** @type {ObservableString} Dialogue text selected by the current page. */
    const text = new ObservableString('')
    /** @type {ObservableString} Form title including the current page indicator. */
    const title = new ObservableString('Frau Sommer')
    /** @type {ObservableBoolean} Whether the previous button is disabled. */
    const previousDisabled = new ObservableBoolean(true)
    /** @type {ObservableString} Next button label, changing on the final page. */
    const nextLabel = new ObservableString('Weiter')
    /** @type {CustomForm} One form instance for all prepared pages. */
    const form = new CustomForm(player, title)

    /** @returns {void} Applies and persists the current page while the form is showing. */
    function updatePage() {
        text.setData(replaceMarkers(mrsSommerDialogPages[pageIndex].text))
        title.setData(
            `Frau Sommer [${pageIndex + 1} von ${mrsSommerDialogPages.length}]`
        )
        previousDisabled.setData(pageIndex === 0)
        nextLabel.setData(
            pageIndex === mrsSommerDialogPages.length - 1
                ? 'Abschließen'
                : 'Weiter'
        )
        if (form.isShowing()) {
            Persist.writeMrsSommerDialogResult({
                confirmed: false,
                page: pageIndex,
            })
        }
    }

    /** @returns {void} Displays the previous prepared page. */
    function previousPage() {
        if (!player.isValid || !form.isShowing() || pageIndex === 0) return
        pageIndex--
        updatePage()
    }

    /** @returns {void} Advances to the next page or confirms and closes the dialogue. */
    function nextPage() {
        if (!player.isValid || !form.isShowing()) return
        if (pageIndex < mrsSommerDialogPages.length - 1) {
            pageIndex++
            updatePage()
            return
        }

        confirmed = true
        form.close()
    }

    form.divider()
        .label(text)
        .divider()
        .button('Zurück', previousPage, { disabled: previousDisabled })
        .button(nextLabel, nextPage)

    updatePage()
    const closed = form.show()
    Persist.writeMrsSommerDialogResult({ confirmed: false, page: pageIndex })
    await closed
    return { confirmed, page: pageIndex }
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
 * Replaces all supported markers with their persistently stored values.
 * Missing values leave their markers unchanged; inserted text is not processed again.
 * @param {string} text Text containing {{playerName}} or {{playerCourse}} markers.
 * @returns {string} Text with available player values substituted literally.
 * @throws {Error} If reading persistent world storage fails.
 */
export function replaceMarkers(text) {
    const playerName = Persist.readPlayerName()
    const playerCourse = Persist.readPlayerCourse()
    const mrsSommerRoom = Utils.getMrsSommerRoom(playerCourse)

    /** @type {{ playerName: string | undefined, mrsSommerRoom: string | undefined }} */
    const values = { playerName, playerCourse, mrsSommerRoom }

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
        /\{\{(playerName|playerCourse|mrsSommerRoom)\}\}/g,
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
        if (form.isShowing()) {
            Persist.writeLucasDialogResult({
                confirmed: false,
                page: pageIndex,
            })
        }
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
        const closed = form.show()
        Persist.writeLucasDialogResult({ confirmed: false, page: pageIndex })
        await closed
        return { ...result, page: pageIndex }
    } finally {
        name.unsubscribe(nameChanged)
        course.unsubscribe(courseChanged)
    }
}
