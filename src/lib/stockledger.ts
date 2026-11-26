/* ── What is actually on the floor ─────────────────────────────────────────
   Theirs, on 22-11, about clips and L angles: "in stock qty and weight
   reduces."

   Until now nothing moved. A bill went out, a lorry came in, and the figure
   on the stock screen sat exactly where it had been put — which makes a
   stock screen worse than no stock screen, because somebody will trust it.

   So stock is not a number that is stored and edited. It is worked out, the
   way a ledger is: what was there to begin with, plus what has come in,
   less what has gone out. Each part comes from a book the shop already
   keeps, so nothing has to be entered twice and nothing can drift:

     opening   the figure against the product in the catalogue — the only
               part somebody types, once
     received  the purchase DCs, which is every lorry that has arrived
     issued    the tax invoices, which is every lorry that has left

   Pieces and kilos both, because they sell both ways and a section leaves
   the yard as a count and is paid for by the kilo.                       */

import type { Invoice, Line } from '@/data/txns'

export interface Movement {
  nos: number
  kg: number
}

export interface Position {
  opening: Movement
  received: Movement
  issued: Movement
  onHand: Movement
}

const zero = (): Movement => ({ nos: 0, kg: 0 })

const add = (a: Movement, b: Movement): Movement => ({
  nos: +(a.nos + b.nos).toFixed(3),
  kg: +(a.kg + b.kg).toFixed(3),
})

const less = (a: Movement, b: Movement): Movement => ({
  nos: +(a.nos - b.nos).toFixed(3),
  kg: +(a.kg - b.kg).toFixed(3),
})

/* ── What one document line moved ──────────────────────────────────────────
   A line carries its count and, where it has one, its weight. The summary
   lines — the metal priced by total weight, the one coating charge — are not
   material and move nothing: the metal is the sections it was cut into,
   counted on their own lines, and the coating is a job done to them.      */
const movedBy = (l: Line): Movement | null => {
  if (!l.productId) return null
  if (l.group === 'aluminium') return null
  if (l.group === 'coating' && !l.productId) return null
  return {
    nos: l.nos ?? (l.unit === 'kg' ? 0 : l.qty),
    kg: l.kg ?? (l.unit === 'kg' ? l.qty : 0),
  }
}

/** Everything that has gone out against a bill, by product. */
export function issuedByProduct(invoices: Invoice[]): Map<string, Movement> {
  const out = new Map<string, Movement>()
  for (const inv of invoices) {
    for (const l of inv.lines) {
      const m = movedBy(l)
      if (!m || !l.productId) continue
      out.set(l.productId, add(out.get(l.productId) ?? zero(), m))
    }
  }
  return out
}

/** Everything that has arrived on a purchase DC, by product. */
export function receivedByProduct(
  sheets: { rows: { productId: string; nos: number; kg: number | null }[] }[],
): Map<string, Movement> {
  const into = new Map<string, Movement>()
  for (const s of sheets) {
    for (const r of s.rows) {
      if (!r.productId) continue
      into.set(r.productId, add(into.get(r.productId) ?? zero(), {
        nos: r.nos ?? 0,
        kg: r.kg ?? 0,
      }))
    }
  }
  return into
}

/**
 * Where one product stands.
 *
 * @param opening what somebody typed against it in the catalogue
 */
export function positionOf(
  productId: string,
  opening: Movement,
  received: Map<string, Movement>,
  issued: Map<string, Movement>,
): Position {
  const inn = received.get(productId) ?? zero()
  const out = issued.get(productId) ?? zero()
  return {
    opening,
    received: inn,
    issued: out,
    onHand: less(add(opening, inn), out),
  }
}
