import { Bean, Carrot, Egg, Fish, Info, Milk, Nut, Shell, Shrimp, Sprout, Wheat, Wine, type LucideIcon } from 'lucide-react'

const ALLERGEN_ICONS: Record<string, LucideIcon> = {
  gluten: Wheat,
  mleko: Milk,
  jaja: Egg,
  ryby: Fish,
  orzechy: Nut,
  orzeszki: Nut,
  skorupiaki: Shrimp,
  mieczaki: Shell,
  soja: Bean,
  lubin: Bean,
  seler: Carrot,
  gorczyca: Sprout,
  sezam: Sprout,
  siarczyny: Wine,
}

export function AllergenIcon({ id, className }: { id: string; className?: string }) {
  const Icon = ALLERGEN_ICONS[id] ?? Info
  return <Icon className={className} aria-hidden="true" />
}
