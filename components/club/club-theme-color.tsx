'use client'

import { useEffect } from 'react'

const BROWSER_THEME_COLOR = '#f4f3f1'
const STANDALONE_THEME_COLOR = '#f4f3f1'

// Next keeps the root layout's red theme-color tag around on client-side navigation,
// so browsers keep tinting the address bar red. Force every theme-color tag while in the club.
// Browsers lighten the address bar tint, so the tab uses a darker shade; the PWA keeps the exact system-bar color.
export function ClubThemeColor() {
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const CLUB_THEME_COLOR = isStandalone ? STANDALONE_THEME_COLOR : BROWSER_THEME_COLOR
    const tags = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'))
    const previous = tags.map((tag) => tag.content)
    let created: HTMLMetaElement | null = null

    if (tags.length === 0) {
      created = document.createElement('meta')
      created.name = 'theme-color'
      document.head.appendChild(created)
      tags.push(created)
    }
    tags.forEach((tag) => {
      tag.content = CLUB_THEME_COLOR
    })

    return () => {
      if (created) {
        created.remove()
        return
      }
      tags.forEach((tag, index) => {
        tag.content = previous[index]
      })
    }
  }, [])

  return null
}
