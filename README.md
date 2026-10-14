## Overview: Where Should Each Asset Be Saved?

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

Every entity (NPC, mob, or animated decor object) requires **3 to 4 files**:

| File Type | Storage Path | Description |
| :--- | :--- | :--- |
| **Working File** | `.bbmodels/entities/<model_name>.bbmodel` | Blockbench project file |
| **3D Geometry** | `resource_pack/models/entities/<model_name>.geo.json` | Exported 3D model |
| **Texture** | `resource_pack/textures/entities/<model_name>.png` | Texture image file |
| **Animation** | `resource_pack/animations/<model_name>.animation.json` | *(Optional)* Animations |

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
# 1. Define target path in BedrockOnLinux
```shell
TARGET="/home/username/.local/share/bedrock-on-linux/compatdata/pfx/drive_c/users/steamuser/AppData/Roaming/Minecraft Bedrock/Users/Shared/games/com.mojang"
```

# 2. Navigate to the repository directory
```shell
cd ./dhsn-minecraft-assets
```

# 3. Create symbolic links (symlinks)
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
