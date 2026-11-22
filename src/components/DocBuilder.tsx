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
import { weightOpinions, toleranceBand, TOLERANCE_PCT } from '@/lib/weightcheck'
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

/* 'off' is theirs, on 22-11: a bill opens without a coating line at all,
   and it comes back the moment somebody asks for one. */
export type CoatingMode = 'section' | 'cumulative' | 'off'

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
/* ── One entry, on every document ─────────────────────────────────────────
   Theirs, on 21-11 at 23:35, looking at an estimate that printed a powder
   coating line under each section: "we said we require summing up and
   single entry. Showing multiple entries."

   So the estimate is no different. The charge is typed on the section it
   belongs to — that part they were clear about — and what goes on the paper
   is one POWDER COATING entry for the lot, with the sections listed under
   it as the specification. Section-by-section is still here for anybody who
   wants it, but nothing opens on it.                                     */
export const DEFAULT_COATING: Record<string, CoatingMode> = {
  /* Theirs, on 22-11: "cumulative of powder coating is working but this is
     applicable to Quotation only", and "in ESTIMATE per length coating
     charge should be visible." The estimate is the working paper and shows
     what each length costs to coat; the quotation is the offer and shows
     one figure. */
  'Estimate':         'section',
  'Quotation':        'cumulative',
  'Proforma Invoice': 'cumulative',
  'Tax Invoice':      'cumulative',
  'Purchase Bill':    'section',
}

/* The coating line can be taken off any document — theirs, on 22-11:
   "powder coating delete option not working." A bill with no coating on it
   is an ordinary thing to raise. */
export const COATING_FIXED = (_kind: string) => false

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
  /* The one weight, where the document was told it rather than working it
     out of the sections — every document but the quotation. */
  metalKg?: number
  /* ── The metal, a line for each rate it is sold at ──────────────────────
     Theirs, on 22-11: "you have given rate tab for each section; when we
     enter a different rate, how will it account for, without having a
     separate ALUMINIUM EXTRUDED PROFILES?" It will not, and that was the
     hole: one typed weight was being priced at one rate however many rates
     the sections carried. Each rate is its own block now, with its own
     weight against it, and the document carries a line for each. */
  metalBlocks?: { rate: number; kg: number; gst: number }[]
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
/* ── What counts as metal ─────────────────────────────────────────────────
   This used to ask whether the line was priced by the kilo, which is a
   different question and the wrong one. On an estimate the sections are
   priced by the length — theirs, on 22-11: "in ESTIMATE per length coating
   charge should be visible" — and asking the first question put a sixteen
   foot section in with the handles, charged it as goods, and left it out of
   the metal and the coating both.

   A section is a section. Whether it carries a weight of its own is a
   separate matter, and that is what weighsOwn answers.                   */
export const isAluminium = (l: BuiltLine) =>
  !!l.productId && productById(l.productId)?.kind === 'section'

/** Carries a weight of its own — not merged up, and actually priced on one. */
export const weighsOwn = (l: BuiltLine) =>
  isAluminium(l) && !l.mergedUp && l.basis === 'kg'

export const totalKgOf = (lines: BuiltLine[]) =>
  +lines.filter(weighsOwn).reduce((s, l) => s + l.kg, 0).toFixed(3)

