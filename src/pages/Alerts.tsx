import { useState, useMemo } from 'react'
import {
  BellRing, PackageX, TrendingDown, SprayCan, ClipboardList, Flame,
  Send, MessageSquare, Mail, CheckCircle2, IndianRupee, Clock,
} from 'lucide-react'
import { PageHead, Stat, TableCard, ExportBtn, Modal, Empty } from '@/components/ui'
import { belowMinimum, below15Days, fastMoving, PCU_OUTSTANDING, PURCHASE_ORDERS } from '@/data/positions'
import { INVOICES } from '@/data/txns'
import { CLIENTS } from '@/data/parties'
import { inr, fmtDate, daysAgo, csvDownload, cn } from '@/lib/utils'
import { COMPANY, TODAY } from '@/data/company'

const TABS = ['Stock Alerts', 'Payment Reminders'] as const

export default function Alerts() {
  const [tab, setTab] = useState<typeof TABS[number]>('Stock Alerts')

  const overdueBills = INVOICES.filter(i => i.status === 'Overdue')
  const stockAlertCount = belowMinimum.length + below15Days.length + PURCHASE_ORDERS.filter(p => p.status === 'Overdue').length

  return (
    <div>
      <PageHead title="Alerts & Reminders" sub={`Everything that needs chasing today — ${fmtDate(TODAY)}`} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Stock Alerts"     value={String(stockAlertCount)} icon={PackageX} tone={stockAlertCount ? 'red' : 'green'} sub="Reorder, cover and PO issues" />
        <Stat label="At Coaters"       value={`${PCU_OUTSTANDING.reduce((s, p) => s + p.nos, 0).toLocaleString('en-IN')} nos`} icon={SprayCan} tone="amber" sub={`${PCU_OUTSTANDING.reduce((s, p) => s + p.kg, 0).toLocaleString('en-IN')} kg lying out`} />
        <Stat label="Overdue Customers" value={String(new Set(overdueBills.map(i => i.clientId)).size)} icon={Clock} tone="red" sub={`${overdueBills.length} bills past due date`} />
        <Stat label="Amount Overdue"   value={inr(overdueBills.reduce((s, i) => s + (i.total - i.received), 0))} icon={IndianRupee} tone="violet" sub="To be recovered" />
      </div>

      <div className="flex gap-1 mb-5 p-1 rounded-lg w-fit" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-1.5 rounded-md text-xs font-medium transition-colors', tab === t && 'bg-brand text-white')}
            style={tab === t ? undefined : { color: 'var(--text-3)' }}>{t}</button>
        ))}
      </div>

      {tab === 'Stock Alerts' ? <StockAlerts /> : <PaymentReminders />}
    </div>
  )
}

