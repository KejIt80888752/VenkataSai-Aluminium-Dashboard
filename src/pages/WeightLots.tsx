import { useState, useMemo } from 'react'
import {
  Layers, Scale, CircleAlert, Boxes, TriangleAlert, Calculator, PackageSearch,
} from 'lucide-react'
import { PageHead, Stat, Select, ExportBtn, TableCard, Empty } from '@/components/ui'
import {
  LOTS, LOT_ITEMS, bandsFor, allocateByPieces, allocateByWeight, type Allocation,
} from '@/data/lots'
import { inr, kg as kgFmt, fmtDate, csvDownload, cn } from '@/lib/utils'
import { P } from '@/data/catalogue'
import { FY } from '@/data/company'

/* A lot more than 3% off its standard weight is worth a second look — either
   the press ran heavy or the bundle was weighed wrong. */
const VARIANCE_LIMIT = 3

export default function WeightLots() {
  const [code, setCode] = useState(LOT_ITEMS[0]?.code ?? '')
  const [mode, setMode] = useState<'Pieces' | 'Weight'>('Pieces')
  const [qty, setQty] = useState('40')
  const [band, setBand] = useState('Any weight range')

  const item = LOT_ITEMS.find(i => i.code === code)
  const product = P.find(p => p.code === code)
  const bands = useMemo(() => bandsFor(code), [code])
  const lots = useMemo(() => LOTS.filter(l => l.code === code).sort((a, b) => b.date.localeCompare(a.date)), [code])

  const wanted = band === 'Any weight range' ? undefined : band
  const alloc: Allocation = useMemo(() => {
    const n = Number(qty) || 0
    return mode === 'Pieces' ? allocateByPieces(code, n, wanted) : allocateByWeight(code, n, wanted)
  }, [code, mode, qty, wanted])

  const onHandNos = lots.reduce((s, l) => s + l.remainingNos, 0)
  const onHandKg = +lots.reduce((s, l) => s + l.remainingNos * l.kgPerPiece, 0).toFixed(1)
  const offSpec = LOTS.filter(l => Math.abs(l.variancePct) > VARIANCE_LIMIT && l.remainingNos > 0)
  const avgKgPerPiece = onHandNos > 0 ? +(onHandKg / onHandNos).toFixed(3) : 0

  /* What the old way would have said, using one fixed weight for everything. */
  const stdGap = +(alloc.kg - alloc.stdKg).toFixed(2)
  const rate = product?.ratePerKg ?? 0

  const exportCsv = () => csvDownload(`vsa-lot-register-${code}.csv`, [
    [`Lot register — ${item?.name ?? code}`, FY],
    [], ['Weight range', 'Lots', 'Pieces', 'Kilograms'],
    ...bands.map(b => [b.band, b.lots, b.nos, b.kg]),
    [], ['Lot', 'DC No', 'Supplier', 'Received', 'Bundles', 'Nos/Bundle', 'Total Nos',
         'Lot Weight Kg', 'Kg per Piece', 'Standard', 'Variance %', 'Band', 'Remaining Nos', 'Location'],
    ...lots.map(l => [l.id, l.dcNo, l.supplier, l.date, l.bundles, l.nosPerBundle, l.nos,
                      l.weightKg, l.kgPerPiece, l.stdKgPerPiece, l.variancePct, l.band, l.remainingNos, l.location]),
  ])

  return (
    <div>
      <PageHead title="Weight Ranges & Lots"
        sub="One name for the section, each lot carrying the weight it actually arrived at">
        <Select value={code} onChange={v => { setCode(v); setBand('Any weight range') }}
          options={LOT_ITEMS.map(i => i.code)} className="min-w-[12rem]" />
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="On Hand" value={`${onHandNos} pcs`} icon={Boxes} tone="brand" sub={kgFmt(onHandKg)} />
        <Stat label="Weight Ranges" value={String(bands.length)} icon={Layers} tone="violet"
          sub={bands.length > 1 ? 'One item, several ranges' : 'All lots in one range'} />
        <Stat label="Average Piece" value={`${avgKgPerPiece} kg`} icon={Scale} tone="sky"
          sub={`Standard says ${product?.kgPerLength ?? '—'} kg`} />
        <Stat label="Lots Off Standard" value={String(offSpec.length)} icon={TriangleAlert}
          tone={offSpec.length ? 'amber' : 'green'} sub={`More than ${VARIANCE_LIMIT}% away, all sections`} />
      </div>

      {/* ── Stock by weight range ─────────────────────────────────────── */}
      <div className="card mb-5">
        <p className="section-title text-base mb-1">{item?.name} — Stock by Weight Range</p>
        <p className="section-sub mb-4">
          This is what replaces a separate inventory name for every weight. One section, one code, and the
          ranges underneath it. Quote from the range the customer is actually getting.
        </p>

        {bands.length === 0 ? <Empty msg="Nothing on hand for this section" /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {bands.map(b => {
              const share = onHandNos > 0 ? b.nos / onHandNos * 100 : 0
              const picked = wanted === b.band
              return (
                <button key={b.band} onClick={() => setBand(picked ? 'Any weight range' : b.band)}
                  className="text-left rounded-lg p-3.5 transition-colors"
                  style={{
                    background: picked ? 'var(--brand-soft, var(--bg-card2))' : 'var(--bg-card2)',
                    border: `1px solid ${picked ? 'var(--brand)' : 'var(--border-2)'}`,
                  }}>
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>
                    {b.lots} {b.lots === 1 ? 'lot' : 'lots'}
                  </p>
                  <p className="text-base font-bold tabular-nums mt-0.5" style={{ color: 'var(--text-1)' }}>{b.band}</p>
                  <p className="text-sm tabular-nums mt-1" style={{ color: 'var(--text-2)' }}>
                    {b.nos} pcs · {kgFmt(b.kg)}
                  </p>
                  <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: 'var(--bg-card)' }}>
                    <div className="h-full rounded-full" style={{ width: `${share}%`, background: 'var(--brand)' }} />
                  </div>
                  <p className="text-[10.5px] mt-1.5" style={{ color: 'var(--text-4)' }}>
                    {picked ? 'Selling from this range only' : `${Math.round(share)}% of stock · tap to quote from it`}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Selling ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[20rem,1fr] gap-4 mb-5">
        <div className="card">
          <p className="section-title text-base mb-1 flex items-center gap-2">
            <Calculator size={15} className="text-brand" /> Put a Sale Through
          </p>
          <p className="section-sub mb-4">
            Bill by pieces or by weight — the other one is worked out from the lots it actually comes from.
          </p>

          <div className="flex gap-1 p-1 rounded-lg mb-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
            {(['Pieces', 'Weight'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={cn('flex-1 py-1.5 rounded-md text-xs font-medium transition-colors', mode === m && 'bg-brand text-white')}
                style={mode === m ? undefined : { color: 'var(--text-3)' }}>{m}</button>
            ))}
          </div>

          <label className="label">{mode === 'Pieces' ? 'Pieces to bill' : 'Kilograms to bill'}</label>
          <input className="input tabular-nums text-right" value={qty} onChange={e => setQty(e.target.value)} />

          <label className="label mt-3">Weight range</label>
          <Select value={band} onChange={setBand}
            options={['Any weight range', ...bands.map(b => b.band)]} className="!w-full" />

          <div className="mt-4 pt-3 space-y-1.5 text-xs" style={{ borderTop: '1px solid var(--border-2)' }}>
            <Row k="Pieces going out" v={String(alloc.nos)} />
            <Row k="Actual weight" v={kgFmt(alloc.kg)} strong />
            <Row k="Drawn from" v={`${alloc.picks.length} ${alloc.picks.length === 1 ? 'lot' : 'lots'} · ${alloc.bands} ${alloc.bands === 1 ? 'range' : 'ranges'}`} />
            {rate > 0 && <Row k="Bill value" v={inr(Math.round(alloc.kg * rate))} strong />}
          </div>

          {alloc.short > 0 && (
            <p className="text-[11px] mt-3 flex items-start gap-1.5" style={{ color: 'var(--red)' }}>
              <CircleAlert size={12} className="mt-0.5 shrink-0" />
              Short by {mode === 'Pieces' ? `${alloc.short} pieces` : kgFmt(alloc.short)}
              {wanted ? ' in this weight range. Clear the range to draw from the rest.' : '. Not enough stock on hand.'}
            </p>
          )}
        </div>

        <div className="card">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
            <p className="section-title text-base">Which Lots It Comes Out Of</p>
            {alloc.bands > 1 && (
              <span className="badge-yellow shrink-0">Mixed material — {alloc.bands} ranges</span>
            )}
          </div>
          <p className="section-sub mb-3">Newest lot first, as the item master's LIFO setting says</p>

          {alloc.picks.length === 0 ? <Empty msg="Nothing to allocate" /> : (
            <>
              <div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--border-2)', maxHeight: '15rem' }}>
                <table className="tbl">
                  <thead>
                    <tr><th>Lot</th><th>Supplier DC</th><th>Received</th><th>Range</th>
                      <th className="num">Kg/Pc</th><th className="num">Pieces</th><th className="num">Weight</th><th>At</th></tr>
                  </thead>
                  <tbody>
                    {alloc.picks.map(p => (
                      <tr key={p.lotId}>
                        <td className="font-mono text-[11px] whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{p.lotId}</td>
                        <td className="text-xs whitespace-nowrap">{p.dcNo}</td>
                        <td className="text-xs whitespace-nowrap">{fmtDate(p.date)}</td>
                        <td className="text-xs whitespace-nowrap">{p.band}</td>
                        <td className="num tabular-nums text-xs">{p.kgPerPiece}</td>
                        <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{p.nos}</td>
                        <td className="num tabular-nums text-xs">{p.kg}</td>
                        <td className="text-xs">{p.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── What the old fixed-weight way would have done ─────── */}
              <div className="mt-4 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ borderTop: '1px solid var(--border-2)' }}>
                <Fig k="Standard weight would say" v={kgFmt(alloc.stdKg)} />
                <Fig k="These lots actually weigh" v={kgFmt(alloc.kg)} strong />
                <Fig k={stdGap === 0 ? 'No difference' : stdGap > 0 ? 'Under-billed by' : 'Over-billed by'}
                  v={stdGap === 0 ? '—' : `${kgFmt(Math.abs(stdGap))}${rate ? ` · ${inr(Math.round(Math.abs(stdGap) * rate))}` : ''}`}
                  tone={stdGap === 0 ? undefined : stdGap > 0 ? 'red' : 'green'} />
              </div>
              <p className="text-[11px] mt-2.5" style={{ color: 'var(--text-4)' }}>
                {stdGap === 0
                  ? 'These lots happen to sit on the standard weight, so both ways agree.'
                  : <>Billing this on one fixed weight would have been out by {kgFmt(Math.abs(stdGap))} on this line
                      alone{rate ? <>, worth {inr(Math.round(Math.abs(stdGap) * rate))}</> : null}. Over a month of
                      bills that is where the stock stops tallying.</>}
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── Lot register ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <p className="section-title text-base mb-1">Lot Register</p>
          <p className="section-sub">
            Weight per piece is worked out from the bundle weight on the supplier's DC — nobody types it
          </p>
        </div>
        <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-4)' }}>
          <PackageSearch size={13} /> {lots.length} lots for this section
        </span>
      </div>

      <TableCard maxH="26rem">
        <thead>
          <tr><th>Lot</th><th>Supplier DC</th><th>Received</th><th className="num">Bundles</th>
            <th className="num">Nos</th><th className="num">Lot Weight</th><th className="num">Kg/Piece</th>
            <th className="num">Vs Standard</th><th>Range</th><th className="num">Left</th><th>At</th></tr>
        </thead>
        <tbody>
          {lots.map(l => {
            const off = Math.abs(l.variancePct) > VARIANCE_LIMIT
            return (
              <tr key={l.id} style={l.remainingNos === 0 ? { opacity: .5 } : undefined}>
                <td className="font-mono text-[11px] whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{l.id}</td>
                <td className="text-xs whitespace-nowrap">{l.dcNo}</td>
                <td className="text-xs whitespace-nowrap">{fmtDate(l.date)}</td>
                <td className="num tabular-nums text-xs">{l.bundles} × {l.nosPerBundle}</td>
                <td className="num tabular-nums">{l.nos}</td>
                <td className="num tabular-nums text-xs">{l.weightKg}</td>
                <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{l.kgPerPiece}</td>
                <td className="num tabular-nums text-xs"
                  style={{ color: off ? 'var(--red)' : 'var(--text-3)' }}>
                  {l.variancePct > 0 ? '+' : ''}{l.variancePct}%
                </td>
                <td className="text-xs whitespace-nowrap">
                  <span className={l.band === wanted ? 'badge-brand' : 'badge-gray'}>{l.band}</span>
                </td>
                <td className="num tabular-nums font-medium"
                  style={{ color: l.remainingNos === 0 ? 'var(--text-4)' : 'var(--text-1)' }}>
                  {l.remainingNos || '—'}
                </td>
                <td className="text-xs">{l.location}</td>
              </tr>
            )
          })}
        </tbody>
      </TableCard>

      {offSpec.length > 0 && (
        <div className="card mt-5" style={{ borderColor: 'var(--amber, #f59e0b)' }}>
          <p className="section-title text-base mb-1 flex items-center gap-2">
            <TriangleAlert size={15} style={{ color: 'var(--amber, #f59e0b)' }} /> Lots More Than {VARIANCE_LIMIT}% Off Standard
          </p>
          <p className="section-sub mb-3">
            Either the press ran heavy or light, or the bundle was weighed wrong. Worth checking before the
            stock is sold on that weight.
          </p>
          <div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--border-2)', maxHeight: '16rem' }}>
            <table className="tbl">
              <thead><tr><th>Lot</th><th>Section</th><th>Supplier</th><th className="num">Kg/Piece</th>
                <th className="num">Standard</th><th className="num">Off By</th><th className="num">Left</th></tr></thead>
              <tbody>
                {offSpec.map(l => (
                  <tr key={l.id}>
                    <td className="font-mono text-[11px] whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{l.id}</td>
                    <td className="text-xs max-w-[15rem] truncate" title={l.name}>{l.name}</td>
                    <td className="text-xs max-w-[13rem] truncate" title={l.supplier}>{l.supplier}</td>
                    <td className="num tabular-nums text-xs">{l.kgPerPiece}</td>
                    <td className="num tabular-nums text-xs">{l.stdKgPerPiece}</td>
                    <td className="num tabular-nums font-semibold" style={{ color: 'var(--red)' }}>
                      {l.variancePct > 0 ? '+' : ''}{l.variancePct}%
                    </td>
                    <td className="num tabular-nums">{l.remainingNos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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

const Fig = ({ k, v, tone, strong }: { k: string; v: string; tone?: string; strong?: boolean }) => (
  <div className="rounded-lg p-2.5" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{k}</p>
    <p className={cn('tabular-nums mt-0.5', strong ? 'text-base font-bold' : 'text-sm font-semibold')}
      style={{ color: tone === 'red' ? 'var(--red)' : tone === 'green' ? 'var(--green)' : 'var(--text-1)' }}>{v}</p>
  </div>
)
