import { NextResponse } from 'next/server'
import { getCachedMenuCategories } from '@/lib/menu-categories-server'

export async function GET() {
  try {
    const data = await getCachedMenuCategories()
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-cache' } })
  } catch {
    return NextResponse.json({ error: 'Kategorie menu są chwilowo niedostępne.' }, { status: 503 })
  }
}
