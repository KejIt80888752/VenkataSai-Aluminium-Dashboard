/* ── The coating book, as Venkata Sai keeps it ─────────────────────────────
   Three sheets, and a fourth the shop added on 11-11-2026 answering the
   queries raised against the first version. The corrections they made are
   in the figures below; the rules they explained are in the constants.

   W/O means without coating. Code 20033 leaves as "W/O 2.5x1.5 16' DG" and
   comes back as IVORY, CB or PGG. The number is the section; the colour is
   a state it passes into at the coater.

   Two of their rules matter more than the rest:

   A blank weight does not mean unweighed. Two or three colours of the same
   section are put on the scale together and the figure is written against
   the first of them, so 116.6 kg covers 450 clips, not the 250 on its own
   line. The rows underneath share that weighment.

   TBC is not one thing. It is door top, bottom and centre -- three sections
   loaded separately and clubbed when sold. Two TBC lines on the sheet are
   six pieces on the floor, which is where the four between 778 and 782
   comes from.                                                              */

export interface CoatLine {
  code: string | null
  name: string
  nos: number
  /** blank where this row shares the weighment written on the row above */
  kg: number | null
  internal?: string | null
  unit?: string | null
  route?: string | null
  at?: string | null
  /** row on their sheet, so a query can be pointed at the paper */
  row: number
}

/* What was lying where on 01-09-2026. */
export const OPENING: CoatLine[] = [
  { code: '20034', name: 'W/O 2.5×1.5 16\' SG', nos: 31.0, kg: 96.84, unit: null, route: 'M1 TO PC1', row: 5 },
  { code: '19539', name: 'DOOR TOP 12\'', nos: 5.0, kg: 11.5, unit: null, route: 'S2 TO PC1', row: 5 },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 28.0, kg: 71.99, unit: null, route: 'M1 TO PC1', row: 6 },
  { code: '20042', name: 'DOOR CENTER', nos: 5.0, kg: 11.25, unit: null, route: 'S2 TO PC1', row: 6 },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 25.0, kg: 63.61, unit: null, route: 'M1 TO PC1', row: 7 },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 35.0, kg: 89.21, unit: null, route: 'M1 TO PC1', row: 8 },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 10.0, kg: 26.89, unit: null, route: 'M1 TO PC1', row: 9 },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 0.0, kg: 0.0, unit: null, route: 'M1 TO PC1', row: 10 },
  { code: 'VAH-1-MT', name: 'AMERICAN  HANDLE 6" MATT', nos: 16.0, kg: null, unit: null, route: 'V1 TO PC1', row: 10 },
  { code: '19382', name: 'W/O CLIPS 12\'', nos: 582.0, kg: 140.54, unit: null, route: 'M1 TO PC1', row: 11 },
  { code: 'VBH-2-MT', name: '4" HINGES MATT', nos: 48.0, kg: null, unit: null, route: 'V1 TO PC1', row: 11 },
  { code: '19382', name: 'W/O CLIPS 12\'', nos: 480.0, kg: 118.54, unit: null, route: 'M1 TO PC1', row: 12 },
  { code: 'VRU-227', name: '6 MM U RUBBER EPDM', nos: 200.0, kg: null, unit: 'KGS', route: 'V1 TO PC1', row: 12 },
  { code: '20034', name: 'W/O 2.5×1.5 15\' SG', nos: 38.0, kg: 101.21, unit: null, route: 'M1 TO PC1', row: 13 },
  { code: 'VRU-003', name: 'CLIP RUBBER TVS', nos: 150.0, kg: null, unit: 'KGS', route: 'V1 TO PC1', row: 13 },
  { code: '20605', name: 'W/O ILK 12\'', nos: 65.0, kg: 82.55, unit: null, route: 'M1 TO PC1', row: 14 },
  { code: 'VRU-005', name: 'KERALA RUBBER TVS', nos: 150.0, kg: null, unit: 'KGS', route: 'V1 TO PC1', row: 14 },
  { code: '20604', name: 'W/O BSO 12\'', nos: 75.0, kg: 91.8, unit: null, route: 'M1 TO PC1', row: 15 },
  { code: 'VRU-004', name: 'D RUBBER TVS', nos: 50.0, kg: null, unit: 'KGS', route: 'V1 TO PC1', row: 15 },
  { code: '20957', name: 'W/O 3TB 12\'', nos: 25.0, kg: 70.35, unit: null, route: 'M1 TO PC1', row: 16 },
  { code: 'VRU-007', name: '12 MM O RUBBER TVS', nos: 50.0, kg: null, unit: 'KGS', route: 'V1 TO PC1', row: 16 },
  { code: '19529', name: 'W/O DOOR BOTTOM 12\'', nos: 34.0, kg: 127.9, unit: null, route: 'M1 TO PC1', row: 17 },
  { code: 'VRU-006', name: '10 MM O RUBBER TVS', nos: 50.0, kg: null, unit: 'KGS', route: 'V1 TO PC1', row: 17 },
  { code: '19543', name: 'W/O DV 7\'', nos: 48.0, kg: 65.0, unit: null, route: 'M1 TO PC1', row: 18 },
  { code: 'VRU-238', name: 'SMALL F RUBBER EPDM', nos: 25.0, kg: null, unit: 'KGS', route: 'V1 TO PC1', row: 18 },
  { code: 'VRU-108', name: 'BIG F RUBBER EPDM', nos: 10.0, kg: null, unit: 'KGS', route: 'V1 TO PC1', row: 19 },
]

