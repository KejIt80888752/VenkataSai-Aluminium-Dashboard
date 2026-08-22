/* ── Where the material physically sits, and what it is doing ───────────
   Catalogue stock is what the business owns at its own premises. This file
   splits that across shop and godowns, adds what is lying at the coaters
   and on the road, and derives consumption velocity for the alert engine. */

import { P, stockQty, type Product } from './catalogue'
import { INVOICES, MONTHS } from './txns'
import { SUPPLIERS } from './parties'
import { CHALLANS, COATING_JOBS, IN_TRANSIT, pcuOutstanding } from './challans'
import { TODAY } from './company'

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(31415926)
const between = (a: number, b: number) => a + rnd() * (b - a)
const iBetween = (a: number, b: number) => Math.floor(between(a, b + 1))
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]

/** Trading days elapsed in the year so far — the denominator for velocity. */
const DAYS_ELAPSED = MONTHS.reduce((s, m) => s + m.days, 0)

/* ── Stock split across shop and godowns ────────────────────────────── */
export interface LocationStock {
  code: string
  name: string
  category: string
  unit: string
  shop: number
  gd1: number
  gd2: number
  atStores: number
  atPcu1: number
  atPcu2: number
  inTransit: number
  total: number
  kgAtStores: number
  minStock: number
  avgDaily: number
  days15: number
  coverDays: number
}

/* Held quantities are read off the challan lines so the piece counts tie back. */
const heldMap = (() => {
  const m = new Map<string, { PCU1: number; PCU2: number; transit: number }>()
  for (const j of COATING_JOBS) {
    if (j.pendingNos <= 0) continue
    const out = CHALLANS.find(d => d.no === j.dcNo)
    if (!out) continue
    const share = j.pendingNos / j.sentNos
    for (const l of out.lines) {
      const e = m.get(l.code) ?? { PCU1: 0, PCU2: 0, transit: 0 }
      if (j.pcu === 'PCU1') e.PCU1 += Math.round(l.totalNos * share)
      else e.PCU2 += Math.round(l.totalNos * share)
      m.set(l.code, e)
    }
  }
  for (const d of IN_TRANSIT)
    for (const l of d.lines) {
      const e = m.get(l.code) ?? { PCU1: 0, PCU2: 0, transit: 0 }
      e.transit += l.totalNos
      m.set(l.code, e)
    }
  return m
})()

/** Pieces of each code sold so far — drives consumption and fast-moving. */
export const soldPieces = (() => {
  const m = new Map<string, { qty: number; value: number; bills: number }>()
  for (const inv of INVOICES)
    for (const l of inv.lines) {
      const p = P.find(x => x.code === l.code)
      if (!p) continue
      const pcs = p.unit === 'kg' ? l.qty / p.kgPerLength : l.qty
      const e = m.get(l.code) ?? { qty: 0, value: 0, bills: 0 }
      e.qty += pcs; e.value += l.amount; e.bills++
      m.set(l.code, e)
    }
  return m
})()

export const LOCATION_STOCK: LocationStock[] = P.map(p => {
  // Fast movers sit at the shop counter; bulk lives in the godowns.
  const shopShare = between(0.18, 0.38)
  const gd2Share = p.godown === 'Yard 2' ? between(0.35, 0.55) : between(0.08, 0.22)
  const shop = Math.round(p.stockPcs * shopShare)
  const gd2 = Math.round(p.stockPcs * gd2Share)
  const gd1 = p.stockPcs - shop - gd2

  const held = heldMap.get(p.code) ?? { PCU1: 0, PCU2: 0, transit: 0 }
  const sold = soldPieces.get(p.code)?.qty ?? 0
  const avgDaily = +(sold / DAYS_ELAPSED).toFixed(2)
  const total = p.stockPcs + held.PCU1 + held.PCU2 + held.transit

  return {
    code: p.code, name: p.name, category: p.category, unit: p.unit,
    shop, gd1, gd2,
    atStores: p.stockPcs,
    atPcu1: held.PCU1, atPcu2: held.PCU2, inTransit: held.transit,
    total,
    kgAtStores: +stockQty(p).toFixed(1),
    minStock: p.reorderPcs,
    avgDaily,
    days15: Math.ceil(avgDaily * 15),
    coverDays: avgDaily > 0 ? Math.round(p.stockPcs / avgDaily) : 999,
  }
})

export const locTotals = (key: 'shop' | 'gd1' | 'gd2' | 'atPcu1' | 'atPcu2' | 'inTransit') =>
  LOCATION_STOCK.reduce((s, l) => s + l[key], 0)

/** Weight held at each node, for the dual-unit view. */
export const weightAt = (key: 'shop' | 'gd1' | 'gd2' | 'atPcu1' | 'atPcu2' | 'inTransit') =>
  +LOCATION_STOCK.reduce((s, l) => {
    const p = P.find(x => x.code === l.code)!
    return s + (p.unit === 'kg' ? l[key] * p.kgPerLength : 0)
  }, 0).toFixed(1)

