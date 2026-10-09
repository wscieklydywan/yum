'use client'

import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { ArrowRight, LoaderCircle, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { describeCodeBenefit } from '@/lib/checkout-codes'
import { fetchWorkshopCode, normalizeCodeInput, type WorkshopCodePreview } from './workshop-code'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUse: (code: WorkshopCodePreview) => void
}

export function WorkshopCouponDialog({ open, onOpenChange, onUse }: Props) {
  const [code, setCode] = useState('')
  const lookupKey = open && code.length >= 3 ? (['workshop-code', code] as const) : null
  const { data: preview, error, isLoading } = useSWR(lookupKey, ([, value]) => fetchWorkshopCode(value), { revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 0 })

  function changeOpen(next: boolean) {
    onOpenChange(next)
    if (!next) setCode('')
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!preview || isLoading) return
    setCode('')
    onUse(preview)
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="workshop-dashboard max-h-[92dvh] w-[calc(100%-1.5rem)] overflow-x-hidden overflow-y-auto rounded-2xl p-4 sm:max-w-md sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold">Kupon lub kod rabatowy</DialogTitle>
          <DialogDescription>Wpisz kod klienta. Otworzy się nowe zamówienie z nabitym kuponem – możesz dodać kolejne pozycje. Kod zostanie wykorzystany dopiero po dodaniu zamówienia.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-xs font-semibold">Kod
            <input
              value={code}
              onChange={(event) => setCode(normalizeCodeInput(event.target.value))}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="np. 7F3A9C"
              maxLength={24}
              className="h-12 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-center font-mono text-xl font-bold uppercase tracking-[0.2em] outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <div aria-live="polite">
            {isLoading && <p className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />Sprawdzanie kodu…</p>}
            {error && !isLoading && <p className="rounded-lg bg-destructive/10 p-3 text-xs font-semibold text-destructive">{error.message}</p>}
            {preview && !isLoading && (
              <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-extrabold">{preview.reward}</p>
                  <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">{preview.code}</span>
                </div>
                <p className="rounded-lg bg-primary/10 p-2 text-sm font-bold text-primary">{describeCodeBenefit(preview)}</p>
                {preview.customer && <p className="flex items-center gap-1 border-t border-border pt-2 text-[11px] text-muted-foreground"><User className="size-3" aria-hidden="true" />{preview.customer}</p>}
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => changeOpen(false)}>Anuluj</Button>
            <Button type="submit" disabled={!preview || isLoading}>Przejdź do zamówienia<ArrowRight data-icon="inline-end" /></Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
