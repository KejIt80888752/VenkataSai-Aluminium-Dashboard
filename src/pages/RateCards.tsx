import { useState, useMemo } from 'react'
import { Tags, Users, TrendingDown, ShieldCheck, Calculator, ArrowUp } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Empty } from '@/components/ui'
import { RATE_CARDS, CUSTOMER_LEVELS, LEVEL_NAMES, rateFor, cardFor, type Level } from '@/data/rates'
import { CLIENTS } from '@/data/parties'
import { CATEGORIES } from '@/data/catalogue'
import { inr, inr2, csvDownload, cn } from '@/lib/utils'
import { FY } from '@/data/company'

const levelBadge = (l: Level) =>
  l === 4 ? 'badge-purple' : l === 3 ? 'badge-blue' : l === 2 ? 'badge-yellow' : 'badge-gray'

export default function RateCards() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All Categories')

  // the trial line at the top
  const [code, setCode] = useState(RATE_CARDS[0]?.code ?? '')
  const [client, setClient] = useState(CLIENTS[0].name)
  const [qty, setQty] = useState('120')
  const [given, setGiven] = useState('')

  const cust = CLIENTS.find(c => c.name === client)!
  const card = cardFor(code)
  const applied = useMemo(() => rateFor(code, Number(qty) || 0, cust.type), [code, qty, cust.type])

  const askedRate = Number(given) || applied?.rate || 0
  const belowFloor = applied ? askedRate < applied.floor : false
  const discountPct = applied && applied.rate > 0
    ? +(((applied.rate - askedRate) / applied.rate) * 100).toFixed(1) : 0

  const rows = useMemo(() => RATE_CARDS.filter(c =>
    (cat === 'All Categories' || c.category === cat) &&
    (q === '' || `${c.code} ${c.name}`.toLowerCase().includes(q.toLowerCase())),
  ), [q, cat])

  const exportCsv = () => csvDownload('vsa-rate-cards.csv', [
    ['Rate cards — four rates per section', FY],
    [], ['Code', 'Item', 'Unit', 'List',
         'Counter from', 'Counter rate', 'Fabricator from', 'Fabricator rate',
         'Dealer from', 'Dealer rate', 'Bulk from', 'Bulk rate', 'Floor', 'Cost'],
    ...rows.map(c => [c.code, c.name, c.unit, c.listRate,
      ...c.tiers.flatMap(t => [t.fromQty, t.rate]), c.floor, c.cost]),
    [], ['Customer', 'Type', 'Starts on'],
    ...CUSTOMER_LEVELS.map(c => [c.name, c.type, c.levelName]),
  ])

  return (
    <div>
      <PageHead title="Rate Cards" sub="Four rates for every section — the customer sets one, the quantity can better it">
        <SearchBox value={q} onChange={setQ} placeholder="Search code or item…" />
        <Select value={cat} onChange={setCat} options={['All Categories', ...CATEGORIES]} />
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Sections Priced" value={String(RATE_CARDS.length)} icon={Tags} tone="brand" sub="Four rates each" />
        <Stat label="Customers Placed" value={String(CUSTOMER_LEVELS.length)} icon={Users} tone="violet"
          sub="Each starting on a rate" />
        <Stat label="Best Rate Off List" value="8%" icon={TrendingDown} tone="sky" sub="Bulk against counter" />
        <Stat label="Floor" value="Cost + 6%" icon={ShieldCheck} tone="green" sub="Nobody sells below it" />
      </div>

      {/* ── Try a line ────────────────────────────────────────────────── */}
      <div className="card mb-5">
        <p className="section-title text-base mb-1 flex items-center gap-2">
          <Calculator size={15} className="text-brand" /> What Would This Line Be Rated At
        </p>
        <p className="section-sub mb-4 max-w-4xl">
          Pick a customer and a quantity. The rate is worked out the same way it will be on the bill, and it
          says which of the two decided it.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div><label className="label">Section</label>
            <Select value={code} onChange={setCode} options={RATE_CARDS.map(c => c.code)} className="!w-full" /></div>
          <div><label className="label">Customer</label>
            <Select value={client} onChange={setClient} options={CLIENTS.map(c => c.name)} className="!w-full" /></div>
          <div><label className="label">Quantity ({card?.unit})</label>
            <input className="input w-full text-right tabular-nums" value={qty} onChange={e => setQty(e.target.value)} /></div>
        </div>

        {!applied || !card ? <Empty msg="Pick a section" /> : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,20rem] gap-4">
            <div>
              {/* the ladder, with the applied rung marked */}
              <div className="space-y-1.5">
                {card.tiers.map(t => {
                  const on = t.level === applied.level
                  const reached = Number(qty) >= t.fromQty
                  return (
                    <div key={t.level} className="rounded-lg px-3 py-2.5 flex flex-wrap items-center justify-between gap-3"
                      style={{
                        background: on ? 'color-mix(in srgb, var(--brand) 10%, transparent)' : 'var(--bg-card2)',
                        border: `1px solid ${on ? 'var(--brand)' : 'var(--border-2)'}`,
                      }}>
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className={levelBadge(t.level)}>{t.name}</span>
                        <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>
                          {t.fromQty === 0 ? 'any quantity' : `from ${t.fromQty} ${card.unit}`}
                          {!reached && t.fromQty > 0 && ` · ${t.fromQty - (Number(qty) || 0)} more to reach`}
                        </span>
                      </span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-4)' }}>
                          {t.level === 1 ? 'list' : `−${(((card.listRate - t.rate) / card.listRate) * 100).toFixed(1)}%`}
                        </span>
                        <span className="tabular-nums font-semibold"
                          style={{ color: on ? 'var(--brand)' : 'var(--text-2)' }}>{inr2(t.rate)}</span>
                      </span>
                    </div>
                  )
                })}
              </div>

              <p className="text-[11.5px] mt-3" style={{ color: 'var(--text-3)' }}>
                {applied.because === 'customer'
                  ? <>Given because {cust.name.split(' ').slice(0, 3).join(' ')} is a {cust.type.toLowerCase()} — the quantity on its own would only have earned {LEVEL_NAMES[applied.quantityLevel]}.</>
                  : applied.because === 'quantity'
                  ? <>Earned by the quantity. As a {cust.type.toLowerCase()} they would normally be on {LEVEL_NAMES[applied.customerLevel]}; {qty} {card.unit} moves the line up.</>
                  : <>Both the customer and the quantity land on the same rate.</>}
                {applied.next && applied.next.moreQty > 0 && (
                  <> Another <strong>{applied.next.moreQty} {card.unit}</strong> on this line would bring it to {applied.next.name} at {inr2(applied.next.rate)}.</>
                )}
              </p>
            </div>

            {/* what the salesman may do */}
            <div className="rounded-lg p-4" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>Rate that applies</p>
              <p className="text-2xl font-bold tabular-nums mt-0.5" style={{ color: 'var(--brand)' }}>
                {inr2(applied.rate)}<span className="text-xs font-normal">/{card.unit}</span>
              </p>

              <label className="label mt-4">If the salesman gives less</label>
              <input className="input w-full text-right tabular-nums" value={given} placeholder={String(applied.rate)}
                style={belowFloor ? { borderColor: 'var(--red)', color: 'var(--red)' } : undefined}
                onChange={e => setGiven(e.target.value)} />

              <div className="mt-3 pt-3 space-y-1.5 text-xs" style={{ borderTop: '1px solid var(--border-2)' }}>
                <Row k="Discount given" v={discountPct > 0 ? `${discountPct}%` : '—'} />
                <Row k="Floor" v={inr2(applied.floor)} />
                <Row k="Line value" v={inr(Math.round((Number(qty) || 0) * askedRate))} strong />
              </div>

              {belowFloor ? (
                <p className="text-[11px] mt-3 flex items-start gap-1.5" style={{ color: 'var(--red)' }}>
                  <ShieldCheck size={12} className="mt-0.5 shrink-0" />
                  Below the floor of {inr2(applied.floor)}. A salesman cannot save this — only the owner can
                  let it through, and it is recorded against them.
                </p>
              ) : (
                <p className="text-[11px] mt-3 flex items-start gap-1.5" style={{ color: 'var(--text-4)' }}>
                  <ArrowUp size={12} className="mt-0.5 shrink-0" />
                  Room to come down {inr2(+(askedRate - applied.floor).toFixed(2))} more before the floor.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Which customer starts where ───────────────────────────────── */}
      <div className="card mb-5">
        <p className="section-title text-base mb-1">Where Each Customer Starts</p>
        <p className="section-sub mb-3">
          Set by what kind of customer they are. Quantity can move a line above this, never below it.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([1, 2, 3, 4] as Level[]).map(l => {
            const on = CUSTOMER_LEVELS.filter(c => c.level === l)
            return (
              <div key={l} className="rounded-lg p-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <span className={levelBadge(l)}>{LEVEL_NAMES[l]}</span>
                <p className="text-lg font-bold tabular-nums mt-1.5" style={{ color: 'var(--text-1)' }}>{on.length}</p>
                <p className="text-[10.5px] leading-tight" style={{ color: 'var(--text-4)' }}>
                  {on.length ? [...new Set(on.map(c => c.type))].join(', ') : 'reached by quantity only'}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <p className="section-title text-base mb-1">Every Section, All Four Rates</p>
      <p className="section-sub mb-3">The quantity beside each rate is what earns it</p>
      <TableCard maxH="30rem">
        <thead>
          <tr><th>Code</th><th>Item</th><th className="num">List</th>
            <th className="num">Counter</th><th className="num">Fabricator</th>
            <th className="num">Dealer</th><th className="num">Bulk</th>
            <th className="num">Floor</th><th className="num">Cost</th></tr>
        </thead>
        <tbody>
          {rows.map(c => (
            <tr key={c.code} style={c.code === code ? { background: 'color-mix(in srgb, var(--brand) 6%, transparent)' } : undefined}>
              <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{c.code}</td>
              <td className="text-xs max-w-[15rem] truncate" title={c.name}>{c.name}</td>
              <td className="num tabular-nums text-xs">{inr2(c.listRate)}</td>
              {c.tiers.map(t => (
                <td key={t.level} className="num tabular-nums">
                  <span className="font-medium" style={{ color: 'var(--text-1)' }}>{inr2(t.rate)}</span>
                  <span className="block text-[10px]" style={{ color: 'var(--text-4)' }}>
                    {t.fromQty === 0 ? 'any qty' : `${t.fromQty}+ ${c.unit}`}
                  </span>
                </td>
              ))}
              <td className="num tabular-nums font-medium" style={{ color: 'var(--red)' }}>{inr2(c.floor)}</td>
              <td className="num tabular-nums text-xs" style={{ color: 'var(--text-4)' }}>{inr2(c.cost)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={9}><Empty msg="Nothing matches" /></td></tr>}
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
