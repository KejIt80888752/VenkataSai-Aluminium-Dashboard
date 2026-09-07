import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Mic, MicOff, ScanBarcode, Trash2, Receipt, CircleAlert, Check, Volume2, Wallet,
  Search, ChevronUp, ChevronDown, TriangleAlert, PackageCheck,
} from 'lucide-react'
import { PageHead, Stat, Select, TableCard, Empty, Modal } from '@/components/ui'
import { P } from '@/data/catalogue'
import { CLIENTS } from '@/data/parties'
import { inr, inr2, kg, cn } from '@/lib/utils'
import { COMPANY } from '@/data/company'
import { parseSpoken } from '@/lib/speech'

/* Typing is the counter's first way in, so the search has to forgive how they
   type: no spaces, no dashes, no quote marks. "TBC3" must find TBC-3'. */
const loose = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/* A counter also drops whole words — "2trackshutter" for "2 Track Sliding
   Shutter". So the letters only have to appear in order, not together. */
function inOrder(hay: string, needle: string) {
  let i = 0
  for (const ch of hay) { if (ch === needle[i]) i++; if (i === needle.length) return true }
  return needle.length === 0
}

/** 0 = no match; lower is a better match. */
function score(p: { code: string; name: string; brand: string; series: string }, n: string) {
  const code = loose(p.code), name = loose(p.name)
  if (code === n) return 1
  if (code.includes(n)) return 2
  if (name.startsWith(n)) return 3
  if (name.includes(n)) return 4
  if (loose(p.brand).includes(n) || loose(p.series).includes(n)) return 5
  if (inOrder(name, n)) return 6
  if (inOrder(code, n)) return 7
  return 0
}

/* Aluminium sections come first on a bill, the way the counter writes it. */
const ALU_FIRST = ['Sliding Sections', 'Openable Sections', 'Partition Sections']
const isAlu = (cat: string) => ALU_FIRST.includes(cat)

/* ── Scanners ──────────────────────────────────────────────────────────────
   A barcode scanner is a keyboard that types very fast and finishes with
   Enter. To tell several of them apart on one bill, each is programmed with
   its own prefix in its own setup sheet; we read that prefix off the front
   of the scan.                                                             */

const SCANNERS = [
  { id: 'S1', prefix: 'S1', label: 'Counter — front desk', tone: 'brand' },
  { id: 'S2', prefix: 'S2', label: 'Godown 1 — loading bay', tone: 'violet' },
  { id: 'S3', prefix: 'S3', label: 'Godown 2 — 4th floor', tone: 'sky' },
] as const

const CHAR_GAP_MS = 40   // a human cannot type this fast; a scanner always does

interface BillLine {
  key: string
  code: string
  name: string
  category: string
  pcs: number
  ratePerKg: number
  kgPerLength: number
  gst: number
  via: string
  /** ticked off as it goes in the box, the way a manual bill is ticked */
  packed: boolean
  /** what the scale said, when the counter weighs instead of counting */
  weighedKg: number | null
}

