/* ── The product master, built out of their own books ──────────────────────
   The shop typed "W/o clips" into the section box and nothing came back. They
   were right to ask why it was there at all: the master was the invented
   catalogue, and that went out when the demo data went out. So the master is
   now derived from the only product list they have actually given us — the
   codes and names on their three coating sheets.

   One rule holds the whole thing together, and it is theirs: the number is the
   section, the colour is a state it passes into at the coater. 20033 leaves as
   "W/O 2.5x1.5 16' DG" and comes back as IVORY, CB or PGG; all four rows are
   one product. Hardware works the same way one level down — VAH-1-MT and
   VAH-1-PGG are the same handle in two shades, so the master holds VAH-1.

   Length is part of the name, not a column. That too is theirs: "since we are
   mentioning the length in the name itself". So 20034 at 16' SG and 20034 at
   15' SG are two lines of the master sharing one code, exactly as their Excel
   repeats the code on two rows.

   Nothing here is invented and nothing is mapped by guess. Cost, selling price
   and physical stock are absent because they have not been given yet.       */

import { OPENING, LOADED, RECEIVED, isHardware, isRubber, type CoatLine } from './coatbook'

/** Colour words that are a state at the coater, not part of a section's name. */
const COLOUR_WORDS = [
  'W/O', 'IVORY', 'WHITE', 'BLACK', 'CB', 'PGG', 'PG',
  'PISTA GREEN GLOSSY', 'PISTA GREEN', 'COFFEE BROWN', 'MATT', 'MT',
]

/** Colour suffixes the hardware codes carry: VAH-1-MT, VAH-1-PGG, VAH-1-CB. */
const CODE_COLOUR_SUFFIX = /-(MT|PGG|PG|CB|IVORY|WHITE|BLACK)$/i

export interface MasterProduct {
  /** unique within the master — one code may carry several lengths */
  id: string
  /** their code, as written on the sheet */
  code: string
  /** the section without any colour on it */
  name: string
  /** every spelling seen in their books, so any of them finds this row */
  alt: string
  /** feet, read out of the name; 0 where the name carries no length */
  lengthFt: number
  /** SG, DG, or '' where the name does not say */
  groove: string
  /** kg a piece, averaged over every weighed line of this product */
  kgPerPiece: number | null
  /** colours this section has been seen in */
  colours: string[]
  kind: 'section' | 'hardware' | 'rubber'
}

/** Strips the colour off a name, from either end, and tidies the spacing. */
export function baseName(raw: string): string {
  let n = (raw || '').replace(/\s+/g, ' ').trim()
  for (;;) {
    const before = n
    for (const w of COLOUR_WORDS) {
      const up = n.toUpperCase()
      if (up.startsWith(w + ' ')) { n = n.slice(w.length + 1).trim(); break }
      if (up.endsWith(' ' + w)) { n = n.slice(0, n.length - w.length - 1).trim(); break }
    }
    if (n === before) return n
  }
}

/** The colour a line is in, in their own words, or '' where it says nothing. */
export function colourWord(line: CoatLine): string {
  const up = (line.name || '').toUpperCase()
  if (up.includes('PISTA GREEN') || /\bPGG?\b/.test(up)) return 'Pista Green Glossy'
  if (up.includes('COFFEE BROWN') || /\bCB\b/.test(up)) return 'Coffee Brown'
  if (up.includes('MATT') || /\bMT\b/.test(up)) return 'Matt'
  if (/^\s*IVORY\b/.test(up) || up.includes(' IVORY')) return 'Ivory'
  if (/^\s*WHITE\b/.test(up) || up.includes(' WHITE')) return 'White'
  if (/^\s*BLACK\b/.test(up) || up.includes(' BLACK')) return 'Black'
  if (up.startsWith('W/O')) return 'Uncoated'
  const tail = (line.code || '').toUpperCase().match(CODE_COLOUR_SUFFIX)?.[1]
  if (tail === 'MT') return 'Matt'
  if (tail === 'PGG' || tail === 'PG') return 'Pista Green Glossy'
  if (tail === 'CB') return 'Coffee Brown'
  return ''
}

/** Their code with any colour suffix taken off: VAH-1-PGG → VAH-1. */
export const baseCode = (code: string | null) =>
  (code ?? '').replace(CODE_COLOUR_SUFFIX, '').trim()

