import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, IndianRupee, Percent, Receipt } from 'lucide-react'
import { PageHead, Stat, ExportBtn, useChartTheme } from '@/components/ui'
import { monthlySales, TOTALS, OVERHEADS, MONTHLY_OVERHEAD, MONTHS } from '@/data/txns'
import { inr, inrShort, csvDownload } from '@/lib/utils'
import { FY } from '@/data/company'

export default function ProfitLoss() {
  const t = useChartTheme()
  const months = MONTHS.length
  const totalOverhead = MONTHLY_OVERHEAD * months
  const netProfit = TOTALS.grossProfit - totalOverhead
  const grossMargin = (TOTALS.grossProfit / TOTALS.revenue) * 100
  const netMargin   = (netProfit / TOTALS.revenue) * 100

  const exportCsv = () => csvDownload('vsa-profit-and-loss.csv', [
    ['Profit & Loss', FY],
    [], ['Month', 'Revenue', 'COGS', 'Gross Profit', 'Overheads', 'Net Profit'],
    ...monthlySales.map(m => [m.m, m.revenue, m.cogs, m.grossProfit, MONTHLY_OVERHEAD, m.netProfit]),
    [], ['Overhead Head', 'Per Month', `${months} Months`],
    ...Object.entries(OVERHEADS).map(([k, v]) => [k, v, v * months]),
    [], ['Total Revenue', TOTALS.revenue], ['Total COGS', TOTALS.cogs],
    ['Gross Profit', TOTALS.grossProfit], ['Total Overheads', totalOverhead], ['Net Profit', netProfit],
  ])

  return (
    <div>
      <PageHead title="Profit & Loss" sub={`Trading account and operating result · ${FY} (April–August, month-to-date)`}>
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Revenue"      value={inr(TOTALS.revenue)}     icon={IndianRupee} tone="brand"  sub="Taxable turnover" />
        <Stat label="Gross Profit" value={inr(TOTALS.grossProfit)} icon={TrendingUp}  tone="green"  sub={`${grossMargin.toFixed(1)}% margin`} />
        <Stat label="Overheads"    value={inr(totalOverhead)}      icon={Receipt}     tone="amber"  sub={`${inr(MONTHLY_OVERHEAD)} per month`} />
        <Stat label="Net Profit"   value={inr(netProfit)}          icon={Percent}     tone={netProfit >= 0 ? 'violet' : 'red'} sub={`${netMargin.toFixed(1)}% net margin`} />
      </div>

      <div className="card mb-5">
        <p className="section-title text-base mb-1">Monthly Result</p>
        <p className="section-sub mb-3">Bars show revenue and cost; the line is net profit after overheads</p>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={monthlySales} margin={{ left: -4, right: 6 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
            <XAxis dataKey="m" tick={t.tick} axisLine={false} tickLine={false} />
            <YAxis tick={t.tick} axisLine={false} tickLine={false} tickFormatter={inrShort} width={62} />
            <Tooltip contentStyle={t.tooltip} formatter={(v: number, n) => [inr(v), n]} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />
            <Bar isAnimationActive={false} dataKey="revenue" name="Revenue" fill="#0f5b8f" radius={[4, 4, 0, 0]} barSize={22} />
            <Bar isAnimationActive={false} dataKey="cogs"    name="COGS"    fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={22} />
            <Line isAnimationActive={false} type="monotone" dataKey="netProfit" name="Net Profit" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Statement */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4">
            <p className="section-title text-base">Statement of Profit & Loss</p>
            <p className="section-sub">{FY} · figures in ₹</p>
          </div>
          <table className="tbl">
            <tbody>
              <PLRow k="Sales / Turnover (taxable)" v={TOTALS.revenue} />
              <PLRow k="Less: Cost of Goods Sold"   v={-TOTALS.cogs} />
              <PLRow k="Gross Profit"               v={TOTALS.grossProfit} bold />
              <tr><td colSpan={2} className="pt-4 pb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>Operating Expenses</td></tr>
              {Object.entries(OVERHEADS).map(([k, v]) => <PLRow key={k} k={k} v={-(v * months)} indent />)}
              <PLRow k="Total Operating Expenses"   v={-totalOverhead} bold />
              <PLRow k="Net Profit before Tax"      v={netProfit} bold highlight />
            </tbody>
          </table>
        </div>

        {/* Monthly table */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4">
            <p className="section-title text-base">Month-wise Breakdown</p>
            <p className="section-sub">Gross and net profit per month</p>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Month</th><th className="num">Revenue</th><th className="num">COGS</th><th className="num">Gross</th><th className="num">Net</th><th className="num">GP%</th></tr></thead>
              <tbody>
                {monthlySales.map(m => (
                  <tr key={m.m}>
                    <td className="font-medium" style={{ color: 'var(--text-1)' }}>{m.m}</td>
                    <td className="num tabular-nums">{inr(m.revenue)}</td>
                    <td className="num tabular-nums text-xs">{inr(m.cogs)}</td>
                    <td className="num tabular-nums text-green-600 font-medium">{inr(m.grossProfit)}</td>
                    <td className={`num tabular-nums font-medium ${m.netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{inr(m.netProfit)}</td>
                    <td className="num tabular-nums text-xs">{((m.grossProfit / m.revenue) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--bg-card2)' }}>
                  <td className="font-bold" style={{ color: 'var(--text-1)' }}>Total</td>
                  <td className="num tabular-nums font-bold" style={{ color: 'var(--text-1)' }}>{inr(TOTALS.revenue)}</td>
                  <td className="num tabular-nums font-bold text-xs" style={{ color: 'var(--text-1)' }}>{inr(TOTALS.cogs)}</td>
                  <td className="num tabular-nums font-bold text-green-600">{inr(TOTALS.grossProfit)}</td>
                  <td className={`num tabular-nums font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{inr(netProfit)}</td>
                  <td className="num tabular-nums font-bold text-xs" style={{ color: 'var(--text-1)' }}>{grossMargin.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function PLRow({ k, v, bold, indent, highlight }: { k: string; v: number; bold?: boolean; indent?: boolean; highlight?: boolean }) {
  return (
    <tr style={highlight ? { background: 'var(--bg-card2)' } : undefined}>
      <td className={`${bold ? 'font-bold' : ''} ${indent ? 'pl-8' : ''}`} style={{ color: bold ? 'var(--text-1)' : 'var(--text-2)' }}>{k}</td>
      <td className={`num tabular-nums ${bold ? 'font-bold' : ''} ${v < 0 ? 'text-red-500' : v > 0 && bold ? 'text-green-600' : ''}`}
        style={!bold && v >= 0 ? { color: 'var(--text-1)' } : undefined}>
        {v < 0 ? `(${inr(-v)})` : inr(v)}
      </td>
    </tr>
  )
}
