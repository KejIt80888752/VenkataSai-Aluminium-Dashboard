/* ── Editable records on top of the seeded registers ───────────────────────
   The dashboard ships with a year of data. Anything the office adds, changes
   or removes is kept beside it and layered on at read time, so the original
   figures are never lost and every change can be undone.                   */

import { useState, useCallback, useMemo } from 'react'

interface Overlay<T> {
  added: T[]
  edited: Record<string, Partial<T>>
  deleted: string[]
}

const KEY = (c: string) => `vsa-crud-${c}`
const empty = <T,>(): Overlay<T> => ({ added: [], edited: {}, deleted: [] })

function read<T>(collection: string): Overlay<T> {
  try {
    const raw = localStorage.getItem(KEY(collection))
    if (!raw) return empty<T>()
    const p = JSON.parse(raw)
    return { added: p.added ?? [], edited: p.edited ?? {}, deleted: p.deleted ?? [] }
  } catch { return empty<T>() }
}

function write<T>(collection: string, o: Overlay<T>) {
  try { localStorage.setItem(KEY(collection), JSON.stringify(o)) } catch { /* storage full or blocked */ }
}

export interface Crud<T> {
  rows: T[]
  add: (rec: T) => void
  /** Adds a whole sheet in one go. Calling add() in a loop would only keep
      the last row, since each call reads the same unchanged state. */
  addMany: (recs: T[]) => void
  update: (id: string, patch: Partial<T>) => void
  remove: (id: string) => void
  restore: () => void
  isNew: (id: string) => boolean
  isEdited: (id: string) => boolean
  changes: number
}

/**
 * @param collection storage name, unique per register
 * @param seed       the shipped rows
 * @param idOf       how to read a row's identity
 */
export function useCrud<T>(collection: string, seed: T[], idOf: (r: T) => string): Crud<T> {
  const [o, setO] = useState<Overlay<T>>(() => read<T>(collection))

  const save = useCallback((next: Overlay<T>) => { setO(next); write(collection, next) }, [collection])

  const rows = useMemo(() => {
    const gone = new Set(o.deleted)
    const merged = [...o.added, ...seed]
      .filter(r => !gone.has(idOf(r)))
      .map(r => {
        const patch = o.edited[idOf(r)]
        return patch ? { ...r, ...patch } : r
      })
    return merged
  }, [seed, o, idOf])

  const addedIds = useMemo(() => new Set(o.added.map(idOf)), [o.added, idOf])

  return {
    rows,
    add:     rec => save({ ...o, added: [rec, ...o.added] }),
    addMany: recs => recs.length ? save({ ...o, added: [...recs, ...o.added] }) : undefined,
    update:  (id, patch) => addedIds.has(id)
      ? save({ ...o, added: o.added.map(r => idOf(r) === id ? { ...r, ...patch } : r) })
      : save({ ...o, edited: { ...o.edited, [id]: { ...o.edited[id], ...patch } } }),
    remove:  id => addedIds.has(id)
      ? save({ ...o, added: o.added.filter(r => idOf(r) !== id) })
      : save({ ...o, deleted: [...o.deleted, id] }),
    restore: () => save(empty<T>()),
    isNew:    id => addedIds.has(id),
    isEdited: id => id in o.edited,
    changes: o.added.length + Object.keys(o.edited).length + o.deleted.length,
  }
}

/** Next running number for a register, e.g. VSA/26-27/0184. */
export function nextNo(existing: string[], prefix: string, pad = 4) {
  const nums = existing
    .map(n => Number(n.split('/').pop()))
    .filter(n => Number.isFinite(n)) as number[]
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `${prefix}${String(next).padStart(pad, '0')}`
}
