'use client'

import type { Dispatch, SetStateAction } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { formatMoney, paymentLabels, type PaymentMethod, type PaymentPart } from '@/lib/fiscal-receipt'
import { applyKey, NumericKeypad, parseZlotyToGrosze, paymentIcons, paymentMethods, tapHandlers, useIsTabletOrDesktop } from './workshop-print-dialog'

/**
 * Split bill state. The cashier types amounts for every method except the last one,
 * which always takes what is left – so the parts can never add up to the wrong total.
 */
export type SplitState = { methods: PaymentMethod[]; amounts: Partial<Record<PaymentMethod, string>>; active: PaymentMethod }

export function createSplit(first: PaymentMethod): SplitState {
  const second = paymentMethods.find((method) => method !== first) ?? 'card'
  return { methods: [first, second], amounts: {}, active: first }
}

export function resolveSplit(state: SplitState, total: number) {
  if (state.methods.length < 2) return { parts: null, rest: state.methods[0], remainder: total, problem: 'Wybierz co najmniej dwie formy płatności.' }
  const typed = state.methods.slice(0, -1).map((method) => ({ method, amount: parseZlotyToGrosze(state.amounts[method] ?? '') }))
  const rest = state.methods[state.methods.length - 1]
  const remainder = total - typed.reduce((sum, part) => sum + (Number.isFinite(part.amount) ? part.amount : 0), 0)
  const missing = typed.find((part) => !Number.isFinite(part.amount) || part.amount <= 0)
  const parts: PaymentPart[] | null = !missing && remainder > 0 ? [...typed, { method: rest, amount: remainder }] : null
  const problem = missing ? `Wpisz kwotę: ${paymentLabels[missing.method]}.` : remainder <= 0 ? `Kwoty przekraczają rachunek — na „${paymentLabels[rest]}” musi coś zostać.` : null
  return { parts, rest, remainder, problem }
}

type SplitProps = { total: number; value: SplitState; onChange: Dispatch<SetStateAction<SplitState>> }

