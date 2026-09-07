import { useState, useMemo } from 'react'
import { FileText, Plus, Trash2, Printer, Copy, Ruler, Percent, IndianRupee } from 'lucide-react'
import { PageHead, Stat, Select, Modal, Empty } from '@/components/ui'
import WindowDrawing, { WINDOW_TYPES, type WindowType } from '@/components/WindowDrawing'
import { CLIENTS } from '@/data/parties'
import { inr, inr2 } from '@/lib/utils'
import { COMPANY, TODAY, FY } from '@/data/company'

/* ── A quotation a customer can actually read ──────────────────────────────
   Every window is drawn to the size typed against it, and the specification
   sits underneath as ticked lines — so what is included, and what is not, is
   settled on paper rather than argued about on site.                      */

interface Spec { key: string; label: string; value: string; on: boolean }

const BASE_SPECS = (): Spec[] => [
  { key: 'shade',    label: 'Colour / shade',   value: 'Ivory', on: true },
  { key: 'mesh',     label: 'Mesh',             value: 'Aluminium mesh', on: true },
  { key: 'glass',    label: 'Glass',            value: '4 mm clear annealed', on: true },
  { key: 'section',  label: 'Aluminium section',value: 'Jindal 2.0 mm wall', on: true },
  { key: 'hardware', label: 'Hardware',         value: 'Ozone rollers, twin lock', on: true },
  { key: 'silicone', label: 'Silicone',         value: 'Inside only — outside extra', on: true },
  { key: 'rubber',   label: 'Rubber / gasket',  value: '4 mm clear PVC', on: true },
  { key: 'finish',   label: 'Finish',           value: 'Powder coated', on: false },
]

interface Line {
  id: string
  type: WindowType
  label: string
  widthMm: number
  heightMm: number
  qty: number
  ratePerSqft: number
  gst: number
  specs: Spec[]
  note: string
}

const SHADES = ['Ivory', 'White', 'Black', 'Brown', 'Champagne', 'Mill Finish']
const GST_RATES = [0, 5, 12, 18, 28]

const sqft = (l: Line) => +((l.widthMm / 304.8) * (l.heightMm / 304.8) * l.qty).toFixed(2)
const amount = (l: Line) => +(sqft(l) * l.ratePerSqft).toFixed(2)

let seq = 0
const newLine = (): Line => ({
  id: `L${++seq}`, type: '3 Track Sliding', label: '3 Track Aluminium Sliding Window',
  widthMm: 1800, heightMm: 1200, qty: 4, ratePerSqft: 585, gst: 18,
  specs: BASE_SPECS(), note: '',
})

