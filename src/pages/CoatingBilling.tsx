import { useState, useMemo } from 'react'
import { SprayCan, IndianRupee, Ruler, Sliders, RotateCcw, Receipt, Plus, Minus } from 'lucide-react'
import { PageHead, Stat, ExportBtn, TableCard, Modal, Select } from '@/components/ui'
import { POWDER_SHADES, PCUS } from '@/data/locations'
import { SECTION_PROFILES, COATABLE } from '@/data/sections'
import { CHALLANS, COATING_JOBS } from '@/data/challans'
import { MONTHS } from '@/data/txns'
import { inr, inr2, csvDownload, cn } from '@/lib/utils'
import { COMPANY, FY } from '@/data/company'

/** One rate card, editable in a single place, driving every bill on the page. */
interface RateCard {
  base: Record<string, number>; surcharge: Record<string, number>; sqftPerFt: Record<string, number>
  pt: number   // pre-treatment, charged on every line unless taken off
  tape: number // protective tape, charged only on the lines picked for it
}

const initialRates = (): RateCard => ({
  base: Object.fromEntries(PCUS.map(p => [p.id, p.ratePerSqft ?? 11])),
  surcharge: Object.fromEntries(POWDER_SHADES.map(s => [s.code, s.surcharge])),
  sqftPerFt: Object.fromEntries(SECTION_PROFILES.map(s => [s.code, s.sqftPerFt])),
  pt: 1,
  tape: 2,
})

const toggle = (set: Set<string>, k: string) => {
  const n = new Set(set); n.has(k) ? n.delete(k) : n.add(k); return n
}

const monthOf = (d: string) => MONTHS.find(m => d.startsWith(m.key))?.label ?? ''

