import { useState, useEffect } from 'react'
import { ShieldCheck, Send, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Modal, TableCard, Empty } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { fmtDate, cn } from '@/lib/utils'

/* ── Stock corrections need someone senior to sign them ────────────────────
   A count difference is not a correction until the owner accepts it. The
   store raises it with a reason, and it only touches the book once it is
   approved — with the reason kept beside it for good.                     */

export const REASONS = [
  'Cutting loss / end pieces',
  'Damaged in handling',
  'Weighment difference',
  'Wrong item issued earlier',
  'Sale bill not entered',
  'Purchase bill not entered',
  'Return not booked',
  'Shortage — no explanation',
] as const

export type AdjStatus = 'Pending Approval' | 'Approved' | 'Rejected'

export interface Adjustment {
  key: string
  code: string
  name: string
  location: string
  bookPcs: number
  countedPcs: number
  diffPcs: number
  diffKg: number
  reason: string
  note: string
  raisedBy: string
  raisedAt: string
  status: AdjStatus
  decidedBy?: string
  decidedAt?: string
  remark?: string
}

const KEY = 'vsa-stock-adjustments'
const APPROVERS = ['Admin', 'Manager']

export function useAdjustments() {
  const [items, setItems] = useState<Adjustment[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
  })
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* blocked */ }
  }, [items])

  return {
    items,
    raise: (a: Adjustment) => setItems(v => [a, ...v.filter(x => x.key !== a.key)]),
    decide: (key: string, status: AdjStatus, by: string, remark: string) =>
      setItems(v => v.map(x => x.key === key
        ? { ...x, status, decidedBy: by, decidedAt: new Date().toISOString().slice(0, 10), remark }
        : x)),
    statusOf: (key: string) => items.find(x => x.key === key)?.status,
    find: (key: string) => items.find(x => x.key === key),
  }
}

const badgeFor = (s: AdjStatus) =>
  s === 'Approved' ? 'badge-green' : s === 'Rejected' ? 'badge-red' : 'badge-yellow'

/* ── Raising one correction ────────────────────────────────────────────── */
export function RaiseAdjustment({ open, row, onClose, onRaise }: {
  open: boolean
  row: { key: string; code: string; name: string; location: string; bookPcs: number; countedPcs: number; diffPcs: number; diffKg: number } | null
  onClose: () => void
  onRaise: (a: Adjustment) => void
}) {
  const { user } = useAuth()
  const [reason, setReason] = useState<string>(REASONS[0])
  const [note, setNote] = useState('')

  useEffect(() => { if (open) { setReason(REASONS[0]); setNote('') } }, [open])
  if (!row) return null

  return (
    <Modal open={open} onClose={onClose} title={`Correct ${row.name}`}>
      <div className="space-y-4">
        <div className="rounded-lg p-3 grid grid-cols-3 gap-3 text-center"
          style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
          <Fig k="Book" v={String(row.bookPcs)} />
          <Fig k="Counted" v={String(row.countedPcs)} />
          <Fig k="Difference" v={`${row.diffPcs > 0 ? '+' : ''}${row.diffPcs}`}
            tone={row.diffPcs < 0 ? 'red' : 'green'} />
        </div>

        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          {row.bookPcs} in the book, {row.countedPcs} on the floor — a difference of {Math.abs(row.diffPcs)} pieces.
          The book will not move until this is approved.
        </p>

        <div>
          <label className="label">Reason<span style={{ color: 'var(--red)' }}> *</span></label>
          <select className="input w-full" value={reason} onChange={e => setReason(e.target.value)}>
            {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Anything to add</label>
          <textarea className="input w-full min-h-[4rem]" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Which bill, which lot, who was involved — anything the owner will want to know later" />
        </div>

        <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--border-2)' }}>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={() => {
            onRaise({
              ...row, reason, note,
              raisedBy: user?.name ?? 'Store', raisedAt: new Date().toISOString().slice(0, 10),
              status: 'Pending Approval',
            })
            onClose()
          }}><Send size={14} /> Send for approval</button>
        </div>
      </div>
    </Modal>
  )
}

