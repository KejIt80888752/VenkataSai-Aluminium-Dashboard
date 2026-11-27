/* ── A WhatsApp chat, on paper, looking like WhatsApp ──────────────────────
   Theirs, on 27-11: "download whatsapp chat as it looks like in whatsapp,
   to be downloaded as pdf."

   WhatsApp's own export is a text log — every line the same, no sides, no
   days. An order argued out over a week is unreadable in it, and it is that
   argument they want to keep beside the bill. So the file is read back into
   messages and laid out the way the phone lays it out: days announced, their
   own messages on the right, each name in its own colour, and the paper set
   up so a bubble is never cut in half by a page break.

   It is all done on this machine. The chat is never sent anywhere.        */

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageSquare, Printer, Upload, Trash2, Info, Image as ImageIcon } from 'lucide-react'
import { unzip } from 'fflate'
import { PageHead, Select, Stat } from '@/components/ui'
import { parseChat, sendersOf, dayLabel, inkOf, type ChatMsg } from '@/lib/chatexport'

const MEDIA_WORD: Record<string, string> = {
  photo: 'Photo', video: 'Video', sticker: 'Sticker', audio: 'Voice message',
  document: 'Document', GIF: 'GIF', contact: 'Contact', attachment: 'Attachment',
}

/* ── The pictures that came with it ────────────────────────────────────────
   Theirs, on 27-11: "media also required sir, payment screen shots, etc."

   A payment is settled in a screenshot, and a chat printed without them
   proves nothing. Exported "With media", WhatsApp writes the pictures beside
   the text — one zip on an iPhone, a folder of files on Android — so both
   are taken here, and each picture is put back against the message that
   named it. The files never leave this machine; they are read straight into
   the page.                                                                */
export type Media = Record<string, { url: string; type: string }>

const PICTURE = /\.(jpe?g|png|gif|webp|heic|bmp)$/i
const typeOf = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : ext === 'png' ? 'image/png'
    : ext === 'gif' ? 'image/gif'
    : ext === 'webp' ? 'image/webp'
    : 'application/octet-stream'
}
/* WhatsApp's own folder names travel with the file on some phones, and the
   text names it without them. The last part is what matches. */
const keyOf = (path: string) => path.split('/').pop()!.toLowerCase()

