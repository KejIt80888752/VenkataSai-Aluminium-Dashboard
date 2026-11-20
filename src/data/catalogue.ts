import { SHOW_SAMPLE } from './sample'
import { MASTER, type MasterProduct } from './productmaster'
/* ── Product catalogue: extruded aluminium sections, sheets, glass, hardware ── */

export type Finish =
  | 'Mill Finish' | 'Anodised Silver' | 'Anodised Champagne' | 'Anodised Black'
  | 'Powder Coated White' | 'Powder Coated Ivory' | 'Powder Coated Black'
  | 'Wood Finish' | 'N/A'

export interface Product {
  id: string
  code: string
  name: string
  category: string
  series: string
  brand: string
  finish: Finish
  /** standard stock length in feet — 0 for non-section items */
  lengthFt: number
  /** kg per standard length — the trade's costing unit */
  kgPerLength: number
  /** 'kg' | 'pcs' | 'sqft' | 'nos' | 'ltr' */
  unit: 'kg' | 'pcs' | 'sqft' | 'nos' | 'ltr'
  ratePerKg: number
  /** landed cost per kg (or per unit for non-kg items) */
  costPerKg: number
  hsn: string
  gst: number
  stockPcs: number
  reorderPcs: number
  rack: string
  godown: 'Main Godown' | 'Yard 2'
  active: boolean
}

export const CATEGORIES = [
  'Sliding Sections',
  'Openable / Casement',
  'Partition & Door',
  'Louver & Ventilator',
  'Sheets & Coils',
  'ACP Panels',
  'Glass',
  'Hardware & Accessories',
  'Consumables',
] as const

