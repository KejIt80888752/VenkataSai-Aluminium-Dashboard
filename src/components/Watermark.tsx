import { useAuth } from '@/hooks/useAuth'

/* ── The only thing that actually deters a screenshot ──────────────────────
   No browser can stop a screen being photographed. What works is making the
   photograph say who took it: every screen carries the viewer's name and the
   minute, faintly, across the whole page. People do not pass on a document
   with their own name written across it.                                  */

export default function Watermark() {
  const { user } = useAuth()
  if (!user) return null

  const stamp = `${user.name} · ${user.email} · ${new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })}`

  // Drawn once into a tile and repeated, so it costs nothing to scroll.
  const tile = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="230">
       <text x="0" y="150" transform="rotate(-24 0 150)"
         font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13"
         fill="currentColor">${stamp.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
     </svg>`,
  )

  return (
    <div aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 select-none"
      style={{
        color: 'var(--text-1)',
        opacity: 0.055,
        backgroundImage: `url("data:image/svg+xml,${tile}")`,
        backgroundRepeat: 'repeat',
        // Keep it out of the way of anything being printed for a customer.
        printColorAdjust: 'exact',
      }}
    />
  )
}
