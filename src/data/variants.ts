/* ── Cross-section codes, cut lengths and colours ──────────────────────────
   The client confirmed on 13-11-2026 that SP, DP and DV are codes *per
   cross section*, not per length — one die, many cut lengths. They then
   raised the worry that follows from it:

     "If we have to give each code differently then we have to add cut
      length and colour post that code. I thought we shall manage with
      keyword."

   They do not have to. A cut length and a colour are properties of a piece,
   not of a section, so they belong in their own columns rather than glued
   onto the code. The section master stays exactly as long as their list of
   dies — four codes stay four codes — while stock is still counted per
   length and per colour, because the combination is formed here at runtime
   instead of being typed by hand.

   The difference matters at the scale they work at. Four sections, six cut
   lengths and six colours is 144 stock lines. Asking a man at a counter to
   maintain 144 codes is how a code list dies; asking him to pick a section,
   a length and a colour is three taps.                                    */

export interface CrossSection {
  /** the client's own code, as written on the despatch sheet */
  code: string
  /** what it is, in the client's words — filled in as they confirm each one */
  name: string | null
  /** kg per running foot of this die; null until enough clean rows confirm it */
  kgPerFt: number | null
  /** the numeric code the coating sheets use for the same die, once known */
  coatingCode: string | null
  confirmed: boolean
}

/*
 * On the 13-02 despatch sheet the weights do not all tie to one kg/ft per
 * code, which is what a single die would give. Fitting each code's rows:
 *
 *   DP   worst row  6.7% out   — within reach of mill tolerance and rounding
 *   SP   worst row 10.8% out   — marginal
 *   DV   worst row 24.1% out   — cannot be one die
 *
 * DV's three rows imply 8.2, 8.4 and 9.1 ft against written lengths of 7, 11
 * and 8. The suspect row is 11ft / 23 pieces / 28.88 kg. These figures were
 * read off a photograph of the sheet, so the length column is as likely to be
 * mis-read as the sheet is to be wrong. It is left alone and flagged rather
 * than silently corrected: guessing a length here would quietly corrupt the
 * weight per piece for every DV job that follows.
 */
export const CROSS_SECTIONS: CrossSection[] = [
  { code: 'SP',   name: null,    kgPerFt: null,  coatingCode: null,    confirmed: false },
  { code: 'DP',   name: null,    kgPerFt: null,  coatingCode: null,    confirmed: false },
  { code: 'DV',   name: null,    kgPerFt: null,  coatingCode: null,    confirmed: false },
  { code: 'CUPC', name: 'Clips', kgPerFt: null,  coatingCode: '19382', confirmed: true  },
]

/** Cut lengths seen on the client's own sheets. Not a fixed list — a row may
    carry any length, and an unseen one simply joins the list. */
export const CUT_LENGTHS = [7, 8, 9, 10, 11, 12, 14, 15, 16] as const

/** Colours from the coating book. W/O is the uncoated state, not a colour. */
export const FINISHES = [
  { code: 'W/O', name: 'Uncoated — as it comes from the mill', isRaw: true  },
  { code: 'IV',  name: 'Ivory',             isRaw: false },
  { code: 'CB',  name: 'Coffee Brown',      isRaw: false },
  { code: 'PGG', name: 'Pista Green Glossy', isRaw: false },
  { code: 'BL',  name: 'Black',             isRaw: false },
  { code: 'WH',  name: 'White',             isRaw: false },
] as const

export interface Variant {
  section: string
  lengthFt: number
  finish: string
  /** what the software holds internally — never typed by anyone */
  key: string
  /** what a person sees and picks */
  label: string
}

/** Builds the stock line for one combination. The key is derived, so the
    client's code list never grows when a new length or colour appears. */
export function variantOf(section: string, lengthFt: number, finish: string): Variant {
  return {
    section, lengthFt, finish,
    key: `${section}-${lengthFt}-${finish}`.toUpperCase(),
    label: `${section} · ${lengthFt}ft · ${finish}`,
  }
}

/** How many stock lines a given code list produces, without adding any codes. */
export function variantCount(sections: number, lengths: number, finishes: number) {
  return sections * lengths * finishes
}

/**
 * Weight of one piece, from the die's kg/ft and the cut length. This is the
 * whole reason a length column beats a length baked into the code: one
 * number per die covers every length it is ever cut to.
 */
export function pieceKg(kgPerFt: number, lengthFt: number) {
  return +(kgPerFt * lengthFt).toFixed(3)
}
