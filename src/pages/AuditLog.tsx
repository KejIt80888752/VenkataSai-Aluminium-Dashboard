import { useState, useMemo } from 'react'
import { History, ShieldAlert, Download, UserX, Monitor } from 'lucide-react'
import { PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Empty } from '@/components/ui'
import { AUDIT, AUDIT_SUMMARY, ACTS, SENSITIVE, type Entry } from '@/data/audit'
import { csvDownload, cn } from '@/lib/utils'
import { FY } from '@/data/company'

const badgeFor = (a: Entry['act']) =>
  a === 'Bill deleted' || a === 'Sign-in refused' ? 'badge-red'
  : a === 'Exported' || a === 'Printed' ? 'badge-purple'
  : a === 'Rate changed' || a === 'Stock corrected' ? 'badge-yellow'
  : a === 'Correction approved' || a === 'Gate pass released' ? 'badge-green' : 'badge-gray'

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  })

export default function AuditLog() {
  const [q, setQ] = useState('')
  const [act, setAct] = useState('All Actions')
  const [who, setWho] = useState('Everyone')
  const [onlySensitive, setOnly] = useState(false)

  const people = useMemo(() => ['Everyone', ...new Set(AUDIT.map(e => e.who))], [])

  const rows = useMemo(() => AUDIT.filter(e =>
    (act === 'All Actions' || e.act === act) &&
    (who === 'Everyone' || e.who === who) &&
    (!onlySensitive || SENSITIVE.includes(e.act)) &&
    (q === '' || `${e.who} ${e.act} ${e.on} ${e.detail} ${e.device}`.toLowerCase().includes(q.toLowerCase())),
  ), [q, act, who, onlySensitive])

  const exportCsv = () => csvDownload('vsa-audit-log.csv', [
    ['Audit log', FY],
    [], ['When', 'Who', 'Role', 'Action', 'On', 'Detail', 'Rows', 'Device'],
    ...rows.map(e => [e.at, e.who, e.role, e.act, e.on, e.detail, e.rows ?? '', e.device]),
  ])

  return (
    <div>
      <PageHead title="Audit Log" sub="Every action, the person behind it, and what left the building">
        <SearchBox value={q} onChange={setQ} placeholder="Search person, document, action…" />
        <Select value={who} onChange={setWho} options={people} className="min-w-[12rem]" />
        <Select value={act} onChange={setAct} options={['All Actions', ...ACTS]} className="min-w-[13rem]" />
        <ExportBtn onClick={exportCsv} />
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Entries" value={String(AUDIT_SUMMARY.total)} icon={History} tone="brand" sub="Nothing is ever removed" />
        <Stat label="Worth a Second Look" value={String(AUDIT_SUMMARY.sensitive)} icon={ShieldAlert} tone="amber"
          sub="Deletions, rate changes, exports" />
        <Stat label="Rows Taken Out" value={AUDIT_SUMMARY.rowsOut.toLocaleString('en-IN')} icon={Download} tone="violet"
          sub={`${AUDIT_SUMMARY.exports.length} exports`} />
        <Stat label="Sign-ins Refused" value={String(AUDIT_SUMMARY.refused)} icon={UserX}
          tone={AUDIT_SUMMARY.refused ? 'red' : 'green'} sub="Wrong password" />
      </div>

      {/* ── What has left the building ────────────────────────────────── */}
      <div className="card mb-5">
        <p className="section-title text-base mb-1">What Has Left the Building</p>
        <p className="section-sub mb-3">
          Every export and print, with what was in it. This is what makes it possible to say later whose copy
          a leaked list came from.
        </p>
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {AUDIT_SUMMARY.exports.slice(0, 10).map(e => (
            <div key={e.id} className="rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-3"
              style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
              <span className="min-w-0">
                <span className="text-sm block truncate" style={{ color: 'var(--text-1)' }}>{e.on}</span>
                <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>
                  {e.who} · {e.role} · {e.device} · {when(e.at)}
                </span>
              </span>
              <span className="tabular-nums text-sm font-semibold shrink-0" style={{ color: 'var(--text-2)' }}>
                {e.rows} rows
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <p className="section-title text-base mb-1">Everything, Newest First</p>
          <p className="section-sub">The log cannot be edited or deleted, by anyone</p>
        </div>
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-2)' }}>
          <input type="checkbox" className="accent-[var(--brand)]" checked={onlySensitive}
            onChange={() => setOnly(v => !v)} />
          Only the ones worth a second look
        </label>
      </div>

      <TableCard maxH="32rem">
        <thead>
          <tr><th>When</th><th>Who</th><th>Action</th><th>On</th><th>Detail</th>
            <th className="num">Rows</th><th>Device</th></tr>
        </thead>
        <tbody>
          {rows.map(e => (
            <tr key={e.id} style={SENSITIVE.includes(e.act)
              ? { background: 'color-mix(in srgb, var(--amber, #f59e0b) 6%, transparent)' } : undefined}>
              <td className="text-xs whitespace-nowrap tabular-nums">{when(e.at)}</td>
              <td>
                <p className="text-xs font-medium" style={{ color: 'var(--text-1)' }}>{e.who}</p>
                <p className="text-[10.5px]" style={{ color: 'var(--text-4)' }}>{e.role}</p>
              </td>
              <td><span className={badgeFor(e.act)}>{e.act}</span></td>
              <td className="text-xs max-w-[13rem] truncate font-mono" style={{ color: 'var(--text-2)' }}>{e.on}</td>
              <td className="text-xs max-w-[18rem] truncate" style={{ color: 'var(--text-3)' }}>{e.detail}</td>
              <td className={cn('num tabular-nums text-xs')}
                style={{ color: e.rows ? 'var(--text-1)' : 'var(--text-4)' }}>{e.rows ?? '—'}</td>
              <td className="text-xs whitespace-nowrap flex items-center gap-1.5" style={{ color: 'var(--text-4)' }}>
                <Monitor size={11} /> {e.device}
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7}><Empty msg="Nothing matches" /></td></tr>}
        </tbody>
      </TableCard>
    </div>
  )
}
