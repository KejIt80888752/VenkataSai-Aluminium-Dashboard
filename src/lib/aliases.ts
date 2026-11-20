/* ── One vocabulary for the whole shop ─────────────────────────────────────
   Every party writes our sections in their own hand. The depot's sheet says
   SP and DP. The coating book says 20033 and 19382. The coater's bill says
   something else again. Each of those is a name for a section we already
   have in the master.

   Each page used to learn those names into a store of its own, so a name
   taught on the purchase sheet was unknown on the coater's bill, and the
   coating book could not be taught at all. Three books, three vocabularies,
   and no way for a figure to travel between them — which is the structural
   reason purchase and coating never met.

   One store fixes that. Teach a name once, anywhere, and every page knows it
   from then on.                                                           */

import { P } from '@/data/catalogue'
import { crossSectionId } from '@/data/productmaster'

export type Source = 'depot' | 'coater' | 'coatbook'

/* ── What the shop has told us, in so many words ───────────────────────────
   Sent by voice on 20-11-2026, having been asked and not guessed at:

     "SP in the purchase invoice is equal to SG in our invoice, DP is equal
      to DG, DIV is written for our DV."

   and, on why the two books read differently at all:

     "Purchase invoice will have slightly different terms and ours will have
      different terms, but it has to be correlated between the two."

   Each points at a cross section rather than a length of one, because the
   depot writes SP at ten, eleven, twelve and fifteen feet on one sheet and
   puts the length in its own column. The length comes off the line.

   CUPC is here too, and it took a second reading to see it. "CUPC is nothing,
   I don't know which you are talking about, it is clips" reads as a shrug
   until you hear it as "CUPC is nothing but ... it is clips", which is how it
   was meant and how it is said. It is an answer, not a question.

   Their own figures bear it out and were checked before it was applied. The
   CUPC line is 280 pieces at twelve feet weighing 63.6 kg — 0.227 kg a piece
   — and their coating book carries a W/O CLIPS 12' line of exactly 280
   pieces. Same count, same length. Against the clips' 0.248 kg a piece that
   is 8.4% light, which is closer than SP at 11.3% and DIV at 10.3%, both of
   which they confirmed in the same breath.

   Anything taught on a screen overrides what is here; these are only what to
   start from, so the shop is not asked a question it has already answered. */
const CONFIRMED: Record<string, string> = {
  [`depot:sp`]:  crossSectionId('20034', 'SG'),
  [`depot:dp`]:  crossSectionId('20033', 'DG'),
  [`depot:div`]: crossSectionId('19543', ''),
  [`depot:dv`]:  crossSectionId('19543', ''),
  [`depot:cupc`]: crossSectionId('19382', ''),
}

const KEY = 'vsa-aliases'

/** The two stores that existed before this one, read once and folded in. */
const LEGACY: [string, Source][] = [
  ['vsa-dc-aliases', 'depot'],
  ['vsa-coater-aliases', 'coater'],
]

export interface AliasMap {
  /**
   * `source:normalised foreign name` → **our section code**, never its
   * display name. Each page offered a different list and two of them stored
   * the name while a third stored the code, so a section taught on the
   * coater's bill could never match the same section taught on the purchase
   * sheet and nothing ever joined. A code is one value, stable, and the same
   * in every list; a display name is neither.
   */
  [key: string]: string
}

/** Names are written by hand, so case and spacing cannot be trusted. */
export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** Keys are namespaced by source: the depot's "SP" and a coater's "SP" need
    not mean the same section, and quietly merging them would be a guess. */
export const keyFor = (source: Source, foreign: string) => `${source}:${norm(foreign)}`

/** A stored value that is a display name becomes its code; a code stays as
    it is; anything unrecognised is handed back untouched rather than lost. */
function asCode(stored: string): string {
  if (P.some(p => p.code === stored)) return stored
  return P.find(p => norm(p.name) === norm(stored))?.code ?? stored
}

function readRaw(): AliasMap {
  try {
    const held = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (held) return held
  } catch { /* storage blocked or corrupt — fall through to the legacy read */ }

  /* First run since the stores were merged: fold the old ones in rather than
     making anyone teach the same names a second time. The purchase sheet
     stored display names where the coater's bill stored codes, so anything
     that reads as a name is turned back into its code on the way in — a
     mixture of the two would join nothing, which is the bug this is for. */
  const merged: AliasMap = {}
  for (const [legacyKey, source] of LEGACY) {
    try {
      const old = JSON.parse(localStorage.getItem(legacyKey) ?? '{}') as Record<string, string>
      for (const [foreign, ours] of Object.entries(old)) {
        if (ours) merged[keyFor(source, foreign)] = asCode(ours)
      }
    } catch { /* an unreadable legacy store is simply skipped */ }
  }

  /* Write the result straight back, so the fold happens once rather than on
     every load. Without this the new store stays empty until somebody
     happens to teach a name, and until then the old stores are still the
     real source — two truths at once, which is what this was meant to end. */
  try { localStorage.setItem(KEY, JSON.stringify(merged)) } catch { /* blocked */ }
  return merged
}

export function loadAliases(): AliasMap {
  /* What they have confirmed sits underneath; anything taught sits on top. */
  return { ...CONFIRMED, ...readRaw() }
}

/** True where a mapping is one they confirmed rather than one typed here. */
export const isConfirmed = (source: Source, foreign: string) =>
  keyFor(source, foreign) in CONFIRMED

export function saveAliases(map: AliasMap) {
  try { localStorage.setItem(KEY, JSON.stringify(map)) } catch { /* blocked */ }
}

/** What we call it, if anyone has said. */
export function ourSection(map: AliasMap, source: Source, foreign: string): string | undefined {
  return map[keyFor(source, foreign)]
}

/**
 * Every foreign name that points at one of our sections, whoever taught it.
 * This is what lets a figure cross between books: the depot's SP and the
 * coating book's 20033, once both point at the same section, are the same
 * material written two ways.
 */
export function namesFor(map: AliasMap, ourName: string) {
  const out: { source: Source; foreign: string }[] = []
  for (const [k, v] of Object.entries(map)) {
    if (v !== ourName) continue
    const [source, ...rest] = k.split(':')
    out.push({ source: source as Source, foreign: rest.join(':') })
  }
  return out
}

/** Sections that more than one book has a name for — the ones that join up. */
export function joinedSections(map: AliasMap) {
  const bySection = new Map<string, Set<Source>>()
  for (const [k, ours] of Object.entries(map)) {
    const source = k.split(':')[0] as Source
    if (!bySection.has(ours)) bySection.set(ours, new Set())
    bySection.get(ours)!.add(source)
  }
  return [...bySection.entries()]
    .map(([section, sources]) => ({ section, sources: [...sources] }))
    .filter(s => s.sources.length > 1)
}
