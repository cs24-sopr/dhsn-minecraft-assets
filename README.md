## Overview: Where Should Each Asset Be Saved?

[Official Minecraft Bedrock Creator Documentation](https://wiki.bedrock.dev/documentation/pack-structure)


For **each individual model**, depending on the format (Block or Entity), the following files are created in the repository:

### 1. For Standard Blocks (Format: `Bedrock Block`)

Every custom block requires **3 files**:

| File Type | Storage Path | Description |
| :--- | :--- | :--- |
| **Working File** | `.bbmodels/blocks/<model_name>.bbmodel` | Blockbench project file |
| **3D Geometry** | `resource_pack/models/blocks/<model_name>.geo.json` | Exported 3D model |
| **Texture** | `resource_pack/textures/blocks/<model_name>.png` | Texture image file |

The Block Wizard Plugin handles most of this automatically.  
In the Wizard, under "Export", simply select "Integrate into Package" and under "Select packs manually", choose the `resource_pack` folder from the repository.  
The Wizard will then automatically save everything in the correct location except for one file: `resource_pack/blocks/<Model_Name>.block.json`. This file must be manually moved into the `behavior_pack/blocks/` directory.

If you want to create a Multiblock-Item with Dimensions bigger than 16x16x16 you can look at [this example](/docs/Multiblock_Example.md).

---
### 2. For Entities & Animated Objects (Format: `Bedrock Entity`)

Creating entities requires linking the 3D model, textures, animations, and gameplay logic together through specific JSON configuration files.

**You can use the entitiy structure for the ventilator entity for reference **


#### Step-by-Step Creation Guide

1. **Create the Project in Blockbench:**
   - Open **Blockbench** and select **Bedrock Entity** as the format.
   - Design your 3D model, paint its texture, and create animations (e.g., rotation/looping).

2. **Save the Exported Files:**
   - **Working File:** Save `.bbmodel` to `.bbmodels/entity/<entity_name>.bbmodel`
   - **3D Geometry:** Export via `File -> Export -> Export Bedrock Geometry` to `resource_pack/models/entity/<entity_name>.geo.json`
   - **Texture:** Right-click texture -> **Save As** to `resource_pack/textures/entity/<entity_name>.png`
   - **Animation:** Export via `File -> Export -> Export Animations` to `resource_pack/animations/<entity_name>.animation.json`

3. **Set Up the Configuration JSONs:**
   - **Behavior Logic:** Create `behavior_pack/entities/<entity_name>.json`
   - **Client Entity Definition:** Create `resource_pack/entity/<entity_name>.entity.json`
   - **Render Controller:** Create `resource_pack/render_controllers/<entity_name>.render_controllers.json`

---

#### Configuration Templates

##### A. Behavior Definition Template
**Location:** `behavior_pack/entities/<entity_name>.json`  
*Defines entity identifier, hitboxes, and game mechanics.*

```json
{
  "format_version": "1.20.80",
  "minecraft:entity": {
    "description": {
      "identifier": "dhsn:<entity_name>",
      "is_spawnable": true,
      "is_summonable": true,
      "is_experimental": false
    },
    "components": {
      "minecraft:physics": {
        "has_gravity": false,
		"has_collision": true
      },
	  "minecraft:knockback_resistance": {
			  "value": 1.0
	  },
      "minecraft:collision_box": {
        "width": 1.0,
        "height": 1.0
      },
	  "minecraft:health" {
		"value": 1,
		"max": 1
	  },
	  "minecraft:damage_sensor": {
		"triggers": {
          "cause": "all",
          "deals_damage": true
        }
	  }
    }
  }
}
```

#### B. Client Entity Definition Template
Location: resource_pack/entity/<entity_name>.entity.json
Links geometry, textures, animations, and render controllers together.
```json
{
  "format_version": "1.20.80",
  "minecraft:client_entity": {
    "description": {
      "identifier": "dhsn:<entity_name>",
      "materials": {
        "default": "entity_alphatest"
      },
      "textures": {
        "default": "textures/entity/<entity_name>"
      },
      "geometry": {
        "default": "geometry.<entity_name>"
      },
      "animations": {
        "spin": "animation.<entity_name>.spin"
      },
      "scripts": {
        "animate": [
          "spin"
        ]
      },
      "render_controllers": [
        "controller.render.<entity_name>"
      ]
    }
  }
}
```
#### C. Render Controller Template
Location: resource_pack/render_controllers/<entity_name>.render_controllers.json
Tells Minecraft how to render materials, textures, and geometry.

```json
{
  "format_version": "1.20.80",
  "render_controllers": {
    "controller.render.<entity_name>": {
      "geometry": "Geometry.default",
      "materials": [ { "*": "Material.default" } ],
      "textures": [ "Texture.default" ]
    }
  }
}
```


---

### Example Paths for the `pilz` Model

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

## Testing In-Game (Bedrock on Linux)

**Only works if you have installed Minecraft via https://github.com/Wyze3306/BedrockOnLinux as .deb**

### Linux Setup
1. Define target path in BedrockOnLinux
```shell
TARGET="/home/username/.local/share/bedrock-on-linux/compatdata/pfx/drive_c/users/steamuser/AppData/Roaming/Minecraft Bedrock/Users/Shared/games/com.mojang"
```

2. Navigate to the repository directory
```shell
cd ./dhsn-minecraft-assets
```

3. Create symbolic links (symlinks)
```shell
ln -s "$(pwd)/behavior_pack" "$TARGET/development_behavior_packs/dhsn_bp"
ln -s "$(pwd)/resource_pack" "$TARGET/development_resource_packs/dhsn_rp"

echo "✅ Folders successfully linked!"
```

Now everything will be recognized by Minecraft instantly!


### Minecraft Configuration

1. In the world you want to test in, enable all Experimental Features.

2. Activate the DHSN Resource Pack.

3. Activate the DHSN Behavior Pack.

4. All done!
