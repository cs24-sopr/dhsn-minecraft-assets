# Questlog: Verwendung und Gestaltung

Das Questlog zeigt Text oben rechts im Spiel. [questlog.js](behavior-pack/questlog/scripts/questlog.js) verwaltet die Einträge und sendet ihren Text über die Actionbar. Das Resource Pack bestimmt die Darstellung.

## 1. Questlog verwenden

Eine ausführbare Beispielverwendung steht in [examples.js](behavior-pack/questlog/scripts/examples.js). Das Manifest startet diese Datei, die `questlog.js` importiert. Sie zeigt drei deutsche Einträge, einen laufenden Timer sowie Änderungen an Text, Reihenfolge und Sichtbarkeit durch Entfernen eines Eintrags. Die zeitgesteuerten Änderungen dienen nur als Demonstration.

Die folgenden Beispiele verwenden die exportierte Instanz `questlog`. In `questlog.js` können sie nach `export const questlog = new Questlog();` stehen. Aus einem anderen Modul im selben Ordner ist sie so importierbar:

```js
import { questlog } from './questlog.js'
```

### Eintrag erstellen

```js
const libraryEntry = questlog.createEntry({
    title: 'Aushilfe in der Bibliothek',
    lines: ['Bücher sortiert: 0/8', 'Zeit: 0:00'],
    order: 2,
})
```

| Eigenschaft | Bedeutung                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| `title`     | Überschrift als String.                                                                                 |
| `lines`     | Array mit den Textzeilen.                                                                               |
| `order`     | Optionale Reihenfolge: kleinere Zahlen stehen weiter oben; `null` oder fehlende Angaben stehen am Ende. |

Bei gleichem Sortierwert bleibt die Einfügereihenfolge erhalten. Die zurückgegebene Objektreferenz zum Ändern und Entfernen aufheben.

### Eintrag ändern oder entfernen

```js
libraryEntry.title = 'Bibliotheksaufgabe'
libraryEntry.lines = ['Bücher sortiert: 4/8', 'Zeit: 0:35']
libraryEntry.order = 1

// Eine weitere Zeile ergänzen:
libraryEntry.lines = [...libraryEntry.lines, 'Regale kontrollieren']

// Den Eintrag entfernen:
questlog.removeEntry(libraryEntry)
```

Zeilen immer als neues Array über `entry.lines = ...` zuweisen. Dadurch werden die Text-Caches aktualisiert; direkte Arrayänderungen wie `push()` lösen das nicht aus.

`questlog.toText()` liefert die sortierten Einträge als gemeinsamen String mit Leerzeilen dazwischen. Titel werden automatisch orange/goldfarben dargestellt, Textzeilen erhalten das Präfix `-`.

Die vorhandene Schleife sendet den Text alle **20 Spielticks**, ungefähr einmal pro Sekunde, an alle Spieler. Änderungen über die Setter erscheinen beim nächsten Durchlauf.

## 2. HUD gestalten

In [hud_screen.json](resource-pack/questlog/ui/hud_screen.json) zeichnet `hud_actionbar_text` den Hintergrund. Das untergeordnete Label `actionbar_message` zeigt den Text.

| Element / Feld                    | Aktueller Wert         | Wirkung                                                          |
| --------------------------------- | ---------------------- | ---------------------------------------------------------------- |
| Panel: `anchor_from`, `anchor_to` | `"top_right"`          | Verankerung oben rechts.                                         |
| Panel: `offset`                   | `[-12, 48]`            | 12 GUI-Einheiten nach links, 48 nach unten.                      |
| Panel: `size`                     | `[90, "100%c + 16px"]` | Breite 90; Höhe passend zum Text plus 16 Einheiten Innenabstand. |
| Label: `size`                     | `[74, "default"]`      | Textbreite 74; Höhe passend zum Inhalt.                          |
| Label: `font_scale_factor`        | `0.5`                  | Schriftgröße auf 50 % skalieren.                                 |
| Label: `text_alignment`           | `"left"`               | Linksbündiger Text.                                              |
| Label: `color`                    | `[1, 1, 1]`            | Weiße Grundfarbe; RGB-Werte zwischen 0 und 1.                    |
| Label: `shadow`                   | `true`                 | Textschatten einschalten.                                        |

Die Größen beziehen sich auf Minecrafts GUI-Skalierung. Durch die Verankerung rechts wächst eine größere Breite nach links.

### Breite und Innenabstand

