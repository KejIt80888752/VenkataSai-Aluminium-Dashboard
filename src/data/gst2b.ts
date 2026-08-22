/* ── GSTR-2B / 3B reconciliation ────────────────────────────────────────
   2B is what the portal says suppliers filed. The purchase register is what
   we booked. Credit is safe only where the two agree — this file pairs them
   and classifies every gap.                                               */

import { PURCHASES, TOTALS, MONTHS } from './txns'
import { SUPPLIERS } from './parties'

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20261120)
const between = (a: number, b: number) => a + rnd() * (b - a)
const iBetween = (a: number, b: number) => Math.floor(between(a, b + 1))
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]

export type MatchStatus =
  | 'Matched'
  | 'Value Mismatch'
  | 'In 2B, not in Books'
  | 'In Books, not in 2B'
  | 'GSTIN Mismatch'

export interface ReconRow {
  id: string
  month: string
  supplier: string
  gstin: string
  billNo: string
  billDate: string
  booksTaxable: number
  booksTax: number
  b2Taxable: number
  b2Tax: number
  diffTax: number
  status: MatchStatus
  /** what the accountant should actually do about it */
  action: string
  creditAvailable: boolean
}

const monthOf = (d: string) => MONTHS.find(m => d.startsWith(m.key))?.label ?? ''

/* Most bills tie exactly; a handful drift the way real filings do. */
export const RECON_ROWS: ReconRow[] = PURCHASES.map((p, i) => {
  const r = rnd()
  let status: MatchStatus = 'Matched'
  let b2Taxable = p.taxable
  let b2Tax = +(p.cgst + p.sgst + p.igst).toFixed(2)

  if (r < 0.71)      status = 'Matched'
  else if (r < 0.82) { status = 'Value Mismatch'; b2Taxable = Math.round(p.taxable * between(0.93, 1.06)); b2Tax = +(b2Taxable * 0.18).toFixed(2) }
  else if (r < 0.92) { status = 'In Books, not in 2B'; b2Taxable = 0; b2Tax = 0 }
  else               { status = 'GSTIN Mismatch' }

  const booksTax = +(p.cgst + p.sgst + p.igst).toFixed(2)
  return {
    id: `R${i + 1}`,
    month: monthOf(p.date),
    supplier: p.supplier,
    gstin: status === 'GSTIN Mismatch' ? p.gstin.slice(0, 12) + 'X' + p.gstin.slice(13) : p.gstin,
    billNo: p.no.replace('PB', 'SUP'),
    billDate: p.date,
    booksTaxable: p.taxable,
    booksTax,
    b2Taxable, b2Tax,
    diffTax: +(booksTax - b2Tax).toFixed(2),
    status,
    action:
      status === 'Matched' ? 'Claim credit'
      : status === 'Value Mismatch' ? 'Ask supplier to amend in next GSTR-1'
      : status === 'In Books, not in 2B' ? 'Hold credit — follow up with supplier'
      : 'Correct GSTIN in purchase master',
    creditAvailable: status === 'Matched',
  }
})

/* A few invoices appear in 2B that were never entered in the books. */
const EXTRA_IN_2B: ReconRow[] = Array.from({ length: 4 }, (_, i) => {
  const s = pick(SUPPLIERS)
  const taxable = Math.round(between(45000, 320000) / 100) * 100
  const tax = +(taxable * 0.18).toFixed(2)
  const m = pick(MONTHS)
  return {
    id: `X${i + 1}`,
    month: m.label,
    supplier: s.name,
    gstin: s.gstin,
    billNo: `SUP/${iBetween(1000, 9999)}`,
    billDate: `${m.key}-${String(iBetween(1, m.days)).padStart(2, '0')}`,
    booksTaxable: 0, booksTax: 0,
    b2Taxable: taxable, b2Tax: tax,
    diffTax: -tax,
    status: 'In 2B, not in Books',
    action: 'Locate the bill and book it — credit is available',
    creditAvailable: false,
  }
})

export const ALL_RECON = [...RECON_ROWS, ...EXTRA_IN_2B].sort((a, b) => b.billDate.localeCompare(a.billDate))

export const RECON_SUMMARY = (() => {
  const by = (s: MatchStatus) => ALL_RECON.filter(r => r.status === s)
  return {
    total: ALL_RECON.length,
    matched: by('Matched').length,
    valueMismatch: by('Value Mismatch').length,
    missingIn2B: by('In Books, not in 2B').length,
    missingInBooks: by('In 2B, not in Books').length,
    gstinMismatch: by('GSTIN Mismatch').length,
    creditSafe: +by('Matched').reduce((s, r) => s + r.booksTax, 0).toFixed(2),
    creditAtRisk: +[...by('In Books, not in 2B'), ...by('GSTIN Mismatch')].reduce((s, r) => s + r.booksTax, 0).toFixed(2),
    creditUnclaimed: +by('In 2B, not in Books').reduce((s, r) => s + r.b2Tax, 0).toFixed(2),
    matchRate: Math.round((by('Matched').length / ALL_RECON.length) * 100),
  }
})()

/* ── 3B vs books, month by month ────────────────────────────────────── */
export interface Gstr3bRow {
  month: string
  outputBooks: number
  outputFiled: number
  itcBooks: number
  itcClaimed: number
  netBooks: number
  netFiled: number
  diff: number
  status: 'Reconciled' | 'Under Review' | 'Not Filed'
}

export const GSTR3B: Gstr3bRow[] = MONTHS.map((m, i) => {
  const monthKey = m.key
  const inv = PURCHASES.filter(p => p.date.startsWith(monthKey))
  const itcBooks = +inv.reduce((s, p) => s + p.cgst + p.sgst + p.igst, 0).toFixed(2)
  const outputBooks = +TOTALS.outputGst / MONTHS.length
  const filed = i < MONTHS.length - 1
  const drift = filed ? between(-0.008, 0.004) : 0
  const outputFiled = filed ? +(outputBooks * (1 + drift)).toFixed(2) : 0
  const itcClaimed = filed ? +(itcBooks * (1 + between(-0.05, 0))).toFixed(2) : 0
  return {
    month: m.label,
    outputBooks: +outputBooks.toFixed(2),
    outputFiled,
    itcBooks,
    itcClaimed,
    netBooks: +(outputBooks - itcBooks).toFixed(2),
    netFiled: +(outputFiled - itcClaimed).toFixed(2),
    diff: +((outputBooks - itcBooks) - (outputFiled - itcClaimed)).toFixed(2),
    status: !filed ? 'Not Filed' : Math.abs(outputBooks - outputFiled) < 500 ? 'Reconciled' : 'Under Review',
  }
})
