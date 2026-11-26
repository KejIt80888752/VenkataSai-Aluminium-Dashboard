/* ── The diary: every date the business already holds, on one calendar ─────
   Theirs, on 26-11: "add a calendar".

   Nothing here is typed twice. A bill's due date, a purchase order's expected
   date, an offer's validity, a lead's next follow-up and the coating sheets'
   own dates are already on those records; this reads them and says which day
   each one falls on. The only rows the calendar owns are the office's own
   notes — a site visit, a measurement, a payment promised on the phone —
   because those have nowhere else to live.

   One register, one kind. A day cell can then be read at a glance: blue is
   money coming in, red is money going out, amber is material on its way.    */

import { useMemo } from 'react'
import { useCrud, type Crud } from './store'
import { useCoatBook } from './coatbook-store'
import { INVOICES, PURCHASES, QUOTATIONS, LEADS, type Invoice, type Purchase, type Quotation, type Lead } from '@/data/txns'
import { PURCHASE_ORDERS, type PurchaseOrder } from '@/data/positions'

/* ── What a day can hold ──────────────────────────────────────────────── */

export type DiaryKind =
  | 'money-in'   // a customer's bill falls due
  | 'money-out'  // a supplier's bill falls due
  | 'material'   // a purchase order is expected in
  | 'offer'      // a quotation, estimate or proforma runs out
  | 'follow-up'  // a lead to be rung
  | 'coating'    // material loaded out to a coater, or back from one
  | 'note'       // the office's own entry

export interface DiaryEntry {
  id: string
  /** yyyy-mm-dd */
  date: string
  kind: DiaryKind
  title: string
  who?: string
  amount?: number
  /** "240 nos", "1,120 kg" — where the day is about material, not money */
  qty?: string
  /** the screen this came from, so a day can be opened where it lives */
  to?: string
  /** settled, received, closed: it stays on the day but never goes red */
  done?: boolean
}

/** An entry the office writes itself. */
export interface DiaryNote {
  id: string
  date: string
  /** "10:30", or empty for an all-day note */
  time: string
  title: string
  who: string
  detail: string
  kind: DiaryKind
  done: boolean
}

export const KIND_META: Record<DiaryKind, { label: string; dot: string; badge: string }> = {
  'money-in':  { label: 'Payment due to us',    dot: 'bg-sky-500',    badge: 'badge-blue'   },
  'money-out': { label: 'Payment due by us',    dot: 'bg-red-500',    badge: 'badge-red'    },
  material:    { label: 'Material expected',    dot: 'bg-amber-500',  badge: 'badge-yellow' },
  offer:       { label: 'Offer validity ends',  dot: 'bg-violet-500', badge: 'badge-purple' },
  'follow-up': { label: 'Follow-up',            dot: 'bg-green-500',  badge: 'badge-green'  },
  coating:     { label: 'Coating movement',     dot: 'bg-teal-500',   badge: 'badge-brand'  },
  note:        { label: 'Our own note',         dot: 'bg-slate-400',  badge: 'badge-gray'   },
}

export const ALL_KINDS = Object.keys(KIND_META) as DiaryKind[]

/* ── Dates, without the timezone trap ─────────────────────────────────────
   new Date().toISOString() is UTC, so between midnight and 5:30 a.m. in
   India it hands back yesterday. These stay on the local clock.            */

export const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const todayIso = () => isoOf(new Date())

export const dateOf = (iso: string) => new Date(iso + 'T00:00:00')

export const addDays = (iso: string, n: number) => {
  const d = dateOf(iso); d.setDate(d.getDate() + n); return isoOf(d)
}

/* ── The office's own notes ───────────────────────────────────────────── */

const NO_NOTES: DiaryNote[] = []
const noteId = (n: DiaryNote) => n.id

