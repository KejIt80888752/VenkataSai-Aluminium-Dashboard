/* ── Getting the most out of a 12-foot bar ─────────────────────────────────
   A window schedule asks for lengths that never divide neatly into stock
   bars. Cutting them in the order they were written wastes the end of every
   bar. Taking the longest piece first and dropping each next piece into the
   first bar that still has room gets close to the best answer, and does it
   fast enough to redo as the schedule changes.

   The saw itself eats material, so the blade width comes off every cut.    */

export interface Need { lengthFt: number; qty: number; label?: string }

export interface Bar {
  index: number
  stockFt: number
  cuts: { lengthFt: number; label?: string }[]
  usedFt: number
  offcutFt: number
}

export interface Plan {
  bars: Bar[]
  barsNeeded: number
  stockFt: number
  neededFt: number
  offcutFt: number
  kerfFt: number
  wastePct: number
  /** offcuts long enough to keep rather than scrap */
  reusable: number
  unfitted: { lengthFt: number; qty: number }[]
}

export function optimise(
  needs: Need[],
  stockFt: number,
  kerfMm = 3,
  keepAboveFt = 1.5,
): Plan {
  const kerf = kerfMm / 304.8

  // Longest first — a long piece has the fewest places it can go.
  const pieces = needs
    .flatMap(n => Array.from({ length: Math.max(0, Math.floor(n.qty)) }, () => ({ lengthFt: n.lengthFt, label: n.label })))
    .filter(p => p.lengthFt > 0)
    .sort((a, b) => b.lengthFt - a.lengthFt)

  const unfitted: { lengthFt: number; qty: number }[] = []
  const bars: Bar[] = []

  for (const p of pieces) {
    if (p.lengthFt > stockFt) {
      const hit = unfitted.find(u => u.lengthFt === p.lengthFt)
      if (hit) hit.qty++; else unfitted.push({ lengthFt: p.lengthFt, qty: 1 })
      continue
    }
    // First bar with room, counting the blade for every cut after the first.
    const bar = bars.find(b => b.usedFt + p.lengthFt + (b.cuts.length ? kerf : 0) <= stockFt + 1e-9)
    if (bar) {
      bar.usedFt = +(bar.usedFt + p.lengthFt + kerf).toFixed(4)
      bar.cuts.push({ lengthFt: p.lengthFt, label: p.label })
    } else {
      bars.push({ index: bars.length + 1, stockFt, cuts: [{ lengthFt: p.lengthFt, label: p.label }],
                  usedFt: p.lengthFt, offcutFt: 0 })
    }
  }

  for (const b of bars) b.offcutFt = +(b.stockFt - b.usedFt).toFixed(3)

  const neededFt = +pieces.reduce((s, p) => s + p.lengthFt, 0).toFixed(2)
  const totalStock = +(bars.length * stockFt).toFixed(2)
  const offcut = +bars.reduce((s, b) => s + b.offcutFt, 0).toFixed(2)
  const kerfTotal = +bars.reduce((s, b) => s + Math.max(0, b.cuts.length - 1) * kerf, 0).toFixed(3)

  return {
    bars, barsNeeded: bars.length, stockFt: totalStock, neededFt,
    offcutFt: offcut, kerfFt: kerfTotal,
    wastePct: totalStock > 0 ? +((offcut / totalStock) * 100).toFixed(1) : 0,
    reusable: bars.filter(b => b.offcutFt >= keepAboveFt).length,
    unfitted,
  }
}
