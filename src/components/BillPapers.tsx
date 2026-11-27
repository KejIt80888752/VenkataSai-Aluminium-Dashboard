/* ── Your own paper, on the screen you are typing into ─────────────────────
   Theirs, on 27-11: "hand written bills unable to upload."

   A counter book is read with one eye and typed with the other, and until
   now the screen offered nowhere to put the book. A bill is photographed on
   the phone or chosen off the machine here, and it stays — open beside the
   sheet while it is being typed, and kept against the day it was taken so
   the paper can be found again when somebody queries the bill.

   What it does not do is read the handwriting. That wants a model running
   on a server, and the shop has no server yet; saying otherwise would be
   worth nothing the first time it read 11 as 17. This holds the paper and
   keeps the typing beside it.                                             */

import { useEffect, useRef, useState } from 'react'
import {
  Camera, Upload, Trash2, Info, FileText, Maximize2, ZoomIn, ZoomOut, Pin,
} from 'lucide-react'
import { Modal } from '@/components/ui'
import ReadBill from '@/components/ReadBill'
import {
  addPapers, usePapers, removePaper, notePaper, paperBlob, usePinnedPaper, kb, whenOf, type Paper,
} from '@/lib/papers'

/** One blob url per paper on screen, given back when it leaves. */
function usePaperUrl(id?: string) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!id) { setUrl(''); return }
    let alive = true
    let made = ''
    paperBlob(id).then(b => {
      if (!b || !alive) return
      made = URL.createObjectURL(b)
      setUrl(made)
    })
    return () => { alive = false; if (made) URL.revokeObjectURL(made) }
  }, [id])
  return url
}

function Thumb({ paper, onOpen }: { paper: Paper; onOpen: () => void }) {
  const url = usePaperUrl(paper.id)
  const pdf = paper.type === 'application/pdf'
  return (
    <button onClick={onOpen} className="block w-full text-left rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--border-2)', background: 'var(--bg-card2)' }}
      title="Open it full size">
      <span className="flex items-center justify-center h-28 overflow-hidden"
        style={{ background: 'var(--bg-app)' }}>
        {pdf
          ? <FileText size={28} style={{ color: 'var(--text-4)' }} />
          : url
            /* The top of a bill is the part that says which bill it is. */
            ? <img src={url} alt={paper.name} className="w-full h-28 object-cover object-top" />
            : <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>opening…</span>}
      </span>
      <span className="block px-2 py-1.5">
        <span className="block text-[11px] font-medium truncate" style={{ color: 'var(--text-1)' }}>
          {paper.note || paper.name}
        </span>
        <span className="block text-[10px]" style={{ color: 'var(--text-4)' }}>
          {whenOf(paper.at)} · {kb(paper.bytes)}
        </span>
      </span>
    </button>
  )
}

/** The paper, full size, with a magnifier for a figure somebody cannot read. */
function Viewer({ paper, onClose, onDelete }: {
  paper: Paper; onClose: () => void; onDelete: () => void
}) {
  const url = usePaperUrl(paper.id)
  const [zoom, setZoom] = useState(1)
  const [note, setNote] = useState(paper.note ?? '')
  const pdf = paper.type === 'application/pdf'

  return (
    <Modal open onClose={onClose} title={paper.note || paper.name} wide>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input className="input !py-1 !text-xs flex-1 min-w-[12rem]" value={note}
            placeholder="Write what this paper is — Mahaveer 13-02"
            onChange={e => setNote(e.target.value)}
            onBlur={() => note !== (paper.note ?? '') && notePaper(paper.id, note.trim())} />
          {!pdf && (
            <>
              <button className="btn-outline !py-1 !text-xs" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}>
                <ZoomOut size={13} />
              </button>
              <span className="text-[11px] tabular-nums w-10 text-center" style={{ color: 'var(--text-3)' }}>
                {Math.round(zoom * 100)}%
              </span>
              <button className="btn-outline !py-1 !text-xs" onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))}>
                <ZoomIn size={13} />
              </button>
            </>
          )}
          {url && (
            <a className="btn-outline !py-1 !text-xs" href={url} target="_blank" rel="noreferrer">
              <Maximize2 size={13} /> Own window
            </a>
          )}
          <button className="btn-ghost !py-1 !text-xs" style={{ color: 'var(--red)' }} onClick={onDelete}>
            <Trash2 size={13} /> Remove
          </button>
        </div>

        <div className="rounded-lg overflow-auto" style={{ border: '1px solid var(--border-2)', maxHeight: '70vh' }}>
          {pdf
            ? url
              ? <iframe src={url} title={paper.name} className="w-full" style={{ height: '70vh', border: 0 }} />
              : null
            : url
              ? <img src={url} alt={paper.name}
                  style={{ width: `${zoom * 100}%`, maxWidth: 'none', display: 'block' }} />
              : <p className="p-6 text-sm" style={{ color: 'var(--text-4)' }}>Opening the paper…</p>}
        </div>
      </div>
    </Modal>
  )
}

