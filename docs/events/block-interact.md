# Block anklicken – `onBlockInteract`

Datei: [block-interact.js](../../behavior_pack/scripts/events/block-interact.js) · [Übersicht](../Events.md)

Löst aus, wenn ein Spieler einen passenden Block mit Rechtsklick benutzt, z. B. eine Truhe, einen Notenblock oder einen Knopf. Auf Wunsch wird die normale Reaktion des Blocks unterdrückt, die Truhe geht dann also nicht auf.

## Optionen

| Option      | Pflicht | Standard      | Bedeutung                                                                                                   |
| ----------- | ------- | ------------- | ----------------------------------------------------------------------------------------------------------- |
| `blockType` | nein    | jeder Block   | Block-ID(s), die zählen, z. B. `"minecraft:chest"`.                                                          |
| `location`  | nein    | überall       | Nur dieser eine Block zählt.                                                                                 |
| `dimension` | nein    | `"overworld"` | Dimension.                                                                                                   |
| `cancel`    | nein    | `false`       | `true`: Die normale Reaktion des Blocks (Truhe öffnet sich, Notenblock ändert die Tonhöhe, …) wird unterdrückt. |

Fehlen `blockType` und `location`, zählt jeder angeklickte Block.

## Callback

| Feld     | Inhalt                            |
| -------- | --------------------------------- |
| `player` | Der Spieler, der geklickt hat.    |
| `block`  | Der angeklickte Block.            |

## Beispiele

```js
import { onBlockInteract } from "./events/index.js";

// Die Truhe im Zimmer nicht öffnen, sondern stattdessen etwas verteilen.
const stop = onBlockInteract(
    { blockType: "minecraft:chest", location: { x: 10, y: 64, z: 5 }, cancel: true },
    ({ player }) => {
        player.sendMessage("Du findest einen Rucksack!");
        stop();
    }
);
```

## Umsetzung

Nutzt `world.beforeEvents.playerInteractWithBlock`, denn nur dort lässt sich die Reaktion des Blocks mit `event.cancel` verhindern. Der Callback läuft eine Tick später (`system.run`), weil Before-Events die Welt nicht verändern dürfen. Das Spiel schickt das Ereignis pro Klick mehrfach (pro Hand, und wiederholt, solange die Taste gehalten wird); gezählt wird nur das erste (`isFirstEvent`). `cancel` gilt dagegen für alle.

Die Blöcke der Bibliothek (`custom_bookshelf.js`, `shelf-contents.js`) haben ihre eigene Logik und nutzen diesen Baustein nicht.

## Test

Die Bausteine werden von [Das Erwachen](../quests/awakening-quest.md) benutzt (Wecker ausschalten, Truhe durchsuchen). Dort steht, wie man es ausprobiert: `/scriptevent dhsn:quest_test_awakening`.
