/* ── Supplier's own statement against our purchase register ────────────────
   Suppliers post a statement every month and it rarely agrees with our books.
   The value is not the list of bills — it is the single number at the bottom
   and a line-by-line account of exactly what makes it up.                  */

import { PURCHASES } from './txns'
import { SUPPLIERS } from './parties'

export type LedgerKind =
  | 'Matched'
  | 'Amount Differs'
  | 'Not in Our Books'
  | 'Not in Their Statement'
  | 'Payment Not Credited'

export interface LedgerRow {
  billNo: string
  date: string
  kind: LedgerKind
  ours: number       // what our purchase register carries
  theirs: number     // what their statement carries
  effect: number     // how much this row pushes their closing above ours
  note: string
}

export interface SupplierLedger {
  supplierId: string
  supplier: string
  gstin: string
  rows: LedgerRow[]
  ourClosing: number
  theirClosing: number
  difference: number
  toResolve: number
}

const ACTION: Record<LedgerKind, string> = {
  'Matched':                'Agreed — no action',
  'Amount Differs':         'Compare rate and freight on this bill',
  'Not in Our Books':       'Bill never reached us — ask for a copy, then book it',
  'Not in Their Statement': 'We have booked it — ask why it is missing on their side',
  'Payment Not Credited':   'Payment sent but not credited — send UTR and bank advice',
}

/** Deterministic, so the same supplier always shows the same disagreement. */
function build(supplierId: string): SupplierLedger {
  const sup   = SUPPLIERS.find(s => s.id === supplierId)!
  const bills = PURCHASES.filter(p => p.supplierId === supplierId)

  const billRows: (LedgerRow & { paid: number })[] = bills.map((p, i) => {
    const base = { billNo: p.no, date: p.date, paid: p.paid }
    // A rate or freight difference the two sides carry differently.
    if (i % 7 === 3) {
      const theirs = Math.round(p.total * 1.018)
      return { ...base, kind: 'Amount Differs', ours: p.total, theirs,
               effect: theirs - p.total, note: ACTION['Amount Differs'] }
    }
    // They have raised it; it never got entered on our side, so we paid nothing.
    if (i % 11 === 5) {
      return { ...base, paid: 0, kind: 'Not in Our Books', ours: 0, theirs: p.total,
               effect: p.total, note: ACTION['Not in Our Books'] }
    }
    // We have booked it; their statement does not show it.
    if (i % 13 === 8) {
      return { ...base, kind: 'Not in Their Statement', ours: p.total, theirs: 0,
               effect: -p.total, note: ACTION['Not in Their Statement'] }
    }
    return { ...base, kind: 'Matched', ours: p.total, theirs: p.total,
             effect: 0, note: ACTION['Matched'] }
  })

  // Payments we have made against bills we booked, which their statement has
  // not picked up yet. These sit as separate rows, not against a bill value.
  const payRows: LedgerRow[] = billRows
    .filter((r, i) => r.paid > 0 && r.ours > 0 && i % 9 === 4)
    .map(r => ({
      billNo: `PAY/${r.billNo.split('/').pop()}`, date: r.date, kind: 'Payment Not Credited',
      ours: 0, theirs: 0, effect: r.paid, note: ACTION['Payment Not Credited'],
    }))

  const oursTotal    = billRows.reduce((s, r) => s + r.ours, 0)
  const theirsTotal  = billRows.reduce((s, r) => s + r.theirs, 0)
  const ourPaid      = billRows.filter(r => r.ours > 0).reduce((s, r) => s + r.paid, 0)
  const notCredited  = payRows.reduce((s, r) => s + r.effect, 0)

  const ourClosing   = oursTotal   - ourPaid
  const theirClosing = theirsTotal - (ourPaid - notCredited)

  const rows = [...billRows.map(({ paid, ...r }) => r), ...payRows]

  return {
    supplierId, supplier: sup.name, gstin: sup.gstin, rows,
    ourClosing, theirClosing,
    difference: theirClosing - ourClosing,
    toResolve: rows.filter(r => r.kind !== 'Matched').length,
  }
}

export const SUPPLIER_LEDGERS: SupplierLedger[] = SUPPLIERS
  .map(s => build(s.id))
  .filter(l => l.rows.length > 0)

export const LEDGER_ACTION = ACTION
