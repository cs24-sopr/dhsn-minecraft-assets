# Item aufheben – `onItemPickup`

Datei: [item-pickup.js](../../behavior_pack/scripts/events/item-pickup.js) · [Übersicht](../Events.md)

Löst aus, wenn ein Spieler ein passendes Item vom Boden aufhebt. Andere Wege ins Inventar zählen nicht, z. B. aus einer Truhe nehmen, craften oder `/give`.

## Optionen

| Option      | Pflicht | Standard      | Bedeutung                                                         |
| ----------- | ------- | ------------- | ----------------------------------------------------------------- |
| `itemType`  | ja      | –             | Item-ID(s), die zählen, z. B. `"dhsn:certificate"`.               |
| `area`      | nein    | überall       | `{ from, to }`: Nur Aufheben innerhalb dieses Bereichs zählt.     |
| `dimension` | nein    | `"overworld"` | Dimension des Bereichs. Wirkt nur zusammen mit `area`.            |

## Callback

| Feld        | Inhalt                       |
| ----------- | ---------------------------- |
| `player`    | Der Spieler, der aufhebt.    |
| `itemStack` | Der aufgehobene Item-Stapel. |

Hebt ein Spieler mehrere passende Stapel auf einmal auf, wird der Callback einmal pro Stapel aufgerufen.

## Beispiel

```js
import { onItemPickup } from "./events/index.js";

const stop = onItemPickup({ itemType: "dhsn:certificate" }, ({ player, itemStack }) => {
    player.sendMessage(`Du hast ${itemStack.amount}x dein Zeugnis gefunden!`);
    stop();
});
```

Nur im Prüfungsamt:

```js
onItemPickup(
    { itemType: "dhsn:certificate", area: { from: { x: 50, y: 64, z: 10 }, to: { x: 60, y: 68, z: 20 } } },
    ({ player }) => player.sendMessage("Zeugnis im Prüfungsamt abgeholt.")
);
```

## Umsetzung

Das Event `world.afterEvents.entityItemPickup` hat im Spieltest für Spieler nicht ausgelöst. Ein Aufheben wird deshalb aus zwei Events zusammengesetzt:

1. `world.beforeEvents.entityRemove`: Ein Item-Objekt mit passendem Typ verschwindet vom Boden. Typ, Position und Zeitpunkt werden gemerkt.
2. `world.afterEvents.playerInventoryItemChange`: Ein Spieler bekommt mehr von diesem Item ins Inventar.

Liegen beide höchstens 2 Ticks auseinander und war der Spieler höchstens 3 Blöcke vom Item entfernt, gilt das als Aufheben. Items aus Truhen, vom Craften oder per `/give` zählen dadurch nicht, weil dabei kein Item vom Boden verschwindet.

## Test

Im [Testparcours](test.md) liegt ein Zeugnis 3 Blöcke östlich (+X) des Spielers. Hinlaufen und aufheben, dann erscheint im Chat:

```text
Ereignis ist eingetreten: Zeugnis aufheben (<Name> hat dhsn:certificate aufgehoben)
```

Gegenproben:

- Andere Items aufheben löst kein Ereignis aus.
- `/give @s dhsn:certificate` löst kein Ereignis aus.
