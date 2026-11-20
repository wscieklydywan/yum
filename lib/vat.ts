/**
 * Menu VAT letters. They are the restaurant's own labels — the POSNET bridge matches by percent
 * (`vatRate`) to whatever PTU slot the printer has configured, so A–D here need not equal printer slots.
 */
export const VAT_RATES = { A: 23, B: 8, C: 5, D: 0 } as const
export type VatLetter = keyof typeof VAT_RATES
export const VAT_LETTERS = Object.keys(VAT_RATES) as VatLetter[]

/** Fallback stamped on packaging items. Receipts re-assign packaging and delivery VAT from the order's products. */
export const SERVICE_VAT: VatLetter = 'B'

/** Prepared food (8%). Containers (burger box, wrap, foil) only ever hold food. */
export const FOOD_VAT: VatLetter = 'B'
/** Packaging sold on its own, with no product in the order. */
export const STANDALONE_PACKAGING_VAT: VatLetter = 'A'

export const isVatLetter = (value: unknown): value is VatLetter => typeof value === 'string' && Object.hasOwn(VAT_RATES, value)
export const parseVat = (value: unknown): VatLetter | null => (isVatLetter(value) ? value : null)
export const vatLabel = (vat: VatLetter) => `${vat} · ${VAT_RATES[vat]}%`
