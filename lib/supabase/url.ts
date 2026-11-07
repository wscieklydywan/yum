/** Accepts both the project URL and the REST endpoint (…/rest/v1/), since supabase-js appends the path itself. */
export const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
