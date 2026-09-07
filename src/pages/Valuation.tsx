import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Scale, IndianRupee, TrendingUp, Layers } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Empty, useChartTheme, SERIES } from '@/components/ui'
import { P, CATEGORIES } from '@/data/catalogue'
import { LOTS } from '@/data/lots'
import { INVOICES } from '@/data/txns'
import { inr, inr2, kg as kgFmt, csvDownload, cn } from '@/lib/utils'
import { FY } from '@/data/company'

/* ── What the stock is actually worth ──────────────────────────────────────
   Aluminium is bought at a different rate almost every load, so a single
   "cost price" on the item master is out of date the day it is typed. The
   average is taken across the lots still on hand — weighted by how much of
   each is left, not by how many lots there were.                          */

interface Row {
  code: string
  name: string
  category: string
  unit: string
  nos: number
  kgOnHand: number
  avgCostPerKg: number
  avgCostPerPiece: number
  sellingPerKg: number
  stockValue: number
  soldKg: number
  soldValue: number
  soldCost: number
  grossProfit: number
  marginPct: number
}

export default function Valuation() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All Categories')
  const [sort, setSort] = useState('Stock value')
  const t = useChartTheme()

  const rows: Row[] = useMemo(() => P.map(p => {
    const lots = LOTS.filter(l => l.code === p.code && l.remainingNos > 0)

    // Weighted by what is left of each lot, not by the number of lots.
    const kgOnHand = +lots.reduce((s, l) => s + l.remainingNos * l.kgPerPiece, 0).toFixed(1)
    const nos = lots.reduce((s, l) => s + l.remainingNos, 0) || p.stockPcs
    const costOnHand = lots.reduce((s, l) => s + l.remainingNos * l.kgPerPiece * p.costPerKg, 0)

    const kg = kgOnHand > 0 ? kgOnHand : +(p.stockPcs * p.kgPerLength).toFixed(1)
    const avgCostPerKg = kg > 0 && costOnHand > 0 ? +(costOnHand / kg).toFixed(2) : p.costPerKg
    const stockValue = Math.round(kg * avgCostPerKg)

    // What has actually gone out, from the invoice book.
    let soldKg = 0, soldValue = 0
    for (const inv of INVOICES) for (const l of inv.lines) {
      if (l.code !== p.code) continue
      soldValue += l.amount
      soldKg += l.unit === 'kg' ? l.qty : l.qty * p.kgPerLength
    }
    const soldCost = Math.round(soldKg * avgCostPerKg)
    const grossProfit = Math.round(soldValue - soldCost)

    return {
      code: p.code, name: p.name, category: p.category, unit: p.unit,
      nos, kgOnHand: kg, avgCostPerKg,
      avgCostPerPiece: +(avgCostPerKg * p.kgPerLength).toFixed(2),
      sellingPerKg: p.ratePerKg,
      stockValue,
      soldKg: +soldKg.toFixed(1), soldValue: Math.round(soldValue), soldCost, grossProfit,
      marginPct: soldValue > 0 ? +((grossProfit / soldValue) * 100).toFixed(1) : 0,
    }
  }), [])

  const shown = useMemo(() => rows
    .filter(r => (cat === 'All Categories' || r.category === cat) &&
      (q === '' || `${r.code} ${r.name}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => sort === 'Stock value' ? b.stockValue - a.stockValue
      : sort === 'Gross profit' ? b.grossProfit - a.grossProfit
      : sort === 'Margin' ? b.marginPct - a.marginPct
      : a.name.localeCompare(b.name)),
  [rows, q, cat, sort])

  const totalValue = rows.reduce((s, r) => s + r.stockValue, 0)
  const totalKg = +rows.reduce((s, r) => s + r.kgOnHand, 0).toFixed(1)
  const totalProfit = rows.reduce((s, r) => s + r.grossProfit, 0)
  const totalSold = rows.reduce((s, r) => s + r.soldValue, 0)
  const blendedCost = totalKg > 0 ? +(totalValue / totalKg).toFixed(2) : 0

  const byCategory = useMemo(() => CATEGORIES
    .map(c => ({ name: c, value: rows.filter(r => r.category === c).reduce((s, r) => s + r.stockValue, 0) }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value), [rows])

  const exportCsv = () => csvDownload('vsa-stock-valuation.csv', [
    ['Stock valuation at average cost', FY],
    [], ['Total stock value', totalValue], ['Total weight', totalKg], ['Blended cost per kg', blendedCost],
    [], ['Code', 'Item', 'Category', 'Pieces', 'Kg On Hand', 'Avg Cost/Kg', 'Avg Cost/Piece',
         'Selling/Kg', 'Stock Value', 'Sold Kg', 'Sold Value', 'Cost of Sales', 'Gross Profit', 'Margin %'],
    ...shown.map(r => [r.code, r.name, r.category, r.nos, r.kgOnHand, r.avgCostPerKg, r.avgCostPerPiece,
                       r.sellingPerKg, r.stockValue, r.soldKg, r.soldValue, r.soldCost, r.grossProfit, r.marginPct]),
  ])

  return (
    <div>
      <PageHead title="Stock Valuation" sub="Average cost across the lots still on hand, in kilograms and in pieces">
        <SearchBox value={q} onChange={setQ} placeholder="Search code or item…" />
        <Select value={cat} onChange={setCat} options={['All Categories', ...CATEGORIES]} />
        <Select value={sort} onChange={setSort} options={['Stock value', 'Gross profit', 'Margin', 'Name']} />
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Stock Value" value={inr(totalValue)} icon={IndianRupee} tone="brand" sub="At average cost" />
        <Stat label="Weight on Hand" value={kgFmt(totalKg)} icon={Scale} tone="violet"
          sub={`${rows.reduce((s, r) => s + r.nos, 0).toLocaleString('en-IN')} pieces`} />
        <Stat label="Blended Cost" value={`${inr2(blendedCost)}/kg`} icon={Layers} tone="sky"
          sub="Across everything on the racks" />
        <Stat label="Gross Profit" value={inr(totalProfit)} icon={TrendingUp}
          tone={totalProfit > 0 ? 'green' : 'red'}
          sub={totalSold ? `${Math.round(totalProfit / totalSold * 100)}% on ${inr(totalSold)} sold` : '—'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
        <div className="card">
          <p className="section-title text-base mb-1">Where the Money Is Sitting</p>
          <p className="section-sub mb-2">Stock value by category</p>
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={46} outerRadius={78}
                paddingAngle={2} stroke="none" isAnimationActive={false}>
                {byCategory.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
              </Pie>
              <Tooltip contentStyle={t.tooltip} formatter={(v: number) => inr(v)} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card xl:col-span-2">
          <p className="section-title text-base mb-1">Both Units, Side by Side</p>
          <p className="section-sub mb-3">
            Aluminium is bought by weight and often sold by the piece, so the cost has to read both ways.
          </p>
          <div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--border-2)', maxHeight: '15rem' }}>
            <table className="tbl">
              <thead><tr><th>Item</th><th className="num">Pieces</th><th className="num">Kg</th>
                <th className="num">Cost / Kg</th><th className="num">Cost / Piece</th><th className="num">Value</th></tr></thead>
              <tbody>
                {shown.slice(0, 12).map(r => (
                  <tr key={r.code}>
                    <td className="text-xs max-w-[15rem] truncate" title={r.name}>{r.name}</td>
                    <td className="num tabular-nums text-xs">{r.nos}</td>
                    <td className="num tabular-nums text-xs">{r.kgOnHand.toLocaleString('en-IN')}</td>
                    <td className="num tabular-nums text-xs">{inr2(r.avgCostPerKg)}</td>
                    <td className="num tabular-nums text-xs">{r.avgCostPerPiece ? inr2(r.avgCostPerPiece) : '—'}</td>
                    <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{inr(r.stockValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="section-title text-base mb-1">Item by Item</p>
      <p className="section-sub mb-3">Cost of sales uses the same average, so the profit is the real one</p>
      <TableCard maxH="30rem">
        <thead>
          <tr><th>Code</th><th>Item</th><th className="num">On Hand</th><th className="num">Avg Cost/Kg</th>
            <th className="num">Selling/Kg</th><th className="num">Stock Value</th>
            <th className="num">Sold</th><th className="num">Gross Profit</th><th className="num">Margin</th></tr>
        </thead>
        <tbody>
          {shown.map(r => (
            <tr key={r.code}>
              <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{r.code}</td>
              <td className="text-xs max-w-[16rem] truncate" title={r.name}>{r.name}</td>
              <td className="num tabular-nums text-xs">{r.nos} pcs<br />
                <span style={{ color: 'var(--text-4)' }}>{r.kgOnHand.toLocaleString('en-IN')} kg</span></td>
              <td className="num tabular-nums">{inr2(r.avgCostPerKg)}</td>
              <td className="num tabular-nums text-xs">{inr2(r.sellingPerKg)}</td>
              <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(r.stockValue)}</td>
              <td className="num tabular-nums text-xs">{r.soldValue ? inr(r.soldValue) : '—'}</td>
              <td className={cn('num tabular-nums font-medium')}
                style={{ color: r.grossProfit > 0 ? 'var(--green)' : r.grossProfit < 0 ? 'var(--red)' : 'var(--text-4)' }}>
                {r.soldValue ? inr(r.grossProfit) : '—'}
              </td>
              <td className="num tabular-nums text-xs"
                style={{ color: r.marginPct < 8 && r.soldValue ? 'var(--red)' : undefined }}>
                {r.soldValue ? `${r.marginPct}%` : '—'}
              </td>
            </tr>
          ))}
          {shown.length === 0 && <tr><td colSpan={9}><Empty msg="Nothing matches" /></td></tr>}
        </tbody>
      </TableCard>
    </div>
  )
}
