'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { KitchenOrder } from '@/components/warsztat/order-data'

const REASONS = ['Klient nie odbiera', 'Klient zrezygnował', 'Zły adres', 'Inny powód']

type Props = { order: KitchenOrder | null; onClose: () => void; onConfirm: (reason: string) => void }

export function DriverReturnDialog({ order, onClose, onConfirm }: Props) {
  const [custom, setCustom] = useState('')
  return (
    <Dialog open={!!order} onOpenChange={(open) => { if (!open) { setCustom(''); onClose() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Wracasz z {order?.id}?</DialogTitle>
          <DialogDescription>Zamówienie wróci do „Gotowe do wyjazdu”, a bar zobaczy powód.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {REASONS.slice(0, -1).map((reason) => (
            <button key={reason} type="button" onClick={() => onConfirm(reason)} className="h-12 rounded-xl border border-[#ddd5cc] text-sm font-bold hover:bg-[#f6f3ef]">{reason}</button>
          ))}
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); onConfirm(custom.trim() || 'Inny powód'); setCustom('') }}>
            <label htmlFor="return-reason" className="sr-only">Inny powód</label>
            <input id="return-reason" value={custom} onChange={(event) => setCustom(event.target.value)} maxLength={200} placeholder="Inny powód…" className="h-12 min-w-0 flex-1 rounded-xl border border-[#ddd5cc] px-3 text-sm" />
            <button type="submit" className="h-12 rounded-xl bg-[#211e1b] px-4 text-sm font-bold text-white">Zapisz</button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
