/* ── Deterministic transaction book for FY 2026–27 ─────────────────────
   Everything below is generated from a fixed seed, so the numbers stay
   identical on every reload and reconcile across Sales, Purchases,
   Outstanding, GST and P&L.                                            */

import { P, type Product } from './catalogue'
import { CLIENTS, SUPPLIERS, type Client } from './parties'
import { TODAY } from './company'

/* ── seeded RNG ─────────────────────────────────────────────────────── */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20260820)
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]
const between = (a: number, b: number) => a + rnd() * (b - a)
const iBetween = (a: number, b: number) => Math.floor(between(a, b + 1))

/* ── calendar ───────────────────────────────────────────────────────── */
export const MONTHS = [
  { key: '2026-04', label: 'Apr', days: 30 },
  { key: '2026-05', label: 'May', days: 31 },
  { key: '2026-06', label: 'Jun', days: 30 },
  { key: '2026-07', label: 'Jul', days: 31 },
  { key: '2026-08', label: 'Aug', days: 20 }, // month-to-date
]
const iso = (mKey: string, day: number) => `${mKey}-${String(day).padStart(2, '0')}`
const addDays = (isoDate: string, n: number) => {
  const d = new Date(isoDate + 'T00:00:00'); d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/* ── types ──────────────────────────────────────────────────────────── */
export interface Line {
  code: string; name: string; hsn: string; unit: string
  qty: number; rate: number; gst: number; amount: number; cost: number
}
export interface Invoice {
  id: string; no: string; date: string; dueDate: string
  clientId: string; clientName: string; gstin: string; state: string
  poNo: string; vehicle: string; ewayBill: string; remarks: string
  lines: Line[]
  taxable: number; cgst: number; sgst: number; igst: number; roundOff: number; total: number
  cogs: number
  received: number
  status: 'Paid' | 'Partial' | 'Unpaid' | 'Overdue'
  mode: 'NEFT' | 'UPI' | 'Cheque' | 'Cash' | 'Credit'
}

const interState = (c: Client) => c.state !== 'Karnataka'

/* Product mix — sections move most, consumables ride along. */
const HOT: Product[] = P.filter(p => ['Sliding Sections', 'Openable / Casement', 'Partition & Door'].includes(p.category))
const REST: Product[] = P.filter(p => !HOT.includes(p))

function buildLines(retail = false): Line[] {
  const n = retail ? iBetween(1, 2) : iBetween(1, 5)
  const chosen = new Set<string>()
  const lines: Line[] = []
  for (let i = 0; i < n; i++) {
    const p = rnd() < 0.62 ? pick(HOT) : pick(REST)
    if (chosen.has(p.code)) continue
    chosen.add(p.code)

    let qty: number
    if (p.unit === 'kg')      qty = +(iBetween(...(retail ? [2, 12] : [8, 80]) as [number, number]) * p.kgPerLength).toFixed(1)
    else if (p.unit === 'sqft') qty = iBetween(...(retail ? [20, 90] : [80, 620]) as [number, number])
    else                      qty = iBetween(...(retail ? [4, 30] : [20, 240]) as [number, number])

    const disc = between(0, 0.04)                       // negotiated trade discount
    const rate = +(p.ratePerKg * (1 - disc)).toFixed(2)
    lines.push({
      code: p.code, name: p.name, hsn: p.hsn, unit: p.unit,
      qty, rate, gst: p.gst,
      amount: +(qty * rate).toFixed(2),
      cost:   +(qty * p.costPerKg).toFixed(2),
    })
  }
  return lines
}

function priceInvoice(lines: Line[], c: Client) {
  const taxable = +lines.reduce((s, l) => s + l.amount, 0).toFixed(2)
  const cogs    = +lines.reduce((s, l) => s + l.cost,   0).toFixed(2)
  const tax     = +(taxable * 0.18).toFixed(2)
  const inter   = interState(c)
  const gross   = taxable + tax
  const total   = Math.round(gross)
  return {
    taxable, cogs,
    cgst: inter ? 0 : +(tax / 2).toFixed(2),
    sgst: inter ? 0 : +(tax / 2).toFixed(2),
    igst: inter ? tax : 0,
    roundOff: +(total - gross).toFixed(2),
    total,
  }
}

/* ── Sales invoices ─────────────────────────────────────────────────── */
const SELLABLE = CLIENTS.filter(c => c.status !== 'Dormant')
let invSeq = 0

export const INVOICES: Invoice[] = MONTHS.flatMap(m => {
  const count = m.label === 'Aug' ? 22 : iBetween(30, 36)
  return Array.from({ length: count }, () => {
    const day    = iBetween(1, m.days)
    const date   = iso(m.key, day)
    const isRetail = rnd() < 0.10
    const client = isRetail ? CLIENTS[11] : pick(SELLABLE.filter(c => c.type !== 'B2C Retail'))
    const lines  = buildLines(isRetail)
    const money  = priceInvoice(lines, client)
    const due    = addDays(date, client.creditDays)

    // Settlement behaviour: older bills mostly cleared, recent ones open.
    const age = Math.floor((new Date(TODAY).getTime() - new Date(date).getTime()) / 86400000)
    let received: number
    if (client.creditDays === 0)      received = money.total
    else if (age > client.creditDays + 25) received = rnd() < 0.88 ? money.total : Math.round(money.total * between(.3, .8))
    else if (age > client.creditDays)      received = rnd() < 0.60 ? money.total : Math.round(money.total * between(.2, .7))
    else                                    received = rnd() < 0.35 ? money.total : Math.round(money.total * between(0, .5))

    const outstanding = money.total - received
    const status: Invoice['status'] =
      outstanding <= 0 ? 'Paid'
      : due < TODAY    ? 'Overdue'
      : received > 0   ? 'Partial'
      : 'Unpaid'

    invSeq++
    return {
      id: `INV${invSeq}`,
      no: `VSA/26-27/${String(invSeq).padStart(4, '0')}`,
      date, dueDate: due,
      clientId: client.id, clientName: client.name, gstin: client.gstin, state: client.state,
      poNo:     rnd() < 0.45 ? `PO-${iBetween(1000, 9999)}` : '—',
      vehicle:  `KA ${iBetween(1, 53).toString().padStart(2, '0')} ${pick(['AB','MJ','KL','CR','HG'])} ${iBetween(1000, 9999)}`,
      ewayBill: money.total > 50000 ? `${iBetween(100, 999)}${iBetween(1000000000, 9999999999)}` : '—',
      // Free text the counter writes on a bill. Salesman names go here too,
      // which is how the office later pulls up one man's bills.
      remarks: rnd() < 0.72
        ? pick(['Siva Reddy — sales bill', 'Siva Reddy — sales bill', 'Murali — counter sale',
                'Prakash — site delivery', 'Tax qty as per bundle weight',
                'Cut to size at shop — end pieces retained', 'Material issued from Godown 2 (4F)',
                'Coated lot — shade RAL9016', 'Balance qty to follow on next DC'])
        : '—',
      lines, ...money,
      received,
      status,
      mode: client.creditDays === 0 ? pick(['Cash', 'UPI'] as const) : pick(['NEFT', 'Cheque', 'Credit', 'NEFT'] as const),
    }
  })
}).sort((a, b) => a.date.localeCompare(b.date))

/* ── Purchases ──────────────────────────────────────────────────────── */
export interface Purchase {
  id: string; no: string; date: string; dueDate: string
  supplierId: string; supplier: string; gstin: string; state: string
  category: string
  taxable: number; cgst: number; sgst: number; igst: number; total: number
  paid: number
  status: 'Paid' | 'Partial' | 'Unpaid' | 'Overdue'
  items: number
  weightKg: number
}

let poSeq = 0
export const PURCHASES: Purchase[] = MONTHS.flatMap(m => {
  const count = m.label === 'Aug' ? 5 : iBetween(6, 8)
  return Array.from({ length: count }, () => {
    const s       = pick(SUPPLIERS)
    const date    = iso(m.key, iBetween(1, m.days))
    const taxable = Math.round(between(280000, 1150000) / 100) * 100
    const tax     = +(taxable * 0.18).toFixed(2)
    const inter   = s.state !== 'Karnataka'
    const total   = Math.round(taxable + tax)
    const due     = addDays(date, s.creditDays)
    const age     = Math.floor((new Date(TODAY).getTime() - new Date(date).getTime()) / 86400000)
    const paid    = age > s.creditDays + 10 ? total
                  : age > s.creditDays      ? (rnd() < .7 ? total : Math.round(total * between(.4, .9)))
                  : (rnd() < .4 ? total : Math.round(total * between(0, .6)))
    poSeq++
    return {
      id: `PUR${poSeq}`,
      no: `PB/26-27/${String(poSeq).padStart(3, '0')}`,
      date, dueDate: due,
      supplierId: s.id, supplier: s.name, gstin: s.gstin, state: s.state,
      category: s.category,
      taxable,
      cgst: inter ? 0 : +(tax / 2).toFixed(2),
      sgst: inter ? 0 : +(tax / 2).toFixed(2),
      igst: inter ? tax : 0,
      total, paid,
      status: (paid >= total ? 'Paid' : due < TODAY ? 'Overdue' : paid > 0 ? 'Partial' : 'Unpaid') as Purchase['status'],
      items: iBetween(2, 9),
      weightKg: Math.round(taxable / between(275, 340)),
    }
  })
}).sort((a, b) => a.date.localeCompare(b.date))

/* ── Quotations ─────────────────────────────────────────────────────── */
export interface Quotation {
  id: string; no: string; date: string; validTill: string
  clientId: string; clientName: string
  subject: string
  lines: Line[]
  taxable: number; tax: number; total: number
  status: 'Sent' | 'Under Negotiation' | 'Won' | 'Lost' | 'Expired'
  owner: string
}

const SUBJECTS = [
  '3 Track sliding windows — Block A',
  'Aluminium partition for office fit-out',
  'Openable casement windows — villa project',
  'ACP cladding — front elevation',
  'Toughened glass shopfront',
  'Louver ventilators — stilt parking',
  'Wood-finish door frames — 24 flats',
  'Sliding + mesh windows — 2BHK block',
  'Aluminium sheet & coil bulk supply',
]
const OWNERS = ['Nageswara Rao', 'Srinivas B', 'Kavya M']

export const QUOTATIONS: Quotation[] = Array.from({ length: 16 }, (_, i) => {
  const m      = pick(MONTHS)
  const date   = iso(m.key, iBetween(1, m.days))
  const client = pick(SELLABLE)
  const lines  = buildLines()
  const taxable = +lines.reduce((s, l) => s + l.amount, 0).toFixed(2)
  const tax     = +(taxable * 0.18).toFixed(2)
  const r = rnd()
  return {
    id: `Q${i + 1}`,
    no: `VSA/QT/26-27/${String(i + 1).padStart(3, '0')}`,
    date, validTill: addDays(date, 15),
    clientId: client.id, clientName: client.name,
    subject: pick(SUBJECTS),
    lines, taxable, tax, total: Math.round(taxable + tax),
    status: (r < .34 ? 'Won' : r < .52 ? 'Under Negotiation' : r < .68 ? 'Sent' : r < .86 ? 'Lost' : 'Expired') as Quotation['status'],
    owner: pick(OWNERS),
  }
}).sort((a, b) => b.date.localeCompare(a.date))

/* ── Leads (website / walk-in / referral enquiries) ──────────────────── */
export interface Lead {
  id: string; date: string; name: string; phone: string; area: string
  source: 'Website Enquiry' | 'Walk-in' | 'Referral' | 'WhatsApp' | 'Google Search' | 'Facebook'
  requirement: string
  estValue: number
  stage: 'New' | 'Contacted' | 'Quoted' | 'Converted' | 'Dropped'
  owner: string
}

const LEAD_NAMES = ['Harish Babu','Sunitha Rao','Mohammed Arif','Praveen Kumar','Deepa Shetty','Ravi Teja','Nithin Gowda','Ayesha Khan','Srikanth M','Lokesh N','Bhavana R','Gopal Krishna','Zaheer Ahmed','Manoj Pillai']
const AREAS = ['K R Puram','Whitefield','Hoskote','Medahalli','Battarahalli','Hoodi','TC Palya','Budigere','Kadugodi','Ramamurthy Nagar']
const REQS  = [
  '3 track sliding windows — 8 nos','Aluminium partition 400 sqft','ACP elevation cladding',
  'Openable windows for duplex','Toughened glass railing','Mosquito mesh sliding windows',
  'Door frames — 12 nos','Louver ventilators — 6 nos','Aluminium sheet 1.6mm — bulk',
  'Shopfront glazing work','Balcony sliding doors','Full house windows — 2BHK',
]

export const LEADS: Lead[] = Array.from({ length: 22 }, (_, i) => {
  const m = pick(MONTHS)
  const r = rnd()
  return {
    id: `L${i + 1}`,
    date: iso(m.key, iBetween(1, m.days)),
    name: LEAD_NAMES[i % LEAD_NAMES.length],
    phone: `+91 ${iBetween(70, 99)}${iBetween(100, 999)} ${iBetween(10000, 99999)}`,
    area: pick(AREAS),
    source: pick(['Website Enquiry','Walk-in','Referral','WhatsApp','Google Search','Facebook'] as const),
    requirement: pick(REQS),
    estValue: Math.round(between(18000, 640000) / 1000) * 1000,
    stage: (r < .18 ? 'New' : r < .40 ? 'Contacted' : r < .64 ? 'Quoted' : r < .84 ? 'Converted' : 'Dropped') as Lead['stage'],
    owner: pick(OWNERS),
  }
}).sort((a, b) => b.date.localeCompare(a.date))

/* ── Stock movement ledger ──────────────────────────────────────────── */
export interface Movement {
  id: string; date: string; code: string; name: string
  type: 'Inward' | 'Outward' | 'Adjustment' | 'Return'
  pcs: number; kg: number
  ref: string; party: string
}

export const MOVEMENTS: Movement[] = Array.from({ length: 46 }, (_, i) => {
  const p = pick(P)
  const m = pick(MONTHS)
  const r = rnd()
  const type: Movement['type'] = r < .38 ? 'Inward' : r < .86 ? 'Outward' : r < .94 ? 'Return' : 'Adjustment'
  const pcs = iBetween(4, 90)
  return {
    id: `M${i + 1}`,
    date: iso(m.key, iBetween(1, m.days)),
    code: p.code, name: p.name,
    type, pcs,
    kg: +(pcs * p.kgPerLength).toFixed(1),
    ref: type === 'Inward' ? `PB/26-27/${String(iBetween(1, 34)).padStart(3, '0')}` : `VSA/26-27/${String(iBetween(1, 95)).padStart(4, '0')}`,
    party: type === 'Inward' ? pick(SUPPLIERS).name : pick(SELLABLE).name,
  }
}).sort((a, b) => b.date.localeCompare(a.date))

/* ── Fixed operating overheads per month (₹) ────────────────────────── */
export const OVERHEADS = {
  'Godown Rent':         65000,
  'Salaries & Wages':   148000,
  'Loading / Unloading':  32000,
  'Transport & Freight':  41000,
  'Electricity & Misc':   14500,
  'Marketing':             8000,
}
export const MONTHLY_OVERHEAD = Object.values(OVERHEADS).reduce((a, b) => a + b, 0)

/* ── Aggregates ─────────────────────────────────────────────────────── */
export const monthlySales = MONTHS.map(m => {
  const inv = INVOICES.filter(i => i.date.startsWith(m.key))
  const revenue = inv.reduce((s, i) => s + i.taxable, 0)
  const cogs    = inv.reduce((s, i) => s + i.cogs, 0)
  const purch   = PURCHASES.filter(p => p.date.startsWith(m.key)).reduce((s, p) => s + p.taxable, 0)
  return {
    m: m.label,
    revenue: Math.round(revenue),
    cogs: Math.round(cogs),
    grossProfit: Math.round(revenue - cogs),
    netProfit: Math.round(revenue - cogs - MONTHLY_OVERHEAD),
    purchases: Math.round(purch),
    invoices: inv.length,
  }
})

export const TOTALS = {
  revenue:     monthlySales.reduce((s, m) => s + m.revenue, 0),
  cogs:        monthlySales.reduce((s, m) => s + m.cogs, 0),
  grossProfit: monthlySales.reduce((s, m) => s + m.grossProfit, 0),
  netProfit:   monthlySales.reduce((s, m) => s + m.netProfit, 0),
  purchases:   monthlySales.reduce((s, m) => s + m.purchases, 0),
  invoiced:    INVOICES.reduce((s, i) => s + i.total, 0),
  collected:   INVOICES.reduce((s, i) => s + i.received, 0),
  get receivable() { return this.invoiced - this.collected },
  payable:     PURCHASES.reduce((s, p) => s + (p.total - p.paid), 0),
  outputGst:   INVOICES.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0),
  inputGst:    PURCHASES.reduce((s, p) => s + p.cgst + p.sgst + p.igst, 0),
}

