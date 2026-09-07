import { useState, useMemo } from 'react'
import { Layers, Calculator, Package, Ruler, CircleAlert, Boxes } from 'lucide-react'
import { PageHead, Stat, Select, ExportBtn, TableCard, Empty } from '@/components/ui'
import { inr, inr2, csvDownload, cn } from '@/lib/utils'
import { FY } from '@/data/company'

/* ── Goods that are bought in one unit and sold in another ─────────────────
   Wool pile arrives as a thousand metres and leaves as a roll. Screws arrive
   loose and leave as a box, and the box holds a different count from one
   consignment to the next. Mesh is sold by the size somebody calls out.

   Fixing a conversion in the product code is what breaks: "1 box = 100" is
   true until the day a consignment comes with 80. So the conversion lives on
   the batch, not on the item.                                             */

interface Batch { batchNo: string; received: string; perPack: number; packsIn: number; remainingBase: number }

interface PackItem {
  code: string
  name: string
  altName: string
  stockUom: string
  packUom: string
  outerUom?: string
  packsPerOuter?: number
  ratePerPack: number
  batches: Batch[]
}

const ITEMS: PackItem[] = [
  {
    code: 'WP-05-BK', name: 'Wool Pile 5 mm — Black', altName: 'Track Felt / TF',
    stockUom: 'metre', packUom: 'roll', outerUom: 'carton', packsPerOuter: 8, ratePerPack: 385,
    batches: [
      { batchNo: 'WP/2608', received: '2026-08-12', perPack: 220, packsIn: 0, remainingBase: 1320 },
      { batchNo: 'WP/2605', received: '2026-05-28', perPack: 220, packsIn: 0, remainingBase: 660 },
    ],
  },
  {
    code: 'WP-06-BR', name: 'Wool Pile 6 mm — Brown', altName: 'Track Felt 6 / TF6',
    stockUom: 'metre', packUom: 'roll', outerUom: 'carton', packsPerOuter: 8, ratePerPack: 410,
    batches: [{ batchNo: 'WP/2607', received: '2026-07-04', perPack: 200, packsIn: 0, remainingBase: 1000 }],
  },
  {
    code: 'SCR-0880', name: 'Self Tapping Screw 8 × 80', altName: 'ST screw 8x80',
    stockUom: 'piece', packUom: 'box', ratePerPack: 250,
    // The count in a box is what the supplier packed, and it changes.
    batches: [
      { batchNo: 'SC/2609', received: '2026-08-16', perPack: 100, packsIn: 0, remainingBase: 4200 },
      { batchNo: 'SC/2606', received: '2026-06-09', perPack: 80,  packsIn: 0, remainingBase: 1360 },
      { batchNo: 'SC/2603', received: '2026-03-22', perPack: 120, packsIn: 0, remainingBase: 960 },
    ],
  },
  {
    code: 'SIL-CLR', name: 'Silicone Sealant — Clear', altName: 'Silicon clear',
    stockUom: 'piece', packUom: 'box', outerUom: 'carton', packsPerOuter: 4, ratePerPack: 2400,
    batches: [{ batchNo: 'SL/2608', received: '2026-08-08', perPack: 24, packsIn: 0, remainingBase: 528 }],
  },
]

const totalBase = (i: PackItem) => i.batches.reduce((s, b) => s + b.remainingBase, 0)

/** Selling a number of packs draws from the oldest batch first, because a box
    opened months ago should clear before a fresh one. */
function issuePacks(item: PackItem, packs: number) {
  const order = [...item.batches].sort((a, b) => a.received.localeCompare(b.received))
  let left = packs
  const picks: { batch: Batch; packs: number; base: number }[] = []
  for (const b of order) {
    if (left <= 0) break
    const available = Math.floor(b.remainingBase / b.perPack)
    const take = Math.min(left, available)
    if (take <= 0) continue
    picks.push({ batch: b, packs: take, base: take * b.perPack })
    left -= take
  }
  return { picks, short: left, base: picks.reduce((s, p) => s + p.base, 0) }
}

