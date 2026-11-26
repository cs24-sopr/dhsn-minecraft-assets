# Setup-Menüs für Quests (Kompass „Quest-Setup“)

Datei: [util/setup-menu.js](../behavior_pack/scripts/util/setup-menu.js)

Mit einem Setup-Menü trägt das Map-Team die Orte einer Quest **im Spiel** ein, statt Koordinaten im Code zu pflegen: hinstellen oder einen Block ansehen, Menü öffnen, Knopf klicken. Die Orte werden in der Welt gespeichert (siehe [Speicherung](Speicherung.md)); nur welches Menü der Kompass zuletzt geöffnet hat, merkt sich jeder Spieler selbst.

Vorhandene Menüs:

| Quest | Befehl | Datei | Anleitung |
| --- | --- | --- | --- |
| Das Erwachen | `/scriptevent dhsn:awakening_setup` | `quests/awakening-setup.js` | [awakening-quest-map-guide.md](quests/awakening-quest-map-guide.md) |
| Bibliothek | `/scriptevent dhsn:library_setup` | `quests/library-setup.js` | [library-quest-map-guide.md](quests/library-quest-map-guide.md) |

## Ein Kompass für alle Quests

- Jeder Befehl gibt den Kompass **„Quest-Setup“** (nur einmal) und öffnet **sein** Menü direkt.
- **Rechtsklick mit dem Kompass** öffnet das Menü, das **dieser Spieler** zuletzt geöffnet hat (egal ob per Befehl oder Kompass).
- **Schleichen + Rechtsklick** zeigt eine Auswahl aller angemeldeten Menüs („Welche Quest willst du einrichten?“, das letzte ist mit „(zuletzt)“ markiert). Die Auswahl kommt auch, solange noch kein Menü geöffnet wurde. Ist nur ein Menü angemeldet, öffnet es immer direkt.
- Jedes Menü zeigt unten den Hinweis zum Wechseln, sobald mehr als ein Menü angemeldet ist.
- **Mehrere Spieler gleichzeitig:** Jeder Spieler hat sein eigenes zuletzt geöffnetes Menü. Es wird **am Spieler** gespeichert (`dhsn:setup_menu_last` als Dynamic Property des Spielers). So kann z. B. einer die Bibliothek und ein anderer „Das Erwachen“ einrichten, ohne dass der Kompass des anderen umspringt.
- **Die Orte der Quests** speichert weiterhin die Quest **in der Welt** (z. B. `dhsn:library_map_layout`, `dhsn:awakening_setup`). Alle Spieler sehen und ändern also dieselben Werte; es gilt der zuletzt gespeicherte Wert.
- `/scriptevent dhsn:map_cleanup` und `/scriptevent dhsn:progress` betreffen nur Werte der Welt. Das gemerkte Menü am Spieler bleibt, es ist harmlos (nur die Wahl des Kompasses).
- Früher hatte „Das Erwachen“ einen eigenen Kompass mit demselben Namen. Ein zweiter Kompass hätte immer das Erwachen-Menü geöffnet; deshalb gibt es jetzt den gemeinsamen.

## Ein neues Menü anlegen (für Entwickler)

```js
import { boxOf, feetBlock, format, giveSetupCompass, lookedBlock, mark, registerSetupMenu, runMenu } from "../util/setup-menu.js";

function openMenu(player, note) {
    return runMenu(player, {
        id: "meine_quest",
        title: "Quest-Setup: Meine Quest",
        note,
        render: () => ({
            lines: ["§7Es fehlt noch: …§r"],
            entries: [
                { text: `${mark(gesetzt)}Startpunkt`, run: () => { /* speichern */ return "Startpunkt gesetzt."; } },
                { text: "Schließen", run: () => "close" },
            ],
        }),
    });
}

registerSetupMenu({ id: "meine_quest", title: "Meine Quest", open: (player) => openMenu(player) });
// eigener Befehl: giveSetupCompass(player); openMenu(player);
```

| Teil | Zweck |
| --- | --- |
| `runMenu(player, { id, title, render, note })` | Menü-Schleife: Knopf → Aktion → Ergebnis oben anzeigen → Menü wieder zeigen, bis eine Aktion `"close"` zurückgibt. `render` läuft vor jedem Anzeigen, ✔ / ✘ sind also immer aktuell. Wirft eine Aktion einen Fehler, bleibt das Menü offen: Die Fehlermeldung steht gelb im Chat (und im Content-Log), oben im Menü ein kurzer Hinweis. Dasselbe Menü öffnet sich pro Spieler nur einmal. Merkt sich `id` am Spieler als zuletzt geöffnetes Menü; `id` muss deshalb dieselbe sein wie bei `registerSetupMenu`. |
| `registerSetupMenu({ id, title, open })` | Menü für die Kompass-Auswahl anmelden. |
| `giveSetupCompass(player)` | Kompass geben (nicht doppelt). |
| `showForm(player, form)` | Formular anzeigen; ist der Chat noch offen, wird es einige Sekunden lang neu versucht. |
| `confirm(player, title, body, yes, no)` | Rückfrage, `true` beim ersten Knopf. |
| `feetBlock(player)` | Block, in dem die Füße stehen. |
| `lookedBlock(player, accepts, what)` | Block, den der Spieler ansieht (max. 10 Blöcke), nur wenn `accepts(typeId)`; sonst ein Fehlertext. |
| `lookPoint(player)` | Punkt 10 Blöcke in Blickrichtung (für „wohin schauen“). |
| `boxOf(corners, { below, above })` | Bereich aus zwei Eckblöcken plus Höhe. |
| `vec`, `format`, `mark`, `LOOK_RANGE` | Runden, „x y z“ als Text, ✔ / ✘, Reichweite fürs Ansehen. |

Die Speicherung bleibt Sache der Quest: Das Menü ruft nur Funktionen der Quest auf (bei der Bibliothek `setLibraryMapValues`, beim Erwachen `setAwakeningSetupLayout`).
