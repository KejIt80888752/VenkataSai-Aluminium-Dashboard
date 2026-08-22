import { useState } from 'react'
import { Boxes, Scale, Layers, Scissors, ArrowRightLeft, CheckCircle2, AlertTriangle, Tags, Receipt, FileStack, Store, Plus, X } from 'lucide-react'
import { PageHead, Stat, TableCard, SearchBox, ExportBtn, Empty, Modal } from '@/components/ui'
import {
  UOM_RULES, KITS, WEIGHT_POOLS, allocatePool, ALIASES, CUT_PIECES,
  PRODUCT_NAMES, kgToPieces, piecesToKg, uomOf, type NameRow,
} from '@/data/itemmaster'
import { csvDownload, fmtDate, cn } from '@/lib/utils'

const TABS = ['Dual Unit', 'Product Names', 'Kits & Combos', 'Pooled Weight', 'Name Mapping', 'Cut Pieces'] as const

export default function ItemMaster() {
  const [tab, setTab] = useState<typeof TABS[number]>('Dual Unit')
  const [q, setQ] = useState('')

  return (
    <div>
      <PageHead title="Item Master" sub="Unit conversions, combo sets, pooled weights and the name mapping the AI extractor learns from" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Dual-Unit Items" value={String(UOM_RULES.length)} icon={ArrowRightLeft} tone="brand"  sub="Bought one way, sold another" />
        <Stat label="Kits & Combos"   value={String(KITS.length)}      icon={Layers}         tone="violet" sub={`${KITS.reduce((s, k) => s + k.components.length, 0)} components mapped`} />
        <Stat label="Product Names"   value={String(PRODUCT_NAMES.reduce((s, n) => s + 4 + n.aliases.length, 0))} icon={Tags} tone="sky" sub={`Across ${PRODUCT_NAMES.length} products`} />
        <Stat label="Cut Pieces Open" value={String(CUT_PIECES.filter(c => c.disposition !== 'Scrap / Melt').length)} icon={Scissors} tone="amber" sub="Back to stock or awaiting cut" />
      </div>

      <div className="flex flex-wrap gap-1 mb-5 p-1 rounded-lg w-fit" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors', tab === t && 'bg-brand text-white')}
            style={tab === t ? undefined : { color: 'var(--text-3)' }}>{t}</button>
        ))}
      </div>

      {tab === 'Dual Unit' && <DualUnit q={q} setQ={setQ} />}
      {tab === 'Product Names' && <Names q={q} setQ={setQ} />}
      {tab === 'Kits & Combos' && <Kits />}
      {tab === 'Pooled Weight' && <Pools />}
      {tab === 'Name Mapping' && <Mapping q={q} setQ={setQ} />}
      {tab === 'Cut Pieces' && <Cuts />}
    </div>
  )
}

