/* ── Delivery challans, coating jobs and material position ──────────────
   Raw sections leave the mill on an outward DC to a powder coating unit.
   The coater returns them on one or more inward DCs — heavier, because the
   powder adds weight. Outstanding at a PCU is simply what went in less what
   came back, tracked in BOTH pieces and kilograms.                        */

import { COATABLE, profileOf, sqftFor } from './sections'
import { POWDER_SHADES, ROUTES } from './locations'
import { TODAY } from './company'

/* ── seeded RNG (independent stream from the sales book) ────────────── */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(77431109)
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
const between = (a: number, b: number) => a + rnd() * (b - a)
const iBetween = (a: number, b: number) => Math.floor(between(a, b + 1))

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
const dayDiff = (a: string, b: string) =>
  Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)

const CUT_LENGTHS = [12, 12, 12, 16, 10, 7.5, 12, 15]
const VEHICLES = ['KA 05 MJ 4471', 'KA 41 AB 8123', 'KA 03 CR 2290', 'KA 51 HG 7714', 'KA 02 KL 3388', 'KA 41 AB 9902']
const DRIVERS  = ['Shivanna', 'Mahesh', 'Iqbal', 'Ravi', 'Kumar']

/* ── DC line: every column the paper challan carries ────────────────── */
export interface DCLine {
  slNo: number
  code: string
  name: string
  batchNo: string
  lotNo: string
  bundles: number
  qtyPerBundle: number
  totalNos: number
  cutLengthFt: number
  /** per-piece weight range printed on the mill challan */
  wtRangeMin: number
  wtRangeMax: number
  bundleWeightKg: number
  totalWeightKg: number
  sqft: number
  /** free-text column the shop uses for taxable-qty notes */
  remarksTaxQty: string
}

export interface DC {
  id: string
  no: string
  date: string
  routeId: string
  from: string
  to: string
  leg: 'Outward to Coating' | 'Inward from Coating' | 'Internal Transfer'
  coatingCompany: string
  shadeCode: string
  shadeName: string
  vehicleNo: string
  driver: string
  ewayBill: string
  lines: DCLine[]
  totalNos: number
  totalWeightKg: number
  totalSqft: number
  status: 'In Transit' | 'Received' | 'Short Received'
  receivedDate: string
  remarks: string
  /** inward DCs point back at the outward DC they are returning against */
  againstDc: string
}

let dcSeq = 0
const MONTH_KEYS = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08']
const monthDays = (k: string) => (k === '2026-08' ? 20 : k === '2026-04' || k === '2026-06' ? 30 : 31)

function makeLines(count: number, coatedGain: number | null): DCLine[] {
  const used = new Set<string>()
  const lines: DCLine[] = []
  for (let i = 0; i < count; i++) {
    const p = pick(COATABLE)
    if (used.has(p.code)) continue
    used.add(p.code)

    const cut = pick(CUT_LENGTHS)
    const bundles = iBetween(2, 14)
    const qtyPerBundle = pick([5, 6, 8, 10, 10, 12, 15])
    const totalNos = bundles * qtyPerBundle

    // Mill weight scales with cut length off the standard 12 ft length.
    const perPiece = +(p.kgPerLength * (cut / (p.lengthFt || 12))).toFixed(3)
    const spread = perPiece * 0.02
    const gain = coatedGain === null ? 1 : 1 + coatedGain / 100
    const totalWeightKg = +(totalNos * perPiece * gain).toFixed(1)

    lines.push({
      slNo: i + 1,
      code: p.code,
      name: p.name,
      batchNo: `BT/${MONTH_KEYS[iBetween(0, 4)].slice(2).replace('-', '')}/${String(iBetween(101, 989))}`,
      lotNo: `LOT-${iBetween(2604, 2608)}-${String(iBetween(100, 999))}`,
      bundles,
      qtyPerBundle,
      totalNos,
      cutLengthFt: cut,
      wtRangeMin: +(perPiece * gain - spread).toFixed(3),
      wtRangeMax: +(perPiece * gain + spread).toFixed(3),
      bundleWeightKg: +(totalWeightKg / bundles).toFixed(2),
      totalWeightKg,
      sqft: sqftFor(p.code, totalNos, cut),
      remarksTaxQty: rnd() < 0.22 ? pick(['Tax qty as per bundle', 'Short 1 pc — mill', 'Bent pcs 2 — set aside', 'Extra 1 bundle free']) : '—',
    })
  }
  return lines
}

