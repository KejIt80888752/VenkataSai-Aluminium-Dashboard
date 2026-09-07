import { useState, useMemo, useEffect } from 'react'
import {
  FileInput, Scale, TriangleAlert, CircleCheck, Link2, PackagePlus, Plus, Trash2, Palette,
} from 'lucide-react'
import { PageHead, Stat, Select, ExportBtn, TableCard, Empty } from '@/components/ui'
import {
  SAMPLE_DC, SAMPLE_CC, ccTotals, perPiece, rangeVariance, RECEIVE_AT,
  type DcLine,
} from '@/data/despatch'
import { P } from '@/data/catalogue'
import { SUPPLIERS } from '@/data/parties'
import { csvDownload, cn } from '@/lib/utils'
import { FY } from '@/data/company'

/* What the supplier writes is not what our master calls it. Told once, it is
   remembered — the same alias table the rest of the system uses. */
const ALIAS_KEY = 'vsa-dc-aliases'
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

interface Row extends DcLine { at: string }

export default function PurchaseDC() {
  const [supplier, setSupplier] = useState(SAMPLE_DC.supplier)
  const [date, setDate] = useState(SAMPLE_DC.date)
  const [poNo, setPoNo] = useState(SAMPLE_DC.poNo)
  const [vehicle, setVehicle] = useState(SAMPLE_DC.vehicleNo)
  const [written, setWritten] = useState(String(SAMPLE_DC.writtenTotalKg))
  const [ccNo, setCcNo] = useState(SAMPLE_DC.ccNo)
  const [rows, setRows] = useState<Row[]>(SAMPLE_DC.lines.map(l => ({ ...l, at: 'GD1' })))

  const [learned, setLearned] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(ALIAS_KEY) ?? '{}') } catch { return {} }
  })
  useEffect(() => {
    try { localStorage.setItem(ALIAS_KEY, JSON.stringify(learned)) } catch { /* blocked */ }
  }, [learned])

  const lineKg = +rows.reduce((s, l) => s + l.netWeightKg, 0).toFixed(3)
  const pieces = rows.reduce((s, l) => s + l.pieces, 0)
  const writtenKg = Number(written) || 0
  const kgGap = +(lineKg - writtenKg).toFixed(3)
  const ccGap = pieces - (Number(ccNo) || 0)

  const cc = useMemo(() => ccTotals(SAMPLE_CC), [])

  const unknown = useMemo(
    () => [...new Set(rows.map(r => r.particulars))].filter(p => !learned[norm(p)]),
    [rows, learned],
  )

  const patch = (sl: number, p: Partial<Row>) =>
    setRows(rs => rs.map(r => r.slNo === sl ? { ...r, ...p } : r))

  const addRow = () => setRows(rs => [...rs, {
    slNo: rs.length ? Math.max(...rs.map(r => r.slNo)) + 1 : 1,
    particulars: '', weightRange: null, netWeightKg: 0, lengthFt: "12'", pieces: 0, at: 'GD1',
  }])

  const allotAll = (at: string) => setRows(rs => rs.map(r => ({ ...r, at })))

  const exportCsv = () => csvDownload('vsa-despatch-sheet.csv', [
    [`Despatch sheet — ${supplier}`, FY],
    ['Date', date, 'P.O. No', poNo, 'Vehicle', vehicle, 'CC', ccNo],
    [], ['Sl No', 'Particulars', 'Our Item', 'Weight Range', 'Net Weight', 'Length', 'Pieces',
         'Kg per Piece', 'Off Nominal %', 'Received At'],
    ...rows.map(r => [r.slNo, r.particulars, learned[norm(r.particulars)] ?? '', r.weightRange ?? '',
      r.netWeightKg, r.lengthFt, r.pieces, perPiece(r), rangeVariance(r) ?? '', r.at]),
    [], ['Lines add to', lineKg], ['Written on the sheet', writtenKg], ['Difference', kgGap],
    ['Total pieces', pieces], ['Colour code number', ccNo],
  ])

  return (
    <div>
      <PageHead title="Purchase Despatch Sheet"
        sub="Entered exactly as the supplier writes it — same columns, same order, nothing rearranged">
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Lines Add To" value={`${lineKg.toFixed(3)} kg`} icon={Scale} tone="brand"
          sub={`${rows.length} lines · ${pieces} pieces`} />
        <Stat label="Written at the Foot" value={`${writtenKg.toFixed(3)} kg`} icon={FileInput} tone="violet"
          sub="As on the paper" />
        <Stat label="Difference"
          value={kgGap === 0 ? 'Agrees' : `${kgGap > 0 ? '+' : ''}${kgGap.toFixed(3)} kg`}
          icon={kgGap === 0 ? CircleCheck : TriangleAlert} tone={kgGap === 0 ? 'green' : 'red'}
          sub={kgGap === 0 ? 'The sheet tallies' : 'Somebody has miscounted'} />
        <Stat label="Colour Code" value={ccNo || '—'} icon={Palette}
          tone={ccGap === 0 ? 'green' : 'amber'}
          sub={ccGap === 0 ? 'Matches the piece count' : `${Math.abs(ccGap)} pieces apart`} />
      </div>

      {/* ── The two checks that matter, said plainly ───────────────────── */}
      {(kgGap !== 0 || ccGap !== 0) && (
        <div className="card mb-5" style={{ borderColor: 'var(--red)' }}>
          <p className="section-title text-base mb-1 flex items-center gap-2">
            <TriangleAlert size={15} style={{ color: 'var(--red)' }} /> This Sheet Does Not Tally
          </p>
          <div className="space-y-2 mt-3">
            {kgGap !== 0 && (
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <p className="text-sm" style={{ color: 'var(--text-1)' }}>
                  The fourteen lines come to <b>{lineKg.toFixed(3)} kg</b>, but <b>{writtenKg.toFixed(3)} kg</b> is
                  written at the foot — <b style={{ color: 'var(--red)' }}>{Math.abs(kgGap).toFixed(3)} kg</b> apart.
                </p>
                <p className="text-[11.5px] mt-1" style={{ color: 'var(--text-4)' }}>
                  Either a figure was copied wrongly, or the total on the paper is wrong. Worth settling with the
                  depot before the material is taken in, not at the year end.
                </p>
              </div>
            )}
            {ccGap !== 0 && (
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <p className="text-sm" style={{ color: 'var(--text-1)' }}>
                  The lines carry <b>{pieces} pieces</b>, and the colour code sheet is numbered <b>{ccNo}</b> —
                  {' '}<b style={{ color: 'var(--red)' }}>{Math.abs(ccGap)} pieces</b> apart.
                </p>
                <p className="text-[11.5px] mt-1" style={{ color: 'var(--text-4)' }}>
                  The colour code number is the piece count for the load, so those two should be the same figure.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── The header of their form ───────────────────────────────────── */}
      <div className="card mb-5">
        <p className="section-title text-base mb-3">Despatch Sheet</p>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2"><label className="label">Supplier</label>
            <Select value={supplier} onChange={setSupplier} options={SUPPLIERS.map(s => s.name)} className="!w-full" /></div>
          <div><label className="label">Date</label>
            <input type="date" className="input w-full" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><label className="label">P.O. No</label>
            <input className="input w-full" value={poNo} onChange={e => setPoNo(e.target.value)} /></div>
          <div><label className="label">Vehicle No</label>
            <input className="input w-full" value={vehicle} onChange={e => setVehicle(e.target.value)} /></div>
          <div><label className="label">Colour code no</label>
            <input className="input w-full text-right tabular-nums" value={ccNo} onChange={e => setCcNo(e.target.value)} /></div>
        </div>
      </div>

      {/* ── What the supplier's words mean ─────────────────────────────── */}
      {unknown.length > 0 && (
        <div className="card mb-5" style={{ borderColor: 'var(--amber, #f59e0b)' }}>
          <p className="section-title text-base mb-1 flex items-center gap-2">
            <Link2 size={15} className="text-brand" /> What the Depot Calls These
          </p>
          <p className="section-sub mb-3">
            <b>{unknown.join(', ')}</b> — these are the depot's own short forms and the master does not know
            them yet. Point each at our section once and every later sheet reads itself.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {unknown.map(u => (
              <div key={u} className="flex items-center justify-between gap-3 rounded-lg p-2.5"
                style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <span className="font-mono text-sm" style={{ color: 'var(--text-1)' }}>{u}</span>
                <select className="input !w-56 !py-1 !text-xs shrink-0" value=""
                  onChange={e => e.target.value && setLearned(l => ({ ...l, [norm(u)]: e.target.value }))}>
                  <option value="">— choose our section —</option>
                  {P.map(p => <option key={p.code} value={p.name}>{p.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── The sheet itself ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <p className="section-title text-base mb-1">The Lines</p>
          <p className="section-sub">
            Weight per piece is worked out from what is already written — net weight divided by pieces.
            Nobody types it.
          </p>
        </div>
        <span className="flex flex-wrap gap-2">
          <span className="text-[11px] self-center" style={{ color: 'var(--text-4)' }}>Put it all in</span>
          {RECEIVE_AT.map(r => (
            <button key={r.id} className="btn-ghost !py-1 !text-[11px]" onClick={() => allotAll(r.id)}>{r.id}</button>
          ))}
        </span>
      </div>

      <TableCard maxH="34rem">
        <thead>
          <tr>
            <th className="num">Sl</th><th>Particulars</th><th>Our Section</th>
            <th className="num">Weight Range</th><th className="num">Net Weight</th>
            <th className="num">Length</th><th className="num">Pieces</th>
            <th className="num">Kg / Piece</th><th className="num">Off Nominal</th>
            <th>Received At</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const per = perPiece(r)
            const off = rangeVariance(r)
            const mapped = learned[norm(r.particulars)]
            return (
              <tr key={r.slNo}>
                <td className="num tabular-nums text-xs" style={{ color: 'var(--text-4)' }}>{r.slNo}</td>
                <td>
                  <input className="input !w-28 !py-1 !text-xs font-mono" value={r.particulars}
                    onChange={e => patch(r.slNo, { particulars: e.target.value })} />
                </td>
                <td className="text-xs max-w-[13rem] truncate"
                  style={{ color: mapped ? 'var(--text-2)' : 'var(--text-4)' }}
                  title={mapped ?? 'not mapped yet'}>{mapped ?? '—'}</td>
                <td className="num">
                  <input className="input !w-20 !py-1 text-right tabular-nums !text-xs"
                    value={r.weightRange ?? ''} placeholder="—"
                    onChange={e => patch(r.slNo, { weightRange: e.target.value === '' ? null : Number(e.target.value) })} />
                </td>
                <td className="num">
                  <input className="input !w-24 !py-1 text-right tabular-nums !text-xs" value={r.netWeightKg}
                    onChange={e => patch(r.slNo, { netWeightKg: Number(e.target.value) || 0 })} />
                </td>
                <td className="num">
                  <input className="input !w-16 !py-1 text-right !text-xs" value={r.lengthFt}
                    onChange={e => patch(r.slNo, { lengthFt: e.target.value })} />
                </td>
                <td className="num">
                  <input className="input !w-20 !py-1 text-right tabular-nums !text-xs" value={r.pieces}
                    onChange={e => patch(r.slNo, { pieces: Number(e.target.value) || 0 })} />
                </td>
                <td className="num tabular-nums font-semibold" style={{ color: 'var(--brand)' }}>{per || '—'}</td>
                <td className="num tabular-nums text-xs"
                  style={{ color: off === null ? 'var(--text-4)' : Math.abs(off) > 5 ? 'var(--red)' : 'var(--text-3)' }}>
                  {off === null ? '—' : `${off > 0 ? '+' : ''}${off}%`}
                </td>
                <td>
                  <Select value={r.at} onChange={v => patch(r.slNo, { at: v })}
                    options={RECEIVE_AT.map(x => x.id)} className="!w-20 !py-1 !text-xs !min-w-0" />
                </td>
                <td>
                  <button className="btn-ghost !px-1.5 !py-1" style={{ color: 'var(--red)' }}
                    onClick={() => setRows(rs => rs.filter(x => x.slNo !== r.slNo))}><Trash2 size={13} /></button>
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && <tr><td colSpan={11}><Empty msg="No lines yet" /></td></tr>}
        </tbody>
      </TableCard>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <button className="btn-outline" onClick={addRow}><Plus size={14} /> Add a line</button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>
            Total <b style={{ color: 'var(--text-1)' }}>{lineKg.toFixed(3)} kg</b> · {pieces} pieces
          </span>
          <label className="text-xs flex items-center gap-2" style={{ color: 'var(--text-3)' }}>
            Written at the foot
            <input className="input !w-28 !py-1 text-right tabular-nums !text-xs" value={written}
              style={kgGap !== 0 ? { borderColor: 'var(--red)', color: 'var(--red)' } : undefined}
              onChange={e => setWritten(e.target.value)} />
          </label>
        </div>
      </div>

      {/* ── Where it went ─────────────────────────────────────────────── */}
      <div className="card mt-5">
        <p className="section-title text-base mb-1 flex items-center gap-2">
          <PackagePlus size={15} className="text-brand" /> Where This Load Was Put
        </p>
        <p className="section-sub mb-3">
          Set on each line above. Stock goes up at that location, and each line becomes a lot carrying its
          own weight per piece.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {RECEIVE_AT.map(at => {
            const mine = rows.filter(r => r.at === at.id)
            const kg = +mine.reduce((s, r) => s + r.netWeightKg, 0).toFixed(3)
            const pcs = mine.reduce((s, r) => s + r.pieces, 0)
            return (
              <div key={at.id} className="rounded-lg p-3.5"
                style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{at.id}</p>
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>{at.label}</p>
                <p className="text-lg font-bold tabular-nums mt-1.5" style={{ color: pcs ? 'var(--brand)' : 'var(--text-4)' }}>
                  {pcs} pcs
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>
                  {kg ? `${kg.toFixed(3)} kg · ${mine.length} lines` : 'nothing allotted here'}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── The colour code that travels with it ──────────────────────── */}
      <div className="card mt-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <p className="section-title text-base flex items-center gap-2">
            <Palette size={15} className="text-brand" /> Colour Code {SAMPLE_CC.ccNo}
          </p>
          <span className={cn('shrink-0', cc.pieces === pieces ? 'badge-green' : 'badge-red')}>
            {cc.pieces} of {pieces} pieces accounted for
          </span>
        </div>
        <p className="section-sub mb-4">
          The same load again, split by the shade each piece is going to be coated in. PT beside a shade
          means it takes pre-treatment first — which is what puts the extra on the coater's bill.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {cc.shades.map(s => (
            <div key={s.shade} className="rounded-lg p-3.5"
              style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{s.shade}</p>
                {s.preTreatment && <span className="badge-yellow shrink-0">PT</span>}
              </div>
              <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--brand)' }}>{s.pieces} nos</p>
              <div className="mt-2.5 space-y-1">
                {s.lines.map(l => (
                  <div key={l.section} className="flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="truncate" style={{ color: 'var(--text-3)' }}>{l.section}</span>
                    <span className="tabular-nums shrink-0" style={{ color: 'var(--text-2)' }}>{l.pieces}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {cc.preTreated > 0 && (
          <p className="text-[11.5px] mt-4 pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
            <b style={{ color: 'var(--text-2)' }}>{cc.preTreated} of {cc.pieces} pieces</b> need pre-treatment.
            At the pre-treatment rate set on the coating rate card that is the extra you should expect on the
            bill for this load — and the coating bill screen will check it came in at that.
          </p>
        )}
      </div>
    </div>
  )
}
