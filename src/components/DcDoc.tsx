import { createPortal } from 'react-dom'
import { UNCOATED, colourName } from '@/data/colours'
import { Printer, X } from 'lucide-react'
import { COMPANY } from '@/data/company'
import { fmtDate } from '@/lib/utils'

/* ── The despatch sheet, printed ───────────────────────────────────────────
   "PDF / Excel download option for that sheet." The PDF half goes through the
   browser's own print, the same way the invoice and the quotation already do,
   so one habit covers all three.

   Laid out as their paper is: the particulars at the head, the lines in their
   own column order, the total at the foot, and whatever was written over it
   beside the total rather than in place of it — so the printed sheet shows
   both figures and nobody has to wonder which one was used.              */

export interface DcPrintLine {
  slNo: number
  code: string
  name: string
  nos: number
  /** what a piece of this ought to weigh, as against what it did */
  weightRange: number | null
  kg: number | null
  /** the finish it arrived in — "without load" until it is coated */
  colour?: string
}

export default function DcDoc({ head, lines, totalKg, totalNos, overall, onClose }: {
  head: { label: string; dcNo: string; supplier: string; date: string; poNo: string; vehicleNo: string; sentTo: string }
  lines: DcPrintLine[]
  totalKg: number
  totalNos: number
  /** what somebody wrote over the total, where they did */
  overall: number | null
  onClose: () => void
}) {
  return createPortal(
    <div className="print-modal-overlay fixed inset-0 z-[60] bg-black/50 overflow-y-auto p-4" onClick={onClose}>
      <div className="max-w-[820px] mx-auto flex justify-end gap-2 mb-3 print:hidden" onClick={e => e.stopPropagation()}>
        <button onClick={() => window.print()} className="btn"><Printer size={14} /> Print / Save PDF</button>
        <button onClick={onClose} className="btn-outline !bg-white"><X size={14} /> Close</button>
      </div>

      <div id="doc-print-area" onClick={e => e.stopPropagation()}
        className="max-w-[820px] mx-auto bg-white text-slate-800 p-8 shadow-2xl text-[12px] leading-snug">

        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3">
          <div>
            <h1 className="text-[19px] font-bold tracking-wide text-slate-900">{COMPANY.name}</h1>
            <p className="mt-1 text-[11px] text-slate-600 max-w-sm leading-relaxed">
              {COMPANY.address.line1}, {COMPANY.address.line2}<br />
              {COMPANY.address.line3}, {COMPANY.address.state} – {COMPANY.address.pin}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[15px] font-bold uppercase tracking-wider text-slate-900">Purchase DC</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Goods received against the supplier's sheet</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-3 border-b border-slate-300">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Received From</p>
            <p className="font-semibold text-slate-900">{head.supplier}</p>
            <p className="text-slate-600">{head.label}</p>
          </div>
          <div className="text-right space-y-0.5">
            <Meta k="DC No." v={head.dcNo || '—'} bold />
            <Meta k="Date" v={head.date ? fmtDate(head.date) : '—'} />
            <Meta k="P.O. No." v={head.poNo || '—'} />
            <Meta k="Vehicle No." v={head.vehicleNo || '—'} />
            <Meta k="Sent To" v={head.sentTo || '—'} />
          </div>
        </div>

        <table className="w-full mt-3 border-collapse">
          <thead>
            <tr className="bg-slate-100">
              {['SL', 'CODE', 'PRODUCT NAME', 'COLOUR', 'QTY (NOS)', 'WEIGHT RANGE', 'WEIGHT (KGS)']
                .map((h, i) => (
                  <th key={h}
                    className={`border border-slate-300 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 ${i >= 4 ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {lines.map(l => (
              <tr key={l.slNo}>
                <td className="border border-slate-300 px-2 py-1.5 pr-4">{l.slNo}</td>
                <td className="border border-slate-300 px-2 py-1.5 font-mono text-[11px]">{l.code || '—'}</td>
                <td className="border border-slate-300 px-2 py-1.5 font-medium text-slate-900">
                  {l.name || '—'}
                </td>
                {/* "The material comes in without load. After conversion it
                    becomes a colour" — theirs, on 21-11. */}
                <td className="border border-slate-300 px-2 py-1.5 text-slate-700">
                  {!l.colour ? '—'
                    : l.colour === UNCOATED ? 'Without load'
                    : colourName(l.colour) || '—'}
                </td>
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{l.nos}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{l.weightRange ?? '—'}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">
                  {l.kg ?? <span className="text-slate-400">weighed above</span>}
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr><td className="border border-slate-300 px-2 py-3 text-slate-500" colSpan={7}>
                No lines on this sheet.
              </td></tr>
            )}
            <tr className="bg-slate-50 font-semibold">
              <td className="border border-slate-300 px-2 py-1.5" colSpan={4}>Total</td>
              <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{totalNos}</td>
              <td className="border border-slate-300 px-2 py-1.5" />
              <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{totalKg.toFixed(3)}</td>
            </tr>
          </tbody>
        </table>

        {overall !== null && Math.abs(overall - totalKg) > 0.0005 && (
          <p className="mt-2 text-[11px] text-slate-700">
            Overall written on this sheet: <b>{overall.toFixed(3)} kg</b>, against{' '}
            <b>{totalKg.toFixed(3)} kg</b> on the lines.
          </p>
        )}

        <div className="mt-6 pt-3 border-t border-slate-300 grid grid-cols-3 gap-4 text-[10px] text-slate-500">
          <div className="pt-10 border-t border-slate-400 mt-6">Received by</div>
          <div className="pt-10 border-t border-slate-400 mt-6">Checked by</div>
          <div className="pt-10 border-t border-slate-400 mt-6 text-right">For {COMPANY.name}</div>
        </div>

        <p className="text-center text-[9px] text-slate-400 mt-4 pt-2 border-t border-slate-200">
          Computer-generated purchase DC · {COMPANY.website}
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
