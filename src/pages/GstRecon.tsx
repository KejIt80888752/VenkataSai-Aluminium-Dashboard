import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { ShieldCheck, ShieldAlert, FileSearch, IndianRupee } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Pager, usePaged, Empty, useChartTheme } from '@/components/ui'
import { ALL_RECON, RECON_SUMMARY, GSTR3B, type MatchStatus } from '@/data/gst2b'
import { inr, inr2, inrShort, fmtDate, csvDownload, cn } from '@/lib/utils'
import { COMPANY, FY } from '@/data/company'
import GstUploadMatch from '@/components/GstUploadMatch'

const STATUS_COLOR: Record<MatchStatus, string> = {
  'Matched': '#16a34a',
  'Value Mismatch': '#f59e0b',
  'In Books, not in 2B': '#ef4444',
  'In 2B, not in Books': '#8b5cf6',
  'GSTIN Mismatch': '#0891b2',
}
const badgeFor = (s: MatchStatus) =>
  s === 'Matched' ? 'badge-green'
  : s === 'Value Mismatch' ? 'badge-yellow'
  : s === 'In Books, not in 2B' ? 'badge-red'
  : s === 'In 2B, not in Books' ? 'badge-purple' : 'badge-blue'

export default function GstRecon() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All Status')
  const [view, setView] = useState('2B vs Purchase Register')
  const t = useChartTheme()

  const rows = useMemo(() => ALL_RECON.filter(r =>
    (status === 'All Status' || r.status === status) &&
    (q === '' || `${r.supplier} ${r.billNo} ${r.gstin}`.toLowerCase().includes(q.toLowerCase())),
  ), [q, status])

  const paged = usePaged(rows, 12)

  const donut = (Object.keys(STATUS_COLOR) as MatchStatus[])
    .map(s => ({ name: s, value: ALL_RECON.filter(r => r.status === s).length }))
    .filter(d => d.value > 0)

  const exportCsv = () => csvDownload('vsa-gst-2b-reconciliation.csv', [
    ['GSTR-2B vs purchase register', COMPANY.gstin, FY],
    [], ['Month', 'Supplier', 'GSTIN', 'Bill No', 'Bill Date', 'Books Taxable', 'Books Tax', '2B Taxable', '2B Tax', 'Difference', 'Status', 'Action'],
    ...rows.map(r => [r.month, r.supplier, r.gstin, r.billNo, r.billDate, r.booksTaxable, r.booksTax, r.b2Taxable, r.b2Tax, r.diffTax, r.status, r.action]),
    [], ['GSTR-3B vs books'], ['Month', 'Output (books)', 'Output (filed)', 'ITC (books)', 'ITC (claimed)', 'Net (books)', 'Net (filed)', 'Difference', 'Status'],
    ...GSTR3B.map(g => [g.month, g.outputBooks, g.outputFiled, g.itcBooks, g.itcClaimed, g.netBooks, g.netFiled, g.diff, g.status]),
  ])

  return (
    <div>
      <PageHead title="GST Reconciliation" sub={`GSTR-2B against the purchase register, and GSTR-3B against the ledger · ${COMPANY.gstin}`}>
        <Select value={view} onChange={setView} options={['2B vs Purchase Register', '3B vs Ledger', 'Upload & Match Your Files']} className="min-w-[15rem]" />
        {view !== 'Upload & Match Your Files' && <ExportBtn onClick={exportCsv} />}
      </PageHead>

      {view !== 'Upload & Match Your Files' && (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Match Rate"        value={`${RECON_SUMMARY.matchRate}%`} icon={ShieldCheck} tone="green" sub={`${RECON_SUMMARY.matched} of ${RECON_SUMMARY.total} bills tie exactly`} />
        <Stat label="Credit Safe to Claim" value={inr(RECON_SUMMARY.creditSafe)} icon={IndianRupee} tone="brand" sub="Reflected in 2B at the same value" />
        <Stat label="Credit at Risk"    value={inr(RECON_SUMMARY.creditAtRisk)} icon={ShieldAlert} tone="red" sub={`${RECON_SUMMARY.missingIn2B + RECON_SUMMARY.gstinMismatch} bills not confirmed by 2B`} />
        <Stat label="Unclaimed in 2B"   value={inr(RECON_SUMMARY.creditUnclaimed)} icon={FileSearch} tone="violet" sub={`${RECON_SUMMARY.missingInBooks} bills never entered in books`} />
      </div>
      )}

      {view === 'Upload & Match Your Files' && <GstUploadMatch />}

      {view === '2B vs Purchase Register' && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
            <div className="card">
              <p className="section-title text-base mb-1">Match Breakdown</p>
              <p className="section-sub mb-2">Every bill classified</p>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={donut} dataKey="value" nameKey="name" innerRadius={44} outerRadius={74} paddingAngle={2} stroke="none" isAnimationActive={false}>
                    {donut.map(d => <Cell key={d.name} fill={STATUS_COLOR[d.name as MatchStatus]} />)}
                  </Pie>
                  <Tooltip contentStyle={t.tooltip} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {donut.map(d => (
                  <div key={d.name} className="flex items-center gap-2 text-[11px]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLOR[d.name as MatchStatus] }} />
                    <span className="flex-1 truncate" style={{ color: 'var(--text-3)' }}>{d.name}</span>
                    <span className="font-medium" style={{ color: 'var(--text-2)' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card xl:col-span-2">
              <p className="section-title text-base mb-1">What to Do Next</p>
              <p className="section-sub mb-4">Grouped by the action the accountant has to take</p>
              <div className="space-y-3">
                <Action tone="green"  count={RECON_SUMMARY.matched}        label="Claim credit" note="Bill, value and GSTIN all agree with 2B." />
                <Action tone="amber"  count={RECON_SUMMARY.valueMismatch}  label="Ask supplier to amend" note="Taxable value differs — the supplier must correct it in the next GSTR-1." />
                <Action tone="red"    count={RECON_SUMMARY.missingIn2B}    label="Hold credit and follow up" note="Booked by us but never filed by the supplier. Credit is not available until it appears." />
                <Action tone="violet" count={RECON_SUMMARY.missingInBooks} label="Book the missing bill" note="Present in 2B but absent from the purchase register — credit is going unclaimed." />
                <Action tone="sky"    count={RECON_SUMMARY.gstinMismatch}  label="Fix the GSTIN" note="Supplier master carries the wrong GSTIN, so the bill will never auto-match." />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <SearchBox value={q} onChange={setQ} placeholder="Search supplier, bill no, GSTIN…" />
            <Select value={status} onChange={setStatus} options={['All Status', ...Object.keys(STATUS_COLOR)]} className="min-w-[13rem]" />
          </div>

          <TableCard>
            <thead>
              <tr><th>Supplier</th><th>Bill No</th><th>Date</th><th>Month</th>
                <th className="num">Books Taxable</th><th className="num">2B Taxable</th>
                <th className="num">Books Tax</th><th className="num">2B Tax</th><th className="num">Diff</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {paged.slice.map(r => (
                <tr key={r.id}>
                  <td className="max-w-[13rem] truncate font-medium" style={{ color: 'var(--text-1)' }}>{r.supplier}</td>
                  <td className="font-mono text-xs whitespace-nowrap">{r.billNo}</td>
                  <td className="text-xs whitespace-nowrap">{fmtDate(r.billDate)}</td>
                  <td className="text-xs">{r.month}</td>
                  <td className="num tabular-nums text-xs">{r.booksTaxable ? inr(r.booksTaxable) : '—'}</td>
                  <td className="num tabular-nums text-xs">{r.b2Taxable ? inr(r.b2Taxable) : '—'}</td>
                  <td className="num tabular-nums text-xs">{r.booksTax ? inr2(r.booksTax) : '—'}</td>
                  <td className="num tabular-nums text-xs">{r.b2Tax ? inr2(r.b2Tax) : '—'}</td>
                  <td className={cn('num tabular-nums text-xs font-medium', Math.abs(r.diffTax) > 1 ? 'text-red-500' : 'text-green-600')}>
                    {r.diffTax === 0 ? '—' : inr2(r.diffTax)}
                  </td>
                  <td><span className={badgeFor(r.status)}>{r.status}</span></td>
                  <td className="text-[11px] max-w-[15rem]">{r.action}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
          {rows.length === 0 && <Empty msg="No bills match these filters" />}
          <Pager {...paged} />
        </>
      )}

      {view === '3B vs Ledger' && (
        <>
          <div className="card mb-5">
            <p className="section-title text-base mb-1">Filed vs Books, Month by Month</p>
            <p className="section-sub mb-3">Output tax and input credit as filed in GSTR-3B against the ledger</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={GSTR3B} barSize={16} margin={{ left: -4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                <XAxis dataKey="month" tick={t.tick} axisLine={false} tickLine={false} />
                <YAxis tick={t.tick} axisLine={false} tickLine={false} tickFormatter={inrShort} width={62} />
                <Tooltip contentStyle={t.tooltip} formatter={(v: number, n) => [inr(v), n]} cursor={{ fill: 'rgba(15,91,143,.06)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />
                <Bar dataKey="outputBooks" name="Output — books"  fill="#0f5b8f" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="outputFiled" name="Output — filed"  fill="#9dcbec" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="itcBooks"    name="ITC — books"     fill="#16a34a" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="itcClaimed"  name="ITC — claimed"   fill="#86efac" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <TableCard maxH="26rem">
            <thead>
              <tr><th>Month</th><th className="num">Output (books)</th><th className="num">Output (filed)</th>
                <th className="num">ITC (books)</th><th className="num">ITC (claimed)</th>
                <th className="num">Net (books)</th><th className="num">Net (filed)</th><th className="num">Difference</th><th>Status</th></tr>
            </thead>
            <tbody>
              {GSTR3B.map(g => (
                <tr key={g.month}>
                  <td className="font-medium" style={{ color: 'var(--text-1)' }}>{g.month}</td>
                  <td className="num tabular-nums">{inr(g.outputBooks)}</td>
                  <td className="num tabular-nums">{g.outputFiled ? inr(g.outputFiled) : '—'}</td>
                  <td className="num tabular-nums text-green-600">{inr(g.itcBooks)}</td>
                  <td className="num tabular-nums text-green-600">{g.itcClaimed ? inr(g.itcClaimed) : '—'}</td>
                  <td className="num tabular-nums">{inr(g.netBooks)}</td>
                  <td className="num tabular-nums">{g.netFiled ? inr(g.netFiled) : '—'}</td>
                  <td className={cn('num tabular-nums font-medium', Math.abs(g.diff) > 500 ? 'text-amber-600' : 'text-green-600')}>
                    {g.status === 'Not Filed' ? '—' : inr(g.diff)}
                  </td>
                  <td>
                    <span className={g.status === 'Reconciled' ? 'badge-green' : g.status === 'Under Review' ? 'badge-yellow' : 'badge-gray'}>{g.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableCard>
          <p className="text-[11px] mt-3" style={{ color: 'var(--text-4)' }}>
            Differences arise where credit was deferred pending 2B confirmation, or where a bill was booked after the
            return was filed. Both are cleared in the following month's 3B.
          </p>
        </>
      )}
    </div>
  )
}

function Action({ tone, count, label, note }: { tone: string; count: number; label: string; note: string }) {
  const dot: Record<string, string> = { green: 'bg-green-500', amber: 'bg-amber-500', red: 'bg-red-500', violet: 'bg-violet-500', sky: 'bg-sky-500' }
  return (
    <div className="flex items-start gap-3">
      <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', dot[tone])} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{label}</p>
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-4)' }}>{note}</p>
      </div>
      <span className="text-lg font-bold tabular-nums shrink-0" style={{ color: 'var(--text-1)' }}>{count}</span>
    </div>
  )
}
