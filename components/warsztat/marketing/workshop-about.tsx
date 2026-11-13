'use client'

import { useRef, useState, type ReactNode } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { ExternalLink, ImagePlus, Info, LoaderCircle, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ABOUT_ALT_LIMIT,
  ABOUT_IMAGE_SLOTS,
  ABOUT_MAX_PARAGRAPHS,
  ABOUT_PARAGRAPH_LIMIT,
  ABOUT_TEXT_LIMITS,
  ABOUT_VALUE_TEXT_LIMIT,
  ABOUT_VALUE_TITLE_LIMIT,
  type AboutContent,
  type AboutImageKey,
} from '@/lib/about'
import { AboutImageEditor, type CompressedImage } from './about-image-editor'
import { TabIntro } from './help-parts'

const KEY = '/api/workshop/about'
type Payload = { content: AboutContent; defaults: AboutContent }

async function fetchAbout(url: string): Promise<Payload> {
  const response = await fetch(url, { cache: 'no-store' })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error ?? 'Nie udało się wczytać strony „O nas”.')
  return body
}

export function WorkshopAbout() {
  const { data, error, isLoading, mutate } = useSWR(KEY, fetchAbout, { revalidateOnFocus: false })
  if (error) return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:p-4">{error.message}</p>
  if (isLoading || !data) {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-600">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Wczytywanie…
      </p>
    )
  }
  return <Editor key={JSON.stringify(data.content)} initial={data.content} defaults={data.defaults} onSaved={(next) => mutate(next, { revalidate: false })} />
}

type TextKey = keyof typeof ABOUT_TEXT_LIMITS

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4">
      <h3 id={id} className="text-sm font-extrabold text-zinc-900">{title}</h3>
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </section>
  )
}

function Field({ label, value, max, multiline, onChange }: { label: string; value: string; max: number; multiline?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-zinc-700">
      <span className="flex items-baseline justify-between gap-2">
        {label}
        <span className="text-[11px] font-normal tabular-nums text-zinc-400">{value.length}/{max}</span>
      </span>
      {multiline ? (
        <textarea value={value} maxLength={max} rows={3} onChange={(event) => onChange(event.target.value)} className="min-h-20 w-full rounded-md border border-input bg-white px-3 py-2 text-sm font-normal leading-relaxed" />
      ) : (
        <Input value={value} maxLength={max} onChange={(event) => onChange(event.target.value)} className="bg-white font-normal" />
      )}
    </label>
  )
}

