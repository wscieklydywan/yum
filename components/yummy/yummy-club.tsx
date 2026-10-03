import Image from 'next/image'
import { ArrowRight, Coins, Crown, Gift, ShoppingBag, Tag } from 'lucide-react'

const rewards = [
  { name: 'Burger gratis', points: 700, image: '/images/classic.webp' },
  { name: 'Darmowe frytki', points: 350, image: '/images/fries.webp' },
  { name: 'Darmowy napój', points: 300, image: '/images/cola.webp' },
  { name: 'Zestaw dla dwóch', points: 1200, image: '/images/combo.webp' },
]

const tiers = [
  { name: 'Brązowy', points: '0–500 pkt', color: 'text-[#c9825a]' },
  { name: 'Srebrny', points: '500–1500 pkt', color: 'text-[#c4c9d0]' },
  { name: 'Złoty', points: '1500+ pkt', color: 'text-[#f5b936]' },
]

const clubSteps = [
  { title: 'Zamawiasz', description: 'Za każdą wydaną złotówkę dostajesz 1 punkt.', icon: ShoppingBag },
  { title: 'Zbierasz punkty', description: 'Punkty automatycznie wpadają na Twoje konto.', icon: Coins },
  { title: 'Odbierasz nagrody', description: 'Wymieniaj punkty na darmowe jedzenie i oferty.', icon: Gift },
  { title: 'Zdobywasz kolejne poziomy', description: 'Im więcej punktów, tym lepsze nagrody.', icon: Crown },
]

