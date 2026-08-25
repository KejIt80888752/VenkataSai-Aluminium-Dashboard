import { useState, useEffect, useMemo } from 'react'
import { Plus, Pencil, Trash2, Upload, RotateCcw, AlertTriangle, FileSpreadsheet, X } from 'lucide-react'
import { Modal } from '@/components/ui'
import { parseCsv, findHeader, normKey } from '@/lib/csv'
import { cn } from '@/lib/utils'

/* ── A register's fields, described once and reused by the form and import ─ */
export interface Field {
  key: string
  label: string
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox'
  options?: readonly string[]
  required?: boolean
  half?: boolean
  hint?: string
}

export type Rec = Record<string, any>

const blank = (fields: Field[]): Rec =>
  Object.fromEntries(fields.map(f => [f.key,
    f.type === 'number' ? 0 : f.type === 'checkbox' ? true : f.type === 'select' ? (f.options?.[0] ?? '') : '']))

const coerce = (f: Field, v: any) =>
  f.type === 'number' ? (Number(v) || 0) : f.type === 'checkbox' ? Boolean(v) : String(v ?? '')

/* ── Add / edit one record ─────────────────────────────────────────────── */
export function RecordModal({ open, title, fields, initial, onSave, onClose, onDelete }: {
  open: boolean
  title: string
  fields: Field[]
  initial?: Rec | null
  onSave: (rec: Rec) => void
  onClose: () => void
  onDelete?: () => void
}) {
  const [v, setV] = useState<Rec>(() => initial ?? blank(fields))
  const [touched, setTouched] = useState(false)

  useEffect(() => { if (open) { setV(initial ?? blank(fields)); setTouched(false) } }, [open, initial, fields])

  const missing = fields.filter(f => f.required && String(v[f.key] ?? '').trim() === '')

  const submit = () => {
    setTouched(true)
    if (missing.length) return
    onSave(Object.fromEntries(fields.map(f => [f.key, coerce(f, v[f.key])])))
  }

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
          {fields.map(f => {
            const bad = touched && f.required && String(v[f.key] ?? '').trim() === ''
            return (
              <div key={f.key} className={f.half === false || f.type === 'textarea' ? 'sm:col-span-2' : undefined}>
                <label className="label">
                  {f.label}{f.required && <span style={{ color: 'var(--red)' }}> *</span>}
                </label>

                {f.type === 'select' ? (
                  <select className="input w-full" value={v[f.key] ?? ''}
                    onChange={e => setV(s => ({ ...s, [f.key]: e.target.value }))}>
                    {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea className="input w-full min-h-[4.5rem]" value={v[f.key] ?? ''}
                    onChange={e => setV(s => ({ ...s, [f.key]: e.target.value }))} />
                ) : f.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 text-sm py-2" style={{ color: 'var(--text-2)' }}>
                    <input type="checkbox" className="accent-[var(--brand)]" checked={!!v[f.key]}
                      onChange={e => setV(s => ({ ...s, [f.key]: e.target.checked }))} />
                    {f.hint ?? 'Yes'}
                  </label>
                ) : (
                  <input
                    className={cn('input w-full', f.type === 'number' && 'text-right tabular-nums')}
                    type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                    value={v[f.key] ?? ''} style={bad ? { borderColor: 'var(--red)' } : undefined}
                    onChange={e => setV(s => ({ ...s, [f.key]: e.target.value }))} />
                )}

                {f.hint && f.type !== 'checkbox' &&
                  <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-4)' }}>{f.hint}</p>}
              </div>
            )
          })}
        </div>

        {touched && missing.length > 0 && (
          <p className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--red)' }}>
            <AlertTriangle size={12} /> Fill in {missing.map(f => f.label).join(', ')}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-3" style={{ borderTop: '1px solid var(--border-2)' }}>
          {onDelete
            ? <button className="btn-ghost !text-xs" style={{ color: 'var(--red)' }} onClick={onDelete}>
                <Trash2 size={13} /> Delete
              </button>
            : <span />}
          <span className="flex gap-2">
            <button className="btn-outline" onClick={onClose}>Cancel</button>
            <button className="btn" onClick={submit}>Save</button>
          </span>
        </div>
      </div>
    </Modal>
  )
}

/* ── Pencil and bin on a table row ─────────────────────────────────────── */
export function RowActions({ onEdit, onDelete, label }: {
  onEdit: () => void; onDelete: () => void; label?: string
}) {
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <span className="flex items-center gap-1 justify-end">
        <button className="btn-ghost !px-1.5 !py-1" title="Edit"
          onClick={e => { e.stopPropagation(); onEdit() }}><Pencil size={13} /></button>
        <button className="btn-ghost !px-1.5 !py-1" title="Delete" style={{ color: 'var(--red)' }}
          onClick={e => { e.stopPropagation(); setConfirm(true) }}><Trash2 size={13} /></button>
      </span>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Delete this record?">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            {label ? <>“{label}” will be removed from this register.</> : 'This row will be removed from the register.'}
            {' '}Nothing is lost for good — Undo all changes on this page brings it back.
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setConfirm(false)}>Keep it</button>
            <button className="btn" style={{ background: 'var(--red)' }}
              onClick={() => { setConfirm(false); onDelete() }}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

