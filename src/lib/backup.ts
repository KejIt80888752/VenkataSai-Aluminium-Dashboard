/* ── Every register, in one copy that can be carried out and brought back ──
   Theirs, on 27-11: "that estimate is lost, again we have to redo."

   The office writes its day into this machine. Until today the Backup card
   offered a file that held the company name and nothing else, and the one
   button that could empty a register asked nothing before it did. A day's
   work could go and leave no way back.

   So: every register is read into one file that can be taken out and put
   back, and a copy is kept here on the machine before anything is removed
   and once a day besides, so there is always a yesterday to return to.    */

import { COMPANY, FY } from '@/data/company'

/** Snapshots live under their own key and are never backed up into themselves. */
const SNAP_KEY = 'vsa-snapshots'
/** The fingerprint enrolment is this machine's, not the company's data. */
const SKIP = new Set([SNAP_KEY, 'vsa-bio-user'])
const KEEP = 8

export interface Snapshot {
  at: string
  why: string
  keys: number
  bytes: number
  data: Record<string, string>
}

/** Everything the office has written on this machine. */
export function collect(): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || !k.startsWith('vsa-') || SKIP.has(k)) continue
    const v = localStorage.getItem(k)
    if (v != null) out[k] = v
  }
  return out
}

export const sizeOf = (d: Record<string, string>) =>
  Object.entries(d).reduce((s, [k, v]) => s + k.length + v.length, 0)

export function snapshots(): Snapshot[] {
  try {
    const raw = localStorage.getItem(SNAP_KEY)
    const p = raw ? JSON.parse(raw) : []
    return Array.isArray(p) ? p : []
  } catch { return [] }
}

/** A copy kept here on the machine. Oldest ones go when the drawer is full. */
export function takeSnapshot(why: string): Snapshot | null {
  try {
    const data = collect()
    if (!Object.keys(data).length) return null
    const snap: Snapshot = {
      at: new Date().toISOString(), why,
      keys: Object.keys(data).length, bytes: sizeOf(data), data,
    }
    let kept = [snap, ...snapshots()].slice(0, KEEP)
    /* The drawer is small. Rather than fail silently and leave the office
       thinking a copy was taken, give up the oldest until it fits. */
    for (;;) {
      try { localStorage.setItem(SNAP_KEY, JSON.stringify(kept)); return snap }
      catch { if (kept.length <= 1) return null; kept = kept.slice(0, kept.length - 1) }
    }
  } catch { return null }
}

/** At most one a day, so opening the screen ten times keeps ten days, not ten opens. */
export function snapshotDaily() {
  const today = new Date().toISOString().slice(0, 10)
  const last = snapshots()[0]
  if (last && last.at.slice(0, 10) === today && last.why === 'daily copy') return
  takeSnapshot('daily copy')
}

/** Put a copy back. Everything written since is kept as a copy of its own first. */
export function putBack(data: Record<string, string>): number {
  takeSnapshot('before a copy was put back')
  let n = 0
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith('vsa-') || SKIP.has(k) || typeof v !== 'string') continue
    try { localStorage.setItem(k, v); n++ } catch { /* no room */ }
  }
  return n
}

export interface BackupFile {
  company: string
  gstin: string
  financialYear: string
  takenAt: string
  keys: number
  data: Record<string, string>
}

export function backupFile(): BackupFile {
  const data = collect()
  return {
    company: COMPANY.name, gstin: COMPANY.gstin, financialYear: FY,
    takenAt: new Date().toISOString(), keys: Object.keys(data).length, data,
  }
}

export function downloadBackup() {
  const file = backupFile()
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `vsa-backup-${file.takenAt.slice(0, 10)}-${file.takenAt.slice(11, 16).replace(':', '')}.json`
  a.click(); URL.revokeObjectURL(a.href)
  return file
}

/** Reads a file the office chose. Anything that is not one of ours is refused. */
export function readBackup(text: string): { data: Record<string, string>; takenAt?: string } | null {
  try {
    const p = JSON.parse(text)
    const data = p?.data
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    const clean: Record<string, string> = {}
    for (const [k, v] of Object.entries(data)) {
      if (typeof k === 'string' && k.startsWith('vsa-') && typeof v === 'string') clean[k] = v
    }
    return Object.keys(clean).length ? { data: clean, takenAt: typeof p.takenAt === 'string' ? p.takenAt : undefined } : null
  } catch { return null }
}

export const whenOf = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} · ${p(d.getHours())}:${p(d.getMinutes())}`
}

export const kb = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(2)} MB`
