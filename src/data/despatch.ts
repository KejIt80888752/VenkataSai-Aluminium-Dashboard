/* ── The supplier's despatch sheet, exactly as it is written ───────────────
   This is their own form: Sl No, Particulars, Weight Range, Net Weight,
   Length, No. of Pieces, and a total at the foot. Nothing is reformatted,
   because the man entering it is copying off the paper in front of him.

   Two things fall out of it for free. Net weight divided by pieces is the
   weight per piece for that lot — the figure that used to need a separate
   inventory name for every weight range. And the lines added up should equal
   the total written at the foot; when they do not, somebody has miscounted
   and it is better found now than at the year end.                        */

export interface DcLine {
  slNo: number
  particulars: string      // exactly as written — SP, DP, DIV, CUPC, 2.5x1.5 RT
  weightRange: number | null
  netWeightKg: number
  lengthFt: string         // written with the foot mark, as on the sheet
  pieces: number
  /** what the paper says, where the shop has since corrected the length */
  writtenLengthFt?: string
  /** the day they corrected it, so the change can be traced to a decision */
  correctedOn?: string
}

export interface PurchaseDc {
  no: string
  date: string
  poNo: string
  supplier: string
  vehicleNo: string
  lines: DcLine[]
  /** the figure written at the foot of the paper, not a sum */
  writtenTotalKg: number
  ccNo: string
}

/* The sheet sent on 13-02-2026. Read off the paper, digit for digit. */
export const SAMPLE_DC: PurchaseDc = {
  no: 'DS/13-02-26', date: '2026-02-13', poNo: '—',
  supplier: 'Jindal Aluminium Ltd — Depot', vehicleNo: '—',
  ccNo: '569',
  writtenTotalKg: 595.560,
  lines: [
    { slNo: 1,  particulars: 'SP',          weightRange: null,  netWeightKg: 35.320, lengthFt: "12'", pieces: 18  },
    { slNo: 2,  particulars: 'SP',          weightRange: null,  netWeightKg: 46.080, lengthFt: "11'", pieces: 24  },
    { slNo: 3,  particulars: 'CUPC',        weightRange: null,  netWeightKg: 63.600, lengthFt: "12'", pieces: 280 },
    { slNo: 4,  particulars: 'DIV',         weightRange: null,  netWeightKg: 36.960, lengthFt: "7'",  pieces: 30  },
    /* The paper reads 11' against this line. The shop settled it on
       20-11-2026 — "DV is 7 feet only, not 11 feet" — and their own figures
       agree: 1.256 kg a piece is 8.5% under a seven-foot DV and 41.8% under
       an eleven-foot one, where every other line on this sheet sits between
       8 and 12% under. Corrected to 7', with what the paper says kept beside
       it rather than quietly replaced. The weight is untouched, so neither
       the line total nor the 5.500 kg the sheet is out by moves. */
    { slNo: 5,  particulars: 'DIV',         weightRange: null,  netWeightKg: 28.880, lengthFt: "7'",  pieces: 23,
      writtenLengthFt: "11'", correctedOn: '2026-11-20' },
    { slNo: 6,  particulars: 'DIV',         weightRange: null,  netWeightKg: 41.040, lengthFt: "8'",  pieces: 30  },
    { slNo: 7,  particulars: 'SP',          weightRange: null,  netWeightKg: 43.640, lengthFt: "15'", pieces: 18  },
    { slNo: 8,  particulars: 'DP',          weightRange: null,  netWeightKg: 45.340, lengthFt: "15'", pieces: 18  },
    { slNo: 9,  particulars: 'DP',          weightRange: null,  netWeightKg: 29.180, lengthFt: "12'", pieces: 14  },
    { slNo: 10, particulars: 'DP',          weightRange: null,  netWeightKg: 47.600, lengthFt: "11'", pieces: 24  },
    { slNo: 11, particulars: 'SP',          weightRange: null,  netWeightKg: 45.900, lengthFt: "10'", pieces: 24  },
    { slNo: 12, particulars: 'DP',          weightRange: null,  netWeightKg: 45.480, lengthFt: "14'", pieces: 18  },
    { slNo: 13, particulars: 'DP',          weightRange: null,  netWeightKg: 38.720, lengthFt: "10'", pieces: 24  },
    { slNo: 14, particulars: '2.5x1.5 RT',  weightRange: 1.900, netWeightKg: 42.320, lengthFt: "12'", pieces: 24  },
  ],
}

export const dcTotals = (d: PurchaseDc) => {
  const lineKg = +d.lines.reduce((s, l) => s + l.netWeightKg, 0).toFixed(3)
  const pieces = d.lines.reduce((s, l) => s + l.pieces, 0)
  return {
    lineKg, pieces,
    writtenKg: d.writtenTotalKg,
    kgGap: +(lineKg - d.writtenTotalKg).toFixed(3),
    /* The colour code number they write is the piece count for the load. */
    ccMatches: String(pieces) === d.ccNo,
  }
}

export const perPiece = (l: DcLine) => l.pieces > 0 ? +(l.netWeightKg / l.pieces).toFixed(3) : 0

/** How far the lot ran from the nominal weight range, where one is written. */
export const rangeVariance = (l: DcLine) =>
  l.weightRange ? +(((perPiece(l) - l.weightRange) / l.weightRange) * 100).toFixed(1) : null

export const feet = (l: DcLine) => parseFloat(l.lengthFt) || 0

