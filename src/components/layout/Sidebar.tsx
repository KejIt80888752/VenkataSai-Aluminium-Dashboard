import { useState, useMemo } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { loose } from '@/components/SectionPicker'
import {
  LayoutDashboard, Package, Warehouse, ArrowLeftRight, FileText, Receipt,
  ShoppingBag, Building2, Truck, Users, CreditCard, BarChart2, Search, FileCheck2,
  FileSpreadsheet, TrendingUp, UserCog, Settings, LogOut, X, IndianRupee,
  Workflow, FileStack, Scale, SprayCan, MapPin, Boxes, ScanLine,
  ShieldCheck, ClipboardCheck, ClipboardList, BellRing, Undo2, DoorOpen, Landmark, Mic, QrCode, FileSearch, Layers3, HardHat, Ruler, BookOpen, Scissors, Grid3x3, ScanBarcode, History, Trophy, Split, PackageOpen, PackageX, Tags, FileInput, Palette, GitBranch, CalendarDays,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BUILT } from '@/lib/version'

/* ── The order they asked for, on 20-11-2026 ───────────────────────────────
   "Sales at top, purchase second, material flow third. Coating book at top."

   Which is the order of their day rather than the order of the material: a
   shop sells, then buys to cover what it sold, and only then chases what is
   out at the coater. The dashboard stays above all of it because it is where
   the app opens, and the back-office groups keep to the foot.             */
const NAV: ({ group: string } | { to: string; icon: typeof Package; label: string })[] = [
  { group: 'Overview' },
  { to: '/',                 icon: LayoutDashboard, label: 'Dashboard'         },
  { to: '/alerts',           icon: BellRing,        label: 'Alerts & Reminders'},
  { to: '/calendar',         icon: CalendarDays,    label: 'Calendar'          },
  { group: 'Sales' },
  { to: '/estimate',         icon: FileText,        label: 'Estimate'          },
  { to: '/quotation',        icon: FileText,        label: 'Quotation'         },
  { to: '/proforma-invoice', icon: FileCheck2,      label: 'Proforma Invoice'  },
  { to: '/tax-invoice',      icon: Receipt,         label: 'Tax Invoice'       },
  { to: '/billing',          icon: Receipt,         label: 'Billing Register'  },
  { to: '/proforma',         icon: Ruler,           label: 'Proforma & Windows'},
  { to: '/cut-list',         icon: Scissors,        label: 'Cut List'          },
  { to: '/books',            icon: BookOpen,        label: 'Books (Est / GST)' },
  { to: '/quick-bill',       icon: Mic,             label: 'Quick Bill (Voice)'},
  { to: '/sales-reports',    icon: TrendingUp,      label: 'Sales Reports'     },
  { to: '/salesmen',         icon: Trophy,          label: 'Salesmen'          },
  { to: '/leads',            icon: Users,           label: 'Lead Generation'   },
  { to: '/clients',          icon: Building2,       label: 'Customers'         },
  { to: '/projects',         icon: HardHat,         label: 'Turnkey Projects'  },
  { group: 'Purchase' },
  { to: '/purchase-dc',      icon: FileInput,       label: 'Purchase DC'       },
  { to: '/purchases',        icon: ShoppingBag,     label: 'Purchase Invoice'  },
  { to: '/purchase-orders',  icon: ClipboardList,   label: 'Purchase Orders'   },
  { to: '/shortage-order',   icon: PackageX,        label: 'Shortage Order'    },
  { to: '/suppliers',        icon: Truck,           label: 'Suppliers'         },
  { to: '/supplier-recon',   icon: Scale,           label: 'Supplier Statement'},
  { group: 'Material Flow' },
  { to: '/coat-book',        icon: Palette,         label: 'Coating Book'      },
  { to: '/dc-flow',          icon: Workflow,        label: 'Material Journey'  },
  { to: '/stats',            icon: BarChart2,       label: 'Figures at a Glance' },
  { to: '/material-flow',    icon: GitBranch,       label: 'Material Flow'     },
  { to: '/challans',         icon: FileStack,       label: 'Delivery Challans' },
  { to: '/coating-recon',    icon: Scale,           label: 'Coating Recon'     },
  { to: '/coating-billing',  icon: SprayCan,        label: 'Coating Billing'   },
  { to: '/coater-bill',      icon: FileSearch,      label: "Coater's Bill Recon"},
  { to: '/returns',          icon: Undo2,           label: 'Returns to Mill'   },
  { to: '/gate-check',       icon: ShieldCheck,     label: 'Gate Verification' },
  { to: '/gate-register',    icon: DoorOpen,        label: 'Gate Register'     },
  { group: 'Stock' },
  { to: '/locations',        icon: MapPin,          label: 'Location Stock'    },
  { to: '/warehouse',        icon: Grid3x3,         label: 'Warehouse Map'     },
  { to: '/inventory',        icon: Warehouse,       label: 'Stock & Inventory' },
  { to: '/lots',             icon: Layers3,         label: 'Weight Ranges'     },
  { to: '/stock-audit',      icon: ClipboardCheck,  label: 'Stock Audit'       },
  { to: '/movements',        icon: ArrowLeftRight,  label: 'Stock Movement'    },
  { to: '/products',         icon: Package,         label: 'Product Catalogue' },
  { to: '/rate-cards',       icon: Tags,            label: 'Rate Cards'        },
  { to: '/item-master',      icon: Boxes,           label: 'Item Master'       },
  { to: '/barcodes',         icon: ScanBarcode,     label: 'Barcodes & Labels' },
  { to: '/pack-goods',       icon: PackageOpen,     label: 'Pack & Loose Goods'},
  { group: 'AI & Automation' },
  { to: '/ai-capture',       icon: ScanLine,        label: 'AI Capture'        },
  { group: 'Finance' },
  { to: '/outstanding',      icon: CreditCard,      label: 'Outstanding'       },
  { to: '/payments',         icon: QrCode,          label: 'Payments'          },
  { to: '/bank',             icon: Landmark,        label: 'Bank & Receipts'   },
  { to: '/contra',           icon: Split,           label: 'Contra & Diverted' },
  { to: '/price-watch',      icon: TrendingUp,      label: 'Cost & Selling'    },
  { to: '/valuation',        icon: Boxes,           label: 'Stock Valuation'   },
  { to: '/profit-loss',      icon: BarChart2,       label: 'Profit & Loss'     },
  { to: '/gst-reports',      icon: FileSpreadsheet, label: 'GST Reports'       },
  { to: '/gst-recon',        icon: ShieldCheck,     label: 'GST Reconciliation'},
  { group: 'Admin' },
  { to: '/users',            icon: UserCog,         label: 'User Management'   },
  { to: '/audit-log',        icon: History,         label: 'Audit Log'         },
  { to: '/settings',         icon: Settings,        label: 'Settings'          },
]


