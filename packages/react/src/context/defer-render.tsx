import { createContext } from 'react'
import type TaskMachine from '@defer-render/core'
import type { TaskMachinePublic } from '@defer-render/core'

export interface DeferRenderContextValue {
  isAllDone: boolean
}

export const DeferRenderContext = createContext<TaskMachine | null>(null)

export const DeferRenderPublicContext = createContext<TaskMachinePublic | null>(null)

export const InternalDeferRenderContext = createContext<DeferRenderContextValue | null>(null)
