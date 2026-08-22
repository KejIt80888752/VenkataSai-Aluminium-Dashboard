import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  IndianRupee, TrendingUp, Wallet, Warehouse, AlertTriangle,
  CheckCircle2, PackageX, ArrowUpRight, Clock, SprayCan, Truck, Scale, ScanLine,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Stat, useChartTheme, SERIES, Pill } from '@/components/ui'
import { inr, inrShort, fmtDate } from '@/lib/utils'
import { FY, TODAY } from '@/data/company'
import { P, isLow, stockValue, stockQty } from '@/data/catalogue'
import {
  monthlySales, TOTALS, INVOICES, salesByCategory, topClients, LEADS, QUOTATIONS,
} from '@/data/txns'
import { COATING_TOTALS, IN_TRANSIT } from '@/data/challans'
import { PCU_OUTSTANDING, below15Days, PURCHASE_ORDERS } from '@/data/positions'
import { AI_SUMMARY } from '@/data/aidocs'
import { RECON_SUMMARY } from '@/data/gst2b'

export default function Dashboard() {
  const t = useChartTheme()

  const stockTotal   = P.reduce((s, p) => s + stockValue(p), 0)
  const stockKg      = P.filter(p => p.unit === 'kg').reduce((s, p) => s + stockQty(p), 0)
  const lowItems     = P.filter(isLow)
  const overdue      = INVOICES.filter(i => i.status === 'Overdue')
  const overdueAmt   = overdue.reduce((s, i) => s + (i.total - i.received), 0)
  const marginPct    = (TOTALS.grossProfit / TOTALS.revenue) * 100
  const recent       = [...INVOICES].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)
  const openLeads    = LEADS.filter(l => l.stage !== 'Converted' && l.stage !== 'Dropped')
  const wonQuotes    = QUOTATIONS.filter(q => q.status === 'Won')
  const quoteWinRate = Math.round((wonQuotes.length / QUOTATIONS.length) * 100)

  const pcuPendingNos = PCU_OUTSTANDING.reduce((s, p) => s + p.nos, 0)
  const pcuPendingKg  = +PCU_OUTSTANDING.reduce((s, p) => s + p.kg, 0).toFixed(1)
  const transitNos    = IN_TRANSIT.reduce((s, d) => s + d.totalNos, 0)
  const openPos       = PURCHASE_ORDERS.filter(p => p.status !== 'Closed').length

  const lastM = monthlySales[monthlySales.length - 2]
  const thisM = monthlySales[monthlySales.length - 1]

  const alerts = [
    ...lowItems.slice(0, 3).map(p => ({
      warn: true, msg: `${p.name} (${p.code}) down to ${p.stockPcs} pcs — reorder level ${p.reorderPcs}`,
    })),
    overdue.length ? { warn: true, msg: `${overdue.length} invoices overdue · ${inr(overdueAmt)} to be recovered` } : null,
    { warn: false, msg: `GST input credit of ${inr(TOTALS.inputGst)} available against output tax` },
    { warn: false, msg: `${wonQuotes.length} of ${QUOTATIONS.length} quotations converted this year (${quoteWinRate}%)` },
    pcuPendingNos ? { warn: true, msg: `${pcuPendingNos.toLocaleString('en-IN')} pcs (${pcuPendingKg.toLocaleString('en-IN')} kg) still lying at the powder coaters` } : null,
    below15Days.length ? { warn: true, msg: `${below15Days.length} items will not last 15 days at the current sales rate` } : null,
    RECON_SUMMARY.creditAtRisk > 0 ? { warn: true, msg: `${inr(RECON_SUMMARY.creditAtRisk)} of input credit not yet confirmed in GSTR-2B` } : null,
  ].filter(Boolean) as { warn: boolean; msg: string }[]

  return (
    <div className="space-y-5">

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat label="Revenue (Taxable)" value={inr(TOTALS.revenue)} sub={`${INVOICES.length} invoices · ${FY}`}
          icon={IndianRupee} tone="brand" />
        <Stat label="Gross Profit" value={inr(TOTALS.grossProfit)} sub={`${marginPct.toFixed(1)}% margin`}
          icon={TrendingUp} tone="green" />
        <Stat label="Receivables Outstanding" value={inr(TOTALS.receivable)} sub={`${inr(overdueAmt)} overdue`}
          icon={Wallet} tone="red" />
        <Stat label="Stock on Hand" value={inr(stockTotal)} sub={`${Math.round(stockKg).toLocaleString('en-IN')} kg of sections`}
          icon={Warehouse} tone="violet" />
      </div>

      {/* Material flow strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Link to="/material-flow" className="block">
          <Stat label="At Powder Coaters" value={`${pcuPendingNos.toLocaleString('en-IN')} nos`}
            sub={`${pcuPendingKg.toLocaleString('en-IN')} kg across PCU1 and PCU2`} icon={SprayCan} tone="amber" />
        </Link>
        <Link to="/challans" className="block">
          <Stat label="In Transit" value={`${transitNos.toLocaleString('en-IN')} nos`}
            sub={`${IN_TRANSIT.length} challans on the road`} icon={Truck} tone="sky" />
        </Link>
        <Link to="/coating-recon" className="block">
          <Stat label="Coating Weight Gain" value={`${COATING_TOTALS.gainKg.toLocaleString('en-IN')} kg`}
            sub={`${COATING_TOTALS.outOfTolerance} jobs outside tolerance`} icon={Scale} tone="green" />
        </Link>
        <Link to="/ai-capture" className="block">
          <Stat label="AI Capture" value={`${AI_SUMMARY.straightThroughPct}% auto`}
            sub={`${AI_SUMMARY.needsReview} bills waiting for review`} icon={ScanLine} tone="violet" />
        </Link>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card xl:col-span-2">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="section-title text-base">Revenue, Cost & Profit</p>
              <p className="section-sub">Monthly · {FY} (August is month-to-date)</p>
            </div>
            <span className="badge-brand">{FY}</span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={monthlySales} margin={{ left: -8, right: 6, top: 4 }}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f5b8f" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#0f5b8f" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gProf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
              <XAxis dataKey="m" tick={t.tick} axisLine={false} tickLine={false} />
              <YAxis tick={t.tick} axisLine={false} tickLine={false} tickFormatter={inrShort} width={64} />
              <Tooltip contentStyle={t.tooltip} formatter={(v: number, n) => [inr(v), n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />
              <Area isAnimationActive={false} type="monotone" dataKey="revenue"     name="Revenue"      stroke="#0f5b8f" strokeWidth={2.5} fill="url(#gRev)"  dot={{ r: 3, fill: '#0f5b8f', strokeWidth: 0 }} />
              <Area isAnimationActive={false} type="monotone" dataKey="grossProfit" name="Gross Profit" stroke="#16a34a" strokeWidth={2}   fill="url(#gProf)" dot={{ r: 3, fill: '#16a34a', strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <p className="section-title text-base mb-1">Sales Mix by Category</p>
          <p className="section-sub mb-2">Share of taxable turnover</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie isAnimationActive={false} data={salesByCategory} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="none">
                {salesByCategory.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
              </Pie>
              <Tooltip contentStyle={t.tooltip} formatter={(v: number) => inr(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {salesByCategory.slice(0, 5).map((c, i) => (
              <div key={c.name} className="flex items-center gap-2 text-[11px]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SERIES[i % SERIES.length] }} />
                <span className="flex-1 truncate" style={{ color: 'var(--text-3)' }}>{c.name}</span>
                <span className="font-medium tabular-nums" style={{ color: 'var(--text-2)' }}>{inr(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card">
          <p className="section-title text-base mb-1">Purchases vs Sales</p>
          <p className="section-sub mb-3">Monthly buying against selling</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlySales} barSize={14} margin={{ left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
              <XAxis dataKey="m" tick={t.tick} axisLine={false} tickLine={false} />
              <YAxis tick={t.tick} axisLine={false} tickLine={false} tickFormatter={inrShort} width={60} />
              <Tooltip contentStyle={t.tooltip} formatter={(v: number, n) => [inr(v), n]} />
              <Bar isAnimationActive={false} dataKey="purchases" name="Purchases" fill="#94a3b8" radius={[3, 3, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="revenue"   name="Sales"     fill="#0f5b8f" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="section-title text-base">Top Customers</p>
              <p className="section-sub">By taxable turnover, {FY}</p>
            </div>
            <Link to="/clients" className="text-xs text-brand font-medium hover:underline flex items-center gap-1">
              All customers <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {topClients.slice(0, 6).map((c, i) => (
              <div key={c.name}>
                <div className="flex items-center justify-between text-sm mb-1.5 gap-3">
                  <span className="truncate" style={{ color: 'var(--text-2)' }}>
                    <span className="mr-2 font-mono text-xs" style={{ color: 'var(--text-4)' }}>{String(i + 1).padStart(2, '0')}</span>
                    {c.name}
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>{c.bills} bills</span>
                    <span className="text-brand font-semibold text-sm tabular-nums">{inr(c.value)}</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div className="h-full bg-brand rounded-full" style={{ width: `${(c.value / topClients[0].value) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Third row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card xl:col-span-2 p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="section-title text-base">Recent Invoices</p>
              <p className="section-sub">Latest billing activity</p>
            </div>
            <Link to="/billing" className="text-xs text-brand font-medium hover:underline flex items-center gap-1">
              Open register <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th className="num">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {recent.map(i => (
                  <tr key={i.id}>
                    <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{i.no}</td>
                    <td className="whitespace-nowrap">{fmtDate(i.date)}</td>
                    <td className="max-w-[14rem] truncate">{i.clientName}</td>
                    <td className="num font-semibold tabular-nums" style={{ color: 'var(--text-1)' }}>{inr(i.total)}</td>
                    <td><Pill s={i.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <p className="section-title text-sm mb-3">Alerts & Actions</p>
            <ul className="space-y-2.5">
              {alerts.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>
                  {a.warn
                    ? <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                    : <CheckCircle2 size={13} className="text-green-500 mt-0.5 shrink-0" />}
                  {a.msg}
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <p className="section-title text-sm mb-3">This Month at a Glance</p>
            <div className="space-y-2.5 text-xs">
              <Row label="Aug billing (MTD)" value={inr(thisM.revenue)} />
              <Row label="July billing"      value={inr(lastM.revenue)} />
              <Row label="Open leads"        value={`${openLeads.length}`} icon={Clock} />
              <Row label="Low-stock items"   value={`${lowItems.length}`}  icon={PackageX} danger={lowItems.length > 0} />
              <Row label="Supplier payable"  value={inr(TOTALS.payable)} />
              <Row label="Open purchase orders" value={`${openPos}`} />
              <Row label="GST match rate"    value={`${RECON_SUMMARY.matchRate}%`} />
              <Row label="As on"             value={fmtDate(TODAY)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, icon: Icon, danger }: { label: string; value: string; icon?: typeof Clock; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
        {Icon && <Icon size={12} />}{label}
      </span>
      <span className={`font-semibold tabular-nums ${danger ? 'text-amber-600' : ''}`}
        style={danger ? undefined : { color: 'var(--text-1)' }}>{value}</span>
    </div>
  )
}
