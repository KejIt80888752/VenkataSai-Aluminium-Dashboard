import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { COMPANY } from '@/data/company'
import {
  LayoutDashboard, Package, Warehouse, ArrowLeftRight, FileText, Receipt,
  ShoppingBag, Building2, Truck, Users, CreditCard, BarChart2,
  FileSpreadsheet, TrendingUp, UserCog, Settings, LogOut, X, IndianRupee,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV: ({ group: string } | { to: string; icon: typeof Package; label: string })[] = [
  { group: 'Overview' },
  { to: '/',                 icon: LayoutDashboard, label: 'Dashboard'        },
  { group: 'Stock' },
  { to: '/products',         icon: Package,         label: 'Product Catalogue'},
  { to: '/inventory',        icon: Warehouse,       label: 'Stock & Inventory'},
  { to: '/movements',        icon: ArrowLeftRight,  label: 'Stock Movement'   },
  { group: 'Sales' },
  { to: '/quotation',        icon: FileText,        label: 'Quotations'       },
  { to: '/billing',          icon: Receipt,         label: 'Billing / Invoice'},
  { to: '/sales-reports',    icon: TrendingUp,      label: 'Sales Reports'    },
  { to: '/leads',            icon: Users,           label: 'Lead Generation'  },
  { to: '/clients',          icon: Building2,       label: 'Customers'        },
  { group: 'Purchase' },
  { to: '/purchases',        icon: ShoppingBag,     label: 'Purchase Register'},
  { to: '/suppliers',        icon: Truck,           label: 'Suppliers'        },
  { group: 'Finance' },
  { to: '/outstanding',      icon: CreditCard,      label: 'Outstanding'      },
  { to: '/profit-loss',      icon: BarChart2,       label: 'Profit & Loss'    },
  { to: '/gst-reports',      icon: FileSpreadsheet, label: 'GST Reports'      },
  { group: 'Admin' },
  { to: '/users',            icon: UserCog,         label: 'User Management'  },
  { to: '/settings',         icon: Settings,        label: 'Settings'         },
]

interface Props { open: boolean; onClose: () => void }

export default function Sidebar({ open, onClose }: Props) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={onClose} />}

      <aside className={cn(
        'fixed top-0 left-0 h-full w-64 z-30 flex flex-col transition-transform duration-300',
        'lg:translate-x-0 lg:static lg:z-auto',
        open ? 'translate-x-0' : '-translate-x-full',
      )} style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border-2)' }}>

        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 py-3 shrink-0 min-h-[64px]" style={{ borderBottom: '1px solid var(--border-2)' }}>
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-light to-brand-dark flex items-center justify-center shrink-0">
            <IndianRupee size={0} className="hidden" />
            <span className="font-display text-white font-bold text-lg leading-none">V</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-[15px] leading-tight tracking-wide" style={{ color: 'var(--text-1)' }}>VENKATA SAI</p>
            <p className="text-[9px] font-semibold tracking-[0.18em] uppercase text-brand">Aluminium Trade Links</p>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 shrink-0" style={{ color: 'var(--text-4)' }}><X size={16} /></button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pb-3 overflow-y-auto">
          {NAV.map((item, i) =>
            'group' in item
              ? <p key={`g${i}`} className="nav-group">{item.group}</p>
              : (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={onClose}
                  className={({ isActive }) => cn('nav-link', isActive && 'active')}>
                  <item.icon size={15} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ),
          )}
        </nav>

        {/* User + logout */}
        <div className="px-3 pb-2 pt-2 shrink-0" style={{ borderTop: '1px solid var(--border-2)' }}>
          <div className="flex items-center gap-3 px-2 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold uppercase shrink-0">
              {user?.name?.[0] ?? 'V'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-1)' }}>{user?.name}</p>
              <p className="text-[10px] truncate" style={{ color: 'var(--text-4)' }}>{user?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="nav-link w-full text-red-400 hover:!text-red-600 hover:!bg-red-50 dark:hover:!bg-red-900/20">
            <LogOut size={14} /> Sign Out
          </button>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 shrink-0 text-center" style={{ borderTop: '1px solid var(--border-2)' }}>
          <p className="text-[9px] uppercase tracking-widest font-medium" style={{ color: 'var(--text-4)' }}>Powered by</p>
          <p className="text-[11px] font-semibold text-brand">KEJ IT Solutions</p>
          <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-4)' }}>GSTIN {COMPANY.gstin}</p>
        </div>
      </aside>
    </>
  )
}
