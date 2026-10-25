import { ChevronDown } from 'lucide-react'
import { SectionHeading } from './section-heading'
import { FAQ } from '@/lib/seo'

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="bg-cream pb-10 pt-2 sm:pb-24 sm:pt-4">
      <div className="mx-auto max-w-3xl px-3 sm:px-6 lg:px-8">
        <SectionHeading
          id="faq-title"
          eyebrow="Pytania i odpowiedzi"
          title="Zanim zamówisz"
          description="Krótko o dostawie, zamówieniach i Yummy Club."
          compactMobile
        />
        <div className="mt-5 flex flex-col gap-2.5 sm:mt-10 sm:gap-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-[1.35rem] bg-white p-4 shadow-[0_8px_22px_rgba(48,32,21,0.045)] sm:rounded-3xl sm:p-6"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-sm font-bold sm:text-lg [&::-webkit-details-marker]:hidden">
                <h3 className="min-w-0 break-words">{item.q}</h3>
                <ChevronDown className="size-5 shrink-0 text-primary transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