/** For section items the sale unit is kg; pcs → kg via kgPerLength. */
const SAMPLE_P: Product[] = SHOW_SAMPLE
  ? ([
  // ── Sliding Sections ────────────────────────────────────────────────
  { id:'P01', code:'VSA-SL-2T-OF', name:'2 Track Sliding Outer Frame',      category:'Sliding Sections',      series:'2 Track',   brand:'Jindal',   finish:'Mill Finish',          lengthFt:12, kgPerLength:3.42, unit:'kg', ratePerKg:286, costPerKg:239, hsn:'7604', gst:18, stockPcs:184, reorderPcs:60, rack:'A-01', godown:'Main Godown', active:true },
  { id:'P02', code:'VSA-SL-2T-SH', name:'2 Track Sliding Shutter',          category:'Sliding Sections',      series:'2 Track',   brand:'Jindal',   finish:'Mill Finish',          lengthFt:12, kgPerLength:2.18, unit:'kg', ratePerKg:286, costPerKg:239, hsn:'7604', gst:18, stockPcs:236, reorderPcs:80, rack:'A-02', godown:'Main Godown', active:true },
  { id:'P03', code:'VSA-SL-3T-OF', name:'3 Track Sliding Outer Frame',      category:'Sliding Sections',      series:'3 Track',   brand:'Jindal',   finish:'Anodised Silver',      lengthFt:12, kgPerLength:4.86, unit:'kg', ratePerKg:328, costPerKg:274, hsn:'7604', gst:18, stockPcs:96,  reorderPcs:40, rack:'A-03', godown:'Main Godown', active:true },
  { id:'P04', code:'VSA-SL-3T-SH', name:'3 Track Sliding Shutter',          category:'Sliding Sections',      series:'3 Track',   brand:'Jindal',   finish:'Anodised Silver',      lengthFt:12, kgPerLength:2.44, unit:'kg', ratePerKg:328, costPerKg:274, hsn:'7604', gst:18, stockPcs:142, reorderPcs:50, rack:'A-04', godown:'Main Godown', active:true },
  { id:'P05', code:'VSA-SL-2T-PW', name:'2 Track Sliding Frame — PC White', category:'Sliding Sections',      series:'2 Track',   brand:'Hindalco', finish:'Powder Coated White',  lengthFt:12, kgPerLength:3.42, unit:'kg', ratePerKg:342, costPerKg:283, hsn:'7604', gst:18, stockPcs:74,  reorderPcs:40, rack:'A-05', godown:'Main Godown', active:true },
  { id:'P06', code:'VSA-SL-INTL',  name:'Sliding Interlock Section',        category:'Sliding Sections',      series:'2/3 Track', brand:'Bhoruka',  finish:'Mill Finish',          lengthFt:12, kgPerLength:0.92, unit:'kg', ratePerKg:286, costPerKg:238, hsn:'7604', gst:18, stockPcs:310, reorderPcs:100, rack:'A-06', godown:'Main Godown', active:true },

  // ── Openable / Casement ─────────────────────────────────────────────
  { id:'P07', code:'VSA-OP-OF45',  name:'Openable Outer Frame 45mm',        category:'Openable / Casement',   series:'Casement 45', brand:'Jindal', finish:'Powder Coated White',  lengthFt:12, kgPerLength:3.88, unit:'kg', ratePerKg:342, costPerKg:285, hsn:'7604', gst:18, stockPcs:88,  reorderPcs:40, rack:'B-01', godown:'Main Godown', active:true },
  { id:'P08', code:'VSA-OP-SH45',  name:'Openable Shutter 45mm',            category:'Openable / Casement',   series:'Casement 45', brand:'Jindal', finish:'Powder Coated White',  lengthFt:12, kgPerLength:3.06, unit:'kg', ratePerKg:342, costPerKg:285, hsn:'7604', gst:18, stockPcs:112, reorderPcs:45, rack:'B-02', godown:'Main Godown', active:true },
  { id:'P09', code:'VSA-OP-OFBK',  name:'Openable Frame — Anodised Black',  category:'Openable / Casement',   series:'Casement 45', brand:'Banco',  finish:'Anodised Black',       lengthFt:12, kgPerLength:3.88, unit:'kg', ratePerKg:368, costPerKg:306, hsn:'7604', gst:18, stockPcs:31,  reorderPcs:35, rack:'B-03', godown:'Main Godown', active:true },
  { id:'P10', code:'VSA-OP-BEAD',  name:'Glazing Bead — Casement',          category:'Openable / Casement',   series:'Casement 45', brand:'Banco',  finish:'Mill Finish',          lengthFt:12, kgPerLength:0.46, unit:'kg', ratePerKg:290, costPerKg:241, hsn:'7604', gst:18, stockPcs:420, reorderPcs:120, rack:'B-04', godown:'Main Godown', active:true },

  // ── Partition & Door ────────────────────────────────────────────────
  { id:'P11', code:'VSA-PT-BOX',   name:'Partition Box Section 2"x1"',      category:'Partition & Door',      series:'Partition',  brand:'Century', finish:'Anodised Silver',      lengthFt:12, kgPerLength:2.72, unit:'kg', ratePerKg:322, costPerKg:268, hsn:'7604', gst:18, stockPcs:164, reorderPcs:60, rack:'C-01', godown:'Main Godown', active:true },
  { id:'P12', code:'VSA-PT-TPAT',  name:'T-Patti Partition Section',        category:'Partition & Door',      series:'Partition',  brand:'Century', finish:'Anodised Silver',      lengthFt:12, kgPerLength:1.18, unit:'kg', ratePerKg:322, costPerKg:268, hsn:'7604', gst:18, stockPcs:288, reorderPcs:90, rack:'C-02', godown:'Main Godown', active:true },
  { id:'P13', code:'VSA-DR-FRM',   name:'Aluminium Door Frame Section',     category:'Partition & Door',      series:'Door',       brand:'Jindal',  finish:'Powder Coated Ivory',  lengthFt:12, kgPerLength:4.14, unit:'kg', ratePerKg:346, costPerKg:289, hsn:'7604', gst:18, stockPcs:58,  reorderPcs:30, rack:'C-03', godown:'Main Godown', active:true },
  { id:'P14', code:'VSA-DR-WOOD',  name:'Door Section — Wood Finish',       category:'Partition & Door',      series:'Door',       brand:'Jindal',  finish:'Wood Finish',          lengthFt:12, kgPerLength:4.14, unit:'kg', ratePerKg:412, costPerKg:340, hsn:'7604', gst:18, stockPcs:22,  reorderPcs:25, rack:'C-04', godown:'Main Godown', active:true },

  // ── Louver & Ventilator ─────────────────────────────────────────────
  { id:'P15', code:'VSA-LV-BLADE', name:'Louver Blade Section',             category:'Louver & Ventilator',   series:'Louver',     brand:'Bhoruka', finish:'Mill Finish',          lengthFt:12, kgPerLength:1.34, unit:'kg', ratePerKg:292, costPerKg:243, hsn:'7604', gst:18, stockPcs:196, reorderPcs:70, rack:'D-01', godown:'Yard 2',      active:true },
  { id:'P16', code:'VSA-LV-FRM',   name:'Ventilator Frame Section',         category:'Louver & Ventilator',   series:'Louver',     brand:'Bhoruka', finish:'Mill Finish',          lengthFt:12, kgPerLength:2.06, unit:'kg', ratePerKg:292, costPerKg:243, hsn:'7604', gst:18, stockPcs:118, reorderPcs:50, rack:'D-02', godown:'Yard 2',      active:true },

  // ── Sheets & Coils ──────────────────────────────────────────────────
  { id:'P17', code:'VSA-SH-1.0',   name:'Aluminium Plain Sheet 1.0mm 4x8',  category:'Sheets & Coils',        series:'Sheet',      brand:'Hindalco', finish:'Mill Finish',         lengthFt:8,  kgPerLength:8.02, unit:'kg', ratePerKg:308, costPerKg:256, hsn:'7606', gst:18, stockPcs:64,  reorderPcs:25, rack:'E-01', godown:'Yard 2',      active:true },
  { id:'P18', code:'VSA-SH-1.6',   name:'Aluminium Plain Sheet 1.6mm 4x8',  category:'Sheets & Coils',        series:'Sheet',      brand:'Hindalco', finish:'Mill Finish',         lengthFt:8,  kgPerLength:12.84,unit:'kg', ratePerKg:308, costPerKg:256, hsn:'7606', gst:18, stockPcs:38,  reorderPcs:20, rack:'E-02', godown:'Yard 2',      active:true },
  { id:'P19', code:'VSA-CO-0.5',   name:'Aluminium Coil 0.5mm (per kg)',    category:'Sheets & Coils',        series:'Coil',       brand:'Hindalco', finish:'Mill Finish',         lengthFt:0,  kgPerLength:1,    unit:'kg', ratePerKg:315, costPerKg:262, hsn:'7606', gst:18, stockPcs:420, reorderPcs:150, rack:'E-03', godown:'Yard 2',    active:true },
  { id:'P20', code:'VSA-CHQ-3.0',  name:'Chequered Sheet 3.0mm 4x8',        category:'Sheets & Coils',        series:'Sheet',      brand:'Jindal',   finish:'Mill Finish',         lengthFt:8,  kgPerLength:24.1, unit:'kg', ratePerKg:322, costPerKg:270, hsn:'7606', gst:18, stockPcs:16,  reorderPcs:12, rack:'E-04', godown:'Yard 2',      active:true },

  // ── ACP Panels ──────────────────────────────────────────────────────
  { id:'P21', code:'VSA-ACP-3MM',  name:'ACP Sheet 3mm 4x8 — Silver',       category:'ACP Panels',            series:'ACP',        brand:'Alstrong', finish:'N/A',                 lengthFt:8,  kgPerLength:1,    unit:'sqft', ratePerKg:78,  costPerKg:61,  hsn:'7606', gst:18, stockPcs:96,  reorderPcs:40, rack:'F-01', godown:'Yard 2',      active:true },
  { id:'P22', code:'VSA-ACP-4MM',  name:'ACP Sheet 4mm 4x8 — Wooden',       category:'ACP Panels',            series:'ACP',        brand:'Alstrong', finish:'N/A',                 lengthFt:8,  kgPerLength:1,    unit:'sqft', ratePerKg:96,  costPerKg:76,  hsn:'7606', gst:18, stockPcs:52,  reorderPcs:30, rack:'F-02', godown:'Yard 2',      active:true },

  // ── Glass ───────────────────────────────────────────────────────────
  { id:'P23', code:'VSA-GL-5CL',   name:'Clear Float Glass 5mm',            category:'Glass',                 series:'Float',      brand:'Saint-Gobain', finish:'N/A',             lengthFt:0,  kgPerLength:1,    unit:'sqft', ratePerKg:62,  costPerKg:48,  hsn:'7005', gst:18, stockPcs:880, reorderPcs:300, rack:'G-01', godown:'Main Godown', active:true },
  { id:'P24', code:'VSA-GL-5TN',   name:'Tinted Float Glass 5mm — Bronze',  category:'Glass',                 series:'Float',      brand:'Saint-Gobain', finish:'N/A',             lengthFt:0,  kgPerLength:1,    unit:'sqft', ratePerKg:84,  costPerKg:66,  hsn:'7005', gst:18, stockPcs:410, reorderPcs:200, rack:'G-02', godown:'Main Godown', active:true },
  { id:'P25', code:'VSA-GL-8TG',   name:'Toughened Glass 8mm',              category:'Glass',                 series:'Toughened',  brand:'Saint-Gobain', finish:'N/A',             lengthFt:0,  kgPerLength:1,    unit:'sqft', ratePerKg:186, costPerKg:150, hsn:'7007', gst:18, stockPcs:240, reorderPcs:150, rack:'G-03', godown:'Main Godown', active:true },

  // ── Hardware & Accessories ──────────────────────────────────────────
  { id:'P26', code:'VSA-HW-ROLL',  name:'Sliding Roller — Bearing (pair)',  category:'Hardware & Accessories', series:'Hardware',  brand:'Ozone',    finish:'N/A',                 lengthFt:0,  kgPerLength:1,    unit:'nos', ratePerKg:96,  costPerKg:68,  hsn:'8302', gst:18, stockPcs:640, reorderPcs:250, rack:'H-01', godown:'Main Godown', active:true },
  { id:'P27', code:'VSA-HW-LOCK',  name:'Sliding Window Touch Lock',        category:'Hardware & Accessories', series:'Hardware',  brand:'Ozone',    finish:'N/A',                 lengthFt:0,  kgPerLength:1,    unit:'nos', ratePerKg:148, costPerKg:106, hsn:'8302', gst:18, stockPcs:288, reorderPcs:120, rack:'H-02', godown:'Main Godown', active:true },
  { id:'P28', code:'VSA-HW-FHNG',  name:'Friction Stay Hinge 12"',          category:'Hardware & Accessories', series:'Hardware',  brand:'Ebco',     finish:'N/A',                 lengthFt:0,  kgPerLength:1,    unit:'nos', ratePerKg:265, costPerKg:196, hsn:'8302', gst:18, stockPcs:96,  reorderPcs:100, rack:'H-03', godown:'Main Godown', active:true },
  { id:'P29', code:'VSA-HW-HAND',  name:'Casement Handle — SS',             category:'Hardware & Accessories', series:'Hardware',  brand:'Ebco',     finish:'N/A',                 lengthFt:0,  kgPerLength:1,    unit:'nos', ratePerKg:210, costPerKg:156, hsn:'8302', gst:18, stockPcs:174, reorderPcs:80, rack:'H-04', godown:'Main Godown', active:true },

  // ── Consumables ─────────────────────────────────────────────────────
  { id:'P30', code:'VSA-CN-SIL',   name:'Silicone Sealant — Weatherproof',  category:'Consumables',           series:'Sealant',    brand:'Dow',      finish:'N/A',                 lengthFt:0,  kgPerLength:1,    unit:'nos', ratePerKg:365, costPerKg:274, hsn:'3214', gst:18, stockPcs:212, reorderPcs:80, rack:'I-01', godown:'Main Godown', active:true },
  { id:'P31', code:'VSA-CN-GSKT',  name:'EPDM Gasket (per mtr)',            category:'Consumables',           series:'Gasket',     brand:'Generic',  finish:'N/A',                 lengthFt:0,  kgPerLength:1,    unit:'nos', ratePerKg:14,  costPerKg:9,   hsn:'4016', gst:18, stockPcs:2400, reorderPcs:800, rack:'I-02', godown:'Main Godown', active:true },
  { id:'P32', code:'VSA-CN-SCRW',  name:'SS Self-Tapping Screw (100 nos)',  category:'Consumables',           series:'Fastener',   brand:'Generic',  finish:'N/A',                 lengthFt:0,  kgPerLength:1,    unit:'nos', ratePerKg:185, costPerKg:131, hsn:'7318', gst:18, stockPcs:148, reorderPcs:60, rack:'I-03', godown:'Main Godown', active:true },
])
  : []

