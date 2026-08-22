/* ── Item master ────────────────────────────────────────────────────────
   The trade buys in one unit and sells in another: sections come in by
   weight and go out by pieces, clips arrive in packets and leave as nos,
   and a floor-spring "set" is really six separate items off the shelf.
   Everything that converts, maps or explodes is defined here so a single
   entry moves both the weight ledger and the piece ledger.               */

import { P } from './catalogue'

/* ── 1. Dual unit of measure ────────────────────────────────────────── */
export interface UomRule {
  code: string
  name: string
  purchaseUom: 'kg' | 'packet' | 'bundle' | 'box' | 'nos'
  saleUom: 'nos' | 'kg' | 'sqft' | 'set'
  /** pieces contained in one purchase unit */
  piecesPerPurchaseUom: number
  /** standard weight of one piece, kg — used to convert both ways */
  kgPerPiece: number
  /** allow the weekly stock check to true up against the latest DC weight */
  autoTrueUp: boolean
  /** stock issue order for costing */
  valuation: 'LIFO' | 'FIFO' | 'Weighted Avg'
}

export const UOM_RULES: UomRule[] = [
  { code: 'VSA-SL-2T-OF', name: '2 Track Sliding Outer Frame', purchaseUom: 'kg',     saleUom: 'nos', piecesPerPurchaseUom: 1,   kgPerPiece: 3.42,  autoTrueUp: true,  valuation: 'Weighted Avg' },
  { code: 'VSA-SL-2T-SH', name: '2 Track Sliding Shutter',     purchaseUom: 'kg',     saleUom: 'nos', piecesPerPurchaseUom: 1,   kgPerPiece: 2.18,  autoTrueUp: true,  valuation: 'Weighted Avg' },
  { code: 'VSA-SL-3T-OF', name: '3 Track Sliding Outer Frame', purchaseUom: 'kg',     saleUom: 'nos', piecesPerPurchaseUom: 1,   kgPerPiece: 4.86,  autoTrueUp: true,  valuation: 'Weighted Avg' },
  { code: 'VSA-SL-INTL',  name: 'Sliding Interlock Section',   purchaseUom: 'kg',     saleUom: 'nos', piecesPerPurchaseUom: 1,   kgPerPiece: 0.92,  autoTrueUp: true,  valuation: 'LIFO' },
  { code: 'VSA-OP-BEAD',  name: 'Glazing Bead — Casement',     purchaseUom: 'kg',     saleUom: 'nos', piecesPerPurchaseUom: 1,   kgPerPiece: 0.46,  autoTrueUp: true,  valuation: 'LIFO' },
  { code: 'VSA-HW-ROLL',  name: 'Sliding Roller — Bearing',    purchaseUom: 'packet', saleUom: 'nos', piecesPerPurchaseUom: 100, kgPerPiece: 0.042, autoTrueUp: false, valuation: 'LIFO' },
  { code: 'VSA-HW-LOCK',  name: 'Sliding Window Touch Lock',   purchaseUom: 'box',    saleUom: 'nos', piecesPerPurchaseUom: 50,  kgPerPiece: 0.085, autoTrueUp: false, valuation: 'LIFO' },
  { code: 'VSA-CN-SCRW',  name: 'SS Self-Tapping Screw',       purchaseUom: 'kg',     saleUom: 'nos', piecesPerPurchaseUom: 1,   kgPerPiece: 0.004, autoTrueUp: true,  valuation: 'Weighted Avg' },
  { code: 'VSA-CN-GSKT',  name: 'EPDM Gasket',                 purchaseUom: 'kg',     saleUom: 'nos', piecesPerPurchaseUom: 1,   kgPerPiece: 0.06,  autoTrueUp: true,  valuation: 'FIFO' },
  { code: 'VSA-HW-FHNG',  name: 'Friction Stay Hinge 12"',     purchaseUom: 'box',    saleUom: 'nos', piecesPerPurchaseUom: 20,  kgPerPiece: 0.31,  autoTrueUp: false, valuation: 'LIFO' },
]

export const uomOf = (code: string) => UOM_RULES.find(u => u.code === code)

/** Weight → pieces and back, for a single entry that must move both ledgers. */
export const kgToPieces = (code: string, kg: number) => {
  const u = uomOf(code); if (!u) return 0
  return Math.round(kg / u.kgPerPiece)
}
export const piecesToKg = (code: string, pcs: number) => {
  const u = uomOf(code); if (!u) return 0
  return +(pcs * u.kgPerPiece).toFixed(2)
}

