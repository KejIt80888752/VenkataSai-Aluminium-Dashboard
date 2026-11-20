import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Info } from 'lucide-react'
import { Modal, Select } from '@/components/ui'
import { SectionPicker } from '@/components/SectionPicker'
import { PICK_OPTIONS, productById } from '@/data/productmaster'
import { CLIENTS } from '@/data/parties'
import { inr2 } from '@/lib/utils'
import { today, validTill, DEFAULT_VALID_DAYS, revisionNumber } from '@/lib/docnos'

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

export type DocKind = 'Quotation' | 'Proforma Invoice' | 'Tax Invoice'

export const amountOf = (l: BuiltLine) =>
  +((l.basis === 'kg' ? l.kg : l.nos) * l.rate).toFixed(2)

export function totalsOf(lines: BuiltLine[]) {
  const taxable = +lines.reduce((s, l) => s + amountOf(l), 0).toFixed(2)
  const tax = +lines.reduce((s, l) => s + amountOf(l) * (l.gst / 100), 0).toFixed(2)
  return { taxable, tax, total: +(taxable + tax).toFixed(2) }
}

const GST_RATES = ['18', '12', '5', '28', '0']
const blankLine = (): BuiltLine => ({
  key: Math.random().toString(36).slice(2),
  productId: '', code: '', name: '', hsn: '7604',
  basis: 'nos', nos: 0, kg: 0, rate: 0, gst: 18,
})

