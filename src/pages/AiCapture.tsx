import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  ScanLine, Sparkles, FileCheck2, AlertTriangle, Upload, Images,
  ArrowUpRight, ArrowDownRight, Minus, Code2, FileSpreadsheet, CheckCircle2,
} from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Modal, Empty, useChartTheme } from '@/components/ui'
import {
  BATCHES, CAPTURED, FIELD_ACCURACY, AI_SUMMARY, EXPORT_PATTERNS, API_ENDPOINTS,
  type CapturedBill,
} from '@/data/aidocs'
import { inr2, csvDownload, fmtDate, cn } from '@/lib/utils'

const TABS = ['Capture Queue', 'Upload Batches', 'Correction Report', 'Export Patterns', 'API'] as const

export default function AiCapture() {
  const [tab, setTab] = useState<typeof TABS[number]>('Capture Queue')

  return (
    <div>
      <PageHead title="AI Document Capture" sub="Photograph the counter book — each customer slip on the page becomes its own record" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Bills Extracted"  value={String(AI_SUMMARY.bills)} icon={ScanLine} tone="brand" sub={`From ${AI_SUMMARY.batches} uploads`} />
        <Stat label="Straight Through" value={`${AI_SUMMARY.straightThroughPct}%`} icon={FileCheck2} tone="green" sub={`${AI_SUMMARY.autoApproved} posted without a touch`} />
        <Stat label="Needs Review"     value={String(AI_SUMMARY.needsReview)} icon={AlertTriangle} tone={AI_SUMMARY.needsReview ? 'amber' : 'green'} sub="Low confidence or total mismatch" />
        <Stat label="Model Confidence" value={`${AI_SUMMARY.avgConfidence}%`} icon={Sparkles} tone="violet" sub={`${AI_SUMMARY.modelVersion} · ${AI_SUMMARY.trainingSamples.toLocaleString('en-IN')} samples`} />
      </div>

      <div className="flex flex-wrap gap-1 mb-5 p-1 rounded-lg w-fit" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors', tab === t && 'bg-brand text-white')}
            style={tab === t ? undefined : { color: 'var(--text-3)' }}>{t}</button>
        ))}
      </div>

      {tab === 'Capture Queue'    && <Queue />}
      {tab === 'Upload Batches'   && <Batches />}
      {tab === 'Correction Report'&& <Corrections />}
      {tab === 'Export Patterns'  && <Patterns />}
      {tab === 'API'              && <Api />}
    </div>
  )
}

