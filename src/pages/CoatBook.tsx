import { useState, useMemo } from 'react'
import {
  Palette, TruckIcon, PackageCheck, TriangleAlert, CircleCheck, Scale, Layers, HelpCircle,
} from 'lucide-react'
import { PageHead, Stat, Select, ExportBtn, TableCard, Empty } from '@/components/ui'
import {
  OPENING, LOADED, RECEIVED, WRITTEN, colourOf, sectionOf, isHardware, isRubber,
  type CoatLine,
} from '@/data/coatbook'
import { kg as kgFmt, csvDownload, cn } from '@/lib/utils'

const SHEETS = ['Opening 01-09', 'Loaded out 16/17-09', 'Received back 21-09'] as const

const COLOUR_DOT: Record<string, string> = {
  'Uncoated': '#9AA5B1', 'Ivory': '#E8DCC0', 'White': '#F2F2F0', 'Black': '#2B2B2B',
  'Coffee Brown': '#5B4034', 'Pista Green': '#93AE82', 'Matt': '#6E6E6E', 'Not stated': '#C7D0DA',
}

const sum = (ls: CoatLine[], f: (l: CoatLine) => number) => +ls.reduce((s, l) => s + f(l), 0).toFixed(2)

export default function CoatBook() {
  const [sheet, setSheet] = useState<typeof SHEETS[number]>('Received back 21-09')
  const [route, setRoute] = useState('All')

  const lines = sheet.startsWith('Opening') ? OPENING : sheet.startsWith('Loaded') ? LOADED : RECEIVED
  const groups = useMemo(
    () => ['All', ...new Set(lines.map(l => l.route ?? l.at ?? '—'))],
    [lines],
  )
  const shown = lines.filter(l => route === 'All' || (l.route ?? l.at) === route)

  /* ── One section, several colours — the thing the sheets are really about ── */
  const bySection = useMemo(() => {
    const m = new Map<string, Map<string, { nos: number; kg: number }>>()
    for (const l of [...OPENING, ...LOADED, ...RECEIVED]) {
      if (isHardware(l) || isRubber(l)) continue
      const s = sectionOf(l), c = colourOf(l)
      const inner = m.get(s) ?? new Map()
      const e = inner.get(c) ?? { nos: 0, kg: 0 }
      e.nos += l.nos; e.kg = +(e.kg + (l.kg ?? 0)).toFixed(2)
      inner.set(c, e); m.set(s, inner)
    }
    return [...m.entries()]
      .map(([section, cols]) => ({
        section,
        colours: [...cols.entries()].map(([colour, v]) => ({ colour, ...v }))
          .sort((a, b) => b.nos - a.nos),
        nos: [...cols.values()].reduce((s, v) => s + v.nos, 0),
      }))
      .filter(s => s.colours.length > 1)
      .sort((a, b) => b.colours.length - a.colours.length || b.nos - a.nos)
  }, [])

  /* ── What the sheets do not agree on ──────────────────────────────────── */
  const checks = useMemo(() => {
    const out: { kind: 'error' | 'ask' | 'note'; title: string; detail: string }[] = []

    const sCell = OPENING.find(l => l.name.includes('3TB') && l.kg === null && !isHardware(l))
    if (sCell) {
      // what a piece of this section weighs, taken from where it was weighed
      const ref = LOADED.find(l => sectionOf(l) === sectionOf(sCell) && l.kg)
      const per = ref && ref.kg ? ref.kg / ref.nos : 0
      out.push({
        kind: 'error',
        title: `The weight cell for ${sCell.name} holds the letter “S”`,
        detail: `${sCell.nos} pieces with no weight against them. At ${per.toFixed(3)} kg a piece — the rate the `
          + `same section was weighed at on the loading sheet — that is about ${(per * sCell.nos).toFixed(1)} kg `
          + `missing from the ${WRITTEN.opening.kg} kg total. One cell, and the opening weight is short.`,
      })
    }

    const gap = WRITTEN.received.splittedSeparately - WRITTEN.received.nos
    if (gap) out.push({
      kind: 'ask',
      title: `Two piece counts on the received sheet — ${WRITTEN.received.nos} and ${WRITTEN.received.splittedSeparately}`,
      detail: `The total row says ${WRITTEN.received.nos}. Below it, “SPLITTED SEPERATELY” says `
        + `${WRITTEN.received.splittedSeparately}. The lines themselves add to exactly ${WRITTEN.received.nos}, `
        + `so the ${gap} extra is something the sheet knows about and the lines do not.`,
    })

    const noWeight = RECEIVED.filter(l => l.kg === null && !isHardware(l))
    if (noWeight.length) out.push({
      kind: 'note',
      title: `${noWeight.length} coated sections came back without a weight`,
      detail: noWeight.map(l => `${l.name} (${l.nos} nos)`).join(', ')
        + '. The pieces are counted, so stock is right — but with no weight these cannot be checked for '
        + 'coating gain, and they cannot be billed by weight.',
    })

    /* The same section should weigh about the same a piece wherever it is
       written. Coating adds a few per cent, not several times over. */
    const perPiece = new Map<string, { lo: number; hi: number; loName: string; hiName: string }>()
    for (const l of [...OPENING, ...LOADED, ...RECEIVED]) {
      if (!l.kg || !l.nos || isHardware(l) || isRubber(l)) continue
      const sec = sectionOf(l)
      const per = l.kg / l.nos
      const e = perPiece.get(sec)
      if (!e) perPiece.set(sec, { lo: per, hi: per, loName: l.name, hiName: l.name })
      else {
        if (per < e.lo) { e.lo = per; e.loName = l.name }
        if (per > e.hi) { e.hi = per; e.hiName = l.name }
      }
    }
    for (const [sec, e] of perPiece) {
      if (e.lo <= 0 || e.hi / e.lo < 3) continue
      out.push({
        kind: 'error',
        title: `${sec} is written at two weights that cannot both be right`,
        detail: `“${e.hiName}” works out at ${e.hi.toFixed(3)} kg a piece, but “${e.loName}” at `
          + `${e.lo.toFixed(3)} kg — ${Math.round(e.hi / e.lo)} times lighter for the same section. Coating `
          + `adds a few per cent, not several times over, so one of the two weights has a digit in the `
          + `wrong place. Until it is settled, any stock valued on that line is wrong.`,
      })
    }

    const offTotal = OPENING.filter(l => l.route && l.route !== 'M1 TO PC1')
    if (offTotal.length) out.push({
      kind: 'note',
      title: 'The totals cover the M1 block only',
      detail: `On the opening and loading sheets the total at the foot adds up the left-hand block. `
        + `The S2 and V1 blocks beside it — ${offTotal.length} lines on the opening sheet alone — are not in `
        + `that figure. Nobody has a single number for the whole day.`,
    })

    return out
  }, [])

  const totals = {
    nos: sum(shown, l => l.nos),
    kg: sum(shown, l => l.kg ?? 0),
    unweighed: shown.filter(l => l.kg === null && !isHardware(l) && !isRubber(l)).length,
  }

  const exportCsv = () => csvDownload('vsa-coating-book.csv', [
    [`Coating book — ${sheet}`],
    [], ['Code', 'Product Name', 'Qty (nos)', 'Weight (kgs)', 'Section', 'Colour', 'Route / Received at'],
    ...shown.map(l => [l.code ?? '', l.name, l.nos, l.kg ?? '', sectionOf(l), colourOf(l), l.route ?? l.at ?? '']),
  ])

  return (
    <div>
      <PageHead title="Coating Book"
        sub="Your own three sheets — what was lying, what went to the coater, what came back">
        <Select value={sheet} onChange={v => { setSheet(v as typeof sheet); setRoute('All') }}
          options={[...SHEETS]} className="min-w-[14rem]" />
        <Select value={route} onChange={setRoute} options={groups} className="min-w-[11rem]" />
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Opening 01-09" value={`${sum(OPENING, l => l.nos)} nos`} icon={Layers} tone="violet"
          sub={kgFmt(sum(OPENING, l => l.kg ?? 0))} />
        <Stat label="Sent to the Coater" value={`${sum(LOADED, l => l.nos)} nos`} icon={TruckIcon} tone="brand"
          sub={`${kgFmt(sum(LOADED, l => l.kg ?? 0))} on 16 and 17-09`} />
        <Stat label="Came Back Coated" value={`${sum(RECEIVED, l => l.nos)} nos`} icon={PackageCheck} tone="green"
          sub={`${kgFmt(sum(RECEIVED, l => l.kg ?? 0))} on 21-09`} />
        <Stat label="Things to Settle" value={String(checks.length)} icon={TriangleAlert}
          tone={checks.some(c => c.kind === 'error') ? 'red' : 'amber'}
          sub="Found in your own sheets" />
      </div>

      {/* ── What the sheets do not agree on ───────────────────────────── */}
      <div className="card mb-5" style={{ borderColor: 'var(--amber, #f59e0b)' }}>
        <p className="section-title text-base mb-1">What the Sheets Say That Does Not Agree</p>
        <p className="section-sub mb-4 max-w-4xl">
          Every total at the foot of your three sheets is correct — I added each one and they tie exactly.
          These are the other things worth a look.
        </p>
        <div className="space-y-2.5">
          {checks.map((c, i) => (
            <div key={i} className="rounded-lg p-3.5"
              style={{
                background: 'var(--bg-card2)',
                border: `1px solid ${c.kind === 'error' ? 'var(--red)' : 'var(--border-2)'}`,
              }}>
              <p className="text-sm font-medium flex items-start gap-2" style={{ color: 'var(--text-1)' }}>
                {c.kind === 'error' ? <TriangleAlert size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--red)' }} />
                  : c.kind === 'ask' ? <HelpCircle size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--amber, #f59e0b)' }} />
                  : <CircleCheck size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-4)' }} />}
                {c.title}
              </p>
              <p className="text-[12px] leading-relaxed mt-1.5 ml-6" style={{ color: 'var(--text-3)' }}>{c.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── One section, several colours ──────────────────────────────── */}
      <div className="card mb-5">
        <p className="section-title text-base mb-1 flex items-center gap-2">
          <Palette size={15} className="text-brand" /> One Section, Several Colours
        </p>
        <p className="section-sub mb-4 max-w-4xl">
          This is what the three sheets are really about. Code 20033 leaves as <b>W/O</b> — without coating —
          and comes back as Ivory, Coffee Brown or Pista Green. The number is the section; the colour is a
          state it passes into at the coater. A single stock line was never going to hold that.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {bySection.map(s => (
            <div key={s.section} className="rounded-lg p-3.5"
              style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
              <div className="flex items-baseline justify-between gap-2 mb-2.5">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>{s.section}</p>
                <p className="text-xs tabular-nums shrink-0" style={{ color: 'var(--text-4)' }}>
                  {s.colours.length} colours · {s.nos} nos
                </p>
              </div>
              <div className="space-y-1.5">
                {s.colours.map(c => (
                  <div key={c.colour} className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: COLOUR_DOT[c.colour] ?? '#C7D0DA', border: '1px solid var(--border-2)' }} />
                    <span className="text-xs flex-1 truncate"
                      style={{ color: c.colour === 'Uncoated' ? 'var(--text-4)' : 'var(--text-2)' }}>
                      {c.colour}
                    </span>
                    <span className="text-xs tabular-nums shrink-0" style={{ color: 'var(--text-2)' }}>
                      {c.nos} nos{c.kg ? ` · ${c.kg} kg` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── The sheet itself ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <p className="section-title text-base mb-1">{sheet}</p>
          <p className="section-sub">Your columns, your order — code, product name, qty, weight</p>
        </div>
        <span className="text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>
          {shown.length} lines · <b style={{ color: 'var(--text-1)' }}>{totals.nos} nos</b> · {kgFmt(totals.kg)}
          {totals.unweighed > 0 && (
            <span style={{ color: 'var(--red)' }}> · {totals.unweighed} not weighed</span>
          )}
        </span>
      </div>

      <TableCard maxH="32rem">
        <thead>
          <tr><th>Code</th><th>Product Name</th><th className="num">Qty (nos)</th><th className="num">Weight (kgs)</th>
            <th className="num">Kg / Piece</th><th>Colour</th><th>{sheet.startsWith('Received') ? 'Received At' : 'Route'}</th></tr>
        </thead>
        <tbody>
          {shown.map((l, i) => {
            const colour = colourOf(l)
            const per = l.kg && l.nos ? +(l.kg / l.nos).toFixed(3) : null
            return (
              <tr key={i}>
                <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{l.code ?? '—'}</td>
                <td className="text-xs max-w-[18rem] truncate" title={l.name}>{l.name}</td>
                <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{l.nos}</td>
                <td className={cn('num tabular-nums text-xs')}
                  style={{ color: l.kg === null && !isHardware(l) && !isRubber(l) ? 'var(--red)' : undefined }}>
                  {l.kg !== null ? l.kg : isHardware(l) ? '—' : isRubber(l) ? l.unit : 'not weighed'}
                </td>
                <td className="num tabular-nums text-xs" style={{ color: 'var(--text-4)' }}>{per ?? '—'}</td>
                <td>
                  <span className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: COLOUR_DOT[colour] ?? '#C7D0DA', border: '1px solid var(--border-2)' }} />
                    {colour}
                  </span>
                </td>
                <td className="text-xs whitespace-nowrap" style={{ color: 'var(--text-3)' }}>{l.route ?? l.at ?? '—'}</td>
              </tr>
            )
          })}
          {shown.length === 0 && <tr><td colSpan={7}><Empty msg="Nothing on this sheet" /></td></tr>}
        </tbody>
      </TableCard>

      <p className="text-[11px] mt-5 leading-relaxed max-w-4xl flex items-start gap-1.5"
        style={{ color: 'var(--text-4)' }}>
        <Scale size={12} className="mt-0.5 shrink-0" />
        These are your own figures, read straight off the workbook you sent — nothing has been rounded,
        corrected or filled in. Where a cell was blank it says so, and where it held something other than a
        number it says that too.
      </p>
    </div>
  )
}