function Paragraphs({ label, items, onChange }: { label: string; items: string[]; onChange: (items: string[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-zinc-700">{label}</p>
      {items.map((paragraph, index) => (
        <div key={index} className="flex items-start gap-2">
          <textarea
            aria-label={`${label} – akapit ${index + 1}`}
            value={paragraph}
            maxLength={ABOUT_PARAGRAPH_LIMIT}
            rows={3}
            onChange={(event) => onChange(items.map((item, i) => (i === index ? event.target.value : item)))}
            className="min-h-20 w-full min-w-0 rounded-md border border-input bg-white px-3 py-2 text-sm leading-relaxed"
          />
          <Button type="button" size="icon" variant="ghost" onClick={() => onChange(items.filter((_, i) => i !== index))} aria-label={`Usuń akapit ${index + 1}`}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      {items.length < ABOUT_MAX_PARAGRAPHS && (
        <button type="button" onClick={() => onChange([...items, ''])} className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-primary hover:bg-primary/10">
          <Plus className="size-3.5" aria-hidden="true" /> Dodaj akapit
        </button>
      )}
    </div>
  )
}

async function uploadWebp(image: CompressedImage) {
  const form = new FormData()
  form.append('file', image.blob, 'about.webp')
  form.append('folder', 'about')
  const response = await fetch('/api/workshop/menu/image', { method: 'POST', body: form })
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.url) throw new Error(body?.error ?? 'Nie udało się wgrać zdjęcia.')
  return body.url as string
}

function ImageSlot({
  slot,
  value,
  isDefault,
  onPick,
  onAltChange,
  onReset,
}: {
  slot: (typeof ABOUT_IMAGE_SLOTS)[number]
  value: AboutContent[AboutImageKey]
  isDefault: boolean
  onPick: (file: File) => void
  onAltChange: (alt: string) => void
  onReset: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-zinc-200 p-2.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group relative overflow-hidden rounded-lg bg-zinc-100"
        style={{ aspectRatio: slot.aspect }}
        aria-label={`Zmień zdjęcie: ${slot.label}`}
      >
        <img src={value.src || '/placeholder.svg'} alt="" className="size-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-zinc-900/55 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ImagePlus className="size-4" aria-hidden="true" /> Zmień
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onPick(file)
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-bold text-zinc-900">{slot.label}</p>
        <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">{value.width}×{value.height}</span>
      </div>
      <label className="flex flex-col gap-1 text-[11px] font-semibold text-zinc-500">
        Opis dla czytników ekranu
        <Input value={value.alt} maxLength={ABOUT_ALT_LIMIT} onChange={(event) => onAltChange(event.target.value)} className="h-8 bg-white text-xs font-normal" />
      </label>
      <div className="flex gap-1.5">
        <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => inputRef.current?.click()}>
          <ImagePlus className="size-3.5" aria-hidden="true" /> Wgraj
        </Button>
        {!isDefault && (
          <Button type="button" size="sm" variant="ghost" onClick={onReset} aria-label={`Przywróć domyślne zdjęcie: ${slot.label}`}>
            <RotateCcw className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

function Editor({ initial, defaults, onSaved }: { initial: AboutContent; defaults: AboutContent; onSaved: (next: Payload) => void }) {
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<{ key: AboutImageKey; file: File } | null>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const set = (patch: Partial<AboutContent>) => setDraft((current) => ({ ...current, ...patch }))
  const text = (key: TextKey, label: string, multiline = false) => (
    <Field label={label} value={draft[key]} max={ABOUT_TEXT_LIMITS[key]} multiline={multiline} onChange={(value) => set({ [key]: value })} />
  )
  const editingSlot = editing ? ABOUT_IMAGE_SLOTS.find((slot) => slot.key === editing.key) : undefined

  async function save() {
    setSaving(true)
    try {
      const response = await fetch(KEY, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? 'Nie udało się zapisać.')
      onSaved(body)
      toast.success('Zapisano stronę „O nas”')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Nie udało się zapisać.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmImage(image: CompressedImage) {
    if (!editing) return
    const url = await uploadWebp(image)
    const key = editing.key
    setDraft((current) => ({ ...current, [key]: { ...current[key], src: url, width: image.width, height: image.height } }))
    setEditing(null)
    toast.success('Zdjęcie wgrane – zapisz zmiany, aby pokazać je klientom')
  }

  return (
    <div className="flex flex-col gap-5 pb-20">
      <TabIntro
        icon={Info}
        title="Strona „O nas”"
        lead="Zmieniasz teksty i zdjęcia na stronie /o-nas. Klienci dostają gotową, zapisaną w pamięci podręcznej wersję – odświeża się dopiero po zapisie."
        steps={[
          'Kliknij zdjęcie, wybierz plik i wykadruj go – zostanie skompresowany do WebP.',
          'Popraw teksty. Fragment w **gwiazdkach** zostanie pogrubiony.',
          'Kliknij „Zapisz”, aby opublikować zmiany.',
        ]}
      />

      <Section id="about-photos" title="Zdjęcia">
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
          {ABOUT_IMAGE_SLOTS.map((slot) => (
            <ImageSlot
              key={slot.key}
              slot={slot}
              value={draft[slot.key]}
              isDefault={draft[slot.key].src === defaults[slot.key].src}
              onPick={(file) => setEditing({ key: slot.key, file })}
              onAltChange={(alt) => set({ [slot.key]: { ...draft[slot.key], alt } })}
              onReset={() => set({ [slot.key]: defaults[slot.key] })}
            />
          ))}
        </div>
      </Section>

      <Section id="about-hero" title="Nagłówek">
        {text('eyebrow', 'Mały napis nad tytułem')}
        {text('title', 'Tytuł strony', true)}
        {text('lead', 'Wstęp', true)}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_2fr]">
          {text('heroBadgeValue', 'Plakietka – liczba')}
          {text('heroBadgeText', 'Plakietka – podpis')}
        </div>
      </Section>

      <Section id="about-story" title="Historia">
        {text('storyTitle', 'Tytuł sekcji')}
        <Paragraphs label="Akapity" items={draft.storyParagraphs} onChange={(storyParagraphs) => set({ storyParagraphs })} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {text('oldLogoLabel', 'Logo – mały napis')}
          {text('oldLogoCaption', 'Logo – podpis')}
        </div>
      </Section>

      <Section id="about-values" title="Wyróżniki">
        {text('valuesTitle', 'Tytuł sekcji')}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {draft.values.map((value, index) => (
            <div key={index} className="flex min-w-0 flex-col gap-3 rounded-xl border border-zinc-200 p-3">
              <Field
                label={`Wyróżnik ${index + 1}`}
                value={value.title}
                max={ABOUT_VALUE_TITLE_LIMIT}
                onChange={(title) => set({ values: draft.values.map((item, i) => (i === index ? { ...item, title } : item)) })}
              />
              <Field
                label="Opis"
                value={value.text}
                max={ABOUT_VALUE_TEXT_LIMIT}
                multiline
                onChange={(next) => set({ values: draft.values.map((item, i) => (i === index ? { ...item, text: next } : item)) })}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section id="about-thanks" title="Podziękowanie">
        {text('thanksTitle', 'Tytuł sekcji')}
        <Paragraphs label="Akapity" items={draft.thanksParagraphs} onChange={(thanksParagraphs) => set({ thanksParagraphs })} />
        {text('quote', 'Cytat', true)}
        {text('quoteAuthor', 'Podpis cytatu')}
      </Section>

      <Section id="about-cta" title="Zaproszenie na dole">
        {text('ctaTitle', 'Tytuł')}
        {text('ctaText', 'Tekst')}
      </Section>

      <div className="sticky bottom-0 z-10 -mx-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-white/95 px-3 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <a href="/o-nas" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-900">
          <ExternalLink className="size-3.5" aria-hidden="true" /> Otwórz stronę
        </a>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => setDraft(initial)}>Cofnij</Button>
          <Button type="button" disabled={!dirty || saving} onClick={() => void save()}>
            {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            Zapisz
          </Button>
        </div>
      </div>

      <AboutImageEditor
        file={editing?.file ?? null}
        slotAspect={editingSlot?.aspect ?? 4 / 3}
        defaultMaxWidth={editingSlot?.maxWidth ?? 1200}
        title={editingSlot ? `Zdjęcie: ${editingSlot.label}` : 'Zdjęcie'}
        onCancel={() => setEditing(null)}
        onConfirm={confirmImage}
      />
    </div>
  )
}