export default function DocBuilder({ open, onClose, onSave, kind, docNo, initial, owner }: {
  open: boolean
  onClose: () => void
  onSave: (doc: BuiltDoc) => void
  kind: DocKind
  /** the number this document will carry — issued by the caller, never typed */
  docNo: string
  /** the document being revised or copied, where there is one */
  initial?: Partial<BuiltDoc> | null
  owner: string
}) {
  const [date, setDate] = useState(today())
  const [days, setDays] = useState(DEFAULT_VALID_DAYS)
  const [clientName, setClientName] = useState('')
  const [subject, setSubject] = useState('')
  const [interState, setInterState] = useState(false)
  const [lines, setLines] = useState<BuiltLine[]>([blankLine()])

  /* An invoice is the same document with the dates read differently: validity
     becomes credit, and the day it lapses becomes the day it falls due. */
  const isInvoice = kind === 'Tax Invoice'

  /* Opening the form resets it to today and to whatever is being revised. */
  useEffect(() => {
    if (!open) return
    setDate(today())
    setDays(DEFAULT_VALID_DAYS)
    setClientName(initial?.clientName ?? '')
    setSubject(initial?.subject ?? '')
    setInterState(initial?.interState ?? false)
    setLines(initial?.lines?.length
      ? initial.lines.map(l => ({ ...l, key: Math.random().toString(36).slice(2) }))
      : [blankLine()])
  }, [open, initial])

  const t = useMemo(() => totalsOf(lines), [lines])
  const rev = revisionNumber(docNo)

  const patch = (key: string, p: Partial<BuiltLine>) =>
    setLines(ls => ls.map(l => l.key === key ? { ...l, ...p } : l))

  /* Picking a product brings its code and, where your books have weighed it,
     the weight per piece — so the kilos follow from the count. */
  const pick = (key: string, id: string) => setLines(ls => ls.map(l => {
    if (l.key !== key) return l
    const p = productById(id)
    if (!p) return { ...l, productId: '', name: '', code: '' }
    const basis: 'kg' | 'nos' = p.kgPerPiece !== null ? 'kg' : 'nos'
    return {
      ...l, productId: id, code: p.code, name: p.name, basis,
      hsn: p.kind === 'section' ? '7604' : p.kind === 'rubber' ? '4016' : '8302',
      kg: p.kgPerPiece !== null ? +(p.kgPerPiece * l.nos).toFixed(3) : 0,
    }
  }))

  const setNos = (key: string, nos: number) => setLines(ls => ls.map(l => {
    if (l.key !== key) return l
    const p = productById(l.productId)
    return { ...l, nos, kg: p?.kgPerPiece != null ? +(p.kgPerPiece * nos).toFixed(3) : l.kg }
  }))

  const ready = clientName.trim() !== '' && lines.some(l => l.productId && amountOf(l) > 0)

  const save = () => {
    const keep = lines.filter(l => l.productId)
    onSave({
      no: docNo, date, validTill: validTill(date, days),
      clientName: clientName.trim(), subject: subject.trim(), owner,
      lines: keep, interState, ...totalsOf(keep),
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose}
      title={rev ? `${kind} ${docNo} — revision ${rev}` : `New ${kind} — ${docNo}`} wide>
      <div className="space-y-4">
        <div className="rounded-lg p-3 flex items-start gap-2 text-[11.5px]"
          style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)', color: 'var(--text-3)' }}>
          <Info size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} />
          <span>
            The number and the date are issued here, not typed. The taxable value, the GST and the total are
            what the lines below come to — nothing is entered against them.
            {rev > 0 && ' This is a revision: it keeps the number it revises and carries today’s date.'}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div><label className="label">{kind} no</label>
            <input className="input w-full font-mono !text-xs" value={docNo} readOnly
              title="Issued by the system" style={{ color: 'var(--text-3)' }} /></div>
          <div><label className="label">Date</label>
            <input className="input w-full" value={date} readOnly
              title="Today. A revision carries the day it was revised."
              style={{ color: 'var(--text-3)' }} /></div>
          <div><label className="label">{isInvoice ? 'Credit' : 'Valid for'}</label>
            <Select value={`${days} days`} onChange={v => setDays(parseInt(v, 10))}
              options={isInvoice
                ? ['0 days', '7 days', '15 days', '21 days', '30 days', '45 days', '60 days']
                : ['1 day', '2 days', '3 days', '7 days', '15 days', '30 days']}
              className="!w-full" /></div>
          <div><label className="label">{isInvoice ? 'Due on' : 'Valid till'}</label>
            <input className="input w-full" value={validTill(date, days)} readOnly
              style={{ color: 'var(--text-3)' }} /></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div><label className="label">Customer</label>
            <input className="input w-full" value={clientName} list="vsa-customers"
              placeholder="Who it is for" onChange={e => setClientName(e.target.value)} />
            <datalist id="vsa-customers">
              {CLIENTS.map(c => <option key={c.id} value={c.name} />)}
            </datalist>
          </div>
          <div><label className="label">{isInvoice ? 'Site / reference' : 'Subject'}</label>
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
                  <th className="num">Qty (nos)</th><th className="num">Weight (kg)</th>
                  <th className="num">Rate</th><th className="num">GST %</th>
                  <th className="num">Amount</th><th /></tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.key}>
                    <td>
                      <SectionPicker options={PICK_OPTIONS} value={l.productId}
                        onChange={id => pick(l.key, id)} />
                    </td>
                    <td className="font-mono text-xs" style={{ color: 'var(--text-4)' }}>{l.code || '—'}</td>
                    <td className="num">
                      <input className="input !w-20 !py-1 text-right tabular-nums !text-xs" value={l.nos}
                        onChange={e => setNos(l.key, Number(e.target.value) || 0)} /></td>
                    <td className="num">
                      <input className="input !w-24 !py-1 text-right tabular-nums !text-xs" value={l.kg}
                        disabled={l.basis === 'nos'}
                        title={l.basis === 'nos' ? 'No weight per piece in your books — priced per piece' : undefined}
                        onChange={e => patch(l.key, { kg: Number(e.target.value) || 0 })} /></td>
                    <td className="num">
                      <input className="input !w-24 !py-1 text-right tabular-nums !text-xs" value={l.rate}
                        placeholder={l.basis === 'kg' ? 'per kg' : 'per piece'}
                        onChange={e => patch(l.key, { rate: Number(e.target.value) || 0 })} /></td>
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
            Rates are typed because selling prices have not been given to us yet. Send the product list with
            cost and selling price against each code and the rate will fill itself in.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--border-2)' }}>
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
