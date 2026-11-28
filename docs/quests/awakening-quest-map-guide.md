# Anleitung: Quest „Das Erwachen“ in die echte Map einbauen

> **Diese Anleitung erst nach dem Merge ausführen.** Der Branch `106-quest-das-erwachen` (und `91-quest-library`, auf dem er aufbaut) muss zuerst in `main` sein, und das Addon mit der Quest muss auf dem Server laufen.

Für das Team, das die Quest in die fertige Map einbaut. Du brauchst **keine Programmierkenntnisse**: Alle Orte trägst du im Spiel mit dem **Setup-Menü** ein, es wird keine Datei bearbeitet. Du brauchst Zugriff auf die Map (Creative, Cheats an, die Packs aktiv).

Hintergrund: [awakening-quest.md](awakening-quest.md) (Englisch), [awakening-setup.md](awakening-setup.md) (das Menü). Ticket: cs24-sopr/project#106.

**Wichtig:** Das Menü speichert alles **in der Welt**. Die Orte reisen also mit der Map-Datei mit. Wird die Map später durch eine neue Datei ersetzt (z. B. ein neuer Export vom Bau-Team), sind die Orte weg und müssen mit dem Menü neu gesetzt werden.

## Ablauf der Quest

| Schritt | Spieler |
| --- | --- |
| 1 | Wacht im Bett auf. Ein Wecker (Notenblock) klingelt. Ihn auszuschalten ist optional. |
| 2 | Geht zum Fenster. Eine **Kamerafahrt** um die Hochschule startet (nicht überspringbar, mit Musik), am Ende erscheint der Hochschulname. |
| 3 | Durchsucht die **Truhe** im Zimmer: Rucksack, Brot, Äpfel. |
| 4 | Verlässt das Gebäude und tritt auf das **Portal**. Es teleportiert vor das Tor der Hochschulinsel. |
| 5 | Spricht vor dem Haupteingang den **Professor** an. Die Quest ist beendet. |

Vor Schritt 4 lässt sich das Startgebäude nicht verlassen.

## 1. Vorbereitung: was in der Map stehen muss

| Was | Anforderung |
| --- | --- |
| Startgebäude mit Zimmer und Ausgang | Der Ausgang führt ins Freie. |
| Bett | Hier wacht der Spieler auf. |
| Wecker | Ein **Notenblock** im Zimmer. |
| Fenster | Mit einem kleinen Standplatz davor. Wer dort steht, löst die Kamerafahrt aus. |
| Truhe | Im Zimmer (Kiste, Fass geht nicht; es muss eine Truhe sein). Darf leer sein. |
| Portal | Vor dem Gebäude, **außerhalb** davon (z. B. Zaubertisch auf einer Platte). |
| Tor der Insel | Davor ein Punkt, an dem der Spieler nach der Teleportation steht. |
| Professor | Ein beliebiger NPC vor dem Tor. Ein vorhandener NPC reicht als Platzhalter. |

Die Map läuft im **Abenteuermodus**, alles muss in **einer Dimension** liegen.

## 2. Menü öffnen

```text
/scriptevent dhsn:awakening_setup
```

Du bekommst einen **Kompass „Quest-Setup“**. Der Befehl öffnet das Menü direkt. Rechtsklick mit dem Kompass öffnet wieder das Menü, das du zuletzt geöffnet hast. Derselbe Kompass dient auch der [Bibliothek](library-quest-map-guide.md): Mit **Schleichen + Rechtsklick** wählst du die Quest. Mehrere können gleichzeitig einrichten: Jeder Kompass merkt sich sein eigenes Menü, die gesetzten Orte gelten für alle. Jeder Klick speichert sofort, ✔ und ✘ zeigen, was fehlt. Zum Laufen das Menü schließen und mit dem Kompass neu öffnen.

## 3. Orte setzen

Stell dich hin, öffne das Menü, klick den Knopf. Alles, was „ansehen“ heißt: erst den Block anschauen, dann das Menü öffnen.

