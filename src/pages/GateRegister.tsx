import { useState } from 'react'
import { DoorOpen, ShieldAlert, Video, Truck, IndianRupee } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Empty, Modal } from '@/components/ui'
import { GATE_PASSES, GATES, type GatePass, type GateStatus } from '@/data/operations'
import { inr, kg, fmtDate, csvDownload, cn } from '@/lib/utils'
import { COMPANY, FY } from '@/data/company'
import { useCrud } from '@/lib/store'
import { CrudBar, RowActions, RecordModal, EditedDot, type Field, type Rec } from '@/components/crud'

const STATUSES: GateStatus[] = ['Billed', 'On Delivery Challan', 'Not Billed', 'Returnable — Not Back']

const FIELDS: Field[] = [
  { key: 'no',        label: 'Gate pass no', required: true },
  { key: 'date',      label: 'Date', type: 'date', required: true },
  { key: 'time',      label: 'Time out', hint: 'As on the gate clock, e.g. 14:35' },
  { key: 'gate',      label: 'Gate', type: 'select', options: GATES.map(g => g.id) },
  { key: 'party',     label: 'Party', required: true },
  { key: 'vehicle',   label: 'Vehicle no' },
  { key: 'section',   label: 'Section', half: false },
  { key: 'nos',       label: 'Pieces', type: 'number' },
  { key: 'weightKg',  label: 'Weight (kg)', type: 'number' },
  { key: 'value',     label: 'Stock value', type: 'number' },
  { key: 'linkedDoc', label: 'Document against it', hint: 'Invoice or delivery challan number' },
  { key: 'status',    label: 'Status', type: 'select', options: STATUSES },
  { key: 'camera',    label: 'Camera' },
  { key: 'guard',     label: 'Guard on duty' },
]

const idOf = (g: GatePass) => g.no


const badgeFor = (s: GateStatus) =>
  s === 'Billed' ? 'badge-green'
  : s === 'On Delivery Challan' ? 'badge-blue'
  : s === 'Not Billed' ? 'badge-red' : 'badge-yellow'

/** Anything leaving the premises with no bill and no challan behind it. */
const isUnaccounted = (g: GatePass) => g.status === 'Not Billed'