const roll = (lines: DCLine[]) => ({
  totalNos: lines.reduce((s, l) => s + l.totalNos, 0),
  totalWeightKg: +lines.reduce((s, l) => s + l.totalWeightKg, 0).toFixed(1),
  totalSqft: +lines.reduce((s, l) => s + l.sqft, 0).toFixed(1),
})

/* ── Outward: mill → coating unit ───────────────────────────────────── */
const OUTWARD: DC[] = MONTH_KEYS.flatMap(mk =>
  Array.from({ length: mk === '2026-08' ? 6 : iBetween(9, 12) }, () => {
    const r = pick(ROUTES.filter(x => x.leg === 'Outward to Coating'))
    const shade = pick(POWDER_SHADES)
    const date = `${mk}-${String(iBetween(1, monthDays(mk))).padStart(2, '0')}`
    const lines = makeLines(iBetween(1, 4), null)
    if (!lines.length) return null
    dcSeq++
    return {
      id: `DC${dcSeq}`,
      no: `VSA/DC/26-27/${String(dcSeq).padStart(4, '0')}`,
      date,
      routeId: r.id, from: r.from, to: r.to, leg: r.leg,
      coatingCompany: r.to,
      shadeCode: shade.code, shadeName: shade.name,
      vehicleNo: pick(VEHICLES), driver: pick(DRIVERS),
      ewayBill: `${iBetween(100, 999)}${iBetween(1000000000, 9999999999)}`,
      lines, ...roll(lines),
      status: (dayDiff(date, TODAY) <= 1 ? 'In Transit' : 'Received') as DC['status'],
      receivedDate: dayDiff(date, TODAY) <= 1 ? '—' : addDays(date, iBetween(0, 1)),
      remarks: rnd() < 0.3 ? pick(['Urgent — site delivery', 'Match previous shade lot', 'Cut to size at PCU']) : '—',
      againstDc: '—',
    }
  }).filter(Boolean) as DC[],
).sort((a, b) => a.date.localeCompare(b.date))

/* ── Inward: coating unit → shop / godown, against an outward DC ─────── */
const INWARD: DC[] = []

for (const out of OUTWARD) {
  const prof = out.lines.map(l => profileOf(l.code)!)
  const avgExpected = prof.reduce((s, p) => s + p.expectedGainPct, 0) / prof.length
  const daysSince = dayDiff(out.date, TODAY)

  // Still on the line — nothing has come back yet.
  if (daysSince < 5 || rnd() < 0.10) continue

  const returns = rnd() < 0.68 ? 1 : 2
  const totalShare = returns === 1 ? [rnd() < 0.82 ? 1 : between(0.55, 0.9)] : [between(0.4, 0.65), 0]
  if (returns === 2) totalShare[1] = Math.min(1 - totalShare[0], rnd() < 0.7 ? 1 - totalShare[0] : between(0.15, 0.35))

  totalShare.forEach((share, k) => {
    if (share <= 0.02) return
    const dest = pick(ROUTES.filter(x => x.leg === 'Inward from Coating' && x.from === out.to))
    if (!dest) return
    const date = addDays(out.date, iBetween(5, 14) + k * iBetween(3, 8))
    if (date > TODAY) return

    // Actual gain wanders around the expected figure for the profile mix.
    const actualGain = +(avgExpected + between(-1.3, 1.6)).toFixed(2)

    const lines: DCLine[] = out.lines.map((l, i) => {
      const nos = Math.max(1, Math.round(l.totalNos * share))
      const perPiece = (l.totalWeightKg / l.totalNos) * (1 + actualGain / 100)
      const wt = +(nos * perPiece).toFixed(1)
      const bundles = Math.max(1, Math.round(nos / l.qtyPerBundle))
      return {
        ...l,
        slNo: i + 1,
        bundles,
        totalNos: nos,
        totalWeightKg: wt,
        wtRangeMin: +(perPiece * 0.99).toFixed(3),
        wtRangeMax: +(perPiece * 1.01).toFixed(3),
        bundleWeightKg: +(wt / bundles).toFixed(2),
        sqft: sqftFor(l.code, nos, l.cutLengthFt),
        remarksTaxQty: rnd() < 0.15 ? pick(['Coating patch — 1 pc', 'Shade lot 2', 'Rework 2 pcs pending']) : '—',
      }
    })
    dcSeq++
    INWARD.push({
      id: `DC${dcSeq}`,
      no: `VSA/RC/26-27/${String(dcSeq).padStart(4, '0')}`,
      date,
      routeId: dest.id, from: dest.from, to: dest.to, leg: dest.leg,
      coatingCompany: out.to,
      shadeCode: out.shadeCode, shadeName: out.shadeName,
      vehicleNo: pick(VEHICLES), driver: pick(DRIVERS),
      ewayBill: `${iBetween(100, 999)}${iBetween(1000000000, 9999999999)}`,
      lines, ...roll(lines),
      status: (dayDiff(date, TODAY) <= 2 ? 'In Transit' : 'Received') as DC['status'],
      receivedDate: dayDiff(date, TODAY) <= 2 ? '—' : addDays(date, 0),
      remarks: share < 0.95 ? 'Part lot — balance to follow' : '—',
      againstDc: out.no,
    })
  })
}

