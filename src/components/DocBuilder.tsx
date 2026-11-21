import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Info, X, AlertTriangle, FileText, Save, ImagePlus } from 'lucide-react'
import { Modal, Select } from '@/components/ui'
import { SectionPicker } from '@/components/SectionPicker'
import { PICK_PRODUCTS, productById } from '@/data/productmaster'
import { useExtraProducts, addExtraProduct } from '@/lib/extraproducts'
import { CLIENTS, SUPPLIERS } from '@/data/parties'
import { PARTY_CODES } from '@/data/partycodes'
import { inr2, fmtDate } from '@/lib/utils'
import { today, validTill, DEFAULT_VALID_DAYS, revisionNumber } from '@/lib/docnos'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { recallRate, recallSlab, rememberAll } from '@/lib/ratememory'
import { DEFAULT_TERMS, termsFromText, termsToText } from '@/data/terms'
import { useProductImages, setProductImage, removeProductImage } from '@/lib/productimages'
import { hsnFor } from '@/data/hsn'
import { ColourPicker } from '@/components/ColourPicker'
import { UNCOATED, firstCoated } from '@/data/colours'

/* ── Raising a quotation or a proforma ─────────────────────────────────────
   The shop opened the old form and asked the question that mattered: "where
   is the material that you can enter?" There was nowhere. The form asked for
   a taxable value and a total and took both on trust, which is why a figure
   could be quoted that no line of material added up to.

   So the money is no longer typed. Products are picked off the master, and
   the taxable value, the tax and the total are what those lines come to.

   The number is issued by the system and the date is today — "I should not
   be in a position to manually select". Validity defaults and can be moved.

   Sections are priced the way the trade prices them, by weight: pieces times
   the weight per piece gives kilos, kilos times the rate gives the amount.
   Hardware has no weight per piece in your books, so it is priced per piece.
   The rate itself is always typed, because selling prices have not been
   given to us yet.                                                        */

export interface BuiltLine {
  key: string
  productId: string
  code: string
  name: string
  hsn: string
  /** true where the rate came out of what this product last went out at */
  recalled?: boolean
  /* ── A rate of its own ──────────────────────────────────────────────────
     Theirs, on 20-11: "per kg rate might be different, 2 or 3 slabs might be
     there... in your case it clubs all, like 85 mm series it's different. I
     need option to select sections and charge differently."

     One rate across the whole document is right most days and wrong on the
     day a job mixes series. Left empty a line is priced at the rate on the
     block above it; filled in, it is priced at its own, and the document goes
     out with one aluminium line per rate rather than one for everything. */
  metalRate?: number
  /* ── Weighed with the line above ────────────────────────────────────────
     Theirs, on 20-11: "if 2 or more items have combined weight, weight tab
     should be merged — option to be given to merge."

     It is how they weigh: two or three things go on the scale together and
     one figure is written against the first of them. Read line by line that
     makes the first heavy and the rest weightless, so a merged line keeps no
     weight of its own and the figure above covers them both. */
  mergedUp?: boolean
  /** 'kg' where the product has a weight per piece, otherwise 'nos' */
  basis: 'kg' | 'nos'
  nos: number
  kg: number
  rate: number
  gst: number
  /* ── A line of its own words ────────────────────────────────────────────
     Theirs, on 21-11: "add a Description / Narration box for each item, like
     in Tally. Use it for items that aren't in stock — a special finish or
     thickness, for example."

     It belongs to the document and not to the product, because it describes
     this supply: the same section in a different finish is the same section. */
  narration?: string
  /** the finish this line is supplied in — see src/data/colours.ts */
  colour?: string
}

/* ── How a fabricator quotes ───────────────────────────────────────────────
   Asked for on 20-11-2026:

     "What we require is at the top WEIGHT ALUMINIUM EXTRUDED PROFILES is
      entered and cumulative weight is entered there only, and at the
      individual sections only coating charge is mentioned, so it has to
      calculate both... cumulative weight to be displayed as a separate
      inventory at the top. Coating charge is displayed section wise or only
      for quotation it can be cumulative."

   Which is how the trade prices it. The metal is one commodity sold by total
   weight at one rate, whatever it has been cut into; the coating is a job
   done to particular sections. Pricing each section at a rate that silently
   mixes the two makes a quotation nobody can argue with line by line.

   So the document has an aluminium line at the top carrying every kilo on it,
   and the sections underneath carry only what it costs to coat them — either
   each on its own, or as one figure for the lot.                          */
export interface AluminiumBlock {
  /** false prices each section at one rate, the way it was before */
  on: boolean
  /** rupees a kilo for the metal itself */
  rate: number
  /** the slab on the metal — 18 on 7604, but it is asked rather than assumed */
  gst: number
}

export type CoatingMode = 'section' | 'cumulative'

/* ── How each document charges the coating ─────────────────────────────────
   Theirs, on 20-11:

     "In quotation, when we enter the section's name it has to individually
      show the entered quantity only, but it has to make cumulative and take
      total single lumpsum powder coating value to be shown as a single entry.
      Separate entries are shown in ESTIMATE only."

     "In tax invoice, powder cumulative only to be given, not section wise."

   So the estimate is the working document where each section's coating is
   priced on its own, and everything that goes to a customer carries one
   figure for the lot. A tax invoice has no choice about it.              */
export const DEFAULT_COATING: Record<string, CoatingMode> = {
  'Estimate':         'section',
  'Quotation':        'cumulative',
  'Proforma Invoice': 'cumulative',
  'Tax Invoice':      'cumulative',
  'Purchase Bill':    'section',
}

/** A tax invoice is cumulative and is not asked about it. */
export const COATING_FIXED = (kind: string) => kind === 'Tax Invoice'

/** The coating, where it is charged once for the whole lot. */
export interface CoatingBlock {
  mode: CoatingMode
  /** rupees a kilo, used only when the whole lot is charged together */
  rate: number
  /** whether that rate is a kilo or a piece */
  unit: 'kg' | 'nos'
}

export interface BuiltDoc {
  no: string
  date: string
  /** the day it lapses on a quotation, the day it falls due on an invoice */
  validTill: string
  clientName: string
  subject: string
  owner: string
  lines: BuiltLine[]
  taxable: number
  tax: number
  total: number
  /** true where the customer is outside Karnataka, so the tax is IGST */
  interState: boolean
  /** the metal, priced once at the top by total weight */
  aluminium: AluminiumBlock
  /** whether the coating is charged on each section or once for the lot */
  coatingMode: CoatingMode
  /** the one rate, where the lot is charged together */
  coatingRate: number
  /* ── What the coating is charged on ───────────────────────────────────
     Theirs, on 21-11: "powder coating needs a unit (per kg or unit price).
     It is missing now." A coater is usually paid by the kilo, but a small
     run is often quoted at so much a piece, and the document has to say
     which of the two it is rather than leave a bare figure. */
  coatingUnit: 'kg' | 'nos'
  /** Draft where it was put aside, Sent where it went out. */
  status?: 'Draft' | 'Sent'
  /** what goes at the foot of it, changeable on every document */
  terms: string[]
  /* ── What a tax invoice has to carry ────────────────────────────────────
     Theirs, on 20-11, listing what was missing: vehicle number, e-way bill
     number, remarks, delivery address, PO number, PI number, payment terms.
     None of them are optional on a bill that travels with goods — an e-way
     bill without a vehicle on it is stopped at the checkpost. */
  vehicle: string
  ewayBill: string
  remarks: string
  shipTo: string
  poNo: string
  piNo: string
  paymentTerms: string
}

