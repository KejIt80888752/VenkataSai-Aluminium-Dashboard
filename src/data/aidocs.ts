/* ── AI document capture ────────────────────────────────────────────────
   A photo of the counter book usually holds several customers' slips on one
   page. The extractor splits the sheet into separate bills, assigns a
   temporary ID to each, resolves the scrawled names against the alias map,
   and hands anything it is unsure about to a human. Every correction feeds
   back as a training sample, which is what the correction report tracks.  */

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(90210777)
const between = (a: number, b: number) => a + rnd() * (b - a)
const iBetween = (a: number, b: number) => Math.floor(between(a, b + 1))
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]

export type DocType = 'Handwritten Sale Slip' | 'Handwritten Purchase DC' | 'Computerised Purchase Invoice' | 'Coating Job Card'
export type BillStatus = 'Auto-Approved' | 'Needs Review' | 'Corrected & Posted' | 'Rejected'

export interface ExtractedLine {
  rawText: string
  mappedCode: string
  mappedName: string
  qty: number
  unit: string
  rate: number
  amount: number
  confidence: number
  flagged: boolean
}

export interface Correction {
  field: string
  ocrValue: string
  correctedValue: string
  by: string
}

export interface CapturedBill {
  tempId: string
  batchId: string
  sourceImage: string
  billIndex: number
  billsInImage: number
  docType: DocType
  capturedAt: string
  billDate: string
  rawPartyName: string
  mappedPartyId: string
  mappedPartyName: string
  billNo: string
  lines: ExtractedLine[]
  extractedTotal: number
  computedTotal: number
  confidence: number
  status: BillStatus
  corrections: Correction[]
  postedTo: string
}

/* ── Source material ────────────────────────────────────────────────── */
const RAW_ITEMS: [string, string, string, string, number][] = [
  // scrawl, code, master name, unit, indicative rate
  ['2 TRK OUTER FRM',   'VSA-SL-2T-OF', '2 Track Sliding Outer Frame', 'kg',  286],
  ['2 TRK SHUTTER',     'VSA-SL-2T-SH', '2 Track Sliding Shutter',     'kg',  286],
  ['3 TRK OF',          'VSA-SL-3T-OF', '3 Track Sliding Outer Frame', 'kg',  328],
  ['INTRLOCK',          'VSA-SL-INTL',  'Sliding Interlock Section',   'kg',  286],
  ['BEEDING',           'VSA-OP-BEAD',  'Glazing Bead — Casement',     'kg',  290],
  ['T PATTY',           'VSA-PT-TPAT',  'T-Patti Partition Section',   'kg',  322],
  ['GLASS 5MM',         'VSA-GL-5CL',   'Clear Float Glass 5mm',       'sqft', 62],
  ['ROLLER',            'VSA-HW-ROLL',  'Sliding Roller — Bearing',    'nos',  96],
  ['LOCK',              'VSA-HW-LOCK',  'Sliding Window Touch Lock',   'nos', 148],
  ['SILICON',           'VSA-CN-SIL',   'Silicone Sealant',            'nos', 365],
  ['GASKET MTR',        'VSA-CN-GSKT',  'EPDM Gasket (per mtr)',       'nos',  14],
  ['HANDLE SS',         'VSA-HW-HAND',  'Casement Handle — SS',        'nos', 210],
]

const PARTIES: [string, string, string][] = [
  ['SRI BALAJI ALU FAB',  'C01', 'Sri Balaji Aluminium Fabricators'],
  ['PERFECT GLASS',       'C03', 'Perfect Glass & Aluminium Works'],
  ['METRO FAB',           'C07', 'Metro Aluminium Fabricators'],
  ['SAI KRUPA',           'C04', 'Sai Krupa Interiors'],
  ['SHAKTI FAB',          'C10', 'Shakti Fabrication Works'],
  ['MODERN W&D',          'C11', 'Modern Windows & Doors'],
  ['CASH / COUNTER',      'C12', 'Rajesh Kumar (Retail)'],
  ['VENKATESHWARA TRD',   'C06', 'Venkateshwara Traders'],
]