export const CHALLANS: DC[] = [...OUTWARD, ...INWARD].sort((a, b) => b.date.localeCompare(a.date))

/* ── Coating job: one outward DC and everything returned against it ──── */
export interface CoatingJob {
  dcNo: string
  date: string
  pcu: string
  shadeName: string
  sentNos: number
  sentKg: number
  sqft: number
  returnedNos: number
  returnedKg: number
  pendingNos: number
  pendingKg: number
  /** actual weight gain on the portion returned, % */
  actualGainPct: number
  expectedGainPct: number
  variancePct: number
  withinTolerance: boolean
  ageDays: number
  status: 'Fully Returned' | 'Partially Returned' | 'At Coater' | 'Overdue at Coater'
  returns: { no: string; date: string; to: string; nos: number; kg: number }[]
  coatingValue: number
}

export const COATING_JOBS: CoatingJob[] = OUTWARD.map(out => {
  const rets = INWARD.filter(i => i.againstDc === out.no)
  const returnedNos = rets.reduce((s, r) => s + r.totalNos, 0)
  const returnedKg = +rets.reduce((s, r) => s + r.totalWeightKg, 0).toFixed(1)

  // Gain is measured on the raw weight of the portion actually returned.
  const rawOfReturned = out.lines.reduce((s, l) => {
    const ret = rets.reduce((n, r) => n + (r.lines.find(x => x.code === l.code)?.totalNos ?? 0), 0)
    return s + (l.totalWeightKg / l.totalNos) * ret
  }, 0)
  const actualGainPct = rawOfReturned > 0 ? +(((returnedKg - rawOfReturned) / rawOfReturned) * 100).toFixed(2) : 0

  const prof = out.lines.map(l => profileOf(l.code)!)
  const expectedGainPct = +(prof.reduce((s, p) => s + p.expectedGainPct, 0) / prof.length).toFixed(2)
  const tol = prof.reduce((s, p) => s + p.tolerancePct, 0) / prof.length
  const variancePct = +(actualGainPct - expectedGainPct).toFixed(2)

  const pendingNos = out.totalNos - returnedNos
  const pendingKg = +(out.totalWeightKg - rawOfReturned).toFixed(1)
  const ageDays = dayDiff(out.date, TODAY)
  const turnaround = out.to === 'PCU1' ? 6 : 8

  const status: CoatingJob['status'] =
    pendingNos <= 0 ? 'Fully Returned'
    : returnedNos > 0 ? 'Partially Returned'
    : ageDays > turnaround + 4 ? 'Overdue at Coater'
    : 'At Coater'

  const shade = POWDER_SHADES.find(s => s.code === out.shadeCode)!
  const rate = (out.to === 'PCU1' ? 11.5 : 10.8) + shade.surcharge

  return {
    dcNo: out.no, date: out.date, pcu: out.to, shadeName: out.shadeName,
    sentNos: out.totalNos, sentKg: out.totalWeightKg, sqft: out.totalSqft,
    returnedNos, returnedKg,
    pendingNos: Math.max(0, pendingNos), pendingKg: Math.max(0, pendingKg),
    actualGainPct, expectedGainPct, variancePct,
    withinTolerance: Math.abs(variancePct) <= tol,
    ageDays, status,
    returns: rets.map(r => ({ no: r.no, date: r.date, to: r.to, nos: r.totalNos, kg: r.totalWeightKg })),
    coatingValue: Math.round(out.totalSqft * rate),
  }
}).sort((a, b) => b.date.localeCompare(a.date))

