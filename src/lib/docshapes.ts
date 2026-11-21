/* ── One builder, two records ──────────────────────────────────────────────
   The sales screen raises four documents and the billing screen raises one,
   and between them they write into two different registers. A quotation, an
   estimate and a proforma are all the same record; a tax invoice is not — it
   splits its tax three ways, carries what has been received against it, and
   lives in its own status vocabulary, Paid and Overdue rather than Won and
   Lost.

   Raising a tax invoice from the sales screen wrote a quotation-shaped row
   into the bill register. Opened on the billing screen it read as a bill with
   no CGST, no SGST and nothing received, so its tax and its balance both came
   out as NaN and its status matched no filter on the page. Both screens now
   build their records here, so there is one answer to what a bill looks like.

   None of the figures are touched on the way across. A proforma carried
   forward into a bill keeps its own lines, its own tax and its own total; only
   the fields a bill has and a proforma does not are filled in.            */

import type { Quotation, Invoice, Line } from '@/data/txns'
import type { BuiltDoc } from '@/components/DocBuilder'
import { amountOf, totalKgOf, totalNosOf, isAluminium } from '@/components/DocBuilder'
import { hsnFor } from '@/data/hsn'
import { COMPANY } from '@/data/company'

export type SalesKind = 'Quotation' | 'Estimate' | 'Proforma Invoice' | 'Tax Invoice'

const PREFIX: Record<SalesKind, string> = {
  'Quotation': 'Q', 'Estimate': 'EST', 'Proforma Invoice': 'PI', 'Tax Invoice': 'INV',
}

/* ── The material on a built document, as stored lines ─────────────────────
   Where the metal is priced at the top, the document that goes out has an
   aluminium line carrying every kilo on it and sections underneath carrying
   only the coating. The sections are always listed, even when the coating is
   charged once for the lot, because they are the specification of what is
   being supplied and a customer has to be able to read it.               */
const sectionLines = (d: BuiltDoc): Line[] => d.lines.map(l => {
  const alu = isAluminium(l)
  /* Only aluminium is coated. Hardware and rubber travel on the same
     document and are sold outright — theirs, seeing a rubber listed under
     the metal: "wrong, not a part of aluminium... hardware is different". */
  const coated = d.aluminium?.on && alu
  const charged = !(coated && d.coatingMode === 'cumulative')
  return {
    code: l.code, name: l.name, hsn: l.hsn,
    /* Sections are quoted by the piece — theirs: "all sections are nos". The
       kilos are on the metal line above and do not belong twice on one
       document, which is what they meant by "displaying double time". */
    unit: alu ? 'nos' : (l.basis === 'kg' ? 'kg' : 'nos'),
    /* The quantity is the count the line was supplied in. It used to be the
       kilos with "nos" written beside them, which read as a count and was
       not one, and reopened as a count on the next revision. */
    qty: alu ? l.nos : (l.basis === 'kg' ? l.kg : l.nos),
    rate: charged ? l.rate : 0,
    gst: l.gst,
    amount: charged ? amountOf(l) : 0,
    cost: 0,
    productId: l.productId, nos: l.nos,
    /* Carried so a revision reopens on what it was actually priced on. */
    kg: l.kg, basis: l.basis, metalRate: l.metalRate,
    narration: l.narration,
    /* The finish it is supplied in, which is half of what a stock line is —
       theirs, on 21-11: "inventory is managed by colour". */
    colour: l.colour,
    group: coated ? ('coating' as const) : ('item' as const),
  }
})

/** What the one coating charge is worked out on — kilos, or pieces. */
export const coatingBaseOf = (d: BuiltDoc) =>
  d.coatingUnit === 'nos' ? totalNosOf(d.lines) : totalKgOf(d.lines)

