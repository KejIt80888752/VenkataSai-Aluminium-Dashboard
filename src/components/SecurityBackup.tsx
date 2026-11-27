import { useState, useEffect, useRef } from 'react'
import {
  Fingerprint, ShieldCheck, DatabaseBackup, Gauge, Download, FileLock2, CheckCircle2, CircleAlert, Clock,
  Upload, RotateCcw, HardDriveDownload,
} from 'lucide-react'
import { COMPANY } from '@/data/company'
import { cn } from '@/lib/utils'
import {
  collect, sizeOf, snapshots, takeSnapshot, putBack, downloadBackup, readBackup, whenOf, kb,
  type Snapshot,
} from '@/lib/backup'
import { Modal } from '@/components/ui'

export default function SecurityBackup() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Biometric />
      <Backups />
      <Speed />
      <Nda />
    </div>
  )
}

/* ── 1. Fingerprint on the billing machine ─────────────────────────────── */
function Biometric() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [enrolled, setEnrolled] = useState<string | null>(() => localStorage.getItem('vsa-bio-user'))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [who, setWho] = useState('Kavya M — Counter Billing')

  useEffect(() => {
    const pkc = (window as any).PublicKeyCredential
    if (!pkc?.isUserVerifyingPlatformAuthenticatorAvailable) { setSupported(false); return }
    pkc.isUserVerifyingPlatformAuthenticatorAvailable().then(setSupported).catch(() => setSupported(false))
  }, [])

  const enrol = async () => {
    setBusy(true); setMsg('')
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32))
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: COMPANY.short },
          user: { id: crypto.getRandomValues(new Uint8Array(16)), name: who, displayName: who },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60000,
        },
      })
      if (cred) { localStorage.setItem('vsa-bio-user', who); setEnrolled(who); setMsg('') }
    } catch (e: any) {
      setMsg(e?.name === 'NotAllowedError' ? 'Cancelled at the fingerprint prompt.' : `Could not enrol — ${e?.message ?? e}`)
    } finally { setBusy(false) }
  }

  const forget = () => { localStorage.removeItem('vsa-bio-user'); setEnrolled(null); setMsg('') }

  return (
    <div className="card">
      <p className="section-title text-base mb-1 flex items-center gap-2">
        <Fingerprint size={16} className="text-brand" /> Fingerprint on the Billing Machine
      </p>
      <p className="section-sub mb-4">
        Every bill carries the name of the person who raised it. A fingerprint at the counter makes that name something
        nobody can borrow.
      </p>

      {supported === null ? (
        <p className="text-sm" style={{ color: 'var(--text-4)' }}>Checking this machine…</p>
      ) : supported === false ? (
        <div className="rounded-lg p-3 text-xs leading-relaxed"
          style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)', color: 'var(--text-3)' }}>
          This machine has no fingerprint reader the browser can use. A USB fingerprint reader on the billing
          counter, or a laptop with a built-in one, will turn this on.
        </div>
      ) : enrolled ? (
        <div className="rounded-lg p-3 flex items-center justify-between gap-3"
          style={{ background: 'var(--bg-card2)', border: '1px solid var(--green)' }}>
          <span className="flex items-center gap-2 min-w-0">
            <CheckCircle2 size={16} style={{ color: 'var(--green)' }} className="shrink-0" />
            <span className="min-w-0">
              <span className="text-sm font-medium block truncate" style={{ color: 'var(--text-1)' }}>{enrolled}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>Enrolled on this machine</span>
            </span>
          </span>
          <button className="btn-ghost !text-xs shrink-0" onClick={forget}>Remove</button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="label">Who bills on this machine</label>
            <input className="input" value={who} onChange={e => setWho(e.target.value)} />
          </div>
          <button className="btn w-full" disabled={busy} onClick={enrol}>
            <Fingerprint size={14} /> {busy ? 'Touch the reader…' : 'Enrol fingerprint'}
          </button>
        </div>
      )}

      {msg && <p className="text-[11px] mt-2 flex items-start gap-1.5" style={{ color: 'var(--red)' }}>
        <CircleAlert size={12} className="mt-0.5 shrink-0" /> {msg}</p>}

      <p className="text-[11px] mt-4 pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
        The fingerprint itself never leaves the machine — the reader keeps it and only answers yes or no. On the live
        system that answer is checked by the server before a bill can be saved.
      </p>
    </div>
  )
}

