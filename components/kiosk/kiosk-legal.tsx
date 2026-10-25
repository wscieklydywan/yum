'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { LegalDocuments } from '@/components/legal/legal-documents'
import type { LegalSlug } from '@/lib/legal'

export function KioskLegalNote() {
  const [tab, setTab] = useState<LegalSlug | null>(null)

  return (
    <>
      <p className="text-center text-sm text-muted-foreground">
        Składając zamówienie, akceptujesz{' '}
        <button type="button" onClick={() => setTab('regulamin')} className="font-semibold text-foreground underline underline-offset-4">
          Regulamin
        </button>{' '}
        i{' '}
        <button type="button" onClick={() => setTab('polityka-prywatnosci')} className="font-semibold text-foreground underline underline-offset-4">
          Politykę prywatności
        </button>
        .
      </p>

      <Dialog open={tab !== null} onOpenChange={(open) => !open && setTab(null)}>
        <DialogContent data-keep-size className="flex h-[88dvh] max-w-3xl flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-3xl">
          <div className="shrink-0 px-6 pb-3 pt-6">
            <DialogTitle className="text-2xl font-black">Regulaminy i prywatność</DialogTitle>
            <DialogDescription className="sr-only">Wybierz zakładkę, aby przeczytać dokument.</DialogDescription>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 pb-6">
            {tab && <LegalDocuments initialTab={tab} size="large" />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