/** Method chips + one row per part. On phones the rows are regular decimal inputs; on tablets they are fed by <SplitKeypad>. */
export function SplitEditor({ total, value, onChange }: SplitProps) {
  const showKeypad = useIsTabletOrDesktop()
  const { remainder, rest, problem } = resolveSplit(value, total)

  function toggle(method: PaymentMethod) {
    onChange((state) => {
      // Methods can all be unticked first and picked again – the split is only valid with two or more.
      if (state.methods.includes(method)) {
        const methods = state.methods.filter((item) => item !== method)
        const typed = methods.slice(0, -1)
        return { ...state, methods, active: typed.includes(state.active) ? state.active : typed[0] ?? methods[0] ?? state.active }
      }
      if (state.methods.length === 0) return { ...state, methods: [method], active: method }
      // The new method takes the remainder; the previous "reszta" becomes a typed part.
      const previousRest = state.methods[state.methods.length - 1]
      return { ...state, methods: [...state.methods, method], amounts: { ...state.amounts, [previousRest]: '' }, active: previousRest }
    })
  }

  /** Tapping the auto row makes it the typed one – the cashier always types the amount they know. */
  function swapWithRest() {
    onChange((state) => {
      const methods = [...state.methods]
      const index = methods.indexOf(state.active)
      const last = methods.length - 1
      ;[methods[index], methods[last]] = [methods[last], methods[index]]
      return { ...state, methods, active: methods[index], amounts: { ...state.amounts, [methods[index]]: '' } }
    })
  }

  function half() {
    onChange((state) => ({ ...state, active: state.methods[0], amounts: { ...state.amounts, [state.methods[0]]: formatMoney(Math.ceil(total / 2)) } }))
  }

  return <div className="flex flex-col gap-3">
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Czym płaci klient</legend>
      <div className="grid grid-cols-3 gap-2">
        {paymentMethods.map((method) => {
          const Icon = paymentIcons[method]
          const selected = value.methods.includes(method)
          return <button key={method} type="button" aria-pressed={selected} onClick={() => toggle(method)}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{paymentLabels[method]}</span>
          </button>
        })}
      </div>
    </fieldset>

    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
      {value.methods.length >= 2 && value.methods.map((method) => {
        const Icon = paymentIcons[method]
        const isRest = method === rest
        const active = !isRest && value.active === method
        return <div key={method} className={`flex min-h-14 items-center gap-2.5 rounded-lg border bg-white px-3 transition-colors ${active ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'}`}>
          <Icon className="size-5 shrink-0 text-slate-600" aria-hidden="true" />
          <span className="min-w-0 truncate text-sm font-semibold text-slate-900">{paymentLabels[method]}</span>
          {isRest ? <button type="button" onClick={swapWithRest} className="ml-auto flex min-w-0 flex-col items-end rounded-md px-1 py-1 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500" aria-label={`${paymentLabels[method]}: reszta ${formatMoney(Math.max(remainder, 0))} zł. Dotknij, żeby wpisać tę kwotę ręcznie.`}>
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Reszta auto <ArrowLeftRight className="size-3" aria-hidden="true" /></span>
            <span className={`text-xl font-black tabular-nums ${remainder > 0 ? 'text-slate-900' : 'text-red-700'}`}>{formatMoney(Math.max(remainder, 0))} zł</span>
          </button> : <div className="relative ml-auto w-32 shrink-0">
            <input value={value.amounts[method] ?? ''} inputMode={showKeypad ? 'none' : 'decimal'} placeholder="0,00" aria-label={`Kwota: ${paymentLabels[method]}`}
              onFocus={() => onChange((state) => (state.active === method ? state : { ...state, active: method }))}
              onChange={(event) => { const next = event.target.value.replace(/[^\d.,]/g, ''); onChange((state) => ({ ...state, amounts: { ...state.amounts, [method]: next } })) }}
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-2 pr-8 text-right text-xl font-black tabular-nums text-slate-900 outline-none placeholder:font-semibold placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-slate-500" />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">zł</span>
          </div>}
        </div>
      })}
      <div className="flex items-center justify-between gap-2 px-1">
        <p role="status" className={`min-w-0 text-xs ${problem ? 'font-semibold text-red-700' : 'text-slate-500'}`}>{problem ?? 'Wpisz kwotę jednej formy — reszta wyliczy się sama.'}</p>
        {value.methods.length === 2 && <button type="button" onClick={half} className="h-9 shrink-0 rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 hover:bg-slate-100">Pół na pół</button>}
      </div>
    </div>
  </div>
}

/** Tablet/desktop keypad that types into the highlighted split row. Same pointer-down handling as the cash keypad. */
export function SplitKeypad({ value, onChange, tall = false }: Omit<SplitProps, 'total'> & { tall?: boolean }) {
  const press = (key: string) => onChange((state) => ({ ...state, amounts: { ...state.amounts, [state.active]: applyKey(state.amounts[state.active] ?? '', key) } }))
  const clear = () => onChange((state) => ({ ...state, amounts: { ...state.amounts, [state.active]: '' } }))
  const typed = value.methods.slice(0, -1)
  if (value.methods.length < 2) return <div className="hidden h-full min-h-40 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center text-sm font-medium text-muted-foreground md:flex">
    Zaznacz co najmniej dwie formy płatności.
  </div>
  return <div className={`hidden flex-col gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 md:flex ${tall ? 'h-full min-h-0' : ''}`}>
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-semibold text-slate-700">Wpisujesz: <span className="text-slate-900">{paymentLabels[value.active]}</span></p>
      <button type="button" {...tapHandlers(clear)} className="h-8 touch-manipulation select-none rounded-md px-2 text-xs font-semibold text-slate-600 [-webkit-tap-highlight-color:transparent] hover:bg-slate-200">Wyczyść</button>
    </div>
    {typed.length > 1 && <div className="grid grid-cols-2 gap-1.5">
      {typed.map((method) => <button key={method} type="button" aria-pressed={value.active === method} {...tapHandlers(() => onChange((state) => ({ ...state, active: method })))}
        className={`h-9 touch-manipulation select-none rounded-md border text-xs font-bold [-webkit-tap-highlight-color:transparent] ${value.active === method ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-800'}`}>{paymentLabels[method]}</button>)}
    </div>}
    <NumericKeypad onKey={press} tall={tall} className={tall ? 'min-h-0 flex-1' : ''} />
  </div>
}
