import { useState } from 'react'
import { ClipboardCheck, Scale, Wand2, AlertTriangle, CheckCircle2, Layers } from 'lucide-react'
import { PageHead, Stat, ExportBtn, TableCard, Select } from '@/components/ui'
import { STOCK_CHECK, CHECK_SUMMARY } from '@/data/positions'
import { UOM_RULES } from '@/data/itemmaster'
import { csvDownload, cn } from '@/lib/utils'
import { fmtDate } from '@/lib/utils'
import { TODAY } from '@/data/company'

export default function StockAudit() {
  const [applied, setApplied] = useState<string[]>([])
  const [locF, setLocF] = useState('All Locations')

  const rows = STOCK_CHECK.filter(r => locF === 'All Locations' || r.location === locF)
  const autoRows = rows.filter(r => r.weightDrift)
  const manualRows = rows.filter(r => !r.weightDrift && r.diffPcs !== 0)

  const applyAll = () => setApplied(a => [...new Set([...a, ...autoRows.map(r => r.code + r.location)])])

  const exportCsv = () => csvDownload('vsa-weekly-stock-check.csv', [
    ['Weekly stock check', fmtDate(TODAY)],
    [], ['Code', 'Item', 'Location', 'Book Pcs', 'Counted Pcs', 'Diff Pcs', 'Book Kg', 'Counted Kg', 'Diff Kg', 'Weight Drift', 'Action'],
    ...rows.map(r => [r.code, r.name, r.location, r.bookPcs, r.countedPcs, r.diffPcs, r.bookKg, r.countedKg, r.diffKg, r.weightDrift ? 'Yes' : 'No', r.action]),
  ])

  return (
    <div>
      <PageHead title="Stock Audit" sub={`Weekly physical count against the book, in pieces and kilograms · week ending ${fmtDate(TODAY)}`}>
        <Select value={locF} onChange={setLocF} options={['All Locations', 'SHOP', 'GD1', 'GD2']} />
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Lines Counted"     value={String(CHECK_SUMMARY.rows)} icon={ClipboardCheck} tone="brand" sub={`${CHECK_SUMMARY.matched} tallied exactly`} />
        <Stat label="Piece Variance"    value={`${CHECK_SUMMARY.pieceVariance} pcs`} icon={Layers} tone={CHECK_SUMMARY.pieceVariance ? 'amber' : 'green'} sub="Absolute across all lines" />
        <Stat label="Weight Variance"   value={`${CHECK_SUMMARY.weightVarianceKg} kg`} icon={Scale} tone={CHECK_SUMMARY.weightVarianceKg < 0 ? 'red' : 'green'} sub="Book against weighbridge" />
        <Stat label="Auto-Adjustable"   value={String(CHECK_SUMMARY.autoAdjustable)} icon={Wand2} tone="violet" sub="Standard weight is stale" />
      </div>

      {/* ── Auto true-up ───────────────────────────────────────────── */}
      <div className="card mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <p className="section-title text-base">Standard Weight True-Up</p>
            <p className="section-sub max-w-2xl">
              Clips and thin sections are billed at a fixed standard weight. When lighter pieces go out, the book weight
              drifts above the shelf. These lines are re-based on the weight from the most recent delivery challan
              rather than adjusted by hand.
            </p>
          </div>
          <button onClick={applyAll} disabled={autoRows.every(r => applied.includes(r.code + r.location))}
            className="btn shrink-0"><Wand2 size={14} /> Apply all true-ups</button>
        </div>

        <div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--border-2)', maxHeight: '18rem' }}>
          <table className="tbl">
            <thead>
              <tr><th>Item</th><th>Loc</th><th className="num">Book Kg</th><th className="num">Counted Kg</th><th className="num">Drift</th><th className="num">New Std Wt</th><th>State</th></tr>
            </thead>
            <tbody>
              {autoRows.map(r => {
                const rule = UOM_RULES.find(u => u.code === r.code)
                const factor = r.bookKg > 0 ? r.countedKg / r.bookKg : 1
                const newStd = rule ? +(rule.kgPerPiece * factor).toFixed(3) : null
                const done = applied.includes(r.code + r.location)
                return (
                  <tr key={r.code + r.location}>
                    <td>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{r.name}</p>
                      <p className="font-mono text-[10px]" style={{ color: 'var(--text-4)' }}>{r.code}</p>
                    </td>
                    <td className="text-xs">{r.location}</td>
                    <td className="num tabular-nums text-xs">{r.bookKg.toLocaleString('en-IN')}</td>
                    <td className="num tabular-nums text-xs">{r.countedKg.toLocaleString('en-IN')}</td>
                    <td className="num tabular-nums text-xs font-medium text-amber-600">{((factor - 1) * 100).toFixed(2)}%</td>
                    <td className="num tabular-nums text-xs">{newStd ? `${newStd} kg` : '—'}</td>
                    <td>
                      {done
                        ? <span className="badge-green"><CheckCircle2 size={11} /> Applied</span>
                        : <button onClick={() => setApplied(a => [...a, r.code + r.location])} className="badge-yellow hover:bg-amber-200 transition-colors">Apply</button>}
                    </td>
                  </tr>
                )
              })}
              {autoRows.length === 0 && <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--text-4)' }}>No weight drift this week</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Full sheet ─────────────────────────────────────────────── */}
      <p className="section-title text-base mb-1">Count Sheet</p>
      <p className="section-sub mb-3">{manualRows.length} lines need a manual adjustment entry</p>
      <TableCard maxH="30rem">
        <thead>
          <tr><th>Item</th><th>Loc</th><th className="num">Book Pcs</th><th className="num">Counted</th><th className="num">Diff</th>
            <th className="num">Book Kg</th><th className="num">Counted Kg</th><th className="num">Diff Kg</th><th>Action</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.code + r.location + r.bookPcs}>
              <td>
                <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{r.name}</p>
                <p className="font-mono text-[10px]" style={{ color: 'var(--text-4)' }}>{r.code}</p>
              </td>
              <td className="text-xs">{r.location}</td>
              <td className="num tabular-nums">{r.bookPcs}</td>
              <td className="num tabular-nums">{r.countedPcs}</td>
              <td className={cn('num tabular-nums font-medium', r.diffPcs === 0 ? '' : r.diffPcs < 0 ? 'text-red-500' : 'text-green-600')}>
                {r.diffPcs === 0 ? '—' : (r.diffPcs > 0 ? '+' : '') + r.diffPcs}
              </td>
              <td className="num tabular-nums text-xs">{r.bookKg.toLocaleString('en-IN')}</td>
              <td className="num tabular-nums text-xs">{r.countedKg.toLocaleString('en-IN')}</td>
              <td className={cn('num tabular-nums text-xs font-medium', Math.abs(r.diffKg) < 0.05 ? '' : r.diffKg < 0 ? 'text-red-500' : 'text-green-600')}>
                {Math.abs(r.diffKg) < 0.05 ? '—' : (r.diffKg > 0 ? '+' : '') + r.diffKg}
              </td>
              <td>
                <span className={
                  r.action === 'No action' ? 'badge-green'
                  : r.action.startsWith('Auto') ? 'badge-purple' : 'badge-yellow'}>
                  {r.action === 'No action' ? <><CheckCircle2 size={11} /> Tallied</> : <><AlertTriangle size={11} /> {r.action}</>}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>

      {/* ── Lot / valuation policy ─────────────────────────────────── */}
      <div className="card mt-5">
        <p className="section-title text-base mb-1">Lot Fixing & Issue Policy</p>
        <p className="section-sub mb-4">How stock is picked when a sale bill is raised</p>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Item</th><th>Issue Order</th><th className="num">Std Wt</th><th>Lot Fixing</th><th>Notes</th></tr></thead>
            <tbody>
              {UOM_RULES.map(u => (
                <tr key={u.code}>
                  <td className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>{u.name}</td>
                  <td><span className={u.valuation === 'LIFO' ? 'badge-brand' : 'badge-gray'}>{u.valuation}</span></td>
                  <td className="num tabular-nums text-xs">{u.kgPerPiece} kg</td>
                  <td>{u.autoTrueUp ? <span className="badge-purple">Lot-fixed on latest DC</span> : <span className="badge-gray">Fixed standard</span>}</td>
                  <td className="text-[11px]">
                    {u.valuation === 'LIFO'
                      ? 'Newest lot is issued first, so the sale bill carries the weight of the last load received.'
                      : u.valuation === 'FIFO'
                      ? 'Oldest lot clears first — used where the material ages.'
                      : 'Costed at the running average across lots.'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