const OPERATORS = ['Kavya M', 'Srinivas B', 'Ganesh P']

/* ── Upload batches: one photo, several slips ───────────────────────── */
export interface Batch {
  id: string
  file: string
  uploadedAt: string
  uploadedBy: string
  docType: DocType
  billsFound: number
  pagesInFile: number
  engine: 'VSA Handwriting Model v4' | 'VSA Handwriting Model v3' | 'Printed OCR + LLM'
  processingMs: number
  status: 'Processed' | 'Processing' | 'Needs Review'
}

const BATCH_DEFS: [string, DocType, number, string][] = [
  ['counter-book-19aug.jpg',     'Handwritten Sale Slip',         4, '2026-08-19'],
  ['counter-book-18aug.jpg',     'Handwritten Sale Slip',         3, '2026-08-18'],
  ['jindal-invoice-8841.pdf',    'Computerised Purchase Invoice', 1, '2026-08-18'],
  ['pcu1-jobcard-lot118.jpg',    'Coating Job Card',              2, '2026-08-17'],
  ['bhoruka-dc-2219.jpg',        'Handwritten Purchase DC',       1, '2026-08-17'],
  ['counter-book-16aug.jpg',     'Handwritten Sale Slip',         5, '2026-08-16'],
  ['ozone-hardware-bill.pdf',    'Computerised Purchase Invoice', 1, '2026-08-15'],
  ['counter-book-14aug.jpg',     'Handwritten Sale Slip',         3, '2026-08-14'],
]

export const BATCHES: Batch[] = BATCH_DEFS.map(([file, docType, bills, date], i) => ({
  id: `BAT${i + 1}`,
  file,
  uploadedAt: `${date} ${String(iBetween(9, 19)).padStart(2, '0')}:${String(iBetween(10, 59))}`,
  uploadedBy: pick(OPERATORS),
  docType,
  billsFound: bills,
  pagesInFile: file.endsWith('.pdf') ? iBetween(1, 3) : 1,
  engine: docType.startsWith('Handwritten') || docType === 'Coating Job Card'
    ? (i % 4 === 3 ? 'VSA Handwriting Model v3' : 'VSA Handwriting Model v4')
    : 'Printed OCR + LLM',
  processingMs: iBetween(1400, 5200),
  status: i === 0 ? 'Needs Review' : 'Processed',
}))

/* ── Split each batch into one record per customer bill ─────────────── */
let tmpSeq = 0

