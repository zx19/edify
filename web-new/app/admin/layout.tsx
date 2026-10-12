import type { PropsWithChildren } from 'react'
import { getRouteMetadata } from '@/app/route-metadata'
import { AdminGuard } from './_components/admin-guard'

export function generateMetadata() {
  return getRouteMetadata('admin', ($) => $.nav.title)
}

export default function AdminLayout({ children }: PropsWithChildren) {
  return <AdminGuard>{children}</AdminGuard>
}
