import { useState, useMemo } from 'react'
import { FileText, Trophy, Percent, IndianRupee, Plus, FileCheck2, History } from 'lucide-react'
import {
  PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Pager, usePaged, Empty, Pill, Modal,
} from '@/components/ui'
import { QUOTATIONS, type Quotation } from '@/data/txns'
import { inr, inr2, fmtDate, csvDownload, cn } from '@/lib/utils'
import { COMPANY, FY } from '@/data/company'
import { useCrud } from '@/lib/store'
import { RowActions, EditedDot } from '@/components/crud'
import DocBuilder, { type BuiltDoc, type BuiltLine, amountOf } from '@/components/DocBuilder'
import { MASTER } from '@/data/productmaster'
import { nextDocNo, revisionOf, revisionNumber, baseDocNo, today, validTill } from '@/lib/docnos'

/* ── Quotations and proformas ──────────────────────────────────────────────
   Asked for on 20-11-2026. The old form took a quote number, a date, a
   taxable value and a total, all typed, and had nowhere at all to put the
   material — "where is the material that you can enter?"

   Now the number comes out of the series, the date is the day it was raised,
   validity defaults, and the money is what the lines add up to. Editing a
   quotation does not overwrite it: it issues a revision carrying the same
   number with R1, R2 after it, dated the day it was revised, so the customer
   can see which version they are holding.

   A proforma is the same document under a different series, raised on its
   own or made from a quotation in one click — "either of these should be
   there... then we should have the proforma invoice and the quotation."   */

const SERIES = {
  'Quotation':        { prefix: 'VSA/Q/26-27',  store: 'quotations' },
  'Proforma Invoice': { prefix: 'VSA/PI/26-27', store: 'proformas'  },
} as const
type Kind = keyof typeof SERIES

const idOf = (x: Quotation) => x.no

/** What a built document looks like in the list. */
function asQuotation(d: BuiltDoc, kind: Kind): Quotation {
  return {
    id: `${kind === 'Quotation' ? 'Q' : 'PI'}-${Date.now().toString(36)}`,
    no: d.no, date: d.date, validTill: d.validTill,
    clientId: '', clientName: d.clientName, subject: d.subject,
    lines: d.lines.map(l => ({
      code: l.code, name: l.name, hsn: l.hsn,
      unit: l.basis === 'kg' ? 'kg' : 'nos',
      qty: l.basis === 'kg' ? l.kg : l.nos,
      rate: l.rate, gst: l.gst, amount: amountOf(l), cost: 0,
      productId: l.productId, nos: l.nos,
    })),
    taxable: d.taxable, tax: d.tax, total: d.total,
    status: 'Sent', owner: d.owner,
  }
}

/** A listed document read back into the builder's shape, for a revision. */
const toBuilt = (x: Quotation): Partial<BuiltDoc> => ({
  clientName: x.clientName, subject: x.subject,
  lines: x.lines.map((l, i): BuiltLine => ({
    key: `${l.code}-${i}`,
    /* Lines raised before the master existed carry no product, so they are
       matched back by code and name; failing that the row opens with its
       figures and an empty product box rather than being dropped. */
    productId: l.productId ?? resolveProduct(l.code, l.name),
    code: l.code, name: l.name, hsn: l.hsn,
    basis: l.unit === 'kg' ? 'kg' : 'nos',
    nos: l.nos ?? (l.unit === 'kg' ? 0 : l.qty),
    kg: l.unit === 'kg' ? l.qty : 0,
    rate: l.rate, gst: l.gst,
  })),
})

const resolveProduct = (code: string, name: string) =>
  MASTER.find(p => p.code === code && p.name === name)?.id
  ?? MASTER.find(p => p.code === code)?.id
  ?? ''

