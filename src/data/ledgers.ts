/* ── Three books, one set of documents ─────────────────────────────────────
   An estimate is written at the counter before anything is agreed. When the
   customer confirms, the same document becomes a tax invoice — the point is
   that nobody retypes it, and that the link between the two is kept.

   Part conversion exists because part loads happen: three windows go today
   and two next week, so the estimate is invoiced in two pieces. What the
   ledger will not do is let an estimate be closed with part of it never
   invoiced — the balance stays open and visible until it is either invoiced
   or cancelled with a reason.                                             */

import { INVOICES } from './txns'
import { CLIENTS } from './parties'
import { TODAY } from './company'

export type Book = 'Estimate' | 'GST' | 'Audit'
export const BOOKS: Book[] = ['Estimate', 'GST', 'Audit']

export type EstStatus = 'Open' | 'Part Invoiced' | 'Fully Invoiced' | 'Cancelled'

export interface EstimateLine {
  code: string; name: string; qty: number; unit: string; rate: number; amount: number
  /** how much of this line has already gone onto a tax invoice */
  invoicedQty: number
}

export interface Estimate {
  no: string
  date: string
  clientId: string
  client: string
  lines: EstimateLine[]
  value: number
  status: EstStatus
  raisedBy: string
  /** tax invoices raised out of this estimate */
  links: { invoiceNo: string; date: string; value: number }[]
  cancelReason?: string
}

const STAFF = ['Kavya M', 'Siva Reddy', 'Murali', 'Prakash']

export const ESTIMATES: Estimate[] = INVOICES.slice(0, 26).map((inv, i) => {
  const client = CLIENTS.find(c => c.id === inv.clientId) ?? CLIENTS[0]

  // Most estimates turn into a bill; a few sit open, one or two get dropped.
  const share = i % 7 === 2 ? 0 : i % 5 === 1 ? 0.5 : 1
  const cancelled = i % 11 === 4

  const lines: EstimateLine[] = inv.lines.map(l => ({
    code: l.code, name: l.name, qty: l.qty, unit: l.unit, rate: l.rate, amount: l.amount,
    invoicedQty: cancelled ? 0 : +(l.qty * share).toFixed(2),
  }))

  const value = +lines.reduce((s, l) => s + l.amount, 0).toFixed(2)
  const status: EstStatus =
    cancelled ? 'Cancelled' : share === 0 ? 'Open' : share < 1 ? 'Part Invoiced' : 'Fully Invoiced'

  return {
    no: `EST/26-27/${String(i + 1).padStart(4, '0')}`,
    date: inv.date, clientId: client.id, client: client.name,
    lines, value, status, raisedBy: STAFF[i % STAFF.length],
    links: share > 0 && !cancelled
      ? [{ invoiceNo: inv.no, date: inv.date, value: +(value * share).toFixed(2) }] : [],
    cancelReason: cancelled ? 'Customer did not confirm the size' : undefined,
  }
}).sort((a, b) => b.date.localeCompare(a.date))

export const invoicedValue = (e: Estimate) =>
  +e.links.reduce((s, l) => s + l.value, 0).toFixed(2)

export const openValue = (e: Estimate) =>
  e.status === 'Cancelled' ? 0 : +(e.value - invoicedValue(e)).toFixed(2)

export const ESTIMATE_SUMMARY = {
  total: ESTIMATES.length,
  open: ESTIMATES.filter(e => e.status === 'Open').length,
  part: ESTIMATES.filter(e => e.status === 'Part Invoiced').length,
  done: ESTIMATES.filter(e => e.status === 'Fully Invoiced').length,
  cancelled: ESTIMATES.filter(e => e.status === 'Cancelled').length,
  value: +ESTIMATES.reduce((s, e) => s + e.value, 0).toFixed(2),
  notInvoiced: +ESTIMATES.reduce((s, e) => s + openValue(e), 0).toFixed(2),
  asOn: TODAY,
}
