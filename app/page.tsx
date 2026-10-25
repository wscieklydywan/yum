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
import { getCachedCatalog } from '@/lib/public-cache'
import { jsonLd, restaurantSchema } from '@/lib/seo'

async function loadMenuForSchema() {
  try {
    return (await getCachedCatalog()) ?? []
  } catch {
    return []
  }
}

export default async function Page() {
  const menu = await loadMenuForSchema()

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(restaurantSchema(menu)) }} />
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
    </>
  )
}