| Knopf | So geht’s |
| --- | --- |
| Aufwachpunkt | Neben das Bett stellen, zum Fenster schauen. |
| Wecker | Den Notenblock ansehen. |
| Fenster Ecke 1 / 2 | In zwei gegenüberliegende Ecken des Standplatzes vor dem Fenster stellen. Der Bereich ist klein (1 bis 2 Blöcke tief). |
| Truhe | Die Truhe ansehen. |
| Gebäude Ecke 1 / 2 | Ecke 1 am Boden einer Ecke, Ecke 2 in der gegenüberliegenden Ecke **auf dem Dach**. Das **ganze** Gebäude muss drin liegen, auch die Schwelle des Ausgangs, aber nicht der Vorplatz. |
| Rückkehrpunkt | Im Gebäude nahe am Ausgang. Dorthin wird gesetzt, wer zu früh geht. |
| Teleporter Ecke 1 / 2 | In zwei gegenüberliegende Ecken der Portalfläche stellen. |
| Insel-Tor | Vor das Tor der Insel stellen, zum Tor schauen. |
| Professor | Den NPC ansehen. Der NPC bekommt den Tag `dhsn:awakening_professor`. |

Regeln:

- Portal und Gebäude dürfen sich **nicht überlappen**, das Insel-Tor liegt in keinem von beiden.
- Fenster, Truhe, Wecker und Rückkehrpunkt liegen **im** Gebäude.

## 4. Kamerafahrt

Unter **Kamerafahrt …**:

1. Zum Startpunkt gehen (am Fenster, Blick nach draußen), **Aufnahme hinzufügen**. Die erste Aufnahme ist der Start.
2. Weiter zum nächsten Punkt, den Blick ausrichten, wieder **Aufnahme hinzufügen**. Das Menü fragt, wie lange der Flug dorthin dauert (Standard 3 Sekunden).
3. **Vorschau abspielen** zeigt die Fahrt. Zu schnell, zu langsam oder falscher Blick? **Letzte Aufnahme entfernen** und neu setzen.

Vorschlag aus dem Ticket: einmal um das Gebäude, durchs Fenster, den Gang entlang, aus dem Haupteingang, dann eine Drehung, die die Hochschule noch einmal zeigt.

Tipps: 3 bis 4 Sekunden pro Teilstrecke, beim Durchflug von Fenster und Tür langsam und gerade (2 bis 3 Sekunden). Die Aufnahme sitzt auf **Augenhöhe**. Die Fahrt sollte etwa so lang sein wie die Musik.

## 5. Weltspawn setzen

Der Spieler wacht am Weltspawn auf, also neben dem Bett (Bodenhöhe, Mitte des Blocks):

```text
/setworldspawn <x> <y> <z>
```

Die Quest startet automatisch, wenn ein Spieler **zum ersten Mal** der Welt beitritt.

## 6. Testen

Sind alle Orte gesetzt, ist das Layout sofort aktiv. **Quest neu starten (am Aufwachpunkt)** im Menü setzt deinen Stand zurück und startet von vorn. Abenteuermodus, Content-Log an (Einstellungen → Creator).

| # | Prüfen | Erwartung |
| --- | --- | --- |
| 1 | Aufwachen | Bildschirm kurz schwarz, Wecker klingelt, Questlog zeigt die Ziele. |
| 2 | Rechtsklick auf den Notenblock | Klingeln stoppt, Tonhöhe ändert sich nicht. |
| 3 | Gebäude verlassen versuchen | Rückkehr an den Rückkehrpunkt mit Hinweis im Chat. |
| 4 | Truhe vor der Kamerafahrt | Hinweis, es wird nichts verteilt. |
| 5 | Zum Fenster gehen | Kamerafahrt mit Musik und Titel, danach wieder Kontrolle. |
| 6 | Truhe durchsuchen | Bündel, Brot, Äpfel. |
| 7 | Gebäude verlassen, Portal betreten | Teleport vor das Tor, Hinweis auf die Nebenquest. |
| 8 | Professor ansprechen | Dialog (nicht das normale NPC-Fenster), danach ist die Quest abgeschlossen. |

Abkürzungen (brauchen Cheats): `/scriptevent dhsn:quest_awakening_step <wake|chest|portal|professor|done>` springt zu einem Schritt, `dhsn:quest_awakening_state` zeigt Stand und Quelle des Layouts, `dhsn:quest_reset_awakening` setzt zurück.

