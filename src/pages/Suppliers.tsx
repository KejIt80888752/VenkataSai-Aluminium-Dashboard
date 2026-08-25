import { useState } from 'react'
import { Truck, IndianRupee, Clock, Package } from 'lucide-react'
import { PageHead, Stat, ExportBtn, TableCard, Pill } from '@/components/ui'
import { SUPPLIERS, type Supplier } from '@/data/parties'
import { PURCHASES, TOTALS } from '@/data/txns'
import { inr, fmtDate, csvDownload } from '@/lib/utils'
import { useCrud } from '@/lib/store'
import { CrudBar, RowActions, RecordModal, EditedDot, type Field, type Rec } from '@/components/crud'

const FIELDS: Field[] = [
  { key: 'name',       label: 'Supplier name', required: true, half: false },
  { key: 'category',   label: 'Supplies', hint: 'Extruded sections, sheets, glass, hardware' },
  { key: 'contact',    label: 'Contact person' },
  { key: 'phone',      label: 'Phone', required: true },
  { key: 'gstin',      label: 'GSTIN' },
  { key: 'state',      label: 'State' },
  { key: 'creditDays', label: 'Credit days', type: 'number' },
  { key: 'leadDays',   label: 'Lead days', type: 'number', hint: 'Order to delivery' },
]

const idOf = (s: Supplier) => s.id

export default function Suppliers() {
  const [edit, setEdit] = useState<Supplier | null>(null)
  const crud = useCrud<Supplier>('suppliers', SUPPLIERS, idOf)
  const list = crud.rows

  const stats = list.map(s => {
    const bills = PURCHASES.filter(p => p.supplierId === s.id)
    const value = bills.reduce((a, p) => a + p.total, 0)
    const due   = bills.reduce((a, p) => a + (p.total - p.paid), 0)
    const last  = bills.map(p => p.date).sort().pop() ?? ''
    return { ...s, bills: bills.length, value, due, last }
  }).sort((a, b) => b.value - a.value)

  const avgLead = list.length ? Math.round(list.reduce((s, x) => s + x.leadDays, 0) / list.length) : 0

  const exportCsv = () => csvDownload('vsa-suppliers.csv', [
    ['Supplier', 'Category', 'Contact', 'Phone', 'GSTIN', 'State', 'Credit Days', 'Lead Days', 'Bills', 'Purchase Value', 'Payable', 'Last Bill'],
    ...stats.map(s => [s.name, s.category, s.contact, s.phone, s.gstin, s.state, s.creditDays, s.leadDays, s.bills, s.value, s.due, s.last]),
  ])

  return (
    <div>
      <PageHead title="Suppliers" sub="Extrusion mills, sheet stockists, glass and hardware agencies">
        <ExportBtn onClick={exportCsv} />
        <CrudBar noun="Supplier" fields={FIELDS} changes={crud.changes} onRestore={crud.restore}
          onAdd={rec => crud.add(asSupplier(rec, list))}
          onImport={recs => crud.addMany(recs.map((r, i) => asSupplier(r, list, i)))} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Suppliers"        value={String(list.length)}  icon={Truck}       tone="brand"  sub="Empanelled vendors" />
        <Stat label="Purchase Value"   value={inr(stats.reduce((s, x) => s + x.value, 0))} icon={IndianRupee} tone="violet" sub="Inclusive of GST" />
        <Stat label="Payable"          value={inr(TOTALS.payable)}       icon={Package}     tone="red"    sub="Awaiting payment" />
        <Stat label="Avg Lead Time"    value={`${avgLead} days`}         icon={Clock}       tone="sky"    sub="Order to delivery" />
      </div>

      <TableCard maxH="40rem">
        <thead>
          <tr><th>Supplier</th><th>Supplies</th><th>Terms</th><th className="num">Bills</th><th className="num">Purchase Value</th><th className="num">Payable</th><th>Last Bill</th><th /></tr>
        </thead>
        <tbody>
          {stats.map(s => (
            <tr key={s.id}>
              <td>
                <p className="font-medium" style={{ color: 'var(--text-1)' }}>
                  <EditedDot isNew={crud.isNew(s.id)} isEdited={crud.isEdited(s.id)} />{s.name}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>{s.contact} · {s.phone} · {s.state}</p>
              </td>
              <td className="text-xs whitespace-nowrap">{s.category}</td>
              <td className="text-xs whitespace-nowrap">
                <span className="badge-gray">{s.creditDays}d credit</span>
                <span className="ml-1 badge-blue">{s.leadDays}d lead</span>
              </td>
              <td className="num tabular-nums">{s.bills}</td>
              <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(s.value)}</td>
              <td className={`num tabular-nums ${s.due > 0 ? 'text-red-500 font-medium' : ''}`}>{s.due > 0 ? inr(s.due) : '—'}</td>
              <td className="text-xs whitespace-nowrap">{s.last ? fmtDate(s.last) : '—'}</td>
              <td>
                <RowActions label={s.name}
                  onEdit={() => setEdit(list.find(x => x.id === s.id) ?? null)}
                  onDelete={() => crud.remove(s.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>

      <RecordModal open={!!edit} title={`Edit ${edit?.name ?? ''}`} fields={FIELDS}
        initial={edit as Rec | null}
        onSave={rec => { if (edit) crud.update(edit.id, rec as Partial<Supplier>); setEdit(null) }}
        onClose={() => setEdit(null)}
        onDelete={() => { if (edit) crud.remove(edit.id); setEdit(null) }} />

      <p className="text-[11px] mt-3" style={{ color: 'var(--text-4)' }}>
        Inter-state suppliers attract IGST — see <Pill s="Sent" /> tagged bills in GST Reports for input credit split.
      </p>
    </div>
  )
}

function asSupplier(r: Rec, existing: Supplier[], i = 0): Supplier {
  return {
    id: `S${String(existing.length + 1 + i).padStart(2, '0')}-${Date.now().toString(36).slice(-4)}`,
    ...r,
    creditDays: Number(r.creditDays) || 0,
    leadDays: Number(r.leadDays) || 0,
  } as Supplier
}
