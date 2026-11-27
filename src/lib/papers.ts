/* ── The paper itself, kept on the machine ─────────────────────────────────
   Theirs, on 27-11: "hand written bills unable to upload."

   They were right: there was nowhere to put one. The capture screen showed a
   sheet somebody had already typed, and the honest note underneath said that
   nothing here reads a photograph — but it never offered to hold the paper
   either, and a shop that is typing from a counter book wants the book on
   the same screen as the typing.

   So a bill can be photographed or chosen here and it stays. A photograph
   off a phone is three or four megabytes and the browser's small store holds
   about five in all, so these go in the machine's own database instead,
   where there is room for hundreds of them — scaled to 1600px on the long
   side, which is enough to read a pencil figure off, and small enough to
   open at once.

   It stays on this machine. Nothing is uploaded anywhere: until the shop has
   a server of its own there is nowhere to send it, and the paper is theirs.  */

import { useEffect, useState } from 'react'

const DB = 'vsa-papers'
const STORE = 'papers'
const EDGE = 1600
const QUALITY = 0.72

export interface Paper {
  id: string
  name: string
  /** image/jpeg, or application/pdf where the office scanned to one */
  type: string
  bytes: number
  at: string
  /** a pencil note the office puts against it, e.g. "Mahaveer 13-02" */
  note?: string
}

interface Stored extends Paper { blob: Blob }

let ready: Promise<IDBDatabase> | null = null
const open = () => ready ??= new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open(DB, 1)
  req.onupgradeneeded = () => {
    const db = req.result
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
  }
  req.onsuccess = () => resolve(req.result)
  req.onerror = () => reject(req.error ?? new Error('this browser will not keep files'))
})

const tx = async <T,>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = run(t.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/* Everything on the screen is told when a paper comes or goes. */
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(f => f())

export const listPapers = async (): Promise<Paper[]> => {
  const all = await tx<Stored[]>('readonly', s => s.getAll() as IDBRequest<Stored[]>)
  return all
    .map(({ blob: _blob, ...rest }) => rest)
    .sort((a, b) => b.at.localeCompare(a.at))
}

export const paperBlob = async (id: string): Promise<Blob | undefined> => {
  const row = await tx<Stored | undefined>('readonly', s => s.get(id) as IDBRequest<Stored | undefined>)
  return row?.blob
}

export const removePaper = async (id: string) => {
  await tx('readwrite', s => s.delete(id))
  emit()
}

export const notePaper = async (id: string, note: string) => {
  const row = await tx<Stored | undefined>('readonly', s => s.get(id) as IDBRequest<Stored | undefined>)
  if (!row) return
  await tx('readwrite', s => s.put({ ...row, note }))
  emit()
}

/** A phone photograph, brought down to something a screen can open at once. */
const shrink = (file: File): Promise<Blob> => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('that file is not a picture')) }
  img.onload = () => {
    URL.revokeObjectURL(url)
    const scale = Math.min(1, EDGE / Math.max(img.width, img.height))
    /* Already small enough — kept as it came rather than re-encoded, which
       only ever loses a little more of a pencil line. */
    if (scale === 1 && file.size < 900_000) return resolve(file)
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return reject(new Error('this browser cannot resize a picture'))
    ctx.drawImage(img, 0, 0, w, h)
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('could not save that picture')), 'image/jpeg', QUALITY)
  }
  img.src = url
})

export interface AddResult { added: Paper[]; refused: { name: string; why: string }[] }

/** Photographs and scans, as many as were chosen at once. */
export async function addPapers(files: FileList | File[]): Promise<AddResult> {
  const added: Paper[] = []
  const refused: { name: string; why: string }[] = []
  for (const file of Array.from(files)) {
    try {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
      if (!isPdf && !file.type.startsWith('image/')) {
        refused.push({ name: file.name, why: 'not a picture or a PDF' }); continue
      }
      const blob = isPdf ? file : await shrink(file)
      const row: Stored = {
        id: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name, type: isPdf ? 'application/pdf' : 'image/jpeg',
        bytes: blob.size, at: new Date().toISOString(), blob,
      }
      await tx('readwrite', s => s.put(row))
      const { blob: _b, ...meta } = row
      added.push(meta)
    } catch (e) {
      refused.push({ name: file.name, why: e instanceof Error ? e.message : 'could not be read' })
    }
  }
  if (added.length) emit()
  return { added, refused }
}

/** The papers held, kept in step across every screen that is open. */
export function usePapers() {
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const load = () => {
      listPapers()
        .then(p => { if (alive) { setPapers(p); setError('') } })
        .catch(e => { if (alive) setError(e instanceof Error ? e.message : 'could not be read') })
        .finally(() => { if (alive) setLoading(false) })
    }
    load()
    listeners.add(load)
    return () => { alive = false; listeners.delete(load) }
  }, [])

  return { papers, loading, error }
}

export const kb = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`

export const whenOf = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} · ${p(d.getHours())}:${p(d.getMinutes())}`
}

/* ── The one paper somebody is typing from ─────────────────────────────────
   Pinned on the upload tab, opened beside the sheet on the next one. It is
   a choice about the hour's work, so it is kept where the screens can both
   see it rather than inside one of them. */
const PIN = 'vsa-paper-pinned'
let pinned = (() => { try { return localStorage.getItem(PIN) ?? '' } catch { return '' } })()
const pinListeners = new Set<() => void>()

export function setPinnedPaper(id: string) {
  pinned = id
  try { id ? localStorage.setItem(PIN, id) : localStorage.removeItem(PIN) } catch { /* blocked */ }
  pinListeners.forEach(f => f())
}

export function usePinnedPaper(): [string, (id: string) => void] {
  const [id, setId] = useState(pinned)
  useEffect(() => {
    const sync = () => setId(pinned)
    pinListeners.add(sync)
    sync()
    return () => { pinListeners.delete(sync) }
  }, [])
  return [id, setPinnedPaper]
}