/* Sent to the coater on 16 and 17-09-2026. */
export const LOADED: CoatLine[] = [
  { code: '20034', name: 'W/O 2.5×1.5 16\' SG', nos: 21.0, kg: 65.6, unit: null, route: 'M1 TO PC1', row: 5 },
  { code: '19539', name: 'DOOR TOP 12\'', nos: 2.0, kg: 10.2, unit: null, route: 'S2 TO PC1', row: 5 },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 18.0, kg: 46.28, unit: null, route: 'M1 TO PC1', row: 6 },
  { code: '20042', name: 'DOOR CENTER', nos: 2.0, kg: null, unit: null, route: 'S2 TO PC1', row: 6 },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 18.0, kg: 45.8, unit: null, route: 'M1 TO PC1', row: 7 },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 18.0, kg: 45.88, unit: null, route: 'M1 TO PC1', row: 8 },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 18.0, kg: 48.4, unit: null, route: 'M1 TO PC1', row: 9 },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 18.0, kg: 48.5, unit: null, route: 'M1 TO PC1', row: 10 },
  { code: 'VAH-1-MT', name: 'AMERICAN  HANDLE 6" MATT', nos: 16.0, kg: null, unit: null, route: 'V1 TO PC1', row: 10 },
  { code: '19382', name: 'W/O CLIPS 12\'', nos: 182.0, kg: 43.95, unit: null, route: 'M1 TO PC1', row: 11 },
  { code: 'VBH-2-MT', name: '4" HINGES MATT', nos: 48.0, kg: null, unit: null, route: 'V1 TO PC1', row: 11 },
  { code: '19382', name: 'W/O CLIPS 12\'', nos: 280.0, kg: 69.15, unit: null, route: 'M1 TO PC1', row: 12 },
  { code: '20034', name: 'W/O 2.5×1.5 15\' SG', nos: 18.0, kg: 47.94, unit: null, route: 'M1 TO PC1', row: 13 },
  { code: '20605', name: 'W/O ILK 12\'', nos: 40.0, kg: 50.8, unit: null, route: 'M1 TO PC1', row: 14 },
  { code: '20604', name: 'W/O BSO 12\'', nos: 40.0, kg: 48.96, unit: null, route: 'M1 TO PC1', row: 15 },
  { code: '20957', name: 'W/O 3TB 12\'', nos: 14.0, kg: 39.4, unit: null, route: 'M1 TO PC1', row: 16 },
  { code: '19529', name: 'W/O DOOR BOTTOM 12\'', nos: 12.0, kg: 45.14, unit: null, route: 'M1 TO PC1', row: 17 },
  { code: '19543', name: 'W/O DV 7\'', nos: 30.0, kg: 40.7, unit: null, route: 'M1 TO PC1', row: 18 },
]

