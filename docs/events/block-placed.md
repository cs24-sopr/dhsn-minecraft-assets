# Block an bestimmtem Ort platzieren – `onBlockPlaced`

Datei: [block-placed.js](../../behavior_pack/scripts/events/block-placed.js) · [Übersicht](../Events.md)

Löst aus, wenn ein Spieler einen passenden Block an einer bestimmten Position oder in einem Bereich platziert.

## Optionen

| Option      | Pflicht | Standard      | Bedeutung                                                              |
| ----------- | ------- | ------------- | ---------------------------------------------------------------------- |
| `blockType` | nein    | jeder Block   | Block-ID(s), die zählen, z. B. `"minecraft:gold_block"`.               |
| `location`  | nein    | überall       | Der Block muss genau an dieser Position landen.                        |
| `area`      | nein    | überall       | `{ from, to }`: Der Block muss irgendwo in diesem Bereich landen.      |
| `dimension` | nein    | `"overworld"` | Dimension.                                                             |

`location` und `area` sind Alternativen. Werden beide angegeben, müssen beide passen. Fehlen beide, zählt jede Position.

## Callback

| Feld     | Inhalt                                |
| -------- | ------------------------------------- |
| `player` | Der Spieler, der den Block gesetzt hat. |
| `block`  | Der platzierte Block.                 |

## Beispiele

```js
import { onBlockPlaced } from "./events/index.js";

// Den Beamer genau an die vorgesehene Stelle im Hörsaal setzen.
const stop = onBlockPlaced(
    { blockType: "myname:projector", location: { x: 30, y: 70, z: 12 } },
    ({ player }) => {
        player.sendMessage("Beamer installiert!");
        stop();
    }
);

// Irgendeinen Stuhl irgendwo im Klassenraum aufstellen.
onBlockPlaced(
    { blockType: ["myname:red_chair", "myname:greenchair"], area: { from: { x: 0, y: 64, z: 0 }, to: { x: 10, y: 67, z: 8 } } },
    ({ player }) => player.sendMessage("Stuhl aufgestellt.")
);
```

Die Block-IDs in den Beispielen sind nur Platzhalter. Die echten IDs stehen in `behavior_pack/blocks/*.block.json` unter `identifier`.

## Umsetzung

Nutzt das Event `world.afterEvents.playerPlaceBlock`. Blöcke, die durch Befehle, Kolben oder Skripte entstehen, zählen nicht.

## Test

Im [Testparcours](test.md) liegt 4 Blöcke nördlich (−Z) des Spielers ein gelbes Betonfeld im Boden. Im Inventar sind zwei Goldblöcke.

1. Einen Goldblock **oben auf** das gelbe Feld setzen. Er landet dann auf Bodenhöhe des Spielers, genau über dem gelben Beton.
2. Im Chat erscheint:

   ```text
   Ereignis ist eingetreten: Goldblock auf das gelbe Feld setzen (<Name> hat den Goldblock gesetzt)
   ```

Gegenproben:

- Den zweiten Goldblock neben das gelbe Feld setzen: kein Ereignis.
- Einen anderen Block auf das gelbe Feld setzen: kein Ereignis.
