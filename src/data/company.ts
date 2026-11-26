import { SHOW_SAMPLE } from './sample'
/** Company master — sourced from venkatasaialuminiu.wixsite.com/venkatasaialuminium */
export const COMPANY = {
  name:      'VENKATA SAI ALUMINIUM TRADE LINKS',
  short:     'Venkata Sai Aluminium',
  tagline:   'Build With Venkata Sai Aluminium Trade Links',
  blurb:     'The #1 aluminium supplier in K R Puram — extruded sections, sheets, ACP, glass and fabrication hardware for builders, fabricators and contractors across Bengaluru.',
  founded:   2017,
  proprietor:'D. Nageswara Rao',
  gstin:     '29AEVPN0549N1ZK',
  pan:       'AEVPN0549N',
  state:     'Karnataka',
  stateCode: '29',
  phone:     '+91 99497 22292',
  email:     'venkatasaialuminiumtradelinks@gmail.com',
  website:   'https://venkatasaialuminiu.wixsite.com/venkatasaialuminium',
  address: {
    line1: '#75, 3rd Cross, Muneshwara Layout',
    line2: 'Kodigehalli Main Road, Ayyappa Nagar',
    line3: 'K R Puram, Bengaluru',
    state: 'Karnataka',
    pin:   '560036',
  },
  addressOneLine:
    '#75, 3rd Cross Muneshwara Layout, Kodigehalli Main Road, Ayyappa Nagar, K.R Puram, Bengaluru, Karnataka-560036',
  hours: [
    { day: 'Monday – Saturday', time: '9:00 am – 8:00 pm' },
    { day: 'Sunday',            time: '9:00 am – 2:00 pm' },
  ],
  bank: {
    name:   'Venkata Sai Aluminium Trade Links',
    bank:   'Kotak Mahindra Bank',
    branch: 'K R Puram, Bengaluru',
    acNo:   'XXXXXX4471',
    ifsc:   'KKBK0008091',
  },
  terms: [
    'Goods once sold will not be taken back or exchanged.',
    'Payment due within the agreed credit period from invoice date.',
    'Interest @18% p.a. is chargeable on all bills not paid within due date.',
    'Weight/length tolerance as per IS 1285 extrusion standards.',
    'Subject to Bengaluru jurisdiction only.',
  ],
}

export const FY = 'FY 2026–27'

/* ── "Today" ───────────────────────────────────────────────────────────────
   It was a fixed date, because the sample book is three months long and ends
   on 20-08-2026: with a real clock every invented bill in it would read as
   overdue. The sample is off for this shop, so "today" is now the day it
   actually is — a calendar that opens on the wrong month is worse than no
   calendar, and daysAgo() has always run off the real clock anyway. Turning
   the sample back on for a demo brings the fixed date back with it.

   The local clock, not toISOString(): that is UTC, so between midnight and
   half past five in the morning in India it hands back yesterday.          */
const localIso = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Treated as "today" throughout the dashboard */
export const TODAY = SHOW_SAMPLE ? '2026-08-20' : localIso()
