/* ── A WhatsApp chat, read back out of the file WhatsApp writes ────────────
   Theirs, on 27-11: "download whatsapp chat as it looks like in whatsapp,
   to be downloaded as pdf."

   WhatsApp will export a chat itself — in the chat, ⋮ → More → Export chat →
   Without media — and what comes out is one plain text file. It reads as a
   log, not as the conversation: every line the same size, no sides, no days.
   This reads that file back into messages so the screen can lay it out the
   way the phone does, and the browser can print it to PDF.

   Two shapes of line come out of WhatsApp, and both are here:
     [27/11/26, 5:15:11 PM] Rohith: text        — iPhone
     27/11/26, 5:15 pm - Rohith: text           — Android
   A line that is neither belongs to the message above it, because that is
   what a message with a second paragraph looks like in the file.          */

export interface ChatMsg {
  id: number
  at: Date | null
  /** yyyy-mm-dd, for the day divider. */
  day: string
  time: string
  /** null on the notices WhatsApp writes itself. */
  from: string | null
  text: string
  /** "photo", "video", "sticker", "document", "audio" — what was sent with it. */
  media?: string
  /** the file WhatsApp wrote beside the text, when the export carried one */
  file?: string
}

/* WhatsApp sprinkles direction marks and a narrow no-break space through the
   file. They are invisible and they break every pattern they touch. */
const clean = (s: string) =>
  s.replace(/[‎‏‪-‮]/g, '').replace(/[  ]/g, ' ')

const IOS = /^\[(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?\s?m\.?)?\]\s*([\s\S]*)$/i
const AND = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?\s?m\.?)?\s+-\s+([\s\S]*)$/i

/* "image omitted", "<attached: …jpg>", "IMG-2026.jpg (file attached)" */
const MEDIA: [RegExp, string][] = [
  [/(image|photo)\s+omitted|\.(jpg|jpeg|png|webp|heic)\b/i, 'photo'],
  [/video\s+omitted|\.(mp4|mov|3gp)\b/i, 'video'],
  [/sticker\s+omitted/i, 'sticker'],
  [/(audio|voice\s*message)\s+omitted|\.(opus|m4a|mp3|ogg)\b/i, 'audio'],
  [/document\s+omitted|\.(pdf|docx?|xlsx?|csv|zip)\b/i, 'document'],
  [/GIF\s+omitted/i, 'GIF'],
  [/Contact\s+card\s+omitted/i, 'contact'],
]

const mediaOf = (text: string): string | undefined => {
  if (!/omitted|attached|<attached/i.test(text)) return undefined
  for (const [re, kind] of MEDIA) if (re.test(text)) return kind
  return 'attachment'
}

/* ── The picture itself, where they exported one ───────────────────────────
   Theirs, on 27-11: "media also required sir, payment screen shots, etc."

   Exported "With media", WhatsApp writes the file beside the text and names
   it in the line — <attached: 00000042-PHOTO-….jpg> on an iPhone,
   IMG-20261127-WA0012.jpg (file attached) on Android. The name is lifted out
   so the picture can be put back against its own message, and what is left
   is the caption, which is the part worth reading.                         */
const FILE_LINE = [
  /<attached:\s*([^>]+?)\s*>/i,
  /^\s*([\w .()\-]+\.[a-z0-9]{2,4})\s*\(file attached\)\s*/im,
]

const fileOf = (text: string): { file?: string; rest: string } => {
  for (const re of FILE_LINE) {
    const m = text.match(re)
    if (m) return { file: m[1].trim(), rest: text.replace(re, '').trim() }
  }
  return { rest: text }
}

const two = (n: number) => String(n).padStart(2, '0')

function stamp(d: string, m: string, y: string, hh: string, mm: string, ampm?: string) {
  let year = Number(y); if (year < 100) year += 2000
  let hour = Number(hh)
  const ap = (ampm ?? '').toLowerCase().replace(/[^apm]/g, '')
  if (ap.startsWith('p') && hour < 12) hour += 12
  if (ap.startsWith('a') && hour === 12) hour = 0
  /* The day and the month cannot be told apart in 03/04/26, so the Indian
     order is taken — which is what the phones in the shop are set to. */
  let day = Number(d), mon = Number(m)
  if (mon > 12 && day <= 12) { const t = day; day = mon; mon = t }
  const at = new Date(year, mon - 1, day, hour, Number(mm))
  return {
    at: Number.isNaN(at.getTime()) ? null : at,
    day: `${year}-${two(mon)}-${two(day)}`,
    time: `${two(hour % 12 === 0 ? 12 : hour % 12)}:${two(Number(mm))} ${hour < 12 ? 'am' : 'pm'}`,
  }
}

/** A name can hold a colon — "Dr. R: " is a message, "ROHITH: " is a sender. */
const splitSender = (rest: string): { from: string | null; text: string } => {
  const m = rest.match(/^([^:\n]{1,64}?):\s?([\s\S]*)$/)
  if (!m) return { from: null, text: rest }
  const from = m[1].replace(/^~\s*/, '').trim()
  /* WhatsApp's own notices carry no sender and often no colon; the few that
     do read as a sentence, not a name. */
  if (!from || /\s(added|left|created|changed|joined|removed|pinned)\s/i.test(from)) {
    return { from: null, text: rest }
  }
  return { from, text: m[2] }
}

export function parseChat(raw: string): ChatMsg[] {
  const out: ChatMsg[] = []
  let id = 0
  for (const line of clean(raw).split(/\r?\n/)) {
    const m = line.match(IOS) ?? line.match(AND)
    if (!m) {
      /* A paragraph of the message above it. An empty first line is nothing. */
      if (out.length) out[out.length - 1].text += '\n' + line
      continue
    }
    const [, d, mo, y, hh, mm, , ampm, rest] = m
    const when = stamp(d, mo, y, hh, mm, ampm)
    const { from, text } = splitSender(rest)
    const kind = mediaOf(text)
    const { file, rest: body } = kind ? fileOf(text) : { file: undefined, rest: text }
    out.push({ id: id++, ...when, from, text: body, media: kind, file })
  }
  /* A trailing blank paragraph is the file's own newline; a leading one is
     what is left where a picture's name has been lifted off the top of its
     own caption. */
  for (const msg of out) msg.text = msg.text.trim()
  return out
}

/** Who speaks in this chat, busiest first — so the office can say which is theirs. */
export function sendersOf(msgs: ChatMsg[]): { name: string; count: number }[] {
  const by = new Map<string, number>()
  for (const m of msgs) if (m.from) by.set(m.from, (by.get(m.from) ?? 0) + 1)
  return [...by.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

/** "Today", "Yesterday", else "27 November 2026, Friday" — as the phone writes it. */
export function dayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const now = new Date()
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const yest = new Date(now); yest.setDate(yest.getDate() - 1)
  if (same(date, now)) return 'Today'
  if (same(date, yest)) return 'Yesterday'
  return `${d} ${MONTHS[m - 1]} ${y}, ${DAYS[date.getDay()]}`
}

/** A sender's colour, the way WhatsApp gives each person one in a group. */
const INK = ['#1f7aec', '#d9348a', '#1fa855', '#8b5cf6', '#c4701a', '#0f9b8e', '#b4332d', '#5b6ab0']
export const inkOf = (name: string) => {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 9973
  return INK[h % INK.length]
}
