import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { TrendingUp, TrendingDown, AlertTriangle, IndianRupee, BellRing, Check } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Empty, Modal, useChartTheme } from '@/components/ui'
import { PRICE_WATCH, PRICE_SUMMARY, type PriceWatch as Watch } from '@/data/prices'
import { CATEGORIES } from '@/data/catalogue'
import { inr, inr2, fmtDate, csvDownload, cn } from '@/lib/utils'
import { TODAY, FY } from '@/data/company'

const STATUSES = ['Selling Below Cost', 'Cost Rose — SP Pending', 'Margin Slipped', 'Healthy'] as const

const badgeFor = (s: Watch['status']) =>
  s === 'Healthy' ? 'badge-green'
  : s === 'Margin Slipped' ? 'badge-yellow'
  : s === 'Cost Rose — SP Pending' ? 'badge-purple' : 'badge-red'

/* Worst first — a section sold below its own cost is the one to open. */
const rank = (s: Watch['status']) => STATUSES.indexOf(s)

export default function PriceWatch() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('Needs Attention')
  const [cat, setCat] = useState('All Categories')
  const [open, setOpen] = useState<Watch | null>(null)
  const [settled, setSettled] = useState<string[]>([])
  const t = useChartTheme()

  const rows = useMemo(() => PRICE_WATCH.filter(w =>
    (status === 'All Status' || (status === 'Needs Attention' ? w.status !== 'Healthy' : w.status === status)) &&
    (cat === 'All Categories' || w.category === cat) &&
    (q === '' || `${w.code} ${w.name}`.toLowerCase().includes(q.toLowerCase())),
  ).sort((a, b) => rank(a.status) - rank(b.status) || a.marginPct - b.marginPct), [q, status, cat])

  const outstanding = PRICE_WATCH.filter(w => w.status !== 'Healthy' && !settled.includes(w.code))

  const exportCsv = () => csvDownload('vsa-price-watch.csv', [
    ['Cost against selling rate', FY, `as on ${TODAY}`],
    [], ['Code', 'Product', 'Category', 'Latest Cost', 'Previous Cost', 'Cost Change %',
         'Selling Rate', 'Margin % Now', 'Margin % When Set', 'SP Last Updated', 'Days', 'Status'],
    ...rows.map(w => [w.code, w.name, w.category, w.latestCost, w.previousCost, w.costChangePct,
                      w.sellingRate, w.marginPct, w.marginWhenSet, w.spUpdated, w.daysSinceSpUpdate, w.status]),
  ])

  return (
    <div>
      <PageHead title="Cost & Selling Rate"
        sub="What each section costs now against what we are still selling it for">
        <SearchBox value={q} onChange={setQ} placeholder="Search code or product…" />
        <Select value={status} onChange={setStatus}
          options={['Needs Attention', 'All Status', ...STATUSES]} className="min-w-[13rem]" />
        <Select value={cat} onChange={setCat} options={['All Categories', ...CATEGORIES]} />
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Selling Below Cost" value={String(PRICE_SUMMARY.belowCost)} icon={AlertTriangle}
          tone={PRICE_SUMMARY.belowCost ? 'red' : 'green'} sub="Every sale loses money" />
        <Stat label="Cost Rose, Rate Not Changed" value={String(PRICE_SUMMARY.pending)} icon={TrendingUp}
          tone={PRICE_SUMMARY.pending ? 'amber' : 'green'} sub="Margin quietly gone" />
        <Stat label="Margin Under 8%" value={String(PRICE_SUMMARY.slipped)} icon={TrendingDown} tone="violet"
          sub="Thin enough to check" />
        <Stat label="Giving Away" value={inr(PRICE_SUMMARY.giveaway)} icon={IndianRupee} tone="red"
          sub="On stock in hand, at today's rates" />
      </div>

      {/* ── The reminder that keeps coming back ────────────────────────── */}
      {outstanding.length > 0 && (
        <div className="card mb-5" style={{ borderColor: 'var(--red)' }}>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
            <p className="section-title text-base flex items-center gap-2">
              <BellRing size={15} style={{ color: 'var(--red)' }} />
              Selling Rate Pending on {outstanding.length} {outstanding.length === 1 ? 'Item' : 'Items'}
            </p>
            {settled.length > 0 && (
              <button className="btn-ghost !text-xs shrink-0" onClick={() => setSettled([])}>
                {settled.length} marked done — undo
              </button>
            )}
          </div>
          <p className="section-sub mb-3">
            This list does not clear itself. It stays, and the badge stays with it, until each rate is
            either changed or ticked off deliberately.
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {outstanding.slice(0, 12).map(w => (
              <div key={w.code} className="rounded-lg p-3 flex flex-wrap items-center justify-between gap-3"
                style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <span className="min-w-0">
                  <span className="text-sm font-medium block truncate" style={{ color: 'var(--text-1)' }}>{w.name}</span>
                  <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>
                    Cost {inr2(w.previousCost)} → {inr2(w.latestCost)} · selling {inr2(w.sellingRate)} ·
                    rate last set {w.daysSinceSpUpdate} days ago
                  </span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-right">
                    <span className="tabular-nums font-semibold block text-sm"
                      style={{ color: w.marginPct < 0 ? 'var(--red)' : 'var(--text-1)' }}>{w.marginPct}%</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-4)' }}>was {w.marginWhenSet}%</span>
                  </span>
                  <button className="btn-outline !py-1 !text-xs" onClick={() => setOpen(w)}>Open</button>
                  <button className="btn-ghost !py-1 !text-xs" onClick={() => setSettled(s => [...s, w.code])}>
                    <Check size={13} /> Done
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="section-title text-base mb-1">Every Section</p>
      <p className="section-sub mb-3">Cost taken from the latest lot received, not from a rate card</p>
      <TableCard maxH="30rem">
        <thead>
          <tr><th>Code</th><th>Product</th><th className="num">Cost Now</th><th className="num">Was</th>
            <th className="num">Change</th><th className="num">Selling</th><th className="num">Margin</th>
            <th className="num">Rate Set</th><th>Status</th></tr>
        </thead>
        <tbody>
          {rows.map(w => (
            <tr key={w.code} className="cursor-pointer" onClick={() => setOpen(w)}>
              <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{w.code}</td>
              <td className="text-xs max-w-[16rem] truncate" title={w.name}>{w.name}</td>
              <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{inr2(w.latestCost)}</td>
              <td className="num tabular-nums text-xs">{inr2(w.previousCost)}</td>
              <td className="num tabular-nums text-xs font-medium"
                style={{ color: w.costChangePct > 0 ? 'var(--red)' : 'var(--green)' }}>
                {w.costChangePct > 0 ? '+' : ''}{w.costChangePct}%
              </td>
              <td className="num tabular-nums">{inr2(w.sellingRate)}</td>
              <td className={cn('num tabular-nums font-semibold')}
                style={{ color: w.marginPct < 0 ? 'var(--red)' : w.marginPct < 8 ? 'var(--amber, #f59e0b)' : 'var(--green)' }}>
                {w.marginPct}%
              </td>
              <td className="num tabular-nums text-xs"
                style={{ color: w.daysSinceSpUpdate > 60 ? 'var(--red)' : undefined }}>{w.daysSinceSpUpdate}d</td>
              <td><span className={badgeFor(w.status)}>{w.status}</span></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={9}><Empty msg="Nothing matches — margins are holding" /></td></tr>}
        </tbody>
      </TableCard>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ''} wide>
        {open && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className={badgeFor(open.status)}>{open.status}</span>
              <span className="badge-gray font-mono">{open.code}</span>
              <span className="badge-blue">Rate set {fmtDate(open.spUpdated)}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Fig k="Cost now" v={inr2(open.latestCost)} />
              <Fig k="Selling at" v={inr2(open.sellingRate)} />
              <Fig k="Margin now" v={`${open.marginPct}%`} tone={open.marginPct < 8 ? 'red' : 'green'} strong />
              <Fig k="When rate was set" v={`${open.marginWhenSet}%`} />
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: 'var(--text-4)' }}>
                Cost on each purchase
              </p>
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={open.history.map(h => ({ ...h, label: fmtDate(h.date) }))}
                  margin={{ top: 6, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid stroke={t.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={t.tick} tickLine={false} axisLine={false} />
                  <YAxis tick={t.tick} tickLine={false} axisLine={false}
                    domain={['dataMin - 8', 'dataMax + 8']} width={44} />
                  <Tooltip contentStyle={t.tooltip} formatter={(v: number) => inr2(v)} />
                  <ReferenceLine y={open.sellingRate} stroke="var(--green)" strokeDasharray="4 4"
                    label={{ value: 'Selling rate', fontSize: 10, fill: t.tick.fill, position: 'insideTopRight' }} />
                  <Line type="monotone" dataKey="ratePerKg" stroke="var(--brand)" strokeWidth={2}
                    dot={{ r: 3 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--border-2)', maxHeight: '12rem' }}>
              <table className="tbl">
                <thead><tr><th>Received</th><th>Supplier</th><th>DC No</th><th className="num">Rate/Kg</th></tr></thead>
                <tbody>
                  {[...open.history].reverse().map((h, i) => (
                    <tr key={i}>
                      <td className="text-xs whitespace-nowrap">{fmtDate(h.date)}</td>
                      <td className="text-xs max-w-[14rem] truncate" title={h.supplier}>{h.supplier}</td>
                      <td className="text-xs whitespace-nowrap font-mono">{h.dcNo}</td>
                      <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{inr2(h.ratePerKg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg p-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
              <p className="text-sm mb-1" style={{ color: 'var(--text-1)' }}>
                {open.status === 'Healthy'
                  ? 'Margin is holding. Nothing to do.'
                  : open.status === 'Selling Below Cost'
                  ? `Every kilogram sold at ${inr2(open.sellingRate)} loses ${inr2(open.latestCost - open.sellingRate)}.`
                  : `To get back to ${open.marginWhenSet}%, the selling rate needs to be ${inr2(+(open.latestCost / (1 - open.marginWhenSet / 100)).toFixed(2))}.`}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>
                The rate itself is changed on the product, in the catalogue. This screen only makes sure it
                is not forgotten.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

const Fig = ({ k, v, tone, strong }: { k: string; v: string; tone?: string; strong?: boolean }) => (
  <div className="rounded-lg p-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{k}</p>
    <p className={cn('tabular-nums mt-0.5', strong ? 'text-lg font-bold' : 'text-base font-semibold')}
      style={{ color: tone === 'red' ? 'var(--red)' : tone === 'green' ? 'var(--green)' : 'var(--text-1)' }}>{v}</p>
  </div>
)