## 7. Testaufbau nicht mitliefern

Der Befehl `dhsn:quest_test_awakening` **ersetzt das Layout durch ein Testlayout**. In der echten Map darf er nie laufen. Lösch dafür `behavior_pack/scripts/events/test-awakening.js` und die Import-Zeile dazu in `behavior_pack/scripts/main.js`. Das Setup-Menü darf bleiben, oder du löschst `quests/awakening-setup.js` und den Import, wenn alles fertig ist (das gespeicherte Layout gilt dann trotzdem weiter).

## 8. Map sauber ausliefern

1. Eigenen Stand zurücksetzen: `/scriptevent dhsn:quest_reset_awakening`.
2. Prüfen, dass das Menü kein Häkchen ✘ mehr zeigt und `quest_awakening_state` als Quelle „Setup-Menü“ nennt.
3. Weltspawn, Abenteuermodus und aktive Packs prüfen.
4. Wenn möglich: frische Kopie der Map als neuer Spieler öffnen und die Quest einmal durchspielen.

Der Quest-Stand wird in der Map-Datei gespeichert. Ein Tester-Stand darf nicht mit ausgeliefert werden.

## 9. Wenn etwas nicht klappt

Content-Log einschalten, dort stehen Skriptfehler.

| Problem | Ursache |
| --- | --- |
| Nichts passiert | Im Menü fehlt noch etwas (✘), oder `quest_awakening_state` zeigt kein Layout. |
| Es gelten fremde Werte | Ein Testlayout wurde zuletzt gespeichert: im Menü irgendeinen Ort neu setzen oder `quest_test_awakening_clear` ausführen und die Orte neu setzen. |
| Man wacht an der falschen Stelle auf | Weltspawn nicht gesetzt (Abschnitt 5). |
| Rechtsklick auf Wecker/Truhe tut nichts | Beim Setzen wurde ein anderer Block angesehen. Neu setzen. |
| Kamerafahrt startet nicht | Fensterbereich zu klein oder falsch. Ecken neu setzen. Der Bereich muss **betreten** werden. |
| Gebäude lässt sich nicht verlassen, obwohl alles erledigt ist | Gebäudebereich enthält den Vorplatz. Ecken neu setzen. |
| Zu früh gehen wird nicht verhindert | Gebäudebereich zu klein, der Ausgang gehört nicht dazu. |
| Portal tut nichts | Portal liegt im Gebäude, oder der Spieler ist nicht im Schritt „Portal“ (Truhe vergessen). |
| Nach dem Teleport wird man zurückgesetzt | Das Insel-Tor liegt im Gebäude- oder Portalbereich. |
| Professor öffnet das normale NPC-Fenster | Der Tag fehlt: im Menü „Professor“ neu setzen. |
| Musik fehlt | Welt neu betreten, Test mit `/playsound dhsn.intro_music @s`. |
| Rechtsklick mit dem Kompass öffnet das falsche Menü | Der Kompass öffnet das zuletzt geöffnete Menü. Schleichen + Rechtsklick und „Das Erwachen“ wählen, oder den Befehl `dhsn:awakening_setup` nutzen. |
| Gelbe Meldung „Fehler bei „…““ im Chat | Ein Knopf im Menü ist fehlgeschlagen, z. B. weil der Block zu weit weg oder nicht geladen war. Das Menü bleibt offen: näher hingehen und erneut klicken. Kommt die Meldung wieder, sie dem Coding-Team schicken. |

## 10. Was noch Platzhalter ist

Nicht deine Aufgabe, aber gut zu wissen:

- **Dialogtexte** und der **Hochschulname** (`Duale Hochschule Sachsen` ist geraten).
- **Rucksack:** ein Bündel (`minecraft:bundle`).
- **Professor:** ein beliebiger NPC, bis es den „chaotischen Professor“ gibt.
- **Musik:** „Epic“ von The_Mountain ([Pixabay](https://pixabay.com/music/epic-classical-epic-508009/)). Die Lizenz ist vor der Veröffentlichung noch zu prüfen.
- **Nebenquest „Gelände erkunden“** und **Folgequest:** werden separat gebaut. Die Quest hat dafür zwei leere Stellen (`startExploreCampusQuest`, `onQuestFinished`).
