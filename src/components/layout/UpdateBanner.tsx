import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { newerBuildWaiting, loadNewBuild, BUILT } from '@/lib/version'

/* ── "Nothing has changed" ─────────────────────────────────────────────────
   Theirs, on 22-11, three deploys after plenty had changed. The site was
   right and the browser was wrong, and nobody in the shop had any way of
   telling which — a web page carries no version on its face, and this one
   can be added to a home screen, where there is no address bar to refresh
   from at all.

   This asks the server which build it is serving, on load and every two
   minutes after, and says so when it is not the one running here. Pressing
   it throws away every cache the browser holds for the site and comes back
   on the new one, which a refresh on its own does not always manage.     */

const EVERY = 2 * 60 * 1000

export default function UpdateBanner() {
  const [waiting, setWaiting] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    const look = () => newerBuildWaiting().then(v => { if (alive) setWaiting(v) })
    look()
    const t = setInterval(look, EVERY)
    /* Coming back to a tab that has been sitting open all morning is exactly
       when a new build is most likely to be waiting. */
    const onWake = () => { if (document.visibilityState === 'visible') look() }
    document.addEventListener('visibilitychange', onWake)
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', onWake) }
  }, [])

  if (!waiting) return null

  return (
    <div className="print:hidden flex flex-wrap items-center gap-3 px-4 py-2 text-[12.5px]"
      style={{
        background: 'var(--brand)',
        color: '#fff',
      }}>
      <RefreshCw size={14} className={busy ? 'animate-spin' : undefined} />
      <span className="font-medium">A newer version of the dashboard is ready.</span>
      <span style={{ color: 'rgba(255,255,255,.75)' }}>
        You are on the build of {BUILT}.
      </span>
      <button
        onClick={() => { setBusy(true); loadNewBuild() }}
        disabled={busy}
        className="ml-auto rounded-md px-3 py-1 font-semibold"
        style={{ background: '#fff', color: 'var(--brand)' }}>
        {busy ? 'Loading…' : 'Load it now'}
      </button>
    </div>
  )
}