/* ── 2. Kits and combo sets ─────────────────────────────────────────── */
export interface Kit {
  code: string
  name: string
  saleUom: string
  /** every component that leaves stock when one set is billed */
  components: { code: string; name: string; qty: number; unit: string }[]
}

export const KITS: Kit[] = [
  {
    code: 'VSA-KIT-FSPR', name: 'Floor Spring Combo Set', saleUom: 'set',
    components: [
      { code: 'VSA-FS-BODY',  name: 'Floor Spring Body (hydraulic)', qty: 1, unit: 'nos' },
      { code: 'VSA-FS-TPCH',  name: 'Top Patch Fitting',             qty: 1, unit: 'nos' },
      { code: 'VSA-FS-BPCH',  name: 'Bottom Patch Fitting',          qty: 1, unit: 'nos' },
      { code: 'VSA-FS-PIVOT', name: 'Pivot Pin Assembly',            qty: 1, unit: 'nos' },
      { code: 'VSA-FS-CEMB',  name: 'Cement Box / Housing',          qty: 1, unit: 'nos' },
      { code: 'VSA-FS-CVR',   name: 'SS Cover Plate',                qty: 1, unit: 'nos' },
    ],
  },
  {
    code: 'VSA-KIT-SLDW', name: 'Sliding Window Hardware Set', saleUom: 'set',
    components: [
      { code: 'VSA-HW-ROLL', name: 'Sliding Roller — Bearing (pair)', qty: 2, unit: 'nos' },
      { code: 'VSA-HW-LOCK', name: 'Sliding Window Touch Lock',       qty: 1, unit: 'nos' },
      { code: 'VSA-CN-GSKT', name: 'EPDM Gasket (per mtr)',           qty: 8, unit: 'nos' },
      { code: 'VSA-CN-SCRW', name: 'SS Self-Tapping Screw (100 nos)', qty: 1, unit: 'nos' },
    ],
  },
  {
    code: 'VSA-KIT-CASE', name: 'Casement Window Fitting Set', saleUom: 'set',
    components: [
      { code: 'VSA-HW-FHNG', name: 'Friction Stay Hinge 12"', qty: 2, unit: 'nos' },
      { code: 'VSA-HW-HAND', name: 'Casement Handle — SS',    qty: 1, unit: 'nos' },
      { code: 'VSA-CN-GSKT', name: 'EPDM Gasket (per mtr)',   qty: 6, unit: 'nos' },
    ],
  },
]

/* ── 3. Consignments received against one common weight ─────────────── */
export interface WeightPool {
  id: string
  dcNo: string
  supplier: string
  date: string
  /** one weighbridge figure covering several items */
  pooledWeightKg: number
  items: { code: string; name: string; nos: number; stdKgPerPiece: number }[]
  method: 'Pro-rata by standard weight' | 'Manual split'
  status: 'Allocated' | 'Pending Allocation'
}

export const WEIGHT_POOLS: WeightPool[] = [
  {
    id: 'WP1', dcNo: 'JIN/DC/8841', supplier: 'Jindal Aluminium Ltd — Depot', date: '2026-08-14',
    pooledWeightKg: 1284.5, method: 'Pro-rata by standard weight', status: 'Allocated',
    items: [
      { code: 'VSA-SL-2T-OF', name: '2 Track Sliding Outer Frame', nos: 120, stdKgPerPiece: 3.42 },
      { code: 'VSA-SL-2T-SH', name: '2 Track Sliding Shutter',     nos: 180, stdKgPerPiece: 2.18 },
      { code: 'VSA-SL-INTL',  name: 'Sliding Interlock Section',   nos: 240, stdKgPerPiece: 0.92 },
      { code: 'VSA-OP-BEAD',  name: 'Glazing Bead — Casement',     nos: 300, stdKgPerPiece: 0.46 },
      { code: 'VSA-PT-TPAT',  name: 'T-Patti Partition Section',   nos: 110, stdKgPerPiece: 1.18 },
    ],
  },
  {
    id: 'WP2', dcNo: 'BHO/DC/2219', supplier: 'Bhoruka Extrusions Pvt Ltd', date: '2026-08-18',
    pooledWeightKg: 962.0, method: 'Pro-rata by standard weight', status: 'Pending Allocation',
    items: [
      { code: 'VSA-LV-BLADE', name: 'Louver Blade Section',     nos: 260, stdKgPerPiece: 1.34 },
      { code: 'VSA-LV-FRM',   name: 'Ventilator Frame Section', nos: 150, stdKgPerPiece: 2.06 },
      { code: 'VSA-SL-INTL',  name: 'Sliding Interlock Section', nos: 320, stdKgPerPiece: 0.92 },
    ],
  },
]

