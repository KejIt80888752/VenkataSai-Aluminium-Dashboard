/* ── Reading what is on the paper, here on the machine ─────────────────────
   Theirs, on 27-11: "ella bill upload panna varanum" — upload a bill and it
   should come in.

   So it is read. Not on a server — there is none yet — but in the browser
   itself, with the reader downloaded once and kept. What that buys and what
   it does not is worth being exact about, because the shop is going to hold
   a bill up to it and judge it:

     A printed depot DC reads well. The codes, the counts and the weights
     come off it in a form somebody only has to glance over.

     Handwriting reads badly, and a pencil figure worse. Four and nine
     change places, a 1 becomes a 7, and a column written on a slant lands
     in the wrong column. That is not a setting to tune; reading handwriting
     properly is a model on a server, which is the next thing to buy.

   So nothing it reads is kept until somebody has looked at it. Every figure
   comes up on a review sheet with the weakest ones marked, and the office
   presses the button that puts them on their own sheet.                    */

export interface ReadLine {
  /** the line as the reader saw it */
  text: string
  /** 0–100, the reader's own opinion of that line */
  confidence: number
}

export interface ReadResult {
  lines: ReadLine[]
  text: string
  /** 0–100 across the page */
  confidence: number
}

export type Progress = (p: { stage: string; pct: number }) => void

const STAGE: Record<string, string> = {
  'loading tesseract core': 'Fetching the reader',
  'loading language traineddata': 'Fetching the English reader',
  'initializing tesseract': 'Starting the reader',
  'initializing api': 'Starting the reader',
  'recognizing text': 'Reading the paper',
}

/* The reader is two or three megabytes. It is fetched once, kept by the
   browser, and only ever asked for when somebody presses Read. */
export async function readPaper(blob: Blob, onProgress?: Progress): Promise<ReadResult> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: m => onProgress?.({
      stage: STAGE[m.status] ?? m.status,
      pct: Math.round((m.progress ?? 0) * 100),
    }),
  })
  try {
    const { data } = await worker.recognize(blob)
    /* Tesseract hands back a block of text with its own line breaks; the
       per-line confidence is what tells a good row from a guess. */
    const lines: ReadLine[] = (data as unknown as {
      lines?: { text: string; confidence: number }[]
    }).lines?.map(l => ({ text: l.text.replace(/\s+$/, ''), confidence: Math.round(l.confidence) }))
      ?? data.text.split('\n').map(t => ({ text: t, confidence: Math.round(data.confidence) }))
    return {
      lines: lines.filter(l => l.text.trim()),
      text: data.text,
      confidence: Math.round(data.confidence),
    }
  } finally {
    await worker.terminate()
  }
}
