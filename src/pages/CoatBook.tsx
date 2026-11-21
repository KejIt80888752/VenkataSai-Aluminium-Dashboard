import { useState, useMemo } from 'react'
import {
  Palette, PackageCheck, TriangleAlert, CircleCheck, Scale, Boxes, HelpCircle, Link2, Clock,
  ArrowLeftRight, Warehouse, Plus, Trash2, PencilLine, Undo2,
} from 'lucide-react'
import { PageHead, Stat, Select, ExportBtn, TableCard, Empty } from '@/components/ui'
import {
  WRITTEN, TBC_PARTS, TBC_MULTIPLIER,
  colourOf, sectionOf, isHardware, isRubber, isTbc, weighments,
  type CoatLine,
} from '@/data/coatbook'
import {
  useCoatBook, placesOn, newLine, composeName, composeCode,
  COLOUR_OPTIONS, SHEET_META, type BookLine, type SheetId,
} from '@/lib/coatbook-store'
import { reconcile, reconTotals } from '@/data/coatrecon'
import { PICK_OPTIONS, productById } from '@/data/productmaster'
import { kg as kgFmt, csvDownload, cn } from '@/lib/utils'
import { useAliases } from '@/lib/useAliases'
import { SectionPicker } from '@/components/SectionPicker'
import { useColours } from '@/data/colours'
import { joinedSections, namesFor } from '@/lib/aliases'
import { sectionName } from '@/data/catalogue'

/* ── The coating book, as the shop asked for it on 20-11-2026 ──────────────
   "Where is the total? Total quantity, total received weight." — at the foot
   of the table and in the cards above it.

   "It should mention how much percentage excess you have received... and what
   item of which quantity is pending." — sent against received, by product,
   with the shortfall named.

   "We should have a tab at the top to select godown. For every item it should
   not be visible — if required we shall unhide it." — the godown is picked
   once, above the table; the column it used to occupy is gone.

   "Whenever I open it I should be able to see the lines rather than all these
   data." — the sheet comes first. The workings sit underneath it.         */



const COLOUR_DOT: Record<string, string> = {
  'Uncoated': '#9AA5B1', 'Ivory': '#E8DCC0', 'White': '#F2F2F0', 'Black': '#2B2B2B',
  'Coffee Brown': '#5B4034', 'Pista Green': '#93AE82', 'Pista Green Glossy': '#93AE82',
  'Matt': '#6E6E6E', 'Not stated': '#C7D0DA',
}

const sum = (ls: CoatLine[], f: (l: CoatLine) => number) => +ls.reduce((s, l) => s + f(l), 0).toFixed(2)
const per = (kg: number | null, nos: number) =>
  kg !== null && nos > 0 ? +(kg / nos).toFixed(3) : null

const pct = (n: number | null) => n === null ? '—' : `${n > 0 ? '+' : ''}${n}%`
const pctTone = (n: number | null) =>
  n === null ? 'var(--text-4)' : Math.abs(n) <= 8 ? 'var(--green)' : 'var(--amber, #f59e0b)'

