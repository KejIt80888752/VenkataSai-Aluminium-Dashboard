import { useState, useMemo } from 'react'
import { Building2, Users, IndianRupee, CreditCard, Phone, Mail, MapPin } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Pager, usePaged, Empty, Pill, Modal } from '@/components/ui'
import { CLIENTS, type Client } from '@/data/parties'
import { INVOICES } from '@/data/txns'
import { inr, fmtDate, csvDownload } from '@/lib/utils'

const TYPES = ['All Types', 'B2B Fabricator', 'Builder / Contractor', 'Dealer', 'B2C Retail']

export default function Clients() {
  const [q, setQ]     = useState('')
  const [type, setType] = useState('All Types')
  const [sel, setSel] = useState<Client | null>(null)

  /** Per-customer ledger rolled up from the invoice book. */
  const stats = useMemo(() => {
    const m = new Map<string, { billed: number; received: number; bills: number; last: string }>()
    for (const i of INVOICES) {
      const e = m.get(i.clientId) ?? { billed: 0, received: 0, bills: 0, last: '' }
      e.billed += i.total; e.received += i.received; e.bills++
      if (i.date > e.last) e.last = i.date
      m.set(i.clientId, e)
    }
    return m
  }, [])

  const rows = useMemo(() => CLIENTS.filter(c =>
    (type === 'All Types' || c.type === type) &&
    (q === '' || `${c.name} ${c.contact} ${c.area} ${c.gstin}`.toLowerCase().includes(q.toLowerCase())),
  ).sort((a, b) => (stats.get(b.id)?.billed ?? 0) - (stats.get(a.id)?.billed ?? 0)), [q, type, stats])

  const paged = usePaged(rows, 10)
  const totalBilled = [...stats.values()].reduce((s, e) => s + e.billed, 0)
  const totalDue    = [...stats.values()].reduce((s, e) => s + (e.billed - e.received), 0)

  const exportCsv = () => csvDownload('vsa-customers.csv', [
    ['Name', 'Type', 'Contact', 'Phone', 'Email', 'GSTIN', 'Area', 'State', 'Credit Days', 'Credit Limit', 'Billed', 'Received', 'Outstanding', 'Status'],
    ...rows.map(c => {
      const s = stats.get(c.id)
      return [c.name, c.type, c.contact, c.phone, c.email, c.gstin, c.area, c.state, c.creditDays, c.creditLimit,
        s?.billed ?? 0, s?.received ?? 0, (s?.billed ?? 0) - (s?.received ?? 0), c.status]
    }),
  ])

  return (
    <div>
      <PageHead title="Customers" sub="Fabricators, builders, dealers and retail buyers on the books">
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Customers"        value={String(CLIENTS.length)} icon={Building2}   tone="brand"  sub={`${CLIENTS.filter(c => c.status === 'Active').length} active`} />
        <Stat label="B2B Fabricators"  value={String(CLIENTS.filter(c => c.type === 'B2B Fabricator').length)} icon={Users} tone="sky" sub="Core repeat buyers" />
        <Stat label="Lifetime Billing" value={inr(totalBilled)}       icon={IndianRupee} tone="violet" sub="This financial year" />
        <Stat label="Outstanding"      value={inr(totalDue)}          icon={CreditCard}  tone="red"    sub="Across all customers" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, contact, GSTIN…" />
        <Select value={type} onChange={setType} options={TYPES} />
      </div>

      <TableCard>
        <thead>
          <tr><th>Customer</th><th>Type</th><th>Area</th><th className="num">Credit</th><th className="num">Billed</th><th className="num">Outstanding</th><th>Status</th></tr>
        </thead>
        <tbody>
          {paged.slice.map(c => {
            const s = stats.get(c.id)
            const due = (s?.billed ?? 0) - (s?.received ?? 0)
            return (
              <tr key={c.id} className="cursor-pointer" onClick={() => setSel(c)}>
                <td>
                  <p className="font-medium" style={{ color: 'var(--text-1)' }}>{c.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>{c.contact} · {c.phone}</p>
                </td>
                <td className="text-xs whitespace-nowrap">{c.type}</td>
                <td className="text-xs whitespace-nowrap">{c.area}</td>
                <td className="num text-xs whitespace-nowrap">{c.creditDays ? `${c.creditDays} days` : 'Cash'}</td>
                <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(s?.billed ?? 0)}</td>
                <td className={`num tabular-nums ${due > 0 ? 'text-red-500 font-medium' : ''}`}>{due > 0 ? inr(due) : '—'}</td>
                <td><Pill s={c.status} /></td>
              </tr>
            )
          })}
        </tbody>
      </TableCard>
      {rows.length === 0 && <Empty msg="No customers match these filters" />}
      <Pager {...paged} />

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.name ?? ''} wide>
        {sel && (() => {
          const s = stats.get(sel.id)
          const bills = INVOICES.filter(i => i.clientId === sel.id).sort((a, b) => b.date.localeCompare(a.date))
          const due = (s?.billed ?? 0) - (s?.received ?? 0)
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Pill s={sel.status} /><span className="badge-gray">{sel.type}</span>
                <span className="badge-brand">Customer since {fmtDate(sel.since)}</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <p className="flex items-center gap-2" style={{ color: 'var(--text-2)' }}><Phone size={14} className="text-brand" /> {sel.phone}</p>
                <p className="flex items-center gap-2" style={{ color: 'var(--text-2)' }}><Mail size={14} className="text-brand" /> {sel.email}</p>
                <p className="flex items-center gap-2" style={{ color: 'var(--text-2)' }}><MapPin size={14} className="text-brand" /> {sel.area}, {sel.state}</p>
                <p style={{ color: 'var(--text-2)' }}><span style={{ color: 'var(--text-4)' }}>GSTIN: </span>{sel.gstin}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Mini k="Billed"       v={inr(s?.billed ?? 0)} />
                <Mini k="Received"     v={inr(s?.received ?? 0)} />
                <Mini k="Outstanding"  v={inr(due)} danger={due > 0} />
                <Mini k="Credit Limit" v={sel.creditLimit ? inr(sel.creditLimit) : 'Cash only'} />
              </div>

              <div>
                <p className="section-title text-sm mb-2">Invoice history ({bills.length})</p>
                <div className="overflow-auto rounded-lg max-h-56" style={{ border: '1px solid var(--border-2)' }}>
                  <table className="tbl">
                    <thead><tr><th>Invoice</th><th>Date</th><th className="num">Total</th><th className="num">Balance</th><th>Status</th></tr></thead>
                    <tbody>
                      {bills.map(b => (
                        <tr key={b.id}>
                          <td className="whitespace-nowrap font-medium" style={{ color: 'var(--text-1)' }}>{b.no}</td>
                          <td className="whitespace-nowrap text-xs">{fmtDate(b.date)}</td>
                          <td className="num tabular-nums">{inr(b.total)}</td>
                          <td className="num tabular-nums">{b.total - b.received > 0 ? inr(b.total - b.received) : '—'}</td>
                          <td><Pill s={b.status} /></td>
                        </tr>
                      ))}
                      {bills.length === 0 && <tr><td colSpan={5} className="text-center py-6" style={{ color: 'var(--text-4)' }}>No invoices yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}

function Mini({ k, v, danger }: { k: string; v: string; danger?: boolean }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{k}</p>
      <p className={`text-sm font-bold mt-0.5 tabular-nums ${danger ? 'text-red-500' : ''}`}
        style={danger ? undefined : { color: 'var(--text-1)' }}>{v}</p>
    </div>
  )
}
