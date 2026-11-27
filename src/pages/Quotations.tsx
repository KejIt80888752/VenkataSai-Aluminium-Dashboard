import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Trophy, Percent, IndianRupee, Plus, FileCheck2, History, Printer } from 'lucide-react'
import {
  PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Pager, usePaged, Empty, Pill, Modal,
} from '@/components/ui'
import { QUOTATIONS, INVOICES, type Quotation, type Invoice } from '@/data/txns'
import { inr, inr2, fmtDate, csvDownload } from '@/lib/utils'
import { COMPANY, FY } from '@/data/company'
import { useCrud } from '@/lib/store'
import { RowActions, EditedDot } from '@/components/crud'
import DocBuilder, { WHOLE_SLAB, type BuiltDoc, type BuiltLine } from '@/components/DocBuilder'
import QuoteDoc from '@/components/QuoteDoc'
import InvoiceDoc from '@/components/InvoiceDoc'
import {
  asQuotation, asInvoice, rowOfQuotation, rowOfInvoice, builtFrom,
  STATUS_OPTIONS, type DocRow,
} from '@/lib/docshapes'
import { MASTER } from '@/data/productmaster'
import { withColour } from '@/data/colours'
import { nextDocNo, revisionOf, revisionNumber, baseDocNo } from '@/lib/docnos'

/* ── Quotations and proformas ──────────────────────────────────────────────
   Asked for on 20-11-2026. The old form took a quote number, a date, a
   taxable value and a total, all typed, and had nowhere at all to put the
   material — "where is the material that you can enter?"

   Now the number comes out of the series, the date is the day it was raised,
   validity defaults, and the money is what the lines add up to. Editing a
   quotation does not overwrite it: it issues a revision carrying the same
   number with R1, R2 after it, dated the day it was revised, so the customer
   can see which version they are holding.

   A proforma is the same document under a different series, raised on its
   own or made from a quotation in one click — "either of these should be
   there... then we should have the proforma invoice and the quotation."   */

/* Four documents, four series, asked for on 20-11: "give / create proforma
   invoice option, estimate, tax invoice" — beside the quotation that was
   already here. An estimate is the rough one, a quotation the formal one, a
   proforma the one raised before despatch, and the tax invoice the one that
   carries credit. They are the same document under four headings, so they
   share one form and keep four numbering series that cannot collide. */
const SERIES = {
  'Quotation':        { prefix: 'VSA/Q/26-27',   store: 'quotations' },
  'Estimate':         { prefix: 'VSA/EST/26-27', store: 'estimates'  },
  'Proforma Invoice': { prefix: 'VSA/PI/26-27',  store: 'proformas'  },
  'Tax Invoice':      { prefix: 'VSA/INV/26-27', store: 'invoices'   },
} as const
type Kind = keyof typeof SERIES

/** Where each document lives, so carrying one forward moves the screen too. */
export const ROUTE_OF: Record<Kind, string> = {
  'Quotation': '/quotation',
  'Estimate': '/estimate',
  'Proforma Invoice': '/proforma-invoice',
  'Tax Invoice': '/tax-invoice',
}

const idOf = (x: { no: string }) => x.no

/* ── What is at each slab ──────────────────────────────────────────────────
   Theirs, on 21-11: "in estimate, GST view. Tax slab view."

   A document whose lines sit at more than one rate prints one GST figure,
   and nothing on it says which part of the supply carried which rate. That
   matters here because the metal, the coating and the hardware are three
   supplies and do not always share a slab. This is the working, on screen
   only — the paper carries the small figure beside each amount instead,
   because the breakdown is what they did not want a customer holding. */
const slabsOf = (r: DocRow) => {
  const by = new Map<number, { taxable: number; tax: number }>()
  for (const l of r.lines) {
    if (!l.amount) continue
    const at = by.get(l.gst) ?? { taxable: 0, tax: 0 }
    at.taxable += l.amount
    at.tax += l.amount * (l.gst / 100)
    by.set(l.gst, at)
  }
  return [...by.entries()]
    .map(([gst, v]) => ({ gst, taxable: +v.taxable.toFixed(2), tax: +v.tax.toFixed(2) }))
    .sort((a, b) => b.taxable - a.taxable)
}

