/**
 * Party and location codes — supplied by the client on 13-11-2026.
 *
 * The distinction that matters: M1, S2, V1 and PC1 are *parties we deal with*,
 * not places material is kept. Only SHOP 1/2 and GODOWN 1/2 are ours. A route
 * written "M1 TO PC1" therefore reads "from Manufacturer 1 to Powder Coater 1"
 * — neither end of it is a storage location of ours.
 *
 * Kept apart from parties.ts, which holds the customer and supplier masters.
 * These are the short codes as they appear on the coating sheets.
 */

export type PartyKind = 'manufacturer' | 'retail' | 'coater' | 'hardware'

export interface PartyCode {
  code: string
  name: string
  kind: PartyKind
  /** What this party sends us, in plain words. */
  supplies: string
}

export const PARTY_CODES: PartyCode[] = [
  { code: 'M1',  name: 'Manufacturer 1',      kind: 'manufacturer', supplies: 'Raw aluminium sections — the mill' },
  { code: 'S2',  name: 'Retail Supplier 2',   kind: 'retail',       supplies: 'Bought-out sections and door parts' },
  { code: 'PC1', name: 'Powder Coating 1',    kind: 'coater',       supplies: 'Coating job work — goes out and comes back' },
  { code: 'V1',  name: 'Hardware Supplier 1', kind: 'hardware',     supplies: 'Handles, hinges, clips, rubber' },
]

export interface LocationCode {
  code: string
  name: string
  short: string
}

/** Everywhere we actually keep stock. Nothing else is a location. */
export const LOCATION_CODES: LocationCode[] = [
  { code: 'SHOP 1',   name: 'VSA Shop 1',      short: 'Shop 1'   },
  { code: 'SHOP 2',   name: 'VSA Shop 2',      short: 'Shop 2'   },
  { code: 'GODOWN 1', name: 'Basement Godown', short: 'Basement' },
  { code: 'GODOWN 2', name: 'Godown 4F',       short: '4F'       },
]

const PARTY_BY_CODE = new Map(PARTY_CODES.map(p => [p.code, p]))
const LOC_BY_CODE   = new Map(LOCATION_CODES.map(l => [l.code, l]))

/** Expands a code to its full name, or hands the code back if we do not know it. */
export function expandCode(code: string): string {
  const c = code.trim().toUpperCase()
  return PARTY_BY_CODE.get(c)?.name ?? LOC_BY_CODE.get(c)?.name ?? code
}

export const isPartyCode    = (code: string) => PARTY_BY_CODE.has(code.trim().toUpperCase())
export const isLocationCode = (code: string) => LOC_BY_CODE.has(code.trim().toUpperCase())

/** "M1 TO PC1" → "Manufacturer 1 to Powder Coating 1". */
export function expandRoute(route: string): string {
  return route.split(/\s+TO\s+/i).map(expandCode).join(' to ')
}