export default function BillPapers({ compact = false }: { compact?: boolean }) {
  const { papers, loading, error } = usePapers()
  const [open, setOpen] = useState<Paper | null>(null)
  const [pinned, setPinned] = usePinnedPaper()
  const [msg, setMsg] = useState('')
  const pick = useRef<HTMLInputElement>(null)
  const shoot = useRef<HTMLInputElement>(null)

  const take = async (files: FileList | null) => {
    if (!files?.length) return
    const { added, refused } = await addPapers(files)
    setMsg(
      refused.length
        ? `${added.length} kept. ${refused.map(r => `${r.name} — ${r.why}`).join('; ')}`
        : added.length === 1 ? 'Kept on this machine.' : `${added.length} papers kept on this machine.`,
    )
    if (added.length && !pinned) setPinned(added[0].id)
  }

  const shown = papers.find(p => p.id === pinned) ?? papers[0]
  const pinnedUrl = usePaperUrl(compact ? shown?.id : undefined)

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="rounded-lg p-3.5 flex items-start gap-2 text-[12px]"
          style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)', color: 'var(--text-3)' }}>
          <Info size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} />
          <span>
            <b style={{ color: 'var(--text-1)' }}>Put the paper here.</b> Photograph the bill with the phone
            or choose a scan off this machine, as many at a time as you like. It opens full size and
            magnifies, so it can sit beside you while the sheet is typed on the next tab. It stays on this
            machine — nothing is sent anywhere — and the handwriting is still read by you, not by the
            system.
          </span>
        </div>
      )}

      {!compact && (
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="section-title text-base">Your Papers</p>
            <p className="section-sub">
              {loading ? 'Looking…'
                : papers.length ? `${papers.length} kept on this machine` : 'Nothing here yet'}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn-outline" onClick={() => shoot.current?.click()}>
              <Camera size={14} /> Photograph it
            </button>
            <button className="btn" onClick={() => pick.current?.click()}>
              <Upload size={14} /> Choose a file
            </button>
          </div>
          {/* The phone opens its camera on this one; a computer treats it as
              another file box, which is the right thing on both. */}
          <input ref={shoot} type="file" accept="image/*" capture="environment" multiple className="hidden"
            onChange={e => { take(e.target.files); e.target.value = '' }} />
          <input ref={pick} type="file" accept="image/*,application/pdf" multiple className="hidden"
            onChange={e => { take(e.target.files); e.target.value = '' }} />
        </div>

        {error && (
          <p className="text-[11.5px] mt-3" style={{ color: 'var(--red)' }}>
            This browser will not keep files here — {error}. Chrome or Edge on the office machine will.
          </p>
        )}
        {msg && <p className="text-[11.5px] mt-3" style={{ color: 'var(--text-3)' }}>{msg}</p>}

        {papers.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
            {papers.map(p => (
              <div key={p.id} className="relative">
                <Thumb paper={p} onOpen={() => setOpen(p)} />
                <button className="absolute top-1 right-1 rounded-md p-1"
                  title={pinned === p.id ? 'Shown beside the sheet' : 'Show this one beside the sheet'}
                  style={{
                    background: pinned === p.id ? 'var(--brand)' : 'rgba(255,255,255,.85)',
                    color: pinned === p.id ? '#fff' : '#334155',
                  }}
                  onClick={() => setPinned(pinned === p.id ? '' : p.id)}>
                  <Pin size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {!loading && !papers.length && !error && (
          <p className="text-sm mt-4" style={{ color: 'var(--text-4)' }}>
            Photograph the bill with the phone, or choose a scan. A photograph straight off a phone is fine —
            it is brought down to a size the screen can open at once, and the figures stay readable.
          </p>
        )}
      </div>
      )}

      {/* ── Reading it ───────────────────────────────────────────────────
          Theirs, on 27-11: "ella bill upload panna varanum." Whichever paper
          is pinned is the one offered to the reader, so the bill on the
          screen is the bill being read. */}
      {!compact && shown && <ReadBill paper={shown} />}

      {/* Beside the sheet: the one paper somebody is typing from. */}
      {compact && shown && (
        <div className="card">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="section-title text-sm">{shown.note || shown.name}</p>
            <button className="btn-ghost !py-1 !text-xs" onClick={() => setOpen(shown)}>
              <Maximize2 size={13} /> Full size
            </button>
          </div>
          {shown.type === 'application/pdf'
            ? <iframe src={pinnedUrl} title={shown.name} className="w-full rounded-lg"
                style={{ height: '22rem', border: '1px solid var(--border-2)' }} />
            : <img src={pinnedUrl} alt={shown.name} className="w-full rounded-lg object-contain"
                style={{ maxHeight: '22rem', border: '1px solid var(--border-2)' }} />}
        </div>
      )}

      {open && (
        <Viewer paper={open}
          onClose={() => setOpen(null)}
          onDelete={async () => {
            await removePaper(open.id)
            if (pinned === open.id) setPinned('')
            setOpen(null)
            setMsg('That paper has been taken off this machine.')
          }} />
      )}
    </div>
  )
}
