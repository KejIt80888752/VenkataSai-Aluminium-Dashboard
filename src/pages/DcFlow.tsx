import { useState, useMemo, Fragment } from 'react'
import {
  Factory, Warehouse, SprayCan, PackageCheck, ArrowRight, Scale, TriangleAlert, Palette,
} from 'lucide-react'
import { PageHead, Stat, Select, ExportBtn, TableCard, Empty } from '@/components/ui'
import { SAMPLE_DC, dcTotals, perPiece } from '@/data/despatch'
import {
  OPENING, LOADED, RECEIVED, colourOf, isHardware, isRubber, weighments,
  type CoatLine,
} from '@/data/coatbook'
import { kg as kgFmt, csvDownload, cn } from '@/lib/utils'

/* ── One page for the whole journey ────────────────────────────────────────
   The shop said the flow was not visible and that the loading sheet sat
   apart from the purchase sheet. They are the same journey, so they belong
   on one screen: bought from the mill, lying raw, sent to the coater, coming
   back in colour, put away.

   PC1 is the coater. On the received sheet it is where the material came
   FROM, not where it went — which is why a coated line showing "PC1" read
   wrongly before.                                                          */

const TABS = ['The journey', 'Bought from the mill', 'Sent to the coater', 'Back in colour'] as const

const COLOUR_DOT: Record<string, string> = {
  'Uncoated': '#9AA5B1', 'Ivory': '#E8DCC0', 'White': '#F2F2F0', 'Black': '#2B2B2B',
  'Coffee Brown': '#5B4034', 'Pista Green Glossy': '#93AE82', 'Matt': '#6E6E6E', 'Not stated': '#C7D0DA',
}

const weighed = (ls: CoatLine[]) => ls.filter(l => !isHardware(l) && !isRubber(l))

/** Pieces covered by a weighment, including the rows that share it. */
function coveredBy(ls: CoatLine[]) {
  let nos = 0, kg = 0, carry = false
  for (const l of ls) {
    if (isHardware(l) || isRubber(l)) { carry = false; continue }
    if (l.kg !== null) { kg += l.kg; nos += l.nos; carry = true }
    else if (carry) nos += l.nos
  }
  return { nos, kg: +kg.toFixed(2) }
}

