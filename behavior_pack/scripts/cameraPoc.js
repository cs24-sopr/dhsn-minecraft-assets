import { world, system, EasingType } from "@minecraft/server";

// this is a PoC for cinematic camera movement (cutscene), in order to test it step on a mob_spawner block - obtained with /give @s mob_spawner

const PAD_BLOCK = "minecraft:mob_spawner";
const MOVE_SECONDS = 3;
const PAUSE_AFTER_SECONDS = 1

const A = { pos: { x: 0, y: 120, z: 0 }, look: { x: 50, y: 70, z: 50 } };
const B = { pos: { x: 50, y: 120, z: 50 }, look: { x: 30, y: 90, z: 80 } };

const busy = new Set();    // players currently in a shot
const onPad = new Set();   // players standing on the pad last check

function playShot(player) {
  busy.add(player.id);
  try {
    player.runCommand("inputpermission set @s movement disabled");
    player.camera.setCamera("minecraft:free", {
      location: A.pos,
      facingLocation: A.look,
    });
    system.runTimeout(() => {
      try {
        player.camera.setCamera("minecraft:free", {
          location: B.pos,
          facingLocation: B.look,
          easeOptions: { easeTime: MOVE_SECONDS, easeType: EasingType.InOutSine },
        });
      } catch {}
    }, 2); // 2-tick delay for free camera to take effect
  } catch { }
  system.runTimeout(() => {
    try {
      player.camera.clear();
      player.runCommand("inputpermission set @s movement enabled");
    } catch { }
    busy.delete(player.id);
  }, 2 + (MOVE_SECONDS + PAUSE_AFTER_SECONDS) * 20);
}

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    const { x, y, z } = player.location;
    const below = player.dimension.getBlock({
      x: Math.floor(x),
      y: Math.floor(y - 0.1),
      z: Math.floor(z),
    });
    const standing = below?.typeId === PAD_BLOCK;

    if (standing && !onPad.has(player.id) && !busy.has(player.id)) {
      playShot(player);
    }
    if (standing) onPad.add(player.id);
    else onPad.delete(player.id);
  }
}, 5);