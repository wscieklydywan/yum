import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('menu_products')
    .select('id, category_id, name, description, price, image, badge, rating, reviews, variant_label, sizes, extras, available, sort, station')
    .order('sort')

  if (error) return NextResponse.json({ error: 'Menu jest chwilowo niedostępne.' }, { status: 503 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
