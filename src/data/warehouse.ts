/* ── Knowing which rack a section is actually on ───────────────────────────
   "Godown 1" is not an address. A picker needs the aisle, the rack and the
   level, and the system needs to know how much is in each one so it can say
   where to go — and, when stock comes in, where to put it.                */

import { P } from './catalogue'

export interface Bin {
  id: string          // GD1-A-03-2
  godown: string
  aisle: string
  rack: number
  level: number       // 1 is floor level
  code: string | null
  name: string | null
  nos: number
  capacityNos: number
  /** heavy sections belong low down */
  heavyOnly: boolean
}

export const GODOWNS = [
  { id: 'GD1', label: 'Godown 1 — Main', aisles: ['A', 'B', 'C'], racks: 6, levels: 3 },
  { id: 'GD2', label: 'Godown 2 — 4th Floor', aisles: ['D', 'E'], racks: 5, levels: 3 },
  { id: 'SHOP', label: 'Shop — K R Puram', aisles: ['S'], racks: 4, levels: 2 },
] as const

const HEAVY = (code: string) => (P.find(p => p.code === code)?.kgPerLength ?? 0) >= 2.5

let n = 0
export const BINS: Bin[] = GODOWNS.flatMap(g =>
  g.aisles.flatMap(aisle =>
    Array.from({ length: g.racks }, (_, r) =>
      Array.from({ length: g.levels }, (_, l) => {
        n++
        const rack = r + 1, level = l + 1
        // Roughly three bins in four are holding something.
        const filled = n % 4 !== 3
        const p = filled ? P[n % P.length] : null
        const capacity = 40 + (n % 5) * 20
        return {
          id: `${g.id}-${aisle}-${String(rack).padStart(2, '0')}-${level}`,
          godown: g.id, aisle, rack, level,
          code: p?.code ?? null, name: p?.name ?? null,
          nos: p ? Math.round(capacity * (0.2 + ((n % 7) / 10))) : 0,
          capacityNos: capacity,
          heavyOnly: level === 1,
        }
      }),
    ).flat(),
  ),
)

export const binsFor = (code: string) => BINS.filter(b => b.code === code && b.nos > 0)

/** Where to pick from: fullest bin first, and off the floor level for heavy stock. */
export function pickFrom(code: string, nos: number) {
  const open = binsFor(code).sort((a, b) => b.nos - a.nos)
  let left = nos
  const picks: { bin: Bin; take: number }[] = []
  for (const b of open) {
    if (left <= 0) break
    const take = Math.min(left, b.nos)
    picks.push({ bin: b, take })
    left -= take
  }
  return { picks, short: left }
}

/** Where to put stock away: an empty bin in the right aisle, low down if heavy. */
export function putawayFor(code: string, godown: string) {
  const heavy = HEAVY(code)
  const sameItem = BINS.filter(b => b.godown === godown && b.code === code && b.nos < b.capacityNos)
  const empty = BINS.filter(b => b.godown === godown && b.code === null && (!heavy || b.level === 1))
  const any = BINS.filter(b => b.godown === godown && b.code === null)
  return {
    heavy,
    suggestion: sameItem[0] ?? empty[0] ?? any[0] ?? null,
    reason: sameItem.length ? 'Same section already on this rack — keep it together'
      : empty.length ? (heavy ? 'Empty bin at floor level, as this section is heavy' : 'Nearest empty bin')
      : 'No bin free in the right place — this one is above floor level',
  }
}

export const WAREHOUSE_SUMMARY = {
  bins: BINS.length,
  used: BINS.filter(b => b.nos > 0).length,
  empty: BINS.filter(b => b.nos === 0).length,
  pieces: BINS.reduce((s, b) => s + b.nos, 0),
  fillPct: +((BINS.reduce((s, b) => s + b.nos, 0) / BINS.reduce((s, b) => s + b.capacityNos, 0)) * 100).toFixed(0),
}
