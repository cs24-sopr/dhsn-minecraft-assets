# Minecraft Bedrock: Create a Multi-Block from a Blockbench Model

**Example:** A desk that is 2 blocks wide, 1 block high, and 1 block deep.  
**Tested setup:** Minecraft Bedrock 26.52 with block `format_version: "1.26.50"`.  
**Goal:** Place one block item to create two connected block parts. The desk faces the correct direction and both parts use **one shared texture**.

> **Terminology:** This setup uses **one registered block type** (`myname:computerdesk`) with multiple parts. It does not register two separate items. Blockbench defines the visual models. The Behavior Pack defines how the parts work together.

## 1. Files and folder structure

Example paths used for this desk:

```text
DHSN_BP/                                Behavior Pack
├── manifest.json                       Existing pack manifest
└── blocks/
    └── computerdesk.block.json         One block definition for both parts

DHSN_RP/                                Resource Pack
├── manifest.json                       Existing pack manifest
├── models/blocks/
│   ├── computerdesk_leftpart.geo.json  Left geometry
│   └── computerdesk_rightpart.geo.json Right geometry
├── textures/blocks/
│   └── computerdesk.png                Shared texture
└── textures/
    └── terrain_texture.json            Existing texture registration (if already set up)

.bbmodels
└── computerdesk_complete.bbmodel        Editable full Blockbench model
```

**Four relevant asset files:**

- one block definition
- two geometry files
- one shared Texture-PNG.

The pack manifests and texture registration are part of the existing add-on setup. They do **not** need special multi-block changes when the original block already works. You do not need a second block definition or a separate item JSON for this example.

Keep the `.bbmodel` file as your editable source. It usually does not belong in the Minecraft pack.

## 2. Build the full model in Blockbench

1. Create a **Bedrock Block** model, or open your existing Blockbench block project.
2. Build the full desk at **32 × 16 × 16 pixels** (X = width, Y = height, Z = depth). One Minecraft block is 16 pixels wide.
3. Put the cubes in two groups (folders in Blockbench): `leftpart` and `rightpart`. Split any cube that crosses the middle line, such as the top of the desk.
4. If Blockbench limits the model size, open **File → Preferences → Settings → Edit** and enable **Deactivate Size Limit**.
5. Create or import one texture called `computerdesk.png`. Use **Paint** to texture the complete desk.
6. Save the full model as `computerdesk_complete.bbmodel`. Use it for later model, UV, and texture changes.

**Note:** Blockbench can show the complete model, but it does not automatically simulate the in-game `minecraft:multi_block` placement.

## 3. Export two geometry files

1. Split the full model on the **X axis at X = 0**. Cubes crossing this line must be split into separate cubes. The two group-folders make it easier to manage the parts.
2. Make a copy of the project for the **left** export. Keep only the left-side cubes. Make another copy for the **right** export. Simply hiding cubes in the Outliner may not exclude them from the export.
3. Position each half around **its own local block center**. Use Blockbench's marked block area as a guide.
4. Keep the existing UV mapping. Both parts must use the same `computerdesk.png`, but they can use different regions of the image.
5. Export both as **Bedrock Geometry**:
    - `computerdesk_leftpart.geo.json`
    - `computerdesk_rightpart.geo.json`
6. Open the exported JSON files in VS Code. Set `minecraft:geometry[0].description.identifier` for each file.

**In `computerdesk_leftpart.geo.json`:**

```json
"identifier": "geometry.computerdesk_leftpart"
```

**In `computerdesk_rightpart.geo.json`:**

```json
"identifier": "geometry.computerdesk_rightpart"
```

**Why?** Minecraft loads a geometry by its identifier **inside the JSON**, not by the filename. The identifiers must be unique and must match the block definition exactly.

**UV note:** `texture_width` and `texture_height` define the UV coordinate space in the geometry files. They do not always need to match the PNG's actual pixel size, for example if a texture was scaled up. Keep the values exported by Blockbench and check the result in Minecraft.

## 4. Use the shared texture in the Resource Pack

Both geometry files can use **one texture**. The block definition uses the registered texture key `computerdesk`.

Example entry in `textures/terrain_texture.json`:

```json
"computerdesk": {
  "textures": "textures/blocks/computerdesk"
}
```

This is **only an excerpt**, not a complete `terrain_texture.json` file. The PNG is stored at `textures/blocks/computerdesk.png`.

**If the texture already worked with the original block, do not change its registration.**

## 5. Update the single block definition

**File:** `DHSN_BP/blocks/computerdesk.block.json`

