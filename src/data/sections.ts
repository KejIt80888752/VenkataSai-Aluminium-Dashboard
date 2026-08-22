/* ── Section profile master ─────────────────────────────────────────────
   Coatable extruded profiles carry two extra properties the trading
   catalogue doesn't need: the developed surface area used to bill powder
   coating per sqft, and the weight the profile is expected to gain on the
   coating line. Both are maintained here so a rate change lands in one
   place and flows to every challan, reconciliation and coating bill.     */

import { P, type Product } from './catalogue'

export interface SectionProfile {
  code: string
  /** developed (paintable) surface area per running foot, sqft */
  sqftPerFt: number
  /** weight the profile is expected to pick up on the line, % of raw weight */
  expectedGainPct: number
  /** tolerance either side before the reconciliation flags a variance */
  tolerancePct: number
}

/** Thin-walled profiles have more surface per kg, so they gain proportionally more. */
export const SECTION_PROFILES: SectionProfile[] = [
  { code: 'VSA-SL-2T-OF', sqftPerFt: 0.62, expectedGainPct: 4.2, tolerancePct: 1.0 },
  { code: 'VSA-SL-2T-SH', sqftPerFt: 0.48, expectedGainPct: 5.1, tolerancePct: 1.0 },
  { code: 'VSA-SL-3T-OF', sqftPerFt: 0.86, expectedGainPct: 3.8, tolerancePct: 0.9 },
  { code: 'VSA-SL-3T-SH', sqftPerFt: 0.52, expectedGainPct: 4.9, tolerancePct: 1.0 },
  { code: 'VSA-SL-2T-PW', sqftPerFt: 0.62, expectedGainPct: 4.2, tolerancePct: 1.0 },
  { code: 'VSA-SL-INTL',  sqftPerFt: 0.24, expectedGainPct: 6.4, tolerancePct: 1.4 },
  { code: 'VSA-OP-OF45',  sqftPerFt: 0.71, expectedGainPct: 4.0, tolerancePct: 0.9 },
  { code: 'VSA-OP-SH45',  sqftPerFt: 0.64, expectedGainPct: 4.5, tolerancePct: 1.0 },
  { code: 'VSA-OP-OFBK',  sqftPerFt: 0.71, expectedGainPct: 4.0, tolerancePct: 0.9 },
  { code: 'VSA-OP-BEAD',  sqftPerFt: 0.16, expectedGainPct: 7.1, tolerancePct: 1.6 },
  { code: 'VSA-PT-BOX',   sqftPerFt: 0.55, expectedGainPct: 4.4, tolerancePct: 1.0 },
  { code: 'VSA-PT-TPAT',  sqftPerFt: 0.30, expectedGainPct: 5.8, tolerancePct: 1.2 },
  { code: 'VSA-DR-FRM',   sqftPerFt: 0.78, expectedGainPct: 3.9, tolerancePct: 0.9 },
  { code: 'VSA-DR-WOOD',  sqftPerFt: 0.78, expectedGainPct: 3.9, tolerancePct: 0.9 },
  { code: 'VSA-LV-BLADE', sqftPerFt: 0.34, expectedGainPct: 5.6, tolerancePct: 1.2 },
  { code: 'VSA-LV-FRM',   sqftPerFt: 0.46, expectedGainPct: 4.8, tolerancePct: 1.0 },
]

export const profileOf = (code: string) => SECTION_PROFILES.find(s => s.code === code)
export const isCoatable = (code: string) => SECTION_PROFILES.some(s => s.code === code)

/** Products that pass through the coating line. */
export const COATABLE: Product[] = P.filter(p => isCoatable(p.code))

/** Developed area for a consignment: pieces × cut length × sqft per foot. */
export const sqftFor = (code: string, pieces: number, cutLengthFt: number) =>
  +(pieces * cutLengthFt * (profileOf(code)?.sqftPerFt ?? 0)).toFixed(1)