/* ── The catalogue, when the invented one is switched off ──────────────────
   With the demo data gone, every screen that reaches for a product list found
   nothing — which is what the shop ran into when they typed "W/o clips" into
   a section box and asked, fairly, why the box was there at all.

   So the catalogue falls back to the master derived from their own coating
   sheets. Those sheets say what a product is called, what its code is and —
   through the weighments — what a piece of it weighs. They say nothing at all
   about money, so cost and selling price come through as nought rather than
   as a guess, and the screens that show money say what they are waiting for.

   One code can carry two lengths: 20034 is both 16' SG and 15' SG, and their
   own Excel repeats the code on two rows for that reason. Code alone would
   therefore be an ambiguous key, so where a code is shared the length and
   groove already written in the name are carried into it — "20034 16'SG" —
   which is still their code and still reads like their paper.             */

const sharedCodes = new Set(
  MASTER.map(p => p.code).filter((c, i, a) => c && a.indexOf(c) !== i),
)

const catalogueCode = (p: MasterProduct) =>
  p.code
    ? sharedCodes.has(p.code)
      ? `${p.code} ${p.lengthFt}'${p.groove}`.trim()
      : p.code
    : p.name.toUpperCase().replace(/\s+/g, '-')

const categoryOf = (p: MasterProduct): string =>
  p.kind === 'rubber' ? 'Consumables'
  : p.kind === 'hardware' ? 'Hardware & Accessories'
  : 'Sliding Sections'

