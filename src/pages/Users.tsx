import { useState } from 'react'
import { UserCog, ShieldCheck, KeyRound, Users as UsersIcon, Check, X } from 'lucide-react'
import { PageHead, Stat, TableCard, Pill, Modal } from '@/components/ui'
import { DEMO_USERS, useAuth } from '@/hooks/useAuth'
import { fmtDate } from '@/lib/utils'
import { useCrud } from '@/lib/store'
import { CrudBar, RowActions, RecordModal, EditedDot, type Field, type Rec } from '@/components/crud'

interface StaffUser { email: string; name: string; role: string; lastLogin: string; status: string }

const idOf = (u: StaffUser) => u.email

const MODULES = [
  'Dashboard', 'Alerts & Reminders',
  'Material Flow', 'Delivery Challans', 'Coating Recon', 'Coating Billing',
  'Location Stock', 'Stock & Inventory', 'Stock Audit', 'Stock Movement',
  'Product Catalogue', 'Item Master',
  'Quotations', 'Billing / Invoice', 'Sales Reports', 'Leads', 'Customers',
  'Purchase Orders', 'Purchase Register', 'Suppliers',
  'AI Capture',
  'Outstanding', 'Profit & Loss', 'GST Reports', 'GST Reconciliation',
  'User Management', 'Settings',
]

/** Role → module access matrix used by the app's route guard. */
const MATRIX: Record<string, string[]> = {
  Admin: MODULES,
  Manager: MODULES.filter(m => !['User Management'].includes(m)),
  'Sales Executive': ['Dashboard', 'Alerts & Reminders', 'Product Catalogue', 'Location Stock', 'Stock & Inventory', 'Quotations', 'Billing / Invoice', 'Sales Reports', 'Leads', 'Customers', 'Outstanding', 'AI Capture'],
  'Store Keeper': ['Dashboard', 'Alerts & Reminders', 'Material Flow', 'Delivery Challans', 'Coating Recon', 'Location Stock', 'Stock & Inventory', 'Stock Audit', 'Stock Movement', 'Product Catalogue', 'Item Master', 'Purchase Orders', 'Suppliers', 'AI Capture'],
  Accountant: ['Dashboard', 'Billing / Invoice', 'Purchase Register', 'Coating Billing', 'Outstanding', 'Profit & Loss', 'GST Reports', 'GST Reconciliation', 'AI Capture'],
}

const ROSTER = Object.entries(DEMO_USERS).map(([email, u], i) => ({
  email, name: u.name, role: u.role,
  lastLogin: ['2026-08-20', '2026-08-19', '2026-08-20', '2026-08-18'][i] ?? '2026-08-15',
  status: 'Active' as const,
}))

export default function Users() {
  const { user } = useAuth()
  const [role, setRole] = useState<string | null>(null)
  const [edit, setEdit] = useState<StaffUser | null>(null)

  const FIELDS: Field[] = [
    { key: 'name',      label: 'Name', required: true },
    { key: 'email',     label: 'Email / login', required: true },
    { key: 'role',      label: 'Role', type: 'select', options: Object.keys(MATRIX) },
    { key: 'lastLogin', label: 'Last login', type: 'date' },
    { key: 'status',    label: 'Status', type: 'select', options: ['Active', 'Suspended'] },
  ]

  const crud = useCrud<StaffUser>('users', ROSTER, idOf)
  const staff = crud.rows

  return (
    <div>
      <PageHead title="User Management" sub="Staff logins and role-based module access">
        <CrudBar noun="User" fields={FIELDS} changes={crud.changes} onRestore={crud.restore}
          onAdd={rec => crud.add({ lastLogin: new Date().toISOString().slice(0, 10), status: 'Active', ...rec } as StaffUser)} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Active Users" value={String(staff.length)}          icon={UsersIcon}   tone="brand"  sub="With dashboard logins" />
        <Stat label="Roles Defined" value={String(Object.keys(MATRIX).length)} icon={ShieldCheck} tone="sky" sub="Access templates" />
        <Stat label="Modules"      value={String(MODULES.length)}         icon={UserCog}     tone="violet" sub="Permission-controlled" />
        <Stat label="Your Role"    value={user?.role ?? '—'}              icon={KeyRound}    tone="green"  sub={user?.email ?? ''} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div>
          <p className="section-title text-base mb-1">Staff Accounts</p>
          <p className="section-sub mb-3">Demo credentials are listed on the sign-in screen</p>
          <TableCard maxH="24rem">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th>Status</th><th /></tr></thead>
            <tbody>
              {staff.map(u => (
                <tr key={u.email}>
                  <td className="font-medium" style={{ color: 'var(--text-1)' }}>
                    <EditedDot isNew={crud.isNew(u.email)} isEdited={crud.isEdited(u.email)} />{u.name}
                  </td>
                  <td className="text-xs">{u.email}</td>
                  <td><span className="badge-brand">{u.role}</span></td>
                  <td className="text-xs whitespace-nowrap">{fmtDate(u.lastLogin)}</td>
                  <td><Pill s={u.status} /></td>
                  <td><RowActions label={u.name} onEdit={() => setEdit(u)} onDelete={() => crud.remove(u.email)} /></td>
                </tr>
              ))}
            </tbody>
          </TableCard>

          <RecordModal open={!!edit} title={`Edit ${edit?.name ?? ''}`} fields={FIELDS}
            initial={edit as Rec | null}
            onSave={rec => { if (edit) crud.update(edit.email, rec as Partial<StaffUser>); setEdit(null) }}
            onClose={() => setEdit(null)}
            onDelete={() => { if (edit) crud.remove(edit.email); setEdit(null) }} />
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