export const CAPTURED: CapturedBill[] = BATCHES.flatMap(b =>
  Array.from({ length: b.billsFound }, (_, k) => {
    const [rawParty, partyId, partyName] = pick(PARTIES)
    const nLines = iBetween(1, 4)
    const printed = b.engine === 'Printed OCR + LLM'

    const lines: ExtractedLine[] = Array.from({ length: nLines }, () => {
      const [scrawl, code, name, unit, rate] = pick(RAW_ITEMS)
      const qty = unit === 'kg' ? +between(8, 140).toFixed(1) : iBetween(2, 60)
      const useRate = +(rate * between(0.96, 1.02)).toFixed(2)
      const conf = printed ? +between(97, 99.8).toFixed(1) : +between(74, 99).toFixed(1)
      return {
        rawText: scrawl,
        mappedCode: code, mappedName: name,
        qty, unit, rate: useRate,
        amount: +(qty * useRate).toFixed(2),
        confidence: conf,
        flagged: conf < 88,
      }
    })

    const computedTotal = +lines.reduce((s, l) => s + l.amount, 0).toFixed(2)
    // The written total occasionally disagrees with the arithmetic on the slip.
    const totalOff = !printed && rnd() < 0.18
    const extractedTotal = totalOff ? +(computedTotal * between(0.94, 1.05)).toFixed(0) : Math.round(computedTotal)

    const confidence = +(lines.reduce((s, l) => s + l.confidence, 0) / lines.length).toFixed(1)
    const anyFlag = lines.some(l => l.flagged) || totalOff

    const status: BillStatus =
      confidence >= 95 && !anyFlag ? 'Auto-Approved'
      : b.status === 'Needs Review' ? 'Needs Review'
      : rnd() < 0.72 ? 'Corrected & Posted'
      : 'Needs Review'

    const corrections: Correction[] = []
    if (status === 'Corrected & Posted') {
      const flagged = lines.filter(l => l.flagged)
      if (flagged.length) corrections.push({ field: 'Item description', ocrValue: flagged[0].rawText, correctedValue: flagged[0].mappedName, by: pick(OPERATORS) })
      if (totalOff) corrections.push({ field: 'Bill total', ocrValue: String(extractedTotal), correctedValue: String(Math.round(computedTotal)), by: pick(OPERATORS) })
      if (rnd() < 0.4) corrections.push({ field: 'Quantity', ocrValue: String(lines[0].qty), correctedValue: String(+(lines[0].qty * 1.1).toFixed(1)), by: pick(OPERATORS) })
      if (rnd() < 0.3) corrections.push({ field: 'Customer name', ocrValue: rawParty, correctedValue: partyName, by: pick(OPERATORS) })
    }

    tmpSeq++
    return {
      tempId: `TMP-${String(tmpSeq).padStart(3, '0')}`,
      batchId: b.id,
      sourceImage: b.file,
      billIndex: k + 1,
      billsInImage: b.billsFound,
      docType: b.docType,
      capturedAt: b.uploadedAt,
      billDate: b.uploadedAt.slice(0, 10),
      rawPartyName: rawParty,
      mappedPartyId: partyId,
      mappedPartyName: partyName,
      billNo: printed ? `SUP/${iBetween(1000, 9999)}` : '— (no bill no. on slip)',
      lines,
      extractedTotal,
      computedTotal,
      confidence,
      status,
      corrections,
      postedTo: status === 'Auto-Approved' || status === 'Corrected & Posted'
        ? (b.docType.includes('Purchase') ? 'Purchase Register' : b.docType === 'Coating Job Card' ? 'Coating Job' : 'Sales Invoice')
        : '—',
    }
  }),
)

/* ── Correction report: what the model keeps getting wrong ──────────── */
export interface FieldAccuracy {
  field: string
  extracted: number
  corrected: number
  accuracy: number
  trend: 'up' | 'down' | 'flat'
}

export const FIELD_ACCURACY: FieldAccuracy[] = (() => {
  const fields = ['Bill date', 'Customer name', 'Item description', 'Quantity', 'Rate', 'Bill total', 'Bundle / packet qty']
  return fields.map(f => {
    const extracted = CAPTURED.length * (f === 'Item description' || f === 'Quantity' || f === 'Rate' ? 2 : 1)
    const corrected = CAPTURED.reduce((s, c) => s + c.corrections.filter(x => x.field === f).length, 0)
      + (f === 'Rate' ? iBetween(1, 5) : f === 'Bundle / packet qty' ? iBetween(0, 3) : 0)
    return {
      field: f,
      extracted,
      corrected,
      accuracy: +(((extracted - corrected) / extracted) * 100).toFixed(1),
      trend: (corrected === 0 ? 'flat' : rnd() < 0.7 ? 'up' : 'down') as FieldAccuracy['trend'],
    }
  }).sort((a, b) => a.accuracy - b.accuracy)
})()

export const AI_SUMMARY = {
  batches: BATCHES.length,
  bills: CAPTURED.length,
  autoApproved: CAPTURED.filter(c => c.status === 'Auto-Approved').length,
  needsReview: CAPTURED.filter(c => c.status === 'Needs Review').length,
  corrected: CAPTURED.filter(c => c.status === 'Corrected & Posted').length,
  avgConfidence: +(CAPTURED.reduce((s, c) => s + c.confidence, 0) / CAPTURED.length).toFixed(1),
  straightThroughPct: Math.round((CAPTURED.filter(c => c.status === 'Auto-Approved').length / CAPTURED.length) * 100),
  trainingSamples: 1840 + CAPTURED.reduce((s, c) => s + c.corrections.length, 0),
  modelVersion: 'VSA Handwriting Model v4',
  lastTrained: '2026-08-11',
}

