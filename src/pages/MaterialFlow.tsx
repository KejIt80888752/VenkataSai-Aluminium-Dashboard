import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import {
  Factory, SprayCan, Store, Warehouse, Truck, AlertTriangle,
  ArrowRight, Scale,
} from 'lucide-react'
import { PageHead, Stat, TableCard, Pill, useChartTheme, ExportBtn, Modal } from '@/components/ui'
import { LOCATIONS, ROUTES, locName } from '@/data/locations'
import { CHALLANS, COATING_JOBS, COATING_TOTALS, IN_TRANSIT, pcuOutstanding, type CoatingJob } from '@/data/challans'
import { locTotals, weightAt } from '@/data/positions'
import { inr, csvDownload, fmtDate, cn } from '@/lib/utils'
import { FY } from '@/data/company'

const NODE_ICON = { Manufacturer: Factory, 'Coating Unit': SprayCan, Shop: Store, Godown: Warehouse }

export default function MaterialFlow() {
  const t = useChartTheme()
  const [job, setJob] = useState<CoatingJob | null>(null)

  const pcu1 = pcuOutstanding('PCU1')
  const pcu2 = pcuOutstanding('PCU2')
  const transitNos = IN_TRANSIT.reduce((s, d) => s + d.totalNos, 0)
  const transitKg = +IN_TRANSIT.reduce((s, d) => s + d.totalWeightKg, 0).toFixed(1)

  /** Volume that has moved on each leg, for the flow arrows and the chart. */
  const legStats = ROUTES.map(r => {
    const dcs = CHALLANS.filter(d => d.routeId === r.id)
    return {
      ...r,
      dcs: dcs.length,
      nos: dcs.reduce((s, d) => s + d.totalNos, 0),
      kg: +dcs.reduce((s, d) => s + d.totalWeightKg, 0).toFixed(1),
    }
  })
  const legOf = (id: string) => legStats.find(l => l.id === id)!

  const chartData = legStats.filter(l => l.nos > 0).map(l => ({ name: l.label, Pieces: l.nos, Kilograms: Math.round(l.kg) }))

  const exportCsv = () => csvDownload('vsa-material-position.csv', [
    ['Material position as on', FY],
    [], ['Node', 'Pieces', 'Weight (kg)'],
    ['Shop', locTotals('shop'), weightAt('shop')],
    ['Godown 1', locTotals('gd1'), weightAt('gd1')],
    ['Godown 2 (4F)', locTotals('gd2'), weightAt('gd2')],
    ['At PCU1', pcu1.nos, pcu1.kg],
    ['At PCU2', pcu2.nos, pcu2.kg],
    ['In transit', transitNos, transitKg],
    [], ['Leg', 'Challans', 'Pieces', 'Weight (kg)'],
    ...legStats.map(l => [l.label, l.dcs, l.nos, l.kg]),
  ])

  return (
    <div>
      <PageHead title="Material Flow" sub="Mill → powder coating unit → shop and godowns, tracked in pieces and kilograms">
        <ExportBtn onClick={exportCsv} label="Export position" />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Outstanding at PCU1" value={`${pcu1.nos.toLocaleString('en-IN')} nos`} sub={`${pcu1.kg.toLocaleString('en-IN')} kg · ${pcu1.jobs} open DCs`} icon={SprayCan} tone={pcu1.overdue ? 'red' : 'brand'} />
        <Stat label="Outstanding at PCU2" value={`${pcu2.nos.toLocaleString('en-IN')} nos`} sub={`${pcu2.kg.toLocaleString('en-IN')} kg · ${pcu2.jobs} open DCs`} icon={SprayCan} tone={pcu2.overdue ? 'red' : 'violet'} />
        <Stat label="In Transit" value={`${transitNos.toLocaleString('en-IN')} nos`} sub={`${transitKg.toLocaleString('en-IN')} kg on the road`} icon={Truck} tone="amber" />
        <Stat label="Coating Weight Gain" value={`${COATING_TOTALS.gainKg.toLocaleString('en-IN')} kg`} sub={`Added on ${COATING_TOTALS.returnedNos.toLocaleString('en-IN')} pcs returned`} icon={Scale} tone="green" />
      </div>

      {/* ── Flow map ───────────────────────────────────────────────── */}
      <div className="card mb-5">
        <p className="section-title text-base mb-1">Movement Map</p>
        <p className="section-sub mb-5">Volume that has moved on each leg this year — click a coating unit to see open jobs</p>

        <div className="flex flex-col lg:flex-row items-stretch gap-3 overflow-x-auto pb-1">
          <Node id="M1" nos={legOf('M1-PCU1').nos + legOf('M1-PCU2').nos} kg={legOf('M1-PCU1').kg + legOf('M1-PCU2').kg} caption="Dispatched to coating" />

          <Arrow legs={[legOf('M1-PCU1'), legOf('M1-PCU2')]} />

          <div className="flex flex-col gap-3 shrink-0">
            <Node id="PCU1" nos={pcu1.nos} kg={pcu1.kg} caption="Lying at coater" alert={pcu1.overdue > 0} />
            <Node id="PCU2" nos={pcu2.nos} kg={pcu2.kg} caption="Lying at coater" alert={pcu2.overdue > 0} />
          </div>

          <Arrow legs={[legOf('PCU1-SHOP'), legOf('PCU1-GD1'), legOf('PCU1-GD2'), legOf('PCU2-SHOP'), legOf('PCU2-GD1')]} />

          <div className="flex flex-col gap-3 shrink-0">
            <Node id="SHOP" nos={locTotals('shop')} kg={weightAt('shop')} caption="On hand" />
            <Node id="GD1" nos={locTotals('gd1')} kg={weightAt('gd1')} caption="On hand" />
            <Node id="GD2" nos={locTotals('gd2')} kg={weightAt('gd2')} caption="On hand" />
          </div>
        </div>
      </div>

      {/* ── Leg volumes ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
        <div className="card">
          <p className="section-title text-base mb-1">Volume by Leg</p>
          <p className="section-sub mb-3">Every challan raised on each route</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 46, right: 12 }} barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} horizontal={false} />
              <XAxis type="number" tick={t.tick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ ...t.tick, fontSize: 10 }} axisLine={false} tickLine={false} width={126} />
              <Tooltip contentStyle={t.tooltip} formatter={(v: number, n) => [v.toLocaleString('en-IN') + (n === 'Kilograms' ? ' kg' : ' nos'), n]} cursor={{ fill: 'rgba(15,91,143,.06)' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />
              <Bar dataKey="Pieces" fill="#0f5b8f" radius={[0, 3, 3, 0]} isAnimationActive={false} />
              <Bar dataKey="Kilograms" fill="#94a3b8" radius={[0, 3, 3, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4">
            <p className="section-title text-base">Open Jobs at Coaters</p>
            <p className="section-sub">Material sent that has not fully come back</p>
          </div>
          <div className="overflow-auto" style={{ maxHeight: '17rem' }}>
            <table className="tbl">
              <thead><tr><th>DC No</th><th>PCU</th><th className="num">Pending Nos</th><th className="num">Pending Kg</th><th className="num">Age</th><th>Status</th></tr></thead>
              <tbody>
                {COATING_JOBS.filter(j => j.pendingNos > 0).map(j => (
                  <tr key={j.dcNo} className="cursor-pointer" onClick={() => setJob(j)}>
                    <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{j.dcNo}</td>
                    <td><span className="badge-brand">{j.pcu}</span></td>
                    <td className="num tabular-nums">{j.pendingNos.toLocaleString('en-IN')}</td>
                    <td className="num tabular-nums">{j.pendingKg.toLocaleString('en-IN')}</td>
                    <td className={cn('num tabular-nums text-xs', j.status === 'Overdue at Coater' && 'text-red-500 font-semibold')}>{j.ageDays}d</td>
                    <td><span className={j.status === 'Overdue at Coater' ? 'badge-red' : j.status === 'Partially Returned' ? 'badge-yellow' : 'badge-blue'}>{j.status}</span></td>
                  </tr>
                ))}
                {COATING_JOBS.every(j => j.pendingNos === 0) && (
                  <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--text-4)' }}>Nothing pending at either coater</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── In transit ─────────────────────────────────────────────── */}
      <p className="section-title text-base mb-1">Material In Transit</p>
      <p className="section-sub mb-3">Dispatched and not yet acknowledged at the receiving end</p>
      <TableCard maxH="20rem">
        <thead>
          <tr><th>Challan</th><th>Date</th><th>Route</th><th>Vehicle</th><th>Shade</th><th className="num">Nos</th><th className="num">Weight</th><th>Status</th></tr>
        </thead>
        <tbody>
          {IN_TRANSIT.map(d => (
            <tr key={d.id}>
              <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{d.no}</td>
              <td className="whitespace-nowrap text-xs">{fmtDate(d.date)}</td>
              <td className="text-xs whitespace-nowrap">{locName(d.from).split('—')[0]} → {locName(d.to).split('—')[0]}</td>
              <td className="font-mono text-xs whitespace-nowrap">{d.vehicleNo}</td>
              <td className="text-xs whitespace-nowrap">{d.shadeName}</td>
              <td className="num tabular-nums">{d.totalNos.toLocaleString('en-IN')}</td>
              <td className="num tabular-nums">{d.totalWeightKg.toLocaleString('en-IN')} kg</td>
              <td><Pill s="Sent" /></td>
            </tr>
          ))}
          {IN_TRANSIT.length === 0 && <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--text-4)' }}>No material on the road right now</td></tr>}
        </tbody>
      </TableCard>

      {/* ── Job drill-down ─────────────────────────────────────────── */}
      <Modal open={!!job} onClose={() => setJob(null)} title={job ? `Coating job ${job.dcNo}` : ''} wide>
        {job && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="badge-brand">{job.pcu}</span>
              <span className="badge-gray">{job.shadeName}</span>
              <span className={job.status === 'Overdue at Coater' ? 'badge-red' : 'badge-blue'}>{job.status}</span>
              <span className="badge-gray">Sent {fmtDate(job.date)} · {job.ageDays} days ago</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Cell k="Sent"     v={`${job.sentNos} nos`}     s={`${job.sentKg} kg`} />
              <Cell k="Returned" v={`${job.returnedNos} nos`} s={`${job.returnedKg} kg`} />
              <Cell k="Pending"  v={`${job.pendingNos} nos`}  s={`${job.pendingKg} kg`} danger={job.pendingNos > 0} />
              <Cell k="Coating charge" v={inr(job.coatingValue)} s={`${job.sqft.toLocaleString('en-IN')} sqft`} />
            </div>

            <div className="rounded-lg p-4" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-1)' }}>Weight gain check</p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-[11px]" style={{ color: 'var(--text-4)' }}>Expected</p><p className="font-semibold" style={{ color: 'var(--text-1)' }}>{job.expectedGainPct}%</p></div>
                <div><p className="text-[11px]" style={{ color: 'var(--text-4)' }}>Actual</p><p className="font-semibold" style={{ color: 'var(--text-1)' }}>{job.actualGainPct}%</p></div>
                <div><p className="text-[11px]" style={{ color: 'var(--text-4)' }}>Variance</p>
                  <p className={cn('font-semibold', job.withinTolerance ? 'text-green-600' : 'text-red-500')}>
                    {job.variancePct > 0 ? '+' : ''}{job.variancePct}%
                  </p></div>
              </div>
              <p className="text-[11px] mt-2" style={{ color: 'var(--text-4)' }}>
                {job.withinTolerance
                  ? 'Within the tolerance set on the section profile — inventory posted automatically.'
                  : 'Outside tolerance — held for review before the coated weight is posted to stock.'}
              </p>
            </div>

            <div>
              <p className="section-title text-sm mb-2">Returns received ({job.returns.length})</p>
              <div className="overflow-auto rounded-lg max-h-44" style={{ border: '1px solid var(--border-2)' }}>
                <table className="tbl">
                  <thead><tr><th>Return DC</th><th>Date</th><th>Delivered To</th><th className="num">Nos</th><th className="num">Weight</th></tr></thead>
                  <tbody>
                    {job.returns.map(r => (
                      <tr key={r.no}>
                        <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{r.no}</td>
                        <td className="text-xs whitespace-nowrap">{fmtDate(r.date)}</td>
                        <td className="text-xs">{locName(r.to)}</td>
                        <td className="num tabular-nums">{r.nos}</td>
                        <td className="num tabular-nums">{r.kg} kg</td>
                      </tr>
                    ))}
                    {job.returns.length === 0 && <tr><td colSpan={5} className="text-center py-6" style={{ color: 'var(--text-4)' }}>Nothing returned yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ── Flow map node ─────────────────────────────────────────────────── */
function Node({ id, nos, kg, caption, alert }: { id: string; nos: number; kg: number; caption: string; alert?: boolean }) {
  const l = LOCATIONS.find(x => x.id === id)!
  const Icon = NODE_ICON[l.type]
  return (
    <div className={cn('rounded-xl p-3.5 min-w-[13rem] flex-1 transition-colors', alert && 'ring-2 ring-red-400')}
      style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0"><Icon size={14} /></div>
        <div className="min-w-0">
          <p className="text-xs font-bold" style={{ color: 'var(--text-1)' }}>{l.code}</p>
          <p className="text-[10px] truncate" style={{ color: 'var(--text-4)' }}>{l.name.split('—')[l.name.includes('—') ? 1 : 0].trim()}</p>
        </div>
        {alert && <AlertTriangle size={13} className="text-red-500 ml-auto shrink-0" />}
      </div>
      <p className="text-lg font-bold tabular-nums leading-none" style={{ color: 'var(--text-1)' }}>{nos.toLocaleString('en-IN')} <span className="text-xs font-medium" style={{ color: 'var(--text-4)' }}>nos</span></p>
      <p className="text-xs font-medium tabular-nums mt-1" style={{ color: 'var(--text-2)' }}>{kg.toLocaleString('en-IN')} kg</p>
      <p className="text-[10px] mt-1" style={{ color: 'var(--text-4)' }}>{caption}</p>
    </div>
  )
}

function Arrow({ legs }: { legs: { label: string; nos: number; kg: number; dcs: number }[] }) {
  return (
    <div className="flex flex-col justify-center items-center gap-1 shrink-0 px-1">
      <ArrowRight size={18} className="text-brand rotate-90 lg:rotate-0" />
      <div className="text-[9px] leading-tight text-center hidden lg:block" style={{ color: 'var(--text-4)' }}>
        {legs.reduce((s, l) => s + l.dcs, 0)} DCs
      </div>
    </div>
  )
}

function Cell({ k, v, s, danger }: { k: string; v: string; s: string; danger?: boolean }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{k}</p>
      <p className={cn('text-sm font-bold mt-0.5 tabular-nums', danger && 'text-red-500')} style={danger ? undefined : { color: 'var(--text-1)' }}>{v}</p>
      <p className="text-[11px] tabular-nums" style={{ color: 'var(--text-4)' }}>{s}</p>
    </div>
  )
}
