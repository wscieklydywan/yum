'use client'

import { useState } from 'react'
import { PackageCheck, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatMoney, paymentLabels, type PaymentMethod } from '@/lib/fiscal-receipt'
import type { KitchenOrder } from './order-data'
import { CashChange, PaymentPicker } from './workshop-print-dialog'

type HandOffDialogProps = {
  order: KitchenOrder | null
  onClose: () => void
  onPrint: (order: KitchenOrder) => void
  onHandOff: (order: KitchenOrder) => Promise<unknown> | void
}

/** Handing off without a printed receipt still records how the customer paid, so the cash report stays correct. */
export function WorkshopHandOffDialog({ order, onClose, onPrint, onHandOff }: HandOffDialogProps) {
  const [payment, setPayment] = useState<PaymentMethod>('cash')
  const [busy, setBusy] = useState(false)

  function close() {
    if (busy) return
    setPayment('cash')
    onClose()
  }

  async function handOff() {
    if (!order) return
    setBusy(true)
    try {
      await onHandOff(order)
      if (order.databaseId) {
        const response = await fetch('/api/workshop/cash-report', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.databaseId, method: payment }),
        })
        if (!response.ok) toast.error('Wydano, ale nie zapisano formy płatności – ustaw ją w szczegółach w Historii.')
        else toast.success(`Wydano · ${paymentLabels[payment]}`)
      }
    } finally {
      setBusy(false)
      setPayment('cash')
      onClose()
    }
  }

  return <Dialog open={!!order} onOpenChange={(open) => { if (!open) close() }}>
    <DialogContent className="workshop-dashboard flex max-h-[92dvh] flex-col gap-4 overflow-y-auto sm:max-w-md lg:max-w-xl lg:gap-5 lg:p-8">
      <DialogHeader>
        <DialogTitle className="lg:text-2xl">Wydanie bez paragonu · {order?.id}</DialogTitle>
        <DialogDescription className="lg:text-base">Paragon fiskalny nie został wydrukowany. Wybierz, jak klient zapłacił – trafi to do raportu kasowego.</DialogDescription>
      </DialogHeader>
      {order && <div className="flex items-baseline justify-between rounded-xl bg-muted/60 px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">Do zapłaty</span>
        <span className="text-2xl font-black tabular-nums lg:text-3xl">{formatMoney(order.total ?? 0)} zł</span>
      </div>}
      <PaymentPicker value={payment} onChange={setPayment} legend="Forma płatności" />
      {order && payment === 'cash' && <CashChange key={order.id} total={order.total ?? 0} />}
      <DialogFooter className="gap-2">
        <Button variant="outline" className="lg:h-11 lg:text-base" disabled={busy} onClick={() => { if (order) onPrint(order); close() }}><Printer data-icon="inline-start" />Drukuj paragon</Button>
        <Button className="bg-emerald-600 text-white hover:bg-emerald-700 lg:h-11 lg:text-base" disabled={busy} onClick={() => void handOff()}><PackageCheck data-icon="inline-start" />{busy ? 'Wydawanie…' : 'Wydaj'}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
