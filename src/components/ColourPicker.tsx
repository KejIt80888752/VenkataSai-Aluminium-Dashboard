import { useColours, addColour, UNCOATED, swatchOf } from '@/data/colours'
import { Select } from '@/components/ui'

/* ── Picking the colour a line is in ───────────────────────────────────────
   Theirs, on 21-11: "colour must be part of the item/section... inventory is
   managed by colour", and "once a colour is selected for the first item,
   carry it forward to the next items. Allow it to be changed."

   So it is a column on every line and not a setting at the top. Carrying
   forward is done by whoever adds the line; this only has to let the colour
   be seen and changed, and let one that is not on the list be typed.

   W/O is on the list on purpose. It is not a colour — it is the mill finish
   a purchase DC arrives in, before anything has been coated.              */

const NEW = '+ Another colour'

export function ColourPicker({ value, onChange, className, allowRaw = true }: {
  value: string
  onChange: (code: string) => void
  className?: string
  /** false on a sales document, where nothing goes out uncoated unasked */
  allowRaw?: boolean
}) {
  const colours = useColours()
  const list = allowRaw ? colours : colours.filter(c => !c.raw)
  const current = colours.find(c => c.code === value)

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{
          background: swatchOf(value),
          border: '1px solid var(--border-2)',
          /* The mill finish gets no fill, because it is the absence of one. */
          opacity: value === UNCOATED ? .5 : 1,
        }} />
      <Select
        value={current?.name ?? ''}
        onChange={v => {
          if (v !== NEW) {
            onChange(list.find(c => c.name === v)?.code ?? UNCOATED)
            return
          }
          const typed = window.prompt('What colour? It joins the list from now on.')?.trim()
          if (typed) onChange(addColour(typed).code)
        }}
        options={[...list.map(c => c.name), NEW]}
        className={className ?? '!w-32 !py-1 !text-[11px] !min-w-0'} />
    </span>
  )
}
