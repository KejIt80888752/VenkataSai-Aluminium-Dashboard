/* ── Turnkey work without counting the same material twice ─────────────────
   The trap: material for a project leaves the godown, so a sale bill gets
   raised to take it off stock — and then a turnkey bill goes to the customer
   for the finished windows. The same material is now in the books twice.

   The way out is that material for our own project never leaves on a sale
   bill. It leaves on an internal issue: stock drops, and the cost lands on
   the project instead of on a customer. Only the turnkey bill goes out. The
   project then carries its own material, bought-outside, labour and site
   costs, and its profit is the turnkey bill less all of them.             */

import { P } from './catalogue'
import { CLIENTS } from './parties'
import { TODAY } from './company'

export type Stage = 'Measurement' | 'Fabrication' | 'Installation' | 'Handover' | 'Closed'
export const STAGES: Stage[] = ['Measurement', 'Fabrication', 'Installation', 'Handover', 'Closed']

export interface Issue {
  date: string; dcNo: string; code: string; name: string
  nos: number; kg: number; costPerKg: number; value: number
}
export interface OutsidePurchase {
  date: string; supplier: string; billNo: string; description: string; value: number
}
export interface SiteCost {
  date: string; kind: 'Labour' | 'Transport' | 'Site Expense' | 'Sub-contract'; description: string; value: number
}
export interface ProjectBill {
  no: string; date: string; description: string; taxable: number; tax: number; total: number; received: number
}
export interface Update {
  date: string; stage: Stage; note: string; by: string
}

export interface Project {
  id: string; no: string; name: string; clientId: string; client: string
  site: string; startDate: string; targetDate: string; stage: Stage
  issues: Issue[]; purchases: OutsidePurchase[]; costs: SiteCost[]
  bills: ProjectBill[]; updates: Update[]
}

