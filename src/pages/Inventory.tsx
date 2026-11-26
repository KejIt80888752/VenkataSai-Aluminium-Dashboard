import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Warehouse, PackageX, Scale, IndianRupee, AlertTriangle } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Pager, usePaged, Empty, useChartTheme } from '@/components/ui'
import { P, CATEGORIES, stockQty, stockValue, isLow } from '@/data/catalogue'
import { inr, inrShort, csvDownload, cn } from '@/lib/utils'
import { useCrud } from '@/lib/store'
import { INVOICES, type Invoice } from '@/data/txns'
import { SAMPLE_DC } from '@/data/despatch'
import { LOADED } from '@/data/coatbook'
import { masterIdOf, productById } from '@/data/productmaster'
import { issuedByProduct, receivedByProduct, positionOf } from '@/lib/stockledger'

export default function Inventory() {
  /* ── Stock that moves ──────────────────────────────────────────────────
     Theirs, on 22-11: "in stock qty and weight reduces." It did not — the
     figure sat where it had been put however many bills went out, which is
     worse than no figure at all because somebody will trust it.

     It is worked out now, the way a ledger is: the opening figure against
     the product, plus every lorry on a purchase DC, less everything billed
     out on a tax invoice. Pieces and kilos both, because they sell both
     ways. See src/lib/stockledger.ts. */
  const invs = useCrud<Invoice>('invoices', INVOICES, (x: Invoice) => x.no)
  const issued = useMemo(() => issuedByProduct(invs.rows), [invs.rows])
  const received = useMemo(() => receivedByProduct([
    {
      rows: LOADED.map(l => ({
        productId: masterIdOf(l) ?? '', nos: l.nos ?? 0, kg: l.kg,
      })),
    },
    {
      rows: SAMPLE_DC.lines.map(l => ({
        productId: '', nos: l.pieces, kg: l.netWeightKg,
      })),
    },
  ]), [])

  const [q, setQ]         = useState('')
  const [cat, setCat]     = useState('All Categories')
  const [god, setGod]     = useState('All Godowns')
  const [only, setOnly]   = useState(false)
  const t = useChartTheme()

  const rows = useMemo(() => P.filter(p =>
    (cat === 'All Categories' || p.category === cat) &&
    (god === 'All Godowns'    || p.godown === god) &&
    (!only || isLow(p)) &&
    (q === '' || `${p.code} ${p.name} ${p.rack}`.toLowerCase().includes(q.toLowerCase())),
  ).sort((a, b) => (isLow(b) ? 1 : 0) - (isLow(a) ? 1 : 0)), [q, cat, god, only])

  const paged = usePaged(rows, 12)

  const totalValue = P.reduce((s, p) => s + stockValue(p), 0)
  const totalKg    = P.filter(p => p.unit === 'kg').reduce((s, p) => s + stockQty(p), 0)
  const lowCount   = P.filter(isLow).length
  const totalPcs   = P.reduce((s, p) => s + p.stockPcs, 0)

  const byCategory = CATEGORIES.map(c => ({
    name: c,
    value: Math.round(P.filter(p => p.category === c).reduce((s, p) => s + stockValue(p), 0)),
    low: P.filter(p => p.category === c && isLow(p)).length,
  })).sort((a, b) => b.value - a.value)

  const exportCsv = () => csvDownload('vsa-stock-position.csv', [
    ['Code', 'Product', 'Category', 'Godown', 'Rack', 'Stock (pcs)', 'Qty', 'Unit', 'Reorder (pcs)', 'Cost/Unit', 'Stock Value', 'Status'],
    ...rows.map(p => [p.code, p.name, p.category, p.godown, p.rack, p.stockPcs, stockQty(p).toFixed(1), p.unit, p.reorderPcs, p.costPerKg, Math.round(stockValue(p)), isLow(p) ? 'Reorder' : 'OK']),
  ])

  return (
    <div>
      <PageHead title="Stock & Inventory"
        sub="Opening, plus every purchase DC, less everything billed out — in pieces and in kilos">
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Total Stock Value" value={inr(totalValue)}                        icon={IndianRupee} tone="brand" sub="At landed cost" />
        <Stat label="Section Weight"    value={`${Math.round(totalKg).toLocaleString('en-IN')} kg`} icon={Scale}   tone="sky"   sub="Extrusions and sheets" />
        <Stat label="Pieces in Godown"  value={totalPcs.toLocaleString('en-IN')}       icon={Warehouse}   tone="violet" sub="All SKUs combined" />
        <Stat label="Reorder Alerts"    value={String(lowCount)}                       icon={PackageX}    tone="amber" sub="At or below reorder level" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
        <div className="card xl:col-span-2">
          <p className="section-title text-base mb-1">Stock Value by Category</p>
          <p className="section-sub mb-3">Amber bars carry at least one reorder alert</p>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={byCategory} margin={{ left: -6, bottom: 30 }} barSize={26}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ ...t.tick, fontSize: 10 }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" interval={0} height={54} />
              <YAxis tick={t.tick} axisLine={false} tickLine={false} tickFormatter={inrShort} width={62} />
              <Tooltip contentStyle={t.tooltip} formatter={(v: number) => [inr(v), 'Stock value']} cursor={{ fill: 'rgba(15,91,143,.06)' }} />
              <Bar isAnimationActive={false} dataKey="value" radius={[4, 4, 0, 0]}>
                {byCategory.map((c, i) => <Cell key={i} fill={c.low ? '#f59e0b' : '#0f5b8f'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <p className="section-title text-base mb-1">Reorder Worklist</p>
          <p className="section-sub mb-3">Raise purchase orders for these</p>
          <div className="space-y-2.5 max-h-[15rem] overflow-y-auto pr-1">
            {P.filter(isLow).length === 0 && <p className="text-sm py-8 text-center" style={{ color: 'var(--text-4)' }}>No reorder alerts</p>}
            {P.filter(isLow).map(p => (
              <div key={p.id} className="flex items-start gap-2.5">
                <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text-1)' }}>{p.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>
                    {p.code} · {p.stockPcs} pcs on hand vs {p.reorderPcs} reorder · rack {p.rack}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search code, product, rack…" />
        <Select value={cat} onChange={setCat} options={['All Categories', ...CATEGORIES]} />
        <Select value={god} onChange={setGod} options={['All Godowns', 'Main Godown', 'Yard 2']} />
        <button onClick={() => setOnly(o => !o)} className={only ? 'btn' : 'btn-outline'}>
          <PackageX size={14} /> Low stock only
        </button>
      </div>

      <TableCard>
        <thead>
          <tr>
            <th>Code</th><th>Product</th>
            <th className="num">Opening</th>
            <th className="num">Received</th>
            <th className="num">Billed out</th>
            <th className="num">On hand</th>
            <th className="num">On hand (kg)</th>
            <th className="num">Stock Value</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {paged.slice.map(p => {
            const kgEach = productById(p.id)?.kgPerPiece ?? null
            const pos = positionOf(
              p.id,
              { nos: p.stockPcs, kg: kgEach !== null ? +(p.stockPcs * kgEach).toFixed(3) : 0 },
              received, issued,
            )
            const short = pos.onHand.nos < 0
            return (
            <tr key={p.id}>
              <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{p.code}</td>
              <td className="font-medium max-w-[15rem] truncate" style={{ color: 'var(--text-1)' }}>{p.name}</td>
              <td className="num tabular-nums text-xs" style={{ color: 'var(--text-4)' }}>
                {pos.opening.nos || '—'}
              </td>
              <td className="num tabular-nums text-xs" style={{ color: pos.received.nos ? 'var(--green)' : 'var(--text-4)' }}>
                {pos.received.nos ? `+${pos.received.nos}` : '—'}
              </td>
              <td className="num tabular-nums text-xs" style={{ color: pos.issued.nos ? 'var(--red)' : 'var(--text-4)' }}>
                {pos.issued.nos ? `−${pos.issued.nos}` : '—'}
              </td>
              <td className={cn('num tabular-nums font-semibold', short && 'text-amber-600')}
                style={short ? undefined : { color: 'var(--text-1)' }}>
                {pos.onHand.nos} pcs
              </td>
              <td className="num tabular-nums text-xs">
                {pos.onHand.kg ? `${pos.onHand.kg.toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg` : '—'}
              </td>
              <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(stockValue(p))}</td>
              <td>
                {short
                  ? <span className="badge-red">Billed over stock</span>
                  : isLow(p) ? <span className="badge-yellow">Reorder</span>
                  : <span className="badge-green">In Stock</span>}
              </td>
            </tr>
          )})}
        </tbody>
      </TableCard>
      {rows.length === 0 && <Empty msg="No stock lines match these filters" />}
      <Pager {...paged} />
    </div>
  )
}