export function newNote(date: string): DiaryNote {
  return {
    id: `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    date, time: '', title: '', who: '', detail: '', kind: 'note', done: false,
  }
}

/* ── Reading the registers ────────────────────────────────────────────── */

const inv  = (i: Invoice) => i.no
const pur  = (p: Purchase) => p.no
const quo  = (q: Quotation) => q.no
const po   = (p: PurchaseOrder) => p.id
const lead = (l: Lead) => l.id

const NO_QUOTES: Quotation[] = []

export interface Diary {
  /** every dated thing, earliest first */
  entries: DiaryEntry[]
  /** the same, keyed by yyyy-mm-dd */
  byDay: Map<string, DiaryEntry[]>
  notes: Crud<DiaryNote>
}

export function useDiary(): Diary {
  const invoices  = useCrud<Invoice>('invoices', INVOICES, inv)
  const purchases = useCrud<Purchase>('purchases', PURCHASES, pur)
  const quotes    = useCrud<Quotation>('quotations', QUOTATIONS, quo)
  const estimates = useCrud<Quotation>('estimates', NO_QUOTES, quo)
  const proformas = useCrud<Quotation>('proformas', NO_QUOTES, quo)
  const orders    = useCrud<PurchaseOrder>('purchase-orders', PURCHASE_ORDERS, po)
  const leads     = useCrud<Lead>('leads', LEADS, lead)
  const coatbook  = useCoatBook()
  const notes     = useCrud<DiaryNote>('diary', NO_NOTES, noteId)

  const entries = useMemo(() => {
    const out: DiaryEntry[] = []

    /* Money in — a bill's due date. A paid bill stays on the day it was due
       so the month still reads true afterwards, marked settled. */
    for (const i of invoices.rows) {
      if (!i.dueDate) continue
      out.push({
        id: `in-${i.no}`, date: i.dueDate, kind: 'money-in',
        title: `${i.no} falls due`, who: i.clientName,
        amount: Math.max(0, i.total - i.received),
        to: '/outstanding', done: i.status === 'Paid',
      })
    }

    /* Money out — a supplier's bill. */
    for (const p of purchases.rows) {
      if (!p.dueDate) continue
      out.push({
        id: `out-${p.no}`, date: p.dueDate, kind: 'money-out',
        title: `${p.no} falls due`, who: p.supplier,
        amount: Math.max(0, p.total - p.paid),
        to: '/supplier-recon', done: p.status === 'Paid',
      })
    }

    /* Material expected in. */
    for (const o of orders.rows) {
      if (!o.expectedDate) continue
      out.push({
        id: `po-${o.id}`, date: o.expectedDate, kind: 'material',
        title: `${o.no} expected`, who: o.supplier,
        qty: o.pendingNos ? `${o.pendingNos.toLocaleString('en-IN')} nos pending` : 'all received',
        to: '/purchase-orders', done: o.status === 'Closed' || o.pendingNos === 0,
      })
    }

    /* Offers running out. A won or lost one has stopped mattering. */
    const offers: [string, Quotation[]][] = [
      ['Quotation', quotes.rows], ['Estimate', estimates.rows], ['Proforma', proformas.rows],
    ]
    for (const [label, rows] of offers) {
      for (const q of rows) {
        if (!q.validTill || q.status === 'Draft') continue
        out.push({
          id: `offer-${label}-${q.no}`, date: q.validTill, kind: 'offer',
          title: `${label} ${q.no} runs out`, who: q.clientName, amount: q.total,
          to: label === 'Estimate' ? '/estimate' : label === 'Proforma' ? '/proforma-invoice' : '/quotation',
          done: q.status === 'Won' || q.status === 'Lost',
        })
      }
    }

    /* Leads to be rung. */
    for (const l of leads.rows) {
      if (!l.nextFollowUp) continue
      out.push({
        id: `lead-${l.id}`, date: l.nextFollowUp, kind: 'follow-up',
        title: `Ring ${l.name}`, who: `${l.area} · ${l.requirement}`,
        amount: l.estValue, to: '/leads',
        done: l.stage === 'Converted' || l.stage === 'Dropped',
      })
    }

    /* Coating movements, a day and a place at a time rather than line by
       line: forty rows of one sheet on one date is not forty events. */
    const moves = new Map<string, { date: string; sheet: string; place: string; nos: number; kg: number }>()
    for (const l of coatbook.lines) {
      if (l.sheet === 'opening' || !l.date) continue
      const key = `${l.date}|${l.sheet}|${l.place}`
      const at = moves.get(key) ?? { date: l.date, sheet: l.sheet, place: l.place, nos: 0, kg: 0 }
      at.nos += l.nos ?? 0
      at.kg  += l.kg ?? 0
      moves.set(key, at)
    }
    for (const [key, m] of moves) {
      out.push({
        id: `coat-${key}`, date: m.date, kind: 'coating',
        title: m.sheet === 'loaded' ? 'Loaded out for coating' : 'Back from coating',
        who: m.place,
        qty: [m.nos ? `${m.nos.toLocaleString('en-IN')} nos` : '', m.kg ? `${Math.round(m.kg).toLocaleString('en-IN')} kg` : '']
          .filter(Boolean).join(' · '),
        to: '/coat-book', done: true,
      })
    }

    /* Our own notes. */
    for (const n of notes.rows) {
      if (!n.date) continue
      out.push({
        id: n.id, date: n.date, kind: n.kind || 'note',
        title: [n.time, n.title || 'Note'].filter(Boolean).join(' · '),
        who: n.who || undefined, done: n.done,
      })
    }

    return out.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind))
  }, [invoices.rows, purchases.rows, quotes.rows, estimates.rows, proformas.rows, orders.rows, leads.rows, coatbook.lines, notes.rows])

  const byDay = useMemo(() => {
    const m = new Map<string, DiaryEntry[]>()
    for (const e of entries) {
      const list = m.get(e.date)
      if (list) list.push(e); else m.set(e.date, [e])
    }
    return m
  }, [entries])

  return { entries, byDay, notes }
}

/** Past its day and still open. */
export const isOverdue = (e: DiaryEntry, today = todayIso()) =>
  !e.done && e.date < today && (e.kind === 'money-in' || e.kind === 'money-out' || e.kind === 'material' || e.kind === 'follow-up' || e.kind === 'note')
