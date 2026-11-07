'use client'

import { useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { LoaderCircle, ZoomIn } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const MENU_IMAGE_ASPECT = 4 / 3
const OUTPUT_WIDTH = 1200
const OUTPUT_HEIGHT = Math.round(OUTPUT_WIDTH / MENU_IMAGE_ASPECT)

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Nie udało się odczytać zdjęcia.'))
    image.src = src
  })
}

function toWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
}

export async function cropToWebp(src: string, area: Area, aspect = MENU_IMAGE_ASPECT, maxWidth = OUTPUT_WIDTH) {
  const image = await loadImage(src)
  const width = Math.min(maxWidth, Math.round(area.width))
  const height = Math.round(width / aspect)
  const canvas = document.createElement('canvas')
  canvas.width = width || maxWidth
  canvas.height = height || Math.round(maxWidth / aspect) || OUTPUT_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Przeglądarka nie obsługuje kompresji.')
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height)
  for (const quality of [0.82, 0.72, 0.6, 0.5]) {
    const blob = await toWebp(canvas, quality)
    if (!blob || blob.type !== 'image/webp') throw new Error('Przeglądarka nie obsługuje formatu WebP.')
    if (blob.size <= 400 * 1024 || quality === 0.5) return blob
  }
  throw new Error('Nie udało się skompresować zdjęcia.')
}

export function MenuImageCropper({
  src,
  onCancel,
  onConfirm,
  aspect = MENU_IMAGE_ASPECT,
  maxWidth = OUTPUT_WIDTH,
  round = false,
  hint = 'Przesuń i przybliż zdjęcie. Kadr 4:3 odpowiada karcie dania na stronie. Zdjęcie zostanie automatycznie skompresowane do WebP.',
}: {
  src: string
  onCancel: () => void
  onConfirm: (blob: Blob) => Promise<void>
  aspect?: number
  maxWidth?: number
  round?: boolean
  hint?: string
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    if (!area) return
    setBusy(true)
    setError('')
    try {
      await onConfirm(await cropToWebp(src, area, aspect, maxWidth))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się przetworzyć zdjęcia.')
      setBusy(false)
    }
  }

  return <div className="flex flex-col gap-3">
    <div className="relative w-full overflow-hidden rounded-2xl bg-[#1d1a17]" style={{ aspectRatio: aspect }}>
      <Cropper image={src} crop={crop} zoom={zoom} aspect={aspect} cropShape={round ? 'round' : 'rect'} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)} objectFit="cover" showGrid={!round} />
    </div>
    <label className="flex items-center gap-3 text-xs font-semibold text-[#6f6861]">
      <ZoomIn className="size-4 shrink-0" aria-hidden="true" /><span className="sr-only">Powiększenie</span>
      <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-full accent-primary" />
    </label>
    <p className="text-[11px] leading-relaxed text-[#8b827a]">{hint}</p>
    {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>Anuluj</Button>
      <Button type="button" size="sm" onClick={() => void confirm()} disabled={busy || !area}>{busy && <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />}Przytnij i wgraj</Button>
    </div>
  </div>
}
