# ECTS als XP

Datei: [ects.js](../behavior_pack/scripts/ects.js) · Anzeige: [hud_screen.json](../resource_pack/ui/hud_screen.json) · Issue: `project#121` (Repo `cs24-sopr/project`)

Studierende sammeln im Spiel **ECTS**, höchstens **180** im ganzen Spiel. Quests vergeben sie beim Abschluss. Der Stand wird an der XP-Leiste angezeigt, dazu ein Titel je nach Studienfortschritt.

## Grundidee: 1 ECTS = 1 Level

Die ECTS werden **direkt als Level** gesetzt, nicht als Erfahrungspunkte. Erfahrungspunkte pro Level steigen stark an (Level 179 → 180 braucht 1453 Punkte), und eine XP-Flasche gibt zufällig 3 bis 11 Punkte. Mit Punkten käme man nie genau auf 180.

- Die **Zahl über der XP-Leiste** ist der ECTS-Stand.
- Die Leiste selbst bleibt leer, halbe ECTS gibt es nicht.
- Es gibt **keinen ECTS-Trank**. Die ECTS kommen bei Questerfüllung per Befehl (Entscheidung zu Kriterium 4 von `project#121`).

## Speicherung

- Der echte Stand liegt **in der Welt (Map)**, als World-Dynamic-Property `dhsn:ects:<Spieler-ID>`, eine Zahl von 0 bis 180.
- Das Level ist nur die Anzeige. Ein Abgleich jede Sekunde (und beim Betreten der Welt) setzt es zurück, wenn etwas anderes es verändert hat, z. B. XP von Mobs, eine XP-Flasche, `/xp` oder der Tod. Dabei verschwinden auch Erfahrungspunkte in der Leiste.

## Titel

Angelehnt an einen Bachelor: 180 ECTS = 6 Semester zu je 30 ECTS = 3 Studienjahre zu je 60 ECTS.

| ECTS | entspricht | Titel |
| --- | --- | --- |
| 0–59 | 1. Studienjahr | Erstie |
| 60–119 | 2. Studienjahr | Fortgeschritten |
| 120–179 | 3. Studienjahr | bald fertig! |
| 180 | alles geschafft | Abschluss 😄 |

Die Grenzen stehen in `TITLES` in `ects.js`.

## Anzeige

- **Punkte:** Level-Zahl über der XP-Leiste.
- **Titel und Punkte dauerhaft:** gelbes Textfeld direkt über der XP-Leiste, z. B. `Erstie · 45 ECTS`.
- **Titelwechsel:** Der neue Titel erscheint groß in der Bildschirmmitte, darunter die ECTS, dazu der Level-up-Ton.
- **Chat (gelb):** bei jeder Vergabe `+5 ECTS (jetzt 50/180)`. Über 180 hinaus: `Du hast schon alle 180 ECTS. 3 ECTS verfallen.`
- **Questlog:** bleibt unverändert, `questlog.js` wird nicht angefasst.

### So funktioniert das Textfeld

Ein Skript kann kein eigenes Textfeld im HUD beschreiben. Der Umweg geht über den Titel-Kanal:

1. `ects.js` schickt den Text als Titel mit der Vorsilbe `ects:`, z. B. `ects:Erstie · 45 ECTS`.
2. In `hud_screen.json` merkt sich ein unsichtbares Element (`data_control`) jeden Titel mit dieser Vorsilbe. Das Label `ects_label` zeigt den gemerkten Text ohne Vorsilbe an, auch nachdem der Titel abgelaufen ist.
3. Die normale Titelanzeige in der Bildschirmmitte blendet Titel mit der Vorsilbe aus. Andere Titel, z. B. „Halt!“ aus der Bibliotheks-Quest, erscheinen wie gewohnt.
4. Gesendet wird nur nach einer Änderung und beim Betreten der Welt, weil das HUD den Text beim Neuladen der Welt vergisst.

Einstellbar in `hud_screen.json` → `ects_label`: Position (`offset`, derzeit 52 Pixel über dem unteren Rand), Farbe (`color`).