/* ── 2. A copy of the day's work, that can be carried out and brought back ─
   Theirs, on 27-11: "that estimate is lost, again we have to redo."

   This card used to show a nightly backup that nothing was taking, and its
   button wrote out a file holding the company name and no records at all.
   It now reads the registers themselves. The copies listed are the ones on
   this machine, with the hour each was taken, and any of them can be put
   back. The file is the one to keep off the machine.                       */
function Backups() {
  const [snaps, setSnaps] = useState<Snapshot[]>(() => snapshots())
  const [now, setNow] = useState(() => { const d = collect(); return { keys: Object.keys(d).length, bytes: sizeOf(d) } })
  const [msg, setMsg] = useState('')
  const [putting, setPutting] = useState<{ when: string; data: Record<string, string>; keys: number } | null>(null)
  const pick = useRef<HTMLInputElement>(null)

  const refresh = () => {
    setSnaps(snapshots())
    const d = collect(); setNow({ keys: Object.keys(d).length, bytes: sizeOf(d) })
  }

  const copyNow = () => {
    const s = takeSnapshot('taken by hand')
    refresh()
    setMsg(s ? `Copy kept on this machine at ${whenOf(s.at)}.` : 'No room on this machine for another copy.')
  }

  const toFile = () => {
    const f = downloadBackup()
    setMsg(`${f.keys} registers written out. Keep the file somewhere other than this machine.`)
  }

  const fromFile = (file: File) => {
    const r = new FileReader()
    r.onload = () => {
      const read = readBackup(String(r.result ?? ''))
      if (!read) { setMsg('That file is not one of ours — nothing was changed.'); return }
      setPutting({
        when: read.takenAt ? whenOf(read.takenAt) : file.name,
        data: read.data, keys: Object.keys(read.data).length,
      })
    }
    r.readAsText(file)
  }

  const confirmPutBack = () => {
    if (!putting) return
    const n = putBack(putting.data)
    setPutting(null)
    /* The screens are already holding what was there a moment ago, so the
       page is read again rather than asking each one to notice. */
    setMsg(`${n} registers put back. Reopening…`)
    setTimeout(() => window.location.reload(), 600)
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="section-title text-base flex items-center gap-2">
          <DatabaseBackup size={16} className="text-brand" /> Your Work, Kept
        </p>
        <span className="flex gap-2 shrink-0">
          <button className="btn-outline !py-1 !text-xs" onClick={copyNow} title="Keep a copy on this machine now">
            <HardDriveDownload size={13} /> Copy now
          </button>
          <button className="btn !py-1 !text-xs" onClick={toFile} title="Write every register out to one file">
            <Download size={13} /> Save to file
          </button>
        </span>
      </div>
      <p className="section-sub mb-4">
        A copy is kept here each day, and again before anything is deleted or Undo all is pressed on a register.
        Any copy below can be put back. The file keeps the work safe if something happens to this machine.
      </p>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <Tile k="Registers written" v={String(now.keys)} tone="brand" />
        <Tile k="Size now" v={kb(now.bytes)} tone="brand" />
        <Tile k="Copies kept here" v={String(snaps.length)} tone={snaps.length ? 'green' : 'red'} />
      </div>

      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-2)' }}>
        <div className="max-h-44 overflow-y-auto">
          {snaps.length === 0 ? (
            <p className="px-3 py-4 text-xs" style={{ color: 'var(--text-4)' }}>
              No copy yet on this machine. Press <b>Copy now</b> — then <b>Save to file</b> and keep that file
              somewhere else.
            </p>
          ) : snaps.map((d, i) => (
            <div key={d.at} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
              style={{ borderTop: i ? '1px solid var(--border-2)' : undefined }}>
              <span className="flex items-center gap-2 min-w-0">
                <CheckCircle2 size={13} style={{ color: 'var(--green)' }} className="shrink-0" />
                <span className="tabular-nums shrink-0" style={{ color: 'var(--text-2)' }}>{whenOf(d.at)}</span>
                <span className="truncate" style={{ color: 'var(--text-4)' }}>{d.why}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="tabular-nums" style={{ color: 'var(--text-3)' }}>{d.keys} · {kb(d.bytes)}</span>
                <button className="btn-ghost !px-1.5 !py-0.5 !text-[11px]"
                  onClick={() => setPutting({ when: whenOf(d.at), data: d.data, keys: d.keys })}>
                  <RotateCcw size={12} /> Put back
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-2)' }}>
        <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>
          Have a file from another machine or an earlier day? Put it back here.
        </p>
        <button className="btn-outline !py-1 !text-xs shrink-0" onClick={() => pick.current?.click()}>
          <Upload size={13} /> Put a file back
        </button>
        <input ref={pick} type="file" accept=".json,application/json" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) fromFile(f); e.target.value = '' }} />
      </div>

      {msg && <p className="text-[11px] mt-2" style={{ color: 'var(--text-3)' }}>{msg}</p>}

      <Modal open={!!putting} onClose={() => setPutting(null)} title="Put this copy back?">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            The registers go back to how they stood on <b>{putting?.when}</b> — {putting?.keys} of them.
            Anything written since then is replaced.
          </p>
          <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>
            A copy of the registers as they stand now is kept first, so this can be undone the same way.
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setPutting(null)}>Leave it</button>
            <button className="btn" onClick={confirmPutBack}><RotateCcw size={14} /> Put it back</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ── 3. Speed, measured rather than claimed ────────────────────────────── */
