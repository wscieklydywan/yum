/** @type {import('next').NextConfig} */
const expectedSupabaseOrigin = 'https://mqnhgvgycadzciwigoug.supabase.co'
const targetSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || expectedSupabaseOrigin
const targetSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''

// Missing env vars must not crash the whole build; the Supabase client reports them at runtime.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !targetSupabaseKey) {
  console.warn('[config] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set for this build')
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
  // The www <-> apex canonical redirect lives only in Vercel -> Domains. Duplicating it here in the opposite
  // direction caused an ERR_TOO_MANY_REDIRECTS loop in production.
  async headers() {
    // Static assets from /public (logos Glovo/Pyszne, menu photos, icons) change only with a deploy.
    // Browsers keep them for a week and refresh in the background; the CDN keeps them until the next deploy.
    const staticAssetCache = [{ key: 'Cache-Control', value: 'public, max-age=604800, s-maxage=31536000, stale-while-revalidate=86400' }]
    return [
      { source: '/images/:path*', headers: staticAssetCache },
      { source: '/:file(placeholder\\.svg|warsztat-icon-192\\.png|warsztat-icon-512\\.png)', headers: staticAssetCache },
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
