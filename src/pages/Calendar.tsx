/* ── Calendar, as a screen of its own ─────────────────────────────────────
   Theirs, on 26-11: "add a calendar". The same calendar is a tab on Alerts &
   Reminders, for the days they are already chasing something; this is the
   wider view, with the week counted off above it.                          */

import { PageHead } from '@/components/ui'
import Calendar from '@/components/Calendar'

export default function CalendarPage() {
  return (
    <div>
      <PageHead
        title="Calendar"
        sub="Every date the business already holds — bills falling due, material expected, offers running out, follow-ups and your own notes" />
      <Calendar stats maxH="40rem" />
    </div>
  )
}