/* Came back coated on 21-09-2026. */
export const RECEIVED: CoatLine[] = [
  { code: '20033', name: 'IVORY 2.5×1.5 16\' DG', nos: 5.0, kg: 13.7, internal: null, at: 'PC1 COATS', row: 6 },
  { code: '20034', name: 'IVORY 2.5×1.5 16\' SG', nos: 5.0, kg: 14.05, internal: null, at: 'PC1 COATS', row: 7 },
  { code: 'VAH-1-PGG', name: 'AMERICAN  HANDLE 6" PISTA GREEN', nos: 8.0, kg: null, internal: null, at: 'PC1 COATS', row: 9 },
  { code: 'VBH-2-PGG', name: '4" HINGES PISTA GREEN', nos: 24.0, kg: null, internal: null, at: 'PC1 COATS', row: 10 },
  { code: 'VAH-1-CB', name: 'AMERICAN  HANDLE 6" COFFEE BROWN', nos: 8.0, kg: null, internal: null, at: 'PC1 COATS', row: 11 },
  { code: 'VBH-2-CB', name: '4" HINGES COFFEE BROWN', nos: 24.0, kg: null, internal: null, at: 'PC1 COATS', row: 12 },
  { code: '19543', name: 'IVORY DV 7\'', nos: 14.0, kg: 20.0, internal: null, at: 'PC1 COATS', row: 13 },
  { code: '20604', name: 'WHITE BSO 12\'', nos: 20.0, kg: 25.6, internal: 'W BSO 12\'', at: 'PC1 COATS', row: 14 },
  { code: '20605', name: 'IVORY ILK 12\'', nos: 40.0, kg: 54.0, internal: null, at: 'PC1 COATS', row: 15 },
  { code: '20604', name: 'IVORY BSO 12\'', nos: 20.0, kg: 25.8, internal: null, at: 'PC1 COATS', row: 16 },
  { code: '20957', name: 'IVORY 3TB 12\'', nos: 8.0, kg: 35.75, internal: 'IV 3TB 12\'', at: 'PC1 COATS', row: 17 },
  { code: '20957', name: 'WHITE 3TB 12\'', nos: 4.0, kg: null, internal: null, at: 'PC1 COATS', row: 18 },
  { code: '20957', name: 'BLACK 3TB 12\'', nos: 2.0, kg: 5.9, internal: null, at: 'PC1 COATS', row: 19 },
  { code: '19529', name: 'IVORY DOOR BOTTOM 12\'', nos: 10.0, kg: 39.3, internal: null, at: 'PC1 COATS', row: 20 },
  { code: '20034', name: 'BLACK 2.5×1.5 15\' SG', nos: 8.0, kg: 22.0, internal: null, at: 'PC1 COATS', row: 21 },
  { code: '20033', name: 'CB 2.5×1.5 16\' DG', nos: 34.0, kg: 111.65, internal: null, at: 'GODOWN BASEMENT', row: 24 },
  { code: '20034', name: 'CB 2.5×1.5 16\' SG', nos: 6.0, kg: null, internal: null, at: 'GODOWN BASEMENT', row: 25 },
  { code: '20033', name: 'PGG 2.5×1.5 16\' DG', nos: 50.0, kg: 136.25, internal: null, at: 'GODOWN BASEMENT', row: 26 },
  { code: '20034', name: 'PGG 2.5×1.5 16\' SG', nos: 10.0, kg: 28.0, internal: null, at: 'GODOWN BASEMENT', row: 27 },
  { code: '19382', name: 'PGG GLAZING CLIPS 12\'', nos: 250.0, kg: 116.6, internal: null, at: 'GODOWN BASEMENT', row: 28 },
  { code: '19382', name: 'CB GLAZING CLIPS 12\'', nos: 200.0, kg: null, internal: null, at: 'GODOWN BASEMENT', row: 29 },
  { code: '20034', name: 'BLACK 2.5×1.5 15\' SG', nos: 10.0, kg: 27.65, internal: null, at: 'GODOWN BASEMENT', row: 30 },
  { code: null, name: 'PGG TBC 12\'', nos: 1.0, kg: 19.1, internal: null, at: 'GODOWN BASEMENT', row: 31 },
  { code: null, name: 'CB TBC 12\'', nos: 1.0, kg: null, internal: null, at: 'GODOWN BASEMENT', row: 32 },
  { code: '19543', name: 'PGG DV 7\'', nos: 8.0, kg: 22.55, internal: null, at: 'GODOWN BASEMENT', row: 33 },
  { code: '19543', name: 'CB DV 7\'', nos: 8.0, kg: null, internal: null, at: 'GODOWN BASEMENT', row: 34 },
]

