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

export type Source = 'depot' | 'coater' | 'coatbook'

const KEY = 'vsa-aliases'

/** The two stores that existed before this one, read once and folded in. */
const LEGACY: [string, Source][] = [
  ['vsa-dc-aliases', 'depot'],
  ['vsa-coater-aliases', 'coater'],
]

export interface AliasMap {
  /** normalised foreign name → our section name */
  [key: string]: string
}

/** Names are written by hand, so case and spacing cannot be trusted. */
export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** Keys are namespaced by source: the depot's "SP" and a coater's "SP" need
    not mean the same section, and quietly merging them would be a guess. */
export const keyFor = (source: Source, foreign: string) => `${source}:${norm(foreign)}`

function readRaw(): AliasMap {
  try {
    const held = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (held) return held
  } catch { /* storage blocked or corrupt — fall through to the legacy read */ }

  /* First run since the stores were merged: fold the old ones in rather than
     making anyone teach the same names a second time. */
  const merged: AliasMap = {}
  for (const [legacyKey, source] of LEGACY) {
    try {
      const old = JSON.parse(localStorage.getItem(legacyKey) ?? '{}') as Record<string, string>
      for (const [foreign, ours] of Object.entries(old)) {
        if (ours) merged[keyFor(source, foreign)] = ours
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
  return readRaw()
}

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