/* ── Output patterns the extractor can write to ─────────────────────── */
export interface ExportPattern {
  id: string
  name: string
  target: 'Tally Prime (XML)' | 'Excel (VSA pattern)' | 'ERP Direct Post' | 'Excel (GST filing)'
  columns: string[]
  schedule: string
  lastRun: string
  rowsLastRun: number
  active: boolean
}

export const EXPORT_PATTERNS: ExportPattern[] = [
  {
    id: 'EP1', name: 'Sales — VSA counter slip pattern', target: 'Excel (VSA pattern)',
    columns: ['Date', 'Temp ID', 'Customer', 'Item Code', 'Item Name', 'Qty', 'Unit', 'Rate', 'Amount', 'GST %', 'Total'],
    schedule: 'Daily 8:30 pm', lastRun: '2026-08-19 20:30', rowsLastRun: 41, active: true,
  },
  {
    id: 'EP2', name: 'Purchase — Tally voucher import', target: 'Tally Prime (XML)',
    columns: ['Voucher Date', 'Voucher Type', 'Supplier Ledger', 'Bill No', 'Item', 'Qty', 'Rate', 'Amount', 'CGST', 'SGST', 'IGST'],
    schedule: 'Daily 9:00 pm', lastRun: '2026-08-19 21:00', rowsLastRun: 12, active: true,
  },
  {
    id: 'EP3', name: 'Purchase DC — weight & bundle columns', target: 'Excel (VSA pattern)',
    columns: ['Sl No', 'Section Name', 'Batch', 'Bundles', 'Qty/Bundle', 'Total Nos', 'Cut Length', 'Weight Range', 'Bundle Wt', 'Total Wt', 'Coating Co', 'Vehicle No', 'Remarks'],
    schedule: 'On upload', lastRun: '2026-08-18 14:12', rowsLastRun: 26, active: true,
  },
  {
    id: 'EP4', name: 'GSTR-1 B2B upload sheet', target: 'Excel (GST filing)',
    columns: ['GSTIN', 'Invoice No', 'Invoice Date', 'Invoice Value', 'Place of Supply', 'Rate', 'Taxable Value', 'Cess'],
    schedule: 'Monthly, 8th', lastRun: '2026-08-08 11:05', rowsLastRun: 154, active: true,
  },
  {
    id: 'EP5', name: 'Coating job card → ERP job', target: 'ERP Direct Post',
    columns: ['DC No', 'Date', 'PCU', 'Section', 'Nos', 'Raw Wt', 'Coated Wt', 'Shade', 'Sqft', 'Rate/Sqft'],
    schedule: 'On upload', lastRun: '2026-08-17 17:40', rowsLastRun: 8, active: false,
  },
]

/* ── API surface exposed to the capture app / ChatGPT connector ─────── */
export const API_ENDPOINTS = [
  { method: 'POST', path: '/api/v1/capture/upload',        desc: 'Upload an image or PDF; returns a batch id' },
  { method: 'GET',  path: '/api/v1/capture/batch/{id}',    desc: 'Extraction result — one record per bill found' },
  { method: 'POST', path: '/api/v1/capture/{tempId}/correct', desc: 'Submit field corrections; feeds the training set' },
  { method: 'POST', path: '/api/v1/capture/{tempId}/post', desc: 'Post an approved bill to sales, purchase or coating' },
  { method: 'GET',  path: '/api/v1/master/items',          desc: 'Item master with UOM, kit and alias mapping' },
  { method: 'POST', path: '/api/v1/master/alias',          desc: 'Teach a new supplier or product alias' },
  { method: 'GET',  path: '/api/v1/export/{patternId}',    desc: 'Run an export pattern; returns Excel or Tally XML' },
  { method: 'GET',  path: '/api/v1/gst/2b-recon',          desc: 'GSTR-2B against the purchase register' },
]
