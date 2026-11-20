import { useMemo } from 'react'
import {
  Scale, Boxes, Clock, ArrowLeftRight, SprayCan, PackageCheck, Layers, FileText,
  Palette, TriangleAlert, Info,
} from 'lucide-react'
import { PageHead, Stat, ExportBtn, TableCard } from '@/components/ui'
import { OPENING, LOADED, RECEIVED, isHardware, isRubber, colourOf } from '@/data/coatbook'
import { reconcile, reconTotals } from '@/data/coatrecon'
import { MASTER } from '@/data/productmaster'
import { SAMPLE_DC } from '@/data/despatch'
import { kg as kgFmt, csvDownload } from '@/lib/utils'
import { FY } from '@/data/company'

/* ── One place for the figures ─────────────────────────────────────────────
   Asked for on 20-11-2026:

     "Can we have the stats completely at a different place rather than
      keeping it at the same place? Let us create one place for this stats.
      Whichever you want, you can click there and you can check. Because
      everywhere, every time, it is becoming clumsy."

   So the working screens are for working on and this is for looking at.

   Everything here comes off their own four sheets. Where a figure needs a
   price it is absent and says so, because selling prices have not been given
   to us yet — an invented rupee figure on a page like this is worse than a
   blank one, since nobody can tell which is which.                        */

const sum = (ls: { nos: number; kg: number | null }[], f: 'nos' | 'kg') =>
  +ls.reduce((s, l) => s + (f === 'nos' ? l.nos : (l.kg ?? 0)), 0).toFixed(2)