/* ── Extracted bills ───────────────────────────────────────────────── */
function Queue() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All Status')
  const [type, setType] = useState('All Types')
  const [open, setOpen] = useState<CapturedBill | null>(null)

  const rows = useMemo(() => CAPTURED.filter(c =>
    (status === 'All Status' || c.status === status) &&
    (type === 'All Types' || c.docType === type) &&
    (q === '' || `${c.tempId} ${c.rawPartyName} ${c.mappedPartyName} ${c.sourceImage}`.toLowerCase().includes(q.toLowerCase())),
  ), [q, status, type])

  const exportCsv = () => csvDownload('vsa-ai-extracted-bills.csv', [
    ['Temp ID', 'Source Image', 'Bill', 'Doc Type', 'Bill Date', 'Party as written', 'Mapped Party', 'Item', 'Qty', 'Unit', 'Rate', 'Amount', 'Line Confidence', 'Bill Confidence', 'Status'],
    ...rows.flatMap(c => c.lines.map(l => [
      c.tempId, c.sourceImage, `${c.billIndex} of ${c.billsInImage}`, c.docType, c.billDate,
      c.rawPartyName, c.mappedPartyName, l.mappedName, l.qty, l.unit, l.rate, l.amount, l.confidence, c.confidence, c.status,
    ])),
  ])

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search temp ID, party, file…" />
        <Select value={status} onChange={setStatus} options={['All Status', 'Auto-Approved', 'Needs Review', 'Corrected & Posted', 'Rejected']} className="min-w-[11rem]" />
        <Select value={type} onChange={setType} options={['All Types', 'Handwritten Sale Slip', 'Handwritten Purchase DC', 'Computerised Purchase Invoice', 'Coating Job Card']} className="min-w-[13rem]" />
        <ExportBtn onClick={exportCsv} />
      </div>

      <TableCard maxH="32rem">
        <thead>
          <tr><th>Temp ID</th><th>Source</th><th>Type</th><th>Date</th><th>Party (as written → mapped)</th><th className="num">Lines</th><th className="num">Total</th><th className="num">Conf.</th><th>Status</th></tr>
        </thead>
        <tbody>
          {rows.map(c => (
            <tr key={c.tempId} className="cursor-pointer" onClick={() => setOpen(c)}>
              <td className="font-mono text-xs font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{c.tempId}</td>
              <td className="text-[11px]">
                <p className="truncate max-w-[11rem]" style={{ color: 'var(--text-2)' }}>{c.sourceImage}</p>
                <p style={{ color: 'var(--text-4)' }}>bill {c.billIndex} of {c.billsInImage}</p>
              </td>
              <td className="text-[11px] max-w-[9rem]">{c.docType}</td>
              <td className="text-xs whitespace-nowrap">{fmtDate(c.billDate)}</td>
              <td className="text-xs">
                <p className="font-mono text-[11px]" style={{ color: 'var(--text-4)' }}>{c.rawPartyName}</p>
                <p className="font-medium" style={{ color: 'var(--text-1)' }}>{c.mappedPartyName}</p>
              </td>
              <td className="num tabular-nums">{c.lines.length}</td>
              <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr2(c.computedTotal)}</td>
              <td className="num tabular-nums">
                <span className={cn('font-semibold', c.confidence >= 95 ? 'text-green-600' : c.confidence >= 88 ? 'text-amber-600' : 'text-red-500')}>{c.confidence}%</span>
              </td>
              <td>
                <span className={
                  c.status === 'Auto-Approved' ? 'badge-green'
                  : c.status === 'Corrected & Posted' ? 'badge-blue'
                  : c.status === 'Rejected' ? 'badge-red' : 'badge-yellow'}>{c.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      {rows.length === 0 && <Empty msg="Nothing in the queue for these filters" />}

      <BillDetail bill={open} onClose={() => setOpen(null)} />
    </>
  )
}

function BillDetail({ bill, onClose }: { bill: CapturedBill | null; onClose: () => void }) {
  return (
    <Modal open={!!bill} onClose={onClose} title={bill ? `${bill.tempId} — extracted bill` : ''} wide>
      {bill && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="badge-brand">{bill.docType}</span>
            <span className="badge-gray">{bill.sourceImage}</span>
            <span className="badge-gray">Bill {bill.billIndex} of {bill.billsInImage} on this page</span>
            <span className={bill.status === 'Needs Review' ? 'badge-yellow' : 'badge-green'}>{bill.status}</span>
          </div>

          <div className="grid sm:grid-cols-4 gap-3">
            <Mini k="Bill date"   v={fmtDate(bill.billDate)} />
            <Mini k="Bill no."    v={bill.billNo} />
            <Mini k="Party"       v={bill.mappedPartyName} s={`read as “${bill.rawPartyName}”`} />
            <Mini k="Posted to"   v={bill.postedTo} />
          </div>

          <div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--border-2)', maxHeight: '18rem' }}>
            <table className="tbl">
              <thead><tr><th>Read as</th><th>Resolved item</th><th className="num">Qty</th><th>Unit</th><th className="num">Rate</th><th className="num">Amount</th><th className="num">Confidence</th></tr></thead>
              <tbody>
                {bill.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="font-mono text-xs" style={{ color: 'var(--text-4)' }}>{l.rawText}</td>
                    <td>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{l.mappedName}</p>
                      <p className="font-mono text-[10px]" style={{ color: 'var(--text-4)' }}>{l.mappedCode}</p>
                    </td>
                    <td className="num tabular-nums">{l.qty}</td>
                    <td className="text-xs">{l.unit}</td>
                    <td className="num tabular-nums text-xs">{inr2(l.rate)}</td>
                    <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{inr2(l.amount)}</td>
                    <td className="num tabular-nums">
                      <span className={cn('font-semibold text-xs', l.flagged ? 'text-red-500' : l.confidence >= 95 ? 'text-green-600' : 'text-amber-600')}>
                        {l.confidence}%{l.flagged && ' ⚠'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg p-3.5"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
            <div className="text-xs">
              <p style={{ color: 'var(--text-4)' }}>Total written on the slip</p>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{inr2(bill.extractedTotal)}</p>
            </div>
            <div className="text-xs">
              <p style={{ color: 'var(--text-4)' }}>Total computed from lines</p>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{inr2(bill.computedTotal)}</p>
            </div>
            <div className="text-xs">
              <p style={{ color: 'var(--text-4)' }}>Difference</p>
              <p className={cn('font-semibold text-sm', Math.abs(bill.extractedTotal - bill.computedTotal) > 1 ? 'text-red-500' : 'text-green-600')}>
                {inr2(bill.extractedTotal - bill.computedTotal)}
              </p>
            </div>
          </div>

          {bill.corrections.length > 0 && (
            <div>
              <p className="section-title text-sm mb-2">Corrections applied ({bill.corrections.length})</p>
              <div className="overflow-auto rounded-lg max-h-40" style={{ border: '1px solid var(--border-2)' }}>
                <table className="tbl">
                  <thead><tr><th>Field</th><th>Model read</th><th>Corrected to</th><th>By</th></tr></thead>
                  <tbody>
                    {bill.corrections.map((c, i) => (
                      <tr key={i}>
                        <td className="text-xs font-medium" style={{ color: 'var(--text-1)' }}>{c.field}</td>
                        <td className="font-mono text-xs text-red-500">{c.ocrValue}</td>
                        <td className="font-mono text-xs text-green-600">{c.correctedValue}</td>
                        <td className="text-xs">{c.by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] mt-2" style={{ color: 'var(--text-4)' }}>
                Each correction is written back to the alias map and added to the training set for the next model build.
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

/* ── Batches ───────────────────────────────────────────────────────── */
function Batches() {
  return (
    <>
      <div className="card mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="section-title text-base flex items-center gap-2"><Upload size={15} className="text-brand" /> Upload a page</p>
          <p className="section-sub">Photo of the counter book, a supplier bill or a coating job card. PDF and JPEG both work.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge-gray">Engine: {AI_SUMMARY.modelVersion}</span>
          <span className="badge-brand">Last trained {fmtDate(AI_SUMMARY.lastTrained)}</span>
        </div>
      </div>

      <TableCard maxH="30rem">
        <thead>
          <tr><th>File</th><th>Uploaded</th><th>By</th><th>Type</th><th>Engine</th><th className="num">Bills Found</th><th className="num">Time</th><th>Status</th></tr>
        </thead>
        <tbody>
          {BATCHES.map(b => (
            <tr key={b.id}>
              <td className="flex items-center gap-2">
                <Images size={14} className="text-brand shrink-0" />
                <span className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>{b.file}</span>
              </td>
              <td className="text-xs whitespace-nowrap">{b.uploadedAt}</td>
              <td className="text-xs whitespace-nowrap">{b.uploadedBy}</td>
              <td className="text-[11px]">{b.docType}</td>
              <td className="text-[11px]">{b.engine}</td>
              <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{b.billsFound}</td>
              <td className="num tabular-nums text-xs">{(b.processingMs / 1000).toFixed(1)}s</td>
              <td><span className={b.status === 'Processed' ? 'badge-green' : b.status === 'Processing' ? 'badge-blue' : 'badge-yellow'}>{b.status}</span></td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      <p className="text-[11px] mt-3" style={{ color: 'var(--text-4)' }}>
        One photograph often holds several customers' slips. The splitter treats each transaction as a separate bill —
        even where no bill number is written — and gives it a sequential temporary ID until it is posted.
      </p>
    </>
  )
}

/* ── Correction report ─────────────────────────────────────────────── */
function Corrections() {
  const t = useChartTheme()
  const allCorrections = CAPTURED.flatMap(c => c.corrections.map(x => ({ ...x, tempId: c.tempId, date: c.billDate })))

  const exportCsv = () => csvDownload('vsa-ai-correction-report.csv', [
    ['Field accuracy'], ['Field', 'Extracted', 'Corrected', 'Accuracy %'],
    ...FIELD_ACCURACY.map(f => [f.field, f.extracted, f.corrected, f.accuracy]),
    [], ['Correction log'], ['Temp ID', 'Date', 'Field', 'Model read', 'Corrected to', 'By'],
    ...allCorrections.map(c => [c.tempId, c.date, c.field, c.ocrValue, c.correctedValue, c.by]),
  ])

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <div className="card">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="section-title text-base">Field-level Accuracy</p>
              <p className="section-sub">Where the model still needs a human — weakest field first</p>
            </div>
            <ExportBtn onClick={exportCsv} label="Export report" />
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={FIELD_ACCURACY} layout="vertical" margin={{ left: 46, right: 26 }} barSize={15}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} horizontal={false} />
              <XAxis type="number" domain={[60, 100]} tick={t.tick} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="field" tick={{ ...t.tick, fontSize: 10 }} axisLine={false} tickLine={false} width={124} />
              <Tooltip contentStyle={t.tooltip} formatter={(v: number) => [`${v}%`, 'Accuracy']} cursor={{ fill: 'rgba(15,91,143,.06)' }} />
              <Bar dataKey="accuracy" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {FIELD_ACCURACY.map((f, i) => (
                  <Cell key={i} fill={f.accuracy >= 95 ? '#16a34a' : f.accuracy >= 88 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4">
            <p className="section-title text-base">Accuracy Table</p>
            <p className="section-sub">Corrections against fields extracted</p>
          </div>
          <table className="tbl">
            <thead><tr><th>Field</th><th className="num">Extracted</th><th className="num">Corrected</th><th className="num">Accuracy</th><th>Trend</th></tr></thead>
            <tbody>
              {FIELD_ACCURACY.map(f => (
                <tr key={f.field}>
                  <td className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>{f.field}</td>
                  <td className="num tabular-nums">{f.extracted}</td>
                  <td className="num tabular-nums">{f.corrected}</td>
                  <td className="num tabular-nums">
                    <span className={cn('font-semibold', f.accuracy >= 95 ? 'text-green-600' : f.accuracy >= 88 ? 'text-amber-600' : 'text-red-500')}>{f.accuracy}%</span>
                  </td>
                  <td>
                    {f.trend === 'up' ? <ArrowUpRight size={14} className="text-green-600" />
                      : f.trend === 'down' ? <ArrowDownRight size={14} className="text-red-500" />
                      : <Minus size={14} style={{ color: 'var(--text-4)' }} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="section-title text-base mb-1">Correction Log</p>
      <p className="section-sub mb-3">Every edit becomes a training sample — {AI_SUMMARY.trainingSamples.toLocaleString('en-IN')} collected so far</p>
      <TableCard maxH="24rem">
        <thead><tr><th>Temp ID</th><th>Date</th><th>Field</th><th>Model read</th><th>Corrected to</th><th>By</th></tr></thead>
        <tbody>
          {allCorrections.map((c, i) => (
            <tr key={i}>
              <td className="font-mono text-xs font-medium" style={{ color: 'var(--text-1)' }}>{c.tempId}</td>
              <td className="text-xs whitespace-nowrap">{fmtDate(c.date)}</td>
              <td className="text-xs">{c.field}</td>
              <td className="font-mono text-xs text-red-500 max-w-[12rem] truncate">{c.ocrValue}</td>
              <td className="font-mono text-xs text-green-600 max-w-[14rem] truncate">{c.correctedValue}</td>
              <td className="text-xs">{c.by}</td>
            </tr>
          ))}
          {allCorrections.length === 0 && <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--text-4)' }}>No corrections logged</td></tr>}
        </tbody>
      </TableCard>
    </>
  )
}

/* ── Export patterns ───────────────────────────────────────────────── */
function Patterns() {
  const [active, setActive] = useState<Record<string, boolean>>(
    Object.fromEntries(EXPORT_PATTERNS.map(p => [p.id, p.active])),
  )
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {EXPORT_PATTERNS.map(p => (
          <div key={p.id} className="card">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="section-title text-sm flex items-center gap-2">
                  <FileSpreadsheet size={14} className="text-brand shrink-0" /> {p.name}
                </p>
                <p className="section-sub">{p.target} · {p.schedule}</p>
              </div>
              <button onClick={() => setActive(a => ({ ...a, [p.id]: !a[p.id] }))}
                className={active[p.id] ? 'badge-green' : 'badge-gray'}>
                {active[p.id] ? <><CheckCircle2 size={11} /> Active</> : 'Paused'}
              </button>
            </div>

            <div className="flex flex-wrap gap-1 my-3">
              {p.columns.map(c => <span key={c} className="badge-gray !text-[10px] !px-2 !py-0.5">{c}</span>)}
            </div>

            <div className="flex items-center justify-between text-[11px] pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
              <span>Last run {p.lastRun}</span>
              <span>{p.rowsLastRun} rows written</span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] mt-4" style={{ color: 'var(--text-4)' }}>
        Give the extractor a bill and the column pattern once; it writes the same sheet every day afterwards, ready to
        import into Tally or post straight into the ERP.
      </p>
    </>
  )
}

/* ── API ───────────────────────────────────────────────────────────── */
function Api() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="card xl:col-span-2 p-0 overflow-hidden">
        <div className="px-5 py-4">
          <p className="section-title text-base flex items-center gap-2"><Code2 size={15} className="text-brand" /> REST Endpoints</p>
          <p className="section-sub">What the capture app and the ChatGPT connector call</p>
        </div>
        <table className="tbl">
          <thead><tr><th className="w-16">Method</th><th>Path</th><th>Purpose</th></tr></thead>
          <tbody>
            {API_ENDPOINTS.map(e => (
              <tr key={e.path}>
                <td><span className={e.method === 'GET' ? 'badge-blue' : 'badge-green'}>{e.method}</span></td>
                <td className="font-mono text-xs" style={{ color: 'var(--text-1)' }}>{e.path}</td>
                <td className="text-xs">{e.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-4">
        <div className="card">
          <p className="section-title text-sm mb-3">Extraction Prompt</p>
          <p className="text-[11px] leading-relaxed font-mono rounded-lg p-3"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)', color: 'var(--text-2)' }}>
            This image may contain multiple handwritten customer sales slips. Treat each customer transaction as a
            separate bill even if no bill number is present. Assign temporary IDs sequentially and extract date,
            customer name (if available), items, quantity, rate and total.
          </p>
          <p className="text-[11px] mt-2" style={{ color: 'var(--text-4)' }}>
            Stored against the Handwritten Sale Slip document type and versioned with the model.
          </p>
        </div>

        <div className="card">
          <p className="section-title text-sm mb-3">Model Status</p>
          <dl className="space-y-2 text-xs">
            <Kv k="Version"          v={AI_SUMMARY.modelVersion} />
            <Kv k="Last trained"     v={fmtDate(AI_SUMMARY.lastTrained)} />
            <Kv k="Training samples" v={AI_SUMMARY.trainingSamples.toLocaleString('en-IN')} />
            <Kv k="Avg confidence"   v={`${AI_SUMMARY.avgConfidence}%`} />
            <Kv k="Straight-through" v={`${AI_SUMMARY.straightThroughPct}%`} />
          </dl>
        </div>
      </div>
    </div>
  )
}

function Mini({ k, v, s }: { k: string; v: string; s?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{k}</p>
      <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-1)' }}>{v}</p>
      {s && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-4)' }}>{s}</p>}
    </div>
  )
}

const Kv = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-3">
    <dt style={{ color: 'var(--text-4)' }}>{k}</dt>
    <dd className="font-medium" style={{ color: 'var(--text-1)' }}>{v}</dd>
  </div>
)