export default function Quotations() {
  const [kind, setKind] = useState<Kind>('Quotation')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All Status')
  const [sel, setSel] = useState<Quotation | null>(null)
  const [building, setBuilding] = useState<{ no: string; from: Partial<BuiltDoc> | null } | null>(null)

  /* The two series are kept apart so their numbering cannot collide. */
  const quotes = useCrud<Quotation>('quotations', QUOTATIONS, idOf)
  const pis = useCrud<Quotation>('proformas', [], idOf)
  const crud = kind === 'Quotation' ? quotes : pis
  const list = crud.rows

  const rows = useMemo(() => list.filter(x =>
    (status === 'All Status' || x.status === status) &&
    (q === '' || `${x.no} ${x.clientName} ${x.subject} ${x.owner}`.toLowerCase().includes(q.toLowerCase())),
  ), [list, q, status])

  const paged = usePaged(rows, 10)

  /* ── Counting documents, not versions of them ─────────────────────────
     A revision supersedes the one it revises; it is not a second quotation.
     Added up row by row, one quote revised twice would read as three quotes
     and three times the money. So the figures above count the newest version
     of each number and leave the superseded ones in the list below, which is
     where somebody looking for what was sent last month will want them. */
  const current = useMemo(() => {
    const newest = new Map<string, Quotation>()
    for (const x of list) {
      const base = baseDocNo(x.no)
      const held = newest.get(base)
      if (!held || revisionNumber(x.no) > revisionNumber(held.no)) newest.set(base, x)
    }
    return [...newest.values()]
  }, [list])

  const won = current.filter(x => x.status === 'Won')
  const open = current.filter(x => x.status === 'Sent' || x.status === 'Under Negotiation')
  const winRate = current.length ? Math.round((won.length / current.length) * 100) : 0
  const superseded = list.length - current.length
  const noun = kind === 'Quotation' ? 'quotation' : 'proforma invoice'

  /** Every version of the document this row revises, newest first. */
  const versionsOf = (x: Quotation) =>
    list.filter(y => baseDocNo(y.no) === baseDocNo(x.no))
      .sort((a, b) => revisionNumber(b.no) - revisionNumber(a.no))

  const startNew = () =>
    setBuilding({ no: nextDocNo(SERIES[kind].prefix, list.map(x => x.no)), from: null })

  /* Editing issues a revision rather than quietly changing what was sent. */
  const startRevision = (x: Quotation) =>
    setBuilding({ no: revisionOf(x.no), from: toBuilt(x) })

  /* A quotation becomes a proforma under the proforma series. */
  const makeProforma = (x: Quotation) => {
    const no = nextDocNo(SERIES['Proforma Invoice'].prefix, pis.rows.map(r => r.no))
    pis.add(asQuotation({
      no, date: today(), validTill: validTill(today()),
      clientName: x.clientName, subject: x.subject, owner: x.owner,
      lines: (toBuilt(x).lines ?? []),
      taxable: x.taxable, tax: x.tax, total: x.total,
      /* A quotation carries no place of supply, so the proforma opens on the
         shop's own state and is changed there if the customer is outside it. */
      interState: false,
    }, 'Proforma Invoice'))
    setKind('Proforma Invoice')
  }

  const exportCsv = () => csvDownload(`vsa-${kind === 'Quotation' ? 'quotations' : 'proformas'}.csv`, [
    ['No', 'Date', 'Valid Till', 'Customer', 'Subject', 'Taxable', 'GST', 'Total', 'Status', 'Owner'],
    ...rows.map(x => [x.no, x.date, x.validTill, x.clientName, x.subject, x.taxable, x.tax, x.total, x.status, x.owner]),
  ])

  return (
    <div>
      <PageHead title="Quotations & Proforma"
        sub={`Numbers issue themselves, revisions keep their number · ${FY}`}>
        <ExportBtn onClick={exportCsv} />
        <button className="btn" onClick={startNew}>
          <Plus size={14} /> New {noun}
        </button>
      </PageHead>

      <div className="flex flex-wrap gap-1 mb-5 p-1 rounded-lg w-fit"
        style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
        {(Object.keys(SERIES) as Kind[]).map(k => (
          <button key={k} onClick={() => { setKind(k); setQ(''); setStatus('All Status') }}
            className={cn('px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors',
              kind === k && 'bg-brand text-white')}
            style={kind === k ? undefined : { color: 'var(--text-3)' }}>{k}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label={`${kind}s Issued`} value={String(current.length)} icon={FileText} tone="brand"
          sub={list.length
            ? `next is ${nextDocNo(SERIES[kind].prefix, list.map(x => x.no)).split('/').pop()}`
              + (superseded ? ` · ${superseded} superseded` : '')
            : FY} />
        <Stat label="Value Quoted" value={inr(current.reduce((s, x) => s + x.total, 0))} icon={IndianRupee}
          tone="violet" sub="Latest version of each, inclusive of GST" />
        <Stat label="Converted" value={String(won.length)} icon={Trophy} tone="green"
          sub={inr(won.reduce((s, x) => s + x.total, 0)) + ' won'} />
        <Stat label="Win Rate" value={`${winRate}%`} icon={Percent} tone="sky"
          sub={`${open.length} still open`} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder={`Search ${noun} no, customer, subject…`} />
        <Select value={status} onChange={setStatus}
          options={['All Status', 'Sent', 'Under Negotiation', 'Won', 'Lost', 'Expired']} />
      </div>

      <TableCard>
        <thead>
          <tr><th>No</th><th>Date</th><th>Customer</th><th>Subject</th>
            <th className="num">Lines</th><th className="num">Total</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          {paged.slice.map(x => {
            const rev = revisionNumber(x.no)
            return (
              <tr key={x.id} className="cursor-pointer" onClick={() => setSel(x)}>
                <td className="font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>
                  <EditedDot isNew={crud.isNew(x.no)} isEdited={crud.isEdited(x.no)} />{x.no}
                  {rev > 0 && <span className="badge-yellow ml-1.5 !text-[9px] !px-1 !py-0">rev {rev}</span>}
                </td>
                <td className="whitespace-nowrap text-xs">{fmtDate(x.date)}</td>
                <td className="max-w-[13rem] truncate">{x.clientName}</td>
                <td className="max-w-[14rem] truncate text-xs">{x.subject}</td>
                <td className="num tabular-nums text-xs">{x.lines.length || '—'}</td>
                <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(x.total)}</td>
                <td><Pill s={x.status} /></td>
                <td onClick={e => e.stopPropagation()}>
                  <span className="flex items-center gap-1 justify-end">
                    {kind === 'Quotation' && (
                      <button className="btn-ghost !px-1.5 !py-1" title="Make a proforma invoice from this"
                        onClick={() => makeProforma(x)}><FileCheck2 size={13} /></button>
                    )}
                    <RowActions label={x.no} onEdit={() => startRevision(x)}
                      onDelete={() => crud.remove(x.no)} />
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </TableCard>
      {rows.length === 0 && (
        <Empty msg={list.length
          ? `No ${noun} matches these filters`
          : `No ${noun} raised yet — "New ${noun}" issues ${nextDocNo(SERIES[kind].prefix, [])}`} />
      )}
      <Pager {...paged} />

      <p className="text-[11.5px] mt-4 max-w-4xl" style={{ color: 'var(--text-4)' }}>
        Editing issues a revision rather than changing what was already sent: the number stays and R1, R2
        follows it, dated the day it was revised. The pencil on a row raises that revision; the second icon
        turns a quotation into a proforma invoice under its own series.
      </p>

      <DocBuilder open={!!building} onClose={() => setBuilding(null)} kind={kind}
        docNo={building?.no ?? ''} initial={building?.from} owner="D. Nageswara Rao"
        onSave={d => crud.add(asQuotation(d, kind))} />

      <Modal open={!!sel} onClose={() => setSel(null)}
        title={sel ? `${sel.no} — ${sel.clientName}` : ''} wide>
        {sel && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Pill s={sel.status} />
              <span className="badge-gray">Owner: {sel.owner}</span>
              <span className="badge-gray">Issued {fmtDate(sel.date)}</span>
              <span className="badge-gray">Valid till {fmtDate(sel.validTill)}</span>
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{sel.subject}</p>

            {versionsOf(sel).length > 1 && (
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                <p className="text-[11px] uppercase tracking-wide mb-2 flex items-center gap-1.5"
                  style={{ color: 'var(--text-4)' }}><History size={11} /> Versions of this document</p>
                <div className="space-y-1">
                  {versionsOf(sel).map(v => (
                    <div key={v.no} className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-mono" style={{ color: v.no === sel.no ? 'var(--text-1)' : 'var(--text-3)' }}>
                        {v.no}{v.no === sel.no && ' — this one'}
                      </span>
                      <span className="tabular-nums" style={{ color: 'var(--text-3)' }}>
                        {fmtDate(v.date)} · {inr(v.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sel.lines.length === 0 ? (
              <Empty msg="This one was raised before material lines existed — edit it to add them" />
            ) : (
              <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-2)' }}>
                <table className="tbl">
                  <thead><tr><th>Item</th><th>HSN</th><th className="num">Qty</th>
                    <th className="num">Rate</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {sel.lines.map((l, i) => (
                      <tr key={`${l.code}-${i}`}>
                        <td>{l.name} <span className="text-xs font-mono" style={{ color: 'var(--text-4)' }}>({l.code})</span></td>
                        <td className="text-xs">{l.hsn}</td>
                        <td className="num tabular-nums">{l.qty.toLocaleString('en-IN')} {l.unit}</td>
                        <td className="num tabular-nums">{inr2(l.rate)}</td>
                        <td className="num tabular-nums font-medium" style={{ color: 'var(--text-1)' }}>{inr2(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <table className="text-sm">
                <tbody>
                  <tr><td className="pr-8 py-1" style={{ color: 'var(--text-3)' }}>Taxable</td>
                    <td className="text-right tabular-nums">{inr2(sel.taxable)}</td></tr>
                  <tr><td className="pr-8 py-1" style={{ color: 'var(--text-3)' }}>GST</td>
                    <td className="text-right tabular-nums">{inr2(sel.tax)}</td></tr>
                  <tr className="font-bold" style={{ color: 'var(--text-1)' }}>
                    <td className="pr-8 py-1 border-t" style={{ borderColor: 'var(--border-2)' }}>Grand Total</td>
                    <td className="text-right tabular-nums border-t" style={{ borderColor: 'var(--border-2)' }}>{inr(sel.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-[11px] pt-3" style={{ color: 'var(--text-4)', borderTop: '1px solid var(--border-2)' }}>
              Rates quoted ex-godown, {COMPANY.address.line3}. Aluminium rates are linked to LME and may be
              revised without notice after validity.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
