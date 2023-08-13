import { createContext } from 'react'
import type TaskMachine from '@defer-renderer/core'
import type { TaskMachinePublic } from '@defer-renderer/core'

export interface DeferRenderContextValue {
  isAllDone: boolean
}

export const DeferRenderContext = createContext<TaskMachine | null>(null)

export const DeferRenderPublicContext = createContext<TaskMachinePublic | null>(null)

export const InternalDeferRenderContext = createContext<DeferRenderContextValue | null>(null)
