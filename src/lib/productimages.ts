/* ── A photograph of what is being supplied ────────────────────────────────
   Theirs, on 21-11: "show product images only in the Proforma invoice."

   Which is the one document where a picture earns its place. A proforma goes
   out before the goods do, often to somebody who has not seen the section and
   is being asked to pay against it; a quotation is about price and a tax
   invoice is a record of what has already moved. So the picture is attached
   to the product once and printed on that document only.

   It is kept small on purpose. A photograph off a phone is three or four
   megabytes and the browser's own store holds about five in total, so every
   picture is scaled to 320px on its long side and re-encoded as a JPEG
   before it is kept — enough to recognise a section by, and small enough
   that a hundred of them still fit.                                       */

import { useSyncExternalStore } from 'react'

const KEY = 'vsa-product-images'
/** 320px and 70% quality lands a section photograph at roughly 15–25 KB. */
const EDGE = 320
const QUALITY = 0.7

type Images = Record<string, string>

const read = (): Images => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} }
}

let cache: Images = read()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(f => f())

const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f) } }

/** Every picture held, re-read whenever one is added or removed. */
export const useProductImages = () =>
  useSyncExternalStore(subscribe, () => cache, () => cache)

export const imageOf = (productId?: string) =>
  productId ? cache[productId] : undefined

function save(next: Images) {
  cache = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* full or blocked */ }
  emit()
}

export function removeProductImage(productId: string) {
  const next = { ...cache }
  delete next[productId]
  save(next)
}

/** Reads a chosen file, scales it down and keeps it against the product. */
export function setProductImage(productId: string, file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('could not read that file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('that file is not an image'))
      img.onload = () => {
        const scale = Math.min(1, EDGE / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('cannot resize here'))
        ctx.drawImage(img, 0, 0, w, h)
        save({ ...cache, [productId]: canvas.toDataURL('image/jpeg', QUALITY) })
        resolve()
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
