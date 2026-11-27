/* ── Their own counter book, typed in ──────────────────────────────────────
   Theirs, on 27-11 on the call: "I don't have access to it, sir" — and then,
   plainly: give them the manual bill the way they would do it, so they can
   try it themselves.

   The screen beside this one shows their 13-02 depot sheet and what the
   system made of it. It reads beautifully and it is somebody else's sheet:
   there was no way for the shop to write a sheet of their own and watch the
   same thing happen. This is that.

   Nothing is guessed here either. A shorthand nobody has explained stays
   unexplained until somebody points it at a product, because a wrong mapping
   would quietly spoil the weight per piece of every job cut from that
   section afterwards. It is the one alias table the purchase sheet and the
   coating book read, so a word taught here is known on all three.        */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  PenLine, ArrowRight, Plus, Trash2, Info, FileInput, RotateCcw, CircleCheck,
} from 'lucide-react'
import { SectionPicker } from '@/components/SectionPicker'
import { PICK_OPTIONS, productById } from '@/data/productmaster'
import { useAliases } from '@/lib/useAliases'
import { useCrud } from '@/lib/store'
import { kg as kgFmt, cn, fmtDate } from '@/lib/utils'
import { TODAY } from '@/data/company'

export interface OwnLine {
  id: string
  /** exactly as it is written on the paper — SP, DP, DIV, CUPC */
  written: string
  lengthFt: string
  pieces: number
  netWeightKg: number
}

const NO_LINES: OwnLine[] = []
const idOf = (l: OwnLine) => l.id

