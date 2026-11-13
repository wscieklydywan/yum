'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Star, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export async function fetchSignedIn() {
  const { data } = await createClient().auth.getSession()
  return Boolean(data.session)
}

/** Discreet club teaser for guests. Pass `guest` from the cart perks so it follows the same session check as the discounts. */
export function GuestLoginPrompt({ guest, className }: { guest?: boolean; className?: string }) {
  const { data: signedIn } = useSWR(guest === undefined ? 'cart-signed-in' : null, fetchSignedIn, { revalidateOnFocus: true })
  const [skipped, setSkipped] = useState(false)
  const isGuest = guest ?? signedIn === false

  if (!isGuest || skipped) return null

  return (
    <section aria-labelledby="guest-login-title" className={cn('cart-note-open flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border', className)}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Star className="size-3.5 fill-current" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 id="guest-login-title" className="text-[13px] font-extrabold leading-tight">Poznaj Yummy Club!</h3>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          Zbieraj punkty za zamówienia i zdobywaj stałe rabaty oraz dodatkowe korzyści.
        </p>
        <Link href="/yummy-club" className="mt-1 inline-block text-[11px] font-bold text-primary underline-offset-2 hover:underline">
          Dołącz do klubu
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setSkipped(true)}
        aria-label="Ukryj baner Yummy Club"
        className="grid size-7 shrink-0 place-items-center self-start rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </section>
  )
}
