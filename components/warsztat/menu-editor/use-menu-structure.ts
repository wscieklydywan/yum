'use client'

import useSWR from 'swr'
import { emptyStructure, type MenuStructure } from './menu-types'

async function fetchStructure(url: string): Promise<MenuStructure> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Nie udało się wczytać wariantów i dodatków.')
  return response.json()
}

export const MENU_STRUCTURE_KEY = '/api/workshop/menu/structure'

export function useMenuStructure(enabled: boolean) {
  const { data, error, isLoading, mutate } = useSWR<MenuStructure>(enabled ? MENU_STRUCTURE_KEY : null, fetchStructure)
  return { structure: data ?? emptyStructure, loaded: Boolean(data), error, isLoading, mutate }
}

export async function sendJson(url: string, method: string, body: unknown) {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error ?? 'Operacja nie powiodła się.')
  return result
}
