'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Banknote, CreditCard } from 'lucide-react'
import { SettingsCard, SettingsSwitch } from './workshop-settings-layout'
import { updateRestaurant, useRestaurantStatus } from '@/lib/use-restaurant-status'

type Method = 'cash' | 'card'

const METHODS: { id: Method; field: 'cashPaymentEnabled' | 'cardPaymentEnabled'; icon: typeof Banknote; title: string; description: string }[] = [
  { id: 'cash', field: 'cashPaymentEnabled', icon: Banknote, title: 'Gotówka', description: 'Klient płaci gotówką przy odbiorze lub kierowcy.' },
  { id: 'card', field: 'cardPaymentEnabled', icon: CreditCard, title: 'Karta / BLIK', description: 'Płatność na terminalu. Wyłącz, gdy terminal nie działa – BLIK też idzie przez terminal.' },
]

export function WorkshopPaymentMethods() {
  const { status, mutate } = useRestaurantStatus({ realtime: true })
  const [saving, setSaving] = useState<Method | null>(null)

  if (!status) return <div className="rounded-2xl border border-[#e8e2db] bg-white p-5 text-sm text-[#847c74]">Wczytywanie form płatności…</div>

  const toggle = async (method: (typeof METHODS)[number], enabled: boolean) => {
    const other = METHODS.find((m) => m.id !== method.id)!
    if (!enabled && !status[other.field]) {
      toast.error('Musi zostać włączona przynajmniej jedna forma płatności. Jeśli nic nie działa, wstrzymaj zamówienia online.')
      return
    }
    setSaving(method.id)
    try {
      const result = await updateRestaurant({ [method.field]: enabled })
      void mutate(result.status, { revalidate: false })
      toast.success(`${method.title}: ${enabled ? 'włączona' : 'wyłączona'} dla klientów`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <>
      {METHODS.map((method) => {
        const enabled = status[method.field]
        return (
          <SettingsCard
            key={method.id}
            icon={method.icon}
            title={method.title}
            titleId={`payment-${method.id}-title`}
            description={
              <>
                {method.description}
                {!enabled && <span className="mt-1 block font-semibold text-amber-700">Wyłączona – klienci nie mogą jej teraz wybrać.</span>}
              </>
            }
            action={<SettingsSwitch checked={enabled} disabled={saving !== null} onChange={(value) => void toggle(method, value)} labelledBy={`payment-${method.id}-title`} />}
          />
        )
      })}
    </>
  )
}