/* ── The owner's desk ──────────────────────────────────────────────────── */
export function ApprovalQueue({ items, onDecide }: {
  items: Adjustment[]
  onDecide: (key: string, status: AdjStatus, by: string, remark: string) => void
}) {
  const { user } = useAuth()
  const canApprove = APPROVERS.includes(user?.role ?? '')
  const [decide, setDecide] = useState<{ a: Adjustment; to: AdjStatus } | null>(null)
  const [remark, setRemark] = useState('')

  const pending = items.filter(i => i.status === 'Pending Approval')
  const settled = items.filter(i => i.status !== 'Pending Approval')

  if (items.length === 0) return null

  return (
    <>
      <div className="card mb-5" style={{ borderColor: pending.length ? 'var(--amber, #f59e0b)' : undefined }}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <p className="section-title text-base flex items-center gap-2">
              <ShieldCheck size={15} className="text-brand" /> Corrections Waiting for Approval
            </p>
            <p className="section-sub max-w-3xl">
              The store raises a correction with a reason; the book only moves once it is approved. Every decision keeps
              the reason, the person and the date against it.
            </p>
          </div>
          {!canApprove && (
            <span className="badge-gray shrink-0 flex items-center gap-1">
              <Clock size={11} /> {user?.role} cannot approve
            </span>
          )}
        </div>

        {pending.length === 0
          ? <Empty msg="Nothing waiting" />
          : (
            <div className="space-y-2">
              {pending.map(a => (
                <div key={a.key} className="rounded-lg p-3"
                  style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>{a.name}</p>
                      <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>
                        {a.code} · {a.location} · book {a.bookPcs} → counted {a.countedPcs}
                        {' '}({a.diffPcs > 0 ? '+' : ''}{a.diffPcs} pcs, {a.diffKg > 0 ? '+' : ''}{a.diffKg} kg)
                      </p>
                      <p className="text-xs mt-1.5" style={{ color: 'var(--text-2)' }}>
                        <span className="badge-yellow mr-1.5">{a.reason}</span>
                        {a.note && <span style={{ color: 'var(--text-3)' }}>{a.note}</span>}
                      </p>
                      <p className="text-[10.5px] mt-1" style={{ color: 'var(--text-4)' }}>
                        Raised by {a.raisedBy} on {fmtDate(a.raisedAt)}
                      </p>
                    </div>
                    {canApprove && (
                      <span className="flex gap-2 shrink-0">
                        <button className="btn-outline !py-1 !text-xs" onClick={() => { setDecide({ a, to: 'Rejected' }); setRemark('') }}>
                          <XCircle size={13} /> Reject
                        </button>
                        <button className="btn !py-1 !text-xs" onClick={() => { setDecide({ a, to: 'Approved' }); setRemark('') }}>
                          <CheckCircle2 size={13} /> Approve
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {settled.length > 0 && (
        <>
          <p className="section-title text-base mb-1">Corrections Already Decided</p>
          <p className="section-sub mb-3">Kept for good, so any figure can be traced back to who changed it and why</p>
          <TableCard maxH="20rem">
            <thead>
              <tr><th>Item</th><th>Loc</th><th className="num">Book</th><th className="num">Counted</th><th className="num">Diff</th>
                <th>Reason</th><th>Raised By</th><th>Decided By</th><th>Status</th></tr>
            </thead>
            <tbody>
              {settled.map(a => (
                <tr key={a.key}>
                  <td>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{a.name}</p>
                    <p className="font-mono text-[10px]" style={{ color: 'var(--text-4)' }}>{a.code}</p>
                  </td>
                  <td className="text-xs">{a.location}</td>
                  <td className="num tabular-nums">{a.bookPcs}</td>
                  <td className="num tabular-nums">{a.countedPcs}</td>
                  <td className={cn('num tabular-nums font-medium', a.diffPcs < 0 ? 'text-red-500' : 'text-green-600')}>
                    {a.diffPcs > 0 ? '+' : ''}{a.diffPcs}
                  </td>
                  <td className="text-xs max-w-[14rem]">
                    <span className="block truncate" style={{ color: 'var(--text-2)' }} title={a.reason}>{a.reason}</span>
                    {a.note && <span className="block truncate text-[10.5px]" style={{ color: 'var(--text-4)' }} title={a.note}>{a.note}</span>}
                    {a.remark && <span className="block truncate text-[10.5px]" style={{ color: 'var(--text-4)' }} title={a.remark}>Owner: {a.remark}</span>}
                  </td>
                  <td className="text-xs whitespace-nowrap">{a.raisedBy}<br />
                    <span style={{ color: 'var(--text-4)' }}>{fmtDate(a.raisedAt)}</span></td>
                  <td className="text-xs whitespace-nowrap">{a.decidedBy}<br />
                    <span style={{ color: 'var(--text-4)' }}>{a.decidedAt ? fmtDate(a.decidedAt) : ''}</span></td>
                  <td><span className={badgeFor(a.status)}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        </>
      )}

      <Modal open={!!decide} onClose={() => setDecide(null)}
        title={decide ? `${decide.to === 'Approved' ? 'Approve' : 'Reject'} — ${decide.a.name}` : ''}>
        {decide && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              {decide.to === 'Approved'
                ? <>The book moves from {decide.a.bookPcs} to {decide.a.countedPcs} pieces at {decide.a.location}, against “{decide.a.reason}”.</>
                : <>The count stands rejected and the book stays at {decide.a.bookPcs} pieces. The store will be asked to recount.</>}
            </p>
            <div>
              <label className="label">
                Your remark{decide.to === 'Rejected' && <span style={{ color: 'var(--red)' }}> *</span>}
              </label>
              <textarea className="input w-full min-h-[4rem]" value={remark} onChange={e => setRemark(e.target.value)}
                placeholder={decide.to === 'Approved' ? 'Optional' : 'Why it is not accepted'} />
            </div>
            <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--border-2)' }}>
              <button className="btn-outline" onClick={() => setDecide(null)}>Cancel</button>
              <button className="btn" disabled={decide.to === 'Rejected' && !remark.trim()}
                style={decide.to === 'Rejected' ? { background: 'var(--red)' } : undefined}
                onClick={() => { onDecide(decide.a.key, decide.to, user?.name ?? '', remark.trim()); setDecide(null) }}>
                {decide.to === 'Approved' ? <><CheckCircle2 size={14} /> Approve the correction</> : <><XCircle size={14} /> Reject</>}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

export function AdjustmentBadge({ status }: { status?: AdjStatus }) {
  if (!status) return null
  return <span className={badgeFor(status)}>{status}</span>
}

const Fig = ({ k, v, tone }: { k: string; v: string; tone?: string }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{k}</p>
    <p className="text-lg font-bold tabular-nums"
      style={{ color: tone === 'red' ? 'var(--red)' : tone === 'green' ? 'var(--green)' : 'var(--text-1)' }}>{v}</p>
  </div>
)
