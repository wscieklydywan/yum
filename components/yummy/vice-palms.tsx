const PALMS = "url('/images/palms-silhouette.png')"

const FADE = 'linear-gradient(to top, black 55%, transparent)'

/** Subtle palm silhouettes tucked into the bottom corners of the Yummy Club background. */
export function VicePalms() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -bottom-2 -left-6 h-[22vh] w-[34vw] max-w-xs bg-contain bg-left-bottom bg-no-repeat opacity-[0.07] sm:h-[32vh] sm:w-[26vw] lg:opacity-[0.09]"
        style={{ backgroundImage: PALMS, maskImage: FADE, WebkitMaskImage: FADE }}
      />
      <div
        className="absolute -bottom-2 -right-6 h-[22vh] w-[34vw] max-w-xs -scale-x-100 bg-contain bg-left-bottom bg-no-repeat opacity-[0.07] sm:h-[32vh] sm:w-[26vw] lg:opacity-[0.09]"
        style={{ backgroundImage: PALMS, maskImage: FADE, WebkitMaskImage: FADE }}
      />
    </div>
  )
}
