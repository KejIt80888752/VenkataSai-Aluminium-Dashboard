import { useState, useMemo } from 'react'
import { FileStack, Plus, Trash2, Truck, Scale, Columns3, Save, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Pager, usePaged, Empty, Modal } from '@/components/ui'
import { CHALLANS, type DC } from '@/data/challans'
import { ROUTES, POWDER_SHADES, locName } from '@/data/locations'
import { COATABLE, profileOf } from '@/data/sections'
import { nameFor } from '@/data/itemmaster'
import { fmtDate, csvDownload, cn } from '@/lib/utils'
import { FY } from '@/data/company'

/* ── Grid row — same columns, same order, as the paper despatch sheet ── */
interface Row {
  id: number
  code: string
  wtRange: string
  netWeightKg: string
  cutLengthFt: string
  pieces: string
  batchNo: string
  lotNo: string
  bundles: string
  qtyPerBundle: string
  remarksTaxQty: string
  custom: Record<string, string>
}

const blankRow = (id: number): Row => ({
  id, code: '', wtRange: '', netWeightKg: '', cutLengthFt: '12', pieces: '',
  batchNo: '', lotNo: '', bundles: '', qtyPerBundle: '', remarksTaxQty: '', custom: {},
})

const num = (v: string) => (v.trim() === '' ? 0 : Number(v) || 0)

