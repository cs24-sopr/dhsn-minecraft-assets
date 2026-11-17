# Testparcours für Quest-Ereignisse

Datei: [test.js](../../behavior_pack/scripts/events/test.js) · [Übersicht](../Events.md)

Es gibt noch keine Quests, die die Ereignisse benutzen. Damit Reviewer trotzdem alles im Spiel prüfen können, baut `events/test.js` per Befehl einen Testparcours auf. Er wird in `main.js` geladen, tut aber nichts, bis der Befehl ausgeführt wird.

## Starten

1. Eine Welt mit **aktivierten Cheats** und beiden Packs (Behavior und Resource) öffnen.
2. Auf eine ebene, freie Fläche stellen. Der Parcours ersetzt Blöcke im Umkreis von etwa 10 Blöcken.
3. Ausführen:

   ```text
   /scriptevent dhsn:event_test
   ```

4. Für den Regal-Test in den Überlebensmodus wechseln:

   ```text
   /gamemode survival
   ```

## Was aufgebaut wird

Ausgehend von der Position des Spielers:

| Station        | Ort                                  | Aufbau                                                     |
| -------------- | ------------------------------------ | ---------------------------------------------------------- |
| Item aufheben  | 3 Blöcke östlich (+X)                 | Ein Zeugnis (`dhsn:certificate`) liegt auf dem Boden.   |
| Item in Hopper | 4 Blöcke südlich (+Z)                 | Ein Trichter.                                              |
| Item ins Regal | frei wählbar                         | Regale bekommt der Spieler ins Inventar.                   |
| Block setzen   | 4 Blöcke nördlich (−Z)                | Gelbes Betonfeld im Boden.                                 |
| Raum betreten  | ab 6 Blöcken östlich (+X), 5×5 groß    | Grüne Betonfläche im Boden; der Bereich reicht 3 Blöcke hoch. |

Im Inventar landen: 3× Papier, 2× Goldblock, 1× Informatik-Buch (`myname:cs_book`), 6× Buch, 1× Eichenregal und 1× Chiseled Bookshelf.

## Rückmeldung

- Jedes Ereignis schreibt `Ereignis ist eingetreten: …` mit Details in den Chat.
- Rechts oben erscheint im Questlog der Eintrag **„Ereignis-Test“**. Er hakt jedes ausgelöste Ereignis grün ab (`[x]`).
- Erneutes `/scriptevent dhsn:event_test` meldet die alten Ereignisse ab, baut den Parcours an der aktuellen Position neu auf und setzt die Haken zurück.

## Testschritte

Die genauen Schritte und Gegenproben stehen bei den Ereignissen:

1. [Item aufheben](item-pickup.md#test)
2. [Item in Hopper](item-in-hopper.md#test)
3. [Item ins Regal](item-in-shelf.md#test)
4. [Block setzen](block-placed.md#test)
5. [Raum betreten](enter-territory.md#test)

Sind alle sechs Zeilen im Questlog abgehakt, funktionieren alle Ereignisse.

## Abhängigkeit

`test.js` nutzt das Questlog aus `behavior_pack/scripts/questlog.js`. Ohne diese Datei startet das Skript nicht.