/** Split one pooled weight across the items on the challan. */
export const allocatePool = (pool: WeightPool) => {
  const std = pool.items.reduce((s, i) => s + i.nos * i.stdKgPerPiece, 0)
  const factor = pool.pooledWeightKg / std
  return pool.items.map(i => {
    const stdKg = i.nos * i.stdKgPerPiece
    return {
      ...i,
      standardKg: +stdKg.toFixed(2),
      allocatedKg: +(stdKg * factor).toFixed(2),
      perPieceKg: +((stdKg * factor) / i.nos).toFixed(3),
      variancePct: +((factor - 1) * 100).toFixed(2),
    }
  })
}

/* ── 4. Supplier and product name mapping ───────────────────────────── */
export interface AliasMap {
  id: string
  kind: 'Product' | 'Supplier' | 'Customer'
  /** exactly what the supplier's bill or the handwritten slip says */
  alias: string
  source: string
  /** the VSA master record it resolves to */
  mapsTo: string
  mapsToName: string
  hits: number
  confidence: number
  status: 'Confirmed' | 'Needs Review'
}

export const ALIASES: AliasMap[] = [
  { id: 'A01', kind: 'Product',  alias: '2T OUTER FRAME MF 12',      source: 'Jindal Aluminium',  mapsTo: 'VSA-SL-2T-OF', mapsToName: '2 Track Sliding Outer Frame', hits: 46, confidence: 99, status: 'Confirmed' },
  { id: 'A02', kind: 'Product',  alias: '2 TRK SHUTTER',             source: 'Handwritten slip',  mapsTo: 'VSA-SL-2T-SH', mapsToName: '2 Track Sliding Shutter',     hits: 38, confidence: 97, status: 'Confirmed' },
  { id: 'A03', kind: 'Product',  alias: 'INTERLOCK SEC 12FT',        source: 'Bhoruka Extrusions',mapsTo: 'VSA-SL-INTL',  mapsToName: 'Sliding Interlock Section',   hits: 52, confidence: 99, status: 'Confirmed' },
  { id: 'A04', kind: 'Product',  alias: 'BEEDING / BEAD',            source: 'Handwritten slip',  mapsTo: 'VSA-OP-BEAD',  mapsToName: 'Glazing Bead — Casement',     hits: 61, confidence: 94, status: 'Confirmed' },
  { id: 'A05', kind: 'Product',  alias: 'ROLLER BRG PKT',            source: 'Ozone Hardware',    mapsTo: 'VSA-HW-ROLL',  mapsToName: 'Sliding Roller — Bearing',    hits: 27, confidence: 96, status: 'Confirmed' },
  { id: 'A06', kind: 'Product',  alias: 'T PATTY',                   source: 'Handwritten slip',  mapsTo: 'VSA-PT-TPAT',  mapsToName: 'T-Patti Partition Section',   hits: 33, confidence: 91, status: 'Confirmed' },
  { id: 'A07', kind: 'Product',  alias: 'ACP 3MM SILVR',             source: 'Alstrong',          mapsTo: 'VSA-ACP-3MM',  mapsToName: 'ACP Sheet 3mm 4x8 — Silver',  hits: 14, confidence: 88, status: 'Needs Review' },
  { id: 'A08', kind: 'Product',  alias: 'GLASS 5MM PLAIN',           source: 'Handwritten slip',  mapsTo: 'VSA-GL-5CL',   mapsToName: 'Clear Float Glass 5mm',       hits: 44, confidence: 98, status: 'Confirmed' },
  { id: 'A09', kind: 'Product',  alias: 'CLIPS / KLIP',              source: 'Handwritten slip',  mapsTo: 'VSA-CN-SCRW',  mapsToName: 'SS Self-Tapping Screw',       hits: 19, confidence: 72, status: 'Needs Review' },
  { id: 'A10', kind: 'Supplier', alias: 'JINDAL ALUM LTD',           source: 'Purchase bill',     mapsTo: 'S01',          mapsToName: 'Jindal Aluminium Ltd — Depot',hits: 34, confidence: 99, status: 'Confirmed' },
  { id: 'A11', kind: 'Supplier', alias: 'HINDALCO STKST',            source: 'Purchase bill',     mapsTo: 'S02',          mapsToName: 'Hindalco Authorised Stockist',hits: 21, confidence: 97, status: 'Confirmed' },
  { id: 'A12', kind: 'Supplier', alias: 'ALSTRONG ENT INDIA P LTD',  source: 'GSTR-2B',           mapsTo: 'S04',          mapsToName: 'Alstrong Enterprises India',  hits: 8,  confidence: 93, status: 'Confirmed' },
  { id: 'A13', kind: 'Customer', alias: 'SRI BALAJI ALU FAB',        source: 'Handwritten slip',  mapsTo: 'C01',          mapsToName: 'Sri Balaji Aluminium Fabricators', hits: 29, confidence: 96, status: 'Confirmed' },
  { id: 'A14', kind: 'Customer', alias: 'PERFECT GLASS',             source: 'Handwritten slip',  mapsTo: 'C03',          mapsToName: 'Perfect Glass & Aluminium Works',   hits: 24, confidence: 95, status: 'Confirmed' },
  { id: 'A15', kind: 'Customer', alias: 'METRO FAB',                 source: 'Handwritten slip',  mapsTo: 'C07',          mapsToName: 'Metro Aluminium Fabricators', hits: 17, confidence: 89, status: 'Needs Review' },
]

