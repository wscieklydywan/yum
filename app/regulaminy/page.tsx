import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Logo } from '@/components/yummy/logo'
import { LegalDocuments } from '@/components/legal/legal-documents'
import { isLegalSlug } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Regulaminy i polityka prywatności',
  description: 'Regulamin zamówień, regulamin Yummy Club i kodów rabatowych, polityka prywatności oraz klauzula RODO restauracji Yummy Rybnik.',
  alternates: { canonical: '/regulaminy' },
}

export default async function LegalPage({ searchParams }: { searchParams: Promise<{ dokument?: string }> }) {
  const { dokument } = await searchParams
  const initialTab = isLegalSlug(dokument) ? dokument : 'regulamin'

  return (
    <div className="min-h-dvh bg-cream">
      <header className="relative mx-auto flex h-16 w-full max-w-3xl items-center px-4 sm:h-20 sm:px-6">
        <Link
          href="/"
          aria-label="Wróć na stronę główną"
          className="grid size-9 place-items-center rounded-full bg-card shadow-sm ring-1 ring-border transition-colors hover:bg-muted sm:size-11"
        >
          <ChevronLeft className="size-4 sm:size-5" aria-hidden="true" />
        </Link>
        <Link href="/" aria-label="Yummy – strona główna" className="absolute left-1/2 -translate-x-1/2">
          <Logo priority className="h-9 sm:h-11" />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-12 sm:px-6">
        <h1 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">Regulaminy i prywatność</h1>
        <div className="rounded-3xl bg-background p-4 shadow-sm ring-1 ring-border sm:p-8">
          <LegalDocuments initialTab={initialTab} syncUrl />
        </div>
      </main>
    </div>
  )
}
