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

import {
  OPENING, LOADED, RECEIVED, isHardware, isRubber, apportioned, type CoatLine,
} from './coatbook'

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

  /* Each sheet's shared weighments are split across the rows they cover
     before anything is averaged. Read row by row they put a whole
     weighment on the first line of a group, so a section that happens to
     head one came out heavier than their own sheets say it is. */
  const share = new Map<CoatLine, number>()
  for (const sheet of [OPENING, LOADED, RECEIVED]) {
    for (const [l, kg] of apportioned(sheet)) share.set(l, kg)
  }

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
    /* A blank weight is a shared weighment, not a zero. Apportioned, every
       row of a group carries its own share and the average is honest. */
    const kg = share.get(l) ?? 0
    if (kg > 0 && l.nos > 0 && a.kind === 'section') {
      a.kg += kg; a.nos += l.nos
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

/* ── The two lines every document carries ─────────────────────────────────
   Theirs, on 22-11: "ALUMINIUM EXTRUDED PROFILES and POWDER COATING not
   visible in list", and again, "it should be visible in inventory... and we
   should be able to add multiple times if required."

   They had taken to typing WEIGHT ALUMINIUM EXTRUDED PROFILES in as a new
   item to get round it, which is exactly the sort of thing that makes a
   product list useless inside a month. Both are in the list now and can be
   added by hand, as many times as a job has rates.

   The metal is priced by the kilo — one kilo a piece, so the quantity typed
   against it is the weight. The coating is priced by the length or by the
   lot and carries no weight at all.                                      */
export const DOC_ALU = 'ALU-EXT'
export const DOC_COAT = 'PWD-COAT'

const DOCUMENT_LINES: MasterProduct[] = [
  {
    id: DOC_ALU, code: 'ALU-EXT', name: 'ALUMINIUM EXTRUDED PROFILES',
    alt: 'aluminium extruded profiles weight metal section',
    lengthFt: 0, groove: '', kgPerPiece: 1, colours: [], kind: 'section',
  },
  {
    id: DOC_COAT, code: 'PWD-COAT', name: 'POWDER COATING',
    alt: 'powder coating pc coat',
    lengthFt: 0, groove: '', kgPerPiece: null, colours: [], kind: 'hardware',
  },
]

export const MASTER: MasterProduct[] = [...DOCUMENT_LINES, ...build()]

/* ── A cross section, as against a length of one ───────────────────────────
   The depot writes SP on a line and the length in its own column — SP at 10',
   11', 12' and 15' on the February sheet alone. The master is keyed on code
   AND length, because 20034 at 16' SG and at 15' SG are two stock lines, so
   SP cannot point at any one row of it.

   What SP names is the die: the cross section, cut to whatever the job wants.
   So the cross sections are offered alongside the lengths, and a shorthand
   that travels at several lengths points at one of these instead. The length
   then comes off the line it is written on, which is where the depot puts it.

   Weight is held per running foot here rather than per piece, worked out from
   every weighed line of that section across their books. A piece's weight is
   that times its own length — which is the same arithmetic the length check
   on the purchase sheet does, and it is how a section behaves.            */

export interface CrossSection {
  /** `X:<code>:<groove>` — never a plain code, so it cannot be taken for one */
  id: string
  code: string
  /** the name with the length taken out: "2.5×1.5 SG" */
  name: string
  groove: string
  /** kg per running foot, averaged over every weighed length of it */
  kgPerFoot: number | null
  /** the lengths the master already holds for it */
  lengths: number[]
}

export const crossSectionId = (code: string, groove: string) => `X:${code}:${groove}`

/** "2.5×1.5 16' SG" → "2.5×1.5 SG". */
export const withoutLength = (name: string) =>
  name.replace(/\s*\d+(?:\.\d+)?\s*(?:'|FT\b|FEET\b)/i, '').replace(/\s+/g, ' ').trim()

function buildCrossSections(): CrossSection[] {
  const m = new Map<string, { code: string; groove: string; names: string[]; kgft: number[]; lens: number[] }>()
  for (const p of MASTER) {
    if (p.kind !== 'section' || !p.code || !p.lengthFt) continue
    const id = crossSectionId(p.code, p.groove)
    const a = m.get(id) ?? { code: p.code, groove: p.groove, names: [], kgft: [], lens: [] }
    a.names.push(withoutLength(p.name))
    a.lens.push(p.lengthFt)
    if (p.kgPerPiece !== null) a.kgft.push(p.kgPerPiece / p.lengthFt)
    m.set(id, a)
  }
  return [...m.entries()].map(([id, a]) => ({
    id, code: a.code, groove: a.groove,
    name: a.names.sort((x, y) => y.length - x.length)[0],
    kgPerFoot: a.kgft.length ? +(a.kgft.reduce((s, k) => s + k, 0) / a.kgft.length).toFixed(4) : null,
    lengths: [...new Set(a.lens)].sort((x, y) => y - x),
  })).sort((a, b) => a.name.localeCompare(b.name))
}

export const CROSS_SECTIONS: CrossSection[] = buildCrossSections()

const XS_BY_ID = new Map(CROSS_SECTIONS.map(x => [x.id, x]))

export const crossSectionById = (id: string | null | undefined) =>
  id ? XS_BY_ID.get(id) : undefined

export const isCrossSection = (id: string | null | undefined) => !!id && id.startsWith('X:')

const BY_ID = new Map(MASTER.map(p => [p.id, p]))

/**
 * The product a row is pointed at.
 *
 * A cross section comes back as a product with no length of its own and no
 * weight per piece, because neither is known until somebody says how long the
 * piece is. `pieceKgAt` does that part.
 */
export const productById = (id: string | null | undefined): MasterProduct | undefined => {
  if (!id) return undefined
  const exact = BY_ID.get(id)
  if (exact) return exact
  const x = XS_BY_ID.get(id)
  if (!x) return undefined
  return {
    id: x.id, code: x.code, name: `${x.name} — any length`,
    alt: x.name, lengthFt: 0, groove: x.groove,
    kgPerPiece: null, colours: [], kind: 'section',
  }
}

/** What a piece of this weighs at a given length, where that can be known. */
export function pieceKgAt(id: string | null | undefined, lengthFt: number): number | null {
  const x = crossSectionById(id)
  if (x) return x.kgPerFoot !== null && lengthFt > 0 ? +(x.kgPerFoot * lengthFt).toFixed(3) : null
  return productById(id)?.kgPerPiece ?? null
}

/* ── Two lists, because two jobs ───────────────────────────────────────────
   A cross section is the right answer when a shorthand is being pointed at a
   die: the depot's SP is SG at whatever length the line says, and no one
   length would be true of it.

   It is the wrong answer on a quotation. There a piece has a definite length,
   and a cross section carries no weight per piece — so quoting one silently
   priced by the piece and showed nothing in the weight column, which is
   exactly what went wrong when a line was picked with the Enter key and the
   cross section happened to be first in the list.

   So the mapping screens get the cross sections and the documents do not. */

/** Every product at a definite length — for anything being bought or sold. */
export const PICK_PRODUCTS = MASTER.map(p => ({
  id: p.id,
  code: p.code || '—',
  name: p.name,
  alt: p.alt,
}))

/** The same, with the cross sections — for pointing a shorthand at a die. */
export const PICK_OPTIONS = [
  ...PICK_PRODUCTS,
  ...CROSS_SECTIONS.map(x => ({
    id: x.id,
    code: x.code,
    name: `${x.name} — any length`,
    alt: `${x.name} ${x.groove} cross section die ${x.lengths.join(' ')}`,
  })),
]

/** The product a line of their own sheet is, matched on code and base name. */
export function masterIdOf(line: CoatLine): string | null {
  const id = identity(line, baseName(line.name))
  return BY_ID.has(id) ? id : null
}

/** Distinct lengths in the master, longest first — for the length filter. */
export const LENGTHS = [...new Set(MASTER.map(p => p.lengthFt).filter(f => f > 0))]
  .sort((a, b) => b - a)
