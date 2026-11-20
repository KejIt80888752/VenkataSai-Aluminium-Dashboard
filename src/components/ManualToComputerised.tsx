import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  PenLine, ArrowRight, CircleCheck, Sparkles, Info, FileInput,
} from 'lucide-react'
import { SectionPicker } from '@/components/SectionPicker'
import { PICK_OPTIONS, productById } from '@/data/productmaster'
import { SAMPLE_DC, perPiece } from '@/data/despatch'
import { useAliases } from '@/lib/useAliases'
import { kg as kgFmt, cn } from '@/lib/utils'

/* ── The counter book, turned into records ─────────────────────────────────
   Asked for on 20-11-2026: "AI capture show now. Manual bill to computerised
   show. Should get used to my handwriting and select code."

   What is honest about this, said plainly on the screen rather than buried:
   nothing here reads a photograph. Somebody types what is written, or a scan
   does. What the shop was actually asking for is the part after that — that
   the system stop asking the same question. Their depot writes SP, DP, DIV,
   CUPC; nobody outside the shop knows what those are. Told once, every sheet
   carrying that shorthand afterwards fills itself in, and the same lesson is
   known on the purchase sheet and the coating book because all three read the
   one table.

   So this is their own 13-02 sheet, line by line, with what the system has
   made of each line beside it — and the count of how many it managed without
   being asked.                                                            */

export default function ManualToComputerised() {
  /* The same table the purchase sheet teaches into, so a lesson learned on
     either screen is known on the other. */
  const { ours, teach, map } = useAliases('depot')

  const lines = SAMPLE_DC.lines

  /** Each distinct shorthand on the paper, and what it has been taught as. */
  const shorthands = useMemo(() => {
    const seen = new Map<string, number>()
    for (const l of lines) seen.set(l.particulars, (seen.get(l.particulars) ?? 0) + 1)
    return [...seen.entries()]
      .map(([written, count]) => ({ written, count, code: ours(written) ?? '' }))
      .sort((a, b) => b.count - a.count)
  }, [lines, ours, map])

  const known = shorthands.filter(s => s.code)
  const readable = lines.filter(l => ours(l.particulars)).length

  return (
    <div className="space-y-5">
      <div className="rounded-lg p-3.5 flex items-start gap-2 text-[12px]"
        style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)', color: 'var(--text-3)' }}>
        <Info size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} />
        <span>
          <b style={{ color: 'var(--text-1)' }}>What this does and does not do.</b> It does not read a
          photograph — the figures come off the paper the way they always have. What it does is stop asking
          the same question twice: your depot writes <b>SP</b>, <b>DP</b>, <b>DIV</b>, <b>CUPC</b>, and
          nobody outside your shop knows what those are. Tell it once and every sheet carrying that
          shorthand afterwards fills in its own code — on this screen, on the purchase sheet and in the
          coating book, because all three read the one table.
        </span>
      </div>

      {/* ── How much of the sheet reads itself ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { k: 'Lines on the paper', v: String(lines.length), s: SAMPLE_DC.date },
          {
            k: 'Read without being asked', v: `${readable} of ${lines.length}`,
            s: readable === lines.length ? 'the whole sheet' : `${lines.length - readable} still to be told`,
            tone: readable === lines.length ? 'var(--green)' : 'var(--amber)',
          },
          {
            k: 'Shorthands learned', v: `${known.length} of ${shorthands.length}`,
            s: 'remembered for every later sheet',
            tone: known.length === shorthands.length ? 'var(--green)' : undefined,
          },
        ].map(x => (
          <div key={x.k} className="card">
            <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{x.k}</p>
            <p className="text-2xl font-bold tabular-nums mt-1"
              style={{ color: x.tone ?? 'var(--text-1)' }}>{x.v}</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-4)' }}>{x.s}</p>
          </div>
        ))}
      </div>

      {/* ── Teaching it the shorthand ──────────────────────────────────── */}
      <div className="card" style={known.length < shorthands.length ? { borderColor: 'var(--amber)' } : undefined}>
        <p className="section-title text-base mb-1 flex items-center gap-2">
          <Sparkles size={15} className="text-brand" /> Your Shorthand
        </p>
        <p className="section-sub mb-4 max-w-4xl">
          Point each at a product once. Nothing is guessed here: a wrong mapping would quietly spoil the
          weight per piece of every job cut from that section afterwards, so an untaught code stays untaught
          until somebody says what it is.
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

      {/* ── The sheet, and what was made of it ─────────────────────────── */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <p className="section-title text-base">Manual Sheet, Line by Line</p>
            <p className="section-sub">
              What is on the paper on the left, the record it becomes on the right
            </p>
          </div>
          <Link to="/purchase-dc" className="btn-outline !py-1 !text-xs">
            <FileInput size={13} /> Open it as a purchase DC
          </Link>
        </div>

        <div className="overflow-auto -mx-1 px-1" style={{ maxHeight: '28rem' }}>
          <table className="w-full">
            <thead>
              <tr>
                <th className="num !pr-5">Sl</th>
                <th><span className="flex items-center gap-1.5"><PenLine size={11} /> Written</span></th>
                <th className="num">Qty</th>
                <th className="num">Weight</th>
                <th />
                <th>Code</th>
                <th>Product</th>
                <th className="num">Kg / Piece</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(l => {
                const code = ours(l.particulars)
                const p = productById(code ?? '')
                return (
                  <tr key={l.slNo}>
                    <td className="num tabular-nums text-xs !pr-5" style={{ color: 'var(--text-4)' }}>{l.slNo}</td>
                    <td className="font-mono text-xs" style={{ color: 'var(--text-1)' }}>
                      {l.particulars} {l.lengthFt}
                    </td>
                    <td className="num tabular-nums text-xs">{l.pieces}</td>
                    <td className="num tabular-nums text-xs">{l.netWeightKg}</td>
                    <td className="px-1">
                      <ArrowRight size={13} style={{ color: code ? 'var(--green)' : 'var(--text-4)' }} />
                    </td>
                    <td className={cn('font-mono text-xs whitespace-nowrap')}
                      style={{ color: code ? 'var(--text-1)' : 'var(--text-4)' }}>
                      {p?.code ?? '—'}
                    </td>
                    <td className="text-xs max-w-[14rem] truncate"
                      style={{ color: code ? 'var(--text-2)' : 'var(--text-4)' }}
                      title={p?.name ?? 'not taught yet'}>
                      {p?.name ?? <span className="badge-yellow !text-[9px]">waiting to be told</span>}
                    </td>
                    <td className="num tabular-nums text-xs font-semibold" style={{ color: 'var(--brand)' }}>
                      {perPiece(l) || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border-2)' }}>
                <td colSpan={2} className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>Total</td>
                <td className="num tabular-nums font-bold" style={{ color: 'var(--brand)' }}>
                  {lines.reduce((s, l) => s + l.pieces, 0)}
                </td>
                <td className="num tabular-nums font-bold" style={{ color: 'var(--brand)' }}>
                  {kgFmt(+lines.reduce((s, l) => s + l.netWeightKg, 0).toFixed(3))}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>

        {readable === lines.length && (
          <p className="text-[11.5px] mt-3 pt-3 flex items-start gap-1.5"
            style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
            <CircleCheck size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--green)' }} />
            Every line on this sheet now reads itself. The next sheet from the same depot will too, without
            anybody being asked again.
          </p>
        )}
      </div>
    </div>
  )
}
