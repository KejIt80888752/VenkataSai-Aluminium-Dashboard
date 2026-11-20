import { useState, useRef, useEffect, useMemo } from 'react'
import { Check, X, Search } from 'lucide-react'

/* ── Picking one of our sections by typing ─────────────────────────────────
   The shop asked for this: typing the name beats hunting a dropdown. With
   thirty-odd sections a list is already tiresome, and their real list will
   be longer than ours.

   It filters on every word rather than on the whole string, so "2 shutter"
   finds "2 Track Sliding Shutter" — nobody types a section's name in the
   order the master happens to hold it. The code is searched too, since the
   man entering a purchase sheet often has the code in front of him and not
   the name.                                                               */

export interface PickOption {
  /** what the picker hands back; the code where a row has no separate id */
  id?: string
  code: string
  name: string
  /** every other spelling this row is known by, searched but not shown */
  alt?: string
}

/** The value a row stands for. One code may carry two lengths, so a row that
    brings its own id is identified by that and not by the code it shares. */
export const optValue = (o: PickOption) => o.id ?? o.code

/* ── Matching the way the shop types ──────────────────────────────────────
   Asked for on 20-11-2026:

     "' symbol, space, should be ignored. For 2.5x1.5 16' SG I will type
      16SG or 2.5*1.5 — both should get recognised."

   So the foot mark, the spaces, the hyphens and whichever of x, X, * or the
   multiplication sign somebody reaches for are all flattened on both sides
   before anything is compared. Dots are left alone, because 2.5 and 25 are
   not the same section.

   Each word is still matched on its own, so "2 shutter" finds a two track
   sliding shutter and "16 sg" finds the sixteen foot single groove — and a
   word typed with no spaces at all, like 16SG, is simply one word.        */
export const loose = (s: string) =>
  (s || '')
    .toLowerCase()
    .replace(/[×✕✖*]/g, 'x')
    .replace(/[''"″`]/g, '')
    .replace(/[\s\-_/]/g, '')

export function SectionPicker({ options, value, onChange, placeholder = 'Type a section name…', className }: {
  options: PickOption[]
  /** the chosen section's code, or '' for none */
  value: string
  onChange: (code: string) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const chosen = options.find(o => optValue(o) === value)

  const hits = useMemo(() => {
    const words = query.trim().split(/\s+/).map(loose).filter(Boolean)
    if (!words.length) return options.slice(0, 50)
    return options
      .filter(o => {
        const hay = loose(`${o.name} ${o.code} ${o.alt ?? ''}`)
        return words.every(w => hay.includes(w))
      })
      .slice(0, 50)
  }, [options, query])

  /* A click anywhere else closes it, which is what a dropdown would do. */
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  useEffect(() => { setActive(0) }, [query])

  const choose = (o: PickOption) => {
    onChange(optValue(o))
    setQuery('')
    setOpen(false)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, hits.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (hits[active]) choose(hits[active]) }
    else if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  return (
    <div ref={boxRef} className={`relative ${className ?? ''}`}>
      {chosen && !open ? (
        /* Settled: show what was picked, with a way to change or clear it. */
        <button type="button"
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0) }}
          className="input !py-1 !text-xs w-full flex items-center justify-between gap-2 text-left">
          <span className="truncate" style={{ color: 'var(--text-1)' }}>{chosen.name}</span>
          <X size={13} className="shrink-0 opacity-50 hover:opacity-100"
            onClick={e => { e.stopPropagation(); onChange('') }} />
        </button>
      ) : (
        <>
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-4)' }} />
            <input
              ref={inputRef}
              className="input !py-1 !text-xs w-full !pl-7"
              placeholder={placeholder}
              value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKey}
            />
          </div>
          {open && (
            <div className="absolute z-30 mt-1 w-full max-h-60 overflow-auto rounded-lg shadow-lg"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-2)' }}>
              {hits.length === 0 ? (
                <p className="px-3 py-2.5 text-[11.5px]" style={{ color: 'var(--text-4)' }}>
                  Nothing matches "{query}". Try one word of the name, or the code — spaces, the foot
                  mark and × or * are ignored, so 16SG and 2.5*1.5 both work.
                </p>
              ) : hits.map((o, i) => (
                <button key={optValue(o)} type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o)}
                  className="w-full text-left px-3 py-1.5 flex items-center justify-between gap-2"
                  style={{ background: i === active ? 'var(--bg-card2)' : 'transparent' }}>
                  <span className="text-xs truncate" style={{ color: 'var(--text-1)' }}>{o.name}</span>
                  <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-4)' }}>{o.code}</span>
                  {optValue(o) === value && <Check size={12} style={{ color: 'var(--green)' }} />}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