/**
 * The weight of the aluminium on a document — what the metal is priced on.
 *
 * Only extruded sections. Hardware and rubber travel on the same documents and
 * are counted, never weighed, so folding them in would price handles by the
 * kilo and overstate the metal.
 */
export const isAluminium = (l: BuiltLine) =>
  !!l.productId && l.basis === 'kg' && productById(l.productId)?.kind === 'section'

/** A merged line's weight is already inside the figure on the line above. */
export const weighsOwn = (l: BuiltLine) => isAluminium(l) && !l.mergedUp

export const totalKgOf = (lines: BuiltLine[]) =>
  +lines.filter(weighsOwn).reduce((s, l) => s + l.kg, 0).toFixed(3)

/** Every coated piece on a document, for a coating quoted by the piece. */
export const totalNosOf = (lines: BuiltLine[]) =>
  lines.filter(isAluminium).reduce((s, l) => s + l.nos, 0)

/** The slab most of a document's lines are at. */
function commonSlab(lines: BuiltLine[]): number {
  const count = new Map<number, number>()
  for (const l of lines) count.set(l.gst, (count.get(l.gst) ?? 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 18
}

export type DocKind = 'Quotation' | 'Estimate' | 'Proforma Invoice' | 'Tax Invoice' | 'Purchase Bill'

export const amountOf = (l: BuiltLine) =>
  +((l.basis === 'kg' ? l.kg : l.nos) * l.rate).toFixed(2)

/**
 * What the document comes to.
 *
 * With the metal priced at the top, a section's own rate is the coating
 * charge and nothing else, and the metal is one line of its own. Without it,
 * every section carries its own all-in rate, as before.
 */
export function totalsOf(
  lines: BuiltLine[],
  aluminium: AluminiumBlock = { on: false, rate: 0, gst: 18 },
  coatingMode: CoatingMode = 'section',
  coatingRate = 0,
  coatingUnit: 'kg' | 'nos' = 'kg',
) {
  const picked = lines.filter(l => l.productId)
  const kg = totalKgOf(picked)
  /** What the one coating charge is worked out on — kilos, or pieces. */
  const coatBase = coatingUnit === 'nos' ? totalNosOf(picked) : kg

  /* Only aluminium is weighed into the metal line. Hardware and rubber are
     counted, not weighed, and go out on their own lines at their own rates —
     theirs, seeing a rubber listed under the aluminium: "wrong, not a part of
     aluminium". */
  /* Rounded once at the end rather than on every line: rounding each one and
     then adding them put the form a paisa away from the printed document. */
  const metal = aluminium.on
    ? +picked.filter(weighsOwn)
        .reduce((s, l) => s + l.kg * (l.metalRate && l.metalRate > 0 ? l.metalRate : aluminium.rate), 0)
        .toFixed(2)
    : 0
  /* ── Three things on a sales document, not one ────────────────────────
     The metal, the coating done to it, and everything else the shop sells
     outright — handles, hinges, rubber. They were being treated as one, and
     in cumulative mode the "everything else" was being dropped from the
     total altogether: a rubber line at ninety-seven pieces and two hundred
     and fifty rupees simply left the bill. */
  const coatedLines = picked.filter(isAluminium)
  const otherLines = picked.filter(l => !isAluminium(l))

  const coating = aluminium.on
    ? (coatingMode === 'cumulative'
        /* One figure for the lot, at its own rate — which has to be asked for
           rather than taken off whichever section happens to be first, or
           changing the order of the lines would change the money. */
        ? +(coatBase * coatingRate).toFixed(2)
        : +coatedLines.reduce((s, l) => s + amountOf(l), 0).toFixed(2))
    : 0

  /** Sold outright at its own rate, whatever the metal is doing. */
  const goods = aluminium.on
    ? +otherLines.reduce((s, l) => s + amountOf(l), 0).toFixed(2)
    : +picked.reduce((s, l) => s + amountOf(l), 0).toFixed(2)

  const taxable = +(metal + coating + goods).toFixed(2)

  /* ── Tax, line by line ────────────────────────────────────────────────
     This took the slab off whichever line happened to be first and applied
     it to the whole document. Put a nought per cent line at the top and a
     thirty-six thousand rupee bill came out with no tax on it at all, which
     is what they were looking at when they said the CGST and SGST were not
     reflecting accordingly.

     Every line carries its own slab now. The metal carries its own as well,
     because it is its own supply at its own HSN. */
  const coatingTax = aluminium.on
    ? (coatingMode === 'cumulative'
        /* Charged once, it is one supply — at the commonest slab on the
           sections it covers, which is the one the shop is working in. */
        ? coating * (commonSlab(coatedLines) / 100)
        : coatedLines.reduce((s, l) => s + amountOf(l) * (l.gst / 100), 0))
    : 0

  /* Everything sold outright pays at its own slab — a hinge is not taxed at
     whatever the aluminium happens to be at. */
  const goodsTax = (aluminium.on ? otherLines : picked)
    .reduce((s, l) => s + amountOf(l) * (l.gst / 100), 0)

  const metalTax = aluminium.on ? metal * (aluminium.gst / 100) : 0
  const tax = +(metalTax + coatingTax + goodsTax).toFixed(2)

  return { metal, coating, goods, kg, coatBase, taxable, tax, total: +(taxable + tax).toFixed(2) }
}

/* 9 is here because they asked for it: a line carried at the half-slab,
   written as if it were the whole, is put back to 18 on the way into a tax
   invoice. 0 is here for anything quoted outside GST, which is dropped from
   a tax invoice altogether rather than billed at nought. */
const GST_RATES = ['18', '12', '9', '5', '0', '28']
const ADD_NEW = '+ Someone new'
/** Who raises the shop's documents. On the form, so it can be changed. */
const DEFAULT_OWNER = 'ROHITH'
const CHOOSE = '— choose —'
/* ── A new line opens in the colour of the one above it ───────────────────
   Theirs, on 21-11: "once a colour is selected for the first item, carry it
   forward to the next items. Allow it to be changed." A job is nearly always
   one finish throughout, so typing it on every line is work for nothing —
   and the one line somebody forgets to set is the one that goes out wrong. */
const blankLine = (colour = UNCOATED): BuiltLine => ({
  key: Math.random().toString(36).slice(2),
  productId: '', code: '', name: '', hsn: hsnFor('section'),
  basis: 'nos', nos: 0, kg: 0, rate: 0, gst: 18, colour,
})

export default function DocBuilder({ open, onClose, onSave, kind, docNo, initial, parties = [], owner = DEFAULT_OWNER }: {
  open: boolean
  onClose: () => void
  onSave: (doc: BuiltDoc) => void
  kind: DocKind
  /** the number this document will carry — issued by the caller, never typed,
      except on a purchase bill, where the number and date are the supplier's */
  docNo: string
  /** the document being revised or copied, where there is one */
  initial?: Partial<BuiltDoc> | null
  /** every party already dealt with, so a name is picked and not retyped */
  parties?: string[]
  /** who prepared it — on the document, so it can differ per document */
  owner?: string
}) {
  const [date, setDate] = useState(today())
  const [days, setDays] = useState(DEFAULT_VALID_DAYS)
  const [clientName, setClientName] = useState('')
  const [subject, setSubject] = useState('')
  const [interState, setInterState] = useState(false)
  const [newParty, setNewParty] = useState(false)
  /* The metal priced once at the top. On for an offer, where the shop quotes
     this way; off for a purchase bill, which copies a supplier's own lines. */
  const [aluOn, setAluOn] = useState(true)
  const [aluRate, setAluRate] = useState(0)
  const [aluGst, setAluGst] = useState(18)
  const [coatingMode, setCoatingMode] = useState<CoatingMode>('section')
  const [coatingRate, setCoatingRate] = useState(0)
  const [coatingUnit, setCoatingUnit] = useState<'kg' | 'nos'>('kg')
  const [preparedBy, setPreparedBy] = useState(owner)
  const [terms, setTerms] = useState('')
  const [showTerms, setShowTerms] = useState(false)
  const [vehicle, setVehicle] = useState('')
  const [ewayBill, setEwayBill] = useState('')
  const [remarks, setRemarks] = useState('')
  const [shipTo, setShipTo] = useState('')
  const [poNo, setPoNo] = useState('')
  const [piNo, setPiNo] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')

  /* Products the shop has added itself sit beside the master, so a door
     closer typed on one quotation is picked on the next. */
  const extras = useExtraProducts()
  /* A picture goes on a proforma and nowhere else — theirs, on 21-11. */
  const photos = useProductImages()
  const wantsPhotos = kind === 'Proforma Invoice'
  const options = useMemo(() => [
    ...PICK_PRODUCTS,
    ...extras.map(x => ({ id: x.id, code: x.code || '—', name: x.name, alt: x.alt })),
  ], [extras])

  const productOf = (id: string) =>
    productById(id) ?? (() => {
      const x = extras.find(e => e.id === id)
      return x ? { code: x.code, name: x.name, kgPerPiece: x.kgPerPiece, kind: 'section' as const } : undefined
    })()
  const [lines, setLines] = useState<BuiltLine[]>([blankLine()])
  /** what the last line on the form is in, which the next one opens in */
  const lastColour = lines.length ? lines[lines.length - 1].colour : undefined

  /* An invoice is the same document with the dates read differently: validity
     becomes credit, and the day it lapses becomes the day it falls due.

     A purchase bill is the one document whose number is not ours to issue. It
     is the supplier's, printed on the paper in front of whoever is entering
     it, so there it is typed — which is what they meant by "to give the bill
     number a date, that is fine". Everything else still comes off the lines. */
  const isInvoice = kind === 'Tax Invoice' || kind === 'Purchase Bill'
  const isPurchase = kind === 'Purchase Bill'
  /* Weight came off the quotation and the estimate — theirs, on 20-11. It is
     still worked out behind the column and shown under the count, because the
     rate on a section is per kilo and the amount has to come from somewhere.
     The despatch documents keep the column: a bill for aluminium sold by
     weight has to show the weight it was sold at. */
  /* ── What the form works out, and what it is told ─────────────────────
     Asked for by voice on 21-11-2026:

       "In the tax invoice, when we enter aluminium sections it automatically
        takes the weight, calculates it, and asks for the rate based on that
        calculated weight. We don't need all that in the tax invoice. Whatever
        we enter should be used as it is... Clips are entered as a quantity in
        numbers, and weight isn't needed for clips in the invoice... All these
        automatic calculations are only for the quotation."

     Which is right, and it is the difference between the two documents. A
     quotation is an estimate of what a job will weigh, so working the weight
     out of their own books is the whole use of it. A tax invoice is a record
     of what actually went out on a lorry and was actually weighed, and a
     figure the system worked out has no business overwriting that.

     So a quotation fills the weight in. Nothing else does: the field is there
     and empty, and a line with no weight against it is priced by the count,
     which is how clips are sold.                                          */
  /* An offer is an estimate of what a job will weigh, so the weight comes
     out of their own coating books; a bill is a record of what was actually
     weighed on the day, so it is typed. Which is why the estimate still
     works the weight out — theirs, on 21-11: "estimate: show the weight of
     each piece, with the powder coating charge as its own line." It is a
     working paper raised before anything has been near a weighbridge.

     On everything but the quotation the figure can be typed over, and a
     typed figure is what the line is priced on from then on. */
  const autoWeighs = kind !== 'Tax Invoice' && kind !== 'Purchase Bill'

  /* The quotation prices in one lump sum, so it carries no weight column.
     Everywhere else the weight is on the line, because somebody has to put
     it there — "a weight field where we enter the weight". */
  const showWeight = kind !== 'Quotation'
  const [theirNo, setTheirNo] = useState('')
  const [theirDate, setTheirDate] = useState(today())

  /* Opening the form resets it to today and to whatever is being revised. */
  useEffect(() => {
    if (!open) return
    setDate(today())
    setDays(DEFAULT_VALID_DAYS)
    setTheirNo(initial?.no ?? '')
    setTheirDate(initial?.date ?? today())
    setClientName(initial?.clientName ?? '')
    setSubject(initial?.subject ?? '')
    setInterState(initial?.interState ?? false)
    setNewParty(false)
    setAluOn(initial?.aluminium?.on ?? kind !== 'Purchase Bill')
    setAluRate(initial?.aluminium?.rate ?? 0)
    setAluGst(initial?.aluminium?.gst ?? 18)
    /* ── Section rates folded into one on the way to a bill ────────────
       A tax invoice carries one coating charge for the lot and is not asked
       about it. An estimate carried forward was priced section by section,
       so there was no single rate to carry and the bill opened with the
       coating at nought — every rupee of it quietly off the document.

       The rate the sections were actually coated at comes across instead,
       and whoever is raising the bill can type over it. */
    const forced = COATING_FIXED(kind)
    setCoatingMode(forced
      ? 'cumulative'
      : initial?.coatingMode ?? DEFAULT_COATING[kind] ?? 'section')
    /* Only a coated section's rate is a coating rate. A handle at 55 a
       piece is sold outright and has nothing to do with the coater. */
    const sectionCoating = (initial?.lines ?? [])
      .filter(l => l.basis === 'kg' && l.rate > 0)
      .map(l => l.rate)
    setCoatingRate(initial?.coatingRate
      || (forced && initial?.coatingMode === 'section' && sectionCoating.length
        ? Math.max(...sectionCoating)
        : 0))
    setCoatingUnit(initial?.coatingUnit ?? 'kg')
    setPreparedBy(initial?.owner || owner)
    setTerms(termsToText(initial?.terms?.length ? initial.terms : DEFAULT_TERMS[kind]))
    setShowTerms(false)
    setVehicle(initial?.vehicle ?? '')
    setEwayBill(initial?.ewayBill ?? '')
    setRemarks(initial?.remarks ?? '')
    setShipTo(initial?.shipTo ?? '')
    setPoNo(initial?.poNo ?? '')
    setPiNo(initial?.piNo ?? '')
    setPaymentTerms(initial?.paymentTerms ?? '')
    /* A purchase bill is what came off the lorry and opens uncoated; a
       sales document opens on a colour, because nothing goes out in the
       mill finish without somebody saying so. */
    const opens = kind === 'Purchase Bill' ? UNCOATED : firstCoated()
    setLines(initial?.lines?.length
      ? initial.lines.map(l => ({
          ...l, key: Math.random().toString(36).slice(2),
          colour: l.colour ?? opens,
        }))
      : [blankLine(opens)])
  }, [open, initial, kind, owner])

  /* Everyone already dealt with: the master, the party codes on their own
     sheets, and every name used on a document so far. */
  const known = useMemo(() => [...new Set([
    ...parties,
    ...(isPurchase
      ? [...SUPPLIERS.map(x => x.name), ...PARTY_CODES.map(x => `${x.code} — ${x.name}`)]
      : CLIENTS.map(c => c.name)),
  ].filter(Boolean))].sort(), [parties, isPurchase])

  const alu: AluminiumBlock = { on: aluOn && !isPurchase, rate: aluRate, gst: aluGst }
  /** True only where this line's charge is rolled into the one coating
      figure — which is to say, only where it is a coated section. */
  const inTheLot = (l: BuiltLine) =>
    alu.on && coatingMode === 'cumulative' && isAluminium(l)

  /** Every distinct metal rate in play, so the form can say when it is more
      than one and the document can carry a line for each. */
  const metalRates = useMemo(() => [...new Set(
    lines.filter(isAluminium).map(l => l.metalRate && l.metalRate > 0 ? l.metalRate : aluRate),
  )], [lines, aluRate])

  const t = useMemo(() => totalsOf(lines, alu, coatingMode, coatingRate, coatingUnit),
    [lines, aluOn, aluRate, aluGst, coatingMode, coatingRate, coatingUnit, isPurchase])
  const rev = revisionNumber(docNo)

  const patch = (key: string, p: Partial<BuiltLine>) =>
    setLines(ls => ls.map(l => l.key === key ? { ...l, ...p } : l))

  /* Picking a product brings its code and, where your books have weighed it,
     the weight per piece — so the kilos follow from the count. */
  const pick = (key: string, id: string) => setLines(ls => ls.map(l => {
    if (l.key !== key) return l
    const p = productOf(id)
    if (!p) return { ...l, productId: '', name: '', code: '' }
    /* Only a quotation guesses at a weight. Anywhere else the line starts
       priced by the count and waits to be told what it weighed. */
    const basis: 'kg' | 'nos' = autoWeighs && p.kgPerPiece !== null ? 'kg' : 'nos'
    /* What this product went out at last time, and failing that the slab this
       kind of material usually carries. A rate typed once is not typed again. */
    const seen = recallRate(id)
    /* ── One, until it is told otherwise ────────────────────────────────
       Theirs, on 21-11: "after selecting an item, fill in the quantity
       automatically." A line with nothing against it is not a line, and
       every one of them had to be typed over before the form would let
       anything out. One piece is the count that needs no explaining. */
    const nos = l.nos > 0 ? l.nos : 1
    return {
      ...l, productId: id, code: p.code, name: p.name, basis, nos,
      hsn: hsnFor(p.kind === 'section' || p.kind === 'rubber' ? p.kind : 'hardware'),
      kg: autoWeighs && p.kgPerPiece !== null ? +(p.kgPerPiece * nos).toFixed(3) : 0,
      rate: l.rate > 0 ? l.rate : (seen?.rate ?? 0),
      gst: seen?.gst ?? recallSlab(p.kind) ?? l.gst,
      recalled: !!seen?.rate && l.rate <= 0,
    }
  }))

  /* Anything typed that the list does not know is taken as it stands and
     joins the list — theirs: DOOR CLOSER, which never went to a coater and
     so was never in a master built out of coating sheets. */
  const create = (key: string, typed: string) => {
    const x = addExtraProduct(typed)
    /* Set from what was just created rather than by picking it out of the
       list: the list is state, and state has not caught up with the write
       yet, so picking by id here would look the product up and not find it. */
    const seen = recallRate(x.id)
    setLines(ls => ls.map(l => l.key === key ? {
      ...l,
      productId: x.id, code: x.code, name: x.name,
      nos: l.nos > 0 ? l.nos : 1,
      basis: autoWeighs && x.kgPerPiece !== null ? 'kg' : 'nos',
      kg: autoWeighs && x.kgPerPiece !== null
        ? +(x.kgPerPiece * (l.nos > 0 ? l.nos : 1)).toFixed(3) : 0,
      rate: l.rate > 0 ? l.rate : (seen?.rate ?? 0),
      gst: seen?.gst ?? l.gst,
      recalled: !!seen?.rate && l.rate <= 0,
    } : l))
  }

  const setNos = (key: string, nos: number) => setLines(ls => ls.map(l => {
    if (l.key !== key) return l
    const p = productOf(l.productId)
    /* A merged line's weight lives on the line above, so its count must not
       work out a weight of its own. */
    if (l.mergedUp) return { ...l, nos, kg: 0 }
    /* Changing the count on a bill does not move a weight somebody weighed. */
    if (!autoWeighs) return { ...l, nos }
    return { ...l, nos, kg: p?.kgPerPiece != null ? +(p.kgPerPiece * nos).toFixed(3) : l.kg }
  }))

  /** A weight typed on a bill is what that line is priced on, from then on. */
  const setKg = (key: string, kg: number) => setLines(ls => ls.map(l =>
    l.key === key ? { ...l, kg, basis: kg > 0 ? 'kg' : 'nos' } : l))

  /** Puts a line on the scale with the one above it, or takes it off again. */
  const toggleMerge = (key: string) => setLines(ls => ls.map(l => {
    if (l.key !== key) return l
    const on = !l.mergedUp
    const p = productOf(l.productId)
    return {
      ...l, mergedUp: on,
      kg: on ? 0 : (p?.kgPerPiece != null ? +(p.kgPerPiece * l.nos).toFixed(3) : l.kg),
    }
  }))

  /* Product, code, colour, qty, rate, GST, amount and the bin, plus the
     weight and the metal rate where the document carries them. The foot was
     spanning five whatever the table held, so on a tax invoice the totals
     came out one column to the left of the figures they were adding up. */
  const cols = 8 + (showWeight ? 1 : 0) + (alu.on ? 1 : 0)

  const theDate = isPurchase ? theirDate : date
  const theNo = isPurchase ? theirNo.trim() : docNo

  /* ── What makes a document raisable ───────────────────────────────────
     This asked for money on the line and would not let anything out until it
     saw some, which is why they could not raise a quotation at all: not one
     product in the master has a price yet, so every amount was nought and the
     button never lit. A quotation for material at a rate still to be settled
     is an ordinary thing to send. A party and material on it is the test. */
  const ready = clientName.trim() !== ''
    && (!isPurchase || theNo !== '')
    && lines.some(l => l.productId && (l.basis === 'kg' ? l.kg : l.nos) > 0)

  const unpriced = lines.filter(l => l.productId && l.rate <= 0).length

  /* ── Saving, and saving for later ─────────────────────────────────────
     Theirs, on 21-11: "add a Save as Draft option", and "place Save / Draft
     clearly at the side". A draft is filed like anything else and simply
     carries Draft as its status, so it is out of the figures at the top of
     the list until somebody sends it. */
  const save = (status: 'Draft' | 'Sent' = 'Sent') => {
    const keep = lines.filter(l => l.productId)
    /* Whatever went out is what the next one opens with. */
    rememberAll(keep.map(l => ({
      productId: l.productId,
      kind: productOf(l.productId)?.kind ?? '',
      rate: l.rate, gst: l.gst,
    })))
    onSave({
      no: theNo, date: theDate, validTill: validTill(theDate, days),
      clientName: clientName.trim(), subject: subject.trim(), owner: preparedBy.trim(),
      terms: termsFromText(terms),
      lines: keep, interState, aluminium: alu, coatingMode, coatingRate, coatingUnit,
      vehicle: vehicle.trim(), ewayBill: ewayBill.trim(), remarks: remarks.trim(),
      shipTo: shipTo.trim(), poNo: poNo.trim(), piNo: piNo.trim(),
      paymentTerms: paymentTerms.trim(),
      ...totalsOf(keep, alu, coatingMode, coatingRate, coatingUnit),
      status,
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose}
      title={rev ? `${kind} ${docNo} — revision ${rev}`
        : isPurchase ? 'New Purchase Bill' : `New ${kind} — ${docNo}`} wide>
      <div className="space-y-4">
        <div className="rounded-lg p-3 flex items-start gap-2 text-[11.5px]"
          style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)', color: 'var(--text-3)' }}>
          <Info size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} />
          <span>
            {isPurchase
              ? 'The bill number and date are the supplier\u2019s, so they are typed off the paper. '
              : 'The number and the date are issued here, not typed. '}
            The taxable value, the GST and the total are what the lines below come to — nothing is entered
            against them.
            {rev > 0 && ' This is a revision: it keeps the number it revises and carries today’s date.'}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div><label className="label">
              {isPurchase ? "Supplier's bill no" : `${kind} no`}
              {isPurchase && <span style={{ color: 'var(--red)' }}> *</span>}
            </label>
            {isPurchase ? (
              <input className="input w-full font-mono !text-xs" value={theirNo}
                placeholder="as on their bill" onChange={e => setTheirNo(e.target.value)} />
            ) : (
              <input className="input w-full font-mono !text-xs" value={docNo} readOnly
                title="Issued by the system" style={{ color: 'var(--text-3)' }} />
            )}</div>
          <div><label className="label">{isPurchase ? "Their bill date" : 'Date'}</label>
            {isPurchase ? (
              <input type="date" className="input w-full" value={theirDate}
                onChange={e => setTheirDate(e.target.value)} />
            ) : (
              <input className="input w-full" value={fmtDate(date)} readOnly
                title="Today. A revision carries the day it was revised."
                style={{ color: 'var(--text-3)' }} />
            )}</div>
          <div><label className="label">{isInvoice ? 'Credit' : 'Valid for'}</label>
            <Select value={`${days} days`} onChange={v => setDays(parseInt(v, 10))}
              options={isInvoice
                ? ['0 days', '7 days', '15 days', '21 days', '30 days', '45 days', '60 days']
                : ['1 day', '2 days', '3 days', '7 days', '15 days', '30 days']}
              className="!w-full" /></div>
          <div><label className="label">{isInvoice ? 'Due on' : 'Valid till'}</label>
            <input className="input w-full" value={fmtDate(validTill(theDate, days))} readOnly
              style={{ color: 'var(--text-3)' }} /></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <div><label className="label">
              {isPurchase ? 'Supplier' : 'Customer'}
              <span style={{ color: 'var(--red)' }}> *</span>
            </label>
            {/* Picked from who you have dealt with, not retyped every time —
                theirs, on 20-11: "customer name from data selection". Anyone
                new is typed once and is on the list from then on. */}
            {known.length > 0 && !newParty ? (
              /* The blank first entry matters: without it the box showed the
                 first name on the list while nothing was actually chosen, and
                 the form sat there asking for a customer it appeared to have. */
              <Select value={clientName || CHOOSE}
                onChange={v => {
                  if (v === ADD_NEW) { setNewParty(true); setClientName('') }
                  else setClientName(v === CHOOSE ? '' : v)
                }}
                options={[CHOOSE, ...known, ADD_NEW]} className="!w-full" />
            ) : (
              <div className="flex gap-1.5">
                <input className="input w-full" value={clientName} autoFocus
                  placeholder={isPurchase ? 'Who it is from' : 'Who it is for'}
                  style={clientName.trim() === '' ? { borderColor: 'var(--amber)' } : undefined}
                  onChange={e => setClientName(e.target.value)} />
                {known.length > 0 && (
                  <button className="btn-ghost !px-2 shrink-0" title="Back to the list"
                    onClick={() => { setNewParty(false); setClientName('') }}>
                    <X size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
          <div><label className="label">{isPurchase ? 'Category / reference' : isInvoice ? 'Site / reference' : 'Subject'}</label>
            <input className="input w-full" value={subject} placeholder="What it is for"
              onChange={e => setSubject(e.target.value)} /></div>
          <div><label className="label">Prepared by</label>
            <input className="input w-full" value={preparedBy}
              onChange={e => setPreparedBy(e.target.value)} /></div>
          <div><label className="label">Place of supply</label>
            <Select value={interState ? 'Outside Karnataka — IGST' : 'Karnataka — CGST + SGST'}
              onChange={v => setInterState(v.startsWith('Outside'))}
              options={['Karnataka — CGST + SGST', 'Outside Karnataka — IGST']} className="!w-full" /></div>
        </div>

        {/* ── The metal is a line, not a panel ────────────────────────────
            Theirs, on 20-11: "weight inventory should reflect as one of the
            line items, not separately at top". It was a block of its own
            above the table, which read as a setting rather than as part of
            what is being supplied. It is the first row of the table now, and
            the coating is the last one, both priced where everything else
            is priced. Only the two switches that decide the shape of the
            document stay outside it. */}
        {isInvoice && !isPurchase && (
          <div>
            <p className="label mb-1.5">Despatch &amp; payment</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div><label className="label">Vehicle no</label>
                <input className="input w-full" value={vehicle} placeholder="KA 01 AB 1234"
                  onChange={e => setVehicle(e.target.value)} /></div>
              <div><label className="label">E-way bill no</label>
                <input className="input w-full" value={ewayBill} placeholder="12 digits"
                  onChange={e => setEwayBill(e.target.value)} /></div>
              <div><label className="label">PO number</label>
                <input className="input w-full" value={poNo} placeholder="Buyer's order"
                  onChange={e => setPoNo(e.target.value)} /></div>
              <div><label className="label">PI number</label>
                <input className="input w-full" value={piNo} placeholder="Proforma this bills against"
                  onChange={e => setPiNo(e.target.value)} /></div>
              <div className="lg:col-span-2"><label className="label">Delivery address</label>
                <input className="input w-full" value={shipTo}
                  placeholder="Where it is actually going, if not the billing address"
                  onChange={e => setShipTo(e.target.value)} /></div>
              <div><label className="label">Payment terms</label>
                <input className="input w-full" value={paymentTerms} placeholder="30 days / Advance"
                  onChange={e => setPaymentTerms(e.target.value)} /></div>
              <div><label className="label">Remarks</label>
                <input className="input w-full" value={remarks} placeholder="Anything to search on later"
                  onChange={e => setRemarks(e.target.value)} /></div>
            </div>
          </div>
        )}

        {alu.on && (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">Coating charged</label>
              {COATING_FIXED(kind) ? (
                <p className="input !w-44 flex items-center" style={{ color: 'var(--text-3)' }}
                  title="A tax invoice carries one coating figure for the lot — theirs, on 20-11">
                  Once for the lot
                </p>
              ) : (
                <Select value={coatingMode === 'section' ? 'Section by section' : 'Once for the lot'}
                  onChange={v => setCoatingMode(v.startsWith('Section') ? 'section' : 'cumulative')}
                  options={['Section by section', 'Once for the lot']} className="min-w-[11rem]" />
              )}
            </div>
            {metalRates.length > 1 && (
              <p className="text-[11px] pb-2" style={{ color: 'var(--text-4)' }}>
                {metalRates.length} metal rates on this document — set per line
              </p>
            )}
          </div>
        )}

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <p className="label !mb-0">{alu.on ? 'Sections, and what it costs to coat them' : 'Material'}</p>
            {!isPurchase && (
              <label className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--text-4)' }}>
                <input type="checkbox" checked={aluOn} onChange={e => setAluOn(e.target.checked)} />
                Price the aluminium once at the top
              </label>
            )}
          </div>
          <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-2)' }}>
            <table className="tbl">
              <thead>
                <tr><th className="min-w-[13rem]">Product</th><th>Code</th>
                  {/* "Add colour to every item" — theirs, on 21-11. */}
                  <th>Colour</th>
                  <th className="num">Qty (nos)</th>
                  {showWeight && <th className="num">Weight (kg)</th>}
                  {alu.on && <th className="num">Metal ₹/kg</th>}
                  <th className="num">Rate</th>
                  <th className="num">GST %</th>
                  <th className="num">Amount</th><th /></tr>
              </thead>
              <tbody>
                {alu.on && (
                  <tr style={{ background: 'var(--bg-card2)' }}>
                    <td className="font-semibold uppercase tracking-wide text-[11px]"
                      style={{ color: 'var(--text-1)' }}>
                      Aluminium Extruded Profiles
                      <span className="block text-[10px] normal-case font-normal tracking-normal"
                        style={{ color: 'var(--text-4)' }}>every section below, added up — not typed</span>
                    </td>
                    <td className="font-mono text-xs" style={{ color: 'var(--text-4)' }}>—</td>
                    <td className="text-[11px]" style={{ color: 'var(--text-4)' }}>per line</td>
                    {/* The weight belongs under the weight column wherever
                        there is one. It was sitting under the piece count and
                        pushing every cell after it one column to the left, so
                        on a tax invoice the GST box appeared under Rate. */}
                    <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>
                      {showWeight ? '—' : `${t.kg} kg`}
                    </td>
                    {showWeight && (
                      <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>
                        {t.kg} kg
                      </td>
                    )}
                    <td className="num">
                      <input className="input !w-24 !py-1 text-right tabular-nums !text-xs"
                        value={aluRate || ''} placeholder="per kg"
                        onChange={e => setAluRate(Number(e.target.value) || 0)} />
                    </td>
                    <td className="num" />
                    <td className="num">
                      <Select value={String(aluGst)} onChange={v => setAluGst(Number(v))}
                        options={GST_RATES} className="!w-16 !py-1 !text-xs !min-w-0" />
                    </td>
                    <td className="num tabular-nums font-semibold" style={{ color: 'var(--brand)' }}>
                      {t.metal ? inr2(t.metal) : '—'}
                    </td>
                    {/* ── The first line, and a way to be rid of it ───────
                        Theirs, on 21-11: "a new quotation opens with one
                        default line, Aluminium Extrusion Profile, with an
                        option to delete that line." It opens with it; this
                        takes it off, and the box above puts it back. */}
                    <td>
                      <button className="btn-ghost !px-1.5 !py-1" style={{ color: 'var(--red)' }}
                        title="Take the aluminium line off and price each section on its own"
                        onClick={() => setAluOn(false)}>
                        <Trash2 size={13} /></button>
                    </td>
                  </tr>
                )}
                {/* ── The coating comes above the list, not under it ──────
                    Theirs, on 21-11: the powder coating is to come up the
                    page. It belongs beside the metal — between them they
                    are what is being charged for, and the sections below
                    are the specification of what that charge covers. */}
                {alu.on && coatingMode === 'cumulative' && (
                  <tr style={{ background: 'var(--bg-card2)' }}>
                    <td className="font-semibold uppercase tracking-wide text-[11px]"
                      style={{ color: 'var(--text-1)' }}>
                      Powder Coating
                      <span className="block text-[10px] normal-case font-normal tracking-normal"
                        style={{ color: 'var(--text-4)' }}>one charge for the lot</span>
                    </td>
                    <td className="font-mono text-xs" style={{ color: 'var(--text-4)' }}>
                      {/* ── Per kilo, or per piece ──────────────────────
                          Theirs, on 21-11: "powder coating needs a unit
                          (per kg or unit price). It is missing now." */}
                      <Select value={coatingUnit === 'kg' ? 'per kg' : 'per piece'}
                        onChange={v => setCoatingUnit(v === 'per kg' ? 'kg' : 'nos')}
                        options={['per kg', 'per piece']}
                        className="!w-[6.5rem] !py-1 !text-[11px] !min-w-0" />
                    </td>
                    <td className="text-[11px]" style={{ color: 'var(--text-4)' }}>per line</td>
                    <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>
                      {coatingUnit === 'nos' ? `${t.coatBase} nos` : showWeight ? '—' : `${t.kg} kg`}
                    </td>
                    {showWeight && (
                      <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>
                        {t.kg} kg
                      </td>
                    )}
                    <td className="num" />
                    <td className="num">
                      <input className="input !w-24 !py-1 text-right tabular-nums !text-xs"
                        value={coatingRate || ''}
                        placeholder={coatingUnit === 'kg' ? 'per kg' : 'per piece'}
                        onChange={e => setCoatingRate(Number(e.target.value) || 0)} />
                    </td>
                    <td className="num" />
                    <td className="num tabular-nums font-semibold" style={{ color: 'var(--brand)' }}>
                      {t.coating ? inr2(t.coating) : '—'}
                    </td>
                    <td>
                      <button className="btn-ghost !px-1.5 !py-1" style={{ color: 'var(--red)' }}
                        title="Charge the coating on each section instead"
                        onClick={() => setCoatingMode('section')}
                        disabled={COATING_FIXED(kind)}>
                        <Trash2 size={13} /></button>
                    </td>
                  </tr>
                )}
                {lines.map((l, i) => (
                  <tr key={l.key}>
                    <td>
                      <SectionPicker options={options} value={l.productId}
                        onChange={id => pick(l.key, id)}
                        onCreate={typed => create(l.key, typed)} />
                      {/* ── Its own words ────────────────────────────────
                          Theirs, on 21-11: "add a Description / Narration
                          box for each item, like in Tally. Use it for items
                          that aren't in stock — a special finish or
                          thickness, for example." It prints under the
                          description and belongs to this supply, not to the
                          product: the same section in another finish is
                          still the same section. */}
                      {l.productId && (
                        <input className="input w-full !py-0.5 !text-[11px] mt-1"
                          value={l.narration ?? ''}
                          placeholder="Narration — finish, thickness, anything not in stock"
                          onChange={e => patch(l.key, { narration: e.target.value })} />
                      )}
                      {wantsPhotos && l.productId && (
                        <div className="flex items-center gap-2 mt-1">
                          {photos[l.productId] && (
                            <img src={photos[l.productId]} alt=""
                              className="w-8 h-8 object-cover rounded"
                              style={{ border: '1px solid var(--border-2)' }} />
                          )}
                          <label className="text-[10px] cursor-pointer flex items-center gap-1"
                            style={{ color: 'var(--brand)' }}>
                            <ImagePlus size={11} />
                            {photos[l.productId] ? 'Change photo' : 'Add a photo'}
                            <input type="file" accept="image/*" className="hidden"
                              onChange={e => {
                                const f = e.target.files?.[0]
                                if (f) setProductImage(l.productId, f)
                                e.target.value = ''
                              }} />
                          </label>
                          {photos[l.productId] && (
                            <button type="button" className="text-[10px]"
                              style={{ color: 'var(--text-4)' }}
                              onClick={() => removeProductImage(l.productId)}>remove</button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="font-mono text-xs" style={{ color: 'var(--text-4)' }}>{l.code || '—'}</td>
                    <td>
                      {/* Set on the first line and carried to the next —
                          theirs, on 21-11. A purchase bill can be uncoated
                          because that is what comes off the lorry; a sales
                          document cannot go out in no finish at all. */}
                      <ColourPicker value={l.colour ?? UNCOATED} allowRaw={isPurchase}
                        onChange={c => patch(l.key, { colour: c })} />
                    </td>
                    <td className="num">
                      {/* Empty rather than nought: a box reading 0 has to be
                          cleared before anything can be typed into it, and
                          typing in front of it gives 0415. */}
                      <input className="input !w-20 !py-1 text-right tabular-nums !text-xs"
                        value={l.nos || ''} placeholder="0"
                        onChange={e => setNos(l.key, Number(e.target.value) || 0)} />
                      {!showWeight && l.basis === 'kg' && l.kg > 0 && (
                        <p className="text-[10px] text-right mt-0.5 tabular-nums"
                          style={{ color: 'var(--text-4)' }}>{l.kg} kg</p>
                      )}
                    </td>
                    {showWeight && (
                      <td className="num">
                        {/* On a bill the weight is typed, so the box is open
                            whatever the line is priced on — it was greyed out
                            wherever the master had no weight per piece, which
                            is every line on a tax invoice now that a bill
                            works nothing out for itself. Left empty, the line
                            is priced by the count, which is how clips go. */}
                        <input className="input !w-24 !py-1 text-right tabular-nums !text-xs"
                          value={l.mergedUp ? '' : (l.kg || '')}
                          placeholder={l.mergedUp ? 'with above' : autoWeighs ? '0' : 'by nos'}
                          disabled={!!l.mergedUp || (autoWeighs && l.basis === 'nos')}
                          title={l.mergedUp
                            ? 'Weighed together with the line above — that figure covers this one too'
                            : autoWeighs && l.basis === 'nos'
                            ? 'No weight per piece in your books — priced per piece'
                            : autoWeighs
                            ? 'Worked out from your coating books. Type over it and that is what it goes out at.'
                            : 'Leave it empty and this line is priced by the count'}
                          onChange={e => setKg(l.key, Number(e.target.value) || 0)} />
                        {i > 0 && isAluminium(l) && (
                          <label className="text-[10px] flex items-center gap-1 justify-end mt-0.5"
                            style={{ color: l.mergedUp ? 'var(--brand)' : 'var(--text-4)' }}
                            title="Two or three things on the scale together, one figure written against the first">
                            <input type="checkbox" checked={!!l.mergedUp}
                              onChange={() => toggleMerge(l.key)} />
                            weighed above
                          </label>
                        )}
                      </td>
                    )}
                    {alu.on && (
                      <td className="num">
                        {isAluminium(l) ? (
                          <input className="input !w-20 !py-1 text-right tabular-nums !text-xs"
                            value={l.metalRate || ''} placeholder={String(aluRate || 0)}
                            title="Leave it empty to use the rate at the top. Fill it in for a series that is priced differently."
                            onChange={e => patch(l.key, {
                              metalRate: e.target.value === '' ? undefined : Number(e.target.value),
                            })} />
                        ) : (
                          <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>not metal</span>
                        )}
                      </td>
                    )}
                    <td className="num">
                      {/* Only a coated section's charge is rolled into the
                          lot. Hardware and rubber are sold outright and keep
                          a rate of their own — theirs: "every sales bill is
                          taking all products as aluminium, we have hardware
                          also, so logic is applied as coating charge, remove
                          that". Greying their rate box was also why picking
                          a hinge looked as though the search had failed. */}
                      <input className="input !w-24 !py-1 text-right tabular-nums !text-xs"
                        value={inTheLot(l) ? '' : (l.rate || '')}
                        disabled={inTheLot(l)}
                        placeholder={inTheLot(l) ? 'charged once'
                          : alu.on && isAluminium(l) ? 'coating / kg'
                          : l.basis === 'kg' ? 'per kg' : 'per piece'}
                        style={l.recalled ? { borderColor: 'var(--green)' } : undefined}
                        title={l.recalled
                          ? 'What this product last went out at. Type over it to change it.'
                          : l.basis === 'kg' ? 'Rate per kilogram' : 'Rate per piece'}
                        onChange={e => patch(l.key, { rate: Number(e.target.value) || 0, recalled: false })} />
                      {l.recalled && (
                        <p className="text-[10px] text-right mt-0.5" style={{ color: 'var(--green)' }}>last rate</p>
                      )}
                    </td>
                    <td className="num">
                      <Select value={String(l.gst)} onChange={v => patch(l.key, { gst: Number(v) })}
                        options={GST_RATES} className="!w-16 !py-1 !text-xs !min-w-0" /></td>
                    <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>
                      {inTheLot(l)
                        ? <span style={{ color: 'var(--text-4)' }}>in the lot</span>
                        : amountOf(l) ? inr2(amountOf(l)) : '—'}</td>
                    <td>
                      <button className="btn-ghost !px-1.5 !py-1" style={{ color: 'var(--red)' }}
                        onClick={() => setLines(ls => ls.length > 1 ? ls.filter(x => x.key !== l.key) : ls)}>
                        <Trash2 size={13} /></button></td>
                  </tr>
                ))}
              </tbody>

              {/* ── The money in the same list ───────────────────────────
                  Theirs, on 20-11: "tax if on selected or partial should
                  reflect as one of the inventory, not at last highlighted."
                  It was a little table of its own floating off to the right,
                  which is why a slab changed on a line looked as though it
                  had done nothing. It is the foot of the same table now, in
                  the same columns, under the lines it is adding up. */}
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border-2)' }}>
                  <td colSpan={cols - 2} className="text-right text-xs" style={{ color: 'var(--text-3)' }}>
                    Taxable
                  </td>
                  <td />
                  <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>
                    {inr2(t.taxable)}
                  </td>
                  <td />
                </tr>
                {interState ? (
                  <tr>
                    <td colSpan={cols - 2} className="text-right text-xs" style={{ color: 'var(--text-3)' }}>IGST</td>
                    <td />
                    <td className="num tabular-nums">{inr2(t.tax)}</td>
                    <td />
                  </tr>
                ) : (
                  <>
                    <tr>
                      <td colSpan={cols - 2} className="text-right text-xs" style={{ color: 'var(--text-3)' }}>CGST</td>
                      <td />
                      <td className="num tabular-nums">{inr2(+(t.tax / 2).toFixed(2))}</td>
                      <td />
                    </tr>
                    <tr>
                      <td colSpan={cols - 2} className="text-right text-xs" style={{ color: 'var(--text-3)' }}>SGST</td>
                      <td />
                      <td className="num tabular-nums">{inr2(+(t.tax / 2).toFixed(2))}</td>
                      <td />
                    </tr>
                  </>
                )}
                <tr style={{ borderTop: '1px solid var(--border-2)' }}>
                  <td colSpan={cols - 2} className="text-right text-sm font-bold" style={{ color: 'var(--text-1)' }}>
                    Total
                  </td>
                  <td />
                  <td className="num tabular-nums text-sm font-bold" style={{ color: 'var(--text-1)' }}>
                    {inr2(t.total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-2.5">
            <button className="btn-outline"
              onClick={() => setLines(ls => [...ls,
                blankLine(lastColour ?? (isPurchase ? UNCOATED : firstCoated()))])}>
              <Plus size={14} /> Add a line
            </button>
            {t.goods > 0 && alu.on && (
              <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>
                {inr2(t.goods)} of that is hardware and rubber, sold outright at its own rate — not coated,
                not weighed into the metal.
              </p>
            )}
          </div>

          <p className="text-[11px] mt-2" style={{ color: 'var(--text-4)' }}>
            {isPurchase
              ? 'Rates are typed off the supplier\u2019s bill. Once the product list reaches us with a cost '
                + 'price against each code, a rate far from it will be flagged here rather than found later.'
              : 'Rates are typed because selling prices have not been given to us yet. Send the product list '
                + 'with cost and selling price against each code and the rate will fill itself in.'}
          </p>
        </div>

        {!isPurchase && (
          <div>
            <button type="button" className="btn-ghost !px-0 !text-xs"
              onClick={() => setShowTerms(v => !v)}>
              <FileText size={13} /> Terms &amp; conditions
              <span style={{ color: 'var(--text-4)' }}>
                ({termsFromText(terms).length} {termsFromText(terms).length === 1 ? 'line' : 'lines'})
              </span>
            </button>
            {showTerms && (
              <div className="mt-2">
                <textarea className="input w-full !text-xs" rows={5} value={terms}
                  onChange={e => setTerms(e.target.value)} />
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <button type="button" className="btn-ghost !py-0.5 !text-[11px]"
                    onClick={() => setTerms(termsToText(DEFAULT_TERMS[kind]))}>
                    Back to the standard ones
                  </button>
                  <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>
                    One per line. They print at the foot of this document only — the standard set is
                    untouched.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-3"
          style={{ borderTop: '1px solid var(--border-2)' }}>
          {!ready && (
            /* They filled a line in, pressed the button and nothing happened,
               twice. The reason was on the screen both times, in grey, at the
               far end of a wide form. It is in amber beside the button now. */
            <span className="text-[12px] mr-auto flex items-center gap-1.5 font-medium"
              style={{ color: 'var(--amber)' }}>
              <AlertTriangle size={13} />
              {clientName.trim() === ''
                ? `${isPurchase ? 'Supplier' : 'Customer'} is needed before this can go out.`
                : isPurchase && theNo === ''
                ? 'The supplier\u2019s bill number is needed.'
                : 'Pick a product and put a quantity against it.'}
            </span>
          )}
          {ready && unpriced > 0 && (
            <span className="text-[11px] mr-auto" style={{ color: 'var(--text-4)' }}>
              {unpriced} {unpriced === 1 ? 'line has' : 'lines have'} no rate yet — it will go out showing
              nil against {unpriced === 1 ? 'it' : 'them'}.
            </span>
          )}
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          {/* ── Save, and save for later ─────────────────────────────────
              Theirs, on 21-11: "add a Save as Draft option", and "place
              Save / Draft clearly at the side". A draft is filed like
              anything else and carries Draft as its status, so it stays out
              of the figures at the top of the list until it goes out. */}
          {!isPurchase && kind !== 'Tax Invoice' && (
            <button className="btn-outline" disabled={!ready} onClick={() => save('Draft')}
              title="File it as a draft — it stays off the figures until it is sent"
              style={ready ? undefined : { opacity: .45, cursor: 'not-allowed' }}>
              <Save size={14} /> Save as draft
            </button>
          )}
          <button className="btn" disabled={!ready} onClick={() => save('Sent')}
            style={ready ? undefined : { opacity: .45, cursor: 'not-allowed' }}>
            {rev ? `Save revision ${rev}` : `Raise ${kind.toLowerCase()}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