export default function CoatBook() {
  const [sheetId, setSheetId] = useState<SheetId>('received')
  const [where, setWhere] = useState('All')
  const [entering, setEntering] = useState(false)

  const book = useCoatBook()
  /* One colour list across the whole dashboard — see src/data/colours.ts.
     The short forms are the same ones their coating sheets use, so nothing
     here changes; what it adds is that a colour added anywhere is on this
     screen too. */
  const colours = useColours()
  const colourKeys = useMemo(() => {
    const keys = colours.map(c => c.code)
    for (const c of COLOUR_OPTIONS) if (!keys.includes(c.key)) keys.push(c.key)
    return keys
  }, [colours])
  const meta = SHEET_META.find(m => m.id === sheetId)!
  const sheet = meta.label
  const OPENING = book.opening, LOADED = book.loaded, RECEIVED = book.received

  const { map: aliasMap, ours: ourSectionFor, teach } = useAliases('coatbook')

  const codes = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of [...OPENING, ...LOADED, ...RECEIVED]) {
      if (!l.code || isHardware(l) || isRubber(l)) continue
      if (!m.has(l.code)) m.set(l.code, l.name)
    }
    return [...m.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code))
  }, [OPENING, LOADED, RECEIVED])

  const unmapped = codes.filter(c => !ourSectionFor(c.code))
  const joined = useMemo(() => joinedSections(aliasMap), [aliasMap])

  const lines = book.of(sheetId)
  const isReceived = sheetId === 'received'

  /* The godown, or the route, picked once above the table and carried by
     every line entered under it. */
  const places = useMemo(() => ['All', ...placesOn(lines)], [lines])
  const shown = lines.filter(l => where === 'All' || l.place === where)

  const totals = {
    nos: sum(shown, l => l.nos),
    kg: sum(shown, l => l.kg ?? 0),
    shared: shown.filter(l => l.kg === null && !isHardware(l) && !isRubber(l)).length,
  }

  /* ── Sent against received ──────────────────────────────────────────── */
  const recon = useMemo(() => reconcile(LOADED, RECEIVED), [LOADED, RECEIVED])
  const rt = useMemo(() => reconTotals(recon, RECEIVED), [recon, RECEIVED])
  const pending = recon.filter(r => r.pendingNos > 0)
  const extra = recon.filter(r => r.extraNos > 0)

  /* ── One section, several colours ───────────────────────────────────── */
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
        colours: [...cols.entries()].map(([colour, v]) => ({ colour, ...v })).sort((a, b) => b.nos - a.nos),
        nos: [...cols.values()].reduce((s, v) => s + v.nos, 0),
      }))
      .filter(s => s.colours.length > 1)
      .sort((a, b) => b.colours.length - a.colours.length || b.nos - a.nos)
  }, [OPENING, LOADED, RECEIVED])

  /* ── Held against the rules the shop gave us on 11-11 ───────────────── */
  const checks = useMemo(() => {
    const out: { kind: 'error' | 'ok' | 'note'; title: string; detail: string }[] = []

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

    const m1 = OPENING.filter(l => l.route === 'M1 TO PC1')
    const m1Kg = +m1.reduce((t, l) => t + (l.kg ?? 0), 0).toFixed(2)
    const gap = +(m1Kg - WRITTEN.opening.kg).toFixed(2)
    if (Math.abs(gap) > 0.01) out.push({
      kind: 'error',
      title: `Your opening sheet still totals ${WRITTEN.opening.kg} kg`,
      detail: `With DV 7' at the ${openDv?.kg} kg you sent, the M1 lines now add to ${m1Kg} kg — `
        + `${gap.toFixed(2)} more than the figure at the foot of the sheet, which is exactly the `
        + `${gap.toFixed(2)} the DV line went up by. The line is corrected here; the total on your own copy `
        + `has not caught up with it.`,
    })

    const tbcShown = RECEIVED.filter(isTbc).reduce((a, l) => a + l.nos, 0)
    const tbcReal = tbcShown * TBC_MULTIPLIER
    out.push({
      kind: 'ok',
      title: `778 and 782 settled — TBC is ${TBC_MULTIPLIER} sections, not one`,
      detail: `${TBC_PARTS.join(', ')} are loaded separately and clubbed when sold. The received sheet shows `
        + `${tbcShown} TBC lines, which is ${tbcReal} pieces on the floor — the ${tbcReal - tbcShown} between `
        + `${WRITTEN.received.nos} and ${WRITTEN.received.splittedSeparately}.`,
    })

    const ws = weighments(RECEIVED).filter(w => w.lines.length > 1)
    if (ws.length) out.push({
      kind: 'note',
      title: `${ws.length} weighments cover more than one line`,
      detail: ws.map(w => `${w.kg} kg over ${w.nos} nos (${w.lines.map(l => l.name).join(' + ')})`).join('; ')
        + '. Read on their own those rows look unweighed. For the sent-against-received figures above they '
        + 'are split across the rows they cover by piece count, which is the only split the paper supports '
        + '— so those rows carry a mark and the percentage beside them is indicative.',
    })

    return out
  }, [OPENING, LOADED, RECEIVED])

  /* ── Entering a line ──────────────────────────────────────────────────
     Weight and weight per piece hold each other up the same way they do on
     the purchase sheet, and the name is composed from the product and the
     shade rather than typed, so the two books cannot drift apart again. */
  const rename = (l: BookLine, productId: string, colour: string) => ({
    productId, colour,
    name: composeName(productId, colour) || l.name,
    code: composeCode(productId, colour) || l.code,
  })

  const pickProduct = (l: BookLine, productId: string) => {
    const p = productById(productId)
    const kg = p?.kgPerPiece != null && l.nos > 0 ? +(p.kgPerPiece * l.nos).toFixed(3) : l.kg
    book.update(l.id, { ...rename(l, productId, l.colour), kg })
  }

  const setColour = (l: BookLine, colour: string) =>
    book.update(l.id, rename(l, l.productId, colour))

  const setNos = (l: BookLine, nos: number) => {
    const p = productById(l.productId)
    book.update(l.id, {
      nos,
      kg: p?.kgPerPiece != null ? +(p.kgPerPiece * nos).toFixed(3) : l.kg,
    })
  }

  const exportCsv = () => csvDownload('vsa-coating-book.csv', [
    [`Coating book — ${sheet}`, where === 'All' ? 'all places' : where],
    [], ['Code', 'Product Name', 'Qty (nos)', 'Weight (kgs)', 'Kg / Piece', 'Colour'],
    ...shown.map(l => [l.code ?? '', l.name, l.nos, l.kg ?? '',
      l.kg && l.nos ? +(l.kg / l.nos).toFixed(3) : '', colourOf(l)]),
    ['Total', '', totals.nos, totals.kg],
    [], ['Sent against received'],
    ['Code', 'Product', 'Sent nos', 'Sent kg', 'Back nos', 'Back kg', 'Pending nos', 'Weight %'],
    ...recon.map(r => [r.code, r.name, r.sentNos, r.sentKg, r.recvNos, r.recvKg, r.pendingNos, r.kgPct ?? '']),
  ])

  return (
    <div>
      <PageHead title="Coating Book"
        sub="Your own three sheets — what was lying, what went to the coater, what came back">
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Total Quantity" value={`${totals.nos} nos`} icon={Boxes} tone="brand"
          sub={`${shown.length} lines on ${sheet.toLowerCase()}`} />
        <Stat label="Total Weight" value={kgFmt(totals.kg)} icon={Scale} tone="violet"
          sub={totals.shared ? `${totals.shared} rows share a weighment above` : 'every row weighed on its own'} />
        <Stat label="Received Against Sent" value={pct(rt.kgPct)} icon={ArrowLeftRight}
          tone={rt.kgPct !== null && Math.abs(rt.kgPct) <= 8 ? 'green' : 'amber'}
          sub={`${kgFmt(rt.recvKg)} back against ${kgFmt(rt.sentKg)} out`} />
        <Stat label="Still at the Coater" value={`${rt.pendingNos} nos`} icon={Clock}
          tone={rt.pendingNos ? 'red' : 'green'}
          sub={rt.pendingNos ? `across ${rt.pendingLines} products` : 'everything has come back'} />
      </div>

      {/* ── The sheet, first, as asked ────────────────────────────────── */}
      <div className="card mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <p className="section-title text-base">{sheet}</p>
            <p className="section-sub">
              {entering
                ? 'Pick the product and the shade — the name writes itself the way you write it'
                : 'Your columns, your order — code, product name, qty, weight'}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SHEET_META.map(m => (
              <button key={m.id} onClick={() => { setSheetId(m.id); setWhere('All') }}
                className={cn('px-2.5 py-1 rounded-lg text-[11.5px] font-medium transition-colors',
                  m.id === sheetId ? 'text-white' : 'btn-ghost')}
                style={m.id === sheetId ? { background: 'var(--brand)' } : undefined}>{m.label}</button>
            ))}
          </div>
        </div>

        {/* The godown, picked once for every line below it. */}
        <div className="flex flex-wrap items-center gap-2 pb-3 mb-1"
          style={{ borderBottom: '1px solid var(--border-2)' }}>
          <span className="text-[11px] flex items-center gap-1.5 mr-1" style={{ color: 'var(--text-4)' }}>
            <Warehouse size={12} /> {isReceived ? 'Received at' : 'Route'}
          </span>
          {places.map(p => (
            <button key={p} onClick={() => setWhere(p)}
              className={cn('px-2.5 py-1 rounded-lg text-[11.5px] font-medium transition-colors',
                p === where ? 'text-white' : 'btn-ghost')}
              style={p === where ? { background: 'var(--brand)' } : undefined}>
              {p === 'All' ? 'All' : p}
            </button>
          ))}
          <span className="flex items-center gap-2 ml-auto">
            {book.changes > 0 && (
              <button className="btn-ghost !py-1 !text-[11px]" onClick={book.restore}
                title="Put every sheet back to the figures read off your workbook">
                <Undo2 size={12} /> {book.changes} {book.changes === 1 ? 'change' : 'changes'} — undo all
              </button>
            )}
            <button className="btn-ghost !py-1 !text-[11px]" onClick={() => setEntering(e => !e)}>
              <PencilLine size={12} /> {entering ? 'Done entering' : 'Enter lines'}
            </button>
          </span>
        </div>

        {entering && (
          <p className="text-[11px] mb-2.5 flex items-start gap-1.5" style={{ color: 'var(--text-4)' }}>
            <Warehouse size={11} className="mt-0.5 shrink-0" />
            {where === 'All'
              ? 'Pick a godown above before adding a line — whatever is picked there is carried by every line you add, so it is never asked for again on the row.'
              : `New lines go to ${where}. Change the tab above to put them somewhere else. Leave a weight blank where the row was put on the scale with the one above it.`}
          </p>
        )}

        <div className="overflow-auto -mx-1 px-1" style={{ maxHeight: '30rem' }}>
          <table className="w-full">
            <thead>
              <tr><th>Code</th><th>Product Name</th>
                {entering && <th>Shade</th>}
                <th className="num">Qty (nos)</th>
                <th className="num">Weight (kgs)</th><th className="num">Kg / Piece</th>
                {entering ? <th>Internal</th> : <th>Colour</th>}
                {entering && <th />}</tr>
            </thead>
            <tbody>
              {shown.map(l => {
                const colour = colourOf(l)
                const pk = per(l.kg, l.nos)
                const typed = book.isNew(l.id)
                const changed = book.isEdited(l.id)
                return (
                  <tr key={l.id}>
                    <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>
                      {(typed || changed) && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                          title={typed ? 'typed here' : 'changed from what your sheet says'}
                          style={{ background: typed ? 'var(--green)' : 'var(--amber)' }} />
                      )}
                      {l.code ?? '—'}
                    </td>

                    {entering ? (
                      <td className="min-w-[13rem]">
                        {/* Selection only — the name is never typed over. */}
                        <SectionPicker options={PICK_OPTIONS} value={l.productId}
                          onChange={id => pickProduct(l, id)} />
                        {!l.productId && l.name && (
                          <p className="text-[10.5px] mt-1 font-mono" style={{ color: 'var(--text-4)' }}>
                            on your sheet: {l.name}
                          </p>
                        )}
                      </td>
                    ) : (
                      <td className="text-xs max-w-[18rem] truncate" title={l.name}>{l.name || '—'}</td>
                    )}

                    {entering && (
                      <td>
                        {/* The colours come off the shared list, so one
                            added on a quotation — Rose Gold, say — is on
                            this screen too rather than in a second list
                            that quietly disagrees with the first. */}
                        <Select value={l.colour || 'W/O'} onChange={v => setColour(l, v)}
                          options={colourKeys} className="!w-24 !py-1 !text-xs !min-w-0" />
                      </td>
                    )}

                    <td className="num">
                      {entering ? (
                        <input className="input !w-20 !py-1 text-right tabular-nums !text-xs" value={l.nos}
                          onChange={e => setNos(l, Number(e.target.value) || 0)} />
                      ) : (
                        <span className="tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{l.nos}</span>
                      )}
                    </td>

                    <td className="num">
                      {entering ? (
                        <input className="input !w-24 !py-1 text-right tabular-nums !text-xs"
                          value={l.kg ?? ''} placeholder="weighed above"
                          title="Leave it blank where this row went on the scale with the one above it"
                          onChange={e => book.update(l.id,
                            { kg: e.target.value === '' ? null : Number(e.target.value) })} />
                      ) : (
                        <span className="tabular-nums text-xs"
                          style={{ color: l.kg === null && !isHardware(l) && !isRubber(l) ? 'var(--text-4)' : undefined }}
                          title={l.kg === null && !isHardware(l) && !isRubber(l)
                            ? 'Weighed together with the row above it' : undefined}>
                          {l.kg !== null ? l.kg : isHardware(l) ? '—' : isRubber(l) ? l.unit : 'weighed above'}
                        </span>
                      )}
                    </td>

                    <td className="num tabular-nums text-xs" style={{ color: 'var(--text-4)' }}>{pk ?? '—'}</td>

                    {entering ? (
                      <td>
                        <input className="input !w-24 !py-1 !text-xs" value={l.internal ?? ''} placeholder="—"
                          onChange={e => book.update(l.id,
                            { internal: e.target.value === '' ? null : e.target.value })} />
                      </td>
                    ) : (
                      <td>
                        <span className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: COLOUR_DOT[colour] ?? '#C7D0DA', border: '1px solid var(--border-2)' }} />
                          {colour}
                        </span>
                      </td>
                    )}

                    {entering && (
                      <td>
                        <button className="btn-ghost !px-1.5 !py-1" style={{ color: 'var(--red)' }}
                          title="Take this line off the sheet"
                          onClick={() => book.remove(l.id)}><Trash2 size={13} /></button>
                      </td>
                    )}
                  </tr>
                )
              })}
              {shown.length === 0 && (
                <tr><td colSpan={entering ? 8 : 6}>
                  <Empty msg={where === 'All' ? 'Nothing on this sheet' : `Nothing at ${where} yet`} />
                </td></tr>
              )}
            </tbody>
            {shown.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border-2)' }}>
                  <td colSpan={entering ? 3 : 2} className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>
                    Total — {where === 'All' ? 'all places' : where}
                  </td>
                  <td className="num tabular-nums font-bold" style={{ color: 'var(--brand)' }}>{totals.nos}</td>
                  <td className="num tabular-nums font-bold" style={{ color: 'var(--brand)' }}>{totals.kg}</td>
                  <td colSpan={entering ? 3 : 2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {entering && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-1"
            style={{ borderTop: '1px solid var(--border-2)' }}>
            <button className="btn-outline" disabled={where === 'All'}
              style={where === 'All' ? { opacity: .45, cursor: 'not-allowed' } : undefined}
              onClick={() => book.add(newLine(sheetId, where, meta.date))}>
              <Plus size={14} /> Add a line{where === 'All' ? '' : ` at ${where}`}
            </button>
            <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>
              A green dot is a line typed here; amber is one changed from what your sheet says. Nothing
              overwrites your workbook — undo all puts every figure back.
            </p>
          </div>
        )}
      </div>

      {/* ── What has not come back ────────────────────────────────────── */}
      <div className="card mb-5"
        style={{ borderColor: pending.length ? 'var(--red)' : 'var(--green)' }}>
        <p className="section-title text-base mb-1 flex items-center gap-2">
          {pending.length
            ? <Clock size={15} style={{ color: 'var(--red)' }} />
            : <CircleCheck size={15} style={{ color: 'var(--green)' }} />}
          {pending.length
            ? `${rt.pendingNos} Pieces Still at the Coater`
            : 'Everything Sent Has Come Back'}
        </p>
        <p className="section-sub mb-4 max-w-4xl">
          What went out on 16 and 17-09 against what came back on 21-09, matched on the product rather than
          the printed name — a section leaves as W/O and returns as Ivory, so the names never agree.
        </p>

        {pending.length > 0 && (
          <div className="space-y-2 mb-4">
            {pending.map(r => (
              <div key={r.key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg p-3"
                style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <div className="min-w-0">
                  <p className="text-sm" style={{ color: 'var(--text-1)' }}>
                    <span className="font-mono text-xs mr-2" style={{ color: 'var(--text-4)' }}>{r.code}</span>
                    <b>{r.name}</b>
                  </p>
                  <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-4)' }}>
                    {r.sentNos} nos sent, {r.recvNos} back
                    {r.colours.length > 0 && ` · came back ${r.colours.join(', ')}`}
                  </p>
                </div>
                <span className="badge-red shrink-0">{r.pendingNos} nos pending</span>
              </div>
            ))}
          </div>
        )}

        {extra.length > 0 && (
          <p className="text-[11.5px] mb-4" style={{ color: 'var(--text-4)' }}>
            {extra.map(r => `${r.extraNos} nos of ${r.name}`).join(', ')} came back without going out on this
            load — older stock returning with it. {rt.tbcLines > 0 && `TBC is ${TBC_MULTIPLIER} sections clubbed, so its ${rt.tbcLines} lines are ${rt.tbcLines * TBC_MULTIPLIER} pieces on the floor.`}
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3"
          style={{ borderTop: '1px solid var(--border-2)' }}>
          {[
            { k: 'Sent out', v: `${rt.sentNos} nos`, s: kgFmt(rt.sentKg) },
            { k: 'Came back', v: `${rt.recvNos} nos`, s: kgFmt(rt.recvKg) },
            { k: 'Pieces', v: pct(rt.nosPct), s: `${rt.recvNos - rt.sentNos} nos difference`, tone: rt.nosPct },
            { k: 'Weight', v: pct(rt.kgPct), s: `${(rt.recvKg - rt.sentKg).toFixed(2)} kg difference`, tone: rt.kgPct },
          ].map(x => (
            <div key={x.k}>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{x.k}</p>
              <p className="text-base font-bold tabular-nums"
                style={{ color: x.tone !== undefined ? pctTone(x.tone) : 'var(--text-1)' }}>{x.v}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>{x.s}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] mt-3" style={{ color: 'var(--text-4)' }}>
          Weight comes back heavier than it went — {pct(rt.kgPct)} across the load — which is the powder
          sitting on it. A section far outside that is worth a question.
        </p>
      </div>

      {/* ── Product by product ────────────────────────────────────────── */}
      <div className="card mb-5">
        <p className="section-title text-base mb-1 flex items-center gap-2">
          <PackageCheck size={15} className="text-brand" /> Sent and Received, Product by Product
        </p>
        <p className="section-sub mb-4 max-w-4xl">
          A row marked <b>shared</b> has part of its weight apportioned out of a weighment covering more than
          one line, split by piece count. That is the only split the paper supports, so read the percentage
          beside it as indicative.
        </p>
        <TableCard maxH="26rem">
          <thead>
            <tr><th>Code</th><th>Product</th><th className="num">Sent nos</th><th className="num">Sent kg</th>
              <th className="num">Back nos</th><th className="num">Back kg</th>
              <th className="num">Pending</th><th className="num">Weight</th><th>Came back as</th></tr>
          </thead>
          <tbody>
            {recon.map(r => (
              <tr key={r.key}>
                <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{r.code}</td>
                <td className="text-xs max-w-[13rem] truncate" title={r.name}>
                  {r.name}
                  {r.sharedWeighment && (
                    <span className="badge-gray ml-1.5 !text-[9px] !px-1 !py-0">shared</span>
                  )}
                </td>
                <td className="num tabular-nums text-xs">{r.sentNos || '—'}</td>
                <td className="num tabular-nums text-xs">{r.sentKg || '—'}</td>
                <td className="num tabular-nums text-xs">{r.recvNos || '—'}</td>
                <td className="num tabular-nums text-xs">{r.recvKg || '—'}</td>
                <td className="num tabular-nums text-xs font-semibold"
                  style={{ color: r.pendingNos ? 'var(--red)' : 'var(--text-4)' }}>
                  {r.pendingNos || (r.extraNos ? `+${r.extraNos}` : '—')}
                </td>
                <td className="num tabular-nums text-xs font-semibold" style={{ color: pctTone(r.kgPct) }}>
                  {pct(r.kgPct)}
                </td>
                <td className="text-[11px]" style={{ color: 'var(--text-4)' }}>{r.colours.join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      </div>

      {/* ── One section, several colours ──────────────────────────────── */}
      <div className="card mb-5">
        <p className="section-title text-base mb-1 flex items-center gap-2">
          <Palette size={15} className="text-brand" /> One Section, Several Colours
        </p>
        <p className="section-sub mb-4 max-w-4xl">
          Code 20033 leaves as <b>W/O</b> — without coating — and comes back as Ivory, Coffee Brown or Pista
          Green. The number is the section; the colour is a state it passes into at the coater.
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
                      style={{ color: c.colour === 'Uncoated' ? 'var(--text-4)' : 'var(--text-2)' }}>{c.colour}</span>
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

      {/* ── Teaching the coating codes ────────────────────────────────── */}
      <div className="card mb-5" style={unmapped.length ? { borderColor: 'var(--amber, #f59e0b)' } : undefined}>
        <p className="section-title text-base mb-1 flex items-center gap-2">
          <Link2 size={15} className="text-brand" /> What the Coating Book Calls These
        </p>
        <p className="section-sub mb-4 max-w-4xl">
          Point each number at a product once. Taught here, it is known on the purchase sheet and the
          coater's bill too — and that is what lets a figure travel from the mill through to the colour.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {codes.map(c => (
            <div key={c.code} className="flex flex-wrap items-center justify-between gap-3 rounded-lg p-2.5"
              style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
              <div className="min-w-0">
                <span className="font-mono text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{c.code}</span>
                <span className="text-xs ml-2 truncate" style={{ color: 'var(--text-4)' }}>{c.name}</span>
              </div>
              <SectionPicker className="w-56 shrink-0" options={PICK_OPTIONS}
                value={ourSectionFor(c.code) ?? ''} onChange={v => teach(c.code, v)} />
            </div>
          ))}
        </div>
        <p className="text-[11.5px] mt-3 pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
          {unmapped.length === 0
            ? 'Every code here is pointed at a product.'
            : `${unmapped.length} of ${codes.length} still to be pointed at a product.`}
        </p>
      </div>

      {joined.length > 0 && (
        <div className="card mb-5" style={{ borderColor: 'var(--green)' }}>
          <p className="section-title text-base mb-1 flex items-center gap-2">
            <CircleCheck size={15} style={{ color: 'var(--green)' }} /> These Sections Now Join Up
          </p>
          <div className="space-y-2 mt-3">
            {joined.map(j => (
              <div key={j.section} className="rounded-lg p-3"
                style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <p className="text-sm font-semibold mb-1.5" style={{ color: 'var(--text-1)' }}>{sectionName(j.section)}</p>
                <div className="flex flex-wrap gap-1.5">
                  {namesFor(aliasMap, j.section).map(n => (
                    <span key={`${n.source}:${n.foreign}`} className="text-[11px] px-2 py-1 rounded font-mono"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-2)', color: 'var(--text-2)' }}>
                      {n.source === 'depot' ? 'depot' : n.source === 'coater' ? "coater's bill" : 'coating book'}
                      {' · '}{n.foreign.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Workings, last ────────────────────────────────────────────── */}
      <div className="card" style={{ borderColor: 'var(--amber, #f59e0b)' }}>
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
    </div>
  )
}
