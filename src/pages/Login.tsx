import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, DEMO_USERS } from '@/hooks/useAuth'
import { COMPANY } from '@/data/company'
import { Eye, EyeOff, MapPin, Phone, Mail, LogIn } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('admin@venkatasaialuminium.com')
  const [pw, setPw]       = useState('admin123')
  const [show, setShow]   = useState(false)
  const [err, setErr]     = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (login(email, pw)) nav('/')
    else setErr('Invalid email or password. Try one of the demo logins below.')
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">

      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-brand-dark via-brand to-brand-light text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg, #fff 0 2px, transparent 2px 26px)' }} />
        <div className="relative">
          <div className="w-14 h-14 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center mb-6">
            <span className="font-display font-bold text-3xl leading-none">V</span>
          </div>
          <h1 className="font-display text-4xl font-bold tracking-wide leading-tight">
            VENKATA SAI<br />ALUMINIUM<br />TRADE LINKS
          </h1>
          <p className="mt-4 text-white/80 text-sm max-w-sm leading-relaxed">{COMPANY.blurb}</p>
        </div>

        <div className="relative space-y-3 text-sm text-white/85">
          <p className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0" />
            {COMPANY.address.line1}, {COMPANY.address.line2}, {COMPANY.address.line3} – {COMPANY.address.pin}</p>
          <p className="flex items-center gap-2"><Phone size={15} /> {COMPANY.phone}</p>
          <p className="flex items-center gap-2"><Mail size={15} /> {COMPANY.email}</p>
          <p className="pt-3 text-xs text-white/60 border-t border-white/20">
            GSTIN {COMPANY.gstin} · Serving Bengaluru since {COMPANY.founded}
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6" style={{ background: 'var(--bg-main)' }}>
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-6">
            <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-brand-light to-brand-dark flex items-center justify-center mb-3">
              <span className="font-display text-white font-bold text-2xl leading-none">V</span>
            </div>
            <p className="font-display font-bold text-xl" style={{ color: 'var(--text-1)' }}>VENKATA SAI ALUMINIUM</p>
          </div>

          <h2 className="text-xl font-semibold" style={{ color: 'var(--text-1)' }}>Sign in</h2>
          <p className="text-xs mb-6 mt-1" style={{ color: 'var(--text-4)' }}>Business dashboard · {COMPANY.short}</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" value={email} onChange={e => { setEmail(e.target.value); setErr('') }} autoComplete="username" />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input className="input pr-10" type={show ? 'text' : 'password'} value={pw}
                  onChange={e => { setPw(e.target.value); setErr('') }} autoComplete="current-password" />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-4)' }}>
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {err && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{err}</p>}

            <button type="submit" className="btn w-full justify-center"><LogIn size={15} /> Sign In</button>
          </form>

          <div className="mt-6 rounded-lg p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-2)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-4)' }}>Demo logins</p>
            <div className="space-y-1">
              {Object.entries(DEMO_USERS).map(([mail, u]) => (
                <button key={mail} onClick={() => { setEmail(mail); setPw(u.pw); setErr('') }}
                  className="w-full text-left text-[11px] px-2 py-1.5 rounded hover:bg-brand/10 flex justify-between gap-2">
                  <span style={{ color: 'var(--text-2)' }}>{mail}</span>
                  <span className="shrink-0 font-mono" style={{ color: 'var(--text-4)' }}>{u.pw}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-[10px] mt-6" style={{ color: 'var(--text-4)' }}>
            Powered by <span className="font-semibold text-brand">KEJ IT Solutions</span>
          </p>
        </div>
      </div>
    </div>
  )
}
