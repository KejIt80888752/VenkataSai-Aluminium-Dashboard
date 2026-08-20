import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Wallet, AlertTriangle, TrendingDown, Clock } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Pager, usePaged, Empty, Pill, useChartTheme } from '@/components/ui'
import { INVOICES, PURCHASES, TOTALS } from '@/data/txns'
import { inr, inrShort, fmtDate, daysAgo, csvDownload } from '@/lib/utils'
import { TODAY } from '@/data/company'

/** Standard receivables ageing buckets used in trade. */
const BUCKETS = [
  { label: 'Not due',    test: (d: number) => d < 0 },
  { label: '0–30 days',  test: (d: number) => d >= 0 && d <= 30 },
  { label: '31–60 days', test: (d: number) => d > 30 && d <= 60 },
  { label: '61–90 days', test: (d: number) => d > 60 && d <= 90 },
  { label: '90+ days',   test: (d: number) => d > 90 },
]
const BUCKET_COLOR = ['#64748b', '#0f5b8f', '#f59e0b', '#f97316', '#ef4444']

export default function Outstanding() {
  const [q, setQ]       = useState('')
  const [book, setBook] = useState('Receivables')
  const t = useChartTheme()

  /** Open invoices with days-past-due computed from the due date. */
  const receivables = useMemo(() => INVOICES
    .filter(i => i.total - i.received > 0)
    .map(i => ({
      id: i.id, no: i.no, date: i.date, due: i.dueDate, party: i.clientName,
      total: i.total, paid: i.received, balance: i.total - i.received,
      overdueDays: daysAgo(i.dueDate), status: i.status as string,
    })), [])

  const payables = useMemo(() => PURCHASES
    .filter(p => p.total - p.paid > 0)
    .map(p => ({
      id: p.id, no: p.no, date: p.date, due: p.dueDate, party: p.supplier,
      total: p.total, paid: p.paid, balance: p.total - p.paid,
      overdueDays: daysAgo(p.dueDate), status: p.status as string,
    })), [])

  const source = book === 'Receivables' ? receivables : payables
  const rows = useMemo(() => source
    .filter(r => q === '' || `${r.no} ${r.party}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.overdueDays - a.overdueDays), [source, q])

  const paged = usePaged(rows, 12)

  const ageing = BUCKETS.map(b => ({
    name: b.label,
    value: Math.round(source.filter(r => b.test(r.overdueDays)).reduce((s, r) => s + r.balance, 0)),
    count: source.filter(r => b.test(r.overdueDays)).length,
  }))

  const overdue    = source.filter(r => r.overdueDays > 0)
  const overdueAmt = overdue.reduce((s, r) => s + r.balance, 0)
  const worst      = [...source].sort((a, b) => b.overdueDays - a.overdueDays)[0]

  const exportCsv = () => csvDownload(`vsa-${book.toLowerCase()}.csv`, [
    ['Document', 'Date', 'Due Date', 'Party', 'Total', 'Paid', 'Balance', 'Days Past Due', 'Status'],
    ...rows.map(r => [r.no, r.date, r.due, r.party, r.total, r.paid, r.balance, r.overdueDays > 0 ? r.overdueDays : 0, r.status]),
  ])

  return (
    <div>
      <PageHead title="Outstanding" sub={`Receivables and payables ageing as on ${fmtDate(TODAY)}`}>
        <Select value={book} onChange={setBook} options={['Receivables', 'Payables']} />
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Total Receivable" value={inr(TOTALS.receivable)} icon={Wallet}       tone="brand" sub={`${receivables.length} open invoices`} />
        <Stat label="Total Payable"    value={inr(TOTALS.payable)}    icon={TrendingDown} tone="violet" sub={`${payables.length} open bills`} />
        <Stat label={`Overdue — ${book}`} value={inr(overdueAmt)}     icon={AlertTriangle} tone="red"  sub={`${overdue.length} documents past due`} />
        <Stat label="Oldest Item"      value={worst ? `${worst.overdueDays} days` : '—'} icon={Clock} tone="amber" sub={worst ? worst.party : 'Nothing pending'} />
      </div>

      <div className="card mb-5">
        <p className="section-title text-base mb-1">{book} Ageing</p>
        <p className="section-sub mb-3">Balance grouped by days past due date</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={ageing} barSize={44} margin={{ left: -6 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
            <XAxis dataKey="name" tick={t.tick} axisLine={false} tickLine={false} />
            <YAxis tick={t.tick} axisLine={false} tickLine={false} tickFormatter={inrShort} width={62} />
            <Tooltip contentStyle={t.tooltip}
              formatter={(v: number, _n, p) => [`${inr(v)} · ${(p.payload as { count: number }).count} docs`, 'Balance']}
              cursor={{ fill: 'rgba(15,91,143,.06)' }} />
            <Bar isAnimationActive={false} dataKey="value" radius={[4, 4, 0, 0]}>
              {ageing.map((_, i) => <Cell key={i} fill={BUCKET_COLOR[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search document no or party…" />
      </div>

      <TableCard>
        <thead>
          <tr><th>Document</th><th>Date</th><th>Due</th><th>{book === 'Receivables' ? 'Customer' : 'Supplier'}</th>
            <th className="num">Total</th><th className="num">Paid</th><th className="num">Balance</th><th className="num">Ageing</th><th>Status</th></tr>
        </thead>
        <tbody>
          {paged.slice.map(r => (
            <tr key={r.id}>
              <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{r.no}</td>
              <td className="whitespace-nowrap text-xs">{fmtDate(r.date)}</td>
              <td className="whitespace-nowrap text-xs">{fmtDate(r.due)}</td>
              <td className="max-w-[15rem] truncate">{r.party}</td>
              <td className="num tabular-nums">{inr(r.total)}</td>
              <td className="num tabular-nums text-xs">{r.paid ? inr(r.paid) : '—'}</td>
              <td className="num tabular-nums font-semibold text-red-500">{inr(r.balance)}</td>
              <td className="num tabular-nums text-xs">
                {r.overdueDays > 0
                  ? <span className={r.overdueDays > 60 ? 'text-red-500 font-semibold' : 'text-amber-600 font-medium'}>{r.overdueDays}d late</span>
                  : <span style={{ color: 'var(--text-4)' }}>{Math.abs(r.overdueDays)}d left</span>}
              </td>
              <td><Pill s={r.status} /></td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      {rows.length === 0 && <Empty msg={`No open ${book.toLowerCase()}`} />}
      <Pager {...paged} />
    </div>
  )
}