/* A tax invoice is a different record from an offer — it splits its tax three
   ways and carries what has been received — so the two are built in one place
   and read back into one display row. See src/lib/docshapes.ts. */
/* An empty code must not match a product that also has none — TBC carries no
   code, so a summary line with a blank one was coming back as TBC. */
const resolveProduct = (code: string, name: string) => {
  if (!code.trim()) return MASTER.find(p => p.name === name)?.id ?? ''
  return MASTER.find(p => p.code === code && p.name === name)?.id
    ?? MASTER.find(p => p.code === code)?.id
    ?? ''
}

/* ── Reading a document back into the form ────────────────────────────────
   A revision has to reopen on exactly what went out, and it did not. The
   metal line and the one coating charge are summaries, so they were dropped
   on the way back in — correctly — but with them went the only record of how
   the document was priced: the rate a kilo, whether the coating was charged
   once or section by section, and what each section actually weighed.

   So VSA/Q/26-27/0011 reopened as R2 with every section priced by the piece,
   no metal, and a powder coating line reading nought kilos at nought rupees.
   The shape of the document is read back off those summary lines now, and
   each section carries the weight and the basis it was priced on.         */
const toBuilt = (r: DocRow): Partial<BuiltDoc> => {
  const metals = r.lines.filter(l => l.group === 'aluminium')
  const metalL = metals[0]
  const coatL = r.lines.find(l => l.group === 'coating' && !l.productId && !l.code)
  return {
  ...builtFrom(r),
  aluminium: { on: !!metalL, rate: metalL?.rate ?? 0, gst: metalL?.gst ?? 18 },
  /* ── The weight comes back with the document ────────────────────────
     Theirs, on 22-11: "while trying to edit ESTIMATE again, weight
     disappeared." It had nowhere to come back from. Everywhere but the
     quotation the weight is one figure typed against the metal, so it
     lives on the metal line — and the metal line is a summary, which this
     drops on the way in so the same kilos are not billed twice. The
     figure was going out with it.

     It is read off that line before it is dropped. A quotation works its
     own weight out of the sections, so it wants none of this. */
  metalKg: metals.length
    ? +metals.reduce((s, l) => s + (l.kg ?? l.qty ?? 0), 0).toFixed(3)
    : undefined,
  /* ── Each rate keeps its own weight ──────────────────────────────────
     Theirs, on 27-11: "that weight issue is repeating again... estimate I
     checked, it's not holding."

     A job that mixes series is priced at more than one rate a kilo, and the
     form holds a weight against each — thirty kilos at 415 and twenty at
     445 are two lines on the paper. Coming back in, all of it was being
     handed to the first rate and the second block opened empty: the total
     survived, the split did not, and the metal was billed at the wrong
     money. Each block is read back off its own line. */
  metalBlocks: metals.length
    ? metals.map(l => ({ rate: l.rate, kg: +(l.kg ?? l.qty ?? 0), gst: l.gst }))
    : undefined,
  /* ── How it was priced, as the document says ────────────────────────
     Theirs, on 27-11: an estimate kept as a draft and opened again "misses
     the calculation". Both of these used to be guessed back from whether
     the document had a POWDER COATING line on it — and an estimate, which
     charges the coating section by section, has none. So a per-length
     estimate reopened as a per-kilo one at a lot rate of nought, and ₹144
     against each section came to nothing while the rate sat in the box
     looking right.

     The document records both now. Anything raised before does not, so it
     is read the way it used to be, except that a coated section's own unit
     is believed over the guess: sections are quoted by the piece, and a
     document with sections and no lot line was never by the kilo. */
  coatingMode: r.coatingMode ?? (coatL ? 'cumulative' : 'section'),
  coatingRate: coatL?.rate ?? 0,
  coatingUnit: r.coatingUnit
    ?? (coatL ? (coatL.unit === 'nos' ? 'nos' : 'kg')
      : r.lines.some(l => l.group === 'coating') ? 'nos' : 'kg'),
  coatingGst: r.coatingGst,
  /* The aluminium line and a cumulative coating line are summaries of the
     sections, not material in their own right. Read back as products they
     would be billed a second time, so only the sections come back. */
  lines: r.lines
    .filter(l => l.group !== 'aluminium')
    .filter(l => !(l.group === 'coating' && !l.productId && !l.code))
    .map((l, i): BuiltLine => ({
    key: `${l.code}-${i}`,
    /* Lines raised before the master existed carry no product, so they are
       matched back by code and name; failing that the row opens with its
       figures and an empty product box rather than being dropped. */
    productId: l.productId ?? resolveProduct(l.code, l.name),
    code: l.code, name: l.name, hsn: l.hsn,
    /* What it was priced on, as the document recorded it. Older documents
       carry neither, so the unit is read the way it used to be written. */
    basis: l.basis ?? (l.unit === 'kg' ? 'kg' : 'nos'),
    nos: l.nos ?? (l.unit === 'kg' ? 0 : l.qty),
    kg: l.kg ?? (l.unit === 'kg' ? l.qty : 0),
    metalRate: l.metalRate,
    uom: l.uom,
    narration: l.narration,
    colour: l.colour,
    rate: l.rate, gst: l.gst,
    })),
  }
}

