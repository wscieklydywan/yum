import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'

export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const admin = createAdminClient()
  const [groups, options, variants, assignments] = await Promise.all([
    admin.from('menu_modifier_groups').select('id, name, selection_mode, min_selections, max_selections, station, active, sort').order('sort'),
    admin.from('menu_modifier_options').select('id, group_id, name, price_delta, active, sort, stations').order('sort'),
    admin.from('menu_product_variants').select('id, product_id, name, price, active, sort').order('sort'),
    admin.from('menu_product_modifier_groups').select('product_id, group_id, required, min_selections, max_selections, price_delta_override, sort').order('sort'),
  ])
  if (groups.error || options.error || variants.error || assignments.error) {
    return NextResponse.json({ error: 'Nie udało się wczytać struktury menu.' }, { status: 503 })
  }

  return NextResponse.json({
    groups: groups.data.map((group) => ({
      ...group,
      min_selections: group.min_selections ?? 0,
      options: options.data
        .filter((option) => option.group_id === group.id)
        .map((option) => ({ id: option.id, name: option.name, price_delta: Number(option.price_delta), active: option.active, sort: option.sort, stations: option.stations ?? null })),
    })),
    variants: variants.data.map((variant) => ({ ...variant, price: Number(variant.price) })),
    assignments: assignments.data.map((assignment) => ({
      ...assignment,
      price_delta_override: assignment.price_delta_override === null ? null : Number(assignment.price_delta_override),
    })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
