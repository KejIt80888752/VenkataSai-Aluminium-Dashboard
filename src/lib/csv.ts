/* ── CSV reading and column detection ───────────────────────────────────
   The GST portal gives 2B as a spreadsheet and Tally exports the purchase
   register the same way. Saved as CSV, both can be read here in the
   browser — nothing is uploaded anywhere, the matching runs on the user's
   own machine.                                                           */

/** Split CSV text into rows, honouring quoted fields and embedded commas. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

/** GST returns carry a few banner rows above the real header — find it. */
export function findHeader(rows: string[][]): number {
  const wanted = ['gstin', 'ctin', 'invoice', 'bill', 'taxable', 'supplier', 'date']
  let best = 0, bestScore = -1
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const joined = rows[i].join(' ').toLowerCase()
    const score = wanted.filter(w => joined.includes(w)).length
    if (score > bestScore) { bestScore = score; best = i }
  }
  return bestScore >= 2 ? best : 0
}

export type Field = 'gstin' | 'supplier' | 'billNo' | 'billDate' | 'taxable' | 'cgst' | 'sgst' | 'igst' | 'tax'

/** Header words that identify each field, most specific first. */
const HINTS: Record<Field, string[]> = {
  gstin:    ['gstin of supplier', 'supplier gstin', 'ctin', 'gstin', 'gst no', 'gst number'],
  supplier: ['trade name', 'legal name', 'supplier name', 'party name', 'particulars', 'supplier', 'party', 'name'],
  billNo:   ['invoice number', 'invoice no', 'bill number', 'bill no', 'document number', 'doc no', 'inv no', 'voucher no'],
  billDate: ['invoice date', 'bill date', 'document date', 'date'],
  taxable:  ['taxable value', 'taxable amount', 'assessable value', 'taxable', 'net amount', 'basic'],
  cgst:     ['central tax', 'cgst'],
  sgst:     ['state/ut tax', 'state tax', 'sgst', 'utgst'],
  igst:     ['integrated tax', 'igst'],
  tax:      ['total tax', 'tax amount', 'gst amount'],
}

/** Best-guess column index for each field, -1 when nothing matches. */
export function detectColumns(header: string[]): Record<Field, number> {
  const norm = header.map(h => h.toLowerCase().replace(/[^a-z0-9/ ]/g, ' ').replace(/\s+/g, ' ').trim())
  const used = new Set<number>()
  const out = {} as Record<Field, number>

  for (const field of Object.keys(HINTS) as Field[]) {
    let found = -1
    for (const hint of HINTS[field]) {
      const exact = norm.findIndex((h, i) => !used.has(i) && h === hint)
      if (exact !== -1) { found = exact; break }
      const partial = norm.findIndex((h, i) => !used.has(i) && h.includes(hint))
      if (partial !== -1) { found = partial; break }
    }
    if (found !== -1) used.add(found)
    out[field] = found
  }
  return out
}

export const toNumber = (v: string | undefined) => {
  if (!v) return 0
  const n = Number(String(v).replace(/[₹,\s]/g, '').replace(/\((.*)\)/, '-$1'))
  return Number.isFinite(n) ? n : 0
}

/** Bill numbers are written inconsistently — compare them stripped down. */
export const normKey = (v: string | undefined) =>
  (v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

export interface SheetRow {
  gstin: string
  supplier: string
  billNo: string
  billDate: string
  taxable: number
  tax: number
  raw: string[]
}

export function toRows(rows: string[][], headerIdx: number, cols: Record<Field, number>): SheetRow[] {
  const pick = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '')
  return rows.slice(headerIdx + 1).map(r => {
    const split = toNumber(pick(r, cols.cgst)) + toNumber(pick(r, cols.sgst)) + toNumber(pick(r, cols.igst))
    return {
      gstin: pick(r, cols.gstin).toUpperCase().replace(/\s/g, ''),
      supplier: pick(r, cols.supplier),
      billNo: pick(r, cols.billNo),
      billDate: pick(r, cols.billDate),
      taxable: toNumber(pick(r, cols.taxable)),
      tax: split > 0 ? +split.toFixed(2) : toNumber(pick(r, cols.tax)),
      raw: r,
    }
  }).filter(r => r.billNo || r.gstin)
}

/* ── Matching ───────────────────────────────────────────────────────── */
export type MatchKind =
  | 'Matched' | 'Value Mismatch' | 'In Books, not in 2B' | 'In 2B, not in Books' | 'GSTIN Mismatch'

export interface MatchRow {
  key: string
  gstin: string
  supplier: string
  billNo: string
  billDate: string
  booksTaxable: number
  booksTax: number
  b2Taxable: number
  b2Tax: number
  diffTax: number
  status: MatchKind
}

/**
 * Pair the two sheets on GSTIN + bill number. Where a bill number matches but
 * the GSTIN does not, the supplier master is wrong rather than the bill being
 * missing — that is called out separately so it can be corrected once.
 */
export function matchSheets(books: SheetRow[], b2: SheetRow[], tolerance = 1): MatchRow[] {
  const b2ByFull = new Map<string, SheetRow>()
  const b2ByBill = new Map<string, SheetRow>()
  for (const r of b2) {
    b2ByFull.set(normKey(r.gstin) + '|' + normKey(r.billNo), r)
    b2ByBill.set(normKey(r.billNo), r)
  }

  const consumed = new Set<string>()
  const out: MatchRow[] = []

  for (const b of books) {
    const full = normKey(b.gstin) + '|' + normKey(b.billNo)
    const byBill = normKey(b.billNo)
    let hit = b2ByFull.get(full)
    let gstinOff = false
    if (!hit) { const alt = b2ByBill.get(byBill); if (alt) { hit = alt; gstinOff = true } }
    if (hit) consumed.add(normKey(hit.gstin) + '|' + normKey(hit.billNo))

    const diffTax = +((b.tax) - (hit?.tax ?? 0)).toFixed(2)
    const status: MatchKind =
      !hit ? 'In Books, not in 2B'
      : gstinOff ? 'GSTIN Mismatch'
      : Math.abs(b.taxable - hit.taxable) > tolerance || Math.abs(diffTax) > tolerance ? 'Value Mismatch'
      : 'Matched'

    out.push({
      key: full, gstin: b.gstin, supplier: b.supplier || hit?.supplier || '—',
      billNo: b.billNo, billDate: b.billDate,
      booksTaxable: b.taxable, booksTax: b.tax,
      b2Taxable: hit?.taxable ?? 0, b2Tax: hit?.tax ?? 0,
      diffTax: hit ? diffTax : b.tax,
      status,
    })
  }

  // Anything left in 2B was never entered in the books — that credit is going unclaimed.
  for (const r of b2) {
    const k = normKey(r.gstin) + '|' + normKey(r.billNo)
    if (consumed.has(k)) continue
    out.push({
      key: k, gstin: r.gstin, supplier: r.supplier || '—',
      billNo: r.billNo, billDate: r.billDate,
      booksTaxable: 0, booksTax: 0,
      b2Taxable: r.taxable, b2Tax: r.tax,
      diffTax: -r.tax,
      status: 'In 2B, not in Books',
    })
  }

  return out
}
