import { useState, useMemo } from 'react'
import { Upload, FileSpreadsheet, X, ShieldCheck, ShieldAlert, FileSearch, Wand2, Lock } from 'lucide-react'
import { Stat, TableCard, ExportBtn, Empty, Select } from '@/components/ui'
import {
  parseCsv, findHeader, detectColumns, toRows, matchSheets,
  type Field, type SheetRow, type MatchRow, type MatchKind,
} from '@/lib/csv'
import { inr, inr2, csvDownload, cn } from '@/lib/utils'

interface Loaded { name: string; header: string[]; rows: string[][]; headerIdx: number; cols: Record<Field, number> }

const FIELDS: { key: Field; label: string; needed?: boolean }[] = [
  { key: 'gstin',    label: 'Supplier GSTIN', needed: true },
  { key: 'supplier', label: 'Supplier name' },
  { key: 'billNo',   label: 'Invoice / bill no', needed: true },
  { key: 'billDate', label: 'Invoice date' },
  { key: 'taxable',  label: 'Taxable value', needed: true },
  { key: 'cgst',     label: 'CGST' },
  { key: 'sgst',     label: 'SGST' },
  { key: 'igst',     label: 'IGST' },
  { key: 'tax',      label: 'Total tax (if single column)' },
]

const badgeFor = (s: MatchKind) =>
  s === 'Matched' ? 'badge-green'
  : s === 'Value Mismatch' ? 'badge-yellow'
  : s === 'In Books, not in 2B' ? 'badge-red'
  : s === 'In 2B, not in Books' ? 'badge-purple' : 'badge-blue'

const ACTION: Record<MatchKind, string> = {
  'Matched': 'Claim credit',
  'Value Mismatch': 'Ask supplier to amend in next GSTR-1',
  'In Books, not in 2B': 'Hold credit — follow up with supplier',
  'In 2B, not in Books': 'Locate the bill and book it — credit available',
  'GSTIN Mismatch': 'Correct the GSTIN in the supplier master',
}

