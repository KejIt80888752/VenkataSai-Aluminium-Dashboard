# Venkata Sai Aluminium Trade Links — Business Dashboard

Business / ERP dashboard for **VENKATA SAI ALUMINIUM TRADE LINKS**, an aluminium
supplier in K R Puram, Bengaluru.

- **Live:** https://kejit80888752.github.io/VenkataSai-Aluminium-Dashboard/
- **Public website:** https://venkatasaialuminiu.wixsite.com/venkatasaialuminium

#75, 3rd Cross Muneshwara Layout, Kodigehalli Main Road, Ayyappa Nagar,
K.R Puram, Bengaluru, Karnataka - 560036 · GSTIN `29AEVPN0549N1ZK`

## Modules

| Group | Screens |
|---|---|
| Overview | Dashboard · Alerts & Reminders |
| Material Flow | Material Flow map · Delivery Challans (Excel-style parallel entry) · Coating Reconciliation · Powder Coating Billing |
| Stock | Location Stock · Stock & Inventory · Stock Audit · Stock Movement · Product Catalogue · Item Master |
| Sales | Quotations · Billing / Invoice (printable GST tax invoice) · Sales Reports · Lead Generation · Customers |
| Purchase | Purchase Orders · Purchase Register · Suppliers |
| AI | AI Document Capture — OCR queue, correction report, export patterns, REST API |
| Finance | Outstanding (ageing) · Profit & Loss · GST Reports · GST Reconciliation (2B / 3B) |
| Admin | User Management (role matrix) · Settings |

## Powder coating workflow

Material moves **M1 → PCU1 / PCU2 → Shop / Godown 1 / Godown 2 (4F)**, and every leg is
a delivery challan carrying the full column set: Sl no, profile section, batch, lot,
bundles, qty per bundle, total nos, cut length, weight range, bundle weight, total
weight, sqft, coating company, vehicle no and a free-text remarks column for tax qty.
Custom columns can be added on the entry sheet.

- Outstanding at each coater is tracked in **both pieces and kilograms**
- Weight before and after coating is reconciled per section against a maintained
  expected-gain %, with a tolerance band per profile
- Jobs inside tolerance post to inventory automatically; the rest wait for sign-off
- Coating is billed on **pre-fed sqft per running foot × rate per sqft** — change a
  rate in one place and every bill, job and challan recalculates

## Dual units, kits and pooled weights

- Sections are **bought by weight and sold by pieces** — one entry moves both ledgers
- Packets and boxes explode to pieces (100 rollers per packet, 50 locks per box)
- A floor spring combo set deducts all **six** components when one set is billed
- One weighbridge figure covering several items is split pro-rata by standard weight
- Cut pieces go back to stock at their own length; unusable ends are written off as scrap
- LIFO / FIFO / weighted-average issue policy per item, with weekly standard-weight true-up
  from the latest delivery challan

## Trade-specific handling

- Extruded sections are priced **per kg** and stocked **per piece** — both are tracked,
  with `kg/length` conversion per SKU.
- HSN mapping: 7604 sections · 7606 sheets & ACP · 7005/7007 glass · 8302 hardware · 3214 sealants.
- GST split by place of supply — Karnataka buyers get CGST+SGST, others IGST.
- E-way bill flagged on every consignment above ₹50,000.

## Demo logins

| Email | Password | Role |
|---|---|---|
| admin@venkatasaialuminium.com | admin123 | Admin |
| manager@venkatasaialuminium.com | manager123 | Manager |
| sales@venkatasaialuminium.com | sales123 | Sales Executive |
| store@venkatasaialuminium.com | store123 | Store Keeper |

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run deploy   # publish dist/ to gh-pages
```

React 18 · TypeScript · Vite · Tailwind CSS · Recharts · React Router (HashRouter)

Figures in the dashboard are generated from a fixed seed, so every screen
reconciles against the same invoice, purchase and stock book.

---
Built by **KEJ IT Solutions**
