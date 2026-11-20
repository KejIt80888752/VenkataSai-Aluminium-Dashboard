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
import { amountOf } from '@/components/DocBuilder'
import { COMPANY } from '@/data/company'

export type SalesKind = 'Quotation' | 'Estimate' | 'Proforma Invoice' | 'Tax Invoice'

const PREFIX: Record<SalesKind, string> = {
  'Quotation': 'Q', 'Estimate': 'EST', 'Proforma Invoice': 'PI', 'Tax Invoice': 'INV',
}

/** The material on a built document, as a stored line. */
const linesOf = (d: BuiltDoc): Line[] => d.lines.map(l => ({
  code: l.code, name: l.name, hsn: l.hsn,
  unit: l.basis === 'kg' ? 'kg' : 'nos',
  qty: l.basis === 'kg' ? l.kg : l.nos,
  rate: l.rate, gst: l.gst, amount: amountOf(l), cost: 0,
  productId: l.productId, nos: l.nos,
}))

/** An offer or a proforma: quotation, estimate, proforma invoice. */
export function asQuotation(d: BuiltDoc, kind: SalesKind): Quotation {
  return {
    id: `${PREFIX[kind]}-${Date.now().toString(36)}`,
    no: d.no, date: d.date, validTill: d.validTill,
    clientId: '', clientName: d.clientName, subject: d.subject,
    lines: linesOf(d),
    taxable: d.taxable, tax: d.tax, total: d.total,
    status: 'Sent', owner: d.owner,
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
    poNo: '—', vehicle: '—', ewayBill: '—',
    remarks: d.subject || '—', shipTo: '—',
    lines: linesOf(d),
    taxable: d.taxable,
    cgst: d.interState ? 0 : half,
    sgst: d.interState ? 0 : half,
    igst: d.interState ? d.tax : 0,
    roundOff: +(total - (d.taxable + d.tax)).toFixed(2),
    total,
    cogs: 0, received: 0, status: 'Unpaid', mode: 'Credit',
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
}

export const rowOfQuotation = (q: Quotation): DocRow => ({
  id: q.id, no: q.no, date: q.date, until: q.validTill,
  clientName: q.clientName, subject: q.subject, lines: q.lines,
  taxable: q.taxable, tax: q.tax, total: q.total,
  status: q.status, owner: q.owner, balance: null,
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
  balance: +(i.total - i.received).toFixed(2),
})

/** A stored row read back into the builder, for a revision or a carry-forward. */
export const builtFrom = (r: DocRow) => ({
  clientName: r.clientName,
  subject: r.subject,
  lines: r.lines,
})

export const STATUS_OPTIONS: Record<'offer' | 'invoice', string[]> = {
  offer: ['Sent', 'Under Negotiation', 'Won', 'Lost', 'Expired'],
  invoice: ['Paid', 'Partial', 'Unpaid', 'Overdue'],
}
