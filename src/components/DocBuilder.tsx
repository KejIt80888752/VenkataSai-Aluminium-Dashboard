import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Info, X, AlertTriangle, FileText } from 'lucide-react'
import { Modal, Select } from '@/components/ui'
import { SectionPicker } from '@/components/SectionPicker'
import { PICK_PRODUCTS, productById } from '@/data/productmaster'
import { useExtraProducts, addExtraProduct } from '@/lib/extraproducts'
import { CLIENTS, SUPPLIERS } from '@/data/parties'
import { PARTY_CODES } from '@/data/partycodes'
import { inr2 } from '@/lib/utils'
import { today, validTill, DEFAULT_VALID_DAYS, revisionNumber } from '@/lib/docnos'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { recallRate, recallSlab, rememberAll } from '@/lib/ratememory'
import { DEFAULT_TERMS, termsFromText, termsToText } from '@/data/terms'
import { hsnFor } from '@/data/hsn'

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
) {
  const picked = lines.filter(l => l.productId)
  const kg = totalKgOf(picked)

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
        ? +(kg * coatingRate).toFixed(2)
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

  return { metal, coating, goods, kg, taxable, tax, total: +(taxable + tax).toFixed(2) }
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
const blankLine = (): BuiltLine => ({
  key: Math.random().toString(36).slice(2),
  productId: '', code: '', name: '', hsn: hsnFor('section'),
  basis: 'nos', nos: 0, kg: 0, rate: 0, gst: 18,
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
  const showWeight = !(kind === 'Quotation' || kind === 'Estimate')
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
    setCoatingMode(COATING_FIXED(kind)
      ? 'cumulative'
      : initial?.coatingMode ?? DEFAULT_COATING[kind] ?? 'section')
    setCoatingRate(initial?.coatingRate ?? 0)
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
    setLines(initial?.lines?.length
      ? initial.lines.map(l => ({ ...l, key: Math.random().toString(36).slice(2) }))
      : [blankLine()])
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

  const t = useMemo(() => totalsOf(lines, alu, coatingMode, coatingRate),
    [lines, aluOn, aluRate, aluGst, coatingMode, coatingRate, isPurchase])
  const rev = revisionNumber(docNo)

  const patch = (key: string, p: Partial<BuiltLine>) =>
    setLines(ls => ls.map(l => l.key === key ? { ...l, ...p } : l))

  /* Picking a product brings its code and, where your books have weighed it,
     the weight per piece — so the kilos follow from the count. */
  const pick = (key: string, id: string) => setLines(ls => ls.map(l => {
    if (l.key !== key) return l
    const p = productOf(id)
    if (!p) return { ...l, productId: '', name: '', code: '' }
    const basis: 'kg' | 'nos' = p.kgPerPiece !== null ? 'kg' : 'nos'
    /* What this product went out at last time, and failing that the slab this
       kind of material usually carries. A rate typed once is not typed again. */
    const seen = recallRate(id)
    return {
      ...l, productId: id, code: p.code, name: p.name, basis,
      hsn: hsnFor(p.kind === 'section' || p.kind === 'rubber' ? p.kind : 'hardware'),
      kg: p.kgPerPiece !== null ? +(p.kgPerPiece * l.nos).toFixed(3) : 0,
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
      basis: x.kgPerPiece !== null ? 'kg' : 'nos',
      kg: x.kgPerPiece !== null ? +(x.kgPerPiece * l.nos).toFixed(3) : 0,
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
    return { ...l, nos, kg: p?.kgPerPiece != null ? +(p.kgPerPiece * nos).toFixed(3) : l.kg }
  }))

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

  const save = () => {
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
      lines: keep, interState, aluminium: alu, coatingMode, coatingRate,
      vehicle: vehicle.trim(), ewayBill: ewayBill.trim(), remarks: remarks.trim(),
      shipTo: shipTo.trim(), poNo: poNo.trim(), piNo: piNo.trim(),
      paymentTerms: paymentTerms.trim(),
      ...totalsOf(keep, alu, coatingMode, coatingRate),
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
              <input className="input w-full" value={date} readOnly
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
            <input className="input w-full" value={validTill(theDate, days)} readOnly
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
                    <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>
                      {t.kg} kg
                    </td>
                    <td className="num" />
                    <td className="num">
                      <input className="input !w-24 !py-1 text-right tabular-nums !text-xs"
                        value={aluRate || ''} placeholder="per kg"
                        onChange={e => setAluRate(Number(e.target.value) || 0)} />
                    </td>
                    <td className="num">
                      <Select value={String(aluGst)} onChange={v => setAluGst(Number(v))}
                        options={GST_RATES} className="!w-16 !py-1 !text-xs !min-w-0" />
                    </td>
                    <td className="num tabular-nums font-semibold" style={{ color: 'var(--brand)' }}>
                      {t.metal ? inr2(t.metal) : '—'}
                    </td>
                    <td />
                  </tr>
                )}
                {lines.map((l, i) => (
                  <tr key={l.key}>
                    <td>
                      <SectionPicker options={options} value={l.productId}
                        onChange={id => pick(l.key, id)}
                        onCreate={typed => create(l.key, typed)} />
                    </td>
                    <td className="font-mono text-xs" style={{ color: 'var(--text-4)' }}>{l.code || '—'}</td>
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
                        <input className="input !w-24 !py-1 text-right tabular-nums !text-xs"
                          value={l.mergedUp ? '' : (l.kg || '')}
                          placeholder={l.mergedUp ? 'with above' : '0'}
                          disabled={l.basis === 'nos' || !!l.mergedUp}
                          title={l.mergedUp
                            ? 'Weighed together with the line above — that figure covers this one too'
                            : l.basis === 'nos' ? 'No weight per piece in your books — priced per piece' : undefined}
                          onChange={e => patch(l.key, { kg: Number(e.target.value) || 0 })} />
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
                {alu.on && coatingMode === 'cumulative' && (
                  <tr style={{ background: 'var(--bg-card2)' }}>
                    <td className="font-semibold uppercase tracking-wide text-[11px]"
                      style={{ color: 'var(--text-1)' }}>
                      Powder Coating
                      <span className="block text-[10px] normal-case font-normal tracking-normal"
                        style={{ color: 'var(--text-4)' }}>one charge for the lot</span>
                    </td>
                    <td className="font-mono text-xs" style={{ color: 'var(--text-4)' }}>—</td>
                    <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>
                      {t.kg} kg
                    </td>
                    <td className="num" />
                    <td className="num">
                      <input className="input !w-24 !py-1 text-right tabular-nums !text-xs"
                        value={coatingRate || ''} placeholder="per kg"
                        onChange={e => setCoatingRate(Number(e.target.value) || 0)} />
                    </td>
                    <td className="num" />
                    <td className="num tabular-nums font-semibold" style={{ color: 'var(--brand)' }}>
                      {t.coating ? inr2(t.coating) : '—'}
                    </td>
                    <td />
                  </tr>
                )}
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
                  <td colSpan={5} className="text-right text-xs" style={{ color: 'var(--text-3)' }}>
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
                    <td colSpan={5} className="text-right text-xs" style={{ color: 'var(--text-3)' }}>IGST</td>
                    <td />
                    <td className="num tabular-nums">{inr2(t.tax)}</td>
                    <td />
                  </tr>
                ) : (
                  <>
                    <tr>
                      <td colSpan={5} className="text-right text-xs" style={{ color: 'var(--text-3)' }}>CGST</td>
                      <td />
                      <td className="num tabular-nums">{inr2(+(t.tax / 2).toFixed(2))}</td>
                      <td />
                    </tr>
                    <tr>
                      <td colSpan={5} className="text-right text-xs" style={{ color: 'var(--text-3)' }}>SGST</td>
                      <td />
                      <td className="num tabular-nums">{inr2(+(t.tax / 2).toFixed(2))}</td>
                      <td />
                    </tr>
                  </>
                )}
                <tr style={{ borderTop: '1px solid var(--border-2)' }}>
                  <td colSpan={5} className="text-right text-sm font-bold" style={{ color: 'var(--text-1)' }}>
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
            <button className="btn-outline" onClick={() => setLines(ls => [...ls, blankLine()])}>
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
          <button className="btn" disabled={!ready} onClick={save}
            style={ready ? undefined : { opacity: .45, cursor: 'not-allowed' }}>
            {rev ? `Save revision ${rev}` : `Raise ${kind.toLowerCase()}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
