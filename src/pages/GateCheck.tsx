import { useState, useRef, useEffect, useMemo } from 'react'
import {
  ScanBarcode, ShieldCheck, ShieldAlert, Scale, Truck, CircleAlert, CheckCircle2, Lock, Unlock, Video,
} from 'lucide-react'
import { PageHead, Stat, Select, TableCard, Empty, Modal } from '@/components/ui'
import { INVOICES } from '@/data/txns'
import { P } from '@/data/catalogue'
import { GATES } from '@/data/operations'
import { inr, kg, fmtDate, cn } from '@/lib/utils'
import { COMPANY } from '@/data/company'

/* ── Verifying a load against its bill ─────────────────────────────────────
   Software on its own cannot know what sits on the lorry. Something has to
   read the material at the gate. Every bundle carries a sticker printed when
   it is picked; the guard scans each one as it is loaded and this screen
   compares that list against the bill, piece by piece.                     */

const CHAR_GAP_MS = 40
const WEIGHT_TOLERANCE = 0.02   // 2% — rounding, packing, moisture

type LineState = 'Agreed' | 'Short Loaded' | 'Over Loaded' | 'Not On Bill'

export default function GateCheck() {
  /* Only bills for today's dispatch would normally appear; the latest are used here. */
  const ready = useMemo(() => [...INVOICES].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40), [])

  const [billNo, setBillNo] = useState(ready[0]?.no ?? '')
  const [gate, setGate] = useState<string>(GATES[0].id)
  const [scans, setScans] = useState<{ code: string; at: string }[]>([])
  const [weighbridge, setWeighbridge] = useState('')
  const [released, setReleased] = useState<{ at: string; override: string } | null>(null)
  const [askOverride, setAskOverride] = useState(false)
  const [reason, setReason] = useState('')

  const bill = ready.find(b => b.no === billNo)

  /* ── The gate scanner ──────────────────────────────────────────────── */
  const buf = useRef({ text: '', last: 0 })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
      const now = Date.now()
      if (now - buf.current.last > CHAR_GAP_MS) buf.current.text = ''
      buf.current.last = now
      if (e.key === 'Enter') {
        const raw = buf.current.text.trim(); buf.current.text = ''
        if (raw.length < 3) return
        // A bundle sticker reads CODE or CODE|BUNDLE; only the item matters here.
        const code = raw.split(/[|:]/)[0].trim().toUpperCase()
        setScans(s => [...s, { code, at: new Date().toLocaleTimeString('en-IN', { hour12: false }) }])
        return
      }
      if (e.key.length === 1) buf.current.text += e.key
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ── Bill against what was actually loaded ─────────────────────────── */
  const check = useMemo(() => {
    if (!bill) return null
    const scanned = new Map<string, number>()
    for (const s of scans) scanned.set(s.code, (scanned.get(s.code) ?? 0) + 1)

    const lines = bill.lines.map(l => {
      const got = scanned.get(l.code.toUpperCase()) ?? 0
      scanned.delete(l.code.toUpperCase())
      const p = P.find(x => x.code === l.code)
      const kgPer = p?.kgPerLength ?? 0
      // Sections are billed by weight but loaded by the bundle, so the bill
      // figure is turned into the number of pieces the gate should see.
      const expected = l.unit === 'kg' && kgPer > 0 ? Math.round(l.qty / kgPer) : Math.round(l.qty)
      const state: LineState = got === expected ? 'Agreed' : got < expected ? 'Short Loaded' : 'Over Loaded'
      return {
        code: l.code, name: l.name, billedQty: l.qty, unit: l.unit,
        expected, loaded: got, state, kgPer, rate: l.rate,
      }
    })

    // Anything still left in the map was on the lorry but not on the bill.
    const extras = [...scanned.entries()].map(([code, got]) => {
      const p = P.find(x => x.code.toUpperCase() === code)
      return {
        code, name: p?.name ?? 'Unknown item — not in the catalogue',
        billedQty: 0, unit: p?.unit ?? 'nos', expected: 0, loaded: got,
        state: 'Not On Bill' as LineState, kgPer: p?.kgPerLength ?? 0, rate: p?.ratePerKg ?? 0,
      }
    })

    const all = [...lines, ...extras]
    const billedKg = +lines.reduce((s, l) => s + l.expected * l.kgPer, 0).toFixed(1)
    const loadedKg = +all.reduce((s, l) => s + l.loaded * l.kgPer, 0).toFixed(1)
    const bridge = Number(weighbridge) || 0
    const bridgeGap = bridge > 0 ? +(bridge - loadedKg).toFixed(1) : 0
    const bridgeOk = bridge === 0 || Math.abs(bridgeGap) <= Math.max(loadedKg * WEIGHT_TOLERANCE, 5)

    const problems = all.filter(l => l.state !== 'Agreed')
    const extraValue = extras.reduce((s, l) => s + l.loaded * l.kgPer * l.rate, 0)
    const billedPcs = lines.reduce((s, l) => s + l.expected, 0)

    return { all, problems, extras, billedPcs, billedKg, loadedKg, bridge, bridgeGap, bridgeOk, extraValue,
             clean: problems.length === 0 && bridgeOk && scans.length > 0 }
  }, [bill, scans, weighbridge])

  const reset = () => { setScans([]); setWeighbridge(''); setReleased(null); setReason('') }

  const badgeFor = (s: LineState) =>
    s === 'Agreed' ? 'badge-green' : s === 'Short Loaded' ? 'badge-yellow'
    : s === 'Over Loaded' ? 'badge-red' : 'badge-purple'

  return (
    <div>
      <PageHead title="Gate Verification"
        sub="Every bundle is scanned as it is loaded and matched against the bill before the vehicle is let out">
        <Select value={billNo} onChange={v => { setBillNo(v); reset() }} options={ready.map(b => b.no)} className="min-w-[13rem]" />
        <Select value={gate} onChange={setGate} options={GATES.map(g => g.id)} />
        <button className="btn-outline" onClick={reset}>Start again</button>
      </PageHead>

      {!bill ? <Empty msg="Choose a bill to verify" /> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
            <Stat label="Billed" value={`${check!.billedPcs} pcs`} icon={Truck} tone="brand"
              sub={`${bill.lines.length} lines · ${kg(check!.billedKg)}`} />
            <Stat label="Scanned at Gate" value={`${scans.length} pcs`} icon={ScanBarcode}
              tone="sky" sub={kg(check!.loadedKg)} />
            <Stat label="Problems" value={String(check!.problems.length)} icon={ShieldAlert}
              tone={check!.problems.length ? 'red' : scans.length ? 'green' : 'sky'}
              sub={check!.problems.length ? 'Lines that do not agree' : scans.length ? 'Everything tallies' : 'Nothing scanned yet'} />
            <Stat label="Gate" value={check!.clean ? 'May Release' : 'Held'} icon={check!.clean ? Unlock : Lock}
              tone={check!.clean ? 'green' : 'red'}
              sub={released ? `Released ${released.at}` : check!.clean ? 'Bill and load agree' : 'Vehicle must not leave'} />
          </div>

          {/* ── Extra material — the case the client asked about ───────── */}
          {check!.extras.length > 0 && (
            <div className="card mb-5" style={{ borderColor: 'var(--red)' }}>
              <p className="section-title text-base mb-1 flex items-center gap-2">
                <ShieldAlert size={15} style={{ color: 'var(--red)' }} /> On the Lorry, Not on the Bill
              </p>
              <p className="section-sub mb-3">
                These were scanned into the load but no line of {bill.no} covers them. Worth {inr(Math.round(check!.extraValue))} at
                today's rate.
              </p>
              <div className="space-y-2">
                {check!.extras.map(e => (
                  <div key={e.code} className="rounded-lg p-3 flex flex-wrap items-center justify-between gap-3"
                    style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                    <span className="min-w-0">
                      <span className="text-sm font-medium block truncate" style={{ color: 'var(--text-1)' }}>{e.name}</span>
                      <span className="text-[11px] font-mono" style={{ color: 'var(--text-4)' }}>{e.code}</span>
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span className="tabular-nums text-sm" style={{ color: 'var(--text-2)' }}>{e.loaded} pcs</span>
                      <span className="tabular-nums font-semibold" style={{ color: 'var(--red)' }}>
                        {inr(Math.round(e.loaded * e.kgPer * e.rate))}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            {/* ── Scanning ─────────────────────────────────────────── */}
            <div className="card lg:col-span-2">
              <p className="section-title text-base mb-1">Scan Each Bundle as It Is Loaded</p>
              <p className="section-sub mb-3">
                The sticker on a bundle is printed when it is picked, so the scan says exactly which section went on the
                lorry. Sections are billed by weight, so the bill figure is turned into the number of pieces the gate
                should see. Click anywhere outside a box and scan, or type a code below.
              </p>
              <ManualScan onScan={code => setScans(s => [...s, { code: code.toUpperCase(), at: new Date().toLocaleTimeString('en-IN', { hour12: false }) }])} />

              <div className="mt-3 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-2)' }}>
                <p className="text-[10px] uppercase tracking-wide px-3 py-1.5"
                  style={{ color: 'var(--text-4)', background: 'var(--bg-card2)' }}>Last scans</p>
                <div className="max-h-28 overflow-y-auto">
                  {scans.length === 0
                    ? <p className="text-xs px-3 py-4 text-center" style={{ color: 'var(--text-4)' }}>Nothing scanned yet</p>
                    : [...scans].reverse().slice(0, 20).map((s, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1 text-xs"
                        style={{ borderTop: i ? '1px solid var(--border-2)' : undefined }}>
                        <span className="font-mono" style={{ color: 'var(--text-2)' }}>{s.code}</span>
                        <span className="tabular-nums" style={{ color: 'var(--text-4)' }}>{s.at}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* ── Weighbridge ──────────────────────────────────────── */}
            <div className="card">
              <p className="section-title text-base mb-1 flex items-center gap-2">
                <Scale size={15} className="text-brand" /> Weighbridge
              </p>
              <p className="section-sub mb-3">
                A second check that does not depend on anyone scanning honestly.
              </p>
              <label className="label">Net weight out (kg)</label>
              <input className="input tabular-nums text-right" value={weighbridge} placeholder={String(check!.loadedKg)}
                onChange={e => setWeighbridge(e.target.value)} />

              <div className="mt-3 space-y-1.5 text-xs">
                <Row k="Scanned load" v={kg(check!.loadedKg)} />
                <Row k="Weighbridge" v={check!.bridge ? kg(check!.bridge) : '—'} />
                <Row k="Difference" v={check!.bridge ? `${check!.bridgeGap > 0 ? '+' : ''}${check!.bridgeGap} kg` : '—'}
                  tone={check!.bridge ? (check!.bridgeOk ? 'green' : 'red') : undefined} />
              </div>
              {check!.bridge > 0 && !check!.bridgeOk && (
                <p className="text-[11px] mt-2 flex items-start gap-1.5" style={{ color: 'var(--red)' }}>
                  <CircleAlert size={12} className="mt-0.5 shrink-0" />
                  The lorry weighs more than what was scanned. Something is on board that nobody scanned.
                </p>
              )}
              <p className="text-[11px] mt-3 pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
                Allowance of {Math.round(WEIGHT_TOLERANCE * 100)}% for packing and rounding.
              </p>
            </div>
          </div>

          <p className="section-title text-base mb-1">Bill Against Load</p>
          <p className="section-sub mb-3">{bill.no} · {bill.clientName} · {fmtDate(bill.date)}</p>
          <TableCard maxH="24rem">
            <thead>
              <tr><th>Code</th><th>Section</th><th className="num">On Bill</th><th className="num">Loaded</th>
                <th className="num">Difference</th><th>Result</th></tr>
            </thead>
            <tbody>
              {check!.all.map(l => (
                <tr key={l.code}>
                  <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{l.code}</td>
                  <td className="text-xs max-w-[18rem] truncate" title={l.name}>{l.name}</td>
                  <td className="num tabular-nums text-xs">
                    {l.billedQty ? `${l.billedQty} ${l.unit}` : '—'}
                  </td>
                  <td className="num tabular-nums">{l.expected || '—'}</td>
                  <td className="num tabular-nums">{l.loaded || '—'}</td>
                  <td className={cn('num tabular-nums font-semibold')}
                    style={{ color: l.loaded === l.expected ? 'var(--text-4)' : 'var(--red)' }}>
                    {l.loaded === l.expected ? '—' : `${l.loaded > l.expected ? '+' : ''}${l.loaded - l.expected}`}
                  </td>
                  <td><span className={badgeFor(l.state)}>{l.state}</span></td>
                </tr>
              ))}
            </tbody>
          </TableCard>

          {/* ── Release ──────────────────────────────────────────────── */}
          <div className="card mt-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-2.5 min-w-0">
                {check!.clean
                  ? <ShieldCheck size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--green)' }} />
                  : <Lock size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--red)' }} />}
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                    {released ? 'Vehicle released'
                      : check!.clean ? 'Bill and load agree — vehicle may go'
                      : scans.length === 0 ? 'Scan the load before the vehicle moves'
                      : `${check!.problems.length} line${check!.problems.length === 1 ? '' : 's'} do not agree`}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>
                    {released
                      ? released.override
                        ? `Let out against the mismatch — ${released.override}`
                        : `Cleared at ${released.at}, ${GATES.find(g => g.id === gate)?.label}`
                      : 'A gate pass is written only after this screen clears'}
                  </p>
                </div>
              </div>

              {!released && (
                <span className="flex gap-2 shrink-0">
                  {!check!.clean && scans.length > 0 && (
                    <button className="btn-outline" onClick={() => setAskOverride(true)}>Let out anyway</button>
                  )}
                  <button className="btn" disabled={!check!.clean}
                    onClick={() => setReleased({ at: new Date().toLocaleTimeString('en-IN', { hour12: false }), override: '' })}>
                    <CheckCircle2 size={14} /> Release vehicle
                  </button>
                </span>
              )}
            </div>

            <p className="text-[11px] mt-4 pt-3 flex items-start gap-1.5" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
              <Video size={12} className="mt-0.5 shrink-0" />
              The camera at {GATES.find(g => g.id === gate)?.label} records against the same minute this screen is
              cleared, so the footage and the scan sit side by side if the load is ever questioned.
            </p>
          </div>

          <Modal open={askOverride} onClose={() => setAskOverride(false)} title="Let the vehicle out anyway?">
            <div className="space-y-4">
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                {check!.problems.length} line{check!.problems.length === 1 ? '' : 's'} do not agree with {bill.no}. The
                reason is kept against this dispatch and appears on the owner's exceptions list.
              </p>
              <div>
                <label className="label">Reason<span style={{ color: 'var(--red)' }}> *</span></label>
                <textarea className="input w-full min-h-[4.5rem]" value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Balance quantity to follow on the next trip — customer agreed on phone" />
              </div>
              <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--border-2)' }}>
                <button className="btn-outline" onClick={() => setAskOverride(false)}>Cancel</button>
                <button className="btn" disabled={!reason.trim()} style={{ background: 'var(--red)' }}
                  onClick={() => {
                    setReleased({ at: new Date().toLocaleTimeString('en-IN', { hour12: false }), override: reason.trim() })
                    setAskOverride(false)
                  }}>Let out and record the reason</button>
              </div>
            </div>
          </Modal>
        </>
      )}

      <p className="text-[11px] mt-5 leading-relaxed max-w-4xl" style={{ color: 'var(--text-4)' }}>
        A camera cannot tell one aluminium section from another, so it can never be what catches a wrong load. The scan
        at the gate is what catches it, and the weighbridge catches anything that was put on without being scanned. The
        footage is the proof afterwards. Together they cover both halves — material leaving with no bill at all, and a
        billed load carrying more than the bill says. {COMPANY.short} keeps the three of them tied to the same minute.
      </p>
    </div>
  )
}

function ManualScan({ onScan }: { onScan: (code: string) => void }) {
  const [code, setCode] = useState('')
  const fire = () => { if (code.trim()) { onScan(code.trim()); setCode('') } }
  return (
    <div className="flex gap-2">
      <input className="input flex-1 font-mono !text-xs" placeholder="VSA-SL-2T-OF" value={code}
        onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && fire()} />
      <button className="btn-outline shrink-0" disabled={!code.trim()} onClick={fire}>
        <ScanBarcode size={14} /> Scan
      </button>
    </div>
  )
}

const Row = ({ k, v, tone }: { k: string; v: string; tone?: string }) => (
  <div className="flex items-center justify-between">
    <span style={{ color: 'var(--text-3)' }}>{k}</span>
    <span className="tabular-nums font-medium"
      style={{ color: tone === 'green' ? 'var(--green)' : tone === 'red' ? 'var(--red)' : 'var(--text-1)' }}>{v}</span>
  </div>
)
