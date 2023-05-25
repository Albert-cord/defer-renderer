/**
 * Provider
 * Context
 * InternalContext
 * UserlandContext
 *
 * WithTaskRender
 *
 * some event and state
 *
 * config: maybe timer, change taskManager callback, getState, etc...
 *
 */
import React, { useContext, useEffect, useMemo, useState } from 'react'

//  https://github.com/sky0014/unstable_batchedupdates/blob/master/package.json
//  考虑替换
import { unstable_batchedUpdates } from 'react-dom'
import type { PropsWithChildren } from 'react'
import TaskMachine from '@defer-render/core'
import type { TaskMachinePublic, TimerInterface } from '@defer-render/core'
import { DeferRenderContext, DeferRenderPublicContext, InternalDeferRenderContext } from '../context/defer-render'
import type { DeferRenderContextValue } from '../context/defer-render'

export function InternalDeferRenderProvider(props: PropsWithChildren<unknown>) {
  const { children } = props
  const _children = useMemo(() => {
    return children
  }, [children])

  const machine = useContext(DeferRenderContext)

  const [allTasks, setAllTasks] = useState<number[]>([])

  const [doneTasks, setDoneTasks] = useState<number[]>([])

  useEffect(() => {
    const addId = (previousTasks: number[], _id: unknown) => {
      const id = _id as number
      if (previousTasks.includes(id))
        return previousTasks

      return [...previousTasks, id]
    }

    const removeId = (previousTasks: number[], _id: unknown) => {
      const id = _id as number
      if (previousTasks.includes(id))
        return previousTasks.filter(_id => _id !== id)

      return previousTasks
    }

    const off = machine?.on('registerTask', (id) => {
      setAllTasks(previousTasks => addId(previousTasks, id))
    })

    const offUnregister = machine?.on('unregisterTask', (id) => {
      setAllTasks(previousTasks => removeId(previousTasks, id))
      setDoneTasks(previousTasks => removeId(previousTasks, id))
    })

    const offDoneTask = machine?.on('doneTask', (id) => {
      // 存在一种可能，unregisterTask先调用了，把这个id去掉了，然后再doneTask的情况
      // 应该怎么处理?
      // 上面加个unregisterTasks？但这样又很脏，或者内部不发出不在registerTasks里的doneTask事件?
      setDoneTasks(previousTasks => addId(previousTasks, id))
    })

    return () => {
      off?.()
      offUnregister?.()
      offDoneTask?.()
    }
  }, [])

  const context: DeferRenderContextValue = useMemo(() => {
    return {
      // [].every(id => [].includes(id)) true
      // 上面的情况，所以用<=
      isAllDone: allTasks.length <= doneTasks.length && allTasks.every(id => doneTasks.includes(id)),
    }
  }, [allTasks, doneTasks])

  return (
         <InternalDeferRenderContext.Provider value={context}>
             {_children}
         </InternalDeferRenderContext.Provider>
  )
}

// export const DeferRenderProvider = forwardRef()

export interface DeferRenderProps<T> {
  leading?: boolean
  timer?: TimerInterface<T>
}

const internalTimer: TimerInterface<number> = {
  timer(task: () => void) {
    // TODO: 使用raf
    return window.requestAnimationFrame(() => {
      unstable_batchedUpdates(() => {
        task()
      })
    })
  },
  cleanup(timerId: number) {
    window.cancelAnimationFrame(timerId)
  },
}

export function DeferRenderProvider<T = number>(props: PropsWithChildren<DeferRenderProps<T>>) {
  const { timer, children, leading = true } = props

  const context = useMemo(() => {
    return new TaskMachine<T>(timer ?? internalTimer as unknown as TimerInterface<T>)
  }, [])

  const publicContext = useMemo(() => {
    return {
      start: context.start.bind(context),
      register: context.register.bind(context),
      unregister: context.unregister.bind(context),
      pause: context.pause.bind(context),
      resume: context.resume.bind(context),
      stop: context.stop.bind(context),
      getMachineStatus: () => context.machineStatus,
    } as TaskMachinePublic
  }, [context])

  useEffect(() => {
    leading && context.start()
    // 不能寄希望于这里stop，不然会有内存泄漏
    return () => {
      context.stop()
    }
  }, [context])

  return (
         <DeferRenderPublicContext.Provider value={publicContext}>
             <DeferRenderContext.Provider value={context as unknown as TaskMachine<number>}>
                 <InternalDeferRenderProvider>
                     {children}
                 </InternalDeferRenderProvider>
             </DeferRenderContext.Provider>
         </DeferRenderPublicContext.Provider>
  )
}
