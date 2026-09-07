/* ── What a thing cost, against what we still sell it for ──────────────────
   Aluminium moves with the LME and the mill's monthly circular, so a rate
   agreed in April is not the rate in August. The loss does not happen at the
   moment the cost rises — it happens in the weeks afterwards, while the
   selling rate is still the old one and nobody has noticed.               */

import { P, type Product } from './catalogue'
import { LOTS } from './lots'
import { TODAY } from './company'

export interface CostPoint {
  date: string
  supplier: string
  dcNo: string
  ratePerKg: number
}

export interface PriceWatch {
  code: string
  name: string
  category: string
  history: CostPoint[]
  /** the rate on the most recent purchase */
  latestCost: number
  previousCost: number
  costChangePct: number
  sellingRate: number
  /** when the selling rate was last touched */
  spUpdated: string
  marginPct: number
  /** margin at the time the selling rate was set */
  marginWhenSet: number
  daysSinceSpUpdate: number
  status: 'Healthy' | 'Margin Slipped' | 'Selling Below Cost' | 'Cost Rose — SP Pending'
  stockAtRisk: number
}

const days = (from: string, to: string) =>
  Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000))

/** Cost history comes off the lots — each one carries its own purchase. */
function historyFor(p: Product): CostPoint[] {
  return LOTS.filter(l => l.code === p.code)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l, i) => ({
      date: l.date,
      supplier: l.supplier,
      dcNo: l.dcNo,
      // Mill circulars move a few percent at a time, mostly upward this year.
      ratePerKg: +(p.costPerKg * (1 + (i * 0.028) - 0.03)).toFixed(2),
    }))
}

export const PRICE_WATCH: PriceWatch[] = P.map((p, pi) => {
  const history = historyFor(p)
  const latestCost = history.length ? history[history.length - 1].ratePerKg : p.costPerKg
  const previousCost = history.length > 1 ? history[history.length - 2].ratePerKg : latestCost

  // The selling rate was last set some weeks ago, at an older cost.
  const spAge = 12 + (pi * 17) % 95
  const d = new Date(TODAY); d.setDate(d.getDate() - spAge)
  const spUpdated = d.toISOString().slice(0, 10)

  const costWhenSet = history.find(h => h.date <= spUpdated)?.ratePerKg ?? history[0]?.ratePerKg ?? p.costPerKg
  const sellingRate = p.ratePerKg

  const marginPct = +(((sellingRate - latestCost) / sellingRate) * 100).toFixed(1)
  const marginWhenSet = +(((sellingRate - costWhenSet) / sellingRate) * 100).toFixed(1)
  const costChangePct = +(((latestCost - previousCost) / previousCost) * 100).toFixed(2)

  const status: PriceWatch['status'] =
    sellingRate <= latestCost ? 'Selling Below Cost'
    : marginWhenSet - marginPct >= 3 ? 'Cost Rose — SP Pending'
    : marginPct < 8 ? 'Margin Slipped' : 'Healthy'

  return {
    code: p.code, name: p.name, category: p.category,
    history, latestCost, previousCost, costChangePct,
    sellingRate, spUpdated, marginPct, marginWhenSet,
    daysSinceSpUpdate: days(spUpdated, TODAY),
    status,
    stockAtRisk: Math.round(p.stockPcs * p.kgPerLength * (sellingRate - latestCost)),
  }
})

export const PRICE_SUMMARY = {
  total: PRICE_WATCH.length,
  pending: PRICE_WATCH.filter(w => w.status === 'Cost Rose — SP Pending').length,
  belowCost: PRICE_WATCH.filter(w => w.status === 'Selling Below Cost').length,
  slipped: PRICE_WATCH.filter(w => w.status === 'Margin Slipped').length,
  healthy: PRICE_WATCH.filter(w => w.status === 'Healthy').length,
  /** money the old selling rate is quietly giving away on stock in hand */
  giveaway: PRICE_WATCH
    .filter(w => w.status !== 'Healthy')
    .reduce((s, w) => s + Math.max(0, Math.round((w.marginWhenSet - w.marginPct) / 100 * w.sellingRate
      * (P.find(p => p.code === w.code)?.stockPcs ?? 0) * (P.find(p => p.code === w.code)?.kgPerLength ?? 0))), 0),
}
