'use client'

import { useState, type KeyboardEvent } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { ALLERGENS } from '@/lib/allergens'
import { AllergenIcon } from '@/components/yummy/allergen-icon'
import { inputClass, labelClass } from './form-styles'

export function AllergenIngredientEditor({
  allergens,
  ingredients,
  onAllergensChange,
  onIngredientsChange,
}: {
  allergens: string[]
  ingredients: string[]
  onAllergensChange: (next: string[]) => void
  onIngredientsChange: (next: string[]) => void
}) {
  const [input, setInput] = useState('')

  const toggleAllergen = (id: string) =>
    onAllergensChange(allergens.includes(id) ? allergens.filter((entry) => entry !== id) : [...allergens, id])

  const addIngredients = () => {
    const parts = input.split(',').map((part) => part.replace(/\s+/g, ' ').trim().slice(0, 40)).filter(Boolean)
    if (parts.length === 0) return
    const existing = new Set(ingredients.map((entry) => entry.toLocaleLowerCase('pl-PL')))
    const fresh = parts.filter((part) => {
      const key = part.toLocaleLowerCase('pl-PL')
      if (existing.has(key)) return false
      existing.add(key)
      return true
    })
    onIngredientsChange([...ingredients, ...fresh].slice(0, 30))
    setInput('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addIngredients()
    } else if (event.key === 'Backspace' && !input && ingredients.length > 0) {
      onIngredientsChange(ingredients.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="menu-ingredient-input" className={labelClass}>
          Składniki (widoczne dla klienta)
        </label>
        <div className="flex gap-2">
          <input
            id="menu-ingredient-input"
            className={inputClass}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="np. wołowina, cheddar, bekon"
            maxLength={200}
          />
          <button
            type="button"
            onClick={addIngredients}
            disabled={!input.trim()}
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#262220] text-white transition-opacity disabled:opacity-30"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span className="sr-only">Dodaj składnik</span>
          </button>
        </div>
        <p className="mt-1 text-[11px] text-[#8b827a]">Enter lub przecinek dodaje składnik. Jeśli lista jest pusta, skład zostanie wzięty z opisu.</p>
        {ingredients.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Dodane składniki">
            {ingredients.map((ingredient) => (
              <li key={ingredient} className="inline-flex h-7 items-center gap-1 rounded-full bg-[#f3efe9] pl-3 pr-1 text-xs font-medium text-[#262220]">
                {ingredient}
                <button
                  type="button"
                  onClick={() => onIngredientsChange(ingredients.filter((entry) => entry !== ingredient))}
                  className="grid size-5 place-items-center rounded-full text-[#8b827a] hover:bg-white hover:text-[#262220]"
                >
                  <X className="size-3" aria-hidden="true" />
                  <span className="sr-only">Usuń {ingredient}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className={`${labelClass} mb-0`}>Alergeny UE (14)</p>
          <span className="text-[11px] font-semibold text-[#8b827a]">
            {allergens.length > 0 ? `zaznaczono ${allergens.length}` : 'brak'}
            {allergens.length > 0 && (
              <button type="button" onClick={() => onAllergensChange([])} className="ml-2 text-primary hover:underline">
                wyczyść
              </button>
            )}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {ALLERGENS.map((allergen) => {
            const active = allergens.includes(allergen.id)
            return (
              <button
                key={allergen.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleAllergen(allergen.id)}
                className={`flex h-10 min-w-0 items-center gap-2 rounded-xl border px-2.5 text-left text-xs font-semibold transition-colors ${
                  active ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-[#e5ded6] bg-white text-[#5f5953] hover:border-[#cfc6bb]'
                }`}
              >
                <AllergenIcon id={allergen.id} className={`size-4 shrink-0 ${active ? 'text-amber-700' : 'text-[#b3aaa0]'}`} />
                <span className="min-w-0 flex-1 truncate">{allergen.label}</span>
                {active && <Check className="size-3.5 shrink-0 text-amber-700" strokeWidth={3} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
