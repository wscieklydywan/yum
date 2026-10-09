import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const nextPath = request.nextUrl.searchParams.get('next')
  const safeNext = nextPath?.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/warsztat'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(safeNext, request.url))
  }

  const errorTarget = safeNext.startsWith('/yummy-club') ? '/yummy-club' : '/warsztat'
  return NextResponse.redirect(new URL(`${errorTarget}?error=auth`, request.url))
}
