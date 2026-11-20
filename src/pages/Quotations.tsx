import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Trophy, Percent, IndianRupee, Plus, FileCheck2, History, Printer } from 'lucide-react'
import {
  PageHead, Stat, SearchBox, Select, ExportBtn, TableCard, Pager, usePaged, Empty, Pill, Modal,
} from '@/components/ui'
import { QUOTATIONS, INVOICES, type Quotation, type Invoice } from '@/data/txns'
import { inr, inr2, fmtDate, csvDownload } from '@/lib/utils'
import { COMPANY, FY } from '@/data/company'
import { useCrud } from '@/lib/store'
import { RowActions, EditedDot } from '@/components/crud'
import DocBuilder, { type BuiltDoc, type BuiltLine } from '@/components/DocBuilder'
import QuoteDoc from '@/components/QuoteDoc'
import InvoiceDoc from '@/components/InvoiceDoc'
import {
  asQuotation, asInvoice, rowOfQuotation, rowOfInvoice, builtFrom,
  STATUS_OPTIONS, type DocRow,
} from '@/lib/docshapes'
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

/* Four documents, four series, asked for on 20-11: "give / create proforma
   invoice option, estimate, tax invoice" — beside the quotation that was
   already here. An estimate is the rough one, a quotation the formal one, a
   proforma the one raised before despatch, and the tax invoice the one that
   carries credit. They are the same document under four headings, so they
   share one form and keep four numbering series that cannot collide. */
const SERIES = {
  'Quotation':        { prefix: 'VSA/Q/26-27',   store: 'quotations' },
  'Estimate':         { prefix: 'VSA/EST/26-27', store: 'estimates'  },
  'Proforma Invoice': { prefix: 'VSA/PI/26-27',  store: 'proformas'  },
  'Tax Invoice':      { prefix: 'VSA/INV/26-27', store: 'invoices'   },
} as const
type Kind = keyof typeof SERIES

/** Where each document lives, so carrying one forward moves the screen too. */
export const ROUTE_OF: Record<Kind, string> = {
  'Quotation': '/quotation',
  'Estimate': '/estimate',
  'Proforma Invoice': '/proforma-invoice',
  'Tax Invoice': '/tax-invoice',
}

const idOf = (x: { no: string }) => x.no

/* A tax invoice is a different record from an offer — it splits its tax three
   ways and carries what has been received — so the two are built in one place
   and read back into one display row. See src/lib/docshapes.ts. */
const resolveProduct = (code: string, name: string) =>
  MASTER.find(p => p.code === code && p.name === name)?.id
  ?? MASTER.find(p => p.code === code)?.id
  ?? ''

