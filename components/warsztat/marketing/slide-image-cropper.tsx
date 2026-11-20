'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { ArrowRight, LoaderCircle, Monitor, Smartphone, Sparkles, ZoomIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { cropToWebp } from '@/components/warsztat/menu-editor/menu-image-cropper'
import { CUSTOM_SLIDE_THEMES } from '@/components/yummy/custom-hero-slide'
import { COVER_IMAGE_ASPECT, MOBILE_COVER_IMAGE_ASPECT, type SlideImageMode, type SlideTheme } from '@/lib/home-slides'

type Device = 'desktop' | 'mobile'
type Variant = { crop: { x: number; y: number }; zoom: number; percent: Area | null; pixels: Area | null }

const VARIANT_SPEC: Record<SlideImageMode, Record<Device, { aspect: number; maxWidth: number }>> = {
  cover: { desktop: { aspect: COVER_IMAGE_ASPECT, maxWidth: 2100 }, mobile: { aspect: MOBILE_COVER_IMAGE_ASPECT, maxWidth: 1200 } },
  circle: { desktop: { aspect: 1, maxWidth: 1000 }, mobile: { aspect: 1, maxWidth: 800 } },
}

/** Frame proportions of the real slide: ~1280×680 on a computer, ~375×250 on a phone. */
const FRAME_ASPECT: Record<Device, number> = { desktop: 1280 / 680, mobile: 375 / 250 }

const freshVariant = (): Variant => ({ crop: { x: 0, y: 0 }, zoom: 1, percent: null, pixels: null })

/** Centered crop that react-easy-crop starts with at zoom 1 (objectFit cover), so untouched variants still have an area. */
function defaultArea(width: number, height: number, aspect: number) {
  const cropWidth = width / height > aspect ? height * aspect : width
  const cropHeight = cropWidth / aspect
  const pixels = { x: (width - cropWidth) / 2, y: (height - cropHeight) / 2, width: cropWidth, height: cropHeight }
  const percent = { x: (pixels.x / width) * 100, y: (pixels.y / height) * 100, width: (cropWidth / width) * 100, height: (cropHeight / height) * 100 }
  return { pixels, percent }
}

export type SlideCropResult = { desktop: Blob; mobile: Blob }

