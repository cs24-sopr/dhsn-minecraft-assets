# Speicherung in der Welt

Dateien: [util/storage.js](../behavior_pack/scripts/util/storage.js) · [util/command-coordinates.js](../behavior_pack/scripts/util/command-coordinates.js)

Alles, was das Add-on sich merkt, liegt **in der Welt (Map)** als World-Dynamic-Property mit dem Präfix `dhsn:`. Es übersteht `/reload`, Neustarts und das Verlassen der Welt und steckt in der Map-Datei.

## Regel: einmal pro Welt, ohne Spieler-ID

Das Spiel ist **Einzelspieler**. Quest-Fortschritt wird deshalb **einmal pro Welt** gespeichert, ohne Spieler-ID im Schlüssel, z. B. `dhsn:quest_library`. So macht es auch Operation Erstsemester (`dhsn:operation_freshman_…`).

Frühere Versionen speicherten pro Spieler (`dhsn:quest_library:<Spieler-ID>`). `takeOverPerPlayerValue(key)` übernimmt solche Werte beim ersten Lesen unter den neuen Schlüssel und löscht die alten. Schlägt das Schreiben fehl, versucht es der nächste Lesezugriff erneut. Werte, die zur Map gehören, aber nicht auf `_map_layout` enden, meldet eine Quest mit `keepOnCleanup(key)` an, damit `dhsn:map_cleanup` sie behält.

```js
import { takeOverPerPlayerValue } from "../util/storage.js";

const raw = takeOverPerPlayerValue("dhsn:quest_meine_quest"); // alter Wert wird übernommen, falls vorhanden
```

## Was gespeichert wird

| Art | Beispiele | Bei `dhsn:map_cleanup` |
| --- | --- | --- |
| Quest-Fortschritt | `dhsn:quest_library`, `dhsn:ects`, `dhsn:quest_schaltalgebra` | gelöscht |
| Redstone-Block unter der Schaltalgebra-Lampe: Ort und ursprünglicher Block | `dhsn:schaltalgebra_lamp_power` | **bleibt** (gehört zur Map, per `keepOnCleanup`) |
| Zustand der Map-Welt | `dhsn:library_highscores`, `dhsn:shelf_contents:…` | gelöscht |
| Testaufbauten | `dhsn:library_test_area`, `dhsn:library_test_sign`, `dhsn:schaltalgebra_test_layout`, `dhsn:schaltalgebra_test_substitute` | gelöscht |
| Einstellungen der fertigen Map | `dhsn:library_map_layout`, `dhsn:schaltalgebra_map_layout` (per Befehlsblock gesetzt) | **bleibt** |

Weitere Quests ergänzen hier ihre Schlüssel (ECTS, Schaltalgebra, …).

## Befehle

| Befehl | Wirkung |
| --- | --- |
| `/scriptevent dhsn:progress` | Listet alles, was in dieser Welt gespeichert ist. Regal-Zähler werden nur gezählt. |
| `/scriptevent dhsn:map_cleanup confirm` | Löscht **allen Fortschritt und alle Testdaten** dieser Welt. Nur die Map-Einstellungen (`…_map_layout`) bleiben. Ohne `confirm` passiert nichts, es kommt nur eine Erklärung. |

### Vor dem Ausliefern der Map

Wer in der Map-Welt testet, hinterlässt dort Fortschritt, Bestzeiten, Regal-Zähler und Testaufbauten. **Testaufbauten haben Vorrang vor den Map-Einstellungen** und würden z. B. die echte Bibliothek außer Kraft setzen. Deshalb vor dem Ausliefern:

1. `/scriptevent dhsn:progress`: prüfen, was gespeichert ist.
2. `/scriptevent dhsn:map_cleanup confirm`
3. Welt verlassen und neu betreten, damit Questlog und Anzeigen frisch starten.
4. `/scriptevent dhsn:progress`: Es sollten nur noch die `…_map_layout`-Werte übrig sein.

Gebaute Blöcke (z. B. Testaufbauten in der Welt) entfernt der Befehl nicht.

## Koordinaten in Befehlen

Befehle für die fertige Map (z. B. `/scriptevent dhsn:library_set`) nehmen Koordinaten wie normale Minecraft-Befehle: absolut oder mit `~` relativ zum Befehlsblock. Minecraft löst `~` in `/scriptevent`-Nachrichten nicht selbst auf; das übernimmt `parseCoordinates` aus `util/command-coordinates.js`.