export const salesByCategory = (() => {
  const map = new Map<string, number>()
  for (const inv of INVOICES)
    for (const l of inv.lines) {
      const cat = P.find(p => p.code === l.code)?.category ?? 'Other'
      map.set(cat, (map.get(cat) ?? 0) + l.amount)
    }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value)
})()

export const topClients = (() => {
  const map = new Map<string, { name: string; value: number; bills: number }>()
  for (const inv of INVOICES) {
    const e = map.get(inv.clientId) ?? { name: inv.clientName, value: 0, bills: 0 }
    e.value += inv.taxable; e.bills++
    map.set(inv.clientId, e)
  }
  return [...map.values()]
    .map(c => ({ ...c, value: Math.round(c.value) }))
    .sort((a, b) => b.value - a.value)
})()

export const topProducts = (() => {
  const map = new Map<string, { code: string; name: string; qty: number; unit: string; value: number }>()
  for (const inv of INVOICES)
    for (const l of inv.lines) {
      const e = map.get(l.code) ?? { code: l.code, name: l.name, qty: 0, unit: l.unit, value: 0 }
      e.qty += l.qty; e.value += l.amount
      map.set(l.code, e)
    }
  return [...map.values()]
    .map(p => ({ ...p, qty: Math.round(p.qty), value: Math.round(p.value) }))
    .sort((a, b) => b.value - a.value)
})()
