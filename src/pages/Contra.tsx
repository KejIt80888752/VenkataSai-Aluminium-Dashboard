import { useState, useMemo } from 'react'
import { ArrowLeftRight, Split, Landmark, IndianRupee, CircleAlert, Plus, Check } from 'lucide-react'
import { PageHead, Stat, Select, ExportBtn, TableCard, Empty, Modal } from '@/components/ui'
import { INVOICES, PURCHASES } from '@/data/txns'
import { CLIENTS, SUPPLIERS } from '@/data/parties'
import { inr, fmtDate, csvDownload, cn } from '@/lib/utils'
import { COMPANY, TODAY, FY } from '@/data/company'

/* ── Two entries the counter cannot make on a normal screen ────────────────
   A contra moves money between our own accounts — nothing is earned or
   spent, so it must never touch profit.

   A diverted payment is the one worth building properly: the customer pays
   our supplier directly. One receipt is entered on the sale bill, and it has
   to do two things at once — credit the customer against our invoice, and
   reduce what we owe that supplier by the same amount. Entered twice by
   hand, it goes wrong; entered once here, it cannot.                      */

const ACCOUNTS = [
  { id: 'KOTAK-CA', label: `${COMPANY.bank.bank} — current`, kind: 'Bank' },
  { id: 'HDFC-OD',  label: 'HDFC — overdraft', kind: 'Bank' },
  { id: 'CASH',     label: 'Cash at counter', kind: 'Cash' },
  { id: 'PETTY',    label: 'Petty cash', kind: 'Cash' },
] as const

interface Contra { id: string; date: string; from: string; to: string; amount: number; note: string }
interface Diverted {
  id: string; date: string
  clientId: string; client: string; invoiceNo: string; invoiceValue: number
  supplierId: string; supplier: string; billNo: string; billValue: number
  amount: number; ref: string; note: string
}

const seedContras: Contra[] = [
  { id: 'CN1', date: '2026-08-18', from: 'KOTAK-CA', to: 'CASH', amount: 150000, note: 'Counter float for the week' },
  { id: 'CN2', date: '2026-08-12', from: 'HDFC-OD', to: 'KOTAK-CA', amount: 800000, note: 'Cover the Jindal payment' },
  { id: 'CN3', date: '2026-08-04', from: 'CASH', to: 'KOTAK-CA', amount: 265000, note: 'Counter collection deposited' },
]

const seedDiverted: Diverted[] = [0, 1, 2].map(i => {
  const inv = INVOICES[i * 3]
  const pur = PURCHASES[i * 2]
  const client = CLIENTS.find(c => c.id === inv.clientId)!
  const sup = SUPPLIERS.find(s => s.id === pur.supplierId) ?? SUPPLIERS[0]
  const amount = Math.min(inv.total - inv.received || inv.total, pur.total - pur.paid || pur.total)
  return {
    id: `DV${i + 1}`, date: inv.dueDate > TODAY ? inv.date : inv.dueDate,
    clientId: client.id, client: client.name, invoiceNo: inv.no, invoiceValue: inv.total,
    supplierId: sup.id, supplier: sup.name, billNo: pur.no, billValue: pur.total,
    amount: Math.max(25000, Math.round(amount * 0.6)),
    ref: `NEFT/${48310000 + i * 991}`,
    note: 'Customer paid the mill directly against our purchase',
  }
})

