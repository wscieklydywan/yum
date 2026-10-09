import { Bike, Check, Clock3, Copy, MapPin, PackageCheck, Pencil, Phone, Plus, Printer, ShoppingBag, Store, TriangleAlert, Undo2, UserRound, X } from 'lucide-react'
import { hasRefundableItems, hasUnbilledItems, orderSources, orderTypeMeta, receiptedQuantity, statusLabels, type KitchenOrder, type OrderAction } from './order-data'
import { StationChip, type OrderPermissions } from './workshop-order-card'
import { Button } from '@/components/ui/button'
import { OrderTimer, elapsedSeconds, formatElapsed } from './order-timer'
import { ScheduledCountdown, scheduledLabel } from './scheduled-countdown'
import { WorkshopUnbilledPayment } from './workshop-unbilled-payment'

const formatTime = (value?: string) => value ? new Date(value).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' }) : ''

type WorkshopOrderDetailsProps = {
  order: KitchenOrder
  now: number | null
  permissions: OrderPermissions
  onPrint: () => void
  onClose?: () => void
  onAction: (action: OrderAction) => void
  onCancelOrder: () => void
  onEditItem: (index: number | null) => void
  onRefund: () => void
  scrollWhole?: boolean
}

export function WorkshopOrderDetails({ order, now, permissions, onPrint, onClose, onAction, onCancelOrder, onEditItem, onRefund, scrollWhole = false }: WorkshopOrderDetailsProps) {
  const isActive = ['new', 'preparing', 'ready'].includes(order.status)
  const canEdit = permissions.canManage && isActive
  const unbilled = hasUnbilledItems(order)
  const anyReceipted = order.items.some((item) => receiptedQuantity(item) > 0)
  const isDelivery = order.type === 'Dostawa'
  const isWalkIn = order.type === 'Stacjonarnie'
  const TypeIcon = isDelivery ? Bike : isWalkIn ? Store : ShoppingBag
  const typeMeta = orderTypeMeta[order.type]
  const sourceMeta = order.source && order.source !== 'yummy' ? orderSources[order.source] : null
  const primary = order.status === 'new' && permissions.canManage
    ? { action: 'accept' as const, label: 'Akceptuj zamówienie', icon: Check, className: 'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary' }
    : order.status === 'ready' && permissions.canHandOff
      ? { action: 'hand_off' as const, label: 'Wydane', icon: PackageCheck, className: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600' }
      : null

  return (
    <section aria-label={`Szczegóły zamówienia ${order.id}, ${typeMeta.short}`} className={`type-${typeMeta.tone} flex flex-col rounded-2xl ${scrollWhole ? '' : 'max-h-full min-h-0 overflow-hidden'} border border-[#e9e3dc] bg-[#fffdfa] shadow-[0_8px_28px_rgba(33,25,20,0.06)]`}>
      <div className="type-band h-1.5 shrink-0" aria-hidden="true" />
      <div className="flex items-center justify-between gap-3 border-b border-[#f0ece7] px-4 py-4 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <h2 className="text-[26px] font-black tracking-tight text-[#171514]">{order.id}</h2>
          <span className="type-soft inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold uppercase tracking-wide">
            <TypeIcon className="size-4" aria-hidden="true" />{typeMeta.short}
          </span>
          {sourceMeta && <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e9e3dc] bg-white pl-1 pr-2.5 text-[11px] font-bold text-[#25211f]">
            {sourceMeta.logo && <img src={sourceMeta.logo} alt="" width={24} height={24} className="size-6 rounded-md" />}{sourceMeta.label}
          </span>}
        </div>
        {onClose && <button type="button" onClick={onClose} aria-label="Zamknij szczegóły" className="grid size-9 shrink-0 place-items-center rounded-full text-[#625b55] transition-colors hover:bg-[#f2eee9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:size-12"><X className="size-5 md:size-7" aria-hidden="true" /></button>}
      </div>

      <div className={`px-4 sm:px-5 ${scrollWhole ? '' : 'min-h-0 flex-1 overflow-y-auto overscroll-contain'}`}>
        <div className="flex items-center justify-between border-b border-[#f0ece7] py-3.5 text-[12px]">
          <span className="flex items-center gap-2 font-medium text-[#25211f]"><Clock3 className="size-[17px] text-[#5f5954]" aria-hidden="true" />Złożono o {order.created}</span>
          <span className="text-[11px] text-[#817871]">{order.receivedAt ? new Date(order.receivedAt).toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw' }) : '—'}</span>
        </div>
        {isActive ? <div className="flex flex-col gap-2 border-b border-border py-3.5">
          <ScheduledCountdown order={order} now={now} variant="large" />
          <OrderTimer order={order} now={now} />
          <p className="text-xs text-muted-foreground">{statusLabels[order.status]} · {order.status === 'ready' ? `gotowe od ${formatElapsed(elapsedSeconds(order.readyAt, now))}` : order.scheduledFor ? `na godzinę ${scheduledLabel(order.scheduledFor, now)}` : `planowany czas: ${order.eta}`}</p>
        </div> : <div className={`my-3.5 rounded-xl px-3 py-2.5 text-[12px] leading-relaxed ${order.status === 'cancelled' ? 'bg-red-50 text-red-800' : 'bg-[#f5f2ee] text-[#4a443f]'}`}>
          <p className="font-bold">{statusLabels[order.status]}{formatTime(order.status === 'cancelled' ? order.cancelledAt : order.handedOffAt) && ` o ${formatTime(order.status === 'cancelled' ? order.cancelledAt : order.handedOffAt)}`}</p>
          {order.status === 'cancelled' && order.cancelReason && <p>Powód: {order.cancelReason}</p>}
          {order.status === 'handed_off' && unbilled && <p className="text-amber-800">Wydano bez pełnego paragonu fiskalnego.</p>}
          {order.status === 'handed_off' && unbilled && order.databaseId && permissions.canHandOff && <WorkshopUnbilledPayment key={order.databaseId} orderId={order.databaseId} current={order.paymentMethod} />}
        </div>}

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

        <div className={`flex items-center gap-3 border-b border-[#f0ece7] py-3.5 ${isWalkIn ? 'type-soft my-3.5 rounded-xl border-b-0 px-3' : ''}`}>
          <span className={`grid size-10 shrink-0 place-items-center rounded-full ${isWalkIn ? 'type-badge' : 'bg-[#f3f0ec] text-[#262220]'}`}>{isWalkIn ? <UserRound className="size-[18px]" aria-hidden="true" /> : <Phone className="size-[18px]" aria-hidden="true" />}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-[#24201e]">{order.customer}</p>
            {order.phone ? <a href={`tel:${order.phone.replaceAll(' ', '')}`} className="text-[11px] text-[#716962] hover:text-primary">{order.phone}</a> : <span className="text-[11px] font-medium">Gość przy ladzie · bez danych kontaktowych</span>}
          </div>
          {order.phone && <a href={`tel:${order.phone.replaceAll(' ', '')}`} aria-label={`Zadzwoń do ${order.customer}`} className="grid size-9 place-items-center rounded-full text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Phone className="size-[18px]" aria-hidden="true" /></a>}
        </div>

        <ul className="divide-y divide-[#f0ece7]">
          {order.items.map((item, index) => (
            <li key={item.id ?? `${item.name}-${index}`} className={`flex gap-3 py-3.5 text-[13px] ${item.cancelled ? 'opacity-50' : ''}`}>
              <span className="w-6 shrink-0 font-semibold tabular-nums text-[#25211f]">{item.quantity}×</span>
              <div className="min-w-0 flex-1">
                <p className={`font-bold text-[#25211f] ${item.cancelled ? 'line-through' : ''}`}>{item.name}</p>
                {item.options && <p className="mt-0.5 text-[11px] leading-relaxed text-[#716962]">{item.options}</p>}
                <p className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] font-semibold">
                  {item.unitPrice !== undefined && <span className="text-[#716962] tabular-nums">{(item.unitPrice * item.quantity).toFixed(2).replace('.', ',')} zł</span>}
                  {item.added && <span className="text-primary">Dodane później</span>}
                  {receiptedQuantity(item) > 0 && <span className="text-emerald-700">Na paragonie: {receiptedQuantity(item)}</span>}
                  {(item.refunded ?? 0) > 0 && <span className="text-red-700">Zwrot: {item.refunded}</span>}
                </p>
                {item.problem && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-destructive"><TriangleAlert className="size-3" aria-hidden="true" />{item.problem}</p>}
                {item.cancelled && <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">Anulowana</p>}
              </div>
              <span className="flex shrink-0 flex-col items-end gap-1"><StationChip station={item.station ?? 'kitchen'} />{item.done && !item.cancelled && <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700"><Check className="size-3" aria-hidden="true" />gotowe</span>}</span>
              {canEdit && !item.cancelled && <button type="button" onClick={() => onEditItem(index)} aria-label={`Edytuj pozycję ${item.name}`} className="grid size-8 shrink-0 place-items-center rounded-lg border border-transparent text-[#625b55] transition-colors hover:border-[#e5ded6] hover:bg-[#f2eee9] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:size-11"><Pencil className="size-4 md:size-5" aria-hidden="true" /></button>}
            </li>
          ))}
        </ul>
        {canEdit && <button type="button" onClick={() => onEditItem(null)} className="mb-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#d8d0c7] text-[12px] font-semibold text-[#514a45] transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Plus className="size-4" aria-hidden="true" />Dodaj pozycję</button>}

        {order.note && <div className="border-t border-[#f0ece7] py-3.5"><p className="mb-2 text-[11px] font-medium text-[#716962]">Uwagi do zamówienia</p><p className="rounded-xl bg-[#f5f2ee] px-3 py-2.5 text-[11px] leading-relaxed text-[#625b55]">{order.note}</p></div>}
      </div>

      <div className="flex flex-col gap-2 border-t border-[#eee8e2] bg-[#fffdfa] p-4 sm:p-5">
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onPrint} disabled={!unbilled}><Printer data-icon="inline-start" />{!unbilled ? 'Paragon wydany' : anyReceipted ? 'Paragon dopłaty' : 'Paragon'}</Button>
          {permissions.canManage && hasRefundableItems(order) && <Button variant="outline" className="flex-1 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={onRefund}><Undo2 data-icon="inline-start" />Zwrot</Button>}
        </div>
        <p className="mb-1 text-center text-[10px] text-muted-foreground">{process.env.NEXT_PUBLIC_FISCAL_BRIDGE_URL ? 'Drukarka fiskalna: podłączona' : 'Drukarka fiskalna: jeszcze niepodłączona'}</p>
        {primary && <button type="button" onClick={() => onAction(primary.action)} className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${primary.className}`}>
          <primary.icon className="size-[17px]" aria-hidden="true" />{primary.label}
        </button>}
        {permissions.canManage && order.status === 'cancelled' && <button type="button" onClick={() => onAction('restore_order')} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[13px] font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"><Undo2 className="size-[17px]" aria-hidden="true" />Przywróć zamówienie</button>}
        {permissions.canManage && order.status === 'handed_off' && <button type="button" onClick={() => onAction('undo_hand_off')} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-400 bg-amber-50 text-[13px] font-bold text-amber-900 shadow-sm transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 md:h-12 md:text-[14px]"><Undo2 className="size-[18px]" aria-hidden="true" />Cofnij wydanie</button>}
        {permissions.canManage && isActive && <button type="button" onClick={onCancelOrder} className="h-10 w-full rounded-xl text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Anuluj zamówienie</button>}
      </div>
    </section>
  )
}