/* ── 5. Cut pieces and to-be-cut (TBC) stock ────────────────────────── */
export interface CutPiece {
  id: string
  code: string
  name: string
  parentLengthFt: number
  cutLengthFt: number
  pieces: number
  balanceEndFt: number
  weightKg: number
  location: string
  date: string
  /** end-cuts short enough to be scrap rather than saleable stock */
  disposition: 'Back to Stock' | 'TBC — awaiting cut' | 'Scrap / Melt'
  againstInvoice: string
}

export const CUT_PIECES: CutPiece[] = [
  { id: 'CP1', code: 'VSA-SL-3T-OF', name: '3 Track Sliding Outer Frame', parentLengthFt: 12, cutLengthFt: 7.5, pieces: 18, balanceEndFt: 4.5, weightKg: 32.8, location: 'SHOP', date: '2026-08-19', disposition: 'Back to Stock',      againstInvoice: 'VSA/26-27/0088' },
  { id: 'CP2', code: 'VSA-OP-OF45',  name: 'Openable Outer Frame 45mm',   parentLengthFt: 12, cutLengthFt: 5.0, pieces: 24, balanceEndFt: 2.0, weightKg: 15.5, location: 'SHOP', date: '2026-08-19', disposition: 'Scrap / Melt',       againstInvoice: 'VSA/26-27/0085' },
  { id: 'CP3', code: 'VSA-PT-BOX',   name: 'Partition Box Section 2"x1"', parentLengthFt: 12, cutLengthFt: 9.0, pieces: 30, balanceEndFt: 3.0, weightKg: 20.4, location: 'GD1',  date: '2026-08-18', disposition: 'Back to Stock',      againstInvoice: 'VSA/26-27/0083' },
  { id: 'CP4', code: 'VSA-SL-2T-OF', name: '2 Track Sliding Outer Frame', parentLengthFt: 12, cutLengthFt: 6.0, pieces: 40, balanceEndFt: 6.0, weightKg: 68.4, location: 'GD1',  date: '2026-08-17', disposition: 'Back to Stock',      againstInvoice: 'VSA/26-27/0079' },
  { id: 'CP5', code: 'VSA-DR-FRM',   name: 'Aluminium Door Frame Section',parentLengthFt: 16, cutLengthFt: 7.0, pieces: 12, balanceEndFt: 2.0, weightKg: 11.0, location: 'SHOP', date: '2026-08-16', disposition: 'TBC — awaiting cut', againstInvoice: '—' },
  { id: 'CP6', code: 'VSA-LV-BLADE', name: 'Louver Blade Section',        parentLengthFt: 12, cutLengthFt: 3.0, pieces: 96, balanceEndFt: 0,   weightKg: 38.6, location: 'GD2',  date: '2026-08-15', disposition: 'Back to Stock',      againstInvoice: 'VSA/26-27/0077' },
  { id: 'CP7', code: 'VSA-SL-3T-SH', name: '3 Track Sliding Shutter',     parentLengthFt: 12, cutLengthFt: 4.5, pieces: 44, balanceEndFt: 3.0, weightKg: 40.3, location: 'SHOP', date: '2026-08-14', disposition: 'TBC — awaiting cut', againstInvoice: '—' },
]

/** Items with a UOM rule, for the master listing. */
export const MASTER_ITEMS = P.filter(p => uomOf(p.code))
