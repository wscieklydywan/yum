'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WorkshopNewOrderDialog } from './workshop-new-order-dialog'
import type { OrderDraft, PendingOrder } from './pending-orders'

export type DraftRestoreRequest = { id: number; draft: OrderDraft }

type Props = {
  onPayStart?: (entry: PendingOrder) => void
  /** Opens the dialog prefilled with a draft whose save failed. */
  restoreRequest?: DraftRestoreRequest | null
}

export function WorkshopOrderActions({ onPayStart, restoreRequest = null }: Props) {
  const [orderOpen, setOrderOpen] = useState(false)
  const [sessionId, setSessionId] = useState(0)
  const [draft, setDraft] = useState<OrderDraft | null>(null)
  const [handledRestore, setHandledRestore] = useState(0)

  if (restoreRequest && restoreRequest.id !== handledRestore) {
    setHandledRestore(restoreRequest.id)
    setDraft(restoreRequest.draft)
    setSessionId((current) => current + 1)
    setOrderOpen(true)
  }

  function startFresh() {
    setDraft(null)
    setSessionId((current) => current + 1)
  }

  return <>
    <Button onClick={() => setOrderOpen(true)} className="h-9 shrink-0 rounded-xl px-3 text-xs font-bold shadow-sm lg:h-11 lg:px-5 lg:text-sm lg:[&_svg]:size-5"><Plus data-icon="inline-start" />Dodaj<span className="hidden min-[400px]:inline">&nbsp;zamówienie</span></Button>
    {/* The dialog stays mounted between opens, so an accidental close keeps the draft; a new key starts a fresh one. */}
    <WorkshopNewOrderDialog key={sessionId} open={orderOpen} onOpenChange={setOrderOpen} initialCode={null} initialDraft={draft} onSubmitted={startFresh} onPayStart={onPayStart} />
  </>
}
