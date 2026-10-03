import { Bike, Check, CheckCircle2, Clock3, Pause, Play, ShoppingBag, Store, X } from 'lucide-react'
import { statusStyles, type KitchenOrder, type OrderStatus } from './order-data'

type WorkshopOrderCardProps = {
  order: KitchenOrder
  selected: boolean
  onSelect: (order: KitchenOrder) => void
  onStart: (id: string) => void
  onTogglePause: (id: string) => void
  onMarkReady: (id: string) => void
  onHandOff: (id: string) => void
  onDelete: (id: string) => void
}

const statusAccent: Record<OrderStatus, string> = {
  new: 'text-primary',
  preparing: 'text-amber-700',
  ready: 'text-emerald-700',
}

function OrderTypeIcon({ type }: { type: KitchenOrder['type'] }) {
  return type === 'Dostawa' ? <Bike aria-hidden="true" /> : <Store aria-hidden="true" />
}

export function WorkshopOrderCard({ order, selected, onSelect, onStart, onTogglePause, onMarkReady, onHandOff, onDelete }: WorkshopOrderCardProps) {
  const status = statusStyles[order.status]
  const isWalkIn = order.type === 'Stacjonarnie'
  const Icon = order.type === 'Dostawa' ? Bike : isWalkIn ? Store : ShoppingBag
  const progress = Math.min(100, Math.max(18, (order.prepMinutes ?? 0) * 12 + 18))

  return (
    <article className={`overflow-hidden rounded-2xl border transition-all duration-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 ${selected ? 'border-primary shadow-[0_4px_20px_rgba(226,38,28,0.12)] ring-1 ring-primary/15' : 'border-[#eae4dd] shadow-[0_3px_12px_rgba(42,31,23,0.035)] hover:border-[#d8cec3]'} ${isWalkIn ? 'border-l-[3px] border-l-violet-400 bg-violet-50/55' : 'bg-[#fffdfa]'}`}>
      <button type="button" onClick={() => onSelect(order)} aria-label={`Pokaż szczegóły zamówienia ${order.id}, ${order.customer}`} aria-pressed={selected} className="block w-full p-3.5 text-left sm:p-4">
        <div className="flex items-start gap-2.5">
          <span className={`grid size-10 shrink-0 place-items-center rounded-full ${isWalkIn ? 'bg-violet-100 text-violet-700' : `${status.pale} ${statusAccent[order.status]}`}`}>
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-extrabold tracking-tight text-[#191817]">{order.id}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#776e67]"><Clock3 className="size-3" aria-hidden="true" />{order.created}</span>
            </div>
            <span className={`mt-0.5 flex items-center gap-1 text-[11px] font-semibold ${isWalkIn ? 'text-violet-700' : statusAccent[order.status]}`}>
              <OrderTypeIcon type={order.type} />
              {isWalkIn ? 'Zakup stacjonarny' : order.type}
            </span>
            {order.handedOff && <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800">Wydano · do zamknięcia</span>}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className={`truncate text-[13px] font-semibold ${isWalkIn ? 'text-violet-800' : 'text-[#25211f]'}`}>{isWalkIn ? 'Klient stacjonarny' : order.customer}</span>
          <span className="shrink-0 text-[10px] text-[#817871]">{order.handedOff ? 'Wydano' : order.eta}</span>
        </div>
        <ul className="mt-2.5 flex flex-col gap-1.5 border-t border-[#f0ece7] pt-2.5 text-[12px] leading-snug text-[#302b27]">
          {order.items.slice(0, 3).map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex items-baseline gap-2">
              <span className="w-5 shrink-0 font-semibold">{item.quantity}×</span>
              <span className="min-w-0">
                {item.name}
                {item.options && <span className="block pl-0.5 text-[10px] text-[#817871]">{item.options}</span>}
              </span>
            </li>
          ))}
          {order.items.length > 3 && <li className="pl-7 text-[10px] text-[#817871]">+ {order.items.length - 3} kolejne pozycje</li>}
        </ul>
        {order.status === 'preparing' && (
          <div className="mt-3" aria-label={`Postęp przygotowania ${progress}%`}>
            <div className="flex items-center justify-between text-[11px] font-semibold text-amber-700">
              <span>{order.prepMinutes ?? 0} min</span>
              <span className="text-[9px] font-normal text-[#817871]">Do zrobienia: {order.items.length} dania</span>
            </div>
            <div role="progressbar" aria-label="Postęp przygotowania" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f4e8d7]">
              <div className="h-full rounded-full bg-amber-500 transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {order.status === 'ready' && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700"><CheckCircle2 className="size-4" aria-hidden="true" />{order.handedOff ? 'Wydano – zamknij zamówienie, aby usunąć z listy' : `Gotowe od ${order.readyMinutes ?? 1} min`}</div>
        )}
      </button>

      <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4">
        {order.status === 'new' && (
          <button type="button" onClick={() => onStart(order.id)} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[12px] font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            <Play className="size-4 fill-current" aria-hidden="true" />Rozpocznij
          </button>
        )}
        {order.status === 'preparing' && (
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button type="button" onClick={() => onTogglePause(order.id)} aria-label={order.paused ? `Wznów ${order.id}` : `Wstrzymaj ${order.id}`} className="grid size-10 place-items-center rounded-xl bg-[#f1efec] text-[#262220] transition-colors hover:bg-[#e8e4df] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
              {order.paused ? <Play className="size-4 fill-current" aria-hidden="true" /> : <Pause className="size-4 fill-current" aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => onMarkReady(order.id)} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-50 text-[12px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
              <Check className="size-4" aria-hidden="true" />Gotowe
            </button>
          </div>
        )}
        {order.status === 'ready' && (order.handedOff ? (
          <button type="button" onClick={() => onDelete(order.id)} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#f2eee9] text-[12px] font-bold text-[#5f5750] transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            <X className="size-4" aria-hidden="true" />Zamknij / usuń
          </button>
        ) : (
          <button type="button" onClick={() => onHandOff(order.id)} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 text-[12px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
            <Check className="size-4" aria-hidden="true" />Oznacz jako wydane
          </button>
        ))}
      </div>
    </article>
  )
}

