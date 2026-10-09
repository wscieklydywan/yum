/** @type {import('next').NextConfig} */
const expectedSupabaseOrigin = 'https://mqnhgvgycadzciwigoug.supabase.co'
const targetSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const targetSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!targetSupabaseUrl || !targetSupabaseKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required')
}

const supabaseUrl = new URL(targetSupabaseUrl).origin
if (supabaseUrl !== expectedSupabaseOrigin) {
  throw new Error(`Supabase must use ${expectedSupabaseOrigin}`)
}

const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: targetSupabaseKey,
  },
  poweredByHeader: false,
  async headers() {
    // Static assets from /public (logos Glovo/Pyszne, menu photos, icons) change only with a deploy.
    // Browsers keep them for a week and refresh in the background; the CDN keeps them until the next deploy.
    const staticAssetCache = [{ key: 'Cache-Control', value: 'public, max-age=604800, s-maxage=31536000, stale-while-revalidate=86400' }]
    return [
      { source: '/images/:path*', headers: staticAssetCache },
      { source: '/:file(icon\\.svg|icon-light-32x32\\.png|icon-dark-32x32\\.png|apple-icon\\.png|placeholder\\.svg|placeholder\\.jpg|placeholder-logo\\.png|placeholder-logo\\.svg|placeholder-user\\.jpg)', headers: staticAssetCache },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
