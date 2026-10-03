import type { Metadata } from 'next'
import { WorkshopDashboard } from '@/components/warsztat/workshop-dashboard'

export const metadata: Metadata = {
  title: 'Warsztat – Yummy',
  description: 'Panel obsługi i przygotowywania zamówień w kuchni Yummy.',
  robots: { index: false, follow: false },
}

export default function WorkshopPage() {
  return <WorkshopDashboard />
}

