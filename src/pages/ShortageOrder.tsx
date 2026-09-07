import { useState, useMemo } from 'react'
import { ClipboardList, Printer, Trash2, Plus, PackageX, Truck, IndianRupee } from 'lucide-react'
import { PageHead, Stat, Select, ExportBtn, TableCard, Empty, Modal } from '@/components/ui'
import { P, isLow } from '@/data/catalogue'
import { SUPPLIERS } from '@/data/parties'
import { LOTS } from '@/data/lots'
import { inr, csvDownload } from '@/lib/utils'
import { COMPANY, TODAY, FY } from '@/data/company'

/* ── The list that goes to the mill ────────────────────────────────────────
   Built from what has fallen below its reorder level, but not sent as it
   comes out — the quantities are always argued with before it goes. So the
   list is editable, and it carries the supplier's own code beside ours, or
   the depot writes back asking what we meant.                             */

/* What each supplier calls our sections. In use this comes off the alias
   table; here it is derived so the sheet reads the way theirs does. */
const supplierCode = (code: string, supplierId: string) =>
  `${supplierId}-${code.replace('VSA-', '').replace(/-/g, '')}`

interface Line {
  id: string
  code: string
  name: string
  onHand: number
  reorder: number
  suggested: number
  qty: number
  ratePerKg: number
  kgPerLength: number
  note: string
}

