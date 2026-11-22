/* ── Which copy of the dashboard is this? ──────────────────────────────────
   On 22-11 the shop said nothing had changed, three deploys after it had.
   The site was right and their browser was wrong: it was serving the copy it
   had cached. Nobody could tell, because a web page carries no version on
   its face, and with this one installable to a home screen there is not even
   a refresh button to press.

   Two things answer it. Every build stamps the minute it was made, printed
   at the foot of the menu — one glance settles whose copy is old. And the
   running copy asks the server, every few minutes, which build is current;
   when they differ it says so and offers to fetch the new one.           */

declare const __BUILT__: string

/** The minute this copy was built, in IST. */
export const BUILT: string = typeof __BUILT__ === 'string' ? __BUILT__ : 'development'

/** The script this copy is running — the hash in its filename. */
function runningScript(): string {
  const tags = [...document.querySelectorAll('script[src]')] as HTMLScriptElement[]
  const main = tags.map(t => t.src).find(src => /\/assets\/index-[\w-]+\.js$/.test(src))
  return main ? main.split('/').pop()! : ''
}

/**
 * The script the server is serving now.
 *
 * The page itself is fetched past every cache — a query nobody has asked for
 * before, and no-store on top — because the whole point is to find out what
 * is actually there rather than what this browser remembers.
 */
async function servedScript(): Promise<string> {
  const url = `${import.meta.env.BASE_URL}index.html?v=${Date.now()}`
  const html = await fetch(url, { cache: 'no-store' }).then(r => r.text())
  const m = html.match(/assets\/(index-[\w-]+\.js)/)
  return m ? m[1] : ''
}

/** True where the server has a build this copy is not running. */
export async function newerBuildWaiting(): Promise<boolean> {
  try {
    const mine = runningScript()
    if (!mine) return false
    const theirs = await servedScript()
    return !!theirs && theirs !== mine
  } catch {
    /* Offline, or the page was opened from a file. Say nothing. */
    return false
  }
}

/**
 * Throws away every cache this browser holds for the site and loads again.
 *
 * Clearing the Cache Storage matters on a phone where the dashboard has been
 * added to the home screen: there is no address bar to hard-refresh from, so
 * without this the old copy can sit there for days.
 */
export async function loadNewBuild() {
  try {
    if ('caches' in window) {
      const names = await caches.keys()
      await Promise.all(names.map(n => caches.delete(n)))
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
  } catch { /* nothing to clear */ }
  /* A changed address is a page no cache has an answer for. */
  const url = new URL(window.location.href)
  url.searchParams.set('v', String(Date.now()))
  window.location.replace(url.toString())
}
