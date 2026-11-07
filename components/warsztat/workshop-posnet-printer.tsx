'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PosnetPrinter, useNativeAndroid } from '@/lib/native-posnet'

export function WorkshopPosnetPrinter({ onOpenSettings, canConfigure }: {
  onOpenSettings: () => void
  canConfigure: boolean
}) {
  const [startupOpen, setStartupOpen] = useState(false)
  const native = useNativeAndroid()

  useEffect(() => {
    if (!canConfigure || !native) return
    let mounted = true
    void PosnetPrinter.getConfiguration().then((saved) => {
      if (mounted) setStartupOpen(!saved.configured && !saved.setupComplete)
    }).catch((error: unknown) => {
      if (mounted) toast.error(error instanceof Error ? error.message : 'Nie udało się odczytać ustawień drukarki.')
    })
    return () => { mounted = false }
  }, [canConfigure, native])

  async function continueWithoutPrinter() {
    try {
      await PosnetPrinter.completeSetup()
      setStartupOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać wyboru.')
    }
  }

  if (!canConfigure || !native) return null

  return (
    <Dialog open={startupOpen} onOpenChange={(open) => { if (!open) void continueWithoutPrinter() }}>
      <DialogContent data-keep-size className="workshop-dashboard">
        <DialogHeader>
          <DialogTitle>Uruchom Yummy Warsztat</DialogTitle>
          <DialogDescription>Możesz teraz skonfigurować POSNET albo wejść do panelu i zrobić to później w Ustawieniach.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-col sm:space-x-0">
          <Button onClick={() => { setStartupOpen(false); onOpenSettings() }}>Ustaw drukarkę</Button>
          <Button variant="outline" onClick={() => void continueWithoutPrinter()}>Start bez drukarki</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
