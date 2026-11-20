'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import type QRCodeStyling from 'qr-code-styling'
import type { CornerDotType, CornerSquareType, DotType, Options } from 'qr-code-styling'
import { Copy, Download, FileImage } from 'lucide-react'
import { SITE_URL } from '@/lib/seo'
import { QrScanCounter } from './qr-scan-counter'
import { cn } from '@/lib/utils'

const INSTALL_URL = `${SITE_URL}/yummy-club/instaluj`
const LOGO_SRC = '/club-icon-512.png'

const dotStyles: { id: DotType; label: string }[] = [
  { id: 'rounded', label: 'Zaokrąglone' },
  { id: 'dots', label: 'Kropki' },
  { id: 'classy-rounded', label: 'Liście' },
  { id: 'extra-rounded', label: 'Płynne' },
  { id: 'classy', label: 'Ostre liście' },
  { id: 'square', label: 'Klasyczne' },
]

const cornerStyles: { id: string; label: string; square: CornerSquareType; dot: CornerDotType }[] = [
  { id: 'rounded', label: 'Zaokrąglone', square: 'extra-rounded', dot: 'dot' },
  { id: 'circle', label: 'Koła', square: 'dot', dot: 'dot' },
  { id: 'square', label: 'Kwadraty', square: 'square', dot: 'square' },
  { id: 'mixed', label: 'Mieszane', square: 'extra-rounded', dot: 'square' },
]

const colors = [
  { id: '#d71f16', label: 'Yummy czerwony' },
  { id: '#161413', label: 'Czarny' },
  { id: '#5a2d12', label: 'Czekoladowy' },
  { id: '#1f4d3a', label: 'Butelkowa zieleń' },
]

type Style = { dots: DotType; corners: string; dotColor: string; cornerColor: string; logo: boolean; gradient: boolean; logoRadius: number }

const logoRadii = [
  { id: 0, label: 'Kwadrat' },
  { id: 14, label: 'Lekko' },
  { id: 24, label: 'Mocno' },
  { id: 50, label: 'Koło' },
]

/** qr-code-styling has no image radius option, so the logo is pre-clipped on a canvas into a PNG data URL. */
async function roundedLogo([, radius]: [string, number]): Promise<string> {
  if (radius <= 0) return LOGO_SRC
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.src = LOGO_SRC
  await image.decode()
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return LOGO_SRC
  context.beginPath()
  context.roundRect(0, 0, size, size, (size * radius) / 100)
  context.clip()
  context.drawImage(image, 0, 0, size, size)
  return canvas.toDataURL('image/png')
}

function buildOptions(url: string, style: Style, size: number, logoSrc: string): Options {
  const corner = cornerStyles.find((item) => item.id === style.corners) ?? cornerStyles[0]
  return {
    width: size,
    height: size,
    type: 'svg',
    data: url,
    margin: Math.round(size * 0.04),
    image: style.logo ? logoSrc : undefined,
    qrOptions: { errorCorrectionLevel: style.logo ? 'H' : 'Q' },
    imageOptions: { crossOrigin: 'anonymous', hideBackgroundDots: true, imageSize: 0.32, margin: Math.round(size * 0.012), saveAsBlob: true },
    dotsOptions: style.gradient
      ? { type: style.dots, gradient: { type: 'linear', rotation: Math.PI / 4, colorStops: [{ offset: 0, color: style.dotColor }, { offset: 1, color: style.cornerColor }] } }
      : { type: style.dots, color: style.dotColor },
    cornersSquareOptions: { type: corner.square, color: style.cornerColor },
    cornersDotOptions: { type: corner.dot, color: style.cornerColor },
    backgroundOptions: { color: '#ffffff' },
  }
}