export default function Contra() {
  const [tab, setTab] = useState<'Diverted' | 'Contra'>('Diverted')
  const [contras, setContras] = useState(seedContras)
  const [diverted, setDiverted] = useState(seedDiverted)
  const [adding, setAdding] = useState(false)

  const label = (id: string) => ACCOUNTS.find(a => a.id === id)?.label ?? id

  const totals = useMemo(() => ({
    contra: contras.reduce((s, c) => s + c.amount, 0),
    diverted: diverted.reduce((s, d) => s + d.amount, 0),
    customersCleared: new Set(diverted.map(d => d.clientId)).size,
    suppliersReduced: new Set(diverted.map(d => d.supplierId)).size,
  }), [contras, diverted])

  const exportCsv = () => csvDownload('vsa-contra-and-diverted.csv', [
    ['Contra transfers and diverted payments', FY],
    [], ['Contra transfers'], ['Date', 'From', 'To', 'Amount', 'Note'],
    ...contras.map(c => [c.date, label(c.from), label(c.to), c.amount, c.note]),
    [], ['Diverted payments'],
    ['Date', 'Customer', 'Our Invoice', 'Supplier', 'Their Bill', 'Amount', 'Reference', 'Note'],
    ...diverted.map(d => [d.date, d.client, d.invoiceNo, d.supplier, d.billNo, d.amount, d.ref, d.note]),
  ])

  return (
    <div>
      <PageHead title="Contra & Diverted Payments"
        sub="Money moved between our own accounts, and money that went straight from a customer to a supplier">
        <ExportBtn onClick={exportCsv} />
        <button className="btn" onClick={() => setAdding(true)}>
          <Plus size={14} /> {tab === 'Diverted' ? 'Record a diverted payment' : 'Record a transfer'}
        </button>
      </PageHead>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat label="Diverted This Year" value={inr(totals.diverted)} icon={Split} tone="brand"
          sub={`${diverted.length} payments`} />
        <Stat label="Customers Credited" value={String(totals.customersCleared)} icon={IndianRupee} tone="green"
          sub="Against our own invoices" />
        <Stat label="Suppliers Reduced" value={String(totals.suppliersReduced)} icon={CircleAlert} tone="violet"
          sub="By the same amount, same entry" />
        <Stat label="Moved Between Our Accounts" value={inr(totals.contra)} icon={ArrowLeftRight} tone="sky"
          sub={`${contras.length} transfers · no effect on profit`} />
      </div>

      <div className="flex gap-1 mb-5 p-1 rounded-lg w-fit"
        style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
        {(['Diverted', 'Contra'] as const).map(x => (
          <button key={x} onClick={() => setTab(x)}
            className={cn('px-4 py-1.5 rounded-md text-xs font-medium transition-colors', tab === x && 'bg-brand text-white')}
            style={tab === x ? undefined : { color: 'var(--text-3)' }}>
            {x === 'Diverted' ? 'Diverted payments' : 'Contra transfers'}
          </button>
        ))}
      </div>

      {tab === 'Diverted' ? (
        <>
          <div className="card mb-5">
            <p className="section-title text-base mb-1">One Entry, Both Sides</p>
            <p className="section-sub mb-4 max-w-4xl">
              The customer pays our supplier directly. It is entered once, on the sale bill, and lands on both
              books at the same moment — so the two can never drift apart.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Step n="1" t="Customer pays the supplier"
                d="The money never touches our account. The customer sends it to the mill against our purchase bill, and gives us the reference." />
              <Step n="2" t="One receipt on our sale bill"
                d="Entered here, against the invoice it settles. Nothing is typed on the purchase side at all." />
              <Step n="3" t="The supplier's balance falls with it"
                d="The same amount comes off what we owe that supplier, in the same entry. Two effects, one keystroke." />
            </div>
          </div>

          <TableCard maxH="28rem">
            <thead>
              <tr><th>Date</th><th>Customer</th><th>Our Invoice</th><th>Supplier</th><th>Their Bill</th>
                <th className="num">Amount</th><th>Reference</th></tr>
            </thead>
            <tbody>
              {diverted.map(d => (
                <tr key={d.id}>
                  <td className="text-xs whitespace-nowrap">{fmtDate(d.date)}</td>
                  <td className="text-xs max-w-[14rem] truncate" title={d.client}>{d.client}</td>
                  <td className="text-xs whitespace-nowrap font-medium" style={{ color: 'var(--green)' }}>
                    {d.invoiceNo}
                    <span className="block text-[10px] font-normal" style={{ color: 'var(--text-4)' }}>credited</span>
                  </td>
                  <td className="text-xs max-w-[14rem] truncate" title={d.supplier}>{d.supplier}</td>
                  <td className="text-xs whitespace-nowrap font-medium" style={{ color: 'var(--red)' }}>
                    {d.billNo}
                    <span className="block text-[10px] font-normal" style={{ color: 'var(--text-4)' }}>reduced</span>
                  </td>
                  <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(d.amount)}</td>
                  <td className="text-xs font-mono whitespace-nowrap">{d.ref}</td>
                </tr>
              ))}
              {diverted.length === 0 && <tr><td colSpan={7}><Empty msg="Nothing diverted yet" /></td></tr>}
            </tbody>
          </TableCard>
        </>
      ) : (
        <>
          <div className="card mb-5">
            <p className="section-title text-base mb-1">Between Our Own Accounts</p>
            <p className="section-sub max-w-4xl">
              A transfer from the bank to the counter, or a day's cash into the bank. Nothing is earned or
              spent, so these never reach profit and loss — they only move a balance from one account to
              another.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {ACCOUNTS.map(a => {
              const inAmt = contras.filter(c => c.to === a.id).reduce((s, c) => s + c.amount, 0)
              const outAmt = contras.filter(c => c.from === a.id).reduce((s, c) => s + c.amount, 0)
              return (
                <div key={a.id} className="rounded-lg p-3.5"
                  style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
                  <p className="text-[10px] uppercase tracking-wide flex items-center gap-1"
                    style={{ color: 'var(--text-4)' }}>
                    <Landmark size={10} /> {a.kind}
                  </p>
                  <p className="text-sm font-medium mt-0.5 truncate" style={{ color: 'var(--text-1)' }}>{a.label}</p>
                  <p className="text-xs tabular-nums mt-1.5">
                    <span style={{ color: 'var(--green)' }}>+{inr(inAmt)}</span>
                    <span className="mx-1.5" style={{ color: 'var(--text-4)' }}>·</span>
                    <span style={{ color: 'var(--red)' }}>−{inr(outAmt)}</span>
                  </p>
                </div>
              )
            })}
          </div>

          <TableCard maxH="24rem">
            <thead><tr><th>Date</th><th>From</th><th>To</th><th className="num">Amount</th><th>Note</th></tr></thead>
            <tbody>
              {contras.map(c => (
                <tr key={c.id}>
                  <td className="text-xs whitespace-nowrap">{fmtDate(c.date)}</td>
                  <td className="text-xs" style={{ color: 'var(--red)' }}>{label(c.from)}</td>
                  <td className="text-xs" style={{ color: 'var(--green)' }}>{label(c.to)}</td>
                  <td className="num tabular-nums font-semibold" style={{ color: 'var(--text-1)' }}>{inr(c.amount)}</td>
                  <td className="text-xs" style={{ color: 'var(--text-3)' }}>{c.note}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        </>
      )}

      <AddModal open={adding} kind={tab} onClose={() => setAdding(false)}
        onContra={c => setContras(v => [c, ...v])}
        onDiverted={d => setDiverted(v => [d, ...v])} />
    </div>
  )
}

function AddModal({ open, kind, onClose, onContra, onDiverted }: {
  open: boolean; kind: 'Diverted' | 'Contra'; onClose: () => void
  onContra: (c: Contra) => void; onDiverted: (d: Diverted) => void
}) {
  const [from, setFrom] = useState(ACCOUNTS[0].id as string)
  const [to, setTo] = useState(ACCOUNTS[2].id as string)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [client, setClient] = useState(CLIENTS[0].name)
  const [supplier, setSupplier] = useState(SUPPLIERS[0].name)
  const [invoiceNo, setInvoiceNo] = useState(INVOICES[0]?.no ?? '')
  const [billNo, setBillNo] = useState(PURCHASES[0]?.no ?? '')

  const amt = Number(amount) || 0
  const clientInvoices = INVOICES.filter(i => i.clientName === client).slice(0, 30)
  const supplierBills = PURCHASES.filter(p => p.supplier === supplier).slice(0, 30)

  return (
    <Modal open={open} onClose={onClose}
      title={kind === 'Diverted' ? 'Record a diverted payment' : 'Move money between our accounts'} wide>
      <div className="space-y-4">
        {kind === 'Contra' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="label">Out of</label>
                <Select value={from} onChange={setFrom} options={ACCOUNTS.map(a => a.id)} className="!w-full" /></div>
              <div><label className="label">Into</label>
                <Select value={to} onChange={setTo} options={ACCOUNTS.map(a => a.id)} className="!w-full" /></div>
            </div>
            {from === to && (
              <p className="text-[11px]" style={{ color: 'var(--red)' }}>Pick two different accounts.</p>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="label">Customer who paid</label>
                <Select value={client} onChange={v => { setClient(v); const f = INVOICES.find(i => i.clientName === v); if (f) setInvoiceNo(f.no) }}
                  options={CLIENTS.map(c => c.name)} className="!w-full" /></div>
              <div><label className="label">Against our invoice</label>
                <Select value={invoiceNo} onChange={setInvoiceNo}
                  options={clientInvoices.length ? clientInvoices.map(i => i.no) : ['—']} className="!w-full" /></div>
              <div><label className="label">Supplier they paid</label>
                <Select value={supplier} onChange={v => { setSupplier(v); const f = PURCHASES.find(p => p.supplier === v); if (f) setBillNo(f.no) }}
                  options={SUPPLIERS.map(s => s.name)} className="!w-full" /></div>
              <div><label className="label">Against their bill</label>
                <Select value={billNo} onChange={setBillNo}
                  options={supplierBills.length ? supplierBills.map(p => p.no) : ['—']} className="!w-full" /></div>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="label">Amount</label>
            <input className="input w-full text-right tabular-nums" value={amount}
              onChange={e => setAmount(e.target.value)} /></div>
          <div><label className="label">Note</label>
            <input className="input w-full" value={note} onChange={e => setNote(e.target.value)}
              placeholder={kind === 'Diverted' ? 'UTR or reference the customer gave' : 'Why the money moved'} /></div>
        </div>

        {kind === 'Diverted' && amt > 0 && (
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
            <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-4)' }}>
              What this one entry will do
            </p>
            <p className="text-xs" style={{ color: 'var(--green)' }}>
              {client} credited {inr(amt)} against {invoiceNo}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--red)' }}>
              {supplier} — what we owe falls {inr(amt)} against {billNo}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--border-2)' }}>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={amt <= 0 || (kind === 'Contra' && from === to)}
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10)
              if (kind === 'Contra') {
                onContra({ id: `CN${Date.now()}`, date: today, from, to, amount: amt, note: note || '—' })
              } else {
                const c = CLIENTS.find(x => x.name === client)!
                const s = SUPPLIERS.find(x => x.name === supplier)!
                const inv = INVOICES.find(i => i.no === invoiceNo)
                const pur = PURCHASES.find(p => p.no === billNo)
                onDiverted({
                  id: `DV${Date.now()}`, date: today,
                  clientId: c.id, client, invoiceNo, invoiceValue: inv?.total ?? 0,
                  supplierId: s.id, supplier, billNo, billValue: pur?.total ?? 0,
                  amount: amt, ref: note || '—', note: 'Entered from the sale bill',
                })
              }
              setAmount(''); setNote(''); onClose()
            }}>
            <Check size={14} /> Post {amt > 0 ? inr(amt) : ''}
          </button>
        </div>
      </div>
    </Modal>
  )
}

const Step = ({ n, t, d }: { n: string; t: string; d: string }) => (
  <div className="rounded-lg p-3.5" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-2)' }}>
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold mb-2"
      style={{ background: 'var(--brand)', color: '#fff' }}>{n}</span>
    <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-1)' }}>{t}</p>
    <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{d}</p>
  </div>
)