export default function GstUploadMatch() {
  const [books, setBooks] = useState<Loaded | null>(null)
  const [b2, setB2] = useState<Loaded | null>(null)
  const [tolerance, setTolerance] = useState('1')
  const [statusF, setStatusF] = useState('All Status')

  const load = (file: File, set: (l: Loaded) => void) => {
    const reader = new FileReader()
    reader.onload = () => {
      const rows = parseCsv(String(reader.result ?? ''))
      if (!rows.length) return
      const headerIdx = findHeader(rows)
      const header = rows[headerIdx]
      set({ name: file.name, header, rows, headerIdx, cols: detectColumns(header) })
    }
    reader.readAsText(file)
  }

  const booksRows: SheetRow[] = useMemo(() => books ? toRows(books.rows, books.headerIdx, books.cols) : [], [books])
  const b2Rows: SheetRow[]    = useMemo(() => b2 ? toRows(b2.rows, b2.headerIdx, b2.cols) : [], [b2])

  const result: MatchRow[] = useMemo(
    () => (booksRows.length && b2Rows.length ? matchSheets(booksRows, b2Rows, Number(tolerance) || 1) : []),
    [booksRows, b2Rows, tolerance],
  )

  const shown = result.filter(r => statusF === 'All Status' || r.status === statusF)
  const by = (s: MatchKind) => result.filter(r => r.status === s)
  const creditSafe = by('Matched').reduce((s, r) => s + r.booksTax, 0)
  const creditRisk = [...by('In Books, not in 2B'), ...by('GSTIN Mismatch')].reduce((s, r) => s + r.booksTax, 0)
  const creditMissed = by('In 2B, not in Books').reduce((s, r) => s + r.b2Tax, 0)

  const exportCsv = () => csvDownload('vsa-2b-match-result.csv', [
    ['GSTR-2B matched against purchase register'],
    ['Purchase register file', books?.name ?? '—', 'rows', booksRows.length],
    ['GSTR-2B file', b2?.name ?? '—', 'rows', b2Rows.length],
    [], ['Supplier', 'GSTIN', 'Bill No', 'Date', 'Books Taxable', 'Books Tax', '2B Taxable', '2B Tax', 'Difference', 'Status', 'Action'],
    ...shown.map(r => [r.supplier, r.gstin, r.billNo, r.billDate, r.booksTaxable, r.booksTax, r.b2Taxable, r.b2Tax, r.diffTax, r.status, ACTION[r.status]]),
  ])

  return (
    <div className="space-y-5">
      <div className="card">
        <p className="section-title text-base mb-1">Match Your Own Files</p>
        <p className="section-sub mb-4 max-w-3xl">
          Download GSTR-2B from the portal and export the purchase register from Tally, save both as CSV, and drop them
          in below. The columns are picked up automatically and can be corrected if anything lands in the wrong place.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <Drop label="Purchase register (your books)" file={books} onFile={f => load(f, setBooks)} onClear={() => setBooks(null)} rows={booksRows.length} />
          <Drop label="GSTR-2B (from the portal)"      file={b2}    onFile={f => load(f, setB2)}    onClear={() => setB2(null)}    rows={b2Rows.length} />
        </div>

        <p className="text-[11px] mt-4 flex items-start gap-1.5" style={{ color: 'var(--text-4)' }}>
          <Lock size={12} className="mt-0.5 shrink-0" />
          Both files are read inside this browser. Nothing is uploaded and no copy is kept anywhere.
        </p>
      </div>

      {(books || b2) && (
        <div className="grid md:grid-cols-2 gap-4">
          {books && <Columns title="Purchase register columns" loaded={books} onChange={c => setBooks({ ...books, cols: c })} />}
          {b2 && <Columns title="GSTR-2B columns" loaded={b2} onChange={c => setB2({ ...b2, cols: c })} />}
        </div>
      )}

      {result.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Stat label="Match Rate" value={`${Math.round((by('Matched').length / result.length) * 100)}%`}
              icon={ShieldCheck} tone="green" sub={`${by('Matched').length} of ${result.length} bills tie exactly`} />
            <Stat label="Credit Safe to Claim" value={inr(creditSafe)} icon={ShieldCheck} tone="brand" sub="Confirmed by 2B at the same value" />
            <Stat label="Credit at Risk" value={inr(creditRisk)} icon={ShieldAlert} tone="red"
              sub={`${by('In Books, not in 2B').length + by('GSTIN Mismatch').length} bills not confirmed`} />
            <Stat label="Unclaimed in 2B" value={inr(creditMissed)} icon={FileSearch} tone="violet"
              sub={`${by('In 2B, not in Books').length} bills never booked`} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusF} onChange={setStatusF}
              options={['All Status', 'Matched', 'Value Mismatch', 'In Books, not in 2B', 'In 2B, not in Books', 'GSTIN Mismatch']}
              className="min-w-[13rem]" />
            <div className="flex items-center gap-2">
              <label className="text-xs whitespace-nowrap" style={{ color: 'var(--text-3)' }}>Rounding tolerance ₹</label>
              <input className="input !w-20 !py-1.5 text-right tabular-nums" value={tolerance} onChange={e => setTolerance(e.target.value)} />
            </div>
            <div className="ml-auto"><ExportBtn onClick={exportCsv} label="Export match report" /></div>
          </div>

          <TableCard maxH="34rem">
            <thead>
              <tr><th>Supplier</th><th>Bill No</th><th>Date</th>
                <th className="num">Books Taxable</th><th className="num">2B Taxable</th>
                <th className="num">Books Tax</th><th className="num">2B Tax</th><th className="num">Diff</th>
                <th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.key + i}>
                  <td className="max-w-[13rem] truncate font-medium" style={{ color: 'var(--text-1)' }}>{r.supplier}</td>
                  <td className="font-mono text-xs whitespace-nowrap">{r.billNo}</td>
                  <td className="text-xs whitespace-nowrap">{r.billDate || '—'}</td>
                  <td className="num tabular-nums text-xs">{r.booksTaxable ? inr(r.booksTaxable) : '—'}</td>
                  <td className="num tabular-nums text-xs">{r.b2Taxable ? inr(r.b2Taxable) : '—'}</td>
                  <td className="num tabular-nums text-xs">{r.booksTax ? inr2(r.booksTax) : '—'}</td>
                  <td className="num tabular-nums text-xs">{r.b2Tax ? inr2(r.b2Tax) : '—'}</td>
                  <td className={cn('num tabular-nums text-xs font-medium', Math.abs(r.diffTax) > Number(tolerance) ? 'text-red-500' : 'text-green-600')}>
                    {r.diffTax === 0 ? '—' : inr2(r.diffTax)}
                  </td>
                  <td><span className={badgeFor(r.status)}>{r.status}</span></td>
                  <td className="text-[11px] max-w-[15rem]">{ACTION[r.status]}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
          {shown.length === 0 && <Empty msg="No bills in this category" />}
        </>
      )}

      {books && b2 && result.length === 0 && (
        <Empty msg="No rows could be read — check that the GSTIN and bill number columns are mapped correctly above" />
      )}
    </div>
  )
}

