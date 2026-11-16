import { ItemStack, system, world } from "@minecraft/server";

const BALL_ITEM = "dhsn:volleyball";
const BALL_ENTITY = "dhsn:volleyball";
const BALL_TYPE = { type: BALL_ENTITY };
const BALL_GRAVITY = 0.1;
const BOUNCE_DAMPING = 0.7;
const MIN_BOUNCE_SPEED = 0.08;
const SPIN_STOP_SPEED = 0.02;
const ballMotion = new Map();

function getInventory(player) {
    const inventory = player.getComponent("minecraft:inventory");
    return inventory?.container;
}

function consumeHeldBall(player) {
    const inventory = getInventory(player);
    if (!inventory) {
        console.warn("[Volleyball] Player inventory is unavailable.");
        return false;
    }

    const slot = player.selectedSlotIndex;
    const stack = inventory.getItem(slot);
    if (!stack || stack.typeId !== BALL_ITEM) return false;

    if (stack.amount > 1) {
        stack.amount -= 1;
        inventory.setItem(slot, stack);
    } else {
        inventory.setItem(slot);
    }
    return true;
}

world.afterEvents.itemUse.subscribe(({ itemStack, source }) => {
    if (itemStack.typeId !== BALL_ITEM || source.typeId !== "minecraft:player") return;

    const player = source;
    const lookedAtBall = player
        .getEntitiesFromViewDirection({ maxDistance: 4 })
        .some(({ entity }) => entity.typeId === BALL_ENTITY);
    if (lookedAtBall) return;

    const inventory = getInventory(player);
    if (!inventory || inventory.getItem(player.selectedSlotIndex)?.typeId !== BALL_ITEM) {
        console.warn("[Volleyball] Could not find the used ball in the player's inventory.");
        return;
    }

    const direction = player.getViewDirection();
    const head = player.getHeadLocation();
    const location = {
        x: head.x + direction.x * 0.55,
        y: head.y + 0.2,
        z: head.z + direction.z * 0.55,
    };

    const ball = player.dimension.spawnEntity(BALL_ENTITY, location);
    const initialImpulse = {
        x: direction.x * 0.18,
        y: 0.3 + direction.y * 0.12,
        z: direction.z * 0.18,
    };
    ball.applyImpulse(initialImpulse);
    ballMotion.set(ball.id, {
        wasOnGround: false,
        velocityY: initialImpulse.y,
    });

    if (!consumeHeldBall(player)) {
        ball.remove();
        ballMotion.delete(ball.id);
    }
});

world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
    if (hitEntity.typeId !== BALL_ENTITY || damagingEntity.typeId !== "minecraft:player") return;

    hitEntity.triggerEvent("dhsn:start_spinning");
    hitEntity.dimension.playSound("wind_charge.burst", hitEntity.location, {
        volume: 0.8,
        pitch: 1,
    });
    hitEntity.dimension.spawnParticle("minecraft:wind_explosion_emitter", hitEntity.location);

    const direction = damagingEntity.getViewDirection();
    const impulse = {
        x: direction.x * 1.75,
        y: Math.max(direction.y * 1.75 + 0.2, 0.12),
        z: direction.z * 1.75,
    };
    hitEntity.applyImpulse(impulse);
    ballMotion.set(hitEntity.id, {
        wasOnGround: false,
        velocityY: hitEntity.getVelocity().y,
    });
});

world.afterEvents.playerInteractWithEntity.subscribe(({ target }) => {
    if (target.typeId !== BALL_ENTITY) return;

    target.dimension.spawnItem(new ItemStack(BALL_ITEM, 1), target.location);
    ballMotion.delete(target.id);
    target.remove();
});

system.runInterval(() => {
    const seenBalls = new Set();
    const dimensions = [
        world.getDimension("overworld"),
        world.getDimension("nether"),
        world.getDimension("the_end"),
    ];

    for (const dimension of dimensions) {
        for (const ball of dimension.getEntities(BALL_TYPE)) {
            seenBalls.add(ball.id);
            const motion = ballMotion.get(ball.id) ?? {
                wasOnGround: false,
                velocityY: ball.getVelocity().y,
            };
            if (ball.isOnGround && !motion.wasOnGround && motion.velocityY < -MIN_BOUNCE_SPEED) {
                ball.applyImpulse({
                    x: 0,
                    y: -motion.velocityY * BOUNCE_DAMPING,
                    z: 0,
                });
            } else if (!ball.isOnGround) {
                ball.applyImpulse({ x: 0, y: -BALL_GRAVITY, z: 0 });
            }

            const velocity = ball.getVelocity();
            if (
                ball.isOnGround &&
                Math.hypot(velocity.x, velocity.y, velocity.z) <= SPIN_STOP_SPEED &&
                ball.getProperty("dhsn:is_spinning") === true
            ) {
                ball.triggerEvent("dhsn:stop_spinning");
            }

            ballMotion.set(ball.id, {
                wasOnGround: ball.isOnGround,
                velocityY: velocity.y,
            });
        }
    }

    for (const id of ballMotion.keys()) {
        if (!seenBalls.has(id)) ballMotion.delete(id);
    }
}, 1);
