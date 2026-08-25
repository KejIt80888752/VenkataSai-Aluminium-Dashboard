import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Users, Target, IndianRupee, Globe } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Pager, usePaged, Empty, Pill, useChartTheme, SERIES } from '@/components/ui'
import { LEADS, type Lead } from '@/data/txns'
import { inr, inrShort, fmtDate, csvDownload } from '@/lib/utils'
import { COMPANY } from '@/data/company'

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
]

const idOf = (l: Lead) => l.id

const STAGES = ['New', 'Contacted', 'Quoted', 'Converted', 'Dropped'] as const

export default function Leads() {
  const [q, setQ]         = useState('')
  const [stage, setStage] = useState('All Stages')
  const [src, setSrc]     = useState('All Sources')
  const t = useChartTheme()
  const [edit, setEdit] = useState<Lead | null>(null)
  const crud = useCrud<Lead>('leads', LEADS, idOf)
  const list = crud.rows

  const sources = useMemo(() => ['All Sources', ...new Set(list.map(l => l.source))], [list])

  const rows = useMemo(() => list.filter(l =>
    (stage === 'All Stages' || l.stage === stage) &&
    (src === 'All Sources'  || l.source === src) &&
    (q === '' || `${l.name} ${l.area} ${l.requirement} ${l.owner}`.toLowerCase().includes(q.toLowerCase())),
  ), [list, q, stage, src])

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

      <TableCard>
        <thead>
          <tr><th>Date</th><th>Lead</th><th>Area</th><th>Source</th><th>Requirement</th><th className="num">Est. Value</th><th>Owner</th><th>Stage</th><th /></tr>
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
              <td className="text-xs whitespace-nowrap">{l.area}</td>
              <td className="text-xs whitespace-nowrap">{l.source}</td>
              <td className="max-w-[15rem] truncate text-xs">{l.requirement}</td>
              <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(l.estValue)}</td>
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
    ...r,
    estValue: Number(r.estValue) || 0,
  } as Lead
}
