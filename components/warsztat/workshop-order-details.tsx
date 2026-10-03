import { Bike, Check, CheckCircle2, Clock3, Copy, MapPin, Phone, Play, ShoppingBag, Store, Trash2, UserRound, X } from 'lucide-react'
import type { KitchenOrder } from './order-data'

type WorkshopOrderDetailsProps = {
  order: KitchenOrder
  onClose?: () => void
  onPrimaryAction: () => void
  onDelete: () => void
}

export function WorkshopOrderDetails({ order, onClose, onPrimaryAction, onDelete }: WorkshopOrderDetailsProps) {
  const isDelivery = order.type === 'Dostawa'
  const isWalkIn = order.type === 'Stacjonarnie'
  const TypeIcon = isDelivery ? Bike : Store
  const actionLabel = order.handedOff ? 'Zamknij / usuń zamówienie' : order.status === 'new' ? 'Rozpocznij przygotowanie' : order.status === 'preparing' ? 'Oznacz jako gotowe' : 'Oznacz jako wydane'
  const ActionIcon = order.handedOff ? Trash2 : order.status === 'ready' ? Check : order.status === 'preparing' ? CheckCircle2 : Play

  return (
    <section aria-label={`Szczegóły zamówienia ${order.id}`} className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#e9e3dc] bg-[#fffdfa] shadow-[0_8px_28px_rgba(33,25,20,0.06)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#f0ece7] px-4 py-4 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <h2 className="text-[26px] font-black tracking-tight text-[#171514]">{order.id}</h2>
          <span className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold ${order.status === 'ready' ? 'bg-emerald-50 text-emerald-700' : order.status === 'preparing' ? 'bg-amber-50 text-amber-700' : 'bg-primary/10 text-primary'}`}>
            <TypeIcon className="size-4" aria-hidden="true" />{order.type}
          </span>
        </div>
        {onClose && <button type="button" onClick={onClose} aria-label="Zamknij szczegóły" className="grid size-9 shrink-0 place-items-center rounded-full text-[#625b55] transition-colors hover:bg-[#f2eee9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X className="size-5" aria-hidden="true" /></button>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-5">
        <div className="flex items-center justify-between border-b border-[#f0ece7] py-3.5 text-[12px]">
          <span className="flex items-center gap-2 font-medium text-[#25211f]"><Clock3 className="size-[17px] text-[#5f5954]" aria-hidden="true" />Złożono o {order.created}</span>
          <span className="text-[11px] text-[#817871]">27.05.2025</span>
        </div>
        <div className="flex items-center gap-2 border-b border-[#f0ece7] py-3.5 text-[14px] font-semibold text-[#25211f]"><Clock3 className={`size-[18px] ${order.status === 'preparing' ? 'text-amber-600' : 'text-primary'}`} aria-hidden="true" />{order.handedOff ? 'Zamówienie wydane' : order.status === 'ready' ? 'Zamówienie gotowe' : order.eta}</div>

        {isDelivery && order.address && (
          <div className="my-3.5 flex items-center gap-3 rounded-xl bg-[#f5f2ee] p-3">
            <MapPin className="size-5 shrink-0 text-[#262220]" aria-hidden="true" />
            <div className="min-w-0 flex-1 text-[12px] leading-relaxed">
              <p className="truncate font-medium text-[#25211f]">{order.address}</p>
              <p className="text-[#756d66]">{order.postcode}</p>
            </div>
            <button type="button" aria-label="Kopiuj adres" onClick={() => { void navigator.clipboard?.writeText(`${order.address}, ${order.postcode}`) }} className="grid size-9 shrink-0 place-items-center rounded-lg text-[#514a45] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Copy className="size-4" aria-hidden="true" /></button>
          </div>
        )}

        <div className={`flex items-center gap-3 border-b border-[#f0ece7] py-3.5 ${isWalkIn ? 'rounded-xl bg-violet-50/60 px-3' : ''}`}>
          <span className={`grid size-10 shrink-0 place-items-center rounded-full ${isWalkIn ? 'bg-violet-100 text-violet-700' : 'bg-[#f3f0ec] text-[#262220]'}`}>{isWalkIn ? <UserRound className="size-[18px]" aria-hidden="true" /> : <Phone className="size-[18px]" aria-hidden="true" />}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-[#24201e]">{order.customer}</p>
            {order.phone ? <a href={`tel:${order.phone.replaceAll(' ', '')}`} className="text-[11px] text-[#716962] hover:text-primary">{order.phone}</a> : <span className="text-[11px] text-violet-700">Zakup przy ladzie · bez danych kontaktowych</span>}
          </div>
          {order.phone && <a href={`tel:${order.phone.replaceAll(' ', '')}`} aria-label={`Zadzwoń do ${order.customer}`} className="grid size-9 place-items-center rounded-full text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Phone className="size-[18px]" aria-hidden="true" /></a>}
        </div>

        <ul className="divide-y divide-[#f0ece7]">
          {order.items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex gap-3 py-3.5 text-[13px]">
              <span className="w-5 shrink-0 font-semibold text-[#25211f]">{item.quantity}×</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[#25211f]">{item.name}</p>
                {item.options && <ul className="mt-1 list-disc pl-4 text-[11px] leading-relaxed text-[#716962]"><li>{item.options}</li></ul>}
              </div>
            </li>
          ))}
        </ul>

        {order.note && <div className="border-t border-[#f0ece7] py-3.5"><p className="mb-2 text-[11px] font-medium text-[#716962]">Uwagi do zamówienia</p><p className="rounded-xl bg-[#f5f2ee] px-3 py-2.5 text-[11px] leading-relaxed text-[#625b55]">{order.note}</p></div>}
      </div>

      <div className="border-t border-[#eee8e2] bg-[#fffdfa] p-4 sm:p-5">
        <button type="button" onClick={order.handedOff ? onDelete : onPrimaryAction} className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${order.handedOff ? 'bg-[#f2eee9] text-[#5f5750] hover:bg-red-50 hover:text-red-700 focus-visible:ring-primary' : order.status === 'ready' ? 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600' : 'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary'}`}>
          <ActionIcon className={`size-[17px] ${order.status === 'new' ? 'fill-current' : ''}`} aria-hidden="true" />{actionLabel}
        </button>
      </div>
    </section>
  )
}