const back = (n: number) => { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
const fwd = (n: number) => { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

const SITES = [
  'Prestige Lakeside — Tower C', 'Brigade Cornerstone — Block 4', 'Sobha Dream Acres — Phase 2',
  'Private villa, Whitefield', 'Commercial floor, Hoodi',
]
const SUPERVISORS = ['Ramesh K', 'Suresh N', 'Ganesh P']

/* Sections a window job actually consumes, in the proportions it consumes them. */
const MIX = ['VSA-SL-3T-OF', 'VSA-SL-3T-SH', 'VSA-SL-INTL', 'VSA-OP-BEAD', 'VSA-PT-TPAT']

function build(i: number): Project {
  const client = CLIENTS[i % CLIENTS.length]
  const stage = STAGES[i % STAGES.length]
  const started = 40 + i * 18

  const issues: Issue[] = MIX.slice(0, 3 + (i % 3)).map((code, j) => {
    const p = P.find(x => x.code === code) ?? P[0]
    const nos = 40 + ((i * 7 + j * 11) % 90)
    const kgv = +(nos * p.kgPerLength).toFixed(1)
    return {
      date: back(started - j * 4), dcNo: `ISS/26-27/${String(i * 10 + j + 1).padStart(3, '0')}`,
      code: p.code, name: p.name, nos, kg: kgv,
      costPerKg: p.costPerKg, value: Math.round(kgv * p.costPerKg),
    }
  })

  const purchases: OutsidePurchase[] = [
    { date: back(started - 6), supplier: 'Saint-Gobain Glass Distributor', billNo: `SGG/${4100 + i}`,
      description: '5mm toughened glass, cut to size', value: 38000 + i * 4200 },
    { date: back(started - 9), supplier: 'Ozone / Ebco Hardware Agency', billNo: `OZN/${2200 + i}`,
      description: 'Sliding rollers, locks, handles', value: 14500 + i * 1800 },
  ].slice(0, i % 3 === 0 ? 1 : 2)

  const costs: SiteCost[] = [
    { date: back(started - 12), kind: 'Labour' as const, description: 'Fabrication — 4 men, 6 days', value: 26000 + i * 2400 },
    { date: back(started - 16), kind: 'Transport' as const, description: 'Material to site', value: 4200 + i * 350 },
    { date: back(started - 20), kind: 'Site Expense' as const, description: 'Scaffolding and silicone', value: 6800 + i * 600 },
  ].slice(0, stage === 'Measurement' ? 0 : stage === 'Fabrication' ? 1 : 3)

  const materialCost = issues.reduce((s, x) => s + x.value, 0)
  const outside = purchases.reduce((s, x) => s + x.value, 0)
  const site = costs.reduce((s, x) => s + x.value, 0)
  const cost = materialCost + outside + site

  // Turnkey is quoted on the finished window, not on material plus a margin.
  const quoted = Math.round(cost * (1.34 + (i % 4) * 0.05))
  const billedShare = stage === 'Measurement' ? 0 : stage === 'Fabrication' ? 0.4 : stage === 'Installation' ? 0.7 : 1
  const bills: ProjectBill[] = billedShare === 0 ? [] : [{
    no: `VSA/TK/26-27/${String(i + 1).padStart(3, '0')}`,
    date: back(Math.max(2, started - 26)),
    description: billedShare < 1 ? 'Turnkey — part billing against progress' : 'Turnkey — aluminium windows, supply and installation',
    taxable: Math.round(quoted * billedShare),
    tax: Math.round(quoted * billedShare * 0.18),
    total: Math.round(quoted * billedShare * 1.18),
    received: Math.round(quoted * billedShare * 1.18 * (stage === 'Closed' ? 1 : 0.55)),
  }]

  const updates: Update[] = STAGES.slice(0, STAGES.indexOf(stage) + 1).map((s, j) => ({
    date: back(started - j * 9),
    stage: s,
    by: SUPERVISORS[(i + j) % SUPERVISORS.length],
    note: s === 'Measurement' ? 'Site measured, window schedule signed by the architect'
      : s === 'Fabrication' ? 'Sections cut and assembled at the shop'
      : s === 'Installation' ? 'Frames fixed, glazing in progress'
      : s === 'Handover' ? 'Snag list cleared, handed over to the customer'
      : 'Final payment received, project closed',
  }))

  return {
    id: `PRJ${i + 1}`, no: `PRJ/26-27/${String(i + 1).padStart(3, '0')}`,
    name: `${['3 Track sliding windows', 'Openable windows and ventilators', 'Aluminium partition and doors',
             'Glass railing and louvers', 'ACP elevation and windows'][i % 5]}`,
    clientId: client.id, client: client.name,
    site: SITES[i % SITES.length],
    startDate: back(started), targetDate: fwd(30 - i * 6),
    stage, issues, purchases, costs, bills, updates,
  }
}

export const PROJECTS: Project[] = Array.from({ length: 7 }, (_, i) => build(i))

/* A job only has a profit once it has been billed in full. Before that the
   cost is simply ahead of the billing, which is how the work runs — calling
   that a loss would read as if the projects were losing money. */
export const isComplete = (p: Project) => p.stage === 'Handover' || p.stage === 'Closed'

export const rollup = (p: Project) => {
  const material = p.issues.reduce((s, x) => s + x.value, 0)
  const outside = p.purchases.reduce((s, x) => s + x.value, 0)
  const site = p.costs.reduce((s, x) => s + x.value, 0)
  const cost = material + outside + site
  const billed = p.bills.reduce((s, x) => s + x.taxable, 0)
  const received = p.bills.reduce((s, x) => s + x.received, 0)
  const invoiced = p.bills.reduce((s, x) => s + x.total, 0)
  const profit = billed - cost
  const complete = isComplete(p)
  return {
    material, outside, site, cost, billed, invoiced, received, profit, complete,
    /** cost carried on a job that is not fully billed yet */
    wip: complete ? 0 : Math.max(0, cost - billed),
    marginPct: billed > 0 ? +((profit / billed) * 100).toFixed(1) : 0,
    kgIssued: +p.issues.reduce((s, x) => s + x.kg, 0).toFixed(1),
    outstanding: invoiced - received,
  }
}

export const PROJECT_TOTALS = PROJECTS.reduce((a, p) => {
  const r = rollup(p)
  return {
    cost: a.cost + r.cost,
    billed: a.billed + r.billed,
    material: a.material + r.material,
    outstanding: a.outstanding + r.outstanding,
    kg: +(a.kg + r.kgIssued).toFixed(1),
    // Profit counts only the jobs that are finished and fully billed.
    closedProfit: a.closedProfit + (r.complete ? r.profit : 0),
    closedBilled: a.closedBilled + (r.complete ? r.billed : 0),
    closedCount: a.closedCount + (r.complete ? 1 : 0),
    wip: a.wip + r.wip,
    wipCount: a.wipCount + (r.complete ? 0 : 1),
  }
}, { cost: 0, billed: 0, material: 0, outstanding: 0, kg: 0,
     closedProfit: 0, closedBilled: 0, closedCount: 0, wip: 0, wipCount: 0 })
