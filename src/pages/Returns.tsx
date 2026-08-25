import { useState } from 'react'
import { Undo2, IndianRupee, Clock, AlertTriangle } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Empty, Modal } from '@/components/ui'
import { RETURNS, DEFECTS, type MaterialReturn, type ReturnStatus } from '@/data/operations'
import { locName } from '@/data/locations'
import { inr, kg, fmtDate, csvDownload } from '@/lib/utils'
import { COMPANY, FY } from '@/data/company'

const STATUSES: ReturnStatus[] = ['Raised', 'Picked Up', 'Credit Note Received', 'Replacement Received', 'Disputed']

const badgeFor = (s: ReturnStatus) =>
  s === 'Credit Note Received' || s === 'Replacement Received' ? 'badge-green'
  : s === 'Picked Up' ? 'badge-blue'
  : s === 'Disputed' ? 'badge-red' : 'badge-yellow'

/** Anything raised but not yet settled is money sitting with the mill. */
const isOpen = (r: MaterialReturn) => r.status === 'Raised' || r.status === 'Picked Up' || r.status === 'Disputed'

export default function Returns() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All Status')
  const [defect, setDefect] = useState('All Defects')
  const [open, setOpen] = useState<MaterialReturn | null>(null)

  const rows = RETURNS.filter(r =>
    (status === 'All Status' || r.status === status) &&
    (defect === 'All Defects' || r.defect === defect) &&
    (q === '' || `${r.no} ${r.againstBill} ${r.supplier} ${r.section} ${r.debitNote}`.toLowerCase().includes(q.toLowerCase())),
  )

  const openRows = RETURNS.filter(isOpen)
  const recovered = RETURNS.filter(r => !isOpen(r)).reduce((s, r) => s + r.value, 0)
  const disputed = RETURNS.filter(r => r.status === 'Disputed')

  const exportCsv = () => csvDownload('vsa-material-returns.csv', [
    [`Returns to mill on manufacturing defect — ${COMPANY.name}`, FY],
    [], ['Return No', 'Date', 'Against Bill', 'To Unit', 'Supplier', 'Section', 'Nos', 'Weight Kg',
         'Defect', 'Value', 'Debit Note', 'Status', 'Days Open', 'Raised By'],
    ...rows.map(r => [r.no, r.date, r.againstBill, r.toUnit, r.supplier, r.section, r.nos, r.weightKg,
                      r.defect, r.value, r.debitNote, r.status, r.ageDays, r.raisedBy]),
  ])

  return (
    <div>
      <PageHead title="Returns to Mill"
        sub="Material sent back on a manufacturing defect, with the debit note raised against it">
        <SearchBox value={q} onChange={setQ} placeholder="Search return, bill, supplier…" />
        <Select value={status} onChange={setStatus} options={['All Status', ...STATUSES]} />
        <Select value={defect} onChange={setDefect} options={['All Defects', ...DEFECTS]} className="min-w-[13rem]" />
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Returns Raised" value={String(RETURNS.length)} icon={Undo2} tone="brand"
          sub={`${kg(RETURNS.reduce((s, r) => s + r.weightKg, 0))} sent back`} />
        <Stat label="Pending With Mill" value={inr(openRows.reduce((s, r) => s + r.value, 0))} icon={Clock}
          tone={openRows.length ? 'red' : 'green'} sub={`${openRows.length} returns not yet settled`} />
        <Stat label="Recovered" value={inr(recovered)} icon={IndianRupee} tone="green"
          sub="Credit notes and replacements received" />
        <Stat label="Disputed" value={String(disputed.length)} icon={AlertTriangle}
          tone={disputed.length ? 'red' : 'green'} sub={disputed.length ? 'Mill has not accepted the defect' : 'Nothing disputed'} />
      </div>

      <TableCard maxH="32rem">
        <thead>
          <tr><th>Return No</th><th>Date</th><th>Against Bill</th><th>Supplier</th><th>Defect</th>
            <th className="num">Nos</th><th className="num">Weight</th><th className="num">Value</th>
            <th>Debit Note</th><th>Status</th><th className="num">Days</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.no} className="cursor-pointer" onClick={() => setOpen(r)}>
              <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{r.no}</td>
              <td className="text-xs whitespace-nowrap">{fmtDate(r.date)}</td>
              <td className="text-xs whitespace-nowrap">{r.againstBill}</td>
              <td className="text-xs max-w-[13rem] truncate" title={r.supplier}>{r.supplier}</td>
              <td className="text-xs max-w-[14rem] truncate" title={r.defect}>{r.defect}</td>
              <td className="num tabular-nums">{r.nos}</td>
              <td className="num tabular-nums text-xs">{kg(r.weightKg)}</td>
              <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{inr(r.value)}</td>
              <td className="text-xs whitespace-nowrap">{r.debitNote}</td>
              <td><span className={badgeFor(r.status)}>{r.status}</span></td>
              <td className="num tabular-nums text-xs"
                style={{ color: isOpen(r) && r.ageDays > 21 ? 'var(--red)' : undefined }}>{r.ageDays}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={11}><Empty msg="No returns match" /></td></tr>}
        </tbody>
      </TableCard>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.no} — return on manufacturing defect` : ''}>
        {open && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className={badgeFor(open.status)}>{open.status}</span>
              <span className="badge-gray">{open.debitNote}</span>
              <span className="badge-blue">{open.ageDays} days open</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <F k="Returned to" v={locName(open.toUnit)} />
              <F k="Supplier" v={open.supplier} />
              <F k="Against purchase bill" v={open.againstBill} />
              <F k="Raised on" v={fmtDate(open.date)} />
              <F k="Section" v={open.section} />
              <F k="Inspected by" v={open.raisedBy} />
              <F k="Quantity" v={`${open.nos} nos · ${kg(open.weightKg)}`} />
              <F k="Value debited" v={inr(open.value)} />
            </dl>
            <div className="rounded-lg p-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
              <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-4)' }}>Defect recorded</p>
              <p className="text-sm" style={{ color: 'var(--text-1)' }}>{open.defect}</p>
            </div>
            <p className="text-[11px] pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
              A debit note reduces what we owe the supplier by {inr(open.value)}. It stays on the supplier statement
              reconciliation until their credit note comes back against it.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}

const F = ({ k, v }: { k: string; v: string }) => (
  <div><dt className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{k}</dt>
    <dd className="mt-0.5" style={{ color: 'var(--text-1)' }}>{v}</dd></div>
)