export default function Stats() {
  const recon = useMemo(() => reconcile(), [])
  const rt = useMemo(() => reconTotals(recon), [recon])

  const openNos = sum(OPENING, 'nos'), openKg = sum(OPENING, 'kg')
  const gainKg = +(rt.recvKg - rt.sentKg).toFixed(2)

  /* What is on the floor in each colour, across every sheet. */
  const byColour = useMemo(() => {
    const m = new Map<string, { nos: number; kg: number }>()
    for (const l of RECEIVED) {
      if (isRubber(l)) continue
      const c = colourOf(l)
      const e = m.get(c) ?? { nos: 0, kg: 0 }
      e.nos += l.nos; e.kg = +(e.kg + (l.kg ?? 0)).toFixed(2)
      m.set(c, e)
    }
    return [...m.entries()].map(([colour, v]) => ({ colour, ...v })).sort((a, b) => b.nos - a.nos)
  }, [])

  const sections = MASTER.filter(p => p.kind === 'section')
  const hardware = MASTER.filter(p => p.kind !== 'section')
  const weighed = sections.filter(p => p.kgPerPiece !== null)

  const exportCsv = () => csvDownload('vsa-stats.csv', [
    ['Figures at a glance', FY],
    [], ['Stage', 'Pieces', 'Kilograms'],
    ['Lying on 01-09', openNos, openKg],
    ['Sent to the coater 16/17-09', rt.sentNos, rt.sentKg],
    ['Came back coated 21-09', rt.recvNos, rt.recvKg],
    ['Still at the coater', rt.pendingNos, ''],
    ['Weight the coating put on', '', gainKg],
    [], ['Product master'],
    ['Sections', sections.length], ['Hardware and rubber', hardware.length],
    ['Sections with a weight per piece', weighed.length],
    [], ['Received, by colour'], ['Colour', 'Pieces', 'Kilograms'],
    ...byColour.map(c => [c.colour, c.nos, c.kg]),
  ])

  return (
    <div>
      <PageHead title="Figures at a Glance"
        sub={`Everything the working screens used to carry, in one place · ${FY}`}>
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="rounded-lg p-3 mb-5 flex items-start gap-2 text-[12px]"
        style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)', color: 'var(--text-3)' }}>
        <Info size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} />
        <span>
          Every figure on this page is read off your own four sheets — the February despatch sheet and the
          three coating sheets. Nothing here is estimated. Where a figure would need a selling price it is
          left out rather than guessed, because the product list with prices has not reached us yet.
        </span>
      </div>

      {/* ── The journey ──────────────────────────────────────────────── */}
      <p className="section-title text-base mb-3 flex items-center gap-2">
        <ArrowLeftRight size={15} className="text-brand" /> The Material, Stage by Stage
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Stat label="Lying on 01-09" value={`${openNos} nos`} icon={Layers} tone="violet"
          sub={kgFmt(openKg)} />
        <Stat label="Sent to the Coater" value={`${rt.sentNos} nos`} icon={SprayCan} tone="brand"
          sub={`${kgFmt(rt.sentKg)} on 16 and 17-09`} />
        <Stat label="Came Back Coated" value={`${rt.recvNos} nos`} icon={PackageCheck} tone="green"
          sub={`${kgFmt(rt.recvKg)} on 21-09`} />
        <Stat label="Still at the Coater" value={`${rt.pendingNos} nos`} icon={Clock}
          tone={rt.pendingNos ? 'red' : 'green'}
          sub={rt.pendingNos ? `across ${rt.pendingLines} products` : 'everything is back'} />
      </div>

      {/* ── What the coating did ─────────────────────────────────────── */}
      <p className="section-title text-base mb-3 flex items-center gap-2">
        <Scale size={15} className="text-brand" /> What the Coating Did to the Weight
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Stat label="Weight Put On" value={`${gainKg > 0 ? '+' : ''}${gainKg} kg`} icon={Scale}
          tone={rt.kgPct !== null && rt.kgPct >= 2 && rt.kgPct <= 5 ? 'green' : 'amber'}
          sub={`${rt.kgPct !== null && rt.kgPct > 0 ? '+' : ''}${rt.kgPct}% — two to five is normal`} />
        <Stat label="Pieces Out and Back" value={`${rt.nosPct}%`} icon={Boxes}
          tone={rt.pendingNos ? 'amber' : 'green'}
          sub={`${rt.recvNos - rt.sentNos} nos difference`} />
        <Stat label="Colours Coming Back" value={String(byColour.filter(c => c.colour !== 'Uncoated').length)}
          icon={Palette} tone="violet" sub={byColour.slice(0, 3).map(c => c.colour).join(', ')} />
        <Stat label="February Despatch" value={`${SAMPLE_DC.lines.reduce((s, l) => s + l.pieces, 0)} nos`}
          icon={TriangleAlert} tone="amber"
          sub={`${SAMPLE_DC.lines.reduce((s, l) => s + l.netWeightKg, 0).toFixed(3)} kg on the lines, `
            + `${SAMPLE_DC.writtenTotalKg} at the foot`} />
      </div>

      {/* ── The product master ───────────────────────────────────────── */}
      <p className="section-title text-base mb-3 flex items-center gap-2">
        <FileText size={15} className="text-brand" /> The Product Master
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Stat label="Sections" value={String(sections.length)} icon={Layers} tone="brand"
          sub="built from the codes on your sheets" />
        <Stat label="Hardware and Rubber" value={String(hardware.length)} icon={Boxes} tone="violet"
          sub="counted, never weighed" />
        <Stat label="With a Weight per Piece" value={`${weighed.length} of ${sections.length}`} icon={Scale}
          tone={weighed.length === sections.length ? 'green' : 'amber'}
          sub="worked out from your own weighments" />
        <Stat label="With a Selling Price" value={`0 of ${MASTER.length}`} icon={TriangleAlert} tone="red"
          sub="waiting on your product list" />
      </div>

      {/* ── Colour ───────────────────────────────────────────────────── */}
      <div className="card">
        <p className="section-title text-base mb-1 flex items-center gap-2">
          <Palette size={15} className="text-brand" /> What Came Back, by Colour
        </p>
        <p className="section-sub mb-4">
          The 21-09 sheet split by shade. Hardware is in the piece count and outside the kilos, because it
          never goes on the scale.
        </p>
        <TableCard maxH="20rem">
          <thead>
            <tr><th>Colour</th><th className="num">Pieces</th><th className="num">Kilograms</th>
              <th className="num">Share of the load</th></tr>
          </thead>
          <tbody>
            {byColour.map(c => (
              <tr key={c.colour}>
                <td className="text-xs" style={{ color: 'var(--text-1)' }}>{c.colour}</td>
                <td className="num tabular-nums">{c.nos}</td>
                <td className="num tabular-nums text-xs">{c.kg || '—'}</td>
                <td className="num tabular-nums text-xs" style={{ color: 'var(--text-4)' }}>
                  {rt.recvNos ? `${((c.nos / rt.recvNos) * 100).toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      </div>

      <p className="text-[11.5px] mt-5 max-w-4xl" style={{ color: 'var(--text-4)' }}>
        The working screens — Purchase DC, Coating Book, Material Journey — keep only the one or two figures
        needed to do the job on them. Everything else that used to crowd those pages is here.
        {' '}{sum(LOADED.filter(l => isHardware(l) || isRubber(l)), 'nos')} of the pieces that went to the
        coater were hardware and rubber, which is why a kilogram total and a piece total never agree.
      </p>
    </div>
  )
}
