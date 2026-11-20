import { useState, useMemo } from 'react'
import { Receipt, IndianRupee, Wallet, AlertTriangle, Eye, Printer } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Pager, usePaged, Empty, Pill } from '@/components/ui'
import InvoiceDoc from '@/components/InvoiceDoc'
import { INVOICES, MONTHS, type Invoice } from '@/data/txns'
import { inr, fmtDate, csvDownload , pctOf } from '@/lib/utils'
import { FY } from '@/data/company'
import { Link } from 'react-router-dom'
import { Mic } from 'lucide-react'
import { useCrud } from '@/lib/store'
import { RowActions, RecordModal, EditedDot, type Field, type Rec } from '@/components/crud'
import DocBuilder from '@/components/DocBuilder'
import { asInvoice } from '@/lib/docshapes'
import { nextDocNo } from '@/lib/docnos'
import { Plus } from 'lucide-react'

/* ── Raising a bill ────────────────────────────────────────────────────────
   The shop looked at this screen on 20-11-2026 and said the same thing they
   had said about quotations: "even the basic things are not there." They were
   right. A bill could be added only by typing a number, a date and a figure,
   with nowhere at all to put the material — so a total could be billed that no
   line of stock supported.

   New Bill still goes to the Quick Bill counter screen, which is the right
   place when somebody is standing at the counter. This is the other way in:
   the office raising a bill against material, with the number issued from the
   series, the tax split by place of supply and the total coming off the lines.

   What the office corrects afterwards is still the header — dates, PO, the
   note, and what has been received.                                        */

const INV_PREFIX = 'VSA/INV/26-27'

/** A built document as a tax invoice: the tax split by place of supply. */
const FIELDS: Field[] = [
  { key: 'no',         label: 'Invoice no', required: true },
  { key: 'date',       label: 'Invoice date', type: 'date', required: true },
  { key: 'dueDate',    label: 'Due date', type: 'date' },
  { key: 'clientName', label: 'Customer', required: true },
  { key: 'gstin',      label: 'GSTIN' },
  { key: 'poNo',       label: 'PO number' },
  { key: 'shipTo',     label: 'Delivery address', half: false },
  { key: 'vehicle',    label: 'Vehicle' },
  { key: 'ewayBill',   label: 'E-way bill' },
  { key: 'received',   label: 'Amount received', type: 'number' },
  { key: 'status',     label: 'Status', type: 'select', options: ['Paid', 'Partial', 'Unpaid', 'Overdue'] },
  { key: 'remarks',    label: 'Remarks', type: 'textarea', hint: 'Salesman name, site, anything to search on later' },
]

const idOf = (i: Invoice) => i.no

const MONTH_OPTS = ['All Months', ...MONTHS.map(m => m.label)]
/* Whatever the counter has actually written, offered as a filter. */
const REMARK_OPTS = ['All Remarks', ...[...new Set(INVOICES.map(i => i.remarks))].filter(r => r !== '—').sort(), 'No remark']
const SHIP_OPTS   = ['All Addresses', ...[...new Set(INVOICES.map(i => i.shipTo))].sort()]
/* HSN is on the lines, not the header — a bill can carry several. */
const HSN_OPTS    = ['All HSN', ...[...new Set(INVOICES.flatMap(i => i.lines.map(l => l.hsn)))].sort()]
const monthOf = (d: string) => MONTHS.find(m => d.startsWith(m.key))?.label ?? ''

