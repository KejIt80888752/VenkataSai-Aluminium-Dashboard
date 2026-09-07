import { useState, useMemo } from 'react'
import {
  BookOpen, ArrowRightLeft, CircleAlert, ShieldCheck, FileText, Lock, Eye,
} from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Empty, Modal } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import {
  ESTIMATES, ESTIMATE_SUMMARY, BOOKS, invoicedValue, openValue,
  type Estimate, type Book, type EstStatus,
} from '@/data/ledgers'
import { INVOICES } from '@/data/txns'
import { inr, inr2, fmtDate, csvDownload, cn } from '@/lib/utils'
import { COMPANY, FY } from '@/data/company'

/* Who may look at which book. Nothing is hidden — a role that cannot open a
   book is told so, rather than the book being made to disappear. */
const BOOK_ACCESS: Record<Book, string[]> = {
  Estimate: ['Admin', 'Manager', 'Accountant', 'Sales Executive'],
  GST:      ['Admin', 'Manager', 'Accountant'],
  Audit:    ['Admin', 'Accountant'],
}

const badgeFor = (s: EstStatus) =>
  s === 'Fully Invoiced' ? 'badge-green'
  : s === 'Part Invoiced' ? 'badge-yellow'
  : s === 'Cancelled' ? 'badge-gray' : 'badge-red'

