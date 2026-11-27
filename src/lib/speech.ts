/* ── Spoken text → a quantity and a product code ────────────────────────────
   The counter says the count and the section; everything else is filler.  */

import { P } from '@/data/catalogue'

const WORD_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100,
}

/* "two track" and "three track" are section names, not counts — a bare number
   word is only read as a quantity when nothing else claims it. */
const FILLER = new Set(['of', 'the', 'a', 'an', 'and', 'pieces', 'piece', 'pcs', 'nos', 'number', 'numbers', 'add', 'please'])

export function parseSpoken(text: string): { pcs: number; code: string } | null {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (!words.length) return null

  // The count is the first number, unless the word right after it is "track",
  // in which case it belongs to the section name.
  let pcs = 1
  let qtyIdx = -1
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const isNum = /^\d+$/.test(w) || w in WORD_NUM
    if (!isNum) continue
    if (words[i + 1] === 'track') continue
    pcs = /^\d+$/.test(w) ? Number(w) : WORD_NUM[w]
    qtyIdx = i
    break
  }

  const terms = words.filter((w, i) => i !== qtyIdx && !FILLER.has(w))
  if (!terms.length) return null

  // Sections are written with digits — "3 Track" — but spoken as words, so a
  // term has to be tried both ways or "three track" lands on the 2 Track row.
  const variants = terms.map(t => {
    const v = [t]
    if (t in WORD_NUM) v.push(String(WORD_NUM[t]))
    if (/^\d+$/.test(t)) {
      const w = Object.keys(WORD_NUM).find(k => WORD_NUM[k] === Number(t))
      if (w) v.push(w)
    }
    return v
  })

  let best: { code: string; score: number } | null = null
  for (const p of P) {
    const hay = `${p.name} ${p.series} ${p.category} ${p.code}`.toLowerCase()
    const score = variants.reduce((s, vs) => {
      const hit = vs.find(v => hay.includes(v))
      return s + (hit ? Math.max(hit.length, 2) : 0)
    }, 0)
    if (score > 0 && (!best || score > best.score)) best = { code: p.code, score }
  }
  return best ? { pcs, code: best.code } : null
}

/* ── A line of the counter book, spoken ────────────────────────────────────
   Theirs, on 27-11: "speak to spreadsheet and it identifies product in it."

   The counter says a line the way it is written on the paper: the pieces,
   the shorthand, the length, and the net weight off the scale —

     "five SP twelve feet 35.32 kg"
     "twenty two track outer frame ten foot"

   Which number is which is settled by the word that follows it, not by the
   order, because nobody says the length and the weight in the same order
   twice. A number with nothing after it is the count, since that is the one
   figure a counter never leaves out.

   What is left over is the shorthand, kept exactly as it was said. It is not
   turned into a product here: a depot shorthand pointed at the wrong section
   would quietly spoil the weight per piece of every job cut from it
   afterwards. Where the words happen to name a section in the catalogue that
   is offered as a suggestion for somebody to accept, and nothing more.    */

const FEET = new Set(['feet', 'foot', 'ft', 'fts'])
const KILOS = new Set(['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms'])
const COUNT = new Set(['pieces', 'piece', 'pcs', 'nos', 'numbers', 'number', 'qty'])
const NOISE = new Set(['of', 'the', 'a', 'an', 'and', 'add', 'line', 'please', 'net', 'weight', 'length', 'is'])

export interface SpokenLine {
  pieces: number
  lengthFt: string
  netWeightKg: number
  /** the shorthand as it was said, for the Written column */
  written: string
  /** a section of ours whose own name the words match — a suggestion only */
  suggests: string | null
}

const numOf = (w: string): number | null => {
  if (/^\d+(\.\d+)?$/.test(w)) return Number(w)
  if (w in WORD_NUM) return WORD_NUM[w]
  return null
}

/** The catalogue read by name, for the suggestion beside a spoken line. */
export function matchProduct(terms: string[]): string | null {
  const variants = terms.map(t => {
    const v = [t]
    if (t in WORD_NUM) v.push(String(WORD_NUM[t]))
    if (/^\d+$/.test(t)) {
      const w = Object.keys(WORD_NUM).find(k => WORD_NUM[k] === Number(t))
      if (w) v.push(w)
    }
    return v
  })
  let best: { code: string; score: number } | null = null
  for (const p of P) {
    const hay = `${p.name} ${p.series} ${p.category} ${p.code}`.toLowerCase()
    const score = variants.reduce((s, vs) => {
      const hit = vs.find(v => hay.includes(v))
      return s + (hit ? Math.max(hit.length, 2) : 0)
    }, 0)
    if (score > 0 && (!best || score > best.score)) best = { code: p.code, score }
  }
  /* One two-letter word in common is not a reading of anything. */
  return best && best.score >= 4 ? best.code : null
}

export function parseSheetLine(text: string): SpokenLine | null {
  const words = text.toLowerCase()
    .replace(/(\d)\s*'/g, '$1 feet')
    .replace(/[^a-z0-9.\s]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (!words.length) return null

  let pieces = 0, lengthFt = '', kg = 0
  const used = new Set<number>()

  /* First pass: a number the next word explains. */
  for (let i = 0; i < words.length; i++) {
    const n = numOf(words[i])
    if (n === null) continue
    const next = words[i + 1] ?? ''
    if (FEET.has(next)) { lengthFt = `${n}'`; used.add(i); used.add(i + 1) }
    else if (KILOS.has(next)) { kg = n; used.add(i); used.add(i + 1) }
    else if (COUNT.has(next)) { pieces = n; used.add(i); used.add(i + 1) }
  }
  /* Second pass: the first number nobody claimed is the count — unless it is
     part of a section's name, which is how "two track" is said. */
  if (!pieces) {
    for (let i = 0; i < words.length; i++) {
      if (used.has(i)) continue
      const n = numOf(words[i])
      if (n === null) continue
      if (words[i + 1] === 'track') continue
      pieces = n; used.add(i); break
    }
  }

  const terms = words.filter((w, i) => !used.has(i) && !NOISE.has(w) && !FEET.has(w) && !KILOS.has(w) && !COUNT.has(w))
  if (!terms.length && !pieces) return null

  return {
    pieces, lengthFt, netWeightKg: kg,
    written: terms.join(' ').toUpperCase(),
    suggests: terms.length ? matchProduct(terms) : null,
  }
}