const blank = (): OwnLine => ({
  id: `own-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  written: '', lengthFt: '', pieces: 0, netWeightKg: 0,
})

/** What one piece weighs, which is the whole reason the sheet is typed. */
const perPiece = (l: OwnLine) =>
  l.pieces > 0 ? +(l.netWeightKg / l.pieces).toFixed(3) : 0

export default function OwnManualSheet() {
  const { ours, teach } = useAliases('depot')
  const crud = useCrud<OwnLine>('own-manual-sheet', NO_LINES, idOf)

  /* Added rows come back newest first; a sheet reads top to bottom. */
  const lines = useMemo(() => [...crud.rows].reverse(), [crud.rows])

  /** Each distinct shorthand on this sheet, and what it has been taught as. */
  const shorthands = useMemo(() => {
    const seen = new Map<string, number>()
    for (const l of lines) {
      const w = l.written.trim().toUpperCase()
      if (w) seen.set(w, (seen.get(w) ?? 0) + 1)
    }
    return [...seen.entries()]
      .map(([written, count]) => ({ written, count, code: ours(written) ?? '' }))
      .sort((a, b) => b.count - a.count)
  }, [lines, ours])

  const written = lines.filter(l => l.written.trim())
  const readable = written.filter(l => ours(l.written.trim().toUpperCase())).length
  const known = shorthands.filter(s => s.code)

  const totalPieces = lines.reduce((s, l) => s + l.pieces, 0)
  const totalKg = +lines.reduce((s, l) => s + l.netWeightKg, 0).toFixed(3)

  const set = (id: string, patch: Partial<OwnLine>) => crud.update(id, patch)

  return (
    <div className="space-y-5">
      <div className="rounded-lg p-3.5 flex items-start gap-2 text-[12px]"
        style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)', color: 'var(--text-3)' }}>
        <Info size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} />
        <span>
          <b style={{ color: 'var(--text-1)' }}>This one is yours to write.</b> Type a sheet the way it
          comes off your counter book — the shorthand in your own hand, the length, the pieces and the
          net weight. What the system makes of each line appears beside it as you go. A shorthand it has
          not been told about waits to be told; point it at a product once and it is known here, on the
          purchase sheet and in the coating book from then on. Nothing you type here goes anywhere until
          you send it.
        </span>
      </div>

      {/* ── How much of your sheet reads itself ──────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { k: 'Lines you have written', v: String(written.length), s: fmtDate(TODAY) },
          {
            k: 'Read without being asked',
            v: written.length ? `${readable} of ${written.length}` : '—',
            s: !written.length ? 'start typing below'
              : readable === written.length ? 'the whole sheet'
              : `${written.length - readable} still to be told`,
            tone: written.length && readable === written.length ? 'var(--green)'
              : written.length ? 'var(--amber)' : undefined,
          },
          {
            k: 'Shorthands learned',
            v: shorthands.length ? `${known.length} of ${shorthands.length}` : '—',
            s: 'remembered for every later sheet',
            tone: shorthands.length && known.length === shorthands.length ? 'var(--green)' : undefined,
          },
        ].map(x => (
          <div key={x.k} className="card">
            <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{x.k}</p>
            <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: x.tone ?? 'var(--text-1)' }}>{x.v}</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-4)' }}>{x.s}</p>
          </div>
        ))}
      </div>

      {/* ── Teaching it what you wrote ───────────────────────────────────── */}
      {shorthands.length > 0 && (
        <div className="card" style={known.length < shorthands.length ? { borderColor: 'var(--amber)' } : undefined}>
          <p className="section-title text-base mb-1">Your Shorthand</p>
          <p className="section-sub mb-4 max-w-4xl">
            Point each at a product once. An untaught code stays untaught until somebody says what it is —
            a wrong mapping would spoil the weight per piece of every job cut from that section afterwards.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {shorthands.map(s => (
              <div key={s.written} className="flex flex-wrap items-center justify-between gap-3 rounded-lg p-2.5"
                style={{
                  background: 'var(--bg-card2)',
                  border: `1px solid ${s.code ? 'var(--border-2)' : 'var(--amber)'}`,
                }}>
                <div className="min-w-0">
                  <span className="font-mono text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{s.written}</span>
                  <span className="text-[11px] ml-2" style={{ color: 'var(--text-4)' }}>
                    on {s.count} {s.count === 1 ? 'line' : 'lines'}
                  </span>
                </div>
                <SectionPicker className="w-56 shrink-0" options={PICK_OPTIONS}
                  value={s.code} onChange={c => teach(s.written, c)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── The sheet itself ─────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <p className="section-title text-base">Your Sheet, Line by Line</p>
            <p className="section-sub">What you write on the left, the record it becomes on the right</p>
          </div>
          <div className="flex gap-2">
            {crud.changes > 0 && (
              <button className="btn-outline !py-1 !text-xs" onClick={crud.restore}
                title="Clear this sheet and start again. Shorthand you have taught is kept.">
                <RotateCcw size={13} /> Start a new sheet
              </button>
            )}
            <Link to="/purchase-dc" className="btn-outline !py-1 !text-xs">
              <FileInput size={13} /> Open the purchase DC screen
            </Link>
          </div>
        </div>

        <div className="overflow-auto -mx-1 px-1" style={{ maxHeight: '30rem' }}>
          <table className="w-full">
            <thead>
              <tr>
                <th className="num !pr-5">Sl</th>
                <th><span className="flex items-center gap-1.5"><PenLine size={11} /> Written</span></th>
                <th>Length</th>
                <th className="num">Qty</th>
                <th className="num">Net weight</th>
                <th />
                <th>Code</th>
                <th>Product</th>
                <th className="num">Kg / Piece</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const w = l.written.trim().toUpperCase()
                const code = w ? ours(w) : null
                const p = productById(code ?? '')
                return (
                  <tr key={l.id}>
                    <td className="num tabular-nums text-xs !pr-5" style={{ color: 'var(--text-4)' }}>{i + 1}</td>
                    <td>
                      <input className="input !py-1 !text-xs font-mono w-28" value={l.written}
                        placeholder="SP" onChange={e => set(l.id, { written: e.target.value })} />
                    </td>
                    <td>
                      <input className="input !py-1 !text-xs w-20" value={l.lengthFt}
                        placeholder="12'" onChange={e => set(l.id, { lengthFt: e.target.value })} />
                    </td>
                    <td className="num">
                      <input className="input !py-1 !text-xs w-20 text-right" inputMode="numeric"
                        value={l.pieces || ''} placeholder="0"
                        onChange={e => set(l.id, { pieces: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })} />
                    </td>
                    <td className="num">
                      <input className="input !py-1 !text-xs w-24 text-right" inputMode="decimal"
                        value={l.netWeightKg || ''} placeholder="0.000"
                        onChange={e => {
                          const raw = e.target.value
                          if (!/^\d*\.?\d*$/.test(raw)) return
                          set(l.id, { netWeightKg: Number(raw) || 0 })
                        }} />
                    </td>
                    <td className="px-1">
                      <ArrowRight size={13} style={{ color: code ? 'var(--green)' : 'var(--text-4)' }} />
                    </td>
                    <td className="font-mono text-xs whitespace-nowrap"
                      style={{ color: code ? 'var(--text-1)' : 'var(--text-4)' }}>{p?.code ?? '—'}</td>
                    <td className="text-xs max-w-[14rem] truncate"
                      style={{ color: code ? 'var(--text-2)' : 'var(--text-4)' }}
                      title={p?.name ?? 'not taught yet'}>
                      {p?.name ?? (w
                        ? <span className="badge-yellow !text-[9px]">waiting to be told</span>
                        : <span style={{ color: 'var(--text-4)' }}>—</span>)}
                    </td>
                    <td className="num tabular-nums text-xs font-semibold" style={{ color: 'var(--brand)' }}>
                      {perPiece(l) || '—'}
                    </td>
                    <td>
                      <button className="p-1 text-red-500" title="Take this line off the sheet"
                        onClick={() => crud.remove(l.id)}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                )
              })}
              {!lines.length && (
                <tr><td colSpan={10} className="py-10 text-center text-sm" style={{ color: 'var(--text-4)' }}>
                  Nothing written yet. Add a line and type it as it is on the paper.
                </td></tr>
              )}
            </tbody>
            {lines.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border-2)' }}>
                  <td colSpan={3} className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>Total</td>
                  <td className="num tabular-nums font-bold" style={{ color: 'var(--brand)' }}>{totalPieces}</td>
                  <td className="num tabular-nums font-bold" style={{ color: 'var(--brand)' }}>{kgFmt(totalKg)}</td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
          <button className="btn-outline" onClick={() => crud.add(blank())}>
            <Plus size={14} /> Add a line
          </button>
          <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>
            This sheet is kept on this machine as you type, so it is still here if you close the screen.
          </span>
        </div>

        {written.length > 0 && readable === written.length && (
          <p className={cn('text-[11.5px] mt-3 pt-3 flex items-start gap-1.5')}
            style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
            <CircleCheck size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--green)' }} />
            Every line on your sheet now reads itself. The next sheet carrying the same shorthand will too,
            without anybody being asked again.
          </p>
        )}
      </div>
    </div>
  )
}