export default function CoatingBilling() {
  const [rates, setRates] = useState<RateCard>(initialRates)
  const [editing, setEditing] = useState(false)
  const [month, setMonth] = useState('All Months')
  const [open, setOpen] = useState<string | null>(null)
  /* Pre-treatment is standard, so we track the lines it is taken OFF.
     Tape is the opposite — it is charged only where it is switched ON. */
  const [ptOff, setPtOff]   = useState<Set<string>>(new Set())
  const [tapeOn, setTapeOn] = useState<Set<string>>(new Set())

  /** A coating bill = all jobs sent to one coater in one month. */
  const bills = useMemo(() => {
    const groups = new Map<string, { pcu: string; month: string; jobs: typeof COATING_JOBS }>()
    for (const j of COATING_JOBS) {
      const key = `${j.pcu}|${monthOf(j.date)}`
      const g = groups.get(key) ?? { pcu: j.pcu, month: monthOf(j.date), jobs: [] }
      g.jobs.push(j)
      groups.set(key, g)
    }

    return [...groups.entries()].map(([key, g]) => {
      // Recompute sqft from the live rate card rather than the stored figure,
      // so editing sqft/ft or a rate flows through every line immediately.
      const lines = g.jobs.flatMap(j => {
        const dc = CHALLANS.find(d => d.no === j.dcNo)!
        return dc.lines.map(l => {
          const key  = `${j.dcNo}|${l.code}`
          const sqft = +(l.totalNos * l.cutLengthFt * (rates.sqftPerFt[l.code] ?? 0)).toFixed(1)
          const coat = +((rates.base[g.pcu] ?? 0) + (rates.surcharge[dc.shadeCode] ?? 0)).toFixed(2)
          const pt   = ptOff.has(key)  ? 0 : rates.pt
          const tape = tapeOn.has(key) ? rates.tape : 0
          const rate = +(coat + pt + tape).toFixed(2)
          return {
            key, dcNo: j.dcNo, date: j.date, code: l.code, name: l.name,
            nos: l.totalNos, cutLengthFt: l.cutLengthFt, shade: dc.shadeName, shadeCode: dc.shadeCode,
            sqft, coat, pt, tape, rate,
            ptAmt: +(sqft * pt).toFixed(2), tapeAmt: +(sqft * tape).toFixed(2),
            amount: +(sqft * rate).toFixed(2),
          }
        })
      })
      const taxable = +lines.reduce((s, l) => s + l.amount, 0).toFixed(2)
      const tax = +(taxable * 0.18).toFixed(2)
      return {
        key,
        no: `${g.pcu}/PC/26-27/${g.month.toUpperCase()}`,
        pcu: g.pcu, month: g.month,
        lines, jobs: g.jobs.length,
        sqft: +lines.reduce((s, l) => s + l.sqft, 0).toFixed(1),
        ptTotal:   +lines.reduce((s, l) => s + l.ptAmt, 0).toFixed(2),
        tapeTotal: +lines.reduce((s, l) => s + l.tapeAmt, 0).toFixed(2),
        taxable, cgst: +(tax / 2).toFixed(2), sgst: +(tax / 2).toFixed(2), total: Math.round(taxable + tax),
      }
    }).sort((a, b) => MONTHS.findIndex(m => m.label === b.month) - MONTHS.findIndex(m => m.label === a.month))
  }, [rates, ptOff, tapeOn])

  const shown = bills.filter(b => month === 'All Months' || b.month === month)
  const totalSqft = shown.reduce((s, b) => s + b.sqft, 0)
  const totalValue = shown.reduce((s, b) => s + b.total, 0)
  const avgRate = totalSqft > 0 ? shown.reduce((s, b) => s + b.taxable, 0) / totalSqft : 0

  const bill = bills.find(b => b.key === open)

  const tapedCount = shown.reduce((n, b) => n + b.lines.filter(l => l.tape > 0).length, 0)

  const exportCsv = () => csvDownload('vsa-powder-coating-bills.csv', [
    ['Powder coating charges', FY],
    [], ['Bill No', 'Coater', 'Month', 'DC No', 'Date', 'Section', 'Nos', 'Cut Length', 'Shade', 'Sqft', 'Coating', 'Pre-treatment', 'Tape', 'Rate/Sqft', 'Amount'],
    ...shown.flatMap(b => b.lines.map(l => [b.no, b.pcu, b.month, l.dcNo, l.date, l.name, l.nos, l.cutLengthFt, l.shade, l.sqft, l.coat, l.pt, l.tape, l.rate, l.amount])),
    [], ['Bill No', 'Pre-treatment', 'Tape', 'Taxable', 'CGST', 'SGST', 'Total'],
    ...shown.map(b => [b.no, b.ptTotal, b.tapeTotal, b.taxable, b.cgst, b.sgst, b.total]),
  ])

  return (
    <div>
      <PageHead title="Powder Coating Billing" sub="Section sqft is pre-fed; change a rate once and every bill recalculates">
        <Select value={month} onChange={setMonth} options={['All Months', ...MONTHS.map(m => m.label)]} />
        <button onClick={() => setEditing(e => !e)} className={editing ? 'btn' : 'btn-outline'}>
          <Sliders size={14} /> {editing ? 'Done editing' : 'Edit rate card'}
        </button>
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Area Coated"      value={`${Math.round(totalSqft).toLocaleString('en-IN')} sqft`} icon={Ruler}       tone="brand"  sub={`${shown.length} coating bills`} />
        <Stat label="Coating Charges"  value={inr(totalValue)}      icon={IndianRupee} tone="violet" sub="Inclusive of 18% GST" />
        <Stat label="Effective Rate"   value={`${inr2(avgRate)}/sqft`} icon={SprayCan}  tone="sky"    sub="Blended across shades" />
        <Stat label="Jobs Billed"      value={String(shown.reduce((s, b) => s + b.jobs, 0))} icon={Receipt} tone="green" sub="Coating DCs covered" />
      </div>

      {/* ── Rate card: the single place prices change ─────────────── */}
      <div className="card mb-5">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <p className="section-title text-base">Rate Card</p>
            <p className="section-sub">Base rate per coater plus a shade surcharge. Every bill above and below uses these figures.</p>
          </div>
          {editing && (
            <button onClick={() => setRates(initialRates())} className="btn-ghost"><RotateCcw size={13} /> Reset</button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-4)' }}>Base rate per coater (₹/sqft)</p>
            <div className="space-y-2">
              {PCUS.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm truncate" style={{ color: 'var(--text-2)' }}>{p.code} — {p.name.split('—')[0].trim()}</span>
                  {editing
                    ? <input type="number" step="0.1" className="input !w-24 !py-1 text-right tabular-nums"
                        value={rates.base[p.id]}
                        onChange={e => setRates(r => ({ ...r, base: { ...r.base, [p.id]: Number(e.target.value) } }))} />
                    : <span className="font-semibold tabular-nums shrink-0" style={{ color: 'var(--text-1)' }}>{inr2(rates.base[p.id])}</span>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-4)' }}>Shade surcharge (₹/sqft)</p>
            <div className="space-y-2">
              {POWDER_SHADES.map(s => (
                <div key={s.code} className="flex items-center justify-between gap-3">
                  <span className="text-sm truncate" style={{ color: 'var(--text-2)' }}>{s.name}</span>
                  {editing
                    ? <input type="number" step="0.1" className="input !w-24 !py-1 text-right tabular-nums"
                        value={rates.surcharge[s.code]}
                        onChange={e => setRates(r => ({ ...r, surcharge: { ...r.surcharge, [s.code]: Number(e.target.value) } }))} />
                    : <span className="font-medium tabular-nums shrink-0" style={{ color: rates.surcharge[s.code] ? 'var(--text-1)' : 'var(--text-4)' }}>
                        {rates.surcharge[s.code] ? '+' + inr2(rates.surcharge[s.code]) : '—'}
                      </span>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-4)' }}>Add-on charges (₹/sqft)</p>
            <div className="space-y-3">
              <Stepper
                label="Pre-treatment (PT)" hint="Charged on every line unless taken off in the bill"
                value={rates.pt} editing={editing}
                onChange={v => setRates(r => ({ ...r, pt: v }))} />
              <Stepper
                label="Protective tape" hint={`Charged only on picked lines — ${tapedCount} now`}
                value={rates.tape} editing={editing}
                onChange={v => setRates(r => ({ ...r, tape: v }))} />
              <div className="rounded-lg p-2.5 text-[11px] leading-relaxed"
                style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)', color: 'var(--text-4)' }}>
                Open any bill below to switch pre-treatment off, or tape on, for individual sections.
              </div>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-4)' }}>Pre-fed area per section (sqft per running ft)</p>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {SECTION_PROFILES.map(s => (
                <div key={s.code} className="flex items-center justify-between gap-3">
                  <span className="text-xs truncate" style={{ color: 'var(--text-2)' }}>
                    {COATABLE.find(p => p.code === s.code)?.name ?? s.code}
                  </span>
                  {editing
                    ? <input type="number" step="0.01" className="input !w-20 !py-1 text-right tabular-nums !text-xs"
                        value={rates.sqftPerFt[s.code]}
                        onChange={e => setRates(r => ({ ...r, sqftPerFt: { ...r.sqftPerFt, [s.code]: Number(e.target.value) } }))} />
                    : <span className="text-xs font-medium tabular-nums shrink-0" style={{ color: 'var(--text-1)' }}>{rates.sqftPerFt[s.code]}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {editing && (
          <p className="text-[11px] mt-4 pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
            Edits apply live — the bills below, the coating charge on every job and the sqft on every challan all move together.
          </p>
        )}
      </div>

      {/* ── Bills ──────────────────────────────────────────────────── */}
      <p className="section-title text-base mb-1">Coating Bills</p>
      <p className="section-sub mb-3">One bill per coater per month, computed from area × rate</p>
      <TableCard maxH="28rem">
        <thead>
          <tr><th>Bill No</th><th>Coater</th><th>Month</th><th className="num">Jobs</th><th className="num">Sqft</th><th className="num">Taxable</th><th className="num">GST</th><th className="num">Total</th></tr>
        </thead>
        <tbody>
          {shown.map(b => (
            <tr key={b.key} className="cursor-pointer" onClick={() => setOpen(b.key)}>
              <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{b.no}</td>
              <td><span className="badge-brand">{b.pcu}</span></td>
              <td className="text-xs">{b.month}</td>
              <td className="num tabular-nums">{b.jobs}</td>
              <td className="num tabular-nums">{b.sqft.toLocaleString('en-IN')}</td>
              <td className="num tabular-nums">{inr(b.taxable)}</td>
              <td className="num tabular-nums text-xs">{inr(b.cgst + b.sgst)}</td>
              <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(b.total)}</td>
            </tr>
          ))}
        </tbody>
      </TableCard>

      <Modal open={!!bill} onClose={() => setOpen(null)} title={bill ? `${bill.no} — powder coating charges` : ''} wide>
        {bill && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="badge-brand">{bill.pcu}</span>
              <span className="badge-gray">{bill.month} 2026</span>
              <span className="badge-gray">{bill.jobs} coating DCs</span>
              <span className="badge-blue">{bill.sqft.toLocaleString('en-IN')} sqft</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>Tape</span>
              <button className="btn-ghost !py-1 !text-[11px]"
                onClick={() => setTapeOn(v => { const n = new Set(v); bill.lines.forEach(l => n.add(l.key)); return n })}>All lines</button>
              <button className="btn-ghost !py-1 !text-[11px]"
                onClick={() => setTapeOn(v => { const n = new Set(v); bill.lines.forEach(l => n.delete(l.key)); return n })}>None</button>
              <span className="mx-1" style={{ color: 'var(--border-2)' }}>|</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>Pre-treatment</span>
              <button className="btn-ghost !py-1 !text-[11px]"
                onClick={() => setPtOff(v => { const n = new Set(v); bill.lines.forEach(l => n.delete(l.key)); return n })}>All lines</button>
              <button className="btn-ghost !py-1 !text-[11px]"
                onClick={() => setPtOff(v => { const n = new Set(v); bill.lines.forEach(l => n.add(l.key)); return n })}>None</button>
            </div>

            <div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--border-2)', maxHeight: '20rem' }}>
              <table className="tbl">
                <thead><tr><th>DC No</th><th>Section</th><th className="num">Nos</th><th className="num">Cut Len</th><th>Shade</th><th className="num">Sqft</th><th className="text-center">PT</th><th className="text-center">Tape</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {bill.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="text-xs whitespace-nowrap font-medium" style={{ color: 'var(--text-1)' }}>{l.dcNo}</td>
                      <td className="text-xs max-w-[13rem] truncate" title={l.name}>{l.name}</td>
                      <td className="num tabular-nums text-xs">{l.nos}</td>
                      <td className="num tabular-nums text-xs">{l.cutLengthFt} ft</td>
                      <td className="text-xs whitespace-nowrap">{l.shade}</td>
                      <td className="num tabular-nums text-xs">{l.sqft.toLocaleString('en-IN')}</td>
                      <td className="text-center">
                        <input type="checkbox" className="accent-[var(--brand)] cursor-pointer"
                          checked={l.pt > 0} onChange={() => setPtOff(v => toggle(v, l.key))} />
                      </td>
                      <td className="text-center">
                        <input type="checkbox" className="accent-[var(--brand)] cursor-pointer"
                          checked={l.tape > 0} onChange={() => setTapeOn(v => toggle(v, l.key))} />
                      </td>
                      <td className="num tabular-nums text-xs" title={`Coating ${inr2(l.coat)}${l.pt ? ' + PT ' + inr2(l.pt) : ''}${l.tape ? ' + tape ' + inr2(l.tape) : ''}`}>{inr2(l.rate)}</td>
                      <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{inr2(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <table className="text-sm">
                <tbody>
                  <Tr k="Coating charges" v={inr2(+(bill.taxable - bill.ptTotal - bill.tapeTotal).toFixed(2))} />
                  <Tr k="Pre-treatment" v={bill.ptTotal ? inr2(bill.ptTotal) : '—'} />
                  <Tr k="Protective tape" v={bill.tapeTotal ? inr2(bill.tapeTotal) : '—'} />
                  <Tr k="Taxable value" v={inr2(bill.taxable)} />
                  <Tr k="CGST @ 9%" v={inr2(bill.cgst)} />
                  <Tr k="SGST @ 9%" v={inr2(bill.sgst)} />
                  <tr className="font-bold" style={{ color: 'var(--text-1)' }}>
                    <td className="pr-8 py-1.5 border-t" style={{ borderColor: 'var(--border-2)' }}>Payable to coater</td>
                    <td className={cn('text-right tabular-nums border-t')} style={{ borderColor: 'var(--border-2)' }}>{inr(bill.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-[11px] pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
              Job work charges billed by the coater to {COMPANY.name}. Area computed as pieces × cut length × pre-fed sqft
              per running foot for each profile. HSN 9988 — job work on physical inputs, GST 18%.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Stepper({ label, hint, value, editing, onChange }: {
  label: string; hint: string; value: number; editing: boolean; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm" style={{ color: 'var(--text-2)' }}>{label}</span>
        {editing ? (
          <div className="flex items-center gap-1 shrink-0">
            <button className="btn-ghost !px-1.5 !py-1" onClick={() => onChange(+(value - 1).toFixed(2))} aria-label={`Reduce ${label}`}><Minus size={12} /></button>
            <input type="number" step="0.5" className="input !w-16 !py-1 text-right tabular-nums !text-xs"
              value={value} onChange={e => onChange(Number(e.target.value))} />
            <button className="btn-ghost !px-1.5 !py-1" onClick={() => onChange(+(value + 1).toFixed(2))} aria-label={`Increase ${label}`}><Plus size={12} /></button>
          </div>
        ) : (
          <span className="font-semibold tabular-nums shrink-0" style={{ color: value ? 'var(--text-1)' : 'var(--text-4)' }}>
            {value ? '+' + inr2(value) : '—'}
          </span>
        )}
      </div>
      <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-4)' }}>{hint}</p>
    </div>
  )
}

const Tr = ({ k, v }: { k: string; v: string }) => (
  <tr><td className="pr-8 py-1" style={{ color: 'var(--text-3)' }}>{k}</td><td className="text-right tabular-nums">{v}</td></tr>
)
