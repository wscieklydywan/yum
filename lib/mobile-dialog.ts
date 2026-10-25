export const MOBILE_FULLSCREEN_DIALOG =
  'max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:ring-0'

// On phones, focusing the first input on open pops up the on-screen keyboard over the form.
export function skipInitialFocusOnMobile() {
  return !window.matchMedia('(max-width: 639px)').matches
}
