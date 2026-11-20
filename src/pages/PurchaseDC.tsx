import { useState, useMemo } from 'react'
import { Scale, Boxes, Plus, Trash2, Ruler, Send } from 'lucide-react'
import { PageHead, Stat, Select, ExportBtn, Empty } from '@/components/ui'
import { SAMPLE_DC, lengthCheck, suspectLines, type DcLine } from '@/data/despatch'
import { LOADED } from '@/data/coatbook'
import { PICK_OPTIONS, productById, masterIdOf, LENGTHS } from '@/data/productmaster'
import { SUPPLIERS } from '@/data/parties'
import { PARTY_CODES, LOCATION_CODES } from '@/data/partycodes'
import { csvDownload, kg as kgFmt } from '@/lib/utils'
import { SectionPicker } from '@/components/SectionPicker'
import { FY } from '@/data/company'

/* ── The purchase DC, as the shop asked for it on 20-11-2026 ───────────────
   Their words, and what each one changed:

   "Can you open the Excel I have given" — the page was opening on the February
   depot sheet, which has no codes on it. Their own loaded sheet is the default
   now; the February one is still here behind the selector, because it is a real
   document and the SP / DP / DIV on it still have to be pointed at a section.

   "The name should not be changed, but the products should be allowed to
   change" — so the name is not a text box. You pick a product; the name, the
   code and the length all come with it.

   "Length column is not required, it is included in the particulars" — gone.
   Length is in the name, which is where they write it, and the filter above the
   table does what the column was being used for.

   "Weight range and KG per piece is the same. Remove weight range" — gone.
   "If it is 30 pieces, according to per KG amount it has to be calculated
   automatically, that is 1.232 into 30" — so it does: type either the weight or
   the weight per piece and the other follows from the count.

   "For a complete DC it should have only one point" — one Sent to, at the foot,
   not a destination against every line.

   "None of these are relevant data in this particular page" — the four cards at
   the top are two: total weight and total pieces.

   "Instead of written at the foot, can we change it to overall" — and leave it
   optional, so the print takes the calculated figure unless somebody writes one
   over it.

   "Error details should come at the bottom. Before the closure is enough" — the
   one check they kept is the last thing on the page.                        */

interface Row {
  slNo: number
  /** the master product this line is, '' until one is picked */
  productId: string
  /** their code — from the product, or off the paper where nothing matches */
  code: string
  /** their own words for this line, kept so a query can be put to the paper */
  written: string
  nos: number
  kgPerPiece: number | null
  /** null where the row shares the weighment written on the row above it */
  kg: number | null
  internal: string
}

interface Sheet {
  id: string
  label: string
  supplier: string
  date: string
  poNo: string
  vehicleNo: string
  ccNo: string
  /** where the whole load went, as the sheet itself says */
  sentTo: string
  /** what somebody has written over the total, if anything — empty by default */
  overall: string
  /** the figure at the foot of the paper, kept for reference, never printed */
  paperKg: number | null
  rows: Row[]
}

const per = (kg: number | null, nos: number) =>
  kg !== null && nos > 0 ? +(kg / nos).toFixed(3) : null

/* Their loaded sheet. Hardware and rubber travel on it too, so they come
   through — a DC is everything on the lorry, not only the extrusions. */
const loadedSheet = (): Sheet => ({
  id: 'loaded',
  label: 'Loaded out 16 / 17-09-2026 — M1 to PC1',
  supplier: 'M1 — Manufacturer 1',
  date: '2026-09-17', poNo: '—', vehicleNo: '—', ccNo: '',
  sentTo: 'PC1', overall: '', paperKg: null,
  rows: LOADED.map((l, i) => ({
    slNo: i + 1,
    productId: masterIdOf(l) ?? '',
    code: l.code ?? '',
    written: l.name,
    nos: l.nos,
    kgPerPiece: per(l.kg, l.nos),
    kg: l.kg,
    internal: l.internal ?? '',
  })),
})

/* The February depot sheet. No codes on it, and SP / DP / DIV have not been
   pointed at a section yet — so the product column opens empty and waits. */
