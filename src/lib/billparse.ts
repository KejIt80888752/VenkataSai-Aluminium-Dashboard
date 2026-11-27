/* ── A read line, turned back into a line of the counter book ──────────────
   Theirs, on 27-11: "ella bill upload panna varanum."

   What the reader hands back is a row of words and numbers in the order
   they sit on the paper:

       SP      12'     20      45.320
       1. DP   10 ft   15      28.100

   Which number is which is settled by what is written beside it, not by its
   position, because no two depots rule their columns the same way. A number
   with feet after it is a length. A number with a point in it, at the end of
   the row, is the weight — a depot writes 45.320 and never 45 for the kilos.
   What is left over and counted in whole pieces is the quantity, and the
   word at the front is the shorthand.

   Where that reasoning does not hold, the field is left empty and marked
   rather than guessed. A wrong weight per piece quietly spoils every job cut
   from that section afterwards, and a blank asks a question where a wrong
   figure answers one nobody asked.                                         */

import type { ReadLine } from '@/lib/readpaper'

export interface Candidate {
  id: string
  /** the line exactly as it was read, so the office can see what it is judging */
  raw: string
  written: string
  lengthFt: string
  pieces: number
  netWeightKg: number
  /** 0–100 from the reader */
  confidence: number
  /** fields the reasoning could not settle */
  unsure: string[]
}

/* The reader turns a 0 into an O and a 1 into an l often enough that it is
   worth putting them back before anything is read as a number. */
const digits = (w: string) =>
  w.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1').replace(/[,]/g, '')

const FEET = /^(\d{1,2}(?:\.\d+)?)\s*(?:'|’|ft|feet|foot)$/i
const DECIMAL = /^\d{1,4}\.\d{1,3}$/
const WHOLE = /^\d{1,4}$/
/* A serial at the head of the row — 1, 1., 01) — is the depot's numbering. */
const SERIAL = /^\d{1,3}[.)]?$/

/** Not a line of goods: headers, totals, addresses, the date line. */
const NOISE = new RegExp([
  '\\b(total|gst|gstin|invoice|challan|date|signature|driver|vehicle|page|amount|rupees|tax',
  '|qty|weight|particulars|description|sl|s\\.no|dc\\s*no|bill\\s*no|order\\s*no|ph|phone|mobile)\\b',
].join(''), 'i')

export function candidatesFrom(lines: ReadLine[]): Candidate[] {
  const out: Candidate[] = []
  lines.forEach((line, i) => {
    const raw = line.text.trim()
    if (!raw || NOISE.test(raw)) return

    const words = raw.split(/\s+/).filter(Boolean)
    if (words.length < 2) return

    /* The depot's own serial is dropped, but only from the head of the row. */
    const body = SERIAL.test(words[0]) && words.length > 2 ? words.slice(1) : words

    let lengthFt = ''
    let pieces = 0
    let kg = 0
    const left: string[] = []
    const numbers: { value: number; at: number; decimal: boolean }[] = []

    for (let w = 0; w < body.length; w++) {
      const word = body[w]
      const clean = digits(word)

      /* 12' and 12 ft, whether the depot wrote them joined or apart. */
      const feet = clean.match(FEET)
        ?? (WHOLE.test(clean) && /^(?:'|’|ft|feet|foot)$/i.test(body[w + 1] ?? '')
          ? [clean, clean] as unknown as RegExpMatchArray : null)
      if (feet) {
        if (!lengthFt) lengthFt = `${feet[1]}'`
        if (FEET.test(clean) === false) w++        // the unit was its own word
        continue
      }

      if (DECIMAL.test(clean)) { numbers.push({ value: Number(clean), at: w, decimal: true }); continue }
      if (WHOLE.test(clean))   { numbers.push({ value: Number(clean), at: w, decimal: false }); continue }
      left.push(word)
    }

    /* The weight carries its decimals and sits last; the count is whole. */
    const decimals = numbers.filter(n => n.decimal)
    if (decimals.length) kg = decimals[decimals.length - 1].value
    const wholes = numbers.filter(n => !n.decimal)
    if (wholes.length) pieces = wholes[0].value
    /* No decimal anywhere, two whole numbers: the second is the weight, the
       way a depot writes a round lot — 20 and 45. */
    if (!kg && wholes.length > 1) kg = wholes[wholes.length - 1].value

    const written = left.join(' ').replace(/[^A-Za-z0-9 /&.-]/g, '').trim().toUpperCase()
    if (!written) return

    /* ── A heading is not a line of goods ─────────────────────────────
       The name at the top of the bill and the address under it come back
       from the reader looking like rows, because on the paper they are
       rows. Neither carries a count or a weight, and nothing the shop
       supplies is written without one or the other. */
    if (!pieces && !kg) return

    const unsure: string[] = []
    if (!pieces) unsure.push('pieces')
    if (!kg) unsure.push('weight')
    if (!lengthFt) unsure.push('length')
    if (line.confidence < 70) unsure.push('reading')

    out.push({
      id: `c-${i}-${Math.random().toString(36).slice(2, 6)}`,
      raw, written, lengthFt, pieces, netWeightKg: kg,
      confidence: line.confidence, unsure,
    })
  })
  return out
}

/** What one piece weighs — the figure the whole exercise is for. */
export const perPieceOf = (c: Candidate) =>
  c.pieces > 0 ? +(c.netWeightKg / c.pieces).toFixed(3) : 0
