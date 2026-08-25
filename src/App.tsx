import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { DarkModeProvider } from '@/hooks/useDarkMode'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Login        from '@/pages/Login'
import Dashboard    from '@/pages/Dashboard'
import Products     from '@/pages/Products'
import Inventory    from '@/pages/Inventory'
import Movements    from '@/pages/Movements'
import Quotations   from '@/pages/Quotations'
import Billing      from '@/pages/Billing'
import SalesReports from '@/pages/SalesReports'
import Leads        from '@/pages/Leads'
import Clients      from '@/pages/Clients'
import Purchases    from '@/pages/Purchases'
import Suppliers    from '@/pages/Suppliers'
import Outstanding  from '@/pages/Outstanding'
import ProfitLoss   from '@/pages/ProfitLoss'
import GstReports   from '@/pages/GstReports'
import Users        from '@/pages/Users'
import Settings     from '@/pages/Settings'
import MaterialFlow    from '@/pages/MaterialFlow'
import Challans        from '@/pages/Challans'
import CoatingRecon    from '@/pages/CoatingRecon'
import CoatingBilling  from '@/pages/CoatingBilling'
import Locations       from '@/pages/Locations'
import ItemMaster      from '@/pages/ItemMaster'
import AiCapture       from '@/pages/AiCapture'
import GstRecon        from '@/pages/GstRecon'
import StockAudit      from '@/pages/StockAudit'
import PurchaseOrders  from '@/pages/PurchaseOrders'
import Alerts          from '@/pages/Alerts'
import SupplierRecon   from '@/pages/SupplierRecon'
import Returns         from '@/pages/Returns'
import GateRegister    from '@/pages/GateRegister'
import BankRecon       from '@/pages/BankRecon'
import QuickBill       from '@/pages/QuickBill'
import GateCheck       from '@/pages/GateCheck'
import Payments        from '@/pages/Payments'
import CoaterBillRecon from '@/pages/CoaterBillRecon'

function Guard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={
        <Guard>
          <DashboardLayout>
            <Routes>
              <Route path="/"              element={<Dashboard    />} />
              <Route path="/products"      element={<Products     />} />
              <Route path="/inventory"     element={<Inventory    />} />
              <Route path="/movements"     element={<Movements    />} />
              <Route path="/quotation"     element={<Quotations   />} />
              <Route path="/billing"       element={<Billing      />} />
              <Route path="/sales-reports" element={<SalesReports />} />
              <Route path="/leads"         element={<Leads        />} />
              <Route path="/clients"       element={<Clients      />} />
              <Route path="/purchases"     element={<Purchases    />} />
              <Route path="/suppliers"     element={<Suppliers    />} />
              <Route path="/outstanding"   element={<Outstanding  />} />
              <Route path="/profit-loss"   element={<ProfitLoss   />} />
              <Route path="/gst-reports"   element={<GstReports   />} />
              <Route path="/users"         element={<Users        />} />
              <Route path="/settings"      element={<Settings     />} />
              <Route path="/material-flow"   element={<MaterialFlow   />} />
              <Route path="/challans"        element={<Challans       />} />
              <Route path="/coating-recon"   element={<CoatingRecon   />} />
              <Route path="/coating-billing" element={<CoatingBilling />} />
              <Route path="/locations"       element={<Locations      />} />
              <Route path="/item-master"     element={<ItemMaster     />} />
              <Route path="/ai-capture"      element={<AiCapture      />} />
              <Route path="/gst-recon"       element={<GstRecon       />} />
              <Route path="/stock-audit"     element={<StockAudit     />} />
              <Route path="/purchase-orders" element={<PurchaseOrders />} />
              <Route path="/alerts"          element={<Alerts         />} />
              <Route path="/supplier-recon"  element={<SupplierRecon  />} />
              <Route path="/returns"         element={<Returns        />} />
              <Route path="/gate-register"   element={<GateRegister   />} />
              <Route path="/bank"            element={<BankRecon      />} />
              <Route path="/quick-bill"      element={<QuickBill       />} />
              <Route path="/gate-check"      element={<GateCheck       />} />
              <Route path="/payments"        element={<Payments        />} />
              <Route path="/coater-bill"     element={<CoaterBillRecon />} />
              <Route path="*"              element={<Navigate to="/" replace />} />
            </Routes>
          </DashboardLayout>
        </Guard>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <HashRouter>
      <DarkModeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </DarkModeProvider>
    </HashRouter>
  )
}
