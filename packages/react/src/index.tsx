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
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, Component, FunctionComponent, LegacyRef, PropsWithChildren, ReactElement } from 'react'
import { observe } from 'react-intersection-observer'
import { DeferRenderContext } from './context/defer-render'

export interface WithDeferRenderProps {
  priority?: number
  fallback?: ReactElement<
     unknown,
     string | FunctionComponent | typeof Component
   > | null
  forceRender?: boolean
  onRenderSuccess?: (isRender: true) => void
}

export function InternalWithDeferRender(props: PropsWithChildren<WithDeferRenderProps>) {
  const { children, priority, fallback, forceRender: forceIsRender, onRenderSuccess } = props

  const _children = useMemo(() => {
    return children
  }, [children])

  const [_isRender, setIsRender] = useState(forceIsRender)
  const isRender = forceIsRender || _isRender

  useEffect(() => {
    !_isRender && isRender && setIsRender(true)
  }, [isRender])

  const machine = useContext(DeferRenderContext)

  useEffect(() => {
    if (isRender)
      return
    const unregister = machine?.register(() => {
      setIsRender(true)
      onRenderSuccess?.(true)
      //  TODO: 再考虑一种场景，例如一个列表，
      // 下滑时，下面的优先级高（比较晚push，还要看heapify的实现），上面的优先级低（）
      // 导致下面的先出来（正确的），但是渲染不按照瀑布流来，也很难受
    }, priority)
    machine?.resume()
    return () => {
      unregister?.()
    }
  }, [priority, isRender])

  return isRender ? <>{_children}</> : fallback ?? null
}

const intersectionContainerStyle: CSSProperties = {
  minWidth: '4px',
  minHeight: '4px',
}

//  TODO: 再写一个intersectionObserver 的hooks and wrapper component
// 1. 直接用react-use的，然后其他渲染库版本再写
// 2. 用 react-intersection-observer 轻量，再另外的可以参考其test-utils.ts写测试工具暴露出去
export function WithDeferRender(props: PropsWithChildren<WithDeferRenderProps>) {
  const { children, ...otherProps } = props
  const [isInView, setIsInView] = useState(false)
  const ref: LegacyRef<HTMLDivElement> = useRef(null!)
  useEffect(() => {
    if (ref.current && !isInView) {
      const unobserve = observe(ref.current, () => {
        setIsInView(true)
        unobserve()
      }, {
        threshold: [0.01],
      })
      return unobserve
    }
  }, [isInView])

  const _children = useMemo(() => {
    return children
  }, [children])

  return <div style={intersectionContainerStyle} ref={ref}>
    <InternalWithDeferRender
    onRenderSuccess={() => {
      setIsInView(true)
    }}
    forceRender={isInView} {...otherProps} >{_children}</InternalWithDeferRender>
  </div>
}
