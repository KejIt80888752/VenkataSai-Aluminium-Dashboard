import { useState, useMemo } from 'react'
import { Receipt, IndianRupee, Wallet, AlertTriangle, Eye, Printer } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Pager, usePaged, Empty, Pill } from '@/components/ui'
import InvoiceDoc from '@/components/InvoiceDoc'
import { INVOICES, TOTALS, MONTHS, type Invoice } from '@/data/txns'
import { inr, fmtDate, csvDownload } from '@/lib/utils'
import { FY } from '@/data/company'

const MONTH_OPTS = ['All Months', ...MONTHS.map(m => m.label)]
const monthOf = (d: string) => MONTHS.find(m => d.startsWith(m.key))?.label ?? ''

export default function Billing() {
  const [q, setQ]         = useState('')
  const [status, setStatus] = useState('All Status')
  const [month, setMonth]   = useState('All Months')
  const [doc, setDoc]       = useState<Invoice | null>(null)

  const rows = useMemo(() => INVOICES.filter(i =>
    (status === 'All Status' || i.status === status) &&
    (month === 'All Months' || monthOf(i.date) === month) &&
    (q === '' || `${i.no} ${i.clientName} ${i.poNo}`.toLowerCase().includes(q.toLowerCase())),
  ).sort((a, b) => b.date.localeCompare(a.date)), [q, status, month])

  const paged = usePaged(rows, 12)
  const filteredTotal = rows.reduce((s, i) => s + i.total, 0)
  const overdue = INVOICES.filter(i => i.status === 'Overdue')

  const exportCsv = () => csvDownload('vsa-invoice-register.csv', [
    ['Invoice No', 'Date', 'Due Date', 'Customer', 'GSTIN', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Received', 'Balance', 'Status'],
    ...rows.map(i => [i.no, i.date, i.dueDate, i.clientName, i.gstin, i.taxable, i.cgst, i.sgst, i.igst, i.total, i.received, i.total - i.received, i.status]),
  ])

  return (
    <div>
      <PageHead title="Billing / Invoice" sub={`GST tax invoice register · ${FY}`}>
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Invoices Raised"  value={String(INVOICES.length)}  icon={Receipt}     tone="brand"  sub={FY} />
        <Stat label="Total Billed"     value={inr(TOTALS.invoiced)}     icon={IndianRupee} tone="violet" sub="Inclusive of GST" />
        <Stat label="Collected"        value={inr(TOTALS.collected)}    icon={Wallet}      tone="green"  sub={`${Math.round((TOTALS.collected / TOTALS.invoiced) * 100)}% realised`} />
        <Stat label="Overdue Bills"    value={String(overdue.length)}   icon={AlertTriangle} tone="red"  sub={inr(overdue.reduce((s, i) => s + (i.total - i.received), 0)) + ' pending'} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search invoice no, customer, PO…" />
        <Select value={status} onChange={setStatus} options={['All Status', 'Paid', 'Partial', 'Unpaid', 'Overdue']} />
        <Select value={month} onChange={setMonth} options={MONTH_OPTS} />
        <span className="ml-auto self-center text-xs" style={{ color: 'var(--text-4)' }}>
          Filtered value: <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{inr(filteredTotal)}</span>
        </span>
      </div>

      <TableCard>
        <thead>
          <tr>
            <th>Invoice</th><th>Date</th><th>Customer</th><th className="num">Taxable</th>
            <th className="num">GST</th><th className="num">Total</th><th className="num">Balance</th><th>Status</th><th />
          </tr>
        </thead>
        <tbody>
          {paged.slice.map(i => (
            <tr key={i.id}>
              <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{i.no}</td>
              <td className="whitespace-nowrap text-xs">{fmtDate(i.date)}</td>
              <td className="max-w-[15rem] truncate">{i.clientName}</td>
              <td className="num tabular-nums">{inr(i.taxable)}</td>
              <td className="num tabular-nums text-xs">{inr(i.cgst + i.sgst + i.igst)}</td>
              <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(i.total)}</td>
              <td className={`num tabular-nums ${i.total - i.received > 0 ? 'text-red-500 font-medium' : ''}`}>
                {i.total - i.received > 0 ? inr(i.total - i.received) : '—'}
              </td>
              <td><Pill s={i.status} /></td>
              <td>
                <button onClick={() => setDoc(i)} className="btn-ghost !px-2 !py-1 text-xs" title="View invoice">
                  <Eye size={13} /> <Printer size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      {rows.length === 0 && <Empty msg="No invoices match these filters" />}
      <Pager {...paged} />

      {doc && <InvoiceDoc inv={doc} onClose={() => setDoc(null)} />}
    </div>
  )
}
