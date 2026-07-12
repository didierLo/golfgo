'use client';

import { createBrowserClient } from '@supabase/ssr'

// Workaround pour le bug connu de navigator.locks dans @supabase/auth-js
// (voir https://github.com/supabase/supabase-js/issues/2111 et #1594)
// Un verrou orphelin (onglet mis en veille, changement d'app sur mobile)
// peut bloquer indéfiniment les auth suivantes derrière un timeout de 10s.
// Comme GolfGo est très majoritairement utilisé en mono-onglet, on
// désactive le verrou multi-onglets au profit de la fiabilité.
const noOpLock = async <R,>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> => {
  return await fn()
}

let client: ReturnType<typeof createBrowserClient> | null = null

export const createClient = () => {
  if (client) return client
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        lock: noOpLock
      }
    }
  )
  return client
}