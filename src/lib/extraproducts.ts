/* ── Things the shop sells that are not on the coating sheets ──────────────
   They typed DOOR CLOSER into a quotation, put five against it at eight
   hundred, and could not raise it. Fair enough: the master is built from
   their three coating sheets, and a door closer never went to a powder
   coater, so there were twenty-two products in the world and that was not
   one of them.

   A shop cannot wait on us to sell something. Anything typed that the master
   does not know can be taken as it stands, and it joins the list from then
   on, so the second door closer is picked rather than typed again.

   Kept apart from the master, which stays exactly what their own books say.
   These are theirs too, just newer — and when the real product list arrives
   with codes and prices it takes precedence and these fall in behind it.  */

import { useState, useEffect } from 'react'

const KEY = 'vsa-extra-products'

export interface ExtraProduct {
  id: string
  /** their code, where they gave one */
  code: string
  name: string
  /** anything else it answers to, searched but not shown */
  alt: string
  /** kg a piece, where it is sold by weight */
  kgPerPiece: number | null
  added: string
}

const read = (): ExtraProduct[] => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

const write = (xs: ExtraProduct[]) => {
  try { localStorage.setItem(KEY, JSON.stringify(xs)) } catch { /* blocked or full */ }
  /* Other open screens hold their own copy, so they are told. */
  window.dispatchEvent(new CustomEvent('vsa-extra-products'))
}

export const extraProducts = () => read()

/** Adds a product typed on a document, or hands back the one already there. */
export function addExtraProduct(name: string, code = ''): ExtraProduct {
  const trimmed = name.trim()
  const norm = trimmed.toLowerCase()
  const have = read().find(p => p.name.toLowerCase() === norm)
  if (have) return have
  const p: ExtraProduct = {
    id: `X-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    code: code.trim(),
    name: trimmed,
    alt: '',
    kgPerPiece: null,
    added: new Date().toISOString().slice(0, 10),
  }
  write([...read(), p])
  return p
}

export const removeExtraProduct = (id: string) => write(read().filter(p => p.id !== id))

/** Re-renders whatever is showing them when one is added anywhere. */
export function useExtraProducts(): ExtraProduct[] {
  const [xs, setXs] = useState<ExtraProduct[]>(() => read())
  useEffect(() => {
    const sync = () => setXs(read())
    window.addEventListener('vsa-extra-products', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('vsa-extra-products', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return xs
}
