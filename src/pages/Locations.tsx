import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Store, Warehouse, SprayCan, Truck, Package } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Pager, usePaged, Empty, useChartTheme } from '@/components/ui'
import { LOCATION_STOCK, locTotals, weightAt } from '@/data/positions'
import { CATEGORIES } from '@/data/catalogue'
import { csvDownload, cn } from '@/lib/utils'

const NODES = [
  { key: 'shop',      label: 'Shop',           icon: Store,     tone: 'brand'  as const },
  { key: 'gd1',       label: 'Godown 1',       icon: Warehouse, tone: 'sky'    as const },
  { key: 'gd2',       label: 'Godown 2 (4F)',  icon: Warehouse, tone: 'violet' as const },
  { key: 'atPcu1',    label: 'At PCU1',        icon: SprayCan,  tone: 'amber'  as const },
  { key: 'atPcu2',    label: 'At PCU2',        icon: SprayCan,  tone: 'amber'  as const },
  { key: 'inTransit', label: 'In Transit',     icon: Truck,     tone: 'red'    as const },
] as const

export default function Locations() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All Categories')
  const [node, setNode] = useState('All Nodes')
  const t = useChartTheme()

  const rows = useMemo(() => LOCATION_STOCK.filter(l =>
    (cat === 'All Categories' || l.category === cat) &&
    (node === 'All Nodes'
      || (node === 'Shop' && l.shop > 0)
      || (node === 'Godown 1' && l.gd1 > 0)
      || (node === 'Godown 2 (4F)' && l.gd2 > 0)
      || (node === 'At Coaters' && (l.atPcu1 + l.atPcu2) > 0)
      || (node === 'In Transit' && l.inTransit > 0)) &&
    (q === '' || `${l.code} ${l.name}`.toLowerCase().includes(q.toLowerCase())),
  ).sort((a, b) => b.total - a.total), [q, cat, node])

  const paged = usePaged(rows, 12)

  const byCategory = CATEGORIES.map(c => {
    const items = LOCATION_STOCK.filter(l => l.category === c)
    return {
      name: c,
      Shop: items.reduce((s, l) => s + l.shop, 0),
      'Godown 1': items.reduce((s, l) => s + l.gd1, 0),
      'Godown 2': items.reduce((s, l) => s + l.gd2, 0),
      'At Coaters': items.reduce((s, l) => s + l.atPcu1 + l.atPcu2, 0),
    }
  }).filter(c => c.Shop + c['Godown 1'] + c['Godown 2'] + c['At Coaters'] > 0)

  const exportCsv = () => csvDownload('vsa-location-stock.csv', [
    ['Code', 'Product', 'Category', 'Shop', 'Godown 1', 'Godown 2 (4F)', 'At Stores', 'At PCU1', 'At PCU2', 'In Transit', 'Total Nos', 'Weight at Stores (kg)', 'Min Stock', '15-Day Need', 'Cover Days'],
    ...rows.map(l => [l.code, l.name, l.category, l.shop, l.gd1, l.gd2, l.atStores, l.atPcu1, l.atPcu2, l.inTransit, l.total, l.kgAtStores, l.minStock, l.days15, l.coverDays === 999 ? '—' : l.coverDays]),
  ])

  return (
    <div>
      <PageHead title="Location Stock" sub="Every piece the business owns, wherever it is sitting — shop, godowns, coaters or on the road">
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        {NODES.map(n => (
          <Stat key={n.key} label={n.label}
            value={locTotals(n.key).toLocaleString('en-IN')}
            sub={`${weightAt(n.key).toLocaleString('en-IN')} kg`}
            icon={n.icon} tone={n.tone} />
        ))}
      </div>

      <div className="card mb-5">
        <p className="section-title text-base mb-1">Where Each Category Sits</p>
        <p className="section-sub mb-3">Pieces held at each node</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={byCategory} margin={{ left: -6, bottom: 32 }} barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ ...t.tick, fontSize: 9 }} axisLine={false} tickLine={false} angle={-28} textAnchor="end" interval={0} height={64} />
            <YAxis tick={t.tick} axisLine={false} tickLine={false} width={50} />
            <Tooltip contentStyle={t.tooltip} formatter={(v: number, n) => [v.toLocaleString('en-IN') + ' nos', n]} cursor={{ fill: 'rgba(15,91,143,.06)' }} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />
            <Bar dataKey="Shop"        stackId="a" fill="#0f5b8f" isAnimationActive={false} />
            <Bar dataKey="Godown 1"    stackId="a" fill="#2b8fd4" isAnimationActive={false} />
            <Bar dataKey="Godown 2"    stackId="a" fill="#8b5cf6" isAnimationActive={false} />
            <Bar dataKey="At Coaters"  stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search code or product…" />
        <Select value={cat} onChange={setCat} options={['All Categories', ...CATEGORIES]} />
        <Select value={node} onChange={setNode} options={['All Nodes', 'Shop', 'Godown 1', 'Godown 2 (4F)', 'At Coaters', 'In Transit']} />
      </div>

      <TableCard>
        <thead>
          <tr>
            <th>Code</th><th>Product</th>
            <th className="num">Shop</th><th className="num">GD1</th><th className="num">GD2</th>
            <th className="num">PCU1</th><th className="num">PCU2</th><th className="num">Transit</th>
            <th className="num">Total</th><th className="num">Weight</th><th className="num">Cover</th>
          </tr>
        </thead>
        <tbody>
          {paged.slice.map(l => (
            <tr key={l.code}>
              <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{l.code}</td>
              <td className="font-medium max-w-[14rem] truncate" style={{ color: 'var(--text-1)' }}>{l.name}</td>
              <td className="num tabular-nums">{l.shop}</td>
              <td className="num tabular-nums">{l.gd1}</td>
              <td className="num tabular-nums">{l.gd2}</td>
              <td className={cn('num tabular-nums', l.atPcu1 > 0 && 'text-amber-600 font-medium')}>{l.atPcu1 || '—'}</td>
              <td className={cn('num tabular-nums', l.atPcu2 > 0 && 'text-amber-600 font-medium')}>{l.atPcu2 || '—'}</td>
              <td className={cn('num tabular-nums', l.inTransit > 0 && 'text-sky-600 font-medium')}>{l.inTransit || '—'}</td>
              <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{l.total.toLocaleString('en-IN')}</td>
              <td className="num tabular-nums text-xs">{l.kgAtStores.toLocaleString('en-IN')} kg</td>
              <td className={cn('num tabular-nums text-xs', l.coverDays < 15 && 'text-red-500 font-semibold')}>
                {l.coverDays === 999 ? '—' : `${l.coverDays}d`}
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      {rows.length === 0 && <Empty msg="Nothing held at this node" />}
      <Pager {...paged} />

      <p className="text-[11px] mt-3 flex items-start gap-1.5" style={{ color: 'var(--text-4)' }}>
        <Package size={12} className="mt-0.5 shrink-0" />
        Shop, Godown 1 and Godown 2 add up to owned stock on the Inventory screen. PCU and transit quantities are
        additional — the business owns them, but they are not available to sell until the coater returns them.
      </p>
    </div>
  )
}