Start with your existing, working single-block definition. Do **not** create a second block definition for `rightpart`.

If you are unsure where the parts are placed inside the files, look at the full example below.

### 5.1 Set the format version

```json
"format_version": "1.26.50"
```

Horizontal `minecraft:multi_block` objects require Minecraft Bedrock **1.26.10 or later**. With block format versions below `1.26.50`, horizontal multi-blocks require the **Upcoming Creator Features** experiment. The tested configuration uses `1.26.50` without that experiment. The game itself must also support the feature.

### 5.2 Add both traits in `description.traits`

```json
"traits": {
  "minecraft:placement_direction": {
    "enabled_states": ["minecraft:cardinal_direction"],
    "y_rotation_offset": 90.0
  },
  "minecraft:multi_block": {
    "enabled_states": ["minecraft:multi_block_part"],
    "parts": 2,
    "direction": "east"
  }
}
```

- `minecraft:multi_block`: Groups the block parts into one placed object.
- `minecraft:multi_block_part`: Stores the part number: **0** for the first part and **1** for the second.
- `parts: 2`: The object uses two block positions.
- `direction: "east"`: Sets the base direction. The placement-direction trait can change the actual horizontal placement direction.
- `minecraft:placement_direction`: Stores the direction when the player places the block.
- `minecraft:cardinal_direction`: Stores `north`, `east`, `south`, or `west`.
- `y_rotation_offset: 90.0`: In this desk example, this makes the **wide side** face the player. The correct offset depends on the model.

### 5.3 Add the base geometry and material in `components`

```json
"minecraft:geometry": "geometry.computerdesk_leftpart",
"minecraft:material_instances": {
  "*": {
    "texture": "computerdesk",
    "render_method": "alpha_test"
  }
},
"minecraft:collision_box": true,
"minecraft:selection_box": true,
"minecraft:movable": {
  "movement_type": "immovable"
}
```

This is **an excerpt inside** `components`. Keep your other valid components, such as mining time and explosion resistance.

- **Base geometry:** Required in the main `components` section, even when permutations select different geometries.
- `material_instances`: Uses the single registered texture key `computerdesk` for both parts.
- `collision_box` and `selection_box`: Define collision and selection **for each block part**. `true` uses the default one-block box, not one 32-pixel-wide box.
- `movable: immovable`: Required for this setup. Pistons cannot move the block.

**Important issue found during testing:** Remove this older generated component if your Content Log reports a schema error with block format `1.26.50`:

```json
"tag:minecraft:is_axe_item_destructible": {}
```

### 5.4 Add geometry permutations for the two parts

For this tested desk, the part names look reversed. This is intentional and depends on the model's local orientation.

Add these entries to the block's **`permutations` array**:

```json
{
  "condition": "q.block_state('minecraft:multi_block_part') == 0",
  "components": {
    "minecraft:geometry": "geometry.computerdesk_rightpart"
  }
},
{
  "condition": "q.block_state('minecraft:multi_block_part') == 1",
  "components": {
    "minecraft:geometry": "geometry.computerdesk_leftpart"
  }
}
```

**Do not assume** that part 0 must always use the left geometry. If the halves appear swapped, first try switching only these two geometry identifiers.

### 5.5 Add the direction rotations to `permutations`

After the two part entries, add **four direction-based entries**. These are the tested values with `y_rotation_offset: 90.0`:

| Stored `cardinal_direction` | Y rotation for both models |
| --------------------------- | -------------------------: |
| `east`                      |                        `0` |
| `north`                     |                       `90` |
| `west`                      |                      `180` |
| `south`                     |                      `270` |

Example of one direction permutation:

```json
{
    "condition": "q.block_state('minecraft:cardinal_direction') == 'north'",
    "components": {
        "minecraft:transformation": {
            "rotation": [0, 90, 0]
        }
    }
}
```

**Why separate them?** Two permutations select the geometry. Four more select the rotation. This keeps the file shorter than writing eight combined cases. `minecraft:transformation` rotates the visible geometry. The direction state controls the positions of the block parts.

**If the halves do not line up:** Check both the rotation values and `y_rotation_offset`. They must match the model orientation. Change and test one setting at a time.

## 6. Complete example: `computerdesk.block.json`

This is the final setup confirmed to work in the desk example. Adapt it for other furniture.

