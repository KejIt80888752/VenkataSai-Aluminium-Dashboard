import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Users, Target, IndianRupee, Globe } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Pager, usePaged, Empty, Pill, useChartTheme, SERIES } from '@/components/ui'
import { LEADS, type Lead } from '@/data/txns'
import { inr, inrShort, fmtDate, csvDownload } from '@/lib/utils'
import { COMPANY, TODAY } from '@/data/company'

import { useCrud } from '@/lib/store'
import { CrudBar, RowActions, RecordModal, EditedDot, type Field, type Rec } from '@/components/crud'

const FIELDS: Field[] = [
  { key: 'date',        label: 'Date', type: 'date', required: true },
  { key: 'name',        label: 'Name', required: true },
  { key: 'phone',       label: 'Phone', required: true },
  { key: 'area',        label: 'Area' },
  { key: 'source',      label: 'Source', type: 'select', options: ['Website Enquiry', 'Walk-in', 'Referral', 'WhatsApp', 'Google Search', 'Facebook'] },
  { key: 'owner',       label: 'Followed up by' },
  { key: 'requirement', label: 'Requirement', type: 'textarea' },
  { key: 'estValue',    label: 'Estimated value', type: 'number' },
  { key: 'stage',       label: 'Stage', type: 'select', options: ['New', 'Contacted', 'Quoted', 'Converted', 'Dropped'] },
  { key: 'kind',        label: 'Work', type: 'select', options: ['Trading', 'Turnkey'] },
  { key: 'segment',     label: 'Kind of customer', type: 'select',
    options: ['Builder', 'Architect', 'Contractor', 'Fabricator', 'Homeowner'] },
  { key: 'architect',   label: 'Architect' },
  { key: 'measuredOn',  label: 'Site measured on', type: 'date' },
  { key: 'nextFollowUp',label: 'Next follow-up', type: 'date' },
  { key: 'followUpDays',label: 'Follow up every (days)', type: 'number' },
]

const idOf = (l: Lead) => l.id

const STAGES = ['New', 'Contacted', 'Quoted', 'Converted', 'Dropped'] as const

