# Anleitung: Bibliotheks-Quest in die echte Map einbauen

> **Diese Anleitung erst nach dem Merge ausführen.** Der Branch mit dem Setup-Menü der Bibliothek (Ticket 209) muss in `main` sein, und das Addon muss auf dem Server laufen.

Für das Team, das die Quest in die fertige Map einbaut. Du brauchst **keine Programmierkenntnisse**: Alle Orte trägst du im Spiel mit dem **Setup-Menü** ein, es wird keine Datei bearbeitet. Du brauchst Zugriff auf die Map (Kreativ, Cheats an, die Packs aktiv).

Hintergrund: [library-quest.md](library-quest.md) (Englisch), [setup-menu.md](../setup-menu.md) (das gemeinsame Menü). Vorbild: [Anleitung zu „Das Erwachen“](awakening-quest-map-guide.md).

**Wichtig:** Das Menü speichert alles **in der Welt**. Die Orte reisen also mit der Map-Datei mit. Wird die Map später durch eine neue Datei ersetzt (z. B. ein neuer Export vom Bau-Team), sind die Orte weg und müssen mit dem Menü neu gesetzt werden.

## Ablauf der Quest

| Schritt | Spieler |
| --- | --- |
| 1 | Spricht die **Bibliothekarin** an und nimmt die erste Runde an. Er bekommt gemischt Bücher: pro Studiengang 1 bis 5, insgesamt höchstens 14. |
| 2 | Stellt jedes Buch in ein **Regal seines Studiengangs**, pro Regal und Runde nur ein Buch. Falsches Regal: Die Bibliothekarin sagt Bescheid. |
| 3 | Verlässt er währenddessen die Bibliothek, kommt ein Countdown (5 s), danach ist die Runde zurückgesetzt. |
| 4 | Gibt die Runde bei der Bibliothekarin ab. Nach Runde 2 ist die Quest beendet (Belohnung, ECTS). |
| 5 | Danach kann er eine **Challenge** auf Zeit spielen; die 3 besten Zeiten stehen auf dem **Highscore-Schild**. |

## 1. Vorbereitung: was in der Map stehen muss

| Was | Anforderung |
| --- | --- |
| Bibliothek | Ein Raum, möglichst mit **einem** Ausgang. Wer ihn während einer Runde verlässt, verliert die Bücher. |
| Regale | Die eigenen Studiengangs-Regale (`myname:computer_science_bookshelf`, `…controlling…`, `…immobilienwirtschaft…`, `…nachhaltige_ingenieurwissenschaften…`, `…steuerberatung…`). **Pro Studiengang mindestens ein Regal**, mehr Regale heißt mehr mögliche Bücher (bis 5). Nicht direkt an die Raumgrenze stellen. |
| Bibliothekarin | Eine Bibliothekarin (`dhsn:librarian`) in der Bibliothek. |
| Highscore-Schild | Optional: ein Schild in der Bibliothek für die Bestenliste. Ohne Schild gibt es keine Bestenliste, die Quest funktioniert trotzdem. |

Die Map läuft im **Abenteuermodus**, alles muss in **einer Dimension** liegen. Die Bibliothek sollte **ein Stockwerk** haben: Der Bereich reicht vom Boden bis 4 Blöcke über die Füße.

## 2. Menü öffnen

```text
/scriptevent dhsn:library_setup
```

Du bekommst einen **Kompass „Quest-Setup“**, und das Menü der Bibliothek öffnet sich, sobald der Chat zu ist. Rechtsklick mit dem Kompass fragt, welche Quest du einrichten willst (derselbe Kompass dient auch „Das Erwachen“); wähle „Bibliothek“. Jeder Klick speichert sofort, ✔ und ✘ zeigen, was fehlt. Zum Laufen das Menü schließen und mit dem Kompass neu öffnen.

## 3. Orte setzen

Stell dich hin, öffne das Menü, klick den Knopf. „Ansehen“ heißt: erst den Block anschauen, dann das Menü öffnen.

| Knopf | So geht’s |
| --- | --- |
| Bibliothek: Ecke 1 (am Boden) | In eine Ecke der Bibliothek stellen, auf dem Boden. |
| Bibliothek: Ecke 2 (gegenüber, am Boden) | In die **gegenüberliegende** Ecke stellen, auf dem Boden. Der Bereich reicht von 1 Block unter den Füßen (Boden) bis 4 Blöcke darüber. |
| Highscore-Schild (ansehen) | Das Schild ansehen. Andere Blöcke werden abgelehnt. |
| Regale prüfen | Zeigt die Regale pro Studiengang im Bereich. **Jeder Studiengang braucht mindestens 1**, rot markierte fehlen. |
| Bibliothekarin prüfen | Zeigt, ob eine Bibliothekarin im Bereich steht. |
| Quest-Stand zurücksetzen | Setzt deinen eigenen Fortschritt zurück (zum Testen). |
| Alles löschen | Löscht Bereich und Schild (mit Rückfrage). |

Regeln:

