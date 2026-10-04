##  Übersicht: Wo muss welches Asset gespeichert werden?

Für **jedes einzelne Modell** entstehen je nach Format (Block oder Entity) folgende Dateien im Repository:

### 1. Für normale Blöcke (Format: `Bedrock Block`)

Jeder benutzerdefinierte Block benötigt **3 Dateien**:

| Dateityp | Speicherpfad | Beschreibung |
| :--- | :--- | :--- |
| **Arbeitsdatei** | `.bbmodels/blocks/<modellname>.bbmodel` | Blockbench-Projektdatei |
| **3D-Geometrie** | `resource_pack/models/blocks/<modellname>.geo.json` | Exportiertes 3D-Modell |
| **Textur** | `resource_pack/textures/blocks/<modellname>.png` | Textur-Bilddatei |

---

### 2. Für Einheiten & animierte Objekte (Format: `Bedrock Entity`)

Jede Entity (NPC, Mob oder animiertes Deko-Objekt) benötigt **3 bis 4 Dateien**:

| Dateityp | Speicherpfad | Beschreibung |
| :--- | :--- | :--- |
| **Arbeitsdatei** | `.bbmodels/entities/<modellname>.bbmodel` | Blockbench-Projektdatei |
| **3D-Geometrie** | `resource_pack/models/entities/<modellname>.geo.json` | Exportiertes 3D-Modell |
| **Textur** | `resource_pack/textures/entities/<modellname>.png` | Textur-Bilddatei |
| **Animation** | `resource_pack/animations/<modellname>.animation.json` | *(Optional)* Animationen |

---

### Beispielpfade für das Modell `pilz`

```text
.
├── .bbmodels/
│   └── blocks/
│       └── pilz.bbmodel
└── resource_pack/
    ├── models/
    │   └── blocks/
    │       └── pilz.geo.json
    └── textures/
        └── blocks/
            └── pilz.png
```

**Wichtig:**
Es kann über den Plugin Wizard dazu kommen, dass Dateien an falschen Positionen abgelegt werden.
Also immer kontrollieren, wo was abelegt wurde und gegebenenfalls selber verschieben an die richtige Position.