/* ── 1. Weight ⇄ pieces ────────────────────────────────────────────── */
function DualUnit({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  const [calcCode, setCalcCode] = useState(UOM_RULES[0].code)
  const [calcKg, setCalcKg] = useState('100')
  const [calcPcs, setCalcPcs] = useState('')

  const rule = uomOf(calcCode)!
  const rows = UOM_RULES.filter(u => q === '' || `${u.code} ${u.name}`.toLowerCase().includes(q.toLowerCase()))

  const exportCsv = () => csvDownload('vsa-uom-rules.csv', [
    ['Code', 'Item', 'Purchase UOM', 'Sale UOM', 'Pieces per purchase unit', 'Kg per piece', 'Auto true-up', 'Valuation'],
    ...rows.map(u => [u.code, u.name, u.purchaseUom, u.saleUom, u.piecesPerPurchaseUom, u.kgPerPiece, u.autoTrueUp ? 'Yes' : 'No', u.valuation]),
  ])

  return (
    <>
      <div className="card mb-4">
        <p className="section-title text-base mb-1">Conversion Check</p>
        <p className="section-sub mb-4">One entry moves both ledgers — enter either side to see the other</p>
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="label">Item</label>
            <select className="input" value={calcCode} onChange={e => { setCalcCode(e.target.value); setCalcPcs('') }}>
              {UOM_RULES.map(u => <option key={u.code} value={u.code}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Weight (kg)</label>
            <input className="input tabular-nums" value={calcKg}
              onChange={e => { setCalcKg(e.target.value); setCalcPcs(String(kgToPieces(calcCode, Number(e.target.value) || 0))) }} />
          </div>
          <div>
            <label className="label">Pieces</label>
            <input className="input tabular-nums" value={calcPcs || String(kgToPieces(calcCode, Number(calcKg) || 0))}
              onChange={e => { setCalcPcs(e.target.value); setCalcKg(String(piecesToKg(calcCode, Number(e.target.value) || 0))) }} />
          </div>
        </div>
        <p className="text-[11px] mt-3" style={{ color: 'var(--text-4)' }}>
          Standard weight {rule.kgPerPiece} kg per piece · bought in {rule.purchaseUom}
          {rule.piecesPerPurchaseUom > 1 && ` of ${rule.piecesPerPurchaseUom} pcs`} · sold in {rule.saleUom} · valued {rule.valuation}
          {rule.autoTrueUp && ' · weekly check trues the standard weight up from the latest DC'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search item…" />
        <ExportBtn onClick={exportCsv} />
      </div>

      <TableCard maxH="28rem">
        <thead>
          <tr><th>Code</th><th>Item</th><th>Buy As</th><th>Sell As</th><th className="num">Pcs / Unit</th><th className="num">Kg / Piece</th><th>Valuation</th><th>Weekly True-Up</th></tr>
        </thead>
        <tbody>
          {rows.map(u => (
            <tr key={u.code}>
              <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{u.code}</td>
              <td className="font-medium" style={{ color: 'var(--text-1)' }}>{u.name}</td>
              <td><span className="badge-gray">{u.purchaseUom}</span></td>
              <td><span className="badge-brand">{u.saleUom}</span></td>
              <td className="num tabular-nums">{u.piecesPerPurchaseUom}</td>
              <td className="num tabular-nums">{u.kgPerPiece}</td>
              <td className="text-xs">{u.valuation}</td>
              <td>{u.autoTrueUp
                ? <span className="badge-green"><CheckCircle2 size={11} /> Auto</span>
                : <span className="badge-gray">Fixed</span>}</td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      {rows.length === 0 && <Empty msg="No items match" />}
    </>
  )
}

/* ── Product names: one item, a different name on each document ────── */
function Names({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  const [rows, setRows] = useState<NameRow[]>(PRODUCT_NAMES)
  const [sel, setSel] = useState<string | null>(null)
  const [newAlias, setNewAlias] = useState('')

  const shown = rows.filter(n =>
    q === '' || [n.code, n.internal, n.printInvoice, n.printDC, n.counter, ...n.aliases]
      .join(' ').toLowerCase().includes(q.toLowerCase()))

  const set = (code: string, k: keyof NameRow, v: string) =>
    setRows(rs => rs.map(r => (r.code === code ? { ...r, [k]: v } : r)))

  const addAlias = (code: string) => {
    if (!newAlias.trim()) return
    setRows(rs => rs.map(r => (r.code === code ? { ...r, aliases: [...r.aliases, newAlias.trim().toUpperCase()] } : r)))
    setNewAlias('')
  }
  const dropAlias = (code: string, a: string) =>
    setRows(rs => rs.map(r => (r.code === code ? { ...r, aliases: r.aliases.filter(x => x !== a) } : r)))

  const current = rows.find(r => r.code === sel)

  const exportCsv = () => csvDownload('vsa-product-names.csv', [
    ['Code', 'Internal name', 'Prints on sales invoice', 'Prints on delivery challan', 'Counter short name', 'Recognised aliases'],
    ...shown.map(n => [n.code, n.internal, n.printInvoice, n.printDC, n.counter, n.aliases.join(' | ')]),
  ])

  return (
    <>
      <div className="card mb-4">
        <p className="section-title text-base mb-1">One Product, Four Names</p>
        <p className="section-sub mb-4 max-w-3xl">
          The customer's invoice, the delivery challan, the shop counter and the stock reports each need the name that
          suits them. Set them once here and every document picks the right one on its own. Anything typed into the
          aliases box is recognised by the AI extractor as the same item.
        </p>
        <div className="grid sm:grid-cols-4 gap-3">
          <Legend icon={Boxes}      k="Internal" note="Stock, reports and every screen inside the ERP" />
          <Legend icon={Receipt}    k="Sales invoice" note="The long descriptive name the customer expects" />
          <Legend icon={FileStack}  k="Delivery challan" note="The short mill-style description on the DC" />
          <Legend icon={Store}      k="Counter" note="What the shop staff say and write on slips" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search any name or alias…" />
        <ExportBtn onClick={exportCsv} />
      </div>

      <TableCard maxH="30rem">
        <thead>
          <tr><th>Code</th><th>Internal</th><th>Sales Invoice</th><th>Delivery Challan</th><th>Counter</th><th className="num">Aliases</th></tr>
        </thead>
        <tbody>
          {shown.map(n => (
            <tr key={n.code} className="cursor-pointer" onClick={() => setSel(n.code)}>
              <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{n.code}</td>
              <td className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>{n.internal}</td>
              <td className="text-xs max-w-[16rem]">{n.printInvoice}</td>
              <td className="font-mono text-[11px] whitespace-nowrap">{n.printDC}</td>
              <td className="text-xs">{n.counter}</td>
              <td className="num tabular-nums text-xs">{n.aliases.length}</td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      {shown.length === 0 && <Empty msg="No product matches that name" />}

      <Modal open={!!current} onClose={() => setSel(null)} title={current ? `Names for ${current.code}` : ''} wide>
        {current && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="label">Internal name (stock & reports)</label>
                <input className="input" value={current.internal} onChange={e => set(current.code, 'internal', e.target.value)} /></div>
              <div><label className="label">Prints on sales invoice</label>
                <input className="input" value={current.printInvoice} onChange={e => set(current.code, 'printInvoice', e.target.value)} /></div>
              <div><label className="label">Prints on delivery challan</label>
                <input className="input" value={current.printDC} onChange={e => set(current.code, 'printDC', e.target.value)} /></div>
              <div><label className="label">Counter short name</label>
                <input className="input" value={current.counter} onChange={e => set(current.code, 'counter', e.target.value)} /></div>
            </div>

            <div>
              <label className="label">Recognised aliases — what the AI treats as this same item</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {current.aliases.map(a => (
                  <span key={a} className="badge-gray font-mono !text-[11px]">
                    {a}
                    <button onClick={() => dropAlias(current.code, a)} className="ml-1 hover:text-red-500"><X size={10} /></button>
                  </span>
                ))}
                {current.aliases.length === 0 && <span className="text-xs" style={{ color: 'var(--text-4)' }}>None yet</span>}
              </div>
              <div className="flex gap-2">
                <input className="input" placeholder="Type another spelling and press Enter" value={newAlias}
                  onChange={e => setNewAlias(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addAlias(current.code) }} />
                <button onClick={() => addAlias(current.code)} className="btn shrink-0"><Plus size={14} /> Add</button>
              </div>
            </div>

            <div className="rounded-lg p-4" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-1)' }}>How it will print</p>
              <div className="space-y-2 text-xs">
                <Preview doc="Sales tax invoice" v={current.printInvoice} />
                <Preview doc="Delivery challan"  v={current.printDC} />
                <Preview doc="Stock report"      v={current.internal} />
                <Preview doc="Counter slip"      v={current.counter} />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

function Legend({ icon: Icon, k, note }: { icon: typeof Boxes; k: string; note: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
      <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-1)' }}>
        <Icon size={12} className="text-brand" /> {k}
      </p>
      <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--text-4)' }}>{note}</p>
    </div>
  )
}

function Preview({ doc, v }: { doc: string; v: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-32 shrink-0" style={{ color: 'var(--text-4)' }}>{doc}</span>
      <span className="font-medium" style={{ color: 'var(--text-1)' }}>{v}</span>
    </div>
  )
}

/* ── 2. Kits ───────────────────────────────────────────────────────── */
function Kits() {
  const [qty, setQty] = useState<Record<string, string>>({})
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {KITS.map(k => {
        const n = Number(qty[k.code] || 1) || 1
        return (
          <div key={k.code} className="card">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <p className="section-title text-sm">{k.name}</p>
                <p className="font-mono text-[10px]" style={{ color: 'var(--text-4)' }}>{k.code}</p>
              </div>
              <span className="badge-brand shrink-0">1 {k.saleUom}</span>
            </div>
            <p className="section-sub mb-3">Billing one set deducts every component below</p>

            <div className="flex items-center gap-2 mb-3">
              <label className="text-xs" style={{ color: 'var(--text-3)' }}>Sets billed</label>
              <input className="input !w-20 !py-1 text-right tabular-nums" value={qty[k.code] ?? '1'}
                onChange={e => setQty(s => ({ ...s, [k.code]: e.target.value }))} />
            </div>

            <div className="space-y-2">
              {k.components.map(c => (
                <div key={c.code} className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate" style={{ color: 'var(--text-2)' }}>{c.name}</p>
                    <p className="font-mono text-[10px]" style={{ color: 'var(--text-4)' }}>{c.code}</p>
                  </div>
                  <span className="font-semibold tabular-nums shrink-0 text-red-500">−{c.qty * n} {c.unit}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] mt-3 pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
              {k.components.reduce((s, c) => s + c.qty, 0) * n} pieces leave stock for {n} set{n > 1 ? 's' : ''}.
            </p>
          </div>
        )
      })}
    </div>
  )
}

/* ── 3. One weighbridge figure, several items ──────────────────────── */
function Pools() {
  return (
    <div className="space-y-5">
      {WEIGHT_POOLS.map(pool => {
        const alloc = allocatePool(pool)
        const std = alloc.reduce((s, a) => s + a.standardKg, 0)
        return (
          <div key={pool.id} className="card p-0 overflow-hidden">
            <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="section-title text-base">{pool.supplier}</p>
                <p className="section-sub">DC {pool.dcNo} · {fmtDate(pool.date)} · {pool.items.length} items received against one weight</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={pool.status === 'Allocated' ? 'badge-green' : 'badge-yellow'}>{pool.status}</span>
                <span className="badge-brand">{pool.pooledWeightKg.toLocaleString('en-IN')} kg pooled</span>
              </div>
            </div>
            <table className="tbl">
              <thead>
                <tr><th>Code</th><th>Item</th><th className="num">Nos</th><th className="num">Std Kg/Pc</th><th className="num">Standard Kg</th><th className="num">Allocated Kg</th><th className="num">Actual Kg/Pc</th><th className="num">Variance</th></tr>
              </thead>
              <tbody>
                {alloc.map(a => (
                  <tr key={a.code}>
                    <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{a.code}</td>
                    <td className="text-sm">{a.name}</td>
                    <td className="num tabular-nums">{a.nos}</td>
                    <td className="num tabular-nums text-xs">{a.stdKgPerPiece}</td>
                    <td className="num tabular-nums text-xs">{a.standardKg.toLocaleString('en-IN')}</td>
                    <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{a.allocatedKg.toLocaleString('en-IN')}</td>
                    <td className="num tabular-nums text-xs">{a.perPieceKg}</td>
                    <td className={cn('num tabular-nums text-xs font-medium', a.variancePct < 0 ? 'text-red-500' : 'text-green-600')}>
                      {a.variancePct > 0 ? '+' : ''}{a.variancePct}%
                    </td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--bg-card2)' }}>
                  <td colSpan={4} className="font-bold text-xs" style={{ color: 'var(--text-1)' }}>Total — {pool.method}</td>
                  <td className="num tabular-nums font-bold text-xs" style={{ color: 'var(--text-1)' }}>{std.toFixed(1)}</td>
                  <td className="num tabular-nums font-bold text-xs" style={{ color: 'var(--text-1)' }}>{pool.pooledWeightKg.toLocaleString('en-IN')}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

/* ── 4. Alias mapping ──────────────────────────────────────────────── */
function Mapping({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  const rows = ALIASES.filter(a => q === '' || `${a.alias} ${a.mapsToName} ${a.source}`.toLowerCase().includes(q.toLowerCase()))
  const exportCsv = () => csvDownload('vsa-alias-map.csv', [
    ['Kind', 'Alias as written', 'Source', 'Maps to code', 'Maps to name', 'Hits', 'Confidence %', 'Status'],
    ...rows.map(a => [a.kind, a.alias, a.source, a.mapsTo, a.mapsToName, a.hits, a.confidence, a.status]),
  ])
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search alias or master name…" />
        <ExportBtn onClick={exportCsv} />
      </div>
      <TableCard maxH="30rem">
        <thead>
          <tr><th>Kind</th><th>As written on the bill</th><th>Seen on</th><th>Resolves to</th><th className="num">Hits</th><th className="num">Confidence</th><th>Status</th></tr>
        </thead>
        <tbody>
          {rows.map(a => (
            <tr key={a.id}>
              <td><span className="badge-gray">{a.kind}</span></td>
              <td className="font-mono text-xs" style={{ color: 'var(--text-1)' }}>{a.alias}</td>
              <td className="text-xs">{a.source}</td>
              <td>
                <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{a.mapsToName}</p>
                <p className="font-mono text-[10px]" style={{ color: 'var(--text-4)' }}>{a.mapsTo}</p>
              </td>
              <td className="num tabular-nums">{a.hits}</td>
              <td className="num tabular-nums">
                <span className={cn('font-semibold', a.confidence >= 95 ? 'text-green-600' : a.confidence >= 85 ? 'text-amber-600' : 'text-red-500')}>
                  {a.confidence}%
                </span>
              </td>
              <td>{a.status === 'Confirmed'
                ? <span className="badge-green"><CheckCircle2 size={11} /> Confirmed</span>
                : <span className="badge-yellow"><AlertTriangle size={11} /> Review</span>}</td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      <p className="text-[11px] mt-3" style={{ color: 'var(--text-4)' }}>
        Every correction made in AI Capture writes back here, so the same scrawl is recognised without help the next time.
      </p>
    </>
  )
}

/* ── 5. Cut pieces and TBC ─────────────────────────────────────────── */
function Cuts() {
  const back = CUT_PIECES.filter(c => c.disposition === 'Back to Stock')
  const tbc = CUT_PIECES.filter(c => c.disposition === 'TBC — awaiting cut')
  const scrap = CUT_PIECES.filter(c => c.disposition === 'Scrap / Melt')

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <Stat label="Returned to Stock" value={`${back.reduce((s, c) => s + c.pieces, 0)} pcs`} icon={Boxes} tone="green" sub={`${back.reduce((s, c) => s + c.weightKg, 0).toFixed(1)} kg re-added`} />
        <Stat label="TBC — Awaiting Cut" value={`${tbc.reduce((s, c) => s + c.pieces, 0)} pcs`} icon={Scissors} tone="amber" sub="Reserved, not sellable" />
        <Stat label="Scrap / Melt" value={`${scrap.reduce((s, c) => s + c.weightKg, 0).toFixed(1)} kg`} icon={Scale} tone="red" sub="End-cuts written off" />
      </div>

      <TableCard maxH="28rem">
        <thead>
          <tr><th>Date</th><th>Section</th><th className="num">Parent</th><th className="num">Cut To</th><th className="num">Pieces</th><th className="num">End Balance</th><th className="num">Weight</th><th>Location</th><th>Against</th><th>Disposition</th></tr>
        </thead>
        <tbody>
          {CUT_PIECES.map(c => (
            <tr key={c.id}>
              <td className="text-xs whitespace-nowrap">{fmtDate(c.date)}</td>
              <td>
                <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{c.name}</p>
                <p className="font-mono text-[10px]" style={{ color: 'var(--text-4)' }}>{c.code}</p>
              </td>
              <td className="num tabular-nums text-xs">{c.parentLengthFt} ft</td>
              <td className="num tabular-nums text-xs">{c.cutLengthFt} ft</td>
              <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{c.pieces}</td>
              <td className="num tabular-nums text-xs">{c.balanceEndFt ? `${c.balanceEndFt} ft` : '—'}</td>
              <td className="num tabular-nums text-xs">{c.weightKg} kg</td>
              <td className="text-xs">{c.location}</td>
              <td className="text-[11px] font-mono whitespace-nowrap" style={{ color: 'var(--text-4)' }}>{c.againstInvoice}</td>
              <td>
                <span className={c.disposition === 'Back to Stock' ? 'badge-green' : c.disposition === 'Scrap / Melt' ? 'badge-red' : 'badge-yellow'}>
                  {c.disposition}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      <p className="text-[11px] mt-3" style={{ color: 'var(--text-4)' }}>
        Cutting a 12 ft length to size posts the cut pieces back at their own length and weight, and writes the unusable
        end off as scrap — so the piece count and the weight ledger both stay honest.
      </p>
    </>
  )
}
