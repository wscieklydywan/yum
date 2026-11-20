/** GTA VI campaign items (VICE Zestaw, VICE Burger…) get the Vice City styling on the site. */
export function isViceProduct(product: { id: string; name?: string } | null | undefined) {
  if (!product) return false
  return product.id.startsWith('vice-') || /^vice\b/i.test(product.name ?? '')
}

/** The set that the slider CTA drops straight into the cart. */
export function isViceSet(product: { id: string; name?: string } | null | undefined) {
  if (!product) return false
  return product.id.startsWith('vice-zestaw') || /^vice\s+zestaw/i.test(product.name ?? '')
}