const febSheet = (): Sheet => ({
  id: 'feb',
  label: 'Despatch 13-02-2026 — Jindal depot',
  supplier: SAMPLE_DC.supplier,
  date: SAMPLE_DC.date, poNo: SAMPLE_DC.poNo, vehicleNo: SAMPLE_DC.vehicleNo,
  ccNo: SAMPLE_DC.ccNo,
  /* Their paper says 595.560 and the lines add to 590.060. That gap is theirs
     to settle, so it is shown and not acted on — writing it into Overall would
     quietly print a figure five and a half kilos away from the lines, and they
     were plain that the print takes the calculated total unless somebody
     deliberately writes over it. */
  sentTo: 'GODOWN 1', overall: '', paperKg: SAMPLE_DC.writtenTotalKg,
  rows: SAMPLE_DC.lines.map(l => ({
    slNo: l.slNo,
    productId: '',
    code: l.particulars,
    written: `${l.particulars} ${l.lengthFt}`,
    nos: l.pieces,
    kgPerPiece: per(l.netWeightKg, l.pieces),
    kg: l.netWeightKg,
    internal: '',
  })),
})

const SHEETS = [loadedSheet(), febSheet()]

/** Everywhere a load can be sent: the coater, and our own four places. */
const DESTINATIONS = [
  ...PARTY_CODES.filter(p => p.kind === 'coater').map(p => `${p.code} — ${p.name}`),
  ...LOCATION_CODES.map(l => `${l.code} — ${l.name}`),
]
const destLabel = (code: string) => DESTINATIONS.find(d => d.startsWith(code + ' ')) ?? code

