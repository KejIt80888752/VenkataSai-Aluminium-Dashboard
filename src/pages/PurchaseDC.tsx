import { useState, useMemo } from 'react'
import {
  Scale, Boxes, Plus, Trash2, Ruler, Send, FileSpreadsheet, Printer,
  FileInput, ChevronRight, ChevronLeft,
} from 'lucide-react'
import { PageHead, Stat, Select, SearchBox, ExportBtn, TableCard, Empty } from '@/components/ui'
import DcDoc, { type DcPrintLine } from '@/components/DcDoc'
import { xlsDownload } from '@/lib/sheetexport'
import { SAMPLE_DC, lengthCheck, suspectLines, type DcLine } from '@/data/despatch'
import { LOADED } from '@/data/coatbook'
import { PICK_OPTIONS, productById, masterIdOf, pieceKgAt, LENGTHS } from '@/data/productmaster'
import { SUPPLIERS } from '@/data/parties'
import { PARTY_CODES, LOCATION_CODES } from '@/data/partycodes'
import { csvDownload, kg as kgFmt, fmtDate } from '@/lib/utils'
import { SectionPicker, loose } from '@/components/SectionPicker'
import { useAliases } from '@/lib/useAliases'
import { FY } from '@/data/company'
import { today } from '@/lib/docnos'

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
  /* ── Weight range, not weight per piece ─────────────────────────────────
     Theirs, on 20-11: "kg/piece replace with weight range". They are not
     quite the same thing and the shop knows it better than we do — a range
     is what the mill says a piece of that section ought to weigh, and the
     weight on the line is what it actually weighed. Their own February sheet
     carries one: 1.900 against the 2.5x1.5 RT line, which came in at 1.763,
     seven per cent under. That gap is the whole reason a range is written
     down at all, and a column holding the actual figure could never show it.

     So the range is the section's figure, taken off the paper where the
     paper gives one and from the master otherwise. Typing a range works out
     the weight — "1.232 into 30", as they put it. Typing a weight leaves the
     range alone, because a lot coming in under or over its range is ordinary
     and overwriting the range would hide it.                             */
  weightRange: number | null
  /** null where the row shares the weighment written on the row above it */
  kg: number | null
  /** the length on this line, which a cross section needs to be weighed at */
  lengthFt: number
  /** what the paper said, where the shop has since corrected the length */
  writtenLengthFt?: string
  internal: string
}

/** What a piece of this ought to weigh, where anything says so. */
const nominalOf = (productId: string, lengthFt: number) => pieceKgAt(productId, lengthFt)

interface Sheet {
  id: string
  label: string
  /** a line of plain words for the list, saying what is on it */
  note: string
  /** the number on the supplier's own DC — what a query is quoted against */
  dcNo: string
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

/* ── One lorry, one DC ─────────────────────────────────────────────────────
   Theirs, on 20-11: "3 purchase DC should have been there as per excel, it's
   clubbed into one."

   They are right, and their own sheet says so. The 16/17-09 loading runs in
   three blocks — M1 TO PC1, S2 TO PC1, V1 TO PC1 — which is three suppliers
   sending three lots on three documents. Clubbing them put a mill's
   extrusions, a retailer's door parts and a hardware agency's handles on one
   purchase DC, which is not a document anybody could take to any of them.

   So each block is its own DC, and the page opens on the list of them.   */

interface Block {
  route: string
  supplier: string
  label: string
}

const BLOCKS: Block[] = [
  { route: 'M1 TO PC1', supplier: 'M1 — Manufacturer 1',      label: 'Sections from the mill' },
  { route: 'S2 TO PC1', supplier: 'S2 — Retail Supplier 2',   label: 'Bought-out door parts' },
  { route: 'V1 TO PC1', supplier: 'V1 — Hardware Supplier 1', label: 'Handles, hinges, rubber' },
]

const loadedSheets = (): Sheet[] => BLOCKS.map((b, i) => {
  const lines = LOADED.filter(l => l.route === b.route)
  return {
    id: `loaded-${i + 1}`,
    label: `${b.supplier.split(' — ')[0]} → PC1 · 16/17-09-2026`,
    note: b.label,
    dcNo: '',
    supplier: b.supplier,
    date: '2026-09-17', poNo: '—', vehicleNo: '—', ccNo: '',
    sentTo: 'PC1', overall: '', paperKg: null,
    rows: lines.map((l, j) => {
      const productId = masterIdOf(l) ?? ''
      const lengthFt = productById(productId)?.lengthFt ?? 0
      return {
        slNo: j + 1,
        productId,
        code: l.code ?? '',
        written: l.name,
        nos: l.nos,
        /* Their loading sheet writes no range, so the section's own figure
           stands in — worked out from every weighed line of it in their books. */
        weightRange: nominalOf(productId, lengthFt) ?? per(l.kg, l.nos),
        kg: l.kg,
        lengthFt,
        internal: l.internal ?? '',
      }
    }),
  }
})

/* The February depot sheet, which is a document of its own. */
const febSheet = (): Sheet => ({
  id: 'feb',
  label: 'Jindal depot · 13-02-2026',
  note: 'Extruded sections, taken into Godown 1',
  dcNo: SAMPLE_DC.no,
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
    /* The depot wrote a range against one line of fourteen. Where it did,
       that is the range; the rest fill in as their shorthand is taught. */
    weightRange: l.weightRange,
    kg: l.netWeightKg,
    lengthFt: parseFloat(l.lengthFt) || 0,
    writtenLengthFt: l.writtenLengthFt,
    internal: '',
  })),
})

