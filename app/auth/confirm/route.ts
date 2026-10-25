import type { EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeRedirectUrl } from '@/lib/safe-redirect'

const ALLOWED_TYPES: EmailOtpType[] = ['signup', 'email', 'recovery', 'invite', 'magiclink', 'email_change']

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type') as EmailOtpType | null
  const nextPath = request.nextUrl.searchParams.get('next')

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(safeRedirectUrl(nextPath, request.url, '/yummy-club'))
  }

  return NextResponse.redirect(new URL('/yummy-club?error=auth', request.url))
}
