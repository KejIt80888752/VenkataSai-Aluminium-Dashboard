import { useState } from 'react'
import { ClipboardList, Clock, PackageCheck, IndianRupee, PhoneCall } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Modal, Empty } from '@/components/ui'
import { PURCHASE_ORDERS, type PurchaseOrder } from '@/data/positions'
import { SUPPLIERS } from '@/data/parties'
import { inr, fmtDate, daysAgo, csvDownload, cn } from '@/lib/utils'
import { FY } from '@/data/company'
import { useCrud } from '@/lib/store'
import { CrudBar, RowActions, RecordModal, EditedDot, type Field, type Rec } from '@/components/crud'

const FIELDS: Field[] = [
  { key: 'no',           label: 'PO no', required: true },
  { key: 'date',         label: 'Order date', type: 'date', required: true },
  { key: 'supplier',     label: 'Supplier', required: true },
  { key: 'expectedDate', label: 'Expected on', type: 'date' },
  { key: 'orderedNos',   label: 'Pieces ordered', type: 'number' },
  { key: 'receivedNos',  label: 'Pieces received', type: 'number' },
  { key: 'value',        label: 'Order value', type: 'number' },
  { key: 'followUps',    label: 'Follow-ups made', type: 'number' },
  { key: 'status',       label: 'Status', type: 'select',
    options: ['Confirmed — Awaiting Delivery', 'Part Received', 'Overdue', 'Closed'] },
]

const idOf = (p: PurchaseOrder) => p.no

