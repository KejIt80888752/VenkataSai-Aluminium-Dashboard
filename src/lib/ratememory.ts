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
  /* ── What this customer was charged ─────────────────────────────────────
     Theirs, on 22-11: "in each section it should remember previous charged
     rate as per customer."

     Which is how a trade counter actually works. A builder who takes forty
     tonnes a year is not quoted what a one-off fabricator is quoted, and the
     man at the counter is expected to remember that. Keyed by the customer's
     name and the product, it is tried before the general figure. */
  byCustomer: Record<string, Record<string, Remembered>>
}

const empty = (): Memory => ({ byProduct: {}, byKind: {}, byCustomer: {} })

function read(): Memory {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const p = JSON.parse(raw)
    return { byProduct: p.byProduct ?? {}, byKind: p.byKind ?? {}, byCustomer: p.byCustomer ?? {} }
  } catch { return empty() }
}

function write(m: Memory) {
  try { localStorage.setItem(KEY, JSON.stringify(m)) } catch { /* blocked or full */ }
}

/** The key a customer is remembered under — their name, however typed. */
const whose = (customer?: string) => (customer || '').trim().toLowerCase()

/**
 * What this product went out at last.
 *
 * This customer's own last rate first, where there is one, because that is
 * the figure they will argue from; then the general one.
 */
export function recallRate(productId: string, customer?: string): Remembered | undefined {
  if (!productId) return undefined
  const m = read()
  const mine = whose(customer) ? m.byCustomer[whose(customer)]?.[productId] : undefined
  return mine ?? m.byProduct[productId]
}

/** True where the figure came from this customer's own history. */
export function recalledFromCustomer(productId: string, customer?: string): boolean {
  if (!productId || !whose(customer)) return false
  return !!read().byCustomer[whose(customer)]?.[productId]
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
  /* ── Nought is never learned ──────────────────────────────────────────
     A slab of nought is a decision about one line — something quoted
     outside GST — not a standing rule for everything of that kind. This
     remembered it anyway, so one such line taught every later section to
     open untaxed, and their quotation to SDM Interiors went out with
     ₹1,392 of coating at 0% beside metal at 18%. A real slab is
     remembered; nought is left where it was typed.                      */
  if (kind && gst > 0) m.byKind[kind] = gst
  write(m)
}

/** Remembers a whole document in one write. */
export function rememberAll(
  lines: { productId: string; kind: string; rate: number; gst: number }[],
  customer?: string,
) {
  const m = read()
  const at = new Date().toISOString().slice(0, 10)
  const who = whose(customer)
  if (who && !m.byCustomer[who]) m.byCustomer[who] = {}
  for (const l of lines) {
    if (!l.productId) continue
    if (l.rate > 0) {
      m.byProduct[l.productId] = { rate: l.rate, gst: l.gst, at }
      if (who) m.byCustomer[who][l.productId] = { rate: l.rate, gst: l.gst, at }
    }
    if (l.kind) m.byKind[l.kind] = l.gst
  }
  write(m)
}

/** How many products the shop has a remembered rate for. */
export const rememberedCount = () => Object.keys(read().byProduct).length

export const forgetAll = () => write(empty())