/* ── Position of material right now ─────────────────────────────────── */
export const pcuOutstanding = (pcu: string) => {
  const jobs = COATING_JOBS.filter(j => j.pcu === pcu && j.pendingNos > 0)
  return {
    pcu,
    jobs: jobs.length,
    nos: jobs.reduce((s, j) => s + j.pendingNos, 0),
    kg: +jobs.reduce((s, j) => s + j.pendingKg, 0).toFixed(1),
    overdue: jobs.filter(j => j.status === 'Overdue at Coater').length,
    oldestDays: jobs.length ? Math.max(...jobs.map(j => j.ageDays)) : 0,
    value: jobs.reduce((s, j) => s + j.coatingValue, 0),
  }
}

export const IN_TRANSIT = CHALLANS.filter(d => d.status === 'In Transit')

/** Section-wise coating gain, rolled up across every returned job. */
export const gainBySection = (() => {
  const m = new Map<string, { code: string; name: string; rawKg: number; coatedKg: number; nos: number; expected: number }>()
  for (const out of OUTWARD) {
    const rets = INWARD.filter(i => i.againstDc === out.no)
    for (const l of out.lines) {
      const retNos = rets.reduce((n, r) => n + (r.lines.find(x => x.code === l.code)?.totalNos ?? 0), 0)
      if (!retNos) continue
      const retKg = rets.reduce((n, r) => n + (r.lines.find(x => x.code === l.code)?.totalWeightKg ?? 0), 0)
      const e = m.get(l.code) ?? { code: l.code, name: l.name, rawKg: 0, coatedKg: 0, nos: 0, expected: profileOf(l.code)!.expectedGainPct }
      e.rawKg += (l.totalWeightKg / l.totalNos) * retNos
      e.coatedKg += retKg
      e.nos += retNos
      m.set(l.code, e)
    }
  }
  return [...m.values()].map(e => ({
    ...e,
    rawKg: +e.rawKg.toFixed(1),
    coatedKg: +e.coatedKg.toFixed(1),
    gainKg: +(e.coatedKg - e.rawKg).toFixed(1),
    actualGainPct: +(((e.coatedKg - e.rawKg) / e.rawKg) * 100).toFixed(2),
    variancePct: +((((e.coatedKg - e.rawKg) / e.rawKg) * 100) - e.expected).toFixed(2),
  })).sort((a, b) => b.coatedKg - a.coatedKg)
})()

export const COATING_TOTALS = {
  sentKg:     +OUTWARD.reduce((s, d) => s + d.totalWeightKg, 0).toFixed(1),
  sentNos:    OUTWARD.reduce((s, d) => s + d.totalNos, 0),
  returnedKg: +INWARD.reduce((s, d) => s + d.totalWeightKg, 0).toFixed(1),
  returnedNos: INWARD.reduce((s, d) => s + d.totalNos, 0),
  gainKg:     +gainBySection.reduce((s, g) => s + g.gainKg, 0).toFixed(1),
  sqft:       +OUTWARD.reduce((s, d) => s + d.totalSqft, 0).toFixed(1),
  coatingValue: COATING_JOBS.reduce((s, j) => s + j.coatingValue, 0),
  outOfTolerance: COATING_JOBS.filter(j => j.returnedNos > 0 && !j.withinTolerance).length,
}