function PrizeWheel() {
  const lights = Array.from({ length: 14 }, (_, index) => {
    const angle = (index * 360) / 14
    const radians = (angle * Math.PI) / 180
    const radius = 46

    return {
      id: index,
      left: `${50 + Math.sin(radians) * radius}%`,
      top: `${50 - Math.cos(radians) * radius}%`,
    }
  })

  return (
    <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-[15rem] sm:max-w-[21rem] lg:max-w-[24rem]">
      <div className="absolute inset-[1%] rounded-full bg-gradient-to-br from-[#ffe08a] via-[#e89c43] to-[#ffcc65] p-[1.4%] shadow-[0_12px_28px_rgba(75,0,0,0.28)]">
        <div className="relative size-full rounded-full bg-[#bd1c18] p-[3.2%] shadow-[inset_0_0_0_1px_rgba(255,242,210,0.6)]">
          <div
            className="absolute inset-[6%] rounded-full border border-[#6c1b15]/45 shadow-[inset_0_2px_8px_rgba(80,15,8,0.22)]"
            style={{
              backgroundImage:
                'repeating-conic-gradient(from -30deg, transparent 0deg 59deg, rgba(130, 47, 29, 0.35) 59deg 60deg), conic-gradient(from -30deg, #fff0df 0deg 60deg, #dc2520 60deg 120deg, #fff0df 120deg 180deg, #dc2520 180deg 240deg, #fff0df 240deg 300deg, #dc2520 300deg 360deg)',
            }}
          />

          {lights.map(({ id, left, top }) => (
            <span
              key={id}
              className="absolute size-[2.4%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fff4c5] shadow-[0_0_5px_2px_rgba(255,204,78,0.72)]"
              style={{ left, top }}
            />
          ))}

          <span className="absolute left-1/2 top-[24%] size-[17%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-[#fff8ed] p-[1%] shadow-[0_3px_8px_rgba(59,20,10,0.22)]">
            <Image src="/images/classic.webp" alt="" fill sizes="64px" className="object-cover" />
          </span>
          <span className="absolute left-[74%] top-[37%] size-[17%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-[#fff8ed] p-[1%] shadow-[0_3px_8px_rgba(59,20,10,0.22)]">
            <Image src="/images/fries.webp" alt="" fill sizes="64px" className="object-cover" />
          </span>
          <span className="absolute left-[75%] top-[64%] grid size-[16%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#fff5e9] text-[#ca211b] shadow-[0_3px_8px_rgba(59,20,10,0.2)]">
            <Crown className="size-[58%]" strokeWidth={1.8} />
          </span>
          <span className="absolute left-1/2 top-[77%] size-[17%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-[#fff8ed] p-[1%] shadow-[0_3px_8px_rgba(59,20,10,0.22)]">
            <Image src="/images/cola.webp" alt="" fill sizes="64px" className="object-cover" />
          </span>
          <span className="absolute left-[25%] top-[64%] grid size-[16%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#fff5e9] text-[#ca211b] shadow-[0_3px_8px_rgba(59,20,10,0.2)]">
            <Gift className="size-[54%]" strokeWidth={1.8} />
          </span>
          <span className="absolute left-[26%] top-[37%] grid size-[16%] -translate-x-1/2 -translate-y-1/2 rotate-[-18deg] place-items-center rounded-full bg-[#fff5e9] text-[#ca211b] shadow-[0_3px_8px_rgba(59,20,10,0.2)]">
            <Tag className="size-[54%]" strokeWidth={1.8} />
          </span>

          <span className="absolute left-1/2 top-1/2 grid size-[25%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-[#efaa49] bg-[radial-gradient(circle_at_35%_28%,#f33e2d,#bf1715_65%,#85100e)] text-[#ffd36f] shadow-[0_3px_10px_rgba(70,0,0,0.38)]">
            <Crown className="size-[48%]" strokeWidth={1.7} />
          </span>
        </div>
      </div>

      <svg className="absolute left-1/2 top-[-1%] z-10 h-[16%] w-[13%] -translate-x-1/2 drop-shadow-[0_3px_3px_rgba(80,0,0,0.35)]" viewBox="0 0 64 84" fill="none" aria-hidden="true">
        <path d="M11 4.5h42c5 0 7.7 3.7 5.5 8.2L37.2 74c-2.1 5.2-8.3 5.2-10.4 0L5.5 12.7C3.3 8.2 6 4.5 11 4.5Z" fill="#D92720" stroke="#FFD36F" strokeWidth="5" strokeLinejoin="round" />
        <path d="M14 10h36" stroke="#FFF1C0" strokeOpacity=".75" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

export function YummyClub() {
  return (
    <section id="club" aria-labelledby="club-intro-title" className="bg-[#fbf8f4] px-4 py-8 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4 sm:mb-7">
          <h2 id="club-intro-title" className="text-2xl font-extrabold tracking-tight text-[#191513] sm:text-4xl">
            Więcej smaku z <span className="text-primary">Yummy Club</span>
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:mt-2 sm:text-lg">
            Zbieraj punkty, odkrywaj nagrody i zakręć kołem fortuny.
          </p>
        </header>
        <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#98130e] via-[#d51c16] to-[#ae130f] p-5 text-white shadow-[0_18px_40px_rgba(134,23,16,0.2)] sm:rounded-[2rem] sm:p-8 lg:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-[#ffad58]/20 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 -left-24 size-72 rounded-full bg-[#5a0504]/50 blur-3xl" />

          <div className="relative grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-8 lg:grid-cols-[1fr_0.9fr]">
            <div className="relative z-10 py-2 sm:py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/75 sm:text-sm sm:tracking-[0.24em]">
                Yummy Club
              </p>
              <h2 id="club-title" className="mt-3 font-script text-[2.2rem] leading-[0.95] sm:mt-4 sm:text-6xl lg:text-7xl">
                Zakręć<br />i wygraj!
              </h2>
              <p className="mt-3 max-w-sm text-xs leading-relaxed text-white/85 sm:mt-5 sm:text-lg sm:leading-relaxed">
                Jedno darmowe zakręcenie dziennie. Punkty wymieniaj na swoje ulubione nagrody.
              </p>
            </div>
            <div className="relative z-10 w-full py-1 sm:py-3">
              <PrizeWheel />
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-2 divide-x divide-white/25 rounded-2xl bg-white/10 px-2 py-3 backdrop-blur-sm sm:mt-7 sm:rounded-3xl sm:px-5 sm:py-4">
            <div className="flex items-center gap-2.5 px-1 sm:gap-4 sm:px-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-primary sm:size-12">
                <Gift className="size-5 sm:size-6" aria-hidden="true" />
              </span>
              <span className="text-[11px] leading-snug text-white sm:text-base">1 darmowe zakręcenie dziennie</span>
            </div>
            <div className="flex items-center gap-2.5 px-2 sm:gap-4 sm:px-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-primary sm:size-12">
                <Crown className="size-5 sm:size-6" aria-hidden="true" />
              </span>
              <span className="text-[11px] leading-snug text-white sm:text-base">Więcej zakręceń za punkty</span>
            </div>
          </div>

          <a
            href="/yummy-club"
            className="group relative mt-3 flex min-h-14 items-center justify-between rounded-full bg-white px-3 py-2 text-primary shadow-[0_6px_18px_rgba(70,0,0,0.16)] transition-transform hover:scale-[1.01] sm:mt-5 sm:min-h-[4.5rem] sm:px-5"
          >
            <span className="grid size-9 place-items-center rounded-full border-2 border-primary sm:size-11">
              <span className="size-4 rounded-full border-[3px] border-primary sm:size-5" />
            </span>
            <span className="text-sm font-bold sm:text-xl">Dołącz do klubu</span>
            <span className="grid size-10 place-items-center rounded-full bg-primary text-white transition-transform group-hover:translate-x-0.5 sm:size-12">
              <ArrowRight className="size-5 sm:size-6" aria-hidden="true" />
            </span>
          </a>
        </div>

        <section id="club-rewards" aria-labelledby="club-rewards-title" className="mt-6 sm:mt-10">
          <div className="mb-3 flex items-center justify-between gap-3 sm:mb-5">
            <h3 id="club-rewards-title" className="text-xl font-extrabold tracking-tight sm:text-3xl">
              Możliwe nagrody
            </h3>
            <span className="shrink-0 text-xs font-semibold text-primary sm:text-sm">Zbieraj punkty <ArrowRight className="inline size-4" aria-hidden="true" /></span>
          </div>
          <ul className="flex snap-x gap-2.5 overflow-x-auto pb-3 sm:gap-4 md:grid md:grid-cols-4 md:overflow-visible">
            {rewards.map((reward) => (
              <li key={reward.name} className="w-[min(42vw,10rem)] shrink-0 snap-start overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_rgba(48,32,21,0.06)] ring-1 ring-black/[0.035] md:w-auto">
                <div className="relative aspect-[1.1] overflow-hidden">
                  <Image src={reward.image} alt={reward.name} fill sizes="(max-width: 768px) 42vw, 25vw" className="object-cover" />
                </div>
                <div className="p-2.5 sm:p-4">
                  <p className="text-xs font-bold leading-snug sm:min-h-10 sm:text-base">{reward.name}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-primary sm:mt-2 sm:text-base">
                    <Crown className="size-4 sm:size-5" aria-hidden="true" /> {reward.points} pkt
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="club-steps-title" className="mt-6 sm:mt-10">
          <h3 id="club-steps-title" className="mb-3 text-xl font-extrabold tracking-tight sm:mb-5 sm:text-3xl">
            Jak to działa?
          </h3>
          <ol className="grid grid-cols-4 gap-1.5 sm:gap-4">
            {clubSteps.map(({ title, description, icon: Icon }, index) => (
              <li key={title} className="flex min-w-0 flex-col items-center px-0.5 text-center">
                <span className="relative grid size-12 place-items-center rounded-full bg-[#fce3de] text-primary sm:size-20">
                  <Icon className="size-6 sm:size-10" strokeWidth={1.8} aria-hidden="true" />
                  <span className="absolute -left-1 -top-1 grid size-5 place-items-center rounded-full bg-white text-[10px] font-bold text-primary shadow-sm sm:size-7 sm:text-sm">
                    {index + 1}
                  </span>
                </span>
                <h4 className="mt-2 text-[11px] font-bold leading-tight sm:mt-3 sm:text-base">{title}</h4>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground sm:text-sm sm:leading-relaxed">{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="club-levels" aria-labelledby="club-levels-title" className="relative mt-5 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent_55%),linear-gradient(135deg,#1b1b1b,#111110_60%,#242424)] p-4 text-white shadow-[0_12px_28px_rgba(20,17,16,0.24)] sm:mt-8 sm:rounded-[2rem] sm:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10">
            <h3 id="club-levels-title" className="text-lg font-extrabold leading-tight sm:text-3xl">
              Poziomy Yummy Club
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-white/80 sm:mt-2 sm:text-base">
              Zbieraj punkty i odblokowuj jeszcze lepsze nagrody.
            </p>
          </div>
          <div className="relative z-10 mt-4 sm:mt-6">
            <div aria-hidden="true" className="absolute left-[16%] right-[16%] top-[1.05rem] h-1 rounded-full bg-gradient-to-r from-[#d99b58] via-[#d5d7d9] to-[#f5b936] sm:top-[1.65rem] sm:h-1.5" />
            <ul className="relative grid grid-cols-3 gap-1">
              {tiers.map((tier) => (
                <li key={tier.name} className="flex min-w-0 flex-col items-center text-center">
                  <span className={`relative z-10 grid size-9 place-items-center rounded-full bg-white/[0.08] ring-1 ring-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${tier.color} sm:size-14`}>
                    <Crown className="size-6 sm:size-10" aria-hidden="true" />
                  </span>
                  <span className={`mt-1.5 text-[11px] font-semibold sm:mt-2 sm:text-base ${tier.color}`}>{tier.name}</span>
                  <span className="mt-0.5 whitespace-nowrap text-[10px] font-medium text-white sm:text-sm">{tier.points}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </section>
  )
}