export default function Billing() {
  const [q, setQ]         = useState('')
  const [status, setStatus] = useState('All Status')
  const [month, setMonth]   = useState('All Months')
  const [remark, setRemark] = useState('All Remarks')
  const [ship, setShip]     = useState('All Addresses')
  const [hsn, setHsn]       = useState('All HSN')
  const [doc, setDoc]       = useState<Invoice | null>(null)
  const [edit, setEdit]     = useState<Invoice | null>(null)
  const [raising, setRaising] = useState<string | null>(null)
  const crud = useCrud<Invoice>('invoices', INVOICES, idOf)
  const list = crud.rows

  const billed = useMemo(() => list.reduce((s, i) => s + i.total, 0), [list])
  const collected = useMemo(() => list.reduce((s, i) => s + i.received, 0), [list])

  const rows = useMemo(() => list.filter(i =>
    (status === 'All Status' || i.status === status) &&
    (month === 'All Months' || monthOf(i.date) === month) &&
    (remark === 'All Remarks' || (remark === 'No remark' ? i.remarks === '—' : i.remarks === remark)) &&
    (ship === 'All Addresses' || i.shipTo === ship) &&
    (hsn === 'All HSN' || i.lines.some(l => l.hsn === hsn)) &&
    (q === '' || `${i.no} ${i.clientName} ${i.poNo} ${i.remarks} ${i.shipTo}`.toLowerCase().includes(q.toLowerCase())),
  ).sort((a, b) => b.date.localeCompare(a.date)), [list, q, status, month, remark, ship, hsn])

  const paged = usePaged(rows, 12)
  const filteredTotal = rows.reduce((s, i) => s + i.total, 0)
  const overdue = list.filter(i => i.status === 'Overdue')

  const exportCsv = () => csvDownload('vsa-invoice-register.csv', [
    ['Invoice No', 'Date', 'Due Date', 'Customer', 'GSTIN', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Received', 'Balance', 'Delivery Address', 'Remarks', 'Status'],
    ...rows.map(i => [i.no, i.date, i.dueDate, i.clientName, i.gstin, i.taxable, i.cgst, i.sgst, i.igst, i.total, i.received, i.total - i.received, i.shipTo, i.remarks, i.status]),
  ])

  return (
    <div>
      <PageHead title="Billing / Invoice" sub={`GST tax invoice register · ${FY}`}>
        <ExportBtn onClick={exportCsv} />
        {crud.changes > 0 && (
          <button className="btn-ghost !text-xs" onClick={crud.restore}>
            {crud.changes} {crud.changes === 1 ? 'change' : 'changes'} — undo all
          </button>
        )}
        <Link to="/quick-bill" className="btn-outline"><Mic size={14} /> Counter bill</Link>
        <button className="btn" onClick={() => setRaising(nextDocNo(INV_PREFIX, list.map(i => i.no)))}>
          <Plus size={14} /> New invoice
        </button>
      </PageHead>

      <DocBuilder open={!!raising} onClose={() => setRaising(null)} kind="Tax Invoice"
        docNo={raising ?? ''} owner="D. Nageswara Rao"
        onSave={d => crud.add(asInvoice(d))} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Invoices Raised"  value={String(list.length)}  icon={Receipt}     tone="brand"  sub={FY} />
        {/* Added up off the bills on the screen rather than off a figure
            computed when the page was built — a bill raised today was being
            counted in "invoices raised" and left out of "total billed". */}
        <Stat label="Total Billed"     value={inr(billed)}    icon={IndianRupee} tone="violet" sub="Inclusive of GST" />
        <Stat label="Collected"        value={inr(collected)} icon={Wallet}      tone="green"
          sub={`${Math.round(pctOf(collected, billed))}% realised`} />
        <Stat label="Overdue Bills"    value={String(overdue.length)}   icon={AlertTriangle} tone="red"  sub={inr(overdue.reduce((s, i) => s + (i.total - i.received), 0)) + ' pending'} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search invoice, customer, PO, remark, address…" />
        <Select value={status} onChange={setStatus} options={['All Status', 'Paid', 'Partial', 'Unpaid', 'Overdue']} />
        <Select value={month} onChange={setMonth} options={MONTH_OPTS} />
        <Select value={remark} onChange={setRemark} options={REMARK_OPTS} className="min-w-[14rem]" />
        <Select value={ship} onChange={setShip} options={SHIP_OPTS} className="min-w-[13rem]" />
        <Select value={hsn} onChange={setHsn} options={HSN_OPTS} />
        <span className="ml-auto self-center text-xs" style={{ color: 'var(--text-4)' }}>
          Filtered value: <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{inr(filteredTotal)}</span>
        </span>
      </div>

      <TableCard>
        <thead>
          <tr>
            <th>Invoice</th><th>Date</th><th>Customer</th><th className="num">Taxable</th>
            <th className="num">GST</th><th className="num">Total</th><th className="num">Balance</th><th>Remarks</th><th>Status</th><th />
          </tr>
        </thead>
        <tbody>
          {paged.slice.map(i => (
            <tr key={i.id}>
              <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>
                <EditedDot isNew={crud.isNew(i.no)} isEdited={crud.isEdited(i.no)} />{i.no}
              </td>
              <td className="whitespace-nowrap text-xs">{fmtDate(i.date)}</td>
              <td className="max-w-[15rem] truncate">{i.clientName}</td>
              <td className="num tabular-nums">{inr(i.taxable)}</td>
              <td className="num tabular-nums text-xs">{inr(i.cgst + i.sgst + i.igst)}</td>
              <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(i.total)}</td>
              <td className={`num tabular-nums ${i.total - i.received > 0 ? 'text-red-500 font-medium' : ''}`}>
                {i.total - i.received > 0 ? inr(i.total - i.received) : '—'}
              </td>
              <td className="text-xs max-w-[13rem] truncate" title={i.remarks}
                style={{ color: i.remarks === '—' ? 'var(--text-4)' : 'var(--text-3)' }}>{i.remarks}</td>
              <td><Pill s={i.status} /></td>
              <td>
                <span className="flex items-center gap-1 justify-end">
                  <button onClick={() => setDoc(i)} className="btn-ghost !px-1.5 !py-1" title="View and print">
                    <Eye size={13} /> <Printer size={13} />
                  </button>
                  <RowActions label={i.no} onEdit={() => setEdit(i)} onDelete={() => crud.remove(i.no)} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      {rows.length === 0 && <Empty msg="No invoices match these filters" />}
      <Pager {...paged} />

      <RecordModal open={!!edit} title={`Edit ${edit?.no ?? ''}`} fields={FIELDS}
        initial={edit as Rec | null}
        onSave={rec => { if (edit) crud.update(edit.no, { ...rec, received: Number(rec.received) || 0 } as Partial<Invoice>); setEdit(null) }}
        onClose={() => setEdit(null)}
        onDelete={() => { if (edit) crud.remove(edit.no); setEdit(null) }} />

      {doc && <InvoiceDoc inv={doc} onClose={() => setDoc(null)} />}
    </div>
  )
}
