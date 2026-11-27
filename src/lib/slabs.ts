/* ── How a slab is written on paper ────────────────────────────────────────
   Theirs, on 27-11: "Tax Slab representation I asked for like 9/6 in
   description."

   The trade writes a slab as its two halves — 9/9 for the eighteen, 6/6 for
   the twelve, 2.5/2.5 for the five — because that is how CGST and SGST
   collect it. The small figure beside the amount gives the whole; the
   description now carries the split, so the customer can read the bill
   without being handed a tax table.

   A register may hold either side of the same slab: an estimate is written
   at the half the CGST column takes, and a tax invoice at the whole it adds
   up to. Both are read through here, so 9 and 18 print the same split.    */

export const WHOLE_SLAB: Record<number, number> = { 2.5: 5, 6: 12, 9: 18, 14: 28 }

/** The slab as a bill has to charge it, whichever half it was written at. */
export const wholeOf = (gst: number) => WHOLE_SLAB[gst] ?? gst

/** 2.5 not 2.50, 9 not 9.0 — the way it is written by hand. */
const trim = (n: number) => String(+n.toFixed(2))

/** "GST 9/9", or "IGST 18%" where the sale crosses the state line. */
export function slabTag(gst: number, inter = false): string | null {
  const whole = wholeOf(gst)
  if (!whole || whole <= 0) return 'GST nil'
  if (inter) return `IGST ${trim(whole)}%`
  const half = trim(whole / 2)
  return `GST ${half}/${half}`
}