const toBuilt = (r: DocRow): Partial<BuiltDoc> => ({
  ...builtFrom(r),
  lines: r.lines.map((l, i): BuiltLine => ({
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

/* ── One screen, four doors ────────────────────────────────────────────────
   They asked for quotation, proforma invoice and tax invoice "one below the
   other", and for the estimate to come out of the row of tabs and sit
   outside with them. So each has its own line in the menu and its own
   address, and the tab strip is gone. It is still one screen underneath,
   because the four are the same document under four headings — but nobody
   has to know that to find the one they want.                            */
export default function Quotations({ kind: fixedKind }: { kind?: Kind } = {}) {
  const [tabKind, setTabKind] = useState<Kind>('Quotation')
  const kind = fixedKind ?? tabKind
  const setKind = (k: Kind) => { if (!fixedKind) setTabKind(k); else nav(ROUTE_OF[k]) }
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All Status')
  const [sel, setSel] = useState<DocRow | null>(null)
  const [building, setBuilding] = useState<{ no: string; from: Partial<BuiltDoc> | null } | null>(null)
  const [printing, setPrinting] = useState<DocRow | null>(null)

  /* The series are kept apart so their numbering cannot collide. Tax invoices
     share the billing screen's own store, so a bill raised here is the same
     bill there rather than a second copy of it. */
  const quotes = useCrud<Quotation>('quotations', QUOTATIONS, idOf)
  const ests = useCrud<Quotation>('estimates', [], idOf)
  const pis = useCrud<Quotation>('proformas', [], idOf)
  /* Typed as the bill it really is, and sharing the billing screen's store,
     so a bill raised here is the same bill there — not a quotation-shaped row
     that reads as NaN the moment the billing screen adds up its tax. */
  const invs = useCrud<Invoice>('invoices', INVOICES, idOf)

  const isInvoiceKind = kind === 'Tax Invoice'
  const crud = kind === 'Quotation' ? quotes : kind === 'Estimate' ? ests : pis

  const list: DocRow[] = useMemo(
    () => isInvoiceKind ? invs.rows.map(rowOfInvoice) : crud.rows.map(rowOfQuotation),
    [isInvoiceKind, invs.rows, crud.rows],
  )

  /* Everyone already billed or quoted, across all four, so a name is picked
     rather than retyped — theirs: "customer name from data selection". */
  const parties = useMemo(() => [...new Set(
    [...quotes.rows, ...ests.rows, ...pis.rows, ...invs.rows].map(x => x.clientName).filter(Boolean),
  )], [quotes.rows, ests.rows, pis.rows, invs.rows])

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
    const newest = new Map<string, DocRow>()
    for (const x of list) {
      const base = baseDocNo(x.no)
      const held = newest.get(base)
      if (!held || revisionNumber(x.no) > revisionNumber(held.no)) newest.set(base, x)
    }
    return [...newest.values()]
  }, [list])

  /* A bill is won when it is paid; an offer when it is accepted. */
  const won = current.filter(x => isInvoiceKind ? x.status === 'Paid' : x.status === 'Won')
  const open = current.filter(x => isInvoiceKind
    ? x.status !== 'Paid'
    : x.status === 'Sent' || x.status === 'Under Negotiation')
  const winRate = current.length ? Math.round((won.length / current.length) * 100) : 0
  const superseded = list.length - current.length
  const noun = kind.toLowerCase()

  /** Every version of the document this row revises, newest first. */
  const versionsOf = (x: DocRow) =>
    list.filter(y => baseDocNo(y.no) === baseDocNo(x.no))
      .sort((a, b) => revisionNumber(b.no) - revisionNumber(a.no))

  const startNew = () =>
    setBuilding({ no: nextDocNo(SERIES[kind].prefix, list.map(x => x.no)), from: null })

  /* Editing issues a revision rather than quietly changing what was sent. */
  const startRevision = (x: DocRow) =>
    setBuilding({ no: revisionOf(x.no), from: toBuilt(x) })

  /* Carrying a document forward: estimate → quotation → proforma → invoice,
     which is the order the trade works in. Nothing is retyped. */
  const NEXT_STEP: Partial<Record<Kind, Kind>> = {
    'Estimate': 'Quotation',
    'Quotation': 'Proforma Invoice',
    'Proforma Invoice': 'Tax Invoice',
  }

  const carryForward = (x: DocRow) => {
    const to = NEXT_STEP[kind]
    if (!to) return
    const existing = to === 'Tax Invoice' ? invs.rows.map(r => r.no)
      : (to === 'Quotation' ? quotes : to === 'Estimate' ? ests : pis).rows.map(r => r.no)
    const built: BuiltDoc = {
      no: nextDocNo(SERIES[to].prefix, existing),
      date: today(), validTill: validTill(today()),
      clientName: x.clientName, subject: x.subject, owner: x.owner,
      lines: (toBuilt(x).lines ?? []),
      taxable: x.taxable, tax: x.tax, total: x.total,
      /* No place of supply travels with an offer, so it opens on the shop's
         own state and is changed if the customer is outside it. */
      interState: false,
      /* Carried forward already priced, so the next document keeps the
         figures rather than re-deriving them from a rate it does not have. */
      aluminium: { on: false, rate: 0 }, coatingMode: 'section' as const,
    }
    if (to === 'Tax Invoice') invs.add(asInvoice(built))
    else (to === 'Quotation' ? quotes : to === 'Estimate' ? ests : pis).add(asQuotation(built, to))
    setKind(to)
  }

  const exportCsv = () => csvDownload(`vsa-${SERIES[kind].store}.csv`, [
    ['No', 'Date', isInvoiceKind ? 'Due On' : 'Valid Till', 'Customer', 'Subject',
     'Taxable', 'GST', 'Total', 'Status', 'Owner'],
    ...rows.map(x => [x.no, x.date, x.until, x.clientName, x.subject,
      x.taxable, x.tax, x.total, x.status, x.owner]),
  ])

  return (
    <div>
      <PageHead title={`${kind}s`}
        sub={`Numbers issue themselves, revisions keep their number · ${FY}`}>
        <ExportBtn onClick={exportCsv} />
        <button className="btn" onClick={startNew}>
          <Plus size={14} /> New {noun}
        </button>
      </PageHead>

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
          options={['All Status', ...STATUS_OPTIONS[isInvoiceKind ? 'invoice' : 'offer']]} />
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
                    <button className="btn-ghost !px-1.5 !py-1" title={`Print or save this ${noun} as a PDF`}
                      onClick={() => setPrinting(x)}><Printer size={13} /></button>
                    {NEXT_STEP[kind] && (
                      <button className="btn-ghost !px-1.5 !py-1"
                        title={`Carry this forward into a ${NEXT_STEP[kind]!.toLowerCase()}`}
                        onClick={() => carryForward(x)}><FileCheck2 size={13} /></button>
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

      {/* A bill prints on the GST invoice; an offer prints on its own
          document, which says on its face that it is not a tax invoice. */}
      {printing && isInvoiceKind && (() => {
        const inv = invs.rows.find(i => i.no === printing.no)
        return inv ? <InvoiceDoc inv={inv} onClose={() => setPrinting(null)} /> : null
      })()}
      {printing && !isInvoiceKind && (
        <QuoteDoc
          doc={{
            id: printing.id, no: printing.no, date: printing.date,
            validTill: printing.until, clientId: '', clientName: printing.clientName,
            subject: printing.subject, lines: printing.lines,
            taxable: printing.taxable, tax: printing.tax, total: printing.total,
            status: printing.status as Quotation['status'], owner: printing.owner,
          }}
          kind={kind} onClose={() => setPrinting(null)} />
      )}

      <DocBuilder open={!!building} onClose={() => setBuilding(null)} kind={kind}
        docNo={building?.no ?? ''} initial={building?.from} parties={parties}
        owner="D. Nageswara Rao"
        onSave={d => isInvoiceKind ? invs.add(asInvoice(d)) : crud.add(asQuotation(d, kind))} />

      <Modal open={!!sel} onClose={() => setSel(null)}
        title={sel ? `${sel.no} — ${sel.clientName}` : ''} wide>
        {sel && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Pill s={sel.status} />
              <span className="badge-gray">Owner: {sel.owner}</span>
              <span className="badge-gray">Issued {fmtDate(sel.date)}</span>
              <span className="badge-gray">
                {isInvoiceKind ? 'Due on' : 'Valid till'} {fmtDate(sel.until)}
              </span>
              {sel.balance !== null && sel.balance > 0 && (
                <span className="badge-red">{inr(sel.balance)} still to come in</span>
              )}
              <button className="btn-outline !py-1 !text-xs ml-auto"
                onClick={() => { setPrinting(sel); setSel(null) }}>
                <Printer size={13} /> Print / Save PDF
              </button>
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
