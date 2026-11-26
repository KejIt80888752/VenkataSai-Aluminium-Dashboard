/* ── The price list, kept where they can fill it in ────────────────────────
   Since 20-11 every rate box on every document has opened empty, and the
   note under the table has said the same thing each time: send the product
   list with a cost and a selling price against each code and the rate will
   fill itself in. It has not come, and waiting on it has meant the shop
   typing a rate on every line of every quotation for a fortnight.

   They do not need to send it. The Product Catalogue is theirs to edit —
   code, selling rate, landed cost, slab — and this reads what is in it. Put
   a rate against a section once and every quotation, estimate, proforma and
   bill opens with it from then on.

   The catalogue is layered: the shipped rows underneath, and whatever the
   office has added or changed on top, kept the way every other register on
   this system keeps its changes. Both are read here, the office's figure
   winning, so a price corrected on the catalogue screen is the price the
   next document uses.                                                     */

import { P, type Product } from '@/data/catalogue'

const KEY = 'vsa-crud-products'

interface Overlay {
  added: Product[]
  edited: Record<string, Partial<Product>>
  deleted: string[]
}

function overlay(): Overlay {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { added: [], edited: {}, deleted: [] }
    const p = JSON.parse(raw)
    return { added: p.added ?? [], edited: p.edited ?? {}, deleted: p.deleted ?? [] }
  } catch { return { added: [], edited: {}, deleted: [] } }
}

/** The catalogue as the office has it — shipped rows with their changes on top. */
function catalogue(): Product[] {
  const o = overlay()
  const gone = new Set(o.deleted)
  /* The catalogue is keyed on code, which is how their own sheets key it. */
  return [...o.added, ...P]
    .filter(p => !gone.has(p.code))
    .map(p => (o.edited[p.code] ? { ...p, ...o.edited[p.code] } : p))
}

export interface Priced {
  /** what it is to be sold at, where somebody has said */
  rate: number
  /** the slab against it */
  gst: number
  /** what it landed at, for the margin */
  cost: number
}

/**
 * What a product is priced at, by the id the master knows it under.
 *
 * The master's id is the catalogue's id for everything built from it, so one
 * lookup answers both; a row the office added itself is found by its code.
 */
export function priceOf(productId: string, code?: string): Priced | undefined {
  if (!productId && !code) return undefined
  const rows = catalogue()
  const hit = rows.find(p => p.id === productId)
    ?? (code ? rows.find(p => p.code === code) : undefined)
  if (!hit || !hit.ratePerKg) return undefined
  return { rate: hit.ratePerKg, gst: hit.gst || 18, cost: hit.costPerKg || 0 }
}

/** How many products the catalogue carries a selling price for. */
export const pricedCount = () => catalogue().filter(p => p.ratePerKg > 0).length
