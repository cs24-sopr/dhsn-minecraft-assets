# Bibliotheks-Test – Bücher sortieren

Datei: [test-library.js](../../behavior_pack/scripts/events/test-library.js) · [Übersicht](../Events.md)

Eine Test-Quest für unsere eigenen Bücherregale: Jedes Buch muss ins Regal seines Studiengangs. Jedes Regal nimmt nur sein eigenes Buch an. Sie zeigt außerdem, wie eine echte Quest mehrere Ereignisse mit dem Questlog verbindet: fünfmal `onItemInShelf` mit `itemType` und `shelfType`, dazu ein Questlog-Eintrag mit Fortschritt.

| Buch | gehört in |
| --- | --- |
| Informatik (`myname:cs_book`) | `myname:computer_science_bookshelf` |
| Controlling (`myname:cofi_book`) | `myname:controlling_bookshelf` |
| Immobilienwirtschaft (`myname:immo_book`) | `myname:immobilienwirtschaft_bookshelf` |
| Nachhaltige Ingenieurwissenschaften (`myname:niia_book`) | `myname:nachhaltige_ingenieurwissenschaften_bookshelf` |
| Steuerberatung (`myname:stwp_book`) | `myname:steuerberatung_bookshelf` |

Wie die Regale funktionieren, steht unter [Eigene Bücherregale](item-in-shelf.md#eigene-bücherregale).

## Starten

1. Eine Welt mit **aktivierten Cheats** und beiden Packs öffnen und auf eine ebene, freie Fläche stellen.
2. Ausführen:

   ```text
   /scriptevent dhsn:quest_test_library
   ```

3. 3 Blöcke nördlich (−Z) entstehen die fünf Regale in einer Reihe, mit je einem Block Abstand, in der Reihenfolge der Tabelle von West nach Ost. Auf jedem Regal steht ein Schild mit dem Namen seines Studiengangs. 2 Blöcke östlich des letzten Regals steht die Bibliothekarin, über sie startet man die [Bibliotheks-Quest](../quests/library-quest.md). Der Test selbst gibt keine Bücher aus: Man bekommt sie von der Bibliothekarin, wenn man die Quest annimmt.

Im Chat steht anschließend eine Kurzfassung der Bibliotheks-Quest mit ihren fünf Schritten und dem Befehl zum Zurücksetzen.

Der Spielmodus ist egal, die eigenen Regale funktionieren auch im Kreativmodus.

## Ablauf

Rechts oben erscheint im Questlog der Eintrag **„Bibliothek: Bücher sortieren“** mit einer Zeile pro Studiengang:

```text
[ ] Informatik
[ ] Controlling
[ ] Immobilienwirtschaft
[ ] Nachh. Ingenieurwiss.
[ ] Steuerberatung
```

1. Die Bibliothekarin ansprechen und die Quest annehmen, dann sind die fünf Bücher im Inventar. Das Informatik-Buch in die Hand nehmen und auf das Informatik-Regal rechtsklicken. Im Chat erscheinen `Buch einsortiert (1/6)` und:

   ```text
   Ereignis ist eingetreten: Informatik-Buch ins Informatik-Regal (<Name>)
   ```

   Die Zeile „Informatik“ wird grün abgehakt.
2. Genauso die anderen vier Bücher in ihre Regale stellen. Welches Regal zu welchem Studiengang gehört, steht auf den Schildern.
3. Nach dem fünften Buch erscheint `Quest abgeschlossen: Alle Bücher sind richtig sortiert!`, und der Titel im Questlog wird grün mit „(fertig)“.

## Zurücksetzen

Ein erneutes `/scriptevent dhsn:quest_test_library` baut die Regale an der aktuellen Position neu auf, leert ihre Zähler und setzt die Haken zurück. Die Bibliothekarin aus dem vorherigen Durchlauf wird dabei entfernt und neu gesetzt; erkannt wird sie am Tag `dhsn:library_test`.

**Den Fortschritt der Bibliotheks-Quest setzt der Testbefehl nicht zurück.** Dafür gibt es `/scriptevent dhsn:quest_reset_library`. Kompletter Neustart in dieser Reihenfolge:

```text
/clear
/scriptevent dhsn:quest_reset_library
/scriptevent dhsn:quest_test_library
```

`/clear` entfernt Bücher und Smaragde aus dem Inventar; das ist optional. Hat man sich zwischen zwei Durchläufen bewegt, bleiben die alten Regale stehen, weil der Testbefehl nur an der aktuellen Position aufbaut. Siehe auch [Resetting the test](../quests/library-quest.md#resetting-the-test) (Englisch).

## Gegenproben

- **Falsches Regal:** Ein Buch, z. B. das Controlling-Buch, ins Informatik-Regal stellen. Es wird abgelehnt (`Das passt nicht in dieses Regal.`), bleibt in der Hand, und keine Zeile wird abgehakt.
- **Herausnehmen:** Mit leerer Hand auf ein Regal mit Buch rechtsklicken, dann kommt das Buch zurück. Die Zeile im Questlog bleibt abgehakt.
- **Schilder:** Text auf dem Schild ändern geht nicht, die Schilder sind gewachst.
- **Fremdes Item:** Papier oder ein anderes Item in ein Regal stellen ergibt `Das passt nicht in dieses Regal.`
- **Abbauen:** Ein Regal mit Buch abbauen, das Buch fällt heraus.

## Hinweise zur Ausrichtung

- **Regale:** Das Skript setzt sie so, wie sie ein Spieler mit Blick nach Norden platzieren würde, also mit der Vorderseite zum Spieler. Ob das im Spiel stimmt, ist noch ungeprüft. Zeigt die Rückseite zum Spieler, funktionieren die Regale trotzdem, nur die Ausrichtung in `test-library.js` müsste angepasst werden.
- **Schilder:** Sie stehen auf den Regalen (`minecraft:standing_sign`, Richtung `0`, die nach Süden zum Spieler zeigen sollte). Der Text steht auf beiden Seiten, damit er auch bei verdrehter Richtung lesbar ist. Ein Schild auf einem eigenen Block könnte abfallen, falls das Spiel die Regaloberseite nicht als tragfähig ansieht. Das ist noch ungeprüft.
