# Item in Hopper – `onItemInHopper`

Datei: [item-in-hopper.js](../../behavior_pack/scripts/events/item-in-hopper.js) · [Übersicht](../Events.md)

Löst aus, sobald passende Items im Trichter an einer bestimmten Position liegen. Egal ist, ob sie auf den Trichter geworfen, über sein Inventar hineingelegt oder von oben hineingeleitet wurden. Typischer Einsatz: ein Mülleimer, in den Papier geworfen werden soll.

## Optionen

| Option      | Pflicht | Standard      | Bedeutung                                                                                       |
| ----------- | ------- | ------------- | ----------------------------------------------------------------------------------------------- |
| `location`  | ja      | –             | Position des Trichters.                                                                         |
| `itemType`  | ja      | –             | Item-ID(s), die zählen, z. B. `"minecraft:paper"`.                                              |
| `amount`    | nein    | `1`           | So viele passende Items müssen insgesamt im Trichter liegen.                                    |
| `consume`   | nein    | `false`       | `true` löscht die passenden Items nach dem Ereignis. So kann es mehrfach auslösen (Mülleimer).  |
| `interval`  | nein    | `5`           | Prüfabstand in Ticks (20 Ticks = 1 Sekunde).                                                    |
| `dimension` | nein    | `"overworld"` | Dimension des Trichters.                                                                        |

## Callback

| Feld     | Inhalt                                                                                     |
| -------- | ------------------------------------------------------------------------------------------ |
| `block`  | Der Trichter.                                                                              |
| `amount` | Anzahl der passenden Items im Trichter.                                                    |
| `player` | Nächster Spieler im Umkreis von 8 Blöcken oder `undefined`. Siehe Einschränkungen.         |

## Beispiel

```js
import { onItemInHopper } from "./events/index.js";

// Drei Blätter Papier in den Mülleimer im Hörsaal werfen.
const stop = onItemInHopper(
    { location: { x: 12, y: 64, z: -30 }, itemType: "minecraft:paper", amount: 3, consume: true },
    ({ player }) => {
        player?.sendMessage("Danke fürs Aufräumen!");
        stop();
    }
);
```

## Verhalten

- Ohne `consume` löst das Ereignis **einmal** aus, wenn die Menge erreicht wird. Erneut erst, nachdem die Items entfernt wurden und wieder neue ankommen.
- Mit `consume: true` werden die Items sofort gelöscht. Jede neue Ladung löst also wieder aus.
- Ist der Chunk nicht geladen oder steht an der Position kein Trichter, passiert nichts.

## Einschränkungen

- **Wer?** Trichter merken sich nicht, wer ein Item eingeworfen hat. `player` ist nur eine Schätzung und kann bei mehreren Spielern in der Nähe falsch sein.
- **Weitergabe:** Der Trichter sollte in keinen anderen Container (Truhe, weiterer Trichter) führen. Sonst kann er Items weitergeben, bevor sie erkannt werden. Ein Trichter, der nach unten in normalen Boden zeigt, behält seine Items.
- **Polling:** Es gibt kein Event für Trichter-Inventare. Der Trichter wird alle `interval` Ticks abgefragt.

## Test

Im [Testparcours](test.md) steht ein Trichter 4 Blöcke südlich (+Z) des Spielers, im Inventar ist Papier.

1. Papier in die Hand nehmen, vor den Trichter stellen und mit `Q` darauf werfen. Alternativ den Trichter öffnen und Papier hineinlegen.
2. Im Chat erscheint:

   ```text
   Ereignis ist eingetreten: Papier in den Trichter werfen (1x Papier, Spieler in der Nähe: <Name>)
   ```

3. Das Papier verschwindet aus dem Trichter (`consume: true`).

Gegenprobe: Ein anderes Item (z. B. einen Goldblock) hineinwerfen löst nichts aus und bleibt im Trichter liegen.
