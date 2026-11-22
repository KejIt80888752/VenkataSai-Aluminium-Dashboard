import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

/* ── Stamping the build ────────────────────────────────────────────────────
   On 22-11 the shop reported that nothing had changed, three deploys after
   it had. The site was right; their browser was serving what it had cached,
   and with the manifest here the dashboard can be installed to a home
   screen, where a hard refresh is not even a thing the user can do.

   So every build carries the minute it was made. It prints at the foot of
   the menu, which settles in one glance whose copy is old, and the running
   copy checks the server for a newer one and offers to fetch it.        */
const BUILT = new Date().toLocaleString('en-GB', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
}).replace(',', ' ·')

export default defineConfig({
  base: '/VenkataSai-Aluminium-Dashboard/',
  plugins: [react()],
  define: { __BUILT__: JSON.stringify(BUILT) },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
