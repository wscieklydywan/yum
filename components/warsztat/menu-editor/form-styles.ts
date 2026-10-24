export const inputClass = 'h-10 w-full rounded-xl border border-[#e5ded6] bg-white px-3 text-sm text-[#262220] outline-none transition-colors placeholder:text-[#b3aba2] focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-[#f6f3ef] disabled:text-[#8b827a]'
export const labelClass = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#7a726a]'
export const iconButtonClass = 'flex size-10 shrink-0 items-center justify-center rounded-xl text-[#8b827a] transition-colors hover:bg-[#f1ece6] hover:text-[#211e1b] disabled:pointer-events-none disabled:opacity-30'
export const dangerIconButtonClass = 'flex size-10 shrink-0 items-center justify-center rounded-xl text-[#8b827a] transition-colors hover:bg-red-50 hover:text-red-600'
export const addButtonClass = 'mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-primary hover:bg-primary/10'
export const cleanDecimal = (value: string) => value.replace(',', '.').replace(/[^0-9.]/g, '')
