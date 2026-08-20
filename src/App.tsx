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
