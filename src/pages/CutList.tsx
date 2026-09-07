import { useState, useMemo } from 'react'
import { Ruler, Recycle, Trash2, Plus, PackageCheck, TriangleAlert } from 'lucide-react'
import { PageHead, Stat, Select, ExportBtn, TableCard, Empty } from '@/components/ui'
import { optimise, type Need } from '@/lib/cutlist'
import { P } from '@/data/catalogue'
import { inr, csvDownload, cn } from '@/lib/utils'
import { FY } from '@/data/company'

const STOCK_LENGTHS = ['12', '16', '18', '20', '21']

let seq = 0
const row = (lengthFt: number, qty: number, label: string): Need & { id: number } =>
  ({ id: ++seq, lengthFt, qty, label })

export default function CutList() {
  const [code, setCode] = useState(P.find(p => p.unit === 'kg')?.code ?? P[0].code)
  const [stock, setStock] = useState('12')
  const [kerf, setKerf] = useState('3')
  const [needs, setNeeds] = useState([
    row(7.5, 8, 'Outer frame — top & bottom'),
    row(4, 12, 'Shutter — vertical'),
    row(3, 10, 'Beading'),
    row(5.5, 6, 'Interlock'),
  ])

  const product = P.find(p => p.code === code)!
  const plan = useMemo(
    () => optimise(needs, Number(stock) || 12, Number(kerf) || 0),
    [needs, stock, kerf],
  )

  /* A foot of section has a weight and a cost, so waste can be priced. */
  const kgPerFt = product.lengthFt > 0 ? product.kgPerLength / product.lengthFt : 0
  const wasteKg = +(plan.offcutFt * kgPerFt).toFixed(1)
  const wasteValue = Math.round(wasteKg * product.costPerKg)

  const naive = useMemo(() => {
    // Cutting in the order written, one bar at a time, as it is done by hand.
    const s = Number(stock) || 12
    let bars = 0, left = 0
    for (const n of needs) for (let i = 0; i < n.qty; i++) {
      if (n.lengthFt > left) { bars++; left = s }
      left = +(left - n.lengthFt).toFixed(4)
    }
    return bars
  }, [needs, stock])

  const saved = naive - plan.barsNeeded

  const exportCsv = () => csvDownload('vsa-cut-list.csv', [
    [`Cutting plan — ${product.name}`, FY],
    [], ['Stock length', stock + ' ft'], ['Blade', kerf + ' mm'],
    ['Bars needed', plan.barsNeeded], ['Waste', plan.offcutFt + ' ft'],
    [], ['Bar', 'Cuts', 'Used ft', 'Offcut ft', 'Offcut usable'],
    ...plan.bars.map(b => [b.index, b.cuts.map(c => c.lengthFt + 'ft').join(' + '),
                           b.usedFt.toFixed(2), b.offcutFt, b.offcutFt >= 1.5 ? 'Keep' : 'Scrap']),
  ])

  return (
    <div>
      <PageHead title="Cut List" sub="What to cut out of each bar so the least is thrown away">
        <Select value={code} onChange={setCode} options={P.map(p => p.code)} className="min-w-[12rem]" />
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Bars Needed" value={String(plan.barsNeeded)} icon={PackageCheck} tone="brand"
          sub={`${plan.stockFt} ft of ${stock} ft bar`} />
        <Stat label="Actually Cut" value={`${plan.neededFt} ft`} icon={Ruler} tone="sky"
          sub={`${needs.reduce((s, n) => s + n.qty, 0)} pieces`} />
        <Stat label="Thrown Away" value={`${plan.offcutFt} ft`} icon={Trash2}
          tone={plan.wastePct > 12 ? 'red' : plan.wastePct > 6 ? 'amber' : 'green'}
          sub={`${plan.wastePct}% · ${wasteKg} kg · ${inr(wasteValue)}`} />
        <Stat label="Bars Saved" value={saved > 0 ? `${saved}` : '0'} icon={Recycle}
          tone={saved > 0 ? 'green' : 'violet'}
          sub={saved > 0 ? `Against cutting in written order` : 'Same as cutting in order'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[22rem,1fr] gap-4">
        {/* ── What is wanted ────────────────────────────────────────── */}
        <div className="card">
          <p className="section-title text-base mb-1">Lengths Wanted</p>
          <p className="section-sub mb-3">Straight off the window schedule</p>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="label">Stock bar (ft)</label>
              <Select value={stock} onChange={setStock} options={STOCK_LENGTHS} className="!w-full" />
            </div>
            <div>
              <label className="label">Blade (mm)</label>
              <input className="input w-full text-right tabular-nums" value={kerf}
                onChange={e => setKerf(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {needs.map(n => (
              <div key={n.id} className="rounded-lg p-2.5"
                style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <div className="flex items-center gap-2">
                  <input className="input !py-1 !text-xs flex-1" value={n.label ?? ''} placeholder="What it is for"
                    onChange={e => setNeeds(ns => ns.map(x => x.id === n.id ? { ...x, label: e.target.value } : x))} />
                  <button className="btn-ghost !px-1.5 !py-1" style={{ color: 'var(--red)' }}
                    onClick={() => setNeeds(ns => ns.filter(x => x.id !== n.id))}><Trash2 size={13} /></button>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <label className="text-[10px] uppercase w-10 shrink-0" style={{ color: 'var(--text-4)' }}>Length</label>
                  <input className="input !py-1 !text-xs text-right tabular-nums !w-20" value={n.lengthFt}
                    onChange={e => setNeeds(ns => ns.map(x => x.id === n.id ? { ...x, lengthFt: Number(e.target.value) || 0 } : x))} />
                  <label className="text-[10px] uppercase w-6 shrink-0" style={{ color: 'var(--text-4)' }}>Nos</label>
                  <input className="input !py-1 !text-xs text-right tabular-nums !w-16" value={n.qty}
                    onChange={e => setNeeds(ns => ns.map(x => x.id === n.id ? { ...x, qty: Number(e.target.value) || 0 } : x))} />
                </div>
              </div>
            ))}
          </div>

          <button className="btn-outline w-full mt-3" onClick={() => setNeeds(ns => [...ns, row(3, 1, '')])}>
            <Plus size={14} /> Add a length
          </button>
        </div>

        {/* ── The plan ──────────────────────────────────────────────── */}
        <div className="card">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <p className="section-title text-base mb-1">Cut It Like This</p>
              <p className="section-sub">
                Longest piece first, each next piece into the first bar with room. The blade is counted on
                every cut after the first.
              </p>
            </div>
            <span className="badge-gray shrink-0">{plan.reusable} offcuts worth keeping</span>
          </div>

          {plan.unfitted.length > 0 && (
            <div className="rounded-lg p-3 mb-3 flex items-start gap-2"
              style={{ background: 'color-mix(in srgb, var(--red) 8%, transparent)', border: '1px solid var(--red)' }}>
              <TriangleAlert size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--red)' }} />
              <p className="text-[12px]" style={{ color: 'var(--text-2)' }}>
                {plan.unfitted.map(u => `${u.qty} × ${u.lengthFt} ft`).join(', ')} will not come out of a
                {' '}{stock} ft bar. Either a longer bar is needed, or the piece has to be joined.
              </p>
            </div>
          )}

          {plan.bars.length === 0 ? <Empty msg="Add a length to see the plan" /> : (
            <div className="space-y-2 max-h-[26rem] overflow-y-auto pr-1">
              {plan.bars.map(b => (
                <div key={b.index}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>
                      Bar {b.index}
                      <span className="ml-2 font-normal" style={{ color: 'var(--text-4)' }}>
                        {b.cuts.map(c => `${c.lengthFt}′`).join(' + ')}
                      </span>
                    </span>
                    <span className="text-[11px] tabular-nums shrink-0"
                      style={{ color: b.offcutFt >= 1.5 ? 'var(--green)' : b.offcutFt > 0.3 ? 'var(--red)' : 'var(--text-4)' }}>
                      {b.offcutFt > 0 ? `${b.offcutFt}′ ${b.offcutFt >= 1.5 ? 'keep' : 'scrap'}` : 'no waste'}
                    </span>
                  </div>
                  {/* the bar drawn to length */}
                  <div className="flex h-6 rounded overflow-hidden" style={{ border: '1px solid var(--border-2)' }}>
                    {b.cuts.map((c, i) => (
                      <div key={i} className="flex items-center justify-center text-[9px] font-medium"
                        style={{
                          width: `${(c.lengthFt / b.stockFt) * 100}%`,
                          background: `color-mix(in srgb, var(--brand) ${28 + (i % 3) * 12}%, transparent)`,
                          borderRight: '1px solid var(--bg-card)',
                          color: 'var(--text-1)',
                        }} title={c.label}>
                        {(c.lengthFt / b.stockFt) > 0.14 ? `${c.lengthFt}′` : ''}
                      </div>
                    ))}
                    {b.offcutFt > 0.02 && (
                      <div style={{
                        width: `${(b.offcutFt / b.stockFt) * 100}%`,
                        background: b.offcutFt >= 1.5
                          ? 'color-mix(in srgb, var(--green) 22%, transparent)'
                          : 'repeating-linear-gradient(45deg, transparent, transparent 3px, var(--border-2) 3px, var(--border-2) 6px)',
                      }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="section-title text-base mt-5 mb-1">Bar by Bar</p>
      <p className="section-sub mb-3">Hand this to the saw</p>
      <TableCard maxH="22rem">
        <thead>
          <tr><th className="num">Bar</th><th>Cuts</th><th className="num">Used</th>
            <th className="num">Offcut</th><th>Offcut</th></tr>
        </thead>
        <tbody>
          {plan.bars.map(b => (
            <tr key={b.index}>
              <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{b.index}</td>
              <td className="text-xs">{b.cuts.map(c => `${c.lengthFt}′`).join('  +  ')}</td>
              <td className="num tabular-nums text-xs">{b.usedFt.toFixed(2)} ft</td>
              <td className={cn('num tabular-nums text-xs font-medium')}
                style={{ color: b.offcutFt >= 1.5 ? 'var(--green)' : 'var(--red)' }}>{b.offcutFt} ft</td>
              <td>
                <span className={b.offcutFt >= 1.5 ? 'badge-green' : b.offcutFt > 0.3 ? 'badge-red' : 'badge-gray'}>
                  {b.offcutFt >= 1.5 ? 'Back to stock' : b.offcutFt > 0.3 ? 'Scrap' : 'Nothing left'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>
    </div>
  )
}
