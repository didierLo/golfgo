import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,        // ✅ garde la session en localStorage
        autoRefreshToken: true,      // ✅ renouvelle le token automatiquement
        detectSessionInUrl: true,
      }
    }
  )
}