export default function PurchaseOrders() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All Status')
  const [open, setOpen] = useState<PurchaseOrder | null>(null)
  const [edit, setEdit] = useState<PurchaseOrder | null>(null)
  const crud = useCrud<PurchaseOrder>('purchase-orders', PURCHASE_ORDERS, idOf)
  const list = crud.rows

  const rows = list.filter(p =>
    (status === 'All Status' || p.status === status) &&
    (q === '' || `${p.no} ${p.supplier}`.toLowerCase().includes(q.toLowerCase())),
  )

  const overdue = list.filter(p => p.status === 'Overdue')
  const pendingValue = PURCHASE_ORDERS.reduce((s, p) => s + Math.round(p.value * (p.pendingNos / Math.max(1, p.orderedNos))), 0)

  const exportCsv = () => csvDownload('vsa-open-purchase-orders.csv', [
    ['PO No', 'Date', 'Supplier', 'Expected', 'Item', 'Ordered Nos', 'Received Nos', 'Pending Nos', 'Kg', 'Rate/Kg', 'Status'],
    ...rows.flatMap(p => p.items.map(i => [p.no, p.date, p.supplier, p.expectedDate, i.name, i.orderedNos, i.receivedNos, i.orderedNos - i.receivedNos, i.kg, i.ratePerKg, p.status])),
  ])

  return (
    <div>
      <PageHead title="Purchase Orders" sub={`Confirmed orders placed on suppliers and not yet fully received · ${FY}`}>
        <ExportBtn onClick={exportCsv} />
        <CrudBar noun="Purchase Order" fields={FIELDS} changes={crud.changes} onRestore={crud.restore}
          onAdd={rec => crud.add(asPO(rec))}
          onImport={recs => crud.addMany(recs.map((r, i) => asPO(r, i)))} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Open Orders"     value={String(PURCHASE_ORDERS.length)} icon={ClipboardList} tone="brand" sub={`${SUPPLIERS.length} suppliers on the panel`} />
        <Stat label="Pieces Awaited"  value={PURCHASE_ORDERS.reduce((s, p) => s + p.pendingNos, 0).toLocaleString('en-IN')} icon={PackageCheck} tone="sky" sub="Not yet delivered" />
        <Stat label="Value Committed" value={inr(pendingValue)} icon={IndianRupee} tone="violet" sub="On the undelivered portion" />
        <Stat label="Past Due"        value={String(overdue.length)} icon={Clock} tone={overdue.length ? 'red' : 'green'} sub={`${overdue.reduce((s, p) => s + p.followUps, 0)} follow-ups logged`} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search PO no or supplier…" />
        <Select value={status} onChange={setStatus} options={['All Status', 'Confirmed — Awaiting Delivery', 'Part Received', 'Overdue']} className="min-w-[15rem]" />
      </div>

      <TableCard maxH="32rem">
        <thead>
          <tr><th>PO No</th><th>Date</th><th>Supplier</th><th>Expected</th><th className="num">Ordered</th><th className="num">Received</th><th className="num">Pending</th><th className="num">Value</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          {rows.map(p => {
            const late = daysAgo(p.expectedDate)
            return (
              <tr key={p.id} className="cursor-pointer" onClick={() => setOpen(p)}>
                <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>
                  <EditedDot isNew={crud.isNew(p.no)} isEdited={crud.isEdited(p.no)} />{p.no}
                </td>
                <td className="text-xs whitespace-nowrap">{fmtDate(p.date)}</td>
                <td className="max-w-[14rem] truncate">{p.supplier}</td>
                <td className="text-xs whitespace-nowrap">
                  {fmtDate(p.expectedDate)}
                  {late > 0 && <span className="text-red-500 font-medium"> · {late}d late</span>}
                </td>
                <td className="num tabular-nums">{p.orderedNos.toLocaleString('en-IN')}</td>
                <td className="num tabular-nums">{p.receivedNos ? p.receivedNos.toLocaleString('en-IN') : '—'}</td>
                <td className="num tabular-nums font-semibold text-amber-600">{p.pendingNos.toLocaleString('en-IN')}</td>
                <td className="num tabular-nums">{inr(p.value)}</td>
                <td>
                  <span className={cn(
                    p.status === 'Overdue' ? 'badge-red'
                    : p.status === 'Part Received' ? 'badge-yellow' : 'badge-blue')}>{p.status}</span>
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <RowActions label={p.no} onEdit={() => setEdit(p)} onDelete={() => crud.remove(p.no)} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </TableCard>

      <RecordModal open={!!edit} title={`Edit ${edit?.no ?? ''}`} fields={FIELDS}
        initial={edit as Rec | null}
        onSave={rec => { if (edit) crud.update(edit.no, asPOPatch(rec)); setEdit(null) }}
        onClose={() => setEdit(null)}
        onDelete={() => { if (edit) crud.remove(edit.no); setEdit(null) }} />
      {rows.length === 0 && <Empty msg="No open purchase orders" />}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.no} — ${open.supplier}` : ''} wide>
        {open && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className={open.status === 'Overdue' ? 'badge-red' : 'badge-blue'}>{open.status}</span>
              <span className="badge-gray">Ordered {fmtDate(open.date)}</span>
              <span className="badge-gray">Expected {fmtDate(open.expectedDate)}</span>
              {open.followUps > 0 && <span className="badge-yellow"><PhoneCall size={11} /> {open.followUps} follow-ups</span>}
            </div>

            <div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--border-2)', maxHeight: '18rem' }}>
              <table className="tbl">
                <thead><tr><th>Item</th><th className="num">Ordered</th><th className="num">Received</th><th className="num">Pending</th><th className="num">Weight</th><th className="num">Rate/Kg</th><th className="num">Value</th></tr></thead>
                <tbody>
                  {open.items.map((i, k) => (
                    <tr key={k}>
                      <td>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{i.name}</p>
                        <p className="font-mono text-[10px]" style={{ color: 'var(--text-4)' }}>{i.code}</p>
                      </td>
                      <td className="num tabular-nums">{i.orderedNos}</td>
                      <td className="num tabular-nums">{i.receivedNos || '—'}</td>
                      <td className="num tabular-nums font-semibold text-amber-600">{i.orderedNos - i.receivedNos}</td>
                      <td className="num tabular-nums text-xs">{i.kg} kg</td>
                      <td className="num tabular-nums text-xs">{inr(i.ratePerKg)}</td>
                      <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{inr(i.kg * i.ratePerKg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

const asPOPatch = (r: Rec): Partial<PurchaseOrder> => {
  const ordered = Number(r.orderedNos) || 0
  const received = Number(r.receivedNos) || 0
  return {
    ...r, orderedNos: ordered, receivedNos: received,
    pendingNos: Math.max(0, ordered - received),
    value: Number(r.value) || 0, followUps: Number(r.followUps) || 0,
  } as Partial<PurchaseOrder>
}

function asPO(r: Rec, i = 0): PurchaseOrder {
  return {
    id: `PO-${Date.now().toString(36)}${i}`, supplierId: '', items: [],
    date: r.date || new Date().toISOString().slice(0, 10),
    status: r.status || 'Confirmed — Awaiting Delivery',
    ...asPOPatch(r),
  } as unknown as PurchaseOrder
}
