/* ── Our side of a coating bill, one line per DC and section ───────────────
   Shared so the billing screen and the reconciliation screen always agree
   on what we think the coater is owed.                                   */

import { CHALLANS, COATING_JOBS } from '@/data/challans'
import { SECTION_PROFILES } from '@/data/sections'
import { POWDER_SHADES, PCUS } from '@/data/locations'

export interface OurCoatingLine {
  key: string          // dcNo|sectionCode
  dcNo: string
  date: string
  pcu: string
  code: string
  name: string
  shadeCode: string
  shadeName: string
  nos: number
  cutLengthFt: number
  sqftPerFt: number
  sqft: number
  baseRate: number
  surcharge: number
  rate: number
  amount: number
}

export function ourCoatingLines(): OurCoatingLine[] {
  const sqftPerFt = Object.fromEntries(SECTION_PROFILES.map(s => [s.code, s.sqftPerFt]))
  const base = Object.fromEntries(PCUS.map(p => [p.id, p.ratePerSqft ?? 11]))
  const sur = Object.fromEntries(POWDER_SHADES.map(s => [s.code, s.surcharge]))

  return COATING_JOBS.flatMap(j => {
    const dc = CHALLANS.find(d => d.no === j.dcNo)
    if (!dc) return []
    return dc.lines.map(l => {
      const per = sqftPerFt[l.code] ?? 0
      const sqft = +(l.totalNos * l.cutLengthFt * per).toFixed(1)
      const baseRate = base[j.pcu] ?? 0
      const surcharge = sur[dc.shadeCode] ?? 0
      const rate = +(baseRate + surcharge).toFixed(2)
      return {
        key: `${j.dcNo}|${l.code}`,
        dcNo: j.dcNo, date: j.date, pcu: j.pcu,
        code: l.code, name: l.name,
        shadeCode: dc.shadeCode, shadeName: dc.shadeName,
        nos: l.totalNos, cutLengthFt: l.cutLengthFt, sqftPerFt: per, sqft,
        baseRate, surcharge, rate,
        amount: +(sqft * rate).toFixed(2),
      }
    })
  })
}
