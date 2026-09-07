import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Users, IndianRupee, Ruler, Wallet, Trophy } from 'lucide-react'
import { PageHead, Stat, Select, ExportBtn, TableCard, Empty, useChartTheme } from '@/components/ui'
import { INVOICES, MONTHS } from '@/data/txns'
import { inr, inrShort, kg as kgFmt, fmtDate, csvDownload, cn } from '@/lib/utils'
import { FY } from '@/data/company'

/* The counter writes the salesman's name in the remark, which is how the
   office already tells one man's bills from another's. Nothing new to type —
   this reads what is already written there.

   It matches against the staff list rather than taking whatever sits before
   the dash, or a remark like "Cut to size at shop — end pieces retained"
   would turn into a salesman. */
const STAFF = ['Siva Reddy', 'Murali', 'Prakash', 'Kavya M', 'Ganesh P', 'Ramesh K', 'Suresh N']

const nameFrom = (remark: string) => {
  const head = remark.split(/[—–-]/)[0].trim().toLowerCase()
  return STAFF.find(s => s.toLowerCase() === head) ?? null
}

const monthOf = (d: string) => MONTHS.find(m => d.startsWith(m.key))?.label ?? ''

export default function Salesmen() {
  const [month, setMonth] = useState('All Months')

  const bills = useMemo(
    () => INVOICES.filter(i => month === 'All Months' || monthOf(i.date) === month),
    [month],
  )

  const men = useMemo(() => {
    const m = new Map<string, {
      name: string; bills: number; taxable: number; total: number; received: number
      sqft: number; kg: number; customers: Set<string>; last: string
    }>()
    for (const i of bills) {
      const n = nameFrom(i.remarks)
      if (!n) continue
      const e = m.get(n) ?? { name: n, bills: 0, taxable: 0, total: 0, received: 0, sqft: 0, kg: 0, customers: new Set<string>(), last: '' }
      e.bills++
      e.taxable += i.taxable; e.total += i.total; e.received += i.received
      e.customers.add(i.clientName)
      if (i.date > e.last) e.last = i.date
      for (const l of i.lines) {
        if (l.unit === 'sqft') e.sqft += l.qty
        if (l.unit === 'kg') e.kg += l.qty
      }
      m.set(n, e)
    }
    return [...m.values()]
      .map(e => ({
        ...e,
        sqft: +e.sqft.toFixed(1), kg: +e.kg.toFixed(1),
        customers: e.customers.size,
        outstanding: e.total - e.received,
        avgBill: e.bills ? Math.round(e.total / e.bills) : 0,
        realised: e.total ? +((e.received / e.total) * 100).toFixed(0) : 0,
      }))
      .sort((a, b) => b.total - a.total)
  }, [bills])

  const t = useChartTheme()
  const totals = men.reduce((a, m) => ({
    bills: a.bills + m.bills, total: a.total + m.total,
    sqft: +(a.sqft + m.sqft).toFixed(1), kg: +(a.kg + m.kg).toFixed(1),
    outstanding: a.outstanding + m.outstanding,
  }), { bills: 0, total: 0, sqft: 0, kg: 0, outstanding: 0 })

  const exportCsv = () => csvDownload('vsa-salesman-performance.csv', [
    ['Salesman performance', FY, month],
    [], ['Salesman', 'Bills', 'Customers', 'Taxable', 'Total Billed', 'Received', 'Outstanding',
         'Sqft Sold', 'Kg Sold', 'Average Bill', 'Realised %', 'Last Bill'],
    ...men.map(m => [m.name, m.bills, m.customers, Math.round(m.taxable), m.total, m.received,
                     m.outstanding, m.sqft, m.kg, m.avgBill, m.realised, m.last]),
  ])

  return (
    <div>
      <PageHead title="Salesmen" sub="Read from the name already written on each bill — nothing extra to enter">
        <Select value={month} onChange={setMonth} options={['All Months', ...MONTHS.map(m => m.label)]} />
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Men Billing" value={String(men.length)} icon={Users} tone="brand"
          sub={`${totals.bills} bills between them`} />
        <Stat label="Billed" value={inr(totals.total)} icon={IndianRupee} tone="violet" sub="Including GST" />
        <Stat label="Sqft Sold" value={totals.sqft.toLocaleString('en-IN')} icon={Ruler} tone="sky"
          sub={`and ${kgFmt(totals.kg)} by weight`} />
        <Stat label="Still to Collect" value={inr(totals.outstanding)} icon={Wallet}
          tone={totals.outstanding > 0 ? 'amber' : 'green'} sub="On their own bills" />
      </div>

      {men.length === 0 ? <Empty msg="No salesman name written on any bill this month" /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            <div className="card">
              <p className="section-title text-base mb-1">Billed by Each</p>
              <p className="section-sub mb-3">Value on their own bills</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={men.map(m => ({ name: m.name.split(' ')[0], value: m.total }))}
                  margin={{ top: 6, right: 8, bottom: 4, left: 4 }}>
                  <CartesianGrid stroke={t.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={t.tick} tickLine={false} axisLine={false} />
                  <YAxis tick={t.tick} tickLine={false} axisLine={false} width={48} tickFormatter={inrShort} />
                  <Tooltip contentStyle={t.tooltip} formatter={(v: number) => inr(v)} />
                  <Bar dataKey="value" fill="var(--brand)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <p className="section-title text-base mb-1 flex items-center gap-2">
                <Trophy size={15} className="text-brand" /> How They Compare
              </p>
              <p className="section-sub mb-3">Collection is the number that matters more than billing</p>
              <div className="space-y-3">
                {men.map(m => (
                  <div key={m.name}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{m.name}</span>
                      <span className="text-xs tabular-nums shrink-0" style={{ color: 'var(--text-3)' }}>
                        {inr(m.received)} of {inr(m.total)}
                        <span className="ml-2 font-semibold"
                          style={{ color: m.realised >= 80 ? 'var(--green)' : m.realised >= 60 ? 'var(--amber, #f59e0b)' : 'var(--red)' }}>
                          {m.realised}%
                        </span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-card2)' }}>
                      <div className="h-full rounded-full"
                        style={{
                          width: `${m.realised}%`,
                          background: m.realised >= 80 ? 'var(--green)' : m.realised >= 60 ? 'var(--amber, #f59e0b)' : 'var(--red)',
                        }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="section-title text-base mb-1">Man by Man</p>
          <p className="section-sub mb-3">Sqft is counted where the item is sold by area; the rest is by weight</p>
          <TableCard>
            <thead>
              <tr><th>Salesman</th><th className="num">Bills</th><th className="num">Customers</th>
                <th className="num">Billed</th><th className="num">Received</th><th className="num">Outstanding</th>
                <th className="num">Sqft</th><th className="num">Kg</th><th className="num">Average Bill</th><th>Last Bill</th></tr>
            </thead>
            <tbody>
              {men.map(m => (
                <tr key={m.name}>
                  <td className="font-medium" style={{ color: 'var(--text-1)' }}>{m.name}</td>
                  <td className="num tabular-nums">{m.bills}</td>
                  <td className="num tabular-nums text-xs">{m.customers}</td>
                  <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(m.total)}</td>
                  <td className="num tabular-nums text-xs">{inr(m.received)}</td>
                  <td className={cn('num tabular-nums font-medium')}
                    style={{ color: m.outstanding > 0 ? 'var(--red)' : 'var(--text-4)' }}>
                    {m.outstanding > 0 ? inr(m.outstanding) : '—'}
                  </td>
                  <td className="num tabular-nums text-xs">{m.sqft || '—'}</td>
                  <td className="num tabular-nums text-xs">{m.kg.toLocaleString('en-IN')}</td>
                  <td className="num tabular-nums text-xs">{inr(m.avgBill)}</td>
                  <td className="text-xs whitespace-nowrap">{m.last ? fmtDate(m.last) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        </>
      )}
    </div>
  )
}
