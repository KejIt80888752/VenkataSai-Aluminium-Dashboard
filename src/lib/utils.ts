import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

/** ₹ with Indian digit grouping, no decimals */
export const inr = (n: number) =>
  '₹' + Math.round(n).toLocaleString('en-IN')

/** ₹ with 2 decimals — for rates and line amounts */
export const inr2 = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Compact ₹ for chart axes: 1.2L / 45K */
export const inrShort = (n: number) => {
  if (Math.abs(n) >= 10000000) return '₹' + (n / 10000000).toFixed(2) + 'Cr'
  if (Math.abs(n) >= 100000)   return '₹' + (n / 100000).toFixed(1) + 'L'
  if (Math.abs(n) >= 1000)     return '₹' + Math.round(n / 1000) + 'K'
  return '₹' + n
}

export const kg = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kg'

/** dd MMM yyyy */
export const fmtDate = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Days between an ISO date and "today" (positive = in the past) */
export const daysAgo = (iso: string) =>
  Math.floor((Date.now() - new Date(iso + 'T00:00:00').getTime()) / 86400000)

export const csvDownload = (filename: string, rows: (string | number)[][]) => {
  const body = rows
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

/** 18% GST split — intra-state (Karnataka) = CGST+SGST, else IGST */
export const gstSplit = (taxable: number, rate: number, interState: boolean) => {
  const tax = taxable * rate / 100
  return interState
    ? { cgst: 0, sgst: 0, igst: tax, total: tax }
    : { cgst: tax / 2, sgst: tax / 2, igst: 0, total: tax }
}