/* ── Stock side ────────────────────────────────────────────────────── */
function StockAlerts() {
  const overduePos = PURCHASE_ORDERS.filter(p => p.status === 'Overdue' || p.status === 'Confirmed — Awaiting Delivery')

  const exportCsv = () => csvDownload('vsa-stock-alerts.csv', [
    ['Below minimum stock'], ['Code', 'Item', 'On Hand', 'Minimum', 'Short By'],
    ...belowMinimum.map(l => [l.code, l.name, l.atStores, l.minStock, l.minStock - l.atStores]),
    [], ['Below 15 days consumption'], ['Code', 'Item', 'On Hand', '15-Day Need', 'Cover Days'],
    ...below15Days.map(l => [l.code, l.name, l.atStores, l.days15, l.coverDays]),
    [], ['At coaters'], ['PCU', 'Open DCs', 'Pieces', 'Weight (kg)', 'Oldest (days)'],
    ...PCU_OUTSTANDING.map(p => [p.pcu, p.jobs, p.nos, p.kg, p.oldestDays]),
    [], ['Open purchase orders'], ['PO No', 'Supplier', 'Expected', 'Pending Nos', 'Status'],
    ...overduePos.map(p => [p.no, p.supplier, p.expectedDate, p.pendingNos, p.status]),
    [], ['Fast moving'], ['Code', 'Item', 'Per Day', 'On Hand', 'Cover Days'],
    ...fastMoving.map(l => [l.code, l.name, l.avgDaily, l.atStores, l.coverDays]),
  ])

  return (
    <>
      <div className="flex justify-end mb-3"><ExportBtn onClick={exportCsv} label="Export all alerts" /></div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel icon={PackageX} tone="red" title="Below Minimum Stock" count={belowMinimum.length}
          note="On hand has fallen to or below the reorder level">
          <TableCard maxH="17rem">
            <thead><tr><th>Item</th><th className="num">On Hand</th><th className="num">Minimum</th><th className="num">Short By</th></tr></thead>
            <tbody>
              {belowMinimum.map(l => (
                <tr key={l.code}>
                  <td><p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{l.name}</p>
                    <p className="font-mono text-[10px]" style={{ color: 'var(--text-4)' }}>{l.code}</p></td>
                  <td className="num tabular-nums font-semibold text-red-500">{l.atStores}</td>
                  <td className="num tabular-nums text-xs">{l.minStock}</td>
                  <td className="num tabular-nums font-medium text-amber-600">{Math.max(0, l.minStock - l.atStores)}</td>
                </tr>
              ))}
              {belowMinimum.length === 0 && <tr><td colSpan={4}><Empty msg="Everything above reorder level" /></td></tr>}
            </tbody>
          </TableCard>
        </Panel>

        <Panel icon={TrendingDown} tone="amber" title="Below 15 Days Consumption" count={below15Days.length}
          note="Stock will not last a fortnight at the current sales rate">
          <TableCard maxH="17rem">
            <thead><tr><th>Item</th><th className="num">Per Day</th><th className="num">On Hand</th><th className="num">15-Day Need</th><th className="num">Cover</th></tr></thead>
            <tbody>
              {below15Days.map(l => (
                <tr key={l.code}>
                  <td><p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{l.name}</p>
                    <p className="font-mono text-[10px]" style={{ color: 'var(--text-4)' }}>{l.code}</p></td>
                  <td className="num tabular-nums text-xs">{l.avgDaily}</td>
                  <td className="num tabular-nums">{l.atStores}</td>
                  <td className="num tabular-nums text-xs">{l.days15}</td>
                  <td className="num tabular-nums font-semibold text-red-500">{l.coverDays}d</td>
                </tr>
              ))}
              {below15Days.length === 0 && <tr><td colSpan={5}><Empty msg="Every item covers the next fortnight" /></td></tr>}
            </tbody>
          </TableCard>
        </Panel>

        <Panel icon={SprayCan} tone="violet" title="Material Lying at Coaters" count={PCU_OUTSTANDING.reduce((s, p) => s + p.jobs, 0)}
          note="Sent for powder coating and not fully returned">
          <div className="grid sm:grid-cols-2 gap-3">
            {PCU_OUTSTANDING.map(p => (
              <div key={p.pcu} className={cn('rounded-lg p-4', p.overdue > 0 && 'ring-1 ring-red-400')}
                style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="badge-brand">{p.pcu}</span>
                  {p.overdue > 0 && <span className="badge-red">{p.overdue} overdue</span>}
                </div>
                <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>{p.nos.toLocaleString('en-IN')} <span className="text-xs font-medium" style={{ color: 'var(--text-4)' }}>nos</span></p>
                <p className="text-sm font-medium tabular-nums" style={{ color: 'var(--text-2)' }}>{p.kg.toLocaleString('en-IN')} kg</p>
                <p className="text-[11px] mt-2" style={{ color: 'var(--text-4)' }}>
                  {p.jobs} open DCs · oldest {p.oldestDays} days · coating charge {inr(p.value)}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel icon={ClipboardList} tone="sky" title="Outstanding Purchase Orders" count={overduePos.length}
          note="Confirmed with the supplier but not yet delivered">
          <TableCard maxH="17rem">
            <thead><tr><th>PO No</th><th>Supplier</th><th>Expected</th><th className="num">Pending</th></tr></thead>
            <tbody>
              {overduePos.map(p => {
                const late = daysAgo(p.expectedDate)
                return (
                  <tr key={p.id}>
                    <td className="font-medium text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{p.no}</td>
                    <td className="text-xs max-w-[11rem] truncate">{p.supplier}</td>
                    <td className="text-xs whitespace-nowrap">
                      {fmtDate(p.expectedDate)}
                      {late > 0 && <span className="text-red-500 font-medium"> · {late}d</span>}
                    </td>
                    <td className="num tabular-nums font-semibold text-amber-600">{p.pendingNos}</td>
                  </tr>
                )
              })}
              {overduePos.length === 0 && <tr><td colSpan={4}><Empty msg="No orders pending delivery" /></td></tr>}
            </tbody>
          </TableCard>
        </Panel>

        <Panel icon={Flame} tone="green" title="Fast Moving Items" count={fastMoving.length}
          note="Highest daily off-take — keep these stocked" wide>
          <TableCard maxH="19rem">
            <thead><tr><th>Item</th><th>Category</th><th className="num">Per Day</th><th className="num">On Hand</th><th className="num">At Coaters</th><th className="num">Cover</th></tr></thead>
            <tbody>
              {fastMoving.map(l => (
                <tr key={l.code}>
                  <td><p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{l.name}</p>
                    <p className="font-mono text-[10px]" style={{ color: 'var(--text-4)' }}>{l.code}</p></td>
                  <td className="text-xs">{l.category}</td>
                  <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{l.avgDaily}</td>
                  <td className="num tabular-nums">{l.atStores}</td>
                  <td className="num tabular-nums text-xs">{(l.atPcu1 + l.atPcu2) || '—'}</td>
                  <td className={cn('num tabular-nums text-xs font-medium', l.coverDays < 15 ? 'text-red-500' : l.coverDays < 30 ? 'text-amber-600' : 'text-green-600')}>
                    {l.coverDays === 999 ? '—' : `${l.coverDays}d`}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        </Panel>
      </div>
    </>
  )
}

/* ── Payment side ──────────────────────────────────────────────────── */
function PaymentReminders() {
  const [sent, setSent] = useState<string[]>([])
  const [preview, setPreview] = useState<{ name: string; phone: string; amount: number; bills: number; oldest: number } | null>(null)

  /** Customer-level outstanding rolled up from open invoices. */
  const ledger = useMemo(() => {
    const m = new Map<string, { id: string; name: string; phone: string; due: number; overdue: number; bills: number; oldest: number; creditDays: number }>()
    for (const i of INVOICES) {
      const bal = i.total - i.received
      if (bal <= 0) continue
      const c = CLIENTS.find(x => x.id === i.clientId)!
      const e = m.get(i.clientId) ?? { id: c.id, name: c.name, phone: c.phone, due: 0, overdue: 0, bills: 0, oldest: 0, creditDays: c.creditDays }
      e.due += bal
      e.bills++
      const late = daysAgo(i.dueDate)
      if (late > 0) { e.overdue += bal; e.oldest = Math.max(e.oldest, late) }
      m.set(i.clientId, e)
    }
    return [...m.values()].sort((a, b) => b.due - a.due)
  }, [])

  const overdueToday = ledger.filter(l => l.overdue > 0)
  const top10 = ledger.slice(0, 10)

  const msg = (l: { name: string; amount: number; bills: number; oldest: number }) =>
    `Dear ${l.name},\n\nOur records show ${inr(l.amount)} outstanding against ${l.bills} invoice${l.bills > 1 ? 's' : ''} with ${COMPANY.short}, the oldest being ${l.oldest} days past due.\n\nKindly arrange payment at your earliest convenience.\n\nBank: ${COMPANY.bank.bank}, A/c ${COMPANY.bank.acNo}, IFSC ${COMPANY.bank.ifsc}\n\nFor queries call ${COMPANY.phone}.\n\n— ${COMPANY.name}`

  const exportCsv = () => csvDownload('vsa-overdue-customers.csv', [
    ['Daily overdue list', fmtDate(TODAY)],
    [], ['Customer', 'Phone', 'Credit Days', 'Open Bills', 'Total Due', 'Overdue', 'Oldest (days)'],
    ...ledger.map(l => [l.name, l.phone, l.creditDays, l.bills, l.due, l.overdue, l.oldest]),
  ])

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="card">
          <p className="section-title text-base mb-1">Reminder Schedule</p>
          <p className="section-sub mb-4">Runs automatically against the credit terms on each customer</p>
          <div className="space-y-3 text-xs">
            <Rule when="3 days before due date" what="Courtesy reminder on WhatsApp" icon={MessageSquare} />
            <Rule when="On the due date" what="Payment due notice — WhatsApp and email" icon={Mail} />
            <Rule when="Every 7 days after due" what="Follow-up with the ageing statement attached" icon={BellRing} />
            <Rule when="60 days past due" what="Escalation to the proprietor, new supply put on hold" icon={Clock} />
          </div>
        </div>

        <div className="card xl:col-span-2 p-0 overflow-hidden">
          <div className="flex items-start justify-between gap-3 px-5 py-4">
            <div>
              <p className="section-title text-base">Top 10 Outstanding Customers</p>
              <p className="section-sub">By total balance across all open invoices</p>
            </div>
            <ExportBtn onClick={exportCsv} label="Export list" />
          </div>
          <table className="tbl">
            <thead><tr><th>#</th><th>Customer</th><th className="num">Bills</th><th className="num">Total Due</th><th className="num">Overdue</th><th className="num">Oldest</th></tr></thead>
            <tbody>
              {top10.map((l, i) => (
                <tr key={l.id}>
                  <td className="font-mono text-xs" style={{ color: 'var(--text-4)' }}>{String(i + 1).padStart(2, '0')}</td>
                  <td className="font-medium max-w-[15rem] truncate" style={{ color: 'var(--text-1)' }}>{l.name}</td>
                  <td className="num tabular-nums">{l.bills}</td>
                  <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(l.due)}</td>
                  <td className={cn('num tabular-nums font-medium', l.overdue > 0 ? 'text-red-500' : '')}>{l.overdue > 0 ? inr(l.overdue) : '—'}</td>
                  <td className="num tabular-nums text-xs">{l.oldest > 0 ? `${l.oldest}d` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="section-title text-base mb-1">Today's Overdue List</p>
      <p className="section-sub mb-3">{overdueToday.length} customers to chase · {inr(overdueToday.reduce((s, l) => s + l.overdue, 0))} recoverable</p>
      <TableCard maxH="30rem">
        <thead>
          <tr><th>Customer</th><th>Phone</th><th className="num">Terms</th><th className="num">Bills</th><th className="num">Overdue</th><th className="num">Oldest</th><th>Reminder</th></tr>
        </thead>
        <tbody>
          {overdueToday.map(l => (
            <tr key={l.id}>
              <td className="font-medium max-w-[15rem] truncate" style={{ color: 'var(--text-1)' }}>{l.name}</td>
              <td className="font-mono text-xs whitespace-nowrap">{l.phone}</td>
              <td className="num text-xs">{l.creditDays}d</td>
              <td className="num tabular-nums">{l.bills}</td>
              <td className="num tabular-nums font-semibold text-red-500">{inr(l.overdue)}</td>
              <td className={cn('num tabular-nums text-xs font-medium', l.oldest > 60 ? 'text-red-500' : 'text-amber-600')}>{l.oldest}d</td>
              <td>
                {sent.includes(l.id)
                  ? <span className="badge-green"><CheckCircle2 size={11} /> Sent</span>
                  : <button onClick={() => setPreview({ name: l.name, phone: l.phone, amount: l.overdue, bills: l.bills, oldest: l.oldest })}
                      className="btn-ghost !px-2 !py-1 !text-xs"><Send size={12} /> Preview</button>}
              </td>
            </tr>
          ))}
          {overdueToday.length === 0 && <tr><td colSpan={7}><Empty msg="Nothing overdue today" /></td></tr>}
        </tbody>
      </TableCard>

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview ? `Reminder to ${preview.name}` : ''}>
        {preview && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="badge-brand"><MessageSquare size={11} /> WhatsApp</span>
              <span className="badge-gray">{preview.phone}</span>
              <span className="badge-red">{inr(preview.amount)} overdue</span>
            </div>
            <pre className="text-[11px] leading-relaxed whitespace-pre-wrap rounded-lg p-4 font-sans"
              style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)', color: 'var(--text-2)' }}>
              {msg(preview)}
            </pre>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPreview(null)} className="btn-ghost">Cancel</button>
              <button onClick={() => {
                const id = ledgerIdFor(preview.name)
                if (id) setSent(s => [...s, id])
                setPreview(null)
              }} className="btn"><Send size={14} /> Send reminder</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

const ledgerIdFor = (name: string) => CLIENTS.find(c => c.name === name)?.id

function Panel({ icon: Icon, tone, title, count, note, children, wide }: {
  icon: typeof PackageX; tone: string; title: string; count: number; note: string; children: React.ReactNode; wide?: boolean
}) {
  const tones: Record<string, string> = {
    red: 'bg-red-500/10 text-red-500', amber: 'bg-amber-500/10 text-amber-600',
    violet: 'bg-violet-500/10 text-violet-600', sky: 'bg-sky-500/10 text-sky-600',
    green: 'bg-green-500/10 text-green-600',
  }
  return (
    <div className={cn('card p-0 overflow-hidden', wide && 'xl:col-span-2')}>
      <div className="flex items-start gap-3 px-5 py-4">
        <div className={cn('p-2 rounded-lg shrink-0', tones[tone])}><Icon size={16} /></div>
        <div className="flex-1 min-w-0">
          <p className="section-title text-base">{title}</p>
          <p className="section-sub">{note}</p>
        </div>
        <span className="text-xl font-bold tabular-nums shrink-0" style={{ color: 'var(--text-1)' }}>{count}</span>
      </div>
      {children}
    </div>
  )
}

function Rule({ when, what, icon: Icon }: { when: string; what: string; icon: typeof BellRing }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={13} className="text-brand mt-0.5 shrink-0" />
      <div>
        <p className="font-medium" style={{ color: 'var(--text-1)' }}>{when}</p>
        <p style={{ color: 'var(--text-4)' }}>{what}</p>
      </div>
    </div>
  )
}