export default function GateRegister() {
  const [q, setQ] = useState('')
  const [gate, setGate] = useState('All Gates')
  const [status, setStatus] = useState('All Status')
  const [open, setOpen] = useState<GatePass | null>(null)
  const [edit, setEdit] = useState<GatePass | null>(null)
  const crud = useCrud<GatePass>('gate-passes', GATE_PASSES, idOf)
  const list = crud.rows

  const rows = list.filter(g =>
    (gate === 'All Gates' || g.gateLabel === gate) &&
    (status === 'All Status' || g.status === status) &&
    (q === '' || `${g.no} ${g.party} ${g.vehicle} ${g.linkedDoc} ${g.section}`.toLowerCase().includes(q.toLowerCase())),
  )

  const unaccounted = list.filter(isUnaccounted)
  const notBack = list.filter(g => g.status === 'Returnable — Not Back')

  const exportCsv = () => csvDownload('vsa-gate-register.csv', [
    [`Gate register — material out against documents · ${COMPANY.name}`, FY],
    [], ['Gate Pass', 'Date', 'Time', 'Gate', 'Vehicle', 'Party', 'Section', 'Nos', 'Weight Kg',
         'Value', 'Linked Document', 'Status', 'Camera', 'Clip Reference', 'Guard'],
    ...rows.map(g => [g.no, g.date, g.time, g.gateLabel, g.vehicle, g.party, g.section, g.nos, g.weightKg,
                      g.value, g.linkedDoc, g.status, g.camera, g.clipRef, g.guard]),
  ])

  return (
    <div>
      <PageHead title="Gate Register"
        sub="Every load that left the shop, the godown or the 4th floor — and the document behind it">
        <SearchBox value={q} onChange={setQ} placeholder="Search pass, party, vehicle…" />
        <Select value={gate} onChange={setGate} options={['All Gates', ...GATES.map(g => g.label)]} className="min-w-[13rem]" />
        <Select value={status} onChange={setStatus} options={['All Status', ...STATUSES]} className="min-w-[12rem]" />
        <ExportBtn onClick={exportCsv} />
        <CrudBar noun="Gate Pass" fields={FIELDS} changes={crud.changes} onRestore={crud.restore}
          onAdd={rec => crud.add(asPass(rec))}
          onImport={recs => crud.addMany(recs.map((r, i) => asPass(r, i)))} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Loads Out" value={String(list.length)} icon={DoorOpen} tone="brand"
          sub={`${kg(list.reduce((s, g) => s + g.weightKg, 0))} across three gates`} />
        <Stat label="Left Without a Bill" value={String(unaccounted.length)} icon={ShieldAlert}
          tone={unaccounted.length ? 'red' : 'green'}
          sub={unaccounted.length ? `${inr(unaccounted.reduce((s, g) => s + g.value, 0))} unaccounted` : 'Everything documented'} />
        <Stat label="Returnable Not Back" value={String(notBack.length)} icon={Truck}
          tone={notBack.length ? 'amber' : 'green'} sub="Went out on a returnable pass" />
        <Stat label="Value Moved" value={inr(list.reduce((s, g) => s + g.value, 0))} icon={IndianRupee}
          tone="violet" sub="Stock value across all passes" />
      </div>

      {unaccounted.length > 0 && (
        <div className="card mb-5" style={{ borderColor: 'var(--red)' }}>
          <p className="section-title text-base mb-1 flex items-center gap-2">
            <ShieldAlert size={15} style={{ color: 'var(--red)' }} /> Left Without a Bill or Challan
          </p>
          <p className="section-sub mb-3">
            These loads went out of the gate with no document against them. Each row carries the camera and the
            timestamp, so the footage can be pulled up straight away.
          </p>
          <div className="space-y-2">
            {unaccounted.map(g => (
              <button key={g.no} onClick={() => setOpen(g)}
                className="w-full text-left rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 transition-colors hover:brightness-95"
                style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <span className="min-w-0">
                  <span className="text-sm font-medium block truncate" style={{ color: 'var(--text-1)' }}>
                    {g.no} · {g.party}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>
                    {fmtDate(g.date)} {g.time} · {g.gateLabel} · {g.vehicle} · {g.guard}
                  </span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                    <Video size={12} /> {g.camera}
                  </span>
                  <span className="tabular-nums font-semibold" style={{ color: 'var(--red)' }}>{inr(g.value)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="section-title text-base mb-1">All Gate Passes</p>
      <p className="section-sub mb-3">Newest first, across shop, godown and 4th floor</p>
      <TableCard maxH="32rem">
        <thead>
          <tr><th>Pass No</th><th>Date</th><th>Time</th><th>Gate</th><th>Party</th><th>Vehicle</th>
            <th className="num">Weight</th><th className="num">Value</th><th>Document</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          {rows.map(g => (
            <tr key={g.no} className="cursor-pointer" onClick={() => setOpen(g)}>
              <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>
                <EditedDot isNew={crud.isNew(g.no)} isEdited={crud.isEdited(g.no)} />{g.no}
              </td>
              <td className="text-xs whitespace-nowrap">{fmtDate(g.date)}</td>
              <td className="text-xs tabular-nums">{g.time}</td>
              <td className="text-xs whitespace-nowrap">{g.gate}</td>
              <td className="text-xs max-w-[13rem] truncate" title={g.party}>{g.party}</td>
              <td className="text-xs whitespace-nowrap tabular-nums">{g.vehicle}</td>
              <td className="num tabular-nums text-xs">{kg(g.weightKg)}</td>
              <td className={cn('num tabular-nums font-medium')}
                style={{ color: isUnaccounted(g) ? 'var(--red)' : 'var(--text-1)' }}>{inr(g.value)}</td>
              <td className="text-xs whitespace-nowrap">{g.linkedDoc}</td>
              <td><span className={badgeFor(g.status)}>{g.status}</span></td>
              <td onClick={e => e.stopPropagation()}>
                <RowActions label={g.no} onEdit={() => setEdit(g)} onDelete={() => crud.remove(g.no)} />
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={11}><Empty msg="No gate passes match" /></td></tr>}
        </tbody>
      </TableCard>

      <RecordModal open={!!edit} title={`Edit ${edit?.no ?? ''}`} fields={FIELDS}
        initial={edit as Rec | null}
        onSave={rec => { if (edit) crud.update(edit.no, asPassPatch(rec)); setEdit(null) }}
        onClose={() => setEdit(null)}
        onDelete={() => { if (edit) crud.remove(edit.no); setEdit(null) }} />

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.no} — gate pass` : ''}>
        {open && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className={badgeFor(open.status)}>{open.status}</span>
              <span className="badge-gray">{open.gate}</span>
              <span className="badge-blue">{fmtDate(open.date)} {open.time}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <F k="Gate" v={open.gateLabel} />
              <F k="Guard on duty" v={open.guard} />
              <F k="Party" v={open.party} />
              <F k="Vehicle" v={open.vehicle} />
              <F k="Section" v={open.section} />
              <F k="Quantity" v={`${open.nos} nos · ${kg(open.weightKg)}`} />
              <F k="Document against it" v={open.linkedDoc} />
              <F k="Stock value" v={inr(open.value)} />
            </dl>
            <div className="rounded-lg p-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
              <p className="text-[10px] uppercase tracking-wide mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-4)' }}>
                <Video size={11} /> Camera footage
              </p>
              <p className="text-sm mb-0.5" style={{ color: 'var(--text-1)' }}>{open.camera}</p>
              <p className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>{open.clipRef}</p>
              <p className="text-[11px] mt-2" style={{ color: 'var(--text-4)' }}>
                The recorder stores footage by camera and timestamp. This reference points to the exact minute this
                load went out, so the clip can be found without scrubbing through the day.
              </p>
            </div>
            {isUnaccounted(open) && (
              <div className="rounded-lg p-3" style={{ background: 'color-mix(in srgb, var(--red) 8%, transparent)', border: '1px solid var(--red)' }}>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--red)' }}>Nothing raised against this load</p>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
                  {kg(open.weightKg)} worth {inr(open.value)} left {open.gateLabel} at {open.time} with no invoice and no
                  delivery challan. Either a bill was missed, or the material should not have gone out.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

const F = ({ k, v }: { k: string; v: string }) => (
  <div><dt className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{k}</dt>
    <dd className="mt-0.5" style={{ color: 'var(--text-1)' }}>{v}</dd></div>
)

const asPassPatch = (r: Rec): Partial<GatePass> => ({
  ...r,
  gateLabel: GATES.find(g => g.id === r.gate)?.label ?? r.gate,
  nos: Number(r.nos) || 0, weightKg: Number(r.weightKg) || 0, value: Number(r.value) || 0,
})

function asPass(r: Rec, _i = 0): GatePass {
  const date = r.date || new Date().toISOString().slice(0, 10)
  const time = r.time || new Date().toTimeString().slice(0, 5)
  const gate = r.gate || GATES[0].id
  return {
    status: 'Billed', linkedDoc: '—', camera: GATES.find(g => g.id === gate)?.cams[0] ?? '',
    ...asPassPatch(r), date, time, gate,
    clipRef: `${gate}-${date.replace(/-/g, '')}-${time.replace(':', '')}`,
  } as GatePass
}
