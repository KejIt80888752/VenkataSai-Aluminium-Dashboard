import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Info, X } from 'lucide-react'
import { Modal, Select } from '@/components/ui'
import { SectionPicker } from '@/components/SectionPicker'
import { PICK_OPTIONS, productById } from '@/data/productmaster'
import { useExtraProducts, addExtraProduct } from '@/lib/extraproducts'
import { CLIENTS, SUPPLIERS } from '@/data/parties'
import { PARTY_CODES } from '@/data/partycodes'
import { inr2 } from '@/lib/utils'
import { today, validTill, DEFAULT_VALID_DAYS, revisionNumber } from '@/lib/docnos'
import { recallRate, recallSlab, rememberAll } from '@/lib/ratememory'

/* ── Raising a quotation or a proforma ─────────────────────────────────────
   The shop opened the old form and asked the question that mattered: "where
   is the material that you can enter?" There was nowhere. The form asked for
   a taxable value and a total and took both on trust, which is why a figure
   could be quoted that no line of material added up to.

   So the money is no longer typed. Products are picked off the master, and
   the taxable value, the tax and the total are what those lines come to.

   The number is issued by the system and the date is today — "I should not
   be in a position to manually select". Validity defaults and can be moved.

   Sections are priced the way the trade prices them, by weight: pieces times
   the weight per piece gives kilos, kilos times the rate gives the amount.
   Hardware has no weight per piece in your books, so it is priced per piece.
   The rate itself is always typed, because selling prices have not been
   given to us yet.                                                        */

export interface BuiltLine {
  key: string
  productId: string
  code: string
  name: string
  hsn: string
  /** true where the rate came out of what this product last went out at */
  recalled?: boolean
  /** 'kg' where the product has a weight per piece, otherwise 'nos' */
  basis: 'kg' | 'nos'
  nos: number
  kg: number
  rate: number
  gst: number
}

export interface BuiltDoc {
  no: string
  date: string
  /** the day it lapses on a quotation, the day it falls due on an invoice */
  validTill: string
  clientName: string
  subject: string
  owner: string
  lines: BuiltLine[]
  taxable: number
  tax: number
  total: number
  /** true where the customer is outside Karnataka, so the tax is IGST */
  interState: boolean
}

export type DocKind = 'Quotation' | 'Estimate' | 'Proforma Invoice' | 'Tax Invoice' | 'Purchase Bill'

export const amountOf = (l: BuiltLine) =>
  +((l.basis === 'kg' ? l.kg : l.nos) * l.rate).toFixed(2)

export function totalsOf(lines: BuiltLine[]) {
  const taxable = +lines.reduce((s, l) => s + amountOf(l), 0).toFixed(2)
  const tax = +lines.reduce((s, l) => s + amountOf(l) * (l.gst / 100), 0).toFixed(2)
  return { taxable, tax, total: +(taxable + tax).toFixed(2) }
}

const GST_RATES = ['18', '12', '5', '28', '0']
const ADD_NEW = '+ Someone new'
const CHOOSE = '— choose —'
const blankLine = (): BuiltLine => ({
  key: Math.random().toString(36).slice(2),
  productId: '', code: '', name: '', hsn: '7604',
  basis: 'nos', nos: 0, kg: 0, rate: 0, gst: 18,
})

