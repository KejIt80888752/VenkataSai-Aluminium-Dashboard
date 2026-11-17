/* ── Sample data, and the switch that hides it ─────────────────────────────
   The shop asked for the invented data to go: real figures and made-up ones
   side by side are worse than no figures at all, because nobody can tell
   which is which, and a number you cannot trust is a number you have to
   check by hand anyway.

   Their own data stays — the February despatch sheet, the three coating
   sheets, the party codes, the colour codes, the company itself. Everything
   else was written to build against and is now out of sight.

   It is a switch rather than a deletion. The rows are three months of work
   and they still have a use: showing a different shop what the system does
   before that shop has given us anything. Turning SHOW_SAMPLE on brings
   them all back. For Venkata Sai it stays off.                            */

export const SHOW_SAMPLE = false

/** Hands back the rows when sample data is on, and nothing when it is off. */
export function sample<T>(rows: T[]): T[] {
  return SHOW_SAMPLE ? rows : []
}
