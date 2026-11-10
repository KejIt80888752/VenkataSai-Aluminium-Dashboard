/* ── The coating book, exactly as Venkata Sai keeps it ─────────────────────
   Three sheets sent by the shop on 10-11-2026: what was lying where on the
   first of September, what went out to the coater on the sixteenth and
   seventeenth, and what came back on the twenty-first.

   The thing to understand before anything else is the W/O prefix. W/O means
   without coating — raw, mill finish. Code 20033 leaves as "W/O 2.5x1.5 16'
   DG" and comes back as "IVORY", "CB" or "PGG 2.5x1.5 16' DG". One section,
   several colours. The number is the section; the colour is a state it
   passes into at the coater. That is why one line in a stock book was never
   going to hold it.

   Sections are counted in pieces and weighed. Hardware is counted only.
   Rubber is bought by the kilogram, and the quantity column holds kilograms
   with the word KGS written beside it.                                    */

export interface CoatLine {
  code: string | null
  name: string
  nos: number
  /** blank on the sheet where it was not weighed */
  kg: number | null
  internal?: string | null
  unit?: string | null
  route?: string | null
  at?: string | null
  when?: string | null
}

/* What was lying where on 01-09-2026. */
export const OPENING: CoatLine[] = [
  { code: '20034', name: 'W/O 2.5×1.5 16\' SG', nos: 31.0, kg: 96.84, unit: null, route: 'M1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: '19539', name: 'DOOR TOP 12\'', nos: 5.0, kg: 11.5, unit: null, route: 'S2 TO PC1', when: 'OPENING 01-09-2026' },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 28.0, kg: 71.99, unit: null, route: 'M1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: '20042', name: 'DOOR CENTER', nos: 5.0, kg: 11.25, unit: null, route: 'S2 TO PC1', when: 'OPENING 01-09-2026' },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 25.0, kg: 63.61, unit: null, route: 'M1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 35.0, kg: 89.21, unit: null, route: 'M1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 10.0, kg: 26.89, unit: null, route: 'M1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 0.0, kg: 0.0, unit: null, route: 'M1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: 'VAH-1-MT', name: 'AMERICAN  HANDLE 6" MATT', nos: 16.0, kg: null, unit: null, route: 'V1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: '19382', name: 'W/O CLIPS 12\'', nos: 582.0, kg: 140.54, unit: null, route: 'M1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: 'VBH-2-MT', name: '4" HINGES MATT', nos: 48.0, kg: null, unit: null, route: 'V1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: '19382', name: 'W/O CLIPS 12\'', nos: 480.0, kg: 118.54, unit: null, route: 'M1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: 'VRU-227', name: '6 MM U RUBBER EPDM', nos: 200.0, kg: null, unit: 'KGS', route: 'V1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: '20034', name: 'W/O 2.5×1.5 15\' SG', nos: 38.0, kg: 101.21, unit: null, route: 'M1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: 'VRU-003', name: 'CLIP RUBBER TVS', nos: 150.0, kg: null, unit: 'KGS', route: 'V1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: '20605', name: 'W/O ILK 12\'', nos: 65.0, kg: 82.55, unit: null, route: 'M1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: 'VRU-005', name: 'KERALA RUBBER TVS', nos: 150.0, kg: null, unit: 'KGS', route: 'V1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: '20604', name: 'W/O BSO 12\'', nos: 75.0, kg: 91.8, unit: null, route: 'M1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: 'VRU-004', name: 'D RUBBER TVS', nos: 50.0, kg: null, unit: 'KGS', route: 'V1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: '20957', name: 'W/O 3TB 12\'', nos: 25.0, kg: null, unit: null, route: 'M1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: 'VRU-007', name: '12 MM O RUBBER TVS', nos: 50.0, kg: null, unit: 'KGS', route: 'V1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: '19529', name: 'W/O DOOR BOTTOM 12\'', nos: 34.0, kg: 127.9, unit: null, route: 'M1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: 'VRU-006', name: '10 MM O RUBBER TVS', nos: 50.0, kg: null, unit: 'KGS', route: 'V1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: '19543', name: 'W/O DV 7\'', nos: 48.0, kg: 1.6, unit: null, route: 'M1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: 'VRU-238', name: 'SMALL F RUBBER EPDM', nos: 25.0, kg: null, unit: 'KGS', route: 'V1 TO PC1', when: 'OPENING 01-09-2026' },
  { code: 'VRU-108', name: 'BIG F RUBBER EPDM', nos: 10.0, kg: null, unit: 'KGS', route: 'V1 TO PC1', when: 'OPENING 01-09-2026' },
]