export default function QuickBill() {
  const [lines, setLines] = useState<BillLine[]>([])
  const [customer, setCustomer] = useState(CLIENTS[0].name)
  const [remarks, setRemarks] = useState('Siva Reddy — sales bill')
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState('')
  const [voiceMsg, setVoiceMsg] = useState('')
  const [scanLog, setScanLog] = useState<{ scanner: string; code: string; ok: boolean; at: string }[]>([])
  const [done, setDone] = useState(false)
  /* Payment is taken on the same screen as the bill — there is no second
     place to go looking for a receipt. */
  const [mode, setMode] = useState('Credit')
  const [paidNow, setPaidNow] = useState('')
  const [find, setFind] = useState('')

  /* Type-to-add: the way most bills will actually be entered. */
  const matches = useMemo(() => {
    const n = loose(find)
    if (n.length < 2) return []
    return P.map(p => ({ p, s: score(p, n) }))
      .filter(x => x.s > 0)
      .sort((a, b) => a.s - b.s || a.p.name.localeCompare(b.p.name))
      .slice(0, 8)
      .map(x => x.p)
  }, [find])

  const move = (key: string, dir: -1 | 1) => setLines(ls => {
    const i = ls.findIndex(l => l.key === key)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ls.length) return ls
    const next = [...ls]; [next[i], next[j]] = [next[j], next[i]]; return next
  })

  const addLine = (code: string, pcs: number, via: string) => {
    const p = P.find(x => x.code.toUpperCase() === code.toUpperCase())
    if (!p) return false
    setLines(ls => {
      const hit = ls.find(l => l.code === p.code)
      if (hit) return ls.map(l => l.code === p.code ? { ...l, pcs: l.pcs + pcs } : l)
      const line: BillLine = {
        key: `${p.code}-${Date.now()}`, code: p.code, name: p.name, category: p.category, pcs,
        ratePerKg: p.ratePerKg, kgPerLength: p.kgPerLength, gst: p.gst, via, packed: false, weighedKg: null,
      }
      // Aluminium sits above everything else unless the counter moves it.
      if (!isAlu(p.category)) return [...ls, line]
      const lastAlu = ls.reduce((n, l, i) => isAlu(l.category) ? i + 1 : n, 0)
      return [...ls.slice(0, lastAlu), line, ...ls.slice(lastAlu)]
    })
    return true
  }

  /* ── Multiple scanners feeding one bill ─────────────────────────────── */
  const buf = useRef({ text: '', last: 0 })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      // A scan is not meant for a field the operator is typing in.
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return

      const now = Date.now()
      if (now - buf.current.last > CHAR_GAP_MS) buf.current.text = ''
      buf.current.last = now

      if (e.key === 'Enter') {
        const raw = buf.current.text.trim()
        buf.current.text = ''
        if (raw.length < 3) return
        const m = raw.match(/^(S[123])[|:-]?(.+)$/i)
        const scanner = m ? m[1].toUpperCase() : 'S1'
        const code = (m ? m[2] : raw).trim()
        const ok = addLine(code, 1, scanner)
        setScanLog(l => [{ scanner, code, ok, at: new Date().toLocaleTimeString('en-IN', { hour12: false }) }, ...l].slice(0, 12))
        return
      }
      if (e.key.length === 1) buf.current.text += e.key
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ── Voice ──────────────────────────────────────────────────────────── */
  const recog = useRef<any>(null)

  const startVoice = () => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) {
      setVoiceMsg('This browser cannot listen. Chrome or Edge on the billing machine will work.')
      return
    }
    const r = new SR()
    r.lang = 'en-IN'; r.continuous = true; r.interimResults = true
    r.onresult = (ev: any) => {
      let finalText = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript
        if (ev.results[i].isFinal) finalText += t; else setHeard(t)
      }
      if (finalText) { setHeard(finalText); handleSpoken(finalText) }
    }
    r.onerror = (ev: any) => setVoiceMsg(
      ev.error === 'not-allowed' ? 'Microphone permission was refused. Allow it in the browser and try again.'
      : `Could not listen — ${ev.error}.`)
    r.onend = () => setListening(false)
    r.start(); recog.current = r; setListening(true); setVoiceMsg('')
  }

  const stopVoice = () => { recog.current?.stop(); setListening(false) }

  const handleSpoken = (text: string) => {
    const parsed = parseSpoken(text)
    if (!parsed) { setVoiceMsg(`Could not place "${text}". Say it as: twenty of two track outer frame.`); return }
    const ok = addLine(parsed.code, parsed.pcs, 'Voice')
    setVoiceMsg(ok ? '' : `Heard "${text}" but no matching section.`)
  }

  const totals = useMemo(() => {
    const rows = lines.map(l => {
      // What these pieces ought to weigh, from the section's own standard.
      const expectedKg = +(l.pcs * l.kgPerLength).toFixed(2)
      const kgs = l.weighedKg !== null ? l.weighedKg : expectedKg
      const gapPct = expectedKg > 0 ? +(((kgs - expectedKg) / expectedKg) * 100).toFixed(1) : 0
      const amount = +(kgs * l.ratePerKg).toFixed(2)
      return { ...l, expectedKg, kgs, gapPct, amount, tax: +(amount * l.gst / 100).toFixed(2) }
    })
    const taxable = +rows.reduce((s, r) => s + r.amount, 0).toFixed(2)
    const tax = +rows.reduce((s, r) => s + r.tax, 0).toFixed(2)
    // More than 4% light is not packing tolerance — it is the wrong section or
    // a weight nobody checked.
    const light = rows.filter(r => r.gapPct < -4)
    const shortKg = +light.reduce((s, r) => s + (r.expectedKg - r.kgs), 0).toFixed(2)
    return {
      rows, taxable, tax, total: Math.round(taxable + tax),
      light, shortKg, shortValue: Math.round(light.reduce((s, r) => s + (r.expectedKg - r.kgs) * r.ratePerKg, 0)),
    }
  }, [lines])

  const received = Math.min(Number(paidNow) || 0, totals.total)
  const balance  = totals.total - received
  const payStatus = balance <= 0 ? 'Paid' : received > 0 ? 'Partial' : 'Unpaid'

  return (
    <div>
      <PageHead title="Quick Bill"
        sub="Speak the items, or let two or three scanners load the same bill at once">
        <Select value={customer} onChange={setCustomer} options={CLIENTS.map(c => c.name)} className="min-w-[18rem]" />
        <button className="btn" disabled={!lines.length} onClick={() => setDone(true)}>
          <Receipt size={14} /> Raise Bill
        </button>
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Lines on Bill" value={String(lines.length)} icon={PackageCheck} tone="brand"
          sub={lines.length
            ? `${lines.filter(l => l.packed).length} of ${lines.length} packed · ${lines.reduce((s, l) => s + l.pcs, 0)} pieces`
            : 'Nothing added yet'} />
        <Stat label="Taxable" value={inr(totals.taxable)} icon={Receipt} tone="violet" sub="Before GST" />
        <Stat label="GST" value={inr(totals.tax)} icon={CircleAlert} tone="sky" sub="At each item's own rate" />
        <Stat label="Bill Total" value={inr(totals.total)} icon={Check} tone="green" sub="Rounded" />
      </div>

      {/* ── Typing — the counter's first way in ────────────────────── */}
      <div className="card mb-4">
        <p className="section-title text-base mb-1 flex items-center gap-2">
          <Search size={15} className="text-brand" /> Type the Item
        </p>
        <p className="section-sub mb-3">
          Spaces, dashes and quote marks are ignored — type <span className="font-mono">TBC3</span> and
          TBC-3′ comes up. Code, name or brand all work.
        </p>
        <input className="input w-full" value={find} onChange={e => setFind(e.target.value)}
          placeholder="TBC3, 2 track shutter, jindal…" />

        {matches.length > 0 && (
          <div className="mt-2 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-2)' }}>
            {matches.map((p, i) => (
              <button key={p.code} onClick={() => { addLine(p.code, 1, 'Typed'); setFind('') }}
                className="w-full text-left px-3 py-2 flex items-center justify-between gap-3 transition-colors hover:brightness-95"
                style={{ background: 'var(--bg-card2)', borderTop: i ? '1px solid var(--border-2)' : undefined }}>
                <span className="min-w-0">
                  <span className="text-sm block truncate" style={{ color: 'var(--text-1)' }}>{p.name}</span>
                  <span className="text-[11px] font-mono" style={{ color: 'var(--text-4)' }}>
                    {p.code} · {p.brand} · {p.stockPcs} pcs on hand
                  </span>
                </span>
                <span className="tabular-nums text-xs shrink-0" style={{ color: 'var(--text-2)' }}>
                  {inr2(p.ratePerKg)}/{p.unit}
                </span>
              </button>
            ))}
          </div>
        )}
        {find.length >= 2 && matches.length === 0 && (
          <p className="text-[11px] mt-2" style={{ color: 'var(--text-4)' }}>Nothing found for “{find}”.</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* ── Voice ─────────────────────────────────────────────────── */}
        <div className="card">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="section-title text-base mb-1">Speak the Items</p>
              <p className="section-sub">
                Say the count and the section — "twenty of two track outer frame". Numbers in words or digits both work.
              </p>
            </div>
            <button className={cn(listening ? 'btn' : 'btn-outline', 'shrink-0')}
              onClick={listening ? stopVoice : startVoice}>
              {listening ? <><MicOff size={14} /> Stop</> : <><Mic size={14} /> Start</>}
            </button>
          </div>

          <div className="rounded-lg p-3 min-h-[4.5rem] flex items-center gap-2"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
            {listening && <Volume2 size={15} className="text-brand shrink-0 animate-pulse" />}
            <p className="text-sm" style={{ color: heard ? 'var(--text-1)' : 'var(--text-4)' }}>
              {heard || (listening ? 'Listening…' : 'Press start, then speak')}
            </p>
          </div>

          {voiceMsg && (
            <p className="text-[11px] mt-2 flex items-start gap-1.5" style={{ color: 'var(--red)' }}>
              <CircleAlert size={12} className="mt-0.5 shrink-0" /> {voiceMsg}
            </p>
          )}

          <p className="text-[11px] mt-3 pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
            The speech goes through the browser's own recogniser. Every line it adds is shown below and can be corrected
            by hand before the bill is raised — nothing is billed on the strength of the microphone alone.
          </p>
        </div>

        {/* ── Scanners ──────────────────────────────────────────────── */}
        <div className="card">
          <p className="section-title text-base mb-1">Scanners on This Bill</p>
          <p className="section-sub mb-3">
            Each scanner is programmed with its own prefix, so the bill knows which counter a scan came from. All three
            can fire at the same time.
          </p>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {SCANNERS.map(s => {
              const n = lines.filter(l => l.via === s.id).reduce((a, l) => a + l.pcs, 0)
              return (
                <div key={s.id} className="rounded-lg p-2.5 text-center"
                  style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                  <ScanBarcode size={15} className="mx-auto mb-1" style={{ color: 'var(--text-4)' }} />
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{s.prefix}</p>
                  <p className="text-lg font-bold tabular-nums" style={{ color: n ? 'var(--brand)' : 'var(--text-4)' }}>{n}</p>
                  <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--text-4)' }}>{s.label}</p>
                </div>
              )
            })}
          </div>

          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-2)' }}>
            <p className="text-[10px] uppercase tracking-wide px-3 py-1.5"
              style={{ color: 'var(--text-4)', background: 'var(--bg-card2)' }}>Last scans</p>
            <div className="max-h-32 overflow-y-auto">
              {scanLog.length === 0 ? (
                <p className="text-xs px-3 py-4 text-center" style={{ color: 'var(--text-4)' }}>
                  Nothing scanned yet — click anywhere outside a field and scan
                </p>
              ) : scanLog.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
                  style={{ borderTop: i ? '1px solid var(--border-2)' : undefined }}>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="badge-gray shrink-0">{s.scanner}</span>
                    <span className="font-mono truncate" style={{ color: 'var(--text-2)' }}>{s.code}</span>
                  </span>
                  <span className="shrink-0" style={{ color: s.ok ? 'var(--green)' : 'var(--red)' }}>
                    {s.ok ? 'added' : 'unknown code'}
                  </span>
                  <span className="shrink-0 tabular-nums" style={{ color: 'var(--text-4)' }}>{s.at}</span>
                </div>
              ))}
            </div>
          </div>

          <details className="mt-3">
            <summary className="text-[11px] cursor-pointer" style={{ color: 'var(--text-4)' }}>Try it without a scanner</summary>
            <ManualScan onScan={(scanner, code) => {
              const ok = addLine(code, 1, scanner)
              setScanLog(l => [{ scanner, code, ok, at: new Date().toLocaleTimeString('en-IN', { hour12: false }) }, ...l].slice(0, 12))
            }} />
          </details>
        </div>
      </div>

      {totals.light.length > 0 && (
        <div className="card mb-4" style={{ borderColor: 'var(--red)' }}>
          <p className="section-title text-base mb-1 flex items-center gap-2">
            <TriangleAlert size={15} style={{ color: 'var(--red)' }} /> Weighed Light on
            {' '}{totals.light.length} {totals.light.length === 1 ? 'Line' : 'Lines'}
          </p>
          <p className="section-sub mb-3">
            The scale is reading less than these sections ought to weigh. Either a lighter section went in
            the bundle, or the weight is short by {kg(totals.shortKg)} — worth {inr(totals.shortValue)} on
            this bill alone.
          </p>
          <div className="space-y-1.5">
            {totals.light.map(l => (
              <div key={l.key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2"
                style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <span className="text-sm min-w-0 truncate" style={{ color: 'var(--text-1)' }}>{l.name}</span>
                <span className="text-xs tabular-nums shrink-0" style={{ color: 'var(--text-3)' }}>
                  {l.pcs} pcs should weigh {kg(l.expectedKg)} · scale says {kg(l.kgs)}
                  <span className="font-semibold ml-2" style={{ color: 'var(--red)' }}>{l.gapPct}%</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <p className="section-title text-base mb-1">Bill Lines</p>
          <p className="section-sub">Correct anything before raising the bill</p>
        </div>
        <div className="min-w-[18rem]">
          <label className="label">Remarks on this bill</label>
          <input className="input" value={remarks} onChange={e => setRemarks(e.target.value)}
            placeholder="Salesman name, site, anything to search on later" />
        </div>
      </div>

      <TableCard maxH="24rem">
        <thead>
          <tr><th className="text-center">Packed</th><th>Code</th><th>Section</th><th>Added By</th>
            <th className="num">Pieces</th><th className="num">Should Weigh</th><th className="num">Weighed</th>
            <th className="num">Rate/Kg</th><th className="num">Amount</th><th>Order</th><th /></tr>
        </thead>
        <tbody>
          {totals.rows.map(l => (
            <tr key={l.key} style={l.packed ? { background: 'color-mix(in srgb, var(--green) 7%, transparent)' } : undefined}>
              <td className="text-center">
                <input type="checkbox" className="accent-[var(--brand)] cursor-pointer" checked={l.packed}
                  title="Tick as it goes in the box"
                  onChange={() => setLines(ls => ls.map(x => x.key === l.key ? { ...x, packed: !x.packed } : x))} />
              </td>
              <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{l.code}</td>
              <td className="text-xs max-w-[16rem] truncate" title={l.name}>{l.name}</td>
              <td><span className={l.via === 'Voice' ? 'badge-purple' : l.via === 'Typed' ? 'badge-gray' : 'badge-blue'}>{l.via}</span></td>
              <td className="num">
                <input type="number" min={1} className="input !w-20 !py-1 text-right tabular-nums !text-xs"
                  value={l.pcs}
                  onChange={e => setLines(ls => ls.map(x => x.key === l.key ? { ...x, pcs: Math.max(1, Number(e.target.value)) } : x))} />
              </td>
              <td className="num tabular-nums text-xs">{l.expectedKg}</td>
              <td className="num">
                <input className="input !w-24 !py-1 text-right tabular-nums !text-xs"
                  value={l.weighedKg ?? ''} placeholder={String(l.expectedKg)}
                  style={l.gapPct < -4 ? { borderColor: 'var(--red)', color: 'var(--red)' } : undefined}
                  onChange={e => {
                    const v = e.target.value.trim()
                    setLines(ls => ls.map(x => x.key === l.key ? { ...x, weighedKg: v === '' ? null : Number(v) } : x))
                  }} />
              </td>
              <td className="num tabular-nums text-xs">{inr2(l.ratePerKg)}</td>
              <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{inr2(l.amount)}</td>
              <td>
                <span className="flex gap-0.5">
                  <button className="btn-ghost !px-1 !py-0.5" title="Move up" onClick={() => move(l.key, -1)}>
                    <ChevronUp size={13} />
                  </button>
                  <button className="btn-ghost !px-1 !py-0.5" title="Move down" onClick={() => move(l.key, 1)}>
                    <ChevronDown size={13} />
                  </button>
                </span>
              </td>
              <td>
                <button className="btn-ghost !px-2 !py-1" onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))}>
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
          {lines.length === 0 && <tr><td colSpan={11}><Empty msg="Type, speak or scan to start the bill" /></td></tr>}
        </tbody>
      </TableCard>

      <Modal open={done} onClose={() => setDone(false)} title="Bill ready to raise">
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <F k="Customer" v={customer} />
            <F k="Lines" v={`${lines.length} · ${lines.reduce((s, l) => s + l.pcs, 0)} pieces`} />
            <F k="Taxable" v={inr(totals.taxable)} />
            <F k="GST" v={inr(totals.tax)} />
            <F k="Remarks" v={remarks || '—'} />
            <F k="Bill total" v={inr(totals.total)} />
          </dl>

          {/* ── Receipt, on the same screen as the bill ─────────────── */}
          <div className="rounded-lg p-3.5" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-2.5 flex items-center gap-1.5"
              style={{ color: 'var(--text-4)' }}>
              <Wallet size={12} /> Payment taken now
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">How it was paid</label>
                <select className="input w-full" value={mode} onChange={e => setMode(e.target.value)}>
                  {['Credit', 'Cash', 'UPI', 'Card / POS', 'NEFT / RTGS', 'Cheque'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Amount received</label>
                <input className="input tabular-nums text-right" value={paidNow} placeholder="0"
                  onChange={e => setPaidNow(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-2.5">
              <button className="btn-ghost !py-1 !text-[11px]" onClick={() => setPaidNow(String(totals.total))}>
                Full {inr(totals.total)}
              </button>
              <button className="btn-ghost !py-1 !text-[11px]" onClick={() => setPaidNow('')}>Nothing now</button>
            </div>

            <div className="flex items-center justify-between gap-3 mt-3 pt-2.5" style={{ borderTop: '1px solid var(--border-2)' }}>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                Balance after this receipt
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums font-semibold text-sm" style={{ color: balance > 0 ? 'var(--red)' : 'var(--green)' }}>
                  {inr(balance)}
                </span>
                <span className={payStatus === 'Paid' ? 'badge-green' : payStatus === 'Partial' ? 'badge-yellow' : 'badge-red'}>
                  {payStatus}
                </span>
              </span>
            </div>
          </div>
          <p className="text-[11px] pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
            On the live system this posts a GST tax invoice for {COMPANY.name}, reduces stock at the counter it was
            scanned from, records the {inr(received)} receipt against it, and files the remark so the bill can be
            pulled up by salesman later.{' '}
            {mode === 'UPI' && 'A UPI code carrying this bill number can be shown from the Payments screen, and the bill closes itself the moment the money lands.'}
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setDone(false)}>Back</button>
            <button className="btn" onClick={() => { setLines([]); setScanLog([]); setHeard(''); setPaidNow(''); setMode('Credit'); setDone(false) }}>
              <Check size={14} /> Post and start a new bill
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ManualScan({ onScan }: { onScan: (scanner: string, code: string) => void }) {
  const [scanner, setScanner] = useState('S1')
  const [code, setCode] = useState('')
  return (
    <div className="flex gap-2 mt-2">
      <Select value={scanner} onChange={setScanner} options={SCANNERS.map(s => s.id)} className="!min-w-0 !w-20" />
      <input className="input flex-1 font-mono !text-xs" placeholder="VSA-SL-2T-OF" value={code}
        onChange={e => setCode(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && code.trim()) { onScan(scanner, code.trim()); setCode('') } }} />
      <button className="btn-outline shrink-0" disabled={!code.trim()}
        onClick={() => { onScan(scanner, code.trim()); setCode('') }}>Scan</button>
    </div>
  )
}

const F = ({ k, v }: { k: string; v: string }) => (
  <div><dt className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{k}</dt>
    <dd className="mt-0.5" style={{ color: 'var(--text-1)' }}>{v}</dd></div>
)
