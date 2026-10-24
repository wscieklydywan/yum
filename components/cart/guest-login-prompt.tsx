'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export async function fetchSignedIn() {
  const { data } = await createClient().auth.getSession()
  return Boolean(data.session)
}

export function GuestLoginPrompt() {
  const { data: signedIn } = useSWR('cart-signed-in', fetchSignedIn, { revalidateOnFocus: true })
  const [skipped, setSkipped] = useState(false)

  if (signedIn !== false || skipped) return null

  return (
    <section aria-labelledby="guest-login-title" className="cart-note-open rounded-2xl bg-card p-3.5 ring-1 ring-border">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Star className="size-4 fill-current" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id="guest-login-title" className="text-sm font-extrabold leading-tight">Zaloguj się do Yummy Club</h3>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Zbieraj punkty za to zamówienie i śledź je w historii zamówień. Koszyk zostanie zapisany.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Link
          href="/yummy-club"
          className="flex h-9 flex-1 items-center justify-center rounded-lg bg-primary px-3 text-[13px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Zaloguj się
        </Link>
        <button
          type="button"
          onClick={() => setSkipped(true)}
          className="h-9 flex-1 rounded-lg px-3 text-[13px] font-semibold text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted hover:text-foreground"
        >
          Pomiń
        </button>
      </div>
    </section>
  )
}
