import { useState, useEffect, useMemo } from 'react'
import QRCode from 'qrcode'
import {
  QrCode, Smartphone, Landmark, CreditCard, Banknote, Zap, Clock, PlugZap, Copy, Check, CircleAlert,
} from 'lucide-react'
import { PageHead, Stat, Select, TableCard } from '@/components/ui'
import { INVOICES } from '@/data/txns'
import { BANK_LINES } from '@/data/operations'
import { inr, fmtDate, cn } from '@/lib/utils'
import { COMPANY, TODAY } from '@/data/company'

/* ── How quickly each way of paying can show up in the dashboard ───────────
   UPI can be known in seconds because the bank calls us the moment it lands.
   A bank transfer depends on how often the bank will hand over the statement.
   A card settles the next working day, whatever the terminal shows. Saying
   otherwise would be promising something the rails cannot do.             */

interface Channel {
  id: string
  label: string
  icon: typeof Zap
  speed: string
  live: boolean
  how: string
  needs: string[]
}

const CHANNELS: Channel[] = [
  {
    id: 'upi', label: 'UPI', icon: Smartphone, speed: 'Within seconds', live: true,
    how: 'A QR carrying the bill number is shown at the counter. The moment the customer pays, the bank calls the dashboard and the bill turns paid on its own — no one types anything.',
    needs: ['A merchant VPA on the current account', 'A payment gateway or the bank’s own UPI collect service', 'One web address the bank can call when money lands'],
  },
  {
    id: 'neft', label: 'NEFT / RTGS / IMPS', icon: Landmark, speed: 'Same day, in batches', live: false,
    how: 'Bank transfers do not announce themselves. The dashboard reads the account statement on a schedule and matches each credit against a bill by the reference the customer put in.',
    needs: [`Corporate internet banking on the ${COMPANY.bank.bank} current account`, 'Statement access — the bank’s API where available, otherwise a scheduled download', 'Customers asked to put the bill number in the transfer remark'],
  },
  {
    id: 'card', label: 'Card / POS machine', icon: CreditCard, speed: 'Settles next working day', live: false,
    how: 'The terminal approves in seconds but the money reaches the account the next working day. The dashboard can show the swipe straight away and mark it settled when the money actually arrives.',
    needs: ['The terminal provider’s settlement report access', 'The terminal’s merchant ID mapped to this shop'],
  },
  {
    id: 'cash', label: 'Cash', icon: Banknote, speed: 'Entered at the counter', live: true,
    how: 'Taken at the counter and entered on the bill as it is raised. Nothing to connect.',
    needs: [],
  },
]

