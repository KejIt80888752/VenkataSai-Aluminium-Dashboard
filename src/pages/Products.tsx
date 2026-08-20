import { useState, useMemo } from 'react'
import { Package, Layers, IndianRupee, Tag } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Pager, usePaged, Empty, Modal, Pill } from '@/components/ui'
import { P, CATEGORIES, stockQty, stockValue, isLow, type Product } from '@/data/catalogue'
import { inr, inr2, csvDownload, cn } from '@/lib/utils'

export default function Products() {
  const [q, setQ]       = useState('')
  const [cat, setCat]   = useState('All Categories')
  const [fin, setFin]   = useState('All Finishes')
  const [sel, setSel]   = useState<Product | null>(null)

  const finishes = useMemo(() => ['All Finishes', ...new Set(P.map(p => p.finish))], [])

  const rows = useMemo(() => P.filter(p =>
    (cat === 'All Categories' || p.category === cat) &&
    (fin === 'All Finishes'  || p.finish === fin) &&
    (q === '' || `${p.code} ${p.name} ${p.brand} ${p.series}`.toLowerCase().includes(q.toLowerCase())),
  ), [q, cat, fin])

  const paged = usePaged(rows, 12)
  const catalogueValue = P.reduce((s, p) => s + stockValue(p), 0)
  const avgRate = P.filter(p => p.unit === 'kg').reduce((s, p) => s + p.ratePerKg, 0) / P.filter(p => p.unit === 'kg').length

  const exportCsv = () => csvDownload('vsa-product-catalogue.csv', [
    ['Code', 'Product', 'Category', 'Series', 'Brand', 'Finish', 'Length (ft)', 'Kg/Length', 'Unit', 'Rate', 'Cost', 'HSN', 'GST %', 'Stock (pcs)'],
    ...rows.map(p => [p.code, p.name, p.category, p.series, p.brand, p.finish, p.lengthFt || '—', p.kgPerLength, p.unit, p.ratePerKg, p.costPerKg, p.hsn, p.gst, p.stockPcs]),
  ])

  return (
    <div>
      <PageHead title="Product Catalogue" sub="Extruded sections, sheets, ACP, glass and fabrication hardware">
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="SKUs Listed"        value={String(P.length)}                icon={Package}     tone="brand"  sub={`${CATEGORIES.length} categories`} />
        <Stat label="Catalogue Value"    value={inr(catalogueValue)}             icon={IndianRupee} tone="violet" sub="At landed cost" />
        <Stat label="Avg Section Rate"   value={inr2(avgRate) + '/kg'}           icon={Tag}         tone="sky"    sub="Across all finishes" />
        <Stat label="Below Reorder"      value={String(P.filter(isLow).length)}  icon={Layers}      tone="amber"  sub="Needs purchase order" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search code, name, brand…" />
        <Select value={cat} onChange={setCat} options={['All Categories', ...CATEGORIES]} />
        <Select value={fin} onChange={setFin} options={finishes} />
      </div>

      <TableCard>
        <thead>
          <tr>
            <th>Code</th><th>Product</th><th>Category</th><th>Brand / Finish</th>
            <th className="num">Std Length</th><th className="num">Rate</th><th className="num">Stock</th><th>HSN</th>
          </tr>
        </thead>
        <tbody>
          {paged.slice.map(p => (
            <tr key={p.id} className="cursor-pointer" onClick={() => setSel(p)}>
              <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{p.code}</td>
              <td className="font-medium max-w-[16rem] truncate" style={{ color: 'var(--text-1)' }}>{p.name}</td>
              <td className="whitespace-nowrap text-xs">{p.category}</td>
              <td className="whitespace-nowrap text-xs">
                <span style={{ color: 'var(--text-2)' }}>{p.brand}</span>
                <span style={{ color: 'var(--text-4)' }}> · {p.finish}</span>
              </td>
              <td className="num whitespace-nowrap text-xs">{p.lengthFt ? `${p.lengthFt} ft / ${p.kgPerLength} kg` : '—'}</td>
              <td className="num font-semibold tabular-nums whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{inr2(p.ratePerKg)}<span className="text-xs font-normal" style={{ color: 'var(--text-4)' }}>/{p.unit}</span></td>
              <td className={cn('num tabular-nums whitespace-nowrap', isLow(p) && 'text-amber-600 font-semibold')}>
                {p.stockPcs} <span className="text-xs" style={{ color: 'var(--text-4)' }}>pcs</span>
              </td>
              <td className="text-xs">{p.hsn}</td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      {rows.length === 0 && <Empty msg="No products match these filters" />}
      <Pager {...paged} />

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.name ?? ''}>
        {sel && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="badge-brand font-mono">{sel.code}</span>
              <Pill s={isLow(sel) ? 'Overdue' : 'Active'} />
              <span className="badge-gray">{sel.category}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Field k="Brand"          v={sel.brand} />
              <Field k="Series"         v={sel.series} />
              <Field k="Finish"         v={sel.finish} />
              <Field k="Standard Length" v={sel.lengthFt ? `${sel.lengthFt} ft` : '—'} />
              <Field k="Weight / Length" v={sel.lengthFt ? `${sel.kgPerLength} kg` : '—'} />
              <Field k="Selling Unit"    v={sel.unit} />
              <Field k="Selling Rate"    v={`${inr2(sel.ratePerKg)} / ${sel.unit}`} />
              <Field k="Landed Cost"     v={`${inr2(sel.costPerKg)} / ${sel.unit}`} />
              <Field k="Margin"          v={`${(((sel.ratePerKg - sel.costPerKg) / sel.ratePerKg) * 100).toFixed(1)}%`} />
              <Field k="HSN / GST"       v={`${sel.hsn} · ${sel.gst}%`} />
              <Field k="Stock on Hand"   v={`${sel.stockPcs} pcs · ${stockQty(sel).toFixed(1)} ${sel.unit}`} />
              <Field k="Reorder Level"   v={`${sel.reorderPcs} pcs`} />
              <Field k="Rack / Godown"   v={`${sel.rack} · ${sel.godown}`} />
              <Field k="Stock Value"     v={inr(stockValue(sel))} />
            </dl>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px]" style={{ color: 'var(--text-4)' }}>{k}</dt>
      <dd className="font-medium" style={{ color: 'var(--text-1)' }}>{v}</dd>
    </div>
  )
}
