'use client'

import { useEffect, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { ImageUp, LoaderCircle, RefreshCw, ZoomIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export type CompressedImage = { blob: Blob; width: number; height: number }

const ASPECTS: { id: string; label: string; value: number | 'original' }[] = [
  { id: 'slot', label: 'Jak na stronie', value: 0 },
  { id: 'original', label: 'Oryginał', value: 'original' },
  { id: '1:1', label: '1:1', value: 1 },
  { id: '4:3', label: '4:3', value: 4 / 3 },
  { id: '3:4', label: '3:4', value: 3 / 4 },
  { id: '4:5', label: '4:5', value: 4 / 5 },
  { id: '16:9', label: '16:9', value: 16 / 9 },
  { id: '21:9', label: '21:9', value: 21 / 9 },
]
const WIDTHS = [480, 800, 1200, 1600, 2000, 2400]

const formatBytes = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${Math.round(bytes / 1024)} KB`)

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Nie udało się odczytać zdjęcia.'))
    image.src = src
  })
}

async function compress(image: HTMLImageElement, area: Area, maxWidth: number, quality: number): Promise<CompressedImage> {
  const scale = Math.min(1, maxWidth / area.width)
  const width = Math.max(1, Math.round(area.width * scale))
  const height = Math.max(1, Math.round(area.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Przeglądarka nie obsługuje kompresji.')
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
  if (!blob || blob.type !== 'image/webp') throw new Error('Przeglądarka nie obsługuje formatu WebP.')
  return { blob, width, height }
}

export function AboutImageEditor({
  file,
  slotAspect,
  defaultMaxWidth,
  title,
  onCancel,
  onConfirm,
}: {
  file: File | null
  slotAspect: number
  defaultMaxWidth: number
  title: string
  onCancel: () => void
  onConfirm: (image: CompressedImage) => Promise<void>
}) {
  return (
    <Dialog open={Boolean(file)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Wykadruj zdjęcie, ustaw rozmiar i jakość. Przed wgraniem zobaczysz, ile waży plik WebP.</DialogDescription>
        </DialogHeader>
        {file && <EditorBody key={`${file.name}-${file.size}-${file.lastModified}`} file={file} slotAspect={slotAspect} defaultMaxWidth={defaultMaxWidth} onCancel={onCancel} onConfirm={onConfirm} />}
      </DialogContent>
    </Dialog>
  )
}

function EditorBody({
  file,
  slotAspect,
  defaultMaxWidth,
  onCancel,
  onConfirm,
}: {
  file: File
  slotAspect: number
  defaultMaxWidth: number
  onCancel: () => void
  onConfirm: (image: CompressedImage) => Promise<void>
}) {
  const [src] = useState(() => URL.createObjectURL(file))
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [aspectId, setAspectId] = useState('slot')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [maxWidth, setMaxWidth] = useState(defaultMaxWidth)
  const [quality, setQuality] = useState(80)
  const [result, setResult] = useState<CompressedImage | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const runId = useRef(0)

  useEffect(() => {
    let active = true
    loadImage(src).then((loaded) => active && setImage(loaded)).catch((cause: Error) => active && setError(cause.message))
    return () => {
      active = false
      URL.revokeObjectURL(src)
    }
  }, [src])

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const chosen = ASPECTS.find((item) => item.id === aspectId)?.value ?? 0
  const aspect = chosen === 'original' ? (image ? image.naturalWidth / image.naturalHeight : slotAspect) : chosen || slotAspect

  // Debounced live compression so the size estimate follows every slider change without blocking dragging.
  useEffect(() => {
    if (!image || !area) return
    const id = ++runId.current
    setCompressing(true)
    const timer = window.setTimeout(() => {
      compress(image, area, maxWidth, quality / 100)
        .then((next) => {
          if (id !== runId.current) return
          setResult(next)
          setPreviewUrl(URL.createObjectURL(next.blob))
          setError('')
        })
        .catch((cause: Error) => id === runId.current && setError(cause.message))
        .finally(() => id === runId.current && setCompressing(false))
    }, 350)
    return () => window.clearTimeout(timer)
  }, [image, area, maxWidth, quality])

  const tooBig = result ? result.blob.size > 2 * 1024 * 1024 : false
  const saved = result ? Math.max(0, Math.round((1 - result.blob.size / file.size) * 100)) : 0

  async function upload() {
    if (!result || tooBig) return
    setUploading(true)
    setError('')
    try {
      await onConfirm(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się wgrać zdjęcia.')
      setUploading(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="relative w-full overflow-hidden rounded-2xl bg-zinc-900" style={{ aspectRatio: Math.max(aspect, 1) }}>
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, pixels) => setArea(pixels)}
          objectFit="contain"
        />
      </div>

      <label className="flex items-center gap-3 text-xs font-semibold text-zinc-600">
        <ZoomIn className="size-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">Powiększenie</span>
        <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-full accent-primary" />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Kadr</legend>
        <div className="flex flex-wrap gap-1.5">
          {ASPECTS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={aspectId === item.id}
              onClick={() => {
                setAspectId(item.id)
                setZoom(1)
                setCrop({ x: 0, y: 0 })
              }}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors',
                aspectId === item.id ? 'border-primary bg-primary text-primary-foreground' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Maks. szerokość</span>
          <select value={maxWidth} onChange={(event) => setMaxWidth(Number(event.target.value))} className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm">
            {[...new Set([...WIDTHS, defaultMaxWidth])].sort((a, b) => a - b).map((width) => (
              <option key={width} value={width}>
                {width} px{width === defaultMaxWidth ? ' (zalecane)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-zinc-500">
            Jakość WebP <span className="tabular-nums text-zinc-900">{quality}%</span>
          </span>
          <input type="range" min={30} max={100} step={1} value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="h-10 w-full accent-primary" />
        </label>
      </div>

      <div className="flex min-w-0 items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-zinc-200">
          {previewUrl && <img src={previewUrl} alt="Podgląd po kompresji" className="size-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1 text-xs leading-relaxed text-zinc-600" aria-live="polite">
          <p>
            Oryginał: <span className="font-bold text-zinc-900">{formatBytes(file.size)}</span>
            {image && <span className="text-zinc-500"> · {image.naturalWidth}×{image.naturalHeight}</span>}
          </p>
          {result ? (
            <p>
              Po kompresji: <span className={cn('font-bold', tooBig ? 'text-red-600' : 'text-emerald-700')}>{formatBytes(result.blob.size)}</span>
              <span className="text-zinc-500"> · {result.width}×{result.height}</span>
              {saved > 0 && <span className="font-semibold text-emerald-700"> · −{saved}%</span>}
            </p>
          ) : (
            <p className="text-zinc-500">Liczenie rozmiaru…</p>
          )}
          {tooBig && <p className="font-semibold text-red-600">Plik przekracza 2 MB – zmniejsz szerokość lub jakość.</p>}
        </div>
        {compressing && <RefreshCw className="size-4 shrink-0 animate-spin text-zinc-400" aria-label="Kompresowanie" />}
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={uploading}>Anuluj</Button>
        <Button type="button" onClick={() => void upload()} disabled={uploading || compressing || !result || tooBig}>
          {uploading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ImageUp className="size-4" aria-hidden="true" />}
          Wgraj WebP
        </Button>
      </DialogFooter>
    </div>
  )
}