export default function PurchaseDC() {
  const [sheetId, setSheetId] = useState(SHEETS[0].id)
  const [sheets, setSheets] = useState<Sheet[]>(SHEETS)
  const [lenFilter, setLenFilter] = useState('All lengths')

  const sheet = sheets.find(s => s.id === sheetId)!
  const rows = sheet.rows

  const edit = (p: Partial<Sheet>) =>
    setSheets(ss => ss.map(s => s.id === sheetId ? { ...s, ...p } : s))

  const setRows = (f: (r: Row[]) => Row[]) =>
    setSheets(ss => ss.map(s => s.id === sheetId ? { ...s, rows: f(s.rows) } : s))

  /* ── Weight and weight-per-piece hold each other up ───────────────────
     Whichever of the three the shop types, the other two are worked out from
     it. Nobody multiplies anything by hand and nothing silently disagrees. */
  const patch = (sl: number, p: Partial<Row>, drive?: 'kg' | 'perPiece' | 'nos') =>
    setRows(rs => rs.map(r => {
      if (r.slNo !== sl) return r
      const n = { ...r, ...p }
      if (drive === 'kg') n.kgPerPiece = per(n.kg, n.nos)
      else if (drive === 'perPiece') {
        n.kg = n.kgPerPiece === null ? null : +(n.kgPerPiece * n.nos).toFixed(3)
      } else if (drive === 'nos') {
        if (n.kgPerPiece !== null) n.kg = +(n.kgPerPiece * n.nos).toFixed(3)
        else n.kgPerPiece = per(n.kg, n.nos)
      }
      return n
    }))

  /* Picking a product brings its code, and its weight per piece where their
     own books have weighed it — then the weight follows from the count. */
  const pick = (sl: number, id: string) => setRows(rs => rs.map(r => {
    if (r.slNo !== sl) return r
    const p = productById(id)
    if (!p) return { ...r, productId: '' }
    const kgPerPiece = r.kgPerPiece ?? p.kgPerPiece
    return {
      ...r, productId: id, code: p.code || r.code, kgPerPiece,
      kg: kgPerPiece !== null ? +(kgPerPiece * r.nos).toFixed(3) : r.kg,
    }
  }))

  const addRow = () => setRows(rs => [...rs, {
    slNo: rs.length ? Math.max(...rs.map(r => r.slNo)) + 1 : 1,
    productId: '', code: '', written: '', nos: 0, kgPerPiece: null, kg: null, internal: '',
  }])

  /* A blank weight is already covered by the weighment on the row above, so
     adding a nought for it would be right and counting it twice would not. */
  const totalKg = +rows.reduce((s, r) => s + (r.kg ?? 0), 0).toFixed(3)
  const unweighed = rows.filter(r => r.kg === null).length
  const totalNos = rows.reduce((s, r) => s + r.nos, 0)

  /* The printed figure is the one that was added up, unless somebody has
     written one over it. Theirs: "if I enter something, let it take whatever
     is written in the manual" — and otherwise leave it alone. */
  const overallTyped = sheet.overall.trim() !== '' && Number.isFinite(Number(sheet.overall))
  const printKg = overallTyped ? Number(sheet.overall) : totalKg

  /** Rows shown, after the length filter that replaced the length column. */
  const shown = useMemo(() => {
    if (lenFilter === 'All lengths') return rows
    const ft = parseFloat(lenFilter)
    return rows.filter(r => (productById(r.productId)?.lengthFt ?? 0) === ft)
  }, [rows, lenFilter])

  /* ── The one check they kept ───────────────────────────────────────────
     "This error is fine" — a code is one cross section, so every line carrying
     it must weigh the same per running foot whatever length it was cut to. The
     length now comes out of the product's name rather than its own column, so
     the check reads the same thing the shop reads.                         */
  const asDcLines: DcLine[] = useMemo(() => rows
    /* A row sharing the weighment above it has no weight of its own to check.
       Read as nought it would be reported as a hundred per cent out, which is
       an invented error — so it is left out of the check entirely. */
    .filter(r => r.kg !== null)
    .map(r => {
      const p = productById(r.productId)
      return {
        slNo: r.slNo,
        particulars: r.code || r.written,
        weightRange: null,
        netWeightKg: r.kg as number,
        lengthFt: `${p?.lengthFt || 0}'`,
        pieces: r.nos,
      }
    }), [rows])

  const suspect = useMemo(() => suspectLines(asDcLines), [asDcLines])
  const checkOf = (sl: number) => {
    const l = asDcLines.find(x => x.slNo === sl)
    return l ? lengthCheck(asDcLines, l) : null
  }

  const exportCsv = () => csvDownload(`vsa-purchase-dc-${sheet.id}.csv`, [
    [`Purchase DC — ${sheet.label}`, FY],
    ['Supplier', sheet.supplier, 'Date', sheet.date, 'P.O. No', sheet.poNo, 'Vehicle', sheet.vehicleNo],
    ['Sent to', destLabel(sheet.sentTo)],
    [], ['Code', 'Product Name', 'Qty (nos)', 'Kg / Piece', 'Weight (kgs)', 'Internal Name'],
    ...rows.map(r => [
      r.code, productById(r.productId)?.name ?? r.written, r.nos,
      r.kgPerPiece ?? '', r.kg ?? '', r.internal,
    ]),
    [], ['Total weight', totalKg], ['Total pieces', totalNos],
    ['Overall', overallTyped ? printKg : `${totalKg} (calculated)`],
  ])

  return (
    <div>
      <PageHead title="Purchase DC"
        sub="Entered exactly as the supplier's sheet is written — their columns, their order">
        <Select value={sheet.label}
          onChange={v => { setSheetId(sheets.find(s => s.label === v)!.id); setLenFilter('All lengths') }}
          options={sheets.map(s => s.label)} className="min-w-[18rem]" />
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      {/* Their two stats, and only their two. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <Stat label="Total Weight" value={kgFmt(totalKg)} icon={Scale} tone="brand"
          sub={overallTyped && printKg !== totalKg
            ? `${kgFmt(printKg)} written over it — that is what prints`
            : unweighed
            ? `${rows.length} lines · ${unweighed} share a weighment above`
            : `${rows.length} lines, added up`} />
        <Stat label="Total Pieces" value={`${totalNos} nos`} icon={Boxes} tone="violet"
          sub={`Sent to ${destLabel(sheet.sentTo)}`} />
      </div>

      {/* ── The sheet and its lines, as one thing ─────────────────────────
          "Can you clump it with the lines — it should be as a single entity." */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <p className="section-title text-base">{sheet.label}</p>
            <p className="section-sub">
              Pick the product and the code, the length and the weight a piece come with it.
            </p>
          </div>
          <Select value={lenFilter} onChange={setLenFilter}
            options={['All lengths', ...LENGTHS.map(f => `${f} ft`)]} className="min-w-[9rem]" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pb-4 mb-1"
          style={{ borderBottom: '1px solid var(--border-2)' }}>
          <div className="lg:col-span-2"><label className="label">Supplier</label>
            <Select value={sheet.supplier} onChange={v => edit({ supplier: v })}
              options={[...new Set([sheet.supplier, ...SUPPLIERS.map(s => s.name),
                ...PARTY_CODES.map(p => `${p.code} — ${p.name}`)])].filter(Boolean)}
              className="!w-full" /></div>
          <div><label className="label">Date</label>
            <input type="date" className="input w-full" value={sheet.date}
              onChange={e => edit({ date: e.target.value })} /></div>
          <div><label className="label">P.O. No</label>
            <input className="input w-full" value={sheet.poNo}
              onChange={e => edit({ poNo: e.target.value })} /></div>
          <div><label className="label">Vehicle No</label>
            <input className="input w-full" value={sheet.vehicleNo}
              onChange={e => edit({ vehicleNo: e.target.value })} /></div>
        </div>

        <div className="overflow-auto -mx-1 px-1" style={{ maxHeight: '36rem' }}>
          <table className="w-full">
            <thead>
              <tr>
                <th className="num">Sl</th>
                <th>Code</th>
                <th>Product Name</th>
                <th className="num">Qty (nos)</th>
                <th className="num">Kg / Piece</th>
                <th className="num">Weight (kgs)</th>
                <th>Internal Name</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map(r => {
                const p = productById(r.productId)
                const bad = checkOf(r.slNo)?.suspect
                return (
                  <tr key={r.slNo}>
                    <td className="num tabular-nums text-xs" style={{ color: 'var(--text-4)' }}>{r.slNo}</td>
                    <td className="font-mono text-xs whitespace-nowrap"
                      style={{ color: p ? 'var(--text-1)' : 'var(--text-4)' }}>{r.code || '—'}</td>
                    <td className="min-w-[15rem]">
                      {/* Selection only — the name is never typed over. */}
                      <SectionPicker options={PICK_OPTIONS} value={r.productId}
                        onChange={id => pick(r.slNo, id)}
                        placeholder="Type a product name…" />
                      {!p && r.written && (
                        <p className="text-[10.5px] mt-1 font-mono" style={{ color: 'var(--text-4)' }}
                          title="What the supplier wrote on the paper">on the paper: {r.written}</p>
                      )}
                    </td>
                    <td className="num">
                      <input className="input !w-20 !py-1 text-right tabular-nums !text-xs" value={r.nos}
                        onChange={e => patch(r.slNo, { nos: Number(e.target.value) || 0 }, 'nos')} />
                    </td>
                    <td className="num">
                      <input className="input !w-20 !py-1 text-right tabular-nums !text-xs"
                        value={r.kgPerPiece ?? ''} placeholder="—"
                        onChange={e => patch(r.slNo,
                          { kgPerPiece: e.target.value === '' ? null : Number(e.target.value) }, 'perPiece')} />
                    </td>
                    <td className="num">
                      <input className="input !w-24 !py-1 text-right tabular-nums !text-xs"
                        value={r.kg ?? ''} placeholder="weighed above"
                        style={bad ? {
                          borderColor: 'var(--amber, #f59e0b)',
                          background: 'color-mix(in srgb, var(--amber, #f59e0b) 8%, transparent)',
                        } : undefined}
                        title={bad ? 'This weight does not agree with the other lines of this code — see the foot of the page' : undefined}
                        onChange={e => patch(r.slNo,
                          { kg: e.target.value === '' ? null : Number(e.target.value) }, 'kg')} />
                    </td>
                    <td>
                      <input className="input !w-28 !py-1 !text-xs" value={r.internal} placeholder="—"
                        onChange={e => patch(r.slNo, { internal: e.target.value })} />
                    </td>
                    <td>
                      <button className="btn-ghost !px-1.5 !py-1" style={{ color: 'var(--red)' }}
                        onClick={() => setRows(rs => rs.filter(x => x.slNo !== r.slNo))}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                )
              })}
              {shown.length === 0 && (
                <tr><td colSpan={8}>
                  <Empty msg={rows.length ? `No ${lenFilter.toLowerCase()} on this sheet` : 'No lines yet'} />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── The foot of the sheet ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-4 pt-4 mt-1"
          style={{ borderTop: '1px solid var(--border-2)' }}>
          <button className="btn-outline" onClick={addRow}><Plus size={14} /> Add a line</button>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="label flex items-center gap-1.5"><Send size={11} /> Sent to</label>
              <Select value={destLabel(sheet.sentTo)}
                onChange={v => edit({ sentTo: v.split(' — ')[0] })}
                options={DESTINATIONS} className="min-w-[13rem]" />
            </div>
            <div className="text-right">
              <p className="label">Total</p>
              <p className="text-sm tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>
                {kgFmt(totalKg)} · {totalNos} nos
              </p>
            </div>
            <div>
              <label className="label">Overall</label>
              <input className="input !w-28 text-right tabular-nums !text-xs"
                value={sheet.overall} placeholder={totalKg.toFixed(3)}
                title="Leave it empty and the total above is what prints. Write a figure here and that one prints instead."
                onChange={e => edit({ overall: e.target.value })} />
            </div>
          </div>
        </div>
        <p className="text-[11px] mt-2.5" style={{ color: 'var(--text-4)' }}>
          Overall is optional. Empty, and the print carries the <b>{totalKg.toFixed(3)} kg</b> the lines add
          up to. Put a round figure in and the print carries that instead — the lines are left as they are.
          {sheet.paperKg !== null && Math.abs(sheet.paperKg - totalKg) > 0.005 && (
            <>
              {' '}The foot of this paper reads <b>{sheet.paperKg.toFixed(3)} kg</b>, which is
              {' '}{Math.abs(sheet.paperKg - totalKg).toFixed(3)} kg from what the lines come to. It has not
              been written into Overall, because that would print a figure the lines do not support.
            </>
          )}
        </p>
      </div>

      {/* ── What is left to be pointed at a product ───────────────────── */}
      {rows.some(r => !r.productId) && (
        <p className="text-[11.5px] mt-4" style={{ color: 'var(--text-4)' }}>
          {rows.filter(r => !r.productId).length} of {rows.length} lines are not pointed at a product yet.
          What the supplier wrote is kept under each one so it can be matched against the paper. Nothing has
          been guessed.
        </p>
      )}

      {/* ── Errors, last, as asked ────────────────────────────────────── */}
      {suspect.length > 0 && (
        <div className="card mt-5" style={{ borderColor: 'var(--amber, #f59e0b)' }}>
          <p className="section-title text-base mb-1 flex items-center gap-2">
            <Ruler size={15} style={{ color: 'var(--amber, #f59e0b)' }} />
            {suspect.length === 1
              ? 'One Line Does Not Match Its Own Code'
              : `${suspect.length} Lines Do Not Match Their Own Code`}
          </p>
          <p className="section-sub mb-3 max-w-4xl">
            A code is one cross section, so every line carrying it should weigh the same per foot whatever
            length it was cut to. These weigh as though they were cut to a different length.
          </p>
          <div className="space-y-2">
            {suspect.map(({ line, check }) => (
              <div key={line.slNo} className="rounded-lg p-3"
                style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <p className="text-sm" style={{ color: 'var(--text-1)' }}>
                  Line {line.slNo} — <b className="font-mono">{line.particulars}</b>, written {line.lengthFt},
                  {' '}{line.pieces} nos, {line.netWeightKg} kg. At {check.kgPerFt} kg per foot that weight is
                  {' '}<b style={{ color: 'var(--amber, #f59e0b)' }}>nearer {check.impliedFt} ft</b>
                  {' '}({check.offPct > 0 ? '+' : ''}{check.offPct}%).
                </p>
              </div>
            ))}
          </div>
          <p className="text-[11.5px] mt-3 pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
            Nothing has been changed. A length guessed here would quietly spoil the weight per piece of every
            job cut from that section afterwards, so it is shown and left for someone to check against the paper.
          </p>
        </div>
      )}
    </div>
  )
}
