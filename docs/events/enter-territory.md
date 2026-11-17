# Raum betreten – `onEnterTerritory`

Datei: [enter-territory.js](../../behavior_pack/scripts/events/enter-territory.js) · [Übersicht](../Events.md)

Löst aus, wenn ein Spieler einen Bereich betritt, z. B. einen Raum, einen Flur oder eine Stelle vor einer Tür. Optional kann auch das Verlassen gemeldet werden.

## Optionen

| Option      | Pflicht | Standard      | Bedeutung                                                                      |
| ----------- | ------- | ------------- | ------------------------------------------------------------------------------ |
| `from`      | ja      | –             | Erster Eckblock des Bereichs.                                                  |
| `to`        | ja      | –             | Gegenüberliegender Eckblock. Beide Ecken gehören zum Bereich.                  |
| `onLeave`   | nein    | –             | Funktion, die beim Verlassen aufgerufen wird. Bekommt dasselbe `{ player }`.   |
| `interval`  | nein    | `5`           | Prüfabstand in Ticks (20 Ticks = 1 Sekunde).                                   |
| `dimension` | nein    | `"overworld"` | Dimension.                                                                     |

Geprüft wird der Block, in dem die Füße des Spielers stehen. Ein Raum sollte also vom Boden-Block **über** dem Fußboden bis unter die Decke reichen.

**Bestimmte Stelle statt Raum:** `from` und `to` auf denselben Block setzen.

## Callback

| Feld     | Inhalt                                |
| -------- | ------------------------------------- |
| `player` | Der Spieler, der den Bereich betritt. |

## Verhalten

- Pro Spieler einmal beim Betreten. Erneut erst, nachdem er den Bereich verlassen hat.
- Wer beim Registrieren schon im Bereich steht, löst bei der ersten Prüfung aus.
- Spieler in einer anderen Dimension zählen nicht als im Bereich.

## Beispiele

```js
import { onEnterTerritory } from "./events/index.js";

// Die Mensa finden.
const stop = onEnterTerritory(
    { from: { x: -40, y: 64, z: 80 }, to: { x: -20, y: 69, z: 100 } },
    ({ player }) => {
        player.sendMessage("Willkommen in der Mensa!");
        stop();
    }
);

// Betreten und Verlassen der Bibliothek melden.
onEnterTerritory(
    {
        from: { x: 100, y: 64, z: 40 },
        to: { x: 120, y: 70, z: 60 },
        onLeave: ({ player }) => player.sendMessage("Bis zum nächsten Mal!"),
    },
    ({ player }) => player.sendMessage("Pssst, Bibliothek!")
);
```

## Umsetzung

Es gibt kein Event für Positionen. Alle Spieler werden alle `interval` Ticks gegen den Bereich geprüft. Wer sehr schnell durch einen sehr schmalen Bereich läuft, kann ihn zwischen zwei Prüfungen überspringen. Dann den Bereich größer oder `interval` kleiner machen.

## Test

Im [Testparcours](test.md) wird ab 6 Blöcken östlich (+X) des Spielers eine 5×5 große grüne Fläche in den Boden gesetzt. Der Bereich reicht 3 Blöcke über die Fläche.

1. Auf die grüne Fläche laufen. Im Chat erscheint:

   ```text
   Ereignis ist eingetreten: Grünen Bereich betreten (<Name> hat den grünen Bereich betreten)
   ```

2. Die Fläche verlassen. Im Chat erscheint `<Name> hat den grünen Bereich verlassen`.
3. Erneut betreten: Die Betreten-Meldung kommt wieder.

Gegenprobe: Auf der grünen Fläche herumlaufen löst keine weiteren Meldungen aus.