/* ── Add, bulk upload, and undo, in one strip ──────────────────────────── */
export function CrudBar({ noun, fields, onAdd, onImport, changes, onRestore }: {
  noun: string
  fields: Field[]
  onAdd: (rec: Rec) => void
  onImport?: (rows: Rec[]) => void
  changes: number
  onRestore: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)

  return (
    <>
      {changes > 0 && (
        <button className="btn-ghost !text-xs" onClick={onRestore} title="Undo every change made on this page">
          <RotateCcw size={13} /> {changes} {changes === 1 ? 'change' : 'changes'} — undo all
        </button>
      )}
      {onImport && (
        <button className="btn-outline" onClick={() => setImporting(true)}>
          <Upload size={14} /> Upload
        </button>
      )}
      <button className="btn" onClick={() => setAdding(true)}><Plus size={14} /> Add {noun}</button>

      <RecordModal open={adding} title={`New ${noun.toLowerCase()}`} fields={fields}
        onSave={rec => { onAdd(rec); setAdding(false) }} onClose={() => setAdding(false)} />

      {onImport && (
        <ImportModal open={importing} noun={noun} fields={fields}
          onClose={() => setImporting(false)}
          onImport={rows => { onImport(rows); setImporting(false) }} />
      )}
    </>
  )
}

/* ── Bulk upload from a spreadsheet ────────────────────────────────────── */
function ImportModal({ open, noun, fields, onImport, onClose }: {
  open: boolean; noun: string; fields: Field[]; onImport: (rows: Rec[]) => void; onClose: () => void
}) {
  const [file, setFile] = useState<{ name: string; header: string[]; body: string[][] } | null>(null)
  const [map, setMap] = useState<Record<string, number>>({})

  const load = (f: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const all = parseCsv(String(reader.result ?? ''))
      if (!all.length) return
      const hi = findHeader(all)
      const header = all[hi]
      const body = all.slice(hi + 1).filter(r => r.some(c => String(c).trim() !== ''))
      // Line up columns whose names look like our fields; the rest can be picked by hand.
      const guess: Record<string, number> = {}
      for (const fd of fields) {
        const want = normKey(fd.label)
        const idx = header.findIndex(h => normKey(h) === want)
        if (idx >= 0) guess[fd.key] = idx
      }
      setFile({ name: f.name, header, body }); setMap(guess)
    }
    reader.readAsText(f)
  }

  const rows = useMemo(() => {
    if (!file) return []
    return file.body.map(r => Object.fromEntries(fields.map(fd => {
      const i = map[fd.key]
      const raw = i === undefined ? '' : r[i]
      return [fd.key, coerce(fd, fd.type === 'number' ? String(raw).replace(/[^0-9.-]/g, '') : raw)]
    })))
  }, [file, map, fields])

  const mapped = Object.keys(map).length

  return (
    <Modal open={open} onClose={onClose} title={`Upload ${noun.toLowerCase()}s from a spreadsheet`} wide>
      <div className="space-y-4">
        {!file ? (
          <>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Save the sheet as CSV and choose it here. Column names are matched to the fields automatically, and
              anything it cannot place can be picked by hand. The file is read on this computer only.
            </p>
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg py-10 cursor-pointer"
              style={{ border: '1.5px dashed var(--border-2)' }}>
              <Upload size={22} style={{ color: 'var(--text-4)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>Choose a .csv file</span>
              <input type="file" accept=".csv,text/csv" className="hidden"
                onChange={e => e.target.files?.[0] && load(e.target.files[0])} />
            </label>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 rounded-lg p-3"
              style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
              <span className="flex items-center gap-2 text-sm min-w-0" style={{ color: 'var(--text-1)' }}>
                <FileSpreadsheet size={15} className="text-brand shrink-0" />
                <span className="truncate">{file.name}</span>
                <span className="text-xs shrink-0" style={{ color: 'var(--text-4)' }}>
                  {file.body.length} rows · {mapped} of {fields.length} columns matched
                </span>
              </span>
              <button className="btn-ghost !px-2 shrink-0" onClick={() => { setFile(null); setMap({}) }}><X size={14} /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 max-h-60 overflow-y-auto pr-1">
              {fields.map(fd => (
                <div key={fd.key} className="flex items-center justify-between gap-2">
                  <span className="text-xs truncate" style={{ color: 'var(--text-2)' }}>
                    {fd.label}{fd.required && <span style={{ color: 'var(--red)' }}> *</span>}
                  </span>
                  <select className="input !w-40 !py-1 !text-xs shrink-0"
                    value={map[fd.key] ?? -1}
                    onChange={e => setMap(m => {
                      const n = { ...m }
                      if (Number(e.target.value) < 0) delete n[fd.key]; else n[fd.key] = Number(e.target.value)
                      return n
                    })}>
                    <option value={-1}>— not in file —</option>
                    {file.header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--border-2)' }}>
              <button className="btn-outline" onClick={onClose}>Cancel</button>
              <button className="btn" disabled={!mapped} onClick={() => onImport(rows)}>
                <Upload size={14} /> Add {file.body.length} {noun.toLowerCase()}{file.body.length === 1 ? '' : 's'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

/** Marks rows the office has touched, so edits are visible at a glance. */
export function EditedDot({ isNew, isEdited }: { isNew?: boolean; isEdited?: boolean }) {
  if (!isNew && !isEdited) return null
  return (
    <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
      title={isNew ? 'Added here' : 'Edited here'}
      style={{ background: isNew ? 'var(--green)' : 'var(--brand)' }} />
  )
}
