import { useState } from 'react'
import { Building2, MapPin, Phone, Mail, Globe, Clock, Landmark, FileText, Moon, Sun, ExternalLink } from 'lucide-react'
import { PageHead } from '@/components/ui'
import { useDarkMode } from '@/hooks/useDarkMode'
import { COMPANY, FY } from '@/data/company'
import SecurityBackup from '@/components/SecurityBackup'

const TABS = ['Business Profile', 'Tax & Billing', 'Security & Backup', 'Preferences'] as const

export default function Settings() {
  const [tab, setTab] = useState<typeof TABS[number]>('Business Profile')
  const { dark, toggle } = useDarkMode()

  return (
    <div>
      <PageHead title="Settings" sub="Company master data used across invoices, quotations and statutory reports" />

      <div className="flex gap-1 mb-5 p-1 rounded-lg w-fit" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === t ? 'bg-brand text-white' : ''}`}
            style={tab === t ? undefined : { color: 'var(--text-3)' }}>{t}</button>
        ))}
      </div>

      {tab === 'Business Profile' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="card xl:col-span-2">
            <p className="section-title text-base mb-4 flex items-center gap-2"><Building2 size={16} className="text-brand" /> Business Profile</p>
            <div className="space-y-4">
              <Field icon={Building2} k="Legal Name" v={COMPANY.name} />
              <Field icon={FileText}  k="Proprietor" v={`${COMPANY.proprietor} · Established ${COMPANY.founded}`} />
              <Field icon={MapPin}    k="Registered Address" v={COMPANY.addressOneLine} />
              <div className="grid sm:grid-cols-2 gap-4">
                <Field icon={Phone} k="Phone" v={COMPANY.phone} />
                <Field icon={Mail}  k="Email" v={COMPANY.email} />
              </div>
              <Field icon={Globe} k="Website" v={COMPANY.website} link />
              <div>
                <p className="text-[11px] mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-4)' }}><Clock size={12} /> Business Hours</p>
                {COMPANY.hours.map(h => (
                  <div key={h.day} className="flex justify-between text-sm py-1 max-w-sm" style={{ color: 'var(--text-2)' }}>
                    <span>{h.day}</span><span className="font-medium" style={{ color: 'var(--text-1)' }}>{h.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card">
              <p className="section-title text-sm mb-3">About</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>{COMPANY.blurb}</p>
              <p className="text-xs italic mt-3 text-brand font-medium">“{COMPANY.tagline}”</p>
            </div>
            <div className="card">
              <p className="section-title text-sm mb-3 flex items-center gap-2"><Landmark size={14} className="text-brand" /> Bank Details</p>
              <dl className="space-y-2 text-xs">
                <Kv k="Account Name" v={COMPANY.bank.name} />
                <Kv k="Bank"         v={COMPANY.bank.bank} />
                <Kv k="Branch"       v={COMPANY.bank.branch} />
                <Kv k="Account No."  v={COMPANY.bank.acNo} />
                <Kv k="IFSC"         v={COMPANY.bank.ifsc} />
              </dl>
            </div>
          </div>
        </div>
      )}

      {tab === 'Tax & Billing' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="card">
            <p className="section-title text-base mb-4">Tax Registration</p>
            <dl className="space-y-3 text-sm">
              <Kv k="GSTIN"            v={COMPANY.gstin} big />
              <Kv k="PAN"              v={COMPANY.pan} big />
              <Kv k="State / Code"     v={`${COMPANY.state} (${COMPANY.stateCode})`} big />
              <Kv k="Financial Year"   v={FY} big />
              <Kv k="Default GST Rate" v="18% (CGST 9% + SGST 9%)" big />
              <Kv k="Primary HSN"      v="7604 — Aluminium bars, rods and profiles" big />
              <Kv k="Invoice Series"   v="VSA/26-27/0001" big />
              <Kv k="Quotation Series" v="VSA/QT/26-27/001" big />
            </dl>
          </div>

          <div className="card">
            <p className="section-title text-base mb-4">Invoice Terms & Conditions</p>
            <ol className="list-decimal list-inside space-y-2 text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>
              {COMPANY.terms.map(t => <li key={t}>{t}</li>)}
            </ol>
            <p className="text-[11px] mt-4 pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
              These clauses are printed at the foot of every tax invoice generated from the Billing module.
            </p>
          </div>
        </div>
      )}

      {tab === 'Security & Backup' && <SecurityBackup />}

      {tab === 'Preferences' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="card">
            <p className="section-title text-base mb-4">Appearance</p>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{dark ? 'Dark mode' : 'Light mode'}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-4)' }}>Applies to every screen and is remembered on this device</p>
              </div>
              <button onClick={toggle} className="btn-outline shrink-0">
                {dark ? <Sun size={14} /> : <Moon size={14} />} Switch to {dark ? 'light' : 'dark'}
              </button>
            </div>
          </div>

          <div className="card">
            <p className="section-title text-base mb-4">Linked Website</p>
            <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>
              Enquiries captured on the public website feed straight into the Lead Generation module.
            </p>
            <a href={COMPANY.website} target="_blank" rel="noreferrer" className="btn-outline">
              <ExternalLink size={14} /> Open public website
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ icon: Icon, k, v, link }: { icon: typeof Building2; k: string; v: string; link?: boolean }) {
  return (
    <div>
      <p className="text-[11px] mb-1 flex items-center gap-1.5" style={{ color: 'var(--text-4)' }}><Icon size={12} /> {k}</p>
      {link
        ? <a href={v} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand hover:underline break-all">{v}</a>
        : <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{v}</p>}
    </div>
  )
}

function Kv({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt style={{ color: 'var(--text-4)' }}>{k}</dt>
      <dd className={`text-right font-medium ${big ? '' : 'text-xs'}`} style={{ color: 'var(--text-1)' }}>{v}</dd>
    </div>
  )
}
