'use client'

import { AlertTriangle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCart, type CartLine } from './cart-context'
import { useMenu, useMenuCategories } from '@/lib/use-menu'
import { useRestaurantStatus } from '@/lib/use-restaurant-status'
import { stationOpen } from '@/lib/restaurant-status'
import { availableModifiers, optionAvailable, resolveSelection } from '@/lib/menu-config'
import type { Station } from '@/lib/menu'

type Change = { key: string; next: Omit<CartLine, 'key'> | null }
type Group = { label: string; items: string[] }

export function useUnavailableLines() {
  const { lines } = useCart()
  const { products, isLoading } = useMenu()
  const { categories } = useMenuCategories()
  const { status } = useRestaurantStatus()

  const groups = new Map<string, string[]>()
  const changes: Change[] = []
  if (isLoading || products.length === 0) return { groups: [] as Group[], changes, status }

  const isOpen = status ? (station: Station) => stationOpen(status, station) : undefined
  const push = (label: string, item: string) => groups.set(label, [...(groups.get(label) ?? []), item])
  const categoryLabel = (id?: string) => categories.find((entry) => entry.id === id)?.label ?? 'Inne'

  for (const line of lines) {
    const product = products.find((entry) => entry.id === line.productId)
    if (!product) {
      push(categoryLabel(line.category), line.name)
      changes.push({ key: line.key, next: null })
      continue
    }
    const modifiers = line.selection?.modifiers
    if (!modifiers || !isOpen) continue
    let blocked = false
    for (const group of product.modifierGroups ?? []) {
      for (const id of modifiers[group.id] ?? []) {
        const option = group.options.find((entry) => entry.id === id)
        if (option && optionAvailable(group, option, isOpen)) continue
        blocked = true
        push(group.name, `${option?.name ?? 'dodatek'} (do: ${line.name})`)
      }
    }
    if (!blocked) continue
    const resolved = resolveSelection(product, { variantId: line.selection?.variantId, modifiers: availableModifiers(product, modifiers, isOpen) })
    changes.push({
      key: line.key,
      next: resolved.ok ? { ...line, unitPrice: resolved.unitPrice, details: resolved.details, selection: resolved.selection } : null,
    })
  }

  return { groups: [...groups].map(([label, items]) => ({ label, items })), changes, status }
}

export function UnavailableNotice({ className }: { className?: string }) {
  const { replaceLines } = useCart()
  const { groups, changes, status } = useUnavailableLines()
  if (groups.length === 0) return null

  const reason = status && !status.barOpen
    ? 'Bar jest tymczasowo wyłączony'
    : status && !status.kitchenOpen
      ? 'Kuchnia jest tymczasowo wyłączona'
      : 'Część pozycji jest już niedostępna'

  return (
    <div role="alert" className={className}>
      <div className="rounded-2xl bg-amber-50 p-4 text-amber-950 ring-1 ring-amber-200">
        <p className="flex items-center gap-2 text-sm font-bold">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {reason}
        </p>
        <p className="mt-1 text-xs text-amber-900">Te pozycje z koszyka są teraz niedostępne:</p>
        <dl className="mt-2 space-y-1 text-xs">
          {groups.map((group) => (
            <div key={group.label}>
              <dt className="inline font-semibold">{group.label}: </dt>
              <dd className="inline break-words">{group.items.join(', ')}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm font-semibold">Czy chcesz usunąć niedostępne pozycje z koszyka?</p>
        <button
          type="button"
          onClick={() => {
            replaceLines(changes)
            toast.success('Usunięto niedostępne pozycje')
          }}
          className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-amber-900 px-4 text-sm font-bold text-white hover:bg-amber-950"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Tak, usuń niedostępne
        </button>
      </div>
    </div>
  )
}