- Die ganze Bibliothek muss im Bereich liegen, **auch die Regale und die Bibliothekarin**, aber nicht der Gang davor.
- Sind beide Ecken gesetzt, ist die Bibliothek **sofort aktiv**. Ein vorher gespeicherter Testaufbau wird dabei gelöscht.

## 4. Testen

Abenteuermodus, Content-Log an (Einstellungen → Creator). Vorher im Menü **Quest-Stand zurücksetzen**.

**Ohne fertige Map üben** (z. B. in einer flachen Testwelt): `/scriptevent dhsn:quest_test_library` gibt alles, was du für eine kleine Bibliothek brauchst (Regale aller Studiengänge, Schilder, Spawn-Ei der Bibliothekarin, Kompass) und erklärt die Schritte im Chat. Details: [test-library.md](../events/test-library.md).

| # | Prüfen | Erwartung |
| --- | --- | --- |
| 1 | „Regale prüfen“ | Alle 5 Studiengänge mit mindestens 1 Regal. |
| 2 | Bibliothekarin ansprechen, Runde annehmen | Bücher bunt gemischt im Inventar, höchstens 14. |
| 3 | Buch ins Regal eines anderen Studiengangs | Abgelehnt, die Bibliothekarin nennt das Regal. |
| 4 | Bibliothek verlassen | Countdown „Halt!“; zurückkommen bricht ihn ab, draußen bleiben setzt die Runde zurück. |
| 5 | Alle Bücher einsortieren, abgeben, Runde 2 genauso | Belohnung und ECTS, danach Angebot der Challenge. |
| 6 | Challenge spielen | Zeit im Chat, Eintrag auf dem Highscore-Schild. |

Abkürzungen (brauchen Cheats): `dhsn:quest_library_state` zeigt den Stand und den Bibliotheksbereich, `dhsn:quest_reset_library` setzt zurück, `dhsn:library_highscores_reset` leert die Bestenliste.

## 5. Testaufbau nicht mitliefern

Der Befehl `dhsn:quest_test_library aufbau` **baut eine Test-Bibliothek und setzt deren Bereich** (er hat Vorrang vor dem Menü). Ohne `aufbau` gibt er nur Material und löscht einen Testbereich. In der echten Map darf er nie laufen. Lösch dafür `behavior_pack/scripts/events/test-library.js` und die Import-Zeile dazu in `behavior_pack/scripts/main.js`. Lief er doch, im Menü irgendeinen Ort neu setzen: Das löscht den Testbereich.

Das Setup-Menü darf bleiben. Du kannst `quests/library-setup.js` samt Import auch löschen, wenn alles fertig ist; die gespeicherten Orte gelten weiter.

## 6. Map sauber ausliefern

1. Stand und Bestenliste leeren: `/scriptevent dhsn:quest_reset_library`, `/scriptevent dhsn:library_highscores_reset`.
2. Alles andere Gespeicherte (Fortschritt, Testdaten) löschen, die Orte aus dem Menü bleiben: `/scriptevent dhsn:map_cleanup confirm`.
3. Prüfen: `/scriptevent dhsn:progress` zeigt `dhsn:library_map_layout`, das Menü zeigt kein ✘ bei den Ecken und als Quelle „Setup-Menü“.
4. Welt neu betreten. Wenn möglich: frische Kopie der Map als neuer Spieler öffnen und die Quest einmal durchspielen.

## 7. Wenn etwas nicht klappt

Content-Log einschalten, dort stehen Skriptfehler.

| Problem | Ursache |
| --- | --- |
| Die Quest zählt Regale außerhalb der Bibliothek oder keine | Bereich fehlt oder ist falsch: im Menü beide Ecken neu setzen, „Regale prüfen“. |
| Es gibt keine Bücher eines Studiengangs | Dieser Studiengang hat kein Regal im Bereich („Regale prüfen“ zeigt ihn rot). |
| Countdown kommt schon beim Springen oder auf einem Regal | Bibliothek höher als 4 Blöcke über den Füßen; Ecken auf dem Boden setzen. |
| Countdown kommt nie | Kein Bereich gesetzt, oder der Ausgang liegt noch im Bereich. |
| Es gelten fremde Werte | Ein Testaufbau wurde zuletzt gespeichert: im Menü einen Ort neu setzen. |
| Highscore-Schild bleibt leer | Kein Schild gesetzt, oder es wurde ein anderer Block angesehen. Neu setzen; der Text erscheint nach der ersten Challenge. |
| Bibliothekarin öffnet das normale NPC-Fenster | Es ist nicht `dhsn:librarian`. |
| Rechtsklick mit dem Kompass öffnet das falsche Menü | In der Auswahl „Bibliothek“ wählen, oder den Befehl `dhsn:library_setup` nutzen. |

## 8. Was noch Platzhalter ist

Nicht deine Aufgabe, aber gut zu wissen:

- **Dialogtexte** der Bibliothekarin.
- **Belohnung:** 3 Smaragde und 5 ECTS.
- **Kamerafahrt** zu Beginn der Quest ist vorbereitet, aber noch leer.
