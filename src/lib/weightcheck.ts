/* ── Three opinions about what a lot should weigh ──────────────────────────
   Theirs, on 22-11:

     "Weight mismatch alert should come. i.e 3 checks: one from standard
      weight ranges given, previous purchase DC, and coating weight per kg.
      Tolerance: 2-3%."

   The three are not the same number and that is the whole point. The weight
   range is what the mill says a section ought to weigh — the nominal. The
   purchase DC is what the last lorry of it actually weighed at the depot.
   The coating book is what came back off the coater's scale, which carries
   the powder as well and so reads a shade heavy.

   A lot that agrees with all three is a lot nobody needs to look at. One
   that is five per cent under the depot's own figure is either short weight
   or a wrong length on the line, and either way somebody should be told
   before the bill goes out rather than after.

   Nothing is corrected here. The figure typed is the figure used; this only
   says which of their own records it disagrees with and by how much.     */

import type { BuiltLine } from '@/components/DocBuilder'
import { isAluminium } from '@/components/DocBuilder'
import { productById, pieceKgAt, masterIdOf } from '@/data/productmaster'
import { SAMPLE_DC } from '@/data/despatch'
import { OPENING, LOADED, RECEIVED, apportioned, type CoatLine } from '@/data/coatbook'
import { loadAliases } from '@/lib/aliases'

/** Theirs: "tolerance 2-3%". Under three per cent nobody is told anything. */
export const TOLERANCE_PCT = 3

export interface Opinion {
  /** where the figure comes from, in their own words */
  source: string
  /** what this source says the lot should weigh, or null where it is silent */
  kg: number | null
  /** how far the typed figure is from it, as a percentage */
  offPct: number | null
}

/* ── What a piece of each product weighs, by each record ────────────────── */

/** The nominal — the master's own figure, built out of their coating sheets. */
const fromRange = (productId: string, lengthFt: number) =>
  pieceKgAt(productId, lengthFt)

/* ── The last purchase DC ──────────────────────────────────────────────────
   Their February depot sheet writes a shorthand — SP, DP, DIV, CUPC — and
   the length in its own column, so a line is matched by whichever section
   that shorthand has been pointed at and the feet written beside it.      */
const dcPerPiece = (() => {
  const by = new Map<string, { kg: number; nos: number }>()
  const aliases = loadAliases()
  for (const l of SAMPLE_DC.lines) {
    if (!l.pieces || !l.netWeightKg) continue
    const key = `${(aliases[`depot:${l.particulars.toLowerCase()}`] ?? l.particulars).toUpperCase()}|${parseFloat(l.lengthFt) || 0}`
    const at = by.get(key) ?? { kg: 0, nos: 0 }
    at.kg += l.netWeightKg
    at.nos += l.pieces
    by.set(key, at)
  }
  return by
})()

const fromPurchaseDc = (productId: string, lengthFt: number) => {
  const p = productById(productId)
  if (!p) return null
  /* The depot's shorthand points at a cross section; the master row points
     back at a code. Either spelling finds the same lorry. */
  for (const key of [`X:${p.code}:${p.groove}|${lengthFt}`, `${p.code}|${lengthFt}`]) {
    const at = dcPerPiece.get(key.toUpperCase())
    if (at && at.nos > 0) return +(at.kg / at.nos).toFixed(3)
  }
  return null
}

/* ── The coating book ──────────────────────────────────────────────────────
   Every weighed line of that product across their three sheets, with the
   shared weighments split by piece count first — otherwise the line that
   happens to carry the figure reads heavy and the ones under it read as
   nothing.                                                               */
const coatPerPiece = (() => {
  const by = new Map<string, { kg: number; nos: number }>()
  for (const sheet of [OPENING, LOADED, RECEIVED] as CoatLine[][]) {
    const split = apportioned(sheet)
    for (const l of sheet) {
      const id = masterIdOf(l)
      const kg = split.get(l)
      if (!id || !kg || !l.nos) continue
      const at = by.get(id) ?? { kg: 0, nos: 0 }
      at.kg += kg
      at.nos += l.nos
      by.set(id, at)
    }
  }
  return by
})()

const fromCoatingBook = (productId: string) => {
  const at = coatPerPiece.get(productId)
  return at && at.nos > 0 ? +(at.kg / at.nos).toFixed(3) : null
}

/** Adds up what one source says the whole lot should weigh. */
function expected(
  lines: BuiltLine[],
  per: (l: BuiltLine) => number | null,
): number | null {
  let total = 0
  let any = false
  for (const l of lines) {
    if (!isAluminium(l) || !l.nos) continue
    const kg = per(l)
    if (kg === null) continue
    total += kg * l.nos
    any = true
  }
  return any ? +total.toFixed(3) : null
}

/**
 * What their three records say, against the weight on the document.
 *
 * @param lines  the sections on it, with their piece counts
 * @param typed  the weight somebody put against the aluminium
 */
export function weightOpinions(lines: BuiltLine[], typed: number): Opinion[] {
  const picked = lines.filter(l => l.productId)
  const off = (kg: number | null) =>
    kg !== null && kg > 0 && typed > 0 ? +(((typed - kg) / kg) * 100).toFixed(1) : null

  const sources: { source: string; kg: number | null }[] = [
    {
      source: 'Weight range',
      kg: expected(picked, l => fromRange(l.productId, productById(l.productId)?.lengthFt ?? 0)),
    },
    {
      source: 'Last purchase DC',
      kg: expected(picked, l => fromPurchaseDc(l.productId, productById(l.productId)?.lengthFt ?? 0)),
    },
    {
      source: 'Coating book',
      kg: expected(picked, l => fromCoatingBook(l.productId)),
    },
  ]
  return sources.map(s => ({ ...s, offPct: off(s.kg) }))
}

/* ── One band, not three verdicts ─────────────────────────────────────────
   Theirs, on 22-11: "tolerance not working properly."

   It was judging the typed weight against each record separately and
   complaining about every one it missed — so a lot that agreed with the
   depot but read heavy against the coating book, which it always will
   because the coating book weighs the powder too, was flagged twice for
   being exactly right.

   The three are now read as what they are: a band. The lot is in order if
   it falls anywhere between the lowest of them less the tolerance and the
   highest plus it. Outside that band something is genuinely wrong — a
   length on the wrong line, a count mistyped, or short weight.          */
export interface Band {
  low: number
  high: number
  ok: boolean
  /** how far outside the band, where it is outside */
  offPct: number | null
}

export function toleranceBand(ops: Opinion[], typed: number): Band | null {
  const known = ops.map(o => o.kg).filter((k): k is number => k !== null && k > 0)
  if (!known.length || typed <= 0) return null
  const low = +(Math.min(...known) * (1 - TOLERANCE_PCT / 100)).toFixed(3)
  const high = +(Math.max(...known) * (1 + TOLERANCE_PCT / 100)).toFixed(3)
  const ok = typed >= low && typed <= high
  const against = typed < low ? low : high
  return { low, high, ok, offPct: ok ? null : +(((typed - against) / against) * 100).toFixed(1) }
}

/** The ones far enough out to be worth saying something about. */
export const outOfTolerance = (ops: Opinion[]) =>
  ops.filter(o => o.offPct !== null && Math.abs(o.offPct) > TOLERANCE_PCT)
