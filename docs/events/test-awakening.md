# Erwachen-Test – Aufbau für die Quest „Das Erwachen“

Datei: [test-awakening.js](../../behavior_pack/scripts/events/test-awakening.js) · [Übersicht](../Events.md) · [Quest-Doku](../quests/awakening-quest.md) (Englisch)

Ersetzt die echte Map, die es noch nicht gibt: Der Befehl baut alles, was die Quest braucht, und startet sie im Bett. **Er gehört nicht zur ausgelieferten Map.** Die Quest selbst kennt den Test nicht; sie liest nur ein Layout, das der Test speichert. Zum Übertragen auf die echte Map siehe [Moving the quest to the real map](../quests/awakening-quest.md#moving-the-quest-to-the-real-map).

## Testumgebung

- **Flache Welt**, **Abenteuermodus** (wie die Map), **Cheats an**.
- DHSN Behavior Pack und Resource Pack aktiv.
- Empfohlen: Content-Log einschalten (Einstellungen → Creator → Content-Log), dort erscheinen Skriptfehler.

## Starten

1. Auf eine freie, ebene Stelle stellen. Östlich davon sind ca. 35 Blöcke frei.
2. Ausführen:

   ```text
   /scriptevent dhsn:quest_test_awakening
   ```

3. Es entsteht, vom Spieler aus nach Osten (+X); alles über dem Boden wird zuerst geleert:

| Was | Wo (relativ zum Spieler, Z+ = Süden) | Details |
| --- | --- | --- |
| Startgebäude | x 0 bis 8, z 0 bis 8 | Ein Raum aus Steinziegeln, Holzboden, 4 Blöcke hoch. |
| Bett | x 1, z 6 bis 7 | Hier wachst du auf. Fällt zurück auf Wolle, falls das Bett per Skript nicht geht. |
| Wecker | x 2, z 7 | Notenblock neben dem Bett. |
| Fenster | x 3 bis 5, z 0 (Nordwand) | Glasscheiben. Wer davor steht, löst die Kamerafahrt aus. |
| Truhe | x 7, z 7 | In der Südostecke des Raums. |
| Ausgang | x 8, z 4 (Ostwand) | Zwei Blöcke hohe Öffnung. |
| Teleporter | x 12 bis 14, z 3 bis 5 | Lila Betonplatte mit Zaubertisch in der Mitte, auf einem Platz vor dem Ausgang. |
| Insel | x 24 bis 34, z 0 bis 8 | Zweiter Platz mit einem Tor aus Eisengittern zwischen zwei Pfeilern (x 33). |
| Professor | x 31, z 4 | Platzhalter-NPC mit dem Tag `dhsn:awakening_professor`. |

Danach bist du im Zimmer neben dem Bett, der Wecker klingelt, und im Chat steht eine Zeile zum Zurücksetzen. Ein erneuter Aufruf baut alles an der neuen Position neu auf (den NPC des letzten Durchlaufs erkennt der Test am Tag und ersetzt ihn) und startet die Quest von vorn.

Das Layout wird **in der Welt gespeichert** (`dhsn:awakening_test_layout`) und gilt auch nach `/reload` und nach einem Neustart der Welt. Es hat Vorrang vor `LAYOUT` im Code, bis es mit `/scriptevent dhsn:quest_test_awakening_clear` gelöscht wird.

## Danach

Der Ablauf der Quest und alle Testschritte stehen in der [Quest-Doku](../quests/awakening-quest.md#testing) (Englisch).

## Test-Befehle

| Befehl | Wirkung |
| --- | --- |
| `/scriptevent dhsn:quest_test_awakening` | Baut den Testaufbau an der aktuellen Position (neu) auf und startet die Quest. |
| `/scriptevent dhsn:quest_test_awakening_clear` | Löscht das gespeicherte Layout. Die Blöcke bleiben stehen. Danach gilt wieder `LAYOUT` aus dem Code. |
| `/scriptevent dhsn:quest_reset_awakening` | Setzt den eigenen Quest-Stand zurück. |
| `/scriptevent dhsn:quest_awakening_step <Schritt>` | Springt zu einem Schritt (`wake`, `chest`, `portal`, `professor`, `done`). |
| `/scriptevent dhsn:quest_awakening_ride` | Spielt nur die Kamerafahrt ab, ohne den Stand zu ändern. |
| `/scriptevent dhsn:quest_awakening_state` | Schreibt den eigenen Stand in den Chat. |

## Zurücksetzen

Der Testbefehl setzt auch den eigenen Quest-Stand zurück und fängt wieder bei Schritt 1 an, ein zusätzlicher Reset ist also nicht nötig. Ein Aufbau an einer anderen Stelle lässt den alten stehen; der zählt nicht mehr, weil das gespeicherte Layout auf den neuen zeigt. Sauberer ist es, den Test immer an derselben Stelle oder in einer neuen Welt zu starten.
