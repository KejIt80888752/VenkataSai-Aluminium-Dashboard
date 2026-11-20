/* ── What the shop charged last time ───────────────────────────────────────
   Asked for on 20-11-2026:

     "For invoice and quotation ERP should remember tax slab, rates and tax
      slab in general as per material."

   So a rate typed once is not typed again. When a product is picked, the rate
   and the slab it went out at last time come with it, and whoever is raising
   the document overrides them or leaves them alone.

   Two levels, because a product the shop has never sold still has a slab. The
   product's own last rate is used where there is one; failing that the slab
   most often used on that kind of material. Nothing is invented: a product
   nobody has ever priced comes back with no rate at all, and the form says so
   rather than filling in a figure somebody would have to notice and correct.

   This is memory, not a price list. When the real one arrives with a cost and
   a selling price against each code it takes precedence, and this goes on
   catching what the shop actually charged against what it meant to.        */

const KEY = 'vsa-rate-memory'

export interface Remembered {
  rate: number
  gst: number
  /** when it was last used, so the form can say how old the figure is */
  at: string
}

interface Memory {
  /** by product id — what that exact product last went out at */
  byProduct: Record<string, Remembered>
  /** by kind of material — the slab, where the product itself is new */
  byKind: Record<string, number>
}

const empty = (): Memory => ({ byProduct: {}, byKind: {} })

function read(): Memory {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const p = JSON.parse(raw)
    return { byProduct: p.byProduct ?? {}, byKind: p.byKind ?? {} }
  } catch { return empty() }
}

function write(m: Memory) {
  try { localStorage.setItem(KEY, JSON.stringify(m)) } catch { /* blocked or full */ }
}

/** What this product went out at last, if it ever has. */
export function recallRate(productId: string): Remembered | undefined {
  return productId ? read().byProduct[productId] : undefined
}

/** The slab this kind of material usually carries. */
export function recallSlab(kind: string): number | undefined {
  return read().byKind[kind]
}

/** Remembers one line's rate and slab. */
export function remember(productId: string, kind: string, rate: number, gst: number) {
  if (!productId) return
  const m = read()
  if (rate > 0) m.byProduct[productId] = { rate, gst, at: new Date().toISOString().slice(0, 10) }
  if (kind) m.byKind[kind] = gst
  write(m)
}

/** Remembers a whole document in one write. */
export function rememberAll(lines: { productId: string; kind: string; rate: number; gst: number }[]) {
  const m = read()
  const at = new Date().toISOString().slice(0, 10)
  for (const l of lines) {
    if (!l.productId) continue
    if (l.rate > 0) m.byProduct[l.productId] = { rate: l.rate, gst: l.gst, at }
    if (l.kind) m.byKind[l.kind] = l.gst
  }
  write(m)
}

/** How many products the shop has a remembered rate for. */
export const rememberedCount = () => Object.keys(read().byProduct).length

export const forgetAll = () => write(empty())
