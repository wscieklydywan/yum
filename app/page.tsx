import { SiteHeader } from '@/components/yummy/site-header'
import { Hero } from '@/components/yummy/hero'
import { Features } from '@/components/yummy/features'
import { MenuSection } from '@/components/yummy/menu-section'
import { Promotions } from '@/components/yummy/promotions'
import { Ingredients } from '@/components/yummy/ingredients'
import { YummyClub } from '@/components/yummy/yummy-club'
import { Ordering } from '@/components/yummy/ordering'
import { SiteFooter } from '@/components/yummy/site-footer'
import { ProductDialog } from '@/components/yummy/product-dialog'
import { CartSheet } from '@/components/cart/cart-sheet'

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Features />
        <MenuSection />
        <Promotions />
        <Ingredients />
        <YummyClub />
        <Ordering />
      </main>
      <SiteFooter />
      <ProductDialog />
      <CartSheet />
    </>
  )
}
