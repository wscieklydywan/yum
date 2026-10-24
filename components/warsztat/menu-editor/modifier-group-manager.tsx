'use client'

import { useState } from 'react'
import { ArrowLeft, Info, LoaderCircle, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { addButtonClass, cleanDecimal, dangerIconButtonClass, inputClass } from './form-styles'
import { groupSummary, stationLabels, type MenuStation, type MenuStructure, type SelectionMode, type WorkshopGroup } from './menu-types'
import { sendJson } from './use-menu-structure'
import { optionParts } from '@/lib/menu-config'

type OptionDraft = { id?: string; name: string; price: string; active: boolean; stations: MenuStation[] }

type GroupDraft = {
  id?: string
  name: string
  selection_mode: SelectionMode
  max: string
  station: MenuStation
  active: boolean
  options: OptionDraft[]
}

const emptyOption = (): OptionDraft => ({ name: '', price: '', active: true, stations: [] })

const partsOf = (draft: Pick<GroupDraft, 'id'>, name: string) => optionParts({ id: draft.id ?? '' }, name.trim() || '-')

/** Station of every part of an option, falling back to the group's station for parts without one. */
const resolvedStations = (draft: GroupDraft, option: OptionDraft) => partsOf(draft, option.name).map((_, index) => option.stations[index] ?? draft.station)

const toGroupDraft = (group: WorkshopGroup | null): GroupDraft => ({
  id: group?.id,
  name: group?.name ?? '',
  selection_mode: group?.selection_mode ?? 'multiple',
  max: group?.max_selections ? String(group.max_selections) : '',
  station: group?.station ?? 'cashier',
  active: group?.active ?? true,
  options: group?.options.map((option) => ({ id: option.id, name: option.name, price: String(option.price_delta), active: option.active, stations: option.stations ?? [] })) ?? [emptyOption()],
})

const selectionModes: { value: SelectionMode; title: string; hint: string }[] = [
  { value: 'single', title: 'Tylko jedną', hint: 'np. wybór napoju, rodzaj bułki' },
  { value: 'multiple', title: 'Kilka naraz', hint: 'np. sosy, dodatki do burgera' },
]

function Step({ number, title, hint, children }: { number: number; title: string; hint: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-[#ece6df] bg-white p-3.5">
    <div className="mb-3 flex gap-2.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-extrabold text-primary" aria-hidden="true">{number}</span>
      <div className="min-w-0">
        <h3 className="text-sm font-extrabold text-[#262220]">{title}</h3>
        <p className="mt-0.5 text-xs leading-snug text-[#7a726a]">{hint}</p>
      </div>
    </div>
    {children}
  </section>
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; title: string; hint?: string }[]; onChange: (value: T) => void }) {
  return <div role="group" aria-label={label} className="grid grid-cols-2 gap-2">
    {options.map((option) => {
      const selected = value === option.value
      return <button key={option.value} type="button" aria-pressed={selected} onClick={() => onChange(option.value)} className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-[#e5ded6] bg-white hover:bg-[#faf8f5]'}`}>
        <span className={`block text-sm font-bold ${selected ? 'text-primary' : 'text-[#262220]'}`}>{option.title}</span>
        {option.hint && <span className="mt-0.5 block text-[11px] leading-snug text-[#8b827a]">{option.hint}</span>}
      </button>
    })}
  </div>
}

export function ModifierGroupManager({ open, onOpenChange, structure, onChanged }: { open: boolean; onOpenChange: (open: boolean) => void; structure: MenuStructure; onChanged: () => Promise<unknown> }) {
  const [draft, setDraft] = useState<GroupDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDraft(null)
  }
  const usage = (id: string) => structure.assignments.filter((assignment) => assignment.group_id === id).length

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    try {
      await action()
      await onChanged()
      toast.success(success)
      setDraft(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Operacja nie powiodła się.')
    } finally {
      setBusy(false)
    }
  }

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!draft) return
    const options = draft.options.filter((option) => option.name.trim()).map((option) => ({ id: option.id, name: option.name.trim(), price_delta: Number(option.price) || 0, active: option.active, stations: resolvedStations(draft, option) }))
    if (options.length === 0) return void toast.error('Dodaj co najmniej jedną opcję do wyboru.')
    const payload = { id: draft.id, name: draft.name, selection_mode: draft.selection_mode, min_selections: 0, max_selections: draft.selection_mode === 'multiple' && draft.max ? Number(draft.max) : null, station: draft.station, active: draft.active, options }
    void run(() => sendJson('/api/workshop/menu/groups', draft.id ? 'PATCH' : 'POST', payload), draft.id ? 'Zapisano grupę' : 'Dodano grupę')
  }

  const patchOption = (index: number, value: Partial<OptionDraft>) => setDraft((current) => current && { ...current, options: current.options.map((option, i) => i === index ? { ...option, ...value } : option) })

  const togglePartStation = (index: number, part: number) => setDraft((current) => {
    if (!current) return current
    return { ...current, options: current.options.map((option, i) => {
      if (i !== index) return option
      const stations = resolvedStations(current, option)
      stations[part] = stations[part] === 'kitchen' ? 'cashier' : 'kitchen'
      return { ...option, stations }
    }) }
  })

  const setStationForAll = (station: MenuStation) => setDraft((current) => current && { ...current, station, options: current.options.map((option) => ({ ...option, stations: partsOf(current, option.name).map(() => station) })) })

  const stationOptions = (Object.keys(stationLabels) as MenuStation[]).map((station) => ({ value: station, title: stationLabels[station] }))
  const editingUsage = draft?.id ? usage(draft.id) : 0

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent data-ui-scale="large" className="flex max-h-[calc(92dvh/var(--ui-zoom,1))] w-[calc(100vw-1rem)] max-w-lg md:max-w-xl lg:max-w-2xl flex-col gap-0 overflow-hidden rounded-3xl border-[#e8e1d9] bg-[#f6f3ef] p-0">
      <DialogHeader className="border-b border-[#e8e1d9] bg-white px-4 py-3.5 text-left sm:px-5">
        <div className="flex items-center gap-2">
          {draft && <button type="button" aria-label="Wróć do listy grup" onClick={() => setDraft(null)} className="-ml-1 flex size-8 items-center justify-center rounded-lg hover:bg-[#f1ece6]"><ArrowLeft className="size-4" /></button>}
          <DialogTitle className="text-base font-extrabold">{draft ? draft.id ? 'Edytuj grupę dodatków' : 'Nowa grupa dodatków' : 'Grupy dodatków'}</DialogTitle>
        </div>
        <DialogDescription className="text-xs">
          {draft
            ? editingUsage ? `Ta grupa jest przypięta do ${editingUsage} poz. w menu – zmiany będą widoczne we wszystkich.` : 'Ta grupa nie jest jeszcze przypięta do żadnego dania.'
            : 'Listy rzeczy, które klient może dobrać do dania.'}
        </DialogDescription>
      </DialogHeader>

      {draft ? <form id="group-form" onSubmit={save} className="flex flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-5">
        <Step number={1} title="Nazwa grupy" hint="Klient zobaczy ją jako nagłówek przy daniu.">
          <label htmlFor="group-name" className="sr-only">Nazwa grupy</label>
          <input id="group-name" required maxLength={60} className={inputClass} placeholder="np. Wybierz sos" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </Step>

        <Step number={2} title="Ile klient może wybrać?" hint="Czy z tej listy wybiera się jedną rzecz, czy można zaznaczyć kilka.">
          <Segmented label="Ile klient może wybrać" value={draft.selection_mode} options={selectionModes} onChange={(selection_mode) => setDraft({ ...draft, selection_mode })} />
          {draft.selection_mode === 'multiple' && <div className="mt-3 flex items-center gap-3">
            <label htmlFor="group-max" className="flex-1 text-xs leading-snug text-[#5f5852]">Maksymalnie sztuk <span className="text-[#a39b92]">(puste = bez limitu)</span></label>
            <input id="group-max" inputMode="numeric" className={`${inputClass} w-24 text-center`} placeholder="bez limitu" value={draft.max} onChange={(event) => setDraft({ ...draft, max: event.target.value.replace(/\D/g, '') })} />
          </div>}
        </Step>

        <Step number={3} title="Co jest do wyboru" hint="Wpisz nazwę i dopłatę. Puste lub 0 oznacza, że opcja jest za darmo.">
          <div className="mb-1.5 flex items-center gap-1.5 pl-[22px] pr-12 text-[10px] font-bold uppercase tracking-wide text-[#a39b92]" aria-hidden="true">
            <span className="flex-1">Nazwa</span>
            <span className="w-24 text-center">Dopłata</span>
          </div>
          <ul className="flex flex-col gap-3">
            {draft.options.map((option, index) => {
              const parts = partsOf(draft, option.name)
              const stations = resolvedStations(draft, option)
              return <li key={option.id ?? `new-${index}`} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <input type="checkbox" aria-label={`Opcja ${index + 1} dostępna`} title={option.active ? 'Dostępna – odznacz, gdy się skończy' : 'Ukryta – zaznacz, by znów była dostępna'} checked={option.active} onChange={(event) => patchOption(index, { active: event.target.checked })} className="size-4 shrink-0 accent-primary" />
                  <input aria-label={`Opcja ${index + 1} – nazwa`} maxLength={40} className={`${inputClass} ${option.active ? '' : 'text-[#a39b92] line-through'}`} placeholder="np. Czosnkowy" value={option.name} onChange={(event) => patchOption(index, { name: event.target.value })} />
                  <div className="relative w-24 shrink-0">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#8b827a]">+</span>
                    <input aria-label={`Opcja ${index + 1} – dopłata`} inputMode="decimal" className={`${inputClass} pl-6 pr-7`} placeholder="0" value={option.price} onChange={(event) => patchOption(index, { price: cleanDecimal(event.target.value) })} />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#8b827a]">zł</span>
                  </div>
                  <button type="button" aria-label={`Usuń opcję ${option.name || index + 1}`} onClick={() => setDraft({ ...draft, options: draft.options.filter((_, i) => i !== index) })} className={dangerIconButtonClass}><X className="size-4" /></button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pl-[22px]">
                  <span className="text-[11px] text-[#8b827a]">Robi:</span>
                  {parts.map((part, partIndex) => {
                    const station = stations[partIndex]
                    const label = parts.length > 1 ? `${part}: ${stationLabels[station]}` : stationLabels[station]
                    return <button key={partIndex} type="button" onClick={() => togglePartStation(index, partIndex)} aria-label={`${parts.length > 1 ? part : option.name || `Opcja ${index + 1}`} – robi ${stationLabels[station]}, kliknij aby zmienić`} className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-bold transition-colors ${station === 'kitchen' ? 'bg-[#fbe7d6] text-[#9a4a12]' : 'bg-[#dde9f7] text-[#1f4f86]'}`}>{label}</button>
                  })}
                </div>
              </li>
            })}
          </ul>
          <button type="button" onClick={() => setDraft({ ...draft, options: [...draft.options, emptyOption()] })} className={addButtonClass}><Plus className="size-3.5" aria-hidden="true" />Dodaj opcję</button>
          <p className="mt-3 flex gap-2 rounded-xl bg-[#faf8f5] p-2.5 text-[11px] leading-snug text-[#7a726a]">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>Kwadracik po lewej ukrywa opcję przed klientami bez jej usuwania (np. gdy sos się skończy). Kolorowa plakietka „Robi” pokazuje, kto przygotowuje dodatek – kliknij ją, by zmienić.</span>
          </p>
        </Step>

        <Step number={4} title="Kto przygotowuje dodatki?" hint="U kogo dodatki z tej grupy pojawią się do odhaczenia. Kliknięcie ustawia to od razu dla wszystkich opcji.">
          <Segmented label="Kto przygotowuje dodatki" value={draft.station} options={stationOptions} onChange={setStationForAll} />
        </Step>

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[#ece6df] bg-white p-3.5">
          <span>
            <span className="block text-sm font-extrabold text-[#262220]">Widoczna dla klientów</span>
            <span className="mt-0.5 block text-xs leading-snug text-[#7a726a]">Wyłącz, żeby schować całą grupę ze wszystkich dań.</span>
          </span>
          <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} className="size-5 shrink-0 accent-primary" />
        </label>
      </form> : <div className="flex-1 overflow-y-auto p-3 sm:p-5">
        <div className="rounded-2xl border border-[#ece6df] bg-white p-3.5">
          <p className="text-sm font-extrabold text-[#262220]">Jak to działa?</p>
          <ol className="mt-2 flex flex-col gap-1.5 text-xs leading-snug text-[#5f5852]">
            <li><span className="font-bold text-primary">1.</span> Tworzysz grupę, np. „Sosy”, i wpisujesz, co jest do wyboru (z dopłatą lub za darmo).</li>
            <li><span className="font-bold text-primary">2.</span> W edytorze dania, w kroku „Co klient może dobrać”, przypinasz tę grupę.</li>
            <li><span className="font-bold text-primary">3.</span> Klient przy zamawianiu widzi listę i zaznacza, co chce. Jedną grupę możesz przypiąć do wielu dań.</li>
          </ol>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#7a726a]">Twoje grupy ({structure.groups.length})</p>
          <Button type="button" size="sm" onClick={() => { setDraft(toGroupDraft(null)); setConfirmDelete(false) }}><Plus className="size-4" aria-hidden="true" />Nowa grupa</Button>
        </div>
        <ul className="mt-2 overflow-hidden rounded-2xl border border-[#e8e1d9] bg-white">
          {structure.groups.map((group, index) => {
            const used = usage(group.id)
            return <li key={group.id} className={index ? 'border-t border-[#f0ece7]' : ''}>
              <button type="button" onClick={() => { setDraft(toGroupDraft(group)); setConfirmDelete(false) }} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[#faf8f5]">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#262220]">{group.name}{!group.active && <span className="ml-1.5 rounded bg-[#f1ece6] px-1.5 py-0.5 text-[10px] font-semibold text-[#8b827a]">ukryta</span>}</p>
                  <p className="truncate text-[11px] text-[#8b827a]">{groupSummary(group)} · robi {stationLabels[group.station]} · {used ? `w ${used} poz.` : 'nieprzypięta'}</p>
                </div>
                <Pencil className="size-3.5 shrink-0 text-[#8b827a]" aria-hidden="true" />
              </button>
            </li>
          })}
          {structure.groups.length === 0 && <li className="p-4 text-sm text-[#817970]">Nie masz jeszcze żadnej grupy. Kliknij „Nowa grupa”, żeby zacząć.</li>}
        </ul>
      </div>}

      {draft && <div className="flex items-center gap-2 border-t border-[#e8e1d9] bg-white px-3 py-3 sm:px-5">
        {draft.id && (confirmDelete
          ? <>
            <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void run(() => sendJson('/api/workshop/menu/groups', 'DELETE', { id: draft.id }), 'Usunięto grupę')}>{editingUsage ? `Usuń i odepnij z ${editingUsage} poz.` : 'Tak, usuń'}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Anuluj</Button>
          </>
          : <Button type="button" size="icon" variant="ghost" aria-label="Usuń grupę" className="text-[#8b827a] hover:text-red-600" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" /></Button>)}
        <Button type="submit" form="group-form" size="sm" className="ml-auto" disabled={busy}>{busy && <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />}Zapisz grupę</Button>
      </div>}
    </DialogContent>
  </Dialog>
}
