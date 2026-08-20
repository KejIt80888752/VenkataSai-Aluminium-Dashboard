import { type ReactNode, useState, useMemo } from 'react'
import { Search, Download, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Page header ───────────────────────────────────────────────────── */
export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-1)' }}>{title}</h2>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-4)' }}>{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/* ── KPI tile ──────────────────────────────────────────────────────── */
export function Stat({ label, value, sub, icon: Icon, tone = 'brand', trend }: {
  label: string; value: string; sub?: string; icon: LucideIcon
  tone?: 'brand' | 'green' | 'red' | 'amber' | 'violet' | 'sky'
  trend?: { dir: 'up' | 'down'; text: string }
}) {
  const tones: Record<string, string> = {
    brand:  'bg-brand/10 text-brand',
    green:  'bg-green-500/10 text-green-600',
    red:    'bg-red-500/10 text-red-500',
    amber:  'bg-amber-500/10 text-amber-600',
    violet: 'bg-violet-500/10 text-violet-600',
    sky:    'bg-sky-500/10 text-sky-600',
  }
  return (
    <div className="card flex items-start gap-4">
      <div className={cn('p-2.5 rounded-xl shrink-0', tones[tone])}><Icon size={18} /></div>
      <div className="min-w-0">
        <p className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{label}</p>
        <p className="text-xl font-bold mt-0.5 tabular-nums" style={{ color: 'var(--text-1)' }}>{value}</p>
        <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-4)' }}>
          {trend && <span className={trend.dir === 'up' ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
            {trend.dir === 'up' ? '▲' : '▼'} {trend.text}
          </span>}
          {sub}
        </p>
      </div>
    </div>
  )
}

/* ── Search box ────────────────────────────────────────────────────── */
export function SearchBox({ value, onChange, placeholder = 'Search…' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-4)' }} />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="input pl-9 w-full sm:w-64" />
    </div>
  )
}

/* ── Select ────────────────────────────────────────────────────────── */
export function Select({ value, onChange, options, className }: {
  value: string; onChange: (v: string) => void; options: string[]; className?: string
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={cn('input w-auto min-w-[9rem]', className)}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

/* ── Export button ─────────────────────────────────────────────────── */
export function ExportBtn({ onClick, label = 'Export CSV' }: { onClick: () => void; label?: string }) {
  return <button onClick={onClick} className="btn-outline"><Download size={14} /> {label}</button>
}

/* ── Empty state ───────────────────────────────────────────────────── */
export function Empty({ msg = 'Nothing to show here' }: { msg?: string }) {
  return (
    <div className="py-14 text-center">
      <Inbox size={28} className="mx-auto mb-2 opacity-25" style={{ color: 'var(--text-4)' }} />
      <p className="text-sm" style={{ color: 'var(--text-4)' }}>{msg}</p>
    </div>
  )
}

/* ── Scrollable table shell ────────────────────────────────────────── */
export function TableCard({ children, maxH = '32rem' }: { children: ReactNode; maxH?: string }) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="overflow-auto" style={{ maxHeight: maxH }}>
        <table className="tbl">{children}</table>
      </div>
    </div>
  )
}

/* ── Client-side pagination hook ───────────────────────────────────── */
export function usePaged<T>(rows: T[], size = 12) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const safe = Math.min(page, pages - 1)
  const slice = useMemo(() => rows.slice(safe * size, safe * size + size), [rows, safe, size])
  return { slice, page: safe, pages, setPage, total: rows.length }
}

export function Pager({ page, pages, total, setPage }: {
  page: number; pages: number; total: number; setPage: (n: number) => void
}) {
  if (total === 0) return null
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-xs" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
      <span>{total} record{total === 1 ? '' : 's'} · page {page + 1} of {pages}</span>
      <div className="flex items-center gap-1">
        <button disabled={page === 0} onClick={() => setPage(page - 1)}
          className="p-1.5 rounded-md disabled:opacity-30 hover:bg-brand/10"><ChevronLeft size={14} /></button>
        <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)}
          className="p-1.5 rounded-md disabled:opacity-30 hover:bg-brand/10"><ChevronRight size={14} /></button>
      </div>
    </div>
  )
}

/* ── Modal ─────────────────────────────────────────────────────────── */
export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/45" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={cn('w-full rounded-xl shadow-2xl my-8', wide ? 'max-w-4xl' : 'max-w-lg')}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-2)' }}>
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-2)' }}>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{title}</p>
          <button onClick={onClose} className="text-xl leading-none px-2" style={{ color: 'var(--text-4)' }}>×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

/* ── Status pill ───────────────────────────────────────────────────── */
const PILL: Record<string, string> = {
  Paid: 'badge-green', Won: 'badge-green', Converted: 'badge-green', Active: 'badge-green', Inward: 'badge-green',
  Partial: 'badge-yellow', 'Under Negotiation': 'badge-yellow', Quoted: 'badge-yellow', 'On Hold': 'badge-yellow', Adjustment: 'badge-yellow',
  Overdue: 'badge-red', Lost: 'badge-red', Dropped: 'badge-red', Outward: 'badge-red',
  Unpaid: 'badge-gray', Expired: 'badge-gray', Dormant: 'badge-gray',
  Sent: 'badge-blue', Contacted: 'badge-blue', Return: 'badge-blue',
  New: 'badge-purple',
}
export const Pill = ({ s }: { s: string }) => <span className={PILL[s] ?? 'badge-gray'}>{s}</span>

/* ── Chart theming ─────────────────────────────────────────────────── */
import { useDarkMode } from '@/hooks/useDarkMode'

export function useChartTheme() {
  const { dark } = useDarkMode()
  return {
    grid: dark ? '#2a3a50' : '#e2e8f0',
    tick: { fontSize: 11, fill: dark ? '#94a3b8' : '#64748b' },
    tooltip: {
      backgroundColor: dark ? '#16202f' : '#fff',
      border: `1px solid ${dark ? '#2a3a50' : '#e2e8f0'}`,
      borderRadius: 8, fontSize: 12,
      color: dark ? '#f1f5f9' : '#334155',
    } as React.CSSProperties,
  }
}

/** Categorical series colours — readable in both themes */
export const SERIES = ['#0f5b8f', '#2b8fd4', '#16a34a', '#f59e0b', '#8b5cf6', '#ef4444', '#0891b2', '#64748b', '#db2777']
