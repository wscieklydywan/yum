import type { Viewport } from 'next'
import { ClubStandaloneGuard } from '@/components/club/club-standalone-guard'
import { ClubThemeColor } from '@/components/club/club-theme-color'

// themeColor matches --background so the status bar blends into the page instead of showing red.
// viewportFit 'cover' lets the page draw under the bottom system area, so the bottom nav (page background color) reaches the screen edge.
export const viewport: Viewport = {
  themeColor: '#f4f3f1',
  viewportFit: 'cover',
}

export default function YummyClubLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ClubStandaloneGuard />
      <ClubThemeColor />
      {children}
    </>
  )
}
