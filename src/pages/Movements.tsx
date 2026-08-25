import { useState, useMemo } from 'react'
import { ArrowDownLeft, ArrowUpRight, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Pager, usePaged, Empty, Pill } from '@/components/ui'
import { MOVEMENTS, type Movement } from '@/data/txns'
import { fmtDate, csvDownload } from '@/lib/utils'
import { useCrud } from '@/lib/store'
import { CrudBar, RowActions, RecordModal, EditedDot, type Field, type Rec } from '@/components/crud'

const FIELDS: Field[] = [
  { key: 'date',  label: 'Date', type: 'date', required: true },
  { key: 'type',  label: 'Type', type: 'select', options: ['Inward', 'Outward', 'Adjustment', 'Return'] },
  { key: 'code',  label: 'Item code', required: true },
  { key: 'name',  label: 'Product', required: true, half: false },
  { key: 'pcs',   label: 'Pieces', type: 'number' },
  { key: 'kg',    label: 'Weight (kg)', type: 'number' },
  { key: 'ref',   label: 'Reference', hint: 'Bill, DC or adjustment note' },
  { key: 'party', label: 'Party' },
]

const idOf = (m: Movement) => m.id

export default function Movements() {
  const [q, setQ]     = useState('')
  const [type, setType] = useState('All Types')
  const [edit, setEdit] = useState<Movement | null>(null)
  const crud = useCrud<Movement>('movements', MOVEMENTS, idOf)
  const list = crud.rows

  const rows = useMemo(() => list.filter(m =>
    (type === 'All Types' || m.type === type) &&
    (q === '' || `${m.code} ${m.name} ${m.ref} ${m.party}`.toLowerCase().includes(q.toLowerCase())),
  ), [q, type])

  const paged = usePaged(rows, 14)
  const sum = (t: string) => list.filter(m => m.type === t).reduce((s, m) => s + m.kg, 0)

  const exportCsv = () => csvDownload('vsa-stock-movements.csv', [
    ['Date', 'Type', 'Code', 'Product', 'Pieces', 'Weight (kg)', 'Reference', 'Party'],
    ...rows.map(m => [m.date, m.type, m.code, m.name, m.pcs, m.kg, m.ref, m.party]),
  ])

  return (
    <div>
      <PageHead title="Stock Movement" sub="Inward receipts, outward deliveries, sales returns and godown adjustments">
        <ExportBtn onClick={exportCsv} />
        <CrudBar noun="Movement" fields={FIELDS} changes={crud.changes} onRestore={crud.restore}
          onAdd={rec => crud.add(asMove(rec))}
          onImport={recs => crud.addMany(recs.map((r, i) => asMove(r, i)))} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Inward"      value={`${Math.round(sum('Inward')).toLocaleString('en-IN')} kg`}     icon={ArrowDownLeft}     tone="green"  sub={`${list.filter(m => m.type === 'Inward').length} entries`} />
        <Stat label="Outward"     value={`${Math.round(sum('Outward')).toLocaleString('en-IN')} kg`}    icon={ArrowUpRight}      tone="brand"  sub={`${list.filter(m => m.type === 'Outward').length} entries`} />
        <Stat label="Returns"     value={`${Math.round(sum('Return')).toLocaleString('en-IN')} kg`}     icon={RotateCcw}         tone="sky"    sub="Back into stock" />
        <Stat label="Adjustments" value={`${Math.round(sum('Adjustment')).toLocaleString('en-IN')} kg`} icon={SlidersHorizontal} tone="amber"  sub="Cutting loss / recount" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search product, reference, party…" />
        <Select value={type} onChange={setType} options={['All Types', 'Inward', 'Outward', 'Return', 'Adjustment']} />
      </div>

      <TableCard>
        <thead>
          <tr><th>Date</th><th>Type</th><th>Code</th><th>Product</th><th className="num">Pieces</th><th className="num">Weight</th><th>Reference</th><th>Party</th><th /></tr>
        </thead>
        <tbody>
          {paged.slice.map(m => (
            <tr key={m.id}>
              <td className="whitespace-nowrap">
                <EditedDot isNew={crud.isNew(m.id)} isEdited={crud.isEdited(m.id)} />{fmtDate(m.date)}
              </td>
              <td><Pill s={m.type} /></td>
              <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{m.code}</td>
              <td className="max-w-[14rem] truncate">{m.name}</td>
              <td className="num tabular-nums">{m.pcs}</td>
              <td className="num tabular-nums">{m.kg.toLocaleString('en-IN')} kg</td>
              <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-3)' }}>{m.ref}</td>
              <td className="max-w-[14rem] truncate text-xs">{m.party}</td>
              <td><RowActions label={m.ref} onEdit={() => setEdit(m)} onDelete={() => crud.remove(m.id)} /></td>
            </tr>
          ))}
        </tbody>
      </TableCard>

      <RecordModal open={!!edit} title={`Edit ${edit?.ref ?? ''}`} fields={FIELDS}
        initial={edit as Rec | null}
        onSave={rec => { if (edit) crud.update(edit.id, rec as Partial<Movement>); setEdit(null) }}
        onClose={() => setEdit(null)}
        onDelete={() => { if (edit) crud.remove(edit.id); setEdit(null) }} />
      {rows.length === 0 && <Empty msg="No movements match these filters" />}
      <Pager {...paged} />
    </div>
  )
}

function asMove(r: Rec, i = 0): Movement {
  return {
    id: `M-${Date.now().toString(36)}${i}`,
    date: r.date || new Date().toISOString().slice(0, 10),
    type: r.type || 'Inward',
    ...r,
    pcs: Number(r.pcs) || 0, kg: Number(r.kg) || 0,
  } as Movement
}
