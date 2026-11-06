// We want our entities (that look like blocks) to only be killable by builders of the map, not regular users. All builders are supposed to wear a copper helmet which we check in this function.
export function isBuilder(player) {
    // Check if the player is wearing a copper helmet
    const helmet = player.getComponent("minecraft:equippable")
        ?.getEquipment("Head");

    return helmet && helmet.typeId === "minecraft:copper_helmet";
}
