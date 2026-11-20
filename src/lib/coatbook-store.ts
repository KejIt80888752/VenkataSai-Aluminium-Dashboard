/* ── The coating book as a book you write in ───────────────────────────────
   Asked for on 20-11-2026. They were describing entry the whole way through
   that part of the call — "you're just entering, pista white, 20 numbers,
   25.6, it is received at my godown" — and then said plainly: "I am unable
   to edit."

   Their three sheets stay underneath as the paper record. Anything typed
   here sits beside them and is layered on at read time, so a figure read off
   their workbook is never quietly overwritten and every entry can be undone.

   Two of their rules shape the row itself.

   The godown is chosen once above the table and carried down every line
   entered under it — "every item I don't want to select godown 2, godown 3.
   Once it is entered at the top, the bottom will carry till the bottom." So
   it lives on the row but is never asked for on the row.

   And the name is not typed. A line is a product and a colour: the number is
   the section, the colour is the state it passes into at the coater. Picking
   both writes the name the way they write it — IVORY 2.5x1.5 16' DG for a
   section, AMERICAN HANDLE 6" MATT for hardware, which is their own habit of
   putting the shade after the name on bought-out goods.                   */

import { useMemo } from 'react'
import { useCrud } from './store'
import { OPENING, LOADED, RECEIVED, isHardware, isRubber, type CoatLine } from '@/data/coatbook'
import { productById, masterIdOf, baseCode } from '@/data/productmaster'

export type SheetId = 'opening' | 'loaded' | 'received'

export const SHEET_META: { id: SheetId; label: string; date: string; places: 'route' | 'godown' }[] = [
  { id: 'opening',  label: 'Opening 01-09',        date: '2026-09-01', places: 'route'  },
  { id: 'loaded',   label: 'Loaded out 16/17-09',  date: '2026-09-17', places: 'route'  },
  { id: 'received', label: 'Received back 21-09',  date: '2026-09-21', places: 'godown' },
]

export interface BookLine extends CoatLine {
  id: string
  sheet: SheetId
  /** the godown it was put in, or the route it travelled — set once, above */
  place: string
  /** the master product, where the line has been pointed at one */
  productId: string
  /** the shade, in their own short form: W/O, IVORY, CB, PGG… */
  colour: string
  date: string
}

/* ── Colour, as they write it ─────────────────────────────────────────── */

export const COLOUR_OPTIONS = [
  { key: 'W/O',   label: 'W/O — uncoated',  word: ''              },
  { key: 'IVORY', label: 'Ivory',           word: 'IVORY'         },
  { key: 'WHITE', label: 'White',           word: 'WHITE'         },
  { key: 'BLACK', label: 'Black',           word: 'BLACK'         },
  { key: 'CB',    label: 'CB — coffee brown', word: 'COFFEE BROWN' },
  { key: 'PGG',   label: 'PGG — pista green', word: 'PISTA GREEN' },
  { key: 'MT',    label: 'MT — matt',       word: 'MATT'          },
]

const COLOUR_BY_KEY = new Map(COLOUR_OPTIONS.map(c => [c.key, c]))
export const colourLabel = (key: string) => COLOUR_BY_KEY.get(key)?.label ?? key

/** The shade a line of their own paper is in, read back to a short form. */
export function colourKeyOf(l: CoatLine): string {
  const up = (l.name || '').toUpperCase()
  const code = (l.code || '').toUpperCase()
  if (up.includes('PISTA GREEN') || /(^|\s|-)PGG?(\s|$|-)/.test(`${up} ${code}`)) return 'PGG'
  if (up.includes('COFFEE BROWN') || /(^|\s|-)CB(\s|$|-)/.test(`${up} ${code}`)) return 'CB'
  if (up.includes('MATT') || /-MT$/.test(code)) return 'MT'
  if (/^IVORY\b/.test(up)) return 'IVORY'
  if (/^WHITE\b/.test(up)) return 'WHITE'
  if (/^BLACK\b/.test(up)) return 'BLACK'
  if (up.startsWith('W/O')) return 'W/O'
  return ''
}

/** Their own way of writing a coated line: shade in front, or behind. */
export function composeName(productId: string, colour: string): string {
  const p = productById(productId)
  if (!p) return ''
  const c = COLOUR_BY_KEY.get(colour)
  if (!c || colour === 'W/O') return p.kind === 'section' ? `W/O ${p.name}` : p.name
  /* Sections carry the shade in front; bought-out goods carry it behind,
     which is how both are written across their three sheets. */
  return p.kind === 'section' ? `${colour} ${p.name}` : `${p.name} ${c.word}`
}

/** Hardware codes carry the shade: VAH-1 coated pista green is VAH-1-PGG. */
export function composeCode(productId: string, colour: string): string {
  const p = productById(productId)
  if (!p) return ''
  if (p.kind === 'section' || !colour || colour === 'W/O') return p.code
  return `${baseCode(p.code)}-${colour}`
}

/* ── Their paper, as the rows underneath ──────────────────────────────── */

const seedOf = (lines: CoatLine[], sheet: SheetId): BookLine[] => {
  const meta = SHEET_META.find(m => m.id === sheet)!
  return lines.map((l, i) => ({
    ...l,
    id: `${sheet}-${i}`,
    sheet,
    place: l.at ?? l.route ?? '—',
    productId: masterIdOf(l) ?? '',
    colour: colourKeyOf(l),
    date: meta.date,
  }))
}

/* Built once. Rebuilding it on every render would make useCrud recompute
   its merge each time and the table would flicker under the cursor. */
const SEED: BookLine[] = [
  ...seedOf(OPENING, 'opening'),
  ...seedOf(LOADED, 'loaded'),
  ...seedOf(RECEIVED, 'received'),
]

const idOf = (l: BookLine) => l.id

export function newLine(sheet: SheetId, place: string, date: string): BookLine {
  return {
    id: `typed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    sheet, place, date,
    code: null, name: '', nos: 0, kg: null,
    internal: null, unit: null,
    route: sheet === 'received' ? null : place,
    at: sheet === 'received' ? place : null,
    row: 0,
    productId: '', colour: sheet === 'received' ? '' : 'W/O',
  }
}

export function useCoatBook() {
  const crud = useCrud<BookLine>('coatbook', SEED, idOf)

  /* Typed rows sit under the paper ones so a sheet still reads top to bottom
     in the order it was written, with anything new at the foot of its block. */
  const lines = useMemo(
    () => [...crud.rows].sort((a, b) => {
      const ai = SEED.findIndex(s => s.id === a.id)
      const bi = SEED.findIndex(s => s.id === b.id)
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    }),
    [crud.rows],
  )

  const of = (sheet: SheetId) => lines.filter(l => l.sheet === sheet)

  return {
    ...crud,
    lines,
    of,
    opening: useMemo(() => of('opening'), [lines]),
    loaded: useMemo(() => of('loaded'), [lines]),
    received: useMemo(() => of('received'), [lines]),
  }
}

/** Everywhere stock can be put, taken from their own sheets and never guessed. */
export function placesOn(lines: BookLine[]): string[] {
  return [...new Set(lines.map(l => l.place).filter(p => p && p !== '—'))].sort()
}

export const isCounted = (l: CoatLine) => !isHardware(l) && !isRubber(l)
