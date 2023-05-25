import { useContext } from 'react'
import { InternalDeferRenderContext } from '../context/defer-render'

export function useIsAllTaskDone() {
  const { isAllDone } = useContext(InternalDeferRenderContext) || {}
  return !!isAllDone
}
