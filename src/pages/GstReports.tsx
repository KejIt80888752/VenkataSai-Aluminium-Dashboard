import { useState } from 'react'
import { FileSpreadsheet, ArrowUpCircle, ArrowDownCircle, IndianRupee } from 'lucide-react'
import { PageHead, Stat, Select, ExportBtn, TableCard } from '@/components/ui'
import { INVOICES, PURCHASES, TOTALS, MONTHS } from '@/data/txns'
import { P } from '@/data/catalogue'
import { inr, inr2, fmtDate, csvDownload } from '@/lib/utils'
import { COMPANY, FY } from '@/data/company'

const VIEWS = ['GSTR-1 (Outward)', 'GSTR-2 (Inward)', 'GSTR-3B Summary', 'HSN Summary']
const MONTH_OPTS = ['All Months', ...MONTHS.map(m => m.label)]
const monthOf = (d: string) => MONTHS.find(m => d.startsWith(m.key))?.label ?? ''

export default function GstReports() {
  const [view, setView]   = useState(VIEWS[0])
  const [month, setMonth] = useState('All Months')

  const inv = INVOICES.filter(i => month === 'All Months' || monthOf(i.date) === month)
  const pur = PURCHASES.filter(p => month === 'All Months' || monthOf(p.date) === month)

  const outputTax = inv.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0)
  const inputTax  = pur.reduce((s, p) => s + p.cgst + p.sgst + p.igst, 0)
  const netTax    = outputTax - inputTax

  /** HSN-wise summary as required in GSTR-1 Table 12. */
  const hsnRows = (() => {
    const m = new Map<string, { hsn: string; desc: string; qty: number; unit: string; taxable: number; tax: number }>()
    for (const i of inv)
      for (const l of i.lines) {
        const e = m.get(l.hsn) ?? { hsn: l.hsn, desc: P.find(p => p.hsn === l.hsn)?.category ?? '—', qty: 0, unit: l.unit, taxable: 0, tax: 0 }
        e.qty += l.qty; e.taxable += l.amount; e.tax += l.amount * l.gst / 100
        m.set(l.hsn, e)
      }
    return [...m.values()].sort((a, b) => b.taxable - a.taxable)
  })()

  const monthly = MONTHS.map(m => {
    const mi = INVOICES.filter(i => i.date.startsWith(m.key))
    const mp = PURCHASES.filter(p => p.date.startsWith(m.key))
    const out = mi.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0)
    const inp = mp.reduce((s, p) => s + p.cgst + p.sgst + p.igst, 0)
    return {
      m: m.label,
      taxableOut: mi.reduce((s, i) => s + i.taxable, 0),
      out, taxableIn: mp.reduce((s, p) => s + p.taxable, 0), inp, net: out - inp,
    }
  })

  const exportCsv = () => {
    if (view === 'HSN Summary') {
      csvDownload('vsa-gstr1-hsn-summary.csv', [
        ['HSN', 'Description', 'Qty', 'UQC', 'Taxable Value', 'Tax Amount'],
        ...hsnRows.map(h => [h.hsn, h.desc, h.qty.toFixed(1), h.unit.toUpperCase(), h.taxable.toFixed(2), h.tax.toFixed(2)]),
      ])
    } else if (view === 'GSTR-2 (Inward)') {
      csvDownload('vsa-gstr2-inward.csv', [
        ['Bill No', 'Date', 'Supplier', 'GSTIN', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'],
        ...pur.map(p => [p.no, p.date, p.supplier, p.gstin, p.taxable, p.cgst, p.sgst, p.igst, p.total]),
      ])
    } else if (view === 'GSTR-3B Summary') {
      csvDownload('vsa-gstr3b-summary.csv', [
        ['Month', 'Outward Taxable', 'Output Tax', 'Inward Taxable', 'Input Credit', 'Net Payable'],
        ...monthly.map(m => [m.m, m.taxableOut.toFixed(2), m.out.toFixed(2), m.taxableIn.toFixed(2), m.inp.toFixed(2), m.net.toFixed(2)]),
      ])
    } else {
      csvDownload('vsa-gstr1-outward.csv', [
        ['Invoice No', 'Date', 'Customer', 'GSTIN', 'Place of Supply', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'],
        ...inv.map(i => [i.no, i.date, i.clientName, i.gstin, i.state, i.taxable, i.cgst, i.sgst, i.igst, i.total]),
      ])
    }
  }

  return (
    <div>
      <PageHead title="GST Reports" sub={`GSTIN ${COMPANY.gstin} · ${COMPANY.state} (${COMPANY.stateCode}) · ${FY}`}>
        <Select value={view} onChange={setView} options={VIEWS} className="min-w-[12rem]" />
        <Select value={month} onChange={setMonth} options={MONTH_OPTS} />
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Output Tax (Sales)"  value={inr(outputTax)} icon={ArrowUpCircle}   tone="brand" sub={`${inv.length} outward supplies`} />
        <Stat label="Input Credit (ITC)"  value={inr(inputTax)}  icon={ArrowDownCircle} tone="green" sub={`${pur.length} inward supplies`} />
        <Stat label="Net GST Payable"     value={inr(netTax)}    icon={IndianRupee}     tone={netTax >= 0 ? 'red' : 'green'} sub="After set-off of ITC" />
        <Stat label="Taxable Turnover"    value={inr(inv.reduce((s, i) => s + i.taxable, 0))} icon={FileSpreadsheet} tone="violet" sub="Outward supplies" />
      </div>

      {view === 'GSTR-1 (Outward)' && (
        <TableCard maxH="36rem">
          <thead>
            <tr><th>Invoice</th><th>Date</th><th>Customer</th><th>GSTIN</th><th>POS</th>
              <th className="num">Taxable</th><th className="num">CGST</th><th className="num">SGST</th><th className="num">IGST</th><th className="num">Total</th></tr>
          </thead>
          <tbody>
            {inv.map(i => (
              <tr key={i.id}>
                <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{i.no}</td>
                <td className="whitespace-nowrap text-xs">{fmtDate(i.date)}</td>
                <td className="max-w-[13rem] truncate">{i.clientName}</td>
                <td className="font-mono text-[11px] whitespace-nowrap">{i.gstin}</td>
                <td className="text-xs whitespace-nowrap">{i.state}</td>
                <td className="num tabular-nums">{inr2(i.taxable)}</td>
                <td className="num tabular-nums text-xs">{i.cgst ? inr2(i.cgst) : '—'}</td>
                <td className="num tabular-nums text-xs">{i.sgst ? inr2(i.sgst) : '—'}</td>
                <td className="num tabular-nums text-xs">{i.igst ? inr2(i.igst) : '—'}</td>
                <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}

      {view === 'GSTR-2 (Inward)' && (
        <TableCard maxH="36rem">
          <thead>
            <tr><th>Bill No</th><th>Date</th><th>Supplier</th><th>GSTIN</th><th>State</th>
              <th className="num">Taxable</th><th className="num">CGST</th><th className="num">SGST</th><th className="num">IGST</th><th className="num">Total</th></tr>
          </thead>
          <tbody>
            {pur.map(p => (
              <tr key={p.id}>
                <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{p.no}</td>
                <td className="whitespace-nowrap text-xs">{fmtDate(p.date)}</td>
                <td className="max-w-[14rem] truncate">{p.supplier}</td>
                <td className="font-mono text-[11px] whitespace-nowrap">{p.gstin}</td>
                <td className="text-xs whitespace-nowrap">{p.state}</td>
                <td className="num tabular-nums">{inr2(p.taxable)}</td>
                <td className="num tabular-nums text-xs">{p.cgst ? inr2(p.cgst) : '—'}</td>
                <td className="num tabular-nums text-xs">{p.sgst ? inr2(p.sgst) : '—'}</td>
                <td className="num tabular-nums text-xs">{p.igst ? inr2(p.igst) : '—'}</td>
                <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(p.total)}</td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}

      {view === 'GSTR-3B Summary' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <TableCard maxH="30rem">
            <thead>
              <tr><th>Month</th><th className="num">Outward Taxable</th><th className="num">Output Tax</th>
                <th className="num">Input Credit</th><th className="num">Net Payable</th></tr>
            </thead>
            <tbody>
              {monthly.map(m => (
                <tr key={m.m}>
                  <td className="font-medium" style={{ color: 'var(--text-1)' }}>{m.m}</td>
                  <td className="num tabular-nums">{inr(m.taxableOut)}</td>
                  <td className="num tabular-nums">{inr(m.out)}</td>
                  <td className="num tabular-nums text-green-600">{inr(m.inp)}</td>
                  <td className={`num tabular-nums font-semibold ${m.net >= 0 ? 'text-red-500' : 'text-green-600'}`}>{inr(m.net)}</td>
                </tr>
              ))}
              <tr style={{ background: 'var(--bg-card2)' }}>
                <td className="font-bold" style={{ color: 'var(--text-1)' }}>Total</td>
                <td className="num tabular-nums font-bold" style={{ color: 'var(--text-1)' }}>{inr(TOTALS.revenue)}</td>
                <td className="num tabular-nums font-bold" style={{ color: 'var(--text-1)' }}>{inr(TOTALS.outputGst)}</td>
                <td className="num tabular-nums font-bold text-green-600">{inr(TOTALS.inputGst)}</td>
                <td className="num tabular-nums font-bold text-red-500">{inr(TOTALS.outputGst - TOTALS.inputGst)}</td>
              </tr>
            </tbody>
          </TableCard>

          <div className="card">
            <p className="section-title text-base mb-3">Filing Checklist</p>
            <ul className="space-y-2.5 text-xs" style={{ color: 'var(--text-3)' }}>
              <li>• <b style={{ color: 'var(--text-1)' }}>GSTR-1</b> — outward supplies, due 11th of the following month.</li>
              <li>• <b style={{ color: 'var(--text-1)' }}>GSTR-3B</b> — summary return and tax payment, due 20th.</li>
              <li>• All aluminium sections billed under HSN <b style={{ color: 'var(--text-1)' }}>7604</b> at 18%; sheets/coils under 7606, glass under 7005/7007, hardware under 8302.</li>
              <li>• Karnataka buyers attract CGST 9% + SGST 9%; out-of-state buyers attract IGST 18%.</li>
              <li>• E-way bill generated for every consignment above ₹50,000 — see the invoice register.</li>
              <li>• Reconcile ITC against GSTR-2B before claiming credit of <b style={{ color: 'var(--text-1)' }}>{inr(TOTALS.inputGst)}</b>.</li>
            </ul>
          </div>
        </div>
      )}

      {view === 'HSN Summary' && (
        <TableCard maxH="34rem">
          <thead>
            <tr><th>HSN</th><th>Description</th><th className="num">Quantity</th><th>UQC</th>
              <th className="num">Taxable Value</th><th className="num">Tax Amount</th><th className="num">Total</th></tr>
          </thead>
          <tbody>
            {hsnRows.map(h => (
              <tr key={h.hsn}>
                <td className="font-mono font-medium" style={{ color: 'var(--text-1)' }}>{h.hsn}</td>
                <td>{h.desc}</td>
                <td className="num tabular-nums">{h.qty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                <td className="text-xs uppercase">{h.unit}</td>
                <td className="num tabular-nums">{inr2(h.taxable)}</td>
                <td className="num tabular-nums">{inr2(h.tax)}</td>
                <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(h.taxable + h.tax)}</td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </div>
  )
}
