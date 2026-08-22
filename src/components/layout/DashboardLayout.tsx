import { useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export const TITLES: Record<string, string> = {
  '/':               'Dashboard',
  '/products':       'Product Catalogue',
  '/inventory':      'Stock & Inventory',
  '/movements':      'Stock Movement',
  '/quotation':      'Quotations',
  '/billing':        'Billing / Invoice',
  '/sales-reports':  'Sales Reports',
  '/leads':          'Lead Generation',
  '/clients':        'Customers',
  '/purchases':      'Purchase Register',
  '/suppliers':      'Suppliers',
  '/outstanding':    'Outstanding',
  '/profit-loss':    'Profit & Loss',
  '/gst-reports':    'GST Reports',
  '/users':          'User Management',
  '/settings':       'Settings',
  '/material-flow':   'Material Flow',
  '/challans':        'Delivery Challans',
  '/coating-recon':   'Coating Reconciliation',
  '/coating-billing': 'Powder Coating Billing',
  '/locations':       'Location Stock',
  '/item-master':     'Item Master',
  '/ai-capture':      'AI Document Capture',
  '/gst-recon':       'GST Reconciliation',
  '/stock-audit':     'Stock Audit',
  '/purchase-orders': 'Purchase Orders',
  '/alerts':          'Alerts & Reminders',
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-main)' }}>
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar onMenu={() => setOpen(true)} title={TITLES[loc.pathname] ?? 'Venkata Sai Aluminium'} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
