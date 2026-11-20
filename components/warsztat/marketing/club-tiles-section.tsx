'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Pencil, Plus, Smartphone, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MenuImageCropper } from '@/components/warsztat/menu-editor/menu-image-cropper'
import { cn } from '@/lib/utils'
import { isSafeSlideHref, type ClubFeedId } from '@/lib/home-slides'
import {
  BUILTIN_CLUB_TILE_LABELS,
  CLUB_TILE_IMAGE_ASPECT,
  CLUB_TILE_THEME_LABELS,
  CLUB_TILE_THEMES,
  customTileIdFromKey,
  customTileKey,
  isBuiltinClubTile,
  MAX_CUSTOM_CLUB_TILES,
  TILE_LIMITS,
  type BuiltinClubTileId,
  type ClubTileKey,
  type ClubTileOverride,
  type ClubTilesConfig,
  type ClubTileTheme,
  type CustomClubTile,
} from '@/lib/club-tiles'

const BUILTIN_DEFAULTS: Record<BuiltinClubTileId, { eyebrow: string; title: string; text: string }> = {
  advent: { eyebrow: 'Adwent', title: 'Kalendarz adwentowy', text: '24 dni, 24 niespodzianek do odebrania.' },
  wheel: { eyebrow: 'Koło fortuny', title: 'Zakręć i wygraj!', text: 'Masz dziś darmowe zakręcenie.' },
  halloween: { eyebrow: 'Gra Halloween', title: 'Dyniowe Łowy', text: 'Łap dynie, zbieraj punkty i walcz o nagrody.' },
}

const THEME_SWATCH: Record<ClubTileTheme, string> = {
  red: 'bg-gradient-to-br from-[#d8342a] to-[#6f120d]',
  purple: 'bg-gradient-to-br from-[#6b2fa0] to-[#261041]',
  dark: 'bg-[#1d1410]',
  gold: 'bg-gradient-to-br from-[#f8d25c] to-[#d99a12]',
  green: 'bg-gradient-to-br from-[#2f8a57] to-[#0f3a22]',
}
const BUILTIN_SWATCH: Record<BuiltinClubTileId, string> = {
  advent: 'bg-[#5a0a0e]',
  wheel: 'bg-gradient-to-br from-[#6b2fa0] to-[#261041]',
  halloween: 'bg-[#140a20]',
}

const emptyTile = (): CustomClubTile => ({ id: crypto.randomUUID(), eyebrow: '', title: '', text: '', cta_label: '', href: null, image_url: null, theme: 'red', hidden: false })
const emptyOverride = (): ClubTileOverride => ({ eyebrow: '', title: '', text: '', image_url: null })

type Editing = { kind: 'builtin'; id: BuiltinClubTileId } | { kind: 'custom'; tile: CustomClubTile; isNew: boolean }

