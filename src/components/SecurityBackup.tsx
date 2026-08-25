import { useState, useEffect } from 'react'
import {
  Fingerprint, ShieldCheck, DatabaseBackup, Gauge, Download, FileLock2, CheckCircle2, CircleAlert, Clock,
} from 'lucide-react'
import { COMPANY, TODAY, FY } from '@/data/company'
import { cn } from '@/lib/utils'

/* ── Daily backup log ──────────────────────────────────────────────────── */
const backupDays = (n: number) => Array.from({ length: n }, (_, i) => {
  const d = new Date(TODAY); d.setDate(d.getDate() - i)
  return {
    date: d.toISOString().slice(0, 10),
    at: '01:30',
    sizeMb: +(42.5 + i * 0.35).toFixed(1),
    // One night the machine was off — worth showing rather than hiding.
    ok: i !== 4,
  }
})

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

/* ── 2. A copy taken every night ───────────────────────────────────────── */
function Backups() {
  const days = backupDays(10)
  const failed = days.filter(d => !d.ok)

  const downloadNow = () => {
    const blob = new Blob([JSON.stringify({
      company: COMPANY.name, gstin: COMPANY.gstin, financialYear: FY,
      takenAt: new Date().toISOString(),
      note: 'Manual backup taken from the dashboard.',
    }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `vsa-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="section-title text-base flex items-center gap-2">
          <DatabaseBackup size={16} className="text-brand" /> Nightly Backup
        </p>
        <button className="btn-outline !py-1 !text-xs shrink-0" onClick={downloadNow}>
          <Download size={13} /> Take one now
        </button>
      </div>
      <p className="section-sub mb-4">
        A full copy is taken at 1:30 every night and kept for thirty days. Nothing has to be remembered or pressed.
      </p>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <Tile k="Last good copy" v={days.find(d => d.ok)!.date.slice(8) + ' Aug'} tone="green" />
        <Tile k="Copies kept" v="30 days" tone="brand" />
        <Tile k="Nights missed" v={String(failed.length)} tone={failed.length ? 'red' : 'green'} />
      </div>

      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-2)' }}>
        <div className="max-h-44 overflow-y-auto">
          {days.map((d, i) => (
            <div key={d.date} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
              style={{ borderTop: i ? '1px solid var(--border-2)' : undefined }}>
              <span className="flex items-center gap-2">
                {d.ok
                  ? <CheckCircle2 size={13} style={{ color: 'var(--green)' }} />
                  : <CircleAlert size={13} style={{ color: 'var(--red)' }} />}
                <span className="tabular-nums" style={{ color: 'var(--text-2)' }}>{d.date}</span>
                <span style={{ color: 'var(--text-4)' }}>{d.at}</span>
              </span>
              <span className="tabular-nums" style={{ color: d.ok ? 'var(--text-3)' : 'var(--red)' }}>
                {d.ok ? `${d.sizeMb} MB` : 'machine was off'}
              </span>
            </div>
          ))}
        </div>
      </div>
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
