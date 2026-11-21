import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'
import { COMPANY } from '@/data/company'
import { colourName, swatchOf, UNCOATED } from '@/data/colours'
import { CLIENTS } from '@/data/parties'
import { inr2, fmtDate } from '@/lib/utils'
import { nameFor } from '@/data/itemmaster'
import type { Invoice } from '@/data/txns'
import { DEFAULT_TERMS } from '@/data/terms'

/** Number → Indian words, for the "Amount in words" line on the bill. */
function words(n: number): string {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const two = (x: number): string => x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : '')
  const three = (x: number): string => x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') : two(x)
  if (n === 0) return 'Zero'
  const parts: string[] = []
  const cr = Math.floor(n / 10000000); n %= 10000000
  const lk = Math.floor(n / 100000);   n %= 100000
  const th = Math.floor(n / 1000);     n %= 1000
  if (cr) parts.push(three(cr) + ' Crore')
  if (lk) parts.push(three(lk) + ' Lakh')
  if (th) parts.push(three(th) + ' Thousand')
  if (n)  parts.push(three(n))
  return parts.join(' ')
}

export default function InvoiceDoc({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  /* ── Who the bill is to ───────────────────────────────────────────────
     This used to read the customer master and assume it would be there. With
     the invented customers gone, a bill raised today has no master record to
     find, and dereferencing it took the whole screen down the moment anybody
     opened a bill to print it.

     The bill carries its own buyer — that is what a tax invoice is for — so
     it is read off the bill, and the master record, where there is one, only
     fills in the lines the bill does not hold. */
  const client = CLIENTS.find(c => c.id === inv.clientId)
  const buyer = {
    name: inv.clientName || client?.name || '—',
    place: [client?.area, inv.state || client?.state].filter(Boolean).join(', ') || '—',
    contact: [client?.contact, client?.phone].filter(Boolean).join(' · '),
    gstin: inv.gstin || client?.gstin || 'Unregistered',
  }
  const inter  = inv.igst > 0
  /* The aluminium line already carries every kilo on the bill. */
  const totalQty = inv.lines.some(l => l.group === 'aluminium')
    ? inv.lines.find(l => l.group === 'aluminium')!.qty
    : inv.lines.reduce((s, l) => s + l.qty, 0)

  return createPortal(
    <div className="print-modal-overlay fixed inset-0 z-[60] bg-black/50 overflow-y-auto p-4" onClick={onClose}>

      {/* Toolbar — hidden when printing */}
      <div className="max-w-[820px] mx-auto flex justify-end gap-2 mb-3 print:hidden" onClick={e => e.stopPropagation()}>
        <button onClick={() => window.print()} className="btn"><Printer size={14} /> Print / Save PDF</button>
        <button onClick={onClose} className="btn-outline !bg-white"><X size={14} /> Close</button>
      </div>

      <div id="doc-print-area" onClick={e => e.stopPropagation()}
        className="max-w-[820px] mx-auto bg-white text-slate-800 p-8 shadow-2xl text-[12px] leading-snug">

        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3">
          <div className="flex items-start gap-3">
            {/* "Can we add some logo in this?" — theirs, on 21-11. */}
            <img src={`${import.meta.env.BASE_URL}vsa-logo.svg`} alt=""
              className="w-11 h-11 shrink-0 rounded-lg" />
            <div>
            <h1 className="text-[19px] font-bold tracking-wide text-slate-900">{COMPANY.name}</h1>
            <p className="mt-1 text-[11px] text-slate-600 max-w-sm leading-relaxed">
              {COMPANY.address.line1}, {COMPANY.address.line2}<br />
              {COMPANY.address.line3}, {COMPANY.address.state} – {COMPANY.address.pin}
            </p>
            <p className="mt-1 text-[11px] text-slate-600">
              Phone: {COMPANY.phone} · Email: {COMPANY.email}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-slate-800">
              GSTIN: {COMPANY.gstin} &nbsp;|&nbsp; State: {COMPANY.state} ({COMPANY.stateCode})
            </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[14px] font-bold uppercase tracking-wider text-slate-900">Tax Invoice</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Original for Recipient</p>
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-4 py-3 border-b border-slate-300">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Billed To</p>
            <p className="font-semibold text-slate-900">{buyer.name}</p>
            <p className="text-slate-600">{buyer.place}</p>
            {buyer.contact && <p className="text-slate-600">Contact: {buyer.contact}</p>}
            <p className="text-slate-800 font-medium">GSTIN: {buyer.gstin}</p>
            {inv.shipTo && inv.shipTo !== '—' && (
              <p className="text-slate-600 mt-1">
                <span className="text-slate-500">Delivery: </span>{inv.shipTo}
              </p>
            )}
          </div>
          <div className="text-right space-y-0.5">
            <Meta k="Invoice No." v={inv.no} bold />
            <Meta k="Invoice Date" v={fmtDate(inv.date)} />
            <Meta k="Due Date" v={fmtDate(inv.dueDate)} />
            <Meta k="Buyer PO" v={inv.poNo} />
            <Meta k="Vehicle No." v={inv.vehicle} />
            <Meta k="E-Way Bill" v={inv.ewayBill} />
            {inv.piNo && <Meta k="PI No." v={inv.piNo} />}
            {inv.paymentTerms && <Meta k="Payment Terms" v={inv.paymentTerms} />}
            <Meta k="Remarks" v={inv.remarks} />
          </div>
        </div>

        {/* Lines */}
        <table className="w-full mt-3 border-collapse">
          <thead>
            <tr className="bg-slate-100">
              {['#', 'Description of Goods', 'HSN', 'Qty', 'Unit', 'Rate', 'Amount'].map((h, i) => (
                <th key={h} className={`border border-slate-300 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l, i) => {
              const metal = l.group === 'aluminium'
              /* Only the summary lines are headings. A section charged for
                 its own coating is ordinary material. */
              const summary = metal || (l.group === 'coating' && !l.productId)
              return (
              <tr key={`${l.code}-${i}`} className={summary ? 'bg-slate-50' : undefined}>
                <td className="border border-slate-300 px-2 py-1.5">{i + 1}</td>
                <td className="border border-slate-300 px-2 py-1.5">
                  <span className={summary ? 'font-bold text-slate-900 uppercase tracking-wide' : 'font-medium text-slate-900'}>
                    {nameFor(l.code, 'printInvoice', l.name)}
                  </span>
                  {l.code && <span className="text-slate-500 text-[10px]"> ({l.code})</span>}
                  {l.colour && l.colour !== UNCOATED ? (
                    <span className="text-slate-600 text-[10px] whitespace-nowrap">
                      {' · '}
                      <span className="inline-block w-[7px] h-[7px] rounded-full align-middle mr-1"
                        style={{ background: swatchOf(l.colour), border: '1px solid #cbd5e1' }} />
                      {colourName(l.colour)}
                    </span>
                  ) : null}
                  {!summary && l.kg ? (
                    <span className="text-slate-500 text-[10px]"> · {l.kg} kg</span>
                  ) : null}
                  {/* Its own words — theirs, on 21-11: "a Description /
                      Narration box for each item, like in Tally." */}
                  {l.narration ? (
                    <span className="block text-[10px] text-slate-500 italic">{l.narration}</span>
                  ) : null}
                </td>
                <td className="border border-slate-300 px-2 py-1.5">{l.hsn}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">
                  {l.qty.toLocaleString('en-IN')}
                </td>
                <td className="border border-slate-300 px-2 py-1.5 text-right">{l.unit}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{inr2(l.rate)}</td>
                {/* "Show the tax rate as a small symbol (18%, 9%) instead of
                    full details" — theirs, on 21-11. */}
                <td className={`border border-slate-300 px-2 py-1.5 text-right tabular-nums ${summary ? 'font-bold' : 'font-medium'}`}>
                  {l.amount
                    ? <>{inr2(l.amount)}<sup className="text-[8px] text-slate-500 ml-0.5">{l.gst}%</sup></>
                    : <span className="text-slate-400">—</span>}
                </td>
              </tr>
            )})}
            <tr className="bg-slate-50 font-semibold">
              <td className="border border-slate-300 px-2 py-1.5" colSpan={3}>Total</td>
              <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{totalQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
              <td className="border border-slate-300 px-2 py-1.5" colSpan={2} />
              <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{inr2(inv.taxable)}</td>
            </tr>
          </tbody>
        </table>

        {/* Totals + bank */}
        <div className="grid grid-cols-2 gap-4 mt-3">
          <div className="text-[11px]">
            <p className="font-bold uppercase tracking-wider text-slate-500 text-[10px] mb-1">Amount in Words</p>
            <p className="font-semibold text-slate-900 mb-3">Rupees {words(inv.total)} Only</p>

            <p className="font-bold uppercase tracking-wider text-slate-500 text-[10px] mb-1">Bank Details</p>
            <p className="text-slate-700">{COMPANY.bank.bank}, {COMPANY.bank.branch}</p>
            <p className="text-slate-700">A/c: {COMPANY.bank.acNo} · IFSC: {COMPANY.bank.ifsc}</p>
          </div>

          <table className="w-full text-[11px] self-start">
            <tbody>
              <Total k="Taxable Value" v={inr2(inv.taxable)} />
              {inter
                ? <Total k="IGST @ 18%" v={inr2(inv.igst)} />
                : <>
                    <Total k="CGST @ 9%" v={inr2(inv.cgst)} />
                    <Total k="SGST @ 9%" v={inr2(inv.sgst)} />
                  </>}
              <Total k="Round Off" v={inr2(inv.roundOff)} />
              <tr className="bg-slate-800 text-white">
                <td className="px-2 py-2 font-bold uppercase text-[11px] tracking-wide">Invoice Total</td>
                <td className="px-2 py-2 text-right font-bold tabular-nums text-[13px]">{inr2(inv.total)}</td>
              </tr>
              <Total k="Amount Received" v={inr2(inv.received)} />
              <Total k="Balance Due" v={inr2(inv.total - inv.received)} bold />
            </tbody>
          </table>
        </div>

        {/* Terms */}
        <div className="mt-4 pt-3 border-t border-slate-300 grid grid-cols-2 gap-4">
          <div>
            <p className="font-bold uppercase tracking-wider text-slate-500 text-[10px] mb-1">Terms & Conditions</p>
            <ol className="list-decimal list-inside text-[10px] text-slate-600 space-y-0.5">
              {/* The bill's own terms, settled when it was raised. */}
              {(inv.terms?.length ? inv.terms : DEFAULT_TERMS['Tax Invoice']).map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </div>
          <div className="text-right flex flex-col justify-between">
            <p className="text-[10px] text-slate-500">Certified that the particulars given above are true and correct.</p>
            <div className="mt-10">
              <p className="text-[11px] font-semibold text-slate-900">For {COMPANY.name}</p>
              <p className="text-[10px] text-slate-500 mt-6">Authorised Signatory</p>
            </div>
          </div>
        </div>

        <p className="text-center text-[9px] text-slate-400 mt-4 pt-2 border-t border-slate-200">
          This is a computer-generated invoice · {COMPANY.website}
        </p>
      </div>
    </div>,
    document.getElementById('print-root')!,
  )
}

const Meta = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
  <p className="text-[11px]">
    <span className="text-slate-500">{k}: </span>
    <span className={bold ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}>{v}</span>
  </p>
)

const Total = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
  <tr>
    <td className={`border border-slate-300 px-2 py-1 ${bold ? 'font-bold' : ''}`}>{k}</td>
    <td className={`border border-slate-300 px-2 py-1 text-right tabular-nums ${bold ? 'font-bold' : ''}`}>{v}</td>
  </tr>
)