export function ClubTilesSection({ tiles, onChange, feedHidden, onToggleFeed }: {
  tiles: ClubTilesConfig
  onChange: (tiles: ClubTilesConfig) => void
  feedHidden: ClubFeedId[]
  onToggleFeed: (id: ClubFeedId) => void
}) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const customById = new Map(tiles.custom.map((tile) => [tile.id, tile]))
  const full = tiles.custom.length >= MAX_CUSTOM_CLUB_TILES
  const rows = tiles.order.filter((key) => isBuiltinClubTile(key) || customById.has(customTileIdFromKey(key) ?? ''))

  const move = (index: number, delta: number) => {
    const order = [...rows]
    const target = index + delta
    if (target < 0 || target >= order.length) return
    ;[order[index], order[target]] = [order[target], order[index]]
    onChange({ ...tiles, order })
  }
  const saveCustom = (tile: CustomClubTile, isNew: boolean) => {
    if (isNew) onChange({ ...tiles, custom: [...tiles.custom, tile], order: [...tiles.order, customTileKey(tile.id)] })
    else onChange({ ...tiles, custom: tiles.custom.map((item) => (item.id === tile.id ? tile : item)) })
  }
  const removeCustom = (id: string) =>
    onChange({ ...tiles, custom: tiles.custom.filter((tile) => tile.id !== id), order: tiles.order.filter((key) => key !== customTileKey(id)) })
  const toggleCustom = (tile: CustomClubTile) => saveCustom({ ...tile, hidden: !tile.hidden }, false)
  const saveOverride = (id: BuiltinClubTileId, override: ClubTileOverride) => {
    const overrides = { ...tiles.overrides }
    if (override.eyebrow || override.title || override.text || override.image_url) overrides[id] = override
    else delete overrides[id]
    onChange({ ...tiles, overrides })
  }

  const labelOf = (key: ClubTileKey) => (isBuiltinClubTile(key) ? BUILTIN_CLUB_TILE_LABELS[key].title : customById.get(customTileIdFromKey(key) ?? '')?.title || 'Własny kafelek')

  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-zinc-900">Kafelki „Aktualnie na czasie”</h4>
          <p className="text-xs text-zinc-500">Kolejność, własne teksty i zdjęcia kafelków oraz dodatkowe kafelki z linkiem.</p>
        </div>
        <Button type="button" size="sm" disabled={full} onClick={() => setEditing({ kind: 'custom', tile: emptyTile(), isNew: true })}>
          <Plus className="size-4" aria-hidden="true" /> Nowy kafelek
        </Button>
      </div>

      <ol className="mt-3 flex flex-col gap-2">
        {rows.map((key, index) => {
          const builtin = isBuiltinClubTile(key) ? key : null
          const custom = builtin ? null : customById.get(customTileIdFromKey(key) ?? '') ?? null
          const visible = builtin ? !feedHidden.includes(builtin) : !custom?.hidden
          const override = builtin ? tiles.overrides[builtin] : undefined
          const image = builtin ? override?.image_url : custom?.image_url
          const label = labelOf(key)
          return (
            <li key={key} className={cn('flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 sm:gap-3', visible ? 'border-zinc-200' : 'border-dashed border-zinc-300 bg-zinc-50 opacity-60')}>
              <div className={cn('relative size-10 shrink-0 overflow-hidden rounded-lg', builtin ? BUILTIN_SWATCH[builtin] : THEME_SWATCH[custom?.theme ?? 'red'])}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {image && <img src={image} alt="" className="absolute inset-0 size-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold leading-tight text-zinc-900">
                  {!builtin && <Sparkles className="size-3.5 shrink-0 text-amber-500" aria-hidden="true" />}
                  <span className="truncate">{builtin && override?.title ? override.title : label}</span>
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {builtin ? (override ? 'Własny tekst · ' : '') + BUILTIN_CLUB_TILE_LABELS[builtin].hint : custom?.href ? `Link: ${custom.href}` : 'Bez linku'}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                <Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Przesuń wyżej: ${label}`}><ArrowUp className="size-4" /></Button>
                <Button type="button" size="icon" variant="ghost" disabled={index === rows.length - 1} onClick={() => move(index, 1)} aria-label={`Przesuń niżej: ${label}`}><ArrowDown className="size-4" /></Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => (builtin ? setEditing({ kind: 'builtin', id: builtin }) : custom && setEditing({ kind: 'custom', tile: custom, isNew: false }))}
                  aria-label={`Edytuj kafelek: ${label}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-pressed={!visible}
                  onClick={() => (builtin ? onToggleFeed(builtin) : custom && toggleCustom(custom))}
                  aria-label={visible ? `Ukryj w Yummy Club: ${label}` : `Pokaż w Yummy Club: ${label}`}
                >
                  {visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </Button>
                {custom && (
                  <Button type="button" size="icon" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => removeCustom(custom.id)} aria-label={`Usuń kafelek: ${label}`}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      <p className="mt-2 flex items-center gap-1 text-[11px] text-zinc-500">
        <Smartphone className="size-3" aria-hidden="true" /> Kafelki adwentu i Halloween pokazują się tylko w czasie trwania wydarzenia.
      </p>

      <TileDialog
        key={editing ? (editing.kind === 'builtin' ? editing.id : editing.tile.id) : 'none'}
        editing={editing}
        overrides={tiles.overrides}
        onClose={() => setEditing(null)}
        onSaveOverride={(id, override) => {
          saveOverride(id, override)
          setEditing(null)
        }}
        onSaveCustom={(tile, isNew) => {
          saveCustom(tile, isNew)
          setEditing(null)
        }}
      />
    </div>
  )
}

const fieldLabel = 'flex flex-col gap-1.5 text-sm font-semibold text-zinc-700'

function TileDialog({ editing, overrides, onClose, onSaveOverride, onSaveCustom }: {
  editing: Editing | null
  overrides: ClubTilesConfig['overrides']
  onClose: () => void
  onSaveOverride: (id: BuiltinClubTileId, override: ClubTileOverride) => void
  onSaveCustom: (tile: CustomClubTile, isNew: boolean) => void
}) {
  const builtinId = editing?.kind === 'builtin' ? editing.id : null
  const [override, setOverride] = useState<ClubTileOverride>(() => (builtinId ? overrides[builtinId] ?? emptyOverride() : emptyOverride()))
  const [tile, setTile] = useState<CustomClubTile>(() => (editing?.kind === 'custom' ? editing.tile : emptyTile()))
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const defaults = builtinId ? BUILTIN_DEFAULTS[builtinId] : null
  const values = builtinId ? override : tile
  const update = (patch: Partial<ClubTileOverride & CustomClubTile>) => (builtinId ? setOverride((current) => ({ ...current, ...patch })) : setTile((current) => ({ ...current, ...patch })))

  useEffect(() => () => { if (cropSrc) URL.revokeObjectURL(cropSrc) }, [cropSrc])

  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return void toast.error('Wybierz plik graficzny.')
    if (file.size > 25 * 1024 * 1024) return void toast.error('Zdjęcie jest za duże (maks. 25 MB).')
    setCropSrc(URL.createObjectURL(file))
  }

  async function upload(blob: Blob) {
    const form = new FormData()
    form.append('file', blob, 'tile.webp')
    form.append('folder', 'slides')
    const response = await fetch('/api/workshop/menu/image', { method: 'POST', body: form })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error ?? 'Nie udało się wgrać zdjęcia.')
    update({ image_url: result.url })
    setCropSrc(null)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (builtinId) {
      onSaveOverride(builtinId, { eyebrow: override.eyebrow.trim(), title: override.title.trim(), text: override.text.trim(), image_url: override.image_url })
      return
    }
    const href = tile.href?.trim() || null
    if (!tile.title.trim()) return void toast.error('Podaj tytuł kafelka.')
    if (href && !isSafeSlideHref(href)) return void toast.error('Link musi zaczynać się od „/” (np. /menu) albo „https://”.')
    onSaveCustom({ ...tile, title: tile.title.trim(), eyebrow: tile.eyebrow.trim(), text: tile.text.trim(), cta_label: tile.cta_label.trim(), href }, editing?.kind === 'custom' && editing.isNew)
  }

  const title = builtinId ? `Kafelek: ${BUILTIN_CLUB_TILE_LABELS[builtinId].title}` : editing?.kind === 'custom' && editing.isNew ? 'Nowy kafelek' : 'Edytuj kafelek'

  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {builtinId ? 'Puste pole = tekst domyślny. ' : ''}Zmiany trafią do aplikacji po kliknięciu „Zapisz” na dole strony.
          </DialogDescription>
        </DialogHeader>

        <form id="club-tile-form" onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <label className={fieldLabel}>
              Plakietka
              <Input maxLength={TILE_LIMITS.eyebrow} value={values.eyebrow} placeholder={defaults?.eyebrow ?? 'np. Nowość'} onChange={(event) => update({ eyebrow: event.target.value })} />
            </label>
            <label className={fieldLabel}>
              Tytuł
              <Input required={!builtinId} maxLength={TILE_LIMITS.title} value={values.title} placeholder={defaults?.title ?? 'np. Nocne menu'} onChange={(event) => update({ title: event.target.value })} />
            </label>
          </div>
          <label className={fieldLabel}>
            Opis
            <textarea
              rows={2}
              maxLength={TILE_LIMITS.text}
              value={values.text}
              placeholder={defaults?.text ?? 'Krótki opis, maks. 2 linijki'}
              onChange={(event) => update({ text: event.target.value })}
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm font-normal"
            />
          </label>
          {builtinId === 'halloween' && <p className="-mt-2 text-xs text-zinc-500">Po zakończeniu gry opis zastąpią wyniki i ranking.</p>}

          {!builtinId && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                <label className={fieldLabel}>
                  Link (opcjonalnie)
                  <Input maxLength={TILE_LIMITS.href} value={tile.href ?? ''} placeholder="/menu" onChange={(event) => update({ href: event.target.value })} />
                </label>
                <label className={fieldLabel}>
                  Tekst przycisku
                  <Input maxLength={TILE_LIMITS.cta} value={tile.cta_label} placeholder="Sprawdź" disabled={!tile.href?.trim()} onChange={(event) => update({ cta_label: event.target.value })} />
                </label>
              </div>
              <fieldset>
                <legend className="text-sm font-semibold text-zinc-700">Kolor tła</legend>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {CLUB_TILE_THEMES.map((theme) => (
                    <button key={theme} type="button" onClick={() => update({ theme })} aria-pressed={tile.theme === theme} className={cn('flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold', tile.theme === theme ? 'border-zinc-900 ring-2 ring-zinc-900/15' : 'border-zinc-200')}>
                      <span className={cn('size-4 rounded-full', THEME_SWATCH[theme])} aria-hidden="true" />
                      {CLUB_TILE_THEME_LABELS[theme]}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          <div>
            <p className="text-sm font-semibold text-zinc-700">Zdjęcie w tle (opcjonalnie)</p>
            <p className="mt-0.5 text-xs text-zinc-500">Proporcje 2:1, najlepiej 1200×600 px. Lewa strona zostanie przyciemniona pod tekst.</p>
            {cropSrc ? (
              <div className="mt-1.5">
                <MenuImageCropper src={cropSrc} aspect={CLUB_TILE_IMAGE_ASPECT} maxWidth={1200} hint="Przesuń i przybliż zdjęcie. Wypełni cały kafelek." onCancel={() => setCropSrc(null)} onConfirm={upload} />
              </div>
            ) : (
              <div className="mt-1.5 flex items-center gap-3">
                <div className="flex aspect-[2/1] w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 text-zinc-400">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {values.image_url ? <img src={values.image_url} alt="Podgląd zdjęcia kafelka" className="size-full object-cover" /> : <ImagePlus className="size-5" aria-hidden="true" />}
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
                  <ImagePlus className="size-3.5" aria-hidden="true" />
                  {values.image_url ? 'Zmień' : 'Wgraj'}
                </Button>
                {values.image_url && <Button type="button" size="sm" variant="ghost" onClick={() => update({ image_url: null })}>Usuń</Button>}
                <input ref={fileInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={pickFile} />
              </div>
            )}
          </div>
        </form>

        <DialogFooter>
          {builtinId && (
            <Button type="button" variant="ghost" className="sm:mr-auto" onClick={() => setOverride(emptyOverride())}>Przywróć domyślne</Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
          <Button type="submit" form="club-tile-form" disabled={cropSrc !== null}>Zapisz kafelek</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
