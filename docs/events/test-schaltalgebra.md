# Schaltalgebra-Test – Aufbau für die Quest „Schaltalgebra“

Datei: [test-schaltalgebra.js](../../behavior_pack/scripts/events/test-schaltalgebra.js) · [Übersicht](../Events.md) · [Quest-Doku](../quests/schaltalgebra-quest.md) (Englisch)

Ersetzt die Räume, solange das Building-Team sie noch nicht gebaut hat (`project#174`). **Er gehört nicht zur ausgelieferten Map.** Der Befehl startet nichts und ändert den Quest-Stand nicht.

## Testumgebung

- **Flache Welt**, **Abenteuermodus** (wie die Map), **Cheats an**.
- DHSN Behavior Pack und Resource Pack aktiv.
- Empfohlen: Content-Log einschalten (Einstellungen → Creator → Content-Log).

## Starten

1. Auf eine freie, ebene Stelle stellen. Nach Osten müssen ca. 26 Blöcke frei sein, nach Norden und Süden je 4.
2. Ausführen:

   ```text
   /scriptevent dhsn:quest_test_schaltalgebra
   ```

3. Es entsteht, vom Spieler aus nach Osten (+X); alles über dem Boden wird zuerst geleert:

| Was | Wo (relativ zum Spieler) | Details |
| --- | --- | --- |
| Hochschulraum | x −1 bis 7 | Holzboden, Wände aus Steinziegeln, Eingang nach Westen. Du stehst darin. |
| Lampe mit Knopf | x 4, auf Fußhöhe | Redstone-Lampe, Steinknopf obendrauf. Darunter der Bodenblock, den die Quest später durch einen Redstone-Block ersetzt. |
| Kiste mit Studierendenausweis | x 1, drei Blöcke südlich | Im Hochschulraum, mit Schild daneben. Enthält einen `dhsn:studierendenausweis`; wird bei jedem Aufbau neu befüllt. |
| Rätselraum | x 12 bis 25 | Geschlossen, glatter Steinboden. |
| Schalter A–D | x 15, 17, 19, 21, eine Reihe nördlich | Hebel auf dem Boden, Schilder „Schalter A“ … dahinter. |
| Ziel-Lampe | x 23, auf einem Sockel | Am Ende des Rätselraums. |
| Rückkehr-Knopf | x 14, zwei Blöcke südlich | Schild „Zurück“ dahinter. |
| Schild mit Test-Lösung | x 22, drei Blöcke südlich | `A UND (NICHT B) UND C UND D` |

4. Im Chat steht eine Kurzfassung.

Das Layout wird **in der Welt gespeichert** (`dhsn:schaltalgebra_test_layout`) und hat Vorrang vor `LAYOUT` im Code, bis es mit `/scriptevent dhsn:quest_test_schaltalgebra_clear` gelöscht wird. Die Positionen der Ersatz-Schaltung (Hebel und Sockel) stehen ebenfalls in der Welt (`dhsn:schaltalgebra_test_substitute`), damit sie nach `/reload` und Neustart weiterläuft; der Clear-Befehl löscht auch sie.

## Ersatz-Schaltung

Die echte Redstone-Schaltung baut das Building-Team. Im Test übernimmt eine **Ersatz-Schaltung im Skript** ihre Aufgabe:
- Alle 4 Ticks liest sie die vier Hebel.
- Bei der Test-Lösung **A an, B aus, C an, D an** ersetzt sie den Sockel unter der Ziel-Lampe durch einen Redstone-Block, und die Lampe leuchtet.
- Bei jeder anderen Stellung setzt sie den Sockel zurück, und die Lampe geht aus.

Die Quest merkt davon nichts. Sie prüft nur, ob die Ziel-Lampe leuchtet, genau wie später in der echten Map. Die Test-Lösung steht in `TEST_SOLUTION` in `test-schaltalgebra.js`.

## Test-Befehle

| Befehl | Wirkung |
| --- | --- |
| `/scriptevent dhsn:quest_test_schaltalgebra` | Baut den Testaufbau an der aktuellen Position (neu) auf. |
| `/scriptevent dhsn:quest_test_schaltalgebra_clear` | Löscht das gespeicherte Layout und schaltet die Ersatz-Schaltung ab. Die Blöcke bleiben stehen. |
| `/scriptevent dhsn:quest_reset_schaltalgebra` | Setzt den eigenen Quest-Stand zurück, Lampe im Hochschulraum aus. |
| `/scriptevent dhsn:quest_schaltalgebra_state` | Stand im Chat. |
| `/scriptevent dhsn:quest_schaltalgebra_solve` | Löst das Rätsel ohne Schaltung. |
| `/give @s dhsn:studierendenausweis` | Studierendenausweis ohne Kiste, z. B. nach `/clear`. |

## Zurücksetzen

Kompletter Neustart:

```text
/clear
/scriptevent dhsn:quest_reset_schaltalgebra
/scriptevent dhsn:quest_test_schaltalgebra
```

Ein Aufbau an einer anderen Stelle lässt den alten stehen. Er zählt aber nicht mehr, weil das gespeicherte Layout auf den neuen zeigt.

## Ablauf und Checkliste

Der Ablauf der Quest steht in der [Quest-Doku](../quests/schaltalgebra-quest.md#testing) (Englisch). Die Checkliste zum Abhaken steht im Plan unter „Checkliste Playtest“.