export default function Leads() {
  const [q, setQ]         = useState('')
  const [stage, setStage] = useState('All Stages')
  const [src, setSrc]     = useState('All Sources')
  const [kind, setKind]   = useState('All Work')
  const [seg, setSeg]     = useState('All Kinds of Customer')
  const t = useChartTheme()
  const [edit, setEdit] = useState<Lead | null>(null)
  const crud = useCrud<Lead>('leads', LEADS, idOf)
  const list = crud.rows

  const sources = useMemo(() => ['All Sources', ...new Set(list.map(l => l.source))], [list])

  const rows = useMemo(() => list.filter(l =>
    (stage === 'All Stages' || l.stage === stage) &&
    (src === 'All Sources'  || l.source === src) &&
    (kind === 'All Work' || l.kind === kind) &&
    (seg === 'All Kinds of Customer' || l.segment === seg) &&
    (q === '' || `${l.name} ${l.area} ${l.requirement} ${l.owner}`.toLowerCase().includes(q.toLowerCase())),
  ), [list, q, stage, src, kind, seg])

  const paged = usePaged(rows, 12)

  const converted = LEADS.filter(l => l.stage === 'Converted')
  const pipeline  = LEADS.filter(l => !['Converted', 'Dropped'].includes(l.stage)).reduce((s, l) => s + l.estValue, 0)
  const web       = LEADS.filter(l => l.source === 'Website Enquiry' || l.source === 'Google Search' || l.source === 'Facebook')

  const byStage  = STAGES.map(s => ({ name: s, value: LEADS.filter(l => l.stage === s).length }))
  const bySource = [...new Set(LEADS.map(l => l.source))].map(s => ({
    name: s, value: LEADS.filter(l => l.source === s).reduce((a, l) => a + l.estValue, 0),
  })).sort((a, b) => b.value - a.value)

  const exportCsv = () => csvDownload('vsa-leads.csv', [
    ['Date', 'Name', 'Phone', 'Area', 'Source', 'Requirement', 'Est. Value', 'Stage', 'Owner'],
    ...rows.map(l => [l.date, l.name, l.phone, l.area, l.source, l.requirement, l.estValue, l.stage, l.owner]),
  ])

  return (
    <div>
      <PageHead title="Lead Generation" sub={`Enquiries from ${COMPANY.website.replace('https://', '')}, walk-ins, WhatsApp and referrals`}>
        <ExportBtn onClick={exportCsv} />
        <Select value={kind} onChange={setKind} options={['All Work', 'Trading', 'Turnkey']} />
        <Select value={seg} onChange={setSeg}
          options={['All Kinds of Customer', 'Builder', 'Architect', 'Contractor', 'Fabricator', 'Homeowner']}
          className="min-w-[13rem]" />
        <CrudBar noun="Lead" fields={FIELDS} changes={crud.changes} onRestore={crud.restore}
          onAdd={rec => crud.add(asLead(rec))}
          onImport={recs => crud.addMany(recs.map((r, i) => asLead(r, i)))} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Total Leads"     value={String(LEADS.length)}  icon={Users}       tone="brand"  sub="This financial year" />
        <Stat label="Converted"       value={String(converted.length)} icon={Target}   tone="green"  sub={`${Math.round((converted.length / LEADS.length) * 100)}% conversion`} />
        <Stat label="Open Pipeline"   value={inr(pipeline)}         icon={IndianRupee} tone="violet" sub="Estimated value in play" />
        <Stat label="Digital Enquiries" value={String(web.length)}  icon={Globe}       tone="sky"    sub="Website, Google, Facebook" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
        <div className="card">
          <p className="section-title text-base mb-1">Pipeline by Stage</p>
          <p className="section-sub mb-2">Lead count at each step</p>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie isAnimationActive={false} data={byStage} dataKey="value" nameKey="name" innerRadius={44} outerRadius={74} paddingAngle={2} stroke="none">
                {byStage.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
              </Pie>
              <Tooltip contentStyle={t.tooltip} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {byStage.map((s, i) => (
              <div key={s.name} className="flex items-center gap-2 text-[11px]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SERIES[i % SERIES.length] }} />
                <span className="flex-1" style={{ color: 'var(--text-3)' }}>{s.name}</span>
                <span className="font-medium" style={{ color: 'var(--text-2)' }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card xl:col-span-2">
          <p className="section-title text-base mb-1">Enquiry Value by Source</p>
          <p className="section-sub mb-3">Where the money-making enquiries come from</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={bySource} layout="vertical" margin={{ left: 40, right: 16 }} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} horizontal={false} />
              <XAxis type="number" tick={t.tick} axisLine={false} tickLine={false} tickFormatter={inrShort} />
              <YAxis type="category" dataKey="name" tick={{ ...t.tick, fontSize: 10 }} axisLine={false} tickLine={false} width={118} />
              <Tooltip contentStyle={t.tooltip} formatter={(v: number) => [inr(v), 'Est. value']} cursor={{ fill: 'rgba(15,91,143,.06)' }} />
              <Bar isAnimationActive={false} dataKey="value" fill="#0f5b8f" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, area, requirement…" />
        <Select value={stage} onChange={setStage} options={['All Stages', ...STAGES]} />
        <Select value={src} onChange={setSrc} options={sources} />
      </div>

      {/* ── Who has to be rung today ─────────────────────────────── */}
      <FollowUps leads={list} />

      <TableCard>
        <thead>
          <tr><th>Date</th><th>Lead</th><th>Work</th><th>Customer</th><th>Source</th><th>Requirement</th>
            <th className="num">Est. Value</th><th>Next Call</th><th>Owner</th><th>Stage</th><th /></tr>
        </thead>
        <tbody>
          {paged.slice.map(l => (
            <tr key={l.id}>
              <td className="whitespace-nowrap text-xs">{fmtDate(l.date)}</td>
              <td>
                <p className="font-medium" style={{ color: 'var(--text-1)' }}>
                  <EditedDot isNew={crud.isNew(l.id)} isEdited={crud.isEdited(l.id)} />{l.name}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>{l.phone}</p>
              </td>
              <td><span className={l.kind === 'Turnkey' ? 'badge-purple' : 'badge-gray'}>{l.kind}</span></td>
              <td className="text-xs whitespace-nowrap">
                {l.segment}
                {l.architect !== '—' && <span className="block text-[10px]" style={{ color: 'var(--text-4)' }}>{l.architect}</span>}
              </td>
              <td className="text-xs whitespace-nowrap">{l.source}</td>
              <td className="max-w-[15rem] truncate text-xs">{l.requirement}</td>
              <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(l.estValue)}</td>
              <td className="text-xs whitespace-nowrap"
                style={{ color: l.nextFollowUp && l.nextFollowUp < TODAY && l.stage !== 'Converted' && l.stage !== 'Dropped' ? 'var(--red)' : undefined }}>
                {l.nextFollowUp ? fmtDate(l.nextFollowUp) : '—'}
                <span className="block text-[10px]" style={{ color: 'var(--text-4)' }}>every {l.followUpDays}d</span>
              </td>
              <td className="text-xs whitespace-nowrap">{l.owner}</td>
              <td><Pill s={l.stage} /></td>
              <td><RowActions label={l.name} onEdit={() => setEdit(l)} onDelete={() => crud.remove(l.id)} /></td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      <RecordModal open={!!edit} title={`Edit ${edit?.name ?? ''}`} fields={FIELDS}
        initial={edit as Rec | null}
        onSave={rec => { if (edit) crud.update(edit.id, rec as Partial<Lead>); setEdit(null) }}
        onClose={() => setEdit(null)}
        onDelete={() => { if (edit) crud.remove(edit.id); setEdit(null) }} />

      {rows.length === 0 && <Empty msg="No leads match these filters" />}
      <Pager {...paged} />
    </div>
  )
}

function asLead(r: Rec, i = 0): Lead {
  return {
    id: `L-${Date.now().toString(36)}${i}`,
    date: r.date || new Date().toISOString().slice(0, 10),
    stage: r.stage || 'New',
    kind: r.kind || 'Trading',
    segment: r.segment || 'Homeowner',
    architect: r.architect || '—',
    attachments: [],
    ...r,
    estValue: Number(r.estValue) || 0,
    followUpDays: Number(r.followUpDays) || 7,
  } as unknown as Lead
}

/* ── Today's calls, and the ones already missed ─────────────────────────── */
function FollowUps({ leads }: { leads: Lead[] }) {
  const live = leads.filter(l => l.stage !== 'Converted' && l.stage !== 'Dropped' && l.nextFollowUp)
  const overdue = live.filter(l => l.nextFollowUp < TODAY).sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp))
  const today = live.filter(l => l.nextFollowUp === TODAY)
  const soon = live.filter(l => l.nextFollowUp > TODAY).sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp)).slice(0, 6)

  if (!live.length) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
      <Column title="Overdue" tone="red" note="Should already have been rung" items={overdue.slice(0, 6)} count={overdue.length} />
      <Column title="Today" tone="brand" note="On the list for today" items={today} count={today.length} />
      <Column title="Coming up" tone="green" note="Next few days" items={soon} count={soon.length} />
    </div>
  )
}

function Column({ title, note, tone, items, count }: {
  title: string; note: string; tone: string; items: Lead[]; count: number
}) {
  const colour = tone === 'red' ? 'var(--red)' : tone === 'green' ? 'var(--green)' : 'var(--brand)'
  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="section-title text-base">{title}</p>
        <span className="tabular-nums text-lg font-bold" style={{ color: colour }}>{count}</span>
      </div>
      <p className="section-sub mb-3">{note}</p>
      {items.length === 0
        ? <p className="text-xs" style={{ color: 'var(--text-4)' }}>Nothing here</p>
        : (
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {items.map(l => (
              <div key={l.id} className="rounded-lg px-3 py-2"
                style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>{l.name}</span>
                  <span className="text-[11px] tabular-nums shrink-0" style={{ color: colour }}>{fmtDate(l.nextFollowUp)}</span>
                </div>
                <p className="text-[11px] truncate" style={{ color: 'var(--text-4)' }}>
                  {l.segment} · {l.kind} · {l.owner} · {inr(l.estValue)}
                </p>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