export const WRITTEN = {
  /* The figure written at the foot of their opening sheet. It still carries
     the old 1.6 against DV 7'; the 65 kg they sent on 11-11 has gone into
     the line above but not yet into their own total. */
  opening:  { nos: 1476, kg: 1083.03 },
  loaded:   { nos: 727,  kg: 686.50 },
  received: { nos: 778,  kg: 717.90, splittedSeparately: 782 },
}

/* Their words, confirmed on the clarifications sheet. */
export const COLOURS: Record<string, string> = {
  'W/O':   'Uncoated',
  'IVORY': 'Ivory',
  'WHITE': 'White',
  'BLACK': 'Black',
  'CB':    'Coffee Brown',
  'PGG':   'Pista Green Glossy',
  'PG':    'Pista Green Glossy',
  'MT':    'Matt',
}

/** TBC is three sections clubbed, which is why a TBC line of 1 is 3 pieces. */
export const TBC_PARTS = ['Door Top', 'Door Bottom', 'Door Centre']
export const TBC_MULTIPLIER = TBC_PARTS.length

export function colourOf(line: CoatLine): string {
  const n = (line.name || '').toUpperCase().trim()
  for (const key of ['W/O', 'IVORY', 'WHITE', 'BLACK', 'CB', 'PGG']) {
    if (n.startsWith(key + ' ')) return COLOURS[key]
  }
  if (n.includes('PISTA GREEN')) return COLOURS.PGG
  if (n.includes('COFFEE BROWN')) return COLOURS.CB
  if (n.includes('MATT')) return COLOURS.MT
  const tail = (line.code || '').toUpperCase().split('-').pop() ?? ''
  return COLOURS[tail] ?? 'Not stated'
}

export function sectionOf(line: CoatLine): string {
  let n = (line.name || '').trim()
  for (const key of ['W/O', 'IVORY', 'WHITE', 'BLACK', 'CB', 'PGG']) {
    const k = key + ' '
    if (n.toUpperCase().startsWith(k)) { n = n.slice(k.length); break }
  }
  return n.trim()
}

export const isHardware = (l: CoatLine) => !!l.code && /^[A-Z]{2,3}-/.test(l.code)
export const isRubber = (l: CoatLine) => (l.unit || '').toUpperCase() === 'KGS'
export const isTbc = (l: CoatLine) => /\bTBC\b/i.test(l.name)

/** Rows weighed together: the one carrying the figure, and those sharing it. */
export interface Weighment {
  kg: number
  lines: CoatLine[]
  nos: number
  perPiece: number
}

export function weighments(lines: CoatLine[]): Weighment[] {
  const out: Weighment[] = []
  let current: Weighment | null = null
  for (const l of lines) {
    if (isHardware(l) || isRubber(l)) { current = null; continue }
    if (l.kg !== null) {
      current = { kg: l.kg, lines: [l], nos: l.nos, perPiece: 0 }
      out.push(current)
    } else if (current) {
      current.lines.push(l)
      current.nos += l.nos
    }
  }
  for (const w of out) w.perPiece = w.nos ? +(w.kg / w.nos).toFixed(3) : 0
  return out
}

