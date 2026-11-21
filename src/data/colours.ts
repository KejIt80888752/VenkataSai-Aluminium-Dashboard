/* ── The colours, off their own sheet ──────────────────────────────────────
   Theirs, on 21-11:

     "Colour must be part of the item/section — Ivory, Grey, Pista Grey,
      Rose Gold. Inventory is managed by colour."
     "The Excel sheet given earlier had no colour. Add colour to every item."
     "Once a colour is selected for the first item, carry it forward to the
      next items. Allow it to be changed."
     "Purchase DC: the material comes in without load — only the section.
      After conversion it becomes a colour, Ivory for example."

   The list is not invented here. It is the one written on their own coating
   sheets, line by line: W/O, IVORY, WHITE, BLACK, COFFEE BROWN, PISTA GREEN
   GLOSSY and MATT. Those are the finishes material has actually gone to a
   coater in, so they are the finishes stock can actually come back in.

   Two names said aloud in the meeting are not on the sheets — "Pista Grey"
   and "Rose Gold". Pista Grey is almost certainly the Pista Green Glossy
   their own book writes, and is matched to it. Rose Gold may well be a
   colour they have started taking and not yet sent to this coater, so the
   list is not frozen: a colour typed once is kept and is on the list from
   then on. Nothing waits on us to add it.

   W/O is deliberately first and is not a colour. It is the raw mill finish —
   what comes off the lorry before anything is coated — and a purchase DC
   opens on it, which is what they meant by "without load".                */

import { useSyncExternalStore } from 'react'
import { COLOURS } from './coatbook'

/** The raw, uncoated state. Not a colour; the absence of one. */
export const UNCOATED = 'W/O'

export interface Colour {
  /** short form, as their sheets write it */
  code: string
  /** what it is called on a document */
  name: string
  /** true for the mill finish, which is not a coating */
  raw?: boolean
  /** roughly what it looks like, for the dot beside the name */
  swatch: string
}

/* Their sheets' own short forms, in the order a coating book uses them. */
const SEEDED: Colour[] = [
  { code: UNCOATED, name: 'Without load — mill finish', raw: true, swatch: '#b8bfc7' },
  { code: 'IVORY',  name: COLOURS.IVORY,  swatch: '#efe6d2' },
  { code: 'WHITE',  name: COLOURS.WHITE,  swatch: '#f8f8f6' },
  { code: 'BLACK',  name: COLOURS.BLACK,  swatch: '#24262a' },
  { code: 'CB',     name: COLOURS.CB,     swatch: '#5a3a24' },
  { code: 'PGG',    name: COLOURS.PGG,    swatch: '#8fa86b' },
  { code: 'MT',     name: COLOURS.MT,     swatch: '#8a8d90' },
]

/* ── Anything they add themselves ─────────────────────────────────────────
   Rose Gold, Grey, or whatever a job next month is coated in. Typed once on
   a document and it joins the list, the way a product does.               */
const KEY = 'vsa-colours'

const read = (): Colour[] => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

let extra: Colour[] = read()
const listeners = new Set<() => void>()
let snapshot: Colour[] = [...SEEDED, ...extra]

const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f) } }

function save(next: Colour[]) {
  extra = next
  snapshot = [...SEEDED, ...extra]
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* full or blocked */ }
  listeners.forEach(f => f())
}

/** Every colour on offer: theirs, and anything added since. */
export const allColours = () => snapshot
export const useColours = () => useSyncExternalStore(subscribe, () => snapshot, () => snapshot)

/** Adds a colour nobody has used before and hands it back. */
export function addColour(typed: string): Colour {
  const name = typed.trim()
  const found = snapshot.find(c => c.name.toLowerCase() === name.toLowerCase())
  if (found) return found
  const c: Colour = {
    code: name.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 6) || name.toUpperCase(),
    name,
    swatch: '#9aa3ad',
  }
  save([...extra, c])
  return c
}

/* ── Reading what somebody wrote ──────────────────────────────────────────
   Their sheets write the colour in front of the section — "IVORY DV 7'",
   "BLACK 2.5×1.5 15' SG" — and the hardware carries it as a suffix on the
   code, VAH-1-CB. Both are read, and so is "Pista Grey", which is how the
   colour was said aloud and is the Pista Green their book writes.        */
const SPOKEN: Record<string, string> = {
  'PISTA GREY':  'PGG',
  'PISTA GREEN': 'PGG',
  'COFFEE BROWN': 'CB',
  'MATT': 'MT',
  'WITHOUT LOAD': UNCOATED,
  'W/O': UNCOATED,
}

/** The colour a line is in, by whatever name it was written under. */
export function colourByName(text: string): Colour | undefined {
  const t = (text || '').trim().toUpperCase()
  if (!t) return undefined
  const mapped = SPOKEN[t]
  if (mapped) return snapshot.find(c => c.code === mapped)
  return snapshot.find(c => c.code === t)
    ?? snapshot.find(c => c.name.toUpperCase() === t)
}

export const colourName = (code?: string) =>
  snapshot.find(c => c.code === code)?.name ?? ''

export const swatchOf = (code?: string) =>
  snapshot.find(c => c.code === code)?.swatch ?? 'transparent'

/** What a new line opens in: whatever the line above it is in. */
export const carryColour = (previous?: string) => previous || UNCOATED

/* ── What a document opens in ───────────────────────────────────────
   A purchase DC opens uncoated, because that is what comes off the lorry.
   A sales document cannot: nothing is sold in the mill finish without
   somebody saying so, and a box showing Ivory while the line underneath
   still said W/O is the kind of disagreement that puts the wrong colour on
   a bill. So an offer opens on the first coated colour, and whoever raises
   it changes it on the first line and the rest follow.                   */
export const firstCoated = () => (snapshot.find(c => !c.raw)?.code ?? UNCOATED)
