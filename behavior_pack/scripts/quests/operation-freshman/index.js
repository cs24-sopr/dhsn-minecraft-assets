import { system } from '@minecraft/server'
import { registerDebugCommands } from './debug.js'

system.beforeEvents.startup.subscribe(registerDebugCommands)
