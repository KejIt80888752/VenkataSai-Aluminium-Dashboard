/* ── Document numbers that look after themselves ───────────────────────────
   Asked for on 20-11-2026:

     "It is asking the code number. It should reflect automatically — one,
      two, three it has to go. And if I edit the same quotation it has to give
      a revised version, REV. And the date has to automatically change. I
      should not be in a position to manually select."

   So a number is never typed. The series is read off what already exists and
   the next one follows it, which also means two people cannot be handed the
   same number by typing carelessly.

   A revision keeps the number it revises and adds R1, R2 to the end of it, so
   the customer can see at a glance that VSA/Q/26-27/0007-R2 is the third time
   they have been sent that quotation and not a fourth quotation.          */

/** The year part of a number, as the trade writes a financial year. */
export const fyTag = (fy: string) => fy.replace(/[^\d–\-]/g, '').replace('–', '-').slice(-5)

const SERIAL = /\/(\d+)(?:-R\d+)?$/

/**
 * The next number in a series.
 *
 * @param prefix  e.g. "VSA/Q/26-27"
 * @param existing every number already issued in any series
 */
export function nextDocNo(prefix: string, existing: string[]): string {
  const mine = existing.filter(n => n.startsWith(prefix + '/'))
  const top = mine.reduce((max, n) => {
    const m = n.match(SERIAL)
    return m ? Math.max(max, parseInt(m[1], 10)) : max
  }, 0)
  return `${prefix}/${String(top + 1).padStart(4, '0')}`
}

/** VSA/Q/26-27/0007 → ...-R1; ...-R1 → ...-R2. */
export function revisionOf(no: string): string {
  const m = no.match(/^(.*)-R(\d+)$/)
  return m ? `${m[1]}-R${parseInt(m[2], 10) + 1}` : `${no}-R1`
}

/** The revision number showing in a document number, 0 for the original. */
export const revisionNumber = (no: string) => parseInt(no.match(/-R(\d+)$/)?.[1] ?? '0', 10)

/** The number without its revision, so every version of one quote groups. */
export const baseDocNo = (no: string) => no.replace(/-R\d+$/, '')

/** Today, as an input[type=date] wants it. */
export const today = () => new Date().toISOString().slice(0, 10)

/** The shop's default validity. Changeable on the document. */
/* Theirs, on 22-11: "keep valid for 1 day default." An aluminium price
   moves with LME and a rate held open for a week is a rate given away. */
export const DEFAULT_VALID_DAYS = 1

export function validTill(from: string, days = DEFAULT_VALID_DAYS): string {
  const d = new Date(from + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