/* ── File slot ─────────────────────────────────────────────────────── */
function Drop({ label, file, onFile, onClear, rows }: {
  label: string; file: Loaded | null; onFile: (f: File) => void; onClear: () => void; rows: number
}) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f) }}
      className={cn('rounded-xl p-5 text-center transition-colors', over && 'ring-2 ring-brand')}
      style={{ background: 'var(--bg-card2)', border: '1px dashed var(--border-2)' }}>
      {file ? (
        <>
          <FileSpreadsheet size={22} className="mx-auto text-brand mb-2" />
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>{file.name}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-4)' }}>
            {rows} bill rows read · header on line {file.headerIdx + 1}
          </p>
          <button onClick={onClear} className="btn-ghost !text-xs mt-2"><X size={12} /> Remove</button>
        </>
      ) : (
        <>
          <Upload size={22} className="mx-auto mb-2" style={{ color: 'var(--text-4)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{label}</p>
          <p className="text-[11px] mt-0.5 mb-2" style={{ color: 'var(--text-4)' }}>Drop a CSV here, or</p>
          <label className="btn-outline cursor-pointer !inline-flex">
            Choose file
            <input type="file" accept=".csv,text/csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
          </label>
        </>
      )}
    </div>
  )
}

/* ── Column mapping ────────────────────────────────────────────────── */
function Columns({ title, loaded, onChange }: {
  title: string; loaded: Loaded; onChange: (c: Record<Field, number>) => void
}) {
  const missing = FIELDS.filter(f => f.needed && loaded.cols[f.key] === -1)
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="section-title text-sm flex items-center gap-2"><Wand2 size={13} className="text-brand" /> {title}</p>
          <p className="section-sub">Detected automatically — change any that look wrong</p>
        </div>
        {missing.length > 0 && <span className="badge-red shrink-0">{missing.length} required missing</span>}
      </div>
      <div className="grid sm:grid-cols-2 gap-2.5">
        {FIELDS.map(f => (
          <div key={f.key} className="flex items-center gap-2">
            <label className="text-[11px] w-28 shrink-0" style={{ color: f.needed && loaded.cols[f.key] === -1 ? '#ef4444' : 'var(--text-4)' }}>
              {f.label}{f.needed && ' *'}
            </label>
            <select className="input !py-1 !text-xs flex-1 min-w-0"
              value={loaded.cols[f.key]}
              onChange={e => onChange({ ...loaded.cols, [f.key]: Number(e.target.value) })}>
              <option value={-1}>— not in file —</option>
              {loaded.header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
