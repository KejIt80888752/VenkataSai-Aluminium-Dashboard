/* ── A window drawn from the size that was typed ───────────────────────────
   A quotation for windows is read by a customer who cannot picture "3 track
   sliding, 1800 x 1200". A drawing to the right proportions, with the sizes
   marked on it, settles what is being quoted before anyone argues about it
   on site. It is drawn rather than photographed so it always matches the
   figures on the same line.                                               */

export type WindowType =
  | '2 Track Sliding' | '3 Track Sliding' | 'Openable Casement'
  | 'Fixed + Openable' | 'Louver Ventilator' | 'Partition'

export const WINDOW_TYPES: WindowType[] = [
  '2 Track Sliding', '3 Track Sliding', 'Openable Casement',
  'Fixed + Openable', 'Louver Ventilator', 'Partition',
]

interface Props {
  type: WindowType
  widthMm: number
  heightMm: number
  mesh?: boolean
  /** RAL or shade name, used only for the frame fill */
  shade?: string
  height?: number
}

const SHADE_FILL: Record<string, string> = {
  'Ivory': '#E6DFC8', 'White': '#EDEFF1', 'Black': '#3A3F45',
  'Brown': '#5C4433', 'Champagne': '#C7B18B', 'Mill Finish': '#C2C8CE',
}

export default function WindowDrawing({ type, widthMm, heightMm, mesh, shade = 'Ivory', height = 200 }: Props) {
  const w = Math.max(300, widthMm || 1200)
  const h = Math.max(300, heightMm || 1200)

  // Fit the opening inside the box, leaving room for the dimension lines.
  const pad = 26
  const boxW = 300, boxH = height
  const scale = Math.min((boxW - pad * 2) / w, (boxH - pad * 2) / h)
  const dw = w * scale, dh = h * scale
  const x0 = (boxW - dw) / 2, y0 = (boxH - dh) / 2 - 4

  const frame = SHADE_FILL[shade] ?? SHADE_FILL['Ivory']
  const F = 5                                   // drawn frame thickness
  const glass = 'var(--drw-glass)'
  const ink = 'var(--drw-ink)'

  const panels = type === '3 Track Sliding' ? 3
    : type === '2 Track Sliding' ? 2
    : type === 'Fixed + Openable' ? 2
    : type === 'Partition' ? 3 : 1

  const pw = (dw - F * 2) / panels

  return (
    <svg viewBox={`0 0 ${boxW} ${boxH}`} width="100%" height={height} role="img"
      aria-label={`${type}, ${widthMm} by ${heightMm} millimetres`}
      style={{
        // Tokens local to the drawing so it reads in both themes.
        ['--drw-glass' as string]: 'color-mix(in srgb, #6FB4D6 26%, transparent)',
        ['--drw-ink' as string]: 'var(--text-3)',
      }}>

      {/* opening */}
      <rect x={x0} y={y0} width={dw} height={dh} fill={frame} stroke={ink} strokeWidth="1" />
      <rect x={x0 + F} y={y0 + F} width={dw - F * 2} height={dh - F * 2} fill={glass} stroke={ink} strokeWidth=".6" />

      {/* panel divisions */}
      {Array.from({ length: panels - 1 }, (_, i) => (
        <rect key={i} x={x0 + F + pw * (i + 1) - 1.5} y={y0 + F} width="3" height={dh - F * 2}
          fill={frame} stroke={ink} strokeWidth=".5" />
      ))}

      {/* the mesh panel sits on the last track */}
      {mesh && panels > 1 && (
        <g>
          <rect x={x0 + F + pw * (panels - 1)} y={y0 + F} width={pw} height={dh - F * 2}
            fill="var(--drw-glass)" opacity=".45" />
          {Array.from({ length: 7 }, (_, i) => (
            <line key={`mv${i}`} x1={x0 + F + pw * (panels - 1) + (pw / 7) * i} y1={y0 + F}
              x2={x0 + F + pw * (panels - 1) + (pw / 7) * i} y2={y0 + dh - F} stroke={ink} strokeWidth=".35" opacity=".7" />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`mh${i}`} x1={x0 + F + pw * (panels - 1)} y1={y0 + F + ((dh - F * 2) / 9) * i}
              x2={x0 + F + pw * panels} y2={y0 + F + ((dh - F * 2) / 9) * i} stroke={ink} strokeWidth=".35" opacity=".7" />
          ))}
        </g>
      )}

      {/* sliding arrows */}
      {(type === '2 Track Sliding' || type === '3 Track Sliding') && (
        <g stroke={ink} strokeWidth=".9" fill="none">
          <line x1={x0 + F + pw * 0.25} y1={y0 + dh / 2} x2={x0 + F + pw * 0.75} y2={y0 + dh / 2} />
          <polyline points={`${x0 + F + pw * 0.66},${y0 + dh / 2 - 3} ${x0 + F + pw * 0.75},${y0 + dh / 2} ${x0 + F + pw * 0.66},${y0 + dh / 2 + 3}`} />
        </g>
      )}

      {/* casement opening arc */}
      {(type === 'Openable Casement' || type === 'Fixed + Openable') && (
        <g stroke={ink} strokeWidth=".8" fill="none" strokeDasharray="3 2">
          <polyline points={`${x0 + dw - F},${y0 + F} ${x0 + dw - F - pw * 0.9},${y0 + dh / 2} ${x0 + dw - F},${y0 + dh - F}`} />
        </g>
      )}

      {/* louver blades */}
      {type === 'Louver Ventilator' && (
        <g stroke={ink} strokeWidth="1" fill={frame}>
          {Array.from({ length: Math.max(4, Math.round(dh / 12)) }, (_, i) => {
            const bh = (dh - F * 2) / Math.max(4, Math.round(dh / 12))
            return <rect key={i} x={x0 + F} y={y0 + F + bh * i + 1} width={dw - F * 2} height={bh - 2} opacity=".9" />
          })}
        </g>
      )}

      {/* partition mid rail */}
      {type === 'Partition' && (
        <rect x={x0 + F} y={y0 + dh * 0.55} width={dw - F * 2} height="3" fill={frame} stroke={ink} strokeWidth=".5" />
      )}

      {/* ── dimensions ───────────────────────────────────────────── */}
      <g stroke={ink} strokeWidth=".7" fill="none">
        <line x1={x0} y1={y0 + dh + 11} x2={x0 + dw} y2={y0 + dh + 11} />
        <line x1={x0} y1={y0 + dh + 8} x2={x0} y2={y0 + dh + 14} />
        <line x1={x0 + dw} y1={y0 + dh + 8} x2={x0 + dw} y2={y0 + dh + 14} />
        <line x1={x0 + dw + 11} y1={y0} x2={x0 + dw + 11} y2={y0 + dh} />
        <line x1={x0 + dw + 8} y1={y0} x2={x0 + dw + 14} y2={y0} />
        <line x1={x0 + dw + 8} y1={y0 + dh} x2={x0 + dw + 14} y2={y0 + dh} />
      </g>
      <text x={x0 + dw / 2} y={y0 + dh + 22} textAnchor="middle" fontSize="9"
        fill={ink} fontFamily="ui-monospace, monospace">{widthMm} mm</text>
      <text x={x0 + dw + 16} y={y0 + dh / 2} textAnchor="middle" fontSize="9" fill={ink}
        fontFamily="ui-monospace, monospace" transform={`rotate(90 ${x0 + dw + 16} ${y0 + dh / 2})`}>{heightMm} mm</text>
    </svg>
  )
}
