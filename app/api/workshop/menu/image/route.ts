import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'

const MAX_BYTES = 2 * 1024 * 1024

export async function POST(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof Blob) || file.type !== 'image/webp' || file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Nieprawidłowy plik zdjęcia.' }, { status: 400 })
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const isWebp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  if (!isWebp) return NextResponse.json({ error: 'Plik nie jest obrazem WebP.' }, { status: 400 })
  const admin = createAdminClient()
  const requested = form?.get('folder')
  const folder = requested === 'wheel' || requested === 'categories' ? requested : 'products'
  const path = `${folder}/${crypto.randomUUID()}.webp`
  const { error } = await admin.storage.from('menu-images').upload(path, bytes, { contentType: 'image/webp', cacheControl: '31536000' })
  if (error) return NextResponse.json({ error: 'Nie udało się wgrać zdjęcia.' }, { status: 503 })
  const { data } = admin.storage.from('menu-images').getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl }, { status: 201 })
}
