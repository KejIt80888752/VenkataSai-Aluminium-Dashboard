import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ShoppingBag, IndianRupee, Truck, Scale } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Pager, usePaged, Empty, Pill, useChartTheme } from '@/components/ui'
import { PURCHASES, TOTALS, monthlySales, type Purchase } from '@/data/txns'
import { SUPPLIERS } from '@/data/parties'
import { inr, inrShort, fmtDate, csvDownload } from '@/lib/utils'
import { FY } from '@/data/company'
import { useCrud } from '@/lib/store'
import { CrudBar, RowActions, RecordModal, EditedDot, type Field, type Rec } from '@/components/crud'

const FIELDS: Field[] = [
  { key: 'no',       label: 'Bill no', required: true },
  { key: 'date',     label: 'Bill date', type: 'date', required: true },
  { key: 'dueDate',  label: 'Due date', type: 'date' },
  { key: 'supplier', label: 'Supplier', required: true },
  { key: 'gstin',    label: 'Supplier GSTIN' },
  { key: 'state',    label: 'State' },
  { key: 'category', label: 'Category' },
  { key: 'taxable',  label: 'Taxable value', type: 'number', required: true },
  { key: 'cgst',     label: 'CGST', type: 'number' },
  { key: 'sgst',     label: 'SGST', type: 'number' },
  { key: 'igst',     label: 'IGST', type: 'number' },
  { key: 'total',    label: 'Bill total', type: 'number', required: true },
  { key: 'paid',     label: 'Paid so far', type: 'number' },
  { key: 'weightKg', label: 'Weight (kg)', type: 'number' },
  { key: 'status',   label: 'Status', type: 'select', options: ['Paid', 'Partial', 'Unpaid', 'Overdue'] },
]

const idOf = (p: Purchase) => p.no

