'use client'

import { useState } from 'react'
import { ArrowLeft, LoaderCircle, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { addButtonClass, cleanDecimal, dangerIconButtonClass, inputClass, labelClass } from './form-styles'
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
  options: group?.options.map((option) => ({ id: option.id, name: option.name, price: String(option.price_delta), active: option.active, stations: option.stations ?? [] })) ?? [{ name: '', price: '', active: true, stations: [] }],
})

export function ModifierGroupManager({ open, onOpenChange, structure, onChanged }: { open: boolean; onOpenChange: (open: boolean) => void; structure: MenuStructure; onChanged: () => Promise<unknown> }) {
  const [draft, setDraft] = useState<GroupDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
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
    if (options.length === 0) return void toast.error('Dodaj co najmniej jedną opcję.')
    const payload = { id: draft.id, name: draft.name, selection_mode: draft.selection_mode, min_selections: 0, max_selections: draft.max ? Number(draft.max) : null, station: draft.station, active: draft.active, options }
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

  const applyGroupStationToAll = (station: MenuStation) => setDraft((current) => current && { ...current, station, options: current.options.map((option) => ({ ...option, stations: partsOf(current, option.name).map(() => station) })) })

  return <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) setDraft(null) }}>
    <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-3xl border-[#e8e1d9] bg-[#f6f3ef] p-0">
      <DialogHeader className="border-b border-[#e8e1d9] bg-white px-4 py-3.5 text-left sm:px-5">
        <div className="flex items-center gap-2">
          {draft && <button type="button" aria-label="Wróć do listy grup" onClick={() => setDraft(null)} className="-ml-1 flex size-8 items-center justify-center rounded-lg hover:bg-[#f1ece6]"><ArrowLeft className="size-4" /></button>}
          <DialogTitle className="text-base font-extrabold">{draft ? draft.id ? 'Edytuj grupę' : 'Nowa grupa dodatków' : 'Grupy dodatków'}</DialogTitle>
        </div>
        <DialogDescription className="text-xs">{draft ? 'Zmiany dotyczą wszystkich pozycji, do których grupa jest przypięta.' : 'Np. sosy, dodatki do burgera, wybór napoju. Przypinasz je do pozycji w edytorze.'}</DialogDescription>
      </DialogHeader>

      {draft ? <form id="group-form" onSubmit={save} className="flex-1 overflow-y-auto p-3 sm:p-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-[#ece6df] bg-white p-3.5">
          <div><label htmlFor="group-name" className={labelClass}>Nazwa grupy</label><input id="group-name" required maxLength={60} className={inputClass} placeholder="np. Sosy" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div>
          <div>
            <p className={labelClass}>Sposób wyboru</p>
            <div role="group" aria-label="Sposób wyboru" className="grid grid-cols-2 gap-1 rounded-lg bg-[#eae5de] p-1">
              {(['single', 'multiple'] as const).map((mode) => <button key={mode} type="button" aria-pressed={draft.selection_mode === mode} onClick={() => setDraft({ ...draft, selection_mode: mode })} className={`h-8 rounded-md text-xs font-bold transition-colors ${draft.selection_mode === mode ? 'bg-white text-[#211e1b] shadow-sm' : 'text-[#706961]'}`}>{mode === 'single' ? 'Jedna opcja' : 'Kilka opcji'}</button>)}
            </div>
          </div>
          <div>
            <p className={labelClass}>Domyślne stanowisko</p>
            <div role="group" aria-label="Domyślne stanowisko" className="grid grid-cols-2 gap-1 rounded-lg bg-[#eae5de] p-1">
              {(Object.keys(stationLabels) as MenuStation[]).map((station) => <button key={station} type="button" aria-pressed={draft.station === station} onClick={() => setDraft({ ...draft, station })} className={`h-8 rounded-md text-xs font-bold transition-colors ${draft.station === station ? 'bg-white text-[#211e1b] shadow-sm' : 'text-[#706961]'}`}>{stationLabels[station]}</button>)}
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-[#8b827a]">Dla nowych opcji. Stanowisko każdej opcji ustawiasz niżej – to ono decyduje, gdzie dodatek jest odhaczany.{' '}
              <button type="button" onClick={() => applyGroupStationToAll(draft.station)} className="font-bold text-primary underline-offset-2 hover:underline">Ustaw dla wszystkich opcji</button>
            </p>
          </div>
          {draft.selection_mode === 'multiple' && <div><label htmlFor="group-max" className={labelClass}>Maks. wyborów (domyślnie)</label><input id="group-max" inputMode="numeric" className={inputClass} placeholder="bez limitu" value={draft.max} onChange={(event) => setDraft({ ...draft, max: event.target.value.replace(/\D/g, '') })} /></div>}
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-[#faf8f5] px-3 py-2.5">
            <span className="text-sm font-semibold text-[#262220]">Grupa aktywna</span>
            <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} className="size-5 accent-primary" />
          </label>
        </div>

        <div className="mt-3 rounded-2xl border border-[#ece6df] bg-white p-3.5">
          <p className={labelClass}>Opcje, dopłaty i stanowiska</p>
          <ul className="flex flex-col gap-3">
            {draft.options.map((option, index) => {
              const parts = partsOf(draft, option.name)
              const stations = resolvedStations(draft, option)
              return <li key={option.id ?? `new-${index}`} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
              <input type="checkbox" aria-label={`Opcja ${index + 1} aktywna`} checked={option.active} onChange={(event) => patchOption(index, { active: event.target.checked })} className="size-4 shrink-0 accent-primary" />
              <input aria-label={`Opcja ${index + 1} – nazwa`} maxLength={80} className={`${inputClass} ${option.active ? '' : 'text-[#a39b92]'}`} placeholder="np. Czosnkowy" value={option.name} onChange={(event) => patchOption(index, { name: event.target.value })} />
              <div className="relative w-24 shrink-0">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#8b827a]">+</span>
                <input aria-label={`Opcja ${index + 1} – dopłata`} inputMode="decimal" className={`${inputClass} pl-6 pr-7`} placeholder="0" value={option.price} onChange={(event) => patchOption(index, { price: cleanDecimal(event.target.value) })} />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#8b827a]">zł</span>
              </div>
              <button type="button" aria-label="Usuń opcję" onClick={() => setDraft({ ...draft, options: draft.options.filter((_, i) => i !== index) })} className={dangerIconButtonClass}><X className="size-4" /></button>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-[22px]">
                {parts.map((part, partIndex) => {
                  const station = stations[partIndex]
                  const label = parts.length > 1 ? `${part}: ${stationLabels[station]}` : stationLabels[station]
                  return <button key={partIndex} type="button" onClick={() => togglePartStation(index, partIndex)} aria-label={`${parts.length > 1 ? part : option.name || `Opcja ${index + 1}`} – stanowisko ${stationLabels[station]}, kliknij aby zmienić`} className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-bold transition-colors ${station === 'kitchen' ? 'bg-[#fbe7d6] text-[#9a4a12]' : 'bg-[#dde9f7] text-[#1f4f86]'}`}>{label}</button>
                })}
              </div>
            </li>})}
          </ul>
          <button type="button" onClick={() => setDraft({ ...draft, options: [...draft.options, { name: '', price: '', active: true, stations: [] }] })} className={addButtonClass}><Plus className="size-3.5" aria-hidden="true" />Dodaj opcję</button>
        </div>
      </form> : <div className="flex-1 overflow-y-auto p-3 sm:p-5">
        <Button type="button" size="sm" onClick={() => { setDraft(toGroupDraft(null)); setConfirmDelete(false) }}><Plus className="size-4" aria-hidden="true" />Nowa grupa</Button>
        <ul className="mt-3 overflow-hidden rounded-2xl border border-[#e8e1d9] bg-white">
          {structure.groups.map((group, index) => <li key={group.id} className={index ? 'border-t border-[#f0ece7]' : ''}>
            <button type="button" onClick={() => { setDraft(toGroupDraft(group)); setConfirmDelete(false) }} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[#faf8f5]">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#262220]">{group.name}{!group.active && <span className="ml-1.5 text-[10px] font-semibold text-[#a39b92]">wyłączona</span>}</p>
                <p className="truncate text-[11px] text-[#8b827a]">{stationLabels[group.station]} · {groupSummary(group)} · w {usage(group.id)} poz.</p>
              </div>
              <Pencil className="size-3.5 shrink-0 text-[#8b827a]" aria-hidden="true" />
            </button>
          </li>)}
          {structure.groups.length === 0 && <li className="p-4 text-sm text-[#817970]">Brak grup dodatków.</li>}
        </ul>
      </div>}

      {draft && <div className="flex items-center gap-2 border-t border-[#e8e1d9] bg-white px-3 py-3 sm:px-5">
        {draft.id && (confirmDelete
          ? <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void run(() => sendJson('/api/workshop/menu/groups', 'DELETE', { id: draft.id }), 'Usunięto grupę')}>Usuń {usage(draft.id) ? `(odepnie z ${usage(draft.id)} poz.)` : ''}</Button>
          : <Button type="button" size="icon" variant="ghost" aria-label="Usuń grupę" className="text-[#8b827a] hover:text-red-600" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" /></Button>)}
        <Button type="submit" form="group-form" size="sm" className="ml-auto" disabled={busy}>{busy && <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />}Zapisz grupę</Button>
      </div>}
    </DialogContent>
  </Dialog>
}
