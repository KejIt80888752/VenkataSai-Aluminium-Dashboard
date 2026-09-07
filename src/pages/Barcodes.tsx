import { useState, useEffect, useRef, useMemo } from 'react'
import JsBarcode from 'jsbarcode'
import { ScanBarcode, Printer, Tag, CircleAlert, Layers } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Empty } from '@/components/ui'
import { P } from '@/data/catalogue'
import { BINS } from '@/data/warehouse'
import { inr2, csvDownload, cn } from '@/lib/utils'
import { COMPANY } from '@/data/company'

/* ── Numbering ─────────────────────────────────────────────────────────────
   A flat running number, with no meaning built into it. Codes that encode
   the category look tidy until an item changes category — then every sticker
   already on the rack is wrong and the stock has to be relabelled. The
   meaning belongs in the item master, where it can be changed for nothing.

   2 000 0001 upward leaves room for 9,999 sellable variants against the
   1,500 in use today, and the leading 2 keeps our own codes clear of any
   printed EAN that arrives on a supplier's carton.                        */
const BASE = 200000000
const barcodeFor = (i: number) => String(BASE + i + 1)

const SIZES = [
  { id: '50x25', label: '50 × 25 mm — small sections', w: 50, h: 25 },
  { id: '75x38', label: '75 × 38 mm — general', w: 75, h: 38 },
  { id: '100x50', label: '100 × 50 mm — bundles and sheets', w: 100, h: 50 },
] as const

