import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { invalidatesPublic, PUBLIC_ABOUT_TAG } from '@/lib/public-cache'
import { DEFAULT_ABOUT, parseAboutContent } from '@/lib/about'
import { loadAbout, storageOrigin } from '@/lib/about-server'

export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const data = await loadAbout(createAdminClient()).catch(() => null)
  if (!data) return NextResponse.json({ error: 'Nie udało się wczytać strony „O nas”.' }, { status: 503 })
  return NextResponse.json({ content: data, defaults: DEFAULT_ABOUT })
}

async function handlePUT(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Niepoprawne dane.' }, { status: 400 })
  const parsed = parseAboutContent(body, storageOrigin(), true)
  if (typeof parsed === 'string') return NextResponse.json({ error: parsed }, { status: 400 })

  const { error } = await createAdminClient()
    .from('about_page')
    .upsert({ id: 1, content: parsed, updated_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać strony „O nas”.' }, { status: 500 })
  revalidatePath('/o-nas')
  return NextResponse.json({ content: parsed, defaults: DEFAULT_ABOUT })
}

export const PUT = invalidatesPublic([PUBLIC_ABOUT_TAG], handlePUT)