/** Every coated piece on a document, for a coating quoted by the piece. */
export const totalNosOf = (lines: BuiltLine[]) =>
  lines.filter(isAluminium).reduce((s, l) => s + l.nos, 0)

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
  coatingUnit: 'kg' | 'nos' = 'kg',
  /* ── One weight for the lot ─────────────────────────────────────────
     Theirs, on 22-11: "whatever format is given it is asking for
     individual section weight and it's summing up. We mix sections and
     weigh." So on every document but the quotation the weight is one
     figure typed against the metal line, and the sections underneath
     carry no weight at all. */
  typedKg?: number,
  /* The standing coating rate, used only where there are no sections to
     carry one — a bill raised on the metal alone, which is how they raise
     most of them: "we don't enter sections in tax invoice." */
  lotRate = 0,
  /* What the metal comes to across every rate on the document, where there
     is more than one of them. */
  typedMetal?: number,
) {
  const picked = lines.filter(l => l.productId)
  const kg = typedKg != null ? typedKg : totalKgOf(picked)
  /** What the one coating charge is worked out on — kilos, or pieces. */
  const coatBase = coatingUnit === 'nos' ? totalNosOf(picked) : kg

  /* Only aluminium is weighed into the metal line. Hardware and rubber are
     counted, not weighed, and go out on their own lines at their own rates —
     theirs, seeing a rubber listed under the aluminium: "wrong, not a part of
     aluminium". */
  /* Rounded once at the end rather than on every line: rounding each one and
     then adding them put the form a paisa away from the printed document. */
  const metal = aluminium.on
    ? (typedMetal != null
        ? typedMetal
        : typedKg != null
        ? +(kg * aluminium.rate).toFixed(2)
        : +picked.filter(weighsOwn)
            .reduce((s, l) => s + l.kg * (l.metalRate && l.metalRate > 0 ? l.metalRate : aluminium.rate), 0)
            .toFixed(2))
    : 0
  /* ── Three things on a sales document, not one ────────────────────────
     The metal, the coating done to it, and everything else the shop sells
     outright — handles, hinges, rubber. They were being treated as one, and
     in cumulative mode the "everything else" was being dropped from the
     total altogether: a rubber line at ninety-seven pieces and two hundred
     and fifty rupees simply left the bill. */
  const coatedLines = picked.filter(isAluminium)
  const otherLines = picked.filter(l => !isAluminium(l))

  /* ── The coating is typed on the line it belongs to ───────────────────
     Theirs, on 22-11: "we enter sections, weight should be calculated
     automatically, in the same line we need to enter coating charge...
     coating charge needs to get summed up and display as a single entry as
     Powder Coating, whereas only sections list will be shown."

     Which is right, and it is not what this was doing. One rate a kilo for
     the whole lot was being asked for at the top, and every section's own
     rate box was greyed out — so a job where the sixteen-foot runs cost
     more to coat than the clips could not be priced at all.

     Each section carries its own charge now, whatever the document does
     with it afterwards. The mode decides only how it is *shown*: section by
     section on the estimate, added into one POWDER COATING entry
     everywhere else. The money is the same either way, which is the point —
     changing how a document reads should not change what it comes to. */
  const coating = aluminium.on
    ? (coatedLines.length
        ? +coatedLines.reduce((s, l) => s + amountOf(l), 0).toFixed(2)
        : +(coatBase * lotRate).toFixed(2))
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
    ? (coatedLines.length
        ? coatedLines.reduce((s, l) => s + amountOf(l) * (l.gst / 100), 0)
        : coating * (aluminium.gst / 100))
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
/* ── A box you can actually type a number into ─────────────────────────────
   Theirs, on 21-11 at 23:34: "unable to enter weight in ESTIMATE", and a
   minute later, "rate also unable to enter."

   Both boxes read their value back out of the form on every keystroke and
   put a number there. Type "3" and you get 3; type the decimal point after
   it and Number("3.") is 3, so the point is swallowed before it reaches the
   screen and 3.999 cannot be typed at all. On the metal line it was worse:
   a rate on that row changes how the sections are grouped, the row was
   keyed by its own rate, and React threw the box away and built a new one —
   so the cursor left the field after the first digit.

   This keeps what was typed, character by character, while the field has
   the cursor, and only reads the number back when it is left alone. */
function NumBox({ value, onChange, ...rest }: {
  value: number
  onChange: (n: number) => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const shown = (n: number) => (n ? String(n) : '')
  const [text, setText] = useState(shown(value))
  const [typing, setTyping] = useState(false)
  useEffect(() => { if (!typing) setText(shown(value)) }, [value, typing])
  return (
    <input {...rest} inputMode="decimal" value={text}
      onFocus={e => { setTyping(true); e.currentTarget.select() }}
      onBlur={() => { setTyping(false); setText(shown(value)) }}
      onChange={e => {
        const raw = e.target.value
        /* Digits and one point. Anything else is simply not typed. */
        if (!/^\d*\.?\d*$/.test(raw)) return
        setText(raw)
        onChange(raw === '' || raw === '.' ? 0 : Number(raw))
      }} />
  )
}

const blankLine = (colour = UNCOATED): BuiltLine => ({
  key: Math.random().toString(36).slice(2),
  productId: '', code: '', name: '', hsn: hsnFor('section'),
  basis: 'nos', nos: 0, kg: 0, rate: 0, gst: 18, colour,
})

export default function DocBuilder({ open, onClose, onSave, kind, docNo, initial, parties = [], owner = DEFAULT_OWNER, carriedFrom = null }: {
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
  /* ── Where this one came from ───────────────────────────────────────────
     Theirs, on 22-11: "when converted from ESTIMATE to TAX INVOICE total tax
     value should be displayed in a separate tab, and balance after
     consumption or allocation should be *displayed only*, not on print.
     Therefore it should match tax value collected on estimate to tax
     invoice."

     An estimate is often billed in parts, and what matters is that the tax
     on the bills adds back to the tax on the estimate. So the estimate's
     own figures travel with the form and sit beside the bill's — on the
     screen, never on the paper, because they are the shop's working and
     not the customer's business. */
  carriedFrom?: { no: string; taxable: number; tax: number } | null
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
  /* ── A weight for each rate ───────────────────────────────────────────
     Keyed by the rate a kilo, because that is what tells one block of metal
     from another: the eighty-five millimetre series at three-ten and the
     rest at two-fifty are two lines, two weights and two amounts. */
  const [aluKgBy, setAluKgBy] = useState<Record<string, number>>({})
  const setAluKg = (v: number) => setAluKgBy({ [String(aluRate)]: v })
  const aluKg = useMemo(
    () => +Object.values(aluKgBy).reduce((s, v) => s + v, 0).toFixed(3),
    [aluKgBy])
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
  /* ── Who works the weight out ─────────────────────────────────────────
     Theirs, on 22-11. On the quotation: "we enter sections, weight should
     be calculated automatically." On the estimate: "we enter sections, but
     we enter total weight manually."

     So it is the quotation and nothing else. An estimate is written against
     material that has been looked at, and the weight on it is the weight
     somebody read; a quotation is an offer made before any of it exists, so
     the only weight available is the one in their own coating books.     */
  /* ── Only a quotation works a weight out ──────────────────────────────
     Theirs, on 22-11. On the quotation: "can display individual items
     weights (it's assumed not exact, prefed). I will enter manually if
     weighed separately." On the estimate: "don't display individual items
     weights", and "we mix sections and weigh". On the tax invoice: "remove
     individual weight tab, only one weight tab is sufficient for total."

     So the quotation carries a weight on every line, filled in from their
     coating books and typeable over. Everywhere else there is one weight,
     typed against the metal, and the sections carry none. */
  const autoWeighs = kind === 'Quotation'

  /* ── Sold by weight, even before anybody has weighed it ───────────────
     There are two different questions here and they were being answered
     with one flag. Is this line priced by the kilo? And do we fill the
     kilos in for them?

     An estimate answers yes and no: the sections on it are aluminium and
     belong under the metal line, but the weight on them is one somebody
     reads off a scale — "we enter total weight manually". Answering both
     with "no" put a sixteen-foot section in with the handles and the
     rubber, charged its coating by the piece, and left it out of the
     metal altogether.

     A bill answers no to both, which is what they asked for: clips go in
     as a count at a unit rate, and typing a weight is what turns a line
     into one sold by the kilo.                                         */
  const weighsByDefault = kind === 'Quotation'

  /* The quotation prices in one lump sum, so it carries no weight column.
     Everywhere else the weight is on the line, because somebody has to put
     it there — "a weight field where we enter the weight". */
  /* The weight column on each line belongs to the quotation alone. */
  const showWeight = kind === 'Quotation'
  /* ── One weight column, whoever fills it ──────────────────────────────
     Theirs, on 22-11: "remove individual weight tab, only one weight tab is
     sufficient for total i.e ALUMINIUM EXTRUDED PROFILES."

     So the column stays wherever the metal is priced at the top — it is
     where that one figure goes — and on a quotation each line has a box in
     it as well. Dropping the column outright left the metal line a cell
     longer than the header and pushed its rate under Coating rate, which
     is where 265 a kilo for the metal ended up. */
  const [theirNo, setTheirNo] = useState('')
  const [theirDate, setTheirDate] = useState(today())

  /* Opening the form resets it to today and to whatever is being revised. */
  useEffect(() => {
    if (!open) return
    setDate(today())
    /* A day's validity on an offer — theirs, on 22-11. A bill's box is
       credit, not validity, and its list starts at nought, so "1 days"
       matched nothing there and the box fell back to whatever was first. */
    setDays(kind === 'Tax Invoice' || kind === 'Purchase Bill' ? 0 : DEFAULT_VALID_DAYS)
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
    /* ── A bill carries one coating figure ────────────────────────────
       Theirs, on 22-11: "when estimate is converted to tax invoice,
       individual length rates of powder coating should become cumulative
       and shown as a single entry." The estimate prices each length; the
       bill adds them into one. It can still be changed back or taken off
       — the line is no longer locked. */
    const forced = kind === 'Tax Invoice'
    /* ── A bill opens with the metal and nothing else ──────────────────
       Theirs, on 22-11: "default Powder Coating remove, only ALUMINIUM
       EXTRUDED PROFILES." Most bills are for metal that was coated weeks
       ago and billed then; the coating line is added when there is a
       coating to charge, by setting it to one entry above. */
    setCoatingMode(forced
      ? (initial ? 'cumulative' : 'off')
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
    /* Per length on an estimate, by the kilo where the lot is one charge —
       theirs, on 22-11: the coating unit "should be per length or per piece
       and prefed". */
    setCoatingUnit(initial?.coatingUnit
      ?? (kind === 'Estimate' ? 'nos' : 'kg'))
    /* A carried-forward document brings its weight across; a new one starts
       at nothing and is told. */
    /* The weight the document was told, where it was told one. A quotation
       works its own out of the sections and keeps none. */
    setAluKgBy(kind === 'Quotation'
      ? {}
      : initial?.metalBlocks?.length
        ? Object.fromEntries(initial.metalBlocks.map(b => [String(b.rate), b.kg]))
        : {
            [String(initial?.aluminium?.rate ?? 0)]:
              initial?.metalKg
                ?? +(initial?.lines ?? []).reduce((s, l) => s + (l.kg || 0), 0).toFixed(3),
          })
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
  /** Its charge is added into the one POWDER COATING entry on the paper —
      but it is still typed here, on the line it belongs to. */
  const inTheLot = (l: BuiltLine) =>
    alu.on && coatingMode === 'cumulative' && isAluminium(l)

  /* ── One Aluminium Extruded Profiles line per rate ────────────────────
     Theirs, on 22-11: "Aluminium Extruded Profiles rate might vary,
     provision should give automatically for a different rate and if a new
     one is added, give an option to add. Like for 85 mm series, when that
     section is selected, again Aluminium Extruded Profiles should come."

     So the form groups the sections by what the metal costs them, and shows
     a line for each group. Put a rate against one section that nothing else
     on the document carries and a second Aluminium Extruded Profiles line
     appears above, with that section's weight on it. Nobody adds the line;
     it follows from the rate.                                            */
  interface MetalGroup { rate: number; kg: number; nos: number; keys: string[]; own: boolean }
  const metalGroups = useMemo<MetalGroup[]>(() => {
    const g = new Map<number, MetalGroup>()
    for (const l of lines.filter(weighsOwn)) {
      const own = !!(l.metalRate && l.metalRate > 0)
      const r = own ? l.metalRate! : aluRate
      const at = g.get(r) ?? { rate: r, kg: 0, nos: 0, keys: [], own }
      at.kg = +(at.kg + l.kg).toFixed(3)
      at.nos += l.nos
      at.keys.push(l.key)
      at.own = at.own && own
      g.set(r, at)
    }
    /* Where the weight is typed rather than worked out, it belongs to the
       rate it was typed against — not to whatever the sections add up to. */
    if (!autoWeighs) {
      for (const [r, kg] of Object.entries(aluKgBy)) {
        const rate = Number(r)
        const at = g.get(rate) ?? { rate, kg: 0, nos: 0, keys: [], own: rate !== aluRate }
        at.kg = kg
        g.set(rate, at)
      }
      for (const at of g.values()) at.kg = aluKgBy[String(at.rate)] ?? 0
    }
    /* The default line is there before a single section is, because that is
       what they open a quotation expecting to see. */
    if (!g.has(aluRate)) g.set(aluRate, { rate: aluRate, kg: 0, nos: 0, keys: [], own: false })
    const all = [...g.values()].sort((a, b) => b.kg - a.kg || a.rate - b.rate)
    /* The standing rate keeps its line while it is the only one. Once every
       section has been priced somewhere else it is an empty row saying
       nothing, so it goes. */
    /* A block with a weight against it stays even when no section points
       at it yet — somebody has put the metal on the document. */
    const live = all.filter(x => x.keys.length > 0 || x.kg > 0)
    return live.length ? live : all
  }, [lines, aluRate, aluKgBy, autoWeighs])

  /* ── The standing rate reaches the lines already on the form ──────────
     Theirs, on 22-11: the coating charge "should be taken from pre-fed
     values". It was only pre-filling lines picked afterwards, so typing it
     on the Powder Coating row with three sections already entered appeared
     to do nothing at all.

     It fills in any coated section that has no charge against it yet, and
     never touches one that has: a rate somebody typed is a decision, and
     the standing figure does not get to overrule it. */
  const setStandingCoating = (rate: number) => {
    setCoatingRate(rate)
    setLines(ls => ls.map(l =>
      l.rate > 0 || !isAluminium(l) ? l : { ...l, rate, recalled: false }))
  }

  /** Changing a group's rate moves every section inside it. */
  const setGroupRate = (g: MetalGroup, rate: number) => {
    /* ── The weight follows the rate ────────────────────────────────────
       The weight typed against a block is held under the rate it was typed
       at, so changing that rate has to carry it across. It did not, and a
       weight typed before the rate — which is the order anybody works in —
       was left behind under the old key: 26 kg entered, then 250 a kilo,
       and the metal came out at nothing. */
    if (!autoWeighs) {
      setAluKgBy(prev => {
        const next = { ...prev }
        const kg = next[String(g.rate)] ?? 0
        delete next[String(g.rate)]
        next[String(rate)] = kg
        return next
      })
    }
    if (!g.own) { setAluRate(rate); return }
    setLines(ls => ls.map(l => g.keys.includes(l.key) ? { ...l, metalRate: rate } : l))
  }

  /* ── Typing over the total weight ─────────────────────────────────────
     Theirs, on 22-11: "we should have option to edit summed up weight
     also", and on the estimate, "we enter total weight manually".

     A weighbridge ticket is one figure for a lorry load, not a figure per
     section, so the total has to be typeable. What is typed is spread back
     over the sections it covers in the proportion they already stand in —
     equally where nothing has been worked out yet — so every line still
     carries a weight and the total is exactly the figure on the ticket. */
  const setGroupKg = (g: MetalGroup, total: number) => {
    if (!autoWeighs) {
      setAluKgBy(prev => ({ ...prev, [String(g.rate)]: total }))
      return
    }
    setLines(ls => {
    const inGroup = ls.filter(l => g.keys.includes(l.key))
    if (!inGroup.length) return ls
    /* Spread by the weights already there; failing that by the piece
       counts, because ten pieces of a section weigh twice what five do and
       an equal split put 1.333 kg against 5, 10 and 5 alike. */
    const had = inGroup.reduce((s, l) => s + l.kg, 0)
    const pieces = inGroup.reduce((s, l) => s + l.nos, 0)
    return ls.map(l => {
      if (!g.keys.includes(l.key)) return l
      const share = had > 0 ? l.kg / had
        : pieces > 0 ? l.nos / pieces
        : 1 / inGroup.length
      return { ...l, kg: +(total * share).toFixed(3), basis: 'kg' as const }
    })
    })
  }

  const typedMetal = useMemo(
    () => +metalGroups.reduce((s, g) => s + g.kg * g.rate, 0).toFixed(2),
    [metalGroups])
  const t = useMemo(
    () => totalsOf(lines, alu, coatingUnit,
      autoWeighs ? undefined : aluKg, coatingRate,
      autoWeighs ? undefined : typedMetal),
    [lines, aluOn, aluRate, aluGst, coatingMode, coatingRate, coatingUnit,
      aluKg, typedMetal, isPurchase])
  const rev = revisionNumber(docNo)

  const patch = (key: string, p: Partial<BuiltLine>) =>
    setLines(ls => ls.map(l => l.key === key ? { ...l, ...p } : l))

  /* ── Where the cursor goes next ───────────────────────────────────────
     Theirs, on 22-11: "once product is selected, cursor should move to qty
     tab." Which is the order the work is done in — nobody picks a section
     and then reaches for the mouse to say how many. The box is marked with
     the line's own key so the right one is found however the table is
     sorted or filtered. */
  const toQty = (key: string) => requestAnimationFrame(() => {
    const el = document.querySelector<HTMLInputElement>(`[data-qty="${key}"]`)
    el?.focus()
    el?.select()
  })

  /* Picking a product brings its code and, where your books have weighed it,
     the weight per piece — so the kilos follow from the count. */
  const pick = (key: string, id: string) => setLines(ls => ls.map(l => {
    if (l.key !== key) return l
    const p = productOf(id)
    if (!p) return { ...l, productId: '', name: '', code: '' }
    /* Only a quotation guesses at a weight. Anywhere else the line starts
       priced by the count and waits to be told what it weighed. */
    const basis: 'kg' | 'nos' = weighsByDefault && p.kgPerPiece !== null ? 'kg' : 'nos'
    /* What this product went out at last time, and failing that the slab this
       kind of material usually carries. A rate typed once is not typed again. */
    const seen = recallRate(id, clientName)
    /* ── What it starts at ──────────────────────────────────────────────
       Theirs, on 22-11: the coating charge "should be taken from pre-fed
       values", and on the estimate, "coating charges per length come by
       default". Three places are tried, nearest first: what the line
       already carries, what this product last went out at, and the figure
       in the Powder Coating row, which is the shop's standing rate. */
    const prefed = alu.on && p.kind === 'section' ? coatingRate : 0
    /* ── One, until it is told otherwise ────────────────────────────────
       Theirs, on 21-11: "after selecting an item, fill in the quantity
       automatically." A line with nothing against it is not a line, and
       every one of them had to be typed over before the form would let
       anything out. One piece is the count that needs no explaining. */
    const nos = l.nos > 0 ? l.nos : 1
    /* "Remove colours to hardware" — theirs, on 21-11 at 23:18. */
    const coatable = p.kind === 'section'
    return {
      ...l, productId: id, code: p.code, name: p.name, basis, nos,
      colour: coatable ? l.colour : undefined,
      hsn: hsnFor(p.kind === 'section' || p.kind === 'rubber' ? p.kind : 'hardware'),
      kg: autoWeighs && p.kgPerPiece !== null ? +(p.kgPerPiece * nos).toFixed(3) : 0,
      rate: l.rate > 0 ? l.rate : (seen?.rate || prefed || 0),
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
    const seen = recallRate(x.id, clientName)
    setLines(ls => ls.map(l => l.key === key ? {
      ...l,
      productId: x.id, code: x.code, name: x.name,
      nos: l.nos > 0 ? l.nos : 1,
      basis: weighsByDefault && x.kgPerPiece !== null ? 'kg' : 'nos',
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
  /* The label runs to the GST column, which is then skipped so the figure
     lands under Amount: cols - 3, a blank, the figure, and the bin's column.
     It was spanning five whatever the table held, so on a tax invoice the
     totals sat a column away from the lines they were adding up. */
  const cols = 7 + (showWeight || alu.on ? 1 : 0) + (alu.on ? 1 : 0)

  /* ── Adding a line without the mouse ──────────────────────────────────
     Theirs, on 22-11: "keyboard shortcuts to add line." Ctrl+Enter — or
     Cmd+Enter — adds one and puts the cursor in it, so a sheet of twenty
     sections is entered without once leaving the keyboard. */
  const addLine = () => {
    const colour = lastColour ?? (isPurchase ? UNCOATED : firstCoated())
    const row = blankLine(colour)
    setLines(ls => [...ls, row])
    requestAnimationFrame(() => {
      const boxes = document.querySelectorAll<HTMLInputElement>('[data-section-picker-input]')
      boxes[boxes.length - 1]?.focus()
    })
  }

  const onFormKey = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      addLine()
      return
    }
    /* ── Raising it without the mouse ──────────────────────────────────
       Theirs, on 22-11: "shortcut key to raise bill." Ctrl+S, because that
       is the one everybody's hand already knows, and the browser's own Save
       is no use inside a form. */
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault()
      if (ready) save('Sent')
    }
  }

  const theDate = isPurchase ? theirDate : date
  const theNo = isPurchase ? theirNo.trim() : docNo

  /* ── What makes a document raisable ───────────────────────────────────
     This asked for money on the line and would not let anything out until it
     saw some, which is why they could not raise a quotation at all: not one
     product in the master has a price yet, so every amount was nought and the
     button never lit. A quotation for material at a rate still to be settled
     is an ordinary thing to send. A party and material on it is the test. */
  /* A tax invoice is often the metal and nothing else — theirs, on 22-11:
     "we don't enter sections in tax invoice. Make it manual entry." A
     weight and a rate against the aluminium line is a document. */
  const metalAlone = alu.on && !autoWeighs && aluKg > 0 && aluRate > 0
  const ready = clientName.trim() !== ''
    && (!isPurchase || theNo !== '')
    && (metalAlone
      || lines.some(l => l.productId && (l.basis === 'kg' ? l.kg : l.nos) > 0))

  /* ── Anything at all is worth keeping ─────────────────────────────────
     Theirs, on 22-11: "while raising a new quotation or estimate, when we
     click outside by mistake it's vanished. Fix it, it should automatically
     save by default in draft, we will continue from there."

     It was only filing a draft once the document was complete enough to
     send — a customer and a priced line — so the half-typed ones, which
     are exactly the ones worth not losing, still went. A product picked or
     a customer chosen is enough now. */
  const worthKeeping = clientName.trim() !== '' || lines.some(l => l.productId)

  const unpriced = lines.filter(l => l.productId && l.rate <= 0).length

  /* ── What their own records say the lot should weigh ──────────────────
     Theirs, on 22-11: "weight mismatch alert should come — 3 checks, one
     from standard weight ranges given, previous purchase DC, and coating
     weight per kg. Tolerance 2-3%." */
  const opinions = useMemo(
    () => weightOpinions(lines, t.kg),
    [lines, t.kg])
  const band = useMemo(() => toleranceBand(opinions, t.kg), [opinions, t.kg])

  /* ── A line billed under what it was quoted at ────────────────────────
     Theirs, on 22-11: on conversion it "should recollect and recommend
     under value rates, reduction in qty accordingly." A bill is allowed to
     go out under the estimate — that is what a negotiation is — but nobody
     should find out about it afterwards. */
  const quoted = useMemo(() => {
    const m = new Map<string, { rate: number; nos: number }>()
    for (const l of initial?.lines ?? []) {
      if (l.productId) m.set(l.productId, { rate: l.rate, nos: l.nos })
    }
    return m
  }, [initial])
  const under = (l: BuiltLine) => {
    const was = quoted.get(l.productId)
    if (!was || !carriedFrom) return null
    if (l.rate > 0 && was.rate > 0 && l.rate < was.rate) {
      return `quoted at ${inr2(was.rate)}`
    }
    if (l.nos > 0 && was.nos > 0 && l.nos < was.nos) {
      return `${was.nos} quoted, ${l.nos} billed`
    }
    return null
  }

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
    })), clientName)
    onSave({
      no: theNo, date: theDate, validTill: validTill(theDate, days),
      clientName: clientName.trim(), subject: subject.trim(), owner: preparedBy.trim(),
      terms: termsFromText(terms),
      lines: keep, interState, aluminium: alu, coatingMode, coatingRate, coatingUnit,
      metalKg: autoWeighs ? undefined : aluKg,
      vehicle: vehicle.trim(), ewayBill: ewayBill.trim(), remarks: remarks.trim(),
      shipTo: shipTo.trim(), poNo: poNo.trim(), piNo: piNo.trim(),
      paymentTerms: paymentTerms.trim(),
      ...totalsOf(keep, alu, coatingUnit, autoWeighs ? undefined : aluKg, coatingRate,
        autoWeighs ? undefined : typedMetal),
      metalBlocks: metalGroups.map(g => ({ rate: g.rate, kg: g.kg, gst: aluGst })),
      status,
    })
    onClose()
  }

  /* ── Nothing typed is thrown away ─────────────────────────────────────
     Theirs, on 22-11: "draft should be saved, if we click OUTSIDE by
     default." Half an hour of a quotation went when somebody clicked past
     the edge of the form, and a form that punishes a misplaced click is a
     form people stop trusting. Clicking away now files what is there as a
     draft; Cancel still throws it away, because that is what Cancel is
     for, and a document that has not got a customer and a line on it has
     nothing worth keeping anyway. */
  const canDraft = !isPurchase && kind !== 'Tax Invoice'
  const leave = () => {
    if (worthKeeping && canDraft) save('Draft')
    else onClose()
  }

  return (
    <Modal open={open} onClose={leave}
      title={rev ? `${kind} ${docNo} — revision ${rev}`
        : isPurchase ? 'New Purchase Bill' : `New ${kind} — ${docNo}`} wide>
      <div className="space-y-4" onKeyDown={onFormKey}>
        <div className="rounded-lg p-3 flex items-start gap-2 text-[11.5px]"
          style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)', color: 'var(--text-3)' }}>
          <Info size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} />
          <span>
            {isPurchase
              ? 'The bill number and date are the supplier\u2019s, so they are typed off the paper. '
              : 'The number and the date are issued here, not typed. '}
            {canDraft && 'Click outside this form and it is kept as a draft. '}
            The taxable value, the GST and the total are what the lines below come to — nothing is entered
            against them.
            {rev > 0 && ' This is a revision: it keeps the number it revises and carries today’s date.'}
          </span>
        </div>

        {carriedFrom && (
          <div className="rounded-lg p-3 text-[11.5px]"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
            <p className="font-medium mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-1)' }}>
              <FileText size={13} style={{ color: 'var(--brand)' }} />
              Carried forward from {carriedFrom.no} — on the screen only, never on the paper
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 tabular-nums" style={{ color: 'var(--text-3)' }}>
              <span>Tax on {carriedFrom.no}: <b>{inr2(carriedFrom.tax)}</b></span>
              <span>Tax on this bill: <b>{inr2(t.tax)}</b></span>
              <span style={{
                color: Math.abs(carriedFrom.tax - t.tax) < 0.5 ? 'var(--green)' : 'var(--amber)',
              }}>
                {Math.abs(carriedFrom.tax - t.tax) < 0.5
                  ? 'Matched in full'
                  : `${inr2(+(carriedFrom.tax - t.tax).toFixed(2))} still to be billed`}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 tabular-nums" style={{ color: 'var(--text-4)' }}>
              <span>Value on {carriedFrom.no}: {inr2(carriedFrom.taxable)}</span>
              <span>Value on this bill: {inr2(t.taxable)}</span>
            </div>
          </div>
        )}

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
                <Select
                  value={coatingMode === 'section' ? 'Section by section'
                    : coatingMode === 'off' ? 'Not charged here'
                    : 'Once for the lot'}
                  onChange={v => setCoatingMode(
                    v.startsWith('Section') ? 'section'
                    : v.startsWith('Not') ? 'off'
                    : 'cumulative')}
                  options={['Section by section', 'Once for the lot', 'Not charged here']}
                  className="min-w-[11rem]" />
              )}
            </div>
            {metalGroups.length > 1 && (
              <p className="text-[11px] pb-2" style={{ color: 'var(--text-4)' }}>
                {metalGroups.length} metal rates on this document — a line each, above
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
                {/* ── Colour reads with the description, not beside it ───
                    Theirs, on 21-11, looking at the row: the colour is to go
                    in like a description rather than as a column of its own.
                    They are right about the shape of it — the finish is part
                    of what the line is, the way the length and the groove
                    are, and a column for it pushed the money off the side of
                    an already wide table. It sits under the product name
                    with the narration now. */}
                <tr><th className="min-w-[18rem]">Product</th><th>Code</th>
                  <th className="num">Qty (nos)</th>
                  {(showWeight || alu.on) && <th className="num">Weight (kg)</th>}
                  {alu.on && <th className="num">Metal rate ₹/kg</th>}
                  {/* Where the metal is priced at the top, a section's own
                      rate is the coating charge and nothing else, so the
                      column says so rather than leaving it to be worked out
                      from the box underneath. */}
                  <th className="num">{alu.on ? 'Coating rate' : 'Rate'}</th>
                  <th className="num">GST %</th>
                  <th className="num">Amount</th><th /></tr>
              </thead>
              <tbody>
                {/* ── A line for the metal at each rate ──────────────────
                    Theirs, on 22-11: a second Aluminium Extruded Profiles
                    line is to appear by itself when a section is priced at
                    a different rate a kilo — "like for 85 mm series". The
                    weight on each is the sections under it added up, and it
                    can be typed over: "we should have option to edit summed
                    up weight also." */}
                {/* Keyed by position, not by rate: keying it by the rate
                    threw the row away the moment a digit changed it, and
                    the cursor went with it. */}
                {alu.on && metalGroups.map((g, gi) => (
                  <tr key={`metal-${gi}`} style={{ background: 'var(--bg-card2)' }}>
                    <td className="font-semibold uppercase tracking-wide text-[11px]"
                      style={{ color: 'var(--text-1)' }}>
                      Aluminium Extruded Profiles
                      <span className="block text-[10px] normal-case font-normal tracking-normal"
                        style={{ color: 'var(--text-4)' }}>
                        {metalGroups.length > 1
                          ? `the sections at ₹${g.rate.toLocaleString('en-IN')}/kg, added up`
                          : 'every section below, added up — type over it to change it'}
                      </span>
                    </td>
                    <td className="font-mono text-xs" style={{ color: 'var(--text-4)' }}>—</td>
                    <td className="num tabular-nums" style={{ color: 'var(--text-4)' }}>
                      {g.nos || '—'}
                    </td>
                    {/* The summed weight, and a box to type one over it. */}
                    {/* "We mix sections and weigh" — theirs, on 22-11. On
                        everything but the quotation this is one figure
                        somebody read off a scale, typed here and nowhere
                        else. The quotation works it out of the sections and
                        lets a typed total be spread back over them. */}
                    <td className="num">
                      <NumBox className="input !w-24 !py-1 text-right tabular-nums !text-xs font-semibold"
                        value={autoWeighs ? g.kg : aluKg} placeholder="total kg"
                        title={autoWeighs
                          ? 'The sections under this, added up. Type a figure and it is spread back over them.'
                          : 'The weight this lot was weighed at. The sections below carry none of their own.'}
                        onChange={v => autoWeighs ? setGroupKg(g, v) : setAluKg(v)} />
                    </td>
                    <td className="num">
                      <NumBox className="input !w-24 !py-1 text-right tabular-nums !text-xs"
                        value={g.rate} placeholder="per kg"
                        onChange={v => setGroupRate(g, v)} />
                    </td>
                    <td className="num" />
                    <td className="num">
                      {gi === 0 ? (
                        <Select value={String(aluGst)} onChange={v => setAluGst(Number(v))}
                          options={GST_RATES} className="!w-16 !py-1 !text-xs !min-w-0" />
                      ) : (
                        <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>{aluGst}%</span>
                      )}
                    </td>
                    <td className="num tabular-nums font-semibold" style={{ color: 'var(--brand)' }}>
                      {metalGroups.length > 1 && autoWeighs
                        ? (g.kg * g.rate ? inr2(+(g.kg * g.rate).toFixed(2)) : '—')
                        : (t.metal ? inr2(t.metal) : '—')}
                    </td>
                    {/* ── The first line, and a way to be rid of it ───────
                        Theirs, on 21-11: "a new quotation opens with one
                        default line, Aluminium Extrusion Profile, with an
                        option to delete that line." */}
                    <td>
                      {gi === 0 && (
                        <button className="btn-ghost !px-1.5 !py-1" style={{ color: 'var(--red)' }}
                          title="Take the aluminium line off and price each section on its own"
                          onClick={() => setAluOn(false)}>
                          <Trash2 size={13} /></button>
                      )}
                    </td>
                  </tr>
                ))}
                {/* ── One Powder Coating entry, out of the lines ──────────
                    Theirs, on 22-11: "in the same line we need to enter
                    coating charge... coating charge needs to get summed up
                    and display as a single entry as Powder Coating, whereas
                    only sections list will be shown."

                    So nothing is typed here. The rate box is the one a new
                    section starts at — the pre-fed figure — and the money
                    beside it is what the lines actually come to. */}
                {alu.on && coatingMode === 'cumulative' && (
                  <tr style={{ background: 'var(--bg-card2)' }}>
                    <td className="font-semibold uppercase tracking-wide text-[11px]"
                      style={{ color: 'var(--text-1)' }}>
                      Powder Coating
                      <span className="block text-[10px] normal-case font-normal tracking-normal"
                        style={{ color: 'var(--text-4)' }}>
                        the coating on every section below, added into one entry
                      </span>
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
                    <td className="num tabular-nums" style={{ color: 'var(--text-4)' }}>
                      {coatingUnit === 'nos' ? `${t.coatBase} nos` : '—'}
                    </td>
                    {(showWeight || alu.on) && (
                      <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>
                        {t.kg} kg
                      </td>
                    )}
                    <td className="num" />
                    <td className="num">
                      <NumBox className="input !w-24 !py-1 text-right tabular-nums !text-xs"
                        value={coatingRate}
                        placeholder={coatingUnit === 'kg' ? 'per kg' : 'per piece'}
                        title="What a section starts at. Every line with nothing against it follows this; one you have typed stays as it is."
                        onChange={setStandingCoating} />
                      <p className="text-[10px] text-right mt-0.5" style={{ color: 'var(--text-4)' }}>
                        pre-fed
                      </p>
                    </td>
                    <td className="num" />
                    <td className="num tabular-nums font-semibold" style={{ color: 'var(--brand)' }}>
                      {t.coating ? inr2(t.coating) : '—'}
                    </td>
                    <td>
                      <button className="btn-ghost !px-1.5 !py-1" style={{ color: 'var(--red)' }}
                        title="Take the coating off this document"
                        onClick={() => setCoatingMode('off')}>
                        <Trash2 size={13} /></button>
                    </td>
                  </tr>
                )}
                {lines.map((l, i) => (
                  <tr key={l.key}>
                    <td>
                      <SectionPicker options={options} value={l.productId}
                        onChange={id => { pick(l.key, id); toQty(l.key) }}
                        onCreate={typed => { create(l.key, typed); toQty(l.key) }} />
                      {/* ── Its own words ────────────────────────────────
                          Theirs, on 21-11: "add a Description / Narration
                          box for each item, like in Tally. Use it for items
                          that aren't in stock — a special finish or
                          thickness, for example." It prints under the
                          description and belongs to this supply, not to the
                          product: the same section in another finish is
                          still the same section. */}
                      {l.productId && (
                        <div className="flex items-center gap-1.5 mt-1">
                          {/* Hardware is bought finished and never coated,
                              so it carries no colour — theirs, on 21-11. */}
                          {/* Set on the first line and carried to the next —
                              theirs, on 21-11. A purchase bill can be
                              uncoated because that is what comes off the
                              lorry; a sales document cannot go out in no
                              finish at all. */}
                          {productOf(l.productId)?.kind === 'section' ? (
                            <ColourPicker value={l.colour ?? UNCOATED} allowRaw={isPurchase}
                              onChange={c => patch(l.key, { colour: c })}
                              className="!w-[6.75rem] !py-0.5 !text-[11px] !min-w-0" />
                          ) : (
                            <span className="text-[10px] shrink-0" style={{ color: 'var(--text-4)' }}>
                              not coated
                            </span>
                          )}
                          <input className="input flex-1 min-w-0 !py-0.5 !text-[11px]"
                            value={l.narration ?? ''}
                            placeholder="Narration — thickness, finish, anything not in stock"
                            onChange={e => patch(l.key, { narration: e.target.value })} />
                        </div>
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
                    <td className="num">
                      {/* Empty rather than nought: a box reading 0 has to be
                          cleared before anything can be typed into it, and
                          typing in front of it gives 0415. */}
                      <NumBox className="input !w-20 !py-1 text-right tabular-nums !text-xs"
                        data-qty={l.key}
                        value={l.nos} placeholder="0"
                        onChange={v => setNos(l.key, v)} />
                      {!showWeight && l.basis === 'kg' && l.kg > 0 && (
                        <p className="text-[10px] text-right mt-0.5 tabular-nums"
                          style={{ color: 'var(--text-4)' }}>{l.kg} kg</p>
                      )}
                    </td>
                    {(showWeight || alu.on) && (
                      <td className="num">
                        {!showWeight ? (
                          <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>
                            in the total
                          </span>
                        ) : (
                        <>
                        {/* On a bill the weight is typed, so the box is open
                            whatever the line is priced on — it was greyed out
                            wherever the master had no weight per piece, which
                            is every line on a tax invoice now that a bill
                            works nothing out for itself. Left empty, the line
                            is priced by the count, which is how clips go. */}
                        <NumBox className="input !w-24 !py-1 text-right tabular-nums !text-xs"
                          value={l.mergedUp ? 0 : l.kg}
                          placeholder={l.mergedUp ? 'with above' : autoWeighs ? '0' : 'by nos'}
                          disabled={!!l.mergedUp || (autoWeighs && l.basis === 'nos')}
                          title={l.mergedUp
                            ? 'Weighed together with the line above — that figure covers this one too'
                            : autoWeighs && l.basis === 'nos'
                            ? 'No weight per piece in your books — priced per piece'
                            : autoWeighs
                            ? 'Worked out from your coating books. Type over it and that is what it goes out at.'
                            : 'Leave it empty and this line is priced by the count'}
                          onChange={v => setKg(l.key, v)} />
                        {i > 0 && isAluminium(l) && (
                          <label className="text-[10px] flex items-center gap-1 justify-end mt-0.5"
                            style={{ color: l.mergedUp ? 'var(--brand)' : 'var(--text-4)' }}
                            title="Two or three things on the scale together, one figure written against the first">
                            <input type="checkbox" checked={!!l.mergedUp}
                              onChange={() => toggleMerge(l.key)} />
                            weighed above
                          </label>
                        )}
                        </>
                        )}
                      </td>
                    )}
                    {alu.on && (
                      <td className="num">
                        {isAluminium(l) ? (
                          <NumBox className="input !w-20 !py-1 text-right tabular-nums !text-xs"
                            value={l.metalRate ?? 0} placeholder={String(aluRate || 0)}
                            title="Leave it empty to use the rate at the top. Fill it in for a series that is priced differently."
                            onChange={v => patch(l.key, { metalRate: v || undefined })} />
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
                      {/* ── Typed here, whatever the document does with it ──
                          Theirs, on 22-11: "in the same line we need to
                          enter coating charge." This box was greyed out
                          the moment the coating was shown as one entry, so
                          a job where the long runs cost more to coat than
                          the clips could not be priced at all. It is open
                          on every document now; the single entry above is
                          what these add up to. */}
                      <NumBox className="input !w-24 !py-1 text-right tabular-nums !text-xs"
                        value={l.rate}
                        placeholder={alu.on && isAluminium(l) ? 'coating / kg'
                          : l.basis === 'kg' ? 'per kg' : 'per piece'}
                        style={l.recalled ? { borderColor: 'var(--green)' } : undefined}
                        title={l.recalled
                          ? 'What this product last went out at. Type over it to change it.'
                          : l.basis === 'kg' ? 'Rate per kilogram' : 'Rate per piece'}
                        onChange={v => patch(l.key, { rate: v, recalled: false })} />
                      {l.recalled && (
                        <p className="text-[10px] text-right mt-0.5" style={{ color: 'var(--green)' }}>last rate</p>
                      )}
                      {under(l) && (
                        <p className="text-[10px] text-right mt-0.5" style={{ color: 'var(--amber)' }}>
                          {under(l)}
                        </p>
                      )}
                    </td>
                    <td className="num">
                      <Select value={String(l.gst)} onChange={v => patch(l.key, { gst: Number(v) })}
                        options={GST_RATES} className="!w-16 !py-1 !text-xs !min-w-0" /></td>
                    <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>
                      {amountOf(l) ? inr2(amountOf(l)) : '—'}
                      {inTheLot(l) && amountOf(l) > 0 && (
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-4)' }}>
                          into the one entry
                        </p>
                      )}</td>
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
                  <td colSpan={cols - 3} className="text-right text-xs" style={{ color: 'var(--text-3)' }}>
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
                    <td colSpan={cols - 3} className="text-right text-xs" style={{ color: 'var(--text-3)' }}>IGST</td>
                    <td />
                    <td className="num tabular-nums">{inr2(t.tax)}</td>
                    <td />
                  </tr>
                ) : (
                  <>
                    <tr>
                      <td colSpan={cols - 3} className="text-right text-xs" style={{ color: 'var(--text-3)' }}>CGST</td>
                      <td />
                      <td className="num tabular-nums">{inr2(+(t.tax / 2).toFixed(2))}</td>
                      <td />
                    </tr>
                    <tr>
                      <td colSpan={cols - 3} className="text-right text-xs" style={{ color: 'var(--text-3)' }}>SGST</td>
                      <td />
                      <td className="num tabular-nums">{inr2(+(t.tax / 2).toFixed(2))}</td>
                      <td />
                    </tr>
                  </>
                )}
                <tr style={{ borderTop: '1px solid var(--border-2)' }}>
                  <td colSpan={cols - 3} className="text-right text-sm font-bold" style={{ color: 'var(--text-1)' }}>
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
          {alu.on && band && (
            <div className="rounded-lg p-3 mt-2.5 text-[11.5px]"
              style={{
                background: band.ok
                  ? 'var(--bg-card2)'
                  : 'color-mix(in srgb, var(--amber) 10%, transparent)',
                border: `1px solid ${band.ok ? 'var(--border-2)' : 'var(--amber)'}`,
              }}>
              <p className="flex items-center gap-1.5 font-medium mb-1.5"
                style={{ color: band.ok ? 'var(--text-3)' : 'var(--amber)' }}>
                {band.ok ? <Info size={13} /> : <AlertTriangle size={13} />}
                {band.ok
                  ? `${t.kg} kg sits inside what your records expect — ${band.low} to ${band.high} kg`
                  : `${t.kg} kg is ${band.offPct! > 0 ? '+' : ''}${band.offPct}% outside what your `
                    + `records expect — ${band.low} to ${band.high} kg`}
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {opinions.map(o => (
                  <span key={o.source} className="tabular-nums" style={{ color: 'var(--text-4)' }}>
                    {o.source}: {o.kg === null ? 'nothing on record' : `${o.kg} kg`}
                  </span>
                ))}
              </div>
              <p className="mt-1.5" style={{ color: 'var(--text-4)' }}>
                The band is the lowest and highest of those three, give or take {TOLERANCE_PCT}%
                — a lot weighed with the coating on it reads heavy and one off the mill reads
                light, and both are ordinary. Whatever you typed is what goes out.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 mt-2.5">
            <button className="btn-outline" onClick={addLine}>
              <Plus size={14} /> Add a line
              <span className="text-[10px] ml-1" style={{ color: 'var(--text-4)' }}>Ctrl ↵</span>
            </button>
            <span className="text-[10px]" style={{ color: 'var(--text-4)' }}>
              Ctrl + S raises it
            </span>
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
          <button className="btn-ghost" onClick={onClose}
            title="Throw this away. Clicking outside the form keeps it as a draft instead.">
            Cancel
          </button>
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
