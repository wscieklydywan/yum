import { NextResponse } from 'next/server'
import { loadPublicHomeSlides } from '@/lib/home-slides-public'

export async function GET() {
  const { body } = await loadPublicHomeSlides()
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