interface Props { open: boolean; onClose: () => void }

export default function Sidebar({ open, onClose }: Props) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const handleLogout = () => { logout(); navigate('/login') }
  const [find, setFind] = useState('')

  /* ── Finding a screen in sixty ────────────────────────────────────────
     The search box came down off the top bar — theirs, on 20-11 — and is
     most use here, where the list is long enough that nobody should have to
     scroll it. Typed against, the menu shows only what matches, and a group
     with nothing left in it drops out with its heading.

     Matched the same loose way the product box is, so the foot mark, spaces
     and × make no difference here either. */
  const shown = useMemo(() => {
    const q = loose(find)
    if (!q) return NAV
    const hits = NAV.filter(n => !('group' in n) && loose(n.label + ' ' + n.to).includes(q))
    const out: typeof NAV = []
    for (let i = 0; i < NAV.length; i++) {
      const item = NAV[i]
      if (!('group' in item)) continue
      const kids = []
      for (let j = i + 1; j < NAV.length && !('group' in NAV[j]); j++) {
        if (hits.includes(NAV[j])) kids.push(NAV[j])
      }
      if (kids.length) out.push(item, ...kids)
    }
    return out
  }, [find])

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

        {/* Search — moved down from the top bar */}
        <div className="px-3 pt-3 pb-1 shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-4)' }} />
            <input value={find} onChange={e => setFind(e.target.value)}
              placeholder="Search screens…"
              className="input w-full !pl-8 !py-1.5 !text-xs" />
            {find && (
              <button onClick={() => setFind('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5"
                style={{ color: 'var(--text-4)' }}><X size={12} /></button>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pb-3 overflow-y-auto">
          {shown.length === 0 && (
            <p className="text-[11.5px] px-2 py-4" style={{ color: 'var(--text-4)' }}>
              No screen matches "{find}".
            </p>
          )}
          {shown.map((item, i) =>
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
          {/* The build this copy is, so a question about whether a change
              has landed is one glance rather than an argument. */}
          <p className="px-2 pt-1.5 text-[10px] tabular-nums" style={{ color: 'var(--text-4)' }}>
            Build {BUILT}
          </p>
        </div>
      </aside>
    </>
  )
}
