'use client'

import useSWR, { preload } from 'swr'
import { LoaderCircle, Mail, MapPin, Phone } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { tierBadge } from '@/lib/club-tier-badge'
import { formatPhone } from '@/lib/phone'
import { CustomerPoints, type Customer } from './workshop-customers'

const fetchCustomer = async (url: string) => {
  const response = await fetch(url)
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error ?? 'Nie udało się pobrać klienta.')
  return (data?.customer ?? null) as Customer | null
}

const customerKey = (customerId: string) => `/api/workshop/customers?id=${customerId}`

export function useClubCustomer(customerId?: string) {
  return useSWR(customerId ? customerKey(customerId) : null, fetchCustomer, { revalidateOnFocus: false, dedupingInterval: 30_000 })
}

export function prefetchClubCustomer(customerId: string) {
  void preload(customerKey(customerId), fetchCustomer)
}

export function ClubTierBadge({ tier }: { tier?: string }) {
  if (!tier || !(tier in tierBadge)) return null
  return <span className={`inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-bold ${tierBadge[tier as keyof typeof tierBadge]}`}>{tier}</span>
}

function ContactRow({ icon: Icon, label, value, href }: { icon: typeof Phone; label: string; value?: string | null; href?: string }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-[#716962]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#817871]">{label}</dt>
        <dd className="break-words text-[13px] font-medium text-[#25211f]">
          {value ? href ? <a href={href} className="hover:text-primary hover:underline">{value}</a> : value : <span className="text-[#a29a92]">Brak</span>}
        </dd>
      </div>
    </div>
  )
}

export function ClubCustomerDialog({ customerId, name, tier, open, onOpenChange }: { customerId: string; name?: string; tier?: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data, error, isLoading, mutate } = useClubCustomer(open ? customerId : undefined)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{name || 'Klient Yummy Club'}<ClubTierBadge tier={tier} /></DialogTitle>
          <DialogDescription>Konto Yummy Club · punkty i dane kontaktowe.</DialogDescription>
        </DialogHeader>
        {isLoading && <p className="flex items-center gap-2 py-6 text-sm text-[#716962]"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Wczytywanie…</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error.message}</p>}
        {!isLoading && !error && !data && <p className="py-4 text-sm text-[#716962]">Nie znaleziono konta klienta.</p>}
        {data && <>
          <dl className="divide-y divide-[#f0ece7] rounded-xl border border-[#e9e3dc] bg-white px-3">
            <ContactRow icon={Phone} label="Telefon" value={data.phone ? formatPhone(data.phone) : null} href={data.phone ? `tel:${data.phone}` : undefined} />
            <ContactRow icon={Mail} label="E-mail" value={data.email} href={`mailto:${data.email}`} />
            <ContactRow icon={MapPin} label="Zapamiętany adres" value={data.address} />
          </dl>
          <CustomerPoints customer={data} showActivity={false} onUpdated={(points) => void mutate({ ...data, points }, { revalidate: true })} />
        </>}
      </DialogContent>
    </Dialog>
  )
}
