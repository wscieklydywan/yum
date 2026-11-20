import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeRedirectUrl } from '@/lib/safe-redirect'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const nextPath = request.nextUrl.searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(safeRedirectUrl(nextPath, request.url, '/warsztat'))
  }

  const errorTarget = nextPath?.startsWith('/yummy-club') ? '/yummy-club' : '/warsztat'
  return NextResponse.redirect(new URL(`${errorTarget}?error=auth`, request.url))
}
