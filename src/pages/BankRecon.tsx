import { useState, useMemo } from 'react'
import { Landmark, CircleAlert, CheckCircle2, IndianRupee, Plus, Upload, X, FileSpreadsheet } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Empty, Modal } from '@/components/ui'
import { BANK_LINES, type BankLine, type BankStatus } from '@/data/operations'
import { MONTHS } from '@/data/txns'
import { parseCsv, findHeader } from '@/lib/csv'
import { inr, fmtDate, csvDownload, cn } from '@/lib/utils'
import { COMPANY, FY } from '@/data/company'

const STATUSES: BankStatus[] = ['Matched to Receipt', 'Credit Not Entered', 'Receipt Not in Bank', 'Part Settled']

const badgeFor = (s: BankStatus) =>
  s === 'Matched to Receipt' ? 'badge-green'
  : s === 'Credit Not Entered' ? 'badge-red'
  : s === 'Receipt Not in Bank' ? 'badge-purple' : 'badge-yellow'

export default function BankRecon() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All Status')
  const [month, setMonth] = useState('All Months')
  const [entered, setEntered] = useState<Record<string, number>>({})
  const [receipt, setReceipt] = useState<BankLine | null>(null)
  const [stmt, setStmt] = useState<{ name: string; rows: number } | null>(null)

  /* A receipt entered here overrides what the register carried. */
  const lines = useMemo(() => BANK_LINES.map(b => {
    const override = entered[b.ref]
    if (override === undefined) return b
    const now = b.entered + override
    return { ...b, entered: now, status: (now >= b.credit ? 'Matched to Receipt' : 'Part Settled') as BankStatus }
  }), [entered])

  const rows = lines.filter(b =>
    (status === 'All Status' || b.status === status) &&
    (month === 'All Months' || b.month === month) &&
    (q === '' || `${b.ref} ${b.party} ${b.narration} ${b.matchedTo}`.toLowerCase().includes(q.toLowerCase())),
  )

  const unentered = lines.filter(b => b.status === 'Credit Not Entered')
  const part      = lines.filter(b => b.status === 'Part Settled')
  const notInBank = lines.filter(b => b.status === 'Receipt Not in Bank')
  const credited  = lines.reduce((s, b) => s + b.credit, 0)
  const booked    = lines.reduce((s, b) => s + b.entered, 0)

  const exportCsv = () => csvDownload('vsa-bank-vs-receipts.csv', [
    [`Bank credits against receipts entered · ${COMPANY.name}`, FY],
    [], ['Total credited by bank', credited], ['Total entered as receipts', booked], ['Gap', credited - booked],
    [], ['Date', 'Reference', 'Narration', 'Party', 'Bank Credit', 'Receipt Entered', 'Against Invoice', 'Status'],
    ...rows.map(b => [b.date, b.ref, b.narration, b.party, b.credit, b.entered, b.matchedTo, b.status]),
  ])

  const loadStmt = (f: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ''))
      setStmt({ name: f.name, rows: Math.max(0, parsed.length - findHeader(parsed) - 1) })
    }
    reader.readAsText(f)
  }

  return (
    <div>
      <PageHead title="Bank & Receipts"
        sub={`Credits landing in ${COMPANY.bank.bank}, ${COMPANY.bank.branch} — against receipts entered in the ledger`}>
        <SearchBox value={q} onChange={setQ} placeholder="Search reference, party, invoice…" />
        <Select value={month} onChange={setMonth} options={['All Months', ...MONTHS.map(m => m.label)]} />
        <Select value={status} onChange={setStatus} options={['All Status', ...STATUSES]} className="min-w-[13rem]" />
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Credited by Bank" value={inr(credited)} icon={Landmark} tone="brand" sub={`${lines.length} credit entries`} />
        <Stat label="Entered as Receipts" value={inr(booked)} icon={CheckCircle2} tone="green" sub="Posted against invoices" />
        <Stat label="Not Entered Yet" value={inr(credited - booked)} icon={CircleAlert}
          tone={credited - booked > 0 ? 'red' : 'green'}
          sub={`${unentered.length} untouched · ${part.length} part entered`} />
        <Stat label="Receipt Without Credit" value={String(notInBank.length)} icon={IndianRupee} tone="violet"
          sub="Booked but the bank never showed it" />
      </div>

      {/* ── The action the client could not find, put in front ─────────── */}
      {(unentered.length > 0 || part.length > 0) && (
        <div className="card mb-5" style={{ borderColor: 'var(--brand)' }}>
          <p className="section-title text-base mb-1">Credits Waiting for a Receipt Entry</p>
          <p className="section-sub mb-3">
            Money is already in the account. Press Enter Receipt on a row to post it against the invoice — no need to
            go looking for the option anywhere else.
          </p>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {[...unentered, ...part].map(b => (
              <div key={b.ref} className="rounded-lg p-3 flex flex-wrap items-center justify-between gap-3"
                style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <span className="min-w-0">
                  <span className="text-sm font-medium block truncate" style={{ color: 'var(--text-1)' }}>{b.party}</span>
                  <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>
                    {fmtDate(b.date)} · {b.ref} · {b.matchedTo !== '—' ? `against ${b.matchedTo}` : 'invoice not identified'}
                  </span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-right">
                    <span className="tabular-nums font-semibold block" style={{ color: 'var(--text-1)' }}>{inr(b.credit)}</span>
                    {b.entered > 0 && <span className="text-[10px]" style={{ color: 'var(--text-4)' }}>{inr(b.entered)} already posted</span>}
                  </span>
                  <button className="btn !py-1.5 !text-xs" onClick={() => setReceipt(b)}>
                    <Plus size={13} /> Enter Receipt
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mb-5">
        <p className="section-title text-base mb-1">Load a Bank Statement</p>
        <p className="section-sub mb-3">
          Download the statement from net banking as CSV and drop it here to bring credits in. The file is read on this
          computer only.
        </p>
        {stmt ? (
          <div className="flex items-center justify-between gap-3 rounded-lg p-3"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
            <span className="flex items-center gap-2 text-sm min-w-0" style={{ color: 'var(--text-1)' }}>
              <FileSpreadsheet size={15} className="text-brand shrink-0" />
              <span className="truncate">{stmt.name}</span>
              <span className="text-xs shrink-0" style={{ color: 'var(--text-4)' }}>{stmt.rows} rows read</span>
            </span>
            <button className="btn-ghost !px-2 shrink-0" onClick={() => setStmt(null)}><X size={14} /></button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 rounded-lg py-8 cursor-pointer"
            style={{ border: '1.5px dashed var(--border-2)' }}>
            <Upload size={20} style={{ color: 'var(--text-4)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>Choose statement (.csv)</span>
            <input type="file" accept=".csv,text/csv" className="hidden"
              onChange={e => e.target.files?.[0] && loadStmt(e.target.files[0])} />
          </label>
        )}
      </div>

      <p className="section-title text-base mb-1">Bank Statement</p>
      <p className="section-sub mb-3">Every credit, and the receipt standing against it</p>
      <TableCard maxH="30rem">
        <thead>
          <tr><th>Date</th><th>Reference</th><th>Narration</th><th>Party</th>
            <th className="num">Bank Credit</th><th className="num">Receipt Entered</th><th>Against</th><th>Status</th></tr>
        </thead>
        <tbody>
          {rows.map(b => (
            <tr key={b.ref}>
              <td className="text-xs whitespace-nowrap">{fmtDate(b.date)}</td>
              <td className="text-xs whitespace-nowrap font-mono" style={{ color: 'var(--text-1)' }}>{b.ref}</td>
              <td className="text-xs max-w-[14rem] truncate" title={b.narration}>{b.narration}</td>
              <td className="text-xs max-w-[13rem] truncate" title={b.party}>{b.party}</td>
              <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{b.credit ? inr(b.credit) : '—'}</td>
              <td className={cn('num tabular-nums')}
                style={{ color: b.entered < b.credit ? 'var(--red)' : 'var(--text-2)' }}>{b.entered ? inr(b.entered) : '—'}</td>
              <td className="text-xs whitespace-nowrap">{b.matchedTo}</td>
              <td><span className={badgeFor(b.status)}>{b.status}</span></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={8}><Empty msg="No credits match" /></td></tr>}
        </tbody>
      </TableCard>

      <ReceiptModal line={receipt} onClose={() => setReceipt(null)}
        onSave={(ref, amt) => { setEntered(e => ({ ...e, [ref]: (e[ref] ?? 0) + amt })); setReceipt(null) }} />
    </div>
  )
}

function ReceiptModal({ line, onClose, onSave }: {
  line: BankLine | null; onClose: () => void; onSave: (ref: string, amount: number) => void
}) {
  const pending = line ? line.credit - line.entered : 0
  const [amt, setAmt] = useState('')
  const value = Number(amt || pending) || 0

  return (
    <Modal open={!!line} onClose={onClose} title={line ? `Enter receipt — ${line.party}` : ''}>
      {line && (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <F k="Bank reference" v={line.ref} />
            <F k="Credited on" v={fmtDate(line.date)} />
            <F k="Amount credited" v={inr(line.credit)} />
            <F k="Already posted" v={line.entered ? inr(line.entered) : '—'} />
            <F k="Against invoice" v={line.matchedTo} />
            <F k="Still to post" v={inr(pending)} />
          </dl>
          <div>
            <label className="label">Receipt amount (₹)</label>
            <input className="input tabular-nums text-right" value={amt} placeholder={String(pending)}
              onChange={e => setAmt(e.target.value)} autoFocus />
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-4)' }}>
              Leave it as it is to post the full {inr(pending)} still outstanding.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--border-2)' }}>
            <button className="btn-outline" onClick={onClose}>Cancel</button>
            <button className="btn" disabled={value <= 0} onClick={() => { onSave(line.ref, value); setAmt('') }}>
              <CheckCircle2 size={14} /> Post {inr(value)}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

const F = ({ k, v }: { k: string; v: string }) => (
  <div><dt className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{k}</dt>
    <dd className="mt-0.5" style={{ color: 'var(--text-1)' }}>{v}</dd></div>
)
