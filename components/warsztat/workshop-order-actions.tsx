'use client'

import { useState } from 'react'
import { Plus, Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WorkshopCouponDialog } from './workshop-coupon-dialog'
import { WorkshopNewOrderDialog } from './workshop-new-order-dialog'
import type { WorkshopCodePreview } from './workshop-code'

export function WorkshopOrderActions() {
  const [couponOpen, setCouponOpen] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  const [session, setSession] = useState<{ id: number; code: WorkshopCodePreview | null }>({ id: 0, code: null })

  function startCouponOrder(code: WorkshopCodePreview) {
    setSession((current) => ({ id: current.id + 1, code }))
    setCouponOpen(false)
    setOrderOpen(true)
  }

  return <>
    <Button variant="outline" onClick={() => setCouponOpen(true)} className="h-9 shrink-0 rounded-xl px-3 text-xs font-bold lg:h-11 lg:px-4 lg:text-sm lg:[&_svg]:size-[18px]"><Ticket data-icon="inline-start" />Kupon</Button>
    <Button onClick={() => setOrderOpen(true)} className="h-9 shrink-0 rounded-xl px-3 text-xs font-bold shadow-sm lg:h-11 lg:px-5 lg:text-sm lg:[&_svg]:size-5"><Plus data-icon="inline-start" />Dodaj<span className="hidden min-[400px]:inline">&nbsp;zamówienie</span></Button>
    <WorkshopCouponDialog open={couponOpen} onOpenChange={setCouponOpen} onUse={startCouponOrder} />
    {/* The dialog stays mounted between opens, so an accidental close keeps the draft; a new key starts a fresh one. */}
    <WorkshopNewOrderDialog key={session.id} open={orderOpen} onOpenChange={setOrderOpen} initialCode={session.code} onSubmitted={() => setSession((current) => ({ id: current.id + 1, code: null }))} />
  </>
}
