/* ── Physical locations in the material chain ───────────────────────────
   Raw mill-finish sections come from the manufacturer, go out to a powder
   coating unit (PCU), come back heavier, and land at the shop or a godown. */

export type LocType = 'Manufacturer' | 'Coating Unit' | 'Shop' | 'Godown'

export interface Location {
  id: string
  code: string
  name: string
  type: LocType
  address: string
  contact: string
  phone: string
  /** Coating units only — agreed rate card and processing window */
  ratePerSqft?: number
  turnaroundDays?: number
}

export const LOCATIONS: Location[] = [
  { id: 'M1',   code: 'M1',   name: 'Jindal Aluminium — Mill M1',        type: 'Manufacturer', address: 'Tumkur Road, Bengaluru',        contact: 'Depot Sales',  phone: '+91 80 2839 4444' },
  { id: 'PCU1', code: 'PCU1', name: 'Sri Venkateshwara Powder Coating',  type: 'Coating Unit', address: 'Peenya 2nd Stage, Bengaluru',   contact: 'Murthy R',     phone: '+91 98862 41120', ratePerSqft: 11.5, turnaroundDays: 6 },
  { id: 'PCU2', code: 'PCU2', name: 'Ganesh Powder Coaters',            type: 'Coating Unit', address: 'Hoskote Industrial Area',       contact: 'Ganesh Rao',   phone: '+91 97417 30086', ratePerSqft: 10.8, turnaroundDays: 8 },
  { id: 'SHOP', code: 'SHOP', name: 'Shop — K R Puram Counter',          type: 'Shop',         address: '#75, 3rd Cross Muneshwara Layout', contact: 'Kavya M',   phone: '+91 99497 22292' },
  { id: 'GD1',  code: 'GD1',  name: 'Godown 1 — Main',                   type: 'Godown',       address: 'Kodigehalli Main Road',         contact: 'Ganesh P',     phone: '+91 90192 44510' },
  { id: 'GD2',  code: 'GD2',  name: 'Godown 2 — 4th Floor',              type: 'Godown',       address: 'Ayyappa Nagar, 4th Floor',      contact: 'Ganesh P',     phone: '+91 90192 44510' },
]

export const loc = (id: string) => LOCATIONS.find(l => l.id === id)!
export const locName = (id: string) => loc(id)?.name ?? id
export const PCUS = LOCATIONS.filter(l => l.type === 'Coating Unit')
export const STORES = LOCATIONS.filter(l => l.type === 'Shop' || l.type === 'Godown')

/** Every movement leg the business actually runs. */
export interface Route { id: string; from: string; to: string; label: string; leg: 'Outward to Coating' | 'Inward from Coating' | 'Internal Transfer' }

export const ROUTES: Route[] = [
  { id: 'M1-PCU1',   from: 'M1',   to: 'PCU1', label: 'M1 → PCU1',        leg: 'Outward to Coating'  },
  { id: 'M1-PCU2',   from: 'M1',   to: 'PCU2', label: 'M1 → PCU2',        leg: 'Outward to Coating'  },
  { id: 'PCU1-SHOP', from: 'PCU1', to: 'SHOP', label: 'PCU1 → Shop',      leg: 'Inward from Coating' },
  { id: 'PCU1-GD1',  from: 'PCU1', to: 'GD1',  label: 'PCU1 → Godown 1',  leg: 'Inward from Coating' },
  { id: 'PCU1-GD2',  from: 'PCU1', to: 'GD2',  label: 'PCU1 → Godown 2 (4F)', leg: 'Inward from Coating' },
  { id: 'PCU2-SHOP', from: 'PCU2', to: 'SHOP', label: 'PCU2 → Shop',      leg: 'Inward from Coating' },
  { id: 'PCU2-GD1',  from: 'PCU2', to: 'GD1',  label: 'PCU2 → Godown 1',  leg: 'Inward from Coating' },
  { id: 'GD1-SHOP',  from: 'GD1',  to: 'SHOP', label: 'Godown 1 → Shop',  leg: 'Internal Transfer'   },
  { id: 'GD2-SHOP',  from: 'GD2',  to: 'SHOP', label: 'Godown 2 → Shop',  leg: 'Internal Transfer'   },
]

export const route = (id: string) => ROUTES.find(r => r.id === id)!

/** Powder colours run on the line, with the surcharge over base rate. */
export const POWDER_SHADES = [
  { code: 'RAL9016', name: 'Traffic White',    surcharge: 0    },
  { code: 'RAL9001', name: 'Cream Ivory',      surcharge: 0    },
  { code: 'RAL8017', name: 'Chocolate Brown',  surcharge: 0.5  },
  { code: 'RAL9005', name: 'Jet Black Matt',   surcharge: 0.8  },
  { code: 'MET-CHM', name: 'Metallic Champagne', surcharge: 2.4 },
  { code: 'WOOD-TK', name: 'Wood Finish Teak', surcharge: 4.6  },
]