/** Feet out of a name — "2.5×1.5 16' SG" is sixteen feet, not two and a half. */
export function feetOf(name: string): number {
  const m = (name || '').match(/(\d+(?:\.\d+)?)\s*(?:'|FT\b|FEET\b)/i)
  return m ? parseFloat(m[1]) : 0
}

export function grooveOf(name: string): string {
  const up = (name || '').toUpperCase()
  if (/\bDG\b/.test(up)) return 'DG'
  if (/\bSG\b/.test(up)) return 'SG'
  return ''
}

const kindOf = (l: CoatLine): MasterProduct['kind'] =>
  isRubber(l) ? 'rubber' : isHardware(l) ? 'hardware' : 'section'

/* ── Walking their three sheets once to build the list ─────────────────── */

/**
 * What makes two lines the same product.
 *
 * Their rule, applied as written: the number is the section. So every line
 * carrying 19382 at twelve feet is one product, whether the writer put
 * "W/O CLIPS 12'" or "PGG GLAZING CLIPS 12'" — and the weights bear that out,
 * 0.244 kg a clip against 0.259 once the shared weighment on the second is
 * read as the 450 clips it covers rather than the 250 on its own line.
 *
 * Length and groove stay in the key because 20034 appears at 16' SG and at
 * 15' SG, and those are two stock lines, not one. Their own Excel repeats the
 * code on two rows for exactly that reason.
 *
 * A line with no code at all — TBC — can only be keyed on its name.
 */
const identity = (l: CoatLine, name: string) => {
  const code = baseCode(l.code)
  if (!code) return `NC|${name.toUpperCase()}`
  return `${code}|${feetOf(name)}|${grooveOf(name)}`
}

function build(): MasterProduct[] {
  interface Acc {
    code: string; kind: MasterProduct['kind']
    /** every base name seen, and how often — the commonest one is shown */
    names: Map<string, number>
    spellings: Set<string>; colours: Set<string>
    kg: number; nos: number
  }
  const m = new Map<string, Acc>()

  for (const l of [...OPENING, ...LOADED, ...RECEIVED]) {
    const name = baseName(l.name)
    if (!name) continue
    const id = identity(l, name)
    const a = m.get(id) ?? {
      code: baseCode(l.code), kind: kindOf(l),
      names: new Map<string, number>(),
      spellings: new Set<string>(), colours: new Set<string>(), kg: 0, nos: 0,
    }
    a.names.set(name, (a.names.get(name) ?? 0) + 1)
    a.spellings.add((l.name || '').replace(/\s+/g, ' ').trim())
    if (l.code) a.spellings.add(l.code)
    const c = colourWord(l)
    if (c) a.colours.add(c)
    /* Only weighed, countable lines may move the average. A blank weight is a
       shared weighment, not a zero, so it must not drag the figure down. */
    if (l.kg !== null && l.kg > 0 && l.nos > 0 && a.kind === 'section') {
      a.kg += l.kg; a.nos += l.nos
    }
    m.set(id, a)
  }

  return [...m.entries()]
    .map(([id, a]): MasterProduct => {
      /* Commonest spelling wins; where two are level the fuller one does, so
         the shop reads the name it writes most and recognises the rest. */
      const name = [...a.names.entries()]
        .sort((x, y) => y[1] - x[1] || y[0].length - x[0].length)[0][0]
      return {
        id,
        code: a.code,
        name,
        alt: [...a.spellings, ...a.names.keys(), ...a.colours].join(' '),
        lengthFt: feetOf(name),
        groove: grooveOf(name),
        kgPerPiece: a.nos > 0 ? +(a.kg / a.nos).toFixed(3) : null,
        colours: [...a.colours].sort(),
        kind: a.kind,
      }
    })
    .sort((x, y) => x.kind.localeCompare(y.kind) || x.name.localeCompare(y.name))
}

export const MASTER: MasterProduct[] = build()

const BY_ID = new Map(MASTER.map(p => [p.id, p]))

export const productById = (id: string | null | undefined) =>
  id ? BY_ID.get(id) : undefined

/** What the picker shows: the name, their code beside it, every spelling searched. */
export const PICK_OPTIONS = MASTER.map(p => ({
  id: p.id,
  code: p.code || '—',
  name: p.name,
  alt: p.alt,
}))

/** The product a line of their own sheet is, matched on code and base name. */
export function masterIdOf(line: CoatLine): string | null {
  const id = identity(line, baseName(line.name))
  return BY_ID.has(id) ? id : null
}

/** Distinct lengths in the master, longest first — for the length filter. */
export const LENGTHS = [...new Set(MASTER.map(p => p.lengthFt).filter(f => f > 0))]
  .sort((a, b) => b - a)