export default function Challans() {
  const [q, setQ]         = useState('')
  const [legFilter, setLeg] = useState('All Legs')
  const [statusF, setStatus] = useState('All Status')
  const [view, setView]   = useState<DC | null>(null)
  const [entry, setEntry] = useState(false)

  const rows = useMemo(() => CHALLANS.filter(d =>
    (legFilter === 'All Legs' || d.leg === legFilter) &&
    (statusF === 'All Status' || d.status === statusF) &&
    (q === '' || `${d.no} ${d.vehicleNo} ${d.againstDc} ${d.shadeName} ${d.lines.map(l => l.code + l.batchNo).join(' ')}`.toLowerCase().includes(q.toLowerCase())),
  ), [q, legFilter, statusF])

  const paged = usePaged(rows, 12)

  const outward = CHALLANS.filter(d => d.leg === 'Outward to Coating')
  const inward  = CHALLANS.filter(d => d.leg === 'Inward from Coating')

  const exportCsv = () => csvDownload('vsa-delivery-challans.csv', [
    ['DC No', 'Date', 'Route', 'Leg', 'Coating Co', 'Shade', 'Vehicle No', 'E-Way Bill', 'Sl No', 'Section Code', 'Section Name',
     'Batch', 'Lot', 'Bundles', 'Qty/Bundle', 'Total Nos', 'Cut Length (ft)', 'Wt Range Min', 'Wt Range Max',
     'Bundle Wt (kg)', 'Total Wt (kg)', 'Sqft', 'Remarks (Tax Qty)', 'Against DC', 'Status'],
    ...rows.flatMap(d => d.lines.map(l => [
      d.no, d.date, `${d.from}→${d.to}`, d.leg, d.coatingCompany, d.shadeName, d.vehicleNo, d.ewayBill,
      l.slNo, l.code, l.name, l.batchNo, l.lotNo, l.bundles, l.qtyPerBundle, l.totalNos, l.cutLengthFt,
      l.wtRangeMin, l.wtRangeMax, l.bundleWeightKg, l.totalWeightKg, l.sqft, l.remarksTaxQty, d.againstDc, d.status,
    ])),
  ])

  return (
    <div>
      <PageHead title="Delivery Challans" sub={`Every DC column carried across purchase, coating and transfer legs · ${FY}`}>
        <button onClick={() => setEntry(true)} className="btn"><Plus size={14} /> Parallel Entry</button>
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Challans Raised" value={String(CHALLANS.length)} icon={FileStack} tone="brand" sub={`${outward.length} outward · ${inward.length} inward`} />
        <Stat label="Pieces Moved" value={CHALLANS.reduce((s, d) => s + d.totalNos, 0).toLocaleString('en-IN')} icon={Truck} tone="sky" sub="Across all legs" />
        <Stat label="Weight Moved" value={`${Math.round(CHALLANS.reduce((s, d) => s + d.totalWeightKg, 0)).toLocaleString('en-IN')} kg`} icon={Scale} tone="violet" sub="Gross of coating gain" />
        <Stat label="Awaiting Receipt" value={String(CHALLANS.filter(d => d.status === 'In Transit').length)} icon={Columns3} tone="amber" sub="Not yet acknowledged" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search DC no, batch, vehicle…" />
        <Select value={legFilter} onChange={setLeg} options={['All Legs', 'Outward to Coating', 'Inward from Coating', 'Internal Transfer']} className="min-w-[12rem]" />
        <Select value={statusF} onChange={setStatus} options={['All Status', 'In Transit', 'Received', 'Short Received']} />
      </div>

      <TableCard>
        <thead>
          <tr>
            <th>DC No</th><th>Date</th><th>Route</th><th>Coating Co</th><th>Shade</th>
            <th>Vehicle</th><th className="num">Lines</th><th className="num">Total Nos</th><th className="num">Total Wt</th><th>Against</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {paged.slice.map(d => (
            <tr key={d.id} className="cursor-pointer" onClick={() => setView(d)}>
              <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{d.no}</td>
              <td className="whitespace-nowrap text-xs">{fmtDate(d.date)}</td>
              <td className="text-xs whitespace-nowrap">{d.from} → {d.to}</td>
              <td className="text-xs whitespace-nowrap">{d.coatingCompany}</td>
              <td className="text-xs whitespace-nowrap">{d.shadeName}</td>
              <td className="font-mono text-[11px] whitespace-nowrap">{d.vehicleNo}</td>
              <td className="num tabular-nums">{d.lines.length}</td>
              <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{d.totalNos.toLocaleString('en-IN')}</td>
              <td className="num tabular-nums">{d.totalWeightKg.toLocaleString('en-IN')} kg</td>
              <td className="text-[11px] font-mono whitespace-nowrap" style={{ color: 'var(--text-4)' }}>{d.againstDc}</td>
              <td><span className={d.status === 'In Transit' ? 'badge-yellow' : d.status === 'Short Received' ? 'badge-red' : 'badge-green'}>{d.status}</span></td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      {rows.length === 0 && <Empty msg="No challans match these filters" />}
      <Pager {...paged} />

      {view && <ChallanView dc={view} onClose={() => setView(null)} />}
      {entry && <ParallelEntry onClose={() => setEntry(false)} />}
    </div>
  )
}

/* ── Full challan, every column ────────────────────────────────────── */
function ChallanView({ dc, onClose }: { dc: DC; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={`${dc.no} — ${locName(dc.from)} → ${locName(dc.to)}`} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <F k="Date" v={fmtDate(dc.date)} />
          <F k="Coating Company" v={dc.coatingCompany} />
          <F k="Powder Shade" v={`${dc.shadeName} (${dc.shadeCode})`} />
          <F k="Vehicle No" v={dc.vehicleNo} />
          <F k="Driver" v={dc.driver} />
          <F k="E-Way Bill" v={dc.ewayBill} />
          <F k="Against DC" v={dc.againstDc} />
          <F k="Received On" v={dc.receivedDate === '—' ? 'Pending' : fmtDate(dc.receivedDate)} />
        </div>

        <div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--border-2)', maxHeight: '22rem' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Sl</th><th>Section</th><th>Batch / Lot</th><th className="num">Bundles</th><th className="num">Qty/Bdl</th>
                <th className="num">Total Nos</th><th className="num">Cut Len</th><th className="num">Wt Range</th>
                <th className="num">Bundle Wt</th><th className="num">Total Wt</th><th className="num">Sqft</th><th>Remarks (Tax Qty)</th>
              </tr>
            </thead>
            <tbody>
              {dc.lines.map(l => (
                <tr key={l.slNo}>
                  <td className="tabular-nums">{l.slNo}</td>
                  <td>
                    <p className="font-medium text-xs" style={{ color: 'var(--text-1)' }}>{nameFor(l.code, 'printDC', l.name)}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-4)' }}>{l.code} · {l.name}</p>
                  </td>
                  <td className="text-[11px] whitespace-nowrap">
                    <p>{l.batchNo}</p><p style={{ color: 'var(--text-4)' }}>{l.lotNo}</p>
                  </td>
                  <td className="num tabular-nums">{l.bundles}</td>
                  <td className="num tabular-nums">{l.qtyPerBundle}</td>
                  <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{l.totalNos}</td>
                  <td className="num tabular-nums text-xs">{l.cutLengthFt} ft</td>
                  <td className="num tabular-nums text-[11px] whitespace-nowrap">{l.wtRangeMin} – {l.wtRangeMax}</td>
                  <td className="num tabular-nums text-xs">{l.bundleWeightKg}</td>
                  <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{l.totalWeightKg}</td>
                  <td className="num tabular-nums text-xs">{l.sqft}</td>
                  <td className="text-[11px]">{l.remarksTaxQty}</td>
                </tr>
              ))}
              <tr style={{ background: 'var(--bg-card2)' }}>
                <td colSpan={5} className="font-bold" style={{ color: 'var(--text-1)' }}>Total</td>
                <td className="num tabular-nums font-bold" style={{ color: 'var(--text-1)' }}>{dc.totalNos}</td>
                <td colSpan={3} />
                <td className="num tabular-nums font-bold" style={{ color: 'var(--text-1)' }}>{dc.totalWeightKg}</td>
                <td className="num tabular-nums font-bold" style={{ color: 'var(--text-1)' }}>{dc.totalSqft}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>Remarks: {dc.remarks}</p>
      </div>
    </Modal>
  )
}

/* ── Excel-style parallel entry ────────────────────────────────────── */
function ParallelEntry({ onClose }: { onClose: () => void }) {
  const [head, setHead] = useState({
    routeId: 'M1-PCU1', date: '2026-08-20', poNo: '', vehicleNo: '', driver: '',
    shadeCode: 'RAL9016', ewayBill: '', againstDc: '', remarks: '',
  })
  const [rows, setRows] = useState<Row[]>([blankRow(1), blankRow(2), blankRow(3)])
  const [customCols, setCustomCols] = useState<string[]>([])
  const [newCol, setNewCol] = useState('')
  const [sheetTotal, setSheetTotal] = useState('')
  const [saved, setSaved] = useState(false)

  const set = (id: number, k: keyof Row, v: string) =>
    setRows(rs => rs.map(r => (r.id === id ? { ...r, [k]: v } : r)))
  const setCustom = (id: number, col: string, v: string) =>
    setRows(rs => rs.map(r => (r.id === id ? { ...r, custom: { ...r.custom, [col]: v } } : r)))

  const addRow = () => setRows(rs => [...rs, blankRow(Math.max(0, ...rs.map(r => r.id)) + 1)])
  const delRow = (id: number) => setRows(rs => (rs.length > 1 ? rs.filter(r => r.id !== id) : rs))

  /**
   * Everything derived computes live. Pieces can be typed straight from the
   * sheet; where the challan gives bundles instead, they multiply out. The
   * kg-per-foot figure is the useful cross-check — an extruded section runs
   * in a narrow band, so a stray digit in the weight or the piece count
   * shows up immediately.
   */
  const calc = (r: Row) => {
    const fromBundles = num(r.bundles) * num(r.qtyPerBundle)
    const totalNos = r.pieces.trim() !== '' ? num(r.pieces) : fromBundles
    const wt = num(r.netWeightKg)
    const cut = num(r.cutLengthFt)
    const prof = profileOf(r.code)
    const std = COATABLE.find(p => p.code === r.code)
    const stdPerFt = std && std.lengthFt ? std.kgPerLength / std.lengthFt : 0
    const perPiece = totalNos ? +(wt / totalNos).toFixed(3) : 0
    const perFt = totalNos && cut ? +(wt / totalNos / cut).toFixed(3) : 0
    const drift = stdPerFt > 0 && perFt > 0 ? (perFt - stdPerFt) / stdPerFt : 0
    return {
      totalNos, fromBundles,
      bundleWt: num(r.bundles) ? +(wt / num(r.bundles)).toFixed(2) : 0,
      perPiece, perFt, stdPerFt,
      suspect: Math.abs(drift) > 0.4,
      driftPct: +(drift * 100).toFixed(0),
      sqft: prof ? +(totalNos * cut * prof.sqftPerFt).toFixed(1) : 0,
    }
  }

  const totals = rows.reduce((a, r) => {
    const c = calc(r)
    return { nos: a.nos + c.totalNos, kg: +(a.kg + num(r.netWeightKg)).toFixed(3), sqft: +(a.sqft + c.sqft).toFixed(1) }
  }, { nos: 0, kg: 0, sqft: 0 })

  const filled = rows.filter(r => r.code && num(r.netWeightKg) > 0)
  const suspects = rows.filter(r => r.code && calc(r).suspect).length

  /** The sheet carries its own total — compare, the way the storekeeper would. */
  const stated = num(sheetTotal)
  const tallyDiff = stated > 0 ? +(totals.kg - stated).toFixed(3) : null

  const exportSheet = () => csvDownload('vsa-despatch-sheet.csv', [
    ['Despatch sheet', head.routeId, head.date, 'P.O. No', head.poNo, 'Vehicle', head.vehicleNo],
    [], ['Sl No', 'Particulars', 'Weight Range', 'Net Weight', 'Length', 'No. of Pieces',
         'Batch', 'Lot', 'Bundles', 'Qty/Bundle', 'Bundle Wt', 'Per Piece', 'Kg/Ft', 'Sqft', 'Remarks', ...customCols],
    ...rows.map((r, i) => {
      const c = calc(r)
      return [i + 1, r.code, r.wtRange, r.netWeightKg, r.cutLengthFt, c.totalNos,
        r.batchNo, r.lotNo, r.bundles, r.qtyPerBundle, c.bundleWt, c.perPiece, c.perFt, c.sqft,
        r.remarksTaxQty, ...customCols.map(cc => r.custom[cc] ?? '')]
    }),
    [], ['TOTAL', '', '', totals.kg, '', totals.nos],
  ])

  return (
    <div className="fixed inset-0 z-50 bg-black/50 overflow-y-auto p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="max-w-[82rem] mx-auto rounded-xl shadow-2xl my-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-2)' }}>

        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-2)' }}>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Despatch Sheet — Parallel Entry</p>
            <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>
              Same columns, same order as the paper sheet. Type across; pieces, weights and area compute as you go.
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-4)' }}><X size={18} /></button>
        </div>

        {/* Header fields */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--border-2)' }}>
          <div><label className="label">Route</label>
            <select className="input" value={head.routeId} onChange={e => setHead(h => ({ ...h, routeId: e.target.value }))}>
              {ROUTES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select></div>
          <div><label className="label">Date</label>
            <input type="date" className="input" value={head.date} onChange={e => setHead(h => ({ ...h, date: e.target.value }))} /></div>
          <div><label className="label">P.O. No</label>
            <input className="input" placeholder="As on the sheet" value={head.poNo} onChange={e => setHead(h => ({ ...h, poNo: e.target.value }))} /></div>
          <div><label className="label">Vehicle No</label>
            <input className="input" placeholder="KA 05 MJ 4471" value={head.vehicleNo} onChange={e => setHead(h => ({ ...h, vehicleNo: e.target.value }))} /></div>
          <div><label className="label">Powder Shade</label>
            <select className="input" value={head.shadeCode} onChange={e => setHead(h => ({ ...h, shadeCode: e.target.value }))}>
              {POWDER_SHADES.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
            </select></div>
          <div><label className="label">E-Way Bill No</label>
            <input className="input" placeholder="Optional" value={head.ewayBill} onChange={e => setHead(h => ({ ...h, ewayBill: e.target.value }))} /></div>
          <div><label className="label">Against DC</label>
            <input className="input" placeholder="For return legs" value={head.againstDc} onChange={e => setHead(h => ({ ...h, againstDc: e.target.value }))} /></div>
          <div><label className="label">Remarks</label>
            <input className="input" placeholder="Free text" value={head.remarks} onChange={e => setHead(h => ({ ...h, remarks: e.target.value }))} /></div>
        </div>

        {/* Grid */}
        <div className="overflow-auto" style={{ maxHeight: '26rem' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-8">Sl</th>
                <th className="min-w-[13rem]">Particulars</th>
                <th className="num w-20">Wt Range</th>
                <th className="num w-24">Net Weight</th>
                <th className="num w-20">Length</th>
                <th className="num w-20">Pieces</th>
                <th className="num w-20">Per Pc</th>
                <th className="num w-20">Kg / Ft</th>
                <th className="min-w-[7rem]">Batch</th>
                <th className="num w-16">Bdls</th>
                <th className="num w-16">Qty/Bdl</th>
                <th className="num w-20">Sqft</th>
                <th className="min-w-[9rem]">Remarks</th>
                {customCols.map(c => <th key={c} className="min-w-[8rem]">{c}</th>)}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const c = calc(r)
                return (
                  <tr key={r.id}>
                    <td className="tabular-nums text-xs" style={{ color: 'var(--text-4)' }}>{i + 1}</td>
                    <td>
                      <select className="input !py-1 !text-xs" value={r.code} onChange={e => set(r.id, 'code', e.target.value)}>
                        <option value="">— select —</option>
                        {COATABLE.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                      </select>
                    </td>
                    <Cellin v={r.wtRange}      on={v => set(r.id, 'wtRange', v)}      ph="—"    right />
                    <Cellin v={r.netWeightKg}  on={v => set(r.id, 'netWeightKg', v)}  ph="0.000" right />
                    <Cellin v={r.cutLengthFt}  on={v => set(r.id, 'cutLengthFt', v)}  ph="12"   right />
                    <Cellin v={r.pieces}       on={v => set(r.id, 'pieces', v)}       ph={c.fromBundles ? String(c.fromBundles) : '0'} right />
                    <td className="num tabular-nums text-xs" style={{ color: 'var(--text-3)' }}>{c.perPiece || '—'}</td>
                    <td className="num tabular-nums text-xs">
                      {c.perFt
                        ? <span className={cn('font-medium', c.suspect && 'text-amber-600')}
                            title={c.suspect
                              ? `Standard for this section is about ${c.stdPerFt.toFixed(3)} kg/ft — this line is ${c.driftPct > 0 ? '+' : ''}${c.driftPct}% off. Check the weight or the piece count.`
                              : 'Within the normal band for this section'}>
                            {c.perFt}{c.suspect && ' ⚠'}
                          </span>
                        : '—'}
                    </td>
                    <Cellin v={r.batchNo}      on={v => set(r.id, 'batchNo', v)}      ph="BT/2608/xxx" />
                    <Cellin v={r.bundles}      on={v => set(r.id, 'bundles', v)}      ph="—" right />
                    <Cellin v={r.qtyPerBundle} on={v => set(r.id, 'qtyPerBundle', v)} ph="—" right />
                    <td className="num tabular-nums text-xs" style={{ color: 'var(--text-3)' }}>{c.sqft || '—'}</td>
                    <Cellin v={r.remarksTaxQty} on={v => set(r.id, 'remarksTaxQty', v)} ph="—" />
                    {customCols.map(cc => (
                      <Cellin key={cc} v={r.custom[cc] ?? ''} on={v => setCustom(r.id, cc, v)} ph="—" />
                    ))}
                    <td>
                      <button onClick={() => delRow(r.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                )
              })}
              <tr style={{ background: 'var(--bg-card2)' }}>
                <td colSpan={3} className="font-bold text-xs" style={{ color: 'var(--text-1)' }}>Total ({filled.length} lines)</td>
                <td className="num tabular-nums font-bold text-xs" style={{ color: 'var(--text-1)' }}>{totals.kg || '—'}</td>
                <td />
                <td className="num tabular-nums font-bold text-xs" style={{ color: 'var(--text-1)' }}>{totals.nos || '—'}</td>
                <td colSpan={5} />
                <td className="num tabular-nums font-bold text-xs" style={{ color: 'var(--text-1)' }}>{totals.sqft || '—'}</td>
                <td colSpan={1 + customCols.length + 1} />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Cross-check against the total written on the sheet */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3" style={{ borderTop: '1px solid var(--border-2)' }}>
          <label className="text-xs whitespace-nowrap" style={{ color: 'var(--text-3)' }}>Total written on the sheet</label>
          <input className="input !w-32 !py-1.5 text-right tabular-nums" placeholder="595.560"
            value={sheetTotal} onChange={e => setSheetTotal(e.target.value)} />
          {tallyDiff !== null && (
            <span className={cn('badge', Math.abs(tallyDiff) < 0.005 ? 'badge-green' : 'badge-red')}>
              {Math.abs(tallyDiff) < 0.005
                ? <><CheckCircle2 size={11} /> Tallies exactly</>
                : <><AlertTriangle size={11} /> Off by {tallyDiff > 0 ? '+' : ''}{tallyDiff} kg — check a line</>}
            </span>
          )}
          {suspects > 0 && (
            <span className="badge-yellow"><AlertTriangle size={11} /> {suspects} line{suspects > 1 ? 's' : ''} outside the normal kg/ft band</span>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3.5" style={{ borderTop: '1px solid var(--border-2)' }}>
          <button onClick={addRow} className="btn-outline"><Plus size={14} /> Add row</button>

          <div className="flex items-center gap-1">
            <input className="input !py-1.5 !w-40 !text-xs" placeholder="Custom column name" value={newCol}
              onChange={e => setNewCol(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newCol.trim()) { setCustomCols(c => [...c, newCol.trim()]); setNewCol('') } }} />
            <button onClick={() => { if (newCol.trim()) { setCustomCols(c => [...c, newCol.trim()]); setNewCol('') } }}
              className="btn-ghost !px-2"><Columns3 size={14} /> Add column</button>
          </div>

          {customCols.map(c => (
            <span key={c} className="badge-gray">
              {c}
              <button onClick={() => setCustomCols(cs => cs.filter(x => x !== c))} className="ml-1 hover:text-red-500">×</button>
            </span>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <ExportBtn onClick={exportSheet} label="Export sheet" />
            <button
              onClick={() => { setSaved(true); setTimeout(() => { setSaved(false); onClose() }, 900) }}
              disabled={filled.length === 0}
              className={cn('btn', saved && '!bg-green-600')}>
              <Save size={14} /> {saved ? 'Saved' : `Save DC (${filled.length} lines)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Cellin({ v, on, ph, right }: { v: string; on: (v: string) => void; ph: string; right?: boolean }) {
  return (
    <td className="!px-1.5 !py-1">
      <input value={v} onChange={e => on(e.target.value)} placeholder={ph}
        className={cn('input !py-1 !px-2 !text-xs', right && 'text-right tabular-nums')} />
    </td>
  )
}

function F({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>{k}</p>
      <p className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>{v}</p>
    </div>
  )
}
