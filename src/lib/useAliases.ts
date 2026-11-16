import { useState, useEffect, useCallback } from 'react'
import {
  loadAliases, saveAliases, keyFor, ourSection,
  type AliasMap, type Source,
} from './aliases'

/* Pages mount and unmount as the user moves about, so each would otherwise
   hold its own copy of the map and the last one to save would win. A single
   module-level copy with subscribers keeps every open page in step, and the
   storage event carries a change made in another tab. */

let shared: AliasMap = loadAliases()
const listeners = new Set<(m: AliasMap) => void>()

function publish(next: AliasMap) {
  shared = next
  saveAliases(next)
  listeners.forEach(fn => fn(next))
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key !== 'vsa-aliases') return
    try {
      shared = JSON.parse(e.newValue ?? '{}')
      listeners.forEach(fn => fn(shared))
    } catch { /* another tab wrote something unreadable; keep what we have */ }
  })
}

export function useAliases(source: Source) {
  const [map, setMap] = useState<AliasMap>(shared)

  useEffect(() => {
    listeners.add(setMap)
    setMap(shared)                 // a page opened later starts in step
    return () => { listeners.delete(setMap) }
  }, [])

  /** What we call this foreign name, if anyone has taught it. */
  const ours = useCallback(
    (foreign: string) => ourSection(map, source, foreign),
    [map, source],
  )

  /** Teach a name. An empty section forgets it rather than storing a blank. */
  const teach = useCallback((foreign: string, ourName: string) => {
    const next = { ...shared }
    const k = keyFor(source, foreign)
    if (ourName) next[k] = ourName
    else delete next[k]
    publish(next)
  }, [source])

  return { map, ours, teach }
}
