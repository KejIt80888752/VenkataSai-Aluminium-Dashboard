import { Truck, IndianRupee, Clock, Package } from 'lucide-react'
import { PageHead, Stat, ExportBtn, TableCard, Pill } from '@/components/ui'
import { SUPPLIERS } from '@/data/parties'
import { PURCHASES, TOTALS } from '@/data/txns'
import { inr, fmtDate, csvDownload } from '@/lib/utils'

export default function Suppliers() {
  const stats = SUPPLIERS.map(s => {
    const bills = PURCHASES.filter(p => p.supplierId === s.id)
    const value = bills.reduce((a, p) => a + p.total, 0)
    const due   = bills.reduce((a, p) => a + (p.total - p.paid), 0)
    const last  = bills.map(p => p.date).sort().pop() ?? ''
    return { ...s, bills: bills.length, value, due, last }
  }).sort((a, b) => b.value - a.value)

  const avgLead = Math.round(SUPPLIERS.reduce((s, x) => s + x.leadDays, 0) / SUPPLIERS.length)

  const exportCsv = () => csvDownload('vsa-suppliers.csv', [
    ['Supplier', 'Category', 'Contact', 'Phone', 'GSTIN', 'State', 'Credit Days', 'Lead Days', 'Bills', 'Purchase Value', 'Payable', 'Last Bill'],
    ...stats.map(s => [s.name, s.category, s.contact, s.phone, s.gstin, s.state, s.creditDays, s.leadDays, s.bills, s.value, s.due, s.last]),
  ])

  return (
    <div>
      <PageHead title="Suppliers" sub="Extrusion mills, sheet stockists, glass and hardware agencies">
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Suppliers"        value={String(SUPPLIERS.length)}  icon={Truck}       tone="brand"  sub="Empanelled vendors" />
        <Stat label="Purchase Value"   value={inr(stats.reduce((s, x) => s + x.value, 0))} icon={IndianRupee} tone="violet" sub="Inclusive of GST" />
        <Stat label="Payable"          value={inr(TOTALS.payable)}       icon={Package}     tone="red"    sub="Awaiting payment" />
        <Stat label="Avg Lead Time"    value={`${avgLead} days`}         icon={Clock}       tone="sky"    sub="Order to delivery" />
      </div>

      <TableCard maxH="40rem">
        <thead>
          <tr><th>Supplier</th><th>Supplies</th><th>Terms</th><th className="num">Bills</th><th className="num">Purchase Value</th><th className="num">Payable</th><th>Last Bill</th></tr>
        </thead>
        <tbody>
          {stats.map(s => (
            <tr key={s.id}>
              <td>
                <p className="font-medium" style={{ color: 'var(--text-1)' }}>{s.name}</p>
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
            </tr>
          ))}
        </tbody>
      </TableCard>

      <p className="text-[11px] mt-3" style={{ color: 'var(--text-4)' }}>
        Inter-state suppliers attract IGST — see <Pill s="Sent" /> tagged bills in GST Reports for input credit split.
      </p>
    </div>
  )
}