**Hinweis:** Diese Technik stammt aus dem [Bedrock-Wiki (Preserve Title Texts)](https://wiki.bedrock.dev/json-ui/preserve-title-texts). Das Ausblenden der Titel mit Vorsilbe ist aus dem Wiki-Beispiel für das Ausblenden eines bestimmten Titels abgeleitet und noch nicht im Spiel geprüft. JSON-UI ist schlecht dokumentiert, und Mojang will es langfristig ersetzen.

## Für Quests: ECTS vergeben

```js
import { addEcts } from "../ects.js";

const QUEST_ECTS = 5;

function giveQuestReward(player) {
    addEcts(player, QUEST_ECTS);
}
```

| Funktion | Bedeutung |
| --- | --- |
| `addEcts(player, amount)` | Gibt ECTS, höchstens bis 180. Schreibt die Chat-Meldung, setzt Level und Textfeld, zeigt einen neuen Titel. Gibt zurück, wie viele ECTS tatsächlich vergeben wurden. |
| `getEcts(player)` | Aktueller Stand (0, falls noch keine). |
| `setEcts(player, value)` | Setzt den Stand (0–180), für Tests. Ohne Chat-Meldung. |
| `getTitle(ects)` | Titel zu einem Stand. |
| `MAX_ECTS` | 180 |

**Nicht** mit dem Vanilla-Befehl `/xp <n>L` arbeiten: Er kennt das Limit nicht, und der Abgleich setzt das Level nach spätestens einer Sekunde zurück.

## Befehle

| Befehl | Wirkung |
| --- | --- |
| `/scriptevent dhsn:ects` | Stand und Titel im Chat |
| `/scriptevent dhsn:ects_add <n>` | `n` ECTS geben (über `addEcts`, mit Limit) |
| `/scriptevent dhsn:ects_set <n>` | Stand setzen (Test) |
| `/scriptevent dhsn:ects_reset` | Stand auf 0 (Test) |

Alle brauchen Cheats. Vom Spieler ausgeführt, gelten sie für ihn selbst. **Aus einem Befehlsblock** (ohne Spieler) gelten sie für alle Spieler in der Welt. Das Spiel ist Einzelspieler, also für den einen Spieler. Für einen bestimmten Spieler: `/execute as @p run scriptevent dhsn:ects_add 5`.

## ECTS pro Quest (Budget)

Damit man genau 180 erreicht, trägt jede Quest hier ihre ECTS ein. Die Werte legt das Story-Team fest.

| Quest | Issue | ECTS | Stand |
| --- | --- | --- | --- |
| Aushilfe in der Bibliothek | `project#91` | 5 (Platzhalter, `QUEST_ECTS` in `library-quest.js`) | angebunden; die Challenge danach gibt keine ECTS |
| Schaltalgebra | `project#173` | 10 (Platzhalter, `QUEST_ECTS` in `schaltalgebra-quest.js`) | angebunden, einmalig beim Lösen des Rätsels |
| … | | | |
| **Summe** | | **15 / 180** | |

## Testen

Testumgebung: flache Welt, Abenteuermodus, Cheats an, DHSN Behavior und Resource Pack aktiv. Die Welt nach dem Einspielen **neu betreten**, damit das HUD (`hud_screen.json`) geladen wird. `/reload` lädt nur Skripte.

| Test | Erwartung |
| --- | --- |
| `/scriptevent dhsn:ects_set 42` | Level-Zahl 42, über der XP-Leiste `Erstie · 42 ECTS` |
| `ects_set` auf 59, dann `ects_add 1` | Titel „Fortgeschritten“ groß in der Bildschirmmitte mit „60 ECTS“, Level-up-Ton, Textfeld `Fortgeschritten · 60 ECTS` |
| `ects_set` auf 0, 60, 120, 180 | Textfeld zeigt „Erstie“, „Fortgeschritten“, „bald fertig!“, „Abschluss 😄“ |
| `ects_set 175`, dann `ects_add 10` | Stand 180, Chat: 5 ECTS verfallen |
| bei 180 `ects_add 3` | Stand bleibt 180, Chat: schon alle 180 ECTS |
| XP-Flasche werfen, Mob töten, `/xp 10L @s` | Level springt nach spätestens 1 s auf den ECTS-Stand zurück |
| Welt schließen und neu öffnen | Stand unverändert, Textfeld erscheint nach ca. 2 s wieder |
| Bibliotheks-Quest abschließen | 3 Smaragde und +5 ECTS, Chat-Meldungen der Bibliothekarin und `+5 ECTS (jetzt …)` |
| Challenge der Bibliotheks-Quest abschließen | ECTS unverändert |
| In der Bibliotheks-Quest die Bibliothek verlassen | „Halt!“ mit Countdown wie bisher; das Textfeld an der XP-Leiste bleibt |
| Befehlsblock mit `scriptevent dhsn:ects_add 2` | +2 ECTS |

**Zuerst prüfen:** ob das Textfeld überhaupt erscheint und ob `ects:…` **nicht** in der Bildschirmmitte aufblitzt. Falls doch, ist das Ausblenden in `hud_screen.json` anzupassen. Die Punkte an der Level-Zahl funktionieren unabhängig davon.

## Bekannte Grenzen

- **Textfeld noch ungetestet:** Das HUD-Textfeld und das Ausblenden der `ects:`-Titel sind noch nicht im Spiel geprüft (siehe oben).
- **Titel überschreiben sich:** Kommt eine ECTS-Änderung genau während eines anderen Titels (z. B. des Countdowns „Halt!“), ersetzt der unsichtbare ECTS-Titel diesen kurz. Im normalen Spiel ist das selten.
- **Kreativmodus:** Dort gibt es keine XP-Leiste, also auch keine Level-Zahl. Das Textfeld bleibt.
- **Spieler-ID:** Der Stand hängt an `player.id`. Dass sie für denselben Spieler in derselben Welt gleich bleibt, prüft der Test „Welt schließen und neu öffnen“.
