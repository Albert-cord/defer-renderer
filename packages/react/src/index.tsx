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
import { useContext, useEffect, useMemo, useState } from 'react'
import type { Component, FunctionComponent, PropsWithChildren, ReactElement } from 'react'
import { DeferRenderContext } from './context/defer-render'

export interface WithDeferRenderProps {
  priority?: number
  fallback?: ReactElement<
     unknown,
     string | FunctionComponent | typeof Component
   > | null
  forceRender?: boolean
  onRender?: (isRender: true) => void
}

export function WithDeferRender(props: PropsWithChildren<WithDeferRenderProps>) {
  const { children, priority, fallback, forceRender: forceIsRender, onRender } = props

  const _children = useMemo(() => {
    return children
  }, [children])

  const [_isRender, setIsRender] = useState(forceIsRender)
  const isRender = forceIsRender || _isRender

  useEffect(() => {
    !isRender && setIsRender(true)
  }, [isRender])

  const machine = useContext(DeferRenderContext)

  useEffect(() => {
    if (isRender)
      return
    const unregister = machine?.register(() => {
      setIsRender(true)
      onRender?.(true)
      //  TODO: 再考虑一种场景，例如一个列表，
      // 下滑时，下面的优先级高（比较晚push，还要看heapify的实现），上面的优先级低（）
      // 导致下面的先出来（正确的），但是渲染不按照瀑布流来，也很难受
    }, priority)
    machine?.resume()
    return () => {
      unregister?.()
    }
  }, [priority, isRender])

  return isRender ? _children : fallback ?? null
}

//  TODO: 再写一个intersectionObserver 的hooks and wrapper component
// 1. 直接用react-use的，然后其他渲染库版本再写
// 2. 用 react-intersection-observer 轻量，再另外的可以参考其test-utils.ts写测试工具暴露出去
// 2的竞品：https://www.npmjs.com/package/react-in-viewport
// https://www.npmjs.com/package/react-intersection-observer-hook
// 感觉用1，然后参考其他方式
// 因为用非1，其他渲染库还要继续选，不靠谱。。。
