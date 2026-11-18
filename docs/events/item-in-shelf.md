# Item ins Regal – `onItemInShelf`

Dateien: [item-in-shelf.js](../../behavior_pack/scripts/events/item-in-shelf.js), [shelf-contents.js](../../behavior_pack/scripts/events/shelf-contents.js) · [Übersicht](../Events.md)

Löst aus, wenn ein Spieler ein passendes Item per Rechtsklick in ein Regal stellt. Mit der Option `amount` löst es erst aus, wenn ein Regal eine bestimmte Anzahl passender Items enthält. Unterstützt werden:

- die Shelf-Blöcke aller Holzarten (`minecraft:oak_shelf`, `minecraft:spruce_shelf`, …). Sie nehmen jedes Item auf.
- `minecraft:chiseled_bookshelf`. Es nimmt nur Bücher auf.

Die vollständige Liste ist als `SHELF_TYPES` exportiert. Unsere eigenen Bücherregale (`myname:*_bookshelf`) sind reine Deko ohne Inventar und zählen nicht.

## Optionen

| Option      | Pflicht | Standard       | Bedeutung                                                    |
| ----------- | ------- | -------------- | ------------------------------------------------------------ |
| `itemType`  | ja      | –              | Item-ID(s), die zählen, z. B. `"myname:cs_book"`.            |
| `shelfType` | nein    | `SHELF_TYPES`  | Regal-Block-ID(s), die zählen.                               |
| `amount`    | nein    | –              | So viele passende Items müssen in **einem** Regal stehen. Ohne `amount` wird jedes Einstellen gemeldet. |
| `location`  | nein    | jedes Regal    | Nur das Regal an dieser Position zählt.                      |
| `area`      | nein    | jedes Regal    | `{ from, to }`: Nur Regale in diesem Bereich zählen.         |
| `dimension` | nein    | `"overworld"`  | Dimension des Regals.                                        |

## Callback

| Feld        | Inhalt                                                  |
| ----------- | ------------------------------------------------------- |
| `player`    | Der Spieler, der das Item eingestellt hat.              |
| `block`     | Das Regal.                                              |
| `itemStack` | Das Item, das der Spieler vorher in der Hand hielt.     |
| `count`     | So viele passende Items stehen jetzt in diesem Regal.   |

## Beispiele

```js
import { onItemInShelf } from "./events/index.js";

// Informatik-Buch in das Regal an einer festen Stelle der Bibliothek.
onItemInShelf(
    { itemType: "myname:cs_book", location: { x: 105, y: 65, z: 48 } },
    ({ player }) => player.sendMessage("Richtig einsortiert!")
);

// Fünf Informatik- oder Controlling-Bücher in eines der Regale der Bibliothek.
const stop = onItemInShelf(
    {
        itemType: ["myname:cs_book", "myname:cofi_book"],
        amount: 5,
        area: { from: { x: 100, y: 64, z: 40 }, to: { x: 120, y: 70, z: 60 } },
    },
    ({ player, count }) => {
        player.sendMessage(`${count} Bücher einsortiert, Regal voll!`);
        stop();
    }
);

// Irgendein Buch in irgendein Chiseled Bookshelf.
onItemInShelf(
    { itemType: "minecraft:book", shelfType: "minecraft:chiseled_bookshelf" },
    ({ player }) => player.sendMessage("Buch abgelegt.")
);
```

## Mitzählen und `amount`

Weil Regale ihr Inventar nicht an Skripte herausgeben, zählt `shelf-contents.js` pro Regal mit, was Spieler einstellen und herausnehmen. Grundlage ist die Hand des Spielers beim Rechtsklick: Was die Hand verliert, kommt ins Regal; was sie dazubekommt, kommt heraus.

- **Gezählt wird pro Regal und Item-Typ.** Bei mehreren `itemType` zählt die Summe: mit `["myname:cs_book", "myname:cofi_book"]` und `amount: 5` reichen z. B. 3 + 2 Bücher.
- **Gemeldet wird einmal**, nämlich bei dem Klick, der die Menge erreicht oder überschreitet. Wer Bücher herausnimmt und wieder unter die Menge fällt, löst beim erneuten Erreichen wieder aus.
- **Die Stände bleiben gespeichert**, auch über `/reload` und Neustarts. Sie liegen als Dynamic Properties in der Welt.
- **Ein neu platziertes oder abgebautes Regal** startet bei 0.
- Mit `getShelfCount(block, itemTypes)` aus `events/index.js` lässt sich der aktuelle Stand eines Regals abfragen, z. B. für eine Fortschrittsanzeige im Questlog.

## Für Entwickler: `shelf-contents.js`

Der Zähler arbeitet unabhängig von Quests und zählt in allen Regalen der Welt. Er bietet zwei Funktionen:

| Funktion                            | Zweck                                                                                                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getShelfCount(block, itemTypes)`   | Liefert, wie viele Items der angegebenen Typen (Array oder `Set`) im Regal `block` stehen. Auch über `events/index.js` importierbar.                                                       |
| `onShelfChange(listener)`           | Ruft `listener` nach jedem Einstellen oder Herausnehmen auf, wenn der Stand schon aktualisiert ist. Gibt eine Funktion zum Abmelden zurück. Nur aus `./events/shelf-contents.js` importierbar. |

`onShelfChange` übergibt ein Objekt mit `player`, `block` (das Regal), `beforeItemStack` (Hand vor dem Klick) und `changes`. `changes` ist eine `Map` von Item-ID auf Anzahl: positiv bedeutet eingestellt, negativ herausgenommen.

Beispiel: Fortschritt im Questlog anzeigen.

```js
import { onShelfChange } from "./events/shelf-contents.js";
import { getShelfCount } from "./events/index.js";
import { questlog } from "./questlog.js";

const entry = questlog.createEntry({ title: "Bibliothek", lines: ["Bücher: 0/5"] });

onShelfChange(({ block }) => {
    if (block.location.x !== 105 || block.location.y !== 65 || block.location.z !== 48) return;
    entry.lines = [`Bücher: ${getShelfCount(block, ["myname:cs_book"])}/5`];
});
```

Gespeichert wird je Regal eine Dynamic Property `dhsn:shelf_contents:<Dimension>:<x>,<y>,<z>` mit einem JSON-Objekt `{ "<Item-ID>": <Anzahl> }`. Leere Regale haben keinen Eintrag.

## Einschränkungen

- **Nur Überlebens- oder Abenteuermodus.** Regale geben ihr Inventar nicht an Skripte heraus (für Shelf-Blöcke im Spiel geprüft). Deshalb gilt ein Item als eingestellt, wenn es nach dem Rechtsklick aus der Hand verschwunden ist oder weniger geworden ist. Im Kreativmodus werden Items nicht verbraucht, dort wird nichts erkannt.
- **Tausch gegen Gleiches:** Liegt im Shelf schon dasselbe Item und wird getauscht, ändert sich die Hand nicht. Das wird nicht erkannt.
- **Ganze Stapel:** Ein Shelf legt den ganzen Stapel aus der Hand in einen Slot, das Ereignis meldet ihn einmal. Ein Item pro Slot lässt sich per Skript nicht erzwingen, weil Shelf-Blöcke ihr Inventar nicht an Skripte herausgeben (im Spiel geprüft).
- **Nur Spieler-Klicks werden gezählt.** Items, die schon vor diesem Update im Regal standen oder durch Befehle, Strukturen oder Trichter hineinkommen, kennt der Zähler nicht. Regale für Quests sollten deshalb leer platziert werden. Wird ein Regal per Befehl ersetzt statt abgebaut, bleibt der alte Stand stehen.
- **Herausnehmen nur mit leerer Hand zuverlässig:** Gezählt wird, was in der Hand landet. Hält der Spieler schon etwas und das Spiel legt das herausgenommene Item in einen anderen Inventar-Slot, bemerkt der Zähler das nicht und zählt zu viel.
- **Kreativmodus:** Beim Herausnehmen bekommt die Hand das Item, beim Einstellen verliert sie nichts. Im Kreativmodus kann der Zähler also nur sinken (nie unter 0).
- **Eigene Bücher im Chiseled Bookshelf:** Ob Vanilla `myname:*_book` dort annimmt, ist ungeklärt. In Shelf-Blöcken funktionieren sie.

## Test

Im [Testparcours](test.md) bekommt der Spieler ein Eichenregal, ein Chiseled Bookshelf, ein Informatik-Buch (`myname:cs_book`) und 6 normale Bücher. Der Test braucht den **Überlebensmodus** (`/gamemode survival`).

1. Das Eichenregal irgendwo platzieren.
2. Das Informatik-Buch in die Hand nehmen und auf die Vorderseite des Regals rechtsklicken.
3. Im Chat erscheint:

   ```text
   Ereignis ist eingetreten: Buch ins Regal stellen (<Name>: myname:cs_book in minecraft:oak_shelf)
   ```

4. Das Chiseled Bookshelf platzieren und die 6 Bücher einzeln hineinstellen, bis alle 6 Slots belegt sind. Jedes Buch meldet „Buch ins Regal stellen“.
5. Beim **dritten** Buch erscheint zusätzlich, einmal:

   ```text
   Ereignis ist eingetreten: 3 Bücher in ein Regal stellen (<Name>: 3 Bücher in minecraft:chiseled_bookshelf)
   ```

6. Zur Prüfung des Herausnehmens 4 Bücher herausnehmen, bis noch 2 drin sind. Dabei **jedes Mal einen leeren Hotbar-Slot auswählen**, damit das Buch in der Hand landet (siehe Einschränkungen). Dann ein Buch wieder hineinstellen: Bei 3 Büchern kommt die Meldung „3 Bücher …“ erneut.

Gegenproben:

- Papier ins Eichenregal stellen: kein Ereignis, weil es nicht in `itemType` steht.
- Je 2 Bücher in zwei verschiedene Regale: kein „3 Bücher …“, weil pro Regal gezählt wird.
- Ein Eichenregal mit dem ganzen Stapel aus 6 Büchern füllen: „3 Bücher …“ kommt sofort mit `6 Bücher`, weil das Shelf den ganzen Stapel nimmt.
- Dasselbe im Kreativmodus: kein Ereignis (siehe Einschränkungen).
