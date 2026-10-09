import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { WHEEL_PUBLIC_FIELDS, type WheelPrize } from '@/lib/wheel'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('wheel_prizes')
    .select(WHEEL_PUBLIC_FIELDS)
    .eq('active', true)
    .order('sort')
    .order('id')
  if (error) return NextResponse.json({ error: 'Nie udało się pobrać nagród.' }, { status: 503 })
  const prizes = (data ?? []).map((row) => ({ ...row, discount_value: Number(row.discount_value) })) as WheelPrize[]
  return NextResponse.json({ prizes }, { headers: { 'Cache-Control': 'no-store' } })
}
