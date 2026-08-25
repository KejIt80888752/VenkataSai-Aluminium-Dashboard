import { useState, useMemo } from 'react'
import { Scale, FileWarning, Handshake, IndianRupee, Upload, X, FileSpreadsheet } from 'lucide-react'
import { PageHead, Stat, Select, ExportBtn, TableCard, Empty } from '@/components/ui'
import { SUPPLIER_LEDGERS, type LedgerKind, type LedgerRow } from '@/data/supplierledger'
import { PURCHASES } from '@/data/txns'
import { parseCsv, findHeader, detectColumns, toRows, type Field } from '@/lib/csv'
import { inr, fmtDate, csvDownload, cn } from '@/lib/utils'
import { COMPANY, FY } from '@/data/company'

const KINDS: LedgerKind[] = ['Matched', 'Amount Differs', 'Not in Our Books', 'Not in Their Statement', 'Payment Not Credited']

const badgeFor = (k: LedgerKind) =>
  k === 'Matched' ? 'badge-green'
  : k === 'Amount Differs' ? 'badge-yellow'
  : k === 'Not in Our Books' ? 'badge-purple'
  : k === 'Not in Their Statement' ? 'badge-red' : 'badge-blue'

export default function SupplierRecon() {
  const [view, setView] = useState('Statement vs Our Books')
  /* Worst disagreement first — that is the statement worth opening. */
  const ordered = [...SUPPLIER_LEDGERS].sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
  const labelOf = (l: typeof ordered[number]) =>
    `${l.supplier}${l.difference ? ` — ${inr(Math.abs(l.difference))} apart` : ' — agreed'}`
  const [supId, setSupId] = useState(ordered[0]?.supplierId ?? '')
  const [kind, setKind] = useState('All Rows')

  const led = SUPPLIER_LEDGERS.find(l => l.supplierId === supId)!
  const rows = led.rows.filter(r => kind === 'All Rows' || r.kind === kind)

  /* Every disagreement, grouped — these add up to the closing difference exactly. */
  const explained = KINDS.filter(k => k !== 'Matched').map(k => ({
    kind: k,
    count: led.rows.filter(r => r.kind === k).length,
    effect: led.rows.filter(r => r.kind === k).reduce((s, r) => s + r.effect, 0),
  })).filter(e => e.count > 0)

  const exportCsv = () => csvDownload(`supplier-statement-difference-${led.supplierId}.csv`, [
    [`Statement reconciliation — ${led.supplier}`, led.gstin, FY],
    [`${COMPANY.name} purchase register compared with the supplier's own statement`],
    [],
    ['Their closing balance', led.theirClosing],
    ['Our closing balance', led.ourClosing],
    ['Difference to resolve', led.difference],
    [],
    ['Difference explained by'], ['Reason', 'Bills', 'Effect on their balance'],
    ...explained.map(e => [e.kind, e.count, e.effect]),
    [],
    ['Document', 'Date', 'Our Books', 'Their Statement', 'Difference', 'Status', 'What to do'],
    ...led.rows.map(r => [r.billNo, r.date, r.ours, r.theirs, r.effect, r.kind, r.note]),
  ])

  return (
    <div>
      <PageHead title="Supplier Statement Reconciliation"
        sub="Their statement against our purchase register — and exactly what makes up the difference">
        <Select value={view} onChange={setView} options={['Statement vs Our Books', 'Upload Their Excel']} className="min-w-[14rem]" />
        {view === 'Statement vs Our Books' && <ExportBtn onClick={exportCsv} />}
      </PageHead>

      {view === 'Upload Their Excel' ? <UploadMatch /> : (
        <>
          <div className="card mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="section-title text-base mb-1">Choose supplier</p>
              <p className="section-sub">Statements are compared one supplier at a time</p>
            </div>
            <Select className="min-w-[22rem]"
              value={labelOf(led)}
              onChange={v => setSupId(ordered.find(l => labelOf(l) === v)!.supplierId)}
              options={ordered.map(labelOf)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
            <Stat label="They Say We Owe" value={inr(led.theirClosing)} icon={Scale} tone="violet" sub="Closing on their statement" />
            <Stat label="Our Books Say"   value={inr(led.ourClosing)}   icon={IndianRupee} tone="brand" sub="Closing in our purchase register" />
            <Stat label="Difference"      value={inr(Math.abs(led.difference))}
              icon={FileWarning} tone={led.difference === 0 ? 'green' : 'red'}
              sub={led.difference === 0 ? 'Statement agrees' : led.difference > 0 ? 'They are claiming more' : 'We have booked more'} />
            <Stat label="Rows to Resolve" value={String(led.toResolve)} icon={Handshake} tone="sky"
              sub={`of ${led.rows.length} documents on the statement`} />
          </div>

          {explained.length > 0 && (
            <div className="card mb-5">
              <p className="section-title text-base mb-1">What Makes Up the Difference</p>
              <p className="section-sub mb-4">
                Each reason below, added together, comes to exactly {inr(Math.abs(led.difference))} — nothing is left unexplained.
              </p>
              <div className="space-y-2.5">
                {explained.map(e => {
                  const share = Math.abs(e.effect) / explained.reduce((s, x) => s + Math.abs(x.effect), 0) * 100
                  return (
                    <div key={e.kind}>
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="text-sm flex items-center gap-2" style={{ color: 'var(--text-2)' }}>
                          <span className={badgeFor(e.kind)}>{e.kind}</span>
                          <span className="text-xs" style={{ color: 'var(--text-4)' }}>{e.count} {e.count === 1 ? 'row' : 'rows'}</span>
                        </span>
                        <span className="tabular-nums font-semibold text-sm shrink-0"
                          style={{ color: e.effect > 0 ? 'var(--red)' : 'var(--green)' }}>
                          {e.effect > 0 ? '+' : '−'}{inr(Math.abs(e.effect))}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-card2)' }}>
                        <div className="h-full rounded-full" style={{ width: `${share}%`, background: e.effect > 0 ? 'var(--red)' : 'var(--green)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-[11px] mt-4 pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
                A plus figure pushes their balance above ours. Export this page and send it back to the supplier as the reply to their statement.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <p className="section-title text-base mb-1">Document by Document</p>
              <p className="section-sub">Every bill and payment on either side</p>
            </div>
            <Select value={kind} onChange={setKind} options={['All Rows', ...KINDS]} />
          </div>

          <TableCard maxH="30rem">
            <thead>
              <tr><th>Document</th><th>Date</th><th className="num">Our Books</th><th className="num">Their Statement</th>
                <th className="num">Difference</th><th>Status</th><th>What To Do</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => <Row key={i} r={r} />)}
              {rows.length === 0 && <tr><td colSpan={7}><Empty msg="No rows of this kind" /></td></tr>}
            </tbody>
          </TableCard>
        </>
      )}
    </div>
  )
}

const Row = ({ r }: { r: LedgerRow }) => (
  <tr>
    <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{r.billNo}</td>
    <td className="text-xs whitespace-nowrap">{fmtDate(r.date)}</td>
    <td className="num tabular-nums">{r.ours ? inr(r.ours) : '—'}</td>
    <td className="num tabular-nums">{r.theirs ? inr(r.theirs) : '—'}</td>
    <td className={cn('num tabular-nums font-semibold')}
      style={{ color: r.effect === 0 ? 'var(--text-4)' : r.effect > 0 ? 'var(--red)' : 'var(--green)' }}>
      {r.effect === 0 ? '—' : (r.effect > 0 ? '+' : '−') + inr(Math.abs(r.effect))}
    </td>
    <td><span className={badgeFor(r.kind)}>{r.kind}</span></td>
    <td className="text-xs" style={{ color: 'var(--text-3)' }}>{r.note}</td>
  </tr>
)

/* ── Their file, matched against our register by bill number ───────────── */
function UploadMatch() {
  const [file, setFile] = useState<{ name: string; rows: string[][]; headerIdx: number; cols: Record<Field, number> } | null>(null)

  const load = (f: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const rows = parseCsv(String(reader.result ?? ''))
      if (!rows.length) return
      const headerIdx = findHeader(rows)
      setFile({ name: f.name, rows, headerIdx, cols: detectColumns(rows[headerIdx]) })
    }
    reader.readAsText(f)
  }

  const result = useMemo(() => {
    if (!file) return []
    const theirs = toRows(file.rows, file.headerIdx, file.cols)
    const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toUpperCase()
    const ours = new Map(PURCHASES.map(p => [norm(p.no), p]))
    const seen = new Set<string>()

    const out = theirs.map(t => {
      const k = norm(t.billNo)
      seen.add(k)
      const p = ours.get(k)
      const theirVal = t.taxable + t.tax
      if (!p) return { billNo: t.billNo, date: t.billDate, ours: 0, theirs: theirVal,
                       effect: theirVal, kind: 'Not in Our Books' as LedgerKind, note: 'Ask for a copy, then book it' }
      const diff = Math.round(theirVal - p.total)
      return {
        billNo: t.billNo, date: t.billDate, ours: p.total, theirs: Math.round(theirVal), effect: diff,
        kind: (Math.abs(diff) <= 1 ? 'Matched' : 'Amount Differs') as LedgerKind,
        note: Math.abs(diff) <= 1 ? 'Agreed — no action' : 'Compare rate and freight on this bill',
      }
    })

    for (const p of PURCHASES) {
      if (!seen.has(norm(p.no))) {
        out.push({ billNo: p.no, date: p.date, ours: p.total, theirs: 0, effect: -p.total,
                   kind: 'Not in Their Statement', note: 'We have booked it — ask why it is missing' })
      }
    }
    return out
  }, [file])

  const diff = result.reduce((s, r) => s + r.effect, 0)
  const unresolved = result.filter(r => r.kind !== 'Matched')

  return (
    <>
      <div className="card mb-5">
        <p className="section-title text-base mb-1">Upload the supplier's statement</p>
        <p className="section-sub mb-4">
          Save their Excel as CSV and drop it here. Bill numbers are matched against our purchase register, and
          the file stays on this computer — nothing is uploaded anywhere.
        </p>

        {file ? (
          <div className="flex items-center justify-between gap-3 rounded-lg p-3"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
            <span className="flex items-center gap-2 text-sm min-w-0" style={{ color: 'var(--text-1)' }}>
              <FileSpreadsheet size={15} className="text-brand shrink-0" />
              <span className="truncate">{file.name}</span>
              <span className="text-xs shrink-0" style={{ color: 'var(--text-4)' }}>{result.length} rows</span>
            </span>
            <button className="btn-ghost !px-2 shrink-0" onClick={() => setFile(null)}><X size={14} /></button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 rounded-lg py-10 cursor-pointer"
            style={{ border: '1.5px dashed var(--border-2)' }}>
            <Upload size={22} style={{ color: 'var(--text-4)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>Choose their statement (.csv)</span>
            <input type="file" accept=".csv,text/csv" className="hidden"
              onChange={e => e.target.files?.[0] && load(e.target.files[0])} />
          </label>
        )}
      </div>

      {result.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <Stat label="Rows in Their File" value={String(result.length)} icon={FileSpreadsheet} tone="sky" sub="Matched on bill number" />
            <Stat label="Needs Resolving" value={String(unresolved.length)} icon={FileWarning} tone={unresolved.length ? 'red' : 'green'} sub="Rows that do not agree" />
            <Stat label="Net Difference" value={inr(Math.abs(diff))} icon={Scale} tone="violet"
              sub={diff > 0 ? 'They claim more than our books' : diff < 0 ? 'We have booked more' : 'Both sides agree'} />
          </div>

          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="section-title text-base">Match Result</p>
            <ExportBtn onClick={() => csvDownload('supplier-statement-match.csv', [
              ['Supplier statement match', COMPANY.name, FY], [],
              ['Document', 'Date', 'Our Books', 'Their Statement', 'Difference', 'Status', 'What to do'],
              ...result.map(r => [r.billNo, r.date, r.ours, r.theirs, r.effect, r.kind, r.note]),
            ])} />
          </div>
          <TableCard maxH="30rem">
            <thead>
              <tr><th>Document</th><th>Date</th><th className="num">Our Books</th><th className="num">Their Statement</th>
                <th className="num">Difference</th><th>Status</th><th>What To Do</th></tr>
            </thead>
            <tbody>{result.map((r, i) => <Row key={i} r={r as LedgerRow} />)}</tbody>
          </TableCard>
        </>
      )}
    </>
  )
}
