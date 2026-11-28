# Setup-Menü für „Das Erwachen“

Datei: [awakening-setup.js](../../behavior_pack/scripts/quests/awakening-setup.js) · [Quest-Doku](awakening-quest.md) (Englisch)

Mit dem Menü trägt man die Orte der echten Map **im Spiel** ein, statt Koordinaten im Code zu pflegen. Es ist ein Bauwerkzeug und kein Teil der Quest: Die Datei samt Import in `main.js` kann gelöscht werden, sobald die Werte feststehen und in `LAYOUT` stehen.

## Öffnen

```text
/scriptevent dhsn:awakening_setup
```

Das gibt einen Kompass „Quest-Setup“ und öffnet das Menü, sobald der Chat zu ist. Der Kompass gilt für alle Quests mit Setup-Menü: Ein Rechtsklick öffnet das zuletzt geöffnete Menü, Schleichen + Rechtsklick zeigt eine Auswahl („Das Erwachen“, „Bibliothek“, …). Die allgemeinen Teile (Kompass, Formulare, Positionen, Bereiche) liegen in [util/setup-menu.js](../../behavior_pack/scripts/util/setup-menu.js), siehe [setup-menu.md](../setup-menu.md). Jeder Klick speichert sofort und zeigt das Menü wieder. Zum Laufen einfach schließen und mit dem Kompass neu öffnen.

## Ablauf

Hinstellen, Menü öffnen, passenden Knopf klicken. ✔ / ✘ zeigt, was schon gesetzt ist.

| Knopf | Was gespeichert wird |
| --- | --- |
| Aufwachpunkt | Position und Blickrichtung (da, wo man im Bett aufwacht) |
| Wecker | der Notenblock, den man ansieht |
| Fenster Ecke 1 / 2 | der Block, in dem man steht; Höhe: 2 Blöcke über den Füßen |
| Truhe | die Truhe, die man ansieht |
| Gebäude Ecke 1 / 2 | Ecke 1 am Boden, Ecke 2 gegenüber und auf dem Dach; unten 1 Block, oben 2 Blöcke zusätzlich |
| Rückkehrpunkt | Position im Gebäude, an die zu früh Gehende zurückgesetzt werden |
| Teleporter Ecke 1 / 2 | der Block, in dem man steht; Höhe: 2 Blöcke über den Füßen |
| Insel-Tor | Position und Blick nach dem Teleport |
| Professor | der NPC, den man ansieht, bekommt den Tag `dhsn:awakening_professor` (ein früherer Professor verliert ihn); der Tag liegt am NPC, nicht im Layout |
| Kamerafahrt … | Aufnahmen hinzufügen (Position und Blick), letzte entfernen, löschen, Vorschau |

Beim Ansehen (Wecker, Truhe) merkt sich das Menü die Blickrichtung beim Öffnen. Falsche Blöcke werden abgelehnt.

Die erste Kamera-Aufnahme ist der Start, jede weitere ein Flug dorthin; die Flugzeit wird beim Hinzufügen gefragt (Standard 3 s).

Sind alle Orte gesetzt, ist das Layout **sofort aktiv** (die Aufwach-Kamerafahrt ist optional). „Quest neu starten“ setzt den eigenen Stand zurück und startet am Aufwachpunkt. Ein Testaufbau (`dhsn:quest_test_awakening`) ersetzt das Layout, das Menü speichert danach wieder neu; es gilt immer das zuletzt gespeicherte.

## Zahlen übernehmen

Der Befehl `/scriptevent dhsn:quest_awakening_state` nennt die Quelle des aktiven Layouts. Die gespeicherten Werte liegen in der Welt (`dhsn:awakening_setup`); für `LAYOUT` im Code müssen sie abgeschrieben werden, siehe [Karten-Anleitung](awakening-quest-map-guide.md).