```json
{
    "format_version": "1.26.50",
    "minecraft:block": {
        "description": {
            "identifier": "myname:computerdesk",
            "menu_category": {
                "category": "construction"
            },
            "traits": {
                "minecraft:placement_direction": {
                    "enabled_states": ["minecraft:cardinal_direction"],
                    "y_rotation_offset": 90.0
                },
                "minecraft:multi_block": {
                    "enabled_states": ["minecraft:multi_block_part"],
                    "parts": 2,
                    "direction": "east"
                }
            }
        },
        "components": {
            "minecraft:geometry": "geometry.computerdesk_leftpart",
            "minecraft:collision_box": true,
            "minecraft:selection_box": true,
            "minecraft:movable": {
                "movement_type": "immovable"
            },
            "minecraft:destructible_by_mining": {
                "seconds_to_destroy": 0.5
            },
            "minecraft:destructible_by_explosion": {
                "explosion_resistance": 15
            },
            "minecraft:material_instances": {
                "*": {
                    "texture": "computerdesk",
                    "render_method": "alpha_test"
                }
            },
            "minecraft:map_color": "#5f4a2b"
        },
        "permutations": [
            {
                "condition": "q.block_state('minecraft:multi_block_part') == 0",
                "components": {
                    "minecraft:geometry": "geometry.computerdesk_rightpart"
                }
            },
            {
                "condition": "q.block_state('minecraft:multi_block_part') == 1",
                "components": {
                    "minecraft:geometry": "geometry.computerdesk_leftpart"
                }
            },
            {
                "condition": "q.block_state('minecraft:cardinal_direction') == 'east'",
                "components": {
                    "minecraft:transformation": {
                        "rotation": [0, 0, 0]
                    }
                }
            },
            {
                "condition": "q.block_state('minecraft:cardinal_direction') == 'north'",
                "components": {
                    "minecraft:transformation": {
                        "rotation": [0, 90, 0]
                    }
                }
            },
            {
                "condition": "q.block_state('minecraft:cardinal_direction') == 'west'",
                "components": {
                    "minecraft:transformation": {
                        "rotation": [0, 180, 0]
                    }
                }
            },
            {
                "condition": "q.block_state('minecraft:cardinal_direction') == 'south'",
                "components": {
                    "minecraft:transformation": {
                        "rotation": [0, 270, 0]
                    }
                }
            }
        ]
    }
}
```

**For other models, review:** the block identifier, geometry identifiers, texture key, number and direction of parts, rotation and offset, collision boxes, and mining behavior. The part-to-geometry mapping is not universal.

## 7. Test and troubleshoot in Minecraft

1. Activate the **Behavior Pack** and **Resource Pack** in your world.
2. Turn on cheats for the test world.
3. Check if Minecraft knows the block:

```mcfunction
/give @s myname:computerdesk 1
```

4. Place the desk while facing all four directions. Check that the halves line up, the front faces the player, and both parts break together.
5. If the block is missing or displays as a question-mark dirt block, enable the **Content Log** in Minecraft Bedrock's **Creator** settings. Reload the world and fix the **first specific error** before making other changes.

**Errors seen in this example:**

- `tag:minecraft:is_axe_item_destructible ... not present in the Schema`: Remove that old tag from the block's `components` section when using the new format.
- `Block needs both a "geometry" and "material_instances" component`: Set **both** values in the main `components` section, even if geometry is also selected in permutations.
- Left and right parts appear swapped: Switch the geometry identifiers for part 0 and part 1.
- Parts do not line up after rotation: Check the cardinal-direction rotations and `y_rotation_offset` together.

## 8. Final checklist

- [ ] Keep the complete `.bbmodel` as the editable source.
- [ ] Export two `.geo.json` files with different geometry identifiers.
- [ ] Center both geometries in their own local block coordinates.
- [ ] Use one shared `computerdesk.png` texture.
- [ ] Confirm the texture is registered in the existing Resource Pack.
- [ ] Use one block definition for both parts.
- [ ] Use a block format version that supports horizontal multi-blocks.
- [ ] Add the `multi_block` and `placement_direction` traits.
- [ ] Set both base geometry and material in the main `components` section.
- [ ] Check the part 0 and part 1 geometry permutations.
- [ ] Check the four rotation permutations.
- [ ] Enable both packs in Minecraft.
- [ ] Test `/give` and all four placement directions.

## Official documentation

- [Create a Multi-Block – Minecraft Creator (Microsoft Learn)](https://learn.microsoft.com/en-us/minecraft/creator/documents/multi-blocks?view=minecraft-bedrock-stable)
- [Block Trait: multi_block – Reference (Microsoft Learn)](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/traits/multi_block?view=minecraft-bedrock-stable)
