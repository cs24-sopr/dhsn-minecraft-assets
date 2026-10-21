import { world } from "@minecraft/server";

const CHAIR_BLOCK = "myname:toilet";
const SEAT_ENTITY = "dhsn:invisible_seat";
const SEAT_OFFSET_Y = 0;
const POS_TAG = "chairpos:";

const posKey = (loc) => `${loc.x}:${loc.y}:${loc.z}`;

function findSeat(dimension, loc) {
  return dimension.getEntities({
    type: SEAT_ENTITY,
    tags: [POS_TAG + posKey(loc)],
  })[0];
}

function spawnSeat(block) {
  const loc = block.location;
  if (findSeat(block.dimension, loc)) {
    return;
  }
  const seat = block.dimension.spawnEntity(SEAT_ENTITY, {
    x: loc.x + 0.5,
    y: loc.y + SEAT_OFFSET_Y,
    z: loc.z + 0.5,
  });
  seat.addTag(POS_TAG + posKey(loc));
}

// Block placed by a player -> spawn its seat
world.afterEvents.playerPlaceBlock.subscribe(({ block }) => {
  if (block.typeId === CHAIR_BLOCK) spawnSeat(block);
});

// Seat entity hit by a player -> break the toilet block and remove the seat
world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
  if (hitEntity.typeId !== SEAT_ENTITY) return;
  if (damagingEntity.typeId !== "minecraft:player") return;

  const tag = hitEntity.getTags().find((t) => t.startsWith(POS_TAG));
  if (tag) {
    const [x, y, z] = tag.slice(POS_TAG.length).split(":").map(Number);
    const dim = hitEntity.dimension;
    const block = dim.getBlock({ x, y, z });
    if (block?.typeId === CHAIR_BLOCK) {
      dim.runCommand(`setblock ${x} ${y} ${z} air destroy`);
    }
  }
  hitEntity.remove();
});