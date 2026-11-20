/* ── What goes at the foot of a document ───────────────────────────────────
   Given word for word on 20-11-2026, and different for an offer than for a
   bill, because they are doing different jobs. A quotation is protecting a
   price and a weight that have not been agreed yet; a tax invoice is
   protecting goods that have already left the yard.

   They are the starting point, not the law: "need to option add or modify
   terms and conditions". Every document opens with the ones for its kind and
   they can be changed on it before it goes out, so a job with its own payment
   arrangement does not need a different system.                           */

export type TermsKind = 'Quotation' | 'Estimate' | 'Proforma Invoice' | 'Tax Invoice' | 'Purchase Bill'

/** Theirs, for anything quoted but not yet supplied. */
const OFFER = [
  'Rate valid for today only.',
  'Weight +/- 7% to be borne by customer.',
  '100% payment in advance.',
]

/** Theirs, for goods that have gone out against a bill. */
const INVOICE = [
  'Goods once sold cannot be taken back or exchanged.',
  '24% interest will be charged in case payment is not made within allowed credit period.',
  'We do not accept any responsibility for losses, damages or shortage during transit.',
  'All disputes are subjected to Bengaluru Jurisdiction.',
]

export const DEFAULT_TERMS: Record<TermsKind, string[]> = {
  'Quotation':        OFFER,
  'Estimate':         OFFER,
  'Proforma Invoice': OFFER,
  'Tax Invoice':      INVOICE,
  /* A purchase bill is the supplier's document; we carry no terms onto it. */
  'Purchase Bill':    [],
}

/** A block of typed text back into lines, with the blanks dropped. */
export const termsFromText = (text: string): string[] =>
  text.split('\n').map(t => t.trim()).filter(Boolean)

export const termsToText = (terms: string[]): string => terms.join('\n')
