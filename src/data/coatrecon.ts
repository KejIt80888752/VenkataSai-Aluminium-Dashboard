/* ── What went to the coater against what came back ────────────────────────
   Asked for on 20-11-2026, in their words:

     "In the coating book only, it should mention how much percentage excess
      you have received. If you sent 800 kgs and you receive 900 kgs, you have
      to mention it as +10%. And if I have not received something, it should
      mention that — what item, of which quantity, is pending."

   Two things make this harder than subtracting one column from another.

   A section goes out in one colour and comes back in three: 20033 leaves as
   W/O and returns as IVORY, CB and PGG. Matching on the printed name would
   never close. It is matched on the product instead — the number is the
   section, the colour is a state — which is the rule they gave us.

   And a blank weight is not a missing one. Two or three colours of the same
   section go on the scale together and the figure is written against the
   first of them. So the weights are added as written and the blanks left
   alone; adding a nought for them would be right, and counting them twice
   would not.                                                               */

import { LOADED, RECEIVED, isTbc, isHardware, isRubber, type CoatLine } from './coatbook'
import { masterIdOf, baseName, baseCode, productById } from './productmaster'

export interface ReconRow {
  key: string
  code: string
  name: string
  sentNos: number
  sentKg: number
  recvNos: number
  recvKg: number
  /** still at the coater — pieces out that have not come back */
  pendingNos: number
  /** came back beyond what went out, which usually means older stock with it */
  extraNos: number
  /** weight back against weight out, as a percentage; null where nothing went */
  kgPct: number | null
  /** the colours it came back in */
  colours: string[]
  /** true where part of this row's weight comes out of a shared weighment,
      so the percentage beside it is indicative and not a measurement */
  sharedWeighment: boolean
}

interface Side { nos: number; kg: number; colours: Set<string>; shared: boolean }

/* ── Giving a shared weighment back to the rows it covers ──────────────────
   Their style: two or three colours of one section go on the scale together
   and the figure is written against the first of them. Read row by row that
   makes the first line heavy and the rest weightless, which is how 20034 at
   16' SG came out thirty-six per cent short of what went out — six of its
   pieces were on the scale with the DG line above and their weight was
   written there.

   There is no way to recover the true split from the paper, so the weighment
   is divided across its rows by piece count. That is the one division that
   assumes nothing beyond what is already written. It is not exact where the
   rows are different sections, so every row that leans on one is marked and
   the page says so rather than letting the percentage pass for a measurement.
*/
function apportion(lines: CoatLine[]): Map<CoatLine, { kg: number; shared: boolean }> {
  const out = new Map<CoatLine, { kg: number; shared: boolean }>()
  let group: CoatLine[] = []

  const close = () => {
    if (group.length === 0) return
    const kg = group[0].kg ?? 0
    const nos = group.reduce((a, l) => a + l.nos, 0)
    const shared = group.length > 1
    for (const l of group) {
      out.set(l, {
        kg: nos > 0 ? +(kg * (l.nos / nos)).toFixed(3) : (l === group[0] ? kg : 0),
        shared,
      })
    }
    group = []
  }

  for (const l of lines) {
    /* Hardware and rubber are counted, never weighed — they break no group
       and join none. */
    if (isHardware(l) || isRubber(l)) { out.set(l, { kg: 0, shared: false }); continue }
    if (l.kg !== null) { close(); group = [l] }
    else if (group.length) group.push(l)
    else out.set(l, { kg: 0, shared: false })
  }
  close()
  return out
}

/* A line that is not in the master still has to be counted, so it falls back
   to its own code and name rather than being quietly dropped. */
const keyOf = (l: CoatLine) =>
  masterIdOf(l) ?? `${baseCode(l.code) || 'NC'}|${baseName(l.name).toUpperCase()}`

function tally(lines: CoatLine[]) {
  const share = apportion(lines)
  const m = new Map<string, Side>()
  for (const l of lines) {
    const k = keyOf(l)
    const s = m.get(k) ?? { nos: 0, kg: 0, colours: new Set<string>(), shared: false }
    const a = share.get(l)
    s.nos += l.nos
    s.kg = +(s.kg + (a?.kg ?? 0)).toFixed(2)
    if (a?.shared) s.shared = true
    m.set(k, s)
  }
  return m
}

export function reconcile(): ReconRow[] {
  const out = tally(LOADED)
  const back = tally(RECEIVED)

  /* The colours a thing came back in are read off the received sheet. */
  for (const l of RECEIVED) {
    const p = productById(masterIdOf(l) ?? '')
    const s = back.get(keyOf(l))
    if (s && p) for (const c of p.colours) if (c !== 'Uncoated') s.colours.add(c)
  }

  const names = new Map<string, { code: string; name: string }>()
  for (const l of [...LOADED, ...RECEIVED]) {
    const k = keyOf(l)
    if (names.has(k)) continue
    const p = productById(masterIdOf(l) ?? '')
    names.set(k, { code: p?.code || l.code || '—', name: p?.name || baseName(l.name) })
  }

  return [...new Set([...out.keys(), ...back.keys()])]
    .map((key): ReconRow => {
      const o = out.get(key) ?? { nos: 0, kg: 0, colours: new Set<string>(), shared: false }
      const b = back.get(key) ?? { nos: 0, kg: 0, colours: new Set<string>(), shared: false }
      const n = names.get(key)!
      return {
        key, code: n.code, name: n.name,
        sentNos: o.nos, sentKg: o.kg,
        recvNos: b.nos, recvKg: b.kg,
        pendingNos: Math.max(0, o.nos - b.nos),
        extraNos: Math.max(0, b.nos - o.nos),
        kgPct: o.kg > 0 ? +(((b.kg - o.kg) / o.kg) * 100).toFixed(1) : null,
        colours: [...b.colours].sort(),
        sharedWeighment: o.shared || b.shared,
      }
    })
    .sort((a, c) => c.pendingNos - a.pendingNos || c.sentNos - a.sentNos)
}

export interface ReconTotals {
  sentNos: number; sentKg: number
  recvNos: number; recvKg: number
  nosPct: number | null
  kgPct: number | null
  pendingNos: number
  pendingLines: number
  /** TBC is three sections clubbed, so its lines are worth three on the floor */
  tbcLines: number
}

export function reconTotals(rows: ReconRow[]): ReconTotals {
  const t = rows.reduce((a, r) => ({
    sentNos: a.sentNos + r.sentNos, sentKg: +(a.sentKg + r.sentKg).toFixed(2),
    recvNos: a.recvNos + r.recvNos, recvKg: +(a.recvKg + r.recvKg).toFixed(2),
    pendingNos: a.pendingNos + r.pendingNos,
  }), { sentNos: 0, sentKg: 0, recvNos: 0, recvKg: 0, pendingNos: 0 })

  return {
    ...t,
    nosPct: t.sentNos > 0 ? +(((t.recvNos - t.sentNos) / t.sentNos) * 100).toFixed(1) : null,
    kgPct: t.sentKg > 0 ? +(((t.recvKg - t.sentKg) / t.sentKg) * 100).toFixed(1) : null,
    pendingLines: rows.filter(r => r.pendingNos > 0).length,
    tbcLines: RECEIVED.filter(isTbc).length,
  }
}