export default function Proforma() {
  const [client, setClient] = useState(CLIENTS[0].name)
  const [lines, setLines] = useState<Line[]>([newLine()])
  const [open, setOpen] = useState<string | null>(lines[0]?.id ?? null)
  const [preview, setPreview] = useState(false)

  const cust = CLIENTS.find(c => c.name === client)!

  /* Retail buyers with no GSTIN are quoted without tax unless told otherwise. */
  const suggestedGst = cust.gstin.trim() === '' || cust.type === 'B2C Retail' ? 0 : 18

  const totals = useMemo(() => {
    const taxable = +lines.reduce((s, l) => s + amount(l), 0).toFixed(2)
    const tax = +lines.reduce((s, l) => s + amount(l) * l.gst / 100, 0).toFixed(2)
    return { taxable, tax, total: Math.round(taxable + tax), area: +lines.reduce((s, l) => s + sqft(l), 0).toFixed(1) }
  }, [lines])

  const patch = (id: string, p: Partial<Line>) => setLines(ls => ls.map(l => l.id === id ? { ...l, ...p } : l))
  const patchSpec = (id: string, key: string, p: Partial<Spec>) =>
    setLines(ls => ls.map(l => l.id === id
      ? { ...l, specs: l.specs.map(s => s.key === key ? { ...s, ...p } : s) } : l))

  const editing = lines.find(l => l.id === open) ?? null

  return (
    <div>
      <PageHead title="Proforma & Quotation"
        sub="Each window drawn to the size quoted, with the specification ticked line by line">
        <Select value={client} onChange={v => {
          setClient(v)
          const c = CLIENTS.find(x => x.name === v)!
          const g = c.gstin.trim() === '' || c.type === 'B2C Retail' ? 0 : 18
          setLines(ls => ls.map(l => ({ ...l, gst: g })))
        }} options={CLIENTS.map(c => c.name)} className="min-w-[18rem]" />
        <button className="btn-outline" onClick={() => { const l = newLine(); setLines(ls => [...ls, l]); setOpen(l.id) }}>
          <Plus size={14} /> Add window
        </button>
        <button className="btn" disabled={!lines.length} onClick={() => setPreview(true)}>
          <Printer size={14} /> Preview
        </button>
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Windows Quoted" value={String(lines.reduce((s, l) => s + l.qty, 0))} icon={FileText} tone="brand"
          sub={`${lines.length} ${lines.length === 1 ? 'type' : 'types'}`} />
        <Stat label="Total Area" value={`${totals.area} sqft`} icon={Ruler} tone="violet" sub="Width × height × quantity" />
        <Stat label="Before Tax" value={inr(totals.taxable)} icon={IndianRupee} tone="sky"
          sub={totals.area ? `${inr2(totals.taxable / totals.area)} a sqft` : '—'} />
        <Stat label="Quotation Total" value={inr(totals.total)} icon={Percent} tone="green"
          sub={lines.every(l => l.gst === 0) ? 'Quoted without GST' : `Including ${inr(totals.tax)} GST`} />
      </div>

      {cust.gstin.trim() === '' && lines.some(l => l.gst > 0) && (
        <div className="card mb-5" style={{ borderColor: 'var(--amber, #f59e0b)' }}>
          <p className="text-sm" style={{ color: 'var(--text-1)' }}>
            {cust.name} has no GSTIN on file, so this would normally be quoted without tax.
          </p>
          <button className="btn-outline !py-1 !text-xs mt-2"
            onClick={() => setLines(ls => ls.map(l => ({ ...l, gst: suggestedGst })))}>
            Quote without GST
          </button>
        </div>
      )}

      {/* ── The windows ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
        {lines.map(l => (
          <div key={l.id} className="card">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="section-title text-base truncate">{l.label}</p>
                <p className="section-sub">{l.widthMm} × {l.heightMm} mm · {l.qty} nos · {sqft(l)} sqft</p>
              </div>
              <span className="flex gap-1 shrink-0">
                <button className="btn-ghost !px-2 !py-1" title="Duplicate"
                  onClick={() => setLines(ls => [...ls, { ...l, id: `L${++seq}` }])}><Copy size={13} /></button>
                <button className="btn-ghost !px-2 !py-1" title="Remove" style={{ color: 'var(--red)' }}
                  onClick={() => setLines(ls => ls.filter(x => x.id !== l.id))}><Trash2 size={13} /></button>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[13rem,1fr] gap-4">
              <div className="rounded-lg p-2" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <WindowDrawing type={l.type} widthMm={l.widthMm} heightMm={l.heightMm}
                  mesh={l.specs.find(s => s.key === 'mesh')?.on}
                  shade={l.specs.find(s => s.key === 'shade')?.value} />
              </div>

              <div className="min-w-0">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <Field label="Width mm" value={l.widthMm} onChange={v => patch(l.id, { widthMm: Number(v) || 0 })} />
                  <Field label="Height mm" value={l.heightMm} onChange={v => patch(l.id, { heightMm: Number(v) || 0 })} />
                  <Field label="Quantity" value={l.qty} onChange={v => patch(l.id, { qty: Number(v) || 0 })} />
                  <Field label="Rate / sqft" value={l.ratePerSqft} onChange={v => patch(l.id, { ratePerSqft: Number(v) || 0 })} />
                </div>

                <div className="space-y-1">
                  {l.specs.filter(s => s.on).slice(0, 5).map(s => (
                    <div key={s.key} className="flex items-baseline gap-2 text-xs">
                      <span className="shrink-0 w-28 truncate" style={{ color: 'var(--text-4)' }}>{s.label}</span>
                      <span className="truncate" style={{ color: 'var(--text-2)' }}>{s.value}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 mt-3 pt-2.5"
                  style={{ borderTop: '1px solid var(--border-2)' }}>
                  <button className="btn-outline !py-1 !text-xs" onClick={() => setOpen(l.id)}>Edit specification</button>
                  <span className="tabular-nums font-bold" style={{ color: 'var(--text-1)' }}>{inr(amount(l))}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {lines.length === 0 && <div className="card"><Empty msg="Add a window to start the quotation" /></div>}
      </div>

      {/* ── Specification editor ──────────────────────────────────────── */}
      <Modal open={!!editing} onClose={() => setOpen(null)} title={editing?.label ?? ''} wide>
        {editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-[13rem,1fr] gap-4">
              <div className="rounded-lg p-2" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <WindowDrawing type={editing.type} widthMm={editing.widthMm} heightMm={editing.heightMm}
                  mesh={editing.specs.find(s => s.key === 'mesh')?.on}
                  shade={editing.specs.find(s => s.key === 'shade')?.value} height={190} />
              </div>
              <div className="space-y-2.5">
                <div>
                  <label className="label">Window type</label>
                  <Select value={editing.type} onChange={v => patch(editing.id, { type: v as WindowType })}
                    options={WINDOW_TYPES} className="!w-full" />
                </div>
                <div>
                  <label className="label">How it reads on the quotation</label>
                  <input className="input w-full" value={editing.label}
                    onChange={e => patch(editing.id, { label: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">GST %</label>
                    <Select value={String(editing.gst)} onChange={v => patch(editing.id, { gst: Number(v) })}
                      options={GST_RATES.map(String)} className="!w-full" />
                  </div>
                  <div>
                    <label className="label">Rate / sqft</label>
                    <input className="input w-full text-right tabular-nums" value={editing.ratePerSqft}
                      onChange={e => patch(editing.id, { ratePerSqft: Number(e.target.value) || 0 })} />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-4)' }}>
                Specification — untick anything not included
              </p>
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-2)' }}>
                {editing.specs.map((s, i) => (
                  <div key={s.key} className="flex items-center gap-2 px-3 py-2"
                    style={{ borderTop: i ? '1px solid var(--border-2)' : undefined, opacity: s.on ? 1 : .5 }}>
                    <input type="checkbox" className="accent-[var(--brand)] shrink-0" checked={s.on}
                      onChange={() => patchSpec(editing.id, s.key, { on: !s.on })} />
                    <span className="text-xs w-32 shrink-0 truncate" style={{ color: 'var(--text-3)' }}>{s.label}</span>
                    {s.key === 'shade'
                      ? <Select value={s.value} onChange={v => patchSpec(editing.id, s.key, { value: v })}
                          options={SHADES} className="!w-full !py-1 !text-xs" />
                      : <input className="input !py-1 !text-xs w-full" value={s.value}
                          onChange={e => patchSpec(editing.id, s.key, { value: e.target.value })} />}
                  </div>
                ))}
              </div>
              <button className="btn-ghost !text-xs mt-2"
                onClick={() => setLines(ls => ls.map(l => l.id === editing.id
                  ? { ...l, specs: [...l.specs, { key: `x${l.specs.length}`, label: 'Extra', value: '', on: true }] } : l))}>
                <Plus size={13} /> Add a specification line
              </button>
            </div>

            <div>
              <label className="label">Anything more to mention</label>
              <textarea className="input w-full min-h-[3.5rem]" value={editing.note}
                placeholder="Site conditions, who does the scaffolding, what is excluded…"
                onChange={e => patch(editing.id, { note: e.target.value })} />
            </div>
          </div>
        )}
      </Modal>

      {/* ── What the customer receives ────────────────────────────────── */}
      <Modal open={preview} onClose={() => setPreview(false)} title="Proforma invoice" wide>
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3" style={{ borderBottom: '2px solid var(--text-1)' }}>
            <div>
              <p className="font-bold text-base" style={{ color: 'var(--text-1)' }}>{COMPANY.name}</p>
              <p className="text-[11px] max-w-[24rem]" style={{ color: 'var(--text-4)' }}>{COMPANY.addressOneLine}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>GSTIN {COMPANY.gstin} · {COMPANY.phone}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>PROFORMA INVOICE</p>
              <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>{TODAY} · {FY}</p>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>Quotation for</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{cust.name}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>
              {cust.area}, {cust.state}{cust.gstin ? ` · GSTIN ${cust.gstin}` : ' · no GSTIN on file'}
            </p>
          </div>

          <div className="space-y-3">
            {lines.map((l, i) => (
              <div key={l.id} className="rounded-lg p-3 grid grid-cols-1 sm:grid-cols-[11rem,1fr] gap-4"
                style={{ border: '1px solid var(--border-2)' }}>
                <div className="rounded p-1.5" style={{ background: 'var(--bg-card2)' }}>
                  <WindowDrawing type={l.type} widthMm={l.widthMm} heightMm={l.heightMm}
                    mesh={l.specs.find(s => s.key === 'mesh')?.on}
                    shade={l.specs.find(s => s.key === 'shade')?.value} height={150} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{i + 1}. {l.label}</p>
                  <p className="text-[11px] mb-2" style={{ color: 'var(--text-4)' }}>
                    {l.type} · {l.widthMm} × {l.heightMm} mm · {l.qty} nos · {sqft(l)} sqft
                  </p>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
                    {l.specs.filter(s => s.on && s.value.trim()).map(s => (
                      <div key={s.key} className="flex gap-2 text-[11.5px]">
                        <dt className="shrink-0 w-24" style={{ color: 'var(--text-4)' }}>{s.label}</dt>
                        <dd style={{ color: 'var(--text-2)' }}>{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {l.note && <p className="text-[11px] mt-1.5 italic" style={{ color: 'var(--text-3)' }}>{l.note}</p>}
                  <div className="flex items-center justify-between gap-2 mt-2 pt-2"
                    style={{ borderTop: '1px solid var(--border-2)' }}>
                    <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>
                      {inr2(l.ratePerSqft)} a sqft{l.gst ? ` · GST ${l.gst}%` : ' · no GST'}
                    </span>
                    <span className="tabular-nums font-bold" style={{ color: 'var(--text-1)' }}>{inr(amount(l))}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <table className="text-sm">
              <tbody>
                <Tr k="Total area" v={`${totals.area} sqft`} />
                <Tr k="Before tax" v={inr2(totals.taxable)} />
                <Tr k="GST" v={totals.tax ? inr2(totals.tax) : 'Not applicable'} />
                <tr className="font-bold" style={{ color: 'var(--text-1)' }}>
                  <td className="pr-8 py-1.5 border-t" style={{ borderColor: 'var(--border-2)' }}>Quotation total</td>
                  <td className="text-right tabular-nums border-t" style={{ borderColor: 'var(--border-2)' }}>{inr(totals.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[11px] pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
            Drawings are to the sizes quoted above and are for understanding, not for fabrication. Sections, glass and
            hardware are as specified against each window; anything not listed is not included. {COMPANY.terms[1]}
          </p>
        </div>
      </Modal>
    </div>
  )
}

const Field = ({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) => (
  <div>
    <label className="label">{label}</label>
    <input className="input w-full text-right tabular-nums !py-1 !text-xs" value={value}
      onChange={e => onChange(e.target.value)} />
  </div>
)

const Tr = ({ k, v }: { k: string; v: string }) => (
  <tr><td className="pr-8 py-1" style={{ color: 'var(--text-3)' }}>{k}</td>
    <td className="text-right tabular-nums">{v}</td></tr>
)
