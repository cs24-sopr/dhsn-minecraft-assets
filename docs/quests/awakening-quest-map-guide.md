# Anleitung: Quest „Das Erwachen“ in die echte Map einbauen

> **Diese Anleitung erst nach dem Merge ausführen.** Der Branch `106-quest-das-erwachen` (und `91-quest-library`, auf dem er aufbaut) muss zuerst in `main` sein. Erst dann ist die Quest im Code vorhanden, in die du die Koordinaten einträgst.

Für das Team, das die Quest in die fertige Map einbaut. Du brauchst dafür **keine Programmierkenntnisse**, aber Zugriff auf die Map (Creative-Modus, Cheats an) und auf das Repository (eine Datei bearbeiten, committen).

Die Quest selbst ist fertig und im Spiel mit einem Testaufbau geprüft. Sie weiß nur nicht, **wo** in der Map die Dinge stehen (Fenster, Truhe, Portal, …). Genau das trägst du hier ein. Hintergrund zur Quest: [awakening-quest.md](awakening-quest.md) (Englisch). Ticket: cs24-sopr/project#106.

## Inhalt

1. [Überblick: was du tust](#1-überblick-was-du-tust)
2. [Was in der Map gebaut sein muss](#2-was-in-der-map-gebaut-sein-muss)
3. [Koordinaten ermitteln](#3-koordinaten-ermitteln)
4. [Arbeitsblatt zum Ausfüllen](#4-arbeitsblatt-zum-ausfüllen)
5. [Kamerapfad festlegen](#5-kamerapfad-festlegen)
6. [In den Code eintragen](#6-in-den-code-eintragen)
7. [Professor und Weltspawn einrichten](#7-professor-und-weltspawn-einrichten)
8. [Testaufbau entfernen](#8-testaufbau-entfernen)
9. [Testen](#9-testen)
10. [Map sauber ausliefern](#10-map-sauber-ausliefern)
11. [Wenn etwas nicht klappt](#11-wenn-etwas-nicht-klappt)
12. [Was noch Platzhalter ist](#12-was-noch-platzhalter-ist)

---

## 1. Überblick: was du tust

1. Alles bauen, was die Quest braucht (Abschnitt 2).
2. Die Koordinaten ermitteln und in das Arbeitsblatt eintragen (Abschnitte 3 und 4).
3. Den Kamerapfad abfliegen und notieren (Abschnitt 5).
4. Die Werte in **eine Datei** im Code eintragen (Abschnitt 6).
5. Den Professor mit einem Tag versehen, den Weltspawn setzen (Abschnitt 7).
6. Den Testaufbau aus dem Code entfernen (Abschnitt 8).
7. Alles im Spiel durchspielen (Abschnitt 9) und die Map sauber ausliefern (Abschnitt 10).

Der Ablauf der Quest, damit du weißt, was die Spieler erleben:

| Schritt | Spieler |
| --- | --- |
| 1 | Wacht im Bett auf. Ein Wecker (Notenblock) klingelt. Ihn auszuschalten ist optional. |
| 2 | Geht zum Fenster. Eine **Kamerafahrt** um die Hochschule startet (nicht überspringbar, mit Musik), am Ende erscheint der Hochschulname. |
| 3 | Durchsucht die **Truhe** im Zimmer: Rucksack, Brot, Äpfel. |
| 4 | Verlässt das Gebäude und tritt auf das **Portal**. Es teleportiert vor das Tor der Hochschulinsel. Dort startet die Nebenquest „Gelände erkunden“ (wird separat gebaut). |
| 5 | Spricht vor dem Haupteingang den **Professor** an. Die Quest ist beendet. |

Vor Schritt 4 lässt sich das Startgebäude nicht verlassen. Wer es versucht, wird zurück in den Raum gesetzt.

---

## 2. Was in der Map gebaut sein muss

| Was | Anforderungen |
| --- | --- |
| **Startgebäude** | Mit einem Zimmer, in dem man aufwacht. Das Gebäude hat einen Ausgang, und die Kamera muss durch Fenster und Ausgang fliegen können (die Kamera ignoriert Wände, aber es sieht besser aus, wenn die Wege frei sind). Das Gebäude hat das Bauteam bereits als eigenes Ticket. |
| **Bett** | Hier wacht der Spieler auf. Der Weltspawn kommt direkt daneben (Abschnitt 7). |
| **Wecker** | Ein **Notenblock** im Zimmer, in Reichweite des Betts. Der Spieler schaltet ihn per Rechtsklick aus. Das Klingeln selbst erzeugt das Skript, der Block muss nichts können. |
| **Fenster** | Ein Fenster, aus dem man auf die Hochschule blickt. Davor ein kleiner Standplatz: Wer dort steht, löst die Kamerafahrt aus. |
| **Truhe** | Im Zimmer. Sie wird nie geöffnet; das Skript verteilt die Items direkt beim Rechtsklick. Es darf auch ein anderer Block sein (Fass, Kiste, …), nur eben ein solcher, auf den man klicken kann. Sie darf **leer** sein. |
| **Portal** | Vor dem Gebäude, **außerhalb** davon. Eine Fläche, auf die der Spieler tritt (vorgeschlagen: ein Zaubertisch auf einer Platte). Was genau gebaut wird, entscheidet ihr. Das Skript braucht nur den Bereich. |
| **Ziel des Portals** | Ein Punkt vor dem Tor der Hochschulinsel, mit Blick aufs Tor. |
| **Tor / Haupteingang** | Auf der Insel. Davor steht der Professor. |
| **Professor** | Ein NPC. Welche Figur, ist egal; sie bekommt nur einen Tag (Abschnitt 7). Noch gibt es keinen „chaotischen Professor“, ein vorhandener NPC reicht als Platzhalter. |

Hinweise:

- **Abenteuermodus:** Die Map läuft im Abenteuermodus. Der Spieler kann also nichts abbauen, aber Rechtsklicks auf Truhe, Notenblock und NPC funktionieren. Prüf das trotzdem (Abschnitt 9).
- **Eine Dimension:** Alle Orte müssen in derselben Dimension liegen (normalerweise die Oberwelt).
- **Der Ausgang muss ins Freie führen**, und das Portal darf **nicht** im Gebäudebereich liegen (sonst wird der Spieler daran gehindert, es zu betreten, siehe Abschnitt 4).

---

## 3. Koordinaten ermitteln

1. Im Spiel: Einstellungen → „Koordinaten anzeigen“ einschalten. Oben links siehst du dann `Position: x, y, z`.
2. **Blockkoordinaten** (für Blöcke und Bereiche): Stell dich **in den Block** bzw. blick ihn an und lies die Zahlen. Nachkommastellen werden abgerundet: `12.7 / 64 / 20.3` ist der Block `12 / 64 / 20`. Bei negativen Zahlen wird ebenfalls **abgerundet**, also in Richtung der kleineren Zahl: `-3.2` ist der Block `-4`.
3. **Standpositionen** (wo ein Spieler steht): Nimm die Mitte des Blocks, also `.5` bei x und z, z. B. `10.5 / 64 / 20.5`. Die Höhe `y` ist die Höhe des **Bodens**, auf dem er steht (bei Blöcken: die Oberkante), nicht die Augenhöhe.
4. **Kamerapositionen**: hier ist `y` die **Augenhöhe der Kamera**, kein Boden. Die genaue Anleitung steht in Abschnitt 5.
5. **Bereiche** werden durch **zwei gegenüberliegende Eckblöcke** angegeben. Beide Ecken gehören zum Bereich, die Reihenfolge ist egal.

Tipp: Bereiche **großzügig in der Höhe** wählen (mindestens 3 Blöcke über dem Boden), damit Springen nicht als „raus aus dem Bereich“ zählt.

Das Skript arbeitet immer mit den Zahlen, die das Spiel anzeigt. Du musst nichts umrechnen.

---

## 4. Arbeitsblatt zum Ausfüllen

Trag alles hier ein, bevor du den Code anfasst. Die Spalte „Art“ sagt, wie du die Zahlen holst (siehe Abschnitt 3).

| Feld | Art | Was gemeint ist | Dein Wert |
| --- | --- | --- | --- |
| `dimension` | Text | Meist `"minecraft:overworld"`. Nur nötig, wenn es eine andere Dimension ist. | |
| `wake` | Standposition | Neben dem Bett, wo der Spieler aufwacht. Wird nur von `/scriptevent dhsn:quest_awakening_start` benutzt (Neustart zum Testen). In der Map wacht der Spieler am Weltspawn auf. | `x:  y:  z:` |
| `wakeFacing` | Punkt | Ein Punkt, zu dem der Spieler beim Aufwachen blickt, z. B. das Fenster. Wird auch benutzt, wenn der Spieler zurück ins Gebäude gesetzt wird. | `x:  y:  z:` |
| `alarm` | Block | Der Notenblock. | `x:  y:  z:` |
| `window` | Bereich | Der Standplatz vor dem Fenster. Klein halten, 1 bis 2 Blöcke tief und 2 bis 3 Blöcke breit, mit etwas Höhe. | `from:  to:` |
| `chest` | Block | Die Truhe. | `x:  y:  z:` |
| `building` | Bereich | Das **ganze** Startgebäude, vom Boden bis über das Dach. Schwelle und Ausgang gehören noch dazu, der Vorplatz nicht. | `from:  to:` |
| `buildingReturn` | Standposition | Wohin ein Spieler gesetzt wird, der das Gebäude zu früh verlassen hat. **Im** Gebäude, nahe am Ausgang. | `x:  y:  z:` |
| `portal` | Bereich | Die Fläche, auf die der Spieler tritt. **Außerhalb** von `building`, Höhe etwas großzügig. | `from:  to:` |
| `islandGate` | Standposition | Wohin das Portal teleportiert: vor dem Tor der Insel. | `x:  y:  z:` |
| `islandFacing` | Punkt | Punkt, zu dem der Spieler nach der Teleportation blickt, z. B. das Tor. | `x:  y:  z:` |
| `cameraPath` | Liste | Siehe Abschnitt 5. | |

Prüf diese Regeln, bevor du weitermachst:

- `portal` und `building` dürfen sich **nicht überlappen**.
- `window` liegt **im** Gebäude (also innerhalb von `building`).
- `chest`, `alarm` und `buildingReturn` liegen im Gebäude.
- `islandGate` liegt **nicht** im Bereich `building` oder `portal`, sonst wird der Spieler nach der Teleportation gleich wieder zurückgesetzt oder ein zweites Mal teleportiert.
- Alle Koordinaten sind Zahlen, keine Texte, ohne Einheiten.

---

## 5. Kamerapfad festlegen

Die Kamerafahrt besteht aus einer Liste von **Einstellungen („Shots“)**. Die Kamera fliegt der Reihe nach zu jedem Punkt und schaut dabei auf einen festgelegten Zielpunkt.

Pro Shot brauchst du:

| Feld | Bedeutung |
| --- | --- |
| `location` | Wo die Kamera am **Ende** des Shots ist. `y` ist die Höhe der **Kamera** (nicht des Bodens). |
| `facing` | Der Punkt, den die Kamera ansieht, während sie fliegt und am Ende. Das ist ein Punkt in der Welt, keine Richtung. |
| `seconds` | Wie lange der Flug zu diesem Punkt dauert. **Der erste Shot hat immer `0`** (Startpunkt). |
| `ease` | Optional. Weicher Anfang und Ende des Flugs sind Standard. Nur ändern, wenn nötig. |
| `sound` | Optional. Ein Sound-Name, der beim Start des Shots spielt, z. B. `"mob.phantom.swoop"` für ein Rauschen. |

### Vorgehen

1. **Storyboard.** Der Vorschlag aus dem Ticket: einmal um das Gebäude, seitlich durchs Fenster, den Gang entlang, die Treppe hinunter, aus dem Haupteingang, dann eine Drehung, die die Hochschule noch einmal ganz zeigt. Zeichne ihn als Skizze.
2. **Punkte sammeln.** Flieg im Creative-Modus an jeden Punkt und lies die Koordinaten ab (Abschnitt 3). Notiere zu jedem Punkt auch, **was die Kamera ansehen soll**, und lies auch diesen Punkt ab (das wird `facing`).
3. **Erster Shot:** die Augen des Spielers am Fenster, der Blick nach draußen. Er ist der Startpunkt (`seconds: 0`).
4. **Zeiten schätzen.** Etwa 3 bis 4 Sekunden pro Teilstrecke. Die ganze Fahrt sollte so lang sein wie die Musik, die sie begleitet (Abschnitt 12).
5. **Eintragen und abspielen** (Abschnitt 6), dann mit `/scriptevent dhsn:quest_awakening_ride` ansehen. Dieser Befehl spielt **nur** die Fahrt und verändert nichts am Quest-Stand. Zeit, Punkte und Blickziel so lange anpassen, bis es gut aussieht.

Faustregeln:

- Je weiter die Strecke, desto länger der Shot, sonst wirkt die Fahrt hektisch.
- Beim Durchflug durch Fenster und Tür **gerade** und **langsam** (2 bis 3 Sekunden) fliegen.
- Die Kamera darf durch Wände fliegen, ohne etwas zu beschädigen.
- Wenn der Blickpunkt sich zwischen zwei Shots stark ändert, dreht sich die Kamera schnell. Das nutzt man für die Schluss-Drehung, vermeidet es aber sonst.

---

## 6. In den Code eintragen

Alles steht in **einer Datei**: `behavior_pack/scripts/quests/awakening-quest.js`. Such oben nach `const LAYOUT = undefined;`. Davor steht ein auskommentiertes Beispiel.

1. Die Zeile
   ```js
   const LAYOUT = undefined;
   ```
   ersetzt du durch das Folgende, mit **deinen** Zahlen aus dem Arbeitsblatt (die hier sind nur ein Beispiel):

   ```js
   const LAYOUT = {
       wake: { x: 10.5, y: 64, z: 20.5 },
       wakeFacing: { x: 14, y: 65, z: 20 },
       alarm: { x: 12, y: 64, z: 22 },
       window: { from: { x: 13, y: 64, z: 19 }, to: { x: 15, y: 66, z: 20 } },
       chest: { x: 8, y: 64, z: 25 },
       building: { from: { x: 0, y: 63, z: 10 }, to: { x: 20, y: 80, z: 30 } },
       buildingReturn: { x: 10.5, y: 64, z: 15.5 },
       portal: { from: { x: 25, y: 64, z: 14 }, to: { x: 27, y: 66, z: 16 } },
       islandGate: { x: 200.5, y: 70, z: 40.5 },
       islandFacing: { x: 200, y: 71, z: 50 },
       cameraPath: [
           { location: { x: 14, y: 65.6, z: 19.4 }, facing: { x: 14, y: 65.6, z: 5 }, seconds: 0 },
           { location: { x: 14, y: 70, z: 0 }, facing: { x: 10, y: 66, z: 20 }, seconds: 3 },
           // ... weitere Shots
       ],
   };
   ```

2. **Auf die Syntax achten**, denn ein Tippfehler legt die ganze Quest still (der Fehler steht dann im Content-Log, Abschnitt 11):
   - Hinter jedem Eintrag steht ein **Komma**, auch hinter dem letzten.
   - Jede öffnende Klammer `{` `[` `(` hat eine schließende.
   - Zahlen ohne Anführungszeichen, Dezimalzahlen mit **Punkt** (`65.6`, nicht `65,6`).
   - Texte (`"minecraft:overworld"`) in Anführungszeichen.
   - Nur Feldnamen, die in der Tabelle stehen, und genau so geschrieben (Groß-/Kleinschreibung).
3. `dimension` brauchst du nur, wenn es nicht die Oberwelt ist: `dimension: "minecraft:overworld",` als erste Zeile in `LAYOUT`.
4. Speichern. Im Spiel `/reload` ausführen oder die Welt neu betreten.

Die Einstellungen darunter in der Datei (`AUTO_START`, Sounds, Truhen-Inhalt, Texte) sind schon sinnvoll belegt. Du musst nichts daran ändern. Was davon noch Platzhalter ist, steht in Abschnitt 12.

---

## 7. Professor und Weltspawn einrichten

### Professor taggen

Der NPC vor dem Tor ist der Professor, wenn er den Tag `dhsn:awakening_professor` trägt. Stell dich im Spiel direkt neben ihn und führe aus (ersetze `<Entity-ID>` durch die ID der Figur, z. B. `dhsn:studienorganisation`):

```text
/tag @e[type=<Entity-ID>,r=5] add dhsn:awakening_professor
```

Prüfen: `/tag @e[type=<Entity-ID>,r=5] list` (zeigt die Tags) oder, ob der NPC beim Rechtsklick **nicht** das normale NPC-Fenster öffnet, sondern den Dialog „Chaotischer Professor“. Achtung: Steht in 5 Blöcken Umkreis ein zweiter NPC derselben Art, bekommt er den Tag ebenfalls. Dann `r=2` und näher herangehen.

### Weltspawn

Der Spieler wacht **am Weltspawn** auf, die Quest versetzt ihn beim ersten Beitreten nicht. Setz den Spawn direkt neben das Bett:

```text
/setworldspawn <x> <y> <z>
```

Wähle dafür dieselben Koordinaten wie `wake` (Bodenhöhe, Mitte des Blocks). Und: Die Quest startet automatisch, wenn ein Spieler **zum ersten Mal** der Welt beitritt (`AUTO_START`). Ein Spieler, der bereits einen Quest-Stand hat, wacht nicht neu auf.

---

## 8. Testaufbau entfernen

Der Testaufbau (`/scriptevent dhsn:quest_test_awakening`) ist **nicht** Teil der Map. Er baut ein Testgebäude und einen Testpfad und würde die echten Werte überschreiben.

1. Datei löschen: `behavior_pack/scripts/events/test-awakening.js`.
2. In `behavior_pack/scripts/main.js` die Zeile löschen:
   ```js
   import "./events/test-awakening.js"; // test setup for the awakening quest, NOT part of the real map
   ```
3. Optional die Datei `docs/events/test-awakening.md` und ihre Erwähnung in `docs/Events.md` löschen.
4. **Wichtig:** In jeder Welt, in der der Test **jemals** gelaufen ist (also auch in deiner Test-Map!), steht das Test-Layout in der Welt gespeichert und hat **Vorrang** vor `LAYOUT`. Dort **einmal** ausführen:

   ```text
   /scriptevent dhsn:quest_test_awakening_clear
   ```

   Das löscht das gespeicherte Test-Layout. Die gebauten Test-Blöcke bleiben stehen und müssen von Hand entfernt werden. Danach gilt dein `LAYOUT`.

Wenn du die Datei gelöscht hast, funktioniert dieser Befehl nicht mehr. Führ ihn deshalb **vor** dem Löschen aus oder lösch `test-awakening.js` erst, nachdem er einmal gelaufen ist. (Der Befehl selbst steckt in `awakening-quest.js` und bleibt erhalten.)

---

## 9. Testen

Teste im **Abenteuermodus** und mit eingeschaltetem **Content-Log** (Einstellungen → Creator), dort erscheinen Fehlermeldungen des Skripts. Zum Zurücksetzen zwischen den Läufen:

```text
/scriptevent dhsn:quest_reset_awakening
/scriptevent dhsn:quest_awakening_start
```

Der zweite Befehl setzt dich an die Stelle `wake` und startet die Quest von vorn.

**Checkliste (alles der Reihe nach durchspielen):**

| # | Prüfen | Erwartung |
| --- | --- | --- |
| 1 | Im Bett aufwachen (neue Welt oder `quest_awakening_start`) | Bildschirm ist kurz schwarz, der Wecker klingelt, im Chat erscheint der Weckertext, das Questlog zeigt „Wecker ausschalten (optional)“ und „Aus dem Fenster blicken“. |
| 2 | Rechtsklick auf den Notenblock | Das Klingeln stoppt, die Zeile wird grün. Der Block ändert **nicht** die Tonhöhe. |
| 3 | Versuch, das Gebäude zu verlassen | Der Spieler wird zurück an `buildingReturn` gesetzt, mit einem Hinweis im Chat. |
| 4 | Rechtsklick auf die Truhe vor der Kamerafahrt | Hinweis „Die Truhe läuft nicht weg …“, nichts wird verteilt. |
| 5 | Zum Fenster gehen | Die Kamerafahrt startet: Musik, Spieler kann sich nicht bewegen, Kamera fliegt den Pfad, am Ende der Hochschulname als Titel, Bild blendet kurz ab, Spieler kann sich wieder bewegen. |
| 6 | Den Pfad prüfen | Wirkt die Fahrt gut? Zu schnell, zu langsam, Kamera zeigt etwas Falsches? Dann Abschnitt 5 wiederholen. |
| 7 | Truhe durchsuchen | Bündel, Brot, Äpfel im Inventar, Chat-Meldung. Ein zweiter Rechtsklick: „Die Truhe ist leer.“ |
| 8 | Gebäude verlassen | Jetzt geht es. |
| 9 | Auf das Portal treten | Bildschirm blendet aus, der Spieler steht vor dem Tor der Insel und blickt zum Tor, im Chat „Neue Nebenquest: Gelände erkunden“. |
| 10 | Professor ansprechen | Dialog (nicht das normale NPC-Fenster), nach dem Schließen: Questlog-Eintrag weg, im Chat „Quest abgeschlossen: Das Erwachen (<Name>)“. |

**Abkürzungen zum Testen einzelner Teile:**

| Befehl | Wirkung |
| --- | --- |
| `/scriptevent dhsn:quest_awakening_ride` | Spielt nur die Kamerafahrt (verändert den Stand nicht). |
| `/scriptevent dhsn:quest_awakening_step portal` | Springt direkt zum Schritt (`wake`, `chest`, `portal`, `professor`, `done`), z. B. um nur das Portal zu testen. |
| `/scriptevent dhsn:quest_awakening_state` | Zeigt im Chat den aktuellen Schritt und das benutzte Layout. |
| `/scriptevent dhsn:quest_reset_awakening` | Setzt den eigenen Stand zurück. |

Alle Befehle brauchen Cheats.

Mehr Gegenproben (Beitreten während der Kamerafahrt, `/reload`, Neustart) stehen in [awakening-quest.md](awakening-quest.md#testing).

---

## 10. Map sauber ausliefern

Der Quest-Stand und das Test-Layout werden **in der Map-Datei gespeichert**. Eine Map, in der getestet wurde, enthält also den Stand des Testers. Vor der Auslieferung:

1. Den eigenen Stand zurücksetzen:
   ```text
   /scriptevent dhsn:quest_reset_awakening
   ```
2. Sicherstellen, dass kein Test-Layout mehr gespeichert ist (Abschnitt 8, Punkt 4, `quest_test_awakening_clear`).
3. Den Weltspawn prüfen (Abschnitt 7).
4. Wenn möglich, die Map in einer **frischen Kopie** als neuer Spieler öffnen und die Quest einmal durchspielen: Wacht man im Bett auf, klingelt der Wecker, geht alles bis zum Professor?
5. Den Gamemode der Map prüfen (Abenteuermodus) und dass die Packs aktiv sind (DHSN Behavior Pack und Resource Pack).

Ein Spieler, der einen Stand hat (auch den eines Testers, der das Questlog noch offen hatte), startet nicht neu. In der Auslieferung darf also kein Stand mit drinstehen.

---

## 11. Wenn etwas nicht klappt

**Zuerst:** Content-Log einschalten (Einstellungen → Creator → Content-Log einschalten), dort stehen Skriptfehler.

| Problem | Wahrscheinliche Ursache |
| --- | --- |
| Nichts passiert, die Quest startet nicht | `LAYOUT` ist noch `undefined`, oder ein Tippfehler in der Datei (Komma, Klammer). Im Content-Log nachsehen. Mit `/scriptevent dhsn:quest_awakening_state` prüfen, ob ein Layout gesetzt ist. |
| Es gelten die Testwerte, nicht meine | Ein Test-Layout ist in der Welt gespeichert und hat Vorrang. `/scriptevent dhsn:quest_test_awakening_clear` (nur möglich, solange `test-awakening.js` existiert oder der Befehl im Quest-Code vorhanden ist; er ist im Quest-Code) und danach `/reload`. |
| Man wacht an der falschen Stelle auf | Weltspawn nicht gesetzt (Abschnitt 7). |
| Der Wecker klingelt nicht | Kein Layout, oder `alarm` stimmt nicht mit der Position des Blocks überein. Das Klingeln wird an dieser Position erzeugt. Ein Beispiel, bei dem man ihn nicht hört: Der Spieler ist weit weg. |
| Rechtsklick auf Notenblock oder Truhe tut nichts | Die Koordinate `alarm` bzw. `chest` ist um einen Block verschoben. Die Position muss **genau** der Block sein, auf den man klickt. |
| Die Kamerafahrt startet nicht | `window` ist zu klein oder liegt nicht dort, wo man steht. Den Bereich größer machen, mit mehr Höhe. Der Spieler muss ihn **betreten**, d. h. vorher draußen gewesen sein. |
| Die Kamerafahrt zeigt etwas Falsches | `facing` ist ein **Punkt**, keine Richtung. Der Punkt ist falsch, oder die Höhe `y` der Kamera ist als Bodenhöhe eingetragen. |
| Man kann das Gebäude trotz fertiger Schritte nicht verlassen | Der Bereich `building` ist zu groß und enthält den Vorplatz. |
| Man wird beim Verlassen nicht zurückgesetzt | `building` ist zu klein und enthält den Ausgang schon nicht. Die Schwelle muss noch drin sein. |
| Das Portal tut nichts | `portal` liegt im Gebäude, ist zu klein, oder der Spieler ist noch nicht im Schritt „Portal“ (Truhe vergessen). Mit `quest_awakening_state` prüfen. |
| Nach der Teleportation wird man gleich wieder zurückgesetzt | `islandGate` liegt im Bereich `building`. |
| Ein Rechtsklick auf den Professor öffnet das normale NPC-Fenster | Der Tag fehlt oder ist falsch geschrieben (Abschnitt 7). |
| Nach der Kamerafahrt kann man sich nicht bewegen oder die HUD fehlt | Die Welt neu betreten. Das Skript stellt beides dann wieder her. |
| Musik ist nicht zu hören | Ressourcen werden gecacht: Welt verlassen und neu betreten, ggf. Minecraft neu starten. Mit `/playsound dhsn.intro_music @s` prüfen, ob der Sound selbst funktioniert. |

Wenn du nicht weiterkommst, wende dich an das Entwickler-Team.

---

## 12. Was noch Platzhalter ist

Das gehört nicht zu deiner Aufgabe, solltest du aber wissen. Es wird vom Story- bzw. Quest-Team ersetzt:

- **Dialogtexte** (Wecker, Truhe, Professor, Hinweise) und der Titel mit dem **Hochschulnamen** (`Duale Hochschule Sachsen` ist geraten).
- **Rucksack:** Die Truhe gibt ein Bündel (`minecraft:bundle`).
- **Professor:** Ein vorhandener NPC reicht, bis es den „chaotischen Professor“ gibt.
- **Musik:** Der Titel „Epic“ von The_Mountain von [Pixabay](https://pixabay.com/music/epic-classical-epic-508009/). Der Titel ist länger als die Fahrt im Test und wird am Ende der Fahrt abgeschnitten. Wenn die echte Fahrt fertig ist, sollte die Länge der Musik dazu passen. Die Lizenzbedingungen sind noch zu prüfen, bevor die Map veröffentlicht wird.
- **Nebenquest „Gelände erkunden“** und **Folgequest:** Sie werden separat gebaut. Die Quest hat dafür zwei leere Stellen (`startExploreCampusQuest`, `onQuestFinished`).