/* Sent to the coater on 16 and 17-09-2026. */
export const LOADED: CoatLine[] = [
  { code: '20034', name: 'W/O 2.5×1.5 16\' SG', nos: 21.0, kg: 65.6, unit: null, route: 'M1 TO PC1', when: 'MATERIAL LOADED 16-09-2026' },
  { code: '19539', name: 'DOOR TOP 12\'', nos: 2.0, kg: 10.2, unit: null, route: 'S2 TO PC1', when: 'MATERIAL LOADED 17-09-2026' },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 18.0, kg: 46.28, unit: null, route: 'M1 TO PC1', when: 'MATERIAL LOADED 16-09-2026' },
  { code: '20042', name: 'DOOR CENTER', nos: 2.0, kg: null, unit: null, route: 'S2 TO PC1', when: 'MATERIAL LOADED 17-09-2026' },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 18.0, kg: 45.8, unit: null, route: 'M1 TO PC1', when: 'MATERIAL LOADED 16-09-2026' },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 18.0, kg: 45.88, unit: null, route: 'M1 TO PC1', when: 'MATERIAL LOADED 16-09-2026' },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 18.0, kg: 48.4, unit: null, route: 'M1 TO PC1', when: 'MATERIAL LOADED 16-09-2026' },
  { code: '20033', name: 'W/O 2.5×1.5 16\' DG', nos: 18.0, kg: 48.5, unit: null, route: 'M1 TO PC1', when: 'MATERIAL LOADED 16-09-2026' },
  { code: 'VAH-1-MT', name: 'AMERICAN  HANDLE 6" MATT', nos: 16.0, kg: null, unit: null, route: 'V1 TO PC1', when: 'MATERIAL LOADED 17-09-2026' },
  { code: '19382', name: 'W/O CLIPS 12\'', nos: 182.0, kg: 43.95, unit: null, route: 'M1 TO PC1', when: 'MATERIAL LOADED 16-09-2026' },
  { code: 'VBH-2-MT', name: '4" HINGES MATT', nos: 48.0, kg: null, unit: null, route: 'V1 TO PC1', when: 'MATERIAL LOADED 17-09-2026' },
  { code: '19382', name: 'W/O CLIPS 12\'', nos: 280.0, kg: 69.15, unit: null, route: 'M1 TO PC1', when: 'MATERIAL LOADED 16-09-2026' },
  { code: '20034', name: 'W/O 2.5×1.5 15\' SG', nos: 18.0, kg: 47.94, unit: null, route: 'M1 TO PC1', when: 'MATERIAL LOADED 16-09-2026' },
  { code: '20605', name: 'W/O ILK 12\'', nos: 40.0, kg: 50.8, unit: null, route: 'M1 TO PC1', when: 'MATERIAL LOADED 16-09-2026' },
  { code: '20604', name: 'W/O BSO 12\'', nos: 40.0, kg: 48.96, unit: null, route: 'M1 TO PC1', when: 'MATERIAL LOADED 16-09-2026' },
  { code: '20957', name: 'W/O 3TB 12\'', nos: 14.0, kg: 39.4, unit: null, route: 'M1 TO PC1', when: 'MATERIAL LOADED 16-09-2026' },
  { code: '19529', name: 'W/O DOOR BOTTOM 12\'', nos: 12.0, kg: 45.14, unit: null, route: 'M1 TO PC1', when: 'MATERIAL LOADED 16-09-2026' },
  { code: '19543', name: 'W/O DV 7\'', nos: 30.0, kg: 1.0, unit: null, route: 'M1 TO PC1', when: 'MATERIAL LOADED 16-09-2026' },
]

