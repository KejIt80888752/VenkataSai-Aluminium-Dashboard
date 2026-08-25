import { useState, useMemo, useEffect } from 'react'
import {
  FileSpreadsheet, Upload, X, Scale, Wand2, Link2, CircleAlert, Download, Save, Ruler, IndianRupee,
} from 'lucide-react'
import { PageHead, Stat, Select, ExportBtn, TableCard, Empty } from '@/components/ui'
import { ourCoatingLines } from '@/lib/coatinglines'
import { ALIASES } from '@/data/itemmaster'
import { PCUS } from '@/data/locations'
import { parseCsv, toNumber } from '@/lib/csv'
import { inr, inr2, csvDownload, cn } from '@/lib/utils'
import { COMPANY, FY } from '@/data/company'

/* ── Two sheets that do not look alike ─────────────────────────────────────
   A coater bills in his own layout, with his own column names and his own
   words for a section. Nothing lines up on its own. Three things are needed
   before the figures can be compared: which of his columns is which, what
   his words for a section mean in our master, and a reference both sides
   carry. The DC number is that reference — it is printed on the challan we
   send with the material, so it comes back on his bill.                   */

type FieldKey = 'dcNo' | 'section' | 'sqft' | 'rate' | 'amount' | 'shade'

const FIELDS: { key: FieldKey; label: string; needed?: boolean; hint: string }[] = [
  { key: 'dcNo',    label: 'Our DC number', needed: true, hint: 'The reference both sides carry' },
  { key: 'section', label: 'Section / item', needed: true, hint: 'Whatever he calls it' },
  { key: 'sqft',    label: 'Area billed',    needed: true, hint: 'Square feet' },
  { key: 'rate',    label: 'Rate per sqft',  hint: 'Taken from the amount if absent' },
  { key: 'amount',  label: 'Amount',         needed: true, hint: 'Before GST' },
  { key: 'shade',   label: 'Shade / colour', hint: 'Only used to explain a rate gap' },
]

/* Their column names, in the wording coaters actually use. */
const HINTS: Record<FieldKey, string[]> = {
  dcNo:    ['dc', 'challan', 'party dc', 'ref', 'document'],
  section: ['item', 'description', 'particulars', 'section', 'profile'],
  sqft:    ['area', 'sqft', 'sq ft', 'sq.ft', 'square'],
  rate:    ['rate', 'price', 'per sqft'],
  amount:  ['amount', 'value', 'total'],
  shade:   ['shade', 'colour', 'color', 'ral'],
}

type Cause = 'Agreed' | 'Area Differs' | 'Rate Differs' | 'Area and Rate Differ' | 'Not in Our Books' | 'Not on Their Bill'

const badgeFor = (c: Cause) =>
  c === 'Agreed' ? 'badge-green'
  : c === 'Area Differs' ? 'badge-yellow'
  : c === 'Rate Differs' ? 'badge-blue'
  : c === 'Area and Rate Differ' ? 'badge-red'
  : c === 'Not in Our Books' ? 'badge-purple' : 'badge-gray'

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/* A job work bill opens with the coater's name and GSTIN, so the headings are
   rarely the first row. The real header is the one that both has the most
   filled cells and reads like column names. */
function headerRow(rows: string[][]): number {
  let best = 0, bestScore = -1
  const hints = Object.values(HINTS).flat()
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const cells = rows[i].filter(c => String(c).trim() !== '')
    const matches = cells.filter(c => hints.some(h => norm(String(c)).includes(norm(h)))).length
    const score = cells.length + matches * 3
    if (score > bestScore) { bestScore = score; best = i }
  }
  return best
}
const LAYOUT_KEY = (pcu: string) => `vsa-coater-layout-${pcu}`
const ALIAS_KEY = 'vsa-coater-aliases'