export default function Ledgers() {
  const { user } = useAuth()
  const role = user?.role ?? ''
  const [book, setBook] = useState<Book>('Estimate')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All Status')
  const [open, setOpen] = useState<Estimate | null>(null)
  const [converting, setConverting] = useState<Estimate | null>(null)
  const [converted, setConverted] = useState<Record<string, { invoiceNo: string; value: number }[]>>({})

  const mayOpen = BOOK_ACCESS[book].includes(role)

  const rows = useMemo(() => ESTIMATES.filter(e =>
    (status === 'All Status' || e.status === status) &&
    (q === '' || `${e.no} ${e.client} ${e.raisedBy}`.toLowerCase().includes(q.toLowerCase())),
  ), [q, status])

  const extraFor = (e: Estimate) => (converted[e.no] ?? []).reduce((s, x) => s + x.value, 0)
  const stillOpen = (e: Estimate) => +(openValue(e) - extraFor(e)).toFixed(2)

  const exportCsv = () => csvDownload('vsa-estimate-book.csv', [
    [`Estimate book · ${COMPANY.name}`, FY],
    [], ['Estimate No', 'Date', 'Customer', 'Raised By', 'Value', 'Invoiced', 'Not Yet Invoiced',
         'Status', 'Tax Invoices'],
    ...rows.map(e => [e.no, e.date, e.client, e.raisedBy, e.value,
                      invoicedValue(e) + extraFor(e), stillOpen(e), e.status,
                      [...e.links.map(l => l.invoiceNo), ...(converted[e.no] ?? []).map(x => x.invoiceNo)].join(' ')]),
  ])

  return (
    <div>
      <PageHead title="Books" sub="An estimate becomes a tax invoice without being retyped — and the link between them is kept">
        <Select value={book} onChange={v => setBook(v as Book)} options={BOOKS} />
        {book === 'Estimate' && mayOpen && <>
          <SearchBox value={q} onChange={setQ} placeholder="Search estimate, customer, staff…" />
          <Select value={status} onChange={setStatus}
            options={['All Status', 'Open', 'Part Invoiced', 'Fully Invoiced', 'Cancelled']} className="min-w-[12rem]" />
          <ExportBtn onClick={exportCsv} />
        </>}
      </PageHead>

      {/* ── Access, stated rather than hidden ─────────────────────────── */}
      {!mayOpen ? (
        <div className="card">
          <p className="section-title text-base mb-1 flex items-center gap-2">
            <Lock size={15} style={{ color: 'var(--text-4)' }} /> The {book} book is not open to your role
          </p>
          <p className="section-sub max-w-3xl">
            You are signed in as <strong style={{ color: 'var(--text-1)' }}>{role}</strong>. The {book} book is
            open to {BOOK_ACCESS[book].join(', ')}. The book exists and is not hidden from anyone — it simply
            is not yours to open. Ask the owner if you need it.
          </p>
        </div>
      ) : book === 'GST' ? (
        <GstBook />
      ) : book === 'Audit' ? (
        <AuditBook />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
            <Stat label="Estimates Written" value={String(ESTIMATE_SUMMARY.total)} icon={FileText} tone="brand"
              sub={inr(ESTIMATE_SUMMARY.value) + ' quoted'} />
            <Stat label="Turned Into Bills" value={String(ESTIMATE_SUMMARY.done)} icon={ArrowRightLeft} tone="green"
              sub="Nothing retyped" />
            <Stat label="Part Invoiced" value={String(ESTIMATE_SUMMARY.part)} icon={CircleAlert} tone="amber"
              sub="Balance still to bill" />
            <Stat label="Not Yet Invoiced" value={inr(ESTIMATE_SUMMARY.notInvoiced)} icon={BookOpen} tone="violet"
              sub={`${ESTIMATE_SUMMARY.open} open · ${ESTIMATE_SUMMARY.cancelled} cancelled`} />
          </div>

          <div className="card mb-5">
            <p className="section-title text-base mb-1">How the Two Books Work Together</p>
            <p className="section-sub max-w-4xl mb-3">
              The estimate is what the counter writes before anything is agreed. When the customer confirms,
              press convert — the same lines become a tax invoice in the GST book, at the same rates, with
              the estimate number kept against it. Part loads convert in parts.
            </p>
            <div className="rounded-lg p-3 flex items-start gap-2.5"
              style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
              <ShieldCheck size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--green)' }} />
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
                An estimate that is only part invoiced keeps its balance open and on this list. It cannot be
                quietly closed — it is either invoiced in full, or cancelled with a reason that stays against
                it. Every book here is open to the owner and to an auditor at all times.
              </p>
            </div>
          </div>

          <TableCard maxH="30rem">
            <thead>
              <tr><th>Estimate</th><th>Date</th><th>Customer</th><th>Written By</th>
                <th className="num">Value</th><th className="num">Invoiced</th><th className="num">Still Open</th>
                <th>Tax Invoice</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {rows.map(e => {
                const inv = invoicedValue(e) + extraFor(e)
                const bal = stillOpen(e)
                const all = [...e.links, ...(converted[e.no] ?? []).map(x => ({ invoiceNo: x.invoiceNo }))]
                return (
                  <tr key={e.no} className="cursor-pointer" onClick={() => setOpen(e)}>
                    <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{e.no}</td>
                    <td className="text-xs whitespace-nowrap">{fmtDate(e.date)}</td>
                    <td className="text-xs max-w-[14rem] truncate" title={e.client}>{e.client}</td>
                    <td className="text-xs whitespace-nowrap">{e.raisedBy}</td>
                    <td className="num tabular-nums">{inr(e.value)}</td>
                    <td className="num tabular-nums text-xs">{inv ? inr(inv) : '—'}</td>
                    <td className="num tabular-nums font-medium"
                      style={{ color: bal > 0 ? 'var(--red)' : 'var(--text-4)' }}>{bal > 0 ? inr(bal) : '—'}</td>
                    <td className="text-xs whitespace-nowrap" style={{ color: 'var(--text-3)' }}>
                      {all.length ? all.map(l => l.invoiceNo).join(', ') : '—'}
                    </td>
                    <td><span className={badgeFor(e.status)}>{e.status}</span></td>
                    <td onClick={ev => ev.stopPropagation()}>
                      {bal > 0 && e.status !== 'Cancelled' && (
                        <button className="btn-outline !py-1 !text-[11px]" onClick={() => setConverting(e)}>
                          <ArrowRightLeft size={12} /> Convert
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && <tr><td colSpan={10}><Empty msg="No estimates match" /></td></tr>}
            </tbody>
          </TableCard>

          <ConvertModal est={converting} balance={converting ? stillOpen(converting) : 0}
            onClose={() => setConverting(null)}
            onConvert={(no, invoiceNo, value) =>
              setConverted(c => ({ ...c, [no]: [...(c[no] ?? []), { invoiceNo, value }] }))} />

          <Modal open={!!open} onClose={() => setOpen(null)} title={open?.no ?? ''} wide>
            {open && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span className={badgeFor(open.status)}>{open.status}</span>
                  <span className="badge-gray">{open.client}</span>
                  <span className="badge-blue">Written by {open.raisedBy}</span>
                </div>
                <div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--border-2)', maxHeight: '18rem' }}>
                  <table className="tbl">
                    <thead><tr><th>Code</th><th>Item</th><th className="num">Quoted</th>
                      <th className="num">Invoiced</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
                    <tbody>
                      {open.lines.map(l => (
                        <tr key={l.code}>
                          <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{l.code}</td>
                          <td className="text-xs max-w-[15rem] truncate">{l.name}</td>
                          <td className="num tabular-nums text-xs">{l.qty} {l.unit}</td>
                          <td className="num tabular-nums text-xs"
                            style={{ color: l.invoicedQty < l.qty ? 'var(--red)' : 'var(--green)' }}>
                            {l.invoicedQty || '—'}
                          </td>
                          <td className="num tabular-nums text-xs">{inr2(l.rate)}</td>
                          <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{inr2(l.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {open.cancelReason && (
                  <p className="text-[12px] rounded-lg p-3" style={{ background: 'var(--bg-card2)', color: 'var(--text-3)' }}>
                    Cancelled — {open.cancelReason}
                  </p>
                )}
              </div>
            )}
          </Modal>
        </>
      )}
    </div>
  )
}

/* ── Convert an estimate, in full or in part ───────────────────────────── */
function ConvertModal({ est, balance, onClose, onConvert }: {
  est: Estimate | null; balance: number; onClose: () => void
  onConvert: (no: string, invoiceNo: string, value: number) => void
}) {
  const [part, setPart] = useState('')
  const value = Math.min(Number(part) || balance, balance)

  return (
    <Modal open={!!est} onClose={onClose} title={est ? `Convert ${est.no} into a tax invoice` : ''}>
      {est && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            The lines and rates carry across as they are. Nothing is typed again, and the estimate number stays
            on the invoice so the two can always be put side by side.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Fig k="Estimate" v={inr(est.value)} />
            <Fig k="Already invoiced" v={inr(invoicedValue(est))} />
            <Fig k="Still to invoice" v={inr(balance)} tone="red" />
          </div>
          <div>
            <label className="label">How much to invoice now</label>
            <input className="input tabular-nums text-right" value={part} placeholder={String(balance)}
              onChange={e => setPart(e.target.value)} />
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-4)' }}>
              Leave it as it is for the whole {inr(balance)}. A part load can be invoiced now — the balance
              stays open on the estimate until it is billed or cancelled with a reason.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--border-2)' }}>
            <button className="btn-outline" onClick={onClose}>Cancel</button>
            <button className="btn" disabled={value <= 0} onClick={() => {
              const n = `VSA/26-27/${String(160 + Math.floor(Math.random() * 800)).padStart(4, '0')}`
              onConvert(est.no, n, value); setPart(''); onClose()
            }}>
              <ArrowRightLeft size={14} /> Raise tax invoice for {inr(value)}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ── The GST book is the invoice register, seen from here ──────────────── */
function GstBook() {
  const recent = INVOICES.slice(0, 25)
  return (
    <>
      <div className="card mb-5">
        <p className="section-title text-base mb-1">GST Book</p>
        <p className="section-sub max-w-4xl">
          Every tax invoice, in one place, exactly as it goes into the GST return. This is the register the
          returns are filed from — the estimate book feeds it, and nothing is entered here twice.
        </p>
      </div>
      <TableCard maxH="30rem">
        <thead>
          <tr><th>Invoice</th><th>Date</th><th>Customer</th><th>GSTIN</th>
            <th className="num">Taxable</th><th className="num">GST</th><th className="num">Total</th></tr>
        </thead>
        <tbody>
          {recent.map(i => (
            <tr key={i.no}>
              <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{i.no}</td>
              <td className="text-xs whitespace-nowrap">{fmtDate(i.date)}</td>
              <td className="text-xs max-w-[15rem] truncate">{i.clientName}</td>
              <td className="text-xs font-mono whitespace-nowrap">{i.gstin || '—'}</td>
              <td className="num tabular-nums">{inr(i.taxable)}</td>
              <td className="num tabular-nums text-xs">{inr(i.cgst + i.sgst + i.igst)}</td>
              <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(i.total)}</td>
            </tr>
          ))}
        </tbody>
      </TableCard>
    </>
  )
}

/* ── The audit book is the two above, read only ────────────────────────── */
function AuditBook() {
  const withGap = ESTIMATES.filter(e => openValue(e) > 0 && e.status !== 'Cancelled')
  const cancelled = ESTIMATES.filter(e => e.status === 'Cancelled')
  return (
    <>
      <div className="card mb-5">
        <p className="section-title text-base mb-1 flex items-center gap-2">
          <Eye size={15} className="text-brand" /> Audit Book
        </p>
        <p className="section-sub max-w-4xl">
          The estimate book and the GST book placed against each other, read only. It answers the one
          question an auditor asks: was anything quoted and delivered that never reached a tax invoice.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <Stat label="Estimates Not Fully Invoiced" value={String(withGap.length)} icon={CircleAlert}
          tone={withGap.length ? 'amber' : 'green'}
          sub={inr(withGap.reduce((s, e) => s + openValue(e), 0)) + ' still open'} />
        <Stat label="Cancelled With a Reason" value={String(cancelled.length)} icon={FileText} tone="violet"
          sub="Reason kept against each" />
        <Stat label="Fully Invoiced" value={String(ESTIMATE_SUMMARY.done)} icon={ShieldCheck} tone="green"
          sub="Estimate and tax invoice agree" />
      </div>

      <p className="section-title text-base mb-1">Estimates With a Balance Not Invoiced</p>
      <p className="section-sub mb-3">Either the load has not gone yet, or a bill was missed</p>
      <TableCard maxH="26rem">
        <thead>
          <tr><th>Estimate</th><th>Date</th><th>Customer</th><th>Written By</th>
            <th className="num">Estimate</th><th className="num">Invoiced</th><th className="num">Gap</th><th>Status</th></tr>
        </thead>
        <tbody>
          {withGap.map(e => (
            <tr key={e.no}>
              <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{e.no}</td>
              <td className="text-xs whitespace-nowrap">{fmtDate(e.date)}</td>
              <td className="text-xs max-w-[14rem] truncate">{e.client}</td>
              <td className="text-xs">{e.raisedBy}</td>
              <td className="num tabular-nums">{inr(e.value)}</td>
              <td className="num tabular-nums text-xs">{invoicedValue(e) ? inr(invoicedValue(e)) : '—'}</td>
              <td className="num tabular-nums font-semibold" style={{ color: 'var(--red)' }}>{inr(openValue(e))}</td>
              <td><span className={badgeFor(e.status)}>{e.status}</span></td>
            </tr>
          ))}
          {withGap.length === 0 && <tr><td colSpan={8}><Empty msg="Every estimate has reached a tax invoice" /></td></tr>}
        </tbody>
      </TableCard>
    </>
  )
}

const Fig = ({ k, v, tone }: { k: string; v: string; tone?: string }) => (
  <div className="rounded-lg p-2.5" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{k}</p>
    <p className={cn('text-sm font-bold tabular-nums mt-0.5')}
      style={{ color: tone === 'red' ? 'var(--red)' : 'var(--text-1)' }}>{v}</p>
  </div>
)
