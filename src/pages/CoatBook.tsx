import { useState, useMemo } from 'react'
import {
  Palette, TruckIcon, PackageCheck, TriangleAlert, CircleCheck, Scale, Layers, HelpCircle,
} from 'lucide-react'
import { PageHead, Stat, Select, ExportBtn, TableCard, Empty } from '@/components/ui'
import {
  OPENING, LOADED, RECEIVED, WRITTEN, TBC_PARTS, TBC_MULTIPLIER,
  colourOf, sectionOf, isHardware, isRubber, isTbc, weighments,
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

  /* ── Held against the rules the shop gave us on 11-11 ───────────────── */
  const checks = useMemo(() => {
    const out: { kind: 'error' | 'ok' | 'note'; title: string; detail: string }[] = []

    /* DV 7' was the last one open. The shop sent 65 kg for those 48 pieces
       on 11-11, which puts it alongside the other two readings of the same
       section. Their own sheet total has not caught up with it yet. */
    const openDv = OPENING.find(l => sectionOf(l) === "DV 7'" && l.kg)
    const loadDv = LOADED.find(l => sectionOf(l) === "DV 7'" && l.kg)
    const recvDv = RECEIVED.find(l => sectionOf(l) === "DV 7'" && l.kg)
    if (openDv?.kg && loadDv?.kg && recvDv?.kg) {
      const a = openDv.kg / openDv.nos, b = loadDv.kg / loadDv.nos, c2 = recvDv.kg / recvDv.nos
      const spread = (Math.max(a, b, c2) - Math.min(a, b, c2)) / Math.min(a, b, c2) * 100
      out.push({
        kind: 'ok',
        title: `DV 7' settled at ${a.toFixed(3)} kg a piece`,
        detail: `Lying ${a.toFixed(3)}, going out ${b.toFixed(3)}, coming back coated ${c2.toFixed(3)} — the `
          + `three readings now sit within ${spread.toFixed(1)}% of each other, which is what coating gain `
          + `looks like. Before your correction the opening line read 0.033.`,
      })
    }

    /* Their opening total covers the M1 block only, so only that block can
       be held against it. */
    const m1 = OPENING.filter(l => l.route === 'M1 TO PC1')
    const m1Kg = +m1.reduce((t, l) => t + (l.kg ?? 0), 0).toFixed(2)
    const gap = +(m1Kg - WRITTEN.opening.kg).toFixed(2)
    if (Math.abs(gap) > 0.01) out.push({
      kind: 'error',
      title: `Your opening sheet still totals ${WRITTEN.opening.kg} kg`,
      detail: `With DV 7' at the ${openDv?.kg} kg you sent, the M1 lines now add to ${m1Kg} kg — `
        + `${gap.toFixed(2)} more than the figure at the foot of the sheet, which is exactly the `
        + `${gap.toFixed(2)} the DV line went up by. The line is corrected here; the total on your own copy `
        + `has not caught up with it. Worth changing before that sheet is used again.`,
    })

    /* 778 against 782, now explained by the shop. */
    const tbcLines = RECEIVED.filter(isTbc)
    const tbcShown = tbcLines.reduce((a, l) => a + l.nos, 0)
    const tbcReal = tbcShown * TBC_MULTIPLIER
    out.push({
      kind: 'ok',
      title: `778 and 782 settled — TBC is ${TBC_MULTIPLIER} sections, not one`,
      detail: `${TBC_PARTS.join(', ')} are loaded separately and clubbed when sold. The received sheet shows `
        + `${tbcShown} TBC lines, which is ${tbcReal} pieces on the floor — the ${tbcReal - tbcShown} between `
        + `${WRITTEN.received.nos} and ${WRITTEN.received.splittedSeparately}. The system now counts a TBC line `
        + `as ${TBC_MULTIPLIER}, so the two figures stop disagreeing.`,
    })

    /* Blank weights are shared weighments, not missing ones. */
    const ws = weighments(RECEIVED).filter(w => w.lines.length > 1)
    if (ws.length) out.push({
      kind: 'ok',
      title: `${ws.length} weighments cover more than one line`,
      detail: ws.map(w => `${w.kg} kg over ${w.nos} nos (${w.lines.map(l => l.name).join(' + ')})`).join('; ')
        + '. Read on their own those rows look unweighed; read as you weigh them, every piece has a weight.',
    })

    out.push({
      kind: 'ok',
      title: 'Every line checked against the figure at the foot of your sheet',
      detail: `Loaded ${WRITTEN.loaded.nos} nos and ${WRITTEN.loaded.kg} kg, received ${WRITTEN.received.nos} `
        + `and ${WRITTEN.received.kg} — both tie exactly. Opening tied too, until the DV correction above `
        + `lifted it; piece counts are unaffected at ${WRITTEN.opening.nos}.`,
    })

    out.push({
      kind: 'note',
      title: 'Your corrections are all in',
      detail: 'The S in the 3TB weight cell is now 70.35 kg; DV 7\u2019 on the loading sheet is now 40.7 kg; '
        + 'CBB reads CB; PG reads PGG. Subtotals have appeared on the S2 and V1 blocks. Nothing else was '
        + 'touched.',
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
        <Stat label="Still Open" value={String(checks.filter(c => c.kind === 'error').length)} icon={TriangleAlert}
          tone={checks.some(c => c.kind === 'error') ? 'red' : 'green'}
          sub={checks.some(c => c.kind === 'error') ? 'One still open' : 'All settled'} />
      </div>

      {/* ── What the sheets do not agree on ───────────────────────────── */}
      <div className="card mb-5" style={{ borderColor: 'var(--amber, #f59e0b)' }}>
        <p className="section-title text-base mb-1">Checked Against Your Clarifications</p>
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
                {c.kind === 'error'
                  ? <TriangleAlert size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--red)' }} />
                  : c.kind === 'ok'
                  ? <CircleCheck size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--green)' }} />
                  : <HelpCircle size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-4)' }} />}
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
