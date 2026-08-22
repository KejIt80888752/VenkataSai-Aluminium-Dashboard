import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { Scale, CheckCircle2, AlertTriangle, Percent, RefreshCw } from 'lucide-react'
import { PageHead, Stat, ExportBtn, TableCard, Select, useChartTheme } from '@/components/ui'
import { gainBySection, COATING_JOBS, COATING_TOTALS } from '@/data/challans'
import { profileOf } from '@/data/sections'
import { csvDownload, fmtDate, cn } from '@/lib/utils'
import { FY } from '@/data/company'

export default function CoatingRecon() {
  const t = useChartTheme()
  const [pcu, setPcu] = useState('All Coaters')
  const [posted, setPosted] = useState<string[]>([])

  const jobs = COATING_JOBS
    .filter(j => j.returnedNos > 0)
    .filter(j => pcu === 'All Coaters' || j.pcu === pcu)

  const outOfTol = jobs.filter(j => !j.withinTolerance)
  const netGainPct = +((COATING_TOTALS.gainKg / (COATING_TOTALS.returnedKg - COATING_TOTALS.gainKg)) * 100).toFixed(2)

  const chart = gainBySection.map(g => ({
    name: g.code.replace('VSA-', ''),
    Actual: g.actualGainPct,
    Expected: g.expected,
    variance: g.variancePct,
    tol: profileOf(g.code)!.tolerancePct,
  }))

  const exportCsv = () => csvDownload('vsa-coating-reconciliation.csv', [
    ['Section-wise coating gain', FY],
    [], ['Code', 'Section', 'Pieces Coated', 'Raw Weight (kg)', 'Coated Weight (kg)', 'Gain (kg)', 'Actual Gain %', 'Expected %', 'Variance %', 'Within Tolerance'],
    ...gainBySection.map(g => [g.code, g.name, g.nos, g.rawKg, g.coatedKg, g.gainKg, g.actualGainPct, g.expected, g.variancePct,
      Math.abs(g.variancePct) <= profileOf(g.code)!.tolerancePct ? 'Yes' : 'No']),
    [], ['Job-wise', ''], ['DC No', 'Date', 'PCU', 'Sent Nos', 'Returned Nos', 'Raw Kg', 'Coated Kg', 'Actual %', 'Expected %', 'Variance %', 'Status'],
    ...jobs.map(j => [j.dcNo, j.date, j.pcu, j.sentNos, j.returnedNos, (j.returnedKg / (1 + j.actualGainPct / 100)).toFixed(1), j.returnedKg,
      j.actualGainPct, j.expectedGainPct, j.variancePct, j.withinTolerance ? 'Within tolerance' : 'Review']),
  ])

  return (
    <div>
      <PageHead title="Coating Reconciliation" sub="Weight before and after the line, section by section, with automatic inventory posting">
        <Select value={pcu} onChange={setPcu} options={['All Coaters', 'PCU1', 'PCU2']} />
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Raw Weight Sent"    value={`${(COATING_TOTALS.returnedKg - COATING_TOTALS.gainKg).toLocaleString('en-IN', { maximumFractionDigits: 0 })} kg`} icon={Scale} tone="brand" sub="Portion returned so far" />
        <Stat label="Coated Weight Back" value={`${COATING_TOTALS.returnedKg.toLocaleString('en-IN')} kg`} icon={RefreshCw} tone="sky" sub={`${COATING_TOTALS.returnedNos.toLocaleString('en-IN')} pieces`} />
        <Stat label="Net Weight Gain"    value={`${COATING_TOTALS.gainKg.toLocaleString('en-IN')} kg`} icon={Percent} tone="green" sub={`${netGainPct}% across the mix`} />
        <Stat label="Outside Tolerance"  value={String(outOfTol.length)} icon={AlertTriangle} tone={outOfTol.length ? 'red' : 'green'} sub={`of ${jobs.length} reconciled jobs`} />
      </div>

      <div className="card mb-5">
        <p className="section-title text-base mb-1">Section-wise Gain — Actual vs Expected</p>
        <p className="section-sub mb-3">Thin profiles carry more surface per kilo, so they legitimately gain more. Amber bars sit outside the section's tolerance.</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chart} margin={{ left: -6, bottom: 30 }} barSize={13}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ ...t.tick, fontSize: 9 }} axisLine={false} tickLine={false} angle={-32} textAnchor="end" interval={0} height={62} />
            <YAxis tick={t.tick} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={44} />
            <Tooltip contentStyle={t.tooltip} formatter={(v: number, n) => [`${v}%`, n]} cursor={{ fill: 'rgba(15,91,143,.06)' }} />
            <ReferenceLine y={0} stroke={t.grid} />
            <Bar dataKey="Expected" fill="#cbd5e1" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="Actual" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {chart.map((c, i) => <Cell key={i} fill={Math.abs(c.variance) <= c.tol ? '#0f5b8f' : '#f59e0b'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div>
          <p className="section-title text-base mb-1">Section Adjustment Master</p>
          <p className="section-sub mb-3">The % the system applies when posting coated weight back to stock</p>
          <TableCard maxH="26rem">
            <thead>
              <tr><th>Section</th><th className="num">Pcs</th><th className="num">Raw kg</th><th className="num">Coated kg</th><th className="num">Gain</th><th className="num">Actual %</th><th className="num">Exp %</th><th className="num">Var</th></tr>
            </thead>
            <tbody>
              {gainBySection.map(g => {
                const ok = Math.abs(g.variancePct) <= profileOf(g.code)!.tolerancePct
                return (
                  <tr key={g.code}>
                    <td>
                      <p className="font-medium text-xs" style={{ color: 'var(--text-1)' }}>{g.name}</p>
                      <p className="font-mono text-[10px]" style={{ color: 'var(--text-4)' }}>{g.code}</p>
                    </td>
                    <td className="num tabular-nums text-xs">{g.nos.toLocaleString('en-IN')}</td>
                    <td className="num tabular-nums text-xs">{g.rawKg.toLocaleString('en-IN')}</td>
                    <td className="num tabular-nums text-xs">{g.coatedKg.toLocaleString('en-IN')}</td>
                    <td className="num tabular-nums text-xs text-green-600 font-medium">+{g.gainKg}</td>
                    <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{g.actualGainPct}%</td>
                    <td className="num tabular-nums text-xs" style={{ color: 'var(--text-4)' }}>{g.expected}%</td>
                    <td className={cn('num tabular-nums text-xs font-medium', ok ? 'text-green-600' : 'text-amber-600')}>
                      {g.variancePct > 0 ? '+' : ''}{g.variancePct}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </TableCard>
        </div>

        <div>
          <p className="section-title text-base mb-1">Job Reconciliation & Inventory Posting</p>
          <p className="section-sub mb-3">Jobs inside tolerance post automatically; the rest wait for a sign-off</p>
          <TableCard maxH="26rem">
            <thead>
              <tr><th>DC No</th><th>Date</th><th>PCU</th><th className="num">Nos</th><th className="num">Coated kg</th><th className="num">Var</th><th>Inventory</th></tr>
            </thead>
            <tbody>
              {jobs.map(j => {
                const isPosted = j.withinTolerance || posted.includes(j.dcNo)
                return (
                  <tr key={j.dcNo}>
                    <td className="font-medium whitespace-nowrap text-xs" style={{ color: 'var(--text-1)' }}>{j.dcNo}</td>
                    <td className="whitespace-nowrap text-xs">{fmtDate(j.date)}</td>
                    <td><span className="badge-brand">{j.pcu}</span></td>
                    <td className="num tabular-nums text-xs">{j.returnedNos}</td>
                    <td className="num tabular-nums text-xs">{j.returnedKg.toLocaleString('en-IN')}</td>
                    <td className={cn('num tabular-nums text-xs font-medium', j.withinTolerance ? 'text-green-600' : 'text-amber-600')}>
                      {j.variancePct > 0 ? '+' : ''}{j.variancePct}%
                    </td>
                    <td>
                      {isPosted
                        ? <span className="badge-green"><CheckCircle2 size={11} /> {j.withinTolerance ? 'Auto-posted' : 'Approved'}</span>
                        : <button onClick={() => setPosted(p => [...p, j.dcNo])} className="badge-yellow hover:bg-amber-200 transition-colors">
                            Approve &amp; post
                          </button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </TableCard>
          <p className="text-[11px] mt-3" style={{ color: 'var(--text-4)' }}>
            Posting adds the coated weight to the receiving location and writes off the raw weight held at the coater,
            so pieces and kilograms stay in step without a second entry.
          </p>
        </div>
      </div>
    </div>
  )
}