export default function DcFlow() {
  const [tab, setTab] = useState<typeof TABS[number]>('The journey')
  const [where, setWhere] = useState('All')

  const purchase = dcTotals(SAMPLE_DC)
  const sent = coveredBy(LOADED)
  const back = coveredBy(RECEIVED)
  const gainKg = +(back.kg - sent.kg).toFixed(2)
  const gainPct = sent.kg ? +((gainKg / sent.kg) * 100).toFixed(2) : 0
  const shortPcs = sent.nos - back.nos

  const stages = [
    {
      icon: Factory, tone: 'violet' as const,
      name: 'The mill', sub: SAMPLE_DC.supplier.split('—')[0].trim(),
      doc: `Despatch sheet · ${SAMPLE_DC.date}`,
      lines: [`${purchase.pieces} pieces`, `${purchase.lineKg.toFixed(3)} kg`, `${SAMPLE_DC.lines.length} sections`],
      note: 'Raw aluminium bought in. Weight per piece comes off this sheet.',
    },
    {
      icon: Warehouse, tone: 'sky' as const,
      name: 'Lying raw', sub: 'M1 · S2 · V1',
      doc: 'Opening · 01-09-2026',
      lines: [`${weighed(OPENING).reduce((s, l) => s + l.nos, 0)} pieces`,
              kgFmt(+weighed(OPENING).reduce((s, l) => s + (l.kg ?? 0), 0).toFixed(1)),
              'all W/O — uncoated'],
      note: 'Everything here still carries the W/O prefix. No colour yet.',
    },
    {
      icon: SprayCan, tone: 'brand' as const,
      name: 'At the coater', sub: 'PC1',
      doc: 'Loaded · 16 and 17-09-2026',
      lines: [`${sent.nos} pieces out`, kgFmt(sent.kg), 'three routes in'],
      note: 'Sent uncoated. PC1 is where it goes, not where it is kept.',
    },
    {
      icon: PackageCheck, tone: 'green' as const,
      name: 'Back in colour', sub: 'put away at the godown',
      doc: 'Received · 21-09-2026',
      lines: [`${back.nos} pieces back`, kgFmt(back.kg), `${gainPct > 0 ? '+' : ''}${gainPct}% weight`],
      note: 'Now Ivory, Coffee Brown, Pista Green, Black or White.',
    },
  ]

  /* Which colours a section is carrying, across all three sheets. */
  const colourSplit = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of [...OPENING, ...LOADED, ...RECEIVED]) {
      if (isRubber(l)) continue
      const c = colourOf(l)
      m.set(c, (m.get(c) ?? 0) + l.nos)
    }
    return [...m.entries()].map(([colour, nos]) => ({ colour, nos })).sort((a, b) => b.nos - a.nos)
  }, [])

  const sheet = tab === 'Sent to the coater' ? LOADED : tab === 'Back in colour' ? RECEIVED : []
  const places = useMemo(
    () => ['All', ...new Set(sheet.map(l => l.route ?? l.at ?? '—'))],
    [sheet],
  )
  const rows = sheet.filter(l => where === 'All' || (l.route ?? l.at) === where)

  const exportCsv = () => csvDownload('vsa-material-journey.csv', [
    ['The journey of one load'],
    [], ['Stage', 'Document', 'Pieces', 'Kilograms'],
    ['Bought from the mill', `Despatch ${SAMPLE_DC.date}`, purchase.pieces, purchase.lineKg],
    ['Sent to the coater', 'Loaded 16/17-09', sent.nos, sent.kg],
    ['Back in colour', 'Received 21-09', back.nos, back.kg],
    [], ['Weight put on by coating', gainKg, `${gainPct}%`],
    ['Pieces not yet back', shortPcs],
  ])

  return (
    <div>
      <PageHead title="Material Journey"
        sub="Bought from the mill, lying raw, sent to the coater, back in colour — one screen">
        {(tab === 'Sent to the coater' || tab === 'Back in colour') && (
          <Select value={where} onChange={setWhere} options={places} className="min-w-[12rem]" />
        )}
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Bought In" value={`${purchase.pieces} pcs`} icon={Factory} tone="violet"
          sub={`${purchase.lineKg.toFixed(1)} kg on ${SAMPLE_DC.date}`} />
        <Stat label="Out to the Coater" value={`${sent.nos} pcs`} icon={SprayCan} tone="brand"
          sub={kgFmt(sent.kg) + ' uncoated'} />
        <Stat label="Back in Colour" value={`${back.nos} pcs`} icon={PackageCheck} tone="green"
          sub={kgFmt(back.kg) + ' coated'} />
        <Stat label="Weight Coating Put On" value={`${gainPct > 0 ? '+' : ''}${gainPct}%`} icon={Scale}
          tone={gainPct >= 2 && gainPct <= 5 ? 'green' : 'amber'}
          sub={`${gainKg > 0 ? '+' : ''}${gainKg} kg · normal is 2 to 5%`} />
      </div>

      <div className="flex flex-wrap gap-1 mb-5 p-1 rounded-lg w-fit"
        style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => { setTab(t); setWhere('All') }}
            className={cn('px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors', tab === t && 'bg-brand text-white')}
            style={tab === t ? undefined : { color: 'var(--text-3)' }}>{t}</button>
        ))}
      </div>

      {tab === 'The journey' && (
        <>
          {/* ── The chain ──────────────────────────────────────────── */}
          <div className="card mb-5">
            <p className="section-title text-base mb-1">The Same Load, Four Stages</p>
            <p className="section-sub mb-4 max-w-4xl">
              The purchase sheet and the loading sheet are not two different things — they are the same
              material at two points on one journey. Read left to right.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto,1fr,auto,1fr,auto,1fr] gap-3 items-stretch">
              {stages.map((s, i) => (
                <Fragment key={s.name}>
                  <div className="rounded-lg p-4"
                    style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                    <s.icon size={18} className="mb-2" style={{ color: `var(--${s.tone === 'sky' ? 'brand' : s.tone}, var(--brand))` }} />
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{s.name}</p>
                    <p className="text-[11px] mb-2" style={{ color: 'var(--text-4)' }}>{s.sub}</p>
                    <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-4)' }}>{s.doc}</p>
                    {s.lines.map(l => (
                      <p key={l} className="text-xs tabular-nums" style={{ color: 'var(--text-2)' }}>{l}</p>
                    ))}
                    <p className="text-[10.5px] mt-2 pt-2 leading-relaxed"
                      style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>{s.note}</p>
                  </div>
                  {i < stages.length - 1 && (
                    <div className="hidden lg:flex items-center justify-center">
                      <ArrowRight size={18} style={{ color: 'var(--text-4)' }} />
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          </div>

          {/* ── What the journey cost in weight and pieces ─────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            <div className="card">
              <p className="section-title text-base mb-1 flex items-center gap-2">
                <Scale size={15} className="text-brand" /> What the Coater Added
              </p>
              <p className="section-sub mb-3">
                Powder puts weight on. Comparing what went out against what came back is the only check on
                whether a coating bill is fair.
              </p>
              <div className="space-y-2">
                <Row k="Sent out, uncoated" v={`${sent.nos} pcs · ${kgFmt(sent.kg)}`} />
                <Row k="Came back, coated" v={`${back.nos} pcs · ${kgFmt(back.kg)}`} />
                <Row k="Weight put on" v={`${gainKg > 0 ? '+' : ''}${gainKg} kg (${gainPct > 0 ? '+' : ''}${gainPct}%)`}
                  tone={gainPct >= 2 && gainPct <= 5 ? 'green' : 'amber'} strong />
              </div>
              <p className="text-[11.5px] mt-3 pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
                {gainPct >= 2 && gainPct <= 5
                  ? `${gainPct}% sits inside the two to five per cent powder normally adds, so this load looks right.`
                  : `${gainPct}% is outside the two to five per cent powder normally adds — worth a word with PC1.`}
              </p>
            </div>

            <div className="card">
              <p className="section-title text-base mb-1 flex items-center gap-2">
                <TriangleAlert size={15} style={{ color: shortPcs > 0 ? 'var(--amber, #f59e0b)' : 'var(--green)' }} />
                Pieces Not Yet Back
              </p>
              <p className="section-sub mb-3">
                Counted across the weighments, so rows sharing a weight are counted properly.
              </p>
              <p className="text-3xl font-bold tabular-nums" style={{ color: shortPcs > 0 ? 'var(--amber, #f59e0b)' : 'var(--green)' }}>
                {shortPcs}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                {sent.nos} went out on the 16th and 17th, {back.nos} came back on the 21st.
              </p>
              <p className="text-[11.5px] mt-3 pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
                These are two separate sheets rather than one job card, so some of this will be material
                still at PC1 and some will be a later lorry. It is shown so the gap is at least visible.
              </p>
            </div>
          </div>

          {/* ── Colour, across the whole journey ───────────────────── */}
          <div className="card">
            <p className="section-title text-base mb-1 flex items-center gap-2">
              <Palette size={15} className="text-brand" /> Where the Colour Enters
            </p>
            <p className="section-sub mb-4 max-w-4xl">
              Everything leaves as W/O. The colour is put on at PC1 and comes back on the material — so a
              piece changes name halfway through the journey without changing code.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {colourSplit.map(c => (
                <div key={c.colour} className="rounded-lg p-3"
                  style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                  <span className="w-4 h-4 rounded-full block mb-2"
                    style={{ background: COLOUR_DOT[c.colour] ?? '#C7D0DA', border: '1px solid var(--border-2)' }} />
                  <p className="text-[11px] leading-tight" style={{ color: 'var(--text-3)' }}>{c.colour}</p>
                  <p className="text-base font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>{c.nos}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'Bought from the mill' && (
        <>
          <div className="card mb-5">
            <p className="section-title text-base mb-1">Despatch Sheet {SAMPLE_DC.date}</p>
            <p className="section-sub">
              {SAMPLE_DC.supplier} · colour code {SAMPLE_DC.ccNo} · {purchase.pieces} pieces ·
              {' '}{purchase.lineKg.toFixed(3)} kg
            </p>
          </div>
          <TableCard maxH="30rem">
            <thead>
              <tr><th className="num">Sl</th><th>Particulars</th><th className="num">Weight Range</th>
                <th className="num">Net Weight</th><th className="num">Length</th><th className="num">Pieces</th>
                <th className="num">Kg / Piece</th></tr>
            </thead>
            <tbody>
              {SAMPLE_DC.lines.map(l => (
                <tr key={l.slNo}>
                  <td className="num tabular-nums text-xs" style={{ color: 'var(--text-4)' }}>{l.slNo}</td>
                  <td className="font-mono text-xs" style={{ color: 'var(--text-1)' }}>{l.particulars}</td>
                  <td className="num tabular-nums text-xs">{l.weightRange ?? '—'}</td>
                  <td className="num tabular-nums">{l.netWeightKg}</td>
                  <td className="num tabular-nums text-xs">{l.lengthFt}</td>
                  <td className="num tabular-nums">{l.pieces}</td>
                  <td className="num tabular-nums font-semibold" style={{ color: 'var(--brand)' }}>{perPiece(l)}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        </>
      )}

      {(tab === 'Sent to the coater' || tab === 'Back in colour') && (
        <>
          <div className="card mb-5">
            <p className="section-title text-base mb-1">
              {tab === 'Sent to the coater' ? 'Loaded to PC1 · 16 and 17-09-2026' : 'Received from PC1 · 21-09-2026'}
            </p>
            <p className="section-sub max-w-4xl">
              {tab === 'Sent to the coater'
                ? 'Everything on this sheet is W/O — uncoated. The route column says where it came from; all three end at PC1, the coater.'
                : 'This material came FROM PC1, where the colour was put on. The last column is where it was put away afterwards — PC1 Coats and Godown Basement are storage places, not the coater itself.'}
            </p>
          </div>

          <TableCard maxH="32rem">
            <thead>
              <tr><th>Code</th><th>Product Name</th><th className="num">Qty (nos)</th><th className="num">Weight (kgs)</th>
                <th className="num">Kg / Piece</th><th>Colour</th>
                <th>{tab === 'Sent to the coater' ? 'Came from' : 'Put away at'}</th></tr>
            </thead>
            <tbody>
              {rows.map((l, i) => {
                const colour = colourOf(l)
                const per = l.kg && l.nos ? +(l.kg / l.nos).toFixed(3) : null
                return (
                  <tr key={i}>
                    <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{l.code ?? '—'}</td>
                    <td className="text-xs max-w-[17rem] truncate" title={l.name}>{l.name}</td>
                    <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{l.nos}</td>
                    <td className="num tabular-nums text-xs">
                      {l.kg !== null ? l.kg
                        : isHardware(l) ? '—'
                        : isRubber(l) ? l.unit
                        : <span style={{ color: 'var(--text-4)' }}>weighed above</span>}
                    </td>
                    <td className="num tabular-nums text-xs" style={{ color: 'var(--text-4)' }}>{per ?? '—'}</td>
                    <td>
                      <span className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: COLOUR_DOT[colour] ?? '#C7D0DA', border: '1px solid var(--border-2)' }} />
                        {colour}
                      </span>
                    </td>
                    <td className="text-xs whitespace-nowrap" style={{ color: 'var(--text-3)' }}>
                      {tab === 'Sent to the coater' ? (l.route ?? '—').replace(' TO PC1', '') : (l.at ?? '—')}
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && <tr><td colSpan={7}><Empty msg="Nothing on this sheet" /></td></tr>}
            </tbody>
          </TableCard>

          {tab === 'Back in colour' && (
            <p className="text-[11.5px] mt-3 max-w-4xl" style={{ color: 'var(--text-4)' }}>
              Where a weight says “weighed above”, that row went on the scale together with the one before
              it. {weighments(RECEIVED).filter(w => w.lines.length > 1).length} weighments on this sheet
              cover more than one line.
            </p>
          )}
        </>
      )}
    </div>
  )
}

const Row = ({ k, v, tone, strong }: { k: string; v: string; tone?: string; strong?: boolean }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-xs" style={{ color: 'var(--text-3)' }}>{k}</span>
    <span className={cn('tabular-nums shrink-0', strong ? 'text-sm font-bold' : 'text-xs font-medium')}
      style={{ color: tone === 'green' ? 'var(--green)' : tone === 'amber' ? 'var(--amber, #f59e0b)' : 'var(--text-1)' }}>
      {v}
    </span>
  </div>
)
