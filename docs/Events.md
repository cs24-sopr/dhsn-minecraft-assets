# Quest-Ereignisse

Quests müssen erkennen, was Spieler tun. Dafür gibt es in [behavior_pack/scripts/events](../behavior_pack/scripts/events) einen wiederverwendbaren Baustein pro Ereignisart:

| Ereignis                           | Funktion           | Doku                                              |
| ---------------------------------- | ------------------ | ------------------------------------------------- |
| Item aufheben                      | `onItemPickup`     | [item-pickup.md](events/item-pickup.md)           |
| Item in einen Trichter (Hopper)    | `onItemInHopper`   | [item-in-hopper.md](events/item-in-hopper.md)     |
| Bestimmtes Item ins Regal stellen, optional mit Anzahl | `onItemInShelf`    | [item-in-shelf.md](events/item-in-shelf.md)       |
| Block an bestimmtem Ort platzieren | `onBlockPlaced`    | [block-placed.md](events/block-placed.md)         |
| Block mit Rechtsklick benutzen (Truhe, Notenblock, …) | `onBlockInteract` | [block-interact.md](events/block-interact.md) |
| Raum / Bereich betreten            | `onEnterTerritory` | [enter-territory.md](events/enter-territory.md)   |

Wie man alle Ereignisse im Spiel ausprobiert, steht in [Testparcours](events/test.md). Das Sortieren in die eigenen Bücherregale prüft der [Bibliotheks-Test](events/test-library.md). Eine vollständige Quest auf Basis der Bausteine ist die [Bibliotheks-Quest](quests/library-quest.md), eine weitere die Quest [Das Erwachen](quests/awakening-quest.md) mit ihrem [Testaufbau](events/test-awakening.md).

## Gemeinsames Muster

Alle Funktionen funktionieren gleich:

```js
const stop = onSomething(options, (event) => {
    // Wird bei jedem passenden Ereignis aufgerufen.
});

// Später, z. B. wenn die Quest erledigt ist:
stop();
```

1. **`options`** legt fest, worauf sich das Ereignis bezieht, z. B. welcher Bereich oder welches Item.
2. **Der Callback** wird bei jedem passenden Ereignis aufgerufen. Er bekommt ein Objekt mit Details, meistens mit dem auslösenden `player`.
3. **Der Rückgabewert** ist eine Funktion, die das Zuhören beendet. Soll eine Quest nur einmal auslösen, ruft man sie im Callback auf.

Alle Funktionen lassen sich gesammelt importieren. Der Pfad ist relativ zur Datei, die importiert; aus `behavior_pack/scripts/` heraus:

```js
import { onBlockInteract, onBlockPlaced, onEnterTerritory, onItemInHopper, onItemInShelf, onItemPickup } from "./events/index.js";
```

Außerdem exportiert `index.js` `SHELF_TYPES` (alle unterstützten Regal-Blöcke) und `getShelfCount` (aktueller Stand eines Regals), siehe [item-in-shelf.md](events/item-in-shelf.md).

## Gemeinsame Optionen

| Begriff                                | Bedeutung                                                                                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Position (`location`)                  | Blockkoordinaten `{ x, y, z }`, wie sie unter „Koordinaten anzeigen“ im Spiel erscheinen. Kommazahlen werden auf den Block abgerundet.                            |
| Bereich (`area` bzw. `from`/`to`)      | Quader zwischen zwei Eckblöcken. Beide Ecken gehören dazu, ihre Reihenfolge ist egal. `{ from: { x: 0, y: 64, z: 0 }, to: { x: 4, y: 67, z: 4 } }` umfasst 5×4×5 Blöcke. |
| Typ-IDs (`itemType`, `blockType`, …)   | Eine ID als String oder mehrere als Array: `"minecraft:paper"` oder `["myname:cs_book", "minecraft:book"]`.                                                       |
| `dimension`                            | Optional, Standard ist `"overworld"`. Erlaubt sind auch `"nether"`, `"the_end"` oder die volle ID wie `"minecraft:overworld"`.                                    |

## Dateien

| Datei                       | Inhalt                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| `events/index.js`           | Sammelt alle öffentlichen Funktionen zum Importieren.                                              |
| `events/item-pickup.js` …   | Je ein Ereignis, siehe Tabelle oben.                                                               |
| `events/shelf-contents.js`  | Zählt den Inhalt von Regalen mit, Grundlage für `onItemInShelf`. Siehe [item-in-shelf.md](events/item-in-shelf.md#für-entwickler-shelf-contentsjs). |
| `events/area.js`            | Gemeinsame Hilfsfunktionen, siehe unten.                                                           |
| `events/test.js`            | Testparcours für alle Ereignisse, siehe [test.md](events/test.md).                                 |
| `events/block-interact.js`  | Block anklicken, siehe Tabelle oben.                                                               |
| `events/test-library.js`    | Testaufbau (kleine Bibliothek) für die Bibliotheks-Quest, siehe [test-library.md](events/test-library.md). |
| `events/test-awakening.js`  | Testaufbau für die Quest „Das Erwachen“, siehe [test-awakening.md](events/test-awakening.md). Gehört nicht zur echten Map. |
| `custom_bookshelf.js`       | Macht unsere eigenen Bücherregale benutzbar (liegt direkt in `behavior_pack/scripts/`). Siehe [item-in-shelf.md](events/item-in-shelf.md#eigene-bücherregale). |

## Hilfsfunktionen in `area.js`

Die Ereignisse nutzen sie intern. Für eigene Bausteine lassen sie sich direkt aus `./events/area.js` importieren:

| Funktion                     | Zweck                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `createArea(from, to)`       | Macht aus zwei Eckblöcken in beliebiger Reihenfolge einen Bereich `{ min, max }`.                      |
| `isInArea(area, location)`   | Prüft, ob eine Position in dem Bereich liegt. Kommazahlen werden auf den Block abgerundet.             |
| `isSameBlock(a, b)`          | Prüft, ob zwei Positionen derselbe Block sind.                                                         |
| `toDimensionId(dimension)`   | Macht aus `"overworld"` die volle ID `"minecraft:overworld"`; ohne Angabe die Oberwelt.                |
| `toTypeSet(types)`           | Macht aus einer ID oder einem Array ein `Set`; ohne Angabe `undefined` („alle Typen“).                 |

## Beispiel: kleine Quest aus mehreren Ereignissen

```js
import { world } from "@minecraft/server";
import { onEnterTerritory, onItemInShelf } from "./events/index.js";
import { questlog } from "./questlog.js";

const entry = questlog.createEntry({
    title: "Aushilfe in der Bibliothek",
    lines: ["Die Bibliothek betreten", "Informatik-Buch einsortieren"],
});

const stopEnter = onEnterTerritory(
    { from: { x: 100, y: 64, z: 40 }, to: { x: 120, y: 70, z: 60 } },
    () => {
        stopEnter();
        entry.lines = ["§aDie Bibliothek betreten§r", "Informatik-Buch einsortieren"];
    }
);

const stopShelf = onItemInShelf(
    { itemType: "myname:cs_book", area: { from: { x: 100, y: 64, z: 40 }, to: { x: 120, y: 70, z: 60 } } },
    ({ player }) => {
        stopShelf();
        questlog.removeEntry(entry);
        world.sendMessage(`${player.name} hat die Bibliotheksquest abgeschlossen!`);
    }
);
```