export default function DocBuilder({ open, onClose, onSave, kind, docNo, initial, parties = [], owner }: {
  open: boolean
  onClose: () => void
  onSave: (doc: BuiltDoc) => void
  kind: DocKind
  /** the number this document will carry — issued by the caller, never typed,
      except on a purchase bill, where the number and date are the supplier's */
  docNo: string
  /** the document being revised or copied, where there is one */
  initial?: Partial<BuiltDoc> | null
  /** every party already dealt with, so a name is picked and not retyped */
  parties?: string[]
  owner: string
}) {
  const [date, setDate] = useState(today())
  const [days, setDays] = useState(DEFAULT_VALID_DAYS)
  const [clientName, setClientName] = useState('')
  const [subject, setSubject] = useState('')
  const [interState, setInterState] = useState(false)
  const [newParty, setNewParty] = useState(false)

  /* Products the shop has added itself sit beside the master, so a door
     closer typed on one quotation is picked on the next. */
  const extras = useExtraProducts()
  const options = useMemo(() => [
    ...PICK_OPTIONS,
    ...extras.map(x => ({ id: x.id, code: x.code || '—', name: x.name, alt: x.alt })),
  ], [extras])

  const productOf = (id: string) =>
    productById(id) ?? (() => {
      const x = extras.find(e => e.id === id)
      return x ? { code: x.code, name: x.name, kgPerPiece: x.kgPerPiece, kind: 'section' as const } : undefined
    })()
  const [lines, setLines] = useState<BuiltLine[]>([blankLine()])

  /* An invoice is the same document with the dates read differently: validity
     becomes credit, and the day it lapses becomes the day it falls due.

     A purchase bill is the one document whose number is not ours to issue. It
     is the supplier's, printed on the paper in front of whoever is entering
     it, so there it is typed — which is what they meant by "to give the bill
     number a date, that is fine". Everything else still comes off the lines. */
  const isInvoice = kind === 'Tax Invoice' || kind === 'Purchase Bill'
  const isPurchase = kind === 'Purchase Bill'
  /* Weight came off the quotation and the estimate — theirs, on 20-11. It is
     still worked out behind the column and shown under the count, because the
     rate on a section is per kilo and the amount has to come from somewhere.
     The despatch documents keep the column: a bill for aluminium sold by
     weight has to show the weight it was sold at. */
  const showWeight = !(kind === 'Quotation' || kind === 'Estimate')
  const [theirNo, setTheirNo] = useState('')
  const [theirDate, setTheirDate] = useState(today())

  /* Opening the form resets it to today and to whatever is being revised. */
  useEffect(() => {
    if (!open) return
    setDate(today())
    setDays(DEFAULT_VALID_DAYS)
    setTheirNo(initial?.no ?? '')
    setTheirDate(initial?.date ?? today())
    setClientName(initial?.clientName ?? '')
    setSubject(initial?.subject ?? '')
    setInterState(initial?.interState ?? false)
    setNewParty(false)
    setLines(initial?.lines?.length
      ? initial.lines.map(l => ({ ...l, key: Math.random().toString(36).slice(2) }))
      : [blankLine()])
  }, [open, initial])

  /* Everyone already dealt with: the master, the party codes on their own
     sheets, and every name used on a document so far. */
  const known = useMemo(() => [...new Set([
    ...parties,
    ...(isPurchase
      ? [...SUPPLIERS.map(x => x.name), ...PARTY_CODES.map(x => `${x.code} — ${x.name}`)]
      : CLIENTS.map(c => c.name)),
  ].filter(Boolean))].sort(), [parties, isPurchase])

  const t = useMemo(() => totalsOf(lines), [lines])
  const rev = revisionNumber(docNo)

  const patch = (key: string, p: Partial<BuiltLine>) =>
    setLines(ls => ls.map(l => l.key === key ? { ...l, ...p } : l))

  /* Picking a product brings its code and, where your books have weighed it,
     the weight per piece — so the kilos follow from the count. */
  const pick = (key: string, id: string) => setLines(ls => ls.map(l => {
    if (l.key !== key) return l
    const p = productOf(id)
    if (!p) return { ...l, productId: '', name: '', code: '' }
    const basis: 'kg' | 'nos' = p.kgPerPiece !== null ? 'kg' : 'nos'
    /* What this product went out at last time, and failing that the slab this
       kind of material usually carries. A rate typed once is not typed again. */
    const seen = recallRate(id)
    return {
      ...l, productId: id, code: p.code, name: p.name, basis,
      hsn: p.kind === 'section' ? '7604' : p.kind === 'rubber' ? '4016' : '8302',
      kg: p.kgPerPiece !== null ? +(p.kgPerPiece * l.nos).toFixed(3) : 0,
      rate: l.rate > 0 ? l.rate : (seen?.rate ?? 0),
      gst: seen?.gst ?? recallSlab(p.kind) ?? l.gst,
      recalled: !!seen?.rate && l.rate <= 0,
    }
  }))

  /* Anything typed that the list does not know is taken as it stands and
     joins the list — theirs: DOOR CLOSER, which never went to a coater and
     so was never in a master built out of coating sheets. */
  const create = (key: string, typed: string) => {
    const x = addExtraProduct(typed)
    /* Set from what was just created rather than by picking it out of the
       list: the list is state, and state has not caught up with the write
       yet, so picking by id here would look the product up and not find it. */
    const seen = recallRate(x.id)
    setLines(ls => ls.map(l => l.key === key ? {
      ...l,
      productId: x.id, code: x.code, name: x.name,
      basis: x.kgPerPiece !== null ? 'kg' : 'nos',
      kg: x.kgPerPiece !== null ? +(x.kgPerPiece * l.nos).toFixed(3) : 0,
      rate: l.rate > 0 ? l.rate : (seen?.rate ?? 0),
      gst: seen?.gst ?? l.gst,
      recalled: !!seen?.rate && l.rate <= 0,
    } : l))
  }

  const setNos = (key: string, nos: number) => setLines(ls => ls.map(l => {
    if (l.key !== key) return l
    const p = productOf(l.productId)
    return { ...l, nos, kg: p?.kgPerPiece != null ? +(p.kgPerPiece * nos).toFixed(3) : l.kg }
  }))

  const theDate = isPurchase ? theirDate : date
  const theNo = isPurchase ? theirNo.trim() : docNo

  /* ── What makes a document raisable ───────────────────────────────────
     This asked for money on the line and would not let anything out until it
     saw some, which is why they could not raise a quotation at all: not one
     product in the master has a price yet, so every amount was nought and the
     button never lit. A quotation for material at a rate still to be settled
     is an ordinary thing to send. A party and material on it is the test. */
  const ready = clientName.trim() !== ''
    && (!isPurchase || theNo !== '')
    && lines.some(l => l.productId && (l.basis === 'kg' ? l.kg : l.nos) > 0)

  const unpriced = lines.filter(l => l.productId && l.rate <= 0).length

  const save = () => {
    const keep = lines.filter(l => l.productId)
    /* Whatever went out is what the next one opens with. */
    rememberAll(keep.map(l => ({
      productId: l.productId,
      kind: productOf(l.productId)?.kind ?? '',
      rate: l.rate, gst: l.gst,
    })))
    onSave({
      no: theNo, date: theDate, validTill: validTill(theDate, days),
      clientName: clientName.trim(), subject: subject.trim(), owner,
      lines: keep, interState, ...totalsOf(keep),
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose}
      title={rev ? `${kind} ${docNo} — revision ${rev}`
        : isPurchase ? 'New Purchase Bill' : `New ${kind} — ${docNo}`} wide>
      <div className="space-y-4">
        <div className="rounded-lg p-3 flex items-start gap-2 text-[11.5px]"
          style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)', color: 'var(--text-3)' }}>
          <Info size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} />
          <span>
            {isPurchase
              ? 'The bill number and date are the supplier\u2019s, so they are typed off the paper. '
              : 'The number and the date are issued here, not typed. '}
            The taxable value, the GST and the total are what the lines below come to — nothing is entered
            against them.
            {rev > 0 && ' This is a revision: it keeps the number it revises and carries today’s date.'}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div><label className="label">{isPurchase ? "Supplier's bill no" : `${kind} no`}</label>
            {isPurchase ? (
              <input className="input w-full font-mono !text-xs" value={theirNo}
                placeholder="as on their bill" onChange={e => setTheirNo(e.target.value)} />
            ) : (
              <input className="input w-full font-mono !text-xs" value={docNo} readOnly
                title="Issued by the system" style={{ color: 'var(--text-3)' }} />
            )}</div>
          <div><label className="label">{isPurchase ? "Their bill date" : 'Date'}</label>
            {isPurchase ? (
              <input type="date" className="input w-full" value={theirDate}
                onChange={e => setTheirDate(e.target.value)} />
            ) : (
              <input className="input w-full" value={date} readOnly
                title="Today. A revision carries the day it was revised."
                style={{ color: 'var(--text-3)' }} />
            )}</div>
          <div><label className="label">{isInvoice ? 'Credit' : 'Valid for'}</label>
            <Select value={`${days} days`} onChange={v => setDays(parseInt(v, 10))}
              options={isInvoice
                ? ['0 days', '7 days', '15 days', '21 days', '30 days', '45 days', '60 days']
                : ['1 day', '2 days', '3 days', '7 days', '15 days', '30 days']}
              className="!w-full" /></div>
          <div><label className="label">{isInvoice ? 'Due on' : 'Valid till'}</label>
            <input className="input w-full" value={validTill(theDate, days)} readOnly
              style={{ color: 'var(--text-3)' }} /></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div><label className="label">{isPurchase ? 'Supplier' : 'Customer'}</label>
            {/* Picked from who you have dealt with, not retyped every time —
                theirs, on 20-11: "customer name from data selection". Anyone
                new is typed once and is on the list from then on. */}
            {known.length > 0 && !newParty ? (
              /* The blank first entry matters: without it the box showed the
                 first name on the list while nothing was actually chosen, and
                 the form sat there asking for a customer it appeared to have. */
              <Select value={clientName || CHOOSE}
                onChange={v => {
                  if (v === ADD_NEW) { setNewParty(true); setClientName('') }
                  else setClientName(v === CHOOSE ? '' : v)
                }}
                options={[CHOOSE, ...known, ADD_NEW]} className="!w-full" />
            ) : (
              <div className="flex gap-1.5">
                <input className="input w-full" value={clientName} autoFocus={newParty}
                  placeholder={isPurchase ? 'Who it is from' : 'Who it is for'}
                  onChange={e => setClientName(e.target.value)} />
                {known.length > 0 && (
                  <button className="btn-ghost !px-2 shrink-0" title="Back to the list"
                    onClick={() => { setNewParty(false); setClientName('') }}>
                    <X size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
          <div><label className="label">{isPurchase ? 'Category / reference' : isInvoice ? 'Site / reference' : 'Subject'}</label>
            <input className="input w-full" value={subject} placeholder="What it is for"
              onChange={e => setSubject(e.target.value)} /></div>
          <div><label className="label">Place of supply</label>
            <Select value={interState ? 'Outside Karnataka — IGST' : 'Karnataka — CGST + SGST'}
              onChange={v => setInterState(v.startsWith('Outside'))}
              options={['Karnataka — CGST + SGST', 'Outside Karnataka — IGST']} className="!w-full" /></div>
        </div>

        <div>
          <p className="label mb-1.5">Material</p>
          <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-2)' }}>
            <table className="tbl">
              <thead>
                <tr><th className="min-w-[13rem]">Product</th><th>Code</th>
                  <th className="num">Qty (nos)</th>
                  {showWeight && <th className="num">Weight (kg)</th>}
                  <th className="num">Rate</th><th className="num">GST %</th>
                  <th className="num">Amount</th><th /></tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.key}>
                    <td>
                      <SectionPicker options={options} value={l.productId}
                        onChange={id => pick(l.key, id)}
                        onCreate={typed => create(l.key, typed)} />
                    </td>
                    <td className="font-mono text-xs" style={{ color: 'var(--text-4)' }}>{l.code || '—'}</td>
                    <td className="num">
                      <input className="input !w-20 !py-1 text-right tabular-nums !text-xs" value={l.nos}
                        onChange={e => setNos(l.key, Number(e.target.value) || 0)} />
                      {!showWeight && l.basis === 'kg' && l.kg > 0 && (
                        <p className="text-[10px] text-right mt-0.5 tabular-nums"
                          style={{ color: 'var(--text-4)' }}>{l.kg} kg</p>
                      )}
                    </td>
                    {showWeight && (
                      <td className="num">
                        <input className="input !w-24 !py-1 text-right tabular-nums !text-xs" value={l.kg}
                          disabled={l.basis === 'nos'}
                          title={l.basis === 'nos' ? 'No weight per piece in your books — priced per piece' : undefined}
                          onChange={e => patch(l.key, { kg: Number(e.target.value) || 0 })} /></td>
                    )}
                    <td className="num">
                      <input className="input !w-24 !py-1 text-right tabular-nums !text-xs" value={l.rate}
                        placeholder={l.basis === 'kg' ? 'per kg' : 'per piece'}
                        style={l.recalled ? { borderColor: 'var(--green)' } : undefined}
                        title={l.recalled
                          ? 'What this product last went out at. Type over it to change it.'
                          : l.basis === 'kg' ? 'Rate per kilogram' : 'Rate per piece'}
                        onChange={e => patch(l.key, { rate: Number(e.target.value) || 0, recalled: false })} />
                      {l.recalled && (
                        <p className="text-[10px] text-right mt-0.5" style={{ color: 'var(--green)' }}>last rate</p>
                      )}
                    </td>
                    <td className="num">
                      <Select value={String(l.gst)} onChange={v => patch(l.key, { gst: Number(v) })}
                        options={GST_RATES} className="!w-16 !py-1 !text-xs !min-w-0" /></td>
                    <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>
                      {amountOf(l) ? inr2(amountOf(l)) : '—'}</td>
                    <td>
                      <button className="btn-ghost !px-1.5 !py-1" style={{ color: 'var(--red)' }}
                        onClick={() => setLines(ls => ls.length > 1 ? ls.filter(x => x.key !== l.key) : ls)}>
                        <Trash2 size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-2.5">
            <button className="btn-outline" onClick={() => setLines(ls => [...ls, blankLine()])}>
              <Plus size={14} /> Add a line
            </button>
            <table className="text-sm">
              <tbody>
                <tr><td className="pr-8 py-0.5" style={{ color: 'var(--text-3)' }}>Taxable</td>
                  <td className="text-right tabular-nums">{inr2(t.taxable)}</td></tr>
                {interState ? (
                  <tr><td className="pr-8 py-0.5" style={{ color: 'var(--text-3)' }}>IGST</td>
                    <td className="text-right tabular-nums">{inr2(t.tax)}</td></tr>
                ) : (
                  <>
                    <tr><td className="pr-8 py-0.5" style={{ color: 'var(--text-3)' }}>CGST</td>
                      <td className="text-right tabular-nums">{inr2(+(t.tax / 2).toFixed(2))}</td></tr>
                    <tr><td className="pr-8 py-0.5" style={{ color: 'var(--text-3)' }}>SGST</td>
                      <td className="text-right tabular-nums">{inr2(+(t.tax / 2).toFixed(2))}</td></tr>
                  </>
                )}
                <tr className="font-bold" style={{ color: 'var(--text-1)' }}>
                  <td className="pr-8 py-0.5 border-t" style={{ borderColor: 'var(--border-2)' }}>Total</td>
                  <td className="text-right tabular-nums border-t" style={{ borderColor: 'var(--border-2)' }}>
                    {inr2(t.total)}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11px] mt-2" style={{ color: 'var(--text-4)' }}>
            {isPurchase
              ? 'Rates are typed off the supplier\u2019s bill. Once the product list reaches us with a cost '
                + 'price against each code, a rate far from it will be flagged here rather than found later.'
              : 'Rates are typed because selling prices have not been given to us yet. Send the product list '
                + 'with cost and selling price against each code and the rate will fill itself in.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-3"
          style={{ borderTop: '1px solid var(--border-2)' }}>
          {!ready && (
            <span className="text-[11px] mr-auto" style={{ color: 'var(--text-4)' }}>
              {clientName.trim() === ''
                ? `Name the ${isPurchase ? 'supplier' : 'customer'} to carry on.`
                : isPurchase && theNo === ''
                ? 'Put in the supplier\u2019s bill number.'
                : 'Pick a product and a quantity on at least one line.'}
            </span>
          )}
          {ready && unpriced > 0 && (
            <span className="text-[11px] mr-auto" style={{ color: 'var(--text-4)' }}>
              {unpriced} {unpriced === 1 ? 'line has' : 'lines have'} no rate yet — it will go out showing
              nil against {unpriced === 1 ? 'it' : 'them'}.
            </span>
          )}
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={!ready} onClick={save}
            style={ready ? undefined : { opacity: .45, cursor: 'not-allowed' }}>
            {rev ? `Save revision ${rev}` : `Raise ${kind.toLowerCase()}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
