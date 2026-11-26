/* ── The calendar ─────────────────────────────────────────────────────────
   Theirs, on 26-11: "add a calendar". It sits in two places — as a tab on
   Alerts & Reminders, where what needs chasing already lives, and as a screen
   of its own — so this is one component used twice rather than two that
   drift apart.

   Everything on it is read from the registers (see lib/diary.ts). The only
   rows the office types here are its own notes.                            */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, CalendarDays, Plus, Pencil, Trash2,
  CheckCircle2, Circle, ListOrdered, LayoutGrid, ArrowUpRight,
  AlarmClock, IndianRupee, Truck, PhoneCall,
} from 'lucide-react'
import { Modal, Empty, Select, ExportBtn, Stat } from '@/components/ui'
import {
  useDiary, newNote, KIND_META, ALL_KINDS, isOverdue, isoOf, todayIso, dateOf, addDays,
  type DiaryKind, type DiaryEntry, type DiaryNote,
} from '@/lib/diary'
import { inr, fmtDate, cn, csvDownload } from '@/lib/utils'

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

/** Monday-first: a shop's week ends on the Sunday, so it belongs at the end. */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7

/** The 42 days that fill a six-week month grid, Monday first. */
function gridOf(year: number, month: number): string[] {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - mondayIndex(first))
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i)
    return isoOf(d)
  })
}

