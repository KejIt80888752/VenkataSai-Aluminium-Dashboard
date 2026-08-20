import { createContext, useContext, useState, type ReactNode } from 'react'

export interface User { email: string; name: string; role: 'Admin' | 'Manager' | 'Sales Executive' | 'Store Keeper' | 'Accountant' }
interface Ctx { user: User | null; login: (e: string, p: string) => boolean; logout: () => void }

const AuthCtx = createContext<Ctx | null>(null)
const KEY = 'vsa_user'

export const DEMO_USERS: Record<string, { pw: string; name: string; role: User['role'] }> = {
  'admin@venkatasaialuminium.com':   { pw: 'admin123',   name: 'D. Nageswara Rao', role: 'Admin'           },
  'manager@venkatasaialuminium.com': { pw: 'manager123', name: 'Srinivas B',       role: 'Manager'         },
  'sales@venkatasaialuminium.com':   { pw: 'sales123',   name: 'Kavya M',          role: 'Sales Executive' },
  'store@venkatasaialuminium.com':   { pw: 'store123',   name: 'Ganesh P',         role: 'Store Keeper'    },
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null }
  })

  const login = (email: string, password: string) => {
    const found = DEMO_USERS[email.toLowerCase().trim()]
    if (!found || found.pw !== password) return false
    const u: User = { email: email.toLowerCase().trim(), name: found.name, role: found.role }
    setUser(u); localStorage.setItem(KEY, JSON.stringify(u))
    return true
  }

  const logout = () => { setUser(null); localStorage.removeItem(KEY) }

  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