export function SlideImageCropper({
  src,
  mode,
  theme,
  title,
  badge,
  onCancel,
  onConfirm,
}: {
  src: string
  mode: SlideImageMode
  theme: SlideTheme
  title: string
  badge: string
  onCancel: () => void
  onConfirm: (result: SlideCropResult) => Promise<void>
}) {
  const [device, setDevice] = useState<Device>('desktop')
  const [variants, setVariants] = useState<Record<Device, Variant>>({ desktop: freshVariant(), mobile: freshVariant() })
  const [touched, setTouched] = useState<Record<Device, boolean>>({ desktop: false, mobile: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const spec = VARIANT_SPEC[mode]

  useEffect(() => {
    let alive = true
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (!alive) return
      setVariants((current) => {
        const next = { ...current }
        for (const key of ['desktop', 'mobile'] as const) {
          if (!next[key].pixels) next[key] = { ...next[key], ...defaultArea(image.naturalWidth, image.naturalHeight, spec[key].aspect) }
        }
        return next
      })
    }
    image.onerror = () => alive && setError('Nie udało się odczytać zdjęcia.')
    image.src = src
    return () => { alive = false }
  }, [src, spec])

  const patch = (key: Device, value: Partial<Variant>) => setVariants((current) => ({ ...current, [key]: { ...current[key], ...value } }))
  const active = variants[device]
  const ready = Boolean(variants.desktop.pixels && variants.mobile.pixels)

  async function confirm() {
    if (!variants.desktop.pixels || !variants.mobile.pixels) return
    setBusy(true)
    setError('')
    try {
      const [desktop, mobile] = await Promise.all([
        cropToWebp(src, variants.desktop.pixels, spec.desktop.aspect, spec.desktop.maxWidth),
        cropToWebp(src, variants.mobile.pixels, spec.mobile.aspect, spec.mobile.maxWidth),
      ])
      await onConfirm({ desktop, mobile })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się przetworzyć zdjęcia.')
      setBusy(false)
    }
  }

  const editor = (
    <Cropper
      key={`${device}-${mode}`}
      image={src}
      crop={active.crop}
      zoom={active.zoom}
      aspect={spec[device].aspect}
      cropShape={mode === 'circle' ? 'round' : 'rect'}
      objectFit="cover"
      showGrid={false}
      onCropChange={(crop) => patch(device, { crop })}
      onZoomChange={(zoom) => patch(device, { zoom })}
      onCropComplete={(percent, pixels) => patch(device, { percent, pixels })}
      onInteractionStart={() => setTouched((current) => ({ ...current, [device]: true }))}
      style={{ containerStyle: { background: 'transparent' }, cropAreaStyle: { border: mode === 'cover' ? 'none' : '2px solid rgba(255,255,255,0.9)', color: mode === 'cover' ? 'transparent' : 'rgba(0,0,0,0.45)' } }}
    />
  )

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Wersja slajdu" className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1">
        {([['desktop', 'Komputer', Monitor], ['mobile', 'Telefon', Smartphone]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={device === key}
            onClick={() => setDevice(key)}
            className={cn('flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-semibold', device === key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600')}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
            {touched[key] && <span className="size-1.5 rounded-full bg-emerald-500" aria-label="kadr ustawiony" />}
          </button>
        ))}
      </div>

      <div className={cn('mx-auto w-full', device === 'mobile' && 'max-w-[340px]')}>
        <SlideFrame device={device} mode={mode} theme={theme} title={title} badge={badge} interactive>
          {editor}
        </SlideFrame>
      </div>

      <label className="flex items-center gap-3 text-xs font-semibold text-zinc-600">
        <ZoomIn className="size-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">{`Powiększenie – ${device === 'desktop' ? 'komputer' : 'telefon'}`}</span>
        <input type="range" min={1} max={3} step={0.01} value={active.zoom} onChange={(event) => patch(device, { zoom: Number(event.target.value) })} className="w-full accent-primary" />
      </label>
      <p className="text-[11px] leading-relaxed text-zinc-500">
        {'Przeciągnij zdjęcie palcem lub myszką bezpośrednio na slajdzie i przybliż suwakiem. Kadr na komputer i na telefon ustawiasz osobno – przełącz zakładkę u góry. Tekst i przycisk to podgląd, jak slajd będzie wyglądał na stronie.'}
      </p>

      <div className="grid grid-cols-[1.6fr_1fr] items-end gap-3">
        {(['desktop', 'mobile'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setDevice(key)}
            aria-label={`Podgląd: ${key === 'desktop' ? 'komputer' : 'telefon'}`}
            className={cn('flex flex-col gap-1 rounded-lg p-1 text-left transition-colors', device === key ? 'bg-zinc-900/5 ring-2 ring-zinc-900' : 'hover:bg-zinc-100')}
          >
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              {key === 'desktop' ? <Monitor className="size-3" aria-hidden="true" /> : <Smartphone className="size-3" aria-hidden="true" />}
              {key === 'desktop' ? 'Komputer' : 'Telefon'}
            </span>
            <SlideFrame device={key} mode={mode} theme={theme} title={title} badge={badge} compact>
              <CroppedImage src={src} area={variants[key].percent} />
            </SlideFrame>
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>Anuluj</Button>
        <Button type="button" size="sm" onClick={() => void confirm()} disabled={busy || !ready}>
          {busy && <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />}
          Zapisz oba kadry
        </Button>
      </div>
    </div>
  )
}

/** Renders a percentage crop from react-easy-crop as a static image filling its box. */
function CroppedImage({ src, area }: { src: string; area: Area | null }) {
  if (!area) return <div className="absolute inset-0 animate-pulse bg-black/10" />
  const style: CSSProperties = {
    position: 'absolute',
    width: `${10000 / area.width}%`,
    height: `${10000 / area.height}%`,
    left: `${(-area.x * 100) / area.width}%`,
    top: `${(-area.y * 100) / area.height}%`,
    maxWidth: 'none',
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" draggable={false} style={style} />
}

/** Miniature of the real hero slide; `children` is the image (editor or preview) placed exactly where the site puts it. */
function SlideFrame({ device, mode, theme, title, badge, interactive = false, compact = false, children }: {
  device: Device
  mode: SlideImageMode
  theme: SlideTheme
  title: string
  badge: string
  interactive?: boolean
  compact?: boolean
  children: ReactNode
}) {
  const colors = CUSTOM_SLIDE_THEMES[theme]
  const cover = mode === 'cover'
  const mobile = device === 'mobile'
  const aspect = cover ? VARIANT_SPEC.cover[device].aspect : FRAME_ASPECT[device]

  return (
    <div className={cn('relative w-full overflow-hidden rounded-xl shadow-sm ring-1 ring-black/10', cover ? 'bg-[#1a0b24] text-white' : colors.root)} style={{ aspectRatio: aspect }}>
      {cover ? (
        <div className={cn('absolute inset-0', !interactive && 'pointer-events-none')}>{children}</div>
      ) : (
        <>
          <div aria-hidden="true" className={cn('absolute top-1/2 aspect-square -translate-y-1/2 rounded-full', colors.ring1, mobile ? '-right-[30%] w-[85%]' : 'right-0 w-[62%]')} />
          <div aria-hidden="true" className={cn('absolute top-1/2 aspect-square -translate-y-1/2 rounded-full', colors.ring2, mobile ? '-right-[18%] w-[60%]' : 'right-[8%] w-[44%]')} />
          <div
            className={cn(
              'absolute top-1/2 aspect-square -translate-y-1/2 overflow-hidden',
              mobile ? 'right-[4%] w-[40%]' : 'right-[2%] w-[46%]',
              mobile ? 'rounded-full ring-2 ring-white/90' : 'rounded-full ring-2 ring-black/10',
              !interactive && 'pointer-events-none',
              interactive && 'shadow-lg',
            )}
          >
            {children}
          </div>
        </>
      )}

      {cover && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#1a0b24]/90 via-[#1a0b24]/35 to-transparent" />
      )}

      <div aria-hidden="true" className={cn('pointer-events-none absolute bottom-0 left-0 flex flex-col items-start', compact ? 'max-w-[55%] gap-0.5 p-1.5' : mobile ? 'max-w-[55%] gap-1 p-3' : 'max-w-[48%] gap-1.5 p-4 sm:p-5')}>
        {badge && (
          <span className={cn('flex items-center gap-1 rounded-full font-bold uppercase tracking-wider', colors.badge, compact ? 'px-1 text-[5px]' : 'px-2 py-0.5 text-[8px] sm:text-[9px]')}>
            {!compact && <Sparkles className="size-2.5" />}
            {badge}
          </span>
        )}
        <span className={cn('line-clamp-2 font-black leading-[1.05] text-balance', compact ? 'text-[8px]' : mobile ? 'text-sm' : 'text-lg sm:text-2xl')}>{title || 'Tytuł slajdu'}</span>
        <span className={cn('inline-flex items-center gap-1 rounded-full font-bold', colors.button, compact ? 'h-2.5 px-1.5 text-[5px]' : 'mt-1 h-6 pl-2.5 pr-1 text-[9px] sm:h-7 sm:text-[10px]')}>
          Zamów teraz
          {!compact && <span className={cn('grid size-4 place-items-center rounded-full sm:size-5', colors.arrow)}><ArrowRight className="size-2.5" /></span>}
        </span>
      </div>
    </div>
  )
}
