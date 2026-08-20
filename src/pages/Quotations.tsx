import { useState, useMemo } from 'react'
import { FileText, Trophy, Percent, IndianRupee } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Pager, usePaged, Empty, Pill, Modal } from '@/components/ui'
import { QUOTATIONS, type Quotation } from '@/data/txns'
import { inr, inr2, fmtDate, csvDownload } from '@/lib/utils'
import { COMPANY, FY } from '@/data/company'

export default function Quotations() {
  const [q, setQ]         = useState('')
  const [status, setStatus] = useState('All Status')
  const [sel, setSel]     = useState<Quotation | null>(null)

  const rows = useMemo(() => QUOTATIONS.filter(x =>
    (status === 'All Status' || x.status === status) &&
    (q === '' || `${x.no} ${x.clientName} ${x.subject} ${x.owner}`.toLowerCase().includes(q.toLowerCase())),
  ), [q, status])

  const paged = usePaged(rows, 10)
  const won   = QUOTATIONS.filter(x => x.status === 'Won')
  const open  = QUOTATIONS.filter(x => x.status === 'Sent' || x.status === 'Under Negotiation')
  const winRate = Math.round((won.length / QUOTATIONS.length) * 100)

  const exportCsv = () => csvDownload('vsa-quotations.csv', [
    ['Quote No', 'Date', 'Valid Till', 'Customer', 'Subject', 'Taxable', 'GST', 'Total', 'Status', 'Owner'],
    ...rows.map(x => [x.no, x.date, x.validTill, x.clientName, x.subject, x.taxable, x.tax, x.total, x.status, x.owner]),
  ])

  return (
    <div>
      <PageHead title="Quotations" sub={`Estimates issued to fabricators, builders and dealers · ${FY}`}>
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Quotations Issued" value={String(QUOTATIONS.length)} icon={FileText}    tone="brand" sub={FY} />
        <Stat label="Value Quoted"      value={inr(QUOTATIONS.reduce((s, x) => s + x.total, 0))} icon={IndianRupee} tone="violet" sub="Inclusive of GST" />
        <Stat label="Converted"         value={`${won.length}`}           icon={Trophy}      tone="green" sub={inr(won.reduce((s, x) => s + x.total, 0)) + ' won'} />
        <Stat label="Win Rate"          value={`${winRate}%`}             icon={Percent}     tone="sky"   sub={`${open.length} still open`} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search quote no, customer, subject…" />
        <Select value={status} onChange={setStatus} options={['All Status', 'Sent', 'Under Negotiation', 'Won', 'Lost', 'Expired']} />
      </div>

      <TableCard>
        <thead>
          <tr><th>Quote No</th><th>Date</th><th>Customer</th><th>Subject</th><th className="num">Total</th><th>Owner</th><th>Status</th></tr>
        </thead>
        <tbody>
          {paged.slice.map(x => (
            <tr key={x.id} className="cursor-pointer" onClick={() => setSel(x)}>
              <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{x.no}</td>
              <td className="whitespace-nowrap text-xs">{fmtDate(x.date)}</td>
              <td className="max-w-[13rem] truncate">{x.clientName}</td>
              <td className="max-w-[15rem] truncate text-xs">{x.subject}</td>
              <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(x.total)}</td>
              <td className="text-xs whitespace-nowrap">{x.owner}</td>
              <td><Pill s={x.status} /></td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      {rows.length === 0 && <Empty msg="No quotations match these filters" />}
      <Pager {...paged} />

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.no} — ${sel.clientName}` : ''} wide>
        {sel && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Pill s={sel.status} />
              <span className="badge-gray">Owner: {sel.owner}</span>
              <span className="badge-gray">Issued {fmtDate(sel.date)}</span>
              <span className="badge-gray">Valid till {fmtDate(sel.validTill)}</span>
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{sel.subject}</p>

            <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-2)' }}>
              <table className="tbl">
                <thead><tr><th>Item</th><th>HSN</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {sel.lines.map(l => (
                    <tr key={l.code}>
                      <td>{l.name} <span className="text-xs font-mono" style={{ color: 'var(--text-4)' }}>({l.code})</span></td>
                      <td className="text-xs">{l.hsn}</td>
                      <td className="num tabular-nums">{l.qty.toLocaleString('en-IN')} {l.unit}</td>
                      <td className="num tabular-nums">{inr2(l.rate)}</td>
                      <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{inr2(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <table className="text-sm">
                <tbody>
                  <tr><td className="pr-8 py-1" style={{ color: 'var(--text-3)' }}>Taxable</td><td className="text-right tabular-nums">{inr2(sel.taxable)}</td></tr>
                  <tr><td className="pr-8 py-1" style={{ color: 'var(--text-3)' }}>GST @ 18%</td><td className="text-right tabular-nums">{inr2(sel.tax)}</td></tr>
                  <tr className="font-bold" style={{ color: 'var(--text-1)' }}>
                    <td className="pr-8 py-1 border-t" style={{ borderColor: 'var(--border-2)' }}>Grand Total</td>
                    <td className="text-right tabular-nums border-t" style={{ borderColor: 'var(--border-2)' }}>{inr(sel.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-[11px] pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
              Rates quoted ex-godown, {COMPANY.address.line3}. Validity 15 days from date of issue. Aluminium rates are
              linked to LME and may be revised without notice after validity.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
