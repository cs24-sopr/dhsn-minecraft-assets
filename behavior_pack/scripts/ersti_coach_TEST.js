//PLEASE NOTE: This script is for testing purposes only and can be deleted after testing.
//This shall NOT be included in the final build.

import { world, system } from "@minecraft/server";

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const coach = event.target;

    if (coach.typeId !== "dhsn:ersti_coach") return;

    event.cancel = true;

    system.run(() => {
        if (!coach.isValid) return;

        coach.playAnimation("animation.ersti_coachwaving");
    });
});