import type { ReactNode } from 'react'
import { AdminSidebar } from './admin-sidebar'

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="admin-theme flex h-screen w-full overflow-hidden bg-background-default text-text-primary">
      <AdminSidebar />
      <main className="min-w-0 grow overflow-y-auto">{children}</main>
    </div>
  )
}