/* ── Does each line agree with the others of its own code? ─────────────────
   A code is per cross section — one die, cut to many lengths — so every line
   carrying that code must show the same weight per running foot, whatever
   length it was cut to. Where one line disagrees with its fellows, either a
   figure was copied wrongly or that line is not really the same section.

   This catches what a nominal weight range cannot, because the depot writes
   a range on barely one line in fourteen. It found the DV line reading 11ft
   / 23 pieces / 28.88 kg, whose weight is nearer eight feet of material than
   eleven. Nothing is corrected here: a guessed length would quietly spoil the
   weight per piece of every job cut from that section afterwards.         */

export interface LengthCheck {
  /** best-fit kg per running foot across every line sharing this code */
  kgPerFt: number
  /** the length this line's own weight implies, against the one written */
  impliedFt: number
  /** how far the written weight sits from what the code's own rate predicts */
  offPct: number
  /** true once the gap is too wide to be mill tolerance or rounding */
  suspect: boolean
}

/** Lines of the same code, ignoring any that cannot be measured. */
const comparable = (lines: DcLine[], particulars: string) =>
  lines.filter(l => l.particulars === particulars && l.pieces > 0 && feet(l) > 0)

/**
 * The code's kg/ft, taken as the median of what each of its lines shows.
 *
 * A least-squares fit was the obvious choice and the wrong one: a single bad
 * line drags the fit toward itself, so the standard moves to meet the error
 * and every honest line is then reported as off. On this sheet that marked
 * all three DIV lines when only one is in doubt. The median ignores an
 * outlier instead of absorbing it, so the good lines stay quiet and the odd
 * one out stands alone — which is the whole point of the check.
 */
export function ratePerFoot(lines: DcLine[], particulars: string): number | null {
  const rows = comparable(lines, particulars)
  if (rows.length < 2) return null              // one line proves nothing
  const rates = rows.map(l => perPiece(l) / feet(l)).sort((a, b) => a - b)
  const mid = rates.length >> 1
  return rates.length % 2 ? rates[mid] : (rates[mid - 1] + rates[mid]) / 2
}

/** Tolerance before a line is worth querying, as a percentage of its weight. */
export const LENGTH_TOLERANCE_PCT = 12

export function lengthCheck(lines: DcLine[], l: DcLine): LengthCheck | null {
  const k = ratePerFoot(lines, l.particulars)
  if (!k || l.pieces <= 0 || feet(l) <= 0) return null
  const expected = l.pieces * feet(l) * k
  const offPct = +(((l.netWeightKg - expected) / expected) * 100).toFixed(1)
  return {
    kgPerFt: +k.toFixed(4),
    impliedFt: +(perPiece(l) / k).toFixed(1),
    offPct,
    suspect: Math.abs(offPct) > LENGTH_TOLERANCE_PCT,
  }
}

/** Every line worth querying, worst first. */
export function suspectLines(lines: DcLine[]) {
  return lines
    .map(l => ({ line: l, check: lengthCheck(lines, l) }))
    .filter((r): r is { line: DcLine; check: LengthCheck } => !!r.check && r.check.suspect)
    .sort((a, b) => Math.abs(b.check.offPct) - Math.abs(a.check.offPct))
}

/* ── The colour code sheet that travels with it ────────────────────────────
   The same load, split by the shade each piece is going to be coated in.
   PT beside a shade means it needs pre-treatment before powder.           */

export interface CcLine { section: string; pieces: number }
export interface CcShade { shade: string; preTreatment: boolean; lines: CcLine[] }

export interface ColourCode {
  ccNo: string
  againstDc: string
  date: string
  shades: CcShade[]
}

export const SAMPLE_CC: ColourCode = {
  ccNo: '569', againstDc: 'DS/13-02-26', date: '2026-02-13',
  shades: [
    {
      shade: 'Black Matt', preTreatment: true,
      lines: [
        { section: 'CLAMP',                 pieces: 40 },
        { section: "2.5x1.5 — 10' SG",      pieces: 6  },
        { section: "2.5x1.5 — 12' Plain",   pieces: 18 },
        { section: "2.5x1.5 — 12' DG",      pieces: 6  },
      ],
    },
    {
      shade: 'Ivory (Prime Cream)', preTreatment: false,
      lines: [
        { section: "2.5x1.5 — 12' SG",      pieces: 36  },
        { section: 'CLAMP',                 pieces: 240 },
        { section: "DV — 7'",               pieces: 53  },
        { section: "DV — 8'",               pieces: 30  },
        { section: "2.5x1.5 — 15' SG",      pieces: 18  },
        { section: "2.5x1.5 — 15' DG",      pieces: 18  },
        { section: "2.5x1.5 — 12' DG",      pieces: 30  },
        { section: "2.5x1.5 — 10' SG",      pieces: 48  },
        { section: "2.5x1.5 — 14' DG",      pieces: 18  },
        { section: "2.5x1.5 — 12' (P)",     pieces: 2   },
      ],
    },
    {
      shade: 'Broken White', preTreatment: true,
      lines: [{ section: "2.5x1.5 — 12' Plain", pieces: 4 }],
    },
  ],
}

export const ccTotals = (c: ColourCode) => {
  const shades = c.shades.map(s => ({
    ...s, pieces: s.lines.reduce((a, l) => a + l.pieces, 0),
  }))
  return {
    shades,
    pieces: shades.reduce((a, s) => a + s.pieces, 0),
    preTreated: shades.filter(s => s.preTreatment).reduce((a, s) => a + s.pieces, 0),
  }
}

/* ── Where a received load is put ──────────────────────────────────────── */
export const RECEIVE_AT = [
  { id: 'SHOP', label: 'Shop — K R Puram counter' },
  { id: 'GD1',  label: 'Godown 1 — Main' },
  { id: 'GD2',  label: 'Godown 2 — 4th floor' },
] as const