Die Textbreite ist 16 Einheiten kleiner als die Panelbreite. Das ergibt 8 Einheiten Abstand je Seite. Für ein breiteres Panel beispielsweise beide Werte ändern:

```text
hud_actionbar_text.size: [120, "100%c + 16px"]
actionbar_message.size:  [104, "default"]
```

### Hintergrundtransparenz

In `questlog_background_lifetime` beide Werte gleich setzen:

```json
"from": 0.35,
"to": 0.35
```

`0` ist unsichtbar, `1` vollständig deckend. Kleinere Werte machen den Hintergrund transparenter. `propagate_alpha: false` hält die Textdeckkraft davon unabhängig.

Die Animationen halten Text- und Hintergrunddeckkraft konstant und räumen das Element nach drei Sekunden auf. Die regelmäßige Aktualisierung aus JavaScript hält die Anzeige sichtbar.

Weitere Felder: [Microsofts JSON-UI-Referenz](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/jsonuireference/examples/jsonuicomponents/ui_element?view=minecraft-bedrock-stable).

## 3. Text formatieren

Bedrock-Formatierungscodes stehen direkt im String und gelten für den nachfolgenden Text:

| Code | Wirkung                     |
| ---- | --------------------------- |
| `§6` | Orange/Goldton              |
| `§e` | Gelb                        |
| `§a` | Grün                        |
| `§c` | Rot                         |
| `§7` | Grau                        |
| `§f` | Weiß                        |
| `§l` | Fett                        |
| `§o` | Kursiv                      |
| `§r` | Farbe und Stil zurücksetzen |

```js
libraryEntry.lines = [
    '§7Bücher sortiert: §f4/8§r',
    '§a§lTeilaufgabe abgeschlossen§r',
]
```

`§r` beendet die Formatierung, damit sie nicht in nachfolgenden Text weiterläuft. Für Zeilenumbrüche dient `\n`; einzelne Aufzählungszeilen werden als separate Strings in `lines` übergeben. Statt `§` ist auch `\u00A7` möglich.

Vollständige Liste: [Offizielle Bedrock-Dokumentation zur Textformatierung](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/rawmessagejson?view=minecraft-bedrock-stable#text).

**Änderungen laden:** Nach JavaScript-Änderungen speichern und `/reload` ausführen. Nach HUD-JSON-Änderungen die Welt verlassen und erneut betreten; bei gecachten Ressourcen Minecraft neu starten.

### Beispiel zur Benutzung

```js
import { system } from '@minecraft/server'
import { questlog } from './questlog.js'

// Einträge erstellen und die zurückgegebenen Handles für Änderungen aufheben.
const libraryEntry = questlog.createEntry({
    title: 'Aushilfe in der Bibliothek',
    lines: ['Bücher sortiert: 4/8', 'Zeit: 0:00'],
    order: 2,
})

const tourEntry = questlog.createEntry({
    title: 'Campus-Rundgang',
    lines: ['Die Bibliothek finden', 'Die Mensa besuchen'],
    order: 1,
})

// Ohne order erscheint dieser Eintrag hinter den sortierten Einträgen.
const welcomeEntry = questlog.createEntry({
    title: 'Willkommen am Campus!',
    lines: ['Entdecke die Hochschule', 'Viel Spaß beim Erkunden!'],
})

// Verstrichene Echtzeit anzeigen; Zeilen über den Setter ersetzen.
const startedAt = Date.now()
system.runInterval(() => {
    const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000)
    const minutes = Math.floor(elapsedSeconds / 60)
    const seconds = String(elapsedSeconds % 60).padStart(2, '0')

    libraryEntry.lines = ['Bücher sortiert: 4/8', `Zeit: ${minutes}:${seconds}`]
}, 20)

// Nach etwa 10 Sekunden Titel, Text und Formatierung ändern.
system.runTimeout(() => {
    tourEntry.title = 'Nächster Halt: Mensa'
    tourEntry.lines = ['§aBibliothek gefunden§r', 'Den Speiseplan ansehen']
}, 20 * 10)

// Nach etwa 15 Sekunden die Bibliotheksaufgabe an die erste Stelle verschieben.
system.runTimeout(() => {
    libraryEntry.order = 0
}, 20 * 15)

// Nach etwa 20 Sekunden einen Eintrag anhand seines Handles entfernen.
system.runTimeout(() => {
    questlog.removeEntry(welcomeEntry)
}, 20 * 20)
```
