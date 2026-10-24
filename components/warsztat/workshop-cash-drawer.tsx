'use client'

import { useEffect, useState } from 'react'
import { Archive, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PosnetPrinter, useNativeAndroid } from '@/lib/native-posnet'

export function WorkshopCashDrawerButton({ className }: { className?: string }) {
  const [available, setAvailable] = useState(false)
  const [opening, setOpening] = useState(false)
  const native = useNativeAndroid()

  useEffect(() => {
    if (!native) { setAvailable(false); return }
    let mounted = true
    const refreshConfiguration = () => {
      void PosnetPrinter.getConfiguration().then((configuration) => {
        if (mounted) setAvailable(configuration.configured)
      }).catch((error: unknown) => {
        if (mounted) toast.error(error instanceof Error ? error.message : 'Nie udało się odczytać konfiguracji POSNET.')
      })
    }
    refreshConfiguration()
    window.addEventListener('posnet-configuration-changed', refreshConfiguration)
    return () => {
      mounted = false
      window.removeEventListener('posnet-configuration-changed', refreshConfiguration)
    }
  }, [native])

  if (!available || !native) return null

  async function openDrawer() {
    if (opening) return
    setOpening(true)
    try {
      await PosnetPrinter.openCashDrawer()
      toast.success('Polecenie otwarcia szuflady wysłane do POSNET.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się otworzyć szuflady kasowej.')
    } finally {
      setOpening(false)
    }
  }

  return (
    <Button
      type="button"
      onClick={() => void openDrawer()}
      disabled={opening}
      className={cn('bg-[#211e1b] text-white shadow-sm hover:bg-[#36312d]', className)}
    >
      {opening ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden="true" /> : <Archive data-icon="inline-start" />}
      Otwórz kasetkę
    </Button>
  )
}
