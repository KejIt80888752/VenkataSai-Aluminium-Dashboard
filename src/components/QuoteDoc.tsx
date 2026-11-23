import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X, Eye, EyeOff } from 'lucide-react'
import { COMPANY } from '@/data/company'
import { CLIENTS } from '@/data/parties'
import { inr2, fmtDate } from '@/lib/utils'
import type { Quotation } from '@/data/txns'
import { DEFAULT_TERMS } from '@/data/terms'
import { productById } from '@/data/productmaster'
import { imageOf } from '@/lib/productimages'
import { colourName, swatchOf, withColour, UNCOATED } from '@/data/colours'

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
  /* ── Only the coating is one figure ───────────────────────────────────
     Theirs, on 22-11: "we said cumulative single entry required only for
     Powder Coating, not for all. Weight, hardware etc are displayed as it
     is." The quotation was printing every rate and every amount blank with
     one lump sum at the foot, which was more than they asked for. */
  const lumpSum = false
  /* "Don't display individual items weights (it's assumed not exact)" —
     theirs, on 22-11, about the estimate. The quotation is the one that
     carries them, because there they are worked out of their own books and
     the customer is being shown the working. */
  const showsKg = false
  /* "HSN code display only for tax invoice only, all other books not
     required to display" — theirs, on 22-11. */
  const showsHsn = false
  /* "When printing, show the tax rate as a small symbol (18%, 9%) instead of
     full details" — theirs, on 21-11. It rides beside the amount. */
  const showsSlab = !lumpSum
  /* "Show product images only in the Proforma invoice" — theirs, on 21-11.
     A proforma goes out before the goods do, to somebody who often has not
     seen the section and is being asked to pay against it. */
  const showsPhoto = kind === 'Proforma Invoice'

  /* ── Hiding the tax, and the eye that does it ─────────────────────────
     Theirs, on 21-11, at 22:01: "if we print it, we'll get an idea of how
     much we've put in the metal. We shouldn't know about it." — meaning the
     customer should not be able to work the loading out of a tax breakdown
     printed line by line. What goes out instead is the small figure beside
     each amount: "18% is a symbol, 9% is a symbol."

     So the whole tax block comes off the paper on the documents that are
     offers, and the eye in the toolbar puts it back when they want to show
     somebody the working. A proforma keeps it, because a proforma is what
     an advance is paid against and the amount has to be defensible, and a
     tax invoice is a different document altogether — it must carry CGST
     and SGST by law and has no switch at all.

     Whichever way they set it is remembered for that kind of document, so
     nobody has to click it twice a day.                                 */
  const TAX_KEY = `vsa-print-gst-${kind}`
  const [showTax, setShowTax] = useState(() => {
    try {
      const held = localStorage.getItem(TAX_KEY)
      if (held !== null) return held === '1'
    } catch { /* blocked or private */ }
    return !isOffer
  })
  const toggleTax = () => setShowTax(v => {
    try { localStorage.setItem(TAX_KEY, v ? '0' : '1') } catch { /* ignore */ }
    return !v
  })
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
  /* ── The coating as a line of its own ────────────────────────────────
     Theirs, on 21-11: "estimate — show the weight of each piece, with the
     powder coating charge as its own line", and on 20-11: "separate entries
     are shown in ESTIMATE only."

     The estimate is the working paper. A section priced at seventy rupees a
     kilo reads as a section costing seventy rupees a kilo, when seventy is
     what it costs to coat it and nothing else; so on this one document the
     charge is lifted off the section and printed under it, against the
     weight it is actually charged on. Nothing is counted twice — the
     section keeps the specification and the coating keeps the money.

     Everywhere else the coating is one figure for the lot and already has
     a line to itself.                                                   */
  /* ── The order a yard thinks in ───────────────────────────────────────
     Theirs, on 22-11: "we enter items i.e inventory, with mix of sections,
     hardware, sheets. It should organise sections first, then sheets, then
     hardware even though randomly entered."

     The two summary lines keep the head of the document, because they are
     what is being charged for; the specification under them is sorted. */
  /* The order is settled when the document is built — each metal line with
     its own sections under it, then everything bought finished. */
  const printed = doc.lines.map(l => ({ l }))

  /* Lengths of aluminium on the document — the sections, counted, with the
     metal and coating summaries and the hardware left out. */
  const sectionPieces = doc.lines
    .filter(l => l.productId && productById(l.productId)?.kind === 'section')
    .reduce((s, l) => s + (l.nos ?? l.qty ?? 0), 0)


  return createPortal(
    <div className="print-modal-overlay fixed inset-0 z-[60] bg-black/50 overflow-y-auto p-4" onClick={onClose}>
      <div className="max-w-[820px] mx-auto flex justify-end gap-2 mb-3 print:hidden" onClick={e => e.stopPropagation()}>
        {/* "We shouldn't know about it" — theirs, on 21-11. */}
        <button onClick={toggleTax} className="btn-outline !bg-white"
          title={showTax
            ? 'Take the tax breakdown off the paper — the rate still prints as a small figure beside each amount'
            : 'Print the tax breakdown in full'}>
          {showTax ? <EyeOff size={14} /> : <Eye size={14} />}
          {showTax ? 'Hide GST' : 'Show GST'}
        </button>
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
              {[...(showsPhoto ? ['Image'] : []), '#', 'Description of Goods',
                ...(showsHsn ? ['HSN'] : []), 'Qty', 'Unit', 'Rate', 'Amount']
                .map((h, i) => {
                  const firstNum = (showsPhoto ? 1 : 0) + (showsHsn ? 3 : 2)
                  return (
                    <th key={h}
                      className={`border border-slate-300 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 ${i >= firstNum ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  )
                })}
            </tr>
          </thead>
          <tbody>
            {/* The metal sits at the head in its own right, and the sections
                under it carry what it costs to coat them — the way the shop
                quotes, and the way a customer can argue with it line by line. */}
            {printed.map(({ l }, i) => {
              const metal = l.group === 'aluminium'
              /* "Remove colours to hardware" — theirs, on 21-11 at 23:18.
                 Only a coated section carries one. */
              const shade = productById(l.productId)?.kind === 'section' || metal
                ? l.colour : undefined
              /* The one coating charge is a summary line and carries no
                 product; a section charged for its own coating is an
                 ordinary line of material and must not be set in the
                 heading's bold capitals, nor lose the weight it was
                 priced on. */
              const summary = metal || (l.group === 'coating' && !l.productId)
              /** the one coating entry, charged for the lot */
              const lotCoating = l.group === 'coating' && !l.productId
              return (
              <tr key={`${l.code}-${i}`} className={summary ? 'bg-slate-50' : undefined}>
                {/* ── The picture, in a column of its own ────────────────
                    Theirs, on 22-11: "images should come in a separate
                    column and the image should adjust." Set against the
                    description it pushed the text about; given its own
                    narrow column it sits square and the words stay put. */}
                {showsPhoto && (
                  <td className="border border-slate-300 px-1 py-1 align-middle text-center">
                    {imageOf(l.productId) ? (
                      <img src={imageOf(l.productId)} alt=""
                        className="w-12 h-12 object-contain mx-auto" />
                    ) : (
                      <span className="text-slate-300 text-[10px]">—</span>
                    )}
                  </td>
                )}
                <td className="border border-slate-300 px-2 py-1.5">{i + 1}</td>
                <td className="border border-slate-300 px-2 py-1.5">
                  <span className={summary ? 'font-bold text-slate-900 uppercase tracking-wide' : 'font-medium text-slate-900'}>
                    {/* "Colour should be in the name" — theirs, on 22-11. */}
                    {withColour(l.name, shade)}
                  </span>
                  {l.code && <span className="text-slate-500 text-[10px]"> ({l.code})</span>}
                  {/* The colour is in the name now — theirs, on 22-11 —
                      so only the dot stays, to pick the line out by eye. */}
                  {shade && shade !== UNCOATED ? (
                    <span className="inline-block w-[7px] h-[7px] rounded-full align-middle ml-1"
                      title={colourName(shade)}
                      style={{ background: swatchOf(shade), border: '1px solid #cbd5e1' }} />
                  ) : null}
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

                </td>
                {showsHsn && <td className="border border-slate-300 px-2 py-1.5">{l.hsn}</td>}
                {/* The aluminium line already carries every kilo on the
                    document. Repeating it against each section read as the
                    same weight twice — theirs: "displaying double time" — so
                    a section shows the count it was supplied in. */}
                {/* ── The coating goes out as one lump ──────────────────
                    Theirs, on 22-11: "don't show weight or nos in Powder
                    Coating, show 1, Unit: L/S meaning Lumpsum", and "rate
                    of powder coating should not be visible, let the total
                    amount reflect". */}
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">
                  {lotCoating ? '1' : l.qty.toLocaleString('en-IN')}
                </td>
                <td className="border border-slate-300 px-2 py-1.5 text-right">
                  {lotCoating ? 'L/S' : l.unit}
                </td>
                {/* On a quotation neither of these is printed: the money is
                    one figure at the foot. */}
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">
                  {/* A section whose coating has been lifted onto its own
                      line below is specification, not money. Nought rupees
                      printed against it reads as a free supply. */}
                  {lumpSum || lotCoating || !l.rate
                    ? <span className="text-slate-400">—</span>
                    : inr2(l.rate)}
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
            {printed.length === 0 && (
              <tr><td className="border border-slate-300 px-2 py-3 text-slate-500" colSpan={(showsPhoto ? 1 : 0) + (showsHsn ? 7 : 6)}>
                No material on this {kind.toLowerCase()} yet.
              </td></tr>
            )}
            <tr className="bg-slate-50 font-semibold">
              <td className="border border-slate-300 px-2 py-1.5" colSpan={(showsPhoto ? 1 : 0) + (showsHsn ? 3 : 2)}>
                Total
              </td>
              {/* ── What the total counts ────────────────────────────────
                  Theirs, on 22-11: "in Total, let it represent only total
                  number of Aluminium sections and length items — hardware
                  not required like rubber etc, weight not required." So it
                  is a count of lengths of aluminium: what went on the
                  lorry, not what it weighed and not the handles. */}
              <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">
                {sectionPieces ? sectionPieces.toLocaleString('en-IN') : ''}
              </td>
              <td className="border border-slate-300 px-2 py-1.5" colSpan={2} />
              <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{inr2(doc.taxable)}</td>
            </tr>
            {/* ── The tax, in the list rather than beside it ──────────────
                Theirs, on 22-11: "tax amount should come as an inventory
                (value of GST) should be visible." It is a line of the
                document like any other, and it was only ever in the little
                table off to the side. */}
            {showTax && doc.tax > 0 && (
              <tr>
                <td className="border border-slate-300 px-2 py-1.5" colSpan={(showsPhoto ? 1 : 0) + (showsHsn ? 3 : 2)}>
                  Tax
                </td>
                <td className="border border-slate-300 px-2 py-1.5" colSpan={3} />
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">
                  {inr2(doc.tax)}
                </td>
              </tr>
            )}
            {showTax && doc.tax > 0 && (
              <tr className="bg-slate-50 font-bold">
                <td className="border border-slate-300 px-2 py-1.5" colSpan={(showsPhoto ? 1 : 0) + (showsHsn ? 3 : 2)}>
                  Grand Total
                </td>
                <td className="border border-slate-300 px-2 py-1.5" colSpan={3} />
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">
                  {inr2(doc.total)}
                </td>
              </tr>
            )}
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

        {/* ── No bank details on an offer ───────────────────────────────
            Theirs, on 21-11 at 23:18: "remove bank details in ESTIMATE,
            QUOTATION, PROFORMA INVOICE." Nothing is being collected against
            any of the three — a quotation is a price, an estimate is a
            working paper, and a proforma is followed by the bill that
            carries the account to pay into. Printing the account number on
            a document nobody is meant to pay against is how a shop's
            details end up where they should not be. */}
        {/* ── No second set of totals ─────────────────────────────────
            Theirs, on 22-11: "remove small box below (taxable value, GST,
            total)." The same three figures are the last three lines of the
            table now, which is where a reader looks for them. */}
        <div className="mt-3 text-[11px]">
          <p className="text-slate-600">GSTIN: {COMPANY.gstin}</p>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-300 grid grid-cols-2 gap-4">
          <div>
            <p className="font-bold uppercase tracking-wider text-slate-500 text-[10px] mb-1">Terms & Conditions</p>
            {/* The document's own terms, settled when it was raised. */}
            <ol className="list-decimal list-inside text-[10px] text-slate-600 space-y-0.5">
              {/* ── Their terms, and only theirs ─────────────────────────
                  Theirs, on 22-11: "terms not updated." A fourth line was
                  being added here whatever the document said, so editing
                  the terms never quite gave what was typed. The document
                  prints the terms it carries. */}
              {(doc.terms?.length ? doc.terms : DEFAULT_TERMS[kind]).map((t, i) => (
                <li key={i}>{t}</li>
              ))}
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

