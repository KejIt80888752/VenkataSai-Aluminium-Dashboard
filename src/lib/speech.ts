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
