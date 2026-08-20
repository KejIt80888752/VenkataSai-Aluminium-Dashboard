import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, Receipt, Users, Scale } from 'lucide-react'
import { PageHead, Stat, ExportBtn, TableCard, useChartTheme, SERIES } from '@/components/ui'
import { monthlySales, TOTALS, INVOICES, salesByCategory, topProducts, topClients } from '@/data/txns'
import { CLIENTS } from '@/data/parties'
import { inr, inrShort, csvDownload } from '@/lib/utils'
import { FY } from '@/data/company'

export default function SalesReports() {
  const t = useChartTheme()

  const byType = ['B2B Fabricator', 'Builder / Contractor', 'Dealer', 'B2C Retail'].map(type => {
    const ids = new Set(CLIENTS.filter(c => c.type === type).map(c => c.id))
    return { name: type, value: Math.round(INVOICES.filter(i => ids.has(i.clientId)).reduce((s, i) => s + i.taxable, 0)) }
  }).filter(x => x.value > 0)

  const avgBill = TOTALS.revenue / INVOICES.length
  const kgSold  = topProducts.filter(p => p.unit === 'kg').reduce((s, p) => s + p.qty, 0)

  const exportCsv = () => csvDownload('vsa-sales-summary.csv', [
    ['Month', 'Invoices', 'Revenue (Taxable)', 'COGS', 'Gross Profit', 'Margin %'],
    ...monthlySales.map(m => [m.m, m.invoices, m.revenue, m.cogs, m.grossProfit, ((m.grossProfit / m.revenue) * 100).toFixed(1)]),
    [], ['Top Products'], ['Code', 'Product', 'Qty', 'Unit', 'Value'],
    ...topProducts.map(p => [p.code, p.name, p.qty, p.unit, p.value]),
  ])

  return (
    <div>
      <PageHead title="Sales Reports" sub={`Turnover analysis by month, category, product and customer segment · ${FY}`}>
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Taxable Turnover" value={inr(TOTALS.revenue)}   icon={TrendingUp} tone="brand"  sub={FY} />
        <Stat label="Invoices"         value={String(INVOICES.length)} icon={Receipt}  tone="sky"    sub={`Avg bill ${inr(avgBill)}`} />
        <Stat label="Active Customers" value={String(topClients.length)} icon={Users}  tone="violet" sub="Billed at least once" />
        <Stat label="Metal Moved"      value={`${Math.round(kgSold).toLocaleString('en-IN')} kg`} icon={Scale} tone="green" sub="Sections + sheets sold" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
        <div className="card xl:col-span-2">
          <p className="section-title text-base mb-1">Monthly Turnover Trend</p>
          <p className="section-sub mb-3">Revenue against cost of goods sold</p>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlySales} margin={{ left: -6, right: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
              <XAxis dataKey="m" tick={t.tick} axisLine={false} tickLine={false} />
              <YAxis tick={t.tick} axisLine={false} tickLine={false} tickFormatter={inrShort} width={62} />
              <Tooltip contentStyle={t.tooltip} formatter={(v: number, n) => [inr(v), n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />
              <Line isAnimationActive={false} type="monotone" dataKey="revenue"     name="Revenue"      stroke="#0f5b8f" strokeWidth={2.5} dot={{ r: 3.5 }} />
              <Line isAnimationActive={false} type="monotone" dataKey="cogs"        name="COGS"         stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} />
              <Line isAnimationActive={false} type="monotone" dataKey="grossProfit" name="Gross Profit" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3.5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <p className="section-title text-base mb-1">Turnover by Customer Type</p>
          <p className="section-sub mb-2">Where the volume comes from</p>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie isAnimationActive={false} data={byType} dataKey="value" nameKey="name" innerRadius={44} outerRadius={74} paddingAngle={2} stroke="none">
                {byType.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
              </Pie>
              <Tooltip contentStyle={t.tooltip} formatter={(v: number) => inr(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {byType.map((c, i) => (
              <div key={c.name} className="flex items-center gap-2 text-[11px]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SERIES[i % SERIES.length] }} />
                <span className="flex-1 truncate" style={{ color: 'var(--text-3)' }}>{c.name}</span>
                <span className="font-medium tabular-nums" style={{ color: 'var(--text-2)' }}>{inr(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card">
          <p className="section-title text-base mb-1">Revenue by Product Category</p>
          <p className="section-sub mb-3">Taxable value, {FY}</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={salesByCategory} layout="vertical" margin={{ left: 40, right: 16 }} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} horizontal={false} />
              <XAxis type="number" tick={t.tick} axisLine={false} tickLine={false} tickFormatter={inrShort} />
              <YAxis type="category" dataKey="name" tick={{ ...t.tick, fontSize: 10 }} axisLine={false} tickLine={false} width={128} />
              <Tooltip contentStyle={t.tooltip} formatter={(v: number) => [inr(v), 'Revenue']} cursor={{ fill: 'rgba(15,91,143,.06)' }} />
              <Bar isAnimationActive={false} dataKey="value" fill="#0f5b8f" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <p className="section-title text-base mb-1">Top Selling Products</p>
          <p className="section-sub mb-3">Ranked by taxable value</p>
          <TableCard maxH="18rem">
            <thead><tr><th>Code</th><th>Product</th><th className="num">Qty Sold</th><th className="num">Value</th></tr></thead>
            <tbody>
              {topProducts.slice(0, 14).map(p => (
                <tr key={p.code}>
                  <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{p.code}</td>
                  <td className="max-w-[14rem] truncate">{p.name}</td>
                  <td className="num tabular-nums text-xs">{p.qty.toLocaleString('en-IN')} {p.unit}</td>
                  <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        </div>
      </div>
    </div>
  )
}
