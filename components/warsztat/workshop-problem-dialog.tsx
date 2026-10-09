'use client'

import { useState, type FormEvent } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatItem, type IndexedOrderItem } from './order-data'

const presets = ['Brak produktu', 'Opóźnienie', 'Pomyłka w zamówieniu']

export type ProblemTarget = { orderId: string; orderLabel: string; item: IndexedOrderItem }

export function WorkshopProblemDialog({ target, onClose, onSubmit }: { target: ProblemTarget | null; onClose: () => void; onSubmit: (target: ProblemTarget, reason: string) => void }) {
  const [custom, setCustom] = useState('')

  function submit(reason: string) {
    if (!target || !reason.trim()) return
    onSubmit(target, reason.trim())
    setCustom('')
  }

  function submitCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submit(custom)
  }

  return <Dialog open={!!target} onOpenChange={(open) => { if (!open) { setCustom(''); onClose() } }}>
    <DialogContent className="workshop-dashboard sm:max-w-sm">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><TriangleAlert className="size-5 text-destructive" aria-hidden="true" />Zgłoś problem</DialogTitle>
        <DialogDescription>{target ? `${target.orderLabel} · ${formatItem(target.item)}. Bar zobaczy zgłoszenie od razu.` : ''}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        {presets.map((preset) => <Button key={preset} type="button" variant="outline" className="h-12 justify-start text-sm" onClick={() => submit(preset)}>{preset}</Button>)}
      </div>
      <form onSubmit={submitCustom} className="flex flex-col gap-2">
        <label htmlFor="problem-reason" className="text-xs font-semibold text-muted-foreground">Inny powód</label>
        <input id="problem-reason" value={custom} maxLength={120} onChange={(event) => setCustom(event.target.value)} placeholder="np. brak frytek" className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <DialogFooter><Button type="submit" variant="destructive" disabled={!custom.trim()}>Wyślij na bar</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
