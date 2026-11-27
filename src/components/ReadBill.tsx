/* ── Reading the bill that was uploaded ────────────────────────────────────
   Theirs, on 27-11: "ella bill upload panna varanum" — upload a bill and it
   should come in.

   It comes in, read here on the machine, and then it waits. Everything the
   reader made of the paper is laid out beside what it saw, the weak lines
   are marked, and nothing reaches the sheet until somebody presses the
   button. That is not caution for its own sake: a weight per piece taken
   off a misread figure follows that section through every job afterwards,
   and nobody would find it.                                               */

import { useState } from 'react'
import {
  Sparkles, Trash2, CircleCheck, AlertTriangle, ArrowRight, Loader2, Eye,
} from 'lucide-react'
import { readPaper, type ReadResult } from '@/lib/readpaper'
import { candidatesFrom, perPieceOf, type Candidate } from '@/lib/billparse'
import { paperBlob, type Paper } from '@/lib/papers'
import { useCrud } from '@/lib/store'
import { productById } from '@/data/productmaster'
import { useAliases } from '@/lib/useAliases'
import type { OwnLine } from '@/components/OwnManualSheet'

const NO_LINES: OwnLine[] = []
const idOf = (l: OwnLine) => l.id

export default function ReadBill({ paper }: { paper: Paper }) {
  const [busy, setBusy] = useState('')
  const [pct, setPct] = useState(0)
  const [result, setResult] = useState<ReadResult | null>(null)
  const [rows, setRows] = useState<Candidate[]>([])
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [showRaw, setShowRaw] = useState(false)

  const crud = useCrud<OwnLine>('own-manual-sheet', NO_LINES, idOf)
  const { ours } = useAliases('depot')

  const read = async () => {
    setError(''); setDone(''); setResult(null); setRows([]); setPct(0)
    setBusy('Opening the paper')
    try {
      const blob = await paperBlob(paper.id)
      if (!blob) throw new Error('that paper is no longer on this machine')
      if (blob.type === 'application/pdf') {
        throw new Error('a PDF cannot be read here yet — photograph the page instead')
      }
      const res = await readPaper(blob, p => { setBusy(p.stage); setPct(p.pct) })
      setResult(res)
      setRows(candidatesFrom(res.lines))
      setBusy('')
    } catch (e) {
      setBusy('')
      setError(e instanceof Error ? e.message : 'the paper could not be read')
    }
  }

  const set = (id: string, patch: Partial<Candidate>) =>
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))

  const keep = () => {
    /* Oldest at the bottom: the sheet reads top to bottom and addMany puts
       the newest first, so they go in the other way round. */
    const lines: OwnLine[] = [...rows].reverse().map((r, i) => ({
      id: `own-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 5)}`,
      written: r.written, lengthFt: r.lengthFt,
      pieces: r.pieces, netWeightKg: r.netWeightKg,
    }))
    crud.addMany(lines)
    setDone(`${lines.length} ${lines.length === 1 ? 'line is' : 'lines are'} on your sheet — open "Write your own sheet" to check them.`)
    setRows([])
  }

  const weak = rows.filter(r => r.unsure.length).length

  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-title text-base">Read This Bill</p>
          <p className="section-sub max-w-3xl">
            It is read here on this machine. A printed depot bill reads well; handwriting reads roughly, so
            nothing goes onto your sheet until you have looked at it. The reader is fetched once the first
            time, and kept after that.
          </p>
        </div>
        <button className="btn shrink-0" disabled={!!busy} onClick={read}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {busy ? 'Reading…' : 'Read this bill'}
        </button>
      </div>

      {busy && (
        <div className="mt-4">
          <p className="text-[12px] mb-1" style={{ color: 'var(--text-3)' }}>{busy}… {pct}%</p>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-card2)' }}>
            <div className="h-full transition-all" style={{ width: `${pct}%`, background: 'var(--brand)' }} />
          </div>
        </div>
      )}

      {error && (
        <p className="text-[11.5px] mt-3 flex items-start gap-1.5" style={{ color: 'var(--red)' }}>
          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {done && (
        <p className="text-[11.5px] mt-3 flex items-start gap-1.5" style={{ color: 'var(--green)' }}>
          <CircleCheck size={12} className="mt-0.5 shrink-0" /> {done}
        </p>
      )}

      {result && !rows.length && !done && (
        <p className="text-[12px] mt-4" style={{ color: 'var(--text-3)' }}>
          Nothing on that page read as a line of goods. If it is handwritten this is ordinary — the next tab
          takes the same lines typed, and every shorthand you teach there is known from then on.
        </p>
      )}

      {rows.length > 0 && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-[12px]" style={{ color: 'var(--text-2)' }}>
              <b>{rows.length}</b> {rows.length === 1 ? 'line' : 'lines'} read
              {weak > 0 && <> · <span style={{ color: 'var(--amber)' }}>{weak} to check</span></>}
              {result && <> · the reader's own confidence {result.confidence}%</>}
            </p>
            <button className="btn-ghost !text-xs" onClick={() => setShowRaw(v => !v)}>
              <Eye size={13} /> {showRaw ? 'Hide what it saw' : 'Show what it saw'}
            </button>
          </div>

          <div className="overflow-auto -mx-1 px-1" style={{ maxHeight: '26rem' }}>
            <table className="w-full">
              <thead>
                <tr>
                  <th>Written</th><th>Length</th><th className="num">Qty</th>
                  <th className="num">Net weight</th><th /><th>Product</th>
                  <th className="num">Kg / Piece</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const code = r.written ? ours(r.written) : null
                  const p = productById(code ?? '')
                  return (
                    <tr key={r.id} style={r.unsure.length ? { background: 'var(--bg-card2)' } : undefined}>
                      <td>
                        <input className="input !py-1 !text-xs font-mono w-28" value={r.written}
                          onChange={e => set(r.id, { written: e.target.value.toUpperCase() })} />
                        {showRaw && (
                          <span className="block text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-4)' }}>
                            {r.raw}
                          </span>
                        )}
                      </td>
                      <td>
                        <input className="input !py-1 !text-xs w-20" value={r.lengthFt} placeholder="12'"
                          onChange={e => set(r.id, { lengthFt: e.target.value })} />
                      </td>
                      <td className="num">
                        <input className="input !py-1 !text-xs w-20 text-right" inputMode="numeric"
                          value={r.pieces || ''} placeholder="—"
                          style={r.unsure.includes('pieces') ? { borderColor: 'var(--amber)' } : undefined}
                          onChange={e => set(r.id, { pieces: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })} />
                      </td>
                      <td className="num">
                        <input className="input !py-1 !text-xs w-24 text-right" inputMode="decimal"
                          value={r.netWeightKg || ''} placeholder="—"
                          style={r.unsure.includes('weight') ? { borderColor: 'var(--amber)' } : undefined}
                          onChange={e => {
                            const v = e.target.value
                            if (!/^\d*\.?\d*$/.test(v)) return
                            set(r.id, { netWeightKg: Number(v) || 0 })
                          }} />
                      </td>
                      <td className="px-1">
                        <ArrowRight size={13} style={{ color: code ? 'var(--green)' : 'var(--text-4)' }} />
                      </td>
                      <td className="text-xs max-w-[13rem] truncate"
                        style={{ color: code ? 'var(--text-2)' : 'var(--text-4)' }}>
                        {p?.name ?? <span className="badge-yellow !text-[9px]">teach it on your sheet</span>}
                      </td>
                      <td className="num tabular-nums text-xs font-semibold" style={{ color: 'var(--brand)' }}>
                        {perPieceOf(r) || '—'}
                      </td>
                      <td>
                        <button className="p-1 text-red-500" title="This is not a line of goods"
                          onClick={() => setRows(rs => rs.filter(x => x.id !== r.id))}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3"
            style={{ borderTop: '1px solid var(--border-2)' }}>
            <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>
              An amber box is one the reader was not sure of. Correct what is wrong, throw away what is not a
              line of goods, and keep the rest.
            </p>
            <span className="flex gap-2">
              <button className="btn-outline" onClick={() => setRows([])}>Throw it away</button>
              <button className="btn" onClick={keep}>
                <CircleCheck size={14} /> Put {rows.length} {rows.length === 1 ? 'line' : 'lines'} on my sheet
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