function Speed() {
  const [m, setM] = useState<{ load: number; dom: number; paint: number | null } | null>(null)

  useEffect(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const fcp = performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint')
    if (nav) setM({
      load: Math.round(nav.loadEventEnd - nav.startTime),
      dom: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      // Not every browser records the paint; better to say nothing than zero.
      paint: fcp ? Math.round(fcp.startTime) : null,
    })
  }, [])

  const rate = (ms: number) => ms < 1000 ? 'green' : ms < 2500 ? 'amber' : 'red'

  return (
    <div className="card">
      <p className="section-title text-base mb-1 flex items-center gap-2">
        <Gauge size={16} className="text-brand" /> Speed on This Machine
      </p>
      <p className="section-sub mb-4">
        Measured from the browser on the machine you are reading this on — not a claim from a brochure.
      </p>

      {m ? (
        <div className="grid grid-cols-3 gap-2">
          <Tile k="First paint" v={m.paint === null ? '—' : `${m.paint} ms`} tone={m.paint === null ? 'brand' : rate(m.paint)} />
          <Tile k="Ready to use" v={`${m.dom} ms`} tone={rate(m.dom)} />
          <Tile k="Fully loaded" v={`${m.load} ms`} tone={rate(m.load)} />
        </div>
      ) : <p className="text-sm" style={{ color: 'var(--text-4)' }}>Measuring…</p>}

      <p className="text-[11px] mt-4 pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
        Screens open from a copy held on the machine, so the counter does not wait on the internet. Anything under a
        second is a screen that opens as fast as the key is pressed.
      </p>
    </div>
  )
}