/* ── One screen, four doors ────────────────────────────────────────────────
   They asked for quotation, proforma invoice and tax invoice "one below the
   other", and for the estimate to come out of the row of tabs and sit
   outside with them. So each has its own line in the menu and its own
   address, and the tab strip is gone. It is still one screen underneath,
   because the four are the same document under four headings — but nobody
   has to know that to find the one they want.                            */
export default function Quotations({ kind: fixedKind }: { kind?: Kind } = {}) {
  const [tabKind, setTabKind] = useState<Kind>('Quotation')
  const kind = fixedKind ?? tabKind
  const setKind = (k: Kind) => { if (!fixedKind) setTabKind(k); else nav(ROUTE_OF[k]) }
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All Status')
  const [sel, setSel] = useState<DocRow | null>(null)
  const [building, setBuilding] = useState<
    { no: string; from: Partial<BuiltDoc> | null; replacing?: string | null } | null>(null)
  const [printing, setPrinting] = useState<DocRow | null>(null)
  /** set while a document is being carried forward into a different register */
  const [carryTo, setCarryTo] = useState<Kind | null>(null)
  /** the document this one is being made out of, for the figures beside it */
  const [carriedFrom, setCarriedFrom] =
    useState<{ no: string; taxable: number; tax: number } | null>(null)

  /* The series are kept apart so their numbering cannot collide. Tax invoices
     share the billing screen's own store, so a bill raised here is the same
     bill there rather than a second copy of it. */
  const quotes = useCrud<Quotation>('quotations', QUOTATIONS, idOf)
  const ests = useCrud<Quotation>('estimates', [], idOf)
  const pis = useCrud<Quotation>('proformas', [], idOf)
  /* Typed as the bill it really is, and sharing the billing screen's store,
     so a bill raised here is the same bill there — not a quotation-shaped row
     that reads as NaN the moment the billing screen adds up its tax. */
  const invs = useCrud<Invoice>('invoices', INVOICES, idOf)

  const isInvoiceKind = kind === 'Tax Invoice'
  const crud = kind === 'Quotation' ? quotes : kind === 'Estimate' ? ests : pis

  const list: DocRow[] = useMemo(
    () => isInvoiceKind ? invs.rows.map(rowOfInvoice) : crud.rows.map(rowOfQuotation),
    [isInvoiceKind, invs.rows, crud.rows],
  )

  /* Everyone already billed or quoted, across all four, so a name is picked
     rather than retyped — theirs: "customer name from data selection". */
  const parties = useMemo(() => [...new Set(
    [...quotes.rows, ...ests.rows, ...pis.rows, ...invs.rows].map(x => x.clientName).filter(Boolean),
  )], [quotes.rows, ests.rows, pis.rows, invs.rows])

  const rows = useMemo(() => list.filter(x =>
    (status === 'All Status' || x.status === status) &&
    (q === '' || `${x.no} ${x.clientName} ${x.subject} ${x.owner}`.toLowerCase().includes(q.toLowerCase())),
  ), [list, q, status])

  const paged = usePaged(rows, 10)

  /* ── Counting documents, not versions of them ─────────────────────────
     A revision supersedes the one it revises; it is not a second quotation.
     Added up row by row, one quote revised twice would read as three quotes
     and three times the money. So the figures above count the newest version
     of each number and leave the superseded ones in the list below, which is
     where somebody looking for what was sent last month will want them. */
  const current = useMemo(() => {
    const newest = new Map<string, DocRow>()
    for (const x of list) {
      const base = baseDocNo(x.no)
      const held = newest.get(base)
      if (!held || revisionNumber(x.no) > revisionNumber(held.no)) newest.set(base, x)
    }
    return [...newest.values()]
  }, [list])

  /* A bill is won when it is paid; an offer when it is accepted. */
  /* A draft has not gone anywhere, so it is not counted as quoted — theirs,
     on 21-11, asking for the draft in the first place. It stays in the list
     below with everything else. */
  const sentOut = current.filter(x => x.status !== 'Draft')
  const drafts = current.filter(x => x.status === 'Draft')
  const won = current.filter(x => isInvoiceKind ? x.status === 'Paid' : x.status === 'Won')
  const open = current.filter(x => isInvoiceKind
    ? x.status !== 'Paid'
    : x.status === 'Sent' || x.status === 'Under Negotiation')
  const winRate = sentOut.length ? Math.round((won.length / sentOut.length) * 100) : 0
  const superseded = list.length - current.length
  const noun = kind.toLowerCase()

  /** Every version of the document this row revises, newest first. */
  const versionsOf = (x: DocRow) =>
    list.filter(y => baseDocNo(y.no) === baseDocNo(x.no))
      .sort((a, b) => revisionNumber(b.no) - revisionNumber(a.no))

  const startNew = () => {
    setCarriedFrom(null)
    setBuilding({ no: nextDocNo(SERIES[kind].prefix, list.map(x => x.no)), from: null })
  }

  /* ── Editing ──────────────────────────────────────────────────────────
     A quotation that has been sent is not changed, it is revised: the number
     stays and R1, R2 follows it, so the customer can see which version they
     are holding. A tax invoice is not revised at all — theirs, on 20-11:
     "if invoice revised, need not add R1, that implies only to quotation."
     A bill is a bill; it is corrected or it is cancelled. */
  /* ── A draft is continued, not revised ────────────────────────────────
     Theirs, on 22-11: "it should automatically save by default in draft, we
     will continue from there and then it should move to respective books."

     A draft was never sent, so there is nothing to revise and no customer
     holding an earlier version. Opening one picks up exactly where it was
     left, under its own number, and filing it replaces the draft rather
     than leaving a dead one behind it. A document that has gone out is a
     different matter and still takes R1, R2. */
  const startRevision = (x: DocRow) => {
    setCarriedFrom(null)
    const draft = x.status === 'Draft'
    setBuilding({
      no: draft || isInvoiceKind ? x.no : revisionOf(x.no),
      from: toBuilt(x),
      replacing: draft ? x.no : null,
    })
  }

  /** Taking a document off the register it actually lives in. */
  const removeDoc = (no: string) => (isInvoiceKind ? invs : crud).remove(no)

  /* Carrying a document forward. An estimate goes straight to a tax invoice —
     theirs: "in estimate, carry forward to tax invoice only to be given,
     remaining not required." A quotation still steps through the proforma,
     which is what a proforma is for. */
  const NEXT_STEP: Partial<Record<Kind, Kind>> = {
    'Estimate': 'Tax Invoice',
    'Quotation': 'Proforma Invoice',
    'Proforma Invoice': 'Tax Invoice',
  }

  /* ── Carrying a document forward ──────────────────────────────────────
     It opens the form rather than filing the next document silently, because
     the shop wants the unit rates in front of them before a bill goes out —
     theirs: "we should have option to change unit rate in tax invoice".

     Two rules on the way into a bill, both theirs. A line at nought per cent
     does not belong on a tax invoice at all and is dropped. A line written at
     the half of a split slab — 2.5 for the five, 9 for the eighteen, as the
     CGST column alone collects it — is put back to the whole slab the bill
     has to charge.                                                         */
  const forTaxInvoice = (lines: BuiltLine[]) => lines
    .filter(l => l.gst > 0)
    .map(l => ({ ...l, gst: WHOLE_SLAB[l.gst] ?? l.gst }))

  /* ── The metal's own slab travels with the lines ──────────────────────
     Theirs, on 27-11: "carry forward". The sections were being put back to
     the whole slab on the way into a bill and the aluminium was not, because
     the metal's rate and slab are typed once at the top of the form and are
     not a line. An estimate written the way they write it — 9 against the
     metal, 9 against the sections — carried forward as 18 on the sections
     and 9 on the aluminium, which is nearly the whole value of the bill
     charged at half the tax. The coating slab, where somebody has set one by
     hand, goes the same way. */
  const whole = (g: number) => WHOLE_SLAB[g] ?? g

  const carryForward = (x: DocRow) => {
    const to = NEXT_STEP[kind]
    if (!to) return
    const existing = to === 'Tax Invoice' ? invs.rows.map(r => r.no)
      : (to === 'Quotation' ? quotes : to === 'Estimate' ? ests : pis).rows.map(r => r.no)
    /* Everything comes across, not just the lines — theirs, on 21-11: "when
       converting an estimate into a tax invoice, allow the details to be
       edited". A bill opened with no metal rate and no coating charge is not
       something anybody can edit; it is something they have to retype. */
    const base = toBuilt(x)
    const lines = base.lines ?? []
    setCarryTo(to)
    /* What it was quoted at, so the bill can be read against it — theirs,
       on 22-11. It is shown on the form and never printed. */
    setCarriedFrom({ no: x.no, taxable: x.taxable, tax: x.tax })
    setBuilding({
      no: nextDocNo(SERIES[to].prefix, existing),
      from: {
        ...base,
        ...(to === 'Tax Invoice' ? {
          aluminium: base.aluminium
            ? { ...base.aluminium, gst: whole(base.aluminium.gst) }
            : base.aluminium,
          coatingGst: base.coatingGst != null ? whole(base.coatingGst) : base.coatingGst,
        } : {}),
        clientName: x.clientName,
        subject: x.subject,
        /* The terms do not travel. An offer promises a rate valid for the
           day and payment in advance; a bill that has already gone out on
           credit cannot carry either, and a tax invoice printed with
           "100% payment in advance" at the foot of it says the opposite of
           what the document is. Each kind opens with its own. */
        terms: undefined,
        lines: to === 'Tax Invoice' ? forTaxInvoice(lines) : lines,
      },
    })
  }

  /** Where a document being built is going, when it is not this screen's own. */
  const target = carryTo ?? kind

  const fileDoc = (d: BuiltDoc) => {
    /* The draft this one grew out of goes in the same write, so the
       register carries the document and not both halves of it. */
    const over = building?.replacing ?? null
    if (target === 'Tax Invoice') {
      const rec = asInvoice(d)
      over ? invs.replace(over, rec) : invs.add(rec)
    } else {
      const reg = target === 'Quotation' ? quotes : target === 'Estimate' ? ests : pis
      const rec = asQuotation(d, target, d.status === 'Draft' ? 'Draft' : 'Sent')
      over ? reg.replace(over, rec) : reg.add(rec)
    }
    setBuilding(null)
    setCarriedFrom(null)
    if (carryTo) { setCarryTo(null); setKind(carryTo) }
  }

  const exportCsv = () => csvDownload(`vsa-${SERIES[kind].store}.csv`, [
    ['No', 'Date', isInvoiceKind ? 'Due On' : 'Valid Till', 'Customer', 'Subject',
     'Taxable', 'GST', 'Total', 'Status', 'Owner'],
    ...rows.map(x => [x.no, x.date, x.until, x.clientName, x.subject,
      x.taxable, x.tax, x.total, x.status, x.owner]),
  ])

  return (
    <div>
      <PageHead title={`${kind}s`}
        sub={`Numbers issue themselves, revisions keep their number · ${FY}`}>
        <ExportBtn onClick={exportCsv} />
        <button className="btn" onClick={startNew}>
          <Plus size={14} /> New {noun}
        </button>
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label={`${kind}s Issued`} value={String(sentOut.length)} icon={FileText} tone="brand"
          sub={list.length
            ? `next is ${nextDocNo(SERIES[kind].prefix, list.map(x => x.no)).split('/').pop()}`
              + (superseded ? ` · ${superseded} superseded` : '')
              + (drafts.length ? ` · ${drafts.length} in draft` : '')
            : FY} />
        <Stat label="Value Quoted" value={inr(sentOut.reduce((s, x) => s + x.total, 0))} icon={IndianRupee}
          tone="violet" sub="Latest version of each, inclusive of GST — drafts excluded" />
        <Stat label="Converted" value={String(won.length)} icon={Trophy} tone="green"
          sub={inr(won.reduce((s, x) => s + x.total, 0)) + ' won'} />
        <Stat label="Win Rate" value={`${winRate}%`} icon={Percent} tone="sky"
          sub={`${open.length} still open`} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder={`Search ${noun} no, customer, subject…`} />
        <Select value={status} onChange={setStatus}
          options={['All Status', ...STATUS_OPTIONS[isInvoiceKind ? 'invoice' : 'offer']]} />
      </div>

      <TableCard>
        <thead>
          <tr><th>No</th><th>Date</th><th>Customer</th><th>Subject</th>
            <th className="num">Lines</th><th className="num">Total</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          {paged.slice.map(x => {
            const rev = revisionNumber(x.no)
            return (
              <tr key={x.id} className="cursor-pointer" onClick={() => setSel(x)}>
                <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>
                  <EditedDot isNew={crud.isNew(x.no)} isEdited={crud.isEdited(x.no)} />{x.no}
                  {rev > 0 && <span className="badge-yellow ml-1.5 !text-[9px] !px-1 !py-0">rev {rev}</span>}
                </td>
                <td className="whitespace-nowrap text-xs">{fmtDate(x.date)}</td>
                <td className="max-w-[13rem] truncate">{x.clientName}</td>
                <td className="max-w-[14rem] truncate text-xs">{x.subject}</td>
                <td className="num tabular-nums text-xs">{x.lines.length || '—'}</td>
                <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(x.total)}</td>
                <td><Pill s={x.status} /></td>
                <td onClick={e => e.stopPropagation()}>
                  <span className="flex items-center gap-1 justify-end">
                    <button className="btn-ghost !px-1.5 !py-1" title={`Print or save this ${noun} as a PDF`}
                      onClick={() => setPrinting(x)}><Printer size={13} /></button>
                    {NEXT_STEP[kind] && (
                      <button className="btn-ghost !px-1.5 !py-1"
                        title={`Carry this forward into a ${NEXT_STEP[kind]!.toLowerCase()}`}
                        onClick={() => carryForward(x)}><FileCheck2 size={13} /></button>
                    )}
                    {/* Deleting read from whichever offer register happened to
                        be current, so a bill deleted here stayed on the screen.
                        It goes from the register it lives in. */}
                    <RowActions label={x.no} onEdit={() => startRevision(x)}
                      onDelete={() => removeDoc(x.no)} />
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </TableCard>
      {rows.length === 0 && (
        <Empty msg={list.length
          ? `No ${noun} matches these filters`
          : `No ${noun} raised yet — "New ${noun}" issues ${nextDocNo(SERIES[kind].prefix, [])}`} />
      )}
      <Pager {...paged} />

      <p className="text-[11.5px] mt-4 max-w-4xl" style={{ color: 'var(--text-4)' }}>
        Editing issues a revision rather than changing what was already sent: the number stays and R1, R2
        follows it, dated the day it was revised. The pencil on a row raises that revision; the second icon
        turns a quotation into a proforma invoice under its own series.
      </p>

      {/* A bill prints on the GST invoice; an offer prints on its own
          document, which says on its face that it is not a tax invoice. */}
      {printing && isInvoiceKind && (() => {
        const inv = invs.rows.find(i => i.no === printing.no)
        return inv ? <InvoiceDoc inv={inv} onClose={() => setPrinting(null)} /> : null
      })()}
      {printing && !isInvoiceKind && (
        <QuoteDoc
          doc={{
            id: printing.id, no: printing.no, date: printing.date,
            validTill: printing.until, clientId: '', clientName: printing.clientName,
            subject: printing.subject, lines: printing.lines,
            taxable: printing.taxable, tax: printing.tax, total: printing.total,
            status: printing.status as Quotation['status'], owner: printing.owner,
            /* Its own terms, settled when it was raised — they were being
               dropped on the way to the printer, so every document printed
               the standard set whatever had been agreed on it. */
            terms: printing.terms,
          }}
          kind={kind} onClose={() => setPrinting(null)} />
      )}

      <DocBuilder open={!!building}
        onClose={() => { setBuilding(null); setCarryTo(null); setCarriedFrom(null) }}
        kind={target}
        docNo={building?.no ?? ''} initial={building?.from} parties={parties}
        carriedFrom={carriedFrom}
        onSave={fileDoc} />

      <Modal open={!!sel} onClose={() => setSel(null)}
        title={sel ? `${sel.no} — ${sel.clientName}` : ''} wide>
        {sel && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Pill s={sel.status} />
              <span className="badge-gray">Owner: {sel.owner}</span>
              <span className="badge-gray">Issued {fmtDate(sel.date)}</span>
              <span className="badge-gray">
                {isInvoiceKind ? 'Due on' : 'Valid till'} {fmtDate(sel.until)}
              </span>
              {sel.balance !== null && sel.balance > 0 && (
                <span className="badge-red">{inr(sel.balance)} still to come in</span>
              )}
              <button className="btn-outline !py-1 !text-xs ml-auto"
                onClick={() => { setPrinting(sel); setSel(null) }}>
                <Printer size={13} /> Print / Save PDF
              </button>
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{sel.subject}</p>

            {versionsOf(sel).length > 1 && (
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <p className="text-[11px] uppercase tracking-wide mb-2 flex items-center gap-1.5"
                  style={{ color: 'var(--text-4)' }}><History size={11} /> Versions of this document</p>
                <div className="space-y-1">
                  {versionsOf(sel).map(v => (
                    <div key={v.no} className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-mono" style={{ color: v.no === sel.no ? 'var(--text-1)' : 'var(--text-3)' }}>
                        {v.no}{v.no === sel.no && ' — this one'}
                      </span>
                      <span className="tabular-nums" style={{ color: 'var(--text-3)' }}>
                        {fmtDate(v.date)} · {inr(v.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sel.lines.length === 0 ? (
              <Empty msg="This one was raised before material lines existed — edit it to add them" />
            ) : (
              <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-2)' }}>
                <table className="tbl">
                  <thead><tr><th>Item</th><th>HSN</th><th className="num">Qty</th>
                    <th className="num">Rate</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {sel.lines.map((l, i) => (
                      <tr key={`${l.code}-${i}`}>
                        <td>{withColour(l.name, l.colour)} <span className="text-xs font-mono" style={{ color: 'var(--text-4)' }}>({l.code})</span></td>
                        <td className="text-xs">{l.hsn}</td>
                        <td className="num tabular-nums">{l.qty.toLocaleString('en-IN')} {l.unit}</td>
                        <td className="num tabular-nums">{inr2(l.rate)}</td>
                        <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{inr2(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <table className="text-sm">
                <tbody>
                  <tr><td className="pr-8 py-1" style={{ color: 'var(--text-3)' }}>Taxable</td>
                    <td className="text-right tabular-nums">{inr2(sel.taxable)}</td></tr>
                  {/* ── The slab view ────────────────────────────────────
                      Theirs, on 21-11, at 21:43: "in estimate, GST view.
                      Tax slab view." A document that mixes eighteen and
                      nine shows one GST figure and says nothing about how
                      it got there. Each slab is on its own line here, on
                      the screen — it does not go on the paper, because
                      that is the part they do not want printed. */}
                  {slabsOf(sel).map(x => (
                    <tr key={x.gst}>
                      <td className="pr-8 py-0.5 text-xs" style={{ color: 'var(--text-4)' }}>
                        at {x.gst}% — on {inr2(x.taxable)}
                      </td>
                      <td className="text-right tabular-nums text-xs"
                        style={{ color: 'var(--text-4)' }}>{inr2(x.tax)}</td>
                    </tr>
                  ))}
                  <tr><td className="pr-8 py-1" style={{ color: 'var(--text-3)' }}>GST</td>
                    <td className="text-right tabular-nums">{inr2(sel.tax)}</td></tr>
                  <tr className="font-bold" style={{ color: 'var(--text-1)' }}>
                    <td className="pr-8 py-1 border-t" style={{ borderColor: 'var(--border-2)' }}>Grand Total</td>
                    <td className="text-right tabular-nums border-t" style={{ borderColor: 'var(--border-2)' }}>{inr(sel.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-[11px] pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
              Rates quoted ex-godown, {COMPANY.address.line3}. Aluminium rates are linked to LME and may be
              revised without notice after validity.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