export default function Payments() {
  const unpaid = useMemo(
    () => INVOICES.filter(i => i.total - i.received > 0).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40),
    [],
  )
  const [billNo, setBillNo] = useState(unpaid[0]?.no ?? '')
  const bill = unpaid.find(b => b.no === billNo)
  const due = bill ? bill.total - bill.received : 0

  /* A real UPI request — any UPI app reads this exact string. */
  const vpa = 'venkatasaialuminium@kotak'
  const upiLink = bill
    ? `upi://pay?pa=${vpa}&pn=${encodeURIComponent(COMPANY.name)}&am=${due.toFixed(2)}&cu=INR&tn=${encodeURIComponent(bill.no)}`
    : ''

  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!upiLink) { setQr(''); return }
    QRCode.toString(upiLink, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then(setQr).catch(() => setQr(''))
  }, [upiLink])

  const today = BANK_LINES.filter(b => b.date === TODAY)
  const collectedToday = today.reduce((s, b) => s + b.credit, 0)

  return (
    <div>
      <PageHead title="Payments"
        sub="Collecting on a bill, and how soon each way of paying can show up here on its own" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Bills Awaiting Payment" value={String(INVOICES.filter(i => i.total - i.received > 0).length)}
          icon={Clock} tone="amber" sub={inr(INVOICES.reduce((s, i) => s + Math.max(0, i.total - i.received), 0)) + ' outstanding'} />
        <Stat label="Credited Today" value={inr(collectedToday)} icon={Landmark} tone="green"
          sub={`${today.length} credits on ${fmtDate(TODAY)}`} />
        <Stat label="Live Channels" value={`${CHANNELS.filter(c => c.live).length} of ${CHANNELS.length}`}
          icon={Zap} tone="brand" sub="Update without anybody typing" />
        <Stat label="Ready to Connect" value={String(CHANNELS.filter(c => !c.live).length)} icon={PlugZap} tone="violet"
          sub="Waiting on bank and terminal access" />
      </div>

      {/* ── Collect on a bill ────────────────────────────────────────── */}
      <div className="card mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <p className="section-title text-base mb-1 flex items-center gap-2">
              <QrCode size={15} className="text-brand" /> Collect on a Bill
            </p>
            <p className="section-sub max-w-3xl">
              The code below is a real UPI request carrying the bill number. Scanning it in any UPI app opens the
              payment with the amount already filled in, so the customer cannot key a wrong figure.
            </p>
          </div>
          <Select value={billNo} onChange={setBillNo} options={unpaid.map(b => b.no)} className="min-w-[13rem]" />
        </div>

        {!bill ? <p className="text-sm" style={{ color: 'var(--text-4)' }}>Nothing outstanding.</p> : (
          <div className="grid grid-cols-1 lg:grid-cols-[auto,1fr] gap-6 items-start">
            <div className="rounded-lg p-3 w-fit mx-auto lg:mx-0" style={{ background: '#fff', border: '1px solid var(--border-2)' }}>
              {qr
                ? <div className="w-44 h-44 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: qr }} />
                : <div className="w-44 h-44 flex items-center justify-center text-xs" style={{ color: '#888' }}>Building code…</div>}
            </div>

            <div className="min-w-0">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-4">
                <F k="Bill" v={bill.no} />
                <F k="Customer" v={bill.clientName} />
                <F k="Bill total" v={inr(bill.total)} />
                <F k="Already received" v={bill.received ? inr(bill.received) : '—'} />
                <F k="Amount in the code" v={inr(due)} />
                <F k="Paid into" v={`${vpa}`} />
              </dl>

              <div className="flex flex-wrap gap-2">
                <a className="btn" href={upiLink}><Smartphone size={14} /> Open in a UPI app</a>
                <button className="btn-outline" onClick={() => {
                  navigator.clipboard?.writeText(upiLink); setCopied(true); setTimeout(() => setCopied(false), 1800)
                }}>
                  {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy the link</>}
                </button>
              </div>

              <p className="text-[11px] mt-3 flex items-start gap-1.5" style={{ color: 'var(--text-4)' }}>
                <CircleAlert size={12} className="mt-0.5 shrink-0" />
                The code is built with a sample VPA. Once your own merchant VPA is on the account, the same code
                collects into it and the bill closes by itself the moment the money lands.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── What each channel can and cannot do ──────────────────────── */}
      <p className="section-title text-base mb-1">How Soon Each Way of Paying Shows Up Here</p>
      <p className="section-sub mb-3">Written as the rails actually behave, not as anybody would like them to</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {CHANNELS.map(c => (
          <div key={c.id} className="card">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="section-title text-base flex items-center gap-2">
                <c.icon size={15} className="text-brand" /> {c.label}
              </p>
              <span className={cn('shrink-0', c.live ? 'badge-green' : 'badge-yellow')}>
                {c.live ? <><Zap size={11} /> {c.speed}</> : <><Clock size={11} /> {c.speed}</>}
              </span>
            </div>
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-3)' }}>{c.how}</p>

            {c.needs.length > 0 ? (
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-4)' }}>
                  To switch this on
                </p>
                <ul className="space-y-1">
                  {c.needs.map(n => (
                    <li key={n} className="text-[11px] flex items-start gap-1.5" style={{ color: 'var(--text-3)' }}>
                      <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: 'var(--text-4)' }} />{n}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>Nothing to connect.</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Today's credits ──────────────────────────────────────────── */}
      <p className="section-title text-base mb-1">Credits on {fmtDate(TODAY)}</p>
      <p className="section-sub mb-3">What the bank has actually put into the account today</p>
      <TableCard maxH="20rem">
        <thead>
          <tr><th>Reference</th><th>Party</th><th>Narration</th><th className="num">Credit</th><th className="num">Posted</th><th>Status</th></tr>
        </thead>
        <tbody>
          {today.map(b => (
            <tr key={b.ref}>
              <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{b.ref}</td>
              <td className="text-xs max-w-[13rem] truncate">{b.party}</td>
              <td className="text-xs max-w-[14rem] truncate">{b.narration}</td>
              <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{b.credit ? inr(b.credit) : '—'}</td>
              <td className="num tabular-nums">{b.entered ? inr(b.entered) : '—'}</td>
              <td><span className={b.status === 'Matched to Receipt' ? 'badge-green' : 'badge-yellow'}>{b.status}</span></td>
            </tr>
          ))}
          {today.length === 0 && (
            <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--text-4)' }}>
              Nothing credited yet today
            </td></tr>
          )}
        </tbody>
      </TableCard>
    </div>
  )
}

const F = ({ k, v }: { k: string; v: string }) => (
  <div><dt className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{k}</dt>
    <dd className="mt-0.5 truncate" style={{ color: 'var(--text-1)' }} title={v}>{v}</dd></div>
)
