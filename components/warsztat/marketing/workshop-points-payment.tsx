'use client'

import { useState, type FormEvent } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { toast } from 'sonner'
import { HandCoins, Loader2, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/marketing'
import { formatPercent, formatStarMoney, spendPerStar, STAR_VALUE_KEY } from '@/lib/loyalty-economics'
import { useStarCost } from './use-star-cost'
import {
  MAX_POINTS_PAYMENT_VALUE,
  WORKSHOP_POINTS_PAYMENT_KEY,
  maxUsablePoints,
  pointsDiscountValue,
  type PointsPaymentSettings,
} from '@/lib/points-payment'
import { useLoyaltyRate } from '../workshop-club-tools'
import { cleanDecimal, inputClass, labelClass } from '../menu-editor/form-styles'
import { EconomicsNote, fetchJson, Metric } from './economics-parts'
import { TabIntro } from './help-parts'

type Draft = { enabled: boolean; value: string; maxPercent: string; earnsRest: boolean }

const EXAMPLE_ORDER = 80

const toDraft = (settings: PointsPaymentSettings): Draft => ({
  enabled: settings.enabled,
  value: String(settings.value).replace('.', ','),
  maxPercent: String(settings.maxPercent),
  earnsRest: settings.earnsRest !== false,
})

const parse = (draft: Draft): PointsPaymentSettings => ({
  enabled: draft.enabled,
  value: Math.round(Number(draft.value.replace(',', '.')) * 100) / 100,
  maxPercent: Number(draft.maxPercent),
  earnsRest: draft.earnsRest,
})

const isValid = (settings: PointsPaymentSettings) =>
  settings.value > 0 && settings.value <= MAX_POINTS_PAYMENT_VALUE && Number.isInteger(settings.maxPercent) && settings.maxPercent >= 1 && settings.maxPercent <= 100

export function WorkshopPointsPayment() {
  const { data, error, isLoading, mutate } = useSWR<PointsPaymentSettings>(WORKSHOP_POINTS_PAYMENT_KEY, fetchJson)
  const { data: rateData } = useLoyaltyRate()
  const { data: star } = useStarCost()
  const catalogValue = star?.catalogValue ?? 0
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  if (error) return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:p-4">{error.message}</p>
  if (isLoading || !data) return <div className="flex justify-center p-10"><Loader2 className="size-6 animate-spin text-primary" aria-label="Wczytywanie" /></div>

  const current = draft ?? toDraft(data)
  const preview = parse(current)
  const valid = isValid(preview)
  const dirty = draft !== null
  const zlPerStar = rateData?.rate ? spendPerStar(rateData.rate) : null
  const returnPercent = zlPerStar && Number.isFinite(zlPerStar) && valid ? (preview.value / zlPerStar) * 100 : null
  const examplePoints = valid ? maxUsablePoints(EXAMPLE_ORDER, { ...preview, enabled: true }) : 0
  const exampleDiscount = pointsDiscountValue(examplePoints, preview)
  const update = (patch: Partial<Draft>) => setDraft({ ...current, ...patch })

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!valid) {
      toast.error(`Wartość 1 Star: 0,01–${MAX_POINTS_PAYMENT_VALUE} zł, limit 1–100%.`)
      return
    }
    setSaving(true)
    try {
      const response = await fetch(WORKSHOP_POINTS_PAYMENT_KEY, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preview),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error ?? 'Nie udało się zapisać.')
      await mutate(result, { revalidate: false })
      globalMutate(STAR_VALUE_KEY)
      setDraft(null)
      toast.success(result.enabled ? 'Płacenie Stars włączone' : 'Zapisano – płacenie Stars wyłączone')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Nie udało się zapisać.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <TabIntro
        icon={HandCoins}
        title="Płacenie punktami"
        lead="Klient Yummy Club może w koszyku użyć swoich Stars, żeby obniżyć cenę zamówienia. Tu ustalasz, ile złotych jest wart 1 Star."
        steps={[
          'Włącz płacenie Stars przełącznikiem poniżej.',
          'Wpisz, o ile złotych 1 Star obniża paragon (np. 1 Star = 0,08 zł).',
          'Opcjonalnie ogranicz, jaką część zamówienia można opłacić Stars, i kliknij „Zapisz”.',
        ]}
      />

      <section aria-labelledby="pp-settings" className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4">
        <h2 id="pp-settings" className="sr-only">Ustawienia</h2>
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="min-w-0">
            <span className="block text-sm font-bold text-zinc-900">Płacenie Stars w koszyku</span>
            <span className="block text-xs text-zinc-500">
              {current.enabled ? 'Włączone – klienci widzą opcję „Użyj Stars” w koszyku.' : 'Wyłączone – opcja jest ukryta przed klientami.'}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={current.enabled}
            onChange={(event) => update({ enabled: event.target.checked })}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className={cn(
              'relative h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2',
              current.enabled ? 'bg-primary' : 'bg-zinc-300',
            )}
          >
            <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform', current.enabled ? 'translate-x-5' : 'translate-x-0.5')} />
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pp-value" className={labelClass}>1 Star obniża paragon o (zł)</label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm font-semibold text-zinc-600">1 Star =</span>
              <input
                id="pp-value"
                inputMode="decimal"
                value={current.value}
                onChange={(event) => update({ value: cleanDecimal(event.target.value).replace('.', ',') })}
                className={inputClass}
                required
              />
              <span className="shrink-0 text-sm font-semibold text-zinc-600">zł</span>
            </div>
            {catalogValue > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                <span>{`Zalecane: ${formatStarMoney(catalogValue)} – tyle 1 Star jest wart w katalogu nagród.`}</span>
                <button type="button" onClick={() => update({ value: String(Math.max(0.01, Math.round(catalogValue * 100) / 100)).replace('.', ',') })} className="font-bold text-primary underline-offset-2 hover:underline">Ustaw</button>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="pp-max" className={labelClass}>Maks. część zamówienia opłacona Stars</label>
            <div className="flex items-center gap-2">
              <input
                id="pp-max"
                inputMode="numeric"
                value={current.maxPercent}
                onChange={(event) => update({ maxPercent: event.target.value.replace(/\D/g, '').slice(0, 3) })}
                className={inputClass}
                required
              />
              <span className="shrink-0 text-sm font-semibold text-zinc-600">%</span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">100% = klient może opłacić Stars całe zamówienie (bez dostawy).</p>
          </div>
        </div>

        <div className="border-t border-zinc-100 pt-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-sm font-bold text-zinc-900">Naliczaj Stars za kwotę, która zostaje do zapłaty</span>
              <span className="block text-xs text-zinc-500 text-pretty">
                {current.earnsRest
                  ? 'Tak – np. paragon 150 zł, Stars obniżają o 100 zł, klient płaci 50 zł i dostaje Stars za te 50 zł.'
                  : 'Nie – gdy klient użyje Stars, za całe to zamówienie nie dostaje nowych Stars (także za resztę dopłaconą gotówką/kartą).'}
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={current.earnsRest}
              onChange={(event) => update({ earnsRest: event.target.checked })}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2',
                current.earnsRest ? 'bg-primary' : 'bg-zinc-300',
              )}
            >
              <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform', current.earnsRest ? 'translate-x-5' : 'translate-x-0.5')} />
            </span>
          </label>
          <p className="mt-2 text-[11px] text-zinc-500">Ustawienie dotyczy nowych zamówień – już złożone zachowują zasadę z chwili zamówienia.</p>
        </div>
      </section>

      <section aria-labelledby="pp-summary" className="flex flex-col gap-3">
        <h2 id="pp-summary" className="text-base font-black text-zinc-900">Co to oznacza?</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Metric label="Wartość 1 Star" value={valid ? formatMoney(preview.value) : '—'} hint="Tyle schodzi z paragonu za 1 Star" />
          <Metric
            label="Zwrot dla klienta"
            value={returnPercent !== null ? formatPercent(returnPercent) : '—'}
            tone={returnPercent === null ? 'default' : returnPercent <= 5 ? 'good' : returnPercent <= 10 ? 'warn' : 'bad'}
            hint={zlPerStar && Number.isFinite(zlPerStar) ? `Klient zbiera 1 Star za ${formatMoney(zlPerStar)}` : 'Wczytywanie przelicznika…'}
          />
          <Metric
            label={`Przykład: zamówienie ${formatMoney(EXAMPLE_ORDER)}`}
            value={valid ? `−${formatMoney(exampleDiscount)}` : '—'}
            hint={valid ? `Maks. ${examplePoints} Stars w tym zamówieniu` : 'Wpisz poprawne wartości'}
          />
        </div>
        {valid && catalogValue > 0 && preview.value > catalogValue * 1.05 && (
          <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold leading-relaxed text-amber-900 text-pretty">
            {`Uwaga: tu 1 Star = ${formatStarMoney(preview.value)}, a w katalogu nagród 1 Star = ${formatStarMoney(catalogValue)}. Klienci wybiorą płacenie Stars, bo daje ${Math.round(preview.value / catalogValue)}× więcej. Po włączeniu właśnie ta wartość wyznacza koszt 1 Star w całym panelu (koło, gra, budżet).`}
          </p>
        )}
        <EconomicsNote>
          <p>
            Stars odejmujemy od salda klienta w chwili złożenia zamówienia. Gdy zamówienie zostanie anulowane, Stars wracają na konto automatycznie. Kwota opłacona Stars nigdy nie nalicza nowych Stars i jest widoczna na zamówieniu jako rabat. {current.earnsRest ? 'Reszta dopłacona przez klienta nalicza Stars normalnie.' : 'Reszta dopłacona przez klienta też nie nalicza Stars.'}
          </p>
        </EconomicsNote>
      </section>

      <div className="sticky bottom-3 z-10 flex justify-end">
        <button
          type="submit"
          disabled={saving || !dirty}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          Zapisz ustawienia
        </button>
      </div>
    </form>
  )
}
