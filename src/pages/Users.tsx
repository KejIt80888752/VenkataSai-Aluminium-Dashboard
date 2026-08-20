import { useState } from 'react'
import { UserCog, ShieldCheck, KeyRound, Users as UsersIcon, Check, X } from 'lucide-react'
import { PageHead, Stat, TableCard, Pill, Modal } from '@/components/ui'
import { DEMO_USERS, useAuth } from '@/hooks/useAuth'
import { fmtDate } from '@/lib/utils'

const MODULES = [
  'Dashboard', 'Product Catalogue', 'Stock & Inventory', 'Stock Movement',
  'Quotations', 'Billing / Invoice', 'Sales Reports', 'Leads', 'Customers',
  'Purchases', 'Suppliers', 'Outstanding', 'Profit & Loss', 'GST Reports', 'User Management', 'Settings',
]

/** Role → module access matrix used by the app's route guard. */
const MATRIX: Record<string, string[]> = {
  Admin: MODULES,
  Manager: MODULES.filter(m => !['User Management'].includes(m)),
  'Sales Executive': ['Dashboard', 'Product Catalogue', 'Stock & Inventory', 'Quotations', 'Billing / Invoice', 'Sales Reports', 'Leads', 'Customers', 'Outstanding'],
  'Store Keeper': ['Dashboard', 'Product Catalogue', 'Stock & Inventory', 'Stock Movement', 'Suppliers'],
  Accountant: ['Dashboard', 'Billing / Invoice', 'Purchases', 'Outstanding', 'Profit & Loss', 'GST Reports'],
}

const ROSTER = Object.entries(DEMO_USERS).map(([email, u], i) => ({
  email, name: u.name, role: u.role,
  lastLogin: ['2026-08-20', '2026-08-19', '2026-08-20', '2026-08-18'][i] ?? '2026-08-15',
  status: 'Active' as const,
}))

export default function Users() {
  const { user } = useAuth()
  const [role, setRole] = useState<string | null>(null)

  return (
    <div>
      <PageHead title="User Management" sub="Staff logins and role-based module access" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Active Users" value={String(ROSTER.length)}          icon={UsersIcon}   tone="brand"  sub="With dashboard logins" />
        <Stat label="Roles Defined" value={String(Object.keys(MATRIX).length)} icon={ShieldCheck} tone="sky" sub="Access templates" />
        <Stat label="Modules"      value={String(MODULES.length)}         icon={UserCog}     tone="violet" sub="Permission-controlled" />
        <Stat label="Your Role"    value={user?.role ?? '—'}              icon={KeyRound}    tone="green"  sub={user?.email ?? ''} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div>
          <p className="section-title text-base mb-1">Staff Accounts</p>
          <p className="section-sub mb-3">Demo credentials are listed on the sign-in screen</p>
          <TableCard maxH="24rem">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th>Status</th></tr></thead>
            <tbody>
              {ROSTER.map(u => (
                <tr key={u.email}>
                  <td className="font-medium" style={{ color: 'var(--text-1)' }}>{u.name}</td>
                  <td className="text-xs">{u.email}</td>
                  <td><span className="badge-brand">{u.role}</span></td>
                  <td className="text-xs whitespace-nowrap">{fmtDate(u.lastLogin)}</td>
                  <td><Pill s={u.status} /></td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        </div>

        <div>
          <p className="section-title text-base mb-1">Roles & Permissions</p>
          <p className="section-sub mb-3">Click a role to see the full module matrix</p>
          <div className="space-y-2">
            {Object.entries(MATRIX).map(([r, mods]) => (
              <button key={r} onClick={() => setRole(r)}
                className="card-sm w-full text-left hover:border-brand transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>{r}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-4)' }}>
                      {mods.length} of {MODULES.length} modules · {mods.slice(0, 3).join(', ')}…
                    </p>
                  </div>
                  <div className="h-1.5 w-20 rounded-full overflow-hidden shrink-0" style={{ background: 'var(--border)' }}>
                    <div className="h-full bg-brand rounded-full" style={{ width: `${(mods.length / MODULES.length) * 100}%` }} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Modal open={!!role} onClose={() => setRole(null)} title={`${role} — module access`}>
        <div className="grid sm:grid-cols-2 gap-y-2 gap-x-4">
          {MODULES.map(m => {
            const ok = role ? MATRIX[role].includes(m) : false
            return (
              <div key={m} className="flex items-center gap-2 text-sm">
                {ok
                  ? <Check size={14} className="text-green-600 shrink-0" />
                  : <X size={14} className="text-red-400 shrink-0" />}
                <span style={{ color: ok ? 'var(--text-1)' : 'var(--text-4)' }}>{m}</span>
              </div>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}
