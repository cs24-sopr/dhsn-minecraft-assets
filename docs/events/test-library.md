# Bibliotheks-Test – Aufbau für die Bibliotheks-Quest

Datei: [test-library.js](../../behavior_pack/scripts/events/test-library.js) · [Übersicht](../Events.md)

Testaufbau für die [Bibliotheks-Quest](../quests/library-quest.md). Zwei Varianten:

| Befehl | Wofür |
| --- | --- |
| `/scriptevent dhsn:quest_test_library` | **Test des Setup-Menüs:** Du bekommst das Material und baust die Bibliothek selbst, dann richtest du sie mit dem Kompass „Quest-Setup“ ein, wie das Map-Team. Siehe [Material für das Setup-Menü](#material-für-das-setup-menü). |
| `/scriptevent dhsn:quest_test_library aufbau` | **Schneller Test der Quest:** Baut eine fertige kleine Bibliothek auf (Regale aller fünf Studiengänge, Holzboden als Bereich, Bibliothekarin, Highscore-Schild). Siehe [Automatischer Aufbau](#testumgebung). |

**Keiner der Befehle startet die Quest.** Quest, Bücher und Questlog-Eintrag beginnen erst, wenn man die Bibliothekarin anspricht.

## Material für das Setup-Menü

`/scriptevent dhsn:quest_test_library` (ohne Zusatz) gibt:

| Material | Anzahl | Warum so viele |
| --- | --- | --- |
| `myname:computer_science_bookshelf` | 6 | Mehr als 5: zeigt, dass es pro Studiengang höchstens 5 Bücher gibt. |
| `myname:controlling_bookshelf` | 5 | |
| `myname:immobilienwirtschaft_bookshelf` | 4 | |
| `myname:nachhaltige_ingenieurwissenschaften_bookshelf` | 3 | |
| `myname:steuerberatung_bookshelf` | 3 | Zusammen sind über 14 Bücher möglich: zeigt die Grenze von 14 pro Runde. |
| Eichenschild (`minecraft:oak_sign`) | 6 | 1 für die Bestenliste, 5 zum Beschriften der Regale. |
| Spawn-Ei der Bibliothekarin (`dhsn:librarian_spawn_egg`) | 1 | Gibt es das Ei nicht, erscheint die Bibliothekarin stattdessen 2 Blöcke östlich von dir. |
| Kompass „Quest-Setup“ | 1 | Nur, wenn du ihn noch nicht hast. |

Außerdem wird ein vorher gespeicherter Testbereich (`dhsn:library_test_area`, `dhsn:library_test_sign`) **gelöscht**, damit die Werte aus dem Setup-Menü gelten. Volles Inventar: Der Rest fällt vor dir auf den Boden.

Ablauf (steht auch im Chat):

1. `/gamemode creative`, Bibliothek bauen: Regale aufstellen (je Studiengang mindestens 1), Bibliothekarin mit dem Ei setzen, ein Schild für die Bestenliste aufstellen.
2. Kompass (Rechtsklick öffnet das zuletzt geöffnete Menü; andere Quest: Schleichen + Rechtsklick → „Bibliothek“): Ecke 1 und 2 am Boden setzen, Schild ansehen und „Highscore-Schild“ klicken, „Regale prüfen“, „Bibliothekarin prüfen“.
3. `/gamemode adventure`, Quest bei der Bibliothekarin starten.

Die Schritte im Menü erklärt die [Anleitung für das Map-Team](../quests/library-quest-map-guide.md).

## Automatischer Aufbau

`/scriptevent dhsn:quest_test_library aufbau` baut die folgende Bibliothek.

Jedes Regal nimmt nur das Buch seines Studiengangs an:

| Buch | gehört in | Regale im Test |
| --- | --- | --- |
| Informatik (`myname:cs_book`) | `myname:computer_science_bookshelf` | 4 |
| Controlling (`myname:cofi_book`) | `myname:controlling_bookshelf` | 3 |
| Immobilienwirtschaft (`myname:immo_book`) | `myname:immobilienwirtschaft_bookshelf` | 3 |
| Nachhaltige Ingenieurwissenschaften (`myname:niia_book`) | `myname:nachhaltige_ingenieurwissenschaften_bookshelf` | 3 |
| Steuerberatung (`myname:stwp_book`) | `myname:steuerberatung_bookshelf` | 3 |

Informatik hat absichtlich 4 Regale: Eine normale Runde kann dort bis zu 4 Bücher ausgeben (mehr als Regale gibt es nie, höchstens 5 pro Studiengang, höchstens 14 insgesamt), die Challenge höchstens 3. Wie die Regale funktionieren, steht unter [Eigene Bücherregale](item-in-shelf.md#eigene-bücherregale).

### Testumgebung

- **Flache Welt**, **Abenteuermodus** (wie die Map), **Cheats an**.
- DHSN Behavior Pack und Resource Pack aktiv.
- Empfohlen: Content-Log einschalten (Einstellungen → Creator → Content-Log), dort erscheinen Skriptfehler.

### Starten

1. Auf eine freie, ebene Stelle stellen.
2. Ausführen:

   ```text
   /scriptevent dhsn:quest_test_library aufbau
   ```

3. Es entsteht:
   - **Holzboden** (`minecraft:oak_planks`): Das ist der Bibliotheksbereich. Er reicht von 2 Blöcken südlich von dir bis hinter die letzte Regalreihe und vom Boden bis 4 Blöcke über die Füße. Die Eckpunkte stehen im Chat. Wer ihn während einer Runde verlässt, bekommt eine Warnung mit Countdown.
   - **Fünf Regalreihen** nördlich (−Z), eine pro Studiengang, ab 3 Blöcken Abstand, mit je einem Gang dazwischen. Die Regale zeigen nach Süden. Nur das **letzte Regal jeder Reihe** (östliches Ende) trägt ein Schild mit dem Studiengang.
   - **Bibliothekarin** östlich der ersten Reihe.
   - **Highscore-Schild** östlich der dritten Reihe. Es zeigt die 3 besten Zeiten der Challenge.
4. Im Chat steht eine Kurzfassung der Quest und eine Zeile zu den ECTS: dein aktueller Stand und wie viele ECTS die Quest gibt (siehe [ECTS](../Ects.md)). Der Testaufbau ändert die ECTS nicht; zum Zurücksetzen `/scriptevent dhsn:ects_reset`.

Bibliotheksbereich und Position des Highscore-Schildes werden **in der Welt gespeichert** (`dhsn:library_test_area`, `dhsn:library_test_sign`). Sie gelten also auch nach `/reload` und nach einem Neustart der Welt und haben Vorrang vor den Werten aus dem [Setup-Menü](../setup-menu.md) und vor den Werten im Code (`LIBRARY_AREA`, `HIGHSCORE_SIGN`).

## Danach

Weiter geht es mit der Bibliotheks-Quest: Bibliothekarin ansprechen, Quest annehmen, Bücher in die Regale stellen. Ablauf und Testschritte stehen in der [Quest-Doku](../quests/library-quest.md#testing) (Englisch).

## Test-Befehle

| Befehl | Wirkung |
| --- | --- |
| `/scriptevent dhsn:quest_test_library` | Gibt das Material für den Test des Setup-Menüs und löscht einen gespeicherten Testbereich. |
| `/scriptevent dhsn:quest_test_library aufbau` | Baut die Bibliothek an der aktuellen Position (neu) auf. |
| `/scriptevent dhsn:quest_test_library_clear` | Löscht den gespeicherten Bibliotheksbereich und das Test-Schild. Danach gelten wieder die Werte aus dem Setup-Menü, sonst `LIBRARY_AREA` und `HIGHSCORE_SIGN` aus dem Code. Die Blöcke bleiben stehen. |
| `/scriptevent dhsn:quest_reset_library` | Setzt den Quest-Stand zurück (einmal pro Welt), nimmt die Bücher einer laufenden Runde oder Challenge weg und trägt sie aus den Regalen aus. |
| `/scriptevent dhsn:quest_library_state` | Schreibt den Stand in den Chat: Runde, ausgegebene und einsortierte Bücher pro Studiengang, in welches Regal jedes Buch kam, den Bibliotheksbereich. |
| `/scriptevent dhsn:library_highscores_add <Name> <Sekunden>` | Trägt eine Fake-Zeit ein, z. B. `Kai 42,5`. So lassen sich Sortierung und „Top 3“ ohne viele Durchläufe prüfen. |
| `/scriptevent dhsn:library_highscores_reset` | Leert die Bestenliste. |

## Zurücksetzen

Ein erneutes `/scriptevent dhsn:quest_test_library aufbau` **leert den ganzen Bereich** über dem Boden (setzt alles auf Luft, entfernt also auch alte Regale und Schilder an derselben Stelle), legt den Boden neu und baut alles wieder auf. Die Zähler der neuen Regale werden geleert. Die Bibliothekarin aus dem vorherigen Durchlauf wird entfernt und neu gesetzt; erkannt wird sie am Tag `dhsn:library_test`.

**Den Fortschritt der Bibliotheks-Quest und die Bestenliste setzt der Testbefehl nicht zurück.** Kompletter Neustart in dieser Reihenfolge:

```text
/clear
/scriptevent dhsn:quest_reset_library
/scriptevent dhsn:library_highscores_reset
/scriptevent dhsn:quest_test_library aufbau
```

`/clear` entfernt Bücher und Smaragde aus dem Inventar; das ist optional.

Hat man sich zwischen zwei Durchläufen bewegt, bleiben alter Boden und alte Regale stehen. Sie zählen aber nicht mehr, weil der gespeicherte Bereich auf den neuen Aufbau zeigt. Sauberer ist es, den Test immer an derselben Stelle oder in einer neuen Welt zu spawnen.

## Gegenproben

- **Abenteuermodus zuerst:** Ein Buch in ein Regal stellen. Reagiert das Regal nicht, funktioniert die Quest in der Map (Abenteuermodus) nicht. Das ist dann vor allem anderen zu klären.
- **Kein Questlog:** Direkt nach dem Befehl erscheint kein Questlog-Eintrag, erst nach dem Annehmen der Quest bei der Bibliothekarin.
- **Falsches Regal ohne Quest:** Ein Buch ins Regal eines anderen Studiengangs stellen. Es wird abgelehnt (`Das passt nicht in dieses Regal.`) und bleibt in der Hand. Während einer Runde antwortet stattdessen die Bibliothekarin.
- **Herausnehmen:** Mit leerer Hand auf ein Regal rechtsklicken. Es kommt kein Buch heraus, nur der Hinweis `In diesem Regal stehen … Bücher. Herausnehmen geht nicht.`
- **Schilder:** Text auf den Schildern ändern geht nicht, sie sind gewachst.
- **Fremdes Item:** Papier oder ein anderes Item in ein Regal stellen ergibt `Das passt nicht in dieses Regal.`
- **Neu laden:** `/reload`, dann mit laufender Runde den Holzboden verlassen. Die Warnung erscheint, der Bereich ist also erhalten geblieben.
- **Gelber Chat:** Alle Meldungen von Test, Regalen und Quest sind gelb.

## Hinweise zur Ausrichtung

- **Regale:** Das Skript setzt sie so, wie sie ein Spieler mit Blick nach Norden platzieren würde, also mit der Vorderseite nach Süden. Ob das im Spiel stimmt, ist noch ungeprüft. Zeigt die Rückseite nach Süden, funktionieren die Regale trotzdem, nur die Ausrichtung in `test-library.js` müsste angepasst werden.
- **Schilder:** Sie stehen auf dem letzten Regal jeder Reihe (`minecraft:standing_sign`, Richtung `0`, die nach Süden zeigen sollte). Der Text steht auf beiden Seiten, damit er auch bei verdrehter Richtung lesbar ist. Ein Schild auf einem eigenen Block könnte abfallen, falls das Spiel die Regaloberseite nicht als tragfähig ansieht. Das ist noch ungeprüft.
- **Highscore-Schild:** Es steht auf dem Holzboden. Sein Text kommt aus der Quest (nur Vorderseite) und wird beim Laden der Welt und nach jedem neuen Eintrag aktualisiert.