export default function Purchases() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All Status')
  const [sup, setSup] = useState('All Suppliers')
  const t = useChartTheme()
  const [edit, setEdit] = useState<Purchase | null>(null)
  const crud = useCrud<Purchase>('purchases', PURCHASES, idOf)
  const list = crud.rows

  const rows = useMemo(() => list.filter(p =>
    (status === 'All Status' || p.status === status) &&
    (sup === 'All Suppliers' || p.supplier === sup) &&
    (q === '' || `${p.no} ${p.supplier} ${p.category}`.toLowerCase().includes(q.toLowerCase())),
  ).sort((a, b) => b.date.localeCompare(a.date)), [list, q, status, sup])

  const paged = usePaged(rows, 12)
  const totalKg = list.reduce((s, p) => s + p.weightKg, 0)

  const bySupplier = SUPPLIERS.map(s => ({
    name: s.name.split(' ').slice(0, 2).join(' '),
    value: Math.round(list.filter(p => p.supplierId === s.id).reduce((a, p) => a + p.taxable, 0)),
  })).sort((a, b) => b.value - a.value)

  const exportCsv = () => csvDownload('vsa-purchase-register.csv', [
    ['Bill No', 'Date', 'Due Date', 'Supplier', 'GSTIN', 'Category', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Paid', 'Balance', 'Status'],
    ...rows.map(p => [p.no, p.date, p.dueDate, p.supplier, p.gstin, p.category, p.taxable, p.cgst, p.sgst, p.igst, p.total, p.paid, p.total - p.paid, p.status]),
  ])

  return (
    <div>
      <PageHead title="Purchase Register" sub={`Inward bills from extrusion mills, stockists and hardware agencies · ${FY}`}>
        <ExportBtn onClick={exportCsv} />
        <CrudBar noun="Purchase Bill" fields={FIELDS} changes={crud.changes} onRestore={crud.restore}
          onAdd={rec => crud.add(asPurchase(rec))}
          onImport={recs => crud.addMany(recs.map((r, i) => asPurchase(r, i)))} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Purchase Bills"   value={String(PURCHASES.length)} icon={ShoppingBag} tone="brand" sub={FY} />
        <Stat label="Purchase Value"   value={inr(TOTALS.purchases)}    icon={IndianRupee} tone="violet" sub="Taxable value" />
        <Stat label="Payable to Suppliers" value={inr(TOTALS.payable)}  icon={Truck}       tone="red"    sub="Net of payments made" />
        <Stat label="Material Received" value={`${totalKg.toLocaleString('en-IN')} kg`} icon={Scale} tone="sky" sub="Approx. by bill value" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
        <div className="card">
          <p className="section-title text-base mb-1">Monthly Purchases</p>
          <p className="section-sub mb-3">Buying pattern across the year</p>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={monthlySales} barSize={26} margin={{ left: -6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
              <XAxis dataKey="m" tick={t.tick} axisLine={false} tickLine={false} />
              <YAxis tick={t.tick} axisLine={false} tickLine={false} tickFormatter={inrShort} width={62} />
              <Tooltip contentStyle={t.tooltip} formatter={(v: number) => [inr(v), 'Purchases']} cursor={{ fill: 'rgba(15,91,143,.06)' }} />
              <Bar isAnimationActive={false} dataKey="purchases" fill="#0f5b8f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <p className="section-title text-base mb-1">Spend by Supplier</p>
          <p className="section-sub mb-3">Taxable purchase value</p>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={bySupplier} layout="vertical" margin={{ left: 30, right: 12 }} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} horizontal={false} />
              <XAxis type="number" tick={t.tick} axisLine={false} tickLine={false} tickFormatter={inrShort} />
              <YAxis type="category" dataKey="name" tick={{ ...t.tick, fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={t.tooltip} formatter={(v: number) => [inr(v), 'Purchases']} cursor={{ fill: 'rgba(15,91,143,.06)' }} />
              <Bar isAnimationActive={false} dataKey="value" fill="#2b8fd4" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search bill no, supplier…" />
        <Select value={status} onChange={setStatus} options={['All Status', 'Paid', 'Partial', 'Unpaid', 'Overdue']} />
        <Select value={sup} onChange={setSup} options={['All Suppliers', ...SUPPLIERS.map(s => s.name)]} />
      </div>

      <TableCard>
        <thead>
          <tr><th>Bill No</th><th>Date</th><th>Supplier</th><th>Category</th><th className="num">Taxable</th><th className="num">Total</th><th className="num">Balance</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          {paged.slice.map(p => (
            <tr key={p.id}>
              <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>
                <EditedDot isNew={crud.isNew(p.no)} isEdited={crud.isEdited(p.no)} />{p.no}
              </td>
              <td className="whitespace-nowrap text-xs">{fmtDate(p.date)}</td>
              <td className="max-w-[15rem] truncate">{p.supplier}</td>
              <td className="text-xs whitespace-nowrap">{p.category}</td>
              <td className="num tabular-nums">{inr(p.taxable)}</td>
              <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(p.total)}</td>
              <td className={`num tabular-nums ${p.total - p.paid > 0 ? 'text-red-500 font-medium' : ''}`}>
                {p.total - p.paid > 0 ? inr(p.total - p.paid) : '—'}
              </td>
              <td><Pill s={p.status} /></td>
              <td><RowActions label={p.no} onEdit={() => setEdit(p)} onDelete={() => crud.remove(p.no)} /></td>
            </tr>
          ))}
        </tbody>
      </TableCard>

      <RecordModal open={!!edit} title={`Edit ${edit?.no ?? ''}`} fields={FIELDS}
        initial={edit as Rec | null}
        onSave={rec => { if (edit) crud.update(edit.no, rec as Partial<Purchase>); setEdit(null) }}
        onClose={() => setEdit(null)}
        onDelete={() => { if (edit) crud.remove(edit.no); setEdit(null) }} />
      {rows.length === 0 && <Empty msg="No purchase bills match these filters" />}
      <Pager {...paged} />
    </div>
  )
}

function asPurchase(r: Rec, i = 0): Purchase {
  const taxable = Number(r.taxable) || 0
  const total   = Number(r.total) || Math.round(taxable * 1.18)
  return {
    id: `P-${Date.now().toString(36)}${i}`,
    supplierId: '', items: 1,
    date: r.date || new Date().toISOString().slice(0, 10),
    status: r.status || 'Unpaid',
    ...r,
    taxable, total,
    cgst: Number(r.cgst) || 0, sgst: Number(r.sgst) || 0, igst: Number(r.igst) || 0,
    paid: Number(r.paid) || 0, weightKg: Number(r.weightKg) || 0,
  } as Purchase
}