export default function ChatPdf() {
  const [raw, setRaw] = useState('')
  const [title, setTitle] = useState('')
  const [me, setMe] = useState('')
  const [showNotices, setShowNotices] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [media, setMedia] = useState<Media>({})
  const [msg, setMsg] = useState('')
  const pick = useRef<HTMLInputElement>(null)
  /** every picture handed to the page, so none is left behind in memory */
  const urls = useRef<string[]>([])

  useEffect(() => () => { urls.current.forEach(URL.revokeObjectURL) }, [])

  /* The portal has to be on the page before the print dialog opens, so the
     copy is put up first and printed on the next paint. */
  useEffect(() => {
    if (!printing) return
    const done = () => setPrinting(false)
    window.addEventListener('afterprint', done)
    const t = setTimeout(() => window.print(), 60)
    return () => { window.removeEventListener('afterprint', done); clearTimeout(t) }
  }, [printing])

  const msgs = useMemo(() => parseChat(raw), [raw])
  const senders = useMemo(() => sendersOf(msgs), [msgs])

  /* Whoever wrote the most is usually the one holding the phone; it can be
     changed, and until a chat is loaded there is nobody to choose. */
  const mine = me || senders[0]?.name || ''
  const shown = showNotices ? msgs : msgs.filter(m => m.from)

  const days = useMemo(() => {
    const out: { day: string; msgs: ChatMsg[] }[] = []
    for (const m of shown) {
      if (!out.length || out[out.length - 1].day !== m.day) out.push({ day: m.day, msgs: [m] })
      else out[out.length - 1].msgs.push(m)
    }
    return out
  }, [shown])

  const nameIt = (fileName: string) => {
    if (title) return
    setTitle(fileName.replace(/^WhatsApp Chat (with )?/i, '').replace(/\.(txt|zip)$/i, '').trim())
  }

  const addMedia = (name: string, data: BlobPart, type: string) => {
    const url = URL.createObjectURL(new Blob([data], { type }))
    urls.current.push(url)
    setMedia(m => ({ ...m, [keyOf(name)]: { url, type } }))
  }

  /** The zip an iPhone writes: the chat and its pictures in one file. */
  const openZip = (f: File) => {
    f.arrayBuffer().then(buf => {
      unzip(new Uint8Array(buf), (err, files) => {
        if (err) { setMsg('That zip could not be opened. Choose the .txt and the pictures instead.'); return }
        for (const [path, data] of Object.entries(files)) {
          if (!data.length || path.endsWith('/')) continue
          if (/\.txt$/i.test(path)) { setRaw(new TextDecoder().decode(data)); nameIt(path.split('/').pop()!) }
          else if (PICTURE.test(path)) addMedia(path, data, typeOf(path))
        }
        setMsg('')
      })
    })
  }

  /* Both exports are taken: the zip, and the loose files an Android phone
     leaves in a folder, which are chosen together. */
  const load = (files: FileList) => {
    for (const f of Array.from(files)) {
      if (/\.zip$/i.test(f.name)) { openZip(f); continue }
      if (/\.txt$/i.test(f.name)) {
        const r = new FileReader()
        r.onload = () => { setRaw(String(r.result ?? '')); nameIt(f.name) }
        r.readAsText(f)
        continue
      }
      if (PICTURE.test(f.name)) addMedia(f.name, f, f.type || typeOf(f.name))
    }
  }

  const span = msgs.length
    ? msgs[0].day === msgs[msgs.length - 1].day
      ? dayLabel(msgs[0].day)
      : `${dayLabel(msgs[0].day)} → ${dayLabel(msgs[msgs.length - 1].day)}`
    : '—'

  return (
    <div>
      <PageHead title="WhatsApp Chat → PDF"
        sub="The chat as it reads on the phone, on paper you can file beside the order">
        <button className="btn-outline" onClick={() => pick.current?.click()}>
          <Upload size={14} /> Choose exported chat
        </button>
        <button className="btn" disabled={!msgs.length} onClick={() => setPrinting(true)}>
          <Printer size={14} /> Print / Save PDF
        </button>
        <input ref={pick} type="file" multiple accept=".txt,.zip,image/*,text/plain,application/zip"
          className="hidden"
          onChange={e => { if (e.target.files?.length) load(e.target.files); e.target.value = '' }} />
      </PageHead>

      {!msgs.length ? (
        <div className="card print:hidden">
          <p className="section-title text-base mb-1 flex items-center gap-2">
            <MessageSquare size={16} className="text-brand" /> Bring the chat across
          </p>
          <p className="section-sub mb-4">
            On the phone, open the chat → ⋮ (or the contact name) → <b>More</b> → <b>Export chat</b> →
            <b> With media</b>, so the payment screenshots come across too. An iPhone writes one <b>.zip</b>;
            an Android phone writes a <b>.txt</b> with the pictures beside it — choose them all together.
            Everything is read on this machine and sent nowhere.
          </p>
          <textarea className="input w-full min-h-[11rem] font-mono !text-[11px]"
            placeholder={'[27/11/26, 5:15:11 PM] Rohith: Sir, the estimate is ready\n[27/11/26, 5:38:37 PM] Office: Ok, raising the bill'}
            value={raw} onChange={e => setRaw(e.target.value)} />
          <p className="text-[11px] mt-2 flex items-start gap-1.5" style={{ color: 'var(--text-4)' }}>
            <Info size={12} className="mt-0.5 shrink-0" />
            Exported <b className="mx-1">Without media</b> instead? The chat still reads in full — it says where
            each picture was sent, in its place.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5 print:hidden">
            <Stat label="Messages" value={String(msgs.length)} icon={MessageSquare} tone="brand"
              sub={`${senders.length} ${senders.length === 1 ? 'person' : 'people'} speaking`} />
            <Stat label="Covering" value={String(days.length)} icon={MessageSquare} tone="violet"
              sub={days.length === 1 ? 'one day' : `days · ${span}`} />
            <Stat label="Pictures" value={`${Object.keys(media).length} of ${msgs.filter(m => m.media).length}`}
              icon={ImageIcon} tone={Object.keys(media).length ? 'green' : 'amber'}
              sub={Object.keys(media).length
                ? 'came across and print with the chat'
                : 'export again With media to bring them across'} />
            <Stat label="Notices" value={String(msgs.filter(m => !m.from).length)} icon={Info} tone="green"
              sub="WhatsApp's own lines, which can be left off" />
          </div>

          <div className="card mb-5 print:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Heading on the paper</label>
                <input className="input w-full" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="Venkata Sai Aluminium · Rohith" />
              </div>
              <div>
                <label className="label">Which of these is ours</label>
                <Select value={mine} onChange={setMe} className="w-full"
                  options={senders.map(s => s.name)}
                  title="Their messages sit on the right, the way the phone shows your own" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm pb-2" style={{ color: 'var(--text-2)' }}>
                  <input type="checkbox" className="accent-[var(--brand)]" checked={showNotices}
                    onChange={e => setShowNotices(e.target.checked)} />
                  Keep WhatsApp's own notices
                </label>
              </div>
            </div>
            <div className="flex justify-end mt-3 pt-3" style={{ borderTop: '1px solid var(--border-2)' }}>
              <button className="btn-ghost !text-xs" style={{ color: 'var(--red)' }}
                onClick={() => {
                  urls.current.forEach(URL.revokeObjectURL); urls.current = []
                  setRaw(''); setMe(''); setTitle(''); setMedia({}); setMsg('')
                }}>
                <Trash2 size={13} /> Clear this chat off the screen
              </button>
            </div>
          </div>

          {msg && <p className="text-[11.5px] mb-3 print:hidden" style={{ color: 'var(--amber)' }}>{msg}</p>}

          <Paper title={title} span={span} count={msgs.length} days={days} mine={mine}
            people={senders.length} media={media} />

          {/* ── On paper ────────────────────────────────────────────────
              Printing goes through the same portal the bills use: the page
              itself is taken off the paper, so what comes out is the chat
              and nothing around it. It is kept off the screen until the
              browser asks for it. */}
          {printing && createPortal(
            <div id="doc-print-area" className="hidden print:block">
              <Paper title={title} span={span} count={msgs.length} days={days} mine={mine}
                people={senders.length} media={media} />
            </div>,
            document.getElementById('print-root')!,
          )}
        </>
      )}
    </div>
  )
}