/* ── Alert buckets ──────────────────────────────────────────────────── */
export const belowMinimum = LOCATION_STOCK.filter(l => l.atStores <= l.minStock)
export const below15Days  = LOCATION_STOCK.filter(l => l.days15 > 0 && l.atStores < l.days15)
export const fastMoving   = [...LOCATION_STOCK]
  .filter(l => l.avgDaily > 0)
  .sort((a, b) => b.avgDaily - a.avgDaily)
  .slice(0, 10)

export const PCU_OUTSTANDING = [pcuOutstanding('PCU1'), pcuOutstanding('PCU2')]

/* ── Open purchase orders ───────────────────────────────────────────── */
export interface PurchaseOrder {
  id: string
  no: string
  date: string
  supplierId: string
  supplier: string
  expectedDate: string
  items: { code: string; name: string; orderedNos: number; receivedNos: number; ratePerKg: number; kg: number }[]
  orderedNos: number
  receivedNos: number
  pendingNos: number
  value: number
  status: 'Confirmed — Awaiting Delivery' | 'Part Received' | 'Overdue' | 'Closed'
  followUps: number
}

const PO_POOL: Product[] = P.filter(p => p.unit === 'kg')

export const PURCHASE_ORDERS: PurchaseOrder[] = Array.from({ length: 11 }, (_, i) => {
  const s = pick(SUPPLIERS)
  const day = iBetween(1, 20)
  const date = `2026-0${day > 12 ? 7 : 8}-${String(iBetween(1, 28)).padStart(2, '0')}`
  const expected = (() => {
    const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() + s.leadDays)
    return d.toISOString().slice(0, 10)
  })()

  const items = Array.from({ length: iBetween(1, 3) }, () => {
    const p = pick(PO_POOL)
    const ordered = iBetween(40, 220)
    const r = rnd()
    const received = r < 0.45 ? 0 : r < 0.8 ? Math.round(ordered * between(0.3, 0.85)) : ordered
    return {
      code: p.code, name: p.name,
      orderedNos: ordered, receivedNos: received,
      ratePerKg: p.costPerKg,
      kg: +(ordered * p.kgPerLength).toFixed(1),
    }
  })

  const orderedNos = items.reduce((a, x) => a + x.orderedNos, 0)
  const receivedNos = items.reduce((a, x) => a + x.receivedNos, 0)
  const value = Math.round(items.reduce((a, x) => a + x.kg * x.ratePerKg, 0))

  const status: PurchaseOrder['status'] =
    receivedNos >= orderedNos ? 'Closed'
    : expected < TODAY ? 'Overdue'
    : receivedNos > 0 ? 'Part Received'
    : 'Confirmed — Awaiting Delivery'

  return {
    id: `PO${i + 1}`,
    no: `VSA/PO/26-27/${String(i + 1).padStart(3, '0')}`,
    date, supplierId: s.id, supplier: s.name, expectedDate: expected,
    items, orderedNos, receivedNos, pendingNos: Math.max(0, orderedNos - receivedNos),
    value, status,
    followUps: status === 'Overdue' ? iBetween(1, 4) : 0,
  }
}).filter(p => p.status !== 'Closed').sort((a, b) => a.expectedDate.localeCompare(b.expectedDate))

/* ── Weekly physical stock check ────────────────────────────────────── */
export interface StockCheckRow {
  code: string
  name: string
  location: string
  bookPcs: number
  countedPcs: number
  diffPcs: number
  bookKg: number
  countedKg: number
  diffKg: number
  /** true when the difference is explained by the standard weight being stale */
  weightDrift: boolean
  action: 'Auto-adjust from latest DC' | 'Post manual adjustment' | 'No action'
}

export const STOCK_CHECK: StockCheckRow[] = LOCATION_STOCK
  .filter(() => rnd() < 0.42)
  .slice(0, 18)
  .map(l => {
    const p = P.find(x => x.code === l.code)!
    const diffPcs = rnd() < 0.55 ? 0 : iBetween(-6, 5)
    const drift = p.unit === 'kg' && rnd() < 0.45
    const bookKg = +(l.atStores * p.kgPerLength).toFixed(1)
    const countedKg = +(bookKg * (drift ? between(0.972, 0.995) : 1) + diffPcs * p.kgPerLength).toFixed(1)
    return {
      code: l.code, name: l.name,
      location: pick(['SHOP', 'GD1', 'GD2']),
      bookPcs: l.atStores,
      countedPcs: l.atStores + diffPcs,
      diffPcs,
      bookKg,
      countedKg,
      diffKg: +(countedKg - bookKg).toFixed(1),
      weightDrift: drift,
      action: drift ? 'Auto-adjust from latest DC' : diffPcs !== 0 ? 'Post manual adjustment' : 'No action',
    }
  })

export const CHECK_SUMMARY = {
  rows: STOCK_CHECK.length,
  matched: STOCK_CHECK.filter(r => r.diffPcs === 0 && !r.weightDrift).length,
  pieceVariance: STOCK_CHECK.reduce((s, r) => s + Math.abs(r.diffPcs), 0),
  weightVarianceKg: +STOCK_CHECK.reduce((s, r) => s + r.diffKg, 0).toFixed(1),
  autoAdjustable: STOCK_CHECK.filter(r => r.weightDrift).length,
}