/* Came back coated on 21-09-2026. */
export const RECEIVED: CoatLine[] = [
  { code: '20033', name: 'IVORY 2.5×1.5 16\' DG', nos: 5.0, kg: 13.7, internal: null, at: 'PC1 COATS' },
  { code: '20034', name: 'IVORY 2.5×1.5 16\' SG', nos: 5.0, kg: 14.05, internal: null, at: 'PC1 COATS' },
  { code: 'VAH-1-PG', name: 'AMERICAN  HANDLE 6" PISTA GREEN', nos: 8.0, kg: null, internal: null, at: 'PC1 COATS' },
  { code: 'VBH-2-PG', name: '4" HINGES PISTA GREEN', nos: 24.0, kg: null, internal: null, at: 'PC1 COATS' },
  { code: 'VAH-1-CB', name: 'AMERICAN  HANDLE 6" COFFEE BROWN', nos: 8.0, kg: null, internal: null, at: 'PC1 COATS' },
  { code: 'VBH-2-CB', name: '4" HINGES COFFEE BROWN', nos: 24.0, kg: null, internal: null, at: 'PC1 COATS' },
  { code: '19543', name: 'IVORY DV 7\'', nos: 14.0, kg: 20.0, internal: null, at: 'PC1 COATS' },
  { code: '20604', name: 'WHITE BSO 12\'', nos: 20.0, kg: 25.6, internal: 'W BSO 12\'', at: 'PC1 COATS' },
  { code: '20605', name: 'IVORY ILK 12\'', nos: 40.0, kg: 54.0, internal: null, at: 'PC1 COATS' },
  { code: '20604', name: 'IVORY BSO 12\'', nos: 20.0, kg: 25.8, internal: null, at: 'PC1 COATS' },
  { code: '20957', name: 'IVORY 3TB 12\'', nos: 8.0, kg: 35.75, internal: 'IV 3TB 12\'', at: 'PC1 COATS' },
  { code: '20957', name: 'WHITE 3TB 12\'', nos: 4.0, kg: null, internal: null, at: 'PC1 COATS' },
  { code: '20957', name: 'BLACK 3TB 12\'', nos: 2.0, kg: 5.9, internal: null, at: 'PC1 COATS' },
  { code: '19529', name: 'IVORY DOOR BOTTOM 12\'', nos: 10.0, kg: 39.3, internal: null, at: 'PC1 COATS' },
  { code: '20034', name: 'BLACK 2.5×1.5 15\' SG', nos: 8.0, kg: 22.0, internal: null, at: 'PC1 COATS' },
  { code: '20033', name: 'CB 2.5×1.5 16\' DG', nos: 34.0, kg: 111.65, internal: null, at: 'GODOWN BASEMENT' },
  { code: '20034', name: 'CB 2.5×1.5 16\' SG', nos: 6.0, kg: null, internal: null, at: 'GODOWN BASEMENT' },
  { code: '20033', name: 'PGG 2.5×1.5 16\' DG', nos: 50.0, kg: 136.25, internal: null, at: 'GODOWN BASEMENT' },
  { code: '20034', name: 'PGG 2.5×1.5 16\' SG', nos: 10.0, kg: 28.0, internal: null, at: 'GODOWN BASEMENT' },
  { code: '19382', name: 'PGG GLAZING CLIPS 12\'', nos: 250.0, kg: 116.6, internal: null, at: 'GODOWN BASEMENT' },
  { code: '19382', name: 'CB GLAZING CLIPS 12\'', nos: 200.0, kg: null, internal: null, at: 'GODOWN BASEMENT' },
  { code: '20034', name: 'BLACK 2.5×1.5 15\' SG', nos: 10.0, kg: 27.65, internal: null, at: 'GODOWN BASEMENT' },
  { code: null, name: 'PGG TBC 12\'', nos: 1.0, kg: 19.1, internal: null, at: 'GODOWN BASEMENT' },
  { code: null, name: 'CB TBC 12\'', nos: 1.0, kg: null, internal: null, at: 'GODOWN BASEMENT' },
  { code: '19543', name: 'PGG DV 7\'', nos: 8.0, kg: 22.55, internal: null, at: 'GODOWN BASEMENT' },
  { code: '19543', name: 'CBB DV 7\'', nos: 8.0, kg: null, internal: null, at: 'GODOWN BASEMENT' },
]

/* The figures written at the foot of each sheet, kept so the software can be
   held against the paper rather than quietly replacing it. */
export const WRITTEN = {
  opening:  { nos: 1476, kg: 1012.68, note: 'covers the M1 block only' },
  loaded:   { nos: 727,  kg: 646.80,  note: 'covers the M1 block only' },
  received: { nos: 778,  kg: 717.90,  splittedSeparately: 782 },
}

/* The colours a section comes back in. W/O is the raw state it goes out in. */
export const COLOURS: Record<string, string> = {
  'W/O':   'Uncoated',
  'IVORY': 'Ivory',
  'WHITE': 'White',
  'BLACK': 'Black',
  'CB':    'Coffee Brown',
  'CBB':   'Coffee Brown',
  'PGG':   'Pista Green',
  'PG':    'Pista Green',
  'MT':    'Matt',
  'MATT':  'Matt',
}

/** Pulls the colour off the front of a product name, or out of a hardware code. */
export function colourOf(line: CoatLine): string {
  const n = (line.name || '').toUpperCase().trim()
  for (const key of ['W/O', 'IVORY', 'WHITE', 'BLACK', 'CBB', 'CB', 'PGG']) {
    if (n.startsWith(key + ' ')) return COLOURS[key]
  }
  if (n.includes('PISTA GREEN')) return 'Pista Green'
  if (n.includes('COFFEE BROWN')) return 'Coffee Brown'
  if (n.includes('MATT')) return 'Matt'
  const c = (line.code || '').toUpperCase()
  const tail = c.split('-').pop() ?? ''
  return COLOURS[tail] ?? 'Not stated'
}

/** The section, with the colour word taken off the front. */
export function sectionOf(line: CoatLine): string {
  let n = (line.name || '').trim()
  for (const key of ['W/O', 'IVORY', 'WHITE', 'BLACK', 'CBB', 'CB', 'PGG']) {
    const k = key + ' '
    if (n.toUpperCase().startsWith(k)) { n = n.slice(k.length); break }
  }
  return n.trim()
}

export const isHardware = (l: CoatLine) => !!l.code && /^[A-Z]{2,3}-/.test(l.code)
export const isRubber = (l: CoatLine) => (l.unit || '').toUpperCase() === 'KGS'

