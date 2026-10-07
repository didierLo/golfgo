import { createClient } from '@supabase/supabase-js'
import { runBackup } from '@/lib/backup/runBackup'

export const runtime = 'nodejs'
export const maxDuration = 60

// Appelée chaque jour par le cron `reminders` (le plan Hobby n'autorise que 2 crons).
// La route décide elle-même : elle ne sauvegarde que si la dernière sauvegarde réussie
// date de plus de 6 jours. `?force=1` force une sauvegarde immédiate.
export async function GET(req: Request) {
  // Strict : ces données sont sensibles, donc pas de « secret absent = accès libre ».
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const force = new URL(req.url).searchParams.get('force') === '1'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const result = await runBackup(supabase, { force, trigger: 'cron' })
  return Response.json(result, { status: result.ok ? 200 : 500 })
}
