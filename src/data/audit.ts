/* ── Who did what, and when ────────────────────────────────────────────────
   Not a debugging log. It answers the questions that come up in a shop: who
   changed that rate, who let that lorry out, who took a copy of the customer
   list. Anything that leaves the building — an export, a share, a print — is
   recorded with what it contained.                                        */

import { INVOICES, PURCHASES } from './txns'
import { TODAY } from './company'

export type Act =
  | 'Signed in' | 'Bill raised' | 'Bill edited' | 'Bill deleted'
  | 'Rate changed' | 'Stock corrected' | 'Correction approved'
  | 'Gate pass released' | 'Receipt entered' | 'Exported' | 'Printed'
  | 'Customer added' | 'User added' | 'Sign-in refused'

export const ACTS: Act[] = [
  'Signed in', 'Bill raised', 'Bill edited', 'Bill deleted', 'Rate changed', 'Stock corrected',
  'Correction approved', 'Gate pass released', 'Receipt entered', 'Exported', 'Printed',
  'Customer added', 'User added', 'Sign-in refused',
]

/** The ones worth a second look on their own. */
export const SENSITIVE: Act[] = ['Bill deleted', 'Rate changed', 'Exported', 'Sign-in refused', 'User added']

export interface Entry {
  id: string
  at: string          // ISO with time
  who: string
  role: string
  act: Act
  on: string          // the document or record
  detail: string
  /** rows that left the building, where the act was an export or print */
  rows?: number
  device: string
}

const PEOPLE = [
  { who: 'D. Nageswara Rao', role: 'Admin' },
  { who: 'Srinivas B', role: 'Manager' },
  { who: 'Kavya M', role: 'Sales Executive' },
  { who: 'Ganesh P', role: 'Store Keeper' },
  { who: 'Lakshmi R', role: 'Accountant' },
]
const DEVICES = ['Counter PC', 'Godown tablet', 'Office laptop', 'Owner phone']

const stamp = (daysBack: number, i: number) => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - daysBack)
  d.setHours(9 + (i % 10), (i * 13) % 60, (i * 7) % 60)
  return d.toISOString()
}

export const AUDIT: Entry[] = Array.from({ length: 120 }, (_, i) => {
  const p = PEOPLE[i % PEOPLE.length]
  const act = ACTS[i % ACTS.length]
  const inv = INVOICES[i % INVOICES.length]
  const pur = PURCHASES[i % PURCHASES.length]

  const on =
    act.startsWith('Bill') ? inv.no
    : act === 'Rate changed' ? 'VSA-SL-3T-SH'
    : act === 'Stock corrected' || act === 'Correction approved' ? 'VSA-PT-BOX at GD1'
    : act === 'Gate pass released' ? `GP/26-27/${String(1000 + i).slice(-4)}`
    : act === 'Receipt entered' ? pur.no
    : act === 'Exported' || act === 'Printed' ? ['Customer list', 'Purchase register', 'Stock valuation', 'Invoice register'][i % 4]
    : act === 'Customer added' ? 'Sri Lakshmi Fabricators'
    : act === 'User added' ? 'store2@venkatasaialuminium.com'
    : p.who

  const detail =
    act === 'Rate changed' ? 'Selling rate 322.00 → 341.00 per kg'
    : act === 'Bill edited' ? 'Remarks and due date changed'
    : act === 'Bill deleted' ? 'Raised in error, customer never took delivery'
    : act === 'Stock corrected' ? 'Book 560 → counted 465, cutting loss'
    : act === 'Correction approved' ? 'Approved by the owner'
    : act === 'Gate pass released' ? 'Scan and weighbridge agreed'
    : act === 'Receipt entered' ? 'NEFT posted against the bill'
    : act === 'Exported' ? 'CSV downloaded'
    : act === 'Printed' ? 'Sent to the counter printer'
    : act === 'Sign-in refused' ? 'Wrong password, third attempt'
    : act === 'Signed in' ? 'Password and fingerprint'
    : '—'

  return {
    id: `LOG${String(i + 1).padStart(4, '0')}`,
    at: stamp(Math.floor(i / 6), i),
    who: p.who, role: p.role, act, on, detail,
    rows: act === 'Exported' || act === 'Printed' ? 40 + (i * 17) % 900 : undefined,
    device: DEVICES[i % DEVICES.length],
  }
}).sort((a, b) => b.at.localeCompare(a.at))

export const AUDIT_SUMMARY = {
  total: AUDIT.length,
  sensitive: AUDIT.filter(e => SENSITIVE.includes(e.act)).length,
  exports: AUDIT.filter(e => e.act === 'Exported'),
  refused: AUDIT.filter(e => e.act === 'Sign-in refused').length,
  rowsOut: AUDIT.filter(e => e.act === 'Exported').reduce((s, e) => s + (e.rows ?? 0), 0),
}
