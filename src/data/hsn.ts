/* ── HSN and SAC codes ─────────────────────────────────────────────────────
   Asked for on 20-11-2026: "HSN codes are partial, 8 digit to be given."

   Four digits is a chapter heading and tells a GST officer very little; eight
   is the tariff line. These are the standard ones for what this shop deals
   in, and they are set in one place so a correction is one edit rather than a
   hunt through the screens.

   THEY MUST BE CONFIRMED. A wrong tariff line on a tax invoice is the shop's
   exposure, not ours, and nobody here has seen their returns. Each is the
   usual code for that kind of goods, written here so it can be checked
   against what their accountant already files.                            */

export interface HsnCode {
  /** the eight-digit tariff line, or six for a service */
  code: string
  /** what it covers, in the tariff's own words, shortened */
  covers: string
  /** the four-digit heading it sits under, as the screens used to show */
  heading: string
}

export const HSN: Record<string, HsnCode> = {
  /* Extruded sections, which is most of what they buy and sell. */
  section: {
    code: '76042090',
    covers: 'Aluminium alloy profiles — other',
    heading: '7604',
  },
  /* Handles, hinges, mountings. */
  hardware: {
    code: '83024190',
    covers: 'Base metal mountings for buildings — other',
    heading: '8302',
  },
  /* EPDM and TVS rubber, gaskets, clip rubber. */
  rubber: {
    code: '40169990',
    covers: 'Articles of vulcanised rubber — other',
    heading: '4016',
  },
  /* Powder coating is job work done on another person's goods, so it is a
     service and carries a SAC rather than an HSN. */
  coating: {
    code: '998898',
    covers: 'Other manufacturing services — job work',
    heading: '9988',
  },
}

/** The code for a kind of product, falling back to the section line. */
export const hsnFor = (kind: 'section' | 'hardware' | 'rubber' | 'coating') =>
  HSN[kind]?.code ?? HSN.section.code
