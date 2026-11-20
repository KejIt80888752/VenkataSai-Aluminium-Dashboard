/* ── Getting a sheet off the screen and onto a desk ────────────────────────
   Asked for on 20-11-2026: "PDF / Excel download option for that sheet."

   CSV was all there was, and CSV is not a sheet — it loses the heading, the
   totals and every column width, and Excel guesses at the types on the way
   in. Two ways out instead:

   Excel gets a real workbook sheet written as a table Excel reads natively.
   No library, nothing to keep up to date, and the numbers arrive as numbers
   rather than as text that has to be converted before it will add up.

   PDF goes through the browser's own print, which is also how the invoice
   and the quotation print, so one habit covers all of them.             */

export interface SheetMeta { label: string; value: string }

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

/**
 * Downloads an Excel sheet.
 *
 * @param filename what to call it, without the extension
 * @param title    the heading that sits above the table
 * @param meta     the sheet's own particulars — supplier, date, DC number
 * @param headers  the column headings
 * @param rows     the body
 * @param totals   a bold row at the foot, where there is one
 */
export function xlsDownload(
  filename: string,
  title: string,
  meta: SheetMeta[],
  headers: string[],
  rows: (string | number | null)[][],
  totals?: (string | number | null)[],
) {
  const cell = (v: string | number | null) =>
    isNum(v)
      ? `<td style="mso-number-format:'General'" align="right">${esc(v)}</td>`
      : `<td>${esc(v)}</td>`

  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head>
<meta charset="utf-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>${esc(title).slice(0, 31)}</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
 td,th{border:1px solid #c6cdd5;padding:4px 7px;font-family:Calibri,Arial,sans-serif;font-size:11pt}
 th{background:#eef2f6;font-weight:700;text-align:left}
 .title{font-size:14pt;font-weight:700;border:none}
 .meta{border:none;color:#555}
 .total{background:#f6f8fa;font-weight:700}
</style></head><body>
<table>
 <tr><td class="title" colspan="${headers.length}">${esc(title)}</td></tr>
 ${meta.map(m => `<tr><td class="meta" colspan="${headers.length}">${esc(m.label)}: ${esc(m.value)}</td></tr>`).join('')}
 <tr><td class="meta" colspan="${headers.length}"></td></tr>
 <tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr>
 ${rows.map(r => `<tr>${r.map(cell).join('')}</tr>`).join('')}
 ${totals ? `<tr class="total">${totals.map(cell).join('')}</tr>` : ''}
</table></body></html>`

  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${filename}.xls`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
