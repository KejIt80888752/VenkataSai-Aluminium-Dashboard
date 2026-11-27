import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { snapshotDaily } from '@/lib/backup'

/* One copy of the registers a day, taken the first time the office opens the
   dashboard. Theirs, on 27-11: "that estimate is lost, again we have to redo." */
snapshotDaily()

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