/* ── 4. The paper the client asked for ─────────────────────────────────── */
function Nda() {
  const download = () => {
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const text = `NON-DISCLOSURE AND DATA PROTECTION UNDERTAKING

Between
    ${COMPANY.name}
    ${COMPANY.addressOneLine}
    GSTIN ${COMPANY.gstin}
    (referred to as "the Company")

and
    KEJ IT SOLUTIONS
    (referred to as "the Developer")

Dated ${today}

1. PURPOSE
   The Developer has been engaged to build and maintain a business dashboard
   for the Company. In the course of that work the Developer may see business
   data belonging to the Company.

2. WHAT IS CONFIDENTIAL
   All customer and supplier names, contact details and GST numbers; all
   prices, rates, margins and discounts; all invoices, purchase bills,
   quotations, stock figures and bank details; and anything else of the
   Company's that is not already public.

3. THE DEVELOPER'S UNDERTAKING
   a. To use the Company's data only to build, run and support the dashboard.
   b. Not to disclose it to any third party without the Company's written
      consent.
   c. Not to copy it beyond what the work requires, and to keep any such copy
      on encrypted storage.
   d. To return or destroy all copies within thirty days of the engagement
      ending, and to confirm in writing that it has been done.

4. WHERE THE DATA SITS
   The dashboard holds the Company's data in the Company's own account. The
   Developer does not keep a separate copy of live business data. Backups are
   taken nightly and are retained for thirty days.

5. ACCESS
   Each person using the dashboard has their own login. Billing may be placed
   behind a fingerprint so that every bill carries the name of the person who
   raised it. Access for any person can be withdrawn by the Company at once.

6. IF DATA IS LOST OR EXPOSED
   The Developer will inform the Company within twenty-four hours of becoming
   aware of any loss or unauthorised access, describe what happened, and assist
   in setting it right.

7. HOW LONG THIS LASTS
   These obligations continue for three years after the engagement ends.

8. GOVERNING LAW
   This undertaking is governed by the laws of India and is subject to the
   jurisdiction of the courts at Bengaluru.


For ${COMPANY.name}                    For KEJ IT SOLUTIONS


_______________________________        _______________________________
${COMPANY.proprietor}                              Authorised Signatory
Proprietor
`
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'NDA-data-protection-undertaking.txt'
    a.click(); URL.revokeObjectURL(a.href)
  }

  const points = [
    ['Separate login for every person', 'No shared password at the counter'],
    ['Data held in the Company’s own account', 'Not mixed with anybody else’s'],
    ['Backup every night, kept thirty days', 'Restorable to any of those days'],
    ['Copies destroyed when work ends', 'Confirmed to you in writing'],
    ['Breach told to you within 24 hours', 'With what happened and what was done'],
  ]

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="section-title text-base flex items-center gap-2">
          <FileLock2 size={16} className="text-brand" /> Confidentiality Undertaking
        </p>
        <button className="btn-outline !py-1 !text-xs shrink-0" onClick={download}>
          <Download size={13} /> Download NDA
        </button>
      </div>
      <p className="section-sub mb-4">
        A signed undertaking covering everything of yours the developer can see. Download it, read it, and it can be
        signed before anything goes live.
      </p>

      <div className="space-y-2">
        {points.map(([a, b]) => (
          <div key={a} className="flex items-start gap-2">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--green)' }} />
            <span>
              <span className="text-sm block" style={{ color: 'var(--text-1)' }}>{a}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>{b}</span>
            </span>
          </div>
        ))}
      </div>

      <p className="text-[11px] mt-4 pt-3 flex items-start gap-1.5" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
        <Clock size={12} className="mt-0.5 shrink-0" />
        Formal ISO 27001 certification is a separate audited exercise with its own cost and timeline. This undertaking
        gives you the same commitments in writing today; certification can follow if you want the certificate itself.
      </p>
    </div>
  )
}

const Tile = ({ k, v, tone }: { k: string; v: string; tone: string }) => (
  <div className="rounded-lg p-2.5" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{k}</p>
    <p className={cn('text-sm font-bold tabular-nums mt-0.5')}
      style={{ color: tone === 'green' ? 'var(--green)' : tone === 'red' ? 'var(--red)' : tone === 'amber' ? 'var(--amber, #f59e0b)' : 'var(--brand)' }}>{v}</p>
  </div>
)
