'use client'

import { Megaphone } from 'lucide-react'
import { SettingsCard } from './workshop-settings-layout'

/** Placeholder for sending general push notifications to customers of the installed app. Not active yet. */
export function WorkshopBroadcastPush() {
  return (
    <SettingsCard
      icon={Megaphone}
      title="Powiadomienia push Yummy Club"
      titleId="broadcast-push-title"
      iconClassName="bg-[#f1eee9] text-[#9b938b]"
      description="Wyślij powiadomienie do klientów, którzy zainstalowali aplikację Yummy Club i zgodzili się na powiadomienia."
      action={
        <span className="inline-flex h-7 items-center rounded-full bg-[#f1eee9] px-3 text-[11px] font-bold uppercase tracking-wide text-[#847c74]">
          Nieaktywne
        </span>
      }
    >
      <fieldset disabled aria-describedby="broadcast-push-note" className="flex flex-col gap-3 opacity-60">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#211e1b]">
          Tytuł
          <input type="text" placeholder="np. Burger tygodnia już jest!" className="h-10 rounded-xl border border-[#e5ded6] bg-[#fbf9f6] px-3 text-sm font-normal" />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#211e1b]">
          Treść
          <textarea rows={3} placeholder="Krótka wiadomość dla klientów" className="resize-none rounded-xl border border-[#e5ded6] bg-[#fbf9f6] px-3 py-2 text-sm font-normal" />
        </label>
        <button type="button" className="h-10 self-end rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">
          Wyślij powiadomienie
        </button>
      </fieldset>
      <p id="broadcast-push-note" className="mt-3 text-[12px] leading-relaxed text-[#847c74]">
        Funkcja w przygotowaniu – zostanie włączona w kolejnej aktualizacji.
      </p>
    </SettingsCard>
  )
}
