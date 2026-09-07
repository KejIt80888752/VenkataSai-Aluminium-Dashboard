import { useState, useRef, useEffect, useMemo } from 'react'
import { ScanBarcode, RotateCcw, CircleAlert, CircleCheck, Undo2 } from 'lucide-react'
import { Select, Empty } from '@/components/ui'
import { P } from '@/data/catalogue'
import { cn } from '@/lib/utils'

/* ── Counting by scanning, not by writing ──────────────────────────────────
   The man on the floor scans each bundle as he touches it. Nothing is typed,
   so nothing is transposed, and the tally against the book builds itself as
   he goes. He can see what he has counted; he cannot see what the book says
   until he is finished, or the count stops being a count.                 */

const CHAR_GAP_MS = 40
const BASE = 200000000

/** The barcode issued against each section, same scheme as the label screen. */
const codeOf = (i: number) => String(BASE + i + 1)
const byBarcode = new Map(P.map((p, i) => [codeOf(i), p]))
const byItemCode = new Map(P.map(p => [p.code.toUpperCase(), p]))

export interface Counted { code: string; name: string; pcs: number }

export default function CountByScan({ location, onLocation, book, onFinish }: {
  location: string
  onLocation: (v: string) => void
  /** what the book says at this location, by item code */
  book: Record<string, number>
  onFinish: (rows: Counted[]) => void
}) {
  const [scans, setScans] = useState<{ code: string; at: string; ok: boolean }[]>([])
  const [revealed, setRevealed] = useState(false)
  const [manual, setManual] = useState('')

  const add = (raw: string) => {
    const s = raw.trim().toUpperCase()
    const p = byBarcode.get(s) ?? byItemCode.get(s)
    setScans(v => [{ code: p ? p.code : s, at: new Date().toLocaleTimeString('en-IN', { hour12: false }), ok: !!p }, ...v])
  }

  /* The scanner is a keyboard that types faster than anyone can. */
  const buf = useRef({ text: '', last: 0 })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
      const now = Date.now()
      if (now - buf.current.last > CHAR_GAP_MS) buf.current.text = ''
      buf.current.last = now
      if (e.key === 'Enter') {
        const raw = buf.current.text.trim(); buf.current.text = ''
        if (raw.length >= 3) add(raw)
        return
      }
      if (e.key.length === 1) buf.current.text += e.key
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const counted: Counted[] = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of scans) if (s.ok) m.set(s.code, (m.get(s.code) ?? 0) + 1)
    return [...m.entries()].map(([code, pcs]) => ({
      code, name: P.find(p => p.code === code)?.name ?? code, pcs,
    })).sort((a, b) => b.pcs - a.pcs)
  }, [scans])

  const unknown = scans.filter(s => !s.ok).length
  const total = counted.reduce((s, c) => s + c.pcs, 0)

  return (
    <div className="card mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <p className="section-title text-base mb-1 flex items-center gap-2">
            <ScanBarcode size={15} className="text-brand" /> Count by Scanning
          </p>
          <p className="section-sub max-w-3xl">
            Scan each bundle as you touch it. Nothing is typed, so nothing is written down wrongly. The book
            figure stays hidden until you finish — a count you can see the answer to is not a count.
          </p>
        </div>
        <span className="flex flex-wrap gap-2 shrink-0">
          <Select value={location} onChange={onLocation} options={['SHOP', 'GD1', 'GD2']} />
          {scans.length > 0 && (
            <button className="btn-ghost !text-xs" onClick={() => { setScans([]); setRevealed(false) }}>
              <RotateCcw size={13} /> Start again
            </button>
          )}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,22rem] gap-4">
        <div>
          {/* typing stands in for a scanner while trying it out */}
          <div className="flex gap-2 mb-3">
            <input className="input flex-1 font-mono !text-xs" value={manual}
              placeholder="Scan, or type a barcode or item code — 200000001, VSA-SL-2T-OF"
              onChange={e => setManual(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && manual.trim()) { add(manual); setManual('') } }} />
            <button className="btn-outline shrink-0" disabled={!manual.trim()}
              onClick={() => { add(manual); setManual('') }}>
              <ScanBarcode size={14} /> Count it
            </button>
          </div>

          {counted.length === 0 ? (
            <Empty msg="Nothing counted yet — scan the first bundle" />
          ) : (
            <div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--border-2)', maxHeight: '20rem' }}>
              <table className="tbl">
                <thead>
                  <tr><th>Section</th><th className="num">Counted</th>
                    {revealed && <><th className="num">Book</th><th className="num">Difference</th></>}</tr>
                </thead>
                <tbody>
                  {counted.map(c => {
                    const b = book[c.code] ?? 0
                    const d = c.pcs - b
                    return (
                      <tr key={c.code}>
                        <td>
                          <p className="text-sm" style={{ color: 'var(--text-1)' }}>{c.name}</p>
                          <p className="font-mono text-[10px]" style={{ color: 'var(--text-4)' }}>{c.code}</p>
                        </td>
                        <td className="num tabular-nums font-semibold" style={{ color: 'var(--brand)' }}>{c.pcs}</td>
                        {revealed && <>
                          <td className="num tabular-nums text-xs">{b || '—'}</td>
                          <td className={cn('num tabular-nums font-semibold')}
                            style={{ color: d === 0 ? 'var(--green)' : 'var(--red)' }}>
                            {d === 0 ? 'tallies' : `${d > 0 ? '+' : ''}${d}`}
                          </td>
                        </>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <div className="rounded-lg p-3.5 mb-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>Counted so far</p>
            <p className="text-2xl font-bold tabular-nums mt-0.5" style={{ color: 'var(--brand)' }}>{total}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>
              {counted.length} {counted.length === 1 ? 'section' : 'sections'} at {location}
            </p>
            {unknown > 0 && (
              <p className="text-[11px] mt-2 flex items-start gap-1.5" style={{ color: 'var(--red)' }}>
                <CircleAlert size={12} className="mt-0.5 shrink-0" />
                {unknown} {unknown === 1 ? 'scan was' : 'scans were'} not recognised — a sticker that is not
                in the master, or a supplier's own barcode
              </p>
            )}
          </div>

          <div className="rounded-lg overflow-hidden mb-3" style={{ border: '1px solid var(--border-2)' }}>
            <p className="text-[10px] uppercase tracking-wide px-3 py-1.5"
              style={{ color: 'var(--text-4)', background: 'var(--bg-card2)' }}>Last scans</p>
            <div className="max-h-40 overflow-y-auto">
              {scans.length === 0
                ? <p className="text-xs px-3 py-4 text-center" style={{ color: 'var(--text-4)' }}>None yet</p>
                : scans.slice(0, 14).map((s, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1 text-xs"
                    style={{ borderTop: i ? '1px solid var(--border-2)' : undefined }}>
                    <span className="font-mono truncate" style={{ color: s.ok ? 'var(--text-2)' : 'var(--red)' }}>
                      {s.code}
                    </span>
                    <span className="tabular-nums shrink-0" style={{ color: 'var(--text-4)' }}>{s.at}</span>
                  </div>
                ))}
            </div>
          </div>

          {!revealed ? (
            <button className="btn w-full" disabled={!counted.length} onClick={() => setRevealed(true)}>
              <CircleCheck size={14} /> Finished counting — show the book
            </button>
          ) : (
            <>
              <button className="btn w-full" onClick={() => onFinish(counted)}>
                <CircleCheck size={14} /> Send the differences for approval
              </button>
              <button className="btn-ghost w-full mt-1.5 !text-xs" onClick={() => setRevealed(false)}>
                <Undo2 size={13} /> Hide the book again and keep counting
              </button>
            </>
          )}

          <p className="text-[11px] mt-3" style={{ color: 'var(--text-4)' }}>
            Whoever counts cannot approve his own difference. It goes to the owner with a reason against it.
          </p>
        </div>
      </div>
    </div>
  )
}
