/* ── Four rates for the same section ───────────────────────────────────────
   A fabricator taking four hundred pieces does not pay what a homeowner
   taking six pays, and the salesman should not have to work that out or ring
   the owner. Each section carries four rates. A customer sits on one of them
   by default, and a large enough quantity moves the line to a better one on
   its own.

   Below all four sits a floor. A salesman may work down to it and no
   further, so a discount can be given at the counter without anyone selling
   under cost by accident.                                                 */

import { P, type Product } from './catalogue'
import { CLIENTS, type Client } from './parties'

export type Level = 1 | 2 | 3 | 4

export const LEVEL_NAMES: Record<Level, string> = {
  1: 'Counter', 2: 'Fabricator', 3: 'Dealer', 4: 'Bulk',
}

/** How much better each rate is than the list rate. */
const OFF: Record<Level, number> = { 1: 0, 2: 0.03, 3: 0.055, 4: 0.08 }

/** Where a customer starts, before any quantity is counted. */
export const levelForType = (type: Client['type']): Level =>
  type === 'Dealer' ? 3
  : type === 'B2B Fabricator' ? 2
  : type === 'Builder / Contractor' ? 2 : 1

export interface Tier {
  level: Level
  name: string
  /** the quantity, in the item's own sale unit, that earns this rate */
  fromQty: number
  rate: number
}

export interface RateCard {
  code: string
  name: string
  unit: string
  category: string
  listRate: number
  cost: number
  tiers: Tier[]
  /** nobody may sell below this, whatever their role */
  floor: number
}

/* Bigger, cheaper items move tier at smaller counts than beading does. */
function thresholds(p: Product): [number, number, number] {
  if (p.unit === 'kg') return [50, 200, 500]
  if (p.unit === 'sqft') return [100, 400, 1000]
  return [25, 100, 300]
}

export const RATE_CARDS: RateCard[] = P.map(p => {
  const [t2, t3, t4] = thresholds(p)
  const tiers: Tier[] = ([1, 2, 3, 4] as Level[]).map(l => ({
    level: l,
    name: LEVEL_NAMES[l],
    fromQty: l === 1 ? 0 : l === 2 ? t2 : l === 3 ? t3 : t4,
    rate: +(p.ratePerKg * (1 - OFF[l])).toFixed(2),
  }))
  return {
    code: p.code, name: p.name, unit: p.unit, category: p.category,
    listRate: p.ratePerKg, cost: p.costPerKg, tiers,
    // Six per cent over landed cost — thin, but never a loss.
    floor: +(p.costPerKg * 1.06).toFixed(2),
  }
})

export const cardFor = (code: string) => RATE_CARDS.find(c => c.code === code)

export interface Applied {
  level: Level
  name: string
  rate: number
  floor: number
  /** which of the two decided it */
  because: 'customer' | 'quantity' | 'both'
  customerLevel: Level
  quantityLevel: Level
  /** the next tier, and how much more has to go on the line to reach it */
  next?: { level: Level; name: string; rate: number; moreQty: number }
}

/** The rate this customer gets for this quantity of this item. */
export function rateFor(code: string, qty: number, customerType: Client['type']): Applied | null {
  const card = cardFor(code)
  if (!card) return null

  const customerLevel = levelForType(customerType)
  const quantityLevel = [...card.tiers].reverse().find(t => qty >= t.fromQty)?.level ?? 1
  // Whichever of the two is better for the customer wins.
  const level = Math.max(customerLevel, quantityLevel) as Level
  const tier = card.tiers.find(t => t.level === level)!

  const upper = card.tiers.find(t => t.level === level + 1)
  return {
    level, name: tier.name, rate: tier.rate, floor: card.floor,
    because: customerLevel === quantityLevel ? 'both' : customerLevel > quantityLevel ? 'customer' : 'quantity',
    customerLevel, quantityLevel,
    next: upper ? { level: upper.level, name: upper.name, rate: upper.rate, moreQty: Math.max(0, upper.fromQty - qty) } : undefined,
  }
}

export const CUSTOMER_LEVELS = CLIENTS.map(c => ({
  id: c.id, name: c.name, type: c.type, level: levelForType(c.type), levelName: LEVEL_NAMES[levelForType(c.type)],
}))