export default function ShortageOrder() {
  const [supplierId, setSupplierId] = useState(SUPPLIERS[0].id)
  const [preview, setPreview] = useState(false)

  const supplier = SUPPLIERS.find(s => s.id === supplierId)!

  const short = useMemo(() => P.filter(isLow), [])

  const [lines, setLines] = useState<Line[]>(() => short.map(p => {
    const onHand = LOTS.filter(l => l.code === p.code).reduce((s, l) => s + l.remainingNos, 0) || p.stockPcs
    // Enough to get back above the reorder level with a month's cover on top.
    const suggested = Math.max(0, Math.ceil((p.reorderPcs * 1.6 - onHand) / 10) * 10)
    return {
      id: p.code, code: p.code, name: p.name, onHand, reorder: p.reorderPcs,
      suggested, qty: suggested, ratePerKg: p.costPerKg, kgPerLength: p.kgPerLength, note: '',
    }
  }))

  const active = lines.filter(l => l.qty > 0)
  const value = Math.round(active.reduce((s, l) => s + l.qty * l.kgPerLength * l.ratePerKg, 0))
  const weight = +active.reduce((s, l) => s + l.qty * l.kgPerLength, 0).toFixed(1)

  const patch = (id: string, p: Partial<Line>) => setLines(ls => ls.map(l => l.id === id ? { ...l, ...p } : l))

  const exportCsv = () => csvDownload(`shortage-order-${supplier.id}.csv`, [
    [`Shortage order — ${COMPANY.name}`, TODAY, FY],
    [`To: ${supplier.name}`, supplier.gstin],
    [], ['VSA Code', 'Supplier Code', 'Section', 'On Hand', 'Reorder Level', 'Order Qty',
         'Est. Kg', 'Est. Rate/Kg', 'Est. Value', 'Note'],
    ...active.map(l => [l.code, supplierCode(l.code, supplier.id), l.name, l.onHand, l.reorder, l.qty,
      +(l.qty * l.kgPerLength).toFixed(1), l.ratePerKg, Math.round(l.qty * l.kgPerLength * l.ratePerKg), l.note]),
    [], ['Total pieces', active.reduce((s, l) => s + l.qty, 0)],
    ['Total weight', weight], ['Estimated value', value],
  ])

  return (
    <div>
      <PageHead title="Shortage Order" sub="What has run low, priced up and ready to send — change anything before it goes">
        <Select value={supplierId} onChange={setSupplierId} options={SUPPLIERS.map(s => s.id)} />
        <ExportBtn onClick={exportCsv} />
        <button className="btn" disabled={!active.length} onClick={() => setPreview(true)}>
          <Printer size={14} /> Preview the sheet
        </button>
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Below Reorder" value={String(short.length)} icon={PackageX}
          tone={short.length ? 'amber' : 'green'} sub="Sections needing a top-up" />
        <Stat label="On This Order" value={String(active.length)} icon={ClipboardList} tone="brand"
          sub={`${active.reduce((s, l) => s + l.qty, 0)} pieces`} />
        <Stat label="Weight" value={`${weight.toLocaleString('en-IN')} kg`} icon={Truck} tone="sky"
          sub="Roughly one lorry per 3,000 kg" />
        <Stat label="Estimated Value" value={inr(value)} icon={IndianRupee} tone="violet"
          sub="At the last landed cost" />
      </div>

      <div className="card mb-5">
        <p className="section-title text-base mb-1">Sending to {supplier.name}</p>
        <p className="section-sub">
          {supplier.creditDays} days credit · {supplier.leadDays} days lead time · GSTIN {supplier.gstin}.
          Their own code sits beside ours on every line, so nobody has to work out what we meant.
        </p>
      </div>

      <TableCard maxH="30rem">
        <thead>
          <tr><th>VSA Code</th><th>{supplier.id} Code</th><th>Section</th>
            <th className="num">On Hand</th><th className="num">Reorder At</th><th className="num">Suggested</th>
            <th className="num">Order</th><th className="num">Kg</th><th className="num">Value</th><th>Note</th><th /></tr>
        </thead>
        <tbody>
          {lines.map(l => (
            <tr key={l.id} style={l.qty === 0 ? { opacity: .45 } : undefined}>
              <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{l.code}</td>
              <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--brand)' }}>
                {supplierCode(l.code, supplier.id)}
              </td>
              <td className="text-xs max-w-[15rem] truncate" title={l.name}>{l.name}</td>
              <td className="num tabular-nums text-xs"
                style={{ color: l.onHand < l.reorder ? 'var(--red)' : undefined }}>{l.onHand}</td>
              <td className="num tabular-nums text-xs">{l.reorder}</td>
              <td className="num tabular-nums text-xs" style={{ color: 'var(--text-4)' }}>{l.suggested}</td>
              <td className="num">
                <input className="input !w-20 !py-1 text-right tabular-nums !text-xs" value={l.qty}
                  onChange={e => patch(l.id, { qty: Math.max(0, Number(e.target.value) || 0) })} />
              </td>
              <td className="num tabular-nums text-xs">{(l.qty * l.kgPerLength).toFixed(1)}</td>
              <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>
                {l.qty ? inr(Math.round(l.qty * l.kgPerLength * l.ratePerKg)) : '—'}
              </td>
              <td>
                <input className="input !py-1 !text-xs !w-40" value={l.note} placeholder="Shade, cut length…"
                  onChange={e => patch(l.id, { note: e.target.value })} />
              </td>
              <td>
                <button className="btn-ghost !px-2 !py-1" title="Take off this order"
                  style={{ color: 'var(--red)' }} onClick={() => patch(l.id, { qty: 0 })}><Trash2 size={13} /></button>
              </td>
            </tr>
          ))}
          {lines.length === 0 && <tr><td colSpan={11}><Empty msg="Nothing is below its reorder level" /></td></tr>}
        </tbody>
      </TableCard>

      <button className="btn-outline mt-3" onClick={() => setLines(ls => ls.map(l => ({ ...l, qty: l.suggested })))}>
        <Plus size={14} /> Put every suggested quantity back
      </button>

      {/* ── The sheet as the supplier sees it ─────────────────────────── */}
      <Modal open={preview} onClose={() => setPreview(false)} title="Shortage order" wide>
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3" style={{ borderBottom: '2px solid var(--text-1)' }}>
            <div>
              <p className="font-bold text-base" style={{ color: 'var(--text-1)' }}>{COMPANY.name}</p>
              <p className="text-[11px] max-w-[24rem]" style={{ color: 'var(--text-4)' }}>{COMPANY.addressOneLine}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>GSTIN {COMPANY.gstin} · {COMPANY.phone}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>SHORTAGE ORDER</p>
              <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>{TODAY}</p>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>To</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{supplier.name}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>
              {supplier.contact} · {supplier.phone} · GSTIN {supplier.gstin}
            </p>
          </div>

          <div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--border-2)', maxHeight: '22rem' }}>
            <table className="tbl">
              <thead><tr><th className="num">#</th><th>Your Code</th><th>Our Code</th><th>Section</th>
                <th className="num">Qty (nos)</th><th className="num">Approx Kg</th><th>Note</th></tr></thead>
              <tbody>
                {active.map((l, i) => (
                  <tr key={l.id}>
                    <td className="num tabular-nums text-xs">{i + 1}</td>
                    <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>
                      {supplierCode(l.code, supplier.id)}
                    </td>
                    <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-4)' }}>{l.code}</td>
                    <td className="text-xs max-w-[16rem] truncate">{l.name}</td>
                    <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{l.qty}</td>
                    <td className="num tabular-nums text-xs">{(l.qty * l.kgPerLength).toFixed(1)}</td>
                    <td className="text-xs" style={{ color: 'var(--text-3)' }}>{l.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <table className="text-sm">
              <tbody>
                <tr><td className="pr-8 py-1" style={{ color: 'var(--text-3)' }}>Lines</td>
                  <td className="text-right tabular-nums">{active.length}</td></tr>
                <tr><td className="pr-8 py-1" style={{ color: 'var(--text-3)' }}>Pieces</td>
                  <td className="text-right tabular-nums">{active.reduce((s, l) => s + l.qty, 0)}</td></tr>
                <tr><td className="pr-8 py-1" style={{ color: 'var(--text-3)' }}>Approximate weight</td>
                  <td className="text-right tabular-nums">{weight.toLocaleString('en-IN')} kg</td></tr>
                <tr className="font-bold" style={{ color: 'var(--text-1)' }}>
                  <td className="pr-8 py-1.5 border-t" style={{ borderColor: 'var(--border-2)' }}>Estimated value</td>
                  <td className="text-right tabular-nums border-t" style={{ borderColor: 'var(--border-2)' }}>{inr(value)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[11px] pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
            Weights are approximate, worked from our standard weight per piece — the bill should follow your
            actual bundle weights. Rate to be confirmed against your circular current on the date of despatch.
            Delivery to {COMPANY.address.line3}.
          </p>
        </div>
      </Modal>
    </div>
  )
}
