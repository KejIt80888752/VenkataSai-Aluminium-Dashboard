import { useState } from 'react'
import { IndianRupee, PackageMinus, TrendingUp, CircleAlert, MapPin, CalendarClock } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Empty, Modal } from '@/components/ui'
import { PROJECTS, PROJECT_TOTALS, STAGES, rollup, type Project } from '@/data/projects'
import { inr, kg as kgFmt, fmtDate, csvDownload, cn } from '@/lib/utils'
import { FY } from '@/data/company'

const badgeFor = (s: string) =>
  s === 'Closed' ? 'badge-green'
  : s === 'Handover' ? 'badge-blue'
  : s === 'Installation' ? 'badge-purple'
  : s === 'Fabrication' ? 'badge-yellow' : 'badge-gray'

export default function Projects() {
  const [q, setQ] = useState('')
  const [stage, setStage] = useState('All Stages')
  const [open, setOpen] = useState<Project | null>(null)

  const rows = PROJECTS.filter(p =>
    (stage === 'All Stages' || p.stage === stage) &&
    (q === '' || `${p.no} ${p.name} ${p.client} ${p.site}`.toLowerCase().includes(q.toLowerCase())),
  )

  const exportCsv = () => csvDownload('vsa-turnkey-projects.csv', [
    ['Turnkey projects', FY],
    [], ['Project', 'Name', 'Client', 'Site', 'Stage', 'Material From Stock', 'Bought Outside',
         'Labour & Site', 'Total Cost', 'Billed', 'Profit', 'Margin %', 'Outstanding'],
    ...rows.map(p => {
      const r = rollup(p)
      return [p.no, p.name, p.client, p.site, p.stage, r.material, r.outside, r.site, r.cost,
              r.billed, r.profit, r.marginPct, r.outstanding]
    }),
  ])

  return (
    <div>
      <PageHead title="Turnkey Projects"
        sub="Material leaves stock on an internal issue, never on a sale bill — so nothing is counted twice">
        <SearchBox value={q} onChange={setQ} placeholder="Search project, client, site…" />
        <Select value={stage} onChange={setStage} options={['All Stages', ...STAGES]} />
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Material From Our Stock" value={inr(PROJECT_TOTALS.material)} icon={PackageMinus} tone="brand"
          sub={`${kgFmt(PROJECT_TOTALS.kg)} issued, at cost`} />
        <Stat label="Turnkey Billed" value={inr(PROJECT_TOTALS.billed)} icon={IndianRupee} tone="violet"
          sub="Taxable value on turnkey bills" />
        <Stat label="Profit on Finished Jobs" value={inr(PROJECT_TOTALS.closedProfit)} icon={TrendingUp}
          tone={PROJECT_TOTALS.closedProfit > 0 ? 'green' : 'red'}
          sub={`${PROJECT_TOTALS.closedCount} handed over · ${PROJECT_TOTALS.closedBilled
            ? Math.round(PROJECT_TOTALS.closedProfit / PROJECT_TOTALS.closedBilled * 100) : 0}% margin`} />
        <Stat label="Cost Carried on Live Jobs" value={inr(PROJECT_TOTALS.wip)} icon={CircleAlert} tone="amber"
          sub={`${PROJECT_TOTALS.wipCount} still running · not billed yet`} />
      </div>

      {/* ── The rule that keeps it out of double counting ─────────────── */}
      <div className="card mb-5">
        <p className="section-title text-base mb-1">How This Avoids Counting Twice</p>
        <p className="section-sub mb-4 max-w-4xl">
          You asked for a solution to the double entry. This is it, in three steps — the sale bill for
          material simply does not exist.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Step n="1" t="Material leaves on an issue note"
            d="Stock drops the moment it goes out, same as a sale would. But the value lands on the project at cost, not on a customer as revenue. No invoice, no GST, nothing to reverse later." />
          <Step n="2" t="Bought-outside goes straight to the project"
            d="Glass, hardware, anything bought for the job posts against the project directly. It never touches stock, so it cannot double up either." />
          <Step n="3" t="Only the turnkey bill goes to the customer"
            d="One bill, for the finished windows. Profit is that bill less the material at cost, the outside purchases and the site costs — the real number." />
        </div>
      </div>

      <TableCard maxH="30rem">
        <thead>
          <tr><th>Project</th><th>Client &amp; Site</th><th>Stage</th><th className="num">Material</th>
            <th className="num">Outside</th><th className="num">Site</th><th className="num">Total Cost</th>
            <th className="num">Billed</th><th className="num">Profit</th><th className="num">Margin</th></tr>
        </thead>
        <tbody>
          {rows.map(p => {
            const r = rollup(p)
            return (
              <tr key={p.id} className="cursor-pointer" onClick={() => setOpen(p)}>
                <td>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{p.no}</p>
                  <p className="text-[11px] max-w-[15rem] truncate" style={{ color: 'var(--text-4)' }}>{p.name}</p>
                </td>
                <td>
                  <p className="text-xs max-w-[14rem] truncate" style={{ color: 'var(--text-2)' }}>{p.client}</p>
                  <p className="text-[11px] max-w-[14rem] truncate" style={{ color: 'var(--text-4)' }}>{p.site}</p>
                </td>
                <td><span className={badgeFor(p.stage)}>{p.stage}</span></td>
                <td className="num tabular-nums text-xs">{inr(r.material)}</td>
                <td className="num tabular-nums text-xs">{r.outside ? inr(r.outside) : '—'}</td>
                <td className="num tabular-nums text-xs">{r.site ? inr(r.site) : '—'}</td>
                <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{inr(r.cost)}</td>
                <td className="num tabular-nums">{r.billed ? inr(r.billed) : '—'}</td>
                <td className="num tabular-nums font-semibold"
                  style={{ color: !r.complete ? 'var(--text-4)' : r.profit > 0 ? 'var(--green)' : 'var(--red)' }}>
                  {r.complete ? inr(r.profit) : <span className="text-[11px] font-normal">in progress</span>}
                </td>
                <td className="num tabular-nums text-xs"
                  style={{ color: !r.complete ? 'var(--text-4)' : undefined }}>
                  {r.complete ? `${r.marginPct}%` : '—'}
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && <tr><td colSpan={10}><Empty msg="No projects match" /></td></tr>}
        </tbody>
      </TableCard>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.no} — ${open.name}` : ''} wide>
        {open && <Detail p={open} />}
      </Modal>
    </div>
  )
}

function Detail({ p }: { p: Project }) {
  const r = rollup(p)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <span className={badgeFor(p.stage)}>{p.stage}</span>
        <span className="badge-gray flex items-center gap-1"><MapPin size={11} /> {p.site}</span>
        <span className="badge-blue flex items-center gap-1"><CalendarClock size={11} /> due {fmtDate(p.targetDate)}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Fig k="Material at cost" v={inr(r.material)} />
        <Fig k="Total cost" v={inr(r.cost)} />
        <Fig k="Turnkey billed" v={r.billed ? inr(r.billed) : '—'} />
        <Fig k={r.complete ? 'Profit' : 'Cost carried so far'}
          v={r.complete ? inr(r.profit) : inr(r.wip)}
          tone={!r.complete ? undefined : r.profit > 0 ? 'green' : 'red'} strong />
      </div>

      <Section title="Material issued from our stock"
        note="Internal issue notes — stock has already dropped, no sale bill was raised">
        <table className="tbl">
          <thead><tr><th>Issue No</th><th>Date</th><th>Section</th><th className="num">Nos</th>
            <th className="num">Kg</th><th className="num">Cost/Kg</th><th className="num">Value</th></tr></thead>
          <tbody>
            {p.issues.map(i => (
              <tr key={i.dcNo}>
                <td className="font-mono text-[11px] whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{i.dcNo}</td>
                <td className="text-xs whitespace-nowrap">{fmtDate(i.date)}</td>
                <td className="text-xs max-w-[14rem] truncate" title={i.name}>{i.name}</td>
                <td className="num tabular-nums text-xs">{i.nos}</td>
                <td className="num tabular-nums text-xs">{i.kg}</td>
                <td className="num tabular-nums text-xs">{i.costPerKg}</td>
                <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{inr(i.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {p.purchases.length > 0 && (
        <Section title="Bought outside for this project" note="Posted straight to the project, never into stock">
          <table className="tbl">
            <thead><tr><th>Date</th><th>Supplier</th><th>Bill No</th><th>What</th><th className="num">Value</th></tr></thead>
            <tbody>
              {p.purchases.map(x => (
                <tr key={x.billNo}>
                  <td className="text-xs whitespace-nowrap">{fmtDate(x.date)}</td>
                  <td className="text-xs max-w-[13rem] truncate">{x.supplier}</td>
                  <td className="text-xs font-mono whitespace-nowrap">{x.billNo}</td>
                  <td className="text-xs max-w-[15rem] truncate">{x.description}</td>
                  <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{inr(x.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {p.costs.length > 0 && (
        <Section title="Labour and site costs">
          <table className="tbl">
            <thead><tr><th>Date</th><th>Kind</th><th>What</th><th className="num">Value</th></tr></thead>
            <tbody>
              {p.costs.map((c, i) => (
                <tr key={i}>
                  <td className="text-xs whitespace-nowrap">{fmtDate(c.date)}</td>
                  <td><span className="badge-gray">{c.kind}</span></td>
                  <td className="text-xs max-w-[18rem] truncate">{c.description}</td>
                  <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{inr(c.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title="Turnkey bills to the customer"
        note={p.bills.length ? 'The only bills raised on this project' : 'Nothing billed yet'}>
        {p.bills.length === 0 ? <Empty msg="No turnkey bill raised yet" /> : (
          <table className="tbl">
            <thead><tr><th>Bill No</th><th>Date</th><th>Description</th><th className="num">Taxable</th>
              <th className="num">Total</th><th className="num">Received</th><th className="num">Balance</th></tr></thead>
            <tbody>
              {p.bills.map(b => (
                <tr key={b.no}>
                  <td className="font-medium text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{b.no}</td>
                  <td className="text-xs whitespace-nowrap">{fmtDate(b.date)}</td>
                  <td className="text-xs max-w-[16rem] truncate">{b.description}</td>
                  <td className="num tabular-nums text-xs">{inr(b.taxable)}</td>
                  <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{inr(b.total)}</td>
                  <td className="num tabular-nums text-xs">{inr(b.received)}</td>
                  <td className="num tabular-nums font-medium"
                    style={{ color: b.total - b.received > 0 ? 'var(--red)' : 'var(--green)' }}>
                    {b.total - b.received > 0 ? inr(b.total - b.received) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Work updates">
        <div className="p-1">
          {p.updates.map((u, i) => (
            <div key={i} className="flex gap-3 px-3 py-2" style={{ borderTop: i ? '1px solid var(--border-2)' : undefined }}>
              <span className="shrink-0"><span className={badgeFor(u.stage)}>{u.stage}</span></span>
              <span className="min-w-0">
                <p className="text-xs" style={{ color: 'var(--text-2)' }}>{u.note}</p>
                <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-4)' }}>{fmtDate(u.date)} · {u.by}</p>
              </span>
            </div>
          ))}
        </div>
      </Section>

      <p className="text-[11px] pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
        {kgFmt(r.kgIssued)} of our own material went into this job at a cost of {inr(r.material)}. It never
        appeared as a sale, so the {r.billed ? inr(r.billed) : 'turnkey bill'} is the only revenue on it —
        counted once, and traceable back to {p.client}.{' '}
        {!r.complete && <>The job is still at {p.stage.toLowerCase()}, so the cost is ahead of the billing;
        the profit reads only once it is handed over and billed in full.</>}
      </p>
    </div>
  )
}

const Section = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-4)' }}>{title}</p>
    {note && <p className="text-[11px] mb-1.5" style={{ color: 'var(--text-4)' }}>{note}</p>}
    <div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--border-2)', maxHeight: '15rem' }}>
      {children}
    </div>
  </div>
)

const Fig = ({ k, v, tone, strong }: { k: string; v: string; tone?: string; strong?: boolean }) => (
  <div className="rounded-lg p-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{k}</p>
    <p className={cn('tabular-nums mt-0.5', strong ? 'text-lg font-bold' : 'text-base font-semibold')}
      style={{ color: tone === 'red' ? 'var(--red)' : tone === 'green' ? 'var(--green)' : 'var(--text-1)' }}>{v}</p>
  </div>
)

const Step = ({ n, t, d }: { n: string; t: string; d: string }) => (
  <div className="rounded-lg p-3.5" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold mb-2"
      style={{ background: 'var(--brand)', color: '#fff' }}>{n}</span>
    <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-1)' }}>{t}</p>
    <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{d}</p>
  </div>
)