export function WorkshopInstallQr() {
  const [source, setSource] = useState('plakat')
  const [style, setStyle] = useState<Style>({ dots: 'rounded', corners: 'rounded', dotColor: '#161413', cornerColor: '#d71f16', logo: true, gradient: false, logoRadius: 24 })
  const [copied, setCopied] = useState(false)
  const [ready, setReady] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const qrRef = useRef<QRCodeStyling | null>(null)

  const url = source ? `${INSTALL_URL}?utm_source=qr&utm_campaign=${encodeURIComponent(source)}` : INSTALL_URL
  const { data: logoSrc } = useSWR(['qr-logo', style.logoRadius], roundedLogo, { revalidateOnFocus: false, fallbackData: undefined })
  const previewOptions = useMemo(() => (logoSrc ? buildOptions(url, style, 320, logoSrc) : null), [url, style, logoSrc])

  useEffect(() => {
    let cancelled = false
    if (!previewOptions) return
    if (qrRef.current) {
      qrRef.current.update(previewOptions)
      return
    }
    import('qr-code-styling').then(({ default: QR }) => {
      if (cancelled || !containerRef.current || !previewOptions) return
      qrRef.current = new QR(previewOptions)
      containerRef.current.replaceChildren()
      qrRef.current.append(containerRef.current)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [previewOptions])

  const update = <K extends keyof Style>(key: K, value: Style[K]) => setStyle((current) => ({ ...current, [key]: value }))
  const filename = `yummy-club-qr-${source || 'instalacja'}`

  async function download(extension: 'png' | 'svg') {
    const { default: QR } = await import('qr-code-styling')
    const qr = new QR(buildOptions(url, style, extension === 'png' ? 2048 : 1024, logoSrc ?? LOGO_SRC))
    await qr.download({ name: filename, extension })
  }

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col gap-8">
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="mx-auto flex w-full max-w-xs shrink-0 flex-col items-center gap-3 lg:sticky lg:top-4">
        <div className="relative w-full rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div
            ref={containerRef}
            role="img"
            aria-label="Podgląd kodu QR do instalacji aplikacji Yummy Club"
            className="aspect-square w-full [&>svg]:size-full [&>canvas]:size-full"
          />
          {!ready && <div className="absolute inset-4 animate-pulse rounded-2xl bg-zinc-100" />}
        </div>
        <p className="text-center text-sm font-extrabold text-zinc-900">Zeskanuj i zainstaluj Yummy Club</p>
        <p className="text-center text-[11px] leading-snug text-zinc-500">Przed drukiem zeskanuj kod telefonem – mocno ozdobne wzory czytają się trochę wolniej.</p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <OptionGroup label="Wzór kropek">
          {dotStyles.map((item) => (
            <Chip key={item.id} selected={style.dots === item.id} onClick={() => update('dots', item.id)}>{item.label}</Chip>
          ))}
        </OptionGroup>

        <OptionGroup label="Narożniki">
          {cornerStyles.map((item) => (
            <Chip key={item.id} selected={style.corners === item.id} onClick={() => update('corners', item.id)}>{item.label}</Chip>
          ))}
        </OptionGroup>

        <div className="grid gap-5 sm:grid-cols-2">
          <ColorPicker label="Kolor kropek" value={style.dotColor} onChange={(value) => update('dotColor', value)} />
          <ColorPicker label="Kolor narożników" value={style.cornerColor} onChange={(value) => update('cornerColor', value)} />
        </div>

        <div className="flex flex-col gap-2">
          <Toggle checked={style.logo} onChange={(value) => update('logo', value)} label="Logo Yummy w środku" />
          {style.logo && (
            <div className="ml-7 flex flex-col gap-2 rounded-xl bg-zinc-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="qr-logo-radius" className="text-xs font-bold text-zinc-700">Zaokrąglenie rogów logo</label>
                <span className="text-xs font-bold tabular-nums text-zinc-500">{`${style.logoRadius}%`}</span>
              </div>
              <input id="qr-logo-radius" type="range" min={0} max={50} step={2} value={style.logoRadius} onChange={(event) => update('logoRadius', Number(event.target.value))} className="w-full accent-[#d71f16]" />
              <div className="flex flex-wrap gap-1.5">
                {logoRadii.map((item) => (
                  <Chip key={item.id} selected={style.logoRadius === item.id} onClick={() => update('logoRadius', item.id)}>{item.label}</Chip>
                ))}
              </div>
            </div>
          )}
          <Toggle checked={style.gradient} onChange={(value) => update('gradient', value)} label="Gradient kropek (z koloru kropek w kolor narożników)" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="qr-source" className="text-xs font-bold text-zinc-700">Miejsce kodu (do statystyk)</label>
          <input
            id="qr-source"
            value={source}
            maxLength={40}
            onChange={(event) => setSource(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            placeholder="np. stolik, ulotka, paragon"
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <p className="text-[11px] text-zinc-500">Osobny kod dla stolików, ulotek czy torby pokaże w liczniku poniżej, który działa najlepiej.</p>
        </div>

        <div className="flex min-w-0 items-center gap-2 rounded-xl border border-zinc-200 bg-white p-1 pl-3">
          <code className="min-w-0 flex-1 truncate text-xs text-zinc-600">{url}</code>
          <button type="button" onClick={copy} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100">
            <Copy className="size-3.5" aria-hidden="true" />
            {copied ? 'Skopiowano' : 'Kopiuj'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => download('png')} disabled={!ready} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Download className="size-4" aria-hidden="true" />
            Pobierz PNG (druk)
          </button>
          <button type="button" onClick={() => download('svg')} disabled={!ready} className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
            <FileImage className="size-4" aria-hidden="true" />
            Pobierz SVG
          </button>
        </div>

        <p className="rounded-2xl bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-600">
          Kod prowadzi na stronę instalacji. Na <strong>Androidzie</strong> klient stuka jeden przycisk i pojawia się systemowe okno
          instalacji. Na <strong>iPhonie</strong> Apple nie pozwala na automatyczną instalację – strona pokazuje 3 proste kroki w Safari.
        </p>
      </div>
    </div>
    <QrScanCounter onPick={setSource} />
    </div>
  )
}

function OptionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-xs font-bold text-zinc-700">{label}</legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  )
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'h-9 rounded-full border px-3.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        selected ? 'border-primary bg-primary/10 text-primary' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
      )}
    >
      {children}
    </button>
  )
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <fieldset className="flex flex-col">
      <legend className="mb-2 text-xs font-bold text-zinc-700">{label}</legend>
      <div className="flex items-center gap-2">
        {colors.map((color) => (
          <button
            key={color.id}
            type="button"
            aria-label={color.label}
            aria-pressed={value === color.id}
            onClick={() => onChange(color.id)}
            style={{ backgroundColor: color.id }}
            className={cn('size-8 rounded-full ring-offset-2 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', value === color.id && 'ring-2 ring-zinc-900')}
          />
        ))}
        <label className="relative size-8 cursor-pointer overflow-hidden rounded-full border border-dashed border-zinc-300 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]">
          <span className="sr-only">Własny kolor</span>
          <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </div>
    </fieldset>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-zinc-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-[#d71f16]" />
      {label}
    </label>
  )
}
