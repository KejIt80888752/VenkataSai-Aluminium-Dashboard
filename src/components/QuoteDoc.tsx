import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'
import { COMPANY } from '@/data/company'
import { CLIENTS } from '@/data/parties'
import { inr2, fmtDate } from '@/lib/utils'
import type { Quotation } from '@/data/txns'
import { DEFAULT_TERMS } from '@/data/terms'
import { imageOf } from '@/lib/productimages'

/* ── A quotation the customer can actually be handed ───────────────────────
   They asked us to look at what Tally and the rest already do — "we are
   moving towards the basic options" — and a quotation you cannot print is
   not one of them. A bill could be printed; a quotation and a proforma could
   not, so the only way to send one was to read the figures down the phone.

   Deliberately not a tax invoice. A proforma is raised before the goods move
   and a quotation before anything is agreed, so neither carries an e-way
   bill, a vehicle or a "certified true and correct" line, and both say on
   their face what they are not.                                           */

export default function QuoteDoc({ doc, kind, onClose }: {
  doc: Quotation
  kind: 'Quotation' | 'Estimate' | 'Proforma Invoice' | 'Tax Invoice'
  onClose: () => void
}) {
  /* An estimate and a quotation are offers; a proforma and a tax invoice are
     raised against goods, so they close on a due date and ask for payment. */
  const isOffer = kind === 'Quotation' || kind === 'Estimate'
  /* ── A quotation is one figure ────────────────────────────────────────
     Theirs, on 21-11: "quotation — don't show the weight or rate for each
     piece. Show only one total lump-sum value (5 x 144, 3 x 63, 3 x 120
     shown as one total)."

     Which is how an offer is made in this trade. A customer is being asked
     to accept a price for a job; breaking it into thirty rates invites a
     negotiation on each one of them. The specification is still printed in
     full — what is being supplied, and how much of it — and the money is
     one line at the foot.

     The estimate is the opposite document and keeps everything: it is the
     working paper, so each piece carries its weight and the coating is
     priced on its own line.                                              */
  const lumpSum = kind === 'Quotation'
  const showsKg = kind === 'Estimate'
  /* "When printing, show the tax rate as a small symbol (18%, 9%) instead of
     full details" — theirs, on 21-11. It rides beside the amount. */
  const showsSlab = !lumpSum
  /* "Show product images only in the Proforma invoice" — theirs, on 21-11.
     A proforma goes out before the goods do, to somebody who often has not
     seen the section and is being asked to pay against it. */
  const showsPhoto = kind === 'Proforma Invoice'
  /* The master may hold nothing yet, so the document's own buyer is what
     prints and the master only fills in what the document does not carry. */
  const client = CLIENTS.find(c => c.id === doc.clientId)
  const buyer = {
    name: doc.clientName || client?.name || '—',
    place: [client?.area, client?.state].filter(Boolean).join(', '),
    contact: [client?.contact, client?.phone].filter(Boolean).join(' · '),
    gstin: client?.gstin ?? '',
  }
  /* The aluminium line already carries every kilo on the document, so adding
     the sections to it would count the same metal twice. */
  /* Every kilo on the document, which is the metal lines added together —
     a job priced at two rates carries two of them, and taking only the first
     printed a total that was short by whatever the second one weighed. The
     sections below are the same metal counted again, so they are left out. */
  const metalLines = doc.lines.filter(l => l.group === 'aluminium')
  const totalQty = metalLines.length
    ? +metalLines.reduce((s, l) => s + l.qty, 0).toFixed(3)
    : doc.lines.reduce((s, l) => s + l.qty, 0)

  return createPortal(
    <div className="print-modal-overlay fixed inset-0 z-[60] bg-black/50 overflow-y-auto p-4" onClick={onClose}>
      <div className="max-w-[820px] mx-auto flex justify-end gap-2 mb-3 print:hidden" onClick={e => e.stopPropagation()}>
        <button onClick={() => window.print()} className="btn"><Printer size={14} /> Print / Save PDF</button>
        <button onClick={onClose} className="btn-outline !bg-white"><X size={14} /> Close</button>
      </div>

      <div id="doc-print-area" onClick={e => e.stopPropagation()}
        className="max-w-[820px] mx-auto bg-white text-slate-800 p-8 shadow-2xl text-[12px] leading-snug">

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
            </div>
          </div>
          <div className="text-right">
            <p className="text-[15px] font-bold uppercase tracking-wider text-slate-900">{kind}</p>
            {/* "Remove: Not a Tax invoice" — theirs, on 20-11. The heading
                already says what the document is. */}
            {kind === 'Tax Invoice' && (
              <p className="text-[10px] text-slate-500 mt-0.5">Original for Recipient</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-3 border-b border-slate-300">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {isOffer ? `${kind} For` : 'Billed To'}
            </p>
            <p className="font-semibold text-slate-900">{buyer.name}</p>
            {buyer.place && <p className="text-slate-600">{buyer.place}</p>}
            {buyer.contact && <p className="text-slate-600">Contact: {buyer.contact}</p>}
            {buyer.gstin && <p className="text-slate-800 font-medium">GSTIN: {buyer.gstin}</p>}
          </div>
          <div className="text-right space-y-0.5">
            <Meta k={`${kind} No.`} v={doc.no} bold />
            <Meta k="Date" v={fmtDate(doc.date)} />
            <Meta k={isOffer ? 'Valid Till' : 'Due On'} v={fmtDate(doc.validTill)} />
            {doc.subject && <Meta k="Subject" v={doc.subject} />}
            {doc.owner && <Meta k="Prepared By" v={doc.owner} />}
          </div>
        </div>

        <table className="w-full mt-3 border-collapse">
          <thead>
            <tr className="bg-slate-100">
              {['#', 'Description of Goods', 'HSN', 'Qty', 'Unit', 'Rate', 'Amount'].map((h, i) => (
                <th key={h}
                  className={`border border-slate-300 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 ${i >= 3 ? 'text-right' : 'text-left'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* The metal sits at the head in its own right, and the sections
                under it carry what it costs to coat them — the way the shop
                quotes, and the way a customer can argue with it line by line. */}
            {doc.lines.map((l, i) => {
              const metal = l.group === 'aluminium'
              /* The one coating charge is a summary line and carries no
                 product; a section charged for its own coating is an
                 ordinary line of material and must not be set in the
                 heading's bold capitals, nor lose the weight it was
                 priced on. */
              const summary = metal || (l.group === 'coating' && !l.productId)
              return (
              <tr key={`${l.code}-${i}`} className={summary ? 'bg-slate-50' : undefined}>
                <td className="border border-slate-300 px-2 py-1.5">{i + 1}</td>
                <td className="border border-slate-300 px-2 py-1.5">
                  <span className={summary ? 'font-bold text-slate-900 uppercase tracking-wide' : 'font-medium text-slate-900'}>
                    {l.name}
                  </span>
                  {l.code && <span className="text-slate-500 text-[10px]"> ({l.code})</span>}
                  {/* The estimate is the working paper, so each piece carries
                      the weight it was priced on — theirs, on 21-11:
                      "estimate — show the weight of each piece, with the
                      powder coating charge as its own line." */}
                  {showsKg && !summary && l.kg ? (
                    <span className="text-slate-500 text-[10px]"> · {l.kg} kg</span>
                  ) : null}
                  {/* Its own words, where somebody wrote any — theirs:
                      "a Description / Narration box for each item, like in
                      Tally... for items that aren't in stock." */}
                  {l.narration ? (
                    <span className="block text-[10px] text-slate-500 italic">{l.narration}</span>
                  ) : null}
                  {showsPhoto && imageOf(l.productId) ? (
                    <img src={imageOf(l.productId)} alt=""
                      className="mt-1 w-14 h-14 object-cover rounded border border-slate-200" />
                  ) : null}
                </td>
                <td className="border border-slate-300 px-2 py-1.5">{l.hsn}</td>
                {/* The aluminium line already carries every kilo on the
                    document. Repeating it against each section read as the
                    same weight twice — theirs: "displaying double time" — so
                    a section shows the count it was supplied in. */}
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">
                  {l.qty.toLocaleString('en-IN')}
                </td>
                <td className="border border-slate-300 px-2 py-1.5 text-right">{l.unit}</td>
                {/* On a quotation neither of these is printed: the money is
                    one figure at the foot. */}
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">
                  {lumpSum ? <span className="text-slate-400">—</span> : inr2(l.rate)}
                </td>
                <td className={`border border-slate-300 px-2 py-1.5 text-right tabular-nums ${summary ? 'font-bold' : 'font-medium'}`}>
                  {lumpSum
                    ? <span className="text-slate-400">—</span>
                    : l.amount
                    ? <>
                        {inr2(l.amount)}
                        {showsSlab && (
                          <sup className="text-[8px] text-slate-500 ml-0.5">{l.gst}%</sup>
                        )}
                      </>
                    : <span className="text-slate-400">—</span>}
                </td>
              </tr>
            )})}
            {doc.lines.length === 0 && (
              <tr><td className="border border-slate-300 px-2 py-3 text-slate-500" colSpan={7}>
                No material on this {kind.toLowerCase()} yet.
              </td></tr>
            )}
            <tr className="bg-slate-50 font-semibold">
              <td className="border border-slate-300 px-2 py-1.5" colSpan={3}>
                {lumpSum ? 'Lump Sum Value' : 'Total'}
              </td>
              <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">
                {lumpSum ? '' : totalQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
              </td>
              <td className="border border-slate-300 px-2 py-1.5" colSpan={2} />
              <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{inr2(doc.taxable)}</td>
            </tr>
          </tbody>
        </table>

        {lumpSum && (
          <p className="text-[10px] text-slate-500 mt-1.5">
            Quoted as a single lump sum for the whole supply. Section-wise rates are available on request.
          </p>
        )}
        {showsSlab && (
          <p className="text-[10px] text-slate-500 mt-1.5">
            The small figure beside an amount is the GST rate that line carries.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 mt-3">
          <div className="text-[11px]">
            <p className="font-bold uppercase tracking-wider text-slate-500 text-[10px] mb-1">Bank Details</p>
            <p className="text-slate-700">{COMPANY.bank.bank}, {COMPANY.bank.branch}</p>
            <p className="text-slate-700">A/c {COMPANY.bank.acNo} · IFSC {COMPANY.bank.ifsc}</p>
            <p className="text-slate-700">GSTIN: {COMPANY.gstin}</p>
          </div>
          <table className="w-full border-collapse text-[11px] self-start">
            <tbody>
              <Total k={lumpSum ? 'Lump Sum Value' : 'Taxable Value'} v={inr2(doc.taxable)} />
              <Total k="GST" v={inr2(doc.tax)} />
              <Total k="Grand Total" v={inr2(doc.total)} bold />
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-300 grid grid-cols-2 gap-4">
          <div>
            <p className="font-bold uppercase tracking-wider text-slate-500 text-[10px] mb-1">Terms & Conditions</p>
            {/* The document's own terms, settled when it was raised. */}
            <ol className="list-decimal list-inside text-[10px] text-slate-600 space-y-0.5">
              {(doc.terms?.length ? doc.terms : DEFAULT_TERMS[kind]).map((t, i) => (
                <li key={i}>{t}</li>
              ))}
              <li>Rates quoted ex-godown, {COMPANY.address.line3}.</li>
            </ol>
          </div>
          <div className="text-right flex flex-col justify-between">
            <p className="text-[10px] text-slate-500">
              {isOffer
                ? 'Please confirm in writing to convert this into an order.'
                : kind === 'Proforma Invoice'
                ? 'Please remit against this proforma to release despatch.'
                : 'Certified that the particulars given above are true and correct.'}
            </p>
            <div className="mt-10">
              <p className="text-[11px] font-semibold text-slate-900">For {COMPANY.name}</p>
              <p className="text-[10px] text-slate-500 mt-6">Authorised Signatory</p>
            </div>
          </div>
        </div>

        <p className="text-center text-[9px] text-slate-400 mt-4 pt-2 border-t border-slate-200">
          Computer-generated {kind.toLowerCase()} · {COMPANY.website}
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