const SHEETS = [...loadedSheets(), febSheet()]

/** Everywhere a load can be sent: the coater, and our own four places. */
const BUILT_IN_DESTINATIONS = [
  ...PARTY_CODES.filter(p => p.kind === 'coater').map(p => `${p.code} — ${p.name}`),
  ...LOCATION_CODES.map(l => `${l.code} — ${l.name}`),
]

/* A place they add themselves. Their godowns and coaters will outgrow the
   four codes they first gave us, and a load has to be able to go somewhere
   new without waiting on us — theirs: "sent to, give the option to create
   new". Kept beside the built-in list rather than in it, so a name typed in
   a hurry can be told apart from the codes off their own sheets. */
const EXTRA_KEY = 'vsa-extra-destinations'
const readExtra = (): string[] => {
  try { return JSON.parse(localStorage.getItem(EXTRA_KEY) ?? '[]') } catch { return [] }
}
const writeExtra = (xs: string[]) => {
  try { localStorage.setItem(EXTRA_KEY, JSON.stringify(xs)) } catch { /* blocked */ }
}

const ADD_PLACE = '+ Somewhere new…'

export default function PurchaseDC() {
  /* ── The list comes first ─────────────────────────────────────────────
     Theirs: "DC list to be visible. Once we open, only then details list to
     be visible." A register of documents, and the lines inside one of them
     only when you have said which one. */
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [sheets, setSheets] = useState<Sheet[]>(SHEETS)
  const [lenFilter, setLenFilter] = useState('All lengths')
  const [find, setFind] = useState('')
  const [extra, setExtra] = useState<string[]>(() => readExtra())
  const [printing, setPrinting] = useState(false)

  /* ── What the depot's shorthand means ─────────────────────────────────
     SP, DP and DIV are theirs, confirmed by voice on 20-11. A line that has
     not been pointed at a product by hand falls back to what the shorthand
     has been taught as, so a sheet full of SP reads itself the moment the
     shorthand is known — which is the point of teaching it once. */
  const { ours } = useAliases('depot')
  const resolved = (r: Row) => r.productId || ours(r.code) || ''
  const rangeOf = (r: Row) => r.weightRange ?? nominalOf(resolved(r), r.lengthFt)

  const destinations = useMemo(() => [...BUILT_IN_DESTINATIONS, ...extra], [extra])
  const destLabel = (code: string) =>
    destinations.find(d => d === code || d.startsWith(code + ' ')) ?? code

  /** A DC they start themselves — theirs: "option to add new purchase DC is
      missing". Numbered from the register so two cannot collide. */
  const newDc = () => {
    const n = sheets.filter(x => x.id.startsWith('new-')).length + 1
    const fresh: Sheet = {
      id: `new-${Date.now().toString(36)}`,
      label: `New DC ${n}`,
      note: 'Started here, nothing on it yet',
      dcNo: '', supplier: '', date: today(), poNo: '—', vehicleNo: '—', ccNo: '',
      sentTo: 'GODOWN 1', overall: '', paperKg: null,
      rows: [],
    }
    setSheets(ss => [fresh, ...ss])
    setSheetId(fresh.id)
  }

  const addPlace = () => {
    const name = window.prompt('Where is this load going? Name the godown, shop or coater.')?.trim()
    if (!name) return
    if (!destinations.includes(name)) {
      const next = [...extra, name]
      setExtra(next); writeExtra(next)
    }
    edit({ sentTo: name })
  }

  const sheet = sheets.find(s => s.id === sheetId) ?? sheets[0]
  const rows = sheet.rows

  const edit = (p: Partial<Sheet>) =>
    setSheets(ss => ss.map(s => s.id === sheetId ? { ...s, ...p } : s))

  const setRows = (f: (r: Row[]) => Row[]) =>
    setSheets(ss => ss.map(s => s.id === sheetId ? { ...s, rows: f(s.rows) } : s))

  /* ── What drives what ─────────────────────────────────────────────────
     A range times a count is a weight — "1.232 into 30", as they put it — so
     typing a range or a count works the weight out. Typing a weight does not
     work backwards into the range: a lot can come in under or over what the
     mill says it should weigh, and that is exactly what the shop needs to be
     able to see. Overwriting the range with the actual would erase it. */
  const patch = (sl: number, p: Partial<Row>, drive?: 'kg' | 'range' | 'nos') =>
    setRows(rs => rs.map(r => {
      if (r.slNo !== sl) return r
      const n = { ...r, ...p }
      if (drive === 'range' || drive === 'nos') {
        if (n.weightRange !== null && n.nos > 0) n.kg = +(n.weightRange * n.nos).toFixed(3)
      }
      return n
    }))

  /* Picking a product brings its code and the range it ought to weigh at,
     worked out at this line's own length so a cross section can be weighed. */
  const pick = (sl: number, id: string) => setRows(rs => rs.map(r => {
    if (r.slNo !== sl) return r
    const p = productById(id)
    if (!p) return { ...r, productId: '' }
    const lengthFt = p.lengthFt || r.lengthFt
    const weightRange = r.weightRange ?? nominalOf(id, lengthFt)
    return { ...r, productId: id, code: p.code || r.code, lengthFt, weightRange }
  }))

  const addRow = () => setRows(rs => [...rs, {
    slNo: rs.length ? Math.max(...rs.map(r => r.slNo)) + 1 : 1,
    productId: '', code: '', written: '', nos: 0,
    weightRange: null, kg: null, lengthFt: 0, internal: '',
  }])

  /* A section's range is derived from their coating book, where some of the
     readings are of coated pieces, so a depot line running a few per cent
     light against it is ordinary and not worth marking. Fifteen is where it
     stops being tolerance and starts being a question — on their February
     sheet exactly one line passes it, the DIV at eleven feet that weighs like
     seven, which is the one they said themselves they would check. */
  const OFF_RANGE_LIMIT = 15

  /** How far a line came in from what its range says it should weigh. */
  const offRange = (r: Row) => {
    const range = rangeOf(r)
    if (range === null || range <= 0 || r.kg === null || r.nos <= 0) return null
    const expected = range * r.nos
    return +(((r.kg - expected) / expected) * 100).toFixed(1)
  }

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
    const ft = lenFilter === 'All lengths' ? null : parseFloat(lenFilter)
    /* Matched the same loose way the product box is — the foot mark, spaces
       and × make no difference — because a box that finds a product and a box
       that finds the line carrying it cannot disagree about what 16SG means. */
    const words = find.trim().split(/\s+/).map(loose).filter(Boolean)
    return rows.filter(r => {
      const p = productById(resolved(r))
      if (ft !== null && (p?.lengthFt || r.lengthFt || 0) !== ft) return false
      if (!words.length) return true
      /* The internal name is searched but never shown — theirs, on 20-11:
         "internal we will type in search bar but only billing name will
         display". */
      const hay = loose(`${p?.name ?? ''} ${r.code} ${r.written} ${r.internal}`)
      return words.every(w => hay.includes(w))
    })
  }, [rows, lenFilter, find, ours])

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
      const p = productById(r.productId || ours(r.code) || '')
      return {
        slNo: r.slNo,
        particulars: r.code || r.written,
        weightRange: null,
        netWeightKg: r.kg as number,
        lengthFt: `${p?.lengthFt || r.lengthFt || 0}'`,
        pieces: r.nos,
      }
    }), [rows, ours])

  const suspect = useMemo(() => suspectLines(asDcLines), [asDcLines])
  const checkOf = (sl: number) => {
    const l = asDcLines.find(x => x.slNo === sl)
    return l ? lengthCheck(asDcLines, l) : null
  }

  /** The sheet's own particulars, carried onto whatever comes out of it. */
  const headMeta = () => [
    { label: 'DC No', value: sheet.dcNo || '—' },
    { label: 'Supplier', value: sheet.supplier },
    { label: 'Date', value: sheet.date },
    { label: 'P.O. No', value: sheet.poNo },
    { label: 'Vehicle', value: sheet.vehicleNo },
    { label: 'Sent to', value: destLabel(sheet.sentTo) },
  ]

  const printLines = (): DcPrintLine[] => rows.map(r => ({
    slNo: r.slNo,
    code: r.code,
    name: productById(resolved(r))?.name ?? r.written,
    nos: r.nos,
    weightRange: rangeOf(r),
    kg: r.kg,
  }))

  const exportXls = () => xlsDownload(
    `vsa-purchase-dc-${sheet.id}`,
    `Purchase DC — ${sheet.label}`,
    headMeta(),
    ['SL', 'CODE', 'PRODUCT NAME', 'QTY (NOS)', 'WEIGHT RANGE', 'WEIGHT (KGS)'],
    printLines().map(l => [l.slNo, l.code, l.name, l.nos, l.weightRange, l.kg]),
    ['', '', 'TOTAL', totalNos, null, totalKg],
  )

  const exportCsv = () => csvDownload(`vsa-purchase-dc-${sheet.id}.csv`, [
    [`Purchase DC — ${sheet.label}`, FY],
    ['DC No', sheet.dcNo, 'Supplier', sheet.supplier, 'Date', sheet.date,
     'P.O. No', sheet.poNo, 'Vehicle', sheet.vehicleNo],
    ['Sent to', destLabel(sheet.sentTo)],
    [], ['Code', 'Product Name', 'Qty (nos)', 'Weight Range', 'Weight (kgs)'],
    ...rows.map(r => [
      r.code, productById(resolved(r))?.name ?? r.written, r.nos,
      rangeOf(r) ?? '', r.kg ?? '',
    ]),
    [], ['Total weight', totalKg], ['Total pieces', totalNos],
    ['Overall', overallTyped ? printKg : `${totalKg} (calculated)`],
  ])

  /* ── The register ─────────────────────────────────────────────────────
     Every DC with its totals, so the shop can see what it has before
     opening any of it. */
  const summaryOf = (x: Sheet) => ({
    nos: x.rows.reduce((a, r) => a + r.nos, 0),
    kg: +x.rows.reduce((a, r) => a + (r.kg ?? 0), 0).toFixed(3),
  })

  if (sheetId === null) return (
    <div>
      <PageHead title="Purchase DC"
        sub={`Every despatch sheet received, each one its own document · ${FY}`}>
        <button className="btn" onClick={newDc}><Plus size={14} /> New purchase DC</button>
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-5">
        <Stat label="Purchase DCs" value={String(sheets.length)} icon={FileInput} tone="brand"
          sub="one per supplier, per load" />
        <Stat label="Total Weight"
          value={kgFmt(+sheets.reduce((a, x) => a + summaryOf(x).kg, 0).toFixed(3))}
          icon={Scale} tone="violet" sub="across every sheet" />
        <Stat label="Total Pieces"
          value={`${sheets.reduce((a, x) => a + summaryOf(x).nos, 0)} nos`}
          icon={Boxes} tone="green" sub="including hardware" />
      </div>

      <TableCard>
        <thead>
          <tr><th className="uppercase">DC No</th><th className="uppercase">Supplier</th>
            <th className="uppercase">Date</th><th className="uppercase">Sent To</th>
            <th className="num uppercase">Lines</th><th className="num uppercase">Qty (nos)</th>
            <th className="num uppercase">Weight (kgs)</th><th /></tr>
        </thead>
        <tbody>
          {sheets.map(x => {
            const sum = summaryOf(x)
            return (
              <tr key={x.id} className="cursor-pointer" onClick={() => { setSheetId(x.id); setLenFilter('All lengths'); setFind('') }}>
                <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>
                  {x.dcNo || <span style={{ color: 'var(--text-4)' }}>not numbered</span>}
                </td>
                <td className="max-w-[15rem] truncate">
                  <span style={{ color: 'var(--text-1)' }}>{x.supplier || '—'}</span>
                  <span className="block text-[11px]" style={{ color: 'var(--text-4)' }}>{x.note}</span>
                </td>
                <td className="whitespace-nowrap text-xs">{x.date ? fmtDate(x.date) : '—'}</td>
                <td className="text-xs whitespace-nowrap">{destLabel(x.sentTo)}</td>
                <td className="num tabular-nums text-xs">{x.rows.length || '—'}</td>
                <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{sum.nos || '—'}</td>
                <td className="num tabular-nums">{sum.kg ? kgFmt(sum.kg) : '—'}</td>
                <td><ChevronRight size={14} style={{ color: 'var(--text-4)' }} /></td>
              </tr>
            )
          })}
        </tbody>
      </TableCard>

      <p className="text-[11.5px] mt-4 max-w-4xl" style={{ color: 'var(--text-4)' }}>
        Your 16/17-09 loading runs in three blocks — M1, S2 and V1 — which is three suppliers sending three
        lots on three documents, so it is three DCs here rather than one. Open any of them for its lines.
      </p>
    </div>
  )

  return (
    <div>
      <PageHead title={sheet.supplier || 'Purchase DC'}
        sub={`${sheet.note} · ${sheet.label}`}>
        <button className="btn-ghost" onClick={() => setSheetId(null)}>
          <ChevronLeft size={14} /> All DCs
        </button>
        <button className="btn-outline" onClick={() => setPrinting(true)}>
          <Printer size={14} /> PDF
        </button>
        <button className="btn-outline" onClick={exportXls}>
          <FileSpreadsheet size={14} /> Excel
        </button>
        <ExportBtn onClick={exportCsv} label="CSV" />
      </PageHead>

      {printing && (
        <DcDoc
          head={{
            label: sheet.label, dcNo: sheet.dcNo, supplier: sheet.supplier,
            date: sheet.date, poNo: sheet.poNo, vehicleNo: sheet.vehicleNo,
            sentTo: destLabel(sheet.sentTo),
          }}
          lines={printLines()} totalKg={totalKg} totalNos={totalNos}
          overall={overallTyped ? printKg : null}
          onClose={() => setPrinting(false)} />
      )}

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
          <div className="flex flex-wrap gap-2">
            <SearchBox value={find} onChange={setFind} placeholder="Find a product or code…" />
            <Select value={lenFilter} onChange={setLenFilter}
              options={['All lengths', ...LENGTHS.map(f => `${f} ft`)]} className="min-w-[9rem]" />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 pb-4 mb-1"
          style={{ borderBottom: '1px solid var(--border-2)' }}>
          <div className="lg:col-span-2"><label className="label">Supplier</label>
            <Select value={sheet.supplier} onChange={v => edit({ supplier: v })}
              options={[...new Set([sheet.supplier, ...SUPPLIERS.map(s => s.name),
                ...PARTY_CODES.map(p => `${p.code} — ${p.name}`)])].filter(Boolean)}
              className="!w-full" /></div>
          <div><label className="label">DC No</label>
            <input className="input w-full" value={sheet.dcNo} placeholder="as on the paper"
              onChange={e => edit({ dcNo: e.target.value })} /></div>
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
                {/* The two ran into each other on the paper-like layout, so
                    the serial gets its own room — theirs: "give space between
                    Sl.No and Code". */}
                {/* Their headings, in their words and their case: "all
                    headings CAPITAL LETTERS", and "kg/piece replace with
                    weight range" — the same figure under the name they use
                    for it, which is what they meant when they said the two
                    were the same thing. */}
                <th className="num !pr-6 uppercase">Sl</th>
                <th className="!pl-0 uppercase">Code</th>
                <th className="uppercase">Product Name</th>
                <th className="num uppercase">Qty (nos)</th>
                <th className="num uppercase">Weight Range</th>
                <th className="num uppercase">Weight (kgs)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map(r => {
                const p = productById(resolved(r))
                const bad = checkOf(r.slNo)?.suspect
                const off = offRange(r)
                return (
                  <tr key={r.slNo}>
                    <td className="num tabular-nums text-xs !pr-6" style={{ color: 'var(--text-4)' }}>{r.slNo}</td>
                    <td className="font-mono text-xs whitespace-nowrap !pl-0 text-left"
                      style={{ color: p ? 'var(--text-1)' : 'var(--text-4)' }}>{r.code || '—'}</td>
                    <td className="min-w-[15rem]">
                      {/* Selection only — the name is never typed over. */}
                      <SectionPicker options={PICK_OPTIONS} value={resolved(r)}
                        onChange={id => pick(r.slNo, id)}
                        placeholder="Type a product name…" />
                      {!p && r.written && (
                        <p className="text-[10.5px] mt-1 font-mono" style={{ color: 'var(--text-4)' }}
                          title="What the supplier wrote on the paper">on the paper: {r.written}</p>
                      )}
                      {/* A length the shop has corrected shows both figures,
                          so the paper can still be read against the screen. */}
                      {r.writtenLengthFt && (
                        <p className="text-[10.5px] mt-1" style={{ color: 'var(--amber)' }}
                          title="You corrected this on 20-11-2026 — the weight agrees with the shorter length">
                          paper says {r.writtenLengthFt}, read as {r.lengthFt}′
                        </p>
                      )}
                    </td>
                    <td className="num">
                      <input className="input !w-20 !py-1 text-right tabular-nums !text-xs" value={r.nos}
                        onChange={e => patch(r.slNo, { nos: Number(e.target.value) || 0 }, 'nos')} />
                    </td>
                    <td className="num">
                      <input className="input !w-20 !py-1 text-right tabular-nums !text-xs"
                        value={rangeOf(r) ?? ''} placeholder="—"
                        title="What a piece of this ought to weigh. Times the count, it gives the weight."
                        onChange={e => patch(r.slNo,
                          { weightRange: e.target.value === '' ? null : Number(e.target.value) }, 'range')} />
                    </td>
                    <td className="num">
                      <input className="input !w-24 !py-1 text-right tabular-nums !text-xs"
                        value={r.kg ?? ''} placeholder="weighed above"
                        style={bad || off !== null && Math.abs(off) > OFF_RANGE_LIMIT ? {
                          borderColor: 'var(--amber)',
                          background: 'color-mix(in srgb, var(--amber) 8%, transparent)',
                        } : undefined}
                        title={bad
                          ? 'This weight does not agree with the other lines of this code — see the foot of the page'
                          : off !== null && Math.abs(off) > OFF_RANGE_LIMIT
                          ? `${off > 0 ? '+' : ''}${off}% against its weight range`
                          : undefined}
                        onChange={e => patch(r.slNo,
                          { kg: e.target.value === '' ? null : Number(e.target.value) }, 'kg')} />
                      {off !== null && Math.abs(off) > OFF_RANGE_LIMIT && (
                        <p className="text-[10px] text-right mt-0.5 tabular-nums"
                          style={{ color: 'var(--amber)' }}>{off > 0 ? '+' : ''}{off}% off range</p>
                      )}
                    </td>
                    <td>
                      <button className="btn-ghost !px-1.5 !py-1" style={{ color: 'var(--red)' }}
                        onClick={() => setRows(rs => rs.filter(x => x.slNo !== r.slNo))}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                )
              })}
              {shown.length === 0 && (
                <tr><td colSpan={7}>
                  <Empty msg={rows.length
                    ? `Nothing on this sheet matches${find ? ` "${find}"` : ''}`
                      + `${lenFilter === 'All lengths' ? '' : ` at ${lenFilter}`}`
                    : 'No lines yet'} />
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
                onChange={v => v === ADD_PLACE ? addPlace() : edit({ sentTo: v.split(' — ')[0] })}
                options={[...destinations, ADD_PLACE]} className="min-w-[13rem]" />
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
      {rows.some(r => !resolved(r)) && (
        <p className="text-[11.5px] mt-4" style={{ color: 'var(--text-4)' }}>
          {rows.filter(r => !resolved(r)).length} of {rows.length} lines are not pointed at a product yet.
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
