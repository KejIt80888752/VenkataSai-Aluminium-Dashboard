/* ── Three shop-floor registers the office keeps on paper today ────────────
   Returns to the mill, what physically leaves each gate, and what the bank
   actually credited. Each is derived from existing documents so the figures
   agree with the rest of the dashboard.                                    */

import { PURCHASES, INVOICES, MONTHS } from './txns'
import { CHALLANS } from './challans'
import { TODAY } from './company'

const addDays = (d: string, n: number) => {
  const t = new Date(d); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10)
}

/* ── 1. Returns to the mill for a manufacturing defect ─────────────────── */

export const DEFECTS = [
  'Bend / twist beyond tolerance',
  'Die lines on visible face',
  'Wall thickness under section spec',
  'Surface scratch / handling damage',
  'Shade variation from approved panel',
  'White rust / storage corrosion',
] as const
export type Defect = typeof DEFECTS[number]

export type ReturnStatus = 'Raised' | 'Picked Up' | 'Credit Note Received' | 'Replacement Received' | 'Disputed'

export interface MaterialReturn {
  no: string
  date: string
  againstBill: string
  toUnit: string          // M1 — the mill that made it
  supplier: string
  section: string
  nos: number
  weightKg: number
  defect: Defect
  value: number
  debitNote: string
  status: ReturnStatus
  ageDays: number
  raisedBy: string
}

const INSPECTORS = ['Ganesh P', 'Kavya M', 'Ramesh K', 'Suresh N']

export const RETURNS: MaterialReturn[] = PURCHASES
  .filter((_, i) => i % 4 === 2)                       // a defect on roughly one load in four
  .map((p, i) => {
    const nos      = 12 + (i * 7) % 60
    const weightKg = +(nos * (1.6 + (i % 5) * 0.35)).toFixed(1)
    const value    = Math.round(weightKg * 268)
    const date     = addDays(p.date, 3 + (i % 6))
    const status: ReturnStatus =
      i % 5 === 0 ? 'Credit Note Received'
      : i % 5 === 1 ? 'Replacement Received'
      : i % 5 === 2 ? 'Picked Up'
      : i % 5 === 3 ? 'Raised' : 'Disputed'
    return {
      no: `RTN/26-27/${String(i + 1).padStart(3, '0')}`,
      date, againstBill: p.no, toUnit: 'M1', supplier: p.supplier,
      section: CHALLANS[i % CHALLANS.length]?.lines[0]?.name ?? 'Aluminium Section',
      nos, weightKg, defect: DEFECTS[i % DEFECTS.length], value,
      debitNote: `DN/26-27/${String(i + 1).padStart(3, '0')}`,
      status,
      ageDays: Math.max(0, Math.floor((new Date(TODAY).getTime() - new Date(date).getTime()) / 86400000)),
      raisedBy: INSPECTORS[i % INSPECTORS.length],
    }
  })

/* ── 2. Gate register — what physically left, and was it billed ────────── */

export type GateStatus = 'Billed' | 'On Delivery Challan' | 'Not Billed' | 'Returnable — Not Back'
export const GATES = [
  { id: 'SHOP', label: 'Shop — K R Puram Counter', cams: ['CAM-01 Counter', 'CAM-02 Shutter'] },
  { id: 'GD1',  label: 'Godown 1 — Main',          cams: ['CAM-03 Gate', 'CAM-04 Loading Bay'] },
  { id: 'GD2',  label: 'Godown 2 — 4th Floor',     cams: ['CAM-05 Lift Lobby', 'CAM-06 Stairwell'] },
] as const

export interface GatePass {
  no: string
  date: string
  time: string
  gate: string
  gateLabel: string
  vehicle: string
  party: string
  section: string
  nos: number
  weightKg: number
  value: number
  linkedDoc: string
  status: GateStatus
  camera: string
  clipRef: string
  guard: string
}

const GUARDS = ['Anand S', 'Mahesh B', 'Ravi T']
const VEHICLES = ['KA 01 AB 4412', 'KA 05 MJ 7789', 'KA 41 C 2231', 'KA 03 AL 9067', 'KA 51 B 1180']

export const GATE_PASSES: GatePass[] = INVOICES.slice(0, 90).map((inv, i) => {
  const g = GATES[i % GATES.length]
  const nos      = 18 + (i * 11) % 90
  const weightKg = +(nos * (1.4 + (i % 4) * 0.4)).toFixed(1)
  // Most go out against a bill. A few leave on a challan, and a handful leave
  // with nothing against them at all — those are the ones worth looking at.
  const status: GateStatus =
    i % 17 === 5  ? 'Not Billed'
    : i % 13 === 3 ? 'Returnable — Not Back'
    : i % 5 === 2  ? 'On Delivery Challan' : 'Billed'
  return {
    no: `GP/26-27/${String(i + 1).padStart(4, '0')}`,
    date: inv.date,
    time: `${String(9 + (i % 9)).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}`,
    gate: g.id, gateLabel: g.label,
    vehicle: VEHICLES[i % VEHICLES.length],
    party: inv.clientName,
    section: inv.lines[0]?.name ?? 'Aluminium Section',
    nos, weightKg, value: Math.round(weightKg * 291),
    linkedDoc: status === 'Billed' ? inv.no
      : status === 'On Delivery Challan' ? CHALLANS[i % CHALLANS.length].no
      : status === 'Returnable — Not Back' ? `RGP/${String(i + 1).padStart(3, '0')}` : '—',
    status,
    camera: g.cams[i % g.cams.length],
    clipRef: `${g.id}-${inv.date.replace(/-/g, '')}-${String(9 + (i % 9)).padStart(2, '0')}${String((i * 17) % 60).padStart(2, '0')}`,
    guard: GUARDS[i % GUARDS.length],
  }
}).sort((a, b) => b.date.localeCompare(a.date))

/* ── 3. Bank statement against receipts entered ────────────────────────── */

export type BankStatus = 'Matched to Receipt' | 'Credit Not Entered' | 'Receipt Not in Bank' | 'Part Settled'

export interface BankLine {
  date: string
  ref: string
  narration: string
  credit: number
  party: string
  matchedTo: string
  entered: number
  status: BankStatus
  month: string
}

const MODES = ['NEFT', 'RTGS', 'UPI', 'IMPS', 'CHQ'] as const

export const BANK_LINES: BankLine[] = INVOICES
  .filter(inv => inv.received > 0)
  .slice(0, 120)
  .map((inv, i) => {
    const mode = MODES[i % MODES.length]
    const status: BankStatus =
      i % 14 === 4 ? 'Credit Not Entered'
      : i % 19 === 7 ? 'Receipt Not in Bank'
      : i % 11 === 3 ? 'Part Settled' : 'Matched to Receipt'
    const credit  = status === 'Receipt Not in Bank' ? 0 : inv.received
    const entered = status === 'Credit Not Entered' ? 0
      : status === 'Part Settled' ? Math.round(inv.received * 0.6) : inv.received
    return {
      date: inv.dueDate > TODAY ? inv.date : inv.dueDate,
      ref: `${mode}/${String(48210000 + i * 137)}`,
      narration: `${mode} ${inv.clientName.split(' ').slice(0, 3).join(' ')}`,
      credit, party: inv.clientName,
      matchedTo: status === 'Credit Not Entered' ? '—' : inv.no,
      entered, status,
      month: MONTHS.find(m => (inv.dueDate > TODAY ? inv.date : inv.dueDate).startsWith(m.key))?.label ?? '',
    }
  })
  .sort((a, b) => b.date.localeCompare(a.date))
