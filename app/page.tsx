import { SiteHeader } from '@/components/yummy/site-header'
import { Hero } from '@/components/yummy/hero'
import { Features } from '@/components/yummy/features'
import { MenuSection } from '@/components/yummy/menu-section'
import { Promotions } from '@/components/yummy/promotions'
import { Ingredients } from '@/components/yummy/ingredients'
import { YummyClub } from '@/components/yummy/yummy-club'
import { Ordering } from '@/components/yummy/ordering'
import { Faq } from '@/components/yummy/faq'
import { SiteFooter } from '@/components/yummy/site-footer'
import { ProductDialog } from '@/components/yummy/product-dialog'
import { CartSheet } from '@/components/cart/cart-sheet'
import { HomeFarewell } from '@/components/yummy/home-farewell'
import { AdventCalendarBubble } from '@/components/yummy/advent-calendar'
import { BackNavigationScrollReset } from '@/components/yummy/back-navigation-scroll-reset'
import { getCachedCatalog } from '@/lib/public-cache'
import { jsonLd, restaurantSchema } from '@/lib/seo'
import { getPublicInfo, siteFacts } from '@/lib/public-info'

// Startup animation (components/yummy/home-farewell.tsx). Set to true to bring it back;
// to remove it for good, delete this flag, its usage below and the component file.
const SHOW_HOME_FAREWELL = false

async function loadMenuForSchema() {
  try {
    return (await getCachedCatalog()) ?? []
  } catch {
    return []
  }
}

export default async function Page() {
  const [menu, info] = await Promise.all([loadMenuForSchema(), getPublicInfo()])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(restaurantSchema(menu, siteFacts(info))) }} />
      <BackNavigationScrollReset />
      <SiteHeader />
      <main>
        <Hero />
        <Features />
        <MenuSection />
        <Promotions />
        <Ingredients />
        <YummyClub />
        <Ordering />
        <Faq />
      </main>
      <SiteFooter />
      <ProductDialog />
      <CartSheet />
      <AdventCalendarBubble />
      {SHOW_HOME_FAREWELL && <HomeFarewell />}
    </>
  )
}
