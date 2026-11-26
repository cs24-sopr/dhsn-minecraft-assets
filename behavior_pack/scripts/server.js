import { system } from '@minecraft/server'

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent('dhsn:server_toggle', {
        onPlayerInteract({ block }) {
            const on = !block.permutation.getState('dhsn:powered')
            const part = block.permutation.getState('minecraft:multi_block_part')
            const other = part === 0 ? block.above() : block.below()

            for (const b of [block, other]) {
                if (!['dhsn:server_a', 'dhsn:server_b', 'dhsn:server_c', 'dhsn:server_d'].includes(b?.typeId)) continue
                b.setPermutation(b.permutation.withState('dhsn:powered', on))
            }
            block.dimension.playSound('random.click', block.center())
        },
    })
})