/* ── The chat as the phone draws it ───────────────────────────────────────
   One component, used for the preview on the screen and for the copy that
   goes to paper, so what they see is what prints.                         */
function Paper({ title, span, count, days, mine, people, media }: {
  title: string; span: string; count: number
  days: { day: string; msgs: ChatMsg[] }[]
  mine: string; people: number; media: Media
}) {
  return (
          <div className="chat-paper rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border-2)' }}>
            {/* The bar at the top of a WhatsApp chat, and what this paper is. */}
            <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: '#f0f2f5' }}>
              <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: '#dfe5e7', color: '#54656f' }}>
                <MessageSquare size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold truncate" style={{ color: '#111b21' }}>
                  {title || 'WhatsApp chat'}
                </span>
                <span className="block text-[11px]" style={{ color: '#667781' }}>
                  {count} messages · {span}
                </span>
              </span>
            </div>

            <div className="px-3 py-4 space-y-2" style={{ background: '#efeae2' }}>
              {days.map(d => (
                <div key={d.day} className="chat-day space-y-1.5">
                  <p className="flex justify-center my-3">
                    <span className="px-3 py-1 rounded-md text-[11px] font-medium uppercase tracking-wide"
                      style={{ background: '#ffffff', color: '#54656f', boxShadow: '0 1px 0.5px rgba(11,20,26,.13)' }}>
                      {dayLabel(d.day)}
                    </span>
                  </p>

                  {d.msgs.map(m => {
                    if (!m.from) return (
                      <p key={m.id} className="flex justify-center">
                        <span className="chat-bubble px-3 py-1 rounded-md text-[10.5px] text-center max-w-[80%]"
                          style={{ background: '#ffeecd', color: '#54656f' }}>{m.text}</span>
                      </p>
                    )
                    const own = m.from === mine
                    return (
                      <div key={m.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                        <div className="chat-bubble max-w-[76%] px-2.5 py-1.5 text-[12px]"
                          style={{
                            background: own ? '#d9fdd3' : '#ffffff',
                            color: '#111b21',
                            borderRadius: own ? '7.5px 7.5px 2px 7.5px' : '7.5px 7.5px 7.5px 2px',
                            boxShadow: '0 1px 0.5px rgba(11,20,26,.13)',
                          }}>
                          {/* In a group the name sits above the words, in its own colour. */}
                          {!own && people > 2 && (
                            <span className="block text-[11px] font-semibold mb-0.5" style={{ color: inkOf(m.from) }}>
                              {m.from}
                            </span>
                          )}
                          {/* The screenshot itself, where the export carried
                              it — theirs, on 27-11: "media also required sir,
                              payment screen shots, etc." A picture that did
                              not come across still says where it was. */}
                          {m.media && (() => {
                            const pic = m.file ? media[m.file.toLowerCase()] : undefined
                            return pic ? (
                              <img src={pic.url} alt={m.file}
                                className="chat-photo block rounded mb-1"
                                style={{ maxWidth: '100%', maxHeight: '360px', objectFit: 'contain' }} />
                            ) : (
                              <span className="block text-[11px] italic mb-0.5" style={{ color: '#667781' }}>
                                {MEDIA_WORD[m.media] ?? 'Attachment'}
                                {m.media === 'video' || m.media === 'audio' || m.media === 'document'
                                  ? ' — not shown on paper' : ' — not in the export'}
                              </span>
                            )
                          })()}
                          <span className="whitespace-pre-wrap break-words">{m.text}</span>
                          <span className="block text-right text-[10px] mt-0.5" style={{ color: '#667781' }}>
                            {m.time}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            <p className="px-4 py-2 text-[10px] text-center" style={{ background: '#f0f2f5', color: '#667781' }}>
              Exported from WhatsApp and printed from the dashboard · {span}
            </p>
          </div>
  )
}