const linesOf = (d: BuiltDoc): Line[] => {
  if (!d.aluminium?.on) return sectionLines(d)

  /* ── One metal line per rate ──────────────────────────────────────────
     A job that mixes series is priced at more than one rate a kilo, so the
     metal goes out as one line for each rather than a single figure that
     hides them — theirs: "in your case it clubs all, like 85 mm series it's
     different... I need option to select sections and charge differently". */
  const metal = d.lines.filter(isAluminium)
  const byRate = new Map<number, number>()
  for (const l of metal) {
    const rate = l.metalRate && l.metalRate > 0 ? l.metalRate : d.aluminium.rate
    byRate.set(rate, +((byRate.get(rate) ?? 0) + l.kg).toFixed(3))
  }
  const several = byRate.size > 1

  const out: Line[] = [...byRate.entries()]
    .filter(([, kg]) => kg > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([rate, kg]) => ({
      code: '', hsn: hsnFor('section'),
      name: several
        ? `ALUMINIUM EXTRUDED PROFILES @ ${rate.toLocaleString('en-IN')}/kg`
        : 'ALUMINIUM EXTRUDED PROFILES',
      unit: 'kg', qty: kg, rate,
      gst: d.aluminium.gst, amount: +(kg * rate).toFixed(2), cost: 0,
      kg, basis: 'kg' as const,
      group: 'aluminium' as const,
    }))

  /* ── The coating charge goes above the sections ───────────────────────
     Theirs, on 21-11: it is to come up the page, not sit at the bottom
     under the list. It belongs with the metal — the two of them are what
     is being charged for, and the sections underneath are the
     specification of what that charge covers.

     A charge of nothing on nothing is not printed at all. A quotation went
     out carrying "POWDER COATING · 0 kg · ₹0.00 · —", which is a line that
     says nothing and invites the question of what it is doing there. */
  if (d.coatingMode === 'cumulative') {
    const rate = d.coatingRate ?? 0
    const unit = d.coatingUnit === 'nos' ? 'nos' : 'kg'
    const qty = coatingBaseOf(d)
    /* The slab most of the coated sections are at, since the charge covers
       them all as one supply. */
    const slab = metal.length
      ? [...metal.reduce((m, l) => m.set(l.gst, (m.get(l.gst) ?? 0) + 1), new Map<number, number>())
          .entries()].sort((a, b) => b[1] - a[1])[0][0]
      : 18
    if (qty > 0 || rate > 0) out.push({
      code: '', name: 'POWDER COATING', hsn: hsnFor('coating'),
      unit, qty, rate,
      gst: slab, amount: +(qty * rate).toFixed(2), cost: 0,
      kg: totalKgOf(d.lines), basis: unit === 'kg' ? 'kg' : 'nos',
      group: 'coating',
    })
  }

  out.push(...sectionLines(d))
  return out
}

/** An offer or a proforma: quotation, estimate, proforma invoice. */
export function asQuotation(d: BuiltDoc, kind: SalesKind, status: Quotation['status'] = 'Sent'): Quotation {
  return {
    id: `${PREFIX[kind]}-${Date.now().toString(36)}`,
    no: d.no, date: d.date, validTill: d.validTill,
    clientId: '', clientName: d.clientName, subject: d.subject,
    lines: linesOf(d),
    taxable: d.taxable, tax: d.tax, total: d.total,
    status, owner: d.owner, terms: d.terms,
  }
}

/** A tax invoice, with its tax split by place of supply. */
export function asInvoice(d: BuiltDoc): Invoice {
  const half = +(d.tax / 2).toFixed(2)
  const total = Math.round(d.taxable + d.tax)
  return {
    id: `INV-${Date.now().toString(36)}`,
    no: d.no, date: d.date, dueDate: d.validTill,
    clientId: '', clientName: d.clientName, gstin: '',
    state: d.interState ? '' : COMPANY.state,
    poNo: d.poNo || '—',
    vehicle: d.vehicle || '—',
    ewayBill: d.ewayBill || '—',
    remarks: d.remarks || d.subject || '—',
    shipTo: d.shipTo || '—',
    piNo: d.piNo || undefined,
    paymentTerms: d.paymentTerms || undefined,
    lines: linesOf(d),
    taxable: d.taxable,
    cgst: d.interState ? 0 : half,
    sgst: d.interState ? 0 : half,
    igst: d.interState ? d.tax : 0,
    roundOff: +(total - (d.taxable + d.tax)).toFixed(2),
    total,
    cogs: 0, received: 0, status: 'Unpaid', mode: 'Credit', terms: d.terms,
  }
}

/* ── Showing both in one list ─────────────────────────────────────────── */

export interface DocRow {
  id: string
  no: string
  date: string
  /** validity on an offer, the due date on a bill */
  until: string
  clientName: string
  subject: string
  lines: Line[]
  taxable: number
  tax: number
  total: number
  status: string
  owner: string
  /** what is still to come in, on a bill that carries it */
  balance: number | null
  terms?: string[]
}

export const rowOfQuotation = (q: Quotation): DocRow => ({
  id: q.id, no: q.no, date: q.date, until: q.validTill,
  clientName: q.clientName, subject: q.subject, lines: q.lines,
  taxable: q.taxable, tax: q.tax, total: q.total,
  status: q.status, owner: q.owner, balance: null, terms: q.terms,
})

export const rowOfInvoice = (i: Invoice): DocRow => ({
  id: i.id, no: i.no, date: i.date, until: i.dueDate,
  clientName: i.clientName,
  subject: i.remarks === '—' ? '' : i.remarks,
  lines: i.lines,
  taxable: i.taxable,
  tax: +(i.cgst + i.sgst + i.igst).toFixed(2),
  total: i.total,
  status: i.status, owner: '',
  balance: +(i.total - i.received).toFixed(2), terms: i.terms,
})

/** A stored row read back into the builder, for a revision or a carry-forward. */
export const builtFrom = (r: DocRow) => ({
  clientName: r.clientName,
  subject: r.subject,
  lines: r.lines,
  owner: r.owner,
  terms: r.terms,
})

export const STATUS_OPTIONS: Record<'offer' | 'invoice', string[]> = {
  /* Draft first, because that is where a document that is still being worked
     on sits — theirs, on 21-11: "add a Save as Draft option". */
  offer: ['Draft', 'Sent', 'Under Negotiation', 'Won', 'Lost', 'Expired'],
  invoice: ['Paid', 'Partial', 'Unpaid', 'Overdue'],
}