export default function Barcodes() {
  const [q, setQ] = useState('')
  const [size, setSize] = useState<typeof SIZES[number]['id']>('75x38')
  const [showRate, setShowRate] = useState(true)
  const [showRack, setShowRack] = useState(true)

  const rows = useMemo(() => P.map((p, i) => {
    const bin = BINS.find(b => b.code === p.code && b.nos > 0)
    return { ...p, barcode: barcodeFor(i), rack: bin?.id ?? p.rack ?? '—' }
  }).filter(r => q === '' || `${r.code} ${r.name} ${r.barcode} ${r.brand}`.toLowerCase().includes(q.toLowerCase())),
  [q])

  const spec = SIZES.find(s => s.id === size)!

  const exportCsv = () => csvDownload('vsa-barcodes.csv', [
    ['Barcode register', COMPANY.name],
    [], ['Barcode', 'VSA Code', 'Billing Name', 'Brand', 'Rack', 'Rate', 'Unit', 'Symbology'],
    ...rows.map(r => [r.barcode, r.code, r.name, r.brand, r.rack, r.ratePerKg, r.unit, 'Code 128']),
  ])

  return (
    <div>
      <PageHead title="Barcodes & Labels" sub="One code per sellable variant, and the sticker that goes on the rack">
        <SearchBox value={q} onChange={setQ} placeholder="Search code, name, barcode…" />
        <Select value={size} onChange={v => setSize(v as typeof size)} options={SIZES.map(s => s.id)} />
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Codes Issued" value={String(P.length)} icon={ScanBarcode} tone="brand"
          sub={`${barcodeFor(0)} onward`} />
        <Stat label="Room Left" value={(9999 - P.length).toLocaleString('en-IN')} icon={Layers} tone="violet"
          sub="Before the range needs extending" />
        <Stat label="Symbology" value="Code 128" icon={Tag} tone="sky" sub="Every scanner reads it" />
        <Stat label="Sticker" value={`${spec.w} × ${spec.h} mm`} icon={Printer} tone="green" sub={spec.label.split('—')[1]} />
      </div>

      {/* ── The recommendation the client asked for ───────────────────── */}
      <div className="card mb-5">
        <p className="section-title text-base mb-1">What I Would Do, and Why</p>
        <p className="section-sub mb-4 max-w-4xl">
          You asked for a recommendation on the numbering and the symbology. Here it is, with the reasoning,
          so you can disagree with it before three thousand stickers are printed.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Rec t="Code 128, not EAN-13"
            d="EAN-13 needs a paid GS1 membership and only matters if your barcode has to scan in somebody else's shop. Code 128 is free, takes any length, packs more into the same width, and every scanner sold in India reads it." />
          <Rec t="A flat running number"
            d="Not 2-digit-category plus 4-digit-item. The moment an item moves category, every sticker already on the rack is wrong and the stock has to be relabelled. The meaning belongs in the item master, where changing it costs nothing." />
          <Rec t="One code per sellable variant"
            d="Not per product. If a screw sells as a box of 100 and a box of 200, those are two codes — otherwise the scan cannot tell the till what left the shelf. Same for a 3′ and a 4′ cut of the same section." />
        </div>
        <div className="rounded-lg p-3 mt-3 flex items-start gap-2.5"
          style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
          <CircleAlert size={15} className="mt-0.5 shrink-0 text-brand" />
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
            Your suggested range of 200000001 onward is a good choice and I have used it. The leading 2 keeps
            our codes clear of any EAN already printed on a supplier's carton, so a scan can never be
            mistaken for one of ours. At 1,500 items in use there is room for another {(9999 - P.length).toLocaleString('en-IN')} before
            the range has to be extended.
          </p>
        </div>
      </div>

      {/* ── The sticker ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto,1fr] gap-4 mb-5">
        <div className="card">
          <p className="section-title text-base mb-1">The Sticker</p>
          <p className="section-sub mb-3">Drawn at {spec.w} × {spec.h} mm — what actually goes on the rack</p>
          <div className="flex justify-center">
            {rows[0] && <Label item={rows[0]} spec={spec} showRate={showRate} showRack={showRack} />}
          </div>
          <div className="flex flex-wrap gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-2)' }}>
            <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-2)' }}>
              <input type="checkbox" className="accent-[var(--brand)]" checked={showRate}
                onChange={() => setShowRate(v => !v)} /> Selling rate
            </label>
            <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-2)' }}>
              <input type="checkbox" className="accent-[var(--brand)]" checked={showRack}
                onChange={() => setShowRack(v => !v)} /> Rack location
            </label>
          </div>
          <p className="text-[11px] mt-3" style={{ color: 'var(--text-4)' }}>
            Rate on a rack sticker means re-printing whenever the rate moves. Most shops leave it off the rack
            label and keep it on the shelf-edge card instead.
          </p>
        </div>

        <div className="card">
          <p className="section-title text-base mb-1">A Sheet to Print</p>
          <p className="section-sub mb-3">First twelve, at the size chosen above</p>
          <div className="grid gap-2 overflow-x-auto"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(150, spec.w * 2.1)}px, 1fr))` }}>
            {rows.slice(0, 12).map(r => (
              <Label key={r.code} item={r} spec={spec} showRate={showRate} showRack={showRack} />
            ))}
          </div>
          {rows.length === 0 && <Empty msg="Nothing matches that search" />}
        </div>
      </div>

      <p className="section-title text-base mb-1">Barcode Register</p>
      <p className="section-sub mb-3">One row per sellable variant</p>
      <TableCard maxH="28rem">
        <thead>
          <tr><th>Barcode</th><th>VSA Code</th><th>Billing Name</th><th>Brand</th>
            <th>Rack</th><th className="num">Rate</th><th>Symbology</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.code}>
              <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--brand)' }}>{r.barcode}</td>
              <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{r.code}</td>
              <td className="text-xs max-w-[18rem] truncate">{r.name}</td>
              <td className="text-xs">{r.brand}</td>
              <td className="font-mono text-[11px]">{r.rack}</td>
              <td className="num tabular-nums text-xs">{inr2(r.ratePerKg)}/{r.unit}</td>
              <td><span className="badge-gray">Code 128</span></td>
            </tr>
          ))}
        </tbody>
      </TableCard>
    </div>
  )
}

/* ── One printed label ─────────────────────────────────────────────────── */
function Label({ item, spec, showRate, showRack }: {
  item: { barcode: string; code: string; name: string; brand: string; rack: string; ratePerKg: number; unit: string }
  spec: { w: number; h: number }
  showRate: boolean
  showRack: boolean
}) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current) return
    try {
      JsBarcode(ref.current, item.barcode, {
        format: 'CODE128', displayValue: false, margin: 0,
        width: 1.5, height: spec.h * 0.9, background: 'transparent', lineColor: '#111',
      })
    } catch { /* an unencodable value simply leaves the box blank */ }
  }, [item.barcode, spec.h])

  return (
    <div className="rounded-sm p-1.5 flex flex-col justify-between"
      style={{
        width: `${spec.w * 2.1}px`, minHeight: `${spec.h * 2.1}px`,
        background: '#fff', border: '1px solid #cfd6dd', color: '#111',
      }}>
      <div>
        <p className="font-semibold leading-tight" style={{ fontSize: spec.w > 60 ? 10 : 8.5 }}>{item.name}</p>
        <p className="leading-tight" style={{ fontSize: 7.5, color: '#667' }}>
          {item.code}{item.brand ? ` · ${item.brand}` : ''}
        </p>
      </div>

      <svg ref={ref} style={{ width: '100%', height: `${spec.h * 0.75}px`, display: 'block' }} />

      <div className="flex items-end justify-between gap-1">
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 8, letterSpacing: '.05em' }}>
          {item.barcode}
        </span>
        <span className="text-right leading-tight">
          {showRack && <span style={{ fontSize: 7.5, color: '#667', display: 'block' }}>{item.rack}</span>}
          {showRate && <span style={{ fontSize: 9, fontWeight: 700 }}>₹{item.ratePerKg}/{item.unit}</span>}
        </span>
      </div>
    </div>
  )
}

const Rec = ({ t, d }: { t: string; d: string }) => (
  <div className="rounded-lg p-3.5" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
    <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-1)' }}>{t}</p>
    <p className={cn('text-[11.5px] leading-relaxed')} style={{ color: 'var(--text-3)' }}>{d}</p>
  </div>
)