const fromMaster = (p: MasterProduct): Product => ({
  id: p.id,
  code: catalogueCode(p),
  name: p.name,
  category: categoryOf(p),
  series: p.groove || '—',
  brand: '—',
  finish: 'Mill Finish',
  lengthFt: p.lengthFt,
  /* A piece's weight, where their own weighments gave one. */
  kgPerLength: p.kgPerPiece ?? 1,
  unit: p.kgPerPiece !== null ? 'kg' : 'nos',
  /* Not known. The product list with prices has not reached us yet, and a
     made-up rate here would travel into every quotation and every valuation. */
  ratePerKg: 0,
  costPerKg: 0,
  hsn: p.kind === 'section' ? '7604' : p.kind === 'rubber' ? '4016' : '8302',
  gst: 18,
  /* Physical stock has not been given either, so nothing is claimed. */
  stockPcs: 0,
  reorderPcs: 0,
  rack: '—',
  godown: 'Main Godown',
  active: true,
})

export const P: Product[] = SHOW_SAMPLE ? SAMPLE_P : MASTER.map(fromMaster)

/** True while the catalogue carries no prices — the screens say so instead of
    showing a rupee figure nobody can stand behind. */
export const PRICES_KNOWN = P.some(p => p.ratePerKg > 0)

/** Saleable quantity in the product's own unit (kg for sections, nos/sqft otherwise) */
export const stockQty = (p: Product) => p.unit === 'kg' ? p.stockPcs * p.kgPerLength : p.stockPcs
export const stockValue = (p: Product) => stockQty(p) * p.costPerKg
export const isLow = (p: Product) => p.stockPcs <= p.reorderPcs

/** Display name for one of our section codes. Aliases store the code, so
    anything showing a taught section has to turn it back into words. */
export function sectionName(code: string | undefined): string | undefined {
  if (!code) return undefined
  return P.find(p => p.code === code)?.name ?? code
}