export default function Calendar({ maxH = '34rem', stats = false }: { maxH?: string; stats?: boolean }) {
  const diary = useDiary()
  const today = todayIso()

  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const [picked, setPicked] = useState(today)
  const [view, setView] = useState<'Month' | 'What is coming'>('Month')
  const [off, setOff] = useState<Set<DiaryKind>>(new Set())
  const [editing, setEditing] = useState<DiaryNote | null>(null)

  const shown = (k: DiaryKind) => !off.has(k)
  const toggle = (k: DiaryKind) => setOff(prev => {
    const next = new Set(prev)
    next.has(k) ? next.delete(k) : next.add(k)
    return next
  })

  const days = useMemo(() => gridOf(cursor.y, cursor.m), [cursor])

  const entriesOn = (iso: string) => (diary.byDay.get(iso) ?? []).filter(e => shown(e.kind))

  /* What is coming: today and the next thirty days, so nothing is read in a
     grid that can simply be read as a list. */
  const coming = useMemo(() => {
    const end = addDays(today, 30)
    return diary.entries.filter(e => shown(e.kind) && e.date >= today && e.date <= end)
  }, [diary.entries, off, today])

  const overdueOpen = useMemo(
    () => diary.entries.filter(e => shown(e.kind) && isOverdue(e, today)),
    [diary.entries, off, today],
  )

  const monthLabel = `${MONTH_NAMES[cursor.m]} ${cursor.y}`

  const step = (n: number) => setCursor(c => {
    const d = new Date(c.y, c.m + n, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  const jumpToday = () => {
    const d = new Date()
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
    setPicked(today)
  }

  const exportCsv = () => {
    const inMonth = diary.entries.filter(e => e.date.slice(0, 7) === `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`)
    csvDownload(`vsa-calendar-${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}.csv`, [
      ['Date', 'What', 'Kind', 'Who', 'Amount', 'Quantity', 'Settled'],
      ...inMonth.map(e => [
        fmtDate(e.date), e.title, KIND_META[e.kind].label, e.who ?? '',
        e.amount ? Math.round(e.amount) : '', e.qty ?? '', e.done ? 'Yes' : 'No',
      ]),
    ])
  }

  const saveNote = (n: DiaryNote) => {
    if (diary.notes.rows.some(r => r.id === n.id)) diary.notes.update(n.id, n)
    else diary.notes.add(n)
    setEditing(null)
  }

  /* The week ahead, counted off the same entries the grid draws. */
  const week = useMemo(() => {
    const end = addDays(today, 7)
    const soon = diary.entries.filter(e => !e.done && e.date >= today && e.date <= end)
    return {
      inn:  soon.filter(e => e.kind === 'money-in').reduce((s, e) => s + (e.amount ?? 0), 0),
      out:  soon.filter(e => e.kind === 'money-out').reduce((s, e) => s + (e.amount ?? 0), 0),
      mat:  soon.filter(e => e.kind === 'material').length,
      call: soon.filter(e => e.kind === 'follow-up' || e.kind === 'note').length,
    }
  }, [diary.entries, today])

  return (
    <div>
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
          <Stat label="Past its day, still open" value={String(overdueOpen.length)} icon={AlarmClock}
            tone={overdueOpen.length ? 'red' : 'green'} sub="Across every register" />
          <Stat label="Due to us this week" value={inr(week.inn)} icon={IndianRupee} tone="brand"
            sub="Customer bills falling due in seven days" />
          <Stat label="Due by us this week" value={inr(week.out)} icon={IndianRupee} tone="red"
            sub="Supplier bills falling due in seven days" />
          <Stat label="Coming up" value={String(week.mat + week.call)} icon={week.mat ? Truck : PhoneCall} tone="amber"
            sub={`${week.mat} deliveries · ${week.call} to chase`} />
        </div>
      )}

      {/* ── Head: month, today, view, export ─────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} className="btn-outline px-2" aria-label="Previous month"><ChevronLeft size={15} /></button>
          <button onClick={() => step(1)} className="btn-outline px-2" aria-label="Next month"><ChevronRight size={15} /></button>
        </div>
        <p className="font-semibold text-base px-1" style={{ color: 'var(--text-1)' }}>{monthLabel}</p>
        <button onClick={jumpToday} className="btn-outline"><CalendarDays size={14} /> Today</button>

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
            {(['Month', 'What is coming'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn('px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5', view === v && 'bg-brand text-white')}
                style={view === v ? undefined : { color: 'var(--text-3)' }}>
                {v === 'Month' ? <LayoutGrid size={13} /> : <ListOrdered size={13} />} {v}
              </button>
            ))}
          </div>
          <ExportBtn onClick={exportCsv} label="Export this month" />
          <button onClick={() => setEditing(newNote(picked))} className="btn-primary"><Plus size={14} /> Add a note</button>
        </div>
      </div>

      {/* ── Which kinds to show ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {ALL_KINDS.map(k => {
          const n = diary.entries.filter(e => e.kind === k).length
          return (
            <button key={k} onClick={() => toggle(k)}
              className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-opacity',
                !shown(k) && 'opacity-40')}
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-2)', color: 'var(--text-2)' }}>
              <span className={cn('w-2 h-2 rounded-full', KIND_META[k].dot)} />
              {KIND_META[k].label}
              <span className="tabular-nums" style={{ color: 'var(--text-4)' }}>{n}</span>
            </button>
          )
        })}
      </div>

      {overdueOpen.length > 0 && (
        <div className="card-sm mb-3 flex items-center gap-2 px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <p className="text-xs" style={{ color: 'var(--text-2)' }}>
            <span className="font-semibold text-red-500">{overdueOpen.length}</span> {overdueOpen.length === 1 ? 'thing is' : 'things are'} past
            its day and still open — the earliest was {fmtDate(overdueOpen[0].date)}.
          </p>
        </div>
      )}

      {view === 'Month' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-4">
          <MonthGrid days={days} month={cursor.m} today={today} picked={picked}
            onPick={setPicked} entriesOn={entriesOn} />
          <DayPanel iso={picked} entries={entriesOn(picked)} today={today}
            notes={diary.notes} onEdit={setEditing} onAdd={() => setEditing(newNote(picked))} maxH={maxH} />
        </div>
      ) : (
        <Coming rows={coming} today={today} notes={diary.notes} onEdit={setEditing} />
      )}

      <NoteModal key={editing?.id ?? 'none'} note={editing} onClose={() => setEditing(null)} onSave={saveNote} />
    </div>
  )
}

/* ── The month ─────────────────────────────────────────────────────────── */

function MonthGrid({ days, month, today, picked, onPick, entriesOn }: {
  days: string[]; month: number; today: string; picked: string
  onPick: (iso: string) => void; entriesOn: (iso: string) => DiaryEntry[]
}) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--border-2)', background: 'var(--bg-card2)' }}>
        {WEEK.map(w => (
          <div key={w} className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-center"
            style={{ color: w === 'Sun' ? 'var(--text-4)' : 'var(--text-3)' }}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((iso, i) => {
          const d = dateOf(iso)
          const outside = d.getMonth() !== month
          const isToday = iso === today
          const isPicked = iso === picked
          const rows = entriesOn(iso)
          const late = rows.filter(e => isOverdue(e, today)).length
          return (
            <button key={iso} onClick={() => onPick(iso)}
              className={cn('text-left align-top p-1.5 min-h-[5.5rem] transition-colors',
                isPicked && 'ring-2 ring-inset ring-brand')}
              style={{
                borderRight: (i + 1) % 7 ? '1px solid var(--border)' : undefined,
                borderBottom: i < 35 ? '1px solid var(--border)' : undefined,
                background: outside ? 'var(--bg-card2)' : 'var(--bg-card)',
                opacity: outside ? 0.55 : 1,
              }}>
              <div className="flex items-center justify-between mb-1">
                <span className={cn('text-[11px] tabular-nums w-5 h-5 inline-flex items-center justify-center rounded-full',
                  isToday && 'bg-brand text-white font-semibold')}
                  style={isToday ? undefined : { color: 'var(--text-3)' }}>{d.getDate()}</span>
                {late > 0 && <span className="text-[10px] font-semibold text-red-500 tabular-nums">{late} late</span>}
              </div>
              <div className="space-y-0.5">
                {rows.slice(0, 3).map(e => (
                  <div key={e.id} className="flex items-center gap-1 min-w-0">
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0',
                      isOverdue(e, today) ? 'bg-red-500' : KIND_META[e.kind].dot)} />
                    <span className={cn('text-[10px] truncate', e.done && 'line-through opacity-60')}
                      style={{ color: 'var(--text-2)' }}>{e.title}</span>
                  </div>
                ))}
                {rows.length > 3 && (
                  <p className="text-[10px] pl-2.5" style={{ color: 'var(--text-4)' }}>+{rows.length - 3} more</p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── The day that is open ──────────────────────────────────────────────── */

function DayPanel({ iso, entries, today, notes, onEdit, onAdd, maxH }: {
  iso: string; entries: DiaryEntry[]; today: string
  notes: ReturnType<typeof useDiary>['notes']
  onEdit: (n: DiaryNote) => void; onAdd: () => void; maxH: string
}) {
  const d = dateOf(iso)
  const money = entries.filter(e => e.kind === 'money-in' && !e.done).reduce((s, e) => s + (e.amount ?? 0), 0)
  const owed  = entries.filter(e => e.kind === 'money-out' && !e.done).reduce((s, e) => s + (e.amount ?? 0), 0)

  return (
    <div className="card p-0 overflow-hidden flex flex-col">
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-2)' }}>
        <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
          {WEEK[mondayIndex(d)]}, {fmtDate(iso)}{iso === today && ' · today'}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-4)' }}>
          {entries.length ? `${entries.length} ${entries.length === 1 ? 'thing' : 'things'} on this day` : 'Nothing on this day'}
        </p>
        {(money > 0 || owed > 0) && (
          <div className="flex gap-3 mt-2 text-[11px]">
            {money > 0 && <span className="text-sky-600 dark:text-sky-400">In {inr(money)}</span>}
            {owed > 0 && <span className="text-red-500">Out {inr(owed)}</span>}
          </div>
        )}
      </div>

      <div className="overflow-auto flex-1" style={{ maxHeight: maxH }}>
        {entries.length === 0
          ? <Empty msg="Nothing falls on this day" />
          : <ul>{entries.map(e => (
              <EntryRow key={e.id} e={e} today={today} notes={notes} onEdit={onEdit} />
            ))}</ul>}
      </div>

      <button onClick={onAdd} className="btn-outline m-3"><Plus size={14} /> Note on this day</button>
    </div>
  )
}

function EntryRow({ e, today, notes, onEdit }: {
  e: DiaryEntry; today: string
  notes: ReturnType<typeof useDiary>['notes']
  onEdit: (n: DiaryNote) => void
}) {
  const own = notes.rows.find(n => n.id === e.id)
  const late = isOverdue(e, today)
  return (
    <li className="px-4 py-2.5 flex items-start gap-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', late ? 'bg-red-500' : KIND_META[e.kind].dot)} />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', e.done && 'line-through opacity-60')} style={{ color: 'var(--text-1)' }}>{e.title}</p>
        {e.who && <p className="text-[11px] truncate" style={{ color: 'var(--text-4)' }}>{e.who}</p>}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={KIND_META[e.kind].badge}>{KIND_META[e.kind].label}</span>
          {late && <span className="badge-red">Past its day</span>}
          {!!e.amount && <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-2)' }}>{inr(e.amount)}</span>}
          {e.qty && <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-3)' }}>{e.qty}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {own && (
          <>
            <button onClick={() => notes.update(own.id, { done: !own.done })} title={own.done ? 'Mark as still open' : 'Mark as done'}
              className="p-1" style={{ color: own.done ? '#16a34a' : 'var(--text-4)' }}>
              {own.done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
            </button>
            <button onClick={() => onEdit(own)} className="p-1" title="Edit" style={{ color: 'var(--text-4)' }}><Pencil size={13} /></button>
            <button onClick={() => notes.remove(own.id)} className="p-1 text-red-500" title="Remove"><Trash2 size={13} /></button>
          </>
        )}
        {e.to && <Link to={e.to} className="p-1" title="Open where this lives" style={{ color: 'var(--text-4)' }}><ArrowUpRight size={14} /></Link>}
      </div>
    </li>
  )
}

/* ── Thirty days ahead, as a list ──────────────────────────────────────── */

function Coming({ rows, today, notes, onEdit }: {
  rows: DiaryEntry[]; today: string
  notes: ReturnType<typeof useDiary>['notes']
  onEdit: (n: DiaryNote) => void
}) {
  const byDay = useMemo(() => {
    const m = new Map<string, DiaryEntry[]>()
    for (const e of rows) {
      const l = m.get(e.date); if (l) l.push(e); else m.set(e.date, [e])
    }
    return [...m.entries()]
  }, [rows])

  if (!byDay.length) return <div className="card"><Empty msg="Nothing falls in the next thirty days" /></div>

  return (
    <div className="card p-0 overflow-hidden">
      {byDay.map(([iso, list]) => {
        const d = dateOf(iso)
        const away = Math.round((d.getTime() - dateOf(today).getTime()) / 86400000)
        return (
          <div key={iso}>
            <div className="px-4 py-2 flex items-center gap-2 sticky top-0"
              style={{ background: 'var(--bg-card2)', borderBottom: '1px solid var(--border-2)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>
                {WEEK[mondayIndex(d)]}, {fmtDate(iso)}
              </p>
              <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>
                {away === 0 ? 'today' : away === 1 ? 'tomorrow' : `in ${away} days`}
              </span>
            </div>
            <ul>{list.map(e => <EntryRow key={e.id} e={e} today={today} notes={notes} onEdit={onEdit} />)}</ul>
          </div>
        )
      })}
    </div>
  )
}

/* ── Writing a note ───────────────────────────────────────────────────── */

function NoteModal({ note, onClose, onSave }: {
  note: DiaryNote | null; onClose: () => void; onSave: (n: DiaryNote) => void
}) {
  /* Remounted by key whenever another note is opened, so this starts from
     the note it was given rather than the one before it. */
  const [d, setD] = useState<DiaryNote>(note ?? newNote(todayIso()))
  if (!note) return null

  const set = <K extends keyof DiaryNote>(k: K, v: DiaryNote[K]) => setD({ ...d, [k]: v })
  const labelOf = (k: DiaryKind) => KIND_META[k].label
  const kindFromLabel = (l: string) => ALL_KINDS.find(k => labelOf(k) === l) ?? 'note'

  return (
    <Modal open title={d.title ? 'Change this note' : 'A note on the calendar'} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Day">
            <input type="date" value={d.date} onChange={e => set('date', e.target.value)} className="input w-full" />
          </Field>
          <Field label="Time (leave empty for all day)">
            <input type="time" value={d.time} onChange={e => set('time', e.target.value)} className="input w-full" />
          </Field>
        </div>
        <Field label="What it is">
          <input value={d.title} onChange={e => set('title', e.target.value)} className="input w-full"
            placeholder="Site measurement at Whitefield" />
        </Field>
        <Field label="Who it is with">
          <input value={d.who} onChange={e => set('who', e.target.value)} className="input w-full"
            placeholder="Harish Babu · 98xxx xxxxx" />
        </Field>
        <Field label="Where it belongs">
          <Select value={labelOf(d.kind)} onChange={v => set('kind', kindFromLabel(v))}
            options={ALL_KINDS.map(labelOf)} className="w-full min-w-0" />
        </Field>
        <Field label="Anything else">
          <textarea value={d.detail} onChange={e => set('detail', e.target.value)} rows={3} className="input w-full"
            placeholder="Payment promised against bill 0042" />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-outline">Leave it</button>
          <button onClick={() => onSave(d)} disabled={!d.date || !d.title.trim()} className="btn-primary disabled:opacity-40">
            Put it on the calendar
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] mb-1" style={{ color: 'var(--text-3)' }}>{label}</span>
      {children}
    </label>
  )
}
