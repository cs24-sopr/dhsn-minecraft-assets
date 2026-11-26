import { system } from '@minecraft/server'

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent('dhsn:cracks_steam', {
        onTick({ block }) {
            const { x, y, z } = block.location
            const effectLocation = { x: x + 0.5, y: y + 0.5, z: z + 0.5 }

            block.dimension.playSound('random.fizz', effectLocation, {
                volume: 0.8,
                pitch: 1,
            })
            block.dimension.spawnParticle(
                'minecraft:water_evaporation_bucket_emitter',
                effectLocation
            )
        },
    })
})
