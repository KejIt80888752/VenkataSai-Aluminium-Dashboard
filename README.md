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
| Overview | Dashboard — turnover, margin, receivables, stock value, alerts |
| Stock | Product Catalogue · Stock & Inventory (rack-wise) · Stock Movement ledger |
| Sales | Quotations · Billing / Invoice (printable GST tax invoice) · Sales Reports · Lead Generation · Customers |
| Purchase | Purchase Register · Suppliers |
| Finance | Outstanding (ageing) · Profit & Loss · GST Reports (GSTR-1 / 2 / 3B / HSN) |
| Admin | User Management (role matrix) · Settings |

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
