import { useState, useMemo } from 'react'
import { Warehouse as WhIcon, PackageSearch, PackagePlus, Layers, MapPin } from 'lucide-react'
import { PageHead, Stat, Select, ExportBtn, TableCard, Empty } from '@/components/ui'
import { BINS, GODOWNS, WAREHOUSE_SUMMARY, binsFor, pickFrom, putawayFor, type Bin } from '@/data/warehouse'
import { P } from '@/data/catalogue'
import { csvDownload } from '@/lib/utils'

const fillColour = (b: Bin) => {
  if (b.nos === 0) return 'var(--bg-card2)'
  const pct = b.nos / b.capacityNos
  return `color-mix(in srgb, var(--brand) ${Math.round(18 + pct * 55)}%, transparent)`
}

export default function Warehouse() {
  const [godown, setGodown] = useState<string>(GODOWNS[0].id)
  const [code, setCode] = useState(P[0].code)
  const [qty, setQty] = useState('60')
  const [hover, setHover] = useState<Bin | null>(null)

  const g = GODOWNS.find(x => x.id === godown)!
  const bins = useMemo(() => BINS.filter(b => b.godown === godown), [godown])
  const here = useMemo(() => binsFor(code), [code])
  const pick = useMemo(() => pickFrom(code, Number(qty) || 0), [code, qty])
  const put = useMemo(() => putawayFor(code, godown), [code, godown])

  const exportCsv = () => csvDownload('vsa-bin-locations.csv', [
    ['Bin locations'],
    [], ['Bin', 'Godown', 'Aisle', 'Rack', 'Level', 'Item Code', 'Item', 'Pieces', 'Capacity', 'Floor level only'],
    ...BINS.map(b => [b.id, b.godown, b.aisle, b.rack, b.level, b.code ?? '', b.name ?? '',
                      b.nos, b.capacityNos, b.heavyOnly ? 'Yes' : 'No']),
  ])

  return (
    <div>
      <PageHead title="Warehouse Map" sub="Aisle, rack and level — where a section is, and where the next load should go">
        <Select value={godown} onChange={setGodown} options={GODOWNS.map(x => x.id)} />
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Bins" value={String(WAREHOUSE_SUMMARY.bins)} icon={Layers} tone="brand"
          sub={`${GODOWNS.length} locations`} />
        <Stat label="Holding Stock" value={String(WAREHOUSE_SUMMARY.used)} icon={WhIcon} tone="violet"
          sub={`${WAREHOUSE_SUMMARY.empty} empty`} />
        <Stat label="Pieces Racked" value={WAREHOUSE_SUMMARY.pieces.toLocaleString('en-IN')} icon={PackageSearch}
          tone="sky" sub="Across every bin" />
        <Stat label="How Full" value={`${WAREHOUSE_SUMMARY.fillPct}%`} icon={PackagePlus}
          tone={WAREHOUSE_SUMMARY.fillPct > 85 ? 'red' : 'green'} sub="Of rack capacity" />
      </div>

      {/* ── The map ───────────────────────────────────────────────────── */}
      <div className="card mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <p className="section-title text-base mb-1">{g.label}</p>
            <p className="section-sub">
              Each square is a bin. Darker means fuller. Level 1 is floor level, where heavy sections go.
            </p>
          </div>
          <div className="text-right shrink-0 min-w-[13rem]">
            {hover ? (
              <>
                <p className="font-mono text-xs" style={{ color: 'var(--brand)' }}>{hover.id}</p>
                <p className="text-sm truncate" style={{ color: 'var(--text-1)' }}>{hover.name ?? 'Empty'}</p>
                <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>
                  {hover.nos} of {hover.capacityNos} pieces{hover.heavyOnly ? ' · floor level' : ''}
                </p>
              </>
            ) : <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>Point at a bin to see what is on it</p>}
          </div>
        </div>

        <div className="space-y-4 overflow-x-auto">
          {g.aisles.map(aisle => (
            <div key={aisle}>
              <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-4)' }}>
                Aisle {aisle}
              </p>
              <div className="flex gap-3 min-w-max">
                {Array.from({ length: g.racks }, (_, r) => (
                  <div key={r}>
                    <div className="flex flex-col-reverse gap-1">
                      {Array.from({ length: g.levels }, (_, l) => {
                        const b = bins.find(x => x.aisle === aisle && x.rack === r + 1 && x.level === l + 1)
                        if (!b) return null
                        const isHere = here.some(h => h.id === b.id)
                        return (
                          <div key={l} onMouseEnter={() => setHover(b)} onMouseLeave={() => setHover(null)}
                            className="w-10 h-7 rounded flex items-center justify-center text-[9px] tabular-nums cursor-default transition-transform hover:scale-110"
                            style={{
                              background: fillColour(b),
                              border: `1px solid ${isHere ? 'var(--brand)' : 'var(--border-2)'}`,
                              boxShadow: isHere ? '0 0 0 2px color-mix(in srgb, var(--brand) 35%, transparent)' : undefined,
                              color: 'var(--text-2)',
                            }}>
                            {b.nos || ''}
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-[9px] text-center mt-1" style={{ color: 'var(--text-4)' }}>{r + 1}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Picking and putting away ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <div className="card">
          <p className="section-title text-base mb-1 flex items-center gap-2">
            <PackageSearch size={15} className="text-brand" /> Where to Pick From
          </p>
          <p className="section-sub mb-3">Fullest bin first, so a rack is cleared rather than half-emptied everywhere</p>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="label">Section</label>
              <Select value={code} onChange={setCode} options={P.map(p => p.code)} className="!w-full" />
            </div>
            <div>
              <label className="label">Pieces wanted</label>
              <input className="input w-full text-right tabular-nums" value={qty} onChange={e => setQty(e.target.value)} />
            </div>
          </div>

          {pick.picks.length === 0 ? <Empty msg="This section is not on any rack" /> : (
            <div className="space-y-1.5">
              {pick.picks.map(({ bin, take }) => (
                <div key={bin.id} className="rounded-lg px-3 py-2 flex items-center justify-between gap-3"
                  style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                  <span className="flex items-center gap-2 min-w-0">
                    <MapPin size={13} className="shrink-0" style={{ color: 'var(--brand)' }} />
                    <span className="font-mono text-xs" style={{ color: 'var(--text-1)' }}>{bin.id}</span>
                    <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>
                      aisle {bin.aisle}, rack {bin.rack}, level {bin.level}
                    </span>
                  </span>
                  <span className="tabular-nums text-sm font-semibold shrink-0" style={{ color: 'var(--text-1)' }}>
                    {take} pcs
                  </span>
                </div>
              ))}
              {pick.short > 0 && (
                <p className="text-[11px] pt-1" style={{ color: 'var(--red)' }}>
                  Short by {pick.short} pieces — not enough on any rack.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <p className="section-title text-base mb-1 flex items-center gap-2">
            <PackagePlus size={15} className="text-brand" /> Where to Put It Away
          </p>
          <p className="section-sub mb-3">When a load comes in, this is the bin to take it to</p>

          {put.suggestion ? (
            <>
              <div className="rounded-lg p-4 text-center"
                style={{ background: 'var(--bg-card2)', border: '1px solid var(--brand)' }}>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>Take it to</p>
                <p className="text-2xl font-bold font-mono mt-1" style={{ color: 'var(--brand)' }}>{put.suggestion.id}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                  Aisle {put.suggestion.aisle} · rack {put.suggestion.rack} · level {put.suggestion.level}
                </p>
              </div>
              <p className="text-[12px] mt-3" style={{ color: 'var(--text-3)' }}>{put.reason}.</p>
              {put.heavy && (
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-4)' }}>
                  This section runs over 2.5 kg a piece, so it is kept at floor level.
                </p>
              )}
            </>
          ) : <Empty msg="No bin free in this godown" />}
        </div>
      </div>

      <p className="section-title text-base mb-1">Every Bin</p>
      <p className="section-sub mb-3">{g.label}</p>
      <TableCard maxH="26rem">
        <thead>
          <tr><th>Bin</th><th>Aisle</th><th className="num">Rack</th><th className="num">Level</th>
            <th>Item</th><th className="num">Pieces</th><th className="num">Capacity</th><th>How Full</th></tr>
        </thead>
        <tbody>
          {bins.map(b => (
            <tr key={b.id} style={b.code === code ? { background: 'color-mix(in srgb, var(--brand) 7%, transparent)' } : undefined}>
              <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{b.id}</td>
              <td className="text-xs">{b.aisle}</td>
              <td className="num tabular-nums text-xs">{b.rack}</td>
              <td className="num tabular-nums text-xs">{b.level}{b.heavyOnly && <span style={{ color: 'var(--text-4)' }}> ·floor</span>}</td>
              <td className="text-xs max-w-[16rem] truncate" style={{ color: b.name ? 'var(--text-2)' : 'var(--text-4)' }}>
                {b.name ?? 'Empty'}
              </td>
              <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{b.nos || '—'}</td>
              <td className="num tabular-nums text-xs">{b.capacityNos}</td>
              <td>
                <div className="h-1.5 w-20 rounded-full overflow-hidden" style={{ background: 'var(--bg-card2)' }}>
                  <div className="h-full rounded-full"
                    style={{ width: `${(b.nos / b.capacityNos) * 100}%`, background: 'var(--brand)' }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>
    </div>
  )
}