export default function CoaterBillRecon() {
  const ours = useMemo(ourCoatingLines, [])
  const [pcu, setPcu] = useState(PCUS[0]?.id ?? 'PCU1')

  const [file, setFile] = useState<{ name: string; header: string[]; body: string[][] } | null>(null)
  const [map, setMap] = useState<Partial<Record<FieldKey, number>>>({})
  const [learned, setLearned] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(ALIAS_KEY) ?? '{}') } catch { return {} }
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => { try { localStorage.setItem(ALIAS_KEY, JSON.stringify(learned)) } catch { /* blocked */ } }, [learned])

  const oursForPcu = ours.filter(l => l.pcu === pcu)

  /* ── Reading their sheet ───────────────────────────────────────────── */
  const ingest = (name: string, text: string) => {
    const all = parseCsv(text)
    if (!all.length) return
    const hi = headerRow(all)
    const header = all[hi]
    const body = all.slice(hi + 1).filter(r => r.some(c => String(c).trim() !== ''))

    // Remembered layout first; only guess where nothing was remembered.
    let guess: Partial<Record<FieldKey, number>> = {}
    try { guess = JSON.parse(localStorage.getItem(LAYOUT_KEY(pcu)) ?? '{}') } catch { /* none */ }
    const valid = Object.fromEntries(
      Object.entries(guess).filter(([, i]) => typeof i === 'number' && i < header.length),
    ) as Partial<Record<FieldKey, number>>

    const used = new Set(Object.values(valid))
    for (const f of FIELDS) {
      if (valid[f.key] !== undefined) continue
      const hit = header.findIndex((h, i) => !used.has(i) && HINTS[f.key].some(x => norm(h).includes(norm(x))))
      if (hit !== -1) { valid[f.key] = hit; used.add(hit) }
    }
    setFile({ name, header, body }); setMap(valid); setSaved(false)
  }

  const load = (f: File) => {
    const r = new FileReader()
    r.onload = () => ingest(f.name, String(r.result ?? ''))
    r.readAsText(f)
  }

  /* ── A sample in a coater's own layout, to show it working ─────────── */
  const loadSample = () => {
    const aliasFor = (code: string) =>
      ALIASES.find(a => a.kind === 'Product' && a.mapsTo === code)?.alias
      ?? code.replace('VSA-', '').replace(/-/g, ' ')
    // A full month's bill, so the comparison reads the way a real one would.
    const rows = oursForPcu.map((l, i) => {
      // Their sheet disagrees in a few realistic ways.
      const sqft = i % 17 === 3 ? +(l.sqft * 1.06).toFixed(1) : l.sqft
      const rate = i % 23 === 5 ? +(l.rate + 0.75).toFixed(2) : l.rate
      return [`CB/${String(400 + i)}`, l.dcNo, aliasFor(l.code), l.shadeName, sqft, rate, +(sqft * rate).toFixed(2)]
    })
    // Two lines he has billed that we never sent him.
    rows.push([`CB/${900}`, oursForPcu[0]?.dcNo ?? 'DC/001', 'EXTRA MASKING CHARGE', 'Traffic White', 120, 4, 480])
    rows.push([`CB/${901}`, oursForPcu[2]?.dcNo ?? 'DC/002', 'LV BLADE', 'Traffic White', 96, 11.5, 1104])
    // And one of ours he has left off his bill altogether.
    const drop = oursForPcu.length > 6 ? oursForPcu[6].key : ''

    const kept = drop ? rows.filter((_, i) => oursForPcu[i]?.key !== drop) : rows

    const csv = [
      ['Sri Venkateshwara Powder Coating — Job Work Bill'],
      ['GSTIN 29AABCS9911K1ZP', 'Month: August 2026'],
      [],
      ['Bill No', 'Party DC', 'Particulars', 'Colour', 'Area Sq.Ft', 'Rate', 'Amount'],
      ...kept,
    ].map(r => r.join(',')).join('\n')
    ingest('coater-bill-august.csv', csv)
  }

  /* ── Their words for a section → our master ────────────────────────── */
  const resolve = (text: string): string | null => {
    const n = norm(text)
    if (!n) return null
    if (learned[n]) return learned[n]

    // What the item master already knows this supplier calls it.
    const exact = ALIASES.find(a => a.kind === 'Product' && norm(a.alias) === n)
    if (exact) return exact.mapsTo

    // Many bills carry our own code in some shortened form.
    const byCode = oursForPcu.find(l => norm(l.code) === n || norm(l.code).includes(n) || n.includes(norm(l.code)))
    if (byCode) return byCode.code

    const byName = oursForPcu.find(l => norm(l.name) === n)
    if (byName) return byName.code

    // Loose matches last, and only when there is enough text to be sure.
    if (n.length >= 5) {
      const looseName = oursForPcu.find(l => norm(l.name).includes(n) || n.includes(norm(l.name)))
      if (looseName) return looseName.code
      const looseAlias = ALIASES.find(a => a.kind === 'Product' && (norm(a.alias).includes(n) || n.includes(norm(a.alias))))
      if (looseAlias) return looseAlias.mapsTo
    }
    return null
  }

  /* ── The comparison ────────────────────────────────────────────────── */
  const result = useMemo(() => {
    if (!file || map.dcNo === undefined || map.section === undefined) return null

    const cell = (r: string[], k: FieldKey) => (map[k] === undefined ? '' : r[map[k]!] ?? '')

    const theirs = file.body.map(r => {
      const rawSection = String(cell(r, 'section')).trim()
      const sqft = toNumber(cell(r, 'sqft'))
      const amount = toNumber(cell(r, 'amount'))
      const rate = map.rate !== undefined ? toNumber(cell(r, 'rate')) : (sqft > 0 ? +(amount / sqft).toFixed(2) : 0)
      return {
        dcNo: String(cell(r, 'dcNo')).trim(),
        rawSection, code: resolve(rawSection),
        shade: String(cell(r, 'shade')).trim(),
        sqft, rate, amount,
      }
    })

    const unresolved = [...new Set(theirs.filter(t => !t.code).map(t => t.rawSection))]

    const seen = new Set<string>()
    const rows = theirs.map(t => {
      const key = `${t.dcNo}|${t.code}`
      seen.add(key)
      const our = oursForPcu.find(o => o.dcNo === t.dcNo && o.code === t.code)
      if (!our) {
        return {
          key, dcNo: t.dcNo, name: t.rawSection, code: t.code ?? '—',
          ourSqft: 0, ourRate: 0, ourAmt: 0,
          theirSqft: t.sqft, theirRate: t.rate, theirAmt: t.amount,
          gap: t.amount, cause: 'Not in Our Books' as Cause,
        }
      }
      const areaOff = Math.abs(our.sqft - t.sqft) > Math.max(our.sqft * 0.005, 0.2)
      const rateOff = Math.abs(our.rate - t.rate) > 0.01
      const cause: Cause = areaOff && rateOff ? 'Area and Rate Differ'
        : areaOff ? 'Area Differs' : rateOff ? 'Rate Differs' : 'Agreed'
      return {
        key, dcNo: t.dcNo, name: our.name, code: our.code,
        ourSqft: our.sqft, ourRate: our.rate, ourAmt: our.amount,
        theirSqft: t.sqft, theirRate: t.rate, theirAmt: t.amount,
        gap: +(t.amount - our.amount).toFixed(2), cause,
      }
    })

    for (const o of oursForPcu) {
      if (!seen.has(`${o.dcNo}|${o.code}`)) {
        rows.push({
          key: o.key, dcNo: o.dcNo, name: o.name, code: o.code,
          ourSqft: o.sqft, ourRate: o.rate, ourAmt: o.amount,
          theirSqft: 0, theirRate: 0, theirAmt: 0,
          gap: -o.amount, cause: 'Not on Their Bill' as Cause,
        })
      }
    }

    const gap = +rows.reduce((s, r) => s + r.gap, 0).toFixed(2)
    const causes = (['Area Differs', 'Rate Differs', 'Area and Rate Differ', 'Not in Our Books', 'Not on Their Bill'] as Cause[])
      .map(c => ({ cause: c, count: rows.filter(r => r.cause === c).length, gap: +rows.filter(r => r.cause === c).reduce((s, r) => s + r.gap, 0).toFixed(2) }))
      .filter(c => c.count > 0)

    return { rows, gap, causes, unresolved, theirTotal: +theirs.reduce((s, t) => s + t.amount, 0).toFixed(2),
             ourTotal: +oursForPcu.reduce((s, o) => s + o.amount, 0).toFixed(2) }
  }, [file, map, learned, oursForPcu])

  const rememberLayout = () => {
    try { localStorage.setItem(LAYOUT_KEY(pcu), JSON.stringify(map)); setSaved(true) } catch { /* blocked */ }
  }

  const templateCsv = () => csvDownload('coating-bill-template.csv', [
    [`Job work bill layout ${COMPANY.short} can read straight away`],
    [], ['Our DC Number', 'Section / Item', 'Shade', 'Area Sqft', 'Rate per Sqft', 'Amount'],
    ...oursForPcu.slice(0, 3).map(o => [o.dcNo, o.name, o.shadeName, o.sqft, o.rate, o.amount]),
  ])

  const exportCsv = () => result && csvDownload(`coater-bill-recon-${pcu}.csv`, [
    [`Coater's bill against our coating charges — ${pcu}`, FY],
    [], ['Their bill total', result.theirTotal], ['Our books', result.ourTotal], ['Difference', result.gap],
    [], ['Reason', 'Lines', 'Effect'], ...result.causes.map(c => [c.cause, c.count, c.gap]),
    [], ['DC No', 'Section', 'Our Sqft', 'Their Sqft', 'Our Rate', 'Their Rate', 'Our Amount', 'Their Amount', 'Difference', 'Reason'],
    ...result.rows.map(r => [r.dcNo, r.name, r.ourSqft, r.theirSqft, r.ourRate, r.theirRate, r.ourAmt, r.theirAmt, r.gap, r.cause]),
  ])

  return (
    <div>
      <PageHead title="Coater's Bill vs Ours"
        sub="His layout, his wording for a section — matched to our figures on the DC number">
        <Select value={pcu} onChange={v => { setPcu(v); setFile(null) }} options={PCUS.map(p => p.id)} />
        <button className="btn-outline" onClick={templateCsv}><Download size={14} /> Our layout</button>
        {result && <ExportBtn onClick={exportCsv} />}
      </PageHead>

      {/* ── The file ─────────────────────────────────────────────────── */}
      <div className="card mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <p className="section-title text-base mb-1">His Bill</p>
            <p className="section-sub max-w-3xl">
              Nothing has to be reformatted before sending. Save his sheet as CSV and drop it here — the columns are
              matched to ours below, and once you have set a coater's layout it is remembered for next month.
            </p>
          </div>
          {!file && <button className="btn-outline shrink-0" onClick={loadSample}><Wand2 size={14} /> Try a sample bill</button>}
        </div>

        {file ? (
          <div className="flex items-center justify-between gap-3 rounded-lg p-3"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
            <span className="flex items-center gap-2 text-sm min-w-0" style={{ color: 'var(--text-1)' }}>
              <FileSpreadsheet size={15} className="text-brand shrink-0" />
              <span className="truncate">{file.name}</span>
              <span className="text-xs shrink-0" style={{ color: 'var(--text-4)' }}>{file.body.length} lines</span>
            </span>
            <button className="btn-ghost !px-2 shrink-0" onClick={() => setFile(null)}><X size={14} /></button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 rounded-lg py-10 cursor-pointer"
            style={{ border: '1.5px dashed var(--border-2)' }}>
            <Upload size={22} style={{ color: 'var(--text-4)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>Choose his bill (.csv)</span>
            <input type="file" accept=".csv,text/csv" className="hidden"
              onChange={e => e.target.files?.[0] && load(e.target.files[0])} />
          </label>
        )}
      </div>

      {file && (
        <>
          {/* ── Step 1: which column is which ──────────────────────── */}
          <div className="card mb-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <p className="section-title text-base mb-1">1 · Which of His Columns Is Which</p>
                <p className="section-sub">Guessed from the headings; change anything that landed wrong.</p>
              </div>
              <button className={cn('shrink-0', saved ? 'btn-ghost' : 'btn-outline')} onClick={rememberLayout}>
                <Save size={14} /> {saved ? 'Layout remembered' : `Remember this for ${pcu}`}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2.5">
              {FIELDS.map(f => (
                <div key={f.key}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs truncate" style={{ color: 'var(--text-2)' }}>
                      {f.label}{f.needed && <span style={{ color: 'var(--red)' }}> *</span>}
                    </span>
                    <select className="input !w-36 !py-1 !text-xs shrink-0" value={map[f.key] ?? -1}
                      onChange={e => setMap(m => {
                        const n = { ...m }
                        if (Number(e.target.value) < 0) delete n[f.key]; else n[f.key] = Number(e.target.value)
                        return n
                      })}>
                      <option value={-1}>— not in his sheet —</option>
                      {file.header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                    </select>
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-4)' }}>{f.hint}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Step 2: his wording for a section ──────────────────── */}
          {result && result.unresolved.length > 0 && (
            <div className="card mb-5" style={{ borderColor: 'var(--amber, #f59e0b)' }}>
              <p className="section-title text-base mb-1 flex items-center gap-2">
                <Link2 size={15} className="text-brand" /> 2 · What He Calls These
              </p>
              <p className="section-sub mb-3">
                These words are not in the item master yet. Point each one at our section once and it is remembered —
                next month's bill matches on its own.
              </p>
              <div className="space-y-2">
                {result.unresolved.map(u => (
                  <div key={u} className="flex flex-wrap items-center justify-between gap-3 rounded-lg p-2.5"
                    style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                    <span className="font-mono text-xs min-w-0 truncate" style={{ color: 'var(--text-1)' }}>{u}</span>
                    <select className="input !w-64 !py-1 !text-xs shrink-0" value=""
                      onChange={e => e.target.value && setLearned(l => ({ ...l, [norm(u)]: e.target.value }))}>
                      <option value="">— choose our section —</option>
                      {[...new Map(oursForPcu.map(o => [o.code, o.name])).entries()].map(([c, n]) =>
                        <option key={c} value={c}>{n}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!result ? (
            <Empty msg="Point at least the DC number and the section column before it can compare" />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
                <Stat label="He Has Billed" value={inr(result.theirTotal)} icon={FileSpreadsheet} tone="violet"
                  sub={`${file.body.length} lines on his bill`} />
                <Stat label="Our Books Say" value={inr(result.ourTotal)} icon={IndianRupee} tone="brand"
                  sub={`${oursForPcu.length} lines from our challans`} />
                <Stat label="Difference" value={inr(Math.abs(result.gap))} icon={Scale}
                  tone={Math.abs(result.gap) < 1 ? 'green' : 'red'}
                  sub={Math.abs(result.gap) < 1 ? 'The two bills agree' : result.gap > 0 ? 'He is charging more' : 'He has billed less'} />
                <Stat label="Lines to Settle" value={String(result.rows.filter(r => r.cause !== 'Agreed').length)}
                  icon={CircleAlert} tone="amber" sub={`of ${result.rows.length} compared`} />
              </div>

              {result.causes.length > 0 && (
                <div className="card mb-5">
                  <p className="section-title text-base mb-1">3 · Why the Two Differ</p>
                  <p className="section-sub mb-4">
                    Area and rate are compared separately, so a gap points at one thing — the sqft he measured, the
                    rate he applied, or a line only one side carries.
                  </p>
                  <div className="space-y-2.5">
                    {result.causes.map(c => {
                      const total = result.causes.reduce((s, x) => s + Math.abs(x.gap), 0)
                      return (
                        <div key={c.cause}>
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <span className="flex items-center gap-2 text-sm">
                              <span className={badgeFor(c.cause)}>{c.cause}</span>
                              <span className="text-xs" style={{ color: 'var(--text-4)' }}>
                                {c.count} {c.count === 1 ? 'line' : 'lines'}
                              </span>
                            </span>
                            <span className="tabular-nums font-semibold text-sm shrink-0"
                              style={{ color: c.gap > 0 ? 'var(--red)' : 'var(--green)' }}>
                              {c.gap > 0 ? '+' : '−'}{inr(Math.abs(c.gap))}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-card2)' }}>
                            <div className="h-full rounded-full"
                              style={{ width: `${total ? Math.abs(c.gap) / total * 100 : 0}%`,
                                       background: c.gap > 0 ? 'var(--red)' : 'var(--green)' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <p className="section-title text-base mb-1">Line by Line</p>
              <p className="section-sub mb-3">Matched on the DC number printed on the challan we sent with the material</p>
              <TableCard maxH="30rem">
                <thead>
                  <tr><th>DC No</th><th>Section</th>
                    <th className="num">Our Sqft</th><th className="num">His Sqft</th>
                    <th className="num">Our Rate</th><th className="num">His Rate</th>
                    <th className="num">Difference</th><th>Reason</th></tr>
                </thead>
                <tbody>
                  {result.rows.map(r => (
                    <tr key={r.key + r.cause}>
                      <td className="text-xs whitespace-nowrap font-medium" style={{ color: 'var(--text-1)' }}>{r.dcNo}</td>
                      <td className="text-xs max-w-[15rem] truncate" title={r.name}>{r.name}</td>
                      <td className="num tabular-nums text-xs">{r.ourSqft || '—'}</td>
                      <td className={cn('num tabular-nums text-xs')}
                        style={{ color: r.cause.includes('Area') ? 'var(--red)' : undefined }}>{r.theirSqft || '—'}</td>
                      <td className="num tabular-nums text-xs">{r.ourRate ? inr2(r.ourRate) : '—'}</td>
                      <td className={cn('num tabular-nums text-xs')}
                        style={{ color: r.cause.includes('Rate') ? 'var(--red)' : undefined }}>{r.theirRate ? inr2(r.theirRate) : '—'}</td>
                      <td className="num tabular-nums font-semibold"
                        style={{ color: r.gap === 0 ? 'var(--text-4)' : r.gap > 0 ? 'var(--red)' : 'var(--green)' }}>
                        {r.gap === 0 ? '—' : (r.gap > 0 ? '+' : '−') + inr(Math.abs(r.gap))}
                      </td>
                      <td><span className={badgeFor(r.cause)}>{r.cause}</span></td>
                    </tr>
                  ))}
                </tbody>
              </TableCard>
            </>
          )}
        </>
      )}

      <p className="text-[11px] mt-5 leading-relaxed max-w-4xl" style={{ color: 'var(--text-4)' }}>
        <Ruler size={12} className="inline mr-1 -mt-0.5" />
        Two sheets never line up by themselves. What makes it work is that the DC number we print on the challan comes
        back on his bill, so there is one thing both sides agree on. Everything else — his column order, his words for a
        section — is set once and remembered.
      </p>
    </div>
  )
}
