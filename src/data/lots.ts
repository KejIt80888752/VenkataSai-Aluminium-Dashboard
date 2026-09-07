/* ── One item, many weights ────────────────────────────────────────────────
   The same profile does not come off the press at the same weight twice. A
   2x1 Plain may run 1.10 kg a foot on one lot and 1.25 on the next, which is
   why separate inventory names get created for each weight — and why stock
   then stops adding up.

   The fix is to keep one item and let each lot carry its own weight per
   piece, worked out from the bundle weight on the supplier's DC. A sale then
   draws from lots newest first, and the weight it takes out is the weight
   that actually went in.                                                   */

import { P } from './catalogue'
import { SUPPLIERS } from './parties'
import { TODAY } from './company'

export interface Lot {
  id: string
  code: string
  name: string
  dcNo: string
  supplier: string
  date: string
  bundles: number
  nosPerBundle: number
  nos: number
  /** the weighbridge figure for this lot alone */
  weightKg: number
  /** derived, not typed — weightKg / nos */
  kgPerPiece: number
  stdKgPerPiece: number
  variancePct: number
  /** the weight range this lot falls in, as the counter would say it */
  band: string
  receivedNos: number
  remainingNos: number
  location: string
}

const LOCS = ['GD1', 'GD2', 'SHOP']

/** Lots are grouped into 0.05 kg steps — close enough to quote from. */
export const bandOf = (kgPerPiece: number) => {
  const lo = Math.floor(kgPerPiece / 0.05) * 0.05
  return `${lo.toFixed(2)}–${(lo + 0.05).toFixed(2)} kg`
}

/* Only extruded aluminium runs to weight; sheets and hardware do not. */
const BY_WEIGHT = P.filter(p => p.unit === 'kg' && p.kgPerLength > 0)

let seq = 0
export const LOTS: Lot[] = BY_WEIGHT.flatMap((p, pi) =>
  // Three to four lots per section, each off a different press run.
  Array.from({ length: 3 + (pi % 2) }, (_, li) => {
    seq++
    // Real presses drift; ±4% is an ordinary spread across runs.
    const drift = ((pi * 7 + li * 13) % 9 - 4) / 100
    const kgPerPiece = +(p.kgPerLength * (1 + drift)).toFixed(3)
    const nosPerBundle = [8, 10, 12, 15][(pi + li) % 4]
    const bundles = 4 + ((pi * 3 + li * 5) % 9)
    const nos = bundles * nosPerBundle
    const sup = SUPPLIERS[(pi + li) % SUPPLIERS.length]
    const d = new Date(TODAY)
    d.setDate(d.getDate() - (14 * li + (pi % 11)))
    // Older lots are further through; the newest is barely touched.
    const soldShare = li === 0 ? 0.05 : li === 1 ? 0.35 : li === 2 ? 0.7 : 0.9
    const remaining = Math.max(0, Math.round(nos * (1 - soldShare)))

    return {
      id: `LOT/26-27/${String(seq).padStart(4, '0')}`,
      code: p.code, name: p.name,
      dcNo: `${sup.name.slice(0, 3).toUpperCase()}/DC/${4400 + seq}`,
      supplier: sup.name,
      date: d.toISOString().slice(0, 10),
      bundles, nosPerBundle, nos,
      weightKg: +(nos * kgPerPiece).toFixed(1),
      kgPerPiece,
      stdKgPerPiece: p.kgPerLength,
      variancePct: +(drift * 100).toFixed(2),
      band: bandOf(kgPerPiece),
      receivedNos: nos,
      remainingNos: remaining,
      location: LOCS[(pi + li) % LOCS.length],
    }
  }),
)

export interface Pick {
  lotId: string
  dcNo: string
  band: string
  kgPerPiece: number
  nos: number
  kg: number
  date: string
  location: string
}

export interface Allocation {
  picks: Pick[]
  nos: number
  kg: number
  short: number          // pieces that could not be found
  bands: number          // how many weight ranges the sale had to draw from
  stdKg: number          // what the standard weight would have said
}

const open = (code: string, band?: string) =>
  LOTS.filter(l => l.code === code && l.remainingNos > 0 && (!band || l.band === band))
    // Newest first — LIFO, as set in the item master.
    .sort((a, b) => b.date.localeCompare(a.date))

/** Sell a number of pieces; the weight follows from the lots they come from. */
export function allocateByPieces(code: string, nos: number, band?: string): Allocation {
  let left = nos
  const picks: Pick[] = []
  for (const l of open(code, band)) {
    if (left <= 0) break
    const take = Math.min(left, l.remainingNos)
    picks.push({
      lotId: l.id, dcNo: l.dcNo, band: l.band, kgPerPiece: l.kgPerPiece,
      nos: take, kg: +(take * l.kgPerPiece).toFixed(2), date: l.date, location: l.location,
    })
    left -= take
  }
  const std = LOTS.find(l => l.code === code)?.stdKgPerPiece ?? 0
  return {
    picks,
    nos: nos - left,
    kg: +picks.reduce((s, p) => s + p.kg, 0).toFixed(2),
    short: left,
    bands: new Set(picks.map(p => p.band)).size,
    stdKg: +((nos - left) * std).toFixed(2),
  }
}

/** Sell a weight; the pieces follow from the lots that make it up. */
export function allocateByWeight(code: string, kg: number, band?: string): Allocation {
  let left = kg
  const picks: Pick[] = []
  for (const l of open(code, band)) {
    if (left <= 0.001) break
    const canTake = Math.min(Math.floor(left / l.kgPerPiece), l.remainingNos)
    if (canTake <= 0) continue
    picks.push({
      lotId: l.id, dcNo: l.dcNo, band: l.band, kgPerPiece: l.kgPerPiece,
      nos: canTake, kg: +(canTake * l.kgPerPiece).toFixed(2), date: l.date, location: l.location,
    })
    left = +(left - canTake * l.kgPerPiece).toFixed(3)
  }
  const std = LOTS.find(l => l.code === code)?.stdKgPerPiece ?? 0
  const nos = picks.reduce((s, p) => s + p.nos, 0)
  return {
    picks, nos,
    kg: +picks.reduce((s, p) => s + p.kg, 0).toFixed(2),
    short: +left.toFixed(2),
    bands: new Set(picks.map(p => p.band)).size,
    stdKg: +(nos * std).toFixed(2),
  }
}

/** Stock of one section, split by weight range — what a quotation needs. */
export function bandsFor(code: string) {
  const m = new Map<string, { band: string; nos: number; kg: number; lots: number; kgPerPiece: number }>()
  for (const l of LOTS.filter(x => x.code === code && x.remainingNos > 0)) {
    const e = m.get(l.band) ?? { band: l.band, nos: 0, kg: 0, lots: 0, kgPerPiece: l.kgPerPiece }
    e.nos += l.remainingNos
    e.kg = +(e.kg + l.remainingNos * l.kgPerPiece).toFixed(1)
    e.lots++
    m.set(l.band, e)
  }
  return [...m.values()].sort((a, b) => a.band.localeCompare(b.band))
}

export const LOT_ITEMS = [...new Map(LOTS.map(l => [l.code, l.name])).entries()]
  .map(([code, name]) => ({ code, name }))
