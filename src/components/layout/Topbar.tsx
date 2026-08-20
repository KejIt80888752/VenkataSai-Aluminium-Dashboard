import { useState, useRef, useEffect } from 'react'
import { Menu, Bell, Search, Sun, Moon, AlertTriangle, PackageX, IndianRupee, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useDarkMode } from '@/hooks/useDarkMode'
import { P, isLow } from '@/data/catalogue'
import { INVOICES, TOTALS } from '@/data/txns'
import { inr } from '@/lib/utils'
import { FY } from '@/data/company'

interface Props { onMenu: () => void; title: string }

export default function Topbar({ onMenu, title }: Props) {
  const { user } = useAuth()
  const { dark, toggle } = useDarkMode()
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const lowStock = P.filter(isLow)
  const overdue  = INVOICES.filter(i => i.status === 'Overdue')

  const alerts = [
    lowStock.length && {
      id: 'low', icon: PackageX, cls: 'text-amber-600 bg-amber-500/10',
      title: `${lowStock.length} items at or below reorder level`,
      msg: lowStock.slice(0, 3).map(p => p.code).join(', ') + (lowStock.length > 3 ? ` +${lowStock.length - 3} more` : ''),
    },
    overdue.length && {
      id: 'od', icon: AlertTriangle, cls: 'text-red-500 bg-red-500/10',
      title: `${overdue.length} invoices past due date`,
      msg: `${inr(overdue.reduce((s, i) => s + (i.total - i.received), 0))} locked in overdue receivables`,
    },
    {
      id: 'gst', icon: IndianRupee, cls: 'text-brand bg-brand/10',
      title: 'GSTR-3B filing due on 20th',
      msg: `Net GST payable ${inr(TOTALS.outputGst - TOTALS.inputGst)} for ${FY}`,
    },
  ].filter(Boolean) as { id: string; icon: typeof Bell; cls: string; title: string; msg: string }[]

  const live = alerts.filter(a => !dismissed.includes(a.id))

  return (
    <header className="h-14 flex items-center gap-3 px-4 lg:px-6 sticky top-0 z-10 shrink-0"
      style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-2)', boxShadow: 'var(--shadow)' }}>

      <button onClick={onMenu} className="lg:hidden p-1.5" style={{ color: 'var(--text-3)' }}><Menu size={20} /></button>

      <h1 className="text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{title}</h1>

      <div className="flex-1 max-w-xs hidden md:block ml-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-4)' }} />
          <input placeholder="Search invoices, products, customers…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs focus:outline-none"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)', color: 'var(--text-2)' }} />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="badge-brand hidden lg:inline-flex">{FY}</span>

        <button onClick={toggle} title={dark ? 'Light mode' : 'Dark mode'}
          className="p-2 rounded-lg transition-all hover:scale-110"
          style={{ background: dark ? 'rgba(43,143,212,.16)' : 'rgba(15,91,143,.08)', color: dark ? '#9dcbec' : '#0f5b8f' }}>
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="relative" ref={ref}>
          <button onClick={() => setOpen(o => !o)} className="relative p-2 rounded-lg"
            style={{ color: open ? '#0f5b8f' : 'var(--text-3)', background: open ? 'rgba(15,91,143,.08)' : 'transparent' }}>
            <Bell size={17} />
            {live.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold">
                {live.length}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-11 w-80 rounded-xl overflow-hidden z-50 shadow-2xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-2)' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-2)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Alerts</p>
                <p className="text-[10px]" style={{ color: 'var(--text-4)' }}>{live.length} needing attention</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {live.length === 0 && <p className="py-8 text-center text-sm" style={{ color: 'var(--text-4)' }}>All clear</p>}
                {live.map(a => (
                  <div key={a.id} className="flex items-start gap-3 px-4 py-3 relative" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${a.cls}`}><a.icon size={14} /></div>
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{a.title}</p>
                      <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-3)' }}>{a.msg}</p>
                    </div>
                    <button onClick={() => setDismissed(d => [...d, a.id])} className="absolute top-2.5 right-2.5" style={{ color: 'var(--text-4)' }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pl-2" style={{ borderLeft: '1px solid var(--border-2)' }}>
          <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold uppercase shrink-0">
            {user?.name?.[0] ?? 'V'}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium" style={{ color: 'var(--text-1)' }}>{user?.name}</p>
            <p className="text-[10px]" style={{ color: 'var(--text-4)' }}>{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