export default function PackGoods() {
  const [code, setCode] = useState(ITEMS[0].code)
  const [packs, setPacks] = useState('3')
  const [meshW, setMeshW] = useState('4')
  const [meshH, setMeshH] = useState('40')
  const [meshRate, setMeshRate] = useState('42')

  const item = ITEMS.find(i => i.code === code)!
  const issue = useMemo(() => issuePacks(item, Number(packs) || 0), [item, packs])

  const base = totalBase(item)
  const wholePacks = item.batches.reduce((s, b) => s + Math.floor(b.remainingBase / b.perPack), 0)
  const outers = item.packsPerOuter ? Math.floor(wholePacks / item.packsPerOuter) : 0
  const mixedCounts = new Set(item.batches.map(b => b.perPack)).size > 1

  const meshSqft = +((Number(meshW) || 0) * (Number(meshH) || 0)).toFixed(2)
  const meshValue = Math.round(meshSqft * (Number(meshRate) || 0))

  const exportCsv = () => csvDownload('vsa-pack-goods.csv', [
    ['Goods bought in one unit and sold in another', FY],
    [], ['Code', 'Item', 'Also called', 'Stock unit', 'Sold as', 'Batch', 'Received',
         'Per pack', 'Stock unit remaining', 'Whole packs'],
    ...ITEMS.flatMap(i => i.batches.map(b => [i.code, i.name, i.altName, i.stockUom, i.packUom,
      b.batchNo, b.received, b.perPack, b.remainingBase, Math.floor(b.remainingBase / b.perPack)])),
  ])

  return (
    <div>
      <PageHead title="Pack & Loose Goods"
        sub="Wool pile, screws, silicone and mesh — where the count in a pack changes from one consignment to the next">
        <Select value={code} onChange={setCode} options={ITEMS.map(i => i.code)} className="min-w-[11rem]" />
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label={`Stock in ${item.stockUom}s`} value={base.toLocaleString('en-IN')} icon={Ruler} tone="brand"
          sub="What the stock is actually counted in" />
        <Stat label={`Whole ${item.packUom}s`} value={String(wholePacks)} icon={Package} tone="violet"
          sub={`How it is sold`} />
        <Stat label={item.outerUom ? `${item.outerUom}s` : 'Batches'}
          value={String(item.outerUom ? outers : item.batches.length)} icon={Boxes} tone="sky"
          sub={item.outerUom ? `${item.packsPerOuter} ${item.packUom}s to a ${item.outerUom}` : 'Each with its own count'} />
        <Stat label="Pack Counts in Use" value={String(new Set(item.batches.map(b => b.perPack)).size)}
          icon={Layers} tone={mixedCounts ? 'amber' : 'green'}
          sub={mixedCounts ? 'Different counts across batches' : 'Same count throughout'} />
      </div>

      {mixedCounts && (
        <div className="card mb-5" style={{ borderColor: 'var(--amber, #f59e0b)' }}>
          <p className="section-title text-base mb-1 flex items-center gap-2">
            <CircleAlert size={15} style={{ color: 'var(--amber, #f59e0b)' }} /> This Item Has No Standard Pack
          </p>
          <p className="section-sub max-w-4xl">
            {item.name} has come in at {[...new Set(item.batches.map(b => b.perPack))].join(', ')} to a
            {' '}{item.packUom}. That is exactly why the conversion is not written into the product code — a
            box is worth whatever the batch it came from says it is worth, and the stock is kept in
            {' '}{item.stockUom}s so it always adds up.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* ── Selling packs ─────────────────────────────────────────── */}
        <div className="card">
          <p className="section-title text-base mb-1 flex items-center gap-2">
            <Calculator size={15} className="text-brand" /> Sell {item.packUom}s
          </p>
          <p className="section-sub mb-3">
            Oldest batch first, so a part-used consignment clears before a fresh one is broken into.
          </p>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="label">{item.packUom}s to sell</label>
              <input className="input w-full text-right tabular-nums" value={packs}
                onChange={e => setPacks(e.target.value)} />
            </div>
            <div>
              <label className="label">Rate per {item.packUom}</label>
              <input className="input w-full text-right tabular-nums" value={item.ratePerPack} readOnly />
            </div>
          </div>

          {issue.picks.length === 0 ? <Empty msg="Nothing to issue" /> : (
            <>
              <div className="space-y-1.5">
                {issue.picks.map(p => (
                  <div key={p.batch.batchNo} className="rounded-lg px-3 py-2 flex items-center justify-between gap-3"
                    style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                    <span className="min-w-0">
                      <span className="text-xs font-mono block" style={{ color: 'var(--text-1)' }}>{p.batch.batchNo}</span>
                      <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>
                        {p.batch.perPack} {item.stockUom}s to a {item.packUom}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="text-sm font-semibold tabular-nums block" style={{ color: 'var(--text-1)' }}>
                        {p.packs} {item.packUom}{p.packs === 1 ? '' : 's'}
                      </span>
                      <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-3)' }}>
                        {p.base.toLocaleString('en-IN')} {item.stockUom}s
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 space-y-1.5 text-xs" style={{ borderTop: '1px solid var(--border-2)' }}>
                <Row k={`Comes off stock`} v={`${issue.base.toLocaleString('en-IN')} ${item.stockUom}s`} strong />
                <Row k="Bill value" v={inr(issue.picks.reduce((s, p) => s + p.packs, 0) * item.ratePerPack)} strong />
              </div>

              {issue.short > 0 && (
                <p className="text-[11px] mt-2" style={{ color: 'var(--red)' }}>
                  Short by {issue.short} {item.packUom}{issue.short === 1 ? '' : 's'} — not enough whole packs on hand.
                </p>
              )}
            </>
          )}
        </div>

        {/* ── Mesh, sold by the size called out ─────────────────────── */}
        <div className="card">
          <p className="section-title text-base mb-1 flex items-center gap-2">
            <Ruler size={15} className="text-brand" /> Mesh, Loose
          </p>
          <p className="section-sub mb-3">
            The counter calls the size, not the area. Type 4 and 40 and the square feet follow.
          </p>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div><label className="label">Width (ft)</label>
              <input className="input w-full text-right tabular-nums" value={meshW} onChange={e => setMeshW(e.target.value)} /></div>
            <div><label className="label">Length (ft)</label>
              <input className="input w-full text-right tabular-nums" value={meshH} onChange={e => setMeshH(e.target.value)} /></div>
            <div><label className="label">Rate / sqft</label>
              <input className="input w-full text-right tabular-nums" value={meshRate} onChange={e => setMeshRate(e.target.value)} /></div>
          </div>

          <div className="rounded-lg p-4 text-center" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>
              {meshW} × {meshH}
            </p>
            <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: 'var(--brand)' }}>{meshSqft} sqft</p>
            <p className="text-sm tabular-nums mt-1" style={{ color: 'var(--text-2)' }}>
              at {inr2(Number(meshRate) || 0)} a sqft = <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{inr(meshValue)}</span>
            </p>
          </div>
          <p className="text-[11px] mt-3" style={{ color: 'var(--text-4)' }}>
            The cut comes off the roll in running feet, so the stock falls by {meshW} ft of width across
            {' '}{meshH} ft of length — not by a piece count.
          </p>
        </div>
      </div>

      <p className="section-title text-base mb-1">Every Batch on Hand</p>
      <p className="section-sub mb-3">The pack count belongs to the batch, never to the product code</p>
      <TableCard maxH="26rem">
        <thead>
          <tr><th>Item</th><th>Also Called</th><th>Batch</th><th>Received</th>
            <th className="num">Per Pack</th><th className="num">Stock Unit Left</th>
            <th className="num">Whole Packs</th><th>Sold As</th></tr>
        </thead>
        <tbody>
          {ITEMS.flatMap(i => i.batches.map(b => (
            <tr key={i.code + b.batchNo} style={i.code === code
              ? { background: 'color-mix(in srgb, var(--brand) 6%, transparent)' } : undefined}>
              <td>
                <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{i.name}</p>
                <p className="font-mono text-[10px]" style={{ color: 'var(--text-4)' }}>{i.code}</p>
              </td>
              <td className="text-xs" style={{ color: 'var(--text-3)' }}>{i.altName}</td>
              <td className="font-mono text-xs whitespace-nowrap">{b.batchNo}</td>
              <td className="text-xs whitespace-nowrap">{b.received}</td>
              <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>
                {b.perPack} <span className="text-[10px] font-normal" style={{ color: 'var(--text-4)' }}>{i.stockUom}s</span>
              </td>
              <td className="num tabular-nums">{b.remainingBase.toLocaleString('en-IN')}</td>
              <td className="num tabular-nums text-xs">{Math.floor(b.remainingBase / b.perPack)}</td>
              <td className="text-xs">
                <span className="badge-gray">{i.packUom}</span>
                {i.outerUom && <span className="badge-blue ml-1">{i.packsPerOuter}/{i.outerUom}</span>}
              </td>
            </tr>
          )))}
        </tbody>
      </TableCard>
    </div>
  )
}

const Row = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
  <div className="flex items-center justify-between gap-2">
    <span style={{ color: 'var(--text-3)' }}>{k}</span>
    <span className={cn('tabular-nums', strong ? 'font-bold text-sm' : 'font-medium')}
      style={{ color: strong ? 'var(--brand)' : 'var(--text-1)' }}>{v}</span>
  </div>
